import {
  concatHex,
  encodeAbiParameters,
  getAddress,
} from 'viem';

import { deriveReleasedLooperAccount as deriveReleasedLooperAccountUnchecked } from './looper-account.js';
import { LOOPERS_MAINNET_CHAIN_ID, LOOPERS_MAINNET_CONTRACT } from './loopers-owned-agents.js';

const ERC6551_REGISTRY = getAddress('0x000000006551c19487814612e58FE06813775758');
const ACCOUNT_SALT = '0xff28549509272e76f1d1c6ef7d6976d848c5ff6cb5068b2183c8d52f4cbe2bee';
const RELEASED_ACCOUNT_IMPLEMENTATION = getAddress('0xf192f350427c8F58bC28e78b1e6Af164279F486e');
const RUNTIME_PREFIX = '0x363d3d373d3d3d363d73';
const RUNTIME_SUFFIX = '0x5af43d82803e903d91602b57fd5bf3';
const COLLECTION = getAddress(LOOPERS_MAINNET_CONTRACT);
const MAX_LOOPER_TOKEN_ID = 7_777n;
const MAX_FINALIZED_HEAD_SKEW_BLOCKS = 256n;
const MAX_FINALIZED_AGE_MS = 30 * 60_000;
const MAX_FINALIZED_FUTURE_SKEW_MS = 5 * 60_000;

const COLLECTION_ABI = Object.freeze([
  {
    type: 'function',
    name: 'ownerOf',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: 'owner', type: 'address' }],
  },
  {
    type: 'function',
    name: 'tokenBoundAccount',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: 'account', type: 'address' }],
  },
]);

const ACCOUNT_ABI = Object.freeze([
  {
    type: 'function',
    name: 'token',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'chainId', type: 'uint256' },
      { name: 'tokenContract', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: 'owner', type: 'address' }],
  },
]);

export class LooperCanonicalWalletError extends Error {
  constructor(code, message, status = 503) {
    super(message);
    this.name = 'LooperCanonicalWalletError';
    this.code = code;
    this.status = status;
  }
}

export function deriveReleasedLooperAccount(tokenId) {
  return getAddress(deriveReleasedLooperAccountUnchecked(normalizeTokenId(tokenId)));
}

export function buildReleasedLooperAccountRuntime(tokenId) {
  const normalizedTokenId = normalizeTokenId(tokenId);
  const footer = encodeAbiParameters(
    [
      { name: 'salt', type: 'bytes32' },
      { name: 'chainId', type: 'uint256' },
      { name: 'tokenContract', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
    ],
    [ACCOUNT_SALT, BigInt(LOOPERS_MAINNET_CHAIN_ID), COLLECTION, normalizedTokenId],
  );
  return concatHex([
    RUNTIME_PREFIX,
    RELEASED_ACCOUNT_IMPLEMENTATION,
    RUNTIME_SUFFIX,
    footer,
  ]).toLowerCase();
}

export function createCanonicalLooperWalletResolver({
  publicClients = [],
  now = () => new Date().toISOString(),
  clock = () => Date.now(),
  timeoutMs = 5_000,
  cacheTtlMs = 30_000,
  maxConcurrent = 8,
} = {}) {
  const clients = publicClients.filter(Boolean);
  if (clients.length < 2) {
    throw new TypeError('Canonical Looper wallet resolution requires at least two Base providers.');
  }
  if (clients.some((client) => (
    typeof client.getBytecode !== 'function'
    || typeof client.readContract !== 'function'
    || typeof client.getChainId !== 'function'
    || typeof client.getBlock !== 'function'
  ))) {
    throw new TypeError('Canonical Looper wallet providers are invalid.');
  }
  const providerIdentities = clients.map(providerIdentity);
  if (new Set(providerIdentities).size !== clients.length) {
    throw new TypeError('Canonical Looper wallet providers must be distinct.');
  }
  const deadlineMs = Number.isInteger(timeoutMs) && timeoutMs > 0 ? timeoutMs : 5_000;
  const successTtlMs = Number.isInteger(cacheTtlMs) && cacheTtlMs > 0 ? cacheTtlMs : 30_000;
  const concurrencyLimit = Number.isInteger(maxConcurrent) && maxConcurrent > 0 ? maxConcurrent : 8;
  const cache = new Map();
  const inFlight = new Map();
  let active = 0;

  return async function resolveCanonicalLooperWallet({ tokenId } = {}) {
    const normalizedTokenId = normalizeTokenId(tokenId);
    const tokenIdText = normalizedTokenId.toString();
    const observedTime = Number(clock());
    const currentTime = Number.isFinite(observedTime) ? observedTime : Date.now();
    const cached = cache.get(tokenIdText);
    if (cached && currentTime < cached.expiresAt) return cached.value;
    if (cached) cache.delete(tokenIdText);
    if (inFlight.has(tokenIdText)) return inFlight.get(tokenIdText);
    if (active >= concurrencyLimit) {
      throw new LooperCanonicalWalletError(
        'resolver_busy',
        'Canonical Looper wallet verification is busy. Try again shortly.',
        503,
      );
    }

    active += 1;
    const pending = resolveFreshCanonicalLooperWallet({
      clients,
      normalizedTokenId,
      tokenIdText,
      now,
      timeoutMs: deadlineMs,
      currentTime,
    });
    inFlight.set(tokenIdText, pending);
    try {
      const value = await pending;
      cache.set(tokenIdText, { value, expiresAt: currentTime + successTtlMs });
      while (cache.size > 512) cache.delete(cache.keys().next().value);
      return value;
    } finally {
      inFlight.delete(tokenIdText);
      active -= 1;
    }
  };
}

async function resolveFreshCanonicalLooperWallet({ clients, normalizedTokenId, tokenIdText, now, timeoutMs, currentTime }) {
  const anchorHeads = await settleProviderReads(clients.map((client) => withTimeout(
    Promise.all([
      client.getChainId(),
      client.getBlock({ blockTag: 'finalized', includeTransactions: false }),
    ]).then(([chainId, block]) => ({ client, chainId, block })),
    timeoutMs,
  )));
  if (anchorHeads.some(({ chainId }) => Number(chainId) !== LOOPERS_MAINNET_CHAIN_ID)) {
    throw new LooperCanonicalWalletError(
      'provider_disagreement',
      'Base providers disagreed about the Looper wallet. No destination was returned.',
    );
  }
  const normalizedHeads = anchorHeads.map(({ block }) => normalizeBlock(block));
  const finalizedNumbers = normalizedHeads.map(({ number }) => number);
  const oldestHead = finalizedNumbers.reduce((minimum, value) => value < minimum ? value : minimum);
  const newestHead = finalizedNumbers.reduce((maximum, value) => value > maximum ? value : maximum);
  if (newestHead - oldestHead > MAX_FINALIZED_HEAD_SKEW_BLOCKS || normalizedHeads.some(({ timestampMs }) => (
    currentTime - timestampMs > MAX_FINALIZED_AGE_MS
    || timestampMs - currentTime > MAX_FINALIZED_FUTURE_SKEW_MS
  ))) {
    throw new LooperCanonicalWalletError(
      'provider_disagreement',
      'Base providers disagreed about the Looper wallet. No destination was returned.',
    );
  }
  const anchorNumber = oldestHead;
  const anchorBlocks = await settleProviderReads(anchorHeads.map(({ client }) => withTimeout(
    client.getBlock({ blockNumber: anchorNumber, includeTransactions: false })
      .then((block) => ({ client, block })),
    timeoutMs,
  )));
  const normalizedAnchors = anchorBlocks.map(({ block }) => normalizeBlock(block));
  const anchorHash = normalizedAnchors[0].hash;
  if (normalizedAnchors.some((block) => block.number !== anchorNumber || block.hash !== anchorHash)) {
    throw new LooperCanonicalWalletError(
      'provider_disagreement',
      'Base providers disagreed about the Looper wallet. No destination was returned.',
    );
  }

  const canonicalAccount = deriveReleasedLooperAccount(normalizedTokenId);
  const expectedRuntime = buildReleasedLooperAccountRuntime(normalizedTokenId);
  const observations = await settleProviderReads(anchorBlocks.map(({ client }) => withTimeout(
    readObservation(client, {
      tokenId: normalizedTokenId,
      canonicalAccount,
      blockNumber: anchorNumber,
    }),
    timeoutMs,
  )));
  const first = canonicalObservation(observations[0]);
  if (observations.some((observation) => canonicalObservation(observation) !== first)) {
    throw new LooperCanonicalWalletError(
      'provider_disagreement',
      'Base providers disagreed about the Looper wallet. No destination was returned.',
    );
  }

  const observation = observations[0];
  if (observation.code === '0x') {
    throw new LooperCanonicalWalletError(
      'wallet_not_activated',
      'Looper does not have a verified activated wallet.',
      404,
    );
  }
  if (observation.code !== expectedRuntime) {
    throw new LooperCanonicalWalletError(
      'runtime_mismatch',
      'The activated Looper wallet runtime did not match the released wallet.',
      409,
    );
  }
  if (
    observation.accountToken.chainId !== LOOPERS_MAINNET_CHAIN_ID
    || observation.accountToken.collection !== COLLECTION
    || observation.accountToken.tokenId !== tokenIdText
  ) {
    throw new LooperCanonicalWalletError(
      'binding_mismatch',
      'The activated Looper wallet binding did not match the requested Looper.',
      409,
    );
  }
  if (observation.accountOwner !== observation.owner) {
    throw new LooperCanonicalWalletError(
      'ownership_mismatch',
      'The activated Looper wallet owner did not match the current NFT owner.',
      409,
    );
  }

  const contractMatchesCanonical = observation.contractAccount === canonicalAccount;
  return deepFreeze({
    schema_version: '0.1.0',
    chain_id: LOOPERS_MAINNET_CHAIN_ID,
    block_number: anchorNumber.toString(),
    block_hash: anchorHash,
    collection: COLLECTION,
    token_id: tokenIdText,
    status: 'activated',
    canonical_wallet: {
      address: canonicalAccount,
      deployed: true,
      binding_verified: true,
      owner: observation.owner,
      source: 'multipass_released_account',
    },
    contract_reference: {
      address: observation.contractAccount,
      matches_canonical: contractMatchesCanonical,
      safe_for_transfers: contractMatchesCanonical,
    },
    transfer_policy: {
      recipient: canonicalAccount,
      require_exact_recipient: true,
      token_id_lookup_safe: contractMatchesCanonical,
    },
    verified_at: normalizeTimestamp(now()),
  });
}

async function readObservation(client, { tokenId, canonicalAccount, blockNumber }) {
  const [owner, contractAccount, code] = await Promise.all([
    client.readContract({
      address: COLLECTION,
      abi: COLLECTION_ABI,
      functionName: 'ownerOf',
      args: [tokenId],
      blockNumber,
    }),
    client.readContract({
      address: COLLECTION,
      abi: COLLECTION_ABI,
      functionName: 'tokenBoundAccount',
      args: [tokenId],
      blockNumber,
    }),
    client.getBytecode({ address: canonicalAccount, blockNumber }),
  ]);

  const normalizedCode = normalizeCode(code);
  if (normalizedCode === '0x') {
    return {
      owner: getAddress(owner),
      contractAccount: getAddress(contractAccount),
      code: normalizedCode,
      accountToken: null,
      accountOwner: null,
    };
  }

  const [accountToken, accountOwner] = await Promise.all([
    client.readContract({
      address: canonicalAccount,
      abi: ACCOUNT_ABI,
      functionName: 'token',
      blockNumber,
    }),
    client.readContract({
      address: canonicalAccount,
      abi: ACCOUNT_ABI,
      functionName: 'owner',
      blockNumber,
    }),
  ]);
  if (!Array.isArray(accountToken) || accountToken.length !== 3) throw new TypeError('Looper wallet token binding is malformed.');

  return {
    owner: getAddress(owner),
    contractAccount: getAddress(contractAccount),
    code: normalizedCode,
    accountToken: {
      chainId: Number(accountToken[0]),
      collection: getAddress(accountToken[1]),
      tokenId: BigInt(accountToken[2]).toString(),
    },
    accountOwner: getAddress(accountOwner),
  };
}

async function settleProviderReads(promises) {
  const settled = await Promise.allSettled(promises);
  const fulfilled = settled.filter((entry) => entry.status === 'fulfilled').map((entry) => entry.value);
  if (fulfilled.length < 2) {
    throw new LooperCanonicalWalletError(
      'provider_unavailable',
      'Canonical Looper wallet verification is temporarily unavailable.',
    );
  }
  return fulfilled;
}

function providerIdentity(client) {
  const candidate = String(client.transport?.url ?? '').trim();
  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw new TypeError('Canonical Looper wallet providers require reviewed HTTPS endpoints.');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new TypeError('Canonical Looper wallet providers require reviewed HTTPS endpoints.');
  }
  return url.origin.toLowerCase();
}

function normalizeBlock(block) {
  let number;
  let timestampSeconds;
  try {
    number = typeof block?.number === 'bigint' ? block.number : BigInt(block?.number ?? -1);
    timestampSeconds = typeof block?.timestamp === 'bigint' ? block.timestamp : BigInt(block?.timestamp ?? -1);
  } catch {
    throw new TypeError('Canonical Looper wallet block evidence is malformed.');
  }
  const hash = String(block?.hash ?? '').toLowerCase();
  const timestampMs = Number(timestampSeconds * 1_000n);
  if (number < 0n || !/^0x[0-9a-f]{64}$/u.test(hash) || !Number.isSafeInteger(timestampMs) || timestampMs < 0) {
    throw new TypeError('Canonical Looper wallet block evidence is malformed.');
  }
  return { number, hash, timestampMs };
}

async function withTimeout(promise, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Canonical Looper wallet provider timed out.')), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function normalizeCode(value) {
  const code = String(value ?? '').toLowerCase();
  if (!/^0x(?:[0-9a-f]{2})*$/u.test(code)) throw new TypeError('Looper wallet runtime is malformed.');
  return code;
}

function canonicalObservation(value) {
  return JSON.stringify(value);
}

function normalizeTimestamp(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError('Canonical Looper wallet timestamp is invalid.');
  return date.toISOString();
}

function normalizeTokenId(value) {
  const text = typeof value === 'bigint' ? value.toString() : String(value ?? '');
  if (!/^[1-9]\d*$/u.test(text)) throw new TypeError('Looper token ID must be a canonical positive integer.');
  const tokenId = BigInt(text);
  if (tokenId > MAX_LOOPER_TOKEN_ID) throw new TypeError('Looper token ID is outside the collection range.');
  return tokenId;
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

export const LOOPERS_CANONICAL_WALLET_RELEASE = Object.freeze({
  chainId: LOOPERS_MAINNET_CHAIN_ID,
  collection: COLLECTION,
  registry: ERC6551_REGISTRY,
  implementation: RELEASED_ACCOUNT_IMPLEMENTATION,
  salt: ACCOUNT_SALT,
});
