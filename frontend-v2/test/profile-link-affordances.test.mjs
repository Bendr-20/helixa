import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

function read(path) {
  return fs.readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
}

test('authenticated users get a direct public profile button', () => {
  const walletButton = read('components/WalletButton.tsx');

  assert.match(walletButton, /My Profile/i);
  assert.match(walletButton, /encodeURIComponent\(profileId\)/);
  assert.match(walletButton, /to=\{`\/h\/\$\{encodeURIComponent\(profileId\)\}`\}/);
});

test('human profiles expose a copyable public profile link', () => {
  const humanProfile = read('pages/HumanProfile.tsx');

  assert.match(humanProfile, /Copy Profile Link/i);
  assert.match(humanProfile, /navigator\.clipboard\.writeText\(publicProfileUrl\)/);
  assert.match(humanProfile, /encodeURIComponent\(String\(human\.id \|\| id\)\)/);
});

test('directory human and org cards expose a copy affordance without hiding the open profile link', () => {
  const directory = read('pages/Directory.tsx');

  assert.match(directory, /copyPrincipalLink/i);
  assert.match(directory, /Copy Profile Link/i);
  assert.match(directory, /Open profile/i);
});
