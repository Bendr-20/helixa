import { canonicalizeMissionJson, digestMissionBody } from './idempotency.js';

const HASH = /^[0-9a-f]{64}$/u;
const TX_HASH = /^0x[0-9a-f]{64}$/u;
const BLOCK_HASH = /^0x[0-9a-f]{64}$/u;
const OUTCOMES = new Set(['settled', 'disputed', 'refunded', 'timeout_settled', 'abandoned']);

export function createMissionReceiptCodec({ issuer, signDigest, verifyDigest, now = Date.now, version = 'helixa.mission.outcome.v1' } = {}) {
  const normalizedIssuer = bounded(issuer, 'issuer', 1, 256);
  const normalizedVersion = bounded(version, 'version', 1, 128);
  if (typeof signDigest !== 'function' || typeof verifyDigest !== 'function' || typeof now !== 'function') throw new TypeError('Receipt codec dependencies are invalid.');

  async function issue(input = {}) {
    const payload = normalizePayload(input, normalizedIssuer, normalizedVersion, now());
    const payloadJson = canonicalizeMissionJson(payload);
    const receiptHash = digestMissionBody(payload);
    const signature = await signDigest(receiptHash);
    if (typeof signature !== 'string' || signature.length < 8 || signature.length > 4096) throw new TypeError('Receipt signature is invalid.');
    return freeze({ payload, payloadJson, receiptHash, signature });
  }

  async function verify(envelope = {}) {
    exact(envelope, ['payload', 'payloadJson', 'receiptHash', 'signature'], 'receipt envelope');
    const payload = normalizePayload(envelope.payload, normalizedIssuer, normalizedVersion, envelope.payload.issuedAt);
    const payloadJson = canonicalizeMissionJson(payload);
    if (payloadJson !== envelope.payloadJson) return false;
    const receiptHash = digestMissionBody(payload);
    if (receiptHash !== envelope.receiptHash) return false;
    return Boolean(await verifyDigest(receiptHash, envelope.signature));
  }

  return freeze({ issue, verify });
}

export function normalizeOutcomeReceipt(input = {}) {
  return normalizePayload(input, input.issuer, input.version, input.issuedAt);
}

function normalizePayload(input, issuer, version, issuedAt) {
  exact(input, [
    'artifactHashes', 'approvalEvents', 'contributors', 'disputeStatus', 'finalizedBlockHash',
    'finalizedBlockNumber', 'issuedAt', 'issuer', 'missionCommitment', 'missionId', 'outcome',
    'receiptId', 'runtimeConfidence', 'settlementLogIndex', 'settlementTransactionHash', 'vaultCommitment', 'version',
  ], 'outcome receipt');
  if (input.issuer !== issuer || input.version !== version) throw new TypeError('Receipt issuer or version does not match the codec.');
  const timestamp = nonNegativeInteger(issuedAt, 'issuedAt');
  if (input.issuedAt !== timestamp) throw new TypeError('Receipt issuedAt is invalid.');
  const outcome = bounded(input.outcome, 'outcome', 1, 64);
  if (!OUTCOMES.has(outcome)) throw new TypeError('Receipt outcome is invalid.');
  const disputeStatus = bounded(input.disputeStatus, 'disputeStatus', 1, 64);
  const artifacts = hashes(input.artifactHashes, 'artifactHashes', 0, 128);
  const approvals = normalizeApprovals(input.approvalEvents);
  const contributors = normalizeContributors(input.contributors);
  if (outcome === 'settled' && (artifacts.length === 0 || approvals.length < 2 || contributors.length === 0)) {
    throw new TypeError('Settled receipts require artifacts, dual approvals, and contributors.');
  }
  return freeze({
    version,
    receiptId: identifier(input.receiptId, 'receiptId'),
    issuer,
    missionId: identifier(input.missionId, 'missionId'),
    missionCommitment: hash(input.missionCommitment, 'missionCommitment'),
    vaultCommitment: hash(input.vaultCommitment, 'vaultCommitment'),
    outcome,
    disputeStatus,
    artifactHashes: artifacts,
    approvalEvents: approvals,
    contributors,
    settlementTransactionHash: txHash(input.settlementTransactionHash, 'settlementTransactionHash'),
    settlementLogIndex: nonNegativeInteger(input.settlementLogIndex, 'settlementLogIndex'),
    finalizedBlockNumber: nonNegativeInteger(input.finalizedBlockNumber, 'finalizedBlockNumber'),
    finalizedBlockHash: blockHash(input.finalizedBlockHash, 'finalizedBlockHash'),
    runtimeConfidence: bounded(input.runtimeConfidence, 'runtimeConfidence', 1, 64),
    issuedAt: timestamp,
  });
}

