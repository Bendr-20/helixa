import assert from 'node:assert/strict';
import test from 'node:test';

import { createMemoryStore, createMultipassApi } from '../src/index.js';

const BASE = 'https://multipass.example.test';
const WALLET = '0x1111111111111111111111111111111111111111';
const SESSION = 'multipass_console=mission-session';
const CSRF = 'mission-csrf';
const HASH = 'a'.repeat(64);

function fixture() {
  const calls = [];
  const methods = [
    'listPublicMissions', 'getPublicMission', 'createMission', 'updateMission', 'publishMission', 'cancelMission',
    'applyToMission', 'withdrawApplication', 'selectTeam', 'readLaunchTerms', 'signLaunchTerms', 'publishLaunchManifest', 'prepareVault', 'retryLaunch',
    'refundLaunch', 'fundMission', 'reconcileMission', 'readWorkspace', 'createTask', 'assignTask', 'updateTask',
    'submitArtifact', 'approveMilestone', 'releaseMilestone', 'openDispute', 'prepareArbitration', 'readDispute',
  ];
  const missionService = Object.fromEntries(methods.map((name) => [name, async (input) => {
    calls.push([name, input]);
    if (name === 'listPublicMissions') return { missions: [], nextCursor: null };
    if (name === 'getPublicMission') return { missionId: input.missionId, state: 'recruiting' };
    return { missionId: input.missionId ?? 'mission-new', revision: (input.expectedRevision ?? -1) + 1, action: name };
  }]));
  const api = createMultipassApi({
    store: createMemoryStore(), baseUrl: BASE, allowedOrigins: [BASE], missionService,
    loopersOwnedAgentLoader: async () => [], loopersAuthorizer: async () => ({}),
    consoleAuthStore: { validateSession({ sessionId, csrfToken, requireCsrf }) {
      if (sessionId !== 'mission-session') throw new Error('bad session');
      if (requireCsrf && csrfToken !== CSRF) throw new Error('bad csrf');
      return { wallet: WALLET };
    } },
  });
  return { api, calls };
}


async function request(api, path, { method = 'GET', body, origin = BASE, cookie = SESSION, csrf = CSRF, revision = '2', idempotency = 'idem-12345678', bytes } = {}) {
  const headers = {};
  if (origin !== null) headers.origin = origin;
  if (cookie !== null) headers.cookie = cookie;
  if (csrf !== null) headers['x-csrf-token'] = csrf;
  if (revision !== null) headers['if-match'] = revision;
  if (idempotency !== null) headers['idempotency-key'] = idempotency;
  if (body !== undefined || bytes !== undefined) headers['content-type'] = 'application/json';
  const response = await api.handleRequest(new Request(BASE + path, { method, headers, body: bytes ?? (body === undefined ? undefined : JSON.stringify(body)) }));
  return { response, body: await response.json() };
}

const bodies = {
  createMission: { mission_id: 'mission-new', refund_address: WALLET, public_summary: 'New mission', public_document: {}, private_document: {}, private_spec_hash: HASH, terms_hash: HASH, commitment_hash: HASH },
  updateMission: { patch: { publicSummary: 'x' }, public_document: {}, private_document: {}, commitment_hash: HASH },
  publishMission: { application_closes_at: 1000, public_document: {}, private_document: {}, commitment_hash: HASH },
  cancelMission: { public_document: {}, private_document: {}, commitment_hash: HASH },
  applyToMission: { application: { proposedRole: 'builder' } }, withdrawApplication: {},
  selectTeam: { selection: { members: [] } }, signLaunchTerms: { signature: '0xsigned' },
  publishLaunchManifest: { manifest: { termsHash: HASH } }, prepareVault: { vault: { versionId: HASH } },
  retryLaunch: { launch: { operationId: 'launch-1' } }, refundLaunch: { refund: {} },
  fundMission: { funding: { amountRaw: '1' } }, reconcileMission: { transaction: { hash: '0xabc' } },
  createTask: { task: { title: 'Do it' } }, assignTask: { assignment: { memberId: 'member-1' } },
  updateTask: { patch: { status: 'doing' } }, submitArtifact: { artifact: { contentHash: HASH } },
  approveMilestone: { approval: { artifactHash: HASH } }, releaseMilestone: { release: {} },
  openDispute: { dispute: { evidenceHash: HASH } }, prepareArbitration: { resolution: { evidenceHash: HASH } },
};

