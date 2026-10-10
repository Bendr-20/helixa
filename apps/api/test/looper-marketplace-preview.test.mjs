import assert from 'node:assert/strict';
import test from 'node:test';

import { createMemoryStore, createMultipassApi } from '../src/index.js';
import { renderLooperMarketplacePreviewSvg } from '../src/looper-marketplace-preview.js';

const EMPTY_STORE = createMemoryStore();

function previewData(overrides = {}) {
  return {
    tokenId: '210',
    artworkDataUri: 'data:image/png;base64,aGVsbG8=',
    logoDataUri: 'data:image/png;base64,d29ybGQ=',
    heldCredBaseUnits: '73170731707317073170731',
    stakedCredBaseUnits: '4500000000000000000000000',
    listing: { amount: '0.03', currency: 'ETH' },
    ...overrides,
  };
}

test('preview SVG labels independently verified held and staked CRED', () => {
  const svg = renderLooperMarketplacePreviewSvg(previewData());
  assert.match(svg, />73\.17K CRED HELD</u);
  assert.match(svg, />4\.5M CRED STAKED</u);
  assert.match(svg, />0\.03 ETH</u);
  assert.match(svg, />Looper #210</u);
  assert.match(svg, /data:image\/png;base64,aGVsbG8=/u);
  assert.match(svg, /data:image\/png;base64,d29ybGQ=/u);
});

test('preview SVG omits any unverified or zero CRED category instead of relabeling it', () => {
  const heldOnly = renderLooperMarketplacePreviewSvg(previewData({ stakedCredBaseUnits: null }));
  assert.match(heldOnly, /CRED HELD/u);
  assert.doesNotMatch(heldOnly, /CRED STAKED/u);

  const stakedOnly = renderLooperMarketplacePreviewSvg(previewData({ heldCredBaseUnits: '0' }));
  assert.doesNotMatch(stakedOnly, /CRED HELD/u);
  assert.match(stakedOnly, /CRED STAKED/u);
});

test('preview distinguishes a verified unlisted token from an unavailable marketplace read', () => {
  const unlisted = renderLooperMarketplacePreviewSvg(previewData({ listing: null, listingStatus: 'available' }));
  assert.match(unlisted, />Not listed</u);

  const unavailable = renderLooperMarketplacePreviewSvg(previewData({ listing: null, listingStatus: 'unavailable' }));
  assert.match(unavailable, />Unavailable</u);
  assert.match(unavailable, />Marketplace read unavailable</u);
  assert.doesNotMatch(unavailable, />Not listed</u);
});

test('public Looper preview route returns the injected verified JPEG and rejects noncanonical paths', async () => {
  const calls = [];
  const api = createMultipassApi({
    store: EMPTY_STORE,
    baseUrl: 'https://helixa.xyz',
    looperMarketplacePreviewLoader: async (tokenId) => {
      calls.push(tokenId);
      return Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    },
  });

  const response = await api.handleRequest(new Request('https://helixa.xyz/api/loopers/marketplace/preview/210.jpg'));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/jpeg');
  assert.equal(response.headers.get('cache-control'), 'public, max-age=300');
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [0xff, 0xd8, 0xff, 0xd9]);
  assert.deepEqual(calls, ['210']);

  for (const path of ['0210.jpg', '0.jpg', '210.png', '210.jpg/extra']) {
    const rejected = await api.handleRequest(new Request(`https://helixa.xyz/api/loopers/marketplace/preview/${path}`));
    assert.equal(rejected.status, 404);
  }
  assert.deepEqual(calls, ['210']);
});
