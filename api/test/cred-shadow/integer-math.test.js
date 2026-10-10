'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  INT64_MIN,
  INT64_MAX,
  MAX_CATEGORY_AGGREGATE_MASS,
  roundDiv,
  gcd,
  mulDivRound,
  decayFactor,
  integerNthRoot,
  assertRecordCount,
  assertRawEventMass,
  addAggregateMass,
} = require('../../cred-shadow/integer-math');
const {
  CANDIDATE_PARAMETERS,
  METHODOLOGY_ID,
  SCALE,
  EU,
} = require('../../cred-shadow/parameters');

test('roundDiv rounds halves away from zero', () => {
  assert.equal(roundDiv(1n, 2n), 1n);
  assert.equal(roundDiv(-1n, 2n), -1n);
  assert.equal(roundDiv(3n, 2n), 2n);
  assert.equal(roundDiv(-3n, 2n), -2n);
  assert.equal(roundDiv(1n, 3n), 0n);
  assert.equal(roundDiv(-1n, 3n), 0n);
});

test('roundDiv handles INT64_MIN and near-limit rounding without overflow', () => {
  assert.equal(roundDiv(INT64_MIN, 1n), INT64_MIN);
  assert.equal(roundDiv(INT64_MIN, 3n), -3_074_457_345_618_258_603n);
  assert.equal(roundDiv(INT64_MIN, INT64_MAX), -1n);
  assert.equal(roundDiv(INT64_MAX, 2n), 4_611_686_018_427_387_904n);
  assert.equal(roundDiv(INT64_MAX, INT64_MAX), 1n);
  assert.equal(roundDiv(INT64_MAX - 1n, INT64_MAX), 1n);
  assert.throws(() => roundDiv(INT64_MAX, 0n), /denominator/i);
  assert.throws(() => roundDiv(0n, -1n), /denominator/i);
  assert.throws(() => roundDiv(INT64_MAX + 1n, 1n), /int64/i);
});

test('gcd accepts signed int64 inputs', () => {
  assert.equal(gcd(54n, -24n), 6n);
  assert.equal(gcd(0n, 0n), 0n);
  assert.throws(() => gcd(INT64_MIN, 0n), /int64/i);
});

test('mulDivRound handles ordinary and GCD-reducible multiplication', () => {
  assert.equal(mulDivRound(1_000_000n, 750_000n, 1_000_000n), 750_000n);
  assert.equal(mulDivRound(INT64_MAX, 2n, 2n), INT64_MAX);
  assert.equal(mulDivRound(INT64_MIN, 2n, 2n), INT64_MIN);
});

test('mulDivRound handles coprime wide products when the quotient fits', () => {
  const left = 3_037_000_499n;
  const right = 3_037_000_501n;
  const denominator = 3_037_000_503n;
  assert.equal(gcd(left, denominator), 1n);
  assert.equal(gcd(right, denominator), 1n);
  assert.ok(left > INT64_MAX / right);
  assert.equal(mulDivRound(left, right, denominator), 3_037_000_497n);
  assert.equal(mulDivRound(-left, right, denominator), -3_037_000_497n);
});

test('mulDivRound rejects true quotient overflow and invalid denominators', () => {
  assert.throws(() => mulDivRound(INT64_MAX, 2n, 1n), /int64/i);
  assert.throws(() => mulDivRound(INT64_MIN, -1n, 1n), /int64/i);
  assert.throws(() => mulDivRound(1n, 1n, 0n), /denominator/i);
  assert.throws(() => mulDivRound(1n, 1n, -1n), /denominator/i);
});

test('decayFactor follows the candidate rational half-life curve', () => {
  assert.equal(decayFactor(0n, 90n), 1_000_000n);
  assert.equal(decayFactor(30n, 90n), 750_000n);
  assert.equal(decayFactor(90n, 90n), 500_000n);
  assert.equal(decayFactor(180n, 90n), 333_333n);
  assert.equal(decayFactor(270n, 90n), 250_000n);
  assert.throws(() => decayFactor(-1n, 90n), /decay/i);
  assert.throws(() => decayFactor(1n, 0n), /decay/i);
  assert.throws(() => decayFactor(1n, -1n), /decay/i);
  assert.throws(() => decayFactor(INT64_MAX, 1n), /int64/i);
});

test('integerNthRoot returns exact and floor roots with explicit bounds', () => {
  assert.equal(integerNthRoot(32n ** 5n, 5), 32n);
  assert.equal(integerNthRoot((32n ** 5n) - 1n, 5), 31n);
  assert.equal(integerNthRoot(INT64_MAX, 5), 6_208n);
  assert.throws(() => integerNthRoot(-1n, 5), /root/i);
  assert.throws(() => integerNthRoot(INT64_MAX + 1n, 5), /int64/i);
  assert.throws(() => integerNthRoot(1n, 0), /root/i);
  assert.throws(() => integerNthRoot(1n, 1.5), /root/i);
});

