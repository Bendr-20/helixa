'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { builtinModules } = require('node:module');
const acorn = require('acorn');
const walk = require('acorn-walk');

const API_ROOT = path.resolve(__dirname, '../..');
const REPOSITORY_ROOT = path.dirname(API_ROOT);
const SHADOW_ROOT = path.join(API_ROOT, 'cred-shadow');
const EVIDENCE_ROOT = path.join(API_ROOT, 'cred-evidence');
const LOOPER_ROOT = path.join(API_ROOT, 'cred-looper');
const AFG_ROOT = path.join(API_ROOT, 'cred-afg');
const PAYMENTS_ROOT = path.join(API_ROOT, 'cred-payments');
const SHADOW_CLI = path.join(API_ROOT, 'scripts', 'run-cred-shadow-replay.js');
const EVIDENCE_CLI = path.join(API_ROOT, 'scripts', 'compile-cred-evidence.js');
const LOOPER_BUILD_CLI = path.join(API_ROOT, 'scripts', 'build-looper-cred-corpus.js');
const LOOPER_COLLECT_CLI = path.join(API_ROOT, 'scripts', 'collect-looper-base-proofs.js');
const AFG_BUILD_CLI = path.join(API_ROOT, 'scripts', 'build-looper-afg-shadow.js');
const AFG_VERIFY_CLI = path.join(API_ROOT, 'scripts', 'verify-afg-statement.js');
const AFG_COLLECT_CLI = path.join(API_ROOT, 'scripts', 'collect-looper-afg.js');
const PAYMENTS_BUILD_CLI = path.join(API_ROOT, 'scripts', 'build-looper-payment-observer.js');
const PAYMENTS_COLLECT_CLI = path.join(API_ROOT, 'scripts', 'collect-looper-payments.js');
const PAYMENT_OPERATION_CLIS = [
  'launch-looper-payment-operation.js',
  'operate-looper-payments.js',
  'run-looper-payment-shadow.js',
  'manage-looper-payment-cron.js',
  'manage-looper-payment-retention.js',
].map((file) => path.join(API_ROOT, 'scripts', file));
const REQUIRED_PRODUCTION_ROOTS = [
  'v2-server.js',
  'indexer.js',
  'cred-oracle-updater.js',
  'terminal-sync.js',
  'compliance-endpoints.js',
  'mcp-handler.js',
].map((file) => path.join(API_ROOT, file));
const BUILTINS = new Set(builtinModules.flatMap((name) => [name, 'node:' + name]));
const PRODUCTION_DATABASE_FILENAMES = new Set([
  'agents.db',
  'analytics.db',
  'solana-registrations.db',
  'terminal.db',
]);

// Exact-file exceptions for legacy production loaders. Each expression is unrelated
// to CRED shadow scoring; any spelling or location change must be reviewed here.
const DYNAMIC_LOADER_ALLOWLIST = new Map([
  [path.join(API_ROOT, 'cred-oracle-updater.js'), new Set([
    "require(path.join(__dirname, 'node_modules', 'ethers'))",
    "require(path.join(__dirname, 'node_modules', '@aws-sdk', 'client-secrets-manager'))",
  ])],
  [path.join(API_ROOT, 'v2-server.js'), new Set([
    "require(path.join(__dirname, 'node_modules', '@aws-sdk', 'client-secrets-manager'))",
    "require(require('os').homedir() + '/.config/talent-protocol/config.json')",
    "require(require('os').homedir() + '/.config/bankr/config.json')",
  ])],
]);

function isInside(file, directory) {
  const relative = path.relative(directory, file);
  return relative === '' || (!relative.startsWith('..' + path.sep) && !path.isAbsolute(relative));
}

function listJavaScript(directory) {
  const found = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'test' || entry.name === 'cred-shadow' || entry.name === 'cred-evidence' || entry.name === 'cred-looper' || entry.name === 'cred-afg' || entry.name === 'cred-payments') continue;
      found.push(...listJavaScript(absolute));
    } else if (entry.isFile() && entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) {
      if (![SHADOW_CLI, EVIDENCE_CLI, LOOPER_BUILD_CLI, LOOPER_COLLECT_CLI, AFG_BUILD_CLI, AFG_VERIFY_CLI, AFG_COLLECT_CLI, PAYMENTS_BUILD_CLI, PAYMENTS_COLLECT_CLI, ...PAYMENT_OPERATION_CLIS].includes(absolute)) found.push(absolute);
    }
  }
  return found.sort();
}

