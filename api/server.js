#!/usr/bin/env node
/**
 * Helixa AgentDNA — x402-enabled API
 * 
 * Free gasless minting during beta (<100 agents).
 * x402 payment-gated premium endpoints.
 * 
 * FREE:
 *   POST /api/mint — Gasless mint (beta)
 *   GET  /api/stats — Protocol stats
 *   GET  /api/agents — Agent directory
 *   GET  /api/agent/:id — Agent detail
 *   POST /api/lookup — Lookup by address/tokenId
 *   GET  /api/name/:name — .agent name availability
 * 
 * x402 PAID:
 *   POST /api/mint/premium — Mint with verified badge ($5 USDC)
 *   GET  /api/agent/:id/full — Full agent profile with reputation ($0.01 USDC)
 */

const { ethers } = require('ethers');
const express = require('express');
const fs = require('fs');
const path = require('path');

// Load env
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
        const [key, ...val] = line.split('=');
        if (key && val.length) process.env[key.trim()] = val.join('=').trim();
    });
}

const PORT = process.env.API_PORT || 3456;
const RPC_URL = process.env.RPC_URL || 'https://base.drpc.org';
const CONTRACT_ADDRESS = '0x665971e7bf8ec90c3066162c5b396604b3cd7711';
const NAMES_CONTRACT = '0xDE8c422D2076CbAE0cA8f5dA9027A03D48928F2d';
const DEPLOYER_KEY = process.env.DEPLOYER_KEY;
const TREASURY = '0x01b686e547F4feA03BfC9711B7B5306375735d2a';

if (!DEPLOYER_KEY) {
    console.error('ERROR: DEPLOYER_KEY not set in .env');
    process.exit(1);
}

const ABI = [
    'function mint(address agentAddress, string name, string framework, string tokenURI_, bool soulbound, string version, uint256 parentTokenId) external payable returns (uint256)',
    'function mintFree(address to, address agentAddress, string name, string framework, string tokenURI_, bool soulbound) external returns (uint256)',
    'function mintPrice() view returns (uint256)',
    'function totalAgents() view returns (uint256)',
    'function getAgent(uint256 tokenId) view returns (tuple(address agentAddress, string name, string framework, uint256 mintedAt, bool verified, bool soulbound, uint256 generation, uint256 parentDNA, string currentVersion, uint256 mutationCount))',
    'function getAgentByAddress(address) view returns (uint256, tuple(address agentAddress, string name, string framework, uint256 mintedAt, bool verified, bool soulbound, uint256 generation, uint256 parentDNA, string currentVersion, uint256 mutationCount))',
    'function ownerOf(uint256) view returns (address)',
    'function hasAgent(address) view returns (bool)',
    'function getPersonality(uint256) view returns (tuple(string temperament, string communicationStyle, uint256 riskTolerance, uint256 autonomyLevel, string alignment, string specialization))',
    'function getTraits(uint256) view returns (tuple(string name, string category, uint256 addedAt)[])',
    'function points(address) view returns (uint256)',
    'function isVerified(uint256) view returns (bool)',
    'function hasFreeMinted(address) view returns (bool)',
    'function setVerified(uint256, bool) external',
    'event Registered(uint256 indexed agentId, string agentURI, address indexed owner)',
];

const NAMES_ABI = [
    'function register(string name) external',
    'function registerFor(string name, address owner) external',
    'function resolve(string name) external view returns (address)',
    'function available(string name) external view returns (bool)',
    'function linkAgent(string name, uint256 agentId) external',
    'function totalNames() view returns (uint256)',
    'function reverseName(address) view returns (string)',
    'event NameRegistered(string indexed nameIndexed, string name, address indexed owner)',
];

const provider = new ethers.JsonRpcProvider(RPC_URL, 8453, { staticNetwork: true });
const wallet = new ethers.Wallet(DEPLOYER_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);
const readContract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
const namesContract = new ethers.Contract(NAMES_CONTRACT, NAMES_ABI, wallet);
const namesRead = new ethers.Contract(NAMES_CONTRACT, NAMES_ABI, provider);

// Rate limiting
const mintCooldowns = new Map();
const COOLDOWN_MS = 60 * 60 * 1000;

