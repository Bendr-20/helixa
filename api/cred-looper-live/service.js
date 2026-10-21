'use strict';

const BASE_CHAIN_ID = '8453';
const METHODOLOGY_ID = 'cred-looper-provisional-1.0.0';
const MAX_CACHE_TTL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 5_000;
const MAX_RPC_RESPONSE_BYTES = 512 * 1024;
const MAX_RETRIES = 1;
const MIN_CONFIRMATIONS = 20n;
const ALLOWED_RPC_METHODS = Object.freeze(new Set([
  'eth_chainId',
  'eth_blockNumber',
  'eth_getBlockByNumber',
  'eth_getCode',
  'eth_call',
  'eth_getTransactionReceipt',
  'eth_getTransactionByHash',
]));
const PROVIDERS = Object.freeze([
  Object.freeze({ id: 'base_mainnet', url: 'https://mainnet.base.org' }),
  Object.freeze({ id: 'base_drpc', url: 'https://base.drpc.org' }),
]);
const PILOT_OPENED_AFTER = '2026-10-21T20:34:03.000Z';
const PILOT = Object.freeze({
  tokenId: '2431',
  chainId: BASE_CHAIN_ID,
  collection: '0x1649cd37f4748807b4882fc48765ba0b2affa94a',
  account: '0xee37097c267ceb22b553e0e947d19c5ce4ba696c',
  controller: '0xd31fcdb0432d3c9bf9d98643f69c7edd690e48e8',
  erc8004IdentityId: '89144',
  actorEpochId: 'looper:2431:controller:0xd31fcdb0432d3c9bf9d98643f69c7edd690e48e8:pilot-v1',
  pantheon: Object.freeze({
    cred: '0xab3f23c2abcb4e12cc8b593c218a7ba64ed17ba3',
    vault: '0xbf52aaf8b6c82fad0220b5378022ea4fc0a98fdb',
  }),
  credifi: Object.freeze({
    loanId: '6ad91af4f2300494c59b5717',
    repaymentTxHash: '0x5cb476dae5925a8ba90a1348d98a296e96e7a445ae9c05e09b91ed5747a23dfc',
  }),
});
const SELECTORS = Object.freeze({
  owner: '0x8da5cb5b',
  token: '0xfc0c546a',
  pools: '0xa4063dbc',
  stakes: '0xa4e47b66',
});

class UnsupportedLooperError extends Error {
  constructor() {
    super('Looper is not in the closed live CRED pilot registry');
    this.name = 'UnsupportedLooperError';
    this.code = 'UNSUPPORTED_LOOPER';
    this.statusCode = 404;
  }
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function canonicalQuantity(value, label) {
  if (typeof value !== 'string' || !/^0x(?:0|[1-9a-f][0-9a-f]*)$/u.test(value)) {
    throw new TypeError(`${label} must be a canonical RPC quantity`);
  }
  return BigInt(value);
}
function canonicalData(value, label, bytes = null) {
  if (typeof value !== 'string' || !/^0x(?:[0-9a-f]{2})*$/u.test(value)) {
    throw new TypeError(`${label} must be lowercase even-length RPC data`);
  }
  if (bytes !== null && value.length !== 2 + bytes * 2) {
    throw new TypeError(`${label} must encode exactly ${bytes} bytes`);
  }
  return value;
}
function canonicalAddress(value, label) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{40}$/u.test(value)) {
    throw new TypeError(`${label} must be an EVM address`);
  }
  return value.toLowerCase();
}
function decodeAddressWord(value, label) {
  canonicalData(value, label, 32);
  if (!/^0x0{24}[0-9a-f]{40}$/u.test(value)) throw new TypeError(`${label} is not an ABI address word`);
  return `0x${value.slice(-40)}`;
}
function decodeWords(value, count, label) {
  canonicalData(value, label, count * 32);
  return Array.from({ length: count }, (_, index) => BigInt(`0x${value.slice(2 + index * 64, 66 + index * 64)}`));
}
function decodeBoolean(value, label) {
  if (value !== 0n && value !== 1n) throw new TypeError(`${label} must be an ABI boolean`);
  return value === 1n;
}
function addressArgument(value) { return value.slice(2).padStart(64, '0'); }
function blockTag(value) { return `0x${value.toString(16)}`; }

async function boundedResponseBody(response) {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_RPC_RESPONSE_BYTES) throw new RangeError('RPC response exceeds size bound');
  if (!response.body) {
    const text = await response.text();
    if (Buffer.byteLength(text) > MAX_RPC_RESPONSE_BYTES) throw new RangeError('RPC response exceeds size bound');
    return text;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RPC_RESPONSE_BYTES) {
      await reader.cancel();
      throw new RangeError('RPC response exceeds size bound');
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total).toString('utf8');
}

