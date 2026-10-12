import { createHash } from 'node:crypto';

import { getAddress } from 'viem';

import { readBoundedResponseBytes } from './bounded-io.js';
import { deriveReleasedLooperAccount } from './looper-account.js';

export const BASE_CHAIN_ID = 8453;
export const LOOPERS_COLLECTION = getAddress('0x1649CD37f4748807b4882FC48765bA0B2aFfa94a');
export const ERC6551_REGISTRY = getAddress('0x000000006551c19487814612e58FE06813775758');
export const ACCOUNT_SALT = '0xff28549509272e76f1d1c6ef7d6976d848c5ff6cb5068b2183c8d52f4cbe2bee';
export const RELEASED_ACCOUNT_IMPLEMENTATION = getAddress('0xf192f350427c8F58bC28e78b1e6Af164279F486e');
export const CRED_ADDRESS = getAddress('0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3');
export const PANTHEON_STAKING_VAULT = getAddress('0xBf52Aaf8b6C82FaD0220B5378022eA4fC0a98fDb');
export const MULTICALL3 = getAddress('0xcA11bde05977b3631167028862bE2a173976CA11');
export const CRED_WETH_ADDRESS = getAddress('0x4200000000000000000000000000000000000006');
export const CRED_PAIR_ID = '0x55a4f7a23c4c2616cf848e639a08bd4283d13e66f5fcf34f828b5ca7e4e96324';
export const ETH_QUOTE_URL = 'https://api.coinbase.com/v2/prices/ETH-USD/spot';
export const CRED_QUOTE_URL = 'https://api.dexscreener.com/latest/dex/tokens/' + CRED_ADDRESS;
export const MAX_ROSTER_BYTES = 256 * 1024;
export const MAX_RESPONSE_BYTES = 1024 * 1024;
export const MAX_DECODED_BYTES = 4 * 1024 * 1024;
export const MAX_ROSTER_COUNT = 1_000;
export const UINT256_MAX = (1n << 256n) - 1n;
export const USD_E8_MAX = (10n ** 20n);
export const TOTAL_USD_E8_MAX = (10n ** 38n) - 1n;

export const PANTHEON_STAKES_ABI = Object.freeze([Object.freeze({
  type: 'function', name: 'stakes', stateMutability: 'view',
  inputs: Object.freeze([{ name: 'user', type: 'address' }, { name: 'stakingToken', type: 'address' }]),
  outputs: Object.freeze([
    { name: 'amount', type: 'uint256' }, { name: 'autoRestake', type: 'bool' },
    { name: 'lockMonths', type: 'uint16' }, { name: 'lockDuration', type: 'uint32' },
    { name: 'stakeTime', type: 'uint32' }, { name: 'unstakeRequestTime', type: 'uint32' },
    { name: 'unstakeTime', type: 'uint32' }, { name: 'stakeMonthIndex', type: 'uint32' },
    { name: 'compounderEnabled', type: 'bool' },
  ]),
})]);

const ROSTER_KEYS = ['chain_id', 'contract', 'count', 'implementation', 'observed_at', 'observed_block', 'schema_version', 'token_ids'];
const SNAPSHOT_KEYS = ['block', 'chain_id', 'fresh_until', 'generated_at', 'quotes', 'roster', 'rows', 'schema_version', 'stale_until', 'status', 'valuation_status'];
const AVAILABLE_ROW_KEYS = ['account', 'eth_wei', 'liquid_cred_base_units', 'staked_cred_base_units', 'status', 'token_id', 'total_usd_e8'];
const UNAVAILABLE_ROW_KEYS = ['reason', 'status', 'token_id'];
const CANONICAL_UINT = /^(?:0|[1-9]\d*)$/u;
const POSITIVE_UINT = /^[1-9]\d*$/u;
const PRICE_DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d+)?$/u;
const HASH = /^0x[0-9a-f]{64}$/u;

