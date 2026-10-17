#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ethers } from 'ethers';
import ganache from 'ganache';

import { compileMissionContracts } from './compile-mission-escrow.js';

const CHAIN_ID = 84_532;
const CONFIRMATIONS = 12;
const MINIMUM_DELAY_SECONDS = 86_400;
const PRIORITY_FEE_WEI = 1_000_000n;
const VERSION_ID = ethers.id('swarm-command-mission-escrow-v1');
const DEPLOYER = ethers.getAddress('0x339559A2d1CD15059365FC7bD36b3047BbA480E0');
const ADMIN_OWNER = ethers.getAddress('0x709D8d528D2c0C8A408107E74b38a01Fa14e44aE');
const EMERGENCY_COUNCIL = ethers.getAddress('0xD31fCdb0432D3C9BF9d98643F69C7edd690E48E8');
const SAFE_SINGLETON = ethers.getAddress('0x29fcB43b46531BcA003ddC8FCB67FFE91900C762');
const SAFE_PROXY_FACTORY = ethers.getAddress('0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67');
const SAFE_SALT_NONCE = BigInt(ethers.id('swarm-command-base-sepolia-safe-v1'));
const RPC_ORIGINS = Object.freeze([
  Object.freeze({ name: 'base-official', url: 'https://sepolia.base.org' }),
  Object.freeze({ name: 'publicnode', url: 'https://base-sepolia-rpc.publicnode.com' }),
]);
const SAFE_PROXY_FACTORY_ABI = [
  'function proxyCreationCode() view returns (bytes)',
  'function createProxyWithNonce(address singleton, bytes initializer, uint256 saltNonce) returns (address proxy)',
];
const SAFE_ABI = [
  'function setup(address[] owners,uint256 threshold,address to,bytes data,address fallbackHandler,address paymentToken,uint256 payment,address payable paymentReceiver)',
  'function getOwners() view returns (address[])',
  'function getThreshold() view returns (uint256)',
  'function nonce() view returns (uint256)',
  'function VERSION() view returns (string)',
  'function approveHash(bytes32 hashToApprove)',
  'function getTransactionHash(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 nonce) view returns (bytes32)',
  'function execTransaction(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address payable refundReceiver,bytes signatures) returns (bool success)',
];
const SAFE_TX_TYPEHASH = ethers.id('SafeTx(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 nonce)');
const DOMAIN_TYPEHASH = ethers.id('EIP712Domain(uint256 chainId,address verifyingContract)');
const TEST_TOKENS = Object.freeze([
  Object.freeze({ name: 'Swarm Test USDC', symbol: 'mUSDC', decimals: 6 }),
  Object.freeze({ name: 'Swarm Test CRED', symbol: 'mCRED', decimals: 18 }),
]);

export async function prepareLiveDeploymentPlan({ anchorNumber = null } = {}) {
  const mission = await compileMissionContracts();
  const consensus = await readConsensus(anchorNumber);
  const plan = await buildPlan({ mission, consensus });
  const plannedAddressPrestate = await verifyPlannedAddressesVacant(consensus.anchor.numberHex, plan);
  const simulation = await simulatePlan({ mission, consensus, plan });
  const artifact = Object.freeze({
    schemaVersion: 1,
    status: 'live_no_broadcast_simulation_passed',
    executionEnvironment: 'patched-ganache-fork-of-pinned-base-sepolia-state',
    externalBroadcast: false,
    broadcastApprovalGranted: false,
    network: 'base-sepolia',
    chainId: CHAIN_ID,
    generatedAt: new Date(consensus.anchor.timestamp * 1_000).toISOString(),
    compilerVersion: mission.compilerVersion,
    compilerLongVersion: mission.compilerLongVersion,
    sourceHash: mission.sourceHash,
    rpcConsensus: consensus.public,
    deployer: plan.deployer,
    authority: plan.authority,
    emergencyCouncil: EMERGENCY_COUNCIL,
    plannedAddressPrestate,
    tokens: simulation.tokens,
    registry: simulation.registry,
    factory: simulation.factory,
    version: simulation.version,
    deployerTransactions: plan.deployerTransactions,
    safeTransactions: simulation.safeTransactions,
    simulation: simulation.summary,
    liveReadiness: Object.freeze({
      status: 'approval_required',
      validUntil: new Date(plan.validUntil * 1_000).toISOString(),
      blockers: Object.freeze([
        'separate explicit approval before any transaction is signed or broadcast',
        'refresh dual-RPC nonce, balance, block, and fee evidence immediately before broadcast',
        'activation can execute only after the proposed registry timelock',
      ]),
    }),
  });
  validateLiveDeploymentPlan(artifact);
  return artifact;
}

