import assert from 'node:assert/strict';
import test from 'node:test';

import { createMissionChainReconciler } from '../src/missions/chain-reconciler.js';

const H = (value) => '0x' + value.repeat(64).slice(0, 64);
const A = (value) => '0x' + value.repeat(40).slice(0, 40);
const VAULT = A('a');
const TOKEN = A('b');
const CODE_HASH = H('c');

function log(overrides = {}) {
  return {
    transactionHash: H('1'), logIndex: 0, eventType: 'MissionSettled', commitmentHash: H('2'),
    blockNumber: 98, blockHash: H('8'), ...overrides,
  };
}

function fixture({ logsA = [log()], logsB = [log()], tokenPinsA = [TOKEN], tokenPinsB = [TOKEN], blocks = {}, cursor = null, ancestor = null, codeHash = CODE_HASH } = {}) {
  const writes = [];
  const baseBlocks = new Map([[98, H('8')], [99, H('9')], [100, H('a')], ...Object.entries(blocks).map(([k, v]) => [Number(k), v])]);
  const provider = (logs, tokenPins) => ({
    async getBlockNumber() { return 102; },
    async getBlock(number) { return { number, hash: baseBlocks.get(number) ?? H('f') }; },
    async getCode() { return '0x6001'; },
    async getSupportedTokens() { return tokenPins; },
    async getLogs() { return logs; },
  });
  const ledger = {
    async readCursor() { return cursor; },
    async findCommonAncestor() { return ancestor; },
    async replaceCanonicalRange(input) { writes.push(input); },
  };
  const reconciler = createMissionChainReconciler({
    providers: [provider(logsA, tokenPinsA), provider(logsB, tokenPinsB)], ledger, chainId: 8453, confirmationDepth: 2,
    expectedVaultCodeHash: CODE_HASH, supportedTokens: [TOKEN], hashCode: () => codeHash, now: () => 1234,
  });
  return { reconciler, writes };
}

test('requires two-provider canonical agreement and persists only finalized deduplicated logs', async () => {
  const duplicate = log();
  const f = fixture({ logsA: [log({ transactionHash: H('3'), logIndex: 1 }), duplicate, duplicate], logsB: [duplicate, log({ transactionHash: H('3'), logIndex: 1 })] });
  const result = await f.reconciler.reconcile({ missionId: 'mission-1', vaultAddress: VAULT, fromBlock: 98 });
  assert.equal(result.status, 'finalized');
  assert.equal(result.finalizedBlock, 100);
  assert.equal(result.events.length, 2);
  assert.equal(result.events[0].confirmationState, 'finalized');
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0].cursor.blockHash, H('a'));
  assert.equal(Object.isFrozen(result.events[0]), true);
});

test('provider disagreement, codehash mismatch, and token mismatch fail closed without projection writes', async () => {
  const disagreement = fixture({ logsB: [log({ commitmentHash: H('4') })] });
  assert.deepEqual((await disagreement.reconciler.reconcile({ missionId: 'mission-1', vaultAddress: VAULT, fromBlock: 98 })).reason, 'provider_disagreement');
  assert.equal(disagreement.writes.length, 0);

  const wrongCode = fixture({ codeHash: H('d') });
  assert.equal((await wrongCode.reconciler.reconcile({ missionId: 'mission-1', vaultAddress: VAULT, fromBlock: 98 })).reason, 'codehash_mismatch');
  assert.equal(wrongCode.writes.length, 0);

  const wrongToken = fixture({ tokenPinsB: [A('c')] });
  assert.equal((await wrongToken.reconciler.reconcile({ missionId: 'mission-1', vaultAddress: VAULT, fromBlock: 98 })).reason, 'token_pin_mismatch');
  assert.equal(wrongToken.writes.length, 0);
});

test('confirmation depth prevents false finalized labels', async () => {
  const f = fixture();
  const result = await f.reconciler.reconcile({ missionId: 'mission-1', vaultAddress: VAULT, fromBlock: 101 });
  assert.equal(result.status, 'waiting_confirmations');
  assert.equal(f.writes.length, 0);
});

test('reorgs roll back to the last agreed ancestor and replay the canonical range once', async () => {
  const f = fixture({ cursor: { blockNumber: 99, blockHash: H('0') }, ancestor: { blockNumber: 97, blockHash: H('7') } });
  const result = await f.reconciler.reconcile({ missionId: 'mission-1', vaultAddress: VAULT, fromBlock: 90 });
  assert.equal(result.status, 'finalized');
  assert.equal(result.rollbackFrom, 98);
  assert.equal(f.writes[0].rollbackFrom, 98);
  assert.equal(f.writes[0].fromBlock, 98);
});

test('conflicting duplicate log identities are rejected', async () => {
  const sameIdentity = log({ commitmentHash: H('4') });
  const f = fixture({ logsA: [log(), sameIdentity], logsB: [log()] });
  await assert.rejects(() => f.reconciler.reconcile({ missionId: 'mission-1', vaultAddress: VAULT, fromBlock: 98 }), /Duplicate chain log identity changed/);
  assert.equal(f.writes.length, 0);
});
