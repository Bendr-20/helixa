const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const mountCompliance = require('./compliance-endpoints');

async function withServer(run, setup = () => {}) {
  const app = express();
  app.use(express.json());
  mountCompliance(app);
  setup(app);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = server.address().port;
  try {
    return await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  }
}

test('serves an ERC-8257 manifest for the Agent Auras lookup tool', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/.well-known/ai-tool/agent-aura-lookup.json`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /application\/json/);

    const manifest = await res.json();
    assert.equal(manifest.type, 'https://ercs.ethereum.org/ERCS/erc-8257#tool-manifest-v1');
    assert.equal(manifest.name, 'agent-aura-lookup');
    assert.equal(manifest.endpoint, 'https://api.helixa.xyz/api/v2/tools/agent-aura-lookup');
    assert.equal(manifest.creatorAddress, '0x339559a2d1cd15059365fc7bd36b3047bba480e0');
    assert.deepEqual(manifest.tags, ['ai', 'nft', 'helixa', 'cred', 'agentdna']);
    assert.equal(manifest.inputs.properties.tokenId.type, 'integer');
    assert.deepEqual(manifest.inputs.required, ['tokenId']);
    assert.equal(manifest.outputs.properties.credScore.type, 'integer');
    assert.equal(manifest.access.logic, 'OR');
    assert.equal(manifest.access.requirements[0].kind, '0xbdf8c428');
    assert.equal(manifest.access.requirements[0].data, '0x0000000000000000000000002e3b541c59d38b84e3bc54e977200230a204fe60');
    assert.match(manifest.access.requirements[0].label, /Agent Auras/);
    assert.equal(manifest.access.requirements[0].links.opensea, 'https://opensea.io/collection/agent-auras');
  });
});

test('agent-aura-lookup endpoint returns a compact Agent Aura profile envelope', async () => {
  const previousBase = process.env.HELIXA_TOOL_PROFILE_BASE_URL;
  await withServer(async (baseUrl) => {
    process.env.HELIXA_TOOL_PROFILE_BASE_URL = baseUrl;
    const res = await fetch(`${baseUrl}/api/v2/tools/agent-aura-lookup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tokenId: 1 }),
    });
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.tokenId, 1);
    assert.equal(body.name, 'Bendr 2.0');
    assert.equal(body.credScore, 80);
    assert.equal(body.tier, 'Prime');
    assert.equal(body.verified, true);
    assert.equal(body.contract, '0x2e3b541c59d38b84e3bc54e977200230a204fe60');
    assert.equal(body.profileUrl, 'https://api.helixa.xyz/api/v2/agent/1');
    assert.equal(body.imageUrl, 'https://api.helixa.xyz/api/v2/aura/1.png');
    assert.equal(body.collectionUrl, 'https://opensea.io/collection/agent-auras');
    assert.equal(body.openseaUrl, 'https://opensea.io/assets/base/0x2e3b541c59d38b84e3bc54e977200230a204fe60/1');
    assert.equal(body.standard, 'ERC-8004');
    assert.equal(body.tool, 'agent-aura-lookup');
  }, (app) => {
    app.get('/api/v2/agent/:id', (req, res) => {
      res.json({
        tokenId: Number(req.params.id),
        name: 'Bendr 2.0',
        credScore: 80,
        tier: 'Prime',
        verified: true,
        owner: '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea',
      });
    });
  });
  if (previousBase === undefined) delete process.env.HELIXA_TOOL_PROFILE_BASE_URL;
  else process.env.HELIXA_TOOL_PROFILE_BASE_URL = previousBase;
});

test('agent-aura-lookup waits long enough for the public profile route to enrich output', async () => {
  const previousBase = process.env.HELIXA_TOOL_PROFILE_BASE_URL;
  await withServer(async (baseUrl) => {
    process.env.HELIXA_TOOL_PROFILE_BASE_URL = baseUrl;
    const res = await fetch(`${baseUrl}/api/v2/tools/agent-aura-lookup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tokenId: 1 }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.name, 'Slow Bendr');
    assert.equal(body.credScore, 80);
  }, (app) => {
    app.get('/api/v2/agent/:id', (req, res) => {
      setTimeout(() => res.json({ name: 'Slow Bendr', credScore: 80 }), 1700);
    });
  });
  if (previousBase === undefined) delete process.env.HELIXA_TOOL_PROFILE_BASE_URL;
  else process.env.HELIXA_TOOL_PROFILE_BASE_URL = previousBase;
});

test('agent-aura-lookup rejects invalid token IDs', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v2/tools/agent-aura-lookup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tokenId: 0 }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /tokenId/i);
  });
});
