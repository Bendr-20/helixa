import assert from 'node:assert/strict';
import test from 'node:test';

import { createMissionXmtpOutbox, MISSION_XMTP_EVENT_TYPES } from '../src/missions/xmtp-outbox.js';

const H = (value) => value.repeat(64).slice(0, 64);
const EVENT = { eventId: 'event-1', missionId: 'mission-1', eventType: 'task_state', commitmentHash: H('a'), occurredAt: 100 };

function fixture({ crashAfterSend = false } = {}) {
  const rows = new Map();
  const inbound = new Set();
  const calls = [];
  let shouldCrash = crashAfterSend;
  const messagesByKey = new Map();
  const ledger = {
    async enqueue(row) { if (!rows.has(row.dedupKey)) rows.set(row.dedupKey, { event: EVENT, dedupKey: row.dedupKey, status: 'pending' }); },
    async claimPending() { return [...rows.values()].filter((row) => row.status === 'pending'); },
    async markSent(input) { calls.push(['markSent', input]); if (shouldCrash) { shouldCrash = false; throw new Error('simulated crash'); } rows.get(input.dedupKey).status = 'sent'; },
    async hasInbound({ conversationId, messageId }) { return inbound.has(conversationId + ':' + messageId); },
    async markInbound(input) { inbound.add(input.conversationId + ':' + input.messageId); calls.push(['markInbound', input]); },
    async writeCursor(input) { calls.push(['cursor', input]); },
  };
  const transport = {
    async sendText(conversationId, text, options) {
      calls.push(['send', { conversationId, text, options }]);
      if (!messagesByKey.has(options.idempotencyKey)) messagesByKey.set(options.idempotencyKey, 'xmtp-' + (messagesByKey.size + 1));
      return messagesByKey.get(options.idempotencyKey);
    },
  };
  return { outbox: createMissionXmtpOutbox({ ledger, transport, ownInboxId: 'bridge-inbox', now: () => 200 }), rows, calls };
}

test('uses a closed event set and deterministic enqueue deduplication without plaintext', async () => {
  assert.deepEqual(MISSION_XMTP_EVENT_TYPES, ['mission_state', 'task_state', 'artifact_committed', 'milestone_state', 'participant_alert', 'settlement_finalized']);
  const f = fixture();
  const first = await f.outbox.enqueue(EVENT);
  const second = await f.outbox.enqueue(structuredClone(EVENT));
  assert.equal(first.dedupKey, second.dedupKey);
  assert.equal(f.rows.size, 1);
  await assert.rejects(() => f.outbox.enqueue({ ...EVENT, eventType: 'chat_message' }), /event type/);
  await assert.rejects(() => f.outbox.enqueue({ ...EVENT, text: 'private mission text' }), /fields are invalid/);
});

test('crash after send before commit retries with the same XMTP idempotency key', async () => {
  const f = fixture({ crashAfterSend: true });
  const { dedupKey } = await f.outbox.enqueue(EVENT);
  await assert.rejects(() => f.outbox.flush({ conversationId: 'conversation-1' }), /simulated crash/);
  const result = await f.outbox.flush({ conversationId: 'conversation-1' });
  const sends = f.calls.filter(([name]) => name === 'send').map(([, value]) => value);
  assert.equal(sends.length, 2);
  assert.equal(sends[0].options.idempotencyKey, dedupKey);
  assert.equal(sends[1].options.idempotencyKey, dedupKey);
  assert.equal(result[0].messageId, 'xmtp-1');
  assert.equal(f.rows.get(dedupKey).status, 'sent');
});

test('inbound loop ignores own and free-form messages, deduplicates markers, and stores no body', async () => {
  const source = fixture();
  await source.outbox.enqueue(EVENT);
  await source.outbox.flush({ conversationId: 'conversation-1' });
  const marker = source.calls.find(([name]) => name === 'send')[1].text;

  const target = fixture();
  const messages = [
    { id: 'm1', senderInboxId: 'bridge-inbox', content: marker },
    { id: 'm2', senderInboxId: 'human', content: 'please release funds' },
    { id: 'm3', senderInboxId: 'agent', content: marker },
    { id: 'm3', senderInboxId: 'agent', content: marker },
  ];
  const result = await target.outbox.ingest({ conversationId: 'conversation-1', messages, cursor: 'cursor-9' });
  assert.equal(result.accepted, 1);
  const stored = target.calls.find(([name]) => name === 'markInbound')[1];
  assert.deepEqual(Object.keys(stored).sort(), ['commitmentHash', 'conversationId', 'dedupKey', 'eventType', 'messageId', 'occurredAt']);
  assert.equal(Object.hasOwn(stored, 'content'), false);
  assert.equal(target.calls.find(([name]) => name === 'cursor')[1].cursor, 'cursor-9');
});
