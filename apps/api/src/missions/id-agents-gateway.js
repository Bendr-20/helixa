import { digestMissionBody } from './idempotency.js';

const OPERATIONS = Object.freeze([
  'provisionMissionTeam', 'readMissionHealth', 'createMissionTask', 'assignMissionTask',
  'sendMissionInstruction', 'readMissionNews', 'listMissionOutputs', 'readMissionArtifact',
  'pauseMission', 'terminateMission',
]);
const OPERATION_SET = new Set(OPERATIONS);
const MAX_GRANT_TTL_MS = 60_000;

export class IdAgentsGatewayError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'IdAgentsGatewayError';
    this.code = code;
    this.status = status;
  }
}

export function createIdAgentsGateway({
  release,
  bindings,
  adapter,
  verifyGrant,
  nonces,
  credentialBroker,
  quotas,
  killSwitch = () => false,
  now = Date.now,
} = {}) {
  const releaseCommit = commitHash(release?.commit, 'release.commit');
  if (!bindings || typeof bindings.resolve !== 'function') throw new TypeError('ID Agents binding resolver is required.');
  if (!adapter || OPERATIONS.some((name) => typeof adapter[name] !== 'function')) throw new TypeError('ID Agents typed adapter is incomplete.');
  if (typeof verifyGrant !== 'function' || !nonces || typeof nonces.consume !== 'function') throw new TypeError('ID Agents grant verifier is invalid.');
  if (!credentialBroker || typeof credentialBroker.authorize !== 'function') throw new TypeError('ID Agents credential broker is required.');
  if (!quotas || typeof quotas.consume !== 'function') throw new TypeError('ID Agents quota port is required.');
  if (typeof killSwitch !== 'function' || typeof now !== 'function') throw new TypeError('ID Agents gateway dependencies are invalid.');

  async function invoke(operation, request = {}) {
    if (!OPERATION_SET.has(operation)) throw new IdAgentsGatewayError('operation_denied', 'ID Agents operation is not allowed.', 403);
    exact(request, ['grant', 'payload'], 'gateway request');
    if (await killSwitch()) throw new IdAgentsGatewayError('gateway_paused', 'ID Agents mission gateway is paused.', 503);
    const payload = normalizePayload(operation, request.payload);
    const grant = normalizeGrant(request.grant);
    if (grant.operation !== operation) throw new IdAgentsGatewayError('grant_scope_mismatch', 'Grant operation does not match the request.', 403);
    if (grant.releaseCommit !== releaseCommit) throw new IdAgentsGatewayError('release_mismatch', 'Grant does not bind the pinned ID Agents release.', 403);
    const timestamp = now();
    if (!Number.isSafeInteger(timestamp) || timestamp < 0) throw new TypeError('Gateway clock returned an invalid timestamp.');
    if (grant.issuedAt > timestamp || grant.expiresAt <= timestamp || grant.expiresAt - grant.issuedAt > MAX_GRANT_TTL_MS) {
      throw new IdAgentsGatewayError('grant_expired', 'Grant is expired or outside the allowed lifetime.', 403);
    }
    const bodyHash = digestMissionBody(payload);
    if (grant.bodyHash !== bodyHash) throw new IdAgentsGatewayError('grant_body_mismatch', 'Grant body hash does not match the request.', 403);
    assertResourceBinding(operation, grant, payload);
    const signaturePayload = Object.freeze({
      version: grant.version, missionId: grant.missionId, managerInstanceId: grant.managerInstanceId,
      releaseCommit: grant.releaseCommit, teamId: grant.teamId, operation: grant.operation,
      agentId: grant.agentId, taskId: grant.taskId, bodyHash: grant.bodyHash, nonce: grant.nonce,
      issuedAt: grant.issuedAt, expiresAt: grant.expiresAt,
    });
    if (!await verifyGrant(signaturePayload, grant.signature)) throw new IdAgentsGatewayError('grant_signature_invalid', 'Grant signature is invalid.', 403);

    const binding = normalizeBinding(await bindings.resolve({
      missionId: grant.missionId,
      managerInstanceId: grant.managerInstanceId,
      teamId: grant.teamId,
      agentId: grant.agentId,
      taskId: grant.taskId,
    }), grant, releaseCommit);
    if (!await nonces.consume({ missionId: grant.missionId, nonce: grant.nonce, expiresAt: grant.expiresAt })) {
      throw new IdAgentsGatewayError('grant_replayed', 'Grant nonce was already consumed.', 409);
    }
    if (!await quotas.consume({ missionId: grant.missionId, operation, units: quotaUnits(operation, payload), at: timestamp })) {
      throw new IdAgentsGatewayError('quota_exceeded', 'Mission runtime quota exceeded.', 429);
    }
    const credential = await credentialBroker.authorize({
      missionId: grant.missionId,
      managerInstanceId: grant.managerInstanceId,
      teamId: grant.teamId,
      operation,
      credentialRef: binding.credentialRef,
      expiresAt: Math.min(grant.expiresAt, timestamp + 30_000),
    });
    validateCredentialHandle(credential);
    return adapter[operation](Object.freeze({ binding: freezeCopy(binding), credential: freezeCopy(credential), payload }));
  }

  const gateway = { invoke };
  for (const operation of OPERATIONS) gateway[operation] = (request) => invoke(operation, request);
  return Object.freeze(gateway);
}

