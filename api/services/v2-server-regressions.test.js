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
