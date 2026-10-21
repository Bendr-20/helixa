#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { compileSwarmLaunchContracts } from './compile-swarm-launch.js';
import { buildSwarmLaunchExecutionReadiness } from './swarm-launch-execution-manifest.js';

export async function generateSwarmLaunchPacket(input) {
  if (containsSensitiveMaterial(input)) throw new TypeError('Generator input must not contain keys or signatures.');
  const artifacts = await compileSwarmLaunchContracts();
  return buildSwarmLaunchExecutionReadiness({ ...input, artifacts });
}

function containsSensitiveMaterial(value) {
  if (Array.isArray(value)) return value.some(containsSensitiveMaterial);
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, child]) => /private.?key|secret.?key|signature/iu.test(key) || containsSensitiveMaterial(child));
}

async function main(argv) {
  const inputPath = valueAfter(argv, '--input');
  const outputPath = valueAfter(argv, '--output');
  if (!inputPath) throw new TypeError('Usage: generate-swarm-launch-packet.js --input <path> [--output <path>]');
  const input = JSON.parse(await readFile(resolve(inputPath), 'utf8'));
  const packet = await generateSwarmLaunchPacket(input);
  const output = JSON.stringify(packet, null, 2) + '\n';
  if (outputPath) await writeFile(resolve(outputPath), output, { flag: argv.includes('--force') ? 'w' : 'wx' });
  else process.stdout.write(output);
}

function valueAfter(argv, flag) { const index = argv.indexOf(flag); return index === -1 ? undefined : argv[index + 1]; }

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main(process.argv.slice(2));
