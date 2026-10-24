import { getAddress, keccak256 } from 'viem';

import {
  RESTAP_NETWORK_ACCOUNT_RELEASE,
  deriveReleasedAccount,
} from './account-integrity.js';

const ZERO_ADDRESS = getAddress('0x0000000000000000000000000000000000000000');
const ZERO_HASH = '0x' + '00'.repeat(32);
const MAX_RANGE = 2_000;
const MAX_RPC_LOG_RANGE = 10;
const MAX_RPC_LOG_CONCURRENCY = 8;
const MAX_PILOT_TOKENS = 32;

const LOOPERS_ABI = Object.freeze([
  { type: 'function', name: 'ownerOf', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: 'owner', type: 'address' }] },
  { type: 'function', name: 'erc8004AgentIdByLooper', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: 'agentId', type: 'uint256' }] },
]);
const TRANSFER_EVENT = Object.freeze({
  type: 'event', name: 'Transfer',
  inputs: [
    { indexed: true, name: 'from', type: 'address' },
    { indexed: true, name: 'to', type: 'address' },
    { indexed: true, name: 'tokenId', type: 'uint256' },
  ],
});
const ERC6551_REGISTRY_ABI = Object.freeze([{
  type: 'function', name: 'account', stateMutability: 'view',
  inputs: [
    { name: 'implementation', type: 'address' },
    { name: 'salt', type: 'bytes32' },
    { name: 'chainId', type: 'uint256' },
    { name: 'tokenContract', type: 'address' },
    { name: 'tokenId', type: 'uint256' },
  ],
  outputs: [{ name: 'account', type: 'address' }],
}]);
const ACCOUNT_ABI = Object.freeze([
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ name: 'owner', type: 'address' }] },
  { type: 'function', name: 'token', stateMutability: 'view', inputs: [], outputs: [{ name: 'chainId', type: 'uint256' }, { name: 'tokenContract', type: 'address' }, { name: 'tokenId', type: 'uint256' }] },
  ...['moduleRegistry', 'policyModule', 'policyModuleOwner'].map((name) => ({ type: 'function', name, stateMutability: 'view', inputs: [], outputs: [{ name, type: 'address' }] })),
  { type: 'function', name: 'policyEpoch', stateMutability: 'view', inputs: [], outputs: [{ name: 'policyEpoch', type: 'uint256' }] },
]);
const MODULE_REGISTRY_ABI = Object.freeze([
  { type: 'function', name: 'globallyPaused', stateMutability: 'view', inputs: [], outputs: [{ name: 'globallyPaused', type: 'bool' }] },
  { type: 'function', name: 'approvedModuleCodehash', stateMutability: 'view', inputs: [{ name: 'module', type: 'address' }], outputs: [{ name: 'codehash', type: 'bytes32' }] },
]);

// Reviewed against the exact-match Base deployment at
// 0x270d25D2c59A8bcA1B0f40ad95fF7806c0025c27 and implementation
// 0x0f81bd4EDD4879734361A1A44460264CBf6F94c9. For an ERC-721 binding,
// isController(agentId, account) is exactly ownerOf(boundTokenId) == account.
const CONTROLLER_ABI = Object.freeze([
  { type: 'function', name: 'bindingOf', stateMutability: 'view', inputs: [{ name: 'agentId', type: 'uint256' }], outputs: [{ name: 'binding', type: 'tuple', components: [{ name: 'standard', type: 'uint8' }, { name: 'tokenContract', type: 'address' }, { name: 'tokenId', type: 'uint256' }] }] },
  { type: 'function', name: 'isController', stateMutability: 'view', inputs: [{ name: 'agentId', type: 'uint256' }, { name: 'account', type: 'address' }], outputs: [{ name: 'controlled', type: 'bool' }] },
]);

