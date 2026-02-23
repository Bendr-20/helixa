/**
 * Names Routes
 * Handles name registration and lookups
 */

const express = require('express');
const { readContract } = require('../services/contract');
const { 
    referralRegistry, 
    resolveReferralCode,
    getReferralStats 
} = require('../services/referrals');
const log = require('../utils/logger');

const router = express.Router();

function isContractDeployed() {
    return process.env.V2_CONTRACT && process.env.V2_CONTRACT !== '0x0000000000000000000000000000000000000000';
}

// GET /api/v2/name/:name — Check name availability and resolve
router.get('/:name', async (req, res) => {
    try {
        const name = decodeURIComponent(req.params.name).toLowerCase().replace(/\.agent$/, '');
        
        if (!isContractDeployed()) {
            return res.json({ 
                name: `${name}.agent`, 
                available: null, 
                contractDeployed: false 
            });
        }
        
        // For now, Helixa doesn't have a separate name registry contract
        // Names are part of the agent identity in the main contract
        // This endpoint could check if a name is already taken by scanning agents
        
        try {
            const totalAgents = Number(await readContract.totalAgents());
            let nameExists = false;
            let tokenId = null;
            
            // Scan through agents to check if name exists
            for (let i = 0; i < totalAgents; i++) {
                try {
                    const agent = await readContract.getAgent(i);
                    if (agent.name.toLowerCase() === name.toLowerCase()) {
                        nameExists = true;
                        tokenId = i;
                        break;
                    }
                } catch {
                    // Skip invalid tokens
                    continue;
                }
            }
            
            res.json({
                name: `${name}.agent`,
                available: !nameExists,
                existingTokenId: tokenId,
                contractDeployed: true,
                hint: nameExists ? 
                    `Name "${name}" is already taken by agent #${tokenId}` :
                    `Name "${name}" is available - mint an agent to claim it`,
            });
        } catch (e) {
            log.error(`Name lookup error for "${name}":`, e.message);
            res.status(500).json({ 
                error: 'Name lookup failed', 
                detail: e.message 
            });
        }
    } catch (e) {
        res.status(400).json({ error: 'Invalid name format' });
    }
});

// GET /api/v2/referral/:code — Look up referral code
router.get('/referral/:code', (req, res) => {
    try {
        const code = req.params.code.toLowerCase();
        const entry = referralRegistry[code];
        
        if (!entry) {
            return res.status(404).json({ 
                error: 'Referral code not found',
                code,
                available: true,
            });
        }
        
        const stats = getReferralStats(code);
        
        res.json({
            code,
            available: false,
            wallet: entry.wallet,
            name: entry.name,
            tokenId: entry.tokenId,
            stats: {
                totalMints: stats.mints,
                pointsEarned: stats.pointsEarned,
            },
            message: `Referral code "${code}" belongs to "${entry.name}"`,
        });
    } catch (e) {
        log.error(`Referral lookup error for "${req.params.code}":`, e.message);
        res.status(500).json({ 
            error: 'Referral lookup failed', 
            detail: e.message 
        });
    }
});

// GET /api/v2/agent/:id/referral — Get agent's referral code
router.get('/agent/:id/referral', async (req, res) => {
    try {
        const tokenId = parseInt(req.params.id);
        if (isNaN(tokenId) || tokenId < 0) {
            return res.status(400).json({ error: 'Invalid token ID' });
        }
        
        // Check if agent exists
        try {
            await readContract.ownerOf(tokenId);
        } catch {
            return res.status(404).json({ error: 'Agent not found' });
        }
        
        // Find referral code for this token
        for (const [code, entry] of Object.entries(referralRegistry)) {
            if (entry.tokenId === tokenId) {
                const stats = getReferralStats(code);
                
                return res.json({
                    tokenId,
                    code,
                    stats: {
                        totalMints: stats.mints,
                        pointsEarned: stats.pointsEarned,
                    },
                    referralUrl: `https://helixa.xyz/mint?ref=${code}`,
                    message: `Agent #${tokenId} referral code: ${code}`,
                });
            }
        }
        
        res.status(404).json({ 
            error: 'No referral code found for this agent',
            tokenId,
            hint: 'Referral codes are auto-generated during minting',
        });
    } catch (e) {
        log.error(`Referral lookup error for agent #${req.params.id}:`, e.message);
        res.status(500).json({ 
            error: 'Referral lookup failed', 
            detail: e.message 
        });
    }
});

module.exports = router;