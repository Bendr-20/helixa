'use strict';

const { createHash } = require('node:crypto');
const path = require('node:path');
const { CANDIDATE_PARAMETERS, SCALE, EU } = require('./parameters');
const { normalizeEvidenceSnapshot, prepareEvidence } = require('./evidence');
const { scorePreparedSnapshot } = require('./score');
const { buildEvidenceMaterial, canonicalStringify } = require('./artifact');
const { mulDivRound, roundDiv } = require('./integer-math');

const CATEGORIES = Object.freeze(['operational', 'financial', 'onchain', 'identity']);
const TIERS = Object.freeze(['Junk', 'Marginal', 'Qualified', 'Prime', 'Preferred']);
const STATUSES = Object.freeze(['UNRATED', 'PROVISIONAL', 'RATED', 'SUSPENDED']);
const MAX_ROWS = 100_000;
const MAX_ROW_BYTES = 1_048_576;
const FAMILY_KEYS = Object.freeze([
  ['operational', 'operational'],
  ['financial', 'financial'],
  ['onchain', 'onchain'],
  ['identity', 'identity'],
  ['severe-critical', 'severeCriticalAdverseIncident'],
  ['comparative', 'comparativeModel'],
]);
const SEGMENTS = Object.freeze({
  ecosystem: Object.freeze(['base', 'ethereum', 'solana', 'other']),
  evidenceVolumeBand: Object.freeze(['none', 'thin', 'established', 'deep']),
  subjectAgeBand: Object.freeze(['new', 'developing', 'mature']),
  identityQualityBand: Object.freeze(['unresolved', 'registry', 'controlled', 'fully-bound']),
  sourceAvailabilityBand: Object.freeze(['single', 'limited', 'diverse', 'broad']),
  categoryCoverageBand: Object.freeze(['none', 'one', 'two', 'three', 'four']),
});

