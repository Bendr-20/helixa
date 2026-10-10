import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LOOPERS_RARIBLE_COLLECTION,
  createLooperMarketplaceRaribleListingsLoader,
} from '../src/looper-marketplace-rarible.js';

const CONTRACT = '0x1649CD37f4748807b4882FC48765bA0B2aFfa94a';
const CONTRACT_LOWER = CONTRACT.toLowerCase();
const COLLECTION = 'BASE:' + CONTRACT;
const WETH = '0x4200000000000000000000000000000000000006';
const NOW_MS = 1_760_000_000_000;

function item({
  tokenId = '1',
  blockchain = 'BASE',
  collection = COLLECTION,
  id = collection + ':' + tokenId,
  status = 'ACTIVE',
  cancelled = false,
  makeType = { '@type': 'NFT', itemId: COLLECTION + ':' + tokenId },
  makeValue = '1',
  takeType = { '@type': 'CURRENCY_NATIVE', blockchain: 'BASE' },
  takeValue = '1',
  endedAt,
} = {}) {
  return {
    id, blockchain, collection, tokenId,
    bestSellOrder: {
      status, cancelled, endedAt,
      make: { type: makeType, value: makeValue },
      take: { type: takeType, value: takeValue },
    },
  };
}

function page(items, continuation) {
  return continuation === undefined ? { items } : { items, continuation };
}

function jsonResponse(value, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json', ...headers } });
}

function loaderForPages(pages, options = {}) {
  let index = 0;
  const requests = [];
  const load = createLooperMarketplaceRaribleListingsLoader({
    apiKey: 'rarible-secret-key',
    now: () => NOW_MS,
    fetchImpl: async (url, init) => {
      requests.push({ url: String(url), init });
      const current = pages[Math.min(index, pages.length - 1)];
      index += 1;
      return current instanceof Response ? current : jsonResponse(current);
    },
    ...options,
  });
  return { load, requests, calls: () => index };
}

test('exports the pinned Base collection adapter', () => {
  assert.equal(LOOPERS_RARIBLE_COLLECTION, COLLECTION);
  assert.equal(typeof createLooperMarketplaceRaribleListingsLoader, 'function');
});

test('normalizes a Rarible bestSellOrder into the public snapshot shape', async () => {
  const { load, requests } = loaderForPages([page([item({ tokenId: '42', takeValue: '1.000000000000000001' })])]);
  const result = await load();

  assert.deepEqual(result, {
    schema_version: '1.0.0',
    collection: COLLECTION,
    contract: CONTRACT,
    status: 'fresh',
    observed_at: new Date(NOW_MS).toISOString(),
    listings: [{
      token_id: '42',
      price: { currency: 'ETH', amount: '1.000000000000000001', base_units: '1000000000000000001', decimals: 18 },
      item_url: 'https://rarible.com/token/base/' + CONTRACT_LOWER + ':42',
    }],
  });
  assert.deepEqual(Object.keys(result), ['schema_version', 'collection', 'contract', 'status', 'observed_at', 'listings']);
  assert.deepEqual(Object.keys(result.listings[0]), ['token_id', 'price', 'item_url']);
  const url = new URL(requests[0].url);
  assert.equal(url.origin + url.pathname, 'https://api.rarible.org/v0.1/items/byCollection');
  assert.equal(url.searchParams.get('collection'), COLLECTION);
  assert.equal(url.searchParams.get('size'), '100');
  assert.equal(requests[0].init.headers['X-API-KEY'], 'rarible-secret-key');
  assert.ok(requests[0].init.signal instanceof AbortSignal);
});

test('accepts only canonical Looper Base item identities and locally derives safe URLs', async () => {
  const impostor = '0x1649CD37f4748807b4882FC48765bA0B2aFfa94b';
  const candidates = [
    item({ tokenId: '0' }), item({ tokenId: '01' }), item({ tokenId: '7778' }), item({ tokenId: '-1' }),
    item({ tokenId: '2', blockchain: 'ETHEREUM' }),
    item({ tokenId: '3', collection: 'BASE:' + impostor }),
    item({ tokenId: '4', id: COLLECTION + ':5' }),
    item({ tokenId: '5', makeType: { '@type': 'NFT', itemId: COLLECTION + ':6' } }),
    { ...item({ tokenId: '7777' }), item_url: 'javascript:alert(1)', meta: { secret: 'nope' } },
  ];
  const result = await loaderForPages([page(candidates)]).load();
  assert.deepEqual(result.listings.map(({ token_id }) => token_id), ['7777']);
  assert.equal(JSON.stringify(result).includes('javascript:'), false);
  assert.equal(JSON.stringify(result).includes('secret'), false);
});

test('requires an active uncancelled quantity-one best sell order for the same NFT', async () => {
  const result = await loaderForPages([page([
    item({ tokenId: '1', status: 'FILLED' }),
    item({ tokenId: '2', cancelled: true }),
    item({ tokenId: '3', makeValue: '2' }),
    item({ tokenId: '4', endedAt: new Date(NOW_MS).toISOString() }),
    item({ tokenId: '5', endedAt: new Date(NOW_MS + 1).toISOString() }),
    item({ tokenId: '6', makeType: { '@type': 'ERC721', contract: COLLECTION, tokenId: '6' } }),
  ])]).load();
  assert.deepEqual(result.listings.map(({ token_id }) => token_id), ['5', '6']);
});

