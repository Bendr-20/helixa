const SAFETY = 'No launch terms, allocation, token, or transaction is authorized.';

export function renderSwarmInvitationPanel({ draft = null, invitation = null, mode = draft ? 'lead' : 'invitee' } = {}) {
  if (mode === 'lead' && draft) {
    const slots = Number(draft.openSlots ?? 0);
    const rows = (draft.invites ?? []).map((item) => {
      const link = item.shareUrl ? '<label>Individual invitation link<input readonly value="' + attr(item.shareUrl) + '"><button type="button" data-swarm-invite-copy="' + attr(item.inviteId) + '">Copy/share link</button></label>' : '';
      const revoke = item.status === 'pending' ? '<button type="button" data-swarm-invite-revoke="' + attr(item.inviteId) + '">Revoke invitation</button>' : '';
      return '<li><strong>Looper #' + html(item.tokenId) + '</strong> · ' + html(item.status) + link + revoke + '</li>';
    }).join('');
    const slotText = slots === 1 ? 'one slot open' : slots + ' slots open';
    const add = slots > 0 ? '<form data-swarm-invite-add><label>Invite another Looper<input name="token_id" inputmode="numeric" pattern="[1-9][0-9]*" required></label><button type="submit">Add invitation</button></form>' : '';
    return '<section class="swarm-invitations" aria-labelledby="swarm-invitations-title"><h3 id="swarm-invitations-title">Non-binding invitation</h3><p>' + slotText + '</p><p>' + SAFETY + '</p><ul>' + rows + '</ul>' + add + '</section>';
  }
  if (mode === 'invitee' && invitation) {
    const actions = invitation.status === 'pending' ? '<button type="button" data-swarm-invite-accept>Accept non-binding invitation</button><button type="button" data-swarm-invite-decline>Decline</button>' : '';
    return '<section class="swarm-invitations" aria-labelledby="swarm-invitations-title"><h3 id="swarm-invitations-title">Non-binding invitation</h3><p>Looper #' + html(invitation.tokenId) + ' is invited to a provisional swarm led by Looper #' + html(invitation.lead?.tokenId ?? '') + '.</p><p>' + SAFETY + '</p><p>Status: <strong>' + html(invitation.status) + '</strong></p>' + actions + '</section>';
  }
  return '<section class="swarm-invitations"><h3>Non-binding invitation</h3><p>Create a provisional owner invitation before preparing any binding launch terms.</p><p>' + SAFETY + '</p><form data-swarm-draft-create><label>Lead Looper<input name="lead_token_id" inputmode="numeric" pattern="[1-9][0-9]*" required></label><label>Invitee Looper IDs (1–4, comma-separated)<input name="invitee_token_ids" required></label><button type="submit">Create non-binding invitations</button></form></section>';
}

export function bindSwarmInvitationPanel(root, handlers = {}) {
  root.querySelector('[data-swarm-draft-create]')?.addEventListener('submit', (event) => { event.preventDefault(); handlers.create?.(new FormData(event.currentTarget)); });
  root.querySelector('[data-swarm-invite-add]')?.addEventListener('submit', (event) => { event.preventDefault(); handlers.add?.(new FormData(event.currentTarget)); });
  root.querySelectorAll('[data-swarm-invite-revoke]').forEach((button) => button.addEventListener('click', () => handlers.revoke?.(button.dataset.swarmInviteRevoke)));
  root.querySelector('[data-swarm-invite-accept]')?.addEventListener('click', () => handlers.respond?.('accepted'));
  root.querySelector('[data-swarm-invite-decline]')?.addEventListener('click', () => handlers.respond?.('declined'));
  root.querySelectorAll('[data-swarm-invite-copy]').forEach((button) => button.addEventListener('click', () => handlers.copy?.(button.dataset.swarmInviteCopy)));
}

function html(value) { return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('\"', '&quot;').replaceAll("'", '&#039;'); }
function attr(value) { return html(value); }
