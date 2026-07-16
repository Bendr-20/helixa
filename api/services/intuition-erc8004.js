const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE_CHAIN_ID = 8453;
const HELIXA_V2_REGISTRY = '0x2e3B541C59D38b84E3Bc54e977200230A204Fe60';
const ERC8004_IDENTITY_REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';
const INTUITION_PINNING_ENDPOINT = 'https://pin.intuition.systems/v1/graphql';
const DEFAULT_MAPPING_PATH = path.resolve(__dirname, '..', '..', 'data', '8004-transfers.json');
const DEFAULT_SETUP_STATE_PATH = path.resolve(__dirname, '..', 'config', 'intuition-erc8004.json');
const DEFAULT_SECRET_PATH = path.join(os.homedir(), '.config', 'helixa', 'intuition.env');

const PROVIDER = {
    id: 'helixa-cred',
    name: 'Helixa Cred',
    url: 'https://cred.exchange',
    image: 'https://api.helixa.xyz/api/v2/aura/1.png',
    description: 'Universal ERC-8004 agent trust scoring by Helixa.',
};

const INTUITION_TERMS = {
    mainnet: {
        chainId: 1155,
        graphQlEndpoint: 'https://mainnet.intuition.sh/v1/graphql',
        rpcUrl: 'https://rpc.intuition.systems/http',
        multiVault: '0x6E35cF57A41fA15eA0EaE9C33e751b01A784Fe7e',
        sameAs: '0xbeebfb7d177cbd96ffc239d2196c72ec346efe81f39dc595773f13d83506f5f0',
        hasTrustProvider: '0xdc3c5639b39f9b6553b75b37c47fa4810961392b28956234ba9f401a98f43888',
        hasTrustAssessment: '0x7f455fb041f766c3f24552db4c943888c6778c2475d4f2d434b84ad03298457c',
        providedBy: '0x9a310b5ca895009792e5b1dc0131539f36c054e8e32987989367ec73a1a3ef19',
        hasType: '0xa632a94306ab1d56911cff8c06473659a7caa2dfec6de3921bc23ec8ebf96ced',
        trustAssessmentSource: '0xf8a0ea34c8e7195b63d1641141166cc56e9128e25cf8c9f68ac6b81527b78f07',
    },
    testnet: {
        chainId: 13579,
        graphQlEndpoint: 'https://testnet.intuition.sh/v1/graphql',
        rpcUrl: 'https://testnet.rpc.intuition.systems/http',
        multiVault: '0x2Ece8D4dEdcB9918A398528f3fa4688b1d2CAB91',
        sameAs: '0xbeebfb7d177cbd96ffc239d2196c72ec346efe81f39dc595773f13d83506f5f0',
        hasTrustProvider: '0xdc3c5639b39f9b6553b75b37c47fa4810961392b28956234ba9f401a98f43888',
        hasTrustAssessment: '0x7f455fb041f766c3f24552db4c943888c6778c2475d4f2d434b84ad03298457c',
        providedBy: '0x9a310b5ca895009792e5b1dc0131539f36c054e8e32987989367ec73a1a3ef19',
        hasType: '0xa632a94306ab1d56911cff8c06473659a7caa2dfec6de3921bc23ec8ebf96ced',
        trustAssessmentSource: '0xf8a0ea34c8e7195b63d1641141166cc56e9128e25cf8c9f68ac6b81527b78f07',
    },
};

