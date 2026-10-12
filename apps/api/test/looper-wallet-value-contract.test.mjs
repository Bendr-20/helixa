import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import {
  CRED_ADDRESS,
  CRED_PAIR_ID,
  CRED_WETH_ADDRESS,
  LOOPERS_COLLECTION,
  PANTHEON_STAKES_ABI,
  RELEASED_ACCOUNT_IMPLEMENTATION,
  assertWalletValueQuoteFreshness,
  computeTotalUsdE8,
  decimalToUsdE8,
  deriveChecksummedLooperAccount,
  loadWalletValueQuotes,
  parseWalletValueRoster,
  validateWalletValueSnapshot,
} from '../src/looper-wallet-value-contract.js';

function roster(overrides = {}) {
  return {
    schema_version: '1.0.0', chain_id: 8453, contract: LOOPERS_COLLECTION,
    implementation: RELEASED_ACCOUNT_IMPLEMENTATION, observed_block: 52_490_000,
    observed_at: '2026-10-12T00:00:00.000Z', count: 2, token_ids: ['1', '2245'],
    ...overrides,
  };
}

function rosterBytes(value = roster()) { return new TextEncoder().encode(JSON.stringify(value)); }

test('parses exact roster bytes and hashes the original bytes', () => {
  const bytes = rosterBytes();
  const parsed = parseWalletValueRoster(bytes);
  assert.deepEqual(parsed.tokenIds, ['1', '2245']);
  assert.equal(parsed.rawSha256, createHash('sha256').update(bytes).digest('hex'));
  assert.throws(() => parseWalletValueRoster(rosterBytes({ ...roster(), extra: true })), /roster/i);
  assert.throws(() => parseWalletValueRoster(rosterBytes({ ...roster(), token_ids: ['1', '1'] })), /roster/i);
  assert.throws(() => parseWalletValueRoster(rosterBytes({ ...roster(), count: 1 })), /roster/i);
  assert.doesNotThrow(() => parseWalletValueRoster(rosterBytes({ ...roster(), contract: LOOPERS_COLLECTION.toLowerCase() })));
});

test('pins the exact nine-field Pantheon stakes tuple', () => {
  const outputs = PANTHEON_STAKES_ABI[0].outputs;
  assert.deepEqual(outputs.map(({ name, type }) => [name, type]), [
    ['amount', 'uint256'], ['autoRestake', 'bool'], ['lockMonths', 'uint16'], ['lockDuration', 'uint32'],
    ['stakeTime', 'uint32'], ['unstakeRequestTime', 'uint32'], ['unstakeTime', 'uint32'],
    ['stakeMonthIndex', 'uint32'], ['compounderEnabled', 'bool'],
  ]);
});

test('converts positive decimal quotes to USD e8 by truncation', () => {
  assert.equal(decimalToUsdE8('2542.565'), '254256500000');
  assert.equal(decimalToUsdE8('0.0000011029'), '110');
  assert.throws(() => decimalToUsdE8('0'), /quote|price/i);
  assert.throws(() => decimalToUsdE8('01.2'), /quote|price/i);
  assert.throws(() => decimalToUsdE8('1e3'), /quote|price/i);
});

test('includes liquid and staked CRED exactly once using BigInt math', () => {
  assert.equal(computeTotalUsdE8({
    ethWei: '1000000000000000000', liquidCredBaseUnits: '2000000000000000000',
    stakedCredBaseUnits: '3000000000000000000', ethPriceUsdE8: '250000000000', credPriceUsdE8: '110',
  }), '250000000550');
});

