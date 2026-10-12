'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { getAdapter } = require('../../cred-evidence/adapters');
const BASE = {
  proofType: 'account-binding', chainId: '8453', blockNumber: '99', blockHash: '0x' + 'ab'.repeat(32),
  account: '0x2222222222222222222222222222222222222222', owner: '0x3333333333333333333333333333333333333333',
  collection: '0x1111111111111111111111111111111111111111', tokenId: '7', codeHash: 'sha256:' + 'cd'.repeat(32),
  ethWei: '0', liquidCred: '0', stakedCred: '0', direction: 'positive', materialityNative: 'low', proofClass: 'P1',
  domain: 'security', finality: 'final', incidentKey: 'looper_7_identity_99', correlationKey: 'looper_7_base_99', proofVerified: true,
};
function context(category, domain = 'security') { return { schema: { category, allowedDirections: ['positive'], allowedProofClasses: ['P1'], materialityMapping: [{ nativeValue: 'low', materiality: 'micro' }], allowedDomains: [domain] } }; }
test('transforms exact dual-provider Looper payloads', () => {
  const adapter = getAdapter('looper-base-proof', '1.0.0');
  const transformed = adapter.transform(BASE, context('identity'));
  assert.equal(transformed.direction, 'positive');
  assert.equal(transformed.materiality, 'micro');
  assert.equal(transformed.correlationKey, 'looper_7_base_99');
  assert.equal(transformed.counterpartyCoordinate, null);
});
test('accepts financial positives only when a direct balance is nonzero', () => {
  const adapter = getAdapter('looper-base-proof', '1.0.0');
  const positive = { ...BASE, proofType: 'wallet-balance', domain: 'payments', liquidCred: '1', incidentKey: 'looper_7_financial_99' };
  assert.equal(adapter.transform(positive, context('financial', 'payments')).direction, 'positive');
  assert.throws(() => adapter.transform({ ...positive, liquidCred: '0' }, context('financial', 'payments')), /nonzero direct balance/);
  assert.throws(() => adapter.transform({ ...positive, direction: 'negative' }, context('financial', 'payments')), /positive/);
});
test('rejects lane/category mismatch and unknown fields', () => {
  const adapter = getAdapter('looper-base-proof', '1.0.0');
  assert.throws(() => adapter.transform(BASE, context('onchain')), /category/);
  assert.throws(() => adapter.transform({ ...BASE, extra: true }, context('identity')), /unknown field/);
});
