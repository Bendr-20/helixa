/**
 * Helixa Solana Aura Minter — Compressed NFTs via Metaplex Bubblegum
 * Uses cNFTs for cheap mints on Solana (devnet by default).
 */

const fs = require('fs');
const path = require('path');

const KEYPAIR_PATH = path.join(require('os').homedir(), '.config/helixa/solana-deployer.json');
const TREE_PATH = path.join(require('os').homedir(), '.config/helixa/solana-tree.json');

const NETWORK = process.env.SOLANA_NETWORK || 'devnet';
const RPC_URL = process.env.SOLANA_RPC || (NETWORK === 'mainnet-beta'
    ? 'https://api.mainnet-beta.solana.com'
    : 'https://api.devnet.solana.com');

const COLLECTION_NAME = 'Helixa Agent Auras';
const SYMBOL = 'HAURA';

let _umi = null;
let _treeAddress = null;
let _mintCount = 0;

/**
 * Initialize Solana UMI instance with keypair.
 * Creates a new keypair if none exists.
 */
async function initSolana() {
    if (_umi) return _umi;

    const { createUmi } = require('@metaplex-foundation/umi-bundle-defaults');
    const { mplBubblegum } = require('@metaplex-foundation/mpl-bubblegum');
    const { mplTokenMetadata } = require('@metaplex-foundation/mpl-token-metadata');
    const { keypairIdentity, generateSigner } = require('@metaplex-foundation/umi');

    const umi = createUmi(RPC_URL)
        .use(mplBubblegum())
        .use(mplTokenMetadata());

    // Load or create keypair
    let keypairData;
    if (fs.existsSync(KEYPAIR_PATH)) {
        keypairData = JSON.parse(fs.readFileSync(KEYPAIR_PATH, 'utf8'));
        console.log('[Solana] Loaded existing keypair');
    } else {
        // Generate new keypair and save
        const { generateSigner: genSigner } = require('@metaplex-foundation/umi');
        const signer = genSigner(umi);
        // Convert to saveable format (secret key as array)
        keypairData = {
            publicKey: signer.publicKey.toString(),
            secretKey: Array.from(signer.secretKey),
        };
        fs.mkdirSync(path.dirname(KEYPAIR_PATH), { recursive: true });
        fs.writeFileSync(KEYPAIR_PATH, JSON.stringify(keypairData, null, 2));
        console.log(`[Solana] Generated new keypair: ${keypairData.publicKey}`);
    }

    // Create UMI keypair from saved data
    const { createSignerFromKeypair } = require('@metaplex-foundation/umi');
    const umiKeypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(keypairData.secretKey));
    const signer = createSignerFromKeypair(umi, umiKeypair);
    umi.use(keypairIdentity(signer));

    _umi = umi;

    // Load saved tree address
    if (fs.existsSync(TREE_PATH)) {
        const treeData = JSON.parse(fs.readFileSync(TREE_PATH, 'utf8'));
        _treeAddress = treeData.treeAddress;
        _mintCount = treeData.mintCount || 0;
        console.log(`[Solana] Loaded merkle tree: ${_treeAddress} (${_mintCount} minted)`);
    }

    console.log(`[Solana] Initialized on ${NETWORK} — pubkey: ${signer.publicKey}`);
    return umi;
}

/**
 * Create a Bubblegum merkle tree (one-time setup).
 * Max depth 14, max buffer 64 → supports ~16K mints.
 */
