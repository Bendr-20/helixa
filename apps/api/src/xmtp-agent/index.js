import { contentTypeAttachment } from '@xmtp/node-sdk';
import { hexToBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { normalizeConsoleImageAttachment, projectConsoleImageMetadata } from '../console-image-attachment.js';

const ETHEREUM_IDENTIFIER_KIND = 0;

export function createDeferredXmtpAgentClient(options = {}) {
  if (!options.enabled) {
    return options.localFallbackEnabled
      ? createLocalXmtpAgentClient(options)
      : createUnavailableXmtpAgentClient({
        provider: 'xmtp_disabled',
        message: 'XMTP transport is disabled. Enable and configure the XMTP Node SDK or inject the explicit local test adapter.',
      });
  }
  if (!String(options.walletKey ?? '').trim()) {
    return createUnavailableXmtpAgentClient({
      provider: 'xmtp_unconfigured',
      message: 'XMTP is enabled but wallet configuration is unavailable.',
    });
  }
  let clientPromise = null;

  return {
    provider: 'xmtp_node_sdk',
    transport: 'xmtp_group',

    async publishRoomMessages(input = {}) {
      const client = await resolveClient();
      return client.publishRoomMessages(input);
    },

    async getThread(input = {}) {
      const client = await resolveClient();
      return client.getThread(input);
    },
  };

  async function resolveClient() {
    if (!clientPromise) clientPromise = createNodeXmtpAgentClient(options);
    return clientPromise;
  }
}

export function createUnavailableXmtpAgentClient({ provider = 'xmtp_disabled', message = 'XMTP transport is unavailable.' } = {}) {
  async function unavailable() {
    throw new Error(message);
  }
  return {
    provider,
    transport: 'unavailable',
    publishRoomMessages: unavailable,
    getThread: unavailable,
  };
}

export function createLocalXmtpAgentClient({ now = () => new Date().toISOString() } = {}) {
  const rooms = new Map();

  return {
    provider: 'local_xmtp_adapter',
    transport: 'xmtp_local',

    async publishRoomMessages(input = {}) {
      const threadId = requireThreadId(input.threadId);
      const roomName = normalizeRoomName(input.roomName);
      const room = rooms.get(threadId) ?? {
        threadId,
        topicId: String(input.topicId ?? threadId).trim(),
        conversationId: `local:${threadId}`,
        roomName,
        participants: [],
        messages: [],
      };
      room.roomName = roomName;
      room.participants = mergeParticipants(room.participants, input.participants);

      const nextMessages = Array.isArray(input.messages)
        ? input.messages.map((message, index) => normalizeOutboundMessage(message, {
          fallbackId: `xmtp_${room.messages.length + index}`,
          sentAt: now(),
          transport: 'xmtp_local',
          conversationId: room.conversationId,
        })).filter(Boolean).map((message) => projectPublishedMessage(message))
        : [];

      room.messages.push(...nextMessages);
      rooms.set(threadId, room);

      return {
        threadId,
        topicId: room.topicId,
        conversationId: room.conversationId,
        roomName: room.roomName,
        transport: 'xmtp_local',
        adapter: 'local_xmtp_adapter',
        participants: [...room.participants],
        messages: [...room.messages],
        publishedMessages: nextMessages,
      };
    },

    async getThread(input = {}) {
      const threadId = requireThreadId(input.threadId);
      const room = rooms.get(threadId);
      return {
        threadId,
        topicId: room?.topicId ?? String(input.topicId ?? threadId).trim(),
        conversationId: room?.conversationId ?? null,
        roomName: room?.roomName ?? normalizeRoomName(input.roomName),
        transport: 'xmtp_local',
        adapter: 'local_xmtp_adapter',
        participants: [...(room?.participants ?? input.participants ?? [])],
        messages: [...(room?.messages ?? [])],
      };
    },
  };
}

export function createConsoleSessionFallbackClient(options = {}) {
  const local = createLocalXmtpAgentClient(options);
  return Object.freeze({
    provider: 'console_session_fallback',
    transport: 'console_session',
    async publishRoomMessages(input = {}) {
      return projectConsoleSessionRoom(await local.publishRoomMessages(input));
    },
    async getThread(input = {}) {
      return projectConsoleSessionRoom(await local.getThread(input));
    },
  });
}

function projectConsoleSessionRoom(room = {}) {
  return {
    ...room,
    conversationId: null,
    transport: 'console_session',
    adapter: 'console_session_fallback',
    messages: (Array.isArray(room.messages) ? room.messages : []).map((message) => ({
      ...message,
      conversationId: null,
      transport: 'console_session',
    })),
    publishedMessages: (Array.isArray(room.publishedMessages) ? room.publishedMessages : []).map((message) => ({
      ...message,
      conversationId: null,
      transport: 'console_session',
    })),
  };
}

export async function createNodeXmtpAgentClient({
  client: providedClient,
  walletKey,
  env = 'production',
  dbPath = null,
  dbEncryptionKey = null,
  historySyncUrl = null,
  apiUrl = null,
  gatewayHost = null,
  appVersion = 'multipass-console',
  now = () => new Date().toISOString(),
} = {}) {
  const client = providedClient ?? await createXmtpNodeClient({
    walletKey,
    env,
    dbPath,
    dbEncryptionKey,
    historySyncUrl,
    apiUrl,
    gatewayHost,
    appVersion,
  });
  const rooms = new Map();

  return {
    provider: 'xmtp_node_sdk',
    transport: 'xmtp_group',

    async publishRoomMessages(input = {}) {
      const threadId = requireThreadId(input.threadId);
      const roomName = normalizeRoomName(input.roomName);
      const room = await ensureRoom({
        rooms,
        client,
        threadId,
        conversationId: input.conversationId,
        topicId: input.topicId,
        roomName,
        wallet: input.wallet,
        participants: input.participants,
      });

      const publishedMessages = [];
      for (let index = 0; index < (Array.isArray(input.messages) ? input.messages.length : 0); index += 1) {
        const message = input.messages[index];
        const normalized = normalizeOutboundMessage(message, {
          fallbackId: `xmtp_${room.messages.length + index}`,
          sentAt: now(),
          transport: 'xmtp_group',
          conversationId: room.conversation.id,
        });
        if (!normalized) continue;
        if (normalized.attachment) {
          const attachmentMessageId = await room.conversation.sendAttachment({
            filename: normalized.attachment.filename,
            mimeType: normalized.attachment.mimeType,
            content: normalized.attachment.content,
          }, normalized.id ? { idempotencyKey: `${normalized.id}:attachment` } : undefined);
          let captionMessageId = null;
          if (normalized.text) {
            captionMessageId = await room.conversation.sendText(
              buildOutboundText(normalized),
              normalized.id ? { idempotencyKey: `${normalized.id}:caption` } : undefined,
            );
          }
          publishedMessages.push(projectPublishedMessage({
            ...normalized,
            id: attachmentMessageId || normalized.id,
            xmtpMessageId: attachmentMessageId || normalized.id,
            ...(captionMessageId ? { captionXmtpMessageId: captionMessageId } : {}),
          }));
          continue;
        }
        const xmtpMessageId = await room.conversation.sendText(
          buildOutboundText(normalized),
          normalized.id ? { idempotencyKey: normalized.id } : undefined,
        );
        publishedMessages.push(projectPublishedMessage({
          ...normalized,
          id: xmtpMessageId || normalized.id,
          xmtpMessageId: xmtpMessageId || normalized.id,
        }));
      }

      room.participants = mergeParticipants(room.participants, input.participants);
      room.messages.push(...publishedMessages);

      return {
        threadId,
        topicId: room.topicId,
        conversationId: room.conversation.id,
        roomName: room.roomName,
        transport: 'xmtp_group',
        adapter: 'xmtp_node_sdk',
        participants: [...room.participants],
        messages: [...room.messages],
        publishedMessages,
      };
    },

    async getThread(input = {}) {
      const threadId = requireThreadId(input.threadId);
      let room = rooms.get(threadId);
      if (!room && input.conversationId) {
        room = await openBoundRoom({
          rooms,
          client,
          threadId,
          conversationId: input.conversationId,
          topicId: input.topicId,
          roomName: normalizeRoomName(input.roomName),
          participants: input.participants,
        });
      }
      return {
        threadId,
        topicId: room?.topicId ?? String(input.topicId ?? threadId).trim(),
        conversationId: room?.conversation?.id ?? null,
        roomName: room?.roomName ?? normalizeRoomName(input.roomName),
        transport: 'xmtp_group',
        adapter: 'xmtp_node_sdk',
        participants: [...(room?.participants ?? input.participants ?? [])],
        messages: [...(room?.messages ?? [])],
      };
    },
  };
}

export async function createXmtpNodeClient({
  walletKey,
  env = 'production',
  dbPath = null,
  dbEncryptionKey = null,
  historySyncUrl = null,
  apiUrl = null,
  gatewayHost = null,
  appVersion = 'multipass-console',
} = {}) {
  const { Client } = await import('@xmtp/node-sdk');
  const signer = createEoaSigner(walletKey);
  return Client.create(signer, {
    env,
    dbPath,
    ...(dbEncryptionKey ? { dbEncryptionKey: normalizeDbEncryptionKey(dbEncryptionKey) } : {}),
    ...(historySyncUrl ? { historySyncUrl } : {}),
    ...(apiUrl ? { apiUrl } : {}),
    ...(gatewayHost ? { gatewayHost } : {}),
    appVersion,
    useSingleConnection: true,
  });
}

function createEoaSigner(privateKey) {
  const account = privateKeyToAccount(normalizeHexPrivateKey(privateKey));
  return {
    type: 'EOA',
    getIdentifier: () => ({
      identifier: account.address.toLowerCase(),
      identifierKind: ETHEREUM_IDENTIFIER_KIND,
    }),
    async signMessage(message) {
      const signature = await account.signMessage({ message });
      return hexToBytes(signature);
    },
  };
}

async function ensureRoom({ rooms, client, threadId, conversationId, topicId, roomName, wallet, participants } = {}) {
  const existing = rooms.get(threadId);
  if (existing) {
    existing.roomName = roomName;
    existing.participants = mergeParticipants(existing.participants, participants);
    return existing;
  }

  if (conversationId) {
    return openBoundRoom({ rooms, client, threadId, conversationId, topicId, roomName, participants });
  }

  const identifiers = buildMemberIdentifiers(wallet);
  if (!identifiers.length) throw new TypeError('Authenticated holder wallet is required for a new XMTP group.');
  const metadata = { name: roomName, description: String(topicId ?? threadId) };
  const conversation = await client.conversations.createGroupWithIdentifiers(identifiers, metadata);

  const room = {
    conversation,
    topicId: String(topicId ?? threadId),
    roomName,
    participants: mergeParticipants([], participants),
    messages: [],
  };
  rooms.set(threadId, room);
  return room;
}

async function openBoundRoom({ rooms, client, threadId, conversationId, topicId, roomName, participants } = {}) {
  await client.conversations.sync?.();
  const conversation = await client.conversations.getConversationById(conversationId);
  if (!conversation) throw new Error(`XMTP conversation not found: ${conversationId}`);
  const room = {
    conversation,
    topicId: String(topicId ?? threadId),
    roomName,
    participants: mergeParticipants([], participants),
    messages: await loadConversationMessages(conversation, { ownInboxId: client?.inboxId }),
  };
  rooms.set(threadId, room);
  return room;
}

async function loadConversationMessages(conversation, { ownInboxId = null } = {}) {
  if (typeof conversation?.messages !== 'function') return [];
  const recovered = await conversation.messages({ limit: 50 }).catch(() => []);
  const normalized = (Array.isArray(recovered) ? recovered : [])
    .map((message) => normalizeRecoveredMessage(message, { ownInboxId }))
    .filter(Boolean);
  return pairRecoveredImageCaptions(normalized);
}

function normalizeRecoveredMessage(message = {}, { ownInboxId = null } = {}) {
  const id = String(message.id ?? '').trim();
  const senderInboxId = String(message.senderInboxId ?? '').trim();
  const base = {
    id: id || `xmtp_recovered_${String(message.sentAtNs ?? message.sentAt ?? '')}`,
    xmtpMessageId: id || undefined,
    role: ownInboxId && senderInboxId === String(ownInboxId) ? 'agent' : 'human',
    text: '',
    sentAt: normalizeRecoveredTimestamp(message),
    transport: 'xmtp_group',
    senderInboxId,
    ...(message.conversationId ? { conversationId: String(message.conversationId) } : {}),
  };
  if (typeof message.content === 'string') return { ...base, text: message.content.trim() };
  if (sameContentType(message.contentType, contentTypeAttachment())) {
    const content = message.content;
    const bytes = content?.content instanceof Uint8Array
      ? content.content
      : (content?.data instanceof Uint8Array ? content.data : null);
    if (bytes) {
      try {
        const normalized = normalizeConsoleImageAttachment({
          mimeType: content.mimeType,
          filename: content.filename,
          base64: Buffer.from(bytes).toString('base64'),
          width: null,
          height: null,
        }, { allowUnknownDimensions: true });
        return {
          ...base,
          attachment: {
            ...projectConsoleImageMetadata(normalized),
            base64: Buffer.from(normalized.content).toString('base64'),
          },
        };
      } catch {
        return {
          ...base,
          attachment: { kind: 'unsupported', filename: String(content?.filename ?? 'image'), unavailable: true },
        };
      }
    }
  }
  return {
    ...base,
    text: 'Unsupported XMTP content.',
    attachment: { kind: 'unsupported', filename: 'attachment', unavailable: true },
  };
}

function pairRecoveredImageCaptions(messages) {
  const paired = [];
  for (let index = 0; index < messages.length; index += 1) {
    const current = messages[index];
    const next = messages[index + 1];
    if (current?.attachment?.kind === 'image'
      && next?.text
      && current.senderInboxId
      && current.senderInboxId === next.senderInboxId
      && timestampsAreNear(current.sentAt, next.sentAt)) {
      const ownAgentCaption = /^\[[^\]]{1,100}\]\s/u.test(next.text);
      paired.push(stripRecoveryInternals({
        ...current,
        role: ownAgentCaption ? 'agent' : 'human',
        text: next.text,
        captionXmtpMessageId: next.xmtpMessageId ?? next.id,
      }));
      index += 1;
      continue;
    }
    paired.push(stripRecoveryInternals(current));
  }
  return paired;
}

