const http = require('http');
const fs = require('fs');
const path = require('path');

const mime = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webp': 'image/webp',
};
const dir = path.join(__dirname, 'dist');

http.createServer((req, res) => {
  let url = req.url.split('?')[0];
  let file = path.join(dir, url === '/' ? 'index.html' : url);
  if (!fs.existsSync(file)) file = path.join(dir, 'index.html');
  const ext = path.extname(file);
  res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}).listen(5173, () => console.log('Static server on :5173'));