function compareText(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

function compareSnapshot(left, right) {
  return compareText(left.subject.subjectId, right.subject.subjectId) ||
    compareText(left.subject.actorEpochId, right.subject.actorEpochId) ||
    compareText(left.computedAt, right.computedAt);
}

function ratio(value, numerator, denominator) {
  return roundDiv(BigInt(value) * BigInt(numerator), BigInt(denominator));
}

function parameterHash(descriptor) {
  const bytes = canonicalStringify({
    methodologyId: CANDIDATE_PARAMETERS.methodologyId,
    candidateParameters: CANDIDATE_PARAMETERS,
    replayParameterOverrides: descriptor.overrides,
  });
  return 'sha256:' + createHash('sha256').update('CRED-REPLAY-PARAMS-v1\0').update(bytes).digest('hex');
}

function descriptor(id, dimension, target, direction, overrides) {
  const value = Object.freeze({ id, dimension, target, direction, overrides: Object.freeze(overrides) });
  return Object.freeze({ ...value, parameterSetHash: parameterHash(value) });
}

let sensitivityVariants;

function enumerateSensitivityVariants() {
  if (sensitivityVariants) return sensitivityVariants;
  const variants = [descriptor('baseline', 'baseline', 'all', 'baseline', {})];
  const pair = (dimension, target, low, high) => {
    variants.push(descriptor(dimension + (target ? ':' + target : '') + ':low', dimension, target || 'all', 'low', low));
    variants.push(descriptor(dimension + (target ? ':' + target : '') + ':high', dimension, target || 'all', 'high', high));
  };
  pair('prior-mass', '', { priorMassMicroEu: '2000000' }, { priorMassMicroEu: '8000000' });
  for (const [family, key] of FAMILY_KEYS) {
    if (CANDIDATE_PARAMETERS.evidenceFamilyHalfLives[key].positiveDays === null) continue;
    pair('positive-half-life', family,
      { halfLife: { family, direction: 'positive', multiplierMicro: '750000' } },
      { halfLife: { family, direction: 'positive', multiplierMicro: '1250000' } });
  }
  for (const [family] of FAMILY_KEYS) {
    pair('negative-half-life', family,
      { halfLife: { family, direction: 'negative', multiplierMicro: '750000' } },
      { halfLife: { family, direction: 'negative', multiplierMicro: '1250000' } });
  }
  for (const severity of ['minor', 'material', 'severe', 'critical']) {
    pair('severity-factor', severity,
      { severity: { name: severity, multiplierMicro: '750000' } },
      { severity: { name: severity, multiplierMicro: '1250000' } });
  }
  for (const cap of ['provider', 'schema', 'P4']) {
    pair('cap', cap,
      { cap: { name: cap, multiplierMicro: '500000' } },
      { cap: { name: cap, multiplierMicro: '1500000' } });
  }
  pair('rated-mass', '', { ratedMassMicroEu: '6000000' }, { ratedMassMicroEu: '12000000' });
  pair('category-mass', '', { categoryMassMicroEu: '1000000' }, { categoryMassMicroEu: '4000000' });
  pair('confidence-gate', '', { confidenceGate: 30 }, { confidenceGate: 50 });
  pair('coverage-gate', '', { coverageGate: 40 }, { coverageGate: 60 });
  sensitivityVariants = Object.freeze(variants);
  return sensitivityVariants;
}

function validateSensitivityVariant(variant) {
  if (!variant || typeof variant !== 'object') throw new TypeError('replay sensitivity variant is invalid');
  const expected = enumerateSensitivityVariants().find((item) => item.id === variant.id);
  if (!expected || canonicalStringify(expected) !== canonicalStringify(variant)) {
    throw new TypeError('replay sensitivity variant is not a canonical OAT descriptor');
  }
  return expected;
}

function validateParameterSet(parameters) {
  if (parameters.priorMass.positive !== parameters.priorMass.negative) throw new Error('replay prior mass must remain equal per side');
  const factors = ['minor', 'material', 'severe', 'critical'].map((key) => parameters.severityFactors[key]);
  for (let index = 1; index < factors.length; index += 1) {
    if (factors[index] < factors[index - 1]) throw new Error('replay severity factors must preserve monotonic order');
  }
  for (const value of [parameters.ratingGates.minimumTotalMass, parameters.ratingGates.minimumCategoryMass]) {
    if (value <= 0n) throw new Error('replay mass gates must be positive');
  }
  for (const value of [parameters.ratingGates.minimumConfidence, parameters.ratingGates.minimumCoverage]) {
    if (value < 0n || value > 100n) throw new Error('replay percentage gates must be in range');
  }
}

function applyVariant(snapshot, variant) {
  variant = validateSensitivityVariant(variant);
  const parameters = structuredClone(CANDIDATE_PARAMETERS);
  const replaySnapshot = structuredClone(snapshot);
  const override = variant.overrides;
  if (override.priorMassMicroEu) {
    parameters.priorMass.positive = BigInt(override.priorMassMicroEu);
    parameters.priorMass.negative = BigInt(override.priorMassMicroEu);
  }
  if (override.severity) {
    const name = override.severity.name;
    parameters.severityFactors[name] = roundDiv(parameters.severityFactors[name] * BigInt(override.severity.multiplierMicro), SCALE);
  }
  if (override.ratedMassMicroEu) parameters.ratingGates.minimumTotalMass = BigInt(override.ratedMassMicroEu);
  if (override.categoryMassMicroEu) parameters.ratingGates.minimumCategoryMass = BigInt(override.categoryMassMicroEu);
  if (override.confidenceGate !== undefined) parameters.ratingGates.minimumConfidence = BigInt(override.confidenceGate);
  if (override.coverageGate !== undefined) parameters.ratingGates.minimumCoverage = BigInt(override.coverageGate);
  if (override.halfLife) {
    const field = override.halfLife.direction === 'positive' ? 'positiveHalfLifeDays' : 'negativeHalfLifeDays';
    for (const policy of replaySnapshot.empPolicies) {
      if (policy.evidenceFamily !== override.halfLife.family) continue;
      if (policy[field] === null) throw new Error('null half-life cannot be overridden');
      policy[field] = Number(ratio(policy[field], override.halfLife.multiplierMicro, SCALE));
      if (!Number.isSafeInteger(policy[field]) || policy[field] <= 0) throw new Error('replay half-life must round to positive whole days');
    }
  }
  if (override.cap) {
    const field = override.cap.name === 'provider' ? 'providerBucket' : override.cap.name === 'schema' ? 'schemaBucket' : 'p4Bucket';
    for (const policy of replaySnapshot.empPolicies) {
      policy[field].capacityMicroEu = roundDiv(BigInt(policy[field].capacityMicroEu) * BigInt(override.cap.multiplierMicro), SCALE).toString();
    }
  }
  validateParameterSet(parameters);
  return { parameters, snapshot: replaySnapshot };
}

function categoryMap(score) {
  return Object.fromEntries(CATEGORIES.map((name) => [name, score.categories[name]]));
}

function legacyCategoryMap(legacy) {
  return Object.fromEntries(CATEGORIES.map((name) => [name, legacy?.categoryScores?.[name] ?? null]));
}

function sumMass(items, field) {
  return items.reduce((total, item) => total + BigInt(item[field] || '0'), 0n);
}

function nominalEventMass(record) {
  let mass = mulDivRound(EU, CANDIDATE_PARAMETERS.proofFactors[record.proofClass], SCALE);
  return mulDivRound(mass, CANDIDATE_PARAMETERS.materialityFactors[record.materiality], SCALE);
}

function uncappedEventMass(record, allocation) {
  return mulDivRound(nominalEventMass(record), BigInt(allocation.independenceFactorMicro), SCALE);
}

function evidenceSummary(prepared, score) {
  const records = new Map(prepared.snapshot.records.map((record) => [record.evidenceId, record]));
  const events = CATEGORIES.flatMap((category) => score.categories[category].events || []);
  const eventById = new Map(events.map((event) => [event.evidenceId, event]));
  const capped = prepared.included.filter((item) => item.reasonCodes.some((code) => code.includes('CAP_APPLIED')));
  const decayed = events.filter((event) => BigInt(event.decayFactorMicro) < SCALE);
  const quarantined = prepared.excluded.filter((item) => records.get(item.evidenceId)?.status === 'QUARANTINED');
  const includedMass = sumMass(prepared.included, 'allocatedMassMicroEu');
  const excludedMass = prepared.excluded.reduce((total, item) => total + nominalEventMass(records.get(item.evidenceId)), 0n);
  const quarantinedMass = quarantined.reduce((total, item) => total + nominalEventMass(records.get(item.evidenceId)), 0n);
  const deduplicatedMass = prepared.deduplicated.reduce((total, item) => total + nominalEventMass(records.get(item.evidenceId)), 0n);
  const cappedMass = capped.reduce((total, item) => {
    const raw = uncappedEventMass(records.get(item.evidenceId), item);
    return total + raw - BigInt(item.allocatedMassMicroEu);
  }, 0n);
  const decayedMass = decayed.reduce((total, item) => total + (BigInt(item.allocatedMassMicroEu) - BigInt(item.effectiveIndependentMassMicroEu)), 0n);
  const metric = (count, mass) => Object.freeze({ count, massMicroEu: mass.toString() });
  return Object.freeze({
    included: metric(prepared.included.length, includedMass),
    excluded: metric(prepared.excluded.length, excludedMass),
    quarantined: metric(quarantined.length, quarantinedMass),
    deduplicated: metric(prepared.deduplicated.length, deduplicatedMass),
    capped: metric(capped.length, cappedMass),
    decayed: metric(decayed.length, decayedMass),
    eventMasses: Object.freeze(prepared.included.map((item) => {
      const event = eventById.get(item.evidenceId);
      return Object.freeze({
        evidenceId: item.evidenceId,
        allocatedMassMicroEu: item.allocatedMassMicroEu,
        effectiveIndependentMassMicroEu: event?.effectiveIndependentMassMicroEu || '0',
        effectiveScoreMassMicroEu: event?.effectiveScoreMassMicroEu || '0',
        ageMicroDays: event?.ageMicroDays || '0',
        decayFactorMicro: event?.decayFactorMicro || SCALE.toString(),
        reasonCodes: item.reasonCodes,
      });
    })),
  });
}

function scoreOne(normalized, variant) {
  const applied = applyVariant(normalized, variant);
  const prepared = prepareEvidence({ snapshot: applied.snapshot, included: [] });
  const score = scorePreparedSnapshot(prepared, applied.parameters, { fractionalDays: true });
  return { prepared, score };
}

function snapshotRow(normalized, result, parameterSetHash) {
  const { prepared, score } = result;
  const legacy = normalized.legacy;
  const legacyCategories = legacyCategoryMap(legacy);
  const candidateCategories = categoryMap(score);
  const scoreDelta = legacy?.score === null || legacy?.score === undefined ? null : score.internalScore - legacy.score;
  const categoryDeltas = Object.fromEntries(CATEGORIES.map((name) => [name,
    legacyCategories[name] === null ? null : candidateCategories[name].publicScore - legacyCategories[name],
  ]));
  return Object.freeze({
    subjectId: normalized.subject.subjectId,
    actorEpochId: normalized.subject.actorEpochId,
    computedAt: normalized.computedAt,
    validUntil: normalized.validUntil,
    methodologyId: normalized.methodologyId,
    parameterSetHash,
    versions: normalized.versions,
    roots: normalized.roots,
    freshness: Object.freeze({ freshestEvidenceAgeDays: score.freshestEvidenceAgeDays, validUntil: normalized.validUntil }),
    flags: score.flags,
    reasonCodes: score.reasonCodes,
    evidenceSetHash: buildEvidenceMaterial(normalized).hash,
    identityResolution: Object.freeze({
      resolution: normalized.identity.resolution,
      assurance: normalized.identity.assurance,
      compromised: normalized.identity.compromised,
      controlProofObservedAt: normalized.identity.controlProofObservedAt,
    }),
    legacy: Object.freeze({
      score: legacy?.score ?? null,
      tier: legacy?.tier ?? null,
      ratingStatus: legacy?.ratingStatus ?? null,
      categories: Object.freeze(legacyCategories),
      confidence: legacy?.confidence ?? null,
      coverage: legacy?.coverage ?? null,
    }),
    candidate: Object.freeze({
      score: score.score,
      estimatedScore: score.estimatedScore,
      internalScore: score.internalScore,
      tier: score.tier,
      estimatedTier: score.estimatedTier,
      scoreTier: score.scoreTier,
      effectivePrivilegeTier: score.effectivePrivilegeTier,
      ratingStatus: score.ratingStatus,
      categories: Object.freeze(candidateCategories),
      confidence: score.confidence,
      coverage: score.coverage,
      effectiveIndependentMassMicroEu: score.effectiveIndependentMassMicroEu,
    }),
    transition: Object.freeze({
      scoreDelta,
      categoryDeltas: Object.freeze(categoryDeltas),
      confidenceDelta: legacy?.confidence === null || legacy?.confidence === undefined ? null : score.confidence.value - legacy.confidence,
      coverageDelta: legacy?.coverage === null || legacy?.coverage === undefined ? null : score.coverage.overall - legacy.coverage,
      tier: (legacy?.tier ?? 'UNAVAILABLE') + '->' + score.scoreTier,
      ratingStatus: (legacy?.ratingStatus ?? 'UNAVAILABLE') + '->' + score.ratingStatus,
    }),
    evidence: evidenceSummary(prepared, score),
    segments: normalized.segments,
  });
}

function zeroMatrix(labels) {
  return Object.fromEntries(labels.map((from) => [from, Object.fromEntries(labels.map((to) => [to, 0]))]));
}

function summarizeSegments(rows) {
  const output = [];
  for (const [dimension, values] of Object.entries(SEGMENTS)) {
    for (const value of values) {
      const selected = rows.filter((row) => row.segments[dimension] === value && row.transition.scoreDelta !== null);
      const sum = selected.reduce((total, row) => total + BigInt(row.transition.scoreDelta), 0n);
      output.push(Object.freeze({
        dimension,
        value,
        count: selected.length,
        meanDeltaMicroPoints: selected.length === 0 ? '0' : roundDiv(sum * SCALE, BigInt(selected.length)).toString(),
        minimumDelta: selected.length === 0 ? null : Math.min(...selected.map((row) => row.transition.scoreDelta)),
        maximumDelta: selected.length === 0 ? null : Math.max(...selected.map((row) => row.transition.scoreDelta)),
      }));
    }
  }
  return Object.freeze(output);
}

function aggregate(rows) {
  const withLegacy = rows.filter((row) => row.transition.scoreDelta !== null);
  const series = withLegacy.map((row) => Object.freeze({
    subjectId: row.subjectId,
    actorEpochId: row.actorEpochId,
    computedAt: row.computedAt,
    legacyScore: row.legacy.score,
    candidateScore: row.candidate.internalScore,
    delta: row.transition.scoreDelta,
  }));
  const thresholds = { greaterThan5: 0, greaterThan10: 0, greaterThan20: 0, greaterThan30: 0 };
  for (const row of withLegacy) {
    const value = Math.abs(row.transition.scoreDelta);
    if (value > 5) thresholds.greaterThan5 += 1;
    if (value > 10) thresholds.greaterThan10 += 1;
    if (value > 20) thresholds.greaterThan20 += 1;
    if (value > 30) thresholds.greaterThan30 += 1;
  }
  const tierMatrix = zeroMatrix(TIERS);
  const statusMatrix = zeroMatrix(STATUSES);
  for (const row of rows) {
    if (TIERS.includes(row.legacy.tier)) tierMatrix[row.legacy.tier][row.candidate.scoreTier] += 1;
    if (STATUSES.includes(row.legacy.ratingStatus)) statusMatrix[row.legacy.ratingStatus][row.candidate.ratingStatus] += 1;
  }
  const extremes = [...withLegacy].sort((a, b) => Math.abs(b.transition.scoreDelta) - Math.abs(a.transition.scoreDelta) || compareText(a.subjectId, b.subjectId)).map((row) => Object.freeze({
    subjectId: row.subjectId,
    actorEpochId: row.actorEpochId,
    computedAt: row.computedAt,
    delta: row.transition.scoreDelta,
    explanation: Object.freeze({ reasonCodes: row.reasonCodes, flags: row.flags, categoryDeltas: row.transition.categoryDeltas, evidence: row.evidence }),
  }));
  return Object.freeze({
    scoreDeltaSeries: Object.freeze(series),
    thresholdCounts: Object.freeze(thresholds),
    tierTransitionMatrix: Object.freeze(tierMatrix),
    ratingStatusTransitionMatrix: Object.freeze(statusMatrix),
    segments: summarizeSegments(rows),
    extremeExplanations: Object.freeze(extremes),
  });
}

function deltaSummary(values) {
  if (values.length === 0) return Object.freeze({ minimum: null, maximum: null, meanMicroPoints: '0', absoluteMeanMicroPoints: '0' });
  const sum = values.reduce((total, value) => total + BigInt(value), 0n);
  const absolute = values.reduce((total, value) => total + BigInt(Math.abs(value)), 0n);
  return Object.freeze({
    minimum: Math.min(...values),
    maximum: Math.max(...values),
    meanMicroPoints: roundDiv(sum * SCALE, BigInt(values.length)).toString(),
    absoluteMeanMicroPoints: roundDiv(absolute * SCALE, BigInt(values.length)).toString(),
  });
}

function replaySnapshots(inputs, options = {}) {
  if (!Array.isArray(inputs)) throw new TypeError('replay input must be an array');
  if (inputs.length > MAX_ROWS) throw new RangeError('replay input exceeds 100000 rows');
  const normalized = inputs.map(normalizeEvidenceSnapshot).sort(compareSnapshot);
  const variants = enumerateSensitivityVariants();
  const baseline = variants[0];
  const baselineResults = normalized.map((snapshot) => scoreOne(snapshot, baseline));
  const rows = normalized.map((snapshot, index) => snapshotRow(snapshot, baselineResults[index], baseline.parameterSetHash));
  const selected = options.sensitivity === false ? [baseline] : variants;
  const sensitivity = selected.map((variant) => {
    const results = variant === baseline ? baselineResults : normalized.map((snapshot) => scoreOne(snapshot, variant));
    const subjectDeltas = normalized.map((snapshot, index) => {
      const delta = results[index].score.internalScore - baselineResults[index].score.internalScore;
      return Object.freeze({ subjectId: snapshot.subject.subjectId, actorEpochId: snapshot.subject.actorEpochId, computedAt: snapshot.computedAt, delta });
    });
    return Object.freeze({
      id: variant.id,
      dimension: variant.dimension,
      target: variant.target,
      direction: variant.direction,
      parameterSetHash: variant.parameterSetHash,
      subjectDeltas: Object.freeze(subjectDeltas),
      aggregateDelta: deltaSummary(subjectDeltas.map((item) => item.delta)),
    });
  });
  return Object.freeze({
    schemaVersion: 'cred-shadow-replay-v1',
    methodologyId: CANDIDATE_PARAMETERS.methodologyId,
    parameterSets: Object.freeze(selected.map((variant) => Object.freeze({ id: variant.id, dimension: variant.dimension, target: variant.target, direction: variant.direction, parameterSetHash: variant.parameterSetHash, overrides: variant.overrides }))),
    snapshots: Object.freeze(rows),
    aggregate: aggregate(rows),
    sensitivity: Object.freeze(sensitivity),
  });
}

function parseReplayInput(text, filename) {
  if (typeof text !== 'string') throw new TypeError('input text must be a string');
  const extension = path.extname(filename).toLowerCase();
  let rows;
  if (extension === '.jsonl') {
    const lines = text.split('\n');
    if (lines.at(-1) === '') lines.pop();
    if (lines.length > MAX_ROWS) throw new RangeError('replay input exceeds 100000 rows');
    rows = lines.map((line, index) => {
      if (Buffer.byteLength(line) > MAX_ROW_BYTES) throw new RangeError('row ' + (index + 1) + ' exceeds 1 MiB');
      if (line.trim() === '') throw new SyntaxError('blank JSONL row ' + (index + 1));
      try { return JSON.parse(line); } catch (error) { throw new SyntaxError('invalid JSONL row ' + (index + 1) + ': ' + error.message); }
    });
  } else if (extension === '.json') {
    let parsed;
    try { parsed = JSON.parse(text); } catch (error) { throw new SyntaxError('invalid JSON: ' + error.message); }
    rows = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.snapshots) ? parsed.snapshots : [parsed];
    if (rows.length > MAX_ROWS) throw new RangeError('replay input exceeds 100000 rows');
    rows.forEach((row, index) => {
      if (Buffer.byteLength(JSON.stringify(row)) > MAX_ROW_BYTES) throw new RangeError('row ' + (index + 1) + ' exceeds 1 MiB');
    });
  } else {
    throw new TypeError('input must use json or jsonl format');
  }
  if (rows.length === 0) throw new RangeError('replay input must contain at least one row');
  for (const row of rows) {
    if (row === null || typeof row !== 'object' || Array.isArray(row)) throw new TypeError('each replay row must be an object');
  }
  return rows;
}

module.exports = Object.freeze({
  MAX_ROWS,
  MAX_ROW_BYTES,
  enumerateSensitivityVariants,
  applySensitivityVariant: applyVariant,
  replaySnapshots,
  parseReplayInput,
});
