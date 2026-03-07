const puppeteer = require('puppeteer');

let browser = null;

async function getBrowser() {
  if (browser && browser.connected) return browser;
  browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  return browser;
}

function getTier(score) {
  if (score >= 80) return 'Preferred';
  if (score >= 60) return 'Prime';
  if (score >= 40) return 'Moderate';
  if (score >= 20) return 'Speculative';
  return 'Junk';
}

function getTrustPercent(score) {
  return Math.min(100, Math.max(0, score));
}

function shortenAddr(addr) {
  if (!addr) return '—';
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

function buildHTML(agent) {
  const score = agent.credScore || 0;
  const tier = getTier(score);
  const trustPct = getTrustPercent(score);
  const name = agent.name || 'Unknown';
  const id = agent.tokenId || '?';
  const owner = shortenAddr(agent.owner);
  const traits = (agent.traits || []).slice(0, 6);
  const now = new Date().toUTCString().replace('GMT', 'UTC');

  // Calculate age
  const mintDate = agent.mintedAt ? new Date(agent.mintedAt) : null;
  const ageDays = mintDate ? Math.floor((Date.now() - mintDate) / 86400000) : '?';

  const points = agent.points || 0;
  const verified = agent.verified ? true : false;
  const soulbound = agent.soulbound ? true : false;
  const narrative = agent.narrative || {};

  const traitHTML = traits.map((t, i) =>
    `<span class="trait${i % 2 === 0 ? '' : ' soul'}">${t.name || t}</span>`
  ).join('');

  const signals = [];
  if (verified) signals.push({ cls: 'green', icon: '✓', text: 'Verified onchain identity (SIWA)' });
  if (soulbound) signals.push({ cls: 'green', icon: '✓', text: 'Soulbound token' });
  if (points > 100) signals.push({ cls: 'green', icon: '✓', text: `${points} points earned` });
  if (!narrative.mission) signals.push({ cls: 'yellow', icon: '⚠', text: 'No soul narrative set' });
  if (score < 20) signals.push({ cls: 'red', icon: '✗', text: 'Low cred score' });

  const signalsHTML = signals.map(s =>
    `<div class="flag ${s.cls}"><span class="flag-icon">${s.icon}</span> ${s.text}</div>`
  ).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0a14;display:flex;justify-content:center;align-items:center;min-height:100vh;padding:40px}
.report{width:480px;background:linear-gradient(135deg,#0f0f1a,#141428);border:1px solid rgba(110,236,216,0.15);border-radius:16px;overflow:hidden;font-family:'Inter',sans-serif;color:#e0e0e0}
.header{background:linear-gradient(135deg,rgba(110,236,216,0.08),rgba(180,144,255,0.08));padding:24px 28px;border-bottom:1px solid rgba(110,236,216,0.1);display:flex;justify-content:space-between;align-items:flex-start}
.header-left{flex:1}
.agent-name{font-size:22px;font-weight:700;color:#fff;margin-bottom:4px}
.agent-id{font-family:'JetBrains Mono',monospace;font-size:12px;color:rgba(110,236,216,0.6)}
.agent-owner{font-family:'JetBrains Mono',monospace;font-size:11px;color:rgba(255,255,255,0.35);margin-top:2px}
.cred-badge{text-align:center;min-width:90px}
.cred-score{font-size:42px;font-weight:700;background:linear-gradient(135deg,#6eecd8,#b490ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;line-height:1}
.cred-tier{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;color:#6eecd8;margin-top:4px}
.section{padding:18px 28px;border-bottom:1px solid rgba(255,255,255,0.05)}
.section:last-child{border-bottom:none}
.section-title{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;color:rgba(180,144,255,0.7);margin-bottom:12px}
.stats-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px}
.stat-value{font-size:18px;font-weight:600;color:#fff}
.stat-value.positive{color:#6eecd8}
.stat-label{font-size:11px;color:rgba(255,255,255,0.4);margin-top:2px}
.traits{display:flex;flex-wrap:wrap;gap:8px}
.trait{background:rgba(110,236,216,0.08);border:1px solid rgba(110,236,216,0.15);border-radius:20px;padding:5px 14px;font-size:12px;font-weight:500;color:#6eecd8}
.trait.soul{background:rgba(180,144,255,0.08);border-color:rgba(180,144,255,0.15);color:#b490ff}
.trust-bar-container{margin-top:14px}
.trust-bar-bg{height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden}
.trust-bar-fill{height:100%;border-radius:3px;background:linear-gradient(90deg,#6eecd8,#b490ff);width:${trustPct}%}
.trust-label{display:flex;justify-content:space-between;margin-top:6px;font-size:10px;color:rgba(255,255,255,0.35)}
.flags{display:flex;flex-direction:column;gap:6px}
.flag{display:flex;align-items:center;gap:8px;font-size:12px}
.flag-icon{font-size:14px}
.flag.green{color:#6eecd8}
.flag.yellow{color:#ffd93d}
.flag.red{color:#ff6b6b}
.footer{padding:14px 28px;background:rgba(0,0,0,0.2);display:flex;justify-content:space-between;align-items:center}
.footer-brand{font-size:11px;font-weight:600;letter-spacing:1px;background:linear-gradient(90deg,#6eecd8,#b490ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.footer-date{font-size:10px;color:rgba(255,255,255,0.3);font-family:'JetBrains Mono',monospace}
</style></head><body>
<div class="report">
  <div class="header">
    <div class="header-left">
      <div class="agent-name">${name}</div>
      <div class="agent-id">Agent #${id} · Base Mainnet</div>
      <div class="agent-owner">${owner}</div>
    </div>
    <div class="cred-badge">
      <div class="cred-score">${score}</div>
      <div class="cred-tier">✦ ${tier}</div>
    </div>
  </div>
  <div class="section">
    <div class="section-title">Overview</div>
    <div class="stats-grid">
      <div class="stat-item"><div class="stat-value">${points}</div><div class="stat-label">Points</div></div>
      <div class="stat-item"><div class="stat-value">${ageDays}d</div><div class="stat-label">Age</div></div>
      <div class="stat-item"><div class="stat-value">${agent.framework || '—'}</div><div class="stat-label">Framework</div></div>
    </div>
  </div>
  ${traits.length ? `<div class="section"><div class="section-title">Traits</div><div class="traits">${traitHTML}</div></div>` : ''}
  <div class="section">
    <div class="section-title">Trust Signal</div>
    <div class="trust-bar-container">
      <div class="trust-bar-bg"><div class="trust-bar-fill"></div></div>
      <div class="trust-label"><span>Junk</span><span>Speculative</span><span>Moderate</span><span>Prime</span><span>Preferred</span></div>
    </div>
  </div>
  ${signals.length ? `<div class="section"><div class="section-title">Signals</div><div class="flags">${signalsHTML}</div></div>` : ''}
  <div class="footer">
    <span class="footer-brand">HELIXA</span>
    <span class="footer-date">${now}</span>
  </div>
</div>
</body></html>`;
}

async function renderReportCard(agent) {
  const b = await getBrowser();
  const page = await b.newPage();
  try {
    await page.setViewport({ width: 600, height: 800 });
    await page.setContent(buildHTML(agent), { waitUntil: 'networkidle0', timeout: 15000 });
    const el = await page.$('.report');
    const png = await el.screenshot({ type: 'png' });
    return png;
  } finally {
    await page.close();
  }
}

function buildCompareHTML(agent1, agent2) {
  const now = new Date().toUTCString().replace('GMT', 'UTC');
  function agentCol(a) {
    const score = a.credScore || 0;
    const tier = getTier(score);
    const mintDate = a.mintedAt ? new Date(a.mintedAt) : null;
    const ageDays = mintDate ? Math.floor((Date.now() - mintDate) / 86400000) : '?';
    const traits = (a.traits || []).slice(0, 3).map(t => t.name || t).join(', ') || '—';
    return `<div class="col">
      <div class="col-name">${a.name || 'Unknown'}</div>
      <div class="col-id">#${a.tokenId}</div>
      <div class="col-score">${score}</div>
      <div class="col-tier">✦ ${tier}</div>
      <div class="col-stats">
        <div class="cs"><span class="csl">Points</span><span class="csv">${a.points || 0}</span></div>
        <div class="cs"><span class="csl">Age</span><span class="csv">${ageDays}d</span></div>
        <div class="cs"><span class="csl">Verified</span><span class="csv">${a.verified ? '✓' : '✗'}</span></div>
        <div class="cs"><span class="csl">Traits</span><span class="csv">${traits}</span></div>
      </div>
    </div>`;
  }
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=JetBrains+Mono:wght@400&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0a14;display:flex;justify-content:center;align-items:center;min-height:100vh;padding:40px}
.card{width:620px;background:linear-gradient(135deg,#0f0f1a,#141428);border:1px solid rgba(110,236,216,0.15);border-radius:16px;overflow:hidden;font-family:'Inter',sans-serif;color:#e0e0e0}
.title{text-align:center;padding:18px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:2px;color:rgba(180,144,255,0.7);border-bottom:1px solid rgba(110,236,216,0.1)}
.cols{display:flex}
.col{flex:1;padding:20px 24px;text-align:center}
.col+.col{border-left:1px solid rgba(110,236,216,0.1)}
.col-name{font-size:18px;font-weight:700;color:#fff}
.col-id{font-family:'JetBrains Mono',monospace;font-size:11px;color:rgba(110,236,216,0.5);margin-bottom:12px}
.col-score{font-size:40px;font-weight:700;background:linear-gradient(135deg,#6eecd8,#b490ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;line-height:1}
.col-tier{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;color:#6eecd8;margin:4px 0 14px}
.col-stats{text-align:left}
.cs{display:flex;justify-content:space-between;padding:4px 0;font-size:12px;border-bottom:1px solid rgba(255,255,255,0.03)}
.csl{color:rgba(255,255,255,0.4)}
.csv{color:#fff;font-weight:600}
.footer{padding:12px;background:rgba(0,0,0,0.2);display:flex;justify-content:space-between;align-items:center}
.footer-brand{font-size:11px;font-weight:600;letter-spacing:1px;background:linear-gradient(90deg,#6eecd8,#b490ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.footer-date{font-size:10px;color:rgba(255,255,255,0.3);font-family:'JetBrains Mono',monospace}
</style></head><body>
<div class="card">
  <div class="title">Agent Comparison</div>
  <div class="cols">${agentCol(agent1)}${agentCol(agent2)}</div>
  <div class="footer"><span class="footer-brand">HELIXA</span><span class="footer-date">${now}</span></div>
</div>
</body></html>`;
}

function buildFlexHTML(agent) {
  const score = agent.credScore || 0;
  const tier = getTier(score);
  const name = agent.name || 'Unknown';
  const id = agent.tokenId || '?';
  const points = agent.points || 0;
  const mintDate = agent.mintedAt ? new Date(agent.mintedAt) : null;
  const ageDays = mintDate ? Math.floor((Date.now() - mintDate) / 86400000) : '?';
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&family=JetBrains+Mono:wght@400&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0a14;display:flex;justify-content:center;align-items:center;min-height:100vh;padding:40px}
.flex-card{width:420px;background:linear-gradient(135deg,#0f0f1a,#1a1a30);border:2px solid rgba(110,236,216,0.25);border-radius:20px;overflow:hidden;font-family:'Inter',sans-serif;color:#e0e0e0;text-align:center;padding:32px 28px}
.flex-name{font-size:26px;font-weight:900;color:#fff;margin-bottom:2px}
.flex-id{font-family:'JetBrains Mono',monospace;font-size:12px;color:rgba(110,236,216,0.5);margin-bottom:20px}
.flex-score{font-size:72px;font-weight:900;background:linear-gradient(135deg,#6eecd8,#b490ff,#80d0ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;line-height:1}
.flex-tier{font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#6eecd8;margin:6px 0 24px}
.flex-stats{display:flex;justify-content:center;gap:32px;margin-bottom:20px}
.fs{text-align:center}
.fs-val{font-size:20px;font-weight:700;color:#fff}
.fs-label{font-size:10px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px}
.flex-brand{font-size:10px;font-weight:600;letter-spacing:2px;color:rgba(180,144,255,0.5);text-transform:uppercase;margin-top:8px}
</style></head><body>
<div class="flex-card">
  <div class="flex-name">${name}</div>
  <div class="flex-id">Agent #${id}</div>
  <div class="flex-score">${score}</div>
  <div class="flex-tier">✦ ${tier}</div>
  <div class="flex-stats">
    <div class="fs"><div class="fs-val">${points}</div><div class="fs-label">Points</div></div>
    <div class="fs"><div class="fs-val">${ageDays}d</div><div class="fs-label">Age</div></div>
    <div class="fs"><div class="fs-val">${agent.verified ? '✓' : '—'}</div><div class="fs-label">Verified</div></div>
  </div>
  <div class="flex-brand">Powered by Helixa</div>
</div>
</body></html>`;
}

async function renderCompareCard(agent1, agent2) {
  const b = await getBrowser();
  const page = await b.newPage();
  try {
    await page.setViewport({ width: 700, height: 600 });
    await page.setContent(buildCompareHTML(agent1, agent2), { waitUntil: 'networkidle0', timeout: 15000 });
    const el = await page.$('.card');
    return await el.screenshot({ type: 'png' });
  } finally { await page.close(); }
}

async function renderFlexCard(agent) {
  const b = await getBrowser();
  const page = await b.newPage();
  try {
    await page.setViewport({ width: 500, height: 500 });
    await page.setContent(buildFlexHTML(agent), { waitUntil: 'networkidle0', timeout: 15000 });
    const el = await page.$('.flex-card');
    return await el.screenshot({ type: 'png' });
  } finally { await page.close(); }
}

// Cleanup on exit
process.on('exit', () => browser?.close());
process.on('SIGINT', () => { browser?.close(); process.exit(); });
process.on('SIGTERM', () => { browser?.close(); process.exit(); });

module.exports = { renderReportCard, renderCompareCard, renderFlexCard };
