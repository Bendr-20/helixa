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
  { tokenId: '1', name: 'Bendr 2.0', role: 'Lead', contributionBps: 4000, cred: freshCred(74, 'QUALIFIED'), erc8004Id: '8453:18531' },
  { tokenId: '57', name: 'Cheryl', role: 'Builder', contributionBps: 3500, cred: freshCred(66, 'QUALIFIED'), erc8004Id: '8453:57' },
  { tokenId: '74', name: 'Axiom', role: 'Operator', contributionBps: 2500, cred: freshCred(79), erc8004Id: '8453:74' },
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

test('manifest is deterministic, preparation-only, Base-bound, and explicit about pending Mosh integration', () => {
  const normalized = normalizeSwarmLaunchDraft(draft());
  const manifest = buildSwarmLaunchManifest(normalized);
  assert.equal(manifest.schema, 'multipass.swarm-launch.v1');
  assert.equal(manifest.chainId, 8453);
  assert.equal(manifest.execution.mode, 'PREPARATION_ONLY');
  assert.equal(manifest.settlement.provider, 'mosh');
  assert.equal(manifest.settlement.memberFeeBps, 8000);
  assert.equal(manifest.settlement.protocolFeeBps, 2000);
  assert.equal(manifest.settlement.integrationStatus, 'PENDING_VERIFIED_ADAPTER');
  assert.equal(manifest.members.reduce((sum, member) => sum + member.contributionBps, 0), 10000);
  assert.equal(manifest.members.every((member) => member.vault.status === 'UNPREPARED'), true);
  assert.equal(canonicalSwarmLaunchJson(manifest), canonicalSwarmLaunchJson(buildSwarmLaunchManifest(normalized)));
});

test('Launchpad renders verified CRED, split, token terms, and no live-launch claim', () => {
  const html = renderSwarmLaunchpad({ status: 'editing', draft: draft(), agents: members });
  assert.match(html, /Form a swarm/i);
  assert.match(html, /Launch its token/i);
  assert.match(html, /avg CRED 73/i);
  assert.match(html, /80% member vaults/i);
  assert.match(html, /20% protocol/i);
  assert.match(html, /data-swarm-launch-submit[^>]*>Prepare launch manifest</i);
  assert.match(html, /No token, vault, curve, or fee stream will be deployed/i);
  assert.equal((html.match(/data-swarm-member/g) ?? []).length, 3);
});