function timestampsAreNear(left, right) {
  const leftMs = Date.parse(left);
  const rightMs = Date.parse(right);
  return Number.isFinite(leftMs) && Number.isFinite(rightMs) && rightMs >= leftMs && rightMs - leftMs <= 10_000;
}

function stripRecoveryInternals(message) {
  if (!message) return message;
  const { senderInboxId, ...publicMessage } = message;
  return publicMessage;
}

function sameContentType(left, right) {
  if (!left || !right) return false;
  return String(left.authorityId ?? left.authority_id ?? '') === String(right.authorityId ?? right.authority_id ?? '')
    && String(left.typeId ?? left.type_id ?? '') === String(right.typeId ?? right.type_id ?? '')
    && Number(left.versionMajor ?? left.version_major ?? 0) === Number(right.versionMajor ?? right.version_major ?? 0)
    && Number(left.versionMinor ?? left.version_minor ?? 0) === Number(right.versionMinor ?? right.version_minor ?? 0);
}

function normalizeRecoveredTimestamp(message) {
  const direct = String(message.sentAt ?? '').trim();
  if (direct) return direct;
  try {
    if (message.sentAtNs !== undefined) return new Date(Number(BigInt(message.sentAtNs) / 1_000_000n)).toISOString();
  } catch {}
  return new Date(0).toISOString();
}

