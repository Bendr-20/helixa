'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');

const {
  normalizeEvidenceSnapshot,
  prepareEvidence,
} = require('../../cred-shadow/evidence');

const DAY = 86_400;
const COMPUTED_AT = '2026-10-10T00:00:00.000Z';
const SUBJECT = 'subject_alpha';
const EPOCH = 'epoch_1';

function hash(domain, bytes) {
  return 'sha256:' + createHash('sha256').update(domain).update(bytes).digest('hex');
}

function policy(overrides = {}) {
  const value = {
    empId: 'emp_operational',
    empVersion: '1.0.0',
    evidenceFamily: 'operational',
    positiveHalfLifeDays: 90,
    negativeHalfLifeDays: 180,
    correlationWindowSeconds: 7_776_000,
    clusterCapMicroEu: '2000000',
    providerBucket: { capacityMicroEu: '4000000', refillSeconds: 7_776_000 },
    schemaBucket: { capacityMicroEu: '6000000', refillSeconds: 7_776_000 },
    p4Bucket: { capacityMicroEu: '1000000', refillSeconds: 7_776_000 },
    ...overrides,
  };
  const fields = [
    value.empId, value.empVersion, value.evidenceFamily,
    value.positiveHalfLifeDays, value.negativeHalfLifeDays,
    value.correlationWindowSeconds, value.clusterCapMicroEu,
    value.providerBucket.capacityMicroEu, value.providerBucket.refillSeconds,
    value.schemaBucket.capacityMicroEu, value.schemaBucket.refillSeconds,
    value.p4Bucket.capacityMicroEu, value.p4Bucket.refillSeconds,
  ];
  const policyHash = hash('CRED-EMP-LEAF-v1\0', Buffer.from(JSON.stringify(fields)));
  return { ...value, policyHash, registryLeafIndex: 0, registryProof: [] };
}

function record(id, overrides = {}) {
  return {
    evidenceId: id,
    subjectId: SUBJECT,
    actorEpochId: EPOCH,
    schemaId: 'schema_task_completion',
    schemaVersion: '1.0.0',
    schemaFamilyId: 'schema-family_tasks',
    empId: 'emp_operational',
    empVersion: '1.0.0',
    empWindowSeconds: 7_776_000,
    providerId: 'provider_a',
    providerControlGroup: 'control_a',
    category: 'operational',
    direction: 'positive',
    proofClass: 'P1',
    materiality: 'meaningful',
    severity: null,
    evidenceFamily: 'operational',
    observedAt: '2026-10-01T00:00:00.000Z',
    incidentKey: 'incident_' + id,
    correlationKey: 'cluster_' + id,
    domainTags: ['coding'],
    status: 'ACTIVE',
    scoreEligible: true,
    finality: 'final',
    correctionOf: null,
    remediationOf: null,
    disputeId: null,
    nativePayloadHash: 'sha256:' + '11'.repeat(32),
    transformationHash: 'sha256:' + '22'.repeat(32),
    proofRefs: ['https://proof.example/' + id],
    ...overrides,
  };
}

function snapshot(records, overrides = {}) {
  const emp = policy();
  return {
    snapshotSchemaVersion: 'cred-shadow-snapshot-v1',
    methodologyId: 'cred-methodology-candidate-0.1.0',
    computedAt: COMPUTED_AT,
    validUntil: '2026-10-10T01:00:00.000Z',
    subject: { subjectId: SUBJECT, actorEpochId: EPOCH },
    versions: {
      identityGraph: 'identity-1', providerRegistry: 'providers-1',
      schemaRegistry: 'schemas-1', empRegistry: 'emps-1', ontology: 'ontology-1',
    },
    roots: {
      inputManifestHash: 'sha256:' + '33'.repeat(32),
      snapshotRoot: null,
      empRegistryRoot: emp.policyHash,
    },
    empPolicies: [emp],
    identity: {
      resolution: 'resolved', assurance: 'current-control-bindings',
      controlProofObservedAt: '2026-10-09T00:00:00.000Z', compromised: false,
    },
    records,
    contradictions: [],
    risks: [],
    legacy: null,
    segments: {
      ecosystem: 'base', evidenceVolumeBand: 'thin', subjectAgeBand: 'developing',
      identityQualityBand: 'fully-bound', sourceAvailabilityBand: 'diverse',
      categoryCoverageBand: 'one',
    },
    ...overrides,
  };
}

