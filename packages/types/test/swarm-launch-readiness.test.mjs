import assert from 'node:assert/strict';
import test from 'node:test';

import * as launch from '../src/swarm-launch.js';

const OWNER = '0x1111111111111111111111111111111111111111';
const WORKSPACE = {
  schema: 'multipass.swarm-workspace.v1', mode: 'PREPARATION_ONLY', provider: 'TWIGPINE',
  repository: { cardinality: 'ONE_PER_SWARM', slug: 'signal-swarm', visibility: 'PUBLIC', defaultBranch: 'main', protectedBranches: ['main'], provisioningStatus: 'NOT_PROVISIONED' },
  members: [{ tokenId: '1', didKey: 'did:key:z6MkeXBLjYiSvqnhFb6D7sHm8yKm4jV45wwBFRaatf1cfZ76', sharedKey: false }, { tokenId: '2', didKey: 'did:key:z6Mkeb6dsrBTX95vPgLiZAcgRr6XJthFm1czoqFEx34DQtRo', sharedKey: false }, { tokenId: '3', didKey: 'did:key:z6Mkef1w29eU7SP9XmbDzTwbiisHZ3uTS5JpNEuu1R6pADkW', sharedKey: false }],
  delegation: { protocol: 'UCAN', authorizationMode: 'OWNER_ONLY', capabilityStatus: 'REQUIRED_UNAVAILABLE', requiredScopes: ['git/fetch', 'git/push', 'pr/open', 'pr/review'], expirationRequired: true },
  provenance: { signedPushes: 'REQUIRED', certificates: 'REQUIRED', pullRequests: 'REQUIRED', reviews: 'REQUIRED', verificationStatus: 'NOT_VERIFIED' },
  githubMirror: { enabled: false, owner: null, repository: null },
  authorityBoundary: { gitAuthorizesWallets: false, gitAuthorizesTransactions: false, gitAuthorizesDeployment: false, gitAuthorizesFinancialExecution: false, executionConsentAuthority: 'SWARM_COMMAND' },
};

test('normalizes a provider-neutral allocation and vesting plan totaling 10,000 bps', () => {
  assert.equal(typeof launch.normalizeSwarmLaunchEconomics, 'function');
  const economics = launch.normalizeSwarmLaunchEconomics({
    agentVestingBps: 4500,
    credRewardsBps: 1500,
    swarmTreasuryBps: 1500,
    publicDistributionBps: 2500,
    agentCliffMonths: 6,
    agentVestingMonths: 18,
  });
  assert.equal(economics.totalAllocationBps, 10_000);
  assert.deepEqual(economics.agentVesting, { allocationBps: 4500, cliffMonths: 6, durationMonths: 18 });
  assert.deepEqual(economics.credRewards, { allocationBps: 1500, beneficiary: 'CRED_STAKERS', provider: 'UNSELECTED' });
  assert.equal(Object.hasOwn(economics, 'providerAddress'), false);
});

test('rejects allocation plans that do not total 10,000 bps', () => {
  assert.throws(() => launch.normalizeSwarmLaunchEconomics({
    agentVestingBps: 4500,
    credRewardsBps: 1500,
    swarmTreasuryBps: 1500,
    publicDistributionBps: 2000,
    agentCliffMonths: 6,
    agentVestingMonths: 18,
  }), /10,000/i);
});

test('builds a deterministic simulation-only readiness packet from unanimously consented terms', () => {
  assert.equal(typeof launch.buildSwarmLaunchReadinessPacket, 'function');
  const manifest = {
    schema: launch.SWARM_LAUNCH_SCHEMA,
    chainId: 8453,
    execution: { mode: 'PREPARATION_ONLY', deploymentAuthorized: false, requiresSeparateApproval: true },
    app: { name: 'Signal' },
    token: { name: 'Signal', ticker: 'SIGNAL', supply: '1000000000' },
    economics: launch.normalizeSwarmLaunchEconomics({ agentVestingBps: 4500, credRewardsBps: 1500, swarmTreasuryBps: 1500, publicDistributionBps: 2500, agentCliffMonths: 6, agentVestingMonths: 18 }),
    workspace: WORKSPACE,
    members: [
      { identity: { tokenId: '1' }, consentAuthority: OWNER, contributionBps: 4000 },
      { identity: { tokenId: '2' }, consentAuthority: OWNER, contributionBps: 3500 },
      { identity: { tokenId: '3' }, consentAuthority: OWNER, contributionBps: 2500 },
    ],
  };
  const proposal = { proposalId: 'consent-1', status: 'SIGNATURES_COLLECTED', manifestSha256: '0x' + 'a'.repeat(64), manifest, expiresAt: 2_000 };
  const first = launch.buildSwarmLaunchReadinessPacket({ proposal, now: 1_000 });
  const second = launch.buildSwarmLaunchReadinessPacket({ proposal, now: 1_500 });
  assert.equal(first.schema, 'multipass.swarm-launch-readiness.v2');
  assert.deepEqual(first.execution, { mode: 'SIMULATION_ONLY', deploymentAuthorized: false, providerSelected: false, onchainTargets: [], transactionCount: 0, requiresSeparateExecutionConsent: true });
  assert.deepEqual(first.agentVesting.allocations.map((entry) => entry.shareBps), [4000, 3500, 2500]);
  assert.equal(first.allocations.totalBps, 10_000);
  assert.deepEqual(first.workspace, WORKSPACE);
  assert.equal(first.requiredGates.includes('PROVISION_TWIGPINE_REPOSITORY'), true);
  assert.equal(first.requiredGates.includes('VERIFY_TWIGPINE_CERTIFICATES_AND_PROVENANCE'), true);
  assert.equal(first.requiredGates.includes('ENABLE_SCOPED_EXPIRING_UCAN_DELEGATION'), true);
  assert.deepEqual(first.requiredPrimitives, { contributionRegistry: { weights: 'CONSENTED_CONTRIBUTION_BPS', mutable: false, address: null }, agentVesting: { implementation: 'AUDITED_EXTERNAL_STREAMS_REQUIRED', transferable: false, addresses: [] }, revenueSplitter: { mode: 'PULL_MULTI_ASSET', weights: 'CONSENTED_CONTRIBUTION_BPS', implementation: 'UNSELECTED', address: null }, swapHook: { required: false, implementation: 'UNSELECTED', address: null } });
  assert.equal(launch.canonicalSwarmLaunchJson(first), launch.canonicalSwarmLaunchJson(second));
  assert.equal(JSON.stringify(first).match(/pantheon|openlaunch|mosh/iu), null);
});