async function defaultRpc(provider, method, params, { fetchImpl = globalThis.fetch } = {}) {
  if (!PROVIDERS.includes(provider)) throw new TypeError('RPC provider must be an exact pinned provider object');
  if (!ALLOWED_RPC_METHODS.has(method)) throw new TypeError('RPC method is not read-only allowlisted');
  if (!Array.isArray(params)) throw new TypeError('RPC params must be an array');
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetchImpl(provider.url, {
        method: 'POST',
        redirect: 'error',
        credentials: 'omit',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: controller.signal,
      });
      if (response.redirected || !response.ok) throw new Error(`RPC HTTP ${response.status}`);
      const text = await boundedResponseBody(response);
      let envelope;
      try { envelope = JSON.parse(text); } catch { throw new SyntaxError('RPC returned invalid JSON'); }
      if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope) || envelope.jsonrpc !== '2.0' || envelope.id !== 1 || Object.hasOwn(envelope, 'error') || !Object.hasOwn(envelope, 'result')) {
        throw new Error('RPC returned invalid JSON-RPC envelope');
      }
      return envelope.result;
    } catch (error) {
      lastError = error;
      if (error instanceof RangeError || error instanceof SyntaxError || attempt === MAX_RETRIES) throw error;
      await sleep(150);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

function normalizeBlock(value, expectedNumber) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('block response is malformed');
  const number = canonicalQuantity(value.number, 'block.number');
  if (number !== expectedNumber) throw new Error('provider returned wrong common block');
  if (typeof value.hash !== 'string' || !/^0x[0-9a-f]{64}$/u.test(value.hash)) throw new TypeError('block.hash is malformed');
  const timestamp = canonicalQuantity(value.timestamp, 'block.timestamp');
  if (timestamp > BigInt(Math.floor(Number.MAX_SAFE_INTEGER / 1000))) throw new RangeError('block timestamp is out of range');
  return {
    number: number.toString(),
    hash: value.hash,
    timestamp: new Date(Number(timestamp) * 1000).toISOString(),
    timestampSeconds: timestamp,
  };
}
function normalizeReceipt(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('repayment receipt is unavailable');
  return {
    transactionHash: String(value.transactionHash || '').toLowerCase(),
    status: value.status,
    blockNumber: canonicalQuantity(value.blockNumber, 'receipt.blockNumber').toString(),
    blockHash: String(value.blockHash || '').toLowerCase(),
    from: canonicalAddress(value.from, 'receipt.from'),
    to: canonicalAddress(value.to, 'receipt.to'),
  };
}
function normalizeTransaction(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('repayment transaction is unavailable');
  return {
    hash: String(value.hash || '').toLowerCase(),
    blockNumber: canonicalQuantity(value.blockNumber, 'transaction.blockNumber').toString(),
    blockHash: String(value.blockHash || '').toLowerCase(),
    from: canonicalAddress(value.from, 'transaction.from'),
    to: canonicalAddress(value.to, 'transaction.to'),
  };
}
function assertSame(left, right, label) {
  if (left !== right) throw new Error(`provider disagreement for ${label}`);
  return left;
}
function assertSameObject(left, right, label) {
  const canonical = value => JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item);
  if (canonical(left) !== canonical(right)) throw new Error(`provider disagreement for ${label}`);
  return left;
}

