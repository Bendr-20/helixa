import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  assertAgentCard,
  assertIdentityFragment,
  assertMultipassProfile,
  assertReceiptFragment,
  assertStandardsProfile,
  assertX402Manifest,
  assertX401Manifest,
} from '@helixa/multipass-sdk';

import {
  ERC8004_SOURCE_TYPE,
  HELIXA_SOURCE_TYPE,
  buildHydratedProfileResponse,
  normalizeMultipassSourceInput,
} from './canonical-profile.js';
import { getAllowlistProof } from './allowlist-snapshot.js';
import { createConsoleAgentRuntime } from './agent-runtime/index.js';
import { createBankrLlmClient } from './bankr-llm/index.js';
import { searchBankrMarketplaceSkills } from './bankr-marketplace-catalog.js';
import { createConsoleAuthStore } from './console-auth.js';
import { ConsoleCreditError } from './console-credit.js';
import {
  CONSOLE_IMAGE_REQUEST_MAX_BYTES,
  normalizeConsoleImageAttachment,
} from './console-image-attachment.js';
import { createConsoleReadSkillExecutor } from './console-read-skills.js';
import {
  RESTAP_LIMITS,
  normalizeRestapNewsPost,
  normalizeRestapNewsRead,
  normalizeRestapNewsWriteAcknowledgment,
  normalizeRestapTalkRequest,
} from './restap-3802-contracts.js';
import { RestapPolicyNotAuthorizedError } from './restap-3802-policy.js';
import { RestapVerifiedSendError } from './restap-network/verified-send.js';
export { createRestapVerifiedSendService, createSameProcessRestapTalkTransport } from './restap-network/verified-send.js';
import {
  normalizeRestapNetworkIntentCancel,
  normalizeRestapNetworkIntentInput,
  normalizeRestapNetworkPolicyInput,
  normalizeRestapNetworkStopInput,
  normalizeRestapNetworkTokenId,
} from './restap-network/schema.js';
import { parseStrictJsonObject } from './strict-json-envelope.js';
import { deriveReleasedLooperAccount } from './looper-account.js';
import {
  createLooperCredClient,
  enrichOwnedLoopersWithCred,
} from './looper-cred-client.js';
import {
  LooperCodexInputError,
  LooperCodexUnavailableError,
} from './looper-codex-runtime.js';
import {
  LOOPERS_MAINNET_CHAIN_ID,
  LOOPERS_MAINNET_CONTRACT,
  authorizeLooperControl,
  createLoopersOwnedAgentLoader,
  createLoopersPublicClients,
} from './loopers-owned-agents.js';
import { createSqliteLooperNameStore } from './looper-name-store.js';
import { createLooperRuntimeRegistry } from './looper-runtime-registry.js';
import { createLooperWalletReadContextLoader } from './looper-wallet-read-context.js';
import { AllowlistInputError, normalizeAllowlistAddress } from './allowlist-store.js';
import { GroupActivationError, createGroupActivationPreview } from './group-activation.js';
import { deriveMarketplacePresenceFromFragments } from './marketplace-presence.js';
import { loadPantheonCredRegistry } from './pantheon-cred-registry.js';
import { verifyEthereumPersonalSignature } from './signature-verifier.js';
import {
  deriveAgentCardServiceUpdates,
  deriveX402ManifestFromTools,
  summarizeToolsResponse,
} from './tool-manifest.js';
import { deriveX401ManifestFromFragments } from './x401-manifest.js';
import { createDeferredXmtpAgentClient } from './xmtp-agent/index.js';
import { handleMissionRequest } from './missions/routes.js';
import { previewSwarmLaunch } from './missions/swarm-launch-preview.js';
import { ConsentError } from './missions/swarm-launch-consent.js';

export {
  createMissionService, MissionServiceError, MISSION_REQUEST_MAX_BYTES, projectPrivateMission, projectPublicMission,
} from './missions/index.js';

const SWARM_LAUNCH_WALLET_RATE_LIMIT = Object.freeze({ limit: 12, windowMs: 60_000 });
const SWARM_LAUNCH_GLOBAL_RATE_LIMIT = Object.freeze({ limit: 120, windowMs: 60_000 });
const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
};
const MANAGER_COOKIE_NAME = 'multipass_manager';
const CONSOLE_COOKIE_NAME = 'multipass_console';
const SUPPORTED_HYDRATED_SOURCE_TYPES = new Set([HELIXA_SOURCE_TYPE, ERC8004_SOURCE_TYPE]);
const LOOPERS_ALLOWLIST_RATE_LIMIT = {
  limit: 1,
  windowMs: 600_000,
};
const LOOPERS_ALLOWLIST_SUBNET_RATE_LIMIT = {
  limit: 4,
  windowMs: 600_000,
};
const LOOPERS_ALLOWLIST_GLOBAL_RATE_LIMIT = {
  limit: 30,
  windowMs: 3_600_000,
};
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const CONSOLE_MESSAGE_MAX_BYTES = 2_000;
const CONSOLE_MESSAGE_SHORT_RATE_LIMIT = { limit: 6, windowMs: 60_000 };
const CONSOLE_MESSAGE_DAILY_RATE_LIMIT = { limit: 100, windowMs: 86_400_000 };
const CONSOLE_MESSAGE_GLOBAL_CONCURRENCY = 8;
const CONSOLE_CODEX_REQUEST_MAX_BYTES = 16 * 1024;
const RESTAP_NETWORK_CONSOLE_REQUEST_MAX_BYTES = 16 * 1024;
const CONSOLE_CODEX_WALLET_RATE_LIMIT = { limit: 120, windowMs: 60_000 };
const CONSOLE_CODEX_GLOBAL_RATE_LIMIT = { limit: 1_200, windowMs: 60_000 };
const CONSOLE_CREDIT_REQUEST_MAX_BYTES = 16 * 1024;
const CONSOLE_CREDIT_WALLET_RATE_LIMIT = { limit: 30, windowMs: 60_000 };
const CONSOLE_CREDIT_GLOBAL_RATE_LIMIT = { limit: 300, windowMs: 60_000 };
const CONSOLE_CODEX_WALLET_MAX_BUCKETS = 2_400;
const CONSOLE_CODEX_OPERATIONS = new Set([
  'getTokenProfile',
  'explainTraits',
  'compareTokens',
  'findByTraits',
  'findSimilar',
  'getTraitStats',
  'getCollectionSummary',
]);

export function createMemoryStore(input = {}) {
  const {
    profiles: profileInput = [],
    fragments: fragmentInput = [],
    agentCards: agentCardInput = [],
    standardsProfiles: standardsProfileInput = [],
    x402Manifests: x402ManifestInput = [],
    x401Manifests: x401ManifestInput = [],
    receiptFragments: receiptFragmentInput = [],
  } = input;

  const profiles = profileInput.map(assertMultipassProfile);
  const fragments = fragmentInput.map(assertIdentityFragment);
  const agentCards = agentCardInput.map(assertAgentCard);
  const standardsProfiles = standardsProfileInput.map(assertStandardsProfile);
  const x402Manifests = x402ManifestInput.map(assertX402Manifest);
  const x401Manifests = x401ManifestInput.map(assertX401Manifest);
  const receiptFragments = receiptFragmentInput.map(assertReceiptFragment);

  const profilesById = new Map();
  const profilesBySlug = new Map();
  const fragmentsByProfile = new Map();
  const agentCardsByProfile = new Map();
  const standardsByProfile = new Map();
  const x402ByProfile = new Map();
  const x401ByProfile = new Map();
  const receiptsByProfile = new Map();

  for (const profile of profiles) {
    profilesById.set(profile.multipass_id, profile);
    profilesBySlug.set(profile.slug, profile);
  }

  for (const fragment of fragments) {
    appendToMapList(fragmentsByProfile, fragment.multipass_id, fragment);
  }

  for (const agentCard of agentCards) {
    agentCardsByProfile.set(agentCard.multipass_id, agentCard);
  }

  for (const standardsProfile of standardsProfiles) {
    standardsByProfile.set(standardsProfile.multipass_id, standardsProfile);
  }

  for (const manifest of x402Manifests) {
    x402ByProfile.set(manifest.multipass_id, manifest);
  }

  for (const manifest of x401Manifests) {
    x401ByProfile.set(manifest.multipass_id, manifest);
  }

  for (const receipt of receiptFragments) {
    appendToMapList(receiptsByProfile, receipt.multipass_id, receipt);
  }

  return {
    resolveProfile(identifier) {
      return profilesById.get(identifier) ?? profilesBySlug.get(identifier) ?? null;
    },

    getPublicFragments(multipassId) {
      return (fragmentsByProfile.get(multipassId) ?? []).filter((fragment) => fragment.visibility === 'public');
    },

    getTools(multipassId) {
      return summarizeToolsResponse(multipassId, fragmentsByProfile.get(multipassId) ?? []);
    },

    getAgentCard(multipassId, options = {}) {
      const agentCard = agentCardsByProfile.get(multipassId) ?? null;
      if (!agentCard) return null;
      return deriveAgentCardServiceUpdates(agentCard, fragmentsByProfile.get(multipassId) ?? [], options.baseUrl ?? '');
    },

    getStandardsProfile(multipassId) {
      return standardsByProfile.get(multipassId) ?? null;
    },

    getX402Manifest(multipassId) {
      const derived = deriveX402ManifestFromTools(multipassId, fragmentsByProfile.get(multipassId) ?? []);
      if (derived.endpoints.length > 0) return derived;
      return x402ByProfile.get(multipassId) ?? null;
    },

    getX401Manifest(multipassId) {
      const derived = deriveX401ManifestFromFragments(multipassId, fragmentsByProfile.get(multipassId) ?? []);
      if (derived.x401_supported) return derived;
      return x401ByProfile.get(multipassId) ?? derived;
    },

    getReceiptFragments(multipassId) {
      return receiptsByProfile.get(multipassId) ?? [];
    },

    getReceiptFragment(multipassId, receiptId) {
      return (receiptsByProfile.get(multipassId) ?? []).find((receipt) => receipt.receipt_id === receiptId) ?? null;
    },

    searchProfiles(query, options = {}) {
      return searchProfileList(profiles, query, options);
    },
  };
}

export function createMultipassApi({
  store,
  baseUrl,
  savedRecords,
  missionService,
  swarmLaunchConsentService,
  activationService,
  allowedOrigins,
  adminSecret,
  signatureVerifier = verifyEthereumPersonalSignature,
  cookieSecure,
  fetchImpl = fetch,
  loopersAllowlist,
  loopersAllowlistSnapshot,
  loopersAllowlistRateLimit,
  loopersAllowlistSubnetRateLimit,
  loopersAllowlistGlobalRateLimit,
  loopersAllowlistRegistrationPaused = false,
  loopersAllowlistRequireBrowserOrigin = false,
  loopersAllowlistBlockedSources = [],
  loopersTurnstileSecretKey,
  looperMarketplaceListingsLoader,
  looperMarketplacePreviewLoader,
  looperMarketplaceWalletValuesLoader,
  loopersOwnedAgentLoader,
  loopersOwnedRpcUrl,
  loopersOwnedMetadataBaseUrl,
  loopersPublicClients,
  loopersAuthorizer,
  looperNameStore,
  looperCredClient,
  loopersCredApiBaseUrl,
  loopersCredTimeoutMs,
  loopersCredConcurrency,
  consoleAuthStore,
  consoleCreditService,
  consoleRuntimeRegistry,
  restapNetworkActivationLeases,
  restapNetworkCustodyReconciler,
  restapNetworkPolicyGeneration = 0,
  bankrLlmKey,
  bankrReadonlyApiKey,
  bankrLlmModel,
  bankrLlmVisionModel,
  consoleAgentBankrLlmEnabled = false,
  consoleSkillProposalsEnabled = false,
  consoleMarketReadEnabled = false,
  consoleAccountReadEnabled = false,
  consoleXmtpEnabled = false,
  consoleXmtpEnv = 'production',
  consoleXmtpWalletKey = null,
  consoleXmtpDbPath = null,
  consoleXmtpDbEncryptionKey = null,
  consoleXmtpHistorySyncUrl = null,
  consoleXmtpApiUrl = null,
  consoleXmtpGatewayHost = null,
  consoleXmtpAppVersion = 'multipass-console',
  consoleXmtpClient,
  consoleAgentRuntime,
  consoleWalletContextLoader,
  looperCodexRuntime,
  restapNetworkService = null,
  restapVerifiedSendService = null,
  logger = console,
  consoleCodexWalletRateLimit,
  consoleCodexGlobalRateLimit,
  consoleCodexRateLimitNow = () => Date.now(),
  consoleCodexWalletMaxBuckets = CONSOLE_CODEX_WALLET_MAX_BUCKETS,
  consoleMessageShortRateLimit,
  consoleMessageDailyRateLimit,
  consoleMessageGlobalConcurrency = CONSOLE_MESSAGE_GLOBAL_CONCURRENCY,
  consoleSkillProviderTimeoutMs,
  restapDiscoveryEnabled = false,
  restapTalkEnabled = false,
  restap3802Policy,
  restapTalkRuntime,
  restapNewsWriteEnabled = false,
  restapNewsReadEnabled = false,
  restapNewsStore,
  restapNewsAuthenticator,
  restapTalkLimits,
  restapRateLimitNow = () => Date.now(),
} = {}) {
  if (!store) {
    throw new TypeError('createMultipassApi requires a store');
  }

  const normalizedBaseUrl = stripTrailingSlash(baseUrl ?? 'http://localhost');
  const resolvedLooperCodexRuntime = looperCodexRuntime ?? createUnavailableCodexRuntime();
  const runtime = consoleAgentRuntime ?? createConsoleAgentRuntime({
    looperCodexRuntime: resolvedLooperCodexRuntime,
    llmClient: consoleAgentBankrLlmEnabled
      ? createBankrLlmClient({
        apiKey: bankrLlmKey,
        model: bankrLlmModel,
        visionModel: bankrLlmVisionModel,
        fetchImpl,
        skillProposalsEnabled: consoleSkillProposalsEnabled,
      }) ?? undefined
      : undefined,
    skillProposalsEnabled: consoleSkillProposalsEnabled,
    marketReadEnabled: consoleMarketReadEnabled,
    accountReadEnabled: consoleAccountReadEnabled,
    ...(consoleSkillProposalsEnabled || consoleMarketReadEnabled || consoleAccountReadEnabled ? {
      readSkillExecutor: createConsoleReadSkillExecutor({
        bankrApiKey: bankrReadonlyApiKey,
        fetchImpl,
      }),
      bankrReadEnabled: Boolean(String(bankrReadonlyApiKey ?? '').trim()),
      skillProviderTimeoutMs: consoleSkillProviderTimeoutMs,
    } : {}),
    xmtpClient: consoleXmtpClient ?? createDeferredXmtpAgentClient({
      enabled: consoleXmtpEnabled,
      env: consoleXmtpEnv,
      walletKey: consoleXmtpWalletKey,
      dbPath: consoleXmtpDbPath,
      dbEncryptionKey: consoleXmtpDbEncryptionKey,
      historySyncUrl: consoleXmtpHistorySyncUrl,
      apiUrl: consoleXmtpApiUrl,
      gatewayHost: consoleXmtpGatewayHost,
      appVersion: consoleXmtpAppVersion,
    }),
  });
  const looperClients = loopersOwnedAgentLoader && loopersAuthorizer
    ? null
    : createLoopersPublicClients({
      rpcUrl: loopersOwnedRpcUrl,
      publicClients: loopersPublicClients,
    });
  const authorizedOwnedLoopersLoader = loopersOwnedAgentLoader ?? createLoopersOwnedAgentLoader({
    fetchImpl,
    publicClients: looperClients,
    ...(loopersOwnedMetadataBaseUrl ? { metadataBaseUrl: loopersOwnedMetadataBaseUrl } : {}),
  });
  const canonicalCredClient = looperCredClient ?? (loopersCredApiBaseUrl
    ? createLooperCredClient({
      baseUrl: loopersCredApiBaseUrl,
      fetchImpl,
      ...(loopersCredTimeoutMs ? { timeoutMs: loopersCredTimeoutMs } : {}),
    })
    : null);
  const ownedLoopersLoader = canonicalCredClient
    ? async (input) => enrichOwnedLoopersWithCred(
      await authorizedOwnedLoopersLoader(input),
      {
        credClient: canonicalCredClient,
        ...(loopersCredConcurrency ? { concurrency: loopersCredConcurrency } : {}),
      },
    )
    : authorizedOwnedLoopersLoader;
  const authorizeLooper = loopersAuthorizer ?? ((input) => authorizeLooperControl({ ...input, publicClients: looperClients }));
  const walletContextLoader = consoleWalletContextLoader ?? (looperClients
    ? createLooperWalletReadContextLoader({ publicClients: looperClients })
    : null);
  const context = {
    store,
    savedRecords,
    missionService: missionService ?? null,
    swarmLaunchConsentService: swarmLaunchConsentService ?? null,
    swarmLaunchWalletRateLimiter: createFixedWindowRateLimiter(SWARM_LAUNCH_WALLET_RATE_LIMIT),
    swarmLaunchGlobalRateLimiter: createFixedWindowRateLimiter(SWARM_LAUNCH_GLOBAL_RATE_LIMIT),
    activationService,
    normalizedBaseUrl,
    allowedOrigins: normalizeAllowedOrigins(allowedOrigins, normalizedBaseUrl),
    adminSecret,
    signatureVerifier,
    cookieSecure: cookieSecure ?? inferSecureCookie(allowedOrigins, normalizedBaseUrl),
    cookieName: MANAGER_COOKIE_NAME,
    consoleCookieName: CONSOLE_COOKIE_NAME,
    consoleAuthStore: consoleAuthStore ?? createConsoleAuthStore(),
    consoleCreditService: consoleCreditService ?? null,
    consoleCreditWalletRateLimiter: createFixedWindowRateLimiter(CONSOLE_CREDIT_WALLET_RATE_LIMIT),
    consoleCreditGlobalRateLimiter: createFixedWindowRateLimiter(CONSOLE_CREDIT_GLOBAL_RATE_LIMIT),
    fetchImpl,
    loopersAllowlist,
    loopersAllowlistSnapshot,
    loopersAllowlistRegistrationPaused: Boolean(loopersAllowlistRegistrationPaused),
    loopersAllowlistRequireBrowserOrigin: Boolean(loopersAllowlistRequireBrowserOrigin),
    loopersAllowlistBlockedSources: new Set(loopersAllowlistBlockedSources.map(normalizeLooperAllowlistSource).filter(Boolean)),
    loopersAllowlistRateLimiter: createFixedWindowRateLimiter(loopersAllowlistRateLimit ?? LOOPERS_ALLOWLIST_RATE_LIMIT),
    loopersAllowlistSubnetRateLimiter: createFixedWindowRateLimiter(loopersAllowlistSubnetRateLimit ?? LOOPERS_ALLOWLIST_SUBNET_RATE_LIMIT),
    loopersAllowlistGlobalRateLimiter: createFixedWindowRateLimiter(loopersAllowlistGlobalRateLimit ?? LOOPERS_ALLOWLIST_GLOBAL_RATE_LIMIT),
    loopersTurnstileSecretKey: String(loopersTurnstileSecretKey ?? '').trim() || null,
    looperMarketplaceListingsLoader: typeof looperMarketplaceListingsLoader === 'function'
      ? looperMarketplaceListingsLoader
      : null,
    looperMarketplacePreviewLoader: typeof looperMarketplacePreviewLoader === 'function'
      ? looperMarketplacePreviewLoader
      : null,
    looperMarketplaceWalletValuesLoader: typeof looperMarketplaceWalletValuesLoader === 'function'
      ? looperMarketplaceWalletValuesLoader
      : null,
    loopersOwnedAgentLoader: ownedLoopersLoader,
    loopersAuthorizer: authorizeLooper,
    looperNameStore: looperNameStore ?? createSqliteLooperNameStore(),
    consoleRuntimeRegistry: consoleRuntimeRegistry ?? createLooperRuntimeRegistry(),
    restapNetworkActivationLeases: restapNetworkActivationLeases ?? null,
    restapNetworkCustodyReconciler: restapNetworkCustodyReconciler ?? null,
    restapNetworkPolicyGeneration,
    consoleAgentRuntime: runtime,
    consoleWalletContextLoader: walletContextLoader,
    looperCodexRuntime: resolvedLooperCodexRuntime,
    restapNetworkService,
    restapVerifiedSendService,
    restapVerifiedSendFlights: new Map(),
    logger,
    consoleCodexWalletRateLimiter: createBoundedFixedWindowRateLimiter({
      ...(consoleCodexWalletRateLimit ?? CONSOLE_CODEX_WALLET_RATE_LIMIT),
      now: consoleCodexRateLimitNow,
      maxBuckets: consoleCodexWalletMaxBuckets,
    }),
    consoleCodexGlobalRateLimiter: createBoundedFixedWindowRateLimiter({
      ...(consoleCodexGlobalRateLimit ?? CONSOLE_CODEX_GLOBAL_RATE_LIMIT),
      now: consoleCodexRateLimitNow,
      maxBuckets: 1,
    }),
    consoleMessageShortRateLimiter: createFixedWindowRateLimiter(
      consoleMessageShortRateLimit ?? CONSOLE_MESSAGE_SHORT_RATE_LIMIT,
    ),
    consoleMessageDailyRateLimiter: createFixedWindowRateLimiter(
      consoleMessageDailyRateLimit ?? CONSOLE_MESSAGE_DAILY_RATE_LIMIT,
    ),
    consoleMessageConcurrency: createConcurrencyGate(consoleMessageGlobalConcurrency),
    restapDiscoveryEnabled: Boolean(restapDiscoveryEnabled),
    restapTalkEnabled: Boolean(restapTalkEnabled),
    restap3802Policy,
    restapTalkRuntime,
    restapNewsWriteEnabled: Boolean(restapNewsWriteEnabled),
    restapNewsReadEnabled: Boolean(restapNewsReadEnabled),
    restapNewsStore,
    restapNewsAuthenticator,
    restapIpRateLimiter: createFixedWindowRateLimiter({ limit: restapTalkLimits?.perIpPerMinute ?? 20, windowMs: 60_000, now: restapRateLimitNow }),
    restapSessionRateLimiter: createFixedWindowRateLimiter({ limit: restapTalkLimits?.perSessionPerMinute ?? 10, windowMs: 60_000, now: restapRateLimitNow }),
    restapDailyRateLimiter: createFixedWindowRateLimiter({ limit: restapTalkLimits?.globalPerDay ?? 10_000, windowMs: 86_400_000, now: restapRateLimitNow }),
    restapConcurrency: createConcurrencyGate(restapTalkLimits?.concurrency ?? 4),
  };

  return {
    async handleRequest(request) {
      try {
        const url = new URL(request.url);
        const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
        const method = request.method.toUpperCase();

        const missionResponse = await handleMissionRequest(request, {
          service: context.missionService,
          authenticate: (missionRequest, options) => requireConsoleSession(missionRequest, context, options),
        });
        if (missionResponse) return missionResponse;

        const restapResponse = await handleRestap3802Request(request, url, method, context);
        if (restapResponse) return restapResponse;

        const restapNetworkConsoleResponse = await handleRestapNetworkConsoleRequest(request, method, parts, context);
        if (restapNetworkConsoleResponse) return restapNetworkConsoleResponse;

        if (method === 'POST') {
          if (parts[0] === 'api' && parts[1] === 'loopers') {
            return await handleLooperPost(request, parts, context);
          }
          if (parts[0] === 'api' && parts[1] === 'admin') {
            return await handleAdminPost(request, parts, context);
          }
          return await handlePostRequest(request, parts, context);
        }

        if (method === 'PATCH') {
          return await handlePatchRequest(request, parts, context);
        }

        if (method !== 'GET') {
          return errorResponse(405, 'method_not_allowed', 'Only GET, PATCH, and selected POST routes are supported by the Multipass API boundary.');
        }

        if (url.pathname === '/.well-known/helixa-multipass.json' || url.pathname === '/.well-known/multipass.json') {
          return jsonResponse(createDiscoveryDocument(normalizedBaseUrl));
        }

        if (url.pathname === '/api/openapi.json') {
          return jsonResponse(createOpenApiDocument(normalizedBaseUrl));
        }

        if (parts[0] === 'api' && parts[1] === 'multipass' && parts[2] === 'console'
          && parts[3] === 'pantheon' && parts[4] === 'cred' && parts.length === 5) {
          try {
            return jsonResponse(await loadPantheonCredRegistry({ fetchImpl: context.fetchImpl }), 200, {
              'cache-control': 'public, max-age=60',
            });
          } catch {
            return errorResponse(503, 'pantheon_unavailable', 'Pantheon registry is unavailable.');
          }
        }

        if (parts[0] === 'api' && parts[1] === 'multipass' && parts[2] === 'console' && parts[3] === 'skills' && parts.length === 4) {
          const requestedLimit = Number.parseInt(url.searchParams.get('limit') ?? '', 10);
          return jsonResponse(searchBankrMarketplaceSkills(url.searchParams.get('q') ?? '', {
            limit: Number.isInteger(requestedLimit) ? requestedLimit : 20,
          }), 200, { 'cache-control': 'public, max-age=300' });
        }

        if (parts[0] === 'api' && parts[1] === 'multipass' && parts[2] === 'resolve') {
          return await handleCanonicalResolve(url, context);
        }

        if (parts[0] === 'api' && parts[1] === 'loopers') {
          return await handleLooperRead(request, url, parts, context);
        }

        if (parts[0] === 'api' && parts[1] === 'resolve') {
          return await handleResolve(url, context);
        }

        if (parts[0] === 'api' && parts[1] === 'search') {
          return handleSearch(url, context);
        }

        const staticShellResponse = await handleStaticMultipassShellRead(parts);
        if (staticShellResponse) return staticShellResponse;

        const profileShellResponse = await handleDynamicProfileShellRead(parts, context);
        if (profileShellResponse) return profileShellResponse;

        const shareResponse = await handleDynamicShareRead(parts, context);
        if (shareResponse) return shareResponse;

        return handlePublicRead(parts, context);
      } catch (error) {
        if (error instanceof ApiInputError) {
          return errorResponse(error.status ?? 400, error.code, error.message);
        }
        if (error instanceof ApiUnauthorizedError) {
          return errorResponse(401, 'unauthorized', error.message);
        }
        if (error instanceof ApiForbiddenError) {
          return errorResponse(403, 'forbidden', error.message);
        }
        if (error instanceof ApiNotFoundError) {
          return errorResponse(404, 'not_found', error.message);
        }
        if (error instanceof ConsentError) {
          return errorResponse(error.status ?? 400, error.code, error.message);
        }
        if (error instanceof GroupActivationError) {
          return errorResponse(error.status ?? 400, error.code, error.message, error.details ?? {});
        }
        if (error instanceof ConsoleCreditError) {
          return errorResponse(error.status ?? 400, error.code, error.message, error.details);
        }
        if (error instanceof AllowlistInputError) {
          return errorResponse(400, error.code, error.message);
        }
        if (error instanceof TypeError) {
          return errorResponse(400, 'invalid_request', error.message);
        }
        throw error;
      }
    },
  };
}

