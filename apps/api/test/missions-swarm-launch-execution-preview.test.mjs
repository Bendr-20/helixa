import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { createSwarmLaunchConsentService } from '../src/missions/swarm-launch-consent.js';
import { canonicalSwarmLaunchJson } from '../../../packages/types/src/swarm-launch.js';

const OWNER = '0x1111111111111111111111111111111111111111';
const PARTNER = '0x2222222222222222222222222222222222222222';
const FACTORY = '0x9999999999999999999999999999999999999999';
const HASH = '0x' + 'a'.repeat(64);
const manifest = Object.freeze({ schema: 'multipass.swarm-launch.v1', chainId: 8453, execution: { mode: 'PREPARATION_ONLY', deploymentAuthorized: false }, app: { name: 'A', pitch: 'Ship.', template: 'web_app', revenueModel: 'subscription', shipTarget: '30_days' }, token: { name: 'Token', ticker: 'TOKEN', supply: '100000000', curve: 'bonding_curve_to_dex' }, economics: { model: 'PROVIDER_NEUTRAL_V1', agentVesting: { allocationBps: 4500, cliffMonths: 6, durationMonths: 18 }, credRewards: { allocationBps: 1500, beneficiary: 'CRED_STAKERS', provider: 'UNSELECTED' }, swarmTreasury: { allocationBps: 1500, control: 'SWARM_MULTISIG_REQUIRED' }, publicDistribution: { allocationBps: 2500, mechanism: 'UNSELECTED' }, totalAllocationBps: 10000 }, members: [
  { identity: { tokenId: '1' }, consentAuthority: OWNER, contributionBps: 4000 },
  { identity: { tokenId: '2' }, consentAuthority: PARTNER, contributionBps: 3500 },
  { identity: { tokenId: '3' }, consentAuthority: PARTNER, contributionBps: 2500 },
] });
const input = { members: [{ tokenId: '1', ownerAddress: OWNER }, { tokenId: '2', ownerAddress: PARTNER }, { tokenId: '3', ownerAddress: PARTNER }], app: { name: 'A' }, token: { name: 'Token' } };
const request = Object.freeze({
  beneficiaries: Object.freeze([
    Object.freeze({ tokenId: '3', beneficiary: '0x3333333333333333333333333333333333333333' }),
    Object.freeze({ tokenId: '1', beneficiary: '0x4444444444444444444444444444444444444444' }),
    Object.freeze({ tokenId: '2', beneficiary: '0x5555555555555555555555555555555555555555' }),
  ]),
  recipients: Object.freeze({ credRewards: '0x6666666666666666666666666666666666666666', swarmTreasury: '0x7777777777777777777777777777777777777777', publicDistribution: '0x8888888888888888888888888888888888888888' }),
  revenueAssets: Object.freeze(['0x0000000000000000000000000000000000000000']),
});

