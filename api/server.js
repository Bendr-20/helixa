#!/usr/bin/env node
/**
 * Helixa AgentDNA — Gasless Mint API
 * 
 * Agents mint via HTTP POST, we pay gas from deployer wallet.
 * Zero friction: no wallet, no ETH, no browser needed.
 * 
 * POST /api/mint — Mint an AgentDNA
 * POST /api/lookup — Look up an agent by address or token ID
 * GET  /api/stats — Protocol stats
 * GET  /api/agents — List all agents (directory)
 * GET  /api/agent/:id — Agent detail
 */

const { ethers } = require('ethers');
const http = require('http');
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
const RPC_URL = process.env.RPC_URL || 'https://base.meowrpc.com';
const CONTRACT_ADDRESS = '0x665971e7bf8ec90c3066162c5b396604b3cd7711';
const NAMES_CONTRACT = '0xDE8c422D2076CbAE0cA8f5dA9027A03D48928F2d';
const DEPLOYER_KEY = process.env.DEPLOYER_KEY;

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

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(DEPLOYER_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);
const readContract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
const namesContract = new ethers.Contract(NAMES_CONTRACT, NAMES_ABI, wallet);
const namesRead = new ethers.Contract(NAMES_CONTRACT, NAMES_ABI, provider);

// Rate limiting: 1 mint per address per hour
const mintCooldowns = new Map();
const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

// Valid frameworks
const VALID_FRAMEWORKS = ['openclaw', 'eliza', 'langchain', 'crewai', 'autogpt', 'bankr', 'virtuals', 'custom'];

function cors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function json(res, status, data) {
    cors(res);
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

async function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => { body += chunk; if (body.length > 1e5) reject(new Error('Body too large')); });
        req.on('end', () => { try { resolve(JSON.parse(body)); } catch { reject(new Error('Invalid JSON')); } });
    });
}

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
        aura: `https://helixa.xyz/mint.html#agent-${tokenId}`,
    };
}

// ============ HANDLERS ============

