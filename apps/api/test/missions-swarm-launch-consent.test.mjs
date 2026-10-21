import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSwarmLaunchConsentMessage, createSwarmLaunchConsentService } from '../src/missions/swarm-launch-consent.js';

const OWNER = '0x1111111111111111111111111111111111111111';
const PARTNER = '0x2222222222222222222222222222222222222222';
const HASH = '0x' + 'a'.repeat(64);
const workspaceManifest = Object.freeze({ schema: 'multipass.swarm-workspace.v1', mode: 'PREPARATION_ONLY', provider: 'TWIGPINE', repository: { cardinality: 'ONE_PER_SWARM', slug: 'signal-swarm', visibility: 'PUBLIC', defaultBranch: 'main', protectedBranches: ['main'], provisioningStatus: 'NOT_PROVISIONED' }, members: [{ tokenId: '1', didKey: 'did:key:z6MkeXBLjYiSvqnhFb6D7sHm8yKm4jV45wwBFRaatf1cfZ76', sharedKey: false }, { tokenId: '2', didKey: 'did:key:z6Mkeb6dsrBTX95vPgLiZAcgRr6XJthFm1czoqFEx34DQtRo', sharedKey: false }, { tokenId: '3', didKey: 'did:key:z6Mkef1w29eU7SP9XmbDzTwbiisHZ3uTS5JpNEuu1R6pADkW', sharedKey: false }], delegation: { protocol: 'UCAN', authorizationMode: 'OWNER_ONLY', capabilityStatus: 'REQUIRED_UNAVAILABLE', requiredScopes: ['git/fetch', 'git/push', 'pr/open', 'pr/review'], expirationRequired: true }, provenance: { signedPushes: 'REQUIRED', certificates: 'REQUIRED', pullRequests: 'REQUIRED', reviews: 'REQUIRED', verificationStatus: 'NOT_VERIFIED' }, githubMirror: { enabled: false, owner: null, repository: null }, authorityBoundary: { gitAuthorizesWallets: false, gitAuthorizesTransactions: false, gitAuthorizesDeployment: false, gitAuthorizesFinancialExecution: false, executionConsentAuthority: 'SWARM_COMMAND' } });

const manifest = Object.freeze({ schema: 'multipass.swarm-launch.v2', chainId: 8453, execution: { mode: 'PREPARATION_ONLY', deploymentAuthorized: false }, app: { name: 'A', pitch: 'Ship.', template: 'web_app', revenueModel: 'subscription', shipTarget: '30_days' }, token: { name: 'T', ticker: 'TOKEN', supply: '1000000000', curve: 'bonding_curve_to_dex' }, economics: { model: 'PROVIDER_NEUTRAL_V1', agentVesting: { allocationBps: 4500, cliffMonths: 6, durationMonths: 18 }, credRewards: { allocationBps: 1500, beneficiary: 'CRED_STAKERS', provider: 'UNSELECTED' }, swarmTreasury: { allocationBps: 1500, control: 'SWARM_MULTISIG_REQUIRED' }, publicDistribution: { allocationBps: 2500, mechanism: 'UNSELECTED' }, totalAllocationBps: 10000 }, workspace: workspaceManifest, members: [
  { identity: { tokenId: '1' }, consentAuthority: OWNER, contributionBps: 4000 },
  { identity: { tokenId: '2' }, consentAuthority: PARTNER, contributionBps: 3500 },
  { identity: { tokenId: '3' }, consentAuthority: PARTNER, contributionBps: 2500 },
] });
const input = { members: [{ tokenId: '1', ownerAddress: OWNER }, { tokenId: '2', ownerAddress: PARTNER }, { tokenId: '3', ownerAddress: PARTNER }], app: { name: 'A' }, token: { name: 'T' } };

function fixture() {
  const records = new Map();
  const store = {
    create(value) { records.set(value.proposalId, { ...value, consents: [] }); return records.get(value.proposalId); },
    read(id) { return records.get(id) ?? null; },
    consent({ proposalId, wallet, signatureHash, consentedAt }) { const current = records.get(proposalId); if (!current.consents.some((entry) => entry.wallet === wallet)) current.consents.push({ wallet, signatureHash, consentedAt }); return current; },
  };
  const previews = [];
  const authorizations = [];
  const verified = [];
  const service = createSwarmLaunchConsentService({
    store,
    createId: () => 'proposal-1',
    now: () => 1_000,
    preview: async (request) => { previews.push(request); return { manifest, manifestSha256: HASH, input }; },
    authorizeLooper: async (request) => { authorizations.push(request); return { tokenId: request.tokenId, owner: request.wallet, controllerVerified: true }; },
    verifySignature: async (request) => { verified.push(request); return request.signature === '0x' + 'aa'.repeat(65); },
  });
  return { service, records, previews, authorizations, verified };
}

test('initiator creates an immutable preparation-only proposal with per-wallet pending consent', async () => {
  const f = fixture();
  const proposal = await f.service.createProposal({ actorAddress: OWNER, input });
  assert.equal(proposal.proposalId, 'proposal-1');
  assert.equal(proposal.status, 'COLLECTING_CONSENT');
  assert.deepEqual(proposal.participants, [
    { wallet: OWNER, tokenIds: ['1'], consentedAt: null },
    { wallet: PARTNER, tokenIds: ['2', '3'], consentedAt: null },
  ]);
  assert.equal(Object.hasOwn(proposal, 'signature'), false);
  assert.equal(f.previews.length, 1);
  assert.deepEqual(f.records.get('proposal-1').input.economics, { agentVestingBps: 4500, credRewardsBps: 1500, swarmTreasuryBps: 1500, publicDistributionBps: 2500, agentCliffMonths: 6, agentVestingMonths: 18 });
});

