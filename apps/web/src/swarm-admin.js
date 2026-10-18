import { encodeFunctionData, getAddress, isAddressEqual } from 'viem';

const SAFE_ABI = [
  { type: 'function', name: 'approvedHashes', stateMutability: 'view', inputs: [{ name: '', type: 'address' }, { name: '', type: 'bytes32' }], outputs: [{ name: '', type: 'uint256' }] },
];

export const SWARM_ADMIN_APPROVAL = Object.freeze({
  chainId: 8453,
  chainHex: '0x2105',
  owner: '0x709D8d528D2c0C8A408107E74b38a01Fa14e44aE',
  safe: '0x7410A8CA3F3098D92300bfE110273A68f5fcc4FF',
  target: '0xC2fbEF16EC0981bcfA7e878f6f78BF8DeBe2BcCB',
  safeTxHash: '0xa61cad7e0459f24a0bce966611c59eb6c44326426295b43115f010a4db34d7a8',
  calldata: '0xd4d9bdcda61cad7e0459f24a0bce966611c59eb6c44326426295b43115f010a4db34d7a8',
  validUntil: '2026-10-18T19:08:27.000Z',
  activateAfter: '2026-10-19T19:08:27.000Z',
  executedAt: '2026-10-18T18:11:15.000Z',
  executedTransactionHash: '0x3225d0b160136d02a4d6ece382a36e42d91574a4f87a0ee299eeb3bd9ced29cd',
  action: 'Propose MissionEscrowV1',
  excluded: Object.freeze(['activation', 'token approval', 'token transfer', 'mission funding']),
});

export function createInitialSwarmAdminState() {
  return Object.freeze({ status: 'idle', approved: false, hash: null, error: null });
}

export function buildSwarmSafeApprovalTransaction(from) {
  const normalized = normalizeAddress(from);
  if (!isAddressEqual(normalized, SWARM_ADMIN_APPROVAL.owner)) {
    throw new Error('Connect the required owner wallet ending 44aE.');
  }
  return Object.freeze({
    chainId: SWARM_ADMIN_APPROVAL.chainHex,
    from: SWARM_ADMIN_APPROVAL.owner,
    to: SWARM_ADMIN_APPROVAL.safe,
    data: SWARM_ADMIN_APPROVAL.calldata,
    value: '0x0',
  });
}

export async function readSwarmSafeApproval(provider) {
  assertProvider(provider);
  const chainId = await provider.request({ method: 'eth_chainId' });
  if (normalizeChainHex(chainId) !== SWARM_ADMIN_APPROVAL.chainHex) {
    throw new Error('Switch the connected wallet to Base network.');
  }
  const data = encodeFunctionData({
    abi: SAFE_ABI,
    functionName: 'approvedHashes',
    args: [SWARM_ADMIN_APPROVAL.owner, SWARM_ADMIN_APPROVAL.safeTxHash],
  });
  const result = await provider.request({
    method: 'eth_call',
    params: [{ to: SWARM_ADMIN_APPROVAL.safe, data }, 'latest'],
  });
  return parseRpcQuantity(result) > 0n;
}

export async function submitSwarmSafeApproval({ walletClient, now = Date.now(), pollDelay = defaultPollDelay } = {}) {
  if (!walletClient || typeof walletClient.getSnapshot !== 'function') throw new Error('Wallet client is unavailable.');
  if (SWARM_ADMIN_APPROVAL.executedTransactionHash) throw new Error('This Safe proposal is already executed.');
  if (Number(now) >= Date.parse(SWARM_ADMIN_APPROVAL.validUntil)) throw new Error('This exact approval authorization expired.');
  const wallet = walletClient.getSnapshot();
  if (!wallet?.connected || !wallet.address) throw new Error('Connect the required owner wallet first.');
  const transaction = buildSwarmSafeApprovalTransaction(wallet.address);
  const chainId = await walletClient.request({ method: 'eth_chainId' });
  if (normalizeChainHex(chainId) !== SWARM_ADMIN_APPROVAL.chainHex) throw new Error('Switch the connected wallet to Base network.');

  await walletClient.request({ method: 'eth_call', params: [transaction, 'latest'] });
  if (typeof walletClient.sendTransaction !== 'function') throw new Error('Connected wallet cannot submit the reviewed approval transaction.');
  const hash = await walletClient.sendTransaction(transaction);
  const receipt = await waitForReceipt(walletClient, hash, pollDelay);
  if (normalizeChainHex(receipt?.status) !== '0x1') throw new Error('The Safe hash approval reverted.');
  const approved = await readSwarmSafeApproval(walletClient);
  if (!approved) throw new Error('The transaction settled but Safe did not record the expected approval hash.');
  return Object.freeze({ hash, receipt, approved: true });
}

