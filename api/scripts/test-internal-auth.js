#!/usr/bin/env node
const assert = require('assert');
const {
  createInternalAuthConfig,
  createHmacSignature,
  hasValidInternalKey,
  verifyHmacSignature,
} = require('../internal-auth');

const env = {
  INTERNAL_API_KEY: 'a'.repeat(32),
  INTERNAL_API_KEY_PREVIOUS: 'b'.repeat(32),
  RECEIPT_HMAC_SECRET: 'c'.repeat(32),
  RECEIPT_HMAC_SECRET_PREVIOUS: 'd'.repeat(32),
};

const config = createInternalAuthConfig(env);

assert.deepStrictEqual(config.internalApiKeys, ['a'.repeat(32), 'b'.repeat(32)]);
assert.deepStrictEqual(config.receiptSecrets, ['c'.repeat(32), 'd'.repeat(32)]);
assert.strictEqual(hasValidInternalKey({ headers: { 'x-internal-key': 'a'.repeat(32) } }, config), true);
assert.strictEqual(hasValidInternalKey({ headers: { 'x-internal-key': 'b'.repeat(32) } }, config), true);
assert.strictEqual(hasValidInternalKey({ headers: { 'x-internal-key': 'e'.repeat(32) } }, config), false);
assert.strictEqual(hasValidInternalKey({ headers: { 'x-internal-key': ['b'.repeat(32)] } }, config), true);

const payload = JSON.stringify({ hello: 'world' });
const currentSignature = createHmacSignature(payload, config.receiptHmacSecret);
const previousSignature = createHmacSignature(payload, config.previousReceiptHmacSecret);

assert.strictEqual(verifyHmacSignature(payload, currentSignature, config.receiptSecrets), true);
assert.strictEqual(verifyHmacSignature(payload, previousSignature, config.receiptSecrets), true);
assert.strictEqual(verifyHmacSignature(payload, 'not-a-valid-signature', config.receiptSecrets), false);
assert.strictEqual(verifyHmacSignature(payload, currentSignature, [config.receiptHmacSecret]), true);
assert.strictEqual(verifyHmacSignature(payload, previousSignature, [config.receiptHmacSecret]), false);

const primaryOnly = createInternalAuthConfig({
  INTERNAL_API_KEY: '1'.repeat(32),
  RECEIPT_HMAC_SECRET: '2'.repeat(32),
});
assert.deepStrictEqual(primaryOnly.internalApiKeys, ['1'.repeat(32)]);
assert.deepStrictEqual(primaryOnly.receiptSecrets, ['2'.repeat(32)]);

console.log('Internal auth helper tests passed.');
