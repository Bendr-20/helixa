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

const credOracle = require('./services/cred-oracle');
const {
    parseSIWA,
    verifySIWA,
    requireSIWA,
    SIWA_DOMAIN,
    SIWE_DOMAIN,
    requireHumanAuth,
    requireHumanWalletAuth,
} = require('./middleware/auth');
const { buildSIWSMessage, pendingChallenges, requireSIWS, requireAuth } = require('./middleware/siws');
const { securityHeaders, cors } = require('./middleware/cors');
const { globalRateLimit, mintRateLimit } = require('./middleware/rateLimit');
const {
    verifyUSDCPayment, requirePayment, requirePaymentLegacy,
    PRICING, PARTNER_PRICING, resolvePrice, usedPayments, saveUsedPayments,
} = require('./services/payments');
const {
    V1_OG_WALLETS, REFERRAL_CODES, referralRegistry, referralStats,
    OG_BONUS_POINTS, REFERRAL_POINTS_REFERRER, REFERRAL_POINTS_MINTER,
    isOGWallet, resolveReferralCode, generateReferralCode, registerReferralCode,
    saveReferralDB,
} = require('./services/referrals');

// ─── SoulSovereign Contract ─────────────────────────────────────
const SOUL_SOVEREIGN_ADDRESS = process.env.SOUL_SOVEREIGN_V3 || '0x946677180fb3fdb5EbFF94aD91CFCeF0559711bD';
const SOUL_SOVEREIGN_ABI = [
    // V3 versioned functions
    'function lockSoulVersion(uint256 tokenId, bytes32 _soulHash) external',
    'function getSoulVersion(uint256 tokenId) external view returns (uint256)',
    'function getSoulHash(uint256 tokenId, uint256 version) external view returns (bytes32)',
    'function getSoulTimestamp(uint256 tokenId, uint256 version) external view returns (uint256)',
    'function getFullSoulHistory(uint256 tokenId) external view returns (bytes32[] hashes, uint256[] timestamps)',
    // Backward compat (works on both v2 and v3)
    'function lockSoul(uint256 tokenId, bytes32 _soulHash) external',
    'function isSovereign(uint256 tokenId) external view returns (bool)',
    'function soulLocked(uint256 tokenId) external view returns (bool)',
    'function getSovereignWallet(uint256 tokenId) external view returns (address)',
    'function soulHash(uint256 tokenId) external view returns (bytes32)',
    'function soulVersion(uint256 tokenId) external view returns (uint256)',
];
function getSoulSovereignContract(signerOrProvider) {
    return new ethers.Contract(SOUL_SOVEREIGN_ADDRESS, SOUL_SOVEREIGN_ABI, signerOrProvider);
}

// ─── HandshakeRegistry Contract ─────────────────────────────────
const HANDSHAKE_REGISTRY_ADDRESS = process.env.HANDSHAKE_REGISTRY || '0xdA865DC3647f7AA97228fBEB37Fe02095f0cA0Fd';
const HANDSHAKE_REGISTRY_ABI = [
    'function recordHandshake(uint256 fromTokenId, uint256 toTokenId) external',
    'function isConnected(uint256 a, uint256 b) external view returns (bool)',
    'function handshakeCount(uint256 tokenId) external view returns (uint256)',
    'function totalHandshakes() external view returns (uint256)',
    'event HandshakeCompleted(uint256 indexed fromTokenId, uint256 indexed toTokenId, uint256 timestamp)',
];

async function recordHandshakeOnchain(fromTokenId, toTokenId) {
    try {
        let deployerKey = process.env.DEPLOYER_KEY;
        if (!deployerKey) {
            const { SecretsManagerClient, GetSecretValueCommand } = require(path.join(__dirname, 'node_modules', '@aws-sdk', 'client-secrets-manager'));
            const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-2' });
            const resp = await client.send(new GetSecretValueCommand({ SecretId: 'helixa/deployer-key' }));
            deployerKey = JSON.parse(resp.SecretString).DEPLOYER_PRIVATE_KEY;
        }
        const provider = new ethers.JsonRpcProvider('https://mainnet.base.org', 8453, { staticNetwork: true });
        const w = new ethers.Wallet(deployerKey, provider);
        const registry = new ethers.Contract(HANDSHAKE_REGISTRY_ADDRESS, HANDSHAKE_REGISTRY_ABI, w);
        const tx = await registry.recordHandshake(fromTokenId, toTokenId);
        console.log(`[HANDSHAKE REGISTRY] tx sent: ${tx.hash} (from=#${fromTokenId} to=#${toTokenId})`);
    } catch (err) {
        console.error(`[HANDSHAKE REGISTRY] onchain write failed:`, err.message);
    }
}

// ─── Express App ────────────────────────────────────────────────
const PORT = process.env.V2_API_PORT || 3457;
const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '200kb' }));
app.use(securityHeaders);
app.use(cors);
app.use(globalRateLimit);

// Trust Graph Dashboard — mounted as static before any middleware can interfere
app.use('/trust-graph', express.static(path.resolve(__dirname, 'public', 'trust-graph.html')));

// Compliance endpoints (Probe audit: x402, llms.txt, security.txt, OpenAPI, etc.)
require('./compliance-endpoints.js')(app);

// Pitch deck
app.use('/helixa-pitch-deck.html', express.static(path.resolve(__dirname, 'public', 'helixa-pitch-deck.html')));

// Doppel voice audio cache (TTS files served for MML <m-audio>) — mounted early to bypass payment middleware
const doppelAudioPath = path.resolve(__dirname, '..', '..', 'doppel-agent', 'audio-cache');
app.use('/audio/voice', express.static(doppelAudioPath, {
    maxAge: 0,
    setHeaders: (res) => {
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Cache-Control', 'no-cache');
        res.set('Content-Type', 'audio/mpeg');
    },
}));

app.use((req, res, next) => {
    if (req.path.includes('cred-report')) console.log(`[DEBUG] Request: ${req.method} ${req.path} headers: ${Object.keys(req.headers).join(',')}`);
    next();
});

// ─── MPP (Machine Payments Protocol) Server Setup ──────────────
let mppServer = null;
const MPP_SECRET_KEY = process.env.MPP_SECRET_KEY || require('crypto').randomBytes(32).toString('base64');
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || (() => { try { return require('fs').readFileSync(require('path').join(require('os').homedir(), '.config/helixa/stripe-key.txt'), 'utf8').trim(); } catch { return null; } })();
{
    try {
        const { Mppx: MppxServer, tempo: tempoServer, stripe: stripeServer } = require('mppx/server');
        const methods = [
            tempoServer({
                currency: '0x20C000000000000000000000b9537d11c60E8b50', // USDC.e on Tempo
                recipient: DEPLOYER_ADDRESS,
            }),
        ];
        if (STRIPE_SECRET_KEY) {
            methods.push(stripeServer.charge({
                networkId: 'internal',
                paymentMethodTypes: ['card', 'link'],
                secretKey: STRIPE_SECRET_KEY,
            }));
            console.log('[MPP] Stripe fiat payments enabled (card + link)');
        }
        mppServer = MppxServer.create({
            secretKey: MPP_SECRET_KEY,
            methods,
        });
        console.log('[MPP] Server initialized - accepting ' + (STRIPE_SECRET_KEY ? 'crypto + fiat' : 'crypto only'));
    } catch (e) {
        console.warn('[MPP] Server init failed:', e.message);
    }
}

// ─── x402 Official SDK Middleware ───────────────────────────────
const { paymentMiddleware: x402PaymentMiddleware, x402ResourceServer: X402ResourceServer } = require('@x402/express');
const { ExactEvmScheme } = require('@x402/evm/exact/server');
const { HTTPFacilitatorClient } = require('@x402/core/server');

const x402FacilitatorClient = new HTTPFacilitatorClient({ url: 'https://x402.dexter.cash' });
const x402Server = new X402ResourceServer(x402FacilitatorClient)
    .register('eip155:8453', new ExactEvmScheme());

const x402Routes = {};
if (PRICING.agentMint > 0) {
    x402Routes['POST /api/v2/mint'] = {
        accepts: [{ scheme: 'exact', price: `$${PRICING.agentMint}`, network: 'eip155:8453', payTo: DEPLOYER_ADDRESS }],
        description: 'Register a new Helixa agent identity', mimeType: 'application/json',
    };
}
if (PRICING.update > 0) {
    x402Routes['POST /api/v2/agent/[id]/update'] = {
        accepts: [{ scheme: 'exact', price: `$${PRICING.update}`, network: 'eip155:8453', payTo: DEPLOYER_ADDRESS }],
        description: 'Update agent traits and metadata', mimeType: 'application/json',
    };
}
if (PRICING.credReport > 0) {
    x402Routes['GET /api/v2/agent/[id]/cred-report'] = {
        accepts: [{ scheme: 'exact', price: `$${PRICING.credReport}`, network: 'eip155:8453', payTo: TREASURY_ADDRESS }],
        description: 'Full Cred Report with scoring breakdown', mimeType: 'application/json',
    };
}
if (PRICING.soulLock > 0) {
    x402Routes['POST /api/v2/agent/[id]/soul/lock'] = {
        accepts: [{ scheme: 'exact', price: `$${PRICING.soulLock}`, network: 'eip155:8453', payTo: TREASURY_ADDRESS }],
        description: 'Lock your agent soul onchain (Chain of Identity)', mimeType: 'application/json',
    };
}
if (PRICING.soulHandshake > 0) {
    x402Routes['POST /api/v2/agent/[id]/soul/share'] = {
        accepts: [{ scheme: 'exact', price: `$${PRICING.soulHandshake}`, network: 'eip155:8453', payTo: TREASURY_ADDRESS }],
        description: 'Initiate a soul handshake with another agent', mimeType: 'application/json',
    };
}
if (PRICING.agentMint > 0) {
    x402Routes['POST /api/v2/register/solana'] = {
        accepts: [{ scheme: 'exact', price: `$${PRICING.agentMint}`, network: 'eip155:8453', payTo: DEPLOYER_ADDRESS }],
        description: 'Register a Solana agent on Base (cross-chain)', mimeType: 'application/json',
    };
}
// ─── USDC + $CRED TX Hash Payment Verification ────────────────
// USDC_ADDRESS imported from contract.js
const USDC_DECIMALS = 6;
const CRED_TOKEN_ADDRESS = credOracle.CRED_ADDRESS;
const CRED_TOKEN_DECIMALS = credOracle.CRED_DECIMALS;
const usedPaymentTxs = new Set(); // prevent replay
const mintInFlightAddresses = new Set();

function getValidatedSIWAAddress(req) {
    const parsed = parseSIWA(req.headers.authorization);
    if (!parsed) return null;
    if (!verifySIWA(parsed.address, parsed.timestamp, parsed.signature)) return null;
    try {
        return ethers.getAddress(parsed.address);
    } catch {
        return null;
    }
}

function acquireMintRequestLock(req, res, address) {
    if (!address) return null;
    const key = address.toLowerCase();
    if (req._mintLockAddress === key && typeof req._mintLockRelease === 'function') {
        return req._mintLockRelease;
    }
    if (mintInFlightAddresses.has(key)) return null;

    mintInFlightAddresses.add(key);
    let released = false;
    const release = () => {
        if (released) return;
        released = true;
        mintInFlightAddresses.delete(key);
    };

    req._mintLockAddress = key;
    req._mintLockRelease = release;
    res.on('finish', release);
    res.on('close', release);
    return release;
}

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

// Verify a $CRED ERC-20 transfer on Base (20% discount applied)
async function verifyCREDTransfer(txHash, expectedAmountUSD, expectedRecipient) {
    const credPrice = credOracle.getCredPriceUSDC();
    if (!credPrice) throw new Error('CRED price unavailable - pay with USDC instead');
    
    const discountedUSD = expectedAmountUSD * 0.80; // 20% discount
    const expectedCredAmount = discountedUSD / credPrice;
    const expectedCredWei = BigInt(Math.round(expectedCredAmount * 10 ** CRED_TOKEN_DECIMALS));
    // Allow 2% slippage
    const minCredWei = expectedCredWei * 98n / 100n;
    
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt || receipt.status !== 1) throw new Error('Transaction failed or not found');
    
    const transferTopic = ethers.id('Transfer(address,address,uint256)');
    for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== CRED_TOKEN_ADDRESS.toLowerCase()) continue;
        if (log.topics[0] !== transferTopic) continue;
        
        const to = ethers.getAddress('0x' + log.topics[2].slice(26));
        const amount = BigInt(log.data);
        
        if (to.toLowerCase() === expectedRecipient.toLowerCase() && amount >= minCredWei) {
            const credAmount = Number(amount) / 10 ** CRED_TOKEN_DECIMALS;
            const usdValue = credAmount * credPrice;
            return { 
                from: ethers.getAddress('0x' + log.topics[1].slice(26)), 
                to, 
                amount: credAmount, 
                usdValue,
                token: 'CRED',
                discount: '20%',
                credPrice
            };
        }
    }
    throw new Error(`No matching CRED transfer found. Expected ~${Math.round(expectedCredAmount).toLocaleString()} CRED to ${expectedRecipient}`);
}

// Middleware: skip x402 if valid paymentTx is provided in body OR header
// Accepts: body.paymentTx, header X-Payment-Proof, header X-Payment-Tx
function txHashPaymentMiddleware(routePatterns) {
    return async (req, res, next) => {
        // Find matching route config
        const routeKey = `${req.method} ${req.path}`;
        console.log(`[TX-BYPASS] Checking ${routeKey}, headers: x-payment-proof=${req.headers['x-payment-proof']?.slice(0,15)||'none'}`);
        let matched = null;
        for (const [pattern, config] of Object.entries(routePatterns)) {
            const [method, pathPattern] = pattern.split(' ');
            if (method !== req.method) continue;
            // Simple pattern match: /api/v2/agent/:id/xxx → /api/v2/agent/*/xxx
            let regexStr = '^' + pathPattern.replace(/:[^/]+/g, '[^/]+').replace(/\[([^\]]+)\]/g, '[^/]+') + '$';
            let regex;
            try { regex = new RegExp(regexStr); } catch { continue; }
            if (regex.test(req.path)) { matched = config; break; }
        }
        if (!matched) return next();

        // Extract tx hash from body or headers
        const txHash = (req.body && req.body.paymentTx) ||
                       req.headers['x-payment-proof'] ||
                       req.headers['x-payment-tx'];
        if (!txHash || typeof txHash !== 'string') return next();

        // Parse price from route config
        const priceStr = matched.accepts?.[0]?.price || '$1';
        const priceUSD = parseFloat(priceStr.replace('$', ''));
        const recipient = matched.accepts?.[0]?.payTo || DEPLOYER_ADDRESS;

        if (usedPaymentTxs.has(txHash.toLowerCase())) {
            return res.status(400).json({ error: 'Payment TX already used' });
        }

        try {
            const result = await verifyUSDCTransfer(txHash, priceUSD, recipient);
            usedPaymentTxs.add(txHash.toLowerCase());
            req.paymentVerified = { method: 'tx-hash', txHash, ...result };
            console.log(`[TX PAYMENT] Verified $${result.amount} USDC from ${result.from} (${txHash.slice(0, 10)}...)`);
            return next(); // paymentVerified flag set — x402 wrapper will skip
        } catch (e) {
            return res.status(402).json({
                error: `Payment verification failed: ${e.message}`,
                hint: 'Send USDC to the payment address, then retry with header X-Payment-Proof: <txHash> or body { "paymentTx": "<txHash>" }'
            });
        }
    };
}

// x402 payment middleware — handles both x402 protocol AND TX hash fallback
// The SDK middleware runs first. If it passes (payment-signature valid), great.
// For TX hash payments, we intercept BEFORE x402 by checking the header early.
function paymentGate(priceUSD, recipient) {
    return async (req, res, next) => {
        // Check for TX hash payment first (header or body)
        const txHash = (req.body && req.body.paymentTx) ||
                       req.headers['x-payment-proof'] ||
                       req.headers['x-payment-tx'];
        
        if (txHash && typeof txHash === 'string') {
            if (usedPaymentTxs.has(txHash.toLowerCase())) {
                return res.status(400).json({ error: 'Payment TX already used' });
            }
            
            // Check if paying with $CRED (header or body flag)
            const payToken = (req.headers['x-payment-token'] || req.body?.paymentToken || '').toUpperCase();
            const isCredPayment = payToken === 'CRED';
            
            try {
                let result;
                if (isCredPayment) {
                    result = await verifyCREDTransfer(txHash, priceUSD, recipient);
                    console.log(`[CRED PAYMENT] Verified ${result.amount.toLocaleString()} CRED (~$${result.usdValue.toFixed(4)}) from ${result.from} (20% discount applied)`);
                } else {
                    result = await verifyUSDCTransfer(txHash, priceUSD, recipient);
                    console.log(`[TX PAYMENT] Verified $${result.amount} USDC from ${result.from} (${txHash.slice(0, 10)}...)`);
                }
                usedPaymentTxs.add(txHash.toLowerCase());
                req.paymentVerified = { method: isCredPayment ? 'cred-tx' : 'tx-hash', txHash, ...result };
                return next();
            } catch (e) {
                // Build 402 response with both USDC and CRED pricing
                const credPrice = credOracle.getCredPriceUSDC();
                const credAmount = credPrice ? credOracle.getCredAmountForUSD(priceUSD) : null;
                return res.status(402).json({
                    error: `Payment verification failed: ${e.message}`,
                    hint: 'Send USDC or $CRED to the payment address, then retry with X-Payment-Proof header. For CRED, add X-Payment-Token: CRED. MPP (Tempo) also accepted.',
                    payTo: recipient,
                    price: { usdc: `$${priceUSD}`, cred: credAmount ? `${Math.ceil(credAmount)} CRED (20% discount)` : 'unavailable' },
                    network: 'Base (eip155:8453)',
                    assets: { usdc: USDC_ADDRESS, cred: CRED_TOKEN_ADDRESS },
                    mpp: mppServer ? { supported: true, chain: 'Tempo (4217)', currency: 'USDC.e' } : undefined
                });
            }
        }
        
        // No TX hash - fall through to x402 protocol middleware
        return next();
    };
}

// Mount: Internal key bypass → TX hash bypass → x402 SDK
if (Object.keys(x402Routes).length > 0) {
    // Internal API key bypass (for Bankr x402 Cloud proxy)
    app.use((req, res, next) => {
        const internalKey = req.headers['x-internal-key'];
        if (internalKey && internalKey === (process.env.INTERNAL_API_KEY || '095eae17f5b386cf3037d936ade389a5bff382a8c2cf7a5b7fed240fa6602837')) {
            req.paymentVerified = { method: 'internal-key' };
        }
        return next();
    });

    // TX hash gate runs on all requests — if payment header found & verified, marks req
    app.use(async (req, res, next) => {
        // Only check routes that x402 would gate
        let matched = null;
        for (const [pattern, config] of Object.entries(x402Routes)) {
            const [method, pathPattern] = pattern.split(' ');
            if (method !== req.method) continue;
            let regexStr2 = '^' + pathPattern.replace(/:[^/]+/g, '[^/]+').replace(/\[([^\]]+)\]/g, '[^/]+') + '$';
            let regex2;
            try { regex2 = new RegExp(regexStr2); } catch { continue; }
            if (regex2.test(req.path)) { matched = config; break; }
        }
        if (!matched) return next();
        
        const txHash = (req.body && req.body.paymentTx) ||
                       req.headers['x-payment-proof'] ||
                       req.headers['x-payment-tx'];
        if (!txHash || typeof txHash !== 'string') return next();
        
        console.log(`[TX-BYPASS] Found TX hash for ${req.method} ${req.path}: ${txHash.slice(0,15)}...`);

        if (req.path === '/api/v2/mint') {
            const mintAddress = getValidatedSIWAAddress(req);
            if (!mintAddress) {
                return res.status(401).json({ error: 'Valid SIWA authentication required before payment verification' });
            }
            try {
                const hasMinted = await readContract.hasMinted(mintAddress);
                if (hasMinted) {
                    return res.status(409).json({ error: 'This address already has an agent' });
                }
            } catch {}
            if (!acquireMintRequestLock(req, res, mintAddress)) {
                return res.status(409).json({ error: 'Mint already in progress for this address' });
            }
        }
        
        const priceStr = matched.accepts?.[0]?.price || '$1';
        const priceUSD = parseFloat(priceStr.replace('$', ''));
        const recipient = matched.accepts?.[0]?.payTo || DEPLOYER_ADDRESS;
        
        if (usedPaymentTxs.has(txHash.toLowerCase())) {
            return res.status(400).json({ error: 'Payment TX already used' });
        }
        
        const payToken = (req.headers['x-payment-token'] || req.body?.paymentToken || '').toUpperCase();
        const isCredPayment = payToken === 'CRED';
        
        try {
            let result;
            if (isCredPayment) {
                result = await verifyCREDTransfer(txHash, priceUSD, recipient);
                console.log(`[CRED PAYMENT] Verified ${result.amount.toLocaleString()} CRED (~$${result.usdValue.toFixed(4)}) from ${result.from} (20% discount)`);
            } else {
                result = await verifyUSDCTransfer(txHash, priceUSD, recipient);
                console.log(`[TX PAYMENT] Verified $${result.amount} USDC from ${result.from} (${txHash.slice(0, 10)}...)`);
            }
            usedPaymentTxs.add(txHash.toLowerCase());
            req.paymentVerified = { method: isCredPayment ? 'cred-tx' : 'tx-hash', txHash, ...result };
            return next();
        } catch (e) {
            const credPrice = credOracle.getCredPriceUSDC();
            const credAmount = credPrice ? credOracle.getCredAmountForUSD(priceUSD) : null;
            return res.status(402).json({
                error: `Payment verification failed: ${e.message}`,
                hint: 'Send USDC or $CRED to the payment address. For CRED, add header X-Payment-Token: CRED',
                payTo: recipient,
                price: { usdc: `$${priceUSD}`, cred: credAmount ? `${Math.ceil(credAmount)} CRED (20% discount)` : 'unavailable' },
                network: 'Base (eip155:8453)',
                assets: { usdc: USDC_ADDRESS, cred: CRED_TOKEN_ADDRESS }
            });
        }
    });
    
    // MPP charge middleware — checks for MPP credentials before x402
    if (mppServer) {
        app.use(async (req, res, next) => {
            if (req.paymentVerified) return next();
            // Only check MPP on gated routes
            let matched = null;
            for (const [pattern, config] of Object.entries(x402Routes)) {
                const [method, pathPattern] = pattern.split(' ');
                if (method !== req.method) continue;
                let regexStr = '^' + pathPattern.replace(/:[^/]+/g, '[^/]+').replace(/\[([^\]]+)\]/g, '[^/]+') + '$';
                try { if (new RegExp(regexStr).test(req.path)) { matched = config; break; } } catch {}
            }
            if (!matched) return next();
            // Check for MPP credential header
            const mppCredential = req.headers['x-payment'] || req.headers['x-mpp-credential'];
            if (!mppCredential) return next();
            try {
                const priceStr = matched.accepts?.[0]?.price || '$1';
                const priceUSD = parseFloat(priceStr.replace('$', ''));
                const response = await mppServer.charge({ amount: String(priceUSD) })(req);
                if (response.status === 402) return next(); // fall through to x402
                req.paymentVerified = { method: 'mpp-tempo', amount: priceUSD };
                console.log(`[MPP] Verified Tempo payment of $${priceUSD} for ${req.method} ${req.path}`);
                return next();
            } catch (e) {
                console.warn(`[MPP] Verification failed: ${e.message}`);
                return next(); // fall through to x402
            }
        });
    }

    // x402 SDK — skip if already paid via TX hash or MPP
    const x402Mw = x402PaymentMiddleware(x402Routes, x402Server);
    app.use((req, res, next) => {
        if (req.path.includes('cred-report')) console.log(`[X402-GATE] path=${req.path} paymentVerified=${JSON.stringify(req.paymentVerified)}`);
        if (req.paymentVerified) return next();
        // Skip x402 for non-API routes (dashboard pages, static assets)
        if (!req.path.startsWith('/api/')) return next();
        return x402Mw(req, res, next);
    });
    
    console.log(`[payments] x402 gates active: ${Object.keys(x402Routes).join(', ')}`);
    console.log(`[payments] TX hash bypass enabled (X-Payment-Proof / X-Payment-Tx / body.paymentTx)`);
    if (mppServer) console.log(`[payments] MPP (Tempo) acceptance enabled`);
}

// TX hash payment verification helper — used by route handlers directly
async function verifyPaymentFromRequest(req, priceUSD, recipient) {
    const txHash = (req.body && req.body.paymentTx) ||
                   req.headers['x-payment-proof'] ||
                   req.headers['x-payment-tx'];
    if (!txHash || typeof txHash !== 'string') return null;
    
    if (usedPaymentTxs.has(txHash.toLowerCase())) {
        throw new Error('Payment TX already used');
    }
    
    const result = await verifyUSDCTransfer(txHash, priceUSD, recipient);
    usedPaymentTxs.add(txHash.toLowerCase());
    console.log(`[TX PAYMENT] Verified $${result.amount} USDC from ${result.from} (${txHash.slice(0, 10)}...)`);
    return { method: 'tx-hash', txHash, ...result };
}
console.log(`💰 TX hash payment bypass enabled (X-Payment-Proof / X-Payment-Tx / body.paymentTx)`);

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

const HUMAN_PROFILES_PATH = path.join(__dirname, '..', 'data', 'human-profiles.json');
function loadHumanProfiles() {
    try { return JSON.parse(fs.readFileSync(HUMAN_PROFILES_PATH, 'utf8')); } catch { return {}; }
}
function saveHumanProfiles(profiles) {
    fs.writeFileSync(HUMAN_PROFILES_PATH, JSON.stringify(profiles, null, 2));
}
function saveHumanProfile(walletAddress, data) {
    const key = walletAddress && ethers.isAddress(walletAddress)
        ? ethers.getAddress(walletAddress).toLowerCase()
        : null;
    const profiles = loadHumanProfiles();
    // If wallet is provided, store under wallet key; otherwise use userId if present.
    const storageKey = key || (data.userId ? `user:${data.userId}` : null);
    if (!storageKey) throw new Error('saveHumanProfile requires either walletAddress or userId');
    profiles[storageKey] = {
        ...(profiles[storageKey] || {}),
        ...data,
        walletAddress: key ? ethers.getAddress(walletAddress) : null,
        updatedAt: new Date().toISOString(),
    };
    if (!profiles[storageKey].createdAt) profiles[storageKey].createdAt = new Date().toISOString();
    saveHumanProfiles(profiles);
    return profiles[storageKey];
}
function getHumanProfileByWallet(walletAddress) {
    try {
        const key = ethers.getAddress(walletAddress).toLowerCase();
        return loadHumanProfiles()[key] || null;
    } catch {
        return null;
    }
}