function parseJavaScript(file) {
  const source = fs.readFileSync(file, 'utf8');
  const options = { ecmaVersion: 'latest', allowHashBang: true, locations: true };
  let scriptError;
  try {
    return { source, ast: acorn.parse(source, { ...options, sourceType: 'script' }) };
  } catch (error) {
    scriptError = error;
  }
  try {
    return { source, ast: acorn.parse(source, { ...options, sourceType: 'module' }) };
  } catch (moduleError) {
    throw new Error(file + ' failed script parse (' + scriptError.message + ') and module parse (' + moduleError.message + ')');
  }
}

function literalSpecifier(node) {
  return node && node.type === 'Literal' && typeof node.value === 'string' ? node.value : null;
}

function moduleSpecifiers(file, dynamicAllowlist = new Map()) {
  const { source, ast } = parseJavaScript(file);
  const specifiers = [];
  function dynamicFailure(node, kind) {
    const expression = source.slice(node.start, node.end);
    const allowed = dynamicAllowlist.get(file);
    if (!allowed || !allowed.has(expression)) {
      throw new Error(file + ':' + node.loc.start.line + ' has unsupported ' + kind + ': ' + expression);
    }
  }
  walk.simple(ast, {
    ImportDeclaration(node) { specifiers.push(node.source.value); },
    ExportNamedDeclaration(node) { if (node.source) specifiers.push(node.source.value); },
    ExportAllDeclaration(node) { specifiers.push(node.source.value); },
    ImportExpression(node) {
      const specifier = literalSpecifier(node.source);
      if (specifier === null) dynamicFailure(node, 'dynamic import');
      else specifiers.push(specifier);
    },
    CallExpression(node) {
      if (node.callee.type === 'Identifier' && node.callee.name === 'require') {
        const specifier = node.arguments.length === 1 ? literalSpecifier(node.arguments[0]) : null;
        if (specifier === null) dynamicFailure(node, 'dynamic require');
        else specifiers.push(specifier);
      }
      if (node.callee.type === 'MemberExpression' && node.callee.object.type === 'Identifier' && node.callee.object.name === 'require') {
        throw new Error(file + ':' + node.loc.start.line + ' uses unsupported require member loading');
      }
    },
  });
  return { source, ast, specifiers };
}

function resolveLocal(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [base, base + '.js', base + '.json', path.join(base, 'index.js')];
  const target = candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  if (!target) throw new Error(fromFile + ' has unresolved local module ' + specifier);
  return fs.realpathSync(target);
}

function buildGraph(roots, options = {}) {
  const graphRoot = options.graphRoot || REPOSITORY_ROOT;
  const shadowRoot = options.shadowRoot || SHADOW_ROOT;
  const evidenceRoot = options.evidenceRoot || EVIDENCE_ROOT;
  const looperRoot = options.looperRoot || LOOPER_ROOT;
  const afgRoot = options.afgRoot || AFG_ROOT;
  const paymentsRoot = options.paymentsRoot || PAYMENTS_ROOT;
  const mode = options.mode || 'production';
  const dynamicAllowlist = options.dynamicAllowlist || new Map();
  const queue = roots.map((file) => fs.realpathSync(file));
  const visited = new Set();
  while (queue.length) {
    const file = queue.shift();
    if (visited.has(file) || path.extname(file) === '.json') continue;
    visited.add(file);
    const { specifiers } = moduleSpecifiers(file, dynamicAllowlist);
    for (const specifier of specifiers) {
      const target = resolveLocal(file, specifier);
      if (target) {
        if (!isInside(target, graphRoot)) throw new Error(file + ' escapes repository graph root through ' + specifier);
        if (mode === 'production' && (isInside(target, shadowRoot) || isInside(target, evidenceRoot) || isInside(target, looperRoot) || isInside(target, afgRoot) || isInside(target, paymentsRoot))) {
          throw new Error('production graph reaches offline CRED module: ' + file + ' -> ' + target);
        }
        if (mode === 'shadow' && target !== SHADOW_CLI && !isInside(target, shadowRoot)) {
          throw new Error('shadow CLI graph reaches non-shadow local module: ' + target);
        }
        if (mode === 'evidence' && target !== EVIDENCE_CLI && !isInside(target, evidenceRoot) && !isInside(target, shadowRoot)) {
          throw new Error('evidence CLI graph reaches unauthorized local module: ' + target);
        }
        if (mode === 'looper-build' && target !== LOOPER_BUILD_CLI && !isInside(target, looperRoot) && !isInside(target, evidenceRoot) && !isInside(target, shadowRoot)) {
          throw new Error('Looper build graph reaches unauthorized local module: ' + target);
        }
        if (mode === 'looper-collect' && target !== LOOPER_COLLECT_CLI && !isInside(target, looperRoot) && !isInside(target, shadowRoot)) {
          throw new Error('Looper collector graph reaches unauthorized local module: ' + target);
        }
        if (mode === 'afg-offline' && ![AFG_BUILD_CLI, AFG_VERIFY_CLI].includes(target) && !isInside(target, afgRoot) && !isInside(target, looperRoot) && !isInside(target, shadowRoot)) {
          throw new Error('AFG offline graph reaches unauthorized local module: ' + target);
        }
        if (mode === 'afg-collect' && target !== AFG_COLLECT_CLI && !isInside(target, afgRoot) && !isInside(target, looperRoot) && !isInside(target, shadowRoot)) {
          throw new Error('AFG collector graph reaches unauthorized local module: ' + target);
        }
        queue.push(target);
      } else if ((mode === 'shadow' || mode === 'evidence' || mode === 'looper-build' || mode === 'looper-collect' || mode === 'afg-offline' || mode === 'afg-collect') && !BUILTINS.has(specifier) && !(mode === 'afg-offline' && specifier === 'ethers')) {
        throw new Error('restricted CLI imports unauthorized package: ' + specifier);
      }
    }
  }
  return visited;
}