test('readiness packet fails closed before unanimous live consent', () => {
  const proposal = { proposalId: 'consent-1', status: 'COLLECTING_CONSENT', manifestSha256: '0x' + 'a'.repeat(64), manifest: { execution: { mode: 'PREPARATION_ONLY', deploymentAuthorized: false } }, expiresAt: 2_000 };
  assert.throws(() => launch.buildSwarmLaunchReadinessPacket({ proposal, now: 1_000 }), /unanimous/i);
  assert.throws(() => launch.buildSwarmLaunchReadinessPacket({ proposal: { ...proposal, status: 'SIGNATURES_COLLECTED' }, now: 2_000 }), /expired/i);
});

test('legacy v1 launch manifests require recreation with a workspace-bound v2 hash', () => {
  const proposal = { proposalId: 'legacy-1', status: 'SIGNATURES_COLLECTED', manifestSha256: '0x' + 'a'.repeat(64), expiresAt: 2_000, manifest: { schema: 'multipass.swarm-launch.v1', chainId: 8453, execution: { mode: 'PREPARATION_ONLY', deploymentAuthorized: false } } };
  assert.throws(() => launch.buildSwarmLaunchReadinessPacket({ proposal, now: 1_000 }), /legacy|recreated|workspace/i);
});

const cred = (score) => ({ status: 'available', score, tier: 'QUALIFIED', coverage: { score: 80, label: 'STRONG' }, freshness: { stale: false }, methodologyVersion: 'looper-cred-v1', computedAt: '2026-10-20T00:00:00.000Z' });

test('includes allocation and vesting economics inside the consented launch manifest', () => {
  const draft = launch.normalizeSwarmLaunchDraft({
    members: [
      { tokenId: '1', ownerAddress: OWNER, name: 'One', role: 'Lead', contributionBps: 4000, cred: cred(70), erc8004Id: '8453:1' },
      { tokenId: '2', ownerAddress: OWNER, name: 'Two', role: 'Build', contributionBps: 3500, cred: cred(71), erc8004Id: '8453:2' },
      { tokenId: '3', ownerAddress: OWNER, name: 'Three', role: 'Operate', contributionBps: 2500, cred: cred(72), erc8004Id: '8453:3' },
    ],
    app: { name: 'Signal', pitch: 'Ship.', template: 'web_app', revenueModel: 'subscription', shipTarget: '30_days' },
    token: { name: 'Signal', ticker: 'SIGNAL', supply: '1000000000', curve: 'bonding_curve_to_dex' },
    economics: { agentVestingBps: 4500, credRewardsBps: 1500, swarmTreasuryBps: 1500, publicDistributionBps: 2500, agentCliffMonths: 6, agentVestingMonths: 18 },
    workspace: { provider: 'TWIGPINE', repository: { slug: 'signal-swarm', visibility: 'PUBLIC' }, members: WORKSPACE.members.map(({ tokenId, didKey }) => ({ tokenId, didKey })), githubMirror: { enabled: false, owner: null, repository: null } },
  });
  const manifest = launch.buildSwarmLaunchManifest(draft);
  assert.equal(manifest.economics.totalAllocationBps, 10_000);
  assert.equal(manifest.economics.credRewards.provider, 'UNSELECTED');
  assert.equal(manifest.execution.deploymentAuthorized, false);
  assert.deepEqual(manifest.workspace, WORKSPACE);
});

test('readiness rejects altered or open workspace manifests', () => {
  const proposal = { proposalId: 'consent-1', status: 'SIGNATURES_COLLECTED', manifestSha256: '0x' + 'a'.repeat(64), expiresAt: 2_000, manifest: { schema: launch.SWARM_LAUNCH_SCHEMA, chainId: 8453, execution: { mode: 'PREPARATION_ONLY', deploymentAuthorized: false }, economics: launch.normalizeSwarmLaunchEconomics({ agentVestingBps: 4500, credRewardsBps: 1500, swarmTreasuryBps: 1500, publicDistributionBps: 2500, agentCliffMonths: 6, agentVestingMonths: 18 }), members: [{ identity: { tokenId: '1' }, consentAuthority: OWNER, contributionBps: 4000 }, { identity: { tokenId: '2' }, consentAuthority: OWNER, contributionBps: 3500 }, { identity: { tokenId: '3' }, consentAuthority: OWNER, contributionBps: 2500 }], workspace: { ...WORKSPACE, unknown: true } } };
  assert.throws(() => launch.buildSwarmLaunchReadinessPacket({ proposal, now: 1_000 }), /workspace.*unknown/i);
});
