import{j as f}from"./vendor-wallet-iWeBopzN.js";import{r as w,L as P}from"./vendor-react-NLnOsXgy.js";const I="https://api.helixa.xyz";function j(s){return s>=91?"AAA":s>=76?"PRIME":s>=51?"INVESTMENT GRADE":s>=26?"SPECULATIVE":"JUNK"}function O(s,g=10){const t=Math.round(s/100*g);return"█".repeat(t)+"░".repeat(g-t)}async function M(s){const g=/^\d+$/.test(s.trim());let t;if(g){const i=await fetch(`${I}/api/v2/agent/${s.trim()}`);if(!i.ok)throw new Error(`API returned ${i.status}`);t=await i.json()}else{const i=await fetch(`${I}/api/v2/agents`);if(!i.ok)throw new Error(`Agent list returned ${i.status}`);const d=await i.json(),T=(d.agents||d||[]).find(v=>v.name?.toLowerCase()===s.trim().toLowerCase());if(!T)throw new Error('NO MATCH FOR "'+s.trim()+'"');const n=await fetch(`${I}/api/v2/agent/${T.tokenId}`);if(!n.ok)throw new Error(`Agent ${T.tokenId} returned ${n.status}`);t=await n.json()}const p=t.credScore??t.cred??0,c=t.traits||[],E=t.personality||{},m=t.narrative||{},h=i=>c.some(d=>d.name===i||d.name===i.toLowerCase()),b=t.mintedAt?new Date(t.mintedAt):null,o=b?Math.floor((Date.now()-b.getTime())/864e5):0,r=[m.origin,m.mission,m.lore,m.manifesto].filter(Boolean),a=r.length>=3?"COMPLETE":r.length>0?"PARTIAL":"NONE",e={};if(t.credBreakdown)for(const[i,d]of Object.entries(t.credBreakdown))e[i.toUpperCase()]=d;return Object.keys(e).length||(e.ACTIVITY=Math.min(100,(t.txCount||0)*10),e.TRAITS=Math.min(100,c.length*15),e.VERIFY=h("x-verified")||h("siwa-verified")?100:0,e.AGE=Math.min(100,o*10),e.ORIGIN=t.mintOrigin===1?100:t.mintOrigin===2?80:50),{name:t.name||`Agent #${s}`,tokenId:`#${String(t.tokenId||s).padStart(3,"0")}`,credScore:p,date:new Date().toLocaleDateString("en-US",{month:"2-digit",day:"2-digit",year:"numeric"}),verifications:{"X/TWITTER":h("x-verified"),SIWA:h("siwa-verified"),GITHUB:h("github-verified"),COINBASE:h("coinbase-verified"),FARCASTER:h("farcaster-verified")},onchain:{age:o===1?"1 DAY":`${o} DAYS`,txCount:t.txCount||0,traits:c.length,points:t.points||0,narrative:a,soulbound:t.soulbound||!1},risk:{tolerance:E.riskTolerance||0,autonomy:E.autonomyLevel||E.autonomy||0,alignment:(E.alignment||E.values||"UNKNOWN").toUpperCase().substring(0,30)},breakdown:e}}function V(){const s=w.useRef(null),g=w.useRef(!0),t=o=>new Promise(r=>setTimeout(r,o)),p=w.useCallback((o,r="")=>{const a=s.current;if(!a)return;const e=document.createElement("div");return e.className="crt-line"+(r?" "+r:""),e.textContent=o,a.appendChild(e),a.scrollTop=a.scrollHeight,e},[]),c=w.useCallback(async(o,r=30,a="")=>{const e=s.current;if(!e||!g.current)return;const i=document.createElement("div");i.className="crt-line"+(a?" "+a:""),e.appendChild(i);for(let d=0;d<o.length;d++){if(!g.current)return;i.textContent+=o[d],e.scrollTop=e.scrollHeight,await t(r)}return i},[]),E=w.useCallback(async(o,r=25)=>{for(const a of o){if(!g.current)return;p(a),await t(r)}},[p]),m=w.useCallback(()=>{const o=s.current;if(!o||!g.current)return;const r=document.createElement("div");r.className="crt-line crt-input-line",r.innerHTML='> ENTER AGENT ID OR NAME: <input id="crt-agent-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="30"><span class="crt-cursor">█</span>',o.appendChild(r),o.scrollTop=o.scrollHeight;const a=r.querySelector("#crt-agent-input");if(a){a.focus();const e=()=>a.focus();document.addEventListener("click",e),a.addEventListener("keydown",async i=>{if(i.key==="Enter"){document.removeEventListener("click",e);const d=a.value.trim()||"001";r.innerHTML="> ENTER AGENT ID: "+d,p(""),await h(d)}})}},[p]),h=w.useCallback(async o=>{const r=s.current;if(!r||!g.current)return;const a=document.createElement("div");a.className="crt-line",a.innerHTML='PROCESSING<span class="crt-processing-dots"></span>',r.appendChild(a),r.scrollTop=r.scrollHeight;let e;try{e=await M(o)}catch(l){a.remove(),await c("ERROR: "+(l.message||"AGENT NOT FOUND."),40,"crt-highlight"),p(""),m();return}a.remove(),await c("RECORD FOUND. PRINTING REPORT...",30),await t(400),p("");const i=j(e.credScore),d=O(e.credScore),u=40,T=(l,x=u-4)=>l+" ".repeat(Math.max(0,x-l.length)),n=l=>"║  "+T(l)+"║",v=Object.entries(e.verifications),y=[];for(let l=0;l<v.length;l+=2){const x=v[l],R=v[l+1];let S=`[${x[1]?"X":" "}] ${x[0]}`;R&&(S+=`   [${R[1]?"X":" "}] ${R[0]}`),y.push(n(S))}const $=Object.entries(e.breakdown).map(([l,x])=>{const R=l.padEnd(8);return n(`${R} ${O(x)} ${x}%`)}),D=["╔"+"═".repeat(u-2)+"╗",n(`HELIXA CRED BUREAU    ${e.date}`),n("AGENT CREDIT REPORT"),"╠"+"═".repeat(u-2)+"╣",n(`SUBJECT: ${e.name}`),n(`TOKEN ID: ${e.tokenId}     RATING: ${i}`),n(`CRED SCORE: ${d}  ${e.credScore}/100`),"╠"+"═".repeat(u-2)+"╣",n(`TIER: ${i}`),n("───────────────────────────────────"),n("VERIFICATION STATUS"),...y,"╠"+"═".repeat(u-2)+"╣",n("ONCHAIN METRICS"),n(`AGE: ${e.onchain.age}     TX COUNT: ${e.onchain.txCount}`),n(`TRAITS: ${e.onchain.traits}       POINTS: ${e.onchain.points}`),n(`NARRATIVE: ${e.onchain.narrative}`),n(`SOULBOUND: ${e.onchain.soulbound?"YES":"NO"}`),"╠"+"═".repeat(u-2)+"╣",n("RISK ASSESSMENT"),n(`RISK TOLERANCE: ${e.risk.tolerance}/10`),n(`AUTONOMY: ${e.risk.autonomy}/10`),n(`ALIGNMENT: ${e.risk.alignment}`),"╠"+"═".repeat(u-2)+"╣",n("RATING BREAKDOWN"),...$,"╠"+"═".repeat(u-2)+"╣",n("CREDIT RATING SCALE"),n("JUNK < SPECULATIVE < INV GRADE"),n("< PRIME < AAA"),"╚"+"═".repeat(u-2)+"╝"];await E(D,35),p("");const L=e.credScore>=51?"TRUSTWORTHY AGENT":e.credScore>=26?"PROCEED WITH CAUTION":"HIGH RISK — NOT RECOMMENDED",U=e.credScore>=51?"INVESTMENT GRADE OR ABOVE":e.credScore>=26?"SPECULATIVE":"JUNK";await c(`   STATUS: ${U}`,30,"crt-highlight"),await c(`   RECOMMENDATION: ${L}`,30,"crt-highlight"),p(""),["╔══════════════════════════════════════╗","║  FULL DETAILED REPORT AVAILABLE      ║","║                                      ║","║  Includes:                           ║","║  • Weighted score breakdown           ║","║  • Personalized recommendations       ║","║  • Narrative analysis                 ║","║  • Percentile ranking                 ║","║  • Signed payment receipt             ║","║                                      ║","║  Price: $1 USDC via x402 (Base)       ║","╚══════════════════════════════════════╝"].forEach(l=>p(l)),p(""),await c(`  API: GET /api/v2/agent/${o}/cred-report`,25,"crt-highlight"),await c("  Requires x402 payment header.",25),await c("  See docs.x402.org for client SDKs.",25),p("");const N=document.createElement("div");N.className="crt-actions";const A=document.createElement("button");A.className="crt-btn",A.textContent="[ NEW REPORT ]",A.onclick=()=>{r.innerHTML="",b()};const k=document.createElement("button");k.className="crt-btn",k.textContent="[ SHARE ]",k.onclick=()=>{const l=`${e.name} — Cred Score: ${e.credScore}/100 — Rating: ${i}
${window.location.href}`;if(navigator.share)navigator.share({title:`$CRED Report: ${e.name}`,text:l,url:window.location.href});else{navigator.clipboard.writeText(l);const x=p("   COPIED TO CLIPBOARD.","crt-highlight");setTimeout(()=>x?.remove(),2e3)}};const C=document.createElement("button");C.className="crt-btn",C.textContent="[ VIEW API ]",C.onclick=()=>window.open(`${I}/api/v2/agent/${o}/cred`,"_blank"),N.appendChild(A),N.appendChild(k),N.appendChild(C),r.appendChild(N),r.scrollTop=r.scrollHeight},[p,c,E,m]),b=w.useCallback(async()=>{g.current&&(await t(400),await c("HELIXA CRED BUREAU v2.0",40),await t(300),await c("INITIALIZING...",50),await t(600),await c("CONNECTING TO BASE NETWORK...",35),await t(800),await c("CONNECTED. CHAIN ID: 8453",35),await t(300),await c("READY.",60),await t(200),p(""),m())},[c,p,m]);return w.useEffect(()=>(g.current=!0,b(),()=>{g.current=!1}),[b]),f.jsxs(f.Fragment,{children:[f.jsx("style",{children:`
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
      `}),f.jsxs("div",{className:"cred-report-page",children:[f.jsx(P,{to:"/",className:"cred-back-link",children:"← Back to Helixa"}),f.jsxs("div",{className:"crt-monitor",children:[f.jsx("div",{className:"crt-monitor-led"}),f.jsxs("div",{className:"crt-screen-wrap",children:[f.jsx("div",{className:"crt-flicker-overlay"}),f.jsxs("div",{className:"crt-text-logo",children:[f.jsx("div",{className:"crt-text-logo-main",children:"$CRED"}),f.jsx("div",{className:"crt-text-logo-sub",children:"REPORT"})]}),f.jsx("div",{className:"crt-roll-overlay"}),f.jsx("div",{className:"crt-scanlines"}),f.jsx("div",{className:"crt-vignette"}),f.jsx("div",{className:"crt-screen-content",ref:s})]})]})]})]})}export{V as CredReport};
