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

console.log('Helixa internal auth audit\n');

requirePattern(source, /getRequiredSecret\('INTERNAL_API_KEY'/, `${sourcePath} requires INTERNAL_API_KEY from env`);
requirePattern(source, /getRequiredSecret\('RECEIPT_HMAC_SECRET'/, `${sourcePath} requires RECEIPT_HMAC_SECRET from env`);
requirePattern(source, /function hasValidInternalKey\(req\)/, `${sourcePath} centralizes internal key validation`);
requirePattern(source, /app\.get\('\/api\/v2\/internal\/agent\/:id\/cred-report'/, `${sourcePath} protects internal cred-report endpoint`);
requirePattern(source, /app\.post\('\/api\/v2\/internal\/mint-signature'/, `${sourcePath} protects internal mint-signature endpoint`);
requirePattern(source, /app\.post\('\/api\/v2\/internal\/mint'/, `${sourcePath} protects internal mint endpoint`);

forbidPattern(source, /process\.env\.INTERNAL_API_KEY\s*\|\|/, `${sourcePath} has no INTERNAL_API_KEY fallback logic`);
forbidPattern(source, /process\.env\.RECEIPT_HMAC_SECRET\s*\|\|/, `${sourcePath} has no RECEIPT_HMAC_SECRET fallback logic`);
forbidPattern(source, /helixa-default-hmac-key-fallback/, `${sourcePath} has no hardcoded HMAC fallback marker`);

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
  if (/^RECEIPT_HMAC_SECRET=/m.test(envText)) {
    report('WARN', `${envPath} defines RECEIPT_HMAC_SECRET locally, keep rollback values outside the repo copy`);
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
  const advisory = readText(advisoryPath);
  const riskyAdvisoryPatterns = [
    /process\.env\.INTERNAL_API_KEY\s*\|\|/,
    /process\.env\.RECEIPT_HMAC_SECRET\s*\|\|/,
    /helixa-default-hmac-key-fallback/
  ];
  if (riskyAdvisoryPatterns.some((regex) => regex.test(advisory))) {
    report('WARN', `${advisoryPath} still contains old fallback patterns, treat it as archival only`);
  } else {
    report('INFO', `${advisoryPath} has no fallback markers`);
  }
}

console.log('');
if (failed) {
  console.error('Internal auth audit failed. Fix the FAIL items before rotating secrets.');
  process.exit(1);
}

console.log('Internal auth audit passed.');