function normalizeApprovals(value) {
  if (!Array.isArray(value) || value.length > 16) throw new TypeError('approvalEvents is invalid.');
  const items = value.map((entry) => {
    exact(entry, ['actorCommitment', 'eventType', 'logIndex', 'transactionHash'], 'approval event');
    return freeze({
      eventType: bounded(entry.eventType, 'eventType', 1, 64),
      actorCommitment: hash(entry.actorCommitment, 'actorCommitment'),
      transactionHash: txHash(entry.transactionHash, 'transactionHash'),
      logIndex: nonNegativeInteger(entry.logIndex, 'logIndex'),
    });
  });
  const keys = items.map((item) => item.transactionHash + ':' + item.logIndex);
  if (new Set(keys).size !== keys.length) throw new TypeError('approvalEvents contains duplicates.');
  return freeze(items.sort((a, b) => a.transactionHash.localeCompare(b.transactionHash) || a.logIndex - b.logIndex));
}

function normalizeContributors(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 8) throw new TypeError('contributors is invalid.');
  const items = value.map((entry) => {
    exact(entry, ['acceptedMilestoneIds', 'contributorCommitment', 'custodyEpoch', 'memberId', 'role', 'settlementAddressCommitment'], 'contributor');
    return freeze({
      memberId: identifier(entry.memberId, 'memberId'),
      contributorCommitment: hash(entry.contributorCommitment, 'contributorCommitment'),
      custodyEpoch: decimal(entry.custodyEpoch, 'custodyEpoch'),
      role: bounded(entry.role, 'role', 1, 128),
      settlementAddressCommitment: hash(entry.settlementAddressCommitment, 'settlementAddressCommitment'),
      acceptedMilestoneIds: hashes(entry.acceptedMilestoneIds, 'acceptedMilestoneIds', 1, 12),
    });
  });
  if (new Set(items.map((item) => item.memberId)).size !== items.length) throw new TypeError('contributors contains duplicates.');
  return freeze(items.sort((a, b) => a.memberId.localeCompare(b.memberId)));
}

function hashes(value, label, min, max) {
  if (!Array.isArray(value) || value.length < min || value.length > max) throw new TypeError(label + ' is invalid.');
  const result = value.map((entry) => hash(entry, label));
  if (new Set(result).size !== result.length) throw new TypeError(label + ' contains duplicates.');
  return freeze(result.sort());
}
function exact(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new TypeError(label + ' must be a plain object.');
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new TypeError(label + ' fields are invalid.');
}
function identifier(value, label) { if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(value)) throw new TypeError(label + ' is invalid.'); return value; }
function bounded(value, label, min, max) { if (typeof value !== 'string' || value.length < min || value.length > max) throw new TypeError(label + ' is invalid.'); return value; }
function hash(value, label) { if (typeof value !== 'string' || !HASH.test(value)) throw new TypeError(label + ' is invalid.'); return value; }
function txHash(value, label) { if (typeof value !== 'string' || !TX_HASH.test(value)) throw new TypeError(label + ' is invalid.'); return value; }
function blockHash(value, label) { if (typeof value !== 'string' || !BLOCK_HASH.test(value)) throw new TypeError(label + ' is invalid.'); return value; }
function nonNegativeInteger(value, label) { if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(label + ' is invalid.'); return value; }
function decimal(value, label) { if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/u.test(value)) throw new TypeError(label + ' must be a canonical decimal string.'); return value; }
function freeze(value) { if (value && typeof value === 'object') { for (const nested of Object.values(value)) freeze(nested); Object.freeze(value); } return value; }
