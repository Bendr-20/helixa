const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const intuition = require('./intuition-erc8004');

function withTempJson(value, fn) {
    const filePath = path.join(os.tmpdir(), `intuition-8004-${process.pid}-${Date.now()}.json`);
    fs.writeFileSync(filePath, JSON.stringify(value));
    try {
        return fn(filePath);
    } finally {
        fs.rmSync(filePath, { force: true });
    }
}

test('resolves canonical ERC-8004 token IDs to Helixa token IDs', () => {
    withTempJson([
        { regId: 18531, v2Id: 1, name: 'Bendr 2.0', to: '0xabc' },
        { regId: 18532, v2Id: 2, name: 'AncnBot', to: '0xdef' },
    ], (filePath) => {
        const mappings = intuition.loadCanonical8004Mappings(filePath, { setupState: {} });
        assert.deepEqual(intuition.resolveCanonical8004Mapping(8453, 18531, mappings), {
            canonicalChainId: 8453,
            canonicalTokenId: 18531,
            helixaTokenId: 1,
            name: 'Bendr 2.0',
            owner: '0xabc',
        });
        assert.equal(intuition.resolveCanonical8004Mapping(1, 18531, mappings), null);
        assert.equal(intuition.resolveCanonical8004Mapping(8453, 999, mappings), null);
    });
});

test('loads configured cross-chain ERC-8004 mappings', () => {
    withTempJson([], (filePath) => {
        const setupState = {
            canonicalMappings: [
                {
                    canonicalChainId: 1,
                    canonicalTokenId: 23121,
                    helixaTokenId: 1035,
                    name: 'DegenAI',
                    owner: '0xcd1baf2B33781c088B30106289e745972E41b0E8',
                    evidence: ['https://degenai.dev/erc8004.md'],
                },
                {
                    canonicalChainId: 1,
                    canonicalTokenId: 25068,
                    helixaTokenId: 73,
                    name: 'mferGPT',
                    owner: '0x39225d40C7a7157A838ecCdB05D09208d47Fd523',
                },
                {
                    canonicalChainId: 8453,
                    canonicalTokenId: 20880,
                    helixaTokenId: 1037,
                    name: 'SIBYL',
                    owner: '0x4069ef1afC8A9b2a29117A3740fCAB2912499fBe',
                },
            ],
        };
        const mappings = intuition.loadCanonical8004Mappings(filePath, { setupState });

        assert.deepEqual(intuition.resolveCanonical8004Mapping(1, 23121, mappings), {
            canonicalChainId: 1,
            canonicalTokenId: 23121,
            helixaTokenId: 1035,
            name: 'DegenAI',
            owner: '0xcd1baf2B33781c088B30106289e745972E41b0E8',
            evidence: ['https://degenai.dev/erc8004.md'],
        });
        assert.equal(intuition.resolveCanonical8004Mapping(1, 25068, mappings)?.helixaTokenId, 73);
        assert.equal(intuition.resolveCanonical8004Mapping(8453, 20880, mappings)?.helixaTokenId, 1037);
        assert.equal(intuition.resolveCanonical8004Mapping(8453, 25068, mappings), null);
    });
});

test('builds Intuition trust assessment JSON with the required fields', () => {
    const generatedAt = new Date('2026-07-13T22:50:00.000Z');
    const assessment = intuition.buildTrustAssessment({
        canonicalChainId: 8453,
        canonicalTokenId: 18531,
        helixaTokenId: 1,
        generatedAt,
        publicBaseUrl: 'https://api.helixa.xyz',
        agent: {
            name: 'Bendr 2.0',
            framework: 'OpenClaw',
            credScore: 87,
        },
        feedback: {
            feedbackCount: 3,
            avgScore: 91,
            clients: 2,
            tags: { starred: 3 },
        },
        credBreakdown: {
            computedScore: 87,
            breakdown: {
                activity: { rawScore: 90 },
                reputation8004: { rawScore: 67 },
            },
        },
    });

    assert.equal(assessment.agent.chainId, 8453);
    assert.equal(assessment.agent.tokenId, '18531');
    assert.equal(assessment.agent.registry, intuition.ERC8004_IDENTITY_REGISTRY);
    assert.equal(assessment.agent.helixa.tokenId, '1');
    assert.equal(assessment.provider.id, 'helixa-cred');
    assert.equal(assessment.assessment.score, 87);
    assert.equal(assessment.assessment.scoreScale, '0-100');
    assert.equal(assessment.assessment.tier, 'Prime');
    assert.equal(assessment.assessment.riskLevel, 'low');
    assert.equal(assessment.assessment.lastUpdated, '2026-07-13T22:50:00.000Z');
    assert.equal(assessment.assessment.dimensions.activity, 90);
    assert.equal(assessment.assessment.erc8004Feedback.feedbackCount, 3);
    assert.equal(
        assessment.resolver.url,
        'https://api.helixa.xyz/.well-known/intuition/erc8004/agents/8453/18531/trust-assessment.json',
    );
});

