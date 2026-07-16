#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const intuition = require('../services/intuition-erc8004');

const SETUP_STATE_PATH = process.env.INTUITION_SETUP_STATE_PATH
    || path.resolve(__dirname, '..', 'config', 'intuition-erc8004.json');
const MULTIVAULT_ABI = [
    'function calculateAtomId(bytes data) pure returns (bytes32)',
    'function calculateTripleId(bytes32 subjectId, bytes32 predicateId, bytes32 objectId) pure returns (bytes32)',
    'function createTriples(bytes32[] subjectIds, bytes32[] predicateIds, bytes32[] objectIds, uint256[] assets) payable returns (bytes32[])',
    'function getAtom(bytes32 atomId) view returns (bytes)',
    'function getGeneralConfig() view returns (tuple(address admin,address protocolMultisig,uint256 feeDenominator,address trustBonding,uint256 minDeposit,uint256 minShare,uint256 atomDataMaxLength,uint256 feeThreshold))',
    'function getTriple(bytes32 tripleId) view returns (bytes32, bytes32, bytes32)',
    'function getTripleCost() view returns (uint256)',
];

function printUsage() {
    console.log(`Usage:
  node api/scripts/intuition-8004-setup.js --pin-provider
  node api/scripts/intuition-8004-setup.js --pin-assessment-source <chainId> <canonicalTokenId>
  node api/scripts/intuition-8004-setup.js --publish-canonical-triples <chainId> <canonicalTokenId> [--dry-run]

Environment:
  INTUITION_API_KEY or INTUITION_PARTNER_API_KEY
  INTUITION_ENV_FILE defaults to ~/.config/helixa/intuition.env
  DEPLOYER_KEY or AWS Secrets Manager secret helixa/deployer-key for onchain publish`);
}

function parseArgs(argv) {
    const flags = new Set(argv.filter(arg => arg.startsWith('--')));
    const positionals = argv.filter((arg, index) => index === 0 || !arg.startsWith('--'));
    const [command, chainId, tokenId] = positionals;
    return { command, chainId, tokenId, dryRun: flags.has('--dry-run') };
}

function readSetupState() {
    return intuition.loadIntuitionSetupState(SETUP_STATE_PATH);
}

function writeSetupState(setupState) {
    fs.writeFileSync(SETUP_STATE_PATH, `${JSON.stringify(setupState, null, 2)}\n`);
}

function findAssessmentSource(setupState, chainId, tokenId) {
    const normalizedChainId = Number(chainId);
    const normalizedTokenId = Number(tokenId);
    const source = Array.isArray(setupState.assessmentSources)
        ? setupState.assessmentSources.find(item => (
            Number(item?.canonicalChainId) === normalizedChainId
            && Number(item?.canonicalTokenId) === normalizedTokenId
        ))
        : null;
    if (!source) throw new Error(`No pinned assessment source found for ERC-8004 agent ${chainId}:${tokenId}`);
    return source;
}

async function readDeployerKey() {
    if (process.env.DEPLOYER_KEY) return process.env.DEPLOYER_KEY;
    const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-2' });
    const response = await client.send(new GetSecretValueCommand({ SecretId: 'helixa/deployer-key' }));
    const secret = JSON.parse(response.SecretString || '{}');
    if (!secret.DEPLOYER_PRIVATE_KEY) throw new Error('missing_deployer_private_key');
    return secret.DEPLOYER_PRIVATE_KEY;
}

async function ensureAtom(contract, label, termId) {
    try {
        await contract.getAtom(termId);
    } catch {
        throw new Error(`Missing required Intuition atom for ${label}: ${termId}`);
    }
}

async function getTripleExists(contract, tripleId) {
    try {
        await contract.getTriple(tripleId);
        return true;
    } catch {
        return false;
    }
}

