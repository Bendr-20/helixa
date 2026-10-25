'use strict';

const { AbiCoder, concat, getCreate2Address, keccak256 } = require('ethers');

const BASE_CHAIN_ID = '8453';
const MAX_LOOPER_TOKEN_ID = 7_777n;
const METHODOLOGY_ID = 'cred-looper-provisional-1.1.0';
const MAX_CACHE_TTL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 5_000;
const MAX_RPC_RESPONSE_BYTES = 512 * 1024;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 250;
const MIN_PROVIDER_INTERVAL_MS = 250;
const MIN_CONFIRMATIONS = 20n;
const ALLOWED_RPC_METHODS = Object.freeze(new Set(['eth_chainId', 'eth_blockNumber', 'eth_getBlockByNumber', 'eth_getCode', 'eth_call', 'eth_getTransactionReceipt', 'eth_getTransactionByHash']));
const PROVIDERS = Object.freeze([
  Object.freeze({ id: 'base_mainnet', url: 'https://mainnet.base.org' }),
  Object.freeze({ id: 'base_drpc', url: 'https://base.drpc.org' }),
]);
const COLLECTION = '0x1649cd37f4748807b4882fc48765ba0b2affa94a';
const ERC6551_REGISTRY = '0x000000006551c19487814612e58fe06813775758';
const ACCOUNT_SALT = '0xff28549509272e76f1d1c6ef7d6976d848c5ff6cb5068b2183c8d52f4cbe2bee';
const RELEASED_ACCOUNT_IMPLEMENTATION = '0xf192f350427c8f58bc28e78b1e6af164279f486e';
const CREATION_PREFIX = '0x3d60ad80600a3d3981f3';
const RUNTIME_PREFIX = '0x363d3d373d3d3d363d73';
const RUNTIME_SUFFIX = '0x5af43d82803e903d91602b57fd5bf3';
const PANTHEON = Object.freeze({ cred: '0xab3f23c2abcb4e12cc8b593c218a7ba64ed17ba3', vault: '0xbf52aaf8b6c82fad0220b5378022ea4fc0a98fdb' });
const PILOT = Object.freeze({
  tokenId: '2431', chainId: BASE_CHAIN_ID, collection: COLLECTION,
  account: '0xee37097c267ceb22b553e0e947d19c5ce4ba696c',
  controller: '0xd31fcdb0432d3c9bf9d98643f69c7edd690e48e8',
  erc8004IdentityId: '89144', pantheon: PANTHEON,
  credifi: Object.freeze({ loanId: '6ad91af4f2300494c59b5717', repaymentTxHash: '0x5cb476dae5925a8ba90a1348d98a296e96e7a445ae9c05e09b91ed5747a23dfc' }),
});
const SELECTORS = Object.freeze({ owner: '0x8da5cb5b', token: '0xfc0c546a', ownerOf: '0x6352211e', pools: '0xa4063dbc', stakes: '0xa4e47b66' });

class UnsupportedLooperError extends Error {
  constructor(message = 'Looper does not have a verified activated released account') {
    super(message); this.name = 'UnsupportedLooperError'; this.code = 'UNSUPPORTED_LOOPER'; this.statusCode = 404;
  }
}

