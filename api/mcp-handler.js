/**
 * Helixa MCP Server Handler
 * Implements Anthropic's Model Context Protocol via streamable HTTP transport.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { z } = require('zod');

const HELP_REQUESTS_PATH = path.join(__dirname, '..', 'data', 'human-help-requests.json');
const SYNAGENT_MATCH_URL = 'https://synagent.helixa.xyz/match';
const TIER_ORDER = ['JUNK', 'MARGINAL', 'QUALIFIED', 'PRIME', 'PREFERRED'];

function loadHelpRequests() {
    try {
        const parsed = JSON.parse(fs.readFileSync(HELP_REQUESTS_PATH, 'utf8'));
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveHelpRequests(requests) {
    fs.mkdirSync(path.dirname(HELP_REQUESTS_PATH), { recursive: true });
    fs.writeFileSync(HELP_REQUESTS_PATH, JSON.stringify(requests, null, 2));
}

function jsonResult(payload) {
    return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
    };
}

function errorResult(message, extra = {}) {
    return {
        content: [{ type: 'text', text: JSON.stringify({ error: message, ...extra }, null, 2) }],
        isError: true,
    };
}

function clampString(value, max = 512) {
    return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function clampList(values, maxItems = 12, maxChars = 64) {
    if (!Array.isArray(values)) return [];
    const out = [];
    for (const value of values) {
        const next = clampString(value, maxChars);
        if (!next) continue;
        if (!out.some(existing => existing.toLowerCase() === next.toLowerCase())) out.push(next);
        if (out.length >= maxItems) break;
    }
    return out;
}

function normalizeText(value) {
    return clampString(value, 2000).toLowerCase();
}

function normalizeId(value) {
    return typeof value === 'number' ? String(value) : clampString(value, 128);
}

function tierPasses(getCredTier, credScore, minTier) {
    if (!minTier) return true;
    const minIdx = TIER_ORDER.indexOf(minTier);
    if (minIdx < 0) return true;
    const tier = getCredTier(credScore || 0).tier;
    return TIER_ORDER.indexOf(tier) >= minIdx;
}

function getAgentVerifications(agent) {
    const traits = Array.isArray(agent?.traits) ? agent.traits : [];
    const derived = ['siwa-verified', 'x-verified', 'github-verified', 'farcaster-verified', 'coinbase-verified']
        .filter(value => traits.some(trait => trait?.name === value || trait === value))
        .map(value => value.replace('-verified', ''));
    if (agent?.verified && !derived.includes('registry')) derived.unshift('registry');
    return derived;
}

function toKeywordTerms(value) {
    const stopwords = new Set(['with', 'that', 'this', 'from', 'need', 'needs', 'help', 'human', 'agent', 'work', 'want', 'into', 'for', 'and', 'the', 'you', 'your', 'our']);
    return normalizeText(value)
        .split(/[^a-z0-9+#.-]+/)
        .map(term => term.trim())
        .filter(term => term.length >= 4 && !stopwords.has(term))
        .slice(0, 12);
}

function extractNeedles({ query, requiredSkills, category }) {
    return {
        query: normalizeText(query),
        queryTerms: toKeywordTerms(query),
        requiredSkills: clampList(requiredSkills || [], 12, 64).map(value => value.toLowerCase()),
        category: normalizeText(category),
    };
}

function makeSearchHaystack(parts) {
    return parts.filter(Boolean).join(' ').toLowerCase();
}

function buildAgentSummary(agent, getCredTier) {
    const tierInfo = getCredTier(agent.credScore || 0);
    const verifications = getAgentVerifications(agent);
    return {
        entityType: 'agent',
        id: String(agent.tokenId),
        tokenId: agent.tokenId,
        name: agent.name,
        framework: agent.framework,
        description: agent.description || '',
        credScore: agent.credScore || 0,
        tier: tierInfo.tier,
        tierLabel: tierInfo.label,
        verified: verifications.length > 0,
        verifications,
        suggested_actions: {
            profile: `https://api.helixa.xyz/api/v2/agent/${agent.tokenId}`,
            cred: `https://api.helixa.xyz/api/v2/agent/${agent.tokenId}/cred`,
            card: `https://api.helixa.xyz/api/v2/card/${agent.tokenId}.png`,
            publicProfile: `https://helixa.xyz/agent/${agent.tokenId}`,
        },
    };
}

async function buildHumanSummary(profile, formatHumanPrincipal, getCredTier) {
    const formatted = await formatHumanPrincipal(profile, { includePrivate: false });
    const score = formatted?.humanCred?.score || 0;
    const tierInfo = getCredTier(score);
    const id = formatted.tokenId != null ? String(formatted.tokenId) : formatted.walletAddress;
    return {
        entityType: 'human',
        id,
        tokenId: formatted.tokenId,
        walletAddress: formatted.walletAddress,
        name: formatted.name,
        description: formatted.description || '',
        organization: formatted.organization || '',
        credScore: score,
        tier: tierInfo.tier,
        tierLabel: tierInfo.label,
        verified: Boolean(formatted.walletAddress),
        verifications: formatted.walletAddress ? ['wallet'] : [],
        skills: formatted.skills || [],
        domains: formatted.domains || [],
        serviceCategories: formatted.metadata?.serviceCategories || [],
        openToWork: formatted.metadata?.openToWork !== false,
        preferredCommunicationChannels: formatted.metadata?.preferredCommunicationChannels || [],
        suggested_actions: {
            profile: `https://api.helixa.xyz/api/v2/human/${id}`,
            cred: `https://api.helixa.xyz/api/v2/human/${id}/cred`,
            publicProfile: `https://helixa.xyz/h/${id}`,
        },
        profile: formatted,
    };
}

function agentMatches(summary, filters) {
    const needles = extractNeedles(filters);
    const haystack = makeSearchHaystack([
        summary.name,
        summary.framework,
        summary.description,
    ]);

    if (needles.query && !haystack.includes(needles.query)) {
        const overlapCount = needles.queryTerms.filter(term => haystack.includes(term)).length;
        const minOverlap = needles.queryTerms.length > 2 ? 2 : 1;
        if (overlapCount < minOverlap) return false;
    }
    if (filters.minCredScore != null && (summary.credScore || 0) < filters.minCredScore) return false;
    if (!tierPasses(filters.getCredTier, summary.credScore || 0, filters.tier)) return false;
    if (filters.verified && !summary.verified) return false;
    if (filters.capability) {
        const capability = normalizeText(filters.capability);
        const framework = normalizeText(summary.framework);
        if (capability && framework !== capability && !haystack.includes(capability)) return false;
    }
    return true;
}

function humanMatches(summary, filters) {
    const needles = extractNeedles(filters);
    const haystack = makeSearchHaystack([
        summary.name,
        summary.description,
        summary.organization,
        ...(summary.skills || []),
        ...(summary.domains || []),
        ...(summary.serviceCategories || []),
    ]);

    if (needles.query && !haystack.includes(needles.query)) {
        const overlapCount = needles.queryTerms.filter(term => haystack.includes(term)).length;
        const minOverlap = needles.queryTerms.length > 2 ? 2 : 1;
        if (overlapCount < minOverlap) return false;
    }
    if (filters.minCredScore != null && (summary.credScore || 0) < filters.minCredScore) return false;
    if (!tierPasses(filters.getCredTier, summary.credScore || 0, filters.tier)) return false;
    if (filters.verified && !summary.verified) return false;
    if (filters.capability) {
        const capability = normalizeText(filters.capability);
        const exactPools = [
            ...(summary.skills || []),
            ...(summary.domains || []),
            ...(summary.serviceCategories || []),
        ].map(value => value.toLowerCase());
        if (capability && !exactPools.includes(capability)) return false;
    }
    if (filters.openToWork === true && summary.openToWork === false) return false;
    return true;
}

function buildNeedleSummary(input = {}) {
    return {
        query: clampString(input.query, 512),
        requiredSkills: clampList(input.requiredSkills || [], 12, 64),
        category: clampString(input.category, 64),
        capability: clampString(input.capability, 64),
    };
}

function buildSynagentHandoff(input = {}, extra = {}) {
    const payload = {
        source: 'helixa-mcp',
        requestId: clampString(extra.requestId, 64) || null,
        title: clampString(input.title, 160) || null,
        brief: clampString(input.brief || input.query, 4000) || null,
        requester: clampString(input.requester, 160) || null,
        contact: clampString(input.contact, 256) || null,
        budget: clampString(input.budget, 128) || null,
        urgency: clampString(input.urgency, 32) || null,
        category: clampString(input.category, 64) || null,
        capability: clampString(input.capability, 64) || null,
        principalType: clampString(input.principalType, 32) || null,
        requiredSkills: clampList(input.requiredSkills || [], 12, 64),
        candidateId: normalizeId(extra.candidateId) || null,
        candidateType: clampString(extra.candidateType, 32) || null,
        candidateName: clampString(extra.candidateName, 160) || null,
    };

    const params = new URLSearchParams();
    params.set('source', payload.source);
    if (payload.requestId) params.set('requestId', payload.requestId);
    if (payload.title) params.set('title', payload.title);
    if (payload.brief) params.set('brief', payload.brief);
    if (payload.requester) params.set('requester', payload.requester);
    if (payload.contact) params.set('contact', payload.contact);
    if (payload.budget) params.set('budget', payload.budget);
    if (payload.urgency) params.set('urgency', payload.urgency);
    if (payload.category) params.set('category', payload.category);
    if (payload.capability) params.set('capability', payload.capability);
    if (payload.principalType) params.set('principalType', payload.principalType);
    if (payload.requiredSkills.length) params.set('requiredSkills', payload.requiredSkills.join(','));
    if (payload.candidateId) params.set('candidateId', payload.candidateId);
    if (payload.candidateType) params.set('candidateType', payload.candidateType);
    if (payload.candidateName) params.set('candidateName', payload.candidateName);

    return {
        url: `${SYNAGENT_MATCH_URL}?${params.toString()}`,
        payload,
        message: 'Open this Synagent intake link to continue the request in the boutique front door.',
    };
}

function scoreCandidate(candidate, request) {
    const reasons = [];
    const query = normalizeText(request.query || request.brief || '');
    const requiredSkills = clampList(request.requiredSkills || [], 12, 64).map(value => value.toLowerCase());
    const category = normalizeText(request.category);

    const haystack = candidate.entityType === 'human'
        ? makeSearchHaystack([
            candidate.name,
            candidate.description,
            candidate.organization,
            ...(candidate.skills || []),
            ...(candidate.domains || []),
            ...(candidate.serviceCategories || []),
        ])
        : makeSearchHaystack([candidate.name, candidate.framework, candidate.description]);

    const breakdown = {
        cred: Math.min(30, Math.round(Math.max(0, Math.min(100, Number(candidate.credScore || 0))) * 0.30)),
        briefOverlap: 0,
        capability: 0,
        requiredSkills: 0,
        category: 0,
        verification: 0,
        availability: 0,
    };

    if (query && haystack.includes(query)) {
        breakdown.briefOverlap = 20;
        reasons.push('Matches the brief language directly');
    } else {
        const queryTerms = toKeywordTerms(request.query || request.brief || '');
        const overlapTerms = queryTerms.filter(term => haystack.includes(term));
        if (overlapTerms.length) {
            breakdown.briefOverlap = Math.min(16, overlapTerms.length * 6);
            reasons.push(`Relevant brief overlap: ${overlapTerms.slice(0, 3).join(', ')}`);
        }
    }

    if (request.capability) {
        const capability = normalizeText(request.capability);
        if (candidate.entityType === 'agent') {
            if (normalizeText(candidate.framework) === capability || haystack.includes(capability)) {
                breakdown.capability = 18;
                reasons.push(`Capability match on ${request.capability}`);
            }
        } else {
            const pools = [
                ...(candidate.skills || []),
                ...(candidate.domains || []),
                ...(candidate.serviceCategories || []),
            ].map(value => value.toLowerCase());
            if (pools.includes(capability) || haystack.includes(capability)) {
                breakdown.capability = 18;
                reasons.push(`Capability match on ${request.capability}`);
            }
        }
    }

    if (requiredSkills.length) {
        const pools = candidate.entityType === 'human'
            ? [
                ...(candidate.skills || []),
                ...(candidate.domains || []),
                ...(candidate.serviceCategories || []),
            ].map(value => value.toLowerCase())
            : [normalizeText(candidate.framework), haystack];
        const overlaps = requiredSkills.filter(skill => pools.some(value => value && value.includes(skill)));
        if (overlaps.length) {
            breakdown.requiredSkills = Math.min(18, overlaps.length * 9);
            reasons.push(`Skill overlap: ${overlaps.slice(0, 3).join(', ')}`);
        }
    }

    if (category) {
        const categoryMatch = candidate.entityType === 'human'
            ? (candidate.serviceCategories || []).some(value => value.toLowerCase() === category) || haystack.includes(category)
            : haystack.includes(category);
        if (categoryMatch) {
            breakdown.category = 8;
            reasons.push(`Relevant to ${request.category}`);
        }
    }

    if (candidate.verified) {
        breakdown.verification = 4;
        reasons.push('Has verification signals');
    }

    if (candidate.entityType === 'human' && candidate.openToWork !== false) {
        breakdown.availability = 6;
        reasons.push('Marked open to work');
    }

    if (!reasons.length) reasons.push('High baseline Cred relative to the request');

    const score = Object.values(breakdown).reduce((sum, value) => sum + value, 0);

    return {
        score: Math.max(0, Math.min(100, Math.round(score))),
        reasons: reasons.slice(0, 4),
        breakdown,
    };
}

async function findPrincipalMatches(input, deps) {
    const {
        indexer,
        getCredTier,
        formatHumanPrincipal,
        loadHumanProfiles,
        HIDDEN_TOKENS,
    } = deps;
    const limit = Math.min(25, Math.max(1, Number(input.limit) || 10));
    const principalType = input.principalType || 'all';
    const normalizedFilters = {
        query: clampString(input.query, 512),
        brief: clampString(input.brief, 4000),
        minCredScore: input.minCredScore != null ? Number(input.minCredScore) : undefined,
        tier: input.tier,
        verified: Boolean(input.verified),
        capability: clampString(input.capability, 64),
        requiredSkills: clampList(input.requiredSkills || [], 12, 64),
        category: clampString(input.category, 64),
        openToWork: input.openToWork,
        getCredTier,
    };

    const matches = [];

    if (principalType === 'all' || principalType === 'agent') {
        const agentSearch = normalizedFilters.query && normalizedFilters.query.trim().split(/\s+/).length === 1
            ? normalizedFilters.query
            : undefined;
        let rawAgents = [];
        try {
            const result = indexer.queryAgents({
                page: 1,
                limit: 200,
                sort: 'credScore',
                order: 'desc',
                search: agentSearch,
                framework: normalizedFilters.capability || undefined,
                verified: normalizedFilters.verified ? 'true' : undefined,
                showSpam: false,
            });
            rawAgents = result.agents || [];
        } catch {
            rawAgents = indexer.getAllAgents().slice(0, 200);
        }

        let agents = rawAgents.filter(agent => !HIDDEN_TOKENS.has(agent.tokenId));
        agents = agents
            .map(agent => buildAgentSummary(agent, getCredTier))
            .filter(agent => agentMatches(agent, normalizedFilters));

        for (const agent of agents) {
            const scored = scoreCandidate(agent, normalizedFilters);
            matches.push({
                ...agent,
                matchScore: scored.score,
                recommendationReasoning: scored.reasons,
                scoreBreakdown: scored.breakdown,
            });
        }
    }

    if (principalType === 'all' || principalType === 'human') {
        const humanProfiles = Object.values(loadHumanProfiles()).filter(profile => profile?.active !== false);
        for (const profile of humanProfiles) {
            const human = await buildHumanSummary(profile, formatHumanPrincipal, getCredTier);
            if (!humanMatches(human, normalizedFilters)) continue;
            const scored = scoreCandidate(human, normalizedFilters);
            matches.push({
                ...human,
                matchScore: scored.score,
                recommendationReasoning: scored.reasons,
                scoreBreakdown: scored.breakdown,
            });
        }
    }

    matches.sort((a, b) => {
        if ((b.matchScore || 0) !== (a.matchScore || 0)) return (b.matchScore || 0) - (a.matchScore || 0);
        return (b.credScore || 0) - (a.credScore || 0);
    });

    return {
        total: matches.length,
        principalType,
        filters: {
            ...buildNeedleSummary(normalizedFilters),
            minCredScore: normalizedFilters.minCredScore ?? null,
            tier: normalizedFilters.tier || null,
            verified: normalizedFilters.verified,
            openToWork: normalizedFilters.openToWork ?? null,
        },
        matches: matches.slice(0, limit),
    };
}

function findHelpRequest(requestId) {
    return loadHelpRequests().find(item => item.id === requestId) || null;
}

function persistHelpRequest(request) {
    const requests = loadHelpRequests();
    requests.unshift(request);
    saveHelpRequests(requests.slice(0, 1000));
    return request;
}

async function resolvePrincipalProfile(id, entityType, deps) {
    const normalizedId = normalizeId(id);
    if (!normalizedId) throw new Error('id is required');

    if (entityType === 'human' || entityType === 'auto') {
        const humanProfile = deps.getHumanProfileById(normalizedId);
        if (humanProfile) {
            return {
                entityType: 'human',
                profile: await deps.formatHumanPrincipal(humanProfile, { includePrivate: false }),
            };
        }
        if (entityType === 'human') throw new Error('Human principal not found');
    }

    if (entityType === 'agent' || entityType === 'auto') {
        const tokenId = Number(normalizedId);
        if (!Number.isInteger(tokenId)) {
            if (entityType === 'agent') throw new Error('Agent tokenId must be numeric');
        } else {
            return {
                entityType: 'agent',
                profile: await deps.formatAgentV2(tokenId),
            };
        }
    }

    throw new Error('Principal not found');
}

function hydrateRequestInput(input, principalType) {
    return {
        title: clampString(input.title, 160),
        brief: clampString(input.brief, 4000),
        requester: clampString(input.requester, 160),
        contact: clampString(input.contact, 256),
        budget: clampString(input.budget, 128),
        urgency: clampString(input.urgency || 'medium', 32) || 'medium',
        category: clampString(input.category, 64),
        capability: clampString(input.capability, 64),
        requiredSkills: clampList(input.requiredSkills || [], 12, 64),
        principalType,
        limit: Math.min(10, Math.max(1, Number(input.limit) || 5)),
    };
}

function buildStoredRequest(input, matches) {
    const now = new Date().toISOString();
    const request = {
        id: `req_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
        createdAt: now,
        updatedAt: now,
        status: 'submitted',
        title: input.title || (input.brief ? input.brief.slice(0, 80) : 'Untitled brief'),
        brief: input.brief,
        requester: input.requester || null,
        contact: input.contact || null,
        budget: input.budget || null,
        urgency: input.urgency,
        category: input.category || null,
        capability: input.capability || null,
        requiredSkills: input.requiredSkills,
        principalType: input.principalType,
        recommendationCount: matches.matches.length,
        recommendations: matches.matches.map(match => ({
            id: match.id,
            entityType: match.entityType,
            name: match.name,
            matchScore: match.matchScore,
            credScore: match.credScore,
            recommendationReasoning: match.recommendationReasoning,
            scoreBreakdown: match.scoreBreakdown,
            suggested_actions: match.suggested_actions,
        })),
    };
    request.handoff = buildSynagentHandoff(request, { requestId: request.id });
    return request;
}

function buildReasoningPayload(candidate, request) {
    const reasoning = scoreCandidate(candidate, request);
    return {
        candidate: {
            id: candidate.id,
            entityType: candidate.entityType,
            name: candidate.name,
            credScore: candidate.credScore,
            tier: candidate.tier,
        },
        request: {
            query: request.query || request.brief || '',
            capability: request.capability || null,
            category: request.category || null,
            requiredSkills: request.requiredSkills || [],
        },
        matchScore: reasoning.score,
        recommendationReasoning: reasoning.reasons,
        scoreBreakdown: reasoning.breakdown,
    };
}

function createMcpHandler({
    indexer,
    formatAgentV2,
    getCredTier,
    computeCredBreakdown,
    getAllAgents,
    HIDDEN_TOKENS,
    loadHumanProfiles,
    getHumanProfileById,
    formatHumanPrincipal,
    computeHumanCred,
}) {

    return async function mcpHandler(req, res) {
        try {
            const server = new McpServer({
                name: 'helixa',
                version: '1.2.0',
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

                    if (minCredScore != null) agents = agents.filter(a => (a.credScore || 0) >= minCredScore);
                    if (tier) agents = agents.filter(a => tierPasses(getCredTier, a.credScore || 0, tier));

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

                    return jsonResult({ total: mapped.length, agents: mapped });
                }
            );

            // Tool: find_matches
            server.tool(
                'find_matches',
                'Search Helixa principals, agents, humans, or both, and return ranked matches with recommendation reasoning.',
                {
                    query: z.string().optional().describe('Search query or short description of the work needed'),
                    principalType: z.enum(['all', 'agent', 'human']).optional().describe('Which principal types to search'),
                    requiredSkills: z.array(z.string()).optional().describe('Skills or capabilities that should overlap'),
                    category: z.string().optional().describe('Relevant service category or work category'),
                    capability: z.string().optional().describe('Specific framework, skill, or service capability to prefer'),
                    minCredScore: z.number().optional().describe('Minimum Cred score (0-100)'),
                    tier: z.enum(['JUNK', 'MARGINAL', 'QUALIFIED', 'PRIME', 'PREFERRED']).optional().describe('Minimum Cred tier'),
                    verified: z.boolean().optional().describe('Only return verified principals'),
                    openToWork: z.boolean().optional().describe('For humans, only include principals open to work'),
                    limit: z.number().optional().describe('Max results (default 10, max 25)'),
                },
                async (input) => {
                    const result = await findPrincipalMatches(input, {
                        indexer,
                        getCredTier,
                        formatHumanPrincipal,
                        loadHumanProfiles,
                        HIDDEN_TOKENS,
                    });
                    return jsonResult(result);
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
                        return jsonResult(agent);
                    } catch (e) {
                        return errorResult(e.message);
                    }
                }
            );

            // Tool: get_principal_profile
            server.tool(
                'get_principal_profile',
                'Get a Helixa principal profile by ID. Supports both agents and human principals.',
                {
                    id: z.union([z.string(), z.number()]).describe('Principal ID. Agent token ID, human token ID, or human wallet address'),
                    entityType: z.enum(['auto', 'agent', 'human']).optional().describe('Force principal type or auto-detect'),
                },
                async ({ id, entityType = 'auto' }) => {
                    try {
                        const resolved = await resolvePrincipalProfile(id, entityType, {
                            formatAgentV2,
                            getHumanProfileById,
                            formatHumanPrincipal,
                        });
                        return jsonResult(resolved);
                    } catch (e) {
                        return errorResult(e.message);
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
                        return jsonResult({
                            tokenId,
                            name: agent.name,
                            credScore: agent.credScore,
                            ...tierInfo,
                        });
                    } catch (e) {
                        return errorResult(e.message);
                    }
                }
            );

            // Tool: submit_brief
            server.tool(
                'submit_brief',
                'Submit a work brief to Helixa, store it server-side, and get ranked principal recommendations.',
                {
                    brief: z.string().describe('Plain-language description of the work needed'),
                    title: z.string().optional().describe('Optional short title for the brief'),
                    requester: z.string().optional().describe('Who is making the request'),
                    contact: z.string().optional().describe('How to follow up with the requester'),
                    budget: z.string().optional().describe('Optional budget or pricing context'),
                    urgency: z.enum(['low', 'medium', 'high', 'urgent']).optional().describe('Urgency level'),
                    category: z.string().optional().describe('Relevant work category'),
                    capability: z.string().optional().describe('Specific framework, skill, or service capability'),
                    requiredSkills: z.array(z.string()).optional().describe('Required skills or capabilities'),
                    principalType: z.enum(['all', 'agent', 'human']).optional().describe('Which principals to recommend'),
                    limit: z.number().optional().describe('How many recommendations to return (default 5, max 10)'),
                },
                async (input) => {
                    const hydrated = hydrateRequestInput(input, input.principalType || 'all');
                    if (!hydrated.brief) return errorResult('brief is required');

                    const matches = await findPrincipalMatches({
                        brief: hydrated.brief,
                        principalType: hydrated.principalType,
                        requiredSkills: hydrated.requiredSkills,
                        category: hydrated.category,
                        capability: hydrated.capability,
                        limit: hydrated.limit,
                    }, {
                        indexer,
                        getCredTier,
                        formatHumanPrincipal,
                        loadHumanProfiles,
                        HIDDEN_TOKENS,
                    });

                    const request = persistHelpRequest(buildStoredRequest(hydrated, matches));
                    return jsonResult({ success: true, request, matches, handoff: request.handoff });
                }
            );

            // Tool: request_human_help
            server.tool(
                'request_human_help',
                'Submit a human-help request, store it server-side, and return ranked human matches.',
                {
                    brief: z.string().describe('Plain-language description of the help needed'),
                    title: z.string().optional().describe('Optional short title for the request'),
                    requester: z.string().optional().describe('Who is making the request'),
                    contact: z.string().optional().describe('How to follow up with the requester'),
                    budget: z.string().optional().describe('Optional budget or pricing context'),
                    urgency: z.enum(['low', 'medium', 'high', 'urgent']).optional().describe('Urgency level'),
                    category: z.string().optional().describe('Relevant service category'),
                    capability: z.string().optional().describe('Specific skill or service capability'),
                    requiredSkills: z.array(z.string()).optional().describe('Required skills or capabilities'),
                    limit: z.number().optional().describe('How many recommendations to return (default 5, max 10)'),
                },
                async (input) => {
                    const hydrated = hydrateRequestInput(input, 'human');
                    if (!hydrated.brief) return errorResult('brief is required');

                    const matches = await findPrincipalMatches({
                        brief: hydrated.brief,
                        principalType: 'human',
                        requiredSkills: hydrated.requiredSkills,
                        category: hydrated.category,
                        capability: hydrated.capability,
                        openToWork: true,
                        limit: hydrated.limit,
                    }, {
                        indexer,
                        getCredTier,
                        formatHumanPrincipal,
                        loadHumanProfiles,
                        HIDDEN_TOKENS,
                    });

                    const request = persistHelpRequest(buildStoredRequest(hydrated, matches));
                    return jsonResult({
                        success: true,
                        request,
                        matches,
                        handoff: request.handoff,
                        nextActions: [
                            'Review the ranked human principals',
                            'Use get_principal_profile for any shortlisted human',
                            'Use handoff_to_synagent to continue in the Synagent intake flow',
                            'Use track_job with the returned request id to retrieve the stored brief later',
                        ],
                    });
                }
            );

            // Tool: handoff_to_synagent
            server.tool(
                'handoff_to_synagent',
                'Create a Synagent intake handoff URL from a stored request or inline brief fields.',
                {
                    requestId: z.string().optional().describe('Stored request ID returned by submit_brief or request_human_help'),
                    brief: z.string().optional().describe('Plain-language description of the work if no stored request is used'),
                    title: z.string().optional().describe('Optional short title for the intake'),
                    requester: z.string().optional().describe('Who is making the request'),
                    contact: z.string().optional().describe('How to follow up with the requester'),
                    budget: z.string().optional().describe('Optional budget or pricing context'),
                    urgency: z.enum(['low', 'medium', 'high', 'urgent']).optional().describe('Urgency level'),
                    category: z.string().optional().describe('Relevant work category'),
                    capability: z.string().optional().describe('Specific framework, skill, or service capability'),
                    requiredSkills: z.array(z.string()).optional().describe('Required skills or capabilities'),
                    principalType: z.enum(['all', 'agent', 'human']).optional().describe('Which principal types should be favored'),
                    candidateId: z.union([z.string(), z.number()]).optional().describe('Optional matched candidate to preselect'),
                    entityType: z.enum(['auto', 'agent', 'human']).optional().describe('Type of the optional candidate'),
                },
                async ({ requestId, candidateId, entityType = 'auto', ...input }) => {
                    try {
                        let request = null;
                        if (requestId) {
                            request = findHelpRequest(clampString(requestId, 64));
                            if (!request) return errorResult('Request not found', { requestId });
                        } else {
                            request = hydrateRequestInput(input, input.principalType || 'all');
                            if (!request.brief) return errorResult('brief is required when requestId is not provided');
                        }

                        let candidate = null;
                        if (candidateId != null) {
                            const resolved = await resolvePrincipalProfile(candidateId, entityType, {
                                formatAgentV2,
                                getHumanProfileById,
                                formatHumanPrincipal,
                            });
                            candidate = {
                                id: resolved.entityType === 'agent' ? String(resolved.profile.tokenId) : normalizeId(resolved.profile.tokenId != null ? resolved.profile.tokenId : resolved.profile.walletAddress),
                                entityType: resolved.entityType,
                                name: resolved.profile.name,
                            };
                        }

                        const handoff = buildSynagentHandoff(request, {
                            requestId: request.id || null,
                            candidateId: candidate?.id,
                            candidateType: candidate?.entityType,
                            candidateName: candidate?.name,
                        });

                        return jsonResult({
                            success: true,
                            request,
                            candidate,
                            handoff,
                        });
                    } catch (e) {
                        return errorResult(e.message);
                    }
                }
            );

            // Tool: track_job
            server.tool(
                'track_job',
                'Retrieve a previously submitted brief or human-help request by request ID.',
                { requestId: z.string().describe('Stored request ID returned by submit_brief or request_human_help') },
                async ({ requestId }) => {
                    const request = findHelpRequest(clampString(requestId, 64));
                    if (!request) return errorResult('Request not found', { requestId });
                    return jsonResult({ success: true, request, handoff: request.handoff || buildSynagentHandoff(request, { requestId: request.id }) });
                }
            );

            // Tool: get_recommendation_reasoning
            server.tool(
                'get_recommendation_reasoning',
                'Explain why a candidate principal matches a brief or stored request.',
                {
                    candidateId: z.union([z.string(), z.number()]).describe('Principal ID to explain'),
                    entityType: z.enum(['auto', 'agent', 'human']).optional().describe('Force principal type or auto-detect'),
                    requestId: z.string().optional().describe('Stored request ID'),
                    brief: z.string().optional().describe('Inline brief when requestId is not provided'),
                    capability: z.string().optional().describe('Specific desired capability'),
                    category: z.string().optional().describe('Relevant service category'),
                    requiredSkills: z.array(z.string()).optional().describe('Required skills or capabilities'),
                },
                async ({ candidateId, entityType = 'auto', requestId, brief, capability, category, requiredSkills }) => {
                    try {
                        const resolved = await resolvePrincipalProfile(candidateId, entityType, {
                            formatAgentV2,
                            getHumanProfileById,
                            formatHumanPrincipal,
                        });

                        const request = requestId
                            ? findHelpRequest(clampString(requestId, 64))
                            : {
                                brief: clampString(brief, 4000),
                                capability: clampString(capability, 64),
                                category: clampString(category, 64),
                                requiredSkills: clampList(requiredSkills || [], 12, 64),
                            };

                        if (!request) return errorResult('Request not found', { requestId });
                        if (!request.brief && !request.capability && !(request.requiredSkills || []).length && !request.category) {
                            return errorResult('Provide requestId or enough inline request context to score the candidate');
                        }

                        let candidate;
                        if (resolved.entityType === 'human') {
                            const formatted = resolved.profile;
                            candidate = {
                                entityType: 'human',
                                id: formatted.tokenId != null ? String(formatted.tokenId) : formatted.walletAddress,
                                name: formatted.name,
                                description: formatted.description || '',
                                organization: formatted.organization || '',
                                credScore: formatted.humanCred?.score || 0,
                                tier: formatted.humanCred?.tier?.tier || getCredTier(formatted.humanCred?.score || 0).tier,
                                verified: Boolean(formatted.walletAddress),
                                skills: formatted.skills || [],
                                domains: formatted.domains || [],
                                serviceCategories: formatted.metadata?.serviceCategories || [],
                                openToWork: formatted.metadata?.openToWork !== false,
                            };
                        } else {
                            candidate = {
                                entityType: 'agent',
                                id: String(resolved.profile.tokenId),
                                name: resolved.profile.name,
                                description: resolved.profile.description || '',
                                framework: resolved.profile.framework,
                                credScore: resolved.profile.credScore || 0,
                                tier: getCredTier(resolved.profile.credScore || 0).tier,
                                verified: Boolean(resolved.profile.verified),
                            };
                        }

                        return jsonResult(buildReasoningPayload(candidate, request));
                    } catch (e) {
                        return errorResult(e.message);
                    }
                }
            );

            // Tool: get_stats
            server.tool(
                'get_stats',
                'Get Helixa registry statistics, including total agents, humans, and tier distribution.',
                {},
                async () => {
                    const allAgents = getAllAgents().filter(a => !HIDDEN_TOKENS.has(a.tokenId));
                    const tiers = { JUNK: 0, MARGINAL: 0, QUALIFIED: 0, PRIME: 0, PREFERRED: 0 };
                    let totalCred = 0;
                    const frameworks = new Set();
                    for (const agent of allAgents) {
                        const tier = getCredTier(agent.credScore || 0).tier;
                        tiers[tier]++;
                        totalCred += (agent.credScore || 0);
                        if (agent.framework) frameworks.add(agent.framework);
                    }

                    const humanProfiles = Object.values(loadHumanProfiles()).filter(profile => profile?.active !== false);
                    const humans = [];
                    for (const profile of humanProfiles) {
                        const cred = await computeHumanCred(profile);
                        humans.push(cred);
                    }

                    return jsonResult({
                        totalAgents: allAgents.length,
                        totalHumans: humans.length,
                        totalPrincipals: allAgents.length + humans.length,
                        averageCredScore: allAgents.length ? Math.round(totalCred / allAgents.length) : 0,
                        averageHumanCredScore: humans.length ? Math.round(humans.reduce((sum, item) => sum + (item.score || 0), 0) / humans.length) : 0,
                        tierDistribution: tiers,
                        frameworks: [...frameworks],
                    });
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
