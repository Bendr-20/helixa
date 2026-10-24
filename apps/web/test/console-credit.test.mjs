import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { bindConsoleCredit, createConsoleCreditApi, createInitialConsoleCreditState, renderConsoleCreditPanel } from '../src/console-credit.js';

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


test('credit workspace owns a high-contrast product surface and touch-safe controls', async () => {
  const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.console-credit-workspace \{[^}]*--credit-bg:/s);
  assert.match(css, /\.console-credit-workspace \{[^}]*background:/s);
  assert.match(css, /\.console-credit-workspace :is\(button, input\)[^{]*\{[^}]*min-height: 44px/s);
  assert.match(css, /\.console-credit-workspace input:not\(\[type="checkbox"\]\)[^{]*\{[^}]*background:/s);
  assert.match(css, /\.console-credit-confirm input\[type="checkbox"\][^{]*\{[^}]*width: 20px/s);
});


test('Credifi pilot client uses owner-scoped GET and exact consent-only POST', async () => {
  const calls = [];
  const api = createConsoleCreditApi({ fetchImpl: async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ schema_version: '1.0.0', status: 'eligible' }), { status: 200, headers: { 'content-type': 'application/json' } });
  } });
  await api.optInStatus({ tokenId: '11' });
  await api.submitOptIn({ tokenId: '11', csrfToken: 'csrf-1' });
  assert.equal(calls[0].url, '/api/multipass/console/credifi-pilot/opt-in?tokenId=11');
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[0].init.body, undefined);
  assert.equal(calls[1].url, '/api/multipass/console/credifi-pilot/opt-in');
  assert.equal(calls[1].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[1].init.body), { tokenId: '11', consent: true });
  assert.equal(calls[1].init.headers['x-csrf-token'], 'csrf-1');
});

test('Credifi pilot UI is unavailable until authenticated eligibility is loaded', () => {
  const idle = renderConsoleCreditPanel(createInitialConsoleCreditState('11'), { tokenId: '11', agentName: 'Looper 11' });
  assert.match(idle, /Authenticate and select an eligible prepared Looper/i);
  assert.doesNotMatch(idle, /data-action="submit-credifi-owner-opt-in"/u);
  const loading = renderConsoleCreditPanel({ ...createInitialConsoleCreditState('11'), optIn: { status: 'loading' } }, { tokenId: '11' });
  assert.match(loading, /Verifying current owner/u);
  assert.doesNotMatch(loading, /data-action="submit-credifi-owner-opt-in"/u);
});

test('eligible and completed Credifi pilot UI states explain consent-only boundaries', () => {
  const status = { token_id: '11', status: 'eligible', amount_usd: '50.00', cohort_version: 'cohort-v1', account: '0xbaa56a2ef2dbabedaa0828c3c9c8c06b1ab46b3f' };
  const eligible = renderConsoleCreditPanel({ ...createInitialConsoleCreditState('11'), optIn: { status: 'eligible', record: status } }, { tokenId: '11' });
  assert.match(eligible, /prepared \$50 Credifi pilot/i);
  assert.match(eligible, /does not accept a vouch, authorize EVC, request a quote, borrow funds, or enable Credit/i);
  assert.match(eligible, /data-action="submit-credifi-owner-opt-in"/u);
  const completed = renderConsoleCreditPanel({ ...createInitialConsoleCreditState('11'), optIn: { status: 'opted_in', record: { ...status, status: 'opted_in', consented_at: '2026-10-24T02:00:00.000Z' } } }, { tokenId: '11' });
  assert.match(completed, /Owner opt-in recorded/u);
  assert.doesNotMatch(completed, /data-action="submit-credifi-owner-opt-in"/u);
  assert.doesNotMatch(completed, /Accept vouch|Preview terms|Borrow to Looper account/u);
});

test('Credifi pilot UI binds its consent action once', () => {
  let listener;
  const button = { addEventListener(type, callback) { assert.equal(type, 'click'); listener = callback; } };
  const root = {
    querySelector(selector) { return selector === '[data-action="submit-credifi-owner-opt-in"]' ? button : null; },
    querySelectorAll() { return []; },
  };
  let submitted = 0;
  bindConsoleCredit(root, { submitOptIn: () => { submitted += 1; } });
  listener();
  assert.equal(submitted, 1);
});