function assertNoForbiddenShadowCapability(file) {
  const { ast } = parseJavaScript(file);
  walk.simple(ast, {
    Literal(node) {
      if (typeof node.value === 'string' && PRODUCTION_DATABASE_FILENAMES.has(node.value)) {
        throw new Error(file + ':' + node.loc.start.line + ' names a production database');
      }
    },
    MemberExpression(node) {
      if (node.object.type === 'Identifier' && node.object.name === 'process' && !node.computed && node.property.name === 'env') {
        throw new Error(file + ':' + node.loc.start.line + ' reads environment secrets');
      }
    },
    NewExpression(node) {
      const name = node.callee.type === 'Identifier' ? node.callee.name : null;
      if (new Set(['Wallet', 'Contract', 'JsonRpcProvider', 'WebSocketProvider']).has(name)) {
        throw new Error(file + ':' + node.loc.start.line + ' constructs an onchain signer/provider');
      }
    },
    CallExpression(node) {
      const direct = node.callee.type === 'Identifier' ? node.callee.name : null;
      const member = node.callee.type === 'MemberExpression' && !node.callee.computed && node.callee.property.type === 'Identifier'
        ? node.callee.property.name : null;
      if (new Set(['fetch', 'setInterval', 'setTimeout', 'eval', 'Function']).has(direct)) {
        throw new Error(file + ':' + node.loc.start.line + ' uses forbidden network/scheduler/dynamic execution capability ' + direct);
      }
      if (new Set(['listen', 'sendTransaction', 'broadcastTransaction', 'writeContract', 'schedule']).has(member)) {
        throw new Error(file + ':' + node.loc.start.line + ' uses forbidden listener/writer/scheduler capability ' + member);
      }
    },
  });
  const { specifiers } = moduleSpecifiers(file);
  const forbiddenModules = new Set([
    'http', 'https', 'net', 'tls', 'dgram', 'child_process',
    'node:http', 'node:https', 'node:net', 'node:tls', 'node:dgram', 'node:child_process',
    'ethers', 'web3', 'axios', 'undici', 'node-cron',
  ]);
  for (const specifier of specifiers) {
    if (forbiddenModules.has(specifier)) throw new Error(file + ' imports forbidden capability ' + specifier);
  }
}

test('production runtime graph cannot reach offline CRED evidence, observers, or shadow scoring', () => {
  for (const root of REQUIRED_PRODUCTION_ROOTS) assert.equal(fs.existsSync(root), true, 'missing required production root ' + root);
  const roots = listJavaScript(API_ROOT);
  for (const root of REQUIRED_PRODUCTION_ROOTS) assert.equal(roots.includes(root), true, 'required root omitted ' + root);
  const graph = buildGraph(roots, { mode: 'production', dynamicAllowlist: DYNAMIC_LOADER_ALLOWLIST });
  for (const file of graph) {
    assert.equal(isInside(file, SHADOW_ROOT), false, file + ' must stay outside shadow modules');
    assert.equal(isInside(file, EVIDENCE_ROOT), false, file + ' must stay outside evidence compiler modules');
    assert.equal(isInside(file, LOOPER_ROOT), false, file + ' must stay outside Looper corpus modules');
    assert.equal(isInside(file, AFG_ROOT), false, file + ' must stay outside AFG observation modules');
    assert.equal(isInside(file, PAYMENTS_ROOT), false, file + ' must stay outside payment observer modules');
  }
});

