import { renderConsoleAgentThread } from './console-agent-thread.js';
import { normalizeConsoleCodexState, renderConsoleCodexWorkspace } from './console-codex.js';
import { createConsoleAgentGalleryModel } from './console-agent-gallery.js';
import { safeConsoleAvatarUrl } from './console-owner-profile.js';
import { createInitialConsoleRestapNetworkState, getConsoleRestapNetworkStatus, renderConsoleRestapNetworkPanel } from './console-restap-network.js';
import { CRED_ADDRESS, PANTHEON_STAKING_VAULT } from './looper-cred-pantheon.js';
import { renderMissionBoard, renderMissionDetail } from './missions/mission-board.js';
import { renderMissionEditor } from './missions/mission-editor.js';
import { renderMissionWorkspace } from './missions/mission-workspace.js';
import { renderMissionSettlement } from './missions/mission-settlement.js';

const CONSOLE_SAFETY_NOTE = 'Review-only operator surface. Your agent can brief and propose, but every action still waits for you.';
const DEFAULT_CONSOLE_MISSION = 'Watch this agent, keep memory in Sibyl, and brief me before any proposal or outside action.';
const DEFAULT_CONSOLE_PORTRAIT = '/multipass/loopers-console-pfp.png';

export function createMultipassConsoleSnapshot({ state = {}, agents = [] } = {}) {
  const wallet = state.walletSnapshot ?? {};
  const agentRoster = state.consoleOwnedAgents ?? { status: 'idle', error: null, agents: [] };
  const walletConnected = Boolean(wallet.connected && wallet.address);
  const walletAuthenticated = walletConnected && (Object.prototype.hasOwnProperty.call(state, 'consoleAuthenticatedWallet')
    ? normalizeWalletAddress(state.consoleAuthenticatedWallet) === normalizeWalletAddress(wallet.address)
    : true);
  const aliasMutationPending = state.consoleAgentNameMutation?.status === 'pending';
  const walletWorkPending = hasNonterminalLooperWalletWork(state.looperAgentWallet);
  const activeAgents = Array.isArray(agents) ? agents.filter(Boolean).map(normalizeConsoleAgent) : [];
  const activeAgent = selectActiveAgent(activeAgents, state.consoleSelectedAgentId);
  const ownerProfile = state.consoleOwnerProfile ?? null;
  const ownerProfileLabel = String(ownerProfile?.ensName ?? ownerProfile?.displayName ?? '').trim();
  const ownerDisplayName = walletConnected
    ? `${ownerProfileLabel && ownerProfileLabel.toLowerCase() !== String(wallet.address ?? '').trim().toLowerCase()
      ? ownerProfileLabel
      : shortenAddress(wallet.address)} (you)`
    : null;
  const roomParticipants = decorateConsoleParticipants(createRoomParticipants({
    agents: activeAgents,
    activeAgent,
    participantIds: state.consoleParticipantAgentIds,
    threadParticipants: state.consoleAgentThread?.participants,
  }), {
    ownerDisplayName,
    ownerAvatarUrl: safeConsoleAvatarUrl(ownerProfile?.avatarUrl),
    walletAddress: wallet.address,
  });
  const activeAgentCount = activeAgents.length;
  const connectedWallet = walletConnected
    ? shortenAddress(wallet.address)
    : (wallet.configured === false ? 'Wallet unavailable' : 'Not connected');
  const agentThread = createAgentThreadSnapshot(state, activeAgent, roomParticipants, {
    displayName: ownerDisplayName,
    avatarUrl: safeConsoleAvatarUrl(ownerProfile?.avatarUrl),
  });
  const savedMemory = Array.isArray(agentThread.savedMemory) ? agentThread.savedMemory : [];
  const recalledMemory = Array.isArray(agentThread.recalledMemory) ? agentThread.recalledMemory : [];
  const memoryEntries = createMemoryEntries({ savedMemory, recalledMemory });
  const recall = agentThread.recalledMemoryPresent && recalledMemory.length
    ? {
      title: 'Sibyl recall',
      body: agentThread.recalledMission || `Loaded ${recalledMemory.length} recalled memory ${recalledMemory.length === 1 ? 'entry' : 'entries'} for this wallet and agent.`,
    }
    : null;
  const proposalCount = Array.isArray(agentThread.proposals) ? agentThread.proposals.length : 0;
  const activeCred = activeAgent?.credLabel ?? 'Cred pending';
  const verifiedLabel = activeAgent?.verified ? 'Verified AgentDNA' : (activeAgent?.tokenId ? 'Verification pending' : 'Awaiting selection');
  const activeAgentLabel = activeAgent?.name
    ?? (walletAuthenticated
      ? agentRoster.status === 'loading'
        ? 'Loading owned agents'
        : activeAgentCount > 0
          ? 'Pick your agent'
          : 'No owned agents found'
      : walletConnected ? 'Sign in to Console' : 'No agent selected');
  const emptyAgentSummary = walletAuthenticated && activeAgentCount > 0
    ? 'Pick an owned Looper to load its identity and open the room.'
    : walletConnected
      ? 'Sign in with the connected wallet to load its owned Loopers.'
      : 'Owned Loopers appear here after wallet sign-in.';
  const needsAgentSelection = walletAuthenticated && agentRoster.status === 'loaded' && activeAgentCount > 0 && !activeAgent?.tokenId;
  const showAgentGallery = walletAuthenticated && !activeAgent?.tokenId;
  const activeAgentWallet = activeAgent?.tokenId ? normalizeLooperAgentWallet(state.looperAgentWallet, activeAgent.tokenId) : null;
  const requestedWorkspaceView = ['chat', 'wallet', 'multipass', 'codex', 'network', 'missions'].includes(state.consoleWorkspaceView)
    ? state.consoleWorkspaceView
    : null;
  const workspaceView = requestedWorkspaceView === 'missions'
    ? 'missions'
    : activeAgent?.tokenId
      ? (requestedWorkspaceView ?? (activeAgentWallet ? (activeAgentWallet.mode === 'active' ? 'multipass' : 'wallet') : 'chat'))
      : 'chat';
  const galleryModel = createConsoleAgentGalleryModel({
    agents: activeAgents,
    query: state.consoleAgentGallery?.query,
    sort: state.consoleAgentGallery?.sort,
  });
  const agentCards = activeAgents.map((agent) => ({
    tokenId: agent.tokenId ?? '',
    name: agent.name ?? 'Onchain agent',
    role: agent.role ?? agent.framework ?? 'Agent profile',
    cred: agent.cred,
    credLabel: agent.credLabel,
    state: agent.state ?? (agent.verified ? 'Verified profile' : 'Review needed'),
    verified: Boolean(agent.verified),
    href: agent.href ?? null,
    selected: String(agent.tokenId ?? '') !== '' && String(agent.tokenId) === String(activeAgent?.tokenId ?? ''),
    inRoom: roomParticipants.some((participant) => String(participant.tokenId ?? '') === String(agent.tokenId ?? '')),
    activationDisabled: aliasMutationPending || walletWorkPending,
    image: agent.image ?? null,
  }));

  const status = [
    { label: 'Wallet', value: walletAuthenticated ? connectedWallet : walletConnected ? 'Sign in required' : 'Required' },
    { label: 'Agent', value: activeAgent?.tokenId ? activeAgentLabel : 'Select first' },
    { label: 'Chat', value: walletConnected && activeAgent?.tokenId ? formatTransportLabel(agentThread.transport) : 'Standby' },
    { label: 'Memory', value: memoryEntries.length ? `${memoryEntries.length} loaded` : 'Standby' },
  ];

  return {
    title: 'Multipass Console',
    headline: 'Multipass Console',
    safetyNote: CONSOLE_SAFETY_NOTE,
    session: {
      wallet: {
        connected: walletConnected,
        authenticated: walletAuthenticated,
        unavailable: wallet.configured === false,
        ready: wallet.ready !== false,
        label: walletConnected ? ownerDisplayName : connectedWallet,
        status: state.consoleWalletStatus ?? null,
        error: state.consoleWalletError ?? null,
      },
      rosterStatus: agentRoster.status ?? 'idle',
      rosterError: agentRoster.error ?? null,
      activeAgentId: activeAgent?.tokenId ?? null,
      activeAgentLabel,
      activeAgentCount,
      needsAgentSelection,
      showAgentGallery,
      roomParticipantCount: roomParticipants.length,
      options: activeAgents.map((agent) => ({
        value: agent.tokenId ?? '',
        label: buildAgentOptionLabel(agent),
      })),
      selectionEnabled: walletAuthenticated && agentRoster.status === 'loaded' && activeAgentCount > 0 && !aliasMutationPending && !walletWorkPending,
      selectionHint: createSelectionHint({ walletConnected: walletAuthenticated, agentRosterStatus: agentRoster.status, activeAgentCount, roomParticipantCount: roomParticipants.length }),
      nextAction: createNextAction({ walletConnected: walletAuthenticated, activeAgentCount, proposalCount, hasMessages: (agentThread.messages?.length ?? 0) > 0, roomParticipantCount: roomParticipants.length }),
      status,
    },
    workspaceView,
    codex: normalizeConsoleCodexState(state.consoleCodex ?? {
      status: 'unavailable',
      selectedTokenId: activeAgent?.tokenId ?? null,
    }),
    restapNetwork: createConsoleRestapNetworkSnapshot(state.consoleRestapNetwork, activeAgent?.tokenId),
    missions: state.consoleMissions ?? { status: 'disabled', missions: [] },
    rosterDrawers: {
      mainOpen: Boolean(state.consoleMainRosterOpen),
      sidebarOpen: Boolean(state.consoleSidebarRosterOpen),
    },
    gallery: {
      ...galleryModel,
      status: agentRoster.status ?? 'idle',
      error: agentRoster.error ?? null,
      activationError: state.consoleAgentGallery?.activationError ?? null,
      refreshDisabled: walletWorkPending,
    },
    identityCard: {
      name: activeAgentLabel,
      role: activeAgent?.canonicalName && activeAgent.canonicalName !== activeAgent.name
        ? activeAgent.canonicalName
        : (activeAgent?.role ?? (walletConnected ? 'Choose an owned Looper' : 'Wallet sign-in required')),
      image: activeAgent?.image ?? null,
      portraitPlaceholder: activeAgent?.tokenId
        ? null
        : (walletConnected && activeAgentCount > 0 ? 'Pick agent' : 'No agent selected'),
      walletLabel: ownerDisplayName,
      roomName: activeAgent?.presenceLabel ?? (activeAgent?.tokenId
        ? (roomParticipants.length > 1 ? agentThread.roomName : 'Direct operator line')
        : 'No room open'),
      participants: agentThread.participants,
      summary: activeAgent?.tokenId
        ? createIdentitySummary({ activeAgent, activeCred, roomParticipantCount: roomParticipants.length, proposalCount })
        : emptyAgentSummary,
      rename: createAgentRenameControl(activeAgent, state.consoleAgentNameMutation),
      badges: createIdentityBadges({ activeAgent, verifiedLabel, transport: agentThread.transport, proposalCount }),
      emptyState: !activeAgent?.tokenId,
      dossier: createIdentityDossier({
        activeAgent,
        walletConnected,
        walletLabel: ownerDisplayName ?? connectedWallet,
        roomName: activeAgent?.presenceLabel ?? agentThread.roomName,
        roomParticipantCount: roomParticipants.length,
        memoryCount: memoryEntries.length,
        proposalCount,
        verifiedLabel,
      }),
      stats: createIdentityStats({ activeAgent, activeCred, proposalCount }),
      identityData: createIdentityData({ activeAgent, activeCred }),
      tokenLabel: activeAgent?.tokenId ? `Token #${activeAgent.tokenId}` : 'Token not loaded',
      erc8004Label: getPositiveErc8004AgentId(activeAgent) ? `ERC-8004 #${getPositiveErc8004AgentId(activeAgent)}` : null,
      agentWallet: activeAgentWallet,
    },
    suiteChecks: createProofChecks({
      activeAgent,
      thread: agentThread,
    }),
    multipassFacts: createMultipassFacts({ activeAgent, ownerDisplayName }),
    memoryEntries,
    agentThread,
    recall,
    threadContextItems: createThreadContextItems({
      activeAgent,
      activeCred,
      memoryCount: memoryEntries.length,
      proposalCount,
      participantCount: roomParticipants.length,
      thread: agentThread,
      verifiedLabel,
    }),
    agents: agentCards,
    rosterPreviewAgents: agentCards.slice(0, 8),
    agentRoster,
  };
}

