/**
 * Referrals Service
 * Handles OG wallets, referral codes, and referral tracking
 */

const fs = require('fs');
const path = require('path');
const log = require('../utils/logger');

// Constants
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
const REFERRAL_DB_PATH = path.join(__dirname, '..', '..', 'data', 'referrals.json');

function loadReferralDB() {
    try {
        if (fs.existsSync(REFERRAL_DB_PATH)) {
            const data = JSON.parse(fs.readFileSync(REFERRAL_DB_PATH, 'utf8'));
            Object.assign(referralRegistry, data.registry || {});
            Object.assign(referralStats, data.stats || {});
            log.info(`Loaded ${Object.keys(referralRegistry).length} referral codes`);
        }
    } catch (e) {
        log.error('Failed to load referral DB:', e.message);
    }
}

function saveReferralDB() {
    try {
        const dir = path.dirname(REFERRAL_DB_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(REFERRAL_DB_PATH, JSON.stringify({ registry: referralRegistry, stats: referralStats }, null, 2));
    } catch (e) {
        log.error(`Failed to save referral DB: ${e.message}`);
    }
}

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

function trackReferralUsage(code, points = REFERRAL_POINTS_REFERRER) {
    if (!referralStats[code]) {
        referralStats[code] = { mints: 0, pointsEarned: 0 };
    }
    referralStats[code].mints++;
    referralStats[code].pointsEarned += points;
    saveReferralDB();
}

function getReferralStats(code) {
    return referralStats[code] || { mints: 0, pointsEarned: 0 };
}

// Initialize
loadReferralDB();

module.exports = {
    // Constants
    OG_BONUS_POINTS,
    REFERRAL_POINTS_REFERRER,
    REFERRAL_POINTS_MINTER,
    
    // Data
    V1_OG_WALLETS,
    REFERRAL_CODES,
    referralRegistry,
    referralStats,
    
    // Functions
    isOGWallet,
    resolveReferralCode,
    generateReferralCode,
    registerReferralCode,
    trackReferralUsage,
    getReferralStats,
    loadReferralDB,
    saveReferralDB
};