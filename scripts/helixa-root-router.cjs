const http = require('http');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

let Database = null;
for (const candidate of [
  path.resolve(__dirname, '..', '..', 'terminal', 'node_modules', 'better-sqlite3'),
  path.resolve(__dirname, '..', 'api', 'node_modules', 'better-sqlite3'),
]) {
  try {
    Database = require(candidate);
    break;
  } catch {}
}
if (!Database) throw new Error('better-sqlite3 not found for helixa-root-router');

const PORT = Number(process.env.PORT || 3460);
const API_BASE = 'http://127.0.0.1:3457';
const TERMINAL_API_BASE = 'http://127.0.0.1:3000';
const MAX_GRAPH_AGENTS = 50000;
const FETCH_TIMEOUT_MS = 15000;
const ICON_PENDING_STALE_MS = 20000;
const PUBLIC_DIR = path.resolve(__dirname, '..', 'api', 'public');
const DOCS_DIR = path.resolve(__dirname, '..', 'docs');
const V2_HTML = path.join(PUBLIC_DIR, 'trust-graph-v2.html');
const DOCS_INDEX_HTML = path.join(DOCS_DIR, 'index.html');
const LOGO_PNG = path.resolve(__dirname, '..', 'docs', 'helixa-logo.png');
const HQ_IMAGE = path.resolve(__dirname, '..', '..', 'doppel-hq.png');
const HQ_IMAGE_TYPE = 'image/png';
const LOCAL_AGENTS_DB = path.resolve(__dirname, '..', 'data', 'agents.db');
const SPA_ENTRY_ROUTES = new Set([
  '/mint',
  '/manage',
  '/stake',
  '/messages',
  '/agents',
  '/jobs',
  '/soul',
  '/token',
]);
const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.wav': 'audio/wav',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const TIER_RING = {
  PREFERRED: { stroke: '#e8b84b', glow: 'rgba(232,184,75,0.35)', inner: 'rgba(232,184,75,0.12)' },
  PRIME: { stroke: '#5a9de6', glow: 'rgba(90,157,230,0.35)', inner: 'rgba(90,157,230,0.12)' },
  QUALIFIED: { stroke: '#2fb86f', glow: 'rgba(47,184,111,0.30)', inner: 'rgba(47,184,111,0.10)' },
  MARGINAL: { stroke: '#8f8f94', glow: 'rgba(143,143,148,0.25)', inner: 'rgba(143,143,148,0.08)' },
  JUNK: { stroke: '#cc2d2d', glow: 'rgba(204,45,45,0.28)', inner: 'rgba(204,45,45,0.08)' },
};

const graphCache = {
  expiresAt: 0,
  data: null,
  pending: null,
};

const iconCache = new Map();

const localDb = new Database(LOCAL_AGENTS_DB, { readonly: true, fileMustExist: true });
const localStatements = {
  allAgents: localDb.prepare(`
    SELECT tokenId, name, agentAddress, framework, verified, soulbound, mintOrigin, credScore, owner, mintedAt, lastUpdated
    FROM agents
    ORDER BY tokenId ASC
  `),
  byTokenId: localDb.prepare(`
    SELECT tokenId, name, agentAddress, framework, verified, soulbound, mintOrigin, credScore, owner, mintedAt, lastUpdated
    FROM agents
    WHERE tokenId = ?
  `),
};

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
  const resp = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
  return resp.json();
}

function tierForScore(rawScore) {
  const score = Number(rawScore || 0);
  if (score >= 91) return 'PREFERRED';
  if (score >= 76) return 'PRIME';
  if (score >= 51) return 'QUALIFIED';
  if (score >= 26) return 'MARGINAL';
  return 'JUNK';
}

async function fetchAuraPngBuffer(tokenId) {
  const upstream = await fetch(`${API_BASE}/api/v2/aura/${encodeURIComponent(tokenId)}.png`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!upstream.ok) throw new Error(`Aura fetch failed for token ${tokenId}: HTTP ${upstream.status}`);
  return Buffer.from(await upstream.arrayBuffer());
}

function isStalePending(entry) {
  return Boolean(entry?.pending && entry?.pendingStartedAt && (Date.now() - entry.pendingStartedAt > ICON_PENDING_STALE_MS));
}

