import {
  SWARM_LAUNCH_DEFAULT_ECONOMICS,
  SWARM_LAUNCH_LIMITS,
  SWARM_LAUNCH_OPTIONS,
  buildSwarmLaunchManifest,
  canonicalSwarmLaunchJson,
  evaluateSwarmLaunchGate,
  normalizeSwarmLaunchDraft,
  normalizeSwarmLaunchForm,
  normalizeSwarmLaunchRequestForm,
} from '../../../../packages/types/src/swarm-launch.js';
import { bindSwarmInvitationPanel, renderSwarmInvitationPanel } from './swarm-invitations.js';

export { SWARM_LAUNCH_DEFAULT_ECONOMICS, buildSwarmLaunchManifest, canonicalSwarmLaunchJson, evaluateSwarmLaunchGate, normalizeSwarmLaunchDraft, normalizeSwarmLaunchForm, normalizeSwarmLaunchRequestForm };

const MAX_MEMBERS = SWARM_LAUNCH_LIMITS.maximumMembers;
const ALLOWED_SUPPLIES = new Set(SWARM_LAUNCH_OPTIONS.supplies);
const ALLOWED_CURVES = new Set(SWARM_LAUNCH_OPTIONS.curves);
const ALLOWED_TEMPLATES = new Set(SWARM_LAUNCH_OPTIONS.templates);
const ALLOWED_REVENUE_MODELS = new Set(SWARM_LAUNCH_OPTIONS.revenueModels);
const ALLOWED_SHIP_TARGETS = new Set(SWARM_LAUNCH_OPTIONS.shipTargets);