export function createRestapNetworkBaseProvider({
  publicClient,
  tokenIds = [],
  allowAnyCollectionToken = false,
  release = RESTAP_NETWORK_ACCOUNT_RELEASE,
  maxRange = MAX_RANGE,
  rpcMinIntervalMs = 0,
} = {}) {
  assertClient(publicClient);
  if (!Number.isSafeInteger(rpcMinIntervalMs) || rpcMinIntervalMs < 0 || rpcMinIntervalMs > 1_000) throw new TypeError('RESTAP Base RPC interval is invalid.');
  publicClient = createRetriedClient(publicClient, rpcMinIntervalMs);
  if (!release || release.controllerModel !== 'erc721_owner') throw new TypeError('RESTAP Base controller model is unsupported.');
  if (!Number.isSafeInteger(maxRange) || maxRange < 1 || maxRange > MAX_RANGE) throw new TypeError('RESTAP Base range limit is invalid.');
  if (typeof allowAnyCollectionToken !== 'boolean') throw new TypeError('RESTAP Base collection-token policy is invalid.');
  if (!Array.isArray(tokenIds) || tokenIds.length > MAX_PILOT_TOKENS || (!allowAnyCollectionToken && tokenIds.length === 0)) throw new TypeError('RESTAP Base pilot allowlist is invalid.');
  const normalizedTokenIds = tokenIds.map(normalizeTokenId);
  if (new Set(normalizedTokenIds).size !== normalizedTokenIds.length) throw new TypeError('RESTAP Base pilot allowlist has duplicates.');
  const allowed = new Set(normalizedTokenIds);
  const chainId = Number(release.chainId);
  const collection = getAddress(release.collection);

  async function readFinalizedHead() {
    await assertChain(publicClient, chainId);
    return publicBlock(await readAnchor(publicClient, { blockTag: 'finalized' }));
  }

  async function readAccountIntegrity(request = {}) {
    const keys = Object.keys(request).sort().join(',');
    if (!['tokenId', 'safeBlockNumber,tokenId'].includes(keys)) throw new TypeError('RESTAP Base account request fields are invalid.');
    const tokenId = requireAllowed(request.tokenId);
    await assertChain(publicClient, chainId);
    const safeAnchor = request.safeBlockNumber === undefined
      ? await readAnchor(publicClient, { blockTag: 'finalized' })
      : await readAnchor(publicClient, { blockNumber: BigInt(normalizeBlockNumber(request.safeBlockNumber)) });
    const safe = await guarded(publicClient, safeAnchor, async () => readIntegrityAt({ publicClient, release, collection, tokenId, anchor: safeAnchor }));
    const latestAnchor = await readAnchor(publicClient, { blockTag: 'latest' });
    const latest = await guarded(publicClient, latestAnchor, () => readAuthorityAt({ publicClient, release, collection, tokenId, anchor: latestAnchor }));
    return deepFreeze({ ...safe, safeBlock: publicBlock(safeAnchor), latest: { owner: latest.owner, controller: latest.controller } });
  }

  async function readCustody(request = {}) {
    exactKeys(request, ['chainId', 'collection', 'tokenId', 'fromBlock', 'toBlock', 'previousSafeBlock'], 'RESTAP Base custody request');
    assertCoordinates(request, { chainId, collection });
    const tokenId = requireAllowed(request.tokenId);
    const fromBlock = normalizeBlockNumber(request.fromBlock);
    const requestedTo = request.toBlock === null ? null : normalizeBlockNumber(request.toBlock);
    await assertChain(publicClient, chainId);
    const safeHead = await readAnchor(publicClient, { blockTag: 'finalized' });
    const toBlock = requestedTo ?? (fromBlock === 0
      ? safeHead.number
      : Math.min(safeHead.number, fromBlock + maxRange - 1));
    const noNewFinalizedBlock = request.previousSafeBlock !== null
      && toBlock < fromBlock && toBlock === normalizeBlockNumber(request.previousSafeBlock?.number);
    if (toBlock > safeHead.number || (toBlock < fromBlock && !noNewFinalizedBlock)) throw new TypeError('RESTAP Base custody range is unresolved.');
    if (fromBlock !== 0 && toBlock - fromBlock + 1 > maxRange) throw new TypeError('RESTAP Base custody range exceeds the bound.');
    const anchor = toBlock === safeHead.number ? safeHead : await readAnchor(publicClient, { blockNumber: BigInt(toBlock) });
    const priorSafeHash = await verifyPreviousSafeBlock(publicClient, request.previousSafeBlock);
    const safeAuthority = await guarded(publicClient, anchor, () => readAuthorityAt({ publicClient, release, collection, tokenId, anchor }));
    const events = fromBlock === 0 || noNewFinalizedBlock ? [] : await guarded(publicClient, anchor, () => readTransfers({ publicClient, collection, tokenId, fromBlock, toBlock }));
    const latestAnchor = await readAnchor(publicClient, { blockTag: 'latest' });
    const latestAuthority = await guarded(publicClient, latestAnchor, () => readAuthorityAt({ publicClient, release, collection, tokenId, anchor: latestAnchor }));
    return deepFreeze({
      safeBlock: publicBlock(anchor),
      safeOwner: safeAuthority.owner,
      safeController: safeAuthority.controller,
      safeErc8004AgentId: safeAuthority.erc8004AgentId,
      latestOwner: latestAuthority.owner,
      latestController: latestAuthority.controller,
      latestErc8004AgentId: latestAuthority.erc8004AgentId,
      canonicalAccount: deriveReleasedAccount({ tokenId, release }),
      range: { fromBlock, toBlock },
      events,
      priorSafeHash,
    });
  }

  async function listAffectedTokens(request = {}) {
    exactKeys(request, ['chainId', 'collection', 'fromBlock', 'toBlock'], 'RESTAP Base affected-token request');
    assertCoordinates(request, { chainId, collection });
    const fromBlock = normalizeBlockNumber(request.fromBlock);
    const toBlock = normalizeBlockNumber(request.toBlock);
    if (toBlock < fromBlock || toBlock - fromBlock + 1 > maxRange) throw new TypeError('RESTAP Base affected-token range is invalid.');
    await assertChain(publicClient, chainId);
    const finalizedHead = await readAnchor(publicClient, { blockTag: 'finalized' });
    if (toBlock > finalizedHead.number) throw new TypeError('RESTAP Base affected-token range is not finalized.');
    const anchor = toBlock === finalizedHead.number ? finalizedHead : await readAnchor(publicClient, { blockNumber: BigInt(toBlock) });
    const affected = await guarded(publicClient, anchor, async () => {
      const result = [];
      if (allowAnyCollectionToken) {
        const logs = await readLogsInChunks(publicClient, { address: collection, event: TRANSFER_EVENT, fromBlock, toBlock, strict: true });
        if (logs.length > MAX_RANGE) throw new Error('RESTAP Base Transfer evidence is malformed or excessive.');
        for (const log of logs) {
          const tokenId = normalizeTokenId(log?.args?.tokenId);
          normalizeTransfer(log, { collection, tokenId, fromBlock, toBlock });
          result.push(tokenId);
        }
      } else {
        for (const tokenId of normalizedTokenIds) {
          const events = await readTransfers({ publicClient, collection, tokenId, fromBlock, toBlock });
          if (events.length) result.push(tokenId);
        }
      }
      return [...new Set(result)].sort((left, right) => BigInt(left) < BigInt(right) ? -1 : BigInt(left) > BigInt(right) ? 1 : 0);
    });
    return Object.freeze(affected);
  }

  function requireAllowed(value) {
    const tokenId = normalizeTokenId(value);
    if (!allowAnyCollectionToken && !allowed.has(tokenId)) throw new TypeError('RESTAP Base token is outside the pilot allowlist.');
    return tokenId;
  }

  return Object.freeze({ readFinalizedHead, readAccountIntegrity, readCustody, listAffectedTokens, maxRange });
}

