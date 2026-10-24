import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { parseServerOptions, startServer } from '../src/server.js';

test('Credifi owner opt-in preparation is production-disabled by default and strictly gated', () => {
  assert.equal(parseServerOptions([], {}).credifiOwnerOptInEnabled, false);
  assert.equal(parseServerOptions([], { MULTIPASS_CREDIFI_OWNER_OPT_IN_ENABLED: 'true' }).credifiOwnerOptInEnabled, true);
  assert.throws(() => parseServerOptions([], { MULTIPASS_CREDIFI_OWNER_OPT_IN_ENABLED: 'yes' }), /MULTIPASS_CREDIFI_OWNER_OPT_IN_ENABLED/);
});

test('enabled owner opt-in requires and reuses the existing runtime SQLite path', async () => {
  await assert.rejects(async () => {
    const unexpected = await startServer({ fixture: 'generic', host: '127.0.0.1', port: 0, credifiOwnerOptInEnabled: true });
    await unexpected.close();
    throw new Error('enabled owner opt-in started without MULTIPASS_DB_PATH');
  }, /MULTIPASS_DB_PATH/);
  const directory = await mkdtemp(path.join(os.tmpdir(), 'credifi-opt-in-server-'));
  const databasePath = path.join(directory, 'runtime.sqlite');
  let injected;
  let verifier;
  const server = await startServer({
    fixture: 'generic', host: '127.0.0.1', port: 0, databasePath, credifiOwnerOptInEnabled: true,
    apiFactory(options) {
      injected = options.credifiOwnerOptInService;
      verifier = options.credifiOwnerOptInVerifier;
      return { async handleRequest() { return new Response('{}', { status: 200 }); } };
    },
  });
  try {
    assert.equal(typeof injected?.getStatus, 'function');
    assert.equal(typeof injected?.optIn, 'function');
    assert.equal(typeof verifier?.verify, 'function');
    assert.equal(typeof verifier?.verifyCustodyEpoch, 'function');
  } finally {
    await server.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('disabled server does not expose an owner opt-in service', async () => {
  let injected = 'unset';
  const server = await startServer({
    fixture: 'generic', host: '127.0.0.1', port: 0,
    apiFactory(options) {
      injected = options.credifiOwnerOptInService;
      return { async handleRequest() { return new Response('{}', { status: 200 }); } };
    },
  });
  try { assert.equal(injected, null); } finally { await server.close(); }
});


test('disabled feature flag dominates injected opt-in service and verifier', async () => {
  let injectedService = 'unset';
  let injectedVerifier = 'unset';
  const server = await startServer({
    fixture: 'generic', host: '127.0.0.1', port: 0, credifiOwnerOptInEnabled: false,
    credifiOwnerOptInService: { getStatus() {}, optIn() {} },
    credifiOwnerOptInVerifier: { verify() {} },
    apiFactory(options) {
      injectedService = options.credifiOwnerOptInService;
      injectedVerifier = options.credifiOwnerOptInVerifier;
      return { async handleRequest() { return new Response('{}', { status: 200 }); } };
    },
  });
  try {
    assert.equal(injectedService, null);
    assert.equal(injectedVerifier, null);
  } finally { await server.close(); }
});
