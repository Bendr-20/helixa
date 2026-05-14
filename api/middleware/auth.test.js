const test = require('node:test');
const assert = require('node:assert/strict');
const { ethers } = require('ethers');

const { verifySIWE } = require('./auth');

function legacySiweMessage(address, timestamp, domain) {
  return `Sign-In With Ethereum: ${domain} wants you to sign in with your wallet ${address} at ${timestamp}`;
}

function standardSiweMessage(address, timestamp, domain) {
  const issuedAt = new Date(Number(timestamp)).toISOString();
  return `${domain} wants you to sign in with your Ethereum account:\n${address}\n\nSign in to Helixa.\n\nURI: https://${domain}\nVersion: 1\nChain ID: 8453\nNonce: ${timestamp}\nIssued At: ${issuedAt}`;
}

test('SIWE verification accepts signatures for the frontend origin domain', async () => {
  const wallet = ethers.Wallet.createRandom();
  const timestamp = Date.now().toString();
  const signature = await wallet.signMessage(standardSiweMessage(wallet.address, timestamp, 'helixa.xyz'));

  assert.equal(verifySIWE(wallet.address, timestamp, signature), true);
});

test('SIWE verification keeps legacy api-domain wallet proofs working', async () => {
  const wallet = ethers.Wallet.createRandom();
  const timestamp = Date.now().toString();
  const signature = await wallet.signMessage(legacySiweMessage(wallet.address, timestamp, 'api.helixa.xyz'));

  assert.equal(verifySIWE(wallet.address, timestamp, signature), true);
});

test('SIWE verification rejects signatures scoped to an untrusted domain', async () => {
  const wallet = ethers.Wallet.createRandom();
  const timestamp = Date.now().toString();
  const signature = await wallet.signMessage(standardSiweMessage(wallet.address, timestamp, 'evil.example'));

  assert.equal(verifySIWE(wallet.address, timestamp, signature), false);
});
