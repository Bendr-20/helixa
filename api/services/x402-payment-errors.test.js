const test = require('node:test');
const assert = require('node:assert/strict');
const { encodePaymentRequiredHeader, encodePaymentSignatureHeader } = require('@x402/core/http');

const {
  buildX402ErrorBody,
  decodePaymentPayloadFromHeaders,
} = require('./x402-payment-errors');

const paymentRequired = {
  x402Version: 2,
  error: 'Payment Required',
  resource: {
    url: 'https://api.helixa.xyz/api/v2/mint',
    description: 'Register a new Helixa agent identity',
    mimeType: 'application/json',
  },
  accepts: [{
    scheme: 'exact',
    network: 'eip155:8453',
    amount: '1000000',
    asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    payTo: '0x339559a2d1cd15059365fc7bd36b3047bba480e0',
    maxTimeoutSeconds: 300,
    extra: { name: 'USD Coin', version: '2' },
  }],
};

function requiredHeaders() {
  return { 'PAYMENT-REQUIRED': encodePaymentRequiredHeader(paymentRequired) };
}

function signatureHeader(payload) {
  return { 'payment-signature': encodePaymentSignatureHeader(payload) };
}

test('empty x402 middleware body becomes useful JSON payment requirements', () => {
  const body = buildX402ErrorBody(
    { status: 402, headers: requiredHeaders(), body: {} },
    { requestHeaders: {} },
  );

  assert.equal(body.error, 'payment_required');
  assert.equal(body.payment.accepts[0].amount, '1000000');
  assert.equal(body.payment.accepts[0].asset, paymentRequired.accepts[0].asset);
  assert.equal(body.payment.resource.url, paymentRequired.resource.url);
  assert.match(body.payment.instructions, /PAYMENT-REQUIRED/);
});

test('missing payment signature stays payment_required even when upstream sends an error string', () => {
  const body = buildX402ErrorBody(
    { status: 402, headers: requiredHeaders(), body: { error: 'No payment signature provided' } },
    { requestHeaders: {} },
  );

  assert.equal(body.error, 'payment_required');
  assert.equal(body.payment.accepts[0].amount, '1000000');
  assert(!body.diagnostics, 'missing payment should return payment instructions, not invalid-payload diagnostics');
});

test('v1-style x402 payload gets field-level diagnostics instead of TypeError leakage', () => {
  const requestHeaders = signatureHeader({
    x402Version: 1,
    scheme: 'exact',
    network: 'eip155:8453',
    payload: {},
  });

  const body = buildX402ErrorBody(
    { status: 402, headers: requiredHeaders(), body: { error: "Cannot read properties of undefined (reading 'scheme')" } },
    { requestHeaders },
  );

  assert.equal(body.error, 'x402_payment_payload_invalid');
  assert(!JSON.stringify(body).includes('Cannot read properties'), 'raw JS TypeError should not leak to clients');
  assert(body.diagnostics.some(d => d.field === 'x402Version' && d.expected === 2 && d.received === 1));
  assert(body.diagnostics.some(d => d.field === 'accepted' && d.issue === 'missing'));
  assert(body.diagnostics.some(d => d.field === 'resource' && d.issue === 'missing'));
  assert(body.diagnostics.some(d => d.field === 'payload.authorization' && d.issue === 'missing'));
});

test('mismatched v2 x402 payload names the mismatched accepted fields', () => {
  const requestHeaders = signatureHeader({
    x402Version: 2,
    scheme: 'exact',
    network: 'eip155:8453',
    payload: { authorization: { from: '0x1111111111111111111111111111111111111111' }, signature: '0x00' },
    resource: paymentRequired.resource,
    accepted: {
      scheme: 'exact',
      network: 'eip155:8453',
      amount: '1',
      asset: '0x0000000000000000000000000000000000000000',
      payTo: '0x0000000000000000000000000000000000000000',
      maxTimeoutSeconds: 300,
      extra: { name: 'USD Coin', version: '2' },
    },
  });

  const body = buildX402ErrorBody(
    { status: 402, headers: requiredHeaders(), body: { error: 'No matching payment requirements' } },
    { requestHeaders },
  );

  assert.equal(body.error, 'x402_payment_requirements_mismatch');
  assert(body.diagnostics.some(d => d.field === 'accepted.amount' && d.expected === '1000000' && d.received === '1'));
  assert(body.diagnostics.some(d => d.field === 'accepted.asset' && d.expected === paymentRequired.accepts[0].asset));
  assert(body.diagnostics.some(d => d.field === 'accepted.payTo' && d.expected === paymentRequired.accepts[0].payTo));
  assert.match(body.detail, /accepted.amount/);
});

test('decodePaymentPayloadFromHeaders accepts payment aliases', () => {
  const payload = { x402Version: 2, accepted: paymentRequired.accepts[0], resource: paymentRequired.resource, payload: {} };
  assert.deepEqual(decodePaymentPayloadFromHeaders({ payment: encodePaymentSignatureHeader(payload) }), payload);
  assert.deepEqual(decodePaymentPayloadFromHeaders({ 'x-payment': encodePaymentSignatureHeader(payload) }), payload);
});
