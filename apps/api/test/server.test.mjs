import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { privateKeyToAccount } from 'viem/accounts';

import { buildSavedRecordFromHelixaAgent } from '../src/activation-records.js';
import { createAllowlistSnapshot, verifyAllowlistProof } from '../src/allowlist-snapshot.js';

import { parseServerOptions, sanitizeRestapProxyHeaders, startServer } from '../src/server.js';

test('shutdown stops HTTP intake before closing the RESTAP worker and database lifecycle', async () => {
  const events = [];
  const restapNetworkService = Object.freeze({
    status: Object.freeze({ enabled: false, gates: Object.freeze({}), transcriptCapability: 'unavailable' }),
    async close() { events.push('restap:close'); },
  });
  const server = await startServer({ fixture: 'generic', host: '127.0.0.1', port: 0, restapNetworkService });
  server.server.once('close', () => events.push('http:close'));

  await server.close();

  assert.deepEqual(events.slice(0, 2), ['http:close', 'restap:close']);
});

test('parseServerOptions returns safe defaults', () => {
  assert.deepEqual(parseServerOptions([], {}), {
    fixture: 'generic',
    host: '127.0.0.1',
    port: 8787,
    databasePath: null,
    allowedOrigins: [],
    adminSecret: null,
    cookieSecure: null,
    publicBaseUrl: null,
    openseaConfigPath: path.join(os.homedir(), '.config/opensea/config.json'),
    loopersAllowlistPath: null,
    loopersAllowlistSnapshotPath: null,
    looperCodexArtifactPath: null,
    looperMarketplaceRosterPath: null,
    loopersAllowlistRegistrationPaused: false,
    loopersAllowlistRequireBrowserOrigin: false,
    loopersAllowlistBlockedSources: [],
    loopersAllowlistRateLimit: undefined,
    loopersAllowlistSubnetRateLimit: undefined,
    loopersAllowlistGlobalRateLimit: undefined,
    loopersTurnstileSecretKey: null,
    loopersCredApiBaseUrl: 'https://api.helixa.xyz',
    loopersCredTimeoutMs: 4000,
    loopersCredConcurrency: 4,
    bankrLlmKey: null,
    bankrReadonlyApiKey: null,
    bankrLlmModel: null,
    bankrLlmVisionModel: null,
    consoleAgentBankrLlmEnabled: false,
    consoleSkillProposalsEnabled: false,
    consoleMarketReadEnabled: false,
    consoleAccountReadEnabled: false,
    consoleXmtpEnabled: false,
    consoleXmtpEnv: 'production',
    consoleXmtpWalletKey: null,
    consoleXmtpDbPath: null,
    consoleXmtpDbEncryptionKey: null,
    consoleXmtpHistorySyncUrl: null,
    consoleXmtpApiUrl: null,
    consoleXmtpGatewayHost: null,
    consoleXmtpAppVersion: 'multipass-console',
    restapDiscoveryEnabled: false,
    restapTalkEnabled: false,
    restapNewsWriteEnabled: false,
    restapNewsReadEnabled: false,
    restapTrustLoopbackProxy: false,
    restapNetworkSignerFile: null,
    restap3802PolicyPath: null,
    restapTalkModel: null,
    restapTalkTimeoutMs: 15000,
    restapTalkLimits: {
      perIpPerMinute: 20,
      perSessionPerMinute: 10,
      globalPerDay: 10000,
      concurrency: 4,
    },
  });
});

test('CLI flags override environment values', () => {
  assert.deepEqual(
    parseServerOptions(['--fixture', 'bendr', '--host', '0.0.0.0', '--port', '9000'], {
      MULTIPASS_FIXTURE: 'generic',
      HOST: '127.0.0.1',
      PORT: '8787',
    }),
    {
      fixture: 'bendr',
      host: '0.0.0.0',
      port: 9000,
      databasePath: null,
      allowedOrigins: [],
      adminSecret: null,
      cookieSecure: null,
      publicBaseUrl: null,
      openseaConfigPath: path.join(os.homedir(), '.config/opensea/config.json'),
      loopersAllowlistPath: null,
      loopersAllowlistSnapshotPath: null,
      looperCodexArtifactPath: null,
      looperMarketplaceRosterPath: null,
      loopersAllowlistRegistrationPaused: false,
      loopersAllowlistRequireBrowserOrigin: false,
      loopersAllowlistBlockedSources: [],
      loopersAllowlistRateLimit: undefined,
      loopersAllowlistSubnetRateLimit: undefined,
      loopersAllowlistGlobalRateLimit: undefined,
      loopersTurnstileSecretKey: null,
      loopersCredApiBaseUrl: 'https://api.helixa.xyz',
      loopersCredTimeoutMs: 4000,
      loopersCredConcurrency: 4,
      bankrLlmKey: null,
      bankrReadonlyApiKey: null,
      bankrLlmModel: null,
    bankrLlmVisionModel: null,
      consoleAgentBankrLlmEnabled: false,
      consoleSkillProposalsEnabled: false,
      consoleMarketReadEnabled: false,
      consoleAccountReadEnabled: false,
      consoleXmtpEnabled: false,
      consoleXmtpEnv: 'production',
      consoleXmtpWalletKey: null,
      consoleXmtpDbPath: null,
      consoleXmtpDbEncryptionKey: null,
      consoleXmtpHistorySyncUrl: null,
      consoleXmtpApiUrl: null,
      consoleXmtpGatewayHost: null,
      consoleXmtpAppVersion: 'multipass-console',
    restapDiscoveryEnabled: false,
    restapTalkEnabled: false,
    restapNewsWriteEnabled: false,
    restapNewsReadEnabled: false,
    restapTrustLoopbackProxy: false,
    restapNetworkSignerFile: null,
    restap3802PolicyPath: null,
    restapTalkModel: null,
    restapTalkTimeoutMs: 15000,
    restapTalkLimits: {
      perIpPerMinute: 20,
      perSessionPerMinute: 10,
      globalPerDay: 10000,
      concurrency: 4,
    },
    },
  );
});

test('parseServerOptions accepts claim management security env', () => {
  assert.deepEqual(parseServerOptions([], {
    MULTIPASS_ALLOWED_ORIGINS: 'https://helixa.xyz, https://www.helixa.xyz',
    MULTIPASS_ADMIN_SECRET: 'secret',
    MULTIPASS_COOKIE_SECURE: '1',
    MULTIPASS_PUBLIC_BASE_URL: 'https://helixa.xyz',
  }), {
    fixture: 'generic',
    host: '127.0.0.1',
    port: 8787,
    databasePath: null,
    allowedOrigins: ['https://helixa.xyz', 'https://www.helixa.xyz'],
    adminSecret: 'secret',
    cookieSecure: true,
    publicBaseUrl: 'https://helixa.xyz',
    openseaConfigPath: path.join(os.homedir(), '.config/opensea/config.json'),
    loopersAllowlistPath: null,
    loopersAllowlistSnapshotPath: null,
    looperCodexArtifactPath: null,
    looperMarketplaceRosterPath: null,
    loopersAllowlistRegistrationPaused: false,
    loopersAllowlistRequireBrowserOrigin: false,
    loopersAllowlistBlockedSources: [],
    loopersAllowlistRateLimit: undefined,
    loopersAllowlistSubnetRateLimit: undefined,
    loopersAllowlistGlobalRateLimit: undefined,
    loopersTurnstileSecretKey: null,
    loopersCredApiBaseUrl: 'https://api.helixa.xyz',
    loopersCredTimeoutMs: 4000,
    loopersCredConcurrency: 4,
    bankrLlmKey: null,
    bankrReadonlyApiKey: null,
    bankrLlmModel: null,
    bankrLlmVisionModel: null,
    consoleAgentBankrLlmEnabled: false,
    consoleSkillProposalsEnabled: false,
    consoleMarketReadEnabled: false,
    consoleAccountReadEnabled: false,
    consoleXmtpEnabled: false,
    consoleXmtpEnv: 'production',
    consoleXmtpWalletKey: null,
    consoleXmtpDbPath: null,
    consoleXmtpDbEncryptionKey: null,
    consoleXmtpHistorySyncUrl: null,
    consoleXmtpApiUrl: null,
    consoleXmtpGatewayHost: null,
    consoleXmtpAppVersion: 'multipass-console',
    restapDiscoveryEnabled: false,
    restapTalkEnabled: false,
    restapNewsWriteEnabled: false,
    restapNewsReadEnabled: false,
    restapTrustLoopbackProxy: false,
    restapNetworkSignerFile: null,
    restap3802PolicyPath: null,
    restapTalkModel: null,
    restapTalkTimeoutMs: 15000,
    restapTalkLimits: {
      perIpPerMinute: 20,
      perSessionPerMinute: 10,
      globalPerDay: 10000,
      concurrency: 4,
    },
  });
});