async function buildPlan({ mission, consensus }) {
  const owners = [DEPLOYER, ADMIN_OWNER].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const safeInterface = new ethers.Interface(SAFE_ABI);
  const proxyFactoryInterface = new ethers.Interface(SAFE_PROXY_FACTORY_ABI);
  const initializer = safeInterface.encodeFunctionData('setup', [owners, 2, ethers.ZeroAddress, '0x', ethers.ZeroAddress, ethers.ZeroAddress, 0, ethers.ZeroAddress]);
  const proxyDeploymentCode = ethers.concat([consensus.proxyCreationCode, ethers.zeroPadValue(SAFE_SINGLETON, 32)]);
  const salt = ethers.keccak256(ethers.solidityPacked(['bytes32', 'uint256'], [ethers.keccak256(initializer), SAFE_SALT_NONCE]));
  const safeAddress = ethers.getCreate2Address(SAFE_PROXY_FACTORY, salt, ethers.keccak256(proxyDeploymentCode));
  const startNonce = consensus.deployer.nonce;
  const tokenAddresses = TEST_TOKENS.map((_, index) => ethers.getCreateAddress({ from: DEPLOYER, nonce: startNonce + 1 + index }));
  const registryAddress = ethers.getCreateAddress({ from: DEPLOYER, nonce: startNonce + 3 });
  const factoryAddress = ethers.getCreateAddress({ from: DEPLOYER, nonce: startNonce + 4 });
  const maxPriorityFeePerGas = PRIORITY_FEE_WEI;
  const maxFeePerGas = consensus.anchor.baseFeePerGas * 2n + maxPriorityFeePerGas;
  const common = { chainId: CHAIN_ID, transactionType: 2, value: '0', maxFeePerGas: maxFeePerGas.toString(), maxPriorityFeePerGas: maxPriorityFeePerGas.toString(), authorization: 'not-collected' };
  const requests = [];
  requests.push({
    operation: 'safe.deploy-proxy-2-of-2',
    to: SAFE_PROXY_FACTORY,
    data: proxyFactoryInterface.encodeFunctionData('createProxyWithNonce', [SAFE_SINGLETON, initializer, SAFE_SALT_NONCE]),
    gasLimit: '800000',
    expectedAddress: safeAddress,
  });
  for (let index = 0; index < TEST_TOKENS.length; index += 1) {
    const input = TEST_TOKENS[index];
    const tokenFactory = new ethers.ContractFactory(mission.contracts.MissionTestToken.abi, mission.contracts.MissionTestToken.bytecode);
    const request = await tokenFactory.getDeployTransaction(input.name, input.symbol, input.decimals, DEPLOYER);
    requests.push({ operation: 'token.deploy.' + input.symbol, to: null, data: request.data, gasLimit: '1800000', expectedAddress: tokenAddresses[index] });
  }
  const registryFactory = new ethers.ContractFactory(mission.contracts.VersionRegistry.abi, mission.contracts.VersionRegistry.bytecode);
  const registryRequest = await registryFactory.getDeployTransaction(safeAddress, EMERGENCY_COUNCIL, MINIMUM_DELAY_SECONDS);
  requests.push({ operation: 'registry.deploy', to: null, data: registryRequest.data, gasLimit: '3000000', expectedAddress: registryAddress });
  const escrowFactory = new ethers.ContractFactory(mission.contracts.MissionEscrowFactory.abi, mission.contracts.MissionEscrowFactory.bytecode);
  const factoryRequest = await escrowFactory.getDeployTransaction(registryAddress);
  requests.push({ operation: 'factory.deploy', to: null, data: factoryRequest.data, gasLimit: '5000000', expectedAddress: factoryAddress });
  const deployerTransactions = Object.freeze(requests.map((request, index) => Object.freeze({
    ...common,
    ...request,
    from: DEPLOYER,
    nonce: startNonce + index,
    dataHash: ethers.keccak256(request.data),
  })));
  const activateAfter = consensus.anchor.timestamp + 2 * MINIMUM_DELAY_SECONDS;
  return Object.freeze({
    deployer: Object.freeze({ address: DEPLOYER, nonce: startNonce, pendingNonce: consensus.deployer.pendingNonce, balanceWei: consensus.deployer.balanceWei, code: consensus.deployer.code }),
    authority: Object.freeze({ kind: 'safe-2-of-2', address: safeAddress, singleton: SAFE_SINGLETON, proxyFactory: SAFE_PROXY_FACTORY, owners: Object.freeze([DEPLOYER, ADMIN_OWNER]), threshold: 2, saltNonce: SAFE_SALT_NONCE.toString(), liveAtAnchor: false, canonicalSafeVersion: '1.4.1', pinnedForkDeploymentVerified: true }),
    tokenAddresses: Object.freeze(tokenAddresses),
    registryAddress,
    factoryAddress,
    activateAfter,
    validUntil: activateAfter - MINIMUM_DELAY_SECONDS,
    deployerTransactions,
  });
}

