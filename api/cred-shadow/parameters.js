'use strict';

const METHODOLOGY_ID = 'cred-methodology-candidate-0.1.0';
const SCALE = 1_000_000n;
const EU = 1_000_000n;
const INT64_MIN = -(2n ** 63n);
const INT64_MAX = (2n ** 63n) - 1n;
const MAX_RECORDS_PER_SNAPSHOT = 100_000;
const MAX_RAW_EVENT_MASS = 16n * EU;
const MAX_CATEGORY_AGGREGATE_MASS = 1_000_000n * EU;
const REFILL_PERIOD_SECONDS = 7_776_000n;

function deepFreeze(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

const CANDIDATE_PARAMETERS = deepFreeze({
  methodologyId: METHODOLOGY_ID,
  scale: SCALE,
  evidenceUnit: EU,
  categoryWeights: {
    operational: 30n,
    financial: 25n,
    onchain: 25n,
    identity: 20n,
  },
  priorMass: {
    positive: 4n * EU,
    negative: 4n * EU,
  },
  proofFactors: {
    P1: SCALE,
    P2: 800_000n,
    P3: 600_000n,
    P4: 250_000n,
  },
  materialityFactors: {
    micro: 250_000n,
    standard: 500_000n,
    meaningful: SCALE,
    substantial: 1_500_000n,
    major: 2_000_000n,
  },
  severityFactors: {
    minor: SCALE,
    material: 2_000_000n,
    severe: 4_000_000n,
    critical: 8_000_000n,
  },
  independenceFactors: {
    first: SCALE,
    second: 500_000n,
    third: 250_000n,
    fourthAndLater: 125_000n,
  },
  correlationClusterMassCap: 2n * EU,
  evidenceFamilyHalfLives: {
    operational: { positiveDays: 90n, negativeDays: 180n },
    financial: { positiveDays: 365n, negativeDays: 730n },
    onchain: { positiveDays: 365n, negativeDays: 730n },
    identity: { positiveDays: 365n, negativeDays: 730n },
    severeCriticalAdverseIncident: { positiveDays: null, negativeDays: 1_460n },
    comparativeModel: { positiveDays: 30n, negativeDays: 30n },
  },
  tokenBuckets: {
    providerControlGroup: {
      capacity: 4n * EU,
      refillAmount: 4n * EU,
      refillPeriodSeconds: REFILL_PERIOD_SECONDS,
    },
    schemaFamily: {
      capacity: 6n * EU,
      refillAmount: 6n * EU,
      refillPeriodSeconds: REFILL_PERIOD_SECONDS,
    },
    P4: {
      capacity: 1n * EU,
      refillAmount: 1n * EU,
      refillPeriodSeconds: REFILL_PERIOD_SECONDS,
    },
  },
  coverage: {
    fullCategoryMass: 4n * EU,
    maximum: 100n,
  },
  confidence: {
    sampleSupportPriorMass: 8n * EU,
    sourceDiversity: { zero: 0n, one: 25n, two: 50n, three: 70n, four: 85n, fiveOrMore: 100n },
    weakLinkBonus: 20n,
    hardCaps: {
      identityConflictOrAmbiguity: 20n,
      oneProviderControlGroup: 39n,
      P4Only: 25n,
    },
  },
  unratedGates: {
    minimumEligibleIndependentMass: 1n * EU,
  },
  ratingGates: {
    minimumTotalMass: 8n * EU,
    minimumQualifyingCategories: 2,
    minimumCategoryMass: 2n * EU,
    minimumIndependentControlGroups: 2,
    minimumObservationSpanDays: 30n,
    maximumQualifyingEventAgeDays: 90n,
    minimumCoverage: 50n,
    minimumConfidence: 40n,
  },
  advancedGates: {
    Prime: {
      minimumConfidence: 70n,
      minimumCoverage: 75n,
      minimumIndependentControlGroups: 3,
      minimumObservationSpanDays: 90n,
      disqualifyingActiveFlags: ['high', 'critical'],
    },
    Preferred: {
      minimumConfidence: 85n,
      minimumCoverage: 85n,
      minimumQualifyingCategories: 3,
      minimumIndependentControlGroups: 4,
      minimumObservationSpanDays: 180n,
      disqualifyingActiveFlags: ['material', 'high', 'critical'],
    },
  },
  tierBands: [
    { name: 'Junk', minimum: 0n, maximum: 25n },
    { name: 'Marginal', minimum: 26n, maximum: 50n },
    { name: 'Qualified', minimum: 51n, maximum: 75n },
    { name: 'Prime', minimum: 76n, maximum: 90n },
    { name: 'Preferred', minimum: 91n, maximum: 100n },
  ],
  bounds: {
    int64Minimum: INT64_MIN,
    int64Maximum: INT64_MAX,
    maximumRecordsPerSnapshot: MAX_RECORDS_PER_SNAPSHOT,
    maximumRawEventMass: MAX_RAW_EVENT_MASS,
    maximumCategoryAggregateMass: MAX_CATEGORY_AGGREGATE_MASS,
  },
});

module.exports = Object.freeze({
  METHODOLOGY_ID,
  SCALE,
  EU,
  INT64_MIN,
  INT64_MAX,
  MAX_RECORDS_PER_SNAPSHOT,
  MAX_RAW_EVENT_MASS,
  MAX_CATEGORY_AGGREGATE_MASS,
  REFILL_PERIOD_SECONDS,
  CANDIDATE_PARAMETERS,
});
