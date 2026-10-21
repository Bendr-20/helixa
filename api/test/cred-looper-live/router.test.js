'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createLooperCredRouter } = require('../../cred-looper-live/router');

function fakeExpress() {
  const router = { routes: [], get(routePath, handler) { this.routes.push({ routePath, handler }); } };
  return { module: { Router: () => router }, router };
}
function response() {
  return {
    statusCode: 200, body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    set() { return this; },
  };
}

test('GET /:id serves the dedicated record and unsupported Loopers return 404', async () => {
  const { module, router } = fakeExpress();
  const service = {
    async getByLooperId(id) {
      if (id !== '2431') throw Object.assign(new Error('unsupported'), { code: 'UNSUPPORTED_LOOPER', statusCode: 404 });
      return { score: 42, ratingStatus: 'PROVISIONAL' };
    },
  };
  createLooperCredRouter({ expressModule: module, service });
  const route = router.routes.find(item => item.routePath === '/:id');
  const ok = response();
  await route.handler({ params: { id: '2431' } }, ok);
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.body.score, 42);
  const missing = response();
  await route.handler({ params: { id: '9' } }, missing);
  assert.equal(missing.statusCode, 404);
  assert.equal(missing.body.error, 'UNSUPPORTED_LOOPER');
});

test('unavailable evidence returns 503 UNRATED, never stale score 42', async () => {
  const { module, router } = fakeExpress();
  createLooperCredRouter({ expressModule: module, service: { async getByLooperId() { throw new Error('RPC unavailable'); } } });
  const res = response();
  await router.routes[0].handler({ params: { id: '2431' } }, res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.ratingStatus, 'UNRATED');
  assert.equal(res.body.score, null);
  assert.deepEqual(res.body.reasonCodes, ['LOOPER_CRED_EVIDENCE_UNAVAILABLE']);
});

test('server mount precedes 404 and live slice stays isolated from legacy CRED surfaces', () => {
  const apiRoot = path.join(__dirname, '../..');
  const server = fs.readFileSync(path.join(apiRoot, 'v2-server.js'), 'utf8');
  const mount = server.indexOf("app.use('/api/v2/looper'");
  const paymentMiddleware = server.indexOf('// Mount: Internal key bypass');
  const notFound = server.indexOf('// 404 handler');
  assert.ok(mount > -1 && mount < paymentMiddleware, 'free Looper CRED router must be mounted before payment middleware');
  assert.ok(mount < notFound, 'Looper CRED router must be mounted before 404');
  assert.match(server, /app\.get\('\/api\/v2\/agent\/:id\/cred'/u, 'legacy AgentDNA CRED route must remain present');
  for (const file of ['service.js', 'router.js']) {
    const source = fs.readFileSync(path.join(apiRoot, 'cred-looper-live', file), 'utf8');
    assert.doesNotMatch(source, new RegExp('cred-shadow|cred-oracle|terminal-sync|/api/v2/agent/:id/cred|eth_send|wallet|private.?key', 'iu'));
    assert.doesNotMatch(source, /Credifi.*(?:fetch|API)|credifi\.(?:com|ai)/iu);
  }
});
