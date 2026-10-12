import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeFunctionResult, encodeFunctionData } from 'viem';

import { deriveLooperAccount, RELEASED_ACCOUNT_IMPLEMENTATION } from '../src/looper-agent-wallet.js';
import { buildLooperMarketplacePreviewRoutes } from './build-looper-marketplace-previews.mjs';

const CHAIN_ID = 8453;
const LOOPERS_CONTRACT = '0x1649CD37f4748807b4882FC48765bA0B2aFfa94a';
const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11';
const MAX_LOOPER_TOKEN_ID = 7_777;
const DEFAULT_MINIMUM_COUNT = 328;
const PROVIDERS = ['https://base-rpc.publicnode.com', 'https://base.drpc.org'];
const OWNER_ABI = [{ type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] }];
const AGGREGATE3_ABI = [{
  type: 'function', name: 'aggregate3', stateMutability: 'payable',
  inputs: [{ name: 'calls', type: 'tuple[]', components: [{ name: 'target', type: 'address' }, { name: 'allowFailure', type: 'bool' }, { name: 'callData', type: 'bytes' }] }],
  outputs: [{ name: 'returnData', type: 'tuple[]', components: [{ name: 'success', type: 'bool' }, { name: 'returnData', type: 'bytes' }] }],
}];

export async function buildVerifiedDailyRoster({ fetchImpl = globalThis.fetch, providers = PROVIDERS, minimumCount = DEFAULT_MINIMUM_COUNT } = {}) {
  if (typeof fetchImpl !== 'function' || !Array.isArray(providers) || providers.length < 2) throw new Error('Two RPC providers are required.');
  const scans = [];
  for (const provider of providers) scans.push(await scanProvider(provider, fetchImpl));
  return reconcileProviderScans(scans, { minimumCount });
}

export async function writeVerifiedDailyRoster({ output, routeSourcePath = null, routeOutputRoot = null, ...options } = {}) {
  const document = await buildVerifiedDailyRoster(options);
  return publishVerifiedDailyRoster({ output, document, routeSourcePath, routeOutputRoot });
}

export async function publishVerifiedDailyRoster({ output, document, routeSourcePath = null, routeOutputRoot = null } = {}) {
  if (!output) throw new Error('Output path is required.');
  if (Boolean(routeSourcePath) !== Boolean(routeOutputRoot)) throw new Error('Route source and output must be configured together.');
  assertPublishedRoster(document, 'Generated roster');
  const target = resolve(output);
  const previous = await readPrevious(target);
  if (previous) assertMonotonicPublication(previous, document);
  await mkdir(dirname(target), { recursive: true });
  const temporary = target + '.tmp.' + process.pid;
  try {
    await writeFile(temporary, JSON.stringify(document, null, 2) + '\n', { mode: 0o644 });
    const routes = routeSourcePath
      ? await buildLooperMarketplacePreviewRoutes({ sourcePath: routeSourcePath, rosterFile: temporary, outputRoot: routeOutputRoot })
      : null;
    await rename(temporary, target);
    return { ...document, routeCount: routes?.count ?? null };
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
}

export function reconcileProviderScans(scans, { minimumCount = DEFAULT_MINIMUM_COUNT } = {}) {
  if (!Array.isArray(scans) || scans.length < 2) throw new Error('Two RPC provider scans are required.');
  const canonical = scans[0]?.tokenIds;
  if (!Array.isArray(canonical)) throw new Error('RPC provider scan is malformed.');
  for (const scan of scans) {
    if (!Number.isSafeInteger(scan?.observedBlock) || !/^0x[0-9a-f]{64}$/u.test(String(scan?.blockHash ?? '').toLowerCase())
      || typeof scan?.observedAt !== 'string' || Number.isNaN(Date.parse(scan.observedAt)) || !Array.isArray(scan.tokenIds)) throw new Error('RPC provider scan is malformed.');
    if (scan.tokenIds.length !== canonical.length || scan.tokenIds.some((tokenId, index) => tokenId !== canonical[index])) throw new Error('RPC providers disagree on the activated roster.');
  }
  if (canonical.length < minimumCount) throw new Error('Activated roster regressed below the minimum count.');
  const earliest = scans.reduce((current, scan) => scan.observedBlock < current.observedBlock ? scan : current);
  return {
    schema_version: '1.0.0', chain_id: CHAIN_ID, contract: LOOPERS_CONTRACT, implementation: RELEASED_ACCOUNT_IMPLEMENTATION,
    observed_block: earliest.observedBlock, observed_at: earliest.observedAt, count: canonical.length, token_ids: [...canonical],
  };
}

export function assertMonotonicPublication(previous, document) {
  assertPublishedRoster(previous, 'Existing roster');
  assertPublishedRoster(document, 'Generated roster');
  if (document.observed_block < previous.observed_block) throw new Error('Activated roster block regressed.');
  if (document.count < previous.count) throw new Error('Activated roster count regressed.');
  const current = new Set(document.token_ids);
  if (previous.token_ids.some((tokenId) => !current.has(tokenId))) throw new Error('Activated roster lost a previously verified token.');
}

function assertPublishedRoster(value, label) {
  const expectedKeys = ['chain_id', 'contract', 'count', 'implementation', 'observed_at', 'observed_block', 'schema_version', 'token_ids'];
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join('\0') !== expectedKeys.join('\0')
    || value.schema_version !== '1.0.0' || value.chain_id !== CHAIN_ID || value.contract !== LOOPERS_CONTRACT
    || value.implementation !== RELEASED_ACCOUNT_IMPLEMENTATION || !Number.isSafeInteger(value.observed_block) || value.observed_block < 1
    || typeof value.observed_at !== 'string' || Number.isNaN(Date.parse(value.observed_at)) || new Date(value.observed_at).toISOString() !== value.observed_at
    || !Number.isSafeInteger(value.count) || value.count < 1 || value.count > MAX_LOOPER_TOKEN_ID
    || !Array.isArray(value.token_ids) || value.count !== value.token_ids.length) throw new Error(label + ' is malformed.');
  let prior = 0n;
  for (const tokenId of value.token_ids) {
    if (typeof tokenId !== 'string' || !/^[1-9][0-9]*$/u.test(tokenId)) throw new Error(label + ' is malformed.');
    const parsed = BigInt(tokenId);
    if (parsed <= prior || parsed > BigInt(MAX_LOOPER_TOKEN_ID)) throw new Error(label + ' is malformed.');
    prior = parsed;
  }
}