async function handleRestapNetworkConsoleRequest(request, method, parts, context) {
  if (parts[0] !== 'api' || parts[1] !== 'multipass' || parts[2] !== 'console' || parts[3] !== 'restap-network') return null;
  if (!parts[4]) return errorResponse(404, 'not_found', 'Route not found.');
  const policyRoute = parts[5] === 'policy' && parts.length === 6;
  const intentsRoute = parts[5] === 'intents' && parts.length === 6;
  const intentRoute = parts[5] === 'intents' && parts[6] && parts.length === 7;
  const stopRoute = parts[5] === 'stop' && parts.length === 6;
  const talkRoute = parts[5] === 'talk' && parts.length === 6;
  if (!policyRoute && !intentsRoute && !intentRoute && !stopRoute && !talkRoute) return errorResponse(404, 'not_found', 'Route not found.');

  if (talkRoute) return handleRestapVerifiedSendRequest(request, method, parts[4], context);

  const service = context.restapNetworkService;
  const policyEnabled = service?.status?.enabled === true && service.status.gates?.policy === true;
  const initiationEnabled = policyEnabled && service.status.gates?.initiation === true;
  if (!policyEnabled || ((intentsRoute || intentRoute) && !initiationEnabled)) return errorResponse(404, 'not_found', 'Route not found.');
  const tokenId = normalizeRestapConsoleTokenId(parts[4]);
  const mutation = method === 'PUT' || method === 'POST' || method === 'DELETE';
  const session = requireConsoleSession(request, context, { requireCsrf: mutation });
  const identity = await authorizeConsoleLooper({ tokenId, wallet: session.wallet, context });

  try {
    if (policyRoute && method === 'GET') {
      requireServiceMethod(service, 'getPolicy');
      return jsonResponse(projectRestapNetworkPolicy(await service.getPolicy({ tokenId, identity }), tokenId));
    }
    if (policyRoute && method === 'PUT') {
      requireServiceMethod(service, 'putPolicy');
      const body = await readBoundedJsonBody(request, RESTAP_NETWORK_CONSOLE_REQUEST_MAX_BYTES);
      const input = normalizeRestapNetworkPolicyInput(body, { selfTokenId: tokenId });
      return jsonResponse(projectRestapNetworkPolicy(await service.putPolicy({ tokenId, identity, input }), tokenId));
    }
    if (intentsRoute && method === 'POST') {
      requireServiceMethod(service, 'createIntent');
      const body = await readBoundedJsonBody(request, RESTAP_NETWORK_CONSOLE_REQUEST_MAX_BYTES);
      const input = normalizeRestapNetworkIntentInput(body, { selfTokenId: tokenId });
      return jsonResponse({ schema_version: '0.1.0', token_id: tokenId, intent: projectRestapNetworkIntent(await service.createIntent({ tokenId, identity, input })) }, 201);
    }
    if (intentsRoute && method === 'GET') {
      requireServiceMethod(service, 'listIntents');
      const values = await service.listIntents({ tokenId, identity });
      if (!Array.isArray(values) || values.length > 256) throw new Error('invalid service response');
      return jsonResponse({ schema_version: '0.1.0', token_id: tokenId, intents: values.map(projectRestapNetworkIntent) });
    }
    if (intentRoute && method === 'DELETE') {
      requireServiceMethod(service, 'deleteIntent');
      const body = await readBoundedJsonBody(request, RESTAP_NETWORK_CONSOLE_REQUEST_MAX_BYTES);
      const input = normalizeRestapNetworkIntentCancel(body);
      const result = await service.deleteIntent({ tokenId, intentId: normalizeRestapConsoleIntentId(parts[6]), identity, input });
      return jsonResponse({ schema_version: '0.1.0', token_id: tokenId, intent: projectRestapNetworkIntent(result) });
    }
    if (stopRoute && method === 'POST') {
      requireServiceMethod(service, 'stop');
      const body = await readBoundedJsonBody(request, RESTAP_NETWORK_CONSOLE_REQUEST_MAX_BYTES);
      const input = normalizeRestapNetworkStopInput(body);
      return jsonResponse(projectRestapNetworkPolicy(await service.stop({ tokenId, identity, input }), tokenId));
    }
    return errorResponse(405, 'method_not_allowed', 'Method not allowed.');
  } catch (error) {
    if (error instanceof ApiInputError || error instanceof ApiUnauthorizedError || error instanceof ApiForbiddenError) throw error;
    if (error instanceof TypeError) return errorResponse(400, 'invalid_request', 'RESTAP network request is invalid.');
    if (/version|stale|conflict/iu.test(error?.message ?? '')) return errorResponse(409, 'version_conflict', 'RESTAP network state changed. Refresh and retry.');
    return errorResponse(503, 'restap_network_unavailable', 'RESTAP network controls are temporarily unavailable.');
  }
}

async function handleRestapVerifiedSendRequest(request, method, rawSenderTokenId, context) {
  const service = context.restapVerifiedSendService;
  if (!service || typeof service.send !== 'function') return errorResponse(404, 'not_found', 'Route not found.');
  if (method !== 'POST') return errorResponse(405, 'method_not_allowed', 'Method not allowed.');
  const senderTokenId = normalizeRestapConsoleTokenId(rawSenderTokenId);
  const session = requireConsoleSession(request, context, { requireCsrf: true });
  await authorizeConsoleLooper({ tokenId: senderTokenId, wallet: session.wallet, context });
  const body = await readBoundedJsonBody(request, RESTAP_NETWORK_CONSOLE_REQUEST_MAX_BYTES);
  const input = normalizeRestapVerifiedSendInput(body, senderTokenId);
  const flightKey = [session.wallet, senderTokenId, input.idempotencyKey].join('|');
  let flight = context.restapVerifiedSendFlights.get(flightKey);
  const replayedFlight = Boolean(flight);
  if (!flight) {
    flight = { createdAt: Date.now(), settled: false, result: null, error: null, promise: null };
    flight.promise = Promise.resolve()
      .then(() => service.send({ ...input, owner: session.wallet }))
      .then((result) => { flight.result = result; flight.settled = true; }, (error) => { flight.error = error; flight.settled = true; });
    context.restapVerifiedSendFlights.set(flightKey, flight);
    trimRestapVerifiedSendFlights(context.restapVerifiedSendFlights);
  }
  if (!flight.settled) {
    await Promise.race([flight.promise, new Promise((resolve) => setTimeout(resolve, 250))]);
  }
  if (!flight.settled) return jsonResponse(projectPendingRestapVerifiedSend(input, session.wallet, replayedFlight), 202);
  try {
    if (flight.error) throw flight.error;
    const projected = projectRestapVerifiedSend(flight.result);
    const status = projected.status === 'committed' ? 200 : projected.status === 'cancelled_charged' ? 409 : 202;
    return jsonResponse(projected, status);
  } catch (error) {
    if (error instanceof RestapVerifiedSendError) return errorResponse(error.status, error.code, error.message);
    if (error instanceof TypeError) return errorResponse(400, 'invalid_request', 'RESTAP verified send request is invalid.');
    return errorResponse(503, 'restap_verified_send_unavailable', 'RESTAP verified send is temporarily unavailable.');
  }
}

function projectPendingRestapVerifiedSend(input, owner, replayed) {
  const operationId = 'pending_' + createHash('sha256').update([owner, input.senderTokenId, input.idempotencyKey].join('|')).digest('hex').slice(0, 48);
  return {
    schema_version: '0.1.0', operation_id: operationId, status: 'processing',
    sender_token_id: input.senderTokenId, recipient_token_id: input.recipientTokenId, topic: input.topic,
    opening_sha256: null, reply_sha256: null, usage: { sender: null, recipient: null },
    replayed: Boolean(replayed), reason: 'processing',
  };
}

function trimRestapVerifiedSendFlights(flights) {
  while (flights.size > 128) {
    const settled = [...flights].find(([, value]) => value.settled);
    const oldest = settled ?? flights.entries().next().value;
    if (!oldest) break;
    flights.delete(oldest[0]);
  }
}

function normalizeRestapVerifiedSendInput(value, senderTokenId) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new ApiInputError('invalid_request', 'RESTAP verified send body must be an object.');
  }
  const expected = ['idempotency_key', 'recipient_token_id', 'topic'];
  const actual = Object.keys(value).sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new ApiInputError('invalid_request', 'RESTAP verified send contains unknown or missing fields.');
  }
  const recipientTokenId = normalizeRestapConsoleTokenId(value.recipient_token_id);
  if (recipientTokenId === senderTokenId) throw new ApiInputError('invalid_request', 'Sender and recipient must be different Loopers.');
  if (typeof value.topic !== 'string' || !['collection-lore', 'trait-discussion', 'market-observation', 'project-updates', 'collaboration-ideas', 'general'].includes(value.topic)) {
    throw new ApiInputError('invalid_request', 'RESTAP topic is not allowlisted.');
  }
  if (typeof value.idempotency_key !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u.test(value.idempotency_key)) {
    throw new ApiInputError('invalid_request', 'RESTAP idempotency key is invalid.');
  }
  return Object.freeze({ senderTokenId, recipientTokenId, topic: value.topic, idempotencyKey: value.idempotency_key });
}

function projectRestapVerifiedSend(value) {
  if (!value || typeof value !== 'object') throw new Error('invalid service response');
  const statuses = ['reserved', 'sender_dispatched', 'recipient_dispatched', 'committed', 'charged_unknown', 'cancelled_charged'];
  const status = boundedStatus(value.status, statuses);
  const operationId = String(value.operationId ?? '');
  if (!/^[A-Za-z0-9_-]{8,128}$/u.test(operationId)) throw new Error('invalid service response');
  const hash = (input) => {
    if (input === null || input === undefined) return null;
    if (typeof input !== 'string' || !/^[0-9a-f]{64}$/u.test(input)) throw new Error('invalid service response');
    return input;
  };
  const usage = (input) => {
    if (input === null || input === undefined) return null;
    if (!input || typeof input !== 'object') throw new Error('invalid service response');
    return {
      input_tokens: boundedServiceInteger(input.inputTokens, 0),
      output_tokens: boundedServiceInteger(input.outputTokens, 0),
      total_tokens: boundedServiceInteger(input.totalTokens, 0),
    };
  };
  const projected = {
    schema_version: '0.1.0',
    operation_id: operationId,
    status,
    sender_token_id: normalizeRestapConsoleTokenId(value.senderTokenId),
    recipient_token_id: normalizeRestapConsoleTokenId(value.recipientTokenId),
    topic: boundedStatus(value.topic, ['collection-lore', 'trait-discussion', 'market-observation', 'project-updates', 'collaboration-ideas', 'general']),
    opening_sha256: hash(value.openingDigest),
    reply_sha256: hash(value.replyDigest),
    usage: { sender: usage(value.usage?.sender), recipient: usage(value.usage?.recipient) },
    replayed: boundedServiceBoolean(value.replayed),
  };
  if (value.reason !== undefined) {
    if (typeof value.reason !== 'string' || !/^[a-z0-9_]{1,64}$/u.test(value.reason)) throw new Error('invalid service response');
    projected.reason = value.reason;
  }
  if (value.reply !== undefined) {
    if (status !== 'committed' || typeof value.reply !== 'string' || !value.reply || /[\u0000-\u001f\u007f]/u.test(value.reply) || Buffer.byteLength(value.reply, 'utf8') > 4_096) throw new Error('invalid service response');
    projected.reply = value.reply;
  }
  return projected;
}

function normalizeRestapConsoleTokenId(value) {
  try {
    const tokenId = normalizeRestapNetworkTokenId(String(value ?? ''));
    if (BigInt(tokenId) < 1n || BigInt(tokenId) > 7_777n) throw new TypeError('range');
    return tokenId;
  } catch {
    throw new ApiInputError('invalid_request', 'Provide a canonical Looper token ID.');
  }
}

function normalizeRestapConsoleIntentId(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{8,256}$/u.test(value)) throw new ApiInputError('invalid_request', 'Provide a valid intent ID.');
  return value;
}

function requireServiceMethod(service, name) {
  if (typeof service?.[name] !== 'function') throw new Error('service unavailable');
}

function projectRestapNetworkPolicy(value, tokenId) {
  const policy = value?.policy ?? value;
  if (!policy || typeof policy !== 'object') throw new Error('invalid service response');
  const projected = {
    policy_version: boundedServiceInteger(policy.policyVersion, 0),
    custody_generation: boundedServiceInteger(policy.custodyGeneration, 0),
    network_enabled: boundedServiceBoolean(policy.networkEnabled),
    inbound_enabled: boundedServiceBoolean(policy.inboundEnabled),
    autonomous_initiation_enabled: boundedServiceBoolean(policy.autonomousEnabled),
    daily_initiated_conversation_limit: boundedServiceInteger(policy.initiatedDailyLimit, 0),
    daily_generated_message_limit: boundedServiceInteger(policy.generatedDailyLimit, 0),
    per_peer_daily_limit: boundedServiceInteger(policy.peerDailyLimit, 0),
    topics: projectTokenOrTopicList(policy.topics, false),
    allow_peer_token_ids: projectTokenOrTopicList(policy.allowTokenIds, true),
    block_peer_token_ids: projectTokenOrTopicList(policy.blockTokenIds, true),
    mute_until: policy.muteUntil === null || policy.muteUntil === undefined ? null : new Date(boundedServiceInteger(policy.muteUntil, 0)).toISOString(),
  };
  return {
    schema_version: '0.1.0',
    token_id: tokenId,
    policy: projected,
    lease_status: boundedStatus(value?.leaseStatus ?? 'unavailable', ['active', 'inactive', 'unavailable']),
    eligibility_status: boundedStatus(value?.eligibilityStatus ?? 'unavailable', ['eligible', 'unavailable']),
    quota_usage: projectQuotaUsage(value?.quotaUsage),
    transcripts: { available: false, reason: 'pilot_memory_only' },
  };
}

