import assert from 'node:assert/strict';
import test from 'node:test';

import {
  contentTypeAttachment,
  GroupPermissionsOptions,
  MetadataField,
  PermissionPolicy,
  PermissionUpdateType,
} from '@xmtp/node-sdk';

import {
  createDeferredXmtpAgentClient,
  createLocalXmtpAgentClient,
  createNodeXmtpAgentClient,
  createXmtpGroupPrimitives,
  normalizeDbEncryptionKey,
} from '../src/xmtp-agent/index.js';

test('XMTP transport is disabled by default and never silently falls back to local output', async () => {
  const xmtp = createDeferredXmtpAgentClient();

  assert.equal(xmtp.provider, 'xmtp_disabled');
  assert.equal(xmtp.transport, 'unavailable');
  await assert.rejects(
    () => xmtp.publishRoomMessages({ threadId: 'canonical-thread', messages: [{ role: 'human', text: 'hello' }] }),
    /XMTP transport is disabled/i,
  );
});

test('local XMTP adapter is available only through explicit test fallback and stays labeled local', async () => {
  const xmtp = createDeferredXmtpAgentClient({ localFallbackEnabled: true });
  const result = await xmtp.publishRoomMessages({
    threadId: 'canonical-thread',
    messages: [{ role: 'human', text: 'test only' }],
  });

  assert.equal(xmtp.provider, 'local_xmtp_adapter');
  assert.equal(result.transport, 'xmtp_local');
  assert.equal(result.adapter, 'local_xmtp_adapter');
});

test('explicit live XMTP enablement fails closed when wallet configuration is absent', async () => {
  const xmtp = createDeferredXmtpAgentClient({ enabled: true });

  assert.equal(xmtp.provider, 'xmtp_unconfigured');
  await assert.rejects(
    () => xmtp.getThread({ threadId: 'canonical-thread' }),
    /wallet configuration is unavailable/i,
  );
});

test('local XMTP adapter opens a room and appends ordered messages', async () => {
  const xmtp = createLocalXmtpAgentClient({ now: () => '2026-08-30T01:45:00.000Z' });
  const threadId = 'xmtp:looper-1234';

  const room = await xmtp.publishRoomMessages({
    threadId,
    roomName: 'Bendr 2.0 + 1 room',
    participants: [
      { tokenId: '1', agentId: '1', displayName: 'Bendr 2.0', role: 'Lead agent' },
      { tokenId: '7', agentId: '7', displayName: 'Wallet Seven', role: 'Ops agent' },
    ],
    messages: [
      {
        role: 'human',
        text: 'Watch Base agent tokens.',
        transport: 'console',
      },
      {
        role: 'agent',
        text: 'Saved. I will keep this review-only.',
        senderLabel: 'Wallet Seven',
        inferenceProvider: 'fake_bankr',
      },
    ],
  });
  const thread = await xmtp.getThread({ threadId });

  assert.equal(xmtp.provider, 'local_xmtp_adapter');
  assert.equal(thread.threadId, threadId);
  assert.equal(thread.roomName, 'Bendr 2.0 + 1 room');
  assert.equal(thread.participants.length, 2);
  assert.equal(thread.messages.length, 2);
  assert.equal(room.messages[0].id, 'xmtp_0');
  assert.equal(room.messages[0].transport, 'console');
  assert.equal(room.messages[1].id, 'xmtp_1');
  assert.equal(room.messages[1].senderLabel, 'Wallet Seven');
  assert.equal(room.messages[1].inferenceProvider, 'fake_bankr');
});

test('local XMTP adapter requires an explicit thread id', async () => {
  const xmtp = createLocalXmtpAgentClient();

  await assert.rejects(
    () => xmtp.publishRoomMessages({ messages: [{ role: 'agent', text: 'No thread.' }] }),
    /XMTP thread id is required/,
  );
});

