const CREDIT_PATH = '/api/multipass/console/credit';
const CREDIFI_PILOT_OPT_IN_PATH = '/api/multipass/console/credifi-pilot/opt-in';

export function createConsoleCreditApi({ fetchImpl = globalThis.fetch, apiBase = '' } = {}) {
  const post = async (action, body, csrfToken, signal) => {
    if (typeof fetchImpl !== 'function') throw new TypeError('Console credit fetch implementation is required.');
    const response = await fetchImpl(apiBase + CREDIT_PATH + '/' + action, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json', 'x-csrf-token': String(csrfToken ?? '') },
      credentials: 'include', redirect: 'error', signal,
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(payload?.error?.message ?? 'Console credit request failed.');
      error.status = response.status;
      error.code = payload?.error?.code ?? 'credit_unavailable';
      error.details = payload?.error?.details;
      throw error;
    }
    return payload;
  };
  const getOptInStatus = async ({ tokenId, signal }) => {
    if (typeof fetchImpl !== 'function') throw new TypeError('Console credit fetch implementation is required.');
    const query = new URLSearchParams({ tokenId: String(tokenId ?? '') });
    const response = await fetchImpl(apiBase + CREDIFI_PILOT_OPT_IN_PATH + '?' + query, {
      method: 'GET', headers: { accept: 'application/json' }, credentials: 'include', redirect: 'error', signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throwConsoleCreditClientError(response, payload, 'Credifi pilot status request failed.');
    return payload;
  };
  return Object.freeze({
    optInStatus: getOptInStatus,
    submitOptIn: ({ tokenId, csrfToken, signal }) => postPilotOptIn({ fetchImpl, apiBase, tokenId, csrfToken, signal }),
    challenge: ({ tokenId, csrfToken, signal }) => post('challenge', { tokenId }, csrfToken, signal),
    verify: ({ tokenId, signature, csrfToken, signal }) => post('verify', { tokenId, signature }, csrfToken, signal),
    overview: ({ tokenId, csrfToken, signal }) => post('overview', { tokenId }, csrfToken, signal),
    acceptVouch: ({ tokenId, commitmentId, csrfToken, signal }) => post('accept-vouch', { tokenId, commitmentId }, csrfToken, signal),
    prepareAuthorization: ({ tokenId, commitmentId, csrfToken, signal }) => post('prepare-authorization', { tokenId, commitmentId }, csrfToken, signal),
    requestTwoFactor: ({ tokenId, channel, csrfToken, signal }) => post('request-two-factor', { tokenId, channel }, csrfToken, signal),
    verifyTwoFactor: ({ tokenId, code, csrfToken, signal }) => post('verify-two-factor', { tokenId, code }, csrfToken, signal),
    preview: ({ tokenId, commitmentId, amount, maxAprPercent, csrfToken, signal }) => post('preview', { tokenId, commitmentId, amount, maxAprPercent }, csrfToken, signal),
    borrow: ({ tokenId, commitmentId, quoteId, quoteSha256, confirmBorrow, csrfToken, signal }) => post('borrow', { tokenId, commitmentId, quoteId, quoteSha256, confirmBorrow }, csrfToken, signal),
  });
}

export function createInitialConsoleCreditState(tokenId = null) {
  return Object.freeze({
    status: 'idle', selectedTokenId: tokenId == null ? null : String(tokenId), overview: null,
    optIn: Object.freeze({ status: 'idle', record: null, error: null }),
    authorization: null, quote: null, error: null, notice: null,
  });
}

export function renderConsoleCreditPanel(credit = {}, context = {}) {
  const tokenId = String(context.tokenId ?? credit.selectedTokenId ?? '').trim();
  const optIn = credit.optIn ?? { status: 'unavailable' };
  const renderPilot = credit.status === 'idle' && optIn.status !== 'unavailable';
  if (renderPilot) return renderCredifiPilotOptIn(optIn, { ...context, tokenId });
  const busy = ['loading', 'signing', 'mutating', 'authorizing', 'quoting', 'borrowing'].includes(credit.status);
  const overview = credit.overview;
  const cred = overview?.cred;
  const commitments = Array.isArray(overview?.commitments) ? overview.commitments : [];
  const loans = Array.isArray(overview?.loans) ? overview.loans : [];
  const blocked = credit.status === 'blocked';
  return `
    <section class="console-credit-workspace" aria-labelledby="console-credit-title" aria-busy="${busy ? 'true' : 'false'}">
      <header class="console-credit-header">
        <div><span class="console-gate-eyebrow">Private beta · Base USDC</span><h2 id="console-credit-title">Credit for ${escapeHtml(context.agentName ?? ('Looper #' + tokenId))}</h2><p>Sponsor-vouch credit through Credifi. Every signature, permission grant, quote, and borrow stays a separate owner action.</p></div>
        ${overview ? '<button type="button" data-action="refresh-console-credit" ' + (busy ? 'disabled' : '') + '>Refresh</button>' : ''}
      </header>
      <div class="console-credit-cautions" role="note"><strong>Private beta controls</strong><span>CRED floor ${escapeHtml(String(cred?.minimumScore ?? 40))}</span><span>Zero origination fee only</span><span>Owner-set APR ceiling</span><span>Funds disburse to the Looper account</span></div>
      ${credit.error ? '<p class="console-credit-error" role="alert">' + escapeHtml(credit.error) + '</p>' : ''}
      ${credit.notice ? '<p class="console-credit-notice" role="status">' + escapeHtml(credit.notice) + '</p>' : ''}
      ${blocked ? renderBlocked(credit) : ''}
      ${!overview && !blocked ? renderEntry(credit, tokenId, busy) : ''}
      ${overview ? renderOverview(credit, { commitments, loans, context, busy }) : ''}
    </section>
  `;
}

function renderBlocked(credit) {
  const score = credit.details?.score;
  const minimum = credit.details?.minimumScore ?? 40;
  return '<article class="console-credit-gate console-credit-gate-blocked"><span>CRED eligibility</span><strong>' + escapeHtml(score == null ? 'Not eligible' : score + ' / 100') + '</strong><p>This private beta requires CRED ' + escapeHtml(String(minimum)) + ' or higher. Refresh CRED before retrying.</p><button type="button" data-action="refresh-console-credit">Recheck CRED</button></article>';
}

function renderEntry(credit, tokenId, busy) {
  if (credit.status === 'login_required') {
    return '<article class="console-credit-gate"><span>Credifi account</span><h3>Sign this Looper into Credifi</h3><p>The challenge is requested for the Looper ERC-6551 account. Your connected owner wallet signs it; the bearer session stays on the Multipass server.</p><button type="button" data-action="login-console-credit" ' + (busy ? 'disabled' : '') + '>Sign in to Credifi</button></article>';
  }
  return '<article class="console-credit-gate"><span>Looper #' + escapeHtml(tokenId) + '</span><h3>Check credit access</h3><p>Verify live CRED, Credifi eligibility, sponsor vouches, market access, wallet status, and current loans.</p><button type="button" data-action="refresh-console-credit" ' + (busy ? 'disabled' : '') + '>' + (busy ? 'Checking…' : 'Check eligibility') + '</button></article>';
}

function renderOverview(credit, { commitments, loans, context, busy }) {
  const overview = credit.overview;
  const cred = overview.cred ?? {};
  const accepted = commitments.filter((entry) => ['accepted', 'active'].includes(entry.status));
  const offered = commitments.filter((entry) => entry.status === 'offered');
  return `
    <div class="console-credit-metrics">
      <article><span>CRED</span><strong>${escapeHtml(String(cred.score ?? 'Unavailable'))}</strong><small>${escapeHtml(cred.tier ?? '')}</small></article>
      <article><span>Available credit</span><strong>${formatMicro(overview.balance?.credit?.availableCredit)}</strong><small>USDC</small></article>
      <article><span>Minimum loan</span><strong>${formatUsd(overview.flags?.minimumLoanAmount)}</strong><small>Credifi account rule</small></article>
      <article><span>Open loans</span><strong>${loans.filter((loan) => !['completed', 'repaid', 'closed'].includes(String(loan.status).toLowerCase())).length}</strong><small>Provider state</small></article>
    </div>
    ${overview.flags?.blockBorrowReason ? '<p class="console-credit-error">Borrowing blocked: ' + escapeHtml(overview.flags.blockBorrowReason) + '</p>' : ''}
    <section class="console-credit-section"><header><div><span>Step 1</span><h3>Sponsor vouches</h3></div><small>Accepting a vouch does not grant permission or borrow funds.</small></header>
      ${offered.length === 0 && accepted.length === 0 ? '<div class="console-credit-empty"><strong>No sponsor offer yet</strong><p>Credifi does not expose a public application endpoint. This private beta starts when an approved sponsor issues a vouch for this Looper.</p></div>' : ''}
      <div class="console-credit-list">${commitments.map((item) => renderCommitment(item, busy)).join('')}</div>
    </section>
    ${accepted.length ? renderBorrowFlow(credit, accepted, context, busy) : ''}
    <section class="console-credit-section"><header><div><span>Account</span><h3>Loans and repayment status</h3></div><small>Refresh after repayment so Credifi state and future provider attestations stay current.</small></header>
      ${loans.length ? '<div class="console-credit-list">' + loans.map(renderLoan).join('') + '</div>' : '<div class="console-credit-empty"><strong>No loans</strong><p>No Credifi loans are recorded for this Looper account.</p></div>'}
    </section>
  `;
}

function renderCommitment(item, busy) {
  const offered = item.status === 'offered';
  return '<article class="console-credit-row"><div><strong>' + formatMicro(item.remainingMicro) + ' USDC</strong><span>' + escapeHtml(item.status) + ' · ' + escapeHtml(item.marketId) + '</span><small>Sponsor ' + escapeHtml(shortAddress(item.sponsorWalletAddress)) + '</small></div>' + (offered ? '<button type="button" data-action="accept-console-credit-vouch" data-commitment-id="' + escapeAttribute(item.id) + '" ' + (busy ? 'disabled' : '') + '>Accept vouch</button>' : '<span class="console-credit-state">' + escapeHtml(item.status) + '</span>') + '</article>';
}

function renderBorrowFlow(credit, accepted, context, busy) {
  const selected = accepted.find((item) => item.id === credit.quote?.commitment?.id || item.id === credit.authorization?.commitmentId) ?? accepted[0];
  const authorization = credit.authorization;
  const quote = credit.quote;
  const flags = credit.overview?.flags ?? {};
  const reconciliationRequired = credit.overview?.borrowing?.status === 'RECONCILIATION_REQUIRED';
  const selectedMarket = (credit.overview?.markets ?? []).find((market) => market.chainId === selected.chainId && market.marketId === selected.marketId) ?? null;
  return `
    <section class="console-credit-section"><header><div><span>Step 2</span><h3>Market authorization</h3></div><small>Separate onchain owner approval.</small></header>
      ${authorization?.required ? renderAuthorizationReview(authorization, busy) : '<div class="console-credit-row"><div><strong>Credifi EVC permission</strong><span>' + (isAuthorized(flags, selectedMarket) ? 'Authorized for this vault' : 'Not authorized') + '</span></div><button type="button" data-action="prepare-console-credit-authorization" data-commitment-id="' + escapeAttribute(selected.id) + '" ' + (busy ? 'disabled' : '') + '>' + (isAuthorized(flags, selectedMarket) ? 'Recheck authorization' : 'Review authorization') + '</button></div>'}
    </section>
    ${flags.loanTwoFactorRequired ? renderTwoFactor(flags, busy) : ''}
    <section class="console-credit-section"><header><div><span>Step 3</span><h3>Review a live quote</h3></div><small>Quote creation does not borrow.</small></header>
      ${reconciliationRequired ? '<p class="console-credit-error" role="alert">A previous borrow result is uncertain. New borrowing is locked until an operator reconciles the Credifi loan state.</p>' : ''}
      <form class="console-credit-form" data-action="preview-console-credit" data-commitment-id="${escapeAttribute(selected.id)}">
        <label><span>Amount (USDC)</span><input name="amount" inputmode="decimal" value="${escapeAttribute(credit.amount ?? String(flags.minimumLoanAmount ?? 5))}" required></label>
        <label><span>Maximum APR (%)</span><input name="maxAprPercent" inputmode="decimal" value="${escapeAttribute(credit.maxAprPercent ?? '25')}" required></label>
        <button type="submit" ${busy || reconciliationRequired || !isAuthorized(flags, selectedMarket) ? 'disabled' : ''}>${credit.status === 'quoting' ? 'Requesting quote…' : 'Preview terms'}</button>
      </form>
      ${quote ? renderQuote(quote, busy) : ''}
    </section>
  `;
}

function renderAuthorizationReview(authorization, busy) {
  if (authorization.required === false) return '<div class="console-credit-row"><div><strong>Authorization already active</strong><span>No transaction is required.</span></div></div>';
  return '<article class="console-credit-authorization"><span>Broad permission disclosure</span><h4>Authorize Credifi across all EVC subaccounts for this wallet prefix</h4><p>This is not limited to one subaccount. The Console validated the live EVC, Credifi adaptor, account prefix, full operator bitfield, zero ETH value, and exact setOperator calldata before wrapping it through the Looper account.</p><dl><div><dt>EVC</dt><dd>' + escapeHtml(shortAddress(authorization.evc)) + '</dd></div><div><dt>Operator</dt><dd>' + escapeHtml(shortAddress(authorization.operator)) + '</dd></div><div><dt>Scope</dt><dd>' + escapeHtml(authorization.scope) + '</dd></div></dl><button type="button" data-action="submit-console-credit-authorization" ' + (busy ? 'disabled' : '') + '>Authorize in wallet</button></article>';
}

function renderTwoFactor(flags, busy) {
  return '<section class="console-credit-section"><header><div><span>Verification</span><h3>Credifi two-factor check</h3></div></header><div class="console-credit-actions">' + (flags.loanTwoFactorAvailableChannels ?? []).map((channel) => '<button type="button" data-action="request-console-credit-2fa" data-channel="' + escapeAttribute(channel) + '" ' + (busy ? 'disabled' : '') + '>Send ' + escapeHtml(channel) + ' code</button>').join('') + '</div><form class="console-credit-form" data-action="verify-console-credit-2fa"><label><span>Six-digit code</span><input name="code" inputmode="numeric" pattern="[0-9]{6}" autocomplete="one-time-code" required></label><button type="submit" ' + (busy ? 'disabled' : '') + '>Verify code</button></form></section>';
}

function renderQuote(record, busy) {
  const quote = record.quote ?? {};
  const loan = quote.loan ?? {};
  const fee = quote.fee ?? {};
  return `<article class="console-credit-quote"><header><div><span>Live quote</span><h4>${formatUsd(loan.amount)} principal at ${escapeHtml(String(loan.interestRate ?? '?'))}% APR</h4></div><strong>${formatUsd(loan.totalRepayment)} total</strong></header><dl><div><dt>Origination fee</dt><dd>${formatMicro(fee.feeMicro)} USDC</dd></div><div><dt>Term</dt><dd>${escapeHtml(String(loan.loanTerms?.termDays ?? '?'))} days</dd></div><div><dt>Repayment</dt><dd>${escapeHtml(loan.loanTerms?.repaymentType ?? 'See schedule')}</dd></div><div><dt>Expires</dt><dd>${escapeHtml(formatDate(quote.quoteExpiresAt))}</dd></div></dl><div class="console-credit-schedule">${(quote.paymentSchedule ?? []).map((item) => '<span>' + escapeHtml(formatDate(item.dueDate)) + ': ' + formatUsd(item.amount) + '</span>').join('')}</div><form data-action="borrow-console-credit"><label class="console-credit-confirm"><input type="checkbox" name="confirmed" required><span>I reviewed principal, APR, fees, schedule, and total repayment. Borrow exactly these terms.</span></label><button type="submit" ${busy ? 'disabled' : ''}>${record.status === 'borrowing' ? 'Borrowing…' : 'Borrow to Looper account'}</button></form></article>`;
}

function renderLoan(loan) {
  return '<article class="console-credit-row"><div><strong>' + escapeHtml(loan.id) + '</strong><span>' + escapeHtml(loan.status) + (loan.amount == null ? '' : ' · ' + formatUsd(loan.amount)) + '</span><small>' + (loan.disbursement?.transactionHash ? 'Base tx ' + escapeHtml(shortAddress(loan.disbursement.transactionHash)) : 'Provider record') + '</small></div></article>';
}

function isAuthorized(flags, market) {
  if (!market?.chainId || !market?.vaultId) return false;
  return flags.evcAuthorizations?.[String(market.chainId) + '-' + String(market.vaultId)]?.isAuthorized === true;
}

export function bindConsoleCredit(root, handlers = {}) {
  root.querySelector('[data-action="submit-credifi-owner-opt-in"]')?.addEventListener('click', () => handlers.submitOptIn?.());
  root.querySelector('[data-action="refresh-console-credit"]')?.addEventListener('click', () => handlers.refresh?.());
  root.querySelector('[data-action="login-console-credit"]')?.addEventListener('click', () => handlers.login?.());
  root.querySelectorAll('[data-action="accept-console-credit-vouch"]').forEach((button) => button.addEventListener('click', () => handlers.acceptVouch?.(button.dataset.commitmentId)));
  root.querySelector('[data-action="prepare-console-credit-authorization"]')?.addEventListener('click', (event) => handlers.prepareAuthorization?.(event.currentTarget.dataset.commitmentId));
  root.querySelector('[data-action="submit-console-credit-authorization"]')?.addEventListener('click', () => handlers.submitAuthorization?.());
  root.querySelectorAll('[data-action="request-console-credit-2fa"]').forEach((button) => button.addEventListener('click', () => handlers.requestTwoFactor?.(button.dataset.channel)));
  root.querySelector('[data-action="verify-console-credit-2fa"]')?.addEventListener('submit', (event) => { event.preventDefault(); handlers.verifyTwoFactor?.(createFormData(event.currentTarget).get('code')); });
  root.querySelector('[data-action="preview-console-credit"]')?.addEventListener('submit', (event) => { event.preventDefault(); const data = createFormData(event.currentTarget); handlers.preview?.({ commitmentId: event.currentTarget.dataset.commitmentId, amount: data.get('amount'), maxAprPercent: data.get('maxAprPercent') }); });
  root.querySelector('[data-action="borrow-console-credit"]')?.addEventListener('submit', (event) => { event.preventDefault(); handlers.borrow?.({ confirmed: createFormData(event.currentTarget).get('confirmed') === 'on' }); });
}

function createFormData(form) { const FormDataConstructor = form?.ownerDocument?.defaultView?.FormData ?? globalThis.FormData; return new FormDataConstructor(form); }
function formatMicro(value) { const number = Number(value); return Number.isFinite(number) ? (number / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 6 }) : '0'; }
function formatUsd(value) { const number = Number(value); return Number.isFinite(number) ? number.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 6 }) : 'Unavailable'; }
function formatDate(value) { const time = Date.parse(String(value ?? '')); return Number.isFinite(time) ? new Date(time).toLocaleString() : 'Unavailable'; }
function shortAddress(value) { const text = String(value ?? ''); return text.length > 14 ? text.slice(0, 8) + '…' + text.slice(-6) : text; }
function escapeHtml(value) { return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }
function escapeAttribute(value) { return escapeHtml(value).replaceAll('\n', '&#10;').replaceAll('\r', '&#13;'); }


