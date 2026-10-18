#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ethers } from 'ethers';
import ganache from 'ganache';
import solc from 'solc';

import { compileMissionContracts } from './compile-mission-escrow.js';

const CHAIN_ID = 84_532;
const MINIMUM_DELAY_SECONDS = 86_400;
const FIXED_TIME = new Date('2026-10-17T00:00:00.000Z');
const FIXED_TIMESTAMP = Math.floor(FIXED_TIME.getTime() / 1_000);
const VERSION_ID = ethers.id('swarm-command-mission-escrow-v1');
const EXTERNAL_REQUIREMENTS = Object.freeze([
  'approved Base Sepolia RPC endpoints',
  'approved production Safe address and owner threshold',
  'approved emergency council address',
  'approved deployer address and fresh nonce',
  'approved Base Sepolia token addresses or mock-token deployment choice',
  'separate explicit broadcast approval',
]);

const SIMULATION_SOURCE = String.raw`// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

contract MissionSimulationTwoOfTwo {
    address[2] public owners;
    mapping(bytes32 => mapping(address => bool)) public approvedBy;
    mapping(bytes32 => uint8) public approvalCount;
    mapping(bytes32 => bool) public executed;

    error Unauthorized();
    error AlreadyApproved();
    error NotApproved();
    error AlreadyExecuted();
    error ExecutionFailed();

    constructor(address owner0, address owner1) {
        require(owner0 != address(0) && owner1 != address(0) && owner0 != owner1, "owners");
        owners = [owner0, owner1];
    }

    function operationHash(address target, bytes calldata data) public pure returns (bytes32) {
        return keccak256(abi.encode(target, keccak256(data)));
    }

    function approve(address target, bytes calldata data) external {
        if (msg.sender != owners[0] && msg.sender != owners[1]) revert Unauthorized();
        bytes32 operation = operationHash(target, data);
        if (approvedBy[operation][msg.sender]) revert AlreadyApproved();
        approvedBy[operation][msg.sender] = true;
        approvalCount[operation] += 1;
    }

    function execute(address target, bytes calldata data) external returns (bytes memory result) {
        bytes32 operation = operationHash(target, data);
        if (approvalCount[operation] != 2) revert NotApproved();
        if (executed[operation]) revert AlreadyExecuted();
        executed[operation] = true;
        (bool ok, bytes memory returned) = target.call(data);
        if (!ok) revert ExecutionFailed();
        return returned;
    }
}

contract MissionSimulationToken {
    string public name;
    string public symbol;
    uint8 public immutable decimals;
    address public immutable issuer;
    mapping(address => uint256) public balanceOf;

    constructor(string memory name_, string memory symbol_, uint8 decimals_, address issuer_) {
        require(issuer_ != address(0), "issuer");
        name = name_;
        symbol = symbol_;
        decimals = decimals_;
        issuer = issuer_;
    }

    function mint(address recipient, uint256 amount) external {
        require(msg.sender == issuer, "issuer");
        balanceOf[recipient] += amount;
    }
}
`;

