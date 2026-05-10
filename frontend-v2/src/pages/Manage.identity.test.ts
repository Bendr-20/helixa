import test from 'node:test';
import assert from 'node:assert/strict';
import { buildManageIdentityState } from './manageIdentity.ts';

test('treats an offchain human-only profile as a managed Helixa identity', () => {
  const state = buildManageIdentityState({
    records: [],
    fetchedHuman: {
      id: 'human_quigley',
      entityType: 'human',
      name: 'Quigley',
      tokenId: null,
      walletAddress: null,
      description: 'Product direction',
      humanCred: { score: 42 },
    },
  });

  assert.equal(state.identityTitle, 'Manage Your Helixa Identity');
  assert.equal(state.humanSummaries.length, 1);
  assert.equal(state.humanSummaries[0].name, 'Quigley');
  assert.equal(state.humanSummaries[0].statusLabel, 'Offchain profile');
  assert.equal(state.humanSummaries[0].publicPath, '/h/human_quigley');
  assert.equal(state.ownedAgents.length, 0);
  assert.equal(state.hasOnlyHumanProfile, true);
  assert.equal(state.emptyAgentTitle, 'No agents linked yet');
});

test('keeps agent tools available when the signed-in identity owns agents', () => {
  const state = buildManageIdentityState({
    records: [
      {
        tokenId: 81,
        name: 'Quigbot',
        framework: 'openclaw',
        mintOrigin: 'AGENT',
        owner: '0x123',
      },
      {
        tokenId: 222,
        name: 'Quigley',
        framework: 'human',
        mintOrigin: 'HUMAN',
        owner: '0x123',
      },
    ],
    fetchedHuman: null,
  });

  assert.equal(state.humanSummaries.length, 1);
  assert.equal(state.humanSummaries[0].publicPath, '/h/222');
  assert.equal(state.ownedAgents.length, 1);
  assert.equal(state.hasOnlyHumanProfile, false);
  assert.equal(state.showAgentTools, true);
});
