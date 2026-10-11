'use strict';

const { createHash, createPublicKey, verify } = require('node:crypto');
const { canonicalStringify } = require('../cred-shadow/artifact');
const { buildRegistryBundle, normalizeCoordinate, coordinateKey } = require('./registry');
const { resolveIdentity } = require('./identity');

const SUBMISSION_TYPE = 'cred-native-submission-v1';
const SIGNATURE_DOMAIN = 'CRED-NATIVE-SUBMISSION-SIGNATURE-v1\0';
const SUBMISSION_HASH_DOMAIN = 'CRED-NATIVE-SUBMISSION-v1\0';
const PAYLOAD_HASH_DOMAIN = 'CRED-NATIVE-PAYLOAD-v1\0';
const MAX_RECEIPT_DELAY_MS = 7 * 24 * 60 * 60 * 1000;
const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const IDENTIFIER_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}._:-]{0,127}$/u;
const FIELDS = Object.freeze(['submissionType','registryVersion','submissionId','lane','providerId','submitterId','providerEventId','schemaId','schemaVersion','occurredAt','observedAt','receivedAt','subjectCoordinates','claimedActorEpochId','payloadVisibility','nativePayload','nativePayloadHash','proofRefs','signatureSuite','keyId','signature','correctionOf','revocationOf','disputeOf']);

function deepFreeze(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function compareUtf8(left, right) { return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8')); }
function plain(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new TypeError(label + ' must be a plain object');
  return value;
}
function exact(value, fields, label) {
  plain(value, label);
  const allowed = new Set(fields);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !allowed.has(key)) throw new TypeError(label + ' has unknown field ' + String(key));
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) throw new TypeError(label + ' fields must be enumerable data properties');
  }
  for (const field of fields) if (!Object.hasOwn(value, field)) throw new TypeError(label + ' is missing field ' + field);
}
function identifier(value, label) {
  if (typeof value !== 'string' || value.normalize('NFC') !== value || !IDENTIFIER_PATTERN.test(value)) throw new TypeError(label + ' must be a canonical identifier');
  return value;
}
function timestamp(value, label) {
  if (typeof value !== 'string' || !ISO_PATTERN.test(value)) throw new TypeError(label + ' must be a canonical ISO-8601 UTC timestamp');
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) throw new TypeError(label + ' must be a canonical ISO-8601 UTC timestamp');
  return milliseconds;
}
function hash(value, label) {
  if (typeof value !== 'string' || !HASH_PATTERN.test(value)) throw new TypeError(label + ' must be a canonical sha256 hash');
  return value;
}
function optionalIdentifier(value, label) { return value === null ? null : identifier(value, label); }
function canonicalBase64url(value, label, bytes) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/u.test(value)) throw new TypeError(label + ' must be canonical base64url');
  const decoded = Buffer.from(value, 'base64url');
  if (decoded.length !== bytes || decoded.toString('base64url') !== value) throw new TypeError(label + ' must encode exactly ' + bytes + ' bytes');
  return value;
}
function domainHash(domain, bytes) { return 'sha256:' + createHash('sha256').update(domain, 'utf8').update(bytes, 'utf8').digest('hex'); }

function buildNativePayloadHash(payload) {
  plain(payload, 'nativePayload');
  return domainHash(PAYLOAD_HASH_DOMAIN, canonicalStringify(payload));
}

function normalizeStrings(values, label) {
  if (!Array.isArray(values)) throw new TypeError(label + ' must be an array');
  const normalized = values.map((value) => {
    if (typeof value !== 'string' || value.normalize('NFC') !== value || value.length > 1024) throw new TypeError(label + ' contains an invalid proof reference');
    let parsed;
    try { parsed = new URL(value); } catch { throw new TypeError(label + ' contains an invalid proof reference'); }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hash || parsed.toString() !== value) throw new TypeError(label + ' contains an invalid proof reference');
    return value;
  }).sort(compareUtf8);
  for (let index = 1; index < normalized.length; index += 1) if (normalized[index - 1] === normalized[index]) throw new Error(label + ' contains a duplicate');
  return normalized;
}

function normalizeCoordinates(values) {
  if (!Array.isArray(values) || values.length === 0) throw new TypeError('subjectCoordinates must be a nonempty array');
  const byKey = new Map();
  for (let index = 0; index < values.length; index += 1) {
    const coordinate = normalizeCoordinate(values[index], 'subjectCoordinates[' + index + ']');
    byKey.set(coordinateKey(coordinate), coordinate);
  }
  return [...byKey.values()].sort((left, right) => compareUtf8(coordinateKey(left), coordinateKey(right)));
}

