'use strict';

const { createHash } = require('node:crypto');
const { canonicalStringify } = require('../cred-shadow/artifact');
const { CANDIDATE_PARAMETERS } = require('../cred-shadow/parameters');

const REGISTRY_TYPE = 'cred-evidence-registry-v1';
const CANONICAL_SERIALIZATION_VERSION = 'cred-cjson-v1';
const REGISTRY_HASH_DOMAIN = 'CRED-EVIDENCE-REGISTRY-v1\0';
const ONTOLOGY_HASH_DOMAIN = 'CRED-EVIDENCE-ONTOLOGY-v1\0';
const EMP_LEAF_DOMAIN = 'CRED-EMP-LEAF-v1\0';
const EMP_NODE_DOMAIN = 'CRED-EMP-NODE-v1\0';
const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const INTEGER_STRING_PATTERN = /^(0|[1-9]\d*)$/u;
const IDENTIFIER_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}._:-]{0,127}$/u;

const REGISTRY_FIELDS = Object.freeze(['registryType','canonicalSerializationVersion','registryVersion','generatedAt','previousRegistryHash','versions','roots','providers','schemas','identityIssuers','subjects','identityEdges','actorEpochs','empPolicies','ontology']);
const PROVIDER_FIELDS = Object.freeze(['providerId','controlGroupId','state','stateEpochs','keyEpochs','schemaAuthorizations','evidenceFamilies','categories','domains','ratePolicy','volumePolicy','influencePolicyRef']);
const STATE_EPOCH_FIELDS = Object.freeze(['state','validFrom','validUntil']);
const KEY_EPOCH_FIELDS = Object.freeze(['keyId','suite','publicKey','validFrom','validUntil','revokedAt']);
const AUTHORIZATION_FIELDS = Object.freeze(['schemaId','schemaVersion','validFrom','validUntil']);
const SCHEMA_FIELDS = Object.freeze(['schemaId','schemaVersion','schemaFamilyId','adapterId','adapterVersion','eventType','evidenceFamily','category','allowedDirections','allowedProofClasses','materialityMapping','privacyClass','correctionPolicy','finalityPolicy','empId','empVersion','subjectCoordinateNamespaces','allowedDomains']);
const ISSUER_FIELDS = Object.freeze(['issuerId','state','validFrom','validUntil','authorizedCoordinateNamespaces','authorizedRelationshipTypes']);
const SUBJECT_FIELDS = Object.freeze(['subjectId','state','currentActorEpochId','coordinates']);
const EDGE_FIELDS = Object.freeze(['edgeId','issuerId','subjectId','coordinate','relationshipType','validFrom','validUntil','verifiedAt','revokedAt','proofHash']);
const EPOCH_FIELDS = Object.freeze(['actorEpochId','subjectId','startsAt','endsAt','controllerCoordinates','transitionHash','encumbrance','assumptionOf']);
const COORDINATE_FIELDS = Object.freeze(['namespace','network','value']);
const EMP_FIELDS = Object.freeze(['empId','empVersion','policyHash','registryLeafIndex','registryProof','evidenceFamily','positiveHalfLifeDays','negativeHalfLifeDays','correlationWindowSeconds','clusterCapMicroEu','providerBucket','schemaBucket','p4Bucket']);
const ONTOLOGY_FIELDS = Object.freeze(['ontologyId','ontologyVersion','ontologyHash','categories','evidenceFamilies','domains','coordinateNamespaces','relationshipTypes']);

const PROVIDER_STATES = new Set(['observation','active','suspended','revoked']);
const ISSUER_STATES = new Set(['active','suspended','revoked']);
const SUBJECT_STATES = new Set(['active','suspended','retired']);
const CATEGORIES = new Set(['operational','financial','onchain','identity']);
const EVIDENCE_FAMILIES = new Set(['operational','financial','onchain','identity','severe-critical','comparative']);
const DIRECTIONS = new Set(['positive','negative']);
const PROOF_CLASSES = new Set(['P1','P2','P3','P4']);
const MATERIALITIES = new Set(['micro','standard','meaningful','substantial','major']);
const ENCUMBRANCES = new Set(['clear','encumbered','transfer-pending','conflict']);
const COORDINATE_NAMESPACES = new Set(['erc8004','looper','evm','solana','did','ubid','platform','endpoint']);
const MAX_HALF_LIVES = Object.freeze({
  operational: { positive: 90, negative: 180 },
  financial: { positive: 365, negative: 730 },
  onchain: { positive: 365, negative: 730 },
  identity: { positive: 365, negative: 730 },
  'severe-critical': { positive: null, negative: 1_460 },
  comparative: { positive: 30, negative: 30 },
});

function deepFreeze(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

function plain(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError(label + ' must be a plain object');
  }
  return value;
}

function exact(value, fields, label) {
  plain(value, label);
  const allowed = new Set(fields);
  const keys = Reflect.ownKeys(value);
  for (const key of keys) {
    if (typeof key !== 'string' || !allowed.has(key)) throw new TypeError(label + ' has unknown field ' + String(key));
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) throw new TypeError(label + ' fields must be enumerable data properties');
  }
  for (const field of fields) if (!Object.hasOwn(value, field)) throw new TypeError(label + ' is missing field ' + field);
}

