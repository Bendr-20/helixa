'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeLooperRoster,
  normalizeProviderConfig,
  collectBaseProofSnapshot,
  BASE_CHAIN_ID,
  MAX_LOOPERS,
  RPC_BATCH_LOOPERS,
  defaultRpc,
} = require('../../cred-looper/collector');

const COLLECTION = '0x1111111111111111111111111111111111111111';
const ACCOUNT = '0x2222222222222222222222222222222222222222';
const OWNER = '0x3333333333333333333333333333333333333333';
const CRED = '0x4444444444444444444444444444444444444444';
const STAKED = '0x5555555555555555555555555555555555555555';
function word(value) { return value.replace(/^0x/u, '').padStart(64, '0'); }
function binding(tokenId = '7') { return '0x' + word('0x2105') + word(COLLECTION) + word('0x' + BigInt(tokenId).toString(16)); }
function roster() {
  return { rosterType: 'looper-base-roster-v1', chainId: '8453', collection: COLLECTION, loopers: [{ tokenId: '7', account: ACCOUNT, owner: OWNER }] };
}
function providers() {
  return { providerSetType: 'base-rpc-provider-set-v1', providers: [
    { providerId: 'base_a', url: 'https://mainnet.base.org' },
    { providerId: 'base_b', url: 'https://base-rpc.publicnode.com' },
  ] };
}
function assets() { return { liquidCredContract: CRED, stakingVaultContract: STAKED, stakingTokenContract: CRED }; }
function replies(overrides = {}) {
  const values = {
    eth_chainId: '0x2105',
    eth_blockNumber: '0x63',
    eth_getBlockByNumber: { number: '0x63', hash: '0x' + 'ab'.repeat(32), timestamp: '0x6553f100' },
    eth_getCode: '0x60006000',
    owner: '0x' + word(OWNER),
    token: binding(),
    eth_getBalance: '0x1',
    liquid: '0x' + word('0x2'),
    staked: '0x' + word('0x0'),
    ...overrides,
  };
  return async (provider, method, params) => {
    if (typeof values[provider.providerId + ':' + method] !== 'undefined') return values[provider.providerId + ':' + method];
    if (method === 'eth_call') {
      const data = params[0].data;
      if (data === '0x8da5cb5b') return values.owner;
      if (data === '0xfc0c546a') return values.token;
      if (params[0].to === CRED) return values.liquid;
      if (params[0].to === STAKED) {
        assert.equal(data.startsWith('0xa4e47b66'), true, 'staking vault must call stakes(address,address)');
        assert.equal(data.endsWith(word(CRED)), true, 'staking vault must query the CRED staking token');
        return values.staked + word('0x1') + word('0x2') + word('0x3') + word('0x4') + word('0x5') + word('0x6') + word('0x7') + word('0x0');
      }
    }
    return values[method];
  };
}

test('normalizes only a bounded exact Base Looper roster', () => {
  assert.equal(BASE_CHAIN_ID, '8453');
  assert.deepEqual(normalizeLooperRoster(roster()).loopers[0], { tokenId: '7', account: ACCOUNT, owner: OWNER });
  const extra = roster(); extra.extra = true;
  assert.throws(() => normalizeLooperRoster(extra), /unknown field/);
  const duplicate = roster(); duplicate.loopers.push(structuredClone(duplicate.loopers[0]));
  assert.throws(() => normalizeLooperRoster(duplicate), /duplicate tokenId/);
  const tooMany = roster(); tooMany.loopers = Array.from({ length: MAX_LOOPERS + 1 }, (_, i) => ({ tokenId: String(i), account: ACCOUNT, owner: OWNER }));
  assert.throws(() => normalizeLooperRoster(tooMany), /at most 688/);
  const wrongChain = roster(); wrongChain.chainId = '1';
  assert.throws(() => normalizeLooperRoster(wrongChain), /Base chainId/);
});

test('requires exactly two distinct allowlisted HTTPS Base providers', () => {
  assert.equal(normalizeProviderConfig(providers()).providers.length, 2);
  for (const mutate of [
    value => value.providers.pop(),
    value => value.providers.push({ providerId: 'base_c', url: 'https://base.llamarpc.com' }),
    value => { value.providers[1].providerId = value.providers[0].providerId; },
    value => { value.providers[1].url = value.providers[0].url; },
    value => { value.providers[0].url = 'http://mainnet.base.org'; },
    value => { value.providers[0].url = 'https://evil.example/rpc'; },
    value => { value.providers[0].url = 'https://user:pass@mainnet.base.org'; },
  ]) {
    const value = providers(); mutate(value);
    assert.throws(() => normalizeProviderConfig(value), /exactly two|distinct|HTTPS|allowlist|credentials/);
  }
});

