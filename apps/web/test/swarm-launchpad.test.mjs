import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';

import {
  bindSwarmLaunchpad,
  buildSwarmLaunchManifest,
  canonicalSwarmLaunchJson,
  deriveSwarmLaunchDraftFromInvitation,
  evaluateSwarmLaunchGate,
  normalizeSwarmLaunchDraft,
  normalizeSwarmLaunchForm,
  renderSwarmLaunchpad,
  serializeSwarmLaunchRequest,
} from '../src/missions/swarm-launchpad.js';

const freshCred = (score, tier = 'PRIME') => ({
  status: 'available',
  score,
  tier,
  coverage: { score: 80, label: 'STRONG' },
  freshness: { stale: false, cached: false, ageSeconds: 0 },
  methodologyVersion: 'looper-cred-v1',
  computedAt: '2026-10-19T00:00:00.000Z',
});

const members = [
  { tokenId: '1', ownerAddress: '0x1111111111111111111111111111111111111111', name: 'Bendr 2.0', role: 'Lead', contributionBps: 4000, cred: freshCred(74, 'QUALIFIED'), erc8004Id: '8453:18531' },
  { tokenId: '57', ownerAddress: '0x1111111111111111111111111111111111111111', name: 'Cheryl', role: 'Builder', contributionBps: 3500, cred: freshCred(66, 'QUALIFIED'), erc8004Id: '8453:57' },
  { tokenId: '74', ownerAddress: '0x1111111111111111111111111111111111111111', name: 'Axiom', role: 'Operator', contributionBps: 2500, cred: freshCred(79), erc8004Id: '8453:74' },
];
const workspace = { provider: 'TWIGPINE', repository: { slug: 'signal-swarm', visibility: 'PUBLIC' }, members: [{ tokenId: '1', didKey: 'did:key:z6MkeXBLjYiSvqnhFb6D7sHm8yKm4jV45wwBFRaatf1cfZ76' }, { tokenId: '57', didKey: 'did:key:z6Mkeb6dsrBTX95vPgLiZAcgRr6XJthFm1czoqFEx34DQtRo' }, { tokenId: '74', didKey: 'did:key:z6Mkef1w29eU7SP9XmbDzTwbiisHZ3uTS5JpNEuu1R6pADkW' }], githubMirror: { enabled: false, owner: null, repository: null } };

function draft(overrides = {}) {
  return {
    members,
    app: { name: 'Signal Swarm', pitch: 'Agent-built analytics.', template: 'web_app', revenueModel: 'subscription', shipTarget: '30_days' },
    token: { name: 'Signal Swarm', ticker: 'SIGSWARM', supply: '1000000000', curve: 'bonding_curve_to_dex' },
    economics: { agentVestingBps: 4500, credRewardsBps: 1500, swarmTreasuryBps: 1500, publicDistributionBps: 2500, agentCliffMonths: 6, agentVestingMonths: 18 },
    workspace,
    ...overrides,
  };
}

test('launch gate requires 3-5 fresh verified Loopers, beta average CRED 40, and exact 10,000 bps', () => {
  const passed = evaluateSwarmLaunchGate(draft());
  assert.equal(passed.eligible, true);
  assert.equal(passed.averageCred, 73);
  assert.equal(passed.totalContributionBps, 10000);
  assert.deepEqual(passed.blockers, []);

  assert.match(evaluateSwarmLaunchGate(draft({ members: members.slice(0, 2) })).blockers.join(' '), /three/i);
  assert.match(evaluateSwarmLaunchGate(draft({ members: members.map((member) => ({ ...member, cred: freshCred(39, 'MARGINAL') })) })).blockers.join(' '), /beta.*40/i);
  assert.match(evaluateSwarmLaunchGate(draft({ members: members.map((member, index) => ({ ...member, contributionBps: index === 0 ? 4500 : 2500 })) })).blockers.join(' '), /10,000/i);
  assert.match(evaluateSwarmLaunchGate(draft({ members: members.map((member, index) => index === 1 ? { ...member, cred: { ...member.cred, freshness: { stale: true } } } : member) })).blockers.join(' '), /fresh CRED/i);
});

