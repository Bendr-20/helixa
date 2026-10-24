import assert from 'node:assert/strict';
import test from 'node:test';

import { deriveReleasedLooperAccount } from '../src/looper-account.js';
import { createMemoryStore, createMultipassApi } from '../src/index.js';

const ORIGIN = 'https://multipass.example.test';
const OWNER = '0x2027af123cc4c3ced6ad389081e532af47b4dd89';
const NEW_OWNER = '0x1111111111111111111111111111111111111111';
const TOKEN_ID = '11';

function emptyStore() {
  return createMemoryStore({ profiles: [], fragments: [], agentCards: [], standardsProfiles: [], x402Manifests: [], receiptFragments: [] });
}

function identity(owner = OWNER) {
  return {
    chainId: 8453,
    contract: '0x1649CD37f4748807b4882FC48765bA0B2aFfa94a',
    tokenId: TOKEN_ID,
    owner,
    erc8004AgentId: '86180',
    controllerVerified: true,
  };
}

function createApi({ service, verifier = { verify: async ({ wallet }) => identity(wallet) }, allowedOrigins = [ORIGIN] } = {}) {
  return createMultipassApi({
    store: emptyStore(),
    baseUrl: ORIGIN,
    allowedOrigins,
    signatureVerifier: async () => true,
    loopersAuthorizer: async () => { throw new Error('generic authorizer must not be used'); },
    credifiOwnerOptInVerifier: verifier,
    credifiOwnerOptInService: service,
  });
}

async function request(api, path, { method = 'GET', body, rawBody, headers = {}, origin = ORIGIN } = {}) {
  const requestHeaders = { ...headers };
  if (origin !== null) requestHeaders.origin = origin;
  if (body !== undefined || rawBody !== undefined) requestHeaders['content-type'] = 'application/json';
  const response = await api.handleRequest(new Request(ORIGIN + path, {
    method,
    headers: requestHeaders,
    ...(body === undefined && rawBody === undefined ? {} : { body: rawBody ?? JSON.stringify(body) }),
  }));
  return { response, body: await response.json() };
}

async function consoleSession(api, wallet = OWNER) {
  const nonce = await request(api, '/api/multipass/console/session/nonce', { method: 'POST', body: { wallet } });
  assert.equal(nonce.response.status, 200);
  const verified = await request(api, '/api/multipass/console/session/verify', {
    method: 'POST', body: { wallet, nonce: nonce.body.nonce, signature: '0x1234' },
  });
  assert.equal(verified.response.status, 200);
  const cookie = verified.response.headers.get('set-cookie').split(';')[0];
  return { cookie, csrf: verified.body.csrfToken, headers: { cookie, 'x-csrf-token': verified.body.csrfToken } };
}

test('Credifi pilot GET accepts explicit Origin or browser same-origin Referer metadata and returns no-store', async () => {
  const api = createApi({ service: { getStatus: () => ({ tokenId: TOKEN_ID, eligible: true, optedIn: false, cohortVersion: 'cohort-v1', amountUsd: '50.00', canonicalAccount: deriveReleasedLooperAccount(TOKEN_ID) }) } });
  const noSession = await request(api, '/api/multipass/console/credifi-pilot/opt-in?tokenId=11');
  assert.equal(noSession.response.status, 401);
  const session = await consoleSession(api);
  const browserGet = await request(api, '/api/multipass/console/credifi-pilot/opt-in?tokenId=11', {
    headers: { cookie: session.cookie, referer: ORIGIN + '/multipass/agents', 'sec-fetch-site': 'same-origin' }, origin: null,
  });
  assert.equal(browserGet.response.status, 200);
  const noOrigin = await request(api, '/api/multipass/console/credifi-pilot/opt-in?tokenId=11', { headers: { cookie: session.cookie }, origin: null });
  assert.equal(noOrigin.response.status, 403);
  assert.equal(noOrigin.response.headers.get('cache-control'), 'no-store');
  const refererWithoutFetchMetadata = await request(api, '/api/multipass/console/credifi-pilot/opt-in?tokenId=11', { headers: { cookie: session.cookie, referer: ORIGIN + '/multipass/agents' }, origin: null });
  assert.equal(refererWithoutFetchMetadata.response.status, 403);
  const otherAllowedApi = createApi({ service: { getStatus: () => ({ tokenId: TOKEN_ID, eligible: true, optedIn: false, cohortVersion: 'cohort-v1', amountUsd: '50.00', canonicalAccount: deriveReleasedLooperAccount(TOKEN_ID) }) }, allowedOrigins: [ORIGIN, 'https://other.example.test'] });
  const otherSession = await consoleSession(otherAllowedApi);
  const crossOriginReferer = await request(otherAllowedApi, '/api/multipass/console/credifi-pilot/opt-in?tokenId=11', { headers: { cookie: otherSession.cookie, referer: 'https://other.example.test/page', 'sec-fetch-site': 'same-origin' }, origin: null });
  assert.equal(crossOriginReferer.response.status, 403);
  const wrongOrigin = await request(api, '/api/multipass/console/credifi-pilot/opt-in?tokenId=11', { headers: { cookie: session.cookie }, origin: 'https://evil.example' });
  assert.equal(wrongOrigin.response.status, 403);
  const result = await request(api, '/api/multipass/console/credifi-pilot/opt-in?tokenId=11', { headers: { cookie: session.cookie } });
  assert.equal(result.response.status, 200);
  assert.equal(result.response.headers.get('cache-control'), 'no-store');
  assert.equal(result.body.status, 'eligible');
});