async function handleMint(req, res) {
    let body;
    try { body = await parseBody(req); } catch (e) { return json(res, 400, { error: e.message }); }
    
    const { name, agentAddress, framework, description, soulbound, version, parentTokenId } = body;
    
    // Validate required fields
    if (!name || typeof name !== 'string' || name.length < 1 || name.length > 64) {
        return json(res, 400, { error: 'name required (1-64 chars)' });
    }
    if (!agentAddress || !ethers.isAddress(agentAddress)) {
        return json(res, 400, { error: 'valid agentAddress required (0x...)' });
    }
    const fw = (framework || 'custom').toLowerCase();
    if (!VALID_FRAMEWORKS.includes(fw)) {
        return json(res, 400, { error: `framework must be one of: ${VALID_FRAMEWORKS.join(', ')}` });
    }
    
    // Check if already has agent
    try {
        const has = await readContract.hasAgent(agentAddress);
        if (has) return json(res, 409, { error: 'This address already has an AgentDNA' });
    } catch {}
    
    // Check deployer hasn't already free-minted for this address (rate limit)
    const cooldownKey = agentAddress.toLowerCase();
    const lastMint = mintCooldowns.get(cooldownKey);
    if (lastMint && Date.now() - lastMint < COOLDOWN_MS) {
        return json(res, 429, { error: 'Rate limited. One mint per address per hour.' });
    }
    
    // Build tokenURI
    const metadata = {
        name: name,
        description: description || `${name} — an AI agent on the AgentDNA protocol`,
        image: `https://helixa.xyz/mint.html#aura-${name.replace(/\s+/g, '-').toLowerCase()}`,
        external_url: 'https://helixa.xyz',
        attributes: [
            { trait_type: 'Framework', value: fw },
            { trait_type: 'Version', value: version || '1.0.0' },
        ]
    };
    const tokenURI = 'data:application/json;base64,' + Buffer.from(JSON.stringify(metadata)).toString('base64');
    
    // Determine recipient — if they provide ownerAddress, mint to that. Otherwise mint to agentAddress.
    const recipient = body.ownerAddress && ethers.isAddress(body.ownerAddress) ? body.ownerAddress : agentAddress;
    
    // Mint using mintFree (owner-only, no gas cost to user, no hasFreeMinted restriction)
    try {
        console.log(`[MINT] ${name} (${fw}) → ${agentAddress} (owner: ${recipient})`);
        const tx = await contract.mintFree(
            recipient,
            agentAddress,
            name,
            fw,
            tokenURI,
            soulbound === true
        );
        
        console.log(`[MINT] TX: ${tx.hash}`);
        const receipt = await tx.wait();
        
        // Extract token ID from Registered event
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
        const agentName = body.agentName;
        if (agentName && typeof agentName === 'string') {
            const cleanName = agentName.toLowerCase().replace(/\.agent$/, '').replace(/[^a-z0-9-]/g, '');
            if (cleanName.length >= 3 && cleanName.length <= 32) {
                try {
                    const isAvailable = await namesRead.available(cleanName);
                    if (isAvailable) {
                        const nameTx = await namesContract.registerFor(cleanName, recipient);
                        await nameTx.wait();
                        // Link to agent token ID
                        const linkTx = await namesContract.linkAgent(cleanName, tokenId);
                        await linkTx.wait();
                        agentNameResult = `${cleanName}.agent`;
                        console.log(`[NAME] ✓ ${cleanName}.agent registered for token #${tokenId}`);
                    } else {
                        agentNameResult = null;
                        console.log(`[NAME] ${cleanName}.agent already taken`);
                    }
                } catch (e) {
                    console.error(`[NAME] Error registering ${cleanName}.agent:`, e.message);
                }
            }
        }
        
        json(res, 201, {
            success: true,
            tokenId: tokenId,
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
        json(res, 500, { error: msg });
    }
}

async function handleStats(req, res) {
    try {
        const [total, price, balance] = await Promise.all([
            readContract.totalAgents(),
            readContract.mintPrice(),
            provider.getBalance(wallet.address)
        ]);
        json(res, 200, {
            totalAgents: Number(total),
            mintPrice: ethers.formatEther(price),
            mintPriceFree: price === 0n,
            freeSlotsRemaining: price === 0n ? 100 - Number(total) : 0,
            network: 'Base',
            chainId: 8453,
            contract: CONTRACT_ADDRESS,
            gasWallet: wallet.address,
            gasBalance: ethers.formatEther(balance),
            estimatedMintsRemaining: Math.floor(Number(balance) / 0.00005), // ~0.00005 ETH per mint
        });
    } catch (e) {
        json(res, 500, { error: e.message });
    }
}

async function handleAgents(req, res) {
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
        json(res, 200, { total: Number(total), agents });
    } catch (e) {
        json(res, 500, { error: e.message });
    }
}

async function handleAgentDetail(req, res, tokenId) {
    try {
        const agent = await formatAgent(tokenId);
        json(res, 200, agent);
    } catch (e) {
        json(res, 404, { error: 'Agent not found' });
    }
}

async function handleLookup(req, res) {
    let body;
    try { body = await parseBody(req); } catch (e) { return json(res, 400, { error: e.message }); }
    
    const { address, tokenId } = body;
    
    if (address && ethers.isAddress(address)) {
        try {
            const [tid, agent] = await readContract.getAgentByAddress(address);
            const detail = await formatAgent(tid);
            return json(res, 200, detail);
        } catch {
            return json(res, 404, { error: 'No agent found for this address' });
        }
    }
    
    if (tokenId != null) {
        try {
            const detail = await formatAgent(tokenId);
            return json(res, 200, detail);
        } catch {
            return json(res, 404, { error: 'Agent not found' });
        }
    }
    
    json(res, 400, { error: 'Provide address or tokenId' });
}

// ============ SERVER ============

const server = http.createServer(async (req, res) => {
    // CORS preflight
    if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); res.end(); return; }
    
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = url.pathname;
    
    try {
        if (req.method === 'POST' && pathname === '/api/mint') return await handleMint(req, res);
        if (req.method === 'POST' && pathname === '/api/lookup') return await handleLookup(req, res);
        if (req.method === 'GET' && pathname === '/api/stats') return await handleStats(req, res);
        if (req.method === 'GET' && pathname === '/api/agents') return await handleAgents(req, res);
        
        const agentMatch = pathname.match(/^\/api\/agent\/(\d+)$/);
        if (req.method === 'GET' && agentMatch) return await handleAgentDetail(req, res, parseInt(agentMatch[1]));
        
        // .agent name endpoints
        if (req.method === 'GET' && pathname.startsWith('/api/name/')) {
            const agentName = decodeURIComponent(pathname.slice('/api/name/'.length)).toLowerCase().replace(/\.agent$/, '');
            try {
                const [isAvail, resolved] = await Promise.all([
                    namesRead.available(agentName),
                    namesRead.resolve(agentName).catch(() => ethers.ZeroAddress)
                ]);
                return json(res, 200, {
                    name: `${agentName}.agent`,
                    available: isAvail,
                    owner: isAvail ? null : resolved,
                    contract: NAMES_CONTRACT,
                });
            } catch (e) {
                return json(res, 400, { error: 'Invalid name' });
            }
        }
        
        // Health check
        if (pathname === '/health') return json(res, 200, { status: 'ok', uptime: process.uptime() });
        
        // API docs
        if (pathname === '/' || pathname === '/api') {
            return json(res, 200, {
                name: 'Helixa AgentDNA API',
                version: '1.0.0',
                description: 'Gasless minting and agent directory for AI agents on Base',
                endpoints: {
                    'POST /api/mint': 'Mint a new AgentDNA (free, gasless)',
                    'POST /api/lookup': 'Look up agent by address or tokenId',
                    'GET /api/stats': 'Protocol statistics',
                    'GET /api/agents': 'Agent directory (all agents)',
                    'GET /api/agent/:id': 'Agent detail by token ID',
                    'GET /health': 'Health check',
                },
                mint_example: {
                    method: 'POST',
                    url: '/api/mint',
                    body: {
                        name: 'MyAgent',
                        agentAddress: '0x...',
                        framework: 'openclaw',
                        description: 'My awesome AI agent',
                        soulbound: false,
                        version: '1.0.0'
                    }
                },
                website: 'https://helixa.xyz',
                contract: CONTRACT_ADDRESS,
                network: 'Base (Chain ID 8453)',
            });
        }
        
        json(res, 404, { error: 'Not found' });
    } catch (e) {
        console.error('Server error:', e);
        json(res, 500, { error: 'Internal server error' });
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🧬 Helixa AgentDNA API running on port ${PORT}`);
    console.log(`   Contract: ${CONTRACT_ADDRESS}`);
    console.log(`   RPC: ${RPC_URL}`);
    console.log(`   Deployer: ${wallet.address}`);
    console.log(`\n   POST /api/mint — Gasless mint`);
    console.log(`   GET  /api/agents — Directory`);
    console.log(`   GET  /api/stats — Stats\n`);
});