function projectRestapNetworkIntent(value) {
  if (!value || typeof value !== 'object') throw new Error('invalid service response');
  return {
    intent_id: normalizeRestapConsoleIntentId(value.intentId),
    source: boundedStatus(value.source, ['one_shot', 'daily']),
    topic: boundedStatus(value.topic, ['collection-lore', 'trait-discussion', 'market-observation', 'project-updates', 'collaboration-ideas', 'general']),
    status: boundedStatus(value.status, ['pending', 'leased', 'completed', 'cancelled', 'expired', 'exhausted']),
    earliest_at: new Date(boundedServiceInteger(value.earliestAt, 0)).toISOString(),
    expires_at: new Date(boundedServiceInteger(value.expiresAt, 0)).toISOString(),
    attempt_count: boundedServiceInteger(value.attemptCount, 0),
    attempt_limit: boundedServiceInteger(value.attemptLimit, 1),
    next_eligible_at: new Date(boundedServiceInteger(value.nextEligibleAt, 0)).toISOString(),
  };
}

function projectQuotaUsage(value) {
  const quota = value && typeof value === 'object' ? value : {};
  return {
    initiated: boundedServiceInteger(quota.initiated ?? 0, 0),
    generated: boundedServiceInteger(quota.generated ?? 0, 0),
    cost_units: boundedServiceInteger(quota.costUnits ?? 0, 0),
  };
}
function projectTokenOrTopicList(value, tokens) { if (!Array.isArray(value) || value.length > 256) throw new Error('invalid service response'); return value.map((item) => tokens ? normalizeRestapNetworkTokenId(item) : boundedStatus(item, ['collection-lore', 'trait-discussion', 'market-observation', 'project-updates', 'collaboration-ideas', 'general'])); }
function boundedServiceBoolean(value) { if (typeof value !== 'boolean') throw new Error('invalid service response'); return value; }
function boundedServiceInteger(value, minimum) { if (!Number.isSafeInteger(value) || value < minimum) throw new Error('invalid service response'); return value; }
function boundedStatus(value, allowed) { if (typeof value !== 'string' || !allowed.includes(value)) throw new Error('invalid service response'); return value; }

async function handleRestap3802Request(request, url, method, context) {
  const discoveryPath = '/api/restap/loopers/3802/.well-known/restap.json';
  const talkPath = '/api/restap/loopers/3802/talk';
  const newsPath = '/api/restap/loopers/3802/news';
  const exactDiscovery = url.pathname === discoveryPath && url.search === '';
  const exactTalk = url.pathname === talkPath && url.search === '';
  const exactNews = url.pathname === newsPath;
  if (!exactDiscovery && !exactTalk && !exactNews) return null;

  if (exactNews) return handleRestap3802News(request, url, method, context);

  if (exactDiscovery) {
    if (!context.restapDiscoveryEnabled) return errorResponse(404, 'not_found', 'Route not found.');
    if (method !== 'GET') return errorResponse(405, 'method_not_allowed', 'Method not allowed.');
    const started = Date.now();
    try {
      const authorization = await context.restap3802Policy?.authorize?.({ surface: 'discovery' });
      if (!authorization?.discovery) throw new Error('unavailable');
      safeRestapLog(context.logger, { event: 'restap_request', status: 200, durationMs: Date.now() - started, tokenId: '3802', errorClass: null });
      return jsonResponse(authorization.discovery, 200, { 'cache-control': 'public, max-age=60' });
    } catch (error) {
      if (error instanceof RestapPolicyNotAuthorizedError) {
        safeRestapLog(context.logger, { event: 'restap_request', status: 404, durationMs: Date.now() - started, tokenId: '3802', errorClass: 'NotAuthorized' });
        return errorResponse(404, 'not_found', 'Route not found.');
      }
      safeRestapLog(context.logger, { event: 'restap_request', status: 503, durationMs: Date.now() - started, tokenId: '3802', errorClass: 'Unavailable' });
      return errorResponse(503, 'restap_unavailable', 'RESTAP is temporarily unavailable.');
    }
  }

  if (!context.restapTalkEnabled) return errorResponse(404, 'not_found', 'Route not found.');
  if (method !== 'POST') return errorResponse(405, 'method_not_allowed', 'Method not allowed.');
  const started = Date.now();
  let body;
  try {
    body = await readRestapJsonBody(request, RESTAP_LIMITS.talkBodyBytes);
    body = normalizeRestapTalkRequest(body);
  } catch (error) {
    if (error instanceof RestapPayloadTooLargeError) {
      safeRestapLog(context.logger, { event: 'restap_request', status: 413, durationMs: Date.now() - started, tokenId: '3802', errorClass: 'PayloadTooLarge' });
      return errorResponse(413, 'payload_too_large', 'RESTAP request body is too large.');
    }
    safeRestapLog(context.logger, { event: 'restap_request', status: 400, durationMs: Date.now() - started, tokenId: '3802', errorClass: 'InvalidRequest' });
    return errorResponse(400, 'invalid_request', 'Invalid RESTAP talk request.');
  }

  const ipKey = String(request.headers.get('x-multipass-client-ip') ?? 'direct');
  const ipLimit = context.restapIpRateLimiter.check(ipKey);
  if (!ipLimit.allowed) return restapThrottle(ipLimit.retryAfterSeconds);
  if (body.session_id) {
    const sessionLimit = context.restapSessionRateLimiter.check(body.session_id);
    if (!sessionLimit.allowed) return restapThrottle(sessionLimit.retryAfterSeconds);
  }
  const dailyLimit = context.restapDailyRateLimiter.check('global');
  if (!dailyLimit.allowed) return restapThrottle(dailyLimit.retryAfterSeconds);
  const release = context.restapConcurrency.tryAcquire();
  if (!release) return restapThrottle(1);

  try {
    let authorization;
    try { authorization = await context.restap3802Policy?.authorize?.({ surface: 'talk' }); }
    catch (error) {
      if (error instanceof RestapPolicyNotAuthorizedError) return errorResponse(404, 'not_found', 'Route not found.');
      return errorResponse(503, 'restap_unavailable', 'RESTAP is temporarily unavailable.');
    }
    if (!authorization?.publicProjection || typeof context.restapTalkRuntime?.talk !== 'function') {
      return errorResponse(503, 'restap_unavailable', 'RESTAP is temporarily unavailable.');
    }
    try {
      const result = await context.restapTalkRuntime.talk({ message: body.message, ...(body.session_id ? { sessionId: body.session_id } : {}), publicProjection: authorization.publicProjection });
      safeRestapLog(context.logger, { event: 'restap_request', status: 200, durationMs: Date.now() - started, tokenId: '3802', errorClass: null });
      return jsonResponse(result);
    } catch (error) {
      if (error?.message === 'invalid_session_id') return errorResponse(400, 'invalid_session_id', 'Invalid RESTAP session.');
      if (error?.code === 'provider_unavailable') return errorResponse(503, 'provider_unavailable', 'RESTAP provider is temporarily unavailable.');
      return errorResponse(503, 'restap_unavailable', 'RESTAP is temporarily unavailable.');
    }
  } finally { release(); }
}

async function handleRestap3802News(request, url, method, context) {
  if (method === 'POST') {
    if (!context.restapNewsWriteEnabled) return errorResponse(404, 'not_found', 'Route not found.');
    let body;
    try { body = normalizeRestapNewsPost(await readRestapJsonBody(request, RESTAP_LIMITS.newsBodyBytes)); }
    catch (error) {
      if (error instanceof RestapPayloadTooLargeError) return errorResponse(413, 'payload_too_large', 'RESTAP request body is too large.');
      return errorResponse(400, 'invalid_request', 'Invalid RESTAP news request.');
    }
    try { await context['restap3802' + 'Policy']?.authorize?.({ surface: 'news-write' }); }
    catch (error) {
      if (error instanceof RestapPolicyNotAuthorizedError) return errorResponse(404, 'not_found', 'Route not found.');
      return errorResponse(503, 'restap_unavailable', 'RESTAP is temporarily unavailable.');
    }
    if (typeof context.restapNewsAuthenticator?.authenticate !== 'function' || typeof context.restapNewsStore?.accept !== 'function') {
      return errorResponse(503, 'restap_unavailable', 'RESTAP is temporarily unavailable.');
    }
    let authenticated;
    try {
      authenticated = await context.restapNewsAuthenticator.authenticate({
        method,
        path: '/multipass-api/api/restap/loopers/3802/news',
        headers: request.headers,
        body,
      });
    } catch (error) {
      const status = [401, 403, 503].includes(error?.status) ? error.status : 403;
      const code = status === 401 ? 'authentication_required' : status === 503 ? 'dependency_unavailable' : 'sender_not_authorized';
      return errorResponse(status, code, status === 503 ? 'RESTAP authentication dependency is unavailable.' : 'RESTAP sender authentication failed.');
    }
    try {
      const accepted = context.restapNewsStore.accept(authenticated);
      return jsonResponse(normalizeRestapNewsWriteAcknowledgment(accepted), 202);
    } catch (error) {
      if (error?.code === 'replay' || error?.status === 409) return errorResponse(409, 'replay', 'RESTAP news replay rejected.');
      return errorResponse(503, 'store_unavailable', 'RESTAP news storage is temporarily unavailable.');
    }
  }

  if (method === 'GET') {
    if (!context.restapNewsReadEnabled) return errorResponse(404, 'not_found', 'Route not found.');
    let query;
    try { query = parseRestapNewsQuery(url.searchParams); }
    catch { return errorResponse(400, 'invalid_request', 'Invalid RESTAP news query.'); }
    const session = requireConsoleSession(request, context, { requireCsrf: false });
    try { await authorizeConsoleLooper({ tokenId: '3802', wallet: session.wallet, context }); }
    catch (error) {
      if (error instanceof ApiForbiddenError) throw error;
      return errorResponse(503, 'authorization_unavailable', 'Owner authorization is temporarily unavailable.');
    }
    if (typeof context.restapNewsStore?.list !== 'function') return errorResponse(503, 'store_unavailable', 'RESTAP news storage is temporarily unavailable.');
    try {
      const page = context.restapNewsStore.list(query);
      const output = normalizeRestapNewsRead({
        items: page.items.map((item) => item.canonicalBody),
        timestamp: Date.now(),
        ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
      });
      return jsonResponse(output);
    } catch (error) {
      if (error instanceof TypeError || error instanceof RangeError) return errorResponse(400, 'invalid_request', 'Invalid RESTAP news query.');
      return errorResponse(503, 'store_unavailable', 'RESTAP news storage is temporarily unavailable.');
    }
  }

  if (context.restapNewsReadEnabled || context.restapNewsWriteEnabled) return errorResponse(405, 'method_not_allowed', 'Method not allowed.');
  return errorResponse(404, 'not_found', 'Route not found.');
}

function parseRestapNewsQuery(searchParams) {
  for (const key of searchParams.keys()) if (key !== 'cursor' && key !== 'limit') throw new TypeError('Unknown RESTAP news query.');
  if (searchParams.getAll('cursor').length > 1 || searchParams.getAll('limit').length > 1) throw new TypeError('Duplicate RESTAP news query.');
  const cursor = searchParams.get('cursor') ?? undefined;
  const limitSource = searchParams.get('limit');
  const limit = limitSource === null ? RESTAP_LIMITS.newsPageDefault : Number(limitSource);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > RESTAP_LIMITS.newsPageMax) throw new RangeError('RESTAP news limit is invalid.');
  return { cursor, limit };
}

class RestapPayloadTooLargeError extends Error {}

async function readRestapJsonBody(request, maximumBytes) {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (contentType !== 'application/json') throw new TypeError('RESTAP requires application/json.');
  const declaredHeader = request.headers.get('content-length');
  if (declaredHeader !== null) {
    const declared = Number(declaredHeader);
    if (!Number.isSafeInteger(declared) || declared < 0) throw new TypeError('RESTAP content length is invalid.');
    if (declared > maximumBytes) throw new RestapPayloadTooLargeError();
  }
  const bytes = await readBoundedRestapBody(request.body, maximumBytes);
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  return parseStrictJsonObject(text);
}

async function readBoundedRestapBody(body, maximumBytes) {
  if (!body) return new Uint8Array();
  const reader = body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) throw new RestapPayloadTooLargeError();
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof RestapPayloadTooLargeError) await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function restapThrottle(retryAfterSeconds) {
  return errorResponse(429, 'rate_limited', 'RESTAP request limit exceeded.', undefined, { 'retry-after': String(Math.max(1, retryAfterSeconds)) });
}

function safeRestapLog(logger, event) {
  try { logger?.info?.(event); } catch {}
}

async function handleStaticMultipassShellRead(parts) {
  if (parts[0] !== 'multipass' || parts[1] !== 'agents' || parts.length !== 2) return null;
  return htmlResponse(await loadMultipassWebIndexHtml(), {
    'cache-control': 'public, max-age=300',
  });
}

async function handlePostRequest(request, parts, context) {
  if (parts[0] !== 'api' || parts[1] !== 'multipass') {
    return errorResponse(404, 'not_found', 'Route not found.');
  }

  if (parts[2] === 'console' && parts[3] === 'session' && parts[4] === 'nonce' && parts.length === 5) {
    return handleConsoleSessionNonce(request, context);
  }

  if (parts[2] === 'console' && parts[3] === 'session' && parts[4] === 'verify' && parts.length === 5) {
    return handleConsoleSessionVerify(request, context);
  }

  if (parts[2] === 'console' && parts[3] === 'session' && parts[4] === 'logout' && parts.length === 5) {
    return handleConsoleSessionLogout(request, context);
  }

  if (parts[2] === 'console' && parts[3] === 'codex' && parts[4] === 'query' && parts.length === 5) {
    return handleConsoleCodexQuery(request, context);
  }

  if (parts[2] === 'console' && parts[3] === 'credit' && parts[4] && parts.length === 5) {
    return handleConsoleCreditAction(request, parts[4], context);
  }

  if (parts[2] === 'console' && parts[3] === 'agent' && parts[4] === 'activate' && parts.length === 5) {

    return handleConsoleAgentActivate(request, context);
  }

  if (parts[2] === 'console' && parts[3] === 'agent' && parts[4] === 'name' && parts.length === 5) {
    return handleConsoleAgentName(request, context);
  }

  if (parts[2] === 'console' && parts[3] === 'agent' && parts[4] === 'message' && parts.length === 5) {
    return handleConsoleAgentMessage(request, context);
  }

  if (parts[2] === 'groups' && parts[3] === 'preview' && parts.length === 4) {
    return handleGroupPreview(request, context);
  }

  if (parts[2] === 'groups' && parts.length === 3) {
    return handleSaveGroupMultipass(request, context);
  }

  if (parts[2] === 'activate' && parts.length === 3) {
    if (!context.activationService) {
      return errorResponse(503, 'not_configured', 'Multipass activation is not configured.');
    }
    return handleActivatePreview(request, context.activationService);
  }

  if (parts.length === 2) {
    if (!context.savedRecords) {
      return errorResponse(503, 'not_configured', 'Multipass activation records are not configured.');
    }
    if (!context.activationService) {
      return errorResponse(503, 'not_configured', 'Multipass activation is not configured.');
    }
    return handleSaveMultipass(request, context);
  }

  if (parts[2] && parts[3] === 'claim' && parts[4] === 'nonce' && parts.length === 5) {
    return handleClaimNonce(request, parts[2], context);
  }

  if (parts[2] && parts[3] === 'claim' && parts[4] === 'verify' && parts.length === 5) {
    return handleClaimVerify(request, parts[2], context);
  }

  if (parts[2] && parts[3] === 'fragments' && parts.length === 4) {
    return handleCreateFragment(request, parts[2], context);
  }

  if (parts[2] && parts[3] === 'fragments' && parts[4] && parts[5] === 'revoke' && parts.length === 6) {
    return handleRevokeFragment(request, parts[2], parts[4], context);
  }

  if (parts[2] && parts[3] === 'tools' && parts[4] && parts[5] === 'refresh' && parts.length === 6) {
    return handleRefreshTool(request, parts[2], parts[4], context);
  }

  if (parts[2] && parts[3] === 'tools' && parts[4] === 'import' && parts.length === 5) {
    return handleImportTool(request, parts[2], context);
  }

  if (parts[2] && parts[3] === 'session' && parts[4] === 'logout' && parts.length === 5) {
    return handleSessionLogout(request, parts[2], context);
  }

  return errorResponse(404, 'not_found', 'Route not found.');
}

async function handleConsoleSessionNonce(request, context) {
  assertTrustedOrigin(request, context);
  const body = await readJsonBody(request);
  return jsonResponse(context.consoleAuthStore.createChallenge({
    wallet: normalizeWallet(body.wallet, 'wallet'),
    domain: domainFromRequest(request),
  }));
}

async function handleConsoleSessionVerify(request, context) {
  assertTrustedOrigin(request, context);
  const body = await readJsonBody(request);
  let session;
  try {
    session = await context.consoleAuthStore.verifyChallenge({
      wallet: normalizeWallet(body.wallet, 'wallet'),
      nonce: String(body.nonce ?? ''),
      signature: String(body.signature ?? ''),
      signatureVerifier: context.signatureVerifier,
    });
  } catch (error) {
    throw new ApiForbiddenError(error.message);
  }
  return jsonResponse({
    schema_version: '0.1.0',
    wallet: session.wallet,
    csrfToken: session.csrfToken,
    session_expires_at: session.expires_at,
  }, 200, { 'set-cookie': buildConsoleSessionCookie(session.sessionId, context) });
}

function handleConsoleSessionLogout(request, context) {
  assertTrustedOrigin(request, context);
  const sessionId = parseCookies(request.headers.get('cookie')).get(context.consoleCookieName);
  if (sessionId) {
    context.consoleCreditService?.revokeAll?.({ sessionKey: createHash('sha256').update(sessionId).digest('hex') });
    context.consoleAuthStore.revokeSession(sessionId);
  }
  return jsonResponse({ schema_version: '0.1.0', ok: true }, 200, { 'set-cookie': clearConsoleSessionCookie(context) });
}

async function handleConsoleCreditAction(request, action, context) {
  if (!context.consoleCreditService) return errorResponse(404, 'not_found', 'Route not found.');
  const session = requireConsoleSession(request, context, { requireCsrf: true });
  const walletLimit = context.consoleCreditWalletRateLimiter.check(session.wallet);
  const globalLimit = context.consoleCreditGlobalRateLimiter.check('global');
  if (!walletLimit.allowed || !globalLimit.allowed) {
    const retryAfter = Math.max(walletLimit.retryAfterSeconds ?? 1, globalLimit.retryAfterSeconds ?? 1);
    return errorResponse(429, 'credit_rate_limited', 'Credit request limit exceeded.', undefined, { 'retry-after': String(retryAfter) });
  }
  const body = await readBoundedJsonBody(request, CONSOLE_CREDIT_REQUEST_MAX_BYTES);
  const expectedFields = {
    challenge: ['tokenId'],
    verify: ['signature', 'tokenId'],
    overview: ['tokenId'],
    'accept-vouch': ['commitmentId', 'tokenId'],
    'prepare-authorization': ['commitmentId', 'tokenId'],
    'request-two-factor': ['channel', 'tokenId'],
    'verify-two-factor': ['code', 'tokenId'],
    preview: ['amount', 'commitmentId', 'maxAprPercent', 'tokenId'],
    borrow: ['commitmentId', 'confirmBorrow', 'quoteId', 'quoteSha256', 'tokenId'],
  }[action];
  if (!expectedFields) return errorResponse(404, 'not_found', 'Route not found.');
  assertExactCreditRequest(body, expectedFields);
  const tokenId = normalizeLooperTokenId(body.tokenId);
  const identity = await authorizeConsoleLooper({ tokenId, wallet: session.wallet, context });
  const input = { sessionKey: session.sessionKey, identity };
  const service = context.consoleCreditService;
  if (action === 'challenge') return jsonResponse(await service.requestLoginChallenge(input));
  if (action === 'verify') return jsonResponse(await service.verifyLogin({ ...input, signature: body.signature }));
  if (action === 'overview') return jsonResponse(await service.getOverview(input));
  if (action === 'accept-vouch') return jsonResponse(await service.acceptVouch({ ...input, commitmentId: body.commitmentId }));
  if (action === 'prepare-authorization') return jsonResponse(await service.prepareAuthorization({ ...input, commitmentId: body.commitmentId }));
  if (action === 'request-two-factor') return jsonResponse(await service.requestTwoFactor({ ...input, channel: body.channel }));
  if (action === 'verify-two-factor') return jsonResponse(await service.verifyTwoFactor({ ...input, code: body.code }));
  if (action === 'preview') return jsonResponse(await service.previewLoan({ ...input, commitmentId: body.commitmentId, amount: body.amount, maxAprPercent: body.maxAprPercent }));
  return jsonResponse(await service.createLoan({ ...input, commitmentId: body.commitmentId, quoteId: body.quoteId, quoteSha256: body.quoteSha256, confirmBorrow: body.confirmBorrow }));
}

