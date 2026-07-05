'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  parseUsdPrice,
  parseBankrPaymentRequirements,
  classifyMintOpsHealth,
  formatAlertMessage,
  computeMintVelocity,
  buildAlertHash,
  shouldEmitAlert,
  schemaRequiresSignature,
  buildBankrSchemaUrl,
  collectContractSnapshot,
  collectHealth,
} = require('./mint-ops-health');

test('parseUsdPrice normalizes dollar strings and numbers', () => {
  assert.equal(parseUsdPrice('$1.00'), 1);
  assert.equal(parseUsdPrice('1'), 1);
  assert.equal(parseUsdPrice(0.01), 0.01);
  assert.equal(parseUsdPrice('free'), 0);
});

test('parseBankrPaymentRequirements extracts the Base USDC exact payment option', () => {
  const result = parseBankrPaymentRequirements({
    x402Version: 2,
    accepts: [{
      scheme: 'exact',
      network: 'eip155:8453',
      amount: '1000000',
      maxAmountRequired: '1000000',
      payTo: '0x8AEE621035D93Deb3C0C1177fac252dC2dd501a0',
      asset: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    }],
  });

  assert.equal(result.amountAtomic, '1000000');
  assert.equal(result.amountUsd, 1);
  assert.equal(result.network, 'eip155:8453');
  assert.equal(result.payTo, '0x8AEE621035D93Deb3C0C1177fac252dC2dd501a0');
});

