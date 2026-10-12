'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('./fixtures/registry.json');
const { normalizeCoordinate } = require('../../cred-evidence/registry');
const { buildIdentityGraphMaterial, resolveIdentity } = require('../../cred-evidence/identity');

function registry() { return structuredClone(fixture.registry); }
function alphaCoordinate(namespace) { return structuredClone(fixture.registry.subjects[0].coordinates.find((item) => item.namespace === namespace)); }
function addSecondSubject(value, coordinate, relationshipType) {
  value.subjects.push({ subjectId: 'subject_beta', state: 'active', currentActorEpochId: 'epoch_beta', coordinates: [structuredClone(coordinate)] });
  value.actorEpochs.push({ actorEpochId: 'epoch_beta', subjectId: 'subject_beta', startsAt: '2026-01-01T00:00:00.000Z', endsAt: null, controllerCoordinates: [structuredClone(coordinate)], transitionHash: null, encumbrance: 'clear', assumptionOf: null });
  value.identityEdges.push({ edgeId: 'edge_beta', issuerId: 'issuer_helixa', subjectId: 'subject_beta', coordinate: structuredClone(coordinate), relationshipType, validFrom: '2026-01-01T00:00:00.000Z', validUntil: null, verifiedAt: '2026-01-01T00:00:00.000Z', revokedAt: null, proofHash: 'sha256:' + 'aa'.repeat(32) });
}

