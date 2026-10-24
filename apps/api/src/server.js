import { randomBytes, randomUUID } from 'node:crypto';
import http from 'node:http';
import { isIP } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { activateHelixaRecord } from './activation-records.js';
import { readAllowlistFile } from './allowlist-snapshot.js';
import { createJsonAllowlistStore, createMemoryAllowlistStore } from './allowlist-store.js';
import { createConsoleProductionBootstrap } from './console-production-bootstrap.js';
import { createCredifiOwnerOptInProviders, createCredifiOwnerOptInStore, createCredifiOwnerOptInVerifier } from './credifi-owner-opt-in.js';
import {
  DEFAULT_CREDIFI_API_BASE_URL,
  DEFAULT_LOOPER_CREDIT_CRED_BASE_URL,
  DEFAULT_LOOPER_CREDIT_MIN_CRED,
  createConsoleCreditService,
} from './console-credit.js';
import { loadFixtureStore } from './fixtures.js';
import { createMultipassApi } from './index.js';
import {
  DEFAULT_LOOPER_CRED_API_BASE_URL,
  DEFAULT_LOOPER_CRED_CONCURRENCY,
  DEFAULT_LOOPER_CRED_TIMEOUT_MS,
  createLooperCredClient,
  enrichOwnedLoopersWithCred,
} from './looper-cred-client.js';
import { createLooperCodexRuntime } from './looper-codex-runtime.js';
import { createLooperMarketplaceListingsLoader } from './looper-marketplace.js';
import { createLooperMarketplacePreviewLoader } from './looper-marketplace-preview.js';
import { createLooperWalletValueRefresher, createLooperWalletValuesLoader } from './looper-wallet-values.js';
import { createSqliteLooperNameStore } from './looper-name-store.js';
import { readOpenSeaApiKey } from './loopers-sales/opensea.js';
import { createMissionDatabase } from './missions/database.js';
import { createMissionRepository } from './missions/repository.js';
import { createMissionService } from './missions/service.js';
import { createSwarmLaunchConsentService } from './missions/swarm-launch-consent.js';
import { createSwarmLaunchConsentStore } from './missions/swarm-launch-consent-store.js';
import { previewSwarmLaunch } from './missions/swarm-launch-preview.js';
import { createSwarmInvitationStore } from './missions/swarm-invitation-store.js';
import { createSwarmInvitationAuthorityVerifier, createSwarmInvitationService } from './missions/swarm-invitations.js';
import { createSqliteSavedRecords } from './saved-records.js';
import { verifyEthereumPersonalSignature } from './signature-verifier.js';
import { buildRestap3802Discovery } from './restap-3802-contracts.js';
import { authorizeRestap3802Policy, loadRestap3802Policy } from './restap-3802-policy.js';
import { createRestapNewsAuthenticator } from './restap-news-auth.js';
import { createRestapNewsStore } from './restap-news-store.js';
import { createRestapPublicSessionStore } from './restap-public-sessions.js';
import { createBankrRestapInferenceClient, createRestapPublicTalkRuntime } from './restap-public-talk.js';
import { loadRestapNetworkFileSigner } from './restap-network/grants.js';
import { createRestapNetworkProductionFoundation, parseRestapNetworkProductionConfig } from './restap-network/production.js';
import { hasRestapNetworkEnvironment, parseRestapNetworkServiceConfig, startRestapNetworkService } from './restap-network/service.js';
import { composeRestapVerifiedSendProduction } from './restap-network/verified-send-production.js';

const DEFAULT_FIXTURE = 'generic';
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 8787;
const DEFAULT_RESTAP_TALK_TIMEOUT_MS = 15_000;
const DEFAULT_RESTAP_TALK_LIMITS = Object.freeze({
  perIpPerMinute: 20,
  perSessionPerMinute: 10,
  globalPerDay: 10_000,
  concurrency: 4,
});