export async function simulateMissionDeployment() {
  const mission = await compileMissionContracts();
  const fixtures = compileSimulationContracts();
  const eip1193 = ganache.provider({
    chain: { chainId: CHAIN_ID, hardfork: 'shanghai', time: FIXED_TIME },
    logging: { quiet: true },
    wallet: { deterministic: true, totalAccounts: 8, defaultBalance: 1_000 },
  });
  const provider = new ethers.BrowserProvider(eip1193);
  const signers = await Promise.all(Array.from({ length: 8 }, (_, index) => provider.getSigner(index)));
  const addresses = await Promise.all(signers.map((signer) => signer.getAddress()));
  const [deployer, owner0, owner1] = signers;
  const emergencyCouncil = addresses[3];
  const transactions = [];

  try {
    const authority = await deploy({ signer: deployer, artifact: fixtures.authority, args: [addresses[1], addresses[2]], operation: 'authority.deploy', gasLimit: 1_500_000n, transactions });
    const tokenInputs = [
      { name: 'Mock USDC', symbol: 'mUSDC', decimals: 6 },
      { name: 'Mock CRED', symbol: 'mCRED', decimals: 18 },
    ];
    const tokens = [];
    for (const input of tokenInputs) {
      const contract = await deploy({ signer: deployer, artifact: fixtures.token, args: [input.name, input.symbol, input.decimals, addresses[0]], operation: 'token.deploy.' + input.symbol, gasLimit: 1_500_000n, transactions });
      assertEqual(await contract.name(), input.name, input.symbol + ' name');
      assertEqual(await contract.symbol(), input.symbol, input.symbol + ' symbol');
      assertEqual(await contract.decimals(), BigInt(input.decimals), input.symbol + ' decimals');
      assertEqual(await contract.issuer(), addresses[0], input.symbol + ' issuer');
      tokens.push({ address: contract.target, name: input.name, symbol: input.symbol, decimals: input.decimals, issuer: addresses[0], runtimeCodeHash: await codeHash(provider, contract.target), onchainVerified: true });
    }

    const registry = await deploy({ signer: deployer, artifact: mission.contracts.VersionRegistry, args: [authority.target, emergencyCouncil, MINIMUM_DELAY_SECONDS], operation: 'registry.deploy', gasLimit: 3_500_000n, transactions });
    const factory = await deploy({ signer: deployer, artifact: mission.contracts.MissionEscrowFactory, args: [registry.target], operation: 'factory.deploy', gasLimit: 5_000_000n, transactions });

    const activateAfter = FIXED_TIMESTAMP + MINIMUM_DELAY_SECONDS + 60;
    const vaultCreationCodeHash = ethers.keccak256(mission.contracts.MissionEscrowV1.bytecode);
    const vaultRuntimeCodeHash = ethers.keccak256(mission.contracts.MissionEscrowV1.deployedBytecode);
    const proposalData = registry.interface.encodeFunctionData('proposeVersion', [VERSION_ID, vaultCreationCodeHash, vaultRuntimeCodeHash, [tokens[0].address, tokens[1].address], 2, activateAfter, 0, 1]);
    await executeTwoOfTwo({ authority, target: registry.target, data: proposalData, operation: 'registry.proposeVersion', owner0, owner1, transactions });

    const activationData = registry.interface.encodeFunctionData('activateVersion', [VERSION_ID]);
    await approveTwoOfTwo({ authority, target: registry.target, data: activationData, operation: 'registry.activateVersion', owner0, owner1, transactions });
    await expectRejectedCall({ signer: owner0, to: authority.target, data: authority.interface.encodeFunctionData('execute', [registry.target, activationData]), operation: 'registry.activateVersion.early-rejected', gasLimit: 2_000_000n, transactions });
    assertEqual((await registry.getVersion(VERSION_ID)).status, 0n, 'pre-delay version status');
    await provider.send('evm_setTime', [(activateAfter + 60) * 1_000]);
    await provider.send('evm_mine', []);
    await executeAuthority({ authority, target: registry.target, data: activationData, operation: 'registry.activateVersion', signer: owner0, transactions });

    const vaultTerms = simulationVaultTerms({ addresses, token: tokens[0].address, now: activateAfter + 60 });
    const vault = await deploy({ signer: deployer, artifact: mission.contracts.MissionEscrowV1, args: vaultTerms, operation: 'vault.deploy.runtime-verification', gasLimit: 8_000_000n, transactions });
    const deployedVaultRuntimeCodeHash = await codeHash(provider, vault.target);
    assertEqual(deployedVaultRuntimeCodeHash, vaultRuntimeCodeHash, 'deployed vault runtime hash');

    const network = await provider.getNetwork();
    const version = await registry.getVersion(VERSION_ID);
    const authorityOwners = [await authority.owners(0), await authority.owners(1)];
    const registryRuntimeCodeHash = await codeHash(provider, registry.target);
    const factoryRuntimeCodeHash = await codeHash(provider, factory.target);
    assertEqual(network.chainId, BigInt(CHAIN_ID), 'simulation chain');
    assertEqual(await registry.governance(), authority.target, 'registry governance');
    assertEqual(await registry.emergencyCouncil(), emergencyCouncil, 'registry emergency council');
    assertEqual(await registry.minimumDelay(), BigInt(MINIMUM_DELAY_SECONDS), 'registry minimum delay');
    assertEqual(await factory.registry(), registry.target, 'factory registry');
    assertEqual(await factory.FACTORY_COMPATIBILITY(), 1n, 'factory compatibility');
    assertEqual(version.creationCodeHash, vaultCreationCodeHash, 'version creation code hash');
    assertEqual(version.runtimeCodeHash, vaultRuntimeCodeHash, 'version runtime code hash');
    assertEqual(version.status, 1n, 'version status');
    assertEqual(version.tokenCount, 2n, 'version token count');
    assertEqual(version.supportedTokens[0], tokens[0].address, 'version token 0');
    assertEqual(version.supportedTokens[1], tokens[1].address, 'version token 1');

    return Object.freeze({
      schemaVersion: 1,
      status: 'local_simulation_passed_live_inputs_blocked',
      executionEnvironment: 'in-memory-ganache',
      externalBroadcast: false,
      network: 'base-sepolia',
      chainId: CHAIN_ID,
      compilerVersion: mission.compilerVersion,
      compilerLongVersion: mission.compilerLongVersion,
      sourceHash: mission.sourceHash,
      deployer: addresses[0],
      authority: Object.freeze({ kind: 'local-fixture-2-of-2-not-safe', address: authority.target, owners: Object.freeze(authorityOwners), threshold: 2, runtimeCodeHash: await codeHash(provider, authority.target), productionSafeVerified: false }),
      emergencyCouncil,
      registry: Object.freeze({ address: registry.target, governance: authority.target, emergencyCouncil, minimumDelaySeconds: MINIMUM_DELAY_SECONDS, runtimeCodeHash: registryRuntimeCodeHash }),
      factory: Object.freeze({ address: factory.target, registry: registry.target, compatibility: 1, runtimeCodeHash: factoryRuntimeCodeHash }),
      tokens: Object.freeze(tokens.map(Object.freeze)),
      vault: Object.freeze({ address: vault.target, creationCodeHash: vaultCreationCodeHash, runtimeCodeHash: vaultRuntimeCodeHash, deployedRuntimeCodeHash: deployedVaultRuntimeCodeHash, runtimeVerified: true }),
      version: Object.freeze({ id: VERSION_ID, status: 'active', activateAfter, supportedTokens: Object.freeze(tokens.map(({ address }) => address)), factoryCompatibility: 1, creationCodeHash: vaultCreationCodeHash, runtimeCodeHash: vaultRuntimeCodeHash }),
      timelock: Object.freeze({ minimumDelaySeconds: MINIMUM_DELAY_SECONDS, earlyActivationRejected: true, activatedAfterDelay: true }),
      simulationTransactions: Object.freeze(transactions.map(Object.freeze)),
      liveTransactionPlan: null,
      liveReadiness: Object.freeze({ status: 'blocked', reasons: Object.freeze(['production Safe not verified', 'live RPC consensus not verified', 'deployer nonce and fee fields unresolved', 'approved token addresses unresolved', 'broadcast approval not granted']) }),
      externalRequirements: EXTERNAL_REQUIREMENTS,
    });
  } finally {
    await eip1193.disconnect?.();
  }
}

