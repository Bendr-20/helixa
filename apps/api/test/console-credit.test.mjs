import assert from 'node:assert/strict';
import test from 'node:test';

import { decodeFunctionData, encodeFunctionData } from 'viem';

import { createConsoleCreditService } from '../src/console-credit.js';

const ACCOUNT = '0xee37097c267ceb22b553e0e947d19c5ce4ba696c';
const OWNER = '0xd31fcdb0432d3c9bf9d98643f69c7edd690e48e8';
const COLLECTION = '0x1649cd37f4748807b4882fc48765ba0b2affa94a';
const EVC = '0x1111111111111111111111111111111111111111';
const ADAPTOR = '0x2222222222222222222222222222222222222222';
const USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const MAX_UINT256 = (1n << 256n) - 1n;
const EXECUTE_ABI = [{ type: 'function', name: 'execute', stateMutability: 'payable', inputs: [{ name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'data', type: 'bytes' }, { name: 'operation', type: 'uint8' }], outputs: [{ name: 'result', type: 'bytes' }] }];
const EVC_ABI = [{ type: 'function', name: 'setOperator', stateMutability: 'nonpayable', inputs: [{ name: 'accountPrefix', type: 'bytes19' }, { name: 'operator', type: 'address' }, { name: 'operatorBitField', type: 'uint256' }], outputs: [] }];
const TXN_DATA = encodeFunctionData({ abi: EVC_ABI, functionName: 'setOperator', args: [ACCOUNT.slice(0, 40), ADAPTOR, MAX_UINT256] });

function identity() {
  return { chainId: 8453, contract: COLLECTION, tokenId: '2431', owner: OWNER, erc8004AgentId: '89144', controllerVerified: true };
}

function cred(score = 42) {
  return {
    schemaVersion: 'cred-looper-live-v1',
    identity: { chainId: '8453', collection: COLLECTION, looperTokenId: '2431', account: ACCOUNT, erc8004IdentityId: '89144' },
    ratingStatus: 'PROVISIONAL', score, tier: score >= 51 ? 'Qualified' : 'Marginal', methodologyId: 'cred-looper-provisional-1.0.0',
    computedAt: '2026-10-21T21:15:10.507Z', validUntil: '2026-10-21T23:15:10.507Z', freshness: 'FRESH',
  };
}

function flags({ authorized = false } = {}) {
  return {
    minimumLoanAmount: 5, loanTwoFactorRequired: false, loanTwoFactorAvailableChannels: [], smartWallet: { status: 'approved' }, blockBorrowReason: null,
    evcAuthorizations: { '8453-vault-12': authorized ? { isAuthorized: true } : { isAuthorized: false, txnData: { to: EVC, data: TXN_DATA, value: '0' } } },
  };
}

function vouch(status = 'offered') {
  return { id: 'vouch-1', status, sponsorWalletAddress: '0x3333333333333333333333333333333333333333', borrowerWalletAddress: ACCOUNT, amountMicro: 5_000_000, reservedMicro: 5_000_000, remainingMicro: 5_000_000, chainId: 8453, marketId: 'base-usdc-2500:stable-12' };
}

function market() {
  return { chainId: 8453, marketId: 'base-usdc-2500:stable-12', vaultId: 'vault-12', userAccessible: true, acceptsNewBorrowers: true, availableLiquidity: '5000000' };
}

function quote() {
  return { quoteId: 'quote-1', quoteExpiresAt: '2026-10-21T22:45:00.000Z', fee: { feeMicro: 0, principalMicro: 5_000_000, netProceedsMicro: 5_000_000 }, loan: { amount: 5, interestRate: 15, totalRepayment: 5.01, loanTerms: { termDays: 30, repaymentType: 'bullet' } }, paymentSchedule: [{ dueDate: '2026-11-20T22:30:00.000Z', amount: 5.01 }], scheduleInfo: { installments: 1 } };
}

function routeKey(method, url) { const parsed = new URL(url); return `${method} ${parsed.pathname}${parsed.search}`; }

function loginMessage(account = ACCOUNT) {
  return `Sign in to Credifi\n\nSigning Wallet: ${account}\nDomain: credi.fi\nChain ID: 8453\nNonce: ${'a'.repeat(64)}\nTimestamp: 2026-10-21T22:30:00.000Z`;
}