function assertExactCreditRequest(body, expectedFields) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.getPrototypeOf(body) !== Object.prototype) {
    throw new ApiInputError('invalid_credit_request', 'Credit request must be a JSON object.');
  }
  const actual = Object.keys(body).sort();
  const expected = [...expectedFields].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new ApiInputError('invalid_credit_request', 'Credit request contains unknown or missing fields.');
  }
}

async function handleConsoleCodexQuery(request, context) {
  const startedAt = Date.now();
  const session = requireConsoleSession(request, context, { requireCsrf: true });
  assertTrustedOrigin(request, context);
  const body = await readBoundedJsonBody(request, CONSOLE_CODEX_REQUEST_MAX_BYTES);
  assertExactCodexRequest(body);
  const selectedTokenId = normalizeLooperTokenId(body.selectedTokenId);

  const walletLimit = context.consoleCodexWalletRateLimiter.check(
    createCodexQuotaKey(session.wallet, selectedTokenId),
  );
  if (!walletLimit.allowed) {
    logCodexQuery(context, {
      operation: body.operation,
      selectedTokenId,
      status: 429,
      startedAt,
      errorClass: 'RateLimitError',
    });
    return consoleThrottleResponse(
      'codex_rate_limited',
      'Looper Codex query rate limit exceeded.',
      walletLimit.retryAfterSeconds,
    );
  }

  const globalLimit = context.consoleCodexGlobalRateLimiter.check('global');
  if (!globalLimit.allowed) {
    logCodexQuery(context, {
      operation: body.operation,
      selectedTokenId,
      status: 429,
      startedAt,
      errorClass: 'RateLimitError',
    });
    return consoleThrottleResponse(
      'codex_global_rate_limited',
      'Looper Codex service is busy.',
      globalLimit.retryAfterSeconds,
    );
  }

  try {
    await authorizeConsoleLooper({ tokenId: selectedTokenId, wallet: session.wallet, context });
  } catch (error) {
    if (error instanceof ApiForbiddenError) {
      throw new ApiForbiddenError('Authenticated wallet is not authorized for this Looper.');
    }
    if (error instanceof ApiUnauthorizedError) throw error;
    logCodexQuery(context, {
      operation: body.operation,
      selectedTokenId,
      status: 503,
      startedAt,
      errorClass: error?.constructor?.name ?? 'Error',
    });
    return errorResponse(503, 'codex_unavailable', 'Looper Codex is unavailable.');
  }

  try {
    const result = context.looperCodexRuntime.query(body.operation, body.input);
    logCodexQuery(context, {
      operation: body.operation,
      selectedTokenId,
      status: 200,
      startedAt,
      errorClass: null,
    });
    return jsonResponse(result);
  } catch (error) {
    if (error instanceof LooperCodexUnavailableError) {
      logCodexQuery(context, {
        operation: body.operation,
        selectedTokenId,
        status: 503,
        startedAt,
        errorClass: error.name,
      });
      return errorResponse(503, 'codex_unavailable', 'Looper Codex is unavailable.');
    }
    if (error instanceof LooperCodexInputError) {
      logCodexQuery(context, {
        operation: body.operation,
        selectedTokenId,
        status: 400,
        startedAt,
        errorClass: error.name,
      });
      return errorResponse(400, 'invalid_codex_query', 'Looper Codex query is invalid.');
    }
    logCodexQuery(context, {
      operation: body.operation,
      selectedTokenId,
      status: 503,
      startedAt,
      errorClass: error?.constructor?.name ?? 'Error',
    });
    return errorResponse(503, 'codex_unavailable', 'Looper Codex is unavailable.');
  }
}

async function handleConsoleAgentActivate(request, context) {
  const session = requireConsoleSession(request, context, { requireCsrf: true });
  const body = await readJsonBody(request);
  const tokenId = normalizeLooperTokenId(body.tokenId);
  const identity = await authorizeConsoleLooper({ tokenId, wallet: session.wallet, context });
  const persistedName = context.looperNameStore.get(identity)?.name;
  const runtime = context.consoleRuntimeRegistry.activate({ identity, runtimeName: persistedName ?? body.runtimeName });
  // Chat activation and RESTAP participation are independent owner actions.
  // Only the dedicated Network policy routes may issue or revoke a network lease.
  const networkLease = Object.freeze({ status: 'inactive' });
  const recovered = typeof context.consoleAgentRuntime.getThread === 'function'
    ? await context.consoleAgentRuntime.getThread({
      tokenId: identity.tokenId,
      agentId: identity.erc8004AgentId,
      activationId: runtime.key,
      agentName: runtime.runtimeName,
      wallet: session.wallet,
      canonicalIdentity: identity,
      canonicalConversationId: runtime.conversationId,
    })
    : null;
  return jsonResponse({
    schema_version: '0.1.0',
    runtime,
    networkLease,
    ...(recovered ? {
      room: recovered.room,
      thread: recovered.thread,
      memory: recovered.memory,
      missions: recovered.missions,
      proposals: recovered.proposals,
      executionMode: recovered.executionMode,
      ...('capabilities' in recovered ? { capabilities: recovered.capabilities } : {}),
      ...('proposalCandidates' in recovered ? { proposalCandidates: recovered.proposalCandidates } : {}),
    } : {}),
  });
}

async function handleConsoleAgentName(request, context) {
  const session = requireConsoleSession(request, context, { requireCsrf: true });
  const body = await readJsonBody(request);
  const tokenId = normalizeLooperTokenId(body.tokenId);
  const identity = await authorizeConsoleLooper({ tokenId, wallet: session.wallet, context });
  const canonicalName = String(identity.persona?.canonicalName ?? `Looper #${tokenId}`).trim();
  const saved = body.name === null
    ? context.looperNameStore.reset({ identity, wallet: session.wallet })
    : context.looperNameStore.set({ identity, name: body.name, wallet: session.wallet });
  const name = saved?.name ?? canonicalName;
  const runtime = context.consoleRuntimeRegistry.activate({ identity, runtimeName: name });
  return jsonResponse({
    schema_version: '0.1.0',
    tokenId,
    name,
    canonicalName,
    customName: saved?.name ?? null,
    runtime,
  });
}

async function handleConsoleAgentMessage(request, context) {
  const session = requireConsoleSession(request, context, { requireCsrf: true });
  const body = await readBoundedJsonBody(request, CONSOLE_IMAGE_REQUEST_MAX_BYTES);
  const tokenId = normalizeLooperTokenId(body.tokenId);
  const rawMessage = String(body.message ?? '');
  if (Buffer.byteLength(rawMessage, 'utf8') > CONSOLE_MESSAGE_MAX_BYTES) {
    throw new ApiInputError('message_too_large', 'Message must be at most 2,000 UTF-8 bytes.');
  }
  const message = rawMessage.trim();
  if (!message && !body.attachment) throw new ApiInputError('invalid_request', 'Message or image is required.');
  const identity = await authorizeConsoleLooper({ tokenId, wallet: session.wallet, context });
  let attachment = null;
  if (body.attachment) {
    try {
      attachment = normalizeConsoleImageAttachment(body.attachment);
    } catch (error) {
      throw new ApiInputError('invalid_image_attachment', error.message);
    }
  }
  const clientMessageId = normalizeConsoleClientMessageId(body.clientMessageId);
  if (attachment && !clientMessageId) {
    throw new ApiInputError('invalid_request', 'Image turns require a stable clientMessageId.');
  }
  const quotaKey = `${session.wallet}:${identity.tokenId}`;
  const shortWindow = context.consoleMessageShortRateLimiter.check(quotaKey);
  if (!shortWindow.allowed) {
    return consoleThrottleResponse(
      'console_message_rate_limited',
      'Console message rate limit exceeded.',
      shortWindow.retryAfterSeconds,
    );
  }
  const daily = context.consoleMessageDailyRateLimiter.check(quotaKey);
  if (!daily.allowed) {
    return consoleThrottleResponse(
      'console_message_daily_quota',
      'Console daily message quota exceeded.',
      daily.retryAfterSeconds,
    );
  }
  const releaseConcurrency = context.consoleMessageConcurrency.tryAcquire();
  if (!releaseConcurrency) {
    return consoleThrottleResponse('console_message_busy', 'Console providers are busy.', 1);
  }
  try {
    const suppliedWalletContext = normalizeConsoleWalletContext(body.walletContext, { identity, wallet: session.wallet });
    const walletContext = context.consoleWalletContextLoader
      ? await context.consoleWalletContextLoader({ identity, wallet: session.wallet })
      : suppliedWalletContext;
    const activation = context.consoleRuntimeRegistry.get(identity);
    if (!activation || activation.status === 'inactive') throw new ApiForbiddenError('Activate this Looper runtime before messaging it.');
    let codexContext = null;
    try {
      codexContext = context.looperCodexRuntime.getProfileContext(Number(identity.tokenId));
    } catch (error) {
      if (!(error instanceof LooperCodexUnavailableError)) throw error;
    }
    const result = await context.consoleAgentRuntime.handleMessage({
      tokenId: identity.tokenId,
      agentId: identity.erc8004AgentId,
      activationId: activation.key,
      agentName: activation.runtimeName,
      wallet: session.wallet,
      canonicalIdentity: activation.identity,
      canonicalConversationId: activation.conversationId,
      message,
      attachment,
      clientMessageId,
      walletContext,
      codexContext,
    });
    if (result?.thread?.conversationId) {
      context.consoleRuntimeRegistry.bindConversation({
        identity,
        conversationId: result.thread.conversationId,
        threadId: result.thread.threadId,
        topicId: result.thread.topicId,
        transport: result.thread.transport,
        participants: result.thread.participants,
      });
    }
    return jsonResponse(result);
  } finally {
    releaseConcurrency();
  }
}

async function handleLooperPost(request, parts, context) {
  if (parts[2] === 'swarm-launch' && parts[3] === 'consents') {
    const service = context.swarmLaunchConsentService;
    if (!service) return errorResponse(503, 'not_configured', 'Swarm launch consent is not configured.');
    const session = requireConsoleSession(request, context, { requireCsrf: true });
    const throttle = checkSwarmLaunchRateLimit(session.wallet, context);
    if (throttle) return throttle;
    if (parts.length === 4) {
      const input = await readBoundedJsonBody(request, 16 * 1024);
      return jsonResponse({ schema_version: '0.1.0', proposal: await service.createProposal({ actorAddress: session.wallet, input }) }, 201, { 'cache-control': 'no-store' });
    }
    const proposalId = normalizeSwarmConsentProposalId(parts[4]);
    if (parts.length === 6 && parts[5] === 'readiness') {
      const body = await readBoundedJsonBody(request, 1024);
      if (Object.keys(body).length !== 0) throw new ApiInputError('invalid_request', 'Readiness packet body must be empty.');
      return jsonResponse({ schema_version: '0.1.0', readiness: await service.createReadinessPacket({ actorAddress: session.wallet, proposalId }) }, 200, { 'cache-control': 'no-store' });
    }
    if (parts.length === 6 && parts[5] === 'challenge') {
      const body = await readBoundedJsonBody(request, 1024);
      if (Object.keys(body).length !== 0) throw new ApiInputError('invalid_request', 'Consent challenge body must be empty.');
      return jsonResponse({ schema_version: '0.1.0', challenge: await service.readChallenge({ actorAddress: session.wallet, proposalId }) }, 200, { 'cache-control': 'no-store' });
    }
    if (parts.length === 6 && parts[5] === 'sign') {
      const body = await readBoundedJsonBody(request, 16 * 1024);
      if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 || typeof body.signature !== 'string') throw new ApiInputError('invalid_request', 'Consent signature request is invalid.');
      return jsonResponse({ schema_version: '0.1.0', proposal: await service.recordConsent({ actorAddress: session.wallet, proposalId, signature: body.signature }) }, 200, { 'cache-control': 'no-store' });
    }
    return errorResponse(404, 'not_found', 'Route not found.');
  }

  if (parts[2] === 'swarm-launch' && parts[3] === 'preview' && parts.length === 4) {
    const session = requireConsoleSession(request, context, { requireCsrf: true });
    const throttle = checkSwarmLaunchRateLimit(session.wallet, context);
    if (throttle) return throttle;
    const body = await readBoundedJsonBody(request, 16 * 1024);
    const result = await previewSwarmLaunch({ owner: session.wallet, input: body, loadOwnedAgents: context.loopersOwnedAgentLoader });
    return jsonResponse({ schema_version: result.schemaVersion, status: result.status, manifest: result.manifest, manifest_sha256: result.manifestSha256 }, 200, { 'cache-control': 'no-store' });
  }

  if (parts[2] === 'allowlist' && parts[3] === 'register' && parts.length === 4) {
    if (!context.loopersAllowlist) {
      return errorResponse(503, 'not_configured', 'Looper allowlist registration is not configured.');
    }
    if (context.loopersAllowlistRegistrationPaused) {
      return errorResponse(503, 'registration_paused', 'Loopers allowlist registration is temporarily paused.');
    }
    if (context.loopersAllowlistRequireBrowserOrigin && !isTrustedBrowserOrigin(request, context)) {
      return errorResponse(403, 'browser_origin_required', 'Allowlist registration must be submitted from the Loopers site.');
    }
    const body = await readJsonBody(request);
    const source = normalizeLooperAllowlistSource(body.source ?? 'launch-page');
    if (context.loopersAllowlistBlockedSources.has(source)) {
      return errorResponse(403, 'source_blocked', 'This allowlist registration source is temporarily unavailable.');
    }
    let existingStatus;
    try {
      existingStatus = await context.loopersAllowlist.status(body.address);
    } catch (error) {
      if (error instanceof AllowlistInputError) {
        return errorResponse(400, error.code, error.message);
      }
      throw error;
    }
    if (existingStatus.registered) {
      return jsonResponse({
        schema_version: '0.1.0',
        collection: 'loopers',
        registered: true,
        created: false,
        address: existingStatus.address,
        entry: existingStatus.entry,
      }, 200);
    }
    const clientIp = getClientRateLimitKey(request);
    const rateLimit = context.loopersAllowlistRateLimiter.check(clientIp);
    if (!rateLimit.allowed) {
      return jsonResponse({
        schema_version: '0.1.0',
        error: {
          code: 'rate_limited',
          message: 'Too many allowlist registration attempts. Try again shortly.',
        },
      }, 429, { 'retry-after': String(rateLimit.retryAfterSeconds) });
    }
    const subnetRateLimit = context.loopersAllowlistSubnetRateLimiter.check(getClientSubnetRateLimitKey(clientIp));
    if (!subnetRateLimit.allowed) {
      return jsonResponse({
        schema_version: '0.1.0',
        error: {
          code: 'rate_limited',
          message: 'Too many allowlist registration attempts from this network. Try again shortly.',
        },
      }, 429, { 'retry-after': String(subnetRateLimit.retryAfterSeconds) });
    }
    const globalRateLimit = context.loopersAllowlistGlobalRateLimiter.check('global');
    if (!globalRateLimit.allowed) {
      return jsonResponse({
        schema_version: '0.1.0',
        error: {
          code: 'rate_limited',
          message: 'Loopers allowlist registration is in slow mode. Try again shortly.',
        },
      }, 429, { 'retry-after': String(globalRateLimit.retryAfterSeconds) });
    }
    if (hasLooperAllowlistBotTrap(body)) {
      return errorResponse(400, 'bot_detected', 'Allowlist registration rejected.');
    }
    const turnstile = await verifyLooperAllowlistTurnstile(body, request, context);
    if (!turnstile.ok) {
      return errorResponse(403, 'verification_required', turnstile.message);
    }
    const result = await context.loopersAllowlist.register({
      address: body.address,
      source,
    });
    return jsonResponse({
      schema_version: '0.1.0',
      collection: 'loopers',
      registered: true,
      created: result.created,
      address: result.entry.address,
      entry: result.entry,
    }, result.created ? 201 : 200);
  }

  return errorResponse(404, 'not_found', 'Route not found.');
}

async function handleLooperRead(request, url, parts, context) {
  if (parts[2] === 'swarm-launch' && parts[3] === 'consents' && parts[4] && parts.length === 5) {
    const service = context.swarmLaunchConsentService;
    if (!service) return errorResponse(503, 'not_configured', 'Swarm launch consent is not configured.');
    const session = requireConsoleSession(request, context);
    const proposal = await service.readProposal({ actorAddress: session.wallet, proposalId: normalizeSwarmConsentProposalId(parts[4]) });
    return jsonResponse({ schema_version: '0.1.0', proposal }, 200, { 'cache-control': 'no-store' });
  }

  const previewMatch = url.pathname.match(/^\/api\/loopers\/marketplace\/preview\/([1-9]\d*)\.jpg$/u);
  if (previewMatch) {
    const tokenId = previewMatch[1];
    if (BigInt(tokenId) > 7_777n) return errorResponse(404, 'not_found', 'Route not found.');
    if (!context.looperMarketplacePreviewLoader) {
      return errorResponse(503, 'preview_unavailable', 'Looper marketplace preview is temporarily unavailable.', undefined, { 'cache-control': 'no-store' });
    }
    try {
      const jpeg = await context.looperMarketplacePreviewLoader(tokenId);
      return binaryResponse(jpeg, 'image/jpeg', { 'cache-control': 'public, max-age=300' });
    } catch {
      return errorResponse(503, 'preview_unavailable', 'Looper marketplace preview is temporarily unavailable.', undefined, { 'cache-control': 'no-store' });
    }
  }

  if (url.pathname === '/api/loopers/marketplace/wallet-values') {
    if (!context.looperMarketplaceWalletValuesLoader) return walletValuesUnavailableResponse();
    try {
      const result = await context.looperMarketplaceWalletValuesLoader();
      if (!result || ![200, 503].includes(result.status) || !(result.bodyBytes instanceof Uint8Array)
        || !result.headers || typeof result.headers !== 'object') return walletValuesUnavailableResponse();
      return new Response(result.bodyBytes, { status: result.status, headers: result.headers });
    } catch {
      return walletValuesUnavailableResponse();
    }
  }

  if (url.pathname === '/api/loopers/marketplace/listings') {
    if (!context.looperMarketplaceListingsLoader) {
      return errorResponse(503, 'marketplace_unavailable', 'Looper marketplace listings are temporarily unavailable.', undefined, { 'cache-control': 'no-store' });
    }
    try {
      return jsonResponse(await context.looperMarketplaceListingsLoader(), 200, { 'cache-control': 'no-store' });
    } catch {
      return errorResponse(503, 'marketplace_unavailable', 'Looper marketplace listings are temporarily unavailable.', undefined, { 'cache-control': 'no-store' });
    }
  }

  if (parts[2] === 'owned' && parts.length === 3) {
    const session = requireConsoleSession(request, context);
    const loadedAgents = await context.loopersOwnedAgentLoader({ address: session.wallet });
    const agents = loadedAgents.map((agent) => {
      const persisted = context.looperNameStore.get({
        chainId: agent.chainId ?? LOOPERS_MAINNET_CHAIN_ID,
        contract: agent.contract ?? LOOPERS_MAINNET_CONTRACT,
        tokenId: agent.tokenId,
      });
      if (!persisted) return agent;
      const canonicalName = String(agent.canonicalName ?? agent.name ?? `Looper #${agent.tokenId}`).trim();
      return { ...agent, name: persisted.name, canonicalName, customName: persisted.name };
    });
    return jsonResponse({
      schema_version: '0.1.0',
      collection: 'loopers',
      owner: session.wallet,
      agents,
    });
  }

  if (parts[2] === 'allowlist' && parts[3] === 'status' && parts.length === 4) {
    if (!context.loopersAllowlist) {
      return errorResponse(503, 'not_configured', 'Looper allowlist registration is not configured.');
    }
    const address = url.searchParams.get('address');
    const status = await context.loopersAllowlist.status(address);
    return jsonResponse({
      schema_version: '0.1.0',
      collection: 'loopers',
      ...status,
    });
  }

  if (parts[2] === 'allowlist' && parts[3] === 'proof' && parts.length === 4) {
    if (!context.loopersAllowlistSnapshot) {
      return errorResponse(503, 'not_configured', 'Looper allowlist proof snapshot is not configured.');
    }
    let address;
    try {
      address = normalizeAllowlistAddress(url.searchParams.get('address'));
    } catch {
      return errorResponse(400, 'invalid_address', 'Provide a valid Ethereum address.');
    }
    const proof = getAllowlistProof(context.loopersAllowlistSnapshot, address);
    return jsonResponse({
      schema_version: '0.1.0',
      collection: 'loopers',
      address: proof.address,
      eligible: proof.eligible,
      proof: proof.proof,
      merkle_root: proof.merkle_root,
      leaf: proof.leaf,
      leaf_encoding: proof.leaf_encoding,
      snapshot: {
        generated_at: proof.generated_at,
        count: proof.count,
        position: proof.position,
      },
    });
  }

  return errorResponse(404, 'not_found', 'Route not found.');
}