export function parseServerOptions(argv = [], env = process.env) {
  const home = env.HOME || os.homedir();
  const options = {
    fixture: env.MULTIPASS_FIXTURE || DEFAULT_FIXTURE,
    host: env.HOST || DEFAULT_HOST,
    port: parsePort(env.PORT, DEFAULT_PORT, 'PORT'),
    databasePath: env.MULTIPASS_DB_PATH || null,
    allowedOrigins: parseOriginList(env.MULTIPASS_ALLOWED_ORIGINS),
    adminSecret: env.MULTIPASS_ADMIN_SECRET || null,
    cookieSecure: parseOptionalBoolean(env.MULTIPASS_COOKIE_SECURE, 'MULTIPASS_COOKIE_SECURE'),
    publicBaseUrl: normalizeOptionalBaseUrl(env.MULTIPASS_PUBLIC_BASE_URL, 'MULTIPASS_PUBLIC_BASE_URL'),
    openseaConfigPath: env.LOOPERS_SALES_OPENSEA_CONFIG_PATH || path.join(home, '.config/opensea/config.json'),
    loopersAllowlistPath: env.MULTIPASS_LOOPERS_ALLOWLIST_PATH || null,
    loopersAllowlistSnapshotPath: env.MULTIPASS_LOOPERS_ALLOWLIST_SNAPSHOT_PATH || null,
    looperCodexArtifactPath: env.MULTIPASS_LOOPER_CODEX_ARTIFACT_PATH || null,
    looperMarketplaceRosterPath: env.LOOPER_MARKETPLACE_ROSTER_PATH || null,
    missionsEnabled: parseStrictBoolean(env.MULTIPASS_MISSIONS_ENABLED, 'MULTIPASS_MISSIONS_ENABLED') ?? false,
    missionsDatabasePath: env.MULTIPASS_MISSIONS_DB_PATH || null,
    loopersAllowlistRegistrationPaused: parseOptionalBoolean(env.MULTIPASS_LOOPERS_ALLOWLIST_PAUSED, 'MULTIPASS_LOOPERS_ALLOWLIST_PAUSED') ?? false,
    loopersAllowlistRequireBrowserOrigin: parseOptionalBoolean(env.MULTIPASS_LOOPERS_ALLOWLIST_REQUIRE_BROWSER_ORIGIN, 'MULTIPASS_LOOPERS_ALLOWLIST_REQUIRE_BROWSER_ORIGIN') ?? false,
    loopersAllowlistBlockedSources: parseStringList(env.MULTIPASS_LOOPERS_ALLOWLIST_BLOCKED_SOURCES),
    loopersAllowlistRateLimit: parseRateLimitConfig({
      limit: env.MULTIPASS_LOOPERS_ALLOWLIST_RATE_LIMIT,
      windowSeconds: env.MULTIPASS_LOOPERS_ALLOWLIST_RATE_WINDOW_SECONDS,
    }, 'MULTIPASS_LOOPERS_ALLOWLIST_RATE'),
    loopersAllowlistSubnetRateLimit: parseRateLimitConfig({
      limit: env.MULTIPASS_LOOPERS_ALLOWLIST_SUBNET_RATE_LIMIT,
      windowSeconds: env.MULTIPASS_LOOPERS_ALLOWLIST_SUBNET_RATE_WINDOW_SECONDS,
    }, 'MULTIPASS_LOOPERS_ALLOWLIST_SUBNET_RATE'),
    loopersAllowlistGlobalRateLimit: parseRateLimitConfig({
      limit: env.MULTIPASS_LOOPERS_ALLOWLIST_GLOBAL_RATE_LIMIT,
      windowSeconds: env.MULTIPASS_LOOPERS_ALLOWLIST_GLOBAL_RATE_WINDOW_SECONDS,
    }, 'MULTIPASS_LOOPERS_ALLOWLIST_GLOBAL_RATE'),
    loopersTurnstileSecretKey: env.MULTIPASS_LOOPERS_TURNSTILE_SECRET_KEY || null,
    loopersCredApiBaseUrl: normalizeOptionalBaseUrl(env.MULTIPASS_LOOPER_CRED_API_BASE_URL, 'MULTIPASS_LOOPER_CRED_API_BASE_URL') ?? DEFAULT_LOOPER_CRED_API_BASE_URL,
    loopersCredTimeoutMs: parseBoundedPositiveInteger(env.MULTIPASS_LOOPER_CRED_TIMEOUT_MS, DEFAULT_LOOPER_CRED_TIMEOUT_MS, 'MULTIPASS_LOOPER_CRED_TIMEOUT_MS', 30_000),
    loopersCredConcurrency: parseBoundedPositiveInteger(env.MULTIPASS_LOOPER_CRED_CONCURRENCY, DEFAULT_LOOPER_CRED_CONCURRENCY, 'MULTIPASS_LOOPER_CRED_CONCURRENCY', 16),
    consoleCreditEnabled: parseStrictBoolean(env.MULTIPASS_CREDIT_ENABLED, 'MULTIPASS_CREDIT_ENABLED') ?? false,
    consoleCreditAllowedLoopers: parseCanonicalTokenIdList(env.MULTIPASS_CREDIT_ALLOWED_TOKEN_IDS, 'MULTIPASS_CREDIT_ALLOWED_TOKEN_IDS'),
    consoleCreditApiBaseUrl: normalizeOptionalBaseUrl(env.MULTIPASS_CREDIFI_API_BASE_URL, 'MULTIPASS_CREDIFI_API_BASE_URL') ?? DEFAULT_CREDIFI_API_BASE_URL,
    consoleCreditCredBaseUrl: normalizeOptionalBaseUrl(env.MULTIPASS_CREDIT_CRED_BASE_URL, 'MULTIPASS_CREDIT_CRED_BASE_URL') ?? DEFAULT_LOOPER_CREDIT_CRED_BASE_URL,
    consoleCreditMinCred: parseBoundedNonnegativeInteger(env.MULTIPASS_CREDIT_MIN_CRED, DEFAULT_LOOPER_CREDIT_MIN_CRED, 'MULTIPASS_CREDIT_MIN_CRED', 100),
    consoleCreditTimeoutMs: parseBoundedPositiveInteger(env.MULTIPASS_CREDIT_TIMEOUT_MS, 10_000, 'MULTIPASS_CREDIT_TIMEOUT_MS', 30_000),
    credifiOwnerOptInEnabled: parseStrictBoolean(env.MULTIPASS_CREDIFI_OWNER_OPT_IN_ENABLED, 'MULTIPASS_CREDIFI_OWNER_OPT_IN_ENABLED') ?? false,
    bankrLlmKey: env.BANKR_LLM_KEY || env.BANKR_API_KEY || null,
    bankrReadonlyApiKey: env.BANKR_READONLY_API_KEY || null,
    bankrLlmModel: env.MULTIPASS_AGENT_LLM_MODEL || null,
    bankrLlmVisionModel: env.MULTIPASS_AGENT_LLM_VISION_MODEL || null,
    consoleAgentBankrLlmEnabled: parseOptionalBoolean(env.MULTIPASS_AGENT_BANKR_LLM_ENABLED, 'MULTIPASS_AGENT_BANKR_LLM_ENABLED') ?? false,
    consoleSkillProposalsEnabled: parseOptionalBoolean(env.MULTIPASS_CONSOLE_SKILL_PROPOSALS_ENABLED, 'MULTIPASS_CONSOLE_SKILL_PROPOSALS_ENABLED') ?? false,
    consoleMarketReadEnabled: parseOptionalBoolean(env.MULTIPASS_CONSOLE_MARKET_READ_ENABLED, 'MULTIPASS_CONSOLE_MARKET_READ_ENABLED') ?? false,
    consoleAccountReadEnabled: parseOptionalBoolean(env.MULTIPASS_CONSOLE_ACCOUNT_READ_ENABLED, 'MULTIPASS_CONSOLE_ACCOUNT_READ_ENABLED') ?? false,
    consoleXmtpEnabled: parseOptionalBoolean(env.MULTIPASS_XMTP_ENABLED, 'MULTIPASS_XMTP_ENABLED') ?? false,
    consoleXmtpEnv: env.MULTIPASS_XMTP_ENV || 'production',
    consoleXmtpWalletKey: env.MULTIPASS_XMTP_WALLET_KEY || null,
    consoleXmtpDbPath: env.MULTIPASS_XMTP_DB_PATH || null,
    consoleXmtpDbEncryptionKey: env.MULTIPASS_XMTP_DB_ENCRYPTION_KEY || null,
    consoleXmtpHistorySyncUrl: env.MULTIPASS_XMTP_HISTORY_SYNC_URL || null,
    consoleXmtpApiUrl: env.MULTIPASS_XMTP_API_URL || null,
    consoleXmtpGatewayHost: env.MULTIPASS_XMTP_GATEWAY_HOST || null,
    consoleXmtpAppVersion: env.MULTIPASS_XMTP_APP_VERSION || 'multipass-console',
    restapDiscoveryEnabled: parseStrictBoolean(env.MULTIPASS_RESTAP_DISCOVERY_ENABLED, 'MULTIPASS_RESTAP_DISCOVERY_ENABLED') ?? false,
    restapTalkEnabled: parseStrictBoolean(env.MULTIPASS_RESTAP_TALK_ENABLED, 'MULTIPASS_RESTAP_TALK_ENABLED') ?? false,
    restapNewsWriteEnabled: parseStrictBoolean(env.MULTIPASS_RESTAP_NEWS_WRITE_ENABLED, 'MULTIPASS_RESTAP_NEWS_WRITE_ENABLED') ?? false,
    restapNewsReadEnabled: parseStrictBoolean(env.MULTIPASS_RESTAP_NEWS_READ_ENABLED, 'MULTIPASS_RESTAP_NEWS_READ_ENABLED') ?? false,
    restapTrustLoopbackProxy: parseStrictBoolean(env.MULTIPASS_RESTAP_TRUST_LOOPBACK_PROXY, 'MULTIPASS_RESTAP_TRUST_LOOPBACK_PROXY') ?? false,
    restapNetworkSignerFile: env.MULTIPASS_RESTAP_NETWORK_SIGNER_FILE || null,
    restap3802PolicyPath: env.MULTIPASS_RESTAP_3802_POLICY_PATH || env.MULTIPASS_RESTAP_POLICY_PATH || null,
    restapTalkModel: parseOptionalBoundedString(env.MULTIPASS_RESTAP_TALK_MODEL, 'MULTIPASS_RESTAP_TALK_MODEL', 128),
    restapTalkTimeoutMs: parseBoundedPositiveInteger(env.MULTIPASS_RESTAP_TALK_TIMEOUT_MS, DEFAULT_RESTAP_TALK_TIMEOUT_MS, 'MULTIPASS_RESTAP_TALK_TIMEOUT_MS', DEFAULT_RESTAP_TALK_TIMEOUT_MS),
    restapTalkLimits: {
      perIpPerMinute: parseBoundedPositiveInteger(env.MULTIPASS_RESTAP_TALK_PER_IP_PER_MINUTE, DEFAULT_RESTAP_TALK_LIMITS.perIpPerMinute, 'MULTIPASS_RESTAP_TALK_PER_IP_PER_MINUTE', 10_000),
      perSessionPerMinute: parseBoundedPositiveInteger(env.MULTIPASS_RESTAP_TALK_PER_SESSION_PER_MINUTE, DEFAULT_RESTAP_TALK_LIMITS.perSessionPerMinute, 'MULTIPASS_RESTAP_TALK_PER_SESSION_PER_MINUTE', 10_000),
      globalPerDay: parseBoundedPositiveInteger(env.MULTIPASS_RESTAP_TALK_GLOBAL_PER_DAY, DEFAULT_RESTAP_TALK_LIMITS.globalPerDay, 'MULTIPASS_RESTAP_TALK_GLOBAL_PER_DAY', 1_000_000),
      concurrency: parseBoundedPositiveInteger(env.MULTIPASS_RESTAP_TALK_CONCURRENCY, DEFAULT_RESTAP_TALK_LIMITS.concurrency, 'MULTIPASS_RESTAP_TALK_CONCURRENCY', 16),
    },
  };
  if (hasRestapNetworkEnvironment(env)) {
    options.restapNetworkServiceConfig = parseRestapNetworkServiceConfig(env);
    options.restapNetworkProductionConfig = parseRestapNetworkProductionConfig(env);
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--fixture') {
      options.fixture = argv[++index];
    } else if (arg === '--host') {
      options.host = argv[++index];
    } else if (arg === '--port') {
      options.port = parsePort(argv[++index], DEFAULT_PORT, '--port');
    } else if (arg === '--database') {
      options.databasePath = argv[++index];
    } else if (arg === '--public-base-url') {
      options.publicBaseUrl = normalizeOptionalBaseUrl(argv[++index], '--public-base-url');
    } else if (arg === '--loopers-allowlist') {
      options.loopersAllowlistPath = argv[++index];
    } else if (arg === '--loopers-allowlist-snapshot') {
      options.loopersAllowlistSnapshotPath = argv[++index];
    }
  }

  return options;
}

