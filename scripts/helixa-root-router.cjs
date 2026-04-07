const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3460);
const API_BASE = 'http://127.0.0.1:3457';
const TERMINAL_API_BASE = 'http://127.0.0.1:3000';
const HELIXA_REGISTRY = '0x2e3b541c59d38b84e3bc54e977200230a204fe60';
const PUBLIC_DIR = path.resolve(__dirname, '..', 'api', 'public');
const V2_HTML = path.join(PUBLIC_DIR, 'trust-graph-v2.html');
const LOGO_PNG = path.resolve(__dirname, '..', 'docs', 'helixa-logo.png');
const HQ_IMAGE = path.resolve(__dirname, '..', '..', 'doppel-hq.png');
const HQ_IMAGE_TYPE = 'image/png';

const TIER_RING = {
  PREFERRED: { stroke: '#e8b84b', glow: 'rgba(232,184,75,0.35)', inner: 'rgba(232,184,75,0.12)' },
  PRIME: { stroke: '#5a9de6', glow: 'rgba(90,157,230,0.35)', inner: 'rgba(90,157,230,0.12)' },
  QUALIFIED: { stroke: '#2fb86f', glow: 'rgba(47,184,111,0.30)', inner: 'rgba(47,184,111,0.10)' },
  MARGINAL: { stroke: '#8f8f94', glow: 'rgba(143,143,148,0.25)', inner: 'rgba(143,143,148,0.08)' },
  JUNK: { stroke: '#cc2d2d', glow: 'rgba(204,45,45,0.28)', inner: 'rgba(204,45,45,0.08)' },
};

const cache = {
  expiresAt: 0,
  data: null,
  pending: null,
};

const iconCache = new Map();

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(body);
}

function sendJson(res, status, value) {
  send(res, status, JSON.stringify(value), { 'Content-Type': 'application/json; charset=utf-8' });
}

function sendFile(res, filePath, contentType = 'text/html; charset=utf-8') {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      send(res, 404, 'Not Found', { 'Content-Type': 'text/plain; charset=utf-8' });
      return;
    }
    send(res, 200, data, { 'Content-Type': contentType });
  });
}

async function fetchJson(url) {
  const resp = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
  return resp.json();
}

async function proxyBinary(res, url) {
  const upstream = await fetch(url);
  if (!upstream.ok) {
    send(res, upstream.status, await upstream.text(), { 'Content-Type': 'text/plain; charset=utf-8' });
    return;
  }
  const data = Buffer.from(await upstream.arrayBuffer());
  send(res, 200, data, {
    'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
    'Cache-Control': 'public, max-age=300',
  });
}

function tierForScore(rawScore) {
  const score = Number(rawScore || 0);
  if (score >= 91) return 'PREFERRED';
  if (score >= 76) return 'PRIME';
  if (score >= 51) return 'QUALIFIED';
  if (score >= 26) return 'MARGINAL';
  return 'JUNK';
}

async function fetchAuraPngDataUri(tokenId) {
  const upstream = await fetch(`${API_BASE}/api/v2/aura/${encodeURIComponent(tokenId)}.png`);
  if (!upstream.ok) throw new Error(`Aura fetch failed for token ${tokenId}: HTTP ${upstream.status}`);
  const contentType = upstream.headers.get('content-type') || 'image/png';
  const bytes = Buffer.from(await upstream.arrayBuffer());
  return `data:${contentType};base64,${bytes.toString('base64')}`;
}

