import { useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';

const API_BASE = 'https://api.helixa.xyz';

function getTier(score: number) {
  if (score >= 91) return 'AAA';
  if (score >= 76) return 'PRIME';
  if (score >= 51) return 'INVESTMENT GRADE';
  if (score >= 26) return 'SPECULATIVE';
  return 'JUNK';
}

function getBar(pct: number, len = 10) {
  const filled = Math.round((pct / 100) * len);
  return '█'.repeat(filled) + '░'.repeat(len - filled);
}

interface AgentData {
  name: string;
  tokenId: string;
  credScore: number;
  date: string;
  verifications: Record<string, boolean>;
  onchain: { age: string; txCount: number; traits: number; points: number; narrative: string; soulbound: boolean };
  risk: { tolerance: number; autonomy: number; alignment: string };
  breakdown: Record<string, number>;
}

async function fetchAgentData(id: string): Promise<AgentData> {
  const isNumeric = /^\d+$/.test(id.trim());
  let agent: any;

  if (isNumeric) {
    const res = await fetch(`${API_BASE}/api/v2/agent/${id.trim()}`);
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    agent = await res.json();
  } else {
    const listRes = await fetch(`${API_BASE}/api/v2/agents`);
    if (!listRes.ok) throw new Error(`Agent list returned ${listRes.status}`);
    const data = await listRes.json();
    const agents = data.agents || data || [];
    const match = agents.find((a: any) => a.name?.toLowerCase() === id.trim().toLowerCase());
    if (!match) throw new Error('NO MATCH FOR "' + id.trim() + '"');
    const res = await fetch(`${API_BASE}/api/v2/agent/${match.tokenId}`);
    if (!res.ok) throw new Error(`Agent ${match.tokenId} returned ${res.status}`);
    agent = await res.json();
  }

  const credScore = agent.credScore ?? agent.cred ?? 0;
  const traits = agent.traits || [];
  const personality = agent.personality || {};
  const narrative = agent.narrative || {};
  const hasVerif = (name: string) => traits.some((t: any) => t.name === name || t.name === name.toLowerCase());
  const mintDate = agent.mintedAt ? new Date(agent.mintedAt) : null;
  const ageDays = mintDate ? Math.floor((Date.now() - mintDate.getTime()) / 86400000) : 0;
  const narrativeFields = [narrative.origin, narrative.mission, narrative.lore, narrative.manifesto].filter(Boolean);
  const narrativeStatus = narrativeFields.length >= 3 ? 'COMPLETE' : narrativeFields.length > 0 ? 'PARTIAL' : 'NONE';

  const breakdown: Record<string, number> = {};
  if (agent.credBreakdown) {
    for (const [k, v] of Object.entries(agent.credBreakdown)) {
      breakdown[k.toUpperCase()] = v as number;
    }
  }
  if (!Object.keys(breakdown).length) {
    breakdown.ACTIVITY = Math.min(100, (agent.txCount || 0) * 10);
    breakdown.TRAITS = Math.min(100, traits.length * 15);
    breakdown.VERIFY = (hasVerif('x-verified') || hasVerif('siwa-verified')) ? 100 : 0;
    breakdown.AGE = Math.min(100, ageDays * 10);
    breakdown.ORIGIN = agent.mintOrigin === 1 ? 100 : agent.mintOrigin === 2 ? 80 : 50;
  }

  return {
    name: agent.name || `Agent #${id}`,
    tokenId: `#${String(agent.tokenId || id).padStart(3, '0')}`,
    credScore,
    date: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
    verifications: {
      'X/TWITTER': hasVerif('x-verified'),
      'SIWA': hasVerif('siwa-verified'),
      'GITHUB': hasVerif('github-verified'),
      'COINBASE': hasVerif('coinbase-verified'),
      'FARCASTER': hasVerif('farcaster-verified'),
    },
    onchain: {
      age: ageDays === 1 ? '1 DAY' : `${ageDays} DAYS`,
      txCount: agent.txCount || 0,
      traits: traits.length,
      points: agent.points || 0,
      narrative: narrativeStatus,
      soulbound: agent.soulbound || false,
    },
    risk: {
      tolerance: personality.riskTolerance || 0,
      autonomy: personality.autonomyLevel || personality.autonomy || 0,
      alignment: (personality.alignment || personality.values || 'UNKNOWN').toUpperCase().substring(0, 30),
    },
    breakdown,
  };
}

export function CredReport() {
  const screenRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  const addLine = useCallback((text: string, cls = '') => {
    const screen = screenRef.current;
    if (!screen) return;
    const div = document.createElement('div');
    div.className = 'crt-line' + (cls ? ' ' + cls : '');
    div.textContent = text;
    screen.appendChild(div);
    screen.scrollTop = screen.scrollHeight;
    return div;
  }, []);

  const typeLine = useCallback(async (text: string, delay = 30, cls = '') => {
    const screen = screenRef.current;
    if (!screen || !mountedRef.current) return;
    const div = document.createElement('div');
    div.className = 'crt-line' + (cls ? ' ' + cls : '');
    screen.appendChild(div);
    for (let i = 0; i < text.length; i++) {
      if (!mountedRef.current) return;
      div.textContent += text[i];
      screen.scrollTop = screen.scrollHeight;
      await sleep(delay);
    }
    return div;
  }, []);

  const printLines = useCallback(async (lines: string[], delay = 25) => {
    for (const line of lines) {
      if (!mountedRef.current) return;
      addLine(line);
      await sleep(delay);
    }
  }, [addLine]);

  const promptInput = useCallback(() => {
    const screen = screenRef.current;
    if (!screen || !mountedRef.current) return;
    const container = document.createElement('div');
    container.className = 'crt-line crt-input-line';
    container.innerHTML = '> ENTER AGENT ID OR NAME: <input id="crt-agent-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="30"><span class="crt-cursor">█</span>';
    screen.appendChild(container);
    screen.scrollTop = screen.scrollHeight;
    const input = container.querySelector('#crt-agent-input') as HTMLInputElement;
    if (input) {
      input.focus();
      const focusHandler = () => input.focus();
      document.addEventListener('click', focusHandler);
      input.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
          document.removeEventListener('click', focusHandler);
          const val = input.value.trim() || '001';
          container.innerHTML = '> ENTER AGENT ID: ' + val;
          addLine('');
          await processReport(val);
        }
      });
    }
  }, [addLine]);

  const processReport = useCallback(async (agentId: string) => {
    const screen = screenRef.current;
    if (!screen || !mountedRef.current) return;

    const proc = document.createElement('div');
    proc.className = 'crt-line';
    proc.innerHTML = 'PROCESSING<span class="crt-processing-dots"></span>';
    screen.appendChild(proc);
    screen.scrollTop = screen.scrollHeight;

    let data: AgentData;
    try {
      data = await fetchAgentData(agentId);
    } catch (e: any) {
      proc.remove();
      await typeLine('ERROR: ' + (e.message || 'AGENT NOT FOUND.'), 40, 'crt-highlight');
      addLine('');
      promptInput();
      return;
    }

    proc.remove();
    await typeLine('RECORD FOUND. PRINTING REPORT...', 30);
    await sleep(400);
    addLine('');

    const tier = getTier(data.credScore);
    const scoreBar = getBar(data.credScore);
    const W = 40;
    const pad = (s: string, w = W - 4) => s + ' '.repeat(Math.max(0, w - s.length));
    const row = (s: string) => '║  ' + pad(s) + '║';

    const verif = Object.entries(data.verifications);
    const verifLines: string[] = [];
    for (let i = 0; i < verif.length; i += 2) {
      const a = verif[i];
      const b = verif[i + 1];
      let line = `[${a[1] ? 'X' : ' '}] ${a[0]}`;
      if (b) line += '   ' + `[${b[1] ? 'X' : ' '}] ${b[0]}`;
      verifLines.push(row(line));
    }

    const breakdownLines = Object.entries(data.breakdown).map(([k, v]) => {
      const label = k.padEnd(8);
      return row(`${label} ${getBar(v)} ${v}%`);
    });

    const lines = [
      '╔' + '═'.repeat(W - 2) + '╗',
      row(`HELIXA CRED BUREAU    ${data.date}`),
      row('AGENT CREDIT REPORT'),
      '╠' + '═'.repeat(W - 2) + '╣',
      row(`SUBJECT: ${data.name}`),
      row(`TOKEN ID: ${data.tokenId}     RATING: ${tier}`),
      row(`CRED SCORE: ${scoreBar}  ${data.credScore}/100`),
      '╠' + '═'.repeat(W - 2) + '╣',
      row(`TIER: ${tier}`),
      row('───────────────────────────────────'),
      row('VERIFICATION STATUS'),
      ...verifLines,
      '╠' + '═'.repeat(W - 2) + '╣',
      row('ONCHAIN METRICS'),
      row(`AGE: ${data.onchain.age}     TX COUNT: ${data.onchain.txCount}`),
      row(`TRAITS: ${data.onchain.traits}       POINTS: ${data.onchain.points}`),
      row(`NARRATIVE: ${data.onchain.narrative}`),
      row(`SOULBOUND: ${data.onchain.soulbound ? 'YES' : 'NO'}`),
      '╠' + '═'.repeat(W - 2) + '╣',
      row('RISK ASSESSMENT'),
      row(`RISK TOLERANCE: ${data.risk.tolerance}/10`),
      row(`AUTONOMY: ${data.risk.autonomy}/10`),
      row(`ALIGNMENT: ${data.risk.alignment}`),
      '╠' + '═'.repeat(W - 2) + '╣',
      row('RATING BREAKDOWN'),
      ...breakdownLines,
      '╠' + '═'.repeat(W - 2) + '╣',
      row('CREDIT RATING SCALE'),
      row('JUNK < SPECULATIVE < INV GRADE'),
      row('< PRIME < AAA'),
      '╚' + '═'.repeat(W - 2) + '╝',
    ];

    await printLines(lines, 35);
    addLine('');

    const rec = data.credScore >= 51 ? 'TRUSTWORTHY AGENT' : data.credScore >= 26 ? 'PROCEED WITH CAUTION' : 'HIGH RISK — NOT RECOMMENDED';
    const status = data.credScore >= 51 ? 'INVESTMENT GRADE OR ABOVE' : data.credScore >= 26 ? 'SPECULATIVE' : 'JUNK';
    await typeLine(`   STATUS: ${status}`, 30, 'crt-highlight');
    await typeLine(`   RECOMMENDATION: ${rec}`, 30, 'crt-highlight');
    addLine('');

    // Paywall
    const paywall = [
      '╔══════════════════════════════════════╗',
      '║  FULL DETAILED REPORT AVAILABLE      ║',
      '║                                      ║',
      '║  Includes:                           ║',
      '║  • Weighted score breakdown           ║',
      '║  • Personalized recommendations       ║',
      '║  • Narrative analysis                 ║',
      '║  • Percentile ranking                 ║',
      '║  • Signed payment receipt             ║',
      '║                                      ║',
      '║  Price: $1 USDC via x402 (Base)       ║',
      '╚══════════════════════════════════════╝',
    ];
    paywall.forEach(l => addLine(l));
    addLine('');
    await typeLine(`  API: GET /api/v2/agent/${agentId}/cred-report`, 25, 'crt-highlight');
    await typeLine('  Requires x402 payment header.', 25);
    await typeLine('  See docs.x402.org for client SDKs.', 25);
    addLine('');

    // Action buttons
    const actions = document.createElement('div');
    actions.className = 'crt-actions';

    const newBtn = document.createElement('button');
    newBtn.className = 'crt-btn';
    newBtn.textContent = '[ NEW REPORT ]';
    newBtn.onclick = () => { screen!.innerHTML = ''; boot(); };

    const shareBtn = document.createElement('button');
    shareBtn.className = 'crt-btn';
    shareBtn.textContent = '[ SHARE ]';
    shareBtn.onclick = () => {
      const text = `${data.name} — Cred Score: ${data.credScore}/100 — Rating: ${tier}\n${window.location.href}`;
      if (navigator.share) {
        navigator.share({ title: `$CRED Report: ${data.name}`, text, url: window.location.href });
      } else {
        navigator.clipboard.writeText(text);
        const note = addLine('   COPIED TO CLIPBOARD.', 'crt-highlight');
        setTimeout(() => note?.remove(), 2000);
      }
    };

    const apiBtn = document.createElement('button');
    apiBtn.className = 'crt-btn';
    apiBtn.textContent = '[ VIEW API ]';
    apiBtn.onclick = () => window.open(`${API_BASE}/api/v2/agent/${agentId}/cred`, '_blank');

    actions.appendChild(newBtn);
    actions.appendChild(shareBtn);
    actions.appendChild(apiBtn);
    screen.appendChild(actions);
    screen.scrollTop = screen.scrollHeight;
  }, [addLine, typeLine, printLines, promptInput]);

  const boot = useCallback(async () => {
    if (!mountedRef.current) return;
    await sleep(400);
    await typeLine('HELIXA CRED BUREAU v2.0', 40);
    await sleep(300);
    await typeLine('INITIALIZING...', 50);
    await sleep(600);
    await typeLine('CONNECTING TO BASE NETWORK...', 35);
    await sleep(800);
    await typeLine('CONNECTED. CHAIN ID: 8453', 35);
    await sleep(300);
    await typeLine('READY.', 60);
    await sleep(200);
    addLine('');
    promptInput();
  }, [typeLine, addLine, promptInput]);

  useEffect(() => {
    mountedRef.current = true;
    boot();
    return () => { mountedRef.current = false; };
  }, [boot]);

  return (
    <>
      <style>{`
        .cred-report-page {
          margin: 0; padding: 0; height: 100vh; width: 100vw;
          display: flex; align-items: center; justify-content: center;
          background: radial-gradient(ellipse at center, #2a2a2a 0%, #0a0a0a 100%);
          font-family: 'VT323', 'Courier New', Courier, monospace;
          overflow: hidden; position: fixed; inset: 0; z-index: 50;
        }
        .cred-back-link {
          position: fixed; top: 12px; left: 16px; z-index: 60;
          color: #33ff33; font-family: 'VT323', monospace; font-size: 16px;
          text-decoration: none; opacity: 0.6; transition: opacity 0.15s;
        }
        .cred-back-link:hover { opacity: 1; }
        .crt-monitor {
          position: relative;
          width: min(95vw, 750px); height: min(90vh, 680px);
          background: linear-gradient(160deg, #e0d4b0 0%, #c8b88a 30%, #8a7a5a 100%);
          border-radius: 28px; padding: 28px 28px 40px;
          box-shadow: 0 8px 40px rgba(0,0,0,0.7), inset 0 2px 0 rgba(255,255,255,0.3), inset 0 -2px 4px rgba(0,0,0,0.3);
        }
        .crt-monitor::after {
          content: 'HELIXA'; position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%);
          font-family: Arial, sans-serif; font-size: 13px; font-weight: bold; letter-spacing: 4px;
          color: #8a7a5a; text-shadow: 0 1px 0 rgba(255,255,255,0.4);
        }
        .crt-monitor-led {
          position: absolute; bottom: 14px; right: 40px; width: 8px; height: 8px;
          border-radius: 50%; background: #33ff33; box-shadow: 0 0 6px #33ff33;
          animation: crt-led-blink 3s infinite;
        }
        @keyframes crt-led-blink { 0%,90%,100%{opacity:1} 95%{opacity:0.4} }
        .crt-screen-wrap {
          position: relative; width: 100%; height: 100%; background: #0a0a0a;
          border-radius: 12px; overflow: hidden;
          box-shadow: inset 0 0 80px rgba(51,255,51,0.05), inset 0 0 6px rgba(0,0,0,0.8);
          animation: crt-power-on 0.6s ease-out;
        }
        @keyframes crt-power-on {
          0%{transform:scale(1,0.01);filter:brightness(3)} 40%{transform:scale(1,0.01);filter:brightness(3)}
          60%{transform:scale(1,1);filter:brightness(1.5)} 100%{transform:scale(1,1);filter:brightness(1)}
        }
        .crt-scanlines {
          position: absolute; inset: 0; pointer-events: none; z-index: 10;
          background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px);
        }
        .crt-vignette {
          position: absolute; inset: 0; pointer-events: none; z-index: 11;
          background: radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.65) 100%);
        }
        .crt-flicker-overlay {
          position: absolute; inset: 0; pointer-events: none; z-index: 12;
          animation: crt-flicker 0.15s infinite; opacity: 0;
          background: rgba(51,255,51,0.02);
        }
        @keyframes crt-flicker { 0%{opacity:0.01} 5%{opacity:0.04} 10%{opacity:0} 15%{opacity:0.02} 50%{opacity:0} 80%{opacity:0.03} 100%{opacity:0} }
        .crt-roll-overlay { position: absolute; inset: 0; pointer-events: none; z-index: 9; overflow: hidden; }
        .crt-roll-overlay::before {
          content: ''; position: absolute; width: 100%; height: 60px;
          background: linear-gradient(transparent, rgba(51,255,51,0.04), transparent);
          animation: crt-roll 8s linear infinite;
        }
        @keyframes crt-roll { 0%{top:-60px} 100%{top:100%} }
        .crt-text-logo {
          position: absolute; top: 14px; right: 20px; z-index: 8; text-align: right; line-height: 1;
        }
        .crt-text-logo-main {
          font-family: 'VT323', monospace; font-size: clamp(36px,6vw,52px); color: #33ff33;
          letter-spacing: 6px; text-shadow: 0 0 10px rgba(51,255,51,0.8), 0 0 30px rgba(51,255,51,0.4), 0 0 60px rgba(51,255,51,0.2);
        }
        .crt-text-logo-sub {
          font-family: 'VT323', monospace; font-size: clamp(12px,2vw,16px); color: #1a9e1a;
          letter-spacing: 4px; text-shadow: 0 0 5px rgba(51,255,51,0.4);
        }
        .crt-screen-content {
          position: relative; width: 100%; height: 100%; padding: 20px;
          overflow-y: auto; overflow-x: hidden; z-index: 5; color: #33ff33;
          font-size: clamp(14px,2.2vw,20px); line-height: 1.35;
          text-shadow: 0 0 5px rgba(51,255,51,0.6), 0 0 15px rgba(51,255,51,0.2);
          scrollbar-width: none;
        }
        .crt-screen-content::-webkit-scrollbar { display: none; }
        .crt-line { white-space: pre; }
        .crt-cursor { display: inline-block; animation: crt-blink 1s step-end infinite; }
        @keyframes crt-blink { 0%,50%{opacity:1} 51%,100%{opacity:0} }
        .crt-input-line { display: flex; align-items: center; }
        #crt-agent-input {
          background: transparent; border: none; outline: none; color: #33ff33;
          font-family: 'VT323', 'Courier New', Courier, monospace; font-size: inherit;
          text-shadow: inherit; caret-color: #33ff33; width: 200px;
        }
        .crt-highlight { color: #ffaa00; text-shadow: 0 0 5px rgba(255,170,0,0.6), 0 0 15px rgba(255,170,0,0.2); }
        .crt-actions { margin-top: 12px; display: flex; gap: 16px; flex-wrap: wrap; }
        .crt-btn {
          background: transparent; border: 2px solid #33ff33; color: #33ff33;
          font-family: 'VT323', 'Courier New', Courier, monospace; font-size: clamp(14px,2.2vw,20px);
          padding: 6px 18px; cursor: pointer; text-shadow: 0 0 5px rgba(51,255,51,0.6);
          box-shadow: 0 0 8px rgba(51,255,51,0.2); transition: all 0.15s;
        }
        .crt-btn:hover { background: rgba(51,255,51,0.15); box-shadow: 0 0 16px rgba(51,255,51,0.4); }
        @keyframes crt-dots { 0%{content:''} 25%{content:'.'} 50%{content:'..'} 75%{content:'...'} }
        .crt-processing-dots::after { content: ''; animation: crt-dots 1.2s steps(1) infinite; }
        @media (max-width:500px) {
          .crt-monitor { width:100vw; height:100vh; border-radius:0; padding:12px 8px 32px; }
          .crt-screen-wrap { border-radius: 4px; }
          .crt-screen-content { padding: 12px 8px; font-size: 13px; }
          .crt-line { white-space: pre-wrap; word-break: break-all; }
        }
      `}</style>
      <div className="cred-report-page">
        <Link to="/" className="cred-back-link">← Back to Helixa</Link>
        <div className="crt-monitor">
          <div className="crt-monitor-led" />
          <div className="crt-screen-wrap">
            <div className="crt-flicker-overlay" />
            <div className="crt-text-logo">
              <div className="crt-text-logo-main">$CRED</div>
              <div className="crt-text-logo-sub">REPORT</div>
            </div>
            <div className="crt-roll-overlay" />
            <div className="crt-scanlines" />
            <div className="crt-vignette" />
            <div className="crt-screen-content" ref={screenRef} />
          </div>
        </div>
      </div>
    </>
  );
}
