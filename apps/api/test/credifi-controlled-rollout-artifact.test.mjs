import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const packetUrl = new URL('../../../review-artifacts/credifi/controlled-rollout-preparation-v1.json', import.meta.url);

test('Credifi controlled rollout packet is preparation-only and owner-diverse', async () => {
  const packet = JSON.parse(await readFile(packetUrl, 'utf8'));
  assert.equal(packet.schemaVersion, 'credifi-looper-rollout-preparation-v1');
  assert.equal(packet.status, 'PREPARATION_ONLY');
  assert.equal(packet.execution.enabled, false);
  assert.equal(packet.rollout.releaseAuthorized, false);
  assert.equal(packet.rollout.productionConfigChangeAuthorized, false);
  assert.equal(packet.rollout.externalInviteAuthorized, false);
  assert.equal(packet.completedControl.tokenId, '2431');
  assert.equal(packet.completedControl.repeatPilot, false);
  assert.equal(packet.credifiDocs.compatibilityStatus, 'BLOCKED_ON_PROVIDER_API_CONTRACT_CONFIRMATION');
  assert.equal(packet.credifiDocs.loanPreviewCreateChainInfoAndIndexerDocumented, false);
  assert.deepEqual(packet.rollout.currentProduction, { enabled: false, allowedTokenIds: ['2431'] });
  assert.deepEqual(packet.rollout.proposedCohortTokenIds, ['11', '32', '46', '51', '70']);
  assert.equal(packet.candidates.length, 5);
  assert.equal(new Set(packet.candidates.map(candidate => candidate.owner)).size, 5);
  for (const candidate of packet.candidates) {
    assert.equal(candidate.score, 42);
    assert.equal(candidate.ratingStatus, 'PROVISIONAL');
    assert.equal(candidate.methodologyId, 'cred-looper-provisional-1.1.0');
    assert.equal(candidate.activePantheonPosition, true);
    assert.equal(candidate.selectionStatus, 'INVITE_PENDING_OWNER_OPT_IN');
    assert.equal(candidate.financialEligibilityClaim, false);
  }
});
