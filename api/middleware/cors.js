/**
 * CORS & Security Headers Middleware
 */

const ALLOWED_ORIGINS = [
    'https://helixa.xyz',
    'https://www.helixa.xyz',
    'https://api.helixa.xyz',
    'http://localhost:5173',
    'http://localhost:3000',
];

function securityHeaders(req, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
}

function cors(req, res, next) {
    const origin = req.headers.origin;
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (!origin) {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Payment-Proof, X-Payment, Payment, Payment-Signature');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
}

module.exports = { securityHeaders, cors, ALLOWED_ORIGINS };