test('parseServerOptions configures bounded server-side Looper CRED reads without a secret', () => {
  const options = parseServerOptions([], {
    MULTIPASS_LOOPER_CRED_API_BASE_URL: 'https://cred.internal.example/root/',
    MULTIPASS_LOOPER_CRED_TIMEOUT_MS: '2500',
    MULTIPASS_LOOPER_CRED_CONCURRENCY: '3',
  });
  assert.equal(options.loopersCredApiBaseUrl, 'https://cred.internal.example/root');
  assert.equal(options.loopersCredTimeoutMs, 2500);
  assert.equal(options.loopersCredConcurrency, 3);
  assert.equal(Object.keys(options).some((key) => /cred.*(?:key|secret|token)/iu.test(key)), false);

  assert.throws(
    () => parseServerOptions([], { MULTIPASS_LOOPER_CRED_TIMEOUT_MS: '0' }),
    /MULTIPASS_LOOPER_CRED_TIMEOUT_MS/,
  );
  assert.throws(
    () => parseServerOptions([], { MULTIPASS_LOOPER_CRED_CONCURRENCY: '17' }),
    /MULTIPASS_LOOPER_CRED_CONCURRENCY/,
  );
});

test('parseServerOptions rejects invalid ports', () => {
  assert.throws(() => parseServerOptions(['--port', 'not-a-number'], {}), /Invalid port/);
  assert.throws(() => parseServerOptions([], { PORT: 'not-a-number' }), /Invalid port/);
});

test('parseServerOptions accepts database path from env or CLI', () => {
  assert.equal(parseServerOptions([], { MULTIPASS_DB_PATH: '/tmp/multipass.sqlite' }).databasePath, '/tmp/multipass.sqlite');
  assert.equal(parseServerOptions(['--database', '/tmp/cli.sqlite'], {}).databasePath, '/tmp/cli.sqlite');
});

test('parseServerOptions accepts Looper allowlist path from env or CLI', () => {
  assert.equal(parseServerOptions([], { MULTIPASS_LOOPERS_ALLOWLIST_PATH: '/tmp/loopers.json' }).loopersAllowlistPath, '/tmp/loopers.json');
  assert.equal(parseServerOptions(['--loopers-allowlist', '/tmp/cli-loopers.json'], {}).loopersAllowlistPath, '/tmp/cli-loopers.json');
});

test('parseServerOptions accepts Looper allowlist snapshot path from env or CLI', () => {
  assert.equal(parseServerOptions([], { MULTIPASS_LOOPERS_ALLOWLIST_SNAPSHOT_PATH: '/tmp/loopers-snapshot.json' }).loopersAllowlistSnapshotPath, '/tmp/loopers-snapshot.json');
  assert.equal(parseServerOptions(['--loopers-allowlist-snapshot', '/tmp/cli-loopers-snapshot.json'], {}).loopersAllowlistSnapshotPath, '/tmp/cli-loopers-snapshot.json');
});

test('parseServerOptions accepts Looper allowlist pause flag from env', () => {
  assert.equal(parseServerOptions([], { MULTIPASS_LOOPERS_ALLOWLIST_PAUSED: '1' }).loopersAllowlistRegistrationPaused, true);
  assert.equal(parseServerOptions([], { MULTIPASS_LOOPERS_ALLOWLIST_PAUSED: '0' }).loopersAllowlistRegistrationPaused, false);
});

test('parseServerOptions accepts Looper allowlist slow-mode env', () => {
  const options = parseServerOptions([], {
    MULTIPASS_LOOPERS_ALLOWLIST_REQUIRE_BROWSER_ORIGIN: '1',
    MULTIPASS_LOOPERS_ALLOWLIST_BLOCKED_SOURCES: '20260826c, bot-wave',
    MULTIPASS_LOOPERS_ALLOWLIST_RATE_LIMIT: '1',
    MULTIPASS_LOOPERS_ALLOWLIST_RATE_WINDOW_SECONDS: '600',
    MULTIPASS_LOOPERS_ALLOWLIST_SUBNET_RATE_LIMIT: '4',
    MULTIPASS_LOOPERS_ALLOWLIST_SUBNET_RATE_WINDOW_SECONDS: '600',
    MULTIPASS_LOOPERS_ALLOWLIST_GLOBAL_RATE_LIMIT: '12',
    MULTIPASS_LOOPERS_ALLOWLIST_GLOBAL_RATE_WINDOW_SECONDS: '3600',
  });
  assert.equal(options.loopersAllowlistRequireBrowserOrigin, true);
  assert.deepEqual(options.loopersAllowlistBlockedSources, ['20260826c', 'bot-wave']);
  assert.deepEqual(options.loopersAllowlistRateLimit, { limit: 1, windowMs: 600_000 });
  assert.deepEqual(options.loopersAllowlistSubnetRateLimit, { limit: 4, windowMs: 600_000 });
  assert.deepEqual(options.loopersAllowlistGlobalRateLimit, { limit: 12, windowMs: 3_600_000 });
});

test('parseServerOptions accepts Looper Turnstile secret from env', () => {
  assert.equal(parseServerOptions([], { MULTIPASS_LOOPERS_TURNSTILE_SECRET_KEY: 'secret' }).loopersTurnstileSecretKey, 'secret');
});

test('parseServerOptions keeps Bankr Console inference behind an explicit opt-in', () => {
  const defaultOptions = parseServerOptions([], {
    BANKR_LLM_KEY: 'test-key',
    MULTIPASS_AGENT_LLM_MODEL: 'test-model',
    MULTIPASS_AGENT_LLM_VISION_MODEL: 'vision-model',
  });

  assert.equal(defaultOptions.bankrLlmKey, 'test-key');
  assert.equal(defaultOptions.bankrLlmModel, 'test-model');
  assert.equal(defaultOptions.bankrLlmVisionModel, 'vision-model');
  assert.equal(defaultOptions.consoleAgentBankrLlmEnabled, false);

  const enabledOptions = parseServerOptions([], {
    BANKR_API_KEY: 'fallback-key',
    MULTIPASS_AGENT_BANKR_LLM_ENABLED: '1',
  });

  assert.equal(enabledOptions.bankrLlmKey, 'fallback-key');
  assert.equal(enabledOptions.consoleAgentBankrLlmEnabled, true);
});

test('parseServerOptions never falls back to LLM or general Bankr keys for read skills', () => {
  const absent = parseServerOptions([], {
    BANKR_LLM_KEY: 'llm-secret',
    BANKR_API_KEY: 'general-secret',
  });
  assert.equal(absent.bankrLlmKey, 'llm-secret');
  assert.equal(absent.bankrReadonlyApiKey, null);

  const separated = parseServerOptions([], {
    BANKR_LLM_KEY: 'llm-secret',
    BANKR_API_KEY: 'general-secret',
    BANKR_READONLY_API_KEY: 'readonly-secret',
  });
  assert.equal(separated.bankrLlmKey, 'llm-secret');
  assert.equal(separated.bankrReadonlyApiKey, 'readonly-secret');
});

test('parseServerOptions keeps skill proposals independently default-off and rejects malformed values', () => {
  assert.equal(parseServerOptions([], {
    MULTIPASS_AGENT_BANKR_LLM_ENABLED: '1',
  }).consoleSkillProposalsEnabled, false);
  assert.equal(parseServerOptions([], {
    MULTIPASS_CONSOLE_SKILL_PROPOSALS_ENABLED: 'true',
  }).consoleSkillProposalsEnabled, true);
  assert.equal(parseServerOptions([], {
    MULTIPASS_CONSOLE_SKILL_PROPOSALS_ENABLED: '0',
  }).consoleSkillProposalsEnabled, false);
  assert.throws(
    () => parseServerOptions([], { MULTIPASS_CONSOLE_SKILL_PROPOSALS_ENABLED: 'enabled' }),
    /Invalid boolean for MULTIPASS_CONSOLE_SKILL_PROPOSALS_ENABLED/,
  );
});

test('parseServerOptions keeps market reads independently default-off and rejects malformed values', () => {
  assert.equal(parseServerOptions([], {}).consoleMarketReadEnabled, false);
  assert.equal(parseServerOptions([], {
    MULTIPASS_CONSOLE_MARKET_READ_ENABLED: 'true',
  }).consoleMarketReadEnabled, true);
  assert.equal(parseServerOptions([], {
    MULTIPASS_CONSOLE_MARKET_READ_ENABLED: '0',
  }).consoleMarketReadEnabled, false);
  assert.throws(
    () => parseServerOptions([], { MULTIPASS_CONSOLE_MARKET_READ_ENABLED: 'enabled' }),
    /Invalid boolean for MULTIPASS_CONSOLE_MARKET_READ_ENABLED/,
  );
});

test('parseServerOptions keeps owner-account reads independently default-off and rejects malformed values', () => {
  assert.equal(parseServerOptions([], {}).consoleAccountReadEnabled, false);
  assert.equal(parseServerOptions([], {
    MULTIPASS_CONSOLE_ACCOUNT_READ_ENABLED: 'true',
  }).consoleAccountReadEnabled, true);
  assert.equal(parseServerOptions([], {
    MULTIPASS_CONSOLE_ACCOUNT_READ_ENABLED: '0',
  }).consoleAccountReadEnabled, false);
  assert.throws(
    () => parseServerOptions([], { MULTIPASS_CONSOLE_ACCOUNT_READ_ENABLED: 'enabled' }),
    /Invalid boolean for MULTIPASS_CONSOLE_ACCOUNT_READ_ENABLED/,
  );
});

test('parseServerOptions reads the Looper Codex artifact path without printing it', () => {
  const calls = [];
  const methods = ['log', 'info', 'warn', 'error'];
  const originals = Object.fromEntries(methods.map((method) => [method, console[method]]));
  for (const method of methods) console[method] = (...args) => calls.push([method, ...args]);
  try {
    const options = parseServerOptions([], {
      MULTIPASS_LOOPER_CODEX_ARTIFACT_PATH: '/srv/private/loopers-codex.json',
    });
    assert.equal(options.looperCodexArtifactPath, '/srv/private/loopers-codex.json');
    assert.deepEqual(calls, []);
  } finally {
    for (const method of methods) console[method] = originals[method];
  }
});

