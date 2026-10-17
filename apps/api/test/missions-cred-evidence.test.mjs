import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCredOutcomeEvidence, createMissionCredEvidencePublisher } from '../src/missions/cred-evidence.js';

const H = (value) => value.repeat(64).slice(0, 64);
const TX = (value) => '0x' + H(value);

function receipt(overrides = {}) {
  const payload = {
    version: 'helixa.mission.outcome.v1', receiptId: 'receipt-1', issuer: 'helixa', missionId: 'mission-1',
    missionCommitment: H('a'), vaultCommitment: H('b'), outcome: 'settled', disputeStatus: 'none',
    artifactHashes: [H('c')], approvalEvents: [
      { eventType: 'OwnerApproved', actorCommitment: H('d'), transactionHash: TX('1'), logIndex: 1 },
      { eventType: 'LeadApproved', actorCommitment: H('e'), transactionHash: TX('1'), logIndex: 2 },
    ],
    contributors: [{ memberId: 'member-1', contributorCommitment: H('f'), custodyEpoch: '7', role: 'lead', settlementAddressCommitment: H('9'), acceptedMilestoneIds: [H('8')] }],
    settlementTransactionHash: TX('2'), settlementLogIndex: 3, finalizedBlockNumber: 100,
    finalizedBlockHash: TX('3'), runtimeConfidence: 'pinned_verified', issuedAt: 1234,
    ...overrides,
  };
  return { payload, receiptHash: H('4'), signature: 'signed' };
}

test('positive evidence requires finalized accepted artifacts and payment and binds contribution-time custody', () => {
  const evidence = buildCredOutcomeEvidence({ receipt: receipt(), memberId: 'member-1', occurredAt: 1234 });
  assert.equal(evidence.positiveCompletion, true);
  assert.equal(evidence.contributionCustodyEpoch, '7');
  assert.equal(evidence.settlement.finalizedBlockNumber, 100);
  assert.match(evidence.evidenceHash, /^[0-9a-f]{64}$/u);
  assert.equal(Object.hasOwn(evidence, 'amount'), false);
  assert.equal(Object.hasOwn(evidence, 'currentOwner'), false);
});

test('disputed, refunded, timed-out, and abandoned outcomes preserve actual non-positive state', () => {
  for (const outcome of ['disputed', 'refunded', 'timeout_settled', 'abandoned']) {
    const evidence = buildCredOutcomeEvidence({ receipt: receipt({ outcome, disputeStatus: outcome }), memberId: 'member-1', occurredAt: 1234 });
    assert.equal(evidence.outcome, outcome);
    assert.equal(evidence.positiveCompletion, false);
  }
});

test('publisher checks fresh custody, publishes to the contribution identity, and retries idempotently', async () => {
  const calls = [];
  let stored = null;
  const publisher = createMissionCredEvidencePublisher({
    custody: { async verifyCurrent(input) { calls.push(['custody', input]); return { status: 'changed', currentCustodyEpoch: '8' }; } },
    ledger: {
      async readPublication() { return stored; },
      async savePublication(input) { stored = { ...input, publicationRef: 'cred:1' }; return stored; },
    },
    async publish(input) { calls.push(['publish', input]); return { publicationRef: 'cred:1' }; },
  });
  const first = await publisher.publishReceipt({ receipt: receipt(), memberId: 'member-1' });
  const second = await publisher.publishReceipt({ receipt: receipt(), memberId: 'member-1' });
  assert.equal(first.replayed, false);
  assert.equal(second.replayed, true);
  assert.equal(calls.filter(([name]) => name === 'publish').length, 1);
  assert.equal(calls.find(([name]) => name === 'publish')[1].custodyStatus.status, 'changed');
  assert.equal(first.evidence.contributionCustodyEpoch, '7');
});

test('unfinalized and unknown-contributor receipts fail closed', () => {
  assert.throws(() => buildCredOutcomeEvidence({ receipt: receipt({ finalizedBlockNumber: -1 }), memberId: 'member-1', occurredAt: 1234 }), /not finalized/);
  assert.throws(() => buildCredOutcomeEvidence({ receipt: receipt(), memberId: 'member-2', occurredAt: 1234 }), /does not contain/);
});
