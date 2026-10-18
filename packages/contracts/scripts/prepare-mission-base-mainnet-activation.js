import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { ethers } from 'ethers';

export const ACTIVATION_CONSTANTS = Object.freeze({
  network: 'base-mainnet',
  chainId: 8453,
  safe: '0x7410A8CA3F3098D92300bfE110273A68f5fcc4FF',
  safeVersion: '1.4.1',
  owners: Object.freeze([
    '0x339559A2d1CD15059365FC7bD36b3047BbA480E0',
    '0x709D8d528D2c0C8A408107E74b38a01Fa14e44aE',
  ]),
  approvalOwner: '0x709D8d528D2c0C8A408107E74b38a01Fa14e44aE',
  threshold: 2,
  registry: '0xC2fbEF16EC0981bcfA7e878f6f78BF8DeBe2BcCB',
  versionId: '0x5fc16a65273a5c452de558226709b483548e34e8718ab2dbca37c6bcb3d5a3ac',
  activateAfter: 1792436907,
  expectedNonce: 1,
  proposalSafeTxHash: '0xa61cad7e0459f24a0bce966611c59eb6c44326426295b43115f010a4db34d7a8',
  proposalTransactionHash: '0x3225d0b160136d02a4d6ece382a36e42d91574a4f87a0ee299eeb3bd9ced29cd',
  anchorBlockNumber: 52778864,
  anchorBlockHash: '0x42edb637dcc2cd7e42fd8a7907698be902039aa8525600d8c5289576cb5f0d20',
  anchorTimestamp: 1792347075,
});

export const RPC_ORIGINS = Object.freeze([
  'https://mainnet.base.org',
  'https://base-mainnet.public.blastapi.io',
]);

export const ACTIVATION_ARTIFACT_URL = new URL(
  '../../../review-artifacts/swarm-command/base-mainnet-mission-escrow-v1-activation.json',
  import.meta.url,
);

const ZERO_ADDRESS = ethers.ZeroAddress;
const DOMAIN_TYPEHASH = ethers.keccak256(ethers.toUtf8Bytes('EIP712Domain(uint256 chainId,address verifyingContract)'));
const SAFE_TX_TYPEHASH = ethers.keccak256(ethers.toUtf8Bytes('SafeTx(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 nonce)'));
const SAFE_ABI = [
  'function nonce() view returns(uint256)',
  'function getOwners() view returns(address[])',
  'function getThreshold() view returns(uint256)',
  'function VERSION() view returns(string)',
  'function approvedHashes(address,bytes32) view returns(uint256)',
  'function approveHash(bytes32)',
  'function execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes) returns(bool)',
  'function getTransactionHash(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,uint256) view returns(bytes32)',
];
const REGISTRY_ABI = [
  'function governance() view returns(address)',
  'function activateVersion(bytes32)',
  'function getVersion(bytes32) view returns(tuple(bytes32 creationCodeHash,bytes32 runtimeCodeHash,address[2] supportedTokens,uint8 tokenCount,uint64 activateAfter,uint64 retireAfter,uint32 factoryCompatibility,uint8 status,bool exists))',
];