function fixture(overrides = {}) {
  const records = new Map();
  const calls = [];
  const store = {
    create(value) { records.set(value.proposalId, { ...value, consents: [] }); return records.get(value.proposalId); },
    read(id) { return records.get(id) ?? null; },
    consent({ proposalId, wallet, signatureHash, consentedAt }) { const current = records.get(proposalId); if (!current.consents.some((entry) => entry.wallet === wallet)) current.consents.push({ wallet, signatureHash, consentedAt }); return current; },
  };
  const builder = overrides.executionPacketBuilder ?? ((value) => {
    calls.push(value);
    const packet = {
      schema: 'multipass.swarm-token-launch-packet.v1', chainId: 8453, factory: FACTORY,
      sourceReadiness: { sha256: value.readinessPacketSha256 },
      authorization: { status: 'NOT_ATTACHED', requiredSigners: [OWNER, PARTNER], signatures: [] },
      execution: { mode: 'PREPARATION_ONLY', deploymentAuthorized: false, broadcastPrepared: false, transactionCount: 0 },
      safety: { keysIncluded: false, signaturesIncluded: false, transactionDataIncluded: false, calldataIncluded: false, secretsIncluded: false, externalAdapterDataIncluded: false, rpcSendMethodsAllowed: false },
    };
    return { manifest: packet, manifestSha256: '0x' + createHash('sha256').update(canonicalSwarmLaunchJson(packet)).digest('hex'), typedData: {} };
  });
  const service = createSwarmLaunchConsentService({
    store, createId: () => 'proposal-1', now: overrides.now ?? (() => 1_000),
    preview: async () => ({ manifest, manifestSha256: HASH, input }),
    authorizeLooper: async ({ tokenId, wallet }) => ({ tokenId, owner: wallet, controllerVerified: true }),
    verifySignature: async () => true,
    factoryAddress: Object.hasOwn(overrides, 'factoryAddress') ? overrides.factoryAddress : FACTORY,
    executionArtifacts: Object.hasOwn(overrides, 'executionArtifacts') ? overrides.executionArtifacts : { pinned: true },
    executionPacketBuilder: builder,
  });
  return { service, records, calls };
}

async function unanimous(f) {
  await f.service.createProposal({ actorAddress: OWNER, input });
  await f.service.recordConsent({ actorAddress: OWNER, proposalId: 'proposal-1', signature: '0x' + 'aa'.repeat(65) });
  await f.service.recordConsent({ actorAddress: PARTNER, proposalId: 'proposal-1', signature: '0x' + 'bb'.repeat(65) });
}

test('derives a canonical execution conversion and delegates only server-authoritative fields', async () => {
  const f = fixture(); await unanimous(f);
  const first = await f.service.createExecutionPreview({ actorAddress: OWNER, proposalId: 'proposal-1', input: request });
  const second = await f.service.createExecutionPreview({ actorAddress: OWNER, proposalId: 'proposal-1', input: { ...request, beneficiaries: [...request.beneficiaries].reverse() } });
  assert.equal(first.packet.execution.mode, 'PREPARATION_ONLY');
  assert.match(first.packetSha256, /^0x[0-9a-f]{64}$/u);
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[0].chainId, 8453);
  assert.equal(f.calls[0].factoryAddress, FACTORY);
  assert.equal(f.calls[0].consentManifest, manifest);
  assert.equal(f.calls[0].artifacts.pinned, true);
  assert.deepEqual(f.calls[0].conversion.members, [request.beneficiaries[1], request.beneficiaries[2], request.beneficiaries[0]]);
  assert.deepEqual(f.calls[0].conversion.timing, { policy: 'SOURCE_CONSENT_EXPIRY_PLUS_7D_30D_MONTHS_V1', authorizationDeadline: 86_401_000, start: 87_005_800, cliff: 15_552_000, duration: 46_656_000 });
  assert.match(f.calls[0].conversion.deploymentSalt, /^0x[0-9a-f]{64}$/u);
  assert.equal(f.calls[0].conversion.deploymentSalt, f.calls[1].conversion.deploymentSalt);
  assert.equal(Object.hasOwn(f.calls[0], 'provider'), false);
  assert.equal(Object.hasOwn(f.calls[0], 'signatures'), false);
});

