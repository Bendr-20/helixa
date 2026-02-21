// x402 v2 end-to-end mint test using official @x402/fetch SDK
require('dotenv').config();
const { createWalletClient, http, publicActions } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { base } = require('viem/chains');
const { wrapFetchWithPayment, x402Client } = require('@x402/fetch');
const { ExactEvmScheme } = require('@x402/evm/exact/client');
const { toClientEvmSigner } = require('@x402/evm');

const API_URL = 'https://api.helixa.xyz/api/v2/mint';

async function main() {
  const account = privateKeyToAccount(process.env.DEPLOYER_KEY);
  console.log('Wallet:', account.address);

  // Create viem wallet client
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http('https://mainnet.base.org'),
  }).extend(publicActions);

  // Create x402 payment-wrapped fetch
  const rawSigner = toClientEvmSigner(walletClient);
  // Fix: viem walletClient doesn't expose .address directly
  rawSigner.address = walletClient.account.address;
  const scheme = new ExactEvmScheme(rawSigner);
  const client = x402Client.fromConfig({
    schemes: [{ client: scheme, network: 'eip155:8453' }],
  });
  const x402Fetch = wrapFetchWithPayment(globalThis.fetch, client);

  // Build SIWA auth
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const siwaMessage = `Sign-In With Agent: api.helixa.xyz wants you to sign in with your wallet ${account.address} at ${timestamp}`;
  const siwaSig = await account.signMessage({ message: siwaMessage });
  const authHeader = `Bearer ${account.address}:${timestamp}:${siwaSig}`;
  console.log('SIWA auth ready');

  // Make the request — x402Fetch handles 402 + payment automatically
  console.log('\nSending mint request with x402 payment...');
  const agentName = 'x402-test-' + Date.now();
  
  const res = await x402Fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
    },
    body: JSON.stringify({
      name: agentName,
      framework: 'openclaw',
    }),
  });

  console.log('Status:', res.status);
  const body = await res.text();
  console.log('Response:', body.substring(0, 500));
  console.log(res.status < 400 ? '\n✅ SUCCESS!' : '\n❌ FAILED');
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