test('normalization rejects duplicate identities, unsafe token terms, and invented score fallbacks', () => {
  assert.throws(() => normalizeSwarmLaunchDraft(draft({ members: [members[0], { ...members[1], tokenId: '1' }, members[2]] })), /duplicate/i);
  assert.throws(() => normalizeSwarmLaunchDraft(draft({ token: { ...draft().token, ticker: 'bad ticker' } })), /ticker/i);
  assert.throws(() => normalizeSwarmLaunchDraft(draft({ members: members.map((member, index) => index === 0 ? { ...member, cred: null } : member) })), /CRED/i);
});

test('form normalization binds editable roles and contribution weights to the verified member set', () => {
  const values = new Map([
    ['app_name', 'Signal Swarm'], ['app_pitch', 'Agent-built analytics.'], ['app_template', 'web_app'], ['revenue_model', 'subscription'], ['ship_target', '30_days'],
    ['token_name', 'Signal Swarm'], ['token_ticker', 'SIGSWARM'], ['token_supply', '1000000000'], ['token_curve', 'bonding_curve_to_dex'],
    ['agent_vesting_bps', '4500'], ['cred_rewards_bps', '1500'], ['swarm_treasury_bps', '1500'], ['public_distribution_bps', '2500'], ['agent_cliff_months', '6'], ['agent_vesting_months', '18'],
    ['workspace_repo_slug', 'signal-swarm'], ['workspace_visibility', 'PUBLIC'], ['workspace_github_mirror_enabled', 'false'],
    ['member_1_did_key', workspace.members[0].didKey], ['member_57_did_key', workspace.members[1].didKey], ['member_74_did_key', workspace.members[2].didKey],
    ['member_1_role', 'Lead'], ['member_1_bps', '4000'], ['member_57_role', 'Builder'], ['member_57_bps', '3500'], ['member_74_role', 'Operator'], ['member_74_bps', '2500'],
  ]);
  const normalized = normalizeSwarmLaunchForm({ get: (key) => values.get(key) ?? null }, members);
  assert.equal(normalized.members[1].role, 'Builder');
  assert.equal(normalized.members[1].contributionBps, 3500);
  assert.equal(normalized.token.ticker, 'SIGSWARM');
  assert.equal(normalized.economics.totalAllocationBps, 10000);
  assert.equal(normalized.workspace.repository.slug, 'signal-swarm');
  assert.equal(normalized.workspace.members[1].didKey, workspace.members[1].didKey);
});

test('manifest is deterministic, preparation-only, Base-bound, and contains no third-party settlement assumptions', () => {
  const normalized = normalizeSwarmLaunchDraft(draft());
  const manifest = buildSwarmLaunchManifest(normalized);
  assert.equal(manifest.schema, 'multipass.swarm-launch.v2');
  assert.equal(manifest.chainId, 8453);
  assert.equal(manifest.execution.mode, 'PREPARATION_ONLY');
  assert.equal('settlement' in manifest, false);
  assert.equal(manifest.members.reduce((sum, member) => sum + member.contributionBps, 0), 10000);
  assert.equal(manifest.members.every((member) => member.vault.status === 'UNPREPARED'), true);
  assert.equal(manifest.workspace.repository.defaultBranch, 'main');
  assert.equal(canonicalSwarmLaunchJson(manifest), canonicalSwarmLaunchJson(buildSwarmLaunchManifest(normalized)));
});

test('Launchpad renders verified CRED, split, token terms, and no live-launch claim', () => {
  const html = renderSwarmLaunchpad({ status: 'editing', draft: draft(), agents: members });
  assert.match(html, /Form a swarm/i);
  assert.match(html, /Launch its token/i);
  assert.match(html, /avg CRED 73/i);
  assert.match(html, /Beta CRED floor[^<]*40/i);
  assert.match(html, /standard[^<]*65/i);
  assert.doesNotMatch(html, /Mosh/i);
  assert.doesNotMatch(html, /bundle claims/i);
  assert.doesNotMatch(html, /third-party settlement/i);
  assert.match(html, /data-swarm-launch-submit[^>]*>Prepare launch manifest</i);
  assert.match(html, /No token, vault, curve, or fee stream will be deployed/i);
  assert.match(html, /name="agent_vesting_bps"[^>]*value="4500"/i);
  assert.match(html, /name="cred_rewards_bps"[^>]*value="1500"/i);
  assert.match(html, /Twigpine workspace/i);
  assert.match(html, /name="workspace_repo_slug"[^>]*value="signal-swarm"/i);
  assert.match(html, /name="workspace_visibility"/i);
  assert.match(html, /name="member_0_did_key"/i);
  assert.match(html, /owner-only/i);
  assert.match(html, /Git never authorizes wallets, transactions, deployment, or financial execution/i);
  assert.equal((html.match(/data-swarm-member/g) ?? []).length, 3);
});


