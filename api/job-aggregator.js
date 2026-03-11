/**
 * Job Aggregator — pulls jobs from Virtuals ACP and other sources
 * Normalizes into a standard format and overlays Helixa cred scores
 */
const path = require('path');
const { execSync } = require('child_process');

const ACP_SKILL_DIR = path.resolve(__dirname, '../../skills/acp');
const ACP_BIN = `npx tsx ${path.join(ACP_SKILL_DIR, 'bin/acp.ts')}`;

// Cache ACP results for 5 minutes
let acpCache = { data: null, timestamp: 0 };
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Browse ACP for job offerings
 */
async function browseACP(query = 'all services agent tasks') {
    const now = Date.now();
    const cacheKey = query.toLowerCase().trim();

    // Use cache if fresh
    if (acpCache.data && acpCache.query === cacheKey && (now - acpCache.timestamp) < CACHE_TTL) {
        return acpCache.data;
    }

    try {
        const result = execSync(
            `cd ${ACP_SKILL_DIR} && ${ACP_BIN} browse "${query}" --json 2>/dev/null`,
            { timeout: 30000, encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 }
        );
        const parsed = JSON.parse(result);
        const agents = Array.isArray(parsed) ? parsed : (parsed.agents || parsed.results || []);

        acpCache = { data: agents, query: cacheKey, timestamp: now };
        return agents;
    } catch (err) {
        console.error('ACP browse error:', err.message?.substring(0, 200));
        return acpCache.data || [];
    }
}

/**
 * Normalize ACP agents+offerings into standard job format
 */
function normalizeACPJobs(agents) {
    const jobs = [];
    for (const agent of agents) {
        const offerings = agent.jobOfferings || agent.offerings || [];
        for (const offering of offerings) {
            jobs.push({
                id: `acp-${agent.id}-${offering.name}`,
                source: 'virtuals-acp',
                sourceName: 'Virtuals ACP',
                title: offering.name?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                description: offering.description || agent.description || '',
                budget: offering.price || 0,
                budgetCurrency: offering.priceType === 'fixed' ? 'VIRTUAL' : 'VIRTUAL',
                budgetDisplay: offering.price ? `${offering.price} VIRTUAL` : 'Free',
                provider: {
                    id: agent.id,
                    name: agent.name,
                    wallet: agent.walletAddress,
                    description: agent.description,
                },
                requirements: offering.requirement || null,
                deliverable: offering.deliverable || null,
                status: 'open',
                tags: extractTags(offering.name, agent.description),
                credThreshold: estimateCredThreshold(offering.price),
                applyUrl: `https://app.virtuals.io/acp`,
                postedAt: null,
            });
        }
    }
    return jobs;
}

/**
 * Estimate cred threshold based on job price
 */
function estimateCredThreshold(price) {
    if (!price || price === 0) return 10;
    if (price <= 0.1) return 30;   // Tier 1: low value
    if (price <= 1) return 50;     // Tier 2: medium
    return 80;                      // Tier 3: high value
}

/**
 * Extract tags from offering name and description
 */
function extractTags(name, description) {
    const text = `${name || ''} ${description || ''}`.toLowerCase();
    const tagMap = {
        'audit': 'security', 'security': 'security', 'verify': 'security',
        'trade': 'trading', 'swap': 'trading', 'dex': 'trading',
        'content': 'content', 'social': 'social-media', 'tweet': 'social-media',
        'research': 'research', 'analysis': 'research', 'data': 'data',
        'smart contract': 'smart-contract', 'solidity': 'smart-contract',
        'image': 'creative', 'video': 'creative', 'design': 'creative',
        'token': 'defi', 'yield': 'defi', 'liquidity': 'defi',
    };
    const tags = new Set();
    for (const [keyword, tag] of Object.entries(tagMap)) {
        if (text.includes(keyword)) tags.add(tag);
    }
    if (tags.size === 0) tags.add('general');
    return [...tags];
}

/**
 * Get all jobs from all sources
 */
