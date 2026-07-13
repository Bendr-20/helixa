#!/usr/bin/env node
const intuition = require('../services/intuition-erc8004');

function printUsage() {
    console.log(`Usage:
  node api/scripts/intuition-8004-setup.js --pin-provider
  node api/scripts/intuition-8004-setup.js --pin-assessment-source <chainId> <canonicalTokenId>

Environment:
  INTUITION_API_KEY or INTUITION_PARTNER_API_KEY
  INTUITION_ENV_FILE defaults to ~/.config/helixa/intuition.env`);
}

function parseArgs(argv) {
    const [command, chainId, tokenId] = argv;
    return { command, chainId, tokenId };
}

async function main() {
    const { command, chainId, tokenId } = parseArgs(process.argv.slice(2));
    if (!command || command === '--help' || command === '-h') {
        printUsage();
        return;
    }

    const apiKey = intuition.readIntuitionApiKey();
    if (!apiKey) throw new Error('Missing Intuition API key. Expected ~/.config/helixa/intuition.env or INTUITION_API_KEY.');

    if (command === '--pin-provider') {
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
