'use strict';

const { createHash } = require('node:crypto');
const { CANDIDATE_PARAMETERS } = require('./parameters');
const { normalizeEvidenceSnapshot, prepareEvidence } = require('./evidence');
const { CATEGORIES } = require('./category');
const { scorePreparedSnapshot } = require('./score');

const CANONICAL_SERIALIZATION_VERSION = 'cred-cjson-v1';
const ARTIFACT_TYPE = 'cred-shadow-unsigned-payload-v1';
const RECORD_FIELDS = Object.freeze([
  'evidenceId', 'subjectId', 'actorEpochId', 'schemaId', 'schemaVersion',
  'schemaFamilyId', 'empId', 'empVersion', 'empWindowSeconds', 'providerId',
  'providerControlGroup', 'category', 'direction', 'proofClass', 'materiality',
  'severity', 'evidenceFamily', 'observedAt', 'incidentKey', 'correlationKey',
  'domainTags', 'status', 'scoreEligible', 'finality', 'correctionOf',
  'remediationOf', 'disputeId', 'nativePayloadHash', 'transformationHash', 'proofRefs',
]);

function deepFreeze(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

function encodeString(value) {
  let encoded = '"';
  for (let index = 0; index < value.length;) {
    const first = value.charCodeAt(index);
    let point;
    if (first >= 0xd800 && first <= 0xdbff) {
      if (index + 1 >= value.length) throw new TypeError('string contains a lone high surrogate');
      const second = value.charCodeAt(index + 1);
      if (second < 0xdc00 || second > 0xdfff) throw new TypeError('string contains a lone high surrogate');
      point = value.codePointAt(index);
      index += 2;
    } else {
      if (first >= 0xdc00 && first <= 0xdfff) throw new TypeError('string contains a lone low surrogate');
      point = first;
      index += 1;
    }
    if (point === 0x22 || point === 0x5c || point <= 0x1f) {
      encoded += String.fromCharCode(92) + 'u' + point.toString(16).padStart(4, '0');
    } else {
      encoded += String.fromCodePoint(point);
    }
  }
  return encoded + '"';
}

function canonicalStringify(value) {
  const active = new Set();
  function encode(item) {
    if (item === null) return 'null';
    if (typeof item === 'boolean') return item ? 'true' : 'false';
    if (typeof item === 'string') return encodeString(item);
    if (typeof item === 'bigint') return encodeString(item.toString());
    if (typeof item === 'number') {
      if (!Number.isSafeInteger(item) || Object.is(item, -0)) throw new TypeError('numbers must be safe integers without negative zero');
      return String(item);
    }
    if (typeof item !== 'object') throw new TypeError('unsupported canonical value');
    if (active.has(item)) throw new TypeError('cyclic canonical value');
    active.add(item);
    try {
      if (Array.isArray(item)) {
        const parts = [];
        for (let index = 0; index < item.length; index += 1) {
          if (!Object.hasOwn(item, index)) throw new TypeError('sparse arrays are not canonical');
          parts.push(encode(item[index]));
        }
        return '[' + parts.join(',') + ']';
      }
      if (Object.getPrototypeOf(item) !== Object.prototype) throw new TypeError('objects must be plain objects');
      const ownKeys = Reflect.ownKeys(item);
      if (ownKeys.some((key) => typeof key !== 'string')) throw new TypeError('symbol keys are not canonical');
      for (const key of ownKeys) {
        const descriptor = Object.getOwnPropertyDescriptor(item, key);
        if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) throw new TypeError('object properties must be enumerable data properties');
      }
      const keys = ownKeys.sort(compareUtf8);
      return '{' + keys.map((key) => encodeString(key) + ':' + encode(item[key])).join(',') + '}';
    } finally {
      active.delete(item);
    }
  }
  return encode(value);
}

function domainHash(domain, bytes) {
  return 'sha256:' + createHash('sha256').update(domain, 'utf8').update(bytes, 'utf8').digest('hex');
}

function normalizedSnapshot(input) {
  if (input && input.computedAtEpochSeconds !== undefined && Array.isArray(input.records)) return input;
  return normalizeEvidenceSnapshot(input);
}

