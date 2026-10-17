#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const fail = (message) => { throw new Error(message); };
const assert = (condition, message) => { if (!condition) fail(message); };

const publicDocs = [
  'README.md',
  'DEPLOYED.md',
  'api/README.md',
  'api/cred-looper/README.md',
  'api/cred-shadow/README.md',
  'a0x-integration-spec.md',
  'agentkit-plugin/README.md',
  'docs/api-reference.md',
  'docs/docs/getting-started.md',
  'docs/whitepaper-src.md',
  'docs/cred-score-whitepaper.md',
  'docs/x402-mint-guide.md',
  'frontend-v2/public/docs/getting-started.md',
  'frontend-v2/public/docs/index.html',
  'frontend-v2/src/pages/Docs.tsx',
  'helixa-openclaw-skill/SKILL.md',
  'helixa-openclaw-skill/references/api.md',
  'helixa-openclaw-skill/references/contracts.md',
  'helixa-openclaw-skill/references/cred-scoring.md',
  'helixa-openclaw-skill/references/siwa.md',
  'sdk/README.md',
  'sdk-v2/README.md',
  'skills/agentdna-mint/SKILL.md',
];

for (const file of publicDocs) assert(fs.existsSync(path.join(root, file)), `missing public doc: ${file}`);

assert(read('docs/docs/getting-started.md') === read('frontend-v2/public/docs/getting-started.md'), 'getting-started copies diverged');
assert(read('docs/docs/index.html') === read('frontend-v2/public/docs/index.html'), 'static docs index copies diverged');
assert(read('docs/whitepaper-src.md') === read('docs/cred-score-whitepaper.md'), 'markdown whitepaper copies diverged');
assert(read('docs/whitepaper.html') === read('docs/docs/whitepaper.html'), 'rendered whitepaper copies diverged');
assert(read('docs/whitepaper.html') === read('docs/docs/whitepaper/index.html'), 'rendered whitepaper index copy diverged');

const payments = read('api/services/payments.js');
const price = (key) => {
  const match = payments.match(new RegExp(`\\b${key}:\\s*([0-9.]+)`));
  assert(match, `missing PRICING.${key}`);
  return Number(match[1]);
};
assert(price('agentMint') === 1, 'agentMint price drifted; update docs and this gate');
assert(price('update') === 0, 'update price drifted; update docs and this gate');
assert(price('credReport') === 0.01, 'credReport price drifted; update docs and this gate');
assert(price('soulLock') === 0, 'soulLock price drifted; update docs and this gate');
assert(price('soulHandshake') === 0, 'soulHandshake price drifted; update docs and this gate');

const corpus = publicDocs.map((file) => `### ${file}\n${read(file)}`).join('\n');
const forbidden = [
  ['removed Cred endpoint', '/api/v2/agent/{id}/cred-breakdown'],
  ['removed Cred endpoint', '/api/v2/agent/:id/cred-breakdown'],
  ['removed discovery URL', 'api.helixa.xyz/.well-known/openapi.json'],
  ['stale mint price', 'Mint is $5 USDC'],
  ['stale mint price', 'Mint costs $5 USDC'],
  ['stale mint state', 'registration is currently free'],
  ['stale identity count', '1,000+ agents'],
  ['stale Bankr service count', '6 x402 Cloud endpoints'],
  ['dead Bankr wallet root', 'https://x402.bankr.bot/0xb92d2ab129072890b23ee3b1baff7c501cff9e49/)'],
  ['misleading ERC-8004 claim', 'ERC-8004 native'],
  ['stale key-export route', '/api/v2/agent/:id/export-key'],
];
for (const [label, needle] of forbidden) assert(!corpus.includes(needle), `${label}: ${needle}`);

const packageJson = JSON.parse(read('api/package.json'));
assert(packageJson.main === 'v2-server.js', 'api package main is not v2-server.js');
assert(packageJson.scripts?.start === 'node v2-server.js', 'api npm start is not wired to v2-server.js');
assert(fs.existsSync(path.join(root, 'api', packageJson.main)), 'api package main file does not exist');