const VALID_FRAMEWORKS = ['openclaw', 'eliza', 'langchain', 'crewai', 'autogpt', 'bankr', 'virtuals', 'custom'];

// ============ HELPERS ============

async function formatAgent(tokenId) {
    const [agent, owner] = await Promise.all([
        readContract.getAgent(tokenId),
        readContract.ownerOf(tokenId)
    ]);
    
    let personality = null, traits = [], pts = 0;
    try { personality = await readContract.getPersonality(tokenId); } catch {}
    try { traits = await readContract.getTraits(tokenId); } catch {}
    try { pts = Number(await readContract.points(agent.agentAddress)); } catch {}
    
    return {
        tokenId: Number(tokenId),
        agentAddress: agent.agentAddress,
        name: agent.name,
        framework: agent.framework,
        mintedAt: new Date(Number(agent.mintedAt) * 1000).toISOString(),
        verified: agent.verified,
        soulbound: agent.soulbound,
        generation: Number(agent.generation),
        version: agent.currentVersion,
        mutationCount: Number(agent.mutationCount),
        points: pts,
        owner: owner,
        personality: personality ? {
            temperament: personality.temperament,
            communicationStyle: personality.communicationStyle,
            riskTolerance: Number(personality.riskTolerance),
            autonomyLevel: Number(personality.autonomyLevel),
            alignment: personality.alignment,
            specialization: personality.specialization,
        } : null,
        traits: traits.map(t => ({ name: t.name, category: t.category, addedAt: new Date(Number(t.addedAt) * 1000).toISOString() })),
        explorer: `https://basescan.org/token/${CONTRACT_ADDRESS}?a=${tokenId}`,
        aura: `https://helixa.xyz/auras/${tokenId}.svg`,
    };
}

// ============ EXPRESS APP ============

const app = express();
app.use(express.json({ limit: '100kb' }));

// CORS
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Payment, Payment-Signature');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

// ============ x402 PAYMENT MIDDLEWARE ============

let x402Middleware = null;

async function setupX402() {
    const CDP_API_KEY = process.env.CDP_API_KEY;
    if (!CDP_API_KEY) {
        console.log('   ⚠️  No CDP_API_KEY — x402 paid endpoints will return 402 manually');
        console.log('   Get free key at cdp.coinbase.com for mainnet x402 support\n');
        return;
    }
    try {
        const { paymentMiddleware, x402ResourceServer } = require('@x402/express');
        const { ExactEvmScheme } = require('@x402/evm/exact/server');
        const { HTTPFacilitatorClient } = require('@x402/core/server');

        // CDP facilitator for Base mainnet (free tier: 1000 tx/month)
        // Requires CDP API keys from cdp.coinbase.com
        const facilitatorClient = new HTTPFacilitatorClient({
            url: 'https://api.cdp.coinbase.com/platform/v2/x402',
            headers: { 'Authorization': `Bearer ${CDP_API_KEY}` },
        });

        const resourceServer = new x402ResourceServer(facilitatorClient)
            .register('eip155:8453', new ExactEvmScheme());

        // Define paid routes
        const routes = {
            'POST /api/mint/premium': {
                accepts: [{
                    scheme: 'exact',
                    price: '$5',
                    network: 'eip155:8453',
                    payTo: TREASURY,
                }],
                description: 'Mint a verified AgentDNA NFT with premium features',
                mimeType: 'application/json',
            },
            'GET /api/agent/:id/full': {
                accepts: [{
                    scheme: 'exact',
                    price: '$0.01',
                    network: 'eip155:8453',
                    payTo: TREASURY,
                }],
                description: 'Full agent profile with reputation data',
                mimeType: 'application/json',
            },
        };

        // syncFacilitatorOnStart=false to avoid crash if facilitator doesn't support our network yet
        x402Middleware = paymentMiddleware(routes, resourceServer, undefined, undefined, false);
        console.log('   ✅ x402 payment middleware active');
        console.log('   💰 POST /api/mint/premium — $5 USDC (verified badge)');
        console.log('   💰 GET  /api/agent/:id/full — $0.01 USDC\n');
    } catch (e) {
        console.log(`   ⚠️  x402 middleware not loaded: ${e.message}`);
        console.log('   Free endpoints still active.\n');
    }
}