async function deploy({ signer, artifact, args, operation, gasLimit, transactions }) {
  const from = await signer.getAddress();
  const nonce = await pendingNonce(signer);
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
  const request = await factory.getDeployTransaction(...args);
  const expectedAddress = ethers.getCreateAddress({ from, nonce });
  const transaction = await sendSimulationTransaction({ signer, request: { ...request, gasLimit }, operation, nonce, expectedAddress, transactions });
  const receipt = await transaction.wait();
  if (receipt.contractAddress !== expectedAddress) throw new Error(operation + ' address mismatch.');
  return new ethers.Contract(expectedAddress, artifact.abi, signer);
}

async function executeTwoOfTwo({ authority, target, data, operation, owner0, owner1, transactions }) {
  await approveTwoOfTwo({ authority, target, data, operation, owner0, owner1, transactions });
  await executeAuthority({ authority, target, data, operation, signer: owner0, transactions });
}

async function approveTwoOfTwo({ authority, target, data, operation, owner0, owner1, transactions }) {
  const approveData = authority.interface.encodeFunctionData('approve', [target, data]);
  await sendCall({ signer: owner0, to: authority.target, data: approveData, operation: operation + '.approve.0', gasLimit: 300_000n, transactions });
  await sendCall({ signer: owner1, to: authority.target, data: approveData, operation: operation + '.approve.1', gasLimit: 300_000n, transactions });
}

async function executeAuthority({ authority, target, data, operation, signer, transactions }) {
  const executeData = authority.interface.encodeFunctionData('execute', [target, data]);
  await sendCall({ signer, to: authority.target, data: executeData, operation, gasLimit: 2_000_000n, transactions });
}

async function sendCall({ signer, to, data, operation, gasLimit, transactions }) {
  const nonce = await pendingNonce(signer);
  const transaction = await sendSimulationTransaction({ signer, request: { to, data, value: 0n, gasLimit }, operation, nonce, transactions });
  const receipt = await transaction.wait();
  if (receipt.status !== 1) throw new Error(operation + ' failed.');
}