test('node XMTP adapter can publish into an existing conversation', async () => {
  const sent = [];
  const conversation = {
    id: 'conversation-1',
    async sendText(text, options) {
      sent.push({ text, options });
      return `xmtp-message-${sent.length}`;
    },
  };
  const xmtp = await createNodeXmtpAgentClient({
    now: () => '2026-09-01T00:50:00.000Z',
    client: {
      conversations: {
        async sync() {},
        async getConversationById(conversationId) {
          return conversationId === conversation.id ? conversation : null;
        },
      },
    },
  });

  const room = await xmtp.publishRoomMessages({
    threadId: 'xmtp:conversation-1',
    conversationId: 'conversation-1',
    roomName: 'Quigbot ops',
    participants: [{ tokenId: '81', agentId: '81', displayName: 'Quigbot' }],
    messages: [{ role: 'agent', text: 'Saved. Review-only.', senderLabel: 'Quigbot' }],
  });

  assert.equal(xmtp.provider, 'xmtp_node_sdk');
  assert.equal(room.conversationId, 'conversation-1');
  assert.equal(room.messages.length, 1);
  assert.equal(room.messages[0].xmtpMessageId, 'xmtp-message-1');
  assert.deepEqual(sent, [{
    text: '[Quigbot] Saved. Review-only.',
    options: { idempotencyKey: 'xmtp_0' },
  }]);
});

test('node XMTP adapter sends exact static attachment then caption with stable idempotency keys', async () => {
  const calls = [];
  const conversation = {
    id: 'conversation-image',
    async sendAttachment(attachment, options) {
      calls.push({ method: 'attachment', attachment, options });
      return 'xmtp-image';
    },
    async sendText(text, options) {
      calls.push({ method: 'text', text, options });
      return 'xmtp-caption';
    },
  };
  const xmtp = await createNodeXmtpAgentClient({
    client: { conversations: { async sync() {}, async getConversationById() { return conversation; } } },
  });
  const content = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
  const room = await xmtp.publishRoomMessages({
    threadId: 'image-thread', conversationId: conversation.id, roomName: 'Image room',
    messages: [{
      id: 'msg-image-1', role: 'human', text: 'What is this?',
      attachment: { kind: 'image', filename: 'proof.png', mimeType: 'image/png', content, byteLength: content.length, sha256: 'a'.repeat(64) },
    }],
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].method, 'attachment');
  assert.deepEqual(calls[0].attachment, { filename: 'proof.png', mimeType: 'image/png', content });
  assert.deepEqual(calls[0].options, { idempotencyKey: 'msg-image-1:attachment' });
  assert.deepEqual(calls[1], { method: 'text', text: 'What is this?', options: { idempotencyKey: 'msg-image-1:caption' } });
  assert.equal(room.messages[0].xmtpMessageId, 'xmtp-image');
  assert.equal(room.messages[0].captionXmtpMessageId, 'xmtp-caption');
});

test('node XMTP adapter fails closed when the authenticated holder cannot be added to a new group', async () => {
  let optimisticGroups = 0;
  const xmtp = await createNodeXmtpAgentClient({
    client: {
      conversations: {
        async createGroupWithIdentifiers() {
          throw new Error('holder is not reachable on XMTP');
        },
        createGroupOptimistic() {
          optimisticGroups += 1;
          return {
            id: 'self-only-group',
            async sendText() { return 'must-not-send'; },
          };
        },
      },
    },
  });

  await assert.rejects(
    () => xmtp.publishRoomMessages({
      threadId: 'xmtp:eip155:8453:loopers:617:erc8004:87069',
      topicId: 'eip155:8453:loopers:617:erc8004:87069',
      wallet: '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea',
      roomName: 'Bendr Looper ops',
      participants: [{ participantId: 'erc8004:87069', agentId: '87069', tokenId: '617', displayName: 'Bendr Looper' }],
      messages: [{ role: 'human', text: 'Watch Loopers.' }],
    }),
    /holder is not reachable on XMTP/,
  );
  assert.equal(optimisticGroups, 0);
});

