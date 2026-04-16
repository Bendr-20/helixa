/**
 * Wallet auth middleware.
 *
 * - SIWA = Sign-In With Agent, for agent auth
 * - SIWE = Sign-In With Ethereum, for human wallet auth
 */

const { ethers } = require('ethers');

const SIWA_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const SIWA_DOMAIN = 'api.helixa.xyz';
const SIWE_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const SIWE_DOMAIN = 'api.helixa.xyz';

function parseWalletSignIn(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7);
    const parts = token.split(':');
    if (parts.length < 3) return null;
    return {
        address: parts[0],
        timestamp: parts[1],
        signature: parts.slice(2).join(':'),
    };
}

function parseSIWA(authHeader) {
    return parseWalletSignIn(authHeader);
}

function parseSIWE(authHeader) {
    return parseWalletSignIn(authHeader);
}

function verifyWalletMessage(address, timestamp, signature, messageFactory, expiryMs) {
    try {
        const message = messageFactory(address, timestamp);
        const recovered = ethers.verifyMessage(message, signature);
        if (recovered.toLowerCase() !== address.toLowerCase()) return false;
        let ts = parseInt(timestamp);
        if (isNaN(ts)) return false;
        if (ts < 1e12) ts = ts * 1000;
        if (Date.now() - ts > expiryMs) return false;
        return true;
    } catch {
        return false;
    }
}

function verifySIWA(address, timestamp, signature) {
    return verifyWalletMessage(
        address,
        timestamp,
        signature,
        (walletAddress, ts) => `Sign-In With Agent: ${SIWA_DOMAIN} wants you to sign in with your wallet ${walletAddress} at ${ts}`,
        SIWA_EXPIRY_MS,
    );
}

function verifySIWE(address, timestamp, signature) {
    return verifyWalletMessage(
        address,
        timestamp,
        signature,
        (walletAddress, ts) => `Sign-In With Ethereum: ${SIWE_DOMAIN} wants you to sign in with your wallet ${walletAddress} at ${ts}`,
        SIWE_EXPIRY_MS,
    );
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
        address: ethers.getAddress(parsed.address),
        timestamp: parseInt(parsed.timestamp),
    };
    next();
}

function requireSIWE(req, res, next) {
    const parsed = parseSIWE(req.headers.authorization);
    if (!parsed) {
        return res.status(401).json({
            error: 'SIWE authentication required',
            hint: 'Set Authorization: Bearer {address}:{timestamp}:{signature}',
            message_format: `Sign-In With Ethereum: ${SIWE_DOMAIN} wants you to sign in with your wallet {address} at {timestamp}`,
        });
    }
    if (!verifySIWE(parsed.address, parsed.timestamp, parsed.signature)) {
        return res.status(401).json({ error: 'Invalid or expired SIWE token' });
    }
    req.human = {
        address: ethers.getAddress(parsed.address),
        timestamp: parseInt(parsed.timestamp),
    };
    next();
}

/**
 * Privy access‑token verification (JWT signed by Privy’s JWKS)
 * Used for human‑only auth where wallet is optional.
 */
const PRIVY_APP_ID = 'cmlv6ibdm00350el2jsm8m8s6';
const PRIVY_JWKS_URL = `https://api.privy.io/v1/apps/${PRIVY_APP_ID}/jwks.json`;

// Lazily load jose for JWKS verification
let remoteJWKSet = null;
async function getRemoteJWKSet() {
    if (remoteJWKSet) return remoteJWKSet;
    const { createRemoteJWKSet } = await import('jose');
    const url = new URL(PRIVY_JWKS_URL);
    remoteJWKSet = createRemoteJWKSet(url, {
        cacheMaxAge: 60 * 60 * 1000, // 60 minutes
        cooldownDuration: 10 * 60 * 1000,
    });
    return remoteJWKSet;
}