test('classifyMintOpsHealth stays ok for healthy paid mint posture', () => {
  const result = classifyMintOpsHealth({
    contract: { totalAgents: 5216, mintPriceWei: '569858205032133', ownerEth: 0.01, lastMintAgeMinutes: 5 },
    apiPricing: { agentMintUsd: 1, httpOk: true },
    bankr: { httpStatus: 402, amountUsd: 1, amountAtomic: '1000000', asset: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', schemaRequiresSignature: true, active: true },
    velocity: { mintedSinceLastCheck: 0, mintedPerHour: 0 },
  });

  assert.equal(result.status, 'ok');
  assert.deepEqual(result.critical, []);
  assert.deepEqual(result.warnings, []);
});

test('classifyMintOpsHealth flags free mint bypasses and route schema drift', () => {
  const result = classifyMintOpsHealth({
    contract: { totalAgents: 5216, mintPriceWei: '0', ownerEth: 0.00001, lastMintAgeMinutes: 5 },
    apiPricing: { agentMintUsd: 0, httpOk: true },
    bankr: { httpStatus: 402, amountUsd: 0.5, amountAtomic: '500000', asset: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', schemaRequiresSignature: false, active: true },
    velocity: { mintedSinceLastCheck: 125, mintedPerHour: 250 },
  });

  assert.equal(result.status, 'critical');
  assert(result.critical.some((item) => item.code === 'contract_mint_price_zero'));
  assert(result.critical.some((item) => item.code === 'api_mint_price_not_one_usdc'));
  assert(result.critical.some((item) => item.code === 'bankr_mint_price_not_one_usdc'));
  assert(result.critical.some((item) => item.code === 'bankr_schema_missing_wallet_signature'));
  assert(result.critical.some((item) => item.code === 'mint_spike_detected'));
  assert(result.warnings.some((item) => item.code === 'owner_gas_low'));
});

test('computeMintVelocity compares current state to prior state', () => {
  const result = computeMintVelocity({
    nowMs: 1_000_000,
    totalAgents: 110,
    previousState: { checkedAtMs: 640_000, totalAgents: 100 },
  });

  assert.equal(result.mintedSinceLastCheck, 10);
  assert.equal(result.minutesSinceLastCheck, 6);
  assert.equal(result.mintedPerHour, 100);
});

test('formatAlertMessage returns empty text when posture is ok', () => {
  assert.equal(formatAlertMessage({ status: 'ok', critical: [], warnings: [], snapshot: { totalAgents: 5216 } }), '');
});

test('formatAlertMessage summarizes critical and warning items', () => {
  const text = formatAlertMessage({
    status: 'critical',
    critical: [{ code: 'contract_mint_price_zero', message: 'Contract mint price is 0 ETH' }],
    warnings: [{ code: 'owner_gas_low', message: 'Owner gas is low' }],
    snapshot: { totalAgents: 5216, bankrAmountUsd: 1, apiMintUsd: 1, ownerEth: 0.00001 },
  });

  assert(text.includes('Mint ops alert'));
  assert(text.includes('Contract mint price is 0 ETH'));
  assert(text.includes('Owner gas is low'));
  assert(text.includes('totalAgents: 5216'));
});

test('buildAlertHash changes when alert codes or details change', () => {
  const base = { status: 'warning', critical: [], warnings: [{ code: 'owner_gas_low', message: 'Owner gas is low: 0.00002 ETH' }] };
  const changedCode = { status: 'critical', critical: [{ code: 'bankr_mint_price_not_one_usdc', message: 'bad' }], warnings: [] };
  const changedDetails = { status: 'warning', critical: [], warnings: [{ code: 'owner_gas_low', message: 'Owner gas is low: 0.000001 ETH' }] };

  assert.notEqual(buildAlertHash(base), buildAlertHash(changedCode));
  assert.notEqual(buildAlertHash(base), buildAlertHash(changedDetails));
});

test('shouldEmitAlert suppresses unchanged alerts inside cooldown', () => {
  const report = { status: 'warning', critical: [], warnings: [{ code: 'owner_gas_low', message: 'low' }] };
  const previousState = { lastAlertHash: buildAlertHash(report), lastAlertAtMs: 1_000 };

  assert.equal(shouldEmitAlert({ report, previousState, nowMs: 2_000, cooldownMs: 10_000 }), false);
});

test('shouldEmitAlert emits when alert changes, cooldown expires, or status recovered then recurred', () => {
  const report = { status: 'critical', critical: [{ code: 'contract_mint_price_zero', message: 'free' }], warnings: [] };
  const previousState = { lastAlertHash: 'different', lastAlertAtMs: 1_000 };

  assert.equal(shouldEmitAlert({ report, previousState, nowMs: 2_000, cooldownMs: 10_000 }), true);
  assert.equal(shouldEmitAlert({ report, previousState: { lastAlertHash: buildAlertHash(report), lastAlertAtMs: 1_000 }, nowMs: 20_000, cooldownMs: 10_000 }), true);
  assert.equal(shouldEmitAlert({ report, previousState: { status: 'ok', lastAlertHash: buildAlertHash(report), lastAlertAtMs: 1_000 }, nowMs: 2_000, cooldownMs: 10_000 }), true);
});

test('classifyMintOpsHealth flags a non-USDC Bankr payment asset', () => {
  const result = classifyMintOpsHealth({
    contract: { totalAgents: 5216, mintPriceWei: '569858205032133', ownerEth: 0.01 },
    apiPricing: { agentMintUsd: 1, httpOk: true },
    bankr: { httpStatus: 402, amountUsd: 1, amountAtomic: '1000000', asset: '0x0000000000000000000000000000000000000000', schemaRequiresSignature: true, active: true },
    velocity: { mintedSinceLastCheck: 0, mintedPerHour: 0 },
  });

  assert.equal(result.status, 'critical');
  assert(result.critical.some((item) => item.code === 'bankr_mint_asset_not_usdc'));
});

test('schemaRequiresSignature handles legacy string schema and JSON schema required arrays', () => {
  assert.equal(schemaRequiresSignature({ schema: { input: { signatureTimestamp: 'string (required)', signature: 'string (required)' } } }), true);
  assert.equal(schemaRequiresSignature({ schema: { input: { required: ['to', 'signatureTimestamp', 'signature'] } } }), true);
  assert.equal(schemaRequiresSignature({ schema: { input: { required: ['to'] } } }), false);
});

test('buildBankrSchemaUrl maps Bankr-hosted mint URLs to the schema API', () => {
  assert.equal(
    buildBankrSchemaUrl('https://x402.bankr.bot/0xabc/mint'),
    'https://api.bankr.bot/x402/endpoints/schema/0xabc/mint',
  );
});

test('collectContractSnapshot falls back to the next RPC before failing the monitor', async () => {
  const calls = [];
  const result = await collectContractSnapshot({
    rpcUrls: ['https://bad-rpc.example', 'https://good-rpc.example'],
    collectFromRpc: async (rpcUrl) => {
      calls.push(rpcUrl);
      if (rpcUrl.includes('bad-rpc')) throw new Error('408 Request Timeout');
      return { totalAgents: 5220, mintPriceWei: '569858205032133', ownerEth: 0.01 };
    },
  });

  assert.deepEqual(calls, ['https://bad-rpc.example', 'https://good-rpc.example']);
  assert.equal(result.rpcUrl, 'https://good-rpc.example');
  assert.deepEqual(result.rpcFailures, [{ rpcUrl: 'https://bad-rpc.example', error: '408 Request Timeout' }]);
});

test('collectContractSnapshot timeboxes a stuck RPC before trying the next fallback', async () => {
  const calls = [];
  const result = await collectContractSnapshot({
    rpcUrls: ['https://stuck-rpc.example', 'https://good-rpc.example'],
    rpcTimeoutMs: 1,
    collectFromRpc: async (rpcUrl) => {
      calls.push(rpcUrl);
      if (rpcUrl.includes('stuck-rpc')) return new Promise(() => {});
      return { totalAgents: 5220, mintPriceWei: '569858205032133', ownerEth: 0.01 };
    },
  });

  assert.deepEqual(calls, ['https://stuck-rpc.example', 'https://good-rpc.example']);
  assert.equal(result.rpcUrl, 'https://good-rpc.example');
  assert.deepEqual(result.rpcFailures, [{ rpcUrl: 'https://stuck-rpc.example', error: 'RPC snapshot timed out after 1ms' }]);
});

test('collectHealth converts collector failures into classified critical alerts', async () => {
  const report = await collectHealth({
    nowMs: 2_000,
    previousState: { checkedAtMs: 1_000, totalAgents: 5216 },
    writeState: false,
    collectors: {
      contract: async () => { throw new Error('RPC timeout'); },
      apiPricing: async () => ({ httpOk: true, status: 200, agentMintUsd: 1 }),
      bankr: async () => ({ httpStatus: 402, amountUsd: 1, amountAtomic: '1000000', asset: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', active: true, schemaRequiresSignature: true }),
    },
  });

  assert.equal(report.status, 'critical');
  assert(report.critical.some((item) => item.code === 'contract_snapshot_unreachable'));
});