function normalizeLooperId(value) {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d*)$/u.test(value)) throw new TypeError('Looper ID must be an exact canonical string');
  const tokenId = BigInt(value);
  if (tokenId < 1n || tokenId > MAX_LOOPER_TOKEN_ID) throw new RangeError('Looper ID is outside the collection range');
  return tokenId;
}
function releasedFooter(tokenId) {
  return AbiCoder.defaultAbiCoder().encode(['bytes32', 'uint256', 'address', 'uint256'], [ACCOUNT_SALT, BigInt(BASE_CHAIN_ID), COLLECTION, tokenId]);
}
function buildReleasedLooperAccountRuntime(value) {
  const tokenId = normalizeLooperId(String(value));
  return concat([RUNTIME_PREFIX, RELEASED_ACCOUNT_IMPLEMENTATION, RUNTIME_SUFFIX, releasedFooter(tokenId)]).toLowerCase();
}
function deriveReleasedLooperAccount(value) {
  const tokenId = normalizeLooperId(String(value));
  const creationCode = concat([CREATION_PREFIX, RUNTIME_PREFIX, RELEASED_ACCOUNT_IMPLEMENTATION, RUNTIME_SUFFIX, releasedFooter(tokenId)]);
  return getCreate2Address(ERC6551_REGISTRY, ACCOUNT_SALT, keccak256(creationCode)).toLowerCase();
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function canonicalQuantity(value, label) {
  if (typeof value !== 'string' || !/^0x(?:0|[1-9a-f][0-9a-f]*)$/u.test(value)) throw new TypeError(label + ' must be a canonical RPC quantity');
  return BigInt(value);
}
function canonicalData(value, label, bytes = null) {
  if (typeof value !== 'string' || !/^0x(?:[0-9a-f]{2})*$/u.test(value)) throw new TypeError(label + ' must be lowercase even-length RPC data');
  if (bytes !== null && value.length !== 2 + bytes * 2) throw new TypeError(label + ' must encode exactly ' + bytes + ' bytes');
  return value;
}
function canonicalAddress(value, label) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{40}$/u.test(value)) throw new TypeError(label + ' must be an EVM address');
  return value.toLowerCase();
}
function decodeAddressWord(value, label) {
  canonicalData(value, label, 32);
  if (!/^0x0{24}[0-9a-f]{40}$/u.test(value)) throw new TypeError(label + ' is not an ABI address word');
  return '0x' + value.slice(-40);
}
function decodeWords(value, count, label) {
  canonicalData(value, label, count * 32);
  return Array.from({ length: count }, (_, index) => BigInt('0x' + value.slice(2 + index * 64, 66 + index * 64)));
}
function decodeBoolean(value, label) {
  if (value !== 0n && value !== 1n) throw new TypeError(label + ' must be an ABI boolean');
  return value === 1n;
}
function addressArgument(value) { return value.slice(2).padStart(64, '0'); }
function uintArgument(value) { return BigInt(value).toString(16).padStart(64, '0'); }
function blockTag(value) { return '0x' + value.toString(16); }

async function boundedResponseBody(response) {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_RPC_RESPONSE_BYTES) throw new RangeError('RPC response exceeds size bound');
  if (!response.body) {
    const text = await response.text();
    if (Buffer.byteLength(text) > MAX_RPC_RESPONSE_BYTES) throw new RangeError('RPC response exceeds size bound');
    return text;
  }
  const reader = response.body.getReader(); const chunks = []; let total = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    total += value.byteLength;
    if (total > MAX_RPC_RESPONSE_BYTES) { await reader.cancel(); throw new RangeError('RPC response exceeds size bound'); }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total).toString('utf8');
}
async function defaultRpc(provider, method, params, { fetchImpl = globalThis.fetch, sleepImpl = sleep } = {}) {
  if (!PROVIDERS.includes(provider)) throw new TypeError('RPC provider must be an exact pinned provider object');
  if (!ALLOWED_RPC_METHODS.has(method)) throw new TypeError('RPC method is not read-only allowlisted');
  if (!Array.isArray(params)) throw new TypeError('RPC params must be an array');
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetchImpl(provider.url, { method: 'POST', redirect: 'error', credentials: 'omit', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: controller.signal });
      if (response.redirected || !response.ok) {
        const error = new Error('RPC HTTP ' + response.status);
        error.statusCode = response.status;
        throw error;
      }
      const text = await boundedResponseBody(response); let envelope;
      try { envelope = JSON.parse(text); } catch { throw new SyntaxError('RPC returned invalid JSON'); }
      if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope) || envelope.jsonrpc !== '2.0' || envelope.id !== 1 || Object.hasOwn(envelope, 'error') || !Object.hasOwn(envelope, 'result')) throw new Error('RPC returned invalid JSON-RPC envelope');
      return envelope.result;
    } catch (error) {
      lastError = error;
      if (error instanceof RangeError || error instanceof SyntaxError || attempt === MAX_RETRIES) throw error;
      await sleepImpl(RETRY_BASE_DELAY_MS * (2 ** attempt));
    } finally { clearTimeout(timer); }
  }
  throw lastError;
}