async function buildCanonicalTriplePlan({ setupState, chainId, tokenId, contract }) {
    const source = findAssessmentSource(setupState, chainId, tokenId);
    const providerUri = setupState?.provider?.uri;
    if (!providerUri) throw new Error('Missing provider.uri in Intuition setup state');
    if (!source.uri) throw new Error(`Missing assessment source URI for ERC-8004 agent ${chainId}:${tokenId}`);

    const terms = intuition.INTUITION_TERMS.mainnet;
    const canonicalAgentData =
        `eip155:${source.canonicalChainId}/erc721:${intuition.ERC8004_IDENTITY_REGISTRY}/${source.canonicalTokenId}`;
    const agentAtom = await contract.calculateAtomId(ethers.toUtf8Bytes(canonicalAgentData));
    const providerAtom = await contract.calculateAtomId(ethers.toUtf8Bytes(providerUri));
    const sourceAtom = await contract.calculateAtomId(ethers.toUtf8Bytes(source.uri));
    const tripleCost = await contract.getTripleCost();
    const generalConfig = await contract.getGeneralConfig();
    const assetPerTriple = tripleCost + generalConfig.minDeposit;

    const triples = [
        {
            label: 'has trust provider',
            subject: agentAtom,
            predicate: terms.hasTrustProvider,
            object: providerAtom,
        },
        {
            label: 'has trust assessment',
            subject: agentAtom,
            predicate: terms.hasTrustAssessment,
            object: sourceAtom,
        },
        {
            label: 'provided by',
            subject: sourceAtom,
            predicate: terms.providedBy,
            object: providerAtom,
        },
        {
            label: 'has type',
            subject: sourceAtom,
            predicate: terms.hasType,
            object: terms.trustAssessmentSource,
        },
    ];

    const atoms = [
        ['canonical agent', agentAtom],
        ['Helixa Cred provider', providerAtom],
        ['assessment source', sourceAtom],
        ['has trust provider', terms.hasTrustProvider],
        ['has trust assessment', terms.hasTrustAssessment],
        ['provided by', terms.providedBy],
        ['has type', terms.hasType],
        ['Trust Assessment Source', terms.trustAssessmentSource],
    ];
    for (const [label, termId] of atoms) {
        await ensureAtom(contract, label, termId);
    }

    for (const triple of triples) {
        triple.tripleId = await contract.calculateTripleId(triple.subject, triple.predicate, triple.object);
        triple.exists = await getTripleExists(contract, triple.tripleId);
        triple.asset = assetPerTriple;
    }

    return {
        source,
        terms: { agentAtom, providerAtom, sourceAtom },
        triples,
        tripleCost,
        minDeposit: generalConfig.minDeposit,
        assetPerTriple,
    };
}

function summarizePlan(plan) {
    return {
        source: {
            canonicalChainId: plan.source.canonicalChainId,
            canonicalTokenId: plan.source.canonicalTokenId,
            helixaTokenId: plan.source.helixaTokenId,
        },
        terms: plan.terms,
        tripleCostTrust: ethers.formatEther(plan.tripleCost),
        minDepositTrust: ethers.formatEther(plan.minDeposit),
        assetPerTripleTrust: ethers.formatEther(plan.assetPerTriple),
        totalValueTrust: ethers.formatEther(plan.triples
            .filter(triple => !triple.exists)
            .reduce((sum, triple) => sum + triple.asset, 0n)),
        triples: plan.triples.map(triple => ({
            label: triple.label,
            tripleId: triple.tripleId,
            subject: triple.subject,
            predicate: triple.predicate,
            object: triple.object,
            exists: triple.exists,
        })),
    };
}

function updateSetupStateAfterCanonicalPublish(setupState, plan, receipt, balanceAfter) {
    const previousTripleTransactionHash = setupState.onchainStatus?.tripleTransactionHash || null;
    const canonicalTriples = plan.triples.map(triple => ({
        predicate: triple.label,
        tripleId: triple.tripleId,
        subject: triple.subject,
        predicateTermId: triple.predicate,
        object: triple.object,
    }));

    setupState.onchainStatus = {
        ...(setupState.onchainStatus || {}),
        status: 'published',
        canonicalTriplesPublishedAt: new Date().toISOString(),
        legacyTripleTransactionHash: previousTripleTransactionHash,
        tripleTransactionHash: receipt.hash,
        canonicalTripleTransactionHash: receipt.hash,
        canonicalTripleBlockNumber: receipt.blockNumber,
        canonicalTripleGasUsed: receipt.gasUsed?.toString() || null,
        canonicalTripleProtocolCostTrust: ethers.formatEther(plan.triples.reduce((sum, triple) => sum + triple.asset, 0n)),
        balanceAfterTrust: ethers.formatEther(balanceAfter),
        canonicalTerms: {
            agent: plan.terms.agentAtom,
            provider: plan.terms.providerAtom,
            assessmentSource: plan.terms.sourceAtom,
            trustAssessmentSource: intuition.INTUITION_TERMS.mainnet.trustAssessmentSource,
        },
        triples: canonicalTriples.map(triple => ({
            predicate: triple.predicate,
            termId: triple.predicateTermId,
            tripleId: triple.tripleId,
        })),
        canonicalTriples,
        note: 'Provider and first assessment-source metadata are pinned. Mainnet Intuition Atoms and the four canonical Appendix B Triples are published.',
    };
}

