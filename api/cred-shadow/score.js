'use strict';

const { CANDIDATE_PARAMETERS, EU } = require('./parameters');
const { APPROVED_DOMAIN_TAGS, prepareEvidence, prepareDomainEvidence } = require('./evidence');
const {
  CATEGORIES,
  scorePreparedCategory,
  weightedOverallScore,
} = require('./category');
const {
  computeCoverage,
  computeConfidence,
} = require('./confidence');

const DAY_SECONDS = 86_400;
const TIER_RANK = Object.freeze({ Junk: 0, Marginal: 1, Qualified: 2, Prime: 3, Preferred: 4 });
const RANK_TIER = Object.freeze(['Junk', 'Marginal', 'Qualified', 'Prime', 'Preferred']);

function immutableClone(value) {
  const clone = structuredClone(value);
  const freeze = (item) => {
    if (item === null || typeof item !== 'object' || Object.isFrozen(item)) return item;
    for (const child of Object.values(item)) freeze(child);
    return Object.freeze(item);
  };
  return freeze(clone);
}

function tierForScore(score) {
  if (!Number.isInteger(score) || score < 0 || score > 100) throw new RangeError('score is outside 0-100');
  if (score <= 25) return 'Junk';
  if (score <= 50) return 'Marginal';
  if (score <= 75) return 'Qualified';
  if (score <= 90) return 'Prime';
  return 'Preferred';
}

function capTier(tier, ceiling) {
  return RANK_TIER[Math.min(TIER_RANK[tier], TIER_RANK[ceiling])];
}

function scoreCategories(prepared) {
  const categories = {};
  for (const category of CATEGORIES) categories[category] = scorePreparedCategory(prepared, category);
  return Object.freeze(categories);
}

function evidenceStats(prepared, categoryResults) {
  const recordById = new Map(prepared.snapshot.records.map((record) => [record.evidenceId, record]));
  const positiveMassIds = new Set();
  for (const category of CATEGORIES) {
    for (const event of categoryResults[category].events || []) {
      if (BigInt(event.effectiveIndependentMassMicroEu) > 0n) positiveMassIds.add(event.evidenceId);
    }
  }
  const scoringRecords = prepared.included
    .filter((item) => positiveMassIds.has(item.evidenceId))
    .map((item) => recordById.get(item.evidenceId))
    .filter(Boolean);
  const observed = scoringRecords.map((record) => record.observedAtEpochSeconds);
  const observationSpanDays = observed.length < 2 ? 0 : Math.floor((Math.max(...observed) - Math.min(...observed)) / DAY_SECONDS);
  const freshestAgeDays = observed.length === 0 ? null : Math.floor((prepared.snapshot.computedAtEpochSeconds - Math.max(...observed)) / DAY_SECONDS);
  const categoryMass = {};
  let totalMass = 0n;
  for (const category of CATEGORIES) {
    const mass = BigInt(categoryResults[category].effectiveIndependentMassMicroEu);
    categoryMass[category] = mass;
    totalMass += mass;
  }
  return {
    recordById,
    scoringRecords,
    observationSpanDays,
    freshestAgeDays,
    categoryMass,
    totalMass,
    qualifyingCategories: Object.values(categoryMass).filter((mass) => mass >= CANDIDATE_PARAMETERS.ratingGates.minimumCategoryMass).length,
  };
}