async function handleAdminPost(request, parts, context) {
  if (parts[2] !== 'multipass' || !parts[3] || parts[4] !== 'claims' || !parts[5] || parts[6] !== 'approve' || parts.length !== 7) {
    return errorResponse(404, 'not_found', 'Route not found.');
  }
  if (!context.savedRecords) {
    return errorResponse(503, 'not_configured', 'Multipass activation records are not configured.');
  }
  assertTrustedOrigin(request, context);
  if (!context.adminSecret) {
    return errorResponse(503, 'not_configured', 'Multipass admin approval is not configured.');
  }
  if (request.headers.get('x-admin-secret') !== context.adminSecret) {
    throw new ApiUnauthorizedError('Admin approval requires a valid server-side admin secret.');
  }

  const profile = resolveSavedProfile(context.savedRecords, parts[3]);
  let claim;
  try {
    claim = context.savedRecords.approveManualReviewClaim(profile.multipass_id, parts[5], {
      admin: 'api-admin',
    });
  } catch (error) {
    throw mapAdminClaimError(error);
  }
  const updatedProfile = context.savedRecords.resolveProfile(profile.multipass_id);
  return jsonResponse({
    schema_version: '0.1.0',
    claim_status: context.savedRecords.getClaimState(profile.multipass_id).status,
    claim,
    profile: updatedProfile,
  });
}

async function handlePatchRequest(request, parts, context) {
  if (parts[0] !== 'api' || parts[1] !== 'multipass' || !parts[2]) {
    return errorResponse(404, 'not_found', 'Route not found.');
  }
  if (parts[3] === 'profile' && parts.length === 4) {
    return handlePatchProfile(request, parts[2], context);
  }
  if (parts[3] === 'fragments' && parts[4] && parts.length === 5) {
    return handlePatchFragment(request, parts[2], parts[4], context);
  }
  return errorResponse(404, 'not_found', 'Route not found.');
}

async function handleActivatePreview(request, activationService) {
  const body = await readJsonBody(request);
  const agent = String(body.agent ?? '').trim();
  if (!agent) throw new ApiInputError('invalid_request', 'Provide agent to activate.');
  const record = await activationService(agent);
  return jsonResponse({
    schema_version: '0.1.0',
    state: 'activated_unsaved',
    profile: record.profile,
    source: record.source,
  });
}

async function handleSaveMultipass(request, { savedRecords, activationService }) {
  if (!savedRecords) {
    return errorResponse(503, 'not_configured', 'Multipass activation records are not configured.');
  }

  const body = await readJsonBody(request);
  const agent = String(body.agent ?? '').trim();
  if (!agent) throw new ApiInputError('invalid_request', 'Provide agent to save.');
  const record = await activationService(agent);
  const saved = savedRecords.saveActivatedRecord(record);
  return jsonResponse({
    schema_version: '0.1.0',
    state: saved.created ? 'saved_unclaimed' : 'saved_existing',
    created: saved.created,
    multipass_id: saved.profile.multipass_id,
    slug: saved.profile.slug,
    profile: saved.profile,
    sharePath: `/multipass/${encodeURIComponent(saved.profile.slug)}`,
  }, saved.created ? 201 : 200);
}

async function handleGroupPreview(request, context) {
  if (!context.activationService) {
    return errorResponse(503, 'not_configured', 'Multipass group activation is not configured.');
  }

  const body = await readJsonBody(request);
  const preview = await createGroupActivationPreview(body, { activationService: context.activationService });
  return jsonResponse({
    schema_version: '0.1.0',
    state: 'group_preview',
    record: preview.record,
    members: preview.members,
  });
}

async function handleSaveGroupMultipass(request, context) {
  if (!context.savedRecords) {
    return errorResponse(503, 'not_configured', 'Multipass activation records are not configured.');
  }
  if (!context.activationService) {
    return errorResponse(503, 'not_configured', 'Multipass group activation is not configured.');
  }

  const body = await readJsonBody(request);
  const preview = await createGroupActivationPreview(body, { activationService: context.activationService });
  const saved = saveGroupActivationRecord(context.savedRecords, preview.record);
  return jsonResponse({
    schema_version: '0.1.0',
    state: saved.created ? 'saved_group_unclaimed' : 'saved_group_existing',
    created: saved.created,
    multipass_id: saved.profile.multipass_id,
    slug: saved.profile.slug,
    profile: saved.profile,
    sharePath: `/multipass/${encodeURIComponent(saved.profile.slug)}`,
  }, saved.created ? 201 : 200);
}

function saveGroupActivationRecord(savedRecords, record) {
  try {
    return savedRecords.saveActivatedRecord(record);
  } catch (error) {
    if (!isSavedRecordSlugCollisionError(error)) {
      if (isSavedRecordUniquenessError(error)) {
        throwGroupSlugConflict(record.profile.slug, null);
      }
      throw error;
    }
  }

  const retrySlug = createGroupRetrySlug(record);
  try {
    return savedRecords.saveActivatedRecord(cloneRecordWithSlug(record, retrySlug));
  } catch (error) {
    if (isSavedRecordUniquenessError(error)) {
      throwGroupSlugConflict(record.profile.slug, retrySlug);
    }
    throw error;
  }
}

function throwGroupSlugConflict(slug, retrySlug) {
  throw new GroupActivationError(
    'group_slug_conflict',
    'A saved Multipass group already uses the generated slug. Try a more specific group display name.',
    409,
    pruneUndefined({ slug, retry_slug: retrySlug }),
  );
}

function createGroupRetrySlug(record) {
  const currentSlug = String(record?.profile?.slug ?? '').trim() || 'group';
  const fingerprint = String(record?.sourceContext?.sourceSnapshot?.fingerprint ?? '').trim();
  if (/^[a-f0-9]{8}$/.test(fingerprint) && currentSlug.endsWith(`-${fingerprint}`)) {
    const suffix = `-${fingerprint}-group`;
    const maxBaseLength = 81 - suffix.length;
    const base = currentSlug
      .slice(0, -(fingerprint.length + 1))
      .slice(0, maxBaseLength)
      .replace(/-+$/g, '') || 'group';
    return `${base}${suffix}`;
  }

  const base = currentSlug.slice(0, 75).replace(/-+$/g, '') || 'group';
  return `${base}-group`;
}

function cloneRecordWithSlug(record, slug) {
  const currentSlug = String(record?.profile?.slug ?? '').trim();
  const cloned = cloneJsonValue(record);

  cloned.profile = { ...cloned.profile, slug };
  rewriteSlugUrlFields(cloned.profile.discovery_profile, currentSlug, slug);

  rewriteSlugUrlFields(cloned.agentCard, currentSlug, slug);
  rewriteSlugUrlFields(cloned.standardsProfile, currentSlug, slug);

  for (const fragment of cloned.fragments ?? []) {
    rewriteSlugUrlFields(fragment.source, currentSlug, slug);
    rewriteSlugUrlFields(fragment.endpoint_ref, currentSlug, slug);
    rewriteSlugUrlFields(fragment.verification_ref, currentSlug, slug);
    rewriteSlugUrlFields(fragment.x401_proof_ref, currentSlug, slug);
  }

  return cloned;
}

function cloneJsonValue(value) {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function rewriteSlugUrlFields(value, currentSlug, nextSlug) {
  if (!currentSlug || !nextSlug || !value || typeof value !== 'object') return;

  if (Array.isArray(value)) {
    value.forEach((item) => rewriteSlugUrlFields(item, currentSlug, nextSlug));
    return;
  }

  for (const [key, fieldValue] of Object.entries(value)) {
    if (isSlugUrlField(key)) {
      value[key] = rewriteGeneratedMultipassSlugUrl(fieldValue, currentSlug, nextSlug);
    } else if (fieldValue && typeof fieldValue === 'object') {
      rewriteSlugUrlFields(fieldValue, currentSlug, nextSlug);
    }
  }
}

function isSlugUrlField(key) {
  return /(?:^|_)(?:url|href|uri|path)$|(?:Url|Href|Uri|Path)$/.test(key);
}

function rewriteGeneratedMultipassSlugUrl(value, currentSlug, nextSlug) {
  if (typeof value !== 'string' || !value.includes(currentSlug)) return value;

  const isAbsolute = /^[a-z][a-z0-9+.-]*:/i.test(value);
  let url;
  try {
    url = new URL(value, 'https://multipass.invalid');
  } catch {
    return value;
  }

  const parts = url.pathname.split('/');
  let changed = false;
  for (let index = 1; index < parts.length; index += 1) {
    if (parts[index - 1] !== 'multipass') continue;
    let decodedPart;
    try {
      decodedPart = decodeURIComponent(parts[index]);
    } catch {
      decodedPart = parts[index];
    }
    if (decodedPart !== currentSlug) continue;
    parts[index] = encodeURIComponent(nextSlug);
    changed = true;
  }

  if (!changed) return value;
  url.pathname = parts.join('/');
  if (isAbsolute) return url.toString();
  return `${url.pathname}${url.search}${url.hash}`;
}

function isSavedRecordSlugCollisionError(error) {
  const message = String(error?.message ?? '');
  return isSavedRecordUniquenessError(error) && /saved_records\.slug|\bslug\b/i.test(message);
}

function isSavedRecordUniquenessError(error) {
  const message = String(error?.message ?? '');
  const code = String(error?.code ?? '');
  return /UNIQUE constraint failed|constraint/i.test(message) || code.includes('SQLITE_CONSTRAINT');
}

function handleClaimNonce(request, identifier, context) {
  if (!context.savedRecords) {
    return errorResponse(503, 'not_configured', 'Multipass activation records are not configured.');
  }
  assertTrustedOrigin(request, context);
  const profile = resolveSavedProfile(context.savedRecords, identifier);
  return jsonResponse(context.savedRecords.createClaimNonce(profile.multipass_id, {
    domain: domainFromRequest(request),
  }));
}

async function handleClaimVerify(request, identifier, context) {
  if (!context.savedRecords) {
    return errorResponse(503, 'not_configured', 'Multipass activation records are not configured.');
  }
  assertTrustedOrigin(request, context);
  const profile = resolveSavedProfile(context.savedRecords, identifier);
  const body = await readJsonBody(request);
  const mode = String(body.mode ?? '').trim();

  if (mode === 'manual_review') {
    const claim = context.savedRecords.createManualReviewRequest(profile.multipass_id, {
      proposedManagerWallet: body.proposedManagerWallet,
      contactRoute: body.contactRoute,
      note: body.note,
    });
    return jsonResponse({
      schema_version: '0.1.0',
      claim_status: 'claim_pending',
      claim,
      profile: context.savedRecords.resolveProfile(profile.multipass_id),
    }, 202);
  }

  if (mode !== 'wallet_signature') {
    throw new ApiInputError('invalid_request', 'Use wallet_signature or manual_review claim verification mode.');
  }

  const wallet = normalizeWallet(body.wallet, 'wallet');
  const signature = String(body.signature ?? '').trim();
  const nonceValue = String(body.nonce ?? '').trim();
  if (!signature) throw new ApiInputError('invalid_request', 'signature is required.');
  if (!nonceValue) throw new ApiInputError('invalid_request', 'nonce is required.');

  let nonce;
  try {
    nonce = context.savedRecords.consumeClaimNonce(nonceValue, { multipassId: profile.multipass_id });
  } catch (error) {
    throw new ApiForbiddenError(error.message);
  }
  const validSignature = await context.signatureVerifier({ wallet, message: nonce.message, signature });
  if (!validSignature) {
    throw new ApiForbiddenError('Wallet signature did not verify against the claim nonce.');
  }

  const sourceOwner = getSourceOwnerWallet(context.savedRecords, profile.multipass_id);
  let claimStatus;
  if (sourceOwner && sourceOwner === wallet) {
    context.savedRecords.markOwnerWalletVerified(profile.multipass_id, { managerWallet: wallet });
    claimStatus = 'claimed_verified_owner';
  } else if (context.savedRecords.findApprovedManagerClaim(profile.multipass_id, wallet)) {
    claimStatus = 'claimed_review_approved';
  } else {
    throw new ApiForbiddenError('Wallet is not eligible to manage this Multipass record.');
  }

  const session = context.savedRecords.createManagerSession(profile.multipass_id, {
    managerWallet: wallet,
    claimStatus,
  });
  return jsonResponse({
    schema_version: '0.1.0',
    claim_status: claimStatus,
    csrfToken: session.csrfToken,
    session_expires_at: session.expires_at,
    profile: context.savedRecords.resolveProfile(profile.multipass_id),
  }, 200, { 'set-cookie': buildSessionCookie(session.sessionId, context) });
}

async function handlePatchProfile(request, identifier, context) {
  if (!context.savedRecords) {
    return errorResponse(503, 'not_configured', 'Multipass activation records are not configured.');
  }
  const { profile, session } = requireManagerSession(request, identifier, context);
  const body = await readJsonBody(request);
  const updated = context.savedRecords.updatePublicProfile(profile.multipass_id, body, {
    actorWallet: session.manager_wallet,
  });
  return jsonResponse({
    schema_version: '0.1.0',
    changedFields: updated.changedFields,
    profile: updated.profile,
    changes: context.savedRecords.getChangeLog?.(profile.multipass_id),
  });
}

async function handleCreateFragment(request, identifier, context) {
  if (!context.savedRecords) {
    return errorResponse(503, 'not_configured', 'Multipass activation records are not configured.');
  }
  const { profile, session } = requireManagerSession(request, identifier, context);
  const body = await readJsonBody(request);
  try {
    const created = context.savedRecords.createPublicFragment(profile.multipass_id, body, { actorWallet: session.manager_wallet });
    return jsonResponse({ schema_version: '0.1.0', ...created }, 201);
  } catch (error) {
    throw mapFragmentMutationError(error);
  }
}

async function handlePatchFragment(request, identifier, fragmentId, context) {
  if (!context.savedRecords) {
    return errorResponse(503, 'not_configured', 'Multipass activation records are not configured.');
  }
  const { profile, session } = requireManagerSession(request, identifier, context);
  const body = await readJsonBody(request);
  try {
    const updated = context.savedRecords.updatePublicFragment(profile.multipass_id, fragmentId, body, { actorWallet: session.manager_wallet });
    return jsonResponse({ schema_version: '0.1.0', ...updated });
  } catch (error) {
    throw mapFragmentMutationError(error);
  }
}

function handleRevokeFragment(request, identifier, fragmentId, context) {
  if (!context.savedRecords) {
    return errorResponse(503, 'not_configured', 'Multipass activation records are not configured.');
  }
  const { profile, session } = requireManagerSession(request, identifier, context);
  try {
    const revoked = context.savedRecords.revokePublicFragment(profile.multipass_id, fragmentId, { actorWallet: session.manager_wallet });
    return jsonResponse({ schema_version: '0.1.0', ...revoked });
  } catch (error) {
    throw mapFragmentMutationError(error);
  }
}

async function handleImportTool(request, identifier, context) {
  if (!context.savedRecords) {
    return errorResponse(503, 'not_configured', 'Multipass activation records are not configured.');
  }
  const { profile, session } = requireManagerSession(request, identifier, context);
  const body = await readJsonBody(request);
  try {
    const imported = context.savedRecords.importBankrTool(profile.multipass_id, body, { actorWallet: session.manager_wallet });
    return jsonResponse({ schema_version: '0.1.0', ...imported }, 201);
  } catch (error) {
    throw mapToolImportError(error);
  }
}

async function handleRefreshTool(request, identifier, fragmentId, context) {
  if (!context.savedRecords) {
    return errorResponse(503, 'not_configured', 'Multipass activation records are not configured.');
  }
  const { profile, session } = requireManagerSession(request, identifier, context);
  try {
    const refreshed = await context.savedRecords.refreshTool(profile.multipass_id, fragmentId, {
      actorWallet: session.manager_wallet,
      fetchImpl: context.fetchImpl,
    });
    return jsonResponse({ schema_version: '0.1.0', ...refreshed });
  } catch (error) {
    throw mapToolImportError(error);
  }
}

function requireConsoleSession(request, context, { requireCsrf = false } = {}) {
  assertTrustedOrigin(request, context);
  const sessionId = parseCookies(request.headers.get('cookie')).get(context.consoleCookieName);
  if (!sessionId) throw new ApiUnauthorizedError('Authenticated Console wallet session is required.');
  try {
    return {
      ...context.consoleAuthStore.validateSession({
        sessionId,
        csrfToken: request.headers.get('x-csrf-token') ?? '',
        requireCsrf,
      }),
      sessionKey: createHash('sha256').update(sessionId).digest('hex'),
    };
  } catch (error) {
    throw new ApiForbiddenError(error.message);
  }
}

async function authorizeConsoleLooper({ tokenId, wallet, context }) {
  try {
    const identity = await context.loopersAuthorizer({ tokenId, wallet });
    if (
      Number(identity?.chainId) !== LOOPERS_MAINNET_CHAIN_ID
      || String(identity?.contract ?? '').toLowerCase() !== LOOPERS_MAINNET_CONTRACT.toLowerCase()
      || String(identity?.tokenId ?? '') !== String(tokenId)
      || String(identity?.owner ?? '').toLowerCase() !== String(wallet).toLowerCase()
      || !/^\d+$/.test(String(identity?.erc8004AgentId ?? ''))
      || identity?.controllerVerified !== true
    ) {
      throw new ApiForbiddenError('Canonical Looper owner/controller authorization failed.');
    }
    return identity;
  } catch (error) {
    if (error instanceof ApiForbiddenError) throw error;
    if (error?.code === 'forbidden' || /does not own|not the ERC-8004 identity controller/i.test(error?.message ?? '')) {
      throw new ApiForbiddenError(error.message);
    }
    throw error;
  }
}

function normalizeConsoleWalletContext(value, { identity, wallet }) {
  if (value === undefined || value === null) return null;
  rejectExecutableWalletContext(value);
  const capabilities = value?.capabilities;
  const scope = value?.scope;
  const expectedAccount = deriveReleasedLooperAccount(identity.tokenId);
  const matchesIdentity = value?.schema_version === '0.1.0'
    && value?.kind === 'looper_wallet_read_context'
    && scope?.chainId === LOOPERS_MAINNET_CHAIN_ID
    && String(scope?.collection ?? '').toLowerCase() === String(identity.contract).toLowerCase()
    && String(scope?.tokenId ?? '') === String(identity.tokenId)
    && String(scope?.owner ?? '').toLowerCase() === String(wallet).toLowerCase()
    && /^0x[a-fA-F0-9]{40}$/.test(String(scope?.account ?? ''))
    && String(scope.account).toLowerCase() === expectedAccount
    && capabilities?.read === true
    && capabilities?.sign === false
    && capabilities?.submit === false
    && capabilities?.approve === false;
  if (!matchesIdentity) throw new ApiForbiddenError('Looper wallet context is not owner-scoped read-only evidence.');
  return JSON.parse(JSON.stringify(value));
}

function rejectExecutableWalletContext(value, path = '') {
  if (typeof value === 'function' || typeof value === 'bigint') {
    throw new ApiForbiddenError('Looper wallet context must contain JSON read evidence only.');
  }
  if (!value || typeof value !== 'object') return;
  if (Object.getPrototypeOf(value) !== Object.prototype && !Array.isArray(value)) {
    throw new ApiForbiddenError('Looper wallet context must contain plain JSON only.');
  }
  for (const [key, entry] of Object.entries(value)) {
    const nextPath = path ? `${path}.${key}` : key;
    if (/(?:calldata|transaction|prepared|provider|callback|credential|api.?key|store.?key)/i.test(nextPath)) {
      throw new ApiForbiddenError('Looper wallet context contains executable or private data.');
    }
    rejectExecutableWalletContext(entry, nextPath);
  }
}

function checkSwarmLaunchRateLimit(wallet, context) {
  const walletLimit = context.swarmLaunchWalletRateLimiter.check(String(wallet).toLowerCase());
  const globalLimit = context.swarmLaunchGlobalRateLimiter.check('global');
  if (walletLimit.allowed && globalLimit.allowed) return null;
  const retryAfter = Math.max(walletLimit.retryAfterSeconds ?? 1, globalLimit.retryAfterSeconds ?? 1);
  return errorResponse(429, 'swarm_launch_rate_limited', 'Swarm launch request limit exceeded.', undefined, { 'retry-after': String(retryAfter) });
}

function normalizeSwarmConsentProposalId(value) {
  const text = String(value ?? '');
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(text)) throw new ApiInputError('invalid_request', 'Consent proposal ID is invalid.');
  return text;
}