export function renderMultipassConsole(snapshot = {}) {
  const showDesktopRoster = Boolean(snapshot.session?.wallet?.authenticated);
  return `
    <main class="multipass-console" aria-label="Multipass Console">
      ${renderSuitePanel(snapshot)}
      <section class="console-workspace-grid console-basic-shell${showDesktopRoster ? ' console-basic-shell-roster-active' : ''}" aria-label="Agent console">
        ${renderConsoleAgentSwitcher(snapshot)}
        ${renderConsoleWorkspaceNav(snapshot, { mobile: true })}
        <section class="console-workspace-main console-basic-main" aria-label="Selected agent workspace">
          ${renderConsolePrimaryWorkspace(snapshot)}
        </section>

        <aside class="console-workspace-sidebar console-basic-sidebar${snapshot.workspaceView === 'multipass' ? ' console-basic-sidebar-multipass-active' : ''}" aria-label="Wallet and agents">
          <header class="console-dashboard-header console-sidebar-header">
            <div class="console-sidebar-brand">
              <h1>Multipass Console</h1>
            </div>
          </header>
          ${renderConsoleWorkspaceNav(snapshot)}
          ${renderIdentityCard(snapshot.identityCard)}
          ${renderSessionPanel(snapshot.session)}
        </aside>
        ${showDesktopRoster ? renderConsoleMainRosterDrawer(snapshot) : ''}
      </section>
    </main>
  `;
}

function createConsoleRestapNetworkSnapshot(networkState, tokenId) {
  const selectedTokenId = String(tokenId ?? '').trim();
  if (networkState?.selectedTokenId === selectedTokenId) return networkState;
  if (!selectedTokenId) return createInitialConsoleRestapNetworkState();
  if (!/^[1-9][0-9]*$/u.test(selectedTokenId) || BigInt(selectedTokenId) > 7_777n) {
    return Object.freeze({
      status: 'unavailable',
      selectedTokenId,
      requestId: 0,
      policy: null,
      intents: Object.freeze([]),
      error: 'RESTAP network controls are unavailable for this Looper.',
    });
  }
  return createInitialConsoleRestapNetworkState(selectedTokenId);
}

function renderConsolePrimaryWorkspace(snapshot = {}) {
  const session = snapshot.session ?? {};
  const wallet = session.wallet ?? {};
  if (snapshot.workspaceView === 'missions') {
    if (snapshot.missions?.view === 'editor') return renderMissionEditor(snapshot.missions);
    if (snapshot.missions?.view === 'detail') return renderMissionDetail(snapshot.missions);
    if (snapshot.missions?.view === 'workspace') return renderMissionWorkspace(snapshot.missions);
    if (snapshot.missions?.view === 'settlement') return renderMissionSettlement(snapshot.missions);
    return renderMissionBoard(snapshot.missions);
  }
  if (wallet.connected && !wallet.authenticated) return renderConsoleAuthGate(wallet);
  if (!wallet.authenticated) {
    return renderConsoleAgentThread({
      ...snapshot.agentThread,
      recall: snapshot.recall,
      contextItems: snapshot.threadContextItems,
    });
  }
  const thread = renderConsoleAgentThread({
    ...snapshot.agentThread,
    recall: snapshot.recall,
    contextItems: snapshot.threadContextItems,
  });
  if (!session.activeAgentId) return thread;
  let workspace;
  if (snapshot.workspaceView === 'codex') {
    workspace = renderConsoleCodexWorkspace(snapshot.codex);
  } else if (snapshot.workspaceView === 'wallet' && snapshot.identityCard?.agentWallet) {
    workspace = renderConsoleWalletWorkspace(snapshot.identityCard);
  } else if (snapshot.workspaceView === 'multipass') {
    workspace = renderIdentityCard(snapshot.identityCard);
  } else if (snapshot.workspaceView === 'network') {
    workspace = renderConsoleRestapNetworkPanel(snapshot.restapNetwork);
  } else {
    workspace = shouldGateConsoleChat(snapshot.agentThread)
      ? renderConsoleActivationGate(snapshot)
      : thread;
  }
  const inactiveThread = snapshot.workspaceView === 'chat'
    ? ''
    : `<div class="console-inactive-chat" hidden>${thread}</div>`;
  return `${workspace}${inactiveThread}`;
}

function renderConsoleAgentSwitcher(snapshot = {}) {
  const session = snapshot.session ?? {};
  const card = snapshot.identityCard ?? {};
  const rosterCount = Array.isArray(snapshot.agents) ? snapshot.agents.length : 0;
  const rosterStatus = snapshot.agentRoster?.status ?? 'idle';
  const stat = rosterCount
    ? `${rosterCount} owned`
    : rosterStatus === 'loading'
      ? 'Loading'
      : rosterStatus === 'error'
        ? 'Retry'
        : 'None';
  const imageUrl = safeConsoleAvatarUrl(card.image);
  const portraitFallback = escapeHtml(card.portraitPlaceholder ?? initialsForLabel(card.name ?? 'Agent'));
  return `
    <details class="console-agent-switcher-mobile" data-action="toggle-console-roster-drawer" data-console-roster-drawer="switcher" ${snapshot.rosterDrawers?.mainOpen ? 'open' : ''}>
      <summary>
        <div class="console-agent-switcher-current">
          <div class="console-agent-switcher-portrait">
            ${imageUrl
              ? `<img src="${escapeAttribute(imageUrl)}" alt="" loading="lazy" data-console-avatar-image><span class="console-thread-avatar-fallback" hidden>${portraitFallback}</span>`
              : `<span class="console-thread-avatar-fallback">${portraitFallback}</span>`}
          </div>
          <span><small>Agent</small><strong>${escapeHtml(card.name ?? 'Select agent')}</strong></span>
        </div>
        <span class="console-agent-switcher-affordance"><strong>${escapeHtml(stat)}</strong><i aria-hidden="true"></i></span>
      </summary>
      <div class="console-agent-switcher-body">${renderAgentSelector(session)}</div>
    </details>
  `;
}

function renderConsoleMainRosterDrawer(snapshot = {}) {
  const session = snapshot.session ?? {};
  const rosterCount = Array.isArray(snapshot.agents) ? snapshot.agents.length : 0;
  const rosterStatus = snapshot.agentRoster?.status ?? 'idle';
  const stat = rosterCount
    ? `${rosterCount} owned`
    : rosterStatus === 'loading'
      ? 'Loading'
      : rosterStatus === 'error'
        ? 'Retry'
        : 'None';
  const hint = session.activeAgentId
    ? `${session.activeAgentLabel} · Token #${session.activeAgentId}`
    : 'Choose a Looper to continue';
  return renderConsoleDrawer({
    label: 'Agents',
    title: 'My agents',
    stat,
    hint,
    open: Boolean(snapshot.rosterDrawers?.mainOpen),
    action: 'toggle-console-roster-drawer',
    drawer: 'main',
    className: 'console-main-context-drawer console-main-roster-drawer',
    body: renderConsoleAgentOnboarding(snapshot),
  });
}

function renderConsoleWorkspaceNav(snapshot = {}, { mobile = false } = {}) {
  const agentAvailable = Boolean(snapshot.session?.activeAgentId);
  const walletAvailable = Boolean(agentAvailable && snapshot.identityCard?.agentWallet);
  const view = ['wallet', 'multipass', 'codex', 'network', 'missions'].includes(snapshot.workspaceView) ? snapshot.workspaceView : 'chat';
  const networkStatus = getConsoleRestapNetworkStatus(snapshot.restapNetwork);
  const placementClass = mobile ? 'console-workspace-nav-mobile' : 'console-workspace-nav-sidebar';
  return `
    <nav class="console-workspace-nav ${placementClass}" aria-label="Console workspace${mobile ? ' mobile' : ''}">
      <button type="button" data-action="set-console-workspace-view" data-console-view="missions" ${view === 'missions' ? 'aria-current="page"' : ''}>
        <span>Swarm Command</span><small>Mission board</small>
      </button>
      <button type="button" data-action="set-console-workspace-view" data-console-view="chat" ${view === 'chat' ? 'aria-current="page"' : ''} ${agentAvailable ? '' : 'disabled'}>
        <span>Chat</span><small>${agentAvailable ? 'Agent room' : 'Waiting'}</small>
      </button>
      <button type="button" data-action="set-console-workspace-view" data-console-view="codex" ${view === 'codex' ? 'aria-current="page"' : ''} ${agentAvailable ? '' : 'disabled'}>
        <span>Codex</span><small>${agentAvailable ? 'Verified identity' : 'Select agent'}</small>
      </button>
      <button type="button" data-action="set-console-workspace-view" data-console-view="wallet" ${view === 'wallet' ? 'aria-current="page"' : ''} ${walletAvailable ? '' : 'disabled'}>
        <span>Wallet</span><small>${walletAvailable ? formatWalletWorkspaceStatus(snapshot.identityCard.agentWallet) : 'Select agent'}</small>
      </button>
      <button type="button" data-action="set-console-workspace-view" data-console-view="multipass" ${view === 'multipass' ? 'aria-current="page"' : ''} ${agentAvailable ? '' : 'disabled'}>
        <span>Multipass</span><small>Manage</small>
      </button>
      <button type="button" class="console-network-nav console-network-nav-${networkStatus.key}" data-action="set-console-workspace-view" data-console-view="network" data-restap-focus-key="nav-network-${mobile ? 'mobile' : 'sidebar'}" aria-label="Network, RESTAP, ${networkStatus.label}" ${view === 'network' ? 'aria-current="page"' : ''} ${agentAvailable ? '' : 'disabled'}>
        <span>Network</span><small><i aria-hidden="true"></i>RESTAP <b>${networkStatus.label}</b></small>
      </button>
    </nav>
  `;
}

function shouldGateConsoleChat(thread = {}) {
  return thread.status === 'inactive'
    || thread.status === 'cancelled'
    || thread.operationStatus === 'cancelled'
    || thread.status === 'activating'
    || (thread.status === 'error' && thread.activationRetryAvailable);
}

function renderConsoleActivationGate(snapshot = {}) {
  const thread = snapshot.agentThread ?? {};
  const tokenId = snapshot.session?.activeAgentId ?? '';
  const activating = thread.status === 'activating';
  const retry = thread.status === 'error' && thread.activationRetryAvailable;
  return `
    <section class="console-activation-gate" aria-labelledby="console-activation-gate-title">
      <span class="console-gate-eyebrow">Chat activation</span>
      <h2 id="console-activation-gate-title">Activate Looper #${escapeHtml(tokenId)} to start Chat</h2>
      <p>${retry ? 'Chat activation did not finish. Codex remains available while you retry.' : 'Codex is available now. Activate only when you are ready to open the agent room.'}</p>
      <button type="button" data-action="activate-selected-console-agent" ${activating ? 'disabled' : ''}>${activating ? 'Activating Chat…' : retry ? 'Retry Chat activation' : 'Activate Chat'}</button>
      ${retry && thread.error ? `<p class="console-thread-error" role="alert">${escapeHtml(thread.error)}</p>` : ''}
    </section>
  `;
}

function renderConsoleAuthGate(wallet = {}) {
  const busy = ['connecting', 'preparing_signature', 'signing', 'loading_roster'].includes(wallet.status);
  return `
    <section class="console-auth-gate" aria-labelledby="console-auth-gate-title">
      <span class="console-gate-eyebrow">One signature left</span>
      <h2 id="console-auth-gate-title">Sign in to Console</h2>
      <p>Your wallet is connected, but the private Console is still locked. Sign once to prove ownership and load your Loopers.</p>
      <div class="console-auth-gate-wallet"><span>Connected wallet</span><strong>${escapeHtml(wallet.label ?? 'Wallet connected')}</strong></div>
      <button type="button" data-action="connect-console-wallet" ${busy || wallet.unavailable || !wallet.ready ? 'disabled' : ''}>${wallet.status === 'preparing_signature' ? 'Preparing sign-in…' : busy ? 'Signing in…' : 'Sign in with wallet'}</button>
      ${wallet.error ? `<p class="console-wallet-error" role="alert">${escapeHtml(wallet.error)}</p>` : ''}
      <small>This does not create a transaction or give the agent spending access.</small>
    </section>
  `;
}

