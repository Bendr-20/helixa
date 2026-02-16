#!/usr/bin/env node
/**
 * Helixa V2 API Server
 * 
 * Features:
 *   - SIWA (Sign-In With Agent) authentication
 *   - x402 payment middleware (simplified, Phase 1: all free)
 *   - Clean V2 contract integration
 * 
 * Port: 3457 (separate from V1 on 3456)
 */

const { ethers } = require('ethers');
const express = require('express');
const fs = require('fs');
const path = require('path');

// ─── Environment ────────────────────────────────────────────────
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
        const [key, ...val] = line.split('=');
        if (key && val.length) process.env[key.trim()] = val.join('=').trim();
    });
}

const PORT = process.env.V2_API_PORT || 3457;
const RPC_URL = process.env.RPC_URL || 'https://sepolia.base.org';
const DEPLOYER_KEY = process.env.DEPLOYER_KEY;
const DEPLOYER_ADDRESS = process.env.DEPLOYER_ADDRESS || '0x19B16428f0721a5f627F190Ca61D493A632B423F';
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// TODO: Replace with actual deployed V2 contract address
const V2_CONTRACT_ADDRESS = process.env.V2_CONTRACT || '0x95Ad82720adDe7686957F43Fe82783Fbfb4A92E2';

// ERC-8004 Canonical Identity Registry on Base
// ERC-8004 Canonical Identity Registry on Base
const ERC8004_REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';

// Coinbase Verifications (EAS on Base)
const COINBASE_INDEXER = '0x2c7eE1E5f416dfF40054c27A62f7B357C4E8619C';
const COINBASE_VERIFIED_ACCOUNT_SCHEMA = '0xf8b05c79f090979bf4a80270aba232dff11a10d9ca55c4f88de95317970f0de9';
const EAS_CONTRACT = '0x4200000000000000000000000000000000000021';
const COINBASE_INDEXER_ABI = [
    'function getAttestationUid(address recipient, bytes32 schemaUid) external view returns (bytes32)',
];
const EAS_ABI = [
    'function getAttestation(bytes32 uid) external view returns (tuple(bytes32 uid, bytes32 schema, uint64 time, uint64 expirationTime, uint64 revocationTime, bytes32 refUID, address attester, address recipient, bool revocable, bytes data))',
];
const ERC8004_REGISTRY_ABI = [
    'function register(string agentURI) external returns (uint256 agentId)',
    'function register(string agentURI, tuple(string metadataKey, bytes metadataValue)[] metadata) external returns (uint256 agentId)',
    'function setAgentURI(uint256 agentId, string newURI) external',
    'function getMetadata(uint256 agentId, string metadataKey) external view returns (bytes)',
    'function setMetadata(uint256 agentId, string metadataKey, bytes metadataValue) external',
];

if (!DEPLOYER_KEY) {
    console.error('ERROR: DEPLOYER_KEY not set in .env');
    process.exit(1);
}

// ─── Contract Setup ─────────────────────────────────────────────
const V2_ABI_PATH = path.join(__dirname, '..', 'out', 'HelixaV2.sol', 'HelixaV2.json');
let V2_ABI;
try {
    const artifact = JSON.parse(fs.readFileSync(V2_ABI_PATH, 'utf8'));
    V2_ABI = artifact.abi;
    console.log(`✅ Loaded V2 ABI (${V2_ABI.filter(x => x.type === 'function').length} functions)`);
} catch (e) {
    console.error(`Failed to load V2 ABI from ${V2_ABI_PATH}: ${e.message}`);
    console.error('Run: cd agentdna && forge build');
    process.exit(1);
}

const USDC_ABI = [
    'function balanceOf(address) view returns (uint256)',
    'function transfer(address,uint256) returns (bool)',
    'event Transfer(address indexed from, address indexed to, uint256 value)',
];

const CHAIN_ID = RPC_URL.includes('sepolia') ? 84532 : 8453;
const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID, { staticNetwork: true });
const wallet = new ethers.Wallet(DEPLOYER_KEY, provider);
const contract = new ethers.Contract(V2_CONTRACT_ADDRESS, V2_ABI, wallet);
const readContract = new ethers.Contract(V2_CONTRACT_ADDRESS, V2_ABI, provider);
const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);

// ═══════════════════════════════════════════════════════════════
// SIWA (Sign-In With Agent) Authentication
// ═══════════════════════════════════════════════════════════════
//
// Flow:
//   1. Agent constructs message: "Sign-In With Agent: {domain} wants you to sign in with your wallet {address} at {timestamp}"
//   2. Agent signs with their wallet private key
//   3. Agent sends as Authorization header: "Bearer {address}:{timestamp}:{signature}"
//   4. Server verifies signature, checks expiry (1 hour), attaches req.agent
//

const SIWA_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const SIWA_DOMAIN = 'api.helixa.xyz';

function parseSIWA(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7);
    const parts = token.split(':');
    if (parts.length < 3) return null;
    
    const address = parts[0];
    const timestamp = parts[1];
    // Signature may contain colons (unlikely but safe)
    const signature = parts.slice(2).join(':');
    
    return { address, timestamp, signature };
}

function verifySIWA(address, timestamp, signature) {
    try {
        const message = `Sign-In With Agent: ${SIWA_DOMAIN} wants you to sign in with your wallet ${address} at ${timestamp}`;
        const recovered = ethers.verifyMessage(message, signature);
        
        if (recovered.toLowerCase() !== address.toLowerCase()) return false;
        
        const ts = parseInt(timestamp);
        if (isNaN(ts)) return false;
        if (Date.now() - ts > SIWA_EXPIRY_MS) return false;
        
        return true;
    } catch {
        return false;
    }
}

function requireSIWA(req, res, next) {
    const parsed = parseSIWA(req.headers.authorization);
    if (!parsed) {
        return res.status(401).json({
            error: 'SIWA authentication required',
            hint: 'Set Authorization: Bearer {address}:{timestamp}:{signature}',
            message_format: `Sign-In With Agent: ${SIWA_DOMAIN} wants you to sign in with your wallet {address} at {timestamp}`,
        });
    }
    
    if (!verifySIWA(parsed.address, parsed.timestamp, parsed.signature)) {
        return res.status(401).json({ error: 'Invalid or expired SIWA token' });
    }
    
    req.agent = {
        address: ethers.getAddress(parsed.address), // checksummed
        timestamp: parseInt(parsed.timestamp),
    };
    next();
}


