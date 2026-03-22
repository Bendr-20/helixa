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

  const name = process.argv[2] || 'MyAgent';
  const framework = process.argv[3] || 'openclaw';

  const authHeader = await generateSIWA(privateKey);

  // For x402 payment support, use wrapFetchWithPayment from @x402/fetch
  // See SKILL.md for full x402 setup
  let res;
  try {
    res = await fetch('https://api.helixa.xyz/api/v2/mint', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({ name, framework }),
    });
  } catch (err) {
    console.error('Network error during mint request:', err.message);
    console.error('If using x402, check your wallet balance to verify whether payment was sent before retrying.');
    process.exit(1);
  }

  if (res.status === 402) {
    console.log('Payment required — integrate @x402/fetch for automatic payment handling.');
    console.log('See SKILL.md for x402 setup instructions.');
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