async function publishCanonicalTriples({ chainId, tokenId, dryRun }) {
    if (!chainId || !tokenId) throw new Error('--publish-canonical-triples requires <chainId> <canonicalTokenId>');
    const setupState = readSetupState();
    const terms = intuition.INTUITION_TERMS.mainnet;
    const provider = new ethers.JsonRpcProvider(terms.rpcUrl, terms.chainId);
    const readContract = new ethers.Contract(terms.multiVault, MULTIVAULT_ABI, provider);
    const plan = await buildCanonicalTriplePlan({ setupState, chainId, tokenId, contract: readContract });
    const missingTriples = plan.triples.filter(triple => !triple.exists);

    if (dryRun || !missingTriples.length) {
        return {
            ok: true,
            dryRun: true,
            skipped: !missingTriples.length,
            ...summarizePlan(plan),
        };
    }

    const key = await readDeployerKey();
    const wallet = new ethers.Wallet(key, provider);
    const contract = readContract.connect(wallet);
    const subjects = missingTriples.map(triple => triple.subject);
    const predicates = missingTriples.map(triple => triple.predicate);
    const objects = missingTriples.map(triple => triple.object);
    const assets = missingTriples.map(triple => triple.asset);
    const value = assets.reduce((sum, asset) => sum + asset, 0n);

    const expectedIds = await contract.createTriples.staticCall(subjects, predicates, objects, assets, { value });
    const gasEstimate = await contract.createTriples.estimateGas(subjects, predicates, objects, assets, { value });
    const tx = await contract.createTriples(subjects, predicates, objects, assets, {
        value,
        gasLimit: gasEstimate + (gasEstimate / 5n),
    });
    const receipt = await tx.wait();
    if (receipt.status !== 1) throw new Error(`canonical triple transaction failed: ${tx.hash}`);

    const balanceAfter = await provider.getBalance(wallet.address);
    for (const triple of missingTriples) {
        if (!await getTripleExists(readContract, triple.tripleId)) {
            throw new Error(`published transaction missing triple ${triple.label}: ${triple.tripleId}`);
        }
        triple.exists = true;
    }

    updateSetupStateAfterCanonicalPublish(setupState, plan, receipt, balanceAfter);
    writeSetupState(setupState);

    return {
        ok: true,
        dryRun: false,
        executor: wallet.address,
        hash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        expectedIds: expectedIds.map(String),
        balanceAfterTrust: ethers.formatEther(balanceAfter),
        ...summarizePlan(plan),
    };
}

async function main() {
    const { command, chainId, tokenId, dryRun } = parseArgs(process.argv.slice(2));
    if (!command || command === '--help' || command === '-h') {
        printUsage();
        return;
    }

    if (command === '--pin-provider') {
        const apiKey = intuition.readIntuitionApiKey();
        if (!apiKey) throw new Error('Missing Intuition API key. Expected ~/.config/helixa/intuition.env or INTUITION_API_KEY.');
        const result = await intuition.pinThing(intuition.buildProviderThing(), { apiKey });
        console.log(JSON.stringify({
            ok: true,
            type: 'provider',
            name: result.thing.name,
            uri: result.uri,
        }, null, 2));
        return;
    }

    if (command === '--pin-assessment-source') {
        const apiKey = intuition.readIntuitionApiKey();
        if (!apiKey) throw new Error('Missing Intuition API key. Expected ~/.config/helixa/intuition.env or INTUITION_API_KEY.');
        if (!chainId || !tokenId) throw new Error('--pin-assessment-source requires <chainId> <canonicalTokenId>');
        const mapping = intuition.resolveCanonical8004Mapping(chainId, tokenId);
        if (!mapping) throw new Error(`No Helixa mapping found for canonical ERC-8004 agent ${chainId}:${tokenId}`);
        const result = await intuition.pinThing(
            intuition.buildAssessmentSourceThing({
                chainId: mapping.canonicalChainId,
                tokenId: mapping.canonicalTokenId,
                publicBaseUrl: process.env.PUBLIC_BASE_URL || 'https://api.helixa.xyz',
            }),
            { apiKey },
        );
        console.log(JSON.stringify({
            ok: true,
            type: 'assessment-source',
            canonicalChainId: mapping.canonicalChainId,
            canonicalTokenId: mapping.canonicalTokenId,
            helixaTokenId: mapping.helixaTokenId,
            name: result.thing.name,
            uri: result.uri,
            resolver: result.thing.url,
        }, null, 2));
        return;
    }

    if (command === '--publish-canonical-triples') {
        const result = await publishCanonicalTriples({ chainId, tokenId, dryRun });
        console.log(JSON.stringify(result, null, 2));
        return;
    }

    throw new Error(`Unknown command: ${command}`);
}

main().catch(error => {
    console.error(JSON.stringify({
        ok: false,
        error: error.message,
        code: error.code || null,
        status: error.status || null,
    }, null, 2));
    process.exit(1);
});
