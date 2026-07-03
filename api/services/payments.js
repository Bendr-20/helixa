/**
 * Payment compatibility helpers.
 *
 * Shared payment helpers for direct TX verification and x402 route config.
 */

const fs = require('fs');
const path = require('path');
const { provider, DEPLOYER_ADDRESS, USDC_ADDRESS } = require('./contract');
const { ethers } = require('ethers');

const BASE_NETWORK = 'eip155:8453';
const CRED_ADDRESS = '0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3';
const CRED_DECIMALS = 18;
const CRED_X402_EXTRA = { assetTransferMethod: 'permit2' };

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
    agentMint: 1,
    update: 0,
    verify: 0,
    credReport: 0.01,
    soulLock: 0,
    soulHandshake: 0,
};

function formatUSDPrice(priceUSD) {
    const price = Number(priceUSD);
    if (!Number.isFinite(price) || price < 0) throw new Error(`Invalid USD price: ${priceUSD}`);
    return `$${price.toFixed(2)}`;
}

function expandExponentialDecimal(value) {
    const raw = String(value).trim();
    if (!/[eE]/.test(raw)) return raw;

    const [mantissaRaw, exponentRaw] = raw.toLowerCase().split('e');
    const exponent = Number(exponentRaw);
    if (!Number.isInteger(exponent)) throw new Error(`Invalid decimal value: ${value}`);

    const negative = mantissaRaw.startsWith('-');
    const mantissa = mantissaRaw.replace(/^[+-]/, '');
    const [intPart, fracPart = ''] = mantissa.split('.');
    const digits = `${intPart}${fracPart}`.replace(/^0+/, '') || '0';
    const decimalPlaces = fracPart.length - exponent;

    if (decimalPlaces <= 0) {
        return `${negative ? '-' : ''}${digits}${'0'.repeat(Math.abs(decimalPlaces))}`;
    }

    if (decimalPlaces >= digits.length) {
        return `${negative ? '-' : ''}0.${'0'.repeat(decimalPlaces - digits.length)}${digits}`;
    }

    const splitAt = digits.length - decimalPlaces;
    return `${negative ? '-' : ''}${digits.slice(0, splitAt)}.${digits.slice(splitAt)}`;
}

function decimalToRatio(value) {
    const normalized = expandExponentialDecimal(value);
    if (!/^\d+(\.\d+)?$/.test(normalized)) throw new Error(`Invalid decimal value: ${value}`);
    const [intPart, fracPart = ''] = normalized.split('.');
    const numerator = BigInt(`${intPart}${fracPart}`.replace(/^0+/, '') || '0');
    const denominator = 10n ** BigInt(fracPart.length);
    return { numerator, denominator };
}

function ceilDiv(numerator, denominator) {
    if (denominator <= 0n) throw new Error('Invalid denominator');
    return (numerator + denominator - 1n) / denominator;
}

function getCredTokenAmountForUSD(usdPrice, credPriceUSD, decimals = CRED_DECIMALS) {
    const usd = decimalToRatio(usdPrice);
    const cred = decimalToRatio(credPriceUSD);
    if (usd.numerator <= 0n) throw new Error(`Invalid USD price: ${usdPrice}`);
    if (cred.numerator <= 0n) throw new Error(`Invalid CRED/USD price: ${credPriceUSD}`);

    const scale = 10n ** BigInt(decimals);
    const numerator = usd.numerator * cred.denominator * scale;
    const denominator = usd.denominator * cred.numerator;
    return ceilDiv(numerator, denominator).toString();
}

function buildCredAssetPrice(priceUSD, credPriceUSD) {
    return {
        asset: CRED_ADDRESS,
        amount: getCredTokenAmountForUSD(priceUSD, credPriceUSD),
        extra: CRED_X402_EXTRA,
    };
}

function buildCredReportAccepts({
    priceUSD = PRICING.credReport,
    payTo = DEPLOYER_ADDRESS,
    credPriceUSD,
    network = BASE_NETWORK,
    enableCredX402 = false,
} = {}) {
    const accepts = [{
        scheme: 'exact',
        price: formatUSDPrice(priceUSD),
        network,
        payTo,
    }];

    if (enableCredX402 && credPriceUSD !== undefined && credPriceUSD !== null) {
        accepts.push({
            scheme: 'exact',
            price: typeof credPriceUSD === 'function'
                ? async (context) => buildCredAssetPrice(priceUSD, await credPriceUSD(context))
                : buildCredAssetPrice(priceUSD, credPriceUSD),
            network,
            payTo,
        });
    }

    return accepts;
}

function buildCredReportPaymentRoute(options = {}) {
    return {
        accepts: buildCredReportAccepts(options),
        description: 'Full Cred Report with scoring breakdown',
        mimeType: 'application/json',
    };
}

const PLANNED_CRED_PAYMENT_NOTE = 'Native $CRED payment is planned after custom ERC20 facilitator support is confirmed.';

function formatCredEstimate(credAmount) {
    const amount = Number(credAmount);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    return {
        amount,
        formatted: `${Math.ceil(amount).toLocaleString()} CRED`,
    };
}

function buildServicePricing(usdPrice, credAmount = null) {
    const price = Number(usdPrice);
    if (!Number.isFinite(price) || price < 0) throw new Error(`Invalid USD price: ${usdPrice}`);
    if (price === 0) return { usdc: 'free', cred: 'free' };

    const cred = {
        status: 'planned',
        estimate: formatCredEstimate(credAmount),
        note: PLANNED_CRED_PAYMENT_NOTE,
    };
    if (!cred.estimate) delete cred.estimate;

    return {
        usdc: formatUSDPrice(price),
        cred,
    };
}

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
    BASE_NETWORK, CRED_ADDRESS, CRED_DECIMALS, CRED_X402_EXTRA,
    formatUSDPrice, getCredTokenAmountForUSD,
    buildCredReportAccepts, buildCredReportPaymentRoute,
    buildServicePricing, PLANNED_CRED_PAYMENT_NOTE,
    FACILITATOR_URL, usedPayments, saveUsedPayments,
};