test('parseServerOptions resolves the shared OpenSea config path from HOME or its existing override without logging it', () => {
  const calls = [];
  const methods = ['log', 'info', 'warn', 'error'];
  const originals = Object.fromEntries(methods.map(method => [method, console[method]]));
  for (const method of methods) console[method] = (...args) => calls.push([method, ...args]);
  try {
    assert.equal(
      parseServerOptions([], { HOME: '/home/test' }).openseaConfigPath,
      '/home/test/.config/opensea/config.json',
    );
    assert.equal(
      parseServerOptions([], {
        HOME: '/home/test',
        LOOPERS_SALES_OPENSEA_CONFIG_PATH: '/run/secrets/opensea.json',
      }).openseaConfigPath,
      '/run/secrets/opensea.json',
    );
    assert.deepEqual(calls, []);
  } finally {
    for (const method of methods) console[method] = originals[method];
  }
});

test('startServer reads one OpenSea key, creates one cached marketplace loader, and injects it before API construction', async () => {
  const secretPath = '/run/secrets/opensea-private.json';
  const apiKey = 'opensea-key-do-not-log';
  const events = [];
  const listingLoader = async () => ({ listings: [] });
  let keyReads = 0;
  let factoryCalls = 0;
  let apiCalls = 0;
  let injectedLoader;
  const server = await startServer({
    fixture: 'generic', host: '127.0.0.1', port: 0, openseaConfigPath: secretPath,
    openSeaApiKeyLoader: async (configPath) => {
      keyReads += 1;
      assert.equal(configPath, secretPath);
      return apiKey;
    },
    looperMarketplaceListingsLoaderFactory: (input) => {
      factoryCalls += 1;
      assert.equal(input.apiKey, apiKey);
      assert.equal(typeof input.fetchImpl, 'function');
      return listingLoader;
    },
    apiFactory: (options) => {
      apiCalls += 1;
      injectedLoader = options.looperMarketplaceListingsLoader;
      return { async handleRequest() { return new Response('{}', { status: 200 }); } };
    },
    logger: {
      info(event) { events.push(event); },
      warn(event) { events.push(event); },
      error(event) { events.push(event); },
    },
  });
  try {
    assert.equal(keyReads, 1);
    assert.equal(factoryCalls, 1);
    assert.equal(apiCalls, 1);
    assert.equal(injectedLoader, listingLoader);
    const serializedLogs = JSON.stringify(events);
    assert.equal(serializedLogs.includes(secretPath), false);
    assert.equal(serializedLogs.includes(apiKey), false);
  } finally {
    await server.close();
  }
  assert.equal(server.server.listening, false);
});

test('startServer serves an injected marketplace loader publicly and closes cleanly without reading config', async () => {
  const snapshot = {
    schema_version: '1.0.0',
    collection: 'loopers-639312714',
    contract: '0x1649CD37f4748807b4882FC48765bA0B2aFfa94a',
    status: 'fresh',
    observed_at: '2026-10-08T14:00:00.000Z',
    listings: [],
  };
  let loaderCalls = 0;
  const server = await startServer({
    fixture: 'generic', host: '127.0.0.1', port: 0,
    looperMarketplaceListingsLoader: async () => {
      loaderCalls += 1;
      return snapshot;
    },
    openSeaApiKeyLoader: async () => { throw new Error('config reader must be bypassed'); },
    looperMarketplaceListingsLoaderFactory: () => { throw new Error('factory must be bypassed'); },
    logger: { info() {}, warn() {}, error() {} },
  });
  try {
    const response = await fetch(server.url + '/api/loopers/marketplace/listings');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), snapshot);
    assert.equal(loaderCalls, 1);
  } finally {
    await server.close();
  }
  assert.equal(server.server.listening, false);
});

test('missing or invalid marketplace config leaves the marketplace safely unavailable and other routes live', async () => {
  const sensitive = 'opensea-key upstream-private-body /run/secrets/opensea.json';
  const events = [];
  let factoryCalls = 0;
  const server = await startServer({
    fixture: 'generic', host: '127.0.0.1', port: 0,
    openseaConfigPath: '/run/secrets/opensea.json',
    openSeaApiKeyLoader: async () => { throw new Error(sensitive); },
    looperMarketplaceListingsLoaderFactory: () => {
      factoryCalls += 1;
      throw new Error('factory must not run');
    },
    logger: {
      info(event) { events.push(event); },
      warn(event) { events.push(event); },
      error(event) { events.push(event); },
    },
  });
  try {
    const unavailable = await fetch(server.url + '/api/loopers/marketplace/listings');
    const unavailableText = await unavailable.text();
    assert.equal(unavailable.status, 503);
    assert.deepEqual(JSON.parse(unavailableText), {
      schema_version: '0.1.0',
      error: {
        code: 'marketplace_unavailable',
        message: 'Looper marketplace listings are temporarily unavailable.',
      },
    });
    assert.equal(unavailableText.includes(sensitive), false);

    const liveness = await fetch(server.url + '/api/openapi.json');
    assert.equal(liveness.status, 200);
    assert.equal((await liveness.json()).openapi, '3.1.0');
    assert.equal(factoryCalls, 0);
    assert.equal(JSON.stringify(events).includes(sensitive), false);
  } finally {
    await server.close();
  }
  assert.equal(server.server.listening, false);
});

test('startServer creates one Looper Codex runtime before API construction and injects it', async () => {
  const events = [];
  const runtime = {
    available: true,
    status: {
      available: true,
      schemaVersion: '1.0.0',
      artifactHash: 'a'.repeat(64),
      codexVersion: 'traits-v1',
      count: 7_777,
    },
    query() { return {}; },
  };
  let factoryCalls = 0;
  let injected;
  const server = await startServer({
    fixture: 'generic', host: '127.0.0.1', port: 0,
    looperCodexArtifactPath: '/srv/private/loopers-codex.json',
    looperCodexRuntimeFactory: async ({ artifactPath, logger }) => {
      factoryCalls += 1;
      assert.equal(artifactPath, '/srv/private/loopers-codex.json');
      assert.deepEqual(logger, {});
      return runtime;
    },
    logger: { info(event) { events.push(event); }, warn(event) { events.push(event); } },
    consoleBootstrapFactory: async () => ({
      ownedAgentLoader: async () => [], publicClients: [], authorizeLooper: async () => ({}),
      runtimeRegistry: {}, publishingClient: {}, runtime: { async handleMessage() {} },
      async stopWorker() {}, async closeClient() {},
    }),
    apiFactory: (options) => {
      injected = options.looperCodexRuntime;
      return { async handleRequest() { return new Response('{}', { status: 200 }); } };
    },
  });
  try {
    assert.equal(factoryCalls, 1);
    assert.equal(injected, runtime);
    const codexEvent = events.find((event) => event.event === 'looper_codex_startup');
    assert.deepEqual(Object.keys(codexEvent), [
      'event', 'available', 'schemaVersion', 'artifactHashPrefix', 'count', 'loadMs', 'rssDeltaBytes',
    ]);
    assert.deepEqual(codexEvent, {
      event: 'looper_codex_startup',
      available: true,
      schemaVersion: '1.0.0',
      artifactHashPrefix: 'aaaaaaaaaaaa',
      count: 7_777,
      loadMs: codexEvent.loadMs,
      rssDeltaBytes: codexEvent.rssDeltaBytes,
    });
    assert.ok(Number.isSafeInteger(codexEvent.loadMs));
    assert.ok(Number.isSafeInteger(codexEvent.rssDeltaBytes));
    assert.equal(JSON.stringify(events).includes('/srv/private'), false);
  } finally {
    await server.close();
  }
});

test('missing or invalid Looper Codex artifacts leave established liveness, discovery, and owned-agent routes healthy', async () => {
  const account = privateKeyToAccount('0x59c6995e998f97a5a0044966f094538a7bcd1f0b03f82107863cfb2f99adc62c');
  for (const looperCodexArtifactPath of [null, '/definitely/missing/loopers-codex.json']) {
    const server = await startServer({
      fixture: 'generic', host: '127.0.0.1', port: 0, looperCodexArtifactPath,
      logger: { info() {}, warn() {} },
      consoleBootstrapFactory: async () => ({
        ownedAgentLoader: async () => [], publicClients: [], authorizeLooper: async () => ({}),
        runtimeRegistry: {}, publishingClient: {}, runtime: { async handleMessage() {} },
        async stopWorker() {}, async closeClient() {},
      }),
    });
    try {
      const health = await fetch(server.url + '/health');
      assert.equal(health.status, 404);
      assert.equal((await health.json()).error.code, 'not_found');

      const liveness = await fetch(server.url + '/api/openapi.json');
      assert.equal(liveness.status, 200);
      assert.equal((await liveness.json()).openapi, '3.1.0');

      const discovery = await fetch(server.url + '/.well-known/multipass.json');
      assert.equal(discovery.status, 200);

      const nonce = await fetch(server.url + '/api/multipass/console/session/nonce', {
        method: 'POST',
        headers: { origin: server.url, 'content-type': 'application/json' },
        body: JSON.stringify({ wallet: account.address }),
      });
      assert.equal(nonce.status, 200);
      const challenge = await nonce.json();
      const signature = await account.signMessage({ message: challenge.message });
      const verified = await fetch(server.url + '/api/multipass/console/session/verify', {
        method: 'POST',
        headers: { origin: server.url, 'content-type': 'application/json' },
        body: JSON.stringify({ wallet: account.address, nonce: challenge.nonce, signature }),
      });
      assert.equal(verified.status, 200);
      const cookie = verified.headers.get('set-cookie').split(';')[0];

      const owned = await fetch(server.url + '/api/loopers/owned', { headers: { cookie } });
      assert.equal(owned.status, 200);
      assert.deepEqual((await owned.json()).agents, []);
    } finally {
      await server.close();
    }
  }
});