async function simulatePlan({ mission, consensus, plan }) {
  const upstream = patchedUpstream(RPC_ORIGINS[1].url);
  const unlocked = [DEPLOYER, ADMIN_OWNER, EMERGENCY_COUNCIL];
  const eip1193 = ganache.provider({
    fork: { provider: upstream, blockNumber: consensus.anchor.number },
    chain: { chainId: CHAIN_ID, hardfork: 'shanghai', time: new Date(consensus.anchor.timestamp * 1_000) },
    wallet: { unlockedAccounts: unlocked },
    logging: { quiet: true },
  });
  const provider = new ethers.BrowserProvider(eip1193);
  try {
    for (const address of unlocked) await provider.send('evm_setAccountBalance', [address, '0x3635c9adc5dea00000']);
    const deployer = await provider.getSigner(DEPLOYER);
    const admin = await provider.getSigner(ADMIN_OWNER);
    for (const item of plan.deployerTransactions) {
      const tx = await deployer.sendTransaction({
        chainId: item.chainId,
        type: item.transactionType,
        to: item.to,
        nonce: item.nonce,
        value: BigInt(item.value),
        data: item.data,
        gasLimit: BigInt(item.gasLimit),
        maxFeePerGas: BigInt(item.maxFeePerGas),
        maxPriorityFeePerGas: BigInt(item.maxPriorityFeePerGas),
      });
      const receipt = await tx.wait();
      if (receipt.status !== 1) throw new Error(item.operation + ' failed in pinned fork.');
      if (item.to === null && ethers.getAddress(receipt.contractAddress) !== item.expectedAddress) throw new Error(item.operation + ' address mismatch.');
    }

    const safe = new ethers.Contract(plan.authority.address, SAFE_ABI, provider);
    const observedOwners = await safe.getOwners();
    assertAddressList(observedOwners, [DEPLOYER, ADMIN_OWNER], 'Safe owners');
    assertEqual(await safe.getThreshold(), 2n, 'Safe threshold');
    assertEqual(await safe.nonce(), 0n, 'Safe initial nonce');
    assertEqual(await safe.VERSION(), '1.4.1', 'Safe version');
    const implementationWord = await provider.send('eth_getStorageAt', [plan.authority.address, '0x0', 'latest']);
    assertEqual(ethers.getAddress('0x' + implementationWord.slice(-40)), SAFE_SINGLETON, 'Safe singleton slot');

    const tokenResults = [];
    for (let index = 0; index < TEST_TOKENS.length; index += 1) {
      const address = plan.tokenAddresses[index];
      const input = TEST_TOKENS[index];
      const token = new ethers.Contract(address, mission.contracts.MissionTestToken.abi, provider);
      assertEqual(await token.name(), input.name, input.symbol + ' name');
      assertEqual(await token.symbol(), input.symbol, input.symbol + ' symbol');
      assertEqual(await token.decimals(), BigInt(input.decimals), input.symbol + ' decimals');
      assertEqual(await token.issuer(), DEPLOYER, input.symbol + ' issuer');
      tokenResults.push(Object.freeze({ kind: 'isolated-testnet-mock', address, name: input.name, symbol: input.symbol, decimals: input.decimals, issuer: DEPLOYER, runtimeCodeHash: await codeHash(provider, address) }));
    }

    const registry = new ethers.Contract(plan.registryAddress, mission.contracts.VersionRegistry.abi, provider);
    const factory = new ethers.Contract(plan.factoryAddress, mission.contracts.MissionEscrowFactory.abi, provider);
    assertEqual(await registry.governance(), plan.authority.address, 'registry governance');
    assertEqual(await registry.emergencyCouncil(), EMERGENCY_COUNCIL, 'registry emergency council');
    assertEqual(await registry.minimumDelay(), BigInt(MINIMUM_DELAY_SECONDS), 'registry minimum delay');
    assertEqual(await factory.registry(), plan.registryAddress, 'factory registry');
    assertEqual(await factory.FACTORY_COMPATIBILITY(), 1n, 'factory compatibility');

    const vaultCreationCodeHash = ethers.keccak256(mission.contracts.MissionEscrowV1.bytecode);
    const vaultRuntimeCodeHash = ethers.keccak256(mission.contracts.MissionEscrowV1.deployedBytecode);
    const proposalData = registry.interface.encodeFunctionData('proposeVersion', [VERSION_ID, vaultCreationCodeHash, vaultRuntimeCodeHash, plan.tokenAddresses, 2, plan.activateAfter, 0, 1]);
    const activationData = registry.interface.encodeFunctionData('activateVersion', [VERSION_ID]);
    const proposal = await buildSafeAction(safe, plan.authority.address, plan.registryAddress, proposalData, 0);
    await executeSafeAction({ safe, action: proposal, deployer, admin });
    const pendingVersion = await registry.getVersion(VERSION_ID);
    assertEqual(pendingVersion.status, 0n, 'pending version');
    const activation = await buildSafeAction(safe, plan.authority.address, plan.registryAddress, activationData, 1);
    await approveSafeHash(safe, admin, activation.safeTxHash);
    let earlyActivationRejected = false;
    try {
      await executeApprovedSafeAction({ safe, action: activation, deployer });
    } catch {
      earlyActivationRejected = true;
    }
    if (!earlyActivationRejected) throw new Error('Safe activation unexpectedly succeeded before timelock.');
    assertEqual(await safe.nonce(), 1n, 'Safe nonce after rejected activation');
    await provider.send('evm_setTime', [(plan.activateAfter + 1) * 1_000]);
    await provider.send('evm_mine', []);
    await executeApprovedSafeAction({ safe, action: activation, deployer });
    const version = await registry.getVersion(VERSION_ID);
    assertEqual(version.status, 1n, 'active version');
    assertEqual(version.creationCodeHash, vaultCreationCodeHash, 'version creation code hash');
    assertEqual(version.runtimeCodeHash, vaultRuntimeCodeHash, 'version runtime code hash');
    assertAddressList(version.supportedTokens.slice(0, 2), plan.tokenAddresses, 'version tokens');

    return Object.freeze({
      tokens: Object.freeze(tokenResults),
      registry: Object.freeze({ address: plan.registryAddress, governance: plan.authority.address, emergencyCouncil: EMERGENCY_COUNCIL, minimumDelaySeconds: MINIMUM_DELAY_SECONDS, runtimeCodeHash: await codeHash(provider, plan.registryAddress) }),
      factory: Object.freeze({ address: plan.factoryAddress, registry: plan.registryAddress, compatibility: 1, runtimeCodeHash: await codeHash(provider, plan.factoryAddress) }),
      version: Object.freeze({ id: VERSION_ID, status: 'active-after-delay', activateAfter: plan.activateAfter, supportedTokens: plan.tokenAddresses, factoryCompatibility: 1, creationCodeHash: vaultCreationCodeHash, runtimeCodeHash: vaultRuntimeCodeHash }),
      safeTransactions: Object.freeze([proposal, activation]),
      summary: Object.freeze({ pinnedFork: true, allDeployerTransactionsSucceeded: true, safeImplementationVerified: true, safeOwnersThresholdNonceVerified: true, earlyActivationRejected, activationSucceededAfterDelay: true, finalSafeNonce: 2, externalBroadcast: false }),
    });
  } finally {
    await eip1193.disconnect?.();
  }
}

