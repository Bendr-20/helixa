const SAFETY = 'No launch terms, allocation, token, or transaction is authorized.';

export function renderSwarmInvitationPanel({ draft = null, invitation = null, inbox = null, mode = draft ? 'lead' : 'invitee' } = {}) {
  if (mode === 'invitee' && invitation) {
    const actions = invitation.status === 'pending' ? '<button type="button" data-swarm-invite-accept>Accept non-binding invitation</button><button type="button" data-swarm-invite-decline>Decline</button>' : '';
    return '<section class="swarm-invitations" aria-labelledby="swarm-invitations-title"><h3 id="swarm-invitations-title">Non-binding invitation</h3><p>Looper #' + html(invitation.tokenId) + ' is invited to a provisional swarm led by Looper #' + html(invitation.lead?.tokenId ?? '') + '.</p><p>' + SAFETY + '</p><p>Status: <strong>' + html(invitation.status) + '</strong></p>' + actions + '</section>';
  }
  const leadDraft = draft ?? inbox?.leadDraft ?? null;
  const incoming = Array.isArray(inbox?.invitations) ? inbox.invitations : [];
  const lead = leadDraft ? renderLeadDraft(leadDraft) : '';
  const received = incoming.length ? '<div class="swarm-invitation-inbox"><h4>Received</h4><ul>' + incoming.map((item) => '<li><strong>Looper #' + html(item.tokenId) + '</strong> · invited by Looper #' + html(item.lead?.tokenId ?? '') + ' · ' + html(item.status) + '<button type="button" data-swarm-invite-open="' + attr(item.inviteId) + '">Review invitation</button></li>').join('') + '</ul></div>' : '';
  const create = leadDraft ? '' : '<form data-swarm-draft-create><label>Lead Looper<input name="lead_token_id" inputmode="numeric" pattern="[1-9][0-9]*" required></label><label>Invitee Looper IDs (1–4, comma-separated)<input name="invitee_token_ids" required></label><button type="submit">Create non-binding invitations</button></form>';
  const empty = !leadDraft && incoming.length === 0 ? '<p>No invitations yet. Create a provisional owner invitation to begin.</p>' : '';
  return '<section class="swarm-invitations" aria-labelledby="swarm-invitations-title"><h3 id="swarm-invitations-title">Your invitations</h3><p>Non-binding invitation inbox</p><p>' + SAFETY + '</p>' + empty + lead + received + create + '</section>';
}

export function bindSwarmInvitationPanel(root, handlers = {}) {
  root.querySelector('[data-swarm-draft-create]')?.addEventListener('submit', (event) => { event.preventDefault(); handlers.create?.(formData(event.currentTarget)); });
  root.querySelector('[data-swarm-invite-add]')?.addEventListener('submit', (event) => { event.preventDefault(); handlers.add?.(formData(event.currentTarget)); });
  root.querySelectorAll('[data-swarm-invite-revoke]').forEach((button) => button.addEventListener('click', () => handlers.revoke?.(button.dataset.swarmInviteRevoke)));
  root.querySelector('[data-swarm-draft-close]')?.addEventListener('click', () => handlers.close?.());
  root.querySelector('[data-swarm-invite-accept]')?.addEventListener('click', () => handlers.respond?.('accepted'));
  root.querySelector('[data-swarm-invite-decline]')?.addEventListener('click', () => handlers.respond?.('declined'));
  root.querySelectorAll('[data-swarm-invite-copy]').forEach((button) => button.addEventListener('click', () => handlers.copy?.(button.dataset.swarmInviteCopy)));
  root.querySelectorAll('[data-swarm-invite-open]').forEach((button) => button.addEventListener('click', () => handlers.open?.(button.dataset.swarmInviteOpen)));
}

function renderLeadDraft(draft) {
  const slots = Number(draft.openSlots ?? 0);
  const draftOpen = draft.status !== 'closed';
  const rows = (draft.invites ?? []).map((item) => {
    const link = item.shareUrl ? '<label>Individual invitation link<input readonly value="' + attr(item.shareUrl) + '"><button type="button" data-swarm-invite-copy="' + attr(item.inviteId) + '">Copy/share link</button></label>' : '';
    const revoke = item.status === 'pending' ? '<button type="button" data-swarm-invite-revoke="' + attr(item.inviteId) + '">Revoke invitation</button>' : '';
    return '<li><strong>Looper #' + html(item.tokenId) + '</strong> · ' + html(item.status) + link + revoke + '</li>';
  }).join('');
  const slotText = draftOpen ? (slots === 1 ? 'one slot open' : slots + ' slots open') : 'Roster no longer accepting invitations';
  const add = draftOpen && slots > 0 ? '<form data-swarm-invite-add><label>Invite another Looper<input name="token_id" inputmode="numeric" pattern="[1-9][0-9]*" required></label><button type="submit">Add invitation</button></form>' : '';
  const close = draftOpen ? '<button type="button" data-swarm-draft-close>Close provisional draft</button>' : '<p>Draft closed.</p>';
  return '<div class="swarm-invitation-lead"><h4>Lead draft · Looper #' + html(draft.lead?.tokenId ?? '') + '</h4><p>' + slotText + '</p><ul>' + rows + '</ul>' + add + close + '</div>';
}

function formData(form) { const FormDataConstructor = form?.ownerDocument?.defaultView?.FormData ?? globalThis.FormData; return new FormDataConstructor(form); }
function html(value) { return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('\"', '&quot;').replaceAll("'", '&#039;'); }
function attr(value) { return html(value); }