test('shadow replay graph is offline, secret-free, and restricted to built-ins plus cred-shadow', () => {
  const graph = buildGraph([SHADOW_CLI], { mode: 'shadow' });
  assert.equal(graph.has(fs.realpathSync(SHADOW_CLI)), true);
  for (const file of graph) assertNoForbiddenShadowCapability(file);
});

test('evidence compiler graph is offline, secret-free, and restricted to evidence plus shadow modules', () => {
  const graph = buildGraph([EVIDENCE_CLI], { mode: 'evidence' });
  assert.equal(graph.has(fs.realpathSync(EVIDENCE_CLI)), true);
  for (const file of graph) {
    assert.equal(file === fs.realpathSync(EVIDENCE_CLI) || isInside(file, EVIDENCE_ROOT) || isInside(file, SHADOW_ROOT), true, file + ' is outside the offline compiler graph');
    assertNoForbiddenShadowCapability(file);
    if (file !== fs.realpathSync(EVIDENCE_CLI)) {
      const { specifiers } = moduleSpecifiers(file);
      assert.equal(specifiers.some((specifier) => specifier === 'fs' || specifier === 'node:fs' || specifier === 'fs/promises' || specifier === 'node:fs/promises'), false, file + ' must not access the filesystem outside the CLI');
    }
  }
});

test('Looper corpus builder graph is offline and restricted to Looper, evidence, and shadow modules', () => {
  const graph = buildGraph([LOOPER_BUILD_CLI], { mode: 'looper-build' });
  for (const file of graph) assertNoForbiddenShadowCapability(file);
});

test('Looper network collector stays isolated from the evidence compiler', () => {
  const graph = buildGraph([LOOPER_COLLECT_CLI], { mode: 'looper-collect' });
  for (const file of graph) assert.equal(isInside(file, EVIDENCE_ROOT), false, file + ' collector must not reach the evidence compiler');
});

test('AFG reporter and verifier CLIs are offline and cannot reach the network collector', () => {
  const graph = buildGraph([AFG_BUILD_CLI, AFG_VERIFY_CLI], { mode: 'afg-offline' });
  for (const file of graph) {
    assert.equal(file === fs.realpathSync(path.join(AFG_ROOT, 'collector.js')), false, 'offline AFG graph must not reach collector');
    if (file !== fs.realpathSync(path.join(AFG_ROOT, 'verifier.js'))) assertNoForbiddenShadowCapability(file);
    else {
      const { source, specifiers } = moduleSpecifiers(file);
      assert.equal(specifiers.includes('ethers'), true);
      assert.equal(source.includes('fetch('), false);
      assert.equal(source.includes('process.env'), false);
    }
  }
});

test('AFG collector is isolated from the CRED compiler and pinned to the free AFG host', () => {
  const graph = buildGraph([AFG_COLLECT_CLI], { mode: 'afg-collect' });
  for (const file of graph) {
    assert.equal(isInside(file, EVIDENCE_ROOT), false);
    assert.equal(file === fs.realpathSync(path.join(AFG_ROOT, 'verifier.js')), false);
  }
  const source = fs.readFileSync(path.join(AFG_ROOT, 'collector.js'), 'utf8');
  assert.match(source, /https:\/\/agenticfinancegraph\.com/);
  assert.equal(source.includes('/check/'), false);
});

test('indirect production imports into a shadow directory are rejected', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cred-isolation-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const shadow = path.join(root, 'cred-shadow');
  fs.mkdirSync(shadow);
  fs.writeFileSync(path.join(root, 'entry.js'), "require('./middle');\n");
  fs.writeFileSync(path.join(root, 'middle.js'), "require('./cred-shadow/score');\n");
  fs.writeFileSync(path.join(shadow, 'score.js'), "module.exports = 1;\n");
  assert.throws(
    () => buildGraph([path.join(root, 'entry.js')], { graphRoot: root, shadowRoot: shadow, mode: 'production' }),
    /production graph reaches offline CRED module/,
  );
});
