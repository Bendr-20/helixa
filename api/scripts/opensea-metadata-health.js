#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { ethers } = require('ethers');

const CONTRACT_ADDRESS = '0x2e3B541C59D38b84E3Bc54e977200230A204Fe60';
const DEFAULT_RPC_URL = process.env.BASE_READ_RPC || process.env.BASE_RPC_URL || 'https://base-rpc.publicnode.com';
const DEFAULT_METADATA_BASE = process.env.HELIXA_METADATA_BASE || 'https://api.helixa.xyz/api/v2/metadata';
const DEFAULT_DELAY_MS = Number(process.env.OPENSEA_HEALTH_DELAY_MS || 700);
const ERC721_ABI = ['function tokenURI(uint256 tokenId) view returns (string)'];

function parseTokenIds(input) {
  if (!input || typeof input !== 'string') return [];
  const ids = new Set();
  for (const rawPart of input.split(',')) {
    const part = rawPart.trim();
    if (!part) continue;
    const range = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end) {
        throw new Error(`Invalid token range: ${part}`);
      }
      for (let id = start; id <= end; id += 1) ids.add(id);
      continue;
    }
    const id = Number(part);
    if (!Number.isSafeInteger(id) || id < 0) throw new Error(`Invalid token id: ${part}`);
    ids.add(id);
  }
  return [...ids].sort((a, b) => a - b);
}

function inspectMetadataShape(metadata) {
  const problems = [];
  const hasName = typeof metadata?.name === 'string' && metadata.name.trim().length > 0;
  const hasImage = typeof metadata?.image === 'string' && /^https?:\/\//i.test(metadata.image);
  const hasAttributes = Array.isArray(metadata?.attributes);
  const hasNestedProperties = metadata && Object.prototype.hasOwnProperty.call(metadata, 'properties');
  const hasCredScoreTrait = hasAttributes && metadata.attributes.some((attr) => {
    const type = String(attr?.trait_type || attr?.traitType || '').toLowerCase();
    return type === 'cred score' || type === 'cred_score';
  });

  if (!hasName) problems.push('metadata_missing_name');
  if (!hasImage) problems.push('metadata_missing_https_image');
  if (!hasAttributes) problems.push('metadata_missing_attributes');
  if (hasNestedProperties) problems.push('metadata_has_nested_properties');
  if (!hasCredScoreTrait) problems.push('metadata_missing_cred_score_trait');

  return {
    validNftShape: problems.length === 0,
    hasCredScoreTrait,
    imageUrl: hasImage ? metadata.image : null,
    problems,
  };
}

function classifyHealth({ tokenId, tokenUriPresent, metadataHttpOk, imageHttpOk, metadataShape, openSea }) {
  const problems = [];
  if (!tokenUriPresent) problems.push('token_uri_empty');
  if (!metadataHttpOk) problems.push('metadata_http_not_ok');
  if (metadataShape?.problems?.length) problems.push(...metadataShape.problems);
  if (!imageHttpOk) problems.push('image_http_not_ok');
  if (openSea) {
    if (!openSea.indexedImage) problems.push('opensea_missing_image');
    if (!openSea.indexedCredScore) problems.push('opensea_missing_cred_score_trait');
  }

  if (!tokenUriPresent) return { tokenId, status: 'needs_onchain_token_uri', backfillCandidate: true, problems };
  if (!metadataHttpOk || !metadataShape?.validNftShape) return { tokenId, status: 'metadata_api_problem', backfillCandidate: false, problems };
  if (!imageHttpOk) return { tokenId, status: 'image_problem', backfillCandidate: false, problems };
  if (openSea?.indexedImage === false) return { tokenId, status: 'opensea_image_lag', backfillCandidate: false, problems };
  if (openSea?.indexedCredScore === false) return { tokenId, status: 'opensea_trait_lag', backfillCandidate: false, problems };
  return { tokenId, status: openSea ? 'healthy' : 'api_healthy_opensea_not_checked', backfillCandidate: false, problems };
}

