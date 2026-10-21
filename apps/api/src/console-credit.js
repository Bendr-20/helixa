import { createHash } from 'node:crypto';

import { decodeFunctionData, encodeFunctionData, getAddress } from 'viem';

import { deriveReleasedLooperAccount } from './looper-account.js';

export const DEFAULT_CREDIFI_API_BASE_URL = 'https://backend.credi.fi';
export const DEFAULT_LOOPER_CREDIT_CRED_BASE_URL = 'https://helixa.xyz';
export const DEFAULT_LOOPER_CREDIT_MIN_CRED = 40;

const BASE_CHAIN_ID = 8453;
const BASE_USDC_ADDRESS = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const LOOPERS_COLLECTION = '0x1649cd37f4748807b4882fc48765ba0b2affa94a';
const MAX_RESPONSE_BYTES = 512 * 1024;
const MAX_SESSIONS = 2_000;
const LOGIN_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const CREDIFI_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;
const AUTHORIZATION_REVIEW_TTL_MS = 2 * 60 * 1000;
const MAX_UINT256 = (1n << 256n) - 1n;
const EVC_ABI = Object.freeze([{
  type: 'function', name: 'setOperator', stateMutability: 'nonpayable',
  inputs: [{ name: 'accountPrefix', type: 'bytes19' }, { name: 'operator', type: 'address' }, { name: 'operatorBitField', type: 'uint256' }], outputs: [],
}]);
const EXECUTE_ABI = Object.freeze([{
  type: 'function', name: 'execute', stateMutability: 'payable',
  inputs: [{ name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'data', type: 'bytes' }, { name: 'operation', type: 'uint8' }],
  outputs: [{ name: 'result', type: 'bytes' }],
}]);

export class ConsoleCreditError extends Error {
  constructor(code, message, { status = 400, details, cause } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'ConsoleCreditError';
    this.code = stableCode(code) ? code : 'credit_unavailable';
    this.status = Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500;
    if (details !== undefined) this.details = details;
  }
}