function renderConsoleAgentOnboarding(snapshot = {}) {
  const gallery = snapshot.gallery ?? {};
  const agentsById = new Map((Array.isArray(snapshot.agents) ? snapshot.agents : []).map((agent) => [String(agent.tokenId ?? ''), agent]));
  const agents = (Array.isArray(gallery.visible) ? gallery.visible : [])
    .map((agent) => agentsById.get(String(agent?.tokenId ?? '')) ?? agent)
    .filter(Boolean);
  const loading = gallery.status === 'loading' || gallery.status === 'idle';
  const failed = gallery.status === 'error';
  const loaded = gallery.status === 'loaded';
  const completion = loaded && gallery.total > 0 ? `All ${gallery.total} Loopers loaded` : '';
  const hasSelection = Boolean(snapshot.session?.activeAgentId);
  return `
    <section class="console-agent-onboarding console-agent-gallery" aria-labelledby="console-agent-onboarding-title" aria-busy="${loading ? 'true' : 'false'}">
      <header>
        <span class="console-gate-eyebrow">Wallet verified</span>
        <h2 id="console-agent-onboarding-title">${hasSelection ? 'Switch Loopers' : 'Choose your Looper'}</h2>
        <p>${hasSelection ? 'Open another owned Looper, or keep working with the selected one.' : 'Select the agent you want to open. Its private room, identity, memory, and wallet will load together.'}</p>
      </header>
      ${loaded && gallery.total > 0 ? renderConsoleAgentGalleryControls(gallery) : ''}
      <p class="console-agent-gallery-status" aria-live="polite">${escapeHtml(loading ? 'Loading all owned Loopers' : completion)}</p>
      ${loading ? renderConsoleAgentGalleryLoading() : ''}
      ${failed ? renderConsoleAgentGalleryError(gallery) : ''}
      ${loaded && gallery.activationError ? renderConsoleAgentGalleryActivationError(gallery.activationError) : ''}
      ${loaded && gallery.emptyKind === 'owned' ? renderConsoleAgentGalleryOwnedEmpty() : ''}
      ${loaded && gallery.emptyKind === 'filtered' ? renderConsoleAgentGalleryFilteredEmpty(gallery) : ''}
      ${loaded && agents.length ? `<div class="console-agent-onboarding-grid console-agent-gallery-grid" role="list">${agents.map(renderConsoleAgentGalleryCard).join('')}</div>` : ''}
      <footer class="console-agent-gallery-footer">
        <button type="button" data-action="refresh-console-owned-agents" ${gallery.refreshDisabled ? 'disabled' : ''}>Refresh ownership</button>
        <a href="https://opensea.io/collection/loopers-639312714" target="_blank" rel="noopener noreferrer">Browse Loopers on OpenSea <span aria-hidden="true">↗</span></a>
      </footer>
    </section>
  `;
}

function renderConsoleAgentGalleryControls(gallery = {}) {
  return `
    <div class="console-agent-gallery-toolbar">
      <label>
        <span>Search owned Loopers</span>
        <input type="search" data-action="search-console-agent-gallery" value="${escapeAttribute(gallery.query ?? '')}" placeholder="Name or token ID">
      </label>
      <label>
        <span>Sort agents</span>
        <select data-action="sort-console-agent-gallery">
          ${renderGallerySortOption('token-asc', 'Token ID: low to high', gallery.sort)}
          ${renderGallerySortOption('token-desc', 'Token ID: high to low', gallery.sort)}
          ${renderGallerySortOption('name-asc', 'Name: A to Z', gallery.sort)}
          ${renderGallerySortOption('name-desc', 'Name: Z to A', gallery.sort)}
        </select>
      </label>
    </div>
  `;
}

function renderGallerySortOption(value, label, selected) {
  return `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`;
}

function renderConsoleAgentGalleryCard(agent = {}) {
  const tokenId = String(agent.tokenId ?? '');
  const name = String(agent.name ?? 'Onchain agent');
  const accessibleName = `${name}, Looper #${tokenId}`;
  return `
    <article class="console-agent-gallery-card" role="listitem">
      ${agent.image
        ? `<div class="console-agent-choice-avatar"><img src="${escapeAttribute(agent.image)}" alt="${escapeAttribute(accessibleName)}" loading="lazy"></div>`
        : `<div class="console-agent-choice-avatar" role="img" aria-label="${escapeAttribute(accessibleName)}">${escapeHtml(initialsForLabel(name || tokenId || 'A'))}</div>`}
      <h3>${escapeHtml(name)}</h3>
      <p class="console-agent-gallery-summary">Looper #${escapeHtml(tokenId)} · ${escapeHtml(agent.role ?? 'Agent profile')} · ${agent.verified ? 'Verified' : 'Verification pending'}</p>
      ${renderCompactCred(agent)}
      <button type="button" data-action="activate-console-room" data-token-id="${escapeAttribute(tokenId)}" aria-label="${escapeAttribute(`Open ${accessibleName}`)}" ${agent.activationDisabled ? 'disabled' : ''}>Open agent</button>
    </article>
  `;
}

function renderConsoleAgentGalleryLoading() {
  return '<div class="console-agent-gallery-state"><strong>Loading your collection</strong><p>Checking every Looper owned by this wallet.</p></div>';
}

function renderConsoleAgentGalleryError(gallery = {}) {
  return `<div class="console-agent-gallery-state console-agent-gallery-error" role="alert"><strong>Owned Loopers could not be loaded</strong><p>${escapeHtml(gallery.error ?? 'The ownership scan failed.')}</p><button type="button" data-action="refresh-console-owned-agents" ${gallery.refreshDisabled ? 'disabled' : ''}>Retry ownership scan</button></div>`;
}

function renderConsoleAgentGalleryActivationError(error) {
  return `<div class="console-agent-gallery-state console-agent-gallery-error" role="alert"><strong>Agent could not be opened</strong><p>${escapeHtml(error)}</p></div>`;
}

function renderConsoleAgentGalleryOwnedEmpty() {
  return '<div class="console-agent-gallery-state"><strong>No owned Loopers found</strong><p>This wallet does not currently own a Looper.</p></div>';
}

function renderConsoleAgentGalleryFilteredEmpty(gallery = {}) {
  return `<div class="console-agent-gallery-state"><strong>No Loopers match “${escapeHtml(gallery.query ?? '')}”</strong><p>Try a different name or token ID.</p><button type="button" data-action="clear-console-agent-gallery-search">Clear search</button></div>`;
}

function renderConsoleWalletWorkspace(card = {}) {
  return `
    <section class="console-wallet-workspace" aria-labelledby="console-wallet-workspace-title">
      <header class="console-wallet-workspace-header">
        <div>
          <span class="console-gate-eyebrow">Agent wallet · Base</span>
          <h2 id="console-wallet-workspace-title">${escapeHtml(card.name ?? 'Selected agent')} wallet</h2>
          <p>Owner-controlled funds and permissions for ${escapeHtml(card.tokenLabel ?? 'the selected Looper')}.</p>
        </div>
      </header>
      ${renderLooperAgentWallet(card.agentWallet, { workspace: true })}
    </section>
  `;
}

function formatWalletWorkspaceStatus(wallet = {}) {
  if (wallet.mode === 'active') return 'Ready';
  if (wallet.mode === 'inactive') return 'Setup required';
  if (wallet.mode === 'loading') return 'Loading';
  return 'Read-only';
}

function createAgentThreadSnapshot(state = {}, activeAgent = null, roomParticipants = [], ownerProfile = {}) {
  const wallet = state.walletSnapshot ?? {};
  const agentRoster = state.consoleOwnedAgents ?? {};
  const connected = Boolean(wallet.connected && wallet.address);
  const thread = state.consoleAgentThread ?? {};
  const loadingAgents = agentRoster.status === 'loading';
  const rosterError = agentRoster.error ?? null;
  const hasAgent = Boolean(activeAgent?.tokenId);
  const threadParticipants = normalizeThreadParticipants(roomParticipants);
  const latestAgentMessage = thread.messages?.findLast?.((message) => message.role === 'agent');
  const hasRuntimeProof = Boolean(thread.messages?.length || thread.proposals?.length || thread.savedMemory?.length || thread.recalledMemory?.length);
  return {
    status: thread.status ?? 'idle',
    operationStatus: thread.operationStatus ?? null,
    disabled: !connected || loadingAgents || !hasAgent,
    error: thread.error ?? null,
    errorKind: thread.errorKind ?? null,
    retryAvailable: Boolean(thread.retryAvailable),
    activationRetryAvailable: Boolean(thread.activationRetryAvailable),
    roomActivationDisabled: state.consoleAgentNameMutation?.status === 'pending',
    draft: String(thread.draft ?? ''),
    attachment: thread.attachment ?? null,
    title: thread.title ?? null,
    metaLabel: thread.metaLabel ?? null,
    contextLabel: thread.contextLabel ?? null,
    agentAvatarUrl: safeConsoleAvatarUrl(activeAgent?.image),
    transport: formatTransportLabel(thread.transport, { live: Boolean(thread.conversationId) }),
    rawTransport: String(thread.transport ?? ''),
    conversationId: String(thread.conversationId ?? ''),
    roomKey: String(thread.conversationId ?? '').trim()
      || `${String(activeAgent?.tokenId ?? '').trim()}:${String(thread.roomName ?? '').trim() || deriveRoomName(threadParticipants)}`,
    scrollRequest: Number(state.consoleScrollRequest ?? 0),
    memoryProvider: formatMemoryProviderLabel(thread.memoryProvider),
    rawMemoryProvider: String(thread.memoryProvider ?? ''),
    inferenceProvider: formatInferenceProviderLabel(thread.inferenceProvider),
    rawInferenceProvider: String(thread.inferenceProvider ?? ''),
    executionMode: String(thread.executionMode ?? ''),
    defaultMission: DEFAULT_CONSOLE_MISSION,
    agentName: activeAgent?.name ?? null,
    roomName: String(thread.roomName ?? '').trim() || deriveRoomName(threadParticipants.length ? threadParticipants : [activeAgent].filter(Boolean)),
    participants: threadParticipants.length ? threadParticipants : normalizeThreadParticipants([activeAgent].filter(Boolean)),
    messages: decorateConsoleMessages(thread.messages, { activeAgent, ownerProfile }),
    proposals: thread.proposals,
    ...(Object.prototype.hasOwnProperty.call(thread, 'capabilities') ? { capabilities: thread.capabilities } : {}),
    ...(Object.prototype.hasOwnProperty.call(thread, 'proposalCandidates') ? { proposalCandidates: thread.proposalCandidates } : {}),
    savedMemory: thread.savedMemory,
    recalledMemory: thread.recalledMemory,
    savedMemoryPresent: Object.prototype.hasOwnProperty.call(thread, 'savedMemory') && Array.isArray(thread.savedMemory),
    recalledMemoryPresent: Object.prototype.hasOwnProperty.call(thread, 'recalledMemory') && Array.isArray(thread.recalledMemory),
    missions: thread.missions,
    recalledMission: thread.recalledMission ?? null,
    canReset: hasRuntimeProof,
    summary: latestAgentMessage
      ? 'Live chat updated.'
      : !connected
        ? 'Your private room opens after wallet sign-in.'
      : loadingAgents
        ? 'Loading wallet-owned agents.'
      : rosterError
        ? 'Could not load wallet-owned agents.'
      : !hasAgent
        ? 'Select an owned agent to open a room.'
        : threadParticipants.length > 1
          ? `Room ready with ${threadParticipants.length} room participants.`
          : 'XMTP room ready.',
  };
}

