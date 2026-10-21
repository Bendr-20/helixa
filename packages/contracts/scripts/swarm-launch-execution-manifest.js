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

const SCHEMA = 'multipass.swarm-token-launch-packet.v1';
const READINESS_SCHEMA = 'multipass.swarm-launch-execution-plan.v1';
const CHAIN_ID = 8453;
const TOTAL_BPS = 10_000;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const TOKEN_TERMS = 'tuple(string name,string symbol,uint8 decimals,uint256 totalSupply)';
const ALLOCATION_TERMS = 'tuple(uint16 agentVestingBps,uint16 credRewardsBps,uint16 swarmTreasuryBps,uint16 publicDistributionBps,uint256 agentVestingAmount,uint256 credRewardsAmount,uint256 swarmTreasuryAmount,uint256 publicDistributionAmount,address credRewardsRecipient,address swarmTreasuryRecipient,address publicDistributionRecipient)';
const CONTRIBUTIONS = 'tuple(bytes32 agentKey,address beneficiary,uint16 bps)[]';
const REVENUE_SHARES = 'tuple(address payee,uint16 bps)[]';
const AUTHORIZATION_TYPES = Object.freeze({
  SwarmLaunchExecution: Object.freeze([
    Object.freeze({ name: 'deploymentId', type: 'bytes32' }),
    Object.freeze({ name: 'authorizationDeadline', type: 'uint64' }),
  ]),
});
const TAGS = Object.freeze({
  token: id('FIXED_SUPPLY_TOKEN'),
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
  const calculatedReadinessHash = '0x' + createHash('sha256').update(canonicalSwarmLaunchJson(input.readinessManifest)).digest('hex');
  if (calculatedReadinessHash !== readinessPacketSha256) throw new TypeError('Signed execution readiness manifest hash does not match.');
  const plan = normalizePlan(input.plan, readinessPacketSha256);
  const readiness = normalizeReadiness(input.readinessManifest);
  assertReadinessMatchesPlan(readiness, plan);
  const artifacts = normalizeArtifacts(input.artifacts);
  const deploymentId = computeDeploymentId(plan);
  const predicted = predict(factoryAddress, plan, artifacts.contracts, deploymentId);
  const domain = deepFreeze({ name: 'Helixa Swarm Launch', version: '1', chainId, verifyingContract: factoryAddress });
  const message = deepFreeze({ deploymentId, authorizationDeadline: plan.authorizationDeadline });
  const authorizationDigest = TypedDataEncoder.hash(domain, AUTHORIZATION_TYPES, message).toLowerCase();

  const manifest = deepFreeze({
    schema: SCHEMA,
    chainId,
    sourceReadiness: { schema: readiness.schema, sha256: readinessPacketSha256 },
    compiler: {
      version: artifacts.compilerVersion,
      sourceHash: artifacts.sourceHash,
      viaIR: true,
      bytecodeHashes: Object.fromEntries(Object.entries(artifacts.contracts).map(([name, artifact]) => [name, keccak256(artifact.bytecode).toLowerCase()])),
    },
    factory: factoryAddress,
    plan,
    deployment: {
      deploymentId,
      token: predicted.token,
      registry: predicted.registry,
      splitter: predicted.splitter,
      streams: predicted.streams,
      totalSupply: plan.token.totalSupply,
      categoryAmounts: {
        agentVesting: plan.allocations.agentVestingAmount,
        credRewards: plan.allocations.credRewardsAmount,
        swarmTreasury: plan.allocations.swarmTreasuryAmount,
        publicDistribution: plan.allocations.publicDistributionAmount,
      },
      recipients: {
        credRewards: plan.allocations.credRewardsRecipient,
        swarmTreasury: plan.allocations.swarmTreasuryRecipient,
        publicDistribution: plan.allocations.publicDistributionRecipient,
      },
    },
    authorization: {
      scheme: 'EIP712',
      status: 'NOT_ATTACHED',
      digest: authorizationDigest,
      requiredSigners: plan.requiredSigners,
      signatures: [],
    },
    execution: {
      mode: 'PREPARATION_ONLY',
      deploymentAuthorized: false,
      broadcastPrepared: false,
      transactionCount: 0,
      requiresSeparateApproval: true,
    },
    safety: {
      keysIncluded: false,
      signaturesIncluded: false,
      externalAdapterDataIncluded: false,
      rpcSendMethodsAllowed: false,
    },
  });
  return envelope(manifest, domain, message);
}

export async function attachSwarmLaunchExecutionSignatures(prepared, signatures, { verifySignature } = {}) {
  const manifest = prepared?.manifest;
  const typedData = prepared?.typedData;
  if (!manifest || manifest.schema !== SCHEMA || manifest.authorization?.status !== 'NOT_ATTACHED') {
    throw new TypeError('Prepared launch packet is invalid.');
  }
  if (!typedData || TypedDataEncoder.hash(typedData.domain, typedData.types, typedData.message).toLowerCase() !== manifest.authorization.digest) {
    throw new TypeError('Execution authorization typed data does not match the packet.');
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
    if (verifySignature) {
      valid = await verifySignature({ signer, digest: manifest.authorization.digest, signature, typedData });
    } else {
      try {
        valid = address(verifyTypedData(typedData.domain, typedData.types, typedData.message, signature), false, 'recovered signer') === signer;
      } catch {
        valid = false;
      }
    }
    if (valid !== true) throw new TypeError('Execution signature did not verify.');
    normalized.push(deepFreeze({ signer, signature }));
  }

  const signedManifest = deepFreeze({
    ...manifest,
    authorization: { ...manifest.authorization, status: 'SIGNATURES_VERIFIED_OFFLINE', signatures: normalized },
    execution: { ...manifest.execution, mode: 'AUTHORIZED_NO_BROADCAST', deploymentAuthorized: true },
    safety: { ...manifest.safety, signaturesIncluded: true },
  });
  return envelope(signedManifest, typedData.domain, typedData.message);
}

export function computeSwarmLaunchDeploymentId(plan) {
  return computeDeploymentId(normalizePlan(plan, bytes32(plan?.readinessHash, 'readinessHash')));
}

export function computeSwarmLaunchPredictions(factoryAddress, plan, artifacts) {
  const normalizedPlan = normalizePlan(plan, bytes32(plan?.readinessHash, 'readinessHash'));
  const normalizedArtifacts = normalizeArtifacts(artifacts);
  const factory = address(factoryAddress, false, 'factoryAddress');
  return predict(factory, normalizedPlan, normalizedArtifacts.contracts, computeDeploymentId(normalizedPlan));
}

function envelope(manifest, domain, message) {
  return deepFreeze({
    manifest,
    manifestSha256: '0x' + createHash('sha256').update(canonicalSwarmLaunchJson(manifest)).digest('hex'),
    typedData: { domain, types: AUTHORIZATION_TYPES, primaryType: 'SwarmLaunchExecution', message },
  });
}

function normalizeReadiness(value) {
  if (!value || value.schema !== READINESS_SCHEMA || value.chainId !== CHAIN_ID) throw new TypeError('Signed execution readiness manifest is invalid.');
  const token = normalizeToken(value.token);
  const allocations = normalizeAllocations(value.allocations, token.totalSupply);
  if (!Array.isArray(value.members) || value.members.length < 3 || value.members.length > 5) throw new TypeError('Readiness members are invalid.');
  const members = value.members.map((entry) => deepFreeze({
    agentKey: bytes32(entry?.agentKey, 'readiness agentKey'),
    beneficiary: address(entry?.beneficiary, false, 'readiness beneficiary'),
    contributionBps: integer(entry?.contributionBps, 1, TOTAL_BPS, 'readiness contribution bps'),
    consentAuthority: address(entry?.consentAuthority, false, 'readiness consent authority'),
  }));
  if (new Set(members.map((entry) => entry.agentKey)).size !== members.length || members.reduce((sum, entry) => sum + entry.contributionBps, 0) !== TOTAL_BPS) {
    throw new TypeError('Readiness contribution weights are invalid.');
  }
  const mechanisms = {};
  for (const field of ['credRewards', 'swarmTreasury', 'publicDistribution']) {
    const mechanism = String(value[field]?.mechanism ?? '');
    if (!mechanism || mechanism === 'UNSELECTED') throw new TypeError(field + ' mechanism is UNSELECTED.');
    mechanisms[field] = deepFreeze({ mechanism, recipient: address(value[field]?.recipient, false, field + ' recipient') });
  }
  return deepFreeze({ schema: value.schema, chainId: CHAIN_ID, token, allocations, members, ...mechanisms });
}

function assertReadinessMatchesPlan(readiness, plan) {
  if (canonicalSwarmLaunchJson(readiness.token) !== canonicalSwarmLaunchJson(plan.token)) throw new TypeError('Token terms differ from signed readiness.');
  if (canonicalSwarmLaunchJson(readiness.allocations) !== canonicalSwarmLaunchJson(plan.allocations)) throw new TypeError('Allocation terms differ from signed readiness.');
  if (readiness.members.length !== plan.contributions.length) throw new TypeError('Member roster differs from signed readiness.');
  for (let index = 0; index < readiness.members.length; index += 1) {
    const member = readiness.members[index];
    const contribution = plan.contributions[index];
    if (
      member.agentKey !== contribution.agentKey || member.beneficiary !== contribution.beneficiary
        || member.contributionBps !== contribution.bps || member.consentAuthority !== plan.requiredSigners[index]
    ) throw new TypeError('Member allocation or consent authority differs from signed readiness.');
  }
  const allocation = plan.allocations;
  if (
    readiness.credRewards.recipient !== allocation.credRewardsRecipient
      || readiness.swarmTreasury.recipient !== allocation.swarmTreasuryRecipient
      || readiness.publicDistribution.recipient !== allocation.publicDistributionRecipient
  ) throw new TypeError('Allocation recipient differs from signed readiness.');
}

function normalizePlan(value, readinessPacketSha256) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Launch execution plan is invalid.');
  const readinessHash = bytes32(value.readinessHash, 'readinessHash');
  if (readinessHash !== readinessPacketSha256) throw new TypeError('Execution plan must bind the exact readiness packet hash.');
  const start = integer(value.start, 1, Number.MAX_SAFE_INTEGER, 'start');
  const cliff = integer(value.cliff, 0, Number.MAX_SAFE_INTEGER, 'cliff');
  const duration = integer(value.duration, 1, Number.MAX_SAFE_INTEGER, 'duration');
  const authorizationDeadline = integer(value.authorizationDeadline, 1, Number.MAX_SAFE_INTEGER, 'authorizationDeadline');
  if (cliff > duration || start + duration > 18_446_744_073_709_551_615 || authorizationDeadline >= start) throw new TypeError('Vesting or authorization timing is invalid.');
  const deploymentSalt = bytes32(value.deploymentSalt, 'deploymentSalt');
  if (/^0x0{64}$/u.test(deploymentSalt)) throw new TypeError('deploymentSalt is invalid.');
  const token = normalizeToken(value.token);
  const allocations = normalizeAllocations(value.allocations, token.totalSupply);

  if (!Array.isArray(value.contributions) || value.contributions.length < 3 || value.contributions.length > 5) throw new TypeError('Three to five contributions are required.');
  const contributions = value.contributions.map((entry) => deepFreeze({
    agentKey: bytes32(entry?.agentKey, 'agentKey'),
    beneficiary: address(entry?.beneficiary, false, 'beneficiary'),
    bps: integer(entry?.bps, 1, TOTAL_BPS, 'contribution bps'),
  }));
  if (new Set(contributions.map((entry) => entry.agentKey)).size !== contributions.length || contributions.reduce((sum, entry) => sum + entry.bps, 0) !== TOTAL_BPS) throw new TypeError('Contribution weights must be unique and total 10,000 bps.');

  if (!Array.isArray(value.vestingAmounts) || value.vestingAmounts.length !== contributions.length) throw new TypeError('Each contribution requires a vesting amount.');
  const vestingAmounts = value.vestingAmounts.map((entry) => uintString(entry, 'vesting amount'));
  let allocated = 0n;
  for (let index = 0; index < contributions.length; index += 1) {
    const expected = index + 1 === contributions.length
      ? BigInt(allocations.agentVestingAmount) - allocated
      : shareOf(BigInt(allocations.agentVestingAmount), contributions[index].bps);
    if (BigInt(vestingAmounts[index]) !== expected || expected === 0n) throw new TypeError('Vesting amounts must follow exact deterministic contribution weights.');
    allocated += expected;
  }

  if (!Array.isArray(value.revenueShares) || value.revenueShares.length < 2 || value.revenueShares.length > 32) throw new TypeError('Revenue shares are invalid.');
  const revenueShares = value.revenueShares.map((entry) => deepFreeze({ payee: address(entry?.payee, false, 'revenue payee'), bps: integer(entry?.bps, 1, TOTAL_BPS, 'revenue bps') }));
  if (new Set(revenueShares.map((entry) => entry.payee)).size !== revenueShares.length || revenueShares.reduce((sum, entry) => sum + entry.bps, 0) !== TOTAL_BPS) throw new TypeError('Revenue shares must be unique and total 10,000 bps.');

  if (!Array.isArray(value.revenueAssets) || value.revenueAssets.length < 1 || value.revenueAssets.length > 8) throw new TypeError('Revenue assets are invalid.');
  const revenueAssets = value.revenueAssets.map((entry) => address(entry, true, 'revenue asset'));
  if (new Set(revenueAssets).size !== revenueAssets.length) throw new TypeError('Revenue assets must be unique.');

  if (!Array.isArray(value.requiredSigners) || value.requiredSigners.length !== contributions.length) throw new TypeError('Every member must be a required signer.');
  const requiredSigners = value.requiredSigners.map((entry) => address(entry, false, 'required signer'));
  for (let index = 0; index < requiredSigners.length; index += 1) {
    if (index > 0 && BigInt(requiredSigners[index]) <= BigInt(requiredSigners[index - 1])) throw new TypeError('Required signers must be unique and numerically sorted.');
  }

  return deepFreeze({ readinessHash, start, cliff, duration, authorizationDeadline, deploymentSalt, token, allocations, contributions, vestingAmounts, revenueShares, revenueAssets, requiredSigners });
}

