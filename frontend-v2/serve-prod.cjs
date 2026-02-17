const http = require('http');
const fs = require('fs');
const path = require('path');
const PORT = 3000;
const DIST = path.join(__dirname, 'dist');
const MIME = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf'};
http.createServer((req, res) => {
  let fp = path.join(DIST, req.url === '/' ? 'index.html' : req.url);
  if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) fp = path.join(DIST, 'index.html');
  const ext = path.extname(fp);
  res.writeHead(200, {'Content-Type': MIME[ext]||'application/octet-stream','Cache-Control': ext==='.html'?'no-cache':'public, max-age=31536000'});
  fs.createReadStream(fp).pipe(res);
}).listen(PORT, () => console.log('Frontend on http://localhost:'+PORT));