function renderSessionPanel(session = {}) {
  const wallet = session.wallet ?? {};
  const connected = Boolean(wallet.connected);
  const walletLabel = connected ? wallet.label : null;
  const roomStat = session.activeAgentId
    ? (session.activeAgentLabel ?? `#${session.activeAgentId}`)
    : connected
      ? 'Waiting'
      : 'Locked';
  const roomHint = session.activeAgentId
    ? 'Room is bound to the selected wallet-owned agent.'
    : connected
      ? 'Choose an agent from My agents to open the room.'
      : 'Waiting for a wallet-owned agent.';
  const sessionNote = connected
    ? null
    : (wallet.unavailable ? 'Wallet login is unavailable for this build.' : 'Sign in to load owned Loopers.');
  const walletOperation = createWalletOperation(wallet.status, session.rosterStatus);

  return `
    <section class="console-panel console-session-panel console-wallet-panel" aria-label="Console session">
      ${walletOperation || wallet.error ? `
        <div class="console-session-banner" role="status">
          ${walletOperation ? `<strong>${escapeHtml(walletOperation)}</strong>` : ''}
          ${wallet.error ? `<span>${escapeHtml(wallet.error)}</span>` : ''}
        </div>
      ` : ''}
      ${renderConsoleDrawer({
        label: 'Session',
        title: 'Current room',
        stat: roomStat,
        hint: roomHint,
        open: false,
        body: `
          <dl class="console-session-status-grid">
            ${(session.status ?? []).map(renderStatusItem).join('')}
          </dl>
          ${walletLabel ? `<p class="console-wallet-label">${escapeHtml(walletLabel)}</p>` : ''}
          ${sessionNote ? `<p class="console-session-note">${escapeHtml(sessionNote)}</p>` : ''}
        `,
      })}
    </section>
  `;
}

function createWalletOperation(walletStatus, rosterStatus) {
  if (walletStatus === 'connecting') return 'Connecting wallet…';
  if (walletStatus === 'preparing_signature') return 'Preparing wallet challenge…';
  if (walletStatus === 'signing') return 'Signing Console authentication…';
  if (walletStatus === 'loading_roster' || rosterStatus === 'loading') return 'Loading wallet-owned Loopers…';
  if (walletStatus === 'cancelled') return 'Wallet operation cancelled.';
  if (walletStatus === 'authorization_failed') return 'Authorization failed. Connect again.';
  if (walletStatus === 'transport_failed') return 'Wallet transport failed. Try again.';
  if (walletStatus === 'wallet_changed') return 'Wallet changed. A new authenticated session is required.';
  return null;
}

function renderAgentSelector(session = {}) {
  return `
    <div class="console-session-actions">
      <label class="console-agent-selector">
        <span>Choose agent</span>
        <select name="console_agent" data-action="select-console-agent" ${session.selectionEnabled ? '' : 'disabled'}>
          ${renderAgentOptions(session)}
        </select>
      </label>
    </div>
  `;
}

function renderIdentityCard(card = {}) {
  const imageUrl = safeConsoleAvatarUrl(card.image);
  const portraitFallback = escapeHtml(card.portraitPlaceholder ?? initialsForLabel(card.name ?? 'Agent'));
  const statsSummary = (card.stats ?? [])
    .map((item) => item?.value)
    .filter(Boolean)
    .slice(0, 2)
    .join(' · ');
  const trustStat = card.emptyState ? 'Not loaded' : (statsSummary || card.badges?.[0] || 'Awaiting trust');
  const memberCount = Array.isArray(card.participants) ? card.participants.length : 0;
  return `
    <section class="console-visual-card console-identity-card${card.emptyState ? ' console-identity-card-empty' : ''}" aria-label="Selected agent">
      <div class="console-agent-portrait">
        ${imageUrl
          ? `<img src="${escapeAttribute(imageUrl)}" alt="" loading="lazy" data-console-avatar-image><span class="console-thread-avatar-fallback" hidden>${portraitFallback}</span>`
          : `<div class="console-agent-portrait-placeholder">${portraitFallback}</div>`}
      </div>
      <div class="console-card-head">
        ${card.label ? `<p class="card-label">${escapeHtml(card.label)}</p>` : ''}
        ${card.walletLabel ? `<span>${escapeHtml(card.walletLabel)}</span>` : ''}
      </div>
      <div class="console-identity-body">
        <span>${escapeHtml(card.role ?? 'Onchain agent')}</span>
        <strong>${escapeHtml(card.name ?? 'Select an agent')}</strong>
        <small>${escapeHtml(card.roomName ?? 'Selected room')}</small>
        ${card.summary ? `<p>${escapeHtml(card.summary)}</p>` : ''}
        <div class="console-identity-keyline">
          <span>${escapeHtml(card.tokenLabel ?? 'Token not loaded')}</span>
          ${card.erc8004Label ? `<span>${escapeHtml(card.erc8004Label)}</span>` : ''}
        </div>
      </div>
      ${(card.badges ?? []).length ? `
        <div class="console-identity-badges">
          ${(card.badges ?? []).map((badge) => `<span>${escapeHtml(badge)}</span>`).join('')}
        </div>
      ` : ''}
      ${card.rename ? renderConsoleDrawer({
        label: 'Alias',
        title: 'Agent name',
        stat: card.rename.value ?? card.name ?? 'Selected agent',
        hint: card.rename.hint ?? 'Console-only alias.',
        open: false,
        body: `
          <form class="console-identity-rename" data-action="update-console-agent-name" aria-label="Update agent name">
            <label>
              <span>Agent name</span>
              <input
                name="console_agent_name"
                value="${escapeAttribute(card.rename.value ?? '')}"
                placeholder="${escapeAttribute(card.rename.placeholder ?? 'Selected agent')}"
                ${card.rename.enabled ? '' : 'disabled'}
              >
            </label>
            <div class="console-identity-rename-actions">
              <button type="submit" ${card.rename.enabled ? '' : 'disabled'}>Update name</button>
              <button type="button" data-action="reset-console-agent-name" ${card.rename.resettable ? '' : 'disabled'}>Use live name</button>
            </div>
            <small>${escapeHtml(card.rename.hint ?? 'Console-only name.')}</small>
          </form>
        `,
      }) : ''}
      ${renderConsoleDrawer({
        label: 'Identity',
        title: 'Identity data',
        stat: card.tokenLabel ?? trustStat,
        hint: 'Canonical onchain identifiers for this Looper.',
        open: false,
        body: `
          <dl class="console-identity-data">
            ${(card.identityData ?? []).map((item) => `
              <div>
                <dt>${escapeHtml(item.label)}</dt>
                <dd>${escapeHtml(item.value)}</dd>
              </div>
            `).join('')}
          </dl>
        `,
      })}
      ${memberCount > 1 ? renderConsoleDrawer({
        label: 'Room',
        title: 'Participants',
        stat: `${memberCount} in room`,
        hint: memberCount === 1 ? 'Single-participant room.' : 'Room participants for this thread.',
        open: false,
        body: `
          <div class="console-identity-members">
            <span class="console-identity-members-label">${escapeHtml(memberCount === 1 ? 'Room participant' : 'Room participants')}</span>
            <div class="console-identity-members-list">
              ${(card.participants ?? []).map(renderIdentityParticipant).join('')}
            </div>
          </div>
        `,
      }) : ''}
    </section>
  `;
}

function hasNonterminalLooperWalletWork(wallet) {
  const nonterminal = new Set(['prepared', 'preflighted', 'submitted', 'uncertain_hashless', 'uncertain_hashed']);
  return ['activation', 'send', 'policy'].some((kind) => nonterminal.has(wallet?.[kind]?.state));
}

function normalizeLooperAgentWallet(wallet, tokenId) {
  if (!wallet || String(wallet.tokenId ?? tokenId) !== String(tokenId)) return null;
  const rpcFailed = wallet.mode === 'read_only' && wallet.reason === 'rpc_disagreement';
  const idleAttempt = { state: 'idle', txHash: null, attributable: false, preparedId: null };
  return {
    mode: String(wallet.mode ?? 'read_only'),
    reason: wallet.reason ? String(wallet.reason) : null,
    account: wallet.account ? String(wallet.account) : null,
    operatorProfile: ['eoa', 'eip7702', 'coinbase_smart_wallet', 'contract', 'malformed'].includes(wallet.operatorProfile)
      ? wallet.operatorProfile
      : 'unknown',
    nativeWei: String(wallet.nativeWei ?? '0'),
    tokens: Array.isArray(wallet.tokens) ? wallet.tokens : [],
    pantheonCred: normalizePantheonCredState(wallet.pantheonCred),
    refreshedAt: wallet.refreshedAt ? String(wallet.refreshedAt) : null,
    activation: rpcFailed ? idleAttempt : (wallet.activation ?? { state: 'idle' }),
    send: rpcFailed ? idleAttempt : (wallet.send ?? { state: 'idle' }),
    policy: rpcFailed ? idleAttempt : (wallet.policy ?? { state: 'idle' }),
    policyStatus: rpcFailed ? 'read-only' : String(wallet.policyStatus ?? (wallet.mode === 'active' ? 'owner-only' : 'read-only')),
    policyModule: wallet.policyModule ? String(wallet.policyModule) : null,
    policyEpoch: wallet.policyEpoch === null || wallet.policyEpoch === undefined ? null : String(wallet.policyEpoch),
    policyRecoveryAllowed: rpcFailed ? false : Boolean(wallet.policyRecoveryAllowed),
    canTransact: rpcFailed ? false : wallet.canTransact === undefined
      ? wallet.mode === 'inactive' || wallet.mode === 'active'
      : Boolean(wallet.canTransact),
    error: wallet.error ? String(wallet.error) : null,
  };
}