export function createConsoleCreditService({
  fetchImpl = globalThis.fetch,
  apiBaseUrl = DEFAULT_CREDIFI_API_BASE_URL,
  credBaseUrl = DEFAULT_LOOPER_CREDIT_CRED_BASE_URL,
  minCredScore = DEFAULT_LOOPER_CREDIT_MIN_CRED,
  now = () => Date.now(),
  requestTimeoutMs = REQUEST_TIMEOUT_MS,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('Console credit fetch implementation is required.');
  const apiBase = normalizeBaseUrl(apiBaseUrl, 'Credifi API base URL');
  const credBase = normalizeBaseUrl(credBaseUrl, 'CRED API base URL');
  const minimumScore = boundedInteger(minCredScore, 'minimum CRED score', 0, 100);
  const timeoutMs = boundedInteger(requestTimeoutMs, 'credit request timeout', 100, 30_000);
  const pendingChallenges = new Map();
  const sessions = new Map();
  const quotes = new Map();
  const vouchActions = new Set();
  const indeterminateBorrowers = new Map();

  function clock() {
    const value = Number(now());
    if (!Number.isFinite(value)) throw new TypeError('Credit clock returned an invalid time.');
    return value;
  }

  function subject(identity) {
    const normalized = normalizeIdentity(identity);
    return { ...normalized, account: deriveReleasedLooperAccount(normalized.tokenId).toLowerCase() };
  }

  function keyFor(sessionKey, identity) {
    const key = normalizeSessionKey(sessionKey);
    const normalized = subject(identity);
    return { key: key + ':' + normalized.tokenId, subject: normalized };
  }

  function sweep() {
    const current = clock();
    for (const [key, value] of pendingChallenges) if (value.expiresAt <= current) pendingChallenges.delete(key);
    for (const [key, value] of sessions) if (value.expiresAt <= current) sessions.delete(key);
    for (const [key, value] of quotes) if (value.expiresAt <= current || value.createdAt + CREDIFI_SESSION_TTL_MS <= current) quotes.delete(key);
    while (sessions.size > MAX_SESSIONS) sessions.delete(sessions.keys().next().value);
    while (pendingChallenges.size > MAX_SESSIONS) pendingChallenges.delete(pendingChallenges.keys().next().value);
    while (quotes.size > MAX_SESSIONS * 4) quotes.delete(quotes.keys().next().value);
  }

  async function gate(identity) {
    const expected = subject(identity);
    const payload = await requestJson(new URL('/api/v2/looper/' + expected.tokenId + '/cred', credBase), { fetchImpl, timeoutMs });
    const cred = normalizeCred(payload, expected, clock());
    if (cred.score < minimumScore) {
      throw new ConsoleCreditError('cred_gate_failed', 'CRED ' + cred.score + ' is below the private-beta floor of ' + minimumScore + '.', {
        status: 403, details: { score: cred.score, tier: cred.tier, minimumScore },
      });
    }
    return { ...cred, minimumScore, eligible: true };
  }

  function requireSession(key, expected) {
    sweep();
    const active = sessions.get(key);
    if (!active || active.account !== expected.account) {
      throw new ConsoleCreditError('credifi_login_required', 'Sign this Looper into Credifi before continuing.', { status: 401 });
    }
    return active;
  }

  async function credifi(active, path, options = {}) {
    return requestJson(new URL(path, apiBase), {
      fetchImpl, timeoutMs, method: options.method, body: options.body,
      headers: { authorization: 'Bearer ' + active.token, ...(options.headers ?? {}) },
    });
  }

  async function readBorrowerState(active) {
    const flags = normalizeFlags(await credifi(active, '/api/v3/user/flags?includeEvcAuthorizations=true'));
    const vouchStatus = normalizeVouchStatus(await credifi(active, '/api/vouch/status'), active.account);
    const rawMarkets = normalizeMarkets(await credifi(active, '/api/v2/markets/list'));
    const chains = await credifi(active, '/api/v4/chain/info?all=true');
    const markets = rawMarkets.map((market) => bindMarketPolicy(market, chains));
    const balance = normalizeBalance(await credifi(active, '/api/v2/user-balance'));
    const loans = normalizeLoans(await credifi(active, '/api/v3/loans/list'), active.account);
    return { flags, vouchStatus, markets, balance, loans, chains };
  }

  function findCommitment(state, commitmentId, statuses) {
    const id = boundedId(commitmentId, 'commitment ID');
    const commitment = state.vouchStatus.commitments.find((candidate) => candidate.id === id);
    if (!commitment || !statuses.includes(commitment.status)) {
      throw new ConsoleCreditError('vouch_not_available', 'Vouch ' + id + ' is not ' + statuses.join(' or ') + '.', { status: 409 });
    }
    return commitment;
  }

  function findMarket(state, commitment) {
    const selected = state.markets.find((candidate) => candidate.chainId === commitment.chainId && candidate.marketId === commitment.marketId);
    if (!selected || selected.userAccessible !== true || selected.acceptsNewBorrowers !== true) {
      throw new ConsoleCreditError('market_unavailable', 'The vouch market is not currently available to this Looper.', { status: 409 });
    }
    if (selected.chainId !== BASE_CHAIN_ID || selected.borrowAsset !== 'USDC' || selected.tokenAddress !== BASE_USDC_ADDRESS || selected.decimals !== 6) {
      throw new ConsoleCreditError('market_policy_mismatch', 'This private beta only supports Base USDC in the reviewed Credifi vault.', { status: 409 });
    }
    return selected;
  }

  return Object.freeze({
    async getGate({ identity } = {}) { return gate(identity); },

    async requestLoginChallenge({ sessionKey, identity } = {}) {
      sweep();
      const { key, subject: expected } = keyFor(sessionKey, identity);
      const cred = await gate(expected);
      const endpoint = new URL('/api/auth/wallet-login', apiBase);
      endpoint.searchParams.set('address', getAddress(expected.account));
      endpoint.searchParams.set('chainId', String(BASE_CHAIN_ID));
      const response = await requestJson(endpoint, { fetchImpl, timeoutMs });
      const message = boundedText(response?.message, 'Credifi login message', 1, 8_192);
      const issuedAt = clock();
      validateLoginChallenge(message, expected.account, issuedAt);
      pendingChallenges.set(key, { account: expected.account, message, expiresAt: issuedAt + LOGIN_CHALLENGE_TTL_MS });
      return { schema_version: '0.1.0', account: expected.account, chainId: BASE_CHAIN_ID, message, expiresAt: new Date(issuedAt + LOGIN_CHALLENGE_TTL_MS).toISOString(), cred };
    },

    async verifyLogin({ sessionKey, identity, signature } = {}) {
      sweep();
      const { key, subject: expected } = keyFor(sessionKey, identity);
      const cred = await gate(expected);
      const pending = pendingChallenges.get(key);
      if (!pending || pending.account !== expected.account) throw new ConsoleCreditError('login_challenge_required', 'Request a fresh Credifi login challenge.', { status: 409 });
      const normalizedSignature = boundedHex(signature, 'Credifi login signature', 16_384);
      let response;
      try {
        response = await requestJson(new URL('/api/auth/wallet-login', apiBase), { fetchImpl, timeoutMs, method: 'POST', body: { message: pending.message, signature: normalizedSignature } });
      } finally {
        pendingChallenges.delete(key);
      }
      const token = boundedText(response?.token, 'Credifi bearer token', 16, 16_384);
      const expiresAt = clock() + CREDIFI_SESSION_TTL_MS;
      sessions.set(key, { account: expected.account, token, expiresAt });
      return { schema_version: '0.1.0', authenticated: true, account: expected.account, expiresAt: new Date(expiresAt).toISOString(), cred };
    },

    async getOverview({ sessionKey, identity } = {}) {
      const { key, subject: expected } = keyFor(sessionKey, identity);
      const cred = await gate(expected);
      const active = requireSession(key, expected);
      const state = await readBorrowerState(active);
      return projectOverview(expected, cred, state, indeterminateBorrowers.get(expected.account) ?? null);
    },

    async acceptVouch({ sessionKey, identity, commitmentId } = {}) {
      const { key, subject: expected } = keyFor(sessionKey, identity);
      await gate(expected);
      const active = requireSession(key, expected);
      const id = boundedId(commitmentId, 'commitment ID');
      const actionKey = key + ':' + id;
      if (vouchActions.has(actionKey)) throw new ConsoleCreditError('vouch_action_in_progress', 'This vouch action is already in progress.', { status: 409 });
      vouchActions.add(actionKey);
      try {
        const state = await readBorrowerState(active);
        const offered = findCommitment(state, id, ['offered']);
        if (offered.borrowerWalletAddress !== expected.account || offered.amountMicro !== offered.reservedMicro || offered.reservedMicro <= 0) {
          throw new ConsoleCreditError('vouch_mismatch', 'The offered vouch does not exactly match this Looper.', { status: 409 });
        }
        await credifi(active, '/api/vouch/action', { method: 'POST', body: { commitmentId: offered.id, action: 'accept' } });
        const updated = normalizeVouchStatus(await credifi(active, '/api/vouch/status'), active.account);
        const accepted = updated.commitments.find((candidate) => candidate.id === offered.id && candidate.status === 'accepted');
        if (!accepted) throw new ConsoleCreditError('vouch_acceptance_unconfirmed', 'Credifi has not confirmed this vouch acceptance.', { status: 409 });
        return accepted;
      } finally {
        vouchActions.delete(actionKey);
      }
    },

    async prepareAuthorization({ sessionKey, identity, commitmentId } = {}) {
      const { key, subject: expected } = keyFor(sessionKey, identity);
      await gate(expected);
      const active = requireSession(key, expected);
      const state = await readBorrowerState(active);
      const commitment = findCommitment(state, commitmentId, ['accepted', 'active']);
      const selectedMarket = findMarket(state, commitment);
      const authKey = selectedMarket.chainId + '-' + selectedMarket.vaultId;
      const authorization = state.flags.evcAuthorizations[authKey];
      if (!authorization) throw new ConsoleCreditError('authorization_unavailable', 'Credifi did not return authorization status for this market.', { status: 409 });
      if (authorization.isAuthorized) return { schema_version: '0.1.0', required: false, market: selectedMarket };
      if (!authorization.txnData) throw new ConsoleCreditError('authorization_unavailable', 'Credifi did not return an authorization transaction.', { status: 409 });
      const validated = validateAuthorization({ account: expected.account, market: selectedMarket, txnData: authorization.txnData, chains: state.chains });
      const outerData = encodeFunctionData({ abi: EXECUTE_ABI, functionName: 'execute', args: [validated.evc, 0n, validated.data, 0] });
      const preparedAt = clock();
      return {
        schema_version: '0.1.0', required: true, market: selectedMarket, scope: 'ALL_EVC_SUBACCOUNTS_FOR_WALLET_PREFIX',
        operator: validated.operator, evc: validated.evc, accountPrefix: validated.accountPrefix, operatorBitField: validated.operatorBitField.toString(),
        preparedAt: new Date(preparedAt).toISOString(), expiresAt: new Date(preparedAt + AUTHORIZATION_REVIEW_TTL_MS).toISOString(),
        transaction: { chainId: BASE_CHAIN_ID, from: expected.owner, to: expected.account, value: '0', data: outerData },
      };
    },

    async requestTwoFactor({ sessionKey, identity, channel } = {}) {
      const { key, subject: expected } = keyFor(sessionKey, identity);
      await gate(expected);
      const active = requireSession(key, expected);
      const flags = normalizeFlags(await credifi(active, '/api/v3/user/flags'));
      const selected = boundedText(channel, '2FA channel', 1, 16);
      if (!flags.loanTwoFactorRequired || !flags.loanTwoFactorAvailableChannels.includes(selected)) {
        throw new ConsoleCreditError('two_factor_unavailable', 'That loan verification channel is not available.', { status: 409 });
      }
      await credifi(active, '/api/user/challenge-request', { method: 'POST', body: { channel: selected } });
      return { schema_version: '0.1.0', requested: true, channel: selected };
    },

    async verifyTwoFactor({ sessionKey, identity, code } = {}) {
      const { key, subject: expected } = keyFor(sessionKey, identity);
      await gate(expected);
      const active = requireSession(key, expected);
      const normalized = String(code ?? '').trim();
      if (!/^\d{6}$/u.test(normalized)) throw new ConsoleCreditError('invalid_two_factor_code', 'Enter the new six-digit Credifi code.');
      await credifi(active, '/api/user/challenge-verify', { method: 'POST', body: { code: normalized } });
      return { schema_version: '0.1.0', verified: true };
    },

    async previewLoan({ sessionKey, identity, commitmentId, amount, maxAprPercent } = {}) {
      const { key, subject: expected } = keyFor(sessionKey, identity);
      const cred = await gate(expected);
      const active = requireSession(key, expected);
      if (indeterminateBorrowers.has(expected.account)) {
        throw new ConsoleCreditError('borrow_reconciliation_required', 'A previous borrow result is uncertain. New quotes are blocked until operator reconciliation.', { status: 409 });
      }
      const state = await readBorrowerState(active);
      const commitment = findCommitment(state, commitmentId, ['accepted', 'active']);
      const selectedMarket = findMarket(state, commitment);
      const normalizedAmount = normalizeDollarAmount(amount);
      const aprLimit = normalizeAprLimit(maxAprPercent);
      assertBorrowerEligible({ expected, state, commitment, market: selectedMarket, amount: normalizedAmount, requireAuthorization: true });
      const rawQuote = await credifi(active, '/api/v2/loans/preview-schedule', {
        method: 'POST', body: { amount: normalizedAmount }, headers: marketHeaders(selectedMarket),
      });
      const normalizedQuote = normalizeQuote(rawQuote, { amount: normalizedAmount, maxAprPercent: aprLimit, nowMs: clock() });
      const quoteSha256 = sha256(canonicalJson(normalizedQuote));
      quotes.set(key + ':' + normalizedQuote.quoteId, {
        sessionKey: key, account: expected.account, tokenId: expected.tokenId, commitmentId: commitment.id, market: selectedMarket, amount: normalizedAmount,
        quote: normalizedQuote, quoteSha256, expiresAt: Date.parse(normalizedQuote.quoteExpiresAt), createdAt: clock(), status: 'reviewed',
      });
      return { schema_version: '0.1.0', cred, commitment, market: selectedMarket, quote: normalizedQuote, quoteSha256 };
    },

    async createLoan({ sessionKey, identity, commitmentId, quoteId, quoteSha256, confirmBorrow } = {}) {
      if (confirmBorrow !== true) throw new ConsoleCreditError('borrow_confirmation_required', 'Confirm the reviewed loan before borrowing.');
      const { key, subject: expected } = keyFor(sessionKey, identity);
      await gate(expected);
      const active = requireSession(key, expected);
      const normalizedQuoteId = boundedId(quoteId, 'quote ID');
      const record = quotes.get(key + ':' + normalizedQuoteId);
      if (!record || record.status !== 'reviewed') throw new ConsoleCreditError('quote_consumed', 'Request and review a fresh loan quote.', { status: 409 });
      if (record.account !== expected.account || record.commitmentId !== boundedId(commitmentId, 'commitment ID') || record.quoteSha256 !== String(quoteSha256 ?? '').toLowerCase()) {
        throw new ConsoleCreditError('quote_mismatch', 'The reviewed quote does not match this borrow request.', { status: 409 });
      }
      if (record.expiresAt <= clock()) throw new ConsoleCreditError('quote_expired', 'The reviewed quote expired. Request a fresh quote.', { status: 409 });
      if (indeterminateBorrowers.has(expected.account)) throw new ConsoleCreditError('borrow_reconciliation_required', 'A previous borrow result is uncertain. New borrowing is blocked until operator reconciliation.', { status: 409 });
      record.status = 'submitting';
      let selectedMarket;
      try {
        const state = await readBorrowerState(active);
        const commitment = findCommitment(state, record.commitmentId, ['accepted', 'active']);
        selectedMarket = findMarket(state, commitment);
        if (!sameMarket(selectedMarket, record.market)) throw new ConsoleCreditError('market_changed', 'The vouch market changed. Request a fresh quote.', { status: 409 });
        assertBorrowerEligible({ expected, state, commitment, market: selectedMarket, amount: record.amount, requireAuthorization: true });
      } catch (error) {
        record.status = 'reviewed';
        throw error;
      }
      try {
        const result = await credifi(active, '/api/v4/loans/create', {
          method: 'POST', headers: marketHeaders(selectedMarket),
          body: { amount: record.amount, disburseTo: expected.account, quoteId: record.quote.quoteId },
        });
        const loan = projectLoan(result?.loan ?? result, expected.account, { market: selectedMarket, amount: record.amount, requireBinding: true });
        record.status = 'consumed';
        return { schema_version: '0.1.0', status: 'submitted', loan, rewards: null };
      } catch (error) {
        record.status = 'indeterminate';
        indeterminateBorrowers.set(expected.account, { quoteId: record.quote.quoteId, createdAt: clock() });
        throw new ConsoleCreditError('loan_creation_indeterminate', 'Loan creation was not safely confirmed. New borrowing is blocked pending operator reconciliation.', { status: 502, cause: error });
      }
    },

    revokeSession({ sessionKey, identity } = {}) {
      const { key } = keyFor(sessionKey, identity);
      sessions.delete(key); pendingChallenges.delete(key);
      for (const quoteKey of quotes.keys()) if (quoteKey.startsWith(key + ':')) quotes.delete(quoteKey);
    },

    revokeAll({ sessionKey } = {}) {
      const prefix = normalizeSessionKey(sessionKey) + ':';
      for (const key of sessions.keys()) if (key.startsWith(prefix)) sessions.delete(key);
      for (const key of pendingChallenges.keys()) if (key.startsWith(prefix)) pendingChallenges.delete(key);
      for (const key of quotes.keys()) if (key.startsWith(prefix)) quotes.delete(key);
    },
  });
}

function validateLoginChallenge(message, account, nowMs) {
  const lines = message.replaceAll('\r\n', '\n').split('\n');
  if (lines.length !== 7 || lines[0] !== 'Sign in to Credifi' || lines[1] !== '') throw new ConsoleCreditError('login_challenge_mismatch', 'Credifi returned an unexpected login challenge.', { status: 422 });
  const fields = new Map(lines.slice(2).map((line) => { const separator = line.indexOf(': '); return separator > 0 ? [line.slice(0, separator), line.slice(separator + 2)] : ['', '']; }));
  let signingWallet;
  try { signingWallet = normalizeAddress(fields.get('Signing Wallet'), 'Credifi challenge wallet'); } catch { throw new ConsoleCreditError('login_challenge_mismatch', 'Credifi login challenge is not bound to this Looper.', { status: 422 }); }
  const timestamp = fields.get('Timestamp');
  const timestampMs = Date.parse(String(timestamp ?? ''));
  if (signingWallet !== account || fields.get('Domain') !== 'credi.fi' || fields.get('Chain ID') !== String(BASE_CHAIN_ID)
    || !/^[a-f0-9]{64}$/u.test(String(fields.get('Nonce') ?? '')) || !Number.isFinite(timestampMs)
    || new Date(timestampMs).toISOString() !== timestamp || timestampMs > nowMs + 30_000 || nowMs - timestampMs > LOGIN_CHALLENGE_TTL_MS) {
    throw new ConsoleCreditError('login_challenge_mismatch', 'Credifi login challenge is not bound to this Looper, domain, chain, and fresh nonce.', { status: 422 });
  }
}

function normalizeIdentity(value) {
  if (!isObject(value)) throw new TypeError('Canonical Looper identity is required.');
  const chainId = Number(value.chainId);
  const contract = normalizeAddress(value.contract, 'Looper collection');
  const owner = normalizeAddress(value.owner, 'Looper owner');
  const tokenId = canonicalId(value.tokenId, 'Looper token ID');
  const erc8004AgentId = canonicalId(value.erc8004AgentId, 'ERC-8004 identity ID');
  if (chainId !== BASE_CHAIN_ID || contract !== LOOPERS_COLLECTION || value.controllerVerified !== true) throw new TypeError('Canonical Looper identity is invalid.');
  return { chainId, contract, tokenId, owner, erc8004AgentId, controllerVerified: true };
}

function normalizeCred(payload, expected, nowMs) {
  if (!isObject(payload) || payload.schemaVersion !== 'cred-looper-live-v1' || !isObject(payload.identity)) throw upstreamInvalid('CRED');
  const identity = payload.identity;
  const matches = Number(identity.chainId) === BASE_CHAIN_ID
    && normalizeAddress(identity.collection, 'CRED collection') === LOOPERS_COLLECTION
    && canonicalId(identity.looperTokenId, 'CRED Looper token ID') === expected.tokenId
    && normalizeAddress(identity.account, 'CRED account') === expected.account
    && canonicalId(identity.erc8004IdentityId, 'CRED ERC-8004 identity ID') === expected.erc8004AgentId;
  if (!matches) throw new ConsoleCreditError('cred_subject_mismatch', 'CRED evidence is bound to a different Looper.', { status: 422 });
  const score = boundedInteger(payload.score, 'CRED score', 0, 100);
  const tier = boundedText(payload.tier, 'CRED tier', 1, 32);
  const ratingStatus = boundedText(payload.ratingStatus, 'CRED rating status', 1, 32);
  if (!['PROVISIONAL', 'RATED', 'PUBLISHED'].includes(ratingStatus) || payload.freshness !== 'FRESH') throw new ConsoleCreditError('cred_not_current', 'CRED is not currently eligible for borrowing.', { status: 409 });
  const validUntil = canonicalTimestamp(payload.validUntil, 'CRED validUntil');
  if (Date.parse(validUntil) <= nowMs) throw new ConsoleCreditError('cred_expired', 'CRED evidence expired. Refresh before borrowing.', { status: 409 });
  return { score, tier, ratingStatus, methodologyId: boundedText(payload.methodologyId, 'CRED methodology', 1, 128), computedAt: canonicalTimestamp(payload.computedAt, 'CRED computedAt'), validUntil, freshness: 'FRESH' };
}

function normalizeFlags(value) {
  if (!isObject(value)) throw upstreamInvalid('Credifi flags');
  const minimumLoanAmount = Number(value.minimumLoanAmount);
  if (![5, 100].includes(minimumLoanAmount) || typeof value.loanTwoFactorRequired !== 'boolean') throw upstreamInvalid('Credifi flags');
  const channels = Array.isArray(value.loanTwoFactorAvailableChannels) ? value.loanTwoFactorAvailableChannels.map(String).filter((entry) => ['email', 'sms'].includes(entry)) : [];
  const evcAuthorizations = {};
  if (isObject(value.evcAuthorizations)) {
    for (const [key, entry] of Object.entries(value.evcAuthorizations).slice(0, 100)) {
      if (!/^[0-9]+-[A-Za-z0-9._:-]{1,128}$/u.test(key) || !isObject(entry) || typeof entry.isAuthorized !== 'boolean') continue;
      evcAuthorizations[key] = { isAuthorized: entry.isAuthorized, ...(entry.txnData ? { txnData: normalizeTxnData(entry.txnData) } : {}) };
    }
  }
  return { minimumLoanAmount, loanTwoFactorRequired: value.loanTwoFactorRequired, loanTwoFactorAvailableChannels: [...new Set(channels)], smartWallet: isObject(value.smartWallet) ? { status: String(value.smartWallet.status ?? '') } : null, blockBorrowReason: value.blockBorrowReason == null ? null : boundedText(value.blockBorrowReason, 'Credifi borrow block', 1, 256), evcAuthorizations };
}

function normalizeTxnData(value) {
  if (!isObject(value)) throw upstreamInvalid('Credifi authorization transaction');
  return { to: normalizeAddress(value.to, 'authorization target'), data: boundedHex(value.data, 'authorization calldata', 65_536), value: canonicalUint(value.value, 'authorization value').toString() };
}

function normalizeVouchStatus(value, account) {
  if (!isObject(value) || typeof value.enabled !== 'boolean' || !Array.isArray(value.commitments) || value.commitments.length > 100) throw upstreamInvalid('Credifi vouch status');
  return { enabled: value.enabled, earnedMicro: safeNonnegativeInteger(value.earnedMicro ?? 0, 'earnedMicro'), commitments: value.commitments.map((entry) => normalizeCommitment(entry, account)) };
}

function normalizeCommitment(value, account) {
  if (!isObject(value)) throw upstreamInvalid('Credifi commitment');
  const borrowerWalletAddress = normalizeAddress(value.borrowerWalletAddress, 'vouch borrower');
  if (borrowerWalletAddress !== account) throw new ConsoleCreditError('vouch_recipient_mismatch', 'Credifi returned a vouch for another wallet.', { status: 422 });
  return {
    id: boundedId(value.id, 'commitment ID'), status: boundedText(value.status, 'commitment status', 1, 32),
    sponsorWalletAddress: normalizeAddress(value.sponsorWalletAddress, 'vouch sponsor'), borrowerWalletAddress,
    amountMicro: safeNonnegativeInteger(value.amountMicro, 'vouch amountMicro'), reservedMicro: safeNonnegativeInteger(value.reservedMicro, 'vouch reservedMicro'), remainingMicro: safeNonnegativeInteger(value.remainingMicro, 'vouch remainingMicro'),
    chainId: boundedInteger(value.chainId, 'vouch chain ID', 1, Number.MAX_SAFE_INTEGER), marketId: boundedId(value.marketId, 'vouch market ID'),
  };
}

function normalizeMarkets(value) {
  if (!isObject(value) || !Array.isArray(value.markets) || value.markets.length > 100) throw upstreamInvalid('Credifi markets');
  return value.markets.map((entry) => {
    if (!isObject(entry)) throw upstreamInvalid('Credifi market');
    return { chainId: boundedInteger(entry.chainId, 'market chain ID', 1, Number.MAX_SAFE_INTEGER), marketId: boundedId(entry.marketId, 'market ID'), vaultId: boundedId(entry.vaultId, 'vault ID'), userAccessible: entry.userAccessible === true, acceptsNewBorrowers: entry.acceptsNewBorrowers === true, ...(entry.availableLiquidity == null ? {} : { availableLiquidity: String(entry.availableLiquidity) }) };
  });
}

function bindMarketPolicy(market, chains) {
  if (!isObject(chains)) throw upstreamInvalid('Credifi chain configuration');
  const chain = chains[String(market.chainId)];
  if (!isObject(chain) || !Array.isArray(chain.vaults)) throw upstreamInvalid('Credifi chain configuration');
  const vault = chain.vaults.find((candidate) => candidate?.id === market.vaultId);
  if (!isObject(vault)) throw upstreamInvalid('Credifi vault configuration');
  const borrowAsset = boundedText(vault.borrowAsset, 'Credifi borrow asset', 1, 32).toUpperCase();
  const assetEntries = vault.addresses?.[borrowAsset];
  if (!Array.isArray(assetEntries) || assetEntries.length === 0) throw upstreamInvalid('Credifi borrow asset configuration');
  const asset = assetEntries.at(-1);
  const symbol = boundedText(asset?.symbol, 'Credifi borrow asset symbol', 1, 32).toUpperCase();
  const decimals = boundedInteger(asset?.decimals, 'Credifi borrow asset decimals', 0, 36);
  return { ...market, borrowAsset, tokenAddress: normalizeAddress(asset?.address, 'Credifi borrow asset address'), symbol, decimals };
}

function sameMarket(left, right) {
  return left.chainId === right.chainId && left.marketId === right.marketId && left.vaultId === right.vaultId
    && left.borrowAsset === right.borrowAsset && left.tokenAddress === right.tokenAddress && left.decimals === right.decimals;
}

function normalizeBalance(value) {
  if (!isObject(value) || !isObject(value.credit)) throw upstreamInvalid('Credifi balance');
  return { credit: { availableCredit: safeNonnegativeInteger(value.credit.availableCredit, 'availableCredit'), totalCreditLimit: safeNonnegativeInteger(value.credit.totalCreditLimit, 'totalCreditLimit'), currentUsage: safeNonnegativeInteger(value.credit.currentUsage, 'currentUsage') } };
}

function normalizeLoans(value, account) {
  const rows = Array.isArray(value) ? value : value?.loans;
  if (!Array.isArray(rows) || rows.length > 100) throw upstreamInvalid('Credifi loans');
  return rows.map((entry) => projectLoan(entry, account));
}

function projectLoan(value, account, expected = {}) {
  if (!isObject(value)) throw upstreamInvalid('Credifi loan');
  const disbursement = isObject(value.disbursement) ? {
    chainId: value.disbursement.chainId == null ? null : Number(value.disbursement.chainId),
    marketId: value.disbursement.marketId == null ? null : boundedId(value.disbursement.marketId, 'loan disbursement market ID'),
    loanOwner: value.disbursement.loanOwner == null ? null : normalizeAddress(value.disbursement.loanOwner, 'loan owner'),
    blockchainLoanId: value.disbursement.blockchainLoanId == null ? null : boundedId(value.disbursement.blockchainLoanId, 'blockchain loan ID'),
    tokenAddress: value.disbursement.tokenAddress == null ? null : normalizeAddress(value.disbursement.tokenAddress, 'loan token'),
    transactionHash: value.disbursement.transactionHash == null ? null : boundedHex(value.disbursement.transactionHash, 'disbursement transaction hash', 66),
  } : null;
  const disburseTo = value.disburseTo == null ? null : normalizeAddress(value.disburseTo, 'loan recipient');
  const recipients = [disburseTo, disbursement?.loanOwner].filter(Boolean);
  if (account && recipients.some((recipient) => recipient !== account)) throw new ConsoleCreditError('loan_recipient_mismatch', 'Credifi returned a loan for another wallet.', { status: 422 });
  const amount = value.amount == null ? null : finiteNonnegativeNumber(value.amount, 'loan amount');
  const marketId = value.marketId == null ? disbursement?.marketId ?? null : boundedId(value.marketId, 'loan market ID');
  if (expected.requireBinding) {
    if (recipients.length === 0 || amount !== expected.amount || marketId !== expected.market.marketId || disbursement?.chainId !== expected.market.chainId
      || disbursement?.marketId !== expected.market.marketId || disbursement?.tokenAddress !== expected.market.tokenAddress) {
      throw new ConsoleCreditError('loan_binding_unconfirmed', 'Credifi did not prove the created loan is bound to the reviewed Looper, market, and asset.', { status: 422 });
    }
  }
  return { id: boundedId(value.id, 'loan ID'), status: boundedText(value.status, 'loan status', 1, 64), amount, remainingBalance: value.remainingBalance == null ? null : finiteNonnegativeNumber(value.remainingBalance, 'loan remaining balance'), marketId, disbursement, payments: Array.isArray(value.payments) ? value.payments.slice(0, 100).map(safeClone) : [] };
}

function projectOverview(expected, cred, state, indeterminateBorrow = null) {
  const evcAuthorizations = Object.fromEntries(Object.entries(state.flags.evcAuthorizations).map(([key, value]) => [key, { isAuthorized: value.isAuthorized }]));
  const flags = { ...state.flags, evcAuthorizations };
  const borrowing = indeterminateBorrow
    ? { status: 'RECONCILIATION_REQUIRED', quoteId: indeterminateBorrow.quoteId, since: new Date(indeterminateBorrow.createdAt).toISOString() }
    : { status: 'READY' };
  return { schema_version: '0.1.0', account: expected.account, tokenId: expected.tokenId, erc8004AgentId: expected.erc8004AgentId, cred, borrowing, flags, commitments: state.vouchStatus.commitments, vouch: { enabled: state.vouchStatus.enabled, earnedMicro: state.vouchStatus.earnedMicro }, markets: state.markets, balance: state.balance, loans: state.loans };
}

function validateAuthorization({ account, market, txnData, chains }) {
  if (!isObject(chains)) throw upstreamInvalid('Credifi chain configuration');
  const chain = chains[String(market.chainId)];
  if (!isObject(chain) || !Array.isArray(chain.vaults)) throw upstreamInvalid('Credifi chain configuration');
  const vault = chain.vaults.find((candidate) => candidate?.id === market.vaultId);
  if (!isObject(vault)) throw upstreamInvalid('Credifi vault configuration');
  const evc = latestConfiguredAddress(chain.addresses?.EVC, 'EVC');
  const operator = latestConfiguredAddress(vault.addresses?.CREDIFI_ADAPTOR ?? chain.addresses?.CREDIFI_ADAPTOR, 'Credifi adaptor');
  if (normalizeAddress(txnData.to, 'authorization target') !== evc || canonicalUint(txnData.value, 'authorization value') !== 0n) throw new ConsoleCreditError('authorization_policy_mismatch', 'Credifi authorization target or value is outside policy.', { status: 422 });
  let decoded;
  try { decoded = decodeFunctionData({ abi: EVC_ABI, data: txnData.data }); } catch { throw new ConsoleCreditError('authorization_policy_mismatch', 'Credifi authorization calldata is not setOperator.', { status: 422 }); }
  const [accountPrefix, decodedOperator, operatorBitField] = decoded.args;
  const expectedPrefix = account.slice(0, 40);
  if (decoded.functionName !== 'setOperator' || String(accountPrefix).toLowerCase() !== expectedPrefix || normalizeAddress(decodedOperator, 'authorization operator') !== operator || operatorBitField !== MAX_UINT256) {
    throw new ConsoleCreditError('authorization_policy_mismatch', 'Credifi authorization scope does not match the reviewed wallet-wide operator grant.', { status: 422 });
  }
  const canonicalData = encodeFunctionData({ abi: EVC_ABI, functionName: 'setOperator', args: [accountPrefix, decodedOperator, operatorBitField] });
  if (canonicalData.toLowerCase() !== txnData.data.toLowerCase()) {
    throw new ConsoleCreditError('authorization_policy_mismatch', 'Credifi authorization calldata is not canonical.', { status: 422 });
  }
  return { evc, operator, accountPrefix: expectedPrefix, operatorBitField, data: canonicalData };
}

function latestConfiguredAddress(entries, label) {
  if (!Array.isArray(entries) || entries.length === 0) throw upstreamInvalid(label + ' configuration');
  const latest = entries.at(-1);
  return normalizeAddress(latest?.address, label);
}

function assertBorrowerEligible({ expected, state, commitment, market, amount, requireAuthorization }) {
  if (state.flags.blockBorrowReason) throw new ConsoleCreditError('borrowing_blocked', state.flags.blockBorrowReason, { status: 409 });
  if (state.flags.smartWallet && !['approved', 'active', 'verified', 'supported'].includes(state.flags.smartWallet.status.toLowerCase())) throw new ConsoleCreditError('smart_wallet_blocked', 'Credifi has not approved this smart wallet for borrowing.', { status: 409 });
  if (commitment.borrowerWalletAddress !== expected.account) throw new ConsoleCreditError('vouch_recipient_mismatch', 'The vouch belongs to another wallet.', { status: 409 });
  const amountMicro = Math.round(amount * 1_000_000);
  if (amount < state.flags.minimumLoanAmount || amountMicro > commitment.remainingMicro) throw new ConsoleCreditError('amount_outside_credit', 'The amount is outside this vouch and account limit.', { status: 409 });
  if (market.chainId !== commitment.chainId || market.marketId !== commitment.marketId) throw new ConsoleCreditError('market_mismatch', 'The selected market does not match the vouch.', { status: 409 });
  if (state.flags.loanTwoFactorRequired) throw new ConsoleCreditError('two_factor_required', 'Complete Credifi loan verification before requesting a quote.', { status: 409, details: { channels: state.flags.loanTwoFactorAvailableChannels } });
  if (requireAuthorization) {
    const authorization = state.flags.evcAuthorizations[market.chainId + '-' + market.vaultId];
    if (!authorization?.isAuthorized) throw new ConsoleCreditError('evc_authorization_required', 'Authorize this Looper for the Credifi market before requesting a quote.', { status: 409 });
  }
}

function normalizeQuote(value, { amount, maxAprPercent, nowMs }) {
  if (!isObject(value) || !isObject(value.loan) || !isObject(value.fee) || !Array.isArray(value.paymentSchedule) || value.paymentSchedule.length > 100) throw upstreamInvalid('Credifi quote');
  const quoteId = boundedId(value.quoteId, 'quote ID');
  const quoteExpiresAt = canonicalTimestamp(value.quoteExpiresAt, 'quote expiry');
  if (Date.parse(quoteExpiresAt) <= nowMs) throw new ConsoleCreditError('quote_expired', 'Credifi returned an expired quote.', { status: 409 });
  const interestRate = Number(value.loan.interestRate);
  if (!Number.isFinite(interestRate) || interestRate < 0 || interestRate > maxAprPercent) throw new ConsoleCreditError('apr_policy_failed', 'Quoted APR exceeds the ' + maxAprPercent + '% owner limit.', { status: 409 });
  const feeMicro = safeNonnegativeInteger(value.fee.feeMicro, 'quote feeMicro');
  if (feeMicro !== 0) throw new ConsoleCreditError('origination_fee_policy_failed', 'This flow only accepts a zero origination fee.', { status: 409 });
  const quotedAmount = Number(value.loan.amount ?? amount);
  if (quotedAmount !== amount) throw new ConsoleCreditError('quote_amount_mismatch', 'Credifi quote amount does not match the request.', { status: 422 });
  const principalMicro = safeNonnegativeInteger(value.fee.principalMicro, 'quote principalMicro');
  const netProceedsMicro = safeNonnegativeInteger(value.fee.netProceedsMicro, 'quote netProceedsMicro');
  const expectedPrincipalMicro = moneyToMicro(amount, 'quote principal');
  if (principalMicro !== expectedPrincipalMicro || netProceedsMicro !== expectedPrincipalMicro) throw new ConsoleCreditError('quote_amount_mismatch', 'Credifi quote principal or proceeds do not match the request.', { status: 422 });
  const totalRepayment = finiteNonnegativeNumber(value.loan.totalRepayment, 'quote total repayment');
  const termDays = boundedInteger(value.loan.loanTerms?.termDays, 'quote term days', 1, 3_650);
  const repaymentType = boundedText(value.loan.loanTerms?.repaymentType, 'quote repayment type', 1, 32);
  const paymentSchedule = value.paymentSchedule.map((item) => {
    if (!isObject(item)) throw upstreamInvalid('Credifi quote payment schedule');
    return { dueDate: canonicalTimestamp(item.dueDate, 'quote payment due date'), amount: finiteNonnegativeNumber(item.amount, 'quote payment amount') };
  });
  const installments = value.scheduleInfo?.installments == null ? paymentSchedule.length : boundedInteger(value.scheduleInfo.installments, 'quote installments', 1, 100);
  const scheduledMicro = paymentSchedule.reduce((total, item) => total + moneyToMicro(item.amount, 'quote payment amount'), 0);
  if (installments !== paymentSchedule.length || scheduledMicro !== moneyToMicro(totalRepayment, 'quote total repayment')) throw new ConsoleCreditError('quote_schedule_mismatch', 'Credifi quote schedule does not match its total repayment.', { status: 422 });
  return { quoteId, quoteExpiresAt, fee: { feeMicro, principalMicro, netProceedsMicro }, loan: { amount: quotedAmount, interestRate, totalRepayment, loanTerms: { termDays, repaymentType } }, paymentSchedule, scheduleInfo: { installments } };
}

function marketHeaders(market) { return { 'x-chain-id': String(market.chainId), 'x-market-id': market.marketId }; }

async function requestJson(url, { fetchImpl, timeoutMs, method = 'GET', body, headers = {} }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetchImpl(url, { method, redirect: 'error', signal: controller.signal, headers: { accept: 'application/json', ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  } catch (error) {
    const code = error?.name === 'AbortError' ? 'upstream_timeout' : 'upstream_unavailable';
    throw new ConsoleCreditError(code, code === 'upstream_timeout' ? 'Credit provider request timed out.' : 'Credit provider is unavailable.', { status: code === 'upstream_timeout' ? 504 : 503, cause: error });
  } finally { clearTimeout(timer); }
  const text = await readBoundedResponse(response, MAX_RESPONSE_BYTES);
  let payload = null;
  if (text.trim()) { try { payload = JSON.parse(text); } catch { throw upstreamInvalid('credit provider'); } }
  if (!response.ok) {
    const status = response.status >= 400 && response.status <= 599 ? response.status : 502;
    const projection = status === 401
      ? ['credifi_session_expired', 'Credifi rejected the server-side session. Sign this Looper in again.']
      : status === 429
        ? ['credit_provider_rate_limited', 'Credifi temporarily rate limited this request.']
        : status >= 500
          ? ['credit_provider_unavailable', 'Credifi could not complete the request.']
          : ['credit_provider_rejected', 'Credifi rejected the request. Refresh borrower state before retrying.'];
    throw new ConsoleCreditError(projection[0], projection[1], { status });
  }
  return payload;
}

async function readBoundedResponse(response, maxBytes) {
  const declared = response.headers.get('content-length');
  if (declared && Number(declared) > maxBytes) throw new ConsoleCreditError('upstream_response_too_large', 'Credit provider response exceeded the safety limit.', { status: 502 });
  if (!response.body) return '';
  const reader = response.body.getReader(); const chunks = []; let total = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; total += value.byteLength; if (total > maxBytes) { await reader.cancel().catch(() => {}); throw new ConsoleCreditError('upstream_response_too_large', 'Credit provider response exceeded the safety limit.', { status: 502 }); } chunks.push(value); }
  const merged = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(merged); } catch { throw upstreamInvalid('credit provider'); }
}

function normalizeBaseUrl(value, label) {
  let url; try { url = new URL(String(value)); } catch { throw new TypeError(label + ' is invalid.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new TypeError(label + ' must be a credential-free HTTPS URL.');
  url.pathname = url.pathname.replace(/\/*$/u, '/'); return url;
}
function normalizeSessionKey(value) { return boundedText(value, 'Console credit session key', 8, 256); }
function canonicalId(value, label) { const text = String(value ?? ''); if (!/^[1-9]\d*$/u.test(text)) throw new TypeError(label + ' is invalid.'); return text; }
function boundedId(value, label) { const text = boundedText(value, label, 1, 128); if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(text)) throw new ConsoleCreditError('invalid_request', label + ' is invalid.'); return text; }
function normalizeAddress(value, label) { try { return getAddress(String(value)).toLowerCase(); } catch { throw new ConsoleCreditError('invalid_response', label + ' is invalid.', { status: 502 }); } }
function boundedText(value, label, min, max) { const text = String(value ?? '').trim(); if (text.length < min || text.length > max) throw new ConsoleCreditError('invalid_response', label + ' is invalid.', { status: 502 }); return text; }
function boundedOptionalText(value) { if (value == null) return null; const text = String(value).trim(); return text ? text.slice(0, 512) : null; }
function boundedHex(value, label, maxLength) { const text = String(value ?? ''); if (!/^0x[0-9a-fA-F]+$/u.test(text) || text.length > maxLength || text.length % 2 !== 0) throw new ConsoleCreditError('invalid_request', label + ' is invalid.'); return text; }
function canonicalUint(value, label) { try { const result = BigInt(value); if (result < 0n || result > MAX_UINT256) throw new Error(); return result; } catch { throw new ConsoleCreditError('invalid_response', label + ' is invalid.', { status: 502 }); } }
function canonicalTimestamp(value, label) { const text = String(value ?? ''); const time = Date.parse(text); if (!Number.isFinite(time) || new Date(time).toISOString() !== text) throw new ConsoleCreditError('invalid_response', label + ' is invalid.', { status: 502 }); return text; }
function boundedInteger(value, label, min, max) { const number = Number(value); if (!Number.isInteger(number) || number < min || number > max) throw new TypeError(label + ' is invalid.'); return number; }
function safeNonnegativeInteger(value, label) { const number = Number(value); if (!Number.isSafeInteger(number) || number < 0) throw upstreamInvalid(label); return number; }
function finiteNonnegativeNumber(value, label) { const number = Number(value); if (!Number.isFinite(number) || number < 0) throw upstreamInvalid(label); return number; }
function moneyToMicro(value, label) { const number = finiteNonnegativeNumber(value, label); const micro = Math.round(number * 1_000_000); if (!Number.isSafeInteger(micro) || Math.abs(number * 1_000_000 - micro) > 1e-6) throw upstreamInvalid(label); return micro; }
function normalizeDollarAmount(value) { const number = Number(value); if (!Number.isFinite(number) || number <= 0 || number > 1_000_000 || Math.abs(number * 100 - Math.round(number * 100)) > 1e-7) throw new ConsoleCreditError('invalid_amount', 'Loan amount must be a positive dollar amount with at most two decimals.'); return number; }
function normalizeAprLimit(value) { const number = Number(value); if (!Number.isFinite(number) || number <= 0 || number > 100) throw new ConsoleCreditError('invalid_apr_limit', 'Maximum APR must be between 0 and 100.'); return number; }
function isObject(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function stableCode(value) { return /^[A-Za-z][A-Za-z0-9_]{0,127}$/u.test(String(value ?? '')); }
function upstreamInvalid(label) { return new ConsoleCreditError('invalid_response', label + ' returned an invalid response.', { status: 502 }); }
function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function canonicalJson(value) { if (value === null || typeof value !== 'object') return JSON.stringify(value); if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']'; return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + canonicalJson(value[key])).join(',') + '}'; }
function safeClone(value) { if (value === undefined) return null; return JSON.parse(JSON.stringify(value)); }