async function scanProvider(provider, fetchImpl) {
  const head = await rpc(fetchImpl, provider, 'eth_getBlockByNumber', ['latest', false]);
  if (!head?.number || !head?.timestamp) throw new Error('Latest Base block is unavailable.');
  if (!/^0x[0-9a-f]{64}$/u.test(String(head.hash ?? '').toLowerCase())) throw new Error('Latest Base block hash is unavailable.');
  const blockTag = head.number;
  const blockHash = String(head.hash).toLowerCase();
  const ownerCall = encodeFunctionData({ abi: OWNER_ABI, functionName: 'owner' });
  const entries = [];
  for (let tokenId = 1; tokenId <= MAX_LOOPER_TOKEN_ID; tokenId += 1) {
    entries.push({ tokenId: String(tokenId), address: deriveLooperAccount({ implementation: RELEASED_ACCOUNT_IMPLEMENTATION, tokenId: String(tokenId) }) });
  }
  const tokenIds = [];
  for (let offset = 0; offset < entries.length; offset += 400) {
    const chunk = entries.slice(offset, offset + 400);
    const data = encodeFunctionData({
      abi: AGGREGATE3_ABI,
      functionName: 'aggregate3',
      args: [chunk.map((entry) => ({ target: entry.address, allowFailure: true, callData: ownerCall }))],
    });
    const raw = await rpc(fetchImpl, provider, 'eth_call', [{ to: MULTICALL3, data }, blockTag]);
    const results = decodeFunctionResult({ abi: AGGREGATE3_ABI, functionName: 'aggregate3', data: raw });
    if (!Array.isArray(results) || results.length !== chunk.length) throw new Error('Multicall response length mismatch.');
    results.forEach((result, index) => {
      if (result.success && result.returnData.length === 66) tokenIds.push(chunk[index].tokenId);
    });
  }
  const confirmedHead = await rpc(fetchImpl, provider, 'eth_getBlockByNumber', [blockTag, false]);
  if (String(confirmedHead?.hash ?? '').toLowerCase() !== blockHash) throw new Error('Pinned Base block changed during the scan.');
  return {
    provider,
    blockHash,
    observedBlock: Number(BigInt(head.number)),
    observedAt: new Date(Number(BigInt(head.timestamp)) * 1000).toISOString(),
    tokenIds,
  };
}

async function rpc(fetchImpl, provider, method, params) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const response = await fetchImpl(provider, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: attempt + 1, method, params }),
        signal: AbortSignal.timeout(20_000),
      });
      const text = await response.text();
      const value = JSON.parse(text);
      if (response.ok && !value.error && Object.hasOwn(value, 'result')) return value.result;
      const message = String(value?.error?.message ?? 'RPC request failed');
      if (!/rate|limit|capacity|throughput|timeout|temporar/iu.test(message)) throw new Error(message);
    } catch (error) {
      if (attempt === 5) throw error;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500 * (attempt + 1)));
  }
  throw new Error('RPC retries exhausted.');
}

async function readPrevious(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

function parseCli(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--output') options.output = argv[++index];
    else if (argv[index] === '--minimum-count') options.minimumCount = Number(argv[++index]);
    else if (argv[index] === '--route-source') options.routeSourcePath = argv[++index];
    else if (argv[index] === '--route-output') options.routeOutputRoot = argv[++index];
    else throw new Error('Unknown argument: ' + argv[index]);
  }
  if (!options.output) throw new Error('--output is required.');
  if (options.minimumCount !== undefined && (!Number.isSafeInteger(options.minimumCount) || options.minimumCount < DEFAULT_MINIMUM_COUNT)) throw new Error('--minimum-count must be an integer of at least 328.');
  if (Boolean(options.routeSourcePath) !== Boolean(options.routeOutputRoot)) throw new Error('--route-source and --route-output must be configured together.');
  return options;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseCli(process.argv.slice(2));
    const document = await writeVerifiedDailyRoster(options);
    process.stdout.write(JSON.stringify({ status: 'updated', output: resolve(options.output), count: document.count, routeCount: document.routeCount, observedBlock: document.observed_block, observedAt: document.observed_at }) + '\n');
  } catch (error) {
    process.stderr.write('Daily Looper roster refresh failed: ' + String(error?.message ?? error) + '\n');
    process.exitCode = 1;
  }
}
