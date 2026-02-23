// End-to-end x402 mint test
const { createWalletClient, createPublicClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { base } = require('viem/chains');
const crypto = require('crypto');

const DEPLOYER_KEY = process.env.DEPLOYER_KEY;
const API_URL = 'https://api.helixa.xyz/api/v2/mint';
const SIWA_DOMAIN = 'api.helixa.xyz';

async function main() {
  const account = privateKeyToAccount(DEPLOYER_KEY);
  console.log('Wallet:', account.address);

  // Step 1: Get 402
  console.log('\n--- Step 1: GET 402 ---');
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'x402-e2e-test', framework: 'openclaw' }),
  });
  console.log('Status:', res.status);
  if (res.status !== 402) { console.log(await res.text()); return; }

  // Parse 402 response to get payment requirements
  const headers402 = {};
  res.headers.forEach((v, k) => { headers402[k] = v; });
  console.log('402 Headers:', Object.keys(headers402).join(', '));
  
  // The SDK returns requirements in payment-required header (base64 JSON)
  // Check all possible headers for payment requirements
  const prHeader = res.headers.get('payment-required');
  console.log('payment-required header:', prHeader ? prHeader.substring(0, 100) + '...' : 'null');
  
  let req402;
  if (prHeader) {
    try {
      // Could be base64 or plain JSON
      let decoded;
      try { decoded = JSON.parse(Buffer.from(prHeader, 'base64').toString()); } catch(e) { decoded = JSON.parse(prHeader); }
      console.log('Decoded payment-required:', JSON.stringify(decoded).substring(0, 500));
      // Could be array or object with accepts
      req402 = Array.isArray(decoded) ? decoded[0] : (decoded.accepts?.[0] || decoded);
    } catch(e) { console.log('Failed to parse payment-required:', e.message); }
  }
  if (!req402) {
    const body = await res.json().catch(() => ({}));
    console.log('402 body:', JSON.stringify(body).substring(0, 500));
    req402 = body.accepts?.[0] || body;
  }
  console.log('Payment req:', JSON.stringify(req402).substring(0, 300));

  if (!req402 || !req402.payTo) {
    console.log('❌ Could not parse payment requirements');
    return;
  }

  // Step 2: Build SIWA auth
  console.log('\n--- Step 2: SIWA Auth ---');
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const siwaMessage = `Sign-In With Agent: ${SIWA_DOMAIN} wants you to sign in with your wallet ${account.address} at ${timestamp}`;
  const siwaSig = await account.signMessage({ message: siwaMessage });
  const authHeader = `Bearer ${account.address}:${timestamp}:${siwaSig}`;
  console.log('SIWA ready');

  // Step 3: Sign EIP-3009 TransferWithAuthorization
  console.log('\n--- Step 3: Sign x402 Payment ---');
  const nonce = '0x' + crypto.randomBytes(32).toString('hex');
  const now = Math.floor(Date.now() / 1000);

  const authorization = {
    from: account.address,
    to: req402.payTo,
    value: BigInt(req402.maxAmountRequired || req402.amount),
    validAfter: BigInt(now - 600),
    validBefore: BigInt(now + (req402.maxTimeoutSeconds || 3600)),
    nonce: nonce,
  };

  const signature = await account.signTypedData({
    domain: {
      name: req402.extra?.name || 'USD Coin',
      version: req402.extra?.version || '2',
      chainId: 8453,
      verifyingContract: req402.asset,
    },
    types: {
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
      ],
    },
    primaryType: 'TransferWithAuthorization',
    message: authorization,
  });
  console.log('Sig:', signature.slice(0, 20) + '...');

  // Step 4: Build V2 payment payload
  const payloadV2 = {
    x402Version: 2,
    accepted: req402,
    payload: {
      authorization: {
        from: account.address,
        to: req402.payTo,
        value: (req402.maxAmountRequired || req402.amount).toString(),
        validAfter: authorization.validAfter.toString(),
        validBefore: authorization.validBefore.toString(),
        nonce: nonce,
      },
      signature: signature,
    },
  };

  const paymentB64 = Buffer.from(JSON.stringify(payloadV2)).toString('base64');

  // Step 5: Send with both x402 payment AND SIWA auth
  console.log('\n--- Step 4: Mint with x402 + SIWA ---');
  const res2 = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
      'Payment-Signature': paymentB64,
      'X-Payment': paymentB64,
    },
    body: JSON.stringify({ name: 'x402-e2e-test-' + Date.now(), framework: 'openclaw' }),
  });

  console.log('Status:', res2.status);
  const body = await res2.text();
  console.log('Body:', body.substring(0, 500));
  console.log(res2.status < 400 ? '\n✅ SUCCESS!' : '\n❌ FAILED');
}

main().catch(console.error);