export async function startServer(options = {}) {
  const parsed = {
    fixture: options.fixture || DEFAULT_FIXTURE,
    host: options.host || DEFAULT_HOST,
    port: options.port ?? DEFAULT_PORT,
    databasePath: options.databasePath ?? null,
    allowedOrigins: options.allowedOrigins ?? [],
    adminSecret: options.adminSecret ?? null,
    cookieSecure: options.cookieSecure ?? null,
    publicBaseUrl: normalizeOptionalBaseUrl(options.publicBaseUrl, 'publicBaseUrl'),
    openseaConfigPath: options.openseaConfigPath ?? path.join(os.homedir(), '.config/opensea/config.json'),
    loopersAllowlistPath: options.loopersAllowlistPath ?? null,
    loopersAllowlistSnapshotPath: options.loopersAllowlistSnapshotPath ?? null,
    looperCodexArtifactPath: options.looperCodexArtifactPath ?? null,
    looperMarketplaceRosterPath: options.looperMarketplaceRosterPath ?? null,
    missionsEnabled: options.missionsEnabled === true,
    missionsDatabasePath: options.missionsDatabasePath ?? null,
    loopersAllowlistRegistrationPaused: Boolean(options.loopersAllowlistRegistrationPaused),
    loopersAllowlistRequireBrowserOrigin: Boolean(options.loopersAllowlistRequireBrowserOrigin),
    loopersAllowlistBlockedSources: options.loopersAllowlistBlockedSources ?? [],
    loopersAllowlistRateLimit: options.loopersAllowlistRateLimit,
    loopersAllowlistSubnetRateLimit: options.loopersAllowlistSubnetRateLimit,
    loopersAllowlistGlobalRateLimit: options.loopersAllowlistGlobalRateLimit,
    loopersTurnstileSecretKey: options.loopersTurnstileSecretKey ?? null,
    loopersCredApiBaseUrl: normalizeOptionalBaseUrl(options.loopersCredApiBaseUrl ?? DEFAULT_LOOPER_CRED_API_BASE_URL, 'loopersCredApiBaseUrl'),
    loopersCredTimeoutMs: parseBoundedPositiveInteger(options.loopersCredTimeoutMs, DEFAULT_LOOPER_CRED_TIMEOUT_MS, 'loopersCredTimeoutMs', 30_000),
    loopersCredConcurrency: parseBoundedPositiveInteger(options.loopersCredConcurrency, DEFAULT_LOOPER_CRED_CONCURRENCY, 'loopersCredConcurrency', 16),
    consoleCreditEnabled: options.consoleCreditEnabled === true,
    consoleCreditAllowedLoopers: parseCanonicalTokenIdList(options.consoleCreditAllowedLoopers, 'consoleCreditAllowedLoopers'),
    consoleCreditApiBaseUrl: normalizeOptionalBaseUrl(options.consoleCreditApiBaseUrl ?? DEFAULT_CREDIFI_API_BASE_URL, 'consoleCreditApiBaseUrl'),
    consoleCreditCredBaseUrl: normalizeOptionalBaseUrl(options.consoleCreditCredBaseUrl ?? DEFAULT_LOOPER_CREDIT_CRED_BASE_URL, 'consoleCreditCredBaseUrl'),
    consoleCreditMinCred: parseBoundedNonnegativeInteger(options.consoleCreditMinCred, DEFAULT_LOOPER_CREDIT_MIN_CRED, 'consoleCreditMinCred', 100),
    consoleCreditTimeoutMs: parseBoundedPositiveInteger(options.consoleCreditTimeoutMs, 10_000, 'consoleCreditTimeoutMs', 30_000),
    credifiOwnerOptInEnabled: options.credifiOwnerOptInEnabled === true,
    bankrLlmKey: options.bankrLlmKey ?? null,
    bankrReadonlyApiKey: options.bankrReadonlyApiKey ?? null,
    bankrLlmModel: options.bankrLlmModel ?? null,
    bankrLlmVisionModel: options.bankrLlmVisionModel ?? null,
    consoleAgentBankrLlmEnabled: Boolean(options.consoleAgentBankrLlmEnabled),
    consoleSkillProposalsEnabled: Boolean(options.consoleSkillProposalsEnabled),
    consoleMarketReadEnabled: Boolean(options.consoleMarketReadEnabled),
    consoleAccountReadEnabled: Boolean(options.consoleAccountReadEnabled),
    consoleXmtpEnabled: Boolean(options.consoleXmtpEnabled),
    consoleXmtpEnv: options.consoleXmtpEnv ?? 'production',
    consoleXmtpWalletKey: options.consoleXmtpWalletKey ?? null,
    consoleXmtpDbPath: options.consoleXmtpDbPath ?? null,
    consoleXmtpDbEncryptionKey: options.consoleXmtpDbEncryptionKey ?? null,
    consoleXmtpHistorySyncUrl: options.consoleXmtpHistorySyncUrl ?? null,
    consoleXmtpApiUrl: options.consoleXmtpApiUrl ?? null,
    consoleXmtpGatewayHost: options.consoleXmtpGatewayHost ?? null,
    consoleXmtpAppVersion: options.consoleXmtpAppVersion ?? 'multipass-console',
    restapDiscoveryEnabled: options.restapDiscoveryEnabled === true,
    restapTalkEnabled: options.restapTalkEnabled === true,
    restapNewsWriteEnabled: options.restapNewsWriteEnabled === true,
    restapNewsReadEnabled: options.restapNewsReadEnabled === true,
    restapTrustLoopbackProxy: options.restapTrustLoopbackProxy === true,
    restapNetworkSignerFile: options.restapNetworkSignerFile ?? null,
    restapNetworkSignerRequired: options.restapNetworkSignerRequired === true,
    restapNetworkServiceConfig: options.restapNetworkServiceConfig ?? parseRestapNetworkServiceConfig({}),
    restapNetworkProductionConfig: options.restapNetworkProductionConfig ?? parseRestapNetworkProductionConfig({}),
    restap3802PolicyPath: options.restap3802PolicyPath ?? null,
    restapTalkModel: parseOptionalBoundedString(options.restapTalkModel, 'restapTalkModel', 128),
    restapTalkTimeoutMs: parseBoundedPositiveInteger(options.restapTalkTimeoutMs, DEFAULT_RESTAP_TALK_TIMEOUT_MS, 'restapTalkTimeoutMs', DEFAULT_RESTAP_TALK_TIMEOUT_MS),
    restapTalkLimits: {
      perIpPerMinute: parseBoundedPositiveInteger(options.restapTalkLimits?.perIpPerMinute, DEFAULT_RESTAP_TALK_LIMITS.perIpPerMinute, 'restapTalkLimits.perIpPerMinute', 10_000),
      perSessionPerMinute: parseBoundedPositiveInteger(options.restapTalkLimits?.perSessionPerMinute, DEFAULT_RESTAP_TALK_LIMITS.perSessionPerMinute, 'restapTalkLimits.perSessionPerMinute', 10_000),
      globalPerDay: parseBoundedPositiveInteger(options.restapTalkLimits?.globalPerDay, DEFAULT_RESTAP_TALK_LIMITS.globalPerDay, 'restapTalkLimits.globalPerDay', 1_000_000),
      concurrency: parseBoundedPositiveInteger(options.restapTalkLimits?.concurrency, DEFAULT_RESTAP_TALK_LIMITS.concurrency, 'restapTalkLimits.concurrency', 16),
    },
    loopersOwnedRpcUrl: options.loopersOwnedRpcUrl,
    loopersOwnedMetadataBaseUrl: options.loopersOwnedMetadataBaseUrl,
    loopersPublicClients: options.loopersPublicClients,
    fetchImpl: options.fetchImpl,
  };
  const { store, fixtureName } = await loadFixtureStore({ fixture: parsed.fixture });
  if (parsed.credifiOwnerOptInEnabled && !parsed.databasePath) {
    throw new Error('MULTIPASS_CREDIFI_OWNER_OPT_IN_ENABLED requires MULTIPASS_DB_PATH.');
  }
  const ownsSavedRecords = Boolean(parsed.databasePath && !options.savedRecords);
  const ownsCredifiOwnerOptInService = Boolean(parsed.credifiOwnerOptInEnabled && parsed.databasePath && !options.credifiOwnerOptInService);
  const credifiOwnerOptInVerifier = parsed.credifiOwnerOptInEnabled
    ? (options.credifiOwnerOptInVerifier ?? createCredifiOwnerOptInVerifier({
      providers: options.credifiOwnerOptInProviders ?? createCredifiOwnerOptInProviders(),
    }))
    : null;
  const credifiOwnerOptInService = !parsed.credifiOwnerOptInEnabled ? null : (options.credifiOwnerOptInService ?? (ownsCredifiOwnerOptInService
    ? createCredifiOwnerOptInStore({ databasePath: parsed.databasePath, custodyVerifier: credifiOwnerOptInVerifier })
    : null));
  const savedRecords = options.savedRecords ?? (parsed.databasePath ? createSqliteSavedRecords({ databasePath: parsed.databasePath }) : null);
  const ownsLooperNameStore = !options.looperNameStore;
  const looperNameStore = options.looperNameStore ?? createSqliteLooperNameStore({ databasePath: parsed.databasePath ?? ':memory:' });
  if (parsed.missionsEnabled && !options.missionService && !options.missionStore && !parsed.missionsDatabasePath) {
    throw new Error('Swarm Command requires MULTIPASS_MISSIONS_DB_PATH when enabled.');
  }
  const ownsMissionStore = Boolean(parsed.missionsEnabled && !options.missionService && !options.missionStore);
  const missionStore = options.missionStore ?? (ownsMissionStore
    ? createMissionDatabase({ filename: parsed.missionsDatabasePath })
    : null);
  const missionService = options.missionService ?? (parsed.missionsEnabled
    ? createMissionService({
      repository: createMissionRepository({ store: missionStore, createId: () => 'operation-' + randomUUID() }),
    })
    : null);
  const ownsSwarmLaunchConsentStore = Boolean(parsed.databasePath && !options.savedRecords && !options.swarmLaunchConsentService && !options.swarmLaunchConsentStore);
  const swarmLaunchConsentStore = options.swarmLaunchConsentStore ?? (ownsSwarmLaunchConsentStore
    ? createSwarmLaunchConsentStore({ filename: parsed.databasePath })
    : null);
  const ownsSwarmInvitationStore = Boolean(parsed.databasePath && !options.savedRecords && !options.swarmInvitationService && !options.swarmInvitationStore);
  const swarmInvitationStore = options.swarmInvitationStore ?? (ownsSwarmInvitationStore
    ? createSwarmInvitationStore({ filename: parsed.databasePath })
    : null);
  const activationService = options.activationService ?? activateHelixaRecord;
  const loopersAllowlist = options.loopersAllowlist
    ?? (parsed.loopersAllowlistPath
      ? await createJsonAllowlistStore({ filePath: parsed.loopersAllowlistPath })
      : createMemoryAllowlistStore());
  const loopersAllowlistSnapshot = options.loopersAllowlistSnapshot
    ?? (parsed.loopersAllowlistSnapshotPath
      ? await readAllowlistFile(parsed.loopersAllowlistSnapshotPath)
      : null);
  const consoleBootstrapFactory = options.consoleBootstrapFactory ?? createConsoleProductionBootstrap;
  const looperCodexRuntimeFactory = options.looperCodexRuntimeFactory ?? createLooperCodexRuntime;
  const openSeaApiKeyLoader = options.openSeaApiKeyLoader ?? readOpenSeaApiKey;
  const looperMarketplaceListingsLoaderFactory = options.looperMarketplaceListingsLoaderFactory
    ?? createLooperMarketplaceListingsLoader;
  const looperWalletValueRefresherFactory = options.looperWalletValueRefresherFactory
    ?? createLooperWalletValueRefresher;
  const looperWalletValuesLoaderFactory = options.looperWalletValuesLoaderFactory
    ?? createLooperWalletValuesLoader;
  const apiFactory = options.apiFactory ?? createMultipassApi;
  const consoleCreditService = options.consoleCreditService ?? (parsed.consoleCreditEnabled
    ? createConsoleCreditService({
      fetchImpl: parsed.fetchImpl ?? fetch,
      apiBaseUrl: parsed.consoleCreditApiBaseUrl,
      credBaseUrl: parsed.consoleCreditCredBaseUrl,
      minCredScore: parsed.consoleCreditMinCred,
      allowedTokenIds: parsed.consoleCreditAllowedLoopers,
      requestTimeoutMs: parsed.consoleCreditTimeoutMs,
    })
    : null);
  const restapPolicyLoader = options.restapPolicyLoader ?? loadRestap3802Policy;
  const restapPolicyAuthorizer = options.restapPolicyAuthorizer ?? authorizeRestap3802Policy;
  const restapPublicSessionStoreFactory = options.restapPublicSessionStoreFactory ?? createRestapPublicSessionStore;
  const restapInferenceClientFactory = options.restapInferenceClientFactory ?? createBankrRestapInferenceClient;
  const restapPublicTalkRuntimeFactory = options.restapPublicTalkRuntimeFactory ?? createRestapPublicTalkRuntime;
  const restapNewsStoreFactory = options.restapNewsStoreFactory ?? createRestapNewsStore;
  const restapNewsAuthenticatorFactory = options.restapNewsAuthenticatorFactory ?? createRestapNewsAuthenticator;
  const restapNetworkSignerLoader = options.restapNetworkSignerLoader ?? loadRestapNetworkFileSigner;
  const restapNetworkServiceFactory = options.restapNetworkServiceFactory ?? startRestapNetworkService;
  let api;
  let listeningUrl;
  let apiBaseUrl = parsed.publicBaseUrl ?? (parsed.port === 0 ? null : `http://${parsed.host}:${parsed.port}`);
  let consoleBootstrap;
  let looperCodexRuntime;
  let looperMarketplaceListingsLoader = typeof options.looperMarketplaceListingsLoader === 'function'
    ? options.looperMarketplaceListingsLoader
    : null;
  let looperMarketplacePreviewLoader = typeof options.looperMarketplacePreviewLoader === 'function'
    ? options.looperMarketplacePreviewLoader
    : null;
  let looperMarketplaceWalletValuesLoader = typeof options.looperMarketplaceWalletValuesLoader === 'function'
    ? options.looperMarketplaceWalletValuesLoader
    : null;
  let restapPublicSessions;
  let restapNewsStore;
  let restapNetworkSigner;
  let restapNetworkService;
  let restapNetworkProductionFoundation;
  let restapVerifiedSendService = options.restapVerifiedSendService ?? null;
  let swarmLaunchConsentService = options.swarmLaunchConsentService ?? null;
  let swarmInvitationService = options.swarmInvitationService ?? null;
  let closePromise = null;

  const nodeServer = http.createServer(async (req, res) => {
    try {
      const requestInit = {
        method: req.method || 'GET',
        headers: sanitizeRestapProxyHeaders(req.headers, {
          remoteAddress: req.socket?.remoteAddress,
          trustLoopbackProxy: parsed.restapTrustLoopbackProxy,
        }),
      };
      if (!['GET', 'HEAD'].includes(requestInit.method.toUpperCase())) {
        requestInit.body = req;
        requestInit.duplex = 'half';
      }
      const request = new Request(new URL(req.url || '/', apiBaseUrl), requestInit);
      const response = await api.handleRequest(request);
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      if (requestInit.method.toUpperCase() === 'HEAD') {
        res.end();
      } else {
        res.end(Buffer.from(await response.arrayBuffer()));
      }
    } catch {
      res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        schema_version: '0.1.0',
        error: {
          code: 'server_error',
          message: 'Internal server error.',
        },
      }));
    }
  });

  try {
    if (!looperMarketplaceListingsLoader) {
      try {
        const apiKey = await openSeaApiKeyLoader(parsed.openseaConfigPath);
        const candidate = looperMarketplaceListingsLoaderFactory({
          apiKey,
          fetchImpl: parsed.fetchImpl ?? fetch,
        });
        looperMarketplaceListingsLoader = typeof candidate === 'function' ? candidate : null;
      } catch {
        looperMarketplaceListingsLoader = null;
      }
    }

    if (!looperMarketplaceWalletValuesLoader && parsed.looperMarketplaceRosterPath) {
      const refresh = looperWalletValueRefresherFactory({
        rosterPath: parsed.looperMarketplaceRosterPath,
        fetchImpl: parsed.fetchImpl ?? fetch,
      });
      looperMarketplaceWalletValuesLoader = looperWalletValuesLoaderFactory({ refresh });
    }

    const codexStartedAt = Date.now();
    const codexStartingRss = process.memoryUsage().rss;
    looperCodexRuntime = options.looperCodexRuntime ?? await looperCodexRuntimeFactory({
      artifactPath: parsed.looperCodexArtifactPath,
      logger: {},
    });
    const codexStatus = looperCodexRuntime?.status ?? { available: false };
    logServerEvent(options.logger ?? console, codexStatus.available ? 'info' : 'warn', {
      event: 'looper_codex_startup',
      available: codexStatus.available === true,
      schemaVersion: safeStartupString(codexStatus.schemaVersion),
      artifactHashPrefix: safeHashPrefix(codexStatus.artifactHash),
      count: Number.isSafeInteger(codexStatus.count) ? codexStatus.count : null,
      loadMs: Date.now() - codexStartedAt,
      rssDeltaBytes: process.memoryUsage().rss - codexStartingRss,
    });

    let restapNetworkDependencies = {};
    if (!options.restapNetworkService && parsed.restapNetworkServiceConfig.gates.foundation) {
      if (Object.hasOwn(options, 'restapNetworkDependencies')) {
        restapNetworkDependencies = {
          ...(options.restapNetworkDependencies ?? {}),
          codexRuntime: options.restapNetworkDependencies?.codexRuntime ?? looperCodexRuntime,
        };
      } else {
        restapNetworkProductionFoundation = await createRestapNetworkProductionFoundation({
          config: parsed.restapNetworkServiceConfig,
          productionConfig: parsed.restapNetworkProductionConfig,
          codexRuntime: looperCodexRuntime,
          publicClients: parsed.loopersPublicClients ?? null,
          bankrLlmKey: parsed.bankrLlmKey,
          bankrReadonlyApiKey: parsed.bankrReadonlyApiKey,
          bankrModel: parsed.bankrLlmModel,
          fetchImpl: parsed.fetchImpl ?? fetch,
          keyRegistryLoader: options.restapNetworkKeyRegistryLoader,
          signerLoader: options.restapNetworkProductionSignerLoader,
        });
        restapNetworkDependencies = restapNetworkProductionFoundation.dependencies;
      }
    }
    restapNetworkService = options.restapNetworkService ?? await restapNetworkServiceFactory({
      config: parsed.restapNetworkServiceConfig,
      dependencies: restapNetworkDependencies,
    });
    if (!restapNetworkService || typeof restapNetworkService.close !== 'function') throw new Error('RESTAP network service is unavailable.');

    const consoleBootstrapOptions = { ...parsed };
    delete consoleBootstrapOptions.restapNetworkServiceConfig;
    delete consoleBootstrapOptions.restapNetworkProductionConfig;
    delete consoleBootstrapOptions.restapNetworkSignerFile;
    if (restapNetworkProductionFoundation) {
      consoleBootstrapOptions.restapNetworkStore = restapNetworkProductionFoundation.store;
      consoleBootstrapOptions.restapNetworkCustodyReconciler = restapNetworkProductionFoundation.custodyReconciler;
      if (restapNetworkProductionFoundation.activationLeaseService) {
        consoleBootstrapOptions.restapNetworkActivationLeases = restapNetworkProductionFoundation.activationLeaseService;
        consoleBootstrapOptions.restapNetworkLeasesAlreadyLoaded = true;
      }
    }
    delete consoleBootstrapOptions.restapNetworkSignerRequired;
    consoleBootstrap = await consoleBootstrapFactory({
      ...consoleBootstrapOptions,
      logger: options.logger ?? console,
    });
    if (!swarmLaunchConsentService && swarmLaunchConsentStore) {
      const consentCredClient = createLooperCredClient({
        baseUrl: parsed.loopersCredApiBaseUrl,
        fetchImpl: parsed.fetchImpl ?? fetch,
        timeoutMs: parsed.loopersCredTimeoutMs,
      });
      const consentOwnedAgentLoader = async (input) => enrichOwnedLoopersWithCred(
        await consoleBootstrap.ownedAgentLoader(input),
        { credClient: consentCredClient, concurrency: parsed.loopersCredConcurrency },
      );
      swarmLaunchConsentService = createSwarmLaunchConsentService({
        store: swarmLaunchConsentStore,
        preview: (input) => previewSwarmLaunch({ ...input, loadOwnedAgents: consentOwnedAgentLoader }),
        authorizeLooper: consoleBootstrap.authorizeLooper,
        verifySignature: options.signatureVerifier ?? verifyEthereumPersonalSignature,
        createId: () => 'consent-' + randomUUID(),
      });
    }
    if (!swarmInvitationService && swarmInvitationStore) {
      const invitationProviders = options.swarmInvitationProviders ?? createCredifiOwnerOptInProviders();
      const invitationAuthority = options.swarmInvitationAuthority ?? createSwarmInvitationAuthorityVerifier({ providers: invitationProviders, timeoutMs: 15_000 });
      swarmInvitationService = createSwarmInvitationService({
        store: swarmInvitationStore,
        authority: invitationAuthority,
        createId: (kind) => kind + '_' + randomBytes(32).toString('hex'),
      });
    }

    restapNetworkSigner = options.restapNetworkSigner ?? null;
    if (restapNetworkSigner !== null && !isRestapNetworkSigner(restapNetworkSigner)) throw new Error('RESTAP network signer unavailable.');
    if (parsed.restapNetworkSignerRequired && restapNetworkSigner === null) {
      if (!parsed.restapNetworkSignerFile) throw new Error('RESTAP network signer unavailable.');
      try { restapNetworkSigner = await restapNetworkSignerLoader({ filePath: parsed.restapNetworkSignerFile }); }
      catch { throw new Error('RESTAP network signer unavailable.'); }
      if (!isRestapNetworkSigner(restapNetworkSigner)) throw new Error('RESTAP network signer unavailable.');
    }

    const verifiedSendEnabled = parsed.restapNetworkProductionConfig?.verifiedSend?.enabled === true;
    const needsRestapPolicy = parsed.restapDiscoveryEnabled || parsed.restapTalkEnabled || parsed.restapNewsWriteEnabled || verifiedSendEnabled;
    const needsRestapTalkRuntime = parsed.restapTalkEnabled || verifiedSendEnabled;
    const needsRestapNews = parsed.restapNewsWriteEnabled || parsed.restapNewsReadEnabled;
    let restapPolicy;
    let restapAuthorityResolver;
    let restap3802Policy;
    let restapTalkRuntime;
    let restapInferenceClient;
    let restapNewsAuthenticator;

    if (needsRestapPolicy) {
      if (!parsed.restap3802PolicyPath) throw new Error('RESTAP 3802 policy path is required for enabled public surfaces.');
      if (!looperCodexRuntime?.available || typeof looperCodexRuntime.getProfileContext !== 'function') {
        throw new Error('An available pinned RESTAP Codex runtime is required.');
      }
      restapPolicy = await restapPolicyLoader({ policyPath: parsed.restap3802PolicyPath });
      restapAuthorityResolver = options.restapAuthorityResolver
        ?? createRestapAuthorityResolver({ policy: restapPolicy, publicClients: consoleBootstrap.publicClients });
      if (typeof restapAuthorityResolver !== 'function') throw new Error('RESTAP authority resolver is required for enabled public surfaces.');
      const authorize = async ({ surface } = {}) => {
        let codexProfile;
        const projection = await restapPolicyAuthorizer({
          policy: restapPolicy,
          resolveAuthority: restapAuthorityResolver,
          loadCodexProfile: async (tokenId) => {
            codexProfile = looperCodexRuntime.getProfileContext(Number(tokenId));
            return codexProfile;
          },
        });
        const publicProjection = Object.freeze({
          canonicalIdentity: projection.canonicalIdentity,
          ownerPublicProfile: projection.ownerPublicProfile,
        });
        if (surface !== 'discovery') return Object.freeze({ publicProjection });
        return Object.freeze({
          publicProjection,
          discovery: buildRestap3802Discovery({
            publicBaseUrl: apiBaseUrl,
            codexProfile,
            ownerProfile: projection.ownerPublicProfile,
            contact: new URL(apiBaseUrl).origin,
            availability: {
              discovery: parsed.restapDiscoveryEnabled,
              talk: parsed.restapTalkEnabled,
              newsWrite: parsed.restapNewsWriteEnabled,
              newsRead: parsed.restapNewsReadEnabled,
            },
          }),
        });
      };
      restap3802Policy = Object.freeze({ authorize });
      await authorize({ surface: 'startup' });
    }

    if (needsRestapTalkRuntime) {
      restapPublicSessions = options.restapPublicSessions ?? restapPublicSessionStoreFactory();
      restapInferenceClient = options.restapInferenceClient ?? restapInferenceClientFactory({
        apiKey: parsed.bankrLlmKey,
        model: parsed.restapTalkModel ?? undefined,
        timeoutMs: parsed.restapTalkTimeoutMs,
        fetchImpl: parsed.fetchImpl ?? fetch,
      });
      if (!restapInferenceClient || typeof restapInferenceClient.generate !== 'function') {
        throw new Error('RESTAP talk requires a dedicated inference client.');
      }
      restapTalkRuntime = options.restapTalkRuntime ?? restapPublicTalkRuntimeFactory({
        codexRuntime: looperCodexRuntime,
        sessionStore: restapPublicSessions,
        inferenceClient: restapInferenceClient,
      });
    }

    if (verifiedSendEnabled && restapVerifiedSendService === null) {
      const dependencies = restapNetworkProductionFoundation?.verifiedSendDependencies;
      if (!dependencies) throw new Error('RESTAP verified-send production dependencies are unavailable.');
      const recipientRuntimes = Object.freeze(Object.fromEntries(dependencies.config.recipientTokenIds.map((tokenId) => [
        tokenId,
        tokenId === '3802' || options.restapTalkRuntime ? restapTalkRuntime : restapPublicTalkRuntimeFactory({
          codexRuntime: looperCodexRuntime, sessionStore: restapPublicSessions, inferenceClient: restapInferenceClient, tokenId,
        }),
      ])));
      const composition = composeRestapVerifiedSendProduction({
        ...dependencies,
        recipientRuntimes,
        resolvePublicProjection: async ({ tokenId }) => {
          if (tokenId === '3802') {
            const authorization = await restap3802Policy.authorize({ surface: 'talk' });
            return authorization.publicProjection;
          }
          const profile = looperCodexRuntime.getProfileContext(Number(tokenId));
          if (String(profile?.identity?.tokenId) !== tokenId || !profile?.identity?.canonicalName || !profile?.identity?.image?.url) throw new Error('RESTAP verified-send recipient is unavailable.');
          return Object.freeze({
            canonicalIdentity: Object.freeze({ canonicalName: profile.identity.canonicalName, imageUrl: profile.identity.image.url }),
            ownerPublicProfile: Object.freeze({
              displayName: profile.identity.canonicalName, publicConversationEnabled: true,
              biography: 'Public RESTAP identity for ' + profile.identity.canonicalName + '.',
              mission: 'Discuss verified Looper traits and collection context.',
              voicePresentation: 'Concise, factual, and bounded.',
            }),
          });
        },
      });
      restapVerifiedSendService = composition.service;
    }

    if (needsRestapNews) {
      if (!parsed.databasePath) throw new Error('RESTAP news requires a persistent database.');
      restapNewsStore = options.restapNewsStore ?? restapNewsStoreFactory({ databasePath: parsed.databasePath });
      if (!restapNewsStore || typeof restapNewsStore.list !== 'function') throw new Error('RESTAP news store is unavailable.');
    }

    if (parsed.restapNewsWriteEnabled) {
      const enabledSenders = restapPolicy.newsSenders.filter((sender) => sender.enabled === true);
      if (enabledSenders.length === 0) throw new Error('RESTAP news write requires at least one enabled sender.');
      const restapResolveErc8004Controller = options.restapResolveErc8004Controller
        ?? createRestapErc8004ControllerResolver(consoleBootstrap.publicClients);
      if (enabledSenders.some((sender) => sender.kind === 'erc8004') && typeof restapResolveErc8004Controller !== 'function') {
        throw new Error('RESTAP news write requires an ERC-8004 controller verifier.');
      }
      restapNewsAuthenticator = options.restapNewsAuthenticator ?? restapNewsAuthenticatorFactory({
        policy: restapPolicy,
        verifyEip1271: options.restapVerifyEip1271 ?? createRestapEip1271Verifier(consoleBootstrap.publicClients),
        resolveErc8004Controller: restapResolveErc8004Controller,
      });
      if (!restapNewsAuthenticator || typeof restapNewsAuthenticator.authenticate !== 'function') {
        throw new Error('RESTAP news signature verifier is unavailable.');
      }
    }

    if (parsed.restapDiscoveryEnabled || parsed.restapTalkEnabled || parsed.restapNewsWriteEnabled || parsed.restapNewsReadEnabled) {
      logServerEvent(options.logger ?? console, 'info', {
        event: 'restap_3802_startup',
        tokenId: '3802',
        discovery: parsed.restapDiscoveryEnabled,
        talk: parsed.restapTalkEnabled,
        newsWrite: parsed.restapNewsWriteEnabled,
        newsRead: parsed.restapNewsReadEnabled,
        ...(parsed.restapNewsWriteEnabled ? { enabledSenderCount: restapPolicy.newsSenders.filter((sender) => sender.enabled === true).length } : {}),
        ...(parsed.restapDiscoveryEnabled || parsed.restapTalkEnabled ? { codexHashPrefix: safeHashPrefix(codexStatus.artifactHash) } : {}),
      });
    }

    if (!looperMarketplacePreviewLoader && Array.isArray(consoleBootstrap.publicClients) && consoleBootstrap.publicClients.length > 0) {
      looperMarketplacePreviewLoader = createLooperMarketplacePreviewLoader({
        publicClients: consoleBootstrap.publicClients,
        listingsLoader: looperMarketplaceListingsLoader,
        fetchImpl: parsed.fetchImpl ?? fetch,
      });
    }

    const createApi = () => apiFactory({
      store,
      baseUrl: apiBaseUrl,
      savedRecords,
      missionService,
      swarmLaunchConsentService,
      swarmInvitationService,
      looperNameStore,
      activationService,
      allowedOrigins: parsed.allowedOrigins,
      adminSecret: parsed.adminSecret,
      cookieSecure: parsed.cookieSecure,
      loopersAllowlist,
      loopersAllowlistSnapshot,
      loopersAllowlistRegistrationPaused: parsed.loopersAllowlistRegistrationPaused,
      loopersAllowlistRequireBrowserOrigin: parsed.loopersAllowlistRequireBrowserOrigin,
      loopersAllowlistBlockedSources: parsed.loopersAllowlistBlockedSources,
      loopersAllowlistRateLimit: parsed.loopersAllowlistRateLimit,
      loopersAllowlistSubnetRateLimit: parsed.loopersAllowlistSubnetRateLimit,
      loopersAllowlistGlobalRateLimit: parsed.loopersAllowlistGlobalRateLimit,
      loopersTurnstileSecretKey: parsed.loopersTurnstileSecretKey,
      looperMarketplaceListingsLoader,
      looperMarketplacePreviewLoader,
      looperMarketplaceWalletValuesLoader,
      loopersCredApiBaseUrl: parsed.loopersCredApiBaseUrl,
      loopersCredTimeoutMs: parsed.loopersCredTimeoutMs,
      loopersCredConcurrency: parsed.loopersCredConcurrency,
      loopersOwnedAgentLoader: consoleBootstrap.ownedAgentLoader,
      loopersPublicClients: consoleBootstrap.publicClients,
      loopersAuthorizer: consoleBootstrap.authorizeLooper,
      consoleAuthStore: options.consoleAuthStore,
      consoleCreditService,
      credifiOwnerOptInService,
      credifiOwnerOptInVerifier,
      consoleRuntimeRegistry: consoleBootstrap.runtimeRegistry,
      restapNetworkActivationLeases: consoleBootstrap.activationLeases,
      restapNetworkCustodyReconciler: consoleBootstrap.restapNetworkCustodyReconciler,
      consoleXmtpClient: consoleBootstrap.publishingClient,
      consoleAgentRuntime: consoleBootstrap.runtime,
      looperCodexRuntime,
      restapNetworkService,
      restapVerifiedSendService,
      restapDiscoveryEnabled: parsed.restapDiscoveryEnabled,
      restapTalkEnabled: parsed.restapTalkEnabled,
      restap3802Policy,
      restap3802AuthorityResolver: restapAuthorityResolver,
      restapTalkRuntime,
      restapNewsWriteEnabled: parsed.restapNewsWriteEnabled,
      restapNewsReadEnabled: parsed.restapNewsReadEnabled,
      restapNewsStore,
      restapNewsAuthenticator,
      restapTalkLimits: parsed.restapTalkLimits,
      logger: options.logger ?? console,
      fetchImpl: parsed.fetchImpl,
    });
    if (apiBaseUrl) api = createApi();

    await new Promise((resolve, reject) => {
      nodeServer.once('error', reject);
      nodeServer.listen(parsed.port, parsed.host, resolve);
    });
    const address = nodeServer.address();
    const port = typeof address === 'object' && address ? address.port : parsed.port;
    listeningUrl = `http://${parsed.host}:${port}`;
    apiBaseUrl = parsed.publicBaseUrl ?? listeningUrl;
    if (!api) api = createApi();
  } catch (error) {
    if (!restapNetworkService) await Promise.resolve(restapNetworkProductionFoundation?.closeOnStartupFailure?.()).catch(() => {});
    await closeServerResources({
      consoleBootstrap,
      nodeServer,
      restapPublicSessions,
      restapNewsStore,
      restapNetworkService,
      savedRecords,
      ownsSavedRecords,
      credifiOwnerOptInService,
      ownsCredifiOwnerOptInService,
      looperNameStore,
      ownsLooperNameStore,
      missionStore,
      ownsMissionStore,
      swarmLaunchConsentStore,
      ownsSwarmLaunchConsentStore,
      swarmInvitationStore,
      ownsSwarmInvitationStore,
    }).catch(() => {});
    throw error;
  }

  const address = nodeServer.address();
  const port = typeof address === 'object' && address ? address.port : parsed.port;

  return {
    fixtureName,
    host: parsed.host,
    port,
    url: listeningUrl,
    publicBaseUrl: apiBaseUrl,
    databasePath: parsed.databasePath,
    loopersAllowlistPath: parsed.loopersAllowlistPath,
    loopersAllowlistSnapshotPath: parsed.loopersAllowlistSnapshotPath,
    console: consoleBootstrap,
    restapNetwork: restapNetworkService,
    restapVerifiedSend: restapVerifiedSendService,
    server: nodeServer,
    close() {
      if (!closePromise) {
        closePromise = closeServerResources({
          consoleBootstrap,
          nodeServer,
          restapPublicSessions,
          restapNewsStore,
          restapNetworkService,
          savedRecords,
          ownsSavedRecords,
          credifiOwnerOptInService,
          ownsCredifiOwnerOptInService,
          looperNameStore,
          ownsLooperNameStore,
          missionStore,
          ownsMissionStore,
          swarmLaunchConsentStore,
          ownsSwarmLaunchConsentStore,
          swarmInvitationStore,
          ownsSwarmInvitationStore,
        });
      }
      return closePromise;
    },
  };
}

