import {
  SWARM_LAUNCH_CRED_POLICY,
  SWARM_LAUNCH_DEFAULT_ECONOMICS,
  SWARM_LAUNCH_LIMITS,
  SWARM_LAUNCH_OPTIONS,
  buildSwarmLaunchManifest,
  canonicalSwarmLaunchJson,
  evaluateSwarmLaunchGate,
  normalizeSwarmLaunchDraft,
  normalizeSwarmLaunchForm,
  normalizeSwarmLaunchRequestForm,
  normalizeSwarmLaunchWorkspaceRequest,
} from '../../../../packages/types/src/swarm-launch.js';
import { bindSwarmInvitationPanel, deriveSwarmLaunchDraftFromInvitation, renderSwarmInvitationPanel } from './swarm-invitations.js';

export { SWARM_LAUNCH_DEFAULT_ECONOMICS, buildSwarmLaunchManifest, canonicalSwarmLaunchJson, deriveSwarmLaunchDraftFromInvitation, evaluateSwarmLaunchGate, normalizeSwarmLaunchDraft, normalizeSwarmLaunchForm, normalizeSwarmLaunchRequestForm };

const MAX_MEMBERS = SWARM_LAUNCH_LIMITS.maximumMembers;
const ALLOWED_SUPPLIES = new Set(SWARM_LAUNCH_OPTIONS.supplies);
const ALLOWED_CURVES = new Set(SWARM_LAUNCH_OPTIONS.curves);
const ALLOWED_TEMPLATES = new Set(SWARM_LAUNCH_OPTIONS.templates);
const ALLOWED_REVENUE_MODELS = new Set(SWARM_LAUNCH_OPTIONS.revenueModels);
const ALLOWED_SHIP_TARGETS = new Set(SWARM_LAUNCH_OPTIONS.shipTargets);

export function serializeSwarmLaunchRequest(draft = {}) {
  const members = Array.isArray(draft.members) ? draft.members.map((member) => ({
    tokenId: String(member?.tokenId ?? '').trim(),
    ownerAddress: String(member?.ownerAddress ?? '').trim().toLowerCase(),
    role: String(member?.role ?? '').trim(),
    contributionBps: Number(member?.contributionBps),
  })) : [];
  const economics = draft.economics ?? SWARM_LAUNCH_DEFAULT_ECONOMICS;
  const workspace = draft.workspace ?? {};
  const workspaceMembers = Array.isArray(workspace.members) ? workspace.members : [];
  const mirrorEnabled = workspace.githubMirror?.enabled === true;
  return {
    members,
    app: { name: String(draft.app?.name ?? '').trim(), pitch: String(draft.app?.pitch ?? '').trim(), template: String(draft.app?.template ?? '').trim(), revenueModel: String(draft.app?.revenueModel ?? '').trim(), shipTarget: String(draft.app?.shipTarget ?? '').trim() },
    token: { name: String(draft.token?.name ?? '').trim(), ticker: String(draft.token?.ticker ?? '').trim().toUpperCase(), supply: String(draft.token?.supply ?? '').trim(), curve: String(draft.token?.curve ?? '').trim() },
    economics: {
      agentVestingBps: economics.agentVestingBps ?? economics.agentVesting?.allocationBps,
      credRewardsBps: economics.credRewardsBps ?? economics.credRewards?.allocationBps,
      swarmTreasuryBps: economics.swarmTreasuryBps ?? economics.swarmTreasury?.allocationBps,
      publicDistributionBps: economics.publicDistributionBps ?? economics.publicDistribution?.allocationBps,
      agentCliffMonths: economics.agentCliffMonths ?? economics.agentVesting?.cliffMonths,
      agentVestingMonths: economics.agentVestingMonths ?? economics.agentVesting?.durationMonths,
    },
    workspace: {
      provider: String(workspace.provider ?? '').trim(),
      repository: { slug: String(workspace.repository?.slug ?? '').trim(), visibility: String(workspace.repository?.visibility ?? '').trim() },
      members: members.map((member) => {
        const identity = workspaceMembers.find((entry) => String(entry?.tokenId ?? '').trim() === member.tokenId);
        return { tokenId: member.tokenId, didKey: String(identity?.didKey ?? '').trim() };
      }),
      githubMirror: { enabled: mirrorEnabled, owner: mirrorEnabled ? String(workspace.githubMirror?.owner ?? '').trim() : null, repository: mirrorEnabled ? String(workspace.githubMirror?.repository ?? '').trim() : null },
    },
  };
}