function normalizeToken(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Token terms are invalid.');
  const name = bounded(value.name, 1, 64, 'token name');
  const symbol = bounded(value.symbol, 2, 10, 'token symbol');
  const decimals = integer(value.decimals, 18, 18, 'token decimals');
  const totalSupply = uintString(value.totalSupply, 'token totalSupply');
  return deepFreeze({ name, symbol, decimals, totalSupply });
}

function normalizeAllocations(value, totalSupply) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Allocation terms are invalid.');
  const normalized = {
    agentVestingBps: integer(value.agentVestingBps, 1, TOTAL_BPS, 'agent vesting bps'),
    credRewardsBps: integer(value.credRewardsBps, 1, TOTAL_BPS, 'CRED rewards bps'),
    swarmTreasuryBps: integer(value.swarmTreasuryBps, 1, TOTAL_BPS, 'swarm treasury bps'),
    publicDistributionBps: integer(value.publicDistributionBps, 1, TOTAL_BPS, 'public distribution bps'),
    agentVestingAmount: uintString(value.agentVestingAmount, 'agent vesting amount'),
    credRewardsAmount: uintString(value.credRewardsAmount, 'CRED rewards amount'),
    swarmTreasuryAmount: uintString(value.swarmTreasuryAmount, 'swarm treasury amount'),
    publicDistributionAmount: uintString(value.publicDistributionAmount, 'public distribution amount'),
    credRewardsRecipient: address(value.credRewardsRecipient, false, 'CRED rewards recipient'),
    swarmTreasuryRecipient: address(value.swarmTreasuryRecipient, false, 'swarm treasury recipient'),
    publicDistributionRecipient: address(value.publicDistributionRecipient, false, 'public distribution recipient'),
  };
  if (normalized.agentVestingBps + normalized.credRewardsBps + normalized.swarmTreasuryBps + normalized.publicDistributionBps !== TOTAL_BPS) throw new TypeError('Allocation bps must total exactly 10,000.');
  if (new Set([normalized.credRewardsRecipient, normalized.swarmTreasuryRecipient, normalized.publicDistributionRecipient]).size !== 3) throw new TypeError('Allocation recipients must be distinct.');
  const supply = BigInt(totalSupply);
  const agent = shareOf(supply, normalized.agentVestingBps);
  const cred = shareOf(supply, normalized.credRewardsBps);
  const treasury = shareOf(supply, normalized.swarmTreasuryBps);
  const distribution = supply - agent - cred - treasury;
  if (
    BigInt(normalized.agentVestingAmount) !== agent || BigInt(normalized.credRewardsAmount) !== cred
      || BigInt(normalized.swarmTreasuryAmount) !== treasury || BigInt(normalized.publicDistributionAmount) !== distribution
  ) throw new TypeError('Allocation amounts do not match exact deterministic bps allocation.');
  return deepFreeze(normalized);
}