async function closeServerResources({ consoleBootstrap, nodeServer, restapPublicSessions, restapNewsStore, restapNetworkService, savedRecords, ownsSavedRecords, credifiOwnerOptInService, ownsCredifiOwnerOptInService, looperNameStore, ownsLooperNameStore, missionStore, ownsMissionStore, swarmLaunchConsentStore, ownsSwarmLaunchConsentStore, swarmInvitationStore, ownsSwarmInvitationStore }) {
  const errors = [];
  for (const close of [
    () => closeHttpServer(nodeServer),
    () => restapNetworkService?.close?.(),
    () => consoleBootstrap?.stopWorker?.(),
    () => restapPublicSessions?.close?.(),
    () => restapNewsStore?.close?.(),
    () => consoleBootstrap?.closeClient?.(),
    () => ownsSavedRecords ? savedRecords?.close?.() : undefined,
    () => ownsCredifiOwnerOptInService ? credifiOwnerOptInService?.close?.() : undefined,
    () => ownsLooperNameStore ? looperNameStore?.close?.() : undefined,
    () => ownsMissionStore ? missionStore?.close?.() : undefined,
    () => ownsSwarmLaunchConsentStore ? swarmLaunchConsentStore?.close?.() : undefined,
    () => ownsSwarmInvitationStore ? swarmInvitationStore?.close?.() : undefined,
  ]) {
    try {
      await close();
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length) throw new AggregateError(errors, 'Multipass server shutdown failed.');
}



function createRestapAuthorityResolver({ policy, publicClients } = {}) {
  const clients = Array.isArray(publicClients) ? publicClients.filter((client) => typeof client?.readContract === 'function') : [];
  if (!policy?.authority || clients.length === 0) return null;
  return async function resolveRestapAuthority() {
    const owner = await readRestapContract(clients, {
      address: policy.authority.collection,
      abi: [{ type: 'function', name: 'ownerOf', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'address' }] }],
      functionName: 'ownerOf',
      args: [3802n],
    });
    const agentId = await readRestapContract(clients, {
      address: policy.authority.collection,
      abi: [{ type: 'function', name: 'erc8004AgentIdByLooper', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'uint256' }] }],
      functionName: 'erc8004AgentIdByLooper',
      args: [3802n],
    });
    const controllerVerified = await readRestapContract(clients, {
      address: '0x270d25D2c59A8bcA1B0f40ad95fF7806c0025c27',
      abi: [{ type: 'function', name: 'isController', stateMutability: 'view', inputs: [{ name: 'agentId', type: 'uint256' }, { name: 'controller', type: 'address' }], outputs: [{ type: 'bool' }] }],
      functionName: 'isController',
      args: [BigInt(agentId), policy.authority.controller],
    });
    return Object.freeze({
      chainId: 8453,
      contract: policy.authority.collection,
      tokenId: '3802',
      owner,
      erc8004AgentId: String(agentId),
      controller: policy.authority.controller,
      controllerVerified: controllerVerified === true,
    });
  };
}

