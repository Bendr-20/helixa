'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const pins = require('./fixtures/artifact-pins.json');
const {
  canonicalStringify,
  buildParameterMaterial,
  buildEvidenceMaterial,
  buildUnsignedArtifact,
} = require('../../cred-shadow/artifact');
const { CANDIDATE_PARAMETERS } = require('../../cred-shadow/parameters');

function sha(domain, bytes) {
  return 'sha256:' + createHash('sha256').update(domain).update(bytes).digest('hex');
}

function policy() {
  const value = {
    empId: 'emp_operational', empVersion: '1.0.0', evidenceFamily: 'operational',
    positiveHalfLifeDays: 90, negativeHalfLifeDays: 180,
    correlationWindowSeconds: 7776000, clusterCapMicroEu: '2000000',
    providerBucket: { capacityMicroEu: '4000000', refillSeconds: 7776000 },
    schemaBucket: { capacityMicroEu: '6000000', refillSeconds: 7776000 },
    p4Bucket: { capacityMicroEu: '1000000', refillSeconds: 7776000 },
  };
  const fields = [value.empId, value.empVersion, value.evidenceFamily, value.positiveHalfLifeDays, value.negativeHalfLifeDays, value.correlationWindowSeconds, value.clusterCapMicroEu, value.providerBucket.capacityMicroEu, value.providerBucket.refillSeconds, value.schemaBucket.capacityMicroEu, value.schemaBucket.refillSeconds, value.p4Bucket.capacityMicroEu, value.p4Bucket.refillSeconds];
  const policyHash = sha('CRED-EMP-LEAF-v1\0', Buffer.from(JSON.stringify(fields)));
  return { ...value, policyHash, registryLeafIndex: 0, registryProof: [] };
}

function record(id, observedAt, nativeByte = '11') {
  return {
    evidenceId: id, subjectId: 'subject_alpha', actorEpochId: 'epoch_1',
    schemaId: 'schema_task', schemaVersion: '1.0.0', schemaFamilyId: 'schema-family_task',
    empId: 'emp_operational', empVersion: '1.0.0', empWindowSeconds: 7776000,
    providerId: 'provider_a', providerControlGroup: 'control_a', category: 'operational',
    direction: 'positive', proofClass: 'P1', materiality: 'meaningful', severity: null,
    evidenceFamily: 'operational', observedAt, incidentKey: 'incident_' + id,
    correlationKey: 'cluster_' + id, domainTags: ['coding'], status: 'ACTIVE',
    scoreEligible: true, finality: 'final', correctionOf: null, remediationOf: null,
    disputeId: null, nativePayloadHash: 'sha256:' + nativeByte.repeat(32),
    transformationHash: 'sha256:' + '22'.repeat(32), proofRefs: ['https://proof.example/' + id],
  };
}

function snapshot(records) {
  const emp = policy();
  return {
    snapshotSchemaVersion: 'cred-shadow-snapshot-v1',
    methodologyId: 'cred-methodology-candidate-0.1.0',
    computedAt: '2026-10-10T00:00:00.000Z', validUntil: '2026-10-10T01:00:00.000Z',
    subject: { subjectId: 'subject_alpha', actorEpochId: 'epoch_1' },
    versions: { identityGraph: 'identity-1', providerRegistry: 'providers-1', schemaRegistry: 'schemas-1', empRegistry: 'emps-1', ontology: 'ontology-1' },
    roots: { inputManifestHash: 'sha256:' + '33'.repeat(32), snapshotRoot: null, empRegistryRoot: emp.policyHash },
    empPolicies: [emp],
    identity: { resolution: 'resolved', assurance: 'current-control-bindings', controlProofObservedAt: '2026-10-09T00:00:00.000Z', compromised: false },
    records,
    contradictions: [], risks: [], legacy: null,
    segments: { ecosystem: 'base', evidenceVolumeBand: 'thin', subjectAgeBand: 'developing', identityQualityBand: 'fully-bound', sourceAvailabilityBand: 'single', categoryCoverageBand: 'one' },
  };
}

