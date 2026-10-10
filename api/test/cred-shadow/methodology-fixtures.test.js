'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fixtures = require('./fixtures/methodology-fixtures.json');
const { categoryPosterior, weightedOverallScore, weightedCoverage } = require('../../cred-shadow/category');
const { decayFactor } = require('../../cred-shadow/integer-math');

const SCALE = 1_000_000n;

test('methodology fixture file reproduces every pinned arithmetic output', () => {
  assert.equal(fixtures.category.length, 13);
  for (const row of fixtures.category) {
    assert.equal(
      categoryPosterior(BigInt(row.positiveMicroEu), BigInt(row.negativeMicroEu)).publicScore,
      row.expected,
      row.name,
    );
  }
  for (const row of fixtures.decay) {
    assert.equal(decayFactor(BigInt(row.ageDays), BigInt(row.halfLifeDays)), BigInt(row.expectedMicro));
  }
  const weighted = Object.fromEntries(
    Object.entries(fixtures.weighted.categories).map(([key, value]) => [key, BigInt(value) * SCALE]),
  );
  const missing = Object.fromEntries(
    Object.entries(fixtures.missing.categories).map(([key, value]) => [key, BigInt(value) * SCALE]),
  );
  assert.equal(weightedOverallScore(weighted), 65);
  assert.equal(weightedOverallScore(missing), 56);
  assert.equal(weightedCoverage(fixtures.missing.coverage), 30);
});
