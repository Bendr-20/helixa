'use strict';

const {
  CANDIDATE_PARAMETERS,
  SCALE,
  EU,
  INT64_MAX,
  MAX_CATEGORY_AGGREGATE_MASS,
} = require('./parameters');
const {
  assertInt64,
  assertRawEventMass,
  decayFactor,
  mulDivRound,
  roundDiv,
} = require('./integer-math');
const { prepareEvidence } = require('./evidence');

const DAY_SECONDS = 86_400;
const CATEGORIES = ['operational', 'financial', 'onchain', 'identity'];
const CATEGORY_SET = new Set(CATEGORIES);

function assertAggregateMass(value, label) {
  assertInt64(value, label);
  if (value < 0n || value > MAX_CATEGORY_AGGREGATE_MASS) {
    throw new RangeError(label + ' exceeds category aggregate mass bound');
  }
  return value;
}

function categoryPosterior(positiveMass, negativeMass) {
  assertAggregateMass(positiveMass, 'positive mass');
  assertAggregateMass(negativeMass, 'negative mass');
  const positivePosterior = CANDIDATE_PARAMETERS.priorMass.positive + positiveMass;
  const negativePosterior = CANDIDATE_PARAMETERS.priorMass.negative + negativeMass;
  const denominator = positivePosterior + negativePosterior;
  if (denominator > INT64_MAX) throw new RangeError('posterior denominator is outside int64 range');
  const scoreMicro = mulDivRound(100n * SCALE, positivePosterior, denominator);
  return Object.freeze({
    positivePosteriorMassMicroEu: positivePosterior.toString(),
    negativePosteriorMassMicroEu: negativePosterior.toString(),
    scoreMicro: scoreMicro.toString(),
    publicScore: Number(roundDiv(scoreMicro, SCALE)),
  });
}

function effectiveEventMass({ allocatedMassMicroEu, direction, severity, ageDays, halfLifeDays }) {
  if (typeof allocatedMassMicroEu !== 'string' || !/^(0|[1-9]\d*)$/u.test(allocatedMassMicroEu)) {
    throw new TypeError('allocated mass must be a canonical nonnegative integer string');
  }
  const allocated = assertRawEventMass(BigInt(allocatedMassMicroEu));
  assertInt64(ageDays, 'ageDays');
  assertInt64(halfLifeDays, 'halfLifeDays');
  if (ageDays < 0n) throw new RangeError('ageDays must be nonnegative');
  if (halfLifeDays <= 0n) throw new RangeError('halfLifeDays must be positive');
  if (direction !== 'positive' && direction !== 'negative') throw new TypeError('direction is invalid');
  if (direction === 'positive' && severity !== null) throw new TypeError('positive evidence cannot have severity');
  const decay = decayFactor(ageDays, halfLifeDays);
  const independent = mulDivRound(allocated, decay, SCALE);
  let scoreMass = allocated;
  if (direction === 'negative') {
    const severityFactor = CANDIDATE_PARAMETERS.severityFactors[severity];
    if (severityFactor === undefined) throw new TypeError('negative severity is invalid');
    scoreMass = mulDivRound(scoreMass, severityFactor, SCALE);
  }
  scoreMass = mulDivRound(scoreMass, decay, SCALE);
  return Object.freeze({
    decayFactorMicro: decay.toString(),
    effectiveScoreMassMicroEu: scoreMass.toString(),
    effectiveIndependentMassMicroEu: independent.toString(),
  });
}