function string(value, label, max = 512) {
  if (typeof value !== 'string' || value.length === 0 || value.length > max || value.normalize('NFC') !== value || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new TypeError(label + ' must be a canonical nonempty string');
  }
  return value;
}

function identifier(value, label) {
  if (typeof value !== 'string' || value.normalize('NFC') !== value || !IDENTIFIER_PATTERN.test(value)) throw new TypeError(label + ' must be a canonical identifier');
  return value;
}

function choice(value, allowed, label) {
  if (!allowed.has(value)) throw new TypeError(label + ' is invalid');
  return value;
}

function boolean(value, label) {
  if (typeof value !== 'boolean') throw new TypeError(label + ' must be boolean');
  return value;
}

function integer(value, label, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) throw new TypeError(label + ' must be an integer in range');
  return value;
}

function integerString(value, label, minimum = 0n) {
  if (typeof value !== 'string' || !INTEGER_STRING_PATTERN.test(value)) throw new TypeError(label + ' must be a canonical nonnegative integer string');
  const parsed = BigInt(value);
  if (parsed < minimum) throw new RangeError(label + ' is below minimum');
  return parsed.toString();
}

function hash(value, label) {
  if (typeof value !== 'string' || !HASH_PATTERN.test(value)) throw new TypeError(label + ' must be a canonical sha256 hash');
  return value;
}

function optionalHash(value, label) {
  return value === null ? null : hash(value, label);
}

function timestamp(value, label) {
  if (typeof value !== 'string' || !ISO_PATTERN.test(value)) throw new TypeError(label + ' timestamp must be canonical ISO-8601 UTC');
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) throw new TypeError(label + ' timestamp must be canonical ISO-8601 UTC');
  return milliseconds;
}

function optionalTimestamp(value, label) {
  return value === null ? null : timestamp(value, label);
}

function hashBytes(domain, bytes) {
  return 'sha256:' + createHash('sha256').update(domain, 'utf8').update(bytes, 'utf8').digest('hex');
}

function sortedUnique(values, label, validate, key = value => value) {
  if (!Array.isArray(values)) throw new TypeError(label + ' must be an array');
  const normalized = values.map((value, index) => validate(value, label + '[' + index + ']'));
  normalized.sort((left, right) => compareUtf8(key(left), key(right)));
  for (let index = 1; index < normalized.length; index += 1) {
    if (key(normalized[index - 1]) === key(normalized[index])) throw new Error(label + ' contains a duplicate ' + key(normalized[index]));
  }
  return normalized;
}

function sortedStrings(values, label, validate = value => string(value, label + ' item')) {
  return sortedUnique(values, label, value => validate(value), value => value);
}

function validateWindow(input, label) {
  exact(input, ['windowSeconds','maxEvents'], label);
  return {
    windowSeconds: integerString(input.windowSeconds, label + '.windowSeconds', 1n),
    maxEvents: integerString(input.maxEvents, label + '.maxEvents', 1n),
  };
}

function validateInterval(startValue, endValue, label) {
  const start = timestamp(startValue, label + '.start');
  const end = optionalTimestamp(endValue, label + '.end');
  if (end !== null && end <= start) throw new RangeError(label + ' end must be after start');
  return { start, end };
}

function decodeCanonicalBase64url(value, label, byteLength) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/u.test(value)) throw new TypeError(label + ' must be canonical base64url');
  const bytes = Buffer.from(value, 'base64url');
  if (bytes.length !== byteLength || bytes.toString('base64url') !== value) throw new TypeError(label + ' must be canonical base64url with ' + byteLength + ' bytes');
  return value;
}

function validateCoordinate(input, label = 'coordinate') {
  exact(input, COORDINATE_FIELDS, label);
  const namespace = choice(input.namespace, COORDINATE_NAMESPACES, label + '.namespace');
  const network = string(input.network, label + '.network', 128);
  const value = string(input.value, label + '.value', 512);
  if (namespace === 'evm') {
    if (!/^eip155:(0|[1-9]\d*)$/u.test(network) || !/^0x[0-9a-f]{40}$/u.test(value)) throw new TypeError(label + ' EVM coordinate is not canonical');
  } else if (namespace === 'erc8004') {
    if (!/^eip155:(0|[1-9]\d*)$/u.test(network) || !/^(0|[1-9]\d*)$/u.test(value)) throw new TypeError(label + ' ERC-8004 coordinate is not canonical');
  } else if (namespace === 'looper') {
    if (!/^eip155:(0|[1-9]\d*)$/u.test(network) || !/^0x[0-9a-f]{40}\/(0|[1-9]\d*)$/u.test(value)) throw new TypeError(label + ' Looper coordinate is not canonical');
  } else if (namespace === 'solana') {
    if (!/^solana:[a-z0-9-]{1,32}$/u.test(network) || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/u.test(value)) throw new TypeError(label + ' Solana coordinate is not canonical');
  } else if (namespace === 'did') {
    if (network !== 'global' || !/^did:[a-z0-9]+:[A-Za-z0-9._:%-]+$/u.test(value)) throw new TypeError(label + ' DID coordinate is not canonical');
  } else if (namespace === 'endpoint') {
    let parsed;
    try { parsed = new URL(value); } catch { throw new TypeError(label + ' endpoint coordinate is not canonical'); }
    if (network !== 'https' || parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hash || parsed.toString() !== value) throw new TypeError(label + ' endpoint coordinate is not canonical');
  } else if (!/^[a-z0-9][a-z0-9._:-]{0,127}$/u.test(network) || !/^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/u.test(value)) {
    throw new TypeError(label + ' coordinate is not canonical');
  }
  return { namespace, network, value };
}