async function collectEvidence(rpc) {
  const chainIds = await Promise.all(PROVIDERS.map(provider => rpc(provider, 'eth_chainId', [])));
  if (chainIds.some(value => value !== '0x2105')) throw new Error('both providers must report exact Base chain ID 8453');
  const heads = await Promise.all(PROVIDERS.map(provider => rpc(provider, 'eth_blockNumber', []))).then(values => values.map((value, index) => canonicalQuantity(value, `provider ${index} head`)));
  const lowestHead = heads[0] < heads[1] ? heads[0] : heads[1];
  if (lowestHead < MIN_CONFIRMATIONS) throw new Error('provider head is below the minimum confirmation depth');
  const commonNumber = lowestHead - MIN_CONFIRMATIONS;
  const tag = blockTag(commonNumber);
  const blocks = await Promise.all(PROVIDERS.map(provider => rpc(provider, 'eth_getBlockByNumber', [tag, false]))).then(values => values.map(value => normalizeBlock(value, commonNumber)));
  const block = assertSameObject(blocks[0], blocks[1], 'common block');

  const accountCalls = {
    code: provider => rpc(provider, 'eth_getCode', [PILOT.account, tag]),
    owner: provider => rpc(provider, 'eth_call', [{ to: PILOT.account, data: SELECTORS.owner }, tag]),
    token: provider => rpc(provider, 'eth_call', [{ to: PILOT.account, data: SELECTORS.token }, tag]),
    pool: provider => rpc(provider, 'eth_call', [{ to: PILOT.pantheon.vault, data: SELECTORS.pools + addressArgument(PILOT.pantheon.cred) }, tag]),
    stake: provider => rpc(provider, 'eth_call', [{ to: PILOT.pantheon.vault, data: SELECTORS.stakes + addressArgument(PILOT.account) + addressArgument(PILOT.pantheon.cred) }, tag]),
  };
  const agreed = {};
  for (const [label, operation] of Object.entries(accountCalls)) {
    const values = await Promise.all(PROVIDERS.map(operation));
    agreed[label] = assertSame(values[0], values[1], label);
  }

  const code = canonicalData(agreed.code, 'account code');
  if (code === '0x') throw new Error('Looper account code is empty');
  const owner = decodeAddressWord(agreed.owner, 'owner()');
  if (owner !== PILOT.controller) throw new Error('owner() does not match the pilot controller');
  const tokenWords = decodeWords(agreed.token, 3, 'token()');
  const tokenCollection = decodeAddressWord(`0x${agreed.token.slice(66, 130)}`, 'token() collection');
  if (tokenWords[0].toString() !== PILOT.chainId || tokenCollection !== PILOT.collection || tokenWords[2].toString() !== PILOT.tokenId) {
    throw new Error('token binding does not match the exact pilot identity');
  }

  const poolWords = decodeWords(agreed.pool, 3, 'Pantheon pools(CRED)');
  const poolActive = decodeBoolean(poolWords[0], 'Pantheon pool active');
  if (!poolActive) throw new Error('Pantheon pool is not active');
  if (poolWords[1] !== 0n) throw new Error('Pantheon pool cliffMonths drifted from zero');

  const stakeWords = decodeWords(agreed.stake, 9, 'Pantheon stakes(account,CRED)');
  const position = {
    amount: stakeWords[0].toString(),
    autoRestake: decodeBoolean(stakeWords[1], 'position.autoRestake'),
    lockMonths: stakeWords[2].toString(),
    lockDuration: stakeWords[3].toString(),
    stakeTime: new Date(Number(stakeWords[4]) * 1000).toISOString(),
    unstakeRequestTime: stakeWords[5].toString(),
    unstakeTime: stakeWords[6].toString(),
    stakeMonthIndex: stakeWords[7].toString(),
    compounderEnabled: decodeBoolean(stakeWords[8], 'position.compounderEnabled'),
  };
  const openingThreshold = BigInt(Math.floor(Date.parse(PILOT_OPENED_AFTER) / 1000));
  if (stakeWords[0] <= 0n || stakeWords[2] !== 6n || stakeWords[3] <= 0n) throw new Error('position is not an active six-month Pantheon term');
  if (stakeWords[4] < openingThreshold) throw new Error(`position was not opened after ${PILOT_OPENED_AFTER}`);
  if (stakeWords[4] > block.timestampSeconds) throw new Error('position stake time is later than the common block');
  if (stakeWords[5] !== 0n) throw new Error('position has an exit request');
  if (stakeWords[6] !== 0n) throw new Error('position has already exited');

  const receiptValues = await Promise.all(PROVIDERS.map(provider => rpc(provider, 'eth_getTransactionReceipt', [PILOT.credifi.repaymentTxHash])));
  const receipts = receiptValues.map(normalizeReceipt);
  const receipt = assertSameObject(receipts[0], receipts[1], 'repayment receipt');
  const transactionValues = await Promise.all(PROVIDERS.map(provider => rpc(provider, 'eth_getTransactionByHash', [PILOT.credifi.repaymentTxHash])));
  const transactions = transactionValues.map(normalizeTransaction);
  const transaction = assertSameObject(transactions[0], transactions[1], 'repayment transaction');
  if (receipt.transactionHash !== PILOT.credifi.repaymentTxHash || transaction.hash !== PILOT.credifi.repaymentTxHash) throw new Error('repayment transaction hash is misbound');
  if (receipt.status !== '0x1') throw new Error('Credifi repayment receipt did not succeed');
  if (receipt.to !== PILOT.account || transaction.to !== PILOT.account || receipt.to !== transaction.to) throw new Error('Credifi repayment recipient does not match the pilot account');
  if (receipt.from !== PILOT.controller || transaction.from !== PILOT.controller || receipt.from !== transaction.from) throw new Error('Credifi repayment actor does not match the pilot controller');
  if (receipt.blockNumber !== transaction.blockNumber || receipt.blockHash !== transaction.blockHash) throw new Error('Credifi repayment receipt and transaction disagree');
  if (BigInt(receipt.blockNumber) > commonNumber) throw new Error('Credifi repayment is newer than the common evidence block');

  return {
    block: { number: block.number, hash: block.hash, timestamp: block.timestamp },
    identity: { accountCodeNonempty: true, owner, tokenBinding: { chainId: PILOT.chainId, collection: PILOT.collection, tokenId: PILOT.tokenId } },
    pantheon: {
      vault: PILOT.pantheon.vault,
      cred: PILOT.pantheon.cred,
      pool: { active: poolActive, cliffMonths: poolWords[1].toString(), totalStaked: poolWords[2].toString() },
      position,
    },
    credifi: { receiptBlockNumber: receipt.blockNumber, receiptBlockHash: receipt.blockHash, recipient: receipt.to, actor: receipt.from, succeeded: true },
    providers: PROVIDERS.map(provider => ({ id: provider.id, url: provider.url })),
  };
}