function riskState(snapshot) {
  const flags = new Set();
  const reasons = new Set();
  const levels = new Set();
  let privilegeCeiling = null;
  let identityCompromised = Boolean(snapshot.identity.compromised);
  let regulatedEligibility = true;
  if (identityCompromised) {
    flags.add('IDENTITY_COMPROMISED');
    reasons.add('IDENTITY_COMPROMISED');
  }
  for (const risk of snapshot.risks || []) {
    if (risk.status === 'remediated') {
      reasons.add('REMEDIATION_VERIFIED');
      continue;
    }
    if (risk.status !== 'active') continue;
    const level = risk.severity === 'severe' ? 'high' : risk.severity;
    levels.add(level);
    if (risk.type === 'active-exploit') {
      flags.add('ACTIVE_EXPLOIT');
      reasons.add('ACTIVE_EXPLOIT');
      privilegeCeiling = 'Junk';
    } else if (risk.type === 'default') {
      flags.add('VERIFIED_DEFAULT_UNCURED');
      reasons.add('VERIFIED_DEFAULT_UNCURED');
      if (privilegeCeiling === null || TIER_RANK[privilegeCeiling] > TIER_RANK.Marginal) privilegeCeiling = 'Marginal';
    } else if (risk.type === 'identity-compromise') {
      flags.add('IDENTITY_COMPROMISED');
      reasons.add('IDENTITY_COMPROMISED');
      identityCompromised = true;
    } else if (risk.type === 'compliance-restriction') {
      flags.add('COMPLIANCE_RESTRICTED');
      reasons.add('COMPLIANCE_RESTRICTED');
      regulatedEligibility = false;
    } else if (risk.type === 'pending-allegation') {
      flags.add('PENDING_HIGH_IMPACT_REVIEW');
      reasons.add('PENDING_HIGH_IMPACT_REVIEW');
    }
  }
  return {
    flags,
    reasons,
    policyRiskLevels: levels,
    privilegeCeiling,
    identityCompromised,
    regulatedEligibility,
  };
}

function gateReasons(prepared, confidence, coverage, stats) {
  const reasons = new Set();
  const identity = prepared.snapshot.identity;
  if (identity.resolution === 'ambiguous') reasons.add('IDENTITY_AMBIGUOUS');
  if (identity.resolution === 'conflict') reasons.add('IDENTITY_CONFLICT');
  if (identity.resolution !== 'resolved') reasons.add('PROVISIONAL_IDENTITY_GATE');
  if (stats.totalMass < CANDIDATE_PARAMETERS.ratingGates.minimumTotalMass) reasons.add('PROVISIONAL_VOLUME_GATE');
  if (stats.qualifyingCategories < CANDIDATE_PARAMETERS.ratingGates.minimumQualifyingCategories) reasons.add('PROVISIONAL_CATEGORY_GATE');
  if (confidence.nonP4IndependentControlGroups < CANDIDATE_PARAMETERS.ratingGates.minimumIndependentControlGroups) reasons.add('PROVISIONAL_DIVERSITY_GATE');
  if (stats.observationSpanDays < Number(CANDIDATE_PARAMETERS.ratingGates.minimumObservationSpanDays)) reasons.add('PROVISIONAL_AGE_GATE');
  if (stats.freshestAgeDays === null || stats.freshestAgeDays > Number(CANDIDATE_PARAMETERS.ratingGates.maximumQualifyingEventAgeDays)) reasons.add('PROVISIONAL_FRESHNESS_GATE');
  if (coverage.overall < Number(CANDIDATE_PARAMETERS.ratingGates.minimumCoverage)) reasons.add('PROVISIONAL_COVERAGE_GATE');
  if (confidence.value < Number(CANDIDATE_PARAMETERS.ratingGates.minimumConfidence)) reasons.add('PROVISIONAL_CONFIDENCE_GATE');
  if (stats.totalMass < CANDIDATE_PARAMETERS.unratedGates.minimumEligibleIndependentMass) reasons.add('UNRATED_INSUFFICIENT_EVIDENCE');
  return reasons;
}

function ratingStatus(prepared, stats, reasons, risks) {
  if (risks.identityCompromised) return 'SUSPENDED';
  if (prepared.snapshot.identity.resolution !== 'resolved' || stats.totalMass < CANDIDATE_PARAMETERS.unratedGates.minimumEligibleIndependentMass) return 'UNRATED';
  return reasons.size === 0 ? 'RATED' : 'PROVISIONAL';
}

