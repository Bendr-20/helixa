/**
 * Rate Limiting Middleware
 */

const fs = require('fs');
const path = require('path');

const rateLimitWindows = {};
const mintRateLimits = {};
const RATE_LIMIT = { window: 60_000, maxRequests: 60 };
const RATE_LIMIT_MINT = { window: 300_000, maxRequests: 3 };
const RATE_LIMIT_STATE_PATH = path.join(__dirname, '..', '..', 'data', 'rate-limit-state.json');

let persistTimer = null;

function loadState(target, source) {
    for (const [key, value] of Object.entries(source || {})) {
        if (!value || typeof value !== 'object') continue;
        const count = Number(value.count || 0);
        const resetAt = Number(value.resetAt || 0);
        if (count > 0 && resetAt > Date.now()) {
            target[key] = { count, resetAt };
        }
    }
}

try {
    if (fs.existsSync(RATE_LIMIT_STATE_PATH)) {
        const state = JSON.parse(fs.readFileSync(RATE_LIMIT_STATE_PATH, 'utf8'));
        loadState(rateLimitWindows, state.global);
        loadState(mintRateLimits, state.mint);
    }
} catch {}

function persistRateLimitsSoon() {
    if (persistTimer) return;
    persistTimer = setTimeout(() => {
        persistTimer = null;
        try {
            const dir = path.dirname(RATE_LIMIT_STATE_PATH);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(RATE_LIMIT_STATE_PATH, JSON.stringify({ global: rateLimitWindows, mint: mintRateLimits }, null, 2));
        } catch {}
    }, 250);
    persistTimer.unref?.();
}

function checkRateLimit(key, limits, store) {
    const now = Date.now();
    const entry = store[key];
    if (!entry || now > entry.resetAt) {
        store[key] = { count: 1, resetAt: now + limits.window };
        persistRateLimitsSoon();
        return true;
    }
    entry.count++;
    persistRateLimitsSoon();
    return entry.count <= limits.maxRequests;
}

// Clean stale entries every 5 min
setInterval(() => {
    const now = Date.now();
    let changed = false;
    for (const [k, v] of Object.entries(rateLimitWindows)) {
        if (now > v.resetAt) {
            delete rateLimitWindows[k];
            changed = true;
        }
    }
    for (const [k, v] of Object.entries(mintRateLimits)) {
        if (now > v.resetAt) {
            delete mintRateLimits[k];
            changed = true;
        }
    }
    if (changed) persistRateLimitsSoon();
}, 300_000);

function globalRateLimit(req, res, next) {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    if (!checkRateLimit(ip, RATE_LIMIT, rateLimitWindows)) {
        return res.status(429).json({ error: 'Too many requests. Try again in a minute.' });
    }
    req.clientIp = ip;
    next();
}

function mintRateLimit(req, res, next) {
    const ip = req.clientIp || req.ip;
    if (!checkRateLimit(ip, RATE_LIMIT_MINT, mintRateLimits)) {
        return res.status(429).json({ error: 'Mint rate limit exceeded. Try again in 5 minutes.' });
    }
    next();
}

module.exports = { globalRateLimit, mintRateLimit, checkRateLimit };
