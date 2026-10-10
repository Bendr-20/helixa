'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { scorePreparedSnapshot } = require('../../cred-shadow/score');

const DAY = 86_400;
const NOW = Date.parse('2026-10-10T00:00:00.000Z') / 1000;

function preparedWithRisk(risks) {
  const records = [];
  const included = [];
  const categories = ['operational', 'financial'];
  for (const category of categories) {
    for (let index = 0; index < 4; index += 1) {
      const evidenceId = category + '_' + index;
      records.push({ evidenceId, category, direction: 'positive', severity: null, evidenceFamily: category, empId: 'emp_' + category, empVersion: '1', observedAtEpochSeconds: NOW - (index === 0 ? 31 : index) * DAY, providerControlGroup: index % 2 ? 'a' : 'b', proofClass: 'P1', materiality: 'meaningful', incidentKey: 'incident_' + evidenceId, correlationKey: 'cluster_' + evidenceId, status: 'ACTIVE', scoreEligible: true, finality: 'final', domainTags: ['coding'] });
      included.push({ evidenceId, allocatedMassMicroEu: '1010000', reasonCodes: [] });
    }
  }
  return { snapshot: { computedAtEpochSeconds: NOW, subject: { subjectId: 's', actorEpochId: 'e' }, identity: { resolution: 'resolved', assurance: 'current-control-bindings', compromised: false }, records, empPolicies: categories.map((category) => ({ empId: 'emp_' + category, empVersion: '1', evidenceFamily: category, positiveHalfLifeDays: 10000, negativeHalfLifeDays: 10000, correlationWindowSeconds: 7776000, clusterCapMicroEu: '2000000', providerBucket: { capacityMicroEu: '4000000', refillSeconds: 7776000 }, schemaBucket: { capacityMicroEu: '6000000', refillSeconds: 7776000 }, p4Bucket: { capacityMicroEu: '1000000', refillSeconds: 7776000 } })), contradictions: [], risks }, included, excluded: [], deduplicated: [] };
}

function risk(type, status = 'active', severity = 'critical') {
  return { riskId: type, type, status, severity, observedAt: '2026-10-01T00:00:00.000Z', remediationObservedAt: status === 'remediated' ? '2026-10-05T00:00:00.000Z' : null, proofRefs: [], remediationProofRefs: status === 'remediated' ? ['https://proof.example/remediation'] : [] };
}

test('keeps risk flags, score tier, and policy ceilings separate', () => {
  const exploit = scorePreparedSnapshot(preparedWithRisk([risk('active-exploit')]));
  assert.equal(exploit.scoreTier, exploit.tier);
  assert.equal(exploit.effectivePrivilegeTier, 'Junk');
  assert.ok(exploit.flags.includes('ACTIVE_EXPLOIT'));

  const defaulted = scorePreparedSnapshot(preparedWithRisk([risk('default', 'active', 'severe')]));
  assert.equal(defaulted.effectivePrivilegeTier, 'Marginal');
  assert.ok(defaulted.flags.includes('VERIFIED_DEFAULT_UNCURED'));
  assert.ok(defaulted.policyRiskLevels.includes('high'));

  const restricted = scorePreparedSnapshot(preparedWithRisk([risk('compliance-restriction', 'active', 'material')]));
  assert.equal(restricted.regulatedEligibility, false);
  assert.ok(restricted.flags.includes('COMPLIANCE_RESTRICTED'));
});

test('pending allegations do not alter score mass or status', () => {
  const baseline = scorePreparedSnapshot(preparedWithRisk([]));
  const pending = scorePreparedSnapshot(preparedWithRisk([risk('pending-allegation', 'active', 'severe')]));
  assert.equal(pending.internalScore, baseline.internalScore);
  assert.equal(pending.ratingStatus, baseline.ratingStatus);
  assert.ok(pending.flags.includes('PENDING_HIGH_IMPACT_REVIEW'));
});

