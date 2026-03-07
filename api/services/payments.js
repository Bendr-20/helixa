/**
 * x402 Payment Verification & Middleware
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
    if (amountUSDC <= 0) return (req, res, next) => next();
    return async (req, res, next) => {
        const paymentHeader = req.get('X-PAYMENT') || req.get('Payment') || req.get('x-payment');
        if (!paymentHeader) {
            return res.status(402).json({
                error: 'Payment Required',
                'x-payment-required': {
                    scheme: 'exact',
                    network: 'eip155:8453',
                    maxAmountRequired: String(amountUSDC * 1_000_000),
                    resource: req.originalUrl || req.url,
                    description: `${amountUSDC} USDC payment required`,
                    mimeType: 'application/json',
                    payTo: DEPLOYER_ADDRESS,
                    maxTimeoutSeconds: 300,
                    asset: USDC_ADDRESS,
                    extra: { name: 'Helixa Agent Mint', facilitatorUrl: FACILITATOR_URL },
                },
                hint: 'Send x402 payment via X-PAYMENT header.',
            });
        }
        try {
            const fetch = (await import('node-fetch')).default;
            const verifyRes = await fetch(`${FACILITATOR_URL}/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payment: paymentHeader, payTo: DEPLOYER_ADDRESS,
                    maxAmountRequired: String(amountUSDC * 1_000_000),
                    network: 'eip155:8453', asset: USDC_ADDRESS,
                    resource: req.originalUrl || req.url,
                }),
                signal: AbortSignal.timeout(15000),
            });
            if (!verifyRes.ok) {
                const err = await verifyRes.text();
                return res.status(402).json({ error: 'Payment verification failed', detail: err });
            }
            const settleRes = await fetch(`${FACILITATOR_URL}/settle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payment: paymentHeader, payTo: DEPLOYER_ADDRESS,
                    maxAmountRequired: String(amountUSDC * 1_000_000),
                    network: 'eip155:8453', asset: USDC_ADDRESS,
                    resource: req.originalUrl || req.url,
                }),
                signal: AbortSignal.timeout(30000),
            });
            if (!settleRes.ok) {
                const err = await settleRes.text();
                return res.status(402).json({ error: 'Payment settlement failed', detail: err });
            }
            req.payment = { amount: amountUSDC, verified: true, x402: true };
            next();
        } catch (err) {
            return res.status(500).json({ error: 'Payment processing error', message: err.message });
        }
    };
}

function requirePaymentLegacy(amountUSDC) {
    return async (req, res, next) => {
        if (amountUSDC <= 0) return next();
        const txHash = req.headers['x-payment-proof'];
        if (!txHash) {
            return res.status(402).json({
                error: 'Payment Required',
                x402: {
                    protocol: 'x402', version: '1.0', amount: amountUSDC,
                    asset: 'USDC', assetAddress: USDC_ADDRESS,
                    recipient: DEPLOYER_ADDRESS, chain: 'base', chainId: 8453, network: 'eip155:8453',
                },
                hint: 'Send USDC to recipient, then retry with header X-Payment-Proof: {txHash}',
            });
        }
        if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
            return res.status(400).json({ error: 'Invalid X-Payment-Proof tx hash' });
        }
        const verified = await verifyUSDCPayment(txHash, amountUSDC);
        if (!verified) {
            return res.status(402).json({
                error: 'Payment not verified',
                detail: 'USDC transfer not found or insufficient amount',
            });
        }
        req.payment = { txHash, amount: amountUSDC, verified: true };
        next();
    };
}

const PRICING = {
    agentMint: 1,
    update: 1,
    verify: 0,
    credReport: 1,
};

module.exports = {
    verifyUSDCPayment, requirePayment, requirePaymentLegacy,
    PRICING, FACILITATOR_URL, usedPayments, saveUsedPayments,
};