async function readIntegrityAt({ publicClient, release, collection, tokenId, anchor }) {
  const blockNumber = BigInt(anchor.number);
  const account = deriveReleasedAccount({ tokenId, release });
  const authority = await readAuthorityAt({ publicClient, release, collection, tokenId, anchor });
  const registryAccount = getAddress(await readContract(publicClient, {
    address: release.registry, abi: ERC6551_REGISTRY_ABI, functionName: 'account',
    args: [release.implementation, release.salt, BigInt(release.chainId), collection, BigInt(tokenId)], blockNumber,
  }));
  const [accountCode, implementationCode, moduleRegistryCode] = await Promise.all([
    readCode(publicClient, account, blockNumber, true),
    readCode(publicClient, release.implementation, blockNumber),
    readCode(publicClient, release.moduleRegistry, blockNumber),
  ]);

  let accountOwner = authority.owner;
  let accountToken = { chainId: release.chainId, collection, tokenId };
  let moduleRegistry = getAddress(release.moduleRegistry);
  let registryPaused = release.policy.registryPaused;
  let policyModule = getAddress(release.policy.module);
  let policyModuleOwner = getAddress(release.policy.moduleOwner);
  let policyEpoch = String(release.policy.epoch);
  let policyModuleCode = '0x';
  let policyModuleCodehash = ZERO_HASH;
  let approvedModuleCodehash = ZERO_HASH;

  if (accountCode !== '0x') {
    const rawToken = await readContract(publicClient, { address: account, abi: ACCOUNT_ABI, functionName: 'token', blockNumber });
    const [rawOwner, rawRegistry, rawModule, rawModuleOwner, rawEpoch] = await Promise.all([
      readContract(publicClient, { address: account, abi: ACCOUNT_ABI, functionName: 'owner', blockNumber }),
      readContract(publicClient, { address: account, abi: ACCOUNT_ABI, functionName: 'moduleRegistry', blockNumber }),
      readContract(publicClient, { address: account, abi: ACCOUNT_ABI, functionName: 'policyModule', blockNumber }),
      readContract(publicClient, { address: account, abi: ACCOUNT_ABI, functionName: 'policyModuleOwner', blockNumber }),
      readContract(publicClient, { address: account, abi: ACCOUNT_ABI, functionName: 'policyEpoch', blockNumber }),
    ]);
    accountOwner = getAddress(rawOwner);
    accountToken = normalizeAccountToken(rawToken);
    moduleRegistry = getAddress(rawRegistry);
    policyModule = getAddress(rawModule);
    policyModuleOwner = getAddress(rawModuleOwner);
    policyEpoch = normalizeUint(rawEpoch);
    registryPaused = await readContract(publicClient, { address: moduleRegistry, abi: MODULE_REGISTRY_ABI, functionName: 'globallyPaused', blockNumber });
    if (typeof registryPaused !== 'boolean') throw new Error('RESTAP Base registry pause read is malformed.');
    if (policyModule !== ZERO_ADDRESS) {
      policyModuleCode = await readCode(publicClient, policyModule, blockNumber, true);
      policyModuleCodehash = policyModuleCode === '0x' ? ZERO_HASH : keccak256(policyModuleCode);
      approvedModuleCodehash = normalizeHash(await readContract(publicClient, { address: moduleRegistry, abi: MODULE_REGISTRY_ABI, functionName: 'approvedModuleCodehash', args: [policyModule], blockNumber }));
    }
  }

  return {
    account,
    registryAccount,
    collectionAccount: account,
    collectionRegistry: getAddress(release.registry),
    collectionImplementation: getAddress(release.implementation),
    collectionSalt: normalizeHash(release.salt),
    accountCode,
    implementationCode,
    accountToken,
    owner: authority.owner,
    erc8004AgentId: authority.erc8004AgentId,
    accountOwner,
    controller: authority.controller,
    moduleRegistry,
    moduleRegistryCode,
    registryPaused,
    policyModule,
    policyModuleOwner,
    policyEpoch,
    policyModuleCode,
    policyModuleCodehash,
    approvedModuleCodehash,
  };
}

