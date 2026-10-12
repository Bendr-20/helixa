'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createPrivateKey, sign } = require('node:crypto');
const registryFixture = require('./fixtures/registry.json');
const {
  SIGNATURE_DOMAIN,
  buildNativePayloadHash,
  buildSubmissionSigningBytes,
  verifySubmission,
  verifySubmissionBatch,
} = require('../../cred-evidence/submission');

const rows = fs.readFileSync(path.join(__dirname, 'fixtures/submissions.jsonl'), 'utf8').trim().split(String.fromCharCode(10)).map(JSON.parse);
const byId = new Map(rows.map((row) => [row.submissionId, row]));
const privateKey = createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), Buffer.alloc(32, 1)]), format: 'der', type: 'pkcs8' });
function registry() { return structuredClone(registryFixture.registry); }
function submission(id) { return structuredClone(byId.get(id)); }
function resign(value) {
  value.signature = null;
  const message = Buffer.concat([Buffer.from(SIGNATURE_DOMAIN), Buffer.from(buildSubmissionSigningBytes(value))]);
  value.signature = sign(null, message, privateKey).toString('base64url');
  return value;
}

test('verifies the pinned active-provider Ed25519 submission', () => {
  const value = submission('submission_active');
  const result = verifySubmission(registry(), value);
  assert.equal(value.signature, 'oDSQwgHGlyIce8aaKAdePvnB8Jb_8pfrgzb7pZ-Bac7Ua4XNpVCXKSJwFrTKwit0tzZ7Y2E3wcCxO52hMMHWDw');
  assert.equal(result.submissionHash, 'sha256:86c27062985ad1215f3130009fefd3cda86eab4e5c5f66c5014a130f6646236d');
  assert.equal(result.authorization, 'authorized');
  assert.equal(result.lifecycleState, 'VERIFIED');
  assert.equal(result.eligibilityClass, 'eligible-after-verification');
  assert.equal(result.providerState, 'active');
  assert.equal(result.identity.subjectId, 'subject_alpha');
  assert.equal(result.identity.actorEpochId, 'epoch_2');
  assert.deepEqual(result.reasonCodes, []);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.submission.nativePayload));
});

test('preserves historical observation mode with zero score eligibility', () => {
  const result = verifySubmission(registry(), submission('submission_observation'));
  assert.equal(result.providerState, 'observation');
  assert.equal(result.lifecycleState, 'VERIFIED');
  assert.equal(result.eligibilityClass, 'observation-only');
  assert.equal(result.identity.actorEpochId, 'epoch_1');
  assert.deepEqual(result.reasonCodes, ['PROVIDER_OBSERVATION_ONLY']);
});

test('quarantines permissionless commitments and never exposes private payload bytes', () => {
  const value = submission('submission_permissionless');
  const result = verifySubmission(registry(), value);
  assert.equal(result.authorization, 'permissionless');
  assert.equal(result.lifecycleState, 'QUARANTINED');
  assert.equal(result.eligibilityClass, 'quarantined');
  assert.equal(result.submission.nativePayload, null);
  assert.deepEqual(result.reasonCodes, ['PERMISSIONLESS_QUARANTINE']);
  const leaking = submission('submission_permissionless');
  leaking.nativePayload = { secret: 'must-not-leak' };
  assert.throws(() => verifySubmission(registry(), leaking), /committed nativePayload/);
});

test('rejects malformed shapes, payload mismatches, signatures, and registry versions', () => {
  const extra = submission('submission_active'); extra.extra = true;
  assert.throws(() => verifySubmission(registry(), extra), /unknown field/);
  const payload = submission('submission_active'); payload.nativePayload.outcome = 'failed';
  assert.throws(() => verifySubmission(registry(), payload), /nativePayloadHash/);
  const altered = submission('submission_active'); altered.nativePayload.outcome = 'failed'; altered.nativePayloadHash = buildNativePayloadHash(altered.nativePayload);
  assert.throws(() => verifySubmission(registry(), altered), /signature is invalid/);
  const signature = submission('submission_active'); signature.signature += '=';
  assert.throws(() => verifySubmission(registry(), signature), /canonical base64url/);
  const version = submission('submission_active'); version.registryVersion = 'other_registry';
  assert.throws(() => verifySubmission(registry(), version), /registryVersion/);
  const proof = submission('submission_active'); proof.proofRefs = ['https://proof.example/one#fragment'];
  assert.throws(() => verifySubmission(registry(), proof), /proof reference/);
});