async function buildSafeAction(safe, safeAddress, to, data, nonce) {
  const fields = Object.freeze({ to, value: '0', data, operationCode: 0, safeTxGas: '0', baseGas: '0', gasPrice: '0', gasToken: ethers.ZeroAddress, refundReceiver: ethers.ZeroAddress, nonce });
  const safeTxHash = await safe.getTransactionHash(to, 0, data, 0, 0, 0, 0, ethers.ZeroAddress, ethers.ZeroAddress, nonce);
  const computed = computeSafeTransactionHash(CHAIN_ID, safeAddress, fields);
  assertEqual(safeTxHash, computed, 'Safe transaction hash');
  return Object.freeze({ ...fields, operation: 'CALL', safe: safeAddress, safeTxHash, dataHash: ethers.keccak256(data), authorization: 'owners-2-of-2-not-collected' });
}

async function executeSafeAction({ safe, action, deployer, admin }) {
  await approveSafeHash(safe, admin, action.safeTxHash);
  await executeApprovedSafeAction({ safe, action, deployer });
}

async function approveSafeHash(safe, admin, hash) {
  const tx = await safe.connect(admin).approveHash(hash, { gasLimit: 200_000 });
  const receipt = await tx.wait();
  if (receipt.status !== 1) throw new Error('Safe hash approval failed in pinned fork.');
}