function advancedEligibility(scoreTier, confidence, coverage, stats, risks) {
  const activeLevels = risks.policyRiskLevels;
  const prime = TIER_RANK[scoreTier] >= TIER_RANK.Prime &&
    confidence.value >= Number(CANDIDATE_PARAMETERS.advancedGates.Prime.minimumConfidence) &&
    coverage.overall >= Number(CANDIDATE_PARAMETERS.advancedGates.Prime.minimumCoverage) &&
    confidence.nonP4IndependentControlGroups >= CANDIDATE_PARAMETERS.advancedGates.Prime.minimumIndependentControlGroups &&
    stats.observationSpanDays >= Number(CANDIDATE_PARAMETERS.advancedGates.Prime.minimumObservationSpanDays) &&
    ![...activeLevels].some((level) => CANDIDATE_PARAMETERS.advancedGates.Prime.disqualifyingActiveFlags.includes(level));
  const preferred = scoreTier === 'Preferred' &&
    confidence.value >= Number(CANDIDATE_PARAMETERS.advancedGates.Preferred.minimumConfidence) &&
    coverage.overall >= Number(CANDIDATE_PARAMETERS.advancedGates.Preferred.minimumCoverage) &&
    stats.qualifyingCategories >= CANDIDATE_PARAMETERS.advancedGates.Preferred.minimumQualifyingCategories &&
    confidence.nonP4IndependentControlGroups >= CANDIDATE_PARAMETERS.advancedGates.Preferred.minimumIndependentControlGroups &&
    stats.observationSpanDays >= Number(CANDIDATE_PARAMETERS.advancedGates.Preferred.minimumObservationSpanDays) &&
    ![...activeLevels].some((level) => CANDIDATE_PARAMETERS.advancedGates.Preferred.disqualifyingActiveFlags.includes(level));
  return Object.freeze({ Prime: prime, Preferred: preferred });
}

function scorePreparedSnapshot(prepared) {
  if (!prepared || !prepared.snapshot || !Array.isArray(prepared.included)) throw new TypeError('prepared evidence is invalid');
  const categories = scoreCategories(prepared);
  const coverage = computeCoverage(categories);
  const confidence = computeConfidence(prepared, categories);
  const stats = evidenceStats(prepared, categories);
  const categoryScoresMicro = Object.fromEntries(CATEGORIES.map((category) => [category, BigInt(categories[category].scoreMicro)]));
  const internalScore = weightedOverallScore(categoryScoresMicro);
  const scoreTier = tierForScore(internalScore);
  const risks = riskState(prepared.snapshot);
  const reasons = gateReasons(prepared, confidence, coverage, stats);
  for (const reason of risks.reasons) reasons.add(reason);
  const statusGateReasons = new Set([...reasons].filter((code) => code.startsWith('PROVISIONAL_') || code === 'IDENTITY_AMBIGUOUS' || code === 'IDENTITY_CONFLICT'));
  const status = ratingStatus(prepared, stats, statusGateReasons, risks);
  const computedAdvanced = advancedEligibility(scoreTier, confidence, coverage, stats, risks);
  const advanced = Object.freeze({
    Prime: status === 'RATED' && computedAdvanced.Prime,
    Preferred: status === 'RATED' && computedAdvanced.Preferred,
  });
  if ((scoreTier === 'Prime' && !advanced.Prime) || (scoreTier === 'Preferred' && !advanced.Preferred)) reasons.add('ADVANCED_PRIVILEGE_GATE_UNMET');
  let effectivePrivilegeTier = status === 'RATED' ? scoreTier : null;
  if (effectivePrivilegeTier !== null && risks.privilegeCeiling !== null) effectivePrivilegeTier = capTier(effectivePrivilegeTier, risks.privilegeCeiling);
  const exposesEstimate = status === 'PROVISIONAL' || status === 'SUSPENDED';
  return Object.freeze({
    subjectId: prepared.snapshot.subject?.subjectId ?? null,
    actorEpochId: prepared.snapshot.subject?.actorEpochId ?? null,
    ratingStatus: status,
    score: status === 'RATED' ? internalScore : null,
    tier: status === 'RATED' ? scoreTier : null,
    estimatedScore: exposesEstimate ? internalScore : null,
    estimatedTier: exposesEstimate ? scoreTier : null,
    internalScore,
    scoreTier,
    effectivePrivilegeTier,
    advancedEligibility: advanced,
    regulatedEligibility: risks.regulatedEligibility,
    categories,
    coverage,
    confidence,
    effectiveIndependentMassMicroEu: stats.totalMass.toString(),
    independentControlGroups: confidence.independentControlGroups,
    nonP4IndependentControlGroups: confidence.nonP4IndependentControlGroups,
    observationSpanDays: stats.observationSpanDays,
    freshestEvidenceAgeDays: stats.freshestAgeDays,
    flags: Object.freeze([...risks.flags].sort()),
    policyRiskLevels: Object.freeze([...risks.policyRiskLevels].sort()),
    reasonCodes: Object.freeze([...reasons].sort()),
    auditRiskHistory: immutableClone(prepared.snapshot.risks || []),
  });
}