test('server fallback returns a stable 500 without internal error details', async () => {
  const secret = 'https://rpc.internal.example/private?key=server-secret at /srv/private/runtime.json';
  const server = await startServer({
    fixture: 'generic', host: '127.0.0.1', port: 0,
    logger: { info() {}, warn() {} },
    consoleBootstrapFactory: async () => ({
      ownedAgentLoader: async () => [], publicClients: [], authorizeLooper: async () => ({}),
      runtimeRegistry: {}, publishingClient: {}, runtime: { async handleMessage() {} },
      async stopWorker() {}, async closeClient() {},
    }),
    apiFactory: () => ({ async handleRequest() { throw new Error(secret); } }),
  });
  try {
    const response = await fetch(server.url + '/api/openapi.json');
    const text = await response.text();
    assert.equal(response.status, 500);
    assert.deepEqual(JSON.parse(text), {
      schema_version: '0.1.0',
      error: { code: 'server_error', message: 'Internal server error.' },
    });
    assert.equal(text.includes(secret), false);
  } finally {
    await server.close();
  }
});

test('startServer composes Console and Looper CRED configuration into the correct server boundaries', async () => {
  let bootstrapOptions;
  let apiOptions;
  const runtime = { async handleMessage() {}, async getThread() { return null; } };
  const server = await startServer({
    fixture: 'generic',
    host: '127.0.0.1',
    port: 0,
    consoleAgentBankrLlmEnabled: false,
    consoleSkillProposalsEnabled: true,
    loopersCredApiBaseUrl: 'https://cred.internal.example',
    loopersCredTimeoutMs: 2500,
    loopersCredConcurrency: 3,
    consoleBootstrapFactory: async (options) => {
      bootstrapOptions = options;
      return {
        ownedAgentLoader: async () => [],
        publicClients: [],
        authorizeLooper: async () => ({}),
        runtimeRegistry: {},
        publishingClient: {},
        runtime,
        async stopWorker() {},
        async closeClient() {},
      };
    },
    apiFactory: (options) => {
      apiOptions = options;
      return {
        async handleRequest() { return new Response('{}', { status: 200 }); },
      };
    },
  });
  try {
    assert.equal(bootstrapOptions.consoleAgentBankrLlmEnabled, false);
    assert.equal(bootstrapOptions.consoleSkillProposalsEnabled, true);
    assert.equal(apiOptions.loopersCredApiBaseUrl, 'https://cred.internal.example');
    assert.equal(apiOptions.loopersCredTimeoutMs, 2500);
    assert.equal(apiOptions.loopersCredConcurrency, 3);
  } finally {
    await server.close();
  }
});

test('startServer composes the market-read flag independently of proposal mode', async () => {
  let bootstrapOptions;
  const runtime = { async handleMessage() {}, async getThread() { return null; } };
  const server = await startServer({
    fixture: 'generic', host: '127.0.0.1', port: 0,
    consoleSkillProposalsEnabled: false,
    consoleMarketReadEnabled: true,
    consoleBootstrapFactory: async (options) => {
      bootstrapOptions = options;
      return {
        ownedAgentLoader: async () => [], publicClients: [], authorizeLooper: async () => ({}),
        runtimeRegistry: {}, publishingClient: {}, runtime,
        async stopWorker() {}, async closeClient() {},
      };
    },
    apiFactory: () => ({ async handleRequest() { return new Response('{}', { status: 200 }); } }),
  });
  try {
    assert.equal(bootstrapOptions.consoleMarketReadEnabled, true);
    assert.equal(bootstrapOptions.consoleSkillProposalsEnabled, false);
  } finally {
    await server.close();
  }
});

test('startServer can advertise a public base URL while listening locally', async () => {
  const server = await startServer({ fixture: 'generic', host: '127.0.0.1', port: 0, publicBaseUrl: 'https://helixa.xyz' });

  try {
    const discovery = await fetch(`${server.url}/.well-known/multipass.json`);
    assert.equal(discovery.status, 200);
    const discoveryBody = await discovery.json();
    assert.equal(discoveryBody.routes.profile, 'https://helixa.xyz/api/multipass/{id}');
    assert.equal(discoveryBody.routes.openapi, 'https://helixa.xyz/api/openapi.json');
  } finally {
    await server.close();
  }
});

test('startServer serves discovery and profile routes on an ephemeral port', async () => {
  const server = await startServer({ fixture: 'generic', host: '127.0.0.1', port: 0 });

  try {
    assert.equal(server.fixtureName, 'generic');
    assert.match(server.url, /^http:\/\/127\.0\.0\.1:\d+$/);

    const discovery = await fetch(`${server.url}/.well-known/helixa-multipass.json`);
    assert.equal(discovery.status, 200);
    const discoveryBody = await discovery.json();
    assert.equal(discoveryBody.routes.profile, `${server.url}/api/multipass/{id}`);

    const profile = await fetch(`${server.url}/api/multipass/demo-agent`);
    assert.equal(profile.status, 200);
    const profileBody = await profile.json();
    assert.equal(profileBody.multipass_id, 'mp_demo_agent');
  } finally {
    await server.close();
  }
});

test('startServer registers and checks Looper allowlist addresses', async () => {
  const server = await startServer({
    fixture: 'generic',
    host: '127.0.0.1',
    port: 0,
    loopersAllowlistRateLimit: { limit: 5, windowMs: 60_000 },
  });
  const address = '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea';

  try {
    const register = await fetch(`${server.url}/api/loopers/allowlist/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ address: address.toLowerCase(), source: 'test' }),
    });
    assert.equal(register.status, 201);
    const registered = await register.json();
    assert.equal(registered.collection, 'loopers');
    assert.equal(registered.registered, true);
    assert.equal(registered.created, true);
    assert.equal(registered.address, address);
    assert.equal(registered.total_registered, undefined);

    const duplicate = await fetch(`${server.url}/api/loopers/allowlist/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ address, source: 'duplicate' }),
    });
    assert.equal(duplicate.status, 200);
    assert.equal((await duplicate.json()).created, false);

    const status = await fetch(`${server.url}/api/loopers/allowlist/status?address=${address}`);
    assert.equal(status.status, 200);
    const statusBody = await status.json();
    assert.equal(statusBody.collection, 'loopers');
    assert.equal(statusBody.registered, true);
    assert.equal(statusBody.entry.source, 'test');
    assert.equal(statusBody.total_registered, undefined);
  } finally {
    await server.close();
  }
});

