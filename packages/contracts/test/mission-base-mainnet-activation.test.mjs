import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  ACTIVATION_ARTIFACT_URL,
  ACTIVATION_CONSTANTS,
  buildActivationPacket,
  computeSafeTransactionHash,
  validateActivationPacket,
  verifyActivationArtifact,
} from '../scripts/prepare-mission-base-mainnet-activation.js';

const SAFE_TX_HASH = '0xf3a04f63765a1c95b1a02ba8aa23f641044d914c56bac5fb16f8657985a736ee';
const ACTIVATION_DATA = '0x0a2203865fc16a65273a5c452de558226709b483548e34e8718ab2dbca37c6bcb3d5a3ac';
const APPROVAL_DATA = '0xd4d9bdcdf3a04f63765a1c95b1a02ba8aa23f641044d914c56bac5fb16f8657985a736ee';

test('derives the exact Base Safe nonce-1 MissionEscrowV1 activation', () => {
  const packet = buildActivationPacket();
  assert.equal(packet.chainId, 8453);
  assert.equal(packet.authority.address, '0x7410A8CA3F3098D92300bfE110273A68f5fcc4FF');
  assert.equal(packet.authority.requiredNonce, 1);
  assert.equal(packet.activation.safeTransaction.to, '0xC2fbEF16EC0981bcfA7e878f6f78BF8DeBe2BcCB');
  assert.equal(packet.activation.safeTransaction.data, ACTIVATION_DATA);
  assert.equal(packet.activation.safeTxHash, SAFE_TX_HASH);
  assert.equal(packet.ownerApproval.data, APPROVAL_DATA);
  assert.equal(packet.activation.activateAfter, 1792436907);
  assert.equal(computeSafeTransactionHash(packet.chainId, packet.authority.address, packet.activation.safeTransaction), SAFE_TX_HASH);
});

test('packet is explicitly no-sign/no-broadcast and contains no arbitrary transaction fields', () => {
  const packet = buildActivationPacket();
  assert.equal(packet.activation.authorization, 'owners-2-of-2-not-collected');
  assert.equal(packet.excluded.signing, 'not_performed');
  assert.equal(packet.excluded.broadcast, 'not_performed');
  assert.deepEqual(Object.keys(packet.activation.safeTransaction), [
    'to', 'value', 'data', 'operation', 'operationCode', 'safeTxGas', 'baseGas', 'gasPrice', 'gasToken', 'refundReceiver', 'nonce',
  ]);
  assert.deepEqual(Object.keys(packet.ownerApproval), ['action', 'requiredSigner', 'to', 'value', 'data', 'dataHash']);
  assert.equal(JSON.stringify(packet).match(/private.?key|mnemonic|signature/gi), null);
  assert.equal(validateActivationPacket(packet), true);
});

test('validation fails closed when chain, nonce, calldata, hash, signer, or broadcast boundary changes', () => {
  const packet = structuredClone(buildActivationPacket());
  for (const mutate of [
    (value) => { value.chainId = 1; },
    (value) => { value.authority.requiredNonce = 2; },
    (value) => { value.activation.safeTransaction.data = '0x'; },
    (value) => { value.activation.safeTxHash = '0x' + '00'.repeat(32); },
    (value) => { value.ownerApproval.requiredSigner = ACTIVATION_CONSTANTS.owners[0]; },
    (value) => { value.excluded.broadcast = 'allowed'; },
  ]) {
    const changed = structuredClone(packet);
    mutate(changed);
    assert.throws(() => validateActivationPacket(changed));
  }
});

test('committed activation artifact exactly matches the deterministic builder', async () => {
  assert.equal(await verifyActivationArtifact(), true);
  const committed = JSON.parse(await readFile(ACTIVATION_ARTIFACT_URL, 'utf8'));
  assert.deepEqual(committed, buildActivationPacket());
});
