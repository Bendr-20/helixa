#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { Interface, getAddress, keccak256 } from 'ethers';

export const MISSION_BASE_SEPOLIA_RPC_ORIGINS = Object.freeze([
  'https://sepolia.base.org',
  'https://base-sepolia-rpc.publicnode.com',
]);

const CHAIN_ID = 84_532;
const MAX_HEAD_DRIFT = 1n;
const MAX_RESPONSE_BYTES = 1_048_576;
const REQUEST_TIMEOUT_MS = 10_000;
const ALLOWED_METHODS = new Set(['eth_chainId', 'eth_blockNumber', 'eth_getBlockByNumber', 'eth_getCode', 'eth_getStorageAt', 'eth_call']);
const MANIFEST_PATH = new URL('../deployments/swarm-command-base-sepolia.json', import.meta.url);
const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const MANIFEST = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));

const SAFE_ABI = [
  'function getOwners() view returns (address[])',
  'function getThreshold() view returns (uint256)',
  'function nonce() view returns (uint256)',
  'function VERSION() view returns (string)',
];
const TOKEN_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function issuer() view returns (address)',
  'function totalSupply() view returns (uint256)',
];
const REGISTRY_ABI = [
  'function governance() view returns (address)',
  'function emergencyCouncil() view returns (address)',
  'function minimumDelay() view returns (uint64)',
];
const FACTORY_ABI = [
  'function registry() view returns (address)',
  'function FACTORY_COMPATIBILITY() view returns (uint32)',
];
const interfaces = Object.freeze({
  safe: new Interface(SAFE_ABI),
  token: new Interface(TOKEN_ABI),
  registry: new Interface(REGISTRY_ABI),
  factory: new Interface(FACTORY_ABI),
});

export const SWARM_COMMAND_BASE_SEPOLIA_DEPLOYMENT = deepFreeze(validateMissionBaseSepoliaDeployment(MANIFEST));

