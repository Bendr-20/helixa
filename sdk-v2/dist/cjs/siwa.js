"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSIWAToken = createSIWAToken;
exports.buildSIWAMessage = buildSIWAMessage;
const ethers_1 = require("ethers");
const SIWA_DOMAIN = 'api.helixa.xyz';
/**
 * Generate a SIWA (Sign-In With Agent) authentication token.
 *
 * @param privateKey - Agent wallet private key
 * @returns Bearer token string for Authorization header
 *
 * @example
 * ```ts
 * const token = await createSIWAToken('0xabc...');
 * // Use as: Authorization: Bearer <token>
 * ```
 */
async function createSIWAToken(privateKey) {
    const wallet = new ethers_1.ethers.Wallet(privateKey);
    const address = wallet.address;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const message = `Sign-In With Agent: ${SIWA_DOMAIN} wants you to sign in with your wallet ${address} at ${timestamp}`;
    const signature = await wallet.signMessage(message);
    return `${address}:${timestamp}:${signature}`;
}
/**
 * Build the SIWA message for manual signing.
 *
 * @param address - Wallet address (checksummed)
 * @param timestamp - Unix timestamp (seconds)
 * @returns The message string to sign
 */
function buildSIWAMessage(address, timestamp) {
    return `Sign-In With Agent: ${SIWA_DOMAIN} wants you to sign in with your wallet ${address} at ${timestamp}`;
}
