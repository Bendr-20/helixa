import assert from 'node:assert/strict';
import test from 'node:test';

import { digestMissionBody } from '../src/missions/idempotency.js';
import { createIdAgentsGateway, ID_AGENTS_MISSION_OPERATIONS } from '../src/missions/id-agents-gateway.js';

const COMMIT = '7'.repeat(40);
const NOW = 10_000;

function fixture(overrides = {}) {
  const calls = [];
  const used = new Set();
  const adapter = Object.fromEntries(ID_AGENTS_MISSION_OPERATIONS.map((operation) => [operation, async (input) => { calls.push(['adapter.' + operation, input]); return { ok: true, operation }; }]));
  const binding = {
    missionId: 'mission-1', managerInstanceId: 'manager-1', teamId: 'team-1', releaseCommit: COMMIT,
    managerBaseUrl: 'http://127.0.0.1:9900', credentialRef: 'credential-1',
  };
  const gateway = createIdAgentsGateway({
    release: { commit: COMMIT },
    bindings: { async resolve(input) { calls.push(['binding', input]); return { ...binding, ...(overrides.binding || {}) }; } },
    adapter,
    async verifyGrant(payload, signature) { calls.push(['verify', payload]); return overrides.signatureValid ?? signature === 'signed-grant'; },
    nonces: { async consume({ nonce }) { if (used.has(nonce)) return false; used.add(nonce); return true; } },
    credentialBroker: { async authorize(input) { calls.push(['broker', input]); return { kind: 'brokered', reference: 'handle-1', expiresAt: NOW + 20_000 }; } },
    quotas: { async consume(input) { calls.push(['quota', input]); return overrides.quotaAllowed ?? true; } },
    killSwitch: async () => overrides.killed ?? false,
    now: () => NOW,
  });
  return { gateway, calls };
}

function grant(operation, payload, overrides = {}) {
  return {
    version: 1, missionId: 'mission-1', managerInstanceId: 'manager-1', releaseCommit: COMMIT, teamId: 'team-1',
    operation, agentId: Object.hasOwn(payload, 'agentId') ? payload.agentId : null,
    taskId: Object.hasOwn(payload, 'taskId') ? payload.taskId : null,
    bodyHash: digestMissionBody(payload), nonce: 'nonce-' + operation, issuedAt: NOW - 1000, expiresAt: NOW + 30_000,
    signature: 'signed-grant', ...overrides,
  };
}

async function call(gateway, operation, payload, overrides = {}) {
  return gateway[operation]({ payload, grant: grant(operation, payload, overrides) });
}

test('exports only the ten reviewed typed mission operations and dispatches exact frozen inputs', async () => {
  assert.deepEqual(ID_AGENTS_MISSION_OPERATIONS, [
    'provisionMissionTeam', 'readMissionHealth', 'createMissionTask', 'assignMissionTask', 'sendMissionInstruction',
    'readMissionNews', 'listMissionOutputs', 'readMissionArtifact', 'pauseMission', 'terminateMission',
  ]);
  const f = fixture();
  const payload = { taskId: 'task-1', agentId: 'agent-1', instruction: 'Build the bounded artifact.' };
  const result = await call(f.gateway, 'sendMissionInstruction', payload);
  assert.equal(result.operation, 'sendMissionInstruction');
  const dispatched = f.calls.find(([name]) => name === 'adapter.sendMissionInstruction')[1];
  assert.equal(dispatched.binding.managerBaseUrl, 'http://127.0.0.1:9900/');
  assert.deepEqual(dispatched.credential, { kind: 'brokered', reference: 'handle-1', expiresAt: NOW + 20_000 });
  assert.equal(Object.isFrozen(dispatched), true);
  assert.equal(Object.hasOwn(dispatched.credential, 'token'), false);
});

