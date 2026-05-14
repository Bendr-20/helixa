const test = require('node:test');
const assert = require('node:assert/strict');

const { authorizeHumanAgentLink } = require('./human-link-auth');

test('allows wallet owner to link an agent to their own Privy-only human profile', () => {
  const result = authorizeHumanAgentLink({
    profile: {
      userId: 'did:privy:user-123',
      walletAddress: null,
      name: 'MetaCaptain',
    },
    caller: '0x424373a9aDbB93619A346448afB9543a3C768268',
    privyUserId: 'did:privy:user-123',
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.profilePatch, {
    walletAddress: '0x424373a9aDbB93619A346448afB9543a3C768268',
  });
});

test('rejects linking a Privy-only human profile without matching Privy proof', () => {
  const result = authorizeHumanAgentLink({
    profile: {
      userId: 'did:privy:user-123',
      walletAddress: null,
    },
    caller: '0x424373a9aDbB93619A346448afB9543a3C768268',
    privyUserId: 'did:privy:someone-else',
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 403);
});

test('rejects linking when the wallet does not own the existing wallet-bound human profile', () => {
  const result = authorizeHumanAgentLink({
    profile: {
      userId: 'did:privy:user-123',
      walletAddress: '0x1111111111111111111111111111111111111111',
    },
    caller: '0x424373a9aDbB93619A346448afB9543a3C768268',
    privyUserId: 'did:privy:user-123',
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 403);
});