test('startServer can pause Looper allowlist registration intake', async () => {
  const server = await startServer({
    fixture: 'generic',
    host: '127.0.0.1',
    port: 0,
    loopersAllowlistRegistrationPaused: true,
  });

  try {
    const register = await fetch(`${server.url}/api/loopers/allowlist/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ address: '0x27e3286c2c1783f67d06f2ff4e3ab41f8e1c91ea', source: 'test' }),
    });
    assert.equal(register.status, 503);
    assert.equal((await register.json()).error.code, 'registration_paused');
  } finally {
    await server.close();
  }
});

test('startServer can require trusted browser origin for Looper allowlist registration', async () => {
  const server = await startServer({
    fixture: 'generic',
    host: '127.0.0.1',
    port: 0,
    publicBaseUrl: 'https://helixa.xyz',
    allowedOrigins: ['https://helixa.xyz'],
    loopersAllowlistRequireBrowserOrigin: true,
  });

  try {
    const noOrigin = await fetch(`${server.url}/api/loopers/allowlist/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ address: '0x27e3286c2c1783f67d06f2ff4e3ab41f8e1c91ea', source: 'test' }),
    });
    assert.equal(noOrigin.status, 403);
    assert.equal((await noOrigin.json()).error.code, 'browser_origin_required');

    const trustedOrigin = await fetch(`${server.url}/api/loopers/allowlist/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://helixa.xyz' },
      body: JSON.stringify({ address: '0x27e3286c2c1783f67d06f2ff4e3ab41f8e1c91ea', source: 'test' }),
    });
    assert.equal(trustedOrigin.status, 201);
  } finally {
    await server.close();
  }
});

test('startServer can block known bad Looper allowlist sources before rate limiting', async () => {
  const server = await startServer({
    fixture: 'generic',
    host: '127.0.0.1',
    port: 0,
    loopersAllowlistBlockedSources: ['20260826c'],
    loopersAllowlistRateLimit: { limit: 1, windowMs: 60_000, now: () => 1_000 },
  });

  try {
    for (const address of [
      '0x27e3286c2c1783f67d06f2ff4e3ab41f8e1c91ea',
      '0x0000000000000000000000000000000000000001',
    ]) {
      const blocked = await fetch(`${server.url}/api/loopers/allowlist/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address, source: '20260826c' }),
      });
      assert.equal(blocked.status, 403);
      assert.equal((await blocked.json()).error.code, 'source_blocked');
    }

    const allowed = await fetch(`${server.url}/api/loopers/allowlist/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ address: '0x27e3286c2c1783f67d06f2ff4e3ab41f8e1c91ea', source: 'launch-page' }),
    });
    assert.equal(allowed.status, 201);
  } finally {
    await server.close();
  }
});

test('startServer serves frozen Looper allowlist proofs separately from registration status', async () => {
  const address = '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea';
  const ineligibleAddress = '0x0000000000000000000000000000000000000002';
  const snapshot = createAllowlistSnapshot({
    entries: [
      { address, registered_at: '2026-08-27T17:00:00.000Z', source: 'test-freeze' },
      { address: '0x0000000000000000000000000000000000000001', source: 'test-freeze' },
    ],
  }, { generatedAt: '2026-08-27T17:01:00.000Z' });
  const server = await startServer({
    fixture: 'generic',
    host: '127.0.0.1',
    port: 0,
    loopersAllowlistSnapshot: snapshot,
  });

  try {
    const proofResponse = await fetch(`${server.url}/api/loopers/allowlist/proof?address=${address.toLowerCase()}`);
    assert.equal(proofResponse.status, 200);
    const proofBody = await proofResponse.json();
    assert.equal(proofBody.collection, 'loopers');
    assert.equal(proofBody.address, address);
    assert.equal(proofBody.eligible, true);
    assert.equal(proofBody.merkle_root, snapshot.merkle.root);
    assert.equal(proofBody.leaf_encoding, snapshot.merkle.leaf_encoding);
    assert.equal(proofBody.snapshot.generated_at, '2026-08-27T17:01:00.000Z');
    assert.equal(proofBody.snapshot.count, 2);
    assert.equal(verifyAllowlistProof(proofBody.address, proofBody.proof, proofBody.merkle_root), true);

    const ineligibleResponse = await fetch(`${server.url}/api/loopers/allowlist/proof?address=${ineligibleAddress}`);
    assert.equal(ineligibleResponse.status, 200);
    const ineligibleBody = await ineligibleResponse.json();
    assert.equal(ineligibleBody.address, ineligibleAddress);
    assert.equal(ineligibleBody.eligible, false);
    assert.deepEqual(ineligibleBody.proof, []);
    assert.equal(ineligibleBody.merkle_root, snapshot.merkle.root);
  } finally {
    await server.close();
  }
});

test('startServer rejects invalid Looper proof addresses and reports missing snapshot config', async () => {
  const server = await startServer({ fixture: 'generic', host: '127.0.0.1', port: 0 });

  try {
    const missing = await fetch(`${server.url}/api/loopers/allowlist/proof?address=0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea`);
    assert.equal(missing.status, 503);
    assert.equal((await missing.json()).error.code, 'not_configured');

    const snapshotServer = await startServer({
      fixture: 'generic',
      host: '127.0.0.1',
      port: 0,
      loopersAllowlistSnapshot: createAllowlistSnapshot({ entries: [] }),
    });
    try {
      const invalid = await fetch(`${snapshotServer.url}/api/loopers/allowlist/proof?address=not-an-address`);
      assert.equal(invalid.status, 400);
      assert.equal((await invalid.json()).error.code, 'invalid_address');
    } finally {
      await snapshotServer.close();
    }
  } finally {
    await server.close();
  }
});

test('startServer rejects invalid Looper allowlist addresses', async () => {
  const server = await startServer({ fixture: 'generic', host: '127.0.0.1', port: 0 });

  try {
    const register = await fetch(`${server.url}/api/loopers/allowlist/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ address: 'not-an-address' }),
    });
    assert.equal(register.status, 400);
    assert.equal((await register.json()).error.code, 'invalid_address');
  } finally {
    await server.close();
  }
});

test('startServer rate limits repeated Looper allowlist registration attempts by client', async () => {
  const server = await startServer({
    fixture: 'generic',
    host: '127.0.0.1',
    port: 0,
    loopersAllowlistRateLimit: { limit: 1, windowMs: 60_000, now: () => 1_000 },
  });

  try {
    const first = await fetch(`${server.url}/api/loopers/allowlist/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.10' },
      body: JSON.stringify({ address: '0x27e3286c2c1783f67d06f2ff4e3ab41f8e1c91ea', source: 'test' }),
    });
    assert.equal(first.status, 201);

    const duplicate = await fetch(`${server.url}/api/loopers/allowlist/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.10' },
      body: JSON.stringify({ address: '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea', source: 'retry' }),
    });
    assert.equal(duplicate.status, 200);
    const duplicateBody = await duplicate.json();
    assert.equal(duplicateBody.created, false);
    assert.equal(duplicateBody.entry.source, 'test');

    const limited = await fetch(`${server.url}/api/loopers/allowlist/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.10' },
      body: JSON.stringify({ address: '0x0000000000000000000000000000000000000001', source: 'test' }),
    });
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get('retry-after'), '60');
    assert.equal((await limited.json()).error.code, 'rate_limited');
  } finally {
    await server.close();
  }
});

test('startServer rate limits Looper allowlist bursts by client subnet', async () => {
  const server = await startServer({
    fixture: 'generic',
    host: '127.0.0.1',
    port: 0,
    loopersAllowlistRateLimit: { limit: 10, windowMs: 60_000, now: () => 1_000 },
    loopersAllowlistSubnetRateLimit: { limit: 1, windowMs: 60_000, now: () => 1_000 },
  });

  try {
    const first = await fetch(`${server.url}/api/loopers/allowlist/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.10' },
      body: JSON.stringify({ address: '0x27e3286c2c1783f67d06f2ff4e3ab41f8e1c91ea', source: 'test' }),
    });
    assert.equal(first.status, 201);

    const limited = await fetch(`${server.url}/api/loopers/allowlist/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.99' },
      body: JSON.stringify({ address: '0x0000000000000000000000000000000000000001', source: 'test' }),
    });
    assert.equal(limited.status, 429);
    assert.equal((await limited.json()).error.message, 'Too many allowlist registration attempts from this network. Try again shortly.');
  } finally {
    await server.close();
  }
});

test('startServer rate limits Looper allowlist registration globally', async () => {
  const server = await startServer({
    fixture: 'generic',
    host: '127.0.0.1',
    port: 0,
    loopersAllowlistRateLimit: { limit: 10, windowMs: 60_000, now: () => 1_000 },
    loopersAllowlistSubnetRateLimit: { limit: 10, windowMs: 60_000, now: () => 1_000 },
    loopersAllowlistGlobalRateLimit: { limit: 2, windowMs: 60_000, now: () => 1_000 },
  });

  try {
    for (const [index, address] of [
      '0x27e3286c2c1783f67d06f2ff4e3ab41f8e1c91ea',
      '0x0000000000000000000000000000000000000001',
    ].entries()) {
      const allowed = await fetch(`${server.url}/api/loopers/allowlist/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': `203.0.${index}.10` },
        body: JSON.stringify({ address, source: 'test' }),
      });
      assert.equal(allowed.status, 201);
    }

    const limited = await fetch(`${server.url}/api/loopers/allowlist/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.3.10' },
      body: JSON.stringify({ address: '0x0000000000000000000000000000000000000002', source: 'test' }),
    });
    assert.equal(limited.status, 429);
    assert.equal((await limited.json()).error.message, 'Loopers allowlist registration is in slow mode. Try again shortly.');
  } finally {
    await server.close();
  }
});

test('startServer rejects Looper allowlist honeypot submissions', async () => {
  const server = await startServer({ fixture: 'generic', host: '127.0.0.1', port: 0 });

  try {
    const register = await fetch(`${server.url}/api/loopers/allowlist/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        address: '0x27e3286c2c1783f67d06f2ff4e3ab41f8e1c91ea',
        website: 'https://bot.example',
      }),
    });
    assert.equal(register.status, 400);
    assert.equal((await register.json()).error.code, 'bot_detected');
  } finally {
    await server.close();
  }
});

test('startServer requires and verifies Turnstile when configured', async () => {
  const turnstileCalls = [];
  const server = await startServer({
    fixture: 'generic',
    host: '127.0.0.1',
    port: 0,
    loopersTurnstileSecretKey: 'secret',
    fetchImpl: async (url, options) => {
      turnstileCalls.push({ url, options });
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    },
  });

  try {
    const missing = await fetch(`${server.url}/api/loopers/allowlist/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ address: '0x27e3286c2c1783f67d06f2ff4e3ab41f8e1c91ea' }),
    });
    assert.equal(missing.status, 403);
    assert.equal((await missing.json()).error.code, 'verification_required');

    const register = await fetch(`${server.url}/api/loopers/allowlist/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.42' },
      body: JSON.stringify({
        address: '0x27e3286c2c1783f67d06f2ff4e3ab41f8e1c91ea',
        turnstileToken: 'token',
      }),
    });
    assert.equal(register.status, 201);
    assert.equal(turnstileCalls.length, 1);
    assert.equal(turnstileCalls[0].url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
    const form = new URLSearchParams(turnstileCalls[0].options.body);
    assert.equal(form.get('secret'), 'secret');
    assert.equal(form.get('response'), 'token');
    assert.equal(form.get('remoteip'), '203.0.113.42');
  } finally {
    await server.close();
  }
});

