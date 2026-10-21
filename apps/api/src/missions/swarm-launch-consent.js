import { createHash } from 'node:crypto';
import { buildSwarmLaunchReadinessPacket, canonicalSwarmLaunchJson } from '../../../../packages/types/src/swarm-launch.js';

const ADDRESS = /^0x[0-9a-f]{40}$/u;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const MANIFEST_HASH = /^0x[0-9a-f]{64}$/u;
const SIGNATURE = /^0x[0-9a-fA-F]{2,8192}$/u;
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const MONTH_SECONDS = 2_592_000;
const START_DELAY_SECONDS = 604_800;
const EXECUTION_TIMING_POLICY = 'SOURCE_CONSENT_EXPIRY_PLUS_7D_30D_MONTHS_V1';

export function createSwarmLaunchConsentService({ store, preview, authorizeLooper, verifySignature, createId, now = Date.now, ttlMs = DEFAULT_TTL_MS, factoryAddress = null, executionArtifacts = null, executionPacketBuilder = null, executionPacketVerifier = null } = {}) {
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
  async function createReadiness(actorAddress, proposalId) {
    const { actor, record } = await loadParty(actorAddress, proposalId);
    const currentTime = timestamp(now(), 'readinessAt');
    const proposal = project(record, currentTime);
    const packet = buildSwarmLaunchReadinessPacket({ proposal, now: currentTime });
    const refreshed = await preview({ owner: actor, input: record.input });
    assertPrepared(refreshed);
    if (refreshed.manifestSha256 !== record.manifestSha256) throw new ConsentError('manifest_changed', 'Canonical launch manifest changed; create a new consent proposal.', 409);
    return Object.freeze({ packet, packetSha256: '0x' + createHash('sha256').update(canonicalSwarmLaunchJson(packet)).digest('hex') });
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
    async createReadinessPacket({ actorAddress, proposalId } = {}) {
      return createReadiness(actorAddress, proposalId);
    },
    async createExecutionPreview({ actorAddress, proposalId, input } = {}) {
      const { record } = await loadParty(actorAddress, proposalId);
      const readiness = await createReadiness(actorAddress, proposalId);
      const current = project(record, now());
      if (current.status !== 'SIGNATURES_COLLECTED') throw new ConsentError('consent_changed', 'Unanimous live consent is required.', 409);
      if (!factoryAddress || typeof executionPacketBuilder !== 'function' || typeof executionPacketVerifier !== 'function' || !executionArtifacts) throw new ConsentError('not_configured', 'Swarm launch execution factory is not configured.', 503);
      const factory = nonzeroAddress(factoryAddress, 'factory address');
      const conversion = executionConversion(input, readiness.packet, readiness.packetSha256);
      const built = await executionPacketBuilder({
        chainId: 8453,
        factoryAddress: factory,
        readinessPacketSha256: readiness.packetSha256,
        readinessManifest: readiness.packet,
        consentManifest: record.manifest,
        conversion,
        artifacts: executionArtifacts,
      });
      const report = await executionPacketVerifier(built, { artifacts: executionArtifacts });
      if (report?.status !== 'VERIFIED_OFFLINE') throw new TypeError('Execution preview packet did not pass exact offline verification.');
      if (built.manifest.execution?.mode !== 'PREPARATION_ONLY' || built.manifest.execution?.deploymentAuthorized !== false || built.manifest.execution?.broadcastPrepared !== false || built.manifest.execution?.transactionCount !== 0 || built.manifest.authorization?.status !== 'NOT_ATTACHED' || built.manifest.authorization?.signatures?.length !== 0) throw new TypeError('Execution preview packet is not unsigned preparation-only material.');
      return Object.freeze({ packet: built.manifest, packetSha256: built.manifestSha256 });
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
function executionConversion(input, readiness, readinessPacketSha256) {
  exactKeys(input, ['beneficiaries', 'recipients', 'revenueAssets'], 'execution preview request');
  if (!Array.isArray(input.beneficiaries)) throw new TypeError('Execution beneficiaries are invalid.');
  const byToken = new Map();
  for (const entry of input.beneficiaries) {
    exactKeys(entry, ['tokenId', 'beneficiary'], 'execution beneficiary');
    const tokenId = normalizeTokenIds([entry.tokenId])[0];
    if (byToken.has(tokenId)) throw new TypeError('Execution beneficiaries contain duplicate members.');
    byToken.set(tokenId, nonzeroAddress(entry.beneficiary, 'beneficiary'));
  }
  const expected = readiness.agentVesting.allocations.map((entry) => entry.tokenId);
  if (byToken.size !== expected.length || expected.some((tokenId) => !byToken.has(tokenId))) throw new TypeError('Execution beneficiaries must resolve every consented member exactly once.');
  const members = expected.map((tokenId) => Object.freeze({ tokenId, beneficiary: byToken.get(tokenId) }));
  if (new Set(members.map((entry) => entry.beneficiary)).size !== members.length) throw new TypeError('Execution beneficiaries must be unique.');
  exactKeys(input.recipients, ['credRewards', 'swarmTreasury', 'publicDistribution'], 'execution recipients');
  const recipientAddresses = ['credRewards', 'swarmTreasury', 'publicDistribution'].map((field) => nonzeroAddress(input.recipients[field], field + ' recipient'));
  if (new Set(recipientAddresses).size !== recipientAddresses.length) throw new TypeError('Execution recipients must be distinct.');
  const recipients = Object.freeze({
    credRewards: Object.freeze({ mechanism: 'DIRECT_FIXED_RECIPIENT', recipient: recipientAddresses[0] }),
    swarmTreasury: Object.freeze({ mechanism: 'DIRECT_FIXED_RECIPIENT', recipient: recipientAddresses[1] }),
    publicDistribution: Object.freeze({ mechanism: 'DIRECT_FIXED_RECIPIENT', recipient: recipientAddresses[2] }),
  });
  if (!Array.isArray(input.revenueAssets) || input.revenueAssets.length < 1 || input.revenueAssets.length > 4) throw new TypeError('Execution revenue assets must contain one to four addresses.');
  const revenueAssets = input.revenueAssets.map((entry) => address(entry));
  if (new Set(revenueAssets).size !== revenueAssets.length) throw new TypeError('Execution revenue assets must be unique.');
  const authorizationDeadline = onchainTimestamp(readiness.sourceConsent.expiresAt);
  const timing = Object.freeze({
    policy: EXECUTION_TIMING_POLICY,
    authorizationDeadline,
    start: authorizationDeadline + START_DELAY_SECONDS,
    cliff: readiness.agentVesting.cliffMonths * MONTH_SECONDS,
    duration: readiness.agentVesting.durationMonths * MONTH_SECONDS,
  });
  const seed = { schema: 'multipass.swarm-launch-execution-conversion.v1', parentReadinessSha256: readinessPacketSha256, timing, members, recipients, revenueAssets };
  const deploymentSalt = '0x' + createHash('sha256').update('HELIXA_SWARM_LAUNCH_EXECUTION_SALT_V1\n' + canonicalSwarmLaunchJson(seed)).digest('hex');
  return Object.freeze({ ...seed, deploymentSalt });
}
function exactKeys(value, required, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new TypeError(label + ' is invalid.');
  const actual = Object.keys(value).sort(); const expected = [...required].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new TypeError(label + ' contains unknown or missing fields.');
}
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
    economics: { agentVestingBps: manifest.economics.agentVesting.allocationBps, credRewardsBps: manifest.economics.credRewards.allocationBps, swarmTreasuryBps: manifest.economics.swarmTreasury.allocationBps, publicDistributionBps: manifest.economics.publicDistribution.allocationBps, agentCliffMonths: manifest.economics.agentVesting.cliffMonths, agentVestingMonths: manifest.economics.agentVesting.durationMonths },
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
function nonzeroAddress(value,label){const normalized=address(value);if(normalized===ZERO_ADDRESS)throw new TypeError(label+' must not be the zero address.');return normalized;}
function identifier(value,label){const text=String(value??'');if(!ID.test(text))throw new TypeError(label+' is invalid.');return text;}
function manifestHash(value){const text=String(value??'').toLowerCase();if(!MANIFEST_HASH.test(text))throw new TypeError('manifestSha256 is invalid.');return text;}
function normalizeTokenIds(value){if(!Array.isArray(value)||value.length<1||value.length>5)throw new TypeError('tokenIds is invalid.');const ids=value.map((entry)=>{const text=String(entry??'');if(!/^[1-9][0-9]*$/u.test(text))throw new TypeError('tokenId is invalid.');return text;});if(new Set(ids).size!==ids.length)throw new TypeError('tokenIds contains duplicates.');return ids;}
function timestamp(value,label){const number=Number(value);if(!Number.isSafeInteger(number)||number<0)throw new TypeError(label+' is invalid.');return number;}
function onchainTimestamp(value){const number=timestamp(value,'consent expiry');return number>10_000_000_000?Math.floor(number/1000):number;}

