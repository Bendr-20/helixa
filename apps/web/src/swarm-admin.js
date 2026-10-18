import { decodeFunctionResult, encodeFunctionData, getAddress, isAddressEqual } from 'viem';

const SAFE_ABI = [
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
  { type: 'function', name: 'approveHash', stateMutability: 'nonpayable', inputs: [{ name: 'hashToApprove', type: 'bytes32' }], outputs: [] },
];
const REGISTRY_ABI = [
  { type: 'function', name: 'governance', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
  { type: 'function', name: 'getVersion', stateMutability: 'view', inputs: [{ name: 'versionId', type: 'bytes32' }], outputs: [{ name: '', type: 'tuple', components: [
    { name: 'creationCodeHash', type: 'bytes32' }, { name: 'runtimeCodeHash', type: 'bytes32' }, { name: 'supportedTokens', type: 'address[2]' },
    { name: 'tokenCount', type: 'uint8' }, { name: 'activateAfter', type: 'uint64' }, { name: 'retireAfter', type: 'uint64' },
    { name: 'factoryCompatibility', type: 'uint32' }, { name: 'status', type: 'uint8' }, { name: 'exists', type: 'bool' },
  ] }] },
];
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export const SWARM_ADMIN_ARMORY_SNAPSHOT = Object.freeze({
  url: 'https://armory-production-fc7d.up.railway.app/',
  reviewedAt: '2026-10-18T19:25:00.000Z',
  version: '0.1.0',
  toolCount: 12,
  realKeys: false,
  mode: 'Public test',
  payments: 'Prepare only',
  blockerCount: 3,
});

export const SWARM_ADMIN_ACTIVATION = Object.freeze({
  chainId: 8453,
  chainHex: '0x2105',
  owner: '0x709D8d528D2c0C8A408107E74b38a01Fa14e44aE',
  safe: '0x7410A8CA3F3098D92300bfE110273A68f5fcc4FF',
  target: '0xC2fbEF16EC0981bcfA7e878f6f78BF8DeBe2BcCB',
  versionId: '0x5fc16a65273a5c452de558226709b483548e34e8718ab2dbca37c6bcb3d5a3ac',
  requiredNonce: 1,
  requiredThreshold: 2,
  safeVersion: '1.4.1',
  owners: Object.freeze(['0x339559A2d1CD15059365FC7bD36b3047BbA480E0', '0x709D8d528D2c0C8A408107E74b38a01Fa14e44aE']),
  activateAfter: 1792436907,
  activateAfterIso: '2026-10-19T19:08:27.000Z',
  activationCalldata: '0x0a2203865fc16a65273a5c452de558226709b483548e34e8718ab2dbca37c6bcb3d5a3ac',
  safeTxHash: '0xf3a04f63765a1c95b1a02ba8aa23f641044d914c56bac5fb16f8657985a736ee',
  approvalCalldata: '0xd4d9bdcdf3a04f63765a1c95b1a02ba8aa23f641044d914c56bac5fb16f8657985a736ee',
  action: 'Activate MissionEscrowV1',
  proposal: Object.freeze({
    safeTxHash: '0xa61cad7e0459f24a0bce966611c59eb6c44326426295b43115f010a4db34d7a8',
    transactionHash: '0x3225d0b160136d02a4d6ece382a36e42d91574a4f87a0ee299eeb3bd9ced29cd',
    executedAt: '2026-10-18T18:11:15.000Z',
    safeNonce: 0,
  }),
  excluded: Object.freeze(['token approval', 'token transfer', 'mission funding', 'arbitrary contract calls']),
});

export function createInitialSwarmAdminState() {
  return Object.freeze({ status: 'idle', approved: false, hash: null, error: null, activation: null });
}

export function buildSwarmActivationApprovalTransaction(from) {
  const normalized = normalizeAddress(from);
  if (!isAddressEqual(normalized, SWARM_ADMIN_ACTIVATION.owner)) {
    throw new Error('Connect the required owner wallet ending 44aE.');
  }
  return Object.freeze({
    chainId: SWARM_ADMIN_ACTIVATION.chainHex,
    from: SWARM_ADMIN_ACTIVATION.owner,
    to: SWARM_ADMIN_ACTIVATION.safe,
    data: SWARM_ADMIN_ACTIVATION.approvalCalldata,
    value: '0x0',
  });
}

export async function readSwarmActivationState(provider) {
  assertProvider(provider);
  const chainId = await provider.request({ method: 'eth_chainId' });
  if (normalizeChainHex(chainId) !== SWARM_ADMIN_ACTIVATION.chainHex) {
    throw new Error('Switch the connected wallet to Base network.');
  }
  const block = await provider.request({ method: 'eth_getBlockByNumber', params: ['latest', false] });
  const blockTimestamp = Number(parseRpcQuantity(block?.timestamp));
  const blockTag = normalizeChainHex(block?.number);
  if (!Number.isSafeInteger(blockTimestamp)) throw new Error('Base returned an invalid latest block timestamp.');
  if (blockTag === '0x0') throw new Error('Base returned an invalid latest block number.');

  const nonce = await readContract(provider, SWARM_ADMIN_ACTIVATION.safe, SAFE_ABI, 'nonce', [], blockTag);
  const threshold = await readContract(provider, SWARM_ADMIN_ACTIVATION.safe, SAFE_ABI, 'getThreshold', [], blockTag);
  const owners = await readContract(provider, SWARM_ADMIN_ACTIVATION.safe, SAFE_ABI, 'getOwners', [], blockTag);
  const safeVersion = await readContract(provider, SWARM_ADMIN_ACTIVATION.safe, SAFE_ABI, 'VERSION', [], blockTag);
  const expectedOwner = await readContract(provider, SWARM_ADMIN_ACTIVATION.safe, SAFE_ABI, 'isOwner', [SWARM_ADMIN_ACTIVATION.owner], blockTag);
  const safeTxHash = await readContract(provider, SWARM_ADMIN_ACTIVATION.safe, SAFE_ABI, 'getTransactionHash', [
    SWARM_ADMIN_ACTIVATION.target, 0n, SWARM_ADMIN_ACTIVATION.activationCalldata, 0, 0n, 0n, 0n, ZERO_ADDRESS, ZERO_ADDRESS, BigInt(SWARM_ADMIN_ACTIVATION.requiredNonce),
  ], blockTag);
  const approvedValue = await readContract(provider, SWARM_ADMIN_ACTIVATION.safe, SAFE_ABI, 'approvedHashes', [SWARM_ADMIN_ACTIVATION.owner, SWARM_ADMIN_ACTIVATION.safeTxHash], blockTag);
  const governance = await readContract(provider, SWARM_ADMIN_ACTIVATION.target, REGISTRY_ABI, 'governance', [], blockTag);
  const version = await readContract(provider, SWARM_ADMIN_ACTIVATION.target, REGISTRY_ABI, 'getVersion', [SWARM_ADMIN_ACTIVATION.versionId], blockTag);

  if (BigInt(threshold) !== BigInt(SWARM_ADMIN_ACTIVATION.requiredThreshold)) throw new Error('Safe threshold changed; this activation packet is stale.');
  if (safeVersion !== SWARM_ADMIN_ACTIVATION.safeVersion) throw new Error('Safe version changed; this activation packet is stale.');
  if (!sameAddressSet(owners, SWARM_ADMIN_ACTIVATION.owners)) throw new Error('Safe owner set changed; this activation packet is stale.');
  if (expectedOwner !== true) throw new Error('Required signer is no longer a Safe owner.');
  if (!isAddressEqual(governance, SWARM_ADMIN_ACTIVATION.safe)) throw new Error('Registry governance no longer matches the reviewed Safe.');
  if (String(safeTxHash).toLowerCase() !== SWARM_ADMIN_ACTIVATION.safeTxHash) throw new Error('Safe transaction hash mismatch; activation is blocked.');
  if (version?.exists !== true) throw new Error('MissionEscrowV1 version is missing onchain.');
  if (Number(version.activateAfter) !== SWARM_ADMIN_ACTIVATION.activateAfter) throw new Error('MissionEscrowV1 activateAfter changed; activation is blocked.');

  const safeNonce = Number(nonce);
  const versionStatus = Number(version.status);
  const pending = versionStatus === 0;
  const active = versionStatus === 1;
  if (!pending && !active) throw new Error('MissionEscrowV1 is not in an activatable state.');
  if (pending && safeNonce !== SWARM_ADMIN_ACTIVATION.requiredNonce) throw new Error('Safe nonce changed; this activation packet is stale.');
  if (active && safeNonce < SWARM_ADMIN_ACTIVATION.requiredNonce + 1) throw new Error('Active version state conflicts with the Safe nonce.');

  const approved = BigInt(approvedValue) > 0n;
  const timelockElapsed = blockTimestamp >= SWARM_ADMIN_ACTIVATION.activateAfter;
  return Object.freeze({
    chainId: SWARM_ADMIN_ACTIVATION.chainId,
    blockNumber: Number(parseRpcQuantity(block?.number)),
    blockTimestamp,
    safeNonce,
    threshold: Number(threshold),
    safeVersion,
    owners: Object.freeze([...owners]),
    safeTxHash,
    versionStatus,
    pending,
    active,
    approved,
    timelockElapsed,
    ready: pending && safeNonce === SWARM_ADMIN_ACTIVATION.requiredNonce && timelockElapsed && !approved,
  });
}

export async function submitSwarmActivationApproval({ walletClient, pollDelay = defaultPollDelay } = {}) {
  if (!walletClient || typeof walletClient.getSnapshot !== 'function') throw new Error('Wallet client is unavailable.');
  const wallet = walletClient.getSnapshot();
  if (!wallet?.connected || !wallet.address) throw new Error('Connect the required owner wallet first.');
  const transaction = buildSwarmActivationApprovalTransaction(wallet.address);
  const activation = await readSwarmActivationState(walletClient);
  if (activation.active) throw new Error('MissionEscrowV1 is already active.');
  if (!activation.timelockElapsed) throw new Error('MissionEscrowV1 activation remains timelocked onchain.');
  if (activation.approved) throw new Error('The exact activation Safe hash is already approved.');
  if (!activation.ready) throw new Error('The exact activation state guards are not satisfied.');

  await walletClient.request({ method: 'eth_call', params: [transaction, 'latest'] });
  if (typeof walletClient.sendTransaction !== 'function') throw new Error('Connected wallet cannot submit the reviewed approval transaction.');
  const hash = await walletClient.sendTransaction(transaction);
  const receipt = await waitForReceipt(walletClient, hash, pollDelay);
  if (normalizeChainHex(receipt?.status) !== '0x1') throw new Error('The activation hash approval reverted.');
  const confirmed = await readSwarmActivationState(walletClient);
  if (!confirmed.approved && !confirmed.active) throw new Error('The transaction settled but Safe did not record the exact activation hash.');
  return Object.freeze({ hash, receipt, approved: confirmed.approved, activation: confirmed });
}

export function renderSwarmAdmin({ state = createInitialSwarmAdminState(), wallet = {} } = {}) {
  const connected = Boolean(wallet.connected && wallet.address);
  const expectedWallet = connected && isExpectedOwner(wallet.address);
  const pendingRequest = ['connecting', 'checking', 'submitting', 'confirming'].includes(state.status);
  const activation = state.activation;
  const active = activation?.active === true;
  const approved = Boolean(state.approved || activation?.approved || state.status === 'approved');
  const ready = activation?.ready === true && expectedWallet && !pendingRequest;
  const walletLabel = connected ? (wallet.label || shortenAddress(wallet.address)) : 'Not connected';
  const proposal = SWARM_ADMIN_ACTIVATION.proposal;
  return '<main class="swarm-admin" aria-label="Swarm Admin">' +
      '<section class="swarm-admin-hero">' +
        '<p class="card-label">Swarm Command · Base mainnet</p>' +
        '<h1>Swarm Admin</h1>' +
        '<p>One reviewed governance transition. No generic contract calls, editable calldata, token movement, or mission funding.</p>' +
      '</section>' +
      '<section class="swarm-admin-card" aria-label="Completed MissionEscrowV1 proposal">' +
        '<div class="swarm-admin-card-heading"><div><span>Completed proposal</span><h2>Propose MissionEscrowV1</h2></div><strong>Confirmed</strong></div>' +
        '<dl class="swarm-admin-facts">' + fact('Network', 'Base · 8453') + fact('Safe', shortenAddress(SWARM_ADMIN_ACTIVATION.safe)) + fact('Safe nonce', String(proposal.safeNonce)) + fact('Registry', shortenAddress(SWARM_ADMIN_ACTIVATION.target)) + '</dl>' +
        '<div class="swarm-admin-hash"><span>Proposal Safe transaction hash</span><code>' + escapeHtml(proposal.safeTxHash) + '</code></div>' +
        '<div class="swarm-admin-wallet"><div><span>Proposal transaction</span><strong>Confirmed on Base</strong><small>' + escapeHtml(formatUtc(proposal.executedAt)) + '</small></div><a class="swarm-admin-explorer" href="https://basescan.org/tx/' + escapeHtml(proposal.transactionHash) + '" target="_blank" rel="noopener noreferrer">View receipt</a></div>' +
      '</section>' +
      '<section class="swarm-admin-card" aria-label="MissionEscrowV1 activation approval">' +
        '<div class="swarm-admin-card-heading"><div><span>Reviewed activation</span><h2>' + escapeHtml(SWARM_ADMIN_ACTIVATION.action) + '</h2></div><strong>' + (active ? 'Active' : approved ? 'Approved' : ready ? 'Ready' : 'Timelocked') + '</strong></div>' +
        '<dl class="swarm-admin-facts">' + fact('Network', 'Base · 8453') + fact('Safe', shortenAddress(SWARM_ADMIN_ACTIVATION.safe)) + fact('Required nonce', String(SWARM_ADMIN_ACTIVATION.requiredNonce)) + fact('Version state', active ? 'Active' : 'Pending') + '</dl>' +
        '<div class="swarm-admin-hash"><span>Exact activation Safe transaction hash</span><code>' + escapeHtml(SWARM_ADMIN_ACTIVATION.safeTxHash) + '</code></div>' +
        '<div class="swarm-admin-wallet"><div><span>Required signer</span><strong>' + escapeHtml(walletLabel) + '</strong><small>' + escapeHtml(shortenAddress(SWARM_ADMIN_ACTIVATION.owner)) + '</small></div><button type="button" data-action="connect-swarm-admin-wallet" ' + (pendingRequest || wallet.configured === false ? 'disabled' : '') + '>' + (connected ? 'Switch wallet' : 'Connect wallet') + '</button></div>' +
        '<div class="swarm-admin-boundary"><strong>Exact stage boundary</strong><p>Approves only Safe nonce 1 calling VersionRegistry.activateVersion for the reviewed MissionEscrowV1 version.</p><p>Token approval, token transfer, mission funding, and arbitrary contract calls are excluded.</p><p>The control unlocks only after Base reports activateAfter ' + escapeHtml(formatUtc(SWARM_ADMIN_ACTIVATION.activateAfterIso)) + ' and every nonce, signer, hash, threshold, governance, and version-state guard matches.</p></div>' +
        (ready ? '<button class="swarm-admin-primary" type="button" data-action="approve-swarm-activation-hash">' + (pendingRequest ? 'Confirming…' : 'Approve exact activation hash') + '</button>' : '') +
        renderStatus(state, { connected, expectedWallet, active, approved, activation }) +
      '</section>' +
      '<section class="swarm-admin-card" aria-label="Armory integration readiness">' +
        '<div class="swarm-admin-card-heading"><div><span>Capability layer</span><h2>Armory readiness</h2></div><strong>Public test</strong></div>' +
        '<dl class="swarm-admin-facts">' + fact('Version', SWARM_ADMIN_ARMORY_SNAPSHOT.version) + fact('Tools', String(SWARM_ADMIN_ARMORY_SNAPSHOT.toolCount)) + fact('Real Looper keys', 'Paused') + fact('Payments', SWARM_ADMIN_ARMORY_SNAPSHOT.payments) + '</dl>' +
        '<div class="swarm-admin-boundary"><strong>Audited boundary</strong><p>Demo metering, receipt tamper rejection, owner/agent credential separation, approval denial, and MCP authentication passed.</p><p>Armory is not approved for real Looper keys, payout gating, or mission spend yet.</p><p>Production blockers: browser credential hardening, independently reproducible receipt bytes, and real Looper ownership issuance.</p></div>' +
        '<div class="swarm-admin-wallet"><div><span>Snapshot</span><strong>' + escapeHtml(SWARM_ADMIN_ARMORY_SNAPSHOT.mode) + '</strong><small>' + escapeHtml(formatUtc(SWARM_ADMIN_ARMORY_SNAPSHOT.reviewedAt)) + ' · ' + escapeHtml(String(SWARM_ADMIN_ARMORY_SNAPSHOT.blockerCount)) + ' blockers</small></div><a class="swarm-admin-explorer" href="' + escapeHtml(SWARM_ADMIN_ARMORY_SNAPSHOT.url) + '" target="_blank" rel="noopener noreferrer">Open Armory</a></div>' +
      '</section>' +
      '<p class="swarm-admin-footnote">Safe Transaction Service is advisory. Readiness is derived from the connected Base provider and revalidated immediately before submission.</p>' +
    '</main>';
}

export function bindSwarmAdmin(root, handlers = {}) {
  root.querySelector('[data-action="connect-swarm-admin-wallet"]')?.addEventListener('click', () => handlers.connect?.());
  root.querySelector('[data-action="approve-swarm-activation-hash"]')?.addEventListener('click', () => handlers.approve?.());
}

async function readContract(provider, to, abi, functionName, args = [], blockTag = 'latest') {
  const data = encodeFunctionData({ abi, functionName, args });
  const result = await provider.request({ method: 'eth_call', params: [{ to, data }, blockTag] });
  return decodeFunctionResult({ abi, functionName, data: result });
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
function sameAddressSet(actual, expected) {
  if (!Array.isArray(actual) || actual.length !== expected.length) return false;
  const left = actual.map((value) => getAddress(value).toLowerCase()).sort();
  const right = expected.map((value) => getAddress(value).toLowerCase()).sort();
  return left.every((value, index) => value === right[index]);
}
function isExpectedOwner(value) {
  try { return isAddressEqual(normalizeAddress(value), SWARM_ADMIN_ACTIVATION.owner); } catch { return false; }
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
  if (state.error) return '<p class="swarm-admin-status error" role="alert">' + escapeHtml(state.error) + '</p>';
  if (context.active) return '<p class="swarm-admin-status success" role="status">MissionEscrowV1 is active on Base. No activation action remains.</p>';
  if (context.approved) return '<p class="swarm-admin-status success" role="status">Safe recorded the exact activation hash. Execution remains a separate 2-of-2 Safe step.</p>';
  if (context.activation && !context.activation.timelockElapsed) return '<p class="swarm-admin-status" role="status">Onchain timelock pending. The approval action remains unavailable.</p>';
  if (context.connected && !context.expectedWallet) return '<p class="swarm-admin-status error" role="alert">Wrong wallet. Switch to the owner ending 44aE.</p>';
  if (!context.connected) return '<p class="swarm-admin-status">Connect the required Safe owner to verify Base state. No action is exposed yet.</p>';
  if (!context.activation) return '<p class="swarm-admin-status">Base state has not been verified. No action is exposed.</p>';
  if (context.activation.ready) return '<p class="swarm-admin-status success" role="status">All exact onchain activation guards match. Ready for owner hash approval.</p>';
  return '<p class="swarm-admin-status error" role="alert">Activation guards are not satisfied. No action is exposed.</p>';
}
function escapeHtml(value) { return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'); }