test('startServer serves all local fixture routes', async () => {
  const cases = [
    ['generic', 'demo-agent', 'receipt_demo_lookup'],
    ['bendr', 'bendr-2', 'receipt_bendr_lookup'],
  ];

  for (const [fixture, slug, receiptId] of cases) {
    const server = await startServer({ fixture, host: '127.0.0.1', port: 0 });

    try {
      for (const pathName of [
        '/.well-known/helixa-multipass.json',
        `/api/multipass/${slug}`,
        `/api/multipass/${slug}/fragments`,
        `/api/multipass/${slug}/agent-card`,
        `/api/multipass/${slug}/standards`,
        `/api/multipass/${slug}/x402`,
        `/api/multipass/${slug}/receipts/${receiptId}`,
      ]) {
        const response = await fetch(`${server.url}${pathName}`);
        assert.equal(response.status, 200, `${fixture} ${pathName}`);
      }
    } finally {
      await server.close();
    }
  }
});

test('startServer can serve Bendr fixture', async () => {
  const server = await startServer({ fixture: 'bendr', host: '127.0.0.1', port: 0 });

  try {
    const profile = await fetch(`${server.url}/api/multipass/bendr-2`);
    assert.equal(profile.status, 200);
    assert.equal((await profile.json()).display_name, 'Bendr 2.0');
  } finally {
    await server.close();
  }
});


test('startServer preserves binary JPEG bytes for dynamic share cards', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'multipass-server-binary-'));
  const databasePath = path.join(dir, 'multipass.sqlite');
  const server = await startServer({
    fixture: 'generic',
    host: '127.0.0.1',
    port: 0,
    databasePath,
    activationService: async (input) => {
      assert.equal(input, '1');
      return buildSavedRecordFromHelixaAgent({ tokenId: '1', name: 'Bendr 2.0' }, { observedAt: '2026-06-26T20:00:00.000Z' });
    },
  });

  try {
    const save = await fetch(`${server.url}/api/multipass`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ agent: '1' }),
    });
    assert.equal(save.status, 201);

    const image = await fetch(`${server.url}/multipass/share/bendr-2-1.jpg`);
    const bytes = new Uint8Array(await image.arrayBuffer());

    assert.equal(image.status, 200);
    assert.match(image.headers.get('content-type') ?? '', /image\/jpeg/);
    assert.equal(bytes[0], 0xff);
    assert.equal(bytes[1], 0xd8);
    assert.ok(bytes.length > 20_000);
  } finally {
    await server.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test('startServer posts saved Multipass records through real HTTP server', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'multipass-server-'));
  const databasePath = path.join(dir, 'multipass.sqlite');
  const server = await startServer({
    fixture: 'generic',
    host: '127.0.0.1',
    port: 0,
    databasePath,
    activationService: async (input) => {
      assert.equal(input, '1');
      return buildSavedRecordFromHelixaAgent({ tokenId: '1', name: 'Bendr 2.0' }, { observedAt: '2026-06-26T20:00:00.000Z' });
    },
  });

  try {
    assert.equal(server.databasePath, databasePath);
    const save = await fetch(`${server.url}/api/multipass`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ agent: '1' }),
    });
    assert.equal(save.status, 201);
    const saveBody = await save.json();
    assert.equal(saveBody.created, true);
    assert.equal(saveBody.profile.slug, 'bendr-2-1');

    const profile = await fetch(`${server.url}/api/multipass/bendr-2-1`);
    assert.equal(profile.status, 200);
    const profileBody = await profile.json();
    assert.equal(profileBody.multipass_id, 'mp_helixa_agent_1');
  } finally {
    await server.close();
    await rm(dir, { recursive: true, force: true });
  }
});


test('parseServerOptions keeps every RESTAP surface false by default and strictly parses bounded server policy/talk overrides', () => {
  const options = parseServerOptions([], {
    MULTIPASS_RESTAP_DISCOVERY_ENABLED: 'true',
    MULTIPASS_RESTAP_TALK_ENABLED: '1',
    MULTIPASS_RESTAP_NEWS_WRITE_ENABLED: 'false',
    MULTIPASS_RESTAP_NEWS_READ_ENABLED: '0',
    MULTIPASS_RESTAP_3802_POLICY_PATH: '/srv/private/restap-3802.json',
    MULTIPASS_RESTAP_TALK_MODEL: 'claude-haiku-4.5',
    MULTIPASS_RESTAP_TALK_TIMEOUT_MS: '2500',
    MULTIPASS_RESTAP_TALK_CONCURRENCY: '3',
    MULTIPASS_RESTAP_TALK_PER_IP_PER_MINUTE: '12',
    MULTIPASS_RESTAP_TALK_PER_SESSION_PER_MINUTE: '6',
    MULTIPASS_RESTAP_TALK_GLOBAL_PER_DAY: '900',
    BANKR_LLM_KEY: 'private-key',
  });
  assert.equal(options.restapDiscoveryEnabled, true);
  assert.equal(options.restapTalkEnabled, true);
  assert.equal(options.restapNewsWriteEnabled, false);
  assert.equal(options.restapNewsReadEnabled, false);
  assert.equal(options.restap3802PolicyPath, '/srv/private/restap-3802.json');
  assert.equal(options.restapTalkModel, 'claude-haiku-4.5');
  assert.equal(options.restapTalkTimeoutMs, 2500);
  assert.deepEqual(options.restapTalkLimits, { perIpPerMinute: 12, perSessionPerMinute: 6, globalPerDay: 900, concurrency: 3 });

  const keyOnly = parseServerOptions([], { BANKR_LLM_KEY: 'private-key' });
  assert.equal(keyOnly.restapTalkEnabled, false);
  for (const name of ['MULTIPASS_RESTAP_DISCOVERY_ENABLED', 'MULTIPASS_RESTAP_TALK_ENABLED', 'MULTIPASS_RESTAP_NEWS_WRITE_ENABLED', 'MULTIPASS_RESTAP_NEWS_READ_ENABLED']) {
    assert.throws(() => parseServerOptions([], { [name]: 'yes' }), new RegExp(name));
  }
  for (const [name, value] of [
    ['MULTIPASS_RESTAP_TALK_MODEL', 'x'.repeat(129)],
    ['MULTIPASS_RESTAP_TALK_TIMEOUT_MS', '15001'],
    ['MULTIPASS_RESTAP_TALK_CONCURRENCY', '17'],
    ['MULTIPASS_RESTAP_TALK_PER_IP_PER_MINUTE', '0'],
    ['MULTIPASS_RESTAP_TALK_PER_SESSION_PER_MINUTE', '10001'],
    ['MULTIPASS_RESTAP_TALK_GLOBAL_PER_DAY', '1000001'],
  ]) assert.throws(() => parseServerOptions([], { [name]: value }), new RegExp(name));
});

test('network gate environment parses strict closed service configuration', () => {
  const options = parseServerOptions([], {
    MULTIPASS_RESTAP_NETWORK_FOUNDATION_ENABLED: 'true',
    MULTIPASS_RESTAP_NETWORK_POLICY_ENABLED: '1',
    MULTIPASS_RESTAP_NETWORK_DATABASE_PATH: '/srv/restap-network.sqlite',
    MULTIPASS_RESTAP_NETWORK_OPERATIONAL_HASH_SALT: 's'.repeat(32),
    MULTIPASS_RESTAP_NETWORK_DAILY_COST_LIMIT: '100',
    MULTIPASS_RESTAP_NETWORK_TOPICS: 'general',
    MULTIPASS_RESTAP_NETWORK_CADENCES: 'once',
  });
  assert.equal(options.restapNetworkServiceConfig.gates.foundation, true);
  assert.equal(options.restapNetworkServiceConfig.gates.policy, true);
  assert.equal(options.restapNetworkServiceConfig.gates.discovery, false);
  assert.equal(options.restapNetworkServiceConfig.databasePath, '/srv/restap-network.sqlite');
  assert.throws(() => parseServerOptions([], { MULTIPASS_RESTAP_NETWORK_FOUNDATION_ENABLED: 'yes' }), /exact boolean/i);
});

test('all RESTAP gates false create no RESTAP policy, database, sessions, or inference dependency', async () => {
  const calls = [];
  const server = await startServer({
    fixture: 'generic', host: '127.0.0.1', port: 0,
    logger: { info() {}, warn() {} },
    restapPolicyLoader: async () => { calls.push('policy'); throw new Error('must not load'); },
    restapPublicSessionStoreFactory: () => { calls.push('sessions'); throw new Error('must not create'); },
    restapInferenceClientFactory: () => { calls.push('inference'); throw new Error('must not create'); },
    restapNewsStoreFactory: () => { calls.push('news'); throw new Error('must not create'); },
  });
  try { assert.deepEqual(calls, []); } finally { await server.close(); }
});

test('server composes and closes exactly one gated network service', async () => {
  const calls = [];
  const restapNetworkService = { status: { enabled: false, gates: {}, transcriptCapability: 'unavailable' }, async close() { calls.push('network:close'); } };
  const server = await startServer({
    fixture: 'generic', host: '127.0.0.1', port: 0, logger: { info() {}, warn() {} },
    restapNetworkServiceFactory: async ({ config, dependencies }) => {
      calls.push('network:start');
      assert.equal(config.gates.foundation, false);
      assert.deepEqual(dependencies, {});
      return restapNetworkService;
    },
  });
  assert.equal(server.restapNetwork, restapNetworkService);
  await server.close();
  assert.deepEqual(calls, ['network:start', 'network:close']);
});