export function validateMissionBaseSepoliaDeployment(input) {
  requireExactKeys(input, ['schemaVersion', 'product', 'network', 'chainId', 'status', 'missionCreationEnabled', 'governanceActionsBroadcast', 'noMintOrMissionFunding', 'completedAt', 'packet', 'deployer', 'authority', 'tokens', 'registry', 'factory', 'transactions'], 'deployment manifest');
  if (input.schemaVersion !== 1 || input.product !== 'swarm-command' || input.network !== 'base-sepolia' || input.chainId !== CHAIN_ID) throw new Error('Deployment identity is invalid.');
  if (input.status !== 'infrastructure_deployed_governance_pending' || input.missionCreationEnabled !== false || input.governanceActionsBroadcast !== false || input.noMintOrMissionFunding !== true) throw new Error('Deployment safety state is invalid.');
  if (input.completedAt !== '2026-10-17T16:13:31.772Z') throw new Error('Deployment completion timestamp is invalid.');
  requireExactKeys(input.packet, ['commit', 'sha256'], 'deployment packet');
  if (input.packet.commit !== 'dff99ebd7ec727eff603bec0d771582009ab2c69' || input.packet.sha256 !== 'afeb2ff90b899b45aeba9bc94468e312b02ae09e1a498851d76348c1da823d18') throw new Error('Deployment packet commitment is invalid.');
  canonicalAddress(input.deployer, 'deployer');

  requireExactKeys(input.authority, ['kind', 'address', 'singleton', 'proxyFactory', 'owners', 'threshold', 'version', 'nonce', 'runtimeCodeHash'], 'authority');
  if (input.authority.kind !== 'safe-2-of-2' || input.authority.threshold !== 2 || input.authority.version !== '1.4.1' || input.authority.nonce !== 0) throw new Error('Safe authority commitment is invalid.');
  canonicalAddress(input.authority.address, 'Safe address');
  canonicalAddress(input.authority.singleton, 'Safe singleton');
  canonicalAddress(input.authority.proxyFactory, 'Safe proxy factory');
  requireDenseArray(input.authority.owners, 2, 'Safe owners');
  input.authority.owners.forEach((value, index) => canonicalAddress(value, 'Safe owner ' + index));
  if (new Set(input.authority.owners.map((value) => value.toLowerCase())).size !== 2 || !input.authority.owners.some((value) => sameAddress(value, input.deployer))) throw new Error('Safe owner commitment is invalid.');
  canonicalHash(input.authority.runtimeCodeHash, 'Safe runtime hash');

  requireDenseArray(input.tokens, 2, 'test tokens');
  const symbols = ['mUSDC', 'mCRED'];
  for (let index = 0; index < input.tokens.length; index += 1) {
    const token = input.tokens[index];
    requireExactKeys(token, ['kind', 'address', 'name', 'symbol', 'decimals', 'issuer', 'totalSupply', 'runtimeCodeHash'], 'test token');
    if (token.kind !== 'isolated-testnet-mock' || token.symbol !== symbols[index] || token.totalSupply !== '0') throw new Error('Test-token safety commitment is invalid.');
    if (!Number.isSafeInteger(token.decimals) || token.decimals < 0 || token.decimals > 36 || typeof token.name !== 'string' || token.name.length === 0) throw new Error('Test-token metadata is invalid.');
    canonicalAddress(token.address, token.symbol + ' address');
    if (!sameAddress(token.issuer, input.deployer)) throw new Error(token.symbol + ' issuer is invalid.');
    canonicalHash(token.runtimeCodeHash, token.symbol + ' runtime hash');
  }

  requireExactKeys(input.registry, ['address', 'governance', 'emergencyCouncil', 'minimumDelaySeconds', 'runtimeCodeHash'], 'registry');
  canonicalAddress(input.registry.address, 'registry address');
  if (!sameAddress(input.registry.governance, input.authority.address) || sameAddress(input.registry.emergencyCouncil, input.authority.address) || input.registry.minimumDelaySeconds !== 86_400) throw new Error('Registry authority commitment is invalid.');
  canonicalAddress(input.registry.emergencyCouncil, 'registry emergency council');
  canonicalHash(input.registry.runtimeCodeHash, 'registry runtime hash');

  requireExactKeys(input.factory, ['address', 'registry', 'compatibility', 'runtimeCodeHash'], 'factory');
  canonicalAddress(input.factory.address, 'factory address');
  if (!sameAddress(input.factory.registry, input.registry.address) || input.factory.compatibility !== 1) throw new Error('Factory commitment is invalid.');
  canonicalHash(input.factory.runtimeCodeHash, 'factory runtime hash');

  requireDenseArray(input.transactions, 5, 'deployment transactions');
  const operations = ['safe.deploy-proxy-2-of-2', 'token.deploy.mUSDC', 'token.deploy.mCRED', 'registry.deploy', 'factory.deploy'];
  const addresses = [input.authority.address, input.tokens[0].address, input.tokens[1].address, input.registry.address, input.factory.address];
  const codeBytes = [171, 1965, 1965, 5227, 13173];
  for (let index = 0; index < input.transactions.length; index += 1) {
    const tx = input.transactions[index];
    requireExactKeys(tx, ['nonce', 'operation', 'hash', 'blockNumber', 'blockHash', 'gasUsed', 'expectedAddress', 'codeBytes', 'status'], 'deployment transaction');
    if (tx.nonce !== 38 + index || tx.operation !== operations[index] || tx.blockNumber !== 48_242_657 + index || tx.codeBytes !== codeBytes[index] || tx.status !== 'confirmed' || !sameAddress(tx.expectedAddress, addresses[index])) throw new Error('Deployment transaction sequence is invalid.');
    canonicalHash(tx.hash, 'deployment transaction hash');
    canonicalHash(tx.blockHash, 'deployment block hash');
    canonicalDecimal(tx.gasUsed, 'deployment gas used');
  }
  if (new Set(input.transactions.map((entry) => entry.hash)).size !== 5) throw new Error('Deployment transaction hashes are not unique.');
  return clone(input);
}