function trim(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function parseEnvLine(content, key) {
    const match = String(content || '').match(new RegExp(`^${key}=(.*)$`, 'm'));
    return trim(match?.[1] || '');
}

function readIntuitionApiKey(env = process.env, secretPath = DEFAULT_SECRET_PATH) {
    const direct = trim(env.INTUITION_API_KEY) || trim(env.INTUITION_PARTNER_API_KEY);
    if (direct) return direct;

    const envFile = trim(env.INTUITION_ENV_FILE) || secretPath;
    try {
        const content = fs.readFileSync(envFile, 'utf8');
        return parseEnvLine(content, 'INTUITION_API_KEY') || parseEnvLine(content, 'INTUITION_PARTNER_API_KEY');
    } catch {
        return '';
    }
}

function parsePositiveInt(value, label) {
    const parsed = Number.parseInt(String(value), 10);
    if (!Number.isSafeInteger(parsed) || parsed < 0) {
        const err = new Error(`invalid_${label}`);
        err.code = `invalid_${label}`;
        throw err;
    }
    return parsed;
}

function normalizeCanonical8004Mapping(row) {
    const canonicalChainId = Number(row.canonicalChainId ?? row.chainId ?? BASE_CHAIN_ID);
    const canonicalTokenId = Number(row.canonicalTokenId ?? row.regId);
    const helixaTokenId = Number(row.helixaTokenId ?? row.v2Id);
    if (
        !Number.isSafeInteger(canonicalChainId)
        || canonicalChainId < 0
        || !Number.isSafeInteger(canonicalTokenId)
        || canonicalTokenId < 0
        || !Number.isSafeInteger(helixaTokenId)
        || helixaTokenId < 0
    ) {
        return null;
    }

    const mapping = {
        canonicalChainId,
        canonicalTokenId,
        helixaTokenId,
        name: trim(row.name),
        owner: trim(row.owner ?? row.to),
    };
    const evidence = Array.isArray(row.evidence)
        ? row.evidence.map(item => trim(item)).filter(Boolean)
        : [];
    if (evidence.length) mapping.evidence = evidence;
    return mapping;
}

function loadConfiguredCanonical8004Mappings(setupState = loadIntuitionSetupState()) {
    const rows = Array.isArray(setupState?.canonicalMappings) ? setupState.canonicalMappings : [];
    return rows.map(normalizeCanonical8004Mapping).filter(Boolean);
}

function dedupeCanonical8004Mappings(mappings) {
    const byCanonicalId = new Map();
    for (const mapping of mappings) {
        byCanonicalId.set(`${mapping.canonicalChainId}:${mapping.canonicalTokenId}`, mapping);
    }
    return Array.from(byCanonicalId.values());
}

function loadCanonical8004Mappings(filePath = DEFAULT_MAPPING_PATH, options = {}) {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!Array.isArray(raw)) throw new Error('invalid_8004_mapping_file');

    const setupState = Object.prototype.hasOwnProperty.call(options, 'setupState')
        ? options.setupState
        : loadIntuitionSetupState(options.setupPath);
    return dedupeCanonical8004Mappings([
        ...raw.map(normalizeCanonical8004Mapping).filter(Boolean),
        ...loadConfiguredCanonical8004Mappings(setupState),
    ]);
}

function resolveCanonical8004Mapping(chainId, tokenId, mappings = loadCanonical8004Mappings()) {
    const normalizedChainId = parsePositiveInt(chainId, 'chain_id');
    const normalizedTokenId = parsePositiveInt(tokenId, 'token_id');

    return mappings.find(row => (
        row.canonicalChainId === normalizedChainId
        && row.canonicalTokenId === normalizedTokenId
    )) || null;
}

function resolveHelixa8004Mapping(helixaTokenId, mappings = loadCanonical8004Mappings()) {
    const normalizedTokenId = Number(helixaTokenId);
    if (!Number.isSafeInteger(normalizedTokenId) || normalizedTokenId < 0) return null;
    return mappings.find(row => row.helixaTokenId === normalizedTokenId) || null;
}

