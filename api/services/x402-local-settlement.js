const { eip3009ABI } = require('@x402/evm');
const { encodePaymentResponseHeader } = require('@x402/core/http');

function normalizeAddress(value) {
  return String(value || '').toLowerCase();
}

function assertExactEip3009Settlement(paymentPayload, paymentRequirements) {
  if (!paymentPayload || paymentPayload.x402Version !== 2) {
    throw new Error('local settlement requires x402 v2 payload');
  }
  if (!paymentRequirements || paymentRequirements.scheme !== 'exact') {
    throw new Error('local settlement requires exact payment requirements');
  }
  if (paymentRequirements.network !== 'eip155:8453') {
    throw new Error('local settlement only supports Base (eip155:8453)');
  }

  const authorization = paymentPayload.payload?.authorization;
  const signature = paymentPayload.payload?.signature;
  if (!authorization || !signature) {
    throw new Error('local settlement requires EIP-3009 authorization and signature');
  }

  if (normalizeAddress(authorization.to) !== normalizeAddress(paymentRequirements.payTo)) {
    throw new Error('local settlement recipient mismatch');
  }
  if (String(authorization.value) !== String(paymentRequirements.amount)) {
    throw new Error('local settlement amount mismatch');
  }
  if (!authorization.from || !authorization.nonce || !authorization.validAfter || !authorization.validBefore) {
    throw new Error('local settlement authorization is incomplete');
  }

  return { authorization, signature };
}

async function settleEip3009PaymentLocally({ ethers, signer, paymentPayload, paymentRequirements }) {
  if (!ethers) throw new Error('ethers dependency is required for local settlement');
  if (!signer) throw new Error('local settlement signer is required');

  const { authorization, signature } = assertExactEip3009Settlement(paymentPayload, paymentRequirements);
  const parsed = ethers.Signature.from(signature);
  const token = new ethers.Contract(paymentRequirements.asset, eip3009ABI, signer);

  const tx = await token.transferWithAuthorization(
    authorization.from,
    authorization.to,
    BigInt(authorization.value),
    BigInt(authorization.validAfter),
    BigInt(authorization.validBefore),
    authorization.nonce,
    parsed.v,
    parsed.r,
    parsed.s,
  );

  const receipt = typeof tx.wait === 'function' ? await tx.wait(1) : null;
  if (receipt && receipt.status !== 1) {
    throw new Error('local x402 settlement transaction failed');
  }

  const settleResponse = {
    success: true,
    transaction: tx.hash,
    network: paymentRequirements.network,
    payer: authorization.from,
  };

  return {
    ...settleResponse,
    requirements: paymentRequirements,
    headers: {
      'PAYMENT-RESPONSE': encodePaymentResponseHeader(settleResponse),
    },
  };
}

module.exports = {
  settleEip3009PaymentLocally,
  assertExactEip3009Settlement,
};
