import { createHash } from 'node:crypto';

import { decodeFunctionResult, encodeFunctionData } from 'viem';

import { readBoundedFileBytes, readBoundedResponseBytes } from './bounded-io.js';
import {
  BASE_CHAIN_ID,
  CRED_ADDRESS,
  CRED_PAIR_ID,
  MAX_DECODED_BYTES,
  MAX_RESPONSE_BYTES,
  MAX_ROSTER_BYTES,
  MULTICALL3,
  PANTHEON_STAKES_ABI,
  PANTHEON_STAKING_VAULT,
  computeTotalUsdE8,
  deriveChecksummedLooperAccount,
  loadWalletValueQuotes,
  parseWalletValueRoster,
  validateWalletValueSnapshot,
} from './looper-wallet-value-contract.js';

export const PINNED_BASE_RPC_ORIGINS = Object.freeze(['https://base-rpc.publicnode.com/', 'https://base.drpc.org/']);
export const MULTICALL_GET_ETH_BALANCE_ABI = Object.freeze([{ type: 'function', name: 'getEthBalance', stateMutability: 'view', inputs: [{ name: 'addr', type: 'address' }], outputs: [{ name: 'balance', type: 'uint256' }] }]);
export const ERC20_BALANCE_ABI = Object.freeze([{ type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: 'balance', type: 'uint256' }] }]);
export const MULTICALL3_ABI = Object.freeze([{ type: 'function', name: 'aggregate3', stateMutability: 'payable', inputs: [{ name: 'calls', type: 'tuple[]', components: [{ name: 'target', type: 'address' }, { name: 'allowFailure', type: 'bool' }, { name: 'callData', type: 'bytes' }] }], outputs: [{ name: 'returnData', type: 'tuple[]', components: [{ name: 'success', type: 'bool' }, { name: 'returnData', type: 'bytes' }] }] }]);

const BLOCK_HASH = /^0x[0-9a-f]{64}$/u;
const QUANTITY = /^0x(?:0|[1-9a-f][0-9a-f]*)$/u;
const INNER_CALLS_PER_BATCH = 192;
const ROWS_PER_BATCH = INNER_CALLS_PER_BATCH / 3;
const UNAVAILABLE_BODY = new TextEncoder().encode(JSON.stringify({ error: { code: 'wallet_values_unavailable', message: 'Looper wallet values are temporarily unavailable.' } }));