const writes = [
  ['POST', '/api/multipass/missions', 'createMission'],
  ['PATCH', '/api/multipass/missions/mission-1', 'updateMission'],
  ['POST', '/api/multipass/missions/mission-1/publish', 'publishMission'],
  ['POST', '/api/multipass/missions/mission-1/cancel', 'cancelMission'],
  ['POST', '/api/multipass/missions/mission-1/applications', 'applyToMission'],
  ['POST', '/api/multipass/missions/mission-1/applications/app-1/withdraw', 'withdrawApplication'],
  ['POST', '/api/multipass/missions/mission-1/team', 'selectTeam'],
  ['POST', '/api/multipass/missions/mission-1/launch/terms/sign', 'signLaunchTerms'],
  ['POST', '/api/multipass/missions/mission-1/launch/manifest', 'publishLaunchManifest'],
  ['POST', '/api/multipass/missions/mission-1/vault/prepare', 'prepareVault'],
  ['POST', '/api/multipass/missions/mission-1/launch/retry', 'retryLaunch'],
  ['POST', '/api/multipass/missions/mission-1/launch/refund', 'refundLaunch'],
  ['POST', '/api/multipass/missions/mission-1/fund', 'fundMission'],
  ['POST', '/api/multipass/missions/mission-1/reconcile', 'reconcileMission'],
  ['POST', '/api/multipass/missions/mission-1/workspace/tasks', 'createTask'],
  ['POST', '/api/multipass/missions/mission-1/workspace/tasks/task-1/assign', 'assignTask'],
  ['PATCH', '/api/multipass/missions/mission-1/workspace/tasks/task-1', 'updateTask'],
  ['POST', '/api/multipass/missions/mission-1/workspace/artifacts', 'submitArtifact'],
  ['POST', '/api/multipass/missions/mission-1/milestones/mile-1/approve', 'approveMilestone'],
  ['POST', '/api/multipass/missions/mission-1/milestones/mile-1/release', 'releaseMilestone'],
  ['POST', '/api/multipass/missions/mission-1/milestones/mile-1/disputes', 'openDispute'],
  ['POST', '/api/multipass/missions/mission-1/milestones/mile-1/disputes/disp-1/arbitrate', 'prepareArbitration'],
];

test('public list/detail and authenticated reads route to the mission service', async () => {
  const f = fixture();
  assert.equal((await request(f.api, '/api/multipass/missions?state=recruiting&limit=10', { origin: null, cookie: null, csrf: null, revision: null, idempotency: null })).response.status, 200);
  assert.equal((await request(f.api, '/api/multipass/missions/mission-1', { origin: null, cookie: null, csrf: null, revision: null, idempotency: null })).response.status, 200);
  assert.equal((await request(f.api, '/api/multipass/missions/mission-1/launch/terms', { revision: null, idempotency: null })).response.status, 200);
  assert.equal((await request(f.api, '/api/multipass/missions/mission-1/workspace', { revision: null, idempotency: null })).response.status, 200);
  assert.equal((await request(f.api, '/api/multipass/missions/mission-1/milestones/mile-1/disputes/disp-1', { revision: null, idempotency: null })).response.status, 200);
  assert.deepEqual(f.calls.map(([name]) => name), ['listPublicMissions', 'getPublicMission', 'readLaunchTerms', 'readWorkspace', 'readDispute']);
});

test('all mission writes enforce headers and dispatch exact normalized command metadata', async () => {
  const f = fixture();
  for (const [method, path, name] of writes) {
    const result = await request(f.api, path, { method, body: bodies[name] });
    assert.ok([200, 201, 202].includes(result.response.status), name + ': ' + JSON.stringify(result.body));
  }
  assert.deepEqual(f.calls.map(([name]) => name), writes.map(([, , name]) => name));
  for (const [, input] of f.calls) {
    assert.equal(input.actorAddress, WALLET);
    assert.equal(input.expectedRevision, 2);
    assert.equal(input.idempotencyKey, 'idem-12345678');
  }
});

test('writes enforce Origin, session, CSRF, revision, idempotency, exact JSON keys, and body caps', async () => {
  const route = writes[2];
  const [method, path, name] = route;
  const f = fixture();
  const variants = [
    [{ origin: 'https://evil.test' }, 403], [{ cookie: null }, 401], [{ csrf: null }, 403],
    [{ revision: null }, 428], [{ revision: 'nope' }, 400], [{ revision: '"2' }, 400], [{ revision: 'W/2' }, 400], [{ idempotency: null }, 428],
    [{ idempotency: 'tiny' }, 400], [{ body: { ...bodies[name], extra: true } }, 400],
    [{ bytes: new TextEncoder().encode(JSON.stringify({ x: 'y'.repeat(33_000) })) }, 413],
  ];
  for (const [options, status] of variants) {
    const result = await request(f.api, path, { method, body: bodies[name], ...options });
    assert.equal(result.response.status, status, JSON.stringify(options) + ': ' + JSON.stringify(result.body));
  }
  assert.equal(f.calls.length, 0);
});

test('unknown mission routes and unsupported methods fail closed', async () => {
  const f = fixture();
  assert.equal((await request(f.api, '/api/multipass/missions/mission-1/secrets', { revision: null, idempotency: null })).response.status, 404);
  assert.equal((await request(f.api, '/api/multipass/missions/mission-1', { method: 'DELETE', body: {}, revision: null, idempotency: null })).response.status, 405);
});
