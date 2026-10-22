import assert from 'node:assert/strict';
import test from 'node:test';

import { ConsoleCreditError } from '../src/console-credit.js';
import { createMemoryStore, createMultipassApi } from '../src/index.js';

const ORIGIN = 'https://multipass.example.test';
const OWNER = '0xd31fcdb0432d3c9bf9d98643f69c7edd690e48e8';
const IDENTITY = Object.freeze({
  chainId: 8453,
  contract: '0x1649CD37f4748807b4882FC48765bA0B2aFfa94a',
  tokenId: '2431',
  owner: OWNER,
  erc8004AgentId: '89144',
  controllerVerified: true,
});

function emptyStore() {
  return createMemoryStore({ profiles: [], fragments: [], agentCards: [], standardsProfiles: [], x402Manifests: [], receiptFragments: [] });
}

function createApi(consoleCreditService) {
  return createMultipassApi({
    store: emptyStore(),
    baseUrl: ORIGIN,
    allowedOrigins: [ORIGIN],
    signatureVerifier: async () => true,
    loopersAuthorizer: async ({ tokenId, wallet }) => {
      assert.equal(tokenId, '2431');
      assert.equal(wallet, OWNER);
      return IDENTITY;
    },
    consoleCreditService,
  });
}

async function post(api, path, body, headers = {}) {
  const response = await api.handleRequest(new Request(ORIGIN + path, {
    method: 'POST',
    headers: { origin: ORIGIN, 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  }));
  return { response, body: await response.json() };
}

async function consoleSession(api) {
  const nonce = await post(api, '/api/multipass/console/session/nonce', { wallet: OWNER });
  assert.equal(nonce.response.status, 200);
  const verified = await post(api, '/api/multipass/console/session/verify', { wallet: OWNER, nonce: nonce.body.nonce, signature: '0x1234' });
  assert.equal(verified.response.status, 200);
  return {
    cookie: verified.response.headers.get('set-cookie').split(';')[0],
    csrf: verified.body.csrfToken,
    headers: { cookie: verified.response.headers.get('set-cookie').split(';')[0], 'x-csrf-token': verified.body.csrfToken },
  };
}

test('credit routes require a Console session, CSRF, and exact request schemas', async () => {
  let called = 0;
  const api = createApi({ async requestLoginChallenge() { called += 1; return { schema_version: '0.1.0', account: '0xee37097c267ceb22b553e0e947d19c5ce4ba696c' }; } });
  const missingSession = await post(api, '/api/multipass/console/credit/challenge', { tokenId: '2431' });
  assert.equal(missingSession.response.status, 401);
  const session = await consoleSession(api);
  const missingCsrf = await post(api, '/api/multipass/console/credit/challenge', { tokenId: '2431' }, { cookie: session.cookie });
  assert.equal(missingCsrf.response.status, 403);
  const unknown = await post(api, '/api/multipass/console/credit/challenge', { tokenId: '2431', hidden: true }, session.headers);
  assert.equal(unknown.response.status, 400);
  assert.equal(unknown.body.error.code, 'invalid_credit_request');
  assert.equal(called, 0);
});

test('credit routes bind the current owner identity and opaque Console session key', async () => {
  const calls = [];
  const api = createApi({
    async requestLoginChallenge(input) { calls.push(input); return { schema_version: '0.1.0', account: '0xee37097c267ceb22b553e0e947d19c5ce4ba696c', message: 'Sign challenge' }; },
  });
  const session = await consoleSession(api);
  const result = await post(api, '/api/multipass/console/credit/challenge', { tokenId: '2431' }, session.headers);
  assert.equal(result.response.status, 200);
  assert.equal(result.body.message, 'Sign challenge');
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].identity, IDENTITY);
  assert.match(calls[0].sessionKey, /^[a-f0-9]{64}$/u);
  assert.equal(JSON.stringify(result.body).includes(calls[0].sessionKey), false);
});

test('all credit actions dispatch only their reviewed fields', async () => {
  const calls = [];
  const service = {
    requestLoginChallenge: async input => (calls.push(['challenge', input]), { ok: true }),
    verifyLogin: async input => (calls.push(['verify', input]), { ok: true }),
    getOverview: async input => (calls.push(['overview', input]), { ok: true }),
    acceptVouch: async input => (calls.push(['accept', input]), { ok: true }),
    prepareAuthorization: async input => (calls.push(['authorization', input]), { ok: true }),
    requestTwoFactor: async input => (calls.push(['request2fa', input]), { ok: true }),
    verifyTwoFactor: async input => (calls.push(['verify2fa', input]), { ok: true }),
    previewLoan: async input => (calls.push(['preview', input]), { ok: true }),
    createLoan: async input => (calls.push(['borrow', input]), { ok: true }),
  };
  const api = createApi(service);
  const session = await consoleSession(api);
  const requests = [
    ['challenge', { tokenId: '2431' }],
    ['verify', { tokenId: '2431', signature: '0x1234' }],
    ['overview', { tokenId: '2431' }],
    ['accept-vouch', { tokenId: '2431', commitmentId: 'vouch-1' }],
    ['prepare-authorization', { tokenId: '2431', commitmentId: 'vouch-1' }],
    ['request-two-factor', { tokenId: '2431', channel: 'email' }],
    ['verify-two-factor', { tokenId: '2431', code: '123456' }],
    ['preview', { tokenId: '2431', commitmentId: 'vouch-1', amount: 5, maxAprPercent: 25 }],
    ['borrow', { tokenId: '2431', commitmentId: 'vouch-1', quoteId: 'quote-1', quoteSha256: 'a'.repeat(64), confirmBorrow: true }],
  ];
  for (const [action, body] of requests) {
    const result = await post(api, '/api/multipass/console/credit/' + action, body, session.headers);
    assert.equal(result.response.status, 200, action);
  }
  assert.deepEqual(calls.map(([name]) => name), ['challenge', 'verify', 'overview', 'accept', 'authorization', 'request2fa', 'verify2fa', 'preview', 'borrow']);
  assert.ok(calls.every(([, input]) => input.identity === IDENTITY));
  assert.equal(calls.find(([name]) => name === 'borrow')[1].confirmBorrow, true);
});

test('credit provider errors remain stable and do not leak internal details', async () => {
  const api = createApi({
    async getOverview() { throw new ConsoleCreditError('cred_gate_failed', 'CRED is below the private-beta floor.', { status: 403, details: { score: 39, minimumScore: 40 } }); },
  });
  const session = await consoleSession(api);
  const result = await post(api, '/api/multipass/console/credit/overview', { tokenId: '2431' }, session.headers);
  assert.equal(result.response.status, 403);
  assert.deepEqual(result.body.error, { code: 'cred_gate_failed', message: 'CRED is below the private-beta floor.', details: { score: 39, minimumScore: 40 } });
});