export function buildActivationPacket() {
  const registry = new ethers.Interface(REGISTRY_ABI);
  const safe = new ethers.Interface(SAFE_ABI);
  const data = registry.encodeFunctionData('activateVersion', [ACTIVATION_CONSTANTS.versionId]);
  const safeTransaction = Object.freeze({
    to: ACTIVATION_CONSTANTS.registry,
    value: '0',
    data,
    operation: 'CALL',
    operationCode: 0,
    safeTxGas: '0',
    baseGas: '0',
    gasPrice: '0',
    gasToken: ZERO_ADDRESS,
    refundReceiver: ZERO_ADDRESS,
    nonce: ACTIVATION_CONSTANTS.expectedNonce,
  });
  const safeTxHash = computeSafeTransactionHash(ACTIVATION_CONSTANTS.chainId, ACTIVATION_CONSTANTS.safe, safeTransaction);
  const approvalCalldata = safe.encodeFunctionData('approveHash', [safeTxHash]);

  return Object.freeze({
    schemaVersion: 1,
    status: 'review_complete_no_sign_no_broadcast',
    network: ACTIVATION_CONSTANTS.network,
    chainId: ACTIVATION_CONSTANTS.chainId,
    proposal: Object.freeze({
      status: 'complete',
      safeTxHash: ACTIVATION_CONSTANTS.proposalSafeTxHash,
      transactionHash: ACTIVATION_CONSTANTS.proposalTransactionHash,
      receiptArtifact: 'review-artifacts/swarm-command/base-mainnet-governance-proposal-receipt.json',
    }),
    authority: Object.freeze({
      kind: 'safe-2-of-2',
      address: ACTIVATION_CONSTANTS.safe,
      version: ACTIVATION_CONSTANTS.safeVersion,
      owners: ACTIVATION_CONSTANTS.owners,
      threshold: ACTIVATION_CONSTANTS.threshold,
      requiredNonce: ACTIVATION_CONSTANTS.expectedNonce,
    }),
    activation: Object.freeze({
      action: 'VersionRegistry.activateVersion(MissionEscrowV1)',
      registry: ACTIVATION_CONSTANTS.registry,
      versionId: ACTIVATION_CONSTANTS.versionId,
      activateAfter: ACTIVATION_CONSTANTS.activateAfter,
      activateAfterIso: new Date(ACTIVATION_CONSTANTS.activateAfter * 1_000).toISOString(),
      safeTransaction,
      dataHash: ethers.keccak256(data),
      safeTxHash,
      authorization: 'owners-2-of-2-not-collected',
    }),
    ownerApproval: Object.freeze({
      action: 'Safe.approveHash(exact activation safeTxHash)',
      requiredSigner: ACTIVATION_CONSTANTS.approvalOwner,
      to: ACTIVATION_CONSTANTS.safe,
      value: '0',
      data: approvalCalldata,
      dataHash: ethers.keccak256(approvalCalldata),
    }),
    requiredOnchainGuards: Object.freeze({
      chainId: ACTIVATION_CONSTANTS.chainId,
      safeNonce: ACTIVATION_CONSTANTS.expectedNonce,
      safeThreshold: ACTIVATION_CONSTANTS.threshold,
      safeOwners: ACTIVATION_CONSTANTS.owners,
      registryGovernance: ACTIVATION_CONSTANTS.safe,
      versionExists: true,
      versionStatus: 'pending',
      versionActivateAfter: ACTIVATION_CONSTANTS.activateAfter,
      latestBlockTimestampAtLeast: ACTIVATION_CONSTANTS.activateAfter,
      safeGetTransactionHash: safeTxHash,
      ownerApprovalRecorded: false,
    }),
    pinnedBaseState: Object.freeze({
      blockNumber: ACTIVATION_CONSTANTS.anchorBlockNumber,
      blockHash: ACTIVATION_CONSTANTS.anchorBlockHash,
      blockTimestamp: ACTIVATION_CONSTANTS.anchorTimestamp,
      rpcOrigins: RPC_ORIGINS,
      consensus: 'matched',
      ownerApprovalRecorded: false,
      safeNonce: ACTIVATION_CONSTANTS.expectedNonce,
      versionStatus: 'pending',
      versionActivateAfter: ACTIVATION_CONSTANTS.activateAfter,
    }),
    safeTransactionService: Object.freeze({
      role: 'advisory_only',
      lookupStatusAtReview: 404,
      authorityForGuards: false,
    }),
    forkProof: Object.freeze({
      kind: 'pinned-base-mainnet-fork',
      blockNumber: ACTIVATION_CONSTANTS.anchorBlockNumber,
      earlyActivationRejected: true,
      nonceUnchangedAfterEarlyRejection: true,
      activationSucceededAtTimestamp: ACTIVATION_CONSTANTS.activateAfter + 1,
      finalSafeNonce: 2,
      finalVersionStatus: 'active',
      externalBroadcast: false,
    }),
    excluded: Object.freeze({
      signing: 'not_performed',
      broadcast: 'not_performed',
      tokenApproval: 'not_performed',
      tokenTransfer: 'not_performed',
      missionFunding: 'not_performed',
      armoryKeys: 'not_enabled',
      productionDeployment: 'not_performed',
    }),
  });
}

export function computeSafeTransactionHash(chainId, safe, transaction) {
  const domainSeparator = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
    ['bytes32', 'uint256', 'address'],
    [DOMAIN_TYPEHASH, chainId, safe],
  ));
  const structHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
    ['bytes32', 'address', 'uint256', 'bytes32', 'uint8', 'uint256', 'uint256', 'uint256', 'address', 'address', 'uint256'],
    [
      SAFE_TX_TYPEHASH,
      transaction.to,
      transaction.value,
      ethers.keccak256(transaction.data),
      transaction.operationCode,
      transaction.safeTxGas,
      transaction.baseGas,
      transaction.gasPrice,
      transaction.gasToken,
      transaction.refundReceiver,
      transaction.nonce,
    ],
  ));
  return ethers.keccak256(ethers.concat(['0x1901', domainSeparator, structHash]));
}

