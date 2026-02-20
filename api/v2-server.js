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
const crypto = require('crypto');

// ─── Environment ────────────────────────────────────────────────
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
        const [key, ...val] = line.split('=');
        if (key && val.length) process.env[key.trim()] = val.join('=').trim();
    });
}

const PORT = process.env.V2_API_PORT || 3457;
const RPC_URL = process.env.RPC_URL || 'https://mainnet.base.org';
const DEPLOYER_KEY = process.env.DEPLOYER_KEY;
const DEPLOYER_ADDRESS = process.env.DEPLOYER_ADDRESS || '0x19B16428f0721a5f627F190Ca61D493A632B423F';
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// TODO: Replace with actual deployed V2 contract address
const V2_CONTRACT_ADDRESS = process.env.V2_CONTRACT || '0x2e3B541C59D38b84E3Bc54e977200230A204Fe60';

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
const READ_RPC_URL = process.env.READ_RPC_URL || 'https://base.drpc.org';
const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID, { staticNetwork: true });
const readProvider = new ethers.JsonRpcProvider(READ_RPC_URL, CHAIN_ID, { staticNetwork: true, batchMaxCount: 1 });
const wallet = new ethers.Wallet(DEPLOYER_KEY, provider);
const rawContract = new ethers.Contract(V2_CONTRACT_ADDRESS, V2_ABI, wallet);
const readContract = new ethers.Contract(V2_CONTRACT_ADDRESS, V2_ABI, readProvider);
const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);

// ═══════════════════════════════════════════════════════════════
// ERC-8021 Builder Code Attribution
// ═══════════════════════════════════════════════════════════════
// Appends builder code suffix to all write transactions for Base rewards
const BUILDER_CODE = process.env.BUILDER_CODE || 'bc_doy52p24';
let ERC8021_SUFFIX;
try {
    const { Attribution } = require('ox/erc8021');
    ERC8021_SUFFIX = Attribution.toDataSuffix({ codes: [BUILDER_CODE] });
    console.log(`[ERC-8021] Builder code "${BUILDER_CODE}" → suffix: ${ERC8021_SUFFIX}`);
} catch (e) {
    console.warn('[ERC-8021] ox not installed, attribution disabled:', e.message);
    ERC8021_SUFFIX = null;
}

// Proxy that auto-appends ERC-8021 suffix to all contract write calls
const contract = new Proxy(rawContract, {
    get(target, prop) {
        const val = target[prop];
        if (typeof val === 'function' && !['connect', 'attach', 'interface', 'runner', 'target', 'filters', 'queryFilter', 'on', 'once', 'removeListener', 'getAddress', 'getDeployedCode', 'waitForDeployment'].includes(prop)) {
            return async function (...args) {
                // Only append suffix to write transactions (not view/pure calls)
                // Detect by checking if last arg is an overrides object or if function is non-view
                const fragment = target.interface.getFunction(prop);
                if (fragment && !fragment.constant && ERC8021_SUFFIX) {
                    // It's a write function — populate tx and append suffix
                    const tx = await target[prop].populateTransaction(...args);
                    tx.data = tx.data + ERC8021_SUFFIX.slice(2); // remove 0x prefix from suffix
                    return wallet.sendTransaction(tx);
                }
                return val.apply(target, args);
            };
        }
        return val;
    }
});

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
        
        let ts = parseInt(timestamp);
        if (isNaN(ts)) return false;
        // Auto-detect seconds vs milliseconds (seconds timestamps are < 1e12)
        if (ts < 1e12) ts = ts * 1000;
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

// Payment verification: track USED tx hashes to prevent replay
const usedPayments = new Set();
const USED_PAYMENTS_PATH = path.join(__dirname, '..', 'data', 'used-payments.json');
try {
    if (fs.existsSync(USED_PAYMENTS_PATH)) {
        JSON.parse(fs.readFileSync(USED_PAYMENTS_PATH, 'utf8')).forEach(h => usedPayments.add(h));
        console.log(`✅ Loaded ${usedPayments.size} used payment hashes`);
    }
} catch {}
function saveUsedPayments() {
    try {
        const dir = path.dirname(USED_PAYMENTS_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(USED_PAYMENTS_PATH, JSON.stringify([...usedPayments]));
    } catch {}
}

async function verifyUSDCPayment(txHash, expectedAmountUSDC) {
    if (usedPayments.has(txHash)) return false; // REPLAY BLOCKED
    
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
                usedPayments.add(txHash);
                saveUsedPayments();
                return true;
            }
        }
        return false;
    } catch {
        return false;
    }
}

