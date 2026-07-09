const test = require('node:test');
const assert = require('node:assert/strict');

const paymentRequirements = {
  scheme: 'exact',
  network: 'eip155:8453',
  amount: '1000000',
  asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  payTo: '0x339559a2d1cd15059365fc7bd36b3047bba480e0',
  maxTimeoutSeconds: 300,
  extra: { name: 'USD Coin', version: '2' },
};

const paymentPayload = {
  x402Version: 2,
  payload: {
    authorization: {
      from: '0x2918daC125A0346Df9f1B8941ef3B5F82B6E77ed',
      to: '0x339559A2d1CD15059365FC7bD36b3047BbA480E0',
      value: '1000000',
      validAfter: '1783611330',
      validBefore: '1783612230',
      nonce: '0x0b5abd4d9fbb9b50705b16a5b1f540ca5125ea112e9ba31245eb74bd7ba98b94',
    },
    signature: '0x' + '11'.repeat(65),
  },
  accepted: paymentRequirements,
};

test('settles verified x402 EIP-3009 payload by submitting USDC transferWithAuthorization', async () => {
  const calls = [];
  let constructedAddress = null;
  const fakeEthers = {
    Signature: {
      from(signature) {
        calls.push(['signature', signature]);
        return { v: 27, r: '0x' + 'aa'.repeat(32), s: '0x' + 'bb'.repeat(32) };
      },
    },
    Contract: class FakeContract {
      constructor(address, abi, signer) {
        constructedAddress = address;
        assert.equal(signer.label, 'local-settler');
        assert(Array.isArray(abi));
      }
      async transferWithAuthorization(...args) {
        calls.push(['transferWithAuthorization', args]);
        return { hash: '0x' + 'cd'.repeat(32), wait: async () => ({ status: 1 }) };
      }
    },
  };

  const { settleEip3009PaymentLocally } = require('./x402-local-settlement');
  const result = await settleEip3009PaymentLocally({
    ethers: fakeEthers,
    signer: { label: 'local-settler' },
    paymentPayload,
    paymentRequirements,
  });

  assert.equal(constructedAddress, paymentRequirements.asset);
  assert.equal(result.success, true);
  assert.equal(result.transaction, '0x' + 'cd'.repeat(32));
  assert.equal(result.network, 'eip155:8453');
  assert.equal(result.payer, paymentPayload.payload.authorization.from);
  assert.equal(result.requirements, paymentRequirements);
  assert.equal(result.headers['PAYMENT-RESPONSE'].length > 20, true);

  const transfer = calls.find(([kind]) => kind === 'transferWithAuthorization');
  assert.deepEqual(transfer[1], [
    paymentPayload.payload.authorization.from,
    paymentPayload.payload.authorization.to,
    BigInt(paymentPayload.payload.authorization.value),
    BigInt(paymentPayload.payload.authorization.validAfter),
    BigInt(paymentPayload.payload.authorization.validBefore),
    paymentPayload.payload.authorization.nonce,
    27,
    '0x' + 'aa'.repeat(32),
    '0x' + 'bb'.repeat(32),
  ]);
});

test('refuses local settlement when authorization does not match payment requirements', async () => {
  const { settleEip3009PaymentLocally } = require('./x402-local-settlement');
  await assert.rejects(
    () => settleEip3009PaymentLocally({
      ethers: { Contract: class {}, Signature: { from() { throw new Error('should not parse signature'); } } },
      signer: {},
      paymentPayload: {
        ...paymentPayload,
        payload: {
          ...paymentPayload.payload,
          authorization: { ...paymentPayload.payload.authorization, value: '1' },
        },
      },
      paymentRequirements,
    }),
    /amount mismatch/,
  );
});