function coordinateKey(coordinate) {
  return coordinate.namespace + '\0' + coordinate.network + '\0' + coordinate.value;
}

function validateKeyEpoch(input, label) {
  exact(input, KEY_EPOCH_FIELDS, label);
  const interval = validateInterval(input.validFrom, input.validUntil, label + ' key epoch');
  const revokedAt = optionalTimestamp(input.revokedAt, label + '.revokedAt');
  if (revokedAt !== null && (revokedAt < interval.start || (interval.end !== null && revokedAt > interval.end))) {
    throw new RangeError(label + ' key epoch revokedAt is outside validity');
  }
  if (input.suite !== 'Ed25519') throw new TypeError(label + '.suite is invalid');
  return {
    keyId: identifier(input.keyId, label + '.keyId'),
    suite: input.suite,
    publicKey: decodeCanonicalBase64url(input.publicKey, label + '.publicKey', 32),
    validFrom: input.validFrom,
    validUntil: input.validUntil,
    revokedAt: input.revokedAt,
  };
}

function validateAuthorization(input, label) {
  exact(input, AUTHORIZATION_FIELDS, label);
  validateInterval(input.validFrom, input.validUntil, label + ' authorization');
  return {
    schemaId: identifier(input.schemaId, label + '.schemaId'),
    schemaVersion: identifier(input.schemaVersion, label + '.schemaVersion'),
    validFrom: input.validFrom,
    validUntil: input.validUntil,
  };
}

function validateProviderStateEpoch(input, label) {
  exact(input, STATE_EPOCH_FIELDS, label);
  validateInterval(input.validFrom, input.validUntil, label);
  return { state: choice(input.state, PROVIDER_STATES, label + '.state'), validFrom: input.validFrom, validUntil: input.validUntil };
}

function validateProvider(input, label, generatedAt) {
  exact(input, PROVIDER_FIELDS, label);
  const state = choice(input.state, PROVIDER_STATES, label + '.state');
  if (!Array.isArray(input.stateEpochs)) throw new TypeError(label + '.stateEpochs must be an array');
  const stateEpochs = input.stateEpochs.map((item, index) => validateProviderStateEpoch(item, label + '.stateEpochs[' + index + ']'))
    .sort((left, right) => compareUtf8(left.validFrom, right.validFrom));
  if (stateEpochs.length === 0) throw new TypeError(label + ' must contain a provider state epoch');
  for (let index = 0; index < stateEpochs.length; index += 1) {
    const epoch = stateEpochs[index];
    if (index > 0 && stateEpochs[index - 1].validUntil !== epoch.validFrom) throw new Error(label + ' provider state epochs must be contiguous and non-overlapping');
    if (index < stateEpochs.length - 1 && epoch.validUntil === null) throw new Error(label + ' only the current provider state epoch may be open');
  }
  const currentStateEpoch = stateEpochs.at(-1);
  if (currentStateEpoch.validUntil !== null || currentStateEpoch.state !== state || timestamp(currentStateEpoch.validFrom, label + ' current state validFrom') > generatedAt) {
    throw new Error(label + ' current provider state does not match state epochs');
  }
  const providerStart = timestamp(stateEpochs[0].validFrom, label + ' first state validFrom');
  const keyEpochs = sortedUnique(input.keyEpochs, label + '.keyEpochs', validateKeyEpoch, item => item.keyId);
  if (keyEpochs.length === 0) throw new TypeError(label + ' must contain a key epoch');
  if ((state === 'active' || state === 'observation') && !keyEpochs.some(item => {
    const from = timestamp(item.validFrom, 'key validFrom');
    const until = item.validUntil === null ? null : timestamp(item.validUntil, 'key validUntil');
    const revoked = item.revokedAt === null ? null : timestamp(item.revokedAt, 'key revokedAt');
    return from <= generatedAt && (until === null || generatedAt < until) && (revoked === null || generatedAt < revoked);
  })) throw new Error(label + ' has no current provider key epoch');
  const schemaAuthorizations = sortedUnique(input.schemaAuthorizations, label + '.schemaAuthorizations', validateAuthorization, item => item.schemaId + '\0' + item.schemaVersion + '\0' + item.validFrom);
  const authorizationEnds = new Map();
  for (const authorization of schemaAuthorizations) {
    const key = authorization.schemaId + '\0' + authorization.schemaVersion;
    const previousEnd = authorizationEnds.get(key);
    const start = timestamp(authorization.validFrom, 'authorization validFrom');
    if (previousEnd !== undefined && (previousEnd === null || start < previousEnd)) throw new Error(label + ' schema authorization epochs overlap');
    authorizationEnds.set(key, authorization.validUntil === null ? null : timestamp(authorization.validUntil, 'authorization validUntil'));
  }
  if ((state === 'active' || state === 'observation') && schemaAuthorizations.length === 0) throw new TypeError(label + ' must authorize a schema');
  for (const authorization of schemaAuthorizations) {
    if (timestamp(authorization.validFrom, 'authorization validFrom') < providerStart) throw new RangeError(label + ' schema authorization predates provider lifecycle');
  }
  if ((state === 'active' || state === 'observation') && !schemaAuthorizations.some(item => {
    const from = timestamp(item.validFrom, 'authorization validFrom');
    const until = item.validUntil === null ? null : timestamp(item.validUntil, 'authorization validUntil');
    return from <= generatedAt && (until === null || generatedAt < until);
  })) throw new Error(label + ' has no current schema authorization');
  return {
    providerId: identifier(input.providerId, label + '.providerId'),
    controlGroupId: identifier(input.controlGroupId, label + '.controlGroupId'),
    state,
    stateEpochs,
    keyEpochs,
    schemaAuthorizations,
    evidenceFamilies: sortedStrings(input.evidenceFamilies, label + '.evidenceFamilies', value => choice(value, EVIDENCE_FAMILIES, label + '.evidenceFamilies item')),
    categories: sortedStrings(input.categories, label + '.categories', value => choice(value, CATEGORIES, label + '.categories item')),
    domains: sortedStrings(input.domains, label + '.domains', value => identifier(value, label + '.domains item')),
    ratePolicy: validateWindow(input.ratePolicy, label + '.ratePolicy'),
    volumePolicy: validateWindow(input.volumePolicy, label + '.volumePolicy'),
    influencePolicyRef: identifier(input.influencePolicyRef, label + '.influencePolicyRef'),
  };
}

