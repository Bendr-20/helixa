const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildGenericAuraAgent,
  resolveAuraSourceWithFallback,
} = require('./aura-fallback');

test('buildGenericAuraAgent returns safe renderable defaults', () => {
  const agent = buildGenericAuraAgent(2753);

  assert.equal(agent.tokenId, 2753);
  assert.equal(agent.name, 'Helixa Agent #2753');
  assert.equal(agent.framework, 'custom');
  assert.deepEqual(agent.traits, []);
  assert.equal(agent.credScore, 0);
});

test('resolveAuraSourceWithFallback returns generic agent when source loader times out', async () => {
  const agent = await resolveAuraSourceWithFallback(2753, () => new Promise(() => {}), { timeoutMs: 5 });

  assert.equal(agent.tokenId, 2753);
  assert.equal(agent.name, 'Helixa Agent #2753');
});

test('resolveAuraSourceWithFallback preserves loaded agent when loader wins', async () => {
  const agent = await resolveAuraSourceWithFallback(1, async () => ({ tokenId: 1, name: 'Bendr 2.0', framework: 'openclaw' }), { timeoutMs: 50 });

  assert.equal(agent.name, 'Bendr 2.0');
  assert.equal(agent.framework, 'openclaw');
});
