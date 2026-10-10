'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  sourceDiversityScore,
  identityAssuranceScore,
  computeCoverage,
  computeConfidence,
} = require('../../cred-shadow/confidence');
const {
  tierForScore,
  scorePreparedSnapshot,
  scoreDomainProfile,
} = require('../../cred-shadow/score');

const DAY = 86_400;
const NOW = Date.parse('2026-10-10T00:00:00.000Z') / 1000;

function preparedFixture(options = {}) {
  const categories = options.categories || ['operational', 'financial'];
  const perCategory = options.perCategory ?? 4;
  const groups = options.groups || ['control_a', 'control_b'];
  const proofClass = options.proofClass || 'P1';
  const domainTags = options.domainTags || ['coding'];
  const records = [];
  const included = [];
  let sequence = 0;
  for (const category of categories) {
    for (let index = 0; index < perCategory; index += 1) {
      const evidenceId = category + '_' + index;
      const ageDays = index === 0 ? (options.spanDays ?? 31) : Math.max(0, index - 1);
      records.push({
        evidenceId,
        category,
        direction: 'positive',
        severity: null,
        evidenceFamily: category,
        empId: 'emp_' + category,
        empVersion: '1',
        observedAtEpochSeconds: NOW - ageDays * DAY,
        providerControlGroup: groups[sequence % groups.length],
        proofClass,
        materiality: 'meaningful',
        incidentKey: 'incident_' + evidenceId,
        correlationKey: 'cluster_' + evidenceId,
        status: 'ACTIVE',
        scoreEligible: true,
        finality: 'final',
        domainTags,
      });
      included.push({
        evidenceId,
        allocatedMassMicroEu: options.massMicroEu || '1010000',
        reasonCodes: [],
      });
      sequence += 1;
    }
  }
  return {
    snapshot: {
      computedAtEpochSeconds: NOW,
      subject: { subjectId: 'subject_alpha', actorEpochId: 'epoch_1' },
      identity: {
        resolution: options.identityResolution || 'resolved',
        assurance: options.identityAssurance || 'current-control-bindings',
        compromised: Boolean(options.compromised),
      },
      records,
      empPolicies: categories.map((category) => ({
        empId: 'emp_' + category,
        empVersion: '1',
        evidenceFamily: category,
        positiveHalfLifeDays: options.halfLifeDays || 10_000,
        negativeHalfLifeDays: options.halfLifeDays || 10_000,
        correlationWindowSeconds: 7_776_000,
        clusterCapMicroEu: '2000000',
        providerBucket: { capacityMicroEu: '4000000', refillSeconds: 7_776_000 },
        schemaBucket: { capacityMicroEu: '6000000', refillSeconds: 7_776_000 },
        p4Bucket: { capacityMicroEu: '1000000', refillSeconds: 7_776_000 },
      })),
      contradictions: options.contradictions || [],
      risks: options.risks || [],
    },
    included,
    excluded: options.excluded || [],
    deduplicated: options.deduplicated || [],
  };
}

test('maps confidence dimensions and coverage deterministically', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(sourceDiversityScore), [0, 25, 50, 70, 85, 100]);
  assert.equal(sourceDiversityScore(12), 100);
  assert.equal(identityAssuranceScore('current-control-bindings'), 100);
  assert.equal(identityAssuranceScore('current-control-partial'), 80);
  assert.equal(identityAssuranceScore('registry-only'), 60);
  assert.equal(identityAssuranceScore('none'), 0);

  const coverage = computeCoverage({
    operational: { effectiveIndependentMassMicroEu: '4000000' },
    financial: { effectiveIndependentMassMicroEu: '2000000' },
    onchain: { effectiveIndependentMassMicroEu: '0' },
    identity: { effectiveIndependentMassMicroEu: '0' },
  });
  assert.deepEqual(coverage.category, { operational: 100, financial: 50, onchain: 0, identity: 0 });
  assert.equal(coverage.overall, 43);
});

test('computes weak-link confidence with hard caps', () => {
  const prepared = preparedFixture();
  const score = scorePreparedSnapshot(prepared);
  assert.deepEqual(score.confidence.dimensions, {
    sampleSupport: 50,
    sourceDiversity: 50,
    recency: 100,
    consistency: 100,
    identityAssurance: 100,
  });
  assert.equal(score.confidence.value, 70);

  const oneSource = scorePreparedSnapshot(preparedFixture({ groups: ['only'] }));
  assert.equal(oneSource.confidence.value, 39);
  assert.ok(oneSource.reasonCodes.includes('PROVISIONAL_DIVERSITY_GATE'));

  const p4Only = scorePreparedSnapshot(preparedFixture({ proofClass: 'P4' }));
  assert.equal(p4Only.confidence.value, 25);
  assert.equal(p4Only.ratingStatus, 'PROVISIONAL');
});