function validateMaterialityMapping(input, label) {
  exact(input, ['nativeValue','materiality'], label);
  return { nativeValue: string(input.nativeValue, label + '.nativeValue', 128), materiality: choice(input.materiality, MATERIALITIES, label + '.materiality') };
}

function validateSchema(input, label) {
  exact(input, SCHEMA_FIELDS, label);
  const materialityMapping = sortedUnique(input.materialityMapping, label + '.materialityMapping', validateMaterialityMapping, item => item.nativeValue);
  if (materialityMapping.length === 0) throw new TypeError(label + ' requires materiality mapping');
  const directions = sortedStrings(input.allowedDirections, label + '.allowedDirections', value => choice(value, DIRECTIONS, label + '.allowedDirections item'));
  const proofClasses = sortedStrings(input.allowedProofClasses, label + '.allowedProofClasses', value => choice(value, PROOF_CLASSES, label + '.allowedProofClasses item'));
  if (directions.length === 0 || proofClasses.length === 0) throw new TypeError(label + ' requires direction and proof policies');
  return {
    schemaId: identifier(input.schemaId, label + '.schemaId'), schemaVersion: identifier(input.schemaVersion, label + '.schemaVersion'),
    schemaFamilyId: identifier(input.schemaFamilyId, label + '.schemaFamilyId'), adapterId: identifier(input.adapterId, label + '.adapterId'),
    adapterVersion: identifier(input.adapterVersion, label + '.adapterVersion'), eventType: identifier(input.eventType, label + '.eventType'),
    evidenceFamily: choice(input.evidenceFamily, EVIDENCE_FAMILIES, label + '.evidenceFamily'), category: choice(input.category, CATEGORIES, label + '.category'),
    allowedDirections: directions, allowedProofClasses: proofClasses, materialityMapping,
    privacyClass: identifier(input.privacyClass, label + '.privacyClass'), correctionPolicy: identifier(input.correctionPolicy, label + '.correctionPolicy'),
    finalityPolicy: identifier(input.finalityPolicy, label + '.finalityPolicy'), empId: identifier(input.empId, label + '.empId'),
    empVersion: identifier(input.empVersion, label + '.empVersion'),
    subjectCoordinateNamespaces: sortedStrings(input.subjectCoordinateNamespaces, label + '.subjectCoordinateNamespaces', value => identifier(value, label + '.subjectCoordinateNamespaces item')),
    allowedDomains: sortedStrings(input.allowedDomains, label + '.allowedDomains', value => identifier(value, label + '.allowedDomains item')),
  };
}

function validateIssuer(input, label, generatedAt) {
  exact(input, ISSUER_FIELDS, label);
  const interval = validateInterval(input.validFrom, input.validUntil, label + ' issuer');
  if (interval.start > generatedAt) throw new RangeError(label + ' issuer authority is not yet valid');
  const state = choice(input.state, ISSUER_STATES, label + '.state');
  if (state === 'active' && interval.end !== null && interval.end <= generatedAt) throw new Error(label + ' active issuer authority has expired');
  if (state !== 'active' && (interval.end === null || interval.end > generatedAt)) throw new Error(label + ' inactive issuer authority requires a closed validity interval');
  const namespaces = sortedStrings(input.authorizedCoordinateNamespaces, label + '.authorizedCoordinateNamespaces', value => identifier(value, label + ' namespace'));
  const relationships = sortedStrings(input.authorizedRelationshipTypes, label + '.authorizedRelationshipTypes', value => identifier(value, label + ' relationship'));
  if (namespaces.length === 0 || relationships.length === 0) throw new TypeError(label + ' issuer authority must be nonempty');
  return { issuerId: identifier(input.issuerId, label + '.issuerId'), state, validFrom: input.validFrom, validUntil: input.validUntil, authorizedCoordinateNamespaces: namespaces, authorizedRelationshipTypes: relationships };
}