test('cred-cjson-v1 has exact UTF-8 ordering and escaping', () => {
  const value = { 'é': 2, z: 'quote" slash\\ controls' + '\n\u0000', a: 1n };
  const expected = '{"a":"1","z":"quote\\u0022 slash\\u005c controls\\u000a\\u0000","é":2}';
  assert.equal(canonicalStringify(value), expected);
  assert.equal(Buffer.from(canonicalStringify(value)).toString('hex'), pins.canonicalUtf8Hex);
});
test('cred-cjson-v1 rejects ambiguous or unsupported values', () => {
  const symbolKeyed = { ok: true };
  symbolKeyed[Symbol('hidden')] = true;
  const accessor = {};
  Object.defineProperty(accessor, 'value', { enumerable: true, get: () => 1 });
  for (const value of [1.5, -0, NaN, Infinity, undefined, Symbol('x'), () => {}, new Date(), { bad: undefined }, '\ud800', symbolKeyed, accessor]) {
    assert.throws(() => canonicalStringify(value));
  }
});

test('logical event order cannot change canonical bytes or hashes', () => {
  const first = snapshot([
    record('ev_b', '2026-10-02T00:00:00.000Z', '11'),
    record('ev_a', '2026-10-01T00:00:00.000Z', '44'),
  ]);
  const second = snapshot([...first.records].reverse());
  const a = buildUnsignedArtifact(first);
  const b = buildUnsignedArtifact(second);
  assert.equal(a.parameterBytes, b.parameterBytes);
  assert.equal(a.evidenceBytes, b.evidenceBytes);
  assert.equal(a.canonicalBytes, b.canonicalBytes);
  assert.equal(a.parameterSetHash, b.parameterSetHash);
  assert.equal(a.evidenceSetHash, b.evidenceSetHash);
});

test('evidence and parameter bytes have separate hash domains', () => {
  const base = snapshot([record('ev_a', '2026-10-01T00:00:00.000Z', '11')]);
  const changedEvidence = snapshot([record('ev_a', '2026-10-01T00:00:00.000Z', '55')]);
  const a = buildUnsignedArtifact(base);
  const b = buildUnsignedArtifact(changedEvidence);
  assert.equal(a.parameterSetHash, b.parameterSetHash);
  assert.notEqual(a.evidenceSetHash, b.evidenceSetHash);

  const changedParameters = structuredClone(CANDIDATE_PARAMETERS);
  changedParameters.priorMass.positive = 2_000_000n;
  const originalMaterial = buildParameterMaterial(base, CANDIDATE_PARAMETERS);
  const changedMaterial = buildParameterMaterial(base, changedParameters);
  assert.notEqual(originalMaterial.hash, changedMaterial.hash);
  assert.notEqual(buildEvidenceMaterial(base).hash, buildEvidenceMaterial(changedEvidence).hash);
});

test('artifact payload is unsigned, complete, and contains no raw BigInt JSON', () => {
  const artifact = buildUnsignedArtifact(snapshot([record('ev_a', '2026-10-10T00:00:00.000Z')]));
  assert.equal(artifact.unsignedPayload.artifactType, 'cred-shadow-unsigned-payload-v1');
  assert.equal(artifact.unsignedPayload.canonicalSerializationVersion, 'cred-cjson-v1');
  assert.equal(artifact.unsignedPayload.signature, undefined);
  assert.equal(artifact.unsignedPayload.ratingStatus, 'PROVISIONAL');
  assert.equal(artifact.unsignedPayload.score, null);
  assert.equal(typeof artifact.unsignedPayload.estimatedScore, 'number');
  assert.equal(artifact.unsignedPayload.validUntil, '2026-10-10T01:00:00.000Z');
  assert.equal(artifact.unsignedPayload.versions.empRegistry, 'emps-1');
  assert.ok(Object.isFrozen(artifact.unsignedPayload));
  assert.ok(Object.isFrozen(artifact.unsignedPayload.categories));
  assert.ok(Object.isFrozen(artifact.unsignedPayload.categories[0]));
  assert.throws(() => { artifact.unsignedPayload.categories[0].publicScore = 0; }, TypeError);
  assert.doesNotThrow(() => JSON.parse(artifact.canonicalBytes));
  assert.ok(!artifact.canonicalBytes.includes('[object BigInt]'));
});

test('fixture-pins the complete canonical bytes and hashes', () => {
  const artifact = buildUnsignedArtifact(snapshot([record('ev_a', '2026-10-10T00:00:00.000Z')]));
  assert.equal(artifact.parameterBytes, pins.parameterBytes);
  assert.equal(artifact.evidenceBytes, pins.evidenceBytes);
  assert.equal(artifact.canonicalBytes, pins.canonicalBytes);
  assert.equal(artifact.parameterSetHash, pins.parameterSetHash);
  assert.equal(artifact.evidenceSetHash, pins.evidenceSetHash);
  assert.equal(artifact.artifactHash, pins.artifactHash);
});
