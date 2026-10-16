import assert from 'node:assert/strict';
import test from 'node:test';

import { projectPublicMission, projectPrivateMission } from '../src/missions/service.js';

const privateMission = {
  missionId: 'mission-privacy', state: 'active', revision: 7, publicSummary: 'Public summary',
  applicationClosesAt: 1, launchDeadline: 2, createdAt: 3, updatedAt: 4,
  ownerIdentity: { displayName: 'Owner', contactEmail: 'private@example.test', wallet: '0xprivate' },
  publicDocument: {
    title: 'Visible', requiredRoles: ['builder'], bounty: { asset: 'USDC', amountRaw: '1000' },
    nested: { conversationId: 'secret-conversation', managerUrl: 'http://127.0.0.1:9000', safe: 'visible' },
    evidenceUnderReview: { uri: 'secret-evidence' }, applicationId: 'internal-app', taskId: 'internal-task', artifactId: 'internal-artifact',
  },
  privateDocument: { scope: 'private acceptance', contact: 'private@example.test' },
  applications: [{ applicationId: 'app-1', contact: '@private' }],
  conversationId: 'secret-conversation', managerLocation: '/private/workspace', operationId: 'op-internal',
  evidence: { underReview: true, body: 'secret evidence' },
};

test('public projection recursively omits applications, private scope, contacts, conversations, manager locations, internal IDs, and review evidence', () => {
  const projected = projectPublicMission(privateMission);
  const serialized = JSON.stringify(projected);
  assert.equal(projected.missionId, 'mission-privacy');
  assert.equal(projected.publicDocument.nested.safe, 'visible');
  assert.doesNotMatch(serialized, /private acceptance|private@example|@private|secret-conversation|127\.0\.0\.1|private\/workspace|internal-app|internal-task|internal-artifact|op-internal|secret-evidence|secret evidence/i);
  assert.doesNotMatch(serialized, /applications|privateDocument|conversationId|managerLocation|operationId|evidenceUnderReview/i);
});

test('private projection is party-scoped but still strips credentials, signatures, tokens, and manager secrets', () => {
  const projected = projectPrivateMission({ ...privateMission, apiKey: 'key', signature: '0xsig', managerToken: 'token', walletPrivateKey: 'pk' });
  const serialized = JSON.stringify(projected);
  assert.match(serialized, /private acceptance/);
  assert.doesNotMatch(serialized, /"apiKey"|"signature"|"managerToken"|"walletPrivateKey"/);
});

test('projection rejects executable, cyclic, oversized, and non-plain values', () => {
  assert.throws(() => projectPublicMission({ ...privateMission, publicDocument: { callback() {} } }), /plain JSON/i);
  const cyclic = {}; cyclic.self = cyclic;
  assert.throws(() => projectPublicMission({ ...privateMission, publicDocument: cyclic }), /cyclic/i);
  assert.throws(() => projectPublicMission({ ...privateMission, publicSummary: 'x'.repeat(4097) }), /public summary/i);
});
