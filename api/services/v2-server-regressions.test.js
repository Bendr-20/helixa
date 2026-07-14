const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'v2-server.js'), 'utf8');

test('coinbase verification uses the resolved owner variable', () => {
  assert(!source.includes('getAttestationUid(owner,'), 'coinbase verifier must not reference undefined owner');
  assert(!source.includes('wallet: owner,'), 'coinbase verifier response must not reference undefined owner');
  assert(source.includes('getAttestationUid(owner__,'), 'coinbase verifier should query attestation for owner__');
});

test('mint route has an idempotent existing-agent response before duplicate retries can charge again', () => {
  assert(source.includes('findIndexedAgentByAddress'), 'mint route should look up existing indexed agents for retries');
  assert(source.includes('returnExistingMintedAgent'), 'mint route should return existing token instead of only 409');
  assert(source.includes('Idempotent mint retry guard runs before x402 settlement'), 'existing mint retries should be handled before x402 can charge again');
});

test('mint response enrichment is bounded and non-fatal after irreversible onchain mint', () => {
  assert(source.includes('buildMintResponseAgentData'), 'mint response should use bounded best-effort agent data helper');
  assert(source.includes('setImmediate(() => indexer.reindexAgent(tokenId)'), 'indexer refresh should not block the mint response');
});

test('x402 mint settles before irreversible route execution and is skipped by post-response SDK settlement', () => {
  assert(source.includes('x402PresettleMintMiddleware'), 'mint should use a pre-settlement x402 middleware');
  assert(source.includes('processSettlement'), 'mint pre-settlement middleware should settle payment before route execution');
  assert(source.includes("if (req.method === 'POST' && req.path === '/api/v2/mint') return next();"), 'SDK post-response settlement must skip mint after pre-settlement middleware');
});

test('Intuition ERC-8004 trust assessment resolver uses canonical 8004 IDs', () => {
  assert(source.includes("require('./services/intuition-erc8004')"), 'server should load the Intuition ERC-8004 service');
  assert(source.includes("/.well-known/intuition/erc8004/agents/:chainId/:tokenId/trust-assessment.json"), 'well-known trust assessment resolver route missing');
  assert(source.includes('resolveCanonical8004Mapping(req.params.chainId, req.params.tokenId)'), 'resolver must map canonical ERC-8004 IDs to Helixa token IDs');
  assert(source.includes('canonical_erc8004_agent_not_mapped'), 'resolver should not silently treat Helixa V2 IDs as canonical ERC-8004 IDs');
});

test('Cred scoring includes a separate Intuition graph component', () => {
  assert(source.includes("intuition: { weight: 0.03, label: 'Intuition Graph'"), 'Cred weights should include Intuition graph publication');
  assert(source.includes('intuition8004.getIntuitionCredSignal(agent).rawScore'), 'Cred scoring should use Intuition publication status');
  assert(source.includes('Publish Intuition assessment source'), 'Cred recommendations should include the Intuition publication path');
});