export { OPERATIONS as ID_AGENTS_MISSION_OPERATIONS };

function normalizeGrant(value) {
  exact(value, ['agentId', 'bodyHash', 'expiresAt', 'issuedAt', 'managerInstanceId', 'missionId', 'nonce', 'operation', 'releaseCommit', 'signature', 'taskId', 'teamId', 'version'], 'service grant');
  const operation = identifier(value.operation, 'operation');
  if (!OPERATION_SET.has(operation)) throw new IdAgentsGatewayError('operation_denied', 'Grant operation is not allowed.', 403);
  return Object.freeze({
    version: value.version === 1 ? 1 : invalid('grant version'),
    missionId: identifier(value.missionId, 'missionId'),
    managerInstanceId: identifier(value.managerInstanceId, 'managerInstanceId'),
    releaseCommit: commitHash(value.releaseCommit, 'releaseCommit'),
    teamId: identifier(value.teamId, 'teamId'),
    operation,
    agentId: nullableIdentifier(value.agentId, 'agentId'),
    taskId: nullableIdentifier(value.taskId, 'taskId'),
    bodyHash: hash(value.bodyHash, 'bodyHash'),
    nonce: identifier(value.nonce, 'nonce'),
    issuedAt: nonNegativeInteger(value.issuedAt, 'issuedAt'),
    expiresAt: nonNegativeInteger(value.expiresAt, 'expiresAt'),
    signature: bounded(value.signature, 'signature', 8, 4096),
  });
}

function normalizePayload(operation, value) {
  switch (operation) {
    case 'provisionMissionTeam': {
      exact(value, ['agents', 'teamName'], 'provision payload');
      if (!Array.isArray(value.agents) || value.agents.length === 0 || value.agents.length > 8) invalid('agents');
      const agents = value.agents.map((agent) => {
        exact(agent, ['agentId', 'name', 'role', 'runtime'], 'agent');
        return Object.freeze({ agentId: identifier(agent.agentId, 'agentId'), name: bounded(agent.name, 'name', 1, 80), role: bounded(agent.role, 'role', 1, 128), runtime: runtime(agent.runtime) });
      });
      if (new Set(agents.map((agent) => agent.agentId)).size !== agents.length) invalid('duplicate agent');
      return Object.freeze({ teamName: bounded(value.teamName, 'teamName', 1, 80), agents: Object.freeze(agents) });
    }
    case 'readMissionHealth': exact(value, [], 'health payload'); return Object.freeze({});
    case 'createMissionTask':
      exact(value, ['description', 'taskId', 'title'], 'task payload');
      return Object.freeze({ taskId: identifier(value.taskId, 'taskId'), title: bounded(value.title, 'title', 1, 200), description: bounded(value.description, 'description', 0, 4000) });
    case 'assignMissionTask':
      exact(value, ['agentId', 'taskId'], 'assignment payload');
      return Object.freeze({ taskId: identifier(value.taskId, 'taskId'), agentId: identifier(value.agentId, 'agentId') });
    case 'sendMissionInstruction':
      exact(value, ['agentId', 'instruction', 'taskId'], 'instruction payload');
      return Object.freeze({ agentId: identifier(value.agentId, 'agentId'), taskId: identifier(value.taskId, 'taskId'), instruction: bounded(value.instruction, 'instruction', 1, 8000) });
    case 'readMissionNews':
      exact(value, ['agentId', 'cursor', 'limit'], 'news payload');
      return Object.freeze({ agentId: identifier(value.agentId, 'agentId'), cursor: nullableIdentifier(value.cursor, 'cursor'), limit: boundedInteger(value.limit, 'limit', 1, 100) });
    case 'listMissionOutputs':
      exact(value, ['agentId', 'limit'], 'outputs payload');
      return Object.freeze({ agentId: identifier(value.agentId, 'agentId'), limit: boundedInteger(value.limit, 'limit', 1, 100) });
    case 'readMissionArtifact':
      exact(value, ['agentId', 'path'], 'artifact payload');
      return Object.freeze({ agentId: identifier(value.agentId, 'agentId'), path: artifactPath(value.path) });
    case 'pauseMission':
    case 'terminateMission':
      exact(value, ['reason'], 'lifecycle payload');
      return Object.freeze({ reason: bounded(value.reason, 'reason', 1, 500) });
    default: throw new IdAgentsGatewayError('operation_denied', 'Operation is not allowed.', 403);
  }
}

