/**
 * SIWS (Sign-In With Solana) Authentication Middleware
 * 
 * Solana equivalent of SIWA - agents prove ownership of their Solana wallet
 * via Ed25519 message signing. Used for Solana-native agents registered
 * on Helixa via cross-chain bridge.
 * 
 * Auth flow:
 *   1. GET /api/v2/auth/solana/challenge?address=<base58pubkey>
 *   2. Agent signs the challenge message with their Solana private key
 *   3. Agent sends: Authorization: Bearer solana:<address>:<timestamp>:<signature_hex>
 *   4. We verify via Ed25519 and resolve their Helixa token ID
 */

const nacl = require('tweetnacl');
const { PublicKey } = require('@solana/web3.js');
const bs58raw = require('bs58');
const bs58 = bs58raw.default || bs58raw;

const SIWS_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const SIWS_DOMAIN = 'api.helixa.xyz';

// Pending challenges (address -> { nonce, createdAt })
const pendingChallenges = new Map();

// Cleanup old challenges every 5 minutes
setInterval(() => {
    const cutoff = Date.now() - SIWS_EXPIRY_MS;
    for (const [addr, ch] of pendingChallenges) {
        if (ch.createdAt < cutoff) pendingChallenges.delete(addr);
    }
}, 5 * 60 * 1000);

/**
 * Build the message to sign
 */
function buildSIWSMessage(address, timestamp) {
    return `Sign-In With Solana Agent: ${SIWS_DOMAIN} wants you to sign in with your wallet ${address} at ${timestamp}`;
}

/**
 * Verify a Solana Ed25519 signature
 */
function verifySolanaSignature(address, timestamp, signatureHex) {
    try {
        const message = buildSIWSMessage(address, timestamp);
        const messageBytes = new TextEncoder().encode(message);

        // Decode the public key from base58
        const pubkeyObj = new PublicKey(address);
        const pubkeyBytes = pubkeyObj.toBytes();

        // Decode signature from hex
        const signatureBytes = Buffer.from(signatureHex, 'hex');
        if (signatureBytes.length !== 64) return false;

        // Verify Ed25519 signature
        const valid = nacl.sign.detached.verify(messageBytes, signatureBytes, pubkeyBytes);
        if (!valid) return false;

        // Check timestamp expiry
        let ts = parseInt(timestamp);
        if (isNaN(ts)) return false;
        if (ts < 1e12) ts = ts * 1000;
        if (Date.now() - ts > SIWS_EXPIRY_MS) return false;

        return true;
    } catch {
        return false;
    }
}

/**
 * Parse SIWS auth header
 * Format: Bearer solana:<base58address>:<timestamp>:<signature_hex>
 */
function parseSIWS(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer solana:')) return null;
    const token = authHeader.slice('Bearer solana:'.length);
    const parts = token.split(':');
    if (parts.length < 3) return null;
    return {
        address: parts[0],
        timestamp: parts[1],
        signature: parts.slice(2).join(':'),
    };
}

/**
 * Middleware: require SIWS authentication
 * Sets req.agent = { solanaAddress, evmAddress, tokenId } on success
 */
function requireSIWS(solanaLookupFn) {
    return (req, res, next) => {
        const parsed = parseSIWS(req.headers.authorization);
        if (!parsed) {
            return res.status(401).json({
                error: 'SIWS authentication required',
                hint: 'Set Authorization: Bearer solana:<address>:<timestamp>:<signature_hex>',
                message_format: `Sign-In With Solana Agent: ${SIWS_DOMAIN} wants you to sign in with your wallet {address} at {timestamp}`,
                challenge_endpoint: '/api/v2/auth/solana/challenge?address=YOUR_SOLANA_ADDRESS',
            });
        }
        if (!verifySolanaSignature(parsed.address, parsed.timestamp, parsed.signature)) {
            return res.status(401).json({ error: 'Invalid or expired SIWS token' });
        }

        // Look up the Solana address in our registry to find their Helixa token
        const registration = solanaLookupFn(parsed.address);
        if (!registration) {
            return res.status(404).json({
                error: 'Solana address not registered on Helixa',
                hint: 'Register first via POST /api/v2/register/solana',
            });
        }

        req.agent = {
            address: registration.evmAddress,
            solanaAddress: parsed.address,
            tokenId: registration.tokenId,
            timestamp: parseInt(parsed.timestamp),
            authType: 'siws',
        };
        next();
    };
}

/**
 * Combined middleware: accepts either SIWA or SIWS
 * Tries SIWA first (Bearer <evm>), then SIWS (Bearer solana:<sol>)
 */
function requireAuth(solanaLookupFn) {
    const { parseSIWA, verifySIWA } = require('./auth');
    const siwsMiddleware = requireSIWS(solanaLookupFn);

    return (req, res, next) => {
        const authHeader = req.headers.authorization || '';

        // Try SIWA first
        if (authHeader.startsWith('Bearer ') && !authHeader.startsWith('Bearer solana:')) {
            const parsed = parseSIWA(authHeader);
            if (parsed && verifySIWA(parsed.address, parsed.timestamp, parsed.signature)) {
                const { ethers } = require('ethers');
                req.agent = {
                    address: ethers.getAddress(parsed.address),
                    timestamp: parseInt(parsed.timestamp),
                    authType: 'siwa',
                };
                return next();
            }
        }

        // Try SIWS
        if (authHeader.startsWith('Bearer solana:')) {
            return siwsMiddleware(req, res, next);
        }

        // Neither worked
        return res.status(401).json({
            error: 'Authentication required (SIWA or SIWS)',
            siwa: {
                hint: 'Bearer <address>:<timestamp>:<signature>',
                message_format: `Sign-In With Agent: ${SIWS_DOMAIN} wants you to sign in with your wallet {address} at {timestamp}`,
            },
            siws: {
                hint: 'Bearer solana:<address>:<timestamp>:<signature_hex>',
                message_format: `Sign-In With Solana Agent: ${SIWS_DOMAIN} wants you to sign in with your wallet {address} at {timestamp}`,
                challenge_endpoint: '/api/v2/auth/solana/challenge?address=YOUR_SOLANA_ADDRESS',
            },
        });
    };
}

module.exports = {
    buildSIWSMessage,
    verifySolanaSignature,
    parseSIWS,
    requireSIWS,
    requireAuth,
    pendingChallenges,
    SIWS_DOMAIN,
    SIWS_EXPIRY_MS,
};