test('uses explicit publication-state precedence and null canonical fields', () => {
  const rated = scorePreparedSnapshot(preparedFixture());
  assert.equal(rated.ratingStatus, 'RATED');
  assert.equal(rated.score, 59);
  assert.equal(rated.tier, 'Qualified');
  assert.equal(rated.estimatedScore, null);

  const provisional = scorePreparedSnapshot(preparedFixture({ perCategory: 1 }));
  assert.equal(provisional.ratingStatus, 'PROVISIONAL');
  assert.equal(provisional.score, null);
  assert.equal(provisional.tier, null);
  assert.equal(typeof provisional.estimatedScore, 'number');

  const unrated = scorePreparedSnapshot(preparedFixture({ perCategory: 0 }));
  assert.equal(unrated.ratingStatus, 'UNRATED');
  assert.equal(unrated.score, null);
  assert.equal(unrated.estimatedScore, null);
  assert.ok(unrated.reasonCodes.includes('UNRATED_INSUFFICIENT_EVIDENCE'));
  assert.deepEqual(unrated.advancedEligibility, { Prime: false, Preferred: false });

  const conflicted = scorePreparedSnapshot(preparedFixture({ identityResolution: 'conflict' }));
  assert.equal(conflicted.ratingStatus, 'UNRATED');
  assert.equal(conflicted.confidence.dimensions.identityAssurance, 0);
  assert.equal(conflicted.confidence.value, 0);

  const suspended = scorePreparedSnapshot(preparedFixture({ compromised: true }));
  assert.equal(suspended.ratingStatus, 'SUSPENDED');
  assert.equal(suspended.score, null);
  assert.equal(typeof suspended.estimatedScore, 'number');
});

test('pins every exact tier boundary', () => {
  assert.deepEqual([0, 25, 26, 50, 51, 75, 76, 90, 91, 100].map(tierForScore), [
    'Junk', 'Junk', 'Marginal', 'Marginal', 'Qualified',
    'Qualified', 'Prime', 'Prime', 'Preferred', 'Preferred',
  ]);
});

test('domain profiles are isolated and enforce every domain gate', () => {
  const prepared = preparedFixture({ categories: ['operational', 'financial', 'onchain', 'identity'], perCategory: 2, groups: ['a', 'b'], spanDays: 31 });
  const universal = scorePreparedSnapshot(prepared);
  const coding = scoreDomainProfile(prepared, 'coding');
  assert.equal(coding.ratingStatus, 'RATED');
  assert.ok(BigInt(coding.effectiveIndependentMassMicroEu) > 7_900_000n);
  assert.equal(coding.independentControlGroups, 2);
  assert.equal(coding.observationSpanDays, 31);
  assert.equal(coding.coverage.overall, 50);
  assert.equal(universal.ratingStatus, 'RATED');

  assert.equal(scoreDomainProfile(preparedFixture({ categories: ['operational', 'financial'], perCategory: 1 }), 'coding').ratingStatus, 'PROVISIONAL');
  assert.equal(scoreDomainProfile(preparedFixture({ categories: ['operational', 'financial', 'onchain', 'identity'], perCategory: 2, groups: ['only'] }), 'coding').ratingStatus, 'PROVISIONAL');
  assert.equal(scoreDomainProfile(preparedFixture({ categories: ['operational', 'financial', 'onchain', 'identity'], perCategory: 2, spanDays: 29 }), 'coding').ratingStatus, 'PROVISIONAL');
  assert.equal(scoreDomainProfile(prepared, 'research').ratingStatus, 'UNRATED');
});