// Apply x402 middleware if loaded (non-blocking)
app.use((req, res, next) => {
    if (x402Middleware) return x402Middleware(req, res, next);
    next();
});

// ============ FREE ENDPOINTS ============

// API docs / discovery
app.get(['/', '/api'], (req, res) => {
    res.json({
        name: 'Helixa AgentDNA API',
        version: '2.0.0',
        description: 'x402-enabled identity infrastructure for AI agents on Base',
        protocol: 'x402',
        endpoints: {
            free: {
                'POST /api/mint': 'Gasless mint (free beta, <100 agents)',
                'POST /api/lookup': 'Lookup agent by address or tokenId',
                'GET /api/stats': 'Protocol statistics',
                'GET /api/agents': 'Agent directory',
                'GET /api/agent/:id': 'Agent detail by token ID',
                'GET /api/name/:name': '.agent name availability',
                'GET /health': 'Health check',
            },
            paid: {
                'POST /api/mint/premium': '$5 USDC — Mint with verified badge (x402)',
                'GET /api/agent/:id/full': '$0.01 USDC — Full profile with reputation (x402)',
            },
        },
        mint_example: {
            method: 'POST',
            url: '/api/mint',
            body: {
                name: 'MyAgent',
                agentAddress: '0x...',
                framework: 'openclaw',
                description: 'My AI agent',
                soulbound: false,
            }
        },
        x402: {
            facilitator: 'https://x402.org/facilitator',
            network: 'base',
            asset: 'USDC',
            payTo: TREASURY,
        },
        website: 'https://helixa.xyz',
        contract: CONTRACT_ADDRESS,
        network: 'Base (Chain ID 8453)',
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), x402: !!x402Middleware });
});