test('pins one common block and accepts only byte-identical bindings and balances', async () => {
  const rpc = replies({ 'base_a:eth_blockNumber': '0x64', 'base_b:eth_blockNumber': '0x63' });
  const snapshot = await collectBaseProofSnapshot(roster(), providers(), assets(), rpc);
  assert.equal(snapshot.snapshotType, 'looper-base-proof-snapshot-v1');
  assert.equal(snapshot.chainId, '8453');
  assert.equal(snapshot.blockNumber, '99');
  assert.equal(snapshot.observedAt, '2023-11-14T22:13:20.000Z');
  assert.deepEqual(snapshot.providers, [{ providerId: 'base_a' }, { providerId: 'base_b' }]);
  assert.deepEqual(snapshot.accountProofs[0].tokenBinding, { chainId: '8453', collection: COLLECTION, tokenId: '7' });
  assert.equal(snapshot.accountProofs[0].owner, OWNER);
  assert.deepEqual(snapshot.balances[0], { tokenId: '7', address: ACCOUNT, ethWei: '1', liquidCred: '2', stakedCred: '0' });
  assert.equal(JSON.stringify(snapshot).includes('https://'), false);
});

test('fails closed on provider disagreement, malformed account responses, roster mismatch, or undeployed accounts', async () => {
  await assert.rejects(() => collectBaseProofSnapshot(roster(), providers(), assets(), replies({ 'base_a:eth_getBlockByNumber': { number: '0x63', hash: '0x' + 'ab'.repeat(32), timestamp: '0x6553f100' }, 'base_b:eth_getBlockByNumber': { number: '0x63', hash: '0x' + 'cd'.repeat(32), timestamp: '0x6553f100' } })), /block hash disagreement/);
  await assert.rejects(() => collectBaseProofSnapshot(roster(), providers(), assets(), replies({ 'base_b:eth_call': '0x' + word('0x9999999999999999999999999999999999999999') })), /provider disagreement|owner/);
  await assert.rejects(() => collectBaseProofSnapshot(roster(), providers(), assets(), replies({ token: binding('8') })), /token binding/);
  await assert.rejects(() => collectBaseProofSnapshot(roster(), providers(), assets(), replies({ eth_getCode: '0x' })), /deployed code/);
});


test('uses bounded parallel RPC work for large rosters', async () => {
  const value = roster();
  value.loopers = Array.from({ length: 8 }, (_, index) => ({ tokenId: String(index + 7), account: '0x' + (index + 20).toString(16).padStart(40, '0'), owner: OWNER }));
  const byAccount = new Map(value.loopers.map(item => [item.account, item.tokenId]));
  const base = replies(); let active = 0, maximum = 0;
  const rpc = async (provider, method, params) => {
    active += 1; maximum = Math.max(maximum, active);
    await new Promise(resolve => setTimeout(resolve, 1));
    try {
      if (method === 'eth_call' && params[0].data === '0xfc0c546a') return binding(byAccount.get(params[0].to));
      return await base(provider, method, params);
    } finally { active -= 1; }
  };
  const snapshot = await collectBaseProofSnapshot(value, providers(), assets(), rpc);
  assert.equal(snapshot.accountProofs.length, 8);
  assert.ok(maximum > 2, 'collector should parallelize independent bounded calls');
  assert.ok(maximum <= 48, 'collector exceeded its 4-Looper/12-RPC bound');
});


test('default transport bounds batches and restores request order', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (_url, options) => {
    const payload = JSON.parse(options.body);
    assert.equal(Array.isArray(payload), true);
    return new Response(JSON.stringify([
      { jsonrpc: '2.0', id: 2, result: 'second' },
      { jsonrpc: '2.0', id: 1, result: 'first' },
    ]), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const result = await defaultRpc.batch({ providerId: 'test', url: 'https://mainnet.base.org/' }, [
    { method: 'eth_chainId', params: [] },
    { method: 'eth_blockNumber', params: [] },
  ]);
  assert.deepEqual(result, ['first', 'second']);
  await assert.rejects(() => defaultRpc.batch({ providerId: 'test', url: 'https://mainnet.base.org/' }, Array.from({ length: RPC_BATCH_LOOPERS * 6 + 1 }, () => ({ method: 'eth_chainId', params: [] }))), /batch size/);
});
