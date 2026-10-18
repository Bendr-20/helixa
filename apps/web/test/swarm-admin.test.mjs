import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';

import { createApp } from '../src/app.js';
import {
  SWARM_ADMIN_APPROVAL,
  buildSwarmSafeApprovalTransaction,
  createInitialSwarmAdminState,
  readSwarmSafeApproval,
  renderSwarmAdmin,
  submitSwarmSafeApproval,
} from '../src/swarm-admin.js';

const OWNER = '0x709D8d528D2c0C8A408107E74b38a01Fa14e44aE';
const SAFE = '0x7410A8CA3F3098D92300bfE110273A68f5fcc4FF';
const HASH = '0xa61cad7e0459f24a0bce966611c59eb6c44326426295b43115f010a4db34d7a8';
const CALLDATA = '0xd4d9bdcda61cad7e0459f24a0bce966611c59eb6c44326426295b43115f010a4db34d7a8';

test('pins one Base Safe approveHash action with no arbitrary transaction fields', () => {
  assert.equal(SWARM_ADMIN_APPROVAL.chainId, 8453);
  assert.equal(SWARM_ADMIN_APPROVAL.chainHex, '0x2105');
  assert.equal(SWARM_ADMIN_APPROVAL.owner, OWNER);
  assert.equal(SWARM_ADMIN_APPROVAL.safe, SAFE);
  assert.equal(SWARM_ADMIN_APPROVAL.safeTxHash, HASH);
  assert.equal(SWARM_ADMIN_APPROVAL.calldata, CALLDATA);
  assert.equal(SWARM_ADMIN_APPROVAL.target, '0xC2fbEF16EC0981bcfA7e878f6f78BF8DeBe2BcCB');
  assert.equal(SWARM_ADMIN_APPROVAL.excluded.join(','), 'activation,token approval,token transfer,mission funding');
});

test('builds only the exact zero-value approval transaction for the reviewed owner', () => {
  assert.deepEqual(buildSwarmSafeApprovalTransaction(OWNER.toLowerCase()), {
    chainId: '0x2105', from: OWNER, to: SAFE, data: CALLDATA, value: '0x0',
  });
  assert.throws(() => buildSwarmSafeApprovalTransaction('0x339559A2d1CD15059365FC7bD36b3047BbA480E0'), /required owner wallet/i);
});

test('reads approval state through the connected provider without mutation', async () => {
  const requests = [];
  const approved = await readSwarmSafeApproval({ request: async (payload) => {
    requests.push(payload);
    if (payload.method === 'eth_chainId') return '0x2105';
    if (payload.method === 'eth_call') return '0x' + '0'.repeat(63) + '1';
    throw new Error('unexpected method');
  }});
  assert.equal(approved, true);
  assert.deepEqual(requests.map(({ method }) => method), ['eth_chainId', 'eth_call']);
  assert.equal(requests[1].params[0].to, SAFE);
});

test('simulates, submits, waits for success, and verifies approvedHashes', async () => {
  const methods = [];
  let approvalReads = 0;
  const walletClient = {
    getSnapshot: () => ({ connected: true, address: OWNER }),
    request: async (payload) => {
      methods.push(payload.method);
      if (payload.method === 'eth_chainId') return '0x2105';
      if (payload.method === 'eth_call') {
        approvalReads += 1;
        return approvalReads > 1 ? '0x' + '0'.repeat(63) + '1' : '0x';
      }
      if (payload.method === 'eth_getTransactionReceipt') return { status: '0x1', transactionHash: '0xapproved' };
      throw new Error('unexpected request ' + payload.method);
    },
    sendTransaction: async (transaction) => {
      assert.deepEqual(transaction, buildSwarmSafeApprovalTransaction(OWNER));
      return '0xapproved';
    },
  };
  const result = await submitSwarmSafeApproval({ walletClient, now: Date.parse('2026-10-18T18:30:00Z'), pollDelay: async () => {} });
  assert.equal(result.hash, '0xapproved');
  assert.equal(result.approved, true);
  assert.deepEqual(methods, ['eth_chainId', 'eth_call', 'eth_getTransactionReceipt', 'eth_chainId', 'eth_call']);
});

test('blocks wrong wallet, wrong chain, and expired authorization before sending', async () => {
  const base = {
    getSnapshot: () => ({ connected: true, address: OWNER }),
    request: async ({ method }) => method === 'eth_chainId' ? '0x1' : '0x',
    sendTransaction: async () => { throw new Error('must not send'); },
  };
  await assert.rejects(submitSwarmSafeApproval({ walletClient: base, now: Date.parse('2026-10-18T18:30:00Z') }), /Base network/i);
  await assert.rejects(submitSwarmSafeApproval({ walletClient: { ...base, getSnapshot: () => ({ connected: true, address: SAFE }) }, now: Date.parse('2026-10-18T18:30:00Z') }), /required owner wallet/i);
  await assert.rejects(submitSwarmSafeApproval({ walletClient: { ...base, request: async ({ method }) => method === 'eth_chainId' ? '0x2105' : '0x' }, now: Date.parse('2026-10-18T19:09:00Z') }), /expired/i);
});

test('renders a bounded mobile-safe admin action with exclusions and no calldata input', () => {
  const html = renderSwarmAdmin({
    state: createInitialSwarmAdminState(),
    wallet: { ready: true, configured: true, connected: true, address: OWNER, label: 'Looper deployer' },
  });
  const dom = new JSDOM(html);
  const { document } = dom.window;
  assert.equal(document.querySelectorAll('input, textarea, select').length, 0);
  assert.equal(document.querySelectorAll('[data-action="approve-swarm-safe-hash"]').length, 1);
  assert.match(document.body.textContent, /MissionEscrowV1/i);
  assert.match(document.body.textContent, /Activation.*not included/is);
  assert.match(document.body.textContent, /0xa61c.*d7a8/is);
});


test('the production Swarm Admin route bypasses demo loading and binds the reviewed action', async () => {
  const dom = new JSDOM('<!doctype html><main id="app"></main>', { url: 'https://helixa.xyz/multipass/swarm/admin' });
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  const root = dom.window.document.querySelector('#app');
  let demoCalls = 0;
  const walletClient = {
    getSnapshot: () => ({ ready: true, configured: true, connected: false, address: null }),
    subscribe: () => () => {},
    connect: async () => null,
    request: async () => '0x2105',
    sendTransaction: async () => { throw new Error('not expected'); },
  };
  const app = createApp({ root, walletClient, loadDemo: async () => { demoCalls += 1; throw new Error('must not load demo'); } });
  await app.start();
  assert.equal(demoCalls, 0);
  assert.match(root.textContent, /Swarm Admin/);
  assert.equal(root.querySelectorAll('[data-action="approve-swarm-safe-hash"]').length, 1);
  assert.equal(dom.window.document.title, 'Swarm Admin | Helixa');
});
