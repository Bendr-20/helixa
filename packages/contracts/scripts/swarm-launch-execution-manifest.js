import { createHash } from 'node:crypto';

import {
  AbiCoder,
  concat,
  getAddress,
  getCreate2Address,
  id,
  isHexString,
  keccak256,
  TypedDataEncoder,
  verifyTypedData,
} from 'ethers';

import { canonicalSwarmLaunchJson } from '../../types/src/swarm-launch.js';

const SCHEMA = 'multipass.swarm-launch-execution-readiness.v1';
const CHAIN_ID = 8453;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const CONTRIBUTIONS = 'tuple(bytes32 agentKey,address beneficiary,uint16 bps)[]';
const REVENUE_SHARES = 'tuple(address payee,uint16 bps)[]';
const AUTHORIZATION_TYPES = Object.freeze({
  SwarmLaunchExecution: Object.freeze([
    Object.freeze({ name: 'deploymentId', type: 'bytes32' }),
    Object.freeze({ name: 'authorizationDeadline', type: 'uint64' }),
  ]),
});
const TAGS = Object.freeze({
  registry: id('CONTRIBUTION_REGISTRY'),
  splitter: id('REVENUE_SPLITTER'),
  stream: id('VESTING_STREAM'),
});
const coder = AbiCoder.defaultAbiCoder();

export function buildSwarmLaunchExecutionReadiness(input = {}) {
  const chainId = integer(input.chainId, 1, Number.MAX_SAFE_INTEGER, 'chainId');
  if (chainId !== CHAIN_ID) throw new TypeError('Swarm Launch execution chain must be Base (8453).');
  const factoryAddress = address(input.factoryAddress, false, 'factoryAddress');
  const readinessPacketSha256 = bytes32(input.readinessPacketSha256, 'readinessPacketSha256');
  const plan = normalizePlan(input.plan, readinessPacketSha256);
  const artifacts = normalizeArtifacts(input.artifacts);
  const deploymentId = computeDeploymentId(plan);
  const predicted = predict(factoryAddress, plan, artifacts.contracts, deploymentId);
  const domain = deepFreeze({ name: 'Helixa Swarm Launch', version: '1', chainId, verifyingContract: factoryAddress });
  const message = deepFreeze({ deploymentId, authorizationDeadline: plan.authorizationDeadline });
  const authorizationDigest = TypedDataEncoder.hash(domain, AUTHORIZATION_TYPES, message).toLowerCase();

  const manifest = deepFreeze({
    schema: SCHEMA,
    chainId,
    readinessPacketSha256,
    compiler: {
      version: artifacts.compilerVersion,
      sourceHash: artifacts.sourceHash,
      bytecodeHashes: {
        contributionRegistry: keccak256(artifacts.contracts.SwarmContributionRegistry.bytecode).toLowerCase(),
        vestingStream: keccak256(artifacts.contracts.NonTransferableVestingStream.bytecode).toLowerCase(),
        revenueSplitter: keccak256(artifacts.contracts.PullRevenueSplitter.bytecode).toLowerCase(),
        factory: keccak256(artifacts.contracts.SwarmLaunchFactory.bytecode).toLowerCase(),
      },
    },
    factory: factoryAddress,
    plan,
    deployment: {
      deploymentId,
      registry: predicted.registry,
      splitter: predicted.splitter,
      streams: predicted.streams,
      totalVesting: predicted.totalVesting,
    },
    authorization: {
      scheme: 'EIP712',
      status: 'AWAITING_SIGNATURES',
      digest: authorizationDigest,
      requiredSigners: plan.requiredSigners,
      signatures: [],
    },
    execution: {
      mode: 'SIGNATURE_COLLECTION_ONLY',
      deploymentAuthorized: false,
      broadcastPrepared: false,
      transactionCount: 0,
      requiresTokenFundingApproval: true,
    },
  });
  return envelope(manifest, domain, message);
}