function createFetchFixture({ score = 42, authorization = false, challengeMessage = loginMessage(), authorizationData = TXN_DATA, assetAddress = USDC, quotePayload = quote(), createLoanImpl, vouchActionImpl, failFlags = false } = {}) {
  const calls = [];
  let commitmentStatus = 'offered';
  const fetchImpl = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const key = routeKey(method, url);
    const headers = Object.fromEntries(new Headers(init.headers).entries());
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ key, headers, body });
    if (new URL(url).origin === 'https://helixa.xyz') return json(cred(score));
    if (key.startsWith('GET /api/auth/wallet-login?')) return json({ message: challengeMessage });
    if (key === 'POST /api/auth/wallet-login') return json({ token: 'secret-bearer-token', user: { id: 'user-1' } });
    assert.equal(headers.authorization, 'Bearer secret-bearer-token');
    if (key === 'GET /api/v3/user/flags?includeEvcAuthorizations=true') { if (failFlags) return json({ code: 'INTERNAL_SECRET', error: { message: 'Bearer secret-bearer-token internal diagnostics' }, details: { authorization: headers.authorization } }, 500); const value = flags({ authorized: authorization }); if (!authorization) value.evcAuthorizations['8453-vault-12'].txnData.data = authorizationData; return json(value); }
    if (key === 'GET /api/vouch/status') return json({ enabled: true, earnedMicro: 0, commitments: [vouch(commitmentStatus)] });
    if (key === 'GET /api/v2/markets/list') return json({ markets: [market()] });
    if (key === 'GET /api/v2/user-balance') return json({ credit: { availableCredit: 5_000_000, totalCreditLimit: 5_000_000, currentUsage: 0 } });
    if (key === 'GET /api/v3/loans/list') return json([]);
    if (key === 'GET /api/v4/chain/info?all=true') return json({ '8453': { addresses: { EVC: [{ address: EVC, abi: 'EVC.v1' }] }, vaults: [{ id: 'vault-12', borrowAsset: 'USDC', addresses: { CREDIFI_ADAPTOR: [{ address: ADAPTOR, abi: 'CredifiERC20Adaptor.v2' }], USDC: [{ address: assetAddress, symbol: 'USDC', decimals: 6 }] } }] } });
    if (key === 'POST /api/vouch/action') { assert.deepEqual(body, { commitmentId: 'vouch-1', action: 'accept' }); if (vouchActionImpl) await vouchActionImpl(); commitmentStatus = 'accepted'; return json({ ok: true }); }
    if (key === 'POST /api/v2/loans/preview-schedule') { assert.equal(headers['x-chain-id'], '8453'); assert.equal(headers['x-market-id'], market().marketId); assert.deepEqual(body, { amount: 5 }); return json(quotePayload); }
    if (key === 'POST /api/v4/loans/create') { assert.deepEqual(body, { amount: 5, disburseTo: ACCOUNT, quoteId: 'quote-1' }); if (createLoanImpl) return createLoanImpl({ body, calls }); return json({ loan: { id: 'loan-1', status: 'approved', amount: 5, marketId: market().marketId, disburseTo: ACCOUNT, disbursement: { chainId: 8453, marketId: market().marketId, loanOwner: ACCOUNT, tokenAddress: USDC } }, rewards: null }); }
    throw new Error(`Unexpected request ${key}`);
  };
  return { fetchImpl, calls, setCommitmentStatus(value) { commitmentStatus = value; } };
}

function json(value, status = 200) { return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } }); }

async function login(service) {
  const challenge = await service.requestLoginChallenge({ sessionKey: 'session-1', identity: identity() });
  assert.equal(challenge.account, ACCOUNT);
  assert.equal(challenge.message, loginMessage());
  const result = await service.verifyLogin({ sessionKey: 'session-1', identity: identity(), signature: '0x1234' });
  assert.equal(result.authenticated, true);
  assert.equal(JSON.stringify(result).includes('secret-bearer-token'), false);
}

