import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const webRoot = join(scriptDir, '..');
const distRoot = join(webRoot, 'dist');
const rosterPath = join(webRoot, 'public', 'data', 'looper-activated-roster.json');
const MAX_TOKEN_ID = 7_777n;

function canonicalTokenId(value) {
  const tokenId = String(value ?? '');
  if (!/^[1-9]\d*$/u.test(tokenId) || BigInt(tokenId) > MAX_TOKEN_ID) {
    throw new Error('Looper token ID must be a canonical positive integer.');
  }
  return tokenId;
}

function upsertHeadTag(html, pattern, tag) {
  if (pattern.test(html)) return html.replace(pattern, tag);
  return html.replace(/<\/head>/iu, `    ${tag}\n  </head>`);
}

export function renderLooperMarketplaceDetailHtml(shell, value) {
  const tokenId = canonicalTokenId(value);
  const title = `Looper #${tokenId} | The Loop`;
  const description = `Activated Looper #${tokenId} on Base. View its Multipass profile and marketplace status.`;
  const detailUrl = `https://helixa.xyz/multipass/the-loop/${tokenId}`;
  const imageUrl = `https://helixa.xyz/multipass-api/api/loopers/marketplace/preview/${tokenId}.jpg`;
  let html = String(shell);
  html = upsertHeadTag(html, /<title>[\s\S]*?<\/title>/iu, `<title>${title}</title>`);
  html = upsertHeadTag(html, /<meta\s+name="description"[^>]*>/iu, `<meta name="description" content="${description}" />`);
  html = upsertHeadTag(html, /<link\s+rel="canonical"[^>]*>/iu, `<link rel="canonical" href="${detailUrl}" />`);
  html = upsertHeadTag(html, /<meta\s+property="og:type"[^>]*>/iu, '<meta property="og:type" content="website" />');
  html = upsertHeadTag(html, /<meta\s+property="og:url"[^>]*>/iu, `<meta property="og:url" content="${detailUrl}" />`);
  html = upsertHeadTag(html, /<meta\s+property="og:title"[^>]*>/iu, `<meta property="og:title" content="${title}" />`);
  html = upsertHeadTag(html, /<meta\s+property="og:description"[^>]*>/iu, `<meta property="og:description" content="${description}" />`);
  html = upsertHeadTag(html, /<meta\s+property="og:image"[^>]*>/iu, `<meta property="og:image" content="${imageUrl}" />`);
  html = upsertHeadTag(html, /<meta\s+property="og:image:secure_url"[^>]*>/iu, `<meta property="og:image:secure_url" content="${imageUrl}" />`);
  html = upsertHeadTag(html, /<meta\s+property="og:image:type"[^>]*>/iu, '<meta property="og:image:type" content="image/jpeg" />');
  html = upsertHeadTag(html, /<meta\s+property="og:image:width"[^>]*>/iu, '<meta property="og:image:width" content="1200" />');
  html = upsertHeadTag(html, /<meta\s+property="og:image:height"[^>]*>/iu, '<meta property="og:image:height" content="630" />');
  html = upsertHeadTag(html, /<meta\s+name="twitter:card"[^>]*>/iu, '<meta name="twitter:card" content="summary_large_image" />');
  html = upsertHeadTag(html, /<meta\s+name="twitter:title"[^>]*>/iu, `<meta name="twitter:title" content="${title}" />`);
  html = upsertHeadTag(html, /<meta\s+name="twitter:description"[^>]*>/iu, `<meta name="twitter:description" content="${description}" />`);
  html = upsertHeadTag(html, /<meta\s+name="twitter:image"[^>]*>/iu, `<meta name="twitter:image" content="${imageUrl}" />`);
  html = upsertHeadTag(html, /<meta\s+name="twitter:image:src"[^>]*>/iu, `<meta name="twitter:image:src" content="${imageUrl}" />`);
  html = upsertHeadTag(html, /<meta\s+name="twitter:image:alt"[^>]*>/iu, `<meta name="twitter:image:alt" content="Looper #${tokenId} marketplace preview" />`);
  return html;
}

function normalizeRoster(value) {
  if (!value || value.schema_version !== '1.0.0' || value.chain_id !== 8453 || !Array.isArray(value.token_ids)
    || value.count !== value.token_ids.length) throw new Error('Activated Looper roster is malformed.');
  const tokenIds = value.token_ids.map(canonicalTokenId);
  if (new Set(tokenIds).size !== tokenIds.length) throw new Error('Activated Looper roster is malformed.');
  return tokenIds;
}

export async function buildLooperMarketplacePreviewRoutes({ sourcePath = join(distRoot, 'index.html'), rosterFile = rosterPath, outputRoot = join(distRoot, 'the-loop') } = {}) {
  const [shell, rosterText] = await Promise.all([readFile(sourcePath, 'utf8'), readFile(rosterFile, 'utf8')]);
  const tokenIds = normalizeRoster(JSON.parse(rosterText));
  for (const tokenId of tokenIds) {
    const output = join(outputRoot, tokenId);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, renderLooperMarketplaceDetailHtml(shell, tokenId));
  }
  return { count: tokenIds.length, outputRoot: resolve(outputRoot) };
}

export function isLooperMarketplacePreviewBuilderMain({ argvPath = process.argv[1], moduleUrl = import.meta.url } = {}) {
  return Boolean(argvPath)
    && basename(argvPath) === 'build-looper-marketplace-previews.mjs'
    && resolve(argvPath) === fileURLToPath(moduleUrl);
}

if (isLooperMarketplacePreviewBuilderMain()) {
  buildLooperMarketplacePreviewRoutes().then((result) => {
    process.stdout.write(JSON.stringify(result) + '\n');
  }).catch((error) => {
    process.stderr.write(String(error?.stack ?? error) + '\n');
    process.exitCode = 1;
  });
}