export function validateActivationPacket(packet) {
  const expected = buildActivationPacket();
  if (!packet || packet.schemaVersion !== 1 || packet.status !== expected.status) throw new Error('Invalid activation packet status.');
  if (packet.chainId !== expected.chainId || packet.network !== expected.network) throw new Error('Activation chain mismatch.');
  if (packet.excluded?.signing !== 'not_performed' || packet.excluded?.broadcast !== 'not_performed') throw new Error('Packet must remain no-sign and no-broadcast.');
  if (packet.authority?.address !== expected.authority.address || packet.authority?.requiredNonce !== 1 || packet.authority?.threshold !== 2) throw new Error('Safe authority mismatch.');
  assertAddressList(packet.authority.owners, expected.authority.owners, 'Safe owners');
  const tx = packet.activation?.safeTransaction;
  if (!tx || JSON.stringify(tx) !== JSON.stringify(expected.activation.safeTransaction)) throw new Error('Activation transaction fields mismatch.');
  if (computeSafeTransactionHash(packet.chainId, packet.authority.address, tx) !== expected.activation.safeTxHash || packet.activation.safeTxHash !== expected.activation.safeTxHash) throw new Error('Safe transaction hash mismatch.');
  if (packet.ownerApproval?.requiredSigner !== expected.ownerApproval.requiredSigner || packet.ownerApproval?.to !== expected.ownerApproval.to || packet.ownerApproval?.data !== expected.ownerApproval.data || packet.ownerApproval?.value !== '0') throw new Error('Owner approval action mismatch.');
  if (packet.requiredOnchainGuards?.versionActivateAfter !== ACTIVATION_CONSTANTS.activateAfter || packet.requiredOnchainGuards?.versionStatus !== 'pending') throw new Error('Activation state guards mismatch.');
  if (findForbiddenKey(packet)) throw new Error('Packet contains a signature or secret-bearing field.');
  return true;
}

export async function verifyDualRpcState({ origins = RPC_ORIGINS } = {}) {
  const packet = buildActivationPacket();
  const observations = [];
  for (const origin of origins) {
    const provider = new ethers.JsonRpcProvider(origin, ACTIVATION_CONSTANTS.chainId, { staticNetwork: true });
    const pinned = await readChainState(provider, ACTIVATION_CONSTANTS.anchorBlockNumber, packet);
    const latest = await readChainState(provider, 'latest', packet);
    observations.push({ origin, pinned, latest });
  }
  for (const observation of observations) {
    assertState(observation.pinned, { requireAnchor: true });
    assertState(observation.latest, { requireAnchor: false });
  }
  const canonicalPinned = canonicalState(observations[0].pinned);
  const canonicalLatest = canonicalState(observations[0].latest);
  for (const observation of observations.slice(1)) {
    assertEqual(JSON.stringify(canonicalState(observation.pinned)), JSON.stringify(canonicalPinned), 'Pinned RPC state');
    assertEqual(JSON.stringify(canonicalState(observation.latest)), JSON.stringify(canonicalLatest), 'Latest RPC state');
  }
  return Object.freeze(observations);
}