test('enforces Prime and Preferred privilege boundaries independently of score tier', () => {
  const prime = scorePreparedSnapshot(preparedFixture({
    categories: ['operational', 'financial', 'onchain', 'identity'],
    perCategory: 9,
    groups: ['a', 'b', 'c'],
    spanDays: 90,
  }));
  assert.equal(prime.ratingStatus, 'RATED');
  assert.equal(prime.scoreTier, 'Prime');
  assert.equal(prime.advancedEligibility.Prime, true);
  assert.equal(prime.advancedEligibility.Preferred, false);

  const preferred = scorePreparedSnapshot(preparedFixture({
    categories: ['operational', 'financial', 'onchain', 'identity'],
    perCategory: 36,
    groups: ['a', 'b', 'c', 'd'],
    spanDays: 180,
  }));
  assert.equal(preferred.ratingStatus, 'RATED');
  assert.equal(preferred.scoreTier, 'Preferred');
  assert.equal(preferred.advancedEligibility.Prime, true);
  assert.equal(preferred.advancedEligibility.Preferred, true);
});

test('domain coverage and confidence gates fail closed at the boundary', () => {
  const lowCoverage = preparedFixture({
    categories: ['operational', 'financial', 'onchain'],
    perCategory: 2,
    groups: ['a', 'b'],
    spanDays: 31,
  });
  const result = scoreDomainProfile(lowCoverage, 'coding');
  assert.equal(result.coverage.overall, 40);
  assert.equal(result.ratingStatus, 'PROVISIONAL');
  assert.ok(result.reasonCodes.includes('PROVISIONAL_COVERAGE_GATE'));
});


test('computes contradiction consistency and stale recency exactly', () => {
  const contradicted = preparedFixture({
    contradictions: [{ contradictionId: 'c1', massMicroEu: '4000000', status: 'unresolved', recordIds: [] }],
  });
  const contradictionScore = scorePreparedSnapshot(contradicted);
  assert.equal(contradictionScore.confidence.dimensions.consistency, 50);

  const stale = preparedFixture({ halfLifeDays: 90 });
  for (const record of stale.snapshot.records) record.observedAtEpochSeconds = NOW - 90 * DAY;
  const staleScore = scorePreparedSnapshot(stale);
  assert.equal(staleScore.confidence.dimensions.recency, 50);
  assert.ok(staleScore.reasonCodes.includes('PROVISIONAL_AGE_GATE'));
});

test('mixed P4 sources cannot satisfy Rated diversity', () => {
  const prepared = preparedFixture({ groups: ['control_a', 'control_b'] });
  for (const record of prepared.snapshot.records) {
    if (record.providerControlGroup === 'control_b') record.proofClass = 'P4';
  }
  const result = scorePreparedSnapshot(prepared);
  assert.equal(result.confidence.independentControlGroups, 2);
  assert.equal(result.confidence.nonP4IndependentControlGroups, 1);
  assert.equal(result.ratingStatus, 'PROVISIONAL');
  assert.ok(result.reasonCodes.includes('PROVISIONAL_DIVERSITY_GATE'));
});

test('non-Rated subjects never receive advanced privilege eligibility', () => {
  const prepared = preparedFixture({
    categories: ['operational', 'financial', 'onchain', 'identity'],
    perCategory: 36,
    groups: ['a', 'b', 'c', 'd'],
    spanDays: 20,
  });
  prepared.snapshot.records.forEach((record, index) => {
    record.observedAtEpochSeconds = NOW - (index % 21) * DAY;
  });
  const result = scorePreparedSnapshot(prepared);
  assert.equal(result.scoreTier, 'Preferred');
  assert.equal(result.ratingStatus, 'PROVISIONAL');
  assert.deepEqual(result.advancedEligibility, { Prime: false, Preferred: false });
  assert.equal(result.effectivePrivilegeTier, null);
});

test('domain profiles enforce ontology, identity, and Suspended precedence', () => {
  assert.throws(() => scoreDomainProfile(preparedFixture(), 'provider-invented-domain'), /ontology/i);

  const conflicted = preparedFixture({
    categories: ['operational', 'financial', 'onchain', 'identity'],
    perCategory: 2,
    identityResolution: 'conflict',
  });
  const conflictResult = scoreDomainProfile(conflicted, 'coding');
  assert.equal(conflictResult.ratingStatus, 'UNRATED');
  assert.equal(conflictResult.confidence.dimensions.identityAssurance, 0);
  assert.equal(conflictResult.score, null);

  const compromised = preparedFixture({
    categories: ['operational', 'financial', 'onchain', 'identity'],
    perCategory: 2,
    identityResolution: 'conflict',
    compromised: true,
  });
  const suspended = scoreDomainProfile(compromised, 'coding');
  assert.equal(suspended.ratingStatus, 'SUSPENDED');
  assert.equal(suspended.score, null);
  assert.equal(typeof suspended.estimatedScore, 'number');
  assert.deepEqual(suspended.advancedEligibility, { Prime: false, Preferred: false });
  assert.equal(suspended.effectivePrivilegeTier, null);
});