async function executeApprovedSafeAction({ safe, action, deployer }) {
  const signatures = prevalidatedSafeAuthorizations([DEPLOYER, ADMIN_OWNER]);
  const tx = await safe.connect(deployer).execTransaction(
    action.to, 0, action.data, action.operationCode, 0, 0, 0, ethers.ZeroAddress, ethers.ZeroAddress, signatures,
    { gasLimit: 4_000_000 },
  );
  const receipt = await tx.wait();
  if (receipt.status !== 1) throw new Error('Safe action failed in pinned fork.');
}

function prevalidatedSafeAuthorizations(owners) {
  return ethers.concat([...owners].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())).map((owner) => ethers.concat([ethers.zeroPadValue(owner, 32), ethers.ZeroHash, '0x01'])));
}

export function computeSafeTransactionHash(chainId, safe, tx) {
  const domainSeparator = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['bytes32', 'uint256', 'address'], [DOMAIN_TYPEHASH, chainId, safe]));
  const structHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
    ['bytes32', 'address', 'uint256', 'bytes32', 'uint8', 'uint256', 'uint256', 'uint256', 'address', 'address', 'uint256'],
    [SAFE_TX_TYPEHASH, tx.to, tx.value, ethers.keccak256(tx.data), tx.operationCode, tx.safeTxGas, tx.baseGas, tx.gasPrice, tx.gasToken, tx.refundReceiver, tx.nonce],
  ));
  return ethers.keccak256(ethers.concat(['0x1901', domainSeparator, structHash]));
}