test('node XMTP adapter reopens a bound conversation from canonical thread state', async () => {
  const conversation = {
    id: 'conversation-617',
    async sendText() { return 'unused'; },
  };
  let reads = 0;
  const xmtp = await createNodeXmtpAgentClient({
    client: {
      conversations: {
        async sync() {},
        async getConversationById(conversationId) {
          reads += 1;
          return conversationId === conversation.id ? conversation : null;
        },
      },
    },
  });

  const thread = await xmtp.getThread({
    threadId: 'xmtp:eip155:8453:loopers:617:erc8004:87069',
    conversationId: 'conversation-617',
    roomName: 'Bendr Looper ops',
    participants: [{ participantId: 'erc8004:87069', agentId: '87069', tokenId: '617', displayName: 'Bendr Looper' }],
  });

  assert.equal(reads, 1);
  assert.equal(thread.conversationId, 'conversation-617');
  assert.equal(thread.transport, 'xmtp_group');
  assert.equal(thread.adapter, 'xmtp_node_sdk');
  assert.equal(thread.participants[0].agentId, '87069');
});

test('node XMTP adapter recovers bounded static images and safe unsupported placeholders', async () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x0a, 0x00, 0x00, 0x00, 0x14]);
  const conversation = {
    id: 'conversation-history',
    async messages() {
      return [
        { id: 'image-history', senderInboxId: 'agent-inbox', sentAt: '2026-09-27T00:00:00.000Z', contentType: contentTypeAttachment(), content: { filename: 'proof.png', mimeType: 'image/png', content: png } },
        { id: 'caption-history', senderInboxId: 'agent-inbox', sentAt: '2026-09-27T00:00:00.100Z', content: 'What is this?' },
        { id: 'bad-history', contentType: contentTypeAttachment(), content: { filename: 'bad.png', mimeType: 'image/png', content: new Uint8Array([1, 2, 3]) } },
        { id: 'unknown-history', contentType: { authorityId: 'x', typeId: 'unknown', versionMajor: 1, versionMinor: 0 }, content: { unsafe: true } },
        { id: 'own-history', senderInboxId: 'agent-inbox', content: 'Prior agent answer.' },
      ];
    },
  };
  const xmtp = await createNodeXmtpAgentClient({
    client: { inboxId: 'agent-inbox', conversations: { async sync() {}, async getConversationById() { return conversation; } } },
  });
  const thread = await xmtp.getThread({ threadId: 'history', conversationId: conversation.id });
  assert.equal(thread.messages[0].attachment.base64, Buffer.from(png).toString('base64'));
  assert.equal(thread.messages[0].attachment.content, undefined);
  assert.equal(thread.messages[0].text, 'What is this?');
  assert.equal(thread.messages[0].role, 'human');
  assert.equal(thread.messages[0].captionXmtpMessageId, 'caption-history');
  assert.equal(thread.messages[1].attachment.unavailable, true);
  assert.equal(thread.messages[2].attachment.unavailable, true);
  assert.equal(thread.messages[3].role, 'agent');
  assert.equal(thread.messages[3].text, 'Prior agent answer.');
});

test('normalizeDbEncryptionKey accepts hex with or without 0x and plain text', () => {
  const plainHex = 'ab'.repeat(32);
  assert.deepEqual(normalizeDbEncryptionKey(plainHex), Buffer.from(plainHex, 'hex'));
  assert.deepEqual(normalizeDbEncryptionKey(`0x${plainHex}`), Buffer.from(plainHex, 'hex'));
  assert.deepEqual(normalizeDbEncryptionKey('multipass-worker-key'), Buffer.from('multipass-worker-key', 'utf8'));
});


