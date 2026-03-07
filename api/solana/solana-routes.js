/**
 * Helixa Solana Aura API Routes
 * Express router for Solana cNFT minting, metadata, and cross-chain registry.
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

// Rate limiter for mint endpoint (10/min)
const mintLimiter = (() => {
    const windowMs = 60 * 1000;
    const max = 10;
    const hits = new Map();

    return (req, res, next) => {
        const key = req.ip || req.connection.remoteAddress;
        const now = Date.now();
        const entry = hits.get(key) || { count: 0, resetAt: now + windowMs };

        if (now > entry.resetAt) {
            entry.count = 0;
            entry.resetAt = now + windowMs;
        }

        entry.count++;
        hits.set(key, entry);

        if (entry.count > max) {
            return res.status(429).json({
                error: 'Rate limited',
                message: `Max ${max} mints per minute`,
                retryAfter: Math.ceil((entry.resetAt - now) / 1000),
            });
        }
        next();
    };
})();

// Lazy-load minter (so server starts even if Solana deps missing)
let minter = null;
function getMinter() {
    if (!minter) {
        minter = require('./solana-minter');
    }
    return minter;
}

// SQLite DB for cross-chain registry
let crossChainDb = null;
function getCrossChainDb() {
    if (crossChainDb) return crossChainDb;
    try {
        const Database = require('better-sqlite3');
        const dbPath = path.join(__dirname, '..', '..', '..', 'terminal', 'data', 'terminal.db');
        crossChainDb = new Database(dbPath);
        crossChainDb.pragma('journal_mode = WAL');
        crossChainDb.exec(`CREATE TABLE IF NOT EXISTS cross_chain_registry (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            base_token_id INTEGER,
            solana_asset_id TEXT,
            solana_owner TEXT,
            base_address TEXT,
            linked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(base_token_id, solana_asset_id)
        )`);
        return crossChainDb;
    } catch (e) {
        console.error('[Solana] Cross-chain DB init failed:', e.message);
        return null;
    }
}

// Local mint registry (for metadata serving)
const MINT_REGISTRY_PATH = path.join(__dirname, '..', '..', 'data', 'solana-mints.json');
function loadMintRegistry() {
    try { return JSON.parse(fs.readFileSync(MINT_REGISTRY_PATH, 'utf8')); } catch { return {}; }
}
function saveMintRegistry(reg) {
    fs.mkdirSync(path.dirname(MINT_REGISTRY_PATH), { recursive: true });
    fs.writeFileSync(MINT_REGISTRY_PATH, JSON.stringify(reg, null, 2));
}

// ─── Routes ─────────────────────────────────────────────────────

// GET /api/v2/solana/status
router.get('/api/v2/solana/status', (req, res) => {
    try {
        const m = getMinter();
        const status = m.getStatus();
        const db = getCrossChainDb();
        let crossChainCount = 0;
        if (db) {
            try { crossChainCount = db.prepare('SELECT COUNT(*) as c FROM cross_chain_registry').get().c; } catch {}
        }
        res.json({ ...status, crossChainLinks: crossChainCount });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/v2/solana/metadata/:id — JSON metadata for cNFT
router.get('/api/v2/solana/metadata/:id', (req, res) => {
    try {
        const id = req.params.id;
        const registry = loadMintRegistry();
        const entry = registry[id];

        if (!entry) {
            return res.status(404).json({ error: 'Metadata not found for this ID' });
        }

        res.json({
            name: entry.name || `Helixa Aura #${id}`,
            symbol: entry.symbol || 'HAURA',
            description: `${entry.name || 'Agent'} — Helixa Agent Aura on Solana. Framework: ${entry.framework || 'unknown'}. Cross-chain identity for AI agents.`,
            image: `https://api.helixa.xyz/api/v2/aura/${entry.baseTokenId || id}.png`,
            external_url: `https://helixa.xyz/agent/${entry.baseTokenId || id}`,
            attributes: [
                { trait_type: 'Framework', value: entry.framework || 'custom' },
                { trait_type: 'Chain', value: 'Solana' },
                { trait_type: 'Network', value: entry.network || 'devnet' },
                ...(entry.baseTokenId ? [{ trait_type: 'Base Token ID', value: entry.baseTokenId }] : []),
            ],
            properties: {
                category: 'image',
                creators: [{ address: entry.minterPubkey || '', share: 100 }],
            },
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/v2/solana/mint — Mint an Aura cNFT
router.post('/api/v2/solana/mint', mintLimiter, async (req, res) => {
    try {
        const { name, framework, solanaWallet, baseTokenId } = req.body;

        if (!name || typeof name !== 'string' || name.length < 1 || name.length > 64) {
            return res.status(400).json({ error: 'name required (1-64 chars)' });
        }
        if (!solanaWallet || typeof solanaWallet !== 'string' || solanaWallet.length < 32) {
            return res.status(400).json({ error: 'solanaWallet required (base58 address)' });
        }

        const m = getMinter();
        await m.initSolana();

        // Ensure tree exists
        if (!m.getStatus().treeAddress) {
            await m.createMerkleTree();
        }

        // Generate a mint ID
        const mintId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const metadataUri = `https://api.helixa.xyz/api/v2/solana/metadata/${mintId}`;

        const result = await m.mintAura({
            name: `${name} Aura`,
            symbol: 'HAURA',
            uri: metadataUri,
            recipient: solanaWallet,
        });

        // Save to local registry for metadata serving
        const registry = loadMintRegistry();
        registry[mintId] = {
            name,
            symbol: 'HAURA',
            framework: framework || 'custom',
            solanaWallet,
            baseTokenId: baseTokenId || null,
            network: m.NETWORK,
            signature: result.signature,
            minterPubkey: m.getPublicKey(),
            mintedAt: new Date().toISOString(),
        };
        saveMintRegistry(registry);

        // Cross-chain link if baseTokenId provided
        let crossChain = null;
        if (baseTokenId) {
            const db = getCrossChainDb();
            if (db) {
                try {
                    db.prepare(`INSERT OR REPLACE INTO cross_chain_registry 
                        (base_token_id, solana_asset_id, solana_owner, base_address) 
                        VALUES (?, ?, ?, ?)`).run(
                        baseTokenId, mintId, solanaWallet, req.body.baseAddress || null
                    );
                    crossChain = { baseTokenId };
                } catch (e) {
                    console.error('[Solana] Cross-chain link failed:', e.message);
                }
            }
        }

        res.json({
            success: true,
            mintId,
            signature: result.signature,
            explorer: result.explorer,
            network: result.network,
            metadataUri,
            ...(crossChain ? { crossChain } : {}),
        });
    } catch (e) {
        console.error('[Solana] Mint error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// GET /api/v2/solana/agent/:id — Get Solana agent data
router.get('/api/v2/solana/agent/:id', (req, res) => {
    try {
        const id = req.params.id;

        // Check local registry
        const registry = loadMintRegistry();
        const entry = registry[id];
        if (entry) {
            return res.json({
                mintId: id,
                ...entry,
                metadataUri: `https://api.helixa.xyz/api/v2/solana/metadata/${id}`,
            });
        }

        // Check cross-chain by base token ID
        const db = getCrossChainDb();
        if (db) {
            const row = db.prepare('SELECT * FROM cross_chain_registry WHERE base_token_id = ? OR solana_asset_id = ?').get(id, id);
            if (row) {
                return res.json({
                    crossChain: true,
                    ...row,
                });
            }
        }

        res.status(404).json({ error: 'Solana agent not found' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/v2/solana/crossreg — Register cross-chain pointer
router.post('/api/v2/solana/crossreg', (req, res) => {
    try {
        const { baseTokenId, solanaAssetId, solanaOwner, baseAddress } = req.body;

        if (!baseTokenId && !solanaAssetId) {
            return res.status(400).json({ error: 'baseTokenId or solanaAssetId required' });
        }

        const db = getCrossChainDb();
        if (!db) {
            return res.status(503).json({ error: 'Cross-chain registry unavailable' });
        }

        db.prepare(`INSERT OR REPLACE INTO cross_chain_registry 
            (base_token_id, solana_asset_id, solana_owner, base_address) 
            VALUES (?, ?, ?, ?)`).run(
            baseTokenId || null,
            solanaAssetId || null,
            solanaOwner || null,
            baseAddress || null
        );

        res.json({
            success: true,
            link: { baseTokenId, solanaAssetId, solanaOwner, baseAddress },
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
