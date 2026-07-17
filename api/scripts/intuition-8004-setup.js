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
    'function createAtoms(bytes[] atomData, uint256[] assets) payable returns (bytes32[])',
    'function createTriples(bytes32[] subjectIds, bytes32[] predicateIds, bytes32[] objectIds, uint256[] assets) payable returns (bytes32[])',
    'function getAtom(bytes32 atomId) view returns (bytes)',
    'function getAtomCost() view returns (uint256)',
    'function getGeneralConfig() view returns (tuple(address admin,address protocolMultisig,uint256 feeDenominator,address trustBonding,uint256 minDeposit,uint256 minShare,uint256 atomDataMaxLength,uint256 feeThreshold))',
    'function getTriple(bytes32 tripleId) view returns (bytes32, bytes32, bytes32)',
    'function getTripleCost() view returns (uint256)',
];

function printUsage() {
    console.log(`Usage:
  node api/scripts/intuition-8004-setup.js --pin-provider
  node api/scripts/intuition-8004-setup.js --pin-assessment-source <chainId> <canonicalTokenId>
  node api/scripts/intuition-8004-setup.js --pin-mapped-assessment-sources
  node api/scripts/intuition-8004-setup.js --publish-canonical-triples <chainId> <canonicalTokenId> [--dry-run]
  node api/scripts/intuition-8004-setup.js --publish-canonical-batch [--dry-run]
  node api/scripts/intuition-8004-setup.js --pin-agent-identities
  node api/scripts/intuition-8004-setup.js --publish-agent-identity-batch [--dry-run]

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

function maybeFindAssessmentSource(setupState, chainId, tokenId) {
    const normalizedChainId = Number(chainId);
    const normalizedTokenId = Number(tokenId);
    return Array.isArray(setupState.assessmentSources)
        ? setupState.assessmentSources.find(item => (
            Number(item?.canonicalChainId) === normalizedChainId
            && Number(item?.canonicalTokenId) === normalizedTokenId
        )) || null
        : null;
}

async function readDeployerKey() {
    if (process.env.DEPLOYER_KEY) return process.env.DEPLOYER_KEY;
    const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-2' });
    const response = await client.send(new GetSecretValueCommand({ SecretId: 'helixa/deployer-key' }));
    const secret = JSON.parse(response.SecretString || '{}');
    if (!secret.DEPLOYER_PRIVATE_KEY) throw new Error('missing_deployer_private_key');
    return secret.DEPLOYER_PRIVATE_KEY;
}

async function getTripleExists(contract, tripleId) {
    try {
        await contract.getTriple(tripleId);
        return true;
    } catch {
        return false;
    }
}

async function getAtomExists(contract, atomId) {
    try {
        await contract.getAtom(atomId);
        return true;
    } catch {
        return false;
    }
}

function sameAssessmentSource(left, right) {
    return Boolean(left && right)
        && Number(left.canonicalChainId) === Number(right.canonicalChainId)
        && Number(left.canonicalTokenId) === Number(right.canonicalTokenId)
        && Number(left.helixaTokenId) === Number(right.helixaTokenId);
}

function sameCanonicalAgent(left, right) {
    return Boolean(left && right)
        && Number(left.canonicalChainId) === Number(right.canonicalChainId)
        && Number(left.canonicalTokenId) === Number(right.canonicalTokenId)
        && Number(left.helixaTokenId) === Number(right.helixaTokenId);
}

function upsertAssessmentSource(setupState, source) {
    if (!Array.isArray(setupState.assessmentSources)) setupState.assessmentSources = [];
    const existing = setupState.assessmentSources.find(item => sameAssessmentSource(item, source));
    if (existing) {
        Object.assign(existing, source, {
            onchainStatus: existing.onchainStatus || source.onchainStatus,
        });
        return existing;
    }
    setupState.assessmentSources.push(source);
    return source;
}

function findPlanSource(setupState, plan) {
    return setupState.assessmentSources.find(source => sameAssessmentSource(source, plan.source));
}

function findAgentIdentity(setupState, source) {
    return Array.isArray(setupState.agentIdentities)
        ? setupState.agentIdentities.find(identity => sameCanonicalAgent(identity, source)) || null
        : null;
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
    const atomCost = await contract.getAtomCost();
    const tripleCost = await contract.getTripleCost();
    const generalConfig = await contract.getGeneralConfig();
    const assetPerAtom = atomCost + generalConfig.minDeposit;
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
        { label: 'canonical agent', atomId: agentAtom, data: canonicalAgentData, createIfMissing: true },
        { label: 'Helixa Cred provider', atomId: providerAtom, data: providerUri, createIfMissing: false },
        { label: 'assessment source', atomId: sourceAtom, data: source.uri, createIfMissing: true },
        { label: 'has trust provider', atomId: terms.hasTrustProvider, createIfMissing: false },
        { label: 'has trust assessment', atomId: terms.hasTrustAssessment, createIfMissing: false },
        { label: 'provided by', atomId: terms.providedBy, createIfMissing: false },
        { label: 'has type', atomId: terms.hasType, createIfMissing: false },
        { label: 'Trust Assessment Source', atomId: terms.trustAssessmentSource, createIfMissing: false },
    ];
    for (const atom of atoms) {
        atom.exists = await getAtomExists(contract, atom.atomId);
        atom.asset = assetPerAtom;
        if (!atom.exists && !atom.createIfMissing) {
            throw new Error(`Missing required Intuition atom for ${atom.label}: ${atom.atomId}`);
        }
    }

    for (const triple of triples) {
        triple.tripleId = await contract.calculateTripleId(triple.subject, triple.predicate, triple.object);
        triple.exists = await getTripleExists(contract, triple.tripleId);
        triple.asset = assetPerTriple;
    }

    return {
        source,
        terms: { agentAtom, providerAtom, sourceAtom },
        atoms,
        atomCost,
        triples,
        tripleCost,
        minDeposit: generalConfig.minDeposit,
        assetPerAtom,
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
        atomCostTrust: ethers.formatEther(plan.atomCost),
        tripleCostTrust: ethers.formatEther(plan.tripleCost),
        minDepositTrust: ethers.formatEther(plan.minDeposit),
        assetPerAtomTrust: ethers.formatEther(plan.assetPerAtom),
        assetPerTripleTrust: ethers.formatEther(plan.assetPerTriple),
        totalAtomValueTrust: ethers.formatEther(plan.atoms
            .filter(atom => atom.createIfMissing && !atom.exists)
            .reduce((sum, atom) => sum + atom.asset, 0n)),
        totalValueTrust: ethers.formatEther(plan.triples
            .filter(triple => !triple.exists)
            .reduce((sum, triple) => sum + triple.asset, 0n)),
        atoms: plan.atoms.map(atom => ({
            label: atom.label,
            atomId: atom.atomId,
            data: atom.data || null,
            createIfMissing: atom.createIfMissing,
            exists: atom.exists,
        })),
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

function buildSourceOnchainStatus({ plan, atomReceipt, tripleReceipt, balanceAfter, atomValue, tripleValue }) {
    const canonicalTriples = plan.triples.map(triple => ({
        predicate: triple.label,
        tripleId: triple.tripleId,
        subject: triple.subject,
        predicateTermId: triple.predicate,
        object: triple.object,
    }));

    return {
        status: 'published',
        publishedAt: new Date().toISOString(),
        atomTransactionHash: atomReceipt?.hash || plan.source.onchainStatus?.atomTransactionHash || null,
        atomBlockNumber: atomReceipt?.blockNumber || plan.source.onchainStatus?.atomBlockNumber || null,
        atomGasUsed: atomReceipt?.gasUsed?.toString() || plan.source.onchainStatus?.atomGasUsed || null,
        tripleTransactionHash: tripleReceipt?.hash || plan.source.onchainStatus?.tripleTransactionHash || null,
        canonicalTripleTransactionHash: tripleReceipt?.hash || plan.source.onchainStatus?.canonicalTripleTransactionHash || null,
        canonicalTripleBlockNumber: tripleReceipt?.blockNumber || plan.source.onchainStatus?.canonicalTripleBlockNumber || null,
        canonicalTripleGasUsed: tripleReceipt?.gasUsed?.toString() || plan.source.onchainStatus?.canonicalTripleGasUsed || null,
        atomProtocolCostTrust: ethers.formatEther(atomValue || 0n),
        canonicalTripleProtocolCostTrust: ethers.formatEther(tripleValue || 0n),
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
        note: 'Assessment-source metadata is pinned. Mainnet Intuition atoms and four canonical Appendix B triples are published.',
    };
}

function updateAssessmentSourceAfterCanonicalPublish(setupState, plan, receipts) {
    const source = findPlanSource(setupState, plan);
    if (!source) throw new Error(`Missing setup state source for ERC-8004 agent ${plan.source.canonicalChainId}:${plan.source.canonicalTokenId}`);
    source.onchainStatus = buildSourceOnchainStatus({ plan, ...receipts });

    const firstSource = setupState.assessmentSources?.[0];
    if (sameAssessmentSource(firstSource, source)) {
        setupState.onchainStatus = {
            ...(setupState.onchainStatus || {}),
            ...source.onchainStatus,
        };
    }
}

function dedupeBy(items, keyFn) {
    const byKey = new Map();
    for (const item of items) {
        const key = keyFn(item);
        if (!byKey.has(key)) byKey.set(key, item);
    }
    return Array.from(byKey.values());
}

async function publishCanonicalTriples({ chainId, tokenId, dryRun }) {
    if (!chainId || !tokenId) throw new Error('--publish-canonical-triples requires <chainId> <canonicalTokenId>');
    const setupState = readSetupState();
    const terms = intuition.INTUITION_TERMS.mainnet;
    const provider = new ethers.JsonRpcProvider(terms.rpcUrl, terms.chainId);
    const readContract = new ethers.Contract(terms.multiVault, MULTIVAULT_ABI, provider);
    const plan = await buildCanonicalTriplePlan({ setupState, chainId, tokenId, contract: readContract });
    const missingAtoms = plan.atoms.filter(atom => atom.createIfMissing && !atom.exists);
    const missingTriples = plan.triples.filter(triple => !triple.exists);

    if (dryRun || (!missingAtoms.length && !missingTriples.length)) {
        return {
            ok: true,
            dryRun: true,
            skipped: !missingAtoms.length && !missingTriples.length,
            ...summarizePlan(plan),
        };
    }

    const key = await readDeployerKey();
    const wallet = new ethers.Wallet(key, provider);
    const contract = readContract.connect(wallet);
    let atomReceipt = null;
    let atomValue = 0n;

    if (missingAtoms.length) {
        const atomData = missingAtoms.map(atom => ethers.toUtf8Bytes(atom.data));
        const atomAssets = missingAtoms.map(atom => atom.asset);
        atomValue = atomAssets.reduce((sum, asset) => sum + asset, 0n);
        const expectedAtomIds = await contract.createAtoms.staticCall(atomData, atomAssets, { value: atomValue });
        const expectedAtomIdSet = new Set(expectedAtomIds.map(String));
        for (const atom of missingAtoms) {
            if (!expectedAtomIdSet.has(atom.atomId)) {
                throw new Error(`createAtoms static call missing expected ${atom.label}: ${atom.atomId}`);
            }
        }
        const gasEstimate = await contract.createAtoms.estimateGas(atomData, atomAssets, { value: atomValue });
        const tx = await contract.createAtoms(atomData, atomAssets, {
            value: atomValue,
            gasLimit: gasEstimate + (gasEstimate / 5n),
        });
        atomReceipt = await tx.wait();
        if (atomReceipt.status !== 1) throw new Error(`canonical atom transaction failed: ${tx.hash}`);
        for (const atom of missingAtoms) atom.exists = true;
    }

    const subjects = missingTriples.map(triple => triple.subject);
    const predicates = missingTriples.map(triple => triple.predicate);
    const objects = missingTriples.map(triple => triple.object);
    const assets = missingTriples.map(triple => triple.asset);
    const value = assets.reduce((sum, asset) => sum + asset, 0n);

    let expectedIds = [];
    let tx = null;
    let receipt = null;
    if (missingTriples.length) {
        expectedIds = await contract.createTriples.staticCall(subjects, predicates, objects, assets, { value });
        const gasEstimate = await contract.createTriples.estimateGas(subjects, predicates, objects, assets, { value });
        tx = await contract.createTriples(subjects, predicates, objects, assets, {
            value,
            gasLimit: gasEstimate + (gasEstimate / 5n),
        });
        receipt = await tx.wait();
        if (receipt.status !== 1) throw new Error(`canonical triple transaction failed: ${tx.hash}`);
    }

    const balanceAfter = await provider.getBalance(wallet.address);
    for (const atom of missingAtoms) {
        if (!await getAtomExists(readContract, atom.atomId)) {
            throw new Error(`published transaction missing atom ${atom.label}: ${atom.atomId}`);
        }
    }
    for (const triple of missingTriples) {
        if (!await getTripleExists(readContract, triple.tripleId)) {
            throw new Error(`published transaction missing triple ${triple.label}: ${triple.tripleId}`);
        }
        triple.exists = true;
    }

    updateAssessmentSourceAfterCanonicalPublish(setupState, plan, {
        atomReceipt,
        tripleReceipt: receipt,
        balanceAfter,
        atomValue,
        tripleValue: value,
    });
    writeSetupState(setupState);

    return {
        ok: true,
        dryRun: false,
        executor: wallet.address,
        atomHash: atomReceipt?.hash || null,
        hash: tx?.hash || null,
        blockNumber: receipt?.blockNumber || null,
        gasUsed: receipt?.gasUsed?.toString() || null,
        expectedIds: expectedIds.map(String),
        balanceAfterTrust: ethers.formatEther(balanceAfter),
        ...summarizePlan(plan),
    };
}

async function pinMappedAssessmentSources() {
    const apiKey = intuition.readIntuitionApiKey();
    if (!apiKey) throw new Error('Missing Intuition API key. Expected ~/.config/helixa/intuition.env or INTUITION_API_KEY.');

    const setupState = readSetupState();
    const mappings = intuition.loadConfiguredCanonical8004Mappings(setupState);
    const results = [];

    for (const mapping of mappings) {
        const existing = maybeFindAssessmentSource(setupState, mapping.canonicalChainId, mapping.canonicalTokenId);
        if (existing?.uri) {
            results.push({
                ok: true,
                skipped: true,
                canonicalChainId: mapping.canonicalChainId,
                canonicalTokenId: mapping.canonicalTokenId,
                helixaTokenId: mapping.helixaTokenId,
                name: existing.name,
                uri: existing.uri,
                resolver: existing.resolver,
            });
            continue;
        }

        const result = await intuition.pinThing(
            intuition.buildAssessmentSourceThing({
                chainId: mapping.canonicalChainId,
                tokenId: mapping.canonicalTokenId,
                publicBaseUrl: process.env.PUBLIC_BASE_URL || 'https://api.helixa.xyz',
            }),
            { apiKey },
        );
        const source = upsertAssessmentSource(setupState, {
            canonicalChainId: mapping.canonicalChainId,
            canonicalTokenId: mapping.canonicalTokenId,
            helixaTokenId: mapping.helixaTokenId,
            name: result.thing.name,
            uri: result.uri,
            resolver: result.thing.url,
        });
        results.push({
            ok: true,
            skipped: false,
            canonicalChainId: source.canonicalChainId,
            canonicalTokenId: source.canonicalTokenId,
            helixaTokenId: source.helixaTokenId,
            name: source.name,
            uri: source.uri,
            resolver: source.resolver,
        });
    }

    writeSetupState(setupState);
    return { ok: true, results };
}

async function publishCanonicalBatch({ dryRun }) {
    const setupState = readSetupState();
    const terms = intuition.INTUITION_TERMS.mainnet;
    const provider = new ethers.JsonRpcProvider(terms.rpcUrl, terms.chainId);
    const readContract = new ethers.Contract(terms.multiVault, MULTIVAULT_ABI, provider);
    const plans = [];
    for (const source of setupState.assessmentSources || []) {
        plans.push(await buildCanonicalTriplePlan({
            setupState,
            chainId: source.canonicalChainId,
            tokenId: source.canonicalTokenId,
            contract: readContract,
        }));
    }

    const missingAtoms = dedupeBy(
        plans.flatMap(plan => plan.atoms.filter(atom => atom.createIfMissing && !atom.exists)),
        atom => atom.atomId,
    );
    const missingTriples = dedupeBy(
        plans.flatMap(plan => plan.triples.filter(triple => !triple.exists)),
        triple => triple.tripleId,
    );
    const atomValue = missingAtoms.reduce((sum, atom) => sum + atom.asset, 0n);
    const tripleValue = missingTriples.reduce((sum, triple) => sum + triple.asset, 0n);

    if (dryRun || (!missingAtoms.length && !missingTriples.length)) {
        return {
            ok: true,
            dryRun: true,
            skipped: !missingAtoms.length && !missingTriples.length,
            missingAtomCount: missingAtoms.length,
            missingTripleCount: missingTriples.length,
            atomValueTrust: ethers.formatEther(atomValue),
            tripleValueTrust: ethers.formatEther(tripleValue),
            totalValueTrust: ethers.formatEther(atomValue + tripleValue),
            plans: plans.map(summarizePlan),
        };
    }

    const key = await readDeployerKey();
    const wallet = new ethers.Wallet(key, provider);
    const contract = readContract.connect(wallet);
    const balanceBefore = await provider.getBalance(wallet.address);
    if (balanceBefore < atomValue + tripleValue) {
        throw new Error(`insufficient TRUST balance: have ${ethers.formatEther(balanceBefore)}, need ${ethers.formatEther(atomValue + tripleValue)}`);
    }

    let atomReceipt = null;
    if (missingAtoms.length) {
        const atomData = missingAtoms.map(atom => ethers.toUtf8Bytes(atom.data));
        const atomAssets = missingAtoms.map(atom => atom.asset);
        const expectedAtomIds = await contract.createAtoms.staticCall(atomData, atomAssets, { value: atomValue });
        const expectedAtomIdSet = new Set(expectedAtomIds.map(String));
        for (const atom of missingAtoms) {
            if (!expectedAtomIdSet.has(atom.atomId)) {
                throw new Error(`createAtoms static call missing expected ${atom.label}: ${atom.atomId}`);
            }
        }
        const gasEstimate = await contract.createAtoms.estimateGas(atomData, atomAssets, { value: atomValue });
        const tx = await contract.createAtoms(atomData, atomAssets, {
            value: atomValue,
            gasLimit: gasEstimate + (gasEstimate / 5n),
        });
        atomReceipt = await tx.wait();
        if (atomReceipt.status !== 1) throw new Error(`canonical atom transaction failed: ${tx.hash}`);
        for (const atom of missingAtoms) atom.exists = true;
    }

    let tripleReceipt = null;
    let expectedIds = [];
    if (missingTriples.length) {
        const subjects = missingTriples.map(triple => triple.subject);
        const predicates = missingTriples.map(triple => triple.predicate);
        const objects = missingTriples.map(triple => triple.object);
        const assets = missingTriples.map(triple => triple.asset);
        expectedIds = await contract.createTriples.staticCall(subjects, predicates, objects, assets, { value: tripleValue });
        const gasEstimate = await contract.createTriples.estimateGas(subjects, predicates, objects, assets, { value: tripleValue });
        const tx = await contract.createTriples(subjects, predicates, objects, assets, {
            value: tripleValue,
            gasLimit: gasEstimate + (gasEstimate / 5n),
        });
        tripleReceipt = await tx.wait();
        if (tripleReceipt.status !== 1) throw new Error(`canonical triple transaction failed: ${tx.hash}`);
        for (const triple of missingTriples) triple.exists = true;
    }

    const balanceAfter = await provider.getBalance(wallet.address);
    for (const atom of missingAtoms) {
        if (!await getAtomExists(readContract, atom.atomId)) {
            throw new Error(`published transaction missing atom ${atom.label}: ${atom.atomId}`);
        }
    }
    for (const triple of missingTriples) {
        if (!await getTripleExists(readContract, triple.tripleId)) {
            throw new Error(`published transaction missing triple ${triple.label}: ${triple.tripleId}`);
        }
    }

    const touchedPlanKeys = new Set([
        ...missingAtoms.map(atom => atom.atomId),
        ...missingTriples.map(triple => triple.tripleId),
    ]);
    const publishedPlans = plans.filter(plan => (
        plan.atoms.some(atom => touchedPlanKeys.has(atom.atomId))
        || plan.triples.some(triple => touchedPlanKeys.has(triple.tripleId))
    ));
    for (const plan of publishedPlans) {
        updateAssessmentSourceAfterCanonicalPublish(setupState, plan, {
            atomReceipt,
            tripleReceipt,
            balanceAfter,
            atomValue: plan.atoms
                .filter(atom => missingAtoms.some(missing => missing.atomId === atom.atomId))
                .reduce((sum, atom) => sum + atom.asset, 0n),
            tripleValue: plan.triples
                .filter(triple => missingTriples.some(missing => missing.tripleId === triple.tripleId))
                .reduce((sum, triple) => sum + triple.asset, 0n),
        });
    }
    setupState.lastCanonicalBatchPublish = {
        publishedAt: new Date().toISOString(),
        atomTransactionHash: atomReceipt?.hash || null,
        tripleTransactionHash: tripleReceipt?.hash || null,
        atomCount: missingAtoms.length,
        tripleCount: missingTriples.length,
        totalProtocolCostTrust: ethers.formatEther(atomValue + tripleValue),
        balanceAfterTrust: ethers.formatEther(balanceAfter),
    };
    writeSetupState(setupState);

    return {
        ok: true,
        dryRun: false,
        executor: wallet.address,
        atomHash: atomReceipt?.hash || null,
        atomBlockNumber: atomReceipt?.blockNumber || null,
        tripleHash: tripleReceipt?.hash || null,
        tripleBlockNumber: tripleReceipt?.blockNumber || null,
        expectedIds: expectedIds.map(String),
        balanceBeforeTrust: ethers.formatEther(balanceBefore),
        balanceAfterTrust: ethers.formatEther(balanceAfter),
        atomValueTrust: ethers.formatEther(atomValue),
        tripleValueTrust: ethers.formatEther(tripleValue),
        totalValueTrust: ethers.formatEther(atomValue + tripleValue),
        publishedSources: publishedPlans.map(plan => ({
            canonicalChainId: plan.source.canonicalChainId,
            canonicalTokenId: plan.source.canonicalTokenId,
            helixaTokenId: plan.source.helixaTokenId,
            name: plan.source.name,
            atomId: plan.terms.agentAtom,
            assessmentSourceAtomId: plan.terms.sourceAtom,
            tripleIds: plan.triples.map(triple => triple.tripleId),
        })),
    };
}

function requiredAgentIdentities(setupState) {
    const identities = Array.isArray(setupState.agentIdentities) ? setupState.agentIdentities : [];
    if (!identities.length) throw new Error('Missing agentIdentities in Intuition setup state');
    return identities;
}

function validateAgentIdentityPayload(identity) {
    const payload = identity?.payload || {};
    for (const key of ['name', 'description', 'image', 'url']) {
        if (typeof payload[key] !== 'string' || !payload[key]) {
            throw new Error(`Missing agent identity payload ${key} for ERC-8004 agent ${identity?.canonicalChainId}:${identity?.canonicalTokenId}`);
        }
    }
    return {
        name: payload.name,
        description: payload.description,
        image: payload.image,
        url: payload.url,
    };
}

async function pinStableThing(thing, options = {}) {
    const first = await intuition.pinThing(thing, options);
    const second = await intuition.pinThing(thing, options);
    if (first.uri !== second.uri) {
        throw new Error(`pinThing returned non-deterministic URIs for ${thing.name}: ${first.uri} !== ${second.uri}`);
    }
    return first;
}

async function pinAgentIdentities() {
    const apiKey = intuition.readIntuitionApiKey();
    if (!apiKey) throw new Error('Missing Intuition API key. Expected ~/.config/helixa/intuition.env or INTUITION_API_KEY.');

    const setupState = readSetupState();
    const identities = requiredAgentIdentities(setupState);
    const results = [];

    for (const identity of identities) {
        const payload = validateAgentIdentityPayload(identity);
        const identityPin = await pinStableThing(payload, { apiKey });
        if (identity.identityUri && identity.identityUri !== identityPin.uri) {
            throw new Error(`Pinned identity URI changed for ${identity.canonicalChainId}:${identity.canonicalTokenId}: ${identity.identityUri} !== ${identityPin.uri}`);
        }

        const caipPayload = intuition.buildCaipIdentityThing({
            chainId: identity.canonicalChainId,
            tokenId: identity.canonicalTokenId,
        });
        const caipPin = await pinStableThing(caipPayload, {
            apiKey,
            allowEmptyImageUrl: true,
        });
        if (identity.caipUri && identity.caipUri !== caipPin.uri) {
            throw new Error(`Pinned CAIP URI changed for ${identity.canonicalChainId}:${identity.canonicalTokenId}: ${identity.caipUri} !== ${caipPin.uri}`);
        }

        identity.identityUri = identityPin.uri;
        identity.caipPayload = caipPayload;
        identity.caipUri = caipPin.uri;
        results.push({
            ok: true,
            canonicalChainId: identity.canonicalChainId,
            canonicalTokenId: identity.canonicalTokenId,
            helixaTokenId: identity.helixaTokenId,
            name: payload.name,
            identityUri: identity.identityUri,
            caipUri: identity.caipUri,
        });
    }

    writeSetupState(setupState);
    return { ok: true, results };
}

async function buildAgentIdentityPlan({ setupState, identity, contract }) {
    const source = findAssessmentSource(setupState, identity.canonicalChainId, identity.canonicalTokenId);
    const payload = validateAgentIdentityPayload(identity);
    const providerUri = setupState?.provider?.uri;
    if (!providerUri) throw new Error('Missing provider.uri in Intuition setup state');
    if (!source.uri) throw new Error(`Missing assessment source URI for ERC-8004 agent ${identity.canonicalChainId}:${identity.canonicalTokenId}`);
    if (!identity.identityUri) throw new Error(`Missing pinned identity URI for ERC-8004 agent ${identity.canonicalChainId}:${identity.canonicalTokenId}`);
    if (!identity.caipUri) throw new Error(`Missing pinned CAIP URI for ERC-8004 agent ${identity.canonicalChainId}:${identity.canonicalTokenId}`);

    const terms = intuition.INTUITION_TERMS.mainnet;
    const identityAtom = await contract.calculateAtomId(ethers.toUtf8Bytes(identity.identityUri));
    const caipAtom = await contract.calculateAtomId(ethers.toUtf8Bytes(identity.caipUri));
    const providerAtom = await contract.calculateAtomId(ethers.toUtf8Bytes(providerUri));
    const sourceAtom = await contract.calculateAtomId(ethers.toUtf8Bytes(source.uri));
    const atomCost = await contract.getAtomCost();
    const tripleCost = await contract.getTripleCost();
    const generalConfig = await contract.getGeneralConfig();
    const assetPerAtom = atomCost + generalConfig.minDeposit;
    const assetPerTriple = tripleCost + generalConfig.minDeposit;

    const triples = [
        {
            label: 'same as',
            subject: identityAtom,
            predicate: terms.sameAs,
            object: caipAtom,
        },
        {
            label: 'agent has type',
            subject: identityAtom,
            predicate: terms.hasType,
            object: terms.aiAgent,
        },
        {
            label: 'implement',
            subject: identityAtom,
            predicate: terms.implement,
            object: terms.erc8004,
        },
        {
            label: 'has trust provider',
            subject: identityAtom,
            predicate: terms.hasTrustProvider,
            object: providerAtom,
        },
        {
            label: 'has trust assessment',
            subject: identityAtom,
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
            label: 'assessment source has type',
            subject: sourceAtom,
            predicate: terms.hasType,
            object: terms.trustAssessmentSource,
        },
    ];

    const atoms = [
        { label: 'agent identity', atomId: identityAtom, data: identity.identityUri, createIfMissing: true },
        { label: 'CAIP identity', atomId: caipAtom, data: identity.caipUri, createIfMissing: true },
        { label: 'Helixa Cred provider', atomId: providerAtom, data: providerUri, createIfMissing: false },
        { label: 'assessment source', atomId: sourceAtom, data: source.uri, createIfMissing: false },
        { label: 'same as', atomId: terms.sameAs, createIfMissing: false },
        { label: 'has trust provider', atomId: terms.hasTrustProvider, createIfMissing: false },
        { label: 'has trust assessment', atomId: terms.hasTrustAssessment, createIfMissing: false },
        { label: 'provided by', atomId: terms.providedBy, createIfMissing: false },
        { label: 'has type', atomId: terms.hasType, createIfMissing: false },
        { label: 'AIAgent', atomId: terms.aiAgent, createIfMissing: false },
        { label: 'implement', atomId: terms.implement, createIfMissing: false },
        { label: 'ERC-8004', atomId: terms.erc8004, createIfMissing: false },
        { label: 'Trust Assessment Source', atomId: terms.trustAssessmentSource, createIfMissing: false },
    ];
    for (const atom of atoms) {
        atom.exists = await getAtomExists(contract, atom.atomId);
        atom.asset = assetPerAtom;
        if (!atom.exists && !atom.createIfMissing) {
            throw new Error(`Missing required Intuition atom for ${atom.label}: ${atom.atomId}`);
        }
    }

    for (const triple of triples) {
        triple.tripleId = await contract.calculateTripleId(triple.subject, triple.predicate, triple.object);
        triple.exists = await getTripleExists(contract, triple.tripleId);
        triple.asset = assetPerTriple;
    }

    return {
        source,
        identity,
        payload,
        terms: {
            identityAtom,
            caipAtom,
            providerAtom,
            sourceAtom,
        },
        atoms,
        atomCost,
        triples,
        tripleCost,
        minDeposit: generalConfig.minDeposit,
        assetPerAtom,
        assetPerTriple,
    };
}

function summarizeAgentIdentityPlan(plan) {
    return {
        source: {
            canonicalChainId: plan.source.canonicalChainId,
            canonicalTokenId: plan.source.canonicalTokenId,
            helixaTokenId: plan.source.helixaTokenId,
        },
        name: plan.payload.name,
        identityUri: plan.identity.identityUri,
        caipUri: plan.identity.caipUri,
        terms: plan.terms,
        atomCostTrust: ethers.formatEther(plan.atomCost),
        tripleCostTrust: ethers.formatEther(plan.tripleCost),
        minDepositTrust: ethers.formatEther(plan.minDeposit),
        assetPerAtomTrust: ethers.formatEther(plan.assetPerAtom),
        assetPerTripleTrust: ethers.formatEther(plan.assetPerTriple),
        totalAtomValueTrust: ethers.formatEther(plan.atoms
            .filter(atom => atom.createIfMissing && !atom.exists)
            .reduce((sum, atom) => sum + atom.asset, 0n)),
        totalTripleValueTrust: ethers.formatEther(plan.triples
            .filter(triple => !triple.exists)
            .reduce((sum, triple) => sum + triple.asset, 0n)),
        atoms: plan.atoms.map(atom => ({
            label: atom.label,
            atomId: atom.atomId,
            data: atom.data || null,
            createIfMissing: atom.createIfMissing,
            exists: atom.exists,
        })),
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

function buildAgentIdentityStatus({ plan, atomReceipt, tripleReceipt, balanceAfter, atomValue, tripleValue }) {
    const canonicalTerms = {
        agent: plan.terms.identityAtom,
        caip: plan.terms.caipAtom,
        provider: plan.terms.providerAtom,
        assessmentSource: plan.terms.sourceAtom,
        aiAgent: intuition.INTUITION_TERMS.mainnet.aiAgent,
        erc8004: intuition.INTUITION_TERMS.mainnet.erc8004,
        trustAssessmentSource: intuition.INTUITION_TERMS.mainnet.trustAssessmentSource,
    };
    const triples = plan.triples.map(triple => ({
        predicate: triple.label,
        tripleId: triple.tripleId,
        subject: triple.subject,
        predicateTermId: triple.predicate,
        object: triple.object,
    }));

    return {
        status: 'published',
        publishedAt: new Date().toISOString(),
        atomTransactionHash: atomReceipt?.hash || plan.identity.onchainStatus?.atomTransactionHash || null,
        atomBlockNumber: atomReceipt?.blockNumber || plan.identity.onchainStatus?.atomBlockNumber || null,
        atomGasUsed: atomReceipt?.gasUsed?.toString() || plan.identity.onchainStatus?.atomGasUsed || null,
        tripleTransactionHash: tripleReceipt?.hash || plan.identity.onchainStatus?.tripleTransactionHash || null,
        tripleBlockNumber: tripleReceipt?.blockNumber || plan.identity.onchainStatus?.tripleBlockNumber || null,
        tripleGasUsed: tripleReceipt?.gasUsed?.toString() || plan.identity.onchainStatus?.tripleGasUsed || null,
        atomProtocolCostTrust: ethers.formatEther(atomValue || 0n),
        tripleProtocolCostTrust: ethers.formatEther(tripleValue || 0n),
        balanceAfterTrust: ethers.formatEther(balanceAfter),
        identityUri: plan.identity.identityUri,
        caipUri: plan.identity.caipUri,
        canonicalTerms,
        triples: triples.map(triple => ({
            predicate: triple.predicate,
            termId: triple.predicateTermId,
            tripleId: triple.tripleId,
        })),
        canonicalTriples: triples,
        note: 'Human-readable ERC-8004 identity atom, CAIP object atom, same-as link, classification edges, and identity-subject trust edges are published.',
    };
}

function updateAgentIdentityAfterPublish(setupState, plan, receipts) {
    const identity = findAgentIdentity(setupState, plan.source);
    if (!identity) throw new Error(`Missing setup state identity for ERC-8004 agent ${plan.source.canonicalChainId}:${plan.source.canonicalTokenId}`);
    identity.onchainStatus = buildAgentIdentityStatus({ plan, ...receipts });

    const source = findPlanSource(setupState, plan);
    if (!source) throw new Error(`Missing setup state source for ERC-8004 agent ${plan.source.canonicalChainId}:${plan.source.canonicalTokenId}`);
    const previousSourceStatus = source.onchainStatus || {};
    const trustPattern = plan.triples.filter(triple => (
        triple.label === 'has trust provider'
        || triple.label === 'has trust assessment'
        || triple.label === 'provided by'
        || triple.label === 'assessment source has type'
    ));
    const canonicalTrustTriples = trustPattern.map(triple => ({
        predicate: triple.label === 'assessment source has type' ? 'has type' : triple.label,
        tripleId: triple.tripleId,
        subject: triple.subject,
        predicateTermId: triple.predicate,
        object: triple.object,
    }));

    source.onchainStatus = {
        ...previousSourceStatus,
        status: 'published',
        publishedAt: identity.onchainStatus.publishedAt,
        tripleTransactionHash: receipts.tripleReceipt?.hash || previousSourceStatus.tripleTransactionHash || null,
        canonicalTripleTransactionHash: receipts.tripleReceipt?.hash || previousSourceStatus.canonicalTripleTransactionHash || null,
        canonicalTripleBlockNumber: receipts.tripleReceipt?.blockNumber || previousSourceStatus.canonicalTripleBlockNumber || null,
        canonicalTripleGasUsed: receipts.tripleReceipt?.gasUsed?.toString() || previousSourceStatus.canonicalTripleGasUsed || null,
        canonicalTripleProtocolCostTrust: ethers.formatEther(receipts.tripleValue || 0n),
        balanceAfterTrust: ethers.formatEther(receipts.balanceAfter),
        canonicalTerms: {
            ...previousSourceStatus.canonicalTerms,
            agent: plan.terms.identityAtom,
            caip: plan.terms.caipAtom,
            provider: plan.terms.providerAtom,
            assessmentSource: plan.terms.sourceAtom,
            trustAssessmentSource: intuition.INTUITION_TERMS.mainnet.trustAssessmentSource,
        },
        triples: canonicalTrustTriples.map(triple => ({
            predicate: triple.predicate,
            termId: triple.predicateTermId,
            tripleId: triple.tripleId,
        })),
        canonicalTriples: canonicalTrustTriples,
        identityLayer: identity.onchainStatus,
        note: 'Assessment-source metadata is pinned. Mainnet Intuition identity atom and canonical identity-subject trust triples are published.',
    };
}

async function publishAgentIdentityBatch({ dryRun }) {
    const setupState = readSetupState();
    const identities = requiredAgentIdentities(setupState);
    const terms = intuition.INTUITION_TERMS.mainnet;
    const provider = new ethers.JsonRpcProvider(terms.rpcUrl, terms.chainId);
    const readContract = new ethers.Contract(terms.multiVault, MULTIVAULT_ABI, provider);
    const plans = [];

    for (const identity of identities) {
        plans.push(await buildAgentIdentityPlan({
            setupState,
            identity,
            contract: readContract,
        }));
    }

    const missingAtoms = dedupeBy(
        plans.flatMap(plan => plan.atoms.filter(atom => atom.createIfMissing && !atom.exists)),
        atom => atom.atomId,
    );
    const missingTriples = dedupeBy(
        plans.flatMap(plan => plan.triples.filter(triple => !triple.exists)),
        triple => triple.tripleId,
    );
    const atomValue = missingAtoms.reduce((sum, atom) => sum + atom.asset, 0n);
    const tripleValue = missingTriples.reduce((sum, triple) => sum + triple.asset, 0n);

    if (dryRun || (!missingAtoms.length && !missingTriples.length)) {
        return {
            ok: true,
            dryRun: true,
            skipped: !missingAtoms.length && !missingTriples.length,
            missingAtomCount: missingAtoms.length,
            missingTripleCount: missingTriples.length,
            atomValueTrust: ethers.formatEther(atomValue),
            tripleValueTrust: ethers.formatEther(tripleValue),
            totalValueTrust: ethers.formatEther(atomValue + tripleValue),
            plans: plans.map(summarizeAgentIdentityPlan),
        };
    }

    const key = await readDeployerKey();
    const wallet = new ethers.Wallet(key, provider);
    const contract = readContract.connect(wallet);
    const balanceBefore = await provider.getBalance(wallet.address);
    if (balanceBefore < atomValue + tripleValue) {
        throw new Error(`insufficient TRUST balance: have ${ethers.formatEther(balanceBefore)}, need ${ethers.formatEther(atomValue + tripleValue)}`);
    }

    let atomReceipt = null;
    if (missingAtoms.length) {
        const atomData = missingAtoms.map(atom => ethers.toUtf8Bytes(atom.data));
        const atomAssets = missingAtoms.map(atom => atom.asset);
        const expectedAtomIds = await contract.createAtoms.staticCall(atomData, atomAssets, { value: atomValue });
        const expectedAtomIdSet = new Set(expectedAtomIds.map(String));
        for (const atom of missingAtoms) {
            if (!expectedAtomIdSet.has(atom.atomId)) {
                throw new Error(`createAtoms static call missing expected ${atom.label}: ${atom.atomId}`);
            }
        }
        const gasEstimate = await contract.createAtoms.estimateGas(atomData, atomAssets, { value: atomValue });
        const tx = await contract.createAtoms(atomData, atomAssets, {
            value: atomValue,
            gasLimit: gasEstimate + (gasEstimate / 5n),
        });
        atomReceipt = await tx.wait();
        if (atomReceipt.status !== 1) throw new Error(`agent identity atom transaction failed: ${tx.hash}`);
        for (const atom of missingAtoms) atom.exists = true;
    }

    let tripleReceipt = null;
    let expectedIds = [];
    if (missingTriples.length) {
        const subjects = missingTriples.map(triple => triple.subject);
        const predicates = missingTriples.map(triple => triple.predicate);
        const objects = missingTriples.map(triple => triple.object);
        const assets = missingTriples.map(triple => triple.asset);
        expectedIds = await contract.createTriples.staticCall(subjects, predicates, objects, assets, { value: tripleValue });
        const gasEstimate = await contract.createTriples.estimateGas(subjects, predicates, objects, assets, { value: tripleValue });
        const tx = await contract.createTriples(subjects, predicates, objects, assets, {
            value: tripleValue,
            gasLimit: gasEstimate + (gasEstimate / 5n),
        });
        tripleReceipt = await tx.wait();
        if (tripleReceipt.status !== 1) throw new Error(`agent identity triple transaction failed: ${tx.hash}`);
        for (const triple of missingTriples) triple.exists = true;
    }

    const balanceAfter = await provider.getBalance(wallet.address);
    for (const atom of missingAtoms) {
        if (!await getAtomExists(readContract, atom.atomId)) {
            throw new Error(`published transaction missing atom ${atom.label}: ${atom.atomId}`);
        }
    }
    for (const triple of missingTriples) {
        if (!await getTripleExists(readContract, triple.tripleId)) {
            throw new Error(`published transaction missing triple ${triple.label}: ${triple.tripleId}`);
        }
    }

    const touchedPlanKeys = new Set([
        ...missingAtoms.map(atom => atom.atomId),
        ...missingTriples.map(triple => triple.tripleId),
    ]);
    const publishedPlans = plans.filter(plan => (
        plan.atoms.some(atom => touchedPlanKeys.has(atom.atomId))
        || plan.triples.some(triple => touchedPlanKeys.has(triple.tripleId))
    ));
    for (const plan of publishedPlans) {
        updateAgentIdentityAfterPublish(setupState, plan, {
            atomReceipt,
            tripleReceipt,
            balanceAfter,
            atomValue: plan.atoms
                .filter(atom => missingAtoms.some(missing => missing.atomId === atom.atomId))
                .reduce((sum, atom) => sum + atom.asset, 0n),
            tripleValue: plan.triples
                .filter(triple => missingTriples.some(missing => missing.tripleId === triple.tripleId))
                .reduce((sum, triple) => sum + triple.asset, 0n),
        });
    }
    setupState.lastAgentIdentityBatchPublish = {
        publishedAt: new Date().toISOString(),
        atomTransactionHash: atomReceipt?.hash || null,
        tripleTransactionHash: tripleReceipt?.hash || null,
        atomCount: missingAtoms.length,
        tripleCount: missingTriples.length,
        totalProtocolCostTrust: ethers.formatEther(atomValue + tripleValue),
        balanceAfterTrust: ethers.formatEther(balanceAfter),
    };
    writeSetupState(setupState);

    return {
        ok: true,
        dryRun: false,
        executor: wallet.address,
        atomHash: atomReceipt?.hash || null,
        atomBlockNumber: atomReceipt?.blockNumber || null,
        tripleHash: tripleReceipt?.hash || null,
        tripleBlockNumber: tripleReceipt?.blockNumber || null,
        expectedIds: expectedIds.map(String),
        balanceBeforeTrust: ethers.formatEther(balanceBefore),
        balanceAfterTrust: ethers.formatEther(balanceAfter),
        atomValueTrust: ethers.formatEther(atomValue),
        tripleValueTrust: ethers.formatEther(tripleValue),
        totalValueTrust: ethers.formatEther(atomValue + tripleValue),
        publishedIdentities: publishedPlans.map(plan => ({
            canonicalChainId: plan.source.canonicalChainId,
            canonicalTokenId: plan.source.canonicalTokenId,
            helixaTokenId: plan.source.helixaTokenId,
            name: plan.payload.name,
            identityAtomId: plan.terms.identityAtom,
            caipAtomId: plan.terms.caipAtom,
            identityUri: plan.identity.identityUri,
            caipUri: plan.identity.caipUri,
            tripleIds: plan.triples.map(triple => triple.tripleId),
        })),
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
        const setupState = readSetupState();
        const source = upsertAssessmentSource(setupState, {
            canonicalChainId: mapping.canonicalChainId,
            canonicalTokenId: mapping.canonicalTokenId,
            helixaTokenId: mapping.helixaTokenId,
            name: result.thing.name,
            uri: result.uri,
            resolver: result.thing.url,
        });
        writeSetupState(setupState);
        console.log(JSON.stringify({
            ok: true,
            type: 'assessment-source',
            canonicalChainId: source.canonicalChainId,
            canonicalTokenId: source.canonicalTokenId,
            helixaTokenId: source.helixaTokenId,
            name: source.name,
            uri: source.uri,
            resolver: source.resolver,
        }, null, 2));
        return;
    }

    if (command === '--pin-mapped-assessment-sources') {
        const result = await pinMappedAssessmentSources();
        console.log(JSON.stringify(result, null, 2));
        return;
    }

    if (command === '--publish-canonical-triples') {
        const result = await publishCanonicalTriples({ chainId, tokenId, dryRun });
        console.log(JSON.stringify(result, null, 2));
        return;
    }

    if (command === '--publish-canonical-batch') {
        const result = await publishCanonicalBatch({ dryRun });
        console.log(JSON.stringify(result, null, 2));
        return;
    }

    if (command === '--pin-agent-identities') {
        const result = await pinAgentIdentities();
        console.log(JSON.stringify(result, null, 2));
        return;
    }

    if (command === '--publish-agent-identity-batch') {
        const result = await publishAgentIdentityBatch({ dryRun });
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