function buildMemberIdentifiers(wallet) {
  const normalized = String(wallet ?? '').trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(normalized)) return [];
  return [{
    identifier: normalized,
    identifierKind: ETHEREUM_IDENTIFIER_KIND,
  }];
}

function buildOutboundText(message = {}) {
  const sender = String(message.senderLabel ?? '').trim();
  if (!sender || message.role === 'human') return message.text;
  return `[${sender}] ${message.text}`;
}

function normalizeOutboundMessage(message = {}, defaults = {}) {
  const text = String(message.text ?? '').trim();
  const attachment = normalizeOutboundAttachment(message.attachment);
  if (!text && !attachment) return null;
  return {
    id: String(message.id ?? defaults.fallbackId ?? '').trim() || defaults.fallbackId,
    role: String(message.role ?? 'agent') === 'human' ? 'human' : 'agent',
    text,
    ...(attachment ? { attachment } : {}),
    sentAt: String(message.sentAt ?? defaults.sentAt ?? new Date().toISOString()),
    transport: String(message.transport ?? defaults.transport ?? 'xmtp_local'),
    ...(message.senderLabel ? { senderLabel: String(message.senderLabel) } : {}),
    ...(message.participantId ? { participantId: String(message.participantId) } : {}),
    ...(message.inferenceProvider ? { inferenceProvider: String(message.inferenceProvider) } : {}),
    ...(defaults.conversationId ? { conversationId: String(defaults.conversationId) } : {}),
  };
}

