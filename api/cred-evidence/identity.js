'use strict';

const { createHash } = require('node:crypto');
const { canonicalStringify } = require('../cred-shadow/artifact');
const { buildRegistryBundle, normalizeCoordinate, coordinateKey } = require('./registry');

const IDENTITY_GRAPH_HASH_DOMAIN = 'CRED-IDENTITY-GRAPH-v1\0';
const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const IDENTITY_MATERIAL_CACHE = new WeakMap();

function deepFreeze(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

function timestamp(value, label) {
  if (typeof value !== 'string' || !ISO_PATTERN.test(value)) throw new TypeError(label + ' must be a canonical ISO-8601 UTC timestamp');
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) throw new TypeError(label + ' must be a canonical ISO-8601 UTC timestamp');
  return milliseconds;
}

function identityProjection(registry) {
  return {
    identityGraphVersion: registry.versions.identityGraph,
    identityIssuers: registry.identityIssuers,
    subjects: registry.subjects,
    identityEdges: registry.identityEdges,
    actorEpochs: registry.actorEpochs,
  };
}

function buildIdentityGraphMaterial(registryInput) {
  const supplied = registryInput && registryInput.registry ? registryInput : null;
  const bundle = buildRegistryBundle(supplied ? supplied.registry : registryInput);
  if (supplied && supplied.registryHash !== undefined && supplied.registryHash !== bundle.registryHash) throw new Error('supplied registry hash does not match canonical registry');
  const cached = IDENTITY_MATERIAL_CACHE.get(bundle.registry);
  if (cached) return cached;
  const bytes = canonicalStringify(identityProjection(bundle.registry));
  const hash = 'sha256:' + createHash('sha256').update(IDENTITY_GRAPH_HASH_DOMAIN, 'utf8').update(bytes, 'utf8').digest('hex');
  const material = deepFreeze({ registry: bundle.registry, registryHash: bundle.registryHash, bytes, hash });
  IDENTITY_MATERIAL_CACHE.set(bundle.registry, material);
  return material;
}

function normalizeCoordinates(values) {
  if (!Array.isArray(values) || values.length === 0) throw new TypeError('identity coordinates must be a nonempty array');
  const byKey = new Map();
  for (let index = 0; index < values.length; index += 1) {
    const coordinate = normalizeCoordinate(values[index], 'coordinates[' + index + ']');
    byKey.set(coordinateKey(coordinate), coordinate);
  }
  return [...byKey.values()].sort((left, right) => compareUtf8(coordinateKey(left), coordinateKey(right)));
}

function activeAt(item, at) {
  const starts = timestamp(item.validFrom, 'validFrom');
  const ends = item.validUntil === null ? null : timestamp(item.validUntil, 'validUntil');
  const revoked = item.revokedAt === null || item.revokedAt === undefined ? null : timestamp(item.revokedAt, 'revokedAt');
  return starts <= at && (ends === null || at < ends) && (revoked === null || at < revoked);
}

function epochAt(registry, subjectId, at) {
  return registry.actorEpochs.find((epoch) => {
    if (epoch.subjectId !== subjectId) return false;
    const starts = timestamp(epoch.startsAt, 'actor epoch startsAt');
    const ends = epoch.endsAt === null ? null : timestamp(epoch.endsAt, 'actor epoch endsAt');
    return starts <= at && (ends === null || at < ends);
  }) || null;
}

function latestTimestamp(values) {
  if (values.length === 0) return null;
  return [...values].sort(compareUtf8).at(-1);
}

function makeResult(material, coordinates, values) {
  return deepFreeze({
    identityGraphVersion: material.registry.versions.identityGraph,
    identityGraphHash: material.hash,
    registryHash: material.registryHash,
    coordinates,
    subjectId: values.subjectId ?? null,
    actorEpochId: values.actorEpochId ?? null,
    resolution: values.resolution,
    assurance: values.assurance || 'none',
    candidates: values.candidates || [],
    matchedEdgeIds: values.matchedEdgeIds || [],
    controlProofObservedAt: values.controlProofObservedAt ?? null,
    flags: values.flags || [],
    reasonCodes: values.reasonCodes || [],
  });
}