function normalizeSubmission(input, options = {}) {
  exact(input, FIELDS, 'submission');
  if (input.submissionType !== SUBMISSION_TYPE) throw new TypeError('submissionType is invalid');
  const lane = input.lane;
  if (lane !== 'approved' && lane !== 'permissionless') throw new TypeError('lane is invalid');
  const payloadVisibility = input.payloadVisibility;
  if (payloadVisibility !== 'public' && payloadVisibility !== 'committed') throw new TypeError('payloadVisibility is invalid');
  let nativePayload = null;
  if (payloadVisibility === 'public') {
    nativePayload = structuredClone(plain(input.nativePayload, 'nativePayload'));
    if (buildNativePayloadHash(nativePayload) !== input.nativePayloadHash) throw new Error('nativePayloadHash does not match native payload');
  } else {
    if (input.nativePayload !== null) throw new TypeError('committed nativePayload must be null');
    hash(input.nativePayloadHash, 'nativePayloadHash');
  }
  const occurred = timestamp(input.occurredAt, 'occurredAt');
  const observed = timestamp(input.observedAt, 'observedAt');
  const received = timestamp(input.receivedAt, 'receivedAt');
  if (occurred > observed || observed > received) throw new RangeError('submission timestamps are out of order');
  if (received - observed > MAX_RECEIPT_DELAY_MS) throw new RangeError('submission exceeds replay receipt window');
  if (lane === 'approved') {
    identifier(input.providerId, 'providerId');
    if (input.submitterId !== input.providerId) throw new Error('approved submitterId must equal providerId');
    if (input.signatureSuite !== 'Ed25519') throw new TypeError('approved signatureSuite is invalid');
    identifier(input.keyId, 'keyId');
    if (!options.allowUnsigned) canonicalBase64url(input.signature, 'signature', 64);
    else if (input.signature !== null) canonicalBase64url(input.signature, 'signature', 64);
  } else {
    if (input.providerId !== null || input.signatureSuite !== 'none' || input.keyId !== null || input.signature !== null) throw new TypeError('permissionless submission cannot claim provider authority');
    identifier(input.submitterId, 'submitterId');
  }
  return deepFreeze({
    submissionType: input.submissionType,
    registryVersion: identifier(input.registryVersion, 'registryVersion'),
    submissionId: identifier(input.submissionId, 'submissionId'),
    lane,
    providerId: lane === 'approved' ? input.providerId : null,
    submitterId: input.submitterId,
    providerEventId: identifier(input.providerEventId, 'providerEventId'),
    schemaId: identifier(input.schemaId, 'schemaId'),
    schemaVersion: identifier(input.schemaVersion, 'schemaVersion'),
    occurredAt: input.occurredAt,
    observedAt: input.observedAt,
    receivedAt: input.receivedAt,
    subjectCoordinates: normalizeCoordinates(input.subjectCoordinates),
    claimedActorEpochId: optionalIdentifier(input.claimedActorEpochId, 'claimedActorEpochId'),
    payloadVisibility,
    nativePayload,
    nativePayloadHash: hash(input.nativePayloadHash, 'nativePayloadHash'),
    proofRefs: normalizeStrings(input.proofRefs, 'proofRefs'),
    signatureSuite: input.signatureSuite,
    keyId: lane === 'approved' ? input.keyId : null,
    signature: lane === 'approved' ? input.signature : null,
    correctionOf: optionalIdentifier(input.correctionOf, 'correctionOf'),
    revocationOf: optionalIdentifier(input.revocationOf, 'revocationOf'),
    disputeOf: optionalIdentifier(input.disputeOf, 'disputeOf'),
  });
}

function signingProjection(submission) {
  const projected = {};
  for (const field of FIELDS) if (field !== 'signature' && field !== 'nativePayload') projected[field] = submission[field];
  return projected;
}

function buildSubmissionSigningBytes(input) {
  const submission = normalizeSubmission(input, { allowUnsigned: true });
  return canonicalStringify(signingProjection(submission));
}

function stateAt(provider, at) {
  return provider.stateEpochs.find((epoch) => {
    const from = timestamp(epoch.validFrom, 'provider state validFrom');
    const until = epoch.validUntil === null ? null : timestamp(epoch.validUntil, 'provider state validUntil');
    return from <= at && (until === null || at < until);
  })?.state || null;
}
function validAt(item, at) {
  const from = timestamp(item.validFrom, 'validFrom');
  const until = item.validUntil === null ? null : timestamp(item.validUntil, 'validUntil');
  const revoked = item.revokedAt === null || item.revokedAt === undefined ? null : timestamp(item.revokedAt, 'revokedAt');
  return from <= at && (until === null || at < until) && (revoked === null || at < revoked);
}
function ed25519PublicKey(raw) {
  const prefix = Buffer.from('302a300506032b6570032100', 'hex');
  return createPublicKey({ key: Buffer.concat([prefix, raw]), format: 'der', type: 'spki' });
}

