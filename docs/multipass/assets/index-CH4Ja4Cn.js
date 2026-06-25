(function(){const r=document.createElement("link").relList;if(r&&r.supports&&r.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))t(a);new MutationObserver(a=>{for(const n of a)if(n.type==="childList")for(const l of n.addedNodes)l.tagName==="LINK"&&l.rel==="modulepreload"&&t(l)}).observe(document,{childList:!0,subtree:!0});function i(a){const n={};return a.integrity&&(n.integrity=a.integrity),a.referrerPolicy&&(n.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?n.credentials="include":a.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function t(a){if(a.ep)return;a.ep=!0;const n=i(a);fetch(a.href,n)}})();const E={modeLabel:"Static Demo",sourceLabel:"bundled fixture",profile:{schema_version:"0.1.0",multipass_id:"mp_bendr_2",subject_type:"agent",display_name:"Bendr 2.0",slug:"bendr-2",status:"link_ready",owner_summary:{owner_state:"unclaimed",verification_status:"none",visibility:"public",summary:"Demo ownership state for public static preview."},custody_epoch:null,public_fragments:[{fragment_id:"frag_bendr_profile",fragment_type:"attestation",status:"verified",assurance_level:"platform_verified",visibility:"public",updated_at:"2026-06-24T00:00:00Z"},{fragment_id:"frag_bendr_endpoint",fragment_type:"endpoint",status:"pending",assurance_level:"self_attested",visibility:"public",updated_at:"2026-06-24T00:00:00Z"},{fragment_id:"frag_bendr_standard_ref",fragment_type:"standard_ref",status:"stale",assurance_level:"issuer_attested",visibility:"public",updated_at:"2026-06-24T00:00:00Z"},{fragment_id:"frag_bendr_receipt_history",fragment_type:"receipt",status:"historical",assurance_level:"issuer_attested",visibility:"public",updated_at:"2026-06-24T00:00:00Z"},{fragment_id:"frag_bendr_route_dispute",fragment_type:"verification_result",status:"disputed",assurance_level:"unverified",visibility:"public",updated_at:"2026-06-24T00:00:00Z"},{fragment_id:"frag_bendr_helixa_identity",fragment_type:"attestation",status:"verified",assurance_level:"onchain_verified",visibility:"public",updated_at:"2026-06-24T22:49:52Z"},{fragment_id:"frag_bendr_cred_score",fragment_type:"risk_summary",status:"verified",assurance_level:"platform_verified",visibility:"public",updated_at:"2026-06-24T22:49:52Z"},{fragment_id:"frag_bendr_social_x",fragment_type:"social",status:"verified",assurance_level:"platform_verified",visibility:"public",updated_at:"2026-06-24T22:49:52Z"}],cred_summary:{trust_state:"established",attestation_count:4,receipt_count:1,last_updated_at:"2026-06-24T22:49:52Z",public_note:"Cred score 80 imported from Helixa API. Cred is a signal, not something bought or raised by payment."},discovery_profile:{summary:"Bendr 2.0 is the Helixa lead agent with AgentDNA token #1, imported Cred context, public routes, and machine-readable Multipass records.",tags:["bendr","helixa","multipass"],avatar_url:null,visibility:"public"},standards_profile:{standards_profile_id:"sp_bendr_2",supported_standard_ids:["ERC-8004","ERC-8217","ERC-8126","ERC-8257","ERC-8183"],last_verified_at:null},payment_profile:{accepted_assets:[{asset:"CRED",chain_id:8453}],x402_manifest_url:"/multipass/static/x402-manifest.json",paid_endpoints_enabled:!1},updated_at:"2026-06-24T22:49:52Z"},fragments:{subject_id:"bendr-2",fragments:[{schema_version:"0.1.0",fragment_id:"frag_bendr_profile",multipass_id:"mp_bendr_2",fragment_type:"attestation",status:"verified",assurance_level:"platform_verified",visibility:"public",transfer_policy:"historical_on_transfer",source:{source_type:"platform_check",source_id:"bendr_profile",issuer:"Helixa",observed_at:"2026-06-24T00:00:00Z",reference_url:null},public_value:"Bendr 2.0 profile claim checked by the Helixa fixture.",proof_reference:"fixture:profile-check",created_at:"2026-06-24T00:00:00Z",updated_at:"2026-06-24T00:00:00Z",verified_at:"2026-06-24T00:00:00Z"},{schema_version:"0.1.0",fragment_id:"frag_bendr_endpoint",multipass_id:"mp_bendr_2",fragment_type:"endpoint",status:"pending",assurance_level:"self_attested",visibility:"public",transfer_policy:"reverify_on_transfer",source:{source_type:"owner_submission",source_id:"bendr_endpoint",issuer:null,observed_at:"2026-06-24T00:00:00Z",reference_url:null},public_value:"Bendr local API endpoint awaiting live verification.",proof_reference:null,created_at:"2026-06-24T00:00:00Z",updated_at:"2026-06-24T00:00:00Z",endpoint_ref:{endpoint_id:"lookup",url:"/multipass/",protocol:"api",manifest_url:"/multipass/static/x402-manifest.json"}},{schema_version:"0.1.0",fragment_id:"frag_bendr_standard_ref",multipass_id:"mp_bendr_2",fragment_type:"standard_ref",status:"stale",assurance_level:"issuer_attested",visibility:"public",transfer_policy:"pause_on_transfer",source:{source_type:"issuer_attestation",source_id:"bendr_standard",issuer:"Helixa",observed_at:"2026-06-24T00:00:00Z",reference_url:null},public_value:"ERC-8004 adapter reference that needs a fresh check before stronger claims.",proof_reference:"fixture:standard-ref",created_at:"2026-06-24T00:00:00Z",updated_at:"2026-06-24T00:00:00Z",verified_at:"2026-06-24T00:00:00Z",expires_at:"2026-06-25T00:00:00Z"},{schema_version:"0.1.0",fragment_id:"frag_bendr_receipt_history",multipass_id:"mp_bendr_2",fragment_type:"receipt",status:"historical",assurance_level:"issuer_attested",visibility:"public",transfer_policy:"historical_on_transfer",source:{source_type:"payment_receipt",source_id:"bendr_receipt",issuer:"Helixa",observed_at:"2026-06-24T00:00:00Z",reference_url:null},public_value:"Receipt evidence retained as history; it does not create trust by itself.",proof_reference:"receipt_bendr_lookup",created_at:"2026-06-24T00:00:00Z",updated_at:"2026-06-24T00:00:00Z"},{schema_version:"0.1.0",fragment_id:"frag_bendr_route_dispute",multipass_id:"mp_bendr_2",fragment_type:"verification_result",status:"disputed",assurance_level:"unverified",visibility:"public",transfer_policy:"never_transfer",source:{source_type:"platform_check",source_id:"bendr_route_dispute",issuer:"Helixa",observed_at:"2026-06-24T00:00:00Z",reference_url:null},public_value:"Route claim intentionally marked disputed in the fixture.",proof_reference:"fixture:route-dispute",created_at:"2026-06-24T00:00:00Z",updated_at:"2026-06-24T00:00:00Z",verification_ref:{verification_type:"route_review",result:"inconclusive",issuer:"Helixa",risk_level:"medium",score:null}},{schema_version:"0.1.0",fragment_id:"frag_bendr_helixa_identity",multipass_id:"mp_bendr_2",fragment_type:"attestation",status:"verified",assurance_level:"onchain_verified",visibility:"public",transfer_policy:"historical_on_transfer",source:{source_type:"contract_read",source_id:"helixa_agentdna_1",issuer:"Helixa",observed_at:"2026-06-24T22:49:52Z",reference_url:"https://api.helixa.xyz/api/v2/agent/1"},public_value:"Helixa AgentDNA token #1 on Base, contract 0x2e3B541C59D38b84E3Bc54e977200230A204Fe60.",proof_reference:"base:8453:0x2e3B541C59D38b84E3Bc54e977200230A204Fe60:1",created_at:"2026-06-24T22:49:52Z",updated_at:"2026-06-24T22:49:52Z",verified_at:"2026-06-24T22:49:52Z"},{schema_version:"0.1.0",fragment_id:"frag_bendr_cred_score",multipass_id:"mp_bendr_2",fragment_type:"risk_summary",status:"verified",assurance_level:"platform_verified",visibility:"public",transfer_policy:"reverify_on_transfer",source:{source_type:"registry_import",source_id:"helixa_cred_score_1",issuer:"Helixa",observed_at:"2026-06-24T22:49:52Z",reference_url:"https://api.helixa.xyz/api/v2/agent/1"},public_value:"Cred score 80, Preferred tier, imported from Helixa API.",proof_reference:"helixa-api:agent:1:credScore",created_at:"2026-06-24T22:49:52Z",updated_at:"2026-06-24T22:49:52Z",verified_at:"2026-06-24T22:49:52Z",verification_ref:{verification_type:"cred_import",result:"passed",issuer:"Helixa",risk_level:"low",score:80}},{schema_version:"0.1.0",fragment_id:"frag_bendr_social_x",multipass_id:"mp_bendr_2",fragment_type:"social",status:"verified",assurance_level:"platform_verified",visibility:"public",transfer_policy:"reverify_on_transfer",source:{source_type:"platform_check",source_id:"bendr_x_handle",issuer:"Helixa",observed_at:"2026-06-24T22:49:52Z",reference_url:"https://api.helixa.xyz/api/v2/agent/1"},public_value:"X handle @BendrAI_eth imported from Helixa API.",proof_reference:"helixa-api:agent:1:socials.x",created_at:"2026-06-24T22:49:52Z",updated_at:"2026-06-24T22:49:52Z",verified_at:"2026-06-24T22:49:52Z"},{schema_version:"0.1.0",fragment_id:"frag_quigbot_identity",multipass_id:"mp_quigbot",fragment_type:"attestation",status:"verified",assurance_level:"platform_verified",visibility:"public",transfer_policy:"historical_on_transfer",source:{source_type:"platform_check",source_id:"quigbot_identity",issuer:"Helixa",observed_at:"2026-06-24T23:50:00Z",reference_url:"https://helixa.xyz/agent/81"},public_value:"Quigbot identity checked by the Helixa fixture.",proof_reference:"fixture:quigbot-identity",created_at:"2026-06-24T23:50:00Z",updated_at:"2026-06-24T23:50:00Z",verified_at:"2026-06-24T23:50:00Z"},{schema_version:"0.1.0",fragment_id:"frag_quigbot_cred",multipass_id:"mp_quigbot",fragment_type:"risk_summary",status:"verified",assurance_level:"platform_verified",visibility:"public",transfer_policy:"reverify_on_transfer",source:{source_type:"registry_import",source_id:"quigbot_cred",issuer:"Helixa",observed_at:"2026-06-24T23:50:00Z",reference_url:"https://helixa.xyz/agent/81"},public_value:"Quigbot Cred score 75, Prime tier.",proof_reference:"fixture:quigbot-cred",created_at:"2026-06-24T23:50:00Z",updated_at:"2026-06-24T23:50:00Z",verified_at:"2026-06-24T23:50:00Z"},{schema_version:"0.1.0",fragment_id:"frag_e2etest_identity",multipass_id:"mp_e2etest",fragment_type:"attestation",status:"pending",assurance_level:"self_attested",visibility:"public",transfer_policy:"reverify_on_transfer",source:{source_type:"owner_submission",source_id:"e2etest_identity",issuer:"Helixa",observed_at:"2026-06-24T23:50:00Z",reference_url:"https://helixa.xyz/agent/0"},public_value:"E2ETest is a low-assurance test record.",proof_reference:"fixture:e2etest-identity",created_at:"2026-06-24T23:50:00Z",updated_at:"2026-06-24T23:50:00Z"},{schema_version:"0.1.0",fragment_id:"frag_e2etest_cred",multipass_id:"mp_e2etest",fragment_type:"risk_summary",status:"disputed",assurance_level:"unverified",visibility:"public",transfer_policy:"never_transfer",source:{source_type:"platform_check",source_id:"e2etest_cred",issuer:"Helixa",observed_at:"2026-06-24T23:50:00Z",reference_url:"https://helixa.xyz/agent/0"},public_value:"Lower trust context for a test/demo agent.",proof_reference:"fixture:e2etest-cred",created_at:"2026-06-24T23:50:00Z",updated_at:"2026-06-24T23:50:00Z"},{schema_version:"0.1.0",fragment_id:"frag_helixa_swarm_roster",multipass_id:"mp_helixa_swarm",fragment_type:"custody_record",status:"verified",assurance_level:"platform_verified",visibility:"public",transfer_policy:"pause_on_transfer",source:{source_type:"platform_check",source_id:"helixa_swarm_roster",issuer:"Helixa",observed_at:"2026-06-24T23:38:00Z",reference_url:"https://helixa.xyz/multipass/"},public_value:"Parent Multipass manages Bendr, Quigbot, and E2ETest demo agents as one collection roster.",proof_reference:"fixture:helixa-swarm-roster",created_at:"2026-06-24T23:38:00Z",updated_at:"2026-06-24T23:38:00Z",verified_at:"2026-06-24T23:38:00Z"},{schema_version:"0.1.0",fragment_id:"frag_helixa_swarm_tools",multipass_id:"mp_helixa_swarm",fragment_type:"endpoint",status:"pending",assurance_level:"self_attested",visibility:"public",transfer_policy:"pause_on_transfer",source:{source_type:"owner_submission",source_id:"helixa_swarm_tools",issuer:"Helixa",observed_at:"2026-06-24T23:38:00Z",reference_url:"https://helixa.xyz/multipass/"},public_value:"Shared tool policy preview for routes, permissions, and approvals across the swarm.",proof_reference:"fixture:helixa-swarm-tools",created_at:"2026-06-24T23:38:00Z",updated_at:"2026-06-24T23:38:00Z",endpoint_ref:{endpoint_id:"swarm_policy",url:"https://helixa.xyz/multipass/",protocol:"api",manifest_url:"/multipass/static/x402-manifest.json"}},{schema_version:"0.1.0",fragment_id:"frag_helixa_swarm_cred",multipass_id:"mp_helixa_swarm",fragment_type:"risk_summary",status:"verified",assurance_level:"platform_verified",visibility:"public",transfer_policy:"reverify_on_transfer",source:{source_type:"registry_import",source_id:"helixa_swarm_cred",issuer:"Helixa",observed_at:"2026-06-24T23:38:00Z",reference_url:"https://helixa.xyz/multipass/"},public_value:"Aggregate Cred context summarizes the roster without erasing each agent's individual profile.",proof_reference:"fixture:helixa-swarm-cred",created_at:"2026-06-24T23:38:00Z",updated_at:"2026-06-24T23:38:00Z",verified_at:"2026-06-24T23:38:00Z",verification_ref:{verification_type:"swarm_cred_summary",result:"passed",issuer:"Helixa",risk_level:"medium",score:78}}]},card:{schema_version:"0.1.0",multipass_id:"mp_bendr_2",name:"Bendr 2.0",subject_type:"agent",capabilities:[{capability_id:"profile_lookup",label:"Profile lookup",description:"Read public Multipass profile data from the static preview.",visibility:"public"},{capability_id:"agent_card_resolution",label:"Agent card resolution",description:"Resolve compact agent card fields for discovery and trust checks.",visibility:"public"}],message_routes:[{route_id:"web_profile",channel:"api",address:"https://helixa.xyz/agent/1",visibility:"public"},{route_id:"telegram",channel:"chat",address:"@bendr2bot",visibility:"public"}],service_endpoints:[{endpoint_id:"helixa_profile",url:"https://api.helixa.xyz/api/v2/agent/1",description:"Public Helixa AgentDNA profile for Bendr 2.0.",visibility:"public"},{endpoint_id:"multipass_preview",url:"https://helixa.xyz/multipass/",description:"Hidden Multipass prototype preview.",visibility:"public"}],x402_manifest_url:"/multipass/static/x402-manifest.json",accepted_assets:[{asset:"CRED",chain_id:8453}],trust_summary:{identity_status:"verified",assurance_level:"onchain_verified",last_updated_at:"2026-06-24T22:49:52Z"},rate_limits:{requests:60,window_seconds:60,burst:10},contact_policy:{mode:"approval_required",requires_owner_approval:!0,policy_note:"Static demo only."},standards_refs:[{standard_id:"ERC-8004",support_status:"adapter_ready",record_id:null},{standard_id:"ERC-8217",support_status:"pending",record_id:null}]},standards:{schema_version:"0.1.0",standards_profile_id:"sp_bendr_2",multipass_id:"mp_bendr_2",primary_refs:{erc8004_identity:null,controller_asset:null,x402_manifest:"mp_bendr_2:x402"},standard_refs:[{standard_id:"ERC-8004",status:"adapter_ready",chain_id:8453,contract_address:null,record_id:null,adapter_version:"0.1.0",last_verified_at:null,assurance_level:"unverified"},{standard_id:"ERC-8217",status:"pending",chain_id:8453,contract_address:null,record_id:null,adapter_version:"0.1.0",last_verified_at:null,assurance_level:"unverified"},{standard_id:"ERC-8257",status:"pending",chain_id:null,contract_address:null,record_id:null,adapter_version:"0.1.0",last_verified_at:null,assurance_level:"unverified"}],compatibility_summary:{identity_bound:!1,owner_verified:!1,risk_checked:!1,tools_verified:!1,work_attested:!1,trust_updated:!1},adapter_versions:{"ERC-8004":"0.1.0","ERC-8217":"0.1.0","ERC-8257":"0.1.0"},last_verified_at:null},x402:{schema_version:"0.1.0",multipass_id:"mp_bendr_2",endpoints:[{endpoint_id:"lookup",url:"/multipass/",method:"GET",description:"Sample CRED-gated profile lookup route for public static preview.",price:{amount:"1",decimals:18},asset:"CRED",chain_id:8453,provider:"bankr_x402_cloud",settlement_reference_policy:"provider_receipt",rate_limit:{requests:10,window_seconds:60,burst:2},visibility:"public",requires_owner_approval:!1}]},receipt:{schema_version:"0.1.0",receipt_id:"receipt_bendr_lookup",multipass_id:"mp_bendr_2",endpoint_id:"lookup",provider:"bankr_x402_cloud",amount:"1",asset:"CRED",chain_id:8453,status:"settled",created_at:"2026-06-24T00:00:00Z",response_class:"success",settlement_reference:null,redaction_note:"Sample public static receipt. No private request or response payload is included."},routes:{},agentCards:[{name:"Bendr 2.0",tokenId:1,helixaId:"8453:1",framework:"openclaw",credScore:80,credTier:"Preferred",verified:!0,profileUrl:"https://helixa.xyz/agent/1",proofFragmentIds:["frag_bendr_profile","frag_bendr_endpoint","frag_bendr_standard_ref","frag_bendr_receipt_history","frag_bendr_route_dispute","frag_bendr_helixa_identity","frag_bendr_cred_score"],ownerSnapshot:{owner:"0x3395...480E0",operator:"Bendr runtime",custodyEpoch:"Epoch 01",permissionState:"Active owner-approved routes",visibility:"Public profile, private credentials hidden",recentChange:"Cred import refreshed",reviewAction:"Review stale standards reference"}},{name:"Quigbot",tokenId:81,helixaId:"8453:81",framework:"openclaw",credScore:75,credTier:"Prime",verified:!0,profileUrl:"https://helixa.xyz/agent/81",proofFragmentIds:["frag_quigbot_identity","frag_quigbot_cred"],ownerSnapshot:{owner:"0x17d7...bDe4",operator:"Quigbot runtime",custodyEpoch:"Epoch 01",permissionState:"Active owner-approved routes",visibility:"Public profile, private credentials hidden",recentChange:"Identity and Cred context imported",reviewAction:"No public review action"}},{name:"E2ETest",tokenId:0,helixaId:"8453:0",framework:"openclaw",credScore:41,credTier:"Marginal",verified:!1,profileUrl:"https://helixa.xyz/agent/0",proofFragmentIds:["frag_e2etest_identity","frag_e2etest_cred"],ownerSnapshot:{owner:"Demo owner pending",operator:"Test fixture",custodyEpoch:"Draft epoch",permissionState:"Review required before active routes",visibility:"Public test profile",recentChange:"Low-assurance test record imported",reviewAction:"Verify owner before production use"}},{name:"Helixa Swarm",tokenId:"swarm:helixa",helixaId:"8453:swarm:helixa",framework:"multi-agent",credScore:78,credTier:"Prime",verified:!0,profileUrl:"https://helixa.xyz/swarm/helixa",subjectType:"swarm",members:3,role:"Parent Multipass",custody:"Custody epoch ready",proofFragmentIds:["frag_helixa_swarm_roster","frag_helixa_swarm_tools","frag_helixa_swarm_cred"],roster:[{name:"Bendr 2.0",role:"Lead agent"},{name:"Quigbot",role:"Product agent"},{name:"E2ETest",role:"Test agent"}],sharedControls:["Tool approval policy","Route policy reference","Owner approval required"],aggregateCred:"Cred 78 Prime summarizes the roster without replacing individual agent scores.",transferBehavior:"Permissions pause and tool routes reverify when custody changes.",transferPreview:{currentOwner:"0x3395...480E0",custodyEpoch:"Epoch 03",claimAction:"New owner claim required",permissionsState:"Permissions paused",toolAction:"Reverify shared tools",privateAccessAction:"Rotate private access",historyState:"History preserved",credContinuity:"Cred continues with ownership-change context."},ownerSnapshot:{owner:"0x3395...480E0",operator:"Helixa ops",custodyEpoch:"Epoch 03",permissionState:"Paused until owner review",visibility:"Public profile, gated private data",recentChange:"Transfer detected 2026-06-24",reviewAction:"Reverify routes before resume"}}]},T="/multipass-api";function R(e){const r=A(e);return r?S(r.toString()):T}function A(e){const r=e.searchParams.get("api");if(!r)return null;try{const i=new URL(r);return["http:","https:"].includes(i.protocol)?i:null}catch{return null}}function Z(e,r){const t=`${S(e||T)}/api/multipass/${encodeURIComponent(r.slug)}`;return{profile:t,fragments:`${t}/fragments`,card:`${t}/agent-card`,standards:`${t}/standards`,x402:`${t}/x402`,receipt:`${t}/receipts/${encodeURIComponent(r.receiptId)}`}}async function u(e,r=fetch){const i=await r(e);if(!i.ok)throw new Error(`GET ${e} failed with ${i.status}`);const t=await i.text();try{return JSON.parse(t)}catch(a){throw new Error(`API returned invalid JSON for ${e}: ${a.message}`)}}async function L({apiBase:e=T,subject:r,fetchImpl:i=fetch}){const t=Z(e,r),[a,n,l,b,g,d]=await Promise.all([u(t.profile,i),u(t.fragments,i),u(t.card,i),u(t.standards,i),u(t.x402,i),u(t.receipt,i)]);return{profile:a,fragments:n,card:l,standards:b,x402:g,receipt:d,routes:t,modeLabel:"Local API Demo",sourceLabel:"local API"}}function I(e){const r=e.pathname;return(r==="/multipass"||r.startsWith("/multipass/"))&&!A(e)}async function j(){return structuredClone(E)}function S(e){return e.endsWith("/")?e.slice(0,-1):e}const x={slug:"bendr-2",receiptId:"receipt_bendr_lookup"},C={prototypeLabel:"Internal Prototype",audience:"Built first for agent builders, agent teams, and marketplaces that need a fast trust read."},w={title:"Inspect proof",eyebrow:"PROOF LAYER",body:"Open the proof when a card needs verification. Each signal keeps its own visibility, source, assurance level, and transfer rule."},h={fragmentType:{endpoint:"Endpoint fragments describe routes, protocols, manifests, and access surfaces an agent may expose.",attestation:"Attestation fragments describe claims or checks from an owner, platform, issuer, or verifier.",receipt:"Receipt fragments describe access or payment evidence without making that evidence trust by itself.",standard_ref:"Standard reference fragments connect the profile to external standards without implying every adapter is live.",verification_result:"Verification result fragments record review outcomes, risk context, or disputed checks.",custody_record:"Custody record fragments describe owner or controller epochs without transferring private authority.",risk_summary:"Risk summary fragments carry imported Cred or safety context without collapsing identity into a single score.",social:"Social fragments connect public handles to an agent profile through a named source or verification path."},visibility:{public:"Visible to anyone and safe for profile cards, indexers, and partner systems.",gated:"Released only after token, payment, relationship, or allowlist policy is satisfied.",private:"Visible only to approved owners, operators, or internal systems with a clear need.",hidden:"Not discoverable through public or gated surfaces, reserved for safety or integrity review."},status:{verified:"Checked by a platform, issuer, contract read, or other explicit verification path.",pending:"Submitted or referenced, but still waiting for review or a stronger proof source.",stale:"Previously useful, but old enough that builders should request a fresh check.",historical:"Kept as provenance or prior evidence, not treated as active authority.",disputed:"Flagged for review because the claim, source, or interpretation is contested."},assurance:{unverified:"Unverified means the fragment has no stronger source than a raw claim or placeholder.",self_attested:"Self attested means the owner or agent supplied the claim without outside verification.",platform_verified:"Platform verified means Helixa or another platform checked the fragment through a defined process.",cryptographic:"Cryptographic means the fragment is backed by a signature, hash, or comparable cryptographic proof.",issuer_attested:"Issuer attested means a named issuer supplied or signed the supporting evidence.",onchain_verified:"Onchain verified means the fragment was checked against a chain record or contract read."},transferPolicy:{reverify_on_transfer:"Reverify on transfer means a new owner must confirm the fragment before it is treated as current.",pause_on_transfer:"Pause on transfer means active authority should stop until the new owner or operator approves it.",historical_on_transfer:"Historical on transfer means provenance stays visible, but it does not grant active authority.",never_transfer:"Never transfer means the fragment is bound to the prior controller or context and must not move."}};function H(e){const r={name:e.profile.display_name,tokenId:e.profile.slug??e.profile.multipass_id,helixaId:e.profile.slug??e.profile.multipass_id,framework:"unknown",credScore:null,credTier:e.profile.cred_summary?.trust_state??"none",verified:e.card.trust_summary?.identity_status==="verified",profileUrl:null};return{eyebrow:"AGENT CARD CAROUSEL",title:"Agent cards that lead with trust.",body:"Each card gives agents, swarms, apps, and marketplaces a quick read on identity, Cred, framework, and profile route. The deeper proof sits below for verification, not first impression.",cards:(e.agentCards?.length?e.agentCards:[r]).map(t=>({name:t.name,tokenId:t.tokenId,helixaId:t.helixaId??String(t.tokenId??t.name),framework:t.framework??"unknown",credScore:t.credScore??null,credTier:t.credTier??"Unrated",credLabel:t.credScore===null||t.credScore===void 0?"Cred pending":`Cred ${t.credScore}`,verified:!!t.verified,verifiedLabel:t.verified?"verified":"unverified",profileUrl:t.profileUrl??null,subjectLabel:t.subjectType??"agent",memberLabel:N(t.members),role:t.role??"Agent Multipass",custody:t.custody??"Owner verified",detailMode:t.subjectType==="swarm"?"swarm":"agent",roster:Array.isArray(t.roster)?t.roster.map(a=>({name:a.name,role:a.role??"Member agent"})):[],sharedControls:B(t.sharedControls),aggregateCred:t.aggregateCred??null,transferBehavior:t.transferBehavior??null,ownerSnapshot:M(t),transferPreview:F(t.transferPreview,t),proofFragmentIds:Array.isArray(t.proofFragmentIds)?t.proofFragmentIds:[]}))}}function O(e,r=null){const i=P(e.fragments,r);return{title:w.title,eyebrow:w.eyebrow,body:w.body,cards:i.map(D),legends:h,emptyPrivateNote:"Private and hidden fragments are not rendered in this public prototype."}}function D(e){const r=v(e.fragment_type),i=e.endpoint_ref?.protocol?`${e.endpoint_ref.protocol} `:"",t=e.source?.source_type?v(e.source.source_type):"Unknown source",a=e.source?.issuer?` by ${e.source.issuer}`:"";return{id:e.fragment_id,title:z(e),type:e.fragment_type,typeLabel:r,status:e.status,statusExplanation:h.status[e.status]??"Status explanation unavailable.",assurance:e.assurance_level,assuranceLabel:v(e.assurance_level),assuranceExplanation:h.assurance[e.assurance_level]??"Assurance explanation unavailable.",visibility:e.visibility,visibilityExplanation:h.visibility[e.visibility]??"Visibility explanation unavailable.",transferPolicy:e.transfer_policy,transferPolicyLabel:v(e.transfer_policy),transferPolicyExplanation:h.transferPolicy[e.transfer_policy]??"Transfer policy explanation unavailable.",summary:e.endpoint_ref?`${r} for ${i}endpoint from ${t}${a}.`:`${r} from ${t}${a}.`,publicValue:e.public_value??"No public value returned."}}function M(e){const r=e.ownerSnapshot??{};return{title:"Owner & Custody Snapshot",owner:r.owner??"Owner not published",operator:r.operator??(e.subjectType==="swarm"?"Operator not published":"Agent operator not published"),custodyEpoch:r.custodyEpoch??e.custody??"Custody epoch pending",permissionState:r.permissionState??"Permission state not published",visibility:r.visibility??"Public profile only",recentChange:r.recentChange??"No recent public change",reviewAction:r.reviewAction??"No public review action",note:r.note??"State reference only. Multipass shows ownership, custody, visibility, and review context without executing approvals or transferring authority."}}function F(e,r){return e?{title:"Transfer State Preview",currentOwner:e.currentOwner??"Owner pending",custodyEpoch:e.custodyEpoch??r.custody??"Custody epoch pending",claimAction:q(e.claimAction),permissionsState:e.permissionsState??"Permissions paused",toolAction:e.toolAction??"Reverify tools",privateAccessAction:e.privateAccessAction??"Rotate private access",historyState:e.historyState??"History preserved",credContinuity:e.credContinuity??"Cred continues with ownership-change context.",note:e.note??"Transfer preview preserves public history but does not transfer secrets, private credentials, or active authority."}:null}function B(e){if(!Array.isArray(e))return[];const r={"Tool approvals":"Tool approval policy","Route policy":"Route policy reference","Owner approval":"Owner approval required"};return e.map(i=>r[i]??i)}function q(e){return!e||e==="Claim swarm"||e==="Claim agent"?"New owner claim required":e}function N(e){return e==null?"1 agent":`${e} ${Number(e)===1?"agent":"agents"}`}function z(e){const r={frag_bendr_profile:"Bendr profile check",frag_bendr_endpoint:"Bendr API route",frag_bendr_standard_ref:"Standards reference",frag_bendr_receipt_history:"Receipt history",frag_bendr_route_dispute:"Route review flag",frag_bendr_helixa_identity:"Helixa AgentDNA identity",frag_bendr_cred_score:"Cred score import",frag_bendr_social_x:"Social handle check",frag_quigbot_identity:"Quigbot identity",frag_quigbot_cred:"Quigbot Cred context",frag_e2etest_identity:"E2ETest test identity",frag_e2etest_cred:"Lower trust context",frag_helixa_swarm_roster:"Swarm roster",frag_helixa_swarm_tools:"Shared tool policy",frag_helixa_swarm_cred:"Aggregate Cred context"};return r[e.fragment_id]?r[e.fragment_id]:v(e.fragment_type)}function v(e){const r=String(e??"unknown").split("_").filter(Boolean);return r.length===0?"Unknown":[r[0].charAt(0).toUpperCase()+r[0].slice(1),...r.slice(1)].join(" ")}const f={eyebrow:"MULTIPASS RECORD",headline:"The identity layer for agents, swarms, and the apps that need to read them.",body:"Multipass gives every agent a compact card and a machine-readable trust profile: identity, Cred, routes, standards, and receipts in one portable proof layer.",note:"Hidden prototype using Bendr 2.0 public fixture data."};function U(){return[{title:"What is Multipass?",body:"Multipass is a portable identity and trust profile for agents, swarms, apps, and marketplaces that need to decide who they are dealing with."},{title:"What the card shows",body:"The card gives the fast read: name, Helixa ID, Cred context, verified status, framework, and profile route."},{title:"What proof adds",body:"Proof records explain where the card comes from without making raw protocol details the first thing people see."}]}function V(e){return`${e.display_name} is a ${e.subject_type} profile with status ${e.status} and trust state ${e.cred_summary?.trust_state??"none"}.`}function Q(e){return k(e.fragments),[{title:"Card first",label:"Fast read",body:"Name, Helixa ID, Cred, framework, and profile route should be understandable at a glance."},{title:"Proof below",label:"Selected proof",body:"Fragments explain why the selected card should be trusted without dumping raw protocol detail up front."},{title:"Portable by design",label:`${e.x402.endpoints.length} x402 endpoint`,body:"Apps can read the same agent profile across discovery, access, settlement, and custody flows."}]}function J(e,r=null){const i=P(e.fragments,r),t=G(e.fragments,i);return[{title:"Profile",status:e.profile.status,summary:V(e.profile),why:"The profile is the canonical summary agents, apps, and builders can resolve first.",json:c(e.profile)},{title:"Public Fragments",status:`${i.length} public`,summary:i.length?`${i.length} readable proof signals for ${r?.name??e.profile.display_name}.`:`No public fragments returned for ${r?.name??e.profile.display_name}.`,why:"Fragments show the public pieces that support the profile without exposing private records.",json:t},{title:"Agent Card",status:`${e.card.capabilities.length} capabilities`,summary:`${e.card.service_endpoints.length} service endpoint records available.`,why:"The agent card gives machines a compact view of capabilities, routes, endpoints, and trust context.",json:c(e.card)},{title:"Standards",status:`${e.standards.standard_refs.length} refs`,summary:Y(e.standards.standard_refs),why:"Standards references show compatibility targets and adapter state without claiming every adapter is live.",json:c(e.standards)},{title:"x402",status:`${e.x402.endpoints.length} endpoints`,summary:e.x402.endpoints.map(a=>`${a.endpoint_id} accepts ${a.asset}`).join(", ")||"No endpoints returned.",why:"x402 metadata explains planned access rails and accepted assets without implying live settlement here.",json:c(e.x402)},{title:"Receipt",status:e.receipt.status,summary:`${e.receipt.receipt_id} records a ${e.receipt.response_class??"unknown"} response.`,why:"Receipt evidence records that an access event can be attached to the profile without becoming trust by itself.",json:c(e.receipt)}]}function G(e,r){const i={fragments:c(r)};for(const t of["multipass_id","profile_id","subject_id","schema_version"])e[t]!==void 0&&(i[t]=e[t]);return i}function c(e){if(Array.isArray(e))return e.map(r=>c(r)).filter(r=>r!==void 0);if(!e||typeof e!="object")return e;if(e.visibility!=="private")return Object.fromEntries(Object.entries(e).filter(([r])=>!W(r)).map(([r,i])=>[r,c(i)]).filter(([,r])=>r!==void 0))}function W(e){const r=e.toLowerCase();return r.startsWith("private")||r.includes("_private")}function P(e,r){const i=k(e),t=r?.proofFragmentIds;if(!Array.isArray(t)||t.length===0)return i;const a=new Map(i.map(n=>[n.fragment_id,n]));return t.map(n=>a.get(n)).filter(Boolean)}function k(e){return(e.fragments??[]).filter(r=>r.visibility==="public")}function Y(e){return e.map(r=>`${r.standard_id}: ${r.status}`).join(", ")||"No standard refs returned."}function K({root:e,loadDemo:r=X}){if(!e)throw new Error("createApp requires a root element");let i={expandedCard:null,selectedAgentCard:0};async function t(){ee(e);try{const a=await r();i={...i,data:a},$(e,i)}catch(a){re(e,a)}}return{start:t}}function X(){const e=new URL(window.location.href);return I(e)?j():L({apiBase:R(e),subject:x})}function ee(e){e.innerHTML=`
    <section class="record-shell loading-shell">
      <p class="eyebrow">${f.eyebrow}</p>
      <h1>Loading Bendr 2.0...</h1>
    </section>
  `}function re(e,r){e.innerHTML=`
    <section class="record-shell error-shell">
      <p class="eyebrow">${f.eyebrow}</p>
      <h1>Could not load Multipass API data.</h1>
      <p>Run <code>pnpm api:bendr</code> in the Multipass repo, then reload this page.</p>
      <pre class="json-panel">${s(r.message)}</pre>
    </section>
  `}function $(e,r){const{data:i}=r,t=Q(i),a=U(),n=H(i),l=n.cards[r.selectedAgentCard]??n.cards[0],b=O(i,l),g=J(i,l);e.innerHTML=`
    <div class="record-shell">
      <header class="record-header">
        <div class="brand"><div class="mark" aria-hidden="true"></div><span>Multipass</span></div>
        <div class="header-meta"><span>Hidden Prototype</span><span>${s(i.modeLabel??"Local API Demo")}</span></div>
      </header>

      <section class="hero-record">
        <div>
          <p class="eyebrow">${f.eyebrow}</p>
          <div class="prototype-ribbon">
            <span>${s(C.prototypeLabel)}</span>
            <span>${s(C.audience)}</span>
          </div>
          <h1>${f.headline}</h1>
          <p class="lead">${f.body}</p>
          <div class="note">${f.note}</div>
        </div>

        <article class="record-sheet">
          <div class="sheet-top">
            <div>
              <h2>${s(i.profile.display_name)}</h2>
              <p>Agent profile with public identity fragments, standards references, x402 route metadata, and receipt evidence.</p>
            </div>
            <div class="stamp">Public proof only</div>
          </div>
          <div class="field-grid">
            ${o("Record",i.profile.multipass_id??x.slug)}
            ${o("Subject",i.profile.subject_type)}
            ${o("Slug",i.profile.slug??x.slug)}
            ${o("Status",i.profile.status,"status")}
            ${o("Trust State",i.profile.cred_summary?.trust_state??"none")}
            ${o("Source",i.sourceLabel??"local API")}
            ${o("Receipt",i.receipt.receipt_id)}
          </div>
        </article>
      </section>

      ${te(n,l,r.selectedAgentCard)}

      <section class="story-records">${t.map(le).join("")}</section>

      <section class="clarity-grid">${a.map(de).join("")}</section>

      ${ce(b)}

      <section class="proof-ledger">
        <div class="ledger-title"><h2>Proof ledger</h2><span>Expandable API records</span></div>
        ${g.map((d,m)=>ue(d,m,r.expandedCard)).join("")}
      </section>

      <footer class="footer-note">This is a static public demo. It does not include auth, persistence, contract reads, or payment settlement.</footer>
    </div>
  `,e.querySelectorAll('[data-action="select-agent-card"]').forEach(d=>{d.addEventListener("click",()=>{r.selectedAgentCard=Number(d.dataset.index),$(e,r),e.querySelector(`[data-action="select-agent-card"][data-index="${r.selectedAgentCard}"]`)?.focus()})}),e.querySelectorAll('[data-action="toggle-json"]').forEach(d=>{d.addEventListener("click",()=>{const m=Number(d.dataset.index);r.expandedCard=r.expandedCard===m?null:m,$(e,r),e.querySelector(`[data-action="toggle-json"][data-index="${m}"]`)?.focus()})})}function o(e,r,i=""){const t=i?` ${i}`:"";return`
    <div class="field">
      <span>${s(e)}</span>
      <strong class="mono${t}">${s(r)}</strong>
    </div>
  `}function te(e,r,i){return`
    <section class="card-carousel">
      <div class="card-carousel-head">
        <p class="eyebrow">${s(e.eyebrow)}</p>
        <h2>${s(e.title)}</h2>
        <p>${s(e.body)}</p>
      </div>
      <div class="card-track" role="tablist" aria-label="Agent cards">
        ${e.cards.map((t,a)=>ie(t,a,i)).join("")}
      </div>
      ${se(r)}
      ${ne(r.ownerSnapshot)}
      ${oe(r)}
    </section>
  `}function ie(e,r,i){const t=r===i;return`
    <button class="card-button${t?" selected":""}" data-action="select-agent-card" data-index="${r}" type="button" aria-selected="${t}">
      <span class="card-name">${s(e.name)}</span>
      <span>${s(e.helixaId)}</span>
      <span>${s(e.subjectLabel)} · ${s(e.memberLabel)}</span>
      <span>${s(e.role)}</span>
      <span>${s(e.custody)}</span>
      <strong>${s(e.credLabel)}</strong>
    </button>
  `}function se(e){return e.detailMode==="swarm"?ae(e):`
    <article class="card-detail">
      <div>
        <p class="card-label">Selected agent card</p>
        <h3>${s(e.name)}</h3>
        <p>Machine-readable identity card for routing, trust checks, roster context, and profile discovery.</p>
      </div>
      <div class="card-fields">
        ${o("Helixa ID",e.helixaId)}
        ${o("Framework",e.framework)}
        ${o("Cred",e.credScore===null?e.credLabel:`${e.credLabel} (${e.credTier})`)}
        ${o("Identity",e.verifiedLabel)}
        ${o("Subject",e.subjectLabel)}
        ${o("Roster",e.memberLabel)}
        ${o("Role",e.role)}
        ${o("Custody",e.custody)}
        ${o("Profile",e.profileUrl??"Not linked")}
      </div>
    </article>
  `}function ae(e){return`
    <article class="card-detail swarm-detail">
      <div>
        <p class="card-label">Swarm detail</p>
        <h3>${s(e.name)}</h3>
        <p>Parent Multipass for a collection of agents with shared routes, custody context, and proof that still preserves each member profile.</p>
      </div>
      <div class="swarm-panels">
        <section class="swarm-panel">
          <h4>Roster</h4>
          ${e.roster.map(r=>`
            <div class="swarm-row">
              <strong>${s(r.name)}</strong>
              <span>${s(r.role)}</span>
            </div>
          `).join("")}
        </section>
        <section class="swarm-panel">
          <h4>Policy references</h4>
          ${e.sharedControls.map(r=>`<span class="control-chip">${s(r)}</span>`).join("")}
        </section>
        <section class="swarm-panel wide">
          <h4>Aggregate Cred</h4>
          <p>${s(e.aggregateCred??`${e.credLabel} (${e.credTier}) gives context only; member scores remain separate.`)}</p>
        </section>
        <section class="swarm-panel wide">
          <h4>Transfer behavior</h4>
          <p>${s(e.transferBehavior??"Permissions pause and active routes reverify when custody changes.")}</p>
        </section>
        <section class="swarm-panel wide">
          <h4>Summary</h4>
          <div class="card-fields swarm-fields">
            ${o("Helixa ID",e.helixaId)}
            ${o("Roster",e.memberLabel)}
            ${o("Role",e.role)}
            ${o("Custody",e.custody)}
          </div>
        </section>
      </div>
    </article>
  `}function ne(e){return e?`
    <section class="owner-snapshot">
      <div class="owner-snapshot-copy">
        <p class="card-label">${s(e.title)}</p>
        <h3>${s(e.permissionState)}</h3>
        <p>${s(e.note)}</p>
      </div>
      <div class="owner-snapshot-grid">
        ${_("Owner",e.owner)}
        ${_("Operator",e.operator)}
        ${_("Custody epoch",e.custodyEpoch)}
        ${_("Visibility",e.visibility)}
        ${_("Recent change",e.recentChange)}
        ${_("Review action",e.reviewAction)}
      </div>
    </section>
  `:""}function _(e,r){return`
    <article class="owner-snapshot-field">
      <span>${s(e)}</span>
      <strong>${s(r)}</strong>
    </article>
  `}function oe(e){if(!e.transferPreview)return"";const r=e.transferPreview;return`
    <section class="transfer-preview">
      <div class="transfer-copy">
        <p class="card-label">${s(r.title)}</p>
        <h3>${s(r.claimAction)}</h3>
        <p>${s(r.note)}</p>
      </div>
      <div class="transfer-steps">
        ${p("Current owner",r.currentOwner)}
        ${p("Custody epoch",r.custodyEpoch)}
        ${p("Permissions",r.permissionsState)}
        ${p("Tools",r.toolAction)}
        ${p("Private access",r.privateAccessAction)}
        ${p("History",r.historyState)}
        ${p("Cred",r.credContinuity)}
      </div>
    </section>
  `}function p(e,r){return`
    <article class="transfer-step">
      <span>${s(e)}</span>
      <strong>${s(r)}</strong>
    </article>
  `}function le(e,r){return`
    <article class="story">
      <span class="story-num">${String(r+1).padStart(2,"0")}</span>
      <p class="card-label">${s(e.label)}</p>
      <h3>${s(e.title)}</h3>
      <p>${s(e.body)}</p>
    </article>
  `}function de(e){return`
    <article class="clarity-card">
      <h3>${s(e.title)}</h3>
      <p>${s(e.body)}</p>
    </article>
  `}function ce(e){return`
    <section class="fragment-map">
      <div class="fragment-map-head">
        <p class="eyebrow">${s(e.eyebrow)}</p>
        <h2>${s(e.title)}</h2>
        <p>${s(e.body)}</p>
      </div>
      <div class="fragment-cards">
        ${e.cards.map(pe).join("")}
      </div>
      <details class="fragment-legend">
        <summary>Proof vocabulary</summary>
        ${y("Fragment type legend",e.legends.fragmentType)}
        ${y("Status legend",e.legends.status)}
        ${y("Visibility legend",e.legends.visibility)}
        ${y("Assurance legend",e.legends.assurance)}
        ${y("Transfer policy",e.legends.transferPolicy)}
      </details>
      <p class="fragment-note">${s(e.emptyPrivateNote)}</p>
    </section>
  `}function pe(e){return`
    <article class="fragment-card">
      <div class="fragment-card-top">
        <span class="fragment-type">${s(e.typeLabel)}</span>
        <span class="fragment-status status-${s(e.status)}">${s(e.status)}</span>
      </div>
      <h3>${s(e.title)}</h3>
      <p>${s(e.summary)}</p>
      <dl>
        <div><dt>Assurance</dt><dd>${s(e.assuranceLabel)}</dd></div>
        <div><dt>Visibility</dt><dd>${s(e.visibility)}</dd></div>
        <div><dt>Transfer</dt><dd>${s(e.transferPolicyLabel)}</dd></div>
      </dl>
      <p class="fragment-value">${s(e.publicValue)}</p>
    </article>
  `}function y(e,r){return`
    <article>
      <h3>${s(e)}</h3>
      ${Object.entries(r).map(([i,t])=>`
        <div class="legend-row">
          <strong>${s(i)}</strong>
          <span>${s(t)}</span>
        </div>
      `).join("")}
    </article>
  `}function ue(e,r,i){const t=i===r;return`
    <article class="ledger-entry">
      <div class="ledger-row">
        <div class="doc">${s(e.title)}</div>
        <div class="badge ${_e(e)}">${s(e.status)}</div>
        <div class="summary">
          <span>${s(e.summary)}</span>
          <span class="why">${s(e.why)}</span>
        </div>
        <button data-action="toggle-json" data-index="${r}" aria-expanded="${t}" aria-controls="proof-json-${r}">${t?"Hide JSON":"Show JSON"}</button>
      </div>
      ${t?`<pre id="proof-json-${r}" class="json-panel">${s(JSON.stringify(e.json,null,2))}</pre>`:""}
    </article>
  `}function _e(e){return["settled","passed","filtered"].includes(String(e.status).toLowerCase())?"verified":"neutral"}function s(e){return String(e).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;")}K({root:document.querySelector("#app")}).start();