test('generic XMTP primitives translate mission metadata and permissions to the live SDK contract', async () => {
  const calls = [];
  const group = {
    id: 'group-1', name: 'Group', description: 'Description', appData: '{}',
    async sync() { calls.push(['group.sync']); }, async metadata() { return { creatorInboxId: 'creator', conversationType: 'group' }; },
    async members() { return [{ inboxId: 'member-1' }]; }, permissions() {
      return { policyType: GroupPermissionsOptions.AdminOnly, policySet: { addMemberPolicy: PermissionPolicy.Admin } };
    },
    listAdmins() { return ['admin-1']; }, listSuperAdmins() { return ['super-1']; },
    async updatePermission(...args) { calls.push(['permission', ...args]); },
    async addMembersByIdentifiers(values) { calls.push(['add', values]); }, async removeMembersByIdentifiers(values) { calls.push(['remove', values]); },
    async addAdmin(value) { calls.push(['admin', value]); }, async sendText(text, options) { calls.push(['send', text, options]); return 'message-1'; },
    async messages() { return [{ id: 'message-1' }]; },
  };
  const conversations = {
    async sync() { calls.push(['sync']); }, listGroups() { return [group]; },
    async getConversationById(id) { return id === group.id ? group : undefined; },
    async createGroupWithIdentifiers(ids, metadata) { calls.push(['create', ids, metadata]); return group; },
  };
  const primitives = createXmtpGroupPrimitives({ client: { conversations } });
  assert.equal((await primitives.listGroups())[0].id, 'group-1');
  assert.equal((await primitives.createGroup({
    identifiers: [{ identifierKind: 0, identifier: '0x1' }],
    metadata: {
      name: 'Mission',
      description: 'Private mission room',
      appData: '{"marker":true}',
      permissions: 'admin_only',
    },
  })).id, 'group-1');
  const described = await primitives.describeGroup('group-1');
  assert.equal(described.permissions.policyType, 'admin_only');
  await primitives.updatePermissions('group-1', [
    { permissionType: 'add_member', policy: 'admin' },
    { permissionType: 'remove_member', policy: 'admin' },
    { permissionType: 'update_metadata', policy: 'admin' },
  ]);
  await primitives.addMembers('group-1', [{ identifierKind: 0, identifier: '0x2' }]);
  await primitives.removeMembers('group-1', [{ identifierKind: 0, identifier: '0x2' }]);
  await primitives.addAdmin('group-1', 'admin-2');
  assert.equal(await primitives.sendText('group-1', 'marker', { idempotencyKey: 'event-1' }), 'message-1');
  assert.equal((await primitives.listMessages('group-1')).length, 1);
  assert.deepEqual(calls.find(([name]) => name === 'create'), [
    'create',
    [{ identifierKind: 0, identifier: '0x1' }],
    {
      groupName: 'Mission',
      groupDescription: 'Private mission room',
      appData: '{"marker":true}',
      permissions: GroupPermissionsOptions.AdminOnly,
    },
  ]);
  assert.deepEqual(calls.filter(([name]) => name === 'permission'), [
    ['permission', PermissionUpdateType.AddMember, PermissionPolicy.Admin, undefined],
    ['permission', PermissionUpdateType.RemoveMember, PermissionPolicy.Admin, undefined],
    ['permission', PermissionUpdateType.UpdateMetadata, PermissionPolicy.Admin, MetadataField.AppData],
    ['permission', PermissionUpdateType.UpdateMetadata, PermissionPolicy.Admin, MetadataField.Description],
    ['permission', PermissionUpdateType.UpdateMetadata, PermissionPolicy.Admin, MetadataField.GroupName],
    ['permission', PermissionUpdateType.UpdateMetadata, PermissionPolicy.Admin, MetadataField.GroupImageUrlSquare],
    ['permission', PermissionUpdateType.UpdateMetadata, PermissionPolicy.Admin, MetadataField.MessageExpirationFromNs],
  ]);
});