function renderLooperAgentWallet(wallet, { workspace = false } = {}) {
  if (!wallet) return '';
  const account = wallet.account;
  const modeLabel = wallet.mode === 'inactive'
    ? 'Setup required'
    : wallet.mode === 'loading'
      ? 'Loading'
      : wallet.policyStatus === 'permission-hook-paused'
          ? 'Permission hook paused'
          : wallet.policyStatus === 'module-blocked'
            ? 'Policy blocked'
            : wallet.policyStatus === 'owner-only' || wallet.policyStatus === 'active-policy'
              ? 'Owner controlled'
              : wallet.mode === 'blocked'
                ? 'Blocked'
                : 'Read-only';
  const uncertainAttempts = ['activation', 'send', 'policy']
    .filter((kind) => ['uncertain_hashless', 'uncertain_hashed'].includes(wallet[kind]?.state));
  const busy = ['prepared', 'submitted', 'uncertain_hashless', 'uncertain_hashed'].includes(wallet.activation?.state)
    || ['prepared', 'submitted', 'uncertain_hashless', 'uncertain_hashed'].includes(wallet.send?.state)
    || ['prepared', 'submitted', 'uncertain_hashless', 'uncertain_hashed'].includes(wallet.policy?.state);
  const nativeBalance = `${formatWalletUnits(wallet.nativeWei, 18)} ETH`;
  const assetCount = 1 + (wallet.tokens ?? []).length;
  const canActivate = wallet.mode === 'inactive' && wallet.canTransact;
  const looperWalletLabel = wallet.mode === 'active'
    ? 'Active'
    : wallet.mode === 'inactive'
      ? 'Ready to activate'
      : wallet.mode === 'loading'
        ? 'Loading'
        : wallet.mode === 'blocked'
          ? 'Blocked'
          : 'Read-only';
  const showDetails = Boolean(account
    || (wallet.mode === 'inactive' && wallet.canTransact)
    || (wallet.mode === 'active' && wallet.canTransact)
    || wallet.policyRecoveryAllowed
    || uncertainAttempts.length);
  const ownerSignerLabel = wallet.operatorProfile === 'eoa'
    ? 'Direct EOA'
    : wallet.operatorProfile === 'eip7702'
      ? 'Delegated EOA'
      : wallet.operatorProfile === 'coinbase_smart_wallet'
        ? 'Coinbase Smart Wallet'
      : wallet.operatorProfile === 'contract'
        ? 'Contract — blocked'
        : wallet.operatorProfile === 'malformed'
          ? 'Malformed code — blocked'
          : 'Unverified';
  const trackedAssets = account ? [
    {
      symbol: 'ETH',
      name: 'Ethereum',
      balance: formatWalletUnits(wallet.nativeWei, 18),
      meta: 'Base native asset',
    },
    ...(wallet.tokens ?? []).map((token) => ({
      symbol: String(token.symbol ?? 'Token'),
      name: String(token.symbol ?? 'Token'),
      balance: formatWalletUnits(token.balanceBaseUnits, token.decimals),
      meta: 'Agent economy · Base',
    })),
  ] : [];
  const canSend = wallet.mode === 'active' && wallet.canTransact;
  const canStakeCred = canSend && (wallet.tokens ?? []).some(
    (token) => normalizeWalletAddress(token.contract) === normalizeWalletAddress(CRED_ADDRESS),
  );
  const keepPantheonCredOpen = new Set([
    'approval_prepared',
    'approval_submitting',
    'approved',
    'stake_prepared',
    'stake_submitting',
    'error',
  ]).has(wallet.pantheonCred.status);
  const canRecoverPolicy = Boolean(wallet.policyRecoveryAllowed);
  const reasonCopy = wallet.reason ? formatWalletReason(wallet.reason) : null;
  const controlState = wallet.mode === 'active' && wallet.canTransact
    ? { tone: 'ready', icon: '✓', title: 'Owner approval required', body: 'Every transaction requires your wallet approval.' }
    : wallet.mode === 'inactive'
      ? { tone: 'warning', icon: '!', title: 'Activation required', body: reasonCopy ?? 'Activate once before this wallet can send assets.' }
      : wallet.mode === 'loading'
        ? { tone: 'neutral', icon: '…', title: 'Checking wallet', body: 'Verifying the canonical account and owner permissions on Base.' }
        : wallet.mode === 'blocked'
          ? { tone: 'error', icon: '!', title: 'Wallet blocked', body: reasonCopy ?? 'Wallet writes are blocked until verification succeeds.' }
          : { tone: 'warning', icon: '!', title: 'Transfers unavailable', body: reasonCopy ?? 'Wallet writes are disabled because verification is incomplete.' };
  return `
    <section class="console-looper-wallet${workspace ? ' console-looper-wallet-workspace' : ''}" aria-label="Selected Looper agent wallet">
      <div class="console-looper-wallet-head">
        <div class="console-looper-wallet-title">
          <span>Looper wallet</span>
          <strong class="console-looper-wallet-status" data-wallet-mode="${escapeAttribute(wallet.mode)}">${escapeHtml(modeLabel)}</strong>
        </div>
        <button type="button" data-action="refresh-looper-agent-wallet" ${busy ? 'disabled' : ''}>Refresh</button>
      </div>
      ${account ? `<section class="console-looper-wallet-overview console-looper-wallet-hero" aria-label="Wallet balance summary">
        <div>
          <span>Available balance</span>
          <strong class="console-looper-wallet-primary-balance">${escapeHtml(nativeBalance)}</strong>
          <small>${assetCount} tracked ${assetCount === 1 ? 'asset' : 'assets'} on Base</small>
        </div>
        <span class="console-looper-wallet-network">Base</span>
      </section>` : ''}
      ${canActivate ? `
        <div class="console-looper-wallet-activation-callout" aria-labelledby="console-looper-wallet-activation-title">
          <div>
            <strong id="console-looper-wallet-activation-title">Activate your Looper wallet</strong>
            <p>Activate once to create your owner-controlled wallet on Base. Your agent remains review-only.</p>
          </div>
          <form class="console-looper-wallet-activation" data-action="activate-looper-agent-wallet">
            <label><input type="checkbox" name="confirmed" required> I understand activation requires an owner-approved Base transaction.</label>
            <button type="submit" ${busy ? 'disabled' : ''}>Activate wallet</button>
          </form>
        </div>
      ` : ''}
      ${account ? `<div class="console-looper-wallet-actions" aria-label="Wallet actions">
        ${canSend ? `<details class="console-looper-wallet-action" data-wallet-action="send">
          <summary><span aria-hidden="true">↗</span><strong>Send</strong><small>Transfer assets</small></summary>
          <div class="console-looper-wallet-action-body">
            <form class="console-looper-wallet-send" data-action="send-looper-agent-wallet">
              <label><span>Asset</span><select name="asset"><option value="ETH">ETH</option>${(wallet.tokens ?? []).map((token) => `<option value="${escapeAttribute(token.contract)}">${escapeHtml(token.symbol)}</option>`).join('')}</select></label>
              <label><span>Recipient</span><input name="recipient" inputmode="text" autocomplete="off" required></label>
              <label><span>Amount</span><input name="amount" inputmode="decimal" autocomplete="off" required></label>
              <label class="console-looper-wallet-confirm"><input type="checkbox" name="confirmed" required><span>Confirm this exact transfer</span></label>
              <button type="submit" ${busy ? 'disabled' : ''}>Review transfer</button>
            </form>
          </div>
        </details>` : ''}
        ${canStakeCred ? `<details class="console-looper-wallet-action" data-wallet-action="stake-cred"${keepPantheonCredOpen ? ' open' : ''}>
          <summary><span>Stake CRED</span><small>6-month Pantheon lock</small></summary>
          <div class="console-looper-wallet-action-body">
            ${renderPantheonCredAction(wallet.pantheonCred)}
          </div>
        </details>` : ''}
        <details class="console-looper-wallet-action" data-wallet-action="receive">
          <summary><span aria-hidden="true">↓</span><strong>Receive</strong><small>Copy your address</small></summary>
          <div class="console-looper-wallet-action-body">
            <div class="console-looper-wallet-address">
              <span>Receive on Base</span>
              <code>${escapeHtml(account)}</code>
              <a href="https://basescan.org/address/${escapeAttribute(account)}" target="_blank" rel="noopener noreferrer">View on BaseScan</a>
            </div>
          </div>
        </details>
        ${canRecoverPolicy ? `<details class="console-looper-wallet-action" data-wallet-action="advanced">
          <summary><span aria-hidden="true">•••</span><strong>Advanced</strong><small>Permission recovery</small></summary>
          <div class="console-looper-wallet-action-body">
            <div class="console-looper-wallet-advanced-intro">
              <strong>Permission controls</strong>
              <small>Owner recovery only. This never gives the agent autonomous spending access.</small>
            </div>
            <form class="console-looper-wallet-send console-looper-wallet-policy" data-action="set-looper-policy-module">
              <label><span>Permission module</span><input name="module" inputmode="text" autocomplete="off" placeholder="Leave blank to clear"></label>
              <label class="console-looper-wallet-confirm"><input type="checkbox" name="confirmed" required><span>Confirm this exact permission module recovery</span></label>
              <button type="submit" ${busy ? 'disabled' : ''}>Review permission update</button>
            </form>
            ${wallet.policyStatus === 'active-policy' ? '<small>Reviewed permission module configured. Console does not enable agent execution.</small>' : ''}
          </div>
        </details>` : ''}
      </div>` : ''}
      ${trackedAssets.length ? `<section class="console-looper-wallet-assets" aria-labelledby="console-looper-wallet-assets-title">
        <header><strong id="console-looper-wallet-assets-title">Assets</strong><small>${trackedAssets.length} on Base</small></header>
        <div class="console-looper-wallet-balances" aria-label="Tracked wallet assets">
          ${trackedAssets.map((asset) => `<article class="console-looper-wallet-asset-row">
            <span class="console-looper-wallet-asset-icon" aria-hidden="true">${escapeHtml(asset.symbol.slice(0, 1))}</span>
            <span class="console-looper-wallet-asset-name"><strong>${escapeHtml(asset.symbol)}</strong><small>${escapeHtml(asset.name)} · ${escapeHtml(asset.meta)}</small></span>
            <span class="console-looper-wallet-asset-balance"><strong>${escapeHtml(asset.balance)} ${escapeHtml(asset.symbol)}</strong><small>Available</small></span>
          </article>`).join('')}
        </div>
      </section>` : ''}
      <aside class="console-looper-wallet-control-note" data-wallet-tone="${escapeAttribute(controlState.tone)}">
        <span aria-hidden="true">${escapeHtml(controlState.icon)}</span>
        <div><strong>${escapeHtml(controlState.title)}</strong><small>${escapeHtml(controlState.body)}</small></div>
      </aside>
      ${uncertainAttempts.map((kind) => `
        <div class="console-looper-wallet-outcome" role="alert">
          <strong>Transaction outcome unknown</strong>
          <small>${wallet[kind]?.txHash ? `Verify ${escapeHtml(wallet[kind].txHash)} on BaseScan before continuing.` : 'Check your wallet activity before continuing.'}</small>
          <button type="button" data-action="acknowledge-looper-wallet-outcome" data-attempt-kind="${escapeAttribute(kind)}">I checked — unlock controls</button>
        </div>
      `).join('')}
      ${showDetails ? `<details class="console-looper-wallet-details">
        <summary>
          <span>Wallet details</span>
          <small>Address, control, and technical status</small>
        </summary>
        <div class="console-looper-wallet-details-body">
          ${account ? `
            <div class="console-looper-wallet-address">
              <span>Wallet address</span>
              <code>${escapeHtml(account)}</code>
              <a href="https://basescan.org/address/${escapeAttribute(account)}" target="_blank" rel="noopener noreferrer">View on BaseScan</a>
            </div>
          ` : ''}
          <dl class="console-looper-wallet-truth" aria-label="Agent and wallet status">
            <div data-wallet-truth="agent-runtime"><dt>Agent runtime</dt><dd><strong>Review-only</strong></dd></div>
            <div data-wallet-truth="looper-wallet"><dt>Looper wallet</dt><dd><strong>${escapeHtml(looperWalletLabel)}</strong></dd></div>
            <div data-wallet-truth="owner-signer"><dt>Owner signer</dt><dd><strong>${escapeHtml(ownerSignerLabel)}</strong></dd></div>
          </dl>
        </div>
      </details>` : ''}
      ${wallet.error ? `<p class="console-looper-wallet-error" role="alert">${escapeHtml(wallet.error)}</p>` : ''}
    </section>
  `;
}

function normalizePantheonCredState(value) {
  const status = ['idle', 'loading', 'inactive', 'ready', 'approval_prepared', 'approval_submitting', 'approved', 'stake_prepared', 'stake_submitting', 'staked', 'staked_ineligible', 'error'].includes(value?.status)
    ? value.status
    : 'idle';
  return {
    status,
    amountBaseUnits: /^(0|[1-9]\d*)$/.test(String(value?.amountBaseUnits ?? '')) ? String(value.amountBaseUnits) : null,
    preparedId: /^send:[A-Za-z0-9_-]{8,128}$/.test(String(value?.preparedId ?? '')) ? String(value.preparedId) : null,
    allowanceBaseUnits: /^(0|[1-9]\d*)$/.test(String(value?.allowanceBaseUnits ?? '')) ? String(value.allowanceBaseUnits) : '0',
    credBalanceBaseUnits: /^(0|[1-9]\d*)$/.test(String(value?.credBalanceBaseUnits ?? '')) ? String(value.credBalanceBaseUnits) : '0',
    stakeAmountBaseUnits: /^(0|[1-9]\d*)$/.test(String(value?.stakeAmountBaseUnits ?? '')) ? String(value.stakeAmountBaseUnits) : '0',
    stakeBaselineBaseUnits: /^(0|[1-9]\d*)$/.test(String(value?.stakeBaselineBaseUnits ?? '')) ? String(value.stakeBaselineBaseUnits) : null,
    stakeBaselineMonthIndex: /^(0|[1-9]\d*)$/.test(String(value?.stakeBaselineMonthIndex ?? '')) ? String(value.stakeBaselineMonthIndex) : null,
    poolActive: value?.poolActive === true,
    dates: value?.dates && ['rewardsStart', 'firstClaim', 'lockEnds'].every((key) => !Number.isNaN(Date.parse(value.dates[key])))
      ? { rewardsStart: String(value.dates.rewardsStart), firstClaim: String(value.dates.firstClaim), lockEnds: String(value.dates.lockEnds) }
      : null,
    error: value?.error ? String(value.error).slice(0, 240) : null,
  };
}

