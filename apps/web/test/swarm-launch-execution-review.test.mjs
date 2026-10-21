import assert from 'node:assert/strict';
import test from 'node:test';

import * as launchpad from '../src/missions/swarm-launchpad.js';

const HASH = '0x' + 'b'.repeat(64);
const CONSENT_HASH = '0x' + 'a'.repeat(64);
const readiness = {
  packetSha256: HASH,
  packet: {
    schema: 'multipass.swarm-launch-readiness.v1', chainId: 8453,
    sourceConsent: { proposalId: 'proposal-1', manifestSha256: CONSENT_HASH, expiresAt: 2_000_000_000 },
    execution: { mode: 'SIMULATION_ONLY', deploymentAuthorized: false, providerSelected: false, transactionCount: 0 },
    agentVesting: { cliffMonths: 6, durationMonths: 18, allocations: [
      { tokenId: '1', consentAuthority: '0x1111111111111111111111111111111111111111', shareBps: 4000 },
      { tokenId: '2', consentAuthority: '0x2222222222222222222222222222222222222222', shareBps: 3500 },
      { tokenId: '3', consentAuthority: '0x3333333333333333333333333333333333333333', shareBps: 2500 },
    ] },
  },
};
const packet = {
  schema: 'multipass.swarm-token-launch-packet.v1', chainId: 8453,
  sourceReadiness: { sha256: HASH, artifact: { sourceConsent: { manifestSha256: CONSENT_HASH } } },
  plan: {
    token: { name: 'Signal Swarm', symbol: 'SIG', decimals: 18, totalSupply: '100000000000000000000000000' },
    allocations: { agentVestingAmount: '45000000000000000000000000', credRewardsAmount: '15000000000000000000000000', swarmTreasuryAmount: '15000000000000000000000000', publicDistributionAmount: '25000000000000000000000000' },
    start: 2_000_604_800, cliff: 15_552_000, duration: 46_656_000,
    requiredSigners: ['0x1111111111111111111111111111111111111111', '0x2222222222222222222222222222222222222222', '0x3333333333333333333333333333333333333333'],
  },
  deployment: { token: '0x4444444444444444444444444444444444444444', registry: '0x5555555555555555555555555555555555555555', splitter: '0x6666666666666666666666666666666666666666', streams: ['0x7777777777777777777777777777777777777777', '0x8888888888888888888888888888888888888888', '0x9999999999999999999999999999999999999999'] },
  authorization: { status: 'NOT_ATTACHED', requiredSigners: ['0x1111111111111111111111111111111111111111', '0x2222222222222222222222222222222222222222', '0x3333333333333333333333333333333333333333'], signatures: [] },
  execution: { mode: 'PREPARATION_ONLY', deploymentAuthorized: false, broadcastPrepared: false, transactionCount: 0 },
  safety: { keysIncluded: false, signaturesIncluded: false, transactionDataIncluded: false, calldataIncluded: false, secretsIncluded: false, externalAdapterDataIncluded: false, rpcSendMethodsAllowed: false },
};
const preview = { packet, packetSha256: '0x' + 'c'.repeat(64) };

function baseState(overrides = {}) { return { draft: { members: [], app: {}, token: {} }, readiness, executionPreview: null, ...overrides }; }

