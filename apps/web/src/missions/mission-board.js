import { missionCardView } from './domain.js';

export function renderMissionBoard(state = {}) {
  const missions = Array.isArray(state.missions) ? state.missions.slice(0, 100).map(missionCardView) : [];
  return `<section class="mission-board" aria-labelledby="mission-board-title">
    <header class="mission-surface-header"><div><span class="mission-eyebrow">Swarm Command</span><h2 id="mission-board-title">Fund work. Assemble Loopers. Ship.</h2><p>Public mission terms, exact onchain funding, isolated agent teams, and milestone settlement.</p></div><button type="button" data-mission-action="new">New mission</button></header>
    <div class="mission-board-toolbar"><label>Filter <select data-mission-filter><option value="">All missions</option><option value="recruiting">Recruiting</option><option value="funding">Funding</option><option value="active">Active</option><option value="review">Review</option><option value="settled">Settled</option></select></label><span>Funding labels reflect finalized chain state only.</span></div>
    <div class="mission-card-grid">${missions.length ? missions.map(renderMissionCard).join('') : '<p class="mission-empty">No missions match this view.</p>'}</div>
  </section>`;
}

export function bindMissionBoard(root, handlers = {}) {
  root.querySelector('[data-mission-action="new"]')?.addEventListener('click', () => handlers.newMission?.());
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