async function createMerkleTree() {
    const umi = await initSolana();

    if (_treeAddress) {
        console.log(`[Solana] Tree already exists: ${_treeAddress}`);
        return _treeAddress;
    }

    const { generateSigner: genSigner } = require('@metaplex-foundation/umi');
    const { createTree } = require('@metaplex-foundation/mpl-bubblegum');

    const merkleTree = genSigner(umi);

    console.log('[Solana] Creating merkle tree (depth=14, buffer=64)...');
    const tx = await createTree(umi, {
        merkleTree,
        maxDepth: 14,
        maxBufferSize: 64,
    }).sendAndConfirm(umi);

    _treeAddress = merkleTree.publicKey.toString();

    // Save tree address persistently
    const treeData = {
        treeAddress: _treeAddress,
        network: NETWORK,
        createdAt: new Date().toISOString(),
        signature: Buffer.from(tx.signature).toString('base64'),
        mintCount: 0,
    };
    fs.writeFileSync(TREE_PATH, JSON.stringify(treeData, null, 2));

    console.log(`[Solana] ✅ Merkle tree created: ${_treeAddress}`);
    return _treeAddress;
}

/**
 * Mint a compressed NFT (Aura) to a recipient.
 */
async function mintAura({ name, symbol, uri, recipient }) {
    const umi = await initSolana();

    if (!_treeAddress) {
        throw new Error('Merkle tree not created. Call createMerkleTree() first.');
    }

    const { mintV1 } = require('@metaplex-foundation/mpl-bubblegum');
    const { publicKey } = require('@metaplex-foundation/umi');

    console.log(`[Solana] Minting "${name}" to ${recipient}...`);

    const tx = await mintV1(umi, {
        leafOwner: publicKey(recipient),
        merkleTree: publicKey(_treeAddress),
        metadata: {
            name: name || COLLECTION_NAME,
            symbol: symbol || SYMBOL,
            uri: uri || '',
            sellerFeeBasisPoints: 0,
            collection: null,
            creators: [
                {
                    address: umi.identity.publicKey,
                    verified: false,
                    share: 100,
                },
            ],
        },
    }).sendAndConfirm(umi);

    _mintCount++;

    // Update mint count in tree file
    try {
        const treeData = JSON.parse(fs.readFileSync(TREE_PATH, 'utf8'));
        treeData.mintCount = _mintCount;
        fs.writeFileSync(TREE_PATH, JSON.stringify(treeData, null, 2));
    } catch {}

    const signature = Buffer.from(tx.signature).toString('base64');
    // Convert to base58 for explorer links
    let signatureB58;
    try {
        const bs58 = require('bs58');
        signatureB58 = bs58.encode(tx.signature);
    } catch {
        signatureB58 = signature; // fallback
    }

    console.log(`[Solana] ✅ Minted! Sig: ${signatureB58}`);

    return {
        signature: signatureB58,
        network: NETWORK,
        explorer: NETWORK === 'devnet'
            ? `https://solscan.io/tx/${signatureB58}?cluster=devnet`
            : `https://solscan.io/tx/${signatureB58}`,
    };
}

/**
 * Fetch cNFT metadata via DAS (Digital Asset Standard) API.
 */
async function getAuraMetadata(assetId) {
    const response = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getAsset',
            params: { id: assetId },
        }),
    });

    const data = await response.json();
    if (data.error) {
        throw new Error(`DAS API error: ${data.error.message}`);
    }
    return data.result;
}

/**
 * Get deployer public key.
 */
function getPublicKey() {
    if (fs.existsSync(KEYPAIR_PATH)) {
        const kp = JSON.parse(fs.readFileSync(KEYPAIR_PATH, 'utf8'));
        return kp.publicKey;
    }
    return null;
}

/**
 * Get status info.
 */
function getStatus() {
    return {
        network: NETWORK,
        rpc: RPC_URL,
        initialized: !!_umi,
        treeAddress: _treeAddress,
        mintCount: _mintCount,
        publicKey: getPublicKey(),
        collection: COLLECTION_NAME,
        symbol: SYMBOL,
    };
}

module.exports = {
    initSolana,
    createMerkleTree,
    mintAura,
    getAuraMetadata,
    getPublicKey,
    getStatus,
    NETWORK,
    RPC_URL,
    COLLECTION_NAME,
    SYMBOL,
};