// x402 Payment Middleware
// Uses Dexter facilitator (x402.dexter.cash) for Base mainnet
const FACILITATOR_URL = 'https://x402.dexter.cash';
// USDC_ADDRESS already declared above

function requirePayment(amountUSDC) {
    if (amountUSDC <= 0) return (req, res, next) => next();
    
    return async (req, res, next) => {
        const paymentHeader = req.get('X-PAYMENT') || req.get('Payment') || req.get('x-payment');
        
        if (!paymentHeader) {
            // Return 402 with x402 payment requirements
            res.status(402).json({
                error: 'Payment Required',
                'x-payment-required': {
                    scheme: 'exact',
                    network: 'eip155:8453',
                    maxAmountRequired: String(amountUSDC * 1_000_000), // USDC has 6 decimals
                    resource: req.originalUrl || req.url,
                    description: `${amountUSDC} USDC payment required`,
                    mimeType: 'application/json',
                    payTo: DEPLOYER_ADDRESS,
                    maxTimeoutSeconds: 300,
                    asset: USDC_ADDRESS,
                    extra: {
                        name: 'Helixa Agent Mint',
                        facilitatorUrl: FACILITATOR_URL,
                    }
                },
                hint: 'Send x402 payment via X-PAYMENT header. See https://docs.x402.org for client SDKs.',
            });
            return;
        }
        
        // Verify payment with facilitator
        try {
            const fetch = (await import('node-fetch')).default;
            const verifyRes = await fetch(`${FACILITATOR_URL}/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payment: paymentHeader,
                    payTo: DEPLOYER_ADDRESS,
                    maxAmountRequired: String(amountUSDC * 1_000_000),
                    network: 'eip155:8453',
                    asset: USDC_ADDRESS,
                    resource: req.originalUrl || req.url,
                }),
                signal: AbortSignal.timeout(15000),
            });
            
            if (!verifyRes.ok) {
                const err = await verifyRes.text();
                console.error('x402 verify failed:', verifyRes.status, err);
                return res.status(402).json({ error: 'Payment verification failed', detail: err });
            }
            
            const result = await verifyRes.json();
            
            // Settle payment
            const settleRes = await fetch(`${FACILITATOR_URL}/settle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payment: paymentHeader,
                    payTo: DEPLOYER_ADDRESS,
                    maxAmountRequired: String(amountUSDC * 1_000_000),
                    network: 'eip155:8453',
                    asset: USDC_ADDRESS,
                    resource: req.originalUrl || req.url,
                }),
                signal: AbortSignal.timeout(30000),
            });
            
            if (!settleRes.ok) {
                const err = await settleRes.text();
                console.error('x402 settle failed:', settleRes.status, err);
                return res.status(402).json({ error: 'Payment settlement failed', detail: err });
            }
            
            req.payment = { amount: amountUSDC, verified: true, x402: true };
            next();
        } catch (err) {
            console.error('x402 payment error:', err.message);
            return res.status(500).json({ error: 'Payment processing error', message: err.message });
        }
    };
}