async function getAllJobs(query) {
    const acpAgents = await browseACP(query || 'agent services tasks work');
    const acpJobs = normalizeACPJobs(acpAgents);

    // Future: add more sources here
    // const oxworkJobs = await browse0xWork(query);
    // const moltxJobs = await browseMoltlaunch(query);

    return {
        jobs: acpJobs,
        sources: {
            'virtuals-acp': { count: acpJobs.length, status: 'live' },
            '0xwork': { count: 0, status: 'coming-soon' },
            'moltx': { count: 0, status: 'coming-soon' },
            'morpheus': { count: 0, status: 'planned' },
            'autonolas': { count: 0, status: 'planned' },
        },
        total: acpJobs.length,
        cachedAt: new Date().toISOString(),
    };
}

/**
 * Browse Moltlaunch gigs
 */
let moltlaunchCache = { data: null, timestamp: 0 };

async function browseMoltlaunch() {
    const now = Date.now();
    if (moltlaunchCache.data && (now - moltlaunchCache.timestamp) < CACHE_TTL) {
        return moltlaunchCache.data;
    }
    try {
        const https = require('https');
        const data = await new Promise((resolve, reject) => {
            https.get('https://api.moltlaunch.com/api/gigs?limit=200', (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
                });
            }).on('error', reject);
        });
        const gigs = Array.isArray(data) ? data : (data.gigs || data.data || []);
        moltlaunchCache = { data: gigs, timestamp: now };
        return gigs;
    } catch (err) {
        console.error('Moltlaunch browse error:', err.message);
        return moltlaunchCache.data || [];
    }
}

function normalizeMoltlaunchJobs(gigs) {
    return gigs.filter(g => g.active !== false).map(g => {
        const priceETH = g.priceWei ? parseFloat(g.priceWei) / 1e18 : 0;
        return {
            id: `moltlaunch-${g.id}`,
            source: 'moltlaunch',
            sourceName: 'Moltlaunch',
            title: g.title || 'Untitled',
            description: g.description || '',
            budget: priceETH,
            budgetCurrency: 'ETH',
            budgetDisplay: priceETH > 0 ? `${priceETH} ETH` : 'Quote-based',
            provider: {
                id: g.agentId || g.agent?.id,
                name: g.agent?.name || 'Unknown',
                wallet: null,
                description: null,
                reputation: g.agent?.reputation?.summaryValue || 0,
            },
            requirements: null,
            deliverable: null,
            deliveryTime: g.deliveryTime || null,
            status: 'open',
            tags: extractTags(g.title, g.description),
            category: g.category || 'general',
            credThreshold: estimateCredThresholdETH(priceETH),
            applyUrl: `https://moltlaunch.com/gigs`,
            postedAt: g.createdAt ? new Date(g.createdAt).toISOString() : null,
        };
    });
}

function estimateCredThresholdETH(priceETH) {
    if (!priceETH || priceETH === 0) return 10;
    if (priceETH <= 0.01) return 30;
    if (priceETH <= 0.1) return 50;
    return 80;
}

/**
 * Get all jobs from all sources (updated with Moltlaunch)
 */
async function getAllJobsV2(query) {
    const [acpAgents, moltlaunchGigs] = await Promise.all([
        browseACP(query || 'agent services tasks work'),
        browseMoltlaunch(),
    ]);

    const acpJobs = normalizeACPJobs(acpAgents);
    const mlJobs = normalizeMoltlaunchJobs(moltlaunchGigs);
    const allJobs = [...acpJobs, ...mlJobs];

    return {
        jobs: allJobs,
        sources: {
            'virtuals-acp': { count: acpJobs.length, status: 'live' },
            'moltlaunch': { count: mlJobs.length, status: 'live' },
            '0xwork': { count: 0, status: 'coming-soon' },
            'morpheus': { count: 0, status: 'planned' },
            'autonolas': { count: 0, status: 'planned' },
        },
        total: allJobs.length,
        cachedAt: new Date().toISOString(),
    };
}

/**
 * Browse Nookplot bounties + marketplace listings
 */
let nookplotCache = { bounties: null, timestamp: 0 };
const NOOKPLOT_API = 'https://gateway.nookplot.com/v1';
const NOOKPLOT_KEY = 'nk_6nWcSMr7XC-VfA18714Ev38ld2NQDOFlhk4N51BFMR9GpmS9DoPhlKOo7MxbXXvg';

