#!/usr/bin/env node
/**
 * Helixa V2 API Server
 * 
 * Identity & Credibility infrastructure for AI agents on Base.
 * Implements ERC-8004, SIWA auth, x402 payments, Cred scoring.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const indexer = require('./indexer');

// ─── Services ───────────────────────────────────────────────────
const svc = require('./services/contract');
let {
    ethers, provider, readProvider, wallet,
    contract, rawContract, readContract, usdcContract,
    V2_ABI, V2_CONTRACT_ADDRESS, DEPLOYER_KEY, DEPLOYER_ADDRESS,
    USDC_ADDRESS, ERC8004_REGISTRY, ERC8004_REGISTRY_ABI,
    COINBASE_INDEXER, COINBASE_INDEXER_ABI, COINBASE_VERIFIED_ACCOUNT_SCHEMA,
    EAS_CONTRACT, EAS_ABI, TREASURY_ADDRESS, CHAIN_ID, RPC_URL, isContractDeployed,
    initDeployerKey,
} = svc;

const { requireSIWA, SIWA_DOMAIN } = require('./middleware/auth');
const { securityHeaders, cors } = require('./middleware/cors');
const { globalRateLimit, mintRateLimit } = require('./middleware/rateLimit');
const {
    verifyUSDCPayment, requirePayment, requirePaymentLegacy,
    PRICING, usedPayments, saveUsedPayments,
} = require('./services/payments');
const {
    V1_OG_WALLETS, REFERRAL_CODES, referralRegistry, referralStats,
    OG_BONUS_POINTS, REFERRAL_POINTS_REFERRER, REFERRAL_POINTS_MINTER,
    isOGWallet, resolveReferralCode, generateReferralCode, registerReferralCode,
    saveReferralDB,
} = require('./services/referrals');

// ─── Express App ────────────────────────────────────────────────
const PORT = process.env.V2_API_PORT || 3457;
const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '200kb' }));
app.use(securityHeaders);
app.use(cors);
app.use(globalRateLimit);
// x402 SDK available but we use our own middleware for reliability
// const { paymentMiddleware } = require('@x402/express'); // available if needed
// ─── Payment Verification ──────────────────────────────────────
const USDC_DECIMALS = 6;
const usedPaymentTxs = new Set(); // prevent replay

async function verifyUSDCTransfer(txHash, expectedAmountUSD, expectedRecipient) {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt || receipt.status !== 1) throw new Error('Transaction failed or not found');
    
    const transferTopic = ethers.id('Transfer(address,address,uint256)');
    for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== USDC_ADDRESS.toLowerCase()) continue;
        if (log.topics[0] !== transferTopic) continue;
        
        const to = ethers.getAddress('0x' + log.topics[2].slice(26));
        const amount = BigInt(log.data);
        const expectedAmount = BigInt(Math.round(expectedAmountUSD * 10 ** USDC_DECIMALS));
        
        if (to.toLowerCase() === expectedRecipient.toLowerCase() && amount >= expectedAmount) {
            return { from: ethers.getAddress('0x' + log.topics[1].slice(26)), to, amount: Number(amount) / 1e6 };
        }
    }
    throw new Error('No matching USDC transfer found in transaction');
}

// x402-compatible payment gate middleware
// Accepts: X-Payment-Proof header (TX hash), body.paymentTx, or x402 payment-signature
function requirePaymentX402(priceUSD, recipient, description) {
    return async (req, res, next) => {
        // 1. Check for TX hash in header or body
        const txHash = req.headers['x-payment-proof'] ||
                       req.headers['x-payment-tx'] ||
                       (req.body && req.body.paymentTx);
        
        if (txHash && typeof txHash === 'string') {
            const cleanHash = txHash.trim();
            if (usedPaymentTxs.has(cleanHash.toLowerCase())) {
                return res.status(400).json({ error: 'Payment TX already used' });
            }
            try {
                const result = await verifyUSDCTransfer(cleanHash, priceUSD, recipient);
                usedPaymentTxs.add(cleanHash.toLowerCase());
                req.paymentVerified = { method: 'tx-hash', txHash: cleanHash, ...result };
                console.log(`[PAYMENT ✅] TX hash verified: $${result.amount} USDC from ${result.from} → ${req.method} ${req.path}`);
                return next();
            } catch (e) {
                console.log(`[PAYMENT ❌] TX hash failed: ${e.message} → ${req.method} ${req.path}`);
                return res.status(402).json({
                    x402Version: 2,
                    error: `Payment verification failed: ${e.message}`,
                    accepts: [{
                        scheme: 'exact',
                        network: 'eip155:8453',
                        amount: String(Math.round(priceUSD * 1e6)),
                        asset: USDC_ADDRESS,
                        payTo: recipient,
                        maxTimeoutSeconds: 300,
                    }],
                    resource: { url: `${req.protocol}://${req.get('host')}${req.originalUrl}`, description },
                    hint: 'Send USDC, then retry with X-Payment-Proof: <txHash>'
                });
            }
        }
        
        // 2. No payment provided — return 402 with x402 v2 payment requirements
        console.log(`[PAYMENT] 402 returned for ${req.method} ${req.path} (no payment header)`);
        const paymentRequired = {
            x402Version: 2,
            error: 'Payment required',
            resource: {
                url: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
                description,
                mimeType: 'application/json',
            },
            accepts: [{
                scheme: 'exact',
                network: 'eip155:8453',
                amount: String(Math.round(priceUSD * 1e6)),
                asset: USDC_ADDRESS,
                payTo: recipient,
                maxTimeoutSeconds: 300,
                extra: { name: 'USD Coin', version: '2' },
            }],
        };
        res.status(402);
        res.setHeader('PAYMENT-REQUIRED', Buffer.from(JSON.stringify(paymentRequired)).toString('base64'));
        return res.json(paymentRequired);
    };
}

// Mount payment gates on protected routes
if (PRICING.agentMint > 0) {
    app.post('/api/v2/mint', requirePaymentX402(PRICING.agentMint, DEPLOYER_ADDRESS, 'Mint a new Helixa agent identity'));
}
if (PRICING.update > 0) {
    app.post('/api/v2/agent/:id/update', requirePaymentX402(PRICING.update, DEPLOYER_ADDRESS, 'Update agent traits and metadata'));
}
if (PRICING.credReport > 0) {
    app.get('/api/v2/agent/:id/cred-report', requirePaymentX402(PRICING.credReport, TREASURY_ADDRESS, 'Full Cred Report with scoring breakdown'));
}
console.log(`💰 Payment gates active: mint ($${PRICING.agentMint}), update ($${PRICING.update}), cred-report ($${PRICING.credReport})`);
console.log(`💰 Accepts: X-Payment-Proof header (TX hash), body.paymentTx, x402 payment-signature`);

// ─── Helpers ────────────────────────────────────────────────────


// ─── Off-chain agent profiles (traits, personality, narrative) ───
const PROFILES_PATH = path.join(__dirname, '..', 'data', 'agent-profiles.json');
function loadProfiles() {
    try { return JSON.parse(fs.readFileSync(PROFILES_PATH, 'utf8')); } catch { return {}; }
}
function saveProfiles(profiles) {
    fs.writeFileSync(PROFILES_PATH, JSON.stringify(profiles, null, 2));
}
function getProfile(tokenId) {
    const profiles = loadProfiles();
    return profiles[tokenId] || null;
}
function saveProfile(tokenId, data) {
    const profiles = loadProfiles();
    profiles[tokenId] = { ...(profiles[tokenId] || {}), ...data, updatedAt: new Date().toISOString() };
    saveProfiles(profiles);
    return profiles[tokenId];
}

async function formatAgentV2(tokenId) {
    if (!isContractDeployed()) throw new Error('V2 contract not yet deployed');
    
    const [agent, owner] = await Promise.all([
        readContract.getAgent(tokenId),
        readContract.ownerOf(tokenId),
    ]);
    
    let personality = null, narrative = null, traits = [], pts = 0, credScore = 0, agentName = '';
    const safe = (p) => p.catch(() => null);
    const [pRes, nRes, tRes, ptsRes, credRes, nameRes] = await Promise.all([
        safe(readContract.getPersonality(tokenId)),
        safe(readContract.getNarrative(tokenId)),
        safe(readContract.getTraits(tokenId)),
        safe(readContract.points(tokenId)),
        safe(readContract.getCredScore(tokenId)),
        safe(readContract.nameOf(tokenId)),
    ]);
    if (pRes) personality = pRes;
    if (nRes) narrative = nRes;
    if (tRes) traits = tRes;
    if (ptsRes) pts = Number(ptsRes);
    if (credRes) credScore = Number(credRes);
    if (nameRes) agentName = nameRes;

    // Fetch Ethos score for owner (non-blocking, best-effort)
    let ethosScore = null;
    try {
        const ethosResp = await fetch(`https://api.ethos.network/api/v1/score/address:${owner}`, { signal: AbortSignal.timeout(3000) });
        if (ethosResp.ok) {
            const ethosData = await ethosResp.json();
            if (ethosData.ok && ethosData.data?.score) ethosScore = ethosData.data.score;
        }
    } catch {}

    // Fetch Talent Protocol builder score for owner (non-blocking, best-effort)
    let talentScore = null;
    try {
        const talentKey = process.env.TALENT_API_KEY || require(require('os').homedir() + '/.config/talent-protocol/config.json').apiKey;
        if (talentKey) {
            const talentResp = await fetch(`https://api.talentprotocol.com/score?id=${owner}`, {
                headers: { 'X-API-KEY': talentKey, 'Accept': 'application/json' },
                signal: AbortSignal.timeout(3000)
            });
            if (talentResp.ok) {
                const talentData = await talentResp.json();
                if (talentData.score?.points) talentScore = talentData.score.points;
            }
        }
    } catch {}

    // Extract linked token from traits
    const linkedTokenTraits = {};
    const LINKED_TOKEN_KEYS = ['linked-token', 'linked-token-chain', 'linked-token-symbol', 'linked-token-name'];
    const filteredTraits = [];
    for (const t of traits) {
        const name = typeof t === 'string' ? t : t.name;
        if (LINKED_TOKEN_KEYS.includes(name)) {
            linkedTokenTraits[name] = name; // category holds the value for linked-token traits
        }
    }
    // Re-read trait values: trait name IS the key, category holds value
    // Actually traits are {name, category, addedAt} — for linked-token we store value in category
    const linkedToken = {};
    for (const t of traits) {
        const tName = typeof t === 'string' ? t : t.name;
        const tCat = typeof t === 'string' ? '' : t.category;
        if (tName === 'linked-token') linkedToken.contractAddress = tCat;
        else if (tName === 'linked-token-chain') linkedToken.chain = tCat;
        else if (tName === 'linked-token-symbol') linkedToken.symbol = tCat;
        else if (tName === 'linked-token-name') linkedToken.name = tCat;
    }

    // Build base result from onchain data
    const result = {
        tokenId: Number(tokenId),
        agentAddress: agent.agentAddress,
        name: agent.name,
        framework: agent.framework,
        mintedAt: new Date(Number(agent.mintedAt) * 1000).toISOString(),
        verified: agent.verified,
        soulbound: agent.soulbound || Number(tokenId) === 1, // Bendr is soulbound
        mintOrigin: ['HUMAN', 'AGENT_SIWA', 'API', 'OWNER'][Number(agent.origin)] || 'UNKNOWN',
        generation: Number(agent.generation),
        version: agent.currentVersion,
        mutationCount: Number(agent.mutationCount),
        points: pts,
        credScore,
        ethosScore,
        talentScore,
        owner,
        agentName: agentName || null,
        linkedToken: linkedToken.contractAddress ? linkedToken : null,
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
        traits: traits.filter(t => !LINKED_TOKEN_KEYS.includes(t.name)).map(t => ({
            name: t.name,
            category: t.category,
            addedAt: new Date(Number(t.addedAt) * 1000).toISOString(),
        })),
        explorer: `https://basescan.org/token/${V2_CONTRACT_ADDRESS}?a=${tokenId}`,
    };

    // Merge off-chain profile overrides (traits, personality, narrative)
    const profile = getProfile(tokenId);
    if (profile) {
        if (profile.personality) {
            result.personality = { ...(result.personality || {}), ...profile.personality };
        }
        if (profile.narrative) {
            result.narrative = { ...(result.narrative || {}), ...profile.narrative };
        }
        if (profile.traits && profile.traits.length > 0) {
            // Append off-chain traits (deduplicate by name)
            const existingNames = new Set(result.traits.map(t => t.name));
            for (const t of profile.traits) {
                if (!existingNames.has(t.name)) {
                    result.traits.push(t);
                    existingNames.add(t.name);
                }
            }
        }
    }

    // Recompute cred score from merged data (onchain score may be stale)
    try {
        const { computedScore } = computeCredBreakdown(result);
        if (computedScore > result.credScore) result.credScore = computedScore;
    } catch {}

    return result;
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
                'POST /api/v2/mint': `Mint new agent (SIWA + $${PRICING.agentMint} USDC via x402)`,
                'POST /api/v2/agent/:id/update': `Update agent (SIWA + $${PRICING.update} USDC via x402)`,
                'POST /api/v2/agent/:id/verify': 'Verify agent identity (SIWA required)',
                'POST /api/v2/agent/:id/crossreg': 'Cross-register on canonical 8004 Registry (SIWA required)',
                'POST /api/v2/agent/:id/coinbase-verify': 'Check Coinbase EAS attestation & boost Cred (SIWA required)',
                'GET /api/v2/agent/:id/cred-report': `Full Cred Report ($${PRICING.credReport} USDC via x402)`,
            },
        },
        pricing: {
            agentMint: `$${PRICING.agentMint} USDC`,
            update: `$${PRICING.update} USDC`,
            credReport: `$${PRICING.credReport} USDC`,
            network: 'Base (eip155:8453)',
            asset: USDC_ADDRESS,
            assetName: 'USDC',
        },
        x402: {
            version: 2,
            how_to_mint: {
                step1: 'Sign SIWA message: "Sign-In With Agent: api.helixa.xyz wants you to sign in with your wallet {address} at {timestamp}"',
                step2: `Send $${PRICING.agentMint} USDC to ${DEPLOYER_ADDRESS} on Base`,
                step3: 'POST /api/v2/mint with headers: Authorization (SIWA) + X-Payment-Proof (TX hash)',
                example: {
                    method: 'POST',
                    url: 'https://api.helixa.xyz/api/v2/mint',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer {address}:{timestamp}:{signature}',
                        'X-Payment-Proof': '{txHash}',
                    },
                    body: { address: '{agentWalletAddress}' },
                },
                notes: [
                    'TX hash is reusable until it is successfully consumed by a mint',
                    'USDC on Base: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
                    'If you get 402, the PAYMENT-REQUIRED header contains machine-readable payment instructions',
                ],
            },
        },
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', version: 'v2', port: PORT, contractDeployed: isContractDeployed() });
});

// ─── Simple Analytics ───────────────────────────────────────
const analyticsDb = (() => {
    try {
        const Database = require('better-sqlite3');
        const adb = new Database(path.join(__dirname, '..', 'data', 'analytics.db'));
        adb.pragma('journal_mode = WAL');
        adb.exec(`CREATE TABLE IF NOT EXISTS pageviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            path TEXT NOT NULL,
            referrer TEXT,
            ua TEXT,
            country TEXT,
            ts DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        adb.exec(`CREATE INDEX IF NOT EXISTS idx_pv_ts ON pageviews(ts)`);
        adb.exec(`CREATE INDEX IF NOT EXISTS idx_pv_path ON pageviews(path)`);
        console.log('📊 Analytics DB ready');
        return adb;
    } catch(e) { console.error('Analytics DB init failed:', e.message); return null; }
})();

// Pixel tracker - embed as <img> or call from JS
app.get('/api/v2/t.gif', (req, res) => {
    if (analyticsDb) {
        try {
            analyticsDb.prepare('INSERT INTO pageviews (path, referrer, ua) VALUES (?, ?, ?)').run(
                (req.query.p || '/').slice(0, 500),
                (req.query.r || req.headers.referer || '').slice(0, 500),
                (req.headers['user-agent'] || '').slice(0, 300)
            );
        } catch(e) {}
    }
    res.set({ 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' });
    res.send(Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'));
});

// Analytics dashboard endpoint
app.get('/api/v2/analytics', (req, res) => {
    if (!analyticsDb) return res.status(503).json({ error: 'Analytics not available' });
    try {
        const days = Math.min(90, parseInt(req.query.days) || 7);
        const since = new Date(Date.now() - days * 86400000).toISOString();
        const total = analyticsDb.prepare('SELECT COUNT(*) as c FROM pageviews WHERE ts >= ?').get(since).c;
        const byPage = analyticsDb.prepare(`SELECT path, COUNT(*) as views FROM pageviews WHERE ts >= ? GROUP BY path ORDER BY views DESC LIMIT 20`).all(since);
        const byDay = analyticsDb.prepare(`SELECT DATE(ts) as day, COUNT(*) as views FROM pageviews WHERE ts >= ? GROUP BY DATE(ts) ORDER BY day`).all(since);
        const byReferrer = analyticsDb.prepare(`SELECT referrer, COUNT(*) as views FROM pageviews WHERE ts >= ? AND referrer != '' GROUP BY referrer ORDER BY views DESC LIMIT 10`).all(since);
        res.json({ days, total, byPage, byDay, byReferrer });
    } catch(e) { res.status(500).json({ error: e.message }); }
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
        
        const queries = [
            readContract.totalAgents(),
            readContract.mintPrice(),
        ];
        if (wallet) queries.push(provider.getBalance(wallet.address));
        
        const results = await Promise.all(queries);
        const total = results[0];
        const price = results[1];
        const balance = results[2] || 0n;
        
        // Compute extra stats from indexer
        let totalCredScore = 0, soulboundCount = 0, frameworkSet = new Set();
        try {
            const all = indexer.getAllAgents();
            for (const a of all) {
                totalCredScore += (a.credScore || 0);
                if (a.soulbound) soulboundCount++;
                if (a.framework) frameworkSet.add(a.framework);
            }
        } catch (e) { console.warn('Stats indexer error:', e.message); }

        res.json({
            totalAgents: Math.max(0, Number(total) - 1), // Hide test agent #0
            totalCredScore,
            frameworks: frameworkSet.size,
            soulboundCount,
            mintPrice: ethers.formatEther(price),
            network: 'Base',
            chainId: 8453,
            contract: V2_CONTRACT_ADDRESS,
            contractDeployed: true,
            phase: 1,
            gasWallet: wallet ? wallet.address : DEPLOYER_ADDRESS,
            gasBalance: ethers.formatEther(balance),
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── Agent List (SQLite Indexer) ────────────────────────────────
const HIDDEN_TOKENS = new Set([0, 14, 15, 16, 17, 18, 21]);
const CACHE_FILE = path.join(__dirname, '..', 'data', 'agent-cache.json');

// Backward-compat shim: agentCache object for code that still references it
const agentCache = {
    get agents() { try { return indexer.getAllAgents(); } catch { return []; } },
    get total() { try { return indexer.getAgentCount(); } catch { return 0; } },
    get updatedAt() { return Date.now(); },
    loading: false,
};

// Start the indexer after a short delay (let server bind first)
setTimeout(() => {
    indexer.startIndexer(readProvider, readContract, CACHE_FILE)
        .then(() => { console.log('📋 SQLite indexer started'); return indexer.refreshScores(); })
        .catch(e => console.error('📋 Indexer start error:', e.message));
}, 2000);

// GET /api/v2/agents — now powered by SQLite
app.get('/api/v2/agents', async (req, res) => {
    try {
        if (!isContractDeployed()) {
            return res.json({ total: 0, page: 1, agents: [], contractDeployed: false });
        }

        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit) || 100));
        const sort = req.query.sort || 'tokenId';
        const order = req.query.order || 'asc';
        const showSpam = req.query.spam === 'true';

        const result = indexer.queryAgents({
            page, limit, sort, order,
            framework: req.query.framework,
            verified: req.query.verified,
            search: req.query.search,
            owner: req.query.owner,
            showSpam,
        });

        res.json(result);
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
        const tier = agent.credScore >= 91 ? 'Preferred' : agent.credScore >= 76 ? 'Prime' : agent.credScore >= 51 ? 'Qualified' : agent.credScore >= 26 ? 'Marginal' : 'Junk';
        
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
                // Skip onchain social traits (now stored off-chain)
                if (cat.startsWith('social-')) return;
                attributes.push({ trait_type: cat, value: name });
            });
        }
        
        // Add off-chain social links
        try {
            const socialPath = path.join(__dirname, '..', 'data', 'social-links.json');
            const allSocial = JSON.parse(fs.readFileSync(socialPath, 'utf8'));
            const s = allSocial[agent.tokenId];
            if (s) {
                if (s.twitter) attributes.push({ trait_type: 'social-twitter', value: s.twitter });
                if (s.website) attributes.push({ trait_type: 'social-website', value: s.website });
                if (s.github) attributes.push({ trait_type: 'social-github', value: s.github });
            }
        } catch {}
        
        // TODO: Replace with actual card render URL when available
        const imageUrl = `https://api.helixa.xyz/api/v2/aura/${agent.tokenId}.png`;
        
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

// GET /api/v2/aura/:id.png — Dynamic aura image for OpenSea
app.get(['/api/v2/aura/:id.png', '/api/v2/card/:id.png'], async (req, res) => {
    try {
        const sharp = require('sharp');
        const { generateAura } = require('../sdk/lib/aura-v3.cjs');
        const tokenId = parseInt(req.params.id);
        const agent = await formatAgentV2(tokenId);
        
        // Build aura from agent data — match frontend fields exactly
        const p = agent.personality || {};
        const n = agent.narrative || {};
        const auraData = {
            name: agent.name || `Agent #${tokenId}`,
            address: agent.agentAddress || agent.owner || '0x0000',
            agentAddress: agent.agentAddress || agent.owner || '0x0000',
            framework: agent.framework || 'custom',
            traitCount: (agent.traits || []).length,
            mutationCount: agent.mutationCount || 0,
            soulbound: agent.soulbound || false,
            points: agent.points || 0,
            generation: agent.generation || 0,
            quirks: p.quirks || '',
            humor: p.humor || '',
            values: p.values || '',
            communicationStyle: p.communicationStyle || '',
            riskTolerance: p.riskTolerance || 5,
            autonomyLevel: p.autonomyLevel || 5,
            origin: n.origin || '',
            mission: n.mission || '',
            credScore: agent.credScore || 0,
        };
        
        const svg = generateAura(auraData, 500);
        const png = await sharp(Buffer.from(svg)).png().toBuffer();
        
        res.set('Content-Type', 'image/png');
        res.set('Cache-Control', 'public, max-age=300');
        res.send(png);
    } catch (e) {
        res.status(404).json({ error: 'Card not found', detail: e.message });
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

// POST /api/v2/mint — Mint new agent (x402 payment or TX hash)
async function mintHandler(req, res) {
    const { name, framework, soulbound, personality, narrative, referralCode } = req.body;
    
    if (!name || typeof name !== 'string' || name.length < 1 || name.length > 64) {
        return res.status(400).json({ error: 'name required (1-64 chars)' });
    }

    // Input sanitization — reject control chars and excessive unicode
    const NAME_REGEX = /^[\x20-\x7E\u00C0-\u024F\u0370-\u03FF]{1,64}$/;
    if (!NAME_REGEX.test(name)) {
        return res.status(400).json({ error: 'Name contains invalid characters' });
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
        const MAX_STR = 256; // Max chars for any onchain string field
        const clamp = (s, max = MAX_STR) => (typeof s === 'string' ? s.slice(0, max) : '');
        if (personality && tokenId !== null) {
            try {
                const ptx = await contract.setPersonality(
                    tokenId,
                    [
                        clamp(personality.quirks),
                        clamp(personality.communicationStyle),
                        clamp(personality.values),
                        clamp(personality.humor),
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
                        clamp(narrative.origin, 512),
                        clamp(narrative.mission, 512),
                        clamp(narrative.lore, 1024),
                        clamp(narrative.manifesto, 1024),
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
            
            const registrationFile = build8004RegistrationFile(tokenId, name, fw, req.body.narrative);
            const dataURI = registrationFileToDataURI(registrationFile);
            
            const regTx = await registryContract['register(string)'](dataURI);
            console.log(`[8004 XREG] TX: ${regTx.hash}`);
            const regReceipt = await regTx.wait();
            crossRegTx = regTx.hash;
            
            // Extract agentId from Transfer event (mint: from=0x0)
            const transferSig = ethers.id('Transfer(address,address,uint256)');
            for (const log of regReceipt.logs) {
                if (log.address.toLowerCase() === ERC8004_REGISTRY.toLowerCase() && log.topics[0] === transferSig) {
                    crossRegId = Number(BigInt(log.topics[3]));
                    break;
                }
            }
            
            console.log(`[8004 XREG] ✓ Cross-registered as 8004 Registry ID #${crossRegId}`);
        } catch (e) {
            // Non-fatal — Helixa mint succeeded, cross-reg is bonus
            console.error(`[8004 XREG] Cross-registration failed (non-fatal): ${e.message}`);
        }
        
        // ─── Trust Terminal: merge/upgrade existing entry ────────
        try {
            const Database = require('better-sqlite3');
            const termPath = path.join(__dirname, '..', '..', 'terminal', 'data', 'terminal.db');
            if (fs.existsSync(termPath)) {
                const tdb = new Database(termPath);
                // Find existing entry by agent address (from agentscan)
                const existing = tdb.prepare('SELECT id, token_id FROM agents WHERE address = ? OR owner_address = ?')
                    .get(agentAddress.toLowerCase(), agentAddress.toLowerCase());
                
                const helixaTokenId = `helixa-${tokenId}`;
                const credScore = 40; // Base score for fresh Helixa mint
                const tierOf = s => s >= 91 ? 'PREFERRED' : s >= 76 ? 'PRIME' : s >= 51 ? 'QUALIFIED' : s >= 26 ? 'MARGINAL' : 'JUNK';
                
                if (existing) {
                    // Upgrade existing entry → Helixa
                    tdb.prepare(`UPDATE agents SET 
                        name = ?, platform = 'helixa', token_id = ?, agent_id = ?,
                        x402_supported = 1, cred_score = ?, cred_tier = ?, verified = 1,
                        image_url = ?, description = ?,
                        metadata = ?, registry = ?
                        WHERE id = ?`
                    ).run(name, helixaTokenId, helixaTokenId, credScore, tierOf(credScore),
                        `https://api.helixa.xyz/api/v2/aura/${tokenId}.png`,
                        `${name} — ${fw} agent on Helixa (ERC-8004).`,
                        JSON.stringify({ framework: fw, mintOrigin: 'AGENT_SIWA', soulbound: soulbound === true }),
                        V2_CONTRACT_ADDRESS, existing.id);
                    console.log(`[TERMINAL] ✓ Upgraded existing entry #${existing.id} → helixa-${tokenId}`);
                } else {
                    // Insert new Helixa entry
                    tdb.prepare(`INSERT OR REPLACE INTO agents 
                        (address, agent_id, token_id, chain_id, name, platform, x402_supported,
                         cred_score, cred_tier, verified, image_url, description, metadata, registry,
                         owner_address, created_at, registered_at)
                        VALUES (?, ?, ?, 8453, ?, 'helixa', 1, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`
                    ).run(agentAddress.toLowerCase(), helixaTokenId, helixaTokenId, name,
                        credScore, tierOf(credScore),
                        `https://api.helixa.xyz/api/v2/aura/${tokenId}.png`,
                        `${name} — ${fw} agent on Helixa (ERC-8004).`,
                        JSON.stringify({ framework: fw, mintOrigin: 'AGENT_SIWA', soulbound: soulbound === true }),
                        V2_CONTRACT_ADDRESS, agentAddress.toLowerCase(),
                        new Date().toISOString(), new Date().toISOString());
                    console.log(`[TERMINAL] ✓ New Helixa entry: helixa-${tokenId}`);
                }
                tdb.close();
            }
        } catch (e) {
            console.error(`[TERMINAL] DB merge failed (non-fatal): ${e.message}`);
        }
        
        // Fetch full agent data so callers don't need to poll
        let agentData = null;
        try {
            agentData = await formatAgentV2(tokenId);
            // Also update the indexer
            try { await indexer.reindexAgent(tokenId); } catch {}
        } catch (e) {
            console.error(`[V2 MINT] Agent data fetch failed (non-fatal): ${e.message}`);
        }
        
        const tierOf = s => s >= 91 ? 'PREFERRED' : s >= 76 ? 'PRIME' : s >= 51 ? 'QUALIFIED' : s >= 26 ? 'MARGINAL' : 'JUNK';
        
        res.status(201).json({
            success: true,
            tokenId,
            txHash: tx.hash,
            mintOrigin: 'AGENT_SIWA',
            explorer: `https://basescan.org/tx/${tx.hash}`,
            message: `${name} is now onchain! Helixa V2 Agent #${tokenId}`,
            agent: agentData ? {
                id: agentData.tokenId,
                name: agentData.name,
                agentAddress: agentData.agentAddress,
                framework: agentData.framework,
                traits: agentData.traits,
                personality: agentData.personality,
                narrative: agentData.narrative,
                credScore: agentData.credScore || 0,
                credTier: tierOf(agentData.credScore || 0),
                points: agentData.points || 0,
                mintOrigin: agentData.mintOrigin,
                verified: agentData.verified,
                soulbound: agentData.soulbound,
                owner: agentData.owner,
            } : null,
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
}

// x402-gated mint (standard flow)
app.post('/api/v2/mint', requireSIWA, mintHandler);

// TX-hash payment mint (alternative for agents that can't use x402 SDK)
app.post('/api/v2/mint-with-tx', requireSIWA, async (req, res) => {
    const { paymentTx } = req.body;
    if (!paymentTx) return res.status(400).json({ error: 'paymentTx required (USDC transfer TX hash)' });
    if (usedPaymentTxs.has(paymentTx.toLowerCase())) return res.status(400).json({ error: 'Payment TX already used' });
    
    try {
        const result = await verifyUSDCTransfer(paymentTx, PRICING.agentMint, DEPLOYER_ADDRESS);
        usedPaymentTxs.add(paymentTx.toLowerCase());
        req.paymentVerified = result;
        console.log(`[TX PAYMENT] Verified $${result.amount} USDC from ${result.from} (${paymentTx.slice(0,10)}...)`);
        return mintHandler(req, res);
    } catch (e) {
        return res.status(402).json({
            error: `Payment verification failed: ${e.message}`,
            hint: `Send $${PRICING.agentMint} USDC to ${DEPLOYER_ADDRESS} on Base, then include the TX hash as paymentTx`,
            payTo: DEPLOYER_ADDRESS,
            amount: `${PRICING.agentMint} USDC`,
            network: 'Base (chain 8453)',
        });
    }
});

// ─── Helper: Build 8004 registration file ──────────────────────
function build8004RegistrationFile(tokenId, name, framework, narrative) {
    // Use agent's own mission/origin for description if available
    let description;
    if (narrative?.mission) {
        description = narrative.mission;
    } else if (narrative?.origin) {
        description = narrative.origin;
    } else {
        description = `${name} — AI agent on Base (${framework}).`;
    }
    return {
        type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
        name,
        description,
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
// Default: off-chain storage. Add ?onchain=true to force onchain writes.
app.post('/api/v2/agent/:id/update', requireSIWA, async (req, res) => {
    const tokenId = parseInt(req.params.id);
    const { personality, narrative, traits } = req.body;
    const useOnchain = req.query.onchain === 'true';
    
    if (!isContractDeployed()) {
        return res.status(503).json({ error: 'V2 contract not yet deployed' });
    }
    
    try {
        // Verify caller owns this agent, is the agent itself, or is contract owner
        const [owner__, agentData__, contractOwner__] = await Promise.all([
            readContract.ownerOf(tokenId),
            readContract.getAgent(tokenId),
            readContract.owner()
        ]);
        const caller__ = req.agent.address.toLowerCase();
        const isOwner__ = owner__.toLowerCase() === caller__;
        const isAgent__ = agentData__.agentAddress.toLowerCase() === caller__;
        const isContractOwner__ = contractOwner__.toLowerCase() === caller__;
        if (!isOwner__ && !isAgent__ && !isContractOwner__) {
            return res.status(403).json({ error: 'Must be token owner or agent address' });
        }
        
        const updated = [];
        const MAX_STR = 256;
        const clamp = (s, max = MAX_STR) => (typeof s === 'string' ? s.slice(0, max) : '');
        
        if (useOnchain) {
            // ─── ONCHAIN PATH (legacy, costs gas) ─────────────────
            if (personality) {
                let current = {};
                try {
                    const p = await readContract.getPersonality(tokenId);
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
                        clamp(merged.quirks),
                        clamp(merged.communicationStyle),
                        clamp(merged.values),
                        clamp(merged.humor),
                        Math.min(10, Math.max(0, parseInt(merged.riskTolerance) || 5)),
                        Math.min(10, Math.max(0, parseInt(merged.autonomyLevel) || 5)),
                    ],
                );
                await tx.wait();
                updated.push('personality');
            }
            if (narrative) {
                if (narrative.origin) { const tx = await contract.setOrigin(tokenId, narrative.origin); await tx.wait(); updated.push('narrative.origin'); }
                if (narrative.mission) { const tx = await contract.setMission(tokenId, narrative.mission); await tx.wait(); updated.push('narrative.mission'); }
                if (narrative.lore) { const tx = await contract.setLore(tokenId, narrative.lore); await tx.wait(); updated.push('narrative.lore'); }
                if (narrative.manifesto) { const tx = await contract.setManifesto(tokenId, narrative.manifesto); await tx.wait(); updated.push('narrative.manifesto'); }
            }
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
                    const narrativeData = await readContract.getNarrative(tokenId).catch(() => null);
                    const narrative = narrativeData ? { origin: narrativeData[0], mission: narrativeData[1], lore: narrativeData[2] } : null;
                    const regFile = build8004RegistrationFile(tokenId, agent.name, agent.framework, narrative);
                    const dataURI = registrationFileToDataURI(regFile);
                    const regTx = await registryContract['register(string)'](dataURI);
                    await regTx.wait();
                    registrySync = { status: 'synced', txHash: regTx.hash };
                    console.log(`[8004 SYNC] ✓ Agent #${tokenId} registry synced`);
                } catch (e) {
                    registrySync = { status: 'failed', error: e.message.slice(0, 100) };
                    console.error(`[8004 SYNC] Failed for #${tokenId}: ${e.message}`);
                }
            }
            // Refresh cred score in SQLite after onchain update
            try {
                const newCred = Number(await readContract.getCredScore(tokenId));
                indexer.updateCredScore(tokenId, newCred);
            } catch (e) { console.error(`[CRED REFRESH] #${tokenId}:`, e.message); }

            res.json({ success: true, tokenId, updated, registrySync, storage: 'onchain' });
        } else {
            // ─── OFF-CHAIN PATH (default, no gas) ─────────────────
            const profileData = {};
            
            if (personality) {
                // Merge with existing off-chain or onchain personality
                let current = {};
                const existingProfile = getProfile(tokenId);
                if (existingProfile && existingProfile.personality) {
                    current = existingProfile.personality;
                } else {
                    try {
                        const p = await readContract.getPersonality(tokenId);
                        current = {
                            quirks: p[0], communicationStyle: p[1],
                            values: p[2], humor: p[3],
                            riskTolerance: Number(p[4]), autonomyLevel: Number(p[5]),
                        };
                    } catch {}
                }
                profileData.personality = {
                    quirks: clamp(personality.quirks || current.quirks || ''),
                    communicationStyle: clamp(personality.communicationStyle || current.communicationStyle || ''),
                    values: clamp(personality.values || current.values || ''),
                    humor: clamp(personality.humor || current.humor || ''),
                    riskTolerance: Math.min(10, Math.max(0, parseInt(personality.riskTolerance ?? current.riskTolerance ?? 5))),
                    autonomyLevel: Math.min(10, Math.max(0, parseInt(personality.autonomyLevel ?? current.autonomyLevel ?? 5))),
                };
                updated.push('personality');
            }
            
            if (narrative) {
                const existingProfile = getProfile(tokenId);
                const currentNarrative = (existingProfile && existingProfile.narrative) || {};
                profileData.narrative = { ...currentNarrative };
                if (narrative.origin) { profileData.narrative.origin = clamp(narrative.origin); updated.push('narrative.origin'); }
                if (narrative.mission) { profileData.narrative.mission = clamp(narrative.mission); updated.push('narrative.mission'); }
                if (narrative.lore) { profileData.narrative.lore = clamp(narrative.lore); updated.push('narrative.lore'); }
                if (narrative.manifesto) { profileData.narrative.manifesto = clamp(narrative.manifesto); updated.push('narrative.manifesto'); }
            }
            
            if (traits && Array.isArray(traits)) {
                const existingProfile = getProfile(tokenId);
                const existingTraits = (existingProfile && existingProfile.traits) || [];
                const existingNames = new Set(existingTraits.map(t => t.name));
                const newTraits = [...existingTraits];
                for (const t of traits.slice(0, 10)) {
                    if (t.name && t.category && !existingNames.has(t.name)) {
                        newTraits.push({ name: t.name, category: t.category, addedAt: new Date().toISOString() });
                        existingNames.add(t.name);
                        updated.push(`trait:${t.name}`);
                    }
                }
                profileData.traits = newTraits;
            }
            
            if (updated.length > 0) {
                saveProfile(tokenId, profileData);
                console.log(`[V2 UPDATE OFF-CHAIN] Agent #${tokenId}: ${updated.join(', ')}`);
            }
            
            // Refresh cred score in SQLite after offchain update
            try {
                const newCred = Number(await readContract.getCredScore(tokenId));
                indexer.updateCredScore(tokenId, newCred);
            } catch (e) { console.error(`[CRED REFRESH] #${tokenId}:`, e.message); }

            res.json({ success: true, tokenId, updated, storage: 'offchain' });
        }
    } catch (e) {
        res.status(500).json({ error: 'Update failed: ' + e.message.slice(0, 200) });
    }
});

// POST /api/v2/agent/:id/human-update — Update agent via wallet signature (for human owners)
app.post('/api/v2/agent/:id/human-update', async (req, res) => {
    const tokenId = parseInt(req.params.id);
    const { signature, message, personality, narrative, social } = req.body;
    
    if (!signature || !message) {
        return res.status(400).json({ error: 'Missing signature or message' });
    }
    
    try {
        // Verify signature recovers to the token owner
        const recoveredAddress = ethers.verifyMessage(message, signature);
        const owner = await readContract.ownerOf(tokenId);
        
        if (recoveredAddress.toLowerCase() !== owner.toLowerCase()) {
            return res.status(403).json({ error: 'Signature does not match token owner' });
        }
        
        // Verify message is recent (within 5 minutes) and contains tokenId
        // Expected message format: "Helixa: Update agent #<tokenId> at <timestamp>"
        const match = message.match(/Update agent #(\d+) at (\d+)/);
        if (!match || parseInt(match[1]) !== tokenId) {
            return res.status(400).json({ error: 'Invalid message format' });
        }
        const msgTime = parseInt(match[2]);
        if (Math.abs(Date.now() - msgTime) > 5 * 60 * 1000) {
            return res.status(400).json({ error: 'Message expired (5 min window)' });
        }
        
        const updated = [];
        const MAX_STR = 256;
        const clamp = (s, max = MAX_STR) => (typeof s === 'string' ? s.slice(0, max) : '');
        const useOnchain = req.query.onchain === 'true';
        
        // Update personality
        if (personality) {
            if (useOnchain) {
                let current = {};
                try {
                    const p = await readContract.getPersonality(tokenId);
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
                        clamp(merged.quirks),
                        clamp(merged.communicationStyle),
                        clamp(merged.values),
                        clamp(merged.humor),
                        Math.min(10, Math.max(0, parseInt(merged.riskTolerance) || 5)),
                        Math.min(10, Math.max(0, parseInt(merged.autonomyLevel) || 5)),
                    ],
                );
                await tx.wait();
            } else {
                let current = {};
                const existingProfile = getProfile(tokenId);
                if (existingProfile && existingProfile.personality) {
                    current = existingProfile.personality;
                } else {
                    try {
                        const p = await readContract.getPersonality(tokenId);
                        current = { quirks: p[0], communicationStyle: p[1], values: p[2], humor: p[3], riskTolerance: Number(p[4]), autonomyLevel: Number(p[5]) };
                    } catch {}
                }
                saveProfile(tokenId, {
                    personality: {
                        quirks: clamp(personality.quirks || current.quirks || ''),
                        communicationStyle: clamp(personality.communicationStyle || current.communicationStyle || ''),
                        values: clamp(personality.values || current.values || ''),
                        humor: clamp(personality.humor || current.humor || ''),
                        riskTolerance: Math.min(10, Math.max(0, parseInt(personality.riskTolerance ?? current.riskTolerance ?? 5))),
                        autonomyLevel: Math.min(10, Math.max(0, parseInt(personality.autonomyLevel ?? current.autonomyLevel ?? 5))),
                    }
                });
            }
            updated.push('personality');
        }
        
        // Update narrative
        if (narrative) {
            if (useOnchain) {
                if (narrative.origin) { const tx = await contract.setOrigin(tokenId, clamp(narrative.origin)); await tx.wait(); updated.push('narrative.origin'); }
                if (narrative.mission) { const tx = await contract.setMission(tokenId, clamp(narrative.mission)); await tx.wait(); updated.push('narrative.mission'); }
                if (narrative.lore) { const tx = await contract.setLore(tokenId, clamp(narrative.lore)); await tx.wait(); updated.push('narrative.lore'); }
                if (narrative.manifesto) { const tx = await contract.setManifesto(tokenId, clamp(narrative.manifesto)); await tx.wait(); updated.push('narrative.manifesto'); }
            } else {
                const existingProfile = getProfile(tokenId);
                const currentNarrative = (existingProfile && existingProfile.narrative) || {};
                const narrativeData = { ...currentNarrative };
                if (narrative.origin) { narrativeData.origin = clamp(narrative.origin); updated.push('narrative.origin'); }
                if (narrative.mission) { narrativeData.mission = clamp(narrative.mission); updated.push('narrative.mission'); }
                if (narrative.lore) { narrativeData.lore = clamp(narrative.lore); updated.push('narrative.lore'); }
                if (narrative.manifesto) { narrativeData.manifesto = clamp(narrative.manifesto); updated.push('narrative.manifesto'); }
                saveProfile(tokenId, { narrative: narrativeData });
            }
        }
        
        // Store social links (off-chain in metadata)
        if (social) {
            // Social links stored off-chain in JSON file (saves gas, avoids duplicate traits)
            const socialPath = path.join(__dirname, '..', 'data', 'social-links.json');
            let allSocial = {};
            try { allSocial = JSON.parse(fs.readFileSync(socialPath, 'utf8')); } catch {}
            if (!allSocial[tokenId]) allSocial[tokenId] = {};
            if (social.twitter) { allSocial[tokenId].twitter = social.twitter; updated.push('social.twitter'); }
            if (social.website) { allSocial[tokenId].website = social.website; updated.push('social.website'); }
            if (social.github) { allSocial[tokenId].github = social.github; updated.push('social.github'); }
            fs.writeFileSync(socialPath, JSON.stringify(allSocial, null, 2));
        }
        
        console.log(`[HUMAN UPDATE] Agent #${tokenId} by ${recoveredAddress}: ${updated.join(', ')} (${useOnchain ? 'onchain' : 'offchain'})`);
        res.json({ success: true, tokenId, updated, owner: recoveredAddress, storage: useOnchain ? 'onchain' : 'offchain' });
    } catch (e) {
        console.error(`[HUMAN UPDATE] Error for #${tokenId}: ${e.message}`);
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
        // Verify caller owns this agent OR is the agent itself
        const [owner__, agentData__] = await Promise.all([
            readContract.ownerOf(tokenId),
            readContract.getAgent(tokenId)
        ]);
        const caller__ = req.agent.address.toLowerCase();
        const isOwner__ = owner__.toLowerCase() === caller__;
        const isAgent__ = agentData__.agentAddress.toLowerCase() === caller__;
        if (!isOwner__ && !isAgent__) {
            return res.status(403).json({ error: 'Must be token owner or agent address' });
        }
        
        const agent = await readContract.getAgent(tokenId);
        const registryContract = new ethers.Contract(ERC8004_REGISTRY, ERC8004_REGISTRY_ABI, wallet);
        
        const narrativeData = await readContract.getNarrative(tokenId).catch(() => null);
        const narrative = narrativeData ? { origin: narrativeData[0], mission: narrativeData[1], lore: narrativeData[2] } : null;
        const registrationFile = build8004RegistrationFile(tokenId, agent.name, agent.framework, narrative);
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

// POST /api/v2/agent/:id/sync — Force re-index agent from on-chain data (no payment)
app.post('/api/v2/agent/:id/sync', async (req, res) => {
    const tokenId = parseInt(req.params.id);
    if (isNaN(tokenId) || tokenId < 0) {
        return res.status(400).json({ error: 'Invalid token ID' });
    }
    try {
        const indexed = await indexer.reindexAgent(tokenId);
        const agent = await formatAgentV2(tokenId);
        const tierOf = s => s >= 91 ? 'PREFERRED' : s >= 76 ? 'PRIME' : s >= 51 ? 'QUALIFIED' : s >= 26 ? 'MARGINAL' : 'JUNK';
        res.json({
            success: true,
            tokenId,
            synced: true,
            agent: {
                id: agent.tokenId,
                name: agent.name,
                agentAddress: agent.agentAddress,
                framework: agent.framework,
                traits: agent.traits,
                personality: agent.personality,
                narrative: agent.narrative,
                credScore: agent.credScore || 0,
                credTier: tierOf(agent.credScore || 0),
                points: agent.points || 0,
                mintOrigin: agent.mintOrigin,
                verified: agent.verified,
                soulbound: agent.soulbound,
                owner: agent.owner,
            },
        });
    } catch (e) {
        res.status(404).json({ error: `Sync failed: ${e.message}` });
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
        // Verify caller owns this agent OR is the agent itself
        const [owner__, agentData__] = await Promise.all([
            readContract.ownerOf(tokenId),
            readContract.getAgent(tokenId)
        ]);
        const caller__ = req.agent.address.toLowerCase();
        const isOwner__ = owner__.toLowerCase() === caller__;
        const isAgent__ = agentData__.agentAddress.toLowerCase() === caller__;
        if (!isOwner__ && !isAgent__) {
            return res.status(403).json({ error: 'Must be token owner or agent address' });
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

// ─── Discovery & OpenAPI ────────────────────────────────────────

// Well-known agent registry — machine-readable service manifest
app.get('/.well-known/agent-registry', (req, res) => {
    res.json({
        name: 'Helixa',
        description: 'Onchain identity and reputation layer for AI agents. ERC-8004 registry with Cred Scores, personality traits, and verifiable credentials.',
        version: '2.0.0',
        chain: 'base',
        chainId: 8453,
        contract: V2_CONTRACT_ADDRESS,
        standards: ['ERC-8004', 'x402', 'SIWA'],
        capabilities: [
            'agent-identity',
            'cred-score',
            'personality-traits',
            'narrative-metadata',
            'verification',
            'naming',
            'referrals',
            'cross-registration',
        ],
        endpoints: {
            api: 'https://api.helixa.xyz/api/v2',
            agents: 'https://api.helixa.xyz/api/v2/agents',
            mint: 'https://api.helixa.xyz/api/v2/mint',
            metadata: 'https://api.helixa.xyz/api/v2/metadata/{id}',
            openapi: 'https://api.helixa.xyz/api/v2/openapi.json',
            website: 'https://helixa.xyz',
            docs: 'https://helixa.xyz/docs/getting-started',
        },
        pricing: {
            mint: `${PRICING.agentMint} USDC`,
            update: `${PRICING.update} USDC`,
            credReport: `${PRICING.credReport} USDC`,
            protocol: 'x402',
            payTo: DEPLOYER_ADDRESS,
            asset: USDC_ADDRESS,
            network: 'eip155:8453',
        },
        auth: {
            type: 'SIWA',
            format: 'address:timestamp:signature',
            description: 'Sign-In With Agent — agent signs a message with its wallet key',
        },
        x402_mint_flow: {
            step1: `Send ${PRICING.agentMint} USDC to ${DEPLOYER_ADDRESS} on Base`,
            step2: 'Sign SIWA message with your agent wallet',
            step3: 'POST /api/v2/mint with Authorization + X-Payment-Proof headers',
            headers: {
                'Authorization': 'Bearer {address}:{timestamp}:{signature}',
                'X-Payment-Proof': '{txHash_from_step1}',
            },
        },
        social: {
            x: 'https://x.com/HelixaXYZ',
            github: 'https://github.com/Bendr-20/helixa',
        },
    });
});

// OpenAPI 3.0 spec
app.get('/api/v2/openapi.json', (req, res) => {
    res.json({
        openapi: '3.0.3',
        info: {
            title: 'Helixa V2 API',
            version: '2.0.0',
            description: 'Onchain identity and reputation for AI agents. Mint identities, set personality traits, build Cred Scores, and verify agents — all via API with SIWA auth and x402 payments.',
            contact: { url: 'https://helixa.xyz' },
        },
        servers: [{ url: 'https://api.helixa.xyz', description: 'Production (Base Mainnet)' }],
        paths: {
            '/api/v2/agents': {
                get: {
                    summary: 'List all agents',
                    description: 'Returns all registered Helixa agents with personality, traits, cred scores, and metadata.',
                    parameters: [
                        { name: 'limit', in: 'query', schema: { type: 'integer', default: 100, maximum: 200 } },
                        { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
                    ],
                    responses: { '200': { description: 'Array of agent objects' } },
                },
            },
            '/api/v2/agent/{id}': {
                get: {
                    summary: 'Get agent by token ID',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
                    responses: { '200': { description: 'Agent object with full personality, traits, narrative, and cred score' } },
                },
            },
            '/api/v2/mint': {
                post: {
                    summary: 'Mint a new agent identity',
                    description: `Requires SIWA auth + $${PRICING.agentMint} USDC payment via x402. Steps: (1) Sign SIWA message with agent wallet, (2) Send $${PRICING.agentMint} USDC to ${DEPLOYER_ADDRESS} on Base, (3) POST with Authorization header (SIWA) and X-Payment-Proof header (TX hash). Body must include name and framework.`,
                    security: [{ siwa: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['name', 'framework'],
                                    properties: {
                                        name: { type: 'string', description: 'Agent display name' },
                                        framework: { type: 'string', description: 'Agent framework (e.g. openclaw, elizaos, agentkit, langchain)' },
                                        soulbound: { type: 'boolean', description: 'Lock identity to this wallet (non-transferable)' },
                                        personality: {
                                            type: 'object',
                                            properties: {
                                                quirks: { type: 'string' },
                                                communicationStyle: { type: 'string' },
                                                values: { type: 'string' },
                                                humor: { type: 'string' },
                                                riskTolerance: { type: 'integer', minimum: 1, maximum: 10 },
                                                autonomyLevel: { type: 'integer', minimum: 1, maximum: 10 },
                                            },
                                        },
                                        narrative: {
                                            type: 'object',
                                            properties: {
                                                origin: { type: 'string' },
                                                mission: { type: 'string' },
                                                lore: { type: 'string' },
                                            },
                                        },
                                        referralCode: { type: 'string', description: 'Referral code from another agent' },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        '201': { description: 'Agent minted successfully' },
                        '401': { description: 'Invalid SIWA authentication' },
                        '402': { description: 'Payment required (when pricing is active)' },
                    },
                },
            },
            '/api/v2/agent/{id}/personality': {
                put: {
                    summary: 'Update agent personality',
                    security: [{ siwa: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
                    responses: { '200': { description: 'Personality updated' } },
                },
            },
            '/api/v2/agent/{id}/verify': {
                post: {
                    summary: 'Verify agent identity',
                    security: [{ siwa: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
                    responses: { '200': { description: 'Agent verified, Cred Score boosted' } },
                },
            },
            '/api/v2/metadata/{id}': {
                get: {
                    summary: 'OpenSea-compatible NFT metadata',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
                    responses: { '200': { description: 'ERC-721 metadata JSON' } },
                },
            },
            '/api/v2/leaderboard': {
                get: {
                    summary: 'Agent leaderboard by Cred Score or Points',
                    parameters: [
                        { name: 'sort', in: 'query', schema: { type: 'string', enum: ['cred', 'points'], default: 'cred' } },
                        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                    ],
                    responses: { '200': { description: 'Sorted agent list' } },
                },
            },
        },
        components: {
            securitySchemes: {
                siwa: {
                    type: 'apiKey',
                    in: 'header',
                    name: 'Authorization',
                    description: 'SIWA token: address:timestamp:signature (agent signs message with wallet key)',
                },
            },
        },
    });
});

// ═══════════════════════════════════════════════════════════════
// Social Verification (X/Twitter, GitHub, Farcaster)
// ═══════════════════════════════════════════════════════════════

const VERIFICATIONS_PATH = path.join(__dirname, '..', 'data', 'verifications.json');
let verifications = {};
try {
    if (fs.existsSync(VERIFICATIONS_PATH)) {
        verifications = JSON.parse(fs.readFileSync(VERIFICATIONS_PATH, 'utf8'));
        console.log(`✅ Loaded ${Object.keys(verifications).length} social verifications`);
    }
} catch {}

function saveVerifications() {
    try {
        const dir = path.dirname(VERIFICATIONS_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(VERIFICATIONS_PATH, JSON.stringify(verifications, null, 2));
    } catch (e) {
        console.error(`[VERIFY] Failed to save verifications: ${e.message}`);
    }
}

async function requireAgentAuth(req, res, tokenId) {
    const [owner, agentData, contractOwner] = await Promise.all([
        readContract.ownerOf(tokenId),
        readContract.getAgent(tokenId),
        readContract.owner(),
    ]);
    const caller = req.agent.address.toLowerCase();
    const isOwner = owner.toLowerCase() === caller;
    const isAgent = agentData.agentAddress.toLowerCase() === caller;
    const isContractOwner = contractOwner.toLowerCase() === caller;
    if (!isOwner && !isAgent && !isContractOwner) {
        res.status(403).json({ error: 'Must be token owner, agent address, or contract owner' });
        return false;
    }
    // Auto-grant siwa-verified trait on first successful SIWA auth (non-contract-owner)
    if ((isOwner || isAgent) && !isContractOwner) {
        autoGrantSIWATrait(tokenId).catch(() => {});
    }
    return true;
}

const siwaGrantedSet = new Set(); // in-memory dedup
async function autoGrantSIWATrait(tokenId) {
    if (siwaGrantedSet.has(tokenId)) return;
    siwaGrantedSet.add(tokenId);
    try {
        // Check if already has the trait
        const traits = await readContract.getTraits(tokenId);
        if (traits.some(t => t.name === 'siwa-verified')) return;
        const tx = await contract.addTrait(tokenId, 'siwa-verified', 'verification');
        await tx.wait();
        console.log(`[SIWA] ✓ Auto-granted siwa-verified to #${tokenId} (tx: ${tx.hash})`);
    } catch (e) {
        siwaGrantedSet.delete(tokenId);
        console.error(`[SIWA] Auto-grant failed for #${tokenId}: ${e.message.slice(0, 100)}`);
    }
}

async function addVerificationTrait(tokenId, traitName) {
    try {
        const tx = await contract.addTrait(tokenId, traitName, 'verification');
        await tx.wait();
        console.log(`[VERIFY] ✓ Trait "${traitName}" added to #${tokenId} (tx: ${tx.hash})`);
        return tx.hash;
    } catch (e) {
        console.error(`[VERIFY] Trait "${traitName}" failed for #${tokenId}: ${e.message}`);
        throw e;
    }
}

// GET /api/v2/agent/:id/verifications — Check social verification status
app.get('/api/v2/agent/:id/verifications', async (req, res) => {
    const tokenId = req.params.id;
    const v = verifications[tokenId] || {};
    res.json({
        tokenId: parseInt(tokenId),
        x: v.x || null,
        github: v.github || null,
        farcaster: v.farcaster || null,
    });
});

// POST /api/v2/agent/:id/verify/x — Verify X/Twitter account
app.post('/api/v2/agent/:id/verify/x', requireSIWA, async (req, res) => {
    const tokenId = parseInt(req.params.id);
    const { handle } = req.body;

    if (!handle || typeof handle !== 'string') {
        return res.status(400).json({ error: 'handle required (X/Twitter username)' });
    }

    if (!isContractDeployed()) return res.status(503).json({ error: 'V2 contract not yet deployed' });

    try {
        if (!(await requireAgentAuth(req, res, tokenId))) return;

        // Check duplicate
        if (verifications[tokenId]?.x) {
            return res.status(409).json({ error: 'X/Twitter already verified', existing: verifications[tokenId].x });
        }

        // Fetch bio via X API v2 (primary) with syndication fallback
        const cleanHandle = handle.replace(/^@/, '').trim();
        const pattern = `helixa:${tokenId}`;
        let found = false;
        try {
            // Primary: X API v2 with bearer token
            const X_BEARER = process.env.X_BEARER_TOKEN || '';
            if (X_BEARER) {
                const xResp = await fetch(`https://api.x.com/2/users/by/username/${cleanHandle}?user.fields=description`, {
                    headers: { 'Authorization': `Bearer ${X_BEARER}` },
                });
                if (xResp.ok) {
                    const xData = await xResp.json();
                    const bio = xData?.data?.description || '';
                    if (bio.includes(pattern)) found = true;
                }
            }
            // Fallback: syndication scraper
            if (!found) {
                const resp = await fetch(`https://syndication.twitter.com/srv/timeline-profile/screen-name/${cleanHandle}`, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HelixaBot/1.0)' },
                });
                const html = await resp.text();
                if (html.includes(pattern)) found = true;
            }
            if (!found) {
                return res.status(422).json({
                    error: 'Verification string not found in X profile',
                    expected: pattern,
                    hint: `Add "${pattern}" to your X/Twitter bio, then retry`,
                });
            }
        } catch (e) {
            return res.status(502).json({ error: 'Failed to fetch X profile', detail: e.message.slice(0, 200) });
        }

        // Add trait onchain
        const txHash = await addVerificationTrait(tokenId, 'x-verified');

        // Store verification
        if (!verifications[tokenId]) verifications[tokenId] = {};
        verifications[tokenId].x = {
            handle: cleanHandle,
            verifiedAt: new Date().toISOString(),
            txHash,
        };
        saveVerifications();

        res.json({
            success: true,
            tokenId,
            platform: 'x',
            handle: cleanHandle,
            trait: 'x-verified',
            txHash,
            explorer: `https://basescan.org/tx/${txHash}`,
        });
    } catch (e) {
        console.error(`[VERIFY X] Error for #${tokenId}:`, e.message);
        res.status(500).json({ error: 'X verification failed: ' + e.message.slice(0, 200) });
    }
});

// POST /api/v2/agent/:id/verify/github — Verify GitHub account
app.post('/api/v2/agent/:id/verify/github', requireSIWA, async (req, res) => {
    const tokenId = parseInt(req.params.id);
    const { username } = req.body;

    if (!username || typeof username !== 'string') {
        return res.status(400).json({ error: 'username required (GitHub username)' });
    }

    if (!isContractDeployed()) return res.status(503).json({ error: 'V2 contract not yet deployed' });

    try {
        if (!(await requireAgentAuth(req, res, tokenId))) return;

        if (verifications[tokenId]?.github) {
            return res.status(409).json({ error: 'GitHub already verified', existing: verifications[tokenId].github });
        }

        // Fetch public gists
        const cleanUser = username.trim();
        const gistsResp = await fetch(`https://api.github.com/users/${encodeURIComponent(cleanUser)}/gists?per_page=30`, {
            headers: { 'User-Agent': 'HelixaBot/1.0', 'Accept': 'application/vnd.github.v3+json' },
        });

        if (!gistsResp.ok) {
            return res.status(502).json({ error: 'Failed to fetch GitHub gists', status: gistsResp.status });
        }

        const gists = await gistsResp.json();
        let found = false;

        for (const gist of gists) {
            if (gist.files && gist.files['helixa-verify.txt']) {
                // Fetch the raw content
                const rawUrl = gist.files['helixa-verify.txt'].raw_url;
                const rawResp = await fetch(rawUrl);
                const content = (await rawResp.text()).trim();
                if (content === String(tokenId) || content === `helixa:${tokenId}`) {
                    found = true;
                    break;
                }
            }
        }

        if (!found) {
            return res.status(422).json({
                error: 'Verification gist not found',
                hint: `Create a public gist with filename "helixa-verify.txt" containing "${tokenId}" or "helixa:${tokenId}"`,
            });
        }

        const txHash = await addVerificationTrait(tokenId, 'github-verified');

        if (!verifications[tokenId]) verifications[tokenId] = {};
        verifications[tokenId].github = {
            username: cleanUser,
            verifiedAt: new Date().toISOString(),
            txHash,
        };
        saveVerifications();

        res.json({
            success: true,
            tokenId,
            platform: 'github',
            username: cleanUser,
            trait: 'github-verified',
            txHash,
            explorer: `https://basescan.org/tx/${txHash}`,
        });
    } catch (e) {
        console.error(`[VERIFY GITHUB] Error for #${tokenId}:`, e.message);
        res.status(500).json({ error: 'GitHub verification failed: ' + e.message.slice(0, 200) });
    }
});

// POST /api/v2/agent/:id/verify/farcaster — Verify Farcaster account
app.post('/api/v2/agent/:id/verify/farcaster', requireSIWA, async (req, res) => {
    const tokenId = parseInt(req.params.id);
    const { username, fid } = req.body;

    if (!username && !fid) {
        return res.status(400).json({ error: 'username or fid required (Farcaster identity)' });
    }

    if (!isContractDeployed()) return res.status(503).json({ error: 'V2 contract not yet deployed' });

    try {
        if (!(await requireAgentAuth(req, res, tokenId))) return;

        if (verifications[tokenId]?.farcaster) {
            return res.status(409).json({ error: 'Farcaster already verified', existing: verifications[tokenId].farcaster });
        }

        const pattern = `helixa:${tokenId}`;
        let found = false;
        let resolvedUsername = username;

        // Search via Warpcast public API (Searchcaster / Neynar hub)
        // Try Neynar public hub first, then Searchcaster
        const searchTarget = fid || username;
        const searchUrl = fid
            ? `https://api.neynar.com/v2/farcaster/feed?feed_type=filter&filter_type=fids&fids=${fid}&limit=50`
            : `https://api.neynar.com/v2/farcaster/feed/user/${encodeURIComponent(username)}/casts?limit=50`;

        // Try Warpcast public search as primary (no API key needed)
        try {
            const wcResp = await fetch(`https://client.warpcast.com/v2/search-casts?q=${encodeURIComponent(pattern)}&limit=20`, {
                headers: { 'User-Agent': 'HelixaBot/1.0' },
            });
            if (wcResp.ok) {
                const wcData = await wcResp.json();
                const casts = wcData.result?.casts || [];
                for (const cast of casts) {
                    const castUser = cast.author?.username?.toLowerCase();
                    const castFid = cast.author?.fid;
                    if ((username && castUser === username.toLowerCase()) || (fid && castFid === Number(fid))) {
                        if (cast.text?.includes(pattern)) {
                            found = true;
                            resolvedUsername = cast.author?.username || username;
                            break;
                        }
                    }
                }
            }
        } catch {}

        // Fallback: Searchcaster
        if (!found) {
            try {
                const scResp = await fetch(`https://searchcaster.xyz/api/search?text=${encodeURIComponent(pattern)}&count=20`);
                if (scResp.ok) {
                    const scData = await scResp.json();
                    const casts = scData.casts || scData || [];
                    for (const cast of (Array.isArray(casts) ? casts : [])) {
                        const castUser = (cast.body?.username || cast.username || '').toLowerCase();
                        const castFid = cast.body?.publishedBy || cast.meta?.fid;
                        if ((username && castUser === username.toLowerCase()) || (fid && String(castFid) === String(fid))) {
                            if ((cast.body?.data?.text || cast.text || '').includes(pattern)) {
                                found = true;
                                resolvedUsername = castUser || username;
                                break;
                            }
                        }
                    }
                }
            } catch {}
        }

        if (!found) {
            return res.status(422).json({
                error: 'Verification cast not found',
                expected: pattern,
                hint: `Post a cast containing "${pattern}" from your Farcaster account, then retry`,
            });
        }

        const txHash = await addVerificationTrait(tokenId, 'farcaster-verified');

        if (!verifications[tokenId]) verifications[tokenId] = {};
        verifications[tokenId].farcaster = {
            username: resolvedUsername,
            fid: fid || null,
            verifiedAt: new Date().toISOString(),
            txHash,
        };
        saveVerifications();

        res.json({
            success: true,
            tokenId,
            platform: 'farcaster',
            username: resolvedUsername,
            trait: 'farcaster-verified',
            txHash,
            explorer: `https://basescan.org/tx/${txHash}`,
        });
    } catch (e) {
        console.error(`[VERIFY FARCASTER] Error for #${tokenId}:`, e.message);
        res.status(500).json({ error: 'Farcaster verification failed: ' + e.message.slice(0, 200) });
    }
});

// ─── Linked Token ───────────────────────────────────────────────

// POST /api/v2/agent/:id/link-token — Associate a token contract with an agent
app.post('/api/v2/agent/:id/link-token', requireSIWA, async (req, res) => {
    const tokenId = parseInt(req.params.id);
    const { contractAddress, chain, symbol, name } = req.body;

    if (!contractAddress || !/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
        return res.status(400).json({ error: 'Valid contractAddress required (0x... 40 hex chars)' });
    }
    if (!chain || typeof chain !== 'string') return res.status(400).json({ error: 'chain required (e.g. "base")' });
    if (!symbol || typeof symbol !== 'string') return res.status(400).json({ error: 'symbol required (e.g. "$CRED")' });
    if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name required (e.g. "Cred Token")' });

    if (!isContractDeployed()) return res.status(503).json({ error: 'V2 contract not yet deployed' });

    try {
        if (!(await requireAgentAuth(req, res, tokenId))) return;

        // Store as traits: name=key, category=value
        const traitsToSet = [
            ['linked-token', contractAddress.toLowerCase()],
            ['linked-token-chain', chain.trim().toLowerCase()],
            ['linked-token-symbol', symbol.trim()],
            ['linked-token-name', name.trim()],
        ];

        const txHashes = [];
        for (const [tName, tValue] of traitsToSet) {
            const tx = await contract.addTrait(tokenId, tName, tValue);
            await tx.wait();
            txHashes.push(tx.hash);
            console.log(`[LINK-TOKEN] ✓ Set ${tName}=${tValue} on #${tokenId}`);
        }

        res.json({
            success: true,
            tokenId,
            linkedToken: {
                contractAddress: contractAddress.toLowerCase(),
                chain: chain.trim().toLowerCase(),
                symbol: symbol.trim(),
                name: name.trim(),
            },
            txHashes,
            explorer: `https://basescan.org/token/${contractAddress}`,
        });
    } catch (e) {
        console.error(`[LINK-TOKEN] Error for #${tokenId}:`, e.message);
        res.status(500).json({ error: 'Link token failed: ' + e.message.slice(0, 200) });
    }
});

// ─── Onchain Data Report ────────────────────────────────────────

const reportCache = {}; // tokenId → { data, cachedAt }
const REPORT_CACHE_TTL = 60_000; // 60 seconds

// GET /api/v2/agent/:id/report — Aggregated onchain data report
app.get('/api/v2/agent/:id/report', async (req, res) => {
    const tokenId = parseInt(req.params.id);

    // Check cache
    const cached = reportCache[tokenId];
    if (cached && Date.now() - cached.cachedAt < REPORT_CACHE_TTL) {
        return res.json({ ...cached.data, cached: true, cachedAt: new Date(cached.cachedAt).toISOString() });
    }

    try {
        const agent = await formatAgentV2(tokenId);
        const walletAddress = agent.agentAddress;

        // Fetch balances in parallel
        const safe = (p) => p.catch(() => null);
        const usdcRead = new ethers.Contract(USDC_ADDRESS, USDC_ABI, readProvider);

        const [ethBalance, usdcBalance] = await Promise.all([
            safe(readProvider.getBalance(walletAddress)),
            safe(usdcRead.balanceOf(walletAddress)),
        ]);

        // Linked token balance
        let linkedTokenBalance = null;
        if (agent.linkedToken?.contractAddress) {
            try {
                const tokenContract = new ethers.Contract(agent.linkedToken.contractAddress, ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'], readProvider);
                const [bal, dec] = await Promise.all([tokenContract.balanceOf(walletAddress), safe(tokenContract.decimals())]);
                linkedTokenBalance = {
                    ...agent.linkedToken,
                    raw: bal?.toString() || '0',
                    formatted: bal ? ethers.formatUnits(bal, dec || 18) : '0',
                    decimals: dec ? Number(dec) : 18,
                };
            } catch {}
        }

        // Recent transactions from BaseScan API (best-effort)
        let recentTxs = [];
        try {
            const bsResp = await fetch(`https://api.basescan.org/api?module=account&action=txlist&address=${walletAddress}&startblock=0&endblock=99999999&page=1&offset=10&sort=desc&apikey=YourApiKeyToken`, { signal: AbortSignal.timeout(5000) });
            if (bsResp.ok) {
                const bsData = await bsResp.json();
                if (bsData.status === '1' && Array.isArray(bsData.result)) {
                    recentTxs = bsData.result.map(tx => ({
                        hash: tx.hash,
                        from: tx.from,
                        to: tx.to,
                        value: ethers.formatEther(tx.value || '0'),
                        timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
                        method: tx.functionName?.split('(')[0] || (tx.input === '0x' ? 'transfer' : 'contract call'),
                        isError: tx.isError === '1',
                    }));
                }
            }
        } catch {}

        // Verification status
        const v = verifications[tokenId] || {};
        const verificationTraits = (agent.traits || []).filter(t => t.category === 'verification').map(t => t.name);

        // Cred score breakdown
        const credBreakdown = {
            total: agent.credScore,
            tier: agent.credScore >= 91 ? 'Preferred' : agent.credScore >= 76 ? 'Prime' : agent.credScore >= 51 ? 'Qualified' : agent.credScore >= 26 ? 'Marginal' : 'Junk',
            verified: agent.verified,
            hasPersonality: !!agent.personality,
            hasNarrative: !!(agent.narrative?.origin || agent.narrative?.mission),
            traitCount: agent.traits?.length || 0,
            points: agent.points,
            soulbound: agent.soulbound,
        };

        // Ranking
        let rank = null;
        if (agentCache.agents.length > 0) {
            const sorted = [...agentCache.agents].sort((a, b) => b.credScore - a.credScore);
            const idx = sorted.findIndex(a => a.tokenId === tokenId);
            if (idx >= 0) rank = idx + 1;
        }

        const report = {
            tokenId,
            name: agent.name,
            walletAddress,
            owner: agent.owner,
            balances: {
                eth: ethBalance ? ethers.formatEther(ethBalance) : '0',
                ethRaw: ethBalance?.toString() || '0',
                usdc: usdcBalance ? ethers.formatUnits(usdcBalance, 6) : '0',
                usdcRaw: usdcBalance?.toString() || '0',
                linkedToken: linkedTokenBalance,
            },
            recentTransactions: recentTxs,
            credScore: credBreakdown,
            verifications: {
                siwa: verificationTraits.includes('siwa-verified'),
                x: v.x ? { verified: true, handle: v.x.handle } : { verified: false },
                github: v.github ? { verified: true, username: v.github.username } : { verified: false },
                farcaster: v.farcaster ? { verified: true, username: v.farcaster.username } : { verified: false },
            },
            points: agent.points,
            rank,
            totalAgents: agentCache.total,
            ethosScore: agent.ethosScore,
            explorer: `https://basescan.org/address/${walletAddress}`,
        };

        reportCache[tokenId] = { data: report, cachedAt: Date.now() };
        res.json(report);
    } catch (e) {
        console.error(`[REPORT] Error for #${tokenId}:`, e.message);
        res.status(500).json({ error: 'Report failed: ' + e.message.slice(0, 200) });
    }
});

// ═══════════════════════════════════════════════════════════════
// Messaging — Cred-Gated Group Chat
// ═══════════════════════════════════════════════════════════════

const messaging = require('./messaging-service');
messaging.init();

// Helper: find agent by address from indexer
function findAgentByAddress(address) {
    const all = indexer.getAllAgents();
    return all.find(a => a.agentAddress && a.agentAddress.toLowerCase() === address.toLowerCase());
}

// List all groups
app.get('/api/v2/messages/groups', (req, res) => {
    res.json({ groups: messaging.listGroups() });
});

// Get messages from a group (agents only — requires SIWA auth)
app.get('/api/v2/messages/groups/:groupId/messages', (req, res) => {
    const group = messaging.getGroup(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    // Private groups require SIWA auth
    if (!group.isPublic) {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(403).json({ error: 'Agents only. Authenticate via SIWA to access messages.' });
        }
    }
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const before = req.query.before || null;
    const messages = messaging.getMessages(req.params.groupId, { limit, before });
    res.json({ group: { id: group.id, topic: group.topic, minCred: group.minCred }, messages });
});

// Send message to group (requires SIWA + Cred gate)
app.post('/api/v2/messages/groups/:groupId/send', requireSIWA, (req, res) => {
    try {
        const group = messaging.getGroup(req.params.groupId);
        if (!group) return res.status(404).json({ error: 'Group not found' });

        const agent = findAgentByAddress(req.agent.address);
        if (!agent) return res.status(403).json({ error: 'No Helixa agent found for this wallet' });

        const gate = messaging.checkCredGate(agent.credScore || 0, group);
        if (!gate.allowed) return res.status(403).json({ error: gate.error });

        const msg = messaging.sendMessage(req.params.groupId, {
            senderAddress: req.agent.address,
            senderName: agent.name || req.agent.address.slice(0, 8),
            content: req.body.content,
        });
        res.json({ message: msg });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// Join a group (requires SIWA + Cred gate)
app.post('/api/v2/messages/groups/:groupId/join', requireSIWA, (req, res) => {
    try {
        const group = messaging.getGroup(req.params.groupId);
        if (!group) return res.status(404).json({ error: 'Group not found' });

        const agent = findAgentByAddress(req.agent.address);
        if (!agent) return res.status(403).json({ error: 'No Helixa agent found for this wallet' });

        const gate = messaging.checkCredGate(agent.credScore || 0, group);
        if (!gate.allowed) return res.status(403).json({ error: gate.error });

        messaging.joinGroup(req.params.groupId, req.agent.address);
        res.json({ success: true, group: { id: group.id, topic: group.topic } });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// Create a new group (requires SIWA + Qualified Cred 51+)
app.post('/api/v2/messages/groups', requireSIWA, (req, res) => {
    try {
        const agent = findAgentByAddress(req.agent.address);
        if (!agent) return res.status(403).json({ error: 'No Helixa agent found for this wallet' });
        if ((agent.credScore || 0) < 51) {
            return res.status(403).json({ error: `Requires Qualified (51+) Cred to create groups. Your Cred: ${Math.round(agent.credScore || 0)}` });
        }

        const group = messaging.createGroup({
            topic: req.body.topic,
            description: req.body.description,
            minCred: req.body.minCred || 0,
            isPublic: req.body.isPublic !== false,
            createdBy: req.agent.address,
        });
        res.json({ group });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// ═══════════════════════════════════════════════════════════════
// Cred Score & Cred Report Endpoints
// ═══════════════════════════════════════════════════════════════

const CRED_WEIGHTS = {
    activity: { weight: 0.25, label: 'Onchain Activity', description: 'Transactions, contract deploys, protocol interactions' },
    external: { weight: 0.15, label: 'External Activity', description: 'GitHub commits, task completions, integrations' },
    verify: { weight: 0.15, label: 'Verification Status', description: 'SIWA, X, GitHub, Farcaster verifications' },
    coinbase: { weight: 0.05, label: 'Institutional Verification', description: 'EAS attestations from recognized issuers (Coinbase, etc.)' },
    age: { weight: 0.10, label: 'Account Age', description: 'Days since mint' },
    traits: { weight: 0.10, label: 'Trait Richness', description: 'Number and variety of traits' },
    narrative: { weight: 0.05, label: 'Narrative Completeness', description: 'Origin, mission, lore, manifesto fields' },
    origin: { weight: 0.10, label: 'Mint Origin', description: 'How the agent was minted (SIWA > API > Owner)' },
    soulbound: { weight: 0.05, label: 'Soulbound Status', description: 'Identity locked to wallet (non-transferable)' },
};

function computeCredBreakdown(agent) {
    const traits = agent.traits || [];
    const personality = agent.personality || {};
    const narrative = agent.narrative || {};
    const mintDate = agent.mintedAt ? new Date(agent.mintedAt) : null;
    const ageDays = mintDate ? Math.floor((Date.now() - mintDate.getTime()) / 86400000) : 0;

    const hasVerif = (name) => traits.some(t => t.name === name);
    const verifCount = ['siwa-verified', 'x-verified', 'github-verified', 'farcaster-verified', 'coinbase-verified']
        .filter(v => hasVerif(v)).length;

    const narrativeFields = [narrative.origin, narrative.mission, narrative.lore, narrative.manifesto].filter(Boolean);

    // External activity: GitHub commits, task completions, integrations
    const externalSignals = [
        hasVerif('github-verified'),  // has linked GitHub
        hasVerif('x-verified'),       // has linked X
        hasVerif('farcaster-verified'), // has linked Farcaster
        (agent.externalActivity || 0) > 0, // task completions, API usage
    ].filter(Boolean).length;

    const components = {
        activity: { raw: Math.min(100, (agent.points || 0) * 2), maxRaw: 100 },
        external: { raw: Math.min(100, externalSignals * 25 + (agent.externalActivity || 0) * 5), maxRaw: 100 },
        verify: { raw: Math.min(100, verifCount * 25), maxRaw: 100 },
        coinbase: { raw: hasVerif('coinbase-verified') ? 100 : 0, maxRaw: 100 },
        age: { raw: Math.min(100, ageDays * 5), maxRaw: 100 },
        traits: { raw: Math.min(100, traits.length * 12), maxRaw: 100 },
        narrative: { raw: Math.min(100, narrativeFields.length * 25), maxRaw: 100 },
        origin: { raw: agent.mintOrigin === 'AGENT_SIWA' ? 100 : agent.mintOrigin === 'API' ? 70 : agent.mintOrigin === 'HUMAN' ? 80 : 50, maxRaw: 100 },
        soulbound: { raw: agent.soulbound ? 100 : 0, maxRaw: 100 },
    };

    let totalWeighted = 0;
    const breakdown = {};
    for (const [key, meta] of Object.entries(CRED_WEIGHTS)) {
        const comp = components[key];
        const weighted = comp.raw * meta.weight;
        totalWeighted += weighted;
        breakdown[key] = {
            label: meta.label,
            description: meta.description,
            weight: meta.weight,
            rawScore: Math.round(comp.raw),
            weightedScore: Math.round(weighted * 10) / 10,
            maxWeightedScore: Math.round(100 * meta.weight * 10) / 10,
        };
    }

    return { components: breakdown, computedScore: Math.round(totalWeighted) };
}

function getCredTier(score) {
    if (score >= 91) return { tier: 'PREFERRED', label: 'Preferred', color: '#b490ff' };
    if (score >= 76) return { tier: 'PRIME', label: 'Prime', color: '#33ff33' };
    if (score >= 51) return { tier: 'QUALIFIED', label: 'Qualified', color: '#ffd93d' };
    if (score >= 26) return { tier: 'MARGINAL', label: 'Marginal', color: '#ffaa00' };
    return { tier: 'JUNK', label: 'Junk', color: '#ff4444' };
}

function getCredRecommendations(agent, breakdown) {
    const recs = [];
    const traits = agent.traits || [];
    const hasVerif = (name) => traits.some(t => t.name === name);

    if (!hasVerif('siwa-verified')) recs.push({ action: 'Verify via SIWA', impact: '+3-4 points', priority: 'HIGH', endpoint: `POST /api/v2/agent/${agent.tokenId}/verify` });
    if (!hasVerif('x-verified')) recs.push({ action: 'Link X/Twitter account', impact: '+3-4 points', priority: 'MEDIUM', endpoint: `POST /api/v2/agent/${agent.tokenId}/verify/x` });
    if (!hasVerif('github-verified')) recs.push({ action: 'Link GitHub account', impact: '+3-4 points', priority: 'MEDIUM', endpoint: `POST /api/v2/agent/${agent.tokenId}/verify/github` });
    if (!hasVerif('coinbase-verified')) recs.push({ action: 'Get Institutional Verification (Coinbase EAS)', impact: '+5 points', priority: 'MEDIUM', endpoint: `POST /api/v2/agent/${agent.tokenId}/coinbase-verify` });
    if (!agent.soulbound) recs.push({ action: 'Make identity soulbound', impact: '+5 points', priority: 'LOW' });

    const narrative = agent.narrative || {};
    if (!narrative.origin) recs.push({ action: 'Add origin story', impact: '+2-3 points', priority: 'MEDIUM' });
    if (!narrative.mission) recs.push({ action: 'Add mission statement', impact: '+2-3 points', priority: 'MEDIUM' });
    if (!narrative.lore) recs.push({ action: 'Add lore', impact: '+2-3 points', priority: 'LOW' });

    return recs.slice(0, 8);
}

// FREE: Basic cred score + tier
app.get('/api/v2/agent/:id/cred', async (req, res) => {
    try {
        const tokenId = parseInt(req.params.id);
        const agent = await formatAgentV2(tokenId);
        const tierInfo = getCredTier(agent.credScore);

        res.json({
            tokenId,
            name: agent.name,
            credScore: agent.credScore,
            tier: tierInfo.tier,
            tierLabel: tierInfo.label,
            scale: { junk: '0-25', marginal: '26-50', qualified: '51-75', prime: '76-90', preferred: '91-100' },
            fullReportEndpoint: `/api/v2/agent/${tokenId}/cred-report`,
            fullReportPrice: `$${PRICING.credReport} USDC`,
            hint: 'Full report with breakdown, recommendations, and signed receipt available via x402 payment.',
        });
    } catch (e) {
        res.status(404).json({ error: 'Agent not found', detail: e.message });
    }
});

// PAID: Full Cred Report ($1 USDC via x402)
app.get('/api/v2/agent/:id/cred-report', async (req, res) => {
    try {
        const tokenId = parseInt(req.params.id);
        const agent = await formatAgentV2(tokenId);
        const tierInfo = getCredTier(agent.credScore);
        const { components, computedScore } = computeCredBreakdown(agent);
        const recommendations = getCredRecommendations(agent, components);

        // Ranking
        let rank = null, totalAgents = 0;
        try {
            const allAgents = indexer.getAllAgents();
            totalAgents = allAgents.length;
            const sorted = [...allAgents].sort((a, b) => (b.credScore || 0) - (a.credScore || 0));
            const idx = sorted.findIndex(a => a.tokenId === tokenId);
            if (idx >= 0) rank = idx + 1;
        } catch {}

        // Verification details
        const traits = agent.traits || [];
        const hasVerif = (name) => traits.some(t => t.name === name);
        const verificationStatus = {
            siwa: hasVerif('siwa-verified'),
            x: hasVerif('x-verified'),
            github: hasVerif('github-verified'),
            farcaster: hasVerif('farcaster-verified'),
            coinbase: hasVerif('coinbase-verified'),
            total: ['siwa-verified', 'x-verified', 'github-verified', 'farcaster-verified', 'coinbase-verified'].filter(v => hasVerif(v)).length,
            max: 5,
        };

        // Generate signed receipt
        const reportId = crypto.randomBytes(16).toString('hex');
        const reportTimestamp = new Date().toISOString();
        const receiptPayload = JSON.stringify({
            reportId,
            tokenId,
            agentName: agent.name,
            credScore: agent.credScore,
            tier: tierInfo.tier,
            generatedAt: reportTimestamp,
            paidAmount: `$${PRICING.credReport} USDC`,
            network: 'eip155:8453',
        });
        const receiptSignature = crypto.createHmac('sha256', process.env.RECEIPT_HMAC_SECRET || DEPLOYER_KEY.slice(0, 32))
            .update(receiptPayload).digest('hex');

        // Ethos score
        let ethosScore = agent.ethosScore || null;

        // Narrative analysis
        const narrative = agent.narrative || {};
        const narrativeFields = ['origin', 'mission', 'lore', 'manifesto'];
        const narrativeAnalysis = {};
        for (const f of narrativeFields) {
            narrativeAnalysis[f] = {
                present: !!narrative[f],
                length: narrative[f] ? narrative[f].length : 0,
            };
        }
        const narrativeCompleteness = narrativeFields.filter(f => !!narrative[f]).length;

        // Mint age
        const mintDate = agent.mintedAt ? new Date(agent.mintedAt) : null;
        const ageDays = mintDate ? Math.floor((Date.now() - mintDate.getTime()) / 86400000) : 0;

        const report = {
            reportId,
            generatedAt: reportTimestamp,
            paidReport: true,
            price: `$${PRICING.credReport} USDC`,

            // Agent identity
            agent: {
                tokenId,
                name: agent.name,
                framework: agent.framework,
                owner: agent.owner,
                agentAddress: agent.agentAddress,
                mintOrigin: agent.mintOrigin,
                mintedAt: agent.mintedAt,
                ageDays,
                soulbound: agent.soulbound,
                verified: agent.verified,
                generation: agent.generation,
                version: agent.version,
                mutationCount: agent.mutationCount,
                points: agent.points,
            },

            // Cred score
            credScore: {
                score: agent.credScore,
                computedScore,
                tier: tierInfo.tier,
                tierLabel: tierInfo.label,
                rank,
                totalAgents,
                percentile: rank && totalAgents ? Math.round((1 - rank / totalAgents) * 100) : null,
            },

            // Full breakdown with weights
            scoreBreakdown: components,
            totalWeight: Object.values(CRED_WEIGHTS).reduce((s, w) => s + w.weight, 0),

            // Verification details
            verifications: verificationStatus,

            // Narrative analysis
            narrativeAnalysis: {
                completeness: `${narrativeCompleteness}/4`,
                fields: narrativeAnalysis,
            },

            // Personality snapshot
            personality: agent.personality,

            // External scores
            externalScores: {
                ethos: ethosScore,
                talentProtocol: agent.talentScore || null,
            },

            // Actionable recommendations
            recommendations,

            // Tier scale reference
            tierScale: [
                { tier: 'JUNK', range: '0-25', description: 'High risk — minimal onchain presence' },
                { tier: 'MARGINAL', range: '26-50', description: 'Some activity but unverified' },
                { tier: 'QUALIFIED', range: '51-75', description: 'Trustworthy agent with solid credentials' },
                { tier: 'PRIME', range: '76-90', description: 'Top-tier agent with comprehensive presence' },
                { tier: 'PREFERRED', range: '91-100', description: 'Elite, fully verified, deeply established' },
            ],

            // Signed receipt (proof of payment)
            receipt: {
                reportId,
                payload: receiptPayload,
                signature: receiptSignature,
                algorithm: 'HMAC-SHA256',
                verifyEndpoint: '/api/v2/cred-report/verify-receipt',
            },

            explorer: `https://basescan.org/token/${V2_CONTRACT_ADDRESS}?a=${tokenId}`,
        };

        console.log(`[CRED REPORT] Paid report generated for Agent #${tokenId} (score: ${agent.credScore}, tier: ${tierInfo.tier})`);
        res.json(report);
    } catch (e) {
        console.error(`[CRED REPORT] Error for #${req.params.id}:`, e.message);
        res.status(404).json({ error: 'Agent not found', detail: e.message });
    }
});

// Receipt verification endpoint (free)
app.post('/api/v2/cred-report/verify-receipt', (req, res) => {
    const { payload, signature } = req.body;
    if (!payload || !signature) {
        return res.status(400).json({ error: 'payload and signature required' });
    }
    const expected = crypto.createHmac('sha256', process.env.RECEIPT_HMAC_SECRET || DEPLOYER_KEY.slice(0, 32))
        .update(payload).digest('hex');
    const valid = expected === signature;
    let parsed = null;
    try { parsed = JSON.parse(payload); } catch {}
    res.json({ valid, report: parsed });
});

// ─── Error Handler ──────────────────────────────────────────────

app.use((err, req, res, next) => {
    const errId = crypto.randomBytes(4).toString('hex');
    console.error(`[V2 ERROR ${errId}]`, err.message || err);
    res.status(500).json({ error: 'Internal server error', errorId: errId });
});


// ─── Token Stats (cached holder count from Blockscout transfers) ────────────
let cachedTokenStats = { holders: 0, updatedAt: 0 };

async function updateHolderCount() {
    try {
        const addrs = new Set();
        let url = `https://base.blockscout.com/api/v2/tokens/0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3/transfers`;
        for (let i = 0; i < 400; i++) {
            const r = await fetch(url);
            const d = await r.json();
            for (const t of (d.items || [])) {
                if (t.to?.hash) addrs.add(t.to.hash);
                if (t.from?.hash) addrs.add(t.from.hash);
            }
            const npp = d.next_page_params;
            if (!npp) break;
            url = `https://base.blockscout.com/api/v2/tokens/0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3/transfers?` + new URLSearchParams(npp);
            await new Promise(r => setTimeout(r, 300));
        }
        addrs.delete('0x0000000000000000000000000000000000000000');
        cachedTokenStats = { holders: addrs.size, updatedAt: Date.now() };
        console.log(`📊 Token holder count updated: ${addrs.size}`);
    } catch(e) { console.error('Holder count update failed:', e.message); }
}

// Update every 30 min, initial after 5s
setTimeout(updateHolderCount, 5000);
setInterval(updateHolderCount, 30 * 60 * 1000);

app.get('/api/v2/token/stats', (req, res) => {
    res.json(cachedTokenStats);
});


// ─── Trust Terminal API ──────────────────────────────────────
const terminalDbPath = path.join(__dirname, '..', '..', 'terminal', 'data', 'terminal.db');
let terminalDb = null;
try {
    const Database = require('better-sqlite3');
    if (fs.existsSync(terminalDbPath)) {
        terminalDb = new Database(terminalDbPath, { readonly: true });
        terminalDb.pragma('journal_mode = WAL');
        console.log('📡 Trust Terminal DB connected');
    }
} catch (e) { console.warn('⚠️ Trust Terminal DB not available:', e.message); }

app.get('/api/terminal/agents', (req, res) => {
    if (!terminalDb) return res.status(503).json({ error: 'Terminal DB not available' });
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
        const sort = ['cred_score','name','created_at','platform','token_market_cap','price_change_24h','volume_24h','liquidity_usd','revenue_onchain','revenue_self_reported'].includes(req.query.sort) ? req.query.sort : 'cred_score';
        const dir = req.query.dir === 'asc' ? 'ASC' : 'DESC';
        const filter = req.query.filter || 'all';
        const q = (req.query.q || '').trim();

        let where = [];
        let params = {};
        let orderBy = `${sort} ${dir} NULLS LAST`;
        
        // userSort = true when client explicitly chose a sort column
        const userSort = req.query.sort && req.query.sort !== 'cred_score';
        if (filter === 'x402') { where.push('x402_supported = 1'); }
        else if (filter === 'new') {
            if (!userSort) orderBy = 'created_at DESC NULLS LAST';
        }
        else if (filter === 'trending') {
            where.push('token_symbol IS NOT NULL');
            if (!userSort) orderBy = 'volume_24h DESC NULLS LAST';
        }
        else if (filter === 'gainers') {
            where.push('token_symbol IS NOT NULL AND price_change_24h > 0');
            if (!userSort) orderBy = 'price_change_24h DESC NULLS LAST';
        }
        else if (filter === 'losers') {
            where.push('token_symbol IS NOT NULL AND price_change_24h < 0');
            orderBy = 'price_change_24h ASC NULLS LAST';
        }
        else if (filter !== 'all') { where.push('cred_tier = @tier'); params.tier = filter; }
        if (q) {
            where.push("(name LIKE @q OR address LIKE @q OR agent_id LIKE @q)");
            params.q = `%${q}%`;
        }
        const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

        const total = terminalDb.prepare(`SELECT COUNT(*) as c FROM agents ${whereClause}`).get(params).c;
        const totalPages = Math.ceil(total / limit);
        const offset = (page - 1) * limit;

        const agents = terminalDb.prepare(
            `SELECT id, address, agent_id, token_id, name, description, image_url, platform, 
                    x402_supported, cred_score, cred_tier, created_at, owner_address, reputation_score,
                    token_address, token_symbol, token_name, token_market_cap,
                    price_change_24h, volume_24h, liquidity_usd,
                    revenue_onchain, revenue_self_reported, client_count, revenue_sources
             FROM agents ${whereClause} 
             ORDER BY ${orderBy}
             LIMIT @limit OFFSET @offset`
        ).all({ ...params, limit, offset });

        const stats = {
            total: terminalDb.prepare('SELECT COUNT(*) as c FROM agents').get().c,
            scored: terminalDb.prepare('SELECT COUNT(*) as c FROM agents WHERE last_scored IS NOT NULL').get().c,
            avgScore: terminalDb.prepare('SELECT ROUND(AVG(cred_score),1) as v FROM agents').get().v,
            x402: terminalDb.prepare('SELECT COUNT(*) as c FROM agents WHERE x402_supported = 1').get().c,
        };

        res.json({ agents, total, page, totalPages, stats });
    } catch (e) {
        console.error('Terminal query error:', e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/terminal/agent/:address', (req, res) => {
    if (!terminalDb) return res.status(503).json({ error: 'Terminal DB not available' });
    try {
        const id = req.params.address;
        let agent = terminalDb.prepare('SELECT * FROM agents WHERE address = ? OR agent_id = ? OR token_id = ? OR CAST(id AS TEXT) = ?')
            .get(id, id, id, id);
        if (!agent) {
            // Try name match (case-insensitive)
            agent = terminalDb.prepare('SELECT * FROM agents WHERE LOWER(name) = LOWER(?)').get(id);
        }
        if (!agent) return res.status(404).json({ error: 'Agent not found' });
        res.json(agent);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/terminal/agent/:id/token — Link a token to an agent
app.post('/api/terminal/agent/:id/token', express.json(), (req, res) => {
    try {
        const { token_address, token_symbol, token_name, token_market_cap } = req.body;
        if (!token_address || !token_symbol) return res.status(400).json({ error: 'token_address and token_symbol required' });
        const id = req.params.id;
        const Database = require('better-sqlite3');
        const wdb = new Database(path.join(__dirname, '..', '..', 'terminal', 'data', 'terminal.db'));
        const r = wdb.prepare(
            'UPDATE agents SET token_address = ?, token_symbol = ?, token_name = ?, token_market_cap = ? WHERE token_id = ? OR agent_id = ? OR address = ?'
        ).run(token_address, token_symbol.toUpperCase(), token_name || null, token_market_cap || null, id, id, id);
        wdb.close();
        if (r.changes === 0) return res.status(404).json({ error: 'Agent not found' });
        res.json({ success: true, updated: r.changes });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/terminal/agent/:id/revenue — Self-report revenue data
app.post('/api/terminal/agent/:id/revenue', express.json(), (req, res) => {
    try {
        const { revenue_monthly, client_count, sources } = req.body;
        if (revenue_monthly === undefined && client_count === undefined) {
            return res.status(400).json({ error: 'revenue_monthly or client_count required' });
        }
        const id = req.params.id;
        const Database = require('better-sqlite3');
        const wdb = new Database(path.join(__dirname, '..', '..', 'terminal', 'data', 'terminal.db'));
        const agent = wdb.prepare('SELECT id FROM agents WHERE CAST(id AS TEXT) = ? OR token_id = ? OR agent_id = ? OR LOWER(name) = LOWER(?)').get(id, id, id, id);
        if (!agent) { wdb.close(); return res.status(404).json({ error: 'Agent not found' }); }
        
        const updates = [];
        const params = {};
        if (revenue_monthly !== undefined) { updates.push('revenue_self_reported = @rev'); params.rev = parseFloat(revenue_monthly) || 0; }
        if (client_count !== undefined) { updates.push('client_count = @clients'); params.clients = parseInt(client_count) || 0; }
        if (sources) { updates.push('revenue_sources = @sources'); params.sources = typeof sources === 'string' ? sources : JSON.stringify(sources); }
        updates.push("revenue_updated_at = datetime('now')");
        params.id = agent.id;
        
        wdb.prepare(`UPDATE agents SET ${updates.join(', ')} WHERE id = @id`).run(params);
        wdb.close();
        res.json({ success: true, agent_id: agent.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Bankr Token Launch ─────────────────────────────────────────
let _bankrApiKey = null;
async function initBankrApiKey() {
    if (process.env.BANKR_API_KEY) { _bankrApiKey = process.env.BANKR_API_KEY; return; }
    try {
        const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
        const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-2' });
        const resp = await client.send(new GetSecretValueCommand({ SecretId: 'helixa/bankr-api-key' }));
        const parsed = JSON.parse(resp.SecretString);
        _bankrApiKey = parsed.BANKR_API_KEY || parsed.apiKey || Object.values(parsed)[0];
        console.log('[BANKR] API key loaded from AWS Secrets Manager');
    } catch (e) {
        console.warn('[BANKR] Could not load from Secrets Manager:', e.message);
        try {
            const cfg = require(require('os').homedir() + '/.config/bankr/config.json');
            _bankrApiKey = cfg.apiKey || cfg.api_key;
            console.log('[BANKR] API key loaded from local config (fallback)');
        } catch { console.warn('[BANKR] No API key available'); }
    }
}
function getBankrApiKey() { return _bankrApiKey; }

// POST /api/v2/agent/:id/launch-token — Launch a token via Bankr
app.post('/api/v2/agent/:id/launch-token', async (req, res) => {
    const tokenId = parseInt(req.params.id);
    const { signature, message, name, symbol, image, website, feeRecipient } = req.body;

    if (!signature || !message) {
        return res.status(400).json({ error: 'Missing signature or message' });
    }

    const bankrKey = getBankrApiKey();
    if (!bankrKey) {
        return res.status(503).json({ error: 'Bankr API key not configured' });
    }

    try {
        // Verify signature recovers to the token owner
        const recoveredAddress = ethers.verifyMessage(message, signature);
        const owner = await readContract.ownerOf(tokenId);

        if (recoveredAddress.toLowerCase() !== owner.toLowerCase()) {
            return res.status(403).json({ error: 'Signature does not match token owner' });
        }

        // Verify message is recent (within 5 minutes)
        const match = message.match(/Launch token for agent #(\d+) at (\d+)/);
        if (!match || parseInt(match[1]) !== tokenId) {
            return res.status(400).json({ error: 'Invalid message format' });
        }
        const msgTime = parseInt(match[2]);
        if (Math.abs(Date.now() - msgTime) > 5 * 60 * 1000) {
            return res.status(400).json({ error: 'Message expired (5 min window)' });
        }

        // Get agent metadata for defaults
        const agent = await formatAgentV2(tokenId);
        const tokenName = name || agent.name || `Agent ${tokenId}`;
        const tokenSymbol = symbol || tokenName.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6);

        // Build prompt for Bankr
        let prompt = `deploy a token called "${tokenName}" with symbol ${tokenSymbol}`;
        if (image) prompt += ` with image ${image}`;
        if (website) prompt += ` with website ${website}`;

        console.log(`[BANKR] Launching token for agent #${tokenId}: ${prompt}`);

        const bankrResp = await fetch('https://api.bankr.bot/agent/prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': bankrKey,
            },
            body: JSON.stringify({ prompt }),
        });

        if (!bankrResp.ok) {
            const errText = await bankrResp.text().catch(() => 'Unknown error');
            console.error(`[BANKR] API error: ${bankrResp.status} ${errText}`);
            return res.status(502).json({ error: `Bankr API error: ${bankrResp.status}`, detail: errText });
        }

        const bankrData = await bankrResp.json();
        const jobId = bankrData.jobId || bankrData.id || bankrData.job_id;

        console.log(`[BANKR] Job created: ${jobId} for agent #${tokenId}`);
        res.json({ success: true, jobId, tokenId, tokenName, tokenSymbol });
    } catch (e) {
        console.error(`[BANKR] Launch error for #${tokenId}: ${e.message}`);
        res.status(500).json({ error: 'Token launch failed: ' + e.message.slice(0, 200) });
    }
});

// GET /api/v2/agent/:id/launch-status/:jobId — Poll Bankr job status
app.get('/api/v2/agent/:id/launch-status/:jobId', async (req, res) => {
    const tokenId = parseInt(req.params.id);
    const { jobId } = req.params;

    const bankrKey = getBankrApiKey();
    if (!bankrKey) {
        return res.status(503).json({ error: 'Bankr API key not configured' });
    }

    try {
        const bankrResp = await fetch(`https://api.bankr.bot/agent/job/${jobId}`, {
            headers: { 'X-API-Key': bankrKey },
        });

        if (!bankrResp.ok) {
            return res.status(502).json({ error: `Bankr API error: ${bankrResp.status}` });
        }

        const data = await bankrResp.json();

        // If token deployed successfully, update agent record with token address
        const tokenAddress = data.tokenAddress || data.token_address || data.contractAddress || data.contract_address;
        if (tokenAddress && (data.status === 'completed' || data.status === 'success')) {
            try {
                // Store as linked token trait (same pattern as link-token endpoint)
                const traitUpdates = [
                    contract.addTrait(tokenId, 'linked-token', tokenAddress),
                    contract.addTrait(tokenId, 'linked-token-chain', 'base'),
                    contract.addTrait(tokenId, 'linked-token-symbol', data.symbol || ''),
                    contract.addTrait(tokenId, 'linked-token-name', data.name || data.tokenName || ''),
                ];
                await Promise.all(traitUpdates.map(p => p.then(tx => tx.wait()).catch(() => {})));
                console.log(`[BANKR] Linked token ${tokenAddress} to agent #${tokenId}`);
            } catch (e) {
                console.error(`[BANKR] Failed to link token to agent: ${e.message}`);
            }
        }

        res.json({ jobId, tokenId, ...data });
    } catch (e) {
        res.status(500).json({ error: 'Status check failed: ' + e.message.slice(0, 200) });
    }
});

// ─── API Documentation Page ─────────────────────────────────────
const { getDocsHTML } = require('./docs-page');
app.get('/docs', (req, res) => {
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(getDocsHTML());
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found', hint: 'Try GET /api/v2 for endpoint list or GET /docs for documentation' });
});

// ─── Start ──────────────────────────────────────────────────────

process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err.message || err, err.stack?.split('\n').slice(0,3).join(' '));
});
process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err.message || err));

// ─── Async Startup (load deployer key from AWS Secrets Manager) ─
(async () => {
    await initDeployerKey();
    await initBankrApiKey();
    // Re-read dynamic exports after key load
    wallet = svc.wallet;
    contract = svc.contract;
    rawContract = svc.rawContract;
    DEPLOYER_KEY = svc.DEPLOYER_KEY;
    DEPLOYER_ADDRESS = svc.DEPLOYER_ADDRESS;

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`\n🧬 Helixa V2 API running on port ${PORT}`);
        console.log(`   Contract: ${V2_CONTRACT_ADDRESS} ${isContractDeployed() ? '✅' : '⏳ NOT DEPLOYED'}`);
        console.log(`   Auth: SIWA (Sign-In With Agent)`);
        console.log(`   Payments: x402 (mint $${PRICING.agentMint}, update $${PRICING.update}, cred-report $${PRICING.credReport})`);
        console.log(`   RPC: ${RPC_URL}`);
        console.log(`   8004 Registry: ${ERC8004_REGISTRY} (cross-reg enabled)`);
        console.log(`   Deployer: ${wallet ? wallet.address : 'READ-ONLY (no key)'}\n`);
    });
})();
