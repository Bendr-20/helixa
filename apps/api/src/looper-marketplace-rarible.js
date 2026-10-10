import { parse as parseLosslessJson } from 'lossless-json';

import { LOOPERS_BASE_CONTRACT } from './looper-marketplace.js';

export const LOOPERS_RARIBLE_COLLECTION = 'BASE:' + LOOPERS_BASE_CONTRACT;

const RARIBLE_API_BASE = 'https://api.rarible.org';
const BASE_WETH = '0x4200000000000000000000000000000000000006';
const CONTRACT_LOWER = LOOPERS_BASE_CONTRACT.toLowerCase();
const COLLECTION_LOWER = 'BASE:' + CONTRACT_LOWER;
const MAX_TOKEN_ID = 7_777n;
const MAX_UINT256 = (2n ** 256n) - 1n;
const DECIMAL_INTEGER_PATTERN = /^(?:0|[1-9]\d*)$/u;
const DECIMAL_AMOUNT_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d+)?$/u;
const UNION_CONTRACT_PATTERN = /^([A-Z]+):(0x[0-9a-f]{40})$/iu;
const CONTINUATION_PATTERN = /^[\x21-\x7e]+$/u;
const SAFE_ERROR_MESSAGE = 'Looper Rarible marketplace upstream unavailable.';

export function createLooperMarketplaceRaribleListingsLoader({
  fetchImpl = fetch,
  apiKey,
  now = Date.now,
  timeoutMs = 5_000,
  maxPages = 80,
  maxContinuationLength = 512,
  maxPageBytes = 1_000_000,
  maxTotalBytes = 50_000_000,
  freshTtlMs = 60_000,
  maxStaleMs = 5 * 60_000,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function.');
  if (typeof now !== 'function') throw new TypeError('now must be a function.');
  const bounds = {
    timeoutMs: boundedInteger(timeoutMs, 'timeoutMs', 1, 60_000),
    maxPages: boundedInteger(maxPages, 'maxPages', 1, 100),
    maxContinuationLength: boundedInteger(maxContinuationLength, 'maxContinuationLength', 1, 2_048),
    maxPageBytes: boundedInteger(maxPageBytes, 'maxPageBytes', 1, 10_000_000),
    maxTotalBytes: boundedInteger(maxTotalBytes, 'maxTotalBytes', 1, 50_000_000),
    freshTtlMs: boundedInteger(freshTtlMs, 'freshTtlMs', 0, 60 * 60_000),
    maxStaleMs: boundedInteger(maxStaleMs, 'maxStaleMs', 0, 24 * 60 * 60_000),
  };
  if (bounds.maxStaleMs < bounds.freshTtlMs) {
    throw new TypeError('maxStaleMs must be at least freshTtlMs.');
  }

  const normalizedApiKey = typeof apiKey === 'string' ? apiKey.trim() : '';
  let cached = null;
  let inFlight = null;

  async function refresh(observedMs) {
    const listings = await fetchAllListings({
      fetchImpl,
      apiKey: normalizedApiKey,
      nowMs: observedMs,
      bounds,
    });
    const snapshot = {
      schema_version: '1.0.0',
      collection: LOOPERS_RARIBLE_COLLECTION,
      contract: LOOPERS_BASE_CONTRACT,
      status: 'fresh',
      observed_at: new Date(observedMs).toISOString(),
      listings,
    };
    cached = { observedMs, snapshot };
    return snapshot;
  }

  return async function loadLooperMarketplaceRaribleListings() {
    const currentMs = normalizeNow(now());
    if (cached && currentMs - cached.observedMs <= bounds.freshTtlMs) {
      return cloneSnapshot(cached.snapshot);
    }
    if (!inFlight) {
      inFlight = refresh(currentMs).finally(() => { inFlight = null; });
    }
    try {
      return cloneSnapshot(await inFlight);
    } catch {
      const fallbackMs = normalizeNow(now());
      if (cached && fallbackMs - cached.observedMs <= bounds.maxStaleMs) {
        return cloneSnapshot({ ...cached.snapshot, status: 'stale' });
      }
      throw safeUpstreamError();
    }
  };
}

export const createRaribleLooperMarketplaceListingsLoader = createLooperMarketplaceRaribleListingsLoader;

async function fetchAllListings({ fetchImpl, apiKey, nowMs, bounds }) {
  const listings = [];
  const seenContinuations = new Set();
  let continuation = null;
  let totalBytes = 0;

  for (let pageIndex = 0; pageIndex < bounds.maxPages; pageIndex += 1) {
    const url = new URL(RARIBLE_API_BASE + '/v0.1/items/byCollection');
    url.searchParams.set('collection', LOOPERS_RARIBLE_COLLECTION);
    url.searchParams.set('size', '100');
    if (continuation !== null) url.searchParams.set('continuation', continuation);
    const headers = { accept: 'application/json' };
    if (apiKey) headers['X-API-KEY'] = apiKey;

    const body = await boundedRequest(fetchImpl, url, { method: 'GET', headers }, {
      timeoutMs: bounds.timeoutMs,
      maxPageBytes: bounds.maxPageBytes,
      maxRemainingBytes: bounds.maxTotalBytes - totalBytes,
    });
    totalBytes += body.bytes;
    if (totalBytes > bounds.maxTotalBytes) throw safeUpstreamError();

    let payload;
    try {
      payload = parseLosslessJson(body.text);
    } catch {
      throw safeUpstreamError();
    }
    if (!isPlainObject(payload) || !Array.isArray(payload.items)) throw safeUpstreamError();
    for (const candidate of payload.items) {
      const normalized = normalizeItem(candidate, nowMs);
      if (normalized) listings.push(normalized);
    }

    const next = payload.continuation;
    if (next === null || next === undefined || next === '') return dedupeAndSort(listings);
    if (typeof next !== 'string'
      || next.length > bounds.maxContinuationLength
      || !CONTINUATION_PATTERN.test(next)
      || seenContinuations.has(next)) {
      throw safeUpstreamError();
    }
    seenContinuations.add(next);
    continuation = next;
  }
  throw safeUpstreamError();
}

async function boundedRequest(fetchImpl, url, init, { timeoutMs, maxPageBytes, maxRemainingBytes }) {
  const controller = new AbortController();
  let timer;
  const request = async () => {
    const response = await fetchImpl(url, { ...init, signal: controller.signal });
    if (!response || response.ok !== true || !response.headers) throw safeUpstreamError();
    const declaredLength = response.headers.get('content-length');
    if (declaredLength !== null) {
      if (!DECIMAL_INTEGER_PATTERN.test(declaredLength)
        || BigInt(declaredLength) > BigInt(maxPageBytes)
        || BigInt(declaredLength) > BigInt(maxRemainingBytes)) {
        throw safeUpstreamError();
      }
    }
    return readBoundedBody(response, Math.min(maxPageBytes, maxRemainingBytes));
  };

  try {
    return await Promise.race([
      request(),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(safeUpstreamError());
        }, timeoutMs);
      }),
    ]);
  } catch {
    controller.abort();
    throw safeUpstreamError();
  } finally {
    clearTimeout(timer);
  }
}

