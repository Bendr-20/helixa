'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PILOT,
  PROVIDERS,
  METHODOLOGY_ID,
  deriveReleasedLooperAccount,
  buildReleasedLooperAccountRuntime,
  createLooperCredService,
} = require('../../cred-looper-live/service');

const BLOCK = { number: '0x6c', hash: '0x' + 'ab'.repeat(32), timestamp: '0x6ad92400' };
const CONTROLLER = '0xd31fcdb0432d3c9bf9d98643f69c7edd690e48e8';

function word(value) {
  const raw = typeof value === 'bigint' ? value.toString(16) : String(value).replace(/^0x/u, '');
  return raw.padStart(64, '0');
}
function addressWord(value) { return word(value); }
function tokenBinding(tokenId) {
  return '0x' + word(8453n) + addressWord(PILOT.collection) + word(BigInt(tokenId));
}
function stakeTuple({ amount = 10n ** 18n, lockMonths = 6n, unstakeRequestTime = 0n, unstakeTime = 0n } = {}) {
  const stakeTime = BigInt(Math.floor(Date.parse('2026-10-21T20:40:03Z') / 1000));
  return '0x' + [amount, 0n, lockMonths, 16_588_800n, stakeTime, unstakeRequestTime, unstakeTime, 681n, 0n].map(word).join('');
}
function poolTuple() { return '0x' + [1n, 0n, 123n].map(word).join(''); }

function makeRpc({ tokenId = '2431', stake = stakeTuple(), overrides = {} } = {}) {
  const account = deriveReleasedLooperAccount(tokenId);
  const receipt = {
    transactionHash: PILOT.credifi.repaymentTxHash,
    status: '0x1', blockNumber: '0x63', blockHash: '0x' + 'cd'.repeat(32),
    from: CONTROLLER, to: account,
  };
  const transaction = { hash: PILOT.credifi.repaymentTxHash, blockNumber: '0x63', blockHash: receipt.blockHash, from: CONTROLLER, to: account };
  const values = {
    eth_chainId: '0x2105', eth_blockNumber: '0x80', eth_getBlockByNumber: BLOCK,
    eth_getCode: buildReleasedLooperAccountRuntime(tokenId),
    owner: '0x' + addressWord(CONTROLLER), ownerOf: '0x' + addressWord(CONTROLLER),
    token: tokenBinding(tokenId), pool: poolTuple(), stake,
    eth_getTransactionReceipt: receipt, eth_getTransactionByHash: transaction,
    ...overrides,
  };
  const calls = [];
  const rpc = async (provider, method, params) => {
    calls.push({ provider, method, params });
    const keyed = values[provider.id + ':' + method];
    if (keyed !== undefined) return keyed;
    if (method === 'eth_call') {
      const selector = params[0].data.slice(0, 10);
      const labels = { '0x8da5cb5b': 'owner', '0xfc0c546a': 'token', '0x6352211e': 'ownerOf', '0xa4063dbc': 'pool', '0xa4e47b66': 'stake' };
      const label = labels[selector];
      if (!label) throw new Error('unexpected selector ' + selector);
      return values[provider.id + ':' + label] ?? values[label];
    }
    return values[method];
  };
  rpc.calls = calls;
  return rpc;
}
function service(rpc, now = Date.parse('2026-10-21T20:45:00Z')) {
  return createLooperCredService({ rpc, now: () => now, cacheTtlMs: 60_000 });
}

test('derives the released canonical account and runtime for every Looper token ID', () => {
  assert.equal(deriveReleasedLooperAccount('2431'), PILOT.account);
  assert.match(deriveReleasedLooperAccount('11'), /^0x[0-9a-f]{40}$/u);
  assert.notEqual(deriveReleasedLooperAccount('11'), deriveReleasedLooperAccount('12'));
  assert.match(buildReleasedLooperAccountRuntime('2431'), /^0x[0-9a-f]+$/u);
});

test('publishes identity-bound provisional score 42 for a non-pilot active Pantheon Looper', async () => {
  const rpc = makeRpc({ tokenId: '11' });
  const record = await service(rpc).getByLooperId('11');
  assert.equal(record.methodologyId, METHODOLOGY_ID);
  assert.equal(record.ratingStatus, 'PROVISIONAL');
  assert.equal(record.score, 42);
  assert.equal(record.tier, 'Marginal');
  assert.deepEqual(record.scoreComponents.map(({ scoreImpact }) => scoreImpact), [40, 2]);
  assert.equal(record.identity.looperTokenId, '11');
  assert.equal(record.identity.account, deriveReleasedLooperAccount('11'));
  assert.equal(record.actorEpoch.controller, CONTROLLER);
  assert.deepEqual(record.observations, []);
  assert.ok(rpc.calls.filter(call => call.method === 'eth_call').every(call => call.params[1] === '0x6c'));
  assert.deepEqual([...new Set(rpc.calls.map(call => call.provider.url))], PROVIDERS.map(provider => provider.url));
});