function normalizeArtifacts(value) {
  const names = ['FixedSupplySwarmToken', 'SwarmContributionRegistry', 'NonTransferableVestingStream', 'PullRevenueSplitter', 'SwarmLaunchFactory'];
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
  const tokenHash = keccak256(coder.encode([TOKEN_TERMS], [[plan.token.name, plan.token.symbol, plan.token.decimals, plan.token.totalSupply]]));
  const allocation = plan.allocations;
  const allocationHash = keccak256(coder.encode([ALLOCATION_TERMS], [[
    allocation.agentVestingBps, allocation.credRewardsBps, allocation.swarmTreasuryBps, allocation.publicDistributionBps,
    allocation.agentVestingAmount, allocation.credRewardsAmount, allocation.swarmTreasuryAmount, allocation.publicDistributionAmount,
    allocation.credRewardsRecipient, allocation.swarmTreasuryRecipient, allocation.publicDistributionRecipient,
  ]]));
  const contributionHash = keccak256(coder.encode([CONTRIBUTIONS], [plan.contributions.map((entry) => [entry.agentKey, entry.beneficiary, entry.bps])]));
  const vestingHash = keccak256(coder.encode(['uint256[]'], [plan.vestingAmounts]));
  const revenueHash = keccak256(coder.encode([REVENUE_SHARES], [plan.revenueShares.map((entry) => [entry.payee, entry.bps])]));
  const assetHash = keccak256(coder.encode(['address[]'], [plan.revenueAssets]));
  const signerHash = keccak256(coder.encode(['address[]'], [plan.requiredSigners]));
  return keccak256(coder.encode(
    ['bytes32', 'uint64', 'uint64', 'uint64', 'uint64', 'bytes32', 'bytes32', 'bytes32', 'bytes32', 'bytes32', 'bytes32', 'bytes32', 'bytes32'],
    [plan.readinessHash, plan.start, plan.cliff, plan.duration, plan.authorizationDeadline, plan.deploymentSalt, tokenHash, allocationHash, contributionHash, vestingHash, revenueHash, assetHash, signerHash],
  )).toLowerCase();
}