function at(baseIso, seconds) {
  return new Date(Date.parse(baseIso) + seconds * 1000).toISOString();
}

function clone(value) {
  return structuredClone(value);
}

test('normalizes a complete snapshot and canonically orders records', () => {
  const input = snapshot([
    record('ev_b', { observedAt: '2026-10-02T00:00:00.000Z' }),
    record('ev_c', { observedAt: '2026-10-01T00:00:00.000Z' }),
    record('ev_a', { observedAt: '2026-10-01T00:00:00.000Z' }),
  ]);
  const normalized = normalizeEvidenceSnapshot(input);
  assert.deepEqual(normalized.records.map((item) => item.evidenceId), ['ev_a', 'ev_c', 'ev_b']);
  assert.ok(Object.isFrozen(normalized));
  assert.ok(Object.isFrozen(normalized.records[0]));
  assert.equal(normalized.computedAtEpochSeconds, Date.parse(COMPUTED_AT) / 1000);
});

test('rejects unknown fields and invalid closed enums', () => {
  const unknownEnvelope = snapshot([record('ev_1')]);
  unknownEnvelope.surprise = true;
  assert.throws(() => normalizeEvidenceSnapshot(unknownEnvelope), /unknown.*surprise/i);

  const unknownRecord = snapshot([record('ev_1', { invented: true })]);
  assert.throws(() => normalizeEvidenceSnapshot(unknownRecord), /unknown.*invented/i);

  assert.throws(
    () => normalizeEvidenceSnapshot(snapshot([record('ev_1', { category: 'social' })])),
    /category/i,
  );
});

test('rejects noncanonical, future, or inconsistent timestamps', () => {
  assert.throws(
    () => normalizeEvidenceSnapshot(snapshot([record('ev_1', { observedAt: '2026-10-01' })])),
    /timestamp/i,
  );
  assert.throws(
    () => normalizeEvidenceSnapshot(snapshot([record('ev_1', { observedAt: '2026-10-11T00:00:00.000Z' })])),
    /future/i,
  );
  assert.throws(
    () => normalizeEvidenceSnapshot(snapshot([record('ev_1')], { validUntil: '2026-10-10T02:00:00.000Z' })),
    /validUntil/i,
  );
});

test('rejects invalid direction, severity, identity, and P4 combinations', () => {
  assert.throws(
    () => normalizeEvidenceSnapshot(snapshot([record('ev_1', { direction: 'negative', severity: null })])),
    /severity/i,
  );
  assert.throws(
    () => normalizeEvidenceSnapshot(snapshot([record('ev_1', { severity: 'minor' })])),
    /positive.*severity/i,
  );
  assert.throws(
    () => normalizeEvidenceSnapshot(snapshot([record('ev_1', { subjectId: 'subject_other' })])),
    /subject/i,
  );
  assert.throws(
    () => normalizeEvidenceSnapshot(snapshot([record('ev_1', { actorEpochId: 'epoch_other' })])),
    /epoch/i,
  );
  assert.throws(
    () => normalizeEvidenceSnapshot(snapshot([record('ev_1', { direction: 'negative', severity: 'severe', proofClass: 'P4' })])),
    /P4.*severe/i,
  );
});

test('rejects duplicate IDs and noncanonical arrays', () => {
  assert.throws(
    () => normalizeEvidenceSnapshot(snapshot([record('ev_1'), record('ev_1')])),
    /duplicate.*evidence/i,
  );
  assert.throws(
    () => normalizeEvidenceSnapshot(snapshot([record('ev_1', { domainTags: ['research', 'coding'] })])),
    /domainTags.*sorted/i,
  );
  assert.throws(
    () => normalizeEvidenceSnapshot(snapshot([record('ev_1', { proofRefs: ['https://z.example', 'https://a.example'] })])),
    /proofRefs.*sorted/i,
  );
});

