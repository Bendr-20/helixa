'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createPrivateKey, sign } = require('node:crypto');
const registryFixture = require('./fixtures/registry.json');
const { SIGNATURE_DOMAIN, buildNativePayloadHash, buildSubmissionSigningBytes } = require('../../cred-evidence/submission');
const { GENERIC_MANIFEST_HASH, getAdapter } = require('../../cred-evidence/adapters');
const { normalizeEvidenceSubmission, normalizeEvidenceBatch } = require('../../cred-evidence/normalize');

const rows = fs.readFileSync(path.join(__dirname, 'fixtures/submissions.jsonl'), 'utf8').trim().split(String.fromCharCode(10)).map(JSON.parse);
const byId = new Map(rows.map((row) => [row.submissionId, row]));
const privateKey = createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), Buffer.alloc(32, 1)]), format: 'der', type: 'pkcs8' });
function registry() { return structuredClone(registryFixture.registry); }
function submission(id) { return structuredClone(byId.get(id)); }
function resign(value) {
  value.nativePayloadHash = buildNativePayloadHash(value.nativePayload);
  value.signature = null;
  value.signature = sign(null, Buffer.concat([Buffer.from(SIGNATURE_DOMAIN), Buffer.from(buildSubmissionSigningBytes(value))]), privateKey).toString('base64url');
  return value;
}

test('normalizes active signed evidence to the exact scorer record', () => {
  const result = normalizeEvidenceSubmission(registry(), submission('submission_active'));
  assert.equal(result.adapterManifestHash, GENERIC_MANIFEST_HASH);
  assert.equal(result.transformationHash, 'sha256:089e96ad699fba2c28671066614e666abc98abaccce4d2c550ab6fffbea2194e');
  assert.equal(result.lifecycleState, 'ACTIVE');
  assert.equal(result.scoreEligible, true);
  assert.deepEqual(result.reasonCodes, []);
  assert.deepEqual(result.record, {
    evidenceId: 'ev_86c27062985ad1215f3130009fefd3cd', subjectId: 'subject_alpha', actorEpochId: 'epoch_2',
    schemaId: 'schema_task_outcome', schemaVersion: '1.0.0', schemaFamilyId: 'schema-family_task', empId: 'emp_operational', empVersion: '1.0.0', empWindowSeconds: 7776000,
    providerId: 'provider_alpha', providerControlGroup: 'group_alpha', category: 'operational', direction: 'positive', proofClass: 'P1', materiality: 'meaningful', severity: null,
    evidenceFamily: 'operational', observedAt: '2026-07-01T00:00:10.000Z', incidentKey: 'incident_event_001', correlationKey: 'cluster_event_001', domainTags: ['coding'],
    status: 'ACTIVE', scoreEligible: true, finality: 'final', correctionOf: null, remediationOf: null, disputeId: null,
    nativePayloadHash: 'sha256:6d15e9ac6fdad6c3c8e21cdce78e0d576ecf5ab388eb6f55b767d8880f563926', proofRefs: ['https://proof.example/event_001'],
    transformationHash: 'sha256:089e96ad699fba2c28671066614e666abc98abaccce4d2c550ab6fffbea2194e',
  });
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.record));
});

test('observation and committed permissionless evidence cannot become score eligible', () => {
  const observation = normalizeEvidenceSubmission(registry(), submission('submission_observation'));
  assert.equal(observation.lifecycleState, 'VERIFIED');
  assert.equal(observation.record.status, 'VERIFIED');
  assert.equal(observation.record.scoreEligible, false);
  assert.deepEqual(observation.reasonCodes, ['PROVIDER_OBSERVATION_ONLY']);
  const permissionless = normalizeEvidenceSubmission(registry(), submission('submission_permissionless'));
  assert.equal(permissionless.lifecycleState, 'QUARANTINED');
  assert.equal(permissionless.record, null);
  assert.equal(permissionless.transformationHash, null);
  assert.deepEqual(permissionless.reasonCodes, ['PAYLOAD_UNAVAILABLE', 'PERMISSIONLESS_QUARANTINE']);
});

test('rejects dynamic adapters and malformed or unauthorized outcome semantics', () => {
  const dynamic = registry(); dynamic.schemas[0].adapterVersion = '2.0.0';
  assert.throws(() => normalizeEvidenceSubmission(dynamic, submission('submission_active')), /exact allowlist/);
  for (const [field, value, pattern] of [
    ['direction', 'neutral', /direction/],
    ['materialityNative', 'unknown', /materialityNative/],
    ['proofClass', 'P4', /proofClass/],
    ['domain', 'payments', /domain/],
  ]) {
    const input = submission('submission_active'); input.nativePayload[field] = value; resign(input);
    assert.throws(() => normalizeEvidenceSubmission(registry(), input), pattern);
  }
  const extra = submission('submission_active'); extra.nativePayload.extra = true; resign(extra);
  assert.throws(() => normalizeEvidenceSubmission(registry(), extra), /unknown field/);
  const badSeverity = submission('submission_active'); badSeverity.nativePayload.severity = 'critical'; resign(badSeverity);
  assert.throws(() => normalizeEvidenceSubmission(registry(), badSeverity), /positive outcome/);
});