function buildOpenSeaAssetUrl(tokenId, contractAddress = CONTRACT_ADDRESS) {
  return `https://api.opensea.io/api/v2/chain/base/contract/${contractAddress}/nfts/${tokenId}`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJson(url, { headers = {}, timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (_) {}
    return { ok: res.ok, status: res.status, json, text };
  } finally {
    clearTimeout(timer);
  }
}

async function checkHttpOk(url) {
  if (!url) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    let res = await fetch(url, { method: 'HEAD', signal: controller.signal });
    if (res.status === 405 || res.status === 403) {
      res = await fetch(url, { method: 'GET', signal: controller.signal });
    }
    return res.ok;
  } catch (_) {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function loadOpenSeaKey({ keyFile } = {}) {
  const envKey = process.env.OPENSEA_API_KEY?.trim();
  if (envKey) return envKey;
  const file = keyFile || process.env.OPENSEA_API_KEY_FILE || path.join(os.homedir(), '.config/opensea/config.json');
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return String(data.apiKey || data.api_key || data.OPENSEA_API_KEY || '').trim() || null;
  } catch (_) {
    return null;
  }
}

function parseTokenUriValue(value) {
  const tokenUri = String(value || '');
  return {
    tokenUri,
    tokenUriPresent: tokenUri.trim().length > 0,
    tokenUriKind: tokenUri.startsWith('data:') ? 'data' : tokenUri.startsWith('http') ? 'http' : tokenUri ? 'other' : 'empty',
  };
}

function parseOpenSeaNft(json) {
  const nft = json?.nft || json;
  if (!nft || typeof nft !== 'object') return null;
  const traits = Array.isArray(nft.traits) ? nft.traits : [];
  const indexedCredScore = traits.some((trait) => {
    const type = String(trait?.trait_type || trait?.traitType || trait?.type || '').toLowerCase();
    return type === 'cred score' || type === 'cred_score';
  });
  return {
    indexedImage: Boolean(nft.image_url || nft.imageUrl || nft.display_image_url || nft.image),
    indexedCredScore,
    rawStatus: nft.identifier ? 'found' : 'unknown',
  };
}

async function checkTokenHealth(tokenId, options = {}) {
  const provider = options.provider || new ethers.JsonRpcProvider(options.rpcUrl || DEFAULT_RPC_URL, 8453, { staticNetwork: true, batchMaxCount: 1 });
  const contract = options.contract || new ethers.Contract(CONTRACT_ADDRESS, ERC721_ABI, provider);
  let tokenUriInfo;
  try {
    tokenUriInfo = parseTokenUriValue(await contract.tokenURI(tokenId));
  } catch (error) {
    tokenUriInfo = { tokenUri: null, tokenUriPresent: false, tokenUriKind: 'error', tokenUriError: error.shortMessage || error.message };
  }

  const metadataUrl = `${(options.metadataBase || DEFAULT_METADATA_BASE).replace(/\/$/, '')}/${tokenId}`;
  const metadataResponse = await fetchJson(metadataUrl);
  const metadataShape = metadataResponse.ok ? inspectMetadataShape(metadataResponse.json) : { validNftShape: false, hasCredScoreTrait: false, imageUrl: null, problems: ['metadata_http_not_ok'] };
  const imageHttpOk = metadataShape.imageUrl ? await checkHttpOk(metadataShape.imageUrl) : false;

  let openSea = null;
  if (options.includeOpenSea) {
    const key = options.openSeaApiKey || loadOpenSeaKey({ keyFile: options.openSeaKeyFile });
    if (key) {
      const openSeaResponse = await fetchJson(buildOpenSeaAssetUrl(tokenId), { headers: { 'x-api-key': key } });
      openSea = openSeaResponse.ok ? parseOpenSeaNft(openSeaResponse.json) : { indexedImage: false, indexedCredScore: false, errorStatus: openSeaResponse.status };
    }
  }

  const classification = classifyHealth({
    tokenId,
    tokenUriPresent: tokenUriInfo.tokenUriPresent,
    metadataHttpOk: metadataResponse.ok,
    imageHttpOk,
    metadataShape,
    openSea,
  });

  return {
    tokenId,
    status: classification.status,
    backfillCandidate: classification.backfillCandidate,
    problems: classification.problems,
    tokenURI: {
      present: tokenUriInfo.tokenUriPresent,
      kind: tokenUriInfo.tokenUriKind,
      error: tokenUriInfo.tokenUriError || null,
    },
    metadata: {
      url: metadataUrl,
      httpOk: metadataResponse.ok,
      shape: metadataShape,
    },
    image: {
      url: metadataShape.imageUrl,
      httpOk: imageHttpOk,
    },
    openSea,
  };
}

function parseArgs(argv) {
  const args = { includeOpenSea: false, json: true, delayMs: DEFAULT_DELAY_MS };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--tokens') args.tokens = argv[++i];
    else if (arg === '--include-opensea') args.includeOpenSea = true;
    else if (arg === '--rpc') args.rpcUrl = argv[++i];
    else if (arg === '--metadata-base') args.metadataBase = argv[++i];
    else if (arg === '--delay-ms') args.delayMs = Number(argv[++i]);
    else if (arg === '--opensea-key-file') args.openSeaKeyFile = argv[++i];
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return [
    'Usage: node api/scripts/opensea-metadata-health.js --tokens 1,81,1037 [--include-opensea]',
    '',
    'Report-only checker. It never sends transactions, refreshes OpenSea, writes DB rows, or makes paid calls.',
    'Checks: onchain tokenURI presence, Helixa metadata JSON shape, image HTTP status, and optional OpenSea indexed image/CRED trait.',
  ].join('\n');
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(usage());
    return;
  }
  const tokenIds = parseTokenIds(args.tokens);
  if (!tokenIds.length) throw new Error('Provide --tokens with comma ids or ranges, for example --tokens 1,81,1037');

  const provider = new ethers.JsonRpcProvider(args.rpcUrl || DEFAULT_RPC_URL, 8453, { staticNetwork: true, batchMaxCount: 1 });
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ERC721_ABI, provider);
  const results = [];
  for (const tokenId of tokenIds) {
    results.push(await checkTokenHealth(tokenId, { ...args, provider, contract }));
    if (args.delayMs > 0) await sleep(args.delayMs);
  }
  const summary = results.reduce((acc, result) => {
    acc.total += 1;
    acc.by_status[result.status] = (acc.by_status[result.status] || 0) + 1;
    if (result.backfillCandidate) acc.backfill_candidates.push(result.tokenId);
    return acc;
  }, { total: 0, by_status: {}, backfill_candidates: [] });
  console.log(JSON.stringify({ generated_at: new Date().toISOString(), contract: CONTRACT_ADDRESS, summary, results }, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(JSON.stringify({ error: error.message }, null, 2));
    process.exit(1);
  });
}

module.exports = {
  CONTRACT_ADDRESS,
  parseTokenIds,
  inspectMetadataShape,
  classifyHealth,
  buildOpenSeaAssetUrl,
  checkTokenHealth,
  parseOpenSeaNft,
  loadOpenSeaKey,
};
