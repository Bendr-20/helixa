import { createHash } from 'node:crypto';
import { SWARM_LAUNCH_CHAIN_ID, SWARM_LAUNCH_LOOPERS_COLLECTION, buildSwarmLaunchManifest, canonicalSwarmLaunchJson } from '../../../../packages/types/src/swarm-launch.js';

export async function previewSwarmLaunch({ owner, input, loadOwnedAgents } = {}) {
  const address = normalizeAddress(owner);
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Swarm launch preview is invalid.');
  if (typeof loadOwnedAgents !== 'function') throw new TypeError('Owned Looper verification is unavailable.');
  const requests = normalizeMemberRequests(input.members, address);
  if (!requests.some((request) => request.ownerAddress === address)) throw new TypeError('The initiating wallet must control at least one nominated Looper.');
  const ownerAgents = new Map();
  for (const ownerAddress of [...new Set(requests.map((request) => request.ownerAddress))]) {
    const owned = await loadOwnedAgents({ address: ownerAddress });
    if (!Array.isArray(owned)) throw new TypeError('Owned Looper verification is unavailable.');
    ownerAgents.set(ownerAddress, new Map(owned.map((agent) => [canonicalTokenId(agent?.tokenId), agent])));
  }
  const members = requests.map((request) => {
    const agent = ownerAgents.get(request.ownerAddress)?.get(request.tokenId);
    if (!agent) throw new TypeError('Every launch member must be owned by its nominated consent wallet.');
    if (Number(agent.chainId) !== SWARM_LAUNCH_CHAIN_ID
      || String(agent.contract ?? '').toLowerCase() !== SWARM_LAUNCH_LOOPERS_COLLECTION.toLowerCase()
      || String(agent.owner ?? '').toLowerCase() !== request.ownerAddress
      || agent.controllerVerified !== true) throw new TypeError('Canonical Looper ownership and controller evidence is required.');
    return {
      tokenId: request.tokenId,
      ownerAddress: request.ownerAddress,
      name: bounded(String(agent.name ?? ''), 1, 128, 'member name'),
      role: request.role,
      contributionBps: request.contributionBps,
      cred: agent.cred,
      erc8004Id: SWARM_LAUNCH_CHAIN_ID + ':' + canonicalTokenId(agent.erc8004AgentId),
    };
  });
  const manifest = buildSwarmLaunchManifest({ members, app: input.app, token: input.token, economics: input.economics, workspace: input.workspace });
  const canonical = canonicalSwarmLaunchJson(manifest);
  return Object.freeze({
    schemaVersion: '0.1.0',
    status: 'PREPARATION_ONLY',
    manifest,
    manifestSha256: '0x' + createHash('sha256').update(canonical).digest('hex'),
  });
}

function normalizeMemberRequests(values, defaultOwner) {
  if (!Array.isArray(values) || values.length < 3 || values.length > 5) throw new TypeError('Select three to five Loopers.');
  const normalized = values.map((member) => ({
    tokenId: canonicalTokenId(member?.tokenId),
    ownerAddress: normalizeAddress(member?.ownerAddress ?? defaultOwner),
    role: bounded(member?.role, 1, 96, 'member role'),
    contributionBps: boundedInteger(member?.contributionBps, 1, 10_000, 'contribution'),
  }));
  if (new Set(normalized.map((member) => member.tokenId)).size !== normalized.length) throw new TypeError('Swarm contains a duplicate Looper identity.');
  return normalized;
}
function normalizeAddress(value) { const address = String(value ?? '').toLowerCase(); if (!/^0x[0-9a-f]{40}$/u.test(address)) throw new TypeError('Owner address is invalid.'); return address; }
function canonicalTokenId(value) { const text = String(value ?? ''); if (!/^[1-9][0-9]*$/u.test(text)) throw new TypeError('Looper token ID is invalid.'); return text; }
function bounded(value, min, max, label) { if (typeof value !== 'string' || value.length < min || value.length > max) throw new TypeError(label + ' is invalid.'); return value; }
function boundedInteger(value, min, max, label) { if (!Number.isSafeInteger(value) || value < min || value > max) throw new TypeError(label + ' is invalid.'); return value; }
