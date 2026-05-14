const test = require('node:test');
const assert = require('node:assert/strict');

const { ALLOWED_ORIGINS, cors } = require('./cors');

test('CORS allows Synagent to load public Helixa profile data', () => {
  assert.ok(ALLOWED_ORIGINS.includes('https://synagent.helixa.xyz'));
});

test('CORS echoes Synagent origin header for browser fetches', () => {
  const headers = new Map();
  const req = { method: 'GET', headers: { origin: 'https://synagent.helixa.xyz' } };
  const res = {
    setHeader(name, value) {
      headers.set(name, value);
    },
    sendStatus() {
      throw new Error('sendStatus should not be called for GET');
    },
  };
  let nextCalled = false;

  cors(req, res, () => {
    nextCalled = true;
  });

  assert.equal(headers.get('Access-Control-Allow-Origin'), 'https://synagent.helixa.xyz');
  assert.equal(nextCalled, true);
});