test('publishes activated baseline 40 when Pantheon stake is zero', async () => {
  const record = await service(makeRpc({ tokenId: '12', stake: stakeTuple({ amount: 0n }) })).getByLooperId('12');
  assert.equal(record.score, 40);
  assert.deepEqual(record.scoreComponents.map(({ scoreImpact }) => scoreImpact), [40]);
  assert.ok(!record.reasonCodes.includes('PANTHEON_ACTIVE_CRED_POSITION'));
});

test('Pantheon amount and lock duration never change the bounded +2 active-position component', async () => {
  for (const [tokenId, amount, lockMonths] of [['13', 1n, 1n], ['14', 10n ** 18n, 6n], ['15', (1n << 256n) - 1n, 12n]]) {
    const record = await service(makeRpc({ tokenId, stake: stakeTuple({ amount, lockMonths }) })).getByLooperId(tokenId);
    assert.equal(record.score, 42);
    assert.equal(record.scoreComponents[1].scoreImpact, 2);
    assert.equal(record.evidence.pantheon.position.amount, amount.toString());
  }
});

test('an exiting Pantheon position remains evidence but gets no active-position points', async () => {
  const record = await service(makeRpc({ tokenId: '16', stake: stakeTuple({ unstakeRequestTime: 1n }) })).getByLooperId('16');
  assert.equal(record.score, 40);
  assert.equal(record.evidence.pantheon.position.unstakeRequestTime, '1');
});

test('Credifi repayment stays a zero-impact #2431-only observation', async () => {
  const record = await service(makeRpc()).getByLooperId('2431');
  assert.equal(record.score, 42);
  assert.equal(record.observations.length, 1);
  assert.equal(record.observations[0].scoreImpact, 0);
  assert.equal(record.observations[0].repaymentTxHash, PILOT.credifi.repaymentTxHash);
});

test('fails closed on provider disagreement, runtime mismatch, ownership mismatch, or token mismatch', async () => {
  const cases = [
    [{ 'base_drpc:stake': stakeTuple({ amount: 2n }) }, /provider disagreement.*stake/i],
    [{ eth_getCode: '0x6000' }, /runtime/i],
    [{ ownerOf: '0x' + addressWord('0x1111111111111111111111111111111111111111') }, /owner/i],
    [{ token: tokenBinding('99') }, /token binding/i],
  ];
  for (const [overrides, pattern] of cases) {
    await assert.rejects(() => service(makeRpc({ tokenId: '17', overrides })).getByLooperId('17'), pattern);
  }
});

test('rejects undeployed or out-of-range Loopers and non-string IDs', async () => {
  await assert.rejects(() => service(makeRpc({ tokenId: '18', overrides: { eth_getCode: '0x' } })).getByLooperId('18'), error => error.code === 'UNSUPPORTED_LOOPER');
  await assert.rejects(() => service(makeRpc()).getByLooperId('0'), /range/i);
  await assert.rejects(() => service(makeRpc()).getByLooperId('7778'), /range/i);
  await assert.rejects(() => service(makeRpc()).getByLooperId(2431), /exact canonical string/i);
});

test('bounds concurrent evidence collection across distinct token IDs', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const rpc = async () => { await gate; throw new Error('released test request'); };
  const value = createLooperCredService({ rpc, maxConcurrent: 1 });
  const first = value.getByLooperId('11');
  await assert.rejects(() => value.getByLooperId('12'), /service is busy/i);
  release();
  await assert.rejects(() => first, /released test request/i);
});

test('never serves expired cache after dual-provider evidence fails', async () => {
  const base = makeRpc({ tokenId: '19' });
  let now = Date.parse('2026-10-21T20:45:00Z');
  let fail = false;
  const rpc = async (...args) => { if (fail) throw new Error('RPC offline'); return base(...args); };
  const value = createLooperCredService({ rpc, now: () => now, cacheTtlMs: 60_000 });
  assert.equal((await value.getByLooperId('19')).score, 42);
  fail = true;
  assert.equal((await value.getByLooperId('19')).score, 42);
  now += 60_001;
  await assert.rejects(() => value.getByLooperId('19'), /RPC offline/);
});

test('rejects failed or misbound Credifi repayment without granting #2431 output', async () => {
  const account = deriveReleasedLooperAccount('2431');
  const failed = makeRpc({ overrides: { eth_getTransactionReceipt: {
    transactionHash: PILOT.credifi.repaymentTxHash, status: '0x0', blockNumber: '0x63', blockHash: '0x' + 'cd'.repeat(32), from: CONTROLLER, to: account,
  } } });
  await assert.rejects(() => service(failed).getByLooperId('2431'), /repayment.*succeed/i);
  const misbound = makeRpc({ overrides: { eth_getTransactionByHash: {
    hash: PILOT.credifi.repaymentTxHash, blockNumber: '0x63', blockHash: '0x' + 'cd'.repeat(32), from: CONTROLLER, to: '0x1111111111111111111111111111111111111111',
  } } });
  await assert.rejects(() => service(misbound).getByLooperId('2431'), /identity binding/i);
});