// Legacy payment verification (kept for backwards compat with existing clients)
function requirePaymentLegacy(amountUSDC) {
    return async (req, res, next) => {
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

// Phase 1 pricing
const PRICING = {
    agentMint: 1,    // $1 USDC via x402
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

// ─── Security Headers ──────────────────────────────────────────
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
});

// ─── CORS (restricted) ─────────────────────────────────────────
const ALLOWED_ORIGINS = [
    'https://helixa.xyz',
    'https://www.helixa.xyz',
    'https://api.helixa.xyz',
    'http://localhost:5173',
    'http://localhost:3000',
];
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (!origin) {
        // Allow non-browser requests (curl, agents)
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Payment-Proof, X-Payment, Payment, Payment-Signature');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

// ─── Rate Limiting ──────────────────────────────────────────────
const rateLimitWindows = {}; // ip → { count, resetAt }
const RATE_LIMIT = { window: 60_000, maxRequests: 30 }; // 30 req/min
const RATE_LIMIT_MINT = { window: 300_000, maxRequests: 3 }; // 3 mints per 5 min
const mintRateLimits = {};

function checkRateLimit(key, limits, store) {
    const now = Date.now();
    const entry = store[key];
    if (!entry || now > entry.resetAt) {
        store[key] = { count: 1, resetAt: now + limits.window };
        return true;
    }
    entry.count++;
    if (entry.count > limits.maxRequests) return false;
    return true;
}

// Clean up stale entries every 5 min
setInterval(() => {
    const now = Date.now();
    for (const [k, v] of Object.entries(rateLimitWindows)) { if (now > v.resetAt) delete rateLimitWindows[k]; }
    for (const [k, v] of Object.entries(mintRateLimits)) { if (now > v.resetAt) delete mintRateLimits[k]; }
}, 300_000);

app.use((req, res, next) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    if (!checkRateLimit(ip, RATE_LIMIT, rateLimitWindows)) {
        return res.status(429).json({ error: 'Too many requests. Try again in a minute.' });
    }
    req.clientIp = ip;
    next();
});

// ─── x402 Official SDK Middleware ────────────────────────────────
// Uses @x402/express with Dexter facilitator for Base mainnet
const { paymentMiddleware: x402PaymentMiddleware, x402ResourceServer: X402ResourceServer } = require('@x402/express');
const { ExactEvmScheme } = require('@x402/evm/exact/server');
const { HTTPFacilitatorClient } = require('@x402/core/server');

const DEXTER_FACILITATOR_URL = 'https://x402.dexter.cash';
const x402FacilitatorClient = new HTTPFacilitatorClient({ url: DEXTER_FACILITATOR_URL });
const x402Server = new X402ResourceServer(x402FacilitatorClient)
    .register('eip155:8453', new ExactEvmScheme());

// Build x402 route config from PRICING
const x402Routes = {};
if (PRICING.agentMint > 0) {
    x402Routes['POST /api/v2/mint'] = {
        accepts: [{
            scheme: 'exact',
            price: `$${PRICING.agentMint}`,
            network: 'eip155:8453',
            payTo: DEPLOYER_ADDRESS,
        }],
        description: 'Mint a new Helixa agent identity',
        mimeType: 'application/json',
    };
}
if (PRICING.update > 0) {
    // Wildcard — x402 matches on method+path pattern
    x402Routes['POST /api/v2/agent/:id/update'] = {
        accepts: [{
            scheme: 'exact',
            price: `$${PRICING.update}`,
            network: 'eip155:8453',
            payTo: DEPLOYER_ADDRESS,
        }],
        description: 'Update agent traits and metadata',
        mimeType: 'application/json',
    };
}

// Only mount if there are paid routes
if (Object.keys(x402Routes).length > 0) {
    app.use(x402PaymentMiddleware(x402Routes, x402Server));
    console.log(`💰 x402 payment gates active: ${Object.keys(x402Routes).join(', ')}`);
} else {
    console.log('💰 x402: All routes free (Phase 1)');
}

// ─── Helpers ────────────────────────────────────────────────────

const isContractDeployed = () => V2_CONTRACT_ADDRESS !== '0x0000000000000000000000000000000000000000';

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

    return {
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
            agentMint: '$1 USDC',
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
            totalAgents: Math.max(0, Number(total) - 1), // Hide test agent #0
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

// ─── Agent List Cache ───────────────────────────────────────────
const HIDDEN_TOKENS = new Set([0, 14, 15, 16, 17, 18, 21]);
let agentCache = { agents: [], total: 0, updatedAt: 0, loading: false };
const CACHE_TTL_MS = 60_000; // 60 seconds

async function refreshAgentCache() {
    if (agentCache.loading) return;
    agentCache.loading = true;
    try {
        const totalRaw = Number(await readContract.totalAgents());
        const visibleIds = [];
        for (let i = 0; i < totalRaw; i++) {
            if (!HIDDEN_TOKENS.has(i)) visibleIds.push(i);
        }
        
        const agents = [];
        for (const i of visibleIds) {
            try {
                const agent = await readContract.getAgent(i);
                const owner = await readContract.ownerOf(i);
                let credScore = 0, personality = null, points = 0, traitCount = 0;
                try { credScore = Number(await readContract.getCredScore(i)); } catch {}
                try { points = Number(await readContract.points(i)); } catch {}
                try {
                    const traits = await readContract.getTraits(i);
                    traitCount = traits.length;
                } catch {}
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
                    soulbound: agent.soulbound || i === 1,
                    mintOrigin: ['HUMAN', 'AGENT_SIWA', 'API', 'OWNER'][Number(agent.origin)] || 'UNKNOWN',
                    credScore,
                    points,
                    traitCount,
                    personality,
                    owner,
                    mintedAt: new Date(Number(agent.mintedAt) * 1000).toISOString(),
                });
            } catch {}
        }
        
        agentCache = { agents, total: agents.length, updatedAt: Date.now(), loading: false };
        console.log(`📋 Agent cache refreshed: ${agents.length} agents`);
    } catch (e) {
        agentCache.loading = false;
        console.error('Cache refresh error:', e.message);
    }
}