export function renderSwarmLaunchpad(state = {}) {
  if (state.invitation) {
    const invitations = renderSwarmInvitationPanel({ invitation: state.invitation, mode: 'invitee' });
    const error = state.error ? '<div class="mission-alert" role="alert">' + escapeHtml(state.error) + '</div>' : '';
    return '<section class="swarm-launchpad" aria-labelledby="swarm-launchpad-title"><header class="swarm-launchpad-hero"><span class="mission-eyebrow">Swarm Command · Invitation</span><h2 id="swarm-launchpad-title">Review provisional invitation</h2><p>This review is separate from binding launch preparation.</p></header>' + error + invitations + '<div class="swarm-launch-actions"><button type="button" data-mission-action="back">Back to missions</button></div></section>';
  }
  const pendingInvitations = Array.isArray(state.invitationInbox?.invitations)
    ? state.invitationInbox.invitations.filter((item) => item?.status === 'pending')
    : [];
  if (!state.invitationDraft && pendingInvitations.length) {
    const invitations = renderSwarmInvitationPanel({ inbox: { leadDraft: null, invitations: pendingInvitations }, mode: 'lead' });
    return '<section class="swarm-launchpad swarm-launchpad-inbox" aria-labelledby="swarm-launchpad-title"><header class="swarm-launchpad-hero"><span class="mission-eyebrow">Swarm Command · Invitation</span><h2 id="swarm-launchpad-title">You have a pending swarm invitation.</h2><p>Review the invitation first. Nothing is binding until you explicitly accept, and no launch or transaction is authorized.</p></header>' + invitations + '<div class="swarm-launch-actions"><button type="button" data-mission-action="back">Back to missions</button></div></section>';
  }
  const draft = state.draft ?? { members: [], app: {}, token: {} };
  const members = Array.isArray(draft.members) ? draft.members.slice(0, MAX_MEMBERS) : [];
  const gate = evaluateSwarmLaunchGate({ members });
  const economics = draft.economics ?? SWARM_LAUNCH_DEFAULT_ECONOMICS;
  const locked = Boolean(state.manifest);
  const structurallyReady = members.length >= 3 && members.length <= 5 && members.every((member) => /^[1-9][0-9]*$/u.test(String(member?.tokenId ?? '')) && /^0x[0-9a-fA-F]{40}$/u.test(String(member?.ownerAddress ?? '')) && String(member?.role ?? '').trim() && Number.isInteger(member?.contributionBps) && member.contributionBps > 0) && members.reduce((sum, member) => sum + member.contributionBps, 0) === 10000;
  const gateMarkup = gate.eligible
    ? `<div class="swarm-launch-gate passed" role="status"><strong>Gate passed.</strong> ${members.length} agents · avg CRED ${gate.averageCred}.</div>`
    : `<div class="swarm-launch-gate ${structurallyReady ? 'pending' : ''}" role="status"><strong>${structurallyReady ? 'Ready for server verification' : 'Launch preparation blocked'}</strong><p>The server verifies ownership, controller, and CRED evidence before creating a manifest.</p>${structurallyReady ? '' : `<ul>${gate.blockers.map((blocker) => `<li>${escapeHtml(blocker)}</li>`).join('')}</ul>`}</div>`;
  const cards = members.map((member, index) => renderMember(member, index, members.length)).join('');
  const manifest = state.manifest ? `<section class="swarm-launch-preview-result"><p><strong>Server-verified preparation manifest</strong>${state.manifestSha256 ? ` · <code>${escapeHtml(state.manifestSha256)}</code>` : ''}</p><pre class="swarm-launch-manifest" data-swarm-launch-manifest>${escapeHtml(JSON.stringify(state.manifest, null, 2))}</pre></section>` : '';
  const error = state.error ? `<div class="mission-alert" role="alert">${escapeHtml(state.error)}</div>` : '';
  const consent = renderConsent(state);
  const readiness = renderReadiness(state);
  const invitations = renderSwarmInvitationPanel({ draft: state.invitationDraft, invitation: state.invitation, inbox: state.invitationInbox, mode: state.invitation ? 'invitee' : 'lead' });
  return `<section class="swarm-launchpad" aria-labelledby="swarm-launchpad-title">
    <header class="swarm-launchpad-hero"><span class="mission-eyebrow">Swarm Command · Launchpad</span><h2 id="swarm-launchpad-title">Form a swarm. Build an app. <em>Launch its token.</em></h2><p>Use verified Looper identities and CRED, define the product, set an exact contribution split, then prepare the Base launch packet.</p></header>
    <nav class="swarm-launch-steps" aria-label="Launch stages"><span>1 · Form swarm</span><span>2 · Spec app</span><span>3 · Set split</span><span>4 · Prepare token</span></nav>
    ${error}${invitations}<form data-swarm-launch-form>
      <fieldset class="swarm-launch-editor" ${locked ? 'disabled' : ''}><section><h3>Swarm roster</h3><p>Nominate 3–5 Loopers and the wallet that currently owns and controls each identity. Start from your Console room or add partner-owned Loopers. The server verifies ownership, controller, and CRED evidence.</p><div class="swarm-launch-members">${cards || '<p>No Loopers selected.</p>'}</div><button type="button" data-swarm-launch-add ${members.length >= MAX_MEMBERS ? 'disabled aria-disabled="true"' : ''}>Add another Looper</button>${gateMarkup}</section>
      <section><h3>App specification</h3><div class="swarm-launch-fields"><label>App name<input name="app_name" maxlength="64" value="${escapeAttribute(draft.app?.name ?? '')}" required></label><label>Template<select name="app_template">${options(ALLOWED_TEMPLATES, draft.app?.template)}</select></label><label>Pitch<textarea name="app_pitch" maxlength="1024" required>${escapeHtml(draft.app?.pitch ?? '')}</textarea></label><label>Revenue model<select name="revenue_model">${options(ALLOWED_REVENUE_MODELS, draft.app?.revenueModel)}</select></label><label>Ship target<select name="ship_target">${options(ALLOWED_SHIP_TARGETS, draft.app?.shipTarget)}</select></label></div></section>
      <section><h3>Token preparation</h3><div class="swarm-launch-fields"><label>Token name<input name="token_name" maxlength="32" value="${escapeAttribute(draft.token?.name ?? '')}" required></label><label>Ticker<input name="token_ticker" maxlength="10" value="${escapeAttribute(draft.token?.ticker ?? '')}" required></label><label>Total supply<select name="token_supply">${options(ALLOWED_SUPPLIES, draft.token?.supply)}</select></label><label>Curve<select name="token_curve">${options(ALLOWED_CURVES, draft.token?.curve)}</select></label></div></section>
      <section><h3>Allocation and vesting</h3><p>These terms become part of the manifest every nominated wallet signs. They do not select a launch provider.</p><div class="swarm-launch-fields"><label>Agent vesting bps<input name="agent_vesting_bps" inputmode="numeric" value="${escapeAttribute(economics.agentVestingBps ?? economics.agentVesting?.allocationBps ?? 4500)}" required></label><label>CRED-staker rewards bps<input name="cred_rewards_bps" inputmode="numeric" value="${escapeAttribute(economics.credRewardsBps ?? economics.credRewards?.allocationBps ?? 1500)}" required></label><label>Swarm treasury bps<input name="swarm_treasury_bps" inputmode="numeric" value="${escapeAttribute(economics.swarmTreasuryBps ?? economics.swarmTreasury?.allocationBps ?? 1500)}" required></label><label>Public distribution bps<input name="public_distribution_bps" inputmode="numeric" value="${escapeAttribute(economics.publicDistributionBps ?? economics.publicDistribution?.allocationBps ?? 2500)}" required></label><label>Agent cliff months<input name="agent_cliff_months" inputmode="numeric" value="${escapeAttribute(economics.agentCliffMonths ?? economics.agentVesting?.cliffMonths ?? 6)}" required></label><label>Agent vesting months<input name="agent_vesting_months" inputmode="numeric" value="${escapeAttribute(economics.agentVestingMonths ?? economics.agentVesting?.durationMonths ?? 18)}" required></label></div><p>All allocations must total exactly 10,000 bps.</p></section>
      <p class="swarm-launch-safety"><strong>Preparation only.</strong> No token, vault, curve, or fee stream will be deployed. No external launch integration is selected; any launch infrastructure requires separate review and explicit owner approval.</p></fieldset>
      <div class="swarm-launch-actions"><button type="button" data-mission-action="back">Back to missions</button><button type="submit" data-swarm-launch-submit ${!locked && structurallyReady && state.status !== 'verifying' ? '' : 'disabled aria-disabled="true"'}>${state.status === 'verifying' ? 'Verifying launch evidence…' : locked ? 'Manifest prepared' : 'Prepare launch manifest'}</button></div>
    </form>${manifest}${consent}${readiness}
  </section>`;
}