export async function attachSwarmLaunchExecutionSignatures(prepared, signatures, { verifySignature } = {}) {
  const manifest = prepared?.manifest;
  const typedData = prepared?.typedData;
  if (!manifest || manifest.schema !== SCHEMA || manifest.authorization?.status !== 'AWAITING_SIGNATURES') {
    throw new TypeError('Prepared execution-readiness manifest is invalid.');
  }
  if (!typedData || TypedDataEncoder.hash(typedData.domain, typedData.types, typedData.message).toLowerCase() !== manifest.authorization.digest) {
    throw new TypeError('Execution authorization typed data does not match the manifest.');
  }
  if (!Array.isArray(signatures) || signatures.length !== manifest.authorization.requiredSigners.length) {
    throw new TypeError('Every required signer must provide exactly one execution signature.');
  }

  const normalized = [];
  for (let index = 0; index < signatures.length; index += 1) {
    const requiredSigner = manifest.authorization.requiredSigners[index];
    const signer = address(signatures[index]?.signer, false, 'signature signer');
    const signature = hex(signatures[index]?.signature, 'execution signature');
    if (signer !== requiredSigner) throw new TypeError('Execution signatures must match required signer order.');
    let valid;
    if (verifySignature) valid = await verifySignature({ signer, digest: manifest.authorization.digest, signature, typedData });
    else {
      try { valid = address(verifyTypedData(typedData.domain, typedData.types, typedData.message, signature), false, 'recovered signer') === signer; }
      catch { valid = false; }
    }
    if (valid !== true) throw new TypeError('Execution signature did not verify.');
    normalized.push(deepFreeze({ signer, signature }));
  }

  const signedManifest = deepFreeze({
    ...manifest,
    authorization: { ...manifest.authorization, status: 'SIGNATURES_VERIFIED', signatures: normalized },
    execution: { ...manifest.execution, mode: 'AUTHORIZED_NO_BROADCAST', deploymentAuthorized: true },
  });
  return envelope(signedManifest, typedData.domain, typedData.message);
}

function envelope(manifest, domain, message) {
  return deepFreeze({
    manifest,
    manifestSha256: '0x' + createHash('sha256').update(canonicalSwarmLaunchJson(manifest)).digest('hex'),
    typedData: { domain, types: AUTHORIZATION_TYPES, primaryType: 'SwarmLaunchExecution', message },
  });
}

