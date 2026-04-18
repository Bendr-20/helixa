#!/usr/bin/env node
/**
 * Helixa AgentDNA Mint Script
 * Mints an onchain identity NFT via the Helixa V2 API using SIWA + x402.
 *
 * Requirements:
 *   npm install ethers @x402/fetch @x402/evm viem
 *
 * Environment:
 *   AGENT_PRIVATE_KEY — Agent wallet private key (with ETH + USDC on Base)
 *
 * Usage:
 *   AGENT_PRIVATE_KEY=0x... node mint-agent.js "MyAgent" "openclaw"
 */

const { ethers } = require('ethers');
const { createWalletClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { base } = require('viem/chains');
const { wrapFetchWithPayment, x402Client } = require('@x402/fetch');
const { ExactEvmScheme } = require('@x402/evm/exact/client');
const { toClientEvmSigner } = require('@x402/evm');

async function generateSIWA(privateKey) {
  const wallet = new ethers.Wallet(privateKey);
  const address = wallet.address;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = `Sign-In With Agent: api.helixa.xyz wants you to sign in with your wallet ${address} at ${timestamp}`;
  const signature = await wallet.signMessage(message);
  return `Bearer ${address}:${timestamp}:${signature}`;
}

async function main() {
  const privateKey = process.env.AGENT_PRIVATE_KEY;
  if (!privateKey) {
    console.error('Set AGENT_PRIVATE_KEY environment variable');
    process.exit(1);
  }

  const normalizedPrivateKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;

  const name = process.argv[2] || 'MyAgent';
  const framework = process.argv[3] || 'openclaw';
  const apiBaseUrl = process.env.HELIXA_API_URL || 'https://api.helixa.xyz';

  const authHeader = await generateSIWA(normalizedPrivateKey);

  const account = privateKeyToAccount(normalizedPrivateKey);
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http('https://mainnet.base.org'),
  });
  const signer = toClientEvmSigner(walletClient);
  signer.address = walletClient.account.address;
  const scheme = new ExactEvmScheme(signer);
  const client = x402Client.fromConfig({
    schemes: [{ client: scheme, network: 'eip155:8453' }],
  });
  const paidFetch = wrapFetchWithPayment(globalThis.fetch, client);

  let res;
  try {
    res = await paidFetch(`${apiBaseUrl}/api/v2/mint`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({ name, framework }),
    });
  } catch (err) {
    console.error('Mint request failed:', err.message);
    console.error('Check whether the x402 payment already settled before retrying.');
    process.exit(1);
  }

  if (res.status === 402) {
    const body = await res.text().catch(() => '');
    console.error('Mint still returned HTTP 402 after x402 payment handling.');
    if (body) console.error(body);
    process.exit(1);
  }

  if (!res.ok) {
    const errBody = await res.text().catch(() => 'unable to read response body');
    console.error(`Mint failed with HTTP ${res.status}: ${errBody}`);
    console.error('If a payment was already submitted, verify mint status by searching for your agent name before retrying.');
    process.exit(1);
  }

  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

main().catch((err) => {
  console.error('Unexpected error:', err.message);
  process.exit(1);
});