function validateSubject(input, label) {
  exact(input, SUBJECT_FIELDS, label);
  const coordinates = sortedUnique(input.coordinates, label + '.coordinates', validateCoordinate, coordinateKey);
  if (coordinates.length === 0) throw new TypeError(label + ' requires a subject coordinate');
  return { subjectId: identifier(input.subjectId, label + '.subjectId'), state: choice(input.state, SUBJECT_STATES, label + '.state'), currentActorEpochId: identifier(input.currentActorEpochId, label + '.currentActorEpochId'), coordinates };
}

function validateEdge(input, label, generatedAt) {
  exact(input, EDGE_FIELDS, label);
  const interval = validateInterval(input.validFrom, input.validUntil, label + ' relationship');
  const verifiedAt = timestamp(input.verifiedAt, label + '.verifiedAt');
  if (verifiedAt > generatedAt) throw new RangeError(label + ' relationship verification is in the future');
  if (verifiedAt < interval.start || (interval.end !== null && verifiedAt > interval.end)) throw new RangeError(label + ' relationship verification is outside validity');
  const revokedAt = optionalTimestamp(input.revokedAt, label + '.revokedAt');
  if (revokedAt !== null && (revokedAt < interval.start || revokedAt > generatedAt || (interval.end !== null && revokedAt > interval.end))) throw new RangeError(label + ' relationship revokedAt is invalid');
  return { edgeId: identifier(input.edgeId, label + '.edgeId'), issuerId: identifier(input.issuerId, label + '.issuerId'), subjectId: identifier(input.subjectId, label + '.subjectId'), coordinate: validateCoordinate(input.coordinate, label + '.coordinate'), relationshipType: identifier(input.relationshipType, label + '.relationshipType'), validFrom: input.validFrom, validUntil: input.validUntil, verifiedAt: input.verifiedAt, revokedAt: input.revokedAt, proofHash: hash(input.proofHash, label + '.proofHash') };
}

function validateEpoch(input, label, generatedAt) {
  exact(input, EPOCH_FIELDS, label);
  const interval = validateInterval(input.startsAt, input.endsAt, label + ' actor epoch');
  if (interval.start > generatedAt) throw new RangeError(label + ' actor epoch starts in the future');
  const controllers = sortedUnique(input.controllerCoordinates, label + '.controllerCoordinates', validateCoordinate, coordinateKey);
  if (controllers.length === 0) throw new TypeError(label + ' requires a controller coordinate');
  return { actorEpochId: identifier(input.actorEpochId, label + '.actorEpochId'), subjectId: identifier(input.subjectId, label + '.subjectId'), startsAt: input.startsAt, endsAt: input.endsAt, controllerCoordinates: controllers, transitionHash: optionalHash(input.transitionHash, label + '.transitionHash'), encumbrance: choice(input.encumbrance, ENCUMBRANCES, label + '.encumbrance'), assumptionOf: input.assumptionOf === null ? null : identifier(input.assumptionOf, label + '.assumptionOf') };
}

function validateBucket(input, label, defaults) {
  exact(input, ['capacityMicroEu','refillSeconds'], label);
  const capacityMicroEu = integerString(input.capacityMicroEu, label + '.capacityMicroEu', 1n);
  if (BigInt(capacityMicroEu) > defaults.capacity) throw new RangeError(label + ' capacity exceeds methodology maximum');
  const refillSeconds = integer(input.refillSeconds, label + '.refillSeconds', Number(defaults.refillPeriodSeconds));
  return { capacityMicroEu, refillSeconds };
}

function validateRegistryProof(input, label) {
  if (!Array.isArray(input)) throw new TypeError(label + ' must be an array');
  return input.map((entry, index) => {
    const entryLabel = label + '[' + index + ']';
    exact(entry, ['side','hash'], entryLabel);
    if (entry.side !== 'left' && entry.side !== 'right') throw new TypeError(entryLabel + '.side is invalid');
    return { side: entry.side, hash: hash(entry.hash, entryLabel + '.hash') };
  });
}


function empPolicyFields(policy) {
  return [policy.empId,policy.empVersion,policy.evidenceFamily,policy.positiveHalfLifeDays,policy.negativeHalfLifeDays,policy.correlationWindowSeconds,policy.clusterCapMicroEu,policy.providerBucket.capacityMicroEu,policy.providerBucket.refillSeconds,policy.schemaBucket.capacityMicroEu,policy.schemaBucket.refillSeconds,policy.p4Bucket.capacityMicroEu,policy.p4Bucket.refillSeconds];
}

function computeEmpPolicyHash(policy) {
  return hashBytes(EMP_LEAF_DOMAIN, JSON.stringify(empPolicyFields(policy)));
}

