'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fixture = require('./fixtures/registry.json');
const { canonicalStringify } = require('../../cred-shadow/artifact');
const {
  REGISTRY_TYPE,
  CANONICAL_SERIALIZATION_VERSION,
  REGISTRY_HASH_DOMAIN,
  normalizeRegistry,
  buildRegistryBundle,
} = require('../../cred-evidence/registry');

function clone() { return structuredClone(fixture.registry); }
function manualHash(bytes) {
  return 'sha256:' + createHash('sha256').update('CRED-EVIDENCE-REGISTRY-v1\0', 'utf8').update(bytes, 'utf8').digest('hex');
}
function empRoot(policyHash, proof) {
  let current = Buffer.from(policyHash.slice(7), 'hex');
  for (const entry of proof) {
    const sibling = Buffer.from(entry.hash.slice(7), 'hex');
    const bytes = entry.side === 'left' ? Buffer.concat([sibling, current]) : Buffer.concat([current, sibling]);
    current = createHash('sha256').update('CRED-EMP-NODE-v1\0', 'utf8').update(bytes).digest();
  }
  return 'sha256:' + current.toString('hex');
}

function throwsWith(mutator, pattern) {
  const value = clone();
  mutator(value);
  assert.throws(() => normalizeRegistry(value), pattern);
}

test('accepts only the exact closed registry shape at every level', () => {
  const normalized = normalizeRegistry(clone());
  assert.equal(normalized.registryType, REGISTRY_TYPE);
  assert.equal(normalized.canonicalSerializationVersion, CANONICAL_SERIALIZATION_VERSION);
  for (const mutate of [
    value => { value.extra = true; },
    value => { value.providers[0].extra = true; },
    value => { value.providers[0].keyEpochs[0].extra = true; },
    value => { value.schemas[0].extra = true; },
    value => { value.subjects[0].coordinates[0].extra = true; },
    value => { value.empPolicies[0].providerBucket.extra = true; },
    value => { delete value.ontology.domains; },
  ]) throwsWith(mutate, /unknown field|missing field/);
});

test('normalizes all set-like records with exact unsigned UTF-8 ordering', () => {
  const first = clone();
  first.providers.push({ ...structuredClone(first.providers[0]), providerId: 'é_provider', controlGroupId: 'é_group' });
  first.providers.push({ ...structuredClone(first.providers[0]), providerId: 'z_provider', controlGroupId: 'z_group' });
  first.providers.reverse();
  first.subjects[0].coordinates.reverse();
  first.schemas[0].allowedDirections.reverse();
  first.ontology.domains.reverse();
  const second = structuredClone(first);
  second.providers.reverse();
  second.subjects[0].coordinates.reverse();
  second.schemas[0].allowedDirections.reverse();
  second.ontology.domains.reverse();
  const a = buildRegistryBundle(first);
  const b = buildRegistryBundle(second);
  assert.deepEqual(a.registry.providers.map(item => item.providerId), ['provider_alpha', 'z_provider', 'é_provider']);
  assert.equal(a.canonicalBytes, b.canonicalBytes);
  assert.equal(a.registryHash, b.registryHash);
});

test('returns deeply immutable detached normalized output', () => {
  const input = clone();
  const normalized = normalizeRegistry(input);
  assert.notStrictEqual(normalized, input);
  assert.ok(Object.isFrozen(normalized));
  assert.ok(Object.isFrozen(normalized.providers));
  assert.ok(Object.isFrozen(normalized.providers[0].keyEpochs[0]));
  assert.ok(Object.isFrozen(normalized.subjects[0].coordinates[0]));
  assert.throws(() => { normalized.providers[0].state = 'revoked'; }, TypeError);
  input.providers[0].state = 'revoked';
  assert.equal(normalized.providers[0].state, 'active');
});

test('uses the exact domain-separated registry hash', () => {
  const bundle = buildRegistryBundle(clone());
  assert.equal(REGISTRY_HASH_DOMAIN, 'CRED-EVIDENCE-REGISTRY-v1\0');
  assert.equal(bundle.registryHash, manualHash(bundle.canonicalBytes));
  assert.notEqual(bundle.registryHash, 'sha256:' + createHash('sha256').update(bundle.canonicalBytes).digest('hex'));
});

test('rejects duplicate IDs and composite IDs', () => {
  for (const mutate of [
    value => value.providers.push(structuredClone(value.providers[0])),
    value => value.schemas.push(structuredClone(value.schemas[0])),
    value => value.identityIssuers.push(structuredClone(value.identityIssuers[0])),
    value => value.subjects.push(structuredClone(value.subjects[0])),
    value => value.identityEdges.push(structuredClone(value.identityEdges[0])),
    value => value.actorEpochs.push(structuredClone(value.actorEpochs[0])),
    value => value.empPolicies.push(structuredClone(value.empPolicies[0])),
    value => value.providers[0].keyEpochs.push(structuredClone(value.providers[0].keyEpochs[0])),
  ]) throwsWith(mutate, /duplicate/i);
});

test('rejects noncanonical timestamps, hashes, and integer encodings without coercion', () => {
  throwsWith(value => { value.generatedAt = '2026-10-11T18:00:00Z'; }, /timestamp/);
  throwsWith(value => { value.generatedAt = new Date(value.generatedAt); }, /timestamp/);
  throwsWith(value => { value.identityEdges[0].proofHash = 'sha256:' + 'AA'.repeat(32); }, /hash/);
  throwsWith(value => { value.providers[0].ratePolicy.windowSeconds = 3600; }, /integer string/);
  throwsWith(value => { value.providers[0].ratePolicy.maxEvents = '01000'; }, /integer string/);
  throwsWith(value => { value.empPolicies[0].registryLeafIndex = '0'; }, /integer/);
  throwsWith(value => { value.subjects[0].coordinates[0].network = 'e\u0301'; }, /canonical/);
});