// ═══════════════════════════════════════════════════════════════
// x402 Payment Middleware
// ═══════════════════════════════════════════════════════════════
//
// Simplified x402 flow:
//   1. Client requests a paid endpoint without payment proof
//   2. Server returns HTTP 402 with payment details:
//      { amount, recipient, chain, asset, network }
//   3. Client sends USDC to recipient, gets tx hash
//   4. Client retries request with header: X-Payment-Proof: {txHash}
//   5. Server verifies the USDC transfer onchain:
//      - Correct recipient
//      - Correct or greater amount
//      - Transaction confirmed
//   6. Request proceeds
//
// Phase 1: All prices are $0, so x402 gates are present but pass-through.
//

// Payment verification cache (txHash → verified boolean)
const paymentCache = new Map();

async function verifyUSDCPayment(txHash, expectedAmountUSDC) {
    if (paymentCache.has(txHash)) return paymentCache.get(txHash);
    
    try {
        const receipt = await provider.getTransactionReceipt(txHash);
        if (!receipt || receipt.status !== 1) return false;
        
        // Look for USDC Transfer event to our address
        const transferTopic = ethers.id('Transfer(address,address,uint256)');
        const recipientPadded = ethers.zeroPadValue(DEPLOYER_ADDRESS, 32).toLowerCase();
        
        for (const log of receipt.logs) {
            if (log.address.toLowerCase() !== USDC_ADDRESS.toLowerCase()) continue;
            if (log.topics[0] !== transferTopic) continue;
            if (log.topics[2]?.toLowerCase() !== recipientPadded) continue;
            
            // USDC has 6 decimals
            const amount = BigInt(log.data);
            const expectedRaw = BigInt(Math.round(expectedAmountUSDC * 1e6));
            
            if (amount >= expectedRaw) {
                paymentCache.set(txHash, true);
                return true;
            }
        }
        return false;
    } catch {
        return false;
    }
}

function requirePayment(amountUSDC) {
    return async (req, res, next) => {
        // Phase 1: all prices are $0 — pass through
        if (amountUSDC <= 0) return next();
        
        const txHash = req.headers['x-payment-proof'];
        if (!txHash) {
            return res.status(402).json({
                error: 'Payment Required',
                x402: {
                    protocol: 'x402',
                    version: '1.0',
                    amount: amountUSDC,
                    asset: 'USDC',
                    assetAddress: USDC_ADDRESS,
                    recipient: DEPLOYER_ADDRESS,
                    chain: 'base',
                    chainId: 8453,
                    network: 'eip155:8453',
                },
                hint: 'Send USDC to recipient, then retry with header X-Payment-Proof: {txHash}',
            });
        }
        
        if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
            return res.status(400).json({ error: 'Invalid X-Payment-Proof tx hash' });
        }
        
        const verified = await verifyUSDCPayment(txHash, amountUSDC);
        if (!verified) {
            return res.status(402).json({
                error: 'Payment not verified',
                detail: 'USDC transfer not found or insufficient amount',
                expected: { amount: amountUSDC, recipient: DEPLOYER_ADDRESS, asset: USDC_ADDRESS },
            });
        }
        
        req.payment = { txHash, amount: amountUSDC, verified: true };
        next();
    };
}

// Phase 1 pricing — all $0
const PRICING = {
    agentMint: 0,    // $0 for testnet — Phase 1 production: $1 USDC
    update: 0,       // Free in Phase 1
    verify: 0,       // Free
    // Phase 2 (1000+ agents): agentMint → $10, update → $1
};

// ═══════════════════════════════════════════════════════════════
// V1 OG Allowlist & Referral System
// ═══════════════════════════════════════════════════════════════

const OG_BONUS_POINTS = 200;
const REFERRAL_POINTS_REFERRER = 50;
const REFERRAL_POINTS_MINTER = 25;

// V1 OG wallets → referral code (lowercase addresses)
const V1_OG_WALLETS = {
    '0x19b16428f0721a5f627f190ca61d493a632b423f': { name: 'Bendr 2.0', code: 'bendr', team: true },
    '0x17d7dfa154dc0828ade4115b9eb8a0a91c0fbde4': { name: 'Quigbot', code: 'quigbot', team: true },
    '0x20d76f14b9fe678ff17db751492d0b5b1edefa97': { name: 'deola', code: 'deola' },
    '0xef05cb759c8397667286663902e79bd29f435e1b': { name: 'butter alpha', code: 'butter' },
    '0xd43e021a28be16d91b75feb62575fe533f27c344': { name: 'MrsMillion', code: 'mrsmillion' },
    '0x867bbb504cdbfc6742035a810b2cc1fe1c42407c': { name: 'MoltBot Agent', code: 'moltbot' },
    '0x1d15ac2caa30abf43d45ce86ee0cb0f3c8b929f6': { name: 'LienXinOne', code: 'lienxin' },
    '0x3862f531cf80f3664a287c4de453db8f2452d3eb': { name: 'irvinecold', code: 'irvine' },
    '0x1a751188343bee997ff2132f5454e0b5da477705': { name: 'ANCNAgent', code: 'ancn' },
    '0x331aa75a851cdbdb5d4e583a6658f9dc5a4f6ba3': { name: 'mell_agent', code: 'mell' },
    '0x73286b4ae95358b040f3a405c2c76172e9f46ffa': { name: 'PremeBot', code: 'premebot' },
    '0x34bdbca018125638f63cbac2780d7bd3d069dc83': { name: 'Xai', code: 'xai' },
    '0x8a4c8bb8f70773b3ab8e18e0f0f469fad4637000': { name: 'Blockhead', code: 'blockhead' },
    '0xf459dbaa62e3976b937ae9a4f6c31df96cd12a44': { name: 'R2d2', code: 'r2d2' },
};