test('derives only Base ETH and Base WETH from pinned asset types', async () => {
  const result = await loaderForPages([page([
    item({ tokenId: '1' }),
    item({ tokenId: '2', takeType: { '@type': 'CURRENCY_TOKEN', contract: 'BASE:' + WETH } }),
    item({ tokenId: '3', takeType: { '@type': 'ETH', blockchain: 'BASE' } }),
    item({ tokenId: '4', takeType: { '@type': 'ERC20', contract: 'BASE:' + WETH.toUpperCase().replace('0X', '0x') } }),
    item({ tokenId: '5', takeType: { '@type': 'CURRENCY_NATIVE', blockchain: 'ETHEREUM' } }),
    item({ tokenId: '6', takeType: { '@type': 'CURRENCY_TOKEN', contract: 'BASE:0x1111111111111111111111111111111111111111' } }),
    item({ tokenId: '7', takeType: { '@type': 'ERC20', contract: 'ETHEREUM:' + WETH } }),
  ])]).load();
  assert.deepEqual(result.listings.map(({ token_id, price }) => [token_id, price.currency]), [
    ['1', 'ETH'], ['2', 'WETH'], ['3', 'ETH'], ['4', 'WETH'],
  ]);
});

test('parses JSON numeric prices losslessly and normalizes exact 18-decimal BigInt units', async () => {
  const raw = '{"items":[' + JSON.stringify(item({ tokenId: '9' })).replace('"1"}}}', '0.100000000000000001}}}') + ']}';
  const result = await loaderForPages([new Response(raw, { status: 200 })]).load();
  assert.deepEqual(result.listings[0].price, {
    currency: 'ETH', amount: '0.100000000000000001', base_units: '100000000000000001', decimals: 18,
  });
});

test('rejects nonpositive malformed inexact and uint256-overflow prices', async () => {
  const maxUnits = (2n ** 256n) - 1n;
  const maxAmount = (maxUnits / (10n ** 18n)).toString() + '.' + (maxUnits % (10n ** 18n)).toString().padStart(18, '0');
  const overflowAmount = ((maxUnits / (10n ** 18n)) + 1n).toString();
  const result = await loaderForPages([page([
    item({ tokenId: '1', takeValue: '0' }), item({ tokenId: '2', takeValue: '-1' }),
    item({ tokenId: '3', takeValue: '1e-3' }), item({ tokenId: '4', takeValue: '01' }),
    item({ tokenId: '5', takeValue: '0.0000000000000000001' }),
    item({ tokenId: '6', takeValue: '1.0000000000000000000' }),
    item({ tokenId: '7', takeValue: overflowAmount }), item({ tokenId: '8', takeValue: maxAmount }),
  ])]).load();
  assert.deepEqual(result.listings.map(({ token_id }) => token_id), ['6', '8']);
  assert.equal(result.listings[0].price.amount, '1');
  assert.equal(result.listings[1].price.base_units, maxUnits.toString());
});

test('deduplicates by cheapest exact price and sorts by price then token id', async () => {
  const result = await loaderForPages([page([
    item({ tokenId: '10', takeValue: '9007199254740993.000000000000000001' }),
    item({ tokenId: '2', takeValue: '9007199254740993' }),
    item({ tokenId: '10', takeValue: '9007199254740993' }),
    item({ tokenId: '3', takeValue: '0.000000000000000001' }),
    item({ tokenId: '2', takeValue: '9007199254740994' }),
  ])]).load();
  assert.deepEqual(result.listings.map(({ token_id, price }) => [token_id, price.amount]), [
    ['3', '0.000000000000000001'], ['2', '9007199254740993'], ['10', '9007199254740993'],
  ]);
});

test('follows bounded opaque continuations and rejects repeats malformed and page overflow', async () => {
  const { load, requests } = loaderForPages([
    page([item({ tokenId: '2' })], '2026-10-10T00:00:00Z_abc:def=='),
    page([item({ tokenId: '1' })]),
  ]);
  assert.deepEqual((await load()).listings.map(({ token_id }) => token_id), ['1', '2']);
  assert.equal(new URL(requests[0].url).searchParams.has('continuation'), false);
  assert.equal(new URL(requests[1].url).searchParams.get('continuation'), '2026-10-10T00:00:00Z_abc:def==');

  for (const pages of [
    [page([], 'repeat'), page([], 'repeat')],
    [page([], 'x'.repeat(17))],
    [page([], 'bad cursor')],
    [page([], 'one'), page([], 'two')],
  ]) {
    await assert.rejects(loaderForPages(pages, { maxPages: 2, maxContinuationLength: 16 }).load(), {
      message: 'Looper Rarible marketplace upstream unavailable.',
    });
  }
});