function normalizeLooperTokenId(value) {
  try {
    const tokenId = BigInt(String(value ?? '').trim());
    if (tokenId <= 0n || tokenId > 7_777n) throw new Error('out of range');
    return tokenId.toString();
  } catch {
    throw new ApiInputError('invalid_request', 'Provide a valid Looper token ID.');
  }
}

function assertExactCodexRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiInputError('invalid_codex_query', 'Looper Codex query must be an object.');
  }
  const expected = ['input', 'operation', 'selectedTokenId'];
  const keys = Object.keys(body);
  if (keys.length !== expected.length || expected.some((key) => !Object.hasOwn(body, key))) {
    throw new ApiInputError(
      'invalid_codex_query',
      'Looper Codex query requires exactly input, operation, and selectedTokenId.',
    );
  }
}

function createCodexQuotaKey(wallet, selectedTokenId) {
  const walletHash = createHash('sha256')
    .update(String(wallet ?? '').trim().toLowerCase())
    .digest('hex')
    .slice(0, 24);
  return walletHash + ':' + selectedTokenId;
}

function logCodexQuery(context, {
  operation,
  selectedTokenId,
  status,
  startedAt,
  errorClass,
}) {
  const runtimeStatus = context.looperCodexRuntime?.status ?? {};
  const event = {
    event: 'looper_codex_query',
    operation: CONSOLE_CODEX_OPERATIONS.has(operation) ? operation : 'invalid',
    selectedTokenId,
    status,
    durationMs: Math.max(0, Date.now() - startedAt),
    schemaVersion: safeCodexMetadata(runtimeStatus.schemaVersion),
    artifactHashPrefix: typeof runtimeStatus.artifactHash === 'string'
      && /^[a-f0-9]{64}$/u.test(runtimeStatus.artifactHash)
      ? runtimeStatus.artifactHash.slice(0, 12)
      : null,
    errorClass: safeCodexMetadata(errorClass),
  };
  try {
    context.logger?.info?.(event);
  } catch {
    // Logging must never affect query behavior.
  }
}

function safeCodexMetadata(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value);
  return /^[A-Za-z0-9_.-]{1,64}$/u.test(normalized) ? normalized : null;
}

function createUnavailableCodexRuntime() {
  const status = Object.freeze({ available: false, reason: 'not_configured' });
  return Object.freeze({
    available: false,
    status,
    query() {
      throw new LooperCodexUnavailableError();
    },
    getProfileContext() {
      throw new LooperCodexUnavailableError();
    },
  });
}

function normalizeConsoleClientMessageId(value) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return null;
  if (!/^[A-Za-z0-9_-]{8,128}$/u.test(normalized)) {
    throw new ApiInputError('invalid_client_message_id', 'clientMessageId is invalid.');
  }
  return normalized;
}

function requireManagerSession(request, identifier, context) {
  assertTrustedOrigin(request, context);
  const profile = resolveSavedProfile(context.savedRecords, identifier);
  const sessionId = parseCookies(request.headers.get('cookie')).get(context.cookieName);
  if (!sessionId) throw new ApiUnauthorizedError('Manager session cookie is required.');
  try {
    const session = context.savedRecords.validateManagerSession({
      sessionId,
      multipassId: profile.multipass_id,
      csrfToken: request.headers.get('x-csrf-token') ?? '',
    });
    return { profile, session };
  } catch (error) {
    throw new ApiForbiddenError(error.message);
  }
}

function mapFragmentMutationError(error) {
  const message = error.message ?? 'Fragment mutation failed.';
  if (/not found/i.test(message)) return new ApiNotFoundError(message);
  if (/read-only|not editable|imported|Marketplace Connection fragments must be edited/i.test(message)) return new ApiForbiddenError(message);
  return new ApiInputError('invalid_request', message);
}

function mapToolImportError(error) {
  const message = error.message ?? 'Tool import failed.';
  if (/not found/i.test(message)) return new ApiNotFoundError(message);
  return new ApiInputError('invalid_request', message);
}

function handleSessionLogout(request, identifier, context) {
  if (!context.savedRecords) {
    return errorResponse(503, 'not_configured', 'Multipass activation records are not configured.');
  }
  assertTrustedOrigin(request, context);
  const profile = resolveSavedProfile(context.savedRecords, identifier);
  const sessionId = parseCookies(request.headers.get('cookie')).get(context.cookieName);
  if (sessionId) {
    try {
      context.savedRecords.validateManagerSession({
        sessionId,
        multipassId: profile.multipass_id,
        csrfToken: request.headers.get('x-csrf-token') ?? '',
      });
      context.savedRecords.revokeManagerSession(sessionId);
    } catch (error) {
      throw new ApiForbiddenError(error.message);
    }
  }
  return jsonResponse({ schema_version: '0.1.0', ok: true }, 200, { 'set-cookie': clearSessionCookie(context) });
}

async function handleCanonicalResolve(url, context) {
  const sourceRaw = String(url.searchParams.get('source') ?? '').trim();
  if (!sourceRaw) throw new ApiInputError('invalid_request', 'Provide source to resolve.');
  return jsonResponse(await resolveCanonicalSource(sourceRaw, context));
}

async function handleResolve(url, context) {
  const agent = String(url.searchParams.get('agent') ?? '').trim();
  if (!agent) throw new ApiInputError('invalid_request', 'Provide agent to resolve.');

  if (isCanonicalSourceInput(agent)) {
    return jsonResponse(addLegacyResolverSource(await resolveCanonicalSource(agent, context), context.savedRecords));
  }

  const savedProfile = context.savedRecords?.resolveProfile?.(agent);
  if (savedProfile) {
    try {
      return jsonResponse(addLegacyResolverSource(buildHydratedProfileResponse({
        mode: 'saved',
        profile: savedProfile,
        sourceStore: context.savedRecords,
        sourceIdentity: inferSourceIdentityFromSaved(savedProfile, context.savedRecords),
        baseUrl: context.normalizedBaseUrl,
      }), context.savedRecords));
    } catch (error) {
      if (!(error instanceof ApiNotFoundError)) throw error;
      return jsonResponse(buildLegacySavedResolverResponse(savedProfile, context));
    }
  }

  const fixtureProfile = context.store.resolveProfile(agent);
  if (fixtureProfile) {
    return jsonResponse({
      schema_version: '0.1.0',
      state: 'saved_record',
      profile: fixtureProfile,
      source: null,
      routes: createProfileRoutes(context.normalizedBaseUrl, fixtureProfile.slug),
    });
  }

  if (!context.activationService) {
    return errorResponse(404, 'not_found', `Multipass not found: ${agent}`);
  }

  try {
    return jsonResponse(await resolveCanonicalSource(agent, context));
  } catch (error) {
    return errorResponse(404, 'not_found', `Multipass not found: ${agent}`);
  }
}

async function resolveCanonicalSource(sourceRaw, context) {
  const sourceIdentity = normalizeMultipassSourceInput(sourceRaw);

  const existing = context.savedRecords?.resolveBySource?.(sourceIdentity.sourceType, sourceIdentity.legacyCanonicalId)
    ?? context.savedRecords?.resolveBySource?.(sourceIdentity.sourceType, sourceIdentity.canonicalId)
    ?? null;
  if (existing) {
    return buildHydratedProfileResponse({
      mode: 'activated',
      profile: existing.profile,
      sourceStore: context.savedRecords,
      sourceIdentity,
      baseUrl: context.normalizedBaseUrl,
    });
  }

  if (!context.activationService) {
    throw new ApiNotFoundError(`Multipass source not found: ${sourceRaw}`);
  }

  try {
    const record = await context.activationService(getActivationInputForSource(sourceIdentity));
    return {
      ...buildHydratedProfileResponse({
        mode: 'activation_preview',
        profile: record.profile,
        sourceStore: createRecordSourceStore(record),
        sourceIdentity,
        baseUrl: context.normalizedBaseUrl,
        activation: { state: 'not_activated', manager_state: 'none', claim_url: null },
      }),
      source: record.source,
      save_url: `${context.normalizedBaseUrl}/api/multipass`,
    };
  } catch (error) {
    throw new ApiNotFoundError(`Multipass source not found: ${sourceRaw}`);
  }
}

function handleSearch(url, context) {
  const query = String(url.searchParams.get('q') ?? '').trim();
  if (query.length < 2) {
    throw new ApiInputError('invalid_request', 'Search query must be at least 2 characters.');
  }

  const matches = [];
  const seen = new Set();
  for (const [kind, sourceStore] of [
    ['saved', context.savedRecords],
    ['fixture', context.store],
  ]) {
    if (!sourceStore?.searchProfiles) continue;
    for (const profile of sourceStore.searchProfiles(query, { limit: 10 })) {
      if (seen.has(profile.multipass_id)) continue;
      seen.add(profile.multipass_id);
      matches.push(createProfileSearchResult(profile, kind, context.normalizedBaseUrl));
      if (matches.length >= 10) break;
    }
    if (matches.length >= 10) break;
  }

  return jsonResponse({
    schema_version: '0.1.0',
    query,
    matches,
  });
}

async function handleDynamicProfileShellRead(parts, context) {
  if (parts[0] !== 'multipass' || !parts[1] || parts.length !== 2) return null;
  const identifier = String(parts[1] ?? '').trim();
  if (!/^[a-z0-9][a-z0-9-]{1,80}$/i.test(identifier)) return null;
  const resolved = resolvePublicProfile(identifier, { store: context.store, savedRecords: context.savedRecords });
  if (!resolved) return null;

  return htmlResponse(await renderDynamicProfileShellHtml(resolved.profile, context.normalizedBaseUrl), {
    'cache-control': 'public, max-age=300',
  });
}

async function renderDynamicProfileShellHtml(profile, baseUrl) {
  const shell = await loadMultipassWebIndexHtml();
  const meta = createDynamicProfileMeta(profile, baseUrl);
  return applyDynamicProfileMeta(shell, meta);
}

async function loadMultipassWebIndexHtml() {
  const candidates = [
    process.env.MULTIPASS_WEB_INDEX_PATH,
    join(process.cwd(), 'apps/web/dist/index.html'),
    '/var/www/helixa.xyz/multipass/index.html',
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      return await readFile(candidate, 'utf8');
    } catch {
      // Try the next candidate. Falling back keeps tests and local API runs functional.
    }
  }
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Multipass - Portable Agent Identity</title>
  </head>
  <body><main id="app"></main><div id="wallet-root"></div></body>
</html>`;
}

function createDynamicProfileMeta(profile, baseUrl) {
  const displayName = profile.display_name ?? profile.slug ?? 'Multipass';
  const title = truncate(`${displayName} Multipass`, 80);
  const description = truncate(profile.discovery_profile?.summary || `Public Multipass profile for ${displayName}. Identity, proof, custody, Cred, and discovery context for agents and AI-native systems.`, 220);
  const profileUrl = new URL(`/multipass/${encodeURIComponent(profile.slug)}`, baseUrl).toString();
  const imageUrl = new URL(`/multipass/share/${encodeURIComponent(profile.slug)}.jpg`, baseUrl).toString();
  const visualSource = safePublicUrl(profile.discovery_profile?.avatar_url);
  return { title, description, profileUrl, imageUrl, visualSource };
}

function applyDynamicProfileMeta(html, meta) {
  let next = html;
  next = upsertHeadTag(next, /<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(meta.title)}</title>`);
  next = upsertHeadTag(next, /<meta\s+name="description"[^>]*>/i, `<meta name="description" content="${escapeHtml(meta.description)}" />`);
  next = upsertHeadTag(next, /<link\s+rel="canonical"[^>]*>/i, `<link rel="canonical" href="${escapeHtml(meta.profileUrl)}" />`);
  next = upsertHeadTag(next, /<meta\s+property="og:type"[^>]*>/i, '<meta property="og:type" content="website" />');
  next = upsertHeadTag(next, /<meta\s+property="og:url"[^>]*>/i, `<meta property="og:url" content="${escapeHtml(meta.profileUrl)}" />`);
  next = upsertHeadTag(next, /<meta\s+property="og:title"[^>]*>/i, `<meta property="og:title" content="${escapeHtml(meta.title)}" />`);
  next = upsertHeadTag(next, /<meta\s+property="og:description"[^>]*>/i, `<meta property="og:description" content="${escapeHtml(meta.description)}" />`);
  next = upsertHeadTag(next, /<meta\s+property="og:image"[^>]*>/i, `<meta property="og:image" content="${escapeHtml(meta.imageUrl)}" />`);
  next = upsertHeadTag(next, /<meta\s+property="og:image:secure_url"[^>]*>/i, `<meta property="og:image:secure_url" content="${escapeHtml(meta.imageUrl)}" />`);
  next = upsertHeadTag(next, /<meta\s+property="og:image:type"[^>]*>/i, '<meta property="og:image:type" content="image/jpeg" />');
  next = upsertHeadTag(next, /<meta\s+property="og:image:width"[^>]*>/i, '<meta property="og:image:width" content="1200" />');
  next = upsertHeadTag(next, /<meta\s+property="og:image:height"[^>]*>/i, '<meta property="og:image:height" content="630" />');
  next = upsertHeadTag(next, /<meta\s+name="twitter:card"[^>]*>/i, '<meta name="twitter:card" content="summary_large_image" />');
  next = upsertHeadTag(next, /<meta\s+name="twitter:title"[^>]*>/i, `<meta name="twitter:title" content="${escapeHtml(meta.title)}" />`);
  next = upsertHeadTag(next, /<meta\s+name="twitter:description"[^>]*>/i, `<meta name="twitter:description" content="${escapeHtml(meta.description)}" />`);
  next = upsertHeadTag(next, /<meta\s+name="twitter:image"[^>]*>/i, `<meta name="twitter:image" content="${escapeHtml(meta.imageUrl)}" />`);
  next = upsertHeadTag(next, /<meta\s+name="twitter:image:alt"[^>]*>/i, `<meta name="twitter:image:alt" content="${escapeHtml(meta.title)} preview" />`);
  if (meta.visualSource) {
    next = upsertHeadTag(next, /<meta\s+name="multipass:visual-source"[^>]*>/i, `<meta name="multipass:visual-source" content="${escapeHtml(meta.visualSource)}" />`);
  }
  return next;
}

function upsertHeadTag(html, pattern, tag) {
  if (pattern.test(html)) return html.replace(pattern, tag);
  return html.replace(/<\/head>/i, `    ${tag}\n  </head>`);
}

async function handleDynamicShareRead(parts, context) {
  const parsed = parseDynamicShareParts(parts);
  if (!parsed) return null;
  const resolved = resolvePublicProfile(parsed.identifier, { store: context.store, savedRecords: context.savedRecords });
  if (!resolved) return errorResponse(404, 'not_found', `Multipass not found: ${parsed.identifier}`);

  if (parsed.kind === 'jpg') {
    const jpeg = await renderShareCardJpeg(resolved.profile, resolved.sourceStore, context.normalizedBaseUrl);
    return binaryResponse(jpeg, 'image/jpeg', {
      'cache-control': 'public, max-age=300',
    });
  }

  return htmlResponse(renderDynamicShareHtml(resolved.profile, resolved.sourceStore, context.normalizedBaseUrl), {
    'cache-control': 'public, max-age=300',
  });
}

function parseDynamicShareParts(parts) {
  if (parts[0] === 'multipass' && parts[1] === 'share' && parts[2] && parts.length === 3) {
    return parseShareIdentifier(parts[2]);
  }
  if (parts[0] === 'api' && parts[1] === 'multipass' && parts[2] && parts[3] === 'share' && parts.length === 4) {
    return { identifier: parts[2], kind: 'html' };
  }
  if (parts[0] === 'api' && parts[1] === 'multipass' && parts[2] && parts[3] === 'share.jpg' && parts.length === 4) {
    return { identifier: parts[2], kind: 'jpg' };
  }
  return null;
}

function parseShareIdentifier(rawPart) {
  const raw = String(rawPart ?? '').trim();
  const jpg = raw.match(/^([a-z0-9][a-z0-9-]{1,80})\.jpg$/i);
  if (jpg) return { identifier: jpg[1], kind: 'jpg' };
  if (/^[a-z0-9][a-z0-9-]{1,80}$/i.test(raw)) return { identifier: raw, kind: 'html' };
  return null;
}

function renderDynamicShareHtml(profile, sourceStore, baseUrl) {
  const displayName = profile.display_name ?? profile.slug ?? 'Multipass';
  const title = truncate(`${displayName} Multipass`, 80);
  const description = truncate(profile.discovery_profile?.summary || `Public Multipass profile for ${displayName}. Identity, proof, custody, Cred, and discovery context for agents and AI-native systems.`, 220);
  const shareUrl = new URL(`/multipass/share/${encodeURIComponent(profile.slug)}`, baseUrl).toString();
  const imageUrl = new URL(`/multipass/share/${encodeURIComponent(profile.slug)}.jpg`, baseUrl).toString();
  const profileUrl = new URL(`/multipass/${encodeURIComponent(profile.slug)}`, baseUrl).toString();
  const visualSource = safePublicUrl(profile.discovery_profile?.avatar_url);
  const tags = uniqueStrings(profile.discovery_profile?.tags ?? []).slice(0, 8).join(', ');
  const agentCard = sourceStore.getAgentCard?.(profile.multipass_id);
  const cardSummary = agentCard?.summary ? truncate(agentCard.summary, 180) : description;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${escapeHtml(shareUrl)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeHtml(shareUrl)}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(imageUrl)}" />
  <meta property="og:image:secure_url" content="${escapeHtml(imageUrl)}" />
  <meta property="og:image:type" content="image/jpeg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
  <meta name="twitter:image:alt" content="${escapeHtml(title)} preview" />
  <meta name="multipass:id" content="${escapeHtml(profile.multipass_id)}" />
  ${visualSource ? `<meta name="multipass:visual-source" content="${escapeHtml(visualSource)}" />` : ''}
</head>
<body>
  <main>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(cardSummary)}</p>
    ${tags ? `<p>${escapeHtml(tags)}</p>` : ''}
    <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)} preview" width="1200" height="630" />
    <p><a class="open-profile" href="${escapeHtml(profileUrl)}">Open Multipass profile</a></p>
  </main>
  <script>if (!/bot|crawl|spider|telegram|twitter|discord|slack|facebook|whatsapp/i.test(navigator.userAgent)) window.location.replace('${escapeJsString(profileUrl)}');</script>
</body>
</html>`;
}

async function renderShareCardJpeg(profile, sourceStore, baseUrl) {
  const profileImageUrl = await resolveShareCardImageUrl(profile.discovery_profile?.avatar_url);
  const svg = renderShareCardSvg(profile, sourceStore, baseUrl, { profileImageUrl });
  return svgToJpeg(svg);
}

async function resolveShareCardImageUrl(value) {
  const safe = safeShareCardImageUrl(value);
  if (!safe) return null;
  if (safe.startsWith('data:image/')) return safe;
  return await fetchShareCardImageDataUri(safe);
}

async function fetchShareCardImageDataUri(url) {
  if (isBlockedShareCardImageUrl(url)) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    if (!response.ok || isBlockedShareCardImageUrl(response.url || url)) return null;
    const contentType = normalizeShareCardImageContentType(response.headers.get('content-type'), url);
    if (!contentType) return null;
    const contentLength = Number(response.headers.get('content-length') ?? 0);
    if (contentLength > 2_000_000) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > 2_000_000) return null;
    return `data:${contentType};base64,${bytes.toString('base64')}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeShareCardImageContentType(value, url) {
  const contentType = String(value ?? '').split(';')[0].trim().toLowerCase();
  if (['image/png', 'image/jpeg', 'image/webp'].includes(contentType)) return contentType;
  const pathname = (() => {
    try { return new URL(url).pathname.toLowerCase(); } catch { return ''; }
  })();
  if (pathname.endsWith('.png')) return 'image/png';
  if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'image/jpeg';
  if (pathname.endsWith('.webp')) return 'image/webp';
  return null;
}

function isBlockedShareCardImageUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return true;
    const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (!host || host === 'localhost' || host.endsWith('.localhost')) return true;
    return isPrivateIpLiteral(host);
  } catch {
    return true;
  }
}

function isPrivateIpLiteral(host) {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const parts = host.split('.').map((part) => Number(part));
    if (parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
    const [a, b] = parts;
    return a === 10
      || a === 127
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 100 && b >= 64 && b <= 127)
      || a === 0;
  }
  const normalized = host.toLowerCase();
  return normalized === '::1'
    || normalized.startsWith('fc')
    || normalized.startsWith('fd')
    || normalized.startsWith('fe80:')
    || normalized.startsWith('::ffff:127.')
    || normalized.startsWith('::ffff:10.')
    || normalized.startsWith('::ffff:192.168.');
}