export function parseWalletValueRoster(rawBytes) {
  if (!(rawBytes instanceof Uint8Array) || rawBytes.byteLength === 0 || rawBytes.byteLength > MAX_ROSTER_BYTES) throw rosterError();
  let value;
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(rawBytes)); } catch { throw rosterError(); }
  if (!exactObject(value, ROSTER_KEYS)
    || value.schema_version !== '1.0.0'
    || value.chain_id !== BASE_CHAIN_ID
    || !sameAddress(value.contract, LOOPERS_COLLECTION)
    || !sameAddress(value.implementation, RELEASED_ACCOUNT_IMPLEMENTATION)
    || !Number.isSafeInteger(value.observed_block) || value.observed_block < 1
    || !canonicalTimestamp(value.observed_at)
    || !Number.isSafeInteger(value.count) || value.count < 1 || value.count > MAX_ROSTER_COUNT
    || !Array.isArray(value.token_ids) || value.token_ids.length !== value.count) throw rosterError();
  let prior = 0n;
  const tokenIds = [];
  for (const tokenId of value.token_ids) {
    if (typeof tokenId !== 'string' || !POSITIVE_UINT.test(tokenId)) throw rosterError();
    const parsed = BigInt(tokenId);
    if (parsed <= prior || parsed > UINT256_MAX) throw rosterError();
    prior = parsed;
    tokenIds.push(tokenId);
  }
  return Object.freeze({
    rawSha256: createHash('sha256').update(rawBytes).digest('hex'),
    count: value.count,
    observedBlock: value.observed_block,
    observedAt: value.observed_at,
    tokenIds: Object.freeze(tokenIds),
  });
}

export function decimalToUsdE8(value) {
  const text = String(value ?? '');
  if (!PRICE_DECIMAL.test(text)) throw quoteError();
  const [whole, fraction = ''] = text.split('.');
  const scaled = BigInt(whole) * 100_000_000n + BigInt((fraction + '00000000').slice(0, 8));
  if (scaled < 1n || scaled > USD_E8_MAX) throw quoteError();
  return scaled.toString();
}

export function computeTotalUsdE8({ ethWei, liquidCredBaseUnits, stakedCredBaseUnits, ethPriceUsdE8, credPriceUsdE8 } = {}) {
  const eth = canonicalUint256(ethWei, 'ETH balance');
  const liquid = canonicalUint256(liquidCredBaseUnits, 'liquid CRED balance');
  const staked = canonicalUint256(stakedCredBaseUnits, 'staked CRED balance');
  const ethPrice = boundedCanonicalUint(ethPriceUsdE8, USD_E8_MAX, 'ETH price');
  const credPrice = boundedCanonicalUint(credPriceUsdE8, USD_E8_MAX, 'CRED price');
  if (ethPrice === 0n || credPrice === 0n) throw quoteError();
  const total = (eth * ethPrice / (10n ** 18n)) + ((liquid + staked) * credPrice / (10n ** 18n));
  if (total > TOTAL_USD_E8_MAX) throw new Error('Wallet value exceeds supported range.');
  return total.toString();
}

export function deriveChecksummedLooperAccount(tokenId) {
  return getAddress(deriveReleasedLooperAccount(tokenId));
}

export async function loadWalletValueQuotes({ fetchImpl = globalThis.fetch, now = Date.now, signal, timeoutMs = 5_000 } = {}) {
  if (typeof fetchImpl !== 'function' || typeof now !== 'function') throw new TypeError('Quote dependencies are unavailable.');
  const [eth, cred] = await Promise.all([
    fetchQuote({ fetchImpl, url: ETH_QUOTE_URL, maxBytes: 32 * 1024, signal, timeoutMs, parse: parseEthQuote, now }),
    fetchQuote({ fetchImpl, url: CRED_QUOTE_URL, maxBytes: 512 * 1024, signal, timeoutMs, parse: parseCredQuote, now }),
  ]);
  const generatedMs = normalizeNow(now());
  assertWalletValueQuoteFreshness({ ethObservedMs: eth.observedMs, credObservedMs: cred.observedMs }, generatedMs);
  return Object.freeze({
    eth: Object.freeze({ asset: 'ETH', source: 'coinbase', priceUsdE8: eth.priceUsdE8, observedAt: new Date(eth.observedMs).toISOString() }),
    cred: Object.freeze({ asset: 'CRED', contract: CRED_ADDRESS, source: 'dexscreener-uniswap-base', poolId: CRED_PAIR_ID, priceUsdE8: cred.priceUsdE8, observedAt: new Date(cred.observedMs).toISOString() }),
    generatedMs,
  });
}

