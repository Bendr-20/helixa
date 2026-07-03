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
const MULTICALL3_ADDRESS = process.env.MULTICALL3_ADDRESS || '0xca11bde05977b3631167028862be2a173976ca11';
const MULTICALL3_ABI = [
    'function aggregate3(tuple(address target,bool allowFailure,bytes callData)[] calls) view returns (tuple(bool success, bytes returnData)[] returnData)'
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

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchOnchainScores(provider, tokenIds) {
    const scores = new Map();

    if (!tokenIds.length) {
        return scores;
    }

    const iface = new ethers.Interface(ORACLE_ABI);
    const multicall = new ethers.Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, provider);
    const chunkSize = 250;

    for (let i = 0; i < tokenIds.length; i += chunkSize) {
        const batch = tokenIds.slice(i, i + chunkSize);
        const calls = batch.map((tokenId) => ({
            target: ORACLE_ADDRESS,
            allowFailure: false,
            callData: iface.encodeFunctionData('getCredScore', [tokenId]),
        }));

        const results = await multicall.aggregate3.staticCall(calls);

        results.forEach((result, idx) => {
            if (!result.success) {
                throw new Error(`Failed to fetch onchain score for token ${batch[idx]}`);
            }

            const [score] = iface.decodeFunctionResult('getCredScore', result.returnData);
            scores.set(Number(batch[idx]), Number(score));
        });

        console.log(`Fetched onchain scores ${Math.min(i + batch.length, tokenIds.length)}/${tokenIds.length}`);
    }

    return scores;
}

async function verifyScoreWithRetry({ tokenId, expectedScore, oracleWrite, oracleRead, attempts = 6, delayMs = 2000 }) {
    let lastReadings = [];

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        const readings = [];

        for (const [name, oracle] of [['write', oracleWrite], ['read', oracleRead]]) {
            try {
                const score = Number(await oracle.getCredScore(tokenId));
                readings.push(`${name}:${score}`);
                if (score === expectedScore) {
                    if (attempt > 1 || name !== 'write') {
                        console.log(`Verify settled on attempt ${attempt} via ${name} RPC: Agent #${tokenId} = ${score} (expected ${expectedScore})`);
                    }
                    return score;
                }
            } catch (err) {
                readings.push(`${name}:ERR:${formatError(err)}`);
            }
        }

        lastReadings = readings;
        console.log(`Verify mismatch on attempt ${attempt}: Agent #${tokenId}, expected ${expectedScore}, got ${readings.join(', ')}`);
        if (attempt < attempts) {
            await sleep(delayMs);
        }
    }

    throw new Error(`Post-write verification failed for agent #${tokenId}: expected ${expectedScore}, readings ${lastReadings.join(', ')}`);
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

    const readProvider = new ethers.JsonRpcProvider(process.env.BASE_READ_RPC || 'https://base.drpc.org', 8453, { staticNetwork: true });
    const writeProvider = new ethers.JsonRpcProvider(process.env.BASE_WRITE_RPC || 'https://mainnet.base.org', 8453, { staticNetwork: true });
    const wallet = new ethers.Wallet(deployerKey, writeProvider);
    const oracle = new ethers.Contract(ORACLE_ADDRESS, ORACLE_ABI, wallet);
    const oracleRead = new ethers.Contract(ORACLE_ADDRESS, ORACLE_ABI, readProvider);
    const balance = await writeProvider.getBalance(wallet.address);

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

    const onchainScores = await fetchOnchainScores(readProvider, scored.map(a => BigInt(a.tokenId)));
    const pending = scored.filter(a => onchainScores.get(Number(a.tokenId)) !== a.credScore);
    console.log(`${pending.length} agents need onchain score updates`);

    if (!pending.length) {
        const sample = scored[0];
        const onchain = onchainScores.get(Number(sample.tokenId));
        console.log('No score changes detected, oracle already in sync.');
        console.log(`Verify: Agent #${sample.tokenId} = ${onchain} (expected ${sample.credScore})`);
        return;
    }

    // Batch in groups of 100 to avoid gas limits
    const BATCH_SIZE = 100;
    let totalUpdated = 0;
    let failedBatches = 0;

    if (pending.length > 0) {
        const preview = pending.slice(0, Math.min(BATCH_SIZE, pending.length));
        const previewTokenIds = preview.map(a => BigInt(a.tokenId));
        const previewScores = preview.map(a => a.credScore);
        const feeData = await writeProvider.getFeeData();
        const gasEstimate = await oracle.batchUpdate.estimateGas(previewTokenIds, previewScores);
        const maxFeePerGas = feeData.maxFeePerGas || feeData.gasPrice;
        if (maxFeePerGas) {
            const estimatedBatchCost = gasEstimate * maxFeePerGas;
            const batchCount = Math.ceil(pending.length / BATCH_SIZE);
            const estimatedTotalCost = estimatedBatchCost * BigInt(batchCount);
            console.log(`Estimated first batch cost: ~${ethers.formatEther(estimatedBatchCost)} ETH (${gasEstimate.toString()} gas @ max ${ethers.formatUnits(maxFeePerGas, 'gwei')} gwei)`);
            console.log(`Estimated total cost: ~${ethers.formatEther(estimatedTotalCost)} ETH across ${batchCount} batch(es)`);
            if (balance < estimatedTotalCost) {
                throw new Error(`Insufficient updater balance: have ${ethers.formatEther(balance)} ETH, need about ${ethers.formatEther(estimatedTotalCost)} ETH for ${batchCount} batch(es)`);
            }
        }
    }

    let nextNonce = await wallet.getNonce('pending');

    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
        const batch = pending.slice(i, i + BATCH_SIZE);
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
    if (pending.length > 0) {
        const sample = pending[0];
        const onchain = await verifyScoreWithRetry({
            tokenId: sample.tokenId,
            expectedScore: sample.credScore,
            oracleWrite: oracle,
            oracleRead: oracleRead,
        });
        console.log(`Verify: Agent #${sample.tokenId} = ${onchain} (expected ${sample.credScore})`);
    }
}

main().catch(e => { console.error(e); process.exit(1); });