test('default pagination bound covers all 7777 collection items at 100 per page', async () => {
  const pages = Array.from({ length: 78 }, (_, index) => page(
    [{ ...item({ tokenId: String(index + 1) }), sourcePadding: 'x'.repeat(60_000) }],
    index < 77 ? 'cursor-' + (index + 1) : undefined,
  ));
  const { load, calls } = loaderForPages(pages);
  const result = await load();
  assert.equal(calls(), 78);
  assert.equal(result.listings.length, 78);
});

test('enforces declared actual per-page and cumulative streaming byte bounds', async () => {
  await assert.rejects(loaderForPages([
    jsonResponse(page([]), { headers: { 'content-length': '9999' } }),
  ], { maxPageBytes: 128 }).load(), /Rarible marketplace upstream unavailable/u);

  await assert.rejects(loaderForPages([
    page([{ padding: 'x'.repeat(500) }]),
  ], { maxPageBytes: 128 }).load(), /Rarible marketplace upstream unavailable/u);

  const first = page([], 'next');
  const second = page([]);
  const total = Buffer.byteLength(JSON.stringify(first)) + Buffer.byteLength(JSON.stringify(second));
  await assert.rejects(loaderForPages([first, second], {
    maxPageBytes: 256, maxTotalBytes: total - 1,
  }).load(), /Rarible marketplace upstream unavailable/u);
});

test('never falls back to an unbounded body reader', async () => {
  let textCalled = false;
  const load = createLooperMarketplaceRaribleListingsLoader({
    maxPageBytes: 128,
    fetchImpl: async () => ({
      ok: true,
      headers: new Headers(),
      body: null,
      async text() { textCalled = true; return 'x'.repeat(1_000_000); },
    }),
  });
  await assert.rejects(load(), { message: 'Looper Rarible marketplace upstream unavailable.' });
  assert.equal(textCalled, false);
});

test('keeps timeout active through the bounded response stream read', async () => {
  let aborted = false;
  const load = createLooperMarketplaceRaribleListingsLoader({
    apiKey: 'never-log-this', timeoutMs: 10,
    fetchImpl: async (_url, { signal }) => ({
      ok: true,
      headers: new Headers(),
      body: { getReader: () => ({
        read: () => new Promise((resolve, reject) => {
          const fallback = setTimeout(() => resolve({ done: true }), 30);
          signal.addEventListener('abort', () => {
            clearTimeout(fallback); aborted = true;
            reject(Object.assign(new Error('private body'), { name: 'AbortError' }));
          }, { once: true });
        }),
        cancel: async () => {},
      }) },
    }),
  });
  await assert.rejects(load(), { message: 'Looper Rarible marketplace upstream unavailable.' });
  assert.equal(aborted, true);
});

test('returns one safe error for transport HTTP and malformed payload failures without logging the key', async () => {
  const originals = { error: console.error, warn: console.warn, log: console.log };
  const logged = [];
  console.error = console.warn = console.log = (...values) => logged.push(values.join(' '));
  try {
    for (const response of [
      jsonResponse({ secret: 'body-secret' }, { status: 503 }),
      jsonResponse([]), jsonResponse({ items: 'bad' }), new Response('{not-json', { status: 200 }),
    ]) {
      await assert.rejects(loaderForPages([response]).load(), error => (
        error.message === 'Looper Rarible marketplace upstream unavailable.'
        && !/secret|not-json/iu.test(error.message)
      ));
    }
  } finally {
    console.error = originals.error; console.warn = originals.warn; console.log = originals.log;
  }
  assert.equal(logged.join(' ').includes('rarible-secret-key'), false);
});

test('coalesces concurrent refreshes and returns defensive fresh-cache clones', async () => {
  let resolveFetch;
  let calls = 0;
  const pending = new Promise(resolve => { resolveFetch = resolve; });
  const load = createLooperMarketplaceRaribleListingsLoader({
    apiKey: 'key', now: () => NOW_MS,
    fetchImpl: async () => { calls += 1; return pending; },
  });
  const first = load();
  const second = load();
  assert.equal(calls, 1);
  resolveFetch(jsonResponse(page([item()])));
  const [a, b] = await Promise.all([first, second]);
  assert.deepEqual(a, b);
  assert.notEqual(a, b);
  a.listings[0].price.amount = 'tampered';
  assert.equal((await load()).listings[0].price.amount, '1');
  assert.equal(calls, 1);
});

test('serves a prior snapshot as stale only within max-stale age', async () => {
  let current = NOW_MS;
  let fail = false;
  let calls = 0;
  const load = createLooperMarketplaceRaribleListingsLoader({
    apiKey: 'key', now: () => current, freshTtlMs: 100, maxStaleMs: 500,
    fetchImpl: async () => {
      calls += 1;
      if (fail) throw new Error('private failure');
      return jsonResponse(page([item()]));
    },
  });
  const fresh = await load();
  fail = true;
  current += 101;
  const stale = await load();
  assert.equal(stale.status, 'stale');
  assert.equal(stale.observed_at, fresh.observed_at);
  assert.deepEqual(stale.listings, fresh.listings);
  current = NOW_MS + 501;
  await assert.rejects(load(), { message: 'Looper Rarible marketplace upstream unavailable.' });
  assert.equal(calls, 3);
});
