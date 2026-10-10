'use strict';

const { CANDIDATE_PARAMETERS, EU } = require('./parameters');
const { integerNthRoot, mulDivRound, roundDiv } = require('./integer-math');
const { weightedCoverage } = require('./category');

const CATEGORIES = ['operational', 'financial', 'onchain', 'identity'];

function sourceDiversityScore(count) {
  if (!Number.isSafeInteger(count) || count < 0) throw new RangeError('source count must be a nonnegative integer');
  if (count === 0) return 0;
  if (count === 1) return 25;
  if (count === 2) return 50;
  if (count === 3) return 70;
  if (count === 4) return 85;
  return 100;
}

function identityAssuranceScore(assurance) {
  const values = {
    'current-control-bindings': 100,
    'current-control-partial': 80,
    'registry-only': 60,
    none: 0,
  };
  if (!Object.hasOwn(values, assurance)) throw new TypeError('identity assurance is invalid');
  return values[assurance];
}

function computeCoverage(categoryResults) {
  const category = {};
  for (const name of CATEGORIES) {
    const result = categoryResults[name];
    if (!result || typeof result.effectiveIndependentMassMicroEu !== 'string') {
      throw new TypeError('missing category result ' + name);
    }
    const mass = BigInt(result.effectiveIndependentMassMicroEu);
    const coverage = mulDivRound(100n, mass, CANDIDATE_PARAMETERS.coverage.fullCategoryMass);
    category[name] = Number(coverage > 100n ? 100n : coverage);
  }
  return Object.freeze({ category: Object.freeze(category), overall: weightedCoverage(category) });
}

function contradictionMass(snapshot) {
  let total = 0n;
  for (const item of snapshot.contradictions || []) {
    if (item.status === 'unresolved') total += BigInt(item.massMicroEu);
  }
  return total;
}

function recordMaps(prepared) {
  const records = new Map();
  for (const record of prepared.snapshot.records) records.set(record.evidenceId, record);
  return records;
}

function independentControlGroups(prepared, { excludeP4 = false } = {}) {
  const records = recordMaps(prepared);
  const groups = new Set();
  for (const item of [...prepared.included, ...(prepared.deduplicated || [])]) {
    const record = records.get(item.evidenceId);
    if (!record || (excludeP4 && record.proofClass === 'P4')) continue;
    groups.add(record.providerControlGroup);
  }
  return groups;
}

function confidenceInputs(prepared, categoryResults) {
  let totalMass = 0n;
  let weightedDecay = 0n;
  for (const category of CATEGORIES) {
    const result = categoryResults[category];
    totalMass += BigInt(result.effectiveIndependentMassMicroEu);
    for (const event of result.events || []) {
      const mass = BigInt(event.effectiveIndependentMassMicroEu);
      weightedDecay += mass * BigInt(event.decayFactorMicro);
    }
  }
  const groups = independentControlGroups(prepared);
  const records = recordMaps(prepared);
  const scoringRecords = [...prepared.included, ...(prepared.deduplicated || [])]
    .map((item) => records.get(item.evidenceId))
    .filter(Boolean);
  const p4Only = scoringRecords.length > 0 && scoringRecords.every((record) => record.proofClass === 'P4');
  return { totalMass, weightedDecay, groups, p4Only };
}

function computeConfidence(prepared, categoryResults) {
  const { totalMass, weightedDecay, groups, p4Only } = confidenceInputs(prepared, categoryResults);
  const sampleSupport = Number(mulDivRound(100n, totalMass, totalMass + CANDIDATE_PARAMETERS.confidence.sampleSupportPriorMass));
  const sourceDiversity = sourceDiversityScore(groups.size);
  const recency = totalMass === 0n ? 0 : Number(roundDiv(weightedDecay, totalMass * 10_000n));
  const contradictory = contradictionMass(prepared.snapshot);
  const contradictionDenominator = totalMass > EU ? totalMass : EU;
  const contradictionPenalty = Number(mulDivRound(100n, contradictory, contradictionDenominator));
  const consistency = Math.max(0, 100 - contradictionPenalty);
  const identityAssurance = prepared.snapshot.identity.resolution === 'resolved'
    ? identityAssuranceScore(prepared.snapshot.identity.assurance)
    : 0;
  const dimensions = { sampleSupport, sourceDiversity, recency, consistency, identityAssurance };
  const product = Object.values(dimensions).reduce((value, dimension) => value * BigInt(dimension), 1n);
  const geometric = Number(integerNthRoot(product, 5));
  const weakest = Math.min(...Object.values(dimensions));
  let value = Math.min(geometric, weakest + Number(CANDIDATE_PARAMETERS.confidence.weakLinkBonus));
  const identityBlocked = prepared.snapshot.identity.resolution !== 'resolved';
  if (identityBlocked) value = Math.min(value, Number(CANDIDATE_PARAMETERS.confidence.hardCaps.identityConflictOrAmbiguity));
  if (groups.size === 1) value = Math.min(value, Number(CANDIDATE_PARAMETERS.confidence.hardCaps.oneProviderControlGroup));
  if (p4Only) value = Math.min(value, Number(CANDIDATE_PARAMETERS.confidence.hardCaps.P4Only));
  return Object.freeze({
    value,
    dimensions: Object.freeze(dimensions),
    totalEffectiveIndependentMassMicroEu: totalMass.toString(),
    independentControlGroups: groups.size,
    nonP4IndependentControlGroups: independentControlGroups(prepared, { excludeP4: true }).size,
    p4Only,
    contradictoryMassMicroEu: contradictory.toString(),
  });
}

module.exports = Object.freeze({
  sourceDiversityScore,
  identityAssuranceScore,
  computeCoverage,
  computeConfidence,
  independentControlGroups,
});