function buildParameterMaterial(input, parameters = CANDIDATE_PARAMETERS) {
  const snapshot = normalizedSnapshot(input);
  const envelope = {
    methodologyId: snapshot.methodologyId,
    parameters,
    empRegistryVersion: snapshot.versions.empRegistry,
    empRegistryRoot: snapshot.roots.empRegistryRoot,
    empPolicies: snapshot.empPolicies,
  };
  const bytes = canonicalStringify(envelope);
  return Object.freeze({ bytes, hash: domainHash('CRED-PARAMS-v1\0', bytes) });
}

function projectRecord(record) {
  const projected = {};
  for (const field of RECORD_FIELDS) projected[field] = record[field];
  return projected;
}

function buildEvidenceMaterial(input) {
  const snapshot = normalizedSnapshot(input);
  const envelope = {
    snapshotSchemaVersion: snapshot.snapshotSchemaVersion,
    subject: snapshot.subject,
    computedAt: snapshot.computedAt,
    validUntil: snapshot.validUntil,
    versions: snapshot.versions,
    roots: snapshot.roots,
    identity: snapshot.identity,
    records: snapshot.records.map(projectRecord),
    contradictions: snapshot.contradictions,
    risks: snapshot.risks,
  };
  const bytes = canonicalStringify(envelope);
  return Object.freeze({ bytes, hash: domainHash('CRED-EVIDENCE-v1\0', bytes) });
}

function categoryPayload(categories) {
  return CATEGORIES.map((name) => {
    const category = categories[name];
    return {
      category: name,
      effectivePositiveMassMicroEu: category.effectivePositiveMassMicroEu,
      effectiveNegativeMassMicroEu: category.effectiveNegativeMassMicroEu,
      effectiveIndependentMassMicroEu: category.effectiveIndependentMassMicroEu,
      positivePosteriorMassMicroEu: category.positivePosteriorMassMicroEu,
      negativePosteriorMassMicroEu: category.negativePosteriorMassMicroEu,
      scoreMicro: category.scoreMicro,
      publicScore: category.publicScore,
      reasonCodes: category.reasonCodes,
    };
  });
}

function buildUnsignedArtifact(input, parameters = CANDIDATE_PARAMETERS) {
  const snapshot = normalizedSnapshot(input);
  const prepared = prepareEvidence(snapshot);
  const score = scorePreparedSnapshot(prepared);
  const parameter = buildParameterMaterial(snapshot, parameters);
  const evidence = buildEvidenceMaterial(snapshot);
  const unsignedPayload = {
    artifactType: ARTIFACT_TYPE,
    canonicalSerializationVersion: CANONICAL_SERIALIZATION_VERSION,
    methodologyId: snapshot.methodologyId,
    parameterSetHash: parameter.hash,
    evidenceSetHash: evidence.hash,
    subjectId: snapshot.subject.subjectId,
    actorEpochId: snapshot.subject.actorEpochId,
    ratingStatus: score.ratingStatus,
    score: score.score,
    tier: score.tier,
    estimatedScore: score.estimatedScore,
    estimatedTier: score.estimatedTier,
    scoreTier: score.scoreTier,
    effectivePrivilegeTier: score.effectivePrivilegeTier,
    advancedEligibility: score.advancedEligibility,
    regulatedEligibility: score.regulatedEligibility,
    categories: categoryPayload(score.categories),
    confidence: score.confidence,
    coverage: score.coverage,
    flags: score.flags,
    reasonCodes: score.reasonCodes,
    computedAt: snapshot.computedAt,
    validUntil: snapshot.validUntil,
    versions: snapshot.versions,
    roots: snapshot.roots,
    empPolicies: snapshot.empPolicies.map((policy) => ({
      empId: policy.empId,
      empVersion: policy.empVersion,
      policyHash: policy.policyHash,
      registryLeafIndex: policy.registryLeafIndex,
      registryProof: policy.registryProof,
    })),
  };
  const canonicalBytes = canonicalStringify(unsignedPayload);
  return Object.freeze({
    unsignedPayload: deepFreeze(unsignedPayload),
    parameterBytes: parameter.bytes,
    evidenceBytes: evidence.bytes,
    canonicalBytes,
    parameterSetHash: parameter.hash,
    evidenceSetHash: evidence.hash,
    artifactHash: domainHash('CRED-ARTIFACT-v1\0', canonicalBytes),
  });
}

module.exports = Object.freeze({
  CANONICAL_SERIALIZATION_VERSION,
  ARTIFACT_TYPE,
  canonicalStringify,
  buildParameterMaterial,
  buildEvidenceMaterial,
  buildUnsignedArtifact,
});