function createPacedRpc({ rpc = defaultRpc, now = Date.now, sleepImpl = sleep, minIntervalMs = MIN_PROVIDER_INTERVAL_MS } = {}) {
  if (typeof rpc !== 'function') throw new TypeError('rpc must be a function');
  if (typeof now !== 'function') throw new TypeError('now must be a function');
  if (typeof sleepImpl !== 'function') throw new TypeError('sleepImpl must be a function');
  if (!Number.isInteger(minIntervalMs) || minIntervalMs < 1 || minIntervalMs > 5_000) throw new RangeError('minIntervalMs must be between 1 and 5000');
  const tails = new Map();
  const nextStarts = new Map();
  return async function pacedRpc(provider, method, params) {
    if (!PROVIDERS.includes(provider)) throw new TypeError('RPC provider must be an exact pinned provider object');
    const key = provider.id;
    const prior = tails.get(key) ?? Promise.resolve();
    const task = prior.catch(() => {}).then(async () => {
      const waitMs = Math.max(0, (nextStarts.get(key) ?? 0) - now());
      if (waitMs > 0) await sleepImpl(waitMs);
      nextStarts.set(key, now() + minIntervalMs);
      return rpc(provider, method, params);
    });
    tails.set(key, task);
    task.finally(() => { if (tails.get(key) === task) tails.delete(key); }).catch(() => {});
    return task;
  };
}
function normalizeBlock(value, expectedNumber) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('block response is malformed');
  const number = canonicalQuantity(value.number, 'block.number');
  if (number !== expectedNumber) throw new Error('provider returned wrong common block');
  if (typeof value.hash !== 'string' || !/^0x[0-9a-f]{64}$/u.test(value.hash)) throw new TypeError('block.hash is malformed');
  const timestamp = canonicalQuantity(value.timestamp, 'block.timestamp');
  if (timestamp > BigInt(Math.floor(Number.MAX_SAFE_INTEGER / 1000))) throw new RangeError('block timestamp is out of range');
  return { number: number.toString(), hash: value.hash, timestamp: new Date(Number(timestamp) * 1000).toISOString(), timestampSeconds: timestamp };
}
function normalizeReceipt(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('repayment receipt is unavailable');
  return { transactionHash: String(value.transactionHash || '').toLowerCase(), status: value.status, blockNumber: canonicalQuantity(value.blockNumber, 'receipt.blockNumber').toString(), blockHash: String(value.blockHash || '').toLowerCase(), from: canonicalAddress(value.from, 'receipt.from'), to: canonicalAddress(value.to, 'receipt.to') };
}
function normalizeTransaction(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('repayment transaction is unavailable');
  return { hash: String(value.hash || '').toLowerCase(), blockNumber: canonicalQuantity(value.blockNumber, 'transaction.blockNumber').toString(), blockHash: String(value.blockHash || '').toLowerCase(), from: canonicalAddress(value.from, 'transaction.from'), to: canonicalAddress(value.to, 'transaction.to') };
}
function assertSame(left, right, label) { if (left !== right) throw new Error('provider disagreement for ' + label); return left; }
function assertSameObject(left, right, label) {
  const canonical = value => JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item);
  if (canonical(left) !== canonical(right)) throw new Error('provider disagreement for ' + label);
  return left;
}

