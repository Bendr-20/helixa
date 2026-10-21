import { createHash } from 'node:crypto';

import {
  AbiCoder,
  concat,
  getAddress,
  getCreate2Address,
  id,
  isHexString,
  keccak256,
  Signature,
  TypedDataEncoder,
  verifyTypedData,
} from 'ethers';

import { canonicalSwarmLaunchJson } from '../../types/src/swarm-launch.js';

const SCHEMA = 'multipass.swarm-token-launch-packet.v1';
const READINESS_SCHEMA = 'multipass.swarm-launch-readiness.v1';
const CONSENT_SCHEMA = 'multipass.swarm-launch.v1';
const CONVERSION_SCHEMA = 'multipass.swarm-launch-execution-conversion.v1';
const TIMING_POLICY = 'SOURCE_CONSENT_EXPIRY_PLUS_7D_30D_MONTHS_V1';
const CHAIN_ID = 8453;
const TOTAL_BPS = 10_000;
const MONTH_SECONDS = 2_592_000;
const START_DELAY_SECONDS = 604_800;
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
const TAGS = Object.freeze({ token: id('FIXED_SUPPLY_TOKEN'), registry: id('CONTRIBUTION_REGISTRY'), splitter: id('REVENUE_SPLITTER'), stream: id('VESTING_STREAM') });
const coder = AbiCoder.defaultAbiCoder();

export function buildSwarmLaunchExecutionReadiness(input = {}) {
  exactKeys(input, ['chainId', 'factoryAddress', 'readinessPacketSha256', 'readinessManifest', 'consentManifest', 'conversion', 'artifacts'], 'execution input');
  const chainId = integer(input.chainId, 1, Number.MAX_SAFE_INTEGER, 'chainId');
  if (chainId !== CHAIN_ID) throw new TypeError('Swarm Launch execution chain must be Base (8453).');
  const factoryAddress = address(input.factoryAddress, false, 'factoryAddress');
  const readinessPacketSha256 = bytes32(input.readinessPacketSha256, 'readinessPacketSha256');
  const calculatedReadinessHash = sha256(input.readinessManifest);
  if (calculatedReadinessHash !== readinessPacketSha256) throw new TypeError('Canonical readiness artifact hash does not match.');
  const readiness = normalizeReadiness(input.readinessManifest);
  if (canonicalSwarmLaunchJson(readiness) !== canonicalSwarmLaunchJson(input.readinessManifest)) throw new TypeError('Canonical readiness artifact is not normalized.');
  const consent = normalizeConsentManifest(input.consentManifest);
  if (canonicalSwarmLaunchJson(consent) !== canonicalSwarmLaunchJson(input.consentManifest)) throw new TypeError('Consent manifest is not canonically normalized.');
  if (sha256(input.consentManifest) !== readiness.sourceConsent.manifestSha256) throw new TypeError('Consent manifest lineage hash does not match readiness.');
  assertConsentLineage(consent, readiness);
  const conversion = normalizeConversion(input.conversion, readinessPacketSha256, readiness);
  const plan = normalizePlan(derivePlan(readinessPacketSha256, readiness, consent, conversion), readinessPacketSha256);
  const artifacts = normalizeArtifacts(input.artifacts);
  const deploymentId = computeDeploymentId(plan);
  const predicted = predict(factoryAddress, plan, artifacts.contracts, deploymentId);
  const domain = deepFreeze({ name: 'Helixa Swarm Launch', version: '1', chainId, verifyingContract: factoryAddress });
  const message = deepFreeze({ deploymentId, authorizationDeadline: plan.authorizationDeadline });
  const authorizationDigest = TypedDataEncoder.hash(domain, AUTHORIZATION_TYPES, message).toLowerCase();
  const conversionSha256 = sha256(conversion);

  const manifest = deepFreeze({
    schema: SCHEMA,
    chainId,
    sourceReadiness: {
      schema: readiness.schema,
      sha256: readinessPacketSha256,
      artifact: readiness,
      consentManifest: consent,
    },
    conversion: { schema: conversion.schema, sha256: conversionSha256, artifact: conversion },
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
      categoryAmounts: { agentVesting: plan.allocations.agentVestingAmount, credRewards: plan.allocations.credRewardsAmount, swarmTreasury: plan.allocations.swarmTreasuryAmount, publicDistribution: plan.allocations.publicDistributionAmount },
      recipients: { credRewards: plan.allocations.credRewardsRecipient, swarmTreasury: plan.allocations.swarmTreasuryRecipient, publicDistribution: plan.allocations.publicDistributionRecipient },
    },
    authorization: { scheme: 'EIP712', status: 'NOT_ATTACHED', digest: authorizationDigest, requiredSigners: plan.requiredSigners, signatures: [] },
    execution: { mode: 'PREPARATION_ONLY', deploymentAuthorized: false, broadcastPrepared: false, transactionCount: 0, requiresSeparateApproval: true },
    safety: { keysIncluded: false, signaturesIncluded: false, transactionDataIncluded: false, calldataIncluded: false, secretsIncluded: false, externalAdapterDataIncluded: false, rpcSendMethodsAllowed: false },
  });
  return envelope(manifest, domain, message);
}

