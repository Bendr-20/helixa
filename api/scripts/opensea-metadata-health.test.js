const assert = require('node:assert/strict');
const test = require('node:test');

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  parseTokenIds,
  inspectMetadataShape,
  classifyHealth,
  buildOpenSeaAssetUrl,
  loadOpenSeaKey,
} = require('./opensea-metadata-health');

test('parseTokenIds supports comma lists and ranges with de-duplication', () => {
  assert.deepEqual(parseTokenIds('1, 3-5,4, 7'), [1, 3, 4, 5, 7]);
});

test('inspectMetadataShape accepts pure NFT metadata with Cred Score attribute', () => {
  const result = inspectMetadataShape({
    name: 'Agent #1',
    description: 'Profile',
    image: 'https://api.helixa.xyz/api/v2/aura/1.png',
    external_url: 'https://helixa.xyz/agent/1',
    attributes: [{ trait_type: 'Cred Score', value: 80 }],
  });

  assert.equal(result.validNftShape, true);
  assert.equal(result.hasCredScoreTrait, true);
  assert.deepEqual(result.problems, []);
});

test('inspectMetadataShape flags nested properties and missing Cred Score trait', () => {
  const result = inspectMetadataShape({
    name: 'Agent #1037',
    image: 'https://api.helixa.xyz/api/v2/aura/1037.png',
    properties: { agent: true },
    attributes: [{ trait_type: 'Framework', value: 'OpenClaw' }],
  });

  assert.equal(result.validNftShape, false);
  assert.equal(result.hasCredScoreTrait, false);
  assert(result.problems.includes('metadata_has_nested_properties'));
  assert(result.problems.includes('metadata_missing_cred_score_trait'));
});

test('classifyHealth marks empty tokenURI as gas backfill candidate', () => {
  const result = classifyHealth({
    tokenId: 680,
    tokenUriPresent: false,
    metadataHttpOk: true,
    imageHttpOk: true,
    metadataShape: { validNftShape: true, hasCredScoreTrait: true, problems: [] },
    openSea: { indexedImage: false, indexedCredScore: false },
  });

  assert.equal(result.status, 'needs_onchain_token_uri');
  assert.equal(result.backfillCandidate, true);
});

test('classifyHealth marks OpenSea cache lag separately from API health', () => {
  const result = classifyHealth({
    tokenId: 1037,
    tokenUriPresent: true,
    metadataHttpOk: true,
    imageHttpOk: true,
    metadataShape: { validNftShape: true, hasCredScoreTrait: true, problems: [] },
    openSea: { indexedImage: true, indexedCredScore: false },
  });

  assert.equal(result.status, 'opensea_trait_lag');
  assert.equal(result.backfillCandidate, false);
});

test('buildOpenSeaAssetUrl uses canonical Base contract path', () => {
  assert.equal(
    buildOpenSeaAssetUrl(1),
    'https://api.opensea.io/api/v2/chain/base/contract/0x2e3B541C59D38b84E3Bc54e977200230A204Fe60/nfts/1',
  );
});

test('loadOpenSeaKey accepts api_key config field', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'opensea-key-test-'));
  const file = path.join(dir, 'config.json');
  fs.writeFileSync(file, JSON.stringify({ api_key: 'test-key' }));

  assert.equal(loadOpenSeaKey({ keyFile: file }), 'test-key');
});