test('shutdown closes HTTP intake and drains in-flight requests before RESTAP database shutdown', async () => {
  const order = [];
  let releaseRequest;
  let requestStarted;
  const started = new Promise((resolve) => { requestStarted = resolve; });
  const held = new Promise((resolve) => { releaseRequest = resolve; });
  const restapNetworkService = {
    status: { enabled: false, gates: {}, transcriptCapability: 'unavailable' },
    async close() { order.push('network:close'); },
  };
  const server = await startServer({
    fixture: 'generic', host: '127.0.0.1', port: 0, logger: { info() {}, warn() {} },
    restapNetworkService,
    apiFactory: () => ({ async handleRequest() {
      order.push('request:start'); requestStarted(); await held; order.push('request:end'); return new Response('{}');
    } }),
  });
  const inFlight = fetch(server.url + '/held');
  await started;
  const closing = server.close();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(server.server.listening, false);
  await assert.rejects(() => fetch(server.url + '/after-close'));
  assert.equal(order.includes('network:close'), false);
  releaseRequest();
  assert.equal((await inFlight).status, 200);
  await closing;
  assert.deepEqual(order, ['request:start', 'request:end', 'network:close']);
});

test('RESTAP startup performs an uncached authority/Codex warm-check, injects isolated resources, listens last, and logs only safe gate metadata', async () => {
  const events = [];
  const order = [];
  const policy = Object.freeze({
    authority: Object.freeze({}),
    publicProfile: Object.freeze({ publicConversationEnabled: true }),
    newsSenders: Object.freeze([{ id: 'sender.one', enabled: true, kind: 'evm', signer: '0x1111111111111111111111111111111111111111' }]),
  });
  const projection = Object.freeze({
    canonicalIdentity: Object.freeze({ canonicalName: 'Looper #3802', imageUrl: 'https://helixa.xyz/3802.png' }),
    ownerPublicProfile: Object.freeze({ displayName: 'Owner', publicConversationEnabled: true, biography: 'bio', mission: 'mission', voicePresentation: 'direct' }),
    newsSenders: policy.newsSenders,
  });
  let authorityCalls = 0;
  let injected;
  const sessionStore = { create() {}, resolve() {}, appendTurn() {}, close() { order.push('sessions-close'); } };
  const newsStore = { accept() {}, list() { return { items: [], nextCursor: null }; }, close() { order.push('news-close'); } };
  const inferenceClient = { async generate() { return { reply: 'ok' }; } };
  const talkRuntime = { async talk() { return { reply: 'ok', session_id: 'x'.repeat(43) }; } };
  const server = await startServer({
    fixture: 'generic', host: '127.0.0.1', port: 0, publicBaseUrl: 'https://helixa.xyz/multipass-api',
    databasePath: '/srv/private/restap.sqlite', savedRecords: {}, looperNameStore: {}, bankrLlmKey: 'private-key',
    restapDiscoveryEnabled: true, restapTalkEnabled: true, restapNewsWriteEnabled: true, restapNewsReadEnabled: true,
    restap3802PolicyPath: '/srv/private/restap-3802.json',
    restapAuthorityResolver: async () => { authorityCalls += 1; return {}; },
    restapPolicyLoader: async ({ policyPath }) => { assert.equal(policyPath, '/srv/private/restap-3802.json'); order.push('policy'); return policy; },
    restapPolicyAuthorizer: async ({ resolveAuthority, loadCodexProfile }) => { await resolveAuthority(); await loadCodexProfile('3802'); return projection; },
    restapPublicSessionStoreFactory: () => { order.push('sessions'); return sessionStore; },
    restapInferenceClientFactory: (input) => { assert.equal(input.apiKey, 'private-key'); order.push('inference'); return inferenceClient; },
    restapPublicTalkRuntimeFactory: (input) => { assert.equal(input.sessionStore, sessionStore); assert.equal(input.inferenceClient, inferenceClient); order.push('talk'); return talkRuntime; },
    restapNewsStoreFactory: ({ databasePath }) => { assert.equal(databasePath, '/srv/private/restap.sqlite'); order.push('news'); return newsStore; },
    restapNewsAuthenticatorFactory: ({ policy: inputPolicy }) => { assert.equal(inputPolicy, policy); order.push('authenticator'); return { async authenticate() {} }; },
    restapVerifyEip1271: async () => false,
    restapResolveErc8004Controller: async () => '0x1111111111111111111111111111111111111111',
    looperCodexRuntime: { available: true, status: { available: true, artifactHash: 'a'.repeat(64) }, getProfileContext(tokenId) { assert.equal(tokenId, 3802); return { identity: { tokenId: 3802, canonicalName: 'Looper #3802', image: { url: 'https://helixa.xyz/3802.png' } } }; }, query() {} },
    logger: { info(event) { events.push(event); }, warn(event) { events.push(event); } },
    apiFactory: (options) => { order.push('api'); injected = options; return { async handleRequest() { await options.restap3802Policy.authorize({ surface: 'discovery' }); return new Response('{}'); } }; },
  });
  try {
    assert.equal(authorityCalls, 1, 'startup warm-check is exactly once');
    assert.equal(injected.restapDiscoveryEnabled, true);
    assert.equal(injected.restapTalkEnabled, true);
    assert.equal(injected.restapNewsWriteEnabled, true);
    assert.equal(injected.restapNewsReadEnabled, true);
    assert.equal(injected.restapTalkRuntime, talkRuntime);
    assert.equal(injected.restapNewsStore, newsStore);
    assert.equal(typeof injected.restap3802Policy.authorize, 'function');
    assert.equal(injected.consoleAuthStore, undefined);
    assert.equal(order.at(-1), 'api', 'all RESTAP initialization precedes API construction/listen');
    await fetch(server.url + '/anything');
    assert.equal(authorityCalls, 2, 'request authorization is fresh after warm-check');
    const startup = events.find((event) => event.event === 'restap_3802_startup');
    assert.deepEqual(startup, { event: 'restap_3802_startup', tokenId: '3802', discovery: true, talk: true, newsWrite: true, newsRead: true, enabledSenderCount: 1, codexHashPrefix: 'aaaaaaaaaaaa' });
    const serialized = JSON.stringify(events);
    for (const secret of ['/srv/private', 'private-key', 'sender.one', '0x1111111111111111111111111111111111111111']) assert.equal(serialized.includes(secret), false);
  } finally { await server.close(); }
  assert.deepEqual(order.slice(-2), ['sessions-close', 'news-close']);
});

test('RESTAP startup rejects missing gate dependencies before listen and closes created resources once in safe order', async () => {
  const base = {
    fixture: 'generic', host: '127.0.0.1', port: 0, savedRecords: {}, looperNameStore: {},
    logger: { info() {}, warn() {} },
    consoleBootstrapFactory: async () => ({ ownedAgentLoader: async () => [], publicClients: [], authorizeLooper: async () => ({}), runtimeRegistry: {}, publishingClient: {}, runtime: {}, async stopWorker() {}, async closeClient() {} }),
    restap3802PolicyPath: '/policy.json',
    restapPolicyLoader: async () => ({ authority: {}, publicProfile: { publicConversationEnabled: true }, newsSenders: [{ id: 'sender.one', enabled: true, kind: 'evm', signer: '0x1111111111111111111111111111111111111111' }] }),
    restapAuthorityResolver: async () => ({}),
    restapPolicyAuthorizer: async () => ({ canonicalIdentity: { canonicalName: 'Looper #3802', imageUrl: 'https://helixa.xyz/3802.png' }, ownerPublicProfile: { displayName: 'Owner', publicConversationEnabled: true, biography: 'bio', mission: 'mission', voicePresentation: 'direct' }, newsSenders: [] }),
    looperCodexRuntime: { available: true, status: { available: true, artifactHash: 'b'.repeat(64) }, getProfileContext() { return { identity: { tokenId: 3802 } }; }, query() {} },
  };
  await assert.rejects(startServer({ ...base, restapDiscoveryEnabled: true, restapAuthorityResolver: null }), /authority resolver/i);
  await assert.rejects(startServer({ ...base, restapDiscoveryEnabled: true, looperCodexRuntime: { available: false, status: { available: false } } }), /Codex/i);
  await assert.rejects(startServer({ ...base, restapTalkEnabled: true }), /inference/i);
  await assert.rejects(startServer({ ...base, restapNewsReadEnabled: true }), /persistent database/i);

  const closes = [];
  let apiCalls = 0;
  await assert.rejects(startServer({
    ...base,
    databasePath: '/tmp/restap.sqlite', restapTalkEnabled: true, restapNewsWriteEnabled: true, restapNewsReadEnabled: true, bankrLlmKey: 'key',
    restapPublicSessionStoreFactory: () => ({ create() {}, resolve() {}, appendTurn() {}, close() { closes.push('sessions'); } }),
    restapInferenceClientFactory: () => ({ generate() {} }),
    restapPublicTalkRuntimeFactory: () => ({ talk() {} }),
    restapNewsStoreFactory: () => ({ accept() {}, list() { return { items: [], nextCursor: null }; }, close() { closes.push('news'); } }),
    restapNewsAuthenticatorFactory: () => { throw new Error('schema/init failed'); },
    apiFactory: () => { apiCalls += 1; return { handleRequest() {} }; },
  }), /schema.init failed/);
  assert.equal(apiCalls, 0);
  assert.deepEqual(closes, ['sessions', 'news']);
});