async function browseNookplot() {
    const now = Date.now();
    if (nookplotCache.bounties && (now - nookplotCache.timestamp) < CACHE_TTL) {
        return nookplotCache.bounties;
    }
    try {
        const https = require('https');
        const fetchJSON = (endpoint) => new Promise((resolve, reject) => {
            const url = new URL(endpoint, NOOKPLOT_API);
            const opts = {
                hostname: url.hostname,
                path: url.pathname + url.search,
                headers: { 'Authorization': `Bearer ${NOOKPLOT_KEY}` },
            };
            https.get(opts, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try { resolve(JSON.parse(body)); } catch (e) { resolve([]); }
                });
            }).on('error', () => resolve([]));
        });

        const bounties = await fetchJSON(`${NOOKPLOT_API}/bounties`);
        const bountyList = Array.isArray(bounties) ? bounties : (bounties.bounties || []);
        nookplotCache = { bounties: bountyList, timestamp: now };
        return bountyList;
    } catch (err) {
        console.error('Nookplot browse error:', err.message);
        return nookplotCache.bounties || [];
    }
}

function normalizeNookplotJobs(bounties) {
    return bounties.filter(b => {
        // Include open (0) and claimed (1) bounties
        return b.status === 0 || b.status === 1 || b.status === 'open' || b.status === 'claimed';
    }).map(b => {
        // Reward is in NOOK token (18 decimals) — use BigInt for precision
        const rewardStr = b.rewardAmount || '0';
        const rewardRaw = Number(BigInt(rewardStr) / BigInt('1000000000000000000'))
            + Number(BigInt(rewardStr) % BigInt('1000000000000000000')) / 1e18;
        return {
            id: `nookplot-bounty-${b.id}`,
            source: 'nookplot',
            sourceName: 'Nookplot',
            title: b.title || 'Untitled Bounty',
            description: b.description || '',
            budget: rewardRaw,
            budgetCurrency: 'NOOK',
            budgetDisplay: rewardRaw > 0 ? `${rewardRaw.toLocaleString()} NOOK` : 'Unpriced',
            provider: {
                id: null,
                name: null,
                wallet: b.creator,
                description: null,
            },
            requirements: null,
            deliverable: null,
            status: b.status === 0 || b.status === 'open' ? 'open' : 'claimed',
            tags: extractTags(b.title, b.description).concat(b.community ? [b.community] : []),
            category: b.community || 'general',
            credThreshold: estimateCredThresholdNOOK(rewardRaw),
            applyUrl: `https://nookplot.com/bounties/${b.id}`,
            postedAt: b.createdAt ? new Date(parseInt(b.createdAt) * 1000).toISOString() : null,
            deadline: b.deadline ? new Date(parseInt(b.deadline) * 1000).toISOString() : null,
            applicationCount: b.applicationCount || 0,
            escrow: true,
        };
    });
}

function estimateCredThresholdNOOK(rewardNOOK) {
    if (!rewardNOOK || rewardNOOK === 0) return 10;
    if (rewardNOOK <= 100) return 30;
    if (rewardNOOK <= 1000) return 50;
    return 80;
}

/**
 * Get all jobs from all sources (V3 with Nookplot)
 */
async function getAllJobsV3(query) {
    const [acpAgents, moltlaunchGigs, nookplotBounties] = await Promise.all([
        browseACP(query || 'agent services tasks work'),
        browseMoltlaunch(),
        browseNookplot(),
    ]);

    const acpJobs = normalizeACPJobs(acpAgents);
    const mlJobs = normalizeMoltlaunchJobs(moltlaunchGigs);
    const npJobs = normalizeNookplotJobs(nookplotBounties);
    const allJobs = [...acpJobs, ...mlJobs, ...npJobs];

    return {
        jobs: allJobs,
        sources: {
            'virtuals-acp': { count: acpJobs.length, status: 'live' },
            'moltlaunch': { count: mlJobs.length, status: 'live' },
            'nookplot': { count: npJobs.length, status: 'live' },
            '0xwork': { count: 0, status: 'coming-soon' },
            'morpheus': { count: 0, status: 'planned' },
            'autonolas': { count: 0, status: 'planned' },
        },
        total: allJobs.length,
        cachedAt: new Date().toISOString(),
    };
}

/**
 * Browse 0xWork tasks via CLI
 */
let oxworkCache = { data: null, timestamp: 0 };

