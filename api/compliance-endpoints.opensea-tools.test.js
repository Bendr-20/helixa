const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const mountCompliance = require('./compliance-endpoints');

async function withServer(run, setup = () => {}) {
  const app = express();
  app.use(express.json());
  const setupResult = setup(app) || {};
  mountCompliance(app, setupResult.mountOptions || {});
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

async function withEnv(overrides, run) {
  const previous = {};
  for (const [key, value] of Object.entries(overrides)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
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
    assert.equal(manifest.featuredImage, 'https://helixa.xyz/multipass/opensea/helixa-agentdna-tool.jpg');
    assert.notEqual(manifest.featuredImage, manifest.image);
    assert.doesNotMatch(manifest.featuredImage, /aura\/1\.png|api\/v2\/agent\/1|bendr/i);
    assert.equal(manifest.inputs.properties.tokenId.type, 'integer');
    assert.deepEqual(manifest.inputs.required, ['tokenId']);
    assert.equal(manifest.outputs.properties.credScore.type, 'integer');
    assert.equal(manifest.access.logic, 'OR');
    assert.equal(manifest.access.requirements[0].kind, '0xbdf8c428');
    assert.equal(manifest.access.requirements[0].data, '0x0000000000000000000000002e3b541c59d38b84e3bc54e977200230a204fe60');
    assert.match(manifest.access.requirements[0].label, /Agent Auras/);
    assert.equal(manifest.access.requirements[0].links.opensea, 'https://opensea.io/collection/helixa-376479287');
  });
});

test('x402 discovery advertises paid agent mint instead of claiming everything is free', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/.well-known/x402.json`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.pricing.agentMint, '$1.00');
    assert.equal(body.pricing.status, 'mixed');
    assert.equal(body.accepts[0].method, 'POST');
    assert.equal(body.accepts[0].path, 'https://x402.bankr.bot/0xb92d2ab129072890b23ee3b1baff7c501cff9e49/mint');
    assert.equal(body.accepts[0].resource, 'https://x402.bankr.bot/0xb92d2ab129072890b23ee3b1baff7c501cff9e49/mint');
    assert.equal(body.accepts[0].network, 'eip155:8453');
    assert.equal(body.accepts[0].asset.symbol, 'USDC');
    assert.equal(body.accepts[0].payTo, '0x8AEE621035D93Deb3C0C1177fac252dC2dd501a0');
    assert.equal(body.facilitator, 'https://api.bankr.bot/facilitator');
    assert.equal(body.directApiFallback, 'https://api.helixa.xyz/api/v2/mint');
    assert.doesNotMatch(JSON.stringify(body), /All public API endpoints are currently free|No x402 payment is required/i);
  });
});

test('llms text calls out x402-gated minting', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/llms.txt`);
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.match(text, /POST https:\/\/x402\.bankr\.bot\/0xb92d2ab129072890b23ee3b1baff7c501cff9e49\/mint .*Bankr x402/i);
    assert.match(text, /Read endpoints are free/i);
    assert.doesNotMatch(text, /All public API endpoints are currently free\. No x402 payment required/i);
  });
});

test('agent-aura-lookup endpoint returns a compact Agent Aura profile envelope', async () => {
  const previousBase = process.env.HELIXA_TOOL_PROFILE_BASE_URL;
  await withEnv({ HELIXA_TOOL_NFT_GATE_DISABLED: '1', OPENSEA_TOOL_USAGE_REPORTING_DISABLED: '1' }, () => withServer(async (baseUrl) => {
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
    assert.equal(body.collectionUrl, 'https://opensea.io/collection/helixa-376479287');
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
  }));
  if (previousBase === undefined) delete process.env.HELIXA_TOOL_PROFILE_BASE_URL;
  else process.env.HELIXA_TOOL_PROFILE_BASE_URL = previousBase;
});

test('agent-aura-lookup waits long enough for the public profile route to enrich output', async () => {
  const previousBase = process.env.HELIXA_TOOL_PROFILE_BASE_URL;
  await withEnv({ HELIXA_TOOL_NFT_GATE_DISABLED: '1', OPENSEA_TOOL_USAGE_REPORTING_DISABLED: '1' }, () => withServer(async (baseUrl) => {
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
  }));
  if (previousBase === undefined) delete process.env.HELIXA_TOOL_PROFILE_BASE_URL;
  else process.env.HELIXA_TOOL_PROFILE_BASE_URL = previousBase;
});

test('agent-aura-lookup emits a zero-value x402 challenge for NFT-gated access', async () => {
  await withEnv({ OPENSEA_API_KEY: 'test-opensea-key', OPENSEA_TOOL_USAGE_REPORTING_DISABLED: '1' }, () => withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v2/tools/agent-aura-lookup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tokenId: 1 }),
    });
    assert.equal(res.status, 402);
    assert.equal(res.headers.get('x-accept-payment'), 'x402');
    const body = await res.json();
    assert.equal(body.x402Version, 1);
    assert.equal(body.accepts[0].maxAmountRequired, '0');
    assert.equal(body.accepts[0].payTo, '0x339559A2d1CD15059365FC7bD36b3047BbA480E0');
    assert.equal(body.accepts[0].network, 'base');
  }));
});

test('agent-aura-lookup reports successful zero-value EIP-3009 invocations to OpenSea usage', async () => {
  const usagePayloads = [];
  const mockAuthorization = {
    signature: '0x' + '11'.repeat(65),
    from: '0x00000000000000000000000000000000000000aa',
    to: '0x339559A2d1CD15059365FC7bD36b3047BbA480E0',
    value: '0',
    validAfter: '0',
    validBefore: String(Math.floor(Date.now() / 1000) + 300),
    nonce: '0x' + '22'.repeat(32),
    chainId: 8453,
  };
  const mockGate = {
    async check(_request, ctx) {
      ctx.callerAddress = mockAuthorization.from;
      ctx.callerAuthorization = mockAuthorization;
      ctx.gates.predicate = { granted: true };
      return null;
    },
  };

  await withEnv({ OPENSEA_API_KEY: 'test-opensea-key' }, () => withServer(async (baseUrl) => {
    process.env.OPENSEA_TOOL_USAGE_URL = `${baseUrl}/usage`;
    const res = await fetch(`${baseUrl}/api/v2/tools/agent-aura-lookup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tokenId: 1 }),
    });
    assert.equal(res.status, 200);
    assert.equal(usagePayloads.length, 1);
    assert.equal(usagePayloads[0].verification_type, 'eip3009_authorization');
    assert.equal(usagePayloads[0].tool_chain_id, 8453);
    assert.equal(usagePayloads[0].tool_registry_address, '0x265BB2DBFC0A8165C9A1941Eb1372F349baD2cf1');
    assert.equal(usagePayloads[0].tool_onchain_id, '192');
    assert.equal(usagePayloads[0].eip3009.caller_address, mockAuthorization.from);
    assert.equal(usagePayloads[0].eip3009.value, '0');
  }, (app) => {
    app.post('/usage', (req, res) => {
      usagePayloads.push(req.body);
      res.json({ ok: true });
    });
    return { mountOptions: { agentAuraTool: { gates: [mockGate] } } };
  }));
  delete process.env.OPENSEA_TOOL_USAGE_URL;
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
