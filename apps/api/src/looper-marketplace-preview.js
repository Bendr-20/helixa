import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LOOPERS_MAINNET_CONTRACT } from './loopers-owned-agents.js';
import { createLooperWalletReadContextLoader } from './looper-wallet-read-context.js';

const MAX_TOKEN_ID = 7_777n;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ARTWORK_ORIGIN = 'https://helixa.xyz';
const LOGO_URL = 'https://helixa.xyz/multipass/helixa-logo.png';
const IMAGE_MAX_BYTES = 2_000_000;
const IMAGE_TIMEOUT_MS = 8_000;

function canonicalTokenId(value) {
  const tokenId = String(value ?? '');
  if (!/^[1-9]\d*$/u.test(tokenId) || BigInt(tokenId) > MAX_TOKEN_ID) throw new Error('Invalid Looper token ID.');
  return tokenId;
}

function escapeSvg(value) {
  return String(value ?? '').replace(/[&<>"']/gu, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]);
}

function formatCompactCred(baseUnits) {
  const amount = BigInt(baseUnits);
  const decimals = 10n ** 18n;
  const units = [
    { threshold: 1_000_000n * decimals, divisor: 1_000_000n * decimals, suffix: 'M' },
    { threshold: 1_000n * decimals, divisor: 1_000n * decimals, suffix: 'K' },
  ];
  for (const unit of units) {
    if (amount >= unit.threshold) {
      const hundredths = (amount * 100n) / unit.divisor;
      const whole = hundredths / 100n;
      const fraction = (hundredths % 100n).toString().padStart(2, '0').replace(/0+$/u, '');
      return whole.toString() + (fraction ? '.' + fraction : '') + unit.suffix;
    }
  }
  const hundredths = (amount * 100n) / decimals;
  const whole = hundredths / 100n;
  const fraction = (hundredths % 100n).toString().padStart(2, '0').replace(/0+$/u, '');
  return whole.toString() + (fraction ? '.' + fraction : '');
}

function chipMarkup(labels) {
  let x = 677;
  return labels.map((label, index) => {
    const width = Math.max(104, Math.min(190, 27 + label.length * 7));
    const fill = index === 0 ? '#ecfdf3' : '#eff8ff';
    const stroke = index === 0 ? '#abefc6' : '#b2ddff';
    const color = index === 0 ? '#067647' : '#175cd3';
    const markup = `<g transform="translate(${x} 308)"><rect width="${width}" height="34" rx="7" fill="${fill}" stroke="${stroke}"/><text x="13" y="22" font-family="Arial, sans-serif" font-size="12" font-weight="900" letter-spacing="0.7" fill="${color}">${escapeSvg(label)}</text></g>`;
    x += width + 10;
    return markup;
  }).join('');
}

export function renderLooperMarketplacePreviewSvg(input = {}) {
  const tokenId = canonicalTokenId(input.tokenId);
  const held = input.heldCredBaseUnits != null && /^(0|[1-9]\d*)$/u.test(String(input.heldCredBaseUnits)) && BigInt(input.heldCredBaseUnits) > 0n
    ? formatCompactCred(input.heldCredBaseUnits) + ' CRED HELD' : null;
  const staked = input.stakedCredBaseUnits != null && /^(0|[1-9]\d*)$/u.test(String(input.stakedCredBaseUnits)) && BigInt(input.stakedCredBaseUnits) > 0n
    ? formatCompactCred(input.stakedCredBaseUnits) + ' CRED STAKED' : null;
  const labels = ['ACTIVATED', held, staked].filter(Boolean);
  const marketplaceUnavailable = input.listingStatus === 'unavailable';
  const price = input.listing?.amount && ['ETH', 'WETH'].includes(input.listing.currency)
    ? String(input.listing.amount) + ' ' + input.listing.currency
    : marketplaceUnavailable ? 'Unavailable' : 'Not listed';
  const listingState = input.listing ? 'Listed' : marketplaceUnavailable ? 'Marketplace read unavailable' : 'Marketplace status';
  const art = input.artworkDataUri
    ? `<image href="${escapeSvg(input.artworkDataUri)}" x="0" y="0" width="630" height="630" preserveAspectRatio="xMidYMid slice"/>`
    : '<rect width="630" height="630" fill="#eef2f6"/>';
  const logo = input.logoDataUri
    ? `<image href="${escapeSvg(input.logoDataUri)}" x="677" y="42" width="52" height="52" preserveAspectRatio="xMidYMid slice"/>`
    : '<rect x="677" y="42" width="52" height="52" rx="11" fill="#111827"/>';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="Looper #${tokenId} marketplace preview">
  <rect width="1200" height="630" fill="#ffffff"/>
  ${art}
  <line x1="630" y1="0" x2="630" y2="630" stroke="#e4e8ee"/>
  ${logo}
  <text x="743" y="68" font-family="Arial, sans-serif" font-size="22" font-weight="900" letter-spacing="4" fill="#101318">HELIXA</text>
  <text x="743" y="89" font-family="Arial, sans-serif" font-size="11" font-weight="800" letter-spacing="2" fill="#667085">MULTIPASS MARKETPLACE</text>
  <rect x="1090" y="51" width="64" height="35" rx="18" fill="#f1f4f7" stroke="#e3e8ef"/>
  <text x="1122" y="73" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="800" fill="#475467">BASE</text>
  <line x1="677" y1="128" x2="1154" y2="128" stroke="#e5e7eb"/>
  <text x="677" y="198" font-family="Arial, sans-serif" font-size="18" font-weight="800" fill="#1570ef">The Loopers  ●</text>
  <text x="677" y="268" font-family="Arial, sans-serif" font-size="58" font-weight="800" letter-spacing="-2" fill="#0f1728">Looper #${tokenId}</text>
  ${chipMarkup(labels)}
  <line x1="677" y1="424" x2="1154" y2="424" stroke="#e5e7eb"/>
  <text x="677" y="464" font-family="Arial, sans-serif" font-size="13" font-weight="700" letter-spacing="1" fill="#667085">CURRENT PRICE</text>
  <text x="677" y="510" font-family="Arial, sans-serif" font-size="38" font-weight="900" fill="#101828">${escapeSvg(price)}</text>
  <text x="677" y="547" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="#667085">${escapeSvg(listingState)}</text>
  <rect x="677" y="559" width="145" height="48" rx="9" fill="#1570ef"/>
  <text x="749" y="589" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="900" letter-spacing="1" fill="#ffffff">VIEW ITEM →</text>
  <text x="1154" y="589" text-anchor="end" font-family="Arial, sans-serif" font-size="12" font-weight="800" letter-spacing="1" fill="#667085">HELIXA.XYZ</text>
</svg>`;
}

async function fetchImageDataUri(fetchImpl, url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, { signal: controller.signal, redirect: 'error', headers: { accept: 'image/png,image/jpeg,image/webp' } });
    if (!response?.ok) throw new Error('Preview image unavailable.');
    const type = String(response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(type)) throw new Error('Preview image type unavailable.');
    const declared = Number(response.headers.get('content-length') ?? 0);
    if (declared > IMAGE_MAX_BYTES) throw new Error('Preview image too large.');
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > IMAGE_MAX_BYTES) throw new Error('Preview image unavailable.');
    return `data:${type};base64,${bytes.toString('base64')}`;
  } finally {
    clearTimeout(timeout);
  }
}

async function rasterizeSvg(svg) {
  const directory = await mkdtemp(join(tmpdir(), 'looper-marketplace-preview-'));
  const svgPath = join(directory, 'preview.svg');
  const jpgPath = join(directory, 'preview.jpg');
  try {
    await writeFile(svgPath, svg);
    await new Promise((resolve, reject) => {
      const child = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'svg_pipe', '-i', svgPath, '-frames:v', '1', '-q:v', '2', jpgPath], { stdio: ['ignore', 'ignore', 'pipe'] });
      const stderr = [];
      child.stderr.on('data', (chunk) => stderr.push(Buffer.from(chunk)));
      child.on('error', reject);
      child.on('close', (code) => code === 0 ? resolve() : reject(new Error('Preview rasterization failed: ' + Buffer.concat(stderr).toString('utf8').trim())));
    });
    return await readFile(jpgPath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export function createLooperMarketplacePreviewLoader({
  publicClients,
  walletContextLoader,
  listingsLoader,
  fetchImpl = fetch,
  imageLoader = fetchImageDataUri,
  rasterize = rasterizeSvg,
  now = Date.now,
  cacheTtlMs = 300_000,
} = {}) {
  const loadWallet = walletContextLoader ?? createLooperWalletReadContextLoader({ publicClients });
  if (typeof loadWallet !== 'function') throw new TypeError('Looper preview wallet reader is required.');
  const cache = new Map();
  return async function loadLooperMarketplacePreview(value) {
    const tokenId = canonicalTokenId(value);
    const cached = cache.get(tokenId);
    const current = Number(now());
    if (cached && current - cached.observedAt <= cacheTtlMs) return Buffer.from(cached.jpeg);
    const wallet = await loadWallet({
      identity: { tokenId, contract: LOOPERS_MAINNET_CONTRACT, owner: ZERO_ADDRESS },
      wallet: ZERO_ADDRESS,
    });
    if (wallet?.health !== 'verified' || wallet?.scope?.tokenId !== tokenId) throw new Error('Activated Looper wallet is unavailable.');
    const [artworkDataUri, logoDataUri, listingSnapshot] = await Promise.all([
      imageLoader(fetchImpl, `${ARTWORK_ORIGIN}/loopers/images/${tokenId}.png`),
      imageLoader(fetchImpl, LOGO_URL),
      typeof listingsLoader === 'function' ? listingsLoader().catch(() => null) : Promise.resolve(null),
    ]);
    const cred = wallet.tokens?.find((token) => token?.symbol === 'CRED' && token?.decimals === 18);
    const principal = wallet.staking?.pantheonCred?.principalBaseUnits;
    const row = listingSnapshot?.listings?.find((entry) => entry?.token_id === tokenId) ?? null;
    const listing = row?.price && ['ETH', 'WETH'].includes(row.price.currency)
      ? { amount: String(row.price.amount), currency: row.price.currency } : null;
    const svg = renderLooperMarketplacePreviewSvg({
      tokenId,
      artworkDataUri,
      logoDataUri,
      heldCredBaseUnits: cred?.balanceBaseUnits ?? null,
      stakedCredBaseUnits: /^(0|[1-9]\d*)$/u.test(String(principal ?? '')) ? String(principal) : null,
      listing,
      listingStatus: listingSnapshot ? 'available' : 'unavailable',
    });
    const jpeg = Buffer.from(await rasterize(svg));
    cache.set(tokenId, { jpeg, observedAt: current });
    return Buffer.from(jpeg);
  };
}