export function renderSwarmAdmin({ state = createInitialSwarmAdminState(), wallet = {} } = {}) {
  const connected = Boolean(wallet.connected && wallet.address);
  const expectedWallet = connected && isExpectedOwner(wallet.address);
  const expired = Date.now() >= Date.parse(SWARM_ADMIN_APPROVAL.validUntil);
  const pending = ['connecting', 'checking', 'submitting', 'confirming'].includes(state.status);
  const completed = Boolean(SWARM_ADMIN_APPROVAL.executedTransactionHash);
  const approved = completed || Boolean(state.approved || state.status === 'approved');
  const actionDisabled = completed || pending || expired || approved || !expectedWallet;
  const status = renderStatus(state, { connected, expectedWallet, expired, completed });
  const walletLabel = connected ? (wallet.label || shortenAddress(wallet.address)) : 'Not connected';
  return     '<main class="swarm-admin" aria-label="Swarm Admin">' +
      '<section class="swarm-admin-hero">' +
        '<p class="card-label">Swarm Command · Base mainnet</p>' +
        '<h1>Swarm Admin</h1>' +
        '<p>Review and authorize one bounded governance action. No generic contract calls or editable calldata.</p>' +
      '</section>' +
      '<section class="swarm-admin-card" aria-label="MissionEscrowV1 proposal approval">' +
        '<div class="swarm-admin-card-heading"><div><span>Safe approval</span><h2>' + escapeHtml(SWARM_ADMIN_APPROVAL.action) + '</h2></div><strong>' + (approved ? 'Approved' : 'Awaiting owner') + '</strong></div>' +
        '<dl class="swarm-admin-facts">' +
          fact('Network', 'Base · 8453') + fact('Safe', shortenAddress(SWARM_ADMIN_APPROVAL.safe)) + fact('Safe nonce', completed ? '1' : '0') + fact('Registry', shortenAddress(SWARM_ADMIN_APPROVAL.target)) +
        '</dl>' +
        '<div class="swarm-admin-hash"><span>Exact Safe transaction hash</span><code>' + escapeHtml(SWARM_ADMIN_APPROVAL.safeTxHash) + '</code></div>' +
        (completed ? '<div class="swarm-admin-wallet"><div><span>Proposal transaction</span><strong>Confirmed on Base</strong><small>' + escapeHtml(shortenAddress(SWARM_ADMIN_APPROVAL.executedTransactionHash)) + '</small></div><a class="swarm-admin-explorer" href="https://basescan.org/tx/' + escapeHtml(SWARM_ADMIN_APPROVAL.executedTransactionHash) + '" target="_blank" rel="noopener noreferrer">View receipt</a></div>' : '<div class="swarm-admin-wallet"><div><span>Required signer</span><strong>' + escapeHtml(walletLabel) + '</strong><small>' + escapeHtml(shortenAddress(SWARM_ADMIN_APPROVAL.owner)) + '</small></div><button type="button" data-action="connect-swarm-admin-wallet" ' + (pending || wallet.configured === false ? 'disabled' : '') + '>' + (connected ? 'Switch wallet' : 'Connect wallet') + '</button></div>') +
        '<div class="swarm-admin-boundary"><strong>Stage boundary</strong><p>' + (completed ? 'MissionEscrowV1 was proposed with Safe nonce 0.' : 'Approves only the MissionEscrowV1 proposal at nonce 0.') + '</p><p>Activation, token approval, token transfer, and mission funding are not included.</p><p>' + (completed ? 'Activation requires a fresh approval after ' + escapeHtml(formatUtc(SWARM_ADMIN_APPROVAL.activateAfter)) + '.' : 'Approval window ends ' + escapeHtml(formatUtc(SWARM_ADMIN_APPROVAL.validUntil)) + '.') + '</p></div>' +
        (completed ? '' : '<button class="swarm-admin-primary" type="button" data-action="approve-swarm-safe-hash" ' + (actionDisabled ? 'disabled' : '') + '>' + (pending ? 'Confirming…' : approved ? 'Approval recorded' : 'Approve exact Safe hash') + '</button>') +
        status +
      '</section>' +
      '<p class="swarm-admin-footnote">The proposal stage is complete. This page exposes no executable action until a separately reviewed activation packet is available.</p>' +
    '</main>';
}