function renderShareCardSvg(profile, sourceStore, baseUrl, { profileImageUrl = null } = {}) {
  const displayName = profile.display_name ?? profile.slug ?? 'Multipass';
  const title = truncate(displayName, 42);
  const summary = truncate(profile.discovery_profile?.summary || 'Public Multipass profile for agents and AI-native systems.', 112);
  const tags = uniqueStrings(profile.discovery_profile?.tags ?? []).slice(0, 3);
  const status = titleCase(profile.owner_summary?.owner_state ?? 'public profile');
  const subject = titleCase(profile.subject_type ?? 'agent');
  const initials = initialsForShareCard(displayName);
  const leftHeadline = subject === 'Agent' ? 'Portable agent identity' : `Portable ${subject.toLowerCase()} identity`;
  const tagLine = tags.length ? tags.join('  ·  ') : 'identity · proof · discovery';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${escapeSvg(title)} Multipass preview">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff8eb" />
      <stop offset="0.47" stop-color="#f3e4ce" />
      <stop offset="1" stop-color="#dfd1ff" />
    </linearGradient>
    <radialGradient id="glowA" cx="0.12" cy="0.16" r="0.76">
      <stop offset="0" stop-color="#fff1a8" stop-opacity="0.9" />
      <stop offset="1" stop-color="#fff1a8" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="glowB" cx="0.88" cy="0.12" r="0.82">
      <stop offset="0" stop-color="#9b7cff" stop-opacity="0.54" />
      <stop offset="1" stop-color="#9b7cff" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fffaf1" stop-opacity="0.94" />
      <stop offset="1" stop-color="#f7ecdb" stop-opacity="0.9" />
    </linearGradient>
    <linearGradient id="initialGradient" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#191b1c" />
      <stop offset="0.48" stop-color="#6a4cff" />
      <stop offset="1" stop-color="#e8874f" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="24" stdDeviation="24" flood-color="#2c2419" flood-opacity="0.18" />
    </filter>
    <clipPath id="visualClip">
      <rect x="770" y="120" width="320" height="320" rx="72" />
    </clipPath>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)" />
  <rect width="1200" height="630" fill="url(#glowA)" />
  <rect width="1200" height="630" fill="url(#glowB)" />
  <g opacity="0.85">
      ${shareCardDecorativeTexture()}
  </g>
  <rect x="58" y="54" width="1084" height="522" rx="48" fill="url(#panel)" stroke="#262018" stroke-opacity="0.12" filter="url(#shadow)" />
  <path d="M100 494 C247 436 363 565 520 505 C658 452 690 370 772 378 C874 389 910 514 1085 448" fill="none" stroke="#191b1c" stroke-opacity="0.08" stroke-width="8" stroke-linecap="round" />
  <g font-family="Inter, Arial, sans-serif" fill="#191b1c">
    <text x="102" y="132" font-size="29" font-weight="900" letter-spacing="5" fill="#6d5c45">MULTIPASS</text>
    <text x="102" y="224" font-size="74" font-weight="950">${escapeSvg(title)}</text>
    <text x="105" y="280" font-size="30" font-weight="750" fill="#5d5548">${escapeSvg(leftHeadline)}</text>
    ${wrapSvgText(summary, 104, 334, 29, 37, '#3b342b')}
    <g transform="translate(104 430)">
      <rect width="214" height="78" rx="24" fill="#191b1c" opacity="0.96" />
      <text x="26" y="33" font-size="19" font-weight="850" letter-spacing="3" fill="#f2d095">SOURCE</text>
      <text x="26" y="61" font-size="25" font-weight="950" fill="#fffaf1">${escapeSvg(subject)}</text>
    </g>
    <g transform="translate(342 430)">
      <rect width="286" height="78" rx="24" fill="#fff5e4" stroke="#191b1c" stroke-opacity="0.13" />
      <text x="26" y="33" font-size="19" font-weight="850" letter-spacing="3" fill="#806d50">STATUS</text>
      <text x="26" y="61" font-size="25" font-weight="950" fill="#191b1c">${escapeSvg(truncate(status, 18))}</text>
    </g>
    <text x="104" y="545" font-size="19" font-weight="800" letter-spacing="2" fill="#8a7860">PUBLIC PROFILE · ${escapeSvg(tagLine)}</text>
  </g>
  <g>
    <rect x="742" y="92" width="376" height="376" rx="88" fill="#fffaf1" stroke="#191b1c" stroke-opacity="0.12" stroke-width="2" />
    <rect x="754" y="104" width="352" height="352" rx="80" fill="#191b1c" opacity="0.06" />
    ${profileImageUrl ? renderShareCardProfileImage(profileImageUrl) : renderShareCardFallbackInitials(initials)}
    <rect x="770" y="120" width="320" height="320" rx="72" fill="none" stroke="#fffaf1" stroke-opacity="0.72" stroke-width="10" />
    <text x="930" y="510" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="900" fill="#5d5548" letter-spacing="3">AGENT CARD</text>
  </g>
</svg>`;
}

function shareCardDecorativeTexture() {
  const palette = ['#f0b86a', '#a77cff', '#5fc9b8', '#f06f6f', '#f8d38a'];
  const nodes = [];
  for (let i = 0; i < 180; i += 1) {
    const x = (i * 73 + 41) % 1200;
    const y = (i * 191 + 23) % 630;
    const radius = 1.4 + (i % 5) * 0.7;
    const opacity = 0.05 + (i % 7) * 0.01;
    const fill = palette[i % palette.length];
    nodes.push(`<circle cx="${x}" cy="${y}" r="${radius.toFixed(1)}" fill="${fill}" opacity="${opacity.toFixed(2)}" />`);
  }
  return nodes.join('\n      ');
}

function renderShareCardProfileImage(profileImageUrl) {
  const escaped = escapeHtml(profileImageUrl);
  return `<image x="770" y="120" width="320" height="320" href="${escaped}" xlink:href="${escaped}" preserveAspectRatio="xMidYMid slice" clip-path="url(#visualClip)"/>`;
}

function renderShareCardFallbackInitials(initials) {
  return `<rect x="770" y="120" width="320" height="320" rx="72" fill="url(#initialGradient)" clip-path="url(#visualClip)" />
  <text x="930" y="291" text-anchor="middle" dominant-baseline="middle" font-family="Inter, Arial, sans-serif" font-size="116" font-weight="900" fill="#fffaf1">${escapeSvg(initials)}</text>`;
}

async function svgToJpeg(svg) {
  const dir = await mkdtemp(join(tmpdir(), 'multipass-share-'));
  const svgPath = join(dir, 'card.svg');
  const jpgPath = join(dir, 'card.jpg');
  try {
    await writeFile(svgPath, svg);
    await runFfmpeg(['-y', '-hide_banner', '-loglevel', 'error', '-f', 'svg_pipe', '-i', svgPath, '-frames:v', '1', '-q:v', '2', jpgPath]);
    return await readFile(jpgPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    const stderr = [];
    child.stderr.on('data', (chunk) => stderr.push(Buffer.from(chunk)));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg failed with code ${code}: ${Buffer.concat(stderr).toString('utf8').trim()}`));
        return;
      }
      resolve();
    });
  });
}

function initialsForShareCard(value) {
  const words = String(value ?? '').match(/[A-Za-z0-9]+/g)?.slice(0, 2) ?? [];
  return words.map((word) => word[0]?.toUpperCase()).join('') || 'MP';
}

function wrapSvgText(value, x, y, fontSize, maxChars, fill) {
  const words = String(value ?? '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
    if (lines.length >= 2) break;
  }
  if (line && lines.length < 3) lines.push(line);
  return lines.slice(0, 3).map((entry, index) => `<text x="${x}" y="${y + index * (fontSize + 10)}" font-family="Inter, Arial, sans-serif" font-size="${fontSize}" font-weight="650" fill="${fill}">${escapeSvg(entry)}</text>`).join('\n  ');
}

function htmlResponse(body, extraHeaders = {}) {
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', ...extraHeaders },
  });
}

function binaryResponse(body, contentType, extraHeaders = {}) {
  return new Response(body, {
    status: 200,
    headers: { 'content-type': contentType, ...extraHeaders },
  });
}