async function readAuthorityAt({ publicClient, release, collection, tokenId, anchor }) {
  const blockNumber = BigInt(anchor.number);
  const owner = getAddress(await readContract(publicClient, { address: collection, abi: LOOPERS_ABI, functionName: 'ownerOf', args: [BigInt(tokenId)], blockNumber }));
  const agentId = BigInt(await readContract(publicClient, { address: collection, abi: LOOPERS_ABI, functionName: 'erc8004AgentIdByLooper', args: [BigInt(tokenId)], blockNumber }));
  if (agentId <= 0n) throw new Error('RESTAP Base controller identity is unavailable.');
  const binding = normalizeBinding(await readContract(publicClient, { address: release.controllerSource, abi: CONTROLLER_ABI, functionName: 'bindingOf', args: [agentId], blockNumber }));
  if (binding.standard !== 0 || binding.tokenContract !== collection || binding.tokenId !== tokenId) throw new Error('RESTAP Base controller binding is mismatched.');
  const controlled = await readContract(publicClient, { address: release.controllerSource, abi: CONTROLLER_ABI, functionName: 'isController', args: [agentId, owner], blockNumber });
  if (controlled !== true) throw new Error('RESTAP Base controller proof failed.');
  return { owner, controller: owner, erc8004AgentId: agentId.toString() };
}

