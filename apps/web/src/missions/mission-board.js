import { missionCardView } from './domain.js';

export function renderMissionBoard(state = {}) {
  const missions = Array.isArray(state.missions) ? state.missions.slice(0, 100).map(missionCardView) : [];
  const disabled = state.status === 'disabled';
  const busy = state.status === 'loading' || state.status === 'saving';
  const unavailable = state.status === 'error';
  const availability = disabled
    ? '<div class="mission-alert" role="status"><strong>Read-only preview.</strong> Mission creation, funding, agent launch, and settlement are disabled. No wallet action will be requested.</div>'
    : unavailable
      ? `<div class="mission-alert" role="alert"><strong>Swarm Command is unavailable.</strong> ${escapeHtml(state.error ?? 'Retry the mission board.')}</div>`
      : busy
        ? '<div class="mission-alert" role="status"><strong>Loading Swarm Command…</strong></div>'
        : '<div class="mission-alert mission-alert-live" role="status"><strong>Swarm Command is live on Base Sepolia.</strong> Create and recruit now; funding and settlement require explicit wallet transactions.</div>';
  const empty = disabled ? 'Swarm Command is staged, but mission creation is not enabled.' : busy ? 'Loading missions…' : 'No missions yet. Create the first one.';
  const controlsDisabled = disabled || busy || unavailable;
  return `<section class="mission-board" aria-labelledby="mission-board-title">
    <header class="mission-surface-header"><div><span class="mission-eyebrow">Swarm Command</span><h2 id="mission-board-title">Fund work. Assemble Loopers. Ship.</h2><p>Public mission terms, exact onchain funding, isolated agent teams, and milestone settlement.</p></div><div class="mission-surface-actions"><button type="button" data-mission-action="launchpad" ${controlsDisabled ? 'disabled aria-disabled="true"' : ''}>Initiate swarm</button><button type="button" data-mission-action="new" ${controlsDisabled ? 'disabled aria-disabled="true"' : ''}>New mission</button></div></header>
    ${availability}
    <div class="mission-board-toolbar"><label>Filter <select data-mission-filter ${controlsDisabled ? 'disabled aria-disabled="true"' : ''}><option value="">All missions</option><option value="recruiting">Recruiting</option><option value="funding">Funding</option><option value="active">Active</option><option value="review">Review</option><option value="settled">Settled</option></select></label><span>Funding labels reflect finalized chain state only.</span></div>
    <div class="mission-card-grid">${missions.length ? missions.map(renderMissionCard).join('') : `<p class="mission-empty">${empty}</p>`}</div>
  </section>`;
}

export function renderMissionDetail(state = {}) {
  const mission = missionCardView(state.mission ?? {});
  const funding = mission.funding.map((item) => `<li><strong>${escapeHtml(item.symbol)} ${escapeHtml(item.fundedRaw)} / ${escapeHtml(item.requiredRaw)}</strong><span>${item.finalized ? 'Finalized onchain' : 'Awaiting finalized Base Sepolia funding'}</span></li>`).join('');
  return `<section class="mission-board mission-detail" aria-labelledby="mission-detail-title">
    <header class="mission-surface-header"><div><span class="mission-eyebrow">${escapeHtml(mission.state.replaceAll('_', ' '))}</span><h2 id="mission-detail-title">${escapeHtml(mission.title)}</h2><p>${escapeHtml(mission.summary)}</p></div><button type="button" data-mission-action="back">Back to missions</button></header>
    <div class="mission-alert mission-alert-live" role="status"><strong>Recruiting is live.</strong> Funding and launch remain owner-signed Base Sepolia transactions.</div>
    <dl><div><dt>Applications close</dt><dd>${formatTime(mission.applicationClosesAt)}</dd></div><div><dt>Launch deadline</dt><dd>${formatTime(mission.launchDeadline)}</dd></div><div><dt>Source</dt><dd>${escapeHtml(mission.source.displayLabel)} · ${escapeHtml(mission.source.status)}</dd></div></dl>
    <section><h3>Required roles</h3><div class="mission-role-list">${mission.roles.map((role) => `<span>${escapeHtml(role)}</span>`).join('')}</div></section>
    <section><h3>Funding terms</h3><ul class="mission-funding-list">${funding || '<li>Funding terms pending.</li>'}</ul></section>
  </section>`;
}

export function bindMissionBoard(root, handlers = {}) {
  root.querySelector('[data-mission-action="launchpad"]')?.addEventListener('click', () => handlers.openLaunchpad?.());
  root.querySelector('[data-mission-action="new"]')?.addEventListener('click', () => handlers.newMission?.());
  root.querySelector('[data-mission-action="back"]')?.addEventListener('click', () => handlers.back?.());
  root.querySelector('[data-mission-filter]')?.addEventListener('change', (event) => handlers.filter?.(event.currentTarget.value));
  root.querySelectorAll('[data-mission-id]').forEach((button) => button.addEventListener('click', () => handlers.openMission?.(button.dataset.missionId)));
}

function renderMissionCard(mission) {
  const funding = mission.funding.map((item) => `<span class="mission-funding-chip ${item.finalized ? 'finalized' : 'pending'}">${escapeHtml(item.symbol)} ${escapeHtml(item.fundedRaw)} / ${escapeHtml(item.requiredRaw)} ${item.finalized ? 'finalized' : 'pending'}</span>`).join('');
  return `<article class="mission-card"><div class="mission-card-heading"><span>${escapeHtml(mission.state.replaceAll('_', ' '))}</span><small>${escapeHtml(mission.source.displayLabel)} · ${escapeHtml(mission.source.status)}</small></div><h3>${escapeHtml(mission.title)}</h3><p>${escapeHtml(mission.summary)}</p><div class="mission-role-list">${mission.roles.map((role) => `<span>${escapeHtml(role)}</span>`).join('')}</div><div class="mission-funding-list">${funding || '<span class="mission-funding-chip">Terms pending</span>'}</div><dl><div><dt>Applications close</dt><dd>${formatTime(mission.applicationClosesAt)}</dd></div><div><dt>Launch deadline</dt><dd>${formatTime(mission.launchDeadline)}</dd></div></dl><button type="button" data-mission-id="${escapeAttribute(mission.missionId)}">Open mission</button></article>`;
}
function formatTime(value) { return value === null ? 'Not set' : escapeHtml(new Date(value).toISOString()); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }
function escapeAttribute(value) { return escapeHtml(value); }