function predict(factory, plan, contracts, deploymentId) {
  const token = create2(
    factory,
    componentSalt(deploymentId, TAGS.token, 0),
    concat([contracts.FixedSupplySwarmToken.bytecode, coder.encode(
      ['string', 'string', 'uint256', 'address', 'bytes32', 'bytes32'],
      [plan.token.name, plan.token.symbol, plan.token.totalSupply, factory, plan.readinessHash, deploymentId],
    )]),
  );
  const contributionValues = plan.contributions.map((entry) => [entry.agentKey, entry.beneficiary, entry.bps]);
  const revenueValues = plan.revenueShares.map((entry) => [entry.payee, entry.bps]);
  const registry = create2(factory, componentSalt(deploymentId, TAGS.registry, 0), concat([contracts.SwarmContributionRegistry.bytecode, coder.encode(['bytes32', CONTRIBUTIONS], [plan.readinessHash, contributionValues])]));
  const splitter = create2(factory, componentSalt(deploymentId, TAGS.splitter, 0), concat([contracts.PullRevenueSplitter.bytecode, coder.encode(['bytes32', REVENUE_SHARES, 'address[]'], [plan.readinessHash, revenueValues, plan.revenueAssets])]));
  const streams = plan.contributions.map((entry, index) => create2(
    factory,
    componentSalt(deploymentId, TAGS.stream, index),
    concat([contracts.NonTransferableVestingStream.bytecode, coder.encode(['address', 'address', 'uint256', 'uint64', 'uint64', 'uint64', 'bytes32'], [token, entry.beneficiary, plan.vestingAmounts[index], plan.start, plan.cliff, plan.duration, plan.readinessHash])]),
  ));
  return deepFreeze({ token, registry, splitter, streams });
}

