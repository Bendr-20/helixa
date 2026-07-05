#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { ethers } = require('ethers');

const CONTRACT_ADDRESS = '0x2e3B541C59D38b84E3Bc54e977200230A204Fe60';
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const DEFAULT_RPC_URL = process.env.BASE_READ_RPC || process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const DEFAULT_RPC_FALLBACK_URLS = [
  ...parseRpcUrlList(process.env.BASE_READ_RPC_FALLBACKS || process.env.BASE_RPC_FALLBACKS),
  'https://mainnet.base.org',
  'https://base-rpc.publicnode.com',
  'https://base.llamarpc.com',
];
const DEFAULT_API_PRICING_URL = process.env.HELIXA_PRICING_URL || 'https://api.helixa.xyz/api/v2/pricing';
const DEFAULT_BANKR_MINT_URL = process.env.BANKR_MINT_URL || 'https://x402.bankr.bot/0xb92d2ab129072890b23ee3b1baff7c501cff9e49/mint';
const DEFAULT_STATE_FILE = process.env.MINT_OPS_STATE_FILE || path.join(os.homedir(), '.openclaw/workspace/memory/mint-ops-health-state.json');
const EXPECTED_USDC_ATOMS = '1000000';
const EXPECTED_USD = 1;
const DEFAULT_MIN_OWNER_ETH = Number(process.env.MINT_OPS_MIN_OWNER_ETH || '0.00005');
const DEFAULT_SPIKE_MINTS = Number(process.env.MINT_OPS_SPIKE_MINTS || '50');
const DEFAULT_SPIKE_PER_HOUR = Number(process.env.MINT_OPS_SPIKE_PER_HOUR || '100');
const DEFAULT_ALERT_COOLDOWN_MS = Number(process.env.MINT_OPS_ALERT_COOLDOWN_MS || String(6 * 60 * 60 * 1000));
const DEFAULT_RPC_TIMEOUT_MS = normalizePositiveInteger(process.env.MINT_OPS_RPC_TIMEOUT_MS, 15000, 1, 60000);
const MIN_CONTRACT_MINT_PRICE_WEI = BigInt(process.env.MINT_OPS_MIN_CONTRACT_MINT_PRICE_WEI || '100000000000000');

const CONTRACT_ABI = [
  'function totalAgents() view returns (uint256)',
  'function mintPrice() view returns (uint256)',
  'function owner() view returns (address)',
  'function getAgent(uint256 tokenId) view returns (tuple(address agentAddress,string name,string framework,uint64 mintedAt,bool verified,bool soulbound,uint8 origin,uint16 generation,uint256 parentId,uint16 mutationCount,string currentVersion))',
];

function parseUsdPrice(value) {
  if (typeof value === 'number') return value;
  if (value == null) return null;
  const text = String(value).trim().toLowerCase();
  if (text === 'free') return 0;
  const match = text.replace(/,/g, '').match(/\$?([0-9]+(?:\.[0-9]+)?)/);
  return match ? Number(match[1]) : null;
}

function parseBankrPaymentRequirements(body) {
  const accepts = Array.isArray(body?.accepts) ? body.accepts : [];
  const option = accepts.find((item) => item?.scheme === 'exact' && item?.network === 'eip155:8453');
  if (!option) return null;
  const amountAtomic = String(option.amount || option.maxAmountRequired || '0');
  return {
    x402Version: body.x402Version || null,
    amountAtomic,
    amountUsd: Number(amountAtomic) / 1_000_000,
    network: option.network,
    scheme: option.scheme,
    payTo: option.payTo || null,
    asset: option.asset || null,
    resource: option.resource || null,
  };
}

function computeMintVelocity({ nowMs = Date.now(), totalAgents, previousState }) {
  const currentTotalAgents = Number(totalAgents);
  if (!Number.isFinite(currentTotalAgents) || !previousState || !Number.isFinite(Number(previousState.totalAgents)) || !Number.isFinite(Number(previousState.checkedAtMs))) {
    return { mintedSinceLastCheck: 0, minutesSinceLastCheck: null, mintedPerHour: 0 };
  }
  const minutesSinceLastCheck = Math.max(0, (nowMs - Number(previousState.checkedAtMs)) / 60_000);
  const mintedSinceLastCheck = Math.max(0, currentTotalAgents - Number(previousState.totalAgents));
  const mintedPerHour = minutesSinceLastCheck > 0 ? mintedSinceLastCheck / (minutesSinceLastCheck / 60) : 0;
  return {
    mintedSinceLastCheck,
    minutesSinceLastCheck: Number(minutesSinceLastCheck.toFixed(2)),
    mintedPerHour: Number(mintedPerHour.toFixed(2)),
  };
}