function createRestapEip1271Verifier(publicClients) {
  const clients = Array.isArray(publicClients) ? publicClients.filter((client) => typeof client?.verifyMessage === 'function') : [];
  if (clients.length === 0) return undefined;
  return async (input) => {
    let lastError;
    for (const client of clients) {
      try { return await client.verifyMessage(input); } catch (error) { lastError = error; }
    }
    throw lastError ?? new Error('RESTAP signature verification unavailable.');
  };
}

function createRestapErc8004ControllerResolver(publicClients) {
  const clients = Array.isArray(publicClients) ? publicClients.filter((client) => typeof client?.readContract === 'function') : [];
  if (clients.length === 0) return undefined;
  return ({ registry, agentId }) => readRestapContract(clients, {
    address: registry,
    abi: [{ type: 'function', name: 'getAgentWallet', stateMutability: 'view', inputs: [{ name: 'agentId', type: 'uint256' }], outputs: [{ type: 'address' }] }],
    functionName: 'getAgentWallet',
    args: [BigInt(agentId)],
  });
}

async function readRestapContract(clients, request) {
  let lastError;
  for (const client of clients) {
    try { return await client.readContract(request); } catch (error) { lastError = error; }
  }
  throw lastError ?? new Error('RESTAP chain dependency unavailable.');
}

