/**
 * Helixa MCP Server Handler
 * Implements Anthropic's Model Context Protocol via streamable HTTP transport.
 */
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { z } = require('zod');

function createMcpHandler({ indexer, formatAgentV2, getCredTier, computeCredBreakdown, getAllAgents, HIDDEN_TOKENS }) {

    return async function mcpHandler(req, res) {
        try {
            const server = new McpServer({
                name: 'helixa',
                version: '1.0.0',
            });

            // Tool: search_agents
            server.tool(
                'search_agents',
                'Search the Helixa agent registry by name, framework, or capability. Returns agents with cred scores.',
                {
                    query: z.string().optional().describe('Search query (name, framework, description)'),
                    minCredScore: z.number().optional().describe('Minimum cred score (0-100)'),
                    tier: z.enum(['JUNK', 'MARGINAL', 'QUALIFIED', 'PRIME', 'PREFERRED']).optional().describe('Minimum cred tier'),
                    verified: z.boolean().optional().describe('Only return verified agents'),
                    capability: z.string().optional().describe('Filter by capability/framework'),
                    limit: z.number().optional().describe('Max results (default 10, max 50)'),
                },
                async ({ query, minCredScore, tier, verified, capability, limit }) => {
                    const maxLimit = Math.min(50, Math.max(1, limit || 10));
                    const result = indexer.queryAgents({
                        page: 1,
                        limit: maxLimit,
                        sort: 'credScore',
                        order: 'desc',
                        search: query,
                        framework: capability,
                        verified: verified ? 'true' : undefined,
                        showSpam: false,
                    });

                    let agents = (result.agents || []).filter(a => !HIDDEN_TOKENS.has(a.tokenId));

                    const tierOrder = ['JUNK', 'MARGINAL', 'QUALIFIED', 'PRIME', 'PREFERRED'];
                    if (minCredScore) agents = agents.filter(a => (a.credScore || 0) >= minCredScore);
                    if (tier) {
                        const minIdx = tierOrder.indexOf(tier);
                        agents = agents.filter(a => tierOrder.indexOf(getCredTier(a.credScore || 0).tier) >= minIdx);
                    }

                    const mapped = agents.slice(0, maxLimit).map(a => ({
                        tokenId: a.tokenId,
                        name: a.name,
                        framework: a.framework,
                        credScore: a.credScore || 0,
                        tier: getCredTier(a.credScore || 0).tier,
                        verified: a.verified || false,
                        description: a.description || '',
                        profile_url: `https://api.helixa.xyz/api/v2/agent/${a.tokenId}`,
                    }));

                    return {
                        content: [{ type: 'text', text: JSON.stringify({ total: mapped.length, agents: mapped }, null, 2) }],
                    };
                }
            );

            // Tool: get_agent_profile
            server.tool(
                'get_agent_profile',
                'Get the full profile of a Helixa agent by token ID.',
                { tokenId: z.number().describe('Agent token ID') },
                async ({ tokenId }) => {
                    try {
                        const agent = await formatAgentV2(tokenId);
                        return { content: [{ type: 'text', text: JSON.stringify(agent, null, 2) }] };
                    } catch (e) {
                        return { content: [{ type: 'text', text: JSON.stringify({ error: e.message }) }], isError: true };
                    }
                }
            );

            // Tool: get_cred_score
            server.tool(
                'get_cred_score',
                'Get the cred score and tier for a Helixa agent.',
                { tokenId: z.number().describe('Agent token ID') },
                async ({ tokenId }) => {
                    try {
                        const agent = await formatAgentV2(tokenId);
                        const tierInfo = getCredTier(agent.credScore);
                        return {
                            content: [{
                                type: 'text',
                                text: JSON.stringify({
                                    tokenId, name: agent.name,
                                    credScore: agent.credScore, ...tierInfo,
                                }, null, 2),
                            }],
                        };
                    } catch (e) {
                        return { content: [{ type: 'text', text: JSON.stringify({ error: e.message }) }], isError: true };
                    }
                }
            );

            // Tool: get_stats
            server.tool(
                'get_stats',
                'Get Helixa registry statistics (total agents, tier distribution, etc).',
                {},
                async () => {
                    const all = indexer.getAllAgents().filter(a => !HIDDEN_TOKENS.has(a.tokenId));
                    const tiers = { JUNK: 0, MARGINAL: 0, QUALIFIED: 0, PRIME: 0, PREFERRED: 0 };
                    let totalCred = 0;
                    const frameworks = new Set();
                    for (const a of all) {
                        const t = getCredTier(a.credScore || 0).tier;
                        tiers[t]++;
                        totalCred += (a.credScore || 0);
                        if (a.framework) frameworks.add(a.framework);
                    }
                    return {
                        content: [{
                            type: 'text',
                            text: JSON.stringify({
                                totalAgents: all.length,
                                averageCredScore: all.length ? Math.round(totalCred / all.length) : 0,
                                tierDistribution: tiers,
                                frameworks: [...frameworks],
                            }, null, 2),
                        }],
                    };
                }
            );

            const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
            res.on('close', () => { transport.close(); server.close(); });
            await server.connect(transport);
            await transport.handleRequest(req, res, req.body);
        } catch (e) {
            console.error('MCP handler error:', e.message);
            if (!res.headersSent) res.status(500).json({ error: 'MCP error', message: e.message });
        }
    };
}

module.exports = { createMcpHandler };