async function readConsensus(requestedAnchor) {
  const clients = RPC_ORIGINS.map((origin) => ({ origin, request: rpcClient(origin.url) }));
  const chains = await Promise.all(clients.map(({ request }) => request('eth_chainId', [])));
  if (chains.some((value) => Number(BigInt(value)) !== CHAIN_ID)) throw new Error('Base Sepolia RPC chain ID disagreement.');
  const heads = await Promise.all(clients.map(({ request }) => request('eth_blockNumber', []))).then((values) => values.map((value) => Number(BigInt(value))));
  if (Math.max(...heads) - Math.min(...heads) > 6) throw new Error('Base Sepolia RPC heads differ by more than six blocks.');
  const anchorNumber = requestedAnchor ?? Math.min(...heads) - CONFIRMATIONS;
  if (!Number.isSafeInteger(anchorNumber) || anchorNumber <= 0 || anchorNumber > Math.min(...heads) - CONFIRMATIONS) throw new Error('Base Sepolia anchor lacks required confirmation depth.');
  const anchorHex = ethers.toQuantity(anchorNumber);
  const [blocks, deployerCodes, deployerNonces, pendingNonces, balances, singletonCodes, factoryCodes, versions, proxyCodes] = await Promise.all([
    Promise.all(clients.map(({ request }) => request('eth_getBlockByNumber', [anchorHex, false]))),
    readAll(clients, 'eth_getCode', [DEPLOYER, anchorHex]),
    readAll(clients, 'eth_getTransactionCount', [DEPLOYER, anchorHex]),
    readAll(clients, 'eth_getTransactionCount', [DEPLOYER, 'pending']),
    readAll(clients, 'eth_getBalance', [DEPLOYER, anchorHex]),
    readAll(clients, 'eth_getCode', [SAFE_SINGLETON, anchorHex]),
    readAll(clients, 'eth_getCode', [SAFE_PROXY_FACTORY, anchorHex]),
    readAll(clients, 'eth_call', [{ to: SAFE_SINGLETON, data: new ethers.Interface(SAFE_ABI).encodeFunctionData('VERSION') }, anchorHex]),
    readAll(clients, 'eth_call', [{ to: SAFE_PROXY_FACTORY, data: new ethers.Interface(SAFE_PROXY_FACTORY_ABI).encodeFunctionData('proxyCreationCode') }, anchorHex]),
  ]);
  const agreedFields = ['number', 'hash', 'parentHash', 'stateRoot', 'transactionsRoot', 'receiptsRoot', 'timestamp', 'baseFeePerGas'];
  for (const field of agreedFields) assertAllEqual(blocks.map((block) => block[field]), 'anchor ' + field);
  for (const [values, label] of [[deployerCodes, 'deployer code'], [deployerNonces, 'deployer nonce'], [pendingNonces, 'pending nonce'], [balances, 'deployer balance'], [singletonCodes, 'Safe singleton code'], [factoryCodes, 'Safe factory code'], [versions, 'Safe version'], [proxyCodes, 'Safe proxy creation code']]) assertAllEqual(values, label);
  if (deployerCodes[0] !== '0x') throw new Error('Approved deployer is not an EOA.');
  if (Number(BigInt(deployerNonces[0])) !== Number(BigInt(pendingNonces[0]))) throw new Error('Approved deployer has pending transactions.');
  if (singletonCodes[0] === '0x' || factoryCodes[0] === '0x') throw new Error('Canonical Safe infrastructure is missing.');
  const safeVersion = new ethers.Interface(SAFE_ABI).decodeFunctionResult('VERSION', versions[0])[0];
  if (safeVersion !== '1.4.1') throw new Error('Unexpected Safe singleton version: ' + safeVersion);
  const proxyCreationCode = new ethers.Interface(SAFE_PROXY_FACTORY_ABI).decodeFunctionResult('proxyCreationCode', proxyCodes[0])[0];
  const anchor = Object.freeze({ number: anchorNumber, numberHex: anchorHex, hash: blocks[0].hash, parentHash: blocks[0].parentHash, stateRoot: blocks[0].stateRoot, transactionsRoot: blocks[0].transactionsRoot, receiptsRoot: blocks[0].receiptsRoot, timestamp: Number(BigInt(blocks[0].timestamp)), baseFeePerGas: BigInt(blocks[0].baseFeePerGas) });
  const deployer = Object.freeze({ code: deployerCodes[0], nonce: Number(BigInt(deployerNonces[0])), pendingNonce: Number(BigInt(pendingNonces[0])), balanceWei: BigInt(balances[0]).toString() });
  return Object.freeze({
    anchor,
    deployer,
    proxyCreationCode,
    public: Object.freeze({
      agreed: true,
      origins: Object.freeze(clients.map(({ origin }) => Object.freeze({ name: origin.name, url: origin.url, chainId: CHAIN_ID }))),
      anchor: Object.freeze({ ...anchor, baseFeePerGas: anchor.baseFeePerGas.toString() }),
      deployer,
      safeInfrastructure: Object.freeze({ singleton: SAFE_SINGLETON, singletonVersion: safeVersion, singletonCodeBytes: byteLength(singletonCodes[0]), singletonCodeSha256: sha256Hex(singletonCodes[0]), proxyFactory: SAFE_PROXY_FACTORY, proxyFactoryCodeBytes: byteLength(factoryCodes[0]), proxyFactoryCodeSha256: sha256Hex(factoryCodes[0]), proxyCreationCodeHash: ethers.keccak256(proxyCreationCode) }),
    }),
  });
}