export function assertWalletValueQuoteFreshness({ ethObservedMs, credObservedMs } = {}, generatedMs) {
  for (const value of [ethObservedMs, credObservedMs, generatedMs]) if (!Number.isSafeInteger(value) || value < 0) throw quoteError();
  if (Math.abs(ethObservedMs - credObservedMs) > 10_000) throw new Error('Wallet value quote skew exceeds limit.');
  if (generatedMs < ethObservedMs || generatedMs < credObservedMs || generatedMs - Math.min(ethObservedMs, credObservedMs) > 60_000) {
    throw new Error('Wallet value quote is stale.');
  }
}

export function validateWalletValueSnapshot(snapshot, roster) {
  if (!exactObject(snapshot, SNAPSHOT_KEYS)
    || snapshot.schema_version !== '1.0.0' || snapshot.chain_id !== BASE_CHAIN_ID
    || !['fresh', 'stale'].includes(snapshot.status)
    || !['available', 'unavailable'].includes(snapshot.valuation_status)
    || !canonicalTimestamp(snapshot.generated_at) || !canonicalTimestamp(snapshot.fresh_until) || !canonicalTimestamp(snapshot.stale_until)
    || !exactObject(snapshot.roster, ['count', 'observed_at', 'observed_block', 'sha256'])
    || snapshot.roster.sha256 !== roster?.rawSha256 || snapshot.roster.count !== roster?.count
    || snapshot.roster.observed_block !== roster?.observedBlock || snapshot.roster.observed_at !== roster?.observedAt
    || !exactObject(snapshot.block, ['hash', 'number', 'observed_at'])
    || !Number.isSafeInteger(snapshot.block.number) || snapshot.block.number < 1 || !HASH.test(snapshot.block.hash)
    || !canonicalTimestamp(snapshot.block.observed_at)
    || !Array.isArray(snapshot.rows) || snapshot.rows.length !== roster.count) throw new Error('Wallet value snapshot is malformed.');
  if (snapshot.valuation_status === 'available') validateQuotes(snapshot.quotes);
  else if (snapshot.quotes !== null) throw new Error('Wallet value snapshot quotes are malformed.');
  snapshot.rows.forEach((row, index) => validateRow(row, roster.tokenIds[index], snapshot.valuation_status));
  return snapshot;
}

async function fetchQuote({ fetchImpl, url, maxBytes, signal, timeoutMs, parse, now }) {
  const timeout = AbortSignal.timeout(timeoutMs);
  const requestSignal = signal && typeof AbortSignal.any === 'function' ? AbortSignal.any([signal, timeout]) : (signal ?? timeout);
  let response;
  try {
    response = await raceAbort(fetchImpl(url, { method: 'GET', redirect: 'error', credentials: 'omit', headers: { accept: 'application/json' }, signal: requestSignal }), requestSignal);
  } catch { throw quoteError(); }
  if (!response?.ok || response.redirected === true || String(response.url || url) !== url) throw quoteError();
  let bytes;
  try { bytes = await readBoundedResponseBytes(response, { maxBytes, signal: requestSignal }); } catch { throw quoteError(); }
  let value;
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { throw quoteError(); }
  const priceUsdE8 = parse(value);
  return { priceUsdE8, observedMs: normalizeNow(now()) };
}

function parseEthQuote(value) {
  if (!plainObject(value) || !plainObject(value.data) || value.data.base !== 'ETH' || value.data.currency !== 'USD') throw quoteError();
  return decimalToUsdE8(value.data.amount);
}

