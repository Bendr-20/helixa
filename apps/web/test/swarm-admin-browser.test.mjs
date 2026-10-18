import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright-core';
import { createInitialSwarmAdminState, renderSwarmAdmin, SWARM_ADMIN_ACTIVATION } from '../src/swarm-admin.js';

const WALLET = { configured: true, connected: true, address: SWARM_ADMIN_ACTIVATION.owner, label: 'Required owner' };

function pageMarkup(state, css) {
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>' + css + '</style></head><body><div class="record-shell swarm-admin-shell">' + renderSwarmAdmin({ state, wallet: WALLET }) + '</div></body></html>';
}

async function startFixtureServer(css) {
  const blocked = { ...createInitialSwarmAdminState(), status: 'ready', activation: {
    safeNonce: 1, versionStatus: 0, pending: true, active: false, approved: false, timelockElapsed: false, ready: false,
  } };
  const ready = { ...createInitialSwarmAdminState(), status: 'ready', activation: {
    safeNonce: 1, versionStatus: 0, pending: true, active: false, approved: false, timelockElapsed: true, ready: true,
  } };
  const pages = new Map([['/blocked', pageMarkup(blocked, css)], ['/ready', pageMarkup(ready, css)]]);
  const server = createServer((request, response) => {
    const html = pages.get(request.url);
    response.writeHead(html ? 200 : 404, { 'content-type': 'text/html; charset=utf-8' });
    response.end(html ?? 'Not found');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { origin: 'http://127.0.0.1:' + server.address().port, close: () => new Promise((resolve) => server.close(resolve)) };
}

test('Swarm Admin remains bounded and responsive before and after the onchain timelock gate', { timeout: 120_000 }, async (t) => {
  const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
  const fixture = await startFixtureServer(css);
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH ?? '/snap/bin/chromium', args: ['--no-sandbox'] });
  t.after(async () => { await browser.close(); await fixture.close(); });
  const page = await browser.newPage();

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(fixture.origin + '/blocked', { waitUntil: 'domcontentloaded' });
  assert.equal(await page.locator('[data-action="approve-swarm-activation-hash"]').count(), 0);
  assert.match(await page.locator('body').textContent(), /Completed proposal.*Onchain timelock pending/s);

  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto(fixture.origin + '/ready', { waitUntil: 'domcontentloaded' });
    assert.equal(await page.locator('[data-action="approve-swarm-activation-hash"]').count(), 1);
    assert.equal(await page.locator('input, textarea, select').count(), 0);
    const measurements = await page.evaluate(() => ({
      pageFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      cardsFit: [...document.querySelectorAll('.swarm-admin-card')].every((card) => card.scrollWidth <= card.clientWidth),
      controls: [...document.querySelectorAll('.swarm-admin button, .swarm-admin a')].map((control) => {
        const box = control.getBoundingClientRect();
        return { width: box.width, height: box.height, text: control.textContent.trim() };
      }),
    }));
    assert.equal(measurements.pageFits, true, viewport.width + 'px page must not overflow');
    assert.equal(measurements.cardsFit, true, viewport.width + 'px cards must not overflow');
    assert.deepEqual(measurements.controls.filter(({ width, height }) => width < 44 || height < 44), [], viewport.width + 'px controls must remain touch-sized');
    assert.match(await page.locator('body').textContent(), /Safe nonce 1 calling VersionRegistry.activateVersion/);

    if (process.env.CAPTURE_SWARM_ADMIN === '1') {
      const suffix = viewport.width === 390 ? 'mobile-390' : 'desktop-1440';
      const path = new URL('../../../review-artifacts/swarm-command/swarm-admin-activation-' + suffix + '.png', import.meta.url);
      await page.screenshot({ path: fileURLToPath(path), fullPage: true });
    }
  }
});
