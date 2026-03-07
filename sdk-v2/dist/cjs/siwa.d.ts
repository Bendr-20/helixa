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
export declare function createSIWAToken(privateKey: string): Promise<string>;
/**
 * Build the SIWA message for manual signing.
 *
 * @param address - Wallet address (checksummed)
 * @param timestamp - Unix timestamp (seconds)
 * @returns The message string to sign
 */
export declare function buildSIWAMessage(address: string, timestamp: number): string;
