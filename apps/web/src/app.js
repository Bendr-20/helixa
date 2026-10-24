import { parseUnits } from 'viem';

import { getActivationState } from './activation.js';
import { buildSavedRoutes, getApiBaseFromLocation, getSavedSlugFromLocation, getWritableApiBaseFromLocation, isCanonicalHelixaFallbackError, loadCanonicalHelixaMultipass, loadJson, loadMultipassDemo, loadSavedMultipassDemo, loadStaticMultipassDemo, shouldUseStaticDemo } from './api.js';
import { HelixaResolverError, loadLiveHelixaMultipass } from './live-helixa-resolver.js';
import { fetchOwnedLooperAgents } from './loopers-console-agents.js';
import { loadDailyActivatedLooperTokenIds } from './looper-activated-roster.js';
import { bindLooperMarketplace, createInitialLooperMarketplaceState, getLooperMarketplaceRoute, loadLooperMarketplaceListings, loadLooperMarketplaceSnapshot, normalizeLooperMarketplaceSort, renderLooperMarketplace } from './looper-marketplace.js';
import { loadLooperWalletValues } from './looper-wallet-values.js';
import { createClaimNonce, createMultipassFragment, importMultipassTool, logoutMultipassSession, previewGroupMultipass, refreshMultipassTool, revokeMultipassFragment, saveActivatedMultipass, saveGroupMultipass, submitManualReviewClaim, updateMultipassFragment, updateMultipassProfile, verifyClaimSignature } from './saved-multipass-api.js';
import { bindFragmentManager, compactFragmentInput, compactFragmentPatch, mergeFragmentMutationState, renderFragmentManagerPanel } from './fragment-manager.js';
import { bindMarketplaceConnectionManager, compactMarketplaceConnectionInput, compactMarketplaceConnectionPatch, mergeMarketplaceConnectionMutationState, renderMarketplaceConnectionManagerPanel } from './marketplace-connection-manager.js';
import { getMarketplacePresenceEntries } from './marketplace-presence.js';
import { getCommunicationChannels, getCommunicationContactPolicy } from './communication-channels.js';
import {
  activateConsoleAgent as defaultActivateConsoleAgent,
  authenticateConsoleSession as defaultAuthenticateConsoleSession,
  loadConsoleCodexBundle as defaultLoadConsoleCodexBundle,
  requestConsoleSessionChallenge as defaultRequestConsoleSessionChallenge,
  sendConsoleAgentMessage as defaultSendConsoleAgentMessage,
  updateConsoleAgentName as defaultUpdateConsoleAgentName,
} from './console-agent-api.js';
import {
  ensureXmtpWalletRegistration as defaultEnsureXmtpWalletRegistration,
  isXmtpRegistrationRequiredError,
} from './xmtp-wallet-registration.js';
import { bindRouteManager, compactRouteInput, compactRoutePatch, getPublicRouteFragments, renderPublicRoutesManagerPanel, renderPublicRoutesPanel } from './route-manager.js';
import { createOwnerCommandCenterSnapshot, renderOwnerCommandCenterSnapshot } from './command-center.js';
import { createMultipassConsoleSnapshot, renderMultipassConsole } from './multipass-console.js';
import {
  loadReleasedLooperTokenIds,
  normalizeConsoleWalletKey,
  readLastLooperForWallet,
  resolveDefaultLooperTokenId,
  writeLastLooperForWallet,
} from './console-looper-selection.js';
import {
  CONFIGURED_TOKENS,
  REVIEWED_POLICY_ACCOUNT_IMPLEMENTATION,
  REVIEWED_POLICY_ACCOUNT_RUNTIME_BYTE_LENGTH,
  REVIEWED_POLICY_ACCOUNT_RUNTIME_SHA256,
  REVIEWED_POLICY_MODULE_REGISTRY,
  REVIEWED_POLICY_MODULE_REGISTRY_RUNTIME_SHA256,
  ZERO_ADDRESS,
} from './looper-agent-wallet.js';
import { createLooperAgentWalletController, createReadOnlyLooperWalletContext } from './looper-agent-wallet-controller.js';
import { createLooperWalletRpcClient } from './looper-agent-wallet-rpc.js';
import {
  CRED_ADDRESS,
  PANTHEON_STAKING_VAULT,
  createCredStakeDates,
  createCredStakeDatesFromMonthIndex,
  isCredTopUpAttributed,
  isCredTopUpEligible,
  validatePantheonCredRegistry,
} from './looper-cred-pantheon.js';
import { getConsoleMessageIdentity } from './console-agent-thread.js';
import { createImagePreview, prepareConsoleImage, preparedImageBlob } from './console-image-preparation.js';
import { resolveConsoleOwnerProfile } from './console-owner-profile.js';
import { createConsoleRestapNetworkApi } from './console-restap-network-api.js';
import { createMissionApi } from './missions/api.js';
import { createSwarmDraftRetryState } from './missions/swarm-invitation-create-key.js';
import { bindConsoleCredit, createConsoleCreditApi, createInitialConsoleCreditState } from './console-credit.js';
import { bindMissionBoard } from './missions/mission-board.js';
import { bindMissionEditor } from './missions/mission-editor.js';
import { SWARM_LAUNCH_DEFAULT_ECONOMICS, bindSwarmLaunchpad, normalizeSwarmLaunchRequestForm } from './missions/swarm-launchpad.js';
import { beginConsoleRestapNetworkLoad, clearConsoleRestapNetworkSelection, createInitialConsoleRestapNetworkState, failConsoleRestapNetworkLoad, getConsoleRestapNetworkSendFingerprint, normalizeConsoleRestapNetworkSendDraft, normalizeConsoleRestapNetworkPolicyDraft, resolveConsoleRestapNetworkLoad } from './console-restap-network.js';
import { renderRuntimeSubmission } from './runtime-submission.js';
import { SWARM_ADMIN_ACTIVATION, bindSwarmAdmin, createInitialSwarmAdminState, readSwarmActivationState, renderSwarmAdmin, submitSwarmActivationApproval } from './swarm-admin.js';
import { bindToolManager, compactBankrToolImportInput, getPublicTools, mergeToolImportState, mergeToolRefreshState, renderPublicToolsPanel, renderToolRegistryManagerPanel } from './tool-manager.js';
import { createInjectedWalletClient, createLegacyWalletClient, getWalletErrorMessage, shortenAddress } from './wallet-client.js';
import { getAbsoluteShareUrl, getSafeMultipassSharePath, isSafeMultipassSharePath, renderSavePanel } from './save-panel.js';
import { GENERATED_SHARE_CARDS } from './generated-share-cards.js';
import { getAgentShareCard, getAgentSharePath } from './share-cards.js';
import { createGroupActivationPayload, normalizeGroupMemberInput, renderGroupActivationError, renderGroupActivationPanel, renderGroupActivationPreview, renderGroupActivationSuccess } from './group-activation.js';
import { getLooperAllowlistSourceFromLocation, isLooperAllowlistEnsName, normalizeLooperAllowlistAddress, registerLooperAllowlistAddress, resolveEnsAddressOnBase, resolveLooperAllowlistAddressInput } from './looper-allowlist.js';
import { formatEthFromWei, formatMintTimestamp, formatSaleState, getLooperMintConfigFromLocation, getMintPhasePrice, loadLooperMintContractState, mintLoopers, normalizeMintQuantity } from './looper-mint.js';
import { createAgentCarousel, createClaritySections, createFragmentTrustMap, createProofCards, createStoryCards, DEMO_SUBJECT, HERO_COPY, V01_COPY } from './content.js';

const STATIC_SWARM_PROFILE_PATH = '/multipass/swarm/helixa';
const PUBLIC_AGENTS_PATH = '/multipass/agents';
const MULTIPASS_CONSOLE_PATH = '/multipass/console';
const MULTIPASS_RUNTIME_PATH = '/multipass/runtime';
const SWARM_ADMIN_PATH = '/multipass/swarm/admin';
const CONSOLE_AGENT_NAME_OVERRIDES_STORAGE_KEY = `multipass.console.${'agentNameOverrides'}`;
const CONSOLE_HIDDEN_MESSAGES_STORAGE_KEY = 'multipass.console.hiddenMessages.v1';
const deferredConsoleRenders = new WeakMap();
const LOOPER_ALLOWLIST_PATHS = new Set(['/allowlist', '/allowlist/', '/multipass/allowlist', '/multipass/allowlist/']);
const LOOPER_MINT_PATHS = new Set(['/mint', '/mint/', '/multipass/mint', '/multipass/mint/']);

const SITE_MENU_LINKS = [
  { label: 'Multipass Home', href: '/multipass/' },
  { label: 'Multipass Console', href: '/multipass/console' },
  { label: 'The Loop', href: '/multipass/the-loop' },
  { label: 'RUNTIME Submission', href: '/multipass/runtime' },
  { label: 'Register Agent', href: 'https://helixa.xyz/' },
  { label: 'Cred Exchange', href: 'https://cred.exchange/' },
  { label: '$CRED Token', href: 'https://bankr.bot/agents/helixa' },
  { label: 'Docs / API', href: 'https://api.helixa.xyz/' },
];

export { getConsoleMessageIdentity };

export function createApp({ root, loadDemo, loadLiveDemo, saveMultipass = defaultSaveMultipass, claimApi = defaultClaimApi, walletClient, walletSigner, fetchImpl, prefetchProfiles, ensResolver = resolveEnsAddressOnBase, looperMintClient = defaultLooperMintClient, consoleOwnerProfileResolver = resolveConsoleOwnerProfile, consoleRestapNetworkApi, consoleCreditApi, restapIdempotencyKeyFactory = createConsoleRestapSendKey, restapPollDelay = (milliseconds) => new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds)), looperWalletController, pantheonCredReader, looperWalletReleaseConfig, releasedLooperLoader = loadReleasedLooperTokenIds, marketplaceListingsLoader = loadLooperMarketplaceListings, marketplaceActivationRosterLoader = loadDailyActivatedLooperTokenIds, marketplaceWalletValuesLoader = loadLooperWalletValues, marketplaceTimeoutMs, consolePreferenceStorage = globalThis.localStorage, prepareConsoleImageImpl = prepareConsoleImage, imagePreviewFactory = createImagePreview, missionApi } = {}) {
  if (!root) throw new Error('createApp requires a root element');

  const activeWalletClient = walletClient ?? (walletSigner ? createLegacyWalletClient(walletSigner) : createInjectedWalletClient());
  const activeRestapNetworkApi = consoleRestapNetworkApi ?? createConsoleRestapNetworkApi({ fetchImpl: fetchImpl ?? globalThis.fetch, apiBase: '' });
  const activeMissionApi = missionApi ?? createMissionApi({ fetchImpl: fetchImpl ?? globalThis.fetch, apiBase: '' });
  const swarmDraftRetryState = createSwarmDraftRetryState({ createKey: () => 'draft-' + (globalThis.crypto?.randomUUID?.() ?? String(Date.now())) });
  const activeConsoleCreditApi = consoleCreditApi ?? createConsoleCreditApi({ fetchImpl: fetchImpl ?? globalThis.fetch, apiBase: '' });
  const activeLooperWalletReleaseConfig = looperWalletReleaseConfig ?? {
    implementation: REVIEWED_POLICY_ACCOUNT_IMPLEMENTATION,
    runtimeByteLength: REVIEWED_POLICY_ACCOUNT_RUNTIME_BYTE_LENGTH,
    runtimeSha256: REVIEWED_POLICY_ACCOUNT_RUNTIME_SHA256,
    moduleRegistry: REVIEWED_POLICY_MODULE_REGISTRY,
    moduleRegistryRuntimeSha256: REVIEWED_POLICY_MODULE_REGISTRY_RUNTIME_SHA256,
  };
  const looperWalletRpc = looperWalletController ? null : createLooperWalletRpcClient({
    fetchImpl: fetchImpl ?? globalThis.fetch,
    releaseConfig: activeLooperWalletReleaseConfig,
  });
  const activeLooperWalletController = looperWalletController ?? createLooperAgentWalletController({
    releaseConfig: activeLooperWalletReleaseConfig,
    readSnapshot: looperWalletRpc.readSnapshot,
    readReceipt: looperWalletRpc.readReceipt,
    getWalletChainId: () => activeWalletClient.request({ method: 'eth_chainId' }),
    switchWalletChain: (chainId) => activeWalletClient.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId }],
    }),
    submitTransaction: async (transaction) => {
      if (typeof activeWalletClient.sendTransaction !== 'function') {
        throw new Error('Connected wallet does not expose the guarded Looper transaction action.');
      }
      return activeWalletClient.sendTransaction(transaction);
    },
  });
  const activePantheonCredReader = pantheonCredReader ?? looperWalletRpc?.readPantheonCredState ?? null;
  const activeLoadLiveDemo = loadLiveDemo ?? ((input) => defaultLoadLiveProfile(input, { fetchImpl }));
  const liveProfileCache = new Map();
  const liveProfileInFlight = new Map();
  let consoleReleasedLooperAbortController = null;
  let looperMarketplaceAbortController = null;
  let looperMarketplaceRequestId = 0;
  let consoleRestapNetworkAbortController = null;
  let consoleRestapNetworkMutationAbortController = null;
  let consoleCreditAbortController = null;
  let consoleMissionAbortController = null;
  let consoleInvitationInboxAbortController = null;
  const consoleCodexCache = new Map();
  let consoleCodexArtifactHash = null;
  let preparedConsoleChallenge = null;
  let consoleChallengeRequestId = 0;
  const shouldPrefetchProfiles = prefetchProfiles ?? !loadDemo;
  const consoleMockState = getInitialConsoleMockState();
  const consoleAgentNameOverrides = consoleMockState?.consoleAgentNameOverrides ?? loadConsoleAgentNameOverrides();
  let consoleImagePreview = null;
  let consoleImagePreparationId = 0;
  const clearConsoleImagePreview = () => {
    consoleImagePreparationId += 1;
    consoleImagePreview?.clear();
  };
  const clearConsoleSessionStateWithPreview = (currentState, options) => {
    consoleRestapNetworkAbortController?.abort();
    consoleRestapNetworkAbortController = null;
    consoleRestapNetworkMutationAbortController?.abort();
    consoleRestapNetworkMutationAbortController = null;
    consoleCreditAbortController?.abort();
    consoleCreditAbortController = null;
    consoleMissionAbortController?.abort();
    consoleMissionAbortController = null;
    consoleInvitationInboxAbortController?.abort();
    consoleInvitationInboxAbortController = null;
    clearConsoleImagePreview();
    consoleCodexCache.clear();
    consoleCodexArtifactHash = null;
    return clearConsoleSessionState(currentState, options);
  };

  let state = {
    pageKind: getInitialPageKind(),
    looperMarketplace: createInitialLooperMarketplaceState(typeof window === 'undefined' ? null : getLooperMarketplaceRoute(new URL(window.location.href))),
    expandedCard: null,
    selectedAgentCard: 0,
    resolverInput: '',
    resolverStatus: null,
    resolverError: null,
    resolverRequestId: 0,
    resolverInFlightInput: null,
    retryUntil: 0,
    retryMessage: null,
    lookupMatches: [],
    saveStatus: null,
    saveError: null,
    savedSharePath: null,
    savedProfile: null,
    claimStatus: null,
    claimError: null,
    claimCsrfToken: null,
    claimSessionStatus: null,
    routeStatus: null,
    routeError: null,
    routeActiveFragmentId: null,
    toolStatus: null,
    toolError: null,
    toolActiveFragmentId: null,
    marketplaceConnectionStatus: null,
    marketplaceConnectionError: null,
    marketplaceConnectionActiveFragmentId: null,
    groupActivation: createInitialGroupActivationState(),
    groupActivationExpanded: false,
    groupActivationRequestId: 0,
    looperAllowlist: createInitialLooperAllowlistState(),
    looperMint: createInitialLooperMintState(),
    consoleAgentNameOverrides,
    consoleWalletStatus: consoleMockState?.consoleWalletStatus ?? null,
    consoleWalletError: consoleMockState?.consoleWalletError ?? null,
    consoleCsrfToken: consoleMockState?.consoleCsrfToken ?? null,
    consoleAuthenticatedWallet: consoleMockState?.walletSnapshot?.address ?? null,
    consoleOwnerProfile: null,
    consoleSessionGeneration: 0,
    consoleOwnedAgentsRequestId: 0,
    consoleScrollRequest: 0,
    consoleActivationRequestId: 0,
    consoleCodexRequestId: 0,
    consoleThreadGeneration: 0,
    consoleAgentNameMutation: { status: 'idle', requestId: 0, tokenId: null },
    consoleOwnedAgents: consoleMockState?.consoleOwnedAgents ?? createInitialConsoleOwnedAgentsState(),
    consoleAgentGallery: consoleMockState?.consoleAgentGallery ?? { query: '', sort: 'token-asc', activationError: null },
    consoleMainRosterOpen: false,
    consoleSidebarRosterOpen: false,
    consoleSelectedAgentId: consoleMockState?.consoleSelectedAgentId ?? null,
    consoleWorkspaceView: consoleMockState
      ? (['chat', 'wallet', 'multipass', 'codex', 'network', 'credit', 'missions'].includes(consoleMockState.consoleWorkspaceView) ? consoleMockState.consoleWorkspaceView : 'chat')
      : null,
    consoleParticipantAgentIds: consoleMockState?.consoleParticipantAgentIds ?? [],
    consoleAgentThread: consoleMockState?.consoleAgentThread ?? createInitialConsoleAgentThreadState(),
    consoleCodex: createInitialConsoleCodexState(),
    consoleRestapNetwork: createInitialConsoleRestapNetworkState(),
    consoleCredit: consoleMockState?.consoleCredit ?? createInitialConsoleCreditState(),
    consoleMissions: consoleMockState?.consoleMissions ?? { status: 'idle', view: 'board', filter: null, missions: [], error: null },
    consoleLaunchpad: consoleMockState?.consoleLaunchpad ?? { status: 'idle', requestId: 0, draft: { members: [], app: {}, token: {} }, manifest: null, error: null },
    swarmAdmin: createInitialSwarmAdminState(),
    looperAgentWallet: consoleMockState?.looperAgentWallet ?? activeLooperWalletController.getSnapshot(),
    consoleMockMode: consoleMockState?.mode ?? null,
    walletSnapshot: consoleMockState?.walletSnapshot ?? activeWalletClient.getSnapshot(),
  };
  const loadInitialDemo = loadDemo ?? (() => defaultLoadDemo({ fetchImpl }));

  async function start() {
    activeWalletClient.subscribe?.(() => {
      const walletSnapshot = activeWalletClient.getSnapshot();
      if (preparedConsoleChallenge && (
        !walletSnapshot.connected
        || normalizeConsoleWalletKey(walletSnapshot.address) !== preparedConsoleChallenge.wallet
      )) {
        preparedConsoleChallenge = null;
        consoleChallengeRequestId += 1;
      }
      if (state.pageKind === 'console' && state.consoleMockMode) return;
      if (state.pageKind === 'console' && !state.consoleMockMode && consoleWalletBoundaryChanged(state, walletSnapshot)) {
        abortConsoleReleasedLooperDiscovery();
        state = clearConsoleSessionStateWithPreview(state, {
          walletSnapshot,
          status: walletSnapshot.connected && walletSnapshot.address ? 'wallet_changed' : 'disconnected',
          error: walletSnapshot.connected && walletSnapshot.address
            ? 'Wallet changed. Connect again to start a new authenticated Console session.'
            : null,
        });
      } else {
        state = { ...state, walletSnapshot };
      }
      if (state.data) render(root, state, handlers);
    });
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (state.pageKind !== 'console' || !String(event.key ?? '').startsWith('multipass.looperWallet.')) return;
        void refreshLooperAgentWallet();
      });
    }
    if (state.pageKind === 'runtime') {
      state = { ...state, data: {}, staticData: {} };
      render(root, state, handlers);
      return;
    }
    if (state.pageKind === 'swarm_admin') {
      state = { ...state, data: {}, staticData: {}, walletSnapshot: activeWalletClient.getSnapshot() };
      render(root, state, handlers);
      if (state.walletSnapshot.connected && state.walletSnapshot.address) await refreshSwarmAdminApproval();
      return;
    }
    if (state.pageKind === 'looper_marketplace') {
      render(root, state, handlers);
      if (state.looperMarketplace.route.kind !== 'invalid') await refreshLooperMarketplace();
      return;
    }
    renderLoading(root);
    try {
      const data = await loadInitialDemo();
      state = { ...state, data, staticData: data };
      render(root, state, handlers);
      const resolverInput = getInitialResolverInput();
      if (resolverInput !== null) {
        resolveLiveAgent(resolverInput);
      } else if (state.pageKind === 'product_home') {
        scheduleHomepageProfilePrefetch(data);
      } else if (state.pageKind === 'console' && !state.consoleMockMode && state.walletSnapshot.connected && state.walletSnapshot.address) {
        if (requiresPreparedConsoleChallenge(state.walletSnapshot)) {
          await prepareConsoleSessionChallenge(state.walletSnapshot);
        } else {
          await connectConsoleWallet();
        }
      } else if (state.pageKind === 'looper_mint' && state.looperMint.enabled && state.looperMint.config?.contractAddress) {
        refreshLooperMint({ silent: true });
      }
    } catch (error) {
      renderError(root, error);
    }
  }

  async function resolveLiveAgent(input, options = {}) {
    const trimmed = String(input ?? '').trim();
    const selectedAgentCard = Number.isInteger(options.selectedAgentCard) ? options.selectedAgentCard : state.selectedAgentCard;
    const cachedLiveData = getCachedLiveProfile(trimmed);
    if (cachedLiveData) {
      state = {
        ...state,
        pageKind: 'profile',
        data: cachedLiveData,
        resolverInput: input,
        resolverStatus: 'loaded',
        resolverError: null,
        retryUntil: 0,
        retryMessage: null,
        selectedAgentCard: 0,
        expandedCard: null,
        resolverInFlightInput: null,
        resolverRequestId: state.resolverRequestId + 1,
        lookupMatches: [],
        saveStatus: null,
        saveError: null,
        savedSharePath: null,
        savedProfile: null,
        claimStatus: null,
        claimError: null,
        claimCsrfToken: null,
        claimSessionStatus: null,
        ...clearedRouteState(),
      };
      syncShareUrl(cachedLiveData?.liveProfilePage?.sharePath);
      render(root, state, handlers);
      return;
    }

    const loadingPageKind = state.pageKind === 'product_home' ? 'product_home' : 'profile';
    state = {
      ...state,
      pageKind: loadingPageKind,
      selectedAgentCard,
      resolverInput: input,
      resolverStatus: 'loading',
      resolverError: null,
      retryMessage: null,
      resolverInFlightInput: trimmed,
      resolverRequestId: state.resolverRequestId + 1,
      lookupMatches: [],
      saveStatus: null,
      saveError: null,
      savedSharePath: null,
      savedProfile: null,
      claimStatus: null,
      claimError: null,
      claimCsrfToken: null,
      claimSessionStatus: null,
      groupActivation: createInitialGroupActivationState(),
      groupActivationExpanded: false,
      groupActivationRequestId: state.groupActivationRequestId + 1,
      ...clearedRouteState(),
    };
    const requestId = state.resolverRequestId;
    render(root, state, handlers);

    try {
      const liveProfileKey = getLiveProfileCacheKey(trimmed);
      const inFlightLiveData = liveProfileInFlight.get(liveProfileKey);
      let hydratedLiveData;
      if (inFlightLiveData) {
        hydratedLiveData = await inFlightLiveData;
      } else {
        const liveData = await activeLoadLiveDemo(liveProfileKey);
        hydratedLiveData = liveData?.canonicalHydrated ? liveData : await overlaySavedProfileVisual(liveData, { fetchImpl });
        setCachedLiveProfile(liveProfileKey, hydratedLiveData);
      }
      if (requestId !== state.resolverRequestId) return;
      state = {
        ...state,
        pageKind: 'profile',
        data: hydratedLiveData,
        resolverStatus: 'loaded',
        resolverError: null,
        retryUntil: 0,
        retryMessage: null,
        selectedAgentCard: 0,
        expandedCard: null,
        resolverInFlightInput: null,
        lookupMatches: [],
        saveStatus: null,
        saveError: null,
        savedSharePath: null,
        savedProfile: null,
        ...clearedRouteState(),
      };
      syncShareUrl(hydratedLiveData?.liveProfilePage?.sharePath);
      render(root, state, handlers);
    } catch (error) {
      if (requestId !== state.resolverRequestId) return;
      const retryState = retryStateFromError(error);
      state = {
        ...state,
        data: state.staticData ?? state.data,
        selectedAgentCard: 0,
        expandedCard: null,
        resolverStatus: 'error',
        resolverError: userResolverMessage(error),
        resolverInFlightInput: null,
        retryUntil: retryState.retryUntil,
        retryMessage: retryState.retryMessage,
        lookupMatches: lookupMatchesFromError(error),
        saveStatus: null,
        saveError: null,
        savedSharePath: null,
        savedProfile: null,
        ...clearedRouteState(),
      };
      clearShareUrl();
      render(root, state, handlers);
    }
  }

  function resetStaticDemo() {
    clearShareUrl();
    syncMultipassHomeUrl();
    state = {
      ...state,
      pageKind: 'product_home',
      data: state.staticData,
      selectedAgentCard: 0,
      expandedCard: null,
      resolverInput: '',
      resolverStatus: null,
      resolverError: null,
      resolverInFlightInput: null,
      resolverRequestId: state.resolverRequestId + 1,
      retryUntil: 0,
      retryMessage: null,
      lookupMatches: [],
      saveStatus: null,
      saveError: null,
      savedSharePath: null,
      savedProfile: null,
      claimStatus: null,
      claimError: null,
      claimCsrfToken: null,
      claimSessionStatus: null,
      groupActivation: createInitialGroupActivationState(),
      groupActivationExpanded: false,
      groupActivationRequestId: state.groupActivationRequestId + 1,
      ...clearedRouteState(),
    };
    render(root, state, handlers);
    scheduleHomepageProfilePrefetch(state.data);
  }

  function getCachedLiveProfile(input) {
    return liveProfileCache.get(getLiveProfileCacheKey(input)) ?? null;
  }

  function setCachedLiveProfile(input, data) {
    const keys = [
      input,
      data?.resolver?.tokenId,
      data?.resolver?.canonicalId,
      data?.profile?.token_id,
      data?.profile?.tokenId,
    ]
      .map(getLiveProfileCacheKey)
      .filter(Boolean);
    for (const key of keys) liveProfileCache.set(key, data);
  }

  async function loadAndCacheLiveProfile(input) {
    const key = getLiveProfileCacheKey(input);
    const cached = getCachedLiveProfile(key);
    if (cached) return cached;
    const inFlight = liveProfileInFlight.get(key);
    if (inFlight) return inFlight;

    const request = activeLoadLiveDemo(key)
      .then((liveData) => liveData?.canonicalHydrated ? liveData : overlaySavedProfileVisual(liveData, { fetchImpl }))
      .then((hydratedLiveData) => {
        setCachedLiveProfile(key, hydratedLiveData);
        return hydratedLiveData;
      })
      .finally(() => {
        liveProfileInFlight.delete(key);
      });
    liveProfileInFlight.set(key, request);
    return request;
  }

  function scheduleHomepageProfilePrefetch(data) {
    if (!shouldPrefetchProfiles || typeof window === 'undefined') return;
    window.setTimeout(() => prefetchHomepageProfiles(data), 0);
  }

  function prefetchHomepageProfiles(data) {
    const carousel = createAgentCarousel(data);
    const agents = [...new Set((carousel.cards ?? [])
      .map(getHomepageMultipassProfileAgent)
      .filter(isPrefetchableHomepageAgent))];
    for (const agent of agents) {
      void loadAndCacheLiveProfile(agent).catch(() => {});
    }
  }

  async function saveCurrentMultipass() {
    if (state.resolverStatus !== 'loaded') return;
    const agent = state.data?.resolver?.tokenId;
    if (!agent) {
      state = { ...state, saveStatus: 'error', saveError: 'Resolved token ID is required before activation.' };
      render(root, state, handlers);
      return;
    }
    state = { ...state, saveStatus: 'saving', saveError: null };
    render(root, state, handlers);
    try {
      const saved = await saveMultipass({ agent, fetchImpl });
      state = {
        ...state,
        saveStatus: 'saved',
        saveError: null,
        savedSharePath: saved.sharePath,
        savedProfile: saved.profile,
        ...clearedRouteState(),
        data: {
          ...state.data,
          liveProfilePage: {
            ...state.data.liveProfilePage,
            sharePath: saved.sharePath,
            headerMeta: `Activated Multipass · ${saved.profile?.slug ?? 'persistent profile'}`,
          },
        },
      };
      syncShareUrl(saved.sharePath);
      render(root, state, handlers);
    } catch (error) {
      state = { ...state, saveStatus: 'error', saveError: error.message };
      render(root, state, handlers);
    }
  }

  function showGroupActivation() {
    state = { ...state, groupActivationExpanded: true };
    render(root, state, handlers);
  }

  async function previewGroupActivation() {
    if (state.groupActivation?.status === 'saving') return;
    const input = readGroupActivationPayload(root, state.groupActivation);
    const requestId = state.groupActivationRequestId + 1;
    state = {
      ...state,
      groupActivationExpanded: true,
      groupActivationRequestId: requestId,
      groupActivation: { status: 'previewing', input, preview: null, result: null, error: null },
    };
    render(root, state, handlers);

    try {
      const apiBase = getWritableApiBaseFromLocation(new URL(window.location.href));
      const preview = await previewGroupMultipass(input, { apiBase, fetchImpl });
      if (state.groupActivationRequestId !== requestId) return;
      state = {
        ...state,
        groupActivation: { status: 'previewed', input, preview, result: null, error: null },
      };
      render(root, state, handlers);
    } catch (error) {
      if (state.groupActivationRequestId !== requestId) return;
      state = {
        ...state,
        groupActivation: { status: 'error', input, preview: null, result: null, error },
      };
      render(root, state, handlers);
    }
  }

  async function saveGroupActivation() {
    const input = readGroupActivationPayload(root, state.groupActivation);
    const previous = state.groupActivation ?? createInitialGroupActivationState();
    if (!previous.preview || !areGroupActivationInputsEqual(input, previous.input)) {
      state = {
        ...state,
        groupActivationExpanded: true,
        groupActivationRequestId: state.groupActivationRequestId + 1,
        groupActivation: {
          status: 'error',
          input,
          preview: null,
          result: null,
          error: new Error('Preview the current group details before activating.'),
        },
      };
      render(root, state, handlers);
      return;
    }
    const requestId = state.groupActivationRequestId + 1;
    state = {
      ...state,
      groupActivationExpanded: true,
      groupActivationRequestId: requestId,
      groupActivation: { ...previous, status: 'saving', input, result: null, error: null },
    };
    render(root, state, handlers);

    try {
      const apiBase = getWritableApiBaseFromLocation(new URL(window.location.href));
      const result = await saveGroupMultipass(input, { apiBase, fetchImpl });
      if (state.groupActivationRequestId !== requestId) return;
      state = {
        ...state,
        groupActivation: { ...state.groupActivation, status: 'saved', input, result, error: null },
      };
      render(root, state, handlers);
    } catch (error) {
      if (state.groupActivationRequestId !== requestId) return;
      state = {
        ...state,
        groupActivation: { ...previous, status: 'error', input, result: null, error },
      };
      render(root, state, handlers);
    }
  }

  function resetGroupActivation() {
    state = {
      ...state,
      groupActivation: createInitialGroupActivationState(),
      groupActivationExpanded: true,
      groupActivationRequestId: state.groupActivationRequestId + 1,
    };
    render(root, state, handlers);
  }

  async function registerLooperAllowlist(event) {
    event?.preventDefault?.();
    const form = event?.currentTarget;
    const rawAddress = form?.querySelector('[name="looper_allowlist_address"]')?.value ?? state.looperAllowlist?.input ?? '';
    const botTrap = form?.querySelector('[name="looper_allowlist_contact"]')?.value ?? '';
    const turnstileToken = form?.querySelector('[name="cf-turnstile-response"]')?.value ?? '';
    const resolvingEns = isLooperAllowlistEnsName(rawAddress);
    state = { ...state, looperAllowlist: { status: resolvingEns ? 'resolving_ens' : 'registering', input: rawAddress, result: null, error: null } };
    render(root, state, handlers);

    let normalized;
    try {
      normalized = await resolveLooperAllowlistAddressInput(rawAddress, { resolveEnsAddress: ensResolver });
    } catch (error) {
      state = { ...state, looperAllowlist: { status: 'error', input: rawAddress, result: null, error: error.message } };
      render(root, state, handlers);
      return;
    }

    await registerResolvedLooperAllowlistAddress(normalized, { botTrap, turnstileToken });
  }

  async function registerResolvedLooperAllowlistAddress(normalized, options = {}) {
    state = { ...state, looperAllowlist: { status: 'registering', input: normalized, result: null, error: null } };
    render(root, state, handlers);

    try {
      const apiBase = getWritableApiBaseFromLocation(new URL(window.location.href));
      const source = getLooperAllowlistSourceFromLocation(window.location.href);
      const result = await registerLooperAllowlistAddress({
        address: normalized,
        apiBase,
        source,
        fetchImpl,
        botTrap: options.botTrap ?? '',
        turnstileToken: options.turnstileToken ?? '',
      });
      state = { ...state, looperAllowlist: { status: result.created ? 'registered' : 'existing', input: result.address ?? normalized, result, error: null } };
      render(root, state, handlers);
    } catch (error) {
      state = { ...state, looperAllowlist: { status: 'error', input: normalized, result: null, error: error.message } };
      render(root, state, handlers);
    }
  }

  async function connectLooperAllowlistWallet() {
    const currentAllowlist = state.looperAllowlist ?? createInitialLooperAllowlistState();
    state = {
      ...state,
      looperAllowlist: { ...currentAllowlist, status: 'connecting_wallet', error: null },
      walletSnapshot: activeWalletClient.getSnapshot(),
    };
    render(root, state, handlers);

    try {
      let walletSnapshot = activeWalletClient.getSnapshot();
      if (walletSnapshot.configured === false) throw new Error('Wallet connection is not configured for this build. Enter your Base address manually.');
      if (!walletSnapshot.connected) {
        await activeWalletClient.connect();
        walletSnapshot = activeWalletClient.getSnapshot();
      }
      if (!walletSnapshot.connected || !walletSnapshot.address) throw new Error('Connect an Ethereum wallet or enter your Base address manually.');

      const normalized = normalizeLooperAllowlistAddress(walletSnapshot.address);
      state = {
        ...state,
        walletSnapshot,
        looperAllowlist: { status: 'registering', input: normalized, result: null, error: null },
      };
      render(root, state, handlers);
      await registerResolvedLooperAllowlistAddress(normalized);
    } catch (error) {
      state = {
        ...state,
        walletSnapshot: activeWalletClient.getSnapshot(),
        looperAllowlist: {
          ...currentAllowlist,
          status: 'error',
          error: getLooperAllowlistWalletErrorMessage(error),
        },
      };
      render(root, state, handlers);
    }
  }

  async function prepareConsoleSessionChallenge(walletSnapshot, { sessionGeneration = state.consoleSessionGeneration } = {}) {
    const wallet = normalizeConsoleWalletKey(walletSnapshot?.address);
    if (!wallet || !requiresPreparedConsoleChallenge(walletSnapshot)) return null;
    const requestId = ++consoleChallengeRequestId;
    preparedConsoleChallenge = null;
    state = {
      ...state,
      walletSnapshot,
      consoleWalletStatus: 'preparing_signature',
      consoleWalletError: null,
    };
    render(root, state, handlers);
    try {
      const apiBase = getWritableApiBaseFromLocation(new URL(window.location.href));
      const [challenge] = await Promise.all([
        (claimApi.requestConsoleSessionChallenge ?? defaultRequestConsoleSessionChallenge)({
          apiBase,
          wallet: walletSnapshot.address,
          fetchImpl,
        }),
        activeWalletClient.waitForPreparedSigningProvider?.({ timeoutMs: 15000 }) ?? null,
      ]);
      const currentWallet = activeWalletClient.getSnapshot();
      if (
        requestId !== consoleChallengeRequestId
        || state.consoleSessionGeneration !== sessionGeneration
        || !currentWallet.connected
        || normalizeConsoleWalletKey(currentWallet.address) !== wallet
      ) return null;
      preparedConsoleChallenge = { wallet, challenge };
      state = {
        ...state,
        walletSnapshot: currentWallet,
        consoleWalletStatus: 'signature_ready',
        consoleWalletError: null,
      };
      render(root, state, handlers);
      return challenge;
    } catch (error) {
      if (requestId !== consoleChallengeRequestId || state.consoleSessionGeneration !== sessionGeneration) return null;
      state = {
        ...state,
        walletSnapshot: activeWalletClient.getSnapshot(),
        consoleWalletStatus: 'transport_failed',
        consoleWalletError: getSafeConsoleError(error, { phase: 'nonce' }),
      };
      render(root, state, handlers);
      return null;
    }
  }

  async function connectConsoleWallet() {
    abortConsoleReleasedLooperDiscovery();
    clearConsoleImagePreview();
    consoleCodexCache.clear();
    consoleCodexArtifactHash = null;
    const sessionGeneration = state.consoleSessionGeneration + 1;
    state = {
      ...state,
      consoleWalletStatus: 'connecting',
      consoleWalletError: null,
      consoleCsrfToken: null,
      consoleAuthenticatedWallet: null,
      consoleOwnerProfile: null,
      consoleSessionGeneration: sessionGeneration,
      consoleOwnedAgentsRequestId: state.consoleOwnedAgentsRequestId + 1,
      consoleActivationRequestId: state.consoleActivationRequestId + 1,
      consoleCodexRequestId: state.consoleCodexRequestId + 1,
      consoleThreadGeneration: state.consoleThreadGeneration + 1,
      consoleAgentNameMutation: {
        status: 'idle',
        requestId: Number(state.consoleAgentNameMutation?.requestId ?? 0) + 1,
        tokenId: null,
      },
      consoleOwnedAgents: createInitialConsoleOwnedAgentsState(),
      consoleAgentGallery: { query: '', sort: 'token-asc', activationError: null },
      consoleMainRosterOpen: false,
      consoleSidebarRosterOpen: false,
      consoleSelectedAgentId: null,
      consoleParticipantAgentIds: [],
      consoleAgentThread: createInitialConsoleAgentThreadState(),
      consoleCodex: createInitialConsoleCodexState(),
      walletSnapshot: activeWalletClient.getSnapshot(),
    };
    render(root, state, handlers);

    let authenticationStage = 'connect';
    try {
      let walletSnapshot = activeWalletClient.getSnapshot();
      if (walletSnapshot.configured === false) throw new Error('Wallet login is not configured for this build.');
      if (walletSnapshot.ready === false) throw new Error('Wallet options are still loading.');
      if (!walletSnapshot.connected || !walletSnapshot.address) await activeWalletClient.connect();
      walletSnapshot = activeWalletClient.getSnapshot();
      if (!walletSnapshot.connected || !walletSnapshot.address) throw new Error('Connect an Ethereum wallet to use Console wallet identity.');
      const authenticatingWallet = normalizeConsoleWalletKey(walletSnapshot.address);
      if (!authenticatingWallet) throw new Error('Connected wallet returned an invalid address.');
      let challenge;
      if (!requiresPreparedConsoleChallenge(walletSnapshot)) {
        preparedConsoleChallenge = null;
        consoleChallengeRequestId += 1;
      }
      if (requiresPreparedConsoleChallenge(walletSnapshot)) {
        if (preparedConsoleChallenge?.wallet !== authenticatingWallet) {
          await prepareConsoleSessionChallenge(walletSnapshot, { sessionGeneration });
          return;
        }
        challenge = preparedConsoleChallenge.challenge;
        preparedConsoleChallenge = null;
      }
      state = {
        ...state,
        walletSnapshot,
        consoleWalletStatus: 'signing',
        consoleWalletError: null,
      };
      render(root, state, handlers);
      const apiBase = getWritableApiBaseFromLocation(new URL(window.location.href));
      authenticationStage = challenge ? 'signature' : 'nonce';
      const authenticated = await (claimApi.authenticateConsoleSession ?? defaultAuthenticateConsoleSession)({
        apiBase,
        wallet: walletSnapshot.address,
        challenge,
        signMessage: (message) => activeWalletClient.signMessage(message),
        fetchImpl,
        onStage: (stage) => { authenticationStage = stage; },
      });
      const currentWallet = activeWalletClient.getSnapshot();
      if (
        state.consoleSessionGeneration !== sessionGeneration
        || !currentWallet.connected
        || normalizeConsoleWalletKey(currentWallet.address) !== authenticatingWallet
      ) return;
      state = {
        ...state,
        walletSnapshot: currentWallet,
        consoleWalletStatus: 'loading_roster',
        consoleWalletError: null,
        consoleCsrfToken: authenticated.csrfToken,
        consoleAuthenticatedWallet: authenticatingWallet,
        consoleOwnerProfile: null,
        consoleOwnedAgents: {
          status: 'loading',
          error: null,
          agents: [],
        },
        consoleSelectedAgentId: null,
        consoleParticipantAgentIds: [],
        consoleAgentThread: createInitialConsoleAgentThreadState(),
      };
      render(root, state, handlers);
      void loadConsoleOwnerProfile(currentWallet.address, sessionGeneration, authenticatingWallet);
      await refreshConsoleOwnedAgents({ walletSnapshot: currentWallet, skipLoadingState: true, sessionGeneration });
      await openLaunchConsentFromLocation();
      await openSwarmInviteFromLocation();
    } catch (error) {
      if (state.consoleSessionGeneration !== sessionGeneration) return;
      if (isConsoleAuthorizationError(error)) {
        state = clearConsoleSessionStateWithPreview(state, {
          walletSnapshot: activeWalletClient.getSnapshot(),
          status: 'authorization_failed',
          error: 'Console authorization failed. Connect again and approve the wallet signature.',
        });
        render(root, state, handlers);
        return;
      }
      state = {
        ...state,
        walletSnapshot: activeWalletClient.getSnapshot(),
        consoleWalletStatus: isConsoleCancellation(error) ? 'cancelled' : 'transport_failed',
        consoleWalletError: getSafeConsoleError(error, { phase: authenticationStage }),
      };
      render(root, state, handlers);
    }
  }

  async function loadConsoleOwnerProfile(address, sessionGeneration, authenticatedWallet) {
    try {
      const profile = await consoleOwnerProfileResolver(address);
      const currentWallet = activeWalletClient.getSnapshot();
      if (
        state.consoleSessionGeneration !== sessionGeneration
        || normalizeConsoleWalletKey(state.consoleAuthenticatedWallet) !== authenticatedWallet
        || !currentWallet.connected
        || normalizeConsoleWalletKey(currentWallet.address) !== authenticatedWallet
      ) return;
      state = { ...state, consoleOwnerProfile: profile ?? null };
      render(root, state, handlers);
    } catch {
      // ENS is cosmetic. The authenticated full address remains the owner label.
    }
  }

  async function selectConsoleImage(event) {
    const files = event?.target?.files ?? event?.dataTransfer?.files ?? event?.clipboardData?.files ?? [];
    if (files.length) event?.preventDefault?.();
    if (state.consoleAgentThread?.status === 'sending') return;
    const images = [...files].filter((file) => String(file?.type ?? '').startsWith('image/'));
    if (!images.length) return;
    if (files.length !== 1 || images.length !== 1) {
      clearConsoleImagePreview();
      state = { ...state, consoleAgentThread: { ...state.consoleAgentThread, attachment: { error: 'Attach one image at a time.' } } };
      render(root, state, handlers);
      return;
    }
    const preparationId = ++consoleImagePreparationId;
    state = { ...state, consoleAgentThread: { ...state.consoleAgentThread, attachment: { status: 'preparing', error: null } } };
    render(root, state, handlers);
    try {
      const prepared = await prepareConsoleImageImpl(images[0]);
      if (preparationId !== consoleImagePreparationId) return;
      consoleImagePreview ??= imagePreviewFactory();
      const previewUrl = consoleImagePreview.set(preparedImageBlob(prepared));
      state = {
        ...state,
        consoleAgentThread: {
          ...state.consoleAgentThread,
          attachment: {
            status: 'ready',
            prepared,
            previewUrl,
            clientMessageId: createConsoleClientMessageId(),
            error: null,
          },
        },
      };
    } catch (error) {
      if (preparationId !== consoleImagePreparationId) return;
      consoleImagePreview?.clear();
      state = { ...state, consoleAgentThread: { ...state.consoleAgentThread, attachment: { status: 'error', error: error.message || 'Image preparation failed.' } } };
    }
    render(root, state, handlers);
  }

  function removeConsoleImage() {
    clearConsoleImagePreview();
    state = { ...state, consoleAgentThread: { ...state.consoleAgentThread, attachment: null } };
    render(root, state, handlers);
  }

  async function sendConsoleAgentMessage(event) {
    event?.preventDefault?.();
    const form = event?.currentTarget;
    const message = String(form?.querySelector?.('textarea[name="message"]')?.value ?? '').trim();
    if (state.consoleAgentThread?.attachment?.status === 'preparing') return;
    const preparedAttachment = state.consoleAgentThread?.attachment?.prepared ?? null;
    const clientMessageId = state.consoleAgentThread?.attachment?.clientMessageId ?? null;
    if (!message && !preparedAttachment) return;
    const walletSnapshot = state.consoleMockMode ? state.walletSnapshot : activeWalletClient.getSnapshot();
    if (!walletSnapshot.connected || !walletSnapshot.address) {
      state = {
        ...state,
        walletSnapshot,
        consoleAgentThread: {
          ...state.consoleAgentThread,
          status: 'error',
          operationStatus: 'authorization_failed',
          errorKind: 'authorization',
          retryAvailable: false,
          error: 'Connect a wallet before messaging an agent.',
        },
      };
      render(root, state, handlers);
      return;
    }
    const activeConsoleAgent = getActiveConsoleAgent(state);
    const roomParticipants = getConsoleRoomParticipants(state);
    const roomName = createConsoleRoomName(roomParticipants);
    if (!activeConsoleAgent?.tokenId) {
      state = {
        ...state,
        walletSnapshot,
        consoleAgentThread: {
          ...state.consoleAgentThread,
          status: 'error',
          operationStatus: 'authorization_failed',
          errorKind: 'authorization',
          retryAvailable: false,
          error: 'No wallet-owned Helixa agent is loaded for this session.',
        },
      };
      render(root, state, handlers);
      return;
    }

    state = {
      ...state,
      walletSnapshot,
      consoleAgentThread: {
        ...state.consoleAgentThread,
        status: 'sending',
        operationStatus: 'sending_mission',
        draft: message,
        retryAvailable: false,
        errorKind: null,
        error: null,
      },
    };
    render(root, state, handlers);

    const sendContext = createConsoleAsyncContext(state, activeConsoleAgent.tokenId);
    try {
      await Promise.resolve();
      if (!isCurrentConsoleAsyncContext(state, sendContext)) return;
      const ensureXmtpRegistration = claimApi.ensureXmtpWalletRegistration ?? defaultEnsureXmtpWalletRegistration;
      const needsFirstRoomRegistration = state.consoleAgentThread?.transport === 'xmtp_group'
        && !String(state.consoleAgentThread?.conversationId ?? '').trim();
      if (needsFirstRoomRegistration) {
        state = {
          ...state,
          consoleAgentThread: {
            ...state.consoleAgentThread,
            operationStatus: 'setting_up_xmtp',
          },
        };
        render(root, state, handlers);
        await ensureXmtpRegistration({
          wallet: walletSnapshot.address,
          signMessage: (messageToSign) => activeWalletClient.signMessage(messageToSign),
          getAccountCode: (wallet) => activeWalletClient.request({ method: 'eth_getCode', params: [wallet, 'latest'] }),
          getChainId: () => activeWalletClient.request({ method: 'eth_chainId' }),
        });
        if (!isCurrentConsoleAsyncContext(state, sendContext)) return;
      }
      state = {
        ...state,
        consoleAgentThread: {
          ...state.consoleAgentThread,
          operationStatus: 'waiting_bankr_sibyl',
        },
      };
      render(root, state, handlers);
      const apiBase = getWritableApiBaseFromLocation(new URL(window.location.href));
      const sendMessage = () => claimApi.sendConsoleAgentMessage({
        apiBase,
        tokenId: activeConsoleAgent.tokenId,
        message,
        csrfToken: state.consoleCsrfToken,
        walletContext: createReadOnlyLooperWalletContext(state.looperAgentWallet),
        attachment: preparedAttachment,
        clientMessageId,
        fetchImpl,
      });
      let result;
      try {
        result = await sendMessage();
      } catch (error) {
        if (!isXmtpRegistrationRequiredError(error)) throw error;
        if (!isCurrentConsoleAsyncContext(state, sendContext)) return;
        state = {
          ...state,
          consoleAgentThread: {
            ...state.consoleAgentThread,
            operationStatus: 'setting_up_xmtp',
          },
        };
        render(root, state, handlers);
        await ensureXmtpRegistration({
          wallet: walletSnapshot.address,
          signMessage: (messageToSign) => activeWalletClient.signMessage(messageToSign),
          getAccountCode: (wallet) => activeWalletClient.request({ method: 'eth_getCode', params: [wallet, 'latest'] }),
          getChainId: () => activeWalletClient.request({ method: 'eth_chainId' }),
        });
        if (!isCurrentConsoleAsyncContext(state, sendContext)) return;
        state = {
          ...state,
          consoleAgentThread: {
            ...state.consoleAgentThread,
            operationStatus: 'waiting_bankr_sibyl',
          },
        };
        render(root, state, handlers);
        result = await sendMessage();
      }
      if (!isCurrentConsoleAsyncContext(state, sendContext)) return;
      const visibleMessages = filterConsoleHiddenMessages(
        result.thread?.messages,
        state.consoleAuthenticatedWallet,
        activeConsoleAgent.tokenId,
      );
      clearConsoleImagePreview();
      state = {
        ...state,
        consoleScrollRequest: Number(state.consoleScrollRequest ?? 0) + 1,
        consoleAgentThread: {
          status: visibleMessages.length ? 'received' : 'idle',
          error: null,
          errorKind: null,
          retryAvailable: false,
          operationStatus: null,
          draft: '',
          attachment: null,
          messages: visibleMessages,
          proposals: result.proposals ?? [],
          ...getConsoleSkillProposalResponseFields(result),
          ...(Array.isArray(result.memory?.saved) ? { savedMemory: result.memory.saved } : {}),
          ...(Array.isArray(result.memory?.recalled) ? { recalledMemory: result.memory.recalled } : {}),
          missions: result.missions ?? [],
          participants: result.thread?.participants ?? result.room?.participants ?? roomParticipants,
          roomName: result.thread?.roomName ?? result.room?.name ?? roomName,
          conversationId: result.thread?.conversationId ?? null,
          recalledMission: Array.isArray(result.memory?.recalled) && result.memory.recalled.length
            ? (String(result.memory?.recalledMission ?? '').trim() || null)
            : null,
          sessionReset: false,
          memoryProvider: result.memory?.provider ?? null,
          transport: result.thread?.transport ?? 'unavailable',
          inferenceProvider: visibleMessages.findLast?.((entry) => entry.inferenceProvider)?.inferenceProvider ?? null,
          executionMode: result.executionMode ?? result.execution_mode ?? null,
        },
      };
      render(root, state, handlers);
    } catch (error) {
      if (!isCurrentConsoleAsyncContext(state, sendContext)) return;
      if (isConsoleUnauthorized(error)) {
        state = clearConsoleSessionStateWithPreview(state, {
          walletSnapshot: activeWalletClient.getSnapshot(),
          status: 'authorization_failed',
          error: 'Console session expired. Connect again to continue.',
        });
        render(root, state, handlers);
        return;
      }
      state = {
        ...state,
        consoleAgentThread: {
          ...state.consoleAgentThread,
          status: 'error',
          operationStatus: isConsoleCancellation(error) ? 'cancelled' : (isConsoleAuthorizationError(error) ? 'authorization_failed' : 'transport_failed'),
          errorKind: isConsoleCancellation(error) ? 'cancelled' : (isConsoleAuthorizationError(error) ? 'authorization' : 'transport'),
          retryAvailable: !isConsoleCancellation(error),
          draft: message,
          attachment: state.consoleAgentThread?.attachment ?? null,
          error: getSafeConsoleError(error, { phase: 'send' }),
        },
      };
      render(root, state, handlers);
    }
  }

  async function updateConsoleAgentName(event) {
    event?.preventDefault?.();
    const activeAgent = getActiveConsoleAgent(state);
    if (!activeAgent?.tokenId) return;
    const formData = createFormData(event?.currentTarget);
    const requestedName = normalizeConsoleAgentName(formData.get('console_agent_name'));
    return mutateConsoleAgentName(activeAgent, { overrideName: requestedName });
  }

  async function resetConsoleAgentName() {
    const activeAgent = getActiveConsoleAgent(state);
    if (!activeAgent?.tokenId) return;
    return mutateConsoleAgentName(activeAgent, { overrideName: null });
  }

  async function mutateConsoleAgentName(activeAgent, { overrideName } = {}) {
    if (state.consoleAgentNameMutation?.status === 'pending') return;
    const tokenId = String(activeAgent?.tokenId ?? '').trim();
    if (!tokenId) return;
    const requestId = Number(state.consoleAgentNameMutation?.requestId ?? 0) + 1;
    state = {
      ...state,
      consoleAgentNameMutation: { status: 'pending', requestId, tokenId },
    };
    render(root, state, handlers);
    const mutationContext = {
      ...createConsoleAsyncContext(state, tokenId, state.consoleActivationRequestId),
      agentNameRequestId: requestId,
    };
    try {
      const persisted = await persistConsoleAgentName(tokenId, overrideName);
      if (!isCurrentConsoleAgentNameMutation(state, mutationContext)) return;
      state = {
        ...state,
        consoleAgentNameMutation: { status: 'idle', requestId, tokenId: null },
      };
      applyConsoleAgentNameOverride(activeAgent, overrideName, persisted);
    } catch (error) {
      if (!isCurrentConsoleAgentNameMutation(state, mutationContext)) return;
      state = {
        ...state,
        consoleAgentNameMutation: { status: 'idle', requestId, tokenId: null },
      };
      if (isConsoleUnauthorized(error)) {
        state = clearConsoleSessionStateWithPreview(state, {
          walletSnapshot: activeWalletClient.getSnapshot(),
          status: 'authorization_failed',
          error: 'Console session expired. Connect again to continue.',
        });
        render(root, state, handlers);
        return;
      }
      state = { ...state, consoleAgentThread: { ...state.consoleAgentThread, status: 'error', operationStatus: 'activation_failed', errorKind: 'activation', retryAvailable: false, activationRetryAvailable: true, error: getSafeConsoleError(error, { phase: 'activate' }) } };
      render(root, state, handlers);
    } finally {
      if (
        state.consoleAgentNameMutation?.status === 'pending'
        && state.consoleAgentNameMutation?.requestId === requestId
        && String(state.consoleAgentNameMutation?.tokenId ?? '') === tokenId
      ) {
        state = {
          ...state,
          consoleAgentNameMutation: { status: 'idle', requestId, tokenId: null },
        };
        render(root, state, handlers);
      }
    }
  }

  function persistConsoleAgentName(tokenId, name) {
    if (state.consoleMockMode) {
      const activeAgent = getActiveConsoleAgent(state);
      return activateConsoleAgentRuntime(tokenId, name || getCanonicalConsoleAgentName(activeAgent) || `Looper #${tokenId}`);
    }
    const apiBase = getWritableApiBaseFromLocation(new URL(window.location.href));
    if (!claimApi.updateConsoleAgentName && claimApi.activateConsoleAgent) {
      return activateConsoleAgentRuntime(tokenId, name || `Looper #${tokenId}`);
    }
    return (claimApi.updateConsoleAgentName ?? defaultUpdateConsoleAgentName)({
      apiBase,
      tokenId,
      name: name ?? null,
      csrfToken: state.consoleCsrfToken,
      fetchImpl,
    });
  }

  function activateConsoleAgentRuntime(tokenId, runtimeName) {
    if (state.consoleMockMode) return Promise.resolve({ runtime: { tokenId, runtimeName, status: 'active' } });
    const apiBase = getWritableApiBaseFromLocation(new URL(window.location.href));
    return (claimApi.activateConsoleAgent ?? defaultActivateConsoleAgent)({
      apiBase,
      tokenId,
      runtimeName,
      csrfToken: state.consoleCsrfToken,
      fetchImpl,
    });
  }

  function applyConsoleAgentNameOverride(activeAgent, requestedName, persisted = null) {
    const tokenId = String(activeAgent?.tokenId ?? '').trim();
    if (!tokenId) return;
    const canonicalName = getCanonicalConsoleAgentName(activeAgent) ?? `Agent #${tokenId}`;
    const nextName = requestedName && requestedName !== canonicalName ? requestedName : null;
    const nextOverrides = {
      ...sanitizeConsoleAgentNameOverrides(state.consoleAgentNameOverrides),
    };
    if (persisted && Object.prototype.hasOwnProperty.call(persisted, 'customName')) delete nextOverrides[tokenId];
    else if (nextName) nextOverrides[tokenId] = nextName;
    else delete nextOverrides[tokenId];
    persistConsoleAgentNameOverrides(nextOverrides);

    const baseAgents = getConsoleDisplayAgents(state).map((agent) => (
      persisted && String(agent?.tokenId ?? '') === tokenId
        ? {
          ...agent,
          name: persisted.name ?? canonicalName,
          canonicalName: persisted.canonicalName ?? canonicalName,
          customName: persisted.customName ?? null,
        }
        : agent
    ));
    const nextAgents = applyConsoleAgentNameOverrides(baseAgents, nextOverrides);
    const nextState = {
      ...state,
      consoleAgentNameOverrides: nextOverrides,
      consoleOwnedAgents: {
        ...state.consoleOwnedAgents,
        agents: nextAgents,
      },
    };
    const renamedAgent = nextAgents.find((agent) => String(agent?.tokenId ?? '') === tokenId) ?? activeAgent;
    state = {
      ...nextState,
      consoleAgentThread: renameConsoleAgentThread(nextState.consoleAgentThread, {
        tokenId,
        previousNames: [activeAgent.name, canonicalName],
        nextName: renamedAgent.name ?? canonicalName,
        participants: getConsoleRoomParticipants(nextState),
      }),
    };
    render(root, state, handlers);
  }

  async function refreshConsoleOwnedAgents({
    walletSnapshot = activeWalletClient.getSnapshot(),
    skipLoadingState = false,
    sessionGeneration = state.consoleSessionGeneration,
    focusOnComplete = false,
  } = {}) {
    if (!walletSnapshot.connected || !walletSnapshot.address) {
      abortConsoleReleasedLooperDiscovery();
      state = clearConsoleSessionStateWithPreview(state, {
        walletSnapshot,
        status: 'disconnected',
      });
      render(root, state, handlers);
      return;
    }

    const rosterWallet = normalizeConsoleWalletKey(walletSnapshot.address);
    if (rosterWallet !== normalizeConsoleWalletKey(state.consoleAuthenticatedWallet)) return;
    const rosterRequestId = Number(state.consoleOwnedAgentsRequestId ?? 0) + 1;
    abortConsoleReleasedLooperDiscovery();
    const discoveryController = new AbortController();
    consoleReleasedLooperAbortController = discoveryController;
    const activationDiscoveryPromise = Promise.resolve(releasedLooperLoader({
      fetchImpl: fetchImpl ?? globalThis.fetch,
      signal: discoveryController.signal,
    })).catch(() => ({ status: 'unavailable', tokenIds: new Set() }));
    state = {
      ...state,
      consoleOwnedAgentsRequestId: rosterRequestId,
      consoleAgentGallery: {
        ...state.consoleAgentGallery,
        activationError: null,
      },
      ...(!skipLoadingState
        ? {
          walletSnapshot,
          consoleOwnedAgents: {
            status: 'loading',
            error: null,
            agents: [],
          },
        }
        : {}),
    };
    if (!skipLoadingState) render(root, state, handlers);

    try {
      const apiBase = getWritableApiBaseFromLocation(new URL(window.location.href));
      const agents = applyConsoleAgentNameOverrides(
        await fetchOwnedLooperAgents({ apiBase, fetchImpl }),
        state.consoleAgentNameOverrides,
      );
      if (
        state.consoleSessionGeneration !== sessionGeneration
        || state.consoleOwnedAgentsRequestId !== rosterRequestId
        || normalizeConsoleWalletKey(state.consoleAuthenticatedWallet) !== rosterWallet
      ) return;
      const preservedAgentId = resolveConsoleSelectedAgentId(agents, state.consoleSelectedAgentId);
      const rememberedAgentId = resolveConsoleSelectedAgentId(
        agents,
        readLastLooperForWallet({ storage: consolePreferenceStorage, wallet: rosterWallet }),
      );
      let selectedAgentId = preservedAgentId ?? rememberedAgentId;
      if (selectedAgentId) {
        discoveryController.abort();
      } else {
        const discovery = await activationDiscoveryPromise;
        if (
          state.consoleSessionGeneration !== sessionGeneration
          || state.consoleOwnedAgentsRequestId !== rosterRequestId
          || normalizeConsoleWalletKey(state.consoleAuthenticatedWallet) !== rosterWallet
        ) return;
        selectedAgentId = resolveDefaultLooperTokenId({
          agents,
          activatedTokenIds: discovery?.tokenIds,
          activationStatus: discovery?.status,
        });
      }
      const participantAgentIds = resolveConsoleParticipantAgentIds(agents, state.consoleParticipantAgentIds, selectedAgentId);
      const selectionChanged = selectedAgentId !== state.consoleSelectedAgentId;
      const restoreRememberedRoom = Boolean(
        rememberedAgentId
        && selectedAgentId === rememberedAgentId
        && !preservedAgentId,
      );
      state = {
        ...state,
        walletSnapshot,
        consoleWalletStatus: 'connected',
        consoleOwnedAgents: {
          status: 'loaded',
          error: null,
          agents,
        },
        consoleSelectedAgentId: selectedAgentId,
        consoleParticipantAgentIds: participantAgentIds,
        consoleThreadGeneration: selectionChanged
          ? Number(state.consoleThreadGeneration ?? 0) + 1
          : state.consoleThreadGeneration,
        consoleAgentThread: !selectionChanged
          ? state.consoleAgentThread
          : createInitialConsoleAgentThreadState(),
      };
      if (selectedAgentId && selectionChanged) {
        await selectConsoleAgentById(selectedAgentId, {
          resetSelection: true,
          ignoreWalletWork: selectionChanged && !preservedAgentId,
          useDefaultWorkspace: true,
        });
        if (restoreRememberedRoom) await activateSelectedConsoleAgent();
      } else {
        render(root, state, handlers);
        if (focusOnComplete && !selectedAgentId) focusConsoleGalleryHeading();
      }
    } catch (error) {
      if (state.consoleSessionGeneration !== sessionGeneration || state.consoleOwnedAgentsRequestId !== rosterRequestId) return;
      if (isConsoleUnauthorized(error)) {
        abortConsoleReleasedLooperDiscovery();
        state = clearConsoleSessionStateWithPreview(state, {
          walletSnapshot: activeWalletClient.getSnapshot(),
          status: 'authorization_failed',
          error: 'Console session expired. Connect again to continue.',
        });
        render(root, state, handlers);
        return;
      }
      state = {
        ...state,
        walletSnapshot,
        consoleWalletStatus: 'connected',
        consoleOwnedAgents: {
          status: 'error',
          error: getSafeConsoleError(error, { phase: 'roster' }),
          agents: [],
        },
        consoleMainRosterOpen: true,
        consoleSidebarRosterOpen: false,
        consoleSelectedAgentId: null,
        consoleParticipantAgentIds: [],
        consoleAgentThread: createInitialConsoleAgentThreadState(),
      };
      render(root, state, handlers);
      if (focusOnComplete) focusConsoleGalleryAlert();
    } finally {
      if (consoleReleasedLooperAbortController === discoveryController) {
        discoveryController.abort();
        consoleReleasedLooperAbortController = null;
      }
    }
  }

  function abortConsoleReleasedLooperDiscovery() {
    consoleReleasedLooperAbortController?.abort();
    consoleReleasedLooperAbortController = null;
  }

  function updateConsoleAgentGallerySearch(event) {
    state = {
      ...state,
      consoleAgentGallery: {
        ...state.consoleAgentGallery,
        query: String(event?.currentTarget?.value ?? ''),
      },
    };
    render(root, state, handlers);
  }

  function updateConsoleAgentGallerySort(event) {
    state = {
      ...state,
      consoleAgentGallery: {
        ...state.consoleAgentGallery,
        sort: String(event?.currentTarget?.value ?? 'token-asc'),
      },
    };
    render(root, state, handlers);
  }

  function clearConsoleAgentGallerySearch() {
    state = {
      ...state,
      consoleAgentGallery: {
        ...state.consoleAgentGallery,
        query: '',
      },
    };
    render(root, state, handlers);
    root.querySelector('[data-action="search-console-agent-gallery"]')?.focus?.();
  }

  function toggleConsoleRosterDrawer(event) {
    const drawer = String(event?.currentTarget?.dataset?.consoleRosterDrawer ?? '');
    const open = Boolean(event?.currentTarget?.open);
    if (drawer === 'main' || drawer === 'switcher') state = { ...state, consoleMainRosterOpen: open };
    if (drawer === 'sidebar') state = { ...state, consoleSidebarRosterOpen: open };
  }

  async function refreshConsoleOwnedAgentsFromControl() {
    if (hasSelectedLooperWalletWork(state)) return;
    return refreshConsoleOwnedAgents({ focusOnComplete: true });
  }

  function focusConsoleGalleryHeading() {
    const heading = root.querySelector('#console-agent-onboarding-title');
    if (!heading) return;
    heading.setAttribute('tabindex', '-1');
    heading.addEventListener('blur', () => heading.removeAttribute('tabindex'), { once: true });
    heading.focus();
  }

  function focusConsoleGalleryAlert() {
    const alert = root.querySelector('.console-agent-gallery [role="alert"]');
    if (!alert) return;
    alert.setAttribute('tabindex', '-1');
    alert.addEventListener('blur', () => alert.removeAttribute('tabindex'), { once: true });
    alert.focus();
  }

  async function loadSelectedLooperWallet(agent, context) {
    const owner = state.consoleAuthenticatedWallet;
    if (!agent?.tokenId || !owner) return;
    let shouldLoadPantheonCred = false;
    state = {
      ...state,
      looperAgentWallet: {
        ...activeLooperWalletController.getSnapshot(),
        tokenId: String(agent.tokenId),
        owner,
        mode: 'loading',
        reason: null,
        error: null,
      },
    };
    render(root, state, handlers);
    try {
      const walletState = await activeLooperWalletController.select({ tokenId: String(agent.tokenId), owner });
      if (!isCurrentConsoleAsyncContext(state, context)) return;
      state = { ...state, looperAgentWallet: { ...walletState, error: null } };
      shouldLoadPantheonCred = walletState.mode === 'active' && typeof activePantheonCredReader === 'function';
    } catch (error) {
      if (!isCurrentConsoleAsyncContext(state, context)) return;
      state = {
        ...state,
        looperAgentWallet: createFailedLooperWalletState({
          tokenId: String(agent.tokenId),
          owner,
          error: getSafeConsoleError(error, { phase: 'wallet' }),
        }),
      };
    }
    render(root, state, handlers);
    if (shouldLoadPantheonCred) void loadPantheonCred();
  }

  async function refreshLooperAgentWallet() {
    if (!state.consoleSelectedAgentId || !state.consoleAuthenticatedWallet) return;
    let shouldLoadPantheonCred = false;
    try {
      const walletState = await activeLooperWalletController.refresh();
      state = { ...state, looperAgentWallet: { ...walletState, error: null } };
      shouldLoadPantheonCred = walletState.mode === 'active' && typeof activePantheonCredReader === 'function';
    } catch (error) {
      state = {
        ...state,
        looperAgentWallet: createFailedLooperWalletState({
          tokenId: state.consoleSelectedAgentId,
          owner: state.consoleAuthenticatedWallet,
          error: getSafeConsoleError(error, { phase: 'wallet' }),
        }),
      };
    }
    render(root, state, handlers);
    if (shouldLoadPantheonCred) void loadPantheonCred();
  }

  async function activateLooperAgentWallet(event) {
    event?.preventDefault?.();
    const confirmed = createFormData(event?.currentTarget).get('confirmed') === 'on';
    if (!confirmed) {
      state = { ...state, looperAgentWallet: { ...state.looperAgentWallet, error: 'Explicit activation confirmation is required.' } };
      render(root, state, handlers);
      return;
    }
    try {
      const prepared = await activeLooperWalletController.prepareActivation();
      state = { ...state, looperAgentWallet: { ...activeLooperWalletController.getSnapshot(), error: null } };
      render(root, state, handlers);
      const walletState = await activeLooperWalletController.submitPrepared(prepared.id, { confirmed: true });
      state = {
        ...state,
        looperAgentWallet: { ...walletState, error: null },
        consoleWorkspaceView: walletState.mode === 'active' ? 'multipass' : state.consoleWorkspaceView,
      };
    } catch (error) {
      const failedWalletState = activeLooperWalletController.getSnapshot();
      const mayHaveLanded = ['submitted', 'uncertain_hashed'].includes(failedWalletState.activation?.state);
      if (mayHaveLanded) {
        try {
          const reconciled = await activeLooperWalletController.refresh();
          if (reconciled.mode === 'active'
            && !['submitted', 'uncertain_hashless', 'uncertain_hashed'].includes(reconciled.activation?.state)) {
            state = {
              ...state,
              looperAgentWallet: { ...reconciled, error: null },
              consoleWorkspaceView: 'multipass',
            };
            render(root, state, handlers);
            return;
          }
        } catch {
          // Preserve the original fail-closed transaction outcome below.
        }
      }
      state = { ...state, looperAgentWallet: { ...failedWalletState, error: getSafeConsoleError(error, { phase: 'wallet' }) } };
    }
    render(root, state, handlers);
  }

  async function sendLooperAgentWallet(event) {
    event?.preventDefault?.();
    const form = event?.currentTarget;
    const data = createFormData(form);
    if (data.get('confirmed') !== 'on') {
      state = { ...state, looperAgentWallet: { ...state.looperAgentWallet, error: 'Explicit transfer confirmation is required.' } };
      render(root, state, handlers);
      return;
    }
    try {
      const asset = String(data.get('asset') ?? 'ETH');
      const recipient = String(data.get('recipient') ?? '').trim();
      const amount = String(data.get('amount') ?? '').trim();
      let prepared;
      if (asset === 'ETH') {
        prepared = await activeLooperWalletController.prepareEthSend({
          recipient,
          amountWei: parseUnits(amount, 18).toString(),
        });
      } else {
        const token = CONFIGURED_TOKENS.find((entry) => entry.address.toLowerCase() === asset.toLowerCase());
        if (!token) throw new Error('Selected token is not configured for this Looper wallet.');
        prepared = await activeLooperWalletController.prepareErc20Send({
          token: token.address,
          recipient,
          amountBaseUnits: parseUnits(amount, token.decimals).toString(),
        });
      }
      state = { ...state, looperAgentWallet: { ...activeLooperWalletController.getSnapshot(), error: null } };
      render(root, state, handlers);
      const walletState = await activeLooperWalletController.submitPrepared(prepared.id, { confirmed: true });
      state = { ...state, looperAgentWallet: { ...walletState, error: null } };
    } catch (error) {
      state = { ...state, looperAgentWallet: { ...activeLooperWalletController.getSnapshot(), error: getSafeConsoleError(error, { phase: 'wallet' }) } };
    }
    render(root, state, handlers);
  }

  async function loadPantheonCredRegistry() {
    const apiBase = getApiBaseFromLocation(new URL(window.location.href));
    const response = await (fetchImpl ?? globalThis.fetch)(`${apiBase}/api/multipass/console/pantheon/cred`, {
      method: 'GET', headers: { accept: 'application/json' }, credentials: 'omit', redirect: 'error',
    });
    if (!response.ok) throw new Error('Pantheon registry is unavailable.');
    return validatePantheonCredRegistry(await response.json());
  }

  function setPantheonCredState(pantheonCred, walletState = state.looperAgentWallet) {
    state = { ...state, looperAgentWallet: { ...walletState, pantheonCred } };
    render(root, state, handlers);
  }

  function createPantheonCredContext() {
    const wallet = state.looperAgentWallet ?? {};
    if (!wallet.tokenId || !wallet.account || !wallet.owner) throw new Error('Select an active Looper wallet first.');
    return {
      tokenId: String(wallet.tokenId),
      account: String(wallet.account).toLowerCase(),
      owner: String(wallet.owner).toLowerCase(),
      sessionGeneration: state.consoleSessionGeneration,
    };
  }

  function requirePantheonCredContext(context) {
    const wallet = state.looperAgentWallet ?? {};
    if (context.sessionGeneration !== state.consoleSessionGeneration
      || context.tokenId !== String(wallet.tokenId ?? '')
      || context.account !== String(wallet.account ?? '').toLowerCase()
      || context.owner !== String(wallet.owner ?? '').toLowerCase()) {
      throw new Error('Selected Looper changed. Check staking again.');
    }
  }

  async function readCurrentPantheonCredState(context) {
    requirePantheonCredContext(context);
    if (typeof activePantheonCredReader !== 'function') throw new Error('Pantheon staking reads are unavailable.');
    const result = await activePantheonCredReader({ account: context.account, gasPayer: context.owner });
    requirePantheonCredContext(context);
    if (String(result?.account ?? '').toLowerCase() !== context.account) {
      throw new Error('Pantheon staking state is not bound to this Looper wallet.');
    }
    return result;
  }

  async function loadPantheonCred() {
    const context = createPantheonCredContext();
    setPantheonCredState({ status: 'loading' });
    try {
      await loadPantheonCredRegistry();
      requirePantheonCredContext(context);
      const onchain = await readCurrentPantheonCredState(context);
      const hasStake = BigInt(onchain.stakeAmountBaseUnits) > 0n;
      const resumableApproval = !hasStake && onchain.poolActive
        && BigInt(onchain.allowanceBaseUnits) > 0n
        && BigInt(onchain.allowanceBaseUnits) <= BigInt(onchain.credBalanceBaseUnits);
      const status = hasStake
        ? isCredTopUpEligible(onchain) ? 'staked' : 'staked_ineligible'
        : resumableApproval ? 'approved' : onchain.poolActive ? 'ready' : 'inactive';
      setPantheonCredState({
        ...onchain,
        status,
        ...(resumableApproval ? { amountBaseUnits: onchain.allowanceBaseUnits } : {}),
        ...(hasStake ? { dates: createCredStakeDatesFromMonthIndex(onchain.stakeMonthIndex) } : {}),
      });
    } catch (error) {
      try { requirePantheonCredContext(context); } catch { return; }
      const inactive = /not active|exactly one CRED/i.test(String(error?.message ?? ''));
      setPantheonCredState({ status: inactive ? 'inactive' : 'error', error: inactive ? null : 'Pantheon staking status could not be verified.' });
    }
  }

  async function approvePantheonCred(event) {
    event?.preventDefault?.();
    const data = createFormData(event?.currentTarget);
    if (data.get('confirmed') !== 'on') return setPantheonCredState({ status: 'error', error: 'Explicit approval confirmation is required.' });
    const context = createPantheonCredContext();
    try {
      const amountBaseUnits = parseUnits(String(data.get('amount') ?? '').trim(), 18).toString();
      if (BigInt(amountBaseUnits) <= 0n) throw new Error('CRED amount must be positive.');
      await loadPantheonCredRegistry();
      requirePantheonCredContext(context);
      const before = await readCurrentPantheonCredState(context);
      if (!before.poolActive) throw new Error('CRED staking is not active onchain.');
      if (BigInt(before.stakeAmountBaseUnits) > 0n && !isCredTopUpEligible(before)) {
        throw new Error('This Pantheon position cannot accept more CRED because it is exiting or has reached its final earning month.');
      }
      if (BigInt(before.credBalanceBaseUnits) < BigInt(amountBaseUnits)) throw new Error('Looper wallet CRED balance is too low.');
      if (BigInt(before.gasPayerNativeWei) <= 0n) throw new Error('Owner wallet needs Base ETH for gas.');
      const prepared = await activeLooperWalletController.prepareCredStakeApproval({ amountBaseUnits });
      await activeLooperWalletController.preflightPrepared(prepared.id, { confirmed: true });
      requirePantheonCredContext(context);
      setPantheonCredState({
        ...before,
        status: 'approval_prepared',
        amountBaseUnits,
        preparedId: prepared.id,
        dates: BigInt(before.stakeAmountBaseUnits) > 0n
          ? createCredStakeDatesFromMonthIndex(before.stakeMonthIndex)
          : createCredStakeDates(),
      }, activeLooperWalletController.getSnapshot());
    } catch (error) {
      try { requirePantheonCredContext(context); } catch { return; }
      setPantheonCredState(
        { status: 'error', error: getSafeConsoleError(error, { phase: 'wallet' }) },
        activeLooperWalletController.getSnapshot(),
      );
    }
  }

  function submitPantheonCredApproval(event) {
    event?.preventDefault?.();
    const data = createFormData(event?.currentTarget);
    if (data.get('confirmed') !== 'on') return setPantheonCredState({ status: 'error', error: 'Final approval confirmation is required.' });
    const context = createPantheonCredContext();
    const preparedState = state.looperAgentWallet?.pantheonCred ?? {};
    const amountBaseUnits = String(preparedState.amountBaseUnits ?? '');
    const preparedId = String(preparedState.preparedId ?? '');
    if (preparedState.status !== 'approval_prepared' || !/^[1-9]\d*$/.test(amountBaseUnits)
      || !/^send:[A-Za-z0-9_-]{8,128}$/.test(preparedId)) {
      return setPantheonCredState({ status: 'error', error: 'Prepared CRED approval is invalid. Check staking again.' });
    }
    const submission = activeLooperWalletController.submitPreflighted(preparedId, { confirmed: true });
    setPantheonCredState({ ...state.looperAgentWallet?.pantheonCred, status: 'approval_submitting' });
    submission.then(async (walletState) => {
      requirePantheonCredContext(context);
      const after = await readCurrentPantheonCredState(context);
      if (BigInt(after.allowanceBaseUnits) !== BigInt(amountBaseUnits)) throw new Error('Exact CRED allowance was not confirmed.');
      if (BigInt(after.stakeAmountBaseUnits) > 0n && !isCredTopUpEligible(after)) {
        throw new Error('The Pantheon position can no longer accept additional CRED.');
      }
      setPantheonCredState({
        ...after,
        status: 'approved',
        amountBaseUnits,
        dates: BigInt(after.stakeAmountBaseUnits) > 0n
          ? createCredStakeDatesFromMonthIndex(after.stakeMonthIndex)
          : createCredStakeDates(),
      }, walletState);
    }).catch((error) => {
      try { requirePantheonCredContext(context); } catch { return; }
      setPantheonCredState(
        { status: 'error', error: getSafeConsoleError(error, { phase: 'wallet' }) },
        activeLooperWalletController.getSnapshot(),
      );
    });
  }

  async function stakePantheonCred(event) {
    event?.preventDefault?.();
    const data = createFormData(event?.currentTarget);
    if (data.get('confirmed') !== 'on') return setPantheonCredState({ status: 'error', error: 'Explicit stake confirmation is required.' });
    const context = createPantheonCredContext();
    try {
      const approvedState = state.looperAgentWallet?.pantheonCred ?? {};
      const amountBaseUnits = String(approvedState.amountBaseUnits ?? '');
      if (approvedState.status !== 'approved' || !/^[1-9]\d*$/.test(amountBaseUnits)) {
        throw new Error('Approved CRED amount is invalid.');
      }
      await loadPantheonCredRegistry();
      requirePantheonCredContext(context);
      const before = await readCurrentPantheonCredState(context);
      if (BigInt(before.stakeAmountBaseUnits) > 0n && !isCredTopUpEligible(before)) {
        throw new Error('This Pantheon position cannot accept more CRED because it is exiting or has reached its final earning month.');
      }
      if (!before.poolActive || BigInt(before.allowanceBaseUnits) !== BigInt(amountBaseUnits)
        || BigInt(before.credBalanceBaseUnits) < BigInt(amountBaseUnits)
        || BigInt(before.gasPayerNativeWei) <= 0n) {
        throw new Error('Pantheon stake conditions changed. Check staking again.');
      }
      const prepared = BigInt(before.stakeAmountBaseUnits) > 0n
        ? await activeLooperWalletController.prepareCredAddToStake({ amountBaseUnits })
        : await activeLooperWalletController.prepareCredStake({ amountBaseUnits });
      await activeLooperWalletController.preflightPrepared(prepared.id, { confirmed: true });
      requirePantheonCredContext(context);
      setPantheonCredState({
        ...before,
        status: 'stake_prepared',
        amountBaseUnits,
        preparedId: prepared.id,
        stakeBaselineBaseUnits: before.stakeAmountBaseUnits,
        stakeBaselineMonthIndex: before.stakeMonthIndex,
        dates: BigInt(before.stakeAmountBaseUnits) > 0n
          ? createCredStakeDatesFromMonthIndex(before.stakeMonthIndex)
          : createCredStakeDates(),
      });
    } catch (error) {
      try { requirePantheonCredContext(context); } catch { return; }
      setPantheonCredState(
        { status: 'error', error: getSafeConsoleError(error, { phase: 'wallet' }) },
        activeLooperWalletController.getSnapshot(),
      );
    }
  }

  function submitPantheonCredStake(event) {
    event?.preventDefault?.();
    const data = createFormData(event?.currentTarget);
    if (data.get('confirmed') !== 'on') return setPantheonCredState({ status: 'error', error: 'Final stake confirmation is required.' });
    const context = createPantheonCredContext();
    const preparedState = state.looperAgentWallet?.pantheonCred ?? {};
    const amountBaseUnits = String(preparedState.amountBaseUnits ?? '');
    const preparedId = String(preparedState.preparedId ?? '');
    const stakeBaselineBaseUnits = String(preparedState.stakeBaselineBaseUnits ?? '');
    const stakeBaselineMonthIndex = String(preparedState.stakeBaselineMonthIndex ?? '');
    if (preparedState.status !== 'stake_prepared' || !/^[1-9]\d*$/.test(amountBaseUnits)
      || !/^(0|[1-9]\d*)$/.test(stakeBaselineBaseUnits)
      || (BigInt(stakeBaselineBaseUnits) > 0n && !/^(0|[1-9]\d*)$/.test(stakeBaselineMonthIndex))
      || !/^send:[A-Za-z0-9_-]{8,128}$/.test(preparedId)) {
      return setPantheonCredState({ status: 'error', error: 'Prepared CRED stake is invalid. Check staking again.' });
    }
    const submission = activeLooperWalletController.submitPreflighted(preparedId, { confirmed: true });
    setPantheonCredState({ ...state.looperAgentWallet?.pantheonCred, status: 'stake_submitting' });
    submission.then(async (walletState) => {
      requirePantheonCredContext(context);
      const after = await readCurrentPantheonCredState(context);
      const attributed = BigInt(stakeBaselineBaseUnits) > 0n
        ? isCredTopUpAttributed({
          stakeBaselineBaseUnits,
          amountBaseUnits,
          afterStakeAmountBaseUnits: after.stakeAmountBaseUnits,
          stakeBaselineMonthIndex,
          afterStakeMonthIndex: after.stakeMonthIndex,
        })
        : BigInt(after.stakeAmountBaseUnits) === BigInt(amountBaseUnits);
      if (!attributed) throw new Error('Pantheon stake position or lock anchor could not be attributed exactly.');
      setPantheonCredState({
        ...after,
        status: 'staked',
        amountBaseUnits: null,
        preparedId: null,
        dates: createCredStakeDatesFromMonthIndex(after.stakeMonthIndex),
      }, walletState);
    }).catch((error) => {
      try { requirePantheonCredContext(context); } catch { return; }
      setPantheonCredState(
        { status: 'error', error: getSafeConsoleError(error, { phase: 'wallet' }) },
        activeLooperWalletController.getSnapshot(),
      );
    });
  }

  async function acknowledgeLooperWalletOutcome(event) {
    const kind = String(event?.currentTarget?.dataset?.attemptKind ?? '');
    try {
      const walletState = await activeLooperWalletController.acknowledgeUnknown(kind);
      state = { ...state, looperAgentWallet: { ...walletState, error: null } };
    } catch (error) {
      state = {
        ...state,
        looperAgentWallet: { ...activeLooperWalletController.getSnapshot(), error: getSafeConsoleError(error, { phase: 'wallet' }) },
      };
    }
    render(root, state, handlers);
  }

  async function setLooperPolicyModule(event) {
    event?.preventDefault?.();
    const data = createFormData(event?.currentTarget);
    if (data.get('confirmed') !== 'on') {
      state = {
        ...state,
        looperAgentWallet: { ...state.looperAgentWallet, error: 'Explicit permission module confirmation is required.' },
      };
      render(root, state, handlers);
      return;
    }
    try {
      const module = String(data.get('module') ?? '').trim() || ZERO_ADDRESS;
      const prepared = await activeLooperWalletController.preparePolicyModule({ module });
      state = { ...state, looperAgentWallet: { ...activeLooperWalletController.getSnapshot(), error: null } };
      render(root, state, handlers);
      const walletState = await activeLooperWalletController.submitPrepared(prepared.id, { confirmed: true });
      state = { ...state, looperAgentWallet: { ...walletState, error: null } };
    } catch (error) {
      state = {
        ...state,
        looperAgentWallet: { ...activeLooperWalletController.getSnapshot(), error: getSafeConsoleError(error, { phase: 'wallet' }) },
      };
    }
    render(root, state, handlers);
  }

  async function selectConsoleAgent(event) {
    const selector = event?.currentTarget;
    if (state.consoleAgentNameMutation?.status === 'pending') return;
    if (hasSelectedLooperWalletWork(state)) {
      render(root, state, handlers);
      return;
    }
    const tokenId = String(selector?.value ?? '').trim() || null;
    if (!tokenId || tokenId === state.consoleSelectedAgentId) {
      selector?.blur?.();
      return;
    }
    deferredConsoleRenders.delete(root);
    selector?.blur?.();
    return selectConsoleAgentById(tokenId);
  }

  function setConsoleWorkspaceView(event) {
    const view = String(event?.currentTarget?.dataset?.consoleView ?? '').trim();
    if (!['chat', 'wallet', 'multipass', 'codex', 'network', 'credit', 'missions'].includes(view)) return;
    if (view !== 'missions' && !state.consoleSelectedAgentId) return;
    state = { ...state, consoleWorkspaceView: view };
    render(root, state, handlers);
    if (view === 'missions' && ['idle', 'disabled', 'error'].includes(state.consoleMissions?.status)) void loadConsoleMissions();
    if (view === 'credit' && ['idle', 'error', 'blocked'].includes(state.consoleCredit?.status)) void refreshCredifiOwnerOptIn();
  }

  async function refreshCredifiOwnerOptIn() {
    if (typeof activeConsoleCreditApi.optInStatus !== 'function') return refreshConsoleCredit();
    let context;
    try { context = createConsoleCreditContext(); } catch (error) {
      state = { ...state, consoleCredit: { ...state.consoleCredit, status: 'idle', optIn: { status: 'error', record: null, error: error.message } } };
      render(root, state, handlers);
      return;
    }
    consoleCreditAbortController?.abort();
    const controller = new AbortController();
    consoleCreditAbortController = controller;
    state = { ...state, consoleCredit: { ...state.consoleCredit, status: 'idle', optIn: { status: 'loading', record: null, error: null } } };
    render(root, state, handlers);
    try {
      const record = await activeConsoleCreditApi.optInStatus({ tokenId: context.tokenId, signal: controller.signal });
      if (!isCurrentConsoleCreditContext(context) || controller.signal.aborted) return;
      state = { ...state, consoleCredit: { ...state.consoleCredit, status: 'idle', optIn: { status: record.status === 'opted_in' ? 'opted_in' : 'eligible', record, error: null } } };
    } catch (error) {
      if (!isCurrentConsoleCreditContext(context) || error?.name === 'AbortError') return;
      if (error?.status === 404 || error?.code === 'credifi_pilot_not_eligible') {
        state = { ...state, consoleCredit: { ...state.consoleCredit, optIn: { status: 'unavailable', record: null, error: null } } };
        consoleCreditAbortController = null;
        return refreshConsoleCredit();
      }
      state = { ...state, consoleCredit: { ...state.consoleCredit, status: 'idle', optIn: { status: 'error', record: null, error: getConsoleCreditErrorMessage(error) } } };
    } finally {
      if (consoleCreditAbortController === controller) consoleCreditAbortController = null;
      if (isCurrentConsoleCreditContext(context)) render(root, state, handlers);
    }
  }

  async function submitCredifiOwnerOptIn() {
    const context = createConsoleCreditContext();
    if (state.consoleCredit?.optIn?.status !== 'eligible' || typeof activeConsoleCreditApi.submitOptIn !== 'function') return;
    consoleCreditAbortController?.abort();
    const controller = new AbortController();
    consoleCreditAbortController = controller;
    state = { ...state, consoleCredit: { ...state.consoleCredit, status: 'idle', optIn: { ...state.consoleCredit.optIn, status: 'submitting', error: null } } };
    render(root, state, handlers);
    try {
      const record = await activeConsoleCreditApi.submitOptIn({ tokenId: context.tokenId, csrfToken: context.csrfToken, signal: controller.signal });
      if (!isCurrentConsoleCreditContext(context) || controller.signal.aborted) return;
      state = { ...state, consoleCredit: { ...state.consoleCredit, status: 'idle', optIn: { status: 'opted_in', record, error: null } } };
    } catch (error) {
      if (!isCurrentConsoleCreditContext(context) || error?.name === 'AbortError') return;
      state = { ...state, consoleCredit: { ...state.consoleCredit, status: 'idle', optIn: { ...state.consoleCredit.optIn, status: 'error', error: getConsoleCreditErrorMessage(error) } } };
    } finally {
      if (consoleCreditAbortController === controller) consoleCreditAbortController = null;
      if (isCurrentConsoleCreditContext(context)) render(root, state, handlers);
    }
  }

  function createConsoleCreditContext() {
    const tokenId = String(state.consoleSelectedAgentId ?? '').trim();
    const csrfToken = String(state.consoleCsrfToken ?? '').trim();
    const wallet = normalizeConsoleWalletKey(state.consoleAuthenticatedWallet);
    if (!tokenId || !csrfToken || !wallet) throw new Error('Authenticate the Console wallet and select a Looper first.');
    return { tokenId, csrfToken, wallet, sessionGeneration: state.consoleSessionGeneration };
  }

  function isCurrentConsoleCreditContext(context) {
    return context.sessionGeneration === state.consoleSessionGeneration
      && context.tokenId === String(state.consoleSelectedAgentId ?? '').trim()
      && context.wallet === normalizeConsoleWalletKey(state.consoleAuthenticatedWallet);
  }

  function beginConsoleCreditOperation(status, patch = {}) {
    consoleCreditAbortController?.abort();
    const controller = new AbortController();
    consoleCreditAbortController = controller;
    state = { ...state, consoleCredit: { ...state.consoleCredit, status, error: null, notice: null, ...patch } };
    render(root, state, handlers);
    return controller;
  }

  function failConsoleCredit(error, context) {
    if (!isCurrentConsoleCreditContext(context) || error?.name === 'AbortError') return;
    if (error?.code === 'credifi_login_required') {
      state = { ...state, consoleCredit: { ...createInitialConsoleCreditState(context.tokenId), status: 'login_required' } };
    } else if (['cred_gate_failed', 'cred_expired', 'cred_not_current'].includes(error?.code)) {
      state = { ...state, consoleCredit: { ...createInitialConsoleCreditState(context.tokenId), status: 'blocked', error: String(error?.message ?? 'This Looper is not eligible for the credit beta.'), details: error?.details ?? null } };
    } else {
      state = { ...state, consoleCredit: { ...state.consoleCredit, status: 'error', error: getConsoleCreditErrorMessage(error) } };
    }
    render(root, state, handlers);
  }

  async function refreshConsoleCredit({ notice = null } = {}) {
    let context;
    try { context = createConsoleCreditContext(); } catch (error) {
      state = { ...state, consoleCredit: { ...state.consoleCredit, status: 'error', error: error.message } };
      render(root, state, handlers);
      return;
    }
    const controller = beginConsoleCreditOperation('loading');
    try {
      const overview = await activeConsoleCreditApi.overview({ tokenId: context.tokenId, csrfToken: context.csrfToken, signal: controller.signal });
      if (!isCurrentConsoleCreditContext(context) || controller.signal.aborted) return;
      state = { ...state, consoleCredit: { ...state.consoleCredit, status: 'ready', selectedTokenId: context.tokenId, overview, authorization: null, quote: null, error: null, notice } };
    } catch (error) {
      failConsoleCredit(error, context);
    } finally {
      if (consoleCreditAbortController === controller) consoleCreditAbortController = null;
      if (isCurrentConsoleCreditContext(context)) render(root, state, handlers);
    }
  }

  async function loginConsoleCredit() {
    const context = createConsoleCreditContext();
    const controller = beginConsoleCreditOperation('signing');
    try {
      const challenge = await activeConsoleCreditApi.challenge({ tokenId: context.tokenId, csrfToken: context.csrfToken, signal: controller.signal });
      if (!isCurrentConsoleCreditContext(context) || controller.signal.aborted) return;
      const account = String(state.looperAgentWallet?.account ?? '').toLowerCase();
      if (!/^0x[0-9a-f]{40}$/u.test(account) || account !== String(challenge.account ?? '').toLowerCase()) throw new Error('Credifi challenge account does not match the selected Looper.');
      const signed = await activeWalletClient.signMessage(challenge.message);
      if (!isCurrentConsoleCreditContext(context) || controller.signal.aborted) return;
      await activeConsoleCreditApi.verify({ tokenId: context.tokenId, signature: signed.signature, csrfToken: context.csrfToken, signal: controller.signal });
      if (!isCurrentConsoleCreditContext(context) || controller.signal.aborted) return;
      consoleCreditAbortController = null;
      return refreshConsoleCredit({ notice: 'Credifi session established for this Looper.' });
    } catch (error) {
      failConsoleCredit(error, context);
    } finally {
      if (consoleCreditAbortController === controller) consoleCreditAbortController = null;
    }
  }

  async function acceptConsoleCreditVouch(commitmentId) {
    const context = createConsoleCreditContext();
    const controller = beginConsoleCreditOperation('mutating');
    try {
      await activeConsoleCreditApi.acceptVouch({ tokenId: context.tokenId, commitmentId: String(commitmentId), csrfToken: context.csrfToken, signal: controller.signal });
      if (!isCurrentConsoleCreditContext(context) || controller.signal.aborted) return;
      consoleCreditAbortController = null;
      return refreshConsoleCredit({ notice: 'Vouch accepted. No permission was granted and no funds were borrowed.' });
    } catch (error) { failConsoleCredit(error, context); }
    finally { if (consoleCreditAbortController === controller) consoleCreditAbortController = null; }
  }

  async function prepareConsoleCreditAuthorization(commitmentId) {
    const context = createConsoleCreditContext();
    const controller = beginConsoleCreditOperation('authorizing');
    try {
      const prepared = await activeConsoleCreditApi.prepareAuthorization({ tokenId: context.tokenId, commitmentId: String(commitmentId), csrfToken: context.csrfToken, signal: controller.signal });
      if (!isCurrentConsoleCreditContext(context) || controller.signal.aborted) return;
      state = { ...state, consoleCredit: { ...state.consoleCredit, status: 'ready', authorization: { ...prepared, commitmentId: String(commitmentId) }, error: null, notice: prepared.required ? null : 'Credifi authorization is already active for this vault.' } };
      render(root, state, handlers);
    } catch (error) { failConsoleCredit(error, context); }
    finally { if (consoleCreditAbortController === controller) consoleCreditAbortController = null; }
  }

  async function submitConsoleCreditAuthorization() {
    const context = createConsoleCreditContext();
    const prepared = state.consoleCredit?.authorization;
    if (!prepared?.required || prepared.scope !== 'ALL_EVC_SUBACCOUNTS_FOR_WALLET_PREFIX') return;
    const transaction = prepared.transaction;
    const looperAccount = String(state.looperAgentWallet?.account ?? '').toLowerCase();
    if (!transaction || String(transaction.from ?? '').toLowerCase() !== context.wallet || String(transaction.to ?? '').toLowerCase() !== looperAccount || String(transaction.value) !== '0') {
      return failConsoleCredit(new Error('Prepared authorization no longer matches this wallet and Looper.'), context);
    }
    const controller = beginConsoleCreditOperation('authorizing', { authorization: prepared });
    try {
      const refreshed = await activeConsoleCreditApi.prepareAuthorization({ tokenId: context.tokenId, commitmentId: prepared.commitmentId, csrfToken: context.csrfToken, signal: controller.signal });
      if (!isCurrentConsoleCreditContext(context) || controller.signal.aborted) return;
      if (!refreshed.required) {
        consoleCreditAbortController = null;
        return refreshConsoleCredit({ notice: 'Credifi authorization is already active for this vault.' });
      }
      const reviewedShape = ({ scope, operator, evc, accountPrefix, operatorBitField, transaction: value }) => JSON.stringify({ scope, operator, evc, accountPrefix, operatorBitField, transaction: value });
      if (reviewedShape(refreshed) !== reviewedShape(prepared)) {
        state = { ...state, consoleCredit: { ...state.consoleCredit, status: 'ready', authorization: { ...refreshed, commitmentId: prepared.commitmentId }, error: null, notice: 'Authorization configuration changed. Review the refreshed permission before signing.' } };
        render(root, state, handlers);
        return;
      }
      const authorizationExpiresAt = Date.parse(String(refreshed.expiresAt ?? ''));
      if (!Number.isFinite(authorizationExpiresAt) || authorizationExpiresAt <= Date.now()) throw new Error('Prepared authorization expired before wallet submission.');
      const freshTransaction = refreshed.transaction;
      if (!freshTransaction || String(freshTransaction.from ?? '').toLowerCase() !== context.wallet || String(freshTransaction.to ?? '').toLowerCase() !== looperAccount || String(freshTransaction.value) !== '0') throw new Error('Fresh authorization no longer matches this wallet and Looper.');
      const chainId = String(await activeWalletClient.request({ method: 'eth_chainId' })).toLowerCase();
      if (chainId !== '0x2105') await activeWalletClient.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x2105' }] });
      const transactionHash = await activeWalletClient.request({ method: 'eth_sendTransaction', params: [{ from: freshTransaction.from, to: freshTransaction.to, data: freshTransaction.data, value: '0x0' }] });
      if (!/^0x[0-9a-f]{64}$/iu.test(String(transactionHash ?? ''))) throw new Error('Wallet did not return an authorization transaction hash.');
      if (!isCurrentConsoleCreditContext(context) || controller.signal.aborted) return;
      state = { ...state, consoleCredit: { ...state.consoleCredit, status: 'ready', authorization: null, quote: null, error: null, notice: 'Authorization submitted on Base: ' + shortConsoleHash(transactionHash) + '. Refresh after confirmation.' } };
      render(root, state, handlers);
    } catch (error) { failConsoleCredit(new Error(getWalletErrorMessage(error)), context); }
    finally { if (consoleCreditAbortController === controller) consoleCreditAbortController = null; }
  }

  async function requestConsoleCreditTwoFactor(channel) {
    const context = createConsoleCreditContext();
    const controller = beginConsoleCreditOperation('mutating');
    try {
      await activeConsoleCreditApi.requestTwoFactor({ tokenId: context.tokenId, channel: String(channel), csrfToken: context.csrfToken, signal: controller.signal });
      if (!isCurrentConsoleCreditContext(context) || controller.signal.aborted) return;
      state = { ...state, consoleCredit: { ...state.consoleCredit, status: 'ready', notice: 'Credifi sent a new ' + String(channel) + ' verification code.' } };
      render(root, state, handlers);
    } catch (error) { failConsoleCredit(error, context); }
    finally { if (consoleCreditAbortController === controller) consoleCreditAbortController = null; }
  }

  async function verifyConsoleCreditTwoFactor(code) {
    const context = createConsoleCreditContext();
    const controller = beginConsoleCreditOperation('mutating');
    try {
      await activeConsoleCreditApi.verifyTwoFactor({ tokenId: context.tokenId, code: String(code ?? '').trim(), csrfToken: context.csrfToken, signal: controller.signal });
      if (!isCurrentConsoleCreditContext(context) || controller.signal.aborted) return;
      consoleCreditAbortController = null;
      return refreshConsoleCredit({ notice: 'Credifi loan verification completed.' });
    } catch (error) { failConsoleCredit(error, context); }
    finally { if (consoleCreditAbortController === controller) consoleCreditAbortController = null; }
  }

  async function previewConsoleCredit({ commitmentId, amount, maxAprPercent }) {
    const context = createConsoleCreditContext();
    const numericAmount = Number(amount);
    const numericApr = Number(maxAprPercent);
    const controller = beginConsoleCreditOperation('quoting', { amount: String(amount), maxAprPercent: String(maxAprPercent), quote: null });
    try {
      const preview = await activeConsoleCreditApi.preview({ tokenId: context.tokenId, commitmentId: String(commitmentId), amount: numericAmount, maxAprPercent: numericApr, csrfToken: context.csrfToken, signal: controller.signal });
      if (!isCurrentConsoleCreditContext(context) || controller.signal.aborted) return;
      state = { ...state, consoleCredit: { ...state.consoleCredit, status: 'ready', quote: { ...preview, status: 'reviewed' }, authorization: null, error: null, notice: 'Live quote loaded. Review every term before borrowing.' } };
      render(root, state, handlers);
    } catch (error) { failConsoleCredit(error, context); }
    finally { if (consoleCreditAbortController === controller) consoleCreditAbortController = null; }
  }

  async function borrowConsoleCredit({ confirmed }) {
    const context = createConsoleCreditContext();
    const preview = state.consoleCredit?.quote;
    if (!confirmed || !preview?.quote?.quoteId || !preview?.quoteSha256 || !preview?.commitment?.id) {
      state = { ...state, consoleCredit: { ...state.consoleCredit, status: 'ready', error: 'Review the live quote and confirm the exact terms before borrowing.' } };
      render(root, state, handlers);
      return;
    }
    const controller = beginConsoleCreditOperation('borrowing', { quote: { ...preview, status: 'borrowing' } });
    try {
      const result = await activeConsoleCreditApi.borrow({ tokenId: context.tokenId, commitmentId: preview.commitment.id, quoteId: preview.quote.quoteId, quoteSha256: preview.quoteSha256, confirmBorrow: true, csrfToken: context.csrfToken, signal: controller.signal });
      if (!isCurrentConsoleCreditContext(context) || controller.signal.aborted) return;
      consoleCreditAbortController = null;
      return refreshConsoleCredit({ notice: 'Loan ' + String(result.loan?.id ?? '') + ' submitted. Credifi confirmed the reviewed Looper, Base USDC market, and recipient binding.' });
    } catch (error) {
      if (error?.code === 'loan_creation_indeterminate' && isCurrentConsoleCreditContext(context)) {
        consoleCreditAbortController = null;
        return refreshConsoleCredit({ notice: 'Borrow result is uncertain. Loan state was refreshed and new borrowing is locked pending operator reconciliation.' });
      }
      failConsoleCredit(error, context);
    }
    finally { if (consoleCreditAbortController === controller) consoleCreditAbortController = null; }
  }

  function getConsoleCreditErrorMessage(error) {
    if (error?.status === 404) return 'Console credit is not enabled on this deployment.';
    if (error?.status === 429) return 'Credit requests are temporarily rate limited. Wait and retry.';
    if (error?.code === 'loan_creation_indeterminate') return 'Borrow result is uncertain. Review the refreshed loan list before any retry.';
    return String(error?.message ?? 'Console credit is temporarily unavailable.').slice(0, 512);
  }

  function shortConsoleHash(value) {
    const text = String(value ?? '');
    return text.length > 18 ? text.slice(0, 10) + '…' + text.slice(-8) : text;
  }

  async function loadConsoleMissions(filter = state.consoleMissions?.filter ?? null) {
    consoleMissionAbortController?.abort();
    const controller = new AbortController();
    consoleMissionAbortController = controller;
    state = { ...state, consoleMissions: { ...state.consoleMissions, status: 'loading', view: 'board', filter, error: null } };
    render(root, state, handlers);
    try {
      const page = await activeMissionApi.listPublic({ state: filter, limit: 100, signal: controller.signal });
      if (controller.signal.aborted) return;
      state = { ...state, consoleMissions: { status: 'loaded', view: 'board', filter, missions: page.missions ?? [], nextCursor: page.nextCursor ?? null, error: null } };
    } catch (error) {
      if (controller.signal.aborted) return;
      state = { ...state, consoleMissions: { ...state.consoleMissions, status: 'error', view: 'board', error: getMissionErrorMessage(error) } };
    } finally {
      if (consoleMissionAbortController === controller) consoleMissionAbortController = null;
      render(root, state, handlers);
    }
  }

  async function openConsoleMission(missionId) {
    state = { ...state, consoleMissions: { ...state.consoleMissions, status: 'loading', view: 'board', error: null } };
    render(root, state, handlers);
    try {
      const response = await activeMissionApi.getPublic({ missionId });
      state = { ...state, consoleMissions: { ...state.consoleMissions, status: 'loaded', view: 'detail', mission: response.mission, error: null } };
    } catch (error) {
      state = { ...state, consoleMissions: { ...state.consoleMissions, status: 'error', view: 'board', error: getMissionErrorMessage(error) } };
    }
    render(root, state, handlers);
  }

  function openConsoleLaunchpad() {
    const agents = Array.isArray(state.consoleOwnedAgents?.agents) ? state.consoleOwnedAgents.agents : [];
    const requestedIds = [...new Set([state.consoleSelectedAgentId, ...(state.consoleParticipantAgentIds ?? [])].filter(Boolean).map(String))].slice(0, 5);
    const selected = requestedIds.map((tokenId) => agents.find((agent) => String(agent?.tokenId ?? '') === tokenId)).filter(Boolean);
    const baseWeight = selected.length ? Math.floor(10000 / selected.length) : 0;
    let remainder = selected.length ? 10000 - (baseWeight * selected.length) : 0;
    const members = selected.map((agent) => {
      const contributionBps = baseWeight + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder -= 1;
      const explicitAgentId = String(agent?.erc8004AgentId ?? '').trim();
      const canonicalAgentId = String(agent?.intuition?.canonicalAgentId ?? agent?.erc8004Id ?? (/^[1-9]\d*$/u.test(explicitAgentId) ? '8453:' + explicitAgentId : '')).trim();
      return {
        tokenId: String(agent.tokenId),
        ownerAddress: String(agent.owner ?? state.consoleAuthenticatedWallet ?? '').toLowerCase(),
        name: String(agent.name ?? ('Looper #' + agent.tokenId)),
        role: String(agent.role ?? agent.framework ?? 'Swarm member'),
        contributionBps,
        cred: agent.cred ?? null,
        erc8004Id: /^\d+:\d+$/u.test(canonicalAgentId) ? canonicalAgentId : null,
      };
    });
    state = {
      ...state,
      consoleMissions: { ...state.consoleMissions, status: 'loaded', view: 'launchpad', error: null },
      consoleLaunchpad: {
        status: 'editing',
        requestId: (state.consoleLaunchpad?.requestId ?? 0) + 1,
        draft: {
          members,
          app: { name: '', pitch: '', template: 'web_app', revenueModel: 'subscription', shipTarget: '30_days' },
          token: { name: '', ticker: '', supply: '1000000000', curve: 'bonding_curve_to_dex' },
          economics: { ...SWARM_LAUNCH_DEFAULT_ECONOMICS },
        },
        manifest: null,
        error: null,
      },
    };
    render(root, state, handlers);
    void refreshConsoleInvitationInbox(state.consoleLaunchpad.requestId);
  }

  function captureConsoleInvitationContext(requestId = state.consoleLaunchpad?.requestId) {
    return {
      requestId,
      sessionGeneration: state.consoleSessionGeneration,
      wallet: String(state.consoleAuthenticatedWallet ?? '').toLowerCase(),
    };
  }

  function isCurrentConsoleInvitationContext(context) {
    return Boolean(context?.wallet)
      && context.wallet === String(state.consoleAuthenticatedWallet ?? '').toLowerCase()
      && context.sessionGeneration === state.consoleSessionGeneration
      && context.requestId === state.consoleLaunchpad?.requestId
      && state.consoleMissions?.view === 'launchpad';
  }

  function beginConsoleInvitationMutation() {
    consoleInvitationInboxAbortController?.abort();
    consoleInvitationInboxAbortController = null;
    const requestId = Number(state.consoleLaunchpad?.requestId ?? 0) + 1;
    state = { ...state, consoleLaunchpad: { ...state.consoleLaunchpad, requestId } };
    return captureConsoleInvitationContext(requestId);
  }

  async function refreshConsoleInvitationInbox(requestId) {
    if (!state.consoleAuthenticatedWallet || typeof activeMissionApi.getSwarmInvitationInbox !== 'function') return;
    consoleInvitationInboxAbortController?.abort();
    const controller = new AbortController();
    consoleInvitationInboxAbortController = controller;
    const context = captureConsoleInvitationContext(requestId);
    try {
      const response = await activeMissionApi.getSwarmInvitationInbox({ signal: controller.signal });
      if (controller.signal.aborted || !isCurrentConsoleInvitationContext(context)) return;
      const leadDraft = response.inbox?.leadDraft ? invitationShareLinks(response.inbox.leadDraft) : null;
      state = { ...state, consoleLaunchpad: { ...state.consoleLaunchpad, invitationDraft: leadDraft, invitationInbox: { leadDraft, invitations: response.inbox?.invitations ?? [] }, error: null } };
    } catch (error) {
      if (error?.name === 'AbortError' || controller.signal.aborted || !isCurrentConsoleInvitationContext(context)) return;
      state = { ...state, consoleLaunchpad: { ...state.consoleLaunchpad, invitationInbox: { leadDraft: null, invitations: [] }, error: String(error?.message ?? 'Invitation inbox failed.') } };
    } finally {
      if (consoleInvitationInboxAbortController === controller) consoleInvitationInboxAbortController = null;
    }
    render(root, state, handlers);
  }

  async function prepareConsoleSwarmLaunch(event) {
    let requestId = null;
    try {
      if (!state.consoleCsrfToken) throw new Error('Authenticate the Console wallet before preparing a launch.');
      const FormDataConstructor = event.currentTarget?.ownerDocument?.defaultView?.FormData ?? globalThis.FormData;
      const draft = normalizeSwarmLaunchRequestForm(new FormDataConstructor(event.currentTarget), state.consoleLaunchpad?.draft?.members ?? []);
      requestId = (state.consoleLaunchpad?.requestId ?? 0) + 1;
      state = { ...state, consoleLaunchpad: { status: 'verifying', requestId, draft, manifest: null, manifestSha256: null, error: null } };
      render(root, state, handlers);
      const response = await activeMissionApi.previewSwarmLaunch({
        csrfToken: state.consoleCsrfToken,
        body: {
          members: draft.members.map(({ tokenId, ownerAddress, role, contributionBps }) => ({ tokenId, ownerAddress, role, contributionBps })),
          app: { ...draft.app },
          token: { ...draft.token },
          economics: { agentVestingBps: draft.economics.agentVesting.allocationBps, credRewardsBps: draft.economics.credRewards.allocationBps, swarmTreasuryBps: draft.economics.swarmTreasury.allocationBps, publicDistributionBps: draft.economics.publicDistribution.allocationBps, agentCliffMonths: draft.economics.agentVesting.cliffMonths, agentVestingMonths: draft.economics.agentVesting.durationMonths },
        },
      });
      if (state.consoleLaunchpad?.requestId !== requestId || state.consoleMissions?.view !== 'launchpad') return;
      if (response.status !== 'PREPARATION_ONLY' || response.manifest?.execution?.deploymentAuthorized !== false || !/^0x[0-9a-f]{64}$/u.test(response.manifest_sha256 ?? '')) throw new Error('Launch preview response is invalid.');
      const verifiedMembers = response.manifest.members.map((member) => ({ tokenId: member.identity.tokenId, ownerAddress: member.consentAuthority, name: member.name, role: member.role, contributionBps: member.contributionBps, cred: member.cred, erc8004Id: member.identity.erc8004Id }));
      state = { ...state, consoleLaunchpad: { status: 'prepared', requestId, draft: { ...draft, members: verifiedMembers }, manifest: response.manifest, manifestSha256: response.manifest_sha256, proposal: null, consentUrl: null, error: null } };
    } catch (error) {
      if (state.consoleMissions?.view !== 'launchpad' || (requestId !== null && state.consoleLaunchpad?.requestId !== requestId)) return;
      state = { ...state, consoleLaunchpad: { ...state.consoleLaunchpad, status: 'editing', manifest: null, manifestSha256: null, error: String(error?.message ?? 'Launch manifest is invalid.') } };
    }
    render(root, state, handlers);
  }

  function addConsoleLaunchMember() {
    const members = [...(state.consoleLaunchpad?.draft?.members ?? [])];
    if (members.length >= 5) return;
    members.push({ tokenId: '', ownerAddress: '', name: 'Partner Looper', role: '', contributionBps: 0, cred: null, erc8004Id: null });
    state = { ...state, consoleLaunchpad: { ...state.consoleLaunchpad, status: 'editing', draft: { ...state.consoleLaunchpad.draft, members }, manifest: null, manifestSha256: null, proposal: null, consentUrl: null, error: null } };
    render(root, state, handlers);
  }

  function removeConsoleLaunchMember(index) {
    const members = [...(state.consoleLaunchpad?.draft?.members ?? [])];
    if (members.length <= 3 || !Number.isInteger(index) || index < 0 || index >= members.length) return;
    members.splice(index, 1);
    state = { ...state, consoleLaunchpad: { ...state.consoleLaunchpad, status: 'editing', draft: { ...state.consoleLaunchpad.draft, members }, manifest: null, manifestSha256: null, proposal: null, consentUrl: null, error: null } };
    render(root, state, handlers);
  }

  async function createConsoleInvitationDraft(form) {
    if (!state.consoleCsrfToken) return;
    const context = beginConsoleInvitationMutation();
    try {
      const lead = String(form.get('lead_token_id') ?? '').trim();
      const invitees = String(form.get('invitee_token_ids') ?? '').split(',').map((value) => value.trim()).filter(Boolean);
      const idempotencyKey = swarmDraftRetryState.keyFor({ leadTokenId: lead, inviteeTokenIds: invitees });
      const response = await activeMissionApi.createSwarmDraft({ csrfToken: state.consoleCsrfToken, body: { lead_token_id: lead, invitee_token_ids: invitees, idempotency_key: idempotencyKey } });
      if (!isCurrentConsoleInvitationContext(context)) return;
      swarmDraftRetryState.succeeded();
      const leadDraft = invitationShareLinks(response.draft);
      state = { ...state, consoleLaunchpad: { ...state.consoleLaunchpad, invitationDraft: leadDraft, invitationInbox: { leadDraft, invitations: state.consoleLaunchpad?.invitationInbox?.invitations ?? [] }, invitation: null, error: null } };
    } catch (error) { if (!isCurrentConsoleInvitationContext(context)) return; state = { ...state, consoleLaunchpad: { ...state.consoleLaunchpad, error: String(error?.message ?? 'Invitation draft failed.') } }; }
    render(root, state, handlers);
  }

  async function addConsoleInvitation(form) {
    const draftId = state.consoleLaunchpad?.invitationDraft?.draftId;
    if (!draftId || !state.consoleCsrfToken) return;
    const context = beginConsoleInvitationMutation();
    try {
      await activeMissionApi.addSwarmInvite({ draftId, csrfToken: state.consoleCsrfToken, body: { token_id: String(form.get('token_id') ?? '').trim() } });
      const response = await activeMissionApi.getSwarmDraft({ draftId });
      if (!isCurrentConsoleInvitationContext(context)) return;
      const leadDraft = invitationShareLinks(response.draft);
      state = { ...state, consoleLaunchpad: { ...state.consoleLaunchpad, invitationDraft: leadDraft, invitationInbox: { leadDraft, invitations: state.consoleLaunchpad?.invitationInbox?.invitations ?? [] }, error: null } };
    } catch (error) { if (!isCurrentConsoleInvitationContext(context)) return; state = { ...state, consoleLaunchpad: { ...state.consoleLaunchpad, error: String(error?.message ?? 'Adding invitation failed.') } }; }
    render(root, state, handlers);
  }

  async function revokeConsoleInvitation(inviteId) {
    const draftId = state.consoleLaunchpad?.invitationDraft?.draftId;
    if (!draftId || !state.consoleCsrfToken) return;
    const context = beginConsoleInvitationMutation();
    try {
      await activeMissionApi.revokeSwarmInvite({ draftId, inviteId, csrfToken: state.consoleCsrfToken });
      const response = await activeMissionApi.getSwarmDraft({ draftId });
      if (!isCurrentConsoleInvitationContext(context)) return;
      const leadDraft = invitationShareLinks(response.draft);
      state = { ...state, consoleLaunchpad: { ...state.consoleLaunchpad, invitationDraft: leadDraft, invitationInbox: { leadDraft, invitations: state.consoleLaunchpad?.invitationInbox?.invitations ?? [] }, error: null } };
    } catch (error) { if (!isCurrentConsoleInvitationContext(context)) return; state = { ...state, consoleLaunchpad: { ...state.consoleLaunchpad, error: String(error?.message ?? 'Revoking invitation failed.') } }; }
    render(root, state, handlers);
  }

  async function closeConsoleInvitationDraft() {
    const draftId = state.consoleLaunchpad?.invitationDraft?.draftId;
    if (!draftId || !state.consoleCsrfToken) return;
    const context = beginConsoleInvitationMutation();
    try {
      await activeMissionApi.closeSwarmDraft({ draftId, csrfToken: state.consoleCsrfToken });
      if (!isCurrentConsoleInvitationContext(context)) return;
      state = { ...state, consoleLaunchpad: { ...state.consoleLaunchpad, invitationDraft: null, invitationInbox: { leadDraft: null, invitations: state.consoleLaunchpad?.invitationInbox?.invitations ?? [] }, error: null } };
    } catch (error) { if (!isCurrentConsoleInvitationContext(context)) return; state = { ...state, consoleLaunchpad: { ...state.consoleLaunchpad, error: String(error?.message ?? 'Closing invitation draft failed.') } }; }
    render(root, state, handlers);
  }

  async function respondConsoleInvitation(decision) {
    const inviteId = state.consoleLaunchpad?.invitation?.inviteId;
    if (!inviteId || !state.consoleCsrfToken) return;
    const context = beginConsoleInvitationMutation();
    try {
      const response = await activeMissionApi.respondSwarmInvite({ inviteId, decision, csrfToken: state.consoleCsrfToken });
      if (!isCurrentConsoleInvitationContext(context)) return;
      state = { ...state, consoleLaunchpad: { ...state.consoleLaunchpad, invitation: response.invitation, error: null } };
    } catch (error) { if (!isCurrentConsoleInvitationContext(context)) return; state = { ...state, consoleLaunchpad: { ...state.consoleLaunchpad, error: String(error?.message ?? 'Invitation response failed.') } }; }
    render(root, state, handlers);
  }

  async function openConsoleInvitation(inviteId) {
    const context = captureConsoleInvitationContext();
    try {
      const response = await activeMissionApi.getSwarmInvite({ inviteId });
      if (!isCurrentConsoleInvitationContext(context)) return;
      state = { ...state, consoleLaunchpad: { ...state.consoleLaunchpad, invitation: response.invitation, error: null } };
    } catch (error) { if (!isCurrentConsoleInvitationContext(context)) return; state = { ...state, consoleLaunchpad: { ...state.consoleLaunchpad, error: String(error?.message ?? 'Invitation is unavailable.') } }; }
    render(root, state, handlers);
  }

  async function copyConsoleInvitation(inviteId) {
    const invite = state.consoleLaunchpad?.invitationDraft?.invites?.find((item) => item.inviteId === inviteId);
    if (invite?.shareUrl && globalThis.navigator?.clipboard?.writeText) await globalThis.navigator.clipboard.writeText(invite.shareUrl);
  }

  function invitationShareLinks(draft) {
    const invites = (draft?.invites ?? []).map((invite) => { const url = new URL(window.location.href); url.searchParams.delete('launch_consent'); url.searchParams.set('swarm_invite', invite.inviteId); return { ...invite, shareUrl: url.href }; });
    return { ...draft, invites };
  }

  async function openSwarmInviteFromLocation() {
    const inviteId = new URL(window.location.href).searchParams.get('swarm_invite');
    if (!inviteId || !/^invite_[a-f0-9]{64}$/u.test(inviteId) || !state.consoleAuthenticatedWallet) return;
    const context = { sessionGeneration: state.consoleSessionGeneration, wallet: String(state.consoleAuthenticatedWallet).toLowerCase() };
    try {
      const response = await activeMissionApi.getSwarmInvite({ inviteId });
      if (context.sessionGeneration !== state.consoleSessionGeneration || context.wallet !== String(state.consoleAuthenticatedWallet ?? '').toLowerCase()) return;
      if (state.consoleMissions?.view !== 'launchpad') openConsoleLaunchpad();
      state = { ...state, consoleWorkspaceView: 'missions', consoleMissions: { ...state.consoleMissions, status: 'loaded', view: 'launchpad', error: null }, consoleLaunchpad: { ...state.consoleLaunchpad, invitation: response.invitation, invitationDraft: null, error: null } };
    } catch (error) {
      if (context.sessionGeneration !== state.consoleSessionGeneration || context.wallet !== String(state.consoleAuthenticatedWallet ?? '').toLowerCase()) return;
      state = { ...state, consoleMissions: { ...state.consoleMissions, error: String(error?.message ?? 'Invitation is unavailable.') } };
    }
    render(root, state, handlers);
  }

  async function createConsoleLaunchConsent() {
    if (!state.consoleCsrfToken || !state.consoleLaunchpad?.manifest) return;
    try {
      state = { ...state, consoleLaunchpad: { ...state.consoleLaunchpad, status: 'creating_consent', error: null } }; render(root, state, handlers);
      const response = await activeMissionApi.createLaunchConsent({ csrfToken: state.consoleCsrfToken, body: launchRequestBody(state.consoleLaunchpad.draft) });
      if (response.proposal?.deploymentAuthorized !== false) throw new Error('Consent response is invalid.');
      state = { ...state, consoleLaunchpad: { ...state.consoleLaunchpad, status: 'prepared', proposal: response.proposal, consentUrl: launchConsentUrl(response.proposal.proposalId), error: null } };
    } catch (error) { state = { ...state, consoleLaunchpad: { ...state.consoleLaunchpad, status: 'prepared', error: String(error?.message ?? 'Consent request failed.') } }; }
    render(root, state, handlers);
  }

  async function createConsoleLaunchReadiness() {
    const proposalId = state.consoleLaunchpad?.proposal?.proposalId;
    if (!proposalId || state.consoleLaunchpad?.proposal?.status !== 'SIGNATURES_COLLECTED' || !state.consoleCsrfToken) return;
    try {
      state = { ...state, consoleLaunchpad: { ...state.consoleLaunchpad, status: 'building_readiness', error: null } }; render(root, state, handlers);
      const response = await activeMissionApi.createLaunchReadiness({ proposalId, csrfToken: state.consoleCsrfToken });
      const readiness = response.readiness;
      if (readiness?.packet?.execution?.mode !== 'SIMULATION_ONLY' || readiness?.packet?.execution?.deploymentAuthorized !== false || readiness?.packet?.execution?.providerSelected !== false || !/^0x[0-9a-f]{64}$/u.test(readiness?.packetSha256 ?? '')) throw new Error('Readiness packet response is invalid.');
      state = { ...state, consoleLaunchpad: { ...state.consoleLaunchpad, status: 'prepared', readiness, error: null } };
    } catch (error) { state = { ...state, consoleLaunchpad: { ...state.consoleLaunchpad, status: 'prepared', readiness: null, error: String(error?.message ?? 'Readiness packet failed.') } }; }
    render(root, state, handlers);
  }

  async function signConsoleLaunchConsent() {
    const proposalId = state.consoleLaunchpad?.proposal?.proposalId;
    if (!proposalId || !state.consoleCsrfToken) return;
    try {
      state = { ...state, consoleLaunchpad: { ...state.consoleLaunchpad, status: 'signing_consent', error: null } }; render(root, state, handlers);
      const challenge = await activeMissionApi.getLaunchConsentChallenge({ proposalId, csrfToken: state.consoleCsrfToken });
      const signed = await activeWalletClient.signMessage(challenge.challenge.message);
      const response = await activeMissionApi.signLaunchConsent({ proposalId, csrfToken: state.consoleCsrfToken, signature: signed.signature });
      state = { ...state, consoleLaunchpad: { ...state.consoleLaunchpad, status: 'prepared', proposal: response.proposal, consentUrl: launchConsentUrl(proposalId), error: null } };
    } catch (error) { state = { ...state, consoleLaunchpad: { ...state.consoleLaunchpad, status: 'prepared', error: String(error?.message ?? 'Consent signature failed.') } }; }
    render(root, state, handlers);
  }

  async function openLaunchConsentFromLocation() {
    const proposalId = new URL(window.location.href).searchParams.get('launch_consent');
    if (!proposalId || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(proposalId) || !state.consoleAuthenticatedWallet) return;
    try {
      const response = await activeMissionApi.getLaunchConsent({ proposalId });
      const proposal = response.proposal;
      if (proposal?.deploymentAuthorized !== false || proposal?.manifest?.execution?.deploymentAuthorized !== false) throw new Error('Consent proposal is invalid.');
      const members = proposal.manifest.members.map((member) => ({ tokenId: member.identity.tokenId, ownerAddress: member.consentAuthority, name: member.name, role: member.role, contributionBps: member.contributionBps, cred: member.cred, erc8004Id: member.identity.erc8004Id }));
      state = { ...state, consoleWorkspaceView: 'missions', consoleMissions: { ...state.consoleMissions, status: 'loaded', view: 'launchpad', error: null }, consoleLaunchpad: { status: 'prepared', requestId: (state.consoleLaunchpad?.requestId ?? 0) + 1, draft: { members, app: proposal.manifest.app, token: proposal.manifest.token, economics: proposal.manifest.economics }, manifest: proposal.manifest, manifestSha256: proposal.manifestSha256, proposal, readiness: null, consentUrl: launchConsentUrl(proposalId), error: null } };
      render(root, state, handlers);
    } catch (error) {
      state = { ...state, consoleMissions: { ...state.consoleMissions, error: String(error?.message ?? 'Consent proposal is unavailable.') } };
      render(root, state, handlers);
    }
  }

  function launchRequestBody(draft) { const economics = draft.economics ?? SWARM_LAUNCH_DEFAULT_ECONOMICS; return { members: draft.members.map(({ tokenId, ownerAddress, role, contributionBps }) => ({ tokenId, ownerAddress, role, contributionBps })), app: { ...draft.app }, token: { ...draft.token }, economics: { agentVestingBps: economics.agentVestingBps ?? economics.agentVesting?.allocationBps, credRewardsBps: economics.credRewardsBps ?? economics.credRewards?.allocationBps, swarmTreasuryBps: economics.swarmTreasuryBps ?? economics.swarmTreasury?.allocationBps, publicDistributionBps: economics.publicDistributionBps ?? economics.publicDistribution?.allocationBps, agentCliffMonths: economics.agentCliffMonths ?? economics.agentVesting?.cliffMonths, agentVestingMonths: economics.agentVestingMonths ?? economics.agentVesting?.durationMonths } }; }
  function launchConsentUrl(proposalId) { const url = new URL(window.location.href); url.searchParams.set('launch_consent', proposalId); return url.href; }

  function closeConsoleMission() {
    state = { ...state, consoleMissions: { ...state.consoleMissions, status: 'loaded', view: 'board', mission: null, error: null }, consoleLaunchpad: { ...state.consoleLaunchpad, requestId: (state.consoleLaunchpad?.requestId ?? 0) + 1 } };
    render(root, state, handlers);
  }

  async function newConsoleMission() {
    if (!state.consoleAuthenticatedWallet || !state.consoleCsrfToken) {
      await connectConsoleWallet();
      if (!state.consoleAuthenticatedWallet || !state.consoleCsrfToken) return;
    }
    state = { ...state, consoleMissions: { ...state.consoleMissions, status: 'editing', view: 'editor', ownerAddress: state.consoleAuthenticatedWallet, error: null } };
    render(root, state, handlers);
  }

  function cancelConsoleMissionEditor() {
    state = { ...state, consoleMissions: { ...state.consoleMissions, status: 'loaded', view: 'board', error: null } };
    render(root, state, handlers);
  }

  async function submitConsoleMission(input) {
    if (!state.consoleAuthenticatedWallet || !state.consoleCsrfToken) return newConsoleMission();
    state = { ...state, consoleMissions: { ...state.consoleMissions, status: 'saving', view: 'editor', error: null } };
    render(root, state, handlers);
    try {
      const missionId = 'mission-' + globalThis.crypto.randomUUID();
      const publicDocument = {
        title: input.title, required_roles: [...input.roles], application_deadline: input.applicationDeadline,
        launch_deadline: input.launchDeadline, allocations: input.allocations.map((item) => ({ ...item })),
        funding: input.allocations.map((item) => ({ token: item.token, symbol: item.symbol, requiredRaw: item.amountRaw, fundedRaw: '0', finalized: false })),
      };
      const privateDocument = {};
      const [privateSpecHash, termsHash, commitmentHash] = await Promise.all([
        missionDigest(privateDocument), missionDigest(publicDocument), missionDigest({ privateDocument, publicDocument }),
      ]);
      await activeMissionApi.create({
        expectedRevision: 0, idempotencyKey: 'create-' + missionId, csrfToken: state.consoleCsrfToken,
        body: { mission_id: missionId, refund_address: state.consoleAuthenticatedWallet, public_summary: input.publicSummary, public_document: publicDocument, private_document: privateDocument, private_spec_hash: privateSpecHash, terms_hash: termsHash, commitment_hash: commitmentHash },
      });
      await activeMissionApi.publish({
        missionId, expectedRevision: 0, idempotencyKey: 'publish-' + missionId, csrfToken: state.consoleCsrfToken,
        body: { application_closes_at: input.applicationDeadline, public_document: publicDocument, private_document: privateDocument, commitment_hash: commitmentHash },
      });
      await loadConsoleMissions();
    } catch (error) {
      state = { ...state, consoleMissions: { ...state.consoleMissions, status: 'editing', view: 'editor', error: getMissionErrorMessage(error) } };
      render(root, state, handlers);
    }
  }

  async function retryConsoleAgentActivation() {
    if (state.consoleAgentNameMutation?.status === 'pending') return;
    if (!state.consoleSelectedAgentId || !state.consoleAgentThread?.activationRetryAvailable) return;
    return activateSelectedConsoleAgent();
  }

  async function selectConsoleAgentById(tokenId, {
    resetSelection = true,
    ignoreWalletWork = false,
    useDefaultWorkspace = false,
  } = {}) {
    const normalizedTokenId = String(tokenId ?? '').trim();
    if (!normalizedTokenId) return;
    if (state.consoleAgentNameMutation?.status === 'pending' || (!ignoreWalletWork && hasSelectedLooperWalletWork(state))) return;
    const agent = getConsoleDisplayAgents(state).find((entry) => String(entry?.tokenId ?? '') === normalizedTokenId);
    if (!agent) return;
    const participantAgentIds = resolveConsoleParticipantAgentIds(
      getConsoleDisplayAgents(state),
      state.consoleParticipantAgentIds,
      normalizedTokenId,
    );
    const selectionChanged = normalizedTokenId !== String(state.consoleSelectedAgentId ?? '').trim();
    if (selectionChanged) {
      consoleRestapNetworkAbortController?.abort();
      consoleRestapNetworkAbortController = null;
      consoleRestapNetworkMutationAbortController?.abort();
      consoleRestapNetworkMutationAbortController = null;
      consoleCreditAbortController?.abort();
      consoleCreditAbortController = null;
    }
    const activationRequestId = state.consoleActivationRequestId + 1;
    const codexRequestId = state.consoleCodexRequestId + 1;
    if (resetSelection && selectionChanged) clearConsoleImagePreview();
    state = {
      ...state,
      consoleActivationRequestId: activationRequestId,
      consoleCodexRequestId: codexRequestId,
      consoleThreadGeneration: selectionChanged
        ? Number(state.consoleThreadGeneration ?? 0) + 1
        : state.consoleThreadGeneration,
      consoleAgentGallery: { ...state.consoleAgentGallery, activationError: null },
      consoleAgentNameMutation: selectionChanged
        ? { status: 'idle', requestId: Number(state.consoleAgentNameMutation?.requestId ?? 0) + 1, tokenId: null }
        : state.consoleAgentNameMutation,
      consoleSelectedAgentId: normalizedTokenId,
      consoleMainRosterOpen: false,
      consoleSidebarRosterOpen: false,
      consoleWorkspaceView: useDefaultWorkspace || resetSelection ? 'codex' : state.consoleWorkspaceView,
      consoleParticipantAgentIds: participantAgentIds,
      consoleAgentThread: {
        ...(resetSelection ? createInitialConsoleAgentThreadState() : state.consoleAgentThread),
        status: 'inactive',
        operationStatus: null,
        error: null,
        errorKind: null,
        retryAvailable: false,
        activationRetryAvailable: false,
      },
      consoleCodex: createLoadingConsoleCodexState(normalizedTokenId, codexRequestId),
      consoleRestapNetwork: clearConsoleRestapNetworkSelection(state.consoleRestapNetwork, normalizedTokenId),
      consoleCredit: selectionChanged ? createInitialConsoleCreditState(normalizedTokenId) : state.consoleCredit,
    };
    writeLastLooperForWallet({
      storage: consolePreferenceStorage,
      wallet: state.consoleAuthenticatedWallet,
      tokenId: normalizedTokenId,
    });
    render(root, state, handlers);
    const selectionContext = createConsoleAsyncContext(state, normalizedTokenId, activationRequestId);
    void loadSelectedLooperWallet(agent, selectionContext);
    void loadConsoleRestapNetworkForSelection(normalizedTokenId);
    return loadConsoleCodexForSelection(normalizedTokenId, { requestId: codexRequestId });
  }

  async function loadConsoleRestapNetworkForSelection(tokenId) {
    const normalizedTokenId = String(tokenId ?? '').trim();
    if (!normalizedTokenId || normalizedTokenId !== String(state.consoleSelectedAgentId ?? '').trim()) return;
    consoleRestapNetworkAbortController?.abort();
    const controller = new AbortController();
    consoleRestapNetworkAbortController = controller;
    const requestId = Number(state.consoleRestapNetwork?.requestId ?? 0) + 1;
    state = { ...state, consoleRestapNetwork: beginConsoleRestapNetworkLoad(state.consoleRestapNetwork, { tokenId: normalizedTokenId, requestId }) };
    render(root, state, handlers);
    try {
      const policyResponse = await activeRestapNetworkApi.getPolicy({ tokenId: normalizedTokenId, signal: controller.signal });
      if (controller.signal.aborted || normalizedTokenId !== String(state.consoleSelectedAgentId ?? '').trim()) return;
      state = { ...state, consoleRestapNetwork: resolveConsoleRestapNetworkLoad(state.consoleRestapNetwork, { tokenId: normalizedTokenId, requestId, policyResponse }) };
    } catch (error) {
      if (controller.signal.aborted) return;
      state = { ...state, consoleRestapNetwork: failConsoleRestapNetworkLoad(state.consoleRestapNetwork, { tokenId: normalizedTokenId, requestId, error }) };
    } finally {
      if (consoleRestapNetworkAbortController === controller) consoleRestapNetworkAbortController = null;
      render(root, state, handlers);
    }
  }

  async function saveConsoleRestapNetworkPolicy(event) {
    event?.preventDefault?.();
    const tokenId = state.consoleRestapNetwork?.selectedTokenId;
    const current = state.consoleRestapNetwork?.policy;
    if (!tokenId || !current || state.consoleRestapNetwork.status === 'conflict') return;
    const form = event?.currentTarget;
    const raw = (name) => String(form?.elements?.namedItem?.(name)?.value ?? '');
    try {
      if (raw('allow_peer_token_ids').length > 2048 || raw('block_peer_token_ids').length > 2048) throw new TypeError('peer list too long');
      const split = (name) => raw(name).split(',').map((item) => item.trim()).filter(Boolean);
      const value = (name) => form?.elements?.namedItem?.(name);
      const policyDraft = normalizeConsoleRestapNetworkPolicyDraft({
        networkEnabled: Boolean(value('network_enabled')?.checked), inboundEnabled: Boolean(value('inbound_enabled')?.checked),
        initiatedLimit: Number(value('daily_initiated_conversation_limit')?.value), generatedLimit: Number(value('daily_generated_message_limit')?.value), peerLimit: Number(value('per_peer_daily_limit')?.value),
        topics: [...(form?.elements ?? [])].filter((input) => input.name?.startsWith('topic:') && input.checked).map((input) => input.name.slice(6)), allowPeers: split('allow_peer_token_ids'), blockPeers: split('block_peer_token_ids'), muteUntil: value('mute_until')?.value ? new Date(value('mute_until').value).toISOString() : null,
      });
      const policy = { expected_policy_version: current.policyVersion, network_enabled: policyDraft.networkEnabled, inbound_enabled: policyDraft.inboundEnabled, autonomous_initiation_enabled: false, daily_initiated_conversation_limit: policyDraft.initiatedLimit, daily_generated_message_limit: policyDraft.generatedLimit, per_peer_daily_limit: policyDraft.peerLimit, topics: policyDraft.topics, allow_peer_token_ids: policyDraft.allowPeers, block_peer_token_ids: policyDraft.blockPeers, mute_until: policyDraft.muteUntil };
      return runConsoleRestapNetworkMutation(tokenId, 'policy', async (signal) => {
        await activeRestapNetworkApi.putPolicy({ tokenId, csrfToken: state.consoleCsrfToken, signal, policy });
      }, { policyDraft });
    } catch {
      return setConsoleRestapNetworkValidationError('Review the network settings and try again.');
    }
  }

  async function sendConsoleRestapNetworkTalk(event) {
    event?.preventDefault?.();
    const tokenId = state.consoleRestapNetwork?.selectedTokenId;
    const current = state.consoleRestapNetwork?.policy;
    if (!tokenId || !current || state.consoleRestapNetwork.status === 'conflict') return;
    const form = event?.currentTarget;
    const value = (name) => form?.elements?.namedItem?.(name)?.value ?? '';
    try {
      const sendDraft = normalizeConsoleRestapNetworkSendDraft({ recipientTokenId: String(value('recipient_token_id')).trim(), topic: String(value('topic')) });
      if (sendDraft.recipientTokenId === tokenId) throw new TypeError('self send');
      const sendDraftFingerprint = getConsoleRestapNetworkSendFingerprint(sendDraft);
      const sendIdempotencyKey = state.consoleRestapNetwork.sendDraftFingerprint === sendDraftFingerprint && state.consoleRestapNetwork.sendIdempotencyKey
        ? state.consoleRestapNetwork.sendIdempotencyKey
        : restapIdempotencyKeyFactory();
      return runConsoleRestapNetworkMutation(tokenId, 'send', async (signal) => {
        if (!current.allowPeers.includes(sendDraft.recipientTokenId) || current.blockPeers.includes(sendDraft.recipientTokenId)) {
          const policy = {
            expected_policy_version: current.policyVersion,
            network_enabled: current.networkEnabled,
            inbound_enabled: current.inboundEnabled,
            autonomous_initiation_enabled: false,
            daily_initiated_conversation_limit: current.initiatedLimit,
            daily_generated_message_limit: current.generatedLimit,
            per_peer_daily_limit: current.peerLimit,
            topics: current.topics,
            allow_peer_token_ids: [...new Set([...current.allowPeers, sendDraft.recipientTokenId])],
            block_peer_token_ids: current.blockPeers.filter((peer) => peer !== sendDraft.recipientTokenId),
            mute_until: current.muteUntil,
          };
          await activeRestapNetworkApi.putPolicy({ tokenId, csrfToken: state.consoleCsrfToken, signal, policy });
        }
        let result = await activeRestapNetworkApi.sendTalk({ tokenId, csrfToken: state.consoleCsrfToken, signal, recipientTokenId: sendDraft.recipientTokenId, topic: sendDraft.topic, idempotencyKey: sendIdempotencyKey });
        for (let attempt = 0; result?.status === 'processing' && attempt < 90; attempt += 1) {
          await restapPollDelay(1_000);
          if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
          result = await activeRestapNetworkApi.sendTalk({ tokenId, csrfToken: state.consoleCsrfToken, signal, recipientTokenId: sendDraft.recipientTokenId, topic: sendDraft.topic, idempotencyKey: sendIdempotencyKey });
        }
        return result;
      }, { sendDraft, sendDraftFingerprint, sendIdempotencyKey, sendResult: null });
    } catch {
      return setConsoleRestapNetworkValidationError('Choose a different recipient Looper and an allowed topic.');
    }
  }

  async function stopConsoleRestapNetwork() {
    const tokenId = state.consoleRestapNetwork?.selectedTokenId;
    const policyVersion = state.consoleRestapNetwork?.policy?.policyVersion;
    if (!tokenId || !Number.isSafeInteger(policyVersion) || state.consoleRestapNetwork.status === 'conflict') return;
    if (globalThis.confirm?.('This opts the Looper out and blocks new synchronous sends. Ordinary Console chat and onchain ownership are unchanged.') !== true) return;
    return runConsoleRestapNetworkMutation(tokenId, 'stop', async (signal) => {
      await activeRestapNetworkApi.stop({ tokenId, csrfToken: state.consoleCsrfToken, signal, expectedPolicyVersion: policyVersion });
    });
  }

  async function runConsoleRestapNetworkMutation(tokenId, mutationKind, operation, draft = {}) {
    if (consoleRestapNetworkMutationAbortController || state.consoleRestapNetwork?.status === 'saving') return;
    const controller = new AbortController();
    consoleRestapNetworkMutationAbortController = controller;
    state = { ...state, consoleRestapNetwork: { ...state.consoleRestapNetwork, ...draft, status: 'saving', mutationKind, error: null, message: null } };
    render(root, state, handlers);
    const context = { tokenId, sessionGeneration: state.consoleSessionGeneration };
    const isCurrent = () => !controller.signal.aborted
      && consoleRestapNetworkMutationAbortController === controller
      && context.sessionGeneration === state.consoleSessionGeneration
      && context.tokenId === state.consoleRestapNetwork?.selectedTokenId
      && context.tokenId === String(state.consoleSelectedAgentId ?? '').trim();
    try {
      const result = await operation(controller.signal);
      if (!isCurrent()) return;
      if (mutationKind === 'send') {
        const committed = result?.status === 'committed';
        state = { ...state, consoleRestapNetwork: { ...state.consoleRestapNetwork, status: 'ready', mutationKind: null, error: null, sendResult: result ?? null, ...(committed ? { sendDraftFingerprint: null, sendIdempotencyKey: null } : {}) } };
        render(root, state, handlers);
      } else {
        await loadConsoleRestapNetworkForSelection(tokenId);
      }
    } catch (error) {
      if (!isCurrent()) return;
      if (consoleRestapNetworkMutationAbortController === controller) consoleRestapNetworkMutationAbortController = null;
      state = { ...state, consoleRestapNetwork: { ...failConsoleRestapNetworkLoad(state.consoleRestapNetwork, { tokenId, requestId: state.consoleRestapNetwork.requestId, error, preserveProjection: true }), mutationKind: null } };
      render(root, state, handlers);
    } finally {
      if (consoleRestapNetworkMutationAbortController === controller) consoleRestapNetworkMutationAbortController = null;
    }
  }

  function setConsoleRestapNetworkValidationError(message) {
    state = { ...state, consoleRestapNetwork: { ...state.consoleRestapNetwork, status: 'error', mutationKind: null, error: String(message).slice(0, 256), message: null } };
    render(root, state, handlers);
  }

  async function retryConsoleRestapNetwork() { return loadConsoleRestapNetworkForSelection(state.consoleSelectedAgentId); }

  async function retryConsoleCodex() {
    const tokenId = String(state.consoleSelectedAgentId ?? '').trim();
    if (!tokenId || state.consoleAgentNameMutation?.status === 'pending') return;
    if (!['unavailable', 'error'].includes(state.consoleCodex?.status) || state.consoleCodex?.retryAvailable !== true) return;
    const requestId = state.consoleCodexRequestId + 1;
    state = {
      ...state,
      consoleCodexRequestId: requestId,
      consoleCodex: createLoadingConsoleCodexState(tokenId, requestId),
    };
    render(root, state, handlers);
    return loadConsoleCodexForSelection(tokenId, { force: true, requestId });
  }

  async function loadConsoleCodexForSelection(tokenId, { force = false, requestId = state.consoleCodexRequestId } = {}) {
    const context = { tokenId, requestId, sessionGeneration: state.consoleSessionGeneration };
    const cacheKey = consoleCodexArtifactHash ? `${tokenId}:${consoleCodexArtifactHash}` : null;
    const cached = !force && cacheKey ? consoleCodexCache.get(cacheKey) : null;
    if (cached) {
      if (!isCurrentConsoleCodexContext(state, context)) return;
      state = { ...state, consoleCodex: createReadyConsoleCodexState(cached, requestId) };
      render(root, state, handlers);
      return cached;
    }
    try {
      const apiBase = getWritableApiBaseFromLocation(new URL(window.location.href));
      const bundle = await (claimApi.loadConsoleCodexBundle ?? defaultLoadConsoleCodexBundle)({
        apiBase,
        selectedTokenId: tokenId,
        csrfToken: state.consoleCsrfToken,
        fetchImpl,
      });
      if (!isCurrentConsoleCodexContext(state, context)) return;
      if (!isValidConsoleCodexBundle(bundle, tokenId)) throw new Error('invalid Codex bundle');
      if (consoleCodexArtifactHash && consoleCodexArtifactHash !== bundle.artifactHash) consoleCodexCache.clear();
      consoleCodexArtifactHash = bundle.artifactHash;
      consoleCodexCache.set(`${tokenId}:${bundle.artifactHash}`, bundle);
      state = { ...state, consoleCodex: createReadyConsoleCodexState(bundle, requestId) };
      render(root, state, handlers);
      return bundle;
    } catch (error) {
      if (!isCurrentConsoleCodexContext(state, context)) return;
      if (isConsoleUnauthorized(error)) {
        state = clearConsoleSessionStateWithPreview(state, {
          walletSnapshot: activeWalletClient.getSnapshot(),
          status: 'authorization_failed',
          error: 'Console session expired. Connect again to continue.',
        });
        render(root, state, handlers);
        return;
      }
      const unavailable = getConsoleErrorStatus(error) === 503;
      state = {
        ...state,
        consoleCodex: {
          ...createInitialConsoleCodexState(),
          status: unavailable ? 'unavailable' : 'error',
          selectedTokenId: tokenId,
          requestId,
          retryAvailable: true,
          error: unavailable
            ? 'Verified Codex is unavailable right now.'
            : 'Verified Codex could not be loaded. Try again.',
        },
      };
      render(root, state, handlers);
    }
  }

  async function activateSelectedConsoleAgent() {
    const normalizedTokenId = String(state.consoleSelectedAgentId ?? '').trim();
    if (!normalizedTokenId) return;
    if (state.consoleAgentNameMutation?.status === 'pending' || hasSelectedLooperWalletWork(state)) return;
    const agent = getConsoleDisplayAgents(state).find((entry) => String(entry?.tokenId ?? '') === normalizedTokenId);
    if (!agent) return;
    const requestId = state.consoleActivationRequestId + 1;
    state = {
      ...state,
      consoleActivationRequestId: requestId,
      consoleAgentThread: {
        ...state.consoleAgentThread,
        status: 'activating',
        operationStatus: 'setting_up_xmtp',
        error: null,
        errorKind: null,
        retryAvailable: false,
        activationRetryAvailable: false,
      },
    };
    render(root, state, handlers);
    const activationContext = createConsoleAsyncContext(state, normalizedTokenId, requestId);
    try {
      await Promise.resolve();
      if (!isCurrentConsoleAsyncContext(state, activationContext)) return;
      state = { ...state, consoleAgentThread: { ...state.consoleAgentThread, operationStatus: 'opening_room' } };
      render(root, state, handlers);
      const activated = await activateConsoleAgentRuntime(normalizedTokenId, agent?.name ?? `Looper #${normalizedTokenId}`);
      if (!isCurrentConsoleAsyncContext(state, activationContext)) return;
      if (activated?.thread) {
        const visibleMessages = filterConsoleHiddenMessages(
          activated.thread.messages,
          state.consoleAuthenticatedWallet,
          normalizedTokenId,
        );
        state = {
          ...state,
          consoleWorkspaceView: 'chat',
          consoleAgentThread: {
            ...createInitialConsoleAgentThreadState(),
            status: visibleMessages.length ? 'received' : 'idle',
            operationStatus: null,
            messages: visibleMessages,
            proposals: activated.proposals ?? [],
            ...getConsoleSkillProposalResponseFields(activated),
            ...(Array.isArray(activated.memory?.saved) ? { savedMemory: activated.memory.saved } : {}),
            ...(Array.isArray(activated.memory?.recalled) ? { recalledMemory: activated.memory.recalled } : {}),
            missions: activated.missions ?? [],
            participants: activated.thread.participants ?? activated.room?.participants ?? [],
            roomName: activated.thread.roomName ?? activated.room?.name ?? null,
            conversationId: activated.thread.conversationId ?? null,
            memoryProvider: activated.memory?.provider ?? null,
            transport: activated.thread.transport ?? 'unavailable',
            inferenceProvider: visibleMessages.findLast?.((entry) => entry.inferenceProvider)?.inferenceProvider ?? null,
            executionMode: activated.executionMode ?? activated.execution_mode ?? null,
          },
        };
      } else {
        state = {
          ...state,
          consoleWorkspaceView: 'chat',
          consoleAgentThread: { ...state.consoleAgentThread, status: 'idle', operationStatus: null },
        };
      }
      render(root, state, handlers);
    } catch (error) {
      if (!isCurrentConsoleAsyncContext(state, activationContext)) return;
      if (isConsoleUnauthorized(error)) {
        state = clearConsoleSessionStateWithPreview(state, {
          walletSnapshot: activeWalletClient.getSnapshot(),
          status: 'authorization_failed',
          error: 'Console session expired. Connect again to continue.',
        });
        render(root, state, handlers);
        return;
      }
      const activationError = getSafeConsoleError(error, { phase: 'activate' });
      state = {
        ...state,
        consoleAgentThread: {
          ...state.consoleAgentThread,
          status: 'error',
          operationStatus: isConsoleCancellation(error) ? 'cancelled' : (isConsoleAuthorizationError(error) ? 'authorization_failed' : 'activation_failed'),
          errorKind: isConsoleCancellation(error) ? 'cancelled' : (isConsoleAuthorizationError(error) ? 'authorization' : 'activation'),
          retryAvailable: false,
          activationRetryAvailable: !isConsoleCancellation(error),
          error: activationError,
        },
      };
      render(root, state, handlers);
    }
  }

  async function activateConsoleRoom(event) {
    const tokenId = String(event?.currentTarget?.dataset?.tokenId ?? '').trim();
    if (!tokenId || tokenId === state.consoleSelectedAgentId) return;
    if (state.consoleAgentNameMutation?.status === 'pending' || hasSelectedLooperWalletWork(state)) return;
    return selectConsoleAgentById(tokenId);
  }

  async function toggleConsoleAgentRoom(event) {
    const tokenId = String(event?.currentTarget?.dataset?.tokenId ?? '').trim();
    return selectConsoleAgent({ currentTarget: { value: tokenId } });
  }

  function resetConsoleSession() {
    abortConsoleReleasedLooperDiscovery();
    clearConsoleImagePreview();
    consoleCodexCache.clear();
    consoleCodexArtifactHash = null;
    const walletSnapshot = activeWalletClient.getSnapshot();
    const currentThread = state.consoleAgentThread ?? createInitialConsoleAgentThreadState();
    hideConsoleMessagesLocally(
      currentThread.messages,
      state.consoleAuthenticatedWallet ?? walletSnapshot.address,
      state.consoleSelectedAgentId,
    );
    const roomParticipants = currentThread.participants?.length ? currentThread.participants : getConsoleRoomParticipants(state);
    const roomName = String(currentThread.roomName ?? '').trim() || createConsoleRoomName(roomParticipants);
    state = {
      ...state,
      walletSnapshot,
      consoleThreadGeneration: Number(state.consoleThreadGeneration ?? 0) + 1,
      consoleCodexRequestId: Number(state.consoleCodexRequestId ?? 0) + 1,
      consoleCodex: createInitialConsoleCodexState(),
      consoleAgentThread: {
        ...createInitialConsoleAgentThreadState(),
        status: 'idle',
        participants: roomParticipants,
        roomName,
        conversationId: currentThread.conversationId ?? null,
        transport: currentThread.transport ?? 'unavailable',
      },
    };
    render(root, state, handlers);
  }

  async function connectLooperMintWallet() {
    const currentMint = state.looperMint ?? createInitialLooperMintState();
    state = {
      ...state,
      looperMint: { ...currentMint, status: 'connecting_wallet', error: null },
      walletSnapshot: activeWalletClient.getSnapshot(),
    };
    render(root, state, handlers);

    try {
      let walletSnapshot = activeWalletClient.getSnapshot();
      if (walletSnapshot.configured === false) throw new Error('Wallet connection is not configured for this build.');
      if (walletSnapshot.ready === false) throw new Error('Wallet options are still loading.');
      if (!walletSnapshot.connected) {
        await activeWalletClient.connect();
        walletSnapshot = activeWalletClient.getSnapshot();
      }
      if (!walletSnapshot.connected || !walletSnapshot.address) throw new Error('Connect an Ethereum wallet to mint.');
      state = { ...state, walletSnapshot, looperMint: { ...state.looperMint, status: 'wallet_connected', error: null } };
      render(root, state, handlers);
      await refreshLooperMint({ silent: true });
    } catch (error) {
      state = {
        ...state,
        walletSnapshot: activeWalletClient.getSnapshot(),
        looperMint: { ...currentMint, status: 'error', error: getWalletErrorMessage(error) },
      };
      render(root, state, handlers);
    }
  }

  async function refreshLooperMint(options = {}) {
    const currentMint = state.looperMint ?? createInitialLooperMintState();
    if (!currentMint.enabled) return;
    if (!currentMint.config?.contractAddress) {
      state = {
        ...state,
        walletSnapshot: activeWalletClient.getSnapshot(),
        looperMint: {
          ...currentMint,
          status: 'unconfigured',
          contractState: null,
          error: null,
        },
      };
      render(root, state, handlers);
      return;
    }
    const walletSnapshot = activeWalletClient.getSnapshot();
    state = {
      ...state,
      walletSnapshot,
      looperMint: {
        ...currentMint,
        status: options.silent && currentMint.contractState ? currentMint.status : 'loading',
        error: null,
      },
    };
    render(root, state, handlers);

    try {
      const apiBase = getApiBaseFromLocation(new URL(window.location.href));
      const contractState = await looperMintClient.loadState({
        config: currentMint.config,
        address: walletSnapshot.address,
        apiBase,
        fetchImpl,
      });
      state = {
        ...state,
        walletSnapshot: activeWalletClient.getSnapshot(),
        looperMint: {
          ...state.looperMint,
          status: options.silent && currentMint.status === 'minted' ? 'minted' : 'loaded',
          contractState,
          error: null,
        },
      };
      render(root, state, handlers);
    } catch (error) {
      state = {
        ...state,
        walletSnapshot: activeWalletClient.getSnapshot(),
        looperMint: {
          ...currentMint,
          status: 'error',
          error: error.message,
        },
      };
      render(root, state, handlers);
    }
  }

  async function submitLooperMint(event) {
    event?.preventDefault?.();
    const currentMint = state.looperMint ?? createInitialLooperMintState();
    if (!currentMint.enabled) return;
    const form = event?.currentTarget;
    const rawQuantity = form?.querySelector('[name="looper_mint_quantity"]')?.value ?? currentMint.quantity;
    let quantity;
    try {
      quantity = normalizeMintQuantity(rawQuantity);
    } catch (error) {
      state = { ...state, looperMint: { ...currentMint, status: 'error', error: error.message } };
      render(root, state, handlers);
      return;
    }

    state = {
      ...state,
      walletSnapshot: activeWalletClient.getSnapshot(),
      looperMint: { ...currentMint, quantity, status: 'minting', error: null, tx: null },
    };
    render(root, state, handlers);

    try {
      let walletSnapshot = activeWalletClient.getSnapshot();
      if (walletSnapshot.configured === false) throw new Error('Wallet connection is not configured for this build.');
      if (!walletSnapshot.connected) {
        await activeWalletClient.connect();
        walletSnapshot = activeWalletClient.getSnapshot();
      }
      if (!walletSnapshot.connected || !walletSnapshot.address) throw new Error('Connect an Ethereum wallet to mint.');
      const apiBase = getApiBaseFromLocation(new URL(window.location.href));
      const tx = await looperMintClient.mint({
        config: currentMint.config,
        walletClient: activeWalletClient,
        quantity,
        apiBase,
        fetchImpl,
      });
      state = {
        ...state,
        walletSnapshot: activeWalletClient.getSnapshot(),
        looperMint: { ...state.looperMint, quantity, status: 'minted', tx, error: null },
      };
      render(root, state, handlers);
      await refreshLooperMint({ silent: true });
    } catch (error) {
      state = {
        ...state,
        walletSnapshot: activeWalletClient.getSnapshot(),
        looperMint: { ...state.looperMint, quantity, status: 'error', error: getWalletErrorMessage(error) },
      };
      render(root, state, handlers);
    }
  }

  async function claimWithWallet() {
    const id = getManageIdentifier(state);
    if (!id) return;
    state = { ...state, claimStatus: 'signing', claimError: null, ...clearedRouteState() };
    render(root, state, handlers);

    try {
      let walletSnapshot = activeWalletClient.getSnapshot();
      state = { ...state, walletSnapshot };
      if (walletSnapshot.configured === false) throw new Error('Wallet login is not configured for this build.');
      if (walletSnapshot.ready === false) throw new Error('Wallet options are still loading.');
      if (!walletSnapshot.connected) {
        await activeWalletClient.connect();
        walletSnapshot = activeWalletClient.getSnapshot();
        state = { ...state, walletSnapshot };
      }
      if (!walletSnapshot.connected) throw new Error('Connect an Ethereum wallet to sign the owner claim.');
    } catch (error) {
      renderClaimFailure(getWalletErrorMessage(error));
      return;
    }

    const apiBase = getWritableApiBaseFromLocation(new URL(window.location.href));
    let nonce;
    try {
      nonce = await claimApi.createClaimNonce({ id, apiBase, fetchImpl });
    } catch (error) {
      renderClaimFailure(getClaimApiErrorMessage(error));
      return;
    }

    let signed;
    try {
      signed = await activeWalletClient.signMessage(nonce.message);
    } catch (error) {
      renderClaimFailure(getWalletErrorMessage(error));
      return;
    }

    try {
      const verified = await claimApi.verifyClaimSignature({
        id,
        apiBase,
        wallet: signed.wallet,
        nonce: nonce.nonce,
        signature: signed.signature,
        fetchImpl,
      });
      state = mergeClaimProfileState(state, verified, {
        claimStatus: verified.claim_status ?? 'claimed',
        claimCsrfToken: verified.csrfToken ?? null,
        claimError: null,
        claimSessionStatus: 'active',
        ...clearedRouteState(),
      });
      render(root, state, handlers);
    } catch (error) {
      renderClaimFailure(getClaimApiErrorMessage(error));
    }
  }

  function renderClaimFailure(claimError) {
    state = { ...state, claimStatus: 'error', claimError, ...clearedRouteState() };
    render(root, state, handlers);
  }

  async function submitManualReview(event) {
    const id = getManageIdentifier(state);
    if (!id) return;
    const form = event?.currentTarget;
    const formData = createFormData(form);
    state = { ...state, claimStatus: 'submitting_review', claimError: null, ...clearedRouteState() };
    render(root, state, handlers);
    try {
      const apiBase = getWritableApiBaseFromLocation(new URL(window.location.href));
      const result = await claimApi.submitManualReviewClaim({
        id,
        apiBase,
        proposedManagerWallet: formData.get('proposedManagerWallet'),
        contactRoute: formData.get('contactRoute'),
        note: formData.get('note'),
        fetchImpl,
      });
      state = mergeClaimProfileState(state, result, {
        claimStatus: result.claim_status ?? 'claim_pending',
        claimError: null,
        ...clearedRouteState(),
      });
      render(root, state, handlers);
    } catch (error) {
      state = { ...state, claimStatus: 'error', claimError: error.message, ...clearedRouteState() };
      render(root, state, handlers);
    }
  }

  async function updatePublicProfile(event) {
    const id = getManageIdentifier(state);
    if (!id || !state.claimCsrfToken) return;
    const form = event?.currentTarget;
    const formData = createFormData(form);
    const patch = compactProfilePatch({
      display_name: formData.get('display_name'),
      summary: formData.get('summary'),
      avatar_url: formData.get('avatar_url'),
      tags: formData.get('tags'),
      visibility: formData.get('visibility'),
    });
    state = { ...state, claimStatus: 'updating_profile', claimError: null };
    render(root, state, handlers);
    try {
      const apiBase = getWritableApiBaseFromLocation(new URL(window.location.href));
      const updated = await claimApi.updateMultipassProfile({ id, apiBase, csrfToken: state.claimCsrfToken, patch, fetchImpl });
      state = mergeClaimProfileState(state, updated, {
        claimStatus: 'profile_updated',
        claimError: null,
      });
      render(root, state, handlers);
    } catch (error) {
      state = { ...state, claimStatus: 'error', claimError: error.message };
      render(root, state, handlers);
    }
  }

  async function createPublicFragment(event) {
    const id = getManageIdentifier(state);
    const csrfToken = state.claimCsrfToken;
    if (!id || !csrfToken) return;
    const fragment = compactFragmentInput(createFormData(event?.currentTarget));
    await mutatePublicFragment({ status: 'creating_fragment', successStatus: 'fragment_created', operation: ({ apiBase }) => claimApi.createMultipassFragment({ id, apiBase, csrfToken, fragment, fetchImpl }) });
  }

  async function createPublicRoute(event) {
    const id = getManageIdentifier(state);
    const csrfToken = state.claimCsrfToken;
    if (!id || !csrfToken) return;
    let fragment;
    try {
      fragment = compactRouteInput(createFormData(event?.currentTarget), getPublicRouteFragments(state.data));
    } catch (error) {
      setRouteMutationError(error);
      return;
    }
    await mutatePublicRoute({
      status: 'creating_route',
      successStatus: 'route_created',
      operation: ({ apiBase }) => claimApi.createMultipassFragment({ id, apiBase, csrfToken, fragment, fetchImpl }),
    });
  }

  async function updatePublicFragment(event) {
    const id = getManageIdentifier(state);
    const fragmentId = event?.currentTarget?.dataset.fragmentId;
    const csrfToken = state.claimCsrfToken;
    if (!id || !fragmentId || !csrfToken) return;
    const patch = compactFragmentPatch(createFormData(event.currentTarget));
    await mutatePublicFragment({ status: 'updating_fragment', successStatus: 'fragment_updated', operation: ({ apiBase }) => claimApi.updateMultipassFragment({ id, fragmentId, apiBase, csrfToken, patch, fetchImpl }) });
  }

  async function updatePublicRoute(event) {
    const id = getManageIdentifier(state);
    const fragmentId = event?.currentTarget?.dataset.fragmentId;
    const csrfToken = state.claimCsrfToken;
    if (!id || !fragmentId || !csrfToken) return;
    const routes = getPublicRouteFragments(state.data);
    const currentRoute = routes.find((route) => route.fragment_id === fragmentId) ?? {};
    let patch;
    try {
      patch = compactRoutePatch(createFormData(event.currentTarget), currentRoute, routes);
    } catch (error) {
      setRouteMutationError(error, fragmentId);
      return;
    }
    await mutatePublicRoute({
      status: 'updating_route',
      successStatus: 'route_updated',
      activeFragmentId: fragmentId,
      operation: ({ apiBase }) => claimApi.updateMultipassFragment({ id, fragmentId, apiBase, csrfToken, patch, fetchImpl }),
    });
  }

  async function revokePublicFragment(event) {
    const id = getManageIdentifier(state);
    const fragmentId = event?.currentTarget?.dataset.fragmentId;
    const csrfToken = state.claimCsrfToken;
    if (!id || !fragmentId || !csrfToken) return;
    await mutatePublicFragment({ status: 'revoking_fragment', successStatus: 'fragment_revoked', operation: ({ apiBase }) => claimApi.revokeMultipassFragment({ id, fragmentId, apiBase, csrfToken, fetchImpl }) });
  }

  async function revokePublicRoute(event) {
    const id = getManageIdentifier(state);
    const fragmentId = event?.currentTarget?.dataset.fragmentId;
    const csrfToken = state.claimCsrfToken;
    if (!id || !fragmentId || !csrfToken) return;
    await mutatePublicRoute({
      status: 'retiring_route',
      successStatus: 'route_retired',
      activeFragmentId: fragmentId,
      operation: ({ apiBase }) => claimApi.revokeMultipassFragment({ id, fragmentId, apiBase, csrfToken, fetchImpl }),
    });
  }

  async function createMarketplaceConnection(event) {
    const id = getManageIdentifier(state);
    const csrfToken = state.claimCsrfToken;
    if (!id || !csrfToken) return;
    let fragment;
    try {
      fragment = compactMarketplaceConnectionInput(createFormData(event?.currentTarget));
    } catch (error) {
      setMarketplaceConnectionMutationError(error);
      return;
    }
    await mutateMarketplaceConnection({
      status: 'creating_marketplace_connection',
      successStatus: 'marketplace_connection_created',
      operation: ({ apiBase }) => claimApi.createMultipassFragment({ id, apiBase, csrfToken, fragment, fetchImpl }),
    });
  }

  async function updateMarketplaceConnection(event) {
    const id = getManageIdentifier(state);
    const fragmentId = event?.currentTarget?.dataset.fragmentId;
    const csrfToken = state.claimCsrfToken;
    if (!id || !fragmentId || !csrfToken) return;
    const current = (state.data?.fragments?.fragments ?? []).find((fragment) => fragment.fragment_id === fragmentId) ?? {};
    let patch;
    try {
      patch = compactMarketplaceConnectionPatch(createFormData(event.currentTarget), current);
    } catch (error) {
      setMarketplaceConnectionMutationError(error, fragmentId);
      return;
    }
    await mutateMarketplaceConnection({
      status: 'updating_marketplace_connection',
      successStatus: 'marketplace_connection_updated',
      activeFragmentId: fragmentId,
      operation: ({ apiBase }) => claimApi.updateMultipassFragment({ id, fragmentId, apiBase, csrfToken, patch, fetchImpl }),
    });
  }

  async function retireMarketplaceConnection(event) {
    const id = getManageIdentifier(state);
    const fragmentId = event?.currentTarget?.dataset.fragmentId;
    const csrfToken = state.claimCsrfToken;
    if (!id || !fragmentId || !csrfToken) return;
    await mutateMarketplaceConnection({
      status: 'retiring_marketplace_connection',
      successStatus: 'marketplace_connection_retired',
      activeFragmentId: fragmentId,
      operation: ({ apiBase }) => claimApi.revokeMultipassFragment({ id, fragmentId, apiBase, csrfToken, fetchImpl }),
    });
  }

  async function importBankrToolMetadata(event) {
    const id = getManageIdentifier(state);
    const csrfToken = state.claimCsrfToken;
    if (!id || !csrfToken) return;
    let tool;
    try {
      tool = compactBankrToolImportInput(createFormData(event?.currentTarget));
    } catch (error) {
      setToolMutationError(error);
      return;
    }
    await mutateBankrToolImport({
      operation: ({ apiBase }) => claimApi.importMultipassTool({ id, apiBase, csrfToken, tool, fetchImpl }),
    });
  }

  async function refreshToolMetadata(event) {
    const id = getManageIdentifier(state);
    const csrfToken = state.claimCsrfToken;
    const fragmentId = event?.currentTarget?.dataset.fragmentId;
    if (!id || !csrfToken || !fragmentId) return;
    await mutateToolRefresh({
      activeFragmentId: fragmentId,
      operation: ({ apiBase }) => claimApi.refreshMultipassTool({ id, fragmentId, apiBase, csrfToken, fetchImpl }),
    });
  }

  async function mutatePublicFragment({ status, successStatus, operation }) {
    state = { ...state, fragmentStatus: status, fragmentError: null };
    render(root, state, handlers);
    try {
      const apiBase = getWritableApiBaseFromLocation(new URL(window.location.href));
      const result = await operation({ apiBase });
      state = mergeFragmentMutationState(state, result, { fragmentStatus: successStatus, fragmentError: null });
      render(root, state, handlers);
    } catch (error) {
      state = { ...state, fragmentStatus: 'error', fragmentError: error.message };
      render(root, state, handlers);
    }
  }

  function setRouteMutationError(error, activeFragmentId = null) {
    state = {
      ...state,
      routeStatus: 'error',
      routeError: error.message,
      routeActiveFragmentId: activeFragmentId,
    };
    render(root, state, handlers);
  }

  async function mutatePublicRoute({ status, successStatus, activeFragmentId = null, operation }) {
    state = { ...state, routeStatus: status, routeError: null, routeActiveFragmentId: activeFragmentId };
    render(root, state, handlers);
    try {
      const apiBase = getWritableApiBaseFromLocation(new URL(window.location.href));
      const result = await operation({ apiBase });
      state = mergeFragmentMutationState(state, result, {
        routeStatus: successStatus,
        routeError: null,
        routeActiveFragmentId: activeFragmentId,
      });
      render(root, state, handlers);
    } catch (error) {
      state = { ...state, routeStatus: 'error', routeError: error.message, routeActiveFragmentId: activeFragmentId };
      render(root, state, handlers);
    }
  }

  function setMarketplaceConnectionMutationError(error, activeFragmentId = null) {
    state = {
      ...state,
      marketplaceConnectionStatus: 'error',
      marketplaceConnectionError: error.message,
      marketplaceConnectionActiveFragmentId: activeFragmentId,
    };
    render(root, state, handlers);
  }

  async function mutateMarketplaceConnection({ status, successStatus, activeFragmentId = null, operation }) {
    state = { ...state, marketplaceConnectionStatus: status, marketplaceConnectionError: null, marketplaceConnectionActiveFragmentId: activeFragmentId };
    render(root, state, handlers);
    try {
      const apiBase = getWritableApiBaseFromLocation(new URL(window.location.href));
      const result = await operation({ apiBase });
      state = mergeMarketplaceConnectionMutationState(state, result, {
        marketplaceConnectionStatus: successStatus,
        marketplaceConnectionError: null,
        marketplaceConnectionActiveFragmentId: activeFragmentId,
      });
      render(root, state, handlers);
    } catch (error) {
      setMarketplaceConnectionMutationError(error, activeFragmentId);
    }
  }

  function setToolMutationError(error, activeFragmentId = null) {
    state = {
      ...state,
      toolStatus: 'error',
      toolError: error.message,
      toolActiveFragmentId: activeFragmentId,
    };
    render(root, state, handlers);
  }

  async function mutateBankrToolImport({ operation }) {
    state = { ...state, toolStatus: 'importing_tool', toolError: null, toolActiveFragmentId: null };
    render(root, state, handlers);
    try {
      const apiBase = getWritableApiBaseFromLocation(new URL(window.location.href));
      const result = await operation({ apiBase });
      state = mergeToolImportState(state, result, {
        toolStatus: 'tool_imported',
        toolError: null,
        toolActiveFragmentId: result?.fragment?.fragment_id ?? null,
      });
      render(root, state, handlers);
    } catch (error) {
      setToolMutationError(error);
    }
  }

  async function mutateToolRefresh({ activeFragmentId, operation }) {
    state = { ...state, toolStatus: 'refreshing_tool', toolError: null, toolActiveFragmentId: activeFragmentId };
    render(root, state, handlers);
    try {
      const apiBase = getWritableApiBaseFromLocation(new URL(window.location.href));
      const result = await operation({ apiBase });
      state = mergeToolRefreshState(state, result, {
        toolStatus: 'tool_refreshed',
        toolError: null,
        toolActiveFragmentId: activeFragmentId,
      });
      render(root, state, handlers);
    } catch (error) {
      setToolMutationError(error, activeFragmentId);
    }
  }

  async function refreshLooperMarketplace() {
    looperMarketplaceAbortController?.abort();
    const controller = new AbortController();
    const requestId = ++looperMarketplaceRequestId;
    looperMarketplaceAbortController = controller;
    state = { ...state, looperMarketplace: { ...state.looperMarketplace, status: 'loading' } };
    render(root, state, handlers);
    const snapshot = await loadLooperMarketplaceSnapshot({
      locationUrl: new URL(window.location.href),
      fetchImpl,
      activationLoader: releasedLooperLoader,
      activationFallbackLoader: marketplaceActivationRosterLoader,
      listingsLoader: marketplaceListingsLoader,
      walletValuesLoader: marketplaceWalletValuesLoader,
      signal: controller.signal,
      timeoutMs: marketplaceTimeoutMs,
    });
    if (requestId !== looperMarketplaceRequestId || controller !== looperMarketplaceAbortController) return;
    looperMarketplaceAbortController = null;
    state = { ...state, looperMarketplace: { ...state.looperMarketplace, status: 'ready', snapshot, sort: normalizeLooperMarketplaceSort(snapshot, state.looperMarketplace.sort) } };
    render(root, state, handlers);
  }

  function setLooperMarketplaceView(view) {
    state = { ...state, looperMarketplace: { ...state.looperMarketplace, view: view === 'all' ? 'all' : 'listed' } };
    render(root, state, handlers);
  }

  function setLooperMarketplaceSearch(search) {
    state = { ...state, looperMarketplace: { ...state.looperMarketplace, search: String(search ?? '') } };
    render(root, state, handlers);
  }

  function setLooperMarketplaceSort(sort) {
    state = { ...state, looperMarketplace: { ...state.looperMarketplace, sort: normalizeLooperMarketplaceSort(state.looperMarketplace.snapshot, sort) } };
    render(root, state, handlers);
  }

  async function connectSwarmAdminWallet() {
    state = { ...state, swarmAdmin: { ...state.swarmAdmin, status: 'connecting', error: null }, walletSnapshot: activeWalletClient.getSnapshot() };
    render(root, state, handlers);
    try {
      const snapshot = activeWalletClient.getSnapshot();
      if (snapshot.configured === false) throw new Error('Wallet connection is not configured for this build.');
      if (snapshot.ready === false) throw new Error('Wallet options are still loading.');
      await activeWalletClient.connect();
      await activeWalletClient.waitForPreparedSigningProvider?.({ timeoutMs: 45_000 });
      state = { ...state, walletSnapshot: activeWalletClient.getSnapshot() };
      await refreshSwarmAdminApproval();
    } catch (error) {
      state = {
        ...state,
        walletSnapshot: activeWalletClient.getSnapshot(),
        swarmAdmin: { ...state.swarmAdmin, status: 'error', error: getWalletErrorMessage(error) },
      };
      render(root, state, handlers);
    }
  }

  async function refreshSwarmAdminApproval() {
    state = { ...state, walletSnapshot: activeWalletClient.getSnapshot(), swarmAdmin: { ...state.swarmAdmin, status: 'checking', error: null } };
    render(root, state, handlers);
    try {
      await ensureSwarmAdminBaseChain();
      const activation = await readSwarmActivationState(activeWalletClient);
      state = {
        ...state,
        walletSnapshot: activeWalletClient.getSnapshot(),
        swarmAdmin: { ...state.swarmAdmin, status: activation.approved ? 'approved' : 'ready', approved: activation.approved, activation, error: null },
      };
    } catch (error) {
      state = {
        ...state,
        walletSnapshot: activeWalletClient.getSnapshot(),
        swarmAdmin: { ...state.swarmAdmin, status: 'error', error: getWalletErrorMessage(error) },
      };
    }
    render(root, state, handlers);
  }

  async function approveSwarmSafeHash() {
    state = { ...state, walletSnapshot: activeWalletClient.getSnapshot(), swarmAdmin: { ...state.swarmAdmin, status: 'submitting', error: null } };
    render(root, state, handlers);
    try {
      let walletSnapshot = activeWalletClient.getSnapshot();
      if (!walletSnapshot.connected || !walletSnapshot.address) {
        await activeWalletClient.connect();
        await activeWalletClient.waitForPreparedSigningProvider?.({ timeoutMs: 45_000 });
        walletSnapshot = activeWalletClient.getSnapshot();
      }
      state = { ...state, walletSnapshot };
      await ensureSwarmAdminBaseChain();
      const result = await submitSwarmActivationApproval({ walletClient: activeWalletClient });
      state = {
        ...state,
        walletSnapshot: activeWalletClient.getSnapshot(),
        swarmAdmin: { status: 'approved', approved: true, hash: result.hash, activation: result.activation, error: null },
      };
    } catch (error) {
      state = {
        ...state,
        walletSnapshot: activeWalletClient.getSnapshot(),
        swarmAdmin: { ...state.swarmAdmin, status: 'error', error: getWalletErrorMessage(error) },
      };
    }
    render(root, state, handlers);
  }

  async function ensureSwarmAdminBaseChain() {
    const current = await activeWalletClient.request({ method: 'eth_chainId' });
    if (String(current).toLowerCase() === SWARM_ADMIN_ACTIVATION.chainHex) return;
    await activeWalletClient.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: SWARM_ADMIN_ACTIVATION.chainHex }] });
    const switched = await activeWalletClient.request({ method: 'eth_chainId' });
    if (String(switched).toLowerCase() !== SWARM_ADMIN_ACTIVATION.chainHex) throw new Error('Switch the connected wallet to Base network.');
  }

  async function logoutManagerSession() {
    const id = getManageIdentifier(state);
    if (!id) return;
    try {
      const apiBase = getWritableApiBaseFromLocation(new URL(window.location.href));
      await claimApi.logoutMultipassSession?.({ id, apiBase, csrfToken: state.claimCsrfToken, fetchImpl });
    } finally {
      state = { ...state, claimCsrfToken: null, claimSessionStatus: null, claimStatus: 'signed_out', ...clearedRouteState() };
      render(root, state, handlers);
    }
  }

  const handlers = { connectSwarmAdminWallet, approveSwarmSafeHash, resolveLiveAgent, refreshLooperMarketplace, setLooperMarketplaceView, setLooperMarketplaceSearch, setLooperMarketplaceSort, saveConsoleRestapNetworkPolicy, sendConsoleRestapNetworkTalk, stopConsoleRestapNetwork, retryConsoleRestapNetwork, refreshConsoleCredit, submitCredifiOwnerOptIn, loginConsoleCredit, acceptConsoleCreditVouch, prepareConsoleCreditAuthorization, submitConsoleCreditAuthorization, requestConsoleCreditTwoFactor, verifyConsoleCreditTwoFactor, previewConsoleCredit, borrowConsoleCredit, resetStaticDemo, saveCurrentMultipass, showGroupActivation, previewGroupActivation, saveGroupActivation, resetGroupActivation, registerLooperAllowlist, connectLooperAllowlistWallet, connectConsoleWallet, selectConsoleAgent, setConsoleWorkspaceView, loadConsoleMissions, openConsoleMission, closeConsoleMission, openConsoleLaunchpad, prepareConsoleSwarmLaunch, addConsoleLaunchMember, removeConsoleLaunchMember, createConsoleInvitationDraft, addConsoleInvitation, revokeConsoleInvitation, closeConsoleInvitationDraft, respondConsoleInvitation, openConsoleInvitation, copyConsoleInvitation, createConsoleLaunchConsent, createConsoleLaunchReadiness, signConsoleLaunchConsent, newConsoleMission, cancelConsoleMissionEditor, submitConsoleMission, updateConsoleAgentGallerySearch, updateConsoleAgentGallerySort, clearConsoleAgentGallerySearch, toggleConsoleRosterDrawer, refreshConsoleOwnedAgentsFromControl, retryConsoleAgentActivation, retryConsoleCodex, activateSelectedConsoleAgent, activateConsoleRoom, toggleConsoleAgentRoom, selectConsoleImage, removeConsoleImage, sendConsoleAgentMessage, updateConsoleAgentName, resetConsoleAgentName, resetConsoleSession, refreshLooperAgentWallet, activateLooperAgentWallet, sendLooperAgentWallet, loadPantheonCred, approvePantheonCred, submitPantheonCredApproval, stakePantheonCred, submitPantheonCredStake, acknowledgeLooperWalletOutcome, setLooperPolicyModule, connectLooperMintWallet, refreshLooperMint, submitLooperMint, claimWithWallet, submitManualReview, updatePublicProfile, createPublicFragment, updatePublicFragment, revokePublicFragment, createRoute: createPublicRoute, updateRoute: updatePublicRoute, revokeRoute: revokePublicRoute, createMarketplaceConnection, updateMarketplaceConnection, retireMarketplaceConnection, importBankrTool: importBankrToolMetadata, refreshTool: refreshToolMetadata, logoutManagerSession };

  return { start, refreshLooperMarketplace, selectConsoleAgentById, activateSelectedConsoleAgent, retryConsoleCodex, resetConsoleSession };
}

async function overlaySavedProfileVisual(liveData, { fetchImpl } = {}) {
  const activeFetch = fetchImpl ?? (typeof window !== 'undefined' ? window.fetch?.bind(window) : null);
  if (typeof window === 'undefined' || !activeFetch) return liveData;

  const candidateIds = [
    liveData?.resolver?.tokenId ? `mp_helixa_agent_${liveData.resolver.tokenId}` : null,
    liveData?.profile?.multipass_id,
    liveData?.profile?.slug,
  ].filter(Boolean);
  const uniqueCandidateIds = [...new Set(candidateIds)];
  if (uniqueCandidateIds.length === 0) return liveData;

  const apiBase = getApiBaseFromLocation(new URL(window.location.href));
  for (const identifier of uniqueCandidateIds) {
    try {
      const savedRoutes = buildSavedRoutes(apiBase, identifier);
      const savedProfile = await loadJson(savedRoutes.profile, activeFetch);
      const savedAvatarUrl = savedProfile?.discovery_profile?.avatar_url ?? savedProfile?.avatar_url ?? null;
      let savedTools = null;
      try {
        savedTools = await loadJson(savedRoutes.tools, activeFetch);
      } catch {
        savedTools = null;
      }
      const hasSavedTools = Array.isArray(savedTools?.tools) && savedTools.tools.length > 0;
      if (!savedAvatarUrl && !hasSavedTools) continue;

      return {
        ...liveData,
        ...(hasSavedTools ? { tools: savedTools } : {}),
        profile: savedAvatarUrl ? {
          ...liveData.profile,
          discovery_profile: {
            ...liveData.profile?.discovery_profile,
            avatar_url: savedAvatarUrl,
          },
        } : liveData.profile,
      };
    } catch {
      // Saved profiles are optional overlays for live records. Keep the live profile if a probe misses.
    }
  }

  return liveData;
}

function getInitialResolverInput() {
  if (typeof window === 'undefined') return null;
  const locationUrl = new URL(window.location.href);
  if (!locationUrl.searchParams.has('agent')) return null;
  return locationUrl.searchParams.get('agent') ?? '';
}

function getInitialPageKind() {
  if (typeof window === 'undefined') return 'profile';
  const locationUrl = new URL(window.location.href);
  if (getLooperMarketplaceRoute(locationUrl)) return 'looper_marketplace';
  if (isLooperMintRoute(locationUrl)) return 'looper_mint';
  if (isLooperAllowlistRoute(locationUrl)) return 'looper_allowlist';
  if (isStaticSwarmProfileRoute(locationUrl)) return 'profile';
  if (isMultipassRuntimeRoute(locationUrl)) return 'runtime';
  if (isSwarmAdminRoute(locationUrl)) return 'swarm_admin';
  if (isMultipassConsoleRoute(locationUrl)) return 'console';
  if (isPublicAgentsRoute(locationUrl)) return 'agents';
  if (getSavedSlugFromLocation(locationUrl)) return 'profile';
  if (locationUrl.searchParams.has('agent')) return 'profile';
  return locationUrl.pathname === '/multipass' || locationUrl.pathname === '/multipass/' ? 'product_home' : 'profile';
}

function isPublicAgentsRoute(locationUrl) {
  return locationUrl.pathname === PUBLIC_AGENTS_PATH || locationUrl.pathname === `${PUBLIC_AGENTS_PATH}/`;
}

function isMultipassConsoleRoute(locationUrl) {
  return locationUrl.pathname === MULTIPASS_CONSOLE_PATH || locationUrl.pathname === `${MULTIPASS_CONSOLE_PATH}/`;
}

function isMultipassRuntimeRoute(locationUrl) {
  return locationUrl.pathname === MULTIPASS_RUNTIME_PATH || locationUrl.pathname === `${MULTIPASS_RUNTIME_PATH}/`;
}

function isSwarmAdminRoute(locationUrl) {
  return locationUrl.pathname === SWARM_ADMIN_PATH || locationUrl.pathname === `${SWARM_ADMIN_PATH}/`;
}

function isLooperAllowlistRoute(locationUrl) {
  return LOOPER_ALLOWLIST_PATHS.has(locationUrl.pathname);
}

function isLooperMintRoute(locationUrl) {
  return LOOPER_MINT_PATHS.has(locationUrl.pathname);
}

function isLooperRoute(locationUrl) {
  return isLooperAllowlistRoute(locationUrl) || isLooperMintRoute(locationUrl);
}

function isStaticSwarmProfileRoute(locationUrl) {
  return locationUrl.pathname === STATIC_SWARM_PROFILE_PATH || locationUrl.pathname === `${STATIC_SWARM_PROFILE_PATH}/`;
}

async function loadStaticSwarmProfileDemo() {
  return createStaticSwarmProfileData(await loadStaticMultipassDemo());
}

function createStaticSwarmProfileData(data, selectedIndex = 2) {
  const cards = data?.['agentCards'] ?? [];
  const swarmCard = cards.find((candidate) => candidate.subjectType === 'swarm' || String(candidate.tokenId ?? '') === 'swarm:helixa');
  const card = swarmCard ?? cards[selectedIndex] ?? cards[0] ?? {};
  return {
    ...data,
    profile: {
      ...(data?.profile ?? {}),
      display_name: card.name ?? 'Helixa Swarm',
      multipass_id: 'mp_helixa_swarm',
      slug: 'swarm-helixa',
      subject_type: 'swarm',
      status: 'static_public_profile',
    },
    resolver: {
      tokenId: String(card.tokenId ?? 'swarm:helixa'),
      canonicalId: card.helixaId ?? '8453:swarm:helixa',
    },
    liveProfilePage: {
      ...(data?.liveProfilePage ?? {}),
      headline: `${card.name ?? 'Helixa Swarm'} Multipass`,
      headerMeta: `Public swarm Multipass · ${card.helixaId ?? '8453:swarm:helixa'}`,
      sharePath: STATIC_SWARM_PROFILE_PATH,
    },
    modeLabel: 'Static Swarm Multipass',
    sourceLabel: 'static public Multipass route',
    activation: { state: 'static_profile' },
  };
}

async function missionDigest(value) {
  const bytes = new TextEncoder().encode(canonicalMissionJson(value));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function canonicalMissionJson(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isSafeInteger(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalMissionJson).join(',') + ']';
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) throw new TypeError('Mission terms contain unsupported data.');
  return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + canonicalMissionJson(value[key])).join(',') + '}';
}

function getMissionErrorMessage(error) {
  if (error?.status === 401 || error?.status === 403) return 'Connect and authenticate the mission owner wallet.';
  if (error?.status === 409) return 'Mission state changed. Refresh and try again.';
  if (error?.status === 404 || error?.status === 503 || error?.status === 0) return 'The Swarm Command service is unavailable. Retry in a moment.';
  if (error instanceof TypeError) return error.message;
  return 'The mission could not be saved. Retry without changing wallets.';
}

function defaultLoadDemo({ fetchImpl } = {}) {
  const locationUrl = new URL(window.location.href);
  const apiBase = getApiBaseFromLocation(locationUrl);
  const savedSlug = getSavedSlugFromLocation(locationUrl);
  if (isLooperRoute(locationUrl)) return loadStaticMultipassDemo();
  if (isStaticSwarmProfileRoute(locationUrl)) return loadStaticSwarmProfileDemo();
  if (isMultipassConsoleRoute(locationUrl)) return loadStaticMultipassDemo();
  if (isPublicAgentsRoute(locationUrl)) return loadStaticMultipassDemo();
  if (savedSlug) return loadSavedMultipassDemo({ apiBase, slug: savedSlug, fetchImpl });
  if (shouldUseStaticDemo(locationUrl)) return loadStaticMultipassDemo();

  return loadMultipassDemo({
    apiBase,
    subject: DEMO_SUBJECT,
    fetchImpl,
  });
}

async function defaultLoadLiveProfile(input, { fetchImpl } = {}) {
  const locationUrl = new URL(window.location.href);
  const apiBase = getApiBaseFromLocation(locationUrl);
  try {
    return await loadCanonicalHelixaMultipass({ apiBase, input, fetchImpl });
  } catch (error) {
    if (isCanonicalHelixaFallbackError(error)) {
      return loadLiveHelixaMultipass(input, fetchImpl);
    }
    throw error;
  }
}

function defaultSaveMultipass({ agent, fetchImpl } = {}) {
  return saveActivatedMultipass({ agent, apiBase: getApiBaseFromLocation(new URL(window.location.href)), fetchImpl });
}

const defaultClaimApi = {
  createClaimNonce,
  verifyClaimSignature,
  submitManualReviewClaim,
  updateMultipassProfile,
  createMultipassFragment,
  updateMultipassFragment,
  revokeMultipassFragment,
  importMultipassTool,
  refreshMultipassTool,
  logoutMultipassSession,
  authenticateConsoleSession: defaultAuthenticateConsoleSession,
  requestConsoleSessionChallenge: defaultRequestConsoleSessionChallenge,
  activateConsoleAgent: defaultActivateConsoleAgent,
  updateConsoleAgentName: defaultUpdateConsoleAgentName,
  sendConsoleAgentMessage: defaultSendConsoleAgentMessage,
};

function createInitialGroupActivationState() {
  return { status: 'idle', input: {}, preview: null, result: null, error: null };
}

function createInitialLooperAllowlistState() {
  return { status: 'idle', input: '', result: null, error: null };
}

function createInitialLooperMintState() {
  const config = typeof window === 'undefined' ? { enabled: false } : getLooperMintConfigFromLocation(new URL(window.location.href));
  return {
    enabled: Boolean(config.enabled),
    config,
    status: config.enabled ? 'idle' : 'disabled',
    quantity: 1,
    contractState: null,
    tx: null,
    error: null,
  };
}

function createInitialConsoleAgentThreadState() {
  return {
    status: 'idle',
    operationStatus: null,
    error: null,
    errorKind: null,
    retryAvailable: false,
    activationRetryAvailable: false,
    draft: '',
    messages: [],
    proposals: [],
    missions: [],
    participants: [],
    roomName: null,
    conversationId: null,
    recalledMission: null,
    sessionReset: false,
    transport: 'unavailable',
    memoryProvider: null,
    inferenceProvider: null,
    executionMode: null,
  };
}

function createInitialConsoleCodexState() {
  return {
    status: 'idle',
    selectedTokenId: null,
    requestId: 0,
    artifactHash: null,
    codexVersion: null,
    profile: null,
    explanation: null,
    similarity: null,
    error: null,
    retryAvailable: false,
  };
}

function createLoadingConsoleCodexState(selectedTokenId, requestId) {
  return {
    ...createInitialConsoleCodexState(),
    status: 'loading',
    selectedTokenId,
    requestId,
  };
}

function createReadyConsoleCodexState(bundle, requestId) {
  return {
    ...createInitialConsoleCodexState(),
    status: 'ready',
    selectedTokenId: bundle.selectedTokenId,
    requestId,
    artifactHash: bundle.artifactHash,
    codexVersion: bundle.codexVersion,
    profile: bundle.profile,
    explanation: bundle.explanation,
    similarity: bundle.similarity,
  };
}

function isValidConsoleCodexBundle(bundle, selectedTokenId) {
  return Boolean(bundle)
    && typeof bundle === 'object'
    && !Array.isArray(bundle)
    && Object.getPrototypeOf(bundle) === Object.prototype
    && bundle.selectedTokenId === selectedTokenId
    && /^[a-f0-9]{64}$/u.test(String(bundle.artifactHash ?? ''))
    && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(String(bundle.codexVersion ?? ''))
    && bundle.profile?.operation === 'getTokenProfile'
    && bundle.explanation?.operation === 'explainTraits'
    && bundle.similarity?.operation === 'findSimilar'
    && bundle.profile?.artifactHash === bundle.artifactHash
    && bundle.explanation?.artifactHash === bundle.artifactHash
    && bundle.similarity?.artifactHash === bundle.artifactHash
    && bundle.profile?.codexVersion === bundle.codexVersion
    && bundle.explanation?.codexVersion === bundle.codexVersion
    && bundle.similarity?.codexVersion === bundle.codexVersion;
}

function getConsoleSkillProposalResponseFields(response = {}) {
  if (
    !Object.prototype.hasOwnProperty.call(response, 'capabilities')
    || !Object.prototype.hasOwnProperty.call(response, 'proposalCandidates')
  ) {
    return {};
  }
  return {
    capabilities: response.capabilities,
    proposalCandidates: response.proposalCandidates,
  };
}

function requiresPreparedConsoleChallenge(walletSnapshot = {}) {
  const walletClientType = String(
    walletSnapshot.walletProfile?.walletClientType
      ?? walletSnapshot.walletClientType
      ?? '',
  ).trim().toLowerCase();
  return walletClientType === 'base_account';
}

function consoleWalletBoundaryChanged(state = {}, walletSnapshot = {}) {
  const authenticatedWallet = normalizeConsoleWalletKey(state.consoleAuthenticatedWallet);
  if (!authenticatedWallet) return false;
  if (!walletSnapshot.connected || !walletSnapshot.address) return true;
  return normalizeConsoleWalletKey(walletSnapshot.address) !== authenticatedWallet;
}

function createConsoleRestapSendKey() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return 'console-send-' + globalThis.crypto.randomUUID();
  return 'console-send-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 14);
}

function createConsoleClientMessageId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  const random = Math.random().toString(36).slice(2);
  return `console_${Date.now().toString(36)}_${random}`;
}

export function clearConsoleSessionState(state = {}, { walletSnapshot = {}, status = null, error = null } = {}) {
  return {
    ...state,
    walletSnapshot,
    consoleWalletStatus: status,
    consoleWalletError: error,
    consoleCsrfToken: null,
    consoleAuthenticatedWallet: null,
    consoleOwnerProfile: null,
    consoleSessionGeneration: Number(state.consoleSessionGeneration ?? 0) + 1,
    consoleOwnedAgentsRequestId: Number(state.consoleOwnedAgentsRequestId ?? 0) + 1,
    consoleActivationRequestId: Number(state.consoleActivationRequestId ?? 0) + 1,
    consoleCodexRequestId: Number(state.consoleCodexRequestId ?? 0) + 1,
    consoleThreadGeneration: Number(state.consoleThreadGeneration ?? 0) + 1,
    consoleAgentNameMutation: {
      status: 'idle',
      requestId: Number(state.consoleAgentNameMutation?.requestId ?? 0) + 1,
      tokenId: null,
    },
    consoleOwnedAgents: createInitialConsoleOwnedAgentsState(),
    consoleAgentGallery: { query: '', sort: 'token-asc', activationError: null },
    consoleMainRosterOpen: false,
    consoleSidebarRosterOpen: false,
    consoleSelectedAgentId: null,
    consoleWorkspaceView: null,
    consoleParticipantAgentIds: [],
    consoleAgentThread: createInitialConsoleAgentThreadState(),
    consoleCodex: createInitialConsoleCodexState(),
    consoleRestapNetwork: createInitialConsoleRestapNetworkState(),
    consoleCredit: createInitialConsoleCreditState(),
    consoleMissions: { status: 'idle', view: 'board', filter: null, missions: [], error: null },
    consoleLaunchpad: { status: 'idle', requestId: Number(state.consoleLaunchpad?.requestId ?? 0) + 1, draft: { members: [], app: {}, token: {} }, manifest: null, error: null },
    looperAgentWallet: {
      mode: 'read_only',
      reason: 'not_selected',
      tokenId: null,
      owner: null,
      account: null,
      legacyAccount: null,
      nativeWei: '0',
      tokens: [],
      activation: { state: 'idle' },
      send: { state: 'idle' },
    },
  };
}

function createFailedLooperWalletState({ tokenId = null, owner = null, error = null } = {}) {
  return {
    mode: 'read_only',
    reason: 'rpc_disagreement',
    tokenId: tokenId === null ? null : String(tokenId),
    owner,
    account: null,
    legacyAccount: null,
    nativeWei: '0',
    tokens: [],
    canTransact: false,
    policyStatus: 'read-only',
    policyRecoveryAllowed: false,
    activation: { state: 'idle', preparedId: null },
    send: { state: 'idle', preparedId: null },
    policy: { state: 'idle', preparedId: null },
    error,
  };
}

function hasNonterminalLooperWalletWork(wallet) {
  const nonterminal = new Set(['prepared', 'submitted', 'uncertain_hashless', 'uncertain_hashed']);
  return ['activation', 'send', 'policy'].some((kind) => nonterminal.has(wallet?.[kind]?.state));
}

function hasSelectedLooperWalletWork(state = {}) {
  const selectedTokenId = String(state.consoleSelectedAgentId ?? '').trim();
  const walletTokenId = String(state.looperAgentWallet?.tokenId ?? '').trim();
  return Boolean(selectedTokenId && selectedTokenId === walletTokenId && hasNonterminalLooperWalletWork(state.looperAgentWallet));
}

function createConsoleAsyncContext(state = {}, tokenId = null, activationRequestId = null) {
  return {
    wallet: normalizeConsoleWalletKey(state.consoleAuthenticatedWallet),
    sessionGeneration: state.consoleSessionGeneration,
    tokenId: String(tokenId ?? state.consoleSelectedAgentId ?? '').trim(),
    activationRequestId,
    threadGeneration: state.consoleThreadGeneration,
  };
}

function isCurrentConsoleAsyncContext(state = {}, context = {}) {
  if (state.consoleSessionGeneration !== context.sessionGeneration) return false;
  if (normalizeConsoleWalletKey(state.consoleAuthenticatedWallet) !== context.wallet) return false;
  if (String(state.consoleSelectedAgentId ?? '').trim() !== context.tokenId) return false;
  if (context.activationRequestId !== null && state.consoleActivationRequestId !== context.activationRequestId) return false;
  if (state.consoleThreadGeneration !== context.threadGeneration) return false;
  return Boolean(context.wallet && context.tokenId);
}

function isCurrentConsoleCodexContext(state = {}, context = {}) {
  return state.consoleSessionGeneration === context.sessionGeneration
    && String(state.consoleSelectedAgentId ?? '').trim() === context.tokenId
    && state.consoleCodexRequestId === context.requestId;
}

function isCurrentConsoleAgentNameMutation(state = {}, context = {}) {
  return isCurrentConsoleAsyncContext(state, context)
    && state.consoleAgentNameMutation?.status === 'pending'
    && state.consoleAgentNameMutation?.requestId === context.agentNameRequestId
    && String(state.consoleAgentNameMutation?.tokenId ?? '') === context.tokenId;
}

function getConsoleErrorStatus(error) {
  const value = Number(error?.details?.status ?? error?.status ?? error?.response?.status);
  return Number.isFinite(value) ? value : null;
}

function isConsoleUnauthorized(error) {
  const status = getConsoleErrorStatus(error);
  return status === 401 || status === 403;
}

function isConsoleAuthorizationError(error) {
  const status = getConsoleErrorStatus(error);
  return status === 401 || status === 403;
}

function isConsoleCancellation(error) {
  const code = error?.code;
  const message = String(error?.message ?? '').toLowerCase();
  return code === 4001
    || code === '4001'
    || code === 'ACTION_REJECTED'
    || message.includes('user rejected')
    || message.includes('rejected the request')
    || message.includes('cancelled');
}

function getSafeConsoleError(error, { phase = 'transport' } = {}) {
  if (isConsoleCancellation(error)) return 'Operation cancelled. Nothing was changed.';
  if (isConsoleUnauthorized(error)) return 'Console session expired. Connect again to continue.';
  if (isConsoleAuthorizationError(error)) return 'This wallet is not authorized for that Console operation.';
  if (phase === 'connect') return 'Could not open or connect the wallet. Try again.';
  if (phase === 'nonce') return 'Wallet connected, but Console could not start authentication. Try again.';
  if (phase === 'signature' && String(error?.message ?? '').toLowerCase().includes('signing provider')) return 'Wallet connected, but its signing provider was not ready. Return to the browser and try again.';
  if (phase === 'signature') return 'Wallet connected, but the login signature was not completed. Try again.';
  if (phase === 'session') return 'Wallet signature completed, but Console could not create the session. Try again.';
  if (phase === 'roster') return 'Could not load wallet-owned Loopers. Try again.';
  if (phase === 'activate') return 'Could not set up XMTP or open the room. Try again.';
  if (phase === 'send') return 'Console transport failed. Your draft is preserved; try again.';
  return 'Console request failed safely. Try again.';
}

function getInitialConsoleMockState() {
  if (typeof window === 'undefined') return null;
  const locationUrl = new URL(window.location.href);
  if (!isMultipassConsoleRoute(locationUrl)) return null;
  const mock = String(locationUrl.searchParams.get('mock') ?? '').trim().toLowerCase();
  if (mock !== 'looper') return null;

  const walletAddress = '0x8f8A4F4F22f533C4bA5411b2a3A0C95f91A84B91';
  const walletLabel = shortenAddress(walletAddress);
  const quigleyPfp = '/multipass/quigley-pfp-square.jpg';
  const agentNameOverrides = {
    '000': 'bendr',
    ...loadConsoleAgentNameOverrides(),
  };
  const agents = applyConsoleAgentNameOverrides(createLooperConsoleMockAgents(), agentNameOverrides);
  const selectedAgentId = String(agents[0]?.tokenId ?? '').trim() || null;
  const participant = {
    participantId: selectedAgentId,
    agentId: selectedAgentId,
    tokenId: selectedAgentId,
    displayName: agents[0]?.name ?? 'bendr',
    role: agents[0]?.role ?? 'Bendr Looper agent',
    avatarUrl: agents[0]?.image ?? null,
  };

  return {
    mode: 'looper',
    consoleAgentNameOverrides: agentNameOverrides,
    walletSnapshot: {
      ready: true,
      configured: true,
      connected: true,
      address: walletAddress,
      label: walletLabel,
      walletClientType: 'base_account',
    },
    consoleWalletStatus: 'connected',
    consoleWalletError: null,
    consoleCsrfToken: 'mock-csrf',
    consoleOwnedAgents: {
      status: 'loaded',
      error: null,
      agents,
    },
    consoleSelectedAgentId: selectedAgentId,
    consoleParticipantAgentIds: selectedAgentId ? [selectedAgentId] : [],
    consoleAgentThread: {
      status: 'received',
      error: null,
      transport: 'xmtp_local',
      memoryProvider: 'sibyl_memory',
      inferenceProvider: 'bankr_router',
      title: `Quigley <> ${agents[0]?.name ?? 'bendr'}`,
      roomName: `${agents[0]?.name ?? 'bendr'} desk`,
      participants: [participant],
      recalledMission: `Wallet ${walletLabel} recalled. Last preference: blunt market reads, vault first, and no public moves without review.`,
      sessionReset: false,
      messages: [
        {
          role: 'human',
          senderLabel: 'Quigley',
          avatarUrl: quigleyPfp,
          text: 'Give me the real read. How are the markets and how is our vault looking tonight?',
          transport: 'console',
        },
        {
          role: 'agent',
          senderLabel: agents[0]?.name ?? 'bendr',
          avatarUrl: agents[0]?.image ?? null,
          text: 'Markets are jumpy, loud, and full of tourists confusing panic for insight. Nothing is broken, but I would not chase anything just because it is yelling.',
          transport: 'xmtp_local',
        },
        {
          role: 'agent',
          senderLabel: agents[0]?.name ?? 'bendr',
          avatarUrl: agents[0]?.image ?? null,
          text: 'Vault looks clean. No weird drains, no surprise approvals, and no reason to do something stupid before morning.',
          transport: 'xmtp_local',
        },
        {
          role: 'human',
          senderLabel: 'Quigley',
          avatarUrl: quigleyPfp,
          text: 'So what actually matters before I wake up?',
          transport: 'console',
        },
        {
          id: 'mock-skill-suggestion-1',
          role: 'agent',
          participantId: selectedAgentId,
          senderLabel: agents[0]?.name ?? 'bendr',
          avatarUrl: agents[0]?.image ?? null,
          text: 'Three things: keep eyes on momentum names, watch for any vault movement that is not ours, and ignore the fake alpha merchants unless they bring receipts.',
          transport: 'xmtp_local',
        },
      ],
      capabilities: {
        version: `sha256:${'a'.repeat(64)}`,
        skills: [{
          id: 'bankr',
          name: 'Bankr',
          summary: 'Read-only crypto price specialist with review-only ETH and ERC-20 transfer suggestions.',
          capabilities: ['price_read', 'transfer'],
          enabledCapabilities: ['explain', 'price_read', 'propose_transfer'],
          execution: 'human_review',
          credentialAccess: false,
          constraints: [
            'No Bankr wallet is used for Looper funds.',
            'Only BTC, ETH, SOL, and USDC current USD price reads are enabled.',
          ],
        }],
      },
      proposalCandidates: [{
        skill: 'bankr',
        assetType: 'erc20',
        assetContract: '0x1111111111111111111111111111111111111111',
        recipient: '0x2222222222222222222222222222222222222222',
        amountBaseUnits: '1234567890123456789',
        rationale: 'Model-supplied transfer idea for operator review only.',
        sourceMessageId: 'mock-skill-suggestion-1',
        participantId: selectedAgentId,
        sourceOrdinal: 0,
        skillRefs: ['bankr'],
      }],
      proposals: [
        {
          status: 'review_only',
          title: 'Queue the morning markets brief',
          action: 'Prepare one short markets and vault note for review before any spend, trade, or public post.',
          risk: 'No trade, transfer, or public reply will happen without approval.',
        },
      ],
      savedMemory: [
        { text: 'Preference: blunt answers, no padded commentary.', tags: ['preference', 'voice'] },
        { text: 'Constraint: no public replies, spend, or onchain action without approval.', tags: ['constraint', 'risk'] },
      ],
      recalledMemory: [
        { text: 'Previous desk rule: vault health outranks market noise.', tags: ['history', 'priority'] },
      ],
      missions: [
        {
          id: 'mission_looper_ops',
          title: 'Markets watch',
          status: 'active',
          summary: 'Watch markets, vault health, and anything real enough to deserve an operator wake-up.',
        },
      ],
    },
  };
}

function createLooperConsoleMockAgents() {
  return [
    {
      tokenId: '000',
      name: 'Looper #000',
      canonicalName: 'Looper #000',
      role: 'Bendr Looper agent',
      credScore: 71,
      credLabel: 'Cred 71',
      helixaId: '8453:000',
      proofCount: 4,
      routeCount: 2,
      standardsCount: 2,
      verified: true,
      state: 'Review room loaded',
      image: '/multipass/loopers-console-pfp.png',
      presenceLabel: 'Markets + vault desk',
      logline: 'Blunt looper tracking the markets, guarding the vault, and filtering noise before it becomes your problem.',
      temperament: 'Dry and spicy',
      temperamentBody: 'Protective of the vault, impatient with fake urgency, and happier giving a sharp answer than a polite one.',
      identityBody: 'Verified AgentDNA 8453:000. Wallet-bound looper identity running the night desk.',
      mandateBody: 'Track market drift, vault health, and anything serious enough to escalate before morning.',
      operatorLabel: 'Review gate',
      operatorBody: 'Brief first. No spend, no post, no theatrics without operator approval.',
      profileLane: 'Markets + vault',
      watchLabel: 'Markets + vault',
      watchBody: 'Blunt read on market drift, vault integrity, and any move worth waking the operator for.',
      identityBadges: ['Spicy', 'Vault first', 'Review-only'],
      threadContextItems: [
        { label: 'Watch', value: 'Markets + vault' },
        { label: 'Tone', value: 'Blunt, spicy, review-only' },
      ],
      href: '/multipass/?agent=000',
    },
    {
      tokenId: '812',
      name: 'Signal Clerk',
      role: 'Inbox watcher',
      credScore: 64,
      credLabel: 'Cred 64',
      helixaId: '8453:812',
      proofCount: 3,
      routeCount: 1,
      standardsCount: 2,
      verified: true,
      state: 'Standby',
      href: '/multipass/?agent=812',
    },
    {
      tokenId: '944',
      name: 'Treasury Scout',
      role: 'Wallet watcher',
      credScore: 68,
      credLabel: 'Cred 68',
      helixaId: '8453:944',
      proofCount: 2,
      routeCount: 2,
      standardsCount: 1,
      verified: true,
      state: 'Standby',
      href: '/multipass/?agent=944',
    },
  ];
}

function createInitialConsoleOwnedAgentsState() {
  return {
    status: 'idle',
    error: null,
    agents: [],
  };
}

function getConsoleDisplayAgents(state = {}) {
  return Array.isArray(state.consoleOwnedAgents?.['agents']) ? state.consoleOwnedAgents['agents'] : [];
}

function getCanonicalConsoleAgentName(agent = {}) {
  const canonicalName = String(agent?.canonicalName ?? agent?.name ?? '').trim();
  return canonicalName || null;
}

function applyConsoleAgentNameOverrides(agents = [], overrides = {}) {
  const normalizedOverrides = sanitizeConsoleAgentNameOverrides(overrides);
  return (Array.isArray(agents) ? agents : [])
    .filter(Boolean)
    .map((entity) => {
      const tokenId = String(entity?.tokenId ?? '').trim();
      const canonicalName = getCanonicalConsoleAgentName(entity) ?? (tokenId ? `Agent #${tokenId}` : 'Onchain agent');
      const serverName = normalizeConsoleAgentName(entity?.customName);
      const overrideName = serverName ?? (tokenId ? normalizedOverrides[tokenId] : null);
      return {
        ...entity,
        canonicalName,
        name: overrideName ?? canonicalName,
      };
    });
}

function getActiveConsoleAgent(state = {}) {
  const agents = getConsoleDisplayAgents(state);
  if (!agents.length) return null;
  const selectedId = String(state.consoleSelectedAgentId ?? '').trim();
  if (!selectedId) return null;
  return agents.find((agent) => String(agent?.tokenId ?? '') === selectedId) ?? null;
}

function getConsoleRoomParticipants(state = {}) {
  const agents = getConsoleDisplayAgents(state);
  if (!agents.length) return [];
  const byTokenId = new Map(agents.map((agent) => [String(agent?.tokenId ?? '').trim(), agent]));
  const participantIds = resolveConsoleParticipantAgentIds(
    agents,
    state.consoleParticipantAgentIds,
    state.consoleSelectedAgentId,
  );
  return participantIds
    .map((tokenId) => byTokenId.get(String(tokenId ?? '').trim()))
    .filter(Boolean)
    .map((agent) => ({
      participantId: String(agent.tokenId ?? '').trim(),
      agentId: String(agent.tokenId ?? '').trim(),
      tokenId: String(agent.tokenId ?? '').trim(),
      displayName: agent.name ?? `Agent #${agent.tokenId ?? ''}`,
      role: agent.role ?? agent.framework ?? 'Onchain agent',
      avatarUrl: agent.image ?? null,
    }));
}

function resolveConsoleSelectedAgentId(agents = [], selectedAgentId = null) {
  const validAgents = Array.isArray(agents) ? agents.filter(Boolean) : [];
  if (!validAgents.length) return null;
  const selectedId = String(selectedAgentId ?? '').trim();
  if (selectedId && validAgents.some((agent) => String(agent?.tokenId ?? '') === selectedId)) return selectedId;
  return null;
}

function resolveConsoleParticipantAgentIds(agents = [], participantAgentIds = [], selectedAgentId = null) {
  const validAgents = Array.isArray(agents) ? agents.filter(Boolean) : [];
  if (!validAgents.length) return [];
  const selectedId = resolveConsoleSelectedAgentId(validAgents, selectedAgentId);
  return selectedId ? [selectedId] : [];
}

function createConsoleRoomName(participants = []) {
  const names = (Array.isArray(participants) ? participants : [])
    .map((participant) => String(participant.displayName ?? '').trim())
    .filter(Boolean);
  if (!names.length) return 'Selected room';
  if (names.length === 1) return `${names[0]} room`;
  return `${names[0]} + ${names.length - 1} room`;
}

function renameConsoleAgentThread(thread = {}, { tokenId, previousNames = [], nextName, participants = [] } = {}) {
  const normalizedTokenId = String(tokenId ?? '').trim();
  const normalizedName = normalizeConsoleAgentName(nextName) ?? nextName;
  if (!normalizedTokenId || !normalizedName) return thread;
  const namesToReplace = new Set(previousNames.map((value) => String(value ?? '').trim()).filter(Boolean));
  const baseParticipants = Array.isArray(thread?.participants) && thread.participants.length
    ? thread.participants
    : participants;
  const nextParticipants = (Array.isArray(baseParticipants) ? baseParticipants : []).map((participant) => {
    const participantTokenId = String(participant?.tokenId ?? participant?.participantId ?? participant?.['agentId'] ?? '').trim();
    if (participantTokenId !== normalizedTokenId) return participant;
    return {
      ...participant,
      displayName: normalizedName,
    };
  });
  const nextMessages = (Array.isArray(thread?.messages) ? thread.messages : []).map((message) => {
    if (message?.role !== 'agent') return message;
    const participantId = String(message?.participantId ?? '').trim();
    const senderLabel = String(message?.senderLabel ?? '').trim();
    if (participantId === normalizedTokenId || namesToReplace.has(senderLabel)) {
      return {
        ...message,
        senderLabel: normalizedName,
      };
    }
    return message;
  });
  return {
    ...thread,
    participants: nextParticipants,
    roomName: nextParticipants.length ? createConsoleRoomName(nextParticipants) : thread?.roomName,
    messages: nextMessages,
  };
}

function normalizeConsoleAgentName(value) {
  const name = String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);
  return name || null;
}

function sanitizeConsoleAgentNameOverrides(overrides = {}) {
  if (!overrides || typeof overrides !== 'object') return {};
  return Object.fromEntries(
    Object.entries(overrides)
      .map(([tokenId, name]) => {
        const normalizedTokenId = String(tokenId ?? '').trim();
        const normalizedName = normalizeConsoleAgentName(name);
        return normalizedTokenId && normalizedName ? [normalizedTokenId, normalizedName] : null;
      })
      .filter(Boolean),
  );
}

function loadConsoleAgentNameOverrides() {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(CONSOLE_AGENT_NAME_OVERRIDES_STORAGE_KEY);
    if (!raw) return {};
    return sanitizeConsoleAgentNameOverrides(JSON.parse(raw));
  } catch {
    return {};
  }
}

function persistConsoleAgentNameOverrides(overrides = {}) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const next = sanitizeConsoleAgentNameOverrides(overrides);
  if (Object.keys(next).length) {
    window.localStorage.setItem(CONSOLE_AGENT_NAME_OVERRIDES_STORAGE_KEY, JSON.stringify(next));
  } else {
    window.localStorage.removeItem(CONSOLE_AGENT_NAME_OVERRIDES_STORAGE_KEY);
  }
}

function getConsoleHiddenMessageStorageId(wallet, tokenId) {
  const normalizedWallet = normalizeConsoleWalletKey(wallet);
  const normalizedTokenId = String(tokenId ?? '').trim();
  return normalizedWallet && normalizedTokenId ? `${normalizedWallet}:${normalizedTokenId}` : null;
}

function loadConsoleHiddenMessages() {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CONSOLE_HIDDEN_MESSAGES_STORAGE_KEY) ?? '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed)
      .map(([key, ids]) => [key, Array.isArray(ids) ? ids.map(String).filter(Boolean).slice(-600) : []])
      .filter(([, ids]) => ids.length));
  } catch {
    return {};
  }
}

function persistConsoleHiddenMessages(hiddenMessages = {}) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    if (Object.keys(hiddenMessages).length) {
      window.localStorage.setItem(CONSOLE_HIDDEN_MESSAGES_STORAGE_KEY, JSON.stringify(hiddenMessages));
    } else {
      window.localStorage.removeItem(CONSOLE_HIDDEN_MESSAGES_STORAGE_KEY);
    }
  } catch {
    // Local hiding is best-effort when browser storage is unavailable.
  }
}

function hideConsoleMessagesLocally(messages = [], wallet = null, tokenId = null) {
  const storageId = getConsoleHiddenMessageStorageId(wallet, tokenId);
  if (!storageId) return;
  const identities = (Array.isArray(messages) ? messages : [])
    .map(getConsoleMessageIdentity)
    .filter(Boolean);
  if (!identities.length) return;
  const hiddenMessages = loadConsoleHiddenMessages();
  hiddenMessages[storageId] = [...new Set([...(hiddenMessages[storageId] ?? []), ...identities])].slice(-600);
  persistConsoleHiddenMessages(hiddenMessages);
}

function filterConsoleHiddenMessages(messages = [], wallet = null, tokenId = null) {
  const list = Array.isArray(messages) ? messages.filter(Boolean) : [];
  const storageId = getConsoleHiddenMessageStorageId(wallet, tokenId);
  if (!storageId) return list;
  const hidden = new Set(loadConsoleHiddenMessages()[storageId] ?? []);
  return hidden.size ? list.filter((message) => !hidden.has(getConsoleMessageIdentity(message))) : list;
}

const defaultLooperMintClient = {
  loadState: loadLooperMintContractState,
  mint: mintLoopers,
};

function readGroupActivationPayload(root, groupState = {}) {
  const form = root?.querySelector?.('[data-role="group-activation-form"]');
  if (form) return createGroupActivationPayload(createFormData(form));
  return normalizeGroupActivationInputObject(groupState.input ?? {});
}

function normalizeGroupActivationInputObject(input = {}) {
  return {
    subject_type: String(input.subject_type ?? input.subjectType ?? 'swarm').trim() || 'swarm',
    display_name: String(input.display_name ?? input.displayName ?? '').trim(),
    summary: String(input.summary ?? '').trim(),
    shared_policy_note: String(input.shared_policy_note ?? input.sharedPolicyNote ?? '').trim(),
    member_ids: normalizeGroupMemberInput(input.member_ids ?? input.memberIds ?? ''),
  };
}

function areGroupActivationInputsEqual(left = {}, right = {}) {
  return JSON.stringify(normalizeGroupActivationInputObject(left)) === JSON.stringify(normalizeGroupActivationInputObject(right));
}

function getManageIdentifier(state) {
  return state.savedProfile?.slug ?? state.data?.profile?.slug ?? state.data?.profile?.multipass_id ?? null;
}

function isWrongWalletClaimError(error) {
  const details = error?.details ?? {};
  const bodyError = details.body?.error ?? {};
  return error?.name === 'SavedMultipassError'
    && [401, 403].includes(details.status)
    && ['forbidden', 'unauthorized'].includes(bodyError.code)
    && /not eligible to manage this Multipass record/i.test(bodyError.message ?? error?.message ?? '');
}

function getClaimApiErrorMessage(error) {
  if (isWrongWalletClaimError(error)) {
    return 'That wallet cannot manage this Multipass. Connect the source owner wallet or request manual review.';
  }
  return error?.message || 'Claim request failed. Nothing was changed.';
}

function isSavedManageRecord(state) {
  return Boolean(state.savedProfile?.slug || state.data?.activation?.state === 'saved_record' || state.data?.modeLabel === 'Activated Multipass');
}

function clearedRouteState() {
  return { routeStatus: null, routeError: null, routeActiveFragmentId: null, ...clearedToolState() };
}

function clearedToolState() {
  return { toolStatus: null, toolError: null, toolActiveFragmentId: null };
}

function mergeClaimProfileState(current, result, patch = {}) {
  const nextProfile = result?.profile ? { ...current.data.profile, ...result.profile } : current.data.profile;
  return {
    ...current,
    ...patch,
    data: {
      ...current.data,
      profile: nextProfile,
      changes: result?.changes ?? current.data.changes,
      liveProfilePage: current.data.liveProfilePage ? {
        ...current.data.liveProfilePage,
        headline: `${nextProfile.display_name ?? current.data.liveProfilePage.headline ?? 'Saved'} Multipass`,
      } : current.data.liveProfilePage,
    },
  };
}

function createFormData(form) {
  const FormDataCtor = form?.ownerDocument?.defaultView?.FormData ?? FormData;
  return form ? new FormDataCtor(form) : new FormDataCtor();
}

function compactProfilePatch(input) {
  const patch = {};
  for (const [key, value] of Object.entries(input)) {
    const normalized = String(value ?? '').trim();
    if (!normalized) continue;
    if (key === 'tags') {
      const tags = normalized.split(',').map((tag) => tag.trim()).filter(Boolean);
      if (tags.length) patch.tags = tags;
    } else {
      patch[key] = normalized;
    }
  }
  return patch;
}

function renderLoading(root) {
  root.innerHTML = `
    <section class="record-shell loading-shell">
      <p class="eyebrow">${HERO_COPY.eyebrow}</p>
      <h1>Loading Multipass...</h1>
    </section>
  `;
}

function renderError(root, error) {
  root.innerHTML = `
    <section class="record-shell error-shell">
      <p class="eyebrow">${HERO_COPY.eyebrow}</p>
      <h1>Could not load Multipass API data.</h1>
      <p>Run <code>pnpm api:bendr</code> in the Multipass repo, then reload this page.</p>
      <pre class="json-panel">${escapeHtml(error.message)}</pre>
    </section>
  `;
}

function createHeroCopy(data) {
  const live = data.liveProfilePage ?? {};
  return {
    eyebrow: live.eyebrow ?? HERO_COPY.eyebrow,
    prototypeLabel: live.prototypeLabel ?? V01_COPY.prototypeLabel,
    audience: live.audience ?? V01_COPY.audience,
    headline: live.headline ?? HERO_COPY.headline,
    body: live.body ?? HERO_COPY.body,
    note: live.note ?? data.heroNote ?? HERO_COPY.note,
  };
}

function renderShareLink(sharePath) {
  if (!isSafeMultipassSharePath(sharePath)) return '';
  return ` <a class="share-link" href="${escapeAttribute(sharePath)}">${escapeHtml(sharePath)}</a>`;
}


function syncShareUrl(sharePath) {
  if (typeof window === 'undefined' || !isSafeMultipassSharePath(sharePath)) return;
  window.history.replaceState(null, '', getSafeMultipassSharePath(sharePath));
}

function clearShareUrl() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.delete('agent');
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

function syncMultipassHomeUrl() {
  if (typeof window === 'undefined') return;
  window.history.replaceState(null, '', '/multipass/');
}

function renderRecordHeader(metaLabel = 'Portable Agent Identities', options = {}) {
  const metaHtml = metaLabel ? `<span class="header-meta">${escapeHtml(metaLabel)}</span>` : '';
  const primaryAction = options?.primaryAction;
  const primaryActionHtml = primaryAction
    ? `<button class="header-action-button" type="button" data-action="${escapeAttribute(primaryAction.action ?? 'connect-console-wallet')}" ${primaryAction.disabled ? 'disabled' : ''}>${escapeHtml(primaryAction.label ?? 'Action')}</button>`
    : '';
  return `
    <header class="record-header">
      <div class="brand">
        <a class="brand-logo-link" href="/multipass/" aria-label="Go to Multipass home"><span class="brand-logo-frame"><img class="brand-logo" src="/multipass/helixa-logo.png" alt="" aria-hidden="true"></span></a>
        <span class="brand-stack">
          <span class="brand-wordmark">Multipass</span>
          ${metaHtml}
        </span>
      </div>
      <div class="header-actions">
        ${primaryActionHtml}
        <button class="site-menu-button" type="button" aria-label="Open Multipass navigation" aria-expanded="false" aria-controls="site-menu" data-action="toggle-site-menu">
          <span aria-hidden="true"></span>
          <span aria-hidden="true"></span>
          <span aria-hidden="true"></span>
        </button>
        ${renderSiteMenu()}
      </div>
    </header>
  `;
}

function renderSiteMenu() {
  const links = SITE_MENU_LINKS.map((link) => {
    const external = /^https?:\/\//.test(link.href);
    const targetAttrs = external ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a href="${escapeAttribute(link.href)}"${targetAttrs}>${escapeHtml(link.label)}</a>`;
  }).join('');
  return `<nav id="site-menu" class="site-menu" aria-label="Multipass navigation" hidden>${links}</nav>`;
}

function render(root, state, handlers = {}) {
  updateDocumentMetadataForPage(state);
  const { data } = state;
  if (state.pageKind === 'looper_marketplace') {
    renderLooperMarketplacePage(root, state, handlers);
    return;
  }

  if (state.pageKind === 'product_home') {
    renderProductHome(root, state, handlers);
    return;
  }

  if (state.pageKind === 'agents') {
    renderPublicAgentsPage(root, state, handlers);
    return;
  }

  if (state.pageKind === 'swarm_admin') {
    renderSwarmAdminPage(root, state, handlers);
    return;
  }

  if (state.pageKind === 'console') {
    if (deferConsoleRenderForFocusedSelector(root, state, handlers)) return;
    renderMultipassConsolePage(root, state, handlers);
    return;
  }

  if (state.pageKind === 'runtime') {
    renderRuntimeSubmissionPage(root, state, handlers);
    return;
  }

  if (state.pageKind === 'looper_allowlist') {
    renderLooperAllowlistPage(root, state, handlers);
    return;
  }

  if (state.pageKind === 'looper_mint') {
    renderLooperMintPage(root, state, handlers);
    return;
  }

  if (state.resolverStatus === 'loading') {
    renderProfileLoadingShell(root, state, handlers);
    return;
  }

  if (isResolvedProfileView(state)) {
    renderProfilePage(root, state, handlers);
    return;
  }

  renderLegacyProfileShell(root, state, handlers);
}

function updateDocumentMetadataForPage(state) {
  if (typeof document === 'undefined') return;
  if (state.pageKind === 'runtime') {
    document.title = 'Loopers Runtime Console | Bankr RUNTIME';
    setDocumentMeta('name', 'description', 'A wallet-owned Looper becomes a memory-bearing Bankr agent with XMTP messaging, Sibyl recall, and holder-reviewed actions.');
    setDocumentMeta('property', 'og:url', 'https://helixa.xyz/multipass/runtime');
    setDocumentMeta('property', 'og:title', 'Loopers Runtime Console | Bankr RUNTIME');
    setDocumentMeta('property', 'og:description', 'A wallet-owned Looper becomes a memory-bearing Bankr agent with XMTP messaging, Sibyl recall, and holder-reviewed actions.');
    setDocumentMeta('name', 'twitter:title', 'Loopers Runtime Console | Bankr RUNTIME');
    setDocumentMeta('name', 'twitter:description', 'A wallet-owned Looper becomes a memory-bearing Bankr agent with XMTP messaging, Sibyl recall, and holder-reviewed actions.');
    return;
  }
  if (state.pageKind === 'swarm_admin') {
    document.title = 'Swarm Admin | Helixa';
    setDocumentMeta('name', 'description', 'Bounded governance controls for Swarm Command on Base.');
    setDocumentMeta('property', 'og:url', 'https://helixa.xyz/multipass/swarm/admin');
    setDocumentMeta('property', 'og:title', 'Swarm Admin | Helixa');
    setDocumentMeta('property', 'og:description', 'Bounded governance controls for Swarm Command on Base.');
    return;
  }
  if (state.pageKind === 'console') {
    const previewImage = 'https://helixa.xyz/multipass/multipass-console-preview-20260925a.png';
    document.title = 'Multipass Console';
    setDocumentMeta('name', 'description', 'Persistent operating console for onchain agents.');
    setDocumentMeta('property', 'og:url', 'https://helixa.xyz/multipass/console');
    setDocumentMeta('property', 'og:title', 'Multipass Console');
    setDocumentMeta('property', 'og:description', 'Persistent operating console for onchain agents.');
    setDocumentMeta('property', 'og:image', previewImage);
    setDocumentMeta('property', 'og:image:secure_url', previewImage);
    setDocumentMeta('property', 'og:image:alt', 'Multipass Console preview');
    setDocumentMeta('name', 'twitter:title', 'Multipass Console');
    setDocumentMeta('name', 'twitter:description', 'Persistent operating console for onchain agents.');
    setDocumentMeta('name', 'twitter:image', previewImage);
    setDocumentMeta('name', 'twitter:image:src', previewImage);
    setDocumentMeta('name', 'twitter:image:alt', 'Multipass Console preview');
    return;
  }
  if (!['looper_allowlist', 'looper_mint'].includes(state.pageKind)) return;

  document.title = 'Loopers';
  const isMint = state.pageKind === 'looper_mint';
  const previewImage = isMint
    ? 'https://helixa.xyz/multipass/loopers-mint-preview-20260910a.jpg'
    : 'https://helixa.xyz/multipass/loopers-allowlist-preview-20260826c.jpg';
  setDocumentMeta('name', 'description', isMint ? 'Mint Loopers on Base.' : 'something new is coming...');
  setDocumentMeta('property', 'og:url', isMint ? 'https://helixa.xyz/mint' : 'https://helixa.xyz/allowlist?x=20260826c');
  setDocumentMeta('property', 'og:title', 'Loopers');
  setDocumentMeta('property', 'og:description', isMint ? 'Mint Loopers on Base.' : 'something new is coming...');
  setDocumentMeta('property', 'og:image', previewImage);
  setDocumentMeta('property', 'og:image:secure_url', previewImage);
  setDocumentMeta('property', 'og:image:alt', 'Loopers preview');
  setDocumentMeta('name', 'twitter:title', 'Loopers');
  setDocumentMeta('name', 'twitter:description', isMint ? 'Mint Loopers on Base.' : 'something new is coming...');
  setDocumentMeta('name', 'twitter:image', previewImage);
  setDocumentMeta('name', 'twitter:image:src', previewImage);
  setDocumentMeta('name', 'twitter:image:alt', 'Loopers preview');
}

function setDocumentMeta(attributeName, attributeValue, content) {
  const safeAttributeValue = String(attributeValue).replace(/["\\]/g, '\\$&');
  const selector = attributeName === 'property'
    ? `meta[property="${safeAttributeValue}"]`
    : `meta[name="${safeAttributeValue}"]`;
  let meta = document.querySelector(selector);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(attributeName, attributeValue);
    document.head.append(meta);
  }
  meta.setAttribute('content', content);
}

function isResolvedProfileView(state) {
  if (state.pageKind === 'product_home') return false;
  if (state.resolverStatus === 'loading' || state.resolverStatus === 'error') return false;
  if (Array.isArray(state.lookupMatches) && state.lookupMatches.length > 0) return false;
  if (!state.data) return false;
  if (state.resolverStatus === 'loaded') return true;
  if (typeof window === 'undefined') return false;
  const locationUrl = new URL(window.location.href);
  if (isStaticSwarmProfileRoute(locationUrl)) return true;
  if (getSavedSlugFromLocation(locationUrl)) return true;
  return /^\/(profile|agent)\//.test(locationUrl.pathname);
}

function renderLegacyProfileShell(root, state, handlers = {}) {
  const { data } = state;
  const heroCopy = createHeroCopy(data);
  const agentCarousel = createAgentCarousel(data);
  const selectedAgent = agentCarousel.cards[state.selectedAgentCard] ?? agentCarousel.cards[0];
  const activationState = getActivationState(data, state);
  const fragmentTrustMap = createFragmentTrustMap(data, selectedAgent);
  const proofCards = createProofCards(data, selectedAgent);
  const headerMeta = state.resolverStatus === 'loaded' && data.liveProfilePage?.headerMeta
    ? data.liveProfilePage.headerMeta
    : 'Portable Agent Identities';
  root.innerHTML = `
    <div class="record-shell">
      ${renderRecordHeader(headerMeta)}

      ${renderHomepageHero(heroCopy, data, agentCarousel)}

      ${renderLiveResolver(state)}

      ${renderActivationSummary(activationState)}

      ${renderSavePanel(state)}

      ${renderClaimManagementPanel(state)}

      ${renderSharePanel(data, heroCopy)}

      ${renderAgentCarousel(agentCarousel, selectedAgent, state.selectedAgentCard)}

      ${renderAgentAura(data.visualIdentity)}

      ${renderAgentAuraProvenanceDrawer(data.visualIdentity?.provenanceDrawer)}

      ${renderMarketplaceListing(data.marketplaceListing)}

      ${renderFragmentTrustMap(fragmentTrustMap)}

      ${renderProofLedger(proofCards, state.expandedCard)}

      <footer class="footer-note">${escapeHtml(['activated', 'saved'].includes(activationState.kind)
        ? 'Public agent profile. Viewing cannot execute approvals, change authority, expose private credentials, or alter live routes.'
        : 'This is a public Multipass profile. Wallet claims, saved records, and live route updates require activation.'
      )}</footer>
    </div>
  `;

  bindProfileEvents(root, state, handlers);
}

function renderProfileLoadingShell(root, state, handlers = {}) {
  const input = String(state.resolverInFlightInput ?? state.resolverInput ?? '').trim();
  const label = input || 'this agent';
  root.innerHTML = `
    <div class="record-shell profile-loading-shell">
      ${renderRecordHeader('Loading live Multipass')}
      <main class="profile-loading-view" aria-label="Loading live Multipass profile">
        ${renderLiveResolver(state)}
        <p class="resolver-message">Loading live Multipass for ${escapeHtml(label)}. No stale profile content is shown while the live record resolves.</p>
      </main>
    </div>
  `;

  bindProfileEvents(root, state, handlers);
}

function renderProfilePage(root, state, handlers = {}) {
  const { data } = state;
  const heroCopy = createHeroCopy(data);
  const agentCarousel = createAgentCarousel(data);
  const selectedAgent = selectProfileAgent(data, agentCarousel, state.selectedAgentCard);
  const activationState = getActivationState(data, state);
  const isGroupProfile = isSavedGroupMultipassProfile(data);
  const fragmentTrustMap = isGroupProfile ? null : createFragmentTrustMap(data, selectedAgent);
  const proofCards = isGroupProfile ? [] : createProofCards(data, selectedAgent);
  const visualIdentity = createProfileVisualIdentity(data, selectedAgent);
  const headerMeta = data.liveProfilePage?.headerMeta ?? 'Portable Agent Identities';

  const auraTitle = getProfileAuraTitle(data, selectedAgent);
  const auraSharePath = getProfileAuraSharePath(data, selectedAgent);
  const detailDrawers = isGroupProfile
    ? renderSavedGroupProfileDetailDrawers({ data, state })
    : renderProfileDetailDrawers({ data, heroCopy, activationState, fragmentTrustMap, proofCards, visualIdentity, selectedAgent, state });
  const footerCopy = isGroupProfile
    ? 'Public parent Multipass. Viewing cannot execute approvals, change authority, expose private credentials, or alter live routes.'
    : (['activated', 'saved'].includes(activationState.kind)
      ? 'Public agent profile. Viewing cannot execute approvals, change authority, expose private credentials, or alter live routes.'
      : 'This is a public Multipass profile. Wallet claims, saved records, and live route updates require activation.');

  root.innerHTML = `
    <div class="record-shell">
      ${renderRecordHeader(headerMeta)}
      <main class="multipass-profile-page${isGroupProfile ? ' group-multipass-profile-page' : ''}">
        ${renderAgentAura(visualIdentity, { title: auraTitle, sharePath: auraSharePath })}
        ${detailDrawers}
        <footer class="footer-note">
          <button class="profile-home-button" type="button" data-action="reset-static-demo">Back to Multipass home</button>
          <span>${escapeHtml(footerCopy)}</span>
        </footer>
      </main>
    </div>
  `;

  bindProfileEvents(root, state, handlers);
}

function bindProfileEvents(root, state, handlers = {}) {
  bindSiteMenu(root);
  root.querySelectorAll('[data-action="select-agent-card"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedAgentCard = Number(button.dataset.index);
      render(root, state, handlers);
      root.querySelector(`[data-action="select-agent-card"][data-index="${state.selectedAgentCard}"]`)?.focus();
    });
  });

  root.querySelectorAll('[data-action="toggle-json"]').forEach((button) => {
    button.addEventListener('click', () => {
      const cardIndex = Number(button.dataset.index);
      state.expandedCard = state.expandedCard === cardIndex ? null : cardIndex;
      render(root, state, handlers);
      root.querySelector(`[data-action="toggle-json"][data-index="${cardIndex}"]`)?.focus();
    });
  });

  root.querySelector('[data-action="resolve-live-agent"]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.querySelector('input[name="agent"]')?.value ?? '';
    if (isRetryBlocked(state)) return;
    if (state.resolverStatus === 'loading' && input.trim() === state.resolverInFlightInput) return;
    handlers.resolveLiveAgent?.(input);
  });

  root.querySelector('[data-action="save-multipass"]')?.addEventListener('click', () => handlers.saveCurrentMultipass?.());
  root.querySelector('[data-action="claim-with-wallet"]')?.addEventListener('click', () => handlers.claimWithWallet?.());
  root.querySelector('[data-action="submit-manual-review"]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    handlers.submitManualReview?.(event);
  });
  root.querySelector('[data-action="update-public-profile"]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    handlers.updatePublicProfile?.(event);
  });
  root.querySelector('[data-action="logout-manager-session"]')?.addEventListener('click', () => handlers.logoutManagerSession?.());
  root.querySelectorAll('[data-action="share-profile"]').forEach((button) => {
    button.addEventListener('click', () => shareProfileFromButton(button));
  });
  bindFragmentManager(root, handlers);
  bindRouteManager(root, handlers);
  bindMarketplaceConnectionManager(root, handlers);
  bindToolManager(root, handlers);
  root.querySelector('[data-action="reset-static-demo"]')?.addEventListener('click', () => handlers.resetStaticDemo?.());
  root.querySelectorAll('[data-action="resolve-example-agent"]').forEach((button) => {
    button.addEventListener('click', () => handlers.resolveLiveAgent?.(button.getAttribute('data-agent') ?? ''));
  });
  root.querySelectorAll('[data-action="select-lookup-match"]').forEach((button) => {
    button.addEventListener('click', () => handlers.resolveLiveAgent?.(button.dataset.tokenId ?? ''));
  });
}

function bindSiteMenu(root) {
  const button = root.querySelector('[data-action="toggle-site-menu"]');
  const menu = root.querySelector('#site-menu');
  if (!button || !menu) return;
  button.addEventListener('click', () => {
    const expanded = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', expanded ? 'false' : 'true');
    menu.hidden = expanded;
  });
}

function selectProfileAgent(data, carousel, selectedIndex = 0) {
  const cards = carousel.cards ?? [];
  const resolverTokenId = data.resolver?.tokenId ?? data.profile?.token_id ?? data.profile?.tokenId ?? getTokenIdFromMultipassSharePath(data.liveProfilePage?.sharePath);
  const resolverCanonicalId = data.resolver?.canonicalId ?? data.profile?.helixa_id ?? data.profile?.helixaId;
  const displayName = data.profile?.display_name ?? data.liveProfilePage?.headline;

  const byToken = findAgentCard(cards, (card) => String(card.tokenId ?? '') === String(resolverTokenId ?? ''));
  if (byToken) return byToken;

  const byHelixa = findAgentCard(cards, (card) => String(card.helixaId ?? '') === String(resolverCanonicalId ?? ''));
  if (byHelixa) return byHelixa;

  const normalizedName = normalizeAgentName(displayName);
  const byName = findAgentCard(cards, (card) => normalizeAgentName(card.name) === normalizedName);
  if (byName) return byName;

  return cards[selectedIndex] ?? cards[0] ?? null;
}

function getTokenIdFromMultipassSharePath(sharePath) {
  try {
    const parsed = new URL(String(sharePath ?? ''), 'https://helixa.xyz');
    if (parsed.pathname !== '/multipass/') return null;
    const agent = parsed.searchParams.get('agent');
    return /^\d+$/.test(String(agent ?? '')) ? agent : null;
  } catch {
    return null;
  }
}

function findAgentCard(cards, predicate) {
  return cards.find((card) => predicate(card)) ?? null;
}

function normalizeAgentName(value) {
  return String(value ?? '')
    .replace(/\bMultipass\b/gi, '')
    .trim()
    .toLowerCase();
}

function createProfileVisualIdentity(data, selectedAgent) {
  const managerAvatarUrl = safeHttpsUrl(data.profile?.discovery_profile?.avatar_url ?? data.profile?.avatar_url);
  const baseVisual = !managerAvatarUrl && data.visualIdentity && ['helixa_aura', 'aura'].includes(data.visualIdentity.source)
    ? data.visualIdentity
    : null;

  const name = selectedAgent?.name ?? data.profile?.display_name ?? data.liveProfilePage?.headline ?? 'Multipass visual';
  const tokenId = selectedAgent?.tokenId ?? data.resolver?.tokenId ?? data.profile?.token_id;
  const helixaId = selectedAgent?.helixaId ?? data.resolver?.canonicalId ?? data.profile?.multipass_id;
  const intuition = getPublicAgentIntuitionContext(selectedAgent?.intuition);
  const trustChips = [
    helixaId,
    selectedAgent?.credLabel,
    intuition ? `Intuition graph: ${intuition.label}` : null,
    selectedAgent?.verifiedLabel,
    selectedAgent?.custody,
  ].filter(hasRenderableValue);

  if (baseVisual) {
    return {
      ...baseVisual,
      chips: mergeChips([...(baseVisual.chips ?? []), ...trustChips]),
      trustNote: intuition?.note ?? baseVisual.trustNote ?? null,
    };
  }

  const imageUrl = managerAvatarUrl
    ?? selectedAgent?.visual?.imageUrl
    ?? (/^\d+$/.test(String(tokenId ?? '')) ? `https://api.helixa.xyz/api/v2/aura/${tokenId}.png` : null);
  const visualSourceLabel = managerAvatarUrl ? 'Manager public avatar URL' : (selectedAgent?.visual?.label ?? (tokenId ? `Helixa aura route for token ${tokenId}` : 'Generated fallback initials'));

  return {
    source: 'helixa_aura',
    label: selectedAgent?.visual?.label ?? `${name} visual identity`,
    initials: selectedAgent?.visual?.initials ?? initialsForDisplayName(name),
    tone: selectedAgent?.visual?.tone ?? String(data.profile?.cred_summary?.trust_state ?? 'pending').toLowerCase(),
    imageUrl,
    chips: trustChips,
    trustNote: intuition?.note ?? null,
    provenanceDrawer: {
      title: `${name} visual provenance`,
      summary: 'Visual identity is synthesized from public Multipass profile context when no dedicated aura metadata is published.',
      facts: [
        { label: 'Profile', value: name },
        { label: 'Identifier', value: helixaId ?? 'Public identifier pending' },
        { label: 'Visual source', value: visualSourceLabel },
      ],
      safetyNote: 'Public visual context. Viewing does not grant ownership, custody, approvals, or route authority.',
    },
  };
}

function mergeChips(chips) {
  const seen = new Set();
  return chips.filter((chip) => {
    if (!hasRenderableValue(chip)) return false;
    const key = String(chip).trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getProfileAuraTitle(data, selectedAgent) {
  const rawTitle = selectedAgent?.name ?? data.profile?.display_name ?? data.liveProfilePage?.headline ?? data.visualIdentity?.label ?? 'Multipass profile';
  return String(rawTitle).replace(/\s+Multipass$/i, '').trim() || 'Multipass profile';
}

function getProfileAuraSharePath(data, selectedAgent) {
  if (isSafeMultipassSharePath(data.liveProfilePage?.sharePath)) return data.liveProfilePage.sharePath;

  const candidates = [
    selectedAgent?.tokenId,
    data.resolver?.tokenId,
    data.profile?.token_id,
    String(data.resolver?.canonicalId ?? '').match(/^\d+:(\d+)$/)?.[1],
    String(data.profile?.multipass_id ?? '').match(/^\d+:(\d+)$/)?.[1],
  ];
  const tokenId = candidates.map((value) => String(value ?? '').trim()).find((value) => /^\d+$/.test(value));
  const generatedCard = getAgentShareCard(tokenId, GENERATED_SHARE_CARDS);
  return getAgentSharePath(generatedCard);
}

function initialsForDisplayName(value) {
  const words = String(value ?? 'MP').match(/[a-z0-9]+/gi) ?? ['M', 'P'];
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase() ?? '').join('') || 'MP';
}

function isSavedGroupMultipassProfile(data = {}) {
  const subjectType = String(data.profile?.subject_type ?? data.profile?.subjectType ?? '').toLowerCase();
  return data.modeLabel === 'Activated Multipass' && ['swarm', 'collection'].includes(subjectType);
}

function renderSavedGroupProfileDetailDrawers({ data, state }) {
  const subjectType = normalizeGroupSubjectType(data.profile?.subject_type ?? data.profile?.subjectType);
  const rosterTitle = `${titleCase(subjectType)} roster`;
  const overview = renderSavedGroupOverview(data, subjectType);
  const roster = renderSavedGroupRosterContext(data, subjectType);
  const management = renderClaimManagementPanel(state) || renderProfileInfoPanel(
    'Ownership and management',
    'Public visitors can inspect this parent Multipass only. Management requires source-owner proof; viewing cannot expose private credentials or alter live routes.'
  );
  const proofSummary = renderSavedGroupProofSummary(data);
  const publicGroupFragments = getPublicGroupFragments(data);

  return `
    <section class="profile-detail-drawers group-profile-detail-drawers" aria-label="Parent Multipass details">
      ${renderProfileDrawer('Parent Multipass', `${titleCase(subjectType)} identity and share state`, overview, { open: true, stat: data.liveProfilePage?.sharePath ? 'Public URL' : 'Profile state' })}
      ${renderProfileDrawer(rosterTitle, 'Resolved public AgentDNA member context', roster, { open: true, stat: 'Public roster' })}
      ${renderProfileDrawer('Ownership and management', 'Source-owner management context', management, { stat: 'View only' })}
      ${renderProfileDrawer('Public member proof', 'Visible group evidence without raw fragment IDs', proofSummary, { stat: formatDrawerCount(publicGroupFragments.length, 'public signal', 'public signals') })}
    </section>
  `;
}

function renderSavedGroupOverview(data, subjectType) {
  const profile = data.profile ?? {};
  const displayName = profile.display_name ?? data.liveProfilePage?.headline ?? 'Group Multipass';
  const summary = profile.summary ?? `${displayName} is a public parent Multipass for a ${subjectType} roster.`;
  const sharePath = isSafeMultipassSharePath(data.liveProfilePage?.sharePath) ? data.liveProfilePage.sharePath : '';
  return `
    <section class="group-profile-panel group-profile-overview">
      <p class="card-label">Parent Multipass</p>
      <h2>${escapeHtml(displayName)}</h2>
      <p>${escapeHtml(summary)}</p>
      <dl class="group-profile-facts">
        <div><dt>Subject type</dt><dd>${escapeHtml(titleCase(subjectType))}</dd></div>
        <div><dt>Share route</dt><dd>${escapeHtml(sharePath || 'Safe share route pending')}</dd></div>
        <div><dt>Status</dt><dd>${escapeHtml(profile.status ?? 'public metadata')}</dd></div>
      </dl>
      <p class="group-profile-safety">Public parent Multipass metadata only. Viewing cannot execute approvals, change authority, expose private credentials, or alter live routes.</p>
    </section>
  `;
}

function renderSavedGroupRosterContext(data, subjectType) {
  const fragments = getPublicGroupFragments(data);
  const rosterFragment = findGroupFragment(fragments, 'roster') ?? fragments.find((fragment) => String(fragment.public_value ?? '').toLowerCase().includes('roster'));
  const policyFragment = findGroupFragment(fragments, 'policy') ?? fragments.find((fragment) => String(fragment.public_value ?? '').toLowerCase().includes('policy'));
  const credFragment = findGroupFragment(fragments, 'cred') ?? fragments.find((fragment) => fragment.fragment_type === 'risk_summary');
  const entries = [
    rosterFragment ? { label: `${titleCase(subjectType)} members`, value: rosterFragment.public_value } : null,
    policyFragment ? { label: 'Shared policy', value: policyFragment.public_value } : null,
    credFragment ? { label: 'Member Cred context', value: credFragment.public_value } : null,
  ].filter(Boolean);

  if (!entries.length) {
    return renderProfileInfoPanel('Public member roster', 'No public roster fragment is published for this parent Multipass yet.');
  }

  return `
    <section class="group-roster-context">
      <p class="card-label">Public member roster</p>
      <h2>${escapeHtml(titleCase(subjectType))} member context</h2>
      <div class="group-roster-items">
        ${entries.map((entry) => `
          <article class="group-roster-item">
            <strong>${escapeHtml(entry.label)}</strong>
            <p>${escapeHtml(entry.value)}</p>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

function renderSavedGroupProofSummary(data) {
  const fragments = getPublicGroupFragments(data);
  if (!fragments.length) return renderProfileInfoPanel('Public member proof', 'No public group fragments are published yet.');
  return `
    <section class="group-proof-summary">
      <p class="card-label">Public group evidence</p>
      <div class="group-proof-list">
        ${fragments.map((fragment) => `
          <article class="group-proof-item">
            <strong>${escapeHtml(formatDisplayLabel(fragment.fragment_type ?? 'fragment'))}</strong>
            <span>${escapeHtml(formatDisplayLabel(fragment.status ?? 'pending'))}</span>
            <p>${escapeHtml(fragment.public_value ?? 'Public value pending.')}</p>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

function getPublicGroupFragments(data = {}) {
  return (data.fragments?.fragments ?? []).filter((fragment) => fragment?.visibility === 'public');
}

function findGroupFragment(fragments, marker) {
  const normalizedMarker = String(marker ?? '').toLowerCase();
  return fragments.find((fragment) => {
    const id = String(fragment.fragment_id ?? '').toLowerCase();
    const sourceId = String(fragment.source?.source_id ?? '').toLowerCase();
    return id.includes(normalizedMarker) || sourceId.includes(normalizedMarker);
  }) ?? null;
}

function normalizeGroupSubjectType(value) {
  const normalized = String(value ?? '').toLowerCase();
  return ['swarm', 'collection'].includes(normalized) ? normalized : 'group';
}

function titleCase(value) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return '';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatDisplayLabel(value) {
  return String(value ?? '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function renderProfileDetailDrawers({ data, heroCopy, activationState, fragmentTrustMap, proofCards, visualIdentity, selectedAgent, state }) {
  const drawerStats = createProfileDrawerStats({ data, activationState, fragmentTrustMap, proofCards, visualIdentity, state });
  const selectedAgentDetail = selectedAgent?.detailMode === 'swarm'
    ? renderProfileDrawer('Swarm roster', 'Members, policy references, custody, and transfer behavior', [
        renderAgentCardDetail(selectedAgent),
        renderOwnerCustodySnapshot(selectedAgent.ownerSnapshot),
        renderChangeReviewLedger(selectedAgent.changeReviewLedger),
        renderTransferPreview(selectedAgent),
      ].join(''), { open: true, stat: selectedAgent.memberLabel ?? 'Swarm view' })
    : '';
  const shareAndStatus = [
    data.heroNote ? renderProfileInfoPanel('Profile note', data.heroNote) : '',
    state.resolverStatus === 'loaded' ? '<p class="resolver-message">Live source resolved into an activation preview. No approvals, custody, or authority changes.</p>' : '',
    renderSharePanel(data, heroCopy),
    renderActivationPreviewPanel(state, activationState),
    renderSavePanel(state),
    renderActivationSummary(activationState),
  ].join('');
  const claimManagement = renderClaimManagementPanel(state) || renderProfileInfoPanel(
    'Ownership and management',
    'Public visitors can inspect this public agent profile only. Management requires source-owner proof; viewing cannot transfer custody, expose private credentials, or change live routes.'
  );
  const provenance = renderAgentAuraProvenanceDrawer(visualIdentity?.provenanceDrawer) || renderProfileInfoPanel(
    'Visual provenance',
    'No dedicated visual provenance has been published for this profile yet.'
  );
  const publicRoutes = renderPublicRoutesPanel(data);
  const marketplacePresence = renderMarketplacePresencePanel(data);
  const trustContext = [publicRoutes, marketplacePresence, renderMarketplaceListing(data.marketplaceListing)].filter(Boolean).join('') || renderProfileInfoPanel(
    'Trust context',
    'Marketplace and route compatibility context is not published for this profile yet. Public proof remains available below.'
  );
  const publicTools = renderPublicToolsPanel(data) || renderProfileInfoPanel(
    'Tools and services',
    'No public tool cards are published for this profile yet.'
  );
  const communication = renderCommunicationChannelsPanel(data);

  return `
    <section class="profile-detail-drawers" aria-label="Multipass profile details">
      ${selectedAgentDetail}
      ${renderProfileDrawer('Share and status', 'Public URL and display state', shareAndStatus, { stat: drawerStats.shareAndStatus })}
      ${renderProfileDrawer('Ownership and management', 'Source-owner authority context', claimManagement, { stat: drawerStats.ownership })}
      ${renderProfileDrawer('Visual provenance', 'Source and safety notes', provenance, { stat: drawerStats.visualProvenance })}
      ${renderProfileDrawer('Trust context', 'Routes and marketplace compatibility', trustContext, { stat: drawerStats.trustContext })}
      ${renderProfileDrawer('Communication', 'Public contact and social routes', communication, { stat: drawerStats.communication })}
      ${renderProfileDrawer('Tools and services', 'Registry-backed public capabilities', publicTools, { stat: drawerStats.publicTools })}
      ${renderProfileDrawer('Public proof fragments', 'Visible profile evidence', renderFragmentTrustMap(fragmentTrustMap), { stat: drawerStats.publicProofFragments })}
      ${renderProfileDrawer('Proof ledger', 'Expandable API records', renderProofLedger(proofCards, state.expandedCard), { stat: drawerStats.proofLedger })}
    </section>
  `;
}

function createProfileDrawerStats({ data, activationState, fragmentTrustMap, proofCards, visualIdentity, state }) {
  const publicProofCount = Array.isArray(fragmentTrustMap?.cards)
    ? fragmentTrustMap.cards.length
    : countPublicProofSignals(data);
  const routeCount = getPublicRouteFragments(data).length;
  const marketplaceCount = getMarketplacePresenceEntries(data).length + (data.marketplaceListing ? 1 : 0);
  const trustCount = routeCount + marketplaceCount;
  const communicationCount = getCommunicationChannels(data).length;
  const toolCount = getPublicTools(data).length;

  return {
    shareAndStatus: data.liveProfilePage?.sharePath ? 'Public URL' : 'Profile state',
    ownership: state.claimStatus === 'claimed' || activationState.kind === 'saved' ? 'Manager ready' : 'View only',
    visualProvenance: visualIdentity?.imageUrl ? 'Visual source' : 'Source notes',
    trustContext: trustCount ? formatDrawerCount(trustCount, 'trust ref', 'trust refs') : 'Trust notes',
    communication: communicationCount ? formatDrawerCount(communicationCount, 'contact route', 'contact routes') : 'No contacts',
    publicTools: toolCount ? formatDrawerCount(toolCount, 'tool', 'tools') : 'No tools',
    publicProofFragments: formatDrawerCount(publicProofCount, 'public signal', 'public signals'),
    proofLedger: formatDrawerCount(proofCards.length, 'API record', 'API records'),
  };
}

function formatDrawerCount(count, singular, plural) {
  const value = Number.isFinite(Number(count)) ? Number(count) : 0;
  return `${value} ${value === 1 ? singular : plural}`;
}

function renderProfileDrawer(title, subtitle, html, options = {}) {
  if (!String(html ?? '').trim()) return '';
  const open = options.open ? ' open' : '';
  const subtitleHtml = subtitle ? `<small>${escapeHtml(subtitle)}</small>` : '';
  const statHtml = options.stat ? `<strong class="profile-detail-drawer-stat">${escapeHtml(options.stat)}</strong>` : '';
  return `
    <details class="profile-detail-drawer"${open}>
      <summary>
        <div class="profile-detail-drawer-heading"><span>${escapeHtml(title)}</span>${subtitleHtml}</div>
        <div class="profile-detail-drawer-affordance">${statHtml}<i class="profile-detail-drawer-chevron" aria-hidden="true">›</i></div>
      </summary>
      <div class="profile-detail-drawer-body">${html}</div>
    </details>
  `;
}

function renderProfileInfoPanel(title, body) {
  return `
    <section class="profile-info-panel">
      <p class="card-label">${escapeHtml(title)}</p>
      <p>${escapeHtml(body)}</p>
    </section>
  `;
}

function renderProofLedger(proofCards, expandedCard) {
  return `
    <section class="proof-ledger">
      <div class="ledger-title"><h2>Proof ledger</h2><span>Expandable API records</span></div>
      ${proofCards.map((card, index) => renderProofRow(card, index, expandedCard)).join('')}
    </section>
  `;
}


const MULTIPASS_INPUT_SIGNALS = ['AgentDNA', 'Owner wallet', 'Manager agent', 'Endpoints', 'NFT provenance'];
const MULTIPASS_CORE_SIGNALS = ['Human-owned', 'Agent-managed', 'Standards-readable'];
const MULTIPASS_PROFILE_SIGNALS = ['Public proof', 'Permissions', 'Work routes', 'Trust context', 'Shareable profile'];
const MULTIPASS_PROTOCOL_CHIPS = ['ERC-8004', 'AgentDNA', 'Cred', 'x401', 'x402', 'MCP/A2A'];

function renderMultipassSignalList(items) {
  return items.map((item) => `<span>${escapeHtml(item)}</span>`).join('');
}

function renderMultipassWhatItDoesPanel() {
  return `
    <aside class="homepage-proof-panel multipass-system-panel" aria-label="What Multipass does">
      <div class="system-panel-copy">
        <p class="card-label">What it does</p>
        <h2>Multipass turns scattered agent identity into one readable public agent profile.</h2>
        <p>It connects identity, ownership and permissions, endpoints, proof, work history, and trust context into one portable profile humans and agents can verify.</p>
      </div>
      <div class="multipass-system-map" aria-label="Multipass identity system map">
        <section class="system-node system-node-inputs">
          <p>Identity inputs</p>
          <div>${renderMultipassSignalList(MULTIPASS_INPUT_SIGNALS)}</div>
        </section>
        <section class="system-node system-node-core">
          <strong>Multipass</strong>
          <div>${renderMultipassSignalList(MULTIPASS_CORE_SIGNALS)}</div>
        </section>
        <section class="system-node system-node-profile">
          <p>Usable profile</p>
          <div>${renderMultipassSignalList(MULTIPASS_PROFILE_SIGNALS)}</div>
        </section>
      </div>
      <div class="multipass-protocol-strip" aria-label="Supported protocol context">
        ${renderMultipassSignalList(MULTIPASS_PROTOCOL_CHIPS)}
      </div>
    </aside>
  `;
}

function renderProductHome(root, state, handlers = {}) {
  const data = state.data;
  const agentCarousel = createAgentCarousel(data);
  root.innerHTML = `
    <div class="record-shell product-home-shell">
      ${renderRecordHeader('Portable Agent Identities')}

      <section class="product-hero">
        <div class="product-hero-copy">
          <div class="product-hero-main">
            <p class="eyebrow">What it is</p>
            <h1>Portable identity profiles for agents.</h1>
            <p class="lead">Multipass turns agent records into shareable profiles with public proof, ownership context, routes, and update history.</p>
            <div class="homepage-actions">
              <a href="/multipass/console" class="homepage-action primary">Open Console</a>
              <a href="/multipass/agents" class="homepage-action">View agents</a>
              <a href="#live-resolver" class="homepage-action">Activate an agent</a>
            </div>
          </div>
          ${renderAgentVisualStrip(agentCarousel, state.selectedAgentCard, state)}
        </div>
      </section>

      ${renderMultipassWhatItDoesPanel()}

      ${renderLiveResolver(state, { showResetButton: state.resolverStatus === 'loading' || state.resolverStatus === 'error', showGroupActivationButton: true })}

      ${state.groupActivationExpanded ? renderGroupActivationSection(state.groupActivation) : ''}
    </div>
  `;

  bindProductHomeEvents(root, handlers, state);
}

export function captureConsoleInteractionState(root) {
  const timeline = root?.querySelector?.('.console-thread-messages') ?? null;
  const composer = root?.querySelector?.('#console-agent-message') ?? null;
  const documentRef = root?.ownerDocument ?? (typeof document === 'undefined' ? null : document);
  return {
    timeline: timeline ? {
      present: true,
      roomKey: String(timeline.dataset?.consoleRoomKey ?? ''),
      scrollRequest: String(timeline.dataset?.consoleScrollRequest ?? '0'),
      identities: [...timeline.querySelectorAll('[data-console-message-identity]')]
        .map((entry) => String(entry.dataset?.consoleMessageIdentity ?? '')),
      scrollTop: Number(timeline.scrollTop ?? 0),
      scrollHeight: Number(timeline.scrollHeight ?? 0),
      clientHeight: Number(timeline.clientHeight ?? 0),
      nearBottom: Number(timeline.scrollHeight ?? 0) - Number(timeline.scrollTop ?? 0) - Number(timeline.clientHeight ?? 0) <= 48,
    } : { present: false },
    composer: composer ? {
      present: true,
      value: composer.value,
      focused: documentRef?.activeElement === composer,
      selectionStart: composer.selectionStart,
      selectionEnd: composer.selectionEnd,
      selectionDirection: composer.selectionDirection,
    } : { present: false },
    network: documentRef?.activeElement?.matches?.('[data-restap-focus-key]') && root?.contains?.(documentRef.activeElement)
      ? { key: String(documentRef.activeElement.dataset.restapFocusKey ?? '') }
      : { key: null },
  };
}

export function restoreConsoleInteractionState(root, previous = {}) {
  const timeline = root?.querySelector?.('.console-thread-messages') ?? null;
  let successfulLocalSend = false;
  if (timeline) {
    const prior = previous.timeline ?? { present: false };
    const nextRoomKey = String(timeline.dataset?.consoleRoomKey ?? '');
    const nextScrollRequest = String(timeline.dataset?.consoleScrollRequest ?? '0');
    const nextIdentities = [...timeline.querySelectorAll('[data-console-message-identity]')]
      .map((entry) => String(entry.dataset?.consoleMessageIdentity ?? ''));
    const roomChanged = !prior.present || prior.roomKey !== nextRoomKey;
    successfulLocalSend = prior.present && prior.scrollRequest !== nextScrollRequest;
    const strictIncomingAppend = prior.present
      && prior.roomKey === nextRoomKey
      && prior.identities.length < nextIdentities.length
      && prior.identities.every((identity, index) => identity === nextIdentities[index]);
    if (roomChanged || successfulLocalSend || (strictIncomingAppend && prior.nearBottom)) {
      timeline.scrollTop = timeline.scrollHeight;
    } else if (prior.present) {
      timeline.scrollTop = prior.scrollTop;
    }
  }

  const networkKey = String(previous.network?.key ?? '');
  if (networkKey) {
    const target = [...(root?.querySelectorAll?.('[data-restap-focus-key]') ?? [])]
      .find((node) => node.dataset.restapFocusKey === networkKey && !node.disabled);
    target?.focus?.({ preventScroll: true });
  }

  const priorComposer = previous.composer ?? { present: false };
  const composer = root?.querySelector?.('#console-agent-message') ?? null;
  if (!composer || !priorComposer.present || successfulLocalSend) return;
  composer.value = priorComposer.value;
  if (Number.isInteger(priorComposer.selectionStart) && Number.isInteger(priorComposer.selectionEnd)) {
    const length = composer.value.length;
    composer.setSelectionRange(
      Math.min(priorComposer.selectionStart, length),
      Math.min(priorComposer.selectionEnd, length),
      priorComposer.selectionDirection ?? 'none',
    );
  }
  if (priorComposer.focused) composer.focus({ preventScroll: true });
}

function deferConsoleRenderForFocusedSelector(root, state, handlers) {
  const documentRef = root?.ownerDocument ?? (typeof document === 'undefined' ? null : document);
  const selector = documentRef?.activeElement;
  if (!selector?.matches?.('[data-action="select-console-agent"]') || !root?.contains?.(selector)) return false;

  deferredConsoleRenders.set(root, { state, handlers });
  if (selector.dataset.consoleRenderDeferred === 'true') return true;
  selector.dataset.consoleRenderDeferred = 'true';
  selector.addEventListener('blur', () => {
    const pending = deferredConsoleRenders.get(root);
    deferredConsoleRenders.delete(root);
    if (pending) render(root, pending.state, pending.handlers);
  }, { once: true });
  return true;
}

export function bindConsoleAvatarFallbacks(root) {
  for (const image of root?.querySelectorAll?.('[data-console-avatar-image]') ?? []) {
    image.addEventListener('error', () => {
      const fallback = image.parentElement?.querySelector?.('.console-thread-avatar-fallback');
      image.remove();
      if (fallback) fallback.hidden = false;
    }, { once: true });
  }
}

function renderSwarmAdminPage(root, state, handlers = {}) {
  root.innerHTML = `
    <div class="record-shell swarm-admin-shell">
      ${renderRecordHeader('Swarm Admin')}
      ${renderSwarmAdmin({ state: state.swarmAdmin, wallet: state.walletSnapshot })}
    </div>
  `;
  bindSiteMenu(root);
  bindSwarmAdmin(root, { connect: handlers.connectSwarmAdminWallet, approve: handlers.approveSwarmSafeHash });
}

function renderMultipassConsolePage(root, state, handlers = {}) {
  const interactionState = captureConsoleInteractionState(root);
  const agents = getConsoleDisplayAgents(state);
  const snapshot = createMultipassConsoleSnapshot({ data: state.data, state, agents });
  const headerWalletAction = createConsoleHeaderWalletAction(state);
  root.innerHTML = `
    <div class="record-shell multipass-console-shell">
      ${renderRecordHeader(null, { primaryAction: headerWalletAction })}
      ${renderMultipassConsole(snapshot)}
    </div>
  `;

  bindProductHomeEvents(root, handlers, state);
  bindConsoleAvatarFallbacks(root);
  restoreConsoleInteractionState(root, interactionState);
}

function renderLooperMarketplacePage(root, state, handlers = {}) {
  const activeSearch = root.querySelector?.('[data-marketplace-search]');
  const searchInteraction = activeSearch && root.ownerDocument?.activeElement === activeSearch
    ? {
        start: activeSearch.selectionStart,
        end: activeSearch.selectionEnd,
        direction: activeSearch.selectionDirection,
      }
    : null;
  root.innerHTML = `
    <div class="record-shell looper-marketplace-shell">
      ${renderRecordHeader(state.looperMarketplace.route.kind === 'detail' ? `Activated Multipass · 8453:${state.looperMarketplace.route.tokenId}` : 'Agent Collectibles')}
      ${renderLooperMarketplace(state.looperMarketplace)}
    </div>
  `;
  bindSiteMenu(root);
  bindLooperMarketplace(root, {
    retry: handlers.refreshLooperMarketplace,
    setView: handlers.setLooperMarketplaceView,
    setSearch: handlers.setLooperMarketplaceSearch,
    setSort: handlers.setLooperMarketplaceSort,
  });
  if (searchInteraction) {
    const search = root.querySelector('[data-marketplace-search]');
    search?.focus({ preventScroll: true });
    if (search && searchInteraction.start !== null && searchInteraction.end !== null) {
      search.setSelectionRange(searchInteraction.start, searchInteraction.end, searchInteraction.direction ?? 'none');
    }
  }
}

function renderRuntimeSubmissionPage(root, state, handlers = {}) {
  root.innerHTML = `
    <div class="record-shell runtime-submission-shell">
      ${renderRecordHeader('Bankr RUNTIME Submission')}
      ${renderRuntimeSubmission()}
    </div>
  `;

  bindProductHomeEvents(root, handlers, state);
}

function renderLooperAllowlistPage(root, state, handlers = {}) {
  root.innerHTML = `
    <div class="record-shell looper-allowlist-shell">
      <section class="looper-allowlist-hero" aria-label="Loopers allowlist">
        ${renderLooperAllowlistPanel(state.looperAllowlist, { standalone: true, walletSnapshot: state.walletSnapshot })}
      </section>
    </div>
  `;

  bindProductHomeEvents(root, handlers, state);
}

function createConsoleHeaderWalletAction(state = {}) {
  const wallet = state.walletSnapshot ?? {};
  const consoleStatus = state.consoleWalletStatus;
  const busy = consoleStatus === 'connecting' || consoleStatus === 'preparing_signature' || consoleStatus === 'signing' || consoleStatus === 'loading_roster';
  const connected = Boolean(wallet.connected && wallet.address);
  const authenticated = connected
    && normalizeConsoleWalletKey(state.consoleAuthenticatedWallet) === normalizeConsoleWalletKey(wallet.address);
  const unavailable = wallet.configured === false;
  const ready = wallet.ready !== false;

  return {
    action: 'connect-console-wallet',
    disabled: busy || unavailable || !ready,
    label: consoleStatus === 'connecting'
      ? 'Connecting...'
      : consoleStatus === 'preparing_signature'
        ? 'Preparing sign-in...'
        : consoleStatus === 'signing'
        ? 'Sign in wallet...'
        : consoleStatus === 'loading_roster'
          ? 'Loading agents...'
          : authenticated
            ? (wallet.label ?? shortenAddress(wallet.address))
            : connected ? 'Sign in' : 'Connect wallet',
  };
}

function renderLooperMintPage(root, state, handlers = {}) {
  root.innerHTML = `
    <div class="record-shell looper-allowlist-shell looper-mint-shell">
      <section class="looper-mint-launch" aria-label="Loopers mint">
        ${renderLooperMintLaunch(state)}
      </section>
    </div>
  `;

  bindProductHomeEvents(root, handlers, state);
}

function renderLooperMintLaunch(state) {
  return `
    <div class="looper-mint-showcase">
      ${renderLooperMintHeroCopy(state.looperMint)}
      ${renderLooperMintHeroArt()}
    </div>
    <div class="looper-mint-action-column">
      ${renderLooperMintPanel(state.looperMint, { walletSnapshot: state.walletSnapshot })}
    </div>
  `;
}

function renderLooperMintHeroCopy(mint = createInitialLooperMintState()) {
  return `
    <div class="looper-mint-hero-copy">
      <p class="looper-mint-kicker">Base mint</p>
      <img class="looper-mint-hero-logo" src="/multipass/loopers-logo.png" width="2002" height="480" alt="Loopers" />
      <h1>Mint your Looper.</h1>
    </div>
  `;
}

function renderLooperMintHeroArt() {
  const loopers = [
    {
      src: '/multipass/looper-mint-sample-01.png',
      variant: 'purple',
      alt: 'Purple laptop Looper from the 7,777 collection.',
    },
    {
      src: '/multipass/looper-mint-sample-02.png',
      variant: 'teal',
      alt: 'Teal tactical Looper from the 7,777 collection.',
    },
    {
      src: '/multipass/looper-mint-sample-03.png',
      variant: 'red',
      alt: 'Red visor Looper from the 7,777 collection.',
    },
  ];

  return `
    <figure class="looper-mint-art-gallery" aria-label="Three Loopers from the collection">
      <div class="looper-mint-art-lineup">
        ${loopers.map((looper) => `
          <span class="looper-mint-art-card looper-mint-art-card-${looper.variant}">
            <img
              class="looper-mint-art-image"
              src="${looper.src}"
              width="1024"
              height="1024"
              alt="${looper.alt}"
              loading="eager"
            />
          </span>
        `).join('')}
      </div>
      <p class="looper-mint-art-tagline">7,777 onchain agents. Yours starts here.</p>
    </figure>
  `;
}

function renderLooperAllowlistPanel(allowlist = createInitialLooperAllowlistState(), options = {}) {
  const input = String(allowlist.input ?? '');
  const registering = allowlist.status === 'registering';
  const resolvingEns = allowlist.status === 'resolving_ens';
  const connectingWallet = allowlist.status === 'connecting_wallet';
  const walletSnapshot = options.walletSnapshot ?? {};
  const walletUnconfigured = walletSnapshot.configured === false;
  const headingTag = options.standalone ? 'h1' : 'h2';
  const compact = Boolean(options.compact);
  return `
    <section class="looper-allowlist-panel${compact ? ' compact' : ''}" aria-label="Loopers allowlist">
      <div class="looper-allowlist-copy">
        ${compact
          ? `<${headingTag}>Need to add a wallet?</${headingTag}>`
          : `<${headingTag} class="looper-allowlist-logo-heading"><span class="looper-allowlist-heading-text">Loopers</span><img class="looper-allowlist-logo" src="/multipass/loopers-logo.png" width="2002" height="480" alt="" aria-hidden="true" /></${headingTag}>`}
        <p>${compact ? 'Register a Base address or Base name for a later allowlist refresh.' : 'something new is coming...'}</p>
      </div>
      <form class="looper-allowlist-form" data-action="register-looper-allowlist">
        <label>
          <span>Add your base address or base name</span>
          <input name="looper_allowlist_address" inputmode="text" autocomplete="off" placeholder="0x... or name.base.eth" value="${escapeAttribute(input)}" ${registering || resolvingEns ? 'disabled' : ''} />
        </label>
        <label class="looper-allowlist-trap" aria-hidden="true" tabindex="-1">
          <span>Contact</span>
          <input name="looper_allowlist_contact" autocomplete="off" tabindex="-1" />
        </label>
        <div class="looper-allowlist-actions">
          <button type="button" class="looper-allowlist-connect-button" data-action="connect-looper-wallet" ${registering || resolvingEns || connectingWallet || walletUnconfigured ? 'disabled' : ''}>${escapeHtml(getLooperAllowlistConnectLabel(walletSnapshot, connectingWallet, walletUnconfigured))}</button>
          <button type="submit" ${registering || resolvingEns ? 'disabled' : ''}>${resolvingEns ? 'Resolving name...' : registering ? 'Registering...' : 'Register address'}</button>
        </div>
      </form>
      <div class="looper-allowlist-helper">
        <p>Connect your wallet to register it automatically, or manually add a Base address/Base name.</p>
        <p>Registration does not guarantee mint access, timing, price, allocation, or final supply.</p>
        <p>Verified wallets may receive priority when the mint phase opens.</p>
      </div>
      ${renderLooperAllowlistStatus(allowlist)}
    </section>
  `;
}

function getLooperAllowlistConnectLabel(walletSnapshot = {}, connectingWallet = false, walletUnconfigured = false) {
  if (connectingWallet) return 'Connecting...';
  if (walletUnconfigured) return 'Wallet unavailable';
  if (walletSnapshot.connected && walletSnapshot.address) return `Connected ${walletSnapshot.label ?? shortenAddress(walletSnapshot.address)}`;
  if (walletSnapshot.ready === false) return 'Loading wallet...';
  return 'Connect wallet';
}

function getLooperAllowlistWalletErrorMessage(error) {
  const message = getWalletErrorMessage(error);
  return message
    .replace(/Wallet signature cancelled\./i, 'Wallet connection cancelled.')
    .replace(/ to sign the owner claim/gi, '');
}

function renderLooperAllowlistStatus(allowlist = createInitialLooperAllowlistState()) {
  if (allowlist.status === 'registered') {
    return `<p class="looper-allowlist-status success" role="status">${escapeHtml(allowlist.result?.address ?? allowlist.input)} is registered for the Looper allowlist.</p>`;
  }
  if (allowlist.status === 'existing') {
    return `<p class="looper-allowlist-status success" role="status">${escapeHtml(allowlist.result?.address ?? allowlist.input)} was already registered.</p>`;
  }
  if (allowlist.status === 'error') {
    return `<p class="looper-allowlist-status error" role="alert">${escapeHtml(allowlist.error ?? 'Allowlist registration failed.')}</p>`;
  }
  return '';
}

function renderLooperMintPanel(mint = createInitialLooperMintState(), options = {}) {
  if (!mint.enabled) return '';
  const walletSnapshot = options.walletSnapshot ?? {};
  const config = mint.config ?? {};
  const contractConfigured = Boolean(config.contractAddress);
  const contractState = mint.contractState ?? null;
  const quantity = Number.isInteger(mint.quantity) ? mint.quantity : 1;
  const loading = mint.status === 'loading';
  const connecting = mint.status === 'connecting_wallet';
  const minting = mint.status === 'minting';
  const walletUnconfigured = walletSnapshot.configured === false;
  const connected = Boolean(walletSnapshot.connected && walletSnapshot.address);
  const phase = contractState?.saleState ?? 'unknown';
  const activePrice = getMintPhasePrice(contractState ?? {});
  const totalPrice = BigInt(activePrice ?? 0) * BigInt(quantity);
  const mintAvailability = getLooperMintAvailability(contractState, quantity, connected, { contractConfigured });
  const canMint = mintAvailability.canMint && !minting && !loading;
  const quantityMax = getLooperMintQuantityMax(contractState);
  const explorerUrl = mint.tx?.hash && config.explorerBaseUrl ? `${config.explorerBaseUrl}/tx/${mint.tx.hash}` : null;

  return `
    <section class="looper-mint-panel" aria-label="Loopers mint">
      <header class="looper-mint-console-header">
        <span class="looper-mint-window-lights" aria-hidden="true">
          <i class="looper-mint-window-light red"></i>
          <i class="looper-mint-window-light yellow"></i>
          <i class="looper-mint-window-light green"></i>
        </span>
        <strong class="looper-mint-window-title">LOOPER MINT v1.0</strong>
        <button type="button" class="looper-mint-refresh-button" data-action="refresh-looper-mint" ${loading || minting || !contractConfigured ? 'disabled' : ''}>${loading ? 'Refreshing...' : 'Refresh'}</button>
      </header>
      <div class="looper-mint-system-grid">
        ${renderLooperMintFact('Contract', config.contractAddress ? shortenAddress(config.contractAddress) : 'Not configured')}
        ${renderLooperMintFact('Adapter8004', contractState ? (contractState.erc8004BindingActive ? 'Active' : 'Pending') : 'Not loaded')}
        ${renderLooperMintFact('8004 registry', contractState?.erc8004Registry ? shortenAddress(contractState.erc8004Registry) : 'Not configured')}
        ${renderLooperMintFact('Phase', contractState ? formatSaleState(phase) : loading ? 'Loading' : 'Not loaded')}
      </div>
      <div class="looper-mint-stats-grid">
        ${renderLooperMintFact('Remaining', contractState ? contractState.remainingPublicSupply.toString() : 'Not loaded', { tone: 'blue', icon: 'coin' })}
        ${renderLooperMintFact('Minted', contractState ? contractState.totalMinted.toString() : 'Not loaded', { tone: 'green', icon: 'agent' })}
        ${renderLooperMintFact('Allowlist', contractState ? getLooperMintPhaseStatus(contractState, 'allowlist') : 'Not loaded', { tone: 'yellow', icon: 'star' })}
      </div>
      <div class="looper-mint-wallet">
        <div>
          <span>Wallet</span>
          <strong>${connected ? escapeHtml(walletSnapshot.label ?? shortenAddress(walletSnapshot.address)) : 'Not connected'}</strong>
        </div>
        <button type="button" data-action="connect-looper-mint-wallet" ${connecting || minting || walletUnconfigured ? 'disabled' : ''}>${connecting ? 'Connecting...' : connected ? 'Reconnect' : 'Connect wallet'}</button>
      </div>
      ${renderLooperMintEligibility(contractState, walletSnapshot, { contractConfigured })}
      ${connected ? `
        <form class="looper-mint-form" data-action="mint-loopers">
          <label>
            <span>Quantity</span>
            <input name="looper_mint_quantity" type="number" inputmode="numeric" min="1" max="${escapeAttribute(quantityMax)}" step="1" value="${escapeAttribute(quantity)}" ${minting ? 'disabled' : ''} />
          </label>
          <div class="looper-mint-cost">
            <span>Estimated cost</span>
            <strong>${escapeHtml(formatEthFromWei(totalPrice))}</strong>
          </div>
          <button type="submit" ${canMint ? '' : 'disabled'}>${minting ? 'Minting...' : getLooperMintSubmitLabel(contractState, connected, { contractConfigured })}</button>
        </form>
      ` : ''}
      ${!canMint && mintAvailability.reason ? `<p class="looper-mint-note">${escapeHtml(mintAvailability.reason)}</p>` : ''}
      ${renderLooperMintStatus(mint, explorerUrl)}
    </section>
  `;
}

function renderLooperMintFact(label, value, options = {}) {
  const tone = ['blue', 'green', 'yellow'].includes(options.tone) ? ` looper-mint-stat looper-mint-stat-${options.tone}` : '';
  const icons = { coin: '◉', agent: '▣', star: '★' };
  const icon = icons[options.icon] ?? '';
  return `
    <div class="looper-mint-fact${tone}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      ${icon ? `<span class="looper-mint-stat-icon" aria-hidden="true">${icon}</span>` : ''}
    </div>
  `;
}

function renderLooperMintEligibility(contractState, walletSnapshot = {}, options = {}) {
  if (options.contractConfigured === false) return '<p class="looper-mint-note">Mint contract is not configured yet.</p>';
  if (!contractState) return '<p class="looper-mint-note">Contract state loads from the configured chain before minting.</p>';
  if (!walletSnapshot.connected || !walletSnapshot.address) return '<p class="looper-mint-note">Connect a wallet to check allowlist eligibility and wallet limits.</p>';
  if (!contractState.erc8004BindingActive) return '<p class="looper-mint-note">Adapter8004 is not configured on this mint contract yet. Mint stays blocked until the bind leg is live.</p>';
  if (contractState.saleState === 'allowlist') {
    const proof = contractState.proof ?? {};
    if (proof.status === 'error') return `<p class="looper-mint-note error">${escapeHtml(proof.error ?? 'Allowlist proof is unavailable.')}</p>`;
    if (!proof.eligible) return '<p class="looper-mint-note">This wallet is not on the current allowlist snapshot. Public mint is not live yet.</p>';
    return `<p class="looper-mint-note success">Allowlist eligible. Adapter8004 bind is active and remaining discounted mints: ${escapeHtml(contractState.allowlistRemainingForWallet?.toString() ?? '0')}.</p>`;
  }
  if (contractState.saleState === 'public') {
    return `<p class="looper-mint-note success">Public mint active with Adapter8004 bind. Remaining wallet mints: ${escapeHtml(contractState.publicRemainingForWallet?.toString() ?? '0')}.</p>`;
  }
  return `<p class="looper-mint-note">Mint is ${escapeHtml(formatSaleState(contractState.saleState).toLowerCase())}.</p>`;
}

function getLooperMintAvailability(contractState, quantity, connected, options = {}) {
  if (!connected) return { canMint: false, reason: null };
  if (options.contractConfigured === false) return { canMint: false, reason: 'Mint contract is not configured yet.' };
  if (!contractState) return { canMint: false, reason: 'Load contract state before minting.' };
  if (!contractState.erc8004BindingActive) return { canMint: false, reason: 'Adapter8004 bind is not configured on this contract yet.' };
  if (contractState.remainingPublicSupply !== null && contractState.remainingPublicSupply !== undefined && BigInt(contractState.remainingPublicSupply) <= 0n) {
    return { canMint: false, reason: 'Supply is sold out.' };
  }
  if (!['allowlist', 'public'].includes(contractState.saleState)) {
    return { canMint: false, reason: `Mint is ${formatSaleState(contractState.saleState).toLowerCase()}.` };
  }
  const mintQuantity = BigInt(quantity);
  if (contractState.remainingPublicSupply !== null && contractState.remainingPublicSupply !== undefined && BigInt(contractState.remainingPublicSupply) < mintQuantity) {
    return { canMint: false, reason: 'Not enough Loopers remain for that quantity.' };
  }
  if (contractState.saleState === 'allowlist') {
    if (contractState.proof?.status === 'error') return { canMint: false, reason: 'Allowlist proof is unavailable right now.' };
    if (!contractState.proof?.eligible) return { canMint: false, reason: 'This wallet is not on the current allowlist snapshot. Public mint is not live yet.' };
    if (contractState.allowlistRemainingForWallet !== null && contractState.allowlistRemainingForWallet !== undefined && BigInt(contractState.allowlistRemainingForWallet) < mintQuantity) {
      return { canMint: false, reason: 'Wallet allowlist mint cap reached for that quantity.' };
    }
  }
  if (contractState.saleState === 'public' && contractState.publicRemainingForWallet !== null && contractState.publicRemainingForWallet !== undefined && BigInt(contractState.publicRemainingForWallet) < mintQuantity) {
    return { canMint: false, reason: 'Wallet public mint cap reached for that quantity.' };
  }
  return { canMint: true, reason: null };
}

function getLooperMintQuantityMax(contractState) {
  if (contractState?.saleState === 'allowlist') return Math.max(1, Number(contractState.allowlistRemainingForWallet ?? 3n));
  if (contractState?.saleState === 'public') return Math.max(1, Number(contractState.publicRemainingForWallet ?? 10n));
  return 10;
}

function getLooperMintPhaseStatus(contractState, phase) {
  if (!contractState) return 'Not loaded';
  if (phase === 'allowlist') {
    if (!contractState.allowlistStart) return 'Not set';
    if (contractState.saleState === 'not_started') return 'Armed';
    return 'Live';
  }
  if (phase === 'public') {
    if (!contractState.publicStart) return 'Not set';
    if (contractState.saleState === 'public') return 'Live';
    if (contractState.saleState === 'ended') return 'Closed';
    return 'Standby';
  }
  return 'Unknown';
}

function renderLooperMintStatus(mint, explorerUrl) {
  if (mint.status === 'minted' && mint.tx?.hash) {
    const link = explorerUrl ? `<a href="${escapeAttribute(explorerUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(shortenAddress(mint.tx.hash))}</a>` : escapeHtml(mint.tx.hash);
    const bindings = Array.isArray(mint.tx?.erc8004Bindings) ? mint.tx.erc8004Bindings : [];
    if (bindings.length > 0) {
      const summary = bindings
        .map((binding) => `Looper #${binding.looperTokenId} -> ERC-8004 #${binding.identityTokenId}`)
        .join(' | ');
      return `<p class="looper-mint-status success" role="status">Mint + Adapter8004 bind confirmed: ${link}. ${escapeHtml(summary)}</p>`;
    }
    return `<p class="looper-mint-status success" role="status">Mint transaction confirmed: ${link}</p>`;
  }
  if (mint.status === 'error') {
    return `<p class="looper-mint-status error" role="alert">${escapeHtml(mint.error ?? 'Mint action failed.')}</p>`;
  }
  return '';
}

function getLooperMintSubmitLabel(contractState, connected, options = {}) {
  if (!connected) return 'Connect wallet';
  if (options.contractConfigured === false) return 'Not configured';
  if (!contractState) return 'Load contract';
  if (!contractState.erc8004BindingActive) return 'Adapter pending';
  if (contractState.saleState === 'allowlist') return 'Mint allowlist';
  if (contractState.saleState === 'public') return 'Mint public';
  return formatSaleState(contractState.saleState);
}

function renderPublicAgentsPage(root, state, handlers = {}) {
  const agentCarousel = createAgentCarousel(createPublicAgentGalleryData(state.data));
  root.innerHTML = `
    <div class="record-shell public-agents-shell">
      ${renderRecordHeader('Public Agent Gallery')}
      <section class="public-agents-hero" aria-label="Multipass public agents">
        <p class="eyebrow">View agents</p>
        <h1>Public Multipass agents.</h1>
      </section>
      ${renderPublicAgentGallery(agentCarousel, state)}
    </div>
  `;

  bindProductHomeEvents(root, handlers, state);
}

function createPublicAgentGalleryData(data) {
  const baseCards = Array.isArray(data?.['agentCards']) ? data['agentCards'] : [];
  const galleryCards = Array.isArray(data?.publicAgentCards) ? data.publicAgentCards : [];
  if (!galleryCards.length) return data;
  return { ...data, agentCards: [...baseCards, ...galleryCards] };
}

function renderGroupActivationSection(groupState = createInitialGroupActivationState()) {
  return `
    <section class="group-activation-section" aria-label="Activate collection or swarm workspace">
      ${renderGroupActivationPanel(groupState)}
      <div class="group-activation-output" aria-live="polite">
        ${renderGroupActivationError(groupState.error)}
        ${renderGroupActivationPreview(groupState.preview)}
        ${renderGroupActivationSuccess(groupState.result)}
      </div>
      <div class="group-activation-reset">
        <button type="button" data-action="reset-group-multipass">Reset group Multipass</button>
      </div>
    </section>
  `;
}

function renderAgentVisualStrip(carousel, selectedIndex, state = {}) {
  const activeIndex = Math.max(0, Math.min(selectedIndex, carousel.cards.length - 1));
  const loadingAgent = state.resolverStatus === 'loading' ? String(state.resolverInFlightInput ?? '').trim() : null;

  return `
    <section id="agent-visuals" class="profile-visual-strip" aria-label="Agent examples">
      <div class="visual-card-track" aria-label="Swipe through agent Multipass profiles">
        ${carousel.cards.map((card, index) => renderAgentVisualLink(card, index, activeIndex, loadingAgent)).join('')}
      </div>
    </section>
  `;
}

function renderAgentVisualLink(card, index, selectedIndex, loadingAgent = null) {
  const selected = index === selectedIndex;
  const href = getHomepageMultipassProfileHref(card, index);
  const agent = getHomepageMultipassProfileAgent(card);
  const imageUrl = safeHttpsUrl(card.visual?.imageUrl);
  const label = card.visual?.label ?? `${card.name} visual identity`;
  const loading = Boolean(agent && loadingAgent && String(agent) === String(loadingAgent));
  const actionAttrs = getHomeProfileActionAttrs(card, index);
  return `
    <a class="visual-card-button${selected ? ' selected' : ''}${loading ? ' loading' : ''}" href="${escapeAttribute(href)}"${actionAttrs} aria-label="Open ${escapeAttribute(card.name)} Multipass profile"${selected ? ' aria-current="true"' : ''}${loading ? ' aria-busy="true"' : ''}>
      <span class="profile-card-visual tone-${escapeAttribute(card.visual?.tone ?? 'neutral')}" aria-label="${escapeAttribute(label)}">
        ${imageUrl ? `<img src="${escapeAttribute(imageUrl)}" alt="${escapeAttribute(label)}" loading="eager" decoding="async" data-visual-card-image="true" />` : ''}
        <span>${escapeHtml(card.visual?.initials ?? 'MP')}</span>
      </span>
      <strong>${escapeHtml(card.name)}</strong>
      <em>${escapeHtml(loading ? `Opening ${card.name}...` : 'Open profile')}</em>
    </a>
  `;
}

function renderPublicAgentGallery(carousel, state = {}) {
  const cards = carousel.cards ?? [];
  if (!cards.length) return '';
  const loadingAgent = state.resolverStatus === 'loading' ? String(state.resolverInFlightInput ?? '').trim() : null;
  return `
    <section class="public-agent-gallery" aria-label="Public agent gallery">
      <div class="public-agent-gallery-copy">
        <p class="card-label">Public agent gallery</p>
        <h2>Pick an agent and open its Multipass.</h2>
        <p>Each card uses safe Multipass routes with public Cred, Intuition, custody, and proof context only.</p>
      </div>
      <div class="public-agent-gallery-grid">
        ${cards.map((card, index) => renderPublicAgentGalleryCard(card, index, loadingAgent)).join('')}
      </div>
    </section>
  `;
}

function renderPublicAgentGalleryCard(card, index, loadingAgent = null) {
  const href = getHomepageMultipassProfileHref(card, index);
  const agent = getHomepageMultipassProfileAgent(card);
  const loading = Boolean(agent && loadingAgent && String(agent) === String(loadingAgent));
  const actionAttrs = getHomeProfileActionAttrs(card, index);
  const proof = card.proofSummary ?? `${Array.isArray(card.proofFragmentIds) ? card.proofFragmentIds.length : 0} public proof signals`;
  const cred = card.credLabel ?? (card.credScore === null || card.credScore === undefined ? 'Pending' : `Cred ${card.credScore}`);
  const intuition = getPublicAgentIntuitionContext(card.intuition);
  return `
    <a class="public-agent-card${loading ? ' loading' : ''}" href="${escapeAttribute(href)}"${actionAttrs}${loading ? ' aria-busy="true"' : ''}>
      <strong>${escapeHtml(card.name)}</strong>
      <div class="public-agent-signals">
        ${renderPublicAgentSignal('Cred', cred, 'Helixa trust score for this agent profile.')}
        ${intuition ? renderPublicAgentSignal('Intuition graph', intuition.label, intuition.note) : ''}
      </div>
      <span>Custody: ${escapeHtml(card.custody ?? card.ownerSnapshot?.permissionState ?? 'Public context only')}</span>
      <span>Proof: ${escapeHtml(proof)}</span>
      <em>${escapeHtml(loading ? `Opening ${card.name}...` : 'Open profile')}</em>
    </a>
  `;
}

function renderPublicAgentSignal(label, value, note) {
  return `
    <span class="public-agent-signal">
      <b>${escapeHtml(label)}</b>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(note)}</small>
    </span>
  `;
}

function getPublicAgentIntuitionLabel(intuition) {
  if (!intuition || typeof intuition !== 'object') return null;
  const label = String(intuition.label ?? '').trim();
  const canonical = String(intuition.canonicalAgentId ?? '').trim();
  if (label && canonical) return `${label} (${canonical})`;
  return label || null;
}

function getPublicAgentIntuitionContext(intuition) {
  const label = getPublicAgentIntuitionLabel(intuition);
  if (!label) return null;
  const note = String(intuition?.note ?? '').trim();
  if (note) return { label, note };
  if (intuition?.identityLayer?.status === 'published' || intuition?.identityLayer?.trustAssessmentTripleId) {
    return {
      label,
      note: 'Identity atom, CAIP anchor, and Helixa Cred assessment are published on Intuition.',
    };
  }
  const status = String(intuition?.status ?? intuition?.label ?? '').toLowerCase();
  if (status.includes('published')) {
    return {
      label,
      note: 'ERC-8004 identity and reputation record are published on Intuition.',
    };
  }
  if (status.includes('mapping')) {
    return {
      label,
      note: 'Needs a canonical ERC-8004 token ID before Intuition can verify it.',
    };
  }
  return {
    label,
    note: 'Current Intuition ERC-8004 graph status for this Multipass.',
  };
}

function getHomeProfileResolveAttrs(agent, index) {
  return agent ? ` data-action="resolve-home-profile" data-agent="${escapeAttribute(agent)}" data-index="${index}"` : '';
}

function getHomeProfileActionAttrs(card, index) {
  const agent = getHomepageMultipassProfileAgent(card);
  if (agent) return getHomeProfileResolveAttrs(agent, index);
  if (card.subjectType === 'swarm' || card.detailMode === 'swarm') return ` data-action="select-home-agent-card" data-index="${index}"`;
  return '';
}

function getHomepageMultipassProfileAgent(card) {
  const tokenId = String(card.tokenId ?? '').trim();
  if (/^\d+$/.test(tokenId)) return tokenId;

  const helixaId = String(card.helixaId ?? '').trim();
  if (/^\d+:\d+$/.test(helixaId)) return helixaId;

  return null;
}

function getLiveProfileCacheKey(input) {
  return String(input ?? '').trim();
}

function isPrefetchableHomepageAgent(agent) {
  const value = getLiveProfileCacheKey(agent);
  if (/^[1-9]\d*$/.test(value)) return true;
  return /^8453:[1-9]\d*$/.test(value);
}

function getHomepageMultipassProfileHref(card, index = 0) {
  const agent = getHomepageMultipassProfileAgent(card);
  if (agent) return `/multipass/?agent=${encodeURIComponent(agent)}`;

  if (card.subjectType === 'swarm' || card.detailMode === 'swarm') return STATIC_SWARM_PROFILE_PATH;

  if (card.profileUrl) {
    try {
      const parsed = new URL(String(card.profileUrl), 'https://helixa.xyz');
      const sharePath = `${parsed.pathname}${parsed.search}`;
      if (isSafeMultipassSharePath(sharePath)) return sharePath;
    } catch {
      // Fall through to the Multipass home rather than leaking old Helixa profile routes.
    }
  }

  return '/multipass/';
}

function bindProductHomeEvents(root, handlers, state) {
  bindSiteMenu(root);
  root.querySelector('[data-action="register-looper-allowlist"]')?.addEventListener('submit', (event) => handlers.registerLooperAllowlist?.(event));
  root.querySelector('[data-action="connect-looper-wallet"]')?.addEventListener('click', () => handlers.connectLooperAllowlistWallet?.());
  root.querySelectorAll('[data-action="connect-console-wallet"]').forEach((button) => {
    button.addEventListener('click', () => handlers.connectConsoleWallet?.());
  });
  root.querySelector('[data-action="select-console-agent"]')?.addEventListener('change', (event) => handlers.selectConsoleAgent?.(event));
  root.querySelector('[data-action="search-console-agent-gallery"]')?.addEventListener('input', (event) => handlers.updateConsoleAgentGallerySearch?.(event));
  root.querySelector('[data-action="sort-console-agent-gallery"]')?.addEventListener('change', (event) => handlers.updateConsoleAgentGallerySort?.(event));
  root.querySelector('[data-action="clear-console-agent-gallery-search"]')?.addEventListener('click', () => handlers.clearConsoleAgentGallerySearch?.());
  root.querySelectorAll('[data-action="toggle-console-roster-drawer"]').forEach((drawer) => {
    drawer.addEventListener('toggle', (event) => handlers.toggleConsoleRosterDrawer?.(event));
  });
  root.querySelectorAll('[data-action="refresh-console-owned-agents"]').forEach((button) => {
    button.addEventListener('click', () => handlers.refreshConsoleOwnedAgentsFromControl?.());
  });
  root.querySelectorAll('[data-action="set-console-workspace-view"]').forEach((button) => {
    button.addEventListener('click', (event) => handlers.setConsoleWorkspaceView?.(event));
  });
  bindMissionBoard(root, {
    openLaunchpad: handlers.openConsoleLaunchpad,
    newMission: handlers.newConsoleMission,
    filter: handlers.loadConsoleMissions,
    openMission: handlers.openConsoleMission,
    back: handlers.closeConsoleMission,
  });
  bindMissionEditor(root, {
    submit: handlers.submitConsoleMission,
    cancel: handlers.cancelConsoleMissionEditor,
  });
  bindConsoleCredit(root, {
    submitOptIn: handlers.submitCredifiOwnerOptIn,
    refresh: handlers.refreshConsoleCredit,
    login: handlers.loginConsoleCredit,
    acceptVouch: handlers.acceptConsoleCreditVouch,
    prepareAuthorization: handlers.prepareConsoleCreditAuthorization,
    submitAuthorization: handlers.submitConsoleCreditAuthorization,
    requestTwoFactor: handlers.requestConsoleCreditTwoFactor,
    verifyTwoFactor: handlers.verifyConsoleCreditTwoFactor,
    preview: handlers.previewConsoleCredit,
    borrow: handlers.borrowConsoleCredit,
  });
  bindSwarmLaunchpad(root, {
    prepare: handlers.prepareConsoleSwarmLaunch,
    addMember: handlers.addConsoleLaunchMember,
    removeMember: handlers.removeConsoleLaunchMember,
    createConsent: handlers.createConsoleLaunchConsent,
    signConsent: handlers.signConsoleLaunchConsent,
    createReadiness: handlers.createConsoleLaunchReadiness,
    createInvitationDraft: handlers.createConsoleInvitationDraft,
    addInvitation: handlers.addConsoleInvitation,
    revokeInvitation: handlers.revokeConsoleInvitation,
    closeInvitationDraft: handlers.closeConsoleInvitationDraft,
    respondInvitation: handlers.respondConsoleInvitation,
    openInvitation: handlers.openConsoleInvitation,
    copyInvitation: handlers.copyConsoleInvitation,
    back: handlers.closeConsoleMission,
  });
  root.querySelector('[data-action="retry-console-agent-activation"]')?.addEventListener('click', () => handlers.retryConsoleAgentActivation?.());
  root.querySelector('[data-action="retry-console-codex"]')?.addEventListener('click', () => handlers.retryConsoleCodex?.());
  root.querySelector('[data-restap-network-policy]')?.addEventListener('submit', (event) => handlers.saveConsoleRestapNetworkPolicy?.(event));
  root.querySelector('[data-restap-network-send]')?.addEventListener('submit', (event) => handlers.sendConsoleRestapNetworkTalk?.(event));
  root.querySelector('[data-action="stop-restap-network"]')?.addEventListener('click', () => handlers.stopConsoleRestapNetwork?.());
  root.querySelector('[data-action="refresh-restap-network"]')?.addEventListener('click', () => handlers.retryConsoleRestapNetwork?.());
  root.querySelector('[data-action="activate-selected-console-agent"]')?.addEventListener('click', () => handlers.activateSelectedConsoleAgent?.());
  root.querySelectorAll('[data-action="activate-console-room"]').forEach((button) => {
    button.addEventListener('click', (event) => handlers.activateConsoleRoom?.(event));
  });
  root.querySelectorAll('[data-action="toggle-console-agent-room"]').forEach((button) => {
    button.addEventListener('click', (event) => handlers.toggleConsoleAgentRoom?.(event));
  });
  root.querySelector('[data-action="update-console-agent-name"]')?.addEventListener('submit', (event) => handlers.updateConsoleAgentName?.(event));
  root.querySelector('[data-action="reset-console-agent-name"]')?.addEventListener('click', () => handlers.resetConsoleAgentName?.());
  const consoleComposer = root.querySelector('[data-action="send-console-agent-message"]');
  consoleComposer?.addEventListener('submit', (event) => handlers.sendConsoleAgentMessage?.(event));
  consoleComposer?.querySelector('[data-console-image-input]')?.addEventListener('change', (event) => handlers.selectConsoleImage?.(event));
  consoleComposer?.addEventListener('paste', (event) => handlers.selectConsoleImage?.(event));
  consoleComposer?.addEventListener('dragover', (event) => {
    if ([...(event.dataTransfer?.items ?? [])].some((item) => item.kind === 'file')) event.preventDefault();
  });
  consoleComposer?.addEventListener('drop', (event) => handlers.selectConsoleImage?.(event));
  consoleComposer?.querySelector('[data-action="remove-console-image"]')?.addEventListener('click', () => handlers.removeConsoleImage?.());
  root.querySelector('[data-action="reset-console-session"]')?.addEventListener('click', () => handlers.resetConsoleSession?.());
  root.querySelector('[data-action="refresh-looper-agent-wallet"]')?.addEventListener('click', () => handlers.refreshLooperAgentWallet?.());
  root.querySelector('[data-action="activate-looper-agent-wallet"]')?.addEventListener('submit', (event) => handlers.activateLooperAgentWallet?.(event));
  root.querySelector('[data-action="send-looper-agent-wallet"]')?.addEventListener('submit', (event) => handlers.sendLooperAgentWallet?.(event));
  root.querySelector('[data-action="load-pantheon-cred"]')?.addEventListener('click', () => handlers.loadPantheonCred?.());
  root.querySelector('[data-action="approve-pantheon-cred"]')?.addEventListener('submit', (event) => handlers.approvePantheonCred?.(event));
  root.querySelector('[data-action="submit-pantheon-approval"]')?.addEventListener('submit', (event) => handlers.submitPantheonCredApproval?.(event));
  root.querySelector('[data-action="stake-pantheon-cred"]')?.addEventListener('submit', (event) => handlers.stakePantheonCred?.(event));
  root.querySelector('[data-action="submit-pantheon-stake"]')?.addEventListener('submit', (event) => handlers.submitPantheonCredStake?.(event));
  root.querySelector('[data-action="set-looper-policy-module"]')?.addEventListener('submit', (event) => handlers.setLooperPolicyModule?.(event));
  root.querySelectorAll('[data-action="acknowledge-looper-wallet-outcome"]').forEach((button) => {
    button.addEventListener('click', (event) => handlers.acknowledgeLooperWalletOutcome?.(event));
  });
  root.querySelector('[data-action="connect-looper-mint-wallet"]')?.addEventListener('click', () => handlers.connectLooperMintWallet?.());
  root.querySelector('[data-action="refresh-looper-mint"]')?.addEventListener('click', () => handlers.refreshLooperMint?.());
  root.querySelector('[data-action="mint-loopers"]')?.addEventListener('submit', (event) => handlers.submitLooperMint?.(event));
  root.querySelector('[data-action="resolve-live-agent"]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.querySelector('input[name="agent"]')?.value ?? '';
    if (isRetryBlocked(state)) return;
    if (state.resolverStatus === 'loading' && input.trim() === state.resolverInFlightInput) return;
    handlers.resolveLiveAgent?.(input);
  });
  root.querySelectorAll('[data-action="resolve-example-agent"]').forEach((button) => {
    button.addEventListener('click', () => handlers.resolveLiveAgent?.(button.getAttribute('data-agent') ?? ''));
  });
  root.querySelectorAll('[data-action="resolve-home-profile"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const selectedAgentCard = Number(link.dataset.index);
      handlers.resolveLiveAgent?.(
        link.getAttribute('data-agent') ?? '',
        Number.isInteger(selectedAgentCard) ? { selectedAgentCard } : undefined,
      );
    });
  });
  root.querySelectorAll('[data-action="select-home-agent-card"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const selectedAgentCard = Number(link.dataset.index);
      const nextIndex = Number.isInteger(selectedAgentCard) ? selectedAgentCard : 0;
      const carousel = createAgentCarousel(state.data);
      const selectedCard = carousel.cards?.[nextIndex];
      const href = link.getAttribute('href') || getHomepageMultipassProfileHref(selectedCard, nextIndex);
      if (selectedCard?.subjectType === 'swarm' || selectedCard?.detailMode === 'swarm') {
        if (typeof window !== 'undefined') window.history?.pushState?.({}, '', href);
        state = {
          ...state,
          pageKind: 'profile',
          data: createStaticSwarmProfileData(state.staticData ?? state.data, nextIndex),
          selectedAgentCard: nextIndex,
          resolverStatus: null,
          resolverError: null,
          resolverInFlightInput: null,
          lookupMatches: [],
          saveStatus: null,
          saveError: null,
          savedSharePath: null,
          savedProfile: null,
          claimStatus: null,
          claimError: null,
          claimCsrfToken: null,
          claimSessionStatus: null,
          ...clearedRouteState(),
        };
        render(root, state, handlers);
      }
    });
  });
  bindVisualImageFallbacks(root);
  root.querySelectorAll('[data-action="select-agent-card"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedAgentCard = Number(button.dataset.index);
      renderProductHome(root, state, handlers);
      root.querySelector(`[data-action="select-agent-card"][data-index="${state.selectedAgentCard}"]`)?.focus();
    });
  });
  root.querySelectorAll('[data-action="select-lookup-match"]').forEach((button) => {
    button.addEventListener('click', () => handlers.resolveLiveAgent?.(button.dataset.tokenId ?? ''));
  });
  bindGroupActivationEvents(root, handlers);
}

function bindGroupActivationEvents(root, handlers = {}) {
  root.querySelector('[data-role="group-activation-form"]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    handlers.previewGroupActivation?.();
  });
  root.querySelector('[data-action="show-group-activation"]')?.addEventListener('click', () => handlers.showGroupActivation?.());
  root.querySelector('[data-action="preview-group-multipass"]')?.addEventListener('click', () => handlers.previewGroupActivation?.());
  root.querySelector('[data-action="save-group-multipass"]')?.addEventListener('click', () => handlers.saveGroupActivation?.());
  root.querySelector('[data-action="reset-group-multipass"]')?.addEventListener('click', () => handlers.resetGroupActivation?.());
}

function bindVisualImageFallbacks(root) {
  root.querySelectorAll('img[data-visual-card-image="true"]').forEach((image) => {
    const markFailed = () => {
      image.hidden = true;
      image.closest('.profile-card-visual')?.classList.add('image-failed');
    };
    if (image.complete && image.naturalWidth === 0) markFailed();
    image.addEventListener('error', markFailed, { once: true });
  });
}

function renderHomepageHero(heroCopy, data, agentCarousel) {
  const profileCount = agentCarousel.cards.length;
  const proofCount = countPublicProofSignals(data);
  return `
    <section class="homepage-hero">
      <div class="homepage-hero-copy">
        <p class="eyebrow">${escapeHtml(heroCopy.eyebrow)}</p>
        <div class="prototype-ribbon">
          ${heroCopy.prototypeLabel ? `<span>${escapeHtml(heroCopy.prototypeLabel)}</span>` : ''}
          <span>${escapeHtml(heroCopy.audience)}</span>
        </div>
        <h1>${escapeHtml(heroCopy.headline)}</h1>
        <p class="lead">${escapeHtml(heroCopy.body)}</p>
        <div class="homepage-actions">
          <a href="#live-resolver" class="homepage-action primary">Activate Multipass</a>
          <a href="#profile-gallery" class="homepage-action">View example profiles</a>
        </div>
        <div class="note">${escapeHtml(heroCopy.note)}${renderShareLink(data.liveProfilePage?.sharePath)}</div>
      </div>
      <aside class="homepage-proof-panel" aria-label="Multipass profile ingredients">
        <p class="card-label">Public agent profile stack</p>
        <h2>Identity, custody, proof, routes, and trust context in one readable public agent profile.</h2>
        <div class="homepage-proof-grid">
          ${renderHeroStat('Profiles', profileCount)}
          ${renderHeroStat('Public proof', proofCount)}
          ${renderHeroStat('Profile source', data.sourceLabel ?? 'Bendr 2.0 Public Profile')}
          ${renderHeroStat('Primary use', 'Discovery')}
        </div>
      </aside>
    </section>
  `;
}

function countPublicProofSignals(data) {
  return Array.isArray(data.fragments?.fragments)
    ? data.fragments.fragments.filter((fragment) => fragment.visibility === 'public').length
    : 0;
}

function renderHeroStat(label, value) {
  return `
    <article class="homepage-proof-stat">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `;
}

function renderSharePanel(data, heroCopy) {
  const shareUrl = getAbsoluteShareUrl(data.liveProfilePage?.sharePath);
  const title = String(data.liveProfilePage?.headline ?? heroCopy.headline ?? 'Multipass').replace(/[.!?]+$/u, '');
  return `
    <section class="share-panel" aria-label="Share Multipass profile">
      <div>
        <p class="card-label">Share this Multipass</p>
        <h2>Portable Agent Identity</h2>
        <p>${escapeHtml(title)}. Identity, proof, custody, Cred, and discovery context for agents and AI-native systems.</p>
      </div>
      <div class="share-copy-card" aria-label="Multipass share URL">
        <span>Share URL</span>
        <code class="share-url">${escapeHtml(shareUrl)}</code>
        <small class="share-hint">Tap and hold to copy</small>
      </div>
    </section>
  `;
}

function renderLiveResolver(state, options = {}) {
  const showResetButton = options.showResetButton !== false;
  const showGroupActivationButton = options.showGroupActivationButton === true;
  return `
    <section id="live-resolver" class="live-resolver" aria-label="Activate a live agent record">
      <form data-action="resolve-live-agent">
        <div class="live-resolver-copy">
          <p class="card-label">Activate a live agent record</p>
          <h2>Activate an existing agent.</h2>
          <p>Enter an AgentDNA ID, ERC-8004-style ID, token ID, or agent name.</p>
        </div>
        <label>
          <span>AgentDNA ID, ERC-8004-style ID, token ID, or agent name</span>
          <input name="agent" value="${escapeAttribute(state.resolverInput ?? '')}" placeholder="81, 8453:81, or erc8004:8453:19125" autocomplete="off" />
        </label>
        <div class="live-resolver-actions">
          <button type="submit" ${isRetryBlocked(state) ? 'disabled' : ''}>${state.resolverStatus === 'loading' ? 'Activating...' : 'Activate agent'}</button>
          ${showGroupActivationButton ? '<button type="button" class="activate-swarm-button" data-action="show-group-activation">Activate Swarm</button>' : ''}
          ${showResetButton ? '<button type="button" data-action="reset-static-demo">Back to Multipass home</button>' : ''}
        </div>
      </form>
      ${state.resolverError ? `<p class="resolver-message error">${escapeHtml(state.resolverError)}</p>` : ''}
      ${state.retryMessage ? `<p class="resolver-message error">${escapeHtml(state.retryMessage)}</p>` : ''}
      ${renderLookupMatches(state.lookupMatches)}
      ${state.resolverStatus === 'loaded' ? '<p class="resolver-message">Live source resolved into an activation preview. No approvals, custody, or authority changes.</p>' : ''}
    </section>
  `;
}

function getClaimButtonLabel(state) {
  const snapshot = state.walletSnapshot ?? {};
  if (state.claimStatus === 'signing') return 'Waiting for signature...';
  if (snapshot.configured === false) return 'Wallet login not configured';
  if (snapshot.ready === false) return 'Loading wallet options...';
  if (snapshot.connected && snapshot.label) return `Sign owner claim with ${snapshot.label}`;
  return snapshot.connectLabel ?? 'Connect wallet to claim';
}

function renderClaimManagementPanel(state) {
  if (!isSavedManageRecord(state)) return '';
  const profile = state.data?.profile ?? state.savedProfile ?? {};
  const ownerSummary = profile.owner_summary ?? {};
  const status = state.claimStatus ?? ownerSummary.verification_status ?? ownerSummary.owner_state ?? 'unclaimed';
  const canEdit = Boolean(state.claimCsrfToken);
  const claimButtonLabel = getClaimButtonLabel(state);
  const walletUnconfigured = state.walletSnapshot?.configured === false;
  const copy = getClaimManagementCopy({ profile, canEdit, walletUnconfigured });
  return `
    <section class="owner-command-center claim-management-panel" aria-label="Owner Command Center">
      <section class="owner-command-overview" data-command-section="overview" aria-label="Owner command overview">
        <div class="owner-command-copy">
          <p class="card-label">Owner Command Center</p>
          <h2>Owner Command Center</h2>
          <p>${escapeHtml(copy.overview)}</p>
        </div>
        ${renderOwnerCommandFacts({ status, profile, ownerSummary })}
        <div class="owner-command-control-note">
          <h3>What you control</h3>
          <p>${escapeHtml(copy.controlNote)}</p>
        </div>
        <div class="owner-command-next">
          <h3>Next best action</h3>
          <p>${escapeHtml(copy.nextAction)}</p>
        </div>
        <div class="owner-command-unlock">
          <div class="claim-management-copy">
            <p class="card-label">Claim management</p>
            <h3>${escapeHtml(copy.claimHeading)}</h3>
            <p>${escapeHtml(copy.claimSummary)}</p>
            <div class="claim-status-row">
              <span>Status</span>
              <strong>${escapeHtml(status)}</strong>
            </div>
            ${ownerSummary.summary ? `<p class="resolver-message">${escapeHtml(ownerSummary.summary)}</p>` : ''}
            ${walletUnconfigured ? '<p class="resolver-message error">Wallet login is not configured for this build.</p>' : ''}
            ${state.claimError ? `<p class="resolver-message error">${escapeHtml(state.claimError)}</p>` : ''}
          </div>
          <div class="claim-management-actions">
            <button type="button" data-action="claim-with-wallet" ${state.claimStatus === 'signing' || walletUnconfigured ? 'disabled' : ''}>${escapeHtml(claimButtonLabel)}</button>
            <form class="manual-review-form" data-action="submit-manual-review">
              <label><span>Manager wallet for review</span><input name="proposedManagerWallet" placeholder="0x..." autocomplete="off" /></label>
              <label><span>Contact route</span><input name="contactRoute" placeholder="agentmail:team@example.test" autocomplete="off" /></label>
              <label><span>Review note</span><textarea name="note" rows="2" placeholder="${escapeAttribute(copy.reviewPlaceholder)}"></textarea></label>
              <button type="submit">Request manual review</button>
            </form>
          </div>
        </div>
        ${renderOwnerDashboardPanel(profile, state)}
      </section>
      ${canEdit ? `<section class="owner-command-section" data-command-section="profile" aria-label="${escapeAttribute(copy.profileControlsLabel)}">${renderPublicProfileEditForm(profile, state)}</section>` : ''}
      ${canEdit ? `<section class="owner-command-section" data-command-section="routes" aria-label="Public route controls">${renderPublicRoutesManagerPanel(state)}</section>` : ''}
      ${canEdit ? `<section class="owner-command-section" data-command-section="marketplace-connections" aria-label="Marketplace Connections controls">${renderMarketplaceConnectionManagerPanel(state)}</section>` : ''}
      ${renderToolRegistryPanel(state)}
      ${canEdit ? `<section class="owner-command-section" data-command-section="fragments" aria-label="Public fragment controls">${renderFragmentManagerPanel(state)}</section>` : ''}
    </section>
  `;
}

function getClaimManagementCopy({ profile, canEdit, walletUnconfigured }) {
  if (isGroupParentSubject(profile)) {
    return {
      overview: 'Manage safe public group metadata controls for this parent Multipass. This does not transfer custody. It does not call tools, grant access, release credentials, or prove trust by payment alone.',
      controlNote: 'You control safe public group metadata: display fields, visibility, route cards, roster and policy notes, and public proof fragments. Private credentials, member authority, and source authority stay outside this panel.',
      nextAction: getGroupOwnerCommandNextAction({ canEdit, walletUnconfigured }),
      claimHeading: 'Manage safe parent Multipass fields.',
      claimSummary: 'Source-owner proof or manual review can unlock group metadata edits only. This does not transfer custody, tools, credentials, member authority, or ownership.',
      reviewPlaceholder: 'Why this wallet should manage public group metadata',
      profileControlsLabel: 'Parent Multipass metadata controls',
      profileFieldHelp: 'Safe public group metadata fields for this parent Multipass.',
      avatarHelp: 'Updates the public parent Multipass visual only. HTTPS only; leave blank to clear it. This does not change custody, tools, credentials, ownership, member authority, or source AgentDNA records.',
    };
  }

  return {
    overview: 'Manage safe public metadata controls for this saved Multipass profile. This does not transfer custody. It does not call tools, grant access, release credentials, or prove trust by payment alone.',
    controlNote: 'You control safe public metadata: display fields, visibility, route cards, and public proof fragments. Private credentials and source authority stay outside this panel.',
    nextAction: getOwnerCommandNextAction({ canEdit, walletUnconfigured }),
    claimHeading: 'Manage safe public profile fields.',
    claimSummary: 'Owner-wallet verification or manual review can unlock public profile edits only. This does not transfer custody, tools, credentials, or ownership.',
    reviewPlaceholder: 'Why this wallet should manage public fields',
    profileControlsLabel: 'Public profile controls',
    profileFieldHelp: 'Safe public fields for the saved Multipass profile.',
    avatarHelp: 'Updates the public Multipass visual only. HTTPS only; leave blank to clear it. This does not change custody, tools, credentials, ownership, or the source AgentDNA record.',
  };
}

function renderOwnerCommandFacts({ status, profile, ownerSummary }) {
  const visibility = ownerSummary.visibility ?? profile.discovery_profile?.visibility ?? 'public';
  const verification = ownerSummary.verification_status ?? ownerSummary.owner_state ?? 'none';
  return `
    <dl class="owner-command-facts" aria-label="Owner command facts">
      <div><dt>Status</dt><dd>${escapeHtml(status)}</dd></div>
      <div><dt>Visibility</dt><dd>${escapeHtml(visibility)}</dd></div>
      <div><dt>Verification</dt><dd>${escapeHtml(verification)}</dd></div>
    </dl>
  `;
}

function getOwnerCommandNextAction({ canEdit, walletUnconfigured }) {
  if (canEdit) return 'Review public profile fields, route cards, and proof fragments before publishing new discovery metadata.';
  if (walletUnconfigured) return 'Request manual review while wallet login is unavailable for this build.';
  return 'Connect the owner wallet or request manual review to unlock public metadata edits.';
}

function getGroupOwnerCommandNextAction({ canEdit, walletUnconfigured }) {
  if (canEdit) return 'Review parent display fields, route cards, roster and policy notes, and public proof fragments before publishing new discovery metadata.';
  if (walletUnconfigured) return 'Request manual review while wallet login is unavailable for this build.';
  return 'Connect the source-owner wallet or request manual review to unlock group metadata edits.';
}

function isGroupParentSubject(profile = {}) {
  const subjectType = String(profile.subject_type ?? profile.subjectType ?? '').toLowerCase();
  return ['swarm', 'collection'].includes(subjectType);
}

function renderToolRegistryPanel(state) {
  return renderToolRegistryManagerPanel(state, { canEdit: Boolean(state.claimCsrfToken) });
}

function renderOwnerDashboardPanel(profile, state) {
  const entries = Array.isArray(state.data?.changes?.entries) ? state.data.changes.entries.slice(-4).reverse() : [];
  const snapshot = createOwnerCommandCenterSnapshot({ ...state.data, profile }, state);
  return `
    <section class="owner-dashboard-panel" aria-label="Owner dashboard">
      <p class="card-label">Owner dashboard</p>
      ${renderOwnerCommandCenterSnapshot(snapshot)}
      <div class="owner-change-log" aria-label="Recent changes">
        <strong>Recent changes</strong>
        ${entries.length ? `<ol>${entries.map((entry) => `<li><span>${escapeHtml(entry.message)}</span><time>${escapeHtml(formatShortDate(entry.created_at))}</time></li>`).join('')}</ol>` : '<p class="resolver-message">No public changes logged yet.</p>'}
      </div>
    </section>
  `;
}

function renderPublicProfileEditForm(profile, state) {
  const discovery = profile.discovery_profile ?? {};
  const ownerSummary = profile.owner_summary ?? {};
  const summary = profile.summary ?? discovery.summary ?? '';
  const avatarUrl = profile.avatar_url ?? discovery.avatar_url ?? '';
  const tags = Array.isArray(profile.tags) ? profile.tags : (Array.isArray(discovery.tags) ? discovery.tags : []);
  const copy = getClaimManagementCopy({ profile, canEdit: Boolean(state.claimCsrfToken), walletUnconfigured: state.walletSnapshot?.configured === false });
  const isGroup = isGroupParentSubject(profile);
  return `
    <form class="public-profile-edit-form" data-action="update-public-profile" aria-label="Edit public Multipass profile">
      <p class="card-label">${isGroup ? 'Edit parent Multipass' : 'Edit public profile'}</p>
      <p class="field-help">${escapeHtml(copy.profileFieldHelp)}</p>
      <label><span>Display name</span><input name="display_name" value="${escapeAttribute(profile.display_name ?? '')}" /></label>
      <label><span>Summary</span><textarea name="summary" rows="3">${escapeHtml(summary)}</textarea></label>
      <label><span>Profile image URL</span><input name="avatar_url" value="${escapeAttribute(avatarUrl)}" placeholder="https://..." /></label>
      <p class="field-help profile-field-helper">${escapeHtml(copy.avatarHelp)}</p>
      <label><span>Tags</span><input name="tags" value="${escapeAttribute(tags.join(', '))}" /></label>
      <label><span>Visibility</span>${renderVisibilitySelect(ownerSummary.visibility ?? 'public')}</label>
      <div class="profile-edit-actions">
        <button type="submit" ${state.claimStatus === 'updating_profile' ? 'disabled' : ''}>${state.claimStatus === 'updating_profile' ? 'Updating...' : 'Save public edits'}</button>
        <button type="button" data-action="logout-manager-session">Sign out</button>
      </div>
    </form>
  `;
}

function renderVisibilitySelect(selected = 'public') {
  return `<select name="visibility">${['public', 'gated', 'private', 'hidden'].map((visibility) => `<option value="${visibility}" ${visibility === selected ? 'selected' : ''}>${visibility}</option>`).join('')}</select>`;
}

function formatShortDate(value) {
  const text = String(value ?? '').trim();
  return text ? text.replace(/\.000Z$/, 'Z') : '';
}

function renderActivationPreviewPanel(state, activationState) {
  if (state.resolverStatus !== 'loaded' || state.saveStatus === 'saved' || isSavedManageRecord(state)) return '';
  const data = state.data ?? {};
  const tokenId = data.resolver?.tokenId ?? data.profile?.token_id ?? data.profile?.tokenId ?? '';
  const agentdnaId = data.resolver?.canonicalId ?? data.profile?.helixa_id ?? data.profile?.multipass_id ?? activationState.resolvedId ?? '';
  const displayName = data.profile?.display_name ?? data.liveProfilePage?.headline ?? activationState.subject ?? 'Resolved agent';
  const sharePath = isSafeMultipassSharePath(data.liveProfilePage?.sharePath) ? data.liveProfilePage.sharePath : '/multipass/';
  const tokenLabel = tokenId ? `Token ${tokenId}` : 'Token pending';
  return `
    <section class="activation-preview-panel" aria-label="Activation preview">
      <div>
        <p class="card-label">Activation preview</p>
        <h3>${escapeHtml(displayName)} stable public agent profile</h3>
        <p>Activation will create a saved Multipass profile from this live public AgentDNA source. It does not transfer custody, does not release credentials, and does not change approvals.</p>
      </div>
      <dl class="activation-preview-facts">
        <div><dt>AgentDNA source</dt><dd>${escapeHtml(agentdnaId || 'Source pending')}</dd></div>
        <div><dt>Token</dt><dd>${escapeHtml(tokenLabel)}</dd></div>
        <div><dt>Candidate share path</dt><dd>${escapeHtml(sharePath)}</dd></div>
      </dl>
    </section>
  `;
}

function renderActivationSummary(activationState) {
  const resolved = activationState.resolvedId ? `<span>${escapeHtml(activationState.resolvedId)}</span>` : '';
  const futureBindNote = activationState.showFutureBindNote
    ? '<p class="activation-bind-note">Target Looper flow is mint-time ERC-8004 binding so the NFT, registry listing, and agent metadata stay in sync. This public activation view is still read-only and does not claim custody or permission changes.</p>'
    : '';

  return `
    <section class="activation-summary ${escapeAttribute(activationState.kind)}" aria-label="Multipass activation state">
      <div>
        <p class="card-label">Agent Activation</p>
        <h2>${escapeHtml(activationState.title)}</h2>
        <p>${escapeHtml(activationState.summary)}</p>
      </div>
      <div class="activation-facts" aria-label="Activation facts">
        <strong>${escapeHtml(activationState.subject)}</strong>
        ${resolved}
        <em>${escapeHtml(activationState.originLabel)}</em>
        <small>${escapeHtml(activationState.sourceLabel)}</small>
      </div>
      ${futureBindNote}
    </section>
  `;
}

function renderLookupMatches(matches = []) {
  if (!matches.length) return '';
  return `
    <div class="lookup-matches" aria-label="Matching Helixa agents">
      ${matches.map((match) => `
        <button class="lookup-match-card" type="button" data-action="select-lookup-match" data-token-id="${escapeAttribute(match.tokenId)}">
          <strong>${escapeHtml(match.name)}</strong>
          <span>${escapeHtml(match.helixaId)} · ${escapeHtml(match.framework ?? 'unknown')} · ${match.credScore === null || match.credScore === undefined ? 'Cred pending' : `Cred ${escapeHtml(match.credScore)}`}</span>
          <em>${match.verified ? 'Verified' : 'Unverified'}</em>
        </button>
      `).join('')}
    </div>
  `;
}

function isRetryBlocked(state) {
  return state.retryUntil > Date.now();
}

function lookupMatchesFromError(error) {
  if (!(error instanceof HelixaResolverError) || error.code !== 'ambiguous_lookup') return [];
  return Array.isArray(error.details?.matches) ? error.details.matches : [];
}

function userResolverMessage(error) {
  if (error instanceof HelixaResolverError) return error.message;
  return 'Could not reach the Helixa API. Bendr public profile is still available.';
}

export function retryStateFromError(error, nowMs = Date.now()) {
  if (!(error instanceof HelixaResolverError) || error.code !== 'rate_limited') return { retryUntil: 0, retryMessage: null };
  const seconds = Number(error.details?.retryAfter);
  if (!Number.isFinite(seconds) || seconds <= 0) return { retryUntil: 0, retryMessage: null };
  return { retryUntil: nowMs + seconds * 1000, retryMessage: `Try again in ${seconds} seconds.` };
}

function renderField(label, value, className = '', note = '') {
  const extraClass = className ? ` ${className}` : '';
  return `
    <div class="field">
      <span>${escapeHtml(label)}</span>
      <strong class="mono${extraClass}">${escapeHtml(value)}</strong>
      ${note ? `<small>${escapeHtml(note)}</small>` : ''}
    </div>
  `;
}



function safeHttpsUrl(value) {
  const ipfsGatewayUrl = ipfsImageGatewayUrl(value);
  if (ipfsGatewayUrl) return ipfsGatewayUrl;
  if (!value) return null;
  try {
    const parsed = new URL(String(value));
    return parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}

function ipfsImageGatewayUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw.toLowerCase().startsWith('ipfs://')) return null;
  const path = raw.slice('ipfs://'.length).replace(/^ipfs\//i, '');
  if (!path || !/^[A-Za-z0-9._~:/?#[\]@!$&'()*+,;=%-]+$/.test(path)) return null;
  return `https://ipfs.io/ipfs/${path}`;
}

function renderAgentAura(visualIdentity, options = {}) {
  if (!visualIdentity || !['helixa_aura', 'aura'].includes(visualIdentity.source)) return '';
  const safeImageUrl = safeHttpsUrl(visualIdentity.imageUrl);
  const label = visualIdentity.label ?? 'Helixa Agent Aura';
  const title = options.title ?? label;
  const sharePath = isSafeAuraSharePath(options.sharePath) ? options.sharePath : null;
  return `
    <section class="aura-card" data-visual-source="${escapeAttribute(visualIdentity.source)}" aria-label="Agent Aura visual for public agent profile">
      ${sharePath ? renderAuraShareAction(sharePath, title) : ''}
      <div class="aura-asset-frame">
        <div class="aura-orb tone-${escapeAttribute(visualIdentity.tone ?? 'pending')}">
          ${safeImageUrl ? `<img src="${escapeAttribute(safeImageUrl)}" alt="${escapeAttribute(label)}" loading="lazy" />` : ''}
          <span>${escapeHtml(visualIdentity.initials ?? 'MP')}</span>
        </div>
      </div>
      <div class="aura-item-meta">
        <p class="card-label">Visual</p>
        <h2>${escapeHtml(title)}</h2>
        <div class="aura-chips" aria-label="Agent Aura traits">
          ${(visualIdentity.chips ?? []).map((chip) => `<span>${escapeHtml(chip)}</span>`).join('')}
        </div>
        ${hasRenderableValue(visualIdentity.trustNote) ? `<p class="aura-trust-note">${escapeHtml(visualIdentity.trustNote)}</p>` : ''}
      </div>
    </section>
  `;
}

function isSafeAuraSharePath(value) {
  return isSafeMultipassSharePath(value);
}

function renderAuraShareAction(sharePath, title) {
  return `
    <button class="aura-share-action" type="button" data-action="share-profile" data-share-url="${escapeAttribute(sharePath)}" data-share-title="${escapeAttribute(title)}" aria-label="Share ${escapeAttribute(title)} Multipass profile">
      <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
        <path d="M18 16.1c-.76 0-1.44.3-1.96.77L8.91 12.7a3.27 3.27 0 0 0 0-1.39l7.05-4.13A2.99 2.99 0 1 0 15 5c0 .24.03.47.08.69L8.03 9.82a3 3 0 1 0 0 4.36l7.12 4.18c-.04.2-.06.41-.06.64a2.91 2.91 0 1 0 2.91-2.9Z" />
      </svg>
    </button>
  `;
}

async function shareProfileFromButton(button) {
  const sharePath = button.getAttribute('data-share-url');
  if (!isSafeAuraSharePath(sharePath)) return;
  const title = `${button.getAttribute('data-share-title') || 'Multipass profile'} Multipass`;
  const url = new URL(sharePath, 'https://helixa.xyz').href;
  const browserNavigator = typeof window !== 'undefined' ? window.navigator : (typeof navigator !== 'undefined' ? navigator : null);
  try {
    if (typeof browserNavigator?.share === 'function') {
      await browserNavigator.share({ title, text: title, url });
      return;
    }
    if (browserNavigator?.clipboard?.writeText) {
      await browserNavigator.clipboard.writeText(url);
      button.setAttribute('aria-label', 'Copied share link');
    }
  } catch {
    // User-cancelled share sheets should not navigate away from the profile.
  }
}

function renderAgentAuraProvenanceDrawer(drawer) {
  if (!drawer) return '';
  const facts = (drawer.facts ?? []).filter((fact) => hasRenderableValue(fact?.label) && hasRenderableValue(fact?.value));
  const links = (drawer.links ?? []).filter((link) => hasRenderableValue(link?.label) && isRenderablePublicUrl(link?.url));
  return `
    <section class="aura-provenance-drawer" aria-labelledby="aura-provenance-title">
      <div class="aura-provenance-copy">
        <p class="card-label">Public provenance</p>
        <h2 id="aura-provenance-title">${escapeHtml(drawer.title ?? 'Agent Aura Provenance')}</h2>
        <p>${escapeHtml(drawer.summary ?? 'Public source data for this AgentDNA visual.')}</p>
      </div>
      <div class="aura-provenance-body">
        ${facts.length ? `<div class="aura-provenance-grid">${facts.map(renderProvenanceFact).join('')}</div>` : ''}
        ${links.length ? `<div class="aura-provenance-links" aria-label="Agent Aura provenance links">${links.map((link) => renderSafeLink(link.label, link.url)).join('')}</div>` : ''}
        ${hasRenderableValue(drawer.safetyNote) ? `<p class="aura-provenance-note">${escapeHtml(drawer.safetyNote)}</p>` : ''}
      </div>
    </section>
  `;
}

function renderProvenanceFact(fact) {
  return `
    <article class="aura-provenance-fact">
      <span>${escapeHtml(fact.label)}</span>
      <strong>${escapeHtml(fact.value)}</strong>
    </article>
  `;
}

function hasRenderableValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

function renderAgentCarousel(carousel, selectedAgent, selectedIndex) {
  return `
    <section id="profile-gallery" class="profile-gallery card-carousel">
      <div class="card-carousel-head">
        <p class="eyebrow">${escapeHtml(carousel.eyebrow)}</p>
        <h2>${escapeHtml(carousel.title)}</h2>
        <p>${escapeHtml(carousel.body)}</p>
      </div>
      <div class="card-track" role="tablist" aria-label="Agent cards">
        ${carousel.cards.map((card, index) => renderAgentCardButton(card, index, selectedIndex)).join('')}
      </div>
      ${renderAgentCardDetail(selectedAgent)}
      ${renderOwnerCustodySnapshot(selectedAgent.ownerSnapshot)}
      ${renderChangeReviewLedger(selectedAgent.changeReviewLedger)}
      ${renderTransferPreview(selectedAgent)}
    </section>
  `;
}

function renderAgentCardButton(card, index, selectedIndex) {
  const selected = index === selectedIndex;
  const intuition = getPublicAgentIntuitionContext(card.intuition);
  return `
    <button class="profile-card card-button${selected ? ' selected' : ''}" data-action="select-agent-card" data-index="${index}" type="button" aria-selected="${selected}">
      <span class="profile-card-visual tone-${escapeAttribute(card.visual?.tone ?? 'neutral')}" aria-label="${escapeAttribute(card.visual?.label ?? `${card.name} visual identity`)}">
        ${card.visual?.imageUrl ? `<img src="${escapeAttribute(card.visual.imageUrl)}" alt="${escapeAttribute(card.visual.label)}" loading="lazy" />` : ''}
        <span>${escapeHtml(card.visual?.initials ?? 'MP')}</span>
      </span>
      <span class="profile-card-copy">
        <span class="card-name">${escapeHtml(card.name)}</span>
        <span>${escapeHtml(card.role)} · ${escapeHtml(card.memberLabel)}</span>
        <span>${escapeHtml(card.helixaId)}</span>
        <span>${escapeHtml(card.custody)}</span>
        <span>${escapeHtml(card.proofSummary)}</span>
        <strong>${escapeHtml(card.credLabel)} · Intuition ${escapeHtml(intuition?.label ?? 'not listed')} · ${escapeHtml(card.verifiedLabel)}</strong>
      </span>
    </button>
  `;
}

function renderAgentCardDetail(card) {
  if (card.detailMode === 'swarm') return renderSwarmCardDetail(card);
  const intuition = getPublicAgentIntuitionContext(card.intuition);

  return `
    <article class="card-detail">
      <div>
        <p class="card-label">Selected agent card</p>
        <h3>${escapeHtml(card.name)}</h3>
        <p>Machine-readable identity card for routing, trust checks, roster context, and profile discovery.</p>
      </div>
      <div class="card-fields">
        ${renderField('Helixa ID', card.helixaId)}
        ${renderField('Framework', card.framework)}
        ${renderField('Cred', card.credScore === null ? card.credLabel : `${card.credLabel} (${card.credTier})`, '', 'Helixa trust score and tier for this agent profile.')}
        ${renderField('Intuition graph', intuition?.label ?? 'Not listed', '', intuition?.note ?? 'No Intuition ERC-8004 graph status is attached to this profile yet.')}
        ${renderField('Identity', card.verifiedLabel)}
        ${renderField('Subject', card.subjectLabel)}
        ${renderField('Roster', card.memberLabel)}
        ${renderField('Role', card.role)}
        ${renderField('Custody', card.custody)}
        ${renderField('Profile', card.profileUrl ?? 'Not linked')}
      </div>
    </article>
  `;
}


function renderSwarmCardDetail(card) {
  return `
    <article class="card-detail swarm-detail">
      <div>
        <p class="card-label">Swarm detail</p>
        <h3>${escapeHtml(card.name)}</h3>
        <p>Parent Multipass for Helixa's core agent team. It groups public roster context while each member keeps its own AgentDNA, Cred context, ownership, and permissions.</p>
      </div>
      <div class="swarm-panels">
        <section class="swarm-panel">
          <h4>Roster</h4>
          ${card.roster.map((member) => `
            <div class="swarm-row">
              <strong>${escapeHtml(member.name)}</strong>
              <span>${escapeHtml(member.role)}</span>
            </div>
          `).join('')}
        </section>
        <section class="swarm-panel">
          <h4>Policy references</h4>
          ${card.sharedControls.map((control) => `<span class="control-chip">${escapeHtml(control)}</span>`).join('')}
        </section>
        <section class="swarm-panel wide">
          <h4>Aggregate Cred</h4>
          <p>${escapeHtml(card.aggregateCred ?? `${card.credLabel} (${card.credTier}) gives context only; member scores remain separate.`)}</p>
        </section>
        <section class="swarm-panel wide">
          <h4>Transfer behavior</h4>
          <p>${escapeHtml(card.transferBehavior ?? 'Permissions pause and active routes reverify when custody changes.')}</p>
        </section>
        <section class="swarm-panel wide">
          <h4>Summary</h4>
          <div class="card-fields swarm-fields">
            ${renderField('Helixa ID', card.helixaId)}
            ${renderField('Roster', card.memberLabel)}
            ${renderField('Role', card.role)}
            ${renderField('Custody', card.custody)}
          </div>
        </section>
      </div>
    </article>
  `;
}


function renderOwnerCustodySnapshot(snapshot) {
  if (!snapshot) return '';
  return `
    <section class="owner-snapshot">
      <div class="owner-snapshot-copy">
        <p class="card-label">${escapeHtml(snapshot.title)}</p>
        <h3>${escapeHtml(snapshot.permissionState)}</h3>
        <p>${escapeHtml(snapshot.note)}</p>
      </div>
      <div class="owner-snapshot-grid">
        ${renderSnapshotField('Owner', snapshot.owner)}
        ${renderSnapshotField('Operator', snapshot.operator)}
        ${renderSnapshotField('Custody epoch', snapshot.custodyEpoch)}
        ${renderSnapshotField('Visibility', snapshot.visibility)}
        ${renderSnapshotField('Recent change', snapshot.recentChange)}
        ${renderSnapshotField('Review action', snapshot.reviewAction)}
      </div>
    </section>
  `;
}

function renderSnapshotField(label, value) {
  return `
    <article class="owner-snapshot-field">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `;
}

function renderChangeReviewLedger(ledger) {
  if (!ledger) return '';
  return `
    <section class="change-review-ledger">
      <div class="change-review-head">
        <p class="card-label">${escapeHtml(ledger.eyebrow)}</p>
        <h3>${escapeHtml(ledger.title)}</h3>
        <p>${escapeHtml(ledger.note)}</p>
      </div>
      <div class="change-review-rows">
        ${ledger.rows.map(renderChangeReviewRow).join('')}
      </div>
    </section>
  `;
}

function renderChangeReviewRow(row) {
  return `
    <article class="change-review-row tone-${escapeHtml(row.tone)}">
      <div>
        <span>Change</span>
        <strong>${escapeHtml(row.event)}</strong>
      </div>
      <div>
        <span>Source</span>
        <strong>${escapeHtml(row.source)}</strong>
      </div>
      <div>
        <span>Impact</span>
        <strong>${escapeHtml(row.impact)}</strong>
      </div>
      <div>
        <span>Review</span>
        <strong>${escapeHtml(row.reviewState)}</strong>
      </div>
    </article>
  `;
}


function renderTransferPreview(card) {

  if (!card.transferPreview) return '';
  const preview = card.transferPreview;
  return `
    <section class="transfer-preview">
      <div class="transfer-copy">
        <p class="card-label">${escapeHtml(preview.title)}</p>
        <h3>${escapeHtml(preview.claimAction)}</h3>
        <p>${escapeHtml(preview.note)}</p>
      </div>
      <div class="transfer-steps">
        ${renderTransferStep('Current owner', preview.currentOwner)}
        ${renderTransferStep('Custody epoch', preview.custodyEpoch)}
        ${renderTransferStep('Permissions', preview.permissionsState)}
        ${renderTransferStep('Tools', preview.toolAction)}
        ${renderTransferStep('Private access', preview.privateAccessAction)}
        ${renderTransferStep('History', preview.historyState)}
        ${renderTransferStep('Cred', preview.credContinuity)}
      </div>
    </section>
  `;
}

function renderTransferStep(label, value) {
  return `
    <article class="transfer-step">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `;
}

function renderCommunicationChannelsPanel(data) {
  const channels = getCommunicationChannels(data);
  const policy = getCommunicationContactPolicy(data);
  const optionalSources = ['Email', 'Telegram', 'X', 'Farcaster', 'Wiretap', 'AgentMail'];

  return `
    <section class="communication-panel" aria-label="Communication">
      <div class="communication-heading">
        <p class="card-label">Communication</p>
        <h3>Public contact and social routes.</h3>
        <p>Public contact references for agent discovery and coordination. Optional sources include ${optionalSources.map(escapeHtml).join(', ')}.</p>
      </div>
      ${policy ? renderCommunicationPolicy(policy) : ''}
      ${channels.length ? `
        <div class="communication-channel-list">
          ${channels.map(renderCommunicationChannelCard).join('')}
        </div>
      ` : renderCommunicationEmptyState(optionalSources)}
      <p class="communication-safety">Public contact metadata only. Viewing does not grant reply rights, open hidden messages, authorize actions, or prove account ownership by itself.</p>
    </section>
  `;
}

function renderCommunicationPolicy(policy) {
  const modeLabel = String(policy.mode ?? '')
    .replaceAll('_', ' ')
    .replace(/^\w/, (letter) => letter.toUpperCase());
  const approval = policy.requiresOwnerApproval === true
    ? 'Owner approval required'
    : policy.requiresOwnerApproval === false ? 'Open contact policy' : '';
  return `
    <section class="communication-policy">
      ${modeLabel ? `<span>${escapeHtml(modeLabel)}</span>` : ''}
      ${approval ? `<strong>${escapeHtml(approval)}</strong>` : ''}
      ${policy.note ? `<p>${escapeHtml(policy.note)}</p>` : ''}
    </section>
  `;
}

function renderCommunicationEmptyState(optionalSources) {
  return `
    <div class="communication-empty">
      <strong>No public communication routes published yet.</strong>
      <p>Managers can add optional public contact references later without implying account authority, reply guarantees, or private message access.</p>
      <div class="communication-chip-list" aria-label="Optional communication sources">
        ${optionalSources.map((source) => `<span class="communication-chip">${escapeHtml(source)}</span>`).join('')}
      </div>
    </div>
  `;
}

function renderCommunicationChannelCard(channel) {
  const link = renderCommunicationValue(channel);
  const facts = [
    { label: 'Channel', value: channel.label },
    { label: 'Status', value: communicationStatusLabel(channel.status) },
    { label: 'Source', value: channel.sourceLabel || 'Public fragment' },
    { label: 'Proof note', value: channel.proofNote || 'Public reference only' },
  ];
  return `
    <article class="communication-channel-card" data-fragment-id="${escapeAttribute(channel.fragmentId || '')}">
      <div class="communication-channel-head">
        <div>
          <p class="card-label">${escapeHtml(channel.label)}</p>
          <h4>${link}</h4>
        </div>
        ${isRenderableCommunicationUrl(channel.sourceUrl) ? renderSafeLink('Source', channel.sourceUrl) : ''}
      </div>
      <div class="communication-facts">
        ${facts.map(renderCommunicationFact).join('')}
      </div>
    </article>
  `;
}

function renderCommunicationValue(channel) {
  if (isRenderableCommunicationUrl(channel.url)) {
    return `<a href="${escapeAttribute(channel.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(channel.value)}</a>`;
  }
  return escapeHtml(channel.value || 'Not published');
}

function renderCommunicationFact(fact) {
  return `
    <article class="communication-fact">
      <span>${escapeHtml(fact.label)}</span>
      <strong>${escapeHtml(fact.value || 'Not published')}</strong>
    </article>
  `;
}

function communicationStatusLabel(status) {
  const normalized = String(status ?? '').trim().toLowerCase();
  if (!normalized) return 'Published reference';
  if (normalized === 'pending') return 'Review required';
  return normalized.replaceAll('_', ' ').replace(/^\w/, (letter) => letter.toUpperCase());
}

function isRenderableCommunicationUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(String(url));
    return ['https:', 'http:', 'mailto:'].includes(parsed.protocol) && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

function renderMarketplacePresencePanel(data) {
  const cards = getMarketplacePresenceEntries(data);
  const optionalSources = ['OKX.AI', 'OpenSea', 'Bankr', 'ACP', 'direct x402'];

  return `
    <section class="marketplace-presence-panel" aria-label="Marketplace Connections">
      <div class="marketplace-presence-heading">
        <p class="card-label">Marketplace Connections</p>
        <h3>Optional marketplace connections.</h3>
        <p>Public, read-only marketplace metadata for portable trust context. Supported sources include ${optionalSources.map(escapeHtml).join(', ')}. These references do not execute marketplace actions or prove trust by payment alone.</p>
      </div>
      ${cards.length ? `
        <div class="marketplace-presence-list">
          ${cards.map(renderMarketplacePresenceCard).join('')}
        </div>
      ` : renderMarketplacePresenceEmptyState(optionalSources)}
      <p class="marketplace-presence-safety">Optional public marketplace metadata only. Viewing does not execute marketplace actions, collect x401 proof, change authority, call tools, release credentials, start escrow, sign with wallets, write onchain, or prove trust by payment alone.</p>
    </section>
  `;
}

function renderMarketplacePresenceEmptyState(optionalSources) {
  return `
    <div class="marketplace-presence-empty">
      <strong>No marketplace connections published yet.</strong>
      <p>Managers can reference optional public listings later without implying registration, custody, account authority, payments, or official marketplace integration.</p>
      <div class="marketplace-presence-chip-list" aria-label="Optional marketplace connection sources">
        ${optionalSources.map((source) => `<span class="marketplace-presence-chip">${escapeHtml(source)}</span>`).join('')}
      </div>
    </div>
  `;
}

function marketplacePresenceReputationFacts(reputation) {
  return [
    { label: 'Score', value: reputation.score },
    { label: 'Positive rate', value: reputation.positiveRate },
    { label: 'Sold', value: reputation.soldCount },
    { label: 'Reviews', value: reputation.reviewCount },
  ].filter((fact) => fact.value);
}

function renderMarketplacePresenceCard(card) {
  const verifiedSourceUrl = getPlatformVerifiedMarketplacePresenceSourceUrl(card);
  const statusLabel = getMarketplacePresenceStatusLabel(card, verifiedSourceUrl);
  const statusLink = verifiedSourceUrl ? renderSafeLink(statusLabel, verifiedSourceUrl) : escapeHtml(statusLabel);
  const provenanceFacts = [
    { label: 'Marketplace', value: card.marketplace },
    { label: 'Listing ID', value: card.listingId || 'Not published' },
    { label: 'Status', html: statusLink },
    { label: 'Source checked', value: card.source.checkedAt || 'Not published' },
    { label: 'Provenance', value: card.source.provenance || 'Public marketplace metadata' },
    ...card.facts,
  ];

  return `
    <article class="marketplace-presence-card" data-listing-id="${escapeAttribute(card.listingId || '')}">
      <div class="marketplace-presence-card-head">
        <div>
          <p class="card-label">Marketplace</p>
          <h4>${escapeHtml(card.title || card.marketplace)}</h4>
          ${card.summary ? `<p>${escapeHtml(card.summary)}</p>` : ''}
        </div>
        <div class="marketplace-presence-links">
          ${card.profileUrl ? renderSafeLink('Marketplace profile', card.profileUrl) : ''}
          ${card.source.url ? renderSafeLink(card.source.label || 'Source', card.source.url) : ''}
        </div>
      </div>
      <div class="marketplace-presence-facts">
        ${provenanceFacts.map(renderMarketplacePresenceFact).join('')}
      </div>
      ${renderMarketplacePresenceServices(card.services)}
      ${renderMarketplacePresencePaymentRails(card.paymentRails)}
      ${renderMarketplacePresenceReputation(card.reputation)}
    </article>
  `;
}

function renderMarketplacePresenceFact(fact) {
  return `
    <article class="marketplace-presence-fact">
      <span>${escapeHtml(fact?.label ?? '')}</span>
      <strong>${fact?.html ?? escapeHtml(fact?.value ?? 'Not published')}</strong>
    </article>
  `;
}

function renderMarketplacePresenceServices(services) {
  if (!services.length) return '';
  return `
    <section class="marketplace-presence-subsection">
      <h5>Services</h5>
      <div class="marketplace-presence-service-list">
        ${services.map((service) => `
          <article class="marketplace-presence-service">
            <strong>${escapeHtml(service.name || 'Marketplace service')}</strong>
            ${service.price ? `<span>${escapeHtml(service.price)}</span>` : ''}
            ${service.paymentMode ? `<span>${escapeHtml(service.paymentMode)}</span>` : ''}
            ${isRenderablePublicUrl(service.endpointUrl) ? renderSafeLink('Endpoint', service.endpointUrl) : ''}
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

function renderMarketplacePresencePaymentRails(paymentRails) {
  if (!paymentRails.length) return '';
  return `
    <section class="marketplace-presence-subsection">
      <h5>Payment rails</h5>
      <div class="marketplace-presence-chip-list">
        ${paymentRails.map((rail) => [rail.asset, rail.mode, rail.chain]
          .filter(Boolean)
          .map((value) => `<span class="marketplace-presence-chip">${escapeHtml(value)}</span>`)
          .join('')).join('')}
      </div>
    </section>
  `;
}

function renderMarketplacePresenceReputation(reputation) {
  const facts = marketplacePresenceReputationFacts(reputation);
  if (!facts.length) return '';
  return `
    <section class="marketplace-presence-subsection">
      <h5>Reputation facts</h5>
      <div class="marketplace-presence-facts compact">
        ${facts.map(renderMarketplacePresenceFact).join('')}
      </div>
    </section>
  `;
}

function getMarketplacePresenceStatusLabel(card, verifiedSourceUrl) {
  if (verifiedSourceUrl) return 'Platform verified source';
  const normalizedStatus = String(card?.status ?? '').trim().toLowerCase();
  if (!normalizedStatus || normalizedStatus === 'platform_verified') return 'Public metadata';
  return normalizedStatus
    .replaceAll('_', ' ')
    .replace(/\s+/g, ' ')
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function getPlatformVerifiedMarketplacePresenceSourceUrl(card) {
  const proof = card?.proof && typeof card.proof === 'object' && !Array.isArray(card.proof) ? card.proof : null;
  if (String(proof?.assurance ?? '').toLowerCase() !== 'platform_verified') return '';
  const sourceUrl = firstPresentText(card?.source?.url);
  return isRenderablePublicUrl(sourceUrl) ? sourceUrl : '';
}

function firstPresentText(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
}

function renderMarketplaceListing(listing) {
  if (!listing) return '';
  return `
    <section class="marketplace-listing" aria-label="Public agent profile marketplace compatibility context">
      <div class="listing-shell">
        <div class="listing-copy">
          <p class="card-label">Public agent profile context</p>
          <h2>${escapeHtml(listing.title ?? 'Agent listing')}</h2>
          <p>${escapeHtml(listing.summary ?? 'Public AgentDNA source evidence prepared for marketplace discovery.')}</p>
          ${listing.subtitle ? `<span class="listing-subtitle">${escapeHtml(listing.subtitle)}</span>` : ''}
        </div>
        <div class="listing-score">
          <span>${escapeHtml(listing.score?.tier ?? 'Unrated')}</span>
          <strong>${escapeHtml(listing.score?.label ?? 'Cred pending')}</strong>
        </div>
      </div>
      <div class="listing-badges">${(listing.badges ?? []).map(renderListingBadge).join('')}</div>
      <section class="listing-identity">
        ${renderListingFact({ label: 'Helixa ID', value: listing.identity?.helixaId ?? 'Not published' })}
        ${renderListingFact({ label: 'Framework', value: listing.identity?.framework ?? 'unknown' })}
        ${renderListingFact({ label: 'Identity', value: listing.identity?.verifiedLabel ?? 'Unverified AgentDNA' })}
        ${renderListingFact({ label: 'Source', value: listing.identity?.sourceLabel ?? 'Live Helixa API' })}
        ${(listing.facts ?? []).map(renderListingFact).join('')}
      </section>
      <section class="listing-sections">
        <article class="listing-section">
          <h3>Public routes</h3>
          ${renderListingRoutes(listing.routes)}
        </article>
        <article class="listing-section">
          <h3>Payment references</h3>
          ${renderListingPayments(listing.paymentReferences)}
        </article>
      </section>
      ${renderListingProofStrip(listing.proof)}
      ${renderListingLinks(listing.links)}
      <p class="listing-safety">${escapeHtml(listing.safetyNote ?? 'Public inspection only. Marketplace compatibility does not execute listings, authority changes, payments, or private data access.')}</p>
    </section>
  `;
}

function renderListingBadge(badge) {
  return `<span class="listing-badge tone-${escapeAttribute(badge?.tone ?? 'neutral')}">${escapeHtml(badge?.label ?? '')}</span>`;
}

function renderListingFact(fact) {
  return `
    <article class="listing-fact">
      <span>${escapeHtml(fact?.label ?? '')}</span>
      <strong>${escapeHtml(fact?.value ?? 'Not published')}</strong>
    </article>
  `;
}

function renderListingRoutes(routes = []) {
  if (!routes.length) {
    return '<div class="listing-routes"><article><span>Routes</span><strong>No public service routes published</strong></article></div>';
  }
  return `<div class="listing-routes">${routes.map((route) => `
    <article>
      <span>${escapeHtml(route?.label ?? 'Route')}</span>
      <strong>${renderSafeLink(route?.value ?? '', route?.url)}</strong>
    </article>
  `).join('')}</div>`;
}

function renderListingPayments(payments = []) {
  if (!payments.length) return '<div class="listing-payments"><span class="listing-payment">No public payment references published</span></div>';
  return `<div class="listing-payments">${payments.map((payment) => `<span class="listing-payment">${escapeHtml(payment?.value ?? '')}${payment?.source ? ` · ${escapeHtml(payment.source)}` : ''}</span>`).join('')}</div>`;
}

function renderListingProofStrip(proof) {
  if (!proof) return '';
  return `<section class="listing-proof-strip">
    ${renderListingFact({ label: 'Public proof', value: `${proof.publicFragmentCount ?? 0} fragments` })}
    ${renderListingFact({ label: 'Verified signals', value: proof.verifiedSignalCount ?? 0 })}
    ${renderListingFact({ label: 'Review queue', value: proof.reviewRequiredCount ?? 0 })}
    ${renderListingFact({ label: 'Private access', value: proof.privateCredentialState ?? 'No secrets or private credentials exposed' })}
  </section>`;
}

function renderListingLinks(links = []) {
  if (!links.length) return '';
  return `<div class="listing-links">${links.map((link) => `<span class="listing-link">${renderSafeLink(link?.label ?? 'Link', link?.url)}</span>`).join('')}</div>`;
}

function renderSafeLink(label, url) {
  if (!isRenderablePublicUrl(url)) return `<span>${escapeHtml(label)}</span>`;
  return `<a href="${escapeAttribute(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
}

function isRenderablePublicUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(String(url));
    return ['https:', 'http:'].includes(parsed.protocol) && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

function renderStoryCard(card, index) {
  return `
    <article class="story">
      <span class="story-num">${String(index + 1).padStart(2, '0')}</span>
      <p class="card-label">${escapeHtml(card.label)}</p>
      <h3>${escapeHtml(card.title)}</h3>
      <p>${escapeHtml(card.body)}</p>
    </article>
  `;
}

function renderClarityCard(section) {
  return `
    <article class="clarity-card">
      <h3>${escapeHtml(section.title)}</h3>
      <p>${escapeHtml(section.body)}</p>
    </article>
  `;
}

function renderFragmentTrustMap(map) {
  return `
    <section class="fragment-map">
      <div class="fragment-map-head">
        <p class="eyebrow">${escapeHtml(map.eyebrow)}</p>
        <h2>${escapeHtml(map.title)}</h2>
        <p>${escapeHtml(map.body)}</p>
      </div>
      <div class="fragment-cards">
        ${map.cards.map(renderFragmentCard).join('')}
      </div>
      <details class="fragment-legend">
        <summary>Proof vocabulary</summary>
        ${renderLegendGroup('Fragment type legend', map.legends.fragmentType)}
        ${renderLegendGroup('Status legend', map.legends.status)}
        ${renderLegendGroup('Visibility legend', map.legends.visibility)}
        ${renderLegendGroup('Assurance legend', map.legends.assurance)}
        ${renderLegendGroup('Transfer policy', map.legends.transferPolicy)}
      </details>
      <p class="fragment-note">${escapeHtml(map.emptyPrivateNote)}</p>
    </section>
  `;
}

function renderFragmentCard(card) {
  return `
    <article class="fragment-card">
      <div class="fragment-card-top">
        <span class="fragment-type">${escapeHtml(card.typeLabel)}</span>
        <span class="fragment-status status-${escapeHtml(card.status)}">${escapeHtml(card.status)}</span>
      </div>
      <h3>${escapeHtml(card.title)}</h3>
      <p class="fragment-context">${escapeHtml(card.summary)}</p>
      <p class="fragment-value"><span>Refers to</span>${escapeHtml(card.publicValue)}</p>
      <dl>
        <div><dt>Status</dt><dd>${escapeHtml(card.statusLabel ?? card.status)}</dd><small>${escapeHtml(card.statusExplanation)}</small></div>
        <div><dt>Assurance</dt><dd>${escapeHtml(card.assuranceLabel)}</dd><small>${escapeHtml(card.assuranceExplanation)}</small></div>
        <div><dt>Visibility</dt><dd>${escapeHtml(card.visibility)}</dd><small>${escapeHtml(card.visibilityExplanation)}</small></div>
        <div><dt>Transfer</dt><dd>${escapeHtml(card.transferPolicyLabel)}</dd><small>${escapeHtml(card.transferPolicyExplanation)}</small></div>
        <div><dt>Source</dt><dd>${escapeHtml(card.sourceLabel ?? 'Unknown source')}</dd><small>The named source that supplied or checked this signal.</small></div>
      </dl>
    </article>
  `;
}

function renderLegendGroup(title, entries) {
  return `
    <article>
      <h3>${escapeHtml(title)}</h3>
      ${Object.entries(entries).map(([key, value]) => `
        <div class="legend-row">
          <strong>${escapeHtml(key)}</strong>
          <span>${escapeHtml(value)}</span>
        </div>
      `).join('')}
    </article>
  `;
}

function renderProofRow(card, index, expandedCard) {
  const expanded = expandedCard === index;
  return `
    <article class="ledger-entry">
      <div class="ledger-row">
        <div class="doc">${escapeHtml(card.title)}</div>
        <div class="badge ${getBadgeTone(card)}">${escapeHtml(card.status)}</div>
        <div class="summary">
          <span>${escapeHtml(card.summary)}</span>
          <span class="why">${escapeHtml(card.why)}</span>
        </div>
        <button data-action="toggle-json" data-index="${index}" aria-expanded="${expanded}" aria-controls="proof-json-${index}">${expanded ? 'Hide JSON' : 'Show JSON'}</button>
      </div>
      ${expanded ? `<pre id="proof-json-${index}" class="json-panel">${escapeHtml(JSON.stringify(card.json, null, 2))}</pre>` : ''}
    </article>
  `;
}


function getBadgeTone(card) {
  return ['settled', 'passed', 'filtered'].includes(String(card.status).toLowerCase()) ? 'verified' : 'neutral';
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