function validateEmpPolicy(input, label) {
  exact(input, EMP_FIELDS, label);
  const evidenceFamily = choice(input.evidenceFamily, EVIDENCE_FAMILIES, label + '.evidenceFamily');
  const maximum = MAX_HALF_LIVES[evidenceFamily];
  let positive;
  if (maximum.positive === null) {
    if (input.positiveHalfLifeDays !== null) throw new RangeError(label + '.positiveHalfLifeDays must be null');
    positive = null;
  } else {
    positive = integer(input.positiveHalfLifeDays, label + '.positiveHalfLifeDays', 1);
    if (positive > maximum.positive) throw new RangeError(label + '.positiveHalfLifeDays exceeds methodology maximum');
  }
  const negative = integer(input.negativeHalfLifeDays, label + '.negativeHalfLifeDays', 1);
  if (negative > maximum.negative) throw new RangeError(label + '.negativeHalfLifeDays exceeds methodology maximum');
  const correlationWindowSeconds = integer(input.correlationWindowSeconds, label + '.correlationWindowSeconds', Number(CANDIDATE_PARAMETERS.tokenBuckets.providerControlGroup.refillPeriodSeconds));
  const clusterCapMicroEu = integerString(input.clusterCapMicroEu, label + '.clusterCapMicroEu', 1n);
  if (BigInt(clusterCapMicroEu) > CANDIDATE_PARAMETERS.correlationClusterMassCap) throw new RangeError(label + '.clusterCapMicroEu exceeds methodology maximum');
  const normalized = {
    empId: identifier(input.empId, label + '.empId'), empVersion: identifier(input.empVersion, label + '.empVersion'),
    policyHash: hash(input.policyHash, label + '.policyHash'), registryLeafIndex: integer(input.registryLeafIndex, label + '.registryLeafIndex'),
    registryProof: validateRegistryProof(input.registryProof, label + '.registryProof'),
    evidenceFamily, positiveHalfLifeDays: positive,
    negativeHalfLifeDays: negative, correlationWindowSeconds,
    clusterCapMicroEu,
    providerBucket: validateBucket(input.providerBucket, label + '.providerBucket', CANDIDATE_PARAMETERS.tokenBuckets.providerControlGroup),
    schemaBucket: validateBucket(input.schemaBucket, label + '.schemaBucket', CANDIDATE_PARAMETERS.tokenBuckets.schemaFamily),
    p4Bucket: validateBucket(input.p4Bucket, label + '.p4Bucket', CANDIDATE_PARAMETERS.tokenBuckets.P4),
  };
  if (computeEmpPolicyHash(normalized) !== normalized.policyHash) throw new Error(label + ' policyHash does not match canonical EMP policy');
  return normalized;
}

function verifyEmpRoot(policy, root, label) {
  let current = Buffer.from(policy.policyHash.slice(7), 'hex');
  let index = policy.registryLeafIndex;
  for (const entry of policy.registryProof) {
    const expected = index % 2 === 0 ? 'right' : 'left';
    if (entry.side !== expected) throw new Error(label + ' EMP proof orientation is invalid');
    const sibling = Buffer.from(entry.hash.slice(7), 'hex');
    current = createHash('sha256').update(EMP_NODE_DOMAIN, 'utf8').update(entry.side === 'left' ? Buffer.concat([sibling,current]) : Buffer.concat([current,sibling])).digest();
    index = Math.floor(index / 2);
  }
  if ('sha256:' + current.toString('hex') !== root) throw new Error(label + ' does not match EMP registry root');
}

function ontologyProjection(ontology) {
  return { ontologyId: ontology.ontologyId, ontologyVersion: ontology.ontologyVersion, categories: ontology.categories, evidenceFamilies: ontology.evidenceFamilies, domains: ontology.domains, coordinateNamespaces: ontology.coordinateNamespaces, relationshipTypes: ontology.relationshipTypes };
}

function computeOntologyHash(ontology) {
  return hashBytes(ONTOLOGY_HASH_DOMAIN, canonicalStringify(ontologyProjection(ontology)));
}

function validateOntology(input) {
  exact(input, ONTOLOGY_FIELDS, 'ontology');
  const ontology = {
    ontologyId: identifier(input.ontologyId, 'ontology.ontologyId'), ontologyVersion: identifier(input.ontologyVersion, 'ontology.ontologyVersion'), ontologyHash: hash(input.ontologyHash, 'ontology.ontologyHash'),
    categories: sortedStrings(input.categories, 'ontology.categories', value => choice(value, CATEGORIES, 'ontology category')),
    evidenceFamilies: sortedStrings(input.evidenceFamilies, 'ontology.evidenceFamilies', value => choice(value, EVIDENCE_FAMILIES, 'ontology evidenceFamily')),
    domains: sortedStrings(input.domains, 'ontology.domains', value => identifier(value, 'ontology domain')),
    coordinateNamespaces: sortedStrings(input.coordinateNamespaces, 'ontology.coordinateNamespaces', value => identifier(value, 'ontology coordinate namespace')),
    relationshipTypes: sortedStrings(input.relationshipTypes, 'ontology.relationshipTypes', value => identifier(value, 'ontology relationship type')),
  };
  if (computeOntologyHash(ontology) !== ontology.ontologyHash) throw new Error('ontology hash does not match canonical ontology');
  return ontology;
}

function mapBy(values, key, label) {
  const result = new Map();
  for (const value of values) {
    const id = key(value);
    if (result.has(id)) throw new Error('duplicate ' + label + ' ' + id);
    result.set(id, value);
  }
  return result;
}