async function collectCredifiEvidence(rpc, commonNumber, account, controller) {
  const receiptValues = await Promise.all(PROVIDERS.map(provider => rpc(provider, 'eth_getTransactionReceipt', [PILOT.credifi.repaymentTxHash])));
  const receipt = assertSameObject(...receiptValues.map(normalizeReceipt), 'repayment receipt');
  const transactionValues = await Promise.all(PROVIDERS.map(provider => rpc(provider, 'eth_getTransactionByHash', [PILOT.credifi.repaymentTxHash])));
  const transaction = assertSameObject(...transactionValues.map(normalizeTransaction), 'repayment transaction');
  if (receipt.transactionHash !== PILOT.credifi.repaymentTxHash || transaction.hash !== PILOT.credifi.repaymentTxHash) throw new Error('repayment transaction hash is misbound');
  if (receipt.status !== '0x1') throw new Error('Credifi repayment receipt did not succeed');
  if (receipt.to !== account || transaction.to !== account || receipt.from !== controller || transaction.from !== controller) throw new Error('Credifi repayment identity binding does not match');
  if (receipt.blockNumber !== transaction.blockNumber || receipt.blockHash !== transaction.blockHash || BigInt(receipt.blockNumber) > commonNumber) throw new Error('Credifi repayment receipt and transaction disagree');
  return { receiptBlockNumber: receipt.blockNumber, receiptBlockHash: receipt.blockHash, recipient: receipt.to, actor: receipt.from, succeeded: true };
}