async function readTransfers({ publicClient, collection, tokenId, fromBlock, toBlock }) {
  const logs = await readLogsInChunks(publicClient, {
    address: collection,
    event: TRANSFER_EVENT,
    args: { tokenId: BigInt(tokenId) },
    fromBlock,
    toBlock,
    strict: true,
  });
  if (logs.length > MAX_RANGE) throw new Error('RESTAP Base Transfer evidence is malformed or excessive.');
  return logs.map((log) => normalizeTransfer(log, { collection, tokenId, fromBlock, toBlock })).sort(compareEvents);
}

async function readLogsInChunks(publicClient, { fromBlock, toBlock, ...request }) {
  const ranges = [];
  for (let start = fromBlock; start <= toBlock; start += MAX_RPC_LOG_RANGE) {
    ranges.push([start, Math.min(toBlock, start + MAX_RPC_LOG_RANGE - 1)]);
  }
  const logs = [];
  for (let offset = 0; offset < ranges.length; offset += MAX_RPC_LOG_CONCURRENCY) {
    const chunks = await Promise.all(ranges.slice(offset, offset + MAX_RPC_LOG_CONCURRENCY).map(([start, end]) =>
      publicClient.getLogs({ ...request, fromBlock: BigInt(start), toBlock: BigInt(end) })));
    for (const chunk of chunks) {
      if (!Array.isArray(chunk)) throw new Error('RESTAP Base Transfer evidence is malformed or excessive.');
      logs.push(...chunk);
      if (logs.length > MAX_RANGE) throw new Error('RESTAP Base Transfer evidence is malformed or excessive.');
    }
  }
  return logs;
}

function normalizeTransfer(log, { collection, tokenId, fromBlock, toBlock }) {
  try {
    const blockNumber = normalizeBlockNumber(log.blockNumber);
    if (log.removed !== false || getAddress(log.address) !== collection || normalizeTokenId(log.args?.tokenId) !== tokenId || blockNumber < fromBlock || blockNumber > toBlock) throw new TypeError('mismatch');
    return Object.freeze({
      kind: 'transfer',
      source: collection,
      tokenId,
      blockNumber,
      blockHash: normalizeHash(log.blockHash),
      transactionHash: normalizeHash(log.transactionHash),
      transactionIndex: normalizeBlockNumber(log.transactionIndex),
      logIndex: normalizeBlockNumber(log.logIndex),
      from: getAddress(log.args.from),
      to: getAddress(log.args.to),
    });
  } catch {
    throw new Error('RESTAP Base Transfer evidence is malformed or mismatched.');
  }
}

async function verifyPreviousSafeBlock(publicClient, value) {
  if (value === null) return null;
  exactKeys(value, ['number', 'hash'], 'RESTAP Base prior safe block');
  const number = normalizeBlockNumber(value.number);
  const expectedHash = normalizeHash(value.hash);
  const block = await readAnchor(publicClient, { blockNumber: BigInt(number) });
  if (block.hash !== expectedHash) throw new Error('RESTAP Base prior canonical hash drifted.');
  return block.hash;
}

async function guarded(publicClient, anchor, work) {
  await assertAnchor(publicClient, anchor);
  const result = await work();
  await assertAnchor(publicClient, anchor);
  return result;
}

async function assertAnchor(publicClient, anchor) {
  const current = await readAnchor(publicClient, { blockNumber: BigInt(anchor.number) });
  if (current.hash !== anchor.hash) throw new Error('RESTAP Base canonical anchor hash drifted.');
}

async function readAnchor(publicClient, request) {
  const block = await publicClient.getBlock(request);
  const number = normalizeBlockNumber(block?.number);
  const hash = normalizeHash(block?.hash);
  if (request.blockNumber !== undefined && number !== Number(request.blockNumber)) throw new Error('RESTAP Base canonical block number mismatched.');
  return Object.freeze({ number, hash });
}

async function assertChain(publicClient, expected) {
  const actual = Number(await publicClient.getChainId());
  if (actual !== expected) throw new Error('RESTAP Base chain mismatch.');
}

async function readContract(publicClient, request) {
  return publicClient.readContract({ ...request, address: getAddress(request.address) });
}

async function readCode(publicClient, address, blockNumber, allowEmpty = false) {
  const code = String(await publicClient.getBytecode({ address: getAddress(address), blockNumber }) ?? '0x').toLowerCase();
  if (!/^0x(?:[0-9a-f]{2})*$/u.test(code) || (!allowEmpty && code === '0x')) throw new Error('RESTAP Base runtime code is missing or malformed.');
  return code;
}