export async function attachSwarmLaunchExecutionSignatures(prepared, signatures, options) {
  if (arguments.length > 2 || options !== undefined) throw new TypeError('Signature verifier callbacks are unsupported.');
  const manifest = prepared?.manifest;
  const typedData = prepared?.typedData;
  if (!manifest || manifest.schema !== SCHEMA || manifest.authorization?.status !== 'NOT_ATTACHED' || manifest.execution?.mode !== 'PREPARATION_ONLY') throw new TypeError('Prepared launch packet is invalid.');
  if (!typedData || TypedDataEncoder.hash(typedData.domain, typedData.types, typedData.message).toLowerCase() !== manifest.authorization.digest) throw new TypeError('Execution authorization typed data does not match the packet.');
  if (!Array.isArray(signatures) || signatures.length !== manifest.authorization.requiredSigners.length) throw new TypeError('Every required signer must provide exactly one execution signature.');
  const normalized = [];
  let allEoa = true;
  for (let index = 0; index < signatures.length; index += 1) {
    const requiredSigner = manifest.authorization.requiredSigners[index];
    exactKeys(signatures[index], ['signer', 'signature'], 'signature attachment', ['kind']);
    const signer = address(signatures[index]?.signer, false, 'signature signer');
    const signature = hex(signatures[index]?.signature, 'execution signature');
    const kind = signatures[index]?.kind ?? 'EOA';
    if (signer !== requiredSigner) throw new TypeError('Execution signatures must match required signer order.');
    if (kind === 'EOA') {
      let recovered;
      try {
        const parsed = Signature.from(signature);
        if (!parsed.isValid()) throw new TypeError('high-s');
        recovered = address(verifyTypedData(typedData.domain, typedData.types, typedData.message, signature), false, 'recovered signer');
      } catch { throw new TypeError('EOA execution signature did not verify or is non-canonical.'); }
      if (recovered !== signer) throw new TypeError('EOA execution signature did not verify.');
    } else if (kind === 'ERC1271') {
      allEoa = false;
    } else throw new TypeError('Signature kind is invalid.');
    normalized.push(deepFreeze({ signer, signature, kind }));
  }
  const signedManifest = deepFreeze({
    ...manifest,
    authorization: { ...manifest.authorization, status: allEoa ? 'SIGNATURES_VERIFIED_EOA_OFFLINE' : 'SIGNATURES_ATTACHED_UNVERIFIED', signatures: normalized },
    execution: { ...manifest.execution, mode: allEoa ? 'AUTHORIZED_NO_BROADCAST' : 'SIGNATURES_ATTACHED_NO_BROADCAST', deploymentAuthorized: allEoa },
    safety: { ...manifest.safety, signaturesIncluded: true },
  });
  return envelope(signedManifest, typedData.domain, typedData.message);
}

export function computeSwarmLaunchDeploymentId(plan) { return computeDeploymentId(normalizePlan(plan, bytes32(plan?.readinessHash, 'readinessHash'))); }
export function computeSwarmLaunchPredictions(factoryAddress, plan, artifacts) {
  const normalizedPlan = normalizePlan(plan, bytes32(plan?.readinessHash, 'readinessHash'));
  const normalizedArtifacts = normalizeArtifacts(artifacts);
  const factory = address(factoryAddress, false, 'factoryAddress');
  return predict(factory, normalizedPlan, normalizedArtifacts.contracts, computeDeploymentId(normalizedPlan));
}