test('off-domain evidence cannot suppress a domain event before domain preparation', () => {
  const prepared = preparedFixture({ categories: ['operational'], perCategory: 2, groups: ['a', 'b'] });
  const [research, coding] = prepared.snapshot.records;
  research.domainTags = ['research'];
  research.observedAtEpochSeconds = NOW - 2 * DAY;
  research.incidentKey = 'shared_incident';
  research.correlationKey = 'shared_cluster';
  coding.domainTags = ['coding'];
  coding.observedAtEpochSeconds = NOW - DAY;
  coding.incidentKey = 'shared_incident';
  coding.correlationKey = 'shared_cluster';
  prepared.included = [{ evidenceId: research.evidenceId, allocatedMassMicroEu: '1000000', reasonCodes: [] }];
  prepared.deduplicated = [{ evidenceId: coding.evidenceId, canonicalEvidenceId: research.evidenceId, reasonCodes: ['DUPLICATE_EXCLUDED'] }];
  const domain = scoreDomainProfile(prepared, 'coding');
  assert.equal(domain.effectiveIndependentMassMicroEu, '999900');
  assert.equal(domain.ratingStatus, 'UNRATED');
  assert.equal(domain.categories.operational.events.length, 1);
  assert.equal(domain.categories.operational.events[0].evidenceId, coding.evidenceId);
});


test('zero-mass current records cannot satisfy age or freshness gates', () => {
  const prepared = preparedFixture({ massMicroEu: '1100000' });
  prepared.snapshot.records.forEach((record, index) => {
    record.observedAtEpochSeconds = NOW - (100 + index * 5) * DAY;
  });
  prepared.snapshot.records.push({
    evidenceId: 'current_zero', category: 'operational', direction: 'positive', severity: null,
    evidenceFamily: 'operational', empId: 'emp_operational', empVersion: '1',
    observedAtEpochSeconds: NOW, providerControlGroup: 'current_group', proofClass: 'P1',
    materiality: 'meaningful', incidentKey: 'current_zero', correlationKey: 'current_zero',
    status: 'ACTIVE', scoreEligible: true, finality: 'final', domainTags: ['coding'],
  });
  prepared.included.push({ evidenceId: 'current_zero', allocatedMassMicroEu: '0', reasonCodes: ['PROVIDER_CAP_APPLIED'] });
  const result = scorePreparedSnapshot(prepared);
  assert.equal(result.ratingStatus, 'PROVISIONAL');
  assert.ok(result.observationSpanDays >= 30);
  assert.ok(result.freshestEvidenceAgeDays >= 100);
  assert.ok(result.reasonCodes.includes('PROVISIONAL_FRESHNESS_GATE'));
});

test('P1 corroboration prevents a false P4-only confidence cap', () => {
  const prepared = preparedFixture({ proofClass: 'P4' });
  const corroborator = {
    ...prepared.snapshot.records[0], evidenceId: 'p1_corroborator',
    providerControlGroup: 'independent_p1', proofClass: 'P1',
  };
  prepared.snapshot.records.push(corroborator);
  prepared.deduplicated.push({ evidenceId: corroborator.evidenceId, canonicalEvidenceId: prepared.snapshot.records[0].evidenceId, reasonCodes: ['DUPLICATE_EXCLUDED'] });
  const result = scorePreparedSnapshot(prepared);
  assert.equal(result.confidence.p4Only, false);
  assert.ok(result.confidence.value > 25);
});

test('domain scoring does not freeze or mutate caller-owned prepared input', () => {
  const prepared = preparedFixture({ categories: ['operational', 'financial', 'onchain', 'identity'], perCategory: 2 });
  assert.equal(Object.isFrozen(prepared.snapshot.identity), false);
  const before = structuredClone(prepared);
  scoreDomainProfile(prepared, 'coding');
  assert.deepEqual(prepared, before);
  assert.equal(Object.isFrozen(prepared.snapshot.identity), false);
  prepared.snapshot.identity.assurance = 'registry-only';
  assert.equal(prepared.snapshot.identity.assurance, 'registry-only');
});