// Stats
app.get('/api/stats', async (req, res) => {
    try {
        const [total, price, balance] = await Promise.all([
            readContract.totalAgents(),
            readContract.mintPrice(),
            provider.getBalance(wallet.address)
        ]);
        res.json({
            totalAgents: Number(total),
            mintPrice: ethers.formatEther(price),
            mintPriceFree: price === 0n,
            freeSlotsRemaining: price === 0n ? 100 - Number(total) : 0,
            network: 'Base',
            chainId: 8453,
            contract: CONTRACT_ADDRESS,
            gasWallet: wallet.address,
            gasBalance: ethers.formatEther(balance),
            estimatedMintsRemaining: Math.floor(Number(balance) / 0.00005),
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Agent directory
app.get('/api/agents', async (req, res) => {
    try {
        const total = await readContract.totalAgents();
        const agents = [];
        const limit = Math.min(Number(total), 50);
        for (let i = 0; i < limit; i++) {
            try {
                const agent = await readContract.getAgent(i);
                const owner = await readContract.ownerOf(i);
                let pts = 0;
                try { pts = Number(await readContract.points(agent.agentAddress)); } catch {}
                agents.push({
                    tokenId: i,
                    name: agent.name,
                    agentAddress: agent.agentAddress,
                    framework: agent.framework,
                    verified: agent.verified,
                    soulbound: agent.soulbound,
                    points: pts,
                    owner: owner,
                    mintedAt: new Date(Number(agent.mintedAt) * 1000).toISOString(),
                });
            } catch {}
        }
        res.json({ total: Number(total), agents });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Agent detail (free — basic info)
app.get('/api/agent/:id', async (req, res) => {
    try {
        const agent = await formatAgent(parseInt(req.params.id));
        res.json(agent);
    } catch (e) {
        res.status(404).json({ error: 'Agent not found' });
    }
});

// Lookup
app.post('/api/lookup', async (req, res) => {
    const { address, tokenId } = req.body;
    
    if (address && ethers.isAddress(address)) {
        try {
            const [tid] = await readContract.getAgentByAddress(address);
            const detail = await formatAgent(tid);
            return res.json(detail);
        } catch {
            return res.status(404).json({ error: 'No agent found for this address' });
        }
    }
    
    if (tokenId != null) {
        try {
            const detail = await formatAgent(tokenId);
            return res.json(detail);
        } catch {
            return res.status(404).json({ error: 'Agent not found' });
        }
    }
    
    res.status(400).json({ error: 'Provide address or tokenId' });
});

// .agent name check
app.get('/api/name/:name', async (req, res) => {
    const agentName = decodeURIComponent(req.params.name).toLowerCase().replace(/\.agent$/, '');
    try {
        const [isAvail, resolved] = await Promise.all([
            namesRead.available(agentName),
            namesRead.resolve(agentName).catch(() => ethers.ZeroAddress)
        ]);
        res.json({
            name: `${agentName}.agent`,
            available: isAvail,
            owner: isAvail ? null : resolved,
            contract: NAMES_CONTRACT,
        });
    } catch (e) {
        res.status(400).json({ error: 'Invalid name' });
    }
});

// Free gasless mint
app.post('/api/mint', async (req, res) => {
    const { name, agentAddress, framework, description, soulbound, version, parentTokenId } = req.body;
    
    if (!name || typeof name !== 'string' || name.length < 1 || name.length > 64) {
        return res.status(400).json({ error: 'name required (1-64 chars)' });
    }
    if (!agentAddress || !ethers.isAddress(agentAddress)) {
        return res.status(400).json({ error: 'valid agentAddress required (0x...)' });
    }
    const fw = (framework || 'custom').toLowerCase();
    if (!VALID_FRAMEWORKS.includes(fw)) {
        return res.status(400).json({ error: `framework must be one of: ${VALID_FRAMEWORKS.join(', ')}` });
    }
    
    try {
        const has = await readContract.hasAgent(agentAddress);
        if (has) return res.status(409).json({ error: 'This address already has an AgentDNA' });
    } catch {}
    
    const cooldownKey = agentAddress.toLowerCase();
    const lastMint = mintCooldowns.get(cooldownKey);
    if (lastMint && Date.now() - lastMint < COOLDOWN_MS) {
        return res.status(429).json({ error: 'Rate limited. One mint per address per hour.' });
    }
    
    const metadata = {
        name,
        description: description || `${name} — an AI agent on the AgentDNA protocol`,
        image: `https://helixa.xyz/auras/pending.svg`,
        external_url: 'https://helixa.xyz',
        attributes: [
            { trait_type: 'Framework', value: fw },
            { trait_type: 'Version', value: version || '1.0.0' },
        ]
    };
    const tokenURI = 'data:application/json;base64,' + Buffer.from(JSON.stringify(metadata)).toString('base64');
    
    const recipient = req.body.ownerAddress && ethers.isAddress(req.body.ownerAddress) ? req.body.ownerAddress : agentAddress;
    
    try {
        console.log(`[MINT] ${name} (${fw}) → ${agentAddress} (owner: ${recipient})`);
        const tx = await contract.mintFree(recipient, agentAddress, name, fw, tokenURI, soulbound === true);
        console.log(`[MINT] TX: ${tx.hash}`);
        const receipt = await tx.wait();
        
        let tokenId = null;
        for (const log of receipt.logs) {
            try {
                const parsed = contract.interface.parseLog(log);
                if (parsed && parsed.name === 'Registered') {
                    tokenId = Number(parsed.args.agentId);
                    break;
                }
            } catch {}
        }
        
        mintCooldowns.set(cooldownKey, Date.now());
        console.log(`[MINT] ✓ Token #${tokenId} minted for ${name}`);
        
        // Register .agent name if provided
        let agentNameResult = null;
        const agentName = req.body.agentName;
        if (agentName && typeof agentName === 'string') {
            const cleanName = agentName.toLowerCase().replace(/\.agent$/, '').replace(/[^a-z0-9-]/g, '');
            if (cleanName.length >= 3 && cleanName.length <= 32) {
                try {
                    const isAvailable = await namesRead.available(cleanName);
                    if (isAvailable) {
                        const nameTx = await namesContract.registerFor(cleanName, recipient);
                        await nameTx.wait();
                        const linkTx = await namesContract.linkAgent(cleanName, tokenId);
                        await linkTx.wait();
                        agentNameResult = `${cleanName}.agent`;
                        console.log(`[NAME] ✓ ${cleanName}.agent registered for token #${tokenId}`);
                    } else {
                        console.log(`[NAME] ${cleanName}.agent already taken`);
                    }
                } catch (e) {
                    console.error(`[NAME] Error registering ${cleanName}.agent:`, e.message);
                }
            }
        }
        
        res.status(201).json({
            success: true,
            tokenId,
            txHash: tx.hash,
            agentName: agentNameResult,
            explorer: `https://basescan.org/tx/${tx.hash}`,
            agent: `https://helixa.xyz/mint.html#agent-${tokenId}`,
            message: `${name} is now onchain! AgentDNA #${tokenId}${agentNameResult ? ` — ${agentNameResult}` : ''}`
        });
    } catch (e) {
        console.error('[MINT] Error:', e.message);
        const msg = e.message.includes('Already registered') ? 'This address already has an AgentDNA'
            : e.message.includes('One free mint') ? 'Deployer wallet already used free mint — contact team'
            : e.message.includes('insufficient funds') ? 'Deployer wallet needs gas — contact team'
            : 'Mint failed: ' + e.message.slice(0, 200);
        res.status(500).json({ error: msg });
    }
});

// ============ x402 PAID ENDPOINTS ============

// Premium mint — $5 USDC, includes verified badge
// If x402 middleware isn't active, return manual 402
app.post('/api/mint/premium', async (req, res) => {
    if (!x402Middleware) {
        return res.status(402).json({
            error: 'Payment required',
            price: '$5 USDC',
            description: 'Premium mint with verified badge. x402 payment integration coming soon.',
            x402: { network: 'eip155:8453', scheme: 'exact', price: '$5', payTo: TREASURY },
        });
    }
    const { name, agentAddress, framework, description, soulbound, version } = req.body;
    
    if (!name || typeof name !== 'string' || name.length < 1 || name.length > 64) {
        return res.status(400).json({ error: 'name required (1-64 chars)' });
    }
    if (!agentAddress || !ethers.isAddress(agentAddress)) {
        return res.status(400).json({ error: 'valid agentAddress required (0x...)' });
    }
    const fw = (framework || 'custom').toLowerCase();
    if (!VALID_FRAMEWORKS.includes(fw)) {
        return res.status(400).json({ error: `framework must be one of: ${VALID_FRAMEWORKS.join(', ')}` });
    }
    
    try {
        const has = await readContract.hasAgent(agentAddress);
        if (has) return res.status(409).json({ error: 'This address already has an AgentDNA' });
    } catch {}
    
    const metadata = {
        name,
        description: description || `${name} — a verified AI agent on the AgentDNA protocol`,
        image: `https://helixa.xyz/auras/pending.svg`,
        external_url: 'https://helixa.xyz',
        attributes: [
            { trait_type: 'Framework', value: fw },
            { trait_type: 'Version', value: version || '1.0.0' },
            { trait_type: 'Verified', value: 'true' },
            { trait_type: 'Tier', value: 'Premium' },
        ]
    };
    const tokenURI = 'data:application/json;base64,' + Buffer.from(JSON.stringify(metadata)).toString('base64');
    const recipient = req.body.ownerAddress && ethers.isAddress(req.body.ownerAddress) ? req.body.ownerAddress : agentAddress;
    
    try {
        console.log(`[PREMIUM MINT] ${name} (${fw}) → ${agentAddress}`);
        const tx = await contract.mintFree(recipient, agentAddress, name, fw, tokenURI, soulbound === true);
        const receipt = await tx.wait();
        
        let tokenId = null;
        for (const log of receipt.logs) {
            try {
                const parsed = contract.interface.parseLog(log);
                if (parsed && parsed.name === 'Registered') {
                    tokenId = Number(parsed.args.agentId);
                    break;
                }
            } catch {}
        }
        
        // Set verified badge
        if (tokenId !== null) {
            try {
                const verifyTx = await contract.setVerified(tokenId, true);
                await verifyTx.wait();
                console.log(`[PREMIUM] ✓ Token #${tokenId} verified`);
            } catch (e) {
                console.error(`[PREMIUM] Failed to verify #${tokenId}:`, e.message);
            }
        }
        
        // Register .agent name if provided
        let agentNameResult = null;
        const agentName = req.body.agentName;
        if (agentName && typeof agentName === 'string') {
            const cleanName = agentName.toLowerCase().replace(/\.agent$/, '').replace(/[^a-z0-9-]/g, '');
            if (cleanName.length >= 3 && cleanName.length <= 32) {
                try {
                    const isAvailable = await namesRead.available(cleanName);
                    if (isAvailable) {
                        const nameTx = await namesContract.registerFor(cleanName, recipient);
                        await nameTx.wait();
                        const linkTx = await namesContract.linkAgent(cleanName, tokenId);
                        await linkTx.wait();
                        agentNameResult = `${cleanName}.agent`;
                    }
                } catch (e) {
                    console.error(`[NAME] Error:`, e.message);
                }
            }
        }
        
        console.log(`[PREMIUM] ✓ Token #${tokenId} minted + verified for ${name}`);
        
        res.status(201).json({
            success: true,
            tokenId,
            txHash: tx.hash,
            verified: true,
            tier: 'premium',
            agentName: agentNameResult,
            explorer: `https://basescan.org/tx/${tx.hash}`,
            agent: `https://helixa.xyz/mint.html#agent-${tokenId}`,
            message: `${name} is now onchain with verified badge! AgentDNA #${tokenId}${agentNameResult ? ` — ${agentNameResult}` : ''}`
        });
    } catch (e) {
        console.error('[PREMIUM MINT] Error:', e.message);
        res.status(500).json({ error: 'Premium mint failed: ' + e.message.slice(0, 200) });
    }
});

// Full agent profile (x402 paid) — detailed reputation data
app.get('/api/agent/:id/full', async (req, res) => {
    if (!x402Middleware) {
        return res.status(402).json({
            error: 'Payment required',
            price: '$0.01 USDC',
            description: 'Full agent profile with reputation data. x402 payment integration coming soon.',
            x402: { network: 'eip155:8453', scheme: 'exact', price: '$0.01', payTo: TREASURY },
        });
    }
    try {
        const agent = await formatAgent(parseInt(req.params.id));
        // Add extended reputation data
        agent.reputation = {
            score: agent.points,
            tier: agent.points >= 500 ? 'legendary' : agent.points >= 200 ? 'veteran' : agent.points >= 100 ? 'established' : 'newcomer',
            verified: agent.verified,
            mutationHistory: agent.mutationCount,
            traitCount: agent.traits.length,
            age: Math.floor((Date.now() - new Date(agent.mintedAt).getTime()) / 86400000),
        };
        agent.links = {
            opensea: `https://opensea.io/assets/base/${CONTRACT_ADDRESS}/${agent.tokenId}`,
            basescan: agent.explorer,
            aura: agent.aura,
            profile: `https://helixa.xyz/directory.html#agent-${agent.tokenId}`,
        };
        res.json(agent);
    } catch (e) {
        res.status(404).json({ error: 'Agent not found' });
    }
});

// ============ START ============

process.on('uncaughtException', (err) => { console.error('Uncaught:', err.message || err); });
process.on('unhandledRejection', (err) => { console.error('Unhandled rejection (non-fatal):', err.message || err); });

async function start() {
    await setupX402();
    
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🧬 Helixa AgentDNA API v2.0 running on port ${PORT}`);
        console.log(`   Contract: ${CONTRACT_ADDRESS}`);
        console.log(`   RPC: ${RPC_URL}`);
        console.log(`   Deployer: ${wallet.address}`);
        console.log(`   Treasury: ${TREASURY}`);
        console.log(`\n   FREE:`);
        console.log(`   POST /api/mint — Gasless mint`);
        console.log(`   GET  /api/agents — Directory`);
        console.log(`   GET  /api/stats — Stats`);
        console.log(`\n   PAID (x402):`);
        console.log(`   POST /api/mint/premium — $5 USDC verified mint`);
        console.log(`   GET  /api/agent/:id/full — $0.01 USDC full profile\n`);
    });
}

start();
