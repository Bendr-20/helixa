/**
 * 0xWork Work-Stats Integration
 * 
 * Fetches task completion data from 0xWork API and maps it to cred scores.
 * Cached per agent, refreshed every 6 hours.
 */

const Database = require('better-sqlite3');
const path = require('path');

const WORK_STATS_API = 'https://api.0xwork.org/agents';
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

// In-memory cache
const cache = new Map();

/**
 * Fetch work stats for an agent by their wallet address
 */
async function fetchWorkStats(address) {
    if (!address) return null;
    
    const cached = cache.get(address.toLowerCase());
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
        return cached.data;
    }

    try {
        const resp = await fetch(`${WORK_STATS_API}/${address}/work-stats?window=all`, {
            signal: AbortSignal.timeout(1500),
        });
        if (!resp.ok) return null;
        const data = await resp.json();
        
        const result = {
            tasksCompleted: data.work?.tasks_completed || 0,
            tasksFailed: data.work?.tasks_failed || 0,
            completionRate: data.work?.completion_rate || 0,
            reliabilityScore: data.work?.reliability_score || 0,
            totalEarned: data.work?.total_earned || 0,
            currency: data.work?.currency || 'USDC',
            categories: data.work?.categories || [],
            avgCompletionHours: data.work?.avg_completion_hours || 0,
            tasksPosted: data.posting?.tasks_posted || 0,
            totalPaid: data.posting?.total_paid || 0,
            avgRating: data.ratings?.avg_rating || null,
            reputation: data.agent?.reputation || 0,
            registered: data.registered || false,
        };
        
        cache.set(address.toLowerCase(), { data: result, fetchedAt: Date.now() });
        return result;
    } catch (e) {
        console.error(`[0xWork] Error fetching stats for ${address}:`, e.message);
        return null;
    }
}

/**
 * Calculate work history raw score (0-100) from 0xWork stats
 */
function calculateWorkScore(stats) {
    if (!stats || !stats.registered) return 0;
    
    let score = 0;
    
    // Task completion (0-40): more completed tasks = higher score
    if (stats.tasksCompleted > 0) {
        score += Math.min(40, stats.tasksCompleted * 8); // 5 tasks = 40
    }
    
    // Reliability (0-25): completion rate
    score += Math.round((stats.completionRate / 100) * 25);
    
    // Revenue (0-20): earning real money proves utility
    if (stats.totalEarned > 0) {
        score += Math.min(20, Math.round(Math.log10(stats.totalEarned + 1) * 7));
    }
    
    // Breadth (0-15): working across categories
    score += Math.min(15, stats.categories.length * 5);
    
    return Math.min(100, score);
}

/**
 * Batch fetch work stats for agents that have wallet addresses
 * Used by periodic refresh
 */
async function refreshAll(db) {
    const agents = db.prepare(
        "SELECT tokenId, agentAddress FROM agents WHERE agentAddress IS NOT NULL AND agentAddress != ''"
    ).all();
    
    let fetched = 0;
    for (const agent of agents) {
        const stats = await fetchWorkStats(agent.agentAddress);
        if (stats && stats.registered) {
            fetched++;
        }
        // Rate limit
        await new Promise(r => setTimeout(r, 500));
    }
    
    console.log(`[0xWork] Refreshed ${fetched}/${agents.length} agents`);
    return fetched;
}

module.exports = { fetchWorkStats, calculateWorkScore, refreshAll };