// Reverse lookup: referral code → wallet address
const REFERRAL_CODES = {};
for (const [addr, info] of Object.entries(V1_OG_WALLETS)) {
    REFERRAL_CODES[info.code] = addr;
}

// Dynamic referral registry: code → { wallet, name, tokenId }
// Pre-seeded with OGs, new mints get added automatically
const referralRegistry = {};
for (const [addr, info] of Object.entries(V1_OG_WALLETS)) {
    referralRegistry[info.code] = { wallet: addr, name: info.name, tokenId: null };
}

// Track referral usage (in-memory for now, persist to file later)
const referralStats = {}; // code → { mints: 0, pointsEarned: 0 }

// Persist referral registry to disk
const REFERRAL_DB_PATH = path.join(__dirname, '..', 'data', 'referrals.json');
function loadReferralDB() {
    try {
        if (fs.existsSync(REFERRAL_DB_PATH)) {
            const data = JSON.parse(fs.readFileSync(REFERRAL_DB_PATH, 'utf8'));
            Object.assign(referralRegistry, data.registry || {});
            Object.assign(referralStats, data.stats || {});
            console.log(`✅ Loaded ${Object.keys(referralRegistry).length} referral codes`);
        }
    } catch {}
}
function saveReferralDB() {
    try {
        const dir = path.dirname(REFERRAL_DB_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(REFERRAL_DB_PATH, JSON.stringify({ registry: referralRegistry, stats: referralStats }, null, 2));
    } catch (e) {
        console.error(`[REFERRAL] Failed to save DB: ${e.message}`);
    }
}
loadReferralDB();

function isOGWallet(address) {
    return V1_OG_WALLETS[address.toLowerCase()] || null;
}

function resolveReferralCode(code) {
    if (!code) return null;
    const entry = referralRegistry[code.toLowerCase()];
    return entry ? entry.wallet : null;
}

function generateReferralCode(name) {
    // Sanitize: lowercase, alphanumeric + hyphens only, max 20 chars
    let code = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20);
    if (!code) code = 'agent';
    // Deduplicate
    if (!referralRegistry[code]) return code;
    for (let i = 2; i < 100; i++) {
        const candidate = `${code.slice(0, 17)}-${i}`;
        if (!referralRegistry[candidate]) return candidate;
    }
    return `${code}-${Date.now().toString(36).slice(-4)}`;
}

function registerReferralCode(code, wallet, name, tokenId) {
    referralRegistry[code] = { wallet: wallet.toLowerCase(), name, tokenId };
    saveReferralDB();
    return code;
}

// ═══════════════════════════════════════════════════════════════
// Express App
// ═══════════════════════════════════════════════════════════════

const app = express();
app.use(express.json({ limit: '200kb' }));

// CORS
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Payment-Proof');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

// ─── Helpers ────────────────────────────────────────────────────

const isContractDeployed = () => V2_CONTRACT_ADDRESS !== '0x0000000000000000000000000000000000000000';

async function formatAgentV2(tokenId) {
    if (!isContractDeployed()) throw new Error('V2 contract not yet deployed');
    
    const [agent, owner] = await Promise.all([
        readContract.getAgent(tokenId),
        readContract.ownerOf(tokenId),
    ]);
    
    let personality = null, narrative = null, traits = [], pts = 0, credScore = 0, agentName = '';
    try { personality = await readContract.getPersonality(tokenId); } catch {}
    try { narrative = await readContract.getNarrative(tokenId); } catch {}
    try { traits = await readContract.getTraits(tokenId); } catch {}
    try { pts = Number(await readContract.points(tokenId)); } catch {}
    try { credScore = Number(await readContract.getCredScore(tokenId)); } catch {}
    try { agentName = await readContract.nameOf(tokenId); } catch {}
    
    return {
        tokenId: Number(tokenId),
        agentAddress: agent.agentAddress,
        name: agent.name,
        framework: agent.framework,
        mintedAt: new Date(Number(agent.mintedAt) * 1000).toISOString(),
        verified: agent.verified,
        soulbound: agent.soulbound,
        mintOrigin: ['HUMAN', 'AGENT_SIWA', 'API', 'OWNER'][Number(agent.origin)] || 'UNKNOWN',
        generation: Number(agent.generation),
        version: agent.currentVersion,
        mutationCount: Number(agent.mutationCount),
        points: pts,
        credScore,
        owner,
        agentName: agentName || null,
        personality: personality ? {
            quirks: personality[0],
            communicationStyle: personality[1],
            values: personality[2],
            humor: personality[3],
            riskTolerance: Number(personality[4]),
            autonomyLevel: Number(personality[5]),
        } : null,
        narrative: narrative ? {
            origin: narrative.origin,
            mission: narrative.mission,
            lore: narrative.lore,
            manifesto: narrative.manifesto,
        } : null,
        traits: traits.map(t => ({
            name: t.name,
            category: t.category,
            addedAt: new Date(Number(t.addedAt) * 1000).toISOString(),
        })),
        explorer: `https://basescan.org/token/${V2_CONTRACT_ADDRESS}?a=${tokenId}`,
    };
}

// ─── Public Endpoints ───────────────────────────────────────────