async function collectEvidence(rpc, tokenIdText) {
  const tokenId = normalizeLooperId(tokenIdText); const account = deriveReleasedLooperAccount(tokenIdText);
  const chainIds = await Promise.all(PROVIDERS.map(provider => rpc(provider, 'eth_chainId', [])));
  if (chainIds.some(value => value !== '0x2105')) throw new Error('both providers must report exact Base chain ID 8453');
  const heads = await Promise.all(PROVIDERS.map(provider => rpc(provider, 'eth_blockNumber', []))).then(values => values.map((value, index) => canonicalQuantity(value, 'provider ' + index + ' head')));
  const lowestHead = heads[0] < heads[1] ? heads[0] : heads[1];
  if (lowestHead < MIN_CONFIRMATIONS) throw new Error('provider head is below the minimum confirmation depth');
  const commonNumber = lowestHead - MIN_CONFIRMATIONS; const tag = blockTag(commonNumber);
  const blocks = await Promise.all(PROVIDERS.map(provider => rpc(provider, 'eth_getBlockByNumber', [tag, false]))).then(values => values.map(value => normalizeBlock(value, commonNumber)));
  const block = assertSameObject(blocks[0], blocks[1], 'common block');
  const calls = {
    code: provider => rpc(provider, 'eth_getCode', [account, tag]),
    owner: provider => rpc(provider, 'eth_call', [{ to: account, data: SELECTORS.owner }, tag]),
    token: provider => rpc(provider, 'eth_call', [{ to: account, data: SELECTORS.token }, tag]),
    ownerOf: provider => rpc(provider, 'eth_call', [{ to: COLLECTION, data: SELECTORS.ownerOf + uintArgument(tokenId) }, tag]),
    pool: provider => rpc(provider, 'eth_call', [{ to: PANTHEON.vault, data: SELECTORS.pools + addressArgument(PANTHEON.cred) }, tag]),
    stake: provider => rpc(provider, 'eth_call', [{ to: PANTHEON.vault, data: SELECTORS.stakes + addressArgument(account) + addressArgument(PANTHEON.cred) }, tag]),
  };
  const agreed = Object.fromEntries(await Promise.all(Object.entries(calls).map(async ([label, operation]) => {
    const values = await Promise.all(PROVIDERS.map(operation));
    return [label, assertSame(values[0], values[1], label)];
  })));
  const code = canonicalData(agreed.code, 'account code');
  if (code === '0x') throw new UnsupportedLooperError();
  if (code !== buildReleasedLooperAccountRuntime(tokenIdText)) throw new Error('Looper account runtime does not match the released account');
  const owner = decodeAddressWord(agreed.owner, 'owner()');
  const nftOwner = decodeAddressWord(agreed.ownerOf, 'ownerOf()');
  if (owner !== nftOwner) throw new Error('Looper account owner does not match current NFT owner');
  const tokenWords = decodeWords(agreed.token, 3, 'token()');
  const tokenCollection = decodeAddressWord('0x' + agreed.token.slice(66, 130), 'token() collection');
  if (tokenWords[0].toString() !== BASE_CHAIN_ID || tokenCollection !== COLLECTION || tokenWords[2] !== tokenId) throw new Error('token binding does not match the requested Looper identity');
  const poolWords = decodeWords(agreed.pool, 3, 'Pantheon pools(CRED)');
  const poolActive = decodeBoolean(poolWords[0], 'Pantheon pool active');
  if (!poolActive || poolWords[1] !== 0n) throw new Error('Pantheon pool configuration is not eligible');
  const stakeWords = decodeWords(agreed.stake, 9, 'Pantheon stakes(account,CRED)');
  if (stakeWords[0] > 0n && stakeWords[4] > block.timestampSeconds) throw new Error('position stake time is later than the common block');
  const activePosition = stakeWords[0] > 0n && stakeWords[5] === 0n && stakeWords[6] === 0n;
  const position = {
    amount: stakeWords[0].toString(), autoRestake: decodeBoolean(stakeWords[1], 'position.autoRestake'), lockMonths: stakeWords[2].toString(), lockDuration: stakeWords[3].toString(),
    stakeTime: stakeWords[4] === 0n ? null : new Date(Number(stakeWords[4]) * 1000).toISOString(),
    unstakeRequestTime: stakeWords[5].toString(), unstakeTime: stakeWords[6].toString(), stakeMonthIndex: stakeWords[7].toString(), compounderEnabled: decodeBoolean(stakeWords[8], 'position.compounderEnabled'), active: activePosition,
  };
  const credifi = tokenIdText === PILOT.tokenId ? await collectCredifiEvidence(rpc, commonNumber, account, owner) : null;
  return {
    tokenId: tokenIdText, account, owner, activePosition,
    block: { number: block.number, hash: block.hash, timestamp: block.timestamp },
    identity: { accountCodeNonempty: true, releasedRuntimeVerified: true, owner, nftOwner, tokenBinding: { chainId: BASE_CHAIN_ID, collection: COLLECTION, tokenId: tokenIdText } },
    pantheon: { vault: PANTHEON.vault, cred: PANTHEON.cred, pool: { active: poolActive, cliffMonths: poolWords[1].toString(), totalStaked: poolWords[2].toString() }, position },
    credifi, providers: PROVIDERS.map(provider => ({ id: provider.id, url: provider.url })),
  };
}

