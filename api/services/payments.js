/**
 * Payment compatibility helpers.
 *
 * Fees are currently disabled platform-wide, but we keep the helpers around so
 * old integrations do not crash if they still import them.
 */

const fs = require('fs');
const path = require('path');
const { provider, DEPLOYER_ADDRESS, USDC_ADDRESS } = require('./contract');
const { ethers } = require('ethers');

const usedPayments = new Set();
const USED_PAYMENTS_PATH = path.join(__dirname, '..', '..', 'data', 'used-payments.json');

// Load used payments from disk
try {
    if (fs.existsSync(USED_PAYMENTS_PATH)) {
        JSON.parse(fs.readFileSync(USED_PAYMENTS_PATH, 'utf8')).forEach(h => usedPayments.add(h));
    }
} catch {}

function saveUsedPayments() {
    try {
        const dir = path.dirname(USED_PAYMENTS_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(USED_PAYMENTS_PATH, JSON.stringify([...usedPayments]));
    } catch {}
}

async function verifyUSDCPayment(txHash, expectedAmountUSDC) {
    if (usedPayments.has(txHash)) return false;
    try {
        const receipt = await provider.getTransactionReceipt(txHash);
        if (!receipt || receipt.status !== 1) return false;

        const transferTopic = ethers.id('Transfer(address,address,uint256)');
        const recipientPadded = ethers.zeroPadValue(DEPLOYER_ADDRESS, 32).toLowerCase();

        for (const log of receipt.logs) {
            if (log.address.toLowerCase() !== USDC_ADDRESS.toLowerCase()) continue;
            if (log.topics[0] !== transferTopic) continue;
            if (log.topics[2]?.toLowerCase() !== recipientPadded) continue;
            const amount = BigInt(log.data);
            const expectedRaw = BigInt(Math.round(expectedAmountUSDC * 1e6));
            if (amount >= expectedRaw) {
                usedPayments.add(txHash);
                saveUsedPayments();
                return true;
            }
        }
        return false;
    } catch {
        return false;
    }
}

const FACILITATOR_URL = 'https://x402.dexter.cash';

function requirePayment(amountUSDC) {
    return (req, res, next) => {
        req.payment = {
            amount: 0,
            verified: true,
            x402: false,
            waived: true,
            feeDisabled: true,
            requestedAmountUSDC: amountUSDC,
        };
        next();
    };
}

function requirePaymentLegacy(amountUSDC) {
    return (req, res, next) => {
        req.payment = {
            amount: 0,
            verified: true,
            waived: true,
            feeDisabled: true,
            requestedAmountUSDC: amountUSDC,
        };
        next();
    };
}

const PRICING = {
    agentMint: 0,
    update: 0,
    verify: 0,
    credReport: 0,
    soulLock: 0,
    soulHandshake: 0,
};

// Partner discounts — flat rate overrides for specific integrators
// Key: lowercase wallet address or API identifier
// Value: { agentMint, update, ... } — only override what's discounted
const PARTNER_PRICING = {};

/**
 * Resolve price for an endpoint, checking partner discounts first.
 * @param {string} priceKey - key from PRICING (e.g. 'agentMint')
 * @param {object} req - Express request (checks X-Partner-ID header or query param)
 * @returns {number} price in USD
 */
function resolvePrice(priceKey, req) {
    const partnerId = (req?.get?.('X-Partner-ID') || req?.query?.partner || '').toLowerCase().trim();
    if (partnerId && PARTNER_PRICING[partnerId] && PARTNER_PRICING[partnerId][priceKey] !== undefined) {
        return PARTNER_PRICING[partnerId][priceKey];
    }
    return PRICING[priceKey] || 0;
}

module.exports = {
    verifyUSDCPayment, requirePayment, requirePaymentLegacy,
    PRICING, PARTNER_PRICING, resolvePrice,
    FACILITATOR_URL, usedPayments, saveUsedPayments,
};