test('private beta allowlist fails closed before any CRED or Credifi request', async () => {
  const fixture = createFetchFixture();
  assert.throws(
    () => createConsoleCreditService({ allowedTokenIds: [], fetchImpl: fixture.fetchImpl }),
    /allowed Looper token IDs/i,
  );
  const service = createConsoleCreditService({ allowedTokenIds: ['3802'], fetchImpl: fixture.fetchImpl });
  await assert.rejects(
    () => service.requestLoginChallenge({ sessionKey: 'session-1', identity: identity() }),
    error => error.code === 'credit_private_beta_restricted' && error.status === 403,
  );
  assert.deepEqual(fixture.calls, []);
});

test('CRED gate binds the exact Looper identity and fails closed below the beta floor', async () => {
  const fixture = createFetchFixture({ score: 39 });
  const service = createConsoleCreditService({ allowedTokenIds: ['2431'], fetchImpl: fixture.fetchImpl, now: () => Date.parse('2026-10-21T22:30:00.000Z') });
  await assert.rejects(() => service.requestLoginChallenge({ sessionKey: 'session-1', identity: identity() }), error => error.code === 'cred_gate_failed' && error.status === 403);
  assert.equal(fixture.calls.some(call => call.key.includes('/api/auth/wallet-login')), false);
});

test('Credifi login keeps the bearer token server-side and overview returns bounded borrower state', async () => {
  const fixture = createFetchFixture();
  const service = createConsoleCreditService({ allowedTokenIds: ['2431'], fetchImpl: fixture.fetchImpl, now: () => Date.parse('2026-10-21T22:30:00.000Z') });
  await login(service);
  const overview = await service.getOverview({ sessionKey: 'session-1', identity: identity() });
  assert.equal(overview.cred.score, 42);
  assert.equal(overview.account, ACCOUNT);
  assert.equal(overview.flags.minimumLoanAmount, 5);
  assert.deepEqual(overview.flags.evcAuthorizations['8453-vault-12'], { isAuthorized: false });
  assert.equal(JSON.stringify(overview).includes(TXN_DATA), false);
  assert.equal(overview.commitments[0].id, 'vouch-1');
  assert.equal(overview.markets[0].marketId, market().marketId);
  assert.deepEqual(overview.loans, []);
  assert.equal(JSON.stringify(overview).includes('secret-bearer-token'), false);
});

test('vouch acceptance validates the offered commitment and rereads accepted state', async () => {
  const fixture = createFetchFixture();
  const service = createConsoleCreditService({ allowedTokenIds: ['2431'], fetchImpl: fixture.fetchImpl, now: () => Date.parse('2026-10-21T22:30:00.000Z') });
  await login(service);
  const accepted = await service.acceptVouch({ sessionKey: 'session-1', identity: identity(), commitmentId: 'vouch-1' });
  assert.equal(accepted.status, 'accepted');
  assert.equal(accepted.borrowerWalletAddress, ACCOUNT);
});

test('EVC preparation validates live config and wraps the broad permission through the Looper account', async () => {
  const fixture = createFetchFixture(); fixture.setCommitmentStatus('accepted');
  const service = createConsoleCreditService({ allowedTokenIds: ['2431'], fetchImpl: fixture.fetchImpl, now: () => Date.parse('2026-10-21T22:30:00.000Z') });
  await login(service);
  const prepared = await service.prepareAuthorization({ sessionKey: 'session-1', identity: identity(), commitmentId: 'vouch-1' });
  assert.equal(prepared.required, true);
  assert.equal(prepared.scope, 'ALL_EVC_SUBACCOUNTS_FOR_WALLET_PREFIX');
  assert.equal(prepared.transaction.to, ACCOUNT);
  assert.equal(prepared.transaction.value, '0');
  const decoded = decodeFunctionData({ abi: EXECUTE_ABI, data: prepared.transaction.data });
  assert.equal(decoded.functionName, 'execute');
  assert.equal(decoded.args[0].toLowerCase(), EVC);
  assert.equal(decoded.args[1], 0n);
  assert.equal(decoded.args[2], TXN_DATA);
  assert.equal(decoded.args[3], 0);
});

