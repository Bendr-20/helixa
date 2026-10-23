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
  assert.equal(packet.credifiDocs.compatibilityStatus, 'DOCUMENTED_FLOW_MATCHED_PREPARATION_READY');
  assert.equal(packet.credifiDocs.loanPreviewCreateChainInfoAndIndexerDocumented, true);
  assert.deepEqual(packet.rollout.currentProduction, { enabled: false, allowedTokenIds: ['2431'] });
  assert.deepEqual(packet.rollout.proposedCohortTokenIds, ["11","19","20","32","46","70","100","106","143","149","194","210","273","285","312","349","402","420","480","548","550","558","612","641","645","667","827","905","4151","941","1008","1090","1104","1169","1171","1442","1615","1687","1713","1787","1827","2015","2017","2150","2250","2285","2620","2653","2916","3328"]);
  assert.equal(packet.rollout.preparedCohortSize, 50);
  assert.equal(packet.rollout.distinctOwnerCount, 50);
  assert.equal(packet.rollout.maxLoopersPerOwner, 1);
  assert.equal(packet.rollout.maxSimultaneousNewBorrowers, 1);
  assert.equal(packet.candidates.length, 50);
  assert.equal(new Set(packet.candidates.map(candidate => candidate.owner)).size, 50);
  assert.equal(packet.candidates.filter(candidate => candidate.activePantheonPosition).length, 17);
  for (const candidate of packet.candidates) {
    assert.ok(candidate.score >= 40);
    assert.equal(candidate.ratingStatus, 'PROVISIONAL');
    assert.equal(candidate.methodologyId, 'cred-looper-provisional-1.1.0');
    assert.equal(typeof candidate.activePantheonPosition, 'boolean');
    assert.equal(candidate.selectionStatus, 'INVITE_PENDING_OWNER_OPT_IN');
    assert.equal(candidate.financialEligibilityClaim, false);
  }
});
