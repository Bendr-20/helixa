const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizePersonality,
  normalizeNarrative,
  mergeTraitLists,
  mergePublicAgentProfile,
} = require('./public-profile-fallbacks');

test('profile personality and narrative survive missing contract reads', () => {
  const merged = mergePublicAgentProfile({ tokenId: 1, personality: null, narrative: null }, {
    personality: {
      quirks: 'dry wit',
      communicationStyle: 'direct',
      values: 'proof over vibes',
      humor: 'deadpan',
      riskTolerance: 4,
      autonomyLevel: 7,
    },
    narrative: {
      origin: 'Built as Bendr 2.0.',
      mission: 'Make agent trust inspectable.',
      lore: 'Runs public proof trails.',
      manifesto: 'No fake trust.',
    },
  });

  assert.equal(merged.personality.quirks, 'dry wit');
  assert.equal(merged.personality.communicationStyle, 'direct');
  assert.equal(merged.personality.riskTolerance, 4);
  assert.equal(merged.narrative.origin, 'Built as Bendr 2.0.');
  assert.equal(merged.narrative.mission, 'Make agent trust inspectable.');
});

test('profile fields fill partial contract personality and narrative reads', () => {
  const merged = mergePublicAgentProfile({
    tokenId: 1,
    personality: {
      quirks: 'onchain quirk',
      communicationStyle: '',
      values: null,
      humor: 'onchain humor',
      riskTolerance: Number.NaN,
      autonomyLevel: 3,
    },
    narrative: {
      origin: 'onchain origin',
      mission: '',
    },
  }, {
    personality: {
      communicationStyle: 'profile style',
      values: 'profile values',
      riskTolerance: 6,
      autonomyLevel: 9,
    },
    narrative: {
      mission: 'profile mission',
      lore: 'profile lore',
    },
  });

  assert.equal(merged.personality.quirks, 'onchain quirk');
  assert.equal(merged.personality.communicationStyle, 'profile style');
  assert.equal(merged.personality.values, 'profile values');
  assert.equal(merged.personality.humor, 'onchain humor');
  assert.equal(merged.personality.riskTolerance, 6);
  assert.equal(merged.personality.autonomyLevel, 3);
  assert.equal(merged.narrative.origin, 'onchain origin');
  assert.equal(merged.narrative.mission, 'profile mission');
  assert.equal(merged.narrative.lore, 'profile lore');
});

test('profile traits append and repair partial duplicate contract traits', () => {
  const traits = mergeTraitLists([
    { name: 'siwa-verified', category: '', addedAt: null },
    { name: 'linked-token', category: '0xabc' },
    'builder',
  ], [
    { name: 'siwa-verified', category: 'verification', addedAt: '2026-01-01T00:00:00.000Z' },
    { name: 'x-verified', category: 'social' },
    { name: 'builder', category: 'role' },
  ]);

  assert.deepEqual(traits, [
    { name: 'siwa-verified', category: 'verification', addedAt: '2026-01-01T00:00:00.000Z' },
    { name: 'builder', category: 'role', addedAt: null },
    { name: 'x-verified', category: 'social', addedAt: null },
  ]);
});

test('normalizers accept ethers-style arrays and objects without leaking empty objects', () => {
  assert.equal(normalizePersonality(null), null);
  assert.equal(normalizeNarrative({ origin: '', mission: null }), null);

  const personality = normalizePersonality(['quirks', 'style', 'values', 'humor', 2n, 8n]);
  assert.equal(personality.quirks, 'quirks');
  assert.equal(personality.autonomyLevel, 8);

  const narrative = normalizeNarrative({ origin: 'origin', mission: 'mission' });
  assert.deepEqual(narrative, { origin: 'origin', mission: 'mission' });
});