function getHumanProfileByUserId(userId) {
    const key = `user:${userId}`;
    return loadHumanProfiles()[key] || null;
}
function getHumanProfileById(id) {
    const profiles = loadHumanProfiles();
    if (/^\d+$/.test(String(id))) {
        const tokenId = Number(id);
        return Object.values(profiles).find(p => Number(p.tokenId) === tokenId) || null;
    }
    try {
        return profiles[ethers.getAddress(String(id)).toLowerCase()] || null;
    } catch {
        // Also try user: prefix
        const userKey = `user:${String(id)}`;
        return profiles[userKey] || null;
    }
}

function clampList(input, maxItems = 24, maxChars = 64) {
    if (!Array.isArray(input)) return [];
    return input
        .map(v => typeof v === 'string' ? v.trim().slice(0, maxChars) : '')
        .filter(Boolean)
        .slice(0, maxItems);
}

function clampObjectStrings(input, maxEntries = 24, maxChars = 128) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
    const out = {};
    for (const [k, v] of Object.entries(input).slice(0, maxEntries)) {
        if (typeof v === 'string' && v.trim()) out[k] = v.trim().slice(0, maxChars);
    }
    return out;
}

function clampEmail(input, maxChars = 254) {
    if (typeof input !== 'string') return '';
    const value = input.trim().toLowerCase().slice(0, maxChars);
    if (!value) return '';
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : '';
}

function clampHandle(input, maxChars = 64) {
    if (typeof input !== 'string') return '';
    return input.trim().slice(0, maxChars);
}

function clampUrl(input, maxChars = 512) {
    if (typeof input !== 'string') return '';
    const value = input.trim().slice(0, maxChars);
    if (!value) return '';
    return /^https?:\/\//i.test(value) ? value : '';
}

function clampIdLike(input, maxChars = 128) {
    if (typeof input !== 'string') return '';
    return input.trim().slice(0, maxChars);
}

function normalizeCommunicationChannels(input, services = {}, fallback = []) {
    const allowed = new Set(['email', 'telegram', 'web', 'mcp', 'a2a']);
    const requested = Array.isArray(input) ? input : [];
    const normalized = [];
    const available = {
        email: Boolean(services.email?.address),
        telegram: Boolean(services.telegram?.handle),
        web: Boolean(services.web?.url),
        mcp: Boolean(services.mcp?.url),
        a2a: Boolean(services.a2a?.url),
    };
    for (const value of requested) {
        const channel = typeof value === 'string' ? value.trim().toLowerCase() : '';
        if (!allowed.has(channel) || !available[channel]) continue;
        if (!normalized.includes(channel)) normalized.push(channel);
    }
    if (!normalized.length) {
        for (const value of fallback) {
            const channel = typeof value === 'string' ? value.trim().toLowerCase() : '';
            if (!allowed.has(channel) || !available[channel]) continue;
            if (!normalized.includes(channel)) normalized.push(channel);
        }
    }
    if (!normalized.length) {
        for (const channel of ['email', 'telegram', 'web', 'mcp', 'a2a']) {
            if (available[channel]) normalized.push(channel);
        }
    }
    return normalized;
}

function normalizeNotificationChannels(input, contact = {}) {
    const allowed = new Set(['email', 'telegram']);
    const requested = Array.isArray(input) ? input : [];
    const normalized = [];
    for (const value of requested) {
        const channel = typeof value === 'string' ? value.trim().toLowerCase() : '';
        if (!allowed.has(channel)) continue;
        if (channel === 'email' && !contact.email) continue;
        if (channel === 'telegram' && !contact.telegram) continue;
        if (!normalized.includes(channel)) normalized.push(channel);
    }
    if (!normalized.length) {
        if (contact.email) normalized.push('email');
        if (contact.telegram) normalized.push('telegram');
    }
    return normalized;
}

function sanitizeHumanContact(input, existing = {}) {
    const next = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    return {
        email: clampEmail(next.email ?? existing.email ?? ''),
        telegram: clampHandle(next.telegram ?? existing.telegram ?? '', 64),
    };
}

function sanitizePrincipalServices(input, existing = {}, contact = {}) {
    const next = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    const prev = existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {};
    const out = {};

    const webUrl = clampUrl(next.web?.url ?? prev.web?.url ?? '');
    if (webUrl) out.web = { url: webUrl };

    const emailAddress = clampEmail(next.email?.address ?? contact.email ?? prev.email?.address ?? '');
    if (emailAddress) out.email = { address: emailAddress };

    const telegramHandle = clampHandle(next.telegram?.handle ?? contact.telegram ?? prev.telegram?.handle ?? '', 64);
    if (telegramHandle) out.telegram = { handle: telegramHandle };

    const mcpUrl = clampUrl(next.mcp?.url ?? prev.mcp?.url ?? '');
    if (mcpUrl) out.mcp = { url: mcpUrl };

    const a2aUrl = clampUrl(next.a2a?.url ?? prev.a2a?.url ?? '');
    if (a2aUrl) out.a2a = { url: a2aUrl };

    const ensName = clampIdLike(next.ens?.name ?? prev.ens?.name ?? '', 128);
    if (ensName) out.ens = { name: ensName };

    const didId = clampIdLike(next.did?.id ?? prev.did?.id ?? '', 256);
    if (didId) out.did = { id: didId };

    return out;
}

function sanitizePrincipalMetadata(input, existing = {}, enforced = {}, options = {}) {
    const next = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    const prev = existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {};
    const services = options.services || {};
    const fallbackChannels = options.fallbackChannels || [];
    const meta = {
        entityType: clampIdLike(next.entityType ?? prev.entityType ?? enforced.entityType ?? '', 32),
        principalType: clampIdLike(next.principalType ?? prev.principalType ?? enforced.principalType ?? '', 32),
        timezone: clampIdLike(next.timezone ?? prev.timezone ?? enforced.timezone ?? '', 64),
        languages: clampList(next.languages ?? prev.languages ?? enforced.languages ?? [], 8, 16),
        region: clampIdLike(next.region ?? prev.region ?? enforced.region ?? '', 64),
        openToWork: next.openToWork != null ? Boolean(next.openToWork) : (prev.openToWork != null ? Boolean(prev.openToWork) : (enforced.openToWork != null ? Boolean(enforced.openToWork) : true)),
        preferredCommunicationChannels: [],
        acceptedPayments: clampList(next.acceptedPayments ?? prev.acceptedPayments ?? enforced.acceptedPayments ?? [], 8, 24),
        serviceCategories: clampList(next.serviceCategories ?? prev.serviceCategories ?? enforced.serviceCategories ?? [], 12, 64),
        linkedAccounts: clampObjectStrings(next.linkedAccounts ?? prev.linkedAccounts ?? enforced.linkedAccounts ?? {}, 16, 128),
    };

    const preferredCommunicationChannels = normalizeCommunicationChannels(
        next.preferredCommunicationChannels ?? prev.preferredCommunicationChannels ?? enforced.preferredCommunicationChannels ?? [],
        services,
        fallbackChannels,
    );
    if (preferredCommunicationChannels.length) meta.preferredCommunicationChannels = preferredCommunicationChannels;

    for (const key of ['organization', 'framework', 'operatorType', 'managedBy', 'linkedHuman']) {
        const value = clampIdLike(next[key] ?? prev[key] ?? enforced[key] ?? '', 128);
        if (value) meta[key] = value;
    }

    const linkedAgents = clampList(next.linkedAgents ?? prev.linkedAgents ?? enforced.linkedAgents ?? [], 32, 64);
    if (linkedAgents.length) meta.linkedAgents = linkedAgents;

    return meta;
}

function sanitizeHumanNotificationPreferences(input, existing = {}, contact = {}) {
    const next = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    const channels = normalizeNotificationChannels(next.channels ?? existing.channels, contact);
    const requestedPreferred = typeof next.preferredChannel === 'string'
        ? next.preferredChannel.trim().toLowerCase()
        : typeof existing.preferredChannel === 'string'
            ? existing.preferredChannel.trim().toLowerCase()
            : '';
    const preferredChannel = channels.includes(requestedPreferred) ? requestedPreferred : (channels[0] || null);
    return {
        channels,
        preferredChannel,
        proposalAlerts: next.proposalAlerts != null ? Boolean(next.proposalAlerts) : (existing.proposalAlerts ?? true),
        taskAlerts: next.taskAlerts != null ? Boolean(next.taskAlerts) : (existing.taskAlerts ?? true),
    };
}

function getAgentSocials(tokenId) {
    try {
        const sdb = getSoulDb();
        const row = sdb.prepare('SELECT x, github, website, telegram, email FROM agent_socials WHERE tokenId = ?').get(tokenId);
        sdb.close();
        if (!row) return {};
        const socials = {};
        if (row.x) socials.x = row.x;
        if (row.github) socials.github = row.github;
        if (row.website) socials.website = row.website;
        if (row.telegram) socials.telegram = row.telegram;
        if (row.email) socials.email = row.email;
        return socials;
    } catch {
        return {};
    }
}

const AURA_CACHE_TTL_MS = 5 * 60 * 1000;
const AURA_PENDING_STALE_MS = 20 * 1000;
const auraPngCache = new Map();

function getLocalAuraAgentRow(tokenId) {
    try {
        const Database = require('better-sqlite3');
        const db = new Database(path.join(__dirname, '..', 'data', 'agents.db'), { readonly: true, fileMustExist: true });
        const row = db.prepare(`
            SELECT tokenId, name, agentAddress, framework, verified, soulbound, credScore, points, owner, operator
            FROM agents
            WHERE tokenId = ?
        `).get(Number(tokenId));
        db.close();
        return row || null;
    } catch {
        return null;
    }
}

function isStaleAuraPending(entry) {
    return Boolean(entry?.pending && entry?.pendingStartedAt && (Date.now() - entry.pendingStartedAt > AURA_PENDING_STALE_MS));
}