function normalizePlan(value, readinessPacketSha256) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Launch execution plan is invalid.');
  const readinessHash = bytes32(value.readinessHash, 'readinessHash');
  if (readinessHash !== readinessPacketSha256) throw new TypeError('Execution plan must bind the exact readiness packet hash.');
  const token = address(value.token, false, 'token');
  const start = integer(value.start, 1, Number.MAX_SAFE_INTEGER, 'start');
  const cliff = integer(value.cliff, 0, Number.MAX_SAFE_INTEGER, 'cliff');
  const duration = integer(value.duration, 1, Number.MAX_SAFE_INTEGER, 'duration');
  const authorizationDeadline = integer(value.authorizationDeadline, 1, Number.MAX_SAFE_INTEGER, 'authorizationDeadline');
  if (cliff > duration || start + duration > 18_446_744_073_709_551_615 || authorizationDeadline >= start) throw new TypeError('Vesting or authorization timing is invalid.');
  const deploymentSalt = bytes32(value.deploymentSalt, 'deploymentSalt');
  if (/^0x0{64}$/u.test(deploymentSalt)) throw new TypeError('deploymentSalt is invalid.');

  if (!Array.isArray(value.contributions) || value.contributions.length < 3 || value.contributions.length > 5) throw new TypeError('Three to five contributions are required.');
  const contributions = value.contributions.map((entry) => deepFreeze({
    agentKey: bytes32(entry?.agentKey, 'agentKey'),
    beneficiary: address(entry?.beneficiary, false, 'beneficiary'),
    bps: integer(entry?.bps, 1, 10_000, 'contribution bps'),
  }));
  if (new Set(contributions.map((entry) => entry.agentKey)).size !== contributions.length || contributions.reduce((sum, entry) => sum + entry.bps, 0) !== 10_000) throw new TypeError('Contribution weights must be unique and total 10,000 bps.');

  if (!Array.isArray(value.vestingAmounts) || value.vestingAmounts.length !== contributions.length) throw new TypeError('Each contribution requires a vesting amount.');
  const vestingAmounts = value.vestingAmounts.map((entry) => uintString(entry, 'vesting amount'));
  const totalVesting = vestingAmounts.reduce((sum, entry) => sum + BigInt(entry), 0n);
  if (totalVesting === 0n) throw new TypeError('Total vesting must be positive.');
  let allocated = 0n;
  for (let index = 0; index < contributions.length; index += 1) {
    const expected = index + 1 === contributions.length ? totalVesting - allocated : totalVesting * BigInt(contributions[index].bps) / 10_000n;
    if (BigInt(vestingAmounts[index]) !== expected) throw new TypeError('Vesting amounts must follow the exact contribution weights.');
    allocated += expected;
  }

  if (!Array.isArray(value.revenueShares) || value.revenueShares.length < 2 || value.revenueShares.length > 32) throw new TypeError('Revenue shares are invalid.');
  const revenueShares = value.revenueShares.map((entry) => deepFreeze({ payee: address(entry?.payee, false, 'revenue payee'), bps: integer(entry?.bps, 1, 10_000, 'revenue bps') }));
  if (new Set(revenueShares.map((entry) => entry.payee)).size !== revenueShares.length || revenueShares.reduce((sum, entry) => sum + entry.bps, 0) !== 10_000) throw new TypeError('Revenue shares must be unique and total 10,000 bps.');

  if (!Array.isArray(value.revenueAssets) || value.revenueAssets.length < 1 || value.revenueAssets.length > 8) throw new TypeError('Revenue assets are invalid.');
  const revenueAssets = value.revenueAssets.map((entry) => address(entry, true, 'revenue asset'));
  if (new Set(revenueAssets).size !== revenueAssets.length) throw new TypeError('Revenue assets must be unique.');

  if (!Array.isArray(value.requiredSigners) || value.requiredSigners.length < 1 || value.requiredSigners.length > 5) throw new TypeError('Required signers are invalid.');
  const requiredSigners = value.requiredSigners.map((entry) => address(entry, false, 'required signer'));
  for (let index = 0; index < requiredSigners.length; index += 1) {
    if (index > 0 && BigInt(requiredSigners[index]) <= BigInt(requiredSigners[index - 1])) throw new TypeError('Required signers must be unique and numerically sorted.');
  }

  return deepFreeze({ readinessHash, token, start, cliff, duration, authorizationDeadline, deploymentSalt, contributions, vestingAmounts, revenueShares, revenueAssets, requiredSigners });
}

function normalizeArtifacts(value) {
  const names = ['SwarmContributionRegistry', 'NonTransferableVestingStream', 'PullRevenueSplitter', 'SwarmLaunchFactory'];
  if (!value || value.compilerVersion !== '0.8.24' || !/^[0-9a-f]{64}$/u.test(value.sourceHash ?? '')) throw new TypeError('Deterministic Swarm Launch artifacts are invalid.');
  const contracts = {};
  for (const name of names) {
    const bytecode = value.contracts?.[name]?.bytecode;
    if (!isHexString(bytecode) || bytecode === '0x') throw new TypeError(name + ' bytecode is invalid.');
    contracts[name] = { bytecode: bytecode.toLowerCase() };
  }
  return deepFreeze({ compilerVersion: value.compilerVersion, sourceHash: value.sourceHash, contracts });
}

