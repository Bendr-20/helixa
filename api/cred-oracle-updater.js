#!/usr/bin/env node
/**
 * Batch-write Cred scores to CredOracle contract
 * Run via cron every hour or manually
 */
const path = require('path');
const fs = require('fs');
const { ethers } = require(path.join(__dirname, 'node_modules', 'ethers'));

// Load env
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
        const [key, ...val] = line.split('=');
        if (key && val.length) process.env[key.trim()] = val.join('=').trim();
    });
}

const ORACLE_ADDRESS = process.env.CRED_ORACLE_ADDRESS || '0xD77354Aebea97C65e7d4a605f91737616FFA752f';
const ORACLE_ABI = [
    'function batchUpdate(uint256[] calldata tokenIds, uint8[] calldata scores) external',
    'function getCredScore(uint256 tokenId) external view returns (uint8)',
    'function owner() external view returns (address)',
];

const API_BASE = 'http://localhost:3457';
// Use V2 Helixa agents (tokenId 1-N) not terminal indexer IDs

async function main() {
    // Get deployer key
    let deployerKey = process.env.DEPLOYER_KEY;
    if (!deployerKey) {
        const { SecretsManagerClient, GetSecretValueCommand } = require(path.join(__dirname, 'node_modules', '@aws-sdk', 'client-secrets-manager'));
        const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-2' });
        const resp = await client.send(new GetSecretValueCommand({ SecretId: 'helixa/deployer-key' }));
        deployerKey = JSON.parse(resp.SecretString).DEPLOYER_PRIVATE_KEY;
    }

    const provider = new ethers.JsonRpcProvider('https://mainnet.base.org', 8453, { staticNetwork: true });
    const wallet = new ethers.Wallet(deployerKey, provider);
    const oracle = new ethers.Contract(ORACLE_ADDRESS, ORACLE_ABI, wallet);

    console.log(`Oracle: ${ORACLE_ADDRESS}`);
    console.log(`Updater: ${wallet.address}`);

    // Fetch all Helixa V2 agents with cred scores
    const http = require('http');
    const agents = await new Promise((resolve, reject) => {
        http.get(`${API_BASE}/api/v2/agents?limit=2000`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed.agents || []);
                } catch (e) { reject(e); }
            });
        }).on('error', reject);
    });

    if (!agents.length) {
        console.log('No agents found from API');
        return;
    }

    // Filter to agents with valid cred scores
    const scored = agents.filter(a => typeof a.credScore === 'number' && a.credScore >= 0 && a.credScore <= 100 && a.tokenId !== undefined);
    console.log(`${scored.length} agents with cred scores`);

    // Batch in groups of 100 to avoid gas limits
    const BATCH_SIZE = 100;
    let totalUpdated = 0;

    for (let i = 0; i < scored.length; i += BATCH_SIZE) {
        const batch = scored.slice(i, i + BATCH_SIZE);
        const tokenIds = batch.map(a => BigInt(a.tokenId));
        const scores = batch.map(a => a.credScore);

        console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} agents (IDs ${tokenIds[0]}-${tokenIds[tokenIds.length - 1]})`);
        
        try {
            const tx = await oracle.batchUpdate(tokenIds, scores);
            console.log(`  TX: ${tx.hash}`);
            const receipt = await tx.wait();
            console.log(`  Confirmed, gas: ${receipt.gasUsed.toString()}`);
            totalUpdated += batch.length;
        } catch (e) {
            console.error(`  Batch failed: ${e.message}`);
        }
    }

    console.log(`\n✅ Updated ${totalUpdated} scores onchain`);
    
    // Verify a few
    if (scored.length > 0) {
        const sample = scored[0];
        const onchain = await oracle.getCredScore(sample.tokenId);
        console.log(`Verify: Agent #${sample.tokenId} = ${onchain} (expected ${sample.credScore})`);
    }
}

main().catch(e => { console.error(e); process.exit(1); });
