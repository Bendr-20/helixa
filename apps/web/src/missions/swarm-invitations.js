const SAFETY = 'No launch terms, allocation, token, or transaction is authorized.';

const PILOT_ROLES = Object.freeze({
  '2431': 'Lead: scope, architecture, integration, and acceptance',
  '3802': 'Product/operator review and end-user workflow',
  '420': 'Implementation and existing-work inventory',
});

export function deriveSwarmLaunchDraftFromInvitation(draft = {}) {
  const accepted = Array.isArray(draft.invites) ? draft.invites.filter((item) => item?.status === 'accepted') : [];
  const roster = [draft.lead, ...accepted].filter(Boolean);
  if (roster.length < 3 || roster.length > 5) throw new TypeError('Three to five accepted members are required to continue launch preparation.');
  const baseBps = Math.floor(10_000 / roster.length);
  const remainder = 10_000 - (baseBps * roster.length);
  const members = roster.map((member, index) => ({
    tokenId: String(member.tokenId ?? ''),
    ownerAddress: String(member.owner ?? ''),
    name: 'Looper #' + String(member.tokenId ?? ''),
    role: PILOT_ROLES[String(member.tokenId ?? '')] ?? '',
    contributionBps: baseBps + (index < remainder ? 1 : 0),
    cred: null,
    erc8004Id: member.erc8004AgentId ? '8453:' + String(member.erc8004AgentId) : null,
  }));
  return {
    members,
    app: { name: 'Multipass App Store', pitch: 'Build the Multipass App Store.', template: '', revenueModel: '', shipTarget: '' },
    token: { name: '', ticker: '', supply: '', curve: '' },
    workspace: {
      provider: 'TWIGPINE',
      repository: { slug: 'multipass-app-store', visibility: '' },
      members: members.map((member) => ({ tokenId: member.tokenId, didKey: '' })),
      githubMirror: { enabled: false, owner: null, repository: null },
    },
  };
}

export function renderSwarmInvitationPanel({ draft = null, invitation = null, inbox = null, room = null, mode = draft ? 'lead' : 'invitee', responding = false, decision = null } = {}) {
  if (mode === 'invitee' && invitation) {
    const pendingLabel = decision === 'declined' ? 'Declining invitation…' : 'Accepting and verifying ownership…';
    const actions = invitation.status === 'pending' ? (responding
      ? '<div class="swarm-invitation-progress" role="status" aria-live="polite" aria-busy="true">' + pendingLabel + '</div><button type="button" data-swarm-invite-accept disabled aria-disabled="true">' + pendingLabel + '</button><button type="button" data-swarm-invite-decline disabled aria-disabled="true">Decline</button>'
      : '<button type="button" data-swarm-invite-accept>Accept non-binding invitation</button><button type="button" data-swarm-invite-decline>Decline</button>') : '';
    const terminal = invitation.status === 'accepted' ? '<div class="swarm-invitation-confirmation" role="status"><strong>Invitation accepted.</strong><p>Looper #' + html(invitation.tokenId) + ' is now part of this provisional swarm. No launch or transaction has been authorized.</p></div><div class="swarm-invitation-next"><h4>What happens next</h4><ol><li>The lead waits until enough invitations are accepted for a 3–5 member roster.</li><li>The lead prepares roles, contribution splits, app details, and token terms.</li><li>Every binding step still requires separate review and wallet approval.</li></ol></div>' : invitation.status === 'declined' ? '<div class="swarm-invitation-confirmation" role="status"><strong>Invitation declined.</strong></div>' : '';
    return '<section class="swarm-invitations" aria-labelledby="swarm-invitations-title"><h3 id="swarm-invitations-title">Non-binding invitation</h3><p>Looper #' + html(invitation.tokenId) + ' is invited to a provisional swarm led by Looper #' + html(invitation.lead?.tokenId ?? '') + '.</p><p>' + SAFETY + '</p><p>Status: <strong>' + html(invitation.status) + '</strong></p>' + terminal + actions + (invitation.status === 'accepted' ? renderSwarmRoom(room, invitation.draftId) : '') + '</section>';
  }
  const leadDraft = draft ?? inbox?.leadDraft ?? null;
  const incoming = Array.isArray(inbox?.invitations) ? inbox.invitations : [];
  const lead = leadDraft ? renderLeadDraft(leadDraft, room) : '';
  const received = incoming.length ? '<div class="swarm-invitation-inbox"><h4>Action required</h4><ul>' + incoming.map((item) => '<li class="swarm-invitation-card"><span class="swarm-invitation-status">' + html(item.status) + '</span><strong>Invitation for Looper #' + html(item.tokenId) + '</strong><span>Invited by Looper #' + html(item.lead?.tokenId ?? '') + '</span><button type="button" data-swarm-invite-open="' + attr(item.inviteId) + '">Review invitation</button></li>').join('') + '</ul></div>' : '';
  const create = leadDraft || incoming.length ? '' : '<form data-swarm-draft-create><label>Lead Looper<input name="lead_token_id" inputmode="numeric" pattern="[1-9][0-9]*" required></label><label>Invitee Looper IDs (1–4, comma-separated)<input name="invitee_token_ids" required></label><button type="submit">Create non-binding invitations</button></form>';
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
  root.querySelector('[data-swarm-invite-continue]')?.addEventListener('click', () => handlers.continueLaunch?.());
  root.querySelector('[data-swarm-room-open]')?.addEventListener('click', () => handlers.openRoom?.());
  root.querySelector('[data-swarm-room-send]')?.addEventListener('submit', (event) => { event.preventDefault(); handlers.sendRoom?.(formData(event.currentTarget)); });
}