test('quarantines unverified, pending, self-review, and related-party evidence', () => {
  const unverified = submission('submission_active'); unverified.nativePayload.proofVerified = false; resign(unverified);
  const unverifiedResult = normalizeEvidenceSubmission(registry(), unverified);
  assert.equal(unverifiedResult.lifecycleState, 'QUARANTINED');
  assert.equal(unverifiedResult.record.scoreEligible, false);
  assert.deepEqual(unverifiedResult.reasonCodes, ['PROOF_UNVERIFIED']);

  const pending = submission('submission_active'); pending.nativePayload.finality = 'pending'; resign(pending);
  const pendingResult = normalizeEvidenceSubmission(registry(), pending);
  assert.equal(pendingResult.lifecycleState, 'PENDING_REVIEW');
  assert.deepEqual(pendingResult.reasonCodes, ['FINALITY_PENDING']);

  const selfReview = submission('submission_active'); selfReview.nativePayload.counterpartyCoordinate = structuredClone(selfReview.subjectCoordinates[0]); resign(selfReview);
  const selfResult = normalizeEvidenceSubmission(registry(), selfReview);
  assert.equal(selfResult.lifecycleState, 'QUARANTINED');
  assert.deepEqual(selfResult.reasonCodes, ['SELF_REVIEW_EXCLUDED']);

  const related = submission('submission_active'); related.nativePayload.relatedParty = true; resign(related);
  const relatedResult = normalizeEvidenceSubmission(registry(), related);
  assert.equal(relatedResult.lifecycleState, 'QUARANTINED');
  assert.deepEqual(relatedResult.reasonCodes, ['RELATED_PARTY_QUARANTINE']);

  const observation = submission('submission_observation'); observation.nativePayload.proofVerified = false; resign(observation);
  const observationResult = normalizeEvidenceSubmission(registry(), observation);
  assert.equal(observationResult.lifecycleState, 'QUARANTINED');
  assert.deepEqual(observationResult.reasonCodes, ['PROOF_UNVERIFIED', 'PROVIDER_OBSERVATION_ONLY']);
});

test('never emits scorer records for unresolved subjects or actor epochs', () => {
  const unresolved = submission('submission_active');
  unresolved.lane = 'permissionless';
  unresolved.providerId = null;
  unresolved.submitterId = 'submitter_public';
  unresolved.subjectCoordinates = [{ namespace: 'erc8004', network: 'eip155:8453', value: '999999' }];
  unresolved.claimedActorEpochId = null;
  unresolved.signatureSuite = 'none';
  unresolved.keyId = null;
  unresolved.signature = null;
  const result = normalizeEvidenceSubmission(registry(), unresolved);
  assert.equal(result.lifecycleState, 'QUARANTINED');
  assert.equal(result.record, null);
  assert.deepEqual(result.reasonCodes, ['IDENTITY_UNRESOLVED', 'PERMISSIONLESS_QUARANTINE']);
});

test('adapters are pure, immutable, and cannot grant eligibility', () => {
  const input = submission('submission_active');
  const before = structuredClone(input.nativePayload);
  const schema = registry().schemas[0];
  const adapter = getAdapter(schema.adapterId, schema.adapterVersion);
  const transformed = adapter.transform(input.nativePayload, { schema, submission: input, identity: {} });
  assert.deepEqual(input.nativePayload, before);
  assert.equal(Object.hasOwn(transformed, 'scoreEligible'), false);
  assert.ok(Object.isFrozen(transformed));
  assert.throws(() => { transformed.direction = 'negative'; }, TypeError);
});

test('normalization is input-order invariant and preserves duplicate incidents for ledger policy', () => {
  const active = submission('submission_active');
  const observation = submission('submission_observation');
  const permissionless = submission('submission_permissionless');
  const first = normalizeEvidenceBatch(registry(), [permissionless, observation, active]);
  const second = normalizeEvidenceBatch(registry(), [active, permissionless, observation]);
  assert.deepEqual(first, second);

  const duplicateIncident = submission('submission_active');
  duplicateIncident.submissionId = 'submission_same_incident';
  duplicateIncident.providerEventId = 'event_same_incident';
  duplicateIncident.nativePayload.correlationKey = 'cluster_second';
  resign(duplicateIncident);
  const pair = normalizeEvidenceBatch(registry(), [active, duplicateIncident]);
  assert.equal(pair.filter((item) => item.record?.incidentKey === 'incident_event_001').length, 2);
});
