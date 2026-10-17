import assert from 'node:assert/strict';
import test from 'node:test';

import { createMissionReceiptCodec } from '../src/missions/receipts.js';

const H = (value) => value.repeat(64).slice(0, 64);
const TX = (value) => '0x' + H(value);

function receipt(overrides = {}) {
  return {
    version: 'helixa.mission.outcome.v1', receiptId: 'receipt-1', issuer: 'helixa', missionId: 'mission-1',
    missionCommitment: H('a'), vaultCommitment: H('b'), outcome: 'settled', disputeStatus: 'none',
    artifactHashes: [H('c')],
    approvalEvents: [
      { eventType: 'OwnerApproved', actorCommitment: H('d'), transactionHash: TX('1'), logIndex: 1 },
      { eventType: 'LeadApproved', actorCommitment: H('e'), transactionHash: TX('1'), logIndex: 2 },
    ],
    contributors: [{ memberId: 'member-1', contributorCommitment: H('f'), custodyEpoch: '7', role: 'lead', settlementAddressCommitment: H('9'), acceptedMilestoneIds: [H('8')] }],
    settlementTransactionHash: TX('2'), settlementLogIndex: 3, finalizedBlockNumber: 100,
    finalizedBlockHash: TX('3'), runtimeConfidence: 'pinned_verified', issuedAt: 1234,
    ...overrides,
  };
}

function codec() {
  return createMissionReceiptCodec({
    issuer: 'helixa', now: () => 1234,
    async signDigest(digest) { return 'signed:' + digest; },
    async verifyDigest(digest, signature) { return signature === 'signed:' + digest; },
  });
}

test('issues deterministic signed receipts bound to finalized transaction and block references', async () => {
  const first = await codec().issue(receipt());
  const second = await codec().issue(structuredClone(receipt()));
  assert.equal(first.receiptHash, second.receiptHash);
  assert.equal(first.signature, 'signed:' + first.receiptHash);
  assert.equal(await codec().verify(first), true);
  assert.equal(first.payload.contributors[0].custodyEpoch, '7');
  assert.equal(Object.isFrozen(first.payload), true);
});

test('verification rejects payload, canonical JSON, hash, and signature tampering', async () => {
  const envelope = await codec().issue(receipt());
  assert.equal(await codec().verify({ ...envelope, signature: 'signed:not-it' }), false);
  assert.equal(await codec().verify({ ...envelope, receiptHash: H('0') }), false);
  assert.equal(await codec().verify({ ...envelope, payloadJson: envelope.payloadJson + ' ' }), false);
  await assert.rejects(() => codec().verify({ ...envelope, payload: { ...envelope.payload, bountyAmount: '1000000' } }), /fields are invalid/);
});

test('settled receipts require accepted artifacts, dual approvals, and contribution-time custody evidence', async () => {
  await assert.rejects(() => codec().issue(receipt({ artifactHashes: [] })), /require artifacts/);
  await assert.rejects(() => codec().issue(receipt({ approvalEvents: [receipt().approvalEvents[0]] })), /dual approvals/);
  await assert.rejects(() => codec().issue(receipt({ contributors: [] })), /contributors/);
  await assert.rejects(() => codec().issue(receipt({ contributors: [{ ...receipt().contributors[0], custodyEpoch: 7 }] })), /canonical decimal/);
});

test('receipt schema excludes bounty denomination and amount as trust inputs', async () => {
  await assert.rejects(() => codec().issue({ ...receipt(), bountyAmount: '1000000' }), /fields are invalid/);
  const envelope = await codec().issue(receipt({ outcome: 'refunded', artifactHashes: [], approvalEvents: [], disputeStatus: 'refunded' }));
  assert.equal(envelope.payload.outcome, 'refunded');
  assert.equal(await codec().verify(envelope), true);
});