function addProblem(list, code, message, details = {}) {
  list.push({ code, message, ...details });
}

function classifyMintOpsHealth(input, thresholds = {}) {
  const critical = [];
  const warnings = [];
  const minOwnerEth = thresholds.minOwnerEth ?? DEFAULT_MIN_OWNER_ETH;
  const spikeMints = thresholds.spikeMints ?? DEFAULT_SPIKE_MINTS;
  const spikePerHour = thresholds.spikePerHour ?? DEFAULT_SPIKE_PER_HOUR;

  if (input.contract?.error) {
    addProblem(critical, 'contract_snapshot_unreachable', `Contract snapshot failed: ${input.contract.error}`);
  } else {
    const mintPriceWei = BigInt(input.contract?.mintPriceWei ?? '0');
    if (mintPriceWei === 0n) {
      addProblem(critical, 'contract_mint_price_zero', 'Contract direct mint price is 0 ETH');
    } else if (mintPriceWei < MIN_CONTRACT_MINT_PRICE_WEI) {
      addProblem(critical, 'contract_mint_price_too_low', `Contract direct mint price is too low: ${mintPriceWei.toString()} wei`);
    }
  }

  if (input.apiPricing?.error || !input.apiPricing?.httpOk) {
    addProblem(critical, 'api_pricing_unreachable', input.apiPricing?.error ? `Helixa pricing endpoint failed: ${input.apiPricing.error}` : 'Helixa pricing endpoint is unreachable');
  } else if (input.apiPricing.agentMintUsd !== EXPECTED_USD) {
    addProblem(critical, 'api_mint_price_not_one_usdc', `API mint price is ${input.apiPricing.agentMintUsd ?? 'unknown'} USDC, expected 1`);
  }

  if (input.bankr?.error) {
    addProblem(critical, 'bankr_mint_route_unreachable', `Bankr mint route check failed: ${input.bankr.error}`);
  } else {
    if (input.bankr?.httpStatus !== 402) {
      addProblem(critical, 'bankr_mint_route_not_payment_gated', `Bankr mint route returned HTTP ${input.bankr?.httpStatus ?? 'unknown'}, expected 402`);
    }
    if (input.bankr?.amountAtomic !== EXPECTED_USDC_ATOMS || input.bankr?.amountUsd !== EXPECTED_USD) {
      addProblem(critical, 'bankr_mint_price_not_one_usdc', `Bankr mint route price is ${input.bankr?.amountUsd ?? 'unknown'} USDC, expected 1`);
    }
    if (String(input.bankr?.asset || '').toLowerCase() !== USDC_BASE.toLowerCase()) {
      addProblem(critical, 'bankr_mint_asset_not_usdc', `Bankr mint route asset is ${input.bankr?.asset || 'unknown'}, expected Base USDC`);
    }
    if (!input.bankr?.active) {
      addProblem(critical, 'bankr_schema_unreachable', 'Bankr mint schema endpoint is unreachable or inactive');
    }
    if (!input.bankr?.schemaRequiresSignature) {
      addProblem(critical, 'bankr_schema_missing_wallet_signature', 'Bankr mint schema does not require wallet signature fields');
    }
  }

  if (!input.contract?.error && Number.isFinite(Number(input.contract?.ownerEth)) && Number(input.contract.ownerEth) < minOwnerEth) {
    addProblem(warnings, 'owner_gas_low', `Backend owner gas is low: ${input.contract.ownerEth} ETH`, { thresholdEth: minOwnerEth });
  }

  if (Number(input.velocity?.mintedSinceLastCheck ?? 0) >= spikeMints || Number(input.velocity?.mintedPerHour ?? 0) >= spikePerHour) {
    addProblem(critical, 'mint_spike_detected', `Mint spike detected: +${input.velocity.mintedSinceLastCheck} since last check (${input.velocity.mintedPerHour}/hr)`);
  }

  return {
    status: critical.length ? 'critical' : warnings.length ? 'warning' : 'ok',
    critical,
    warnings,
  };
}