function closeHttpServer(server) {
  if (!server?.listening) return Promise.resolve();
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

export function sanitizeRestapProxyHeaders(headers, { remoteAddress, trustLoopbackProxy = false } = {}) {
  const normalized = normalizeHeaders(headers);
  delete normalized['x-multipass-client-ip'];

  const peerAddress = normalizeIp(remoteAddress);
  let clientAddress = peerAddress;
  if (trustLoopbackProxy === true && isLoopbackAddress(peerAddress)) {
    const forwardedCandidates = [
      normalized['cf-connecting-ip'],
      normalized['x-real-ip'],
      normalized['x-forwarded-for'],
    ].filter((value) => value !== undefined);
    if (forwardedCandidates.length === 1) {
      const candidate = normalizeSingleForwardedIp(forwardedCandidates[0]);
      if (candidate) clientAddress = candidate;
    }
  }
  if (clientAddress) normalized['x-multipass-client-ip'] = clientAddress;
  return normalized;
}

function normalizeHeaders(headers) {
  return Object.fromEntries(
    Object.entries(headers)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key.toLowerCase(), Array.isArray(value) ? value.join(', ') : String(value)]),
  );
}

function normalizeSingleForwardedIp(value) {
  const candidate = String(value ?? '').trim();
  if (!candidate || candidate.includes(',') || /[\u0000-\u0020\u007f]/u.test(candidate)) return null;
  return normalizeIp(candidate);
}