test('verifies EMP policy hashes, roots, record binding, and methodology maxima', () => {
  const badHash = snapshot([record('ev_1')]);
  badHash.empPolicies[0].policyHash = 'sha256:' + 'ff'.repeat(32);
  assert.throws(() => normalizeEvidenceSnapshot(badHash), /policyHash/i);

  const badRoot = snapshot([record('ev_1')]);
  badRoot.roots.empRegistryRoot = 'sha256:' + 'ee'.repeat(32);
  assert.throws(() => normalizeEvidenceSnapshot(badRoot), /empRegistryRoot/i);

  const badWindow = snapshot([record('ev_1', { empWindowSeconds: 1 })]);
  assert.throws(() => normalizeEvidenceSnapshot(badWindow), /empWindowSeconds/i);

  const tooLong = snapshot([record('ev_1')]);
  tooLong.empPolicies = [policy({ positiveHalfLifeDays: 91 })];
  tooLong.roots.empRegistryRoot = tooLong.empPolicies[0].policyHash;
  assert.throws(() => normalizeEvidenceSnapshot(tooLong), /half-life.*maximum/i);
});

test('retains ineligible lifecycle records but never lets them preempt eligible evidence', () => {
  const early = record('ev_early', {
    observedAt: '2026-09-30T00:00:00.000Z', incidentKey: 'incident_shared',
    status: 'QUARANTINED', scoreEligible: false, finality: 'pending',
  });
  const active = record('ev_active', { incidentKey: 'incident_shared' });
  const result = prepareEvidence(snapshot([early, active]));
  assert.deepEqual(result.included.map((item) => item.evidenceId), ['ev_active']);
  assert.deepEqual(result.excluded.map((item) => item.evidenceId), ['ev_early']);
  assert.ok(result.excluded[0].reasonCodes.includes('LIFECYCLE_INELIGIBLE'));
});

test('deduplicates only eligible records by canonical observed time and ID', () => {
  const result = prepareEvidence(snapshot([
    record('ev_b', { incidentKey: 'incident_shared', observedAt: '2026-10-01T00:00:00.000Z' }),
    record('ev_a', { incidentKey: 'incident_shared', observedAt: '2026-10-01T00:00:00.000Z' }),
  ]));
  assert.deepEqual(result.included.map((item) => item.evidenceId), ['ev_a']);
  assert.deepEqual(result.deduplicated.map((item) => item.evidenceId), ['ev_b']);
  assert.ok(result.deduplicated[0].reasonCodes.includes('DUPLICATE_EXCLUDED'));
});

test('applies canonical correlation discounts and the 2 EU cluster cap', () => {
  const base = '2026-10-01T00:00:00.000Z';
  const records = Array.from({ length: 6 }, (_, index) => record('ev_' + index, {
    observedAt: at(base, index),
    incidentKey: 'incident_' + index,
    correlationKey: 'cluster_shared',
    providerControlGroup: 'control_' + index,
    schemaFamilyId: 'schema-family_' + index,
  }));
  const result = prepareEvidence(snapshot(records));
  assert.deepEqual(
    result.included.map((item) => item.preSeverityMassMicroEu),
    ['1000000', '500000', '250000', '125000', '125000', '0'],
  );
  assert.deepEqual(
    result.included.map((item) => item.independenceRank),
    [1, 2, 3, 4, 5, 6],
  );
  assert.ok(result.included[1].reasonCodes.includes('CORRELATION_DISCOUNT_APPLIED'));
  assert.ok(result.included[5].reasonCodes.includes('CORRELATION_CAP_APPLIED'));
});

test('applies positive provider-control, schema-family, and P4 token buckets', () => {
  const base = '2026-10-01T00:00:00.000Z';
  const providerRecords = Array.from({ length: 5 }, (_, index) => record('provider_' + index, {
    observedAt: base,
    incidentKey: 'provider_incident_' + index,
    correlationKey: 'provider_cluster_' + index,
    schemaFamilyId: 'schema-family_' + index,
  }));
  const provider = prepareEvidence(snapshot(providerRecords));
  assert.deepEqual(provider.included.map((item) => item.allocatedMassMicroEu), ['1000000', '1000000', '1000000', '1000000', '0']);
  assert.ok(provider.included[4].reasonCodes.includes('PROVIDER_CAP_APPLIED'));

  const schemaRecords = Array.from({ length: 7 }, (_, index) => record('schema_' + index, {
    observedAt: base,
    incidentKey: 'schema_incident_' + index,
    correlationKey: 'schema_cluster_' + index,
    providerControlGroup: 'control_' + index,
  }));
  const schema = prepareEvidence(snapshot(schemaRecords));
  assert.equal(schema.included[6].allocatedMassMicroEu, '0');
  assert.ok(schema.included[6].reasonCodes.includes('SCHEMA_CAP_APPLIED'));

  const p4Records = Array.from({ length: 5 }, (_, index) => record('p4_' + index, {
    observedAt: base, proofClass: 'P4',
    incidentKey: 'p4_incident_' + index,
    correlationKey: 'p4_cluster_' + index,
    providerControlGroup: 'p4_control_' + index,
    schemaFamilyId: 'p4_schema_' + index,
  }));
  const p4 = prepareEvidence(snapshot(p4Records));
  assert.deepEqual(p4.included.map((item) => item.allocatedMassMicroEu), ['250000', '250000', '250000', '250000', '0']);
  assert.ok(p4.included[4].reasonCodes.includes('P4_CAP_APPLIED'));
});