function scoreShadowSnapshot(snapshot) {
  return scorePreparedSnapshot(prepareEvidence(snapshot));
}

function scoreDomainProfile(prepared, domain) {
  if (!APPROVED_DOMAIN_TAGS.includes(domain)) throw new TypeError('domain is not approved by the pinned ontology');
  const filtered = prepareDomainEvidence(prepared, domain);
  const domainSnapshot = filtered.snapshot;
  const categories = scoreCategories(filtered);
  const coverage = computeCoverage(categories);
  const confidence = computeConfidence(filtered, categories);
  const stats = evidenceStats(filtered, categories);
  const scores = Object.fromEntries(CATEGORIES.map((category) => [category, BigInt(categories[category].scoreMicro)]));
  const internalScore = weightedOverallScore(scores);
  const scoreTier = tierForScore(internalScore);
  const risks = riskState(domainSnapshot);
  const reasons = new Set(risks.reasons);
  if (domainSnapshot.identity.resolution === 'ambiguous') reasons.add('IDENTITY_AMBIGUOUS');
  if (domainSnapshot.identity.resolution === 'conflict') reasons.add('IDENTITY_CONFLICT');
  const gates = {
    mass: stats.totalMass >= 4n * EU,
    diversity: confidence.nonP4IndependentControlGroups >= 2,
    age: stats.observationSpanDays >= 30,
    confidence: confidence.value >= 40,
    coverage: coverage.overall >= 50,
    identity: domainSnapshot.identity.resolution === 'resolved',
  };
  if (!gates.mass) reasons.add('PROVISIONAL_VOLUME_GATE');
  if (!gates.diversity) reasons.add('PROVISIONAL_DIVERSITY_GATE');
  if (!gates.age) reasons.add('PROVISIONAL_AGE_GATE');
  if (!gates.confidence) reasons.add('PROVISIONAL_CONFIDENCE_GATE');
  if (!gates.coverage) reasons.add('PROVISIONAL_COVERAGE_GATE');
  if (!gates.identity) reasons.add('PROVISIONAL_IDENTITY_GATE');
  if (stats.totalMass < EU) reasons.add('UNRATED_INSUFFICIENT_EVIDENCE');
  let status;
  if (risks.identityCompromised) status = 'SUSPENDED';
  else if (domainSnapshot.identity.resolution !== 'resolved' || stats.totalMass < EU) status = 'UNRATED';
  else status = Object.values(gates).every(Boolean) ? 'RATED' : 'PROVISIONAL';
  const exposesEstimate = status === 'PROVISIONAL' || status === 'SUSPENDED';
  return Object.freeze({
    domain,
    subjectId: domainSnapshot.subject?.subjectId ?? null,
    actorEpochId: domainSnapshot.subject?.actorEpochId ?? null,
    ratingStatus: status,
    score: status === 'RATED' ? internalScore : null,
    tier: status === 'RATED' ? scoreTier : null,
    estimatedScore: exposesEstimate ? internalScore : null,
    estimatedTier: exposesEstimate ? scoreTier : null,
    internalScore,
    scoreTier,
    effectivePrivilegeTier: null,
    advancedEligibility: Object.freeze({ Prime: false, Preferred: false }),
    regulatedEligibility: risks.regulatedEligibility,
    categories,
    coverage,
    confidence,
    effectiveIndependentMassMicroEu: stats.totalMass.toString(),
    independentControlGroups: confidence.independentControlGroups,
    nonP4IndependentControlGroups: confidence.nonP4IndependentControlGroups,
    observationSpanDays: stats.observationSpanDays,
    freshestEvidenceAgeDays: stats.freshestAgeDays,
    flags: Object.freeze([...risks.flags].sort()),
    policyRiskLevels: Object.freeze([...risks.policyRiskLevels].sort()),
    reasonCodes: Object.freeze([...reasons].sort()),
    auditRiskHistory: immutableClone(domainSnapshot.risks || []),
  });
}

module.exports = Object.freeze({
  tierForScore,
  scorePreparedSnapshot,
  scoreShadowSnapshot,
  scoreDomainProfile,
});