async function verifyPrivyAccessToken(token) {
    try {
        const { jwtVerify } = await import('jose');
        const jwks = await getRemoteJWKSet();
        const { payload } = await jwtVerify(token, jwks, {
            typ: 'JWT',
            algorithms: ['ES256'],
            issuer: 'privy.io',
            audience: PRIVY_APP_ID,
        });
        return {
            userId: payload.sub,
            sessionId: payload['sid'],
            issuedAt: payload.iat,
            expiresAt: payload.exp,
            appId: payload.aud,
        };
    } catch (err) {
        return null;
    }
}

function parsePrivyAuthHeader(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    return authHeader.slice(7).trim();
}

async function requirePrivyAccessToken(req, res, next) {
    const token = parsePrivyAuthHeader(req.headers.authorization);
    if (!token) {
        return res.status(401).json({ error: 'Privy access token required' });
    }
    const verified = await verifyPrivyAccessToken(token);
    if (!verified) {
        return res.status(401).json({ error: 'Invalid or expired Privy access token' });
    }
    req.privy = verified;
    next();
}

/**
 * Hybrid auth for human-only endpoints: accept either SIWE (wallet) or Privy access token (email/social).
 * Legacy SIWA is accepted temporarily for backward compatibility with already-open clients.
 */
async function requireHumanAuth(req, res, next) {
    const siweParsed = parseSIWE(req.headers.authorization);
    if (siweParsed && verifySIWE(siweParsed.address, siweParsed.timestamp, siweParsed.signature)) {
        req.humanAuth = {
            type: 'siwe',
            walletAddress: ethers.getAddress(siweParsed.address),
            userId: null,
        };
        return next();
    }

    const legacySiwaParsed = parseSIWA(req.headers.authorization);
    if (legacySiwaParsed && verifySIWA(legacySiwaParsed.address, legacySiwaParsed.timestamp, legacySiwaParsed.signature)) {
        req.humanAuth = {
            type: 'siwe-legacy-siwa',
            walletAddress: ethers.getAddress(legacySiwaParsed.address),
            userId: null,
        };
        return next();
    }

    // Fall back to Privy access token
    const token = parsePrivyAuthHeader(req.headers.authorization);
    if (token) {
        const verified = await verifyPrivyAccessToken(token);
        if (verified) {
            req.humanAuth = {
                type: 'privy',
                walletAddress: null,
                userId: verified.userId,
            };
            return next();
        }
    }
    // Neither valid
    return res.status(401).json({
        error: 'Human authentication required',
        hint: 'Set Authorization: Bearer {address}:{timestamp}:{signature} (SIWE) or Bearer {access-token} (Privy)',
        message_format: `Either SIWE wallet sign-in or Privy email/social auth accepted`,
    });
}

function requireHumanWalletAuth(req, res, next) {
    const siweParsed = parseSIWE(req.headers.authorization);
    if (siweParsed && verifySIWE(siweParsed.address, siweParsed.timestamp, siweParsed.signature)) {
        req.human = {
            address: ethers.getAddress(siweParsed.address),
            timestamp: parseInt(siweParsed.timestamp),
            authType: 'siwe',
        };
        return next();
    }

    const legacySiwaParsed = parseSIWA(req.headers.authorization);
    if (legacySiwaParsed && verifySIWA(legacySiwaParsed.address, legacySiwaParsed.timestamp, legacySiwaParsed.signature)) {
        req.human = {
            address: ethers.getAddress(legacySiwaParsed.address),
            timestamp: parseInt(legacySiwaParsed.timestamp),
            authType: 'siwe-legacy-siwa',
        };
        return next();
    }

    return res.status(401).json({
        error: 'SIWE authentication required',
        hint: 'Set Authorization: Bearer {address}:{timestamp}:{signature}',
        message_format: `Sign-In With Ethereum: ${SIWE_DOMAIN} wants you to sign in with your wallet {address} at {timestamp}`,
    });
}

module.exports = {
    parseWalletSignIn,
    parseSIWA,
    parseSIWE,
    verifySIWA,
    verifySIWE,
    requireSIWA,
    requireSIWE,
    SIWA_DOMAIN,
    SIWE_DOMAIN,
    verifyPrivyAccessToken,
    requirePrivyAccessToken,
    requireHumanAuth,
    requireHumanWalletAuth,
};
