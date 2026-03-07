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

module.exports = { parseSIWA, verifySIWA, requireSIWA, SIWA_DOMAIN };