function formatAlertMessage(report) {
  if (!report || report.status === 'ok') return '';
  const lines = ['Mint ops alert'];
  const snapshot = report.snapshot || {};
  lines.push(`Status: ${report.status}`);
  lines.push(`Snapshot: totalAgents: ${snapshot.totalAgents ?? 'unknown'}, API mint: $${snapshot.apiMintUsd ?? 'unknown'}, Bankr mint: $${snapshot.bankrAmountUsd ?? 'unknown'}, owner gas: ${snapshot.ownerEth ?? 'unknown'} ETH`);
  if (report.critical?.length) {
    lines.push('Critical:');
    for (const item of report.critical) lines.push(`- ${item.message}`);
  }
  if (report.warnings?.length) {
    lines.push('Warnings:');
    for (const item of report.warnings) lines.push(`- ${item.message}`);
  }
  return lines.join('\n');
}

function stableAlertItem(item) {
  return Object.keys(item || {}).sort().reduce((acc, key) => {
    acc[key] = item[key];
    return acc;
  }, {});
}

function buildAlertHash(report) {
  if (!report || report.status === 'ok') return '';
  const critical = (report.critical || []).map(stableAlertItem).sort((a, b) => `${a.code}:${a.message}`.localeCompare(`${b.code}:${b.message}`));
  const warnings = (report.warnings || []).map(stableAlertItem).sort((a, b) => `${a.code}:${a.message}`.localeCompare(`${b.code}:${b.message}`));
  return JSON.stringify({ status: report.status, critical, warnings });
}

function shouldEmitAlert({ report, previousState, nowMs = Date.now(), cooldownMs = DEFAULT_ALERT_COOLDOWN_MS }) {
  const hash = buildAlertHash(report);
  if (!hash) return false;
  if (previousState?.status === 'ok') return true;
  if (!previousState?.lastAlertHash || previousState.lastAlertHash !== hash) return true;
  const lastAlertAtMs = Number(previousState.lastAlertAtMs || 0);
  return !lastAlertAtMs || nowMs - lastAlertAtMs >= cooldownMs;
}

function readState(file = DEFAULT_STATE_FILE) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return null;
  }
}

function writeState(state, file = DEFAULT_STATE_FILE) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`);
}

function schemaRequiresSignature(schema) {
  const input = schema?.schema?.input;
  if (!input) return false;
  if (Array.isArray(input.required)) {
    return input.required.includes('signatureTimestamp') && input.required.includes('signature');
  }
  return Boolean(input.signatureTimestamp && input.signature && /required/i.test(String(input.signatureTimestamp)) && /required/i.test(String(input.signature)));
}

function buildBankrSchemaUrl(mintUrl = DEFAULT_BANKR_MINT_URL) {
  const parsed = new URL(mintUrl);
  const parts = parsed.pathname.split('/').filter(Boolean);
  if (parts.length < 2) throw new Error(`Invalid Bankr mint URL: ${mintUrl}`);
  return `https://api.bankr.bot/x402/endpoints/schema/${parts[0]}/${parts[1]}`;
}

async function fetchJson(url, { method = 'GET', body, headers = {}, timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method, body, headers, signal: controller.signal });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (_) {}
    return { ok: res.ok, status: res.status, json, text };
  } finally {
    clearTimeout(timer);
  }
}

async function collectContractSnapshot({ rpcUrl = DEFAULT_RPC_URL, rpcUrls, rpcTimeoutMs = DEFAULT_RPC_TIMEOUT_MS, collectFromRpc = collectContractSnapshotFromRpc } = {}) {
  const urls = normalizeRpcUrls(rpcUrls ?? [rpcUrl, ...DEFAULT_RPC_FALLBACK_URLS]);
  const timeoutMs = normalizePositiveInteger(rpcTimeoutMs, DEFAULT_RPC_TIMEOUT_MS, 1, 60000);
  const rpcFailures = [];

  for (const url of urls) {
    try {
      const snapshot = await withRpcSnapshotTimeout(Promise.resolve().then(() => collectFromRpc(url)), timeoutMs);
      return { ...snapshot, rpcUrl: url, rpcFailures };
    } catch (error) {
      rpcFailures.push({ rpcUrl: url, error: error?.message || String(error) });
    }
  }

  throw new Error(`All Base RPC snapshots failed: ${rpcFailures.map((failure) => `${failure.rpcUrl}: ${failure.error}`).join('; ')}`);
}

