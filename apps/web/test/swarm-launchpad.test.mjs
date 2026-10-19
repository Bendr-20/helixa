import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSwarmLaunchManifest,
  canonicalSwarmLaunchJson,
  evaluateSwarmLaunchGate,
  normalizeSwarmLaunchDraft,
  normalizeSwarmLaunchForm,
  renderSwarmLaunchpad,
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

function draft(overrides = {}) {
  return {
    members,
    app: { name: 'Signal Swarm', pitch: 'Agent-built analytics.', template: 'web_app', revenueModel: 'subscription', shipTarget: '30_days' },
    token: { name: 'Signal Swarm', ticker: 'SIGSWARM', supply: '1000000000', curve: 'bonding_curve_to_dex' },
    ...overrides,
  };
}

test('launch gate requires 3-5 fresh verified Loopers, average CRED 65, and exact 10,000 bps', () => {
  const passed = evaluateSwarmLaunchGate(draft());
  assert.equal(passed.eligible, true);
  assert.equal(passed.averageCred, 73);
  assert.equal(passed.totalContributionBps, 10000);
  assert.deepEqual(passed.blockers, []);

  assert.match(evaluateSwarmLaunchGate(draft({ members: members.slice(0, 2) })).blockers.join(' '), /three/i);
  assert.match(evaluateSwarmLaunchGate(draft({ members: members.map((member) => ({ ...member, cred: freshCred(40, 'MARGINAL') })) })).blockers.join(' '), /average CRED/i);
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
    ['member_1_role', 'Lead'], ['member_1_bps', '4000'], ['member_57_role', 'Builder'], ['member_57_bps', '3500'], ['member_74_role', 'Operator'], ['member_74_bps', '2500'],
  ]);
  const normalized = normalizeSwarmLaunchForm({ get: (key) => values.get(key) ?? null }, members);
  assert.equal(normalized.members[1].role, 'Builder');
  assert.equal(normalized.members[1].contributionBps, 3500);
  assert.equal(normalized.token.ticker, 'SIGSWARM');
});

test('manifest is deterministic, preparation-only, Base-bound, and contains no third-party settlement assumptions', () => {
  const normalized = normalizeSwarmLaunchDraft(draft());
  const manifest = buildSwarmLaunchManifest(normalized);
  assert.equal(manifest.schema, 'multipass.swarm-launch.v1');
  assert.equal(manifest.chainId, 8453);
  assert.equal(manifest.execution.mode, 'PREPARATION_ONLY');
  assert.equal('settlement' in manifest, false);
  assert.equal(manifest.members.reduce((sum, member) => sum + member.contributionBps, 0), 10000);
  assert.equal(manifest.members.every((member) => member.vault.status === 'UNPREPARED'), true);
  assert.equal(canonicalSwarmLaunchJson(manifest), canonicalSwarmLaunchJson(buildSwarmLaunchManifest(normalized)));
});

test('Launchpad renders verified CRED, split, token terms, and no live-launch claim', () => {
  const html = renderSwarmLaunchpad({ status: 'editing', draft: draft(), agents: members });
  assert.match(html, /Form a swarm/i);
  assert.match(html, /Launch its token/i);
  assert.match(html, /avg CRED 73/i);
  assert.doesNotMatch(html, /Mosh/i);
  assert.doesNotMatch(html, /bundle claims/i);
  assert.doesNotMatch(html, /third-party settlement/i);
  assert.match(html, /data-swarm-launch-submit[^>]*>Prepare launch manifest</i);
  assert.match(html, /No token, vault, curve, or fee stream will be deployed/i);
  assert.equal((html.match(/data-swarm-member/g) ?? []).length, 3);
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
