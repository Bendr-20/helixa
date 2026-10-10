import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { buildLooperMarketplacePreviewRoutes, renderLooperMarketplaceDetailHtml } from '../scripts/build-looper-marketplace-previews.mjs';

const shell = `<!doctype html><html><head>
<title>Multipass</title>
<meta name="description" content="default" />
<meta property="og:url" content="https://helixa.xyz/multipass/" />
<meta property="og:title" content="Multipass" />
<meta property="og:description" content="default" />
<meta property="og:image" content="https://helixa.xyz/multipass/default.png" />
<meta property="og:image:type" content="image/png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:title" content="Multipass" />
<meta name="twitter:description" content="default" />
<meta name="twitter:image" content="https://helixa.xyz/multipass/default.png" />
</head><body><main id="app"></main></body></html>`;

test('individual Looper route emits crawler-visible token metadata and dynamic JPEG preview', () => {
  const html = renderLooperMarketplaceDetailHtml(shell, '210');
  const detailUrl = 'https://helixa.xyz/multipass/the-loop/210';
  const imageUrl = 'https://helixa.xyz/multipass-api/api/loopers/marketplace/preview/210.jpg';

  assert.match(html, /<title>Looper #210 \| The Loop<\/title>/u);
  assert.ok(html.includes(`<link rel="canonical" href="${detailUrl}" />`));
  assert.ok(html.includes(`<meta property="og:url" content="${detailUrl}" />`));
  assert.ok(html.includes('<meta property="og:title" content="Looper #210 | The Loop" />'));
  assert.ok(html.includes(`<meta property="og:image" content="${imageUrl}" />`));
  assert.ok(html.includes(`<meta property="og:image:secure_url" content="${imageUrl}" />`));
  assert.ok(html.includes('<meta property="og:image:type" content="image/jpeg" />'));
  assert.ok(html.includes(`<meta name="twitter:image" content="${imageUrl}" />`));
  assert.ok(html.includes('<meta name="twitter:image:alt" content="Looper #210 marketplace preview" />'));
  assert.doesNotMatch(html, /CRED (?:HELD|STAKED)/u, 'mutable balances belong in the verified image response, not static HTML');
});

test('individual Looper route rejects non-canonical token IDs', () => {
  for (const tokenId of ['0', '0210', '-1', '1/2', '']) {
    assert.throws(() => renderLooperMarketplaceDetailHtml(shell, tokenId), /canonical positive integer/u);
  }
});

test('builder emits extensionless token files so nginx does not redirect to a rejected trailing slash', async () => {
  const root = await mkdtemp(join(tmpdir(), 'looper-preview-routes-'));
  try {
    const sourcePath = join(root, 'index.html');
    const rosterFile = join(root, 'roster.json');
    const outputRoot = join(root, 'the-loop');
    await writeFile(sourcePath, shell);
    await writeFile(rosterFile, JSON.stringify({ schema_version: '1.0.0', chain_id: 8453, count: 1, token_ids: ['210'] }));
    await buildLooperMarketplacePreviewRoutes({ sourcePath, rosterFile, outputRoot });
    assert.equal((await stat(join(outputRoot, '210'))).isFile(), true);
    assert.match(await readFile(join(outputRoot, '210'), 'utf8'), /Looper #210/u);
    await assert.rejects(stat(join(outputRoot, '210', 'index.html')), /ENOENT|ENOTDIR/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