function renderLeadDraft(draft, room) {
  const slots = Number(draft.openSlots ?? 0);
  const draftOpen = draft.status !== 'closed';
  const acceptedInvitees = (draft.invites ?? []).filter((item) => item.status === 'accepted').length;
  const readyMembers = 1 + acceptedInvitees;
  const needed = Math.max(0, 3 - readyMembers);
  const readiness = needed === 0
    ? '<div class="swarm-invitation-readiness ready"><strong>' + readyMembers + ' members ready.</strong><p>The minimum 3-member roster is available for the lead to continue launch preparation.</p><button type="button" data-swarm-invite-continue>Continue launch preparation</button><p>This copies the server-recorded accepted roster into editable fields. The preview still revalidates ownership, controller, and CRED for every member.</p></div>'
    : '<div class="swarm-invitation-readiness"><strong>' + readyMembers + ' of 3 minimum members ready.</strong><p>Waiting for ' + (needed === 1 ? 'one more accepted invitee' : html(needed) + ' more accepted invitees') + '.</p></div>';
  const rows = (draft.invites ?? []).map((item) => {
    const link = item.shareUrl ? '<label>Individual invitation link<input readonly value="' + attr(item.shareUrl) + '"><button type="button" data-swarm-invite-copy="' + attr(item.inviteId) + '">Copy/share link</button></label>' : '';
    const revoke = item.status === 'pending' ? '<button type="button" data-swarm-invite-revoke="' + attr(item.inviteId) + '">Revoke invitation</button>' : '';
    return '<li><strong>Looper #' + html(item.tokenId) + '</strong> · ' + html(item.status) + link + revoke + '</li>';
  }).join('');
  const slotText = draftOpen ? (slots === 1 ? 'one slot open' : slots + ' slots open') : 'Roster no longer accepting invitations';
  const add = draftOpen && slots > 0 ? '<form data-swarm-invite-add><label>Invite another Looper<input name="token_id" inputmode="numeric" pattern="[1-9][0-9]*" required></label><button type="submit">Add invitation</button></form>' : '';
  const close = draftOpen ? '<button type="button" data-swarm-draft-close>Close provisional draft</button>' : '<p>Draft closed.</p>';
  return '<div class="swarm-invitation-lead"><h4>Lead draft · Looper #' + html(draft.lead?.tokenId ?? '') + '</h4>' + readiness + renderSwarmRoom(room, draft.draftId, needed === 0) + '<p>' + slotText + '</p><ul>' + rows + '</ul>' + add + close + '</div>';
}

function renderSwarmRoom(room, draftId, ready = true) {
  if (!ready || !draftId) return '';
  if (room?.status === 'loading') return '<section class="swarm-room" aria-live="polite"><h4>Swarm chat</h4><p>Opening wallet-encrypted XMTP room…</p></section>';
  if (room?.status === 'error') return '<section class="swarm-room"><h4>Swarm chat</h4><p role="alert">' + html(room.error) + '</p><button type="button" data-swarm-room-open>Retry swarm chat</button></section>';
  if (room?.status !== 'open') return '<section class="swarm-room"><h4>Swarm chat</h4><p>The accepted-roster XMTP room is ready.</p><button type="button" data-swarm-room-open>Open swarm chat</button></section>';
  const messages = (room.messages ?? []).map((message) => '<li><strong>' + (message.sender === 'you' ? 'You' : 'Swarm member') + '</strong><p>' + html(message.text) + '</p></li>').join('');
  return '<section class="swarm-room"><h4>Multipass App Store swarm</h4><p>Wallet-encrypted XMTP · coordination only · launch authorized: false</p><p>Accepted Loopers: ' + (room.acceptedTokenIds ?? []).map((id) => '#' + html(id)).join(', ') + '</p><ul class="swarm-room-messages">' + (messages || '<li>No messages yet.</li>') + '</ul><form data-swarm-room-send><label>Message<textarea name="message" maxlength="2000" required></textarea></label><button type="submit">Send to swarm</button></form></section>';
}

function formData(form) { const FormDataConstructor = form?.ownerDocument?.defaultView?.FormData ?? globalThis.FormData; return new FormDataConstructor(form); }
function html(value) { return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('\"', '&quot;').replaceAll("'", '&#039;'); }
function attr(value) { return html(value); }