async function readAll(clients, method, params) {
  return Promise.all(clients.map(({ request }) => request(method, params)));
}

async function verifyPlannedAddressesVacant(anchorHex, plan) {
  const entries = [
    ['safe', plan.authority.address],
    ['mUSDC', plan.tokenAddresses[0]],
    ['mCRED', plan.tokenAddresses[1]],
    ['registry', plan.registryAddress],
    ['factory', plan.factoryAddress],
  ];
  const clients = RPC_ORIGINS.map((origin) => ({ origin, request: rpcClient(origin.url) }));
  const checked = [];
  for (const [role, address] of entries) {
    const codes = await readAll(clients, 'eth_getCode', [address, anchorHex]);
    assertAllEqual(codes, role + ' planned-address code');
    if (codes[0] !== '0x') throw new Error(role + ' planned address is already occupied.');
    checked.push(Object.freeze({ role, address, codeAtAnchor: '0x' }));
  }
  return Object.freeze(checked);
}

function rpcClient(url) {
  let id = 0;
  return async (method, params) => {
    const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }), signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(url + ' returned HTTP ' + response.status + '.');
    const body = await response.json();
    if (body.error) throw new Error(url + ' ' + method + ' failed: ' + body.error.message);
    return body.result;
  };
}

function patchedUpstream(url) {
  const request = rpcClient(url);
  return { async request({ method, params }) {
    const result = await request(method, params);
    if (method === 'eth_getBlockByNumber' && params[1] === true && result?.transactions) {
      for (const transaction of result.transactions) if (transaction.nonce == null) transaction.nonce = '0x0';
    }
    return result;
  } };
}