function renderPantheonCredAction(state = {}) {
  if (state.status === 'loading') return '<p>Checking Pantheon registry and Base pool…</p>';
  if (state.status === 'approval_submitting') return '<p>Approval opened in Base Account. Complete or reject it there…</p>';
  if (state.status === 'stake_submitting') return '<p>Stake opened in Base Account. Complete or reject it there…</p>';
  if (state.status === 'inactive') {
    return '<p>CRED staking is not active in Pantheon yet.</p><button type="button" data-action="load-pantheon-cred">Check again</button>';
  }
  if (state.status === 'error') {
    return '<p role="alert">' + escapeHtml(state.error ?? 'Pantheon staking status is unavailable.') + '</p><button type="button" data-action="load-pantheon-cred">Retry</button>';
  }
  if (state.status === 'approval_prepared' && state.amountBaseUnits && state.preparedId) {
    const topUp = BigInt(state.stakeAmountBaseUnits) > 0n;
    return '<form class="console-looper-wallet-send" data-action="submit-pantheon-approval">'
      + '<p>Safety checks passed. This final tap opens Base Account immediately for transaction 1 of 2.</p>'
      + '<label class="console-looper-wallet-confirm"><input type="checkbox" name="confirmed" required><span>Open Base Account and approve exactly ' + escapeHtml(formatWalletUnits(state.amountBaseUnits, 18)) + ' CRED for the pinned Pantheon vault' + (topUp ? ' as additional principal.' : '.') + '</span></label>'
      + '<button type="submit">Open wallet to approve</button>'
      + '<small>This prepared approval expires after 2 minutes.</small></form>';
  }
  if (state.status === 'stake_prepared' && state.amountBaseUnits && state.preparedId) {
    const topUp = BigInt(state.stakeBaselineBaseUnits ?? '0') > 0n;
    const lockCopy = topUp && state.dates
      ? ' without resetting the existing ' + escapeHtml(state.dates.lockEnds.slice(0, 10)) + ' lock end.'
      : ' for 6 calendar months.';
    return '<form class="console-looper-wallet-send" data-action="submit-pantheon-stake">'
      + '<p>Safety checks passed. This final tap opens Base Account immediately for transaction 2 of 2.</p>'
      + '<label class="console-looper-wallet-confirm"><input type="checkbox" name="confirmed" required><span>Open Base Account and ' + (topUp ? 'add' : 'stake') + ' exactly ' + escapeHtml(formatWalletUnits(state.amountBaseUnits, 18)) + ' CRED' + lockCopy + '</span></label>'
      + '<button type="submit">Open wallet to ' + (topUp ? 'add CRED' : 'stake') + '</button>'
      + '<small>This prepared stake expires after 2 minutes.</small></form>';
  }
  if (state.status === 'ready') {
    return '<form class="console-looper-wallet-send" data-action="approve-pantheon-cred">'
      + '<p>First prepare and verify an exact approval. The next screen provides the direct wallet-opening tap.</p>'
      + '<label><span>Amount</span><input name="amount" inputmode="decimal" autocomplete="off" required placeholder="0.0"></label>'
      + '<label class="console-looper-wallet-confirm"><input type="checkbox" name="confirmed" required><span>I understand the 6-month lock, Pantheon’s monthly reward schedule, 5% claim fee, and 10% early-exit penalty.</span></label>'
      + '<button type="submit">Prepare exact CRED approval</button>'
      + '<small>Spender: ' + escapeHtml(PANTHEON_STAKING_VAULT) + '</small></form>';
  }
  if (state.status === 'approved' && state.amountBaseUnits) {
    const topUp = BigInt(state.stakeAmountBaseUnits) > 0n;
    return '<form class="console-looper-wallet-send" data-action="stake-pantheon-cred">'
      + '<p>Exact approval confirmed. Prepare and verify the separate Pantheon ' + (topUp ? 'add-to-stake' : 'stake') + ' transaction.</p>'
      + '<label class="console-looper-wallet-confirm"><input type="checkbox" name="confirmed" required><span>' + (topUp
        ? 'Prepare this exact approved amount as additional principal. The existing lock end remains ' + (state.dates ? escapeHtml(state.dates.lockEnds.slice(0, 10)) + '.' : 'unchanged.')
        : 'Prepare this exact approved amount for a 6-month stake.') + '</span></label>'
      + '<button type="submit">Prepare ' + (topUp ? 'add-to-stake' : 'stake') + ' transaction</button></form>';
  }
  if (state.status === 'staked' || state.status === 'staked_ineligible') {
    const topUpAction = state.status === 'staked_ineligible'
      ? '<p>Additional CRED cannot be added because this position is exiting or has reached its final earning month.</p>'
      : '<form class="console-looper-wallet-send" data-action="approve-pantheon-cred">'
        + '<p><strong>Add more CRED</strong> without resetting the existing lock end. Added principal starts earning next calendar month.</p>'
        + '<label><span>Additional amount</span><input name="amount" inputmode="decimal" autocomplete="off" required placeholder="0.0"></label>'
        + '<label class="console-looper-wallet-confirm"><input type="checkbox" name="confirmed" required><span>I confirm this exact top-up, the 5% claim fee, and the 10% early-exit penalty. It remains locked until the existing lock end' + (state.dates ? ' (' + escapeHtml(state.dates.lockEnds.slice(0, 10)) + ')' : '') + '.</span></label>'
        + '<button type="submit">Prepare exact CRED approval</button>'
        + '<small>Spender: ' + escapeHtml(PANTHEON_STAKING_VAULT) + '</small></form>';
    return '<p>Active Pantheon position: <strong>' + escapeHtml(formatWalletUnits(state.stakeAmountBaseUnits, 18)) + ' CRED</strong></p>'
      + (state.dates ? '<dl class="console-looper-wallet-truth"><div><dt>Rewards start</dt><dd>' + escapeHtml(state.dates.rewardsStart.slice(0, 10)) + '</dd></div><div><dt>First claim</dt><dd>' + escapeHtml(state.dates.firstClaim.slice(0, 10)) + '</dd></div><div><dt>Lock ends</dt><dd>' + escapeHtml(state.dates.lockEnds.slice(0, 10)) + '</dd></div></dl>' : '')
      + topUpAction;
  }
  return '<p>Check the live Pantheon registry and onchain CRED pool before preparing a transaction.</p><button type="button" data-action="load-pantheon-cred">Check staking</button>';
}

function normalizeWalletAddress(value) {
  return String(value ?? '').trim().toLowerCase();
}

function formatWalletUnits(value, decimals) {
  const text = String(value ?? '0');
  const places = Number(decimals);
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(places) || places < 0 || places > 255) return '0';
  const padded = text.padStart(places + 1, '0');
  const whole = places ? padded.slice(0, -places) : padded;
  const fraction = places ? padded.slice(-places).replace(/0+$/, '').slice(0, 6) : '';
  return fraction ? `${whole}.${fraction}` : whole;
}

function formatWalletReason(reason) {
  const labels = {
    legacy_implementation: 'This wallet configuration is read-only.',
    config_drift: 'Wallet writes are disabled because frozen collection or direct account evidence drifted.',
    release_unset: 'Policy release evidence is not configured. This wallet is read-only.',
    implementation_mismatch: 'The selected implementation does not match the reviewed release.',
    proxy_mismatch: 'The selected account is not the canonical reviewed proxy.',
    registry_mismatch: 'The module registry does not match the reviewed release.',
    malformed_policy: 'Permission evidence is incomplete or contradictory. This wallet is read-only.',
    module_blocked: 'The configured permission module is not currently approved.',
    ownership_mismatch: 'The reviewed account authority does not match the current Looper owner.',
    binding_mismatch: 'The reviewed account is not bound to this Base Looper token.',
    permission_hook_paused: 'Permission hooks are paused. Owner recovery remains available.',
    policy_drift: 'Policy evidence changed. Preview the recovery again.',
    wrong_chain: 'Switch your wallet network to Base and try again.',
    unsupported_wallet: 'This smart-wallet implementation is not yet verified for Looper wallet writes.',
    owner_changed: 'Ownership changed. Reconnect as the current Looper owner.',
    wrong_runtime: 'The deployed account runtime does not match the reviewed release.',
    locks_unavailable: 'This browser cannot safely serialize wallet writes across tabs.',
    receipt_attribution_failed: 'The transaction outcome could not be attributed safely.',
  };
  return labels[reason] ?? 'Wallet writes are disabled because verification is incomplete.';
}

function renderSuitePanel(snapshot = {}) {
  const checks = Array.isArray(snapshot.suiteChecks) ? snapshot.suiteChecks : [];
  const facts = Array.isArray(snapshot.multipassFacts) ? snapshot.multipassFacts : [];
  const proofSummary = checks.length ? checks.map((check) => check.value).filter(Boolean).join(' · ') : 'No verified proof yet';
  return `
    <details class="console-multipass-drawer console-suite-panel console-trust-rail console-proof-rail" aria-label="Verified runtime proof">
      <summary>
        <strong class="console-proof-rail-title">Verified runtime proof</strong>
        <span class="console-proof-rail-summary">${escapeHtml(proofSummary)}</span>
        <span class="console-proof-rail-chevron" aria-hidden="true"></span>
      </summary>
      <div class="console-proof-rail-body">
        ${facts.length ? `<dl class="console-multipass-facts">${facts.map(renderMultipassFact).join('')}</dl>` : ''}
        <div class="console-check-stack">
          ${checks.length ? checks.map(renderSuiteCheck).join('') : `
            <article class="open console-proof-empty">
              <span>Evidence</span>
              <strong>No verified runtime proof yet</strong>
              <small>Proof appears only after the Console receives exact provider evidence.</small>
            </article>
          `}
        </div>
      </div>
    </details>
  `;
}

function renderMultipassFact(fact = {}) {
  return `<div><dt>${escapeHtml(fact.label ?? '')}</dt><dd>${escapeHtml(fact.value ?? '')}</dd></div>`;
}

function renderSuiteCheck(check = {}) {
  return `
    <article class="${escapeAttribute(check.className ?? 'open')}">
      <span>${escapeHtml(check.label ?? 'Check')}</span>
      <strong>${escapeHtml(check.value ?? '')}</strong>
      <small>${escapeHtml(check.body ?? '')}</small>
    </article>
  `;
}

function renderMiniStat(card = {}) {
  return `
    <article class="console-mini-stat console-identity-fact">
      <span>${escapeHtml(card.label ?? '')}</span>
      <strong>${escapeHtml(card.value ?? '')}</strong>
    </article>
  `;
}

function renderIdentityDossierEntry(entry = {}) {
  return `
    <article class="console-identity-dossier-entry console-identity-fact">
      <span>${escapeHtml(entry.label ?? '')}</span>
      <strong>${escapeHtml(entry.value ?? '')}</strong>
      <p>${escapeHtml(entry.body ?? '')}</p>
    </article>
  `;
}

function renderIdentityParticipant(participant = {}) {
  const label = String(participant.displayName ?? participant.agentName ?? participant.participantId ?? 'Agent').trim() || 'Agent';
  return `
    <span class="console-identity-member">
      <strong>${escapeHtml(initialsForLabel(label))}</strong>
      <span>${escapeHtml(label)}</span>
    </span>
  `;
}

function renderStatusItem(item = {}) {
  return `<div><dt>${escapeHtml(item.label ?? '')}</dt><dd>${escapeHtml(item.value ?? '')}</dd></div>`;
}

function renderAgentOptions(session = {}) {
  const options = Array.isArray(session.options) ? session.options : [];
  if (!options.length) {
    return `<option value="">${escapeHtml(session.rosterStatus === 'loading' ? 'Loading owned agents...' : 'No owned agents')}</option>`;
  }
  const prompt = session.activeAgentId
    ? ''
    : '<option value="" selected>Pick your agent</option>';
  return prompt + options.map((option) => `
    <option value="${escapeAttribute(option.value ?? '')}" ${option.value === session.activeAgentId ? 'selected' : ''}>${escapeHtml(option.label ?? option.value ?? '')}</option>
  `).join('');
}

function renderAgentRoster(snapshot = {}) {
  const agents = Array.isArray(snapshot.rosterPreviewAgents) ? snapshot.rosterPreviewAgents : [];
  if (agents.length) return agents.map(renderAgentCard).join('');

  const status = snapshot.agentRoster?.status ?? 'idle';
  let title = 'No agents loaded';
  let body = 'Owned Loopers appear here after wallet sign-in.';
  if (status === 'loading') {
    title = 'Loading owned agents';
    body = 'Checking live Looper ownership for this wallet.';
  } else if (status === 'loaded') {
    title = 'No owned agents found';
    body = 'This wallet does not currently own a Looper.';
  } else if (status === 'error') {
    title = 'Agent load failed';
    body = 'The live ownership lookup failed, so the Console is refusing to invent a roster.';
  }

  return `
    <article class="console-agent-card console-agent-card-empty">
      <div>
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(body)}</span>
      </div>
    </article>
  `;
}

