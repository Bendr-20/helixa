const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3460);
const API_BASE = 'http://127.0.0.1:3457';
const PUBLIC_DIR = path.resolve(__dirname, '..', 'api', 'public');
const V2_HTML = path.join(PUBLIC_DIR, 'trust-graph-v2.html');
const LOGO_PNG = path.resolve(__dirname, '..', 'docs', 'helixa-logo.png');
const HQ_JPG = path.join(PUBLIC_DIR, 'helixa-hq.jpg');

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
  const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
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

async function getAgents() {
  const data = await fetchJson(`${API_BASE}/api/v2/agents?limit=5000`);
  return Array.isArray(data) ? data : (data.agents || []);
}

async function getTrustGraph() {
  const data = await fetchJson(`${API_BASE}/api/v2/trust-graph`);
  return data || {};
}

function findAgentByAddress(agents, address) {
  const needle = String(address || '').toLowerCase();
  return agents.find((agent) => {
    return [agent.address, agent.agentAddress, agent.agent_wallet, agent.owner, agent.owner_address]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase() === needle);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    const pathname = decodeURIComponent(url.pathname);

    if (pathname === '/' || pathname === '/v2' || pathname === '/v2/') {
      res.writeHead(302, {
        Location: '/trust-graph/v2/',
        'Cache-Control': 'no-store',
      });
      res.end();
      return;
    }

    if (pathname === '/health') {
      sendJson(res, 200, { ok: true, service: 'helixa-root-router', port: PORT, mode: 'trust-graph-v2' });
      return;
    }

    if (pathname === '/trust-graph' || pathname === '/trust-graph/') {
      res.writeHead(302, {
        Location: '/trust-graph/v2/',
        'Cache-Control': 'no-store',
      });
      res.end();
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
      sendFile(res, HQ_JPG, 'image/jpeg');
      return;
    }

    if (pathname === '/trust-graph/api/agents') {
      const agents = await getAgents();
      sendJson(res, 200, agents);
      return;
    }

    if (pathname === '/trust-graph/api/edges') {
      const graph = await getTrustGraph();
      sendJson(res, 200, graph.edges || []);
      return;
    }

    if (pathname === '/trust-graph/api/transactions') {
      const graph = await getTrustGraph();
      const transactions = (graph.edges || []).map((edge) => ({
        from: edge.from,
        to: edge.to,
        token: 'HANDSHAKE',
        count: 1,
        createdAt: edge.createdAt || edge.timestamp || null,
      }));
      sendJson(res, 200, transactions);
      return;
    }

    if (pathname.startsWith('/trust-graph/api/agent/')) {
      const address = pathname.replace('/trust-graph/api/agent/', '');
      const agents = await getAgents();
      const agent = findAgentByAddress(agents, address);
      if (!agent) {
        sendJson(res, 404, { error: 'Agent not found' });
        return;
      }
      sendJson(res, 200, agent);
      return;
    }

    if (pathname.startsWith('/trust-graph/api/aura-circle/')) {
      const tokenId = pathname.replace('/trust-graph/api/aura-circle/', '');
      const upstream = `${API_BASE}/api/v2/aura/${encodeURIComponent(tokenId)}.png${url.search}`;
      await proxyBinary(res, upstream);
      return;
    }

    send(res, 404, 'Not Found', { 'Content-Type': 'text/plain; charset=utf-8' });
  } catch (err) {
    sendJson(res, 500, { error: 'Router error', detail: err.message || String(err) });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[helixa-root-router] listening on ${PORT}`);
  console.log(`[helixa-root-router] mode=trust-graph-v2`);
});