function resolveIdentity(registryInput, coordinateInputs, occurredAt) {
  const at = timestamp(occurredAt, 'occurredAt');
  const material = buildIdentityGraphMaterial(registryInput);
  const registry = material.registry;
  const coordinates = normalizeCoordinates(coordinateInputs);
  const keys = new Set(coordinates.map(coordinateKey));
  const matched = registry.identityEdges.filter((edge) => keys.has(coordinateKey(edge.coordinate)) && activeAt(edge, at));
  const candidates = [...new Set(matched.map((edge) => edge.subjectId))].sort(compareUtf8);
  const matchedEdgeIds = matched.map((edge) => edge.edgeId).sort(compareUtf8);

  if (candidates.length === 0) {
    return makeResult(material, coordinates, { resolution: 'unresolved', candidates, matchedEdgeIds, reasonCodes: ['IDENTITY_UNRESOLVED'] });
  }

  const controlledSubjectsByCoordinate = new Map();
  for (const edge of matched) {
    if (edge.relationshipType !== 'controlled-by') continue;
    const key = coordinateKey(edge.coordinate);
    const set = controlledSubjectsByCoordinate.get(key) || new Set();
    set.add(edge.subjectId);
    controlledSubjectsByCoordinate.set(key, set);
  }
  const contradictoryControl = [...controlledSubjectsByCoordinate.values()].some((subjects) => subjects.size > 1);
  if (candidates.length > 1) {
    return makeResult(material, coordinates, {
      resolution: contradictoryControl ? 'conflict' : 'ambiguous',
      candidates,
      matchedEdgeIds,
      flags: contradictoryControl ? ['IDENTITY_CONFLICT'] : [],
      reasonCodes: [contradictoryControl ? 'IDENTITY_CONFLICT' : 'IDENTITY_AMBIGUOUS'],
    });
  }

  const subjectId = candidates[0];
  const subject = registry.subjects.find((item) => item.subjectId === subjectId);
  const epoch = epochAt(registry, subjectId, at);
  const subjectEdges = matched.filter((edge) => edge.subjectId === subjectId);
  const subjectEdgeIds = subjectEdges.map((edge) => edge.edgeId).sort(compareUtf8);
  const controlEdges = subjectEdges.filter((edge) => edge.relationshipType === 'controlled-by');
  const controlProofObservedAt = latestTimestamp(controlEdges.map((edge) => edge.verifiedAt));

  if (!epoch) {
    return makeResult(material, coordinates, {
      subjectId,
      resolution: 'unresolved',
      candidates,
      matchedEdgeIds: subjectEdgeIds,
      controlProofObservedAt,
      reasonCodes: ['ACTOR_EPOCH_UNRESOLVED'],
    });
  }

  const flags = [];
  const reasons = [];
  if (subject.state === 'suspended') { flags.push('SUBJECT_SUSPENDED'); reasons.push('SUBJECT_SUSPENDED'); }
  if (subject.state === 'retired') { flags.push('SUBJECT_RETIRED'); reasons.push('SUBJECT_RETIRED'); }
  if (epoch.encumbrance === 'encumbered') { flags.push('ENCUMBERED'); reasons.push('ENCUMBERED'); }
  if (epoch.encumbrance === 'transfer-pending') {
    flags.push('TRANSFER_PENDING');
    reasons.push('TRANSFER_PENDING');
    return makeResult(material, coordinates, { subjectId, actorEpochId: epoch.actorEpochId, resolution: 'unresolved', candidates, matchedEdgeIds: subjectEdgeIds, controlProofObservedAt, flags, reasonCodes: reasons });
  }
  if (epoch.encumbrance === 'conflict') {
    flags.push('IDENTITY_CONFLICT');
    reasons.push('IDENTITY_CONFLICT');
    return makeResult(material, coordinates, { subjectId, actorEpochId: epoch.actorEpochId, resolution: 'conflict', candidates, matchedEdgeIds: subjectEdgeIds, controlProofObservedAt, flags, reasonCodes: reasons });
  }

  const controllers = new Set(epoch.controllerCoordinates.map(coordinateKey));
  const controlMatchesEpoch = controlEdges.some((edge) => controllers.has(coordinateKey(edge.coordinate)));
  const assurance = controlEdges.length === 0 ? 'registry-only' : controlMatchesEpoch ? 'current-control-bindings' : 'current-control-partial';
  return makeResult(material, coordinates, {
    subjectId,
    actorEpochId: epoch.actorEpochId,
    resolution: 'resolved',
    assurance,
    candidates,
    matchedEdgeIds: subjectEdgeIds,
    controlProofObservedAt,
    flags: flags.sort(compareUtf8),
    reasonCodes: reasons.sort(compareUtf8),
  });
}

module.exports = Object.freeze({
  IDENTITY_GRAPH_HASH_DOMAIN,
  buildIdentityGraphMaterial,
  resolveIdentity,
});