async function withRpcSnapshotTimeout(promise, timeoutMs) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`RPC snapshot timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function collectContractSnapshotFromRpc(rpcUrl) {
  const provider = new ethers.JsonRpcProvider(rpcUrl, 8453, { staticNetwork: true, batchMaxCount: 1 });
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
  const [totalAgentsRaw, mintPriceRaw, owner] = await Promise.all([
    contract.totalAgents(),
    contract.mintPrice(),
    contract.owner(),
  ]);
  const totalAgents = Number(totalAgentsRaw);
  let latestAgent = null;
  if (totalAgents > 0) {
    const latestTokenId = totalAgents - 1;
    const agent = await contract.getAgent(latestTokenId);
    latestAgent = {
      tokenId: latestTokenId,
      name: agent.name,
      framework: agent.framework,
      mintedAt: Number(agent.mintedAt),
      mintedAtIso: new Date(Number(agent.mintedAt) * 1000).toISOString(),
      origin: Number(agent.origin),
    };
  }
  const ownerBalanceWei = await provider.getBalance(owner);
  const lastMintAgeMinutes = latestAgent ? Number(((Date.now() - latestAgent.mintedAt * 1000) / 60_000).toFixed(2)) : null;
  return {
    contractAddress: CONTRACT_ADDRESS,
    totalAgents,
    mintPriceWei: mintPriceRaw.toString(),
    mintPriceEth: Number(ethers.formatEther(mintPriceRaw)),
    owner,
    ownerEth: Number(ethers.formatEther(ownerBalanceWei)),
    latestAgent,
    lastMintAgeMinutes,
  };
}

function parseRpcUrlList(value) {
  if (Array.isArray(value)) return value.flatMap(parseRpcUrlList);
  return String(value || '')
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeRpcUrls(values) {
  const seen = new Set();
  const urls = [];
  for (const url of parseRpcUrlList(values)) {
    if (!/^https?:\/\//i.test(url)) continue;
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    urls.push(url);
  }
  return urls.length ? urls : ['https://mainnet.base.org'];
}

function normalizePositiveInteger(value, fallback, min = 1, max = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min) return fallback;
  return Math.min(Math.floor(number), max);
}

async function collectApiPricing({ pricingUrl = DEFAULT_API_PRICING_URL } = {}) {
  const res = await fetchJson(pricingUrl);
  const agentMintUsd = parseUsdPrice(res.json?.services?.agentMint?.usdc);
  return { httpOk: res.ok, status: res.status, agentMintUsd, url: pricingUrl };
}

async function collectBankrMint({ mintUrl = DEFAULT_BANKR_MINT_URL } = {}) {
  const probe = await fetchJson(mintUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  const payment = parseBankrPaymentRequirements(probe.json) || {};
  const schemaUrl = buildBankrSchemaUrl(mintUrl);
  const schema = await fetchJson(schemaUrl);
  return {
    url: mintUrl,
    httpStatus: probe.status,
    amountAtomic: payment.amountAtomic || null,
    amountUsd: payment.amountUsd ?? null,
    network: payment.network || null,
    payTo: payment.payTo || null,
    asset: payment.asset || null,
    active: schema.ok && schema.json?.success === true,
    schemaStatus: schema.status,
    schemaRequiresSignature: schema.ok && schemaRequiresSignature(schema.json),
  };
}

async function safeCollect(name, collector) {
  try {
    return await collector();
  } catch (error) {
    return { error: error?.message || String(error), source: name };
  }
}

async function collectHealth(options = {}) {
  const nowMs = options.nowMs || Date.now();
  const previousState = options.previousState === undefined ? readState(options.stateFile) : options.previousState;
  const collectors = options.collectors || {};
  const [contract, apiPricing, bankr] = await Promise.all([
    safeCollect('contract', collectors.contract || (() => collectContractSnapshot(options))),
    safeCollect('apiPricing', collectors.apiPricing || (() => collectApiPricing(options))),
    safeCollect('bankr', collectors.bankr || (() => collectBankrMint(options))),
  ]);
  const velocity = computeMintVelocity({ nowMs, totalAgents: contract.totalAgents, previousState });
  const classification = classifyMintOpsHealth({ contract, apiPricing, bankr, velocity }, options.thresholds);
  const report = {
    generated_at: new Date(nowMs).toISOString(),
    status: classification.status,
    critical: classification.critical,
    warnings: classification.warnings,
    snapshot: {
      totalAgents: contract.totalAgents ?? null,
      latestTokenId: contract.latestAgent?.tokenId ?? null,
      latestMintedAt: contract.latestAgent?.mintedAtIso ?? null,
      latestName: contract.latestAgent?.name ?? null,
      contractMintPriceEth: contract.mintPriceEth ?? null,
      contractMintPriceWei: contract.mintPriceWei ?? null,
      apiMintUsd: apiPricing.agentMintUsd ?? null,
      bankrAmountUsd: bankr.amountUsd ?? null,
      bankrPayTo: bankr.payTo ?? null,
      owner: contract.owner ?? null,
      ownerEth: contract.ownerEth ?? null,
      mintedSinceLastCheck: velocity.mintedSinceLastCheck,
      mintedPerHour: velocity.mintedPerHour,
    },
    contract,
    apiPricing,
    bankr,
    velocity,
  };
  if (options.writeState !== false) {
    writeState({ checkedAtMs: nowMs, checkedAt: report.generated_at, totalAgents: report.snapshot.totalAgents ?? previousState?.totalAgents ?? null, status: report.status }, options.stateFile);
  }
  return report;
}

function parseArgs(argv) {
  const args = { json: true, writeState: true };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--alert-only') args.alertOnly = true;
    else if (arg === '--strict') args.strict = true;
    else if (arg === '--no-write-state') args.writeState = false;
    else if (arg === '--state-file') args.stateFile = argv[++i];
    else if (arg === '--alert-cooldown-ms') args.alertCooldownMs = Number(argv[++i]);
    else if (arg === '--rpc') args.rpcUrl = argv[++i];
    else if (arg === '--bankr-url') args.mintUrl = argv[++i];
    else if (arg === '--pricing-url') args.pricingUrl = argv[++i];
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return [
    'Usage: node api/scripts/mint-ops-health.js [--alert-only] [--strict] [--no-write-state]',
    '',
    'Report-only checker. It never sends transactions or makes paid x402 calls.',
    'Checks: contract mint price, totalAgents/latest mint, API USDC mint price, Bankr x402 price/schema, backend owner gas, and mint velocity.',
  ].join('\n');
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(usage());
    return;
  }
  const previousState = readState(args.stateFile);
  const nowMs = Date.now();
  const report = await collectHealth({ ...args, previousState, nowMs, writeState: false });
  const emitAlert = shouldEmitAlert({
    report,
    previousState,
    nowMs,
    cooldownMs: args.alertCooldownMs ?? DEFAULT_ALERT_COOLDOWN_MS,
  });

  if (args.alertOnly) {
    const message = emitAlert ? formatAlertMessage(report) : '';
    if (message) console.log(message);
  } else {
    console.log(JSON.stringify(report, null, 2));
  }

  if (args.writeState !== false) {
    const nextState = {
      ...(previousState || {}),
      checkedAtMs: nowMs,
      checkedAt: report.generated_at,
      totalAgents: report.snapshot.totalAgents ?? previousState?.totalAgents ?? null,
      status: report.status,
    };
    if (report.status === 'ok') {
      delete nextState.lastAlertHash;
      delete nextState.lastAlertAtMs;
      delete nextState.lastAlertAt;
    }
    if (emitAlert) {
      nextState.lastAlertHash = buildAlertHash(report);
      nextState.lastAlertAtMs = nowMs;
      nextState.lastAlertAt = report.generated_at;
    }
    writeState(nextState, args.stateFile);
  }

  if (args.strict && report.status === 'critical') process.exitCode = 2;
  else if (args.strict && report.status === 'warning') process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(JSON.stringify({ status: 'critical', error: error.message, stack: error.stack }, null, 2));
    process.exitCode = 2;
  });
}

module.exports = {
  parseUsdPrice,
  parseBankrPaymentRequirements,
  computeMintVelocity,
  classifyMintOpsHealth,
  formatAlertMessage,
  buildAlertHash,
  shouldEmitAlert,
  schemaRequiresSignature,
  buildBankrSchemaUrl,
  collectContractSnapshot,
  collectHealth,
};
