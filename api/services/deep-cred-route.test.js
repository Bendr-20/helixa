const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const serverPath = path.join(__dirname, '..', 'v2-server.js');
const source = fs.readFileSync(serverPath, 'utf8');

test('terminal Deep CRED cached read and paid generation routes exist', () => {
  assert.match(source, /app\.get\('\/api\/terminal\/agent\/:id\/deep-cred-report'/);
  assert.match(source, /app\.post\('\/api\/terminal\/agent\/:id\/deep-cred-report'/);
});

test('Deep CRED route resolves agent before payment verification', () => {
  const postIdx = source.indexOf("app.post('/api/terminal/agent/:id/deep-cred-report'");
  assert.ok(postIdx > 0, 'POST route missing');
  const routeBlock = source.slice(postIdx, postIdx + 5000);
  const resolveIdx = routeBlock.indexOf('resolveTerminalDeepCredAgent');
  const paymentIdx = routeBlock.indexOf('verifyDeepCredRoutePayment');
  assert.ok(resolveIdx > 0, 'POST route must resolve terminal agent');
  assert.ok(paymentIdx > 0, 'POST route must verify payment');
  assert.ok(resolveIdx < paymentIdx, 'agent resolution must happen before payment verification');
  const helperIdx = source.indexOf('async function verifyDeepCredRoutePayment');
  assert.ok(helperIdx > 0, 'route-local payment helper missing');
  assert.match(source.slice(helperIdx, helperIdx + 1000), /verifyPaymentFromRequest/);
});

test('Deep CRED route is not registered in the global x402 route map', () => {
  const x402Start = source.indexOf('const x402Routes = {}');
  const x402End = source.indexOf('// ─── USDC + $CRED TX Hash Payment Verification', x402Start);
  assert.ok(x402Start > 0 && x402End > x402Start, 'x402 route map block missing');
  const x402Block = source.slice(x402Start, x402End);
  assert.equal(x402Block.includes('deep-cred-report'), false);
});

test('Bankr Risk Analyst uses the dedicated Bankr LLM key before profile API key', () => {
  const helperIdx = source.indexOf('function getBankrLlmKey');
  assert.ok(helperIdx > 0, 'getBankrLlmKey helper missing');
  const fnIdx = source.indexOf('async function runBankrRiskAnalyst');
  assert.ok(fnIdx > 0, 'runBankrRiskAnalyst helper missing');
  const block = source.slice(fnIdx, fnIdx + 1500);
  assert.match(block, /apiKey:\s*getBankrLlmKey\(\)\s*\|\|\s*getBankrApiKey\(\)/);
});

test('AWS Bankr secret can provide the dedicated LLM key', () => {
  const initIdx = source.indexOf('async function initBankrApiKey');
  assert.ok(initIdx > 0, 'initBankrApiKey helper missing');
  const block = source.slice(initIdx, initIdx + 1400);
  assert.match(block, /_bankrLlmKey\s*=\s*parsed\.BANKR_LLM_KEY\s*\|\|\s*parsed\.llmKey\s*\|\|\s*parsed\.llm_key/);
});