export function createLooperWalletValueRefresher({
  rosterPath,
  fetchImpl = globalThis.fetch,
  providers = PINNED_BASE_RPC_ORIGINS,
  rpcImpl,
  quoteLoader = loadWalletValueQuotes,
  now = Date.now,
  requestTimeoutMs = 8_000,
  refreshTimeoutMs = 30_000,
} = {}) {
  if (typeof rosterPath !== 'string' || !rosterPath) throw new TypeError('Looper wallet-value roster path is required.');
  if (typeof fetchImpl !== 'function' || typeof quoteLoader !== 'function' || typeof now !== 'function') throw new TypeError('Looper wallet-value dependencies are unavailable.');
  if (!Array.isArray(providers) || providers.length !== 2 || new Set(providers).size !== 2) throw new TypeError('Two distinct Base RPC providers are required.');
  const requestTimeout = boundedMs(requestTimeoutMs, 1, 30_000, 'request timeout');
  const refreshTimeout = boundedMs(refreshTimeoutMs, requestTimeout, 60_000, 'refresh timeout');
  const rpc = rpcImpl ?? createRpcTransport({ fetchImpl, requestTimeoutMs: requestTimeout });

  return async function refreshLooperWalletValues({ signal } = {}) {
    const timeout = AbortSignal.timeout(refreshTimeout);
    const refreshSignal = signal && typeof AbortSignal.any === 'function' ? AbortSignal.any([signal, timeout]) : (signal ?? timeout);
    let decodedBytes = 0;
    const call = async (provider, method, params) => {
      if (refreshSignal.aborted) throw abortError(refreshSignal);
      const response = await raceAbort(Promise.resolve().then(() => rpc(provider, method, params, refreshSignal)), refreshSignal);
      if (!response || !Object.hasOwn(response, 'result') || !Number.isSafeInteger(response.bytes) || response.bytes < 0) throw new Error('Base provider response is malformed.');
      decodedBytes += response.bytes;
      if (decodedBytes > MAX_DECODED_BYTES) throw new Error('Wallet-value decoded data exceeds limit.');
      return response.result;
    };

    const rosterBytes = await readBoundedFileBytes(rosterPath, { maxBytes: MAX_ROSTER_BYTES, signal: refreshSignal });
    const roster = parseWalletValueRoster(rosterBytes);
    const heads = await Promise.all(providers.map((provider) => call(provider, 'eth_getBlockByNumber', ['latest', false])));
    const blockNumber = Math.min(...heads.map((head) => Number(parseQuantity(head?.number, 'Base head'))));
    if (!Number.isSafeInteger(blockNumber) || blockNumber < 1) throw new Error('Base head is malformed.');
    const blockTag = '0x' + blockNumber.toString(16);
    const anchors = await Promise.all(providers.map((provider) => call(provider, 'eth_getBlockByNumber', [blockTag, false])));
    const anchor = normalizeBlock(anchors[0], blockNumber);
    if (anchors.slice(1).some((value) => !sameBlock(anchor, normalizeBlock(value, blockNumber)))) throw new Error('Base providers disagree on wallet-value block.');

    const entries = roster.tokenIds.map((tokenId) => ({ tokenId, account: deriveChecksummedLooperAccount(tokenId) }));
    const chunks = [];
    for (let offset = 0; offset < entries.length; offset += ROWS_PER_BATCH) chunks.push(entries.slice(offset, offset + ROWS_PER_BATCH));
    const providerRows = await Promise.all(providers.map((provider) => mapLimited(chunks, 2, (chunk) => readChunk({ provider, chunk, blockTag, call }))));
    const rowsByProvider = providerRows.map((chunksForProvider) => chunksForProvider.flat());
    if (JSON.stringify(rowsByProvider[0]) !== JSON.stringify(rowsByProvider[1])) throw new Error('Base providers disagree on wallet values.');

    const confirmations = await Promise.all(providers.map((provider) => call(provider, 'eth_getBlockByNumber', [blockTag, false])));
    if (confirmations.some((value) => !sameBlock(anchor, normalizeBlock(value, blockNumber)))) throw new Error('Pinned Base wallet-value block changed during refresh.');

    let quotes = null;
    try { quotes = await quoteLoader({ fetchImpl, signal: refreshSignal, now }); } catch { quotes = null; }
    const generatedMs = normalizeNow(now());
    const rows = rowsByProvider[0].map((row) => row.status === 'unavailable' ? row : ({
      ...row,
      total_usd_e8: quotes ? computeTotalUsdE8({
        ethWei: row.eth_wei,
        liquidCredBaseUnits: row.liquid_cred_base_units,
        stakedCredBaseUnits: row.staked_cred_base_units,
        ethPriceUsdE8: quotes.eth.priceUsdE8,
        credPriceUsdE8: quotes.cred.priceUsdE8,
      }) : null,
    }));
    const snapshot = {
      schema_version: '1.0.0',
      chain_id: BASE_CHAIN_ID,
      status: 'fresh',
      valuation_status: quotes ? 'available' : 'unavailable',
      roster: { sha256: roster.rawSha256, count: roster.count, observed_block: roster.observedBlock, observed_at: roster.observedAt },
      block: { number: blockNumber, hash: anchor.hash, observed_at: new Date(anchor.timestamp * 1_000).toISOString() },
      generated_at: new Date(generatedMs).toISOString(),
      fresh_until: new Date(generatedMs + 300_000).toISOString(),
      stale_until: new Date(generatedMs + 900_000).toISOString(),
      quotes: quotes ? {
        eth: { asset: 'ETH', source: 'coinbase', price_usd_e8: quotes.eth.priceUsdE8, observed_at: quotes.eth.observedAt },
        cred: { asset: 'CRED', contract: CRED_ADDRESS, source: 'dexscreener-uniswap-base', pool_id: CRED_PAIR_ID, price_usd_e8: quotes.cred.priceUsdE8, observed_at: quotes.cred.observedAt },
      } : null,
      rows,
    };
    validateWalletValueSnapshot(snapshot, roster);
    return snapshot;
  };
}

