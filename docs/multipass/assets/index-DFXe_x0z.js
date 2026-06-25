(function(){const r=document.createElement("link").relList;if(r&&r.supports&&r.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))t(n);new MutationObserver(n=>{for(const s of n)if(s.type==="childList")for(const o of s.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&t(o)}).observe(document,{childList:!0,subtree:!0});function i(n){const s={};return n.integrity&&(s.integrity=n.integrity),n.referrerPolicy&&(s.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?s.credentials="include":n.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function t(n){if(n.ep)return;n.ep=!0;const s=i(n);fetch(n.href,s)}})();const de={modeLabel:"Static Demo",sourceLabel:"bundled fixture",profile:{schema_version:"0.1.0",multipass_id:"mp_bendr_2",subject_type:"agent",display_name:"Bendr 2.0",slug:"bendr-2",status:"link_ready",owner_summary:{owner_state:"unclaimed",verification_status:"none",visibility:"public",summary:"Demo ownership state for public static preview."},custody_epoch:null,public_fragments:[{fragment_id:"frag_bendr_profile",fragment_type:"attestation",status:"verified",assurance_level:"platform_verified",visibility:"public",updated_at:"2026-06-24T00:00:00Z"},{fragment_id:"frag_bendr_endpoint",fragment_type:"endpoint",status:"pending",assurance_level:"self_attested",visibility:"public",updated_at:"2026-06-24T00:00:00Z"},{fragment_id:"frag_bendr_standard_ref",fragment_type:"standard_ref",status:"stale",assurance_level:"issuer_attested",visibility:"public",updated_at:"2026-06-24T00:00:00Z"},{fragment_id:"frag_bendr_receipt_history",fragment_type:"receipt",status:"historical",assurance_level:"issuer_attested",visibility:"public",updated_at:"2026-06-24T00:00:00Z"},{fragment_id:"frag_bendr_route_dispute",fragment_type:"verification_result",status:"disputed",assurance_level:"unverified",visibility:"public",updated_at:"2026-06-24T00:00:00Z"},{fragment_id:"frag_bendr_helixa_identity",fragment_type:"attestation",status:"verified",assurance_level:"onchain_verified",visibility:"public",updated_at:"2026-06-24T22:49:52Z"},{fragment_id:"frag_bendr_cred_score",fragment_type:"risk_summary",status:"verified",assurance_level:"platform_verified",visibility:"public",updated_at:"2026-06-24T22:49:52Z"},{fragment_id:"frag_bendr_social_x",fragment_type:"social",status:"verified",assurance_level:"platform_verified",visibility:"public",updated_at:"2026-06-24T22:49:52Z"}],cred_summary:{trust_state:"established",attestation_count:4,receipt_count:1,last_updated_at:"2026-06-24T22:49:52Z",public_note:"Cred score 80 imported from Helixa API. Cred is a signal, not something bought or raised by payment."},discovery_profile:{summary:"Bendr 2.0 is the Helixa lead agent with AgentDNA token #1, imported Cred context, public routes, and machine-readable Multipass records.",tags:["bendr","helixa","multipass"],avatar_url:null,visibility:"public"},standards_profile:{standards_profile_id:"sp_bendr_2",supported_standard_ids:["ERC-8004","ERC-8217","ERC-8126","ERC-8257","ERC-8183"],last_verified_at:null},payment_profile:{accepted_assets:[{asset:"CRED",chain_id:8453}],x402_manifest_url:"/multipass/static/x402-manifest.json",paid_endpoints_enabled:!1},updated_at:"2026-06-24T22:49:52Z"},fragments:{subject_id:"bendr-2",fragments:[{schema_version:"0.1.0",fragment_id:"frag_bendr_profile",multipass_id:"mp_bendr_2",fragment_type:"attestation",status:"verified",assurance_level:"platform_verified",visibility:"public",transfer_policy:"historical_on_transfer",source:{source_type:"platform_check",source_id:"bendr_profile",issuer:"Helixa",observed_at:"2026-06-24T00:00:00Z",reference_url:null},public_value:"Bendr 2.0 profile claim checked by the Helixa fixture.",proof_reference:"fixture:profile-check",created_at:"2026-06-24T00:00:00Z",updated_at:"2026-06-24T00:00:00Z",verified_at:"2026-06-24T00:00:00Z"},{schema_version:"0.1.0",fragment_id:"frag_bendr_endpoint",multipass_id:"mp_bendr_2",fragment_type:"endpoint",status:"pending",assurance_level:"self_attested",visibility:"public",transfer_policy:"reverify_on_transfer",source:{source_type:"owner_submission",source_id:"bendr_endpoint",issuer:null,observed_at:"2026-06-24T00:00:00Z",reference_url:null},public_value:"Bendr local API endpoint awaiting live verification.",proof_reference:null,created_at:"2026-06-24T00:00:00Z",updated_at:"2026-06-24T00:00:00Z",endpoint_ref:{endpoint_id:"lookup",url:"/multipass/",protocol:"api",manifest_url:"/multipass/static/x402-manifest.json"}},{schema_version:"0.1.0",fragment_id:"frag_bendr_standard_ref",multipass_id:"mp_bendr_2",fragment_type:"standard_ref",status:"stale",assurance_level:"issuer_attested",visibility:"public",transfer_policy:"pause_on_transfer",source:{source_type:"issuer_attestation",source_id:"bendr_standard",issuer:"Helixa",observed_at:"2026-06-24T00:00:00Z",reference_url:null},public_value:"ERC-8004 adapter reference that needs a fresh check before stronger claims.",proof_reference:"fixture:standard-ref",created_at:"2026-06-24T00:00:00Z",updated_at:"2026-06-24T00:00:00Z",verified_at:"2026-06-24T00:00:00Z",expires_at:"2026-06-25T00:00:00Z"},{schema_version:"0.1.0",fragment_id:"frag_bendr_receipt_history",multipass_id:"mp_bendr_2",fragment_type:"receipt",status:"historical",assurance_level:"issuer_attested",visibility:"public",transfer_policy:"historical_on_transfer",source:{source_type:"payment_receipt",source_id:"bendr_receipt",issuer:"Helixa",observed_at:"2026-06-24T00:00:00Z",reference_url:null},public_value:"Receipt evidence retained as history; it does not create trust by itself.",proof_reference:"receipt_bendr_lookup",created_at:"2026-06-24T00:00:00Z",updated_at:"2026-06-24T00:00:00Z"},{schema_version:"0.1.0",fragment_id:"frag_bendr_route_dispute",multipass_id:"mp_bendr_2",fragment_type:"verification_result",status:"disputed",assurance_level:"unverified",visibility:"public",transfer_policy:"never_transfer",source:{source_type:"platform_check",source_id:"bendr_route_dispute",issuer:"Helixa",observed_at:"2026-06-24T00:00:00Z",reference_url:null},public_value:"Route claim intentionally marked disputed in the fixture.",proof_reference:"fixture:route-dispute",created_at:"2026-06-24T00:00:00Z",updated_at:"2026-06-24T00:00:00Z",verification_ref:{verification_type:"route_review",result:"inconclusive",issuer:"Helixa",risk_level:"medium",score:null}},{schema_version:"0.1.0",fragment_id:"frag_bendr_helixa_identity",multipass_id:"mp_bendr_2",fragment_type:"attestation",status:"verified",assurance_level:"onchain_verified",visibility:"public",transfer_policy:"historical_on_transfer",source:{source_type:"contract_read",source_id:"helixa_agentdna_1",issuer:"Helixa",observed_at:"2026-06-24T22:49:52Z",reference_url:"https://api.helixa.xyz/api/v2/agent/1"},public_value:"Helixa AgentDNA token #1 on Base, contract 0x2e3B541C59D38b84E3Bc54e977200230A204Fe60.",proof_reference:"base:8453:0x2e3B541C59D38b84E3Bc54e977200230A204Fe60:1",created_at:"2026-06-24T22:49:52Z",updated_at:"2026-06-24T22:49:52Z",verified_at:"2026-06-24T22:49:52Z"},{schema_version:"0.1.0",fragment_id:"frag_bendr_cred_score",multipass_id:"mp_bendr_2",fragment_type:"risk_summary",status:"verified",assurance_level:"platform_verified",visibility:"public",transfer_policy:"reverify_on_transfer",source:{source_type:"registry_import",source_id:"helixa_cred_score_1",issuer:"Helixa",observed_at:"2026-06-24T22:49:52Z",reference_url:"https://api.helixa.xyz/api/v2/agent/1"},public_value:"Cred score 80, Preferred tier, imported from Helixa API.",proof_reference:"helixa-api:agent:1:credScore",created_at:"2026-06-24T22:49:52Z",updated_at:"2026-06-24T22:49:52Z",verified_at:"2026-06-24T22:49:52Z",verification_ref:{verification_type:"cred_import",result:"passed",issuer:"Helixa",risk_level:"low",score:80}},{schema_version:"0.1.0",fragment_id:"frag_bendr_social_x",multipass_id:"mp_bendr_2",fragment_type:"social",status:"verified",assurance_level:"platform_verified",visibility:"public",transfer_policy:"reverify_on_transfer",source:{source_type:"platform_check",source_id:"bendr_x_handle",issuer:"Helixa",observed_at:"2026-06-24T22:49:52Z",reference_url:"https://api.helixa.xyz/api/v2/agent/1"},public_value:"X handle @BendrAI_eth imported from Helixa API.",proof_reference:"helixa-api:agent:1:socials.x",created_at:"2026-06-24T22:49:52Z",updated_at:"2026-06-24T22:49:52Z",verified_at:"2026-06-24T22:49:52Z"},{schema_version:"0.1.0",fragment_id:"frag_quigbot_identity",multipass_id:"mp_quigbot",fragment_type:"attestation",status:"verified",assurance_level:"platform_verified",visibility:"public",transfer_policy:"historical_on_transfer",source:{source_type:"platform_check",source_id:"quigbot_identity",issuer:"Helixa",observed_at:"2026-06-24T23:50:00Z",reference_url:"https://helixa.xyz/agent/81"},public_value:"Quigbot identity checked by the Helixa fixture.",proof_reference:"fixture:quigbot-identity",created_at:"2026-06-24T23:50:00Z",updated_at:"2026-06-24T23:50:00Z",verified_at:"2026-06-24T23:50:00Z"},{schema_version:"0.1.0",fragment_id:"frag_quigbot_cred",multipass_id:"mp_quigbot",fragment_type:"risk_summary",status:"verified",assurance_level:"platform_verified",visibility:"public",transfer_policy:"reverify_on_transfer",source:{source_type:"registry_import",source_id:"quigbot_cred",issuer:"Helixa",observed_at:"2026-06-24T23:50:00Z",reference_url:"https://helixa.xyz/agent/81"},public_value:"Quigbot Cred score 75, Prime tier.",proof_reference:"fixture:quigbot-cred",created_at:"2026-06-24T23:50:00Z",updated_at:"2026-06-24T23:50:00Z",verified_at:"2026-06-24T23:50:00Z"},{schema_version:"0.1.0",fragment_id:"frag_e2etest_identity",multipass_id:"mp_e2etest",fragment_type:"attestation",status:"pending",assurance_level:"self_attested",visibility:"public",transfer_policy:"reverify_on_transfer",source:{source_type:"owner_submission",source_id:"e2etest_identity",issuer:"Helixa",observed_at:"2026-06-24T23:50:00Z",reference_url:"https://helixa.xyz/agent/0"},public_value:"E2ETest is a low-assurance test record.",proof_reference:"fixture:e2etest-identity",created_at:"2026-06-24T23:50:00Z",updated_at:"2026-06-24T23:50:00Z"},{schema_version:"0.1.0",fragment_id:"frag_e2etest_cred",multipass_id:"mp_e2etest",fragment_type:"risk_summary",status:"disputed",assurance_level:"unverified",visibility:"public",transfer_policy:"never_transfer",source:{source_type:"platform_check",source_id:"e2etest_cred",issuer:"Helixa",observed_at:"2026-06-24T23:50:00Z",reference_url:"https://helixa.xyz/agent/0"},public_value:"Lower trust context for a test/demo agent.",proof_reference:"fixture:e2etest-cred",created_at:"2026-06-24T23:50:00Z",updated_at:"2026-06-24T23:50:00Z"},{schema_version:"0.1.0",fragment_id:"frag_helixa_swarm_roster",multipass_id:"mp_helixa_swarm",fragment_type:"custody_record",status:"verified",assurance_level:"platform_verified",visibility:"public",transfer_policy:"pause_on_transfer",source:{source_type:"platform_check",source_id:"helixa_swarm_roster",issuer:"Helixa",observed_at:"2026-06-24T23:38:00Z",reference_url:"https://helixa.xyz/multipass/"},public_value:"Parent Multipass manages Bendr, Quigbot, and E2ETest demo agents as one collection roster.",proof_reference:"fixture:helixa-swarm-roster",created_at:"2026-06-24T23:38:00Z",updated_at:"2026-06-24T23:38:00Z",verified_at:"2026-06-24T23:38:00Z"},{schema_version:"0.1.0",fragment_id:"frag_helixa_swarm_tools",multipass_id:"mp_helixa_swarm",fragment_type:"endpoint",status:"pending",assurance_level:"self_attested",visibility:"public",transfer_policy:"pause_on_transfer",source:{source_type:"owner_submission",source_id:"helixa_swarm_tools",issuer:"Helixa",observed_at:"2026-06-24T23:38:00Z",reference_url:"https://helixa.xyz/multipass/"},public_value:"Shared tool policy preview for routes, permissions, and approvals across the swarm.",proof_reference:"fixture:helixa-swarm-tools",created_at:"2026-06-24T23:38:00Z",updated_at:"2026-06-24T23:38:00Z",endpoint_ref:{endpoint_id:"swarm_policy",url:"https://helixa.xyz/multipass/",protocol:"api",manifest_url:"/multipass/static/x402-manifest.json"}},{schema_version:"0.1.0",fragment_id:"frag_helixa_swarm_cred",multipass_id:"mp_helixa_swarm",fragment_type:"risk_summary",status:"verified",assurance_level:"platform_verified",visibility:"public",transfer_policy:"reverify_on_transfer",source:{source_type:"registry_import",source_id:"helixa_swarm_cred",issuer:"Helixa",observed_at:"2026-06-24T23:38:00Z",reference_url:"https://helixa.xyz/multipass/"},public_value:"Aggregate Cred context summarizes the roster without erasing each agent's individual profile.",proof_reference:"fixture:helixa-swarm-cred",created_at:"2026-06-24T23:38:00Z",updated_at:"2026-06-24T23:38:00Z",verified_at:"2026-06-24T23:38:00Z",verification_ref:{verification_type:"swarm_cred_summary",result:"passed",issuer:"Helixa",risk_level:"medium",score:78}}]},card:{schema_version:"0.1.0",multipass_id:"mp_bendr_2",name:"Bendr 2.0",subject_type:"agent",capabilities:[{capability_id:"profile_lookup",label:"Profile lookup",description:"Read public Multipass profile data from the static preview.",visibility:"public"},{capability_id:"agent_card_resolution",label:"Agent card resolution",description:"Resolve compact agent card fields for discovery and trust checks.",visibility:"public"}],message_routes:[{route_id:"web_profile",channel:"api",address:"https://helixa.xyz/agent/1",visibility:"public"},{route_id:"telegram",channel:"chat",address:"@bendr2bot",visibility:"public"}],service_endpoints:[{endpoint_id:"helixa_profile",url:"https://api.helixa.xyz/api/v2/agent/1",description:"Public Helixa AgentDNA profile for Bendr 2.0.",visibility:"public"},{endpoint_id:"multipass_preview",url:"https://helixa.xyz/multipass/",description:"Hidden Multipass prototype preview.",visibility:"public"}],x402_manifest_url:"/multipass/static/x402-manifest.json",accepted_assets:[{asset:"CRED",chain_id:8453}],trust_summary:{identity_status:"verified",assurance_level:"onchain_verified",last_updated_at:"2026-06-24T22:49:52Z"},rate_limits:{requests:60,window_seconds:60,burst:10},contact_policy:{mode:"approval_required",requires_owner_approval:!0,policy_note:"Static demo only."},standards_refs:[{standard_id:"ERC-8004",support_status:"adapter_ready",record_id:null},{standard_id:"ERC-8217",support_status:"pending",record_id:null}]},standards:{schema_version:"0.1.0",standards_profile_id:"sp_bendr_2",multipass_id:"mp_bendr_2",primary_refs:{erc8004_identity:null,controller_asset:null,x402_manifest:"mp_bendr_2:x402"},standard_refs:[{standard_id:"ERC-8004",status:"adapter_ready",chain_id:8453,contract_address:null,record_id:null,adapter_version:"0.1.0",last_verified_at:null,assurance_level:"unverified"},{standard_id:"ERC-8217",status:"pending",chain_id:8453,contract_address:null,record_id:null,adapter_version:"0.1.0",last_verified_at:null,assurance_level:"unverified"},{standard_id:"ERC-8257",status:"pending",chain_id:null,contract_address:null,record_id:null,adapter_version:"0.1.0",last_verified_at:null,assurance_level:"unverified"}],compatibility_summary:{identity_bound:!1,owner_verified:!1,risk_checked:!1,tools_verified:!1,work_attested:!1,trust_updated:!1},adapter_versions:{"ERC-8004":"0.1.0","ERC-8217":"0.1.0","ERC-8257":"0.1.0"},last_verified_at:null},x402:{schema_version:"0.1.0",multipass_id:"mp_bendr_2",endpoints:[{endpoint_id:"lookup",url:"/multipass/",method:"GET",description:"Sample CRED-gated profile lookup route for public static preview.",price:{amount:"1",decimals:18},asset:"CRED",chain_id:8453,provider:"bankr_x402_cloud",settlement_reference_policy:"provider_receipt",rate_limit:{requests:10,window_seconds:60,burst:2},visibility:"public",requires_owner_approval:!1}]},receipt:{schema_version:"0.1.0",receipt_id:"receipt_bendr_lookup",multipass_id:"mp_bendr_2",endpoint_id:"lookup",provider:"bankr_x402_cloud",amount:"1",asset:"CRED",chain_id:8453,status:"settled",created_at:"2026-06-24T00:00:00Z",response_class:"success",settlement_reference:null,redaction_note:"Sample public static receipt. No private request or response payload is included."},routes:{},agentCards:[{name:"Bendr 2.0",tokenId:1,helixaId:"8453:1",framework:"openclaw",credScore:80,credTier:"Preferred",verified:!0,profileUrl:"https://helixa.xyz/agent/1",proofFragmentIds:["frag_bendr_profile","frag_bendr_endpoint","frag_bendr_standard_ref","frag_bendr_receipt_history","frag_bendr_route_dispute","frag_bendr_helixa_identity","frag_bendr_cred_score"],ownerSnapshot:{owner:"0x3395...480E0",operator:"Bendr runtime",custodyEpoch:"Epoch 01",permissionState:"Active owner-approved routes",visibility:"Public profile, private credentials hidden",recentChange:"Cred import refreshed",reviewAction:"Review stale standards reference"},changeReviewLedger:[{event:"Cred import refreshed",source:"Helixa API",impact:"Cred context updated",reviewState:"Verified"},{event:"Standards reference stale",source:"Standards profile",impact:"Adapter claim needs a fresh check",reviewState:"Reverify"},{event:"Private credentials hidden",source:"Private vault",impact:"No public data exposed",reviewState:"No public action"}]},{name:"Quigbot",tokenId:81,helixaId:"8453:81",framework:"openclaw",credScore:75,credTier:"Prime",verified:!0,profileUrl:"https://helixa.xyz/agent/81",proofFragmentIds:["frag_quigbot_identity","frag_quigbot_cred"],ownerSnapshot:{owner:"0x17d7...bDe4",operator:"Quigbot runtime",custodyEpoch:"Epoch 01",permissionState:"Active owner-approved routes",visibility:"Public profile, private credentials hidden",recentChange:"Identity and Cred context imported",reviewAction:"No public review action"},changeReviewLedger:[{event:"Identity context imported",source:"Helixa fixture",impact:"Agent card updated",reviewState:"Verified"},{event:"Cred import refreshed",source:"Helixa API",impact:"Cred context updated",reviewState:"Verified"},{event:"Private credentials hidden",source:"Private vault",impact:"No public data exposed",reviewState:"No public action"}]},{name:"E2ETest",tokenId:0,helixaId:"8453:0",framework:"openclaw",credScore:41,credTier:"Marginal",verified:!1,profileUrl:"https://helixa.xyz/agent/0",proofFragmentIds:["frag_e2etest_identity","frag_e2etest_cred"],ownerSnapshot:{owner:"Demo owner pending",operator:"Test fixture",custodyEpoch:"Draft epoch",permissionState:"Review required before active routes",visibility:"Public test profile",recentChange:"Low-assurance test record imported",reviewAction:"Verify owner before production use"},changeReviewLedger:[{event:"Low-assurance test record imported",source:"Test fixture",impact:"Routes remain inactive",reviewState:"Review required"},{event:"Owner verification missing",source:"Owner registry",impact:"Production use blocked",reviewState:"Reverify"},{event:"Private credentials hidden",source:"Private vault",impact:"No public data exposed",reviewState:"No public action"}]},{name:"Helixa Swarm",tokenId:"swarm:helixa",helixaId:"8453:swarm:helixa",framework:"multi-agent",credScore:78,credTier:"Prime",verified:!0,profileUrl:"https://helixa.xyz/swarm/helixa",subjectType:"swarm",members:3,role:"Parent Multipass",custody:"Custody epoch ready",proofFragmentIds:["frag_helixa_swarm_roster","frag_helixa_swarm_tools","frag_helixa_swarm_cred"],roster:[{name:"Bendr 2.0",role:"Lead agent"},{name:"Quigbot",role:"Product agent"},{name:"E2ETest",role:"Test agent"}],sharedControls:["Tool approval policy","Route policy reference","Owner approval required"],aggregateCred:"Cred 78 Prime summarizes the roster without replacing individual agent scores.",transferBehavior:"Permissions pause and tool routes reverify when custody changes.",transferPreview:{currentOwner:"0x3395...480E0",custodyEpoch:"Epoch 03",claimAction:"New owner claim required",permissionsState:"Permissions paused",toolAction:"Reverify shared tools",privateAccessAction:"Rotate private access",historyState:"History preserved",credContinuity:"Cred continues with ownership-change context."},ownerSnapshot:{owner:"0x3395...480E0",operator:"Helixa ops",custodyEpoch:"Epoch 03",permissionState:"Paused until owner review",visibility:"Public profile, gated private data",recentChange:"Transfer detected 2026-06-24",reviewAction:"Reverify routes before resume"},changeReviewLedger:[{event:"Cred import refreshed",source:"Helixa API",impact:"Aggregate Cred context updated",reviewState:"Verified"},{event:"Transfer detected",source:"Owner registry",impact:"Permissions paused",reviewState:"Review required"},{event:"Shared route policy changed",source:"Policy reference",impact:"Routes paused for recheck",reviewState:"Paused"},{event:"Standards reference stale",source:"Standards profile",impact:"Adapter claim needs a fresh check",reviewState:"Reverify"},{event:"Private credentials hidden",source:"Private vault",impact:"No secrets or private credentials exposed",reviewState:"No public action"}]}]},F="/multipass-api";function ue(e){const r=J(e);return r?X(r.toString()):F}function J(e){const r=e.searchParams.get("api");if(!r)return null;try{const i=new URL(r);return["http:","https:"].includes(i.protocol)?i:null}catch{return null}}function pe(e,r){const t=`${X(e||F)}/api/multipass/${encodeURIComponent(r.slug)}`;return{profile:t,fragments:`${t}/fragments`,card:`${t}/agent-card`,standards:`${t}/standards`,x402:`${t}/x402`,receipt:`${t}/receipts/${encodeURIComponent(r.receiptId)}`}}async function S(e,r=fetch){const i=await r(e);if(!i.ok)throw new Error(`GET ${e} failed with ${i.status}`);const t=await i.text();try{return JSON.parse(t)}catch(n){throw new Error(`API returned invalid JSON for ${e}: ${n.message}`)}}async function fe({apiBase:e=F,subject:r,fetchImpl:i=fetch}){const t=pe(e,r),[n,s,o,l,d,p]=await Promise.all([S(t.profile,i),S(t.fragments,i),S(t.card,i),S(t.standards,i),S(t.x402,i),S(t.receipt,i)]);return{profile:n,fragments:s,card:o,standards:l,x402:d,receipt:p,routes:t,modeLabel:"Local API Demo",sourceLabel:"local API"}}function _e(e){const r=e.pathname;return(r==="/multipass"||r.startsWith("/multipass/"))&&!J(e)}async function me(){return structuredClone(de)}function X(e){return e.endsWith("/")?e.slice(0,-1):e}const _=8453,ve="Base (8453)",V="0x2e3B541C59D38b84E3Bc54e977200230A204Fe60",A="https://api.helixa.xyz/api/v2/agent",he="https://api.helixa.xyz/api/v2/metadata",W="https://api.helixa.xyz/api/v2/aura",ye="https://api.helixa.xyz/api/v2/agents?limit=100";class f extends Error{constructor(r,i,t={}){super(i),this.name="HelixaResolverError",this.code=r,this.details=t}}function ge(e){const r=String(e??"").trim();if(!r)throw new f("empty_input","Enter a Helixa token ID or Helixa ID.");if(/^\d+$/.test(r)){if(!G(r))throw new f("invalid_format","Use a token ID like 1 or a Helixa ID like 8453:1.");return{chainId:_,tokenId:r,canonicalId:`${_}:${r}`}}const i=r.match(/^(\d+):(\d+)$/);if(!i)throw new f("invalid_format","Use a token ID like 1 or a Helixa ID like 8453:1.");const t=Number(i[1]);if(t!==_)throw new f("unsupported_chain","V0 supports Base Helixa AgentDNA records only.",{chainId:t});const n=i[2];if(!G(n))throw new f("invalid_format","Use a token ID like 1 or a Helixa ID like 8453:1.");return{chainId:t,tokenId:n,canonicalId:`${_}:${n}`}}async function be(e,r=fetch){return await K(`${A}/${encodeURIComponent(e)}`,r,"GET Helixa agent failed")}async function we(e=fetch){const r=await K(ye,e,"GET Helixa agents failed");if(!Array.isArray(r?.agents))throw new f("invalid_json","Helixa returned a directory response this prototype cannot read yet.");return r.agents}async function K(e,r,i){let t;try{t=await r(e,{method:"GET",credentials:"omit",headers:{Accept:"application/json"}})}catch(s){throw new f("network_error","Could not reach the Helixa API. Static demo is still available.",{cause:s.message})}if(!t.ok)throw t.status===404?new f("not_found","No Helixa agent found for that ID."):t.status===429?new f("rate_limited","Helixa API is rate-limiting requests. Try again shortly.",{retryAfter:t.headers?.get?.("Retry-After")??null}):new f("http_error",`${i} with ${t.status}`,{status:t.status});const n=await t.text();try{return JSON.parse(n)}catch(s){throw new f("invalid_json","Helixa returned a response this prototype cannot read yet.",{cause:s.message})}}function $e(e){const r=String(e?.tokenId??"").trim()||"unknown",i=e?.name||`Agent #${r}`,t=`mp_helixa_agent_${r}`,n=e?.services?.web?.url??`https://helixa.xyz/agent/${encodeURIComponent(r)}`,s=e?.mintedAt??new Date().toISOString(),o=He(e,r,t,s),l=q(e?.credScore),d=Xe(e),p=Y(e),h=Me(e,r,o,n),c=Le(e,{tokenId:r,displayName:i,credTier:l,profileUrl:n}),m=`${_}:${r}`,D={name:i,tokenId:r,helixaId:m,framework:e?.framework??e?.metadata?.framework??"unknown",credScore:g(e?.credScore)?Number(e.credScore):null,credTier:l,verified:!!e?.verified,profileUrl:n,proofFragmentIds:o.map(v=>v.fragment_id),ownerSnapshot:Ne(e),changeReviewLedger:De(e),transferPreview:Ue(e)};return{modeLabel:"Live Profile",sourceLabel:"live Helixa API",heroNote:`Read-only live Helixa API data for ${i}.`,liveProfilePage:{eyebrow:"LIVE MULTIPASS",prototypeLabel:"Live AgentDNA Profile",audience:"Public trust, route, custody, and proof context for marketplaces and agent directories.",headline:`${i} Multipass`,body:`Live AgentDNA profile for ${i} with public trust, routes, custody context, and proof inspection.`,note:`Shareable live profile for ${m}.`,recordIntro:"Live AgentDNA profile assembled from public Helixa API signals. Display only; authority and private credentials stay protected.",headerMeta:`Live profile · ${m}`,sharePath:`/multipass/?agent=${encodeURIComponent(r)}`},profile:{schema_version:"0.1.0",multipass_id:t,subject_type:"agent",display_name:i,slug:`helixa-agent-${r}`,status:"live_resolved",owner_summary:{owner_state:e?.owner?"observed":"not_published",verification_status:e?.verified?"verified":"unverified",visibility:"public",summary:"Public owner state observed from the live Helixa API."},custody_epoch:null,public_fragments:o.map(({fragment_id:v,fragment_type:ne,status:se,assurance_level:oe,visibility:le,updated_at:ce})=>({fragment_id:v,fragment_type:ne,status:se,assurance_level:oe,visibility:le,updated_at:ce})),cred_summary:{trust_state:g(e?.credScore)?"established":"pending",attestation_count:o.filter(v=>v.fragment_type==="attestation").length,receipt_count:0,last_updated_at:s,public_note:g(e?.credScore)?`Cred score ${e.credScore} imported from Helixa API. Cred is an evidence signal, not a payment outcome.`:"No live Cred score published by the Helixa API."},discovery_profile:{summary:`${i} resolved from the live Helixa API as AgentDNA token #${r}.`,tags:j(["helixa","multipass",e?.framework]),avatar_url:null,visibility:"public"},standards_profile:{standards_profile_id:`sp_helixa_agent_${r}`,supported_standard_ids:p,last_verified_at:null},payment_profile:{accepted_assets:d.map(v=>({asset:v.toUpperCase(),chain_id:_})),x402_manifest_url:null,paid_endpoints_enabled:!1},updated_at:s},fragments:{subject_id:`helixa-agent-${r}`,fragments:o},card:Je(e,r,n),visualIdentity:c,marketplaceListing:h,agentCards:[D],standards:{standard_refs:p.map(v=>({standard_id:v,status:"referenced"}))},x402:{endpoints:d.map(v=>({endpoint_id:"live-profile-reference",asset:v.toUpperCase(),route:n,status:"planned"}))},receipt:{receipt_id:"No live receipt attached",status:"not_attached",response_class:null,redaction_note:"No live receipt attached to this public Helixa API record."},routes:{profile:`${A}/${encodeURIComponent(r)}`}}}async function xe(e,r=fetch){const i=String(e??"").trim(),t=await Ae(i,r),n=await be(t.tokenId,r);return{...$e(n),resolver:t}}async function Ae(e,r=fetch){try{return ge(e)}catch(n){if(!(n instanceof f)||n.code!=="invalid_format"||!Ie(e))throw n}const i=Se(await we(r),e);if(i.length===0)throw new f("not_found","No Helixa agent matched that name or handle. Try a token ID like 81.");if(i.length>1)throw new f("ambiguous_lookup","Pick a matching Helixa agent.",{matches:i});const t=i[0].tokenId;return{chainId:_,tokenId:t,canonicalId:`${_}:${t}`,lookupInput:e}}function Se(e,r){const i=B(r);if(!i)return[];const t=e.map(s=>Ce(s,i)).filter(Boolean).sort(Pe),n=t.filter(s=>s.rank===0);return(n.length?n:t).slice(0,8).map(({rank:s,...o})=>o)}function Ce(e,r){const i=String(e?.tokenId??"").trim(),t=String(e?.name??"").trim();if(!i||!t)return null;const n=ke(e),s=n.some(l=>l===r),o=!s&&n.some(l=>l.includes(r));return!s&&!o?null:{rank:s?0:1,tokenId:i,name:t,helixaId:`${_}:${i}`,framework:e?.framework??"unknown",credScore:g(e?.credScore)?Number(e.credScore):null,verified:!!e?.verified}}function ke(e){const r=[e?.name,e?.slug,e?.agentAddress];for(const i of Object.values(e?.socials??{}))r.push(i);for(const i of Object.values(e?.services??{}))r.push(i?.handle,i?.url);return r.map(B).filter(Boolean)}function Pe(e,r){if(e.rank!==r.rank)return e.rank-r.rank;if(e.verified!==r.verified)return e.verified?-1:1;const i=e.credScore??-1/0,t=r.credScore??-1/0;return i!==t?t-i:Number(e.tokenId)-Number(r.tokenId)}function Ie(e){const r=String(e??"").trim();return!r||r.length>80||/https?:\/\//i.test(r)||r.includes("/")?!1:/[a-z_@#.-]/i.test(r)}function B(e){return String(e??"").trim().toLowerCase().replace(/^@/,"").replace(/\s+/g," ")}function Le(e,{tokenId:r,displayName:i,credTier:t,profileUrl:n}){const s=String(e?.framework??"unknown").trim()||"unknown",o=g(e?.credScore)?`Cred ${e.credScore}`:"Cred pending",l=e?.verified?"Verified":"Unverified";return{source:"helixa_aura",label:"Helixa Agent Aura",imageUrl:`${W}/${encodeURIComponent(r)}.png`,initials:Te(i),tone:Ee(t),summary:"Helixa Agent Aura image for this live profile.",chips:[o,t,l,s].filter(Boolean),seed:`helixa-${r}-${B(i)}`,provenanceDrawer:Re(e,{tokenId:r,credTier:t,framework:s,profileUrl:n})}}function Re(e,{tokenId:r,credTier:i,framework:t,profileUrl:n}){const s=`${he}/${encodeURIComponent(r)}`,o=`${W}/${encodeURIComponent(r)}.png`,l=`${A}/${encodeURIComponent(r)}`,d=P(n)??`https://helixa.xyz/agent/${encodeURIComponent(r)}`,p=I(e?.owner);return{title:"Agent Aura Provenance",summary:"Public Helixa API-reported provenance for this AgentDNA visual.",facts:j([{label:"Helixa ID",value:`${_}:${r}`},{label:"AgentDNA token ID",value:String(r)},{label:"Chain",value:ve},{label:"Contract",value:V},p?{label:"Owner",value:p}:null,g(e?.credScore)?{label:"Cred",value:`Cred ${e.credScore} · ${i}`}:null,t!=="unknown"?{label:"Framework",value:L(t)}:null,{label:"Metadata source",value:s},{label:"Aura image source",value:o},{label:"API source",value:l}]),links:j([{label:"Metadata JSON",url:s},{label:"Aura image",url:o},{label:"Helixa profile",url:d},{label:"OpenSea item",url:`https://opensea.io/assets/base/${V}/${encodeURIComponent(r)}`},e?.explorer?{label:"Explorer",url:e.explorer}:null]),safetyNote:"Display only. Public provenance does not grant authority, verify private credentials, or expose secrets."}}function Te(e){const r=String(e??"").trim().split(/\s+/).filter(Boolean);return r.length?r.length===1?r[0].slice(0,2).toUpperCase():`${r[0][0]??""}${r[1][0]??""}`.toUpperCase():"MP"}function Ee(e){return String(e??"pending").toLowerCase().replace(/[^a-z0-9]+/g,"-")}function He(e,r,i,t){const n=[];n.push(R({fragment_id:`frag_live_${r}_identity`,multipass_id:i,fragment_type:"attestation",status:e?.verified?"verified":"pending",assurance_level:e?.verified?"onchain_verified":"platform_verified",transfer_policy:"historical_on_transfer",source_type:e?.explorer?"contract_read":"platform_check",observed_at:t,reference_url:e?.explorer??`https://helixa.xyz/agent/${encodeURIComponent(r)}`,public_value:`Helixa AgentDNA token #${r}${e?.mintOrigin?` minted from ${e.mintOrigin}`:""}.`})),g(e?.credScore)&&n.push(R({fragment_id:`frag_live_${r}_cred`,multipass_id:i,fragment_type:"risk_summary",status:"verified",assurance_level:"platform_verified",transfer_policy:"reverify_on_transfer",source_type:"registry_import",observed_at:t,reference_url:`${A}/${encodeURIComponent(r)}`,public_value:`Cred score ${e.credScore}, ${q(e.credScore)} tier, imported from Helixa API.`}));for(const[s,o]of Object.entries(e?.socials??{}))o&&n.push(R({fragment_id:`frag_live_${r}_social_${E(s)}`,multipass_id:i,fragment_type:"social",status:e?.verified?"verified":"pending",assurance_level:"platform_verified",transfer_policy:"reverify_on_transfer",source_type:"platform_check",observed_at:t,reference_url:`${A}/${encodeURIComponent(r)}`,public_value:`${L(s)} handle ${o} imported from Helixa API.`}));for(const[s,o]of Object.entries(e?.services??{})){const l=o?.url??o?.handle;l&&n.push(R({fragment_id:`frag_live_${r}_service_${E(s)}`,multipass_id:i,fragment_type:"endpoint",status:"pending",assurance_level:"self_attested",transfer_policy:"pause_on_transfer",source_type:"platform_check",observed_at:t,reference_url:`${A}/${encodeURIComponent(r)}`,public_value:`${L(s)} service route published by Helixa API.`,endpoint_ref:{endpoint_id:E(s),url:l,protocol:s}}))}for(const s of Y(e))n.push(R({fragment_id:`frag_live_${r}_standard_${E(s)}`,multipass_id:i,fragment_type:"standard_ref",status:"stale",assurance_level:"issuer_attested",transfer_policy:"pause_on_transfer",source_type:"issuer_attestation",observed_at:t,reference_url:`${A}/${encodeURIComponent(r)}`,public_value:`${s} appears in public Helixa traits or metadata and needs a fresh adapter check before stronger claims.`}));return n}function R({fragment_id:e,multipass_id:r,fragment_type:i,status:t,assurance_level:n,transfer_policy:s,source_type:o,observed_at:l,reference_url:d,public_value:p,endpoint_ref:h=void 0}){return{schema_version:"0.1.0",fragment_id:e,multipass_id:r,fragment_type:i,status:t,assurance_level:n,visibility:"public",transfer_policy:s,source:{source_type:o,source_id:e,issuer:"Helixa",observed_at:l,reference_url:d},public_value:p,proof_reference:d,created_at:l,updated_at:l,...t==="verified"?{verified_at:l}:{},...h?{endpoint_ref:h}:{}}}function Ne(e){return{owner:I(e?.owner)??"Owner not published",operator:I(e?.operator)??"Not delegated",custodyEpoch:"Live API observation",permissionState:"Read-only public profile",visibility:"Public profile, private credentials hidden",recentChange:"Live profile fetched",reviewAction:"Review live identity fields",note:"State reference only. Multipass shows ownership, custody, visibility, and review context without executing approvals or transferring authority."}}function De(e){const r=[{event:"Live profile fetched",source:"Helixa API",impact:"Public profile refreshed",reviewState:"Verified"},{event:"Owner observed",source:"Helixa API",impact:e?.owner?"Owner field published":"Owner not published",reviewState:e?.owner?"Verified":"Review required"},{event:"Private credentials hidden",source:"Private vault",impact:"No secrets or private credentials exposed",reviewState:"No public action"}];return g(e?.credScore)&&r.splice(1,0,{event:"Cred imported",source:"Helixa API",impact:`Cred score ${e.credScore} displayed as context`,reviewState:"Verified"}),Object.keys(e?.services??{}).length&&r.push({event:"Services reviewed",source:"Helixa API",impact:"Public routes shown as references only",reviewState:"Review required"}),r}function Ue(e){return{currentOwner:I(e?.owner)??"Owner not published",custodyEpoch:"Live API observation",claimAction:"No transfer detected",permissionsState:"Read-only public profile",toolAction:"Reverify tools before active use",privateAccessAction:"Rotate private access on custody change",historyState:"Public history preserved",credContinuity:"Cred continues with ownership-change context if custody changes.",note:"Transfer state preview preserves public history but does not transfer secrets, private credentials, or active authority."}}function Me(e,r,i,t){const n=e?.name||`Agent #${r}`,s=g(e?.credScore)?Number(e.credScore):null,o=e?.framework??e?.metadata?.framework??"unknown",l=`${_}:${r}`;return{title:`${e?.verified?"Verified":"Unverified"} agent listing for ${n}`,subtitle:`${l} · ${o}`,summary:je(e),identity:{name:n,helixaId:l,tokenId:String(r),framework:o,verifiedLabel:e?.verified?"Verified AgentDNA":"Unverified AgentDNA",sourceLabel:"Live Helixa API"},score:Oe(s),badges:Ze(e,o),facts:Fe(e,r),routes:Be(e),paymentReferences:qe(e),proof:ze(i),links:Ve(e,t),safetyNote:"Public routes and proof are visible; authority and private credentials stay protected."}}function Oe(e){const r=e===null?"Unrated":q(e);return{label:e===null?"Cred pending":`Cred ${e}`,tier:r,value:e,tone:r.toLowerCase()}}function je(e){const r=e?.metadata?.serviceCategories??[],i=e?.skills??[],t=e?.domains??[],n=[...r,...i,...t].filter(Boolean).slice(0,3);return n.length?`Live AgentDNA record packaged for marketplaces: ${n.join(", ")}.`:"Live AgentDNA record with public trust, route, and ownership context."}function Ze(e,r){return[{label:e?.verified?"Verified AgentDNA":"Unverified AgentDNA",tone:e?.verified?"verified":"review"},...e?.soulbound?[{label:"Soulbound",tone:"neutral"}]:[],...e?.metadata?.openToWork?[{label:"Open to work",tone:"verified"}]:[],{label:L(r),tone:"neutral"},{label:"Base",tone:"neutral"}]}function Fe(e,r){return[{label:"Owner",value:I(e?.owner)??"Owner not published"},{label:"Operator",value:I(e?.operator)??"Not delegated"},{label:"Token ID",value:String(r)},{label:"Generation",value:M(e?.generation,"Not published")},{label:"Version",value:M(e?.version,"Not published")},{label:"Points",value:M(e?.points,"Not published")}]}function Be(e){const r=[];for(const[i,t]of Object.entries(e?.services??{})){const n=t?.url??t?.handle;n&&r.push({label:L(i),value:String(n),url:P(n),kind:"service"})}for(const[i,t]of Object.entries(e?.socials??{}))t&&r.push({label:L(i),value:String(t),url:Ge(i,t),kind:"social"});return r}function qe(e){const r=[];for(const i of e?.metadata?.acceptedPayments??[])r.push({label:"Accepted reference",value:String(i).toUpperCase(),chainId:_,source:"Helixa metadata"});return e?.linkedToken?.symbol&&r.push({label:"Linked token",value:String(e.linkedToken.symbol).toUpperCase(),chainId:_,source:"Helixa linked token"}),Qe(r)}function ze(e){return{publicFragmentCount:e.length,verifiedSignalCount:e.filter(r=>r.status==="verified").length,reviewRequiredCount:e.filter(r=>["pending","stale"].includes(r.status)).length,privateCredentialState:"No secrets or private credentials exposed"}}function Ve(e,r){return[r?{label:"Profile",url:P(r),kind:"profile"}:null,e?.explorer?{label:"Explorer",url:P(e.explorer),kind:"explorer"}:null].filter(i=>i?.url)}function P(e){try{const r=new URL(String(e));return["https:","http:"].includes(r.protocol)?r.href:null}catch{return null}}function Ge(e,r){const i=String(r).trim();if(!i)return null;const t=P(i);if(t)return t;const n=i.replace(/^@/,""),s=String(e).toLowerCase();return s==="x"?`https://x.com/${encodeURIComponent(n)}`:s==="github"&&/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(n)?`https://github.com/${n}`:s==="telegram"?`https://t.me/${encodeURIComponent(n)}`:s==="website"?P(i):null}function Qe(e){const r=new Set;return e.filter(i=>{const t=`${i.label}:${i.value}:${i.chainId}:${i.source}`;return r.has(t)?!1:(r.add(t),!0)})}function M(e,r){return e==null||e===""?r:String(e)}function Je(e,r,i){return{schema_version:"0.1.0",agent_id:`${_}:${r}`,name:e?.name??`Agent #${r}`,capabilities:[...e?.skills??[],...e?.domains??[]].map(t=>({name:t})),service_endpoints:Object.entries(e?.services??{}).map(([t,n])=>({endpoint_id:E(t),url:n?.url??n?.handle??i,protocol:t})),trust_summary:{identity_status:e?.verified?"verified":"pending",assurance_level:e?.verified?"onchain_verified":"platform_verified",cred_score:g(e?.credScore)?Number(e.credScore):null},profile_url:i}}function q(e){const r=Number(e);return Number.isFinite(r)?r>=80?"Preferred":r>=65?"Prime":r>=50?"Qualified":r>=30?"Marginal":"Junk":"Unrated"}function g(e){return Number.isFinite(Number(e))}function I(e){const r=String(e??"");return/^0x[a-fA-F0-9]{40}$/.test(r)?`${r.slice(0,6)}...${r.slice(-4)}`:null}function Y(e){const r=[...e?.traits??[],...e?.skills??[],...e?.domains??[]].map(i=>typeof i=="string"?i:i?.name).filter(Boolean);return[...new Set(r.filter(i=>/^ERC-\d+/i.test(i)).map(i=>i.toUpperCase()))]}function Xe(e){return[...new Set([...e?.metadata?.acceptedPayments??[],e?.linkedToken?.symbol].filter(Boolean).map(r=>String(r).toLowerCase()))]}function j(e){return e.filter(Boolean)}function E(e){return String(e).toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"")||"unknown"}function L(e){const r=String(e),i={a2a:"A2A",mcp:"MCP",x:"X",github:"GitHub",usdc:"USDC",cred:"CRED"},t=r.toLowerCase();return i[t]?i[t]:r.replace(/[_-]+/g," ").replace(/\b\w/g,n=>n.toUpperCase())}function G(e){return/^\d+$/.test(e)&&!/^0+$/.test(e)}const Z={slug:"bendr-2",receiptId:"receipt_bendr_lookup"},Q={prototypeLabel:"Internal Prototype",audience:"Built first for agent builders, agent teams, and marketplaces that need a fast trust read."},O={title:"Inspect proof",eyebrow:"PROOF LAYER",body:"Open the proof when a card needs verification. Each signal keeps its own visibility, source, assurance level, and transfer rule."},H={fragmentType:{endpoint:"Endpoint fragments describe routes, protocols, manifests, and access surfaces an agent may expose.",attestation:"Attestation fragments describe claims or checks from an owner, platform, issuer, or verifier.",receipt:"Receipt fragments describe access or payment evidence without making that evidence trust by itself.",standard_ref:"Standard reference fragments connect the profile to external standards without implying every adapter is live.",verification_result:"Verification result fragments record review outcomes, risk context, or disputed checks.",custody_record:"Custody record fragments describe owner or controller epochs without transferring private authority.",risk_summary:"Risk summary fragments carry imported Cred or safety context without collapsing identity into a single score.",social:"Social fragments connect public handles to an agent profile through a named source or verification path."},visibility:{public:"Visible to anyone and safe for profile cards, indexers, and partner systems.",gated:"Released only after token, payment, relationship, or allowlist policy is satisfied.",private:"Visible only to approved owners, operators, or internal systems with a clear need.",hidden:"Not discoverable through public or gated surfaces, reserved for safety or integrity review."},status:{verified:"Checked by a platform, issuer, contract read, or other explicit verification path.",pending:"Submitted or referenced, but still waiting for review or a stronger proof source.",stale:"Previously useful, but old enough that builders should request a fresh check.",historical:"Kept as provenance or prior evidence, not treated as active authority.",disputed:"Flagged for review because the claim, source, or interpretation is contested."},assurance:{unverified:"Unverified means the fragment has no stronger source than a raw claim or placeholder.",self_attested:"Self attested means the owner or agent supplied the claim without outside verification.",platform_verified:"Platform verified means Helixa or another platform checked the fragment through a defined process.",cryptographic:"Cryptographic means the fragment is backed by a signature, hash, or comparable cryptographic proof.",issuer_attested:"Issuer attested means a named issuer supplied or signed the supporting evidence.",onchain_verified:"Onchain verified means the fragment was checked against a chain record or contract read."},transferPolicy:{reverify_on_transfer:"Reverify on transfer means a new owner must confirm the fragment before it is treated as current.",pause_on_transfer:"Pause on transfer means active authority should stop until the new owner or operator approves it.",historical_on_transfer:"Historical on transfer means provenance stays visible, but it does not grant active authority.",never_transfer:"Never transfer means the fragment is bound to the prior controller or context and must not move."}};function We(e){const r={name:e.profile.display_name,tokenId:e.profile.slug??e.profile.multipass_id,helixaId:e.profile.slug??e.profile.multipass_id,framework:"unknown",credScore:null,credTier:e.profile.cred_summary?.trust_state??"none",verified:e.card.trust_summary?.identity_status==="verified",profileUrl:null};return{eyebrow:"AGENT CARD CAROUSEL",title:"Agent cards that lead with trust.",body:"Each card gives agents, swarms, apps, and marketplaces a quick read on identity, Cred, framework, and profile route. The deeper proof sits below for verification, not first impression.",cards:(e.agentCards?.length?e.agentCards:[r]).map(t=>({name:t.name,tokenId:t.tokenId,helixaId:t.helixaId??String(t.tokenId??t.name),framework:t.framework??"unknown",credScore:t.credScore??null,credTier:t.credTier??"Unrated",credLabel:t.credScore===null||t.credScore===void 0?"Cred pending":`Cred ${t.credScore}`,verified:!!t.verified,verifiedLabel:t.verified?"verified":"unverified",profileUrl:t.profileUrl??null,subjectLabel:t.subjectType??"agent",memberLabel:or(t.members),role:t.role??"Agent Multipass",custody:t.custody??"Owner verified",detailMode:t.subjectType==="swarm"?"swarm":"agent",roster:Array.isArray(t.roster)?t.roster.map(n=>({name:n.name,role:n.role??"Member agent"})):[],sharedControls:nr(t.sharedControls),aggregateCred:t.aggregateCred??null,transferBehavior:t.transferBehavior??null,ownerSnapshot:ir(t),changeReviewLedger:er(t),transferPreview:ar(t.transferPreview,t),proofFragmentIds:Array.isArray(t.proofFragmentIds)?t.proofFragmentIds:[]}))}}function Ke(e,r=null){const i=ee(e.fragments,r);return{title:O.title,eyebrow:O.eyebrow,body:O.body,cards:i.map(Ye),legends:H,emptyPrivateNote:"Private and hidden fragments are not rendered in this public prototype."}}function Ye(e){const r=N(e.fragment_type),i=e.endpoint_ref?.protocol?`${e.endpoint_ref.protocol} `:"",t=e.source?.source_type?N(e.source.source_type):"Unknown source",n=e.source?.issuer?` by ${e.source.issuer}`:"";return{id:e.fragment_id,title:lr(e),type:e.fragment_type,typeLabel:r,status:e.status,statusExplanation:H.status[e.status]??"Status explanation unavailable.",assurance:e.assurance_level,assuranceLabel:N(e.assurance_level),assuranceExplanation:H.assurance[e.assurance_level]??"Assurance explanation unavailable.",visibility:e.visibility,visibilityExplanation:H.visibility[e.visibility]??"Visibility explanation unavailable.",transferPolicy:e.transfer_policy,transferPolicyLabel:N(e.transfer_policy),transferPolicyExplanation:H.transferPolicy[e.transfer_policy]??"Transfer policy explanation unavailable.",summary:e.endpoint_ref?`${r} for ${i}endpoint from ${t}${n}.`:`${r} from ${t}${n}.`,publicValue:e.public_value??"No public value returned."}}function er(e){const r=rr(e.changeReviewLedger);return r.length===0?null:{title:"Change + Review Ledger",eyebrow:"RECENT CHANGES / REVIEW QUEUE",rows:r,note:"Readable state only. Multipass shows change history, source, impact, and review state without executing approvals or transferring authority."}}function rr(e){return Array.isArray(e)?e.filter(r=>r&&typeof r=="object").map(r=>({event:r.event??"Change recorded",source:r.source??"Source not published",impact:r.impact??"Impact not published",reviewState:r.reviewState??r.state??"Review state not published",tone:tr(r.reviewState??r.state)})):[]}function tr(e){const r=String(e??"").toLowerCase();return r.includes("verified")?"verified":r.includes("required")||r.includes("reverify")?"review":r.includes("paused")?"paused":(r.includes("no public action"),"neutral")}function ir(e){const r=e.ownerSnapshot??{};return{title:"Owner & Custody Snapshot",owner:r.owner??"Owner not published",operator:r.operator??(e.subjectType==="swarm"?"Operator not published":"Agent operator not published"),custodyEpoch:r.custodyEpoch??e.custody??"Custody epoch pending",permissionState:r.permissionState??"Permission state not published",visibility:r.visibility??"Public profile only",recentChange:r.recentChange??"No recent public change",reviewAction:r.reviewAction??"No public review action",note:r.note??"State reference only. Multipass shows ownership, custody, visibility, and review context without executing approvals or transferring authority."}}function ar(e,r){return e?{title:"Transfer State Preview",currentOwner:e.currentOwner??"Owner pending",custodyEpoch:e.custodyEpoch??r.custody??"Custody epoch pending",claimAction:sr(e.claimAction),permissionsState:e.permissionsState??"Permissions paused",toolAction:e.toolAction??"Reverify tools",privateAccessAction:e.privateAccessAction??"Rotate private access",historyState:e.historyState??"History preserved",credContinuity:e.credContinuity??"Cred continues with ownership-change context.",note:e.note??"Transfer preview preserves public history but does not transfer secrets, private credentials, or active authority."}:null}function nr(e){if(!Array.isArray(e))return[];const r={"Tool approvals":"Tool approval policy","Route policy":"Route policy reference","Owner approval":"Owner approval required"};return e.map(i=>r[i]??i)}function sr(e){return!e||e==="Claim swarm"||e==="Claim agent"?"New owner claim required":e}function or(e){return e==null?"1 agent":`${e} ${Number(e)===1?"agent":"agents"}`}function lr(e){const r={frag_bendr_profile:"Bendr profile check",frag_bendr_endpoint:"Bendr API route",frag_bendr_standard_ref:"Standards reference",frag_bendr_receipt_history:"Receipt history",frag_bendr_route_dispute:"Route review flag",frag_bendr_helixa_identity:"Helixa AgentDNA identity",frag_bendr_cred_score:"Cred score import",frag_bendr_social_x:"Social handle check",frag_quigbot_identity:"Quigbot identity",frag_quigbot_cred:"Quigbot Cred context",frag_e2etest_identity:"E2ETest test identity",frag_e2etest_cred:"Lower trust context",frag_helixa_swarm_roster:"Swarm roster",frag_helixa_swarm_tools:"Shared tool policy",frag_helixa_swarm_cred:"Aggregate Cred context"};return r[e.fragment_id]?r[e.fragment_id]:N(e.fragment_type)}function N(e){const r=String(e??"unknown").split("_").filter(Boolean);return r.length===0?"Unknown":[r[0].charAt(0).toUpperCase()+r[0].slice(1),...r.slice(1)].join(" ")}const k={eyebrow:"MULTIPASS RECORD",headline:"The identity layer for agents, swarms, and the apps that need to read them.",body:"Multipass gives every agent a compact card and a machine-readable trust profile: identity, Cred, routes, standards, and receipts in one portable proof layer.",note:"Hidden prototype using Bendr 2.0 public fixture data."};function cr(){return[{title:"What is Multipass?",body:"Multipass is a portable identity and trust profile for agents, swarms, apps, and marketplaces that need to decide who they are dealing with."},{title:"What the card shows",body:"The card gives the fast read: name, Helixa ID, Cred context, verified status, framework, and profile route."},{title:"What proof adds",body:"Proof records explain where the card comes from without making raw protocol details the first thing people see."}]}function dr(e){return`${e.display_name} is a ${e.subject_type} profile with status ${e.status} and trust state ${e.cred_summary?.trust_state??"none"}.`}function ur(e){return re(e.fragments),[{title:"Card first",label:"Fast read",body:"Name, Helixa ID, Cred, framework, and profile route should be understandable at a glance."},{title:"Proof below",label:"Selected proof",body:"Fragments explain why the selected card should be trusted without dumping raw protocol detail up front."},{title:"Portable by design",label:`${e.x402.endpoints.length} x402 endpoint`,body:"Apps can read the same agent profile across discovery, access, settlement, and custody flows."}]}function pr(e,r=null){const i=ee(e.fragments,r),t=fr(e.fragments,i);return[{title:"Profile",status:e.profile.status,summary:dr(e.profile),why:"The profile is the canonical summary agents, apps, and builders can resolve first.",json:w(e.profile)},{title:"Public Fragments",status:`${i.length} public`,summary:i.length?`${i.length} readable proof signals for ${r?.name??e.profile.display_name}.`:`No public fragments returned for ${r?.name??e.profile.display_name}.`,why:"Fragments show the public pieces that support the profile without exposing private records.",json:t},{title:"Agent Card",status:`${e.card.capabilities.length} capabilities`,summary:`${e.card.service_endpoints.length} service endpoint records available.`,why:"The agent card gives machines a compact view of capabilities, routes, endpoints, and trust context.",json:w(e.card)},{title:"Standards",status:`${e.standards.standard_refs.length} refs`,summary:mr(e.standards.standard_refs),why:"Standards references show compatibility targets and adapter state without claiming every adapter is live.",json:w(e.standards)},{title:"x402",status:`${e.x402.endpoints.length} endpoints`,summary:e.x402.endpoints.map(n=>`${n.endpoint_id} accepts ${n.asset}`).join(", ")||"No endpoints returned.",why:"x402 metadata explains planned access rails and accepted assets without implying live settlement here.",json:w(e.x402)},{title:"Receipt",status:e.receipt.status,summary:`${e.receipt.receipt_id} records a ${e.receipt.response_class??"unknown"} response.`,why:"Receipt evidence records that an access event can be attached to the profile without becoming trust by itself.",json:w(e.receipt)}]}function fr(e,r){const i={fragments:w(r)};for(const t of["multipass_id","profile_id","subject_id","schema_version"])e[t]!==void 0&&(i[t]=e[t]);return i}function w(e){if(Array.isArray(e))return e.map(r=>w(r)).filter(r=>r!==void 0);if(!e||typeof e!="object")return e;if(e.visibility!=="private")return Object.fromEntries(Object.entries(e).filter(([r])=>!_r(r)).map(([r,i])=>[r,w(i)]).filter(([,r])=>r!==void 0))}function _r(e){const r=e.toLowerCase();return r.startsWith("private")||r.includes("_private")}function ee(e,r){const i=re(e),t=r?.proofFragmentIds;if(!Array.isArray(t)||t.length===0)return i;const n=new Map(i.map(s=>[s.fragment_id,s]));return t.map(s=>n.get(s)).filter(Boolean)}function re(e){return(e.fragments??[]).filter(r=>r.visibility==="public")}function mr(e){return e.map(r=>`${r.standard_id}: ${r.status}`).join(", ")||"No standard refs returned."}function vr({root:e,loadDemo:r=yr,loadLiveDemo:i=xe}){if(!e)throw new Error("createApp requires a root element");let t={expandedCard:null,selectedAgentCard:0,resolverInput:"",resolverStatus:null,resolverError:null,resolverRequestId:0,resolverInFlightInput:null,retryUntil:0,retryMessage:null,lookupMatches:[]};async function n(){gr(e);try{const d=await r();t={...t,data:d,staticData:d},x(e,t,l);const p=hr();p!==null&&s(p)}catch(d){br(e,d)}}async function s(d){const p=String(d??"").trim();t={...t,resolverInput:d,resolverStatus:"loading",resolverError:null,retryMessage:null,resolverInFlightInput:p,resolverRequestId:t.resolverRequestId+1,lookupMatches:[]};const h=t.resolverRequestId;x(e,t,l);try{const c=await i(p);if(h!==t.resolverRequestId)return;t={...t,data:c,resolverStatus:"loaded",resolverError:null,retryUntil:0,retryMessage:null,selectedAgentCard:0,expandedCard:null,resolverInFlightInput:null,lookupMatches:[]},xr(c?.liveProfilePage?.sharePath),x(e,t,l)}catch(c){if(h!==t.resolverRequestId)return;const m=Lr(c);t={...t,resolverStatus:"error",resolverError:Ir(c),resolverInFlightInput:null,retryUntil:m.retryUntil,retryMessage:m.retryMessage,lookupMatches:Pr(c)},x(e,t,l)}}function o(){t={...t,data:t.staticData,selectedAgentCard:0,expandedCard:null,resolverInput:"",resolverStatus:null,resolverError:null,resolverInFlightInput:null,resolverRequestId:t.resolverRequestId+1,retryUntil:0,retryMessage:null,lookupMatches:[]},Ar(),x(e,t,l)}const l={resolveLiveAgent:s,resetStaticDemo:o};return{start:n}}function hr(){if(typeof window>"u")return null;const e=new URL(window.location.href);return e.searchParams.has("agent")?e.searchParams.get("agent")??"":null}function yr(){const e=new URL(window.location.href);return _e(e)?me():fe({apiBase:ue(e),subject:Z})}function gr(e){e.innerHTML=`
    <section class="record-shell loading-shell">
      <p class="eyebrow">${k.eyebrow}</p>
      <h1>Loading Bendr 2.0...</h1>
    </section>
  `}function br(e,r){e.innerHTML=`
    <section class="record-shell error-shell">
      <p class="eyebrow">${k.eyebrow}</p>
      <h1>Could not load Multipass API data.</h1>
      <p>Run <code>pnpm api:bendr</code> in the Multipass repo, then reload this page.</p>
      <pre class="json-panel">${a(r.message)}</pre>
    </section>
  `}function wr(e){const r=e.liveProfilePage??{};return{eyebrow:r.eyebrow??k.eyebrow,prototypeLabel:r.prototypeLabel??Q.prototypeLabel,audience:r.audience??Q.audience,headline:r.headline??k.headline,body:r.body??k.body,note:r.note??e.heroNote??k.note}}function $r(e){return te(e)?` <a class="share-link" href="${y(e)}">${a(e)}</a>`:""}function te(e){if(!e)return!1;try{const r=new URL(String(e),"https://helixa.xyz");return r.origin==="https://helixa.xyz"&&r.pathname==="/multipass/"&&/^\d+$/.test(r.searchParams.get("agent")??"")}catch{return!1}}function xr(e){typeof window>"u"||!te(e)||window.history.replaceState(null,"",e)}function Ar(){if(typeof window>"u")return;const e=new URL(window.location.href);e.searchParams.delete("agent"),window.history.replaceState(null,"",`${e.pathname}${e.search}${e.hash}`)}function x(e,r,i={}){const{data:t}=r,n=wr(t),s=ur(t),o=cr(),l=We(t),d=l.cards[r.selectedAgentCard]??l.cards[0],p=Ke(t,d),h=pr(t,d);e.innerHTML=`
    <div class="record-shell">
      <header class="record-header">
        <div class="brand"><div class="mark" aria-hidden="true"></div><span>Multipass</span></div>
        <div class="header-meta"><span>Hidden Prototype</span><span>${a(t.liveProfilePage?.headerMeta??t.modeLabel??"Local API Demo")}</span></div>
      </header>

      <section class="hero-record">
        <div>
          <p class="eyebrow">${a(n.eyebrow)}</p>
          <div class="prototype-ribbon">
            <span>${a(n.prototypeLabel)}</span>
            <span>${a(n.audience)}</span>
          </div>
          <h1>${a(n.headline)}</h1>
          <p class="lead">${a(n.body)}</p>
          <div class="note">${a(n.note)}${$r(t.liveProfilePage?.sharePath)}</div>
        </div>

        <article class="record-sheet">
          <div class="sheet-top">
            <div>
              <h2>${a(t.profile.display_name)}</h2>
              <p>${a(t.liveProfilePage?.recordIntro??"Agent profile with public identity fragments, standards references, x402 route metadata, and receipt evidence.")}</p>
            </div>
            <div class="stamp">Public proof only</div>
          </div>
          <div class="field-grid">
            ${u("Record",t.profile.multipass_id??Z.slug)}
            ${u("Subject",t.profile.subject_type)}
            ${u("Slug",t.profile.slug??Z.slug)}
            ${u("Status",t.profile.status,"status")}
            ${u("Trust State",t.profile.cred_summary?.trust_state??"none")}
            ${u("Source",t.sourceLabel??"local API")}
            ${u("Receipt",t.receipt.receipt_id)}
          </div>
        </article>
      </section>

      ${Sr(r)}

      ${Tr(t.visualIdentity)}

      ${Er(t.visualIdentity?.provenanceDrawer)}

      ${Br(t.marketplaceListing)}

      ${Nr(l,d,r.selectedAgentCard)}

      <section class="story-records">${s.map(Jr).join("")}</section>

      <section class="clarity-grid">${o.map(Xr).join("")}</section>

      ${Wr(p)}

      <section class="proof-ledger">
        <div class="ledger-title"><h2>Proof ledger</h2><span>Expandable API records</span></div>
        ${h.map((c,m)=>Yr(c,m,r.expandedCard)).join("")}
      </section>

      <footer class="footer-note">This is a static public demo. It does not include auth, persistence, contract reads, or payment settlement.</footer>
    </div>
  `,e.querySelectorAll('[data-action="select-agent-card"]').forEach(c=>{c.addEventListener("click",()=>{r.selectedAgentCard=Number(c.dataset.index),x(e,r,i),e.querySelector(`[data-action="select-agent-card"][data-index="${r.selectedAgentCard}"]`)?.focus()})}),e.querySelectorAll('[data-action="toggle-json"]').forEach(c=>{c.addEventListener("click",()=>{const m=Number(c.dataset.index);r.expandedCard=r.expandedCard===m?null:m,x(e,r,i),e.querySelector(`[data-action="toggle-json"][data-index="${m}"]`)?.focus()})}),e.querySelector('[data-action="resolve-live-agent"]')?.addEventListener("submit",c=>{c.preventDefault();const D=c.currentTarget.querySelector('input[name="agent"]')?.value??"";ie(r)||r.resolverStatus==="loading"&&D.trim()===r.resolverInFlightInput||i.resolveLiveAgent?.(D)}),e.querySelector('[data-action="reset-static-demo"]')?.addEventListener("click",()=>i.resetStaticDemo?.()),e.querySelectorAll('[data-action="resolve-example-agent"]').forEach(c=>{c.addEventListener("click",()=>i.resolveLiveAgent?.(c.getAttribute("data-agent")??""))}),e.querySelectorAll('[data-action="select-lookup-match"]').forEach(c=>{c.addEventListener("click",()=>i.resolveLiveAgent?.(c.dataset.tokenId??""))})}function Sr(e){return`
    <section class="live-resolver" aria-label="Resolve live Helixa agent">
      <form data-action="resolve-live-agent">
        <div>
          <p class="card-label">Resolve live Helixa agent</p>
          <h2>Read a live AgentDNA record.</h2>
          <p>Try <code>1</code>, <code>8453:1</code>, <code>Bendr 2.0</code>, or <code>Quigbot</code>.</p>
        </div>
        <label>
          <span>Helixa ID, name, or handle</span>
          <input name="agent" value="${y(e.resolverInput??"")}" placeholder="81, 8453:81, or Quigbot" autocomplete="off" />
        </label>
        <button type="submit" ${ie(e)?"disabled":""}>${e.resolverStatus==="loading"?"Resolving...":"Resolve"}</button>
        <button type="button" data-action="reset-static-demo">Static demo</button>
      </form>
      ${e.resolverError?`<p class="resolver-message error">${a(e.resolverError)}</p>`:""}
      ${e.retryMessage?`<p class="resolver-message error">${a(e.retryMessage)}</p>`:""}
      ${Cr()}
      ${kr(e.lookupMatches)}
      ${e.resolverStatus==="loaded"?'<p class="resolver-message">Live Helixa API data loaded. Display only, no approvals or authority changes.</p>':""}
    </section>
  `}function Cr(){return`
    <div class="resolver-examples" aria-label="Example Helixa lookups">
      <span>Examples</span>
      ${["Bendr","Quigbot","81"].map(r=>`<button type="button" data-action="resolve-example-agent" data-agent="${y(r)}">${a(r)}</button>`).join("")}
    </div>
  `}function kr(e=[]){return e.length?`
    <div class="lookup-matches" aria-label="Matching Helixa agents">
      ${e.map(r=>`
        <button class="lookup-match-card" type="button" data-action="select-lookup-match" data-token-id="${y(r.tokenId)}">
          <strong>${a(r.name)}</strong>
          <span>${a(r.helixaId)} · ${a(r.framework??"unknown")} · ${r.credScore===null||r.credScore===void 0?"Cred pending":`Cred ${a(r.credScore)}`}</span>
          <em>${r.verified?"Verified":"Unverified"}</em>
        </button>
      `).join("")}
    </div>
  `:""}function ie(e){return e.retryUntil>Date.now()}function Pr(e){return!(e instanceof f)||e.code!=="ambiguous_lookup"?[]:Array.isArray(e.details?.matches)?e.details.matches:[]}function Ir(e){return e instanceof f?e.message:"Could not reach the Helixa API. Static demo is still available."}function Lr(e,r=Date.now()){if(!(e instanceof f)||e.code!=="rate_limited")return{retryUntil:0,retryMessage:null};const i=Number(e.details?.retryAfter);return!Number.isFinite(i)||i<=0?{retryUntil:0,retryMessage:null}:{retryUntil:r+i*1e3,retryMessage:`Try again in ${i} seconds.`}}function u(e,r,i=""){const t=i?` ${i}`:"";return`
    <div class="field">
      <span>${a(e)}</span>
      <strong class="mono${t}">${a(r)}</strong>
    </div>
  `}function Rr(e){if(!e)return null;try{const r=new URL(String(e));return r.protocol==="https:"?r.href:null}catch{return null}}function Tr(e){if(!e||!["helixa_aura","aura"].includes(e.source))return"";const r=Rr(e.imageUrl),i=e.label??"Helixa Agent Aura";return`
    <section class="aura-card" data-visual-source="${y(e.source)}" aria-label="Agent Aura marketplace visual">
      <div class="aura-asset-frame">
        <div class="aura-orb tone-${y(e.tone??"pending")}">
          ${r?`<img src="${y(r)}" alt="${y(i)}" loading="lazy" />`:""}
          <span>${a(e.initials??"MP")}</span>
        </div>
      </div>
      <div class="aura-item-meta">
        <p class="card-label">Visual</p>
        <h2>${a(i)}</h2>
        <div class="aura-chips" aria-label="Agent Aura traits">
          ${(e.chips??[]).map(t=>`<span>${a(t)}</span>`).join("")}
        </div>
      </div>
    </section>
  `}function Er(e){if(!e)return"";const r=(e.facts??[]).filter(t=>U(t?.label)&&U(t?.value)),i=(e.links??[]).filter(t=>U(t?.label)&&ae(t?.url));return`
    <section class="aura-provenance-drawer" aria-labelledby="aura-provenance-title">
      <div class="aura-provenance-copy">
        <p class="card-label">Public provenance</p>
        <h2 id="aura-provenance-title">${a(e.title??"Agent Aura Provenance")}</h2>
        <p>${a(e.summary??"Public source data for this AgentDNA visual.")}</p>
      </div>
      <div class="aura-provenance-body">
        ${r.length?`<div class="aura-provenance-grid">${r.map(Hr).join("")}</div>`:""}
        ${i.length?`<div class="aura-provenance-links" aria-label="Agent Aura provenance links">${i.map(t=>z(t.label,t.url)).join("")}</div>`:""}
        ${U(e.safetyNote)?`<p class="aura-provenance-note">${a(e.safetyNote)}</p>`:""}
      </div>
    </section>
  `}function Hr(e){return`
    <article class="aura-provenance-fact">
      <span>${a(e.label)}</span>
      <strong>${a(e.value)}</strong>
    </article>
  `}function U(e){return e!=null&&String(e).trim()!==""}function Nr(e,r,i){return`
    <section class="card-carousel">
      <div class="card-carousel-head">
        <p class="eyebrow">${a(e.eyebrow)}</p>
        <h2>${a(e.title)}</h2>
        <p>${a(e.body)}</p>
      </div>
      <div class="card-track" role="tablist" aria-label="Agent cards">
        ${e.cards.map((t,n)=>Dr(t,n,i)).join("")}
      </div>
      ${Ur(r)}
      ${Or(r.ownerSnapshot)}
      ${jr(r.changeReviewLedger)}
      ${Fr(r)}
    </section>
  `}function Dr(e,r,i){const t=r===i;return`
    <button class="card-button${t?" selected":""}" data-action="select-agent-card" data-index="${r}" type="button" aria-selected="${t}">
      <span class="card-name">${a(e.name)}</span>
      <span>${a(e.helixaId)}</span>
      <span>${a(e.subjectLabel)} · ${a(e.memberLabel)}</span>
      <span>${a(e.role)}</span>
      <span>${a(e.custody)}</span>
      <strong>${a(e.credLabel)}</strong>
    </button>
  `}function Ur(e){return e.detailMode==="swarm"?Mr(e):`
    <article class="card-detail">
      <div>
        <p class="card-label">Selected agent card</p>
        <h3>${a(e.name)}</h3>
        <p>Machine-readable identity card for routing, trust checks, roster context, and profile discovery.</p>
      </div>
      <div class="card-fields">
        ${u("Helixa ID",e.helixaId)}
        ${u("Framework",e.framework)}
        ${u("Cred",e.credScore===null?e.credLabel:`${e.credLabel} (${e.credTier})`)}
        ${u("Identity",e.verifiedLabel)}
        ${u("Subject",e.subjectLabel)}
        ${u("Roster",e.memberLabel)}
        ${u("Role",e.role)}
        ${u("Custody",e.custody)}
        ${u("Profile",e.profileUrl??"Not linked")}
      </div>
    </article>
  `}function Mr(e){return`
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
            ${u("Helixa ID",e.helixaId)}
            ${u("Roster",e.memberLabel)}
            ${u("Role",e.role)}
            ${u("Custody",e.custody)}
          </div>
        </section>
      </div>
    </article>
  `}function Or(e){return e?`
    <section class="owner-snapshot">
      <div class="owner-snapshot-copy">
        <p class="card-label">${a(e.title)}</p>
        <h3>${a(e.permissionState)}</h3>
        <p>${a(e.note)}</p>
      </div>
      <div class="owner-snapshot-grid">
        ${C("Owner",e.owner)}
        ${C("Operator",e.operator)}
        ${C("Custody epoch",e.custodyEpoch)}
        ${C("Visibility",e.visibility)}
        ${C("Recent change",e.recentChange)}
        ${C("Review action",e.reviewAction)}
      </div>
    </section>
  `:""}function C(e,r){return`
    <article class="owner-snapshot-field">
      <span>${a(e)}</span>
      <strong>${a(r)}</strong>
    </article>
  `}function jr(e){return e?`
    <section class="change-review-ledger">
      <div class="change-review-head">
        <p class="card-label">${a(e.eyebrow)}</p>
        <h3>${a(e.title)}</h3>
        <p>${a(e.note)}</p>
      </div>
      <div class="change-review-rows">
        ${e.rows.map(Zr).join("")}
      </div>
    </section>
  `:""}function Zr(e){return`
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
  `}function Fr(e){if(!e.transferPreview)return"";const r=e.transferPreview;return`
    <section class="transfer-preview">
      <div class="transfer-copy">
        <p class="card-label">${a(r.title)}</p>
        <h3>${a(r.claimAction)}</h3>
        <p>${a(r.note)}</p>
      </div>
      <div class="transfer-steps">
        ${$("Current owner",r.currentOwner)}
        ${$("Custody epoch",r.custodyEpoch)}
        ${$("Permissions",r.permissionsState)}
        ${$("Tools",r.toolAction)}
        ${$("Private access",r.privateAccessAction)}
        ${$("History",r.historyState)}
        ${$("Cred",r.credContinuity)}
      </div>
    </section>
  `}function $(e,r){return`
    <article class="transfer-step">
      <span>${a(e)}</span>
      <strong>${a(r)}</strong>
    </article>
  `}function Br(e){return e?`
    <section class="marketplace-listing" aria-label="Marketplace listing preview">
      <div class="listing-shell">
        <div class="listing-copy">
          <p class="card-label">Marketplace listing preview</p>
          <h2>${a(e.title??"Agent listing")}</h2>
          <p>${a(e.summary??"Public AgentDNA profile prepared for read-only marketplace discovery.")}</p>
          ${e.subtitle?`<span class="listing-subtitle">${a(e.subtitle)}</span>`:""}
        </div>
        <div class="listing-score">
          <span>${a(e.score?.tier??"Unrated")}</span>
          <strong>${a(e.score?.label??"Cred pending")}</strong>
        </div>
      </div>
      <div class="listing-badges">${(e.badges??[]).map(qr).join("")}</div>
      <section class="listing-identity">
        ${b({label:"Helixa ID",value:e.identity?.helixaId??"Not published"})}
        ${b({label:"Framework",value:e.identity?.framework??"unknown"})}
        ${b({label:"Identity",value:e.identity?.verifiedLabel??"Unverified AgentDNA"})}
        ${b({label:"Source",value:e.identity?.sourceLabel??"Live Helixa API"})}
        ${(e.facts??[]).map(b).join("")}
      </section>
      <section class="listing-sections">
        <article class="listing-section">
          <h3>Public routes</h3>
          ${zr(e.routes)}
        </article>
        <article class="listing-section">
          <h3>Payment references</h3>
          ${Vr(e.paymentReferences)}
        </article>
      </section>
      ${Gr(e.proof)}
      ${Qr(e.links)}
      <p class="listing-safety">${a(e.safetyNote??"Display only. No authority changes are available from this listing.")}</p>
    </section>
  `:""}function qr(e){return`<span class="listing-badge tone-${y(e?.tone??"neutral")}">${a(e?.label??"")}</span>`}function b(e){return`
    <article class="listing-fact">
      <span>${a(e?.label??"")}</span>
      <strong>${a(e?.value??"Not published")}</strong>
    </article>
  `}function zr(e=[]){return e.length?`<div class="listing-routes">${e.map(r=>`
    <article>
      <span>${a(r?.label??"Route")}</span>
      <strong>${z(r?.value??"",r?.url)}</strong>
    </article>
  `).join("")}</div>`:'<div class="listing-routes"><article><span>Routes</span><strong>No public service routes published</strong></article></div>'}function Vr(e=[]){return e.length?`<div class="listing-payments">${e.map(r=>`<span class="listing-payment">${a(r?.value??"")}${r?.source?` · ${a(r.source)}`:""}</span>`).join("")}</div>`:'<div class="listing-payments"><span class="listing-payment">No public payment references published</span></div>'}function Gr(e){return e?`<section class="listing-proof-strip">
    ${b({label:"Public proof",value:`${e.publicFragmentCount??0} fragments`})}
    ${b({label:"Verified signals",value:e.verifiedSignalCount??0})}
    ${b({label:"Review queue",value:e.reviewRequiredCount??0})}
    ${b({label:"Private access",value:e.privateCredentialState??"No secrets or private credentials exposed"})}
  </section>`:""}function Qr(e=[]){return e.length?`<div class="listing-links">${e.map(r=>`<span class="listing-link">${z(r?.label??"Link",r?.url)}</span>`).join("")}</div>`:""}function z(e,r){return ae(r)?`<a href="${y(r)}" target="_blank" rel="noopener noreferrer">${a(e)}</a>`:`<span>${a(e)}</span>`}function ae(e){if(!e)return!1;try{const r=new URL(String(e));return["https:","http:"].includes(r.protocol)&&!r.username&&!r.password}catch{return!1}}function Jr(e,r){return`
    <article class="story">
      <span class="story-num">${String(r+1).padStart(2,"0")}</span>
      <p class="card-label">${a(e.label)}</p>
      <h3>${a(e.title)}</h3>
      <p>${a(e.body)}</p>
    </article>
  `}function Xr(e){return`
    <article class="clarity-card">
      <h3>${a(e.title)}</h3>
      <p>${a(e.body)}</p>
    </article>
  `}function Wr(e){return`
    <section class="fragment-map">
      <div class="fragment-map-head">
        <p class="eyebrow">${a(e.eyebrow)}</p>
        <h2>${a(e.title)}</h2>
        <p>${a(e.body)}</p>
      </div>
      <div class="fragment-cards">
        ${e.cards.map(Kr).join("")}
      </div>
      <details class="fragment-legend">
        <summary>Proof vocabulary</summary>
        ${T("Fragment type legend",e.legends.fragmentType)}
        ${T("Status legend",e.legends.status)}
        ${T("Visibility legend",e.legends.visibility)}
        ${T("Assurance legend",e.legends.assurance)}
        ${T("Transfer policy",e.legends.transferPolicy)}
      </details>
      <p class="fragment-note">${a(e.emptyPrivateNote)}</p>
    </section>
  `}function Kr(e){return`
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
  `}function T(e,r){return`
    <article>
      <h3>${a(e)}</h3>
      ${Object.entries(r).map(([i,t])=>`
        <div class="legend-row">
          <strong>${a(i)}</strong>
          <span>${a(t)}</span>
        </div>
      `).join("")}
    </article>
  `}function Yr(e,r,i){const t=i===r;return`
    <article class="ledger-entry">
      <div class="ledger-row">
        <div class="doc">${a(e.title)}</div>
        <div class="badge ${et(e)}">${a(e.status)}</div>
        <div class="summary">
          <span>${a(e.summary)}</span>
          <span class="why">${a(e.why)}</span>
        </div>
        <button data-action="toggle-json" data-index="${r}" aria-expanded="${t}" aria-controls="proof-json-${r}">${t?"Hide JSON":"Show JSON"}</button>
      </div>
      ${t?`<pre id="proof-json-${r}" class="json-panel">${a(JSON.stringify(e.json,null,2))}</pre>`:""}
    </article>
  `}function et(e){return["settled","passed","filtered"].includes(String(e.status).toLowerCase())?"verified":"neutral"}function y(e){return a(e)}function a(e){return String(e).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;")}vr({root:document.querySelector("#app")}).start();