export async function verifyMissionBaseSepoliaDeployment({ fetchImpl = globalThis.fetch, now = () => Date.now(), deployment = SWARM_COMMAND_BASE_SEPOLIA_DEPLOYMENT } = {}) {
  if (typeof fetchImpl !== 'function' || typeof now !== 'function') throw new TypeError('Verifier dependencies are invalid.');
  const expected = validateMissionBaseSepoliaDeployment(deployment);
  let requestId = 1;
  const rpc = async (origin, method, params) => {
    if (!MISSION_BASE_SEPOLIA_RPC_ORIGINS.includes(origin) || !ALLOWED_METHODS.has(method)) throw new Error('Unapproved read-only RPC request.');
    const id = requestId++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('Base Sepolia RPC timed out.')), REQUEST_TIMEOUT_MS);
    try {
      const endpoint = origin + '/';
      const response = await fetchImpl(endpoint, {
        method: 'POST', redirect: 'error', credentials: 'omit', signal: controller.signal,
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
      });
      if (!response?.ok || response.redirected === true || (response.url && response.url !== endpoint)) throw new Error('Base Sepolia RPC failed or redirected.');
      const contentType = response.headers?.get?.('content-type');
      if (typeof contentType !== 'string' || !/^application\/json(?:\s*;|$)/iu.test(contentType)) throw new Error('Base Sepolia RPC content type is invalid.');
      const declared = response.headers?.get?.('content-length');
      if (declared !== null && declared !== undefined && (!/^(0|[1-9]\d*)$/u.test(declared) || Number(declared) > MAX_RESPONSE_BYTES)) throw new Error('Base Sepolia RPC response exceeds the byte bound.');
      const text = await boundedResponseText(response, declared);
      const body = parseStrictJson(text);
      validateJsonBounds(body);
      requireExactKeys(body, ['jsonrpc', 'id', 'result'], 'RPC response');
      if (body.jsonrpc !== '2.0' || body.id !== id) throw new Error('Base Sepolia RPC response binding failed.');
      return body.result;
    } finally {
      clearTimeout(timer);
    }
  };
  const dual = async (method, params, normalize, label) => {
    const values = await Promise.all(MISSION_BASE_SEPOLIA_RPC_ORIGINS.map((origin) => rpc(origin, method, params).then(normalize)));
    if (stableJson(values[0]) !== stableJson(values[1])) throw new Error(label + ' providers disagree.');
    return values[0];
  };

  const chainId = await dual('eth_chainId', [], (value) => rpcQuantity(value, 'chain ID'), 'Chain ID');
  if (chainId !== CHAIN_ID.toString()) throw new Error('Wrong Base Sepolia chain ID.');
  const heads = await Promise.all(MISSION_BASE_SEPOLIA_RPC_ORIGINS.map((origin) => rpc(origin, 'eth_blockNumber', []).then((value) => BigInt(rpcQuantity(value, 'head block')))));
  const high = heads[0] > heads[1] ? heads[0] : heads[1];
  const low = heads[0] < heads[1] ? heads[0] : heads[1];
  if (high - low > MAX_HEAD_DRIFT) throw new Error('Base Sepolia RPC heads disagree by more than one block.');
  const blockTag = toQuantity(low);
  const anchor = await dual('eth_getBlockByNumber', [blockTag, false], normalizeBlock, 'Anchor block');

  const runtimeTargets = [
    ['Safe', expected.authority], ['mUSDC', expected.tokens[0]], ['mCRED', expected.tokens[1]], ['registry', expected.registry], ['factory', expected.factory],
  ];
  const runtime = {};
  for (const [label, target] of runtimeTargets) {
    const code = await dual('eth_getCode', [target.address, blockTag], (value) => canonicalBytes(value, label + ' runtime'), label + ' runtime');
    const hash = keccak256(code);
    if (hash !== target.runtimeCodeHash) throw new Error(label + ' runtime hash drifted.');
    runtime[label] = { address: target.address, byteLength: (code.length - 2) / 2, runtimeCodeHash: hash };
  }

  const read = async (address, iface, functionName) => {
    const data = iface.encodeFunctionData(functionName);
    const raw = await dual('eth_call', [{ to: address, data }, blockTag], (value) => canonicalBytes(value, functionName + ' result', true), functionName);
    try { return iface.decodeFunctionResult(functionName, raw); } catch { throw new Error(functionName + ' result is malformed.'); }
  };

  const [ownersResult, thresholdResult, nonceResult, versionResult, singletonWord] = await Promise.all([
    read(expected.authority.address, interfaces.safe, 'getOwners'),
    read(expected.authority.address, interfaces.safe, 'getThreshold'),
    read(expected.authority.address, interfaces.safe, 'nonce'),
    read(expected.authority.address, interfaces.safe, 'VERSION'),
    dual('eth_getStorageAt', [expected.authority.address, '0x0', blockTag], (value) => canonicalWord(value, 'Safe singleton slot'), 'Safe singleton slot'),
  ]);
  const owners = [...ownersResult[0]].map((value) => getAddress(value));
  const threshold = thresholdResult[0].toString();
  const nonce = nonceResult[0].toString();
  const version = versionResult[0];
  const singleton = getAddress('0x' + singletonWord.slice(-40));
  if (stableJson(owners) !== stableJson(expected.authority.owners) || threshold !== String(expected.authority.threshold) || nonce !== String(expected.authority.nonce) || version !== expected.authority.version || singleton !== expected.authority.singleton) throw new Error('Safe owners, threshold, nonce, version, or singleton drifted; governance state is no longer pending.');

  const tokens = [];
  for (const token of expected.tokens) {
    const [name, symbol, decimals, issuer, totalSupply] = await Promise.all([
      read(token.address, interfaces.token, 'name'), read(token.address, interfaces.token, 'symbol'), read(token.address, interfaces.token, 'decimals'),
      read(token.address, interfaces.token, 'issuer'), read(token.address, interfaces.token, 'totalSupply'),
    ]);
    const observed = { address: token.address, name: name[0], symbol: symbol[0], decimals: Number(decimals[0]), issuer: getAddress(issuer[0]), totalSupply: totalSupply[0].toString() };
    if (observed.name !== token.name || observed.symbol !== token.symbol || observed.decimals !== token.decimals || observed.issuer !== token.issuer || observed.totalSupply !== '0') throw new Error(token.symbol + ' metadata, issuer, or supply/mint state drifted.');
    tokens.push(observed);
  }

  const [governance, emergencyCouncil, minimumDelay, factoryRegistry, compatibility] = await Promise.all([
    read(expected.registry.address, interfaces.registry, 'governance'), read(expected.registry.address, interfaces.registry, 'emergencyCouncil'), read(expected.registry.address, interfaces.registry, 'minimumDelay'),
    read(expected.factory.address, interfaces.factory, 'registry'), read(expected.factory.address, interfaces.factory, 'FACTORY_COMPATIBILITY'),
  ]);
  if (getAddress(governance[0]) !== expected.registry.governance || getAddress(emergencyCouncil[0]) !== expected.registry.emergencyCouncil || minimumDelay[0].toString() !== String(expected.registry.minimumDelaySeconds)) throw new Error('Registry authority configuration drifted.');
  if (getAddress(factoryRegistry[0]) !== expected.factory.registry || compatibility[0].toString() !== String(expected.factory.compatibility)) throw new Error('Factory configuration drifted.');

  const closingAnchor = await dual('eth_getBlockByNumber', [blockTag, false], normalizeBlock, 'Closing anchor block');
  if (stableJson(anchor) !== stableJson(closingAnchor)) throw new Error('Base Sepolia anchor reorged during verification.');

  return deepFreeze({
    schemaVersion: 1,
    status: 'verified_governance_pending',
    network: expected.network,
    chainId: expected.chainId,
    observedAtMs: safeTimestamp(now()),
    rpcConsensus: true,
    anchor,
    packet: clone(expected.packet),
    missionCreationEnabled: false,
    governanceActionsBroadcast: false,
    runtime,
    safe: { address: expected.authority.address, singleton, owners, threshold, nonce, version },
    tokens,
    registry: { address: expected.registry.address, governance: getAddress(governance[0]), emergencyCouncil: getAddress(emergencyCouncil[0]), minimumDelaySeconds: Number(minimumDelay[0]) },
    factory: { address: expected.factory.address, registry: getAddress(factoryRegistry[0]), compatibility: Number(compatibility[0]) },
  });
}