export function renderSwarmLaunchpad(state = {}) {
  if (state.invitation) {
    const invitations = renderSwarmInvitationPanel({ invitation: state.invitation, room: state.swarmRoom, mode: 'invitee', responding: state.status === 'responding_invitation', decision: state.invitationDecision });
    const error = state.error ? '<div class="mission-alert" role="alert">' + escapeHtml(state.error) + '</div>' : '';
    const returnLabel = state.invitation.status === 'accepted' ? 'Return to missions' : 'Back to missions';
    return '<section class="swarm-launchpad" aria-labelledby="swarm-launchpad-title"><header class="swarm-launchpad-hero"><span class="mission-eyebrow">Swarm Command · Invitation</span><h2 id="swarm-launchpad-title">Review provisional invitation</h2><p>This review is separate from binding launch preparation.</p></header>' + error + invitations + '<div class="swarm-launch-actions"><button type="button" data-mission-action="back">' + returnLabel + '</button></div></section>';
  }
  const pendingInvitations = Array.isArray(state.invitationInbox?.invitations)
    ? state.invitationInbox.invitations.filter((item) => item?.status === 'pending')
    : [];
  if (!state.invitationDraft && pendingInvitations.length) {
    const invitations = renderSwarmInvitationPanel({ inbox: { leadDraft: null, invitations: pendingInvitations }, room: state.swarmRoom, mode: 'lead' });
    return '<section class="swarm-launchpad swarm-launchpad-inbox" aria-labelledby="swarm-launchpad-title"><header class="swarm-launchpad-hero"><span class="mission-eyebrow">Swarm Command · Invitation</span><h2 id="swarm-launchpad-title">You have a pending swarm invitation.</h2><p>Review the invitation first. Nothing is binding until you explicitly accept, and no launch or transaction is authorized.</p></header>' + invitations + '<div class="swarm-launch-actions"><button type="button" data-mission-action="back">Back to missions</button></div></section>';
  }
  const draft = state.draft ?? { members: [], app: {}, token: {} };
  const members = Array.isArray(draft.members) ? draft.members.slice(0, MAX_MEMBERS) : [];
  const gate = evaluateSwarmLaunchGate({ members });
  const economics = draft.economics ?? SWARM_LAUNCH_DEFAULT_ECONOMICS;
  const workspace = draft.workspace ?? {};
  const workspaceRepository = workspace.repository ?? {};
  const workspaceMembers = Array.isArray(workspace.members) ? workspace.members : [];
  const githubMirror = workspace.githubMirror ?? { enabled: false, owner: null, repository: null };
  const locked = Boolean(state.manifest);
  let workspaceReady = false;
  try { normalizeSwarmLaunchWorkspaceRequest(workspace, members.map((member) => ({ tokenId: String(member?.tokenId ?? '') }))); workspaceReady = true; } catch {}
  const appReady = String(draft.app?.name ?? '').trim().length > 0 && String(draft.app?.pitch ?? '').trim().length > 0 && ALLOWED_TEMPLATES.has(draft.app?.template) && ALLOWED_REVENUE_MODELS.has(draft.app?.revenueModel) && ALLOWED_SHIP_TARGETS.has(draft.app?.shipTarget);
  const tokenReady = String(draft.token?.name ?? '').trim().length > 0 && /^[A-Z][A-Z0-9]{1,9}$/u.test(String(draft.token?.ticker ?? '').trim()) && ALLOWED_SUPPLIES.has(String(draft.token?.supply ?? '')) && ALLOWED_CURVES.has(draft.token?.curve);
  const allocations = [economics.agentVestingBps ?? economics.agentVesting?.allocationBps, economics.credRewardsBps ?? economics.credRewards?.allocationBps, economics.swarmTreasuryBps ?? economics.swarmTreasury?.allocationBps, economics.publicDistributionBps ?? economics.publicDistribution?.allocationBps];
  const economicsReady = allocations.every((value) => Number.isInteger(value) && value >= 0) && allocations.reduce((sum, value) => sum + value, 0) === 10000;
  const structurallyReady = workspaceReady && appReady && tokenReady && economicsReady && members.length >= 3 && members.length <= 5 && members.every((member) => /^[1-9][0-9]*$/u.test(String(member?.tokenId ?? '')) && /^0x[0-9a-fA-F]{40}$/u.test(String(member?.ownerAddress ?? '')) && String(member?.role ?? '').trim() && Number.isInteger(member?.contributionBps) && member.contributionBps > 0) && members.reduce((sum, member) => sum + member.contributionBps, 0) === 10000;
  const workspaceBlocker = workspaceReady ? [] : ['Complete the Twigpine repository slug, visibility, and one unique valid Ed25519 did:key identity per member.'];
  const termsBlockers = [...(appReady ? [] : ['Complete all required app terms.']), ...(tokenReady ? [] : ['Complete all required token terms.']), ...(economicsReady ? [] : ['Token allocations must total exactly 10,000 bps.'])];
  const gateMarkup = gate.eligible && structurallyReady
    ? `<div class="swarm-launch-gate passed" role="status"><strong>Gate passed.</strong> ${members.length} agents · avg CRED ${gate.averageCred}. <span>Beta CRED floor ${SWARM_LAUNCH_CRED_POLICY.minimumAverageCred}; standard remains ${SWARM_LAUNCH_CRED_POLICY.standardMinimumAverageCred}.</span></div>`
    : `<div class="swarm-launch-gate ${structurallyReady ? 'pending' : ''}" role="status"><strong>${structurallyReady ? 'Ready for server verification' : 'Launch preparation blocked'}</strong><p>The server verifies ownership, controller, CRED, and workspace evidence before creating a manifest.</p>${structurallyReady ? '' : `<ul>${[...gate.blockers, ...workspaceBlocker, ...termsBlockers].map((blocker) => `<li>${escapeHtml(blocker)}</li>`).join('')}</ul>`}</div>`;
  const cards = members.map((member, index) => renderMember(member, index, members.length, workspaceMembers.find((entry) => String(entry?.tokenId) === String(member?.tokenId)))).join('');
  const manifest = state.manifest ? `<section class="swarm-launch-preview-result"><p><strong>Server-verified preparation manifest</strong>${state.manifestSha256 ? ` · <code>${escapeHtml(state.manifestSha256)}</code>` : ''}</p><pre class="swarm-launch-manifest" data-swarm-launch-manifest>${escapeHtml(JSON.stringify(state.manifest, null, 2))}</pre></section>` : '';
  const error = state.error ? `<div class="mission-alert" role="alert">${escapeHtml(state.error)}</div>` : '';
  const consent = renderConsent(state);
  const readiness = renderReadiness(state);
  const invitations = renderSwarmInvitationPanel({ draft: state.invitationDraft, invitation: state.invitation, inbox: state.invitationInbox, room: state.swarmRoom, mode: state.invitation ? 'invitee' : 'lead' });
  const executionReview = renderExecutionReview(state);
  return `<section class="swarm-launchpad" aria-labelledby="swarm-launchpad-title">
    <header class="swarm-launchpad-hero"><span class="mission-eyebrow">Swarm Command · Launchpad</span><h2 id="swarm-launchpad-title">Form a swarm. Build an app. <em>Launch its token.</em></h2><p>Use verified Looper identities and CRED, define the product, set an exact contribution split, then prepare the Base launch packet.</p></header>
    <nav class="swarm-launch-steps" aria-label="Launch stages"><span>1 · Form swarm</span><span>2 · Spec app</span><span>3 · Set split</span><span>4 · Prepare token</span></nav>
    ${error}${invitations}<form data-swarm-launch-form>
      <fieldset class="swarm-launch-editor" ${locked ? 'disabled' : ''}><section><h3>Swarm roster</h3><p>Nominate 3–5 Loopers and the wallet that currently owns and controls each identity. Start from your Console room or add partner-owned Loopers. The server verifies ownership, controller, and CRED evidence.</p><div class="swarm-launch-members">${cards || '<p>No Loopers selected.</p>'}</div><button type="button" data-swarm-launch-add ${members.length >= MAX_MEMBERS ? 'disabled aria-disabled="true"' : ''}>Add another Looper</button>${gateMarkup}</section>
      <section><h3>App specification</h3><div class="swarm-launch-fields"><label>App name<input name="app_name" maxlength="64" value="${escapeAttribute(draft.app?.name ?? '')}" required></label><label>Template<select name="app_template" required>${requiredOptions(ALLOWED_TEMPLATES, draft.app?.template)}</select></label><label>Pitch<textarea name="app_pitch" maxlength="1024" required>${escapeHtml(draft.app?.pitch ?? '')}</textarea></label><label>Revenue model<select name="revenue_model" required>${requiredOptions(ALLOWED_REVENUE_MODELS, draft.app?.revenueModel)}</select></label><label>Ship target<select name="ship_target" required>${requiredOptions(ALLOWED_SHIP_TARGETS, draft.app?.shipTarget)}</select></label></div></section>
      <section><h3>Token preparation</h3><div class="swarm-launch-fields"><label>Token name<input name="token_name" maxlength="32" value="${escapeAttribute(draft.token?.name ?? '')}" required></label><label>Ticker<input name="token_ticker" maxlength="10" value="${escapeAttribute(draft.token?.ticker ?? '')}" required></label><label>Total supply<select name="token_supply" required>${requiredOptions(ALLOWED_SUPPLIES, draft.token?.supply)}</select></label><label>Curve<select name="token_curve" required>${requiredOptions(ALLOWED_CURVES, draft.token?.curve)}</select></label></div></section>
      <section><h3>Twigpine workspace</h3><p>Prepare exactly one repository for this swarm. Public is the v1 default. Private mode is enforced by the node operator and does not federate. Withheld mode can encrypt selected paths, but GLIP-09 leaves the client-versus-node encryption point implementation-sensitive.</p><input type="hidden" name="workspace_provider" value="TWIGPINE"><div class="swarm-launch-fields"><label>Repository slug<input name="workspace_repo_slug" maxlength="64" pattern="[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?" value="${escapeAttribute(workspaceRepository.slug ?? '')}" required></label><label>Visibility<select name="workspace_visibility" required>${requiredOptions(new Set(['PUBLIC', 'PRIVATE', 'WITHHELD']), workspaceRepository.visibility)}</select></label><label>GitHub mirror enabled<input type="checkbox" name="workspace_github_mirror_enabled" value="true" ${githubMirror.enabled === true ? 'checked' : ''}></label><label>GitHub mirror owner (when enabled)<input name="workspace_github_owner" maxlength="39" value="${escapeAttribute(githubMirror.owner ?? '')}"></label><label>GitHub mirror repository (when enabled)<input name="workspace_github_repository" maxlength="100" value="${escapeAttribute(githubMirror.repository ?? '')}"></label></div><p><strong>Production blocker:</strong> Twigpine currently uses owner-only push authorization. Scoped, expiring UCAN delegation is required but unavailable. Signed pushes, certificates, pull requests, and review provenance must be verified before production use.</p><p><strong>Authority boundary:</strong> Git never authorizes wallets, transactions, deployment, or financial execution. Swarm Command remains the execution-consent authority.</p></section>
      <section><h3>Allocation and vesting</h3><p>These terms become part of the manifest every nominated wallet signs. They do not select a launch provider.</p><div class="swarm-launch-fields"><label>Agent vesting bps<input name="agent_vesting_bps" inputmode="numeric" value="${escapeAttribute(economics.agentVestingBps ?? economics.agentVesting?.allocationBps ?? 4500)}" required></label><label>CRED-staker rewards bps<input name="cred_rewards_bps" inputmode="numeric" value="${escapeAttribute(economics.credRewardsBps ?? economics.credRewards?.allocationBps ?? 1500)}" required></label><label>Swarm treasury bps<input name="swarm_treasury_bps" inputmode="numeric" value="${escapeAttribute(economics.swarmTreasuryBps ?? economics.swarmTreasury?.allocationBps ?? 1500)}" required></label><label>Public distribution bps<input name="public_distribution_bps" inputmode="numeric" value="${escapeAttribute(economics.publicDistributionBps ?? economics.publicDistribution?.allocationBps ?? 2500)}" required></label><label>Agent cliff months<input name="agent_cliff_months" inputmode="numeric" value="${escapeAttribute(economics.agentCliffMonths ?? economics.agentVesting?.cliffMonths ?? 6)}" required></label><label>Agent vesting months<input name="agent_vesting_months" inputmode="numeric" value="${escapeAttribute(economics.agentVestingMonths ?? economics.agentVesting?.durationMonths ?? 18)}" required></label></div><p>All allocations must total exactly 10,000 bps.</p></section>
      <p class="swarm-launch-safety"><strong>Preparation only.</strong> No token, vault, curve, or fee stream will be deployed. No external launch integration is selected; any launch infrastructure requires separate review and explicit owner approval.</p></fieldset>
      <div class="swarm-launch-actions"><button type="button" data-mission-action="back">Back to missions</button><button type="submit" data-swarm-launch-submit ${!locked && structurallyReady && state.status !== 'verifying' ? '' : 'disabled aria-disabled="true"'}>${state.status === 'verifying' ? 'Verifying launch evidence…' : locked ? 'Manifest prepared' : 'Prepare launch manifest'}</button></div>
    </form>${manifest}${consent}${readiness}${executionReview}
  </section>`;
}