function createRetriedClient(client, minIntervalMs) {
  let queue = Promise.resolve();
  let lastStartedAt = 0;
  const schedule = (method, args) => {
    const run = queue.then(async () => {
      const remaining = minIntervalMs - (Date.now() - lastStartedAt);
      if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
      lastStartedAt = Date.now();
      return retryTransientRpc(() => client[method](...args));
    });
    queue = run.catch(() => {});
    return run;
  };
  return Object.freeze(Object.fromEntries(['getChainId', 'getBlock', 'readContract', 'getBytecode', 'getLogs'].map((method) => [method, (...args) => schedule(method, args)])));
}

async function retryTransientRpc(read) {
  const delays = [750, 1_500, 3_000];
  for (let attempt = 0; ; attempt += 1) {
    try { return await read(); } catch (error) {
      if (attempt >= delays.length || !isTransientRpcError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
    }
  }
}

function isTransientRpcError(error) {
  const messages = [];
  for (let current = error, depth = 0; current && depth < 6; current = current.cause, depth += 1) {
    if (typeof current.message === 'string') messages.push(current.message);
    if (typeof current.details === 'string') messages.push(current.details);
    if (typeof current.status === 'number') messages.push(String(current.status));
  }
  return /(?:rate.?limit|too many requests|timed? ?out|timeout|fetch failed|\b429\b|\b50[234]\b)/iu.test(messages.join(' | '));
}

function normalizeBinding(value) {
  const standard = Number(value?.standard ?? value?.[0]);
  const tokenContract = getAddress(value?.tokenContract ?? value?.[1]);
  const tokenId = normalizeTokenId(value?.tokenId ?? value?.[2]);
  if (!Number.isSafeInteger(standard) || standard < 0 || standard > 2) throw new TypeError('RESTAP Base controller binding is malformed.');
  return { standard, tokenContract, tokenId };
}

function normalizeAccountToken(value) {
  const chainId = Number(value?.chainId ?? value?.[0]);
  if (!Number.isSafeInteger(chainId) || chainId < 1) throw new TypeError('RESTAP Base account token chain is malformed.');
  return { chainId, collection: getAddress(value?.tokenContract ?? value?.[1]), tokenId: normalizeTokenId(value?.tokenId ?? value?.[2]) };
}

function assertCoordinates(request, expected) {
  if (Number(request.chainId) !== expected.chainId || getAddress(request.collection) !== expected.collection) throw new TypeError('RESTAP Base custody coordinates are invalid.');
}
function assertClient(value) {
  for (const method of ['getChainId', 'getBlock', 'readContract', 'getBytecode', 'getLogs']) if (typeof value?.[method] !== 'function') throw new TypeError('RESTAP Base public client is incomplete.');
}
function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new TypeError(label + ' is invalid.');
  const actual = Object.keys(value);
  if (actual.length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) throw new TypeError(label + ' fields are invalid.');
}
function normalizeTokenId(value) {
  const text = typeof value === 'bigint' ? value.toString() : String(value ?? '');
  if (!/^[1-9]\d*$/u.test(text) || BigInt(text) > ((1n << 256n) - 1n)) throw new TypeError('RESTAP Base token ID is invalid.');
  return text;
}
function normalizeBlockNumber(value) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new TypeError('RESTAP Base block coordinate is invalid.');
  return number;
}
function normalizeUint(value) {
  const text = typeof value === 'bigint' ? value.toString() : String(value ?? '');
  if (!/^(0|[1-9]\d*)$/u.test(text)) throw new TypeError('RESTAP Base uint is invalid.');
  return text;
}
function normalizeHash(value) {
  const hash = String(value ?? '').toLowerCase();
  if (!/^0x[0-9a-f]{64}$/u.test(hash)) throw new TypeError('RESTAP Base hash is invalid.');
  return hash;
}
function publicBlock(anchor) { return { number: anchor.number, hash: anchor.hash }; }
function compareEvents(left, right) { return left.blockNumber - right.blockNumber || left.transactionIndex - right.transactionIndex || left.logIndex - right.logIndex; }
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) deepFreeze(item);
  }
  return value;
}
