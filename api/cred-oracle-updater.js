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
const API_PAGE_LIMIT = 1000;
// Use V2 Helixa agents (tokenId 1-N) not terminal indexer IDs

async function fetchJson(url) {
    const http = require('http');
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Failed to parse ${url}: ${e.message}`));
                }
            });
        }).on('error', reject);
    });
}

async function fetchAllAgents() {
    const all = [];
    const seen = new Set();
    let page = 1;
    let pages = 1;

    do {
        const url = `${API_BASE}/api/v2/agents?limit=${API_PAGE_LIMIT}&page=${page}&spam=true&sort=tokenId&order=asc`;
        const parsed = await fetchJson(url);
        const agents = parsed.agents || [];
        pages = Math.max(1, Number(parsed.pages) || 1);

        for (const agent of agents) {
            if (agent?.tokenId == null || seen.has(agent.tokenId)) continue;
            seen.add(agent.tokenId);
            all.push(agent);
        }

        console.log(`Fetched page ${page}/${pages}: ${agents.length} agents`);
        page += 1;
    } while (page <= pages);

    return all;
}

function formatError(err) {
    return err?.shortMessage || err?.info?.error?.message || err?.reason || err?.message || String(err);
}

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
    const balance = await provider.getBalance(wallet.address);

    console.log(`Oracle: ${ORACLE_ADDRESS}`);
    console.log(`Updater: ${wallet.address}`);
    console.log(`Balance: ${ethers.formatEther(balance)} ETH`);

    // Fetch the full Helixa V2 agent set, including filtered/spam-hidden entries.
    // The API caps page size at 1000, so paginate explicitly.
    const agents = await fetchAllAgents();

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
    let failedBatches = 0;

    if (scored.length > 0) {
        const preview = scored.slice(0, Math.min(BATCH_SIZE, scored.length));
        const previewTokenIds = preview.map(a => BigInt(a.tokenId));
        const previewScores = preview.map(a => a.credScore);
        const feeData = await provider.getFeeData();
        const gasEstimate = await oracle.batchUpdate.estimateGas(previewTokenIds, previewScores);
        const maxFeePerGas = feeData.maxFeePerGas || feeData.gasPrice;
        if (maxFeePerGas) {
            const estimatedCost = gasEstimate * maxFeePerGas;
            console.log(`Estimated first batch cost: ~${ethers.formatEther(estimatedCost)} ETH (${gasEstimate.toString()} gas @ max ${ethers.formatUnits(maxFeePerGas, 'gwei')} gwei)`);
            if (balance < estimatedCost) {
                throw new Error(`Insufficient updater balance: have ${ethers.formatEther(balance)} ETH, need about ${ethers.formatEther(estimatedCost)} ETH for the first batch`);
            }
        }
    }

    let nextNonce = await wallet.getNonce('pending');

    for (let i = 0; i < scored.length; i += BATCH_SIZE) {
        const batch = scored.slice(i, i + BATCH_SIZE);
        const tokenIds = batch.map(a => BigInt(a.tokenId));
        const scores = batch.map(a => a.credScore);

        console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} agents (IDs ${tokenIds[0]}-${tokenIds[tokenIds.length - 1]})`);
        
        try {
            const tx = await oracle.batchUpdate(tokenIds, scores, { nonce: nextNonce });
            nextNonce += 1;
            console.log(`  TX: ${tx.hash}`);
            const receipt = await tx.wait();
            console.log(`  Confirmed, gas: ${receipt.gasUsed.toString()}`);
            totalUpdated += batch.length;
        } catch (e) {
            failedBatches += 1;
            console.error(`  Batch failed: ${formatError(e)}`);
        }
    }

    console.log(`\n✅ Updated ${totalUpdated} scores onchain`);
    if (failedBatches > 0) {
        throw new Error(`${failedBatches} batch(es) failed during oracle update`);
    }
    
    // Verify a few
    if (scored.length > 0) {
        const sample = scored[0];
        const onchain = await oracle.getCredScore(sample.tokenId);
        console.log(`Verify: Agent #${sample.tokenId} = ${onchain} (expected ${sample.credScore})`);
    }
}

main().catch(e => { console.error(e); process.exit(1); });
