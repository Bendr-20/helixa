import path from 'node:path';

export function createMissionRuntimePolicy({
  missionId,
  managerInstanceId,
  teamId,
  release,
  runtimeRoot,
  workspaceRoot,
  outputRoot,
  credentialBrokerUrl,
  managerPort,
  limits = {},
} = {}) {
  const commit = commitHash(release?.commit, 'release.commit');
  const hashes = normalizeHashes(release?.hashes);
  const runtime = absolute(runtimeRoot, 'runtimeRoot');
  const workspace = absolute(workspaceRoot, 'workspaceRoot');
  const output = absolute(outputRoot, 'outputRoot');
  if (overlap(runtime, workspace) || overlap(runtime, output) || overlap(workspace, output)) throw new TypeError('Runtime, workspace, and output roots must be disjoint.');
  const broker = loopbackUrl(credentialBrokerUrl, 'credentialBrokerUrl');
  const boundedLimits = Object.freeze({
    maxAgents: integer(limits.maxAgents ?? 8, 'maxAgents', 1, 8),
    maxTasks: integer(limits.maxTasks ?? 100, 'maxTasks', 1, 1000),
    maxArtifactBytes: integer(limits.maxArtifactBytes ?? 20 * 1024 * 1024, 'maxArtifactBytes', 1024, 1024 * 1024 * 1024),
    maxMemoryBytes: integer(limits.maxMemoryBytes ?? 2 * 1024 * 1024 * 1024, 'maxMemoryBytes', 128 * 1024 * 1024, 8 * 1024 * 1024 * 1024),
    maxPids: integer(limits.maxPids ?? 128, 'maxPids', 8, 512),
    maxCpuMillisPerMinute: integer(limits.maxCpuMillisPerMinute ?? 30_000, 'maxCpuMillisPerMinute', 1000, 60_000),
    maxRuntimeSeconds: integer(limits.maxRuntimeSeconds ?? 86_400, 'maxRuntimeSeconds', 60, 604_800),
  });
  return deepFreeze({
    schemaVersion: 1,
    missionId: identifier(missionId, 'missionId'),
    managerInstanceId: identifier(managerInstanceId, 'managerInstanceId'),
    teamId: identifier(teamId, 'teamId'),
    release: { repository: release.repository, commit, hashes },
    process: {
      executable: 'node',
      arguments: ['dist/start-agent-manager.js'],
      workingDirectory: runtime,
      environment: {
        ID_AGENTS_RELEASE_COMMIT: commit,
        ID_MISSION_ID: missionId,
        ID_TEAM: teamId,
        ID_MANAGER_HOST: '127.0.0.1',
        ID_MANAGER_PORT: String(integer(managerPort, 'managerPort', 1024, 65535)),
        ID_CREDENTIAL_BROKER_URL: broker,
      },
    },
    filesystem: {
      readOnlyRoot: true,
      mounts: [
        { source: runtime, target: '/opt/id-agents', mode: 'ro', noExec: false },
        { source: workspace, target: '/workspace', mode: 'rw', noExec: true },
        { source: output, target: '/workspace/output', mode: 'rw', noExec: true },
      ],
      deniedPaths: ['/var/run/docker.sock', '/run/containerd/containerd.sock', '/run/host', '/home/ubuntu/.ssh', '/home/ubuntu/.aws'],
    },
    network: {
      managerListen: '127.0.0.1',
      managerPort: Number(managerPort),
      publicExposure: false,
      workerToManagerControlPlane: false,
      egressMode: 'broker_only',
      allowedEgress: [broker],
    },
    credentials: { mode: 'brokered', reusableSecretsInWorker: false },
    limits: boundedLimits,
  });
}

