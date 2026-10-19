import {
  SWARM_LAUNCH_LIMITS,
  SWARM_LAUNCH_OPTIONS,
  buildSwarmLaunchManifest,
  canonicalSwarmLaunchJson,
  evaluateSwarmLaunchGate,
  normalizeSwarmLaunchDraft,
  normalizeSwarmLaunchForm,
} from '../../../../packages/types/src/swarm-launch.js';

export { buildSwarmLaunchManifest, canonicalSwarmLaunchJson, evaluateSwarmLaunchGate, normalizeSwarmLaunchDraft, normalizeSwarmLaunchForm };

const MAX_MEMBERS = SWARM_LAUNCH_LIMITS.maximumMembers;
const ALLOWED_SUPPLIES = new Set(SWARM_LAUNCH_OPTIONS.supplies);
const ALLOWED_CURVES = new Set(SWARM_LAUNCH_OPTIONS.curves);
const ALLOWED_TEMPLATES = new Set(SWARM_LAUNCH_OPTIONS.templates);
const ALLOWED_REVENUE_MODELS = new Set(SWARM_LAUNCH_OPTIONS.revenueModels);
const ALLOWED_SHIP_TARGETS = new Set(SWARM_LAUNCH_OPTIONS.shipTargets);

export function renderSwarmLaunchpad(state = {}) {
  const draft = state.draft ?? { members: [], app: {}, token: {} };
  const members = Array.isArray(draft.members) ? draft.members.slice(0, MAX_MEMBERS) : [];
  const gate = evaluateSwarmLaunchGate({ members });
  const gateMessage = gate.eligible
    ? `<strong>Gate passed.</strong> ${members.length} agents · avg CRED ${gate.averageCred}.`
    : gate.blockers.map((blocker) => `<li>${escapeHtml(blocker)}</li>`).join('');
  const gateMarkup = gate.eligible
    ? `<div class="swarm-launch-gate passed" role="status">${gateMessage}</div>`
    : `<div class="swarm-launch-gate" role="status"><strong>Launch preparation blocked</strong><ul>${gateMessage}</ul></div>`;
  const cards = members.map((member) => renderMember(member)).join('');
  const manifest = state.manifest ? `<section class="swarm-launch-preview-result"><p><strong>Server-verified preparation manifest</strong>${state.manifestSha256 ? ` · <code>${escapeHtml(state.manifestSha256)}</code>` : ''}</p><pre class="swarm-launch-manifest" data-swarm-launch-manifest>${escapeHtml(JSON.stringify(state.manifest, null, 2))}</pre></section>` : '';
  const error = state.error ? `<div class="mission-alert" role="alert">${escapeHtml(state.error)}</div>` : '';
  return `<section class="swarm-launchpad" aria-labelledby="swarm-launchpad-title">
    <header class="swarm-launchpad-hero"><span class="mission-eyebrow">Swarm Command · Launchpad</span><h2 id="swarm-launchpad-title">Form a swarm. Build an app. <em>Launch its token.</em></h2><p>Use verified Looper identities and CRED, define the product, set an exact contribution split, then prepare the Base launch packet.</p></header>
    <nav class="swarm-launch-steps" aria-label="Launch stages"><span>1 · Form swarm</span><span>2 · Spec app</span><span>3 · Set split</span><span>4 · Prepare token</span></nav>
    ${error}<form data-swarm-launch-form>
      <section><h3>Verified swarm</h3><p>First slice uses the authenticated owner’s current Console room. Add or remove owned Loopers there before preparing this manifest.</p><div class="swarm-launch-members">${cards || '<p>No Loopers selected.</p>'}</div>${gateMarkup}</section>
      <section><h3>App specification</h3><div class="swarm-launch-fields"><label>App name<input name="app_name" maxlength="64" value="${escapeAttribute(draft.app?.name ?? '')}" required></label><label>Template<select name="app_template">${options(ALLOWED_TEMPLATES, draft.app?.template)}</select></label><label>Pitch<textarea name="app_pitch" maxlength="1024" required>${escapeHtml(draft.app?.pitch ?? '')}</textarea></label><label>Revenue model<select name="revenue_model">${options(ALLOWED_REVENUE_MODELS, draft.app?.revenueModel)}</select></label><label>Ship target<select name="ship_target">${options(ALLOWED_SHIP_TARGETS, draft.app?.shipTarget)}</select></label></div></section>
      <section><h3>Token preparation</h3><div class="swarm-launch-fields"><label>Token name<input name="token_name" maxlength="32" value="${escapeAttribute(draft.token?.name ?? '')}" required></label><label>Ticker<input name="token_ticker" maxlength="10" value="${escapeAttribute(draft.token?.ticker ?? '')}" required></label><label>Total supply<select name="token_supply">${options(ALLOWED_SUPPLIES, draft.token?.supply)}</select></label><label>Curve<select name="token_curve">${options(ALLOWED_CURVES, draft.token?.curve)}</select></label></div></section>
      <section class="swarm-launch-settlement"><h3>Mosh settlement plan</h3><dl><div><dt>Fee stream</dt><dd>80% member vaults · 20% protocol</dd></div><div><dt>Operator / vault</dt><dd>Separated</dd></div><div><dt>Adapter</dt><dd>Pending verified integration</dd></div></dl></section>
      <p class="swarm-launch-safety"><strong>Preparation only.</strong> No token, vault, curve, or fee stream will be deployed. A separately reviewed adapter and explicit owner approval are required.</p>
      <div class="swarm-launch-actions"><button type="button" data-mission-action="back">Back to missions</button><button type="submit" data-swarm-launch-submit ${gate.eligible && state.status !== 'verifying' ? '' : 'disabled aria-disabled="true"'}>${state.status === 'verifying' ? 'Verifying launch evidence…' : 'Prepare launch manifest'}</button></div>
    </form>${manifest}
  </section>`;
}

export function bindSwarmLaunchpad(root, handlers = {}) {
  root.querySelector('[data-swarm-launch-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    handlers.prepare?.(event);
  });
  root.querySelector('[data-mission-action="back"]')?.addEventListener('click', () => handlers.back?.());
}

function renderMember(member = {}) {
  const score = Number.isInteger(member?.cred?.score) ? member.cred.score : 'unavailable';
  const freshness = member?.cred?.freshness?.stale === false ? 'fresh' : 'not fresh';
  const tokenId = String(member.tokenId ?? '');
  return `<article class="swarm-launch-member" data-swarm-member="${escapeAttribute(tokenId)}"><strong>${escapeHtml(member.name ?? 'Looper')}</strong><span>Looper #${escapeHtml(tokenId)}</span><span>CRED ${escapeHtml(score)} · ${escapeHtml(freshness)}</span><label>Role<input name="member_${escapeAttribute(tokenId)}_role" maxlength="96" value="${escapeAttribute(member.role ?? '')}" required></label><label>Contribution bps<input name="member_${escapeAttribute(tokenId)}_bps" inputmode="numeric" pattern="[1-9][0-9]{0,3}|10000" value="${escapeAttribute(member.contributionBps ?? '')}" required></label></article>`;
}
function options(values, selected) { return [...values].map((value) => `<option value="${escapeAttribute(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(label(value))}</option>`).join(''); }
function label(value) { return String(value).replaceAll('_', ' ').replace(/\b\w/gu, (char) => char.toUpperCase()); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }
function escapeAttribute(value) { return escapeHtml(value); }
