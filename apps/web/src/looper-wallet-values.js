import { getAddress } from 'viem';

import { readBoundedResponseBytes } from './bounded-response-body.js';

export const LOOPER_WALLET_VALUES_PATH = '/multipass-api/api/loopers/marketplace/wallet-values';
const MAX_BYTES = 1024 * 1024;
const CRED_ADDRESS = getAddress('0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3');
const CRED_PAIR_ID = '0x55a4f7a23c4c2616cf848e639a08bd4283d13e66f5fcf34f828b5ca7e4e96324';
const CANONICAL_UINT = /^(?:0|[1-9]\d*)$/u;
const POSITIVE_UINT = /^[1-9]\d*$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const BLOCK_HASH = /^0x[0-9a-f]{64}$/u;
const TOP_KEYS = ['block', 'chain_id', 'fresh_until', 'generated_at', 'quotes', 'roster', 'rows', 'schema_version', 'stale_until', 'status', 'valuation_status'];
const AVAILABLE_ROW_KEYS = ['account', 'eth_wei', 'liquid_cred_base_units', 'staked_cred_base_units', 'status', 'token_id', 'total_usd_e8'];
const UNAVAILABLE_ROW_KEYS = ['reason', 'status', 'token_id'];

export async function loadLooperWalletValues({ fetchImpl = globalThis.fetch, signal } = {}) {
  try {
    const response = await fetchImpl(LOOPER_WALLET_VALUES_PATH, {
      method: 'GET', credentials: 'omit', cache: 'no-store', headers: { accept: 'application/json' }, signal,
    });
    if (!response?.ok) return unavailable();
    const bytes = await readBoundedResponseBytes(response, { maxBytes: MAX_BYTES, signal });
    const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    return normalizeLooperWalletValues(value);
  } catch {
    return unavailable();
  }
}

export function normalizeLooperWalletValues(value) {
  if (!exactObject(value, TOP_KEYS)
    || value.schema_version !== '1.0.0' || value.chain_id !== 8453
    || !['fresh', 'stale'].includes(value.status)
    || !['available', 'unavailable'].includes(value.valuation_status)
    || !canonicalTimestamp(value.generated_at) || !canonicalTimestamp(value.fresh_until) || !canonicalTimestamp(value.stale_until)
    || !exactObject(value.roster, ['count', 'observed_at', 'observed_block', 'sha256'])
    || !SHA256.test(value.roster.sha256) || !Number.isSafeInteger(value.roster.count) || value.roster.count < 1 || value.roster.count > 1_000
    || !Number.isSafeInteger(value.roster.observed_block) || value.roster.observed_block < 1 || !canonicalTimestamp(value.roster.observed_at)
    || !exactObject(value.block, ['hash', 'number', 'observed_at'])
    || !Number.isSafeInteger(value.block.number) || value.block.number < 1 || !BLOCK_HASH.test(value.block.hash) || !canonicalTimestamp(value.block.observed_at)
    || !Array.isArray(value.rows) || value.rows.length !== value.roster.count) throw walletError();
  const quotes = value.valuation_status === 'available' ? normalizeQuotes(value.quotes) : null;
  if (value.valuation_status === 'unavailable' && value.quotes !== null) throw walletError();
  const seen = new Set();
  const rows = value.rows.map((row) => {
    const normalized = normalizeRow(row, value.valuation_status);
    if (seen.has(normalized.tokenId)) throw walletError();
    seen.add(normalized.tokenId);
    return normalized;
  });
  return Object.freeze({
    status: 'available', snapshotStatus: value.status, valuationStatus: value.valuation_status,
    roster: Object.freeze({ sha256: value.roster.sha256, count: value.roster.count, observedBlock: value.roster.observed_block, observedAt: value.roster.observed_at }),
    block: Object.freeze({ number: value.block.number, hash: value.block.hash, observedAt: value.block.observed_at }),
    generatedAt: value.generated_at, freshUntil: value.fresh_until, staleUntil: value.stale_until,
    quotes, rows: Object.freeze(rows),
  });
}