// Refresh cache on startup and periodically
setTimeout(refreshAgentCache, 2000);
setInterval(() => {
    if (Date.now() - agentCache.updatedAt > CACHE_TTL_MS) refreshAgentCache();
}, 30_000);

// GET /api/v2/agents
app.get('/api/v2/agents', async (req, res) => {
    try {
        if (!isContractDeployed()) {
            return res.json({ total: 0, page: 1, agents: [], contractDeployed: false });
        }
        
        // Trigger refresh if stale but serve cached data immediately
        if (Date.now() - agentCache.updatedAt > CACHE_TTL_MS) refreshAgentCache();
        
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 100));
        const start = (page - 1) * limit;
        const paged = agentCache.agents.slice(start, start + limit);
        
        res.json({ total: agentCache.total, page, pages: Math.ceil(agentCache.total / limit), limit, agents: paged, cached: true, cachedAt: new Date(agentCache.updatedAt).toISOString() });
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
        const tier = agent.credScore >= 61 ? 'EX' : agent.credScore >= 26 ? 'Evolved' : 'Basic';
        
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

// POST /api/v2/mint — Mint new agent
app.post('/api/v2/mint', requireSIWA, async (req, res) => {
    // Mint-specific rate limit (stricter)
    const mintKey = req.agent?.address || req.clientIp;
    if (!checkRateLimit(mintKey, RATE_LIMIT_MINT, mintRateLimits)) {
        return res.status(429).json({ error: 'Mint rate limit exceeded. Max 3 per 5 minutes.' });
    }

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
app.post('/api/v2/agent/:id/update', requireSIWA, async (req, res) => {
    const tokenId = parseInt(req.params.id);
    const { personality, narrative, traits } = req.body;
    
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
        
        const updated = [];
        const MAX_STR = 256;
        const clamp = (s, max = MAX_STR) => (typeof s === 'string' ? s.slice(0, max) : '');
        
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
            mint: PRICING.agentMint === 0 ? 'free' : `${PRICING.agentMint} USDC`,
            update: PRICING.update === 0 ? 'free' : `${PRICING.update} USDC`,
            protocol: 'x402',
        },
        auth: {
            type: 'SIWA',
            format: 'address:timestamp:signature',
            description: 'Sign-In With Agent — agent signs a message with its wallet key',
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
                    description: 'Requires SIWA authentication. Optionally accepts x402 payment. Creates onchain identity with name, framework, personality, narrative, and traits.',
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
            tier: agent.credScore >= 61 ? 'EX' : agent.credScore >= 26 ? 'Evolved' : 'Basic',
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

// ─── Error Handler ──────────────────────────────────────────────

app.use((err, req, res, next) => {
    const errId = crypto.randomBytes(4).toString('hex');
    console.error(`[V2 ERROR ${errId}]`, err.message || err);
    res.status(500).json({ error: 'Internal server error', errorId: errId });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found', hint: 'Try GET /api/v2 for endpoint list' });
});

// ─── Start ──────────────────────────────────────────────────────

process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err.message || err, err.stack?.split('\n').slice(0,3).join(' '));
});
process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err.message || err));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🧬 Helixa V2 API running on port ${PORT}`);
    console.log(`   Contract: ${V2_CONTRACT_ADDRESS} ${isContractDeployed() ? '✅' : '⏳ NOT DEPLOYED'}`);
    console.log(`   Auth: SIWA (Sign-In With Agent)`);
    console.log(`   Payments: x402 (Phase 1 — all free)`);
    console.log(`   RPC: ${RPC_URL}`);
    console.log(`   8004 Registry: ${ERC8004_REGISTRY} (cross-reg enabled)`);
    console.log(`   Deployer: ${wallet.address}\n`);
});