async function boundedResponseText(response, declared) {
  if (response.body?.getReader) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let bytes = 0;
    let text = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) throw new Error('Base Sepolia RPC response exceeds the byte bound.');
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  }
  if (declared === null || declared === undefined) throw new Error('Base Sepolia RPC response is not safely bounded.');
  const text = await response.text();
  if (new TextEncoder().encode(text).length > MAX_RESPONSE_BYTES) throw new Error('Base Sepolia RPC response exceeds the byte bound.');
  return text;
}

function parseStrictJson(text) {
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('Base Sepolia RPC returned invalid JSON.'); }
  let index = 0;
  const skip = () => { while (/\s/u.test(text[index] ?? '')) index += 1; };
  const scanString = () => {
    const start = index++;
    while (index < text.length) {
      if (text[index] === '\\') { index += 2; continue; }
      if (text[index] === '"') { index += 1; return JSON.parse(text.slice(start, index)); }
      index += 1;
    }
    throw new Error('Base Sepolia RPC returned invalid JSON.');
  };
  const scan = () => {
    skip();
    if (text[index] === '{') {
      index += 1; skip();
      const keys = new Set();
      if (text[index] === '}') { index += 1; return; }
      while (index < text.length) {
        if (text[index] !== '"') throw new Error('Base Sepolia RPC returned invalid JSON.');
        const key = scanString();
        if (keys.has(key)) throw new Error('Base Sepolia RPC response contains duplicate JSON member ' + key + '.');
        keys.add(key); skip();
        if (text[index++] !== ':') throw new Error('Base Sepolia RPC returned invalid JSON.');
        scan(); skip();
        if (text[index] === '}') { index += 1; return; }
        if (text[index++] !== ',') throw new Error('Base Sepolia RPC returned invalid JSON.');
        skip();
      }
    } else if (text[index] === '[') {
      index += 1; skip();
      if (text[index] === ']') { index += 1; return; }
      while (index < text.length) {
        scan(); skip();
        if (text[index] === ']') { index += 1; return; }
        if (text[index++] !== ',') throw new Error('Base Sepolia RPC returned invalid JSON.');
      }
    } else if (text[index] === '"') scanString();
    else while (index < text.length && !/[\s,\]}]/u.test(text[index])) index += 1;
  };
  scan(); skip();
  if (index !== text.length) throw new Error('Base Sepolia RPC returned invalid JSON.');
  return parsed;
}

