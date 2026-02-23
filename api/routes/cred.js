/**
 * Cred Routes
 * Handles cred scores and cred reports
 */

const express = require('express');
const crypto = require('crypto');
const { readContract } = require('../services/contract');
const indexer = require('../indexer');
const log = require('../utils/logger');

const router = express.Router();

// HMAC secret for cred report receipts (security fix C-02)
const RECEIPT_HMAC_SECRET = process.env.RECEIPT_HMAC_SECRET || crypto.randomBytes(32).toString('hex');

if (!process.env.RECEIPT_HMAC_SECRET) {
    log.error('WARNING: RECEIPT_HMAC_SECRET not set. Using random key - receipts will not verify across restarts');
}

// Helper function to generate report receipt
function generateReceipt(reportData) {
    const payload = JSON.stringify({
        tokenId: reportData.tokenId,
        credScore: reportData.credScore,
        timestamp: reportData.timestamp,
        summary: reportData.summary,
    });
    
    const hmac = crypto.createHmac('sha256', RECEIPT_HMAC_SECRET);
    hmac.update(payload);
    const signature = hmac.digest('hex');
    
    return {
        payload,
        signature,
        algorithm: 'hmac-sha256',
        issued: new Date().toISOString(),
    };
}

// GET /api/v2/agent/:id/cred — Get basic cred score
router.get('/agent/:id/cred', async (req, res) => {
    try {
        const tokenId = parseInt(req.params.id);
        if (isNaN(tokenId) || tokenId < 0) {
            return res.status(400).json({ error: 'Invalid token ID' });
        }
        
        // Check if agent exists
        try {
            await readContract.ownerOf(tokenId);
        } catch (e) {
            return res.status(404).json({ error: 'Agent not found' });
        }
        
        const credScore = indexer.getCredScore ? await indexer.getCredScore(tokenId) : 0;
        
        res.json({
            tokenId,
            credScore,
            timestamp: Date.now(),
        });
    } catch (e) {
        log.error(`Failed to get cred score for #${req.params.id}:`, e.message);
        res.status(500).json({ error: 'Failed to get cred score: ' + e.message });
    }
});

// GET /api/v2/agent/:id/cred-report — Generate detailed cred report
router.get('/agent/:id/cred-report', async (req, res) => {
    try {
        const tokenId = parseInt(req.params.id);
        if (isNaN(tokenId) || tokenId < 0) {
            return res.status(400).json({ error: 'Invalid token ID' });
        }
        
        // Get agent data
        const [agent, personality, narrative, traits] = await Promise.all([
            readContract.getAgent(tokenId),
            readContract.getPersonality(tokenId),
            readContract.getNarrative(tokenId),
            readContract.getTraits(tokenId),
        ]);
        
        const credScore = indexer.getCredScore ? await indexer.getCredScore(tokenId) : 0;
        
        // Generate comprehensive report
        const verificationTraits = traits.filter(t => t.category === 'verification');
        const badgeTraits = traits.filter(t => t.category === 'badge');
        
        const report = {
            tokenId,
            agentInfo: {
                name: agent.name,
                framework: agent.framework,
                owner: agent.owner,
                agentAddress: agent.agentAddress,
                generation: Number(agent.generation),
                points: Number(agent.points),
                soulbound: agent.soulbound,
            },
            credScore,
            analysis: {
                verifications: verificationTraits.map(t => t.name),
                badges: badgeTraits.map(t => t.name),
                totalTraits: traits.length,
                personalitySet: !!(personality.quirks || personality.values || personality.communicationStyle || personality.humor),
                narrativeSet: !!(narrative.origin || narrative.mission || narrative.lore || narrative.manifesto),
                riskProfile: {
                    tolerance: Number(personality.riskTolerance) || 5,
                    autonomy: Number(personality.autonomyLevel) || 5,
                },
            },
            scoring: {
                basePoints: Number(agent.points),
                verificationBonus: verificationTraits.length * 10,
                badgeBonus: badgeTraits.length * 5,
                personalityBonus: (personality.quirks || personality.values) ? 15 : 0,
                narrativeBonus: (narrative.origin || narrative.mission) ? 20 : 0,
                frameworkBonus: agent.framework === 'custom' ? 0 : 5,
                soulboundBonus: agent.soulbound ? 10 : 0,
            },
            summary: generateCredSummary(credScore, verificationTraits.length, badgeTraits.length),
            timestamp: Date.now(),
            generatedAt: new Date().toISOString(),
        };
        
        // Calculate detailed score breakdown
        const breakdown = report.scoring;
        const calculatedScore = breakdown.basePoints + 
            breakdown.verificationBonus + 
            breakdown.badgeBonus + 
            breakdown.personalityBonus + 
            breakdown.narrativeBonus + 
            breakdown.frameworkBonus + 
            breakdown.soulboundBonus;
        
        report.calculatedScore = calculatedScore;
        report.indexedScore = credScore;
        report.scoreDifference = credScore - calculatedScore;
        
        // Generate cryptographic receipt
        const receipt = generateReceipt(report);
        
        log.info(`Generated cred report for agent #${tokenId} (score: ${credScore})`);
        
        res.json({
            success: true,
            report,
            receipt,
            message: `Detailed Cred Score analysis for Agent #${tokenId}`,
        });
    } catch (e) {
        if (e.message.includes('nonexistent token')) {
            res.status(404).json({ error: 'Agent not found' });
        } else {
            log.error(`Failed to generate cred report for #${req.params.id}:`, e.message);
            res.status(500).json({ error: 'Failed to generate cred report: ' + e.message });
        }
    }
});

