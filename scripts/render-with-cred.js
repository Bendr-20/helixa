#!/usr/bin/env node
/**
 * Add Cred badge to existing card templates and render PNGs
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const http = require('http');

const OUT_DIR = path.resolve(__dirname, '../renders');

const CRED_BADGE_CSS = `
.cred-badge {
  position: absolute;
  top: 8px;
  left: 12px;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 10;
  box-shadow: 0 2px 12px rgba(0,0,0,0.6);
  border: 2px solid rgba(255,255,255,0.15);
}
.cred-badge .cred-num {
  font-family: 'Orbitron', sans-serif;
  font-size: 1.2rem;
  font-weight: 800;
  line-height: 1;
}
.cred-badge .cred-lbl {
  font-size: 0.4rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  opacity: 0.9;
}
.cred-elite { background: linear-gradient(135deg, #ffd54f, #ff8f00); color: #1a1a1a; box-shadow: 0 2px 16px rgba(255,213,79,0.5); }
.cred-high { background: linear-gradient(135deg, #ce93d8, #7b1fa2); color: #fff; box-shadow: 0 2px 16px rgba(206,147,216,0.4); }
.cred-mid { background: linear-gradient(135deg, #4fc3f7, #0277bd); color: #fff; box-shadow: 0 2px 16px rgba(79,195,247,0.3); }
.cred-low { background: linear-gradient(135deg, #555, #333); color: #999; }
`;

function credBadgeHTML(score) {
  let tier = 'cred-low';
  if (score >= 80) tier = 'cred-elite';
  else if (score >= 50) tier = 'cred-high';
  else if (score >= 20) tier = 'cred-mid';
  return `<div class="cred-badge ${tier}"><span class="cred-num">${score}</span><span class="cred-lbl">Cred</span></div>`;
}

const tiers = [
  { name: 'basic', file: '/tmp/final-basic.html', cred: 15 },
  { name: 'holo', file: '/tmp/final-holo.html', cred: 54 },
  { name: 'fullart', file: '/tmp/final-fullart.html', cred: 77 },
];

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  // Create modified HTML files and serve them
  const tmpDir = '/tmp/cred-cards';
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  for (const tier of tiers) {
    let html = fs.readFileSync(tier.file, 'utf8');
    // Inject CSS before </style>
    html = html.replace('</style>', CRED_BADGE_CSS + '</style>');
    // Replace tier label with cred badge (tier label is right after card-overlay opens)
    html = html.replace(
      /<span class='tier-label'[^>]*>[^<]*<\/span>/,
      credBadgeHTML(tier.cred)
    );
    fs.writeFileSync(path.join(tmpDir, `${tier.name}.html`), html);
  }

  // Serve files
  const srv = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const fp = path.join(tmpDir, url.pathname.slice(1));
    if (!fs.existsSync(fp)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    fs.createReadStream(fp).pipe(res);
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium-browser',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  for (const tier of tiers) {
    const page = await browser.newPage();
    await page.setViewport({ width: 440, height: 620 });
    await page.goto(`http://127.0.0.1:${port}/${tier.name}.html`, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    const card = await page.$('.card');
    if (card) {
      await card.screenshot({ path: path.join(OUT_DIR, `cred-${tier.name}.png`), type: 'png' });
      console.log(`Rendered cred-${tier.name}.png`);
    } else {
      await page.screenshot({ path: path.join(OUT_DIR, `cred-debug-${tier.name}.png`) });
      console.error(`Card not found for ${tier.name}`);
    }
    await page.close();
  }

  await browser.close();
  srv.close();
}

main().catch(e => { console.error(e); process.exit(1); });