function shareOf(amount, bps) {
  return (amount / BigInt(TOTAL_BPS)) * BigInt(bps) + ((amount % BigInt(TOTAL_BPS)) * BigInt(bps)) / BigInt(TOTAL_BPS);
}
function componentSalt(deploymentId, tag, index) { return keccak256(coder.encode(['bytes32', 'bytes32', 'uint256'], [deploymentId, tag, index])); }
function create2(factory, salt, initCode) { return getCreate2Address(factory, salt, keccak256(initCode)).toLowerCase(); }
function bytes32(value, label) { const text = String(value ?? '').toLowerCase(); if (!/^0x[0-9a-f]{64}$/u.test(text)) throw new TypeError(label + ' is invalid.'); return text; }
function hex(value, label) { const text = String(value ?? ''); if (!/^0x(?:[0-9a-fA-F]{2})+$/u.test(text)) throw new TypeError(label + ' is invalid.'); return text.toLowerCase(); }
function address(value, allowZero, label) { let normalized; try { normalized = getAddress(String(value ?? '')).toLowerCase(); } catch { throw new TypeError(label + ' is invalid.'); } if (!allowZero && normalized === ZERO_ADDRESS) throw new TypeError(label + ' is invalid.'); return normalized; }
function integer(value, min, max, label) { if (!Number.isSafeInteger(value) || value < min || value > max) throw new TypeError(label + ' is invalid.'); return value; }
function uintString(value, label) { const text = String(value ?? ''); if (!/^[1-9][0-9]*$/u.test(text)) throw new TypeError(label + ' is invalid.'); return text; }
function bounded(value, min, max, label) { if (typeof value !== 'string' || value.length < min || value.length > max) throw new TypeError(label + ' is invalid.'); return value; }
function deepFreeze(value) { if (Array.isArray(value)) { value.forEach(deepFreeze); return Object.freeze(value); } if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); return Object.freeze(value); } return value; }