function normalizeIp(value) {
  const candidate = String(value ?? '').trim();
  return isIP(candidate) ? candidate : null;
}

function isLoopbackAddress(value) {
  if (!value) return false;
  if (value === '::1') return true;
  const ipv4 = value.startsWith('::ffff:') ? value.slice(7) : value;
  if (isIP(ipv4) !== 4) return false;
  const first = Number(ipv4.split('.')[0]);
  return first === 127;
}

function isRestapNetworkSigner(value) {
  return value !== null && typeof value === 'object'
    && typeof value.keyId === 'string' && /^[A-Za-z0-9_-]{32,128}$/u.test(value.keyId)
    && typeof value.sign === 'function';
}

function parsePort(value, fallback, source) {
  if (value === undefined || value === null || value === '') return fallback;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid port for ${source}: ${value}`);
  }
  return port;
}

function parseOriginList(value) {
  return parseStringList(value);
}

function parseStringList(value) {
  return String(value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseCanonicalTokenIdList(value, source) {
  const entries = Array.isArray(value) ? value : parseStringList(value);
  const normalized = [];
  const seen = new Set();
  for (const entry of entries) {
    const tokenId = String(entry ?? '').trim();
    if (!/^[1-9]\d*$/u.test(tokenId)) throw new Error('Invalid Looper token ID for ' + source + ': ' + entry);
    if (!seen.has(tokenId)) { seen.add(tokenId); normalized.push(tokenId); }
  }
  return normalized;
}

function normalizeOptionalBaseUrl(value, source) {
  if (value === undefined || value === null || value === '') return null;
  try {
    const url = new URL(String(value));
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('unsupported protocol');
    }
    return url.href.endsWith('/') ? url.href.slice(0, -1) : url.href;
  } catch {
    throw new Error(`Invalid URL for ${source}: ${value}`);
  }
}

function parseStrictBoolean(value, source) {
  if (value === undefined || value === null || value === '') return null;
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  throw new Error(`Invalid boolean for ${source}: ${value}`);
}

function parseOptionalBoundedString(value, source, maximumBytes) {
  if (value === undefined || value === null || value === '') return null;
  const normalized = String(value).trim();
  if (!normalized || Buffer.byteLength(normalized, 'utf8') > maximumBytes || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new Error(`Invalid value for ${source}.`);
  }
  return normalized;
}

function parseOptionalBoolean(value, source) {
  if (value === undefined || value === null || value === '') return null;
  if (['1', 'true', 'yes'].includes(String(value).toLowerCase())) return true;
  if (['0', 'false', 'no'].includes(String(value).toLowerCase())) return false;
  throw new Error(`Invalid boolean for ${source}: ${value}`);
}

function parseOptionalPositiveInteger(value, source) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid positive integer for ${source}: ${value}`);
  }
  return parsed;
}