test('validates provider state, key epochs, and schema authorization references', () => {
  throwsWith(value => { value.providers[0].state = 'approved'; }, /state/);
  throwsWith(value => { value.providers[0].observationOnly = true; }, /observationOnly/);
  throwsWith(value => { value.providers[0].keyEpochs[0].suite = 'ed25519'; }, /suite/);
  throwsWith(value => { value.providers[0].keyEpochs[0].publicKey += '='; }, /publicKey/);
  throwsWith(value => { value.providers[0].keyEpochs[0].validUntil = '2025-01-01T00:00:00.000Z'; }, /key epoch/);
  throwsWith(value => { value.providers[0].schemaAuthorizations[0].schemaId = 'missing'; }, /unknown schema/);
  throwsWith(value => { value.providers[0].schemaAuthorizations[0].validFrom = '2025-01-01T00:00:00.000Z'; }, /provider state/);
  throwsWith(value => { value.providers[0].schemaAuthorizations[0].validUntil = '2026-02-01T00:00:00.000Z'; }, /current schema authorization/);
  throwsWith(value => { value.providers[0].domains = ['payments']; }, /authorized domain/);
});

test('validates identity issuer authority, subject coordinates, and relationship validity', () => {
  throwsWith(value => { value.subjects[0].coordinates = []; }, /coordinate/);
  throwsWith(value => { value.identityEdges[0].issuerId = 'missing'; }, /issuer/);
  throwsWith(value => { value.identityEdges[0].relationshipType = 'operated-by'; }, /not authorized/);
  throwsWith(value => { value.identityEdges[0].coordinate.namespace = 'solana'; }, /not authorized/);
  throwsWith(value => { value.identityEdges[0].validUntil = '2026-07-01T00:00:00.000Z'; value.identityEdges[0].revokedAt = '2026-08-01T00:00:00.000Z'; }, /revokedAt/);
  throwsWith(value => { value.identityEdges[0].verifiedAt = '2026-05-01T00:00:00.000Z'; }, /outside validity/);
  throwsWith(value => { value.identityEdges[0].coordinate.value = 'other'; }, /subject coordinate/);
});

test('requires complete non-overlapping actor epochs and current epoch references', () => {
  throwsWith(value => { value.actorEpochs[0].endsAt = '2026-07-01T00:00:00.000Z'; }, /overlap/);
  throwsWith(value => { value.actorEpochs[1].startsAt = '2026-07-01T00:00:00.000Z'; }, /gap/);
  throwsWith(value => { value.actorEpochs[1].endsAt = '2026-10-01T00:00:00.000Z'; }, /current actor epoch/);
  throwsWith(value => { value.subjects[0].currentActorEpochId = 'epoch_1'; }, /current actor epoch/);
  throwsWith(value => { value.actorEpochs[1].controllerCoordinates = []; }, /controller coordinate/);
});

test('pins schema EMP references and exact EMP and ontology commitments', () => {
  throwsWith(value => { value.schemas[0].empVersion = '2.0.0'; }, /EMP policy/);
  throwsWith(value => { value.schemas[0].evidenceFamily = 'financial'; }, /EMP evidenceFamily/);
  throwsWith(value => { value.versions.ontology = 'cred-ontology-2.0.0'; }, /ontology version/);
  throwsWith(value => { value.roots.ontologyHash = 'sha256:' + '66'.repeat(32); }, /ontology hash/);
  throwsWith(value => { value.roots.empRegistryRoot = 'sha256:' + '77'.repeat(32); }, /EMP registry root/);
  throwsWith(value => { value.empPolicies[0].clusterCapMicroEu = '02000000'; }, /integer string/);
  throwsWith(value => { value.empPolicies[0].positiveHalfLifeDays = 91; }, /methodology maximum/);
  throwsWith(value => { value.empPolicies[0].negativeHalfLifeDays = 181; }, /methodology maximum/);
  throwsWith(value => { value.empPolicies[0].clusterCapMicroEu = '2000001'; }, /methodology maximum/);
  throwsWith(value => { value.empPolicies[0].providerBucket.capacityMicroEu = '4000001'; }, /methodology maximum/);
  throwsWith(value => { value.empPolicies[0].providerBucket.refillSeconds = 7775999; }, /integer/);
});

test('preserves ordered EMP Merkle paths instead of treating proofs as sets', () => {
  const value = clone();
  value.empPolicies[0].registryProof = [
    { side: 'right', hash: 'sha256:' + 'ff'.repeat(32) },
    { side: 'right', hash: 'sha256:' + '00'.repeat(32) },
  ];
  value.roots.empRegistryRoot = empRoot(value.empPolicies[0].policyHash, value.empPolicies[0].registryProof);
  const normalized = normalizeRegistry(value);
  assert.deepEqual(normalized.empPolicies[0].registryProof, value.empPolicies[0].registryProof);
});

test('fixture pins the complete canonical registry bytes and hash', () => {
  const bundle = buildRegistryBundle(clone());
  assert.equal(canonicalStringify(bundle.registry), bundle.canonicalBytes);
  assert.equal(bundle.canonicalBytes, fixture.canonicalBytes);
  assert.equal(bundle.registryHash, fixture.registryHash);
});