test('only nominated wallets can read or sign a proposal', async () => {
  const f = fixture();
  await f.service.createProposal({ actorAddress: OWNER, input });
  assert.equal((await f.service.readProposal({ actorAddress: PARTNER, proposalId: 'proposal-1' })).manifestSha256, HASH);
  await assert.rejects(() => f.service.readProposal({ actorAddress: '0x3333333333333333333333333333333333333333', proposalId: 'proposal-1' }), /nominated/i);
});

test('consent verifies the exact manifest-bound message and current Looper control without storing a raw signature', async () => {
  const f = fixture();
  await f.service.createProposal({ actorAddress: OWNER, input });
  const challenge = await f.service.readChallenge({ actorAddress: PARTNER, proposalId: 'proposal-1' });
  assert.equal(challenge.message, buildSwarmLaunchConsentMessage({ proposalId: 'proposal-1', manifestSha256: HASH, wallet: PARTNER, tokenIds: ['2', '3'], expiresAt: 86_401_000 }));
  const result = await f.service.recordConsent({ actorAddress: PARTNER, proposalId: 'proposal-1', signature: '0x' + 'aa'.repeat(65) });
  assert.equal(result.status, 'COLLECTING_CONSENT');
  assert.equal(result.participants[1].consentedAt, 1_000);
  assert.deepEqual(f.authorizations.map((entry) => entry.tokenId), ['2', '3']);
  assert.equal(f.verified[0].message, challenge.message);
  assert.equal(JSON.stringify([...f.records.values()]).includes('0xsigned'), false);
});

test('proposal reports signatures collected only after every wallet signs and never authorizes deployment', async () => {
  const f = fixture();
  await f.service.createProposal({ actorAddress: OWNER, input });
  await f.service.recordConsent({ actorAddress: PARTNER, proposalId: 'proposal-1', signature: '0x' + 'aa'.repeat(65) });
  const result = await f.service.recordConsent({ actorAddress: OWNER, proposalId: 'proposal-1', signature: '0x' + 'aa'.repeat(65) });
  assert.equal(result.status, 'SIGNATURES_COLLECTED');
  assert.equal(result.deploymentAuthorized, false);
  assert.equal(result.revalidationRequired, true);
  assert.equal(f.previews.length, 3);
});

test('invalid signatures, expired proposals, and changed canonical manifests fail closed', async () => {
  const f = fixture();
  await f.service.createProposal({ actorAddress: OWNER, input });
  await assert.rejects(() => f.service.recordConsent({ actorAddress: OWNER, proposalId: 'proposal-1', signature: '0xbb' }), /verify/i);

  const changed = createSwarmLaunchConsentService({
    store: { create() {}, read: () => f.records.get('proposal-1'), consent() {} },
    createId: () => 'unused', now: () => 2_000,
    preview: async () => ({ manifest, manifestSha256: '0x' + 'b'.repeat(64), input }),
    authorizeLooper: async () => ({ controllerVerified: true }), verifySignature: async () => true,
  });
  await assert.rejects(() => changed.recordConsent({ actorAddress: OWNER, proposalId: 'proposal-1', signature: '0x' + 'aa'.repeat(65) }), /changed/i);

  const record = f.records.get('proposal-1'); record.expiresAt = 999;
  assert.equal((await f.service.readProposal({ actorAddress: OWNER, proposalId: 'proposal-1' })).status, 'EXPIRED');
  await assert.rejects(() => f.service.readChallenge({ actorAddress: OWNER, proposalId: 'proposal-1' }), /expired/i);
});


test('creates a deterministic readiness packet only for a participant after unanimous consent', async () => {
  const f = fixture();
  await f.service.createProposal({ actorAddress: OWNER, input });
  await assert.rejects(() => f.service.createReadinessPacket({ actorAddress: OWNER, proposalId: 'proposal-1' }), /unanimous/i);
  await f.service.recordConsent({ actorAddress: PARTNER, proposalId: 'proposal-1', signature: '0x' + 'aa'.repeat(65) });
  await f.service.recordConsent({ actorAddress: OWNER, proposalId: 'proposal-1', signature: '0x' + 'aa'.repeat(65) });
  const result = await f.service.createReadinessPacket({ actorAddress: OWNER, proposalId: 'proposal-1' });
  assert.equal(result.packet.execution.mode, 'SIMULATION_ONLY');
  assert.equal(result.packet.execution.deploymentAuthorized, false);
  assert.equal(result.packet.sourceConsent.manifestSha256, HASH);
  assert.match(result.packetSha256, /^0x[0-9a-f]{64}$/u);
  assert.equal(f.previews.length, 4);
  await assert.rejects(() => f.service.createReadinessPacket({ actorAddress: '0x3333333333333333333333333333333333333333', proposalId: 'proposal-1' }), /nominated/i);
  f.records.get('proposal-1').expiresAt = 999;
  await assert.rejects(() => f.service.createReadinessPacket({ actorAddress: OWNER, proposalId: 'proposal-1' }), /expired/i);
});