function renderAgentCard(agent = {}) {
  const openLink = agent.href ? `<a href="${escapeAttribute(agent.href)}">View profile</a>` : '<span>Profile pending</span>';
  const selected = Boolean(agent.selected);
  const subtitle = agent.canonicalName && agent.canonicalName !== agent.name
    ? agent.canonicalName
    : (agent.role ?? 'Agent profile');
  return `
    <article class="console-agent-card ${selected ? 'selected' : ''}">
      <div class="console-agent-card-head">
        <span class="console-agent-card-avatar" aria-hidden="true">${escapeHtml(initialsForLabel(agent.name ?? 'Onchain agent'))}</span>
        <div class="console-agent-card-copy">
          <strong>${escapeHtml(agent.name ?? 'Onchain agent')}</strong>
          <span>${escapeHtml(subtitle)}</span>
        </div>
        <div class="console-agent-card-flags">
          <span>${escapeHtml(selected ? 'Live' : agent.state ?? 'Ready')}</span>
        </div>
      </div>
      <div class="console-agent-card-meta">
        <span>#${escapeHtml(agent.tokenId ?? 'Unknown')}</span>
        <span>${escapeHtml(agent.cred ?? 'Cred pending')}</span>
      </div>
      <div class="console-agent-card-actions">
        <button type="button" data-action="activate-console-room" data-token-id="${escapeAttribute(agent.tokenId ?? '')}" ${selected || agent.activationDisabled ? 'disabled' : ''}>${selected ? 'Room live' : 'Open room'}</button>
        ${openLink}
      </div>
    </article>
  `;
}

function createMemoryEntries({ savedMemory = [], recalledMemory = [] } = {}) {
  const entries = [...recalledMemory, ...savedMemory]
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => ({
      text: String(entry.text ?? '').trim(),
      tags: Array.isArray(entry.tags) ? entry.tags.filter(Boolean) : [],
      savedAt: String(entry.savedAt ?? ''),
    }))
    .filter((entry) => entry.text);
  const seen = new Set();
  return entries.filter((entry) => {
    const key = `${entry.text}::${entry.tags.join(',')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);
}

function renderMemoryEntry(entry = {}) {
  return `
    <article class="console-memory-entry">
      <strong>${escapeHtml(entry.text ?? '')}</strong>
      <p>${escapeHtml(entry.tags?.length ? entry.tags.join(' · ') : 'Sibyl memory')}</p>
    </article>
  `;
}

function renderConsoleDrawer({
  label = '',
  title = '',
  stat = '',
  hint = '',
  body = '',
  open = false,
  className = '',
  action = '',
  drawer = '',
} = {}) {
  const actionAttributes = action
    ? ` data-action="${escapeAttribute(action)}"${drawer ? ` data-console-roster-drawer="${escapeAttribute(drawer)}"` : ''}`
    : '';
  return `
    <details class="console-sidebar-drawer ${escapeAttribute(className)}"${actionAttributes} ${open ? 'open' : ''}>
      <summary>
        <div class="console-sidebar-drawer-copy">
          ${label ? `<span class="console-sidebar-drawer-label">${escapeHtml(label)}</span>` : ''}
          <strong>${escapeHtml(title)}</strong>
          ${hint ? `<small>${escapeHtml(hint)}</small>` : ''}
        </div>
        <div class="console-sidebar-drawer-affordance">
          ${stat ? `<span class="console-sidebar-drawer-stat">${escapeHtml(stat)}</span>` : ''}
          <span class="console-sidebar-drawer-chevron" aria-hidden="true"></span>
        </div>
      </summary>
      <div class="console-sidebar-drawer-body">
        ${body}
      </div>
    </details>
  `;
}

function createProofChecks({ activeAgent = null, thread = {} } = {}) {
  const checks = [];
  const hasBankrAgentResponse = Array.isArray(thread.messages) && thread.messages.some((message) => (
    message?.role === 'agent' && message?.inferenceProvider === 'bankr_llm_gateway'
  ));
  if (hasBankrAgentResponse) {
    checks.push({ label: 'Inference', value: 'Bankr gateway', body: 'Response identified bankr_llm_gateway.', className: 'ready' });
  }
  if (thread.rawTransport === 'xmtp_group' && thread.conversationId) {
    checks.push({ label: 'Transport', value: 'XMTP live', body: 'Server returned a non-empty XMTP conversation.', className: 'ready' });
  }
  if (thread.rawMemoryProvider === 'sibyl_memory' && thread.savedMemoryPresent) {
    const savedCount = Array.isArray(thread.savedMemory) ? thread.savedMemory.length : 0;
    checks.push({ label: 'Memory write', value: `Sibyl saved ${savedCount}`, body: 'Saved count returned by sibyl_memory.', className: 'ready' });
  }
  if (thread.rawMemoryProvider === 'sibyl_memory' && thread.recalledMemoryPresent) {
    const recalledCount = Array.isArray(thread.recalledMemory) ? thread.recalledMemory.length : 0;
    checks.push({ label: 'Memory recall', value: `Sibyl recalled ${recalledCount}`, body: 'Recalled count returned by sibyl_memory.', className: 'ready' });
  }
  const erc8004AgentId = getPositiveErc8004AgentId(activeAgent);
  if (erc8004AgentId) {
    checks.push({ label: 'Identity', value: `ERC-8004 #${erc8004AgentId}`, body: 'Positive numeric registry agent ID.', className: 'ready' });
  }
  const proposals = Array.isArray(thread.proposals) ? thread.proposals : [];
  const proposalsAreReviewOnly = proposals.every((proposal) => (
    proposal?.status === 'review_only'
    && proposal?.executable === false
    && proposal?.executionEnabled !== true
  ));
  if (thread.executionMode === 'review_only' && proposalsAreReviewOnly) {
    checks.push({ label: 'Execution', value: 'Review-only', body: 'Runtime mode and every returned proposal are non-executable.', className: 'ready' });
  }
  return checks;
}