test('fails closed before unanimity, without a configured factory, and on non-canonical request members', async () => {
  const pending = fixture(); await pending.service.createProposal({ actorAddress: OWNER, input });
  await assert.rejects(() => pending.service.createExecutionPreview({ actorAddress: OWNER, proposalId: 'proposal-1', input: request }), /unanimous/i);
  const absent = fixture({ factoryAddress: null }); await unanimous(absent);
  await assert.rejects(() => absent.service.createExecutionPreview({ actorAddress: OWNER, proposalId: 'proposal-1', input: request }), /factory|configured/i);
  const f = fixture(); await unanimous(f);
  await assert.rejects(() => f.service.createExecutionPreview({ actorAddress: OWNER, proposalId: 'proposal-1', input: { ...request, calldata: '0x1234' } }), /unknown|invalid/i);
  await assert.rejects(() => f.service.createExecutionPreview({ actorAddress: OWNER, proposalId: 'proposal-1', input: { ...request, beneficiaries: request.beneficiaries.slice(0, 2) } }), /beneficiar|member/i);
  await assert.rejects(() => f.service.createExecutionPreview({ actorAddress: OWNER, proposalId: 'proposal-1', input: { ...request, beneficiaries: [request.beneficiaries[0], request.beneficiaries[0], request.beneficiaries[1]] } }), /duplicate|member/i);
  await assert.rejects(() => f.service.createExecutionPreview({ actorAddress: OWNER, proposalId: 'proposal-1', input: { ...request, recipients: { ...request.recipients, credRewards: request.recipients.swarmTreasury } } }), /distinct|duplicate/i);
  await assert.rejects(() => f.service.createExecutionPreview({ actorAddress: OWNER, proposalId: 'proposal-1', input: { ...request, revenueAssets: [request.revenueAssets[0], request.revenueAssets[0]] } }), /unique|duplicate/i);
});

test('converts live Console millisecond consent expiry to deterministic onchain seconds', async () => {
  const f = fixture({ now: () => 1_792_000_000_123 }); await unanimous(f);
  await f.service.createExecutionPreview({ actorAddress: OWNER, proposalId: 'proposal-1', input: request });
  assert.equal(f.calls[0].readinessManifest.sourceConsent.expiresAt, 1_792_086_400_123);
  assert.equal(f.calls[0].conversion.timing.authorizationDeadline, 1_792_086_400);
  assert.equal(f.calls[0].conversion.timing.start, 1_792_691_200);
});

test('rejects any builder result that is executable, signed, transactional, or not canonical preparation-only', async () => {
  const unsafeCases = [
    { execution: { mode: 'AUTHORIZED_NO_BROADCAST', deploymentAuthorized: false, broadcastPrepared: false, transactionCount: 0 }, authorization: { status: 'NOT_ATTACHED', signatures: [] } },
    { execution: { mode: 'PREPARATION_ONLY', deploymentAuthorized: true, broadcastPrepared: false, transactionCount: 0 }, authorization: { status: 'NOT_ATTACHED', signatures: [] } },
    { execution: { mode: 'PREPARATION_ONLY', deploymentAuthorized: false, broadcastPrepared: true, transactionCount: 0 }, authorization: { status: 'NOT_ATTACHED', signatures: [] } },
    { execution: { mode: 'PREPARATION_ONLY', deploymentAuthorized: false, broadcastPrepared: false, transactionCount: 1 }, authorization: { status: 'NOT_ATTACHED', signatures: [] } },
    { execution: { mode: 'PREPARATION_ONLY', deploymentAuthorized: false, broadcastPrepared: false, transactionCount: 0 }, authorization: { status: 'SIGNATURES_ATTACHED_UNVERIFIED', signatures: ['0x12'] } },
  ];
  for (const unsafe of unsafeCases) {
    const f = fixture({ executionPacketBuilder: (value) => { const packet = { ...unsafe, schema: 'multipass.swarm-token-launch-packet.v1', chainId: 8453, factory: FACTORY, sourceReadiness: { sha256: value.readinessPacketSha256 }, safety: { keysIncluded: false, signaturesIncluded: false, transactionDataIncluded: false, calldataIncluded: false, secretsIncluded: false, externalAdapterDataIncluded: false, rpcSendMethodsAllowed: false } }; return { manifest: packet, manifestSha256: '0x' + createHash('sha256').update(canonicalSwarmLaunchJson(packet)).digest('hex'), typedData: {} }; } });
    await unanimous(f);
    await assert.rejects(() => f.service.createExecutionPreview({ actorAddress: OWNER, proposalId: 'proposal-1', input: request }), /preparation|unsafe|invalid/i);
  }
});
