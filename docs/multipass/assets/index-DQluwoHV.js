(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))s(i);new MutationObserver(i=>{for(const n of i)if(n.type==="childList")for(const o of n.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&s(o)}).observe(document,{childList:!0,subtree:!0});function r(i){const n={};return i.integrity&&(n.integrity=i.integrity),i.referrerPolicy&&(n.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?n.credentials="include":i.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function s(i){if(i.ep)return;i.ep=!0;const n=r(i);fetch(i.href,n)}})();const h={modeLabel:"Static Demo",sourceLabel:"bundled fixture",profile:{schema_version:"0.1.0",multipass_id:"mp_bendr_2",subject_type:"agent",display_name:"Bendr 2.0",slug:"bendr-2",status:"link_ready",owner_summary:{owner_state:"unclaimed",verification_status:"none",visibility:"public",summary:"Demo ownership state for public static preview."},custody_epoch:null,public_fragments:[{fragment_id:"frag_bendr_profile",fragment_type:"attestation",status:"pending",assurance_level:"unverified",visibility:"public",updated_at:"2026-06-24T00:00:00Z"},{fragment_id:"frag_bendr_endpoint",fragment_type:"endpoint",status:"pending",assurance_level:"unverified",visibility:"public",updated_at:"2026-06-24T00:00:00Z"},{fragment_id:"frag_bendr_standard_ref",fragment_type:"standard_ref",status:"pending",assurance_level:"unverified",visibility:"public",updated_at:"2026-06-24T00:00:00Z"},{fragment_id:"frag_bendr_x402_route",fragment_type:"endpoint",status:"pending",assurance_level:"unverified",visibility:"public",updated_at:"2026-06-24T00:00:00Z"}],cred_summary:{trust_state:"none",attestation_count:0,receipt_count:1,last_updated_at:null,public_note:"Sample public static data only."},discovery_profile:{summary:"Bendr 2.0 is a Helixa and Multipass demo agent for public preview and integration testing.",tags:["bendr","helixa","multipass"],avatar_url:null,visibility:"public"},standards_profile:{standards_profile_id:"sp_bendr_2",supported_standard_ids:["ERC-8004","ERC-8217","ERC-8126","ERC-8257","ERC-8183"],last_verified_at:null},payment_profile:{accepted_assets:[{asset:"CRED",chain_id:8453}],x402_manifest_url:"/multipass/static/x402-manifest.json",paid_endpoints_enabled:!1},updated_at:"2026-06-24T00:00:00Z"},fragments:{subject_id:"bendr-2",fragments:[{schema_version:"0.1.0",fragment_id:"frag_bendr_profile",multipass_id:"mp_bendr_2",fragment_type:"attestation",status:"pending",assurance_level:"unverified",visibility:"public",transfer_policy:"reverify_on_transfer",source:{source_type:"owner_submission",source_id:"bendr_profile",issuer:null,observed_at:"2026-06-24T00:00:00Z",reference_url:null},public_value:"Bendr 2.0 Helixa demo profile fragment.",proof_reference:null,created_at:"2026-06-24T00:00:00Z",updated_at:"2026-06-24T00:00:00Z"},{schema_version:"0.1.0",fragment_id:"frag_bendr_endpoint",multipass_id:"mp_bendr_2",fragment_type:"endpoint",status:"pending",assurance_level:"unverified",visibility:"public",transfer_policy:"reverify_on_transfer",source:{source_type:"owner_submission",source_id:"bendr_endpoint",issuer:null,observed_at:"2026-06-24T00:00:00Z",reference_url:null},public_value:"Bendr public static demo endpoint.",proof_reference:null,created_at:"2026-06-24T00:00:00Z",updated_at:"2026-06-24T00:00:00Z",endpoint_ref:{endpoint_id:"lookup",url:"/multipass/",protocol:"api",manifest_url:"/multipass/static/x402-manifest.json"}},{schema_version:"0.1.0",fragment_id:"frag_bendr_standard_ref",multipass_id:"mp_bendr_2",fragment_type:"standard_ref",status:"pending",assurance_level:"unverified",visibility:"public",transfer_policy:"reverify_on_transfer",source:{source_type:"owner_submission",source_id:"bendr_standard",issuer:null,observed_at:"2026-06-24T00:00:00Z",reference_url:null},public_value:"ERC-8004 adapter reference, not a live identity claim.",proof_reference:null,created_at:"2026-06-24T00:00:00Z",updated_at:"2026-06-24T00:00:00Z"},{schema_version:"0.1.0",fragment_id:"frag_bendr_x402_route",multipass_id:"mp_bendr_2",fragment_type:"endpoint",status:"pending",assurance_level:"unverified",visibility:"public",transfer_policy:"reverify_on_transfer",source:{source_type:"owner_submission",source_id:"bendr_x402",issuer:null,observed_at:"2026-06-24T00:00:00Z",reference_url:null},public_value:"Sample CRED-gated x402 route for public static preview.",proof_reference:null,created_at:"2026-06-24T00:00:00Z",updated_at:"2026-06-24T00:00:00Z",endpoint_ref:{endpoint_id:"lookup",url:"/multipass/",protocol:"x402",manifest_url:"/multipass/static/x402-manifest.json"}}]},card:{schema_version:"0.1.0",multipass_id:"mp_bendr_2",name:"Bendr 2.0",subject_type:"agent",capabilities:[{capability_id:"profile_lookup",label:"Profile lookup",description:"Read public Multipass profile data from the static preview.",visibility:"public"}],message_routes:[{route_id:"static_demo",channel:"web",address:"/multipass/",visibility:"public"}],service_endpoints:[{endpoint_id:"lookup",url:"/multipass/",description:"Static public profile preview.",visibility:"public"}],x402_manifest_url:"/multipass/static/x402-manifest.json",accepted_assets:[{asset:"CRED",chain_id:8453}],trust_summary:{identity_status:"unverified",assurance_level:"unverified",last_updated_at:null},rate_limits:{requests:60,window_seconds:60,burst:10},contact_policy:{mode:"approval_required",requires_owner_approval:!0,policy_note:"Static demo only."},standards_refs:[{standard_id:"ERC-8004",support_status:"adapter_ready",record_id:null},{standard_id:"ERC-8217",support_status:"pending",record_id:null}]},standards:{schema_version:"0.1.0",standards_profile_id:"sp_bendr_2",multipass_id:"mp_bendr_2",primary_refs:{erc8004_identity:null,controller_asset:null,x402_manifest:"mp_bendr_2:x402"},standard_refs:[{standard_id:"ERC-8004",status:"adapter_ready",chain_id:8453,contract_address:null,record_id:null,adapter_version:"0.1.0",last_verified_at:null,assurance_level:"unverified"},{standard_id:"ERC-8217",status:"pending",chain_id:8453,contract_address:null,record_id:null,adapter_version:"0.1.0",last_verified_at:null,assurance_level:"unverified"},{standard_id:"ERC-8257",status:"pending",chain_id:null,contract_address:null,record_id:null,adapter_version:"0.1.0",last_verified_at:null,assurance_level:"unverified"}],compatibility_summary:{identity_bound:!1,owner_verified:!1,risk_checked:!1,tools_verified:!1,work_attested:!1,trust_updated:!1},adapter_versions:{"ERC-8004":"0.1.0","ERC-8217":"0.1.0","ERC-8257":"0.1.0"},last_verified_at:null},x402:{schema_version:"0.1.0",multipass_id:"mp_bendr_2",endpoints:[{endpoint_id:"lookup",url:"/multipass/",method:"GET",description:"Sample CRED-gated profile lookup route for public static preview.",price:{amount:"1",decimals:18},asset:"CRED",chain_id:8453,provider:"bankr_x402_cloud",settlement_reference_policy:"provider_receipt",rate_limit:{requests:10,window_seconds:60,burst:2},visibility:"public",requires_owner_approval:!1}]},receipt:{schema_version:"0.1.0",receipt_id:"receipt_bendr_lookup",multipass_id:"mp_bendr_2",endpoint_id:"lookup",provider:"bankr_x402_cloud",amount:"1",asset:"CRED",chain_id:8453,status:"settled",created_at:"2026-06-24T00:00:00Z",response_class:"success",settlement_reference:null,redaction_note:"Sample public static receipt. No private request or response payload is included."},routes:{}},p="/multipass-api";function $(e){const t=e.searchParams.get("api");if(!t)return p;try{const r=new URL(t);return["http:","https:"].includes(r.protocol)?f(r.toString()):p}catch{return p}}function w(e,t){const s=`${f(e||p)}/api/multipass/${encodeURIComponent(t.slug)}`;return{profile:s,fragments:`${s}/fragments`,card:`${s}/agent-card`,standards:`${s}/standards`,x402:`${s}/x402`,receipt:`${s}/receipts/${encodeURIComponent(t.receiptId)}`}}async function c(e,t=fetch){const r=await t(e);if(!r.ok)throw new Error(`GET ${e} failed with ${r.status}`);const s=await r.text();try{return JSON.parse(s)}catch(i){throw new Error(`API returned invalid JSON for ${e}: ${i.message}`)}}async function x({apiBase:e=p,subject:t,fetchImpl:r=fetch}){const s=w(e,t),[i,n,o,g,v,y]=await Promise.all([c(s.profile,r),c(s.fragments,r),c(s.card,r),c(s.standards,r),c(s.x402,r),c(s.receipt,r)]);return{profile:i,fragments:n,card:o,standards:g,x402:v,receipt:y,routes:s,modeLabel:"Local API Demo",sourceLabel:"local API"}}function S(e){const t=e.pathname;return!e.searchParams.has("api")&&(t==="/multipass"||t.startsWith("/multipass/"))}async function C(){return structuredClone(h)}function f(e){return e.endsWith("/")?e.slice(0,-1):e}const _={slug:"bendr-2",receiptId:"receipt_bendr_lookup"},u={eyebrow:"MULTIPASS RECORD",headline:"Verifiable identity records for autonomous agents.",body:"Multipass turns agent identity, public proof, standards, and access receipts into one portable trust object.",note:"Local demo reading the Bendr 2.0 fixture."};function E(e){return`${e.display_name} is a ${e.subject_type} profile with status ${e.status} and trust state ${e.cred_summary?.trust_state??"none"}.`}function j(e){return[{title:"Identity Graph",label:`${m(e.fragments).length} public fragments`,body:"Public fragments make the agent legible without exposing private records."},{title:"Standards Spine",label:`${e.standards.standard_refs.length} standard refs`,body:"Standards references sit directly inside the profile record instead of living as loose claims."},{title:"Access and Receipts",label:`${e.x402.endpoints.length} x402 endpoint`,body:"Endpoint access can produce receipt evidence, kept close to the identity object."}]}function R(e){const t=m(e.fragments),r=T(e.fragments,t);return[{title:"Profile",status:e.profile.status,summary:E(e.profile),json:d(e.profile)},{title:"Public Fragments",status:`${t.length} public`,summary:t.map(s=>s.fragment_id).join(", ")||"No public fragments returned.",json:r},{title:"Agent Card",status:`${e.card.capabilities.length} capabilities`,summary:`${e.card.service_endpoints.length} service endpoint records available.`,json:d(e.card)},{title:"Standards",status:`${e.standards.standard_refs.length} refs`,summary:A(e.standards.standard_refs),json:d(e.standards)},{title:"x402",status:`${e.x402.endpoints.length} endpoints`,summary:e.x402.endpoints.map(s=>`${s.endpoint_id} accepts ${s.asset}`).join(", ")||"No endpoints returned.",json:d(e.x402)},{title:"Receipt",status:e.receipt.status,summary:`${e.receipt.receipt_id} records a ${e.receipt.response_class??"unknown"} response.`,json:d(e.receipt)}]}function T(e,t){const r={fragments:d(t)};for(const s of["multipass_id","profile_id","subject_id","schema_version"])e[s]!==void 0&&(r[s]=e[s]);return r}function d(e){if(Array.isArray(e))return e.map(t=>d(t)).filter(t=>t!==void 0);if(!e||typeof e!="object")return e;if(e.visibility!=="private")return Object.fromEntries(Object.entries(e).filter(([t])=>!P(t)).map(([t,r])=>[t,d(r)]).filter(([,t])=>t!==void 0))}function P(e){const t=e.toLowerCase();return t.startsWith("private")||t.includes("_private")}function m(e){return(e.fragments??[]).filter(t=>t.visibility==="public")}function A(e){return e.map(t=>`${t.standard_id}: ${t.status}`).join(", ")||"No standard refs returned."}function L({root:e,loadDemo:t=D}){if(!e)throw new Error("createApp requires a root element");let r={expandedCard:null};async function s(){k(e);try{const i=await t();r={...r,data:i},b(e,r)}catch(i){O(e,i)}}return{start:s}}function D(){const e=new URL(window.location.href);return S(e)?C():x({apiBase:$(e),subject:_})}function k(e){e.innerHTML=`
    <section class="record-shell loading-shell">
      <p class="eyebrow">${u.eyebrow}</p>
      <h1>Loading Bendr 2.0...</h1>
    </section>
  `}function O(e,t){e.innerHTML=`
    <section class="record-shell error-shell">
      <p class="eyebrow">${u.eyebrow}</p>
      <h1>Could not load Multipass API data.</h1>
      <p>Run <code>pnpm api:bendr</code> in the Multipass repo, then reload this page.</p>
      <pre class="json-panel">${a(t.message)}</pre>
    </section>
  `}function b(e,t){const{data:r}=t,s=j(r),i=R(r);e.innerHTML=`
    <div class="record-shell">
      <header class="record-header">
        <div class="brand"><div class="mark" aria-hidden="true"></div><span>Multipass</span></div>
        <div class="header-meta"><span>Protocol Artifact</span><span>${a(r.modeLabel??"Local API Demo")}</span></div>
      </header>

      <section class="hero-record">
        <div>
          <p class="eyebrow">${u.eyebrow}</p>
          <h1>${u.headline}</h1>
          <p class="lead">${u.body}</p>
          <div class="note">${u.note}</div>
        </div>

        <article class="record-sheet">
          <div class="sheet-top">
            <div>
              <h2>${a(r.profile.display_name)}</h2>
              <p>Agent profile with public identity fragments, standards references, x402 route metadata, and receipt evidence.</p>
            </div>
            <div class="stamp">Public proof only</div>
          </div>
          <div class="field-grid">
            ${l("Record",r.profile.multipass_id??_.slug)}
            ${l("Subject",r.profile.subject_type)}
            ${l("Slug",r.profile.slug??_.slug)}
            ${l("Status",r.profile.status,"status")}
            ${l("Trust State",r.profile.cred_summary?.trust_state??"none")}
            ${l("Source",r.sourceLabel??"local API")}
            ${l("Receipt",r.receipt.receipt_id)}
          </div>
        </article>
      </section>

      <section class="story-records">${s.map(Z).join("")}</section>

      <section class="proof-ledger">
        <div class="ledger-title"><h2>Proof ledger</h2><span>Expandable API records</span></div>
        ${i.map((n,o)=>M(n,o,t.expandedCard)).join("")}
      </section>

      <footer class="footer-note">This is a static public demo. It does not include auth, persistence, contract reads, or payment settlement.</footer>
    </div>
  `,e.querySelectorAll('[data-action="toggle-json"]').forEach(n=>{n.addEventListener("click",()=>{const o=Number(n.dataset.index);t.expandedCard=t.expandedCard===o?null:o,b(e,t),e.querySelector(`[data-action="toggle-json"][data-index="${o}"]`)?.focus()})})}function l(e,t,r=""){const s=r?` ${r}`:"";return`
    <div class="field">
      <span>${a(e)}</span>
      <strong class="mono${s}">${a(t)}</strong>
    </div>
  `}function Z(e,t){return`
    <article class="story">
      <span class="story-num">${String(t+1).padStart(2,"0")}</span>
      <p class="card-label">${a(e.label)}</p>
      <h3>${a(e.title)}</h3>
      <p>${a(e.body)}</p>
    </article>
  `}function M(e,t,r){const s=r===t;return`
    <article class="ledger-entry">
      <div class="ledger-row">
        <div class="doc">${a(e.title)}</div>
        <div class="badge ${I(e)}">${a(e.status)}</div>
        <div class="summary">${a(e.summary)}</div>
        <button data-action="toggle-json" data-index="${t}" aria-expanded="${s}" aria-controls="proof-json-${t}">${s?"Hide JSON":"Show JSON"}</button>
      </div>
      ${s?`<pre id="proof-json-${t}" class="json-panel">${a(JSON.stringify(e.json,null,2))}</pre>`:""}
    </article>
  `}function I(e){return["settled","passed","filtered"].includes(String(e.status).toLowerCase())?"verified":"neutral"}function a(e){return String(e).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;")}L({root:document.querySelector("#app")}).start();
