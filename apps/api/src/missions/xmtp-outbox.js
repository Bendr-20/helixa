import { canonicalizeMissionJson, digestMissionBody } from './idempotency.js';

const EVENT_TYPES = Object.freeze(['mission_state', 'task_state', 'artifact_committed', 'milestone_state', 'participant_alert', 'settlement_finalized']);
const EVENT_SET = new Set(EVENT_TYPES);
const MARKER_PREFIX = '[swarm-command-event]';

export function createMissionXmtpOutbox({ ledger, transport, ownInboxId, now = Date.now } = {}) {
  if (!ledger || !['enqueue', 'claimPending', 'markSent', 'hasInbound', 'markInbound', 'writeCursor'].every((name) => typeof ledger[name] === 'function')) throw new TypeError('Mission XMTP outbox ledger is invalid.');
  if (!transport || typeof transport.sendText !== 'function') throw new TypeError('Mission XMTP outbox transport is invalid.');
  const own = bounded(ownInboxId, 'ownInboxId', 1, 256);
  if (typeof now !== 'function') throw new TypeError('Mission XMTP outbox clock is invalid.');

  async function enqueue(event = {}) {
    const normalized = normalizeEvent(event);
    const dedupKey = digestMissionBody(normalized);
    await ledger.enqueue({ ...normalized, dedupKey });
    return Object.freeze({ dedupKey });
  }

  async function flush({ conversationId, limit = 25 } = {}) {
    const conversation = bounded(conversationId, 'conversationId', 1, 512);
    const boundedLimit = integer(limit, 'limit', 1, 100);
    const pending = await ledger.claimPending({ conversationId: conversation, limit: boundedLimit, at: timestamp() });
    const sent = [];
    for (const row of pending) {
      const event = normalizeEvent(row.event);
      const dedupKey = hash(row.dedupKey, 'dedupKey');
      if (digestMissionBody(event) !== dedupKey) throw new Error('Mission XMTP outbox row digest does not match its event.');
      const text = MARKER_PREFIX + canonicalizeMissionJson({ version: 1, dedupKey, event });
      const messageId = await transport.sendText(conversation, text, { idempotencyKey: dedupKey });
      await ledger.markSent({ dedupKey, conversationId: conversation, messageId: String(messageId), sentAt: timestamp() });
      sent.push(Object.freeze({ dedupKey, messageId: String(messageId) }));
    }
    return Object.freeze(sent);
  }

  async function ingest({ conversationId, messages, cursor } = {}) {
    const conversation = bounded(conversationId, 'conversationId', 1, 512);
    if (!Array.isArray(messages) || messages.length > 500) throw new TypeError('XMTP inbound message batch is invalid.');
    let accepted = 0;
    for (const message of messages) {
      const id = bounded(message?.id, 'message.id', 1, 512);
      if (String(message.senderInboxId ?? '') === own || await ledger.hasInbound({ conversationId: conversation, messageId: id })) continue;
      const parsed = parseMarker(message.content);
      if (!parsed) continue;
      await ledger.markInbound({
        conversationId: conversation,
        messageId: id,
        dedupKey: parsed.dedupKey,
        eventType: parsed.event.eventType,
        commitmentHash: parsed.event.commitmentHash,
        occurredAt: parsed.event.occurredAt,
      });
      accepted += 1;
    }
    await ledger.writeCursor({ conversationId: conversation, cursor: bounded(cursor, 'cursor', 1, 512), updatedAt: timestamp() });
    return Object.freeze({ accepted });
  }

  function timestamp() { const value = now(); if (!Number.isSafeInteger(value) || value < 0) throw new TypeError('XMTP outbox clock returned an invalid timestamp.'); return value; }
  return Object.freeze({ enqueue, flush, ingest });
}

export { EVENT_TYPES as MISSION_XMTP_EVENT_TYPES };

function normalizeEvent(value) {
  exact(value, ['commitmentHash', 'eventId', 'eventType', 'missionId', 'occurredAt'], 'mission XMTP event');
  if (!EVENT_SET.has(value.eventType)) throw new TypeError('Mission XMTP event type is invalid.');
  return Object.freeze({
    eventId: identifier(value.eventId, 'eventId'), missionId: identifier(value.missionId, 'missionId'),
    eventType: value.eventType, commitmentHash: hash(value.commitmentHash, 'commitmentHash'),
    occurredAt: integer(value.occurredAt, 'occurredAt', 0, Number.MAX_SAFE_INTEGER),
  });
}
function parseMarker(content) {
  if (typeof content !== 'string' || !content.startsWith(MARKER_PREFIX) || content.length > 4096) return null;
  try {
    const parsed = JSON.parse(content.slice(MARKER_PREFIX.length));
    exact(parsed, ['dedupKey', 'event', 'version'], 'mission XMTP marker');
    if (parsed.version !== 1) return null;
    const event = normalizeEvent(parsed.event);
    const dedupKey = hash(parsed.dedupKey, 'dedupKey');
    if (digestMissionBody(event) !== dedupKey) return null;
    return Object.freeze({ dedupKey, event });
  } catch { return null; }
}
function exact(value, keys, label) { if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new TypeError(label + ' must be a plain object.'); const actual = Object.keys(value).sort(); const expected = [...keys].sort(); if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new TypeError(label + ' fields are invalid.'); }
function identifier(value, label) { if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(value)) throw new TypeError(label + ' is invalid.'); return value; }
function bounded(value, label, min, max) { if (typeof value !== 'string' || value.length < min || value.length > max) throw new TypeError(label + ' is invalid.'); return value; }
function hash(value, label) { if (typeof value !== 'string' || !/^[0-9a-f]{64}$/u.test(value)) throw new TypeError(label + ' is invalid.'); return value; }
function integer(value, label, min, max) { if (!Number.isSafeInteger(value) || value < min || value > max) throw new TypeError(label + ' is invalid.'); return value; }