export function bindSwarmAdmin(root, handlers = {}) {
  root.querySelector('[data-action="connect-swarm-admin-wallet"]')?.addEventListener('click', () => handlers.connect?.());
  root.querySelector('[data-action="approve-swarm-safe-hash"]')?.addEventListener('click', () => handlers.approve?.());
}

async function waitForReceipt(provider, hash, pollDelay) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const receipt = await provider.request({ method: 'eth_getTransactionReceipt', params: [hash] });
    if (receipt) return receipt;
    await pollDelay(1_000);
  }
  throw new Error('Approval was submitted but its receipt is still pending.');
}

function assertProvider(provider) {
  if (!provider || typeof provider.request !== 'function') throw new Error('Wallet provider is unavailable.');
}
function normalizeAddress(value) {
  try { return getAddress(String(value ?? '')); } catch { throw new Error('Connect the required owner wallet ending 44aE.'); }
}
function isExpectedOwner(value) {
  try { return isAddressEqual(normalizeAddress(value), SWARM_ADMIN_APPROVAL.owner); } catch { return false; }
}
function normalizeChainHex(value) {
  try { return '0x' + BigInt(value).toString(16); } catch { return String(value ?? '').toLowerCase(); }
}
function parseRpcQuantity(value) {
  if (value === '0x' || value === '' || value === null || value === undefined) return 0n;
  return BigInt(value);
}
function defaultPollDelay(milliseconds) { return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds)); }
function shortenAddress(value) { const address = String(value ?? ''); return address.length > 12 ? address.slice(0, 6) + '…' + address.slice(-4) : address; }
function formatUtc(value) { return new Date(value).toISOString().replace('T', ' ').replace('.000Z', ' UTC'); }
function fact(label, value) { return '<div><dt>' + escapeHtml(label) + '</dt><dd>' + escapeHtml(value) + '</dd></div>'; }
function renderStatus(state, context) {
  if (context.completed) return '<p class="swarm-admin-status success" role="status">Proposal confirmed. MissionEscrowV1 is pending its timelock; activation remains blocked.</p>';
  if (state.error) return '<p class="swarm-admin-status error" role="alert">' + escapeHtml(state.error) + '</p>';
  if (state.status === 'approved') return '<p class="swarm-admin-status success" role="status">Safe recorded the exact owner approval. Execution remains separate.</p>';
  if (state.hash) return '<p class="swarm-admin-status" role="status">Submitted <a href="https://basescan.org/tx/' + escapeHtml(state.hash) + '" target="_blank" rel="noopener noreferrer">view transaction</a>.</p>';
  if (context.expired) return '<p class="swarm-admin-status error" role="alert">This exact approval window expired. A replacement packet is required.</p>';
  if (context.connected && !context.expectedWallet) return '<p class="swarm-admin-status error" role="alert">Wrong wallet. Switch to the owner ending 44aE.</p>';
  if (!context.connected) return '<p class="swarm-admin-status">Connect the owner wallet to continue.</p>';
  return '<p class="swarm-admin-status">Ready for the exact onchain hash approval.</p>';
}
function escapeHtml(value) { return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'); }