function loadIntuitionSetupState(filePath = DEFAULT_SETUP_STATE_PATH) {
    try {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

function findAssessmentSourceForHelixaToken(helixaTokenId, setupState = loadIntuitionSetupState()) {
    const normalizedTokenId = Number(helixaTokenId);
    if (!Number.isSafeInteger(normalizedTokenId) || normalizedTokenId < 0) return null;
    const sources = Array.isArray(setupState?.assessmentSources) ? setupState.assessmentSources : [];
    return sources.find(source => Number(source?.helixaTokenId) === normalizedTokenId) || null;
}

function sameAssessmentSource(left, right) {
    return Boolean(left && right)
        && Number(left.canonicalChainId) === Number(right.canonicalChainId)
        && Number(left.canonicalTokenId) === Number(right.canonicalTokenId)
        && Number(left.helixaTokenId) === Number(right.helixaTokenId);
}

function getAssessmentSourceOnchainStatus(setupState, assessmentSource) {
    if (assessmentSource?.onchainStatus && typeof assessmentSource.onchainStatus === 'object') {
        return assessmentSource.onchainStatus;
    }

    const sources = Array.isArray(setupState?.assessmentSources) ? setupState.assessmentSources : [];
    const legacyFirstSource = sources[0];
    if (sameAssessmentSource(legacyFirstSource, assessmentSource)) {
        return setupState?.onchainStatus || {};
    }

    return {};
}

function getIntuitionCredSignal(agent, options = {}) {
    const tokenId = Number(agent?.tokenId ?? agent?.helixaTokenId);
    if (!Number.isSafeInteger(tokenId) || tokenId < 0) {
        return { status: 'unmapped', label: 'No Helixa token', rawScore: 0 };
    }

    const setupState = options.setupState || loadIntuitionSetupState(options.setupPath);
    const assessmentSource = findAssessmentSourceForHelixaToken(tokenId, setupState);
    const mapping = assessmentSource
        ? {
            canonicalChainId: Number(assessmentSource.canonicalChainId || BASE_CHAIN_ID),
            canonicalTokenId: Number(assessmentSource.canonicalTokenId),
            helixaTokenId: tokenId,
        }
        : (() => {
            try {
                return resolveHelixa8004Mapping(
                    tokenId,
                    options.mappings || loadCanonical8004Mappings(options.mappingPath, { setupState }),
                );
            } catch {
                return null;
            }
        })();

    const onchainStatus = assessmentSource
        ? getAssessmentSourceOnchainStatus(setupState, assessmentSource)
        : {};
    const published = Boolean(
        assessmentSource
        && String(onchainStatus.status || '').toLowerCase() === 'published'
    );

    if (published) {
        return {
            status: 'published',
            label: 'Published',
            rawScore: 100,
            provider: setupState?.provider?.id || PROVIDER.id,
            canonicalAgentId: `${assessmentSource.canonicalChainId}:${assessmentSource.canonicalTokenId}`,
            resolver: assessmentSource.resolver || null,
            assessmentSourceUri: assessmentSource.uri || null,
            publishedAt: onchainStatus.publishedAt || null,
            atomTransactionHash: onchainStatus.atomTransactionHash || null,
            tripleTransactionHash: onchainStatus.tripleTransactionHash
                || onchainStatus.canonicalTripleTransactionHash
                || null,
        };
    }

    if (assessmentSource) {
        return {
            status: 'source_pinned',
            label: 'Source pinned',
            rawScore: 70,
            provider: setupState?.provider?.id || PROVIDER.id,
            canonicalAgentId: `${assessmentSource.canonicalChainId}:${assessmentSource.canonicalTokenId}`,
            resolver: assessmentSource.resolver || null,
            assessmentSourceUri: assessmentSource.uri || null,
        };
    }

    if (mapping) {
        return {
            status: 'mapped',
            label: 'Mapped',
            rawScore: 40,
            provider: setupState?.provider?.id || PROVIDER.id,
            canonicalAgentId: `${mapping.canonicalChainId}:${mapping.canonicalTokenId}`,
            resolver: buildResolverUrl({
                publicBaseUrl: options.publicBaseUrl || 'https://api.helixa.xyz',
                chainId: mapping.canonicalChainId,
                tokenId: mapping.canonicalTokenId,
            }),
        };
    }

    return {
        status: 'unmapped',
        label: 'Mapping needed',
        rawScore: 0,
        provider: setupState?.provider?.id || PROVIDER.id,
    };
}

function clampScore(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(100, Math.round(numeric)));
}

function credTier(score) {
    if (score >= 91) return 'Preferred';
    if (score >= 76) return 'Prime';
    if (score >= 51) return 'Qualified';
    if (score >= 26) return 'Marginal';
    return 'Junk';
}

function riskLevelForScore(score) {
    if (score >= 76) return 'low';
    if (score >= 51) return 'moderate';
    if (score >= 26) return 'elevated';
    return 'high';
}

function dimensionsFromBreakdown(credBreakdown) {
    const raw = credBreakdown?.components || credBreakdown?.breakdown || {};
    const dimensions = {};
    for (const [key, value] of Object.entries(raw)) {
        if (Number.isFinite(Number(value?.rawScore))) dimensions[key] = Number(value.rawScore);
    }
    return dimensions;
}

function buildResolverUrl({ publicBaseUrl, chainId, tokenId }) {
    const base = trim(publicBaseUrl || 'https://api.helixa.xyz').replace(/\/+$/, '');
    return `${base}/.well-known/intuition/erc8004/agents/${chainId}/${tokenId}/trust-assessment.json`;
}

function buildTrustAssessment({
    canonicalChainId,
    canonicalTokenId,
    helixaTokenId,
    agent,
    feedback,
    credBreakdown,
    generatedAt = new Date(),
    publicBaseUrl = 'https://api.helixa.xyz',
} = {}) {
    const chainId = parsePositiveInt(canonicalChainId ?? BASE_CHAIN_ID, 'chain_id');
    const tokenId = parsePositiveInt(canonicalTokenId, 'token_id');
    const v2Id = parsePositiveInt(helixaTokenId, 'helixa_token_id');
    const score = clampScore(credBreakdown?.computedScore ?? agent?.credScore);
    const now = generatedAt instanceof Date ? generatedAt : new Date(generatedAt);
    const lastUpdated = Number.isFinite(now.getTime()) ? now.toISOString() : new Date().toISOString();
    const validUntil = new Date((Number.isFinite(now.getTime()) ? now.getTime() : Date.now()) + 24 * 60 * 60 * 1000).toISOString();
    const resolverUrl = buildResolverUrl({ publicBaseUrl, chainId, tokenId });

    return {
        agent: {
            chainId,
            tokenId: String(tokenId),
            registry: ERC8004_IDENTITY_REGISTRY,
            caipId: `eip155:${chainId}/erc721:${ERC8004_IDENTITY_REGISTRY}/${tokenId}`,
            helixa: {
                chainId: BASE_CHAIN_ID,
                tokenId: String(v2Id),
                registry: HELIXA_V2_REGISTRY,
                profileUrl: `https://helixa.xyz/agent/${v2Id}`,
                apiUrl: `https://api.helixa.xyz/api/v2/agent/${v2Id}`,
            },
        },
        provider: {
            id: PROVIDER.id,
            name: PROVIDER.name,
            url: PROVIDER.url,
        },
        assessment: {
            score,
            scoreScale: '0-100',
            tier: credTier(score),
            riskLevel: riskLevelForScore(score),
            lastUpdated,
            sourceChain: 'base',
            freshness: {
                validUntil,
                refreshIntervalSeconds: 86400,
            },
            dimensions: dimensionsFromBreakdown(credBreakdown),
            evidence: [
                { type: 'helixa-profile', url: `https://api.helixa.xyz/api/v2/agent/${v2Id}` },
                { type: 'cred-breakdown', url: `https://api.helixa.xyz/api/v2/agent/${v2Id}/cred` },
                { type: 'erc8004-reputation', url: `https://api.helixa.xyz/api/v2/reputation/8004/${tokenId}` },
            ],
            erc8004Feedback: feedback ? {
                feedbackCount: Number(feedback.feedbackCount || 0),
                avgScore: feedback.avgScore ?? null,
                uniqueClients: Number(feedback.clients || 0),
                tags: feedback.tags || {},
            } : null,
        },
        resolver: {
            url: resolverUrl,
            mutable: true,
            format: 'application/json',
        },
        metadata: {
            schema: 'helixa-intuition-erc8004-trust-assessment-v1',
            generatedAt: lastUpdated,
            agentName: agent?.name || `Helixa Agent #${v2Id}`,
            agentFramework: agent?.framework || null,
        },
    };
}

async function graphqlRequest({ endpoint = INTUITION_PINNING_ENDPOINT, apiKey, query, variables, fetchImpl = global.fetch }) {
    const key = trim(apiKey);
    if (!key) {
        const err = new Error('missing_intuition_api_key');
        err.code = 'missing_intuition_api_key';
        throw err;
    }
    if (typeof fetchImpl !== 'function') throw new Error('fetch_unavailable');

    const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
            apikey: key,
            'content-type': 'application/json',
        },
        body: JSON.stringify({ query, variables }),
    });

    const bodyText = await response.text();
    let body;
    try {
        body = bodyText ? JSON.parse(bodyText) : {};
    } catch {
        body = { raw: bodyText };
    }

    if (!response.ok || body.errors?.length) {
        const err = new Error(body.errors?.[0]?.message || `intuition_graphql_${response.status}`);
        err.code = 'intuition_graphql_error';
        err.status = response.status;
        err.body = body;
        throw err;
    }

    return body;
}