test('quote and borrow are separate and loan creation reuses the reviewed unexpired quote exactly once', async () => {
  const fixture = createFetchFixture({ authorization: true }); fixture.setCommitmentStatus('accepted');
  const service = createConsoleCreditService({ allowedTokenIds: ['2431'], fetchImpl: fixture.fetchImpl, now: () => Date.parse('2026-10-21T22:30:00.000Z') });
  await login(service);
  const preview = await service.previewLoan({ sessionKey: 'session-1', identity: identity(), commitmentId: 'vouch-1', amount: 5, maxAprPercent: 25 });
  assert.equal(preview.quote.quoteId, 'quote-1');
  assert.match(preview.quoteSha256, /^[a-f0-9]{64}$/);
  assert.equal(fixture.calls.some(call => call.key === 'POST /api/v4/loans/create'), false);
  const created = await service.createLoan({ sessionKey: 'session-1', identity: identity(), commitmentId: 'vouch-1', quoteId: 'quote-1', quoteSha256: preview.quoteSha256, confirmBorrow: true });
  assert.equal(created.status, 'submitted');
  assert.equal(created.loan.id, 'loan-1');
  await assert.rejects(() => service.createLoan({ sessionKey: 'session-1', identity: identity(), commitmentId: 'vouch-1', quoteId: 'quote-1', quoteSha256: preview.quoteSha256, confirmBorrow: true }), error => error.code === 'quote_consumed');
  assert.equal(fixture.calls.filter(call => call.key === 'POST /api/v4/loans/create').length, 1);
});


test('Credifi challenge must bind the exact Looper, domain, Base chain, fresh nonce, and timestamp', async () => {
  const fixture = createFetchFixture({ challengeMessage: loginMessage('0x3333333333333333333333333333333333333333') });
  const service = createConsoleCreditService({ allowedTokenIds: ['2431'], fetchImpl: fixture.fetchImpl, now: () => Date.parse('2026-10-21T22:30:00.000Z') });
  await assert.rejects(
    () => service.requestLoginChallenge({ sessionKey: 'session-1', identity: identity() }),
    error => error.code === 'login_challenge_mismatch' && error.status === 422,
  );
});

test('authorization rejects non-canonical calldata and non-Base-USDC vault identity', async () => {
  const trailingFixture = createFetchFixture({ authorizationData: TXN_DATA + '00'.repeat(32) });
  trailingFixture.setCommitmentStatus('accepted');
  const trailingService = createConsoleCreditService({ allowedTokenIds: ['2431'], fetchImpl: trailingFixture.fetchImpl, now: () => Date.parse('2026-10-21T22:30:00.000Z') });
  await login(trailingService);
  await assert.rejects(
    () => trailingService.prepareAuthorization({ sessionKey: 'session-1', identity: identity(), commitmentId: 'vouch-1' }),
    error => error.code === 'authorization_policy_mismatch',
  );

  const assetFixture = createFetchFixture({ assetAddress: '0x4444444444444444444444444444444444444444' });
  assetFixture.setCommitmentStatus('accepted');
  const assetService = createConsoleCreditService({ allowedTokenIds: ['2431'], fetchImpl: assetFixture.fetchImpl, now: () => Date.parse('2026-10-21T22:30:00.000Z') });
  await login(assetService);
  await assert.rejects(
    () => assetService.prepareAuthorization({ sessionKey: 'session-1', identity: identity(), commitmentId: 'vouch-1' }),
    error => error.code === 'market_policy_mismatch',
  );
});

test('concurrent borrow requests consume a quote atomically before any provider submission await', async () => {
  let releaseCreate;
  let enteredCreate;
  const entered = new Promise((resolve) => { enteredCreate = resolve; });
  const pending = new Promise((resolve) => { releaseCreate = resolve; });
  const fixture = createFetchFixture({ authorization: true, createLoanImpl: async () => { enteredCreate(); await pending; return json({ loan: { id: 'loan-1', status: 'approved', amount: 5, marketId: market().marketId, disburseTo: ACCOUNT, disbursement: { chainId: 8453, marketId: market().marketId, loanOwner: ACCOUNT, tokenAddress: USDC } } }); } });
  fixture.setCommitmentStatus('accepted');
  const service = createConsoleCreditService({ allowedTokenIds: ['2431'], fetchImpl: fixture.fetchImpl, now: () => Date.parse('2026-10-21T22:30:00.000Z') });
  await login(service);
  const preview = await service.previewLoan({ sessionKey: 'session-1', identity: identity(), commitmentId: 'vouch-1', amount: 5, maxAprPercent: 25 });
  const request = { sessionKey: 'session-1', identity: identity(), commitmentId: 'vouch-1', quoteId: 'quote-1', quoteSha256: preview.quoteSha256, confirmBorrow: true };
  const first = service.createLoan(request);
  await entered;
  await assert.rejects(() => service.createLoan(request), error => error.code === 'quote_consumed');
  releaseCreate();
  await first;
  assert.equal(fixture.calls.filter((call) => call.key === 'POST /api/v4/loans/create').length, 1);
});