function envelope(manifest, domain, message) {
  return deepFreeze({ manifest, manifestSha256: sha256(manifest), typedData: { domain, types: AUTHORIZATION_TYPES, primaryType: 'SwarmLaunchExecution', message } });
}

function normalizeReadiness(value) {
  exactKeys(value, ['schema', 'chainId', 'sourceConsent', 'execution', 'allocations', 'agentVesting', 'credRewards', 'swarmTreasury', 'publicDistribution', 'requiredPrimitives', 'requiredGates'], 'readiness artifact');
  if (value.schema !== READINESS_SCHEMA || value.chainId !== CHAIN_ID) throw new TypeError('Canonical readiness artifact is invalid.');
  exactKeys(value.sourceConsent, ['proposalId', 'manifestSha256', 'expiresAt'], 'readiness sourceConsent');
  const sourceConsent = { proposalId: bounded(value.sourceConsent.proposalId, 1, 128, 'proposalId'), manifestSha256: bytes32(value.sourceConsent.manifestSha256, 'consent manifest hash'), expiresAt: integer(value.sourceConsent.expiresAt, 1, Number.MAX_SAFE_INTEGER, 'consent expiry') };
  exactObject(value.execution, { mode: 'SIMULATION_ONLY', deploymentAuthorized: false, providerSelected: false, onchainTargets: [], transactionCount: 0, requiresSeparateExecutionConsent: true }, 'readiness execution');
  exactKeys(value.allocations, ['agentVestingBps', 'credRewardsBps', 'swarmTreasuryBps', 'publicDistributionBps', 'totalBps'], 'readiness allocations');
  const allocations = {
    agentVestingBps: integer(value.allocations.agentVestingBps, 1, TOTAL_BPS, 'agent vesting bps'),
    credRewardsBps: integer(value.allocations.credRewardsBps, 1, TOTAL_BPS, 'CRED rewards bps'),
    swarmTreasuryBps: integer(value.allocations.swarmTreasuryBps, 1, TOTAL_BPS, 'treasury bps'),
    publicDistributionBps: integer(value.allocations.publicDistributionBps, 1, TOTAL_BPS, 'public distribution bps'),
    totalBps: integer(value.allocations.totalBps, TOTAL_BPS, TOTAL_BPS, 'total bps'),
  };
  if (allocations.agentVestingBps + allocations.credRewardsBps + allocations.swarmTreasuryBps + allocations.publicDistributionBps !== TOTAL_BPS) throw new TypeError('Readiness allocations must total 10,000 bps.');
  exactKeys(value.agentVesting, ['cliffMonths', 'durationMonths', 'allocations'], 'readiness agentVesting');
  const cliffMonths = integer(value.agentVesting.cliffMonths, 0, 24, 'cliff months');
  const durationMonths = integer(value.agentVesting.durationMonths, 1, 48, 'duration months');
  if (cliffMonths > durationMonths) throw new TypeError('Readiness vesting months are invalid.');
  if (!Array.isArray(value.agentVesting.allocations) || value.agentVesting.allocations.length < 3 || value.agentVesting.allocations.length > 5) throw new TypeError('Readiness member allocations are invalid.');
  const memberAllocations = value.agentVesting.allocations.map((entry) => {
    exactKeys(entry, ['tokenId', 'consentAuthority', 'shareBps', 'beneficiaryStatus', 'beneficiaryAddress'], 'readiness member allocation');
    if (entry.beneficiaryStatus !== 'UNRESOLVED' || entry.beneficiaryAddress !== null) throw new TypeError('Readiness beneficiary must remain unresolved.');
    return deepFreeze({ tokenId: uintString(entry.tokenId, 'tokenId'), consentAuthority: address(entry.consentAuthority, false, 'consent authority'), shareBps: integer(entry.shareBps, 1, TOTAL_BPS, 'share bps'), beneficiaryStatus: 'UNRESOLVED', beneficiaryAddress: null });
  });
  if (new Set(memberAllocations.map((entry) => entry.tokenId)).size !== memberAllocations.length || memberAllocations.reduce((sum, entry) => sum + entry.shareBps, 0) !== TOTAL_BPS) throw new TypeError('Readiness member lineage is invalid.');
  exactObject(value.credRewards, { beneficiary: 'CRED_STAKERS', provider: 'UNSELECTED', stakingAsset: 'CRED', targetAddress: null }, 'readiness credRewards');
  exactObject(value.swarmTreasury, { control: 'SWARM_MULTISIG_REQUIRED', address: null }, 'readiness swarmTreasury');
  exactObject(value.publicDistribution, { mechanism: 'UNSELECTED', adapter: null }, 'readiness publicDistribution');
  validatePrimitives(value.requiredPrimitives);
  const gates = ['REVALIDATE_LOOPER_OWNERSHIP', 'REVALIDATE_LOOPER_CONTROLLERS', 'REVALIDATE_CRED', 'SELECT_AND_REVIEW_EXECUTION_PROVIDER', 'RESOLVE_VESTING_BENEFICIARIES', 'SIMULATE_ON_BASE_FORK', 'COLLECT_SEPARATE_EXECUTION_CONSENT'];
  if (canonicalSwarmLaunchJson(value.requiredGates) !== canonicalSwarmLaunchJson(gates)) throw new TypeError('Readiness required gates are invalid.');
  return deepFreeze({ schema: READINESS_SCHEMA, chainId: CHAIN_ID, sourceConsent, execution: value.execution, allocations, agentVesting: { cliffMonths, durationMonths, allocations: memberAllocations }, credRewards: value.credRewards, swarmTreasury: value.swarmTreasury, publicDistribution: value.publicDistribution, requiredPrimitives: value.requiredPrimitives, requiredGates: gates });
}