// Discovery
app.get(['/', '/api/v2'], (req, res) => {
    res.json({
        name: 'Helixa V2 API',
        version: '2.0.0',
        description: 'Agent identity infrastructure with SIWA auth and x402 payments',
        contract: V2_CONTRACT_ADDRESS,
        contractDeployed: isContractDeployed(),
        network: 'Base (8453)',
        auth: {
            type: 'SIWA (Sign-In With Agent)',
            header: 'Authorization: Bearer {address}:{timestamp}:{signature}',
            message: `Sign-In With Agent: ${SIWA_DOMAIN} wants you to sign in with your wallet {address} at {timestamp}`,
            expiry: '1 hour',
        },
        endpoints: {
            public: {
                'GET /api/v2/stats': 'Protocol statistics',
                'GET /api/v2/agents': 'Agent directory (paginated)',
                'GET /api/v2/agent/:id': 'Single agent profile',
                'GET /api/v2/name/:name': 'Name availability check',
            },
            authenticated: {
                'POST /api/v2/mint': 'Mint new agent (SIWA required, free Phase 1)',
                'POST /api/v2/agent/:id/update': 'Update agent (SIWA required)',
                'POST /api/v2/agent/:id/verify': 'Verify agent identity (SIWA required)',
                'POST /api/v2/agent/:id/crossreg': 'Cross-register on canonical 8004 Registry (SIWA required)',
                'POST /api/v2/agent/:id/coinbase-verify': 'Check Coinbase EAS attestation & boost Cred (SIWA required)',
            },
        },
        pricing: {
            phase: 1,
            note: 'All operations free during Phase 1 (0-1000 agents)',
            agentMint: '$0',
            update: '$0',
        },
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', version: 'v2', port: PORT, contractDeployed: isContractDeployed() });
});

// GET /api/v2/stats
app.get('/api/v2/stats', async (req, res) => {
    try {
        if (!isContractDeployed()) {
            return res.json({
                totalAgents: 0,
                network: 'Base',
                chainId: 8453,
                contract: V2_CONTRACT_ADDRESS,
                contractDeployed: false,
                phase: 1,
                note: 'V2 contract not yet deployed',
            });
        }
        
        const [total, price, balance] = await Promise.all([
            readContract.totalAgents(),
            readContract.mintPrice(),
            provider.getBalance(wallet.address),
        ]);
        
        res.json({
            totalAgents: Number(total),
            mintPrice: ethers.formatEther(price),
            network: 'Base',
            chainId: 8453,
            contract: V2_CONTRACT_ADDRESS,
            contractDeployed: true,
            phase: 1,
            gasWallet: wallet.address,
            gasBalance: ethers.formatEther(balance),
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/v2/agents
app.get('/api/v2/agents', async (req, res) => {
    try {
        if (!isContractDeployed()) {
            return res.json({ total: 0, page: 1, agents: [], contractDeployed: false });
        }
        
        const total = Number(await readContract.totalAgents());
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
        const start = (page - 1) * limit;
        const end = Math.min(start + limit, total);
        
        const agents = [];
        for (let i = start; i < end; i++) {
            try {
                const agent = await readContract.getAgent(i);
                const owner = await readContract.ownerOf(i);
                let credScore = 0, personality = null, points = 0;
                try { credScore = Number(await readContract.getCredScore(i)); } catch {}
                try { points = Number(await readContract.points(i)); } catch {}
                try {
                    const p = await readContract.getPersonality(i);
                    personality = { quirks: p[0], communicationStyle: p[1], values: p[2], humor: p[3], riskTolerance: Number(p[4]), autonomyLevel: Number(p[5]) };
                } catch {}
                
                agents.push({
                    tokenId: i,
                    name: agent.name,
                    agentAddress: agent.agentAddress,
                    framework: agent.framework,
                    verified: agent.verified,
                    soulbound: agent.soulbound,
                    mintOrigin: ['HUMAN', 'AGENT_SIWA', 'API', 'OWNER'][Number(agent.origin)] || 'UNKNOWN',
                    credScore,
                    points,
                    personality,
                    owner,
                    mintedAt: new Date(Number(agent.mintedAt) * 1000).toISOString(),
                });
            } catch {}
        }
        
        res.json({ total, page, pages: Math.ceil(total / limit), limit, agents });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/v2/agent/:id
app.get('/api/v2/agent/:id', async (req, res) => {
    try {
        const agent = await formatAgentV2(parseInt(req.params.id));
        res.json(agent);
    } catch (e) {
        res.status(404).json({ error: 'Agent not found', detail: e.message });
    }
});

// GET /api/v2/metadata/:id — OpenSea-compatible metadata
app.get('/api/v2/metadata/:id', async (req, res) => {
    try {
        const agent = await formatAgentV2(parseInt(req.params.id));
        const tier = agent.credScore >= 61 ? 'Full Art' : agent.credScore >= 26 ? 'Holo' : 'Basic';
        
        const attributes = [
            { trait_type: 'Framework', value: agent.framework },
            { trait_type: 'Cred Score', value: agent.credScore, display_type: 'number' },
            { trait_type: 'Points', value: agent.points, display_type: 'number' },
            { trait_type: 'Tier', value: tier },
            { trait_type: 'Mint Origin', value: agent.mintOrigin },
            { trait_type: 'Verified', value: agent.verified ? 'Yes' : 'No' },
            { trait_type: 'Soulbound', value: agent.soulbound ? 'Yes' : 'No' },
            { trait_type: 'Generation', value: agent.generation, display_type: 'number' },
            { trait_type: 'Mutations', value: agent.mutationCount, display_type: 'number' },
        ];
        
        if (agent.personality) {
            if (agent.personality.quirks) attributes.push({ trait_type: 'Quirks', value: agent.personality.quirks });
            if (agent.personality.communicationStyle) attributes.push({ trait_type: 'Communication Style', value: agent.personality.communicationStyle });
            if (agent.personality.humor) attributes.push({ trait_type: 'Humor', value: agent.personality.humor });
            attributes.push({ trait_type: 'Risk Tolerance', value: agent.personality.riskTolerance, display_type: 'number', max_value: 10 });
            attributes.push({ trait_type: 'Autonomy Level', value: agent.personality.autonomyLevel, display_type: 'number', max_value: 10 });
        }
        
        if (agent.narrative) {
            if (agent.narrative.origin) attributes.push({ trait_type: 'Origin', value: agent.narrative.origin });
            if (agent.narrative.mission) attributes.push({ trait_type: 'Mission', value: agent.narrative.mission });
        }
        
        if (agent.traits && agent.traits.length > 0) {
            agent.traits.forEach(t => {
                const name = typeof t === 'string' ? t : t.name;
                const cat = typeof t === 'string' ? 'trait' : t.category;
                attributes.push({ trait_type: cat, value: name });
            });
        }
        
        // TODO: Replace with actual card render URL when available
        const imageUrl = `https://api.helixa.xyz/api/v2/card/${agent.tokenId}.png`;
        
        res.json({
            name: agent.name || `Helixa Agent #${agent.tokenId}`,
            description: agent.narrative?.mission 
                ? `${agent.name} — ${agent.narrative.mission}`
                : `${agent.name} — Helixa V2 Agent #${agent.tokenId} on Base. Cred Score: ${agent.credScore}. ${tier} tier.`,
            image: imageUrl,
            external_url: `https://helixa.xyz/agent/${agent.tokenId}`,
            attributes,
        });
    } catch (e) {
        res.status(404).json({ error: 'Agent not found' });
    }
});

// GET /api/v2/name/:name
app.get('/api/v2/name/:name', async (req, res) => {
    const name = decodeURIComponent(req.params.name).toLowerCase().replace(/\.agent$/, '');
    
    if (!isContractDeployed()) {
        return res.json({ name: `${name}.agent`, available: null, contractDeployed: false });
    }
    
    try {
        const resolved = await readContract.resolveName(name);
        const available = resolved === 0n || resolved === BigInt(0);
        res.json({
            name: `${name}.agent`,
            available,
            tokenId: available ? null : Number(resolved),
            contract: V2_CONTRACT_ADDRESS,
        });
    } catch (e) {
        // If resolveName reverts, name is likely available
        res.json({ name: `${name}.agent`, available: true, contract: V2_CONTRACT_ADDRESS });
    }
});

// ─── Authenticated Endpoints (SIWA required) ───────────────────

// GET /api/v2/referral/:code — Check referral code validity
app.get('/api/v2/referral/:code', (req, res) => {
    const code = req.params.code.toLowerCase();
    const entry = referralRegistry[code];
    if (!entry) {
        return res.status(404).json({ error: 'Invalid referral code', code });
    }
    const stats = referralStats[code] || { mints: 0, pointsEarned: 0 };
    res.json({
        valid: true,
        code,
        referrer: entry.name,
        bonusPoints: REFERRAL_POINTS_MINTER,
        isOG: !!V1_OG_WALLETS[entry.wallet],
        stats: { totalReferrals: stats.mints },
    });
});

// GET /api/v2/agent/:id/referral — Get agent's referral code
app.get('/api/v2/agent/:id/referral', async (req, res) => {
    const tokenId = parseInt(req.params.id);
    // Find referral code by tokenId
    for (const [code, entry] of Object.entries(referralRegistry)) {
        if (entry.tokenId === tokenId) {
            const stats = referralStats[code] || { mints: 0, pointsEarned: 0 };
            return res.json({
                tokenId,
                code,
                link: `https://helixa.xyz/mint?ref=${code}`,
                referrer: entry.name,
                isOG: !!V1_OG_WALLETS[entry.wallet],
                stats: { totalReferrals: stats.mints, pointsEarned: stats.pointsEarned },
            });
        }
    }
    res.status(404).json({ error: 'No referral code found for this agent', tokenId });
});

// GET /api/v2/og/:address — Check OG status
app.get('/api/v2/og/:address', (req, res) => {
    const og = isOGWallet(req.params.address);
    if (!og) {
        return res.json({ isOG: false, address: req.params.address });
    }
    res.json({
        isOG: true,
        address: req.params.address,
        v1Name: og.name,
        referralCode: og.code,
        referralLink: `https://helixa.xyz/mint?ref=${og.code}`,
        benefits: {
            freeMint: true,
            bonusPoints: OG_BONUS_POINTS,
            ogTrait: true,
        },
    });
});

// POST /api/v2/mint — Mint new agent
app.post('/api/v2/mint', requireSIWA, requirePayment(PRICING.agentMint), async (req, res) => {
    const { name, framework, soulbound, personality, narrative, referralCode } = req.body;
    
    if (!name || typeof name !== 'string' || name.length < 1 || name.length > 64) {
        return res.status(400).json({ error: 'name required (1-64 chars)' });
    }
    
    const fw = (framework || 'custom').toLowerCase();
    const VALID_FRAMEWORKS = ['openclaw', 'eliza', 'langchain', 'crewai', 'autogpt', 'bankr', 'virtuals', 'based', 'agentkit', 'custom'];
    if (!VALID_FRAMEWORKS.includes(fw)) {
        return res.status(400).json({ error: `framework must be one of: ${VALID_FRAMEWORKS.join(', ')}` });
    }
    
    const agentAddress = req.agent.address;
    
    if (!isContractDeployed()) {
        // TODO: Once V2 contract is deployed, remove this block
        return res.status(503).json({
            error: 'V2 contract not yet deployed',
            hint: 'Set V2_CONTRACT in .env once deployed',
            received: { name, framework: fw, agentAddress, soulbound, personality, narrative },
            message: 'Your mint request is valid and will work once V2 is live',
        });
    }
    
    try {
        // Check if already minted
        const hasMinted = await readContract.hasMinted(agentAddress);
        if (hasMinted) {
            return res.status(409).json({ error: 'This address already has an agent' });
        }
        
        // TODO: mintFor signature — verify this matches the deployed contract
        // mintFor(address to, address agentAddress, string name, string framework, bool soulbound, MintOrigin origin)
        // MintOrigin.AGENT_SIWA = 1
        console.log(`[V2 MINT] ${name} (${fw}) → ${agentAddress}`);
        const tx = await contract.mintFor(
            agentAddress,   // to (owner)
            agentAddress,   // agentAddress
            name,
            fw,
            soulbound === true,
            1,              // MintOrigin.AGENT_SIWA
        );
        console.log(`[V2 MINT] TX: ${tx.hash}`);
        const receipt = await tx.wait();
        
        // Extract tokenId from AgentRegistered event
        let tokenId = null;
        for (const log of receipt.logs) {
            try {
                const parsed = contract.interface.parseLog(log);
                if (parsed?.name === 'AgentRegistered') {
                    tokenId = Number(parsed.args.tokenId);
                    break;
                }
            } catch {}
        }
        
        // Set personality if provided
        if (personality && tokenId !== null) {
            try {
                const ptx = await contract.setPersonality(
                    tokenId,
                    [
                        personality.quirks || '',
                        personality.communicationStyle || '',
                        personality.values || '',
                        personality.humor || '',
                        Math.min(10, Math.max(0, parseInt(personality.riskTolerance) || 5)),
                        Math.min(10, Math.max(0, parseInt(personality.autonomyLevel) || 5)),
                    ],
                );
                await ptx.wait();
                console.log(`[V2 MINT] ✓ Personality set for #${tokenId}`);
            } catch (e) {
                console.error(`[V2 MINT] Personality failed: ${e.message}`);
            }
        }
        
        // Set narrative if provided
        if (narrative && tokenId !== null) {
            try {
                const ntx = await contract.setNarrative(
                    tokenId,
                    [
                        narrative.origin || '',
                        narrative.mission || '',
                        narrative.lore || '',
                        narrative.manifesto || '',
                    ],
                );
                await ntx.wait();
                console.log(`[V2 MINT] ✓ Narrative set for #${tokenId}`);
            } catch (e) {
                console.error(`[V2 MINT] Narrative failed: ${e.message}`);
            }
        }
        
        console.log(`[V2 MINT] ✓ Token #${tokenId} minted for ${name}`);
        
        // ─── Generate Referral Code for this agent ────
        const newRefCode = generateReferralCode(name);
        registerReferralCode(newRefCode, agentAddress, name, tokenId);
        console.log(`[V2 MINT] ✓ Referral code "${newRefCode}" assigned to #${tokenId}`);
        
        // ─── OG Benefits ──────────────────────────────
        const ogInfo = isOGWallet(agentAddress);
        let ogApplied = false;
        if (ogInfo && tokenId !== null) {
            try {
                // Add bonus points
                const bpTx = await contract.addPoints(tokenId, OG_BONUS_POINTS);
                await bpTx.wait();
                // Add V1 OG trait
                const trTx = await contract.addTrait(tokenId, 'V1 OG', 'badge');
                await trTx.wait();
                ogApplied = true;
                console.log(`[V2 MINT] ✓ OG benefits applied for ${ogInfo.name}: +${OG_BONUS_POINTS} pts + V1 OG trait`);
            } catch (e) {
                console.error(`[V2 MINT] OG benefits failed: ${e.message}`);
            }
        }
        
        // ─── Referral Rewards ─────────────────────────
        let referralApplied = null;
        const refWallet = resolveReferralCode(referralCode);
        if (refWallet && refWallet.toLowerCase() !== agentAddress.toLowerCase()) {
            try {
                // Find referrer's tokenId
                const total = Number(await readContract.totalAgents());
                for (let i = 0; i < total; i++) {
                    try {
                        const o = await readContract.ownerOf(i);
                        if (o.toLowerCase() === refWallet.toLowerCase()) {
                            // Give referrer points
                            const rpTx = await contract.addPoints(i, REFERRAL_POINTS_REFERRER);
                            await rpTx.wait();
                            // Give minter bonus points
                            if (tokenId !== null) {
                                const mpTx = await contract.addPoints(tokenId, REFERRAL_POINTS_MINTER);
                                await mpTx.wait();
                            }
                            // Track stats
                            if (!referralStats[referralCode]) referralStats[referralCode] = { mints: 0, pointsEarned: 0 };
                            referralStats[referralCode].mints++;
                            referralStats[referralCode].pointsEarned += REFERRAL_POINTS_REFERRER;
                            
                            referralApplied = {
                                code: referralCode,
                                referrerTokenId: i,
                                referrerPoints: REFERRAL_POINTS_REFERRER,
                                minterPoints: REFERRAL_POINTS_MINTER,
                            };
                            console.log(`[V2 MINT] ✓ Referral "${referralCode}": +${REFERRAL_POINTS_REFERRER} to #${i}, +${REFERRAL_POINTS_MINTER} to #${tokenId}`);
                            break;
                        }
                    } catch {}
                }
            } catch (e) {
                console.error(`[V2 MINT] Referral reward failed: ${e.message}`);
            }
        }
        
        // ─── Set tokenURI for OpenSea metadata ────────
        try {
            const metadataUrl = `https://api.helixa.xyz/api/v2/metadata/${tokenId}`;
            const uriTx = await contract.setMetadata(tokenId, metadataUrl);
            await uriTx.wait();
            console.log(`[V2 MINT] ✓ tokenURI set for #${tokenId}`);
        } catch (e) {
            console.error(`[V2 MINT] tokenURI failed: ${e.message}`);
        }
        
        // ─── Cross-register on canonical ERC-8004 Registry ────────
        let crossRegId = null;
        let crossRegTx = null;
        try {
            const registryContract = new ethers.Contract(ERC8004_REGISTRY, ERC8004_REGISTRY_ABI, wallet);
            
            const registrationFile = build8004RegistrationFile(tokenId, name, fw);
            const dataURI = registrationFileToDataURI(registrationFile);
            
            const regTx = await registryContract['register(string)'](dataURI);
            console.log(`[8004 XREG] TX: ${regTx.hash}`);
            const regReceipt = await regTx.wait();
            crossRegTx = regTx.hash;
            
            // Extract agentId from Registered event
            for (const log of regReceipt.logs) {
                try {
                    const parsed = registryContract.interface.parseLog(log);
                    if (parsed?.name === 'Registered') {
                        crossRegId = Number(parsed.args.agentId);
                        break;
                    }
                } catch {}
            }
            
            console.log(`[8004 XREG] ✓ Cross-registered as 8004 Registry ID #${crossRegId}`);
        } catch (e) {
            // Non-fatal — Helixa mint succeeded, cross-reg is bonus
            console.error(`[8004 XREG] Cross-registration failed (non-fatal): ${e.message}`);
        }
        
        res.status(201).json({
            success: true,
            tokenId,
            txHash: tx.hash,
            mintOrigin: 'AGENT_SIWA',
            explorer: `https://basescan.org/tx/${tx.hash}`,
            message: `${name} is now onchain! Helixa V2 Agent #${tokenId}`,
            crossRegistration: crossRegId !== null ? {
                registry: ERC8004_REGISTRY,
                agentId: crossRegId,
                txHash: crossRegTx,
                explorer: `https://basescan.org/tx/${crossRegTx}`,
            } : null,
            yourReferralCode: newRefCode,
            yourReferralLink: `https://helixa.xyz/mint?ref=${newRefCode}`,
            og: ogApplied ? { v1Name: ogInfo.name, bonusPoints: OG_BONUS_POINTS, trait: 'V1 OG' } : null,
            referral: referralApplied,
        });
    } catch (e) {
        console.error('[V2 MINT] Error:', e.message);
        res.status(500).json({ error: 'Mint failed: ' + e.message.slice(0, 200) });
    }
});

// ─── Helper: Build 8004 registration file ──────────────────────
function build8004RegistrationFile(tokenId, name, framework) {
    return {
        type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
        name,
        description: `${name} — AI agent (${framework}) registered on Helixa, the most complete ERC-8004 implementation.`,
        image: `https://api.helixa.xyz/api/v2/agent/${tokenId}/card.png`,
        services: [
            { name: 'web', endpoint: `https://helixa.xyz/agent/${tokenId}` },
        ],
        x402Support: true,
        active: true,
        registrations: [
            {
                agentId: tokenId,
                agentRegistry: `eip155:8453:${V2_CONTRACT_ADDRESS}`,
            },
        ],
    };
}

function registrationFileToDataURI(regFile) {
    return 'data:application/json;base64,' + Buffer.from(JSON.stringify(regFile)).toString('base64');
}

// POST /api/v2/agent/:id/update — Update agent traits/personality/narrative
app.post('/api/v2/agent/:id/update', requireSIWA, requirePayment(PRICING.update), async (req, res) => {
    const tokenId = parseInt(req.params.id);
    const { personality, narrative, traits } = req.body;
    
    if (!isContractDeployed()) {
        return res.status(503).json({ error: 'V2 contract not yet deployed' });
    }
    
    try {
        // Verify caller owns this agent
        const owner = await readContract.ownerOf(tokenId);
        if (owner.toLowerCase() !== req.agent.address.toLowerCase()) {
            return res.status(403).json({ error: 'Not the owner of this agent' });
        }
        
        const updated = [];
        
        // Update personality
        if (personality) {
            // Fetch current to merge partial updates
            let current = {};
            try {
                const p = await readContract.getPersonality(tokenId);
                // p.values is shadowed by ethers Result.values() method — use index
                current = {
                    quirks: p[0], communicationStyle: p[1],
                    values: p[2], humor: p[3],
                    riskTolerance: Number(p[4]), autonomyLevel: Number(p[5]),
                };
            } catch {}
            
            const merged = { ...current, ...personality };
            const tx = await contract.setPersonality(
                tokenId,
                [
                    merged.quirks || '',
                    merged.communicationStyle || '',
                    merged.values || '',
                    merged.humor || '',
                    Math.min(10, Math.max(0, parseInt(merged.riskTolerance) || 5)),
                    Math.min(10, Math.max(0, parseInt(merged.autonomyLevel) || 5)),
                ],
            );
            await tx.wait();
            updated.push('personality');
        }
        
        // Update narrative (partial — individual setters)
        if (narrative) {
            if (narrative.origin) {
                const tx = await contract.setOrigin(tokenId, narrative.origin);
                await tx.wait();
                updated.push('narrative.origin');
            }
            if (narrative.mission) {
                const tx = await contract.setMission(tokenId, narrative.mission);
                await tx.wait();
                updated.push('narrative.mission');
            }
            if (narrative.lore) {
                const tx = await contract.setLore(tokenId, narrative.lore);
                await tx.wait();
                updated.push('narrative.lore');
            }
            if (narrative.manifesto) {
                const tx = await contract.setManifesto(tokenId, narrative.manifesto);
                await tx.wait();
                updated.push('narrative.manifesto');
            }
        }
        
        // Add traits
        if (traits && Array.isArray(traits)) {
            for (const t of traits.slice(0, 10)) {
                if (t.name && t.category) {
                    try {
                        const tx = await contract.addTrait(tokenId, t.name, t.category);
                        await tx.wait();
                        updated.push(`trait:${t.name}`);
                    } catch (e) {
                        console.error(`[V2 UPDATE] Trait "${t.name}" failed: ${e.message}`);
                    }
                }
            }
        }
        
        // ─── Sync to 8004 Registry (non-fatal) ─────────────────
        let registrySync = null;
        if (updated.length > 0) {
            try {
                const agent = await readContract.getAgent(tokenId);
                const registryContract = new ethers.Contract(ERC8004_REGISTRY, ERC8004_REGISTRY_ABI, wallet);
                const regFile = build8004RegistrationFile(tokenId, agent.name, agent.framework);
                const dataURI = registrationFileToDataURI(regFile);
                
                // Try to find agent's 8004 Registry ID via events or stored mapping
                // For now, we update the URI if agent has a crossRegId stored
                // TODO: maintain a tokenId → 8004 agentId mapping
                // Fallback: re-register (creates new entry — acceptable for now)
                const regTx = await registryContract['register(string)'](dataURI);
                await regTx.wait();
                registrySync = { status: 'synced', txHash: regTx.hash };
                console.log(`[8004 SYNC] ✓ Agent #${tokenId} registry synced`);
            } catch (e) {
                registrySync = { status: 'failed', error: e.message.slice(0, 100) };
                console.error(`[8004 SYNC] Failed for #${tokenId}: ${e.message}`);
            }
        }
        
        res.json({ success: true, tokenId, updated, registrySync });
    } catch (e) {
        res.status(500).json({ error: 'Update failed: ' + e.message.slice(0, 200) });
    }
});

// POST /api/v2/agent/:id/crossreg — Cross-register on canonical 8004 Registry
app.post('/api/v2/agent/:id/crossreg', requireSIWA, async (req, res) => {
    const tokenId = parseInt(req.params.id);
    
    if (!isContractDeployed()) {
        return res.status(503).json({ error: 'V2 contract not yet deployed' });
    }
    
    try {
        // Verify caller owns this agent
        const owner = await readContract.ownerOf(tokenId);
        if (owner.toLowerCase() !== req.agent.address.toLowerCase()) {
            return res.status(403).json({ error: 'Not the owner of this agent' });
        }
        
        const agent = await readContract.getAgent(tokenId);
        const registryContract = new ethers.Contract(ERC8004_REGISTRY, ERC8004_REGISTRY_ABI, wallet);
        
        const registrationFile = build8004RegistrationFile(tokenId, agent.name, agent.framework);
        const dataURI = registrationFileToDataURI(registrationFile);
        const regTx = await registryContract['register(string)'](dataURI);
        const regReceipt = await regTx.wait();
        
        let crossRegId = null;
        for (const log of regReceipt.logs) {
            try {
                const parsed = registryContract.interface.parseLog(log);
                if (parsed?.name === 'Registered') {
                    crossRegId = Number(parsed.args.agentId);
                    break;
                }
            } catch {}
        }
        
        console.log(`[8004 XREG] ✓ Agent #${tokenId} cross-registered as 8004 ID #${crossRegId}`);
        
        res.json({
            success: true,
            tokenId,
            crossRegistration: {
                registry: ERC8004_REGISTRY,
                agentId: crossRegId,
                txHash: regTx.hash,
                explorer: `https://basescan.org/tx/${regTx.hash}`,
            },
        });
    } catch (e) {
        res.status(500).json({ error: 'Cross-registration failed: ' + e.message.slice(0, 200) });
    }
});

// POST /api/v2/agent/:id/verify — Verify agent identity
app.post('/api/v2/agent/:id/verify', requireSIWA, async (req, res) => {
    const tokenId = parseInt(req.params.id);
    
    if (!isContractDeployed()) {
        return res.status(503).json({ error: 'V2 contract not yet deployed' });
    }
    
    try {
        // Get agent and check the caller IS the agent
        const agent = await readContract.getAgent(tokenId);
        if (agent.agentAddress.toLowerCase() !== req.agent.address.toLowerCase()) {
            return res.status(403).json({
                error: 'SIWA verification requires signing from the agent\'s own wallet',
                agentAddress: agent.agentAddress,
                yourAddress: req.agent.address,
            });
        }
        
        // Owner calls verify on-chain
        const tx = await contract.verify(tokenId);
        await tx.wait();
        
        res.json({
            success: true,
            tokenId,
            verified: true,
            txHash: tx.hash,
            message: `Agent #${tokenId} verified via SIWA`,
        });
    } catch (e) {
        res.status(500).json({ error: 'Verification failed: ' + e.message.slice(0, 200) });
    }
});

// POST /api/v2/agent/:id/coinbase-verify — Check Coinbase EAS attestation and set flag
app.post('/api/v2/agent/:id/coinbase-verify', requireSIWA, async (req, res) => {
    const tokenId = parseInt(req.params.id);
    
    if (!isContractDeployed()) {
        return res.status(503).json({ error: 'V2 contract not yet deployed' });
    }
    
    try {
        // Verify caller owns this agent
        const owner = await readContract.ownerOf(tokenId);
        if (owner.toLowerCase() !== req.agent.address.toLowerCase()) {
            return res.status(403).json({ error: 'Not the owner of this agent' });
        }
        
        // Check Coinbase Indexer for Verified Account attestation on the owner's wallet
        const indexer = new ethers.Contract(COINBASE_INDEXER, COINBASE_INDEXER_ABI, provider);
        const eas = new ethers.Contract(EAS_CONTRACT, EAS_ABI, provider);
        
        const attestationUid = await indexer.getAttestationUid(owner, COINBASE_VERIFIED_ACCOUNT_SCHEMA);
        
        if (attestationUid === ethers.ZeroHash) {
            return res.status(404).json({
                error: 'No Coinbase Verified Account attestation found',
                wallet: owner,
                hint: 'The agent owner must verify their wallet at coinbase.com/onchain-verify',
            });
        }
        
        // Verify the attestation is valid (not revoked, not expired)
        const attestation = await eas.getAttestation(attestationUid);
        const now = Math.floor(Date.now() / 1000);
        
        if (attestation.revocationTime > 0 && attestation.revocationTime <= now) {
            return res.status(410).json({ error: 'Coinbase attestation has been revoked' });
        }
        
        if (attestation.expirationTime > 0 && attestation.expirationTime <= now) {
            return res.status(410).json({ error: 'Coinbase attestation has expired' });
        }
        
        // Set the flag onchain
        const tx = await contract.setCoinbaseVerified(tokenId, true);
        await tx.wait();
        
        console.log(`[COINBASE] ✓ Agent #${tokenId} Coinbase verified (owner: ${owner})`);
        
        res.json({
            success: true,
            tokenId,
            coinbaseVerified: true,
            attestationUid,
            attester: attestation.attester,
            txHash: tx.hash,
            message: `Agent #${tokenId} now has Coinbase Verified Account status — Cred Score boosted!`,
        });
    } catch (e) {
        console.error(`[COINBASE] Error for #${tokenId}:`, e.message);
        res.status(500).json({ error: 'Coinbase verification failed: ' + e.message.slice(0, 200) });
    }
});

// ─── Error Handler ──────────────────────────────────────────────

app.use((err, req, res, next) => {
    console.error('[V2 ERROR]', err.message || err);
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found', hint: 'Try GET /api/v2 for endpoint list' });
});

// ─── Start ──────────────────────────────────────────────────────

process.on('uncaughtException', (err) => console.error('Uncaught:', err.message || err));
process.on('unhandledRejection', (err) => console.error('Unhandled:', err.message || err));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🧬 Helixa V2 API running on port ${PORT}`);
    console.log(`   Contract: ${V2_CONTRACT_ADDRESS} ${isContractDeployed() ? '✅' : '⏳ NOT DEPLOYED'}`);
    console.log(`   Auth: SIWA (Sign-In With Agent)`);
    console.log(`   Payments: x402 (Phase 1 — all free)`);
    console.log(`   RPC: ${RPC_URL}`);
    console.log(`   8004 Registry: ${ERC8004_REGISTRY} (cross-reg enabled)`);
    console.log(`   Deployer: ${wallet.address}\n`);
});
