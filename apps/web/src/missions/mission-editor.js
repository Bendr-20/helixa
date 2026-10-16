import { validateMissionAllocationTotals } from './domain.js';

export function renderMissionEditor(state = {}) {
  const busy = state.status === 'saving';
  return `<section class="mission-editor" aria-labelledby="mission-editor-title"><header class="mission-surface-header"><div><span class="mission-eyebrow">Mission terms</span><h2 id="mission-editor-title">Create Swarm Command mission</h2><p>Recipients, token amounts, deadlines, and settlement paths become immutable at launch.</p></div></header><form data-mission-editor><label>Title<input name="title" maxlength="160" required></label><label>Public summary<textarea name="summary" maxlength="4096" required></textarea></label><label>Required roles<input name="roles" placeholder="builder, reviewer" required></label><label>Application deadline<input name="application_deadline" type="datetime-local" required></label><label>Launch deadline<input name="launch_deadline" type="datetime-local" required></label><fieldset><legend>Funding and payout</legend><label>Token address<input name="token" pattern="0x[0-9a-fA-F]{40}" required></label><label>Token symbol<input name="symbol" maxlength="16" required></label><label>Raw amount<input name="amount_raw" inputmode="numeric" pattern="(0|[1-9][0-9]*)" required></label><label>Recipient address<input name="recipient" pattern="0x[0-9a-fA-F]{40}" required></label></fieldset><p class="mission-confirmation">Confirm raw token units and immutable recipient addresses before wallet signing.</p><button type="submit" ${busy ? 'disabled' : ''}>${busy ? 'Saving…' : 'Review mission terms'}</button></form></section>`;
}

export function normalizeMissionEditor(formData) {
  const get = (name) => String(formData.get(name) ?? '').trim();
  const token = address(get('token'));
  const recipient = address(get('recipient'));
  const amountRaw = decimal(get('amount_raw'));
  const roles = get('roles').split(',').map((value) => value.trim()).filter(Boolean);
  if (!roles.length || roles.length > 16) throw new TypeError('At least one bounded role is required.');
  const allocations = [{ token, recipient, amountRaw, symbol: bounded(get('symbol'), 1, 16, 'symbol') }];
  validateMissionAllocationTotals({ allocations, requiredByToken: { [token]: amountRaw } });
  return Object.freeze({ title: bounded(get('title'), 1, 160, 'title'), publicSummary: bounded(get('summary'), 1, 4096, 'summary'), roles: Object.freeze(roles), applicationDeadline: time(get('application_deadline')), launchDeadline: time(get('launch_deadline')), allocations: Object.freeze(allocations) });
}
export function bindMissionEditor(root, handlers = {}) { root.querySelector('[data-mission-editor]')?.addEventListener('submit', (event) => { event.preventDefault(); handlers.submit?.(normalizeMissionEditor(new FormData(event.currentTarget)), event); }); }
function address(value) { if (!/^0x[0-9a-fA-F]{40}$/u.test(value)) throw new TypeError('Address is invalid.'); return value.toLowerCase(); }
function decimal(value) { if (!/^(0|[1-9][0-9]*)$/u.test(value)) throw new TypeError('Raw amount must be a canonical decimal string.'); return value; }
function bounded(value, min, max, label) { if (value.length < min || value.length > max) throw new TypeError(label + ' is invalid.'); return value; }
function time(value) { const parsed = Date.parse(value); if (!Number.isFinite(parsed)) throw new TypeError('Deadline is invalid.'); return parsed; }