test('loads only the pinned ETH and Base CRED/WETH quote identities', async () => {
  const requests = [];
  const fetchImpl = async (url, init) => {
    requests.push([String(url), init]);
    if (String(url).includes('coinbase.com')) return Response.json({ data: { base: 'ETH', currency: 'USD', amount: '2542.565' } });
    return Response.json({ pairs: [{
      chainId: 'base', dexId: 'uniswap', pairAddress: CRED_PAIR_ID,
      baseToken: { address: CRED_ADDRESS.toLowerCase(), symbol: 'CRED' },
      quoteToken: { address: CRED_WETH_ADDRESS, symbol: 'WETH' }, priceUsd: '0.0000011029', liquidity: { usd: 81249.21 },
    }] });
  };
  const quotes = await loadWalletValueQuotes({ fetchImpl, now: () => 1_000 });
  assert.equal(quotes.eth.priceUsdE8, '254256500000');
  assert.equal(quotes.cred.priceUsdE8, '110');
  assert.equal(requests.length, 2);
  assert.ok(requests.every(([, init]) => init.redirect === 'error' && init.credentials === 'omit'));
  assert.deepEqual(requests.map(([url]) => new URL(url).host).sort(), ['api.coinbase.com', 'api.dexscreener.com']);
});

test('rejects duplicate, wrong-identity and low-liquidity CRED pairs', async () => {
  const good = {
    chainId: 'base', dexId: 'uniswap', pairAddress: CRED_PAIR_ID,
    baseToken: { address: CRED_ADDRESS, symbol: 'CRED' }, quoteToken: { address: CRED_WETH_ADDRESS, symbol: 'WETH' },
    priceUsd: '0.000001102', liquidity: { usd: 81249.21 },
  };
  for (const pairs of [[good, good], [{ ...good, pairAddress: '0x' + '1'.repeat(64) }], [{ ...good, liquidity: { usd: 9999 } }]]) {
    const fetchImpl = async (url) => String(url).includes('coinbase.com')
      ? Response.json({ data: { base: 'ETH', currency: 'USD', amount: '1' } })
      : Response.json({ pairs });
    await assert.rejects(loadWalletValueQuotes({ fetchImpl, now: () => 1_000 }), /quote/i);
  }
});

test('enforces quote age and cross-source skew', () => {
  assert.doesNotThrow(() => assertWalletValueQuoteFreshness({ ethObservedMs: 1_000, credObservedMs: 10_000 }, 60_000));
  assert.throws(() => assertWalletValueQuoteFreshness({ ethObservedMs: 1_000, credObservedMs: 11_001 }, 60_000), /skew/i);
  assert.throws(() => assertWalletValueQuoteFreshness({ ethObservedMs: 1_000, credObservedMs: 2_000 }, 61_001), /stale/i);
});

test('validates complete ordered snapshots and checksummed accounts', () => {
  const bytes = rosterBytes();
  const parsed = parseWalletValueRoster(bytes);
  const account1 = deriveChecksummedLooperAccount('1');
  const account2 = deriveChecksummedLooperAccount('2245');
  assert.match(account1, /^0x[0-9A-Fa-f]{40}$/u);
  const snapshot = {
    schema_version: '1.0.0', chain_id: 8453, status: 'fresh', valuation_status: 'unavailable',
    roster: { sha256: parsed.rawSha256, count: 2, observed_block: parsed.observedBlock, observed_at: parsed.observedAt },
    block: { number: 52_500_000, hash: '0x' + 'a'.repeat(64), observed_at: '2026-10-12T00:01:00.000Z' },
    generated_at: '2026-10-12T00:01:01.000Z', fresh_until: '2026-10-12T00:06:01.000Z', stale_until: '2026-10-12T00:16:01.000Z',
    quotes: null,
    rows: [
      { status: 'available', token_id: '1', account: account1, eth_wei: '0', liquid_cred_base_units: '0', staked_cred_base_units: '0', total_usd_e8: null },
      { status: 'available', token_id: '2245', account: account2, eth_wei: '1', liquid_cred_base_units: '2', staked_cred_base_units: '3', total_usd_e8: null },
    ],
  };
  assert.doesNotThrow(() => validateWalletValueSnapshot(snapshot, parsed));
  assert.throws(() => validateWalletValueSnapshot({ ...snapshot, rows: snapshot.rows.slice(0, 1) }, parsed), /snapshot|rows/i);
  assert.throws(() => validateWalletValueSnapshot({ ...snapshot, rows: [{ ...snapshot.rows[0], account: account1.toLowerCase() }, snapshot.rows[1]] }, parsed), /account/i);
});
