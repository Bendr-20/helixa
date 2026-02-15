#!/usr/bin/env node
const puppeteer = require('puppeteer-core');
const http = require('http');
const path = require('path');
const fs = require('fs');

const DOCS_DIR = path.resolve(__dirname, '../docs');
const OUT_DIR = path.resolve(__dirname, '../renders');
const CRED_SCORES = { 0: 77, 1: 54, 2: 5 };

function startServer() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost');
      let fp = path.join(DOCS_DIR, url.pathname === '/' ? 'card.html' : url.pathname);
      if (!fs.existsSync(fp)) { res.writeHead(404); res.end(); return; }
      const ext = path.extname(fp);
      const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json' };
      if (fp.endsWith('agents.json')) {
        const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
        data.agents.forEach(a => { a.credScore = CRED_SCORES[a.id] || 5; });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
        return;
      }
      res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
      fs.createReadStream(fp).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const server = await startServer();
  const port = server.address().port;

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium-browser',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  for (const id of [0, 1, 2]) {
    const page = await browser.newPage();
    page.on('console', msg => console.log(`[browser ${id}]`, msg.text()));
    page.on('pageerror', err => console.log(`[pageerror ${id}]`, err.message));
    await page.setViewport({ width: 800, height: 900 });
    await page.goto(`http://127.0.0.1:${port}/?id=${id}`, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForSelector('.trading-card .card-header', { timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 1500));

    const card = await page.$('.trading-card');
    if (card) {
      await card.screenshot({ path: path.join(OUT_DIR, `card-${id}.png`), type: 'png' });
      console.log(`Rendered card-${id}.png`);
    } else {
      await page.screenshot({ path: path.join(OUT_DIR, `debug-${id}.png`) });
      console.error(`Card #${id} element not found, saved debug screenshot`);
    }
    await page.close();
  }

  await browser.close();
  server.close();
}

main().catch(e => { console.error(e); process.exit(1); });