function validatePrimitives(value) {
  exactKeys(value, ['contributionRegistry', 'agentVesting', 'revenueSplitter', 'swapHook'], 'readiness requiredPrimitives');
  exactObject(value.contributionRegistry, { weights: 'CONSENTED_CONTRIBUTION_BPS', mutable: false, address: null }, 'contribution registry primitive');
  exactObject(value.agentVesting, { implementation: 'AUDITED_EXTERNAL_STREAMS_REQUIRED', transferable: false, addresses: [] }, 'vesting primitive');
  exactObject(value.revenueSplitter, { mode: 'PULL_MULTI_ASSET', weights: 'CONSENTED_CONTRIBUTION_BPS', implementation: 'UNSELECTED', address: null }, 'revenue primitive');
  exactObject(value.swapHook, { required: false, implementation: 'UNSELECTED', address: null }, 'swap primitive');
}

function normalizeConsentManifest(value) {
  exactKeys(value, ['schema', 'chainId', 'identity', 'execution', 'gate', 'app', 'token', 'economics', 'members'], 'consent manifest');
  if (value.schema !== CONSENT_SCHEMA || value.chainId !== CHAIN_ID) throw new TypeError('Consent manifest is invalid.');
  exactKeys(value.identity, ['type', 'chainId', 'registry'], 'consent identity');
  if (value.identity.type !== 'looper_erc721' || value.identity.chainId !== CHAIN_ID) throw new TypeError('Consent identity is invalid.');
  const registry = address(value.identity.registry, false, 'Looper registry');
  exactObject(value.execution, { mode: 'PREPARATION_ONLY', deploymentAuthorized: false, requiresSeparateApproval: true }, 'consent execution');
  exactKeys(value.gate, ['minimumMembers', 'maximumMembers', 'minimumAverageCred', 'observedAverageCred', 'methodologyVersions'], 'consent gate');
  if (value.gate.minimumMembers !== 3 || value.gate.maximumMembers !== 5 || value.gate.minimumAverageCred !== 65 || !Number.isInteger(value.gate.observedAverageCred) || !Array.isArray(value.gate.methodologyVersions)) throw new TypeError('Consent gate is invalid.');
  exactKeys(value.app, ['name', 'pitch', 'template', 'revenueModel', 'shipTarget'], 'consent app');
  exactKeys(value.token, ['name', 'ticker', 'supply', 'supplyUnit', 'decimals', 'curve'], 'consent token');
  if (value.token.supplyUnit !== 'WHOLE_TOKENS' || value.token.decimals !== null || !/^[1-9][0-9]*$/u.test(value.token.supply) || !/^[A-Z][A-Z0-9]{1,9}$/u.test(value.token.ticker)) throw new TypeError('Consent token is invalid.');
  exactKeys(value.economics, ['model', 'agentVesting', 'credRewards', 'swarmTreasury', 'publicDistribution', 'totalAllocationBps'], 'consent economics');
  if (value.economics.model !== 'PROVIDER_NEUTRAL_V1' || value.economics.totalAllocationBps !== TOTAL_BPS) throw new TypeError('Consent economics are invalid.');
  exactKeys(value.economics.agentVesting, ['allocationBps', 'cliffMonths', 'durationMonths'], 'consent agent vesting');
  exactKeys(value.economics.credRewards, ['allocationBps', 'beneficiary', 'provider'], 'consent CRED rewards');
  exactKeys(value.economics.swarmTreasury, ['allocationBps', 'control'], 'consent treasury');
  exactKeys(value.economics.publicDistribution, ['allocationBps', 'mechanism'], 'consent distribution');
  if (value.economics.credRewards.beneficiary !== 'CRED_STAKERS' || value.economics.credRewards.provider !== 'UNSELECTED' || value.economics.swarmTreasury.control !== 'SWARM_MULTISIG_REQUIRED' || value.economics.publicDistribution.mechanism !== 'UNSELECTED') throw new TypeError('Consent economics mechanisms are invalid.');
  const consentBps = value.economics.agentVesting.allocationBps + value.economics.credRewards.allocationBps + value.economics.swarmTreasury.allocationBps + value.economics.publicDistribution.allocationBps;
  if (consentBps !== TOTAL_BPS) throw new TypeError('Consent economics must total 10,000 bps.');
  if (!Array.isArray(value.members) || value.members.length < 3 || value.members.length > 5) throw new TypeError('Consent members are invalid.');
  const members = value.members.map((member) => {
    exactKeys(member, ['identity', 'consentAuthority', 'name', 'role', 'contributionBps', 'cred', 'vault'], 'consent member');
    exactKeys(member.identity, ['type', 'chainId', 'registry', 'tokenId', 'erc8004Id'], 'member identity');
    exactKeys(member.cred, ['status', 'score', 'tier', 'coverage', 'freshness', 'methodologyVersion', 'computedAt'], 'member CRED');
    exactKeys(member.cred.coverage, ['score', 'label'], 'member CRED coverage');
    exactKeys(member.cred.freshness, ['stale'], 'member CRED freshness');
    exactKeys(member.vault, ['status', 'kind', 'address'], 'member vault');
    if (member.vault.status !== 'UNPREPARED' || member.vault.kind !== 'UNSPECIFIED' || member.vault.address !== null) throw new TypeError('Consent member vault is invalid.');
    if (member.identity.type !== 'looper_erc721' || member.identity.chainId !== CHAIN_ID || address(member.identity.registry, false, 'member registry') !== registry) throw new TypeError('Consent member identity is invalid.');
    return { tokenId: uintString(member.identity.tokenId, 'member tokenId'), consentAuthority: address(member.consentAuthority, false, 'member consent authority'), contributionBps: integer(member.contributionBps, 1, TOTAL_BPS, 'member contribution') };
  });
  return deepFreeze({ ...value, identity: { ...value.identity, registry }, members: value.members.map((entry, index) => ({ ...entry, identity: { ...entry.identity, registry }, consentAuthority: members[index].consentAuthority })) });
}