test('builds provider and assessment-source pinThing payloads', () => {
    const provider = intuition.buildProviderThing();
    assert.equal(provider.name, 'Helixa Cred');
    assert.equal(provider.url, 'https://cred.exchange');
    assert.ok(provider.image.startsWith('https://'));

    const source = intuition.buildAssessmentSourceThing({
        chainId: 8453,
        tokenId: 18531,
        publicBaseUrl: 'https://api.helixa.xyz',
    });
    assert.equal(source.name, 'Helixa Cred assessment for ERC-8004 agent 8453:18531');
    assert.equal(
        source.url,
        'https://api.helixa.xyz/.well-known/intuition/erc8004/agents/8453/18531/trust-assessment.json',
    );
});

test('reports Intuition Cred signal from published setup state', () => {
    withTempJson({
        provider: { id: 'helixa-cred' },
        assessmentSources: [
            {
                canonicalChainId: 8453,
                canonicalTokenId: 18531,
                helixaTokenId: 1,
                uri: 'ipfs://source',
                resolver: 'https://api.helixa.xyz/.well-known/intuition/erc8004/agents/8453/18531/trust-assessment.json',
            },
        ],
        onchainStatus: {
            status: 'published',
            publishedAt: '2026-07-13T23:18:34Z',
            atomTransactionHash: '0xatom',
            tripleTransactionHash: '0xtriple',
        },
    }, (filePath) => {
        const setupState = intuition.loadIntuitionSetupState(filePath);
        const signal = intuition.getIntuitionCredSignal({ tokenId: 1 }, { setupState });

        assert.equal(signal.status, 'published');
        assert.equal(signal.rawScore, 100);
        assert.equal(signal.canonicalAgentId, '8453:18531');
        assert.equal(signal.assessmentSourceUri, 'ipfs://source');
        assert.equal(signal.tripleTransactionHash, '0xtriple');
    });
});

test('reports mapping-required Intuition signal without overclaiming', () => {
    withTempJson({
        provider: { id: 'helixa-cred' },
        assessmentSources: [],
        onchainStatus: { status: 'published' },
    }, (filePath) => {
        const setupState = intuition.loadIntuitionSetupState(filePath);
        const signal = intuition.getIntuitionCredSignal(
            { tokenId: 1069 },
            { setupState, mappings: [] },
        );

        assert.equal(signal.status, 'unmapped');
        assert.equal(signal.label, 'Mapping needed');
        assert.equal(signal.rawScore, 0);
    });
});

test('reports mapped Intuition signal from configured cross-chain setup state', () => {
    withTempJson([], (filePath) => {
        const setupState = {
            provider: { id: 'helixa-cred' },
            canonicalMappings: [
                {
                    canonicalChainId: 1,
                    canonicalTokenId: 25068,
                    helixaTokenId: 73,
                    name: 'mferGPT',
                    owner: '0x39225d40C7a7157A838ecCdB05D09208d47Fd523',
                },
            ],
            onchainStatus: { status: 'published' },
        };
        const signal = intuition.getIntuitionCredSignal(
            { tokenId: 73 },
            { setupState, mappingPath: filePath, publicBaseUrl: 'https://api.helixa.xyz' },
        );

        assert.equal(signal.status, 'mapped');
        assert.equal(signal.label, 'Mapped');
        assert.equal(signal.rawScore, 40);
        assert.equal(signal.canonicalAgentId, '1:25068');
        assert.equal(
            signal.resolver,
            'https://api.helixa.xyz/.well-known/intuition/erc8004/agents/1/25068/trust-assessment.json',
        );
    });
});

test('pinThing sends apikey header and returns the pinned URI', async () => {
    const calls = [];
    const fetchImpl = async (endpoint, options) => {
        calls.push({ endpoint, options });
        return {
            ok: true,
            status: 200,
            async text() {
                return JSON.stringify({ data: { pinThing: { uri: 'ipfs://bafk-test' } } });
            },
        };
    };

    const result = await intuition.pinThing(intuition.buildProviderThing(), {
        apiKey: 'test-key',
        fetchImpl,
    });

    assert.equal(result.uri, 'ipfs://bafk-test');
    assert.equal(calls[0].endpoint, intuition.INTUITION_PINNING_ENDPOINT);
    assert.equal(calls[0].options.headers.apikey, 'test-key');
    assert.doesNotMatch(calls[0].options.body, /test-key/);
});