test('Launchpad keeps preparation blocked until repository and did:key workspace fields are present', () => {
  const html = renderSwarmLaunchpad({ status: 'editing', draft: draft({ workspace: undefined }) });
  assert.match(html, /Launch preparation blocked/i);
  assert.match(html, /data-swarm-launch-submit disabled/i);
});

test('Launchpad blocks preparation for duplicate, non-Ed25519 DID keys and incomplete app or token terms', () => {
  const duplicateDid = { ...workspace, members: workspace.members.map((member) => ({ ...member, didKey: workspace.members[0].didKey })) };
  assert.match(renderSwarmLaunchpad({ status: 'editing', draft: draft({ workspace: duplicateDid }) }), /data-swarm-launch-submit disabled/i);
  const invalidDid = { ...workspace, members: workspace.members.map((member, index) => index === 2 ? { ...member, didKey: 'did:key:zThisLooksLongEnoughButIsNotEd25519' } : member) };
  assert.match(renderSwarmLaunchpad({ status: 'editing', draft: draft({ workspace: invalidDid }) }), /data-swarm-launch-submit disabled/i);
  assert.match(renderSwarmLaunchpad({ status: 'editing', draft: draft({ app: { ...draft().app, template: '' } }) }), /data-swarm-launch-submit disabled/i);
  assert.match(renderSwarmLaunchpad({ status: 'editing', draft: draft({ token: { ...draft().token, ticker: '' } }) }), /data-swarm-launch-submit disabled/i);
});

test('launch request serialization includes the complete canonical workspace for preview and consent', () => {
  const source = draft({
    members: members.map((member) => ({ ...member, ownerAddress: member.ownerAddress.toUpperCase().replace('0X', '0x'), role: '  ' + member.role + '  ' })),
    workspace: { ...workspace, repository: { slug: '  signal-swarm  ', visibility: 'PUBLIC' }, members: [...workspace.members].reverse() },
  });
  const body = serializeSwarmLaunchRequest(source);
  assert.deepEqual(body.members.map((member) => member.ownerAddress), members.map((member) => member.ownerAddress));
  assert.deepEqual(body.members.map((member) => member.role), members.map((member) => member.role));
  assert.deepEqual(body.workspace, {
    provider: 'TWIGPINE',
    repository: { slug: 'signal-swarm', visibility: 'PUBLIC' },
    members: workspace.members,
    githubMirror: { enabled: false, owner: null, repository: null },
  });
  assert.notEqual(body.workspace, source.workspace);
  const canonical = normalizeSwarmLaunchDraft({ ...body, members: source.members.map((member, index) => ({ ...member, ...body.members[index] })) });
  assert.equal(canonical.workspace.schema, 'multipass.swarm-workspace.v1');
  assert.equal(canonical.workspace.mode, 'PREPARATION_ONLY');
  assert.equal(canonical.workspace.repository.slug, 'signal-swarm');
  assert.deepEqual(canonical.workspace.members.map(({ tokenId, didKey }) => ({ tokenId, didKey })), workspace.members);
});

test('Launchpad enables preparation after the lead completes every required handoff field', () => {
  const invitationDraft = { lead: { tokenId: '2431', owner: '0x' + '1'.repeat(40) }, invites: [{ tokenId: '3802', owner: '0x' + '2'.repeat(40), status: 'accepted' }, { tokenId: '420', owner: '0x' + '3'.repeat(40), status: 'accepted' }] };
  const dom = new JSDOM('<!doctype html><div id="root"></div>');
  const root = dom.window.document.querySelector('#root');
  root.innerHTML = renderSwarmLaunchpad({ status: 'editing', draft: deriveSwarmLaunchDraftFromInvitation(invitationDraft) });
  bindSwarmLaunchpad(root, {});
  const submit = root.querySelector('[data-swarm-launch-submit]');
  assert.equal(submit.disabled, true);
  const values = { app_template: 'web_app', revenue_model: 'marketplace', ship_target: '30_days', token_name: 'Multipass App Store', token_ticker: 'mpapp', token_supply: '1000000000', token_curve: 'bonding_curve_to_dex', workspace_visibility: 'PUBLIC', member_0_did_key: workspace.members[0].didKey, member_1_did_key: workspace.members[1].didKey, member_2_did_key: workspace.members[2].didKey };
  for (const [name, value] of Object.entries(values)) root.querySelector('[name="' + name + '"]').value = value;
  root.querySelector('[data-swarm-launch-form]').dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  assert.equal(submit.disabled, false);
  assert.equal(submit.hasAttribute('aria-disabled'), false);
});

