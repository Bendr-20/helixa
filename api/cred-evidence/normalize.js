'use strict';

const { createHash } = require('node:crypto');
const { canonicalStringify } = require('../cred-shadow/artifact');
const { buildRegistryBundle, coordinateKey } = require('./registry');
const { resolveIdentity } = require('./identity');
const { verifySubmission, verifySubmissionBatch } = require('./submission');
const { getAdapter, TRANSFORMATION_HASH_DOMAIN } = require('./adapters');

function deepFreeze(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
function compareUtf8(left, right) { return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8')); }
function domainHash(domain, bytes) { return 'sha256:' + createHash('sha256').update(domain, 'utf8').update(bytes, 'utf8').digest('hex'); }
function addReason(reasons, value) { if (!reasons.includes(value)) reasons.push(value); }

function normalizeVerified(registry, verified) {
  const submission = verified.submission;
  const schema = verified.schema;
  const reasons = [...verified.reasonCodes];
  if (submission.nativePayload === null) {
    addReason(reasons, 'PAYLOAD_UNAVAILABLE');
    reasons.sort(compareUtf8);
    return deepFreeze({ verified, adapter: null, adapterManifestHash: null, transformationHash: null, record: null, lifecycleState: 'QUARANTINED', scoreEligible: false, reasonCodes: reasons });
  }
  if (verified.identity.resolution !== 'resolved' || verified.identity.subjectId === null || verified.identity.actorEpochId === null) {
    reasons.sort(compareUtf8);
    return deepFreeze({ verified, adapter: null, adapterManifestHash: null, transformationHash: null, record: null, lifecycleState: 'QUARANTINED', scoreEligible: false, reasonCodes: reasons });
  }
  const adapter = getAdapter(schema.adapterId, schema.adapterVersion);
  const transformed = adapter.transform(submission.nativePayload, { schema, submission, identity: verified.identity });
  let selfReview = false;
  if (transformed.counterpartyCoordinate !== null) {
    const subjectKeys = new Set(submission.subjectCoordinates.map(coordinateKey));
    if (subjectKeys.has(transformed.counterpartyCoordinateKey)) selfReview = true;
    else {
      const counterparty = resolveIdentity(registry, [transformed.counterpartyCoordinate], submission.occurredAt);
      selfReview = counterparty.subjectId !== null && counterparty.subjectId === verified.identity.subjectId;
    }
  }
  if (selfReview) addReason(reasons, 'SELF_REVIEW_EXCLUDED');
  if (transformed.relatedParty) addReason(reasons, 'RELATED_PARTY_QUARANTINE');
  if (!transformed.proofVerified) addReason(reasons, 'PROOF_UNVERIFIED');
  if (transformed.finality === 'pending') addReason(reasons, 'FINALITY_PENDING');
  if (transformed.finality === 'reorged') addReason(reasons, 'FINALITY_REORGED');

  const provider = submission.providerId === null ? null : registry.providers.find((item) => item.providerId === submission.providerId);
  const emp = registry.empPolicies.find((item) => item.empId === schema.empId && item.empVersion === schema.empVersion);
  if (!emp) throw new Error('schema has no pinned EMP policy');
  const proofFinal = transformed.finality === 'final' || transformed.finality === 'not-applicable';
  const eligible = verified.eligibilityClass === 'eligible-after-verification' && transformed.proofVerified && proofFinal && !selfReview && !transformed.relatedParty;
  const blocked = !transformed.proofVerified || transformed.finality === 'reorged' || selfReview || transformed.relatedParty || verified.eligibilityClass === 'quarantined';
  let status;
  if (eligible) status = 'ACTIVE';
  else if (transformed.finality === 'pending') status = 'PENDING_REVIEW';
  else if (blocked) status = 'QUARANTINED';
  else if (verified.eligibilityClass === 'observation-only') status = 'VERIFIED';
  else status = 'QUARANTINED';

  const candidate = {
    evidenceId: 'ev_' + verified.submissionHash.slice(7, 39),
    subjectId: verified.identity.subjectId,
    actorEpochId: verified.identity.actorEpochId,
    schemaId: schema.schemaId,
    schemaVersion: schema.schemaVersion,
    schemaFamilyId: schema.schemaFamilyId,
    empId: schema.empId,
    empVersion: schema.empVersion,
    empWindowSeconds: emp.correlationWindowSeconds,
    providerId: provider ? provider.providerId : 'permissionless:' + submission.submitterId,
    providerControlGroup: provider ? provider.controlGroupId : 'permissionless',
    category: schema.category,
    direction: transformed.direction,
    proofClass: transformed.proofClass,
    materiality: transformed.materiality,
    severity: transformed.severity,
    evidenceFamily: schema.evidenceFamily,
    observedAt: submission.observedAt,
    incidentKey: transformed.incidentKey,
    correlationKey: transformed.correlationKey,
    domainTags: [transformed.domain],
    status,
    scoreEligible: eligible,
    finality: transformed.finality,
    correctionOf: submission.correctionOf,
    remediationOf: submission.remediationOf,
    disputeId: submission.disputeOf,
    nativePayloadHash: submission.nativePayloadHash,
    proofRefs: submission.proofRefs,
  };
  const transformationMaterial = {
    adapterManifestHash: adapter.manifestHash,
    submissionHash: verified.submissionHash,
    registryHash: verified.registryHash,
    identityGraphHash: verified.identity.identityGraphHash,
    candidate,
  };
  const transformationHash = domainHash(TRANSFORMATION_HASH_DOMAIN, canonicalStringify(transformationMaterial));
  const record = deepFreeze({ ...candidate, transformationHash });
  reasons.sort(compareUtf8);
  return deepFreeze({ verified, adapter: adapter.manifest, adapterManifestHash: adapter.manifestHash, transformationHash, record, lifecycleState: status, scoreEligible: eligible, reasonCodes: reasons });
}

function normalizeEvidenceSubmission(registryInput, submissionInput) {
  const bundle = buildRegistryBundle(registryInput && registryInput.registry ? registryInput.registry : registryInput);
  if (registryInput && registryInput.registryHash !== undefined && registryInput.registryHash !== bundle.registryHash) throw new Error('supplied registry hash does not match canonical registry');
  return normalizeVerified(bundle.registry, verifySubmission(bundle, submissionInput));
}

function normalizeEvidenceBatch(registryInput, submissionInputs) {
  const bundle = buildRegistryBundle(registryInput && registryInput.registry ? registryInput.registry : registryInput);
  if (registryInput && registryInput.registryHash !== undefined && registryInput.registryHash !== bundle.registryHash) throw new Error('supplied registry hash does not match canonical registry');
  const verified = verifySubmissionBatch(bundle, submissionInputs);
  const results = verified.map((item) => normalizeVerified(bundle.registry, item));
  results.sort((left, right) => compareUtf8(left.verified.submission.submissionId, right.verified.submission.submissionId));
  return deepFreeze(results);
}

module.exports = Object.freeze({
  normalizeEvidenceSubmission,
  normalizeEvidenceBatch,
});
