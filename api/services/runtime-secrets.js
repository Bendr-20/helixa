const fs = require('fs');
const os = require('os');
const path = require('path');

const awsSecretCache = new Map();

function trimString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function parseEnvLine(content, key) {
    const match = String(content || '').match(new RegExp(`^${key}=(.*)$`, 'm'));
    return trimString(match?.[1] || '');
}

async function getAwsSecretString(secretId) {
    const normalized = trimString(secretId);
    if (!normalized) return '';

    if (!awsSecretCache.has(normalized)) {
        awsSecretCache.set(normalized, (async () => {
            try {
                const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
                const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-2' });
                const resp = await client.send(new GetSecretValueCommand({ SecretId: normalized }));
                return trimString(resp.SecretString || '');
            } catch (error) {
                if (error?.name !== 'ResourceNotFoundException') {
                    console.warn(`[secrets] Failed to load ${normalized}: ${error.message}`);
                }
                return '';
            }
        })());
    }

    return awsSecretCache.get(normalized);
}

function getSecretField(secretString, key) {
    const raw = trimString(secretString);
    if (!raw) return '';

    try {
        const parsed = JSON.parse(raw);
        return trimString(parsed?.[key] || parsed?.[key.toLowerCase()] || parsed?.token || parsed?.bearerToken || '');
    } catch {}

    const envStyle = parseEnvLine(raw, key);
    if (envStyle) return envStyle;

    return raw;
}

function readEnvFileValue(filePath, key) {
    try {
        if (!fs.existsSync(filePath)) return '';
        return parseEnvLine(fs.readFileSync(filePath, 'utf8'), key);
    } catch {
        return '';
    }
}

async function getXBearerToken(env = process.env) {
    const direct = trimString(env.X_BEARER_TOKEN);
    if (direct) return direct;

    const secretId = trimString(env.X_API_SECRET_ID || 'helixa/x-api');
    const secretString = await getAwsSecretString(secretId);
    const secretToken = getSecretField(secretString, 'X_BEARER_TOKEN');
    if (secretToken) return secretToken;

    const fallbackPath = trimString(env.X_API_ENV_FILE) || path.join(os.homedir(), '.config', 'x-api', 'bendr.env');
    return readEnvFileValue(fallbackPath, 'X_BEARER_TOKEN');
}

module.exports = {
    getAwsSecretString,
    getXBearerToken,
    readEnvFileValue,
};
