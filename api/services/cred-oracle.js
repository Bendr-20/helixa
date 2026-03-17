/**
 * $CRED Price Oracle — DexScreener API
 * 
 * Fetches CRED/USD price from DexScreener. Cached 60s, background refresh 45s.
 * Graceful failure: returns null if unavailable → USDC-only fallback.
 */

const CRED_ADDRESS = '0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3';
const CRED_DECIMALS = 18;
const CRED_DISCOUNT = 0.80; // 20% discount → pay 80%
const DEXSCREENER_URL = `https://api.dexscreener.com/latest/dex/tokens/${CRED_ADDRESS}`;
const CACHE_TTL_MS = 60_000;

let cachedPrice = null;   // USD price of 1 CRED
let cacheTimestamp = 0;
let fetching = false;
let refreshTimer = null;

async function fetchPrice() {
    if (fetching) return; // max 1 concurrent
    fetching = true;
    try {
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 8000);
        const resp = await fetch(DEXSCREENER_URL, { signal: ctrl.signal });
        clearTimeout(timeout);
        if (!resp.ok) return;
        const data = await resp.json();
        // Find the pair with highest liquidity on Base
        const pairs = (data.pairs || []).filter(p => p.chainId === 'base');
        if (pairs.length === 0) return;
        pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
        const price = parseFloat(pairs[0].priceUsd);
        if (price > 0 && isFinite(price)) {
            cachedPrice = price;
            cacheTimestamp = Date.now();
            console.log(`[CRED ORACLE] Price: 1 CRED = $${price} (${pairs[0].dexId})`);
        }
    } catch (e) {
        console.warn(`[CRED ORACLE] Fetch failed: ${e.message}`);
    } finally {
        fetching = false;
    }
}

function getCredPriceUSDC() {
    if (cachedPrice && (Date.now() - cacheTimestamp) < CACHE_TTL_MS) {
        return cachedPrice;
    }
    // Return stale price up to 5 min, else null
    if (cachedPrice && (Date.now() - cacheTimestamp) < 300_000) return cachedPrice;
    return null;
}

function getCredAmountForUSD(usdPrice) {
    const price = getCredPriceUSDC();
    if (!price) return null;
    const discountedUSD = usdPrice * CRED_DISCOUNT;
    return discountedUSD / price;
}

function startBackgroundRefresh() {
    if (refreshTimer) return;
    // Initial fetch (non-blocking)
    fetchPrice().catch(() => {});
    refreshTimer = setInterval(() => { fetchPrice().catch(() => {}); }, 45_000);
    refreshTimer.unref();
    console.log('[CRED ORACLE] Background refresh started (every 45s)');
}

module.exports = {
    CRED_ADDRESS,
    CRED_DECIMALS,
    getCredPriceUSDC,
    getCredAmountForUSD,
    startBackgroundRefresh,
};