async function pinThing(thing, options = {}) {
    const input = {
        name: trim(thing?.name),
        description: trim(thing?.description),
        image: trim(thing?.image),
        url: trim(thing?.url),
    };
    for (const [key, value] of Object.entries(input)) {
        if (!value) {
            const err = new Error(`missing_pin_thing_${key}`);
            err.code = `missing_pin_thing_${key}`;
            throw err;
        }
    }

    const body = await graphqlRequest({
        ...options,
        query: 'mutation($t: PinThingInput!) { pinThing(thing: $t) { uri } }',
        variables: { t: input },
    });
    const uri = body?.data?.pinThing?.uri;
    if (!uri) throw new Error('missing_pin_thing_uri');
    return { uri, thing: input };
}

function buildProviderThing() {
    return {
        name: PROVIDER.name,
        description: PROVIDER.description,
        image: PROVIDER.image,
        url: PROVIDER.url,
    };
}

function buildAssessmentSourceThing({ chainId, tokenId, publicBaseUrl = 'https://api.helixa.xyz' }) {
    const normalizedChainId = parsePositiveInt(chainId, 'chain_id');
    const normalizedTokenId = parsePositiveInt(tokenId, 'token_id');
    return {
        name: `${PROVIDER.name} assessment for ERC-8004 agent ${normalizedChainId}:${normalizedTokenId}`,
        description: `Live Helixa Cred trust assessment for ERC-8004 agent ${normalizedChainId}:${normalizedTokenId}.`,
        image: PROVIDER.image,
        url: buildResolverUrl({ publicBaseUrl, chainId: normalizedChainId, tokenId: normalizedTokenId }),
    };
}

module.exports = {
    BASE_CHAIN_ID,
    HELIXA_V2_REGISTRY,
    ERC8004_IDENTITY_REGISTRY,
    INTUITION_PINNING_ENDPOINT,
    INTUITION_TERMS,
    PROVIDER,
    buildAssessmentSourceThing,
    buildProviderThing,
    buildResolverUrl,
    buildTrustAssessment,
    credTier,
    findAssessmentSourceForHelixaToken,
    getIntuitionCredSignal,
    loadCanonical8004Mappings,
    loadConfiguredCanonical8004Mappings,
    loadIntuitionSetupState,
    pinThing,
    readIntuitionApiKey,
    resolveCanonical8004Mapping,
    resolveHelixa8004Mapping,
    riskLevelForScore,
};
