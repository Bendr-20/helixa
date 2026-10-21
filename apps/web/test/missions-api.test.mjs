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
  assert.equal(calls[0][0], '/multipass-api/api/multipass/missions?state=recruiting&limit=10');
  assert.equal(calls[1][0], '/multipass-api/api/multipass/missions/mission-1/workspace');
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
  assert.equal(url, '/multipass-api/api/loopers/swarm-launch/preview');
  assert.equal(init.method, 'POST');
  assert.equal(init.headers['x-csrf-token'], 'preview-csrf');
  assert.equal(init.headers['if-match'], undefined);
  assert.equal(init.headers['idempotency-key'], undefined);
  assert.deepEqual(JSON.parse(init.body), { members: [], app: {}, token: {} });
});


test('launch consent client uses fixed authenticated proposal routes and CSRF only on writes', async () => {
  const calls = [];
  const api = createMissionApi({ fetchImpl: async (...args) => { calls.push(args); return response({ schema_version: '0.1.0', proposal: { proposalId: 'proposal-1' }, challenge: { message: 'sign' } }); } });
  await api.createLaunchConsent({ csrfToken: 'csrf', body: { members: [] } });
  await api.getLaunchConsent({ proposalId: 'proposal-1' });
  await api.getLaunchConsentChallenge({ proposalId: 'proposal-1', csrfToken: 'csrf' });
  await api.signLaunchConsent({ proposalId: 'proposal-1', csrfToken: 'csrf', signature: '0x' + 'aa'.repeat(65) });
  await api.createLaunchReadiness({ proposalId: 'proposal-1', csrfToken: 'csrf' });
  const executionBody = { beneficiaries: [{ tokenId: '1', beneficiary: '0x1111111111111111111111111111111111111111' }], recipients: { credRewards: '0x2222222222222222222222222222222222222222', swarmTreasury: '0x3333333333333333333333333333333333333333', publicDistribution: '0x4444444444444444444444444444444444444444' }, revenueAssets: ['0x0000000000000000000000000000000000000000'] };
  await api.createLaunchExecutionPreview({ proposalId: 'proposal-1', csrfToken: 'csrf', body: executionBody });
  assert.deepEqual(calls.map(([url]) => url), [
    '/multipass-api/api/loopers/swarm-launch/consents',
    '/multipass-api/api/loopers/swarm-launch/consents/proposal-1',
    '/multipass-api/api/loopers/swarm-launch/consents/proposal-1/challenge',
    '/multipass-api/api/loopers/swarm-launch/consents/proposal-1/sign',
    '/multipass-api/api/loopers/swarm-launch/consents/proposal-1/readiness',
    '/multipass-api/api/loopers/swarm-launch/consents/proposal-1/execution-preview',
  ]);
  assert.equal(calls[0][1].headers['x-csrf-token'], 'csrf');
  assert.equal(calls[1][1].headers['x-csrf-token'], undefined);
  assert.deepEqual(JSON.parse(calls[2][1].body), {});
  assert.deepEqual(JSON.parse(calls[3][1].body), { signature: '0x' + 'aa'.repeat(65) });
  assert.deepEqual(JSON.parse(calls[4][1].body), {});
  assert.equal(calls[4][1].headers['x-csrf-token'], 'csrf');
  assert.deepEqual(JSON.parse(calls[5][1].body), executionBody);
  assert.equal(calls[5][1].headers['x-csrf-token'], 'csrf');
});
