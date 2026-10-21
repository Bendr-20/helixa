#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Interface, TypedDataEncoder, keccak256 } from 'ethers';

import { canonicalSwarmLaunchJson } from '../../types/src/swarm-launch.js';
import { compileSwarmLaunchContracts } from './compile-swarm-launch.js';
import {
  attachSwarmLaunchExecutionSignatures,
  buildSwarmLaunchExecutionReadiness,
  computeSwarmLaunchDeploymentId,
  computeSwarmLaunchPredictions,
} from './swarm-launch-execution-manifest.js';

const BASE_CHAIN_ID = 8453;
const ALLOWED_RPC_METHODS = new Set(['eth_chainId', 'eth_getCode', 'eth_call']);

export async function verifySwarmLaunchPacket(packet, { artifacts, rpcUrl, fetchImpl = globalThis.fetch } = {}) {
  exactKeys(packet, ['manifest', 'manifestSha256', 'typedData'], 'launch packet envelope');
  if (!packet?.manifest || packet.manifest.schema !== 'multipass.swarm-token-launch-packet.v2') throw new TypeError('Launch packet schema is invalid.');
  const manifest = packet.manifest;
  if (manifest.chainId !== BASE_CHAIN_ID) throw new TypeError('Launch packet must target Base chain ID 8453.');
  const calculatedHash = '0x' + createHash('sha256').update(canonicalSwarmLaunchJson(manifest)).digest('hex');
  if (calculatedHash !== packet.manifestSha256) throw new TypeError('Launch packet manifest hash mismatch.');

  const compiled = artifacts ?? await compileSwarmLaunchContracts();
  const prepared = buildSwarmLaunchExecutionReadiness({
    chainId: manifest.chainId,
    factoryAddress: manifest.factory,
    readinessPacketSha256: manifest.sourceReadiness?.sha256,
    readinessManifest: manifest.sourceReadiness?.artifact,
    consentManifest: manifest.sourceReadiness?.consentManifest,
    conversion: manifest.conversion?.artifact,
    artifacts: compiled,
  });
  let reconstructed = prepared;
  if (manifest.authorization?.status !== 'NOT_ATTACHED') reconstructed = await attachSwarmLaunchExecutionSignatures(prepared, manifest.authorization?.signatures);
  if (canonicalSwarmLaunchJson(packet) !== canonicalSwarmLaunchJson(reconstructed)) throw new TypeError('Launch packet violates the closed canonical schema or reconstructed state.');
  if (manifest.execution.broadcastPrepared !== false || manifest.execution.transactionCount !== 0 || manifest.safety.rpcSendMethodsAllowed !== false) throw new TypeError('Launch packet is not no-broadcast.');
  if (compiled.sourceHash !== manifest.compiler?.sourceHash || compiled.compilerVersion !== manifest.compiler?.version) {
    throw new TypeError('Launch packet compiler evidence mismatch.');
  }
  const bytecodeHashes = {};
  const sizes = [];
  for (const [name, artifact] of Object.entries(compiled.contracts)) {
    const bytecodeHash = keccak256(artifact.bytecode).toLowerCase();
    bytecodeHashes[name] = bytecodeHash;
    if (manifest.compiler.bytecodeHashes[name] !== bytecodeHash) throw new TypeError(name + ' bytecode hash mismatch.');
    const initcodeBytes = hexBytes(artifact.bytecode);
    const runtimeBytes = hexBytes(artifact.deployedBytecode);
    if (initcodeBytes > 49_152) throw new TypeError(name + ' exceeds the EIP-3860 initcode size limit.');
    if (runtimeBytes > 24_576) throw new TypeError(name + ' exceeds the EIP-170 runtime size limit.');
    sizes.push(Object.freeze({ contract: name, initcodeBytes, runtimeBytes }));
  }

  const deploymentId = computeSwarmLaunchDeploymentId(manifest.plan);
  if (deploymentId !== manifest.deployment.deploymentId) throw new TypeError('Launch packet deployment ID mismatch.');
  const predicted = computeSwarmLaunchPredictions(manifest.factory, manifest.plan, compiled);
  if (
    predicted.token !== manifest.deployment.token || predicted.registry !== manifest.deployment.registry
      || predicted.splitter !== manifest.deployment.splitter
      || canonicalSwarmLaunchJson(predicted.streams) !== canonicalSwarmLaunchJson(manifest.deployment.streams)
  ) throw new TypeError('Launch packet CREATE2 prediction mismatch.');
  const digest = TypedDataEncoder.hash(packet.typedData.domain, packet.typedData.types, packet.typedData.message).toLowerCase();
  if (digest !== manifest.authorization.digest) throw new TypeError('Launch packet EIP-712 digest mismatch.');

  const baseReport = {
    status: 'VERIFIED_OFFLINE',
    chainId: BASE_CHAIN_ID,
    schemaVerified: true,
    lineageVerified: true,
    allocationSummariesVerified: true,
    packetHashVerified: true,
    deploymentIdVerified: true,
    create2Verified: true,
    bytecodeVerified: true,
    authorizationDigestVerified: true,
    sizes,
  };
  if (!rpcUrl) return Object.freeze({ ...baseReport, rpc: Object.freeze({ status: 'NOT_REQUESTED', methods: Object.freeze([]) }) });
  if (typeof fetchImpl !== 'function') {
    return Object.freeze({ ...baseReport, status: 'RPC_UNAVAILABLE', rpc: Object.freeze({ status: 'UNAVAILABLE', methods: Object.freeze([]), error: 'No fetch implementation is available.' }) });
  }

  const methods = [];
  let nextId = 1;
  const rpc = async (method, params) => {
    if (!ALLOWED_RPC_METHODS.has(method)) throw new TypeError('Unsafe RPC method refused: ' + method + '.');
    methods.push(method);
    const response = await fetchImpl(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params }),
    });
    if (!response?.ok) throw new Error('RPC HTTP status ' + (response?.status ?? 'unknown') + '.');
    const body = await response.json();
    if (body?.error) throw new Error('RPC ' + method + ' failed: ' + JSON.stringify(body.error));
    if (!Object.hasOwn(body ?? {}, 'result')) throw new Error('RPC ' + method + ' returned no result.');
    return body.result;
  };

  try {
    const chainId = Number(BigInt(await rpc('eth_chainId', [])));
    if (chainId !== BASE_CHAIN_ID) {
      return Object.freeze({ ...baseReport, status: 'RPC_CHAIN_MISMATCH', rpc: Object.freeze({ status: 'CHAIN_MISMATCH', chainId, methods: Object.freeze(methods) }) });
    }
    const code = await rpc('eth_getCode', [manifest.factory, 'latest']);
    if (typeof code !== 'string' || /^0x0*$/iu.test(code)) {
      return Object.freeze({ ...baseReport, status: 'FACTORY_NOT_DEPLOYED', rpc: Object.freeze({ status: 'FACTORY_CODE_UNAVAILABLE', chainId, methods: Object.freeze(methods), factory: manifest.factory }) });
    }
    const iface = new Interface(compiled.contracts.SwarmLaunchFactory.abi);
    const deploymentCall = iface.encodeFunctionData('computeDeploymentId', [manifest.plan]);
    const deploymentResult = await rpc('eth_call', [{ to: manifest.factory, data: deploymentCall }, 'latest']);
    const [onchainDeploymentId] = iface.decodeFunctionResult('computeDeploymentId', deploymentResult);
    const predictionCall = iface.encodeFunctionData('predict', [manifest.plan]);
    const predictionResult = await rpc('eth_call', [{ to: manifest.factory, data: predictionCall }, 'latest']);
    const [token, registry, splitter, streams] = iface.decodeFunctionResult('predict', predictionResult);
    const onchainParity = String(onchainDeploymentId).toLowerCase() === deploymentId
      && token.toLowerCase() === predicted.token && registry.toLowerCase() === predicted.registry
      && splitter.toLowerCase() === predicted.splitter
      && canonicalSwarmLaunchJson(streams.map((entry) => entry.toLowerCase())) === canonicalSwarmLaunchJson(predicted.streams);
    if (!onchainParity) throw new TypeError('Read-only onchain simulation does not match the packet.');
    return Object.freeze({
      ...baseReport,
      status: 'VERIFIED_READ_ONLY',
      rpc: Object.freeze({ status: 'VERIFIED', chainId, factoryCodeBytes: hexBytes(code), onchainParity, methods: Object.freeze(methods) }),
    });
  } catch (error) {
    if (error instanceof TypeError && /does not match|Unsafe RPC/iu.test(error.message)) throw error;
    return Object.freeze({
      ...baseReport,
      status: 'RPC_UNAVAILABLE',
      rpc: Object.freeze({ status: 'UNAVAILABLE', methods: Object.freeze(methods), error: String(error?.message ?? error) }),
    });
  }
}

