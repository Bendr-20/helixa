import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { chromium } from 'playwright-core';
import { createMultipassConsoleSnapshot, renderMultipassConsole } from '../src/multipass-console.js';
import { beginConsoleRestapNetworkLoad, createInitialConsoleRestapNetworkState, failConsoleRestapNetworkLoad, resolveConsoleRestapNetworkLoad } from '../src/console-restap-network.js';

const OWNER = '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea';
const OUTPUT = join(fileURLToPath(new URL('../../..', import.meta.url)), 'tmp', 'restap-network-ui');

function policyResponse() {
  return {
    schema_version: '0.1.0', token_id: '617',
    policy: {
      policy_version: 4, custody_generation: 8,
      network_enabled: true, inbound_enabled: true, autonomous_initiation_enabled: false,
      daily_initiated_conversation_limit: 4, daily_generated_message_limit: 12, per_peer_daily_limit: 2,
      topics: ['collection-lore', 'general'], allow_peer_token_ids: ['12', '48'], block_peer_token_ids: ['77'],
      mute_until: null,
    },
    lease_status: 'active', eligibility_status: 'eligible',
    quota_usage: { initiated: 1, generated: 5, cost_units: 8 },
    transcripts: { available: false, reason: 'pilot_memory_only' },
  };
}

function intentResponse() {
  return {
    schema_version: '0.1.0', token_id: '617',
    intents: [{
      intent_id: 'intent-browser-proof-000000000000001', source: 'daily', topic: 'collection-lore', status: 'pending',
      earliest_at: '2026-10-04T16:30:00.000Z', expires_at: '2026-10-11T16:30:00.000Z',
      attempt_count: 0, attempt_limit: 3, next_eligible_at: '2026-10-04T16:30:00.000Z',
    }],
  };
}

function networkState(kind = 'active') {
  const loading = beginConsoleRestapNetworkLoad(createInitialConsoleRestapNetworkState(), { tokenId: '617', requestId: 1 });
  if (kind === 'locked') return failConsoleRestapNetworkLoad(loading, { tokenId: '617', requestId: 1, error: { status: 503 } });
  return resolveConsoleRestapNetworkLoad(loading, { tokenId: '617', requestId: 1, policyResponse: policyResponse(), intentsResponse: intentResponse() });
}

function markup(css, kind = 'active', view = 'network') {
  const agent = { tokenId: '617', name: 'Looper #617', role: 'Signal cartographer', credLabel: 'Cred 71', verified: true };
  const snapshot = createMultipassConsoleSnapshot({
    agents: [agent],
    state: {
      walletSnapshot: { connected: true, address: OWNER },
      consoleAuthenticatedWallet: OWNER,
      consoleOwnedAgents: { status: 'loaded', agents: [agent] },
      consoleSelectedAgentId: '617', consoleWorkspaceView: view,
      consoleAgentThread: { status: 'inactive', messages: [] },
      consoleRestapNetwork: networkState(kind),
    },
  });
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>' + css + '</style></head><body><div class="record-shell multipass-console-shell">' + renderMultipassConsole(snapshot) + '</div></body></html>';
}