function normalizeOutboundAttachment(value) {
  if (!value || value.kind !== 'image' || !(value.content instanceof Uint8Array)) return null;
  return {
    kind: 'image',
    filename: String(value.filename ?? 'image'),
    mimeType: String(value.mimeType ?? ''),
    content: value.content,
    byteLength: Number(value.byteLength ?? value.content.byteLength),
    width: value.width ?? null,
    height: value.height ?? null,
    sha256: String(value.sha256 ?? ''),
  };
}

function projectPublishedMessage(message) {
  if (!message?.attachment) return message;
  const { content, ...metadata } = message.attachment;
  return {
    ...message,
    attachment: {
      ...metadata,
      base64: Buffer.from(content).toString('base64'),
    },
  };
}

function mergeParticipants(existing = [], incoming = []) {
  const byId = new Map();
  for (const participant of [...(Array.isArray(existing) ? existing : []), ...(Array.isArray(incoming) ? incoming : [])]) {
    const normalized = normalizeParticipant(participant);
    if (!normalized) continue;
    byId.set(normalized.participantId, normalized);
  }
  return [...byId.values()];
}

function normalizeParticipant(participant = {}) {
  const participantId = String(
    participant.participantId ?? participant.agentId ?? participant.tokenId ?? participant.wallet ?? '',
  ).trim();
  if (!participantId) return null;
  const normalized = {
    participantId,
    displayName: String(participant.displayName ?? participant.agentName ?? `Agent ${participantId}`).trim() || `Agent ${participantId}`,
    role: String(participant.role ?? 'Onchain agent').trim() || 'Onchain agent',
  };
  if (participant.kind) normalized.kind = String(participant.kind);
  if (participant.wallet) normalized.wallet = String(participant.wallet).trim().toLowerCase();
  if (participant.agentId) normalized.agentId = String(participant.agentId).trim();
  if (participant.tokenId) normalized.tokenId = String(participant.tokenId).trim();
  return normalized;
}

