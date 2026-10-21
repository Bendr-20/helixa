'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PILOT,
  PROVIDERS,
  METHODOLOGY_ID,
  createLooperCredService,
} = require('../../cred-looper-live/service');

const BLOCK = {
  number: '0x6c',
  hash: '0x' + 'ab'.repeat(32),
  timestamp: '0x6ad92400',
};
const RECEIPT = {
  transactionHash: PILOT.credifi.repaymentTxHash,
  status: '0x1',
  blockNumber: '0x63',
  blockHash: '0x' + 'cd'.repeat(32),
  from: PILOT.controller,
  to: PILOT.account,
};
const TRANSACTION = {
  hash: PILOT.credifi.repaymentTxHash,
  blockNumber: '0x63',
  blockHash: '0x' + 'cd'.repeat(32),
  from: PILOT.controller,
  to: PILOT.account,
};

function word(value) {
  const raw = typeof value === 'bigint' ? value.toString(16) : String(value).replace(/^0x/u, '');
  return raw.padStart(64, '0');
}
function addressWord(value) { return word(value); }
function tokenBinding({ chainId = 8453n, collection = PILOT.collection, tokenId = 2431n } = {}) {
  return '0x' + word(chainId) + addressWord(collection) + word(tokenId);
}
function stakeTuple({
  amount = 10n ** 18n,
  autoRestake = 0n,
  lockMonths = 6n,
  lockDuration = 16_588_800n,
  stakeTime = BigInt(Math.floor(Date.parse('2026-10-21T20:40:03Z') / 1000)),
  unstakeRequestTime = 0n,
  unstakeTime = 0n,
  stakeMonthIndex = 681n,
  compounderEnabled = 0n,
} = {}) {
  return '0x' + [amount, autoRestake, lockMonths, lockDuration, stakeTime, unstakeRequestTime, unstakeTime, stakeMonthIndex, compounderEnabled].map(word).join('');
}
function poolTuple({ active = 1n, cliffMonths = 0n, totalStaked = 123n } = {}) {
  return '0x' + [active, cliffMonths, totalStaked].map(word).join('');
}
function makeRpc(overrides = {}) {
  const calls = [];
  const values = {
    eth_chainId: '0x2105',
    eth_blockNumber: '0x80',
    eth_getBlockByNumber: BLOCK,
    eth_getCode: '0x60006000',
    owner: '0x' + addressWord(PILOT.controller),
    token: tokenBinding(),
    pool: poolTuple(),
    stake: stakeTuple(),
    eth_getTransactionReceipt: RECEIPT,
    eth_getTransactionByHash: TRANSACTION,
    ...overrides,
  };
  const rpc = async (provider, method, params) => {
    calls.push({ provider, method, params });
    const providerKey = `${provider.id}:${method}`;
    if (Object.hasOwn(values, providerKey)) return values[providerKey];
    if (method === 'eth_call') {
      const selector = params[0].data.slice(0, 10);
      if (selector === '0x8da5cb5b') return values[`${provider.id}:owner`] ?? values.owner;
      if (selector === '0xfc0c546a') return values[`${provider.id}:token`] ?? values.token;
      if (selector === '0xa4063dbc') return values[`${provider.id}:pool`] ?? values.pool;
      if (selector === '0xa4e47b66') return values[`${provider.id}:stake`] ?? values.stake;
      throw new Error(`unexpected selector ${selector}`);
    }
    return values[providerKey] ?? values[method];
  };
  rpc.calls = calls;
  return rpc;
}
function service(rpc, now = Date.parse('2026-10-21T20:45:00Z')) {
  return createLooperCredService({ rpc, now: () => now, cacheTtlMs: 60_000 });
}

test('publishes exact identity-bound provisional score 42 at one common Base block', async () => {
  const rpc = makeRpc({ 'base_mainnet:eth_blockNumber': '0x81', 'base_drpc:eth_blockNumber': '0x80' });
  const record = await service(rpc).getByLooperId('2431');

  assert.equal(record.methodologyId, METHODOLOGY_ID);
  assert.equal(record.ratingStatus, 'PROVISIONAL');
  assert.equal(record.score, 42);
  assert.equal(record.tier, 'Marginal');
  assert.equal(record.effectivePrivilegeTier, null);
  assert.equal(record.confidence, null);
  assert.equal(record.coverage, null);
  assert.deepEqual(record.scoreComponents.map(({ scoreImpact }) => scoreImpact), [40, 2]);
  assert.deepEqual(record.identity, {
    subjectId: `looper:8453:${PILOT.collection}:2431`,
    looperTokenId: '2431',
    chainId: '8453',
    collection: PILOT.collection,
    account: PILOT.account,
    erc8004IdentityId: '89144',
  });
  assert.equal(record.actorEpoch.controller, PILOT.controller);
  assert.equal(record.actorEpoch.startedAt, null);
  assert.equal(record.actorEpoch.startTimeStatus, 'NOT_ASSERTED_BY_LIVE_PILOT');
  assert.equal(record.evidence.block.number, '108');
  assert.equal(record.freshness, 'FRESH');
  assert.equal(Date.parse(record.validUntil) - Date.parse(record.computedAt), 60_000);
  assert.ok(rpc.calls.filter(call => call.method === 'eth_call').every(call => call.params[1] === '0x6c'));
  assert.deepEqual([...new Set(rpc.calls.map(call => call.provider.url))], PROVIDERS.map(provider => provider.url));
});