function buildRecord(evidence, computedAtMs, ttlMs) {
  const computedAt = new Date(computedAtMs).toISOString();
  return {
    schemaVersion: 'cred-looper-live-v1',
    identity: {
      subjectId: `looper:${PILOT.chainId}:${PILOT.collection}:${PILOT.tokenId}`,
      looperTokenId: PILOT.tokenId,
      chainId: PILOT.chainId,
      collection: PILOT.collection,
      account: PILOT.account,
      erc8004IdentityId: PILOT.erc8004IdentityId,
    },
    actorEpoch: {
      actorEpochId: PILOT.actorEpochId,
      controller: PILOT.controller,
      startedAt: null,
      startTimeStatus: 'NOT_ASSERTED_BY_LIVE_PILOT',
    },
    methodologyId: METHODOLOGY_ID,
    ratingStatus: 'PROVISIONAL',
    score: 42,
    tier: 'Marginal',
    effectivePrivilegeTier: null,
    confidence: null,
    coverage: null,
    reasonCodes: [
      'LOOPER_CLOSED_PILOT_IDENTITY_VERIFIED_ACTIVATED',
      'PANTHEON_SIX_MONTH_POSITION_OPENED',
      'CREDIFI_REPAYMENT_TX_OBSERVED_PENDING_PROVIDER_ATTESTATION',
    ],
    scoreComponents: [
      { component: 'verifiedActivatedBaseline', scoreImpact: 40, reasonCode: 'LOOPER_CLOSED_PILOT_IDENTITY_VERIFIED_ACTIVATED' },
      { component: 'pantheonSixMonthPositionOpened', scoreImpact: 2, reasonCode: 'PANTHEON_SIX_MONTH_POSITION_OPENED' },
    ],
    observations: [{
      category: 'Financial Reliability',
      loanId: PILOT.credifi.loanId,
      repaymentTxHash: PILOT.credifi.repaymentTxHash,
      recipient: PILOT.account,
      actor: PILOT.controller,
      receiptStatus: 'TRANSACTION_SUCCEEDED',
      providerAttributionStatus: 'PENDING_PROVIDER_ATTESTATION',
      scoreImpact: 0,
      reasonCode: 'CREDIFI_REPAYMENT_TX_OBSERVED_PENDING_PROVIDER_ATTESTATION',
    }],
    evidence,
    computedAt,
    validUntil: new Date(computedAtMs + ttlMs).toISOString(),
    freshness: 'FRESH',
  };
}

function createLooperCredService({ rpc = defaultRpc, now = Date.now, cacheTtlMs = MAX_CACHE_TTL_MS } = {}) {
  if (typeof rpc !== 'function') throw new TypeError('rpc must be a function');
  if (typeof now !== 'function') throw new TypeError('now must be a function');
  if (!Number.isInteger(cacheTtlMs) || cacheTtlMs < 1 || cacheTtlMs > MAX_CACHE_TTL_MS) throw new RangeError('cacheTtlMs must be between 1 and 60000');
  let cache = null;
  let inFlight = null;
  return Object.freeze({
    async getByLooperId(id) {
      if (typeof id !== 'string' || !/^(?:0|[1-9]\d*)$/u.test(id)) throw new TypeError('Looper ID must be an exact canonical string');
      if (id !== PILOT.tokenId) throw new UnsupportedLooperError();
      const requestTime = now();
      if (cache && requestTime < cache.expiresAt) return cache.record;
      if (!inFlight) {
        inFlight = collectEvidence(rpc).then(evidence => {
          const completedAt = now();
          const record = buildRecord(evidence, completedAt, cacheTtlMs);
          cache = { record, expiresAt: completedAt + cacheTtlMs };
          return record;
        }).finally(() => { inFlight = null; });
      }
      return inFlight;
    },
  });
}

module.exports = Object.freeze({
  BASE_CHAIN_ID,
  METHODOLOGY_ID,
  MAX_CACHE_TTL_MS,
  REQUEST_TIMEOUT_MS,
  MAX_RPC_RESPONSE_BYTES,
  MIN_CONFIRMATIONS,
  ALLOWED_RPC_METHODS,
  PROVIDERS,
  PILOT,
  SELECTORS,
  UnsupportedLooperError,
  defaultRpc,
  createLooperCredService,
});
