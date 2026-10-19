import { createHash } from 'node:crypto';

const ADDRESS = /^0x[0-9a-f]{40}$/u;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const MANIFEST_HASH = /^0x[0-9a-f]{64}$/u;
const SIGNATURE = /^0x[0-9a-fA-F]{2,8192}$/u;
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export function createSwarmLaunchConsentService({ store, preview, authorizeLooper, verifySignature, createId, now = Date.now, ttlMs = DEFAULT_TTL_MS } = {}) {
  for (const [label, value] of Object.entries({ preview, authorizeLooper, verifySignature, createId, now })) if (typeof value !== 'function') throw new TypeError(label + ' is required.');
  if (!store || !['create', 'read', 'consent'].every((method) => typeof store[method] === 'function')) throw new TypeError('Consent store is invalid.');
  if (!Number.isSafeInteger(ttlMs) || ttlMs < 60_000 || ttlMs > 7 * DEFAULT_TTL_MS) throw new TypeError('Consent TTL is invalid.');

  async function loadParty(actorAddress, proposalId) {
    const actor = address(actorAddress);
    const record = store.read(identifier(proposalId, 'proposalId'));
    if (!record) throw new ConsentError('not_found', 'Consent proposal not found.', 404);
    const participant = record.participants.find((entry) => entry.wallet === actor);
    if (!participant) throw new ConsentError('forbidden', 'Wallet is not nominated for this consent proposal.', 403);
    return { actor, record, participant };
  }

  return Object.freeze({
    async createProposal({ actorAddress, input } = {}) {
      const actor = address(actorAddress);
      const prepared = await preview({ owner: actor, input });
      assertPrepared(prepared);
      const participants = participantsFromManifest(prepared.manifest);
      if (!participants.some((entry) => entry.wallet === actor)) throw new ConsentError('forbidden', 'Initiating wallet is not part of the launch roster.', 403);
      const createdAt = timestamp(now(), 'createdAt');
      const record = store.create({
        proposalId: identifier(createId(), 'proposalId'), initiatorWallet: actor,
        manifestSha256: prepared.manifestSha256, manifest: prepared.manifest,
        input: canonicalInputFromManifest(prepared.manifest), participants, createdAt, expiresAt: createdAt + ttlMs,
      });
      return project(record, createdAt);
    },
    async readProposal({ actorAddress, proposalId } = {}) {
      const { record } = await loadParty(actorAddress, proposalId);
      return project(record, now());
    },
    async readChallenge({ actorAddress, proposalId } = {}) {
      const { actor, record, participant } = await loadParty(actorAddress, proposalId);
      assertLive(record, now());
      return Object.freeze({
        proposalId: record.proposalId,
        manifestSha256: record.manifestSha256,
        expiresAt: record.expiresAt,
        message: buildSwarmLaunchConsentMessage({ proposalId: record.proposalId, manifestSha256: record.manifestSha256, wallet: actor, tokenIds: participant.tokenIds, expiresAt: record.expiresAt }),
      });
    },
    async recordConsent({ actorAddress, proposalId, signature } = {}) {
      const { actor, record, participant } = await loadParty(actorAddress, proposalId);
      assertLive(record, now());
      const signatureHex = String(signature ?? '').trim();
      if (!SIGNATURE.test(signatureHex)) throw new TypeError('Consent signature is invalid.');
      const refreshed = await preview({ owner: actor, input: record.input });
      assertPrepared(refreshed);
      if (refreshed.manifestSha256 !== record.manifestSha256) throw new ConsentError('manifest_changed', 'Canonical launch manifest changed; create a new consent proposal.', 409);
      for (const tokenId of participant.tokenIds) {
        const authorization = await authorizeLooper({ tokenId, wallet: actor });
        if (String(authorization?.tokenId ?? '') !== tokenId || String(authorization?.owner ?? '').toLowerCase() !== actor || authorization?.controllerVerified !== true) {
          throw new ConsentError('control_changed', 'Current wallet no longer controls every nominated Looper.', 403);
        }
      }
      const message = buildSwarmLaunchConsentMessage({ proposalId: record.proposalId, manifestSha256: record.manifestSha256, wallet: actor, tokenIds: participant.tokenIds, expiresAt: record.expiresAt });
      if (!await verifySignature({ wallet: actor, message, signature: signatureHex })) throw new ConsentError('signature_invalid', 'Consent signature did not verify.', 403);
      const consentedAt = timestamp(now(), 'consentedAt');
      assertLive(record, consentedAt);
      const updated = store.consent({ proposalId: record.proposalId, wallet: actor, signatureHash: createHash('sha256').update(signatureHex.toLowerCase()).digest('hex'), consentedAt });
      return project(updated, consentedAt);
    },
  });
}