function assertReferences(registry, generatedAt) {
  const schemas = mapBy(registry.schemas, item => item.schemaId + '\0' + item.schemaVersion, 'schema');
  const empPolicies = mapBy(registry.empPolicies, item => item.empId + '\0' + item.empVersion, 'EMP policy');
  const issuers = mapBy(registry.identityIssuers, item => item.issuerId, 'identity issuer');
  const subjects = mapBy(registry.subjects, item => item.subjectId, 'subject');
  const epochs = mapBy(registry.actorEpochs, item => item.actorEpochId, 'actor epoch');
  const ontology = registry.ontology;
  const ontologySets = {
    category: new Set(ontology.categories), family: new Set(ontology.evidenceFamilies), domain: new Set(ontology.domains),
    namespace: new Set(ontology.coordinateNamespaces), relationship: new Set(ontology.relationshipTypes),
  };

  for (const schema of registry.schemas) {
    const emp = empPolicies.get(schema.empId + '\0' + schema.empVersion);
    if (!emp) throw new Error('schema references unknown EMP policy');
    if (emp.evidenceFamily !== schema.evidenceFamily) throw new Error('schema EMP evidenceFamily does not match');
    if (!ontologySets.category.has(schema.category) || !ontologySets.family.has(schema.evidenceFamily)) throw new Error('schema is outside pinned ontology');
    for (const domain of schema.allowedDomains) if (!ontologySets.domain.has(domain)) throw new Error('schema has unknown ontology domain');
    for (const namespace of schema.subjectCoordinateNamespaces) if (!ontologySets.namespace.has(namespace)) throw new Error('schema has unknown ontology coordinate namespace');
  }

  for (const provider of registry.providers) {
    for (const authorization of provider.schemaAuthorizations) {
      const schema = schemas.get(authorization.schemaId + '\0' + authorization.schemaVersion);
      if (!schema) throw new Error('provider references unknown schema');
      if (!provider.evidenceFamilies.includes(schema.evidenceFamily)) throw new Error('provider lacks authorized evidence family');
      if (!provider.categories.includes(schema.category)) throw new Error('provider lacks authorized category');
      for (const domain of schema.allowedDomains) if (!provider.domains.includes(domain)) throw new Error('provider lacks authorized domain ' + domain);
    }
    for (const family of provider.evidenceFamilies) if (!ontologySets.family.has(family)) throw new Error('provider has unknown ontology evidence family');
    for (const category of provider.categories) if (!ontologySets.category.has(category)) throw new Error('provider has unknown ontology category');
    for (const domain of provider.domains) if (!ontologySets.domain.has(domain)) throw new Error('provider has unknown ontology domain');
  }

  for (const issuer of registry.identityIssuers) {
    for (const namespace of issuer.authorizedCoordinateNamespaces) if (!ontologySets.namespace.has(namespace)) throw new Error('issuer has unknown ontology namespace');
    for (const relationship of issuer.authorizedRelationshipTypes) if (!ontologySets.relationship.has(relationship)) throw new Error('issuer has unknown ontology relationship');
  }
  for (const subject of registry.subjects) for (const coordinate of subject.coordinates) if (!ontologySets.namespace.has(coordinate.namespace)) throw new Error('subject coordinate is outside pinned ontology');

  for (const edge of registry.identityEdges) {
    const issuer = issuers.get(edge.issuerId);
    const subject = subjects.get(edge.subjectId);
    if (!issuer) throw new Error('identity edge references unknown issuer');
    if (!subject) throw new Error('identity edge references unknown subject');
    if (!issuer.authorizedCoordinateNamespaces.includes(edge.coordinate.namespace)) throw new Error('identity edge coordinate namespace is not authorized');
    if (!issuer.authorizedRelationshipTypes.includes(edge.relationshipType)) throw new Error('identity edge relationship is not authorized');
    if (!subject.coordinates.some(item => coordinateKey(item) === coordinateKey(edge.coordinate))) throw new Error('identity edge does not reference a subject coordinate');
    const edgeStart = timestamp(edge.validFrom, 'edge validFrom');
    const edgeEnd = edge.validUntil === null ? null : timestamp(edge.validUntil, 'edge validUntil');
    const issuerStart = timestamp(issuer.validFrom, 'issuer validFrom');
    const issuerEnd = issuer.validUntil === null ? null : timestamp(issuer.validUntil, 'issuer validUntil');
    if (edgeStart < issuerStart || (issuerEnd !== null && (edgeEnd === null || edgeEnd > issuerEnd))) throw new Error('identity edge exceeds issuer authority validity');
  }

  const epochsBySubject = new Map();
  for (const epoch of registry.actorEpochs) {
    if (!subjects.has(epoch.subjectId)) throw new Error('actor epoch references unknown subject');
    if (epoch.assumptionOf !== null && !epochs.has(epoch.assumptionOf)) throw new Error('actor epoch assumptionOf references unknown epoch');
    if (epoch.assumptionOf === epoch.actorEpochId) throw new Error('actor epoch cannot assume itself');
    const list = epochsBySubject.get(epoch.subjectId) || [];
    list.push(epoch);
    epochsBySubject.set(epoch.subjectId, list);
  }
  for (const subject of registry.subjects) {
    const subjectEpochs = epochsBySubject.get(subject.subjectId) || [];
    if (subjectEpochs.length === 0) throw new Error('subject has no actor epoch');
    subjectEpochs.sort((a, b) => compareUtf8(a.startsAt, b.startsAt) || compareUtf8(a.actorEpochId, b.actorEpochId));
    for (let index = 0; index < subjectEpochs.length; index += 1) {
      const epoch = subjectEpochs[index];
      if (index === 0 && epoch.transitionHash !== null) throw new Error('first actor epoch transitionHash must be null');
      if (index > 0 && epoch.transitionHash === null) throw new Error('later actor epoch requires transitionHash');
      if (index > 0) {
        const previous = subjectEpochs[index - 1];
        if (previous.endsAt === null || timestamp(previous.endsAt, 'actor epoch end') > timestamp(epoch.startsAt, 'actor epoch start')) throw new Error('actor epoch overlap');
        if (previous.endsAt !== epoch.startsAt) throw new Error('actor epoch gap');
      }
    }
    const current = subjectEpochs[subjectEpochs.length - 1];
    if (current.endsAt !== null || current.actorEpochId !== subject.currentActorEpochId || !epochs.has(subject.currentActorEpochId)) throw new Error('subject current actor epoch is invalid');
    if (timestamp(current.startsAt, 'current actor epoch start') > generatedAt) throw new Error('subject current actor epoch is not yet active');
  }
}

