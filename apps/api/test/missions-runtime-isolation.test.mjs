import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createMissionRuntimePolicy, verifyMissionRuntimeStartup } from '../src/missions/runtime-isolation.js';

const release = JSON.parse(await readFile(new URL('../src/missions/id-agents-release.json', import.meta.url), 'utf8'));

function policy(overrides = {}) {
  return createMissionRuntimePolicy({
    missionId: 'mission-1', managerInstanceId: 'manager-1', teamId: 'team-1', release,
    runtimeRoot: '/srv/id-agents/766d8f5', workspaceRoot: '/srv/missions/mission-1/workspace',
    outputRoot: '/srv/missions/mission-1/output', credentialBrokerUrl: 'http://127.0.0.1:9910', managerPort: 9900,
    ...overrides,
  });
}

function proof(p = policy(), overrides = {}) {
  return {
    missionId: p.missionId, managerInstanceId: p.managerInstanceId, teamId: p.teamId,
    releaseCommit: p.release.commit, observedHashes: p.release.hashes,
    workspaceRoot: p.filesystem.mounts[1].source, publicExposure: false,
    workerCanReachManagerControlPlane: false, listeningUrls: ['http://127.0.0.1:9900'],
    environmentNames: Object.keys(p.process.environment), processCount: 8,
    agents: [{ agentId: 'agent-1', healthy: true, workspaceRoot: p.filesystem.mounts[1].source }],
    ...overrides,
  };
}

test('pins the reviewed upstream commit, MIT license, package, RESTAP version, and source hashes', () => {
  assert.equal(release.repository, 'https://github.com/idchain-world/id-agents.git');
  assert.equal(release.commit, '766d8f566386a020f0b8b5489beb6a2c6132d5d7');
  assert.equal(release.package.version, '0.1.113-beta');
  assert.equal(release.license.spdx, 'MIT');
  assert.equal(release.protocols.restap, '1.0');
  assert.match(release.hashes['src/agent-manager-db.ts'], /^[0-9a-f]{64}$/u);
  assert.equal(release.reviewedSurface.genericRemoteExposedToMissionClients, false);
});

test('builds deterministic loopback-only brokered runtime policy with isolated mounts and caps', () => {
  const p = policy();
  assert.equal(p.process.executable, 'node');
  assert.deepEqual(p.process.arguments, ['dist/start-agent-manager.js']);
  assert.equal(p.network.managerListen, '127.0.0.1');
  assert.equal(p.network.publicExposure, false);
  assert.equal(p.network.workerToManagerControlPlane, false);
  assert.equal(p.network.egressMode, 'broker_only');
  assert.equal(p.credentials.reusableSecretsInWorker, false);
  assert.ok(p.filesystem.deniedPaths.includes('/var/run/docker.sock'));
  assert.equal(p.filesystem.mounts[0].mode, 'ro');
  assert.equal(p.filesystem.mounts[1].noExec, true);
  assert.ok(!Object.keys(p.process.environment).some((name) => /OPENAI|ANTHROPIC|API_KEY|PRIVATE_KEY/u.test(name)));
  assert.equal(Object.isFrozen(p), true);
});

test('policy rejects public control/broker endpoints, overlapping roots, and unbounded resources', () => {
  assert.throws(() => policy({ credentialBrokerUrl: 'https://broker.example' }), /loopback/);
  assert.throws(() => policy({ outputRoot: '/srv/missions/mission-1/workspace/output' }), /disjoint/);
  assert.throws(() => policy({ limits: { maxAgents: 9 } }), /maxAgents/);
  assert.throws(() => policy({ limits: { maxPids: 1000 } }), /maxPids/);
});

test('startup proof requires exact release hashes, bindings, loopback listeners, isolated workers, and secret-free env', () => {
  const p = policy();
  assert.deepEqual(verifyMissionRuntimeStartup(p, proof(p)), { ok: true, code: 'runtime_verified', releaseCommit: release.commit, agentCount: 1 });
  assert.equal(verifyMissionRuntimeStartup(p, proof(p, { releaseCommit: '8'.repeat(40) })).code, 'release_mismatch');
  assert.equal(verifyMissionRuntimeStartup(p, proof(p, { observedHashes: { ...release.hashes, 'src/agent-manager-db.ts': '0'.repeat(64) } })).code, 'source_hash_mismatch');
  assert.equal(verifyMissionRuntimeStartup(p, proof(p, { listeningUrls: ['http://0.0.0.0:9900'] })).code, 'public_listener');
  assert.equal(verifyMissionRuntimeStartup(p, proof(p, { workerCanReachManagerControlPlane: true })).code, 'network_isolation_failed');
  assert.equal(verifyMissionRuntimeStartup(p, proof(p, { environmentNames: [...Object.keys(p.process.environment), 'OPENAI_API_KEY'] })).code, 'secret_environment_detected');
  assert.equal(verifyMissionRuntimeStartup(p, proof(p, { agents: new Array(9).fill(null).map((_, i) => ({ agentId: 'a' + i, healthy: true, workspaceRoot: p.filesystem.mounts[1].source })) })).code, 'agent_limit_failed');
});