export function createLooperWalletValuesLoader({ refresh, now = Date.now } = {}) {
  if (typeof refresh !== 'function' || typeof now !== 'function') throw new TypeError('Wallet-value cache dependencies are unavailable.');
  let cached = null;
  let inFlight = null;
  let retryAfterMs = 0;

  const startRefresh = (currentMs) => {
    if (!inFlight) {
      inFlight = Promise.resolve().then(() => refresh()).then((snapshot) => {
        const generatedMs = Date.parse(snapshot?.generated_at);
        if (!Number.isSafeInteger(generatedMs) || generatedMs > normalizeNow(now())) throw new Error('Wallet-value snapshot time is invalid.');
        const fresh = serializeSnapshot({ ...snapshot, status: 'fresh' }, 'public, max-age=30');
        cached = { snapshot: structuredClone(snapshot), generatedMs, fresh };
        retryAfterMs = 0;
        return fresh;
      }).catch((error) => {
        retryAfterMs = currentMs + 60_000;
        throw error;
      }).finally(() => { inFlight = null; });
    }
    return inFlight;
  };

  return async function loadLooperWalletValues() {
    const currentMs = normalizeNow(now());
    const age = cached ? currentMs - cached.generatedMs : Number.POSITIVE_INFINITY;
    if (cached && age >= 0 && age < 300_000) return cloneResult(cached.fresh);
    if (cached && age >= 300_000 && age < 900_000) {
      if (currentMs >= retryAfterMs) startRefresh(currentMs).catch(() => {});
      return serializeSnapshot({ ...cached.snapshot, status: 'stale' }, 'no-cache');
    }
    if (currentMs < retryAfterMs) return unavailableResult();
    try { return cloneResult(await startRefresh(currentMs)); } catch { return unavailableResult(); }
  };
}

async function readChunk({ provider, chunk, blockTag, call }) {
  const calls = [];
  for (const entry of chunk) {
    calls.push({ target: MULTICALL3, allowFailure: true, callData: encodeFunctionData({ abi: MULTICALL_GET_ETH_BALANCE_ABI, functionName: 'getEthBalance', args: [entry.account] }) });
    calls.push({ target: CRED_ADDRESS, allowFailure: true, callData: encodeFunctionData({ abi: ERC20_BALANCE_ABI, functionName: 'balanceOf', args: [entry.account] }) });
    calls.push({ target: PANTHEON_STAKING_VAULT, allowFailure: true, callData: encodeFunctionData({ abi: PANTHEON_STAKES_ABI, functionName: 'stakes', args: [entry.account, CRED_ADDRESS] }) });
  }
  const data = encodeFunctionData({ abi: MULTICALL3_ABI, functionName: 'aggregate3', args: [calls] });
  const raw = await call(provider, 'eth_call', [{ to: MULTICALL3, data }, blockTag]);
  let results;
  try { results = decodeFunctionResult({ abi: MULTICALL3_ABI, functionName: 'aggregate3', data: raw }); } catch { throw new Error('Base provider Multicall response is malformed.'); }
  if (!Array.isArray(results) || results.length !== calls.length) throw new Error('Base provider Multicall response length is malformed.');
  return chunk.map((entry, index) => decodeRow(entry, results.slice(index * 3, index * 3 + 3)));
}