function scorePreparedCategory(prepared, category) {
  if (!CATEGORY_SET.has(category)) throw new TypeError('category is invalid');
  if (!prepared || !prepared.snapshot || !Array.isArray(prepared.included)) {
    throw new TypeError('prepared evidence is invalid');
  }
  const records = new Map(prepared.snapshot.records.map((record) => [record.evidenceId, record]));
  const policies = new Map(prepared.snapshot.empPolicies.map((policy) => [policy.empId + '\0' + policy.empVersion, policy]));
  let positive = 0n;
  let negative = 0n;
  let independent = 0n;
  const events = [];
  const reasons = new Set();
  for (const allocation of prepared.included) {
    const record = records.get(allocation.evidenceId);
    if (!record || record.category !== category) continue;
    const policy = policies.get(record.empId + '\0' + record.empVersion);
    if (!policy) throw new Error('included evidence has no EMP policy');
    const halfLife = record.direction === 'positive' ? policy.positiveHalfLifeDays : policy.negativeHalfLifeDays;
    if (halfLife === null) throw new Error('included evidence has no applicable half-life');
    const elapsed = prepared.snapshot.computedAtEpochSeconds - record.observedAtEpochSeconds;
    if (!Number.isSafeInteger(elapsed) || elapsed < 0) throw new RangeError('event age is invalid');
    const ageDays = BigInt(Math.floor(elapsed / DAY_SECONDS));
    const mass = effectiveEventMass({
      allocatedMassMicroEu: allocation.allocatedMassMicroEu,
      direction: record.direction,
      severity: record.severity,
      ageDays,
      halfLifeDays: BigInt(halfLife),
    });
    const scoreMass = BigInt(mass.effectiveScoreMassMicroEu);
    const independentMass = BigInt(mass.effectiveIndependentMassMicroEu);
    if (record.direction === 'positive') positive += scoreMass;
    else negative += scoreMass;
    independent += independentMass;
    assertAggregateMass(positive, 'effective positive mass');
    assertAggregateMass(negative, 'effective negative mass');
    assertAggregateMass(independent, 'effective independent mass');
    for (const code of allocation.reasonCodes || []) reasons.add(code);
    if (ageDays > 0n && BigInt(mass.decayFactorMicro) < SCALE) reasons.add('STALE_EVIDENCE_DECAYED');
    events.push(Object.freeze({
      evidenceId: record.evidenceId,
      direction: record.direction,
      ageDays: ageDays.toString(),
      halfLifeDays: String(halfLife),
      allocatedMassMicroEu: allocation.allocatedMassMicroEu,
      ...mass,
    }));
  }
  const posterior = categoryPosterior(positive, negative);
  return Object.freeze({
    category,
    effectivePositiveMassMicroEu: positive.toString(),
    effectiveNegativeMassMicroEu: negative.toString(),
    effectiveIndependentMassMicroEu: independent.toString(),
    ...posterior,
    reasonCodes: Object.freeze([...reasons].sort()),
    events: Object.freeze(events),
  });
}

function scoreCategory(snapshot, category) {
  return scorePreparedCategory(prepareEvidence(snapshot), category);
}

function weightedOverallScore(categoryScoresMicro) {
  let weighted = 0n;
  for (const category of CATEGORIES) {
    if (!Object.hasOwn(categoryScoresMicro, category)) throw new TypeError('missing category score ' + category);
    const score = assertInt64(categoryScoresMicro[category], category + ' score');
    if (score < 0n || score > 100n * SCALE) throw new RangeError(category + ' score is outside 0-100');
    weighted += score * CANDIDATE_PARAMETERS.categoryWeights[category];
  }
  return Number(roundDiv(weighted, 100n * SCALE));
}

function weightedCoverage(categoryCoverage) {
  let weighted = 0n;
  for (const category of CATEGORIES) {
    const coverage = categoryCoverage[category];
    if (!Number.isInteger(coverage) || coverage < 0 || coverage > 100) {
      throw new RangeError(category + ' coverage is outside 0-100');
    }
    weighted += BigInt(coverage) * CANDIDATE_PARAMETERS.categoryWeights[category];
  }
  return Number(roundDiv(weighted, 100n));
}

module.exports = Object.freeze({
  CATEGORIES: Object.freeze([...CATEGORIES]),
  categoryPosterior,
  effectiveEventMass,
  scorePreparedCategory,
  scoreCategory,
  weightedOverallScore,
  weightedCoverage,
});