test('accepts every initial canonical coordinate namespace and rejects aliases', () => {
  const valid = [
    { namespace: 'erc8004', network: 'eip155:8453', value: '18531' },
    { namespace: 'looper', network: 'eip155:8453', value: '0x1111111111111111111111111111111111111111/42' },
    { namespace: 'evm', network: 'eip155:8453', value: '0x1111111111111111111111111111111111111111' },
    { namespace: 'solana', network: 'solana:mainnet-beta', value: '11111111111111111111111111111111' },
    { namespace: 'did', network: 'global', value: 'did:key:z6Mkexample' },
    { namespace: 'ubid', network: 'adapterscan', value: 'ubid:agent_1' },
    { namespace: 'platform', network: 'regents', value: 'agent_1' },
    { namespace: 'endpoint', network: 'https', value: 'https://agent.example/' },
  ];
  for (const coordinate of valid) assert.deepEqual(normalizeCoordinate(coordinate), coordinate);
  assert.throws(() => normalizeCoordinate({ namespace: 'evm', network: 'eip155:8453', value: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' }), /canonical/);
  assert.throws(() => normalizeCoordinate({ namespace: 'erc8004', network: 'eip155:8453', value: '018531' }), /canonical/);
  assert.throws(() => normalizeCoordinate({ namespace: 'endpoint', network: 'https', value: 'http://agent.example/' }), /canonical/);
  assert.throws(() => normalizeCoordinate({ namespace: 'unknown', network: 'x', value: 'x' }), /namespace/);
});

test('resolves current control to the exact subject and actor epoch', () => {
  const result = resolveIdentity(registry(), [alphaCoordinate('evm')], '2026-10-01T00:00:00.000Z');
  assert.equal(result.subjectId, 'subject_alpha');
  assert.equal(result.actorEpochId, 'epoch_2');
  assert.equal(result.resolution, 'resolved');
  assert.equal(result.assurance, 'current-control-bindings');
  assert.equal(result.controlProofObservedAt, '2026-06-01T00:00:00.000Z');
  assert.deepEqual(result.reasonCodes, []);
  assert.match(result.identityGraphHash, /^sha256:[0-9a-f]{64}$/);
});

test('binds behavior to historical epochs at exact half-open boundaries', () => {
  const coordinate = alphaCoordinate('erc8004');
  const before = resolveIdentity(registry(), [coordinate], '2026-05-31T23:59:59.999Z');
  const boundary = resolveIdentity(registry(), [coordinate], '2026-06-01T00:00:00.000Z');
  assert.equal(before.actorEpochId, 'epoch_1');
  assert.equal(boundary.actorEpochId, 'epoch_2');
  assert.equal(before.assurance, 'registry-only');
  assert.equal(boundary.assurance, 'registry-only');
});

test('returns unresolved without inventing a subject or actor epoch', () => {
  const missing = resolveIdentity(registry(), [{ namespace: 'erc8004', network: 'eip155:8453', value: '999999' }], '2026-10-01T00:00:00.000Z');
  assert.equal(missing.resolution, 'unresolved');
  assert.equal(missing.subjectId, null);
  assert.equal(missing.actorEpochId, null);
  assert.deepEqual(missing.reasonCodes, ['IDENTITY_UNRESOLVED']);

  const gap = registry();
  gap.actorEpochs[0].startsAt = '2026-02-01T00:00:00.000Z';
  const unresolvedEpoch = resolveIdentity(gap, [alphaCoordinate('erc8004')], '2026-01-15T00:00:00.000Z');
  assert.equal(unresolvedEpoch.subjectId, 'subject_alpha');
  assert.equal(unresolvedEpoch.actorEpochId, null);
  assert.deepEqual(unresolvedEpoch.reasonCodes, ['ACTOR_EPOCH_UNRESOLVED']);
});

test('reports ambiguity instead of choosing between identity claims', () => {
  const value = registry();
  addSecondSubject(value, alphaCoordinate('erc8004'), 'identifies');
  const result = resolveIdentity(value, [alphaCoordinate('erc8004')], '2026-10-01T00:00:00.000Z');
  assert.equal(result.resolution, 'ambiguous');
  assert.equal(result.subjectId, null);
  assert.deepEqual(result.candidates, ['subject_alpha', 'subject_beta']);
  assert.deepEqual(result.reasonCodes, ['IDENTITY_AMBIGUOUS']);
});

test('reports conflict for contradictory current-control proofs', () => {
  const value = registry();
  addSecondSubject(value, alphaCoordinate('evm'), 'controlled-by');
  const result = resolveIdentity(value, [alphaCoordinate('evm')], '2026-10-01T00:00:00.000Z');
  assert.equal(result.resolution, 'conflict');
  assert.equal(result.subjectId, null);
  assert.deepEqual(result.flags, ['IDENTITY_CONFLICT']);
  assert.deepEqual(result.reasonCodes, ['IDENTITY_CONFLICT']);
});

test('ignores revoked edges and fails closed for transfer or identity conflicts', () => {
  const revoked = registry();
  revoked.identityEdges.find((edge) => edge.edgeId === 'edge_identity').revokedAt = '2026-05-01T00:00:00.000Z';
  const afterRevocation = resolveIdentity(revoked, [alphaCoordinate('erc8004')], '2026-10-01T00:00:00.000Z');
  assert.equal(afterRevocation.resolution, 'unresolved');

  const pending = registry();
  pending.actorEpochs.find((epoch) => epoch.actorEpochId === 'epoch_2').encumbrance = 'transfer-pending';
  const pendingResult = resolveIdentity(pending, [alphaCoordinate('evm')], '2026-10-01T00:00:00.000Z');
  assert.equal(pendingResult.resolution, 'unresolved');
  assert.deepEqual(pendingResult.flags, ['TRANSFER_PENDING']);

  const conflict = registry();
  conflict.actorEpochs.find((epoch) => epoch.actorEpochId === 'epoch_2').encumbrance = 'conflict';
  const conflictResult = resolveIdentity(conflict, [alphaCoordinate('evm')], '2026-10-01T00:00:00.000Z');
  assert.equal(conflictResult.resolution, 'conflict');
  assert.deepEqual(conflictResult.flags, ['IDENTITY_CONFLICT']);
});

test('preserves historical links but rejects observations after issuer suspension', () => {
  const value = registry();
  value.identityIssuers[0].state = 'suspended';
  value.identityIssuers[0].validUntil = '2026-07-01T00:00:00.000Z';
  for (const edge of value.identityEdges) edge.validUntil = '2026-07-01T00:00:00.000Z';
  const historical = resolveIdentity(value, [alphaCoordinate('erc8004')], '2026-05-01T00:00:00.000Z');
  const afterSuspension = resolveIdentity(value, [alphaCoordinate('erc8004')], '2026-10-01T00:00:00.000Z');
  assert.equal(historical.resolution, 'resolved');
  assert.equal(historical.actorEpochId, 'epoch_1');
  assert.equal(afterSuspension.resolution, 'unresolved');
});

test('surfaces encumbrance without transferring old epoch history', () => {
  const value = registry();
  value.actorEpochs.find((epoch) => epoch.actorEpochId === 'epoch_2').encumbrance = 'encumbered';
  const oldResult = resolveIdentity(value, [alphaCoordinate('erc8004')], '2026-05-01T00:00:00.000Z');
  const current = resolveIdentity(value, [alphaCoordinate('erc8004')], '2026-10-01T00:00:00.000Z');
  assert.equal(oldResult.actorEpochId, 'epoch_1');
  assert.deepEqual(oldResult.flags, []);
  assert.equal(current.actorEpochId, 'epoch_2');
  assert.deepEqual(current.flags, ['ENCUMBERED']);
});

test('is input-order invariant, deduplicates coordinates, and returns immutable output', () => {
  const firstRegistry = registry();
  const secondRegistry = registry();
  secondRegistry.identityEdges.reverse();
  secondRegistry.actorEpochs.reverse();
  secondRegistry.subjects[0].coordinates.reverse();
  const evm = alphaCoordinate('evm');
  const erc = alphaCoordinate('erc8004');
  const first = resolveIdentity(firstRegistry, [evm, erc, evm], '2026-10-01T00:00:00.000Z');
  const second = resolveIdentity(secondRegistry, [erc, evm], '2026-10-01T00:00:00.000Z');
  assert.deepEqual(first, second);
  assert.equal(first.coordinates.length, 2);
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.coordinates));
  assert.ok(Object.isFrozen(first.coordinates[0]));
  assert.throws(() => { first.flags.push('x'); }, TypeError);
  const material = buildIdentityGraphMaterial(firstRegistry);
  assert.equal(material.hash, first.identityGraphHash);
  assert.ok(Object.isFrozen(material.registry));
});