// POST /api/v2/cred-report/verify-receipt — Verify cred report receipt
router.post('/cred-report/verify-receipt', (req, res) => {
    try {
        const { payload, signature, algorithm } = req.body;
        
        if (!payload || !signature) {
            return res.status(400).json({ error: 'Payload and signature required' });
        }
        
        if (algorithm !== 'hmac-sha256') {
            return res.status(400).json({ error: 'Unsupported algorithm' });
        }
        
        // Verify HMAC signature
        const hmac = crypto.createHmac('sha256', RECEIPT_HMAC_SECRET);
        hmac.update(payload);
        const expectedSignature = hmac.digest('hex');
        
        const isValid = crypto.timingSafeEqual(
            Buffer.from(signature, 'hex'),
            Buffer.from(expectedSignature, 'hex')
        );
        
        if (isValid) {
            const data = JSON.parse(payload);
            res.json({
                valid: true,
                tokenId: data.tokenId,
                credScore: data.credScore,
                timestamp: data.timestamp,
                message: 'Receipt verified successfully',
            });
        } else {
            res.json({
                valid: false,
                message: 'Invalid receipt signature',
            });
        }
    } catch (e) {
        log.error('Receipt verification error:', e.message);
        res.status(400).json({ 
            valid: false, 
            error: 'Receipt verification failed', 
            detail: e.message 
        });
    }
});

function generateCredSummary(score, verificationCount, badgeCount) {
    let level = 'Unverified';
    let description = 'No verifications or significant activity.';
    
    if (score >= 100) {
        level = 'Legendary Agent';
        description = 'Exceptional reputation with multiple verifications and high activity.';
    } else if (score >= 75) {
        level = 'Trusted Agent';
        description = 'Strong reputation with verified identity and consistent activity.';
    } else if (score >= 50) {
        level = 'Verified Agent';
        description = 'Good reputation with some verifications and moderate activity.';
    } else if (score >= 25) {
        level = 'Active Agent';
        description = 'Basic reputation with minimal verification but some activity.';
    } else if (score >= 10) {
        level = 'New Agent';
        description = 'Recently registered with limited activity.';
    }
    
    const features = [];
    if (verificationCount > 0) features.push(`${verificationCount} verification(s)`);
    if (badgeCount > 0) features.push(`${badgeCount} badge(s)`);
    if (score > 50) features.push('high activity');
    
    return {
        level,
        description,
        features: features.join(', ') || 'minimal activity',
        recommendation: score < 25 ? 
            'Consider verifying identity and increasing activity to build reputation.' :
            score < 75 ?
            'Add more verifications and maintain consistent activity.' :
            'Excellent reputation! Continue high-quality participation.'
    };
}

module.exports = router;