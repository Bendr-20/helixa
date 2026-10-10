'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fixtures = require('./fixtures/methodology-fixtures.json');
const {
  categoryPosterior,
  effectiveEventMass,
  scorePreparedCategory,
  weightedOverallScore,
  weightedCoverage,
} = require('../../cred-shadow/category');

const EU = 1_000_000n;

test('matches every normative category posterior fixture', () => {
  for (const fixture of fixtures.category) {
    const result = categoryPosterior(BigInt(fixture.positiveMicroEu), BigInt(fixture.negativeMicroEu));
    assert.equal(result.publicScore, fixture.expected, fixture.name);
  }
});

test('keeps the neutral prior internal when no eligible evidence exists', () => {
  const result = categoryPosterior(0n, 0n);
  assert.equal(result.positivePosteriorMassMicroEu, '4000000');
  assert.equal(result.negativePosteriorMassMicroEu, '4000000');
  assert.equal(result.scoreMicro, '50000000');
  assert.equal(result.publicScore, 50);
});

test('applies severity before rational decay and reports independent mass before severity', () => {
  const positive = effectiveEventMass({
    allocatedMassMicroEu: '1000000', direction: 'positive', severity: null,
    ageDays: 90n, halfLifeDays: 90n,
  });
  assert.equal(positive.effectiveScoreMassMicroEu, '500000');
  assert.equal(positive.effectiveIndependentMassMicroEu, '500000');

  const critical = effectiveEventMass({
    allocatedMassMicroEu: '1000000', direction: 'negative', severity: 'critical',
    ageDays: 90n, halfLifeDays: 90n,
  });
  assert.equal(critical.effectiveScoreMassMicroEu, '4000000');
  assert.equal(critical.effectiveIndependentMassMicroEu, '500000');
});

test('scores a prepared category with age, reasons, and exact masses', () => {
  const prepared = {
    snapshot: {
      computedAtEpochSeconds: Date.parse('2026-10-10T00:00:00.000Z') / 1000,
      records: [
        { evidenceId: 'positive', category: 'operational', direction: 'positive', severity: null, evidenceFamily: 'operational', empId: 'emp', empVersion: '1', observedAtEpochSeconds: Date.parse('2026-07-12T00:00:00.000Z') / 1000 },
        { evidenceId: 'negative', category: 'operational', direction: 'negative', severity: 'material', evidenceFamily: 'operational', empId: 'emp', empVersion: '1', observedAtEpochSeconds: Date.parse('2026-10-10T00:00:00.000Z') / 1000 },
      ],
      empPolicies: [{ empId: 'emp', empVersion: '1', evidenceFamily: 'operational', positiveHalfLifeDays: 90, negativeHalfLifeDays: 180 }],
    },
    included: [
      { evidenceId: 'positive', allocatedMassMicroEu: '1000000', reasonCodes: [] },
      { evidenceId: 'negative', allocatedMassMicroEu: '1000000', reasonCodes: [] },
    ],
    excluded: [], deduplicated: [],
  };
  const result = scorePreparedCategory(prepared, 'operational');
  assert.equal(result.effectivePositiveMassMicroEu, '500000');
  assert.equal(result.effectiveNegativeMassMicroEu, '2000000');
  assert.equal(result.effectiveIndependentMassMicroEu, '1500000');
  assert.equal(result.publicScore, 43);
  assert.deepEqual(result.reasonCodes, ['STALE_EVIDENCE_DECAYED']);
  assert.equal(result.events[0].decayFactorMicro, '500000');
});

test('matches weighted score and missing-category coverage fixtures without redistribution', () => {
  const scores = Object.fromEntries(Object.entries(fixtures.weighted.categories).map(([key, value]) => [key, BigInt(value) * EU]));
  assert.equal(weightedOverallScore(scores), fixtures.weighted.expected);

  const missingScores = Object.fromEntries(Object.entries(fixtures.missing.categories).map(([key, value]) => [key, BigInt(value) * EU]));
  assert.equal(weightedOverallScore(missingScores), fixtures.missing.expectedScore);
  assert.equal(weightedCoverage(fixtures.missing.coverage), fixtures.missing.expectedCoverage);
});

test('rejects negative masses, unknown categories, future events, and int64 overflow', () => {
  assert.throws(() => categoryPosterior(-1n, 0n), /mass/i);
  assert.throws(() => categoryPosterior(1_000_000_000_001n, 0n), /bound/i);
  assert.throws(() => effectiveEventMass({ allocatedMassMicroEu: '1', direction: 'positive', severity: null, ageDays: -1n, halfLifeDays: 90n }), /age/i);
  assert.throws(() => scorePreparedCategory({ snapshot: { records: [], empPolicies: [], computedAtEpochSeconds: 0 }, included: [] }, 'social'), /category/i);
});
