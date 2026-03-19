/**
 * ERC-8004 Reputation Registry Integration
 * Reads feedback signals from the official Reputation Registry on Base
 * and incorporates them into Helixa's Cred Score.
 */

const { ethers } = require('ethers');

const REPUTATION_REGISTRY = '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63';
const IDENTITY_REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';
const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';

const REP_ABI = [
    'event NewFeedback(uint256 indexed agentId, address indexed clientAddress, uint64 feedbackIndex, int128 value, uint8 valueDecimals, string indexed indexedTag1, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)',
    'function getIdentityRegistry() view returns (address)',
    'function giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)',
];

// Cache: agentId -> { feedbackCount, avgScore, tags, lastUpdated }
const feedbackCache = new Map();
const CACHE_TTL = 300_000; // 5 minutes
const BLOCK_RANGE = 9000; // Stay under 10K limit

let provider = null;
let repContract = null;

function getProvider() {
    if (!provider) provider = new ethers.JsonRpcProvider(RPC_URL);
    return provider;
}

function getRepContract() {
    if (!repContract) repContract = new ethers.Contract(REPUTATION_REGISTRY, REP_ABI, getProvider());
    return repContract;
}

/**
 * Fetch feedback for a specific 8004 agentId from the Reputation Registry.
 * Scans recent blocks for NewFeedback events targeting this agent.
 * Returns aggregated reputation data.
 */
async function getAgentFeedback(agentId8004) {
    const cached = feedbackCache.get(agentId8004);
    if (cached && Date.now() - cached.lastUpdated < CACHE_TTL) return cached;

    const p = getProvider();
    const contract = getRepContract();
    const latest = await p.getBlockNumber();

    // Scan recent blocks for feedback on this agent
    const filter = contract.filters.NewFeedback(agentId8004);
    let events = [];
    try {
        events = await contract.queryFilter(filter, latest - BLOCK_RANGE, latest);
    } catch (e) {
        console.warn(`[8004-REP] Error fetching feedback for agent ${agentId8004}:`, e.message?.slice(0, 80));
    }

    if (events.length === 0) {
        const result = { feedbackCount: 0, avgScore: null, scores: [], tags: {}, clients: 0, lastUpdated: Date.now() };
        feedbackCache.set(agentId8004, result);
        return result;
    }

    // Aggregate feedback
    const scores = [];
    const tags = {};
    const clients = new Set();

    for (const e of events) {
        const value = Number(e.args[3]); // int128 value
        const decimals = Number(e.args[4]); // uint8 valueDecimals
        const tag1 = e.args[6]; // string tag1
        const tag2 = e.args[7]; // string tag2
        const clientAddr = e.args[1]; // address clientAddress

        const normalizedValue = value / Math.pow(10, decimals);
        scores.push({ value: normalizedValue, tag1, tag2 });
        clients.add(clientAddr);

        if (tag1) tags[tag1] = (tags[tag1] || 0) + 1;
    }

    // Calculate average score (for trust-tagged feedback, scale to 0-100)
    const trustScores = scores.filter(s => s.tag1 === 'trust' || s.tag1 === 'starred');
    const avgScore = trustScores.length > 0
        ? trustScores.reduce((sum, s) => sum + s.value, 0) / trustScores.length
        : scores.reduce((sum, s) => sum + s.value, 0) / scores.length;

    const result = {
        feedbackCount: events.length,
        avgScore: Math.round(avgScore * 100) / 100,
        scores,
        tags,
        clients: clients.size,
        lastUpdated: Date.now(),
    };

    feedbackCache.set(agentId8004, result);
    return result;
}

/**
 * Scan recent feedback across all agents (for bulk scoring).
 * Returns Map<agentId, aggregatedFeedback>
 */
async function scanRecentFeedback() {
    const p = getProvider();
    const contract = getRepContract();
    const latest = await p.getBlockNumber();

    let events = [];
    try {
        const filter = contract.filters.NewFeedback();
        events = await contract.queryFilter(filter, latest - BLOCK_RANGE, latest);
    } catch (e) {
        console.warn('[8004-REP] Error scanning recent feedback:', e.message?.slice(0, 80));
        return new Map();
    }

    const agentFeedback = new Map();
    for (const e of events) {
        const agentId = e.args[0].toString();
        const value = Number(e.args[3]);
        const decimals = Number(e.args[4]);
        const tag1 = e.args[6];
        const normalizedValue = value / Math.pow(10, decimals);

        if (!agentFeedback.has(agentId)) {
            agentFeedback.set(agentId, { count: 0, totalScore: 0, tags: {}, clients: new Set() });
        }
        const agg = agentFeedback.get(agentId);
        agg.count++;
        agg.totalScore += normalizedValue;
        agg.clients.add(e.args[1]);
        if (tag1) agg.tags[tag1] = (agg.tags[tag1] || 0) + 1;
    }

    // Finalize
    for (const [id, agg] of agentFeedback) {
        agg.avgScore = Math.round((agg.totalScore / agg.count) * 100) / 100;
        agg.clients = agg.clients.size;
    }

    console.log(`[8004-REP] Scanned ${events.length} feedback events across ${agentFeedback.size} agents`);
    return agentFeedback;
}

/**
 * Calculate a reputation bonus (0-15 points) based on 8004 Reputation Registry feedback.
 * This feeds into the overall Cred Score.
 */
function calculateReputationBonus(feedback) {
    if (!feedback || feedback.feedbackCount === 0) return 0;

    let bonus = 0;

    // Has any feedback at all: +2
    bonus += 2;

    // Multiple feedback sources: +3 (3+ unique clients)
    if (feedback.clients >= 3) bonus += 3;
    else if (feedback.clients >= 2) bonus += 1;

    // High average score: up to +5
    if (feedback.avgScore !== null) {
        if (feedback.avgScore >= 80) bonus += 5;
        else if (feedback.avgScore >= 60) bonus += 3;
        else if (feedback.avgScore >= 40) bonus += 1;
    }

    // Volume of feedback: up to +3
    if (feedback.feedbackCount >= 10) bonus += 3;
    else if (feedback.feedbackCount >= 5) bonus += 2;
    else if (feedback.feedbackCount >= 2) bonus += 1;

    // Liveness feedback (agent is responsive): +2
    if (feedback.tags?.liveness > 0) bonus += 2;

    return Math.min(bonus, 15); // Cap at 15 points
}

module.exports = {
    getAgentFeedback,
    scanRecentFeedback,
    calculateReputationBonus,
    REPUTATION_REGISTRY,
    IDENTITY_REGISTRY,
};