function normalizeRoomName(value) {
  return String(value ?? '').trim() || 'Multipass room';
}

function normalizeHexPrivateKey(value) {
  const key = String(value ?? '').trim();
  if (!/^0x[a-fA-F0-9]{64}$/.test(key)) {
    throw new TypeError('MULTIPASS_XMTP_WALLET_KEY must be a 32-byte hex private key.');
  }
  return key;
}

export function normalizeDbEncryptionKey(value) {
  if (value == null) return value;
  if (value instanceof Uint8Array) return value;
  const text = String(value).trim();
  if (!text) return null;
  if (/^(0x)?[a-fA-F0-9]{64}$/.test(text)) {
    const hex = text.startsWith('0x') ? text.slice(2) : text;
    return Buffer.from(hex, 'hex');
  }
  return Buffer.from(text, 'utf8');
}

function requireThreadId(value) {
  const threadId = String(value ?? '').trim();
  if (!threadId) throw new TypeError('XMTP thread id is required.');
  return threadId;
}

export function createXmtpGroupPrimitives({ client } = {}) {
  if (!client?.conversations) throw new TypeError('XMTP client conversations API is required.');
  const conversations = client.conversations;
  for (const name of ['sync', 'listGroups', 'getConversationById', 'createGroupWithIdentifiers']) {
    if (typeof conversations[name] !== 'function') throw new TypeError('XMTP conversations.' + name + ' is required.');
  }

  async function syncGroups() { await conversations.sync(); }
  async function listGroups() { await conversations.sync(); return Object.freeze([...await conversations.listGroups()]); }
  async function getGroup(conversationId) {
    await conversations.sync();
    const group = await conversations.getConversationById(requireConversationId(conversationId));
    return group ?? null;
  }
  async function createGroup({ identifiers, metadata } = {}) {
    if (!Array.isArray(identifiers) || identifiers.length === 0) throw new TypeError('XMTP group identifiers are required.');
    return conversations.createGroupWithIdentifiers(identifiers, normalizeGroupMetadata(metadata));
  }
  async function describeGroup(conversationId) {
    const group = await requireGroup(conversationId);
    await group.sync?.();
    const [metadata, members] = await Promise.all([group.metadata(), group.members()]);
    return Object.freeze({
      conversationId: String(group.id), name: String(group.name ?? ''), description: String(group.description ?? ''),
      appData: String(group.appData ?? ''), metadata: Object.freeze({ ...metadata }),
      members: Object.freeze([...members]), permissions: Object.freeze(group.permissions()),
      admins: Object.freeze([...group.listAdmins()]), superAdmins: Object.freeze([...group.listSuperAdmins()]),
    });
  }
  async function updatePermissions(conversationId, updates = []) {
    if (!Array.isArray(updates) || updates.length === 0 || updates.length > 16) throw new TypeError('XMTP permission updates are invalid.');
    const group = await requireGroup(conversationId);
    for (const update of updates) {
      if (!update || typeof update !== 'object' || Array.isArray(update)) throw new TypeError('XMTP permission update is invalid.');
      await group.updatePermission(update.permissionType, update.policy, update.metadataField);
    }
  }
  async function addMembers(conversationId, identifiers) { const group = await requireGroup(conversationId); await group.addMembersByIdentifiers(identifiers); }
  async function removeMembers(conversationId, identifiers) { const group = await requireGroup(conversationId); await group.removeMembersByIdentifiers(identifiers); }
  async function addAdmin(conversationId, inboxId) { const group = await requireGroup(conversationId); await group.addAdmin(String(inboxId)); }
  async function sendText(conversationId, text, options = undefined) { const group = await requireGroup(conversationId); return group.sendText(String(text), options); }
  async function listMessages(conversationId, options = {}) { const group = await requireGroup(conversationId); return Object.freeze([...(await group.messages(options))]); }

  async function requireGroup(conversationId) {
    const group = await getGroup(conversationId);
    if (!group || typeof group.members !== 'function' || typeof group.permissions !== 'function') throw new Error('XMTP group not found: ' + conversationId);
    return group;
  }

  return Object.freeze({ addAdmin, addMembers, createGroup, describeGroup, getGroup, listGroups, listMessages, removeMembers, sendText, syncGroups, updatePermissions });
}

function requireConversationId(value) {
  const conversationId = String(value ?? '').trim();
  if (!conversationId || conversationId.length > 512) throw new TypeError('XMTP conversation id is invalid.');
  return conversationId;
}

function normalizeGroupMetadata(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('XMTP group metadata is invalid.');
  const metadata = {};
  if (value.name !== undefined) metadata.name = String(value.name).slice(0, 100);
  if (value.description !== undefined) metadata.description = String(value.description).slice(0, 500);
  if (value.appData !== undefined) metadata.appData = String(value.appData).slice(0, 8192);
  if (value.permissions !== undefined) metadata.permissions = value.permissions;
  return Object.freeze(metadata);
}
