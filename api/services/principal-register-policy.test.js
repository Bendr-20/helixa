const test = require('node:test');
const assert = require('node:assert/strict');

const {
  shouldContinueOffchainAfterMintError,
  formatMintFallbackWarning,
} = require('./principal-register-policy');

test('onchain mint transport errors continue offchain', () => {
  assert.equal(shouldContinueOffchainAfterMintError(new Error('Mint creation error')), true);
  assert.equal(shouldContinueOffchainAfterMintError(new Error('no runners?!')), true);
  assert.equal(shouldContinueOffchainAfterMintError(new Error('method: "eth_sendTransaction" code=UNKNOWN_ERROR')), true);
});

test('human validation and authorization errors do not continue offchain', () => {
  assert.equal(shouldContinueOffchainAfterMintError(new Error('name required')), false);
  assert.equal(shouldContinueOffchainAfterMintError(new Error('Caller must own tokenId to bind it as a human principal')), false);
  assert.equal(shouldContinueOffchainAfterMintError(new Error('Token binding requires wallet authentication (SIWE)')), false);
});

test('mint fallback warning is user safe', () => {
  assert.match(formatMintFallbackWarning(new Error('Mint creation error')), /saved offchain/i);
  assert.doesNotMatch(formatMintFallbackWarning(new Error('Mint creation error')), /-32603|eth_sendTransaction/i);
});