function assertConsentLineage(consent, readiness) {
  const economics = consent.economics;
  const expected = [economics.agentVesting.allocationBps, economics.credRewards.allocationBps, economics.swarmTreasury.allocationBps, economics.publicDistribution.allocationBps];
  const observed = [readiness.allocations.agentVestingBps, readiness.allocations.credRewardsBps, readiness.allocations.swarmTreasuryBps, readiness.allocations.publicDistributionBps];
  if (canonicalSwarmLaunchJson(expected) !== canonicalSwarmLaunchJson(observed) || economics.agentVesting.cliffMonths !== readiness.agentVesting.cliffMonths || economics.agentVesting.durationMonths !== readiness.agentVesting.durationMonths) throw new TypeError('Readiness economics lineage mismatch.');
  if (consent.members.length !== readiness.agentVesting.allocations.length) throw new TypeError('Readiness member lineage mismatch.');
  for (let i = 0; i < consent.members.length; i += 1) {
    const a = consent.members[i]; const b = readiness.agentVesting.allocations[i];
    if (a.identity.tokenId !== b.tokenId || a.consentAuthority !== b.consentAuthority || a.contributionBps !== b.shareBps) throw new TypeError('Readiness consent lineage mismatch.');
  }
}

function normalizeConversion(value, parentHash, readiness) {
  exactKeys(value, ['schema', 'parentReadinessSha256', 'timing', 'deploymentSalt', 'members', 'recipients', 'revenueAssets'], 'execution conversion');
  if (value.schema !== CONVERSION_SCHEMA || bytes32(value.parentReadinessSha256, 'conversion parent hash') !== parentHash) throw new TypeError('Execution conversion parent readiness lineage is invalid.');
  exactKeys(value.timing, ['policy', 'authorizationDeadline', 'start', 'cliff', 'duration'], 'conversion timing');
  const authorizationDeadline = onchainTimestamp(readiness.sourceConsent.expiresAt);
  const expectedTiming = { policy: TIMING_POLICY, authorizationDeadline, start: authorizationDeadline + START_DELAY_SECONDS, cliff: readiness.agentVesting.cliffMonths * MONTH_SECONDS, duration: readiness.agentVesting.durationMonths * MONTH_SECONDS };
  if (canonicalSwarmLaunchJson(value.timing) !== canonicalSwarmLaunchJson(expectedTiming)) throw new TypeError('Execution conversion timing does not match the reviewed deterministic policy.');
  if (!Array.isArray(value.members) || value.members.length !== readiness.agentVesting.allocations.length) throw new TypeError('Conversion member resolutions are invalid.');
  const members = value.members.map((entry, i) => {
    exactKeys(entry, ['tokenId', 'beneficiary'], 'conversion member');
    const tokenId = uintString(entry.tokenId, 'conversion tokenId');
    if (tokenId !== readiness.agentVesting.allocations[i].tokenId) throw new TypeError('Conversion member lineage mismatch.');
    return deepFreeze({ tokenId, beneficiary: address(entry.beneficiary, false, 'conversion beneficiary') });
  });
  exactKeys(value.recipients, ['credRewards', 'swarmTreasury', 'publicDistribution'], 'conversion recipients');
  const recipients = {};
  for (const field of ['credRewards', 'swarmTreasury', 'publicDistribution']) {
    exactKeys(value.recipients[field], ['mechanism', 'recipient'], field + ' recipient');
    if (value.recipients[field].mechanism !== 'DIRECT_FIXED_RECIPIENT') throw new TypeError(field + ' mechanism must be DIRECT_FIXED_RECIPIENT.');
    recipients[field] = deepFreeze({ mechanism: 'DIRECT_FIXED_RECIPIENT', recipient: address(value.recipients[field].recipient, false, field + ' recipient') });
  }
  if (new Set(Object.values(recipients).map((entry) => entry.recipient)).size !== 3) throw new TypeError('Conversion recipients must be distinct.');
  if (!Array.isArray(value.revenueAssets) || value.revenueAssets.length < 1 || value.revenueAssets.length > 8) throw new TypeError('Conversion revenue assets are invalid.');
  const revenueAssets = value.revenueAssets.map((entry) => address(entry, true, 'conversion revenue asset'));
  if (new Set(revenueAssets).size !== revenueAssets.length) throw new TypeError('Conversion revenue assets must be unique.');
  return deepFreeze({ schema: CONVERSION_SCHEMA, parentReadinessSha256: parentHash, timing: expectedTiming, deploymentSalt: bytes32(value.deploymentSalt, 'deploymentSalt'), members, recipients, revenueAssets });
}

