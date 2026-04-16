/**
 * SIWA (Sign-In With Agent) Authentication Middleware
 */

const { ethers } = require('ethers');

const SIWA_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const SIWA_DOMAIN = 'api.helixa.xyz';

function parseSIWA(authHeader) {
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

function verifySIWA(address, timestamp, signature) {
    try {
        const message = `Sign-In With Agent: ${SIWA_DOMAIN} wants you to sign in with your wallet ${address} at ${timestamp}`;
        const recovered = ethers.verifyMessage(message, signature);
        if (recovered.toLowerCase() !== address.toLowerCase()) return false;
        let ts = parseInt(timestamp);
        if (isNaN(ts)) return false;
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
 * Hybrid auth for human‑only endpoints: accept either SIWA (wallet) or Privy access token (email/social).
 */
async function requireHumanAuth(req, res, next) {
    // Try SIWA first
    const siwaParsed = parseSIWA(req.headers.authorization);
    if (siwaParsed && verifySIWA(siwaParsed.address, siwaParsed.timestamp, siwaParsed.signature)) {
        req.humanAuth = {
            type: 'siwa',
            walletAddress: ethers.getAddress(siwaParsed.address),
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
        hint: 'Set Authorization: Bearer {address}:{timestamp}:{signature} (SIWA) or Bearer {access-token} (Privy)',
        message_format: `Either wallet sign‑in or Privy email/social auth accepted`,
    });
}

module.exports = {
    parseSIWA,
    verifySIWA,
    requireSIWA,
    SIWA_DOMAIN,
    verifyPrivyAccessToken,
    requirePrivyAccessToken,
    requireHumanAuth,
};