export function verifyMissionRuntimeStartup(policy, proof = {}) {
  if (!policy || policy.schemaVersion !== 1) throw new TypeError('Runtime policy is invalid.');
  exact(proof, ['agents', 'environmentNames', 'listeningUrls', 'managerInstanceId', 'missionId', 'observedHashes', 'processCount', 'publicExposure', 'releaseCommit', 'teamId', 'workerCanReachManagerControlPlane', 'workspaceRoot'], 'runtime startup proof');
  if (proof.missionId !== policy.missionId || proof.managerInstanceId !== policy.managerInstanceId || proof.teamId !== policy.teamId) return failure('binding_mismatch');
  if (proof.releaseCommit !== policy.release.commit) return failure('release_mismatch');
  const observed = normalizeHashes(proof.observedHashes);
  for (const [file, expected] of Object.entries(policy.release.hashes)) if (observed[file] !== expected) return failure('source_hash_mismatch', { file });
  if (proof.workspaceRoot !== policy.filesystem.mounts[1].source) return failure('workspace_mismatch');
  if (proof.publicExposure !== false || proof.workerCanReachManagerControlPlane !== false) return failure('network_isolation_failed');
  if (!Array.isArray(proof.listeningUrls) || proof.listeningUrls.length === 0) return failure('listener_missing');
  try { for (const url of proof.listeningUrls) loopbackUrl(url, 'listeningUrl'); } catch { return failure('public_listener'); }
  const expectedEnvironmentNames = Object.keys(policy.process.environment).sort();
  if (!Array.isArray(proof.environmentNames) || proof.environmentNames.some((name) => typeof name !== 'string')) return failure('secret_environment_detected');
  const environmentNames = [...proof.environmentNames].sort();
  if (environmentNames.length !== expectedEnvironmentNames.length || environmentNames.some((name, index) => name !== expectedEnvironmentNames[index])) return failure('secret_environment_detected');
  if (!Number.isSafeInteger(proof.processCount) || proof.processCount < 1 || proof.processCount > policy.limits.maxPids) return failure('process_limit_failed');
  if (!Array.isArray(proof.agents) || proof.agents.length < 1 || proof.agents.length > policy.limits.maxAgents) return failure('agent_limit_failed');
  for (const agent of proof.agents) {
    exact(agent, ['agentId', 'healthy', 'workspaceRoot'], 'agent proof');
    if (!agent.healthy || agent.workspaceRoot !== policy.filesystem.mounts[1].source || typeof agent.agentId !== 'string') return failure('agent_startup_failed');
  }
  return deepFreeze({ ok: true, code: 'runtime_verified', releaseCommit: proof.releaseCommit, agentCount: proof.agents.length });
}

function normalizeHashes(value) { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Release hashes are invalid.'); const result = {}; for (const [file, digest] of Object.entries(value)) { if (!/^[A-Za-z0-9_./-]{1,256}$/u.test(file) || typeof digest !== 'string' || !/^[0-9a-f]{64}$/u.test(digest)) throw new TypeError('Release hash is invalid.'); result[file] = digest; } if (Object.keys(result).length === 0) throw new TypeError('Release hashes are required.'); return Object.freeze(result); }
function failure(code, details = undefined) { return deepFreeze({ ok: false, code, ...(details ? { details } : {}) }); }
function loopbackUrl(value, label) { const url = new URL(value); if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password) throw new TypeError(label + ' must be loopback HTTP.'); return url.toString(); }
function overlap(a, b) { const rel = path.relative(a, b); const reverse = path.relative(b, a); return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel)) || (!reverse.startsWith('..' + path.sep) && reverse !== '..' && !path.isAbsolute(reverse)); }
function absolute(value, label) { if (typeof value !== 'string' || !path.isAbsolute(value)) throw new TypeError(label + ' must be absolute.'); return path.resolve(value); }
function identifier(value, label) { if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(value)) throw new TypeError(label + ' is invalid.'); return value; }
function commitHash(value, label) { if (typeof value !== 'string' || !/^[0-9a-f]{40}$/u.test(value)) throw new TypeError(label + ' is invalid.'); return value; }
function integer(value, label, min, max) { if (!Number.isSafeInteger(value) || value < min || value > max) throw new TypeError(label + ' is invalid.'); return value; }
function exact(value, keys, label) { if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new TypeError(label + ' must be a plain object.'); const actual = Object.keys(value).sort(); const expected = [...keys].sort(); if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new TypeError(label + ' fields are invalid.'); }
function deepFreeze(value) { if (value && typeof value === 'object') { for (const nested of Object.values(value)) deepFreeze(nested); Object.freeze(value); } return value; }