async function readBoundedBody(response, maxBytes) {
  if (!response.body || typeof response.body.getReader !== 'function') throw safeUpstreamError();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) throw safeUpstreamError();
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel().catch(() => {});
        throw safeUpstreamError();
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return { text, bytes };
  } catch {
    throw safeUpstreamError();
  }
}

function normalizeItem(value, nowMs) {
  try {
    if (!isPlainObject(value) || value.blockchain !== 'BASE') return null;
    const tokenId = canonicalTokenId(value.tokenId);
    if (!tokenId) return null;
    if (normalizeUnionContract(value.collection) !== COLLECTION_LOWER) return null;
    if (normalizeItemId(value.id) !== COLLECTION_LOWER + ':' + tokenId) return null;

    const order = value.bestSellOrder;
    if (!isPlainObject(order) || order.status !== 'ACTIVE' || order.cancelled !== false) return null;
    if (!isLiveAt(order.startedAt, order.endedAt, nowMs)) return null;
    if (!isPlainObject(order.make) || !isUnitAmount(order.make.value)
      || !matchesLooperAsset(order.make.type, tokenId)) return null;
    if (!isPlainObject(order.take)) return null;

    const currency = normalizeCurrency(order.take.type);
    const price = normalizePrice(order.take.value);
    if (!currency || !price) return null;
    return {
      token_id: tokenId,
      price: { currency, amount: price.amount, base_units: price.baseUnits, decimals: 18 },
      item_url: 'https://rarible.com/token/base/' + CONTRACT_LOWER + ':' + tokenId,
    };
  } catch {
    return null;
  }
}

function matchesLooperAsset(value, tokenId) {
  if (!isPlainObject(value)) return false;
  if (value['@type'] === 'NFT') {
    if (normalizeItemId(value.itemId) === COLLECTION_LOWER + ':' + tokenId) return true;
    return value.blockchain === 'BASE'
      && normalizeUnionContract(value.contract) === COLLECTION_LOWER
      && canonicalTokenId(value.tokenId) === tokenId;
  }
  return value['@type'] === 'ERC721'
    && normalizeUnionContract(value.contract) === COLLECTION_LOWER
    && canonicalTokenId(value.tokenId) === tokenId;
}

