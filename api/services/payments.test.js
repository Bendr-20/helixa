const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PRICING,
  CRED_ADDRESS,
  formatUSDPrice,
  getCredTokenAmountForUSD,
  buildCredReportAccepts,
  buildCredReportPaymentRoute,
  buildServicePricing,
} = require('./payments');

const TREASURY = '0x01b686e547F4feA03BfC9711B7B5306375735d2a';

test('agent mint is priced at one dollar', () => {
  assert.equal(PRICING.agentMint, 1);
  assert.equal(formatUSDPrice(PRICING.agentMint), '$1.00');
});

test('cred report is priced at one cent', () => {
  assert.equal(PRICING.credReport, 0.01);
  assert.equal(formatUSDPrice(PRICING.credReport), '$0.01');
});

test('deep CRED report generation is priced at fifteen cents', () => {
  assert.equal(PRICING.deepCredReport, 0.15);
  assert.equal(formatUSDPrice(PRICING.deepCredReport), '$0.15');
});

test('CRED amount can be calculated for the later native CRED payment upgrade', () => {
  assert.equal(
    getCredTokenAmountForUSD(0.01, 0.0001),
    '100000000000000000000',
  );
});

test('cred report x402 defaults to USDC only until custom ERC20 settlement is confirmed', () => {
  const accepts = buildCredReportAccepts({
    priceUSD: 0.01,
    payTo: TREASURY,
    credPriceUSD: 0.0001,
  });

  assert.equal(accepts.length, 1);
  assert.deepEqual(accepts[0], {
    scheme: 'exact',
    price: '$0.01',
    network: 'eip155:8453',
    payTo: TREASURY,
  });
});

test('cred report route config advertises the one-cent USDC x402 gate', () => {
  const route = buildCredReportPaymentRoute({
    priceUSD: 0.01,
    payTo: TREASURY,
    credPriceUSD: 0.0001,
  });

  assert.equal(route.mimeType, 'application/json');
  assert.match(route.description, /Cred Report/i);
  assert.equal(route.accepts.length, 1);
  assert.equal(route.accepts[0].price, '$0.01');
});

test('pricing metadata marks CRED payment as planned, not accepted', () => {
  assert.deepEqual(buildServicePricing(0.01, 6934.812760055479), {
    usdc: '$0.01',
    cred: {
      status: 'planned',
      estimate: {
        amount: 6934.812760055479,
        formatted: '6,935 CRED',
      },
      note: 'Native $CRED payment is planned after custom ERC20 facilitator support is confirmed.',
    },
  });
});