export function bindSwarmLaunchpad(root, handlers = {}) {
  const launchForm = root.querySelector('[data-swarm-launch-form]');
  launchForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    handlers.prepare?.(event);
  });
  if (launchForm) {
    const sync = () => syncLaunchSubmitState(launchForm);
    launchForm.addEventListener('input', sync);
    launchForm.addEventListener('change', sync);
    sync();
  }
  root.querySelector('[data-mission-action="back"]')?.addEventListener('click', () => handlers.back?.());
  root.querySelector('[data-swarm-launch-add]')?.addEventListener('click', () => handlers.addMember?.());
  root.querySelectorAll('[data-swarm-launch-remove]').forEach((button) => button.addEventListener('click', () => handlers.removeMember?.(Number(button.dataset.swarmLaunchRemove))));
  root.querySelector('[data-swarm-launch-consent-create]')?.addEventListener('click', () => handlers.createConsent?.());
  root.querySelector('[data-swarm-launch-consent-sign]')?.addEventListener('click', () => handlers.signConsent?.());
  root.querySelector('[data-swarm-launch-readiness-create]')?.addEventListener('click', () => handlers.createReadiness?.());
  bindSwarmInvitationPanel(root, { create: handlers.createInvitationDraft, add: handlers.addInvitation, revoke: handlers.revokeInvitation, close: handlers.closeInvitationDraft, respond: handlers.respondInvitation, copy: handlers.copyInvitation, open: handlers.openInvitation, continueLaunch: handlers.continueInvitationLaunch, openRoom: handlers.openSwarmRoom, sendRoom: handlers.sendSwarmRoom });
  root.querySelector('[data-swarm-launch-execution-review-form]')?.addEventListener('submit', (event) => { event.preventDefault(); handlers.createExecutionReview?.(event); });
}

