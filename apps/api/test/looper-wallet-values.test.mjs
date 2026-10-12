import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { decodeFunctionData, encodeFunctionResult } from 'viem';

import {
  CRED_ADDRESS, LOOPERS_COLLECTION, MULTICALL3, PANTHEON_STAKING_VAULT, RELEASED_ACCOUNT_IMPLEMENTATION,
} from '../src/looper-wallet-value-contract.js';
import {
  ERC20_BALANCE_ABI,
  MULTICALL3_ABI,
  MULTICALL_GET_ETH_BALANCE_ABI,
  createLooperWalletValueRefresher,
  createLooperWalletValuesLoader,
} from '../src/looper-wallet-values.js';

const NOW = Date.parse('2026-10-12T01:00:00.000Z');
const BLOCK = 52_500_000;
const BLOCK_HEX = '0x' + BLOCK.toString(16);
const BLOCK_HASH = '0x' + 'a'.repeat(64);

async function rosterFile(count) {
  const dir = await mkdtemp(join(tmpdir(), 'wallet-values-'));
  const path = join(dir, 'roster.json');
  await writeFile(path, JSON.stringify({
    schema_version: '1.0.0', chain_id: 8453, contract: LOOPERS_COLLECTION,
    implementation: RELEASED_ACCOUNT_IMPLEMENTATION, observed_block: BLOCK - 100,
    observed_at: new Date(NOW - 60_000).toISOString(), count,
    token_ids: Array.from({ length: count }, (_, index) => String(index + 1)),
  }));
  return path;
}

function quoteLoader() {
  return Promise.resolve({
    eth: { asset: 'ETH', source: 'coinbase', priceUsdE8: '250000000000', observedAt: new Date(NOW).toISOString() },
    cred: { asset: 'CRED', contract: CRED_ADDRESS, source: 'dexscreener-uniswap-base', poolId: '0x55a4f7a23c4c2616cf848e639a08bd4283d13e66f5fcf34f828b5ca7e4e96324', priceUsdE8: '110', observedAt: new Date(NOW).toISOString() },
    generatedMs: NOW,
  });
}

function createRpcFixture({ disagree = false, reorg = false, failProvider = null } = {}) {
  const calls = [];
  let postReads = 0;
  const rpcImpl = async (provider, method, params) => {
    calls.push({ provider, method, params });
    if (provider === failProvider) throw new Error('provider failed');
    if (method === 'eth_getBlockByNumber') {
      const tag = params[0];
      if (tag === 'latest') return { result: { number: provider.endsWith('two') ? '0x' + (BLOCK + 1).toString(16) : BLOCK_HEX, hash: BLOCK_HASH, timestamp: '0x' + Math.floor(NOW / 1000).toString(16) }, bytes: 128 };
      postReads += 1;
      const changed = reorg && postReads > 2;
      return { result: { number: BLOCK_HEX, hash: changed ? '0x' + 'b'.repeat(64) : BLOCK_HASH, timestamp: '0x' + Math.floor(NOW / 1000).toString(16) }, bytes: 128 };
    }
    if (method === 'eth_call') {
      const decoded = decodeFunctionData({ abi: MULTICALL3_ABI, data: params[0].data });
      const results = decoded.args[0].map((call, index) => {
        let returnData;
        if (call.target.toLowerCase() === MULTICALL3.toLowerCase()) {
          returnData = encodeFunctionResult({ abi: MULTICALL_GET_ETH_BALANCE_ABI, functionName: 'getEthBalance', result: disagree && provider.endsWith('two') && index === 0 ? 1n : 0n });
        } else if (call.target.toLowerCase() === CRED_ADDRESS.toLowerCase()) {
          returnData = encodeFunctionResult({ abi: ERC20_BALANCE_ABI, functionName: 'balanceOf', result: 2n });
        } else if (call.target.toLowerCase() === PANTHEON_STAKING_VAULT.toLowerCase()) {
          returnData = encodeFunctionResult({ abi: [{ type: 'function', name: 'stakes', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }, { name: 'stakingToken', type: 'address' }], outputs: [
            { name: 'amount', type: 'uint256' }, { name: 'autoRestake', type: 'bool' }, { name: 'lockMonths', type: 'uint16' }, { name: 'lockDuration', type: 'uint32' }, { name: 'stakeTime', type: 'uint32' }, { name: 'unstakeRequestTime', type: 'uint32' }, { name: 'unstakeTime', type: 'uint32' }, { name: 'stakeMonthIndex', type: 'uint32' }, { name: 'compounderEnabled', type: 'bool' },
          ] }], functionName: 'stakes', result: [3n, false, 6, 0, 0, 0, 0, 0, false] });
        } else throw new Error('unexpected target');
        return { success: true, returnData };
      });
      return { result: encodeFunctionResult({ abi: MULTICALL3_ABI, functionName: 'aggregate3', result: results }), bytes: 256 + results.length * 96 };
    }
    throw new Error('unexpected method');
  };
  return { rpcImpl, calls };
}

test('refreshes 1,000 rows in sixteen single Multicall requests per provider', async () => {
  const path = await rosterFile(1_000);
  const fixture = createRpcFixture();
  const refresh = createLooperWalletValueRefresher({
    rosterPath: path, providers: ['https://rpc.one', 'https://rpc.two'], rpcImpl: fixture.rpcImpl,
    quoteLoader, now: () => NOW,
  });
  const snapshot = await refresh();
  assert.equal(snapshot.rows.length, 1_000);
  assert.equal(snapshot.rows[0].total_usd_e8, '0');
  for (const provider of ['https://rpc.one', 'https://rpc.two']) {
    assert.equal(fixture.calls.filter((call) => call.provider === provider && call.method === 'eth_call').length, 16);
  }
  assert.ok(fixture.calls.filter((call) => call.method === 'eth_call').every((call) => call.params[1] === BLOCK_HEX));
  assert.ok(snapshot.rows.every((row) => /[A-F]/u.test(row.account)));
});