function hexBytes(value) {
  if (typeof value !== 'string' || !/^0x(?:[0-9a-f]{2})*$/iu.test(value)) throw new TypeError('Bytecode is not canonical hex.');
  return (value.length - 2) / 2;
}

async function main(argv) {
  const packetPath = valueAfter(argv, '--packet');
  if (!packetPath) throw new TypeError('Usage: verify-swarm-launch-packet.js --packet <path> [--rpc <Base RPC URL>]');
  const packet = JSON.parse(await readFile(resolve(packetPath), 'utf8'));
  const report = await verifySwarmLaunchPacket(packet, { rpcUrl: valueAfter(argv, '--rpc') });
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  if (!['VERIFIED_OFFLINE', 'VERIFIED_READ_ONLY'].includes(report.status)) process.exitCode = 2;
}

function valueAfter(argv, flag) { const index = argv.indexOf(flag); return index === -1 ? undefined : argv[index + 1]; }

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main(process.argv.slice(2));

function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(label + ' is invalid.');
  const expected = new Set(keys);
  for (const key of Object.keys(value)) if (!expected.has(key)) throw new TypeError(label + ' contains unknown key: ' + key + '.');
  for (const key of keys) if (!Object.hasOwn(value, key)) throw new TypeError(label + ' is missing key: ' + key + '.');
}