function parseCredQuote(value) {
  if (!plainObject(value) || !Array.isArray(value.pairs)) throw quoteError();
  const matches = value.pairs.filter((pair) => plainObject(pair)
    && pair.chainId === 'base' && pair.dexId === 'uniswap'
    && String(pair.pairAddress ?? '').toLowerCase() === CRED_PAIR_ID
    && sameAddress(pair.baseToken?.address, CRED_ADDRESS) && pair.baseToken?.symbol === 'CRED'
    && sameAddress(pair.quoteToken?.address, CRED_WETH_ADDRESS) && pair.quoteToken?.symbol === 'WETH');
  if (matches.length !== 1) throw quoteError();
  const liquidity = matches[0].liquidity?.usd;
  if (typeof liquidity !== 'number' || !Number.isFinite(liquidity) || liquidity < 10_000) throw quoteError();
  return decimalToUsdE8(matches[0].priceUsd);
}

function validateQuotes(value) {
  if (!exactObject(value, ['cred', 'eth'])
    || !exactObject(value.eth, ['asset', 'observed_at', 'price_usd_e8', 'source'])
    || value.eth.asset !== 'ETH' || value.eth.source !== 'coinbase' || !canonicalTimestamp(value.eth.observed_at)
    || boundedCanonicalUint(value.eth.price_usd_e8, USD_E8_MAX, 'ETH price') === 0n
    || !exactObject(value.cred, ['asset', 'contract', 'observed_at', 'pool_id', 'price_usd_e8', 'source'])
    || value.cred.asset !== 'CRED' || !sameAddress(value.cred.contract, CRED_ADDRESS)
    || value.cred.source !== 'dexscreener-uniswap-base' || value.cred.pool_id !== CRED_PAIR_ID
    || !canonicalTimestamp(value.cred.observed_at)
    || boundedCanonicalUint(value.cred.price_usd_e8, USD_E8_MAX, 'CRED price') === 0n) throw new Error('Wallet value snapshot quotes are malformed.');
}

function validateRow(row, tokenId, valuationStatus) {
  if (row?.status === 'unavailable') {
    if (!exactObject(row, UNAVAILABLE_ROW_KEYS) || row.token_id !== tokenId || row.reason !== 'account_unavailable') throw new Error('Wallet value snapshot rows are malformed.');
    return;
  }
  if (!exactObject(row, AVAILABLE_ROW_KEYS) || row.status !== 'available' || row.token_id !== tokenId) throw new Error('Wallet value snapshot rows are malformed.');
  try { if (getAddress(row.account) !== row.account) throw new Error(); } catch { throw new Error('Wallet value snapshot account is malformed.'); }
  canonicalUint256(row.eth_wei, 'ETH balance');
  canonicalUint256(row.liquid_cred_base_units, 'liquid CRED balance');
  canonicalUint256(row.staked_cred_base_units, 'staked CRED balance');
  if (valuationStatus === 'unavailable') {
    if (row.total_usd_e8 !== null) throw new Error('Wallet value snapshot rows are malformed.');
  } else {
    boundedCanonicalUint(row.total_usd_e8, TOTAL_USD_E8_MAX, 'wallet value');
  }
}

function canonicalUint256(value, label) { return boundedCanonicalUint(value, UINT256_MAX, label); }
function boundedCanonicalUint(value, maximum, label) {
  const text = String(value ?? '');
  if (!CANONICAL_UINT.test(text)) throw new Error(label + ' is malformed.');
  const parsed = BigInt(text);
  if (parsed > maximum) throw new Error(label + ' exceeds supported range.');
  return parsed;
}
function normalizeNow(value) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw quoteError();
  return parsed;
}
function canonicalTimestamp(value) { return typeof value === 'string' && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value; }
function exactObject(value, keys) { return plainObject(value) && Object.keys(value).sort().join('\0') === [...keys].sort().join('\0'); }
function plainObject(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function sameAddress(left, right) { try { return getAddress(left) === getAddress(right); } catch { return false; } }
function rosterError() { return new Error('Activated Looper roster is malformed.'); }
function quoteError() { return new Error('Wallet value quote is unavailable.'); }
function raceAbort(promise, signal) {
  if (signal?.aborted) return Promise.reject(signal.reason ?? quoteError());
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(signal.reason ?? quoteError());
    signal?.addEventListener?.('abort', onAbort, { once: true });
    Promise.resolve(promise).then(resolve, reject).finally(() => signal?.removeEventListener?.('abort', onAbort));
  });
}