async function getAuraCircleSvg(tokenId, tier) {
  const normalizedTier = String(tier || 'JUNK').toUpperCase();
  const key = `${tokenId}:${normalizedTier}`;
  const cached = iconCache.get(key);
  if (cached?.data && cached.expiresAt > Date.now()) return cached.data;
  if (cached?.pending) return cached.pending;

  const pending = (async () => {
    const palette = TIER_RING[normalizedTier] || TIER_RING.JUNK;
    const auraDataUri = await fetchAuraPngDataUri(tokenId);
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="7" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <clipPath id="avatar-clip">
      <circle cx="128" cy="128" r="78" />
    </clipPath>
  </defs>
  <circle cx="128" cy="128" r="98" fill="${palette.inner}" />
  <circle cx="128" cy="128" r="102" fill="none" stroke="${palette.glow}" stroke-width="18" filter="url(#glow)" />
  <circle cx="128" cy="128" r="96" fill="rgba(255,255,255,0.02)" stroke="${palette.stroke}" stroke-width="8" />
  <circle cx="128" cy="128" r="82" fill="rgba(10,10,20,0.14)" stroke="rgba(255,255,255,0.35)" stroke-width="2" />
  <image href="${auraDataUri}" x="44" y="44" width="168" height="168" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatar-clip)" />
</svg>`;
    iconCache.set(key, { data: svg, expiresAt: Date.now() + 300_000, pending: null });
    return svg;
  })();

  iconCache.set(key, { data: cached?.data || null, expiresAt: 0, pending });

  try {
    return await pending;
  } catch (err) {
    if (cached?.data) return cached.data;
    throw err;
  } finally {
    const current = iconCache.get(key);
    if (current?.pending === pending) current.pending = null;
  }
}

function extractHelixaTokenId(agent) {
  const rawToken = String(agent.token_id ?? agent.tokenId ?? '').toLowerCase();
  const registry = String(agent.registry || '').toLowerCase();
  const platform = String(agent.platform || '').toLowerCase();
  if (platform === 'helixa' || registry === HELIXA_REGISTRY) {
    const match = rawToken.match(/(\d+)$/);
    return match ? Number(match[1]) : null;
  }
  return null;
}

function normalizeAgent(agent, handshakeCount) {
  const helixaTokenId = extractHelixaTokenId(agent);
  const credScore = Number(agent.credScore ?? agent.cred_score ?? 0) || 0;
  const address = String(agent.address || agent.agentAddress || agent.agent_wallet || agent.owner || agent.owner_address || '').toLowerCase() || null;
  const owner = agent.owner || agent.owner_address || null;
  const framework = agent.framework || agent.platform || 'unknown';
  const credTier = String(agent.credTier || agent.cred_tier || tierForScore(credScore)).toUpperCase();

  return {
    tokenId: helixaTokenId,
    name: agent.name || agent.agentName || `Agent #${helixaTokenId || agent.id || '?'}`,
    address,
    owner,
    framework,
    platform: agent.platform || framework,
    cred_score: credScore,
    cred_tier: credTier,
    handshakeCount: Number(handshakeCount || 0),
    mintedAt: agent.mintedAt || agent.registeredAt || agent.created_at || null,
    verified: Boolean(agent.isVerified ?? agent.verified ?? agent.is_verified ?? false),
    imageUrl: helixaTokenId ? `/trust-graph/api/aura-circle/${helixaTokenId}?tier=${credTier}` : (agent.imageUrl || agent.image_url || null),
    _detailFetched: false,
  };
}

function findAgentByAddress(agents, address) {
  const needle = String(address || '').toLowerCase();
  return agents.find((agent) => String(agent.address || '').toLowerCase() === needle);
}

async function buildData() {
  const [terminalResp, graphResp] = await Promise.all([
    fetchJson(`${TERMINAL_API_BASE}/api/terminal/feed?limit=50000&page=1`),
    fetchJson(`${API_BASE}/api/v2/trust-graph`),
  ]);

  const rawAgents = terminalResp?.data?.agents || [];
  const rawEdges = Array.isArray(graphResp.edges) ? graphResp.edges : [];

  const addressByHelixaTokenId = new Map();
  const rawByAddress = new Map();
  for (const raw of rawAgents) {
    const address = String(raw.address || '').toLowerCase();
    if (address) rawByAddress.set(address, raw);
    const helixaTokenId = extractHelixaTokenId(raw);
    if (helixaTokenId && address) addressByHelixaTokenId.set(helixaTokenId, address);
  }

  const handshakeCountByAddress = new Map();
  for (const edge of rawEdges) {
    const from = addressByHelixaTokenId.get(Number(edge.from || 0));
    const to = addressByHelixaTokenId.get(Number(edge.to || 0));
    if (from) handshakeCountByAddress.set(from, (handshakeCountByAddress.get(from) || 0) + 1);
    if (to) handshakeCountByAddress.set(to, (handshakeCountByAddress.get(to) || 0) + 1);
  }

  const agents = rawAgents.map((raw) => {
    const address = String(raw.address || '').toLowerCase();
    return normalizeAgent(raw, handshakeCountByAddress.get(address) || 0);
  });

  const edges = rawEdges
    .map((edge) => {
      const from = addressByHelixaTokenId.get(Number(edge.from || 0));
      const to = addressByHelixaTokenId.get(Number(edge.to || 0));
      if (!from || !to) return null;
      return {
        from,
        to,
        reciprocated: Boolean(edge.reciprocated),
        type: edge.reciprocated ? 'handshake-accepted' : 'handshake',
        createdAt: edge.createdAt || edge.timestamp || null,
      };
    })
    .filter(Boolean);

  return {
    agents,
    edges,
    transactions: [],
    rawByAddress,
  };
}