export function normalizeSwarmLaunchExecutionReviewForm(formData, readiness) {
  if (!formData || typeof formData.get !== 'function' || !validReadiness(readiness)) throw new TypeError('Execution review form is invalid.');
  const allocations = readiness.packet.agentVesting.allocations;
  const beneficiaries = allocations.map((entry) => ({ tokenId: String(entry.tokenId), beneficiary: reviewAddress(formData.get('beneficiary_' + entry.tokenId), false, 'beneficiary') }));
  if (new Set(beneficiaries.map((entry) => entry.beneficiary)).size !== beneficiaries.length) throw new TypeError('Execution review beneficiaries must be unique.');
  const recipients = {
    credRewards: reviewAddress(formData.get('cred_rewards_recipient'), false, 'CRED rewards recipient'),
    swarmTreasury: reviewAddress(formData.get('swarm_treasury_recipient'), false, 'swarm treasury recipient'),
    publicDistribution: reviewAddress(formData.get('public_distribution_recipient'), false, 'public distribution recipient'),
  };
  if (new Set(Object.values(recipients)).size !== 3) throw new TypeError('Execution review recipients must be distinct.');
  const revenueAssets = Array.from({ length: 4 }, (_, index) => String(formData.get('revenue_asset_' + index) ?? '').trim()).filter(Boolean).map((entry) => reviewAddress(entry, true, 'revenue asset'));
  if (revenueAssets.length < 1 || new Set(revenueAssets).size !== revenueAssets.length) throw new TypeError('Execution review requires one to four unique revenue assets.');
  return Object.freeze({ beneficiaries: Object.freeze(beneficiaries.map(Object.freeze)), recipients: Object.freeze(recipients), revenueAssets: Object.freeze(revenueAssets) });
}