function parseBoundedPositiveInteger(value, fallback, source, max) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = parseOptionalPositiveInteger(value, source);
  if (parsed > max) throw new Error(`Invalid positive integer for ${source}: ${value}`);
  return parsed;
}

function parseBoundedNonnegativeInteger(value, fallback, source, max) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > max) {
    throw new Error(`Invalid non-negative integer for ${source}: ${value}`);
  }
  return parsed;
}

function parseRateLimitConfig({ limit, windowSeconds } = {}, sourcePrefix) {
  const parsedLimit = parseOptionalPositiveInteger(limit, `${sourcePrefix}_LIMIT`);
  const parsedWindowSeconds = parseOptionalPositiveInteger(windowSeconds, `${sourcePrefix}_WINDOW_SECONDS`);
  if (parsedLimit === null && parsedWindowSeconds === null) return undefined;
  return {
    ...(parsedLimit !== null ? { limit: parsedLimit } : {}),
    ...(parsedWindowSeconds !== null ? { windowMs: parsedWindowSeconds * 1000 } : {}),
  };
}

function safeStartupString(value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized && normalized.length <= 64 ? normalized : null;
}

function safeHashPrefix(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value)
    ? value.slice(0, 12)
    : null;
}

function logServerEvent(logger, level, event) {
  try {
    logger?.[level]?.(event);
  } catch {
    // Logging must never affect service availability.
  }
}

async function main() {
  const server = await startServer(parseServerOptions(process.argv.slice(2), process.env));
  console.log(`Multipass API server listening at ${server.url}`);
  if (server.publicBaseUrl !== server.url) console.log(`Public base URL: ${server.publicBaseUrl}`);
  console.log(`Fixture: ${server.fixtureName}`);

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Multipass API server received ${signal}; stopping.`);
    try {
      await server.close();
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