test('uses one agreed block at least 20 confirmations behind both provider heads', async () => {
  const rpc = makeRpc();
  const record = await service(rpc).getByLooperId('2431');
  assert.equal(record.evidence.block.number, '108');
  assert.ok(rpc.calls.filter(call => call.method === 'eth_call').every(call => call.params[1] === '0x6c'));
  await assert.rejects(() => service(makeRpc({ eth_blockNumber: '0x13' })).getByLooperId('2431'), /confirmation depth/i);
});

test('accepts the onchain second equal to the approved opening boundary', async () => {
  const stakeTime = BigInt(Math.floor(Date.parse('2026-10-21T20:34:03Z') / 1000));
  const record = await service(makeRpc({ stake: stakeTuple({ stakeTime }) })).getByLooperId('2431');
  assert.equal(record.score, 42);
});

test('amount is evidence only and cannot change the +2 Pantheon component', async () => {
  for (const amount of [1n, 10n ** 18n, (1n << 256n) - 1n]) {
    const record = await service(makeRpc({ stake: stakeTuple({ amount }) })).getByLooperId('2431');
    assert.equal(record.score, 42);
    assert.equal(record.scoreComponents[1].scoreImpact, 2);
    assert.equal(record.evidence.pantheon.position.amount, amount.toString());
  }
});

test('Credifi repayment is identity-bound observation with zero score impact', async () => {
  const record = await service(makeRpc()).getByLooperId('2431');
  assert.deepEqual(record.observations, [{
    category: 'Financial Reliability',
    loanId: '6ad91af4f2300494c59b5717',
    repaymentTxHash: PILOT.credifi.repaymentTxHash,
    recipient: PILOT.account,
    actor: PILOT.controller,
    receiptStatus: 'TRANSACTION_SUCCEEDED',
    providerAttributionStatus: 'PENDING_PROVIDER_ATTESTATION',
    scoreImpact: 0,
    reasonCode: 'CREDIFI_REPAYMENT_TX_OBSERVED_PENDING_PROVIDER_ATTESTATION',
  }]);
  assert.equal(record.scoreComponents.reduce((sum, component) => sum + component.scoreImpact, 0), 42);
});

test('fails closed on provider disagreement or RPC failure and never returns a cached 42 after expiry', async () => {
  await assert.rejects(() => service(makeRpc({ 'base_drpc:stake': stakeTuple({ amount: 2n }) })).getByLooperId('2431'), /provider disagreement.*stake/i);
  const failing = makeRpc();
  const base = failing;
  let now = Date.parse('2026-10-21T20:45:00Z');
  let fail = false;
  const rpc = async (...args) => { if (fail) throw new Error('RPC offline'); return base(...args); };
  const cachedService = createLooperCredService({ rpc, now: () => now, cacheTtlMs: 60_000 });
  assert.equal((await cachedService.getByLooperId('2431')).score, 42);
  fail = true;
  now += 60_001;
  await assert.rejects(() => cachedService.getByLooperId('2431'), /RPC offline/);
});

test('rejects wrong code, owner, token binding, inactive pool, or ineligible stake term', async () => {
  const cases = [
    [{ eth_getCode: '0x' }, /account code/i],
    [{ owner: '0x' + addressWord('0x1111111111111111111111111111111111111111') }, /owner/i],
    [{ token: tokenBinding({ tokenId: 2432n }) }, /token binding/i],
    [{ pool: poolTuple({ active: 0n }) }, /pool.*active/i],
    [{ pool: poolTuple({ cliffMonths: 1n }) }, /cliff/i],
    [{ stake: stakeTuple({ lockMonths: 3n }) }, /six-month/i],
    [{ stake: stakeTuple({ stakeTime: BigInt(Math.floor(Date.parse('2026-10-21T20:34:02Z') / 1000)) }) }, /opened after/i],
    [{ stake: stakeTuple({ unstakeRequestTime: 1n }) }, /exit request/i],
  ];
  for (const [override, pattern] of cases) {
    await assert.rejects(() => service(makeRpc(override)).getByLooperId('2431'), pattern);
  }
});

test('rejects unsupported Loopers and never joins by a bare numeric ID', async () => {
  const value = service(makeRpc());
  await assert.rejects(() => value.getByLooperId('2432'), error => error.code === 'UNSUPPORTED_LOOPER' && error.statusCode === 404);
  await assert.rejects(() => value.getByLooperId(2431), /exact canonical string/i);
});

test('rejects failed or misbound Credifi repayment receipts without granting baseline output', async () => {
  await assert.rejects(() => service(makeRpc({ eth_getTransactionReceipt: { ...RECEIPT, status: '0x0' } })).getByLooperId('2431'), /repayment.*succeed/i);
  await assert.rejects(() => service(makeRpc({ eth_getTransactionByHash: { ...TRANSACTION, to: '0x1111111111111111111111111111111111111111' } })).getByLooperId('2431'), /recipient/i);
});
