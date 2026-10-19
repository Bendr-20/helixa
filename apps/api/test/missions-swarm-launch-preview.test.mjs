import assert from 'node:assert/strict';
import test from 'node:test';
import { previewSwarmLaunch } from '../src/missions/swarm-launch-preview.js';

const OWNER = '0x1234567890abcdef1234567890abcdef12345678';

const cred = (score, tier = 'QUALIFIED') => ({ status: 'available', score, tier, coverage: { score: 80, label: 'STRONG' }, freshness: { stale: false }, methodologyVersion: 'looper-cred-v1', computedAt: '2026-10-19T00:00:00.000Z' });
const canonical = { chainId: 8453, contract: '0x1649CD37f4748807b4882FC48765bA0B2aFfa94a', owner: '0x1234567890abcdef1234567890abcdef12345678', controllerVerified: true };
const agents = [
  { ...canonical, tokenId: '1', name: 'Bendr', role: 'Lead', erc8004AgentId: '18531', cred: cred(74) },
  { ...canonical, tokenId: '57', name: 'Cheryl', role: 'Builder', erc8004AgentId: '57', cred: cred(66) },
  { ...canonical, tokenId: '74', name: 'Axiom', role: 'Operator', erc8004AgentId: '74', cred: cred(79, 'PRIME') },
];
const input = { members: [{ tokenId: '1', role: 'Lead', contributionBps: 4000 }, { tokenId: '57', role: 'Builder', contributionBps: 3500 }, { tokenId: '74', role: 'Operator', contributionBps: 2500 }], app: { name: 'Signal Swarm', pitch: 'Ship analytics.', template: 'web_app', revenueModel: 'subscription', shipTarget: '30_days' }, token: { name: 'Signal Swarm', ticker: 'SIGSWARM', supply: '1000000000', curve: 'bonding_curve_to_dex' } };

test('preview reloads authoritative owned Loopers and returns a hashed preparation-only manifest', async () => {
  const calls = [];
  const result = await previewSwarmLaunch({ owner: '0x1234567890abcdef1234567890abcdef12345678', input, loadOwnedAgents: async (request) => { calls.push(request); return agents; } });
  assert.deepEqual(calls, [{ address: '0x1234567890abcdef1234567890abcdef12345678' }]);
  assert.equal(result.status, 'PREPARATION_ONLY');
  assert.match(result.manifestSha256, /^0x[0-9a-f]{64}$/u);
  assert.equal(result.manifest.members[0].name, 'Bendr');
  assert.equal(result.manifest.members[0].identity.erc8004Id, '8453:18531');
  assert.equal(result.manifest.execution.deploymentAuthorized, false);
});

test('preview rejects non-owned, stale, duplicate, and browser-invented member evidence', async () => {
  await assert.rejects(() => previewSwarmLaunch({ owner: '0x1234567890abcdef1234567890abcdef12345678', input: { ...input, members: [...input.members.slice(0, 2), { tokenId: '999', role: 'Fake', contributionBps: 2500 }] }, loadOwnedAgents: async () => agents }), /owned/i);
  await assert.rejects(() => previewSwarmLaunch({ owner: '0x1234567890abcdef1234567890abcdef12345678', input, loadOwnedAgents: async () => agents.map((agent, index) => index === 1 ? { ...agent, cred: { ...agent.cred, status: 'stale', freshness: { stale: true } } } : agent) }), /CRED|fresh/i);
  await assert.rejects(() => previewSwarmLaunch({ owner: '0x1234567890abcdef1234567890abcdef12345678', input: { ...input, members: [input.members[0], input.members[0], input.members[2]] }, loadOwnedAgents: async () => agents }), /duplicate/i);
  await assert.rejects(() => previewSwarmLaunch({ owner: '0x1234567890abcdef1234567890abcdef12345678', input, loadOwnedAgents: async () => agents.map((agent, index) => index === 1 ? { ...agent, controllerVerified: false } : agent) }), /ownership|controller/i);
});


test('preview validates a multi-wallet roster and records each canonical consent authority', async () => {
  const secondOwner = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
  const multiInput = { ...input, members: [
    { ...input.members[0], ownerAddress: OWNER },
    { ...input.members[1], ownerAddress: secondOwner },
    { ...input.members[2], ownerAddress: secondOwner },
  ] };
  const calls = [];
  const result = await previewSwarmLaunch({ owner: OWNER, input: multiInput, loadOwnedAgents: async ({ address }) => {
    calls.push(address);
    return address === OWNER ? [agents[0]] : agents.slice(1).map((agent) => ({ ...agent, owner: secondOwner }));
  } });
  assert.deepEqual(calls.sort(), [OWNER, secondOwner].sort());
  assert.deepEqual(result.manifest.members.map((member) => member.consentAuthority), [OWNER, secondOwner, secondOwner]);
});

test('preview requires the initiating wallet to control at least one nominated Looper', async () => {
  const secondOwner = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
  await assert.rejects(() => previewSwarmLaunch({
    owner: OWNER,
    input: { ...input, members: input.members.map((member) => ({ ...member, ownerAddress: secondOwner })) },
    loadOwnedAgents: async () => agents.map((agent) => ({ ...agent, owner: secondOwner })),
  }), /initiating wallet/i);
});