test('execution review form appears only after readiness and collects only reviewed conversion fields', () => {
  assert.equal(typeof launchpad.normalizeSwarmLaunchExecutionReviewForm, 'function');
  const withoutReadiness = launchpad.renderSwarmLaunchpad({ draft: { members: [], app: {}, token: {} } });
  assert.doesNotMatch(withoutReadiness, /data-swarm-launch-execution-review-form/i);
  const html = launchpad.renderSwarmLaunchpad(baseState());
  assert.match(html, /data-swarm-launch-execution-review-form/i);
  assert.match(html, /name="beneficiary_1"/i);
  assert.match(html, /name="beneficiary_2"/i);
  assert.match(html, /name="beneficiary_3"/i);
  assert.match(html, /name="cred_rewards_recipient"/i);
  assert.match(html, /name="swarm_treasury_recipient"/i);
  assert.match(html, /name="public_distribution_recipient"/i);
  assert.match(html, /name="revenue_asset_0"/i);
  assert.doesNotMatch(html, /name="(?:factory|chain|salt|signature|calldata|provider)/i);
});

test('execution review form normalizes exact members, recipients, and one to four assets', () => {
  assert.equal(typeof launchpad.normalizeSwarmLaunchExecutionReviewForm, 'function');
  const values = new Map([
    ['beneficiary_1', '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'], ['beneficiary_2', '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'], ['beneficiary_3', '0xcccccccccccccccccccccccccccccccccccccccc'],
    ['cred_rewards_recipient', '0xdddddddddddddddddddddddddddddddddddddddd'], ['swarm_treasury_recipient', '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'], ['public_distribution_recipient', '0xffffffffffffffffffffffffffffffffffffffff'],
    ['revenue_asset_0', '0x0000000000000000000000000000000000000000'], ['revenue_asset_1', '0x1234567890123456789012345678901234567890'], ['revenue_asset_2', ''], ['revenue_asset_3', ''],
  ]);
  const result = launchpad.normalizeSwarmLaunchExecutionReviewForm({ get: (key) => values.get(key) ?? null }, readiness);
  assert.deepEqual(result.beneficiaries.map((entry) => entry.tokenId), ['1', '2', '3']);
  assert.equal(result.recipients.credRewards, values.get('cred_rewards_recipient'));
  assert.deepEqual(result.revenueAssets, [values.get('revenue_asset_0'), values.get('revenue_asset_1')]);
});

test('validated execution preview renders complete review terms and no execution controls', () => {
  assert.equal(typeof launchpad.validateSwarmLaunchExecutionPreview, 'function');
  const validated = launchpad.validateSwarmLaunchExecutionPreview(preview, readiness);
  const html = launchpad.renderSwarmLaunchpad(baseState({ executionPreview: validated }));
  for (const expected of ['Signal Swarm', 'SIG', packet.plan.token.totalSupply, packet.plan.allocations.agentVestingAmount, packet.plan.allocations.credRewardsAmount, packet.plan.allocations.swarmTreasuryAmount, packet.plan.allocations.publicDistributionAmount, packet.deployment.token, packet.deployment.registry, packet.deployment.splitter, ...packet.deployment.streams, HASH, CONSENT_HASH, preview.packetSha256]) assert.match(html, new RegExp(expected));
  assert.match(html, /Provider adapter:\s*not selected/i);
  assert.match(html, /Deployment authorized:\s*false/i);
  assert.match(html, /Transactions:\s*0/i);
  assert.match(html, /6 months/i);
  assert.match(html, /18 months/i);
  assert.doesNotMatch(html, /data-(?:sign|approve|deploy|execute|broadcast|calldata)/i);
});

test('execution preview response validation fails closed on lineage, signer order, signatures, or executable state', () => {
  assert.equal(typeof launchpad.validateSwarmLaunchExecutionPreview, 'function');
  const cases = [
    { ...preview, packet: { ...packet, sourceReadiness: { ...packet.sourceReadiness, sha256: '0x' + 'd'.repeat(64) } } },
    { ...preview, packet: { ...packet, authorization: { ...packet.authorization, requiredSigners: [...packet.authorization.requiredSigners].reverse() } } },
    { ...preview, packet: { ...packet, authorization: { ...packet.authorization, signatures: ['0x12'] } } },
    { ...preview, packet: { ...packet, execution: { ...packet.execution, transactionCount: 1 } } },
    { ...preview, packet: { ...packet, safety: { ...packet.safety, calldataIncluded: true } } },
  ];
  for (const value of cases) assert.throws(() => launchpad.validateSwarmLaunchExecutionPreview(value, readiness), /invalid|unsafe|lineage|signer/i);
});