function getPositiveErc8004AgentId(agent = {}) {
  const value = Number(agent?.erc8004AgentId);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function createIdentitySummary({ activeAgent = null, activeCred = 'Cred pending', roomParticipantCount = 0, proposalCount = 0 } = {}) {
  if (!activeAgent?.tokenId) return 'Load a real agent and open a direct review-only thread.';
  if (activeAgent.logline) return activeAgent.logline;
  const roomLabel = roomParticipantCount > 1 ? `${roomParticipantCount}-participant room` : 'direct thread';
  const reviewLabel = proposalCount ? `${proposalCount} queued for review` : 'review-only';
  return `${activeAgent.role ?? 'Onchain agent'} in a ${roomLabel}. ${activeCred}. ${reviewLabel}.`;
}

function createIdentityDossier({
  activeAgent = null,
  walletConnected = false,
  walletLabel = 'Wallet required',
  roomName = 'Selected room',
  roomParticipantCount = 0,
  memoryCount = 0,
  proposalCount = 0,
  verifiedLabel = 'Verification pending',
} = {}) {
  const identityValue = activeAgent?.canonicalName ?? (activeAgent?.tokenId ? `Agent #${activeAgent.tokenId}` : 'No agent loaded');
  const identityBody = activeAgent?.identityBody
    ?? (activeAgent?.helixaId
      ? `${verifiedLabel}. AgentDNA ${activeAgent.helixaId}.`
      : (activeAgent?.name ? verifiedLabel : 'Sign in to load a wallet-owned Looper identity.'));
  const temperamentValue = stripReviewOnlyTemperCopy(activeAgent?.temperament ?? activeAgent?.role ?? 'Operator');
  const temperamentBody = stripReviewOnlyTemperCopy(activeAgent?.temperamentBody
    ?? (activeAgent?.tokenId
      ? 'Brief-first, memory-backed, and constrained to approval before any outside action.'
      : 'The Console should feel like a character relationship, not a dashboard.'));
  const roomBody = activeAgent?.mandateBody
    ?? (roomParticipantCount > 1
      ? `${roomParticipantCount} room participants are sharing this thread.`
      : 'This thread stays tied to one selected wallet-owned agent.');
  const operatorBody = activeAgent?.operatorBody
    ?? (proposalCount
      ? `${proposalCount} proposal${proposalCount === 1 ? '' : 's'} waiting for operator review.`
      : memoryCount
        ? `${memoryCount} recalled memory item${memoryCount === 1 ? '' : 's'} are shaping the conversation.`
        : 'No recalled memory yet. The first mission will establish the thread.');
  return [
    {
      label: 'Identity',
      value: identityValue,
      body: identityBody,
    },
    {
      label: 'Temper',
      value: temperamentValue,
      body: temperamentBody,
    },
    {
      label: 'Mandate',
      value: roomName,
      body: roomBody,
    },
    {
      label: 'Operator',
      value: activeAgent?.operatorLabel ?? (walletConnected ? walletLabel : 'Waiting to load'),
      body: operatorBody,
    },
  ];
}

function createThreadContextItems({
  activeAgent = null,
  activeCred = 'Cred pending',
  memoryCount = 0,
  proposalCount = 0,
  participantCount = 0,
  thread = {},
  verifiedLabel = 'Verification pending',
} = {}) {
  if (Array.isArray(activeAgent?.threadContextItems) && activeAgent.threadContextItems.length) {
    return activeAgent.threadContextItems;
  }
  return [
    {
      label: 'Watch',
      value: activeAgent?.watchLabel ?? (activeAgent?.tokenId ? activeAgent.name ?? 'Selected agent' : 'No agent selected'),
      body: activeAgent?.watchBody ?? verifiedLabel,
      className: activeAgent?.tokenId ? 'ready' : 'open',
    },
    {
      label: 'Trust',
      value: activeAgent?.tokenId ? activeCred : 'Awaiting trust context',
      body: Number.isFinite(activeAgent?.proofCount) ? `${activeAgent.proofCount} proof${activeAgent.proofCount === 1 ? '' : 's'} in view.` : 'No proofs loaded.',
      className: activeAgent?.tokenId ? 'ready' : 'open',
    },
    {
      label: 'Memory',
      value: memoryCount ? `${memoryCount} recalled` : formatMemoryProviderLabel(thread.memoryProvider),
      body: memoryCount ? 'Recent operator memory is already shaping the room.' : 'Sibyl is ready to pin mission and preference memory.',
      className: 'ready',
    },
    {
      label: 'Mode',
      value: proposalCount ? `${proposalCount} queued proposal${proposalCount === 1 ? '' : 's'}` : 'Review-only',
      body: participantCount > 1 ? `${participantCount} room participants can collaborate, but nothing executes without approval.` : 'Single-participant room with explicit approval gates.',
      className: 'ready',
    },
  ];
}

function createIdentityBadges({ activeAgent = null, verifiedLabel = 'Verification pending', transport = 'Live chat', proposalCount = 0 } = {}) {
  if (Array.isArray(activeAgent?.identityBadges) && activeAgent.identityBadges.length) {
    return activeAgent.identityBadges.filter(Boolean).slice(0, 4);
  }
  return [
    activeAgent?.verified ? verifiedLabel : null,
    formatTransportLabel(transport),
    proposalCount ? `${proposalCount} queued` : 'Review-only',
  ].filter(Boolean);
}

function createIdentityStats({ activeAgent = null, activeCred = 'Cred pending', proposalCount = 0 } = {}) {
  return [
    { label: 'Token', value: activeAgent?.tokenId ? `#${activeAgent.tokenId}` : 'Not loaded' },
    { label: 'Cred', value: activeCred },
    { label: activeAgent?.profileLane ? 'Lane' : 'Mode', value: activeAgent?.profileLane ?? (proposalCount ? `${proposalCount} queued` : 'Review-only') },
  ];
}

function createIdentityData({ activeAgent = null, activeCred = 'CRED pending' } = {}) {
  const erc8004AgentId = getPositiveErc8004AgentId(activeAgent);
  const cred = activeAgent?.cred;
  const available = isAvailableCred(cred);
  return [
    { label: 'Collection', value: 'Loopers' },
    { label: 'Token', value: activeAgent?.tokenId ? `#${activeAgent.tokenId}` : 'Not loaded' },
    { label: 'Chain', value: 'Base (8453)' },
    { label: 'CRED', value: available ? `${cred.score} · ${cred.tier}` : String(activeCred ?? 'CRED pending').replace(/^cred\s*/iu, '').trim() || 'Pending' },
    available ? { label: 'Evidence', value: `${cred.coverage.label} · ${cred.coverage.score}%` } : null,
    available ? { label: 'Freshness', value: formatCredFreshness(cred) } : null,
    { label: 'ERC-8004', value: erc8004AgentId ? `#${erc8004AgentId}` : 'Not registered' },
  ].filter(Boolean);
}

function createSelectionHint({ walletConnected = false, agentRosterStatus = 'idle', activeAgentCount = 0 } = {}) {
  if (!walletConnected) return 'Sign in to load owned Loopers.';
  if (agentRosterStatus === 'loading') return 'Loading wallet-owned agents.';
  if (agentRosterStatus === 'error') return 'Wallet-owned agent lookup failed.';
  if (activeAgentCount === 0) return 'This wallet does not own a Looper yet.';
  return 'Pick an agent to open its room and start the thread.';
}

function createNextAction({ walletConnected = false, activeAgentCount = 0, proposalCount = 0, hasMessages = false, roomParticipantCount = 0 } = {}) {
  if (!walletConnected) return { title: 'Wallet required', body: 'Sign in before the room can load an agent.' };
  if (activeAgentCount === 0) return { title: 'No owned Loopers', body: 'This wallet needs an owned Looper before chat can start.' };
  if (proposalCount > 0) return { title: 'Review queue', body: `${proposalCount} proposal${proposalCount === 1 ? '' : 's'} waiting for approval.` };
  if (hasMessages) return { title: 'Keep the room live', body: 'The thread is active. Keep the operator conversation moving.' };
  return { title: 'Open a room', body: 'Pick an owned agent and send the first mission.' };
}

function selectActiveAgent(agents = [], selectedAgentId = null) {
  if (!Array.isArray(agents) || agents.length === 0) return null;
  const selected = selectedAgentId
    ? agents.find((agent) => String(agent?.tokenId ?? '') === String(selectedAgentId))
    : null;
  return selected ?? null;
}

function buildAgentOptionLabel(agent = {}) {
  return String(agent.name ?? agent.tokenId ?? 'Agent').trim();
}

export function normalizeConsoleCred(agent = {}) {
  const cred = agent?.cred;
  if (isAvailableCred(cred)) {
    return {
      cred,
      credScore: cred.score,
      credLabel: `CRED ${cred.score} · ${cred.tier}${cred.status === 'stale' ? ' · STALE' : ''}`,
    };
  }
  if (cred?.status === 'unavailable') {
    return { cred, credScore: null, credLabel: 'CRED unavailable' };
  }
  if (cred?.status === 'pending') {
    return { cred, credScore: null, credLabel: 'CRED pending' };
  }
  return { cred: null, credScore: null, credLabel: 'CRED pending' };
}

function normalizeConsoleAgent(agent = {}) {
  return { ...agent, ...normalizeConsoleCred(agent) };
}

function createMultipassFacts({ activeAgent = null, ownerDisplayName = null } = {}) {
  if (!activeAgent?.tokenId) return ownerDisplayName ? [{ label: 'Owner', value: ownerDisplayName }] : [];
  const facts = [
    { label: 'Agent name', value: activeAgent.name },
    { label: 'Owner', value: ownerDisplayName ?? activeAgent.owner ?? activeAgent.wallet ?? activeAgent.ownerAddress ?? activeAgent.walletAddress },
    { label: 'Token', value: `#${activeAgent.tokenId}` },
    getPositiveErc8004AgentId(activeAgent) ? { label: 'ERC-8004', value: `#${getPositiveErc8004AgentId(activeAgent)}` } : null,
    (Number.isFinite(activeAgent.credScore) || !isPendingCredLabel(activeAgent.credLabel)) && activeAgent.credLabel
      ? { label: 'Cred', value: activeAgent.credLabel }
      : null,
    activeAgent.helixaId ? { label: 'AgentDNA', value: activeAgent.helixaId } : null,
  ];
  return facts.filter((fact) => fact?.value);
}

function isPendingCredLabel(value) {
  return /^(?:cred\s+)?pending$/iu.test(String(value ?? '').trim());
}

function isAvailableCred(cred) {
  return Boolean(cred)
    && ['available', 'stale'].includes(cred.status)
    && Number.isInteger(cred.score)
    && cred.score >= 0
    && cred.score <= 100
    && ['JUNK', 'MARGINAL', 'QUALIFIED', 'PRIME', 'PREFERRED'].includes(cred.tier)
    && Number.isInteger(cred.coverage?.score)
    && cred.coverage.score >= 0
    && cred.coverage.score <= 100
    && ['THIN', 'PARTIAL', 'GOOD', 'STRONG'].includes(cred.coverage?.label)
    && typeof cred.freshness?.stale === 'boolean';
}

function formatCredFreshness(cred) {
  if (!isAvailableCred(cred)) return 'Unavailable';
  if (!cred.freshness.stale) return cred.freshness.cached ? 'Fresh · cached' : 'Fresh';
  const ageSeconds = Number.isInteger(cred.freshness.ageSeconds) ? cred.freshness.ageSeconds : 0;
  const age = ageSeconds >= 3600
    ? `${Math.floor(ageSeconds / 3600)}h old`
    : ageSeconds >= 60 ? `${Math.floor(ageSeconds / 60)}m old` : `${ageSeconds}s old`;
  return `Stale · ${age}`;
}

function renderCompactCred(agent = {}) {
  const cred = agent.cred;
  if (!isAvailableCred(cred)) {
    return `<div class="console-cred-summary" aria-label="Authoritative CRED" data-cred-status="${escapeAttribute(cred?.status ?? 'pending')}"><strong>${escapeHtml(agent.credLabel ?? 'CRED pending')}</strong></div>`;
  }
  return `
    <div class="console-cred-summary" aria-label="Authoritative CRED" data-cred-status="${escapeAttribute(cred.status)}">
      <strong>${escapeHtml(agent.credLabel)}</strong>
      <span>Evidence ${escapeHtml(cred.coverage.label)} · ${escapeHtml(cred.coverage.score)}%</span>
      <small>${escapeHtml(formatCredFreshness(cred))}</small>
    </div>
  `;
}

function decorateConsoleMessages(messages, { activeAgent = null, ownerProfile = {} } = {}) {
  return (Array.isArray(messages) ? messages : []).map((message) => {
    const human = message?.role === 'human';
    return {
      ...message,
      senderLabel: human
        ? (ownerProfile.displayName || 'You')
        : (activeAgent?.name || message?.senderLabel || 'Selected agent'),
      avatarUrl: safeConsoleAvatarUrl(human ? ownerProfile.avatarUrl : activeAgent?.image),
    };
  });
}

function stripReviewOnlyTemperCopy(value) {
  const cleaned = String(value ?? '')
    .replace(/\breview-only\b[,:;]?\s*/giu, '')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/,\s*,/g, ',')
    .trim()
    .replace(/^[,;:\s]+|[,;:\s]+$/g, '');
  return cleaned || 'Operator';
}

function formatTransportLabel(value, { live = true } = {}) {
  const text = String(value ?? '').trim().toLowerCase();
  if (!live && (text === 'xmtp_group' || text === 'xmtp_node_sdk')) return 'XMTP setup';
  if (!text || text === 'live_chat') return 'Live chat';
  if (text === 'xmtp_local') return 'Local test adapter';
  if (text === 'xmtp_group') return 'XMTP live';
  if (text === 'unavailable') return 'XMTP unavailable';
  if (text === 'xmtp-ready' || text === 'xmtp_ready') return 'XMTP configured';
  return text.replaceAll('_', ' ');
}

function formatMemoryProviderLabel(value) {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text) return 'Memory standby';
  if (text === 'sibyl_memory') return 'Sibyl memory';
  if (text === 'sibyl-ready' || text === 'sibyl_ready') return 'Sibyl memory';
  if (text === 'local_sibyl_adapter') return 'Sibyl memory';
  return text.replaceAll('_', ' ');
}

function formatInferenceProviderLabel(value) {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text) return 'Runtime standby';
  if (text === 'bankr_llm_gateway') return 'Bankr gateway';
  if (text === 'bankr-ready' || text === 'bankr_ready') return 'Bankr-ready';
  if (text === 'local_bankr_adapter') return 'Bankr-ready';
  return text.replaceAll('_', ' ');
}

function shortenAddress(address) {
  const value = String(address ?? '').trim();
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function createRoomParticipants({ agents = [], activeAgent = null, participantIds = [], threadParticipants = [] } = {}) {
  if (Array.isArray(threadParticipants) && threadParticipants.length) return normalizeThreadParticipants(threadParticipants);
  const byTokenId = new Map((Array.isArray(agents) ? agents : []).map((agent) => [String(agent?.tokenId ?? '').trim(), agent]));
  const ids = Array.isArray(participantIds) ? participantIds : [];
  const participants = ids
    .map((tokenId) => byTokenId.get(String(tokenId ?? '').trim()))
    .filter(Boolean);
  if (participants.length) return participants;
  return activeAgent ? [activeAgent] : [];
}

function createAgentRenameControl(activeAgent = null, mutation = {}) {
  if (!activeAgent?.tokenId) return null;
  const canonicalName = String(activeAgent.canonicalName ?? activeAgent.name ?? '').trim() || `Agent #${activeAgent.tokenId}`;
  const currentName = String(activeAgent.name ?? canonicalName).trim() || canonicalName;
  const pending = mutation?.status === 'pending';
  return {
    enabled: !pending,
    value: currentName,
    placeholder: canonicalName,
    resettable: !pending && currentName !== canonicalName,
    hint: pending
      ? 'Updating agent name…'
      : currentName !== canonicalName
      ? `Live identity: ${canonicalName}`
      : 'Agent alias for this Console session.',
  };
}

function deriveRoomName(participants = []) {
  const names = (Array.isArray(participants) ? participants : [])
    .map((participant) => String(participant?.displayName ?? participant?.name ?? '').trim())
    .filter(Boolean);
  if (!names.length) return 'Selected room';
  if (names.length === 1) return `${names[0]} room`;
  return `${names[0]} + ${names.length - 1} room`;
}

function normalizeThreadParticipants(participants = []) {
  return (Array.isArray(participants) ? participants : [])
    .filter(Boolean)
    .map((participant) => ({
      kind: participant.kind ?? null,
      wallet: participant.wallet ?? null,
      participantId: String(participant.participantId ?? participant.tokenId ?? participant.name ?? 'agent').trim(),
      agentId: String(participant.agentId ?? participant.tokenId ?? participant.name ?? 'agent').trim(),
      tokenId: String(participant.tokenId ?? participant.participantId ?? participant.name ?? 'agent').trim(),
      displayName: participant.displayName ?? participant.name ?? 'Selected agent',
      role: participant.role ?? participant.framework ?? 'Onchain agent',
      avatarUrl: participant.avatarUrl ?? participant.image ?? null,
    }));
}

function decorateConsoleParticipants(participants = [], { ownerDisplayName = null, ownerAvatarUrl = null, walletAddress = null } = {}) {
  return (Array.isArray(participants) ? participants : []).map((participant) => {
    const operator = participant?.kind === 'operator'
      || String(participant?.participantId ?? '').startsWith('wallet:')
      || (participant?.wallet && normalizeAddress(participant.wallet) === normalizeAddress(walletAddress));
    if (!operator) return participant;
    return {
      ...participant,
      displayName: ownerDisplayName || String(walletAddress ?? participant.wallet ?? '').trim() || 'You',
      avatarUrl: safeConsoleAvatarUrl(ownerAvatarUrl),
    };
  });
}

function normalizeAddress(value) {
  return String(value ?? '').trim().toLowerCase();
}

function initialsForLabel(value) {
  const normalized = String(value ?? '').trim();
  if (/^0x[0-9a-f]+$/iu.test(normalized)) return '0X';
  const parts = String(value ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (!parts.length) return 'AG';
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || 'AG';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('`', '&#96;');
}
