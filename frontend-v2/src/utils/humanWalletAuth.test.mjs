import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isWalletRejection,
  shouldFallbackToPrivyAfterWalletError,
  getWalletPublishFallbackMessage,
  shouldRetryHumanPublishOffchain,
} from './humanWalletAuth.js';

test('wallet rejection does not fall back to Privy publish', () => {
  const error = { code: 4001, message: 'User rejected the request.' };

  assert.equal(isWalletRejection(error), true);
  assert.equal(shouldFallbackToPrivyAfterWalletError(error), false);
});

test('generic internal wallet signing error can fall back to Privy publish', () => {
  const error = {
    code: -32603,
    message: 'Mint creation error',
    info: { error: { message: 'An error has occurred, please try again.' } },
  };

  assert.equal(isWalletRejection(error), false);
  assert.equal(shouldFallbackToPrivyAfterWalletError(error), true);
  assert.match(getWalletPublishFallbackMessage(error), /saved offchain/i);
});

test('onchain mint transaction failure retries human publish offchain', () => {
  const error = new Error('Mint phase error: code: -32603 message: "An error has occurred, please try again." method: "eth_sendTransaction" code=UNKNOWN_ERROR');

  assert.equal(shouldRetryHumanPublishOffchain(error), true);
});

test('human validation errors do not retry offchain', () => {
  assert.equal(shouldRetryHumanPublishOffchain(new Error('Human register failed: name required')), false);
  assert.equal(shouldRetryHumanPublishOffchain({ code: 4001, message: 'User rejected the request.' }), false);
});
