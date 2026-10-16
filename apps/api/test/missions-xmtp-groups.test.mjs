import assert from 'node:assert/strict';
import test from 'node:test';

import { digestMissionBody } from '../src/missions/idempotency.js';
import { createMissionXmtpGroups } from '../src/missions/xmtp-groups.js';

const H = (value) => value.repeat(64).slice(0, 64);
const BRIDGE = { identifierKind: 0, identifier: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' };
const MEMBERS = [
  { identifierKind: 0, identifier: '0x1111111111111111111111111111111111111111' },
  { identifierKind: 0, identifier: '0x2222222222222222222222222222222222222222' },
];

function fixture({ createThrowsAfterWrite = false } = {}) {
  const groups = [];
  const calls = [];
  let binding = null;
  let locked = false;
  const primitives = {
    async syncGroups() { calls.push(['sync']); },
    async listGroups() { return groups.map((group) => ({ id: group.id })); },
    async getGroup(id) { return groups.find((group) => group.id === id) ?? null; },
    async createGroup({ identifiers, metadata }) {
      calls.push(['create', identifiers, metadata]);
      const group = {
        id: 'conversation-' + (groups.length + 1), appData: metadata.appData,
        members: [{ accountIdentifiers: identifiers }], permissions: { policyType: 'open' },
        admins: [], superAdmins: [],
      };
      groups.push(group);
      if (createThrowsAfterWrite) throw new Error('ambiguous timeout');
      return group;
    },
    async describeGroup(id) {
      const group = groups.find((item) => item.id === id);
      return { conversationId: group.id, appData: group.appData, members: group.members, permissions: group.permissions, admins: group.admins, superAdmins: group.superAdmins };
    },
    async updatePermissions(id) { groups.find((group) => group.id === id).permissions = { policyType: 'admin_only' }; calls.push(['permissions', id]); },
    async addAdmin(id, inboxId) { groups.find((group) => group.id === id).admins.push(inboxId); calls.push(['admin', id, inboxId]); },
  };
  const ledger = {
    async acquireLock() { if (locked) return null; locked = true; return 'lock-1'; },
    async releaseLock() { locked = false; },
    async readBinding() { return binding; },
    async saveBinding(value) { binding = value; },
  };
  const xmtp = createMissionXmtpGroups({
    primitives, ledger, bridgeIdentifier: BRIDGE, bridgeInboxId: 'bridge-inbox', now: () => 1234,
    async signMarker(payload) { return 'signed:' + digestMissionBody(payload); },
    async verifyMarker(payload, signature) { return signature === 'signed:' + digestMissionBody(payload); },
  });
  const input = { missionId: 'mission-1', expectedIdentifiers: MEMBERS, roomName: 'Mission One', policyCommitment: H('a') };
  return { xmtp, input, groups, calls, ledger, get binding() { return binding; }, clearBinding() { binding = null; }, setLocked(value) { locked = value; } };
}

test('creates exactly one signed, closed, bridge-admin mission room and persists its commitments', async () => {
  const f = fixture();
  const binding = await f.xmtp.ensureGroup(f.input);
  assert.equal(binding.conversationId, 'conversation-1');
  assert.match(binding.memberCommitment, /^[0-9a-f]{64}$/u);
  assert.equal(binding.policyCommitment, H('a'));
  assert.equal(f.groups[0].members[0].accountIdentifiers.length, 3);
  assert.equal(f.groups[0].permissions.policyType, 'admin_only');
  assert.deepEqual(f.groups[0].admins, ['bridge-inbox']);
  assert.equal(f.binding.conversationId, 'conversation-1');
  await f.xmtp.ensureGroup(f.input);
  assert.equal(f.calls.filter(([name]) => name === 'create').length, 1);
});

test('recovers one canonical room after create timeout and never creates a second', async () => {
  const f = fixture({ createThrowsAfterWrite: true });
  const binding = await f.xmtp.ensureGroup(f.input);
  assert.equal(binding.conversationId, 'conversation-1');
  assert.equal(f.groups.length, 1);
  assert.equal(f.binding.conversationId, 'conversation-1');
});

test('ambiguous, marker-mismatched, unexpected-member, and open-permission candidates fail closed', async () => {
  const ambiguous = fixture();
  await ambiguous.xmtp.ensureGroup(ambiguous.input);
  ambiguous.clearBinding();
  ambiguous.groups.push({ ...structuredClone(ambiguous.groups[0]), id: 'conversation-2' });
  await assert.rejects(() => ambiguous.xmtp.ensureGroup(ambiguous.input), (error) => error.code === 'room_ambiguous');

  const membership = fixture();
  await membership.xmtp.ensureGroup(membership.input);
  membership.groups[0].members[0].accountIdentifiers = [...membership.groups[0].members[0].accountIdentifiers, { identifierKind: 0, identifier: '0x3333333333333333333333333333333333333333' }];
  await assert.rejects(() => membership.xmtp.ensureGroup(membership.input), (error) => error.code === 'room_membership_mismatch');

  const permissions = fixture();
  await permissions.xmtp.ensureGroup(permissions.input);
  permissions.groups[0].permissions = { policyType: 'open' };
  await assert.rejects(() => permissions.xmtp.ensureGroup(permissions.input), (error) => error.code === 'room_permissions_open');
});

test('durable exclusive lock blocks concurrent room creation', async () => {
  const f = fixture();
  f.setLocked(true);
  await assert.rejects(() => f.xmtp.ensureGroup(f.input), (error) => error.code === 'room_locked');
  assert.equal(f.groups.length, 0);
});
