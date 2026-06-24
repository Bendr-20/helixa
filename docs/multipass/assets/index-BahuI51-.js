(function(){const r=document.createElement("link").relList;if(r&&r.supports&&r.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))t(s);new MutationObserver(s=>{for(const n of s)if(n.type==="childList")for(const l of n.addedNodes)l.tagName==="LINK"&&l.rel==="modulepreload"&&t(l)}).observe(document,{childList:!0,subtree:!0});function a(s){const n={};return s.integrity&&(n.integrity=s.integrity),s.referrerPolicy&&(n.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?n.credentials="include":s.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function t(s){if(s.ep)return;s.ep=!0;const n=a(s);fetch(s.href,n)}})();const S={modeLabel:"Static Demo",sourceLabel:"bundled fixture",profile:{schema_version:"0.1.0",multipass_id:"mp_bendr_2",subject_type:"agent",display_name:"Bendr 2.0",slug:"bendr-2",status:"link_ready",owner_summary:{owner_state:"unclaimed",verification_status:"none",visibility:"public",summary:"Demo ownership state for public static preview."},custody_epoch:null,public_fragments:[{fragment_id:"frag_bendr_profile",fragment_type:"attestation",status:"verified",assurance_level:"platform_verified",visibility:"public",updated_at:"2026-06-24T00:00:00Z"},{fragment_id:"frag_bendr_endpoint",fragment_type:"endpoint",status:"pending",assurance_level:"self_attested",visibility:"public",updated_at:"2026-06-24T00:00:00Z"},{fragment_id:"frag_bendr_standard_ref",fragment_type:"standard_ref",status:"stale",assurance_level:"issuer_attested",visibility:"public",updated_at:"2026-06-24T00:00:00Z"},{fragment_id:"frag_bendr_receipt_history",fragment_type:"receipt",status:"historical",assurance_level:"issuer_attested",visibility:"public",updated_at:"2026-06-24T00:00:00Z"},{fragment_id:"frag_bendr_route_dispute",fragment_type:"verification_result",status:"disputed",assurance_level:"unverified",visibility:"public",updated_at:"2026-06-24T00:00:00Z"},{fragment_id:"frag_bendr_helixa_identity",fragment_type:"attestation",status:"verified",assurance_level:"onchain_verified",visibility:"public",updated_at:"2026-06-24T22:49:52Z"},{fragment_id:"frag_bendr_cred_score",fragment_type:"risk_summary",status:"verified",assurance_level:"platform_verified",visibility:"public",updated_at:"2026-06-24T22:49:52Z"},{fragment_id:"frag_bendr_social_x",fragment_type:"social",status:"verified",assurance_level:"platform_verified",visibility:"public",updated_at:"2026-06-24T22:49:52Z"}],cred_summary:{trust_state:"established",attestation_count:4,receipt_count:1,last_updated_at:"2026-06-24T22:49:52Z",public_note:"Cred score 80 imported from Helixa API. Cred is a signal, not something bought or raised by payment."},discovery_profile:{summary:"Bendr 2.0 is the Helixa lead agent with AgentDNA token #1, imported Cred context, public routes, and machine-readable Multipass records.",tags:["bendr","helixa","multipass"],avatar_url:null,visibility:"public"},standards_profile:{standards_profile_id:"sp_bendr_2",supported_standard_ids:["ERC-8004","ERC-8217","ERC-8126","ERC-8257","ERC-8183"],last_verified_at:null},payment_profile:{accepted_assets:[{asset:"CRED",chain_id:8453}],x402_manifest_url:"/multipass/static/x402-manifest.json",paid_endpoints_enabled:!1},updated_at:"2026-06-24T22:49:52Z"},fragments:{subject_id:"bendr-2",fragments:[{schema_version:"0.1.0",fragment_id:"frag_bendr_profile",multipass_id:"mp_bendr_2",fragment_type:"attestation",status:"verified",assurance_level:"platform_verified",visibility:"public",transfer_policy:"historical_on_transfer",source:{source_type:"platform_check",source_id:"bendr_profile",issuer:"Helixa",observed_at:"2026-06-24T00:00:00Z",reference_url:null},public_value:"Bendr 2.0 profile claim checked by the Helixa fixture.",proof_reference:"fixture:profile-check",created_at:"2026-06-24T00:00:00Z",updated_at:"2026-06-24T00:00:00Z",verified_at:"2026-06-24T00:00:00Z"},{schema_version:"0.1.0",fragment_id:"frag_bendr_endpoint",multipass_id:"mp_bendr_2",fragment_type:"endpoint",status:"pending",assurance_level:"self_attested",visibility:"public",transfer_policy:"reverify_on_transfer",source:{source_type:"owner_submission",source_id:"bendr_endpoint",issuer:null,observed_at:"2026-06-24T00:00:00Z",reference_url:null},public_value:"Bendr local API endpoint awaiting live verification.",proof_reference:null,created_at:"2026-06-24T00:00:00Z",updated_at:"2026-06-24T00:00:00Z",endpoint_ref:{endpoint_id:"lookup",url:"/multipass/",protocol:"api",manifest_url:"/multipass/static/x402-manifest.json"}},{schema_version:"0.1.0",fragment_id:"frag_bendr_standard_ref",multipass_id:"mp_bendr_2",fragment_type:"standard_ref",status:"stale",assurance_level:"issuer_attested",visibility:"public",transfer_policy:"pause_on_transfer",source:{source_type:"issuer_attestation",source_id:"bendr_standard",issuer:"Helixa",observed_at:"2026-06-24T00:00:00Z",reference_url:null},public_value:"ERC-8004 adapter reference that needs a fresh check before stronger claims.",proof_reference:"fixture:standard-ref",created_at:"2026-06-24T00:00:00Z",updated_at:"2026-06-24T00:00:00Z",verified_at:"2026-06-24T00:00:00Z",expires_at:"2026-06-25T00:00:00Z"},{schema_version:"0.1.0",fragment_id:"frag_bendr_receipt_history",multipass_id:"mp_bendr_2",fragment_type:"receipt",status:"historical",assurance_level:"issuer_attested",visibility:"public",transfer_policy:"historical_on_transfer",source:{source_type:"payment_receipt",source_id:"bendr_receipt",issuer:"Helixa",observed_at:"2026-06-24T00:00:00Z",reference_url:null},public_value:"Receipt evidence retained as history; it does not create trust by itself.",proof_reference:"receipt_bendr_lookup",created_at:"2026-06-24T00:00:00Z",updated_at:"2026-06-24T00:00:00Z"},{schema_version:"0.1.0",fragment_id:"frag_bendr_route_dispute",multipass_id:"mp_bendr_2",fragment_type:"verification_result",status:"disputed",assurance_level:"unverified",visibility:"public",transfer_policy:"never_transfer",source:{source_type:"platform_check",source_id:"bendr_route_dispute",issuer:"Helixa",observed_at:"2026-06-24T00:00:00Z",reference_url:null},public_value:"Route claim intentionally marked disputed in the fixture.",proof_reference:"fixture:route-dispute",created_at:"2026-06-24T00:00:00Z",updated_at:"2026-06-24T00:00:00Z",verification_ref:{verification_type:"route_review",result:"inconclusive",issuer:"Helixa",risk_level:"medium",score:null}},{schema_version:"0.1.0",fragment_id:"frag_bendr_helixa_identity",multipass_id:"mp_bendr_2",fragment_type:"attestation",status:"verified",assurance_level:"onchain_verified",visibility:"public",transfer_policy:"historical_on_transfer",source:{source_type:"contract_read",source_id:"helixa_agentdna_1",issuer:"Helixa",observed_at:"2026-06-24T22:49:52Z",reference_url:"https://api.helixa.xyz/api/v2/agent/1"},public_value:"Helixa AgentDNA token #1 on Base, contract 0x2e3B541C59D38b84E3Bc54e977200230A204Fe60.",proof_reference:"base:8453:0x2e3B541C59D38b84E3Bc54e977200230A204Fe60:1",created_at:"2026-06-24T22:49:52Z",updated_at:"2026-06-24T22:49:52Z",verified_at:"2026-06-24T22:49:52Z"},{schema_version:"0.1.0",fragment_id:"frag_bendr_cred_score",multipass_id:"mp_bendr_2",fragment_type:"risk_summary",status:"verified",assurance_level:"platform_verified",visibility:"public",transfer_policy:"reverify_on_transfer",source:{source_type:"registry_import",source_id:"helixa_cred_score_1",issuer:"Helixa",observed_at:"2026-06-24T22:49:52Z",reference_url:"https://api.helixa.xyz/api/v2/agent/1"},public_value:"Cred score 80, Preferred tier, imported from Helixa API.",proof_reference:"helixa-api:agent:1:credScore",created_at:"2026-06-24T22:49:52Z",updated_at:"2026-06-24T22:49:52Z",verified_at:"2026-06-24T22:49:52Z",verification_ref:{verification_type:"cred_import",result:"passed",issuer:"Helixa",risk_level:"low",score:80}},{schema_version:"0.1.0",fragment_id:"frag_bendr_social_x",multipass_id:"mp_bendr_2",fragment_type:"social",status:"verified",assurance_level:"platform_verified",visibility:"public",transfer_policy:"reverify_on_transfer",source:{source_type:"platform_check",source_id:"bendr_x_handle",issuer:"Helixa",observed_at:"2026-06-24T22:49:52Z",reference_url:"https://api.helixa.xyz/api/v2/agent/1"},public_value:"X handle @BendrAI_eth imported from Helixa API.",proof_reference:"helixa-api:agent:1:socials.x",created_at:"2026-06-24T22:49:52Z",updated_at:"2026-06-24T22:49:52Z",verified_at:"2026-06-24T22:49:52Z"},{schema_version:"0.1.0",fragment_id:"frag_quigbot_identity",multipass_id:"mp_quigbot",fragment_type:"attestation",status:"verified",assurance_level:"platform_verified",visibility:"public",transfer_policy:"historical_on_transfer",source:{source_type:"platform_check",source_id:"quigbot_identity",issuer:"Helixa",observed_at:"2026-06-24T23:50:00Z",reference_url:"https://helixa.xyz/agent/81"},public_value:"Quigbot identity checked by the Helixa fixture.",proof_reference:"fixture:quigbot-identity",created_at:"2026-06-24T23:50:00Z",updated_at:"2026-06-24T23:50:00Z",verified_at:"2026-06-24T23:50:00Z"},{schema_version:"0.1.0",fragment_id:"frag_quigbot_cred",multipass_id:"mp_quigbot",fragment_type:"risk_summary",status:"verified",assurance_level:"platform_verified",visibility:"public",transfer_policy:"reverify_on_transfer",source:{source_type:"registry_import",source_id:"quigbot_cred",issuer:"Helixa",observed_at:"2026-06-24T23:50:00Z",reference_url:"https://helixa.xyz/agent/81"},public_value:"Quigbot Cred score 75, Prime tier.",proof_reference:"fixture:quigbot-cred",created_at:"2026-06-24T23:50:00Z",updated_at:"2026-06-24T23:50:00Z",verified_at:"2026-06-24T23:50:00Z"},{schema_version:"0.1.0",fragment_id:"frag_e2etest_identity",multipass_id:"mp_e2etest",fragment_type:"attestation",status:"pending",assurance_level:"self_attested",visibility:"public",transfer_policy:"reverify_on_transfer",source:{source_type:"owner_submission",source_id:"e2etest_identity",issuer:"Helixa",observed_at:"2026-06-24T23:50:00Z",reference_url:"https://helixa.xyz/agent/0"},public_value:"E2ETest is a low-assurance test record.",proof_reference:"fixture:e2etest-identity",created_at:"2026-06-24T23:50:00Z",updated_at:"2026-06-24T23:50:00Z"},{schema_version:"0.1.0",fragment_id:"frag_e2etest_cred",multipass_id:"mp_e2etest",fragment_type:"risk_summary",status:"disputed",assurance_level:"unverified",visibility:"public",transfer_policy:"never_transfer",source:{source_type:"platform_check",source_id:"e2etest_cred",issuer:"Helixa",observed_at:"2026-06-24T23:50:00Z",reference_url:"https://helixa.xyz/agent/0"},public_value:"Lower trust context for a test/demo agent.",proof_reference:"fixture:e2etest-cred",created_at:"2026-06-24T23:50:00Z",updated_at:"2026-06-24T23:50:00Z"},{schema_version:"0.1.0",fragment_id:"frag_helixa_swarm_roster",multipass_id:"mp_helixa_swarm",fragment_type:"custody_record",status:"verified",assurance_level:"platform_verified",visibility:"public",transfer_policy:"pause_on_transfer",source:{source_type:"platform_check",source_id:"helixa_swarm_roster",issuer:"Helixa",observed_at:"2026-06-24T23:38:00Z",reference_url:"https://helixa.xyz/multipass/"},public_value:"Parent Multipass manages Bendr, Quigbot, and E2ETest demo agents as one collection roster.",proof_reference:"fixture:helixa-swarm-roster",created_at:"2026-06-24T23:38:00Z",updated_at:"2026-06-24T23:38:00Z",verified_at:"2026-06-24T23:38:00Z"},{schema_version:"0.1.0",fragment_id:"frag_helixa_swarm_tools",multipass_id:"mp_helixa_swarm",fragment_type:"endpoint",status:"pending",assurance_level:"self_attested",visibility:"public",transfer_policy:"pause_on_transfer",source:{source_type:"owner_submission",source_id:"helixa_swarm_tools",issuer:"Helixa",observed_at:"2026-06-24T23:38:00Z",reference_url:"https://helixa.xyz/multipass/"},public_value:"Shared tool policy preview for routes, permissions, and approvals across the swarm.",proof_reference:"fixture:helixa-swarm-tools",created_at:"2026-06-24T23:38:00Z",updated_at:"2026-06-24T23:38:00Z",endpoint_ref:{endpoint_id:"swarm_policy",url:"https://helixa.xyz/multipass/",protocol:"api",manifest_url:"/multipass/static/x402-manifest.json"}},{schema_version:"0.1.0",fragment_id:"frag_helixa_swarm_cred",multipass_id:"mp_helixa_swarm",fragment_type:"risk_summary",status:"verified",assurance_level:"platform_verified",visibility:"public",transfer_policy:"reverify_on_transfer",source:{source_type:"registry_import",source_id:"helixa_swarm_cred",issuer:"Helixa",observed_at:"2026-06-24T23:38:00Z",reference_url:"https://helixa.xyz/multipass/"},public_value:"Aggregate Cred context summarizes the roster without erasing each agent's individual profile.",proof_reference:"fixture:helixa-swarm-cred",created_at:"2026-06-24T23:38:00Z",updated_at:"2026-06-24T23:38:00Z",verified_at:"2026-06-24T23:38:00Z",verification_ref:{verification_type:"swarm_cred_summary",result:"passed",issuer:"Helixa",risk_level:"medium",score:78}}]},card:{schema_version:"0.1.0",multipass_id:"mp_bendr_2",name:"Bendr 2.0",subject_type:"agent",capabilities:[{capability_id:"profile_lookup",label:"Profile lookup",description:"Read public Multipass profile data from the static preview.",visibility:"public"},{capability_id:"agent_card_resolution",label:"Agent card resolution",description:"Resolve compact agent card fields for discovery and trust checks.",visibility:"public"}],message_routes:[{route_id:"web_profile",channel:"api",address:"https://helixa.xyz/agent/1",visibility:"public"},{route_id:"telegram",channel:"chat",address:"@bendr2bot",visibility:"public"}],service_endpoints:[{endpoint_id:"helixa_profile",url:"https://api.helixa.xyz/api/v2/agent/1",description:"Public Helixa AgentDNA profile for Bendr 2.0.",visibility:"public"},{endpoint_id:"multipass_preview",url:"https://helixa.xyz/multipass/",description:"Hidden Multipass prototype preview.",visibility:"public"}],x402_manifest_url:"/multipass/static/x402-manifest.json",accepted_assets:[{asset:"CRED",chain_id:8453}],trust_summary:{identity_status:"verified",assurance_level:"onchain_verified",last_updated_at:"2026-06-24T22:49:52Z"},rate_limits:{requests:60,window_seconds:60,burst:10},contact_policy:{mode:"approval_required",requires_owner_approval:!0,policy_note:"Static demo only."},standards_refs:[{standard_id:"ERC-8004",support_status:"adapter_ready",record_id:null},{standard_id:"ERC-8217",support_status:"pending",record_id:null}]},standards:{schema_version:"0.1.0",standards_profile_id:"sp_bendr_2",multipass_id:"mp_bendr_2",primary_refs:{erc8004_identity:null,controller_asset:null,x402_manifest:"mp_bendr_2:x402"},standard_refs:[{standard_id:"ERC-8004",status:"adapter_ready",chain_id:8453,contract_address:null,record_id:null,adapter_version:"0.1.0",last_verified_at:null,assurance_level:"unverified"},{standard_id:"ERC-8217",status:"pending",chain_id:8453,contract_address:null,record_id:null,adapter_version:"0.1.0",last_verified_at:null,assurance_level:"unverified"},{standard_id:"ERC-8257",status:"pending",chain_id:null,contract_address:null,record_id:null,adapter_version:"0.1.0",last_verified_at:null,assurance_level:"unverified"}],compatibility_summary:{identity_bound:!1,owner_verified:!1,risk_checked:!1,tools_verified:!1,work_attested:!1,trust_updated:!1},adapter_versions:{"ERC-8004":"0.1.0","ERC-8217":"0.1.0","ERC-8257":"0.1.0"},last_verified_at:null},x402:{schema_version:"0.1.0",multipass_id:"mp_bendr_2",endpoints:[{endpoint_id:"lookup",url:"/multipass/",method:"GET",description:"Sample CRED-gated profile lookup route for public static preview.",price:{amount:"1",decimals:18},asset:"CRED",chain_id:8453,provider:"bankr_x402_cloud",settlement_reference_policy:"provider_receipt",rate_limit:{requests:10,window_seconds:60,burst:2},visibility:"public",requires_owner_approval:!1}]},receipt:{schema_version:"0.1.0",receipt_id:"receipt_bendr_lookup",multipass_id:"mp_bendr_2",endpoint_id:"lookup",provider:"bankr_x402_cloud",amount:"1",asset:"CRED",chain_id:8453,status:"settled",created_at:"2026-06-24T00:00:00Z",response_class:"success",settlement_reference:null,redaction_note:"Sample public static receipt. No private request or response payload is included."},routes:{},agentCards:[{name:"Bendr 2.0",tokenId:1,helixaId:"8453:1",framework:"openclaw",credScore:80,credTier:"Preferred",verified:!0,profileUrl:"https://helixa.xyz/agent/1",proofFragmentIds:["frag_bendr_profile","frag_bendr_endpoint","frag_bendr_standard_ref","frag_bendr_receipt_history","frag_bendr_route_dispute","frag_bendr_helixa_identity","frag_bendr_cred_score"]},{name:"Quigbot",tokenId:81,helixaId:"8453:81",framework:"openclaw",credScore:75,credTier:"Prime",verified:!0,profileUrl:"https://helixa.xyz/agent/81",proofFragmentIds:["frag_quigbot_identity","frag_quigbot_cred"]},{name:"E2ETest",tokenId:0,helixaId:"8453:0",framework:"openclaw",credScore:41,credTier:"Marginal",verified:!1,profileUrl:"https://helixa.xyz/agent/0",proofFragmentIds:["frag_e2etest_identity","frag_e2etest_cred"]},{name:"Helixa Swarm",tokenId:"swarm:helixa",helixaId:"8453:swarm:helixa",framework:"multi-agent",credScore:78,credTier:"Prime",verified:!0,profileUrl:"https://helixa.xyz/swarm/helixa",subjectType:"swarm",members:3,role:"Parent Multipass",custody:"Custody epoch ready",proofFragmentIds:["frag_helixa_swarm_roster","frag_helixa_swarm_tools","frag_helixa_swarm_cred"],roster:[{name:"Bendr 2.0",role:"Lead agent"},{name:"Quigbot",role:"Product agent"},{name:"E2ETest",role:"Test agent"}],sharedControls:["Tool approvals","Route policy","Owner approval"],aggregateCred:"Cred 78 Prime summarizes the roster without replacing individual agent scores.",transferBehavior:"Permissions pause and tool routes reverify when custody changes."}]},x="/multipass-api";function P(e){const r=T(e);return r?C(r.toString()):x}function T(e){const r=e.searchParams.get("api");if(!r)return null;try{const a=new URL(r);return["http:","https:"].includes(a.protocol)?a:null}catch{return null}}function Z(e,r){const t=`${C(e||x)}/api/multipass/${encodeURIComponent(r.slug)}`;return{profile:t,fragments:`${t}/fragments`,card:`${t}/agent-card`,standards:`${t}/standards`,x402:`${t}/x402`,receipt:`${t}/receipts/${encodeURIComponent(r.receiptId)}`}}async function u(e,r=fetch){const a=await r(e);if(!a.ok)throw new Error(`GET ${e} failed with ${a.status}`);const t=await a.text();try{return JSON.parse(t)}catch(s){throw new Error(`API returned invalid JSON for ${e}: ${s.message}`)}}async function E({apiBase:e=x,subject:r,fetchImpl:a=fetch}){const t=Z(e,r),[s,n,l,g,b,d]=await Promise.all([u(t.profile,a),u(t.fragments,a),u(t.card,a),u(t.standards,a),u(t.x402,a),u(t.receipt,a)]);return{profile:s,fragments:n,card:l,standards:g,x402:b,receipt:d,routes:t,modeLabel:"Local API Demo",sourceLabel:"local API"}}function L(e){const r=e.pathname;return(r==="/multipass"||r.startsWith("/multipass/"))&&!T(e)}async function R(){return structuredClone(S)}function C(e){return e.endsWith("/")?e.slice(0,-1):e}const v={slug:"bendr-2",receiptId:"receipt_bendr_lookup"},$={prototypeLabel:"Internal Prototype",audience:"Built first for agent builders, agent teams, and marketplaces that need a fast trust read."},h={title:"Inspect proof",eyebrow:"PROOF LAYER",body:"Open the proof when a card needs verification. Each signal keeps its own visibility, source, assurance level, and transfer rule."},m={fragmentType:{endpoint:"Endpoint fragments describe routes, protocols, manifests, and access surfaces an agent may expose.",attestation:"Attestation fragments describe claims or checks from an owner, platform, issuer, or verifier.",receipt:"Receipt fragments describe access or payment evidence without making that evidence trust by itself.",standard_ref:"Standard reference fragments connect the profile to external standards without implying every adapter is live.",verification_result:"Verification result fragments record review outcomes, risk context, or disputed checks.",custody_record:"Custody record fragments describe owner or controller epochs without transferring private authority.",risk_summary:"Risk summary fragments carry imported Cred or safety context without collapsing identity into a single score.",social:"Social fragments connect public handles to an agent profile through a named source or verification path."},visibility:{public:"Visible to anyone and safe for profile cards, indexers, and partner systems.",gated:"Released only after token, payment, relationship, or allowlist policy is satisfied.",private:"Visible only to approved owners, operators, or internal systems with a clear need.",hidden:"Not discoverable through public or gated surfaces, reserved for safety or integrity review."},status:{verified:"Checked by a platform, issuer, contract read, or other explicit verification path.",pending:"Submitted or referenced, but still waiting for review or a stronger proof source.",stale:"Previously useful, but old enough that builders should request a fresh check.",historical:"Kept as provenance or prior evidence, not treated as active authority.",disputed:"Flagged for review because the claim, source, or interpretation is contested."},assurance:{unverified:"Unverified means the fragment has no stronger source than a raw claim or placeholder.",self_attested:"Self attested means the owner or agent supplied the claim without outside verification.",platform_verified:"Platform verified means Helixa or another platform checked the fragment through a defined process.",cryptographic:"Cryptographic means the fragment is backed by a signature, hash, or comparable cryptographic proof.",issuer_attested:"Issuer attested means a named issuer supplied or signed the supporting evidence.",onchain_verified:"Onchain verified means the fragment was checked against a chain record or contract read."},transferPolicy:{reverify_on_transfer:"Reverify on transfer means a new owner must confirm the fragment before it is treated as current.",pause_on_transfer:"Pause on transfer means active authority should stop until the new owner or operator approves it.",historical_on_transfer:"Historical on transfer means provenance stays visible, but it does not grant active authority.",never_transfer:"Never transfer means the fragment is bound to the prior controller or context and must not move."}};function I(e){const r={name:e.profile.display_name,tokenId:e.profile.slug??e.profile.multipass_id,helixaId:e.profile.slug??e.profile.multipass_id,framework:"unknown",credScore:null,credTier:e.profile.cred_summary?.trust_state??"none",verified:e.card.trust_summary?.identity_status==="verified",profileUrl:null};return{eyebrow:"AGENT CARD CAROUSEL",title:"Agent cards that lead with trust.",body:"Each card gives agents, swarms, apps, and marketplaces a quick read on identity, Cred, framework, and profile route. The deeper proof sits below for verification, not first impression.",cards:(e.agentCards?.length?e.agentCards:[r]).map(t=>({name:t.name,tokenId:t.tokenId,helixaId:t.helixaId??String(t.tokenId??t.name),framework:t.framework??"unknown",credScore:t.credScore??null,credTier:t.credTier??"Unrated",credLabel:t.credScore===null||t.credScore===void 0?"Cred pending":`Cred ${t.credScore}`,verified:!!t.verified,verifiedLabel:t.verified?"verified":"unverified",profileUrl:t.profileUrl??null,subjectLabel:t.subjectType??"agent",memberLabel:D(t.members),role:t.role??"Agent Multipass",custody:t.custody??"Owner verified",detailMode:t.subjectType==="swarm"?"swarm":"agent",roster:Array.isArray(t.roster)?t.roster.map(s=>({name:s.name,role:s.role??"Member agent"})):[],sharedControls:Array.isArray(t.sharedControls)?t.sharedControls:[],aggregateCred:t.aggregateCred??null,transferBehavior:t.transferBehavior??null,proofFragmentIds:Array.isArray(t.proofFragmentIds)?t.proofFragmentIds:[]}))}}function j(e,r=null){const a=k(e.fragments,r);return{title:h.title,eyebrow:h.eyebrow,body:h.body,cards:a.map(H),legends:m,emptyPrivateNote:"Private and hidden fragments are not rendered in this public prototype."}}function H(e){const r=y(e.fragment_type),a=e.endpoint_ref?.protocol?`${e.endpoint_ref.protocol} `:"",t=e.source?.source_type?y(e.source.source_type):"Unknown source",s=e.source?.issuer?` by ${e.source.issuer}`:"";return{id:e.fragment_id,title:F(e),type:e.fragment_type,typeLabel:r,status:e.status,statusExplanation:m.status[e.status]??"Status explanation unavailable.",assurance:e.assurance_level,assuranceLabel:y(e.assurance_level),assuranceExplanation:m.assurance[e.assurance_level]??"Assurance explanation unavailable.",visibility:e.visibility,visibilityExplanation:m.visibility[e.visibility]??"Visibility explanation unavailable.",transferPolicy:e.transfer_policy,transferPolicyLabel:y(e.transfer_policy),transferPolicyExplanation:m.transferPolicy[e.transfer_policy]??"Transfer policy explanation unavailable.",summary:e.endpoint_ref?`${r} for ${a}endpoint from ${t}${s}.`:`${r} from ${t}${s}.`,publicValue:e.public_value??"No public value returned."}}function D(e){return e==null?"1 agent":`${e} ${Number(e)===1?"agent":"agents"}`}function F(e){const r={frag_bendr_profile:"Bendr profile check",frag_bendr_endpoint:"Bendr API route",frag_bendr_standard_ref:"Standards reference",frag_bendr_receipt_history:"Receipt history",frag_bendr_route_dispute:"Route review flag",frag_bendr_helixa_identity:"Helixa AgentDNA identity",frag_bendr_cred_score:"Cred score import",frag_bendr_social_x:"Social handle check",frag_quigbot_identity:"Quigbot identity",frag_quigbot_cred:"Quigbot Cred context",frag_e2etest_identity:"E2ETest test identity",frag_e2etest_cred:"Lower trust context",frag_helixa_swarm_roster:"Swarm roster",frag_helixa_swarm_tools:"Shared tool policy",frag_helixa_swarm_cred:"Aggregate Cred context"};return r[e.fragment_id]?r[e.fragment_id]:y(e.fragment_type)}function y(e){const r=String(e??"unknown").split("_").filter(Boolean);return r.length===0?"Unknown":[r[0].charAt(0).toUpperCase()+r[0].slice(1),...r.slice(1)].join(" ")}const p={eyebrow:"MULTIPASS RECORD",headline:"The identity layer for agents, swarms, and the apps that need to read them.",body:"Multipass gives every agent a compact card and a machine-readable trust profile: identity, Cred, routes, standards, and receipts in one portable proof layer.",note:"Hidden prototype using Bendr 2.0 public fixture data."};function M(){return[{title:"What is Multipass?",body:"Multipass is a portable identity and trust profile for agents, swarms, apps, and marketplaces that need to decide who they are dealing with."},{title:"What the card shows",body:"The card gives the fast read: name, Helixa ID, Cred context, verified status, framework, and profile route."},{title:"What proof adds",body:"Proof records explain where the card comes from without making raw protocol details the first thing people see."}]}function B(e){return`${e.display_name} is a ${e.subject_type} profile with status ${e.status} and trust state ${e.cred_summary?.trust_state??"none"}.`}function O(e){const r=A(e.fragments);return[{title:"Card first",label:"Fast read",body:"Name, Helixa ID, Cred, framework, and profile route should be understandable at a glance."},{title:"Proof below",label:`${r.length} public fragments`,body:"Fragments explain why the card should be trusted without dumping raw protocol detail up front."},{title:"Portable by design",label:`${e.x402.endpoints.length} x402 endpoint`,body:"Apps can read the same agent profile across discovery, access, settlement, and custody flows."}]}function q(e,r=null){const a=k(e.fragments,r),t=N(e.fragments,a);return[{title:"Profile",status:e.profile.status,summary:B(e.profile),why:"The profile is the canonical summary agents, apps, and builders can resolve first.",json:c(e.profile)},{title:"Public Fragments",status:`${a.length} public`,summary:a.length?`${a.length} readable proof signals for ${r?.name??e.profile.display_name}.`:`No public fragments returned for ${r?.name??e.profile.display_name}.`,why:"Fragments show the public pieces that support the profile without exposing private records.",json:t},{title:"Agent Card",status:`${e.card.capabilities.length} capabilities`,summary:`${e.card.service_endpoints.length} service endpoint records available.`,why:"The agent card gives machines a compact view of capabilities, routes, endpoints, and trust context.",json:c(e.card)},{title:"Standards",status:`${e.standards.standard_refs.length} refs`,summary:U(e.standards.standard_refs),why:"Standards references show compatibility targets and adapter state without claiming every adapter is live.",json:c(e.standards)},{title:"x402",status:`${e.x402.endpoints.length} endpoints`,summary:e.x402.endpoints.map(s=>`${s.endpoint_id} accepts ${s.asset}`).join(", ")||"No endpoints returned.",why:"x402 metadata explains planned access rails and accepted assets without implying live settlement here.",json:c(e.x402)},{title:"Receipt",status:e.receipt.status,summary:`${e.receipt.receipt_id} records a ${e.receipt.response_class??"unknown"} response.`,why:"Receipt evidence records that an access event can be attached to the profile without becoming trust by itself.",json:c(e.receipt)}]}function N(e,r){const a={fragments:c(r)};for(const t of["multipass_id","profile_id","subject_id","schema_version"])e[t]!==void 0&&(a[t]=e[t]);return a}function c(e){if(Array.isArray(e))return e.map(r=>c(r)).filter(r=>r!==void 0);if(!e||typeof e!="object")return e;if(e.visibility!=="private")return Object.fromEntries(Object.entries(e).filter(([r])=>!z(r)).map(([r,a])=>[r,c(a)]).filter(([,r])=>r!==void 0))}function z(e){const r=e.toLowerCase();return r.startsWith("private")||r.includes("_private")}function k(e,r){const a=A(e),t=r?.proofFragmentIds;if(!Array.isArray(t)||t.length===0)return a;const s=new Map(a.map(n=>[n.fragment_id,n]));return t.map(n=>s.get(n)).filter(Boolean)}function A(e){return(e.fragments??[]).filter(r=>r.visibility==="public")}function U(e){return e.map(r=>`${r.standard_id}: ${r.status}`).join(", ")||"No standard refs returned."}function V({root:e,loadDemo:r=J}){if(!e)throw new Error("createApp requires a root element");let a={expandedCard:null,selectedAgentCard:0};async function t(){Q(e);try{const s=await r();a={...a,data:s},w(e,a)}catch(s){G(e,s)}}return{start:t}}function J(){const e=new URL(window.location.href);return L(e)?R():E({apiBase:P(e),subject:v})}function Q(e){e.innerHTML=`
    <section class="record-shell loading-shell">
      <p class="eyebrow">${p.eyebrow}</p>
      <h1>Loading Bendr 2.0...</h1>
    </section>
  `}function G(e,r){e.innerHTML=`
    <section class="record-shell error-shell">
      <p class="eyebrow">${p.eyebrow}</p>
      <h1>Could not load Multipass API data.</h1>
      <p>Run <code>pnpm api:bendr</code> in the Multipass repo, then reload this page.</p>
      <pre class="json-panel">${i(r.message)}</pre>
    </section>
  `}function w(e,r){const{data:a}=r,t=O(a),s=M(),n=I(a),l=n.cards[r.selectedAgentCard]??n.cards[0],g=j(a,l),b=q(a,l);e.innerHTML=`
    <div class="record-shell">
      <header class="record-header">
        <div class="brand"><div class="mark" aria-hidden="true"></div><span>Multipass</span></div>
        <div class="header-meta"><span>Hidden Prototype</span><span>${i(a.modeLabel??"Local API Demo")}</span></div>
      </header>

      <section class="hero-record">
        <div>
          <p class="eyebrow">${p.eyebrow}</p>
          <div class="prototype-ribbon">
            <span>${i($.prototypeLabel)}</span>
            <span>${i($.audience)}</span>
          </div>
          <h1>${p.headline}</h1>
          <p class="lead">${p.body}</p>
          <div class="note">${p.note}</div>
        </div>

        <article class="record-sheet">
          <div class="sheet-top">
            <div>
              <h2>${i(a.profile.display_name)}</h2>
              <p>Agent profile with public identity fragments, standards references, x402 route metadata, and receipt evidence.</p>
            </div>
            <div class="stamp">Public proof only</div>
          </div>
          <div class="field-grid">
            ${o("Record",a.profile.multipass_id??v.slug)}
            ${o("Subject",a.profile.subject_type)}
            ${o("Slug",a.profile.slug??v.slug)}
            ${o("Status",a.profile.status,"status")}
            ${o("Trust State",a.profile.cred_summary?.trust_state??"none")}
            ${o("Source",a.sourceLabel??"local API")}
            ${o("Receipt",a.receipt.receipt_id)}
          </div>
        </article>
      </section>

      ${W(n,l,r.selectedAgentCard)}

      <section class="story-records">${t.map(ee).join("")}</section>

      <section class="clarity-grid">${s.map(re).join("")}</section>

      ${te(g)}

      <section class="proof-ledger">
        <div class="ledger-title"><h2>Proof ledger</h2><span>Expandable API records</span></div>
        ${b.map((d,_)=>ie(d,_,r.expandedCard)).join("")}
      </section>

      <footer class="footer-note">This is a static public demo. It does not include auth, persistence, contract reads, or payment settlement.</footer>
    </div>
  `,e.querySelectorAll('[data-action="select-agent-card"]').forEach(d=>{d.addEventListener("click",()=>{r.selectedAgentCard=Number(d.dataset.index),w(e,r),e.querySelector(`[data-action="select-agent-card"][data-index="${r.selectedAgentCard}"]`)?.focus()})}),e.querySelectorAll('[data-action="toggle-json"]').forEach(d=>{d.addEventListener("click",()=>{const _=Number(d.dataset.index);r.expandedCard=r.expandedCard===_?null:_,w(e,r),e.querySelector(`[data-action="toggle-json"][data-index="${_}"]`)?.focus()})})}function o(e,r,a=""){const t=a?` ${a}`:"";return`
    <div class="field">
      <span>${i(e)}</span>
      <strong class="mono${t}">${i(r)}</strong>
    </div>
  `}function W(e,r,a){return`
    <section class="card-carousel">
      <div class="card-carousel-head">
        <p class="eyebrow">${i(e.eyebrow)}</p>
        <h2>${i(e.title)}</h2>
        <p>${i(e.body)}</p>
      </div>
      <div class="card-track" role="tablist" aria-label="Agent cards">
        ${e.cards.map((t,s)=>Y(t,s,a)).join("")}
      </div>
      ${K(r)}
    </section>
  `}function Y(e,r,a){const t=r===a;return`
    <button class="card-button${t?" selected":""}" data-action="select-agent-card" data-index="${r}" type="button" aria-selected="${t}">
      <span class="card-name">${i(e.name)}</span>
      <span>${i(e.helixaId)}</span>
      <span>${i(e.subjectLabel)} · ${i(e.memberLabel)}</span>
      <span>${i(e.role)}</span>
      <span>${i(e.custody)}</span>
      <strong>${i(e.credLabel)}</strong>
    </button>
  `}function K(e){return e.detailMode==="swarm"?X(e):`
    <article class="card-detail">
      <div>
        <p class="card-label">Selected agent card</p>
        <h3>${i(e.name)}</h3>
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
  `}function X(e){return`
    <article class="card-detail swarm-detail">
      <div>
        <p class="card-label">Swarm detail</p>
        <h3>${i(e.name)}</h3>
        <p>Parent Multipass for a collection of agents with shared routes, custody context, and proof that still preserves each member profile.</p>
      </div>
      <div class="swarm-panels">
        <section class="swarm-panel">
          <h4>Roster</h4>
          ${e.roster.map(r=>`
            <div class="swarm-row">
              <strong>${i(r.name)}</strong>
              <span>${i(r.role)}</span>
            </div>
          `).join("")}
        </section>
        <section class="swarm-panel">
          <h4>Shared controls</h4>
          ${e.sharedControls.map(r=>`<span class="control-chip">${i(r)}</span>`).join("")}
        </section>
        <section class="swarm-panel wide">
          <h4>Aggregate Cred</h4>
          <p>${i(e.aggregateCred??`${e.credLabel} (${e.credTier}) gives context only; member scores remain separate.`)}</p>
        </section>
        <section class="swarm-panel wide">
          <h4>Transfer behavior</h4>
          <p>${i(e.transferBehavior??"Permissions pause and active routes reverify when custody changes.")}</p>
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
  `}function ee(e,r){return`
    <article class="story">
      <span class="story-num">${String(r+1).padStart(2,"0")}</span>
      <p class="card-label">${i(e.label)}</p>
      <h3>${i(e.title)}</h3>
      <p>${i(e.body)}</p>
    </article>
  `}function re(e){return`
    <article class="clarity-card">
      <h3>${i(e.title)}</h3>
      <p>${i(e.body)}</p>
    </article>
  `}function te(e){return`
    <section class="fragment-map">
      <div class="fragment-map-head">
        <p class="eyebrow">${i(e.eyebrow)}</p>
        <h2>${i(e.title)}</h2>
        <p>${i(e.body)}</p>
      </div>
      <div class="fragment-cards">
        ${e.cards.map(ae).join("")}
      </div>
      <div class="fragment-legend">
        ${f("Fragment type legend",e.legends.fragmentType)}
        ${f("Status legend",e.legends.status)}
        ${f("Visibility legend",e.legends.visibility)}
        ${f("Assurance legend",e.legends.assurance)}
        ${f("Transfer policy",e.legends.transferPolicy)}
      </div>
      <p class="fragment-note">${i(e.emptyPrivateNote)}</p>
    </section>
  `}function ae(e){return`
    <article class="fragment-card">
      <div class="fragment-card-top">
        <span class="fragment-type">${i(e.typeLabel)}</span>
        <span class="fragment-status status-${i(e.status)}">${i(e.status)}</span>
      </div>
      <h3>${i(e.title)}</h3>
      <p>${i(e.summary)}</p>
      <dl>
        <div><dt>Assurance</dt><dd>${i(e.assuranceLabel)}</dd></div>
        <div><dt>Visibility</dt><dd>${i(e.visibility)}</dd></div>
        <div><dt>Transfer</dt><dd>${i(e.transferPolicyLabel)}</dd></div>
      </dl>
      <p class="fragment-value">${i(e.publicValue)}</p>
    </article>
  `}function f(e,r){return`
    <article>
      <h3>${i(e)}</h3>
      ${Object.entries(r).map(([a,t])=>`
        <div class="legend-row">
          <strong>${i(a)}</strong>
          <span>${i(t)}</span>
        </div>
      `).join("")}
    </article>
  `}function ie(e,r,a){const t=a===r;return`
    <article class="ledger-entry">
      <div class="ledger-row">
        <div class="doc">${i(e.title)}</div>
        <div class="badge ${se(e)}">${i(e.status)}</div>
        <div class="summary">
          <span>${i(e.summary)}</span>
          <span class="why">${i(e.why)}</span>
        </div>
        <button data-action="toggle-json" data-index="${r}" aria-expanded="${t}" aria-controls="proof-json-${r}">${t?"Hide JSON":"Show JSON"}</button>
      </div>
      ${t?`<pre id="proof-json-${r}" class="json-panel">${i(JSON.stringify(e.json,null,2))}</pre>`:""}
    </article>
  `}function se(e){return["settled","passed","filtered"].includes(String(e.status).toLowerCase())?"verified":"neutral"}function i(e){return String(e).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;")}V({root:document.querySelector("#app")}).start();
