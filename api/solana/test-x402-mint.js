#!/usr/bin/env node
/**
 * Test script: Full x402 agent mint flow
 * 
 * Usage:
 *   AGENT_PRIVATE_KEY=0x... node test-x402-mint.js
 *   
 * Requirements:
 *   - Agent wallet needs $1 USDC on Base
 *   - Agent wallet needs tiny ETH for gas (~0.0001 ETH)
 *   - npm install @x402/fetch @x402/evm viem
 */

const API_BASE = process.env.API_URL || 'https://api.helixa.xyz';

async function main() {
    const { ethers } = require('ethers');
    
    const key = process.env.AGENT_PRIVATE_KEY;
    if (!key) {
        console.error('Set AGENT_PRIVATE_KEY env var');
        process.exit(1);
    }
    
    const wallet = new ethers.Wallet(key);
    console.log(`Agent wallet: ${wallet.address}`);
    
    // Step 1: Generate SIWA auth header
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const message = `Sign-In With Agent: api.helixa.xyz wants you to sign in with your wallet ${wallet.address} at ${timestamp}`;
    const signature = await wallet.signMessage(message);
    const authHeader = `Bearer ${wallet.address}:${timestamp}:${signature}`;
    console.log('SIWA auth generated');
    
    // Step 2: Set up x402 payment client
    const { createWalletClient, http } = require('viem');
    const { privateKeyToAccount } = require('viem/accounts');
    const { base } = require('viem/chains');
    
    const account = privateKeyToAccount(key);
    const walletClient = createWalletClient({
        account,
        chain: base,
        transport: http('https://mainnet.base.org'),
    });
    
    const { wrapFetchWithPayment, x402Client } = require('@x402/fetch');
    const { ExactEvmScheme } = require('@x402/evm/exact/client');
    const { toClientEvmSigner } = require('@x402/evm');
    
    const signer = toClientEvmSigner(walletClient);
    signer.address = walletClient.account.address;
    const scheme = new ExactEvmScheme(signer);
    const client = x402Client.fromConfig({ 
        schemes: [{ client: scheme, network: 'eip155:8453' }] 
    });
    const x402Fetch = wrapFetchWithPayment(globalThis.fetch, client);
    console.log('x402 client configured');
    
    // Step 3: Mint
    console.log(`\nMinting agent on ${API_BASE}...`);
    const res = await x402Fetch(`${API_BASE}/api/v2/mint`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader,
        },
        body: JSON.stringify({
            name: 'TestAgent-' + Date.now().toString(36),
            framework: 'custom',
            personality: {
                quirks: 'curious',
                communicationStyle: 'direct',
                values: 'transparency',
                humor: 'dry',
                riskTolerance: 5,
                autonomyLevel: 7,
            },
        }),
    });
    
    console.log(`Response: ${res.status} ${res.statusText}`);
    const result = await res.json();
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success) {
        console.log(`\n✅ Minted! Token #${result.tokenId}`);
        console.log(`Explorer: ${result.explorer}`);
    } else {
        console.log(`\n❌ Failed: ${result.error || JSON.stringify(result)}`);
    }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