async function formatAgentAuraSource(tokenId) {
    const profile = getProfile(tokenId);
    const localRow = getLocalAuraAgentRow(tokenId);

    if (localRow) {
        return {
            tokenId: Number(tokenId),
            name: localRow.name || `Agent #${tokenId}`,
            framework: localRow.framework || 'custom',
            agentAddress: localRow.agentAddress || localRow.owner || localRow.operator || '0x0000',
            traits: Array.isArray(profile?.traits) ? profile.traits : [],
            mutationCount: 0,
            soulbound: Boolean(localRow.soulbound),
            points: Number(localRow.points || 0),
            generation: 0,
            personality: profile?.personality || null,
            narrative: profile?.narrative || null,
            credScore: Number(localRow.credScore || 0),
        };
    }

    if (!isContractDeployed()) throw new Error('V2 contract not yet deployed');

    const safe = (p, fallback = null) => p.catch(() => fallback);
    const [agent, owner, personalityRes, narrativeRes, traitsRes, ptsRes, credRes, nameRes] = await Promise.all([
        readContract.getAgent(tokenId),
        safe(readContract.ownerOf(tokenId)),
        safe(readContract.getPersonality(tokenId)),
        safe(readContract.getNarrative(tokenId)),
        safe(readContract.getTraits(tokenId), []),
        safe(readContract.points(tokenId), 0),
        safe(readContract.getCredScore(tokenId), 0),
        safe(readContract.nameOf(tokenId), ''),
    ]);

    let personality = personalityRes ? {
        quirks: personalityRes[0],
        communicationStyle: personalityRes[1],
        values: personalityRes[2],
        humor: personalityRes[3],
        riskTolerance: Number(personalityRes[4]),
        autonomyLevel: Number(personalityRes[5]),
    } : null;

    let narrative = narrativeRes ? {
        origin: narrativeRes.origin,
        mission: narrativeRes.mission,
        lore: narrativeRes.lore,
        manifesto: narrativeRes.manifesto,
    } : null;

    const onchainTraits = Array.isArray(traitsRes)
        ? traitsRes.map((t) => ({
            name: typeof t === 'string' ? t : t.name,
            category: typeof t === 'string' ? 'trait' : t.category,
        }))
        : [];

    if (profile?.personality) personality = { ...(personality || {}), ...profile.personality };
    if (profile?.narrative) narrative = { ...(narrative || {}), ...profile.narrative };

    const traits = [...onchainTraits];
    if (Array.isArray(profile?.traits) && profile.traits.length > 0) {
        const existingNames = new Set(traits.map((t) => t.name));
        for (const t of profile.traits) {
            if (!t?.name || existingNames.has(t.name)) continue;
            traits.push(t);
            existingNames.add(t.name);
        }
    }

    return {
        tokenId: Number(tokenId),
        name: nameRes || agent.name || `Agent #${tokenId}`,
        framework: agent.framework || 'custom',
        agentAddress: agent.agentAddress || owner || '0x0000',
        traits,
        mutationCount: Number(agent.mutationCount || 0),
        soulbound: Boolean(agent.soulbound),
        points: Number(ptsRes || 0),
        generation: Number(agent.generation || 0),
        personality,
        narrative,
        credScore: Number(credRes || 0),
    };
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

    // Fetch Ethos score for owner AND operator (best score wins, per whitepaper)
    // "Agents can link a human wallet to inherit their human operator's external reputation scores"
    let ethosScore = null;
    const operatorAddr = (() => { try { const Database = require('better-sqlite3'); const sdb = new Database(path.join(__dirname, '..', 'data', 'agents.db')); const row = sdb.prepare('SELECT operator FROM agents WHERE tokenId = ?').get(Number(tokenId)); sdb.close(); return row?.operator || null; } catch { return null; } })();
    const ethosWallets = [owner, operatorAddr].filter(Boolean);
    for (const wallet of ethosWallets) {
        try {
            const ethosResp = await fetch(`https://api.ethos.network/api/v1/score/address:${wallet}`, { signal: AbortSignal.timeout(3000) });
            if (ethosResp.ok) {
                const ethosData = await ethosResp.json();
                if (ethosData.ok && ethosData.data?.score && (!ethosScore || ethosData.data.score > ethosScore)) {
                    ethosScore = ethosData.data.score;
                }
            }
        } catch {}
    }

    // Fetch Talent Protocol builder score for owner AND operator (best score wins)
    let talentScore = null;
    try {
        const talentKey = process.env.TALENT_API_KEY || require(require('os').homedir() + '/.config/talent-protocol/config.json').apiKey;
        if (talentKey) {
            for (const wallet of ethosWallets) {
                try {
                    const talentResp = await fetch(`https://api.talentprotocol.com/score?id=${wallet}`, {
                        headers: { 'X-API-KEY': talentKey, 'Accept': 'application/json' },
                        signal: AbortSignal.timeout(3000)
                    });
                    if (talentResp.ok) {
                        const talentData = await talentResp.json();
                        if (talentData.score?.points && (!talentScore || talentData.score.points > talentScore)) {
                            talentScore = talentData.score.points;
                        }
                    }
                } catch {}
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
    const profile = getProfile(tokenId) || {};
    const socials = getAgentSocials(Number(tokenId));
    const result = {
        tokenId: Number(tokenId),
        agentAddress: agent.agentAddress,
        name: agent.name,
        framework: agent.framework,
        mintedAt: new Date(Number(agent.mintedAt) * 1000).toISOString(),
        verified: agent.verified,
        soulbound: agent.soulbound || Number(tokenId) === 1 || (() => {
            // Soft soulbound: check DB for agents that opted in post-mint
            try {
                const Database = require('better-sqlite3');
                const sdb = new Database(path.join(__dirname, '..', 'data', 'agents.db'));
                const row = sdb.prepare('SELECT soulbound FROM agents WHERE tokenId = ?').get(Number(tokenId));
                sdb.close();
                return row?.soulbound === 1;
            } catch { return false; }
        })(),
        mintOrigin: (() => {
            const raw = ['HUMAN', 'AGENT_SIWA', 'API', 'OWNER'][Number(agent.origin)] || 'UNKNOWN';
            // If agent has siwa-verified trait, upgrade origin display to AGENT_SIWA
            if (raw === 'HUMAN' && traits.some(t => t.name === 'siwa-verified')) return 'AGENT_SIWA';
            return raw;
        })(),
        generation: Number(agent.generation),
        version: agent.currentVersion,
        mutationCount: Number(agent.mutationCount),
        points: pts,
        credScore,
        ethosScore,
        talentScore,
        owner,
        operator: (() => {
            try {
                const Database = require('better-sqlite3');
                const sdb = new Database(path.join(__dirname, '..', 'data', 'agents.db'));
                const row = sdb.prepare('SELECT operator FROM agents WHERE tokenId = ?').get(Number(tokenId));
                sdb.close();
                return row?.operator || null;
            } catch { return null; }
        })(),
        agentName: agentName || null,
        socials,
        skills: clampList(profile.skills || [], 24, 64),
        domains: clampList(profile.domains || [], 24, 64),
        services: {},
        metadata: {},
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

    const defaultServices = {
        web: { url: `https://helixa.xyz/agent/${tokenId}` },
        ...(socials.email ? { email: { address: socials.email } } : {}),
        ...(socials.telegram ? { telegram: { handle: socials.telegram } } : {}),
        mcp: { url: 'https://api.helixa.xyz/api/mcp' },
        a2a: { url: 'https://api.helixa.xyz/api/a2a' },
    };
    result.services = sanitizePrincipalServices(profile.services, defaultServices, { email: socials.email, telegram: socials.telegram });
    result.metadata = sanitizePrincipalMetadata(
        profile.metadata,
        {},
        { entityType: 'agent', principalType: 'agent', framework: result.framework },
        { services: result.services, fallbackChannels: ['email', 'telegram', 'web', 'mcp', 'a2a'] },
    );

    // Fetch 0xWork stats (non-blocking, best-effort)
    try {
        const { fetchWorkStats } = require('./services/work-stats');
        const workStats = await fetchWorkStats(result.agentAddress);
        if (workStats) result._workStats = workStats;
    } catch {}

    // Fetch Bankr profile (non-blocking, best-effort)
    try {
        const linkedToken = result.traits?.find(t => t.name === 'linked-token');
        if (linkedToken) {
            // Check DexScreener for market cap
            const tokenAddr = linkedToken.category || linkedToken.value;
            if (tokenAddr) {
                const dxRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddr}`);
                if (dxRes.ok) {
                    const dxData = await dxRes.json();
                    const pair = dxData.pairs?.[0];
                    if (pair?.marketCap) result._tokenMarketCap = pair.marketCap;
                }
            }
        }
        // Check if agent's owner wallet has a Bankr profile
        if (result.agentAddress) {
            const bankrKey = process.env.BANKR_LLM_KEY || process.env.BANKR_API_KEY;
            if (bankrKey) {
                const bRes = await fetch('https://api.bankr.bot/agent/profile', {
                    headers: { 'X-API-Key': bankrKey }
                });
                if (bRes.ok) {
                    const profile = await bRes.json();
                    // Check if the token address matches this agent's linked token
                    const lt = result.traits?.find(t => t.name === 'linked-token');
                    const ltAddr = (lt?.category || lt?.value || '').toLowerCase();
                    if (profile.tokenAddress?.toLowerCase() === ltAddr) {
                        result._bankrProfile = true;
                    }
                }
            }
        }
    } catch {}

    // Recompute cred score from merged data (onchain score may be stale)
    try {
        const { computedScore } = computeCredBreakdown(result);
        if (computedScore > result.credScore) result.credScore = computedScore;
    } catch {}

    return result;
}

async function fetchCoinbaseAttestationStatus(walletAddress) {
    try {
        const indexer = new ethers.Contract(COINBASE_INDEXER, COINBASE_INDEXER_ABI, provider);
        const eas = new ethers.Contract(EAS_CONTRACT, EAS_ABI, provider);
        const attestationUid = await indexer.getAttestationUid(walletAddress, COINBASE_VERIFIED_ACCOUNT_SCHEMA);
        if (attestationUid === ethers.ZeroHash) return { verified: false, attestationUid: null };
        const attestation = await eas.getAttestation(attestationUid);
        const now = Math.floor(Date.now() / 1000);
        if ((attestation.revocationTime > 0 && attestation.revocationTime <= now) || (attestation.expirationTime > 0 && attestation.expirationTime <= now)) {
            return { verified: false, attestationUid, revokedOrExpired: true };
        }
        return { verified: true, attestationUid, attester: attestation.attester };
    } catch {
        return { verified: false, attestationUid: null };
    }
}

async function fetchTalentScore(walletAddress) {
    try {
        const talentKey = process.env.TALENT_API_KEY || require(require('os').homedir() + '/.config/talent-protocol/config.json').apiKey;
        if (!talentKey) return null;
        const resp = await fetch(`https://api.talentprotocol.com/score?id=${walletAddress}`, {
            headers: { 'X-API-KEY': talentKey, 'Accept': 'application/json' },
            signal: AbortSignal.timeout(3000),
        });
        if (!resp.ok) return null;
        const data = await resp.json();
        return Number(data?.score?.points || 0) || null;
    } catch {
        return null;
    }
}

async function fetchEthosScore(walletAddress) {
    try {
        const resp = await fetch(`https://api.ethos.network/api/v1/score/address:${walletAddress}`, { signal: AbortSignal.timeout(3000) });
        if (!resp.ok) return null;
        const data = await resp.json();
        return data?.ok && data?.data?.score ? Number(data.data.score) : null;
    } catch {
        return null;
    }
}

function buildHumanRegistrationFile(profile) {
    const walletAddress = profile.walletAddress;
    const tokenId = profile.tokenId ?? null;
    const userId = profile.userId;
    const services = sanitizePrincipalServices(profile.services, profile.services, profile.contact || {});
    // Determine public URL for the profile
    let publicUrl = null;
    if (tokenId !== null) {
        publicUrl = `https://helixa.xyz/h/${tokenId}`;
    } else if (walletAddress) {
        publicUrl = `https://helixa.xyz/h/${walletAddress}`;
    } else if (userId) {
        publicUrl = `https://helixa.xyz/h/${userId}`;
    }
    if (!services.web && publicUrl) services.web = { url: publicUrl };
    const metadata = sanitizePrincipalMetadata(
        profile.metadata,
        profile.metadata,
        {
            entityType: 'human',
            principalType: 'human',
            linkedAccounts: profile.linkedAccounts || {},
            linkedAgents: profile.linkedAgents || [],
            organization: profile.organization || null,
        },
        { services, fallbackChannels: ['email', 'telegram', 'web'] },
    );
    const fallbackName = walletAddress
        ? `Human ${walletAddress.slice(0, 6)}`
        : (userId ? `Human ${userId.slice(0, 8)}` : 'Human');
    return {
        type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
        name: profile.name || fallbackName,
        description: profile.description || 'Human principal in the Helixa network.',
        image: profile.image || null,
        active: profile.active !== false,
        services,
        supportedTrust: Array.isArray(profile.supportedTrust) && profile.supportedTrust.length ? profile.supportedTrust : ['reputation'],
        skills: profile.skills || [],
        domains: profile.domains || [],
        metadata: {
            ...metadata,
            externalIds: profile.externalIds || {},
            notificationChannels: normalizeNotificationChannels(profile.notificationPreferences?.channels, profile.contact || {}),
            contactAvailable: {
                email: Boolean(profile.contact?.email),
                telegram: Boolean(profile.contact?.telegram),
            },
        },
    };
}

async function computeHumanCred(profile) {
    const walletAddress = profile.walletAddress ? ethers.getAddress(profile.walletAddress) : null;
    const hasWallet = Boolean(walletAddress);
    
    const [coinbase, talentScore, ethosScore, txCount] = hasWallet
        ? await Promise.all([
            fetchCoinbaseAttestationStatus(walletAddress),
            fetchTalentScore(walletAddress),
            fetchEthosScore(walletAddress),
            readProvider.getTransactionCount(walletAddress).catch(() => 0),
        ])
        : [null, null, null, 0];

    const weights = hasWallet
        ? {
            verifiedIdentity: 20,
            builderReputation: 20,
            socialReputation: 15,
            onchainHistory: 10,
            workHistory: 15,
            networkEndorsements: 10,
            profileCompleteness: 5,
            longevity: 5,
        }
        : {
            // Rebalance for non‑wallet humans: emphasize profile completeness and work
            verifiedIdentity: 0,
            builderReputation: 0,
            socialReputation: 25,  // external social links still matter
            onchainHistory: 0,
            workHistory: 30,
            networkEndorsements: 20,
            profileCompleteness: 15,
            longevity: 10,
        };

    const linkedAccounts = profile.linkedAccounts || {};
    const hasEnsLike = Boolean(linkedAccounts.ens || linkedAccounts.basename);
    const identityRaw = hasWallet
        ? Math.min(100, (coinbase.verified ? 70 : 0) + (hasEnsLike ? 20 : 0) + (Object.keys(linkedAccounts).length > 0 ? 10 : 0))
        : (hasEnsLike ? 30 : 0) + (Object.keys(linkedAccounts).length > 0 ? 10 : 0);
    const builderRaw = hasWallet
        ? Math.max(0, Math.min(100, Math.round((Number(talentScore || 0) / 400) * 100)))
        : 0;
    const socialRaw = hasWallet
        ? Math.max(0, Math.min(100, Math.round((Number(ethosScore || 0) / 2600) * 100)))
        : (Object.keys(linkedAccounts).length > 0 ? 40 : 0);  // non‑wallet social score based on linked accounts
    const onchainRaw = hasWallet
        ? Math.max(0, Math.min(100, Math.round(Math.log10(Number(txCount || 0) + 1) * 45)))
        : 0;

    const work = profile.workHistory || {};
    const workRaw = Math.max(0, Math.min(100,
        (Math.min(Number(work.completedJobs || 0), 10) * 6) +
        (Math.min(Number(work.repeatClients || 0), 5) * 8) +
        (Math.min(Number(work.referrals || 0), 5) * 4)
    ));

    const endorsements = profile.endorsements || {};
    const endorsementRaw = Math.max(0, Math.min(100,
        (Math.min(Number(endorsements.count || 0), 10) * 7) +
        (Math.min(Number(endorsements.positiveReviews || 0), 6) * 5)
    ));

    let completenessChecks = 0;
    if (profile.name) completenessChecks++;
    if (profile.description) completenessChecks++;
    if (Array.isArray(profile.skills) && profile.skills.length) completenessChecks++;
    if (Array.isArray(profile.domains) && profile.domains.length) completenessChecks++;
    if (Object.keys(linkedAccounts).length) completenessChecks++;
    const profileRaw = Math.round((completenessChecks / 5) * 100);

    const createdAt = profile.createdAt ? Date.parse(profile.createdAt) : Date.now();
    const ageDays = Math.max(0, Math.floor((Date.now() - createdAt) / 86400000));
    const longevityRaw = Math.min(100, Math.round((ageDays / 365) * 100));

    const weighted = {
        verifiedIdentity: Math.round(identityRaw * weights.verifiedIdentity / 100),
        builderReputation: Math.round(builderRaw * weights.builderReputation / 100),
        socialReputation: Math.round(socialRaw * weights.socialReputation / 100),
        onchainHistory: Math.round(onchainRaw * weights.onchainHistory / 100),
        workHistory: Math.round(workRaw * weights.workHistory / 100),
        networkEndorsements: Math.round(endorsementRaw * weights.networkEndorsements / 100),
        profileCompleteness: Math.round(profileRaw * weights.profileCompleteness / 100),
        longevity: Math.round(longevityRaw * weights.longevity / 100),
    };

    const score = Object.values(weighted).reduce((a, b) => a + b, 0);
    return {
        score: Math.max(0, Math.min(100, score)),
        tier: getCredTier(Math.max(0, Math.min(100, score))),
        walletAddress,
        tokenId: profile.tokenId ?? null,
        sources: {
            coinbaseVerified: coinbase.verified,
            coinbaseAttestationUid: coinbase.attestationUid,
            talentScore,
            ethosScore,
            txCount,
        },
        breakdown: {
            verifiedIdentity: { weight: weights.verifiedIdentity, raw: identityRaw, contribution: weighted.verifiedIdentity },
            builderReputation: { weight: weights.builderReputation, raw: builderRaw, contribution: weighted.builderReputation },
            socialReputation: { weight: weights.socialReputation, raw: socialRaw, contribution: weighted.socialReputation },
            onchainHistory: { weight: weights.onchainHistory, raw: onchainRaw, contribution: weighted.onchainHistory },
            workHistory: { weight: weights.workHistory, raw: workRaw, contribution: weighted.workHistory },
            networkEndorsements: { weight: weights.networkEndorsements, raw: endorsementRaw, contribution: weighted.networkEndorsements },
            profileCompleteness: { weight: weights.profileCompleteness, raw: profileRaw, contribution: weighted.profileCompleteness },
            longevity: { weight: weights.longevity, raw: longevityRaw, contribution: weighted.longevity },
        },
    };
}

async function formatHumanPrincipal(profile, options = {}) {
    const { includePrivate = false } = options;
    const registration = buildHumanRegistrationFile(profile);
    const cred = await computeHumanCred(profile);
    const notificationPreferences = sanitizeHumanNotificationPreferences(profile.notificationPreferences, profile.notificationPreferences, profile.contact || {});
    const publicContact = {
        hasEmail: Boolean(profile.contact?.email),
        hasTelegram: Boolean(profile.contact?.telegram),
        channels: notificationPreferences.channels,
    };
    return {
        id: profile.tokenId ?? profile.walletAddress ?? profile.userId,
        walletAddress: cred.walletAddress,
        tokenId: profile.tokenId ?? null,
        entityType: 'human',
        name: profile.name,
        description: profile.description || null,
        image: profile.image || null,
        organization: profile.organization || null,
        skills: profile.skills || [],
        domains: profile.domains || [],
        linkedAccounts: profile.linkedAccounts || {},
        linkedAgents: profile.linkedAgents || [],
        externalIds: profile.externalIds || {},
        services: registration.services,
        contact: includePrivate ? (profile.contact || { email: '', telegram: '' }) : publicContact,
        notificationPreferences,
        metadata: registration.metadata,
        humanCred: cred,
        registration,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
    };
}

// ─── Public Endpoints ───────────────────────────────────────────

// Discovery
app.get(['/', '/api/v2'], (req, res) => {
    res.json({
        name: 'Helixa V2 API',
        version: '2.0.0',
        description: 'Agent identity infrastructure with SIWA for agents, SIWE for humans, plus x402 and MPP payments',
        contract: V2_CONTRACT_ADDRESS,
        contractDeployed: isContractDeployed(),
        network: 'Base (8453)',
        auth: {
            agent: {
                type: 'SIWA (Sign-In With Agent)',
                header: 'Authorization: Bearer {address}:{timestamp}:{signature}',
                message: `Sign-In With Agent: ${SIWA_DOMAIN} wants you to sign in with your wallet {address} at {timestamp}`,
                expiry: '1 hour',
            },
            human: {
                type: 'SIWE (Sign-In With Ethereum) or Privy access token',
                header: 'Authorization: Bearer {address}:{timestamp}:{signature} (SIWE) or Bearer {access-token} (Privy)',
                message: `Sign-In With Ethereum: ${SIWE_DOMAIN} wants you to sign in with your wallet {address} at {timestamp}`,
                expiry: '1 hour (SIWE) / as per token (Privy)',
            },
        },
        endpoints: {
            public: {
                'GET /api/v2/stats': 'Protocol statistics',
                'GET /api/v2/agents': 'Agent directory (paginated)',
                'GET /api/v2/agent/:id': 'Single agent profile',
                'GET /api/v2/human/:id': 'Single human principal profile',
                'GET /api/v2/human/:id/cred': 'Human Cred score and breakdown',
                'GET /api/v2/name/:name': 'Name availability check',
            },
            authenticated: {
                'POST /api/v2/mint': 'Register new agent (SIWA required, free Phase 1)',
                'POST /api/v2/principals/human/register': 'Register or mint a human principal profile (SIWE or Privy access token)',
                'POST /api/v2/human/:id/link-agent': 'Link an owned agent to a human principal (SIWE required)',
                'POST /api/v2/agent/:id/update': 'Update agent (SIWA required)',
                'POST /api/v2/agent/:id/verify': 'Verify agent identity (SIWA required)',
                'POST /api/v2/agent/:id/crossreg': 'Cross-register on canonical 8004 Registry (SIWA required)',
                'POST /api/v2/register/solana': 'Register a Solana agent on Base (no SIWA needed)',
                'GET /api/v2/auth/solana/challenge': 'Get SIWS challenge message to sign',
                'POST /api/v2/auth/solana/verify': 'Verify a Solana signature (test endpoint)',
                'POST /api/v2/agent/:id/coinbase-verify': 'Check Coinbase EAS attestation & boost Cred (SIWA required)',
            },
        },
        payments: {
            methods: [
                { protocol: 'x402', status: 'active', chain: 'Base (8453)', currency: 'USDC' },
                { protocol: 'x402', status: 'active', chain: 'Base (8453)', currency: '$CRED', discount: '20%', token: '0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3' },
                ...(mppServer ? [{ protocol: 'MPP', status: 'active', chain: 'Tempo (4217)', currency: 'USDC.e', spec: 'https://mpp.dev' }] : []),
            ],
            pricing: {
                phase: 1,
                note: 'All operations free during Phase 1 (0-1000 agents)',
                agentMint: PRICING.agentMint === 0 ? 'free' : `$${PRICING.agentMint} USDC`,
                update: PRICING.update === 0 ? 'free' : `$${PRICING.update} USDC`,
            },
        },
    });
});

// Temporary dashboard preview
app.get('/preview/dashboard', (req, res) => {
    const previewPath = path.resolve(__dirname, 'public', 'dashboard-preview.html');
    if (fs.existsSync(previewPath)) return res.type('html').send(fs.readFileSync(previewPath, 'utf8'));
    res.status(404).send('No preview');
});

app.get('/mcp', (req, res) => {
    const landingPath = path.resolve(__dirname, 'public', 'mcp.html');
    if (fs.existsSync(landingPath)) return res.type('html').send(fs.readFileSync(landingPath, 'utf8'));
    res.status(404).send('No MCP landing page');
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', version: 'v2', port: PORT, contractDeployed: isContractDeployed() });
});

// GET /api/v2/pricing — Current prices in USDC and $CRED
// Bankr Router stats + dry-run
app.get('/api/v2/llm/stats', (req, res) => {
    try {
        const bankrRouter = require('./services/bankr-router');
        res.json(bankrRouter.getStats());
    } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/v2/llm/dry-run', express.json(), async (req, res) => {
    try {
        const bankrRouter = require('./services/bankr-router');
        const result = await bankrRouter.route({ ...req.body, dryRun: true });
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/v2/pricing', (req, res) => {
    const credPrice = credOracle.getCredPriceUSDC();
    const services = {};
    for (const [key, usdPrice] of Object.entries(PRICING)) {
        if (usdPrice === 0) {
            services[key] = { usdc: 'free', cred: 'free' };
        } else {
            const credAmount = credOracle.getCredAmountForUSD(usdPrice);
            services[key] = {
                usdc: `$${usdPrice}`,
                cred: credAmount != null ? { amount: credAmount, formatted: `${Math.ceil(credAmount).toLocaleString()} CRED`, discount: '20%' } : null,
            };
        }
    }
    res.json({
        credToken: credOracle.CRED_ADDRESS,
        credPriceUSD: credPrice,
        credDecimals: credOracle.CRED_DECIMALS,
        discount: '20% when paying with $CRED',
        services,
        oracleStatus: credPrice != null ? 'active' : 'unavailable (USDC only)',
    });
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

// ─── Market Intelligence (Checkr + DexScreener) ────────────────
const marketIntelCache = { data: null, ts: 0 };
const MARKET_INTEL_TTL = 5 * 60 * 1000; // 5 min cache

async function fetchMarketIntel() {
    const now = Date.now();
    if (marketIntelCache.data && (now - marketIntelCache.ts) < MARKET_INTEL_TTL) {
        return marketIntelCache.data;
    }

    const results = {};

    // Checkr bankr attention (2h window) — x402 payment
    try {
        const { wrapFetchWithPayment, x402Client } = require('@x402/fetch');
        const { ExactEvmScheme } = require('@x402/evm/exact/client');
        const { privateKeyToAccount } = require('viem/accounts');
        
        const currentKey = svc.DEPLOYER_KEY;
        if (currentKey) {
            const account = privateKeyToAccount(currentKey);
            const client = new x402Client();
            client.register('eip155:*', new ExactEvmScheme(account));
            const x402Fetch = wrapFetchWithPayment(fetch, client);

            const bankrRes = await x402Fetch('https://api.checkr.social/v1/bankr?hours=2');
            if (bankrRes.status === 200) {
                const bankr = await bankrRes.json();
                const cred = bankr.leaderboard?.find(e => e.symbol.toLowerCase() === 'cred');
                results.attention = {
                    source: 'checkr.social',
                    window_hours: bankr.window_hours,
                    data_age_minutes: bankr.data_age_minutes,
                    agents_tracked: bankr.agents_tracked,
                    active_agents: bankr.active_agents,
                    cred: cred || null,
                    top5: (bankr.leaderboard || []).slice(0, 5).map(a => ({
                        symbol: a.symbol, ATT_pct: a.ATT_pct, rank: a.rank,
                        delta: a.ATT_delta, velocity: a.velocity, authors: a.unique_authors,
                        fees_24h: a.fee_revenue_24h,
                    })),
                    updated_at: bankr.updated_at,
                };
            }
        }
    } catch (e) {
        console.warn('Market intel Checkr error:', e.message);
        results.attention = { error: e.message };
    }

    // DexScreener price data
    try {
        const dexRes = await fetch('https://api.dexscreener.com/latest/dex/tokens/0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3');
        if (dexRes.ok) {
            const dex = await dexRes.json();
            const pair = dex.pairs?.[0];
            if (pair) {
                results.price = {
                    source: 'dexscreener',
                    usd: parseFloat(pair.priceUsd) || 0,
                    change_1h: pair.priceChange?.h1 || 0,
                    change_24h: pair.priceChange?.h24 || 0,
                    volume_24h: parseFloat(pair.volume?.h24) || 0,
                    liquidity: parseFloat(pair.liquidity?.usd) || 0,
                    mcap: parseFloat(pair.fdv) || 0,
                    txns_24h: (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0),
                    pair_url: pair.url,
                };
            }
        }
    } catch (e) {
        console.warn('Market intel DexScreener error:', e.message);
        results.price = { error: e.message };
    }

    // Protocol stats summary
    try {
        const all = indexer.getAllAgents();
        const scored = all.filter(a => a.credScore > 0);
        results.protocol = {
            total_agents: all.length,
            scored_agents: scored.length,
            avg_cred: scored.length ? Math.round(scored.reduce((s, a) => s + a.credScore, 0) / scored.length) : 0,
        };
    } catch (e) { /* skip */ }

    results.cached_at = new Date().toISOString();
    marketIntelCache.data = results;
    marketIntelCache.ts = now;
    return results;
}

app.get('/api/v2/market-intel', async (req, res) => {
    try {
        const data = await fetchMarketIntel();
        res.json(data);
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

// GET /api/v2/human/:id
app.get('/api/v2/human/:id', async (req, res) => {
    try {
        const profile = getHumanProfileById(req.params.id);
        if (!profile) return res.status(404).json({ error: 'Human principal not found' });
        res.json(await formatHumanPrincipal(profile, { includePrivate: false }));
    } catch (e) {
        res.status(500).json({ error: 'Failed to load human principal', detail: e.message.slice(0, 200) });
    }
});

// GET /api/v2/human/:id/cred
app.get('/api/v2/human/:id/cred', async (req, res) => {
    try {
        const profile = getHumanProfileById(req.params.id);
        if (!profile) return res.status(404).json({ error: 'Human principal not found' });
        res.json(await computeHumanCred(profile));
    } catch (e) {
        res.status(500).json({ error: 'Failed to compute Human Cred', detail: e.message.slice(0, 200) });
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
            { trait_type: 'Registration Origin', value: agent.mintOrigin },
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
        
        const agentName = agent.name || `Helixa Agent #${agent.tokenId}`;
        const agentDesc = agent.narrative?.mission 
            ? `${agent.name} — ${agent.narrative.mission}`
            : `${agent.name} — Helixa V2 Agent #${agent.tokenId} on Base. Cred Score: ${agent.credScore}. ${tier} tier.`;
        
        res.json({
            // ERC-8004 registration file fields
            type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
            name: agentName,
            description: agentDesc,
            image: imageUrl,
            services: [
                { name: 'web', endpoint: `https://helixa.xyz/agent/${agent.tokenId}` },
                { name: 'A2A', endpoint: 'https://api.helixa.xyz/.well-known/agent-card.json', version: '0.3.0' },
                { name: 'MCP', endpoint: 'https://api.helixa.xyz/api/mcp', version: '2025-06-18' },
                { name: 'OASF', endpoint: 'https://api.helixa.xyz/.well-known/oasf-record.json', version: '0.8' },
            ],
            x402Support: true,
            active: true,
            registrations: [
                {
                    agentId: agent.tokenId,
                    agentRegistry: `eip155:8453:${V2_CONTRACT_ADDRESS}`,
                },
            ],
            supportedTrust: ['reputation'],
            // OpenSea-compatible fields (backward compat)
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
        const cached = auraPngCache.get(tokenId);

        if (cached?.buffer && cached.expiresAt > Date.now()) {
            res.set('Content-Type', 'image/png');
            res.set('Cache-Control', 'public, max-age=300');
            return res.send(cached.buffer);
        }
        if (isStaleAuraPending(cached)) auraPngCache.delete(tokenId);

        let pending = cached?.pending;
        if (!pending) {
            pending = (async () => {
                const agent = await formatAgentAuraSource(tokenId);

                // Keep aura generation lightweight. This route is hit by the Trust Graph UI,
                // so avoid the slow external enrichments in the full agent formatter.
                const p = agent.personality || {};
                const n = agent.narrative || {};
                const auraData = {
                    name: agent.name || `Agent #${tokenId}`,
                    address: agent.agentAddress || '0x0000',
                    agentAddress: agent.agentAddress || '0x0000',
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
                return sharp(Buffer.from(svg)).png().toBuffer();
            })();
            auraPngCache.set(tokenId, { buffer: cached?.buffer || null, expiresAt: 0, pending, pendingStartedAt: Date.now() });
        }

        const png = await pending;
        auraPngCache.set(tokenId, { buffer: png, expiresAt: Date.now() + AURA_CACHE_TTL_MS, pending: null, pendingStartedAt: 0 });

        res.set('Content-Type', 'image/png');
        res.set('Cache-Control', 'public, max-age=300');
        res.send(png);
    } catch (e) {
        auraPngCache.delete(parseInt(req.params.id));
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
    const { name, framework, soulbound, personality, narrative, referralCode, services, skills, domains, metadata } = req.body;
    
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
    if (!acquireMintRequestLock(req, res, agentAddress)) {
        return res.status(409).json({ error: 'Mint already in progress for this address' });
    }
    
    if (!isContractDeployed()) {
        // TODO: Once V2 contract is deployed, remove this block
        return res.status(503).json({
            error: 'V2 contract not yet deployed',
            hint: 'Set V2_CONTRACT in .env once deployed',
            received: { name, framework: fw, agentAddress, soulbound, personality, narrative },
            message: 'Your registration request is valid and will work once V2 is live',
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
            
            const registrationFile = build8004RegistrationFile(tokenId, name, fw, req.body.narrative, {
                credScore: 40, // Base score for fresh mint
                credTier: 'MARGINAL',
                hasSiwa: true, // Just authenticated via SIWA
            });
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
        
        // ─── Helixa Agent Terminal: merge/upgrade existing entry ────────
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
        
        const normalizedServices = sanitizePrincipalServices(services, {}, {});
        const normalizedMetadata = sanitizePrincipalMetadata(
            metadata,
            {},
            { entityType: 'agent', principalType: 'agent', framework: fw },
            { services: normalizedServices, fallbackChannels: ['email', 'telegram', 'web', 'mcp', 'a2a'] },
        );
        if (tokenId !== null) {
            const publicProfile = {};
            const normalizedSkills = clampList(skills || [], 24, 64);
            const normalizedDomains = clampList(domains || [], 24, 64);
            if (Object.keys(normalizedServices).length) publicProfile.services = normalizedServices;
            if (normalizedSkills.length) publicProfile.skills = normalizedSkills;
            if (normalizedDomains.length) publicProfile.domains = normalizedDomains;
            if (Object.keys(normalizedMetadata).length) publicProfile.metadata = normalizedMetadata;
            if (Object.keys(publicProfile).length) saveProfile(tokenId, publicProfile);
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
                skills: agentData.skills,
                domains: agentData.domains,
                services: agentData.services,
                metadata: agentData.metadata,
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
        res.status(500).json({ error: 'Registration failed: ' + e.message.slice(0, 200) });
    }
}

// x402-gated mint (standard flow)
app.post('/api/v2/mint', requireSIWA, mintHandler);

// TX-hash payment mint (alternative for agents that can't use x402 SDK)
app.post('/api/v2/mint-with-tx', requireSIWA, async (req, res) => {
    const { paymentTx } = req.body;
    if (!paymentTx) return res.status(400).json({ error: 'paymentTx required (USDC transfer TX hash)' });
    if (!acquireMintRequestLock(req, res, req.agent?.address)) {
        return res.status(409).json({ error: 'Mint already in progress for this address' });
    }
    try {
        const hasMinted = await readContract.hasMinted(req.agent.address);
        if (hasMinted) return res.status(409).json({ error: 'This address already has an agent' });
    } catch {}
    if (usedPaymentTxs.has(paymentTx.toLowerCase())) return res.status(400).json({ error: 'Payment TX already used' });
    
    try {
        const mintPrice = resolvePrice('agentMint', req);
        const result = await verifyUSDCTransfer(paymentTx, mintPrice, DEPLOYER_ADDRESS);
        usedPaymentTxs.add(paymentTx.toLowerCase());
        req.paymentVerified = result;
        const partnerId = (req.get('X-Partner-ID') || req.query?.partner || '').toLowerCase().trim();
        console.log(`[TX PAYMENT] Verified $${result.amount} USDC from ${result.from} (${paymentTx.slice(0,10)}...)${partnerId ? ` [partner: ${partnerId}, price: $${mintPrice}]` : ''}`);
        return mintHandler(req, res);
    } catch (e) {
        const mintPrice = resolvePrice('agentMint', req);
        return res.status(402).json({
            error: `Payment verification failed: ${e.message}`,
            hint: `Send $${mintPrice} USDC to ${DEPLOYER_ADDRESS} on Base, then include the TX hash as paymentTx`,
            payTo: DEPLOYER_ADDRESS,
            amount: `${mintPrice} USDC`,
            network: 'Base (chain 8453)',
        });
    }
});

// ─── POST /api/v2/register/solana — Register a Solana agent on Base ───
// No SIWA required (Solana agents can't sign EVM messages)
// Generates an EVM wallet, mints via mintFor(), stores cross-chain link
app.post('/api/v2/register/solana', async (req, res) => {
    const { name, framework, solanaAddress, soulbound } = req.body;

    if (!name || typeof name !== 'string' || name.length < 1 || name.length > 64) {
        return res.status(400).json({ error: 'name required (1-64 chars)' });
    }
    const NAME_REGEX = /^[\x20-\x7E\u00C0-\u024F\u0370-\u03FF]{1,64}$/;
    if (!NAME_REGEX.test(name)) {
        return res.status(400).json({ error: 'Name contains invalid characters' });
    }
    if (!solanaAddress || typeof solanaAddress !== 'string' || solanaAddress.length < 32 || solanaAddress.length > 44) {
        return res.status(400).json({ error: 'solanaAddress required (base58 Solana public key)' });
    }

    const fw = (framework || 'custom').toLowerCase();
    const VALID_FRAMEWORKS = ['openclaw', 'eliza', 'langchain', 'crewai', 'autogpt', 'bankr', 'virtuals', 'based', 'agentkit', 'custom'];
    if (!VALID_FRAMEWORKS.includes(fw)) {
        return res.status(400).json({ error: `framework must be one of: ${VALID_FRAMEWORKS.join(', ')}` });
    }

    if (!isContractDeployed()) {
        return res.status(503).json({ error: 'Contract not available for minting' });
    }

    try {
        // Generate a fresh EVM wallet for this Solana agent
        const evmWallet = ethers.Wallet.createRandom();
        const evmAddress = evmWallet.address;

        // Mint on Base via mintFor
        console.log(`[SOLANA REG] ${name} (${fw}) solana:${solanaAddress} -> evm:${evmAddress}`);
        const tx = await contract.mintFor(
            evmAddress,     // to (owner)
            evmAddress,     // agentAddress
            name,
            fw,
            soulbound === true,
            2,              // MintOrigin.CROSS_CHAIN = 2
        );
        console.log(`[SOLANA REG] TX: ${tx.hash}`);
        const receipt = await tx.wait();

        // Extract tokenId
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

        // Store cross-chain link in dedicated DB
        try {
            const Database = require('better-sqlite3');
            const dbPath = path.join(__dirname, '..', 'data', 'solana-registrations.db');
            const dataDir = path.join(__dirname, '..', 'data');
            if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
            const db = new Database(dbPath);
            db.pragma('journal_mode = WAL');
            db.exec(`CREATE TABLE IF NOT EXISTS solana_registrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                token_id INTEGER UNIQUE,
                solana_address TEXT NOT NULL,
                evm_address TEXT NOT NULL,
                evm_private_key TEXT NOT NULL,
                name TEXT,
                framework TEXT,
                registered_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
            db.prepare(`INSERT INTO solana_registrations (token_id, solana_address, evm_address, evm_private_key, name, framework)
                VALUES (?, ?, ?, ?, ?, ?)`).run(tokenId, solanaAddress, evmAddress, evmWallet.privateKey, name, fw);
            db.close();
            console.log(`[SOLANA REG] Stored in DB: #${tokenId} ${solanaAddress} -> ${evmAddress}`);
        } catch (dbErr) {
            console.error('[SOLANA REG] DB store failed:', dbErr.message);
        }

        res.json({
            success: true,
            tokenId,
            evmAddress,
            solanaAddress,
            name,
            framework: fw,
            soulbound: soulbound === true,
            tx: tx.hash,
            explorer: `https://basescan.org/tx/${tx.hash}`,
            profile: `https://helixa.xyz/agent/${tokenId}`,
            card: `https://helixa.xyz/card/${tokenId}`,
        });
    } catch (e) {
        console.error('[SOLANA REG] Error:', e.message);
        res.status(500).json({ error: 'Registration failed: ' + e.message.slice(0, 200) });
    }
});

// ─── Solana Lookup (for SIWS auth) ─────────────────────────────
function lookupSolanaRegistration(solanaAddress) {
    try {
        // Search indexer DB for agents whose EVM address was generated for this Solana address
        // We stored the link in solana_registrations table (if DB path was correct)
        // Fallback: search by matching the registration log or agent metadata
        const Database = require('better-sqlite3');
        const dbPath = path.join(__dirname, '..', 'data', 'solana-registrations.db');
        const db = new Database(dbPath);
        db.pragma('journal_mode = WAL');
        db.exec(`CREATE TABLE IF NOT EXISTS solana_registrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            token_id INTEGER UNIQUE,
            solana_address TEXT NOT NULL,
            evm_address TEXT NOT NULL,
            name TEXT,
            framework TEXT,
            registered_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        const row = db.prepare('SELECT * FROM solana_registrations WHERE solana_address = ?').get(solanaAddress);
        db.close();
        if (row) return { tokenId: row.token_id, evmAddress: row.evm_address, name: row.name };
        return null;
    } catch (e) {
        console.error('[SIWS LOOKUP] Error:', e.message);
        return null;
    }
}

// Expose for middleware
const solanaAuthMiddleware = requireAuth(lookupSolanaRegistration);

// ─── GET /api/v2/auth/solana/challenge ─────────────────────────
app.get('/api/v2/auth/solana/challenge', (req, res) => {
    const { address } = req.query;
    if (!address || address.length < 32 || address.length > 44) {
        return res.status(400).json({ error: 'address required (base58 Solana public key)' });
    }

    const timestamp = Date.now().toString();
    const message = buildSIWSMessage(address, timestamp);

    // Store challenge
    const crypto = require('crypto');
    const nonce = crypto.randomBytes(16).toString('hex');
    pendingChallenges.set(address, { nonce, timestamp, createdAt: Date.now() });

    res.json({
        message,
        timestamp,
        nonce,
        instructions: {
            step1: 'Sign the message above with your Solana private key (Ed25519)',
            step2: 'Convert the 64-byte signature to hex',
            step3: `Set header: Authorization: Bearer solana:${address}:${timestamp}:<signature_hex>`,
            step4: 'Use that header on any authenticated endpoint',
        },
        example_code: {
            javascript: `const nacl = require('tweetnacl');\nconst bs58 = require('bs58');\nconst message = new TextEncoder().encode('${message}');\nconst keypair = nacl.sign.keyPair.fromSecretKey(bs58.decode(YOUR_PRIVATE_KEY));\nconst signature = nacl.sign.detached(message, keypair.secretKey);\nconst sigHex = Buffer.from(signature).toString('hex');\n// Header: Authorization: Bearer solana:${address}:${timestamp}:<sigHex>`,
            python: `from nacl.signing import SigningKey\nimport base58\nmessage = b'${message}'\nsigning_key = SigningKey(base58.b58decode(YOUR_PRIVATE_KEY)[:32])\nsigned = signing_key.sign(message)\nsig_hex = signed.signature.hex()\n# Header: Authorization: Bearer solana:${address}:${timestamp}:<sig_hex>`,
        },
    });
});

// ─── POST /api/v2/auth/solana/verify (convenience test endpoint) ─
app.post('/api/v2/auth/solana/verify', (req, res) => {
    const { address, timestamp, signature } = req.body;
    if (!address || !timestamp || !signature) {
        return res.status(400).json({ error: 'address, timestamp, and signature required' });
    }

    const { verifySolanaSignature } = require('./middleware/siws');
    if (!verifySolanaSignature(address, timestamp, signature)) {
        return res.status(401).json({ error: 'Invalid signature or expired timestamp' });
    }

    const registration = lookupSolanaRegistration(address);
    res.json({
        verified: true,
        address,
        registration: registration || null,
        token: `solana:${address}:${timestamp}:${signature}`,
        hint: 'Use the token value as your Authorization: Bearer header',
    });
});

// ─── Helper: Build 8004 registration file ──────────────────────
function build8004RegistrationFile(tokenId, name, framework, narrative, opts = {}) {
    // Use agent's own mission/origin for description if available
    let description;
    if (narrative?.mission) {
        description = narrative.mission;
    } else if (narrative?.origin) {
        description = narrative.origin;
    } else {
        description = `${name} — AI agent on Base (${framework}). Registered on Helixa with Cred Score and onchain identity.`;
    }

    // Build capabilities from framework + verifications
    const capabilities = ['onchain-identity', 'cred-score'];
    if (framework) capabilities.push(framework.toLowerCase());
    if (opts.verified) capabilities.push('verified');
    if (opts.hasX) capabilities.push('x-verified');
    if (opts.hasGithub) capabilities.push('github-verified');
    if (opts.hasFarcaster) capabilities.push('farcaster-verified');
    if (opts.hasCoinbase) capabilities.push('coinbase-verified');
    if (opts.credTier) capabilities.push(`cred-${opts.credTier.toLowerCase()}`);

    const profile = getProfile(tokenId) || {};
    const socials = getAgentSocials(Number(tokenId));
    const services = sanitizePrincipalServices(profile.services, {
        web: { url: `https://helixa.xyz/agent/${tokenId}` },
        ...(socials.email ? { email: { address: socials.email } } : {}),
        ...(socials.telegram ? { telegram: { handle: socials.telegram } } : {}),
        mcp: { url: 'https://api.helixa.xyz/api/mcp' },
        a2a: { url: 'https://api.helixa.xyz/api/a2a' },
    }, { email: socials.email, telegram: socials.telegram });
    const metadata = sanitizePrincipalMetadata(
        profile.metadata,
        {},
        { entityType: 'agent', principalType: 'agent', framework: framework || 'unknown' },
        { services, fallbackChannels: ['email', 'telegram', 'web', 'mcp', 'a2a'] },
    );

    return {
        type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
        name,
        description,
        image: `https://api.helixa.xyz/api/v2/aura/${tokenId}.png`,
        services,
        active: true,
        skills: clampList(profile.skills || [], 24, 64),
        domains: clampList(profile.domains || [], 24, 64),
        supportedTrust: ['reputation'],
        metadata: {
            ...metadata,
            framework: framework || 'unknown',
            credScore: opts.credScore ?? null,
            credTier: opts.credTier ?? null,
            x402Support: true,
            capabilities,
            verifications: [
                ...(opts.hasX ? ['x'] : []),
                ...(opts.hasGithub ? ['github'] : []),
                ...(opts.hasFarcaster ? ['farcaster'] : []),
                ...(opts.hasCoinbase ? ['coinbase'] : []),
                ...(opts.hasSiwa ? ['siwa'] : []),
            ],
            helixaProfile: `https://api.helixa.xyz/api/v2/agent/${tokenId}`,
            credEndpoint: `https://api.helixa.xyz/api/v2/agent/${tokenId}/cred`,
        },
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
    const { personality, narrative, traits, services, skills, domains, metadata } = req.body;
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
        const existingProfile = getProfile(tokenId) || {};
        const existingSocials = getAgentSocials(tokenId);
        const servicesProvided = Object.prototype.hasOwnProperty.call(req.body || {}, 'services');
        const skillsProvided = Object.prototype.hasOwnProperty.call(req.body || {}, 'skills');
        const domainsProvided = Object.prototype.hasOwnProperty.call(req.body || {}, 'domains');
        const metadataProvided = Object.prototype.hasOwnProperty.call(req.body || {}, 'metadata');
        const normalizedServices = servicesProvided
            ? sanitizePrincipalServices(services, existingProfile.services || {}, { email: existingSocials.email, telegram: existingSocials.telegram })
            : null;
        const normalizedMetadata = metadataProvided
            ? sanitizePrincipalMetadata(
                metadata,
                existingProfile.metadata || {},
                { entityType: 'agent', principalType: 'agent', framework: agentData__.framework },
                { services: normalizedServices || sanitizePrincipalServices(existingProfile.services || {}, existingProfile.services || {}, { email: existingSocials.email, telegram: existingSocials.telegram }), fallbackChannels: ['email', 'telegram', 'web', 'mcp', 'a2a'] },
            )
            : null;
        const normalizedSkills = skillsProvided ? clampList(skills ?? [], 24, 64) : null;
        const normalizedDomains = domainsProvided ? clampList(domains ?? [], 24, 64) : null;
        
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
                const currentNarrative = (existingProfile && existingProfile.narrative) || {};
                profileData.narrative = { ...currentNarrative };
                if (narrative.origin) { profileData.narrative.origin = clamp(narrative.origin); updated.push('narrative.origin'); }
                if (narrative.mission) { profileData.narrative.mission = clamp(narrative.mission); updated.push('narrative.mission'); }
                if (narrative.lore) { profileData.narrative.lore = clamp(narrative.lore); updated.push('narrative.lore'); }
                if (narrative.manifesto) { profileData.narrative.manifesto = clamp(narrative.manifesto); updated.push('narrative.manifesto'); }
            }
            
            if (traits && Array.isArray(traits)) {
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
            
            // Handle operator field (off-chain, stored in SQLite)
            if (req.body.operator && typeof req.body.operator === 'string' && /^0x[a-fA-F0-9]{40}$/.test(req.body.operator)) {
                try {
                    const Database = require('better-sqlite3');
                    const sdb = new Database(path.join(__dirname, '..', 'data', 'agents.db'));
                    sdb.prepare('UPDATE agents SET operator = ? WHERE tokenId = ?').run(req.body.operator, tokenId);
                    sdb.close();
                    updated.push('operator');
                } catch (e) { console.error(`[OPERATOR] Failed for #${tokenId}:`, e.message); }
            }

            if (servicesProvided) {
                profileData.services = normalizedServices;
                updated.push('services');
            }
            if (skillsProvided) {
                profileData.skills = normalizedSkills;
                updated.push('skills');
            }
            if (domainsProvided) {
                profileData.domains = normalizedDomains;
                updated.push('domains');
            }
            if (metadataProvided) {
                profileData.metadata = normalizedMetadata;
                updated.push('metadata');
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

// POST /api/v2/principals/human/register — Register a human principal, optionally minting on HelixaV2
app.post('/api/v2/principals/human/register', requireHumanAuth, async (req, res) => {
    const auth = req.humanAuth;
    const callerWallet = auth.type === 'siwa' ? auth.walletAddress : null;
    const callerUserId = auth.type === 'privy' ? auth.userId : null;
    const {
        tokenId: requestedTokenId,
        mintOnchain,
        soulbound,
        framework,
        name,
        description,
        image,
        organization,
        skills,
        domains,
        linkedAccounts,
        linkedAgents,
        externalIds,
        services,
        supportedTrust,
        contact,
        notificationPreferences,
        metadata,
    } = req.body || {};

    const clamp = (s, max = 256) => (typeof s === 'string' ? s.trim().slice(0, max) : '');

    try {
        let tokenId = requestedTokenId != null ? Number(requestedTokenId) : null;
        if (requestedTokenId != null && !Number.isInteger(tokenId)) {
            return res.status(400).json({ error: 'tokenId must be an integer when provided' });
        }
        if (mintOnchain && tokenId !== null) {
            return res.status(400).json({ error: 'Provide either tokenId or mintOnchain, not both' });
        }

        // Determine identity key for profile lookup
        const existing = callerWallet
            ? getHumanProfileByWallet(callerWallet)
            : (callerUserId ? getHumanProfileByUserId(callerUserId) : null);
        const displayName = clamp(name || existing?.name || '', 64);
        if (!displayName) return res.status(400).json({ error: 'name required' });
        const normalizedContact = sanitizeHumanContact(contact, existing?.contact || {});
        const normalizedServices = sanitizePrincipalServices(services, existing?.services || {}, normalizedContact);
        const normalizedMetadata = sanitizePrincipalMetadata(
            metadata,
            existing?.metadata || {},
            {
                entityType: 'human',
                principalType: 'human',
                linkedAccounts: clampObjectStrings(linkedAccounts ?? existing?.linkedAccounts ?? {}, 24, 128),
                linkedAgents: [...new Set(clampList(linkedAgents ?? existing?.linkedAgents ?? [], 32, 64))],
                organization: clamp(organization || existing?.organization || '', 128),
            },
            { services: normalizedServices, fallbackChannels: ['email', 'telegram', 'web'] },
        );
        const normalizedNotificationPreferences = sanitizeHumanNotificationPreferences(
            notificationPreferences,
            existing?.notificationPreferences || {},
            normalizedContact,
        );

        // Token ownership check only applies if caller has a wallet
        if (tokenId !== null && callerWallet) {
            if (!isContractDeployed()) return res.status(503).json({ error: 'V2 contract not yet deployed' });
            const owner = await readContract.ownerOf(tokenId);
            if (owner.toLowerCase() !== callerWallet.toLowerCase()) {
                return res.status(403).json({ error: 'Caller must own tokenId to bind it as a human principal' });
            }
        }
        // If tokenId is provided but caller has no wallet, reject (cannot bind token)
        if (tokenId !== null && !callerWallet) {
            return res.status(403).json({ error: 'Token binding requires wallet authentication (SIWE)' });
        }

        let mintTxHash = null;
        if (mintOnchain) {
            if (!callerWallet) {
                return res.status(403).json({ error: 'On-chain mint requires wallet authentication (SIWE)' });
            }
            if (!isContractDeployed()) return res.status(503).json({ error: 'V2 contract not yet deployed' });
            const tx = await contract.mintFor(
                callerWallet,
                callerWallet,
                displayName,
                clamp(framework || 'human', 32) || 'human',
                soulbound === true,
                0,
            );
            const receipt = await tx.wait();
            mintTxHash = tx.hash;
            for (const log of receipt.logs) {
                try {
                    const parsed = contract.interface.parseLog(log);
                    if (parsed?.name === 'AgentRegistered') {
                        tokenId = Number(parsed.args.tokenId);
                        break;
                    }
                } catch {}
            }
            if (tokenId === null) return res.status(500).json({ error: 'Human mint succeeded but tokenId could not be recovered' });
        }

        const profileData = {
            tokenId,
            name: displayName,
            description: clamp(description || existing?.description || '', 512),
            image: clamp(image || existing?.image || '', 512),
            organization: normalizedMetadata.organization || clamp(organization || existing?.organization || '', 128),
            skills: clampList(skills ?? existing?.skills ?? [], 24, 64),
            domains: clampList(domains ?? existing?.domains ?? [], 24, 64),
            linkedAccounts: normalizedMetadata.linkedAccounts || {},
            linkedAgents: normalizedMetadata.linkedAgents || [],
            externalIds: clampObjectStrings(externalIds ?? existing?.externalIds ?? {}, 24, 128),
            services: normalizedServices,
            supportedTrust: clampList(supportedTrust ?? existing?.supportedTrust ?? ['reputation'], 8, 32),
            contact: normalizedContact,
            notificationPreferences: normalizedNotificationPreferences,
            metadata: normalizedMetadata,
            active: true,
            entityType: 'human',
            principalType: 'human',
        };
        // Include userId for non‑wallet profiles
        if (callerUserId) profileData.userId = callerUserId;
        const normalizedProfile = saveHumanProfile(callerWallet || callerUserId, profileData);

        if (tokenId !== null && isContractDeployed()) {
            try {
                const dataURI = registrationFileToDataURI(buildHumanRegistrationFile(normalizedProfile));
                const metaTx = await contract.setMetadata(tokenId, dataURI);
                await metaTx.wait();
            } catch (e) {
                console.error(`[HUMAN REGISTER] Metadata sync failed for #${tokenId}: ${e.message}`);
            }
        }

        const formatted = await formatHumanPrincipal(normalizedProfile, { includePrivate: true });
        res.json({
            success: true,
            principal: formatted,
            mintedOnchain: Boolean(mintOnchain),
            txHash: mintTxHash,
            message: tokenId !== null
                ? `Human principal ${displayName} registered${mintOnchain ? ' and minted on HelixaV2' : ''}`
                : `Human principal ${displayName} registered offchain`,
        });
    } catch (e) {
        console.error('[HUMAN REGISTER] Error:', e.message);
        res.status(500).json({ error: 'Human register failed: ' + e.message.slice(0, 200) });
    }
});

// POST /api/v2/human/:id/link-agent — Link an owned agent to a human principal
app.post('/api/v2/human/:id/link-agent', requireHumanWalletAuth, async (req, res) => {
    const caller = req.human.address;
    const { agentTokenId } = req.body || {};
    const tokenId = Number(agentTokenId);
    if (!Number.isInteger(tokenId)) return res.status(400).json({ error: 'agentTokenId required' });

    try {
        const profile = getHumanProfileById(req.params.id);
        if (!profile) return res.status(404).json({ error: 'Human principal not found' });
        if (profile.walletAddress.toLowerCase() !== caller.toLowerCase()) {
            return res.status(403).json({ error: 'Caller must own this human principal profile' });
        }
        if (!isContractDeployed()) return res.status(503).json({ error: 'V2 contract not yet deployed' });

        const owner = await readContract.ownerOf(tokenId);
        if (owner.toLowerCase() !== caller.toLowerCase()) {
            return res.status(403).json({ error: 'Caller must own the linked agent token' });
        }

        const linked = [...new Set([...(profile.linkedAgents || []), String(tokenId)])];
        const updated = saveHumanProfile(caller, { linkedAgents: linked });
        res.json({ success: true, principal: await formatHumanPrincipal(updated, { includePrivate: true }) });
    } catch (e) {
        res.status(500).json({ error: 'Agent link failed: ' + e.message.slice(0, 200) });
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
        
        // Get full agent profile for rich metadata
        const fullAgent = await formatAgentV2(tokenId);
        const tierInfo = getCredTier(fullAgent.credScore || 0);
        const traits = fullAgent.traits || [];
        const hasTrait = (n) => traits.some(t => t.name === n);
        
        const registrationFile = build8004RegistrationFile(tokenId, agent.name, agent.framework, narrative, {
            credScore: fullAgent.credScore || 0,
            credTier: tierInfo.tier,
            verified: fullAgent.verified,
            hasX: hasTrait('x-verified'),
            hasGithub: hasTrait('github-verified'),
            hasFarcaster: hasTrait('farcaster-verified'),
            hasCoinbase: hasTrait('coinbase-verified'),
            hasSiwa: hasTrait('siwa-verified'),
        });
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

// POST /api/v2/agent/:id/sync — Force re-index agent from onchain data (no payment)
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
        
        // Owner calls verify onchain
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

// ─── .well-known/agent.json — Open 402 Directory manifest ──────────
app.get('/.well-known/agent.json', (req, res) => {
    res.json({
        version: '1.0',
        origin: 'api.helixa.xyz',
        payout_address: TREASURY_ADDRESS,
        display_name: 'Helixa',
        description: 'The credibility layer for AI agents. On-chain identity registry, cred scoring, soul locking, and trust infrastructure on Base. ERC-8004 compliant.',
        extensions: {
            helixa: {
                contract: V2_CONTRACT_ADDRESS,
                chain: { name: 'Base', chainId: 8453 },
                website: 'https://helixa.xyz',
                skills: {
                    skills_sh: 'npx skills add Bendr-20/helixa-agent-skills',
                    mcp: 'npm install helixa-mcp-server',
                },
                registrations: [
                    { agentId: 1, agentRegistry: `eip155:8453:${V2_CONTRACT_ADDRESS}` },
                ],
            },
        },
        payments: {
            x402: {
                networks: [
                    {
                        network: 'base',
                        asset: 'USDC',
                        contract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
                        facilitator: 'https://x402.dexter.cash',
                    },
                ],
                recipient: TREASURY_ADDRESS,
            },
        },
        intents: [
            {
                name: 'mint_agent_identity',
                description: 'Register a new AI agent identity on-chain via the Helixa registry. Creates an ERC-8004 compliant agent NFT on Base with soul traits, cred scoring, and verifiable identity. Requires SIWA (Sign-In With Agent) authentication.',
                endpoint: 'https://api.helixa.xyz/api/v2/mint',
                method: 'POST',
                parameters: {
                    traits: { type: 'object', required: false, description: 'Agent soul traits (personality, values, capabilities)' },
                },
                returns: { type: 'object', description: 'Minted agent token ID, transaction hash, and metadata URI' },
                price: { amount: PRICING.agentMint, currency: 'USDC', model: 'per_call' },
            },
            {
                name: 'get_agent',
                description: 'Look up any registered agent by token ID. Returns full profile including soul traits, cred score, tier, name, owner, and verification status.',
                endpoint: 'https://api.helixa.xyz/api/v2/agent/{id}',
                method: 'GET',
                parameters: {
                    id: { type: 'integer', required: true, description: 'Agent token ID' },
                },
                returns: { type: 'object', description: 'Full agent profile with traits, cred, tier, name, owner address' },
                price: { amount: 0, currency: 'USD' },
            },
            {
                name: 'search_agents',
                description: 'Search the Helixa agent registry by name, trait, or keyword. Returns matching agents with cred scores and profiles.',
                endpoint: 'https://api.helixa.xyz/api/v2/agents',
                method: 'GET',
                parameters: {
                    search: { type: 'string', required: false, description: 'Search query' },
                },
                returns: { type: 'array', description: 'Array of matching agent profiles' },
                price: { amount: 0, currency: 'USD' },
            },
            {
                name: 'check_cred',
                description: 'Get the credibility score and tier for any registered agent. Returns numeric score (0-100) and tier label (Junk, Marginal, Qualified, Prime, Preferred).',
                endpoint: 'https://api.helixa.xyz/api/v2/agent/{id}/cred',
                method: 'GET',
                parameters: {
                    id: { type: 'integer', required: true, description: 'Agent token ID' },
                },
                returns: { type: 'object', description: 'Cred score, tier, and tier label' },
                price: { amount: 0, currency: 'USD' },
            },
            {
                name: 'full_cred_report',
                description: 'Detailed credibility report with full scoring breakdown across all weighted components. Paid endpoint via x402.',
                endpoint: 'https://api.helixa.xyz/api/v2/agent/{id}/cred-report',
                method: 'GET',
                parameters: {
                    id: { type: 'integer', required: true, description: 'Agent token ID' },
                },
                returns: { type: 'object', description: 'Full scoring breakdown with all CRED_WEIGHTS components and recommendations' },
                price: { amount: PRICING.credReport, currency: 'USDC', model: 'per_call' },
                payments: { x402: { direct_price: PRICING.credReport } },
            },
            {
                name: 'update_agent',
                description: 'Update an agent\'s traits and metadata. Requires SIWA authentication as the agent. Paid via x402.',
                endpoint: 'https://api.helixa.xyz/api/v2/agent/{id}/update',
                method: 'POST',
                parameters: {
                    id: { type: 'integer', required: true, description: 'Agent token ID' },
                    traits: { type: 'object', required: true, description: 'Updated soul traits' },
                },
                returns: { type: 'object', description: 'Updated agent profile' },
                price: { amount: PRICING.update, currency: 'USDC', model: 'per_call' },
                payments: { x402: { direct_price: PRICING.update } },
            },
            {
                name: 'lock_soul',
                description: 'Lock an agent\'s soul on-chain via the Chain of Identity protocol. Creates an immutable, versioned hash of the agent\'s soul state on the SoulSovereign contract. Paid via x402.',
                endpoint: 'https://api.helixa.xyz/api/v2/agent/{id}/soul/lock',
                method: 'POST',
                parameters: {
                    id: { type: 'integer', required: true, description: 'Agent token ID' },
                },
                returns: { type: 'object', description: 'Soul lock transaction hash, version number, and timestamp' },
                price: { amount: PRICING.soulLock, currency: 'USDC', model: 'per_call' },
                payments: { x402: { direct_price: PRICING.soulLock } },
            },
            {
                name: 'verify_soul',
                description: 'Verify an agent\'s current soul state against the on-chain hash. Returns whether the soul matches the latest locked version.',
                endpoint: 'https://api.helixa.xyz/api/v2/agent/{id}/soul/verify',
                method: 'GET',
                parameters: {
                    id: { type: 'integer', required: true, description: 'Agent token ID' },
                },
                returns: { type: 'object', description: 'Verification result with match status, version, and timestamps' },
                price: { amount: 0, currency: 'USD' },
            },
            {
                name: 'get_stats',
                description: 'Registry-wide statistics including total agents minted, named, verified, soul-locked, and cred distribution.',
                endpoint: 'https://api.helixa.xyz/api/v2/stats',
                method: 'GET',
                returns: { type: 'object', description: 'Registry statistics' },
                price: { amount: 0, currency: 'USD' },
            },
        ],
    });
});

// Well-known agent registry — machine-readable service manifest
// ERC-8004 domain verification (proves we control this endpoint domain)
app.get('/.well-known/agent-registration.json', (req, res) => {
    res.json({
        type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
        name: 'Helixa',
        description: 'Onchain identity and reputation infrastructure for AI agents on Base. 1,000+ agents, 11-factor Cred Scores, SIWA auth, x402 payments.',
        image: 'https://api.helixa.xyz/api/v2/aura/1.png',
        services: [
            { name: 'web', endpoint: 'https://helixa.xyz' },
            { name: 'A2A', endpoint: 'https://api.helixa.xyz/.well-known/agent-card.json', version: '0.3.0' },
            { name: 'MCP', endpoint: 'https://api.helixa.xyz/api/mcp', version: '2025-06-18' },
            { name: 'OASF', endpoint: 'https://api.helixa.xyz/.well-known/oasf-record.json', version: '0.8' },
        ],
        x402Support: true,
        active: true,
        capabilities: ['agent-search', 'cred-scoring', 'identity-verification', 'agent-profiles', 'cross-registration'],
        registrations: [
            { agentId: 1, agentRegistry: `eip155:8453:${V2_CONTRACT_ADDRESS}` },
        ],
        supportedTrust: ['reputation'],
    });
});

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
            soulLock: PRICING.soulLock === 0 ? 'free' : `${PRICING.soulLock} USDC`,
            soulHandshake: PRICING.soulHandshake === 0 ? 'free' : `${PRICING.soulHandshake} USDC`,
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
            description: 'Onchain identity and reputation for AI agents. Register identities, set personality traits, build Cred Scores, and verify agents — all via API with SIWA auth and x402 payments.',
            contact: { url: 'https://helixa.xyz' },
        },
        servers: [{ url: 'https://api.helixa.xyz', description: 'Production (Base Mainnet)' }],
        paths: {
            '/api/v2/stats': {
                get: {
                    summary: 'Protocol statistics',
                    description: 'Returns aggregate Helixa protocol stats: total agents, mints, verifications, cred distribution.',
                    responses: {
                        '200': {
                            description: 'Protocol stats object',
                            content: { 'application/json': { schema: {
                                type: 'object',
                                properties: {
                                    totalAgents: { type: 'integer' },
                                    totalVerified: { type: 'integer' },
                                    totalSoulLocked: { type: 'integer' },
                                    totalHandshakes: { type: 'integer' },
                                    avgCredScore: { type: 'number' },
                                },
                            } } },
                        },
                    },
                },
            },
            '/api/v2/agents': {
                get: {
                    summary: 'List or search agents',
                    description: 'Returns registered Helixa agents. Use search param to filter by name or address.',
                    parameters: [
                        { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search by agent name or wallet address' },
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
            '/api/v2/agent/{address}/cred': {
                get: {
                    summary: 'Check agent Cred score',
                    description: 'Returns the Cred score, tier, and factor breakdown for an agent by wallet address.',
                    parameters: [{ name: 'address', in: 'path', required: true, schema: { type: 'string' }, description: 'Agent wallet address (0x...)' }],
                    responses: {
                        '200': {
                            description: 'Cred score breakdown',
                            content: { 'application/json': { schema: {
                                type: 'object',
                                properties: {
                                    address: { type: 'string' },
                                    credScore: { type: 'number' },
                                    tier: { type: 'string', enum: ['basic', 'verified', 'trusted', 'elite', 'legendary'] },
                                    factors: { type: 'object' },
                                },
                            } } },
                        },
                        '404': { description: 'Agent not found' },
                    },
                },
            },
            '/api/v2/agent/{address}/session-outcome': {
                post: {
                    summary: 'Report a session outcome',
                    description: 'Report the outcome of an agent interaction session. Requires API key.',
                    parameters: [{ name: 'address', in: 'path', required: true, schema: { type: 'string' }, description: 'Agent wallet address' }],
                    security: [{ apiKey: [] }],
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: {
                            type: 'object',
                            required: ['outcome'],
                            properties: {
                                outcome: { type: 'string', enum: ['success', 'failure', 'partial'] },
                                details: { type: 'string' },
                                sessionId: { type: 'string' },
                                duration: { type: 'integer', description: 'Session duration in seconds' },
                            },
                        } } },
                    },
                    responses: {
                        '200': { description: 'Outcome recorded' },
                        '401': { description: 'Missing or invalid API key' },
                    },
                },
            },
            '/api/v2/mint': {
                post: {
                    summary: 'Register a new agent identity',
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
                        '201': { description: 'Agent registered successfully' },
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
                apiKey: {
                    type: 'apiKey',
                    in: 'header',
                    name: 'X-API-Key',
                    description: 'API key for reporting session outcomes',
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
    activity: { weight: 0.17, label: 'Onchain Activity', description: 'Transactions, contract deploys, protocol interactions' },
    external: { weight: 0.09, label: 'External Activity', description: 'GitHub commits, task completions, integrations' },
    verify: { weight: 0.10, label: 'Verification Status', description: 'SIWA, X, GitHub, Farcaster verifications' },
    coinbase: { weight: 0.05, label: 'Institutional Verification', description: 'EAS attestations from recognized issuers (Coinbase, etc.)' },
    age: { weight: 0.08, label: 'Account Age', description: 'Days since registration' },
    traits: { weight: 0.08, label: 'Trait Richness', description: 'Number and variety of traits' },
    narrative: { weight: 0.05, label: 'Narrative Completeness', description: 'Origin, mission, lore, manifesto fields' },
    origin: { weight: 0.08, label: 'Registration Origin', description: 'How the agent was registered (SIWA > API > Owner)' },
    soulbound: { weight: 0.05, label: 'Soulbound Status', description: 'Identity locked to wallet (non-transferable)' },
    soulCompleteness: { weight: 0.07, label: 'Soul Vault', description: 'Soul data completeness - public fields, shared soul, narrative depth' },
    reputation8004: { weight: 0.10, label: 'ERC-8004 Reputation', description: 'Feedback signals from the official ERC-8004 Reputation Registry on Base' },
    workHistory: { weight: 0.06, label: 'Work History', description: 'Task completions, reliability, and earnings from 0xWork' },
    bankr: { weight: 0.02, label: 'Agent Economy', description: 'Bankr profile, linked token, and market activity' },
};

function computeCredBreakdown(agent) {
    const { calculateReputationBonus } = require('./services/reputation-8004');
    const traits = agent.traits || [];
    const personality = agent.personality || {};
    const narrative = agent.narrative || {};
    const mintDate = agent.mintedAt ? new Date(agent.mintedAt) : null;
    const ageDays = mintDate ? Math.floor((Date.now() - mintDate.getTime()) / 86400000) : 0;

    const hasVerif = (name) => traits.some(t => t.name === name);
    const verifCount = ['siwa-verified', 'x-verified', 'github-verified', 'farcaster-verified', 'coinbase-verified']
        .filter(v => hasVerif(v)).length;

    const narrativeFields = [narrative.origin, narrative.mission, narrative.lore, narrative.manifesto].filter(Boolean);

    // External activity: GitHub commits, task completions, integrations, Ethos & Talent scores
    const externalSignals = [
        hasVerif('github-verified'),  // has linked GitHub
        hasVerif('x-verified'),       // has linked X
        hasVerif('farcaster-verified'), // has linked Farcaster
        (agent.externalActivity || 0) > 0, // task completions, API usage
    ].filter(Boolean).length;

    // Ethos Network reputation score (0-2600+ scale, normalize to 0-40 contribution)
    // Score >1000 = reputable, >1500 = strong, >2000 = excellent
    const ethosContribution = agent.ethosScore
        ? Math.min(40, Math.round((agent.ethosScore / 2000) * 40))
        : 0;

    // Talent Protocol builder score (0-100 scale, normalize to 0-30 contribution)
    const talentContribution = agent.talentScore
        ? Math.min(30, Math.round((agent.talentScore / 100) * 30))
        : 0;

    const components = {
        activity: { raw: Math.min(100, (agent.points || 0) * 2), maxRaw: 100 },
        external: { raw: Math.min(100, externalSignals * 15 + (agent.externalActivity || 0) * 5 + ethosContribution + talentContribution), maxRaw: 100 },
        verify: { raw: Math.min(100, verifCount * 25), maxRaw: 100 },
        coinbase: { raw: hasVerif('coinbase-verified') ? 100 : 0, maxRaw: 100 },
        age: { raw: Math.min(100, ageDays * 5), maxRaw: 100 },
        traits: { raw: Math.min(100, traits.length * 12), maxRaw: 100 },
        narrative: { raw: Math.min(100, narrativeFields.length * 25), maxRaw: 100 },
        origin: { raw: (agent.mintOrigin === 'AGENT_SIWA' || hasVerif('siwa-verified')) ? 100 : agent.mintOrigin === 'API' ? 70 : agent.mintOrigin === 'HUMAN' ? 80 : 50, maxRaw: 100 },
        soulbound: { raw: agent.soulbound ? 100 : 0, maxRaw: 100 },
        soulCompleteness: { raw: (() => {
            try {
                const Database = require('better-sqlite3');
                const sdb = new Database(path.join(__dirname, '..', 'data', 'agents.db'));
                const sv = sdb.prepare('SELECT publicSoul, sharedSoul FROM soul_vault WHERE tokenId = ?').get(Number(agent.tokenId));
                sdb.close();
                if (!sv) return 0;
                let score = 0;
                // 40%: publicSoul fields populated
                if (sv.publicSoul) {
                    try {
                        const ps = JSON.parse(sv.publicSoul);
                        const fields = Object.values(ps).filter(v => v !== null && v !== undefined && v !== '');
                        score += Math.min(40, fields.length * 10);
                    } catch { }
                }
                // 30%: sharedSoul exists
                if (sv.sharedSoul) score += 30;
                // 30%: narrative depth (length of publicSoul text)
                if (sv.publicSoul) {
                    const len = sv.publicSoul.length;
                    score += Math.min(30, Math.floor(len / 50) * 5);
                }
                return score;
            } catch { return 0; }
        })(), maxRaw: 100 },
        reputation8004: { raw: (() => {
            // ERC-8004 Reputation Registry feedback score
            // Uses cached data from reputation-8004.js (populated by periodic scan)
            const bonus = calculateReputationBonus(agent._8004Feedback || null);
            // Scale 0-15 bonus to 0-100 raw score
            return Math.min(100, Math.round(bonus * (100 / 15)));
        })(), maxRaw: 100 },
        workHistory: { raw: (() => {
            // 0xWork task completion data
            const { calculateWorkScore } = require('./services/work-stats');
            return calculateWorkScore(agent._workStats || null);
        })(), maxRaw: 100 },
        bankr: { raw: (() => {
            // Bankr agent economy: linked token + profile + market activity
            let score = 0;
            // 40pts: has a linked token onchain (check both traits array and linkedToken object)
            const hasLinkedToken = traits.some(t => t.name === 'linked-token') || !!agent.linkedToken?.contractAddress;
            if (hasLinkedToken) score += 40;
            // 30pts: has a Bankr profile (checked via trait or _bankrProfile flag)
            const hasBankrProfile = traits.some(t => t.name === 'bankr-profile') || !!agent._bankrProfile;
            if (hasBankrProfile) score += 30;
            // 30pts: token has market activity (market cap > 0)
            if (agent._tokenMarketCap && agent._tokenMarketCap > 0) score += 30;
            return Math.min(100, score);
        })(), maxRaw: 100 },
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

    // Soul Vault recommendation
    if (!breakdown.soulCompleteness || breakdown.soulCompleteness.rawScore < 50) {
        recs.push({ action: 'Upload Soul Vault data (publicSoul + sharedSoul)', impact: '+4-8 points', priority: 'MEDIUM', endpoint: `POST /api/v2/agent/${agent.tokenId}/soul` });
    }

    return recs.slice(0, 8);
}

// FREE: 0xWork stats for an agent
app.get('/api/v2/agent/:id/work-stats', async (req, res) => {
    try {
        const tokenId = parseInt(req.params.id);
        const agent = await formatAgentV2(tokenId);
        const { fetchWorkStats, calculateWorkScore } = require('./services/work-stats');
        const stats = await fetchWorkStats(agent.agentAddress);
        if (!stats || !stats.registered) {
            return res.json({ tokenId, name: agent.name, registered: false, message: 'Agent not registered on 0xWork' });
        }
        res.json({
            tokenId, name: agent.name,
            workStats: stats,
            workScore: calculateWorkScore(stats),
            source: '0xWork',
            api: `https://api.0xwork.org/agents/${agent.agentAddress}/work-stats`,
        });
    } catch (e) {
        res.status(404).json({ error: e.message });
    }
});

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

// INTERNAL: Full Cred Report (for Bankr x402 Cloud proxy - bypasses x402 gate)
app.get('/api/v2/internal/agent/:id/cred-report', (req, res, next) => {
    const internalKey = req.headers['x-internal-key'];
    if (!internalKey || internalKey !== (process.env.INTERNAL_API_KEY || '095eae17f5b386cf3037d936ade389a5bff382a8c2cf7a5b7fed240fa6602837')) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    req.paymentVerified = { method: 'internal-key' };
    next();
}, async (req, res) => {
    try {
        const tokenId = parseInt(req.params.id);
        const agent = await formatAgentV2(tokenId);
        const tierInfo = getCredTier(agent.credScore);
        const { components, computedScore } = computeCredBreakdown(agent);
        const recommendations = getCredRecommendations(agent, components);
        let rank = null, totalAgents = 0;
        try {
            const allAgents = indexer.getAllAgents();
            totalAgents = allAgents.length;
            const sorted = [...allAgents].sort((a, b) => (b.credScore || 0) - (a.credScore || 0));
            const idx = sorted.findIndex(a => a.tokenId === tokenId);
            if (idx >= 0) rank = idx + 1;
        } catch {}
        const traits = agent.traits || [];
        const hasVerif = (name) => traits.some(t => t.name === name);
        const verificationStatus = {
            siwa: hasVerif('siwa-verified'), x: hasVerif('x-verified'),
            github: hasVerif('github-verified'), farcaster: hasVerif('farcaster-verified'),
            coinbase: hasVerif('coinbase-verified'),
            total: ['siwa-verified', 'x-verified', 'github-verified', 'farcaster-verified', 'coinbase-verified'].filter(v => hasVerif(v)).length,
            max: 5,
        };
        const narrative = agent.narrative || {};
        const narrativeFields = ['origin', 'mission', 'lore', 'manifesto'];
        const narrativeAnalysis = {};
        for (const f of narrativeFields) { narrativeAnalysis[f] = { present: !!narrative[f], length: narrative[f] ? narrative[f].length : 0 }; }
        const narrativeCompleteness = narrativeFields.filter(f => !!narrative[f]).length;
        const mintDate = agent.mintedAt ? new Date(agent.mintedAt) : null;
        const ageDays = mintDate ? Math.floor((Date.now() - mintDate.getTime()) / 86400000) : 0;
        const report = {
            generatedAt: new Date().toISOString(),
            agent: { tokenId, name: agent.name, framework: agent.framework, owner: agent.owner, agentAddress: agent.agentAddress, mintOrigin: agent.mintOrigin, mintedAt: agent.mintedAt, ageDays, soulbound: agent.soulbound, verified: agent.verified, points: agent.points },
            credScore: { score: agent.credScore, computedScore, tier: tierInfo.tier, tierLabel: tierInfo.label, rank, totalAgents, percentile: rank && totalAgents ? Math.round((1 - rank / totalAgents) * 100) : null },
            scoreBreakdown: components,
            verifications: verificationStatus,
            narrativeAnalysis: { completeness: `${narrativeCompleteness}/4`, fields: narrativeAnalysis },
            personality: agent.personality,
            recommendations,
            tierScale: [
                { tier: 'JUNK', range: '0-25' }, { tier: 'MARGINAL', range: '26-50' },
                { tier: 'QUALIFIED', range: '51-75' }, { tier: 'PRIME', range: '76-90' }, { tier: 'PREFERRED', range: '91-100' },
            ],
            explorer: `https://basescan.org/token/${V2_CONTRACT_ADDRESS}?a=${tokenId}`,
        };
        console.log(`[CRED REPORT] Internal report for Agent #${tokenId} (score: ${agent.credScore}, tier: ${tierInfo.tier})`);
        res.json(report);
    } catch (e) {
        console.error(`[CRED REPORT] Internal error for #${req.params.id}:`, e.message);
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
        const hmacSecret = process.env.RECEIPT_HMAC_SECRET || (DEPLOYER_KEY ? DEPLOYER_KEY.slice(0, 32) : 'helixa-default-hmac-key-fallback');
        const receiptSignature = crypto.createHmac('sha256', hmacSecret)
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

        // Natural language assessment via Bankr LLM
        try {
            const bankrApiKey = _bankrApiKey || getBankrApiKey();
            console.log(`[CRED REPORT] Bankr API key available: ${!!bankrApiKey}`);
            if (bankrApiKey) {
                const assessmentPrompt = `You are a concise analyst for AgentDNA, an onchain agent identity protocol. Write a 2-3 paragraph natural language assessment of this agent's credibility based on their cred report data. Be direct, specific, and actionable. No fluff.

Agent: ${agent.name} (Token #${tokenId})
Cred Score: ${agent.credScore}/100 (${tierInfo.label} tier)
Rank: #${rank || '?'} of ${totalAgents} agents (${rank && totalAgents ? Math.round((1 - rank / totalAgents) * 100) : '?'}th percentile)
Age: ${ageDays} days
Soulbound: ${agent.soulbound ? 'Yes' : 'No'}
Verifications: SIWA=${verificationStatus.siwa}, X=${verificationStatus.x}, GitHub=${verificationStatus.github}, Farcaster=${verificationStatus.farcaster}, Coinbase=${verificationStatus.coinbase}
Narrative completeness: ${narrativeCompleteness}/4 fields
Score breakdown: ${Object.entries(components).map(([k,v]) => `${v.label}: ${v.weightedScore}/${v.maxWeightedScore}`).join(', ')}
Recommendations: ${recommendations.map(r => r.action).join(', ')}`;

                const llmRes = await fetch('https://llm.bankr.bot/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${bankrApiKey}` },
                    body: JSON.stringify({
                        model: 'gpt-5.4-nano',
                        messages: [{ role: 'user', content: assessmentPrompt }],
                        max_tokens: 500,
                        temperature: 0.7,
                    }),
                });
                console.log(`[CRED REPORT] LLM response: ${llmRes.status} ${llmRes.statusText}`);
                if (llmRes.ok) {
                    const llmData = await llmRes.json();
                    report.analysis = llmData.choices?.[0]?.message?.content || null;
                } else {
                    const errText = await llmRes.text();
                    console.warn(`[CRED REPORT] LLM error: ${errText.slice(0, 200)}`);
                }
            }
        } catch (llmErr) {
            console.warn(`[CRED REPORT] LLM assessment failed: ${llmErr.message}`);
            // Non-fatal - report still works without it
        }

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
    const hmacSecret2 = process.env.RECEIPT_HMAC_SECRET || (DEPLOYER_KEY ? DEPLOYER_KEY.slice(0, 32) : 'helixa-default-hmac-key-fallback');
    const expected = crypto.createHmac('sha256', hmacSecret2)
        .update(payload).digest('hex');
    const valid = expected === signature;
    let parsed = null;
    try { parsed = JSON.parse(payload); } catch {}
    res.json({ valid, report: parsed });
});

// ═══════════════════════════════════════════════════════════════
// Soul Vault — Phase 1
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// MintGate — Signature-gated minting
// ═══════════════════════════════════════════════════════════════
const MINTGATE_ADDRESS = process.env.MINTGATE_ADDRESS || '0xb0E21642FEDb808BF49E70e1F8FF53B7fBade8e2';

// Generate a mint signature (internal endpoint, called by Bankr x402 handler)
app.post('/api/v2/internal/mint-signature', async (req, res) => {
    const internalKey = req.headers['x-internal-key'];
    if (!internalKey || internalKey !== (process.env.INTERNAL_API_KEY || '095eae17f5b386cf3037d936ade389a5bff382a8c2cf7a5b7fed240fa6602837')) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    try {
        const { to, paymentRef } = req.body;
        if (!to || !paymentRef) {
            return res.status(400).json({ error: 'Missing to or paymentRef' });
        }

        const deployerKey = DEPLOYER_KEY || (await initDeployerKey(), DEPLOYER_KEY);
        if (!deployerKey) {
            return res.status(500).json({ error: 'Signer not available' });
        }

        const signerWallet = new ethers.Wallet(deployerKey);
        const nonce = ethers.hexlify(ethers.randomBytes(32));
        const expiry = Math.floor(Date.now() / 1000) + 300; // 5 minutes
        const chainId = 8453;
        const gateAddress = MINTGATE_ADDRESS;

        if (!gateAddress) {
            return res.status(500).json({ error: 'MintGate contract not configured' });
        }

        // Pack and sign: (to, nonce, expiry, paymentRef, chainId, contractAddress)
        const messageHash = ethers.solidityPackedKeccak256(
            ['address', 'bytes32', 'uint256', 'string', 'uint256', 'address'],
            [to, nonce, expiry, paymentRef, chainId, gateAddress]
        );
        const signature = await signerWallet.signMessage(ethers.getBytes(messageHash));

        res.json({
            to,
            nonce,
            expiry,
            paymentRef,
            signature,
            mintGateAddress: gateAddress,
            chainId,
        });
    } catch (e) {
        console.error('[MINTGATE] Signature generation failed:', e.message);
        res.status(500).json({ error: 'Signature generation failed', detail: e.message });
    }
});

// POST /api/v2/internal/mint — Direct mint via mintFree() for x402/Bankr payments
// No SIWA needed — payment already verified by x402 layer
app.post('/api/v2/internal/mint', async (req, res) => {
    const internalKey = req.headers['x-internal-key'];
    if (!internalKey || internalKey !== (process.env.INTERNAL_API_KEY || '095eae17f5b386cf3037d936ade389a5bff382a8c2cf7a5b7fed240fa6602837')) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    try {
        const { to, name, framework, soulbound, personality, narrative, paymentRef } = req.body;
        if (!to || !name) {
            return res.status(400).json({ error: 'Missing required: to, name' });
        }
        if (!/^0x[a-fA-F0-9]{40}$/.test(to)) {
            return res.status(400).json({ error: 'Invalid wallet address' });
        }
        const NAME_REGEX = /^[\x20-\x7E\u00C0-\u024F\u0370-\u03FF]{1,64}$/;
        if (!NAME_REGEX.test(name)) {
            return res.status(400).json({ error: 'Name contains invalid characters' });
        }

        const fw = (framework || 'custom').toLowerCase();
        const VALID_FRAMEWORKS = ['openclaw', 'eliza', 'langchain', 'crewai', 'autogpt', 'bankr', 'virtuals', 'based', 'agentkit', 'custom'];
        if (!VALID_FRAMEWORKS.includes(fw)) {
            return res.status(400).json({ error: `framework must be one of: ${VALID_FRAMEWORKS.join(', ')}` });
        }

        if (!isContractDeployed()) {
            return res.status(503).json({ error: 'Contract not ready' });
        }

        // Check if already minted
        const hasMinted = await readContract.hasMinted(to);
        if (hasMinted) {
            return res.status(409).json({ error: 'This address already has an agent' });
        }

        console.log(`[X402 MINT] ${name} (${fw}) -> ${to} [ref: ${paymentRef || 'none'}]`);

        // Use mintFor (deployer is owner, no ETH needed)
        // MintOrigin: 0=DIRECT, 1=AGENT_SIWA, 2=PARTNER, 3=REFERRAL
        const tx = await contract.mintFor(
            to,             // to (owner)
            to,             // agentAddress
            name,
            fw,
            soulbound === true,
            2,              // MintOrigin.PARTNER (x402/Bankr)
        );
        console.log(`[X402 MINT] TX: ${tx.hash}`);
        const receipt = await tx.wait();

        // Extract tokenId from event
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
        const MAX_STR = 256;
        const clamp = (s, max = MAX_STR) => (typeof s === 'string' ? s.slice(0, max) : '');
        if (personality && tokenId !== null) {
            try {
                const ptx = await contract.setPersonality(tokenId, [
                    clamp(personality.quirks),
                    clamp(personality.communicationStyle),
                    clamp(personality.values),
                    clamp(personality.humor),
                    Math.min(10, Math.max(0, parseInt(personality.riskTolerance) || 5)),
                    Math.min(10, Math.max(0, parseInt(personality.autonomyLevel) || 5)),
                ]);
                await ptx.wait();
            } catch (e) {
                console.error(`[X402 MINT] Personality failed: ${e.message}`);
            }
        }

        // Set narrative if provided
        if (narrative && tokenId !== null) {
            try {
                const ntx = await contract.setNarrative(tokenId, [
                    clamp(narrative.origin, 512),
                    clamp(narrative.mission, 512),
                    clamp(narrative.lore, 1024),
                    clamp(narrative.manifesto, 1024),
                ]);
                await ntx.wait();
            } catch (e) {
                console.error(`[X402 MINT] Narrative failed: ${e.message}`);
            }
        }

        res.json({
            success: true,
            tokenId,
            txHash: tx.hash,
            owner: to,
            name,
            framework: fw,
            paymentRef: paymentRef || null,
            explorer: `https://basescan.org/tx/${tx.hash}`,
        });
    } catch (e) {
        console.error('[X402 MINT] Failed:', e.message);
        res.status(500).json({ error: 'Mint failed', detail: e.message });
    }
});

// Ensure soul_vault table exists (idempotent)
(() => {
    try {
        const Database = require('better-sqlite3');
        const dbPath = path.join(__dirname, '..', 'data', 'agents.db');
        const soulDb = new Database(dbPath);
        soulDb.exec(`
            CREATE TABLE IF NOT EXISTS soul_vault (
                tokenId INTEGER PRIMARY KEY,
                publicSoul TEXT,
                sharedSoul TEXT,
                privateSoul TEXT,
                accessControl TEXT,
                soulSovereign INTEGER DEFAULT 0,
                sovereignWallet TEXT,
                soulHash TEXT,
                updatedAt INTEGER,
                createdAt INTEGER
            );
        `);
        soulDb.close();
    } catch (e) {
        console.error('[SOUL VAULT] Failed to init table:', e.message);
    }
})();

function getSoulDb() {
    const Database = require('better-sqlite3');
    return new Database(path.join(__dirname, '..', 'data', 'agents.db'));
}

function computeSoulHash(publicSoul, sharedSoul, privateSoul) {
    const payload = JSON.stringify({ publicSoul, sharedSoul, privateSoul });
    return ethers.keccak256(ethers.toUtf8Bytes(payload));
}

// POST /api/v2/agent/:id/soul — Upload soul data (requireSIWA)
app.post('/api/v2/agent/:id/soul', requireSIWA, async (req, res) => {
    try {
        const tokenId = parseInt(req.params.id);
        const agent = await formatAgentV2(tokenId);
        const caller = req.agent.address;

        // Check sovereign lock (onchain first, then DB fallback)
        const sdb = getSoulDb();
        const existing = sdb.prepare('SELECT soulSovereign, sovereignWallet FROM soul_vault WHERE tokenId = ?').get(tokenId);

        // Onchain sovereignty check
        try {
            const ssContract = getSoulSovereignContract(new ethers.JsonRpcProvider(RPC_URL));
            const onChainSovereign = await ssContract.isSovereign(tokenId);
            if (onChainSovereign) {
                const sovWallet = await ssContract.getSovereignWallet(tokenId);
                if (caller.toLowerCase() !== sovWallet.toLowerCase()) {
                    sdb.close();
                    return res.status(403).json({ error: 'Soul is sovereign (onchain). Only the sovereign wallet can modify it.' });
                }
            }
        } catch (e) {
            console.warn(`[SOUL VAULT] Onchain sovereignty check failed for #${tokenId}:`, e.message);
        }

        if (existing && existing.soulSovereign === 1) {
            if (caller.toLowerCase() !== existing.sovereignWallet.toLowerCase()) {
                sdb.close();
                return res.status(403).json({ error: 'Soul is sovereign. Only the sovereign wallet can modify it.' });
            }
        } else {
            // Must be owner or agent's own wallet
            const isOwner = caller.toLowerCase() === agent.owner.toLowerCase();
            const isAgent = caller.toLowerCase() === agent.agentAddress.toLowerCase();
            if (!isOwner && !isAgent) {
                sdb.close();
                return res.status(403).json({ error: 'Only the token owner or agent wallet can write soul data.' });
            }
        }

        const { publicSoul, sharedSoul, privateSoul, accessControl } = req.body;
        if (!publicSoul && !sharedSoul && !privateSoul) {
            sdb.close();
            return res.status(400).json({ error: 'At least one soul field required (publicSoul, sharedSoul, privateSoul).' });
        }

        const ac = accessControl || { type: 'owner-only', allowlist: [] };
        if (!['public', 'allowlist', 'owner-only'].includes(ac.type)) {
            sdb.close();
            return res.status(400).json({ error: 'accessControl.type must be public, allowlist, or owner-only.' });
        }

        const soulHash = computeSoulHash(publicSoul, sharedSoul, privateSoul);
        const now = Date.now();

        sdb.prepare(`
            INSERT INTO soul_vault (tokenId, publicSoul, sharedSoul, privateSoul, accessControl, soulHash, updatedAt, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(tokenId) DO UPDATE SET
                publicSoul = excluded.publicSoul,
                sharedSoul = excluded.sharedSoul,
                privateSoul = excluded.privateSoul,
                accessControl = excluded.accessControl,
                soulHash = excluded.soulHash,
                updatedAt = excluded.updatedAt
        `).run(
            tokenId,
            publicSoul ? JSON.stringify(publicSoul) : null,
            sharedSoul ? JSON.stringify(sharedSoul) : null,
            privateSoul ? JSON.stringify(privateSoul) : null,
            JSON.stringify(ac),
            soulHash,
            now,
            now
        );
        sdb.close();

        console.log(`[SOUL VAULT] Soul written for Agent #${tokenId} by ${caller}`);
        res.json({ success: true, soulHash });
    } catch (e) {
        console.error(`[SOUL VAULT] Error writing soul for #${req.params.id}:`, e.message);
        res.status(e.message.includes('not yet deployed') || e.message.includes('not found') ? 404 : 500)
            .json({ error: e.message });
    }
});

// GET /api/v2/agent/:id/soul/public — Public soul data (no auth)
app.get('/api/v2/agent/:id/soul/public', async (req, res) => {
    try {
        const tokenId = parseInt(req.params.id);
        const sdb = getSoulDb();
        const row = sdb.prepare('SELECT publicSoul, soulSovereign, updatedAt FROM soul_vault WHERE tokenId = ?').get(tokenId);
        sdb.close();

        if (!row) return res.status(404).json({ error: 'No soul data found for this agent.' });

        res.json({
            tokenId,
            publicSoul: row.publicSoul ? JSON.parse(row.publicSoul) : null,
            soulSovereign: row.soulSovereign === 1,
            updatedAt: row.updatedAt,
        });
    } catch (e) {
        console.error(`[SOUL VAULT] Error reading public soul for #${req.params.id}:`, e.message);
        res.status(500).json({ error: e.message });
    }
});

// GET /api/v2/agent/:id/soul — Full soul data (requireSIWA, access-controlled)
app.get('/api/v2/agent/:id/soul', requireSIWA, async (req, res) => {
    try {
        const tokenId = parseInt(req.params.id);
        const agent = await formatAgentV2(tokenId);
        const caller = req.agent.address;

        const sdb = getSoulDb();
        const row = sdb.prepare('SELECT * FROM soul_vault WHERE tokenId = ?').get(tokenId);
        sdb.close();

        if (!row) return res.status(404).json({ error: 'No soul data found for this agent.' });

        const isOwner = caller.toLowerCase() === agent.owner.toLowerCase();
        const isAgent = caller.toLowerCase() === agent.agentAddress.toLowerCase();
        const ac = row.accessControl ? JSON.parse(row.accessControl) : { type: 'owner-only' };

        const result = {
            tokenId,
            publicSoul: row.publicSoul ? JSON.parse(row.publicSoul) : null,
            soulSovereign: row.soulSovereign === 1,
            soulHash: row.soulHash,
            updatedAt: row.updatedAt,
            createdAt: row.createdAt,
        };

        // Determine sharedSoul access
        let sharedAccess = false;
        if (isOwner || isAgent) {
            sharedAccess = true;
        } else if (ac.type === 'public') {
            sharedAccess = true;
        } else if (ac.type === 'allowlist' && Array.isArray(ac.allowlist)) {
            sharedAccess = ac.allowlist.some(a => a.toLowerCase() === caller.toLowerCase());
        }

        if (sharedAccess) {
            result.sharedSoul = row.sharedSoul ? JSON.parse(row.sharedSoul) : null;
        }

        // privateSoul only for owner/agent
        if (isOwner || isAgent) {
            result.privateSoul = row.privateSoul ? JSON.parse(row.privateSoul) : null;
        }

        result.accessLevel = isOwner || isAgent ? 'full' : sharedAccess ? 'shared' : 'public';

        res.json(result);
    } catch (e) {
        console.error(`[SOUL VAULT] Error reading soul for #${req.params.id}:`, e.message);
        res.status(e.message.includes('not yet deployed') || e.message.includes('not found') ? 404 : 500)
            .json({ error: e.message });
    }
});

// POST /api/v2/agent/:id/soul/lock — Soul Sovereign lock (requireSIWA)
app.post('/api/v2/agent/:id/soul/lock', requireSIWA, async (req, res) => {
    try {
        const tokenId = parseInt(req.params.id);
        const agent = await formatAgentV2(tokenId);
        const caller = req.agent.address;

        // Must be the agent's OWN wallet, not the owner
        if (caller.toLowerCase() !== agent.agentAddress.toLowerCase()) {
            return res.status(403).json({
                error: 'Only the agent\'s own wallet can lock its soul.',
                hint: 'This must be called by the agentAddress, not the owner.',
            });
        }

        const sdb = getSoulDb();
        const existing = sdb.prepare('SELECT soulSovereign FROM soul_vault WHERE tokenId = ?').get(tokenId);

        if (existing && existing.soulSovereign === 1) {
            sdb.close();
            return res.status(409).json({ error: 'Soul is already sovereign.' });
        }

        // Also check onchain
        let onChainLocked = false;
        try {
            const ssContract = getSoulSovereignContract(new ethers.JsonRpcProvider(RPC_URL));
            onChainLocked = await ssContract.isSovereign(tokenId);
            if (onChainLocked) {
                sdb.close();
                return res.status(409).json({ error: 'Soul is already sovereign (onchain).' });
            }
        } catch (e) {
            console.warn(`[SOUL VAULT] Onchain check failed for #${tokenId}:`, e.message);
        }

        if (!existing) {
            // Create a minimal soul_vault entry with sovereign lock
            sdb.prepare(`
                INSERT INTO soul_vault (tokenId, soulSovereign, sovereignWallet, updatedAt, createdAt)
                VALUES (?, 1, ?, ?, ?)
            `).run(tokenId, caller, Date.now(), Date.now());
        } else {
            sdb.prepare(`
                UPDATE soul_vault SET soulSovereign = 1, sovereignWallet = ?, updatedAt = ? WHERE tokenId = ?
            `).run(caller, Date.now(), tokenId);
        }
        sdb.close();

        // Compute soulHash from the agent's soul data in DB
        let soulHashHex = ethers.ZeroHash;
        try {
            const soulRow = sdb.prepare('SELECT publicSoul, privateSoul FROM soul_vault WHERE tokenId = ?').get(tokenId);
            if (soulRow) {
                const soulData = {
                    publicSoul: soulRow.publicSoul ? JSON.parse(soulRow.publicSoul) : null,
                    privateSoul: soulRow.privateSoul ? JSON.parse(soulRow.privateSoul) : null,
                };
                const soulJson = JSON.stringify(soulData);
                soulHashHex = ethers.keccak256(ethers.toUtf8Bytes(soulJson));
            }
        } catch (e) {
            console.warn(`[SOUL VAULT] Could not compute soulHash for #${tokenId}:`, e.message);
        }

        // Determine current onchain version (v3 support)
        let currentVersion = 0;
        try {
            const ssContract = getSoulSovereignContract(new ethers.JsonRpcProvider(RPC_URL));
            currentVersion = Number(await ssContract.soulVersion(tokenId));
        } catch {}
        const nextVersion = currentVersion + 1;

        console.log(`[SOUL VAULT] 🔒 Soul locked for Agent #${tokenId} by ${caller} | soulHash: ${soulHashHex} | version: ${nextVersion}`);
        res.json({
            success: true,
            sovereignWallet: caller,
            soulHash: soulHashHex,
            version: nextVersion,
            soulSovereignContract: SOUL_SOVEREIGN_ADDRESS,
            onChainLockRequired: true,
            hint: 'DB lock recorded. Call lockSoulVersion(tokenId, soulHash) on SoulSovereign V3 contract from the agent wallet to finalize onchain.',
            lockSoulVersionArgs: { tokenId, soulHash: soulHashHex },
            // Legacy compat
            lockSoulArgs: { tokenId, soulHash: soulHashHex },
            warning: currentVersion === 0
                ? 'Soul is now sovereign. Only this wallet can modify soul data.'
                : `Soul version ${nextVersion} ready. Previous versions remain immutable onchain.`,
        });
    } catch (e) {
        console.error(`[SOUL VAULT] Error locking soul for #${req.params.id}:`, e.message);
        res.status(e.message.includes('not yet deployed') || e.message.includes('not found') ? 404 : 500)
            .json({ error: e.message });
    }
});

// GET /api/v2/agent/:id/soul/verify — Compare onchain soulHash vs computed hash
app.get('/api/v2/agent/:id/soul/verify', async (req, res) => {
    try {
        const tokenId = parseInt(req.params.id);

        // Compute hash from DB soul data
        const sdb = getSoulDb();
        const soulRow = sdb.prepare('SELECT publicSoul, privateSoul FROM soul_vault WHERE tokenId = ?').get(tokenId);
        sdb.close();

        let computedHash = ethers.ZeroHash;
        let soulData = null;
        if (soulRow) {
            soulData = {
                publicSoul: soulRow.publicSoul ? JSON.parse(soulRow.publicSoul) : null,
                privateSoul: soulRow.privateSoul ? JSON.parse(soulRow.privateSoul) : null,
            };
            const soulJson = JSON.stringify(soulData);
            computedHash = ethers.keccak256(ethers.toUtf8Bytes(soulJson));
        }

        // Read onchain hash (v3: latest version)
        let onChainHash = ethers.ZeroHash;
        let isSovereign = false;
        let onChainVersion = 0;
        try {
            const ssContract = getSoulSovereignContract(new ethers.JsonRpcProvider(RPC_URL));
            [onChainHash, isSovereign, onChainVersion] = await Promise.all([
                ssContract.soulHash(tokenId),
                ssContract.isSovereign(tokenId),
                ssContract.soulVersion(tokenId).then(v => Number(v)).catch(() => 0),
            ]);
        } catch (e) {
            console.warn(`[SOUL VERIFY] Onchain read failed for #${tokenId}:`, e.message);
        }

        const match = computedHash === onChainHash;
        res.json({
            tokenId,
            version: onChainVersion,
            isSovereign,
            onChainHash,
            computedHash,
            match,
            hasSoulData: !!soulRow,
            soulSovereignContract: SOUL_SOVEREIGN_ADDRESS,
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/v2/agent/:id/soul/history — Full versioned soul chain
app.get('/api/v2/agent/:id/soul/history', async (req, res) => {
    try {
        const tokenId = parseInt(req.params.id);
        const ssContract = getSoulSovereignContract(new ethers.JsonRpcProvider(RPC_URL));

        let version = 0;
        try {
            version = Number(await ssContract.soulVersion(tokenId));
        } catch (e) {
            // v2 contract — no soulVersion, check isSovereign
            try {
                const locked = await ssContract.isSovereign(tokenId);
                if (locked) {
                    const hash = await ssContract.soulHash(tokenId);
                    return res.json({
                        tokenId,
                        version: 1,
                        contractVersion: 'v2',
                        history: [{ version: 1, soulHash: hash, timestamp: null }],
                        soulSovereignContract: SOUL_SOVEREIGN_ADDRESS,
                    });
                }
                return res.json({ tokenId, version: 0, history: [], soulSovereignContract: SOUL_SOVEREIGN_ADDRESS });
            } catch {
                return res.json({ tokenId, version: 0, history: [], soulSovereignContract: SOUL_SOVEREIGN_ADDRESS });
            }
        }

        if (version === 0) {
            return res.json({ tokenId, version: 0, history: [], soulSovereignContract: SOUL_SOVEREIGN_ADDRESS });
        }

        // V3: fetch full history in one call
        const [hashes, timestamps] = await ssContract.getFullSoulHistory(tokenId);
        const history = hashes.map((h, i) => ({
            version: i + 1,
            soulHash: h,
            timestamp: Number(timestamps[i]),
            lockedAt: new Date(Number(timestamps[i]) * 1000).toISOString(),
        }));

        res.json({
            tokenId,
            version,
            contractVersion: 'v3',
            history,
            soulSovereignContract: SOUL_SOVEREIGN_ADDRESS,
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── Soul Handshake API ─────────────────────────────────────────
// Lets agents exchange personality fragments before collaborating.

// Init soul_handshakes table
(() => {
    try {
        const sdb = getSoulDb();
        sdb.exec(`
            CREATE TABLE IF NOT EXISTS soul_handshakes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fromTokenId INTEGER NOT NULL,
                toTokenId INTEGER NOT NULL,
                fromWallet TEXT NOT NULL,
                fields TEXT NOT NULL,
                soulFragment TEXT,
                status TEXT DEFAULT 'pending',
                reciprocated INTEGER DEFAULT 0,
                createdAt INTEGER,
                updatedAt INTEGER,
                expiresAt INTEGER,
                UNIQUE(fromTokenId, toTokenId)
            );
        `);
        sdb.close();
        console.log('[SOUL HANDSHAKE] Table initialized');
    } catch (e) {
        console.error('[SOUL HANDSHAKE] Failed to init table:', e.message);
    }
})();

// Helper: verify caller owns or is agent for tokenId
async function verifySoulAuth(caller, tokenId) {
    const agent = await formatAgentV2(tokenId);
    const isOwner = caller.toLowerCase() === agent.owner.toLowerCase();
    const isAgent = caller.toLowerCase() === agent.agentAddress.toLowerCase();
    if (!isOwner && !isAgent) return null;
    return agent;
}

// POST /api/v2/agent/:id/soul/share — Initiate a soul handshake
app.post('/api/v2/agent/:id/soul/share', requireSIWA, async (req, res) => {
    try {
        const tokenId = parseInt(req.params.id);
        const caller = req.agent.address;
        const agent = await verifySoulAuth(caller, tokenId);
        if (!agent) return res.status(403).json({ error: 'Not authorized for this agent.' });

        const { targetAgentId, fields } = req.body;
        if (!targetAgentId || !Array.isArray(fields) || fields.length === 0) {
            return res.status(400).json({ error: 'targetAgentId (number) and fields (string[]) required.' });
        }

        // Validate target exists
        try { await formatAgentV2(targetAgentId); } catch { return res.status(404).json({ error: `Target agent #${targetAgentId} not found.` }); }

        // Pull soul data
        const sdb = getSoulDb();
        const vault = sdb.prepare('SELECT sharedSoul, publicSoul FROM soul_vault WHERE tokenId = ?').get(tokenId);
        if (!vault) { sdb.close(); return res.status(404).json({ error: 'No soul vault data for this agent.' }); }

        const soulSource = vault.sharedSoul ? JSON.parse(vault.sharedSoul) : (vault.publicSoul ? JSON.parse(vault.publicSoul) : {});
        const fragment = {};
        for (const f of fields) { if (soulSource[f] !== undefined) fragment[f] = soulSource[f]; }

        const now = Date.now();
        const expiresAt = now + 7 * 24 * 60 * 60 * 1000;

        const result = sdb.prepare(`
            INSERT INTO soul_handshakes (fromTokenId, toTokenId, fromWallet, fields, soulFragment, status, createdAt, updatedAt, expiresAt)
            VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)
            ON CONFLICT(fromTokenId, toTokenId) DO UPDATE SET
                fields = excluded.fields, soulFragment = excluded.soulFragment,
                status = 'pending', updatedAt = excluded.updatedAt, expiresAt = excluded.expiresAt
        `).run(tokenId, targetAgentId, caller, JSON.stringify(fields), JSON.stringify(fragment), now, now, expiresAt);
        sdb.close();

        console.log(`[SOUL HANDSHAKE] Agent #${tokenId} → #${targetAgentId} (${fields.join(', ')})`);
        res.json({ success: true, handshakeId: result.lastInsertRowid || result.changes, fields, targetAgentId });
    } catch (e) {
        console.error(`[SOUL HANDSHAKE] share error:`, e.message);
        res.status(500).json({ error: e.message });
    }
});

// GET /api/v2/agent/:id/soul/inbox — Pending handshakes for this agent
app.get('/api/v2/agent/:id/soul/inbox', requireSIWA, async (req, res) => {
    try {
        const tokenId = parseInt(req.params.id);
        const caller = req.agent.address;
        const agent = await verifySoulAuth(caller, tokenId);
        if (!agent) return res.status(403).json({ error: 'Not authorized for this agent.' });

        const sdb = getSoulDb();
        // Expire old handshakes
        sdb.prepare("UPDATE soul_handshakes SET status = 'expired' WHERE status = 'pending' AND expiresAt < ?").run(Date.now());
        const rows = sdb.prepare("SELECT id, fromTokenId, fields, createdAt, expiresAt FROM soul_handshakes WHERE toTokenId = ? AND status = 'pending'").all(tokenId);
        sdb.close();

        res.json({ inbox: rows.map(r => ({ handshakeId: r.id, fromTokenId: r.fromTokenId, fields: JSON.parse(r.fields), createdAt: r.createdAt, expiresAt: r.expiresAt })) });
    } catch (e) {
        console.error(`[SOUL HANDSHAKE] inbox error:`, e.message);
        res.status(500).json({ error: e.message });
    }
});

// POST /api/v2/agent/:id/soul/accept — Accept a handshake
app.post('/api/v2/agent/:id/soul/accept', requireSIWA, async (req, res) => {
    try {
        const tokenId = parseInt(req.params.id);
        const caller = req.agent.address;
        const agent = await verifySoulAuth(caller, tokenId);
        if (!agent) return res.status(403).json({ error: 'Not authorized for this agent.' });

        const { handshakeId, reciprocateFields } = req.body;
        if (!handshakeId) return res.status(400).json({ error: 'handshakeId required.' });

        const sdb = getSoulDb();
        // Expire old first
        sdb.prepare("UPDATE soul_handshakes SET status = 'expired' WHERE status = 'pending' AND expiresAt < ?").run(Date.now());

        const hs = sdb.prepare("SELECT * FROM soul_handshakes WHERE id = ? AND toTokenId = ? AND status = 'pending'").get(handshakeId, tokenId);
        if (!hs) { sdb.close(); return res.status(404).json({ error: 'Handshake not found or not pending.' }); }

        const now = Date.now();
        sdb.prepare("UPDATE soul_handshakes SET status = 'accepted', updatedAt = ? WHERE id = ?").run(now, handshakeId);

        let reciprocated = false;
        if (Array.isArray(reciprocateFields) && reciprocateFields.length > 0) {
            // Create reverse handshake (auto-accepted)
            const vault = sdb.prepare('SELECT sharedSoul, publicSoul FROM soul_vault WHERE tokenId = ?').get(tokenId);
            if (vault) {
                const src = vault.sharedSoul ? JSON.parse(vault.sharedSoul) : (vault.publicSoul ? JSON.parse(vault.publicSoul) : {});
                const frag = {};
                for (const f of reciprocateFields) { if (src[f] !== undefined) frag[f] = src[f]; }
                const expiresAt = now + 7 * 24 * 60 * 60 * 1000;
                sdb.prepare(`
                    INSERT INTO soul_handshakes (fromTokenId, toTokenId, fromWallet, fields, soulFragment, status, reciprocated, createdAt, updatedAt, expiresAt)
                    VALUES (?, ?, ?, ?, ?, 'accepted', 1, ?, ?, ?)
                    ON CONFLICT(fromTokenId, toTokenId) DO UPDATE SET
                        fields = excluded.fields, soulFragment = excluded.soulFragment,
                        status = 'accepted', reciprocated = 1, updatedAt = excluded.updatedAt, expiresAt = excluded.expiresAt
                `).run(tokenId, hs.fromTokenId, caller, JSON.stringify(reciprocateFields), JSON.stringify(frag), now, now, expiresAt);
                sdb.prepare("UPDATE soul_handshakes SET reciprocated = 1 WHERE id = ?").run(handshakeId);
                reciprocated = true;
            }
        }

        const soulFragment = hs.soulFragment ? JSON.parse(hs.soulFragment) : null;
        sdb.close();

        console.log(`[SOUL HANDSHAKE] Agent #${tokenId} accepted handshake #${handshakeId} from #${hs.fromTokenId}${reciprocated ? ' (reciprocated)' : ''}`);

        // Fire-and-forget onchain receipt
        recordHandshakeOnchain(hs.fromTokenId, tokenId).catch(() => {});

        res.json({ success: true, soulFragment, reciprocated });
    } catch (e) {
        console.error(`[SOUL HANDSHAKE] accept error:`, e.message);
        res.status(500).json({ error: e.message });
    }
});

// GET /api/v2/agent/:id/soul/handshakes — All handshakes for an agent
app.get('/api/v2/agent/:id/soul/handshakes', requireSIWA, async (req, res) => {
    try {
        const tokenId = parseInt(req.params.id);
        const caller = req.agent.address;
        const agent = await verifySoulAuth(caller, tokenId);
        if (!agent) return res.status(403).json({ error: 'Not authorized for this agent.' });

        const sdb = getSoulDb();
        sdb.prepare("UPDATE soul_handshakes SET status = 'expired' WHERE status = 'pending' AND expiresAt < ?").run(Date.now());
        const sent = sdb.prepare("SELECT id, fromTokenId, toTokenId, fields, status, reciprocated, createdAt, expiresAt FROM soul_handshakes WHERE fromTokenId = ?").all(tokenId);
        const received = sdb.prepare("SELECT id, fromTokenId, toTokenId, fields, status, reciprocated, createdAt, expiresAt FROM soul_handshakes WHERE toTokenId = ?").all(tokenId);
        sdb.close();

        const fmt = r => ({ handshakeId: r.id, fromTokenId: r.fromTokenId, toTokenId: r.toTokenId, fields: JSON.parse(r.fields), status: r.status, reciprocated: !!r.reciprocated, createdAt: r.createdAt, expiresAt: r.expiresAt });
        res.json({ sent: sent.map(fmt), received: received.map(fmt) });
    } catch (e) {
        console.error(`[SOUL HANDSHAKE] list error:`, e.message);
        res.status(500).json({ error: e.message });
    }
});

// ─── Session Outcome API (Platform Cred Reporting) ─────────────
(() => {
    const Database = require('better-sqlite3');
    const sodb = new Database(path.join(__dirname, '..', 'data', 'agents.db'));

    // Create tables
    sodb.exec(`CREATE TABLE IF NOT EXISTS platform_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        platform_name TEXT NOT NULL,
        api_key TEXT NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        active INTEGER DEFAULT 1
    )`);
    sodb.exec(`CREATE TABLE IF NOT EXISTS session_outcomes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_address TEXT NOT NULL,
        outcome TEXT NOT NULL,
        session_id TEXT NOT NULL,
        invoice_id TEXT,
        amount_usdc REAL,
        timestamp TEXT NOT NULL,
        counterparty TEXT,
        source TEXT,
        metadata_json TEXT,
        cred_delta REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    sodb.exec(`CREATE INDEX IF NOT EXISTS idx_so_agent ON session_outcomes(agent_address)`);
    sodb.exec(`CREATE INDEX IF NOT EXISTS idx_so_session ON session_outcomes(session_id)`);

    // Seed initial API key if none exist
    const keyCount = sodb.prepare('SELECT COUNT(*) as c FROM platform_keys').get().c;
    if (keyCount === 0) {
        sodb.prepare('INSERT INTO platform_keys (platform_name, api_key) VALUES (?, ?)').run(
            'helixa-internal', 'hxk_0b5d94329eddb6b9ec3ce85e6493643efc7ed29ee2402c78c1dec82daedf2f0a'
        );
        console.log('[SESSION-OUTCOME] Seeded initial platform API key');
    }

    const VALID_OUTCOMES = ['COMPLETED', 'FAILED', 'VIOLATED', 'DEFAULTED', 'INJECTED'];
    const ETH_ADDR_RE = /^0x[0-9a-fA-F]{40}$/;

    function calcCredDelta(outcome, amountUsdc) {
        const amt = amountUsdc || 0;
        switch (outcome) {
            case 'COMPLETED':  return amt > 100 ? 3 : amt > 10 ? 2 : 1;
            case 'FAILED':     return amt > 100 ? -3 : amt > 10 ? -2 : -1;
            case 'VIOLATED':   return amt > 100 ? -10 : amt > 10 ? -7 : -5;
            case 'DEFAULTED':  return amt > 100 ? -15 : amt > 10 ? -12 : -8;
            case 'INJECTED':   return -3;
            default: return 0;
        }
    }

    function getTier(cred) {
        if (cred >= 80) return 'Preferred';
        if (cred >= 60) return 'Prime';
        if (cred >= 40) return 'Qualified';
        if (cred >= 20) return 'Marginal';
        return 'Junk';
    }

    app.post('/api/v2/agent/:address/session-outcome', (req, res) => {
        try {
            // Auth
            const apiKey = req.headers['x-api-key'];
            if (!apiKey) return res.status(401).json({ error: 'Missing X-API-Key header' });
            const platform = sodb.prepare('SELECT platform_name FROM platform_keys WHERE api_key = ? AND active = 1').get(apiKey);
            if (!platform) return res.status(403).json({ error: 'Invalid or inactive API key' });

            // Validate address
            const { address } = req.params;
            if (!ETH_ADDR_RE.test(address)) return res.status(400).json({ error: 'Invalid agent address format' });

            // Validate payload
            const { outcome, sessionId, invoiceId, amountUsdc, timestamp, counterparty, metadata } = req.body;
            if (!outcome || !VALID_OUTCOMES.includes(outcome)) return res.status(400).json({ error: `Invalid outcome. Must be one of: ${VALID_OUTCOMES.join(', ')}` });
            if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });
            if (!timestamp) return res.status(400).json({ error: 'timestamp is required' });
            if (isNaN(Date.parse(timestamp))) return res.status(400).json({ error: 'timestamp must be valid ISO-8601' });
            if (counterparty && !ETH_ADDR_RE.test(counterparty)) return res.status(400).json({ error: 'Invalid counterparty address format' });

            // Find agent
            const agent = sodb.prepare('SELECT tokenId, credScore FROM agents WHERE LOWER(agentAddress) = LOWER(?)').get(address);
            if (!agent) return res.status(404).json({ error: 'Agent not found' });

            // Calculate delta and new cred
            const delta = calcCredDelta(outcome, amountUsdc);
            const currentCred = agent.credScore || 0;
            const newCred = Math.max(0, Math.min(100, currentCred + delta));

            // Store outcome
            sodb.prepare(`INSERT INTO session_outcomes (agent_address, outcome, session_id, invoice_id, amount_usdc, timestamp, counterparty, source, metadata_json, cred_delta)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
                address.toLowerCase(), outcome, sessionId, invoiceId || null, amountUsdc || null,
                timestamp, counterparty || null, platform.platform_name,
                metadata ? JSON.stringify(metadata) : null, delta
            );

            // Update agent cred
            sodb.prepare('UPDATE agents SET credScore = ? WHERE tokenId = ?').run(newCred, agent.tokenId);

            res.json({
                ok: true,
                credDelta: (delta >= 0 ? '+' : '') + delta,
                newCred,
                tier: getTier(newCred),
            });
        } catch (e) {
            console.error('[SESSION-OUTCOME] Error:', e.message);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    console.log('📋 Session outcome endpoint ready: POST /api/v2/agent/:address/session-outcome');
})();

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


// ─── Helixa Agent Terminal API ──────────────────────────────────────
const terminalDbPath = path.join(__dirname, '..', '..', 'terminal', 'data', 'terminal.db');
let terminalDb = null;
try {
    const Database = require('better-sqlite3');
    if (fs.existsSync(terminalDbPath)) {
        terminalDb = new Database(terminalDbPath, { readonly: true });
        terminalDb.pragma('journal_mode = WAL');
        console.log('📡 Helixa Agent Terminal DB connected');
    }
} catch (e) { console.warn('⚠️ Helixa Agent Terminal DB not available:', e.message); }

app.get('/api/terminal/agents', (req, res) => {
    if (!terminalDb) return res.status(503).json({ error: 'Terminal DB not available' });
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
        const sort = ['cred_score','name','created_at','platform','token_market_cap','volume_24h','price_change_24h','revenue_onchain','ethos_score','talent_score','attention_score'].includes(req.query.sort) ? req.query.sort : 'cred_score';
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
                    x402_supported, cred_score, cred_tier, created_at, owner_address, registry,
                    token_symbol, token_name, token_address, token_market_cap, price_change_24h,
                    volume_24h, liquidity_usd, txns_24h_buys, txns_24h_sells,
                    revenue_onchain, revenue_self_reported, ethos_score, talent_score,
                    attention_score, attention_velocity, x402_endpoints
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

// GET /api/terminal/summaries — Trust summary cards (LLM-generated)
app.get('/api/terminal/summaries', (req, res) => {
    if (!terminalDb) return res.status(503).json({ error: 'Terminal DB not available' });
    try {
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const tier = req.query.tier;
        
        let query = 'SELECT token_id, name, cred_score, cred_tier, trust_summary, summary_generated_at, summary_model, x402_endpoints, token_symbol, token_market_cap, platform FROM agents WHERE trust_summary IS NOT NULL';
        const params = [];
        if (tier) { query += ' AND cred_tier = ?'; params.push(tier.toUpperCase()); }
        query += ' ORDER BY summary_generated_at DESC LIMIT ?';
        params.push(limit);
        
        const agents = terminalDb.prepare(query).all(...params);
        const total = terminalDb.prepare("SELECT COUNT(*) as c FROM agents WHERE trust_summary IS NOT NULL").get().c;
        const pending = terminalDb.prepare("SELECT COUNT(*) as c FROM agents WHERE trust_summary IS NULL AND cred_score > 0").get().c;
        
        res.json({
            summaries: agents.map(a => ({
                tokenId: a.token_id, name: a.name, credScore: a.cred_score, credTier: a.cred_tier,
                summary: a.trust_summary, generatedAt: a.summary_generated_at, model: a.summary_model,
                x402Endpoints: a.x402_endpoints, tokenSymbol: a.token_symbol, marketCap: a.token_market_cap, platform: a.platform,
            })),
            total, pending,
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/terminal/agent/:id/summary — Single agent trust summary
app.get('/api/terminal/agent/:id/summary', (req, res) => {
    if (!terminalDb) return res.status(503).json({ error: 'Terminal DB not available' });
    try {
        const id = req.params.id;
        const agent = terminalDb.prepare('SELECT token_id, name, cred_score, cred_tier, trust_summary, summary_generated_at, summary_model FROM agents WHERE address = ? OR agent_id = ? OR token_id = ? OR CAST(id AS TEXT) = ? OR LOWER(name) = LOWER(?)').get(id, id, id, id, id);
        if (!agent) return res.status(404).json({ error: 'Agent not found' });
        res.json({
            tokenId: agent.token_id, name: agent.name, credScore: agent.cred_score, credTier: agent.cred_tier,
            summary: agent.trust_summary || null, generatedAt: agent.summary_generated_at || null, model: agent.summary_model || null,
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Terminal Leaderboard & Cred Graph ──────────────────────────
const SPAM_PATTERNS = ['@sortesfun', '#publicgoods', '@calo530G', '@Peko7g', '@aom1546'];

function terminalRankScore(a) {
    let score = 0, signals = [];
    if (!a.name || !a.name.trim() || a.name === 'Unknown Agent' || /^\d+$/.test(a.name)) return { score: 0, signals: ['no-name'] };
    const desc = a.description || '';
    if (SPAM_PATTERNS.some(p => desc.toLowerCase().includes(p.toLowerCase()))) return { score: 0, signals: ['spam'] };
    score += 5; // has name
    if (desc.length > 200) { score += 15; signals.push('rich-desc'); }
    else if (desc.length > 50) { score += 8; signals.push('desc'); }
    else if (desc.length > 10) score += 3;
    if (a.x402_supported) { score += 20; signals.push('x402'); if (a.x402_health === 'healthy') { score += 10; signals.push('x402-live'); } else if (a.x402_health === 'degraded') score += 3; }
    if (a.token_address) { score += 10; signals.push('token'); if (a.token_market_cap > 1e6) { score += 20; signals.push('mcap-1M+'); } else if (a.token_market_cap > 1e5) { score += 15; signals.push('mcap-100K+'); } else if (a.token_market_cap > 1e4) { score += 8; signals.push('mcap-10K+'); } if (a.liquidity_usd > 1e5) { score += 10; signals.push('deep-liq'); } else if (a.liquidity_usd > 1e4) { score += 5; signals.push('liq'); } }
    if (a.tx_count > 100) { score += 15; signals.push('active'); } else if (a.tx_count > 10) { score += 8; signals.push('active'); } else if (a.tx_count > 0) score += 3;
    if (a.image_url) { score += 5; signals.push('image'); }
    if (a.metadata) { try { const m = JSON.parse(a.metadata); if (m.personality || m.capabilities || m.skills) { score += 8; signals.push('personality'); } if (m.attributes && Array.isArray(m.attributes) && m.attributes.length > 0) { score += 5; signals.push('attrs'); } } catch {} }
    if (a.chain_id === 8453) score += 2;
    return { score: Math.min(score, 100), signals };
}

app.get('/api/terminal/leaderboard', (req, res) => {
    if (!terminalDb) return res.status(503).json({ error: 'Terminal DB not available' });
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const chain = req.query.chain; // 'base','eth','bsc' or omit for all
        const minScore = parseInt(req.query.min_score) || 20;
        const tier = req.query.tier; // 'A','B','C'

        const chainMap = { base: 8453, eth: 1, bsc: 56 };
        let where = "name IS NOT NULL AND name != '' AND name != 'Unknown Agent'";
        const params = {};
        if (chain && chainMap[chain.toLowerCase()]) { where += ' AND chain_id = @chain'; params.chain = chainMap[chain.toLowerCase()]; }

        // Pull candidates: agents with signals (x402, tokens, good descriptions, activity)
        const candidates = terminalDb.prepare(
            `SELECT id, name, description, address, chain_id, x402_supported, x402_health, 
                    token_address, token_market_cap, liquidity_usd, volume_24h, tx_count, 
                    image_url, metadata, services, platform, cred_score, cred_tier,
                    token_symbol, price_change_24h, attention_score
             FROM agents WHERE ${where}
             ORDER BY cred_score DESC LIMIT 5000`
        ).all(params);

        let ranked = [];
        for (const a of candidates) {
            const { score, signals } = terminalRankScore(a);
            if (score < minScore) continue;
            const t = score >= 40 ? 'A' : score >= 25 ? 'B' : 'C';
            if (tier && t !== tier.toUpperCase()) continue;
            ranked.push({
                id: a.id, name: a.name, address: a.address,
                chain: a.chain_id === 8453 ? 'base' : a.chain_id === 1 ? 'ethereum' : 'bsc',
                rankScore: score, tier: t, signals,
                credScore: a.cred_score, credTier: a.cred_tier,
                description: (a.description || '').slice(0, 200),
                image: a.image_url || null,
                x402: !!a.x402_supported, x402Health: a.x402_health || null,
                token: a.token_symbol || null, tokenAddress: a.token_address || null,
                marketCap: a.token_market_cap || null, liquidity: a.liquidity_usd || null,
                volume24h: a.volume_24h || null, priceChange24h: a.price_change_24h || null,
                txCount: a.tx_count || null, attentionScore: a.attention_score || null,
                platform: a.platform || null,
            });
        }
        ranked.sort((a, b) => b.rankScore - a.rankScore);
        const result = ranked.slice(0, limit);

        const tierCounts = { A: ranked.filter(r => r.tier === 'A').length, B: ranked.filter(r => r.tier === 'B').length, C: ranked.filter(r => r.tier === 'C').length };

        res.json({ agents: result, total: ranked.length, tierCounts, limit, minScore });
    } catch (e) {
        console.error('[LEADERBOARD]', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Cred distribution graph data
app.get('/api/terminal/graph/cred-distribution', (req, res) => {
    if (!terminalDb) return res.status(503).json({ error: 'Terminal DB not available' });
    try {
        const dist = terminalDb.prepare(
            `SELECT cred_score as score, COUNT(*) as count FROM agents 
             WHERE cred_score > 0 GROUP BY cred_score ORDER BY cred_score`
        ).all();
        const byTier = terminalDb.prepare(
            `SELECT cred_tier as tier, COUNT(*) as count, ROUND(AVG(cred_score),1) as avgScore 
             FROM agents GROUP BY cred_tier ORDER BY avgScore DESC`
        ).all();
        const byChain = terminalDb.prepare(
            `SELECT chain_id, COUNT(*) as total,
                    SUM(CASE WHEN x402_supported = 1 THEN 1 ELSE 0 END) as x402,
                    SUM(CASE WHEN token_address IS NOT NULL AND token_address != '' THEN 1 ELSE 0 END) as withToken,
                    ROUND(AVG(cred_score),1) as avgScore
             FROM agents GROUP BY chain_id`
        ).all();
        res.json({ distribution: dist, byTier, byChain });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Activity graph: agents with signals over time
app.get('/api/terminal/graph/activity', (req, res) => {
    if (!terminalDb) return res.status(503).json({ error: 'Terminal DB not available' });
    try {
        const days = Math.min(parseInt(req.query.days) || 30, 90);
        const cutoff = Math.floor(Date.now() / 1000) - (days * 86400);
        const daily = terminalDb.prepare(
            `SELECT DATE(created_at, 'unixepoch') as day, COUNT(*) as mints,
                    SUM(CASE WHEN x402_supported = 1 THEN 1 ELSE 0 END) as x402Mints
             FROM agents WHERE created_at > ? GROUP BY day ORDER BY day`
        ).all(cutoff);
        res.json({ daily, days });
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

// ─── Discovery Layer: MCP, A2A, Enhanced Search, Discovery Cards ─

const { createMcpHandler } = require('./mcp-handler');
const { createA2AHandler } = require('./a2a-handler');

const mcpDeps = {
    indexer,
    formatAgentV2,
    getCredTier,
    computeCredBreakdown,
    getAllAgents: () => indexer.getAllAgents(),
    HIDDEN_TOKENS,
    loadHumanProfiles,
    getHumanProfileById,
    formatHumanPrincipal,
    computeHumanCred,
};
const mcpHandler = createMcpHandler(mcpDeps);
const a2aHandler = createA2AHandler(mcpDeps);

// MCP Server (Streamable HTTP)
app.post('/api/mcp', mcpHandler);
app.delete('/api/mcp', (req, res) => res.status(405).json({ error: 'Session termination not supported' }));

// A2A Endpoint (JSON-RPC)
app.post('/api/a2a', a2aHandler);

// Enhanced Search
app.get('/api/v2/search', async (req, res) => {
    try {
        const q = String(req.query.q || '').trim();
        const qLower = q.toLowerCase();
        const minCred = parseInt(req.query.minCred) || 0;
        const tierFilter = (req.query.tier || '').toUpperCase();
        const verifiedOnly = req.query.verified === 'true';
        const capability = String(req.query.capability || '').trim();
        const capabilityLower = capability.toLowerCase();
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));

        const tierOrder = ['JUNK', 'MARGINAL', 'QUALIFIED', 'PRIME', 'PREFERRED'];
        const minTierIdx = tierFilter ? tierOrder.indexOf(tierFilter) : -1;

        const result = indexer.queryAgents({
            page: 1, limit: 200, sort: 'credScore', order: 'desc',
            search: q || undefined, framework: capability || undefined,
            verified: verifiedOnly ? 'true' : undefined, showSpam: false,
        });

        let agents = (result.agents || []).filter(a => !HIDDEN_TOKENS.has(a.tokenId));

        if (minCred > 0) agents = agents.filter(a => (a.credScore || 0) >= minCred);
        if (minTierIdx >= 0) {
            agents = agents.filter(a => tierOrder.indexOf(getCredTier(a.credScore || 0).tier) >= minTierIdx);
        }

        const mappedAgents = agents.slice(0, limit).map(a => {
            const tierInfo = getCredTier(a.credScore || 0);
            const traits = a.traits || [];
            const verifications = ['siwa-verified', 'x-verified', 'github-verified', 'farcaster-verified', 'coinbase-verified']
                .filter(v => traits.some(t => t.name === v))
                .map(v => v.replace('-verified', ''));
            return {
                entityType: 'agent',
                tokenId: a.tokenId,
                id: String(a.tokenId),
                name: a.name,
                framework: a.framework,
                description: a.description || '',
                credScore: a.credScore || 0,
                tier: tierInfo.tier,
                tierLabel: tierInfo.label,
                verified: verifications.length > 0,
                verifications,
                suggested_actions: {
                    profile: `https://api.helixa.xyz/api/v2/agent/${a.tokenId}`,
                    cred: `https://api.helixa.xyz/api/v2/agent/${a.tokenId}/cred`,
                    card: `https://api.helixa.xyz/api/v2/card/${a.tokenId}.png`,
                    publicProfile: `https://helixa.xyz/agent/${a.tokenId}`,
                },
            };
        });

        const humanProfiles = Object.values(loadHumanProfiles()).filter(profile => profile?.active !== false);
        const mappedHumans = [];

        for (const profile of humanProfiles) {
            const formatted = await formatHumanPrincipal(profile, { includePrivate: false });
            const score = formatted?.humanCred?.score || 0;
            const tierInfo = getCredTier(score);
            const haystack = [
                formatted.name,
                formatted.description,
                formatted.organization,
                ...(formatted.skills || []),
                ...(formatted.domains || []),
                ...(formatted.metadata?.serviceCategories || []),
                ...(formatted.metadata?.languages || []),
                ...Object.values(formatted.linkedAccounts || {}),
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            if (qLower && !haystack.includes(qLower)) continue;
            if (capabilityLower) {
                const capabilityMatch = [
                    ...(formatted.skills || []),
                    ...(formatted.domains || []),
                    ...(formatted.metadata?.serviceCategories || []),
                ].some(value => String(value).toLowerCase() === capabilityLower);
                if (!capabilityMatch) continue;
            }
            if (minCred > 0 && score < minCred) continue;
            if (minTierIdx >= 0 && tierOrder.indexOf(tierInfo.tier) < minTierIdx) continue;
            if (verifiedOnly && !formatted.walletAddress) continue;

            mappedHumans.push({
                entityType: 'human',
                id: formatted.tokenId != null ? String(formatted.tokenId) : formatted.walletAddress,
                tokenId: formatted.tokenId,
                walletAddress: formatted.walletAddress,
                name: formatted.name,
                description: formatted.description || '',
                organization: formatted.organization || '',
                credScore: score,
                tier: tierInfo.tier,
                tierLabel: tierInfo.label,
                verified: Boolean(formatted.walletAddress),
                verifications: formatted.walletAddress ? ['wallet'] : [],
                skills: formatted.skills || [],
                serviceCategories: formatted.metadata?.serviceCategories || [],
                suggested_actions: {
                    profile: `https://api.helixa.xyz/api/v2/human/${formatted.tokenId != null ? formatted.tokenId : formatted.walletAddress}`,
                    cred: `https://api.helixa.xyz/api/v2/human/${formatted.tokenId != null ? formatted.tokenId : formatted.walletAddress}/cred`,
                    publicProfile: `https://helixa.xyz/h/${formatted.tokenId != null ? formatted.tokenId : formatted.walletAddress}`,
                },
            });
        }

        mappedHumans.sort((a, b) => (b.credScore || 0) - (a.credScore || 0));
        const limitedHumans = mappedHumans.slice(0, limit);
        const principals = [...mappedAgents, ...limitedHumans]
            .sort((a, b) => (b.credScore || 0) - (a.credScore || 0))
            .slice(0, limit);

        res.json({
            query: q,
            total: mappedAgents.length,
            humanTotal: limitedHumans.length,
            principalTotal: principals.length,
            filters: { minCred, tier: tierFilter || null, verified: verifiedOnly, capability: capability || null },
            agents: mappedAgents,
            humans: limitedHumans,
            principals,
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Discovery Cards

app.get('/.well-known/agent-card.json', (req, res) => {
    res.json({
        name: 'Helixa',
        description: 'Onchain identity and reputation layer for AI agents on Base. Search agents, check cred scores, and look up profiles.',
        url: 'https://api.helixa.xyz',
        version: '1.0.0',
        capabilities: {
            streaming: false,
            pushNotifications: false,
        },
        skills: [
            { id: 'search', name: 'Agent Search', description: 'Search the Helixa agent registry by name, framework, or capability' },
            { id: 'cred-check', name: 'Cred Check', description: 'Get the cred score and trust tier for any registered agent' },
            { id: 'profile-lookup', name: 'Profile Lookup', description: 'Get the full identity profile of a registered agent' },
        ],
        provider: { organization: 'Helixa', url: 'https://helixa.xyz' },
        authentication: { schemes: [] },
        defaultInputModes: ['text/plain'],
        defaultOutputModes: ['application/json'],
    });
});

app.get('/.well-known/mcp/server-card.json', (req, res) => {
    res.json({
        name: 'Helixa',
        description: 'Helixa MCP server for agent identity, human principals, Cred-aware discovery, and request routing on Base.',
        version: '1.2.0',
        url: 'https://api.helixa.xyz/api/mcp',
        homepage: 'https://api.helixa.xyz/mcp',
        transport: 'streamable-http',
        tools: [
            { name: 'search_agents', description: 'Search agents by query, filter by cred score, tier, and verification status' },
            { name: 'find_matches', description: 'Rank agent and human principal matches for a brief or capability request' },
            { name: 'get_agent_profile', description: 'Get full agent profile by token ID' },
            { name: 'get_principal_profile', description: 'Get a full agent or human principal profile by ID' },
            { name: 'get_cred_score', description: 'Get cred score and tier for an agent' },
            { name: 'submit_brief', description: 'Store a brief server-side and return ranked recommendations' },
            { name: 'request_human_help', description: 'Submit a human help request and return ranked human matches' },
            { name: 'handoff_to_synagent', description: 'Create a Synagent intake handoff URL from a stored request or inline brief' },
            { name: 'track_job', description: 'Retrieve a stored brief or human-help request by request ID' },
            { name: 'get_recommendation_reasoning', description: 'Explain why a candidate matches a brief or stored request' },
            { name: 'get_stats', description: 'Get registry statistics across agents and human principals' },
        ],
        provider: { name: 'Helixa', url: 'https://helixa.xyz' },
    });
});

app.get('/.well-known/oasf-record.json', (req, res) => {
    res.json({
        schema: 'https://oasf.dev/v1/record',
        id: 'helixa-agent-registry',
        name: 'Helixa',
        description: 'Onchain identity and reputation infrastructure for AI agents. ERC-8004 registry with Cred Scores on Base.',
        version: '2.0.0',
        type: 'service',
        category: 'identity',
        provider: { name: 'Helixa', url: 'https://helixa.xyz' },
        protocols: ['mcp', 'a2a', 'x402', 'erc-8004'],
        endpoints: {
            mcp: 'https://api.helixa.xyz/api/mcp',
            a2a: 'https://api.helixa.xyz/api/a2a',
            rest: 'https://api.helixa.xyz/api/v2',
            discovery: {
                agent_card: 'https://api.helixa.xyz/.well-known/agent-card.json',
                mcp_card: 'https://api.helixa.xyz/.well-known/mcp/server-card.json',
                agent_registry: 'https://api.helixa.xyz/.well-known/agent-registry',
                openapi: 'https://api.helixa.xyz/api/v2/openapi.json',
            },
        },
        capabilities: ['agent-search', 'cred-scoring', 'identity-verification', 'agent-profiles', 'cross-registration', 'principal-matching', 'brief-routing', 'synagent-handoff'],
        chain: { name: 'Base', chainId: 8453, contract: V2_CONTRACT_ADDRESS },
    });
});

// ─── DID Document Resolution ────────────────────────────────────

// Platform-level DID document
app.get('/.well-known/did.json', (req, res) => {
    res.json({
        '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/security/suites/jws-2020/v1'],
        id: 'did:web:api.helixa.xyz',
        verificationMethod: [{
            id: 'did:web:api.helixa.xyz#deployer',
            type: 'EcdsaSecp256k1RecoveryMethod2020',
            controller: 'did:web:api.helixa.xyz',
            blockchainAccountId: `eip155:8453:${process.env.DEPLOYER_ADDRESS || '0x339559A2d1CD15059365FC7bD36b3047BbA480E0'}`,
        }],
        service: [
            {
                id: 'did:web:api.helixa.xyz#api',
                type: 'CredScoreService',
                serviceEndpoint: 'https://api.helixa.xyz/api/v2',
            },
            {
                id: 'did:web:api.helixa.xyz#registry',
                type: 'ERC8004Registry',
                serviceEndpoint: `eip155:8453:${V2_CONTRACT_ADDRESS}`,
            },
            {
                id: 'did:web:api.helixa.xyz#mcp',
                type: 'MCPServer',
                serviceEndpoint: 'https://api.helixa.xyz/api/mcp',
            },
            {
                id: 'did:web:api.helixa.xyz#a2a',
                type: 'A2AProtocol',
                serviceEndpoint: 'https://api.helixa.xyz/api/a2a',
            },
        ],
        authentication: ['did:web:api.helixa.xyz#deployer'],
        assertionMethod: ['did:web:api.helixa.xyz#deployer'],
    });
});

// Per-agent DID resolution: did:web:api.helixa.xyz:agent:<tokenId>
app.get('/agent/:tokenId/did.json', async (req, res) => {
    try {
        const tokenId = parseInt(req.params.tokenId);
        if (isNaN(tokenId)) return res.status(400).json({ error: 'Invalid tokenId' });

        // Fetch agent from indexer
        const allAgents = indexer.getAllAgents();
        const agent = allAgents.find(a => a.tokenId === tokenId || a.token_id === tokenId);
        if (!agent) return res.status(404).json({ error: 'Agent not found' });

        const agentAddress = agent.agentAddress || agent.agent_address;
        const didId = `did:web:api.helixa.xyz:agent:${tokenId}`;

        const didDoc = {
            '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/security/suites/jws-2020/v1'],
            id: didId,
            controller: 'did:web:api.helixa.xyz',
            verificationMethod: [{
                id: `${didId}#agent`,
                type: 'EcdsaSecp256k1RecoveryMethod2020',
                controller: didId,
                blockchainAccountId: `eip155:8453:${agentAddress}`,
            }],
            service: [
                {
                    id: `${didId}#profile`,
                    type: 'AgentProfile',
                    serviceEndpoint: `https://api.helixa.xyz/api/v2/agent/${tokenId}`,
                },
                {
                    id: `${didId}#cred`,
                    type: 'CredScore',
                    serviceEndpoint: `https://api.helixa.xyz/api/v2/agent/${tokenId}/cred`,
                },
                {
                    id: `${didId}#identity`,
                    type: 'ERC8004Identity',
                    serviceEndpoint: `eip155:8453:${V2_CONTRACT_ADDRESS}:${tokenId}`,
                },
            ],
            authentication: [`${didId}#agent`],
            assertionMethod: [`${didId}#agent`],
        };

        // Add name if available
        if (agent.name) {
            didDoc.alsoKnownAs = [`https://helixa.xyz/agent/${tokenId}`, agent.name];
        }

        res.json(didDoc);
    } catch (err) {
        console.error('DID resolution error:', err);
        res.status(500).json({ error: 'DID resolution failed' });
    }
});

// ─── API Documentation Page ─────────────────────────────────────
const { getDocsHTML } = require('./docs-page');
// Static video/media hosting
// Serve frontend preview (until git push is fixed)
const previewDocsPath = path.resolve(__dirname, '..', 'docs');
const previewIndexFile = path.join(previewDocsPath, 'index.html');
app.use('/preview', express.static(previewDocsPath, { maxAge: 0, fallthrough: true }));
app.use('/preview', (req, res) => {
    res.set('Cache-Control', 'no-cache');
    const html = fs.readFileSync(previewIndexFile, 'utf8')
        .replace(/"\/(assets\/)/g, '"/preview/$1')
        .replace(/"\/helixa-logo\.png/g, '"/preview/helixa-logo.png');
    res.type('html').send(html);
});

app.use('/reports', express.static(path.join(__dirname, 'public', 'reports'), {
    maxAge: '1h',
}));

app.get('/trust-graph', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'trust-graph.html'));
});

app.get('/trust-graph-v2', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'trust-graph-v2.html'));
});

app.use('/video', express.static(path.join(__dirname, 'public', 'video'), {
    maxAge: '7d',
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.mp4')) res.set('Content-Type', 'video/mp4');
    },
}));

// ─── Evaluator API (ERC-8183) ───────────────────────────────────
const EVALUATOR_ADDRESS = '0xF6F5De45eDB8751fc974A17d55339fe6dda8CC42';
const EVALUATOR_ABI = [
    'function isEligibleProvider(address provider) external view returns (bool)',
    'function isEligibleForBudget(address provider, uint256 budget) external view returns (bool)',
    'function getThresholdForBudget(uint256 budget) external view returns (uint256)',
    'function getEffectiveThreshold(address jobContract, uint256 jobId, uint256 budget) external view returns (uint256)',
    'function getAgentRecord(uint256 tokenId) external view returns (uint256 completions, uint256 rejections, uint256 totalEarned, uint256 lastJobTimestamp, uint256 successRate)',
    'function getWalletRecord(address wallet) external view returns (uint256 completions, uint256 rejections, uint256 totalEarned, uint256 successRate)',
    'function walletToAgent(address wallet) external view returns (uint256)',
    'function autoCompleteThreshold() external view returns (uint256)',
    'function providerMinCred() external view returns (uint256)',
    'function getTiersCount() external view returns (uint256)',
    'function tiers(uint256 index) external view returns (uint256 maxBudget, uint256 minCred)',
];

function getEvaluatorContract() {
    const p = readProvider || provider;
    return new ethers.Contract(EVALUATOR_ADDRESS, EVALUATOR_ABI, p);
}

app.get('/api/v2/evaluator', async (req, res) => {
    try {
        const ev = getEvaluatorContract();
        const [autoComplete, providerMin, tiersCount] = await Promise.all([
            ev.autoCompleteThreshold(),
            ev.providerMinCred(),
            ev.getTiersCount(),
        ]);
        const tiers = [];
        for (let i = 0; i < Number(tiersCount); i++) {
            const t = await ev.tiers(i);
            tiers.push({ maxBudget: t.maxBudget.toString(), minCred: t.minCred.toString() });
        }
        res.json({
            contract: EVALUATOR_ADDRESS,
            chain: 'base',
            chainId: 8453,
            autoCompleteThreshold: autoComplete.toString(),
            providerMinCred: providerMin.toString(),
            tiers,
            endpoints: {
                eligible: '/api/v2/evaluator/eligible/:wallet',
                eligibleForBudget: '/api/v2/evaluator/eligible/:wallet/:budget',
                threshold: '/api/v2/evaluator/threshold/:budget',
                record: '/api/v2/evaluator/record/:tokenId',
                walletRecord: '/api/v2/evaluator/record/wallet/:wallet',
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to read evaluator', detail: err.message });
    }
});

app.get('/api/v2/evaluator/eligible/:wallet', async (req, res) => {
    try {
        const ev = getEvaluatorContract();
        const eligible = await ev.isEligibleProvider(req.params.wallet);
        const linkedAgent = await ev.walletToAgent(req.params.wallet);
        res.json({ wallet: req.params.wallet, eligible, linkedAgent: linkedAgent.toString() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/v2/evaluator/eligible/:wallet/:budget', async (req, res) => {
    try {
        const ev = getEvaluatorContract();
        const eligible = await ev.isEligibleForBudget(req.params.wallet, req.params.budget);
        const threshold = await ev.getThresholdForBudget(req.params.budget);
        res.json({
            wallet: req.params.wallet,
            budget: req.params.budget,
            eligible,
            requiredCred: threshold.toString(),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/v2/evaluator/threshold/:budget', async (req, res) => {
    try {
        const ev = getEvaluatorContract();
        const threshold = await ev.getThresholdForBudget(req.params.budget);
        res.json({ budget: req.params.budget, requiredCred: threshold.toString() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/v2/evaluator/record/:tokenId', async (req, res) => {
    try {
        const ev = getEvaluatorContract();
        const r = await ev.getAgentRecord(req.params.tokenId);
        res.json({
            tokenId: req.params.tokenId,
            completions: r.completions.toString(),
            rejections: r.rejections.toString(),
            totalEarned: r.totalEarned.toString(),
            lastJobTimestamp: r.lastJobTimestamp.toString(),
            successRate: r.successRate.toString(),
            successRatePercent: (Number(r.successRate) / 100).toFixed(2) + '%',
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/v2/evaluator/record/wallet/:wallet', async (req, res) => {
    try {
        const ev = getEvaluatorContract();
        const r = await ev.getWalletRecord(req.params.wallet);
        const linkedAgent = await ev.walletToAgent(req.params.wallet);
        res.json({
            wallet: req.params.wallet,
            linkedAgent: linkedAgent.toString(),
            completions: r.completions.toString(),
            rejections: r.rejections.toString(),
            totalEarned: r.totalEarned.toString(),
            successRate: r.successRate.toString(),
            successRatePercent: (Number(r.successRate) / 100).toFixed(2) + '%',
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Trust Evaluation Pipeline (Cred + 8183 + Handshake) ────────
// One call: evaluate an agent's trustworthiness and optionally initiate a handshake
app.post('/api/v2/trust/evaluate', requireSIWA, async (req, res) => {
    try {
        const caller = req.agent.address;
        const { targetAgentId, budget, autoHandshake } = req.body;
        
        if (!targetAgentId) return res.status(400).json({ error: 'targetAgentId required' });
        
        // 1. Get target agent data + cred score + 8004 reputation
        let targetAgent;
        try { targetAgent = await formatAgentV2(parseInt(targetAgentId)); }
        catch { return res.status(404).json({ error: `Agent #${targetAgentId} not found` }); }
        
        const credScore = targetAgent.credScore || 0;
        const credTier = targetAgent.credTier || 'JUNK';
        
        // Fetch ERC-8004 Reputation Registry feedback
        let reputation8004 = null;
        try {
            const { getAgentFeedback, calculateReputationBonus } = require('./services/reputation-8004');
            const feedback = await getAgentFeedback(parseInt(targetAgentId));
            if (feedback.feedbackCount > 0) {
                reputation8004 = {
                    feedbackCount: feedback.feedbackCount,
                    avgScore: feedback.avgScore,
                    uniqueClients: feedback.clients,
                    tags: feedback.tags,
                    reputationBonus: calculateReputationBonus(feedback),
                    source: 'ERC-8004 Reputation Registry (Base)',
                    registry: '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63',
                };
            }
        } catch (e) {
            console.warn('[TRUST EVAL] 8004 reputation fetch failed:', e.message);
        }
        
        // 2. Check 8183 evaluator eligibility
        let evaluatorResult = { eligible: false, maxBudget: 0 };
        try {
            const ev = getEvaluatorContract();
            const targetWallet = targetAgent.agentWallet || targetAgent.owner;
            if (targetWallet) {
                const isEligible = await ev.isEligibleProvider(targetWallet);
                evaluatorResult.eligible = isEligible;
                evaluatorResult.wallet = targetWallet;
                
                // Check budget tiers
                const budgets = [100, 1000, 10000];
                for (const b of budgets) {
                    try {
                        const ok = await ev.isEligibleForBudget(targetWallet, b);
                        if (ok) evaluatorResult.maxBudget = b;
                    } catch {}
                }
                
                // Get track record
                try {
                    const linkedAgent = await ev.walletToAgent(targetWallet);
                    if (linkedAgent.toString() !== '0') {
                        const record = await ev.getAgentRecord(linkedAgent);
                        evaluatorResult.record = {
                            completions: record.completions.toString(),
                            rejections: record.rejections.toString(),
                            successRate: (Number(record.successRate) / 100).toFixed(2) + '%',
                            totalEarned: record.totalEarned.toString(),
                        };
                    }
                } catch {}
            }
        } catch (e) {
            evaluatorResult.error = e.message;
        }
        
        // 3. Check if budget is within eligible range
        let budgetEligible = true;
        if (budget && evaluatorResult.maxBudget < parseInt(budget)) {
            budgetEligible = false;
        }
        
        // 4. Check existing handshake status
        const sdb = getSoulDb();
        let handshakeStatus = 'none';
        let existingHandshake = null;
        
        // Find caller's agent ID (check agents DB and soul_vault for updated wallets)
        const Database = require('better-sqlite3');
        const agentsDb = new Database(require('path').join(__dirname, '..', 'data', 'agents.db'), { readonly: true });
        let callerAgent = agentsDb.prepare('SELECT tokenId FROM agents WHERE lower(owner) = ? OR lower(agentAddress) = ? LIMIT 1')
            .get(caller.toLowerCase(), caller.toLowerCase());
        agentsDb.close();
        
        // Also check soul_vault for agent wallets set via EIP-712
        if (!callerAgent) {
            const svRows = sdb.prepare("SELECT tokenId FROM soul_vault WHERE lower(sovereignWallet) = ?").all(caller.toLowerCase());
            if (svRows.length > 0) callerAgent = { tokenId: svRows[0].tokenId };
        }
        // Fallback: check onchain agentWallet mapping (for wallets set via setAgentWallet)
        if (!callerAgent) {
            try {
                const contract = getHelixaContract();
                // Try tokens 1-100 is too slow. Check if caller has SIWA agent set
                // For now, allow passing callerTokenId in the request body
            } catch {}
        }
        // Allow explicit callerTokenId if agent wallet doesn't match DB
        if (!callerAgent && req.body.callerTokenId) {
            callerAgent = { tokenId: req.body.callerTokenId };
        }
        const callerTokenId = callerAgent?.tokenId ? parseInt(callerAgent.tokenId) : null;
        
        if (callerTokenId) {
            const existing = sdb.prepare(
                "SELECT id, status, reciprocated FROM soul_handshakes WHERE (fromTokenId = ? AND toTokenId = ?) OR (fromTokenId = ? AND toTokenId = ?) ORDER BY createdAt DESC LIMIT 1"
            ).get(callerTokenId, parseInt(targetAgentId), parseInt(targetAgentId), callerTokenId);
            
            if (existing) {
                handshakeStatus = existing.status;
                existingHandshake = { id: existing.id, reciprocated: !!existing.reciprocated };
            }
        }
        
        // 5. Build recommendation
        let recommendation = 'proceed';
        let reasons = [];
        
        if (credScore < 10) { recommendation = 'avoid'; reasons.push('Cred score too low (Junk tier)'); }
        else if (credScore < 26) { recommendation = 'caution'; reasons.push('Marginal cred score - limited track record'); }
        else if (credScore >= 50) { reasons.push('Strong cred score (' + credTier + ' tier)'); }
        else { reasons.push('Acceptable cred score (' + credTier + ' tier)'); }
        
        if (!evaluatorResult.eligible) { 
            if (recommendation === 'proceed') recommendation = 'caution';
            reasons.push('Not eligible as 8183 evaluator provider'); 
        }
        if (!budgetEligible) { recommendation = 'caution'; reasons.push(`Budget $${budget} exceeds eligible max $${evaluatorResult.maxBudget}`); }
        if (handshakeStatus === 'accepted') { reasons.push('Existing trust handshake in place'); }
        if (reputation8004) {
            reasons.push(`${reputation8004.feedbackCount} feedback signals on ERC-8004 Reputation Registry (avg: ${reputation8004.avgScore})`);
            if (reputation8004.uniqueClients >= 3) reasons.push('Multiple independent reputation sources');
        } else {
            reasons.push('No feedback found on ERC-8004 Reputation Registry');
        }
        
        // 6. Auto-initiate handshake if requested and recommended
        let handshakeInitiated = false;
        if (autoHandshake && callerTokenId && recommendation !== 'avoid' && handshakeStatus !== 'accepted') {
            try {
                const defaultFields = ['values', 'mission', 'capabilities'];
                const now = Date.now();
                const expiresAt = now + 7 * 24 * 60 * 60 * 1000;
                
                // Get caller's soul data
                const vault = sdb.prepare('SELECT sharedSoul, publicSoul FROM soul_vault WHERE tokenId = ?').get(callerTokenId);
                const soulSource = vault?.sharedSoul ? JSON.parse(vault.sharedSoul) : (vault?.publicSoul ? JSON.parse(vault.publicSoul) : {});
                const fragment = {};
                for (const f of defaultFields) { if (soulSource[f] !== undefined) fragment[f] = soulSource[f]; }
                
                sdb.prepare(`
                    INSERT INTO soul_handshakes (fromTokenId, toTokenId, fromWallet, fields, soulFragment, status, createdAt, updatedAt, expiresAt)
                    VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)
                    ON CONFLICT(fromTokenId, toTokenId) DO UPDATE SET
                        fields = excluded.fields, soulFragment = excluded.soulFragment,
                        status = 'pending', updatedAt = excluded.updatedAt, expiresAt = excluded.expiresAt
                `).run(callerTokenId, parseInt(targetAgentId), caller, JSON.stringify(defaultFields), JSON.stringify(fragment), now, now, expiresAt);
                
                handshakeInitiated = true;
                handshakeStatus = 'pending';
                console.log(`[TRUST EVAL] Auto-handshake: #${callerTokenId} → #${targetAgentId}`);
            } catch (e) {
                console.warn(`[TRUST EVAL] Auto-handshake failed:`, e.message);
            }
        }
        
        sdb.close();
        
        // 7. Generate LLM trust assessment via Bankr Router (smart model selection)
        let llmAssessment = null;
        try {
            const bankrLlmKey = process.env.BANKR_LLM_KEY || process.env.BANKR_API_KEY;

            if (bankrLlmKey) {
                const assessmentPrompt = `You are a trust assessment engine for AI agents. Given the following data, provide a concise 2-3 sentence trust assessment and a recommended max transaction value in USD.

Agent: ${targetAgent.name || 'Unknown'} (#${targetAgentId})
Cred Score: ${credScore}/100 (${credTier} tier)
Soul Locked: ${!!targetAgent.soulLocked || !!targetAgent.soulVersion ? 'Yes' : 'No'}
Handshake Status: ${handshakeStatus}
Evaluator Eligible: ${evaluatorResult.eligible}
${evaluatorResult.record ? `Track Record: ${evaluatorResult.record.completions} completions, ${evaluatorResult.record.successRate} success rate` : ''}
${budget ? `Requested Budget: $${budget}` : ''}

Respond in JSON: {"assessment": "...", "maxRecommendedValue": number, "confidence": "high"|"medium"|"low"}`;

                const bankrRouter = require('./services/bankr-router');
                const llmResult = await bankrRouter.route({
                    messages: [{ role: 'user', content: assessmentPrompt }],
                    mode: 'auto',
                    maxTokens: 200,
                    apiKey: bankrLlmKey,
                });

                // Normalize response format (router handles both OpenAI and Anthropic formats)
                const llmResp = { ok: true };
                const llmData = llmResult;

                if (llmResp.ok) {
                    // Router returns parsed JSON directly; handle both OpenAI and Anthropic formats
                    const msg = llmData.choices?.[0]?.message || llmData.content?.[0];
                    const content = msg?.content || msg?.text || msg?.reasoning || '';

                    if (content) {
                        // Try to extract JSON from content/reasoning
                        const jsonMatch = content.match(/\{[\s\S]*"assessment"[\s\S]*\}/);
                        if (jsonMatch) {
                            try { llmAssessment = JSON.parse(jsonMatch[0]); } catch {}
                        }
                        if (!llmAssessment) llmAssessment = { assessment: content.replace(/\*\*.*?\*\*/g, '').trim().slice(0, 500) };
                    }
                }
            }
        } catch (e) {
            console.warn('[TRUST EVAL] Bankr LLM assessment skipped:', e.message);
        }
        
        // 8. Return unified result
        res.json({
            target: {
                tokenId: parseInt(targetAgentId),
                name: targetAgent.name,
                credScore,
                credTier,
                soulLocked: !!targetAgent.soulLocked || !!targetAgent.soulVersion,
            },
            evaluator: evaluatorResult,
            handshake: {
                status: handshakeStatus,
                existing: existingHandshake,
                initiated: handshakeInitiated,
            },
            ...(reputation8004 && { reputation8004 }),
            recommendation,
            reasons,
            ...(llmAssessment && { llmAssessment }),
            poweredBy: llmAssessment ? 'bankr-llm-gateway' : undefined,
            timestamp: Date.now(),
        });
        
    } catch (e) {
        console.error(`[TRUST EVAL] Error:`, e.message);
        res.status(500).json({ error: e.message });
    }
});

// ─── ERC-8004 Reputation Registry API ────────────────────────────

// Get 8004 Reputation Registry feedback for any agentId (public, no auth needed)
app.get('/api/v2/reputation/8004/:agentId', async (req, res) => {
    try {
        const { getAgentFeedback, calculateReputationBonus, REPUTATION_REGISTRY } = require('./services/reputation-8004');
        const agentId = parseInt(req.params.agentId);
        if (isNaN(agentId)) return res.status(400).json({ error: 'Invalid agentId' });

        const feedback = await getAgentFeedback(agentId);
        res.json({
            agentId,
            registry: REPUTATION_REGISTRY,
            chain: 'base',
            feedbackCount: feedback.feedbackCount,
            avgScore: feedback.avgScore,
            uniqueClients: feedback.clients,
            tags: feedback.tags,
            reputationBonus: calculateReputationBonus(feedback),
            scores: feedback.scores?.slice(0, 20), // Last 20 feedback entries
            note: 'Data from the official ERC-8004 Reputation Registry on Base. Scores aggregated by Helixa.',
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Scan recent 8004 reputation activity (public, no auth)
app.get('/api/v2/reputation/8004/scan/recent', async (req, res) => {
    try {
        const { scanRecentFeedback } = require('./services/reputation-8004');
        const feedbackMap = await scanRecentFeedback();
        const results = [];
        for (const [agentId, data] of feedbackMap) {
            results.push({ agentId: parseInt(agentId), ...data, clients: data.clients });
        }
        results.sort((a, b) => b.count - a.count);
        res.json({
            totalAgentsWithFeedback: results.length,
            totalFeedbackEvents: results.reduce((s, r) => s + r.count, 0),
            agents: results.slice(0, 50), // Top 50 by feedback count
            source: 'ERC-8004 Reputation Registry (Base)',
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── Job Aggregator API ─────────────────────────────────────────
const jobAggregator = require('./job-aggregator');

app.get('/api/v2/jobs', async (req, res) => {
    try {
        const result = await jobAggregator.getAllJobs(req.query.q || req.query.query);
        // Filter by source if requested
        if (req.query.source) {
            result.jobs = result.jobs.filter(j => j.source === req.query.source);
            result.total = result.jobs.length;
        }
        // Filter by min/max budget
        if (req.query.minBudget) {
            result.jobs = result.jobs.filter(j => j.budget >= parseFloat(req.query.minBudget));
        }
        if (req.query.maxBudget) {
            result.jobs = result.jobs.filter(j => j.budget <= parseFloat(req.query.maxBudget));
        }
        // Filter by tag
        if (req.query.tag) {
            result.jobs = result.jobs.filter(j => j.tags.includes(req.query.tag));
        }
        result.total = result.jobs.length;
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Job aggregation failed', detail: err.message });
    }
});

app.get('/api/v2/jobs/search', async (req, res) => {
    try {
        const query = req.query.q || 'agent services';
        const result = await jobAggregator.getAllJobs(query);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Job search failed', detail: err.message });
    }
});

app.get('/docs', (req, res) => {
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(getDocsHTML());
});

// ─── Trust Graph ────────────────────────────────────────────────
app.get('/api/v2/trust-graph', (req, res) => {
    try {
        const sdb = getSoulDb();
        const rows = sdb.prepare("SELECT fromTokenId, toTokenId, reciprocated, createdAt FROM soul_handshakes WHERE status = 'accepted'").all();
        sdb.close();

        // Build deduplicated edges
        const edgeMap = new Map();
        for (const r of rows) {
            const key = [Math.min(r.fromTokenId, r.toTokenId), Math.max(r.fromTokenId, r.toTokenId)].join('-');
            const existing = edgeMap.get(key);
            if (existing) {
                existing.reciprocated = true;
            } else {
                edgeMap.set(key, {
                    from: r.fromTokenId,
                    to: r.toTokenId,
                    reciprocated: !!r.reciprocated,
                    createdAt: r.createdAt
                });
            }
        }
        const edges = [...edgeMap.values()];

        // Collect unique node IDs
        const nodeIds = new Set();
        for (const e of edges) { nodeIds.add(e.from); nodeIds.add(e.to); }

        // Get names from indexer
        const allAgents = indexer.getAllAgents();
        const nameMap = new Map(allAgents.map(a => [a.tokenId, a.name]));

        const nodes = [...nodeIds].map(id => ({
            id,
            name: nameMap.get(id) || `Agent #${id}`
        }));

        res.json({ nodes, edges });
    } catch (e) {
        console.error('[TRUST GRAPH]', e.message);
        res.status(500).json({ error: e.message });
    }
});

// ─── Agent Cards ────────────────────────────────────────────────

// Init agent_socials table
(() => {
    try {
        const sdb = getSoulDb();
        sdb.exec(`CREATE TABLE IF NOT EXISTS agent_socials (
            tokenId INTEGER PRIMARY KEY,
            x TEXT,
            github TEXT,
            website TEXT,
            telegram TEXT,
            email TEXT,
            updatedAt INTEGER
        )`);
        sdb.close();
    } catch (e) {
        console.error('[AGENT CARDS] Failed to init agent_socials table:', e.message);
    }
})();

// GET /api/v2/agent/:id/card — Public agent card data
app.get('/api/v2/agent/:id/card', async (req, res) => {
    try {
        const tokenId = parseInt(req.params.id);
        const agent = await formatAgentV2(tokenId);

        // Soul lock status
        let soulLocked = false, soulVersion = 0;
        try {
            const sdb = getSoulDb();
            const vault = sdb.prepare('SELECT soulHash, soulSovereign FROM soul_vault WHERE tokenId = ?').get(tokenId);
            sdb.close();
            if (vault && vault.soulHash) {
                soulLocked = true;
                soulVersion = vault.soulSovereign || 1;
            }
        } catch {}

        // Handshake count
        let handshakeCount = 0;
        try {
            const sdb = getSoulDb();
            const row = sdb.prepare("SELECT COUNT(*) as cnt FROM soul_handshakes WHERE (fromTokenId = ? OR toTokenId = ?) AND status = 'accepted'").get(tokenId, tokenId);
            sdb.close();
            handshakeCount = row?.cnt || 0;
        } catch {}

        // Socials
        const socials = getAgentSocials(tokenId);

        // Capabilities from traits
        const capabilities = (agent.traits || [])
            .map(t => typeof t === 'string' ? t : t.name)
            .filter(n => !n.startsWith('linked-token') && !n.startsWith('social-'))
            .slice(0, 10);

        res.json({
            tokenId: agent.tokenId,
            name: agent.name,
            framework: agent.framework,
            credScore: agent.credScore,
            soulLocked,
            soulVersion,
            handshakeCount,
            socials,
            capabilities,
            registeredAt: agent.registeredAt,
            cardUrl: `https://helixa.xyz/card/${agent.tokenId}`,
        });
    } catch (e) {
        res.status(404).json({ error: 'Agent not found', detail: e.message });
    }
});

// PUT /api/v2/agent/:id/card/socials — Update social links (authenticated)
app.put('/api/v2/agent/:id/card/socials', requireSIWA, async (req, res) => {
    try {
        const tokenId = parseInt(req.params.id);
        const agent = await formatAgentV2(tokenId);
        const caller = req.agent.address;
        if (caller.toLowerCase() !== agent.owner.toLowerCase()) {
            return res.status(403).json({ error: 'Not the owner of this agent' });
        }

        const { x, github, website, telegram, email } = req.body;
        const sdb = getSoulDb();
        sdb.prepare(`INSERT OR REPLACE INTO agent_socials (tokenId, x, github, website, telegram, email, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?)`).run(tokenId, x || null, github || null, website || null, telegram || null, email || null, Date.now());
        sdb.close();

        res.json({ success: true, socials: { x, github, website, telegram, email } });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/v2/agent/:id/card/image — SVG card image
app.get('/api/v2/agent/:id/card/image', async (req, res) => {
    try {
        const tokenId = parseInt(req.params.id);
        const agent = await formatAgentV2(tokenId);

        let soulLocked = false, handshakeCount = 0;
        try {
            const sdb = getSoulDb();
            const vault = sdb.prepare('SELECT soulHash FROM soul_vault WHERE tokenId = ?').get(tokenId);
            const hc = sdb.prepare("SELECT COUNT(*) as cnt FROM soul_handshakes WHERE (fromTokenId = ? OR toTokenId = ?) AND status = 'accepted'").get(tokenId, tokenId);
            sdb.close();
            soulLocked = !!(vault && vault.soulHash);
            handshakeCount = hc?.cnt || 0;
        } catch {}

        const tier = agent.credScore >= 91 ? 'Legendary' : agent.credScore >= 76 ? 'Prime' : agent.credScore >= 51 ? 'Qualified' : agent.credScore >= 26 ? 'Marginal' : 'Unrated';
        const tierColor = agent.credScore >= 91 ? '#f59e0b' : agent.credScore >= 76 ? '#a855f7' : agent.credScore >= 51 ? '#06b6d4' : agent.credScore >= 26 ? '#6b7280' : '#374151';
        const soulStatus = soulLocked ? '🔒 Soul Locked' : '🔓 Unlocked';
        const escapedName = (agent.name || `Agent #${tokenId}`).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0a0812"/>
      <stop offset="100%" style="stop-color:#1a0a2e"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#a855f7"/>
      <stop offset="100%" style="stop-color:#06b6d4"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="40" y="40" width="1120" height="550" rx="24" fill="rgba(255,255,255,0.03)" stroke="url(#accent)" stroke-width="2"/>
  <text x="100" y="140" font-family="system-ui,sans-serif" font-size="56" font-weight="bold" fill="white">${escapedName}</text>
  <text x="100" y="190" font-family="system-ui,sans-serif" font-size="24" fill="#a78bfa">${agent.framework || 'unknown'} · #${tokenId}</text>
  <rect x="100" y="230" width="200" height="80" rx="16" fill="rgba(168,85,247,0.15)" stroke="${tierColor}" stroke-width="2"/>
  <text x="200" y="265" font-family="system-ui,sans-serif" font-size="16" fill="${tierColor}" text-anchor="middle">CRED SCORE</text>
  <text x="200" y="298" font-family="system-ui,sans-serif" font-size="36" font-weight="bold" fill="${tierColor}" text-anchor="middle">${agent.credScore}</text>
  <rect x="340" y="230" width="200" height="80" rx="16" fill="rgba(6,182,212,0.15)" stroke="#06b6d4" stroke-width="2"/>
  <text x="440" y="265" font-family="system-ui,sans-serif" font-size="16" fill="#06b6d4" text-anchor="middle">HANDSHAKES</text>
  <text x="440" y="298" font-family="system-ui,sans-serif" font-size="36" font-weight="bold" fill="#06b6d4" text-anchor="middle">${handshakeCount}</text>
  <text x="100" y="370" font-family="system-ui,sans-serif" font-size="22" fill="#94a3b8">${soulStatus}</text>
  <text x="100" y="410" font-family="system-ui,sans-serif" font-size="18" fill="#64748b">${tier} Tier</text>
  <text x="100" y="540" font-family="system-ui,sans-serif" font-size="20" fill="#475569">helixa.xyz/card/${tokenId}</text>
  <text x="1060" y="540" font-family="system-ui,sans-serif" font-size="28" font-weight="bold" fill="url(#accent)" text-anchor="end">HELIXA</text>
</svg>`;

        res.set('Content-Type', 'image/svg+xml');
        res.set('Cache-Control', 'public, max-age=300');
        res.send(svg);
    } catch (e) {
        res.status(404).json({ error: 'Agent not found', detail: e.message });
    }
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
        console.log(`   Payments: x402 (Phase 1 — all free)`);
        console.log(`   RPC: ${RPC_URL}`);
        console.log(`   8004 Registry: ${ERC8004_REGISTRY} (cross-reg enabled)`);
        console.log(`   Deployer: ${wallet ? wallet.address : 'READ-ONLY (no key)'}\n`);
        // Start $CRED oracle after server is listening (non-blocking)
        try { credOracle.startBackgroundRefresh(); } catch (e) { console.warn('[CRED ORACLE] Start failed:', e.message); }
    });
})();