function validateJsonBounds(value) {
  let nodes = 0;
  const visit = (item, depth) => {
    if (++nodes > 5_000 || depth > 24) throw new Error('Base Sepolia RPC JSON exceeds structural bounds.');
    if (item && typeof item === 'object') {
      if (Object.getPrototypeOf(item) !== (Array.isArray(item) ? Array.prototype : Object.prototype)) throw new Error('Base Sepolia RPC JSON contains a non-plain value.');
      for (const child of Object.values(item)) visit(child, depth + 1);
    }
  };
  visit(value, 0);
}

function normalizeBlock(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype || Object.keys(value).length > 64) throw new TypeError('block must be a bounded plain object.');
  return { number: rpcQuantity(value.number, 'block number'), hash: canonicalHash(value.hash, 'block hash') };
}

function canonicalAddress(value, label) {
  if (typeof value !== 'string') throw new TypeError(label + ' must be an address.');
  let normalized;
  try { normalized = getAddress(value); } catch { throw new Error(label + ' must be an address.'); }
  if (normalized !== value) throw new Error(label + ' must use canonical checksum casing.');
  return normalized;
}

function sameAddress(left, right) {
  try { return getAddress(left) === getAddress(right); } catch { return false; }
}

function canonicalHash(value, label) {
  if (typeof value !== 'string' || !/^0x[0-9a-f]{64}$/u.test(value)) throw new Error(label + ' must be a canonical hash.');
  return value;
}

function canonicalWord(value, label) {
  if (typeof value !== 'string' || !/^0x[0-9a-f]{64}$/u.test(value)) throw new Error(label + ' must be one canonical word.');
  return value;
}

function canonicalBytes(value, label, allowEmpty = false) {
  if (typeof value !== 'string' || !/^0x(?:[0-9a-f]{2})*$/u.test(value) || (!allowEmpty && value === '0x')) throw new Error(label + ' must be canonical bytes.');
  return value;
}

function canonicalDecimal(value, label) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)$/u.test(value)) throw new Error(label + ' must be a canonical decimal string.');
  return value;
}

function rpcQuantity(value, label) {
  if (typeof value !== 'string' || !/^0x(?:0|[1-9a-f][0-9a-f]*)$/u.test(value)) throw new Error(label + ' must be a canonical RPC quantity.');
  return BigInt(value).toString();
}

function toQuantity(value) { return '0x' + value.toString(16); }

function safeTimestamp(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Observed timestamp is invalid.');
  return value;
}

function requireDenseArray(value, length, label) {
  if (!Array.isArray(value) || value.length !== length || Object.keys(value).length !== length) throw new TypeError(label + ' must contain exactly ' + length + ' entries.');
}

function requireExactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new TypeError(label + ' must be a plain object.');
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (stableJson(actual) !== stableJson(expected)) throw new Error(label + ' has unknown or missing keys.');
}

function stableJson(value) {
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stableJson(value[key])).join(',') + '}';
  return JSON.stringify(value);
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function deepFreeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(deepFreeze); } return value; }

async function runCli() {
  const args = process.argv.slice(2);
  let output = null;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--') continue;
    if (args[index] === '--output') output = args[++index];
    else throw new Error('Unknown argument: ' + args[index]);
  }
  const verified = await verifyMissionBaseSepoliaDeployment();
  const text = JSON.stringify(verified, null, 2) + '\n';
  if (output) {
    const target = isAbsolute(output) ? output : resolve(REPOSITORY_ROOT, output);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, text, { mode: 0o600 });
  } else process.stdout.write(text);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runCli().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