async function postPilotOptIn({ fetchImpl, apiBase, tokenId, csrfToken, signal }) {
  const response = await fetchImpl(apiBase + CREDIFI_PILOT_OPT_IN_PATH, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json', 'x-csrf-token': String(csrfToken ?? '') },
    credentials: 'include', redirect: 'error', signal,
    body: JSON.stringify({ tokenId: String(tokenId ?? ''), consent: true }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throwConsoleCreditClientError(response, payload, 'Credifi pilot opt-in failed.');
  return payload;
}

function throwConsoleCreditClientError(response, payload, fallback) {
  const error = new Error(payload?.error?.message ?? fallback);
  error.status = response.status;
  error.code = payload?.error?.code ?? 'credit_unavailable';
  error.details = payload?.error?.details;
  throw error;
}

function renderCredifiPilotOptIn(optIn, context) {
  const status = optIn?.status ?? 'idle';
  const record = optIn?.record ?? null;
  const tokenId = String(context.tokenId ?? '').trim();
  const title = escapeHtml(context.agentName ?? ('Looper #' + tokenId));
  if (status === 'loading') {
    return '<section class="console-credit-workspace console-credifi-opt-in" aria-busy="true"><span class="console-gate-eyebrow">Pilot opt-in only · borrowing disabled</span><h2>Verifying current owner</h2><p>Checking the authenticated wallet, current NFT ownership and controller authority, and the exact prepared cohort.</p></section>';
  }
  if (status === 'eligible' || status === 'submitting') {
    return '<section class="console-credit-workspace console-credifi-opt-in" aria-busy="' + (status === 'submitting' ? 'true' : 'false') + '"><span class="console-gate-eyebrow">Pilot opt-in only · borrowing disabled</span><h2>' + title + ' is invited to the prepared $50 Credifi pilot</h2><p>Record the current owner’s consent for Looper #' + escapeHtml(tokenId) + ' and its canonical released-v1 account. This does not accept a vouch, authorize EVC, request a quote, borrow funds, or enable Credit.</p><button type="button" data-action="submit-credifi-owner-opt-in" ' + (status === 'submitting' ? 'disabled' : '') + '>' + (status === 'submitting' ? 'Recording owner opt-in…' : 'Opt in to preparation') + '</button></section>';
  }
  if (status === 'opted_in') {
    return '<section class="console-credit-workspace console-credifi-opt-in"><span class="console-gate-eyebrow">Pilot opt-in only · borrowing disabled</span><h2>Owner opt-in recorded</h2><p>Consent for Looper #' + escapeHtml(tokenId) + ' is bound to the current owner and canonical released-v1 account for the prepared $' + escapeHtml(record?.amount_usd ?? '50.00') + ' cohort.</p><p>No vouch was accepted, no EVC permission was granted, no quote was requested, no funds were borrowed, and Credit remains disabled.</p><small>Recorded ' + escapeHtml(formatDate(record?.consented_at)) + '</small></section>';
  }
  if (status === 'error') {
    return '<section class="console-credit-workspace console-credifi-opt-in"><span class="console-gate-eyebrow">Pilot opt-in only · borrowing disabled</span><h2>Owner opt-in unavailable</h2><p role="alert">' + escapeHtml(optIn?.error ?? 'Eligibility could not be verified. Retry after confirming wallet ownership.') + '</p></section>';
  }
  return '<section class="console-credit-workspace console-credifi-opt-in"><span class="console-gate-eyebrow">Pilot opt-in only · borrowing disabled</span><h2>Credifi pilot owner opt-in</h2><p>Authenticate and select an eligible prepared Looper before owner consent is available.</p></section>';
}