async function expectRejectedCall(input) {
  const before = input.transactions.length;
  try {
    await sendCall(input);
  } catch (error) {
    const trace = input.transactions.at(-1);
    if (input.transactions.length !== before + 1 || !trace) throw error;
    trace.expectedOutcome = 'revert';
    trace.observedOutcome = 'reverted';
    trace.errorClass = String(error?.code ?? error?.name ?? 'transaction_reverted').slice(0, 80);
    return;
  }
  throw new Error(input.operation + ' unexpectedly succeeded.');
}

async function sendSimulationTransaction({ signer, request, operation, nonce, expectedAddress, transactions }) {
  const from = await signer.getAddress();
  const normalized = { operation, scope: 'local-simulation-trace', externalBroadcast: false, chainId: CHAIN_ID, transactionType: 'provider-managed-local', feeFields: 'provider-managed-local', from, to: request.to ?? null, nonce, value: String(request.value ?? 0n), data: request.data, gasLimit: String(request.gasLimit), ...(expectedAddress ? { expectedAddress } : {}) };
  transactions.push(normalized);
  return signer.sendTransaction({ ...request, nonce });
}

function simulationVaultTerms({ addresses, token, now }) {
  const fundingDeadline = now + 100_000;
  const launchDeadline = now + 110_000;
  const settlement = addresses[7];
  const allocation = { token, recipient: settlement, amount: 1_000_000n };
  return [
    ethers.id('simulation-runtime-verification'), VERSION_ID, addresses[0], addresses[0], addresses[1], addresses[3], fundingDeadline, launchDeadline,
    [{ chainId: CHAIN_ID, collection: addresses[4], tokenId: 2431n, canonicalAccount: addresses[5], controller: addresses[6], custodyEpoch: 1, settlementAddress: settlement, roleHash: ethers.id('lead'), isLead: true }],
    [{ milestoneId: ethers.id('simulation-milestone'), acceptanceHash: ethers.id('simulation-acceptance'), payoutCommitment: ethers.id('simulation-payout'), deliveryDeadline: launchDeadline + 1_000, reviewDeadline: launchDeadline + 2_000, disputeDeadline: launchDeadline + 3_000, payouts: [allocation], deliveryTimeoutAllocations: [allocation], disputeTimeoutAllocations: [allocation] }],
  ];
}

async function pendingNonce(signer) {
  const from = await signer.getAddress();
  return Number(await signer.provider.send('eth_getTransactionCount', [from, 'pending']));
}

async function codeHash(provider, address) {
  const code = await provider.getCode(address);
  if (code === '0x') throw new Error('Missing runtime code at ' + address + '.');
  return ethers.keccak256(code);
}

function compileSimulationContracts() {
  const input = {
    language: 'Solidity',
    sources: { 'MissionSimulation.sol': { content: SIMULATION_SOURCE } },
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'paris', metadata: { bytecodeHash: 'none', appendCBOR: false }, outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } } },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = output.errors?.filter(({ severity }) => severity === 'error') ?? [];
  if (errors.length) throw new Error(errors.map(({ formattedMessage }) => formattedMessage).join('\n'));
  const compiled = output.contracts?.['MissionSimulation.sol'];
  return Object.freeze({ authority: artifact(compiled?.MissionSimulationTwoOfTwo, 'MissionSimulationTwoOfTwo'), token: artifact(compiled?.MissionSimulationToken, 'MissionSimulationToken') });
}

function artifact(value, name) {
  if (!value) throw new Error('Simulation compiler did not emit ' + name + '.');
  return Object.freeze({ abi: value.abi, bytecode: '0x' + value.evm.bytecode.object, deployedBytecode: '0x' + value.evm.deployedBytecode.object });
}

function assertEqual(actual, expected, label) {
  if (String(actual).toLowerCase() !== String(expected).toLowerCase()) throw new Error(label + ' mismatch: expected ' + expected + ', received ' + actual + '.');
}

async function main() {
  const outputFlag = process.argv.indexOf('--output');
  const outputPath = outputFlag === -1 ? null : process.argv[outputFlag + 1];
  if (outputFlag !== -1 && (!outputPath || outputPath.startsWith('-'))) throw new Error('--output requires a path.');
  const result = await simulateMissionDeployment();
  if (outputPath) {
    const absolute = resolve(outputPath);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify({ status: result.status, externalBroadcast: result.externalBroadcast, artifact: absolute }, null, 2));
  } else console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