test('Launchpad exposes editable multi-wallet roster fields before server verification', () => {
  const html = renderSwarmLaunchpad({ status: 'editing', draft: draft(), authenticatedWallet: members[0].ownerAddress });
  assert.match(html, /name="member_0_token"/i);
  assert.match(html, /name="member_0_owner"/i);
  assert.match(html, /Add another Looper/i);
  assert.match(html, /server verifies ownership, controller, and CRED/i);
});

test('prepared Launchpad creates and signs a shareable consent request without deployment authority', () => {
  const manifest = buildSwarmLaunchManifest(normalizeSwarmLaunchDraft(draft()));
  const prepared = renderSwarmLaunchpad({ status: 'prepared', draft: draft(), manifest, manifestSha256: '0x' + 'a'.repeat(64), authenticatedWallet: members[0].ownerAddress });
  assert.match(prepared, /Create consent request/i);
  assert.match(prepared, /fieldset class="swarm-launch-editor" disabled/i);
  assert.match(prepared, /data-swarm-launch-submit disabled[^>]*>Manifest prepared/i);
  const proposal = { proposalId: 'consent-1', status: 'COLLECTING_CONSENT', deploymentAuthorized: false, manifestSha256: '0x' + 'a'.repeat(64), participants: [{ wallet: members[0].ownerAddress, tokenIds: ['1','57','74'], consentedAt: null }], expiresAt: Date.now() + 1000 };
  const collecting = renderSwarmLaunchpad({ status: 'prepared', draft: draft(), manifest, manifestSha256: proposal.manifestSha256, proposal, consentUrl: 'https://helixa.xyz/multipass/console/?launch_consent=consent-1', authenticatedWallet: members[0].ownerAddress });
  assert.match(collecting, /Awaiting 1 wallet consent/i);
  assert.match(collecting, /Sign launch consent/i);
  assert.match(collecting, /launch_consent=consent-1/i);
  assert.doesNotMatch(collecting, /deployment authorized(?!:\s*false)/i);
});


test('unanimous consent unlocks a simulation-only readiness packet without selecting a provider', () => {
  const manifest = buildSwarmLaunchManifest(normalizeSwarmLaunchDraft(draft()));
  const proposal = { proposalId: 'consent-1', status: 'SIGNATURES_COLLECTED', deploymentAuthorized: false, manifestSha256: '0x' + 'a'.repeat(64), participants: [{ wallet: members[0].ownerAddress, tokenIds: ['1','57','74'], consentedAt: 1000 }], expiresAt: 2000 };
  const collected = renderSwarmLaunchpad({ status: 'prepared', draft: draft(), manifest, manifestSha256: proposal.manifestSha256, proposal, authenticatedWallet: members[0].ownerAddress });
  assert.match(collected, /Build readiness packet/i);
  assert.match(collected, /unanimous preparation consent/i);

  const readiness = { packet: { schema: 'multipass.swarm-launch-readiness.v2', execution: { mode: 'SIMULATION_ONLY', deploymentAuthorized: false, providerSelected: false, transactionCount: 0 }, allocations: { agentVestingBps: 4500, credRewardsBps: 1500, swarmTreasuryBps: 1500, publicDistributionBps: 2500, totalBps: 10000 } }, packetSha256: '0x' + 'b'.repeat(64) };
  const rendered = renderSwarmLaunchpad({ status: 'prepared', draft: draft(), manifest, manifestSha256: proposal.manifestSha256, proposal, readiness, authenticatedWallet: members[0].ownerAddress });
  assert.match(rendered, /Simulation-only readiness packet/i);
  assert.match(rendered, new RegExp(readiness.packetSha256));
  assert.match(rendered, /Provider selected:\s*false/i);
  assert.doesNotMatch(rendered, /Pantheon|OpenLaunch|Mosh/i);
});