test('identity compromise suspends and remediation clears flags without deleting history', () => {
  const active = scorePreparedSnapshot(preparedWithRisk([risk('identity-compromise')]));
  assert.equal(active.ratingStatus, 'SUSPENDED');
  assert.equal(active.score, null);
  assert.equal(typeof active.estimatedScore, 'number');
  assert.ok(active.flags.includes('IDENTITY_COMPROMISED'));

  const remediated = scorePreparedSnapshot(preparedWithRisk([risk('identity-compromise', 'remediated')]));
  assert.equal(remediated.ratingStatus, 'RATED');
  assert.ok(!remediated.flags.includes('IDENTITY_COMPROMISED'));
  assert.ok(remediated.reasonCodes.includes('REMEDIATION_VERIFIED'));
  assert.equal(remediated.auditRiskHistory.length, 1);
});

test('duplicate and correlated records cannot manufacture sample mass', () => {
  const prepared = preparedWithRisk([]);
  const baselineMass = scorePreparedSnapshot(prepared).effectiveIndependentMassMicroEu;
  prepared.deduplicated = [{ evidenceId: 'duplicate', canonicalEvidenceId: 'operational_0', reasonCodes: ['DUPLICATE_EXCLUDED'] }];
  prepared.snapshot.records.push({ ...prepared.snapshot.records[0], evidenceId: 'duplicate', providerControlGroup: 'c' });
  const result = scorePreparedSnapshot(prepared);
  assert.ok(result.confidence.dimensions.sourceDiversity >= 70);
  assert.equal(result.effectiveIndependentMassMicroEu, baselineMass);
});


test('Suspended takes precedence over identity-conflict Unrated', () => {
  const prepared = preparedWithRisk([risk('identity-compromise')]);
  prepared.snapshot.identity.resolution = 'conflict';
  prepared.snapshot.identity.compromised = true;
  const result = scorePreparedSnapshot(prepared);
  assert.equal(result.ratingStatus, 'SUSPENDED');
  assert.ok(result.flags.includes('IDENTITY_COMPROMISED'));
  assert.ok(result.reasonCodes.includes('IDENTITY_CONFLICT'));
});


test('remediation clears the ceiling but retains historical negative score mass', () => {
  function withIncident(status) {
    const prepared = preparedWithRisk([risk('active-exploit', status)]);
    prepared.snapshot.records.push({
      evidenceId: 'historical_exploit', category: 'operational', direction: 'negative',
      severity: 'critical', evidenceFamily: 'operational', empId: 'emp_operational', empVersion: '1',
      observedAtEpochSeconds: NOW - 10 * DAY, providerControlGroup: 'incident_group',
      proofClass: 'P1', materiality: 'meaningful', incidentKey: 'historical_exploit', correlationKey: 'historical_exploit', status: 'ACTIVE', scoreEligible: true, finality: 'final', domainTags: ['security'],
    });
    prepared.included.push({ evidenceId: 'historical_exploit', allocatedMassMicroEu: '1000000', reasonCodes: [] });
    return prepared;
  }
  const active = scorePreparedSnapshot(withIncident('active'));
  const remediated = scorePreparedSnapshot(withIncident('remediated'));
  assert.equal(active.internalScore, remediated.internalScore);
  assert.equal(active.categories.operational.effectiveNegativeMassMicroEu, remediated.categories.operational.effectiveNegativeMassMicroEu);
  assert.ok(active.flags.includes('ACTIVE_EXPLOIT'));
  assert.ok(!remediated.flags.includes('ACTIVE_EXPLOIT'));
  assert.ok(remediated.reasonCodes.includes('REMEDIATION_VERIFIED'));
});


test('audit risk history is a deeply immutable input-isolated snapshot', () => {
  const prepared = preparedWithRisk([risk('default', 'active', 'severe')]);
  const result = scorePreparedSnapshot(prepared);
  assert.ok(Object.isFrozen(result.auditRiskHistory));
  assert.ok(Object.isFrozen(result.auditRiskHistory[0]));
  assert.ok(Object.isFrozen(result.auditRiskHistory[0].proofRefs));
  assert.notEqual(result.auditRiskHistory[0], prepared.snapshot.risks[0]);
  prepared.snapshot.risks[0].severity = 'material';
  assert.equal(result.auditRiskHistory[0].severity, 'severe');
  assert.throws(() => { result.auditRiskHistory[0].severity = 'minor'; }, TypeError);
});