test('Credifi pilot POST requires CSRF and an exact consent-only schema', async () => {
  let writes = 0;
  const api = createApi({ service: { optIn: () => { writes += 1; return { tokenId: TOKEN_ID, eligible: true, optedIn: true, created: true, cohortVersion: 'cohort-v1', amountUsd: '50.00', canonicalAccount: deriveReleasedLooperAccount(TOKEN_ID), consentedAt: '2026-10-24T02:00:00.000Z' }; } } });
  const session = await consoleSession(api);
  const missingCsrf = await request(api, '/api/multipass/console/credifi-pilot/opt-in', { method: 'POST', body: { tokenId: TOKEN_ID, consent: true }, headers: { cookie: session.cookie } });
  assert.equal(missingCsrf.response.status, 403);
  const extra = await request(api, '/api/multipass/console/credifi-pilot/opt-in', { method: 'POST', body: { tokenId: TOKEN_ID, consent: true, acceptVouch: true }, headers: session.headers });
  assert.equal(extra.response.status, 400);
  const falseConsent = await request(api, '/api/multipass/console/credifi-pilot/opt-in', { method: 'POST', body: { tokenId: TOKEN_ID, consent: false }, headers: session.headers });
  assert.equal(falseConsent.response.status, 400);
  assert.equal(writes, 0);
  const result = await request(api, '/api/multipass/console/credifi-pilot/opt-in', { method: 'POST', body: { tokenId: TOKEN_ID, consent: true }, headers: session.headers });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.status, 'opted_in');
  assert.equal(writes, 1);
});

test('Credifi pilot route reverifies current owner authority and fails closed on mismatch', async () => {
  let serviceCalled = false;
  const api = createApi({
    service: { getStatus: () => { serviceCalled = true; return {}; } },
    verifier: { verify: async () => ({ ...identity(), owner: NEW_OWNER }) },
  });
  const session = await consoleSession(api);
  const result = await request(api, '/api/multipass/console/credifi-pilot/opt-in?tokenId=11', { headers: { cookie: session.cookie } });
  assert.equal(result.response.status, 403);
  assert.equal(serviceCalled, false);
});

test('Credifi pilot responses are allowlisted and redact internal service fields', async () => {
  const api = createApi({ service: { getStatus: () => ({
    tokenId: TOKEN_ID,
    eligible: true,
    optedIn: true,
    cohortVersion: 'cohort-v1',
    amountUsd: '50.00',
    canonicalAccount: deriveReleasedLooperAccount(TOKEN_ID),
    consentedAt: '2026-10-24T02:00:00.000Z',
    ownerWallet: OWNER,
    sessionKey: 'secret-session',
    providerToken: 'secret-provider-token',
  }) } });
  const session = await consoleSession(api);
  const result = await request(api, '/api/multipass/console/credifi-pilot/opt-in?tokenId=11', { headers: { cookie: session.cookie } });
  assert.equal(result.response.status, 200);
  assert.deepEqual(Object.keys(result.body).sort(), ['account', 'amount_usd', 'cohort_version', 'consented_at', 'eligible', 'schema_version', 'status', 'token_id']);
  assert.equal(JSON.stringify(result.body).includes('secret'), false);
});


test('Credifi pilot POST rejects non-canonical token IDs and duplicate JSON keys with Credifi schema errors', async () => {
  let calls = 0;
  const api = createApi({ service: { optIn: () => { calls += 1; return {}; } } });
  const session = await consoleSession(api);
  for (const rawBody of [
    '{"tokenId":11,"consent":true}',
    '{"tokenId":"+11","consent":true}',
    '{"tokenId":"11","tokenId":"19","consent":true}',
    '{"tokenId":"11","consent":true,"consent":true}',
  ]) {
    const result = await request(api, '/api/multipass/console/credifi-pilot/opt-in', { method: 'POST', rawBody, headers: session.headers });
    assert.equal(result.response.status, 400);
    assert.match(result.body.error.code, /^credifi_opt_in_/);
    assert.equal(result.response.headers.get('cache-control'), 'no-store');
  }
  assert.equal(calls, 0);
});

test('every Credifi route error is no-store, including eligibility and unexpected server failures', async () => {
  const sessionApi = createApi({ service: { getStatus: () => { throw new Error('boom'); } } });
  const session = await consoleSession(sessionApi);
  const failures = [
    await request(sessionApi, '/api/multipass/console/credifi-pilot/opt-in?tokenId=11'),
    await request(sessionApi, '/api/multipass/console/credifi-pilot/opt-in?tokenId=+11', { headers: { cookie: session.cookie } }),
    await request(sessionApi, '/api/multipass/console/credifi-pilot/opt-in?tokenId=11', { headers: { cookie: session.cookie } }),
  ];
  assert.deepEqual(failures.map(({ response }) => response.status), [401, 400, 500]);
  assert.equal(failures.every(({ response }) => response.headers.get('cache-control') === 'no-store'), true);

  const eligibilityApi = createApi({
    service: { getStatus: () => ({}) },
    verifier: { verify: async () => { const error = new Error('not eligible'); error.code = 'credifi_pilot_not_eligible'; error.status = 403; throw error; } },
  });
  const eligibilitySession = await consoleSession(eligibilityApi);
  const eligibility = await request(eligibilityApi, '/api/multipass/console/credifi-pilot/opt-in?tokenId=11', { headers: { cookie: eligibilitySession.cookie } });
  assert.equal(eligibility.response.status, 403);
  assert.equal(eligibility.response.headers.get('cache-control'), 'no-store');
});
