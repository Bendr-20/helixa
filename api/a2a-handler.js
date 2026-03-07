/**
 * Helixa A2A (Agent-to-Agent) Handler
 * Implements Google's Agent-to-Agent protocol (JSON-RPC 2.0).
 */

function createA2AHandler({ indexer, formatAgentV2, getCredTier, HIDDEN_TOKENS }) {

    async function handleTask(params) {
        const { message } = params || {};
        const parts = message?.parts || [];
        const textPart = parts.find(p => p.type === 'text');
        const text = textPart?.text || '';

        // Simple intent routing
        const lower = text.toLowerCase();

        if (lower.includes('search') || lower.includes('find') || lower.includes('lookup agent')) {
            const query = text.replace(/^(search|find|lookup)\s*(agents?|for)?\s*/i, '').trim();
            const result = indexer.queryAgents({
                page: 1, limit: 10, sort: 'credScore', order: 'desc',
                search: query || undefined, showSpam: false,
            });
            const agents = (result.agents || [])
                .filter(a => !HIDDEN_TOKENS.has(a.tokenId))
                .slice(0, 10)
                .map(a => ({
                    tokenId: a.tokenId, name: a.name, framework: a.framework,
                    credScore: a.credScore || 0, tier: getCredTier(a.credScore || 0).tier,
                }));
            return {
                type: 'text',
                text: JSON.stringify({ action: 'search', results: agents }, null, 2),
            };
        }

        if (lower.includes('cred') && lower.match(/\d+/)) {
            const tokenId = parseInt(lower.match(/\d+/)[0]);
            try {
                const agent = await formatAgentV2(tokenId);
                const tierInfo = getCredTier(agent.credScore);
                return {
                    type: 'text',
                    text: JSON.stringify({
                        action: 'cred-check',
                        tokenId, name: agent.name,
                        credScore: agent.credScore, ...tierInfo,
                    }, null, 2),
                };
            } catch (e) {
                return { type: 'text', text: JSON.stringify({ error: e.message }) };
            }
        }

        if (lower.includes('profile') && lower.match(/\d+/)) {
            const tokenId = parseInt(lower.match(/\d+/)[0]);
            try {
                const agent = await formatAgentV2(tokenId);
                return { type: 'text', text: JSON.stringify({ action: 'profile-lookup', agent }, null, 2) };
            } catch (e) {
                return { type: 'text', text: JSON.stringify({ error: e.message }) };
            }
        }

        return {
            type: 'text',
            text: JSON.stringify({
                action: 'help',
                message: 'Helixa Agent Registry — I can help with: search agents, cred check <tokenId>, profile <tokenId>',
                capabilities: ['search', 'cred-check', 'profile-lookup'],
            }, null, 2),
        };
    }

    return async function a2aHandler(req, res) {
        try {
            const { jsonrpc, id, method, params } = req.body || {};

            if (jsonrpc !== '2.0') {
                return res.status(400).json({ jsonrpc: '2.0', id, error: { code: -32600, message: 'Invalid JSON-RPC' } });
            }

            if (method === 'tasks/send') {
                const resultPart = await handleTask(params);
                const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                return res.json({
                    jsonrpc: '2.0', id,
                    result: {
                        id: taskId,
                        status: { state: 'completed' },
                        artifacts: [{
                            parts: [resultPart],
                        }],
                    },
                });
            }

            if (method === 'tasks/get') {
                return res.json({
                    jsonrpc: '2.0', id,
                    error: { code: -32601, message: 'Task history not supported — tasks are completed synchronously' },
                });
            }

            return res.json({
                jsonrpc: '2.0', id,
                error: { code: -32601, message: `Method not found: ${method}` },
            });
        } catch (e) {
            console.error('A2A handler error:', e.message);
            res.status(500).json({
                jsonrpc: '2.0', id: req.body?.id || null,
                error: { code: -32603, message: e.message },
            });
        }
    };
}

module.exports = { createA2AHandler };
