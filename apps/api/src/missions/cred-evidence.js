import { digestMissionBody } from './idempotency.js';

const FINAL_OUTCOMES = new Set(['settled', 'disputed', 'refunded', 'timeout_settled', 'abandoned']);

export function createMissionCredEvidencePublisher({ custody, ledger, publish, evidenceVersion = 'helixa.mission.cred.v1' } = {}) {
  if (!custody || typeof custody.verifyCurrent !== 'function') throw new TypeError('CRED evidence custody port is invalid.');
  if (!ledger || typeof ledger.readPublication !== 'function' || typeof ledger.savePublication !== 'function') throw new TypeError('CRED evidence ledger port is invalid.');
  if (typeof publish !== 'function') throw new TypeError('CRED evidence publisher dependencies are invalid.');

  async function publishReceipt({ receipt, memberId } = {}) {
    const evidence = buildCredOutcomeEvidence({ receipt, memberId, evidenceVersion, occurredAt: receipt?.payload?.issuedAt });
    const existing = await ledger.readPublication({ missionId: evidence.missionId, memberId: evidence.memberId, receiptId: evidence.receiptId });
    if (existing) {
      if (existing.evidenceHash !== evidence.evidenceHash) throw new Error('Existing CRED evidence publication conflicts with the finalized receipt.');
      return freeze({ replayed: true, evidence, publication: existing });
    }
    const custodyState = await custody.verifyCurrent({
      memberId: evidence.memberId,
      contributorCommitment: evidence.contributorCommitment,
      contributionCustodyEpoch: evidence.contributionCustodyEpoch,
    });
    if (!custodyState || typeof custodyState !== 'object') throw new TypeError('CRED publication custody result is invalid.');
    const publication = await publish(freeze({
      evidence,
      custodyStatus: normalizeCustodyStatus(custodyState),
    }));
    const saved = await ledger.savePublication({
      missionId: evidence.missionId,
      memberId: evidence.memberId,
      receiptId: evidence.receiptId,
      evidenceHash: evidence.evidenceHash,
      publication,
    });
    return freeze({ replayed: false, evidence, publication: saved ?? publication });
  }

  return freeze({ publishReceipt });
}

export function buildCredOutcomeEvidence({ receipt, memberId, evidenceVersion = 'helixa.mission.cred.v1', occurredAt } = {}) {
  if (!receipt || typeof receipt !== 'object' || !receipt.payload || typeof receipt.receiptHash !== 'string') throw new TypeError('Finalized outcome receipt is required.');
  const payload = receipt.payload;
  if (!FINAL_OUTCOMES.has(payload.outcome)) throw new TypeError('Receipt outcome is not final.');
  if (!Number.isSafeInteger(payload.finalizedBlockNumber) || payload.finalizedBlockNumber < 0 || typeof payload.finalizedBlockHash !== 'string') {
    throw new TypeError('Receipt settlement is not finalized.');
  }
  const contributor = payload.contributors?.find((entry) => entry.memberId === memberId);
  if (!contributor) throw new TypeError('Receipt does not contain the requested contributor.');
  const timestamp = nonNegativeInteger(occurredAt, 'occurredAt');
  const positive = payload.outcome === 'settled' && payload.disputeStatus === 'none'
    && Array.isArray(payload.artifactHashes) && payload.artifactHashes.length > 0
    && Array.isArray(payload.approvalEvents) && payload.approvalEvents.length >= 2;
  const body = freeze({
    version: bounded(evidenceVersion, 'evidenceVersion', 1, 128),
    receiptId: payload.receiptId,
    receiptHash: receipt.receiptHash,
    missionId: payload.missionId,
    missionCommitment: payload.missionCommitment,
    vaultCommitment: payload.vaultCommitment,
    memberId: contributor.memberId,
    contributorCommitment: contributor.contributorCommitment,
    contributionCustodyEpoch: contributor.custodyEpoch,
    role: contributor.role,
    acceptedMilestoneIds: [...contributor.acceptedMilestoneIds],
    artifactHashes: [...payload.artifactHashes],
    approvalEvents: payload.approvalEvents.map((entry) => ({
      eventType: entry.eventType,
      actorCommitment: entry.actorCommitment,
      transactionHash: entry.transactionHash,
      logIndex: entry.logIndex,
    })),
    settlement: {
      transactionHash: payload.settlementTransactionHash,
      logIndex: payload.settlementLogIndex,
      finalizedBlockNumber: payload.finalizedBlockNumber,
      finalizedBlockHash: payload.finalizedBlockHash,
    },
    outcome: payload.outcome,
    disputeStatus: payload.disputeStatus,
    positiveCompletion: positive,
    runtimeConfidence: payload.runtimeConfidence,
    occurredAt: timestamp,
  });
  return freeze({ ...body, evidenceHash: digestMissionBody(body) });
}

function normalizeCustodyStatus(value) {
  const allowed = ['current', 'changed', 'unavailable'];
  if (!allowed.includes(value.status)) throw new TypeError('CRED publication custody status is invalid.');
  return freeze({
    status: value.status,
    currentCustodyEpoch: value.currentCustodyEpoch === null || value.currentCustodyEpoch === undefined
      ? null
      : canonicalDecimal(value.currentCustodyEpoch, 'currentCustodyEpoch'),
  });
}
function canonicalDecimal(value, label) { if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/u.test(value)) throw new TypeError(label + ' is invalid.'); return value; }
function bounded(value, label, min, max) { if (typeof value !== 'string' || value.length < min || value.length > max) throw new TypeError(label + ' is invalid.'); return value; }
function nonNegativeInteger(value, label) { if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(label + ' is invalid.'); return value; }
function freeze(value) { if (value && typeof value === 'object') { for (const nested of Object.values(value)) freeze(nested); Object.freeze(value); } return value; }