test('rejects provider disagreement failure and reorg', async () => {
  for (const options of [{ disagree: true }, { failProvider: 'https://rpc.two' }, { reorg: true }]) {
    const path = await rosterFile(2);
    const fixture = createRpcFixture(options);
    const refresh = createLooperWalletValueRefresher({ rosterPath: path, providers: ['https://rpc.one', 'https://rpc.two'], rpcImpl: fixture.rpcImpl, quoteLoader, now: () => NOW });
    await assert.rejects(refresh(), /provider|disagree|block|refresh/i);
  }
});

test('quote failure preserves verified raw balances with null totals', async () => {
  const path = await rosterFile(2);
  const fixture = createRpcFixture();
  const refresh = createLooperWalletValueRefresher({
    rosterPath: path, providers: ['https://rpc.one', 'https://rpc.two'], rpcImpl: fixture.rpcImpl,
    quoteLoader: async () => { throw new Error('quotes down'); }, now: () => NOW,
  });
  const snapshot = await refresh();
  assert.equal(snapshot.valuation_status, 'unavailable');
  assert.equal(snapshot.quotes, null);
  assert.ok(snapshot.rows.every((row) => row.total_usd_e8 === null));
});

test('cache coalesces cold refreshes and returns exact serialized bytes with strong ETag', async () => {
  let calls = 0;
  let now = NOW;
  const snapshot = { hello: 'world', status: 'fresh', generated_at: new Date(NOW).toISOString() };
  const load = createLooperWalletValuesLoader({ refresh: async () => { calls += 1; return structuredClone(snapshot); }, now: () => now });
  const [left, right] = await Promise.all([load(), load()]);
  assert.equal(calls, 1);
  assert.equal(left.status, 200);
  assert.equal(new TextDecoder().decode(left.bodyBytes), JSON.stringify(snapshot));
  assert.deepEqual(left.bodyBytes, right.bodyBytes);
  assert.match(left.headers.etag, /^"[0-9a-f]{64}"$/u);
  assert.equal(left.headers['content-type'], 'application/json; charset=utf-8');
  now += 1;
  await load();
  assert.equal(calls, 1);
});

test('cache serves stale while refreshing then expires and applies failure cooldown', async () => {
  let now = NOW;
  let calls = 0;
  let fail = false;
  const refresh = async () => {
    calls += 1;
    if (fail) throw new Error('down');
    return { status: 'fresh', generated_at: new Date(now).toISOString(), value: calls };
  };
  const load = createLooperWalletValuesLoader({ refresh, now: () => now });
  await load();
  now += 300_000;
  const stale = await load();
  assert.equal(stale.status, 200);
  assert.equal(JSON.parse(new TextDecoder().decode(stale.bodyBytes)).status, 'stale');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 2);
  fail = true;
  now += 900_000;
  const unavailable = await load();
  assert.equal(unavailable.status, 503);
  assert.deepEqual(JSON.parse(new TextDecoder().decode(unavailable.bodyBytes)), { error: { code: 'wallet_values_unavailable', message: 'Looper wallet values are temporarily unavailable.' } });
  const before = calls;
  await load();
  assert.equal(calls, before);
  now += 60_000;
  await load();
  assert.equal(calls, before + 1);
});


test('enforces decoded response and whole-refresh bounds', async () => {
  const path = await rosterFile(1);
  const tooLarge = createLooperWalletValueRefresher({
    rosterPath: path, providers: ['https://rpc.one', 'https://rpc.two'], quoteLoader, now: () => NOW,
    rpcImpl: async () => ({ result: { number: BLOCK_HEX, hash: BLOCK_HASH, timestamp: '0x1' }, bytes: (4 * 1024 * 1024) + 1 }),
  });
  await assert.rejects(tooLarge(), /decoded data exceeds/i);

  const never = createLooperWalletValueRefresher({
    rosterPath: path, providers: ['https://rpc.one', 'https://rpc.two'], quoteLoader, now: () => NOW,
    requestTimeoutMs: 1, refreshTimeoutMs: 10,
    rpcImpl: async () => new Promise(() => {}),
  });
  await assert.rejects(never(), /timeout|abort/i);
});

test('enforces the per-provider request timeout independently', async () => {
  const path = await rosterFile(1);
  const refresh = createLooperWalletValueRefresher({
    rosterPath: path, providers: ['https://rpc.one', 'https://rpc.two'], quoteLoader, now: () => NOW,
    requestTimeoutMs: 5, refreshTimeoutMs: 100, fetchImpl: async () => new Promise(() => {}),
  });
  await assert.rejects(refresh(), /provider request failed/i);
});

test('enforces the serialized one MiB response limit', async () => {
  const load = createLooperWalletValuesLoader({
    now: () => NOW,
    refresh: async () => ({ status: 'fresh', generated_at: new Date(NOW).toISOString(), payload: 'x'.repeat((1024 * 1024) + 1) }),
  });
  const result = await load();
  assert.equal(result.status, 503);
  assert.deepEqual(JSON.parse(new TextDecoder().decode(result.bodyBytes)), { error: { code: 'wallet_values_unavailable', message: 'Looper wallet values are temporarily unavailable.' } });
});