test('record, raw-event, and aggregate bounds are enforced', () => {
  assert.equal(assertRecordCount(100_000), 100_000);
  assert.throws(() => assertRecordCount(100_001), /record/i);
  assert.equal(assertRawEventMass(16n * EU), 16n * EU);
  assert.throws(() => assertRawEventMass((16n * EU) + 1n), /event/i);
  assert.equal(addAggregateMass(MAX_CATEGORY_AGGREGATE_MASS - 1n, 1n), MAX_CATEGORY_AGGREGATE_MASS);
  assert.throws(() => addAggregateMass(MAX_CATEGORY_AGGREGATE_MASS, 1n), /aggregate/i);
});

test('candidate parameters contain the approved methodology constants', () => {
  const p = CANDIDATE_PARAMETERS;
  assert.equal(METHODOLOGY_ID, 'cred-methodology-candidate-0.1.0');
  assert.equal(p.methodologyId, METHODOLOGY_ID);
  assert.equal(SCALE, 1_000_000n);
  assert.equal(EU, 1_000_000n);
  assert.deepEqual(p.categoryWeights, { operational: 30n, financial: 25n, onchain: 25n, identity: 20n });
  assert.deepEqual(p.priorMass, { positive: 4n * EU, negative: 4n * EU });
  assert.deepEqual(p.proofFactors, { P1: SCALE, P2: 800_000n, P3: 600_000n, P4: 250_000n });
  assert.deepEqual(p.materialityFactors, { micro: 250_000n, standard: 500_000n, meaningful: SCALE, substantial: 1_500_000n, major: 2_000_000n });
  assert.deepEqual(p.severityFactors, { minor: SCALE, material: 2_000_000n, severe: 4_000_000n, critical: 8_000_000n });
  assert.deepEqual(p.independenceFactors, { first: SCALE, second: 500_000n, third: 250_000n, fourthAndLater: 125_000n });
  assert.equal(p.evidenceFamilyHalfLives.severeCriticalAdverseIncident.positiveDays, null);
  assert.deepEqual(p.evidenceFamilyHalfLives.severeCriticalAdverseIncident, { positiveDays: null, negativeDays: 1_460n });
  assert.deepEqual(p.tokenBuckets.providerControlGroup, { capacity: 4n * EU, refillAmount: 4n * EU, refillPeriodSeconds: 7_776_000n });
  assert.deepEqual(p.tokenBuckets.schemaFamily, { capacity: 6n * EU, refillAmount: 6n * EU, refillPeriodSeconds: 7_776_000n });
  assert.deepEqual(p.tokenBuckets.P4, { capacity: 1n * EU, refillAmount: 1n * EU, refillPeriodSeconds: 7_776_000n });
  assert.equal(p.coverage.fullCategoryMass, 4n * EU);
  assert.equal(p.confidence.sampleSupportPriorMass, 8n * EU);
  assert.equal(p.ratingGates.minimumTotalMass, 8n * EU);
  assert.equal(p.ratingGates.minimumCategoryMass, 2n * EU);
  assert.equal(p.ratingGates.minimumCoverage, 50n);
  assert.equal(p.ratingGates.minimumConfidence, 40n);
  assert.equal(p.advancedGates.Prime.minimumConfidence, 70n);
  assert.equal(p.advancedGates.Preferred.minimumConfidence, 85n);
  assert.deepEqual(p.tierBands, [
    { name: 'Junk', minimum: 0n, maximum: 25n },
    { name: 'Marginal', minimum: 26n, maximum: 50n },
    { name: 'Qualified', minimum: 51n, maximum: 75n },
    { name: 'Prime', minimum: 76n, maximum: 90n },
    { name: 'Preferred', minimum: 91n, maximum: 100n },
  ]);
  assert.equal(p.bounds.int64Minimum, INT64_MIN);
  assert.equal(p.bounds.int64Maximum, INT64_MAX);
  assert.equal(p.bounds.maximumRecordsPerSnapshot, 100_000);
  assert.equal(p.bounds.maximumRawEventMass, 16n * EU);
  assert.equal(p.bounds.maximumCategoryAggregateMass, 1_000_000n * EU);
});

test('candidate parameters are deeply immutable', () => {
  assert.ok(Object.isFrozen(CANDIDATE_PARAMETERS));
  assert.ok(Object.isFrozen(CANDIDATE_PARAMETERS.proofFactors));
  assert.ok(Object.isFrozen(CANDIDATE_PARAMETERS.evidenceFamilyHalfLives.operational));
  assert.ok(Object.isFrozen(CANDIDATE_PARAMETERS.tierBands));
  assert.ok(Object.isFrozen(CANDIDATE_PARAMETERS.tierBands[0]));
  assert.throws(() => { CANDIDATE_PARAMETERS.proofFactors.P1 = 0n; }, TypeError);
  assert.throws(() => { CANDIDATE_PARAMETERS.tierBands[0].minimum = 99n; }, TypeError);
  assert.equal(CANDIDATE_PARAMETERS.proofFactors.P1, SCALE);
  assert.equal(CANDIDATE_PARAMETERS.tierBands[0].minimum, 0n);
});