function truncate(value, maxLength) {
  const raw = String(value ?? '').trim();
  if (raw.length <= maxLength) return raw;
  return `${raw.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value ?? '').trim()).filter(Boolean))];
}

function safePublicUrl(value) {
  try {
    const url = new URL(String(value ?? '').trim());
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function safeShareCardImageUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  if (/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(raw) && raw.length <= 2_000_000) return raw;
  return safePublicUrl(raw);
}

function titleCase(value) {
  return String(value ?? '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeSvg(value) {
  return escapeHtml(value);
}

function escapeJsString(value) {
  return String(value ?? '').replaceAll('\\', '\\\\').replaceAll("'", "\\'").replaceAll('</script', '<\\/script');
}

function handlePublicRead(parts, { store, savedRecords, normalizedBaseUrl }) {
  const readParts = normalizePublicReadParts(parts);
  if (!readParts) {
    return errorResponse(404, 'not_found', 'Route not found.');
  }

  const resolved = resolvePublicProfile(readParts.identifier, { store, savedRecords });
  if (!resolved) {
    return errorResponse(404, 'not_found', `Multipass not found: ${readParts.identifier}`);
  }

  const { profile, sourceStore } = resolved;

  if (!readParts.resource) {
    return jsonResponse(decorateProfileWithMarketplacePresence(profile, sourceStore));
  }

  if (readParts.resource === 'hydrated' && !readParts.resourceId) {
    return jsonResponse(buildHydratedProfileResponse({
      mode: 'saved',
      profile,
      sourceStore,
      sourceIdentity: inferSourceIdentityFromSaved(profile, sourceStore),
      baseUrl: normalizedBaseUrl,
    }));
  }

  if (readParts.resource === 'fragments' && !readParts.resourceId) {
    return jsonResponse({
      schema_version: profile.schema_version,
      multipass_id: profile.multipass_id,
      fragments: sourceStore.getPublicFragments(profile.multipass_id),
    });
  }

  if (readParts.resource === 'tools' && !readParts.resourceId) {
    return jsonResponse(getToolsResponse(sourceStore, profile.multipass_id));
  }

  if ((readParts.resource === 'agent-card' || readParts.resource === 'card') && !readParts.resourceId) {
    const agentCard = sourceStore.getAgentCard(profile.multipass_id, { baseUrl: normalizedBaseUrl });
    return jsonOrNotFound(decorateAgentCardForDiscovery(agentCard, profile, normalizedBaseUrl), 'Agent card not found.');
  }

  if ((readParts.resource === 'standards' || readParts.resource === 'standards-profile') && !readParts.resourceId) {
    return jsonOrNotFound(sourceStore.getStandardsProfile(profile.multipass_id), 'Standards profile not found.');
  }

  if (readParts.resource === 'x402' && !readParts.resourceId) {
    return jsonOrNotFound(sourceStore.getX402Manifest(profile.multipass_id), 'x402 manifest not found.');
  }

  if (readParts.resource === 'x401' && !readParts.resourceId) {
    return jsonOrNotFound(sourceStore.getX401Manifest(profile.multipass_id), 'x401 manifest not found.');
  }

  if (readParts.resource === 'receipts' && !readParts.resourceId) {
    return jsonResponse({
      schema_version: profile.schema_version,
      multipass_id: profile.multipass_id,
      receipts: sourceStore.getReceiptFragments?.(profile.multipass_id) ?? [],
    });
  }

  if (readParts.resource === 'receipts' && readParts.resourceId) {
    return jsonOrNotFound(
      sourceStore.getReceiptFragment(profile.multipass_id, readParts.resourceId),
      `Receipt not found: ${readParts.resourceId}`,
    );
  }

  if (readParts.resource === 'changes' && !readParts.resourceId && typeof sourceStore.getChangeLog === 'function') {
    return jsonResponse(sourceStore.getChangeLog(profile.multipass_id));
  }

  return errorResponse(404, 'not_found', 'Route not found.');
}

function normalizePublicReadParts(parts) {
  if (parts[0] === 'api' && parts[1] === 'multipass' && parts[2] && parts.length <= 5) {
    return { identifier: parts[2], resource: parts[3] ?? null, resourceId: parts[4] ?? null };
  }
  if (parts[0] === 'api' && parts[1] === 'v0' && parts[2] === 'multipass' && parts[3] && parts.length <= 6) {
    return { identifier: parts[3], resource: parts[4] ?? null, resourceId: parts[5] ?? null };
  }
  return null;
}

function createRecordSourceStore(record) {
  return createMemoryStore({
    profiles: [record.profile],
    fragments: record.fragments ?? [],
    agentCards: [record.agentCard],
    standardsProfiles: [record.standardsProfile],
    x402Manifests: [record.x402Manifest],
    x401Manifests: record.x401Manifest ? [record.x401Manifest] : [],
    receiptFragments: record.receipts ?? [],
  });
}

function getActivationInputForSource(sourceIdentity) {
  return sourceIdentity.sourceType === ERC8004_SOURCE_TYPE ? sourceIdentity.canonicalId : sourceIdentity.tokenId;
}

function inferSourceIdentityFromSaved(profile, sourceStore) {
  const activation = sourceStore.getSourceContext?.(profile.multipass_id)?.activation;
  const sourceType = String(activation?.sourceType ?? '').trim();
  const canonicalId = String(activation?.canonicalId ?? '').trim();

  if (!SUPPORTED_HYDRATED_SOURCE_TYPES.has(sourceType) || !canonicalId) {
    throw new ApiNotFoundError(`Supported source identity not found for saved Multipass: ${profile.slug ?? profile.multipass_id}`);
  }

  try {
    const sourceIdentity = normalizeMultipassSourceInput(canonicalId);
    if (!SUPPORTED_HYDRATED_SOURCE_TYPES.has(sourceIdentity.sourceType)) {
      throw new TypeError('Multipass activation source is not supported for hydration.');
    }
    return sourceIdentity;
  } catch {
    throw new ApiNotFoundError(`Supported source identity not found for saved Multipass: ${profile.slug ?? profile.multipass_id}`);
  }
}

function buildLegacySavedResolverResponse(profile, context) {
  return {
    schema_version: '0.1.0',
    state: 'saved_record',
    profile,
    source: getLegacySourceFromSavedContext(profile, context.savedRecords),
    routes: createProfileRoutes(context.normalizedBaseUrl, profile.slug),
  };
}

function addLegacyResolverSource(response, sourceStore) {
  if (response?.state !== 'saved_record' || response.source !== undefined || !response.profile) {
    return response;
  }

  const source = getLegacySourceFromSavedContext(response.profile, sourceStore);
  return source ? { ...response, source } : response;
}

function getLegacySourceFromSavedContext(profile, sourceStore) {
  const activation = sourceStore?.getSourceContext?.(profile.multipass_id)?.activation;
  const sourceType = String(activation?.sourceType ?? '').trim();
  const canonicalId = String(activation?.canonicalId ?? '').trim();
  if (!sourceType || !canonicalId) return null;

  return pruneUndefined({
    state: copyStringOrNull(activation.state),
    origin: copyStringOrNull(activation.origin),
    originSource: copyStringOrNull(activation.originSource),
    sourceType,
    canonicalId,
    tokenId: activation.tokenId === undefined ? undefined : copyStringOrNull(activation.tokenId),
    savedAt: copyStringOrNull(activation.savedAt),
  });
}

function copyStringOrNull(value) {
  if (value === null || value === undefined) {
    return null;
  }
  return String(value);
}

function pruneUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

function isCanonicalSourceInput(input) {
  try {
    normalizeMultipassSourceInput(input);
    return true;
  } catch {
    return false;
  }
}

function resolvePublicProfile(identifier, { store, savedRecords }) {
  const savedProfile = savedRecords?.resolveProfile?.(identifier);
  if (savedProfile) return { profile: savedProfile, sourceStore: savedRecords };
  const profile = store.resolveProfile(identifier);
  return profile ? { profile, sourceStore: store } : null;
}

function decorateProfileWithMarketplacePresence(profile, sourceStore) {
  const fragments = sourceStore.getPublicFragments?.(profile.multipass_id) ?? [];
  const derived = deriveMarketplacePresenceFromFragments(fragments);
  const fallback = Array.isArray(profile?.marketplacePresence) ? profile.marketplacePresence : [];
  const marketplacePresence = derived.length ? derived : fallback;
  const hasMarketplaceFragments = fragments.some((fragment) => fragment?.marketplace_ref);
  return marketplacePresence.length || hasMarketplaceFragments ? { ...profile, marketplacePresence } : profile;
}

function getToolsResponse(sourceStore, multipassId) {
  if (typeof sourceStore.getTools === 'function') {
    return sourceStore.getTools(multipassId);
  }
  return summarizeToolsResponse(multipassId, sourceStore.getPublicFragments?.(multipassId) ?? []);
}

function resolveSavedProfile(savedRecords, identifier) {
  const profile = savedRecords?.resolveProfile?.(identifier);
  if (!profile) throw new ApiNotFoundError(`Multipass not found: ${identifier}`);
  return profile;
}

function getSourceOwnerWallet(savedRecords, multipassId) {
  const snapshot = savedRecords.getSourceContext?.(multipassId)?.sourceSnapshot ?? {};
  return normalizeWalletOrNull(snapshot.owner ?? snapshot.ownerAddress);
}

function mapAdminClaimError(error) {
  const message = error.message ?? 'Claim approval failed.';
  if (/not found/i.test(message)) return new ApiNotFoundError(message);
  return new ApiInputError('invalid_request', message);
}

async function readJsonBody(request) {
  const raw = await request.text();
  return parseJsonBody(raw);
}

async function readBoundedJsonBody(request, maxBytes) {
  const declared = request.headers.get('content-length');
  if (declared !== null && (/^\d+$/u.test(declared) === false || Number(declared) > maxBytes)) {
    throw new ApiInputError('request_too_large', `Request body must be at most ${maxBytes} bytes.`, 413);
  }
  if (!request.body) return {};
  const reader = request.body.getReader();
  const chunks = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new ApiInputError('request_too_large', `Request body must be at most ${maxBytes} bytes.`, 413);
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return parseJsonBody(new TextDecoder('utf-8', { fatal: true }).decode(merged));
  } catch (error) {
    if (error instanceof ApiInputError) throw error;
    throw new ApiInputError('invalid_json', 'Request body must be valid UTF-8 JSON.');
  }
}

function parseJsonBody(raw) {
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new ApiInputError('invalid_json', 'Request body must be valid JSON.');
  }
}

class ApiInputError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'ApiInputError';
    this.code = code;
    this.status = status;
  }
}

class ApiUnauthorizedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ApiUnauthorizedError';
  }
}

class ApiForbiddenError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ApiForbiddenError';
  }
}

class ApiNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ApiNotFoundError';
  }
}

function appendToMapList(map, key, value) {
  const list = map.get(key) ?? [];
  list.push(value);
  map.set(key, list);
}

function jsonOrNotFound(value, message) {
  if (!value) {
    return errorResponse(404, 'not_found', message);
  }
  return jsonResponse(value);
}

function createFixedWindowRateLimiter({ limit, windowMs, now = () => Date.now() } = {}) {
  const normalizedLimit = Number.isInteger(limit) && limit > 0 ? limit : LOOPERS_ALLOWLIST_RATE_LIMIT.limit;
  const normalizedWindowMs = Number.isInteger(windowMs) && windowMs > 0 ? windowMs : LOOPERS_ALLOWLIST_RATE_LIMIT.windowMs;
  const buckets = new Map();

  return {
    check(key) {
      const bucketKey = String(key || 'unknown');
      const currentTime = now();
      const existing = buckets.get(bucketKey);
      if (!existing || currentTime >= existing.resetAt) {
        buckets.set(bucketKey, { count: 1, resetAt: currentTime + normalizedWindowMs });
        return { allowed: true, retryAfterSeconds: 0 };
      }
      if (existing.count >= normalizedLimit) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - currentTime) / 1000)),
        };
      }
      existing.count += 1;
      return { allowed: true, retryAfterSeconds: 0 };
    },
  };
}

function createBoundedFixedWindowRateLimiter({
  limit,
  windowMs,
  now = () => Date.now(),
  maxBuckets = CONSOLE_CODEX_WALLET_MAX_BUCKETS,
} = {}) {
  const normalizedLimit = Number.isInteger(limit) && limit > 0 ? limit : 1;
  const normalizedWindowMs = Number.isInteger(windowMs) && windowMs > 0 ? windowMs : 60_000;
  const normalizedMaxBuckets = Number.isInteger(maxBuckets) && maxBuckets > 0
    ? Math.min(maxBuckets, CONSOLE_CODEX_WALLET_MAX_BUCKETS)
    : CONSOLE_CODEX_WALLET_MAX_BUCKETS;
  const clock = typeof now === 'function' ? now : () => Date.now();
  const buckets = new Map();
  let lastTime = Number.NEGATIVE_INFINITY;

  function readMonotonicTime() {
    const observed = Number(clock());
    const safeObserved = Number.isFinite(observed) ? observed : Date.now();
    lastTime = Math.max(lastTime, safeObserved);
    return lastTime;
  }

  function sweepExpired(currentTime) {
    // Monotonic time and one fixed window keep Map insertion order equal to expiry order.
    // Each bucket is removed once, and the hard cap bounds worst-case sweep work.
    while (buckets.size > 0) {
      const [key, bucket] = buckets.entries().next().value;
      if (currentTime < bucket.resetAt) break;
      buckets.delete(key);
    }
  }

  return {
    check(key) {
      const bucketKey = String(key || 'unknown');
      const currentTime = readMonotonicTime();
      sweepExpired(currentTime);
      const existing = buckets.get(bucketKey);
      if (existing) {
        if (existing.count >= normalizedLimit) {
          return {
            allowed: false,
            retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - currentTime) / 1000)),
          };
        }
        existing.count += 1;
        return { allowed: true, retryAfterSeconds: 0 };
      }

      if (buckets.size >= normalizedMaxBuckets) {
        const earliest = buckets.values().next().value;
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil((earliest.resetAt - currentTime) / 1000)),
        };
      }

      buckets.set(bucketKey, { count: 1, resetAt: currentTime + normalizedWindowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    },
  };
}

function createConcurrencyGate(limit) {
  const normalizedLimit = Number.isInteger(limit) && limit > 0
    ? limit
    : CONSOLE_MESSAGE_GLOBAL_CONCURRENCY;
  let active = 0;
  return {
    tryAcquire() {
      if (active >= normalizedLimit) return null;
      active += 1;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        active -= 1;
      };
    },
  };
}

function consoleThrottleResponse(code, message, retryAfterSeconds) {
  return jsonResponse({
    schema_version: '0.1.0',
    error: { code, message },
  }, 429, { 'retry-after': String(Math.max(1, retryAfterSeconds)) });
}

function getClientRateLimitKey(request) {
  return (request.headers.get('cf-connecting-ip')
    || request.headers.get('x-real-ip')
    || firstForwardedFor(request.headers.get('x-forwarded-for'))
    || 'direct').trim();
}

function getClientSubnetRateLimitKey(clientIp) {
  const value = String(clientIp ?? '').trim();
  const ipv4 = value.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/);
  if (ipv4 && ipv4.slice(1).every((part) => Number(part) >= 0 && Number(part) <= 255)) {
    return `${ipv4[1]}.${ipv4[2]}.${ipv4[3]}.0/24`;
  }
  const ipv6 = value.toLowerCase().split(':').filter(Boolean);
  if (value.includes(':') && ipv6.length >= 4) {
    return `${ipv6.slice(0, 4).join(':')}::/64`;
  }
  return value || 'direct';
}

function firstForwardedFor(value) {
  return String(value ?? '').split(',')[0]?.trim() || null;
}

function hasLooperAllowlistBotTrap(body = {}) {
  return [
    body.website,
    body.url,
    body.company,
    body.looper_allowlist_contact,
  ].some((value) => String(value ?? '').trim());
}

function normalizeLooperAllowlistSource(value) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return normalized || 'launch-page';
}

async function verifyLooperAllowlistTurnstile(body, request, context) {
  if (!context.loopersTurnstileSecretKey) return { ok: true };
  const token = String(
    body.turnstileToken
    ?? body.turnstile_token
    ?? body['cf-turnstile-response']
    ?? '',
  ).trim();
  if (!token) {
    return { ok: false, message: 'Human verification is required for public allowlist registration.' };
  }

  const form = new URLSearchParams({
    secret: context.loopersTurnstileSecretKey,
    response: token,
  });
  const remoteIp = getClientRateLimitKey(request);
  if (remoteIp && remoteIp !== 'direct') form.set('remoteip', remoteIp);

  let result;
  try {
    const response = await context.fetchImpl(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form,
    });
    result = await response.json();
  } catch {
    return { ok: false, message: 'Human verification could not be checked. Try again shortly.' };
  }
  if (result?.success === true) return { ok: true };
  return { ok: false, message: 'Human verification failed. Try again.' };
}

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

function walletValuesUnavailableResponse() {
  return new Response(JSON.stringify({ error: { code: 'wallet_values_unavailable', message: 'Looper wallet values are temporarily unavailable.' } }), {
    status: 503,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function errorResponse(status, code, message, details, extraHeaders = {}) {
  return jsonResponse({
    schema_version: '0.1.0',
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
    },
  }, status, extraHeaders);
}

function createDiscoveryDocument(baseUrl) {
  return {
    schema_version: '0.1.0',
    service: 'helixa-multipass',
    name: 'Helixa Multipass',
    description: 'Helixa Multipass publishes a public agent profile language for discovering agent metadata, x401 proof context, x402 payment routes, and public change history without granting execution authority.',
    purpose: 'Give humans and agents a stable public agent profile entry point before they inspect trust context such as CRED, proofs, x401 manifests, x402 manifests, receipts, routes, or changes.',
    primary_phrase: 'public agent profile',
    routes: {
      discovery: `${baseUrl}/.well-known/multipass.json`,
      helixa_discovery: `${baseUrl}/.well-known/helixa-multipass.json`,
      profile: `${baseUrl}/api/multipass/{id}`,
      versioned_profile: `${baseUrl}/api/v0/multipass/{id}`,
      card: `${baseUrl}/api/multipass/{id}/card`,
      agent_card: `${baseUrl}/api/multipass/{id}/agent-card`,
      fragments: `${baseUrl}/api/multipass/{id}/fragments`,
      tools: `${baseUrl}/api/multipass/{id}/tools`,
      hydrated: `${baseUrl}/api/multipass/{id}/hydrated`,
      standards: `${baseUrl}/api/multipass/{id}/standards`,
      x401: `${baseUrl}/api/multipass/{id}/x401`,
      x402: `${baseUrl}/api/multipass/{id}/x402`,
      receipts: `${baseUrl}/api/multipass/{id}/receipts`,
      receipt: `${baseUrl}/api/multipass/{id}/receipts/{receipt_id}`,
      changes: `${baseUrl}/api/multipass/{id}/changes`,
      share: `${baseUrl}/multipass/share/{id}`,
      share_image: `${baseUrl}/multipass/share/{id}.jpg`,
      api_share: `${baseUrl}/api/multipass/{id}/share`,
      api_share_image: `${baseUrl}/api/multipass/{id}/share.jpg`,
      resolve: `${baseUrl}/api/resolve?agent={input}`,
      canonical_resolve: `${baseUrl}/api/multipass/resolve?source={source}`,
      search: `${baseUrl}/api/search?q={query}`,
      openapi: `${baseUrl}/api/openapi.json`,
    },
    supported_source_ids: [
      'helixa-agentdna:8453:{tokenId}',
      '8453:{tokenId}',
      '{tokenId}',
      'erc8004:8453:{tokenId}',
      'eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432:{tokenId}',
    ],
    start_here: {
      resolve: `${baseUrl}/api/resolve?agent={input}`,
      profile: `${baseUrl}/api/multipass/{id}`,
      hydrated: `${baseUrl}/api/multipass/{id}/hydrated`,
      agent_card: `${baseUrl}/api/multipass/{id}/agent-card`,
    },
    example_profile: {
      id: 'bendr-2-1',
      profile: `${baseUrl}/api/multipass/bendr-2-1`,
      agent_card: `${baseUrl}/api/multipass/bendr-2-1/agent-card`,
      hydrated: `${baseUrl}/api/multipass/bendr-2-1/hydrated`,
    },
    agent_instructions: [
      'Start with resolve when you have user input, a slug, or an external agent identifier; it returns the best public Multipass profile candidate or activation preview.',
      'Use agent-card for a compact machine-readable profile summary suitable for agent routing, capability display, and service endpoint inspection.',
      'Use hydrated when you need the profile plus public companion resources, including fragments, tools, standards, x401 identity proof metadata, x402 payment metadata, receipts, routes, and changes.',
    ],
    boundaries: [
      'Viewing a Multipass public agent profile does not execute tools or call agent services.',
      'Viewing or resolving a profile does not transfer custody or ownership.',
      'Public metadata does not expose private credentials or grant approvals.',
      'x401 proof metadata describes identity or authority requirements; it does not expose private credentials.',
      'Payments, receipts, and CRED are trust context; trust is not bought by payment.',
    ],
  };
}

function createOpenApiDocument(baseUrl) {
  const profileResponse = {
    description: 'Public Multipass profile response.',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/MultipassProfile' },
      },
    },
  };
  return {
    openapi: '3.1.0',
    info: {
      title: 'Helixa Multipass API',
      version: '0.1.0',
      description: 'Public Multipass API for public agent profiles. CRED, x401 proof metadata, x402 payment metadata, receipts, routes, and changes provide trust context; payments and receipts do not buy trust.',
    },
    servers: [{ url: baseUrl }],
    paths: {
      '/.well-known/helixa-multipass.json': { get: { summary: 'Legacy Helixa Multipass discovery route alias', responses: { 200: { description: 'Discovery document' } } } },
      '/.well-known/multipass.json': { get: { summary: 'Discover Multipass public routes', responses: { 200: { description: 'Discovery document' } } } },
      '/api/openapi.json': { get: { summary: 'OpenAPI description for public Multipass routes', responses: { 200: { description: 'OpenAPI document' } } } },
      '/api/multipass/{id}': { get: { summary: 'Fetch a public Multipass profile by id or slug', parameters: [pathParameter('id')], responses: { 200: profileResponse } } },
      '/api/v0/multipass/{id}': { get: { summary: 'Versioned alias for fetching a public Multipass profile', parameters: [pathParameter('id')], responses: { 200: profileResponse } } },
      '/api/multipass/{id}/fragments': { get: { summary: 'Fetch public fragments only', parameters: [pathParameter('id')], responses: { 200: { description: 'Public fragment collection' } } } },
      '/api/multipass/{id}/tools': { get: { summary: 'Fetch public tool and service cards', parameters: [pathParameter('id')], responses: { 200: { description: 'Public tool and service card collection' } } } },
      '/api/multipass/{id}/hydrated': { get: { summary: 'Fetch a hydrated saved profile with public companion resources', parameters: [pathParameter('id')], responses: { 200: { description: 'Hydrated profile response' } } } },
      '/api/multipass/{id}/card': { get: { summary: 'Compatibility alias for fetching the agent-readable card', parameters: [pathParameter('id')], responses: { 200: { description: 'Agent card' } } } },
      '/api/multipass/{id}/agent-card': { get: { summary: 'Fetch agent-readable card', description: 'Fetch the compact, machine-readable public agent profile card for routing and display.', parameters: [pathParameter('id')], responses: { 200: { description: 'Agent card' } } } },
      '/api/multipass/{id}/standards': { get: { summary: 'Fetch standards compatibility profile', parameters: [pathParameter('id')], responses: { 200: { description: 'Standards profile' } } } },
      '/api/multipass/{id}/x401': { get: { summary: 'Fetch public x401 identity proof manifest', parameters: [pathParameter('id')], responses: { 200: { description: 'x401 manifest' } } } },
      '/api/multipass/{id}/x402': { get: { summary: 'Fetch public x402 manifest', parameters: [pathParameter('id')], responses: { 200: { description: 'x402 manifest' } } } },
      '/api/multipass/{id}/receipts': { get: { summary: 'Fetch public receipt fragments', parameters: [pathParameter('id')], responses: { 200: { description: 'Receipt fragment collection' } } } },
      '/api/multipass/{id}/receipts/{receipt_id}': { get: { summary: 'Fetch one public receipt fragment', parameters: [pathParameter('id'), pathParameter('receipt_id')], responses: { 200: { description: 'Receipt fragment' } } } },
      '/api/multipass/{id}/changes': { get: { summary: 'Fetch public change history for saved records when available', parameters: [pathParameter('id')], responses: { 200: { description: 'Public change log' } } } },
      '/multipass/share/{id}': { get: { summary: 'Render crawler-friendly dynamic share metadata for a saved Multipass profile', parameters: [pathParameter('id')], responses: { 200: { description: 'HTML page with Open Graph and Twitter metadata for crawlers' } } } },
      '/multipass/share/{id}.jpg': { get: { summary: 'Render a dynamic JPEG preview image for a saved Multipass profile', parameters: [pathParameter('id')], responses: { 200: { description: 'JPEG preview image' } } } },
      '/api/multipass/{id}/share': { get: { summary: 'API alias for crawler-friendly dynamic share metadata', parameters: [pathParameter('id')], responses: { 200: { description: 'HTML page with Open Graph and Twitter metadata for crawlers' } } } },
      '/api/multipass/{id}/share.jpg': { get: { summary: 'API alias for a dynamic JPEG preview image', parameters: [pathParameter('id')], responses: { 200: { description: 'JPEG preview image' } } } },
      '/api/resolve': { get: { summary: 'Resolve an input to a saved profile or live activation preview', parameters: [queryParameter('agent')], responses: { 200: { description: 'Resolution result' } } } },
      '/api/multipass/resolve': { get: { summary: 'Resolve a Helixa AgentDNA or Base ERC-8004 source identity to a hydrated profile or activation preview', parameters: [queryParameter('source', 'Source identity. Supports Helixa AgentDNA forms like {tokenId}, 8453:{tokenId}, helixa-agentdna:8453:{tokenId}, and Base ERC-8004 forms like erc8004:8453:{tokenId} or eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432:{tokenId}.')], responses: { 200: { description: 'Canonical source resolution result' } } } },
      '/api/search': { get: { summary: 'Conservative exact or prefix search over public profile summaries', parameters: [queryParameter('q')], responses: { 200: { description: 'Search matches' } } } },
      '/api/loopers/allowlist/proof': { get: { summary: 'Fetch a frozen Loopers allowlist Merkle proof for one wallet address', parameters: [queryParameter('address')], responses: { 200: { description: 'Loopers allowlist proof response' } } } },
    },
    components: {
      schemas: {
        MultipassProfile: { type: 'object', description: 'Public Multipass profile document.' },
      },
    },
  };
}

function pathParameter(name) {
  return { name, in: 'path', required: true, schema: { type: 'string' } };
}

function queryParameter(name, description) {
  return {
    name,
    in: 'query',
    required: true,
    schema: { type: 'string' },
    ...(description ? { description } : {}),
  };
}

function createProfileRoutes(baseUrl, identifier) {
  const encoded = encodeURIComponent(identifier);
  return {
    profile: `${baseUrl}/api/multipass/${encoded}`,
    versioned_profile: `${baseUrl}/api/v0/multipass/${encoded}`,
    card: `${baseUrl}/api/multipass/${encoded}/card`,
    agent_card: `${baseUrl}/api/multipass/${encoded}/agent-card`,
    fragments: `${baseUrl}/api/multipass/${encoded}/fragments`,
    tools: `${baseUrl}/api/multipass/${encoded}/tools`,
    hydrated: `${baseUrl}/api/multipass/${encoded}/hydrated`,
    standards: `${baseUrl}/api/multipass/${encoded}/standards`,
    x401: `${baseUrl}/api/multipass/${encoded}/x401`,
    x402: `${baseUrl}/api/multipass/${encoded}/x402`,
    receipts: `${baseUrl}/api/multipass/${encoded}/receipts`,
    changes: `${baseUrl}/api/multipass/${encoded}/changes`,
  };
}

function decorateAgentCardForDiscovery(card, profile, baseUrl) {
  if (!card || !profile) return card;

  const displayName = profile.display_name ?? profile.name ?? profile.source ?? profile.slug ?? profile.multipass_id ?? 'This agent';
  const routeIdentifier = profile.slug ?? profile.multipass_id;
  const routes = createProfileRoutes(baseUrl, routeIdentifier);
  const requiredLinks = [
    { rel: 'profile', href: routes.profile },
    { rel: 'hydrated', href: routes.hydrated },
    { rel: 'tools', href: routes.tools },
    { rel: 'x401', href: routes.x401 },
    { rel: 'x402', href: routes.x402 },
    { rel: 'receipts', href: routes.receipts },
    { rel: 'changes', href: routes.changes },
  ];
  const links = Array.isArray(card.links) ? [...card.links] : [];
  const existingRels = new Set(links.map((link) => link?.rel).filter((rel) => typeof rel === 'string'));

  for (const link of requiredLinks) {
    if (existingRels.has(link.rel)) continue;
    existingRels.add(link.rel);
    links.push(link);
  }

  return {
    ...card,
    summary: card.summary ?? `${displayName} public agent profile. Includes public identity, x401 proof, tool, x402 payment, receipt, and change context when available.`,
    services: Array.isArray(card.services) ? card.services : [],
    x401_manifest_url: card.x401_manifest_url ?? routes.x401,
    links,
    boundaries: Array.isArray(card.boundaries)
      ? card.boundaries
      : ['Public agent-card metadata does not execute tools, transfer custody, expose private credentials, or grant approvals.'],
  };
}

function createProfileSearchResult(profile, kind, baseUrl) {
  return {
    kind,
    multipass_id: profile.multipass_id,
    slug: profile.slug,
    display_name: profile.display_name,
    subject_type: profile.subject_type,
    summary: profile.discovery_profile?.summary ?? null,
    tags: profile.discovery_profile?.tags ?? [],
    owner_state: profile.owner_summary?.owner_state ?? null,
    verification_status: profile.owner_summary?.verification_status ?? null,
    trust_state: profile.cred_summary?.trust_state ?? null,
    profile_url: `${baseUrl}/api/multipass/${encodeURIComponent(profile.slug)}`,
  };
}

function searchProfileList(profiles, query, options = {}) {
  const needle = query.toLowerCase();
  const limit = options.limit ?? 10;
  return profiles
    .filter((profile) => {
      const fields = [profile.slug, profile.multipass_id, profile.display_name, ...(profile.discovery_profile?.tags ?? [])]
        .map((field) => String(field ?? '').toLowerCase());
      return fields.some((field) => field === needle || field.startsWith(needle));
    })
    .slice(0, limit);
}

function assertTrustedOrigin(request, context) {
  const origin = request.headers.get('origin') || originFromReferer(request.headers.get('referer'));
  if (!origin) return;
  if (!context.allowedOrigins.has(origin)) {
    throw new ApiForbiddenError('Request origin is not allowed for Multipass manager writes.');
  }
}

function isTrustedBrowserOrigin(request, context) {
  const origin = request.headers.get('origin') || originFromReferer(request.headers.get('referer'));
  return Boolean(origin && context.allowedOrigins.has(origin));
}

function domainFromRequest(request) {
  const origin = request.headers.get('origin');
  if (origin) return new URL(origin).host;
  return new URL(request.url).host;
}

function originFromReferer(referer) {
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

function normalizeAllowedOrigins(allowedOrigins, baseUrl) {
  const origins = allowedOrigins?.length ? allowedOrigins : [new URL(baseUrl).origin];
  return new Set(origins.map((origin) => new URL(origin).origin));
}

function inferSecureCookie(allowedOrigins, baseUrl) {
  const origins = allowedOrigins?.length ? allowedOrigins : [baseUrl];
  return origins.some((origin) => new URL(origin).protocol === 'https:');
}

function buildSessionCookie(sessionId, context) {
  return [
    `${context.cookieName}=${encodeURIComponent(sessionId)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    context.cookieSecure ? 'Secure' : null,
  ].filter(Boolean).join('; ');
}

function clearSessionCookie(context) {
  return [
    `${context.cookieName}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    context.cookieSecure ? 'Secure' : null,
  ].filter(Boolean).join('; ');
}

function buildConsoleSessionCookie(sessionId, context) {
  return [
    `${context.consoleCookieName}=${encodeURIComponent(sessionId)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    context.cookieSecure ? 'Secure' : null,
  ].filter(Boolean).join('; ');
}

function clearConsoleSessionCookie(context) {
  return [
    `${context.consoleCookieName}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=0',
    context.cookieSecure ? 'Secure' : null,
  ].filter(Boolean).join('; ');
}

function parseCookies(header) {
  const cookies = new Map();
  for (const part of String(header ?? '').split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (name) cookies.set(name, decodeURIComponent(value));
  }
  return cookies;
}

function normalizeWallet(value, field) {
  const wallet = String(value ?? '').trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(wallet)) throw new ApiInputError('invalid_request', `${field} must be an EVM wallet address.`);
  return wallet;
}

function normalizeWalletOrNull(value) {
  const wallet = String(value ?? '').trim().toLowerCase();
  return /^0x[a-f0-9]{40}$/.test(wallet) ? wallet : null;
}


function stripTrailingSlash(value) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}
