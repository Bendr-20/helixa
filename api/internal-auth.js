const crypto = require('crypto');

function readEnvString(env, name) {
    return typeof env[name] === 'string' ? env[name].trim() : '';
}

function getRequiredSecret(env, name, { minLength = 1 } = {}) {
    const value = readEnvString(env, name);
    if (!value) {
        throw new Error(`[config] Missing required environment variable: ${name}`);
    }
    if (value.length < minLength) {
        throw new Error(`[config] Environment variable ${name} must be at least ${minLength} characters`);
    }
    return value;
}

function getOptionalSecret(env, name, { minLength = 1 } = {}) {
    const value = readEnvString(env, name);
    if (!value) return '';
    if (value.length < minLength) {
        throw new Error(`[config] Environment variable ${name} must be at least ${minLength} characters when set`);
    }
    return value;
}

function getSingleHeaderValue(value) {
    if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : '';
    return typeof value === 'string' ? value : '';
}

function uniqueTruthy(values) {
    return [...new Set(values.filter(Boolean))];
}

function createInternalAuthConfig(env = process.env) {
    const internalApiKey = getRequiredSecret(env, 'INTERNAL_API_KEY', { minLength: 32 });
    const previousInternalApiKey = getOptionalSecret(env, 'INTERNAL_API_KEY_PREVIOUS', { minLength: 32 });
    const receiptHmacSecret = getRequiredSecret(env, 'RECEIPT_HMAC_SECRET', { minLength: 32 });
    const previousReceiptHmacSecret = getOptionalSecret(env, 'RECEIPT_HMAC_SECRET_PREVIOUS', { minLength: 32 });

    return {
        internalApiKey,
        previousInternalApiKey,
        internalApiKeys: uniqueTruthy([internalApiKey, previousInternalApiKey]),
        receiptHmacSecret,
        previousReceiptHmacSecret,
        receiptSecrets: uniqueTruthy([receiptHmacSecret, previousReceiptHmacSecret]),
    };
}

function hasValidInternalKey(reqOrHeaders, config) {
    const headers = reqOrHeaders && reqOrHeaders.headers ? reqOrHeaders.headers : reqOrHeaders;
    const internalKey = getSingleHeaderValue(headers?.['x-internal-key']);
    return !!internalKey && config.internalApiKeys.includes(internalKey);
}

function createHmacSignature(payload, secret) {
    return crypto.createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
}

function timingSafeEqualString(left, right) {
    if (typeof left !== 'string' || typeof right !== 'string') return false;
    const leftBuf = Buffer.from(left, 'utf8');
    const rightBuf = Buffer.from(right, 'utf8');
    if (leftBuf.length !== rightBuf.length) return false;
    return crypto.timingSafeEqual(leftBuf, rightBuf);
}

function verifyHmacSignature(payload, signature, secrets) {
    if (typeof payload !== 'string' || typeof signature !== 'string' || !Array.isArray(secrets)) {
        return false;
    }
    return secrets.some((secret) => timingSafeEqualString(createHmacSignature(payload, secret), signature));
}

module.exports = {
    createInternalAuthConfig,
    createHmacSignature,
    getOptionalSecret,
    getRequiredSecret,
    getSingleHeaderValue,
    hasValidInternalKey,
    verifyHmacSignature,
};
