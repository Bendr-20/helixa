import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { encodeFunctionData, encodeFunctionResult } from 'viem';

import { createApp } from '../src/app.js';
import {
  SWARM_ADMIN_ACTIVATION,
  buildSwarmActivationApprovalTransaction,
  createInitialSwarmAdminState,
  readSwarmActivationState,
  renderSwarmAdmin,
  submitSwarmActivationApproval,
} from '../src/swarm-admin.js';

const OWNER = '0x709D8d528D2c0C8A408107E74b38a01Fa14e44aE';
const OTHER_OWNER = '0x339559A2d1CD15059365FC7bD36b3047BbA480E0';
const SAFE = '0x7410A8CA3F3098D92300bfE110273A68f5fcc4FF';
const REGISTRY = '0xC2fbEF16EC0981bcfA7e878f6f78BF8DeBe2BcCB';
const HASH = '0xf3a04f63765a1c95b1a02ba8aa23f641044d914c56bac5fb16f8657985a736ee';
const APPROVAL_DATA = '0xd4d9bdcdf3a04f63765a1c95b1a02ba8aa23f641044d914c56bac5fb16f8657985a736ee';
const ZERO32 = '0x' + '00'.repeat(32);

const SAFE_TEST_ABI = [
  { type: 'function', name: 'approvedHashes', stateMutability: 'view', inputs: [{ name: '', type: 'address' }, { name: '', type: 'bytes32' }], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'nonce', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'getThreshold', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'getOwners', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address[]' }] },
  { type: 'function', name: 'VERSION', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'string' }] },
  { type: 'function', name: 'isOwner', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ name: '', type: 'bool' }] },
  { type: 'function', name: 'getTransactionHash', stateMutability: 'view', inputs: [
    { name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'data', type: 'bytes' }, { name: 'operation', type: 'uint8' },
    { name: 'safeTxGas', type: 'uint256' }, { name: 'baseGas', type: 'uint256' }, { name: 'gasPrice', type: 'uint256' },
    { name: 'gasToken', type: 'address' }, { name: 'refundReceiver', type: 'address' }, { name: '_nonce', type: 'uint256' },
  ], outputs: [{ name: '', type: 'bytes32' }] },
];
const REGISTRY_TEST_ABI = [
  { type: 'function', name: 'governance', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
  { type: 'function', name: 'getVersion', stateMutability: 'view', inputs: [{ name: 'versionId', type: 'bytes32' }], outputs: [{ name: '', type: 'tuple', components: [
    { name: 'creationCodeHash', type: 'bytes32' }, { name: 'runtimeCodeHash', type: 'bytes32' }, { name: 'supportedTokens', type: 'address[2]' },
    { name: 'tokenCount', type: 'uint8' }, { name: 'activateAfter', type: 'uint64' }, { name: 'retireAfter', type: 'uint64' },
    { name: 'factoryCompatibility', type: 'uint32' }, { name: 'status', type: 'uint8' }, { name: 'exists', type: 'bool' },
  ] }] },
];

function makeProvider({ timestamp = 1792436908, nonce = 1n, threshold = 2n, owners = [OTHER_OWNER, OWNER], safeVersion = '1.4.1', owner = true, safeTxHash = HASH, governance = SAFE, versionStatus = 0, activateAfter = 1792436907, approved = false } = {}) {
  let approvedState = approved;
  const requests = [];
  const selectors = new Map([
    [encodeFunctionData({ abi: SAFE_TEST_ABI, functionName: 'nonce' }).slice(0, 10), ['safe', 'nonce', nonce]],
    [encodeFunctionData({ abi: SAFE_TEST_ABI, functionName: 'getThreshold' }).slice(0, 10), ['safe', 'getThreshold', threshold]],
    [encodeFunctionData({ abi: SAFE_TEST_ABI, functionName: 'getOwners' }).slice(0, 10), ['safe', 'getOwners', owners]],
    [encodeFunctionData({ abi: SAFE_TEST_ABI, functionName: 'VERSION' }).slice(0, 10), ['safe', 'VERSION', safeVersion]],
    [encodeFunctionData({ abi: SAFE_TEST_ABI, functionName: 'isOwner', args: [OWNER] }).slice(0, 10), ['safe', 'isOwner', owner]],
    [encodeFunctionData({ abi: SAFE_TEST_ABI, functionName: 'getTransactionHash', args: [REGISTRY, 0n, SWARM_ADMIN_ACTIVATION.activationCalldata, 0, 0n, 0n, 0n, '0x0000000000000000000000000000000000000000', '0x0000000000000000000000000000000000000000', 1n] }).slice(0, 10), ['safe', 'getTransactionHash', safeTxHash]],
    [encodeFunctionData({ abi: SAFE_TEST_ABI, functionName: 'approvedHashes', args: [OWNER, HASH] }).slice(0, 10), ['safe', 'approvedHashes', null]],
    [encodeFunctionData({ abi: REGISTRY_TEST_ABI, functionName: 'governance' }).slice(0, 10), ['registry', 'governance', governance]],
    [encodeFunctionData({ abi: REGISTRY_TEST_ABI, functionName: 'getVersion', args: [SWARM_ADMIN_ACTIVATION.versionId] }).slice(0, 10), ['registry', 'getVersion', null]],
  ]);
  const provider = {
    requests,
    getSnapshot: () => ({ connected: true, address: OWNER }),
    sendTransaction: async (transaction) => { requests.push({ method: 'sendTransaction', transaction }); approvedState = true; return '0x' + '12'.repeat(32); },
    request: async (payload) => {
      requests.push(payload);
      if (payload.method === 'eth_chainId') return '0x2105';
      if (payload.method === 'eth_getBlockByNumber') return { number: '0x3255bf0', timestamp: '0x' + timestamp.toString(16) };
      if (payload.method === 'eth_getTransactionReceipt') return { status: '0x1' };
      if (payload.method === 'eth_call' && payload.params[0].data === APPROVAL_DATA) return '0x';
      if (payload.method !== 'eth_call') throw new Error('unexpected method ' + payload.method);
      const [kind, functionName, fixed] = selectors.get(payload.params[0].data.slice(0, 10)) ?? [];
      if (!functionName) throw new Error('unexpected selector ' + payload.params[0].data.slice(0, 10));
      const abi = kind === 'safe' ? SAFE_TEST_ABI : REGISTRY_TEST_ABI;
      if (functionName === 'approvedHashes') return encodeFunctionResult({ abi, functionName, result: approvedState ? 1n : 0n });
      if (functionName === 'getVersion') return encodeFunctionResult({ abi, functionName, result: {
        creationCodeHash: ZERO32, runtimeCodeHash: ZERO32, supportedTokens: [OWNER, SAFE], tokenCount: 2,
        activateAfter: BigInt(activateAfter), retireAfter: 0n, factoryCompatibility: 1, status: versionStatus, exists: true,
      } });
      return encodeFunctionResult({ abi, functionName, result: fixed });
    },
  };
  return provider;
}

test('pins one exact Base Safe nonce-1 MissionEscrowV1 activation approval', () => {
  assert.equal(SWARM_ADMIN_ACTIVATION.chainId, 8453);
  assert.equal(SWARM_ADMIN_ACTIVATION.owner, OWNER);
  assert.deepEqual(SWARM_ADMIN_ACTIVATION.owners, [OTHER_OWNER, OWNER]);
  assert.equal(SWARM_ADMIN_ACTIVATION.safeVersion, '1.4.1');
  assert.equal(SWARM_ADMIN_ACTIVATION.safe, SAFE);
  assert.equal(SWARM_ADMIN_ACTIVATION.target, REGISTRY);
  assert.equal(SWARM_ADMIN_ACTIVATION.requiredNonce, 1);
  assert.equal(SWARM_ADMIN_ACTIVATION.activateAfter, 1792436907);
  assert.equal(SWARM_ADMIN_ACTIVATION.safeTxHash, HASH);
  assert.equal(SWARM_ADMIN_ACTIVATION.approvalCalldata, APPROVAL_DATA);
  assert.equal(SWARM_ADMIN_ACTIVATION.proposal.transactionHash, '0x3225d0b160136d02a4d6ece382a36e42d91574a4f87a0ee299eeb3bd9ced29cd');
});

test('Swarm Admin exactly matches the committed no-broadcast activation packet', async () => {
  const packet = JSON.parse(await readFile(new URL('../../../review-artifacts/swarm-command/base-mainnet-mission-escrow-v1-activation.json', import.meta.url), 'utf8'));
  assert.equal(SWARM_ADMIN_ACTIVATION.safe, packet.authority.address);
  assert.deepEqual(SWARM_ADMIN_ACTIVATION.owners, packet.authority.owners);
  assert.equal(SWARM_ADMIN_ACTIVATION.safeVersion, packet.authority.version);
  assert.equal(SWARM_ADMIN_ACTIVATION.safeTxHash, packet.activation.safeTxHash);
  assert.equal(SWARM_ADMIN_ACTIVATION.activationCalldata, packet.activation.safeTransaction.data);
  assert.equal(SWARM_ADMIN_ACTIVATION.approvalCalldata, packet.ownerApproval.data);
  assert.equal(SWARM_ADMIN_ACTIVATION.owner, packet.ownerApproval.requiredSigner);
});

test('builds only the exact zero-value approval transaction for the reviewed owner', () => {
  assert.deepEqual(buildSwarmActivationApprovalTransaction(OWNER.toLowerCase()), {
    chainId: '0x2105', from: OWNER, to: SAFE, data: APPROVAL_DATA, value: '0x0',
  });
  assert.throws(() => buildSwarmActivationApprovalTransaction(OTHER_OWNER), /required owner wallet/i);
});

test('reads every exact onchain guard at one Base block and unlocks only after its timestamp', async () => {
  const before = await readSwarmActivationState(makeProvider({ timestamp: 1792436906 }));
  assert.equal(before.timelockElapsed, false);
  assert.equal(before.ready, false);
  const afterProvider = makeProvider();
  const after = await readSwarmActivationState(afterProvider);
  assert.equal(after.ready, true);
  assert.deepEqual(afterProvider.requests.filter(({ method }) => method === 'eth_call').map(({ params }) => params[0].to), [SAFE, SAFE, SAFE, SAFE, SAFE, SAFE, SAFE, REGISTRY, REGISTRY]);
  assert.deepEqual([...new Set(afterProvider.requests.filter(({ method }) => method === 'eth_call').map(({ params }) => params[1]))], ['0x3255bf0']);
});

test('guard reads fail closed on wrong chain, nonce, threshold, Safe identity, owner, hash, governance, activateAfter, and status', async () => {
  await assert.rejects(readSwarmActivationState({ request: async () => '0x1' }), /Base network/i);
  for (const [options, pattern] of [
    [{ nonce: 2n }, /nonce changed/i],
    [{ threshold: 1n }, /threshold changed/i],
    [{ owners: [OWNER] }, /owner set changed/i],
    [{ safeVersion: '1.3.0' }, /version changed/i],
    [{ owner: false }, /no longer a Safe owner/i],
    [{ safeTxHash: ZERO32 }, /hash mismatch/i],
    [{ governance: OWNER }, /governance/i],
    [{ activateAfter: 1792436908 }, /activateAfter changed/i],
    [{ versionStatus: 2 }, /not in an activatable state/i],
  ]) await assert.rejects(readSwarmActivationState(makeProvider(options)), pattern);
});

test('submission revalidates state before access and sends only the reviewed approval after timelock', async () => {
  const before = makeProvider({ timestamp: 1792436906 });
  await assert.rejects(submitSwarmActivationApproval({ walletClient: before }), /timelocked onchain/i);
  assert.equal(before.requests.some(({ method }) => method === 'sendTransaction'), false);
  const ready = makeProvider();
  const result = await submitSwarmActivationApproval({ walletClient: ready, pollDelay: async () => {} });
  const sends = ready.requests.filter(({ method }) => method === 'sendTransaction');
  assert.equal(sends.length, 1);
  assert.deepEqual(sends[0].transaction, { chainId: '0x2105', from: OWNER, to: SAFE, data: APPROVAL_DATA, value: '0x0' });
  assert.equal(result.approved, true);
});

test('renders the completed proposal now and no activation control before verified timelock', () => {
  const html = renderSwarmAdmin({ state: createInitialSwarmAdminState(), wallet: { connected: true, address: OWNER } });
  const dom = new JSDOM(html);
  const { document } = dom.window;
  assert.equal(document.querySelectorAll('input, textarea, select').length, 0);
  assert.equal(document.querySelectorAll('[data-action="approve-swarm-activation-hash"]').length, 0);
  assert.match(document.body.textContent, /Completed proposal/i);
  assert.match(document.body.textContent, /Confirmed on Base/i);
  assert.match(document.body.textContent, /No action is exposed/i);
  assert.match(document.body.textContent, /0xf3a0.*36ee/is);
});

test('renders only the exact activation approval after verified onchain guards', () => {
  const state = { ...createInitialSwarmAdminState(), status: 'ready', activation: {
    safeNonce: 1, versionStatus: 0, pending: true, active: false, approved: false, timelockElapsed: true, ready: true,
  } };
  const html = renderSwarmAdmin({ state, wallet: { configured: true, connected: true, address: OWNER, label: 'Required owner' } });
  const dom = new JSDOM(html);
  const action = dom.window.document.querySelector('[data-action="approve-swarm-activation-hash"]');
  assert.equal(action?.textContent, 'Approve exact activation hash');
  assert.equal(dom.window.document.querySelectorAll('input, textarea, select').length, 0);
  assert.equal(dom.window.document.querySelectorAll('[data-action]').length, 2);
  assert.match(dom.window.document.body.textContent, /Safe nonce 1 calling VersionRegistry.activateVersion/i);
  assert.match(dom.window.document.body.textContent, /token approval.*excluded/is);
});

test('the production Swarm Admin route bypasses demo loading and exposes no unverified action', async () => {
  const dom = new JSDOM('<!doctype html><main id="app"></main>', { url: 'https://helixa.xyz/multipass/swarm/admin' });
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  const root = dom.window.document.querySelector('#app');
  let demoCalls = 0;
  const walletClient = {
    getSnapshot: () => ({ ready: true, configured: true, connected: false, address: null }),
    subscribe: () => () => {}, connect: async () => null, request: async () => '0x2105',
    sendTransaction: async () => { throw new Error('not expected'); },
  };
  const app = createApp({ root, walletClient, loadDemo: async () => { demoCalls += 1; throw new Error('must not load demo'); } });
  await app.start();
  assert.equal(demoCalls, 0);
  assert.match(root.textContent, /Swarm Admin/);
  assert.match(root.textContent, /Completed proposal/);
  assert.equal(root.querySelectorAll('[data-action="approve-swarm-activation-hash"]').length, 0);
  assert.equal(dom.window.document.title, 'Swarm Admin | Helixa');
});
