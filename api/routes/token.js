/**
 * Token Routes
 * Handles token statistics and metrics
 */

const express = require('express');
const { readContract, V2_CONTRACT_ADDRESS } = require('../services/contract');
const log = require('../utils/logger');

const router = express.Router();

function isContractDeployed() {
    return process.env.V2_CONTRACT && process.env.V2_CONTRACT !== '0x0000000000000000000000000000000000000000';
}

// GET /api/v2/token/stats — Token and protocol statistics
router.get('/stats', async (req, res) => {
    try {
        if (!isContractDeployed()) {
            return res.json({
                contractDeployed: false,
                contract: V2_CONTRACT_ADDRESS,
                message: 'V2 contract not yet deployed',
                stats: {
                    totalAgents: 0,
                    totalTraits: 0,
                    totalPoints: 0,
                    totalVerifications: 0,
                },
            });
        }
        
        // Get basic contract stats
        const totalAgents = Number(await readContract.totalAgents());
        
        if (totalAgents === 0) {
            return res.json({
                contractDeployed: true,
                contract: V2_CONTRACT_ADDRESS,
                stats: {
                    totalAgents: 0,
                    totalTraits: 0,
                    totalPoints: 0,
                    totalVerifications: 0,
                    frameworks: {},
                    soulboundAgents: 0,
                    avgCredScore: 0,
                },
                message: 'No agents minted yet',
            });
        }
        
        // Aggregate statistics across all agents
        let totalPoints = 0;
        let totalTraits = 0;
        let totalVerifications = 0;
        let soulboundAgents = 0;
        const frameworks = {};
        const generations = {};
        
        // Sample a subset for performance (if too many agents)
        const sampleSize = Math.min(totalAgents, 100);
        const step = Math.max(1, Math.floor(totalAgents / sampleSize));
        
        for (let i = 0; i < totalAgents; i += step) {
            try {
                const [agent, traits] = await Promise.all([
                    readContract.getAgent(i),
                    readContract.getTraits(i),
                ]);
                
                totalPoints += Number(agent.points);
                totalTraits += traits.length;
                
                // Count verification traits
                const verificationTraits = traits.filter(t => t.category === 'verification');
                if (verificationTraits.length > 0) {
                    totalVerifications++;
                }
                
                // Framework distribution
                const fw = agent.framework || 'unknown';
                frameworks[fw] = (frameworks[fw] || 0) + 1;
                
                // Generation distribution
                const gen = Number(agent.generation);
                generations[gen] = (generations[gen] || 0) + 1;
                
                // Soulbound count
                if (agent.soulbound) {
                    soulboundAgents++;
                }
            } catch (e) {
                // Skip failed agents
                log.error(`Failed to load stats for agent ${i}:`, e.message);
                continue;
            }
        }
        
        // Calculate averages (extrapolate from sample)
        const scaleFactor = totalAgents / sampleSize;
        totalPoints = Math.round(totalPoints * scaleFactor);
        totalTraits = Math.round(totalTraits * scaleFactor);
        totalVerifications = Math.round(totalVerifications * scaleFactor);
        soulboundAgents = Math.round(soulboundAgents * scaleFactor);
        
        // Scale framework counts
        for (const fw in frameworks) {
            frameworks[fw] = Math.round(frameworks[fw] * scaleFactor);
        }
        
        for (const gen in generations) {
            generations[gen] = Math.round(generations[gen] * scaleFactor);
        }
        
        const avgPoints = totalAgents > 0 ? Math.round(totalPoints / totalAgents) : 0;
        const avgTraits = totalAgents > 0 ? Math.round((totalTraits / totalAgents) * 10) / 10 : 0;
        const verificationRate = totalAgents > 0 ? Math.round((totalVerifications / totalAgents) * 100) : 0;
        const soulboundRate = totalAgents > 0 ? Math.round((soulboundAgents / totalAgents) * 100) : 0;
        
        // Top frameworks
        const topFrameworks = Object.entries(frameworks)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([name, count]) => ({ name, count, percentage: Math.round((count / totalAgents) * 100) }));
        
        res.json({
            contractDeployed: true,
            contract: V2_CONTRACT_ADDRESS,
            stats: {
                totalAgents,
                totalPoints,
                totalTraits,
                totalVerifications,
                soulboundAgents,
                avgPointsPerAgent: avgPoints,
                avgTraitsPerAgent: avgTraits,
                verificationRate: `${verificationRate}%`,
                soulboundRate: `${soulboundRate}%`,
                topFrameworks,
                generationDistribution: generations,
            },
            metadata: {
                lastUpdated: new Date().toISOString(),
                sampleSize: Math.min(totalAgents, sampleSize),
                totalAgentsScanned: totalAgents,
                isEstimated: totalAgents > 100,
            },
            message: `Protocol statistics for ${totalAgents} agents`,
        });
        
    } catch (e) {
        log.error('Failed to generate token stats:', e.message);
        res.status(500).json({ 
            error: 'Failed to generate stats', 
            detail: e.message,
            contractDeployed: isContractDeployed(),
        });
    }
});

// GET /api/v2/leaderboard — Agent leaderboard
router.get('/leaderboard', async (req, res) => {
    try {
        const sortBy = req.query.sort || 'cred';
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        
        if (!isContractDeployed()) {
            return res.json({
                leaderboard: [],
                total: 0,
                sortBy,
                contractDeployed: false,
            });
        }
        
        const totalAgents = Number(await readContract.totalAgents());
        if (totalAgents === 0) {
            return res.json({
                leaderboard: [],
                total: 0,
                sortBy,
                message: 'No agents to rank yet',
            });
        }
        
        const agents = [];
        
        // Load all agents with their scores
        for (let i = 0; i < totalAgents; i++) {
            try {
                const agent = await readContract.getAgent(i);
                const traits = await readContract.getTraits(i);
                
                // Simple cred score calculation (in production, use indexer)
                const basePoints = Number(agent.points);
                const verificationBonus = traits.filter(t => t.category === 'verification').length * 10;
                const badgeBonus = traits.filter(t => t.category === 'badge').length * 5;
                const credScore = basePoints + verificationBonus + badgeBonus;
                
                agents.push({
                    tokenId: i,
                    name: agent.name,
                    framework: agent.framework,
                    points: Number(agent.points),
                    credScore,
                    traitCount: traits.length,
                    verificationCount: traits.filter(t => t.category === 'verification').length,
                    generation: Number(agent.generation),
                    soulbound: agent.soulbound,
                });
            } catch (e) {
                // Skip invalid agents
                continue;
            }
        }
        
        // Sort by requested criteria
        if (sortBy === 'points') {
            agents.sort((a, b) => b.points - a.points);
        } else if (sortBy === 'traits') {
            agents.sort((a, b) => b.traitCount - a.traitCount);
        } else if (sortBy === 'verifications') {
            agents.sort((a, b) => b.verificationCount - a.verificationCount);
        } else {
            // Default: sort by cred score
            agents.sort((a, b) => b.credScore - a.credScore);
        }
        
        // Add rankings
        const leaderboard = agents.slice(0, limit).map((agent, index) => ({
            rank: index + 1,
            ...agent,
        }));
        
        res.json({
            leaderboard,
            total: totalAgents,
            sortBy,
            limit,
            contractDeployed: true,
            message: `Top ${limit} agents sorted by ${sortBy}`,
        });
        
    } catch (e) {
        log.error('Failed to generate leaderboard:', e.message);
        res.status(500).json({ 
            error: 'Failed to generate leaderboard', 
            detail: e.message 
        });
    }
});

module.exports = router;