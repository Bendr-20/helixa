const HEX_32 = /^0x[0-9a-f]{64}$/u;
const ADDRESS = /^0x[0-9a-f]{40}$/u;
const EVENT_STATES = new Set(['observed', 'confirmed', 'finalized', 'orphaned']);

export class MissionChainReconcileError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = 'MissionChainReconcileError';
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

export function createMissionChainReconciler({
  providers,
  ledger,
  chainId,
  confirmationDepth = 12,
  expectedVaultCodeHash,
  supportedTokens = [],
  hashCode,
  now = Date.now,
} = {}) {
  if (!Array.isArray(providers) || providers.length !== 2 || providers.some((p) => !validProvider(p))) {
    throw new TypeError('Exactly two independent chain providers are required.');
  }
  if (!ledger || !['readCursor', 'findCommonAncestor', 'replaceCanonicalRange'].every((name) => typeof ledger[name] === 'function')) {
    throw new TypeError('Mission chain ledger port is invalid.');
  }
  const normalizedChainId = positiveInteger(chainId, 'chainId');
  const depth = nonNegativeInteger(confirmationDepth, 'confirmationDepth');
  const codeHash = hash32(expectedVaultCodeHash, 'expectedVaultCodeHash');
  const tokens = Object.freeze(supportedTokens.map((token) => address(token, 'supportedToken')).sort());
  if (new Set(tokens).size !== tokens.length) throw new TypeError('Supported token addresses must be unique.');
  if (typeof hashCode !== 'function' || typeof now !== 'function') throw new TypeError('Mission chain reconciler dependencies are invalid.');

  async function reconcile({ missionId, vaultAddress, fromBlock = 0, toBlock = null } = {}) {
    const mission = identifier(missionId, 'missionId');
    const vault = address(vaultAddress, 'vaultAddress');
    const firstRequested = nonNegativeInteger(fromBlock, 'fromBlock');
    const heads = await Promise.all(providers.map((provider) => provider.getBlockNumber()));
    const normalizedHeads = heads.map((value) => nonNegativeInteger(value, 'provider head'));
    const finalizedBlock = Math.min(...normalizedHeads) - depth;
    if (finalizedBlock < firstRequested) return frozen({ status: 'waiting_confirmations', finalizedBlock: Math.max(-1, finalizedBlock), events: [] });
    const requestedLast = toBlock === null ? finalizedBlock : Math.min(nonNegativeInteger(toBlock, 'toBlock'), finalizedBlock);

    const [codes, tokenPins] = await Promise.all([
      Promise.all(providers.map((provider) => provider.getCode(vault, requestedLast))),
      Promise.all(providers.map((provider) => provider.getSupportedTokens(vault, requestedLast))),
    ]);
    const observedCodeHashes = codes.map((value) => hash32(hashCode(hexBytes(value, 'vault code')), 'observed code hash'));
    if (observedCodeHashes.some((value) => value !== codeHash)) return blocked('codehash_mismatch', { observedCodeHashes });
    const normalizedTokenPins = tokenPins.map(normalizeTokenList);
    if (!sameJson(normalizedTokenPins[0], normalizedTokenPins[1]) || !sameJson(normalizedTokenPins[0], tokens)) {
      return blocked('token_pin_mismatch', { observed: normalizedTokenPins });
    }

    let cursor = await ledger.readCursor({ chainId: normalizedChainId, missionId: mission, vaultAddress: vault });
    let first = Math.max(firstRequested, cursor ? nonNegativeInteger(cursor.blockNumber, 'cursor.blockNumber') + 1 : firstRequested);
    let rollbackFrom = null;
    if (cursor) {
      const cursorHash = hash32(cursor.blockHash, 'cursor.blockHash');
      const agreed = await agreedBlock(cursor.blockNumber);
      if (!agreed || agreed.hash !== cursorHash) {
        const ancestor = await ledger.findCommonAncestor({
          chainId: normalizedChainId,
          missionId: mission,
          vaultAddress: vault,
          providers,
          beforeBlock: cursor.blockNumber,
        });
        const ancestorBlock = ancestor === null ? firstRequested - 1 : nonNegativeInteger(ancestor.blockNumber, 'ancestor.blockNumber');
        rollbackFrom = ancestorBlock + 1;
        first = Math.max(firstRequested, rollbackFrom);
        cursor = ancestor;
      }
    }
    if (requestedLast < first) return frozen({ status: 'up_to_date', finalizedBlock: requestedLast, events: [] });

    const [logsA, logsB] = await Promise.all(providers.map((provider) => provider.getLogs({
      address: vault,
      fromBlock: first,
      toBlock: requestedLast,
    })));
    const left = normalizeLogs(logsA, mission, vault, normalizedChainId);
    const right = normalizeLogs(logsB, mission, vault, normalizedChainId);
    if (!sameJson(left, right)) return blocked('provider_disagreement', { fromBlock: first, toBlock: requestedLast });

    const canonicalBlocks = new Map();
    for (const event of left) {
      if (!canonicalBlocks.has(event.blockNumber)) {
        const block = await agreedBlock(event.blockNumber);
        if (!block || block.hash !== event.blockHash) return blocked('provider_disagreement', { blockNumber: event.blockNumber });
        canonicalBlocks.set(event.blockNumber, block.hash);
      }
    }
    const terminalBlock = await agreedBlock(requestedLast);
    if (!terminalBlock) return blocked('provider_disagreement', { blockNumber: requestedLast });
    const timestamp = now();
    if (!Number.isSafeInteger(timestamp) || timestamp < 0) throw new TypeError('Clock returned an invalid timestamp.');
    const finalizedEvents = left.map((event) => frozen({ ...event, confirmationState: 'finalized', observedAt: timestamp }));
    await ledger.replaceCanonicalRange({
      chainId: normalizedChainId,
      missionId: mission,
      vaultAddress: vault,
      fromBlock: first,
      toBlock: requestedLast,
      rollbackFrom,
      events: finalizedEvents,
      cursor: frozen({ blockNumber: requestedLast, blockHash: terminalBlock.hash }),
    });
    return frozen({ status: 'finalized', finalizedBlock: requestedLast, rollbackFrom, events: finalizedEvents });
  }

  async function agreedBlock(blockNumber) {
    const blocks = await Promise.all(providers.map((provider) => provider.getBlock(blockNumber)));
    const normalized = blocks.map((block) => normalizeBlock(block, blockNumber));
    return normalized[0].hash === normalized[1].hash ? normalized[0] : null;
  }

  function blocked(reason, details) {
    return frozen({ status: 'blocked', reason, details: frozen(details), events: [] });
  }

  return frozen({ reconcile });
}

export function canonicalChainEventKey(event = {}) {
  return [positiveInteger(event.chainId, 'chainId'), hash32(event.transactionHash, 'transactionHash'), nonNegativeInteger(event.logIndex, 'logIndex')].join(':');
}

function normalizeLogs(value, missionId, vaultAddress, chainId) {
  if (!Array.isArray(value)) throw new TypeError('Provider logs must be an array.');
  const byKey = new Map();
  for (const raw of value) {
    exactObject(raw, ['blockHash', 'blockNumber', 'commitmentHash', 'eventType', 'logIndex', 'transactionHash']);
    const event = frozen({
      chainId,
      missionId,
      vaultAddress,
      transactionHash: hash32(raw.transactionHash, 'transactionHash'),
      logIndex: nonNegativeInteger(raw.logIndex, 'logIndex'),
      eventType: identifier(raw.eventType, 'eventType'),
      commitmentHash: hash32(raw.commitmentHash, 'commitmentHash'),
      blockNumber: nonNegativeInteger(raw.blockNumber, 'blockNumber'),
      blockHash: hash32(raw.blockHash, 'blockHash'),
    });
    const key = canonicalChainEventKey(event);
    const existing = byKey.get(key);
    if (existing && !sameJson(existing, event)) throw new MissionChainReconcileError('duplicate_log_conflict', 'Duplicate chain log identity changed.');
    byKey.set(key, event);
  }
  return [...byKey.values()].sort((a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex || a.transactionHash.localeCompare(b.transactionHash));
}

function normalizeBlock(value, expectedNumber) {
  exactObject(value, ['hash', 'number']);
  const number = nonNegativeInteger(value.number, 'block.number');
  if (number !== expectedNumber) throw new TypeError('Provider returned the wrong block number.');
  return frozen({ number, hash: hash32(value.hash, 'block.hash') });
}

function normalizeTokenList(value) {
  if (!Array.isArray(value)) throw new TypeError('Supported token pin must be an array.');
  const normalized = value.map((token) => address(token, 'supportedToken')).sort();
  if (new Set(normalized).size !== normalized.length) throw new TypeError('Supported token pin contains duplicates.');
  return frozen(normalized);
}

function validProvider(value) {
  return value && ['getBlockNumber', 'getBlock', 'getCode', 'getSupportedTokens', 'getLogs'].every((name) => typeof value[name] === 'function');
}
function exactObject(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new TypeError('Chain value must be a plain object.');
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new TypeError('Chain value fields are invalid.');
}
function identifier(value, label) { if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(value)) throw new TypeError(label + ' is invalid.'); return value; }
function address(value, label) { if (typeof value !== 'string' || !ADDRESS.test(value.toLowerCase())) throw new TypeError(label + ' is invalid.'); return value.toLowerCase(); }
function hash32(value, label) { if (typeof value !== 'string' || !HEX_32.test(value.toLowerCase())) throw new TypeError(label + ' is invalid.'); return value.toLowerCase(); }
function hexBytes(value, label) { if (typeof value !== 'string' || !/^0x(?:[0-9a-f]{2})*$/u.test(value.toLowerCase())) throw new TypeError(label + ' is invalid.'); return value.toLowerCase(); }
function nonNegativeInteger(value, label) { if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(label + ' is invalid.'); return value; }
function positiveInteger(value, label) { if (!Number.isSafeInteger(value) || value <= 0) throw new TypeError(label + ' is invalid.'); return value; }
function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function frozen(value) { if (value && typeof value === 'object') { for (const nested of Object.values(value)) frozen(nested); Object.freeze(value); } return value; }

export { EVENT_STATES };