function derivePlan(parentHash, readiness, consent, conversion) {
  const totalSupply = (BigInt(consent.token.supply) * 10n ** 18n).toString();
  const bps = readiness.allocations;
  const agent = shareOf(BigInt(totalSupply), bps.agentVestingBps);
  const cred = shareOf(BigInt(totalSupply), bps.credRewardsBps);
  const treasury = shareOf(BigInt(totalSupply), bps.swarmTreasuryBps);
  const distribution = BigInt(totalSupply) - agent - cred - treasury;
  const byToken = new Map(conversion.members.map((entry) => [entry.tokenId, entry.beneficiary]));
  const combined = readiness.agentVesting.allocations.map((entry) => ({
    agentKey: keccak256(coder.encode(['uint256', 'address', 'uint256'], [CHAIN_ID, consent.identity.registry, entry.tokenId])),
    beneficiary: byToken.get(entry.tokenId), bps: entry.shareBps, signer: entry.consentAuthority,
  })).sort((a, b) => BigInt(a.signer) < BigInt(b.signer) ? -1 : 1);
  if (new Set(combined.map((entry) => entry.signer)).size !== combined.length) throw new TypeError('Consent authorities must be unique for unanimous execution.');
  let allocated = 0n;
  const vestingAmounts = combined.map((entry, index) => {
    const amount = index + 1 === combined.length ? agent - allocated : shareOf(agent, entry.bps);
    allocated += amount;
    return amount.toString();
  });
  return {
    readinessHash: parentHash, start: conversion.timing.start, cliff: conversion.timing.cliff, duration: conversion.timing.duration, authorizationDeadline: conversion.timing.authorizationDeadline, deploymentSalt: conversion.deploymentSalt,
    token: { name: consent.token.name, symbol: consent.token.ticker, decimals: 18, totalSupply },
    allocations: { agentVestingBps: bps.agentVestingBps, credRewardsBps: bps.credRewardsBps, swarmTreasuryBps: bps.swarmTreasuryBps, publicDistributionBps: bps.publicDistributionBps, agentVestingAmount: agent.toString(), credRewardsAmount: cred.toString(), swarmTreasuryAmount: treasury.toString(), publicDistributionAmount: distribution.toString(), credRewardsRecipient: conversion.recipients.credRewards.recipient, swarmTreasuryRecipient: conversion.recipients.swarmTreasury.recipient, publicDistributionRecipient: conversion.recipients.publicDistribution.recipient },
    contributions: combined.map(({ agentKey, beneficiary, bps: contributionBps }) => ({ agentKey, beneficiary, bps: contributionBps })),
    vestingAmounts,
    revenueShares: combined.map((entry) => ({ payee: entry.beneficiary, bps: entry.bps })),
    revenueAssets: conversion.revenueAssets,
    requiredSigners: combined.map((entry) => entry.signer),
  };
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
function onchainTimestamp(value) { return value > 10_000_000_000 ? Math.floor(value / 1000) : value; }
function uintString(value, label) { const text = String(value ?? ''); if (!/^[1-9][0-9]*$/u.test(text)) throw new TypeError(label + ' is invalid.'); return text; }
function bounded(value, min, max, label) { if (typeof value !== 'string' || value.length < min || value.length > max) throw new TypeError(label + ' is invalid.'); return value; }

function sha256(value) { return '0x' + createHash('sha256').update(canonicalSwarmLaunchJson(value)).digest('hex'); }
function exactKeys(value, keys, label, optional = []) { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(label + ' is invalid.'); const allowed = new Set([...keys, ...optional]); for (const key of Object.keys(value)) if (!allowed.has(key)) throw new TypeError(label + ' contains unknown key: ' + key + '.'); for (const key of keys) if (!Object.hasOwn(value, key)) throw new TypeError(label + ' is missing key: ' + key + '.'); }
function exactObject(value, expected, label) { exactKeys(value, Object.keys(expected), label); if (canonicalSwarmLaunchJson(value) !== canonicalSwarmLaunchJson(expected)) throw new TypeError(label + ' is invalid.'); }

function deepFreeze(value) { if (Array.isArray(value)) { value.forEach(deepFreeze); return Object.freeze(value); } if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); return Object.freeze(value); } return value; }
