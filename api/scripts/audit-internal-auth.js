#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const apiDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(apiDir, '..');
let failed = false;

function readText(relativePath) {
  const fullPath = path.resolve(repoRoot, relativePath);
  return fs.readFileSync(fullPath, 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.resolve(repoRoot, relativePath));
}

function report(level, message) {
  const prefix = level.padEnd(4, ' ');
  console.log(`${prefix} ${message}`);
  if (level === 'FAIL') failed = true;
}

function requirePattern(text, regex, message) {
  if (regex.test(text)) report('PASS', message);
  else report('FAIL', message);
}

function forbidPattern(text, regex, message) {
  if (regex.test(text)) report('FAIL', message);
  else report('PASS', message);
}

const sourcePath = 'api/v2-server.js';
const source = readText(sourcePath);
const authPath = 'api/internal-auth.js';
const authSource = readText(authPath);

console.log('Helixa internal auth audit\n');

requirePattern(source, /createInternalAuthConfig\(process\.env\)/, `${sourcePath} builds internal auth config from env`);
requirePattern(source, /function hasValidInternalKey\(req\)/, `${sourcePath} centralizes internal key validation`);
requirePattern(source, /verifyHmacSignature\(payload, signature, internalAuth\.receiptSecrets\)/, `${sourcePath} verifies receipts against rollover secret set`);
requirePattern(source, /app\.get\('\/api\/v2\/internal\/agent\/:id\/cred-report'/, `${sourcePath} protects internal cred-report endpoint`);
requirePattern(source, /app\.post\('\/api\/v2\/internal\/mint-signature'/, `${sourcePath} protects internal mint-signature endpoint`);
requirePattern(source, /app\.post\('\/api\/v2\/internal\/mint'/, `${sourcePath} protects internal mint endpoint`);

requirePattern(authSource, /getRequiredSecret\(env, 'INTERNAL_API_KEY'/, `${authPath} requires INTERNAL_API_KEY from env`);
requirePattern(authSource, /getOptionalSecret\(env, 'INTERNAL_API_KEY_PREVIOUS'/, `${authPath} supports INTERNAL_API_KEY_PREVIOUS for rollover`);
requirePattern(authSource, /getRequiredSecret\(env, 'RECEIPT_HMAC_SECRET'/, `${authPath} requires RECEIPT_HMAC_SECRET from env`);
requirePattern(authSource, /getOptionalSecret\(env, 'RECEIPT_HMAC_SECRET_PREVIOUS'/, `${authPath} supports RECEIPT_HMAC_SECRET_PREVIOUS for rollover`);

forbidPattern(authSource, /process\.env\.INTERNAL_API_KEY\s*\|\|/, `${authPath} has no INTERNAL_API_KEY fallback logic`);
forbidPattern(authSource, /process\.env\.RECEIPT_HMAC_SECRET\s*\|\|/, `${authPath} has no RECEIPT_HMAC_SECRET fallback logic`);
forbidPattern(authSource, /helixa-default-hmac-key-fallback/, `${authPath} has no hardcoded HMAC fallback marker`);

const endpointMatches = [...source.matchAll(/app\.(get|post)\('([^']*\/api\/v2\/internal[^']*)'/g)]
  .map(([, method, route]) => `${method.toUpperCase()} ${route}`);

if (endpointMatches.length) {
  report('INFO', `internal endpoints in ${sourcePath}:`);
  for (const route of endpointMatches) report('INFO', `  - ${route}`);
} else {
  report('FAIL', `no internal endpoints found in ${sourcePath}`);
}

const envPath = '.env';
if (exists(envPath)) {
  const envText = readText(envPath);
  if (/^INTERNAL_API_KEY=/m.test(envText)) {
    report('WARN', `${envPath} defines INTERNAL_API_KEY locally, rotate deployment env and trusted callers together`);
  }
  if (/^INTERNAL_API_KEY_PREVIOUS=/m.test(envText)) {
    report('WARN', `${envPath} defines INTERNAL_API_KEY_PREVIOUS locally, remove it after rollout is complete`);
  }
  if (/^RECEIPT_HMAC_SECRET=/m.test(envText)) {
    report('WARN', `${envPath} defines RECEIPT_HMAC_SECRET locally, keep rollback values outside the repo copy`);
  }
  if (/^RECEIPT_HMAC_SECRET_PREVIOUS=/m.test(envText)) {
    report('WARN', `${envPath} defines RECEIPT_HMAC_SECRET_PREVIOUS locally, remove it after receipt rollover is complete`);
  }
} else {
  report('INFO', `${envPath} not present in repo root`);
}

const docsPath = 'docs/api-reference.md';
if (exists(docsPath)) {
  const docs = readText(docsPath);
  if (/POST \/api\/v2\/internal\/mint/.test(docs)) {
    report('INFO', `${docsPath} still documents the internal mint route`);
  }
}

const advisoryPath = 'api/v2-server.js.dual-token-backup';
if (exists(advisoryPath)) {
  report('WARN', `${advisoryPath} still exists, remove it to avoid stale secret-handling code hanging around`);
}

console.log('');
if (failed) {
  console.error('Internal auth audit failed. Fix the FAIL items before rotating secrets.');
  process.exit(1);
}

console.log('Internal auth audit passed.');