const server = read('api/v2-server.js');
for (const route of [
  "app.get('/api/v2/pricing'",
  "app.get('/api/v2/agent/:id/cred'",
  "app.post('/api/v2/mint'",
  "app.post('/api/v2/agent/:id/update'",
  "app.get('/api/v2/openapi.json'",
  "app.get('/.well-known/agent-registry'",
]) assert(server.includes(route), `documented route missing from server: ${route}`);
assert(!server.includes("'/api/v2/agent/{id}/personality'"), 'OpenAPI still documents removed personality route');
assert(!server.includes("'/api/v2/leaderboard'"), 'OpenAPI still documents removed v2 leaderboard route');
assert(!server.includes("'legendary']"), 'OpenAPI still exposes obsolete Legendary Cred tier');
assert(server.includes("required: ['outcome', 'sessionId', 'timestamp']"), 'OpenAPI session outcome requirements drifted');
assert(server.includes("enum: ['COMPLETED', 'FAILED', 'VIOLATED', 'DEFAULTED', 'INJECTED']"), 'OpenAPI session outcome enum drifted');
assert(!server.includes('ethers.Wallet.createRandom()'), 'Solana registration must not generate a custodial EVM private key');
assert(!server.includes('evmWallet.privateKey'), 'Solana registration must not persist a private key');
assert(server.includes("error: 'evmAddress required (caller-controlled EVM wallet)'"), 'Solana registration must require a caller-controlled EVM wallet');
const contractService = read('api/services/contract.js');
assert(!contractService.includes('0x97cf081780D71F2189889ce86941cF1837997873'), 'compromised deployer address remains in runtime payment defaults');

const candidateParameters = read('api/cred-shadow/parameters.js');
for (const [category, weight] of [['operational', '30n'], ['financial', '25n'], ['onchain', '25n'], ['identity', '20n']]) {
  assert(candidateParameters.includes(`${category}: ${weight}`), `Candidate 0.1 ${category} weight drifted`);
}
const candidateReadme = read('api/cred-shadow/README.md');
assert(candidateReadme.includes('not production-approved'), 'Candidate 0.1 production boundary is undocumented');
const looperReadme = read('api/cred-looper/README.md');
assert(looperReadme.includes('expected subjects remain `UNRATED`'), 'Looper shadow rating gate is undocumented');
const publicCredDocs = [read('README.md'), read('docs/api-reference.md'), read('docs/whitepaper-src.md'), read('helixa-openclaw-skill/references/cred-scoring.md')].join('\n');
for (const expected of ['688 activated Loopers', 'holder/owner EOA', 'Candidate 0.1', 'shadow']) {
  assert(publicCredDocs.includes(expected), `Looper Cred documentation missing: ${expected}`);
}
assert(publicCredDocs.includes('all 688') || publicCredDocs.includes('688 `UNRATED`'), 'Looper corpus must document that every subject remained UNRATED');

const require = createRequire(import.meta.url);
const { getDocsHTML } = require(path.join(root, 'api/docs-page.js'));
const rendered = getDocsHTML({
  pricing: { agentMint: 2.5, update: 0, credReport: 0.25 },
  contractAddress: '0x1111111111111111111111111111111111111111',
  facilitatorUrl: 'https://facilitator.example',
});
for (const expected of ['$2.50 USDC', '$0.25 USDC', 'https://facilitator.example', '0x1111111111111111111111111111111111111111']) {
  assert(rendered.includes(expected), `runtime docs did not render ${expected}`);
}
assert(rendered.includes('<span class="badge free">free</span>'), 'runtime docs did not render free update badge');

for (const file of publicDocs.filter((name) => name.endsWith('.md'))) {
  const source = read(file);
  const links = [...source.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)].map((match) => match[1].trim());
  for (const target of links) {
    if (!target || target.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
    const clean = target.split('#')[0].split('?')[0];
    if (!clean) continue;
    const resolved = path.resolve(path.dirname(path.join(root, file)), clean);
    assert(fs.existsSync(resolved), `broken local link in ${file}: ${target}`);
  }
}

console.log(`PASS docs accuracy gate (${publicDocs.length} public/developer docs)`);