test('an indeterminate borrow locks all later quotes for the Looper', async () => {
  const fixture = createFetchFixture({ authorization: true, createLoanImpl: async () => { throw new Error('provider connection dropped after submit'); } });
  fixture.setCommitmentStatus('accepted');
  const service = createConsoleCreditService({ allowedTokenIds: ['2431'], fetchImpl: fixture.fetchImpl, now: () => Date.parse('2026-10-21T22:30:00.000Z') });
  await login(service);
  const preview = await service.previewLoan({ sessionKey: 'session-1', identity: identity(), commitmentId: 'vouch-1', amount: 5, maxAprPercent: 25 });
  await assert.rejects(
    () => service.createLoan({ sessionKey: 'session-1', identity: identity(), commitmentId: 'vouch-1', quoteId: 'quote-1', quoteSha256: preview.quoteSha256, confirmBorrow: true }),
    error => error.code === 'loan_creation_indeterminate' && error.details === undefined,
  );
  await assert.rejects(
    () => service.previewLoan({ sessionKey: 'session-1', identity: identity(), commitmentId: 'vouch-1', amount: 5, maxAprPercent: 25 }),
    error => error.code === 'borrow_reconciliation_required',
  );
  const overview = await service.getOverview({ sessionKey: 'session-1', identity: identity() });
  assert.equal(overview.borrowing.status, 'RECONCILIATION_REQUIRED');
});

test('quote arithmetic must reconcile principal, proceeds, schedule, and total repayment', async () => {
  const inconsistent = quote();
  inconsistent.fee.netProceedsMicro = 4_999_999;
  const fixture = createFetchFixture({ authorization: true, quotePayload: inconsistent });
  fixture.setCommitmentStatus('accepted');
  const service = createConsoleCreditService({ allowedTokenIds: ['2431'], fetchImpl: fixture.fetchImpl, now: () => Date.parse('2026-10-21T22:30:00.000Z') });
  await login(service);
  await assert.rejects(
    () => service.previewLoan({ sessionKey: 'session-1', identity: identity(), commitmentId: 'vouch-1', amount: 5, maxAprPercent: 25 }),
    error => error.code === 'quote_amount_mismatch',
  );
});


test('concurrent vouch acceptance is serialized before provider mutation', async () => {
  let releaseAction;
  let enteredAction;
  const entered = new Promise((resolve) => { enteredAction = resolve; });
  const pending = new Promise((resolve) => { releaseAction = resolve; });
  const fixture = createFetchFixture({ vouchActionImpl: async () => { enteredAction(); await pending; } });
  const service = createConsoleCreditService({ allowedTokenIds: ['2431'], fetchImpl: fixture.fetchImpl, now: () => Date.parse('2026-10-21T22:30:00.000Z') });
  await login(service);
  const first = service.acceptVouch({ sessionKey: 'session-1', identity: identity(), commitmentId: 'vouch-1' });
  await entered;
  await assert.rejects(
    () => service.acceptVouch({ sessionKey: 'session-1', identity: identity(), commitmentId: 'vouch-1' }),
    error => error.code === 'vouch_action_in_progress',
  );
  releaseAction();
  await first;
  assert.equal(fixture.calls.filter((call) => call.key === 'POST /api/vouch/action').length, 1);
});


test('provider-controlled errors are projected locally without bearer or diagnostic leakage', async () => {
  const fixture = createFetchFixture({ failFlags: true });
  const service = createConsoleCreditService({ allowedTokenIds: ['2431'], fetchImpl: fixture.fetchImpl, now: () => Date.parse('2026-10-21T22:30:00.000Z') });
  await login(service);
  await assert.rejects(
    () => service.getOverview({ sessionKey: 'session-1', identity: identity() }),
    error => error.code === 'credit_provider_unavailable' && !JSON.stringify(error).includes('secret-bearer-token') && error.details === undefined,
  );
});