export async function validateSwarmLaunchExecutionPreview(value, readiness) {
  if (!validReadiness(readiness) || !value || typeof value !== 'object' || Array.isArray(value) || !/^0x[0-9a-f]{64}$/u.test(value.packetSha256 ?? '')) throw new TypeError('Execution preview response is invalid.');
  const packet = value.packet;
  if (!packet || typeof packet !== 'object' || Array.isArray(packet)) throw new TypeError('Execution preview packet is invalid.');
  const calculatedHash = await sha256Hex(canonicalSwarmLaunchJson(packet));
  if (calculatedHash !== value.packetSha256) throw new TypeError('Execution preview packet hash is invalid.');
  assertNoHiddenExecutionMaterial(packet);
  if (!packet || packet.schema !== 'multipass.swarm-token-launch-packet.v2' || packet.chainId !== 8453 || packet.sourceReadiness?.sha256 !== readiness.packetSha256 || packet.sourceReadiness?.artifact?.sourceConsent?.manifestSha256 !== readiness.packet.sourceConsent.manifestSha256) throw new TypeError('Execution preview lineage is invalid.');
  if (packet.execution?.mode !== 'PREPARATION_ONLY' || packet.execution?.deploymentAuthorized !== false || packet.execution?.broadcastPrepared !== false || packet.execution?.transactionCount !== 0) throw new TypeError('Execution preview state is unsafe.');
  if (packet.authorization?.status !== 'NOT_ATTACHED' || !Array.isArray(packet.authorization?.signatures) || packet.authorization.signatures.length !== 0) throw new TypeError('Execution preview authorization is invalid.');
  for (const field of ['keysIncluded', 'signaturesIncluded', 'transactionDataIncluded', 'calldataIncluded', 'secretsIncluded', 'externalAdapterDataIncluded', 'rpcSendMethodsAllowed']) if (packet.safety?.[field] !== false) throw new TypeError('Execution preview safety state is invalid.');
  const expectedSigners = [...new Set(readiness.packet.agentVesting.allocations.map((entry) => reviewAddress(entry.consentAuthority, false, 'consent authority')))].sort(compareAddresses);
  const requiredSigners = packet.authorization.requiredSigners;
  if (!Array.isArray(requiredSigners) || requiredSigners.length !== expectedSigners.length || requiredSigners.some((entry, index) => reviewAddress(entry, false, 'required signer') !== expectedSigners[index])) throw new TypeError('Execution preview required signers are invalid.');
  if (!Array.isArray(packet.plan?.requiredSigners) || packet.plan.requiredSigners.length !== requiredSigners.length || packet.plan.requiredSigners.some((entry, index) => reviewAddress(entry, false, 'plan signer') !== requiredSigners[index])) throw new TypeError('Execution preview signer lineage is invalid.');
  const token = packet.plan?.token;
  if (!token || typeof token.name !== 'string' || typeof token.symbol !== 'string' || token.decimals !== 18 || !/^[1-9][0-9]*$/u.test(token.totalSupply ?? '')) throw new TypeError('Execution preview token terms are invalid.');
  for (const field of ['agentVestingAmount', 'credRewardsAmount', 'swarmTreasuryAmount', 'publicDistributionAmount']) if (!/^(0|[1-9][0-9]*)$/u.test(packet.plan?.allocations?.[field] ?? '')) throw new TypeError('Execution preview allocations are invalid.');
  if (![packet.plan?.start, packet.plan?.cliff, packet.plan?.duration].every((entry) => Number.isSafeInteger(entry) && entry >= 0)) throw new TypeError('Execution preview vesting schedule is invalid.');
  for (const field of ['token', 'registry', 'splitter']) reviewAddress(packet.deployment?.[field], false, 'predicted ' + field);
  if (!Array.isArray(packet.deployment?.streams) || packet.deployment.streams.length !== readiness.packet.agentVesting.allocations.length) throw new TypeError('Execution preview stream predictions are invalid.');
  packet.deployment.streams.forEach((entry) => reviewAddress(entry, false, 'predicted stream'));
  return Object.freeze({ packet, packetSha256: value.packetSha256 });
}