export async function simulatePinnedFork({ forkUrl = RPC_ORIGINS[1] } = {}) {
  const { default: ganache } = await import('ganache');
  const packet = buildActivationPacket();
  const local = ganache.provider({
    fork: { url: forkUrl, blockNumber: ACTIVATION_CONSTANTS.anchorBlockNumber },
    chain: { chainId: ACTIVATION_CONSTANTS.chainId, time: new Date(ACTIVATION_CONSTANTS.anchorTimestamp * 1_000) },
    wallet: { unlockedAccounts: ACTIVATION_CONSTANTS.owners },
    logging: { quiet: true },
  });
  try {
    const provider = new ethers.BrowserProvider(local);
    for (const owner of ACTIVATION_CONSTANTS.owners) {
      await local.request({ method: 'evm_setAccountBalance', params: [owner, '0x3635c9adc5dea00000'] });
    }
    const executor = await provider.getSigner(ACTIVATION_CONSTANTS.owners[0]);
    const approver = await provider.getSigner(ACTIVATION_CONSTANTS.approvalOwner);
    const safe = new ethers.Contract(ACTIVATION_CONSTANTS.safe, SAFE_ABI, provider);
    const registry = new ethers.Contract(ACTIVATION_CONSTANTS.registry, REGISTRY_ABI, provider);
    const tx = packet.activation.safeTransaction;
    assertEqual(await safe.getTransactionHash(tx.to, 0, tx.data, 0, 0, 0, 0, ZERO_ADDRESS, ZERO_ADDRESS, 1), packet.activation.safeTxHash, 'Fork Safe transaction hash');
    assertEqual(await safe.nonce(), 1n, 'Fork initial Safe nonce');
    assertEqual((await registry.getVersion(ACTIVATION_CONSTANTS.versionId)).status, 0n, 'Fork initial version status');

    await (await safe.connect(approver).approveHash(packet.activation.safeTxHash, { gasLimit: 200_000 })).wait();
    const signatures = prevalidatedSafeAuthorizations(ACTIVATION_CONSTANTS.owners);
    let earlyActivationRejected = false;
    try {
      await (await safe.connect(executor).execTransaction(
        tx.to, 0, tx.data, 0, 0, 0, 0, ZERO_ADDRESS, ZERO_ADDRESS, signatures, { gasLimit: 1_000_000 },
      )).wait();
    } catch {
      earlyActivationRejected = true;
    }
    if (!earlyActivationRejected) throw new Error('Fork activation unexpectedly succeeded before activateAfter.');
    assertEqual(await safe.nonce(), 1n, 'Safe nonce after rejected activation');
    assertEqual((await registry.getVersion(ACTIVATION_CONSTANTS.versionId)).status, 0n, 'Version status after rejected activation');

    await local.request({ method: 'evm_setTime', params: [(ACTIVATION_CONSTANTS.activateAfter + 1) * 1_000] });
    await local.request({ method: 'evm_mine', params: [] });
    const receipt = await (await safe.connect(executor).execTransaction(
      tx.to, 0, tx.data, 0, 0, 0, 0, ZERO_ADDRESS, ZERO_ADDRESS, signatures, { gasLimit: 1_000_000 },
    )).wait();
    assertEqual(receipt.status, 1, 'Fork activation receipt');
    assertEqual(await safe.nonce(), 2n, 'Fork final Safe nonce');
    assertEqual((await registry.getVersion(ACTIVATION_CONSTANTS.versionId)).status, 1n, 'Fork final version status');
    return Object.freeze({
      pinnedBlockNumber: ACTIVATION_CONSTANTS.anchorBlockNumber,
      earlyActivationRejected,
      safeNonceAfterEarlyRejection: 1,
      activationSucceededAfterDelay: true,
      finalSafeNonce: 2,
      finalVersionStatus: 'active',
      externalBroadcast: false,
    });
  } finally {
    await local.disconnect?.();
  }
}

export async function writeActivationArtifact() {
  const packet = buildActivationPacket();
  validateActivationPacket(packet);
  const serialized = JSON.stringify(packet, null, 2) + String.fromCharCode(10);
  await writeFile(ACTIVATION_ARTIFACT_URL, serialized, 'utf8');
  return Object.freeze({
    path: fileURLToPath(ACTIVATION_ARTIFACT_URL),
    sha256: createHash('sha256').update(serialized).digest('hex'),
  });
}

export async function verifyActivationArtifact() {
  const packet = JSON.parse(await readFile(ACTIVATION_ARTIFACT_URL, 'utf8'));
  validateActivationPacket(packet);
  if (JSON.stringify(packet) !== JSON.stringify(buildActivationPacket())) throw new Error('Committed activation artifact is not deterministic.');
  return true;
}

async function readChainState(provider, blockTag, packet) {
  const safe = new ethers.Contract(ACTIVATION_CONSTANTS.safe, SAFE_ABI, provider);
  const registry = new ethers.Contract(ACTIVATION_CONSTANTS.registry, REGISTRY_ABI, provider);
  const tx = packet.activation.safeTransaction;
  const block = blockTag === 'latest' ? await provider.getBlock('latest') : await provider.getBlock(blockTag);
  const nonce = await safe.nonce({ blockTag });
  const owners = await safe.getOwners({ blockTag });
  const threshold = await safe.getThreshold({ blockTag });
  const safeVersion = await safe.VERSION({ blockTag });
  const safeTxHash = await safe.getTransactionHash(tx.to, 0, tx.data, 0, 0, 0, 0, ZERO_ADDRESS, ZERO_ADDRESS, tx.nonce, { blockTag });
  const approvedHash = await safe.approvedHashes(ACTIVATION_CONSTANTS.approvalOwner, packet.activation.safeTxHash, { blockTag });
  const governance = await registry.governance({ blockTag });
  const version = await registry.getVersion(ACTIVATION_CONSTANTS.versionId, { blockTag });
  return Object.freeze({
    blockNumber: block.number,
    blockHash: block.hash,
    blockTimestamp: block.timestamp,
    nonce: Number(nonce),
    owners: Object.freeze([...owners]),
    threshold: Number(threshold),
    safeVersion,
    safeTxHash,
    ownerApprovalRecorded: approvedHash > 0n,
    governance,
    versionStatus: Number(version.status),
    versionExists: version.exists,
    activateAfter: Number(version.activateAfter),
  });
}

