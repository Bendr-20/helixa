#!/usr/bin/env node
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const V2_ADDRESS = '0x2e3B541C59D38b84E3Bc54e977200230A204Fe60';
const REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';
const DEPLOYER_KEY = process.env.DEPLOYER_KEY;
const READ_RPC = 'https://base.drpc.org';
const WRITE_RPC = 'https://mainnet.base.org';
const PROGRESS_FILE = path.join(__dirname, 'reregister-progress.json');

const readProvider = new ethers.JsonRpcProvider(READ_RPC);
const writeProvider = new ethers.JsonRpcProvider(WRITE_RPC);
const wallet = new ethers.Wallet(DEPLOYER_KEY, writeProvider);

const v2Artifact = JSON.parse(fs.readFileSync(path.join(__dirname, 'out', 'HelixaV2.sol', 'HelixaV2.json'), 'utf8'));
const v2Read = new ethers.Contract(V2_ADDRESS, v2Artifact.abi, readProvider);

const REGISTRY_ABI = [
    'function register(string agentURI) external returns (uint256 agentId)',
    'function setAgentURI(uint256 agentId, string newURI) external',
    'function agentURI(uint256 agentId) external view returns (string)',
    'function balanceOf(address) view returns (uint256)',
    'function totalSupply() view returns (uint256)',
];
const registryWrite = new ethers.Contract(REGISTRY, REGISTRY_ABI, wallet);

function buildRegistrationFile(tokenId, name, framework, narrative) {
    let description;
    if (narrative?.mission) {
        description = narrative.mission;
    } else if (narrative?.origin) {
        description = narrative.origin;
    } else {
        description = `${name} — AI agent on Base (${framework}).`;
    }
    description = description.replace(/Helixa/gi, '').replace(/most complete ERC-8004/gi, '').trim();
    return {
        type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
        name,
        description,
        image: `https://api.helixa.xyz/api/v2/agent/${tokenId}/card.png`,
        services: [{ name: 'web', endpoint: `https://helixa.xyz/agent/${tokenId}` }],
        x402Support: true,
        active: true,
        registrations: [{ agentId: tokenId, agentRegistry: `eip155:8453:${V2_ADDRESS}` }],
    };
}

function toDataURI(regFile) {
    return 'data:application/json;base64,' + Buffer.from(JSON.stringify(regFile)).toString('base64');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function loadProgress() {
    try { return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')); } catch { return { done: {} }; }
}
function saveProgress(p) { fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2)); }

async function waitForTx(tx, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const receipt = await tx.wait(1, 60000); // 1 confirmation, 60s timeout
            return receipt;
        } catch (e) {
            if (i === retries - 1) {
                // Last resort: check if tx was mined
                try {
                    const receipt = await writeProvider.getTransactionReceipt(tx.hash);
                    if (receipt) return receipt;
                } catch {}
                throw e;
            }
            console.log(`    ⏳ Retry wait (${i+1}/${retries})...`);
            await sleep(5000);
        }
    }
}

async function main() {
    console.log('Deployer:', wallet.address);
    const balance = await writeProvider.getBalance(wallet.address);
    console.log('Balance:', ethers.formatEther(balance), 'ETH');
    
    const progress = loadProgress();
    const doneSet = new Set(Object.keys(progress.done).map(Number));
    console.log(`Already completed: ${doneSet.size} agents`);
    
    // Read all 99 agents
    console.log('\n--- Reading V2 agent data ---');
    const agents = [];
    for (let i = 0; i < 99; i++) {
        if (doneSet.has(i)) { agents.push(null); continue; } // Skip already done
        try {
            const agent = await v2Read.getAgent(i);
            let narrative = null;
            try {
                const n = await v2Read.getNarrative(i);
                narrative = { origin: n[0] || '', mission: n[1] || '', lore: n[2] || '' };
            } catch {}
            agents.push({ tokenId: i, name: agent.name || agent[0], framework: agent.framework || agent[1], narrative });
            if (i % 10 === 0) console.log(`  Read agent ${i}/98`);
        } catch (e) {
            console.log(`  Failed to read agent ${i}: ${e.message.slice(0, 60)}`);
            agents.push(null);
        }
        await sleep(150);
    }
    
    const todo = agents.filter(Boolean);
    console.log(`Agents to register: ${todo.length}`);
    if (todo.length === 0) { console.log('All done!'); return; }
    
    // Execute
    console.log('\n--- Executing transactions ---');
    let nonce = await writeProvider.getTransactionCount(wallet.address);
    let success = 0, failed = 0;
    
    for (const agent of todo) {
        const regFile = buildRegistrationFile(agent.tokenId, agent.name, agent.framework, agent.narrative);
        const dataURI = toDataURI(regFile);
        
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                console.log(`  Registering V2 #${agent.tokenId} "${agent.name}" (nonce=${nonce})...`);
                const tx = await registryWrite['register(string)'](dataURI, { nonce, type: 2 });
                const receipt = await waitForTx(tx);
                console.log(`    ✅ tx: ${receipt.hash} (gas: ${receipt.gasUsed})`);
                progress.done[agent.tokenId] = { tx: receipt.hash, registryId: null };
                saveProgress(progress);
                nonce++;
                success++;
                break;
            } catch (e) {
                const msg = e.message.slice(0, 100);
                console.log(`    ❌ Attempt ${attempt+1}: ${msg}`);
                if (msg.includes('nonce has already been used') || msg.includes('replacement fee too low')) {
                    nonce = await writeProvider.getTransactionCount(wallet.address);
                    await sleep(2000);
                } else {
                    await sleep(5000);
                    nonce = await writeProvider.getTransactionCount(wallet.address);
                }
                if (attempt === 2) failed++;
            }
        }
        await sleep(1000);
    }
    
    const finalBalance = await writeProvider.getBalance(wallet.address);
    console.log(`\n--- Done ---`);
    console.log(`Success: ${success}, Failed: ${failed}`);
    console.log(`ETH spent: ${ethers.formatEther(balance - finalBalance)}`);
    console.log(`Remaining balance: ${ethers.formatEther(finalBalance)} ETH`);
    console.log(`Total registered: ${Object.keys(progress.done).length}/99`);
}

main().catch(e => { console.error(e); process.exit(1); });