export function joinVerifiedLooperWalletValues({ walletValues, liveActivation, staticActivation } = {}) {
  if (walletValues?.status !== 'available' || liveActivation?.status !== 'available' || staticActivation?.status !== 'available'
    || typeof staticActivation.rawSha256 !== 'string' || walletValues.roster.sha256 !== staticActivation.rawSha256
    || !sameTokenSet(liveActivation.tokenIds, staticActivation.tokenIds)
    || !sameTokenSet(new Set(walletValues.rows.map((row) => row.tokenId)), staticActivation.tokenIds)) return unavailable();
  return Object.freeze({
    status: 'available',
    valuationStatus: walletValues.valuationStatus,
    snapshotStatus: walletValues.snapshotStatus,
    block: walletValues.block,
    generatedAt: walletValues.generatedAt,
    quotes: walletValues.quotes,
    rowsByToken: new Map(walletValues.rows.map((row) => [row.tokenId, row])),
  });
}

function normalizeQuotes(value) {
  if (!exactObject(value, ['cred', 'eth'])
    || !exactObject(value.eth, ['asset', 'observed_at', 'price_usd_e8', 'source'])
    || value.eth.asset !== 'ETH' || value.eth.source !== 'coinbase' || !positiveBounded(value.eth.price_usd_e8, 10n ** 20n) || !canonicalTimestamp(value.eth.observed_at)
    || !exactObject(value.cred, ['asset', 'contract', 'observed_at', 'pool_id', 'price_usd_e8', 'source'])
    || value.cred.asset !== 'CRED' || !sameAddress(value.cred.contract, CRED_ADDRESS)
    || value.cred.source !== 'dexscreener-uniswap-base' || value.cred.pool_id !== CRED_PAIR_ID
    || !positiveBounded(value.cred.price_usd_e8, 10n ** 20n) || !canonicalTimestamp(value.cred.observed_at)) throw walletError();
  return Object.freeze({
    eth: Object.freeze({ priceUsdE8: value.eth.price_usd_e8, observedAt: value.eth.observed_at, source: value.eth.source }),
    cred: Object.freeze({ priceUsdE8: value.cred.price_usd_e8, observedAt: value.cred.observed_at, source: value.cred.source }),
  });
}

function normalizeRow(row, valuationStatus) {
  if (row?.status === 'unavailable') {
    if (!exactObject(row, UNAVAILABLE_ROW_KEYS) || !POSITIVE_UINT.test(row.token_id) || row.reason !== 'account_unavailable') throw walletError();
    return Object.freeze({ status: 'unavailable', tokenId: row.token_id, reason: row.reason });
  }
  if (!exactObject(row, AVAILABLE_ROW_KEYS) || row.status !== 'available' || !POSITIVE_UINT.test(row.token_id)
    || !canonicalUint(row.eth_wei, (1n << 256n) - 1n) || !canonicalUint(row.liquid_cred_base_units, (1n << 256n) - 1n)
    || !canonicalUint(row.staked_cred_base_units, (1n << 256n) - 1n)) throw walletError();
  try { if (getAddress(row.account) !== row.account) throw new Error(); } catch { throw walletError(); }
  if (valuationStatus === 'available') {
    if (!canonicalUint(row.total_usd_e8, (10n ** 38n) - 1n)) throw walletError();
  } else if (row.total_usd_e8 !== null) throw walletError();
  return Object.freeze({
    status: 'available', tokenId: row.token_id, account: row.account,
    ethWei: row.eth_wei, liquidCredBaseUnits: row.liquid_cred_base_units,
    stakedCredBaseUnits: row.staked_cred_base_units, totalUsdE8: row.total_usd_e8,
  });
}

function sameTokenSet(left, right) {
  if (!(left instanceof Set) || !(right instanceof Set) || left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
}
function canonicalUint(value, maximum) {
  return typeof value === 'string' && CANONICAL_UINT.test(value) && BigInt(value) <= maximum;
}
function positiveBounded(value, maximum) { return canonicalUint(value, maximum) && BigInt(value) > 0n; }
function canonicalTimestamp(value) { return typeof value === 'string' && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value; }
function exactObject(value, keys) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join('\0') === [...keys].sort().join('\0'); }
function sameAddress(left, right) { try { return getAddress(left) === getAddress(right); } catch { return false; } }
function unavailable() { return Object.freeze({ status: 'unavailable' }); }
function walletError() { return new Error('Looper wallet-value response is malformed.'); }
