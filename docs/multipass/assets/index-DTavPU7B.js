(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))r(s);new MutationObserver(s=>{for(const n of s)if(n.type==="childList")for(const c of n.addedNodes)c.tagName==="LINK"&&c.rel==="modulepreload"&&r(c)}).observe(document,{childList:!0,subtree:!0});function a(s){const n={};return s.integrity&&(n.integrity=s.integrity),s.referrerPolicy&&(n.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?n.credentials="include":s.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function r(s){if(s.ep)return;s.ep=!0;const n=a(s);fetch(s.href,n)}})();const A={modeLabel:"Static Demo",sourceLabel:"bundled fixture",profile:{schema_version:"0.1.0",multipass_id:"mp_bendr_2",subject_type:"agent",display_name:"Bendr 2.0",slug:"bendr-2",status:"link_ready",owner_summary:{owner_state:"unclaimed",verification_status:"none",visibility:"public",summary:"Demo ownership state for public static preview."},custody_epoch:null,public_fragments:[{fragment_id:"frag_bendr_profile",fragment_type:"attestation",status:"verified",assurance_level:"platform_verified",visibility:"public",updated_at:"2026-06-24T00:00:00Z"},{fragment_id:"frag_bendr_endpoint",fragment_type:"endpoint",status:"pending",assurance_level:"self_attested",visibility:"public",updated_at:"2026-06-24T00:00:00Z"},{fragment_id:"frag_bendr_standard_ref",fragment_type:"standard_ref",status:"stale",assurance_level:"issuer_attested",visibility:"public",updated_at:"2026-06-24T00:00:00Z"},{fragment_id:"frag_bendr_receipt_history",fragment_type:"receipt",status:"historical",assurance_level:"issuer_attested",visibility:"public",updated_at:"2026-06-24T00:00:00Z"},{fragment_id:"frag_bendr_route_dispute",fragment_type:"verification_result",status:"disputed",assurance_level:"unverified",visibility:"public",updated_at:"2026-06-24T00:00:00Z"},{fragment_id:"frag_bendr_helixa_identity",fragment_type:"attestation",status:"verified",assurance_level:"onchain_verified",visibility:"public",updated_at:"2026-06-24T22:49:52Z"},{fragment_id:"frag_bendr_cred_score",fragment_type:"risk_summary",status:"verified",assurance_level:"platform_verified",visibility:"public",updated_at:"2026-06-24T22:49:52Z"},{fragment_id:"frag_bendr_social_x",fragment_type:"social",status:"verified",assurance_level:"platform_verified",visibility:"public",updated_at:"2026-06-24T22:49:52Z"}],cred_summary:{trust_state:"established",attestation_count:4,receipt_count:1,last_updated_at:"2026-06-24T22:49:52Z",public_note:"Cred score 80 imported from Helixa API. Cred is a signal, not something bought or raised by payment."},discovery_profile:{summary:"Bendr 2.0 is the Helixa lead agent with AgentDNA token #1, imported Cred context, public routes, and machine-readable Multipass records.",tags:["bendr","helixa","multipass"],avatar_url:null,visibility:"public"},standards_profile:{standards_profile_id:"sp_bendr_2",supported_standard_ids:["ERC-8004","ERC-8217","ERC-8126","ERC-8257","ERC-8183"],last_verified_at:null},payment_profile:{accepted_assets:[{asset:"CRED",chain_id:8453}],x402_manifest_url:"/multipass/static/x402-manifest.json",paid_endpoints_enabled:!1},updated_at:"2026-06-24T22:49:52Z"},fragments:{subject_id:"bendr-2",fragments:[{schema_version:"0.1.0",fragment_id:"frag_bendr_profile",multipass_id:"mp_bendr_2",fragment_type:"attestation",status:"verified",assurance_level:"platform_verified",visibility:"public",transfer_policy:"historical_on_transfer",source:{source_type:"platform_check",source_id:"bendr_profile",issuer:"Helixa",observed_at:"2026-06-24T00:00:00Z",reference_url:null},public_value:"Bendr 2.0 profile claim checked by the Helixa fixture.",proof_reference:"fixture:profile-check",created_at:"2026-06-24T00:00:00Z",updated_at:"2026-06-24T00:00:00Z",verified_at:"2026-06-24T00:00:00Z"},{schema_version:"0.1.0",fragment_id:"frag_bendr_endpoint",multipass_id:"mp_bendr_2",fragment_type:"endpoint",status:"pending",assurance_level:"self_attested",visibility:"public",transfer_policy:"reverify_on_transfer",source:{source_type:"owner_submission",source_id:"bendr_endpoint",issuer:null,observed_at:"2026-06-24T00:00:00Z",reference_url:null},public_value:"Bendr local API endpoint awaiting live verification.",proof_reference:null,created_at:"2026-06-24T00:00:00Z",updated_at:"2026-06-24T00:00:00Z",endpoint_ref:{endpoint_id:"lookup",url:"/multipass/",protocol:"api",manifest_url:"/multipass/static/x402-manifest.json"}},{schema_version:"0.1.0",fragment_id:"frag_bendr_standard_ref",multipass_id:"mp_bendr_2",fragment_type:"standard_ref",status:"stale",assurance_level:"issuer_attested",visibility:"public",transfer_policy:"pause_on_transfer",source:{source_type:"issuer_attestation",source_id:"bendr_standard",issuer:"Helixa",observed_at:"2026-06-24T00:00:00Z",reference_url:null},public_value:"ERC-8004 adapter reference that needs a fresh check before stronger claims.",proof_reference:"fixture:standard-ref",created_at:"2026-06-24T00:00:00Z",updated_at:"2026-06-24T00:00:00Z",verified_at:"2026-06-24T00:00:00Z",expires_at:"2026-06-25T00:00:00Z"},{schema_version:"0.1.0",fragment_id:"frag_bendr_receipt_history",multipass_id:"mp_bendr_2",fragment_type:"receipt",status:"historical",assurance_level:"issuer_attested",visibility:"public",transfer_policy:"historical_on_transfer",source:{source_type:"payment_receipt",source_id:"bendr_receipt",issuer:"Helixa",observed_at:"2026-06-24T00:00:00Z",reference_url:null},public_value:"Receipt evidence retained as history; it does not create trust by itself.",proof_reference:"receipt_bendr_lookup",created_at:"2026-06-24T00:00:00Z",updated_at:"2026-06-24T00:00:00Z"},{schema_version:"0.1.0",fragment_id:"frag_bendr_route_dispute",multipass_id:"mp_bendr_2",fragment_type:"verification_result",status:"disputed",assurance_level:"unverified",visibility:"public",transfer_policy:"never_transfer",source:{source_type:"platform_check",source_id:"bendr_route_dispute",issuer:"Helixa",observed_at:"2026-06-24T00:00:00Z",reference_url:null},public_value:"Route claim intentionally marked disputed in the fixture.",proof_reference:"fixture:route-dispute",created_at:"2026-06-24T00:00:00Z",updated_at:"2026-06-24T00:00:00Z",verification_ref:{verification_type:"route_review",result:"inconclusive",issuer:"Helixa",risk_level:"medium",score:null}},{schema_version:"0.1.0",fragment_id:"frag_bendr_helixa_identity",multipass_id:"mp_bendr_2",fragment_type:"attestation",status:"verified",assurance_level:"onchain_verified",visibility:"public",transfer_policy:"historical_on_transfer",source:{source_type:"contract_read",source_id:"helixa_agentdna_1",issuer:"Helixa",observed_at:"2026-06-24T22:49:52Z",reference_url:"https://api.helixa.xyz/api/v2/agent/1"},public_value:"Helixa AgentDNA token #1 on Base, contract 0x2e3B541C59D38b84E3Bc54e977200230A204Fe60.",proof_reference:"base:8453:0x2e3B541C59D38b84E3Bc54e977200230A204Fe60:1",created_at:"2026-06-24T22:49:52Z",updated_at:"2026-06-24T22:49:52Z",verified_at:"2026-06-24T22:49:52Z"},{schema_version:"0.1.0",fragment_id:"frag_bendr_cred_score",multipass_id:"mp_bendr_2",fragment_type:"risk_summary",status:"verified",assurance_level:"platform_verified",visibility:"public",transfer_policy:"reverify_on_transfer",source:{source_type:"registry_import",source_id:"helixa_cred_score_1",issuer:"Helixa",observed_at:"2026-06-24T22:49:52Z",reference_url:"https://api.helixa.xyz/api/v2/agent/1"},public_value:"Cred score 80, Preferred tier, imported from Helixa API.",proof_reference:"helixa-api:agent:1:credScore",created_at:"2026-06-24T22:49:52Z",updated_at:"2026-06-24T22:49:52Z",verified_at:"2026-06-24T22:49:52Z",verification_ref:{verification_type:"cred_import",result:"passed",issuer:"Helixa",risk_level:"low",score:80}},{schema_version:"0.1.0",fragment_id:"frag_bendr_social_x",multipass_id:"mp_bendr_2",fragment_type:"social",status:"verified",assurance_level:"platform_verified",visibility:"public",transfer_policy:"reverify_on_transfer",source:{source_type:"platform_check",source_id:"bendr_x_handle",issuer:"Helixa",observed_at:"2026-06-24T22:49:52Z",reference_url:"https://api.helixa.xyz/api/v2/agent/1"},public_value:"X handle @BendrAI_eth imported from Helixa API.",proof_reference:"helixa-api:agent:1:socials.x",created_at:"2026-06-24T22:49:52Z",updated_at:"2026-06-24T22:49:52Z",verified_at:"2026-06-24T22:49:52Z"},{schema_version:"0.1.0",fragment_id:"frag_helixa_swarm_roster",multipass_id:"mp_helixa_swarm",fragment_type:"custody_record",status:"verified",assurance_level:"platform_verified",visibility:"public",transfer_policy:"pause_on_transfer",source:{source_type:"platform_check",source_id:"helixa_swarm_roster",issuer:"Helixa",observed_at:"2026-06-24T23:38:00Z",reference_url:"https://helixa.xyz/multipass/"},public_value:"Parent Multipass manages Bendr, Quigbot, and E2ETest demo agents as one collection roster.",proof_reference:"fixture:helixa-swarm-roster",created_at:"2026-06-24T23:38:00Z",updated_at:"2026-06-24T23:38:00Z",verified_at:"2026-06-24T23:38:00Z"},{schema_version:"0.1.0",fragment_id:"frag_helixa_swarm_tools",multipass_id:"mp_helixa_swarm",fragment_type:"endpoint",status:"pending",assurance_level:"self_attested",visibility:"public",transfer_policy:"pause_on_transfer",source:{source_type:"owner_submission",source_id:"helixa_swarm_tools",issuer:"Helixa",observed_at:"2026-06-24T23:38:00Z",reference_url:"https://helixa.xyz/multipass/"},public_value:"Shared tool policy preview for routes, permissions, and approvals across the swarm.",proof_reference:"fixture:helixa-swarm-tools",created_at:"2026-06-24T23:38:00Z",updated_at:"2026-06-24T23:38:00Z",endpoint_ref:{endpoint_id:"swarm_policy",url:"https://helixa.xyz/multipass/",protocol:"api",manifest_url:"/multipass/static/x402-manifest.json"}},{schema_version:"0.1.0",fragment_id:"frag_helixa_swarm_cred",multipass_id:"mp_helixa_swarm",fragment_type:"risk_summary",status:"verified",assurance_level:"platform_verified",visibility:"public",transfer_policy:"reverify_on_transfer",source:{source_type:"registry_import",source_id:"helixa_swarm_cred",issuer:"Helixa",observed_at:"2026-06-24T23:38:00Z",reference_url:"https://helixa.xyz/multipass/"},public_value:"Aggregate Cred context summarizes the roster without erasing each agent's individual profile.",proof_reference:"fixture:helixa-swarm-cred",created_at:"2026-06-24T23:38:00Z",updated_at:"2026-06-24T23:38:00Z",verified_at:"2026-06-24T23:38:00Z",verification_ref:{verification_type:"swarm_cred_summary",result:"passed",issuer:"Helixa",risk_level:"medium",score:78}}]},card:{schema_version:"0.1.0",multipass_id:"mp_bendr_2",name:"Bendr 2.0",subject_type:"agent",capabilities:[{capability_id:"profile_lookup",label:"Profile lookup",description:"Read public Multipass profile data from the static preview.",visibility:"public"},{capability_id:"agent_card_resolution",label:"Agent card resolution",description:"Resolve compact agent card fields for discovery and trust checks.",visibility:"public"}],message_routes:[{route_id:"web_profile",channel:"api",address:"https://helixa.xyz/agent/1",visibility:"public"},{route_id:"telegram",channel:"chat",address:"@bendr2bot",visibility:"public"}],service_endpoints:[{endpoint_id:"helixa_profile",url:"https://api.helixa.xyz/api/v2/agent/1",description:"Public Helixa AgentDNA profile for Bendr 2.0.",visibility:"public"},{endpoint_id:"multipass_preview",url:"https://helixa.xyz/multipass/",description:"Hidden Multipass prototype preview.",visibility:"public"}],x402_manifest_url:"/multipass/static/x402-manifest.json",accepted_assets:[{asset:"CRED",chain_id:8453}],trust_summary:{identity_status:"verified",assurance_level:"onchain_verified",last_updated_at:"2026-06-24T22:49:52Z"},rate_limits:{requests:60,window_seconds:60,burst:10},contact_policy:{mode:"approval_required",requires_owner_approval:!0,policy_note:"Static demo only."},standards_refs:[{standard_id:"ERC-8004",support_status:"adapter_ready",record_id:null},{standard_id:"ERC-8217",support_status:"pending",record_id:null}]},standards:{schema_version:"0.1.0",standards_profile_id:"sp_bendr_2",multipass_id:"mp_bendr_2",primary_refs:{erc8004_identity:null,controller_asset:null,x402_manifest:"mp_bendr_2:x402"},standard_refs:[{standard_id:"ERC-8004",status:"adapter_ready",chain_id:8453,contract_address:null,record_id:null,adapter_version:"0.1.0",last_verified_at:null,assurance_level:"unverified"},{standard_id:"ERC-8217",status:"pending",chain_id:8453,contract_address:null,record_id:null,adapter_version:"0.1.0",last_verified_at:null,assurance_level:"unverified"},{standard_id:"ERC-8257",status:"pending",chain_id:null,contract_address:null,record_id:null,adapter_version:"0.1.0",last_verified_at:null,assurance_level:"unverified"}],compatibility_summary:{identity_bound:!1,owner_verified:!1,risk_checked:!1,tools_verified:!1,work_attested:!1,trust_updated:!1},adapter_versions:{"ERC-8004":"0.1.0","ERC-8217":"0.1.0","ERC-8257":"0.1.0"},last_verified_at:null},x402:{schema_version:"0.1.0",multipass_id:"mp_bendr_2",endpoints:[{endpoint_id:"lookup",url:"/multipass/",method:"GET",description:"Sample CRED-gated profile lookup route for public static preview.",price:{amount:"1",decimals:18},asset:"CRED",chain_id:8453,provider:"bankr_x402_cloud",settlement_reference_policy:"provider_receipt",rate_limit:{requests:10,window_seconds:60,burst:2},visibility:"public",requires_owner_approval:!1}]},receipt:{schema_version:"0.1.0",receipt_id:"receipt_bendr_lookup",multipass_id:"mp_bendr_2",endpoint_id:"lookup",provider:"bankr_x402_cloud",amount:"1",asset:"CRED",chain_id:8453,status:"settled",created_at:"2026-06-24T00:00:00Z",response_class:"success",settlement_reference:null,redaction_note:"Sample public static receipt. No private request or response payload is included."},routes:{},agentCards:[{name:"Bendr 2.0",tokenId:1,helixaId:"8453:1",framework:"openclaw",credScore:80,credTier:"Preferred",verified:!0,profileUrl:"https://helixa.xyz/agent/1"},{name:"Quigbot",tokenId:81,helixaId:"8453:81",framework:"openclaw",credScore:75,credTier:"Prime",verified:!0,profileUrl:"https://helixa.xyz/agent/81"},{name:"E2ETest",tokenId:0,helixaId:"8453:0",framework:"openclaw",credScore:41,credTier:"Marginal",verified:!1,profileUrl:"https://helixa.xyz/agent/0"},{name:"Helixa Swarm",tokenId:"swarm:helixa",helixaId:"8453:swarm:helixa",framework:"multi-agent",credScore:78,credTier:"Prime",verified:!0,profileUrl:"https://helixa.xyz/swarm/helixa",subjectType:"swarm",members:3,role:"Parent Multipass",custody:"Custody epoch ready"}]},w="/multipass-api";function S(e){const t=C(e);return t?k(t.toString()):w}function C(e){const t=e.searchParams.get("api");if(!t)return null;try{const a=new URL(t);return["http:","https:"].includes(a.protocol)?a:null}catch{return null}}function P(e,t){const r=`${k(e||w)}/api/multipass/${encodeURIComponent(t.slug)}`;return{profile:r,fragments:`${r}/fragments`,card:`${r}/agent-card`,standards:`${r}/standards`,x402:`${r}/x402`,receipt:`${r}/receipts/${encodeURIComponent(t.receiptId)}`}}async function u(e,t=fetch){const a=await t(e);if(!a.ok)throw new Error(`GET ${e} failed with ${a.status}`);const r=await a.text();try{return JSON.parse(r)}catch(s){throw new Error(`API returned invalid JSON for ${e}: ${s.message}`)}}async function E({apiBase:e=w,subject:t,fetchImpl:a=fetch}){const r=P(e,t),[s,n,c,y,h,l]=await Promise.all([u(r.profile,a),u(r.fragments,a),u(r.card,a),u(r.standards,a),u(r.x402,a),u(r.receipt,a)]);return{profile:s,fragments:n,card:c,standards:y,x402:h,receipt:l,routes:r,modeLabel:"Local API Demo",sourceLabel:"local API"}}function L(e){const t=e.pathname;return(t==="/multipass"||t.startsWith("/multipass/"))&&!C(e)}async function Z(){return structuredClone(A)}function k(e){return e.endsWith("/")?e.slice(0,-1):e}const g={slug:"bendr-2",receiptId:"receipt_bendr_lookup"},T={prototypeLabel:"Internal Prototype",audience:"Built first for agent builders, agent teams, and marketplaces that need a fast trust read."},v={title:"Inspect proof",eyebrow:"PROOF LAYER",body:"Open the proof when a card needs verification. Each signal keeps its own visibility, source, assurance level, and transfer rule."},m={fragmentType:{endpoint:"Endpoint fragments describe routes, protocols, manifests, and access surfaces an agent may expose.",attestation:"Attestation fragments describe claims or checks from an owner, platform, issuer, or verifier.",receipt:"Receipt fragments describe access or payment evidence without making that evidence trust by itself.",standard_ref:"Standard reference fragments connect the profile to external standards without implying every adapter is live.",verification_result:"Verification result fragments record review outcomes, risk context, or disputed checks.",custody_record:"Custody record fragments describe owner or controller epochs without transferring private authority.",risk_summary:"Risk summary fragments carry imported Cred or safety context without collapsing identity into a single score.",social:"Social fragments connect public handles to an agent profile through a named source or verification path."},visibility:{public:"Visible to anyone and safe for profile cards, indexers, and partner systems.",gated:"Released only after token, payment, relationship, or allowlist policy is satisfied.",private:"Visible only to approved owners, operators, or internal systems with a clear need.",hidden:"Not discoverable through public or gated surfaces, reserved for safety or integrity review."},status:{verified:"Checked by a platform, issuer, contract read, or other explicit verification path.",pending:"Submitted or referenced, but still waiting for review or a stronger proof source.",stale:"Previously useful, but old enough that builders should request a fresh check.",historical:"Kept as provenance or prior evidence, not treated as active authority.",disputed:"Flagged for review because the claim, source, or interpretation is contested."},assurance:{unverified:"Unverified means the fragment has no stronger source than a raw claim or placeholder.",self_attested:"Self attested means the owner or agent supplied the claim without outside verification.",platform_verified:"Platform verified means Helixa or another platform checked the fragment through a defined process.",cryptographic:"Cryptographic means the fragment is backed by a signature, hash, or comparable cryptographic proof.",issuer_attested:"Issuer attested means a named issuer supplied or signed the supporting evidence.",onchain_verified:"Onchain verified means the fragment was checked against a chain record or contract read."},transferPolicy:{reverify_on_transfer:"Reverify on transfer means a new owner must confirm the fragment before it is treated as current.",pause_on_transfer:"Pause on transfer means active authority should stop until the new owner or operator approves it.",historical_on_transfer:"Historical on transfer means provenance stays visible, but it does not grant active authority.",never_transfer:"Never transfer means the fragment is bound to the prior controller or context and must not move."}};function R(e){const t={name:e.profile.display_name,tokenId:e.profile.slug??e.profile.multipass_id,helixaId:e.profile.slug??e.profile.multipass_id,framework:"unknown",credScore:null,credTier:e.profile.cred_summary?.trust_state??"none",verified:e.card.trust_summary?.identity_status==="verified",profileUrl:null};return{eyebrow:"AGENT CARD CAROUSEL",title:"Agent cards that lead with trust.",body:"Each card gives agents, swarms, apps, and marketplaces a quick read on identity, Cred, framework, and profile route. The deeper proof sits below for verification, not first impression.",cards:(e.agentCards?.length?e.agentCards:[t]).map(r=>({name:r.name,tokenId:r.tokenId,helixaId:r.helixaId??String(r.tokenId??r.name),framework:r.framework??"unknown",credScore:r.credScore??null,credTier:r.credTier??"Unrated",credLabel:r.credScore===null||r.credScore===void 0?"Cred pending":`Cred ${r.credScore}`,verified:!!r.verified,verifiedLabel:r.verified?"verified":"unverified",profileUrl:r.profileUrl??null,subjectLabel:r.subjectType??"agent",memberLabel:H(r.members),role:r.role??"Agent Multipass",custody:r.custody??"Owner verified"}))}}function j(e){const t=$(e.fragments);return{title:v.title,eyebrow:v.eyebrow,body:v.body,cards:t.map(I),legends:m,emptyPrivateNote:"Private and hidden fragments are not rendered in this public prototype."}}function I(e){const t=b(e.fragment_type),a=e.endpoint_ref?.protocol?`${e.endpoint_ref.protocol} `:"",r=e.source?.source_type?b(e.source.source_type):"Unknown source",s=e.source?.issuer?` by ${e.source.issuer}`:"";return{id:e.fragment_id,title:D(e),type:e.fragment_type,typeLabel:t,status:e.status,statusExplanation:m.status[e.status]??"Status explanation unavailable.",assurance:e.assurance_level,assuranceLabel:b(e.assurance_level),assuranceExplanation:m.assurance[e.assurance_level]??"Assurance explanation unavailable.",visibility:e.visibility,visibilityExplanation:m.visibility[e.visibility]??"Visibility explanation unavailable.",transferPolicy:e.transfer_policy,transferPolicyLabel:b(e.transfer_policy),transferPolicyExplanation:m.transferPolicy[e.transfer_policy]??"Transfer policy explanation unavailable.",summary:e.endpoint_ref?`${t} for ${a}endpoint from ${r}${s}.`:`${t} from ${r}${s}.`,publicValue:e.public_value??"No public value returned."}}function H(e){return e==null?"1 agent":`${e} ${Number(e)===1?"agent":"agents"}`}function D(e){const t={frag_bendr_profile:"Bendr profile check",frag_bendr_endpoint:"Bendr API route",frag_bendr_standard_ref:"Standards reference",frag_bendr_receipt_history:"Receipt history",frag_bendr_route_dispute:"Route review flag",frag_bendr_helixa_identity:"Helixa AgentDNA identity",frag_bendr_cred_score:"Cred score import",frag_bendr_social_x:"Social handle check",frag_helixa_swarm_roster:"Swarm roster",frag_helixa_swarm_tools:"Shared tool policy",frag_helixa_swarm_cred:"Aggregate Cred context"};return t[e.fragment_id]?t[e.fragment_id]:b(e.fragment_type)}function b(e){const t=String(e??"unknown").split("_").filter(Boolean);return t.length===0?"Unknown":[t[0].charAt(0).toUpperCase()+t[0].slice(1),...t.slice(1)].join(" ")}const p={eyebrow:"MULTIPASS RECORD",headline:"The identity layer for agents, swarms, and the apps that need to read them.",body:"Multipass gives every agent a compact card and a machine-readable trust profile: identity, Cred, routes, standards, and receipts in one portable proof layer.",note:"Hidden prototype using Bendr 2.0 public fixture data."};function M(){return[{title:"What is Multipass?",body:"Multipass is a portable identity and trust profile for agents, swarms, apps, and marketplaces that need to decide who they are dealing with."},{title:"What the card shows",body:"The card gives the fast read: name, Helixa ID, Cred context, verified status, framework, and profile route."},{title:"What proof adds",body:"Proof records explain where the card comes from without making raw protocol details the first thing people see."}]}function N(e){return`${e.display_name} is a ${e.subject_type} profile with status ${e.status} and trust state ${e.cred_summary?.trust_state??"none"}.`}function O(e){const t=$(e.fragments);return[{title:"Card first",label:"Fast read",body:"Name, Helixa ID, Cred, framework, and profile route should be understandable at a glance."},{title:"Proof below",label:`${t.length} public fragments`,body:"Fragments explain why the card should be trusted without dumping raw protocol detail up front."},{title:"Portable by design",label:`${e.x402.endpoints.length} x402 endpoint`,body:"Apps can read the same agent profile across discovery, access, settlement, and custody flows."}]}function B(e){const t=$(e.fragments),a=F(e.fragments,t);return[{title:"Profile",status:e.profile.status,summary:N(e.profile),why:"The profile is the canonical summary agents, apps, and builders can resolve first.",json:d(e.profile)},{title:"Public Fragments",status:`${t.length} public`,summary:t.length?`${t.length} readable proof signals available.`:"No public fragments returned.",why:"Fragments show the public pieces that support the profile without exposing private records.",json:a},{title:"Agent Card",status:`${e.card.capabilities.length} capabilities`,summary:`${e.card.service_endpoints.length} service endpoint records available.`,why:"The agent card gives machines a compact view of capabilities, routes, endpoints, and trust context.",json:d(e.card)},{title:"Standards",status:`${e.standards.standard_refs.length} refs`,summary:z(e.standards.standard_refs),why:"Standards references show compatibility targets and adapter state without claiming every adapter is live.",json:d(e.standards)},{title:"x402",status:`${e.x402.endpoints.length} endpoints`,summary:e.x402.endpoints.map(r=>`${r.endpoint_id} accepts ${r.asset}`).join(", ")||"No endpoints returned.",why:"x402 metadata explains planned access rails and accepted assets without implying live settlement here.",json:d(e.x402)},{title:"Receipt",status:e.receipt.status,summary:`${e.receipt.receipt_id} records a ${e.receipt.response_class??"unknown"} response.`,why:"Receipt evidence records that an access event can be attached to the profile without becoming trust by itself.",json:d(e.receipt)}]}function F(e,t){const a={fragments:d(t)};for(const r of["multipass_id","profile_id","subject_id","schema_version"])e[r]!==void 0&&(a[r]=e[r]);return a}function d(e){if(Array.isArray(e))return e.map(t=>d(t)).filter(t=>t!==void 0);if(!e||typeof e!="object")return e;if(e.visibility!=="private")return Object.fromEntries(Object.entries(e).filter(([t])=>!U(t)).map(([t,a])=>[t,d(a)]).filter(([,t])=>t!==void 0))}function U(e){const t=e.toLowerCase();return t.startsWith("private")||t.includes("_private")}function $(e){return(e.fragments??[]).filter(t=>t.visibility==="public")}function z(e){return e.map(t=>`${t.standard_id}: ${t.status}`).join(", ")||"No standard refs returned."}function q({root:e,loadDemo:t=V}){if(!e)throw new Error("createApp requires a root element");let a={expandedCard:null,selectedAgentCard:0};async function r(){J(e);try{const s=await t();a={...a,data:s},x(e,a)}catch(s){G(e,s)}}return{start:r}}function V(){const e=new URL(window.location.href);return L(e)?Z():E({apiBase:S(e),subject:g})}function J(e){e.innerHTML=`
    <section class="record-shell loading-shell">
      <p class="eyebrow">${p.eyebrow}</p>
      <h1>Loading Bendr 2.0...</h1>
    </section>
  `}function G(e,t){e.innerHTML=`
    <section class="record-shell error-shell">
      <p class="eyebrow">${p.eyebrow}</p>
      <h1>Could not load Multipass API data.</h1>
      <p>Run <code>pnpm api:bendr</code> in the Multipass repo, then reload this page.</p>
      <pre class="json-panel">${i(t.message)}</pre>
    </section>
  `}function x(e,t){const{data:a}=t,r=O(a),s=M(),n=R(a),c=n.cards[t.selectedAgentCard]??n.cards[0],y=j(a),h=B(a);e.innerHTML=`
    <div class="record-shell">
      <header class="record-header">
        <div class="brand"><div class="mark" aria-hidden="true"></div><span>Multipass</span></div>
        <div class="header-meta"><span>Hidden Prototype</span><span>${i(a.modeLabel??"Local API Demo")}</span></div>
      </header>

      <section class="hero-record">
        <div>
          <p class="eyebrow">${p.eyebrow}</p>
          <div class="prototype-ribbon">
            <span>${i(T.prototypeLabel)}</span>
            <span>${i(T.audience)}</span>
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
            ${o("Record",a.profile.multipass_id??g.slug)}
            ${o("Subject",a.profile.subject_type)}
            ${o("Slug",a.profile.slug??g.slug)}
            ${o("Status",a.profile.status,"status")}
            ${o("Trust State",a.profile.cred_summary?.trust_state??"none")}
            ${o("Source",a.sourceLabel??"local API")}
            ${o("Receipt",a.receipt.receipt_id)}
          </div>
        </article>
      </section>

      ${W(n,c,t.selectedAgentCard)}

      <section class="story-records">${r.map(Q).join("")}</section>

      <section class="clarity-grid">${s.map(X).join("")}</section>

      ${ee(y)}

      <section class="proof-ledger">
        <div class="ledger-title"><h2>Proof ledger</h2><span>Expandable API records</span></div>
        ${h.map((l,_)=>re(l,_,t.expandedCard)).join("")}
      </section>

      <footer class="footer-note">This is a static public demo. It does not include auth, persistence, contract reads, or payment settlement.</footer>
    </div>
  `,e.querySelectorAll('[data-action="select-agent-card"]').forEach(l=>{l.addEventListener("click",()=>{t.selectedAgentCard=Number(l.dataset.index),x(e,t),e.querySelector(`[data-action="select-agent-card"][data-index="${t.selectedAgentCard}"]`)?.focus()})}),e.querySelectorAll('[data-action="toggle-json"]').forEach(l=>{l.addEventListener("click",()=>{const _=Number(l.dataset.index);t.expandedCard=t.expandedCard===_?null:_,x(e,t),e.querySelector(`[data-action="toggle-json"][data-index="${_}"]`)?.focus()})})}function o(e,t,a=""){const r=a?` ${a}`:"";return`
    <div class="field">
      <span>${i(e)}</span>
      <strong class="mono${r}">${i(t)}</strong>
    </div>
  `}function W(e,t,a){return`
    <section class="card-carousel">
      <div class="card-carousel-head">
        <p class="eyebrow">${i(e.eyebrow)}</p>
        <h2>${i(e.title)}</h2>
        <p>${i(e.body)}</p>
      </div>
      <div class="card-track" role="tablist" aria-label="Agent cards">
        ${e.cards.map((r,s)=>Y(r,s,a)).join("")}
      </div>
      ${K(t)}
    </section>
  `}function Y(e,t,a){const r=t===a;return`
    <button class="card-button${r?" selected":""}" data-action="select-agent-card" data-index="${t}" type="button" aria-selected="${r}">
      <span class="card-name">${i(e.name)}</span>
      <span>${i(e.helixaId)}</span>
      <span>${i(e.subjectLabel)} · ${i(e.memberLabel)}</span>
      <span>${i(e.role)}</span>
      <span>${i(e.custody)}</span>
      <strong>${i(e.credLabel)}</strong>
    </button>
  `}function K(e){return`
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
  `}function Q(e,t){return`
    <article class="story">
      <span class="story-num">${String(t+1).padStart(2,"0")}</span>
      <p class="card-label">${i(e.label)}</p>
      <h3>${i(e.title)}</h3>
      <p>${i(e.body)}</p>
    </article>
  `}function X(e){return`
    <article class="clarity-card">
      <h3>${i(e.title)}</h3>
      <p>${i(e.body)}</p>
    </article>
  `}function ee(e){return`
    <section class="fragment-map">
      <div class="fragment-map-head">
        <p class="eyebrow">${i(e.eyebrow)}</p>
        <h2>${i(e.title)}</h2>
        <p>${i(e.body)}</p>
      </div>
      <div class="fragment-cards">
        ${e.cards.map(te).join("")}
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
  `}function te(e){return`
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
  `}function f(e,t){return`
    <article>
      <h3>${i(e)}</h3>
      ${Object.entries(t).map(([a,r])=>`
        <div class="legend-row">
          <strong>${i(a)}</strong>
          <span>${i(r)}</span>
        </div>
      `).join("")}
    </article>
  `}function re(e,t,a){const r=a===t;return`
    <article class="ledger-entry">
      <div class="ledger-row">
        <div class="doc">${i(e.title)}</div>
        <div class="badge ${ae(e)}">${i(e.status)}</div>
        <div class="summary">
          <span>${i(e.summary)}</span>
          <span class="why">${i(e.why)}</span>
        </div>
        <button data-action="toggle-json" data-index="${t}" aria-expanded="${r}" aria-controls="proof-json-${t}">${r?"Hide JSON":"Show JSON"}</button>
      </div>
      ${r?`<pre id="proof-json-${t}" class="json-panel">${i(JSON.stringify(e.json,null,2))}</pre>`:""}
    </article>
  `}function ae(e){return["settled","passed","filtered"].includes(String(e.status).toLowerCase())?"verified":"neutral"}function i(e){return String(e).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;")}q({root:document.querySelector("#app")}).start();