test('refills token buckets deterministically from canonical elapsed time', () => {
  const start = '2026-06-01T00:00:00.000Z';
  const records = Array.from({ length: 4 }, (_, index) => record('early_' + index, {
    observedAt: start,
    incidentKey: 'early_incident_' + index,
    correlationKey: 'early_cluster_' + index,
    schemaFamilyId: 'schema-family_' + index,
  }));
  records.push(record('later', {
    observedAt: at(start, 45 * DAY),
    incidentKey: 'later_incident', correlationKey: 'later_cluster', schemaFamilyId: 'schema-family_later',
  }));
  const input = snapshot(records, {
    computedAt: '2026-08-01T00:00:00.000Z',
    validUntil: '2026-08-01T01:00:00.000Z',
  });
  input.identity.controlProofObservedAt = '2026-07-31T00:00:00.000Z';
  const result = prepareEvidence(input);
  assert.equal(result.included.at(-1).allocatedMassMicroEu, '1000000');
  assert.equal(result.included.at(-1).bucketBalances.providerControlGroupMicroEu, '1000000');
});


test('is invariant to provider delivery order', () => {
  const rows = [
    record('ev_c', { observedAt: '2026-10-03T00:00:00.000Z', correlationKey: 'shared' }),
    record('ev_a', { observedAt: '2026-10-01T00:00:00.000Z', correlationKey: 'shared' }),
    record('ev_b', { observedAt: '2026-10-02T00:00:00.000Z', correlationKey: 'shared' }),
  ];
  const forward = prepareEvidence(snapshot(rows));
  const reverse = prepareEvidence(snapshot([...rows].reverse()));
  assert.deepEqual(forward.included, reverse.included);
  assert.deepEqual(forward.excluded, reverse.excluded);
  assert.deepEqual(forward.deduplicated, reverse.deduplicated);
});

test('enforces EMP caps that tighten methodology defaults', () => {
  const tight = policy({
    clusterCapMicroEu: '1000000',
    providerBucket: { capacityMicroEu: '2000000', refillSeconds: 7_776_000 },
    schemaBucket: { capacityMicroEu: '3000000', refillSeconds: 7_776_000 },
    p4Bucket: { capacityMicroEu: '500000', refillSeconds: 7_776_000 },
  });
  const rows = Array.from({ length: 3 }, (_, index) => record('tight_' + index, {
    observedAt: '2026-10-01T00:00:00.000Z',
    incidentKey: 'tight_incident_' + index,
    correlationKey: 'tight_cluster_' + index,
    schemaFamilyId: 'tight_schema_' + index,
  }));
  const input = snapshot(rows);
  input.empPolicies = [tight];
  input.roots.empRegistryRoot = tight.policyHash;
  const result = prepareEvidence(input);
  assert.deepEqual(result.included.map((item) => item.allocatedMassMicroEu), ['1000000', '1000000', '0']);
  assert.ok(result.included[2].reasonCodes.includes('PROVIDER_CAP_APPLIED'));
});

test('does not apply positive-influence token buckets to negative evidence', () => {
  const rows = Array.from({ length: 5 }, (_, index) => record('negative_' + index, {
    observedAt: '2026-10-01T00:00:00.000Z',
    direction: 'negative', severity: 'minor',
    incidentKey: 'negative_incident_' + index,
    correlationKey: 'negative_cluster_' + index,
    schemaFamilyId: 'negative_schema_' + index,
  }));
  const result = prepareEvidence(snapshot(rows));
  assert.deepEqual(result.included.map((item) => item.allocatedMassMicroEu), Array(5).fill('1000000'));
  assert.ok(result.included.every((item) => Object.keys(item.bucketBalances).length === 0));
});
