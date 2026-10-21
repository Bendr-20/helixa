import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import * as server from '../src/server.js';

const FACTORY = '0x9999999999999999999999999999999999999999';
const ARTIFACTS = { compilerVersion: '0.8.24', sourceHash: 'a'.repeat(64), contracts: Object.fromEntries(['FixedSupplySwarmToken', 'SwarmContributionRegistry', 'NonTransferableVestingStream', 'PullRevenueSplitter', 'SwarmLaunchFactory'].map((name) => [name, { abi: [], bytecode: '0x00', deployedBytecode: '0x00' }])) };

test('normal server config accepts only a valid factory and pinned artifact path', () => {
  const parsed = server.parseServerOptions([], { MULTIPASS_SWARM_LAUNCH_FACTORY_ADDRESS: FACTORY, MULTIPASS_SWARM_LAUNCH_ARTIFACTS_PATH: '/srv/pinned/swarm-artifacts.json' });
  assert.equal(parsed.swarmLaunchFactoryAddress, FACTORY);
  assert.equal(parsed.swarmLaunchExecutionArtifactsPath, '/srv/pinned/swarm-artifacts.json');
  assert.throws(() => server.parseServerOptions([], { MULTIPASS_SWARM_LAUNCH_FACTORY_ADDRESS: '0x0' }), /factory/i);
});

test('pinned artifact loader reads bounded JSON and rejects oversized or malformed files', async () => {
  assert.equal(typeof server.loadPinnedSwarmLaunchExecutionArtifacts, 'function');
  const dir = await mkdtemp(join(tmpdir(), 'swarm-artifacts-'));
  const good = join(dir, 'good.json'); const malformed = join(dir, 'bad.json'); const huge = join(dir, 'huge.json');
  await writeFile(good, JSON.stringify(ARTIFACTS));
  await writeFile(malformed, '{'); await writeFile(huge, 'x'.repeat(4 * 1024 * 1024 + 1));
  assert.equal((await server.loadPinnedSwarmLaunchExecutionArtifacts(good)).compilerVersion, '0.8.24');
  await assert.rejects(() => server.loadPinnedSwarmLaunchExecutionArtifacts(malformed), /JSON|artifact/i);
  await assert.rejects(() => server.loadPinnedSwarmLaunchExecutionArtifacts(huge), /large|size|artifact/i);
});

test('ordinary startServer loads pinned execution artifacts from configured path', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'swarm-startup-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const artifactPath = join(dir, 'pinned.json'); const calls = [];
  const api = await server.startServer({ fixture: 'generic', host: '127.0.0.1', port: 0, databasePath: join(dir, 'api.sqlite'), swarmLaunchFactoryAddress: FACTORY, swarmLaunchExecutionArtifactsPath: artifactPath, swarmLaunchExecutionArtifactsLoader: async (path) => { calls.push(path); return { pinned: true }; }, logger: { info() {}, warn() {}, error() {} } });
  try { assert.deepEqual(calls, [artifactPath]); } finally { await api.close(); }
});