export function bindSwarmLaunchpad(root, handlers = {}) {
  root.querySelector('[data-swarm-launch-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    handlers.prepare?.(event);
  });
  root.querySelector('[data-mission-action="back"]')?.addEventListener('click', () => handlers.back?.());
  root.querySelector('[data-swarm-launch-add]')?.addEventListener('click', () => handlers.addMember?.());
  root.querySelectorAll('[data-swarm-launch-remove]').forEach((button) => button.addEventListener('click', () => handlers.removeMember?.(Number(button.dataset.swarmLaunchRemove))));
  root.querySelector('[data-swarm-launch-consent-create]')?.addEventListener('click', () => handlers.createConsent?.());
  root.querySelector('[data-swarm-launch-consent-sign]')?.addEventListener('click', () => handlers.signConsent?.());
  root.querySelector('[data-swarm-launch-readiness-create]')?.addEventListener('click', () => handlers.createReadiness?.());
  bindSwarmInvitationPanel(root, { create: handlers.createInvitationDraft, add: handlers.addInvitation, revoke: handlers.revokeInvitation, close: handlers.closeInvitationDraft, respond: handlers.respondInvitation, copy: handlers.copyInvitation, open: handlers.openInvitation });
}


function renderMember(member = {}, index, count) {
  const score = Number.isInteger(member?.cred?.score) ? member.cred.score : 'unavailable';
  const freshness = member?.cred?.freshness?.stale === false ? 'fresh' : 'not fresh';
  const tokenId = String(member.tokenId ?? '');
  return `<article class="swarm-launch-member" data-swarm-member="${escapeAttribute(String(index))}"><strong>${escapeHtml(member.name ?? 'Partner Looper')}</strong><span>${Number.isInteger(member?.cred?.score) ? `CRED ${escapeHtml(score)} · ${escapeHtml(freshness)}` : 'Canonical evidence verified by server'}</span><label>Looper token ID<input name="member_${index}_token" inputmode="numeric" pattern="[1-9][0-9]*" value="${escapeAttribute(tokenId)}" required></label><label>Owner wallet<input name="member_${index}_owner" value="${escapeAttribute(member.ownerAddress ?? '')}" pattern="0x[0-9a-fA-F]{40}" required></label><label>Role<input name="member_${index}_role" maxlength="96" value="${escapeAttribute(member.role ?? '')}" required></label><label>Contribution bps<input name="member_${index}_bps" inputmode="numeric" pattern="[1-9][0-9]{0,3}|10000" value="${escapeAttribute(member.contributionBps ?? '')}" required></label>${count > 3 ? `<button type="button" data-swarm-launch-remove="${index}">Remove</button>` : ''}</article>`;
}
function renderConsent(state) {
  if (!state.manifest || !state.manifestSha256) return '';
  if (!state.proposal) return `<section class="swarm-launch-consent"><h3>Wallet consent</h3><p>Create a 24-hour request so every nominated owner can review and sign this exact manifest.</p><button type="button" data-swarm-launch-consent-create ${state.status === 'creating_consent' ? 'disabled' : ''}>${state.status === 'creating_consent' ? 'Creating consent request…' : 'Create consent request'}</button></section>`;
  const pending = state.proposal.participants.filter((entry) => entry.consentedAt === null);
  const wallet = String(state.authenticatedWallet ?? '').toLowerCase();
  const current = state.proposal.participants.find((entry) => entry.wallet === wallet);
  const rows = state.proposal.participants.map((entry) => `<li><code>${escapeHtml(shortAddress(entry.wallet))}</code> · Loopers ${entry.tokenIds.map(escapeHtml).join(', ')} · ${entry.consentedAt === null ? 'pending' : 'signed'}</li>`).join('');
  const expired = state.proposal.status === 'EXPIRED';
  const collected = state.proposal.status === 'SIGNATURES_COLLECTED';
  return `<section class="swarm-launch-consent"><h3>${expired ? 'Consent request expired' : collected ? 'Signatures collected' : `Awaiting ${pending.length} wallet consent${pending.length === 1 ? '' : 's'}`}</h3><p><strong>Deployment authorized: false.</strong> Signatures bind this preparation manifest only. Ownership, controller, and CRED must be revalidated before any future launch.</p><ul>${rows}</ul>${state.consentUrl ? `<label>Share request<input readonly value="${escapeAttribute(state.consentUrl)}"></label>` : ''}${!expired && current?.consentedAt === null ? `<button type="button" data-swarm-launch-consent-sign ${state.status === 'signing_consent' ? 'disabled' : ''}>${state.status === 'signing_consent' ? 'Signing consent…' : 'Sign launch consent'}</button>` : ''}${collected && !state.readiness ? `<p>Unanimous preparation consent is complete. Build a deterministic packet for provider review and Base-fork simulation.</p><button type="button" data-swarm-launch-readiness-create ${state.status === 'building_readiness' ? 'disabled' : ''}>${state.status === 'building_readiness' ? 'Building readiness packet…' : 'Build readiness packet'}</button>` : ''}</section>`;
}
function renderReadiness(state) {
  if (!state.readiness?.packet || !/^0x[0-9a-f]{64}$/u.test(state.readiness.packetSha256 ?? '')) return '';
  const packet = state.readiness.packet;
  return `<section class="swarm-launch-readiness"><h3>Simulation-only readiness packet</h3><p><strong>Deployment authorized: false.</strong> Provider selected: ${escapeHtml(String(packet.execution?.providerSelected === true))}. Transactions: ${escapeHtml(String(packet.execution?.transactionCount ?? 0))}.</p><p>Packet hash · <code>${escapeHtml(state.readiness.packetSha256)}</code></p><pre class="swarm-launch-manifest" data-swarm-launch-readiness>${escapeHtml(JSON.stringify(packet, null, 2))}</pre></section>`;
}
function shortAddress(value) { const text=String(value??''); return text.length===42 ? text.slice(0,6)+'…'+text.slice(-4) : text; }
function options(values, selected) { return [...values].map((value) => `<option value="${escapeAttribute(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(label(value))}</option>`).join(''); }
function label(value) { return String(value).replaceAll('_', ' ').replace(/\b\w/gu, (char) => char.toUpperCase()); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }
function escapeAttribute(value) { return escapeHtml(value); }
