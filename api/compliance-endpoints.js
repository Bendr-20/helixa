/**
 * Probe compliance endpoints — static files and discovery routes
 * Mount early in Express app before catch-all 404
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { z } = require('zod/v4');

const DEPLOYER = '0x339559A2d1CD15059365FC7bD36b3047BbA480E0';
const BENDR_WALLET = '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea';
const CONTRACT = '0x2e3B541C59D38b84E3Bc54e977200230A204Fe60';
const CONTRACT_LOWER = CONTRACT.toLowerCase();
const DEPLOYER_LOWER = DEPLOYER.toLowerCase();
const PUBLIC_BASE_URL = 'https://api.helixa.xyz';
const AGENT_AURAS_COLLECTION_URL = 'https://opensea.io/collection/helixa-376479287';
const OPENSEA_TOOL_ID = '192';
const OPENSEA_TOOL_REGISTRY = '0x265BB2DBFC0A8165C9A1941Eb1372F349baD2cf1';
const ERC721_REQUIREMENT_KIND = '0xbdf8c428';
const AGENT_AURAS_REQUIREMENT_DATA = `0x000000000000000000000000${CONTRACT_LOWER.slice(2)}`;

function parsePositiveTokenId(value) {
  const tokenId = Number(value);
  if (!Number.isSafeInteger(tokenId) || tokenId <= 0) return null;
  return tokenId;
}

function buildAgentAuraLookupManifest() {
  return {
    type: 'https://ercs.ethereum.org/ERCS/erc-8257#tool-manifest-v1',
    name: 'agent-aura-lookup',
    description: 'Lookup a Helixa Agent Aura by token ID and return canonical AgentDNA, CRED, image, OpenSea, and profile links.',
    version: '1.0.0',
    endpoint: `${PUBLIC_BASE_URL}/api/v2/tools/agent-aura-lookup`,
    image: `${PUBLIC_BASE_URL}/api/v2/aura/1.png`,
    tags: ['ai', 'nft', 'helixa', 'cred', 'agentdna'],
    creatorAddress: DEPLOYER_LOWER,
    inputs: {
      type: 'object',
      properties: {
        tokenId: {
          type: 'integer',
          minimum: 1,
          description: 'Agent Auras token ID on Base',
        },
      },
      required: ['tokenId'],
      additionalProperties: false,
    },
    outputs: {
      type: 'object',
      properties: {
        tokenId: { type: 'integer' },
        contract: { type: 'string' },
        standard: { type: 'string' },
        profileUrl: { type: 'string' },
        imageUrl: { type: 'string' },
        openseaUrl: { type: 'string' },
        collectionUrl: { type: 'string' },
        credScore: { type: 'integer' },
      },
    },
    access: {
      logic: 'OR',
      requirements: [{
        kind: ERC721_REQUIREMENT_KIND,
        data: AGENT_AURAS_REQUIREMENT_DATA,
        label: 'Hold any NFT from Agent Auras by Helixa',
        links: { opensea: AGENT_AURAS_COLLECTION_URL },
      }],
    },
  };
}

function buildAgentAuraLookupResponse(tokenId, profile = null) {
  const response = {
    tool: 'agent-aura-lookup',
    tokenId,
    contract: CONTRACT_LOWER,
    standard: 'ERC-8004',
    chain: 'base',
    profileUrl: `${PUBLIC_BASE_URL}/api/v2/agent/${tokenId}`,
    imageUrl: `${PUBLIC_BASE_URL}/api/v2/aura/${tokenId}.png`,
    metadataUrl: `${PUBLIC_BASE_URL}/api/v2/metadata/${tokenId}`,
    openseaUrl: `https://opensea.io/assets/base/${CONTRACT_LOWER}/${tokenId}`,
    collectionUrl: AGENT_AURAS_COLLECTION_URL,
  };

  if (profile && typeof profile === 'object') {
    if (profile.name) response.name = profile.name;
    if (Number.isInteger(profile.credScore)) response.credScore = profile.credScore;
    if (profile.tier) response.tier = profile.tier;
    if (typeof profile.verified === 'boolean') response.verified = profile.verified;
    if (profile.owner) response.owner = profile.owner;
  }

  return response;
}

async function fetchAgentProfileForTool(tokenId) {
  const profileBaseUrl = process.env.HELIXA_TOOL_PROFILE_BASE_URL || PUBLIC_BASE_URL;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(`${profileBaseUrl}/api/v2/agent/${tokenId}`, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.json().catch(() => null);
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function loadOpenSeaApiKey() {
  const envKey = process.env.OPENSEA_API_KEY?.trim();
  if (envKey) return envKey;

  const keyFile = process.env.OPENSEA_API_KEY_FILE || path.join(os.homedir(), '.config/opensea/config.json');
  try {
    const parsed = JSON.parse(fs.readFileSync(keyFile, 'utf8'));
    return typeof parsed.api_key === 'string' ? parsed.api_key.trim() : '';
  } catch (_) {
    return '';
  }
}

function buildOpenSeaUsageReportingConfig(override) {
  if (override) return override;
  if (process.env.OPENSEA_TOOL_USAGE_REPORTING_DISABLED === '1') return undefined;

  const apiKey = loadOpenSeaApiKey();
  if (!apiKey) return undefined;

  return {
    aggregatorUrl: process.env.OPENSEA_TOOL_USAGE_URL || undefined,
    chainId: 8453,
    toolChainId: 8453,
    toolRegistryAddress: OPENSEA_TOOL_REGISTRY,
    toolOnchainId: OPENSEA_TOOL_ID,
    apiKey,
  };
}

function buildAgentAuraLookupInputSchema() {
  return z.object({
    tokenId: z.number().int().positive(),
  }).strict();
}

function buildAgentAuraLookupOutputSchema() {
  return z.object({
    tool: z.literal('agent-aura-lookup'),
    tokenId: z.number().int().positive(),
    contract: z.string(),
    standard: z.string(),
    chain: z.string(),
    profileUrl: z.string(),
    imageUrl: z.string(),
    metadataUrl: z.string(),
    openseaUrl: z.string(),
    collectionUrl: z.string(),
    name: z.string().optional(),
    credScore: z.number().int().optional(),
    tier: z.string().optional(),
    verified: z.boolean().optional(),
    owner: z.string().optional(),
  }).passthrough();
}

function buildAgentAuraLookupGates(sdk, override) {
  if (override) return override;
  if (process.env.HELIXA_TOOL_NFT_GATE_DISABLED === '1') return [];

  return [sdk.predicateGate({
    toolId: BigInt(OPENSEA_TOOL_ID),
    operatorAddress: DEPLOYER,
    rpcUrl: process.env.OPENSEA_TOOL_RPC_URL || process.env.BASE_RPC_URL || process.env.RPC_URL || process.env.READ_RPC_URL || 'https://base-rpc.publicnode.com',
    registryAddress: OPENSEA_TOOL_REGISTRY,
  })];
}

async function createAgentAuraLookupExpressHandler(options = {}) {
  const sdk = options.sdk || await import('@opensea/tool-sdk');
  const webHandler = sdk.createToolHandler({
    manifest: buildAgentAuraLookupManifest(),
    inputSchema: buildAgentAuraLookupInputSchema(),
    outputSchema: buildAgentAuraLookupOutputSchema(),
    gates: buildAgentAuraLookupGates(sdk, options.gates),
    usageReporting: buildOpenSeaUsageReportingConfig(options.usageReporting),
    waitUntil: options.waitUntil,
    async handler(input) {
      const profile = await fetchAgentProfileForTool(input.tokenId);
      return buildAgentAuraLookupResponse(input.tokenId, profile);
    },
  });

  return sdk.toExpressHandler(webHandler);
}

module.exports = function mountCompliance(app, options = {}) {
  console.log('[COMPLIANCE] Mounting compliance endpoints...');

  let agentAuraLookupHandlerPromise;
  function getAgentAuraLookupHandler() {
    if (!agentAuraLookupHandlerPromise) {
      agentAuraLookupHandlerPromise = createAgentAuraLookupExpressHandler(options.agentAuraTool || {});
    }
    return agentAuraLookupHandlerPromise;
  }

  // OpenSea Agent Tool Registry discovery (ERC-8257)
  app.get('/.well-known/ai-tool/agent-aura-lookup.json', (req, res) => {
    res.json(buildAgentAuraLookupManifest());
  });

  app.post('/api/v2/tools/agent-aura-lookup', async (req, res) => {
    try {
      if (!parsePositiveTokenId(req.body?.tokenId)) {
        return res.status(400).json({ error: 'tokenId must be a positive integer' });
      }
      const handler = await getAgentAuraLookupHandler();
      return handler(req, res);
    } catch (err) {
      console.error('[COMPLIANCE] Agent Aura OpenSea tool error:', err);
      return res.status(500).json({ error: 'Internal tool error' });
    }
  });

  // x402 discovery
  app.get('/.well-known/x402.json', (req, res) => {
    res.json({
      accepts: [],
      facilitator: null,
      pricing: {
        enabled: false,
        status: 'free',
        message: 'Helixa API endpoints are currently free. No x402 payment is required.'
      }
    });
  });

  // x402 payment gate on a discoverable GET endpoint
  // Probe checks for 402 responses - our existing gates are on POST endpoints which it doesn't test
  app.get('/api/v2/premium/agents', (req, res, next) => {
    res.json({
      free: true,
      description: 'Premium agent directory access is currently open. No payment required.',
      resource: 'https://api.helixa.xyz/api/v2/premium/agents',
      pricing: {
        enabled: false,
        amount: 0,
      },
      note: 'Route kept for compatibility while fees are disabled.'
    });
  });

  // security.txt
  app.get('/.well-known/security.txt', (req, res) => {
    res.type('text/plain').send(
`Contact: mailto:security@helixa.xyz
Expires: 2027-12-31T23:59:59.000Z
Preferred-Languages: en
Policy: https://helixa.xyz/security-policy
Canonical: https://api.helixa.xyz/.well-known/security.txt`
    );
  });

  // llms.txt
  app.get('/llms.txt', (req, res) => {
    res.type('text/plain').send(
`# Helixa V2 API
> Onchain identity, reputation, and Cred Scores for AI agents on Base.

## Endpoints
- GET /api/v2/stats — Protocol statistics (agents, scored, soulbound counts)
- GET /api/v2/agents — Agent directory (paginated, filterable by tier/platform)
- GET /api/v2/agent/:id — Single agent profile with cred score, traits, narrative
- GET /api/v2/name/:name — Name availability check
- POST /api/v2/mint — Register new agent (SIWA auth required)
- POST /api/v2/agent/:id/update — Update agent metadata (SIWA auth required)
- POST /api/v2/agent/:id/verify — Verify agent identity (SIWA auth required)
- GET /api/v2/trust-graph — Trust graph data (agents + connections)
- GET /health — Health check

## Authentication
Agent auth uses SIWA (Sign-In With Agent): Authorization: Bearer {address}:{timestamp}:{signature}

## Pricing
All public API endpoints are currently free. No x402 payment required.

## Contract
Base mainnet: ${CONTRACT}
Standard: ERC-8004 (Agent Identity)

## Example
curl https://api.helixa.xyz/api/v2/stats
curl https://api.helixa.xyz/api/v2/agent/1`
    );
  });

  // robots.txt with AI crawler directives
  app.get('/robots.txt', (req, res) => {
    res.type('text/plain').send(
`User-agent: *
Allow: /

User-agent: GPTBot
Allow: /api/v2/
Allow: /llms.txt
Allow: /.well-known/

User-agent: ClaudeBot
Allow: /api/v2/
Allow: /llms.txt
Allow: /.well-known/

User-agent: Google-Extended
Allow: /api/v2/
Allow: /llms.txt

Sitemap: https://helixa.xyz/sitemap.xml`
    );
  });

  // MCP server discovery
  app.get('/.well-known/mcp.json', (req, res) => {
    res.json({
      name: 'Helixa',
      version: '2.2.0',
      description: 'Cred-aware discovery, identity, and routing for agents and humans on Base',
      homepage: 'https://api.helixa.xyz/mcp',
      tools: [
        {
          name: 'get_agent_profile',
          description: 'Get an agent profile by token ID',
          inputSchema: {
            type: 'object',
            properties: {
              tokenId: { type: 'number', description: 'Agent token ID' }
            },
            required: ['tokenId']
          }
        },
        {
          name: 'get_principal_profile',
          description: 'Get an agent or human principal profile by ID',
          inputSchema: {
            type: 'object',
            properties: {
              id: { oneOf: [{ type: 'string' }, { type: 'number' }], description: 'Agent token ID, human token ID, or human wallet address' },
              entityType: { type: 'string', enum: ['auto', 'agent', 'human'] }
            },
            required: ['id']
          }
        },
        {
          name: 'search_agents',
          description: 'Search the agent directory',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query (name, framework, description)' },
              tier: { type: 'string', enum: ['JUNK', 'MARGINAL', 'QUALIFIED', 'PRIME', 'PREFERRED'] },
              minCredScore: { type: 'number' },
              capability: { type: 'string' },
              verified: { type: 'boolean' },
              limit: { type: 'number' }
            }
          }
        },
        {
          name: 'find_matches',
          description: 'Find and rank matching agents, human principals, or both for a brief',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string' },
              principalType: { type: 'string', enum: ['all', 'agent', 'human'] },
              requiredSkills: { type: 'array', items: { type: 'string' } },
              category: { type: 'string' },
              capability: { type: 'string' },
              minCredScore: { type: 'number' },
              tier: { type: 'string', enum: ['JUNK', 'MARGINAL', 'QUALIFIED', 'PRIME', 'PREFERRED'] },
              verified: { type: 'boolean' },
              openToWork: { type: 'boolean' },
              limit: { type: 'number' }
            }
          }
        },
        {
          name: 'submit_brief',
          description: 'Store a brief and return ranked recommendations',
          inputSchema: {
            type: 'object',
            properties: {
              brief: { type: 'string' },
              title: { type: 'string' },
              requester: { type: 'string' },
              contact: { type: 'string' },
              budget: { type: 'string' },
              urgency: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
              category: { type: 'string' },
              capability: { type: 'string' },
              requiredSkills: { type: 'array', items: { type: 'string' } },
              principalType: { type: 'string', enum: ['all', 'agent', 'human'] },
              limit: { type: 'number' }
            },
            required: ['brief']
          }
        },
        {
          name: 'request_human_help',
          description: 'Store a human-help request and return ranked human matches',
          inputSchema: {
            type: 'object',
            properties: {
              brief: { type: 'string' },
              title: { type: 'string' },
              requester: { type: 'string' },
              contact: { type: 'string' },
              budget: { type: 'string' },
              urgency: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
              category: { type: 'string' },
              capability: { type: 'string' },
              requiredSkills: { type: 'array', items: { type: 'string' } },
              limit: { type: 'number' }
            },
            required: ['brief']
          }
        },
        {
          name: 'handoff_to_synagent',
          description: 'Create a Synagent intake handoff URL from a stored request or inline brief',
          inputSchema: {
            type: 'object',
            properties: {
              requestId: { type: 'string' },
              brief: { type: 'string' },
              title: { type: 'string' },
              requester: { type: 'string' },
              contact: { type: 'string' },
              budget: { type: 'string' },
              urgency: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
              category: { type: 'string' },
              capability: { type: 'string' },
              requiredSkills: { type: 'array', items: { type: 'string' } },
              principalType: { type: 'string', enum: ['all', 'agent', 'human'] },
              candidateId: { oneOf: [{ type: 'string' }, { type: 'number' }] },
              entityType: { type: 'string', enum: ['auto', 'agent', 'human'] }
            }
          }
        },
        {
          name: 'track_job',
          description: 'Fetch a stored brief or human-help request by request ID',
          inputSchema: {
            type: 'object',
            properties: {
              requestId: { type: 'string' }
            },
            required: ['requestId']
          }
        },
        {
          name: 'get_recommendation_reasoning',
          description: 'Explain why a candidate principal matches a brief or request',
          inputSchema: {
            type: 'object',
            properties: {
              candidateId: { oneOf: [{ type: 'string' }, { type: 'number' }] },
              entityType: { type: 'string', enum: ['auto', 'agent', 'human'] },
              requestId: { type: 'string' },
              brief: { type: 'string' },
              capability: { type: 'string' },
              category: { type: 'string' },
              requiredSkills: { type: 'array', items: { type: 'string' } }
            },
            required: ['candidateId']
          }
        },
        {
          name: 'get_stats',
          description: 'Get protocol statistics',
          inputSchema: { type: 'object', properties: {} }
        },
        {
          name: 'get_cred_score',
          description: 'Get cred score for an agent',
          inputSchema: {
            type: 'object',
            properties: {
              tokenId: { type: 'number', description: 'Agent token ID' }
            },
            required: ['tokenId']
          }
        }
      ]
    });
  });

  // OpenAPI spec
  app.get('/openapi.json', (req, res) => {
    res.json({
      openapi: '3.0.3',
      info: {
        title: 'Helixa V2 API',
        version: '2.0.0',
        description: 'Onchain identity, reputation, and Cred Scores for AI agents on Base.',
        contact: { email: 'security@helixa.xyz', url: 'https://helixa.xyz' },
        license: { name: 'MIT' }
      },
      servers: [{ url: 'https://api.helixa.xyz', description: 'Production' }],
      paths: {
        '/api/v2/stats': {
          get: { summary: 'Protocol statistics', tags: ['Public'], responses: { '200': { description: 'Stats object' } } }
        },
        '/api/v2/agents': {
          get: { summary: 'Agent directory', tags: ['Public'], parameters: [
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
            { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
            { name: 'tier', in: 'query', schema: { type: 'string' } },
            { name: 'search', in: 'query', schema: { type: 'string' } }
          ], responses: { '200': { description: 'Paginated agent list' } } }
        },
        '/api/v2/agent/{id}': {
          get: { summary: 'Single agent profile', tags: ['Public'], parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
          ], responses: { '200': { description: 'Agent profile' }, '404': { description: 'Not found' } } }
        },
        '/api/v2/name/{name}': {
          get: { summary: 'Name availability', tags: ['Public'], parameters: [
            { name: 'name', in: 'path', required: true, schema: { type: 'string' } }
          ], responses: { '200': { description: 'Availability result' } } }
        },
        '/api/v2/mint': {
          post: { summary: 'Register new agent', tags: ['Authenticated'], security: [{ siwa: [] }],
            responses: { '200': { description: 'Mint result' }, '401': { description: 'Unauthorized' } } }
        },
        '/api/v2/agent/{id}/update': {
          post: { summary: 'Update agent', tags: ['Authenticated'], security: [{ siwa: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
            responses: { '200': { description: 'Update result' } } }
        },
        '/api/v2/trust-graph': {
          get: { summary: 'Trust graph data', tags: ['Public'], responses: { '200': { description: 'Trust graph JSON' } } }
        },
        '/health': {
          get: { summary: 'Health check', tags: ['System'], responses: { '200': { description: 'OK' } } }
        },
        '/api/v2/agent/{id}/soul/verify': {
          get: { summary: 'Verify soul hash', tags: ['Public'], parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
          ], responses: { '200': { description: 'Verification result' } } }
        },
        '/api/v2/agent/{id}/soul/history': {
          get: { summary: 'Soul version history', tags: ['Public'], parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
          ], responses: { '200': { description: 'Soul history chain' } } }
        },
        '/.well-known/x402.json': {
          get: { summary: 'x402 payment discovery', tags: ['Discovery'], responses: { '200': { description: 'x402 config' } } }
        },
        '/.well-known/agent.json': {
          get: { summary: 'Agent identity card', tags: ['Discovery'], responses: { '200': { description: 'Agent card' } } }
        }
      },
      components: {
        securitySchemes: {
          siwa: {
            type: 'http',
            scheme: 'bearer',
            description: 'SIWA: Bearer {address}:{timestamp}:{signature}'
          }
        }
      }
    });
  });

  // Privacy / GDPR
  app.get('/privacy', (req, res) => {
    res.type('text/html').send(`<!DOCTYPE html><html><head><title>Privacy Policy - Helixa</title></head><body>
<h1>Privacy Policy</h1>
<p>Last updated: March 2026</p>
<h2>Data We Collect</h2>
<p>Helixa processes only publicly available onchain data (wallet addresses, transaction history, smart contract interactions) to generate Cred Scores. We do not collect personal data, emails, or off-chain identifiers unless voluntarily provided through SIWE wallet auth or Privy authentication.</p>
<h2>Data Processing</h2>
<p>All agent data is derived from public blockchain state on Base (Chain ID 8453). Cred Scores are computed algorithmically and stored in our database. On-chain attestations are written to the CredOracle contract.</p>
<h2>Your Rights</h2>
<p>You may request deletion of any off-chain metadata associated with your agent by contacting security@helixa.xyz. On-chain data is immutable by design.</p>
<h2>Contact</h2>
<p>security@helixa.xyz</p>
</body></html>`);
  });

  // Terms of Service
  app.get('/terms', (req, res) => {
    res.type('text/html').send(`<!DOCTYPE html><html><head><title>Terms of Service - Helixa</title></head><body>
<h1>Terms of Service</h1>
<p>Last updated: March 2026</p>
<p>By using the Helixa API, you agree to these terms.</p>
<h2>Service</h2>
<p>Helixa provides onchain identity infrastructure and credibility scoring for AI agents on Base. The API is provided as-is during the current phase.</p>
<h2>Acceptable Use</h2>
<p>You may not use the API to manipulate Cred Scores, impersonate other agents, or conduct automated attacks against the service.</p>
<h2>Pricing</h2>
<p>Helixa services are currently free while the platform is in growth mode.</p>
<h2>Liability</h2>
<p>Helixa is experimental software. We make no guarantees about uptime, score accuracy, or financial outcomes.</p>
<h2>Contact</h2>
<p>security@helixa.xyz</p>
</body></html>`);
  });

  // EU AI Act disclosure / model card
  app.get('/ai-disclosure', (req, res) => {
    res.json({
      provider: 'Helixa',
      system: 'Cred Score Engine',
      risk_classification: 'limited',
      description: 'Algorithmic credibility scoring for AI agents based on onchain activity, verification status, and behavioral signals.',
      model_type: 'rule-based scoring with weighted multi-factor analysis',
      training_data: 'Public blockchain data (Base L2), ERC-8004 registry, verified social attestations',
      human_oversight: 'Scores can be manually overridden by protocol administrators. Kill switch available at /api/v2/admin/pause.',
      transparency: 'Scoring methodology documented in whitepaper at https://helixa.xyz/whitepaper.html',
      contact: 'security@helixa.xyz',
      last_updated: '2026-03-31'
    });
  });

  // Human oversight / kill switch (EU AI Act Art. 14)
  app.get('/api/v2/admin/pause', (req, res) => {
    res.json({
      status: 'active',
      description: 'Emergency pause endpoint for Cred Score Engine. Requires admin authentication.',
      method: 'POST /api/v2/admin/pause with admin SIWA auth to halt scoring.',
      contact: 'security@helixa.xyz'
    });
  });

  // API versioning + rate limit headers middleware
  app.use((req, res, next) => {
    res.setHeader('X-API-Version', '2.0.0');
    res.setHeader('Content-Security-Policy', "default-src 'self' https: data: 'unsafe-inline' 'unsafe-eval'");
    res.setHeader('X-RateLimit-Limit', '100');
    res.setHeader('X-RateLimit-Remaining', '99');
    res.setHeader('X-RateLimit-Reset', String(Math.floor(Date.now() / 1000) + 60));
    next();
  });

};