function computeDeploymentId(plan) {
  const contributionHash = keccak256(coder.encode([CONTRIBUTIONS], [plan.contributions.map((entry) => [entry.agentKey, entry.beneficiary, entry.bps])]));
  const vestingHash = keccak256(coder.encode(['uint256[]'], [plan.vestingAmounts]));
  const revenueHash = keccak256(coder.encode([REVENUE_SHARES], [plan.revenueShares.map((entry) => [entry.payee, entry.bps])]));
  const assetHash = keccak256(coder.encode(['address[]'], [plan.revenueAssets]));
  const signerHash = keccak256(coder.encode(['address[]'], [plan.requiredSigners]));
  return keccak256(coder.encode(
    ['bytes32', 'address', 'uint64', 'uint64', 'uint64', 'uint64', 'bytes32', 'bytes32', 'bytes32', 'bytes32', 'bytes32', 'bytes32'],
    [plan.readinessHash, plan.token, plan.start, plan.cliff, plan.duration, plan.authorizationDeadline, plan.deploymentSalt, contributionHash, vestingHash, revenueHash, assetHash, signerHash],
  )).toLowerCase();
}

function predict(factory, plan, contracts, deploymentId) {
  const contributionValues = plan.contributions.map((entry) => [entry.agentKey, entry.beneficiary, entry.bps]);
  const revenueValues = plan.revenueShares.map((entry) => [entry.payee, entry.bps]);
  const registry = create2(factory, componentSalt(deploymentId, TAGS.registry, 0), concat([contracts.SwarmContributionRegistry.bytecode, coder.encode(['bytes32', CONTRIBUTIONS], [plan.readinessHash, contributionValues])]));
  const splitter = create2(factory, componentSalt(deploymentId, TAGS.splitter, 0), concat([contracts.PullRevenueSplitter.bytecode, coder.encode(['bytes32', REVENUE_SHARES, 'address[]'], [plan.readinessHash, revenueValues, plan.revenueAssets])]));
  const streams = plan.contributions.map((entry, index) => create2(
    factory,
    componentSalt(deploymentId, TAGS.stream, index),
    concat([contracts.NonTransferableVestingStream.bytecode, coder.encode(['address', 'address', 'uint256', 'uint64', 'uint64', 'uint64', 'bytes32'], [plan.token, entry.beneficiary, plan.vestingAmounts[index], plan.start, plan.cliff, plan.duration, plan.readinessHash])]),
  ));
  return deepFreeze({ registry, splitter, streams, totalVesting: plan.vestingAmounts.reduce((sum, entry) => sum + BigInt(entry), 0n).toString() });
}

function componentSalt(deploymentId, tag, index) { return keccak256(coder.encode(['bytes32', 'bytes32', 'uint256'], [deploymentId, tag, index])); }
function create2(factory, salt, initCode) { return getCreate2Address(factory, salt, keccak256(initCode)).toLowerCase(); }
function bytes32(value, label) { const text = String(value ?? '').toLowerCase(); if (!/^0x[0-9a-f]{64}$/u.test(text)) throw new TypeError(label + ' is invalid.'); return text; }
function hex(value, label) { const text = String(value ?? ''); if (!/^0x(?:[0-9a-fA-F]{2})+$/u.test(text)) throw new TypeError(label + ' is invalid.'); return text.toLowerCase(); }
function address(value, allowZero, label) { let normalized; try { normalized = getAddress(String(value ?? '')).toLowerCase(); } catch { throw new TypeError(label + ' is invalid.'); } if (!allowZero && normalized === ZERO_ADDRESS) throw new TypeError(label + ' is invalid.'); return normalized; }
function integer(value, min, max, label) { if (!Number.isSafeInteger(value) || value < min || value > max) throw new TypeError(label + ' is invalid.'); return value; }
function uintString(value, label) { const text = String(value ?? ''); if (!/^[1-9][0-9]*$/u.test(text)) throw new TypeError(label + ' is invalid.'); return text; }
function deepFreeze(value) { if (Array.isArray(value)) { value.forEach(deepFreeze); return Object.freeze(value); } if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); return Object.freeze(value); } return value; }