test('rejects invalid timestamp order, future receipt, and replay delay', () => {
  const order = submission('submission_active'); order.occurredAt = '2026-07-01T00:00:11.000Z';
  assert.throws(() => verifySubmission(registry(), order), /timestamps/);
  const future = submission('submission_active');
  future.occurredAt = '2026-10-11T17:59:50.000Z';
  future.observedAt = '2026-10-11T17:59:55.000Z';
  future.receivedAt = '2026-10-11T18:00:00.001Z';
  assert.throws(() => verifySubmission(registry(), future), /after registry generation/);
  const stale = submission('submission_active'); stale.receivedAt = '2026-07-09T00:00:11.000Z';
  assert.throws(() => verifySubmission(registry(), stale), /replay receipt window/);
  const fractional = submission('submission_active'); fractional.observedAt = '2026-07-01T00:00:10.001Z';
  assert.throws(() => verifySubmission(registry(), fractional), /whole seconds/);
});

test('rejects provider states, key epochs, and schema authorizations invalid at observation time', () => {
  const suspendedRegistry = registry();
  suspendedRegistry.providers[0].state = 'suspended';
  suspendedRegistry.providers[0].stateEpochs[1].state = 'suspended';
  assert.throws(() => verifySubmission(suspendedRegistry, submission('submission_active')), /provider was not authorized/);

  const revokedKey = registry();
  revokedKey.providers[0].keyEpochs[0].revokedAt = '2026-06-30T00:00:00.000Z';
  assert.throws(() => verifySubmission(revokedKey, submission('submission_active')), /current provider key epoch|signing key/);

  const expiredAuthorization = registry();
  expiredAuthorization.providers[0].schemaAuthorizations[0].validUntil = '2026-06-30T00:00:00.000Z';
  assert.throws(() => verifySubmission(expiredAuthorization, submission('submission_active')), /current schema authorization|schema authorization/);

  const missingSchema = submission('submission_active'); missingSchema.schemaId = 'missing_schema';
  assert.throws(() => verifySubmission(registry(), missingSchema), /unauthorized schema/);
});

test('rejects unauthorized coordinate namespaces and false epoch claims', () => {
  const namespace = submission('submission_active');
  namespace.subjectCoordinates = [{ namespace: 'platform', network: 'regents', value: 'agent_1' }];
  resign(namespace);
  assert.throws(() => verifySubmission(registry(), namespace), /coordinate namespace/);

  const epoch = submission('submission_active'); epoch.claimedActorEpochId = 'epoch_1'; resign(epoch);
  assert.throws(() => verifySubmission(registry(), epoch), /claimed actor epoch/);
});

test('batches are input-order invariant and reject replayed IDs or provider events', () => {
  const active = submission('submission_active');
  const observation = submission('submission_observation');
  const permissionless = submission('submission_permissionless');
  const first = verifySubmissionBatch(registry(), [permissionless, active, observation]);
  const second = verifySubmissionBatch(registry(), [observation, permissionless, active]);
  assert.deepEqual(first, second);
  assert.deepEqual(first.map((item) => item.submission.submissionId), ['submission_active', 'submission_observation', 'submission_permissionless']);
  assert.throws(() => verifySubmissionBatch(registry(), [active, structuredClone(active)]), /duplicate submissionId/);
  const eventReplay = structuredClone(active); eventReplay.submissionId = 'submission_other'; resign(eventReplay);
  assert.throws(() => verifySubmissionBatch(registry(), [active, eventReplay]), /duplicate provider event/);
  const quotaEvent = structuredClone(eventReplay); quotaEvent.providerEventId = 'event_other'; resign(quotaEvent);
  const limited = registry();
  limited.providers[0].ratePolicy.maxEvents = '1';
  assert.throws(() => verifySubmissionBatch(limited, [active, quotaEvent]), /ratePolicy quota exceeded/);
  const volumeLimited = registry();
  volumeLimited.providers[0].volumePolicy.maxEvents = '1';
  assert.throws(() => verifySubmissionBatch(volumeLimited, [active, quotaEvent]), /volumePolicy quota exceeded/);
});

test('unresolved identities quarantine permissionless claims and reject approved false epochs', () => {
  const claim = submission('submission_permissionless');
  claim.subjectCoordinates = [{ namespace: 'erc8004', network: 'eip155:8453', value: '999999' }];
  claim.claimedActorEpochId = null;
  const result = verifySubmission(registry(), claim);
  assert.equal(result.lifecycleState, 'QUARANTINED');
  assert.deepEqual(result.reasonCodes, ['IDENTITY_UNRESOLVED', 'PERMISSIONLESS_QUARANTINE']);
});
