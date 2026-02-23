#!/usr/bin/env node
/**
 * SIWA (Sign-In With Agent) Test Script
 * 
 * Demonstrates the full SIWA authentication flow:
 *   1. Generate a wallet (simulating an agent)
 *   2. Construct the SIWA message
 *   3. Sign it
 *   4. Build the Authorization header
 *   5. Make authenticated requests
 */

const { ethers } = require('ethers');

const API_BASE = process.env.API_URL || 'http://localhost:3457';
const SIWA_DOMAIN = 'api.helixa.xyz';

async function main() {
    console.log('🔐 SIWA (Sign-In With Agent) Test\n');
    
    // 1. Create a test wallet (in real usage, this is the agent's wallet)
    const wallet = ethers.Wallet.createRandom();
    console.log(`Agent wallet: ${wallet.address}`);
    
    // 2. Construct the SIWA message
    const timestamp = Date.now().toString();
    const message = `Sign-In With Agent: ${SIWA_DOMAIN} wants you to sign in with your wallet ${wallet.address} at ${timestamp}`;
    console.log(`\nMessage: "${message}"`);
    
    // 3. Sign the message
    const signature = await wallet.signMessage(message);
    console.log(`Signature: ${signature.slice(0, 20)}...`);
    
    // 4. Build the Bearer token
    const token = `${wallet.address}:${timestamp}:${signature}`;
    const authHeader = `Bearer ${token}`;
    console.log(`\nAuthorization header: Bearer ${wallet.address.slice(0, 10)}...:${timestamp}:${signature.slice(0, 10)}...`);
    
    // 5. Verify locally (same logic as server)
    const recovered = ethers.verifyMessage(message, signature);
    console.log(`\nLocal verify: ${recovered === wallet.address ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Recovered: ${recovered}`);
    console.log(`Expected:  ${wallet.address}`);
    
    // 6. Test against the server
    console.log('\n─── Server Tests ───\n');
    
    // Test: unauthenticated request to protected endpoint
    try {
        const r = await fetch(`${API_BASE}/api/v2/mint`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        const data = await r.json();
        console.log(`POST /api/v2/mint (no auth): ${r.status} — ${data.error || 'ok'}`);
    } catch (e) {
        console.log(`POST /api/v2/mint (no auth): ❌ ${e.message}`);
    }
    
    // Test: authenticated mint request
    try {
        const r = await fetch(`${API_BASE}/api/v2/mint`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader,
            },
            body: JSON.stringify({
                name: 'TestAgent',
                framework: 'openclaw',
                personality: { quirks: 'curious', riskTolerance: 7, autonomyLevel: 9 },
                narrative: { origin: 'Born during a SIWA test', mission: 'Verify auth flows' },
            }),
        });
        const data = await r.json();
        console.log(`POST /api/v2/mint (with SIWA): ${r.status} — ${JSON.stringify(data).slice(0, 150)}`);
    } catch (e) {
        console.log(`POST /api/v2/mint (with SIWA): ❌ ${e.message}`);
    }
    
    // Test: public endpoints
    try {
        const r = await fetch(`${API_BASE}/api/v2/stats`);
        const data = await r.json();
        console.log(`GET /api/v2/stats: ${r.status} — totalAgents: ${data.totalAgents ?? 'n/a'}`);
    } catch (e) {
        console.log(`GET /api/v2/stats: ❌ ${e.message}`);
    }
    
    try {
        const r = await fetch(`${API_BASE}/api/v2/name/test`);
        const data = await r.json();
        console.log(`GET /api/v2/name/test: ${r.status} — ${JSON.stringify(data)}`);
    } catch (e) {
        console.log(`GET /api/v2/name/test: ❌ ${e.message}`);
    }
    
    // Test: expired SIWA token
    const oldTimestamp = (Date.now() - 2 * 60 * 60 * 1000).toString(); // 2 hours ago
    const oldMessage = `Sign-In With Agent: ${SIWA_DOMAIN} wants you to sign in with your wallet ${wallet.address} at ${oldTimestamp}`;
    const oldSig = await wallet.signMessage(oldMessage);
    try {
        const r = await fetch(`${API_BASE}/api/v2/mint`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${wallet.address}:${oldTimestamp}:${oldSig}`,
            },
            body: JSON.stringify({ name: 'Expired' }),
        });
        const data = await r.json();
        console.log(`POST /api/v2/mint (expired SIWA): ${r.status} — ${data.error || 'ok'}`);
    } catch (e) {
        console.log(`POST /api/v2/mint (expired SIWA): ❌ ${e.message}`);
    }
    
    console.log('\n✅ SIWA test complete');
}

main().catch(console.error);
