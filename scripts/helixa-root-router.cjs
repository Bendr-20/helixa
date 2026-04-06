const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3460);
const DIST_DIR = path.resolve(__dirname, '..', 'frontend-v2', 'dist');
const INDEX_HTML = path.join(DIST_DIR, 'index.html');

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(body);
}

function sendFile(res, filePath, contentType = 'text/html; charset=utf-8') {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      send(res, 500, 'Internal Server Error', { 'Content-Type': 'text/plain; charset=utf-8' });
      return;
    }
    send(res, 200, data, { 'Content-Type': contentType });
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const pathname = decodeURIComponent(url.pathname);

  if (pathname === '/' || pathname === '/v2' || pathname === '/v2/') {
    res.writeHead(302, {
      Location: '/trust-graph/',
      'Cache-Control': 'no-store',
    });
    res.end();
    return;
  }

  if (pathname === '/health') {
    send(res, 200, JSON.stringify({ ok: true, service: 'helixa-root-router', port: PORT }), {
      'Content-Type': 'application/json; charset=utf-8',
    });
    return;
  }

  if (pathname === '/trust-graph' || pathname.startsWith('/trust-graph/')) {
    sendFile(res, INDEX_HTML);
    return;
  }

  send(res, 404, 'Not Found', { 'Content-Type': 'text/plain; charset=utf-8' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[helixa-root-router] listening on ${PORT}`);
  console.log(`[helixa-root-router] dist=${DIST_DIR}`);
});