function decodeRow(entry, results) {
  if (results.some((result) => result?.success !== true)) return { status: 'unavailable', token_id: entry.tokenId, reason: 'account_unavailable' };
  try {
    const native = decodeFunctionResult({ abi: MULTICALL_GET_ETH_BALANCE_ABI, functionName: 'getEthBalance', data: results[0].returnData });
    const liquid = decodeFunctionResult({ abi: ERC20_BALANCE_ABI, functionName: 'balanceOf', data: results[1].returnData });
    const stake = decodeFunctionResult({ abi: PANTHEON_STAKES_ABI, functionName: 'stakes', data: results[2].returnData });
    if (!Array.isArray(stake) || stake.length !== 9) throw new Error('stake tuple');
    return {
      status: 'available', token_id: entry.tokenId, account: entry.account,
      eth_wei: BigInt(native).toString(), liquid_cred_base_units: BigInt(liquid).toString(),
      staked_cred_base_units: BigInt(stake[0]).toString(), total_usd_e8: null,
    };
  } catch { throw new Error('Base provider Multicall tuple is malformed.'); }
}

function createRpcTransport({ fetchImpl, requestTimeoutMs }) {
  let id = 0;
  return async (provider, method, params, signal) => {
    const timeout = AbortSignal.timeout(requestTimeoutMs);
    const requestSignal = signal && typeof AbortSignal.any === 'function' ? AbortSignal.any([signal, timeout]) : (signal ?? timeout);
    let response;
    try {
      response = await raceAbort(fetchImpl(provider, {
        method: 'POST', redirect: 'error', credentials: 'omit',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }), signal: requestSignal,
      }), requestSignal);
    } catch { throw new Error('Base provider request failed.'); }
    if (!response?.ok || response.redirected === true || String(response.url || provider) !== provider) throw new Error('Base provider request failed.');
    const bytes = await readBoundedResponseBytes(response, { maxBytes: MAX_DECODED_BYTES, signal: requestSignal });
    let value;
    try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { throw new Error('Base provider response is malformed.'); }
    if (!value || value.jsonrpc !== '2.0' || value.error || !Object.hasOwn(value, 'result')) throw new Error('Base provider response is malformed.');
    return { result: value.result, bytes: bytes.byteLength };
  };
}

async function mapLimited(values, concurrency, operation) {
  const output = new Array(values.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= values.length) return;
      output[index] = await operation(values[index], index);
    }
  });
  await Promise.all(workers);
  return output;
}

function normalizeBlock(value, expectedNumber) {
  const number = Number(parseQuantity(value?.number, 'Base block number'));
  const timestamp = Number(parseQuantity(value?.timestamp, 'Base block timestamp'));
  const hash = String(value?.hash ?? '').toLowerCase();
  if (number !== expectedNumber || !Number.isSafeInteger(timestamp) || timestamp < 0 || !BLOCK_HASH.test(hash)) throw new Error('Base wallet-value block is malformed.');
  return { number, timestamp, hash };
}
function sameBlock(left, right) { return left.number === right.number && left.hash === right.hash && left.timestamp === right.timestamp; }
function parseQuantity(value, label) {
  const text = String(value ?? '').toLowerCase();
  if (!QUANTITY.test(text)) throw new Error(label + ' is malformed.');
  return BigInt(text);
}
function boundedMs(value, minimum, maximum, label) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new TypeError('Invalid ' + label + '.');
  return value;
}
function normalizeNow(value) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new TypeError('Invalid wallet-value clock.');
  return parsed;
}
function serializeSnapshot(snapshot, cacheControl) {
  const bodyBytes = new TextEncoder().encode(JSON.stringify(snapshot));
  if (bodyBytes.byteLength > MAX_RESPONSE_BYTES) throw new Error('Wallet-value response exceeds byte limit.');
  const digest = createHash('sha256').update(bodyBytes).digest('hex');
  return { status: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cacheControl, etag: '"' + digest + '"' }, bodyBytes };
}
function unavailableResult() { return { status: 503, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, bodyBytes: UNAVAILABLE_BODY.slice() }; }
function cloneResult(value) { return { status: value.status, headers: { ...value.headers }, bodyBytes: value.bodyBytes.slice() }; }
function abortError(signal) { return signal?.reason instanceof Error ? signal.reason : new Error('Wallet-value refresh aborted.'); }
function raceAbort(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(abortError(signal));
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(abortError(signal));
    signal.addEventListener('abort', onAbort, { once: true });
    Promise.resolve(promise).then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}