function contentTypeFor(filePath) {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function docsPathFor(pathname) {
  const cleanPath = pathname.replace(/^\/+/, '');
  const resolved = path.resolve(DOCS_DIR, cleanPath);
  if (resolved !== DOCS_DIR && !resolved.startsWith(`${DOCS_DIR}${path.sep}`)) return null;
  return resolved;
}

function tryServeDocsFile(pathname, res) {
  const candidate = docsPathFor(pathname);
  if (!candidate) return false;

  try {
    const stat = fs.statSync(candidate);
    if (stat.isDirectory()) {
      const indexPath = path.join(candidate, 'index.html');
      if (!fs.existsSync(indexPath)) return false;
      sendFile(res, indexPath, 'text/html; charset=utf-8');
      return true;
    }

    if (!stat.isFile()) return false;
    sendFile(res, candidate, contentTypeFor(candidate));
    return true;
  } catch {
    return false;
  }
}

async function fetchAuraPngDataUri(tokenId) {
  const bytes = await fetchAuraPngBuffer(tokenId);
  return `data:image/png;base64,${bytes.toString('base64')}`;
}

async function getCircularAuraPng(tokenId) {
  const key = `icon-png:${tokenId}`;
  const cached = iconCache.get(key);
  if (cached?.data && cached.expiresAt > Date.now()) return cached.data;
  if (isStalePending(cached)) iconCache.delete(key);
  else if (cached?.pending) return cached.pending;

  const pending = (async () => {
    const bytes = await fetchAuraPngBuffer(tokenId);
    const avatarSize = 104;
    const canvasSize = 128;
    const inset = Math.floor((canvasSize - avatarSize) / 2);

    const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${avatarSize}" height="${avatarSize}" viewBox="0 0 ${avatarSize} ${avatarSize}"><circle cx="${avatarSize/2}" cy="${avatarSize/2}" r="${avatarSize/2 - 2}" fill="white"/></svg>`);

    const maskedAvatar = await sharp(bytes)
      .resize(avatarSize, avatarSize, { fit: 'cover' })
      .composite([{ input: mask, blend: 'dest-in' }])
      .png()
      .toBuffer();

    const png = await sharp({
      create: {
        width: canvasSize,
        height: canvasSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: maskedAvatar, left: inset, top: inset }])
      .png()
      .toBuffer();

    iconCache.set(key, { data: png, expiresAt: Date.now() + 300_000, pending: null });
    return png;
  })();

  iconCache.set(key, { data: cached?.data || null, expiresAt: 0, pending, pendingStartedAt: Date.now() });

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

async function getAuraCircleSvg(tokenId, tier) {
  const normalizedTier = String(tier || 'JUNK').toUpperCase();
  const key = `${tokenId}:${normalizedTier}`;
  const cached = iconCache.get(key);
  if (cached?.data && cached.expiresAt > Date.now()) return cached.data;
  if (isStalePending(cached)) iconCache.delete(key);
  else if (cached?.pending) return cached.pending;

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

  iconCache.set(key, { data: cached?.data || null, expiresAt: 0, pending, pendingStartedAt: Date.now() });

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

function extractHelixaTokenIdFromTerminal(agent) {
  const rawToken = String(agent.token_id ?? '').toLowerCase();
  const platform = String(agent.platform || '').toLowerCase();
  if (platform !== 'helixa') return null;
  const match = rawToken.match(/(\d+)$/);
  return match ? Number(match[1]) : null;
}

function normalizeTerminalAgent(agent) {
  const address = String(agent.address || '').toLowerCase() || null;
  const credScore = Number(agent.cred_score || 0) || 0;
  const credTier = String(agent.cred_tier || tierForScore(credScore)).toUpperCase();
  const platform = String(agent.platform || agent.framework || 'unknown').toLowerCase();
  return {
    tokenId: null,
    name: agent.name || agent.agent_name || `Agent ${agent.id || ''}`.trim(),
    address,
    _graphKey: address,
    _detailKey: address,
    owner: agent.owner_address || agent.address || null,
    framework: agent.framework || agent.platform || 'unknown',
    platform,
    cred_score: credScore,
    cred_tier: credTier,
    handshakeCount: 0,
    mintedAt: agent.created_at || null,
    verified: Boolean(agent.is_verified || agent.verified),
    soulbound: false,
    imageUrl: agent.image_url || null,
    _detailFetched: false,
  };
}

function normalizeLocalHelixaAgent(agent, handshakeCount) {
  const tokenId = Number(agent.tokenId || 0) || null;
  const address = String(agent.agentAddress || '').toLowerCase() || null;
  const credScore = Number(agent.credScore || 0) || 0;
  const credTier = tierForScore(credScore);
  return {
    tokenId,
    name: agent.name || `Agent #${tokenId || '?'}`,
    address,
    _graphKey: tokenId ? `helixa:${tokenId}` : address,
    _detailKey: tokenId ? `helixa:${tokenId}` : address,
    owner: agent.owner || null,
    framework: agent.framework || 'helixa',
    platform: 'helixa',
    cred_score: credScore,
    cred_tier: credTier,
    handshakeCount: Number(handshakeCount || 0),
    mintedAt: agent.mintedAt || null,
    verified: Boolean(agent.verified),
    soulbound: Boolean(agent.soulbound),
    imageUrl: tokenId ? `/trust-graph/api/aura-circle/${tokenId}?tier=${credTier}` : null,
    _detailFetched: false,
  };
}

function findAgentByDetailKey(agents, identifier) {
  const needle = String(identifier || '').toLowerCase();
  return agents.find((agent) => String(agent._detailKey || agent.address || '').toLowerCase() === needle);
}

async function buildData() {
  const [terminalResp, graphResp] = await Promise.all([
    fetchJson(`${TERMINAL_API_BASE}/api/terminal/feed?limit=${MAX_GRAPH_AGENTS}&page=1`),
    fetchJson(`${API_BASE}/api/v2/trust-graph`),
  ]);

  const terminalAgents = terminalResp?.data?.agents || [];
  const rawEdges = Array.isArray(graphResp.edges) ? graphResp.edges : [];
  const localHelixaRows = localStatements.allAgents.all();
  const localByTokenId = new Map(localHelixaRows.map((row) => [Number(row.tokenId), row]));

  const handshakeCountByTokenId = new Map();
  for (const edge of rawEdges) {
    const from = Number(edge.from || 0);
    const to = Number(edge.to || 0);
    if (from) handshakeCountByTokenId.set(from, (handshakeCountByTokenId.get(from) || 0) + 1);
    if (to) handshakeCountByTokenId.set(to, (handshakeCountByTokenId.get(to) || 0) + 1);
  }

  const localHelixaAgents = localHelixaRows.map((row) => normalizeLocalHelixaAgent(row, handshakeCountByTokenId.get(Number(row.tokenId)) || 0));

  const nonHelixaTerminal = terminalAgents.filter((row) => extractHelixaTokenIdFromTerminal(row) == null);
  const remainingSlots = Math.max(0, MAX_GRAPH_AGENTS - localHelixaAgents.length);
  const crossRegistryAgents = nonHelixaTerminal.slice(0, remainingSlots).map(normalizeTerminalAgent);

  const edges = rawEdges
    .map((edge) => {
      const fromToken = Number(edge.from || 0);
      const toToken = Number(edge.to || 0);
      if (!localByTokenId.has(fromToken) || !localByTokenId.has(toToken)) return null;
      return {
        from: `helixa:${fromToken}`,
        to: `helixa:${toToken}`,
        reciprocated: Boolean(edge.reciprocated),
        type: edge.reciprocated ? 'handshake-accepted' : 'handshake',
        createdAt: edge.createdAt || edge.timestamp || null,
      };
    })
    .filter(Boolean);

  const agents = [...localHelixaAgents, ...crossRegistryAgents];
  return { agents, edges, transactions: [] };
}

async function getData() {
  if (graphCache.data && graphCache.expiresAt > Date.now()) return graphCache.data;
  if (graphCache.pending) return graphCache.pending;

  graphCache.pending = (async () => {
    const data = await buildData();
    graphCache.data = data;
    graphCache.expiresAt = Date.now() + 60_000;
    return data;
  })();

  try {
    return await graphCache.pending;
  } finally {
    graphCache.pending = null;
  }
}

async function getDetailedAgent(identifier) {
  const needle = String(identifier || '').toLowerCase();
  const data = await getData();
  const base = findAgentByDetailKey(data.agents, needle);
  if (!base) return null;

  if (needle.startsWith('helixa:')) {
    const tokenId = Number(needle.split(':')[1] || 0);
    const row = localStatements.byTokenId.get(tokenId);
    if (!row) return base;
    return {
      ...normalizeLocalHelixaAgent(row, base.handshakeCount || 0),
      _detailFetched: true,
    };
  }

  try {
    const terminal = await fetchJson(`${TERMINAL_API_BASE}/api/terminal/agent/${encodeURIComponent(needle)}`);
    const detail = terminal?.data || {};
    const credScore = Number(detail.cred_score ?? base.cred_score ?? 0) || 0;
    const credTier = String(detail.cred_tier || base.cred_tier || tierForScore(credScore)).toUpperCase();
    return {
      ...base,
      name: detail.name || base.name,
      address: String(detail.address || base.address || '').toLowerCase() || base.address,
      owner: detail.owner_address || base.owner,
      framework: detail.framework || detail.platform || base.framework,
      platform: String(detail.platform || detail.framework || base.platform || 'unknown').toLowerCase(),
      cred_score: credScore,
      cred_tier: credTier,
      mintedAt: detail.created_at || base.mintedAt,
      verified: Boolean(detail.is_verified ?? base.verified),
      imageUrl: detail.image_url || base.imageUrl,
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
      const data = await getData();
      sendJson(res, 200, { ok: true, service: 'helixa-root-router', port: PORT, mode: 'trust-graph-v2', agents: data.agents.length });
      return;
    }

    if (pathname === '/trust-graph' || pathname === '/trust-graph/' || pathname === '/trust-graph/v2' || pathname === '/trust-graph/v2/') {
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
      const identifier = pathname.replace('/trust-graph/api/agent/', '');
      const agent = await getDetailedAgent(identifier);
      if (!agent) {
        sendJson(res, 404, { error: 'Agent not found' });
        return;
      }
      sendJson(res, 200, agent);
      return;
    }

    if (pathname.startsWith('/trust-graph/api/aura-icon/')) {
      const tokenId = pathname.replace('/trust-graph/api/aura-icon/', '').replace(/\.png$/i, '');
      const png = await getCircularAuraPng(tokenId);
      send(res, 200, png, {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=300',
      });
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

    if (tryServeDocsFile(pathname, res)) {
      return;
    }

    if (SPA_ENTRY_ROUTES.has(pathname)) {
      sendFile(res, DOCS_INDEX_HTML);
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
