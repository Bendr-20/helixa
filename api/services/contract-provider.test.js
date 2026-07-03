const test = require('node:test');
const assert = require('node:assert/strict');

test('read provider avoids ethers FallbackProvider no-runners state', () => {
  const { readProvider } = require('./contract');

  assert.notEqual(readProvider.constructor.name, 'FallbackProvider');
});
