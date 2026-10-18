import assert from 'node:assert/strict';
import test from 'node:test';

import { missionCardView, missionWorkspaceView, settlementView, sourceView, validateMissionAllocationTotals } from '../src/missions/domain.js';

const A = (value) => '0x' + value.repeat(40).slice(0, 40);
const H = (value) => value.repeat(64).slice(0, 64);

test('mission cards preserve raw funding amounts, deadlines, roles, and truthful source labels', () => {
  const card = missionCardView({ missionId: 'mission-1', title: 'Build', publicSummary: 'Build safely', state: 'recruiting', roles: ['builder'], applicationClosesAt: 100, launchDeadline: 200, funding: [{ token: A('1'), symbol: 'USDC', requiredRaw: '1000000', fundedRaw: '0', finalized: false }], source: { label: 'onchain', status: 'stale' } });
  assert.equal(card.funding[0].requiredRaw, '1000000');
  assert.deepEqual(card.source, { label: 'onchain', displayLabel: 'Onchain', status: 'stale' });
  assert.equal(Object.isFrozen(card), true);
});

test('workspace separates ledger, chain, ID Agents, and XMTP source status', () => {
  const workspace = missionWorkspaceView({ missionId: 'mission-1', chat: { items: [], source: { label: 'xmtp', status: 'degraded' } }, tasks: { items: [], source: { label: 'id_agents', status: 'current' } } });
  assert.equal(workspace.chat.source.displayLabel, 'XMTP');
  assert.equal(workspace.tasks.source.displayLabel, 'ID Agents');
  assert.equal(workspace.funding.source.displayLabel, 'Onchain');
  assert.throws(() => missionWorkspaceView({ missionId: 'mission-1', manager_location: 'secret' }), /internal/);
});

test('allocation totals are exact BigInt strings and settlement never equates payment with CRED', () => {
  const allocations = [{ token: A('1'), recipient: A('2'), amountRaw: '500000', symbol: 'USDC' }, { token: A('1'), recipient: A('3'), amountRaw: '500000', symbol: 'USDC' }];
  assert.equal(validateMissionAllocationTotals({ allocations, requiredByToken: { [A('1')]: '1000000' } }).length, 2);
  assert.throws(() => validateMissionAllocationTotals({ allocations, requiredByToken: { [A('1')]: '999999' } }), /do not match/);
  const view = settlementView({ milestoneId: 'mile-1', artifactCommitment: H('a'), payoutCommitment: H('b'), approvals: { owner: true, lead: false }, allocations, finality: 'confirmed', disputeStatus: 'none', source: { label: 'onchain', status: 'current' } });
  assert.equal(Object.hasOwn(view, 'credGain'), false);
  assert.equal(view.finality, 'confirmed');
});

test('source labels are closed and stale/degraded states remain explicit', () => {
  assert.deepEqual(sourceView({ label: 'helixa_ledger', status: 'degraded' }), { label: 'helixa_ledger', displayLabel: 'Helixa ledger', status: 'degraded' });
  assert.throws(() => sourceView({ label: 'model_claim', status: 'current' }), /source label/);
});
