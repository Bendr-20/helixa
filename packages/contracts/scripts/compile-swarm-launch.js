#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import solc from 'solc';

const CONTRACT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_NAMES = Object.freeze([
  'src/missions/launch/FixedSupplySwarmToken.sol',
  'src/missions/launch/SwarmContributionRegistry.sol',
  'src/missions/launch/NonTransferableVestingStream.sol',
  'src/missions/launch/PullRevenueSplitter.sol',
  'src/missions/launch/SwarmLaunchFactory.sol',
]);
const EXPECTED_COMPILER = '0.8.24';

export async function compileSwarmLaunchContracts() {
  const compilerLongVersion = solc.version();
  if (!compilerLongVersion.startsWith(EXPECTED_COMPILER + '+')) {
    throw new Error('Swarm launch contracts require solc ' + EXPECTED_COMPILER + '; found ' + compilerLongVersion + '.');
  }

  const sources = {};
  for (const sourceName of SOURCE_NAMES) {
    sources[sourceName] = { content: await readFile(resolve(CONTRACT_ROOT, sourceName), 'utf8') };
  }
  const input = {
    language: 'Solidity',
    sources,
    settings: {
      viaIR: true,
      optimizer: { enabled: true, runs: 200 },
      evmVersion: 'paris',
      metadata: { bytecodeHash: 'none', appendCBOR: false },
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object', 'metadata'] } },
    },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = output.errors?.filter((entry) => entry.severity === 'error') ?? [];
  if (errors.length) throw new Error(errors.map((entry) => entry.formattedMessage).join('\n'));

  const contracts = {};
  for (const sourceName of SOURCE_NAMES) {
    const contractName = sourceName.split('/').at(-1).replace(/\.sol$/u, '');
    const compiled = output.contracts[sourceName]?.[contractName];
    if (!compiled) throw new Error('Missing Swarm launch artifact: ' + contractName + '.');
    contracts[contractName] = artifact(compiled);
  }

  return Object.freeze({
    compilerVersion: EXPECTED_COMPILER,
    compilerLongVersion,
    sourceHash: sourceHash(sources),
    contracts: Object.freeze(contracts),
  });
}

export async function writeSwarmLaunchArtifacts(
  result,
  outputPath = resolve(CONTRACT_ROOT, 'build/SwarmLaunchExecution.json'),
) {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(result, null, 2) + '\n');
  return outputPath;
}

function artifact(contract) {
  return Object.freeze({
    abi: contract.abi,
    bytecode: '0x' + contract.evm.bytecode.object,
    deployedBytecode: '0x' + contract.evm.deployedBytecode.object,
    metadata: JSON.parse(contract.metadata),
  });
}

function sourceHash(sources) {
  const hash = createHash('sha256');
  for (const name of Object.keys(sources).sort()) hash.update(name + '\0' + sources[name].content + '\0', 'utf8');
  return hash.digest('hex');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await compileSwarmLaunchContracts();
  const outputPath = await writeSwarmLaunchArtifacts(result);
  console.log(JSON.stringify({
    artifact: outputPath,
    compiler: result.compilerLongVersion,
    sourceHash: result.sourceHash,
    contracts: Object.keys(result.contracts),
  }, null, 2));
}
