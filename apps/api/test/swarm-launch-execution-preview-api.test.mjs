import assert from 'node:assert/strict';
import test from 'node:test';

import { createMemoryStore, createMultipassApi } from '../src/index.js';

const WALLET = '0x27e3286c2c1783f67d06f2ff4e3ab41f8e1c91ea';
const BODY = {
  beneficiaries: [
    { tokenId: '1', beneficiary: '0x1111111111111111111111111111111111111111' },
    { tokenId: '2', beneficiary: '0x2222222222222222222222222222222222222222' },
    { tokenId: '3', beneficiary: '0x3333333333333333333333333333333333333333' },
  ],
  recipients: { credRewards: '0x4444444444444444444444444444444444444444', swarmTreasury: '0x5555555555555555555555555555555555555555', publicDistribution: '0x6666666666666666666666666666666666666666' },
  revenueAssets: ['0x0000000000000000000000000000000000000000'],
};
const URL = 'https://helixa.test/api/loopers/swarm-launch/consents/proposal-1/execution-preview';

function fixture() {
  const calls = [];
  const service = {
    async createExecutionPreview(value) { calls.push(value); return { packet: { execution: { mode: 'PREPARATION_ONLY', deploymentAuthorized: false, broadcastPrepared: false, transactionCount: 0 }, authorization: { status: 'NOT_ATTACHED' } }, packetSha256: '0x' + 'c'.repeat(64) }; },
  };
  const api = createMultipassApi({
    store: createMemoryStore(), swarmLaunchConsentService: service,
    consoleAuthStore: { validateSession({ csrfToken, requireCsrf }) { assert.equal(requireCsrf, true); if (csrfToken !== 'csrf') throw new Error('bad csrf'); return { wallet: WALLET }; } },
  });
  return { api, calls };
}

function request(body = BODY, headers = {}) { return new Request(URL, { method: 'POST', headers: { cookie: 'multipass_console=session', 'content-type': 'application/json', 'x-csrf-token': 'csrf', ...headers }, body: JSON.stringify(body) }); }

test('protected execution preview route forwards only the closed review input and returns no-store', async () => {
  const f = fixture();
  const response = await f.api.handleRequest(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const json = await response.json();
  assert.equal(json.executionPreview.packet.execution.transactionCount, 0);
  assert.equal(json.executionPreview.packetSha256, '0x' + 'c'.repeat(64));
  assert.deepEqual(f.calls, [{ actorAddress: WALLET, proposalId: 'proposal-1', input: BODY }]);
});

test('execution preview route requires Console auth and CSRF and rejects unknown browser-controlled fields', async () => {
  const f = fixture();
  const noAuth = await f.api.handleRequest(new Request(URL, { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': 'csrf' }, body: JSON.stringify(BODY) }));
  const noCsrf = await f.api.handleRequest(request(BODY, { 'x-csrf-token': '' }));
  const hidden = await f.api.handleRequest(request({ ...BODY, factoryAddress: '0x9999999999999999999999999999999999999999' }));
  assert.deepEqual([noAuth.status, noCsrf.status, hidden.status], [401, 403, 400]);
  assert.equal(f.calls.length, 0);
});
