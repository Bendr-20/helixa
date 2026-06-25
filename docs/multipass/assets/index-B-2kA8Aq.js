(function(){const r=document.createElement("link").relList;if(r&&r.supports&&r.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))t(s);new MutationObserver(s=>{for(const n of s)if(n.type==="childList")for(const o of n.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&t(o)}).observe(document,{childList:!0,subtree:!0});function i(s){const n={};return s.integrity&&(n.integrity=s.integrity),s.referrerPolicy&&(n.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?n.credentials="include":s.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function t(s){if(s.ep)return;s.ep=!0;const n=i(s);fetch(s.href,n)}})();const Q={modeLabel:"Static Demo",sourceLabel:"bundled fixture",profile:{schema_version:"0.1.0",multipass_id:"mp_bendr_2",subject_type:"agent",display_name:"Bendr 2.0",slug:"bendr-2",status:"link_ready",owner_summary:{owner_state:"unclaimed",verification_status:"none",visibility:"public",summary:"Demo ownership state for public static preview."},custody_epoch:null,public_fragments:[{fragment_id:"frag_bendr_profile",fragment_type:"attestation",status:"verified",assurance_level:"platform_verified",visibility:"public",updated_at:"2026-06-24T00:00:00Z"},{fragment_id:"frag_bendr_endpoint",fragment_type:"endpoint",status:"pending",assurance_level:"self_attested",visibility:"public",updated_at:"2026-06-24T00:00:00Z"},{fragment_id:"frag_bendr_standard_ref",fragment_type:"standard_ref",status:"stale",assurance_level:"issuer_attested",visibility:"public",updated_at:"2026-06-24T00:00:00Z"},{fragment_id:"frag_bendr_receipt_history",fragment_type:"receipt",status:"historical",assurance_level:"issuer_attested",visibility:"public",updated_at:"2026-06-24T00:00:00Z"},{fragment_id:"frag_bendr_route_dispute",fragment_type:"verification_result",status:"disputed",assurance_level:"unverified",visibility:"public",updated_at:"2026-06-24T00:00:00Z"},{fragment_id:"frag_bendr_helixa_identity",fragment_type:"attestation",status:"verified",assurance_level:"onchain_verified",visibility:"public",updated_at:"2026-06-24T22:49:52Z"},{fragment_id:"frag_bendr_cred_score",fragment_type:"risk_summary",status:"verified",assurance_level:"platform_verified",visibility:"public",updated_at:"2026-06-24T22:49:52Z"},{fragment_id:"frag_bendr_social_x",fragment_type:"social",status:"verified",assurance_level:"platform_verified",visibility:"public",updated_at:"2026-06-24T22:49:52Z"}],cred_summary:{trust_state:"established",attestation_count:4,receipt_count:1,last_updated_at:"2026-06-24T22:49:52Z",public_note:"Cred score 80 imported from Helixa API. Cred is a signal, not something bought or raised by payment."},discovery_profile:{summary:"Bendr 2.0 is the Helixa lead agent with AgentDNA token #1, imported Cred context, public routes, and machine-readable Multipass records.",tags:["bendr","helixa","multipass"],avatar_url:null,visibility:"public"},standards_profile:{standards_profile_id:"sp_bendr_2",supported_standard_ids:["ERC-8004","ERC-8217","ERC-8126","ERC-8257","ERC-8183"],last_verified_at:null},payment_profile:{accepted_assets:[{asset:"CRED",chain_id:8453}],x402_manifest_url:"/multipass/static/x402-manifest.json",paid_endpoints_enabled:!1},updated_at:"2026-06-24T22:49:52Z"},fragments:{subject_id:"bendr-2",fragments:[{schema_version:"0.1.0",fragment_id:"frag_bendr_profile",multipass_id:"mp_bendr_2",fragment_type:"attestation",status:"verified",assurance_level:"platform_verified",visibility:"public",transfer_policy:"historical_on_transfer",source:{source_type:"platform_check",source_id:"bendr_profile",issuer:"Helixa",observed_at:"2026-06-24T00:00:00Z",reference_url:null},public_value:"Bendr 2.0 profile claim checked by the Helixa fixture.",proof_reference:"fixture:profile-check",created_at:"2026-06-24T00:00:00Z",updated_at:"2026-06-24T00:00:00Z",verified_at:"2026-06-24T00:00:00Z"},{schema_version:"0.1.0",fragment_id:"frag_bendr_endpoint",multipass_id:"mp_bendr_2",fragment_type:"endpoint",status:"pending",assurance_level:"self_attested",visibility:"public",transfer_policy:"reverify_on_transfer",source:{source_type:"owner_submission",source_id:"bendr_endpoint",issuer:null,observed_at:"2026-06-24T00:00:00Z",reference_url:null},public_value:"Bendr local API endpoint awaiting live verification.",proof_reference:null,created_at:"2026-06-24T00:00:00Z",updated_at:"2026-06-24T00:00:00Z",endpoint_ref:{endpoint_id:"lookup",url:"/multipass/",protocol:"api",manifest_url:"/multipass/static/x402-manifest.json"}},{schema_version:"0.1.0",fragment_id:"frag_bendr_standard_ref",multipass_id:"mp_bendr_2",fragment_type:"standard_ref",status:"stale",assurance_level:"issuer_attested",visibility:"public",transfer_policy:"pause_on_transfer",source:{source_type:"issuer_attestation",source_id:"bendr_standard",issuer:"Helixa",observed_at:"2026-06-24T00:00:00Z",reference_url:null},public_value:"ERC-8004 adapter reference that needs a fresh check before stronger claims.",proof_reference:"fixture:standard-ref",created_at:"2026-06-24T00:00:00Z",updated_at:"2026-06-24T00:00:00Z",verified_at:"2026-06-24T00:00:00Z",expires_at:"2026-06-25T00:00:00Z"},{schema_version:"0.1.0",fragment_id:"frag_bendr_receipt_history",multipass_id:"mp_bendr_2",fragment_type:"receipt",status:"historical",assurance_level:"issuer_attested",visibility:"public",transfer_policy:"historical_on_transfer",source:{source_type:"payment_receipt",source_id:"bendr_receipt",issuer:"Helixa",observed_at:"2026-06-24T00:00:00Z",reference_url:null},public_value:"Receipt evidence retained as history; it does not create trust by itself.",proof_reference:"receipt_bendr_lookup",created_at:"2026-06-24T00:00:00Z",updated_at:"2026-06-24T00:00:00Z"},{schema_version:"0.1.0",fragment_id:"frag_bendr_route_dispute",multipass_id:"mp_bendr_2",fragment_type:"verification_result",status:"disputed",assurance_level:"unverified",visibility:"public",transfer_policy:"never_transfer",source:{source_type:"platform_check",source_id:"bendr_route_dispute",issuer:"Helixa",observed_at:"2026-06-24T00:00:00Z",reference_url:null},public_value:"Route claim intentionally marked disputed in the fixture.",proof_reference:"fixture:route-dispute",created_at:"2026-06-24T00:00:00Z",updated_at:"2026-06-24T00:00:00Z",verification_ref:{verification_type:"route_review",result:"inconclusive",issuer:"Helixa",risk_level:"medium",score:null}},{schema_version:"0.1.0",fragment_id:"frag_bendr_helixa_identity",multipass_id:"mp_bendr_2",fragment_type:"attestation",status:"verified",assurance_level:"onchain_verified",visibility:"public",transfer_policy:"historical_on_transfer",source:{source_type:"contract_read",source_id:"helixa_agentdna_1",issuer:"Helixa",observed_at:"2026-06-24T22:49:52Z",reference_url:"https://api.helixa.xyz/api/v2/agent/1"},public_value:"Helixa AgentDNA token #1 on Base, contract 0x2e3B541C59D38b84E3Bc54e977200230A204Fe60.",proof_reference:"base:8453:0x2e3B541C59D38b84E3Bc54e977200230A204Fe60:1",created_at:"2026-06-24T22:49:52Z",updated_at:"2026-06-24T22:49:52Z",verified_at:"2026-06-24T22:49:52Z"},{schema_version:"0.1.0",fragment_id:"frag_bendr_cred_score",multipass_id:"mp_bendr_2",fragment_type:"risk_summary",status:"verified",assurance_level:"platform_verified",visibility:"public",transfer_policy:"reverify_on_transfer",source:{source_type:"registry_import",source_id:"helixa_cred_score_1",issuer:"Helixa",observed_at:"2026-06-24T22:49:52Z",reference_url:"https://api.helixa.xyz/api/v2/agent/1"},public_value:"Cred score 80, Preferred tier, imported from Helixa API.",proof_reference:"helixa-api:agent:1:credScore",created_at:"2026-06-24T22:49:52Z",updated_at:"2026-06-24T22:49:52Z",verified_at:"2026-06-24T22:49:52Z",verification_ref:{verification_type:"cred_import",result:"passed",issuer:"Helixa",risk_level:"low",score:80}},{schema_version:"0.1.0",fragment_id:"frag_bendr_social_x",multipass_id:"mp_bendr_2",fragment_type:"social",status:"verified",assurance_level:"platform_verified",visibility:"public",transfer_policy:"reverify_on_transfer",source:{source_type:"platform_check",source_id:"bendr_x_handle",issuer:"Helixa",observed_at:"2026-06-24T22:49:52Z",reference_url:"https://api.helixa.xyz/api/v2/agent/1"},public_value:"X handle @BendrAI_eth imported from Helixa API.",proof_reference:"helixa-api:agent:1:socials.x",created_at:"2026-06-24T22:49:52Z",updated_at:"2026-06-24T22:49:52Z",verified_at:"2026-06-24T22:49:52Z"},{schema_version:"0.1.0",fragment_id:"frag_quigbot_identity",multipass_id:"mp_quigbot",fragment_type:"attestation",status:"verified",assurance_level:"platform_verified",visibility:"public",transfer_policy:"historical_on_transfer",source:{source_type:"platform_check",source_id:"quigbot_identity",issuer:"Helixa",observed_at:"2026-06-24T23:50:00Z",reference_url:"https://helixa.xyz/agent/81"},public_value:"Quigbot identity checked by the Helixa fixture.",proof_reference:"fixture:quigbot-identity",created_at:"2026-06-24T23:50:00Z",updated_at:"2026-06-24T23:50:00Z",verified_at:"2026-06-24T23:50:00Z"},{schema_version:"0.1.0",fragment_id:"frag_quigbot_cred",multipass_id:"mp_quigbot",fragment_type:"risk_summary",status:"verified",assurance_level:"platform_verified",visibility:"public",transfer_policy:"reverify_on_transfer",source:{source_type:"registry_import",source_id:"quigbot_cred",issuer:"Helixa",observed_at:"2026-06-24T23:50:00Z",reference_url:"https://helixa.xyz/agent/81"},public_value:"Quigbot Cred score 75, Prime tier.",proof_reference:"fixture:quigbot-cred",created_at:"2026-06-24T23:50:00Z",updated_at:"2026-06-24T23:50:00Z",verified_at:"2026-06-24T23:50:00Z"},{schema_version:"0.1.0",fragment_id:"frag_e2etest_identity",multipass_id:"mp_e2etest",fragment_type:"attestation",status:"pending",assurance_level:"self_attested",visibility:"public",transfer_policy:"reverify_on_transfer",source:{source_type:"owner_submission",source_id:"e2etest_identity",issuer:"Helixa",observed_at:"2026-06-24T23:50:00Z",reference_url:"https://helixa.xyz/agent/0"},public_value:"E2ETest is a low-assurance test record.",proof_reference:"fixture:e2etest-identity",created_at:"2026-06-24T23:50:00Z",updated_at:"2026-06-24T23:50:00Z"},{schema_version:"0.1.0",fragment_id:"frag_e2etest_cred",multipass_id:"mp_e2etest",fragment_type:"risk_summary",status:"disputed",assurance_level:"unverified",visibility:"public",transfer_policy:"never_transfer",source:{source_type:"platform_check",source_id:"e2etest_cred",issuer:"Helixa",observed_at:"2026-06-24T23:50:00Z",reference_url:"https://helixa.xyz/agent/0"},public_value:"Lower trust context for a test/demo agent.",proof_reference:"fixture:e2etest-cred",created_at:"2026-06-24T23:50:00Z",updated_at:"2026-06-24T23:50:00Z"},{schema_version:"0.1.0",fragment_id:"frag_helixa_swarm_roster",multipass_id:"mp_helixa_swarm",fragment_type:"custody_record",status:"verified",assurance_level:"platform_verified",visibility:"public",transfer_policy:"pause_on_transfer",source:{source_type:"platform_check",source_id:"helixa_swarm_roster",issuer:"Helixa",observed_at:"2026-06-24T23:38:00Z",reference_url:"https://helixa.xyz/multipass/"},public_value:"Parent Multipass manages Bendr, Quigbot, and E2ETest demo agents as one collection roster.",proof_reference:"fixture:helixa-swarm-roster",created_at:"2026-06-24T23:38:00Z",updated_at:"2026-06-24T23:38:00Z",verified_at:"2026-06-24T23:38:00Z"},{schema_version:"0.1.0",fragment_id:"frag_helixa_swarm_tools",multipass_id:"mp_helixa_swarm",fragment_type:"endpoint",status:"pending",assurance_level:"self_attested",visibility:"public",transfer_policy:"pause_on_transfer",source:{source_type:"owner_submission",source_id:"helixa_swarm_tools",issuer:"Helixa",observed_at:"2026-06-24T23:38:00Z",reference_url:"https://helixa.xyz/multipass/"},public_value:"Shared tool policy preview for routes, permissions, and approvals across the swarm.",proof_reference:"fixture:helixa-swarm-tools",created_at:"2026-06-24T23:38:00Z",updated_at:"2026-06-24T23:38:00Z",endpoint_ref:{endpoint_id:"swarm_policy",url:"https://helixa.xyz/multipass/",protocol:"api",manifest_url:"/multipass/static/x402-manifest.json"}},{schema_version:"0.1.0",fragment_id:"frag_helixa_swarm_cred",multipass_id:"mp_helixa_swarm",fragment_type:"risk_summary",status:"verified",assurance_level:"platform_verified",visibility:"public",transfer_policy:"reverify_on_transfer",source:{source_type:"registry_import",source_id:"helixa_swarm_cred",issuer:"Helixa",observed_at:"2026-06-24T23:38:00Z",reference_url:"https://helixa.xyz/multipass/"},public_value:"Aggregate Cred context summarizes the roster without erasing each agent's individual profile.",proof_reference:"fixture:helixa-swarm-cred",created_at:"2026-06-24T23:38:00Z",updated_at:"2026-06-24T23:38:00Z",verified_at:"2026-06-24T23:38:00Z",verification_ref:{verification_type:"swarm_cred_summary",result:"passed",issuer:"Helixa",risk_level:"medium",score:78}}]},card:{schema_version:"0.1.0",multipass_id:"mp_bendr_2",name:"Bendr 2.0",subject_type:"agent",capabilities:[{capability_id:"profile_lookup",label:"Profile lookup",description:"Read public Multipass profile data from the static preview.",visibility:"public"},{capability_id:"agent_card_resolution",label:"Agent card resolution",description:"Resolve compact agent card fields for discovery and trust checks.",visibility:"public"}],message_routes:[{route_id:"web_profile",channel:"api",address:"https://helixa.xyz/agent/1",visibility:"public"},{route_id:"telegram",channel:"chat",address:"@bendr2bot",visibility:"public"}],service_endpoints:[{endpoint_id:"helixa_profile",url:"https://api.helixa.xyz/api/v2/agent/1",description:"Public Helixa AgentDNA profile for Bendr 2.0.",visibility:"public"},{endpoint_id:"multipass_preview",url:"https://helixa.xyz/multipass/",description:"Hidden Multipass prototype preview.",visibility:"public"}],x402_manifest_url:"/multipass/static/x402-manifest.json",accepted_assets:[{asset:"CRED",chain_id:8453}],trust_summary:{identity_status:"verified",assurance_level:"onchain_verified",last_updated_at:"2026-06-24T22:49:52Z"},rate_limits:{requests:60,window_seconds:60,burst:10},contact_policy:{mode:"approval_required",requires_owner_approval:!0,policy_note:"Static demo only."},standards_refs:[{standard_id:"ERC-8004",support_status:"adapter_ready",record_id:null},{standard_id:"ERC-8217",support_status:"pending",record_id:null}]},standards:{schema_version:"0.1.0",standards_profile_id:"sp_bendr_2",multipass_id:"mp_bendr_2",primary_refs:{erc8004_identity:null,controller_asset:null,x402_manifest:"mp_bendr_2:x402"},standard_refs:[{standard_id:"ERC-8004",status:"adapter_ready",chain_id:8453,contract_address:null,record_id:null,adapter_version:"0.1.0",last_verified_at:null,assurance_level:"unverified"},{standard_id:"ERC-8217",status:"pending",chain_id:8453,contract_address:null,record_id:null,adapter_version:"0.1.0",last_verified_at:null,assurance_level:"unverified"},{standard_id:"ERC-8257",status:"pending",chain_id:null,contract_address:null,record_id:null,adapter_version:"0.1.0",last_verified_at:null,assurance_level:"unverified"}],compatibility_summary:{identity_bound:!1,owner_verified:!1,risk_checked:!1,tools_verified:!1,work_attested:!1,trust_updated:!1},adapter_versions:{"ERC-8004":"0.1.0","ERC-8217":"0.1.0","ERC-8257":"0.1.0"},last_verified_at:null},x402:{schema_version:"0.1.0",multipass_id:"mp_bendr_2",endpoints:[{endpoint_id:"lookup",url:"/multipass/",method:"GET",description:"Sample CRED-gated profile lookup route for public static preview.",price:{amount:"1",decimals:18},asset:"CRED",chain_id:8453,provider:"bankr_x402_cloud",settlement_reference_policy:"provider_receipt",rate_limit:{requests:10,window_seconds:60,burst:2},visibility:"public",requires_owner_approval:!1}]},receipt:{schema_version:"0.1.0",receipt_id:"receipt_bendr_lookup",multipass_id:"mp_bendr_2",endpoint_id:"lookup",provider:"bankr_x402_cloud",amount:"1",asset:"CRED",chain_id:8453,status:"settled",created_at:"2026-06-24T00:00:00Z",response_class:"success",settlement_reference:null,redaction_note:"Sample public static receipt. No private request or response payload is included."},routes:{},agentCards:[{name:"Bendr 2.0",tokenId:1,helixaId:"8453:1",framework:"openclaw",credScore:80,credTier:"Preferred",verified:!0,profileUrl:"https://helixa.xyz/agent/1",proofFragmentIds:["frag_bendr_profile","frag_bendr_endpoint","frag_bendr_standard_ref","frag_bendr_receipt_history","frag_bendr_route_dispute","frag_bendr_helixa_identity","frag_bendr_cred_score"],ownerSnapshot:{owner:"0x3395...480E0",operator:"Bendr runtime",custodyEpoch:"Epoch 01",permissionState:"Active owner-approved routes",visibility:"Public profile, private credentials hidden",recentChange:"Cred import refreshed",reviewAction:"Review stale standards reference"},changeReviewLedger:[{event:"Cred import refreshed",source:"Helixa API",impact:"Cred context updated",reviewState:"Verified"},{event:"Standards reference stale",source:"Standards profile",impact:"Adapter claim needs a fresh check",reviewState:"Reverify"},{event:"Private credentials hidden",source:"Private vault",impact:"No public data exposed",reviewState:"No public action"}]},{name:"Quigbot",tokenId:81,helixaId:"8453:81",framework:"openclaw",credScore:75,credTier:"Prime",verified:!0,profileUrl:"https://helixa.xyz/agent/81",proofFragmentIds:["frag_quigbot_identity","frag_quigbot_cred"],ownerSnapshot:{owner:"0x17d7...bDe4",operator:"Quigbot runtime",custodyEpoch:"Epoch 01",permissionState:"Active owner-approved routes",visibility:"Public profile, private credentials hidden",recentChange:"Identity and Cred context imported",reviewAction:"No public review action"},changeReviewLedger:[{event:"Identity context imported",source:"Helixa fixture",impact:"Agent card updated",reviewState:"Verified"},{event:"Cred import refreshed",source:"Helixa API",impact:"Cred context updated",reviewState:"Verified"},{event:"Private credentials hidden",source:"Private vault",impact:"No public data exposed",reviewState:"No public action"}]},{name:"E2ETest",tokenId:0,helixaId:"8453:0",framework:"openclaw",credScore:41,credTier:"Marginal",verified:!1,profileUrl:"https://helixa.xyz/agent/0",proofFragmentIds:["frag_e2etest_identity","frag_e2etest_cred"],ownerSnapshot:{owner:"Demo owner pending",operator:"Test fixture",custodyEpoch:"Draft epoch",permissionState:"Review required before active routes",visibility:"Public test profile",recentChange:"Low-assurance test record imported",reviewAction:"Verify owner before production use"},changeReviewLedger:[{event:"Low-assurance test record imported",source:"Test fixture",impact:"Routes remain inactive",reviewState:"Review required"},{event:"Owner verification missing",source:"Owner registry",impact:"Production use blocked",reviewState:"Reverify"},{event:"Private credentials hidden",source:"Private vault",impact:"No public data exposed",reviewState:"No public action"}]},{name:"Helixa Swarm",tokenId:"swarm:helixa",helixaId:"8453:swarm:helixa",framework:"multi-agent",credScore:78,credTier:"Prime",verified:!0,profileUrl:"https://helixa.xyz/swarm/helixa",subjectType:"swarm",members:3,role:"Parent Multipass",custody:"Custody epoch ready",proofFragmentIds:["frag_helixa_swarm_roster","frag_helixa_swarm_tools","frag_helixa_swarm_cred"],roster:[{name:"Bendr 2.0",role:"Lead agent"},{name:"Quigbot",role:"Product agent"},{name:"E2ETest",role:"Test agent"}],sharedControls:["Tool approval policy","Route policy reference","Owner approval required"],aggregateCred:"Cred 78 Prime summarizes the roster without replacing individual agent scores.",transferBehavior:"Permissions pause and tool routes reverify when custody changes.",transferPreview:{currentOwner:"0x3395...480E0",custodyEpoch:"Epoch 03",claimAction:"New owner claim required",permissionsState:"Permissions paused",toolAction:"Reverify shared tools",privateAccessAction:"Rotate private access",historyState:"History preserved",credContinuity:"Cred continues with ownership-change context."},ownerSnapshot:{owner:"0x3395...480E0",operator:"Helixa ops",custodyEpoch:"Epoch 03",permissionState:"Paused until owner review",visibility:"Public profile, gated private data",recentChange:"Transfer detected 2026-06-24",reviewAction:"Reverify routes before resume"},changeReviewLedger:[{event:"Cred import refreshed",source:"Helixa API",impact:"Aggregate Cred context updated",reviewState:"Verified"},{event:"Transfer detected",source:"Owner registry",impact:"Permissions paused",reviewState:"Review required"},{event:"Shared route policy changed",source:"Policy reference",impact:"Routes paused for recheck",reviewState:"Paused"},{event:"Standards reference stale",source:"Standards profile",impact:"Adapter claim needs a fresh check",reviewState:"Reverify"},{event:"Private credentials hidden",source:"Private vault",impact:"No secrets or private credentials exposed",reviewState:"No public action"}]}]},L="/multipass-api";function J(e){const r=D(e);return r?O(r.toString()):L}function D(e){const r=e.searchParams.get("api");if(!r)return null;try{const i=new URL(r);return["http:","https:"].includes(i.protocol)?i:null}catch{return null}}function W(e,r){const t=`${O(e||L)}/api/multipass/${encodeURIComponent(r.slug)}`;return{profile:t,fragments:`${t}/fragments`,card:`${t}/agent-card`,standards:`${t}/standards`,x402:`${t}/x402`,receipt:`${t}/receipts/${encodeURIComponent(r.receiptId)}`}}async function b(e,r=fetch){const i=await r(e);if(!i.ok)throw new Error(`GET ${e} failed with ${i.status}`);const t=await i.text();try{return JSON.parse(t)}catch(s){throw new Error(`API returned invalid JSON for ${e}: ${s.message}`)}}async function K({apiBase:e=L,subject:r,fetchImpl:i=fetch}){const t=W(e,r),[s,n,o,c,p,f]=await Promise.all([b(t.profile,i),b(t.fragments,i),b(t.card,i),b(t.standards,i),b(t.x402,i),b(t.receipt,i)]);return{profile:s,fragments:n,card:o,standards:c,x402:p,receipt:f,routes:t,modeLabel:"Local API Demo",sourceLabel:"local API"}}function Y(e){const r=e.pathname;return(r==="/multipass"||r.startsWith("/multipass/"))&&!D(e)}async function X(){return structuredClone(Q)}function O(e){return e.endsWith("/")?e.slice(0,-1):e}const g=8453,x="https://api.helixa.xyz/api/v2/agent";class _ extends Error{constructor(r,i,t={}){super(i),this.name="HelixaResolverError",this.code=r,this.details=t}}function ee(e){const r=String(e??"").trim();if(!r)throw new _("empty_input","Enter a Helixa token ID or Helixa ID.");if(/^\d+$/.test(r)){if(!N(r))throw new _("invalid_format","Use a token ID like 1 or a Helixa ID like 8453:1.");return{chainId:g,tokenId:r,canonicalId:`${g}:${r}`}}const i=r.match(/^(\d+):(\d+)$/);if(!i)throw new _("invalid_format","Use a token ID like 1 or a Helixa ID like 8453:1.");const t=Number(i[1]);if(t!==g)throw new _("unsupported_chain","V0 supports Base Helixa AgentDNA records only.",{chainId:t});const s=i[2];if(!N(s))throw new _("invalid_format","Use a token ID like 1 or a Helixa ID like 8453:1.");return{chainId:t,tokenId:s,canonicalId:`${g}:${s}`}}async function re(e,r=fetch){let i;try{i=await r(`${x}/${encodeURIComponent(e)}`,{method:"GET",credentials:"omit",headers:{Accept:"application/json"}})}catch(s){throw new _("network_error","Could not reach the Helixa API. Static demo is still available.",{cause:s.message})}if(!i.ok)throw i.status===404?new _("not_found","No Helixa agent found for that ID."):i.status===429?new _("rate_limited","Helixa API is rate-limiting requests. Try again shortly.",{retryAfter:i.headers?.get?.("Retry-After")??null}):new _("http_error",`GET Helixa agent failed with ${i.status}`,{status:i.status});const t=await i.text();try{return JSON.parse(t)}catch(s){throw new _("invalid_json","Helixa returned a response this prototype cannot read yet.",{cause:s.message})}}function te(e){const r=String(e?.tokenId??"").trim()||"unknown",i=e?.name||`Agent #${r}`,t=`mp_helixa_agent_${r}`,s=e?.services?.web?.url??`https://helixa.xyz/agent/${encodeURIComponent(r)}`,n=e?.mintedAt??new Date().toISOString(),o=ae(e,r,t,n),c=j(e?.credScore),p=ce(e),f=M(e),u={name:i,tokenId:r,helixaId:`${g}:${r}`,framework:e?.framework??e?.metadata?.framework??"unknown",credScore:S(e?.credScore)?Number(e.credScore):null,credTier:c,verified:!!e?.verified,profileUrl:s,proofFragmentIds:o.map(l=>l.fragment_id),ownerSnapshot:se(e),changeReviewLedger:ne(e),transferPreview:oe(e)};return{modeLabel:"Live Resolver",sourceLabel:"live Helixa API",heroNote:`Read-only live Helixa API data for ${i}.`,profile:{schema_version:"0.1.0",multipass_id:t,subject_type:"agent",display_name:i,slug:`helixa-agent-${r}`,status:"live_resolved",owner_summary:{owner_state:e?.owner?"observed":"not_published",verification_status:e?.verified?"verified":"unverified",visibility:"public",summary:"Public owner state observed from the live Helixa API."},custody_epoch:null,public_fragments:o.map(({fragment_id:l,fragment_type:v,status:B,assurance_level:z,visibility:V,updated_at:G})=>({fragment_id:l,fragment_type:v,status:B,assurance_level:z,visibility:V,updated_at:G})),cred_summary:{trust_state:S(e?.credScore)?"established":"pending",attestation_count:o.filter(l=>l.fragment_type==="attestation").length,receipt_count:0,last_updated_at:n,public_note:S(e?.credScore)?`Cred score ${e.credScore} imported from Helixa API. Cred is an evidence signal, not a payment outcome.`:"No live Cred score published by the Helixa API."},discovery_profile:{summary:`${i} resolved from the live Helixa API as AgentDNA token #${r}.`,tags:de(["helixa","multipass",e?.framework]),avatar_url:null,visibility:"public"},standards_profile:{standards_profile_id:`sp_helixa_agent_${r}`,supported_standard_ids:f,last_verified_at:null},payment_profile:{accepted_assets:p.map(l=>({asset:l.toUpperCase(),chain_id:g})),x402_manifest_url:null,paid_endpoints_enabled:!1},updated_at:n},fragments:{subject_id:`helixa-agent-${r}`,fragments:o},card:le(e,r,s),agentCards:[u],standards:{standard_refs:f.map(l=>({standard_id:l,status:"referenced"}))},x402:{endpoints:p.map(l=>({endpoint_id:"live-profile-reference",asset:l.toUpperCase(),route:s,status:"planned"}))},receipt:{receipt_id:"No live receipt attached",status:"not_attached",response_class:null,redaction_note:"No live receipt attached to this public Helixa API record."},routes:{profile:`${x}/${encodeURIComponent(r)}`}}}async function ie(e,r=fetch){const i=ee(e),t=await re(i.tokenId,r);return{...te(t),resolver:i}}function ae(e,r,i,t){const s=[];s.push(C({fragment_id:`frag_live_${r}_identity`,multipass_id:i,fragment_type:"attestation",status:e?.verified?"verified":"pending",assurance_level:e?.verified?"onchain_verified":"platform_verified",transfer_policy:"historical_on_transfer",source_type:e?.explorer?"contract_read":"platform_check",observed_at:t,reference_url:e?.explorer??`https://helixa.xyz/agent/${encodeURIComponent(r)}`,public_value:`Helixa AgentDNA token #${r}${e?.mintOrigin?` minted from ${e.mintOrigin}`:""}.`})),S(e?.credScore)&&s.push(C({fragment_id:`frag_live_${r}_cred`,multipass_id:i,fragment_type:"risk_summary",status:"verified",assurance_level:"platform_verified",transfer_policy:"reverify_on_transfer",source_type:"registry_import",observed_at:t,reference_url:`${x}/${encodeURIComponent(r)}`,public_value:`Cred score ${e.credScore}, ${j(e.credScore)} tier, imported from Helixa API.`}));for(const[n,o]of Object.entries(e?.socials??{}))o&&s.push(C({fragment_id:`frag_live_${r}_social_${T(n)}`,multipass_id:i,fragment_type:"social",status:e?.verified?"verified":"pending",assurance_level:"platform_verified",transfer_policy:"reverify_on_transfer",source_type:"platform_check",observed_at:t,reference_url:`${x}/${encodeURIComponent(r)}`,public_value:`${H(n)} handle ${o} imported from Helixa API.`}));for(const[n,o]of Object.entries(e?.services??{})){const c=o?.url??o?.handle;c&&s.push(C({fragment_id:`frag_live_${r}_service_${T(n)}`,multipass_id:i,fragment_type:"endpoint",status:"pending",assurance_level:"self_attested",transfer_policy:"pause_on_transfer",source_type:"platform_check",observed_at:t,reference_url:`${x}/${encodeURIComponent(r)}`,public_value:`${H(n)} service route published by Helixa API.`,endpoint_ref:{endpoint_id:T(n),url:c,protocol:n}}))}for(const n of M(e))s.push(C({fragment_id:`frag_live_${r}_standard_${T(n)}`,multipass_id:i,fragment_type:"standard_ref",status:"stale",assurance_level:"issuer_attested",transfer_policy:"pause_on_transfer",source_type:"issuer_attestation",observed_at:t,reference_url:`${x}/${encodeURIComponent(r)}`,public_value:`${n} appears in public Helixa traits or metadata and needs a fresh adapter check before stronger claims.`}));return s}function C({fragment_id:e,multipass_id:r,fragment_type:i,status:t,assurance_level:s,transfer_policy:n,source_type:o,observed_at:c,reference_url:p,public_value:f,endpoint_ref:u=void 0}){return{schema_version:"0.1.0",fragment_id:e,multipass_id:r,fragment_type:i,status:t,assurance_level:s,visibility:"public",transfer_policy:n,source:{source_type:o,source_id:e,issuer:"Helixa",observed_at:c,reference_url:p},public_value:f,proof_reference:p,created_at:c,updated_at:c,...t==="verified"?{verified_at:c}:{},...u?{endpoint_ref:u}:{}}}function se(e){return{owner:k(e?.owner)??"Owner not published",operator:k(e?.operator)??"Not delegated",custodyEpoch:"Live API observation",permissionState:"Read-only public profile",visibility:"Public profile, private credentials hidden",recentChange:"Live profile fetched",reviewAction:"Review live identity fields",note:"State reference only. Multipass shows ownership, custody, visibility, and review context without executing approvals or transferring authority."}}function ne(e){const r=[{event:"Live profile fetched",source:"Helixa API",impact:"Public profile refreshed",reviewState:"Verified"},{event:"Owner observed",source:"Helixa API",impact:e?.owner?"Owner field published":"Owner not published",reviewState:e?.owner?"Verified":"Review required"},{event:"Private credentials hidden",source:"Private vault",impact:"No secrets or private credentials exposed",reviewState:"No public action"}];return S(e?.credScore)&&r.splice(1,0,{event:"Cred imported",source:"Helixa API",impact:`Cred score ${e.credScore} displayed as context`,reviewState:"Verified"}),Object.keys(e?.services??{}).length&&r.push({event:"Services reviewed",source:"Helixa API",impact:"Public routes shown as references only",reviewState:"Review required"}),r}function oe(e){return{currentOwner:k(e?.owner)??"Owner not published",custodyEpoch:"Live API observation",claimAction:"No transfer detected",permissionsState:"Read-only public profile",toolAction:"Reverify tools before active use",privateAccessAction:"Rotate private access on custody change",historyState:"Public history preserved",credContinuity:"Cred continues with ownership-change context if custody changes.",note:"Transfer state preview preserves public history but does not transfer secrets, private credentials, or active authority."}}function le(e,r,i){return{schema_version:"0.1.0",agent_id:`${g}:${r}`,name:e?.name??`Agent #${r}`,capabilities:[...e?.skills??[],...e?.domains??[]].map(t=>({name:t})),service_endpoints:Object.entries(e?.services??{}).map(([t,s])=>({endpoint_id:T(t),url:s?.url??s?.handle??i,protocol:t})),trust_summary:{identity_status:e?.verified?"verified":"pending",assurance_level:e?.verified?"onchain_verified":"platform_verified",cred_score:S(e?.credScore)?Number(e.credScore):null},profile_url:i}}function j(e){const r=Number(e);return Number.isFinite(r)?r>=80?"Preferred":r>=65?"Prime":r>=50?"Qualified":r>=30?"Marginal":"Junk":"Unrated"}function S(e){return Number.isFinite(Number(e))}function k(e){const r=String(e??"");return/^0x[a-fA-F0-9]{40}$/.test(r)?`${r.slice(0,6)}...${r.slice(-4)}`:null}function M(e){const r=[...e?.traits??[],...e?.skills??[],...e?.domains??[]].map(i=>typeof i=="string"?i:i?.name).filter(Boolean);return[...new Set(r.filter(i=>/^ERC-\d+/i.test(i)).map(i=>i.toUpperCase()))]}function ce(e){return[...new Set([...e?.metadata?.acceptedPayments??[],e?.linkedToken?.symbol].filter(Boolean).map(r=>String(r).toLowerCase()))]}function de(e){return e.filter(Boolean)}function T(e){return String(e).toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"")||"unknown"}function H(e){return String(e).replace(/[_-]+/g," ").replace(/\b\w/g,r=>r.toUpperCase())}function N(e){return/^\d+$/.test(e)&&!/^0+$/.test(e)}const E={slug:"bendr-2",receiptId:"receipt_bendr_lookup"},Z={prototypeLabel:"Internal Prototype",audience:"Built first for agent builders, agent teams, and marketplaces that need a fast trust read."},I={title:"Inspect proof",eyebrow:"PROOF LAYER",body:"Open the proof when a card needs verification. Each signal keeps its own visibility, source, assurance level, and transfer rule."},P={fragmentType:{endpoint:"Endpoint fragments describe routes, protocols, manifests, and access surfaces an agent may expose.",attestation:"Attestation fragments describe claims or checks from an owner, platform, issuer, or verifier.",receipt:"Receipt fragments describe access or payment evidence without making that evidence trust by itself.",standard_ref:"Standard reference fragments connect the profile to external standards without implying every adapter is live.",verification_result:"Verification result fragments record review outcomes, risk context, or disputed checks.",custody_record:"Custody record fragments describe owner or controller epochs without transferring private authority.",risk_summary:"Risk summary fragments carry imported Cred or safety context without collapsing identity into a single score.",social:"Social fragments connect public handles to an agent profile through a named source or verification path."},visibility:{public:"Visible to anyone and safe for profile cards, indexers, and partner systems.",gated:"Released only after token, payment, relationship, or allowlist policy is satisfied.",private:"Visible only to approved owners, operators, or internal systems with a clear need.",hidden:"Not discoverable through public or gated surfaces, reserved for safety or integrity review."},status:{verified:"Checked by a platform, issuer, contract read, or other explicit verification path.",pending:"Submitted or referenced, but still waiting for review or a stronger proof source.",stale:"Previously useful, but old enough that builders should request a fresh check.",historical:"Kept as provenance or prior evidence, not treated as active authority.",disputed:"Flagged for review because the claim, source, or interpretation is contested."},assurance:{unverified:"Unverified means the fragment has no stronger source than a raw claim or placeholder.",self_attested:"Self attested means the owner or agent supplied the claim without outside verification.",platform_verified:"Platform verified means Helixa or another platform checked the fragment through a defined process.",cryptographic:"Cryptographic means the fragment is backed by a signature, hash, or comparable cryptographic proof.",issuer_attested:"Issuer attested means a named issuer supplied or signed the supporting evidence.",onchain_verified:"Onchain verified means the fragment was checked against a chain record or contract read."},transferPolicy:{reverify_on_transfer:"Reverify on transfer means a new owner must confirm the fragment before it is treated as current.",pause_on_transfer:"Pause on transfer means active authority should stop until the new owner or operator approves it.",historical_on_transfer:"Historical on transfer means provenance stays visible, but it does not grant active authority.",never_transfer:"Never transfer means the fragment is bound to the prior controller or context and must not move."}};function ue(e){const r={name:e.profile.display_name,tokenId:e.profile.slug??e.profile.multipass_id,helixaId:e.profile.slug??e.profile.multipass_id,framework:"unknown",credScore:null,credTier:e.profile.cred_summary?.trust_state??"none",verified:e.card.trust_summary?.identity_status==="verified",profileUrl:null};return{eyebrow:"AGENT CARD CAROUSEL",title:"Agent cards that lead with trust.",body:"Each card gives agents, swarms, apps, and marketplaces a quick read on identity, Cred, framework, and profile route. The deeper proof sits below for verification, not first impression.",cards:(e.agentCards?.length?e.agentCards:[r]).map(t=>({name:t.name,tokenId:t.tokenId,helixaId:t.helixaId??String(t.tokenId??t.name),framework:t.framework??"unknown",credScore:t.credScore??null,credTier:t.credTier??"Unrated",credLabel:t.credScore===null||t.credScore===void 0?"Cred pending":`Cred ${t.credScore}`,verified:!!t.verified,verifiedLabel:t.verified?"verified":"unverified",profileUrl:t.profileUrl??null,subjectLabel:t.subjectType??"agent",memberLabel:we(t.members),role:t.role??"Agent Multipass",custody:t.custody??"Owner verified",detailMode:t.subjectType==="swarm"?"swarm":"agent",roster:Array.isArray(t.roster)?t.roster.map(s=>({name:s.name,role:s.role??"Member agent"})):[],sharedControls:ge(t.sharedControls),aggregateCred:t.aggregateCred??null,transferBehavior:t.transferBehavior??null,ownerSnapshot:he(t),changeReviewLedger:_e(t),transferPreview:ye(t.transferPreview,t),proofFragmentIds:Array.isArray(t.proofFragmentIds)?t.proofFragmentIds:[]}))}}function pe(e,r=null){const i=q(e.fragments,r);return{title:I.title,eyebrow:I.eyebrow,body:I.body,cards:i.map(fe),legends:P,emptyPrivateNote:"Private and hidden fragments are not rendered in this public prototype."}}function fe(e){const r=R(e.fragment_type),i=e.endpoint_ref?.protocol?`${e.endpoint_ref.protocol} `:"",t=e.source?.source_type?R(e.source.source_type):"Unknown source",s=e.source?.issuer?` by ${e.source.issuer}`:"";return{id:e.fragment_id,title:xe(e),type:e.fragment_type,typeLabel:r,status:e.status,statusExplanation:P.status[e.status]??"Status explanation unavailable.",assurance:e.assurance_level,assuranceLabel:R(e.assurance_level),assuranceExplanation:P.assurance[e.assurance_level]??"Assurance explanation unavailable.",visibility:e.visibility,visibilityExplanation:P.visibility[e.visibility]??"Visibility explanation unavailable.",transferPolicy:e.transfer_policy,transferPolicyLabel:R(e.transfer_policy),transferPolicyExplanation:P.transferPolicy[e.transfer_policy]??"Transfer policy explanation unavailable.",summary:e.endpoint_ref?`${r} for ${i}endpoint from ${t}${s}.`:`${r} from ${t}${s}.`,publicValue:e.public_value??"No public value returned."}}function _e(e){const r=me(e.changeReviewLedger);return r.length===0?null:{title:"Change + Review Ledger",eyebrow:"RECENT CHANGES / REVIEW QUEUE",rows:r,note:"Readable state only. Multipass shows change history, source, impact, and review state without executing approvals or transferring authority."}}function me(e){return Array.isArray(e)?e.filter(r=>r&&typeof r=="object").map(r=>({event:r.event??"Change recorded",source:r.source??"Source not published",impact:r.impact??"Impact not published",reviewState:r.reviewState??r.state??"Review state not published",tone:ve(r.reviewState??r.state)})):[]}function ve(e){const r=String(e??"").toLowerCase();return r.includes("verified")?"verified":r.includes("required")||r.includes("reverify")?"review":r.includes("paused")?"paused":(r.includes("no public action"),"neutral")}function he(e){const r=e.ownerSnapshot??{};return{title:"Owner & Custody Snapshot",owner:r.owner??"Owner not published",operator:r.operator??(e.subjectType==="swarm"?"Operator not published":"Agent operator not published"),custodyEpoch:r.custodyEpoch??e.custody??"Custody epoch pending",permissionState:r.permissionState??"Permission state not published",visibility:r.visibility??"Public profile only",recentChange:r.recentChange??"No recent public change",reviewAction:r.reviewAction??"No public review action",note:r.note??"State reference only. Multipass shows ownership, custody, visibility, and review context without executing approvals or transferring authority."}}function ye(e,r){return e?{title:"Transfer State Preview",currentOwner:e.currentOwner??"Owner pending",custodyEpoch:e.custodyEpoch??r.custody??"Custody epoch pending",claimAction:be(e.claimAction),permissionsState:e.permissionsState??"Permissions paused",toolAction:e.toolAction??"Reverify tools",privateAccessAction:e.privateAccessAction??"Rotate private access",historyState:e.historyState??"History preserved",credContinuity:e.credContinuity??"Cred continues with ownership-change context.",note:e.note??"Transfer preview preserves public history but does not transfer secrets, private credentials, or active authority."}:null}function ge(e){if(!Array.isArray(e))return[];const r={"Tool approvals":"Tool approval policy","Route policy":"Route policy reference","Owner approval":"Owner approval required"};return e.map(i=>r[i]??i)}function be(e){return!e||e==="Claim swarm"||e==="Claim agent"?"New owner claim required":e}function we(e){return e==null?"1 agent":`${e} ${Number(e)===1?"agent":"agents"}`}function xe(e){const r={frag_bendr_profile:"Bendr profile check",frag_bendr_endpoint:"Bendr API route",frag_bendr_standard_ref:"Standards reference",frag_bendr_receipt_history:"Receipt history",frag_bendr_route_dispute:"Route review flag",frag_bendr_helixa_identity:"Helixa AgentDNA identity",frag_bendr_cred_score:"Cred score import",frag_bendr_social_x:"Social handle check",frag_quigbot_identity:"Quigbot identity",frag_quigbot_cred:"Quigbot Cred context",frag_e2etest_identity:"E2ETest test identity",frag_e2etest_cred:"Lower trust context",frag_helixa_swarm_roster:"Swarm roster",frag_helixa_swarm_tools:"Shared tool policy",frag_helixa_swarm_cred:"Aggregate Cred context"};return r[e.fragment_id]?r[e.fragment_id]:R(e.fragment_type)}function R(e){const r=String(e??"unknown").split("_").filter(Boolean);return r.length===0?"Unknown":[r[0].charAt(0).toUpperCase()+r[0].slice(1),...r.slice(1)].join(" ")}const $={eyebrow:"MULTIPASS RECORD",headline:"The identity layer for agents, swarms, and the apps that need to read them.",body:"Multipass gives every agent a compact card and a machine-readable trust profile: identity, Cred, routes, standards, and receipts in one portable proof layer.",note:"Hidden prototype using Bendr 2.0 public fixture data."};function $e(){return[{title:"What is Multipass?",body:"Multipass is a portable identity and trust profile for agents, swarms, apps, and marketplaces that need to decide who they are dealing with."},{title:"What the card shows",body:"The card gives the fast read: name, Helixa ID, Cred context, verified status, framework, and profile route."},{title:"What proof adds",body:"Proof records explain where the card comes from without making raw protocol details the first thing people see."}]}function Se(e){return`${e.display_name} is a ${e.subject_type} profile with status ${e.status} and trust state ${e.cred_summary?.trust_state??"none"}.`}function Ce(e){return U(e.fragments),[{title:"Card first",label:"Fast read",body:"Name, Helixa ID, Cred, framework, and profile route should be understandable at a glance."},{title:"Proof below",label:"Selected proof",body:"Fragments explain why the selected card should be trusted without dumping raw protocol detail up front."},{title:"Portable by design",label:`${e.x402.endpoints.length} x402 endpoint`,body:"Apps can read the same agent profile across discovery, access, settlement, and custody flows."}]}function Ae(e,r=null){const i=q(e.fragments,r),t=Te(e.fragments,i);return[{title:"Profile",status:e.profile.status,summary:Se(e.profile),why:"The profile is the canonical summary agents, apps, and builders can resolve first.",json:m(e.profile)},{title:"Public Fragments",status:`${i.length} public`,summary:i.length?`${i.length} readable proof signals for ${r?.name??e.profile.display_name}.`:`No public fragments returned for ${r?.name??e.profile.display_name}.`,why:"Fragments show the public pieces that support the profile without exposing private records.",json:t},{title:"Agent Card",status:`${e.card.capabilities.length} capabilities`,summary:`${e.card.service_endpoints.length} service endpoint records available.`,why:"The agent card gives machines a compact view of capabilities, routes, endpoints, and trust context.",json:m(e.card)},{title:"Standards",status:`${e.standards.standard_refs.length} refs`,summary:Re(e.standards.standard_refs),why:"Standards references show compatibility targets and adapter state without claiming every adapter is live.",json:m(e.standards)},{title:"x402",status:`${e.x402.endpoints.length} endpoints`,summary:e.x402.endpoints.map(s=>`${s.endpoint_id} accepts ${s.asset}`).join(", ")||"No endpoints returned.",why:"x402 metadata explains planned access rails and accepted assets without implying live settlement here.",json:m(e.x402)},{title:"Receipt",status:e.receipt.status,summary:`${e.receipt.receipt_id} records a ${e.receipt.response_class??"unknown"} response.`,why:"Receipt evidence records that an access event can be attached to the profile without becoming trust by itself.",json:m(e.receipt)}]}function Te(e,r){const i={fragments:m(r)};for(const t of["multipass_id","profile_id","subject_id","schema_version"])e[t]!==void 0&&(i[t]=e[t]);return i}function m(e){if(Array.isArray(e))return e.map(r=>m(r)).filter(r=>r!==void 0);if(!e||typeof e!="object")return e;if(e.visibility!=="private")return Object.fromEntries(Object.entries(e).filter(([r])=>!Pe(r)).map(([r,i])=>[r,m(i)]).filter(([,r])=>r!==void 0))}function Pe(e){const r=e.toLowerCase();return r.startsWith("private")||r.includes("_private")}function q(e,r){const i=U(e),t=r?.proofFragmentIds;if(!Array.isArray(t)||t.length===0)return i;const s=new Map(i.map(n=>[n.fragment_id,n]));return t.map(n=>s.get(n)).filter(Boolean)}function U(e){return(e.fragments??[]).filter(r=>r.visibility==="public")}function Re(e){return e.map(r=>`${r.standard_id}: ${r.status}`).join(", ")||"No standard refs returned."}function Ie({root:e,loadDemo:r=Ee,loadLiveDemo:i=ie}){if(!e)throw new Error("createApp requires a root element");let t={expandedCard:null,selectedAgentCard:0,resolverInput:"",resolverStatus:null,resolverError:null,resolverRequestId:0,resolverInFlightInput:null,retryUntil:0,retryMessage:null};async function s(){Le(e);try{const p=await r();t={...t,data:p,staticData:p},y(e,t,c);const f=ke();f!==null&&n(f)}catch(p){He(e,p)}}async function n(p){const f=String(p??"").trim();t={...t,resolverInput:p,resolverStatus:"loading",resolverError:null,retryMessage:null,resolverInFlightInput:f,resolverRequestId:t.resolverRequestId+1};const u=t.resolverRequestId;y(e,t,c);try{const l=await i(f);if(u!==t.resolverRequestId)return;t={...t,data:l,resolverStatus:"loaded",resolverError:null,retryUntil:0,retryMessage:null,selectedAgentCard:0,expandedCard:null,resolverInFlightInput:null},y(e,t,c)}catch(l){if(u!==t.resolverRequestId)return;const v=De(l);t={...t,resolverStatus:"error",resolverError:Ze(l),resolverInFlightInput:null,retryUntil:v.retryUntil,retryMessage:v.retryMessage},y(e,t,c)}}function o(){t={...t,data:t.staticData,selectedAgentCard:0,expandedCard:null,resolverInput:"",resolverStatus:null,resolverError:null,resolverInFlightInput:null,resolverRequestId:t.resolverRequestId+1,retryUntil:0,retryMessage:null},y(e,t,c)}const c={resolveLiveAgent:n,resetStaticDemo:o};return{start:s}}function ke(){if(typeof window>"u")return null;const e=new URL(window.location.href);return e.searchParams.has("agent")?e.searchParams.get("agent")??"":null}function Ee(){const e=new URL(window.location.href);return Y(e)?X():K({apiBase:J(e),subject:E})}function Le(e){e.innerHTML=`
    <section class="record-shell loading-shell">
      <p class="eyebrow">${$.eyebrow}</p>
      <h1>Loading Bendr 2.0...</h1>
    </section>
  `}function He(e,r){e.innerHTML=`
    <section class="record-shell error-shell">
      <p class="eyebrow">${$.eyebrow}</p>
      <h1>Could not load Multipass API data.</h1>
      <p>Run <code>pnpm api:bendr</code> in the Multipass repo, then reload this page.</p>
      <pre class="json-panel">${a(r.message)}</pre>
    </section>
  `}function y(e,r,i={}){const{data:t}=r,s=Ce(t),n=$e(),o=ue(t),c=o.cards[r.selectedAgentCard]??o.cards[0],p=pe(t,c),f=Ae(t,c);e.innerHTML=`
    <div class="record-shell">
      <header class="record-header">
        <div class="brand"><div class="mark" aria-hidden="true"></div><span>Multipass</span></div>
        <div class="header-meta"><span>Hidden Prototype</span><span>${a(t.modeLabel??"Local API Demo")}</span></div>
      </header>

      <section class="hero-record">
        <div>
          <p class="eyebrow">${$.eyebrow}</p>
          <div class="prototype-ribbon">
            <span>${a(Z.prototypeLabel)}</span>
            <span>${a(Z.audience)}</span>
          </div>
          <h1>${$.headline}</h1>
          <p class="lead">${$.body}</p>
          <div class="note">${a(t.heroNote??$.note)}</div>
        </div>

        <article class="record-sheet">
          <div class="sheet-top">
            <div>
              <h2>${a(t.profile.display_name)}</h2>
              <p>Agent profile with public identity fragments, standards references, x402 route metadata, and receipt evidence.</p>
            </div>
            <div class="stamp">Public proof only</div>
          </div>
          <div class="field-grid">
            ${d("Record",t.profile.multipass_id??E.slug)}
            ${d("Subject",t.profile.subject_type)}
            ${d("Slug",t.profile.slug??E.slug)}
            ${d("Status",t.profile.status,"status")}
            ${d("Trust State",t.profile.cred_summary?.trust_state??"none")}
            ${d("Source",t.sourceLabel??"local API")}
            ${d("Receipt",t.receipt.receipt_id)}
          </div>
        </article>
      </section>

      ${Ne(r)}

      ${Oe(o,c,r.selectedAgentCard)}

      <section class="story-records">${s.map(Ve).join("")}</section>

      <section class="clarity-grid">${n.map(Ge).join("")}</section>

      ${Qe(p)}

      <section class="proof-ledger">
        <div class="ledger-title"><h2>Proof ledger</h2><span>Expandable API records</span></div>
        ${f.map((u,l)=>We(u,l,r.expandedCard)).join("")}
      </section>

      <footer class="footer-note">This is a static public demo. It does not include auth, persistence, contract reads, or payment settlement.</footer>
    </div>
  `,e.querySelectorAll('[data-action="select-agent-card"]').forEach(u=>{u.addEventListener("click",()=>{r.selectedAgentCard=Number(u.dataset.index),y(e,r,i),e.querySelector(`[data-action="select-agent-card"][data-index="${r.selectedAgentCard}"]`)?.focus()})}),e.querySelectorAll('[data-action="toggle-json"]').forEach(u=>{u.addEventListener("click",()=>{const l=Number(u.dataset.index);r.expandedCard=r.expandedCard===l?null:l,y(e,r,i),e.querySelector(`[data-action="toggle-json"][data-index="${l}"]`)?.focus()})}),e.querySelector('[data-action="resolve-live-agent"]')?.addEventListener("submit",u=>{u.preventDefault();const v=u.currentTarget.querySelector('input[name="agent"]')?.value??"";F(r)||r.resolverStatus==="loading"&&v.trim()===r.resolverInFlightInput||i.resolveLiveAgent?.(v)}),e.querySelector('[data-action="reset-static-demo"]')?.addEventListener("click",()=>i.resetStaticDemo?.())}function Ne(e){return`
    <section class="live-resolver" aria-label="Resolve live Helixa agent">
      <form data-action="resolve-live-agent">
        <div>
          <p class="card-label">Resolve live Helixa agent</p>
          <h2>Read a live AgentDNA record.</h2>
          <p>Try <code>1</code> or <code>8453:1</code>. Name and slug search is coming later.</p>
        </div>
        <label>
          <span>Helixa ID</span>
          <input name="agent" value="${Ye(e.resolverInput??"")}" placeholder="1 or 8453:1" autocomplete="off" />
        </label>
        <button type="submit" ${F(e)?"disabled":""}>${e.resolverStatus==="loading"?"Resolving...":"Resolve"}</button>
        <button type="button" data-action="reset-static-demo">Static demo</button>
      </form>
      ${e.resolverError?`<p class="resolver-message error">${a(e.resolverError)}</p>`:""}
      ${e.retryMessage?`<p class="resolver-message error">${a(e.retryMessage)}</p>`:""}
      ${e.resolverStatus==="loaded"?'<p class="resolver-message">Live Helixa API data loaded. Display only, no approvals or authority changes.</p>':""}
    </section>
  `}function F(e){return e.retryUntil>Date.now()}function Ze(e){return e instanceof _?e.message:"Could not reach the Helixa API. Static demo is still available."}function De(e,r=Date.now()){if(!(e instanceof _)||e.code!=="rate_limited")return{retryUntil:0,retryMessage:null};const i=Number(e.details?.retryAfter);return!Number.isFinite(i)||i<=0?{retryUntil:0,retryMessage:null}:{retryUntil:r+i*1e3,retryMessage:`Try again in ${i} seconds.`}}function d(e,r,i=""){const t=i?` ${i}`:"";return`
    <div class="field">
      <span>${a(e)}</span>
      <strong class="mono${t}">${a(r)}</strong>
    </div>
  `}function Oe(e,r,i){return`
    <section class="card-carousel">
      <div class="card-carousel-head">
        <p class="eyebrow">${a(e.eyebrow)}</p>
        <h2>${a(e.title)}</h2>
        <p>${a(e.body)}</p>
      </div>
      <div class="card-track" role="tablist" aria-label="Agent cards">
        ${e.cards.map((t,s)=>je(t,s,i)).join("")}
      </div>
      ${Me(r)}
      ${Ue(r.ownerSnapshot)}
      ${Fe(r.changeReviewLedger)}
      ${ze(r)}
    </section>
  `}function je(e,r,i){const t=r===i;return`
    <button class="card-button${t?" selected":""}" data-action="select-agent-card" data-index="${r}" type="button" aria-selected="${t}">
      <span class="card-name">${a(e.name)}</span>
      <span>${a(e.helixaId)}</span>
      <span>${a(e.subjectLabel)} · ${a(e.memberLabel)}</span>
      <span>${a(e.role)}</span>
      <span>${a(e.custody)}</span>
      <strong>${a(e.credLabel)}</strong>
    </button>
  `}function Me(e){return e.detailMode==="swarm"?qe(e):`
    <article class="card-detail">
      <div>
        <p class="card-label">Selected agent card</p>
        <h3>${a(e.name)}</h3>
        <p>Machine-readable identity card for routing, trust checks, roster context, and profile discovery.</p>
      </div>
      <div class="card-fields">
        ${d("Helixa ID",e.helixaId)}
        ${d("Framework",e.framework)}
        ${d("Cred",e.credScore===null?e.credLabel:`${e.credLabel} (${e.credTier})`)}
        ${d("Identity",e.verifiedLabel)}
        ${d("Subject",e.subjectLabel)}
        ${d("Roster",e.memberLabel)}
        ${d("Role",e.role)}
        ${d("Custody",e.custody)}
        ${d("Profile",e.profileUrl??"Not linked")}
      </div>
    </article>
  `}function qe(e){return`
    <article class="card-detail swarm-detail">
      <div>
        <p class="card-label">Swarm detail</p>
        <h3>${a(e.name)}</h3>
        <p>Parent Multipass for a collection of agents with shared routes, custody context, and proof that still preserves each member profile.</p>
      </div>
      <div class="swarm-panels">
        <section class="swarm-panel">
          <h4>Roster</h4>
          ${e.roster.map(r=>`
            <div class="swarm-row">
              <strong>${a(r.name)}</strong>
              <span>${a(r.role)}</span>
            </div>
          `).join("")}
        </section>
        <section class="swarm-panel">
          <h4>Policy references</h4>
          ${e.sharedControls.map(r=>`<span class="control-chip">${a(r)}</span>`).join("")}
        </section>
        <section class="swarm-panel wide">
          <h4>Aggregate Cred</h4>
          <p>${a(e.aggregateCred??`${e.credLabel} (${e.credTier}) gives context only; member scores remain separate.`)}</p>
        </section>
        <section class="swarm-panel wide">
          <h4>Transfer behavior</h4>
          <p>${a(e.transferBehavior??"Permissions pause and active routes reverify when custody changes.")}</p>
        </section>
        <section class="swarm-panel wide">
          <h4>Summary</h4>
          <div class="card-fields swarm-fields">
            ${d("Helixa ID",e.helixaId)}
            ${d("Roster",e.memberLabel)}
            ${d("Role",e.role)}
            ${d("Custody",e.custody)}
          </div>
        </section>
      </div>
    </article>
  `}function Ue(e){return e?`
    <section class="owner-snapshot">
      <div class="owner-snapshot-copy">
        <p class="card-label">${a(e.title)}</p>
        <h3>${a(e.permissionState)}</h3>
        <p>${a(e.note)}</p>
      </div>
      <div class="owner-snapshot-grid">
        ${w("Owner",e.owner)}
        ${w("Operator",e.operator)}
        ${w("Custody epoch",e.custodyEpoch)}
        ${w("Visibility",e.visibility)}
        ${w("Recent change",e.recentChange)}
        ${w("Review action",e.reviewAction)}
      </div>
    </section>
  `:""}function w(e,r){return`
    <article class="owner-snapshot-field">
      <span>${a(e)}</span>
      <strong>${a(r)}</strong>
    </article>
  `}function Fe(e){return e?`
    <section class="change-review-ledger">
      <div class="change-review-head">
        <p class="card-label">${a(e.eyebrow)}</p>
        <h3>${a(e.title)}</h3>
        <p>${a(e.note)}</p>
      </div>
      <div class="change-review-rows">
        ${e.rows.map(Be).join("")}
      </div>
    </section>
  `:""}function Be(e){return`
    <article class="change-review-row tone-${a(e.tone)}">
      <div>
        <span>Change</span>
        <strong>${a(e.event)}</strong>
      </div>
      <div>
        <span>Source</span>
        <strong>${a(e.source)}</strong>
      </div>
      <div>
        <span>Impact</span>
        <strong>${a(e.impact)}</strong>
      </div>
      <div>
        <span>Review</span>
        <strong>${a(e.reviewState)}</strong>
      </div>
    </article>
  `}function ze(e){if(!e.transferPreview)return"";const r=e.transferPreview;return`
    <section class="transfer-preview">
      <div class="transfer-copy">
        <p class="card-label">${a(r.title)}</p>
        <h3>${a(r.claimAction)}</h3>
        <p>${a(r.note)}</p>
      </div>
      <div class="transfer-steps">
        ${h("Current owner",r.currentOwner)}
        ${h("Custody epoch",r.custodyEpoch)}
        ${h("Permissions",r.permissionsState)}
        ${h("Tools",r.toolAction)}
        ${h("Private access",r.privateAccessAction)}
        ${h("History",r.historyState)}
        ${h("Cred",r.credContinuity)}
      </div>
    </section>
  `}function h(e,r){return`
    <article class="transfer-step">
      <span>${a(e)}</span>
      <strong>${a(r)}</strong>
    </article>
  `}function Ve(e,r){return`
    <article class="story">
      <span class="story-num">${String(r+1).padStart(2,"0")}</span>
      <p class="card-label">${a(e.label)}</p>
      <h3>${a(e.title)}</h3>
      <p>${a(e.body)}</p>
    </article>
  `}function Ge(e){return`
    <article class="clarity-card">
      <h3>${a(e.title)}</h3>
      <p>${a(e.body)}</p>
    </article>
  `}function Qe(e){return`
    <section class="fragment-map">
      <div class="fragment-map-head">
        <p class="eyebrow">${a(e.eyebrow)}</p>
        <h2>${a(e.title)}</h2>
        <p>${a(e.body)}</p>
      </div>
      <div class="fragment-cards">
        ${e.cards.map(Je).join("")}
      </div>
      <details class="fragment-legend">
        <summary>Proof vocabulary</summary>
        ${A("Fragment type legend",e.legends.fragmentType)}
        ${A("Status legend",e.legends.status)}
        ${A("Visibility legend",e.legends.visibility)}
        ${A("Assurance legend",e.legends.assurance)}
        ${A("Transfer policy",e.legends.transferPolicy)}
      </details>
      <p class="fragment-note">${a(e.emptyPrivateNote)}</p>
    </section>
  `}function Je(e){return`
    <article class="fragment-card">
      <div class="fragment-card-top">
        <span class="fragment-type">${a(e.typeLabel)}</span>
        <span class="fragment-status status-${a(e.status)}">${a(e.status)}</span>
      </div>
      <h3>${a(e.title)}</h3>
      <p>${a(e.summary)}</p>
      <dl>
        <div><dt>Assurance</dt><dd>${a(e.assuranceLabel)}</dd></div>
        <div><dt>Visibility</dt><dd>${a(e.visibility)}</dd></div>
        <div><dt>Transfer</dt><dd>${a(e.transferPolicyLabel)}</dd></div>
      </dl>
      <p class="fragment-value">${a(e.publicValue)}</p>
    </article>
  `}function A(e,r){return`
    <article>
      <h3>${a(e)}</h3>
      ${Object.entries(r).map(([i,t])=>`
        <div class="legend-row">
          <strong>${a(i)}</strong>
          <span>${a(t)}</span>
        </div>
      `).join("")}
    </article>
  `}function We(e,r,i){const t=i===r;return`
    <article class="ledger-entry">
      <div class="ledger-row">
        <div class="doc">${a(e.title)}</div>
        <div class="badge ${Ke(e)}">${a(e.status)}</div>
        <div class="summary">
          <span>${a(e.summary)}</span>
          <span class="why">${a(e.why)}</span>
        </div>
        <button data-action="toggle-json" data-index="${r}" aria-expanded="${t}" aria-controls="proof-json-${r}">${t?"Hide JSON":"Show JSON"}</button>
      </div>
      ${t?`<pre id="proof-json-${r}" class="json-panel">${a(JSON.stringify(e.json,null,2))}</pre>`:""}
    </article>
  `}function Ke(e){return["settled","passed","filtered"].includes(String(e.status).toLowerCase())?"verified":"neutral"}function Ye(e){return a(e)}function a(e){return String(e).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;")}Ie({root:document.querySelector("#app")}).start();