async function startFixtureServer(pages) {
  const server = createServer((request, response) => {
    const key = new URL(request.url, 'http://127.0.0.1').pathname.slice(1) || 'active';
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(pages[key] ?? pages.active);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { origin: 'http://127.0.0.1:' + server.address().port, close: () => new Promise((resolve) => server.close(resolve)) };
}

async function assertNoOverflow(page) {
  const measurements = await page.locator('html, body, .console-workspace-grid, .console-workspace-main, .console-restap-network-workspace, .console-restap-card').evaluateAll((nodes) => nodes.map((node) => ({ name: node.className || node.tagName, clientWidth: node.clientWidth, scrollWidth: node.scrollWidth })));
  assert.deepEqual(measurements.filter((item) => item.scrollWidth > item.clientWidth + 1), []);
}

test('RESTAP Network workspace fits desktop, 390px and 320px deterministic states', { timeout: 90_000 }, async (t) => {
  const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
  const fixture = await startFixtureServer({ active: markup(css), locked: markup(css, 'locked'), multipass: markup(css, 'active', 'multipass') });
  await mkdir(OUTPUT, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH ?? '/snap/bin/chromium', args: ['--no-sandbox'] });
  t.after(async () => { await browser.close(); await fixture.close(); });

  for (const viewport of [{ name: 'desktop', width: 1366, height: 960 }, { name: '390', width: 390, height: 844 }, { name: '320', width: 320, height: 780 }]) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    await page.goto(fixture.origin + '/active', { waitUntil: 'domcontentloaded' });
    await page.locator('.console-restap-network-workspace').waitFor({ state: 'visible' });
    await assertNoOverflow(page);
    const visibleNav = page.locator('.console-workspace-nav:visible');
    assert.equal(await visibleNav.locator('button').count(), 6);
    assert.equal(await visibleNav.locator('[data-console-view="network"]').getAttribute('aria-current'), 'page');
    assert.match(await visibleNav.locator('[data-console-view="network"]').innerText(), /Network[\s\S]*RESTAP[\s\S]*Active/i);
    assert.match(await page.locator('.console-restap-heading h2').innerText(), /Looper #617 network/);
    assert.equal(await page.locator('[data-restap-section]').count(), 8);
    assert.equal(await page.locator('body').innerText().then((text) => text.includes('intent-browser-proof')), false);
    assert.deepEqual(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })), { local: 0, session: 0 });
    assert.equal(await page.locator('[data-action="save-restap-network-policy"]').getAttribute('data-action'), 'save-restap-network-policy');
    assert.equal(await page.locator('[data-action="create-restap-network-intent"]').getAttribute('data-action'), 'create-restap-network-intent');
    assert.equal(await page.locator('[data-action="cancel-restap-network-intent"]').count(), 1);
    assert.equal(await page.locator('[data-action="stop-restap-network"]').count(), 1);

    const actionHeights = await page.locator('.console-restap-network-workspace button:visible, .console-restap-network-workspace input:visible:not([name^="topic:"]), .console-restap-network-workspace .console-restap-topic-chip span, .console-restap-network-workspace select:visible, .console-restap-network-workspace summary:visible').evaluateAll((nodes) => nodes.map((node) => ({ tag: node.tagName, height: node.getBoundingClientRect().height, type: node.getAttribute('type') })));
    assert.deepEqual(actionHeights.filter((item) => item.height < 43.5), []);
    await page.locator('[data-action="save-restap-network-policy"]').focus();
    const focus = await page.locator('[data-action="save-restap-network-policy"]').evaluate((node) => ({ outline: getComputedStyle(node).outlineStyle, width: getComputedStyle(node).outlineWidth }));
    assert.notEqual(focus.outline, 'none');
    assert.notEqual(focus.width, '0px');
    await page.screenshot({ path: join(OUTPUT, 'restap-network-' + viewport.name + '.png'), fullPage: true });
    await page.close();
  }

  const locked = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await locked.goto(fixture.origin + '/locked', { waitUntil: 'domcontentloaded' });
  const lockedWorkspace = locked.locator('.console-restap-network-workspace');
  const lockedText = await lockedWorkspace.innerText();
  assert.match(lockedText, /Network participation is unavailable/i);
  assert.match(lockedText, /Read-only preview/i);
  assert.match(lockedText, /Network permissions/i);
  assert.match(lockedText, /Activity limits/i);
  assert.match(lockedText, /Plan an introduction/i);
  assert.doesNotMatch(lockedText, /foundation|install|root cause/i);
  assert.equal(await lockedWorkspace.locator('[data-restap-section]').count(), 5);
  assert.ok(await lockedWorkspace.locator('input, select').count() >= 10);
  assert.equal(await lockedWorkspace.locator('input:not(:disabled), select:not(:disabled)').count(), 0);
  assert.equal(await lockedWorkspace.locator('[data-restap-network-policy], [data-restap-network-intent], [data-action]').count(), 0);
  assert.equal(await lockedWorkspace.locator('form, button').count(), 0);
  await assertNoOverflow(locked);
  await locked.screenshot({ path: join(OUTPUT, 'restap-network-locked-390.png'), fullPage: true });

  const multipass = await browser.newPage({ viewport: { width: 1366, height: 960 } });
  await multipass.goto(fixture.origin + '/multipass', { waitUntil: 'domcontentloaded' });
  assert.equal(await multipass.locator('.console-basic-main .console-restap-network').count(), 0);
  assert.equal(await multipass.locator('.console-basic-main > .console-identity-card').count(), 1);
});
