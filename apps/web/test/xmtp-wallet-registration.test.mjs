import assert from 'node:assert/strict';
import test from 'node:test';

import {
  XmtpWalletRegistrationError,
  createXmtpWalletClient,
  ensureXmtpWalletRegistration,
  isXmtpRegistrationRequiredError,
} from '../src/xmtp-wallet-registration.js';

const WALLET = '0x17d7DfA154dc0828AdE4115B9EB8a0A91C0fbDe4';

test('XMTP wallet onboarding skips signatures when the wallet is already registered', async () => {
  let creates = 0;
  let signatures = 0;
  const result = await ensureXmtpWalletRegistration({
    wallet: WALLET,
    signMessage: async () => {
      signatures += 1;
      return '0x01';
    },
    sdkLoader: async () => ({
      Client: {
        canMessage: async ([identifier]) => new Map([[identifier.identifier, true]]),
        create: async () => { creates += 1; },
      },
    }),
  });

  assert.deepEqual(result, { registered: true, created: false });
  assert.equal(creates, 0);
  assert.equal(signatures, 0);
});

test('XMTP wallet onboarding registers an uninitialized wallet through its signer', async () => {
  let checks = 0;
  let signedMessage = null;
  let closed = false;
  const result = await ensureXmtpWalletRegistration({
    wallet: WALLET,
    signMessage: async (message) => {
      signedMessage = message;
      return `0x${'11'.repeat(65)}`;
    },
    sdkLoader: async () => ({
      Client: {
        canMessage: async ([identifier]) => {
          checks += 1;
          return new Map([[identifier.identifier, checks > 1]]);
        },
        create: async (signer, options) => {
          assert.equal(options.env, 'production');
          assert.equal(signer.type, 'EOA');
          assert.equal(signer.getIdentifier().identifier, WALLET.toLowerCase());
          const signature = await signer.signMessage('XMTP consent');
          assert.equal(signature instanceof Uint8Array, true);
          return { close: async () => { closed = true; } };
        },
      },
    }),
  });

  assert.equal(signedMessage, 'XMTP consent');
  assert.equal(closed, true);
  assert.deepEqual(result, { registered: true, created: true });
});

test('XMTP wallet onboarding registers a smart-contract wallet with an SCW signer', async () => {
  let capturedSigner = null;
  const result = await ensureXmtpWalletRegistration({
    wallet: WALLET,
    signMessage: async () => `0x${'11'.repeat(65)}`,
    getAccountCode: async () => '0xef0100deadbeef',
    getChainId: async () => '0x2105',
    sdkLoader: async () => ({
      Client: {
        canMessage: async ([identifier]) => new Map([[identifier.identifier, false]]),
        create: async (signer) => {
          capturedSigner = signer;
          return { close: async () => {} };
        },
      },
    }),
    registrationAttempts: 1,
    sleepImpl: async () => {},
  }).catch((error) => error);

  assert.equal(capturedSigner?.type, 'SCW');
  assert.equal(capturedSigner?.getChainId(), 8453n);
  assert.equal(result instanceof XmtpWalletRegistrationError, true);
});

test('creates a browser XMTP client that remains open for direct wallet group access', async () => {
  const expected = { inboxId: 'wallet-inbox' };
  const client = await createXmtpWalletClient({
    wallet: WALLET,
    signMessage: async () => `0x${'11'.repeat(65)}`,
    sdkLoader: async () => ({ Client: { create: async (signer, options) => { assert.equal(signer.type, 'EOA'); assert.equal(options.env, 'production'); return expected; } } }),
  });
  assert.equal(client, expected);
});

test('XMTP wallet onboarding recognizes the live raw AddressNotFound failure', () => {
  assert.equal(isXmtpRegistrationRequiredError(new Error('[GroupError::AddressNotFound] Addresses not found []')), true);
  assert.equal(isXmtpRegistrationRequiredError(new Error('holder is not reachable on XMTP')), true);
  assert.equal(isXmtpRegistrationRequiredError(new Error('Bankr unavailable')), false);
});

test('XMTP wallet onboarding returns a safe error instead of a raw group failure', async () => {
  await assert.rejects(
    () => ensureXmtpWalletRegistration({
      wallet: WALLET,
      signMessage: async () => `0x${'11'.repeat(65)}`,
      registrationAttempts: 2,
      sleepImpl: async () => {},
      sdkLoader: async () => ({
        Client: {
          canMessage: async ([identifier]) => new Map([[identifier.identifier, false]]),
          create: async () => ({ close: async () => {} }),
        },
      }),
    }),
    (error) => {
      assert.equal(error instanceof XmtpWalletRegistrationError, true);
      assert.equal(error.message, 'XMTP setup did not finish. Sign the wallet prompts, then try again.');
      assert.doesNotMatch(error.message, /GroupError|AddressNotFound/i);
      return true;
    },
  );
});
