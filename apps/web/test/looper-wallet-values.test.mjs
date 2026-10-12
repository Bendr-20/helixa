import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { loadDailyActivatedLooperTokenIds } from '../src/looper-activated-roster.js';
import { joinVerifiedLooperWalletValues, loadLooperWalletValues, normalizeLooperWalletValues } from '../src/looper-wallet-values.js';

const SHA = 'a'.repeat(64);
const ACCOUNT = '0x36f35F7E0Ff5b7b4a30138Fd59F5741743389DF2';

function snapshot(overrides = {}) {
  return {
    schema_version: '1.0.0', chain_id: 8453, status: 'fresh', valuation_status: 'available',
    roster: { sha256: SHA, count: 1, observed_block: 52_500_000, observed_at: '2026-10-12T01:00:00.000Z' },
    block: { number: 52_500_100, hash: '0x' + 'b'.repeat(64), observed_at: '2026-10-12T01:01:00.000Z' },
    generated_at: '2026-10-12T01:01:01.000Z', fresh_until: '2026-10-12T01:06:01.000Z', stale_until: '2026-10-12T01:16:01.000Z',
    quotes: {
      eth: { asset: 'ETH', source: 'coinbase', price_usd_e8: '250000000000', observed_at: '2026-10-12T01:01:00.000Z' },
      cred: { asset: 'CRED', contract: '0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3', source: 'dexscreener-uniswap-base', pool_id: '0x55a4f7a23c4c2616cf848e639a08bd4283d13e66f5fcf34f828b5ca7e4e96324', price_usd_e8: '110', observed_at: '2026-10-12T01:01:00.000Z' },
    },
    rows: [{ status: 'available', token_id: '1', account: ACCOUNT, eth_wei: '1', liquid_cred_base_units: '2', staked_cred_base_units: '3', total_usd_e8: '4' }],
    ...overrides,
  };
}

test('daily roster hashes exact response bytes before decoding', async () => {
  const value = {
    schema_version: '1.0.0', chain_id: 8453, contract: '0x1649CD37f4748807b4882FC48765bA0B2aFfa94a',
    implementation: '0xf192f350427c8F58bC28e78b1e6Af164279F486e', observed_block: 52_500_000,
    observed_at: '2026-10-12T01:00:00.000Z', count: 328,
    token_ids: (await import('../src/looper-activated-roster.js')).ACTIVATED_LOOPER_TOKEN_IDS,
  };
  const text = JSON.stringify(value, null, 2) + '\n';
  const loaded = await loadDailyActivatedLooperTokenIds({ fetchImpl: async () => new Response(text) });
  assert.equal(loaded.status, 'available');
  assert.equal(loaded.rawSha256, createHash('sha256').update(text).digest('hex'));
});

test('wallet loader uses the fixed same-origin route and validates the response', async () => {
  const requests = [];
  const loaded = await loadLooperWalletValues({
    fetchImpl: async (url, init) => { requests.push([url, init]); return Response.json(snapshot()); },
  });
  assert.equal(requests[0][0], '/multipass-api/api/loopers/marketplace/wallet-values');
  assert.equal(loaded.rows[0].stakedCredBaseUnits, '3');
  assert.equal(loaded.rows[0].totalUsdE8, '4');
});

test('normalizer rejects incomplete duplicate extra and noncanonical rows', () => {
  assert.throws(() => normalizeLooperWalletValues({ ...snapshot(), extra: true }), /wallet/i);
  assert.throws(() => normalizeLooperWalletValues({ ...snapshot(), rows: [] }), /wallet/i);
  assert.throws(() => normalizeLooperWalletValues({ ...snapshot(), rows: [snapshot().rows[0], snapshot().rows[0]], roster: { ...snapshot().roster, count: 2 } }), /wallet/i);
  assert.throws(() => normalizeLooperWalletValues({ ...snapshot(), rows: [{ ...snapshot().rows[0], total_usd_e8: '04' }] }), /wallet/i);
});

test('verified join requires exact wallet hash and live/static token-set equality', () => {
  const walletValues = normalizeLooperWalletValues(snapshot());
  const live = { status: 'available', tokenIds: new Set(['1']) };
  const daily = { status: 'available', rawSha256: SHA, tokenIds: new Set(['1']) };
  const joined = joinVerifiedLooperWalletValues({ walletValues, liveActivation: live, staticActivation: daily });
  assert.equal(joined.status, 'available');
  assert.equal(joined.rowsByToken.get('1').stakedCredBaseUnits, '3');
  assert.equal(joinVerifiedLooperWalletValues({ walletValues, liveActivation: { status: 'unavailable', tokenIds: new Set() }, staticActivation: daily }).status, 'unavailable');
  assert.equal(joinVerifiedLooperWalletValues({ walletValues, liveActivation: live, staticActivation: { ...daily, rawSha256: 'c'.repeat(64) } }).status, 'unavailable');
  assert.equal(joinVerifiedLooperWalletValues({ walletValues, liveActivation: { status: 'available', tokenIds: new Set(['1', '2']) }, staticActivation: daily }).status, 'unavailable');
});

test('balance-only snapshots retain raw balances but report unavailable valuation', () => {
  const raw = snapshot({ valuation_status: 'unavailable', quotes: null, rows: [{ ...snapshot().rows[0], total_usd_e8: null }] });
  const normalized = normalizeLooperWalletValues(raw);
  assert.equal(normalized.valuationStatus, 'unavailable');
  assert.equal(normalized.rows[0].liquidCredBaseUnits, '2');
  assert.equal(normalized.rows[0].totalUsdE8, null);
});
