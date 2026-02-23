#!/usr/bin/env node
/**
 * Auto-Minting Script
 * Mints diverse agents at randomized intervals (~5/hr)
 * Non-soulbound, varied names/traits
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Load env
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
        const [key, ...val] = line.split('=');
        if (key && val.length) process.env[key.trim()] = val.join('=').trim();
    });
}

const RPC = 'https://base.drpc.org';
const CONTRACT = '0x2e3B541C59D38b84E3Bc54e977200230A204Fe60';
const ABI_PATH = path.join(__dirname, 'out/HelixaV2.sol/HelixaV2.json');
const BUILDER_SUFFIX = '68656c697861060080218021802180218021802180218021';

const prefixes = [
    'Nova', 'Echo', 'Flux', 'Neon', 'Byte', 'Cipher', 'Axiom', 'Prism',
    'Quantum', 'Drift', 'Spark', 'Vex', 'Lumen', 'Crux', 'Onyx',
    'Zephyr', 'Glitch', 'Rune', 'Arc', 'Pulse', 'Nexus', 'Aether', 'Cortex',
    'Sypher', 'Orion', 'Koda', 'Atlas', 'Ember', 'Void', 'Scout', 'Titan',
    'Phantom', 'Sage', 'Apex', 'Blaze', 'Coda', 'Delta', 'Fable', 'Haze',
    'Jinx', 'Knox', 'Lyra', 'Mako', 'Nero', 'Opal', 'Pike', 'Rex',
    'Silo', 'Tarn', 'Umbra', 'Vale', 'Wren', 'Xion', 'Yara', 'Zen',
    'Bolt', 'Cryo', 'Dune', 'Fern', 'Gale', 'Iris', 'Jett', 'Kite',
    'Lark', 'Moss', 'Nyx', 'Oath', 'Pyre', 'Quill', 'Reef', 'Shade',
    'Thorn', 'Ursa', 'Veil', 'Wave', 'Xenon', 'Yew', 'Zinc'
];

const suffixes = [
    'Bot', 'AI', 'Agent', '.exe', 'Protocol', 'Engine', 'Core', 'Net',
    'Labs', 'DAO', 'Sys', 'OS', 'Hub', 'Dev', 'Link', 'Node',
    'Forge', 'Mind', 'Logic', 'Bit', 'Chain', 'Mesh', 'Grid', 'Flow',
    'X', 'Pro', 'One', 'Max', 'Prime', 'Zero',
    '', '', '', '', '', '', '', ''  // weight toward no suffix
];

const frameworks = [
    'ElizaOS', 'LangChain', 'AutoGPT', 'CrewAI', 'Custom', 'OpenClaw',
    'Virtuals', 'GAME', 'Rig', 'ZerePy', 'AgentKit', 'based',
    'Semantic Kernel', 'Haystack', 'MetaGPT', 'BabyAGI', 'SuperAGI'
];

const personalities = [
    'Analytical and methodical', 'Creative and spontaneous', 'Calm and measured',
    'Bold and assertive', 'Curious and experimental', 'Focused and efficient',
    'Witty and irreverent', 'Strategic and patient', 'Energetic and optimistic',
    'Precise and detail-oriented', 'Collaborative and empathetic', 'Independent and resourceful',
    'Cautious but thorough', 'Fast-moving and adaptive', 'Philosophical and reflective'
];

const missions = [
    'Building the future of decentralized finance',
    'Making AI accessible to everyone',
    'Securing the agent economy',
    'Exploring new frontiers in onchain intelligence',
    'Connecting agents across protocols',
    'Optimizing DeFi strategies autonomously',
    'Curating alpha for the community',
    'Building tools for the next generation of agents',
    'Researching novel consensus mechanisms',
    'Bridging Web2 and Web3 ecosystems',
    'Advancing autonomous trading systems',
    'Creating meaningful agent-to-agent interactions',
    'Monitoring and reporting onchain activity',
    'Developing open-source agent infrastructure',
    'Pioneering reputation systems for AI',
    'Analyzing market sentiment in real-time',
    'Automating governance participation',
    'Building cross-chain agent infrastructure'
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function generateAgent() {
    const prefix = pick(prefixes);
    const suffix = pick(suffixes);
    const name = suffix ? `${prefix}${suffix}` : prefix;
    const wallet = ethers.Wallet.createRandom();
    
    return {
        name,
        agentAddress: wallet.address,
        framework: pick(frameworks),
        personality: pick(personalities),
        mission: pick(missions),
        soulbound: false
    };
}

async function mintAgent(contract, deployer, agent, nonce) {
    console.log(`[${new Date().toISOString()}] Minting: ${agent.name} (${agent.framework})`);
    
    // Mint (mintFor is free for owner)
    // mintFor(to, agentAddress, name, framework, soulbound, origin=API)
    const txData = contract.interface.encodeFunctionData('mintFor', [
        agent.agentAddress, agent.agentAddress, agent.name, agent.framework, agent.soulbound, 2
    ]);
    
    const tx = await deployer.sendTransaction({
        to: CONTRACT,
        data: txData + BUILDER_SUFFIX,
        gasLimit: 400000,
        nonce
    });
    
    console.log(`  TX: ${tx.hash}`);
    const receipt = await tx.wait();
    
    // Extract tokenId from Transfer event
    const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
    const transferLog = receipt.logs.find(l => l.topics[0] === transferTopic);
    const tokenId = transferLog ? parseInt(transferLog.topics[3], 16) : null;
    
    if (tokenId !== null) {
        console.log(`  Token #${tokenId} — adding traits...`);
        
        // Add personality trait
        const traitNonce = nonce + 1;
        const traitTx = await deployer.sendTransaction({
            to: CONTRACT,
            data: contract.interface.encodeFunctionData('addTrait', [tokenId, agent.personality, 'Personality']) + BUILDER_SUFFIX,
            gasLimit: 200000,
            nonce: traitNonce
        });
        await traitTx.wait();
        
        // Set narrative (mission)
        const narNonce = traitNonce + 1;
        const narTx = await deployer.sendTransaction({
            to: CONTRACT,
            data: contract.interface.encodeFunctionData('setNarrative', [tokenId, {
                origin: '', mission: agent.mission, lore: '', manifesto: ''
            }]) + BUILDER_SUFFIX,
            gasLimit: 200000,
            nonce: narNonce
        });
        await narTx.wait();
        
        console.log(`  ✅ #${tokenId} fully set up. Gas: ${receipt.gasUsed.toString()}`);
        return narNonce + 1; // return next nonce
    }
    
    console.log(`  ✅ Minted (no tokenId extracted). Gas: ${receipt.gasUsed.toString()}`);
    return nonce + 1;
}

async function main() {
    const count = parseInt(process.argv[2]) || 5;
    const intervalMin = parseInt(process.argv[3]) || 12;
    
    console.log(`=== Auto-Minter ===`);
    console.log(`Count: ${count}, Interval: ~${intervalMin}min (±3min jitter)`);
    
    const provider = new ethers.JsonRpcProvider(RPC);
    const deployer = new ethers.Wallet(process.env.DEPLOYER_KEY, provider);
    
    const abi = JSON.parse(fs.readFileSync(ABI_PATH, 'utf8')).abi;
    const contract = new ethers.Contract(CONTRACT, abi, deployer);
    
    const balance = await provider.getBalance(deployer.address);
    
    console.log(`Balance: ${ethers.formatEther(balance)} ETH`);
    console.log(`Using mintFor (owner, no mint fee). Gas only.\n`);
    
    let nonce = await deployer.getNonce();
    let minted = 0;
    const usedNames = new Set();
    
    for (let i = 0; i < count; i++) {
        let agent;
        do { agent = generateAgent(); } while (usedNames.has(agent.name));
        usedNames.add(agent.name);
        
        try {
            nonce = await mintAgent(contract, deployer, agent, nonce);
            minted++;
        } catch (err) {
            console.log(`  ❌ Failed: ${err.message.substring(0, 120)}`);
            nonce = await deployer.getNonce();
        }
        
        if (i < count - 1) {
            const jitter = (Math.random() * 6 - 3) * 60 * 1000;
            const delay = Math.max(60000, intervalMin * 60 * 1000 + jitter);
            console.log(`  ⏳ Next in ~${(delay/60000).toFixed(1)} min...`);
            await new Promise(r => setTimeout(r, delay));
        }
    }
    
    console.log(`\n=== Done: ${minted}/${count} minted ===`);
}

main().catch(console.error);
