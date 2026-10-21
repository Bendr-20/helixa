import assert from 'node:assert/strict';
import test from 'node:test';

import { createConsoleCreditApi, createInitialConsoleCreditState, renderConsoleCreditPanel } from '../src/console-credit.js';

const TOKEN_ID = '2431';
const OVERVIEW = {
  account: '0xee37097c267ceb22b553e0e947d19c5ce4ba696c',
  cred: { score: 42, tier: 'Marginal', minimumScore: 40 },
  flags: { minimumLoanAmount: 5, loanTwoFactorRequired: false, evcAuthorizations: { '8453-vault-12': { isAuthorized: true } } },
  markets: [{ chainId: 8453, marketId: 'base-usdc-2500:stable-12', vaultId: 'vault-12', userAccessible: true, acceptsNewBorrowers: true }],
  commitments: [{ id: 'vouch-1', status: 'accepted', sponsorWalletAddress: '0x3333333333333333333333333333333333333333', remainingMicro: 5_000_000, chainId: 8453, marketId: 'base-usdc-2500:stable-12' }],
  balance: { credit: { availableCredit: 5_000_000 } },
  loans: [],
};

test('credit client sends exact CSRF-bound request envelopes', async () => {
  const calls = [];
  const api = createConsoleCreditApi({ fetchImpl: async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
  } });
  await api.preview({ tokenId: TOKEN_ID, commitmentId: 'vouch-1', amount: 5, maxAprPercent: 25, csrfToken: 'csrf-1' });
  await api.borrow({ tokenId: TOKEN_ID, commitmentId: 'vouch-1', quoteId: 'quote-1', quoteSha256: 'a'.repeat(64), confirmBorrow: true, csrfToken: 'csrf-1' });
  assert.deepEqual(calls.map((call) => [call.url, JSON.parse(call.init.body)]), [
    ['/api/multipass/console/credit/preview', { tokenId: TOKEN_ID, commitmentId: 'vouch-1', amount: 5, maxAprPercent: 25 }],
    ['/api/multipass/console/credit/borrow', { tokenId: TOKEN_ID, commitmentId: 'vouch-1', quoteId: 'quote-1', quoteSha256: 'a'.repeat(64), confirmBorrow: true }],
  ]);
  assert.ok(calls.every((call) => call.init.credentials === 'include' && call.init.headers['x-csrf-token'] === 'csrf-1'));
});

test('credit entry is honest about sponsor-vouch beta and provider application limits', () => {
  const html = renderConsoleCreditPanel({ ...createInitialConsoleCreditState(TOKEN_ID), status: 'login_required' }, { tokenId: TOKEN_ID, agentName: 'Looper 2431' });
  assert.match(html, /Sponsor-vouch credit through Credifi/u);
  assert.match(html, /Sign this Looper into Credifi/u);
  assert.match(html, /bearer session stays on the Multipass server/u);
  assert.doesNotMatch(html, /Bearer /u);
});

test('credit workspace separates vouch, broad authorization, quote, and borrow confirmations', () => {
  const html = renderConsoleCreditPanel({
    status: 'ready', selectedTokenId: TOKEN_ID, overview: OVERVIEW,
    authorization: { required: true, commitmentId: 'vouch-1', evc: '0x1111111111111111111111111111111111111111', operator: '0x2222222222222222222222222222222222222222', scope: 'ALL_EVC_SUBACCOUNTS_FOR_WALLET_PREFIX' },
    quote: { status: 'reviewed', commitment: { id: 'vouch-1' }, quoteSha256: 'a'.repeat(64), quote: { quoteId: 'quote-1', quoteExpiresAt: '2026-10-21T23:00:00.000Z', fee: { feeMicro: 0 }, loan: { amount: 5, interestRate: 15, totalRepayment: 5.01, loanTerms: { termDays: 30, repaymentType: 'bullet' } }, paymentSchedule: [{ dueDate: '2026-11-20T23:00:00.000Z', amount: 5.01 }] } },
  }, { tokenId: TOKEN_ID, agentName: 'Looper 2431' });
  assert.match(html, /all EVC subaccounts for this wallet prefix/i);
  assert.match(html, /not limited to one subaccount/i);
  assert.match(html, /Preview terms/u);
  assert.match(html, /I reviewed principal, APR, fees, schedule, and total repayment/u);
  assert.match(html, /Borrow to Looper account/u);
  assert.doesNotMatch(html, /secret|bearer token/iu);
});

test('credit workspace states no direct application was submitted when no vouch exists', () => {
  const html = renderConsoleCreditPanel({ status: 'ready', selectedTokenId: TOKEN_ID, overview: { ...OVERVIEW, commitments: [] } }, { tokenId: TOKEN_ID });
  assert.match(html, /does not expose a public application endpoint/u);
  assert.match(html, /approved sponsor issues a vouch/u);
});


test('credit workspace disables new quotes while a borrow needs reconciliation', () => {
  const html = renderConsoleCreditPanel({ status: 'ready', selectedTokenId: TOKEN_ID, overview: { ...OVERVIEW, borrowing: { status: 'RECONCILIATION_REQUIRED', quoteId: 'quote-1' } } }, { tokenId: TOKEN_ID });
  assert.match(html, /New borrowing is locked until an operator reconciles/i);
  assert.match(html, /<button type="submit" disabled>Preview terms<\/button>/u);
});