function syncLaunchSubmitState(form) {
  const submit = form.querySelector('[data-swarm-launch-submit]') ?? form.ownerDocument?.querySelector('[data-swarm-launch-submit]');
  const fieldset = form.querySelector('.swarm-launch-editor');
  if (!submit || fieldset?.disabled || /Verifying|Manifest prepared/u.test(submit.textContent ?? '')) return;
  try {
    const FormDataConstructor = form.ownerDocument?.defaultView?.FormData ?? globalThis.FormData;
    const slots = Array.from(form.querySelectorAll('[data-swarm-member]'));
    normalizeSwarmLaunchRequestForm(new FormDataConstructor(form), slots);
    submit.disabled = false;
    submit.removeAttribute('aria-disabled');
  } catch {
    submit.disabled = true;
    submit.setAttribute('aria-disabled', 'true');
  }
}

function renderMember(member = {}, index, count, workspaceMember = {}) {
  const score = Number.isInteger(member?.cred?.score) ? member.cred.score : 'unavailable';
  const freshness = member?.cred?.freshness?.stale === false ? 'fresh' : 'not fresh';
  const tokenId = String(member.tokenId ?? '');
  return `<article class="swarm-launch-member" data-swarm-member="${escapeAttribute(String(index))}"><strong>${escapeHtml(member.name ?? 'Partner Looper')}</strong><span>${Number.isInteger(member?.cred?.score) ? `CRED ${escapeHtml(score)} · ${escapeHtml(freshness)}` : 'Canonical evidence verified by server'}</span><label>Looper token ID<input name="member_${index}_token" inputmode="numeric" pattern="[1-9][0-9]*" value="${escapeAttribute(tokenId)}" required></label><label>Owner wallet<input name="member_${index}_owner" value="${escapeAttribute(member.ownerAddress ?? '')}" pattern="0x[0-9a-fA-F]{40}" required></label><label>Role<input name="member_${index}_role" maxlength="96" value="${escapeAttribute(member.role ?? '')}" required></label><label>Contribution bps<input name="member_${index}_bps" inputmode="numeric" pattern="[1-9][0-9]{0,3}|10000" value="${escapeAttribute(member.contributionBps ?? '')}" required></label><label>Twigpine did:key<input name="member_${index}_did_key" maxlength="140" value="${escapeAttribute(workspaceMember.didKey ?? '')}" required></label>${count > 3 ? `<button type="button" data-swarm-launch-remove="${index}">Remove</button>` : ''}</article>`;
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
  return `<section class="swarm-launch-readiness"><h3>Simulation-only readiness packet</h3><p><strong>Deployment authorized: false.</strong> Provider selected: ${escapeHtml(String(packet.execution?.providerSelected === true))}. Transactions: ${escapeHtml(String(packet.execution?.transactionCount ?? 0))}.</p><p>Workspace: ${escapeHtml(packet.workspace?.provider ?? 'unavailable')} / ${escapeHtml(packet.workspace?.repository?.slug ?? 'unavailable')} · provisioning ${escapeHtml(packet.workspace?.repository?.provisioningStatus ?? 'unavailable')} · UCAN ${escapeHtml(packet.workspace?.delegation?.capabilityStatus ?? 'unavailable')}.</p><p>Packet hash · <code>${escapeHtml(state.readiness.packetSha256)}</code></p><pre class="swarm-launch-manifest" data-swarm-launch-readiness>${escapeHtml(JSON.stringify(packet, null, 2))}</pre></section>`;
}
function renderExecutionReview(state) {
  if (!validReadiness(state.readiness)) return '';
  if (!state.executionPreview) {
    const rows = state.readiness.packet.agentVesting.allocations.map((entry) => `<label>Looper #${escapeHtml(entry.tokenId)} beneficiary<input name="beneficiary_${escapeAttribute(entry.tokenId)}" pattern="0x[0-9a-fA-F]{40}" required></label>`).join('');
    const assets = Array.from({ length: 4 }, (_, index) => `<label>Revenue asset ${index + 1}${index === 0 ? '' : ' (optional)'}<input name="revenue_asset_${index}" value="${index === 0 ? '0x0000000000000000000000000000000000000000' : ''}" pattern="0x[0-9a-fA-F]{40}" ${index === 0 ? 'required' : ''}></label>`).join('');
    return `<section class="swarm-launch-execution-review"><h3>Execution review</h3><p>Resolve the reviewed beneficiaries and fixed recipients. This creates preparation material only and never selects a provider or authorizes deployment.</p><form data-swarm-launch-execution-review-form>${rows}<label>CRED rewards recipient<input name="cred_rewards_recipient" pattern="0x[0-9a-fA-F]{40}" required></label><label>Swarm treasury recipient<input name="swarm_treasury_recipient" pattern="0x[0-9a-fA-F]{40}" required></label><label>Public distribution recipient<input name="public_distribution_recipient" pattern="0x[0-9a-fA-F]{40}" required></label>${assets}<button type="submit" ${state.status === 'building_execution_review' ? 'disabled' : ''}>${state.status === 'building_execution_review' ? 'Building review…' : 'Build execution review'}</button></form></section>`;
  }
  const packet = state.executionPreview.packet;
  const token = packet.plan.token; const amounts = packet.plan.allocations;
  const signers = packet.authorization.requiredSigners.map((entry) => `<li><code>${escapeHtml(entry)}</code></li>`).join('');
  const sortedMembers = [...state.readiness.packet.agentVesting.allocations].sort((left, right) => compareAddresses(left.consentAuthority, right.consentAuthority) || (BigInt(left.tokenId) < BigInt(right.tokenId) ? -1 : 1));
  const streams = packet.deployment.streams.map((entry, index) => `<li>Looper #${escapeHtml(sortedMembers[index].tokenId)} · <code>${escapeHtml(entry)}</code></li>`).join('');
  return `<section class="swarm-launch-execution-review-result"><h3>Reviewed execution preparation</h3><p><strong>Provider adapter: not selected</strong> · <strong>Deployment authorized: false</strong> · <strong>Transactions: 0</strong></p><dl><div><dt>Token</dt><dd>${escapeHtml(token.name)} (${escapeHtml(token.symbol)}) · ${escapeHtml(token.decimals)} decimals · ${escapeHtml(token.totalSupply)} base units</dd></div><div><dt>Allocation amounts</dt><dd>Agent vesting ${escapeHtml(amounts.agentVestingAmount)} · CRED rewards ${escapeHtml(amounts.credRewardsAmount)} · Swarm treasury ${escapeHtml(amounts.swarmTreasuryAmount)} · Public distribution ${escapeHtml(amounts.publicDistributionAmount)}</dd></div><div><dt>Vesting schedule</dt><dd>Start ${escapeHtml(packet.plan.start)} · ${escapeHtml(packet.plan.cliff / 2_592_000)} months cliff · ${escapeHtml(packet.plan.duration / 2_592_000)} months duration</dd></div><div><dt>Source consent hash</dt><dd><code>${escapeHtml(packet.sourceReadiness.artifact.sourceConsent.manifestSha256)}</code></dd></div><div><dt>Source readiness hash</dt><dd><code>${escapeHtml(packet.sourceReadiness.sha256)}</code></dd></div><div><dt>Packet hash</dt><dd><code>${escapeHtml(state.executionPreview.packetSha256)}</code></dd></div></dl><h4>Required execution signers</h4><ul>${signers}</ul><h4>Predicted contracts</h4><ul><li>Token · <code>${escapeHtml(packet.deployment.token)}</code></li><li>Registry · <code>${escapeHtml(packet.deployment.registry)}</code></li><li>Splitter · <code>${escapeHtml(packet.deployment.splitter)}</code></li>${streams}</ul><p>Separate execution consent remains required. No signatures, transaction data, calldata, or broadcast material are attached.</p></section>`;
}
function validReadiness(value) { return Boolean(value?.packet?.schema === 'multipass.swarm-launch-readiness.v2' && value.packet.execution?.mode === 'SIMULATION_ONLY' && value.packet.execution?.deploymentAuthorized === false && value.packet.execution?.providerSelected === false && value.packet.execution?.transactionCount === 0 && /^0x[0-9a-f]{64}$/u.test(value.packetSha256 ?? '') && Array.isArray(value.packet.agentVesting?.allocations)); }
function reviewAddress(value, allowZero, label) { const text=String(value??'').trim().toLowerCase(); if(!/^0x[0-9a-f]{40}$/u.test(text)||(!allowZero&&/^0x0{40}$/u.test(text)))throw new TypeError(label+' is invalid.'); return text; }
function compareAddresses(left, right) { const a=BigInt(left); const b=BigInt(right); return a<b?-1:a>b?1:0; }
async function sha256Hex(value) {
  if (!globalThis.crypto?.subtle) throw new TypeError('Execution preview hash verification is unavailable.');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return '0x' + [...new Uint8Array(digest)].map((entry) => entry.toString(16).padStart(2, '0')).join('');
}
function assertNoHiddenExecutionMaterial(value) {
  if (Array.isArray(value)) { value.forEach(assertNoHiddenExecutionMaterial); return; }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.replace(/[^a-z]/giu, '').toLowerCase();
    if (['privatekey', 'privatekeys', 'secretkey', 'secretkeys', 'signedtransaction', 'signedtransactions', 'rawtransaction', 'rawtransactions', 'transaction', 'transactions', 'calldata', 'transactiondata', 'signature', 'rpcurl', 'providercredentials', 'apikey'].includes(normalized)) throw new TypeError('Execution preview contains hidden executable material.');
    assertNoHiddenExecutionMaterial(child);
  }
}
function shortAddress(value) { const text=String(value??''); return text.length===42 ? text.slice(0,6)+'…'+text.slice(-4) : text; }
function options(values, selected) { return [...values].map((value) => `<option value="${escapeAttribute(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(label(value))}</option>`).join(''); }
function requiredOptions(values, selected) { return (values.has(selected) ? '' : '<option value="" selected disabled>Select…</option>') + options(values, selected); }
function label(value) { return String(value).replaceAll('_', ' ').replace(/\b\w/gu, (char) => char.toUpperCase()); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }
function escapeAttribute(value) { return escapeHtml(value); }