test('rejects generic remote, shell, unknown fields, traversal, and invalid runtimes before adapter access', async () => {
  const f = fixture();
  await assert.rejects(() => f.gateway.invoke('remote', { grant: {}, payload: { command: 'rm -rf /' } }), (error) => error.code === 'operation_denied');
  await assert.rejects(() => call(f.gateway, 'readMissionArtifact', { agentId: 'agent-1', path: '../secret' }), /artifact path/);
  await assert.rejects(() => call(f.gateway, 'provisionMissionTeam', { teamName: 'team', agents: [{ agentId: 'a', name: 'A', role: 'builder', runtime: 'shell' }] }), /runtime/);
  await assert.rejects(() => call(f.gateway, 'pauseMission', { reason: 'pause', command: '/remote' }), /fields are invalid/);
  assert.equal(f.calls.some(([name]) => name.startsWith('adapter.')), false);
});

test('grant binds mission, manager, release, team, operation, agent, task, body, expiry, and nonce', async () => {
  const payload = { taskId: 'task-1', agentId: 'agent-1' };
  for (const changed of [
    { missionId: 'mission-2' }, { managerInstanceId: 'manager-2' }, { releaseCommit: '8'.repeat(40) },
    { teamId: 'team-2' }, { operation: 'createMissionTask' }, { agentId: 'agent-2' }, { taskId: 'task-2' },
    { bodyHash: '0'.repeat(64) }, { expiresAt: NOW },
  ]) {
    const f = fixture();
    await assert.rejects(() => f.gateway.assignMissionTask({ payload, grant: grant('assignMissionTask', payload, changed) }));
    assert.equal(f.calls.some(([name]) => name.startsWith('adapter.')), false);
  }
  const replay = fixture();
  const request = { payload, grant: grant('assignMissionTask', payload) };
  await replay.gateway.assignMissionTask(request);
  await assert.rejects(() => replay.gateway.assignMissionTask(request), (error) => error.code === 'grant_replayed');
});

test('cross-mission binding, non-loopback manager, bad signature, quotas, and kill switch fail closed', async () => {
  const payload = {};
  await assert.rejects(() => call(fixture({ binding: { missionId: 'mission-2' } }).gateway, 'readMissionHealth', payload), (error) => error.code === 'binding_mismatch');
  await assert.rejects(() => call(fixture({ binding: { managerBaseUrl: 'http://10.0.0.8:9900' } }).gateway, 'readMissionHealth', payload), (error) => error.code === 'manager_not_loopback');
  await assert.rejects(() => call(fixture({ signatureValid: false }).gateway, 'readMissionHealth', payload), (error) => error.code === 'grant_signature_invalid');
  await assert.rejects(() => call(fixture({ quotaAllowed: false }).gateway, 'readMissionHealth', payload), (error) => error.code === 'quota_exceeded');
  await assert.rejects(() => call(fixture({ killed: true }).gateway, 'readMissionHealth', payload), (error) => error.code === 'gateway_paused');
});

test('typed payload limits cover provision, task, news, output, artifact, pause, and terminate operations', async () => {
  const f = fixture();
  const cases = [
    ['provisionMissionTeam', { teamName: 'mission-team', agents: [{ agentId: 'a1', name: 'Builder', role: 'builder', runtime: 'codex' }] }],
    ['createMissionTask', { taskId: 'task-1', title: 'Build', description: 'Bounded work' }],
    ['readMissionNews', { agentId: 'a1', cursor: null, limit: 20 }],
    ['listMissionOutputs', { agentId: 'a1', limit: 20 }],
    ['readMissionArtifact', { agentId: 'a1', path: 'reports/result.md' }],
    ['pauseMission', { reason: 'custody changed' }],
    ['terminateMission', { reason: 'mission settled' }],
  ];
  for (const [operation, payload] of cases) assert.equal((await call(f.gateway, operation, payload)).ok, true);
  assert.equal(f.calls.filter(([name]) => name.startsWith('adapter.')).length, cases.length);
});