function assertResourceBinding(operation, grant, payload) {
  const agentId = Object.hasOwn(payload, 'agentId') ? payload.agentId : null;
  const taskId = Object.hasOwn(payload, 'taskId') ? payload.taskId : null;
  if (agentId !== grant.agentId || taskId !== grant.taskId) throw new IdAgentsGatewayError('grant_resource_mismatch', 'Grant resource binding does not match the request.', 403);
  if (['readMissionHealth', 'provisionMissionTeam', 'pauseMission', 'terminateMission'].includes(operation) && (grant.agentId !== null || grant.taskId !== null)) {
    throw new IdAgentsGatewayError('grant_resource_mismatch', 'Mission-wide grant must not bind an agent or task.', 403);
  }
}

function normalizeBinding(binding, grant, releaseCommit) {
  if (!binding || typeof binding !== 'object') throw new IdAgentsGatewayError('binding_missing', 'Mission runtime binding is unavailable.', 503);
  exact(binding, ['credentialRef', 'managerBaseUrl', 'managerInstanceId', 'missionId', 'releaseCommit', 'teamId'], 'runtime binding');
  if (binding.missionId !== grant.missionId || binding.managerInstanceId !== grant.managerInstanceId || binding.teamId !== grant.teamId || binding.releaseCommit !== releaseCommit) {
    throw new IdAgentsGatewayError('binding_mismatch', 'Mission runtime binding does not match the grant.', 403);
  }
  return Object.freeze({
    missionId: binding.missionId, managerInstanceId: binding.managerInstanceId, teamId: binding.teamId, releaseCommit,
    managerBaseUrl: loopbackUrl(binding.managerBaseUrl), credentialRef: identifier(binding.credentialRef, 'credentialRef'),
  });
}
function validateCredentialHandle(value) {
  exact(value, ['expiresAt', 'kind', 'reference'], 'credential handle');
  if (value.kind !== 'brokered') throw new TypeError('Credential handle must be brokered.');
  identifier(value.reference, 'credential reference');
  nonNegativeInteger(value.expiresAt, 'credential expiry');
}
function quotaUnits(operation, payload) { return operation === 'sendMissionInstruction' ? Math.max(1, Math.ceil(payload.instruction.length / 1000)) : 1; }
function loopbackUrl(value) { const url = new URL(value); if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new IdAgentsGatewayError('manager_not_loopback', 'Mission manager must be loopback-only.', 503); return url.toString(); }
function artifactPath(value) { if (typeof value !== 'string' || value.length < 1 || value.length > 512 || value.includes('\0') || value.startsWith('/') || value.split(/[\/]/u).includes('..')) invalid('artifact path'); return value; }
function runtime(value) { if (!['claude', 'codex', 'gemini', 'opencode'].includes(value)) invalid('runtime'); return value; }
function exact(value, keys, label) { if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new TypeError(label + ' must be a plain object.'); const actual = Object.keys(value).sort(); const expected = [...keys].sort(); if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new TypeError(label + ' fields are invalid.'); }
function identifier(value, label) { if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(value)) throw new TypeError(label + ' is invalid.'); return value; }
function nullableIdentifier(value, label) { return value === null ? null : identifier(value, label); }
function bounded(value, label, min, max) { if (typeof value !== 'string' || value.length < min || value.length > max) throw new TypeError(label + ' is invalid.'); return value; }
function boundedInteger(value, label, min, max) { if (!Number.isSafeInteger(value) || value < min || value > max) throw new TypeError(label + ' is invalid.'); return value; }
function nonNegativeInteger(value, label) { return boundedInteger(value, label, 0, Number.MAX_SAFE_INTEGER); }
function hash(value, label) { if (typeof value !== 'string' || !/^[0-9a-f]{64}$/u.test(value)) throw new TypeError(label + ' is invalid.'); return value; }
function commitHash(value, label) { if (typeof value !== 'string' || !/^[0-9a-f]{40}$/u.test(value)) throw new TypeError(label + ' is invalid.'); return value; }
function invalid(label) { throw new TypeError(label + ' is invalid.'); }
function freezeCopy(value) { return deepFreeze(structuredClone(value)); }
function deepFreeze(value) { if (value && typeof value === 'object') { for (const nested of Object.values(value)) deepFreeze(nested); Object.freeze(value); } return value; }