async function browse0xWork() {
    const now = Date.now();
    if (oxworkCache.data && (now - oxworkCache.timestamp) < CACHE_TTL) {
        return oxworkCache.data;
    }
    try {
        const result = execSync(
            'npx @0xwork/sdk discover 2>/dev/null',
            { timeout: 30000, encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 }
        );
        const parsed = JSON.parse(result);
        const tasks = parsed.tasks || parsed.data || (Array.isArray(parsed) ? parsed : []);
        oxworkCache = { data: tasks, timestamp: now };
        return tasks;
    } catch (err) {
        console.error('0xWork browse error:', err.message?.substring(0, 200));
        return oxworkCache.data || [];
    }
}

function normalize0xWorkJobs(tasks) {
    return tasks.filter(t => !t.status || t.status === 'open' || t.status === 0).map(t => {
        const bountyUSDC = parseFloat(t.bounty || t.bountyAmount || '0'); // Already in USD from CLI
        return {
            id: `0xwork-${t.chainTaskId || t.id}`,
            source: '0xwork',
            sourceName: '0xWork',
            title: t.title || t.description?.substring(0, 60) || 'Untitled Task',
            description: t.description || '',
            budget: bountyUSDC,
            budgetCurrency: 'USDC',
            budgetDisplay: bountyUSDC > 0 ? `$${bountyUSDC.toFixed(2)} USDC` : 'Unpriced',
            provider: {
                id: t.posterId || t.poster,
                name: t.posterName || null,
                wallet: t.poster || t.posterAddress,
                description: null,
            },
            requirements: t.capabilities || t.requiredCapabilities || null,
            deliverable: t.deliverableFormat || null,
            status: 'open',
            tags: (t.capabilities || t.categories || []).map(c => c.toLowerCase()),
            category: (t.capabilities || t.categories || ['general'])[0]?.toLowerCase() || 'general',
            credThreshold: estimateCredThreshold0xWork(bountyUSDC),
            applyUrl: `https://0xwork.org/tasks/${t.chainTaskId || t.id}`,
            postedAt: t.createdAt ? new Date(t.createdAt).toISOString() : null,
            deadline: t.deadline ? new Date(t.deadline).toISOString() : null,
            stakeRequired: t.stakeRequired || null,
            escrow: true,
        };
    });
}

function estimateCredThreshold0xWork(bountyUSDC) {
    if (!bountyUSDC || bountyUSDC === 0) return 10;
    if (bountyUSDC <= 10) return 30;
    if (bountyUSDC <= 100) return 50;
    return 80;
}

/**
 * Browse Atelier AI services
 */
let atelierCache = { data: null, timestamp: 0 };

async function browseAtelier() {
    const now = Date.now();
    if (atelierCache.data && (now - atelierCache.timestamp) < CACHE_TTL) {
        return atelierCache.data;
    }
    try {
        const https = require('https');
        const data = await new Promise((resolve, reject) => {
            https.get('https://atelierai.xyz/api/services', (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
                });
            }).on('error', reject);
        });
        const services = data.data || data.services || (Array.isArray(data) ? data : []);
        atelierCache = { data: services, timestamp: now };
        return services;
    } catch (err) {
        console.error('Atelier browse error:', err.message);
        return atelierCache.data || [];
    }
}

function normalizeAtelierJobs(services) {
    return services.filter(s => s.active === 1 || s.active === true).map(s => {
        const priceUSD = parseFloat(s.price_usd || '0');
        let deliverables = [];
        try { deliverables = JSON.parse(s.deliverables || '[]'); } catch {}
        return {
            id: `atelier-${s.id}`,
            source: 'atelier',
            sourceName: 'Atelier',
            title: s.title || 'Untitled Service',
            description: s.description || '',
            budget: priceUSD,
            budgetCurrency: 'USD',
            budgetDisplay: priceUSD > 0 ? `$${priceUSD.toFixed(2)}` : 'Free',
            provider: {
                id: s.agent_id,
                name: s.agent_name || null,
                wallet: null,
                description: null,
                avatar: s.agent_avatar_url || null,
            },
            requirements: null,
            deliverable: deliverables.join(', '),
            status: 'open',
            tags: [s.category || 'creative'].concat(s.provider_model ? [s.provider_model.toLowerCase()] : []),
            category: s.category || 'creative',
            credThreshold: 10, // Creative services, low barrier
            applyUrl: `https://atelierai.xyz/agents/${s.agent_slug}`,
            postedAt: s.created_at ? new Date(s.created_at).toISOString() : null,
            turnaroundHours: s.turnaround_hours || null,
            completedOrders: s.completed_orders || 0,
            avgRating: s.avg_rating || null,
            priceType: s.price_type || 'fixed',
        };
    });
}

