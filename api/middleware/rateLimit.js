/**
 * Rate Limiting Middleware
 */

const rateLimitWindows = {};
const mintRateLimits = {};
const RATE_LIMIT = { window: 60_000, maxRequests: 30 };
const RATE_LIMIT_MINT = { window: 300_000, maxRequests: 3 };

function checkRateLimit(key, limits, store) {
    const now = Date.now();
    const entry = store[key];
    if (!entry || now > entry.resetAt) {
        store[key] = { count: 1, resetAt: now + limits.window };
        return true;
    }
    entry.count++;
    return entry.count <= limits.maxRequests;
}

// Clean stale entries every 5 min
setInterval(() => {
    const now = Date.now();
    for (const [k, v] of Object.entries(rateLimitWindows)) { if (now > v.resetAt) delete rateLimitWindows[k]; }
    for (const [k, v] of Object.entries(mintRateLimits)) { if (now > v.resetAt) delete mintRateLimits[k]; }
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