function assertState(state, { requireAnchor }) {
  if (requireAnchor) {
    assertEqual(state.blockNumber, ACTIVATION_CONSTANTS.anchorBlockNumber, 'Anchor block number');
    assertEqual(state.blockHash, ACTIVATION_CONSTANTS.anchorBlockHash, 'Anchor block hash');
    assertEqual(state.blockTimestamp, ACTIVATION_CONSTANTS.anchorTimestamp, 'Anchor timestamp');
  }
  assertEqual(state.nonce, ACTIVATION_CONSTANTS.expectedNonce, 'Safe nonce');
  assertAddressList(state.owners, ACTIVATION_CONSTANTS.owners, 'Safe owners');
  assertEqual(state.threshold, ACTIVATION_CONSTANTS.threshold, 'Safe threshold');
  assertEqual(state.safeVersion, ACTIVATION_CONSTANTS.safeVersion, 'Safe version');
  assertEqual(state.safeTxHash, buildActivationPacket().activation.safeTxHash, 'Safe transaction hash');
  assertEqual(state.ownerApprovalRecorded, false, 'Owner activation approval');
  assertEqual(state.governance, ACTIVATION_CONSTANTS.safe, 'Registry governance');
  assertEqual(state.versionStatus, 0, 'Version status');
  assertEqual(state.versionExists, true, 'Version exists');
  assertEqual(state.activateAfter, ACTIVATION_CONSTANTS.activateAfter, 'Version activateAfter');
}

function canonicalState(state) {
  return {
    ...(state.blockNumber === ACTIVATION_CONSTANTS.anchorBlockNumber ? { blockNumber: state.blockNumber, blockHash: state.blockHash, blockTimestamp: state.blockTimestamp } : {}),
    nonce: state.nonce,
    owners: [...state.owners].map(ethers.getAddress).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())),
    threshold: state.threshold,
    safeVersion: state.safeVersion,
    safeTxHash: state.safeTxHash,
    ownerApprovalRecorded: state.ownerApprovalRecorded,
    governance: state.governance,
    versionStatus: state.versionStatus,
    versionExists: state.versionExists,
    activateAfter: state.activateAfter,
  };
}

function prevalidatedSafeAuthorizations(owners) {
  return ethers.concat([...owners]
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .map((owner) => ethers.concat([ethers.zeroPadValue(owner, 32), ethers.ZeroHash, '0x01'])));
}

function findForbiddenKey(value, path = '$') {
  if (!value || typeof value !== 'object') return null;
  for (const [key, child] of Object.entries(value)) {
    const next = path + '.' + key;
    if (/private.?key|mnemonic|signature/i.test(key)) return next;
    const found = findForbiddenKey(child, next);
    if (found) return found;
  }
  return null;
}

function assertAddressList(actual, expected, label) {
  if (!Array.isArray(actual)) throw new Error(label + ' missing.');
  const left = actual.map(ethers.getAddress).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const right = expected.map(ethers.getAddress).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  assertEqual(JSON.stringify(left), JSON.stringify(right), label);
}

function assertEqual(actual, expected, label) {
  if (String(actual).toLowerCase() !== String(expected).toLowerCase()) throw new Error(label + ' mismatch: expected ' + expected + ', received ' + actual + '.');
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const result = {};
  if (!args.size || args.has('--write')) result.artifact = await writeActivationArtifact();
  if (args.has('--check')) result.artifactValid = await verifyActivationArtifact();
  if (args.has('--verify-live')) result.rpcConsensus = (await verifyDualRpcState()).map(({ origin, pinned, latest }) => ({ origin, pinnedBlockHash: pinned.blockHash, latestBlockNumber: latest.blockNumber }));
  if (args.has('--simulate-fork')) result.forkProof = await simulatePinnedFork();
  process.stdout.write(JSON.stringify(result, null, 2) + String.fromCharCode(10));
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