export function validateLiveDeploymentPlan(plan) {
  if (!plan || plan.schemaVersion !== 1 || plan.status !== 'live_no_broadcast_simulation_passed') throw new Error('Invalid live plan status.');
  if (plan.externalBroadcast !== false || plan.broadcastApprovalGranted !== false) throw new Error('Live plan must remain no-broadcast and unapproved.');
  if (plan.chainId !== CHAIN_ID || plan.network !== 'base-sepolia') throw new Error('Live plan chain mismatch.');
  if (plan.rpcConsensus?.agreed !== true || plan.rpcConsensus.origins?.length !== 2) throw new Error('Dual-RPC consensus missing.');
  if (plan.authority?.kind !== 'safe-2-of-2' || plan.authority.threshold !== 2 || plan.authority.address === ethers.ZeroAddress || plan.authority.liveAtAnchor !== false || plan.authority.pinnedForkDeploymentVerified !== true) throw new Error('Canonical planned Safe evidence missing.');
  assertAddressList(plan.authority.owners, [DEPLOYER, ADMIN_OWNER], 'plan Safe owners');
  assertEqual(plan.emergencyCouncil, EMERGENCY_COUNCIL, 'plan emergency council');
  if (!Array.isArray(plan.plannedAddressPrestate) || plan.plannedAddressPrestate.length !== 5 || plan.plannedAddressPrestate.some(({ codeAtAnchor }) => codeAtAnchor !== '0x')) throw new Error('Planned address vacancy evidence missing.');
  if (!Array.isArray(plan.deployerTransactions) || plan.deployerTransactions.length !== 5) throw new Error('Expected five deployer transactions.');
  plan.deployerTransactions.forEach((tx, index) => {
    if (tx.chainId !== CHAIN_ID || tx.transactionType !== 2 || tx.from !== DEPLOYER || tx.nonce !== plan.deployer.nonce + index || tx.authorization !== 'not-collected') throw new Error('Invalid deployer transaction ' + index + '.');
    if (ethers.keccak256(tx.data) !== tx.dataHash) throw new Error('Deployer transaction data hash mismatch.');
  });
  if (!Array.isArray(plan.safeTransactions) || plan.safeTransactions.length !== 2) throw new Error('Expected two Safe transactions.');
  plan.safeTransactions.forEach((tx, index) => {
    if (tx.safe !== plan.authority.address || tx.nonce !== index || tx.authorization !== 'owners-2-of-2-not-collected') throw new Error('Invalid Safe transaction ' + index + '.');
    if (computeSafeTransactionHash(CHAIN_ID, plan.authority.address, tx) !== tx.safeTxHash) throw new Error('Safe transaction hash mismatch.');
  });
  if (plan.simulation?.earlyActivationRejected !== true || plan.simulation?.activationSucceededAfterDelay !== true || plan.simulation?.externalBroadcast !== false) throw new Error('Pinned-fork lifecycle evidence missing.');
  if (plan.liveReadiness?.status !== 'approval_required') throw new Error('Broadcast approval boundary missing.');
  if (!Number.isFinite(Date.parse(plan.liveReadiness.validUntil)) || Date.parse(plan.liveReadiness.validUntil) <= Date.now()) throw new Error('Live plan has expired and must be refreshed.');
  const forbidden = findForbiddenKey(plan);
  if (forbidden) throw new Error('Forbidden secret-bearing field: ' + forbidden + '.');
  return true;
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

function assertAllEqual(values, label) {
  if (!values.length || values.some((value) => JSON.stringify(value) !== JSON.stringify(values[0]))) throw new Error(label + ' disagrees across RPC origins.');
}

function assertAddressList(actual, expected, label) {
  const left = actual.map(ethers.getAddress).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const right = expected.map(ethers.getAddress).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  if (JSON.stringify(left) !== JSON.stringify(right)) throw new Error(label + ' mismatch.');
}

function assertEqual(actual, expected, label) {
  if (String(actual).toLowerCase() !== String(expected).toLowerCase()) throw new Error(label + ' mismatch: expected ' + expected + ', received ' + actual + '.');
}

async function codeHash(provider, address) {
  const code = await provider.getCode(address);
  if (code === '0x') throw new Error('Missing runtime code at ' + address + '.');
  return ethers.keccak256(code);
}

function byteLength(hex) { return (hex.length - 2) / 2; }
function sha256Hex(hex) { return '0x' + createHash('sha256').update(Buffer.from(hex.slice(2), 'hex')).digest('hex'); }

async function main() {
  const outputIndex = process.argv.indexOf('--output');
  const anchorIndex = process.argv.indexOf('--anchor');
  const outputPath = outputIndex === -1 ? null : process.argv[outputIndex + 1];
  const anchorNumber = anchorIndex === -1 ? null : Number(process.argv[anchorIndex + 1]);
  if (!outputPath || outputPath.startsWith('-')) throw new Error('--output requires a path.');
  if (anchorIndex !== -1 && !Number.isSafeInteger(anchorNumber)) throw new Error('--anchor requires an integer block number.');
  const artifact = await prepareLiveDeploymentPlan({ anchorNumber });
  const absolute = resolve(outputPath);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, JSON.stringify(artifact, null, 2) + '\n');
  console.log(JSON.stringify({ status: artifact.status, anchor: artifact.rpcConsensus.anchor.number, externalBroadcast: artifact.externalBroadcast, broadcastApprovalGranted: artifact.broadcastApprovalGranted, artifact: absolute }, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