export function buildSwarmLaunchConsentMessage({ proposalId, manifestSha256, wallet, tokenIds, expiresAt } = {}) {
  const id = identifier(proposalId, 'proposalId');
  const manifest = manifestHash(manifestSha256);
  const authority = address(wallet);
  const ids = normalizeTokenIds(tokenIds);
  const expiry = timestamp(expiresAt, 'expiresAt');
  return ['HELIXA SWARM LAUNCH CONSENT V1', 'Proposal: ' + id, 'Manifest: ' + manifest, 'Chain: Base (8453)', 'Consent authority: ' + authority, 'Loopers: ' + ids.join(','), 'Expires: ' + expiry, 'Execution: PREPARATION_ONLY', 'Deployment authorized: false'].join('\n');
}

export class ConsentError extends Error { constructor(code, message, status) { super(message); this.name = 'ConsentError'; this.code = code; this.status = status; } }

function assertPrepared(value) { if (!value || !MANIFEST_HASH.test(value.manifestSha256 ?? '') || value.manifest?.execution?.mode !== 'PREPARATION_ONLY' || value.manifest?.execution?.deploymentAuthorized !== false) throw new TypeError('Prepared launch manifest is invalid.'); }
function participantsFromManifest(manifest) {
  const groups = new Map();
  for (const member of manifest?.members ?? []) {
    const wallet = address(member?.consentAuthority);
    const tokenId = normalizeTokenIds([member?.identity?.tokenId])[0];
    const list = groups.get(wallet) ?? []; list.push(tokenId); groups.set(wallet, list);
  }
  if (groups.size < 1 || groups.size > 5) throw new TypeError('Launch consent participants are invalid.');
  return [...groups].sort(([left], [right]) => left.localeCompare(right)).map(([wallet, tokenIds]) => Object.freeze({ wallet, tokenIds: Object.freeze(tokenIds.sort((a,b)=>BigInt(a)<BigInt(b)?-1:BigInt(a)>BigInt(b)?1:0)) }));
}
function canonicalInputFromManifest(manifest) {
  return {
    members: manifest.members.map((member) => ({ tokenId: member.identity.tokenId, ownerAddress: member.consentAuthority, role: member.role, contributionBps: member.contributionBps })),
    app: { name: manifest.app.name, pitch: manifest.app.pitch, template: manifest.app.template, revenueModel: manifest.app.revenueModel, shipTarget: manifest.app.shipTarget },
    token: { name: manifest.token.name, ticker: manifest.token.ticker, supply: manifest.token.supply, curve: manifest.token.curve },
  };
}
function project(record, currentTime) {
  const consentByWallet = new Map((record.consents ?? []).map((entry) => [entry.wallet, entry.consentedAt]));
  const participants = record.participants.map((entry) => Object.freeze({ wallet: entry.wallet, tokenIds: Object.freeze([...entry.tokenIds]), consentedAt: consentByWallet.get(entry.wallet) ?? null }));
  const complete = participants.every((entry) => entry.consentedAt !== null);
  const expired = timestamp(currentTime, 'now') >= record.expiresAt;
  const status = expired ? 'EXPIRED' : complete ? 'SIGNATURES_COLLECTED' : 'COLLECTING_CONSENT';
  return Object.freeze({ proposalId: record.proposalId, status, deploymentAuthorized: false, revalidationRequired: true, manifestSha256: record.manifestSha256, manifest: record.manifest, participants: Object.freeze(participants), createdAt: record.createdAt, expiresAt: record.expiresAt });
}
function assertLive(record, value) { if (timestamp(value, 'now') >= record.expiresAt) throw new ConsentError('expired', 'Consent proposal expired.', 409); }
function address(value){const text=String(value??'').toLowerCase();if(!ADDRESS.test(text))throw new TypeError('wallet is invalid.');return text;}
function identifier(value,label){const text=String(value??'');if(!ID.test(text))throw new TypeError(label+' is invalid.');return text;}
function manifestHash(value){const text=String(value??'').toLowerCase();if(!MANIFEST_HASH.test(text))throw new TypeError('manifestSha256 is invalid.');return text;}
function normalizeTokenIds(value){if(!Array.isArray(value)||value.length<1||value.length>5)throw new TypeError('tokenIds is invalid.');const ids=value.map((entry)=>{const text=String(entry??'');if(!/^[1-9][0-9]*$/u.test(text))throw new TypeError('tokenId is invalid.');return text;});if(new Set(ids).size!==ids.length)throw new TypeError('tokenIds contains duplicates.');return ids;}
function timestamp(value,label){const number=Number(value);if(!Number.isSafeInteger(number)||number<0)throw new TypeError(label+' is invalid.');return number;}