async function getData() {
  if (cache.data && cache.expiresAt > Date.now()) return cache.data;
  if (cache.pending) return cache.pending;

  cache.pending = (async () => {
    const data = await buildData();
    cache.data = data;
    cache.expiresAt = Date.now() + 60_000;
    return data;
  })();

  try {
    return await cache.pending;
  } finally {
    cache.pending = null;
  }
}

async function getDetailedAgent(address) {
  const needle = String(address || '').toLowerCase();
  const data = await getData();
  const base = findAgentByAddress(data.agents, needle);
  if (!base) return null;

  try {
    const terminal = await fetchJson(`${TERMINAL_API_BASE}/api/terminal/agent/${encodeURIComponent(needle)}`);
    const detail = terminal?.data || {};
    const credScore = Number(detail.cred_score ?? base.cred_score ?? 0) || 0;
    const credTier = String(detail.cred_tier || base.cred_tier || tierForScore(credScore)).toUpperCase();
    const helixaTokenId = extractHelixaTokenId(detail);
    return {
      ...base,
      name: detail.name || base.name,
      address: needle,
      owner: detail.owner_address || base.owner,
      framework: detail.framework || detail.platform || base.framework,
      platform: detail.platform || detail.framework || base.platform,
      cred_score: credScore,
      cred_tier: credTier,
      handshakeCount: Number(base.handshakeCount || 0),
      mintedAt: detail.created_at || base.mintedAt,
      verified: Boolean(detail.is_verified ?? base.verified),
      tokenId: helixaTokenId ?? base.tokenId,
      imageUrl: helixaTokenId ? `/trust-graph/api/aura-circle/${helixaTokenId}?tier=${credTier}` : (detail.image_url || base.imageUrl || null),
      _detailFetched: true,
    };
  } catch {
    return base;
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    const pathname = decodeURIComponent(url.pathname);

    if (pathname === '/' || pathname === '/v2' || pathname === '/v2/') {
      sendFile(res, V2_HTML);
      return;
    }

    if (pathname === '/health') {
      sendJson(res, 200, { ok: true, service: 'helixa-root-router', port: PORT, mode: 'trust-graph-v2' });
      return;
    }

    if (pathname === '/trust-graph' || pathname === '/trust-graph/') {
      sendFile(res, V2_HTML);
      return;
    }

    if (pathname === '/trust-graph/v2' || pathname === '/trust-graph/v2/') {
      sendFile(res, V2_HTML);
      return;
    }

    if (pathname === '/trust-graph/helixa-logo.png') {
      sendFile(res, LOGO_PNG, 'image/png');
      return;
    }

    if (pathname === '/trust-graph/helixa-hq.jpg') {
      sendFile(res, HQ_IMAGE, HQ_IMAGE_TYPE);
      return;
    }

    if (pathname === '/trust-graph/api/agents') {
      const data = await getData();
      sendJson(res, 200, data.agents);
      return;
    }

    if (pathname === '/trust-graph/api/edges') {
      const data = await getData();
      sendJson(res, 200, data.edges);
      return;
    }

    if (pathname === '/trust-graph/api/transactions') {
      const data = await getData();
      sendJson(res, 200, data.transactions);
      return;
    }

    if (pathname.startsWith('/trust-graph/api/agent/')) {
      const address = pathname.replace('/trust-graph/api/agent/', '');
      const agent = await getDetailedAgent(address);
      if (!agent) {
        sendJson(res, 404, { error: 'Agent not found' });
        return;
      }
      sendJson(res, 200, agent);
      return;
    }

    if (pathname.startsWith('/trust-graph/api/aura-circle/')) {
      const tokenId = pathname.replace('/trust-graph/api/aura-circle/', '');
      const tier = url.searchParams.get('tier') || 'JUNK';
      const svg = await getAuraCircleSvg(tokenId, tier);
      send(res, 200, svg, {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      });
      return;
    }

    send(res, 404, 'Not Found', { 'Content-Type': 'text/plain; charset=utf-8' });
  } catch (err) {
    sendJson(res, 500, { error: 'Router error', detail: err.message || String(err) });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[helixa-root-router] listening on ${PORT}`);
  console.log('[helixa-root-router] mode=trust-graph-v2');
});
