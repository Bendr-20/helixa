import assert from 'node:assert/strict';
import test from 'node:test';

import { createMissionApi } from '../src/missions/api.js';

function response(payload = { schema_version: '0.1.0', result: { missionId: 'mission-1' } }, status = 200) { return { ok: status >= 200 && status < 300, status, async json() { return payload; } }; }

test('writes exact revision, idempotency, CSRF, cookie, and raw integer amount data', async () => {
  const calls = [];
  const api = createMissionApi({ apiBase: 'https://example.test/', fetchImpl: async (...args) => { calls.push(args); return response(); } });
  await api.fund({ missionId: 'mission-1', expectedRevision: 7, idempotencyKey: 'fund-12345678', csrfToken: 'csrf', body: { funding: { amountRaw: '1000000' } } });
  const [url, init] = calls[0];
  assert.equal(url, 'https://example.test/api/multipass/missions/mission-1/fund');
  assert.equal(init.credentials, 'include');
  assert.equal(init.headers['if-match'], '7');
  assert.equal(init.headers['idempotency-key'], 'fund-12345678');
  assert.equal(init.headers['x-csrf-token'], 'csrf');
  assert.equal(JSON.parse(init.body).funding.amountRaw, '1000000');
  await assert.rejects(() => api.fund({ missionId: 'mission-1', expectedRevision: 7, idempotencyKey: 'fund-12345678', csrfToken: 'csrf', body: { funding: { amountRaw: 1000000 } } }), /decimal strings/);
});

test('uses fixed public/authenticated routes and never accepts ad-hoc route construction', async () => {
  const calls = [];
  const api = createMissionApi({ fetchImpl: async (...args) => { calls.push(args); return response({ schema_version: '0.1.0', mission: { missionId: 'mission-1' } }); } });
  await api.listPublic({ state: 'recruiting', limit: 10 });
  await api.getWorkspace({ missionId: 'mission-1' });
  assert.equal(calls[0][0], '/api/multipass/missions?state=recruiting&limit=10');
  assert.equal(calls[1][0], '/api/multipass/missions/mission-1/workspace');
  assert.equal(Object.hasOwn(api, 'request'), false);
  assert.equal(Object.hasOwn(api, 'remote'), false);
});

test('rejects stale/error responses and internal identifier leakage', async () => {
  const conflict = createMissionApi({ fetchImpl: async () => response({ error: { code: 'mission_conflict' } }, 409) });
  await assert.rejects(() => conflict.getPublic({ missionId: 'mission-1' }), (error) => error.status === 409 && error.code === 'mission_conflict');
  const leak = createMissionApi({ fetchImpl: async () => response({ schema_version: '0.1.0', workspace: { manager_location: '127.0.0.1' } }) });
  await assert.rejects(() => leak.getWorkspace({ missionId: 'mission-1' }), /internal field/);
});


test('launch preview uses the fixed authenticated CSRF route without mutation replay headers', async () => {
  const calls = [];
  const api = createMissionApi({ fetchImpl: async (...args) => { calls.push(args); return response({ schema_version: '0.1.0', status: 'PREPARATION_ONLY', manifest: {}, manifest_sha256: '0x' + 'a'.repeat(64) }); } });
  await api.previewSwarmLaunch({ csrfToken: 'preview-csrf', body: { members: [], app: {}, token: {} } });
  const [url, init] = calls[0];
  assert.equal(url, '/api/loopers/swarm-launch/preview');
  assert.equal(init.method, 'POST');
  assert.equal(init.headers['x-csrf-token'], 'preview-csrf');
  assert.equal(init.headers['if-match'], undefined);
  assert.equal(init.headers['idempotency-key'], undefined);
  assert.deepEqual(JSON.parse(init.body), { members: [], app: {}, token: {} });
});