function buildRecord(evidence, computedAtMs, ttlMs) {
  const reasons = ['LOOPER_RELEASED_ACCOUNT_IDENTITY_VERIFIED_ACTIVATED'];
  const components = [{ component: 'verifiedActivatedBaseline', scoreImpact: 40, reasonCode: reasons[0] }];
  if (evidence.activePosition) { reasons.push('PANTHEON_ACTIVE_CRED_POSITION'); components.push({ component: 'pantheonActiveCredPosition', scoreImpact: 2, reasonCode: 'PANTHEON_ACTIVE_CRED_POSITION' }); }
  const observations = [];
  if (evidence.credifi) {
    reasons.push('CREDIFI_REPAYMENT_TX_OBSERVED_PENDING_PROVIDER_ATTESTATION');
    observations.push({ category: 'Financial Reliability', loanId: PILOT.credifi.loanId, repaymentTxHash: PILOT.credifi.repaymentTxHash, recipient: evidence.account, actor: evidence.owner, receiptStatus: 'TRANSACTION_SUCCEEDED', providerAttributionStatus: 'PENDING_PROVIDER_ATTESTATION', scoreImpact: 0, reasonCode: 'CREDIFI_REPAYMENT_TX_OBSERVED_PENDING_PROVIDER_ATTESTATION' });
  }
  const score = components.reduce((sum, item) => sum + item.scoreImpact, 0); const computedAt = new Date(computedAtMs).toISOString();
  return {
    schemaVersion: 'cred-looper-live-v1',
    identity: { subjectId: 'looper:' + BASE_CHAIN_ID + ':' + COLLECTION + ':' + evidence.tokenId, looperTokenId: evidence.tokenId, chainId: BASE_CHAIN_ID, collection: COLLECTION, account: evidence.account, erc8004IdentityId: evidence.tokenId === PILOT.tokenId ? PILOT.erc8004IdentityId : null },
    actorEpoch: { actorEpochId: 'looper:' + evidence.tokenId + ':controller:' + evidence.owner + ':live-v1', controller: evidence.owner, startedAt: null, startTimeStatus: 'NOT_ASSERTED_BY_LIVE_ENDPOINT' },
    methodologyId: METHODOLOGY_ID, ratingStatus: 'PROVISIONAL', score, tier: 'Marginal', effectivePrivilegeTier: null, confidence: null, coverage: null,
    reasonCodes: reasons, scoreComponents: components, observations,
    evidence: { block: evidence.block, identity: evidence.identity, pantheon: evidence.pantheon, ...(evidence.credifi ? { credifi: evidence.credifi } : {}), providers: evidence.providers },
    computedAt, validUntil: new Date(computedAtMs + ttlMs).toISOString(), freshness: 'FRESH',
  };
}

function createLooperCredService({ rpc = createPacedRpc(), now = Date.now, cacheTtlMs = MAX_CACHE_TTL_MS, maxConcurrent = 8 } = {}) {
  if (typeof rpc !== 'function') throw new TypeError('rpc must be a function');
  if (typeof now !== 'function') throw new TypeError('now must be a function');
  if (!Number.isInteger(cacheTtlMs) || cacheTtlMs < 1 || cacheTtlMs > MAX_CACHE_TTL_MS) throw new RangeError('cacheTtlMs must be between 1 and 60000');
  if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1 || maxConcurrent > 32) throw new RangeError('maxConcurrent must be between 1 and 32');
  const cache = new Map(); const inFlight = new Map(); let active = 0;
  return Object.freeze({ async getByLooperId(id) {
    normalizeLooperId(id); const requestTime = now(); const cached = cache.get(id);
    if (cached && requestTime < cached.expiresAt) return cached.record;
    if (cached) cache.delete(id);
    if (inFlight.has(id)) return inFlight.get(id);
    if (active >= maxConcurrent) throw new Error('Looper CRED evidence service is busy');
    active += 1;
    const pending = collectEvidence(rpc, id).then(evidence => {
      const completedAt = now(); const record = buildRecord(evidence, completedAt, cacheTtlMs);
      cache.set(id, { record, expiresAt: completedAt + cacheTtlMs });
      while (cache.size > 512) cache.delete(cache.keys().next().value);
      return record;
    }).finally(() => { inFlight.delete(id); active -= 1; });
    inFlight.set(id, pending);
    return pending;
  } });
}

module.exports = Object.freeze({ BASE_CHAIN_ID, MAX_LOOPER_TOKEN_ID, METHODOLOGY_ID, MAX_CACHE_TTL_MS, REQUEST_TIMEOUT_MS, MAX_RPC_RESPONSE_BYTES, MIN_CONFIRMATIONS, ALLOWED_RPC_METHODS, PROVIDERS, COLLECTION, PANTHEON, PILOT, SELECTORS, UnsupportedLooperError, deriveReleasedLooperAccount, buildReleasedLooperAccountRuntime, defaultRpc, createPacedRpc, createLooperCredService });