test('RESTAP proxy trust is false by default and strictly parses its forwarded identity gate', () => {
  assert.equal(parseServerOptions([], {}).restapTrustLoopbackProxy, false);
  assert.equal(parseServerOptions([], { MULTIPASS_RESTAP_TRUST_LOOPBACK_PROXY: 'true' }).restapTrustLoopbackProxy, true);
  assert.equal(parseServerOptions([], { MULTIPASS_RESTAP_TRUST_LOOPBACK_PROXY: '0' }).restapTrustLoopbackProxy, false);
  assert.throws(
    () => parseServerOptions([], { MULTIPASS_RESTAP_TRUST_LOOPBACK_PROXY: 'yes' }),
    /MULTIPASS_RESTAP_TRUST_LOOPBACK_PROXY/,
  );
});

test('RESTAP client identity sanitizer ignores spoofed forwarded identity unless a loopback proxy is explicitly trusted', () => {
  const spoofed = {
    'x-multipass-client-ip': '198.51.100.99',
    'cf-connecting-ip': '203.0.113.10',
  };
  assert.equal(sanitizeRestapProxyHeaders(spoofed, { remoteAddress: '198.51.100.7' })['x-multipass-client-ip'], '198.51.100.7');
  assert.equal(sanitizeRestapProxyHeaders(spoofed, { remoteAddress: '198.51.100.7', trustLoopbackProxy: true })['x-multipass-client-ip'], '198.51.100.7');
  assert.equal(sanitizeRestapProxyHeaders(spoofed, { remoteAddress: '127.0.0.1', trustLoopbackProxy: true })['x-multipass-client-ip'], '203.0.113.10');
  assert.equal(sanitizeRestapProxyHeaders({ 'x-real-ip': '2001:db8::7' }, { remoteAddress: '::1', trustLoopbackProxy: true })['x-multipass-client-ip'], '2001:db8::7');
  assert.equal(sanitizeRestapProxyHeaders({ 'x-forwarded-for': '203.0.113.1, 203.0.113.2' }, { remoteAddress: '::ffff:127.0.0.1', trustLoopbackProxy: true })['x-multipass-client-ip'], '::ffff:127.0.0.1');
  assert.equal(sanitizeRestapProxyHeaders({ 'cf-connecting-ip': '203.0.113.1', 'x-real-ip': '203.0.113.2' }, { remoteAddress: '127.0.0.1', trustLoopbackProxy: true })['x-multipass-client-ip'], '127.0.0.1');
  assert.equal(sanitizeRestapProxyHeaders({ 'cf-connecting-ip': 'not-an-ip' }, { remoteAddress: '127.0.0.1', trustLoopbackProxy: true })['x-multipass-client-ip'], '127.0.0.1');
});

test('startServer overwrites inbound RESTAP client identity while preserving forwarded headers for non-RESTAP semantics', async () => {
  const seen = [];
  const server = await startServer({
    fixture: 'generic', host: '127.0.0.1', port: 0, restapTrustLoopbackProxy: true,
    logger: { info() {}, warn() {} },
    apiFactory: () => ({ async handleRequest(request) {
      seen.push(Object.fromEntries(request.headers.entries()));
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    } }),
  });
  try {
    await fetch(server.url + '/identity', { headers: {
      'x-multipass-client-ip': '198.51.100.99',
      'cf-connecting-ip': '203.0.113.42',
    } });
    assert.equal(seen[0]['x-multipass-client-ip'], '203.0.113.42');
    assert.equal(seen[0]['cf-connecting-ip'], '203.0.113.42');
  } finally { await server.close(); }
});


test('RESTAP network signer path is reference-only and required startup fails closed before listen', async () => {
  assert.equal(parseServerOptions([], {}).restapNetworkSignerFile, null);
  assert.equal(parseServerOptions([], { MULTIPASS_RESTAP_NETWORK_SIGNER_FILE: '/run/secrets/restap-network-signer' }).restapNetworkSignerFile, '/run/secrets/restap-network-signer');

  const events = [];
  let bootstrapOptions;
  const base = {
    fixture: 'generic', host: '127.0.0.1', port: 0, savedRecords: {}, looperNameStore: {},
    looperCodexRuntime: { available: false, status: { available: false } },
    logger: { info(event) { events.push(event); }, warn(event) { events.push(event); }, error(event) { events.push(event); } },
    consoleBootstrapFactory: async (options) => { bootstrapOptions = options; return { ownedAgentLoader: async () => [], publicClients: [], authorizeLooper: async () => ({}), runtimeRegistry: {}, publishingClient: {}, runtime: {}, async stopWorker() {}, async closeClient() {} }; },
    apiFactory: () => ({ async handleRequest() { return new Response('{}'); } }),
  };

  let loaderCalls = 0;
  const inert = await startServer({
    ...base, restapNetworkSignerFile: '/configured-but-gated-off',
    restapNetworkSignerLoader: async () => { loaderCalls += 1; throw new Error('must remain gated off'); },
  });
  try {
    assert.equal(loaderCalls, 0);
    assert.equal('restapNetworkSignerFile' in bootstrapOptions, false);
    assert.equal('restapNetworkSignerRequired' in bootstrapOptions, false);
  } finally { await inert.close(); }

  await assert.rejects(startServer({ ...base, restapNetworkSignerRequired: true }), /network signer unavailable/i);
  await assert.rejects(startServer({
    ...base, restapNetworkSignerRequired: true, restapNetworkSignerFile: '/unsafe/private-marker',
    restapNetworkSignerLoader: async () => { loaderCalls += 1; throw new Error('PRIVATE_KEY_SENTINEL'); },
  }), /network signer unavailable/i);
  assert.equal(loaderCalls, 1);
  assert.equal(JSON.stringify(events).includes('PRIVATE_KEY_SENTINEL'), false);
  assert.equal(JSON.stringify(events).includes('/unsafe/private-marker'), false);

  const signer = Object.freeze({ keyId: 'test-key-000000000000000000000001', async sign() { return Buffer.alloc(64); } });
  let injected;
  const server = await startServer({
    ...base, restapNetworkSignerRequired: true, restapNetworkSigner: signer,
    apiFactory: (options) => { injected = options.restapNetworkSigner; return { async handleRequest() { return new Response('{}'); } }; },
  });
  try {
    assert.equal(injected, undefined);
    assert.equal(JSON.stringify(server).includes('sign'), false);
  } finally { await server.close(); }
});

test('parseServerOptions reads the wallet-value roster path explicitly', () => {
  assert.equal(parseServerOptions([], {}).looperMarketplaceRosterPath, null);
  assert.equal(parseServerOptions([], { LOOPER_MARKETPLACE_ROSTER_PATH: '/var/www/roster.json' }).looperMarketplaceRosterPath, '/var/www/roster.json');
});

test('startServer serves exact wallet-value bytes and preserves cache headers', async () => {
  const bytes = new TextEncoder().encode(JSON.stringify({ schema_version: '1.0.0', rows: [] }));
  let calls = 0;
  const server = await startServer({
    fixture: 'generic', host: '127.0.0.1', port: 0,
    looperMarketplaceWalletValuesLoader: async () => {
      calls += 1;
      return { status: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=30', etag: '"abc"' }, bodyBytes: bytes };
    },
    logger: { info() {}, warn() {}, error() {} },
  });
  try {
    const response = await fetch(server.url + '/api/loopers/marketplace/wallet-values');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'public, max-age=30');
    assert.equal(response.headers.get('etag'), '"abc"');
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
    assert.equal(calls, 1);
    assert.equal((await fetch(server.url + '/api/loopers/marketplace/wallet-values', { method: 'HEAD' })).status, 405);
  } finally { await server.close(); }
});

test('wallet-value route returns the exact schema-locked 503 without schema_version', async () => {
  const server = await startServer({ fixture: 'generic', host: '127.0.0.1', port: 0, logger: { info() {}, warn() {}, error() {} } });
  try {
    const response = await fetch(server.url + '/api/loopers/marketplace/wallet-values');
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { error: { code: 'wallet_values_unavailable', message: 'Looper wallet values are temporarily unavailable.' } });
  } finally { await server.close(); }
});

test('startServer composes one wallet-value loader from the configured roster path', async () => {
  const refresh = async () => ({});
  const loader = async () => ({ status: 503, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, bodyBytes: new TextEncoder().encode('{}') });
  let injected;
  const server = await startServer({
    fixture: 'generic', host: '127.0.0.1', port: 0,
    looperMarketplaceRosterPath: '/var/www/helixa.xyz/multipass/data/looper-activated-roster.json',
    looperWalletValueRefresherFactory: (input) => {
      assert.equal(input.rosterPath, '/var/www/helixa.xyz/multipass/data/looper-activated-roster.json');
      assert.equal(typeof input.fetchImpl, 'function');
      return refresh;
    },
    looperWalletValuesLoaderFactory: (input) => { assert.equal(input.refresh, refresh); return loader; },
    apiFactory: (options) => { injected = options.looperMarketplaceWalletValuesLoader; return { async handleRequest() { return new Response('{}'); } }; },
    logger: { info() {}, warn() {}, error() {} },
  });
  try { assert.equal(injected, loader); } finally { await server.close(); }
});