function normalizeRegistry(input) {
  exact(input, REGISTRY_FIELDS, 'registry');
  if (input.registryType !== REGISTRY_TYPE) throw new TypeError('registryType is invalid');
  if (input.canonicalSerializationVersion !== CANONICAL_SERIALIZATION_VERSION) throw new TypeError('canonicalSerializationVersion is invalid');
  const generatedAt = timestamp(input.generatedAt, 'generatedAt');
  exact(input.versions, ['providerRegistry','schemaRegistry','identityGraph','empRegistry','ontology'], 'versions');
  exact(input.roots, ['empRegistryRoot','ontologyHash'], 'roots');
  const versions = {};
  for (const key of ['providerRegistry','schemaRegistry','identityGraph','empRegistry','ontology']) versions[key] = identifier(input.versions[key], 'versions.' + key);
  const roots = { empRegistryRoot: hash(input.roots.empRegistryRoot, 'roots.empRegistryRoot'), ontologyHash: hash(input.roots.ontologyHash, 'roots.ontologyHash') };
  const ontology = validateOntology(input.ontology);
  if (versions.ontology !== ontology.ontologyVersion) throw new Error('ontology version commitment does not match embedded ontology version');
  if (roots.ontologyHash !== ontology.ontologyHash) throw new Error('ontology hash commitment does not match embedded ontology hash');

  const registry = {
    registryType: input.registryType,
    canonicalSerializationVersion: input.canonicalSerializationVersion,
    registryVersion: identifier(input.registryVersion, 'registryVersion'),
    generatedAt: input.generatedAt,
    previousRegistryHash: optionalHash(input.previousRegistryHash, 'previousRegistryHash'),
    versions,
    roots,
    providers: sortedUnique(input.providers, 'providers', (item, label) => validateProvider(item, label, generatedAt), item => item.providerId),
    schemas: sortedUnique(input.schemas, 'schemas', validateSchema, item => item.schemaId + '\0' + item.schemaVersion),
    identityIssuers: sortedUnique(input.identityIssuers, 'identityIssuers', (item, label) => validateIssuer(item, label, generatedAt), item => item.issuerId),
    subjects: sortedUnique(input.subjects, 'subjects', validateSubject, item => item.subjectId),
    identityEdges: sortedUnique(input.identityEdges, 'identityEdges', (item, label) => validateEdge(item, label, generatedAt), item => item.edgeId),
    actorEpochs: sortedUnique(input.actorEpochs, 'actorEpochs', (item, label) => validateEpoch(item, label, generatedAt), item => item.actorEpochId),
    empPolicies: sortedUnique(input.empPolicies, 'empPolicies', validateEmpPolicy, item => item.empId + '\0' + item.empVersion),
    ontology,
  };
  if (registry.providers.length === 0 || registry.schemas.length === 0 || registry.identityIssuers.length === 0 || registry.subjects.length === 0 || registry.empPolicies.length === 0) throw new TypeError('registry collections must be nonempty');
  for (const policy of registry.empPolicies) verifyEmpRoot(policy, roots.empRegistryRoot, 'EMP policy ' + policy.empId);
  assertReferences(registry, generatedAt);
  return deepFreeze(registry);
}

function buildRegistryBundle(input) {
  const registry = normalizeRegistry(input);
  const canonicalBytes = canonicalStringify(registry);
  return deepFreeze({ registry, canonicalBytes, registryHash: hashBytes(REGISTRY_HASH_DOMAIN, canonicalBytes) });
}

module.exports = Object.freeze({
  REGISTRY_TYPE,
  CANONICAL_SERIALIZATION_VERSION,
  REGISTRY_HASH_DOMAIN,
  normalizeRegistry,
  buildRegistryBundle,
  computeEmpPolicyHash,
  computeOntologyHash,
  normalizeCoordinate: validateCoordinate,
  coordinateKey,
});
