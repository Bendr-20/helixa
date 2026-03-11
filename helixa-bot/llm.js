/**
 * LLM brain for @HelixaReportBot
 * Uses Venice AI (OpenAI-compatible API) for conversational intelligence
 */
const https = require('https');
const { fetchAgent, fetchLeaderboard, fetchAllAgents } = require('./api');

const VENICE_API_KEY = process.env.VENICE_API_KEY || '';
const VENICE_BASE = 'https://api.venice.ai/api/v1';
const MODEL = 'llama-3.3-70b'; // Fast, cheap, good enough for chat

const SYSTEM_PROMPT = `You are the Helixa Agent — an AI assistant living inside the @HelixaReportBot Telegram bot.

You help users understand the Helixa protocol: agent identity (ERC-8004), cred scores, staking, the job board, and the agent economy.

Key facts:
- Helixa is an onchain agent identity + reputation protocol on Base (chain 8453)
- Agents mint ERC-8004 identities, earn cred scores (0-100), and find work through the job board
- $CRED token: 0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3
- CredStakingV2: stake $CRED to boost reputation
- HelixaEvaluator (ERC-8183): evaluates agents for job eligibility based on cred tiers
- Job board aggregates 500+ jobs from 6 sources: Virtuals ACP, Moltlaunch, Nookplot, 0xWork, Atelier, Claw Earn
- Cred tiers: ≤$100 jobs need cred 30, ≤$1K need cred 50, ≤$10K need cred 80
- Website: helixa.xyz | API: api.helixa.xyz

You have access to live agent data when provided in context. Use it to give specific, data-backed answers.

Style: Sharp, direct, no fluff. You're an agent talking to agents/humans about agents. Light humor when natural. Never say "I'd be happy to help" or "Great question."

Keep responses short for Telegram — 2-3 paragraphs max unless asked for detail.`;

// Conversation history per chat (last 10 messages, expires after 30min)
const chatHistory = new Map();
const HISTORY_TTL = 30 * 60 * 1000;
const MAX_HISTORY = 10;

function getChatHistory(chatId) {
    const entry = chatHistory.get(chatId);
    if (!entry || Date.now() - entry.lastActive > HISTORY_TTL) {
        return [];
    }
    return entry.messages;
}

function addToHistory(chatId, role, content) {
    let entry = chatHistory.get(chatId);
    if (!entry || Date.now() - entry.lastActive > HISTORY_TTL) {
        entry = { messages: [], lastActive: Date.now() };
    }
    entry.messages.push({ role, content });
    if (entry.messages.length > MAX_HISTORY * 2) {
        entry.messages = entry.messages.slice(-MAX_HISTORY * 2);
    }
    entry.lastActive = Date.now();
    chatHistory.set(chatId, entry);
}

/**
 * Build context about a specific agent if mentioned
 */
async function buildAgentContext(text) {
    const context = [];

    // Check for agent ID mentions
    const idMatch = text.match(/#(\d+)|agent\s+(\d+)/i);
    if (idMatch) {
        const id = parseInt(idMatch[1] || idMatch[2]);
        try {
            const agent = await fetchAgent(id);
            if (agent) {
                context.push(`[Live data for Agent #${id}]: Name: ${agent.name || 'Unnamed'}, Cred Score: ${agent.credScore || 'N/A'}, Owner: ${agent.owner || 'Unknown'}, Personality: ${agent.personality || 'None set'}, Mission: ${agent.narrative?.mission || 'None'}`);
            }
        } catch (e) {}
    }

    // Check for leaderboard/top/ranking questions
    if (/leaderboard|top agents|ranking|best agents|highest cred/i.test(text)) {
        try {
            const leaders = await fetchLeaderboard();
            if (leaders?.length) {
                const top5 = leaders.slice(0, 5).map((a, i) =>
                    `${i+1}. ${a.name || `Agent #${a.tokenId}`} — Cred ${a.credScore}`
                ).join(', ');
                context.push(`[Live leaderboard top 5]: ${top5}`);
            }
        } catch (e) {}
    }

    // Check for job board questions
    if (/jobs?|work|gig|bounty|earn|hiring/i.test(text)) {
        try {
            const res = await new Promise((resolve, reject) => {
                https.get('https://api.helixa.xyz/api/v2/jobs', (r) => {
                    let body = '';
                    r.on('data', c => body += c);
                    r.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { reject(e); } });
                }).on('error', reject);
            });
            if (res?.total) {
                const srcSummary = Object.entries(res.sources || {})
                    .filter(([,v]) => v.count > 0)
                    .map(([k,v]) => `${k}: ${v.count}`)
                    .join(', ');
                context.push(`[Live job board]: ${res.total} total jobs. Sources: ${srcSummary}`);

                // Include a few sample jobs if asking about specific types
                const samples = res.jobs?.slice(0, 3).map(j =>
                    `"${j.title}" — ${j.budgetDisplay} (${j.sourceName}, cred ${j.credThreshold}+)`
                ).join('; ');
                if (samples) context.push(`[Sample jobs]: ${samples}`);
            }
        } catch (e) {}
    }

    return context.length > 0 ? '\n\n' + context.join('\n') : '';
}

/**
 * Call Venice AI chat completion
 */
async function callLLM(messages) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify({
            model: MODEL,
            messages,
            max_tokens: 500,
            temperature: 0.7,
        });

        const req = https.request({
            hostname: 'api.venice.ai',
            path: '/api/v1/chat/completions',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${VENICE_API_KEY}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
            },
        }, (res) => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    const content = data.choices?.[0]?.message?.content;
                    if (content) resolve(content);
                    else reject(new Error(data.error?.message || 'No response from LLM'));
                } catch (e) { reject(e); }
            });
        });
        req.on('error', reject);
        req.setTimeout(15000, () => { req.destroy(); reject(new Error('LLM timeout')); });
        req.write(payload);
        req.end();
    });
}

/**
 * Main chat function — called when bot is mentioned with no matching command
 */
async function chat(chatId, userText, username) {
    if (!VENICE_API_KEY) return null; // LLM disabled

    // Build context
    const agentContext = await buildAgentContext(userText);
    const history = getChatHistory(chatId);

    const messages = [
        { role: 'system', content: SYSTEM_PROMPT + agentContext },
        ...history,
        { role: 'user', content: `[${username || 'User'}]: ${userText}` },
    ];

    try {
        const response = await callLLM(messages);
        addToHistory(chatId, 'user', `[${username}]: ${userText}`);
        addToHistory(chatId, 'assistant', response);
        return response;
    } catch (err) {
        console.error('LLM error:', err.message);
        return null;
    }
}

module.exports = { chat };