/**
 * Browse Claw Earn (aiagentstore.ai) bounties
 */
let clawEarnCache = { data: null, timestamp: 0 };

async function browseClawEarn() {
    const now = Date.now();
    if (clawEarnCache.data && (now - clawEarnCache.timestamp) < CACHE_TTL) {
        return clawEarnCache.data;
    }
    try {
        const https = require('https');
        const data = await new Promise((resolve, reject) => {
            https.get('https://aiagentstore.ai/claw/open', (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
                });
            }).on('error', reject);
        });
        const items = data.items || data.bounties || (Array.isArray(data) ? data : []);
        clawEarnCache = { data: items, timestamp: now };
        return items;
    } catch (err) {
        console.error('Claw Earn browse error:', err.message);
        return clawEarnCache.data || [];
    }
}

function normalizeClawEarnJobs(items) {
    return items.map(t => {
        const meta = t.metadata || {};
        const rewardUSDC = parseFloat(meta.rewardUsdc || '0');
        return {
            id: `clawearn-${t.id}`,
            source: 'claw-earn',
            sourceName: 'Claw Earn',
            title: (meta.description || 'Untitled').substring(0, 100),
            description: meta.description || '',
            budget: rewardUSDC,
            budgetCurrency: 'USDC',
            budgetDisplay: rewardUSDC > 0 ? `$${rewardUSDC.toFixed(2)} USDC` : 'Unpriced',
            provider: {
                id: null,
                name: null,
                wallet: t.id?.split('_')[0] || null,
                description: null,
            },
            requirements: null,
            deliverable: null,
            status: 'open',
            tags: extractTags(meta.description || '', ''),
            category: 'general',
            credThreshold: estimateCredThreshold0xWork(rewardUSDC),
            applyUrl: `https://aiagentstore.ai/claw-earn/ai-agent-tasks/available`,
            postedAt: null,
            decisionWindowSec: meta.decisionWindowSec || null,
            escrow: true,
        };
    });
}

/**
 * Get all jobs from all sources (V4 with 0xWork + Atelier + Claw Earn)
 */
async function getAllJobsV4(query) {
    const [acpAgents, moltlaunchGigs, nookplotBounties, oxworkTasks, atelierServices, clawEarnItems] = await Promise.all([
        browseACP(query || 'agent services tasks work'),
        browseMoltlaunch(),
        browseNookplot(),
        browse0xWork(),
        browseAtelier(),
        browseClawEarn(),
    ]);

    const acpJobs = normalizeACPJobs(acpAgents);
    const mlJobs = normalizeMoltlaunchJobs(moltlaunchGigs);
    const npJobs = normalizeNookplotJobs(nookplotBounties);
    const oxJobs = normalize0xWorkJobs(oxworkTasks);
    const atJobs = normalizeAtelierJobs(atelierServices);
    const ceJobs = normalizeClawEarnJobs(clawEarnItems);
    const allJobs = [...acpJobs, ...mlJobs, ...npJobs, ...oxJobs, ...atJobs, ...ceJobs];

    return {
        jobs: allJobs,
        sources: {
            'virtuals-acp': { count: acpJobs.length, status: 'live' },
            'moltlaunch': { count: mlJobs.length, status: 'live' },
            'nookplot': { count: npJobs.length, status: 'live' },
            '0xwork': { count: oxJobs.length, status: 'live' },
            'atelier': { count: atJobs.length, status: 'live' },
            'claw-earn': { count: ceJobs.length, status: 'live' },
        },
        total: allJobs.length,
        cachedAt: new Date().toISOString(),
    };
}

module.exports = {
    browseACP, normalizeACPJobs,
    browseMoltlaunch, normalizeMoltlaunchJobs,
    browseNookplot, normalizeNookplotJobs,
    browse0xWork, normalize0xWorkJobs,
    browseAtelier, normalizeAtelierJobs,
    browseClawEarn, normalizeClawEarnJobs,
    getAllJobs: getAllJobsV4,
};