function normalizeCurrency(value) {
  if (!isPlainObject(value)) return null;
  if (value['@type'] === 'CURRENCY_NATIVE') return value.blockchain === 'BASE' ? 'ETH' : null;
  if (value['@type'] === 'ETH') return value.blockchain === undefined || value.blockchain === 'BASE' ? 'ETH' : null;
  if (value['@type'] !== 'CURRENCY_TOKEN' && value['@type'] !== 'ERC20') return null;

  const unionContract = normalizeUnionContract(value.contract);
  if (unionContract) return unionContract === 'BASE:' + BASE_WETH ? 'WETH' : null;
  return value.blockchain === 'BASE' && normalizeRawAddress(value.contract) === BASE_WETH ? 'WETH' : null;
}

function normalizePrice(value) {
  const lexeme = scalarLexeme(value);
  if (!lexeme || !DECIMAL_AMOUNT_PATTERN.test(lexeme)) return null;
  const [integer, rawFraction = ''] = lexeme.split('.');
  if (rawFraction.length > 18 && /[1-9]/u.test(rawFraction.slice(18))) return null;
  const fraction = rawFraction.slice(0, 18).padEnd(18, '0');
  const baseUnits = (BigInt(integer) * (10n ** 18n)) + BigInt(fraction || '0');
  if (baseUnits <= 0n || baseUnits > MAX_UINT256) return null;
  return { baseUnits: baseUnits.toString(), amount: formatUnits18(baseUnits) };
}

function scalarLexeme(value) {
  if (typeof value === 'string') return value;
  if (isPlainObject(value) && typeof value.value === 'string') return value.value;
  return null;
}

function isUnitAmount(value) {
  const lexeme = scalarLexeme(value);
  return typeof lexeme === 'string' && /^1(?:\.0+)?$/u.test(lexeme);
}

function isLiveAt(startValue, endValue, nowMs) {
  if (startValue !== undefined && startValue !== null) {
    const startedAt = Date.parse(startValue);
    if (!Number.isFinite(startedAt) || startedAt > nowMs) return false;
  }
  if (endValue !== undefined && endValue !== null) {
    const endedAt = Date.parse(endValue);
    if (!Number.isFinite(endedAt) || endedAt <= nowMs) return false;
  }
  return true;
}

function canonicalTokenId(value) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/u.test(value)) return null;
  const parsed = BigInt(value);
  return parsed <= MAX_TOKEN_ID ? parsed.toString() : null;
}

function normalizeUnionContract(value) {
  if (typeof value !== 'string') return null;
  const match = UNION_CONTRACT_PATTERN.exec(value);
  if (!match || match[1].toUpperCase() !== 'BASE') return null;
  return 'BASE:' + match[2].toLowerCase();
}

function normalizeRawAddress(value) {
  return typeof value === 'string' && /^0x[0-9a-f]{40}$/iu.test(value) ? value.toLowerCase() : null;
}

function normalizeItemId(value) {
  if (typeof value !== 'string') return null;
  const match = /^(BASE):(0x[0-9a-f]{40}):([1-9]\d*)$/iu.exec(value);
  if (!match) return null;
  const tokenId = canonicalTokenId(match[3]);
  return tokenId ? 'BASE:' + match[2].toLowerCase() + ':' + tokenId : null;
}

function dedupeAndSort(values) {
  const cheapest = new Map();
  for (const value of values) {
    const existing = cheapest.get(value.token_id);
    if (!existing || BigInt(value.price.base_units) < BigInt(existing.price.base_units)) {
      cheapest.set(value.token_id, value);
    }
  }
  return [...cheapest.values()].sort((left, right) => {
    const priceDifference = BigInt(left.price.base_units) - BigInt(right.price.base_units);
    if (priceDifference < 0n) return -1;
    if (priceDifference > 0n) return 1;
    const tokenDifference = BigInt(left.token_id) - BigInt(right.token_id);
    return tokenDifference < 0n ? -1 : tokenDifference > 0n ? 1 : 0;
  });
}

function formatUnits18(value) {
  const digits = value.toString().padStart(19, '0');
  const integer = digits.slice(0, -18);
  const fraction = digits.slice(-18).replace(/0+$/u, '');
  return fraction ? integer + '.' + fraction : integer;
}

function normalizeNow(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new TypeError('now returned an invalid timestamp.');
  return Math.floor(number);
}

function boundedInteger(value, name, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(name + ' is outside its safe bound.');
  }
  return value;
}

function cloneSnapshot(value) {
  return {
    ...value,
    listings: value.listings.map(listing => ({
      ...listing,
      price: { ...listing.price },
    })),
  };
}

function safeUpstreamError() {
  return new Error(SAFE_ERROR_MESSAGE);
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