function verifySubmission(registryInput, input) {
  const registryBundle = buildRegistryBundle(registryInput && registryInput.registry ? registryInput.registry : registryInput);
  if (registryInput && registryInput.registryHash !== undefined && registryInput.registryHash !== registryBundle.registryHash) throw new Error('supplied registry hash does not match canonical registry');
  const registry = registryBundle.registry;
  const submission = normalizeSubmission(input);
  if (submission.registryVersion !== registry.registryVersion) throw new Error('submission registryVersion does not match registry');
  if (timestamp(submission.receivedAt, 'receivedAt') > timestamp(registry.generatedAt, 'registry generatedAt')) throw new RangeError('submission was received after registry generation');
  const schema = registry.schemas.find((item) => item.schemaId === submission.schemaId && item.schemaVersion === submission.schemaVersion);
  if (!schema) throw new Error('submission references unauthorized schema');
  for (const coordinate of submission.subjectCoordinates) if (!schema.subjectCoordinateNamespaces.includes(coordinate.namespace)) throw new Error('submission coordinate namespace is not authorized by schema');
  const signingBytes = canonicalStringify(signingProjection(submission));
  const submissionHash = domainHash(SUBMISSION_HASH_DOMAIN, canonicalStringify(submission));
  const observed = timestamp(submission.observedAt, 'observedAt');
  let providerState = null;
  let eligibilityClass = 'quarantined';
  const reasons = [];

  if (submission.lane === 'approved') {
    const provider = registry.providers.find((item) => item.providerId === submission.providerId);
    if (!provider) throw new Error('submission provider is not registered');
    providerState = stateAt(provider, observed);
    if (providerState !== 'active' && providerState !== 'observation') throw new Error('provider was not authorized at observedAt');
    const authorization = provider.schemaAuthorizations.find((item) => item.schemaId === submission.schemaId && item.schemaVersion === submission.schemaVersion && validAt(item, observed));
    if (!authorization) throw new Error('provider schema authorization was not valid at observedAt');
    if (!provider.evidenceFamilies.includes(schema.evidenceFamily) || !provider.categories.includes(schema.category) || schema.allowedDomains.some((domain) => !provider.domains.includes(domain))) throw new Error('provider scope does not authorize schema');
    const key = provider.keyEpochs.find((item) => item.keyId === submission.keyId && validAt(item, observed));
    if (!key) throw new Error('provider signing key was not valid at observedAt');
    const rawKey = Buffer.from(key.publicKey, 'base64url');
    const signature = Buffer.from(submission.signature, 'base64url');
    const signedMessage = Buffer.concat([Buffer.from(SIGNATURE_DOMAIN, 'utf8'), Buffer.from(signingBytes, 'utf8')]);
    if (!verify(null, signedMessage, ed25519PublicKey(rawKey), signature)) throw new Error('submission signature is invalid');
    eligibilityClass = providerState === 'active' ? 'eligible-after-verification' : 'observation-only';
    if (providerState === 'observation') reasons.push('PROVIDER_OBSERVATION_ONLY');
  } else {
    reasons.push('PERMISSIONLESS_QUARANTINE');
  }

  const identity = resolveIdentity(registry, submission.subjectCoordinates, submission.occurredAt);
  if (submission.claimedActorEpochId !== null && submission.claimedActorEpochId !== identity.actorEpochId) {
    if (submission.lane === 'approved') throw new Error('claimed actor epoch does not match resolved identity');
    reasons.push('CLAIMED_EPOCH_MISMATCH');
  }
  if (identity.resolution !== 'resolved') {
    eligibilityClass = 'quarantined';
    for (const reason of identity.reasonCodes) if (!reasons.includes(reason)) reasons.push(reason);
  }
  reasons.sort(compareUtf8);
  return deepFreeze({
    submission,
    submissionHash,
    signingBytes,
    registryHash: registryBundle.registryHash,
    schema,
    providerState,
    identity,
    authorization: submission.lane === 'approved' ? 'authorized' : 'permissionless',
    lifecycleState: eligibilityClass === 'quarantined' ? 'QUARANTINED' : 'VERIFIED',
    eligibilityClass,
    reasonCodes: reasons,
  });
}

function verifySubmissionBatch(registryInput, inputs) {
  if (!Array.isArray(inputs) || inputs.length === 0) throw new TypeError('submission batch must be a nonempty array');
  const results = inputs.map((input) => verifySubmission(registryInput, input));
  results.sort((left, right) => compareUtf8(left.submission.submissionId, right.submission.submissionId));
  const submissionIds = new Set();
  const providerEvents = new Set();
  for (const result of results) {
    const id = result.submission.submissionId;
    if (submissionIds.has(id)) throw new Error('duplicate submissionId ' + id);
    submissionIds.add(id);
    const event = (result.submission.providerId || result.submission.submitterId) + '\0' + result.submission.providerEventId;
    if (providerEvents.has(event)) throw new Error('duplicate provider event ' + result.submission.providerEventId);
    providerEvents.add(event);
  }
  return deepFreeze(results);
}

module.exports = Object.freeze({
  SUBMISSION_TYPE,
  SIGNATURE_DOMAIN,
  SUBMISSION_HASH_DOMAIN,
  PAYLOAD_HASH_DOMAIN,
  MAX_RECEIPT_DELAY_MS,
  buildNativePayloadHash,
  buildSubmissionSigningBytes,
  verifySubmission,
  verifySubmissionBatch,
});
