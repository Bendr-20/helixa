import{aP as Se,eK as L,aR as o,eL as b,eM as p,eN as Ae,eO as Pe,eP as Le,cU as Ie,eQ as Te,aQ as fe,bf as h,aU as g,b0 as Me}from"./index-BIIr9Zi4.js";import{y as Ne,c as $e,p as De}from"./SelectSourceAsset-BSIZrvmo-DaGLzy_2.js";import{n as C}from"./ScreenLayout-Ce16-u0i-DHLa5wS9.js";import{w as ze}from"./ConnectPhoneForm-DOpPLfRT-jaZg-mn9.js";import{m as Ue}from"./CopyableText-ChtfBWx4-Ctw1vTiV.js";import{t as qe,h as Re}from"./GooglePay-DA-Ff7zK-D9DAQCv7.js";import{r as ve}from"./chevron-down-C9e8JkFh.js";import{I as Fe}from"./info-DEpZzmZg.js";import{T as Be}from"./triangle-alert-DSFdA_ZU.js";import{c as I}from"./createLucideIcon-BWu0ydMA.js";import{C as Ve}from"./circle-x-CwG1mFN1.js";import{C as Ke}from"./check-D5uJ-pvI.js";import{L as Oe}from"./lock-DiMwsC8s.js";import{W as Ye}from"./wallet-BVljEf0X.js";import{S as se}from"./smartphone-Br5rxjnV.js";import"./ModalHeader-YbJk-YIQ-C-N0i6VD.js";import"./Screen-CdOj1bUg-4yeSP8XK.js";import"./index-Dq_xe9dz-DEotILZS.js";import"./Chip-D2-wZOHJ-DebvrRM0.js";import"./LoadingSkeleton-U6-3yFwI-4pfvVWNw.js";import"./copy-CSQsgy2k.js";const We={path:"/api/v1/onramp/stripe/create_link_auth_intent",method:"POST"},He={path:"/api/v1/onramp/stripe/exchange_tokens",method:"POST"},Qe={path:"/api/v1/onramp/stripe/customer",method:"GET"},Xe={path:"/api/v1/onramp/stripe/customer/wallets",method:"GET"},Ge={path:"/api/v1/onramp/stripe/customer/payment_tokens",method:"GET"},Ze={path:"/api/v1/onramp/stripe/create_onramp_session",method:"POST"},Je={path:"/api/v1/onramp/stripe/quote/:session_id",method:"POST"},et={path:"/api/v1/onramp/stripe/checkout/:session_id",method:"POST"};const tt=[["path",{d:"M12 10h.01",key:"1nrarc"}],["path",{d:"M12 14h.01",key:"1etili"}],["path",{d:"M12 6h.01",key:"1vi96p"}],["path",{d:"M16 10h.01",key:"1m94wz"}],["path",{d:"M16 14h.01",key:"1gbofw"}],["path",{d:"M16 6h.01",key:"1x0f13"}],["path",{d:"M8 10h.01",key:"19clt8"}],["path",{d:"M8 14h.01",key:"6423bh"}],["path",{d:"M8 6h.01",key:"1dz90k"}],["path",{d:"M9 22v-3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3",key:"cabbwy"}],["rect",{x:"4",y:"2",width:"16",height:"20",rx:"2",key:"1uxh74"}]],X=I("building",tt);const rt=[["path",{d:"M8 2v4",key:"1cmpym"}],["path",{d:"M16 2v4",key:"4m81vk"}],["rect",{width:"18",height:"18",x:"3",y:"4",rx:"2",key:"1hopcy"}],["path",{d:"M3 10h18",key:"8toen8"}]],ot=I("calendar",rt);const nt=[["path",{d:"m9 18 6-6-6-6",key:"mthhwq"}]],it=I("chevron-right",nt);const st=[["rect",{width:"20",height:"14",x:"2",y:"5",rx:"2",key:"ynyp8z"}],["line",{x1:"2",x2:"22",y1:"10",y2:"10",key:"1b3vmo"}]],z=I("credit-card",st);const at=[["path",{d:"M10 18v-7",key:"wt116b"}],["path",{d:"M11.12 2.198a2 2 0 0 1 1.76.006l7.866 3.847c.476.233.31.949-.22.949H3.474c-.53 0-.695-.716-.22-.949z",key:"1m329m"}],["path",{d:"M14 18v-7",key:"vav6t3"}],["path",{d:"M18 18v-7",key:"aexdmj"}],["path",{d:"M3 22h18",key:"8prr45"}],["path",{d:"M6 18v-7",key:"1ivflk"}]],Y=I("landmark",at);const lt=[["path",{d:"M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0",key:"1r0f0z"}],["circle",{cx:"12",cy:"10",r:"3",key:"ilqhr7"}]],ct=I("map-pin",lt);const dt=[["path",{d:"M5 12h14",key:"1ays0h"}],["path",{d:"M12 5v14",key:"s699le"}]],ut=I("plus",dt);const pt=[["path",{d:"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2",key:"975kel"}],["circle",{cx:"12",cy:"7",r:"4",key:"17ys0d"}]],mt=I("user",pt),[ge,ht]=((e,t=750)=>{let r;return[(...n)=>{r&&clearTimeout(r),r=setTimeout((()=>{e(...n)}),t)},()=>{r&&clearTimeout(r)}]})((async(e,t)=>{p({isLoading:!0});try{let{getQuotes:r}=b(),n=await r({source:{asset:t.source.selectedAsset.toUpperCase(),amount:e},destination:{asset:t.destination.asset.toUpperCase(),chain:t.destination.chain,address:t.destination.address},environment:t.environment}),i=n.quotes??[],s=n.provider_errors,l=Te(i,e);p({localQuotes:i,localSelectedQuote:i[0]??null,isLoading:!1,quotesWarning:l,quotesErrors:s??null,destinationCurrencyIconUrl:n.destination_currency_icon_url??null,destinationNetworkIconUrl:n.destination_network_icon_url??null})}catch{p({localQuotes:[],localSelectedQuote:null,quotesWarning:"provider_errors",quotesErrors:null})}})),yt=e=>{p({amount:e});let{opts:t}=b();ge(e,t)},ee=()=>{let{stripeSession:e,controller:t}=b();e&&(t.current?.abort(),e.onramp.destroy(),p({stripeSession:null}))},ae=async()=>{let{error:e,state:t,onFailure:r,onSuccess:n}=b();ht(),ee();let i=((s,l)=>l?{type:"failure",error:l}:s.status==="provider-success"?{type:"success",value:{status:"confirmed"}}:s.status==="provider-confirming"?{type:"success",value:{status:"submitted"}}:{type:"failure",error:Error("User exited flow")})(t,e);i.type==="success"?await n(i.value):r(i.error)},U=async(e,{environment:t})=>(await e.fetchPrivyRoute(Qe,{query:{environment:t}})).data,k=()=>{let e=b().stripeSession;if(!e)throw Error("No active Stripe onramp session");return e},y=()=>{let{stripeSession:e,controller:t}=b();return e!==null&&!(t.current?.signal.aborted??1)},q=()=>{let{controller:e}=b();if(!e.current)throw Error("No active abort controller");return e.current.signal},R=(e,t,r)=>{let{promise:n,reject:i}=Promise.withResolvers(),s=setTimeout((()=>i(Error(`Timed out after ${t}ms`))),t);return r.addEventListener("abort",(()=>clearTimeout(s)),{once:!0}),Promise.race([e,n])},xe=async(e,{environment:t})=>(await e.fetchPrivyRoute(Ge,{query:{environment:t}})).data,ft=["aptos","avalanche","base","bitcoin","ethereum","optimism","polygon","solana","stellar","sui","tempo","worldchain","xrpl"],we=e=>{if((t=>ft.some((r=>r===t)))(e))return e;throw Error(`Unsupported Stripe onramp network: ${e}`)},Z=async(e,t)=>await e.fetchPrivyRoute(Ze,{body:{session_id:t.sessionId,environment:t.environment,session:t.session}}),vt=e=>{let t=gt(e?.source_currency?.toLowerCase());return{currencySymbol:t,paymentMethodLabel:null,fee:e?.fee&&t?`${t}${e.fee}`:null,destinationAmount:xt(e?.destination_amount),destinationToken:e?.destination_currency?.toUpperCase()??null,destinationNetwork:wt(e?.destination_network),sourceAmount:e?.source_total_amount??null,quoteExpiresAt:e?.quote_expiration??null}};let gt=e=>e==="usd"?"$":e==="eur"?"€":e==="gbp"?"£":null,xt=e=>e?e.replace(/\.0+$/,"").replace(/(\.\d*?)0+$/,"$1"):null,wt=e=>e?e.split(/[-_]/).map((t=>`${t.slice(0,1).toUpperCase()}${t.slice(1)}`)).join(" "):null;const F=(e,t,r="us",n)=>{if(r==="eu")return kt(t,n);let i=c=>t.includes(c),s=i("first_name")&&i("last_name"),l=i("address_line_1")&&i("address_city")&&i("address_state")&&i("address_postal_code"),a=i("dob"),u=i("id_number");return e==="l0"?s?l?null:"collect-address":"collect-name":s?a?u?l?null:"collect-address":"collect-ssn":"collect-dob":"collect-name"},kt=(e,t)=>{let r=n=>e.includes(n);return r("first_name")&&r("last_name")?r("dob")?r("nationalities")?r("birth_city")&&r("birth_country")?r("address_line_1")?r("identifiers")?r("attestation")?t!=="verified"?"verify-documents":null:"eu-attestation":"collect-identifiers":"collect-address":"collect-birth-location":"collect-nationality":"collect-dob":"collect-name"},Ct=e=>{let t=bt(e);if(t==="crypto_onramp_missing_minimum_identity_verification")return"l0";if(t==="crypto_onramp_missing_identity_verification")return"l1";if(t==="crypto_onramp_missing_document_verification")return"l2";let r=_t(e);return r.includes("crypto_onramp_missing_minimum_identity_verification")?"l0":r.includes("crypto_onramp_missing_identity_verification")?"l1":r.includes("crypto_onramp_missing_document_verification")?"l2":r.toLowerCase().includes("minimum identity verification")?"l0":r.toLowerCase().includes("identity verification")?"l1":r.toLowerCase().includes("document verification")?"l2":null};let bt=e=>{if(!e||typeof e!="object")return null;if("code"in e&&typeof e.code=="string")return e.code;if("error"in e){let t=e.error;if(t&&typeof t=="object"&&"code"in t&&typeof t.code=="string")return t.code}return null},_t=e=>{if(!e)return"";let t=[];if(e instanceof Error?t.push(e.name,e.message):t.push(String(e)),typeof e=="object"&&("code"in e&&t.push(String(e.code)),"type"in e&&t.push(String(e.type)),"error"in e)){let r=e.error;typeof r=="object"&&r&&"message"in r&&t.push(String(r.message)),typeof r=="object"&&r&&"code"in r&&t.push(String(r.code))}return t.join(" ")};const ke=(e,t)=>{let r=e.find((i=>i.id===t));if(!r?.card)return null;let n=r.card.brand?`${r.card.brand.charAt(0).toUpperCase()}${r.card.brand.slice(1)}`:"Card";return r.card.last4?`${n} •••• ${r.card.last4}`:n},j=e=>{let t=e instanceof Error?e:Error(String(e));console.error("[FiatOnramp:Stripe]",t),p({state:{status:"provider-error"},error:t,isLoading:!1})},Ce=async({paymentToken:e,loader:t})=>{let r=k();try{let n,i,{opts:s,amount:l}=b(),{config:a,cryptoCustomerId:u}=r.context;if(!u)throw Error("Missing cryptoCustomerId");t==="inline"?p({stripeSession:{...r,context:{...r.context,paymentToken:e}},isLoading:!0}):t==="screen"&&p({stripeSession:{...r,context:{...r.context,paymentToken:e}},state:{status:"stripe-flow",step:"checkout"},isLoading:!1});let c={crypto_customer_id:u,payment_token:e,source_amount:l||"0",source_currency:s.source.selectedAsset.toUpperCase(),destination_currency:s.destination.asset.toUpperCase(),destination_network:a.network,wallet_address:s.destination.address};try{let f=await Z(r.privy,{sessionId:a.sessionId,environment:a.environment,session:c});n=f.id,i=f.transaction_details}catch(f){let v=Ct(f);if(!v)throw f;if(!y())return;let _=await U(r.privy,{environment:a.environment});if(!y())return;let x=_.status==="active"?_.provided_fields:[];if(v!=="l2"){let T=k(),A=F(v,x);if(!A)throw Error(`Unexpected: all fields already provided for KYC tier '${v}'`);return void p({stripeSession:{...T,context:{...T.context,kycTier:v,kycProvidedFields:x}},state:{status:"stripe-flow",step:A},isLoading:!1})}if(p({state:{status:"stripe-flow",step:"kyc"},isLoading:!1}),await r.onramp.verifyDocuments(),!y())return;let S=await Z(r.privy,{sessionId:a.sessionId,environment:a.environment,session:c});n=S.id,i=S.transaction_details}if(!y())return;let m=k().context.paymentMethodLabel??null;if(!m)try{let f=await xe(r.privy,{environment:a.environment});m=ke(f,e)}catch{}let d={...vt(i),paymentMethodLabel:m},w=k();p({stripeSession:{...w,context:{...w.context,stripeSessionId:n,checkoutDetails:d}},stripeConfirmCheckoutDetails:d,state:{status:"stripe-flow",step:"confirm-checkout"},isLoading:!1})}catch(n){j(n)}},H=async e=>{let t=k();try{let{opts:r}=b(),n=t.context.config.network,i=await(async(l,{environment:a})=>(await l.fetchPrivyRoute(Xe,{query:{environment:a}})).data)(t.privy,{environment:t.context.config.environment});if(!y())return;if(!i.some((l=>l.wallet_address===r.destination.address&&l.network===n))){try{await t.onramp.registerWalletAddress(r.destination.address,we(n))}catch(l){console.warn("[FiatOnramp:Stripe] registerWalletAddress failed:",l)}if(!y())return}if(!e?.skipTokenCheck){let l=[];try{l=await xe(t.privy,{environment:t.context.config.environment})}catch{}if(!y())return;if(l.length>0){let a=new Set,u=l.filter((m=>{let d=`${m.type}:${m.card?.brand??""}:${m.card?.last4??""}`;return!a.has(d)&&(a.add(d),!0)})),c=k();return void p({stripeSession:{...c,context:{...c.context,savedPaymentTokens:u}},state:{status:"stripe-flow",step:"select-payment"},isLoading:!1})}}p({stripeElement:null,state:{status:"stripe-flow",step:"payment"},isLoading:!1});let s=await R(t.onramp.collectPaymentMethod({payment_method_types:["card","us_bank_account"],wallets:{applePay:"auto",googlePay:"auto"}},(l=>{if(y()){if(!l.cryptoPaymentToken)return void j(Error("Payment method selection was cancelled"));Ce({paymentToken:l.cryptoPaymentToken,loader:"screen"})}})),3e4,q());y()&&s&&p({stripeElement:s})}catch(r){j(r)}},jt=async()=>{let e,t=Pe();if(!t)return;let r=t.provider;if(r==="stripe"||r==="stripe-sandbox"){p({isLoading:!0});let{opts:d,amount:w,getProviderUrl:f,email:v,phone:_}=b();try{let x=await f({source:{asset:d.source.selectedAsset.toUpperCase(),amount:w||"0"},destination:{asset:d.destination.asset.toUpperCase(),chain:d.destination.chain,address:d.destination.address},provider:t.provider,sub_provider:t.sub_provider??void 0,payment_method:t.payment_method}),S=Et(x),T=r==="stripe"?"production":"sandbox";await(async(M,K)=>{let O;ee();try{({loadCryptoOnrampAndInitialize:O}=await Le(()=>import("./react-auth_false-B8ZSnDDF.js"),[]))}catch{throw Error("@stripe/crypto is required for Stripe onramp but could not be loaded. Ensure the package is installed.")}let{controller:oe}=b();oe.current=new AbortController;let ne=await R(Promise.resolve(O(K.publishableKey,{theme:"stripe"})),15e3,oe.current.signal);if(!ne)throw Error("Stripe crypto SDK unavailable");let ie=crypto.randomUUID();p({stripeSession:{id:ie,onramp:ne,privy:M,context:{sessionId:ie,config:K}}})})(b().privy,{publishableKey:S.publishable_key,network:S.network,sessionId:S.session_id,userEmail:v??"",userPhone:_,environment:T});let A=k();if(!A)return;let P=await U(A.privy,{environment:T});if(!y())return;if(P.status==="active"){let M=k();p({stripeSession:{...M,context:{...M.context,cryptoCustomerId:P.crypto_customer_id}}}),await H()}else p({state:{status:"stripe-flow",step:"choose-email"},isLoading:!1})}catch(x){console.error("[FiatOnramp:Stripe] Init failed:",x),p({state:{status:"provider-error"},isLoading:!1,error:Error("Something went wrong setting up checkout. Please try again.")})}return}let n=Ie();if(!n)return void p({state:{status:"provider-error"},error:Error("Unable to open payment window")});p({isLoading:!0});let{opts:i,amount:s,getProviderUrl:l,getStatus:a,controller:u}=b(),c=()=>{try{n.closed||n.close()}catch{}};u.current=new AbortController;try{let d=await l({source:{asset:i.source.selectedAsset.toUpperCase(),amount:s||"0"},destination:{asset:i.destination.asset.toUpperCase(),chain:i.destination.chain,address:i.destination.address},provider:t.provider,sub_provider:t.sub_provider??void 0,payment_method:t.payment_method,redirect_url:window.location.origin});if(d.type!=="url")throw Error("Expected URL response for popup-based provider");n.location.href=d.url,e=d.session_id}catch{return c(),void p({state:{status:"provider-error"},isLoading:!1,error:Error("Unable to start payment session")})}p({isLoading:!1}),p({state:{status:"provider-confirming"}});let m=await ve({operation:()=>a({session_id:e,provider:t.provider}),until:d=>d.status==="completed"||d.status==="failed"||d.status==="cancelled",delay:0,interval:2e3,attempts:60,signal:u.current.signal});if(m.status!=="aborted"){if(m.status==="max_attempts")return c(),m.error?(console.error(m.error),void p({state:{status:"select-amount"},isLoading:!1,error:Error("Unable to check payment status. Please try again.")})):void p({state:{status:"provider-error"},error:Error("Could not confirm payment status yet.")});m.result?.status==="completed"?(c(),p({state:{status:"provider-success"}})):(c(),p({state:{status:"provider-error"},error:Error(`Transaction ${m.result?.status??"failed"}`)}))}};let Et=e=>{if(e&&typeof e=="object"&&"publishable_key"in e&&"network"in e&&"session_id"in e)return e;throw Error("Unexpected response shape from provider_session_url for Stripe")};const St=()=>{let e=Ae();e&&e.length>0&&p({state:{status:"select-payment-method",quotes:e}})},At=()=>{p({state:{status:"select-source-asset"}})},Pt=()=>{p({error:null,state:{status:"select-amount"}})},Lt=e=>{p({localSelectedQuote:e,state:{status:"select-amount"}})},It=e=>{let{opts:t,amount:r}=b(),n={...t,source:{...t.source,selectedAsset:e}};p({opts:n,state:{status:"select-amount"}}),ge(r,n)},le=({element:e})=>{let t=g.useRef(null);return g.useEffect((()=>(t.current&&e&&t.current.replaceChildren(e),()=>{t.current&&t.current.replaceChildren()})),[e]),o.jsx("div",{ref:t,style:{minHeight:480}})},Tt=async(e,t)=>(await e.fetchPrivyRoute(et,{params:{session_id:t}})).client_secret,be=async(e,t)=>{let r=await e.fetchPrivyRoute(Je,{params:{session_id:t}});return{quoteExpiresAt:r.quote_expiration,sourceTotalAmount:r.source_total_amount,fee:r.fee,destinationAmount:r.destination_amount}},Mt=e=>!e||typeof e!="object"?null:e.transaction_details?.last_error??null,D=e=>{y()&&p({state:{status:"stripe-flow",step:e}})};let Nt=new Set(["transaction_limit_reached","location_not_supported","transaction_failed"]);const $t=async()=>{let e=k();try{let{stripeSessionId:t}=e.context;if(!t)throw Error("Missing stripeSessionId");p({isLoading:!0});for(let r=0;r<3;r++){if(!y())return;let n=null,i=await R(e.onramp.performCheckout(t,(async l=>{try{return await Tt(e.privy,l)}catch(a){return n=a,""}})),6e4,q());if(n)throw n;if(i.successful)return y()?void p({state:{status:"provider-success"},isLoading:!1}):void 0;let s=Mt(i);if(!s||Nt.has(s))throw Error(`Checkout failed: ${s??"unknown error"}`);if(!y())return;if(s==="charged_with_expired_quote")await be(e.privy,t);else if(s==="quote_rate_drifted"){let{opts:l,amount:a}=b(),{config:u,cryptoCustomerId:c,paymentToken:m}=e.context;if(!c||!m)throw Error("Cannot recreate session: missing customer or payment token");t=(await Z(e.privy,{sessionId:u.sessionId,environment:u.environment,session:{crypto_customer_id:c,payment_token:m,source_amount:a||"0",source_currency:l.source.selectedAsset.toUpperCase(),destination_currency:l.destination.asset.toUpperCase(),destination_network:u.network,wallet_address:l.destination.address}})).id;let d=k();p({stripeSession:{...d,context:{...d.context,stripeSessionId:t}}})}else{if(s==="missing_kyc"){let l=await U(e.privy,{environment:e.context.config.environment});if(!y())return;let a=l.status==="active"?l.provided_fields:[],u=F("l0",a);if(!u)throw Error("Checkout failed: missing_kyc but all fields already provided");let c=k();return void p({stripeSession:{...c,context:{...c.context,kycTier:"l0",kycProvidedFields:a}},state:{status:"stripe-flow",step:u}})}if(s==="missing_document_verification")D("kyc"),await e.onramp.verifyDocuments();else{if(s!=="missing_consumer_wallet")throw Error(`Checkout failed: ${s}`);{let{opts:l}=b();await e.onramp.registerWalletAddress(l.destination.address,we(e.context.config.network))}}}}throw Error("Checkout failed after maximum retry attempts")}catch(t){j(t)}},_e=async(e,{email:t,environment:r})=>(await e.fetchPrivyRoute(We,{body:{email:t,environment:r}})).data,je=async(e,t)=>{let r=k();try{if(await(async(i,{authIntentId:s,cryptoCustomerId:l,environment:a})=>{await i.fetchPrivyRoute(He,{body:{auth_intent_id:s,crypto_customer_id:l,environment:a}})})(r.privy,{authIntentId:t,cryptoCustomerId:e,environment:r.context.config.environment}),!y())return;(i=>{let s=k();p({stripeSession:{...s,context:{...s.context,...i}}})})({cryptoCustomerId:e});let n=await U(r.privy,{environment:r.context.config.environment});if(!y())return;if(n.status!=="active")throw Error("Session unexpectedly inactive after authentication");n.verifications.some((i=>i.status==="verified"))?await H():D("collect-name")}catch(n){j(n)}},Dt=async e=>{let t=k();try{p({isLoading:!0});let r=await _e(t.privy,{email:e,environment:t.context.config.environment});if(!y())return;if(p({isLoading:!1}),r.status==="no_account")p({stripeSession:{...t,context:{...t.context,pendingEmail:e}},state:{status:"stripe-flow",step:"create-link-account"},email:e});else{p({stripeSession:{...t,context:{...t.context,authIntentId:r.id,pendingEmail:e}},state:{status:"stripe-flow",step:"authenticating"},email:e});let n=await R(t.onramp.authenticate(r.id,(i=>{y()&&(i.result==="success"&&i.crypto_customer_id?je(i.crypto_customer_id,r.id):j(Error(`Link authentication ${i.result}`)))})),3e4,q());y()&&n&&p({stripeElement:n})}}catch(r){j(r)}},Q=async()=>{let e=k();try{let{kycName:t,kycDob:r,kycSsn:n,kycAddress:i,kycTier:s,config:l}=e.context,a={...t?{given_name:t.firstName,surname:t.lastName}:{},...r?{date_of_birth:{day:r.day,month:r.month,year:r.year}}:{},...n?{id_number:{type:"us_ssn",value:n}}:{},...i?{address:{line1:i.addressLine1,city:i.city,state:i.state,postal_code:i.postalCode,country:i.country}}:{}};if(D("kyc"),await e.onramp.submitKycInfo(a),n){let m=k();p({stripeSession:{...m,context:{...m.context,kycSsn:void 0}}})}if(!y())return;let u=s??"l0",c=await ve({operation:()=>U(e.privy,{environment:l.environment}),until:m=>{if(m.status!=="active")return!1;if(m.kyc_tiers?.length){let d=m.kyc_tiers.find((w=>w.tier===u));if(d)return d.verification_status==="verified"}return m.verifications.some((d=>d.status==="verified"))},delay:0,interval:2e3,attempts:Math.ceil(30),signal:q()});if(!y()||c.status==="aborted")return;if(c.status==="max_attempts")throw Error("KYC verification timed out");if(s==="l2"&&(D("kyc"),await e.onramp.verifyDocuments(),!y()))return;await H()}catch(t){j(t)}},zt=async e=>{let t=k(),r=t.context;p({stripeSession:{...t,context:{...r,kycAddress:e,kycProvidedFields:[...r.kycProvidedFields??[],"address_line_1","address_city","address_state","address_postal_code"]}}}),await Q()},Ut=({day:e,month:t,year:r})=>{let n=k(),i=n.context,s=i.kycTier??"l1",l=[...i.kycProvidedFields??[],"dob"],a=F(s,l);p({stripeSession:{...n,context:{...i,kycDob:{day:e,month:t,year:r},kycProvidedFields:l}},...a?{state:{status:"stripe-flow",step:a}}:{}}),a||Q()},qt=({firstName:e,lastName:t})=>{let r=k(),n=r.context,i=n.kycTier??"l0",s=[...n.kycProvidedFields??[],"first_name","last_name"],l=F(i,s);p({stripeSession:{...r,context:{...n,kycName:{firstName:e,lastName:t},kycProvidedFields:s}},...l?{state:{status:"stripe-flow",step:l}}:{}}),l||Q()},Rt=e=>{let t=k(),r=t.context,n=r.kycTier??"l1",i=[...r.kycProvidedFields??[],"id_number"],s=F(n,i);p({stripeSession:{...t,context:{...r,kycSsn:e,kycProvidedFields:i}},...s?{state:{status:"stripe-flow",step:s}}:{}}),s||Q()},J=async e=>{let t=k();try{let r=t.context.pendingEmail;if(!r)throw Error("No email in session context");if(e==="create"){let s=t.context.config.userPhone;if(!s)return void D("collect-contact");let l=await t.onramp.registerLinkUser(r,s,"US");if(!y())return;if(!l.created)throw Error("Failed to register Stripe Link account")}let n=await _e(t.privy,{email:r,environment:t.context.config.environment});if(!y())return;if(n.status!=="created")throw Error("Failed to create Link auth intent after registration");p({stripeSession:{...t,context:{...t.context,authIntentId:n.id}},state:{status:"stripe-flow",step:"authenticating"}});let i=await R(t.onramp.authenticate(n.id,(s=>{y()&&(s.result==="success"&&s.crypto_customer_id?je(s.crypto_customer_id,n.id):j(Error(`Link authentication ${s.result}`)))})),3e4,q());y()&&i&&p({stripeElement:i})}catch(r){j(r)}},Ft=e=>{let t=k(),r=ke([e],e.id);p({stripeSession:{...t,context:{...t.context,paymentToken:e.id,paymentMethodLabel:r}}}),Ce({paymentToken:e.id,loader:"inline"})},Bt=async e=>{let t=k();try{let r=t.context.pendingEmail;if(!r)throw Error("No email in session context");let n=await t.onramp.registerLinkUser(r,e,"US");if(!y())return;if(!n.created)throw Error("Failed to register Stripe Link account");await J("connect")}catch(r){j(r)}},Vt=async()=>{try{if(!y())return;let e=k(),t=e.context.stripeSessionId;if(!t)return;let r=await be(e.privy,t);if(!y())return;let n=e.context.checkoutDetails;if(n){let i=n.currencySymbol,s={...n,quoteExpiresAt:r.quoteExpiresAt,sourceAmount:r.sourceTotalAmount??n.sourceAmount,destinationAmount:r.destinationAmount??n.destinationAmount,fee:r.fee&&i?`${i}${r.fee}`:n.fee};p({stripeConfirmCheckoutDetails:s})}}catch(e){j(e)}},te=({height:e=24,...t})=>o.jsxs("svg",{height:e,viewBox:"120 0 72 24",fill:"none",xmlns:"http://www.w3.org/2000/svg",...t,children:[o.jsx("path",{d:"M132.258 24C138.856 24 144.205 18.6274 144.205 12C144.205 5.37257 138.856 0 132.258 0C125.66 0 120.312 5.37257 120.312 12C120.312 18.6274 125.66 24 132.258 24Z",fill:"#00D66F"}),o.jsx("path",{d:"M156.317 3.81824C156.317 2.69024 157.263 1.77344 158.377 1.77344C159.49 1.77344 160.436 2.69504 160.436 3.81824C160.436 4.94144 159.524 5.88704 158.377 5.88704C157.23 5.88704 156.317 4.97024 156.317 3.81824Z",fill:"#011E0F"}),o.jsx("path",{d:"M150.205 2.06143H153.789V22.2214H150.205V2.06143Z",fill:"#011E0F"}),o.jsx("path",{d:"M160.188 7.82143H156.575V22.2214H160.188V7.82143Z",fill:"#011E0F"}),o.jsx("path",{d:"M186.16 14.5319C188.879 12.8519 190.728 10.3511 191.459 7.81665H187.847C186.905 10.2359 184.745 12.0551 182.37 12.8279V2.05665H178.758V22.2167H182.37V16.2214C185.128 16.9126 187.307 19.3079 188.052 22.2167H191.689C191.134 19.1639 189.056 16.3079 186.16 14.5319Z",fill:"#011E0F"}),o.jsx("path",{d:"M166.591 9.43425C167.537 8.17185 169.382 7.43744 170.878 7.43744C173.668 7.43744 175.976 9.48705 175.981 12.5831V22.2167H172.369V13.3846C172.369 12.1126 171.805 10.6438 169.974 10.6438C167.824 10.6438 166.586 12.5591 166.586 14.8007V22.2262H162.974V7.83104H166.591V9.43425Z",fill:"#011E0F"}),o.jsx("path",{d:"M131.61 4.7998H127.958C128.668 7.80941 130.743 10.3822 133.339 11.9998C130.738 13.6174 128.668 16.1902 127.958 19.1998H131.61C132.515 16.4158 135.021 13.9966 138.1 13.5022V10.4926C135.016 10.003 132.51 7.58381 131.61 4.7998Z",fill:"#011E0F"})]}),B=h.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
`,E=h.input`
  && {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 1rem;
    line-height: 1.5rem;
    color: var(--privy-color-foreground);
    background: var(--privy-color-background);
    border: 1px solid
      ${e=>e.$hasError?"var(--privy-color-error, #dc3545)":"var(--privy-color-foreground-4)"};
    border-radius: var(--privy-border-radius-md, 0.5rem);
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.15s ease;

    &:focus {
      border-color: var(--privy-color-accent);
      box-shadow: 0 0 0 1px var(--privy-color-accent-light);
    }

    &::placeholder {
      color: var(--privy-color-foreground-3);
    }

    @media (min-width: 441px) {
      font-size: 0.875rem;
    }
  }
`,V=h.p`
  color: var(--privy-color-error, #dc3545);
  font-size: 0.8125rem;
  margin: 0.375rem 0 0;
`,Kt=h.select`
  && {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 1rem;
    line-height: 1.5rem;
    color: var(--privy-color-foreground);
    background: var(--privy-color-background);
    border: 1px solid
      ${e=>e.$hasError?"var(--privy-color-error, #dc3545)":"var(--privy-color-foreground-4)"};
    border-radius: var(--privy-border-radius-md, 0.5rem);
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.15s ease;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.75rem center;
    padding-right: 2rem;

    &:focus {
      border-color: var(--privy-color-accent);
      box-shadow: 0 0 0 1px var(--privy-color-accent-light);
    }

    @media (min-width: 441px) {
      font-size: 0.875rem;
    }
  }
`,Ee=h.div`
  display: flex;
  gap: 0.5rem;
`;h.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
  padding: 1rem;
  background: var(--privy-color-background-2, #f9f9f9);
  border-radius: var(--privy-border-radius-md, 0.5rem);
`,h.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`,h.span`
  font-size: 0.875rem;
  color: var(--privy-color-foreground-3);
`,h.span`
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--privy-color-foreground);
`;const Ot=h.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  padding: 1rem 1rem 0.75rem;
  border: 1px solid var(--privy-color-foreground-4);
  border-radius: 0.75rem;
`,Yt=h.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`,Wt=h.span`
  position: relative;
  width: 2rem;
  height: 2rem;
  flex-shrink: 0;
`,Ht=h.img`
  width: 2rem;
  height: 2rem;
  border-radius: 100px;
`,Qt=h.img`
  position: absolute;
  top: -2px;
  right: -2px;
  width: 0.875rem;
  height: 0.875rem;
  border-radius: 100px;
  border: 1.5px solid white;
`,ce=h.div`
  display: flex;
  flex-direction: column;
  text-align: left;
`,de=h.span`
  font-size: 0.75rem;
  font-weight: 400;
  line-height: 1.125rem;
  color: var(--privy-color-foreground-3);
`,ue=h.span`
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.375rem;
  color: var(--privy-color-foreground);
`,Xt=h.div`
  display: flex;
  flex-direction: column;
`,N=h.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.625rem 0;
  border-bottom: 1px solid var(--privy-color-foreground-4);
  font-size: 0.75rem;
  line-height: 1.125rem;

  &:last-child {
    border-bottom: none;
  }
`,$=h.span`
  color: var(--privy-color-foreground);
  font-weight: 400;
`,W=h.span`
  color: var(--privy-color-foreground);
  font-weight: 500;
  text-align: right;
  white-space: nowrap;
`,Gt=h.div`
  display: inline-flex;
  align-items: center;
  align-self: center;
  padding: 0.75rem 1rem;
  border: 1px solid var(--privy-color-foreground-4);
  border-radius: 999px;
  color: var(--privy-color-foreground);
  background: var(--privy-color-background);
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.25rem;
`,Zt=({onClose:e,onEmailChosen:t,onEmailBack:r,userEmail:n})=>{let[i,s]=g.useState(n??""),[l,a]=g.useState(null),[u,c]=g.useState(!1),m=async()=>{let d=i.trim();if(d)if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d)){c(!0);try{await t?.(d)}catch{c(!1)}}else a("Enter a valid email address");else a("Email is required")};return o.jsx(C,{showClose:!0,onClose:e,showBack:!!r,onBack:r??void 0,icon:o.jsx(te,{height:24}),iconVariant:"logo",title:"Add email",subtitle:"Enter your email address to continue with Link.",primaryCta:{label:"Submit",onClick:m,loading:u},watermark:!0,children:o.jsxs(B,{children:[o.jsx(E,{type:"email",placeholder:"email@example.com",value:i,onChange:d=>{s(d.target.value),a(null)},onKeyDown:d=>d.key==="Enter"&&m(),$hasError:!!l,autoFocus:!0}),l&&o.jsx(V,{children:l})]})})};let Jt=["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"];const er=({onClose:e,onAddressSubmitted:t,onBack:r})=>{let[n,i]=g.useState(""),[s,l]=g.useState(""),[a,u]=g.useState(""),[c,m]=g.useState(""),[d,w]=g.useState(null),[f,v]=g.useState(!1),_=()=>{n.trim()&&s.trim()&&a.trim()&&c.trim()?(v(!0),t?.({addressLine1:n.trim(),city:s.trim(),state:a.trim(),postalCode:c.trim(),country:"US"})):w("Complete address is required")};return o.jsx(C,{showClose:!0,onClose:e,showBack:!!r,onBack:r??void 0,icon:ct,title:"Add address",subtitle:"Enter your residential address as it appears on your government-issued ID.",primaryCta:{label:"Continue",onClick:_,loading:f},watermark:!0,children:o.jsxs(B,{children:[o.jsx(E,{placeholder:"Street address",value:n,onChange:x=>{i(x.target.value),w(null)},onKeyDown:x=>x.key==="Enter"&&_(),$hasError:!!d&&!n.trim(),autoFocus:!0}),o.jsxs(Ee,{children:[o.jsx(E,{placeholder:"City",value:s,onChange:x=>{l(x.target.value),w(null)},$hasError:!!d&&!s.trim()}),o.jsxs(Kt,{value:a,onChange:x=>{u(x.target.value),w(null)},$hasError:!!d&&!a,style:{maxWidth:"5.5rem"},children:[o.jsx("option",{value:"",disabled:!0,children:"State"}),Jt.map((x=>o.jsx("option",{value:x,children:x},x)))]}),o.jsx(E,{placeholder:"ZIP",value:c,onChange:x=>{m(x.target.value),w(null)},onKeyDown:x=>x.key==="Enter"&&_(),$hasError:!!d&&!c.trim(),style:{maxWidth:"6.25rem"}})]}),d&&o.jsx(V,{children:d})]})})},tr=({onClose:e,onDobSubmitted:t})=>{let[r,n]=g.useState(""),[i,s]=g.useState(""),[l,a]=g.useState(""),[u,c]=g.useState(null),m=()=>{let d=Number.parseInt(r,10),w=Number.parseInt(i,10),f=Number.parseInt(l,10);!d||!w||!f||d<1||d>12||w<1||w>31||f<1900||f>new Date().getFullYear()?c("Enter a valid date of birth"):t?.({day:w,month:d,year:f})};return o.jsx(C,{showClose:!0,onClose:e,icon:ot,title:"Add date of birth",subtitle:"You must be at least 18 years old.",primaryCta:{label:"Continue",onClick:m},watermark:!0,children:o.jsxs(B,{children:[o.jsxs(Ee,{children:[o.jsx(E,{placeholder:"MM",value:r,onChange:d=>{n(d.target.value),c(null)},$hasError:!!u,style:{flex:1},inputMode:"numeric",autoFocus:!0}),o.jsx(E,{placeholder:"DD",value:i,onChange:d=>{s(d.target.value),c(null)},$hasError:!!u,style:{flex:1},inputMode:"numeric"}),o.jsx(E,{placeholder:"YYYY",value:l,onChange:d=>{a(d.target.value),c(null)},onKeyDown:d=>d.key==="Enter"&&m(),$hasError:!!u,style:{flex:2},inputMode:"numeric"})]}),u&&o.jsx(V,{children:u})]})})},rr=({onClose:e,onNameSubmitted:t,isSandbox:r})=>{let[n,i]=g.useState(""),[s,l]=g.useState(r?"Verified":""),[a,u]=g.useState(null),c=()=>{n.trim()&&s.trim()?t?.({firstName:n.trim(),lastName:s.trim()}):u("First and last name are required")};return o.jsx(C,{showClose:!0,onClose:e,icon:mt,title:"Add name",subtitle:"Please enter your full legal name as it appears on your government-issued ID.",primaryCta:{label:"Continue",onClick:c},watermark:!0,children:o.jsxs(B,{children:[o.jsx(E,{placeholder:"First name",value:n,onChange:m=>{i(m.target.value),u(null)},onKeyDown:m=>m.key==="Enter"&&c(),$hasError:!!a&&!n.trim(),autoFocus:!0}),o.jsx(E,{placeholder:"Last name",value:s,onChange:m=>{l(m.target.value),u(null)},onKeyDown:m=>m.key==="Enter"&&c(),$hasError:!!a&&!s.trim(),readOnly:r}),a&&o.jsx(V,{children:a})]})})};let pe=e=>e.replace(/[\s()-]/g,"");const or=({onClose:e,onPhoneSubmitted:t,onPhoneBack:r})=>{let n=g.useRef(null),[i,s]=g.useState(!1),[l,a]=g.useState(!1);return o.jsx(C,{showClose:!0,onClose:e,showBack:!!r,onBack:r??void 0,icon:o.jsx(te,{height:24}),iconVariant:"logo",title:"Add phone number",subtitle:"Enter your phone number to continue with Link.",primaryCta:{label:"Submit",onClick:()=>{n.current?.isValid&&(a(!0),t?.(pe(n.current.qualifiedPhoneNumber)))},disabled:!i,loading:l},watermark:!0,children:o.jsx(ze,{stacked:!0,noIncludeSubmitButton:!0,hideRecent:!0,onChange:u=>{n.current=u,s(u.isValid)},onSubmit:async u=>{a(!0),t?.(pe(u.qualifiedPhoneNumber))}})})},nr=({onClose:e,onSsnSubmitted:t,appName:r})=>{let[n,i]=g.useState(""),[s,l]=g.useState(null),a=()=>{let u=n.replace(/\D/g,"");u.length===9?t?.(u):l("Enter your full 9-digit SSN")};return o.jsx(C,{showClose:!0,onClose:e,icon:Oe,title:"Add social security number",subtitle:`Required to verify your identity. ${r} will not store your SSN.`,primaryCta:{label:"Continue",onClick:a},watermark:!0,children:o.jsxs(B,{children:[o.jsx(E,{placeholder:"XXX-XX-XXXX",value:n,onChange:u=>{i(u.target.value),l(null)},onKeyDown:u=>u.key==="Enter"&&a(),$hasError:!!s,type:"password",inputMode:"numeric",autoComplete:"off",autoFocus:!0}),s&&o.jsx(V,{children:s})]})})},ir=({onClose:e,amount:t,appName:r,currencySymbol:n,paymentMethodLabel:i,fee:s,destinationAmount:l,destinationToken:a,destinationNetwork:u,tokenIconUrl:c,networkIconUrl:m,opts:d,onConfirmCheckout:w,quoteExpiresAt:f,onRefreshQuote:v,initialLoading:_=!1})=>{let[x,S]=g.useState(_),[T,A]=g.useState(!1),P=g.useRef(null);g.useEffect((()=>{if(!f||!v)return;let O=Math.max(f-Date.now()-5e3,0);return P.current=setTimeout((()=>{A(!0),v().finally((()=>A(!1)))}),O),()=>{P.current&&clearTimeout(P.current)}}),[f,v]);let M=d?.destination.address??"",K=Me(M,4,4);return o.jsx(C,{showClose:!0,onClose:e,title:"Approve transaction",subtitle:`${r} wants your permission for this transaction.`,primaryCta:{label:"Approve",onClick:()=>{P.current&&clearTimeout(P.current),S(!0),w?.()},loading:x,disabled:T},watermark:!0,children:o.jsxs(Ot,{children:[c||m?o.jsxs(Yt,{children:[o.jsxs(Wt,{children:[c&&o.jsx(Ht,{src:c,alt:a}),m&&o.jsx(Qt,{src:m,alt:u})]}),o.jsxs(ce,{children:[o.jsx(de,{children:"You receive"}),o.jsxs(ue,{children:[l," ",a," on ",u]})]})]}):o.jsxs(ce,{children:[o.jsx(de,{children:"You receive"}),o.jsxs(ue,{children:[l," ",a," on ",u]})]}),o.jsxs(Xt,{children:[o.jsxs(N,{children:[o.jsx($,{children:"Total amount"}),o.jsxs(W,{children:[n,t]})]}),i&&o.jsxs(N,{children:[o.jsx($,{children:"From"}),o.jsx(W,{children:i})]}),o.jsxs(N,{children:[o.jsx($,{children:"To"}),o.jsx(Ue,{iconOnly:!0,value:M,iconSize:16,children:K})]}),o.jsxs(N,{children:[o.jsx($,{children:"Estimated fee"}),o.jsx(W,{children:s})]}),o.jsxs(N,{children:[o.jsx($,{children:"Processing time"}),o.jsx(W,{children:"Instant"})]})]})]})})},re=({size:e=64,...t})=>o.jsxs("svg",{width:e,height:e,viewBox:"0 0 64 64",fill:"none",xmlns:"http://www.w3.org/2000/svg",...t,children:[o.jsx("path",{d:"M32 64C49.6731 64 64 49.6731 64 32C64 14.3269 49.6731 0 32 0C14.3269 0 0 14.3269 0 32C0 49.6731 14.3269 64 32 64Z",fill:"#00D66F"}),o.jsx("path",{d:"M30.5274 12.8003H20.6587C22.5787 20.8259 28.1851 27.6867 35.1995 32.0003C28.1723 36.3139 22.5787 43.1747 20.6587 51.2003H30.5274C32.9722 43.7763 39.7435 37.3251 48.0634 36.0067V27.9811C39.7307 26.6755 32.9594 20.2243 30.5274 12.8003Z",fill:"#011E0F"})]}),me=({mode:e,onClose:t,onLinkAccountConfirmed:r,onLinkAccountBack:n,userEmail:i})=>{let s=fe(),l=s?.name??"This app",a=e==="connect"?{title:"Connect to Link",subtitle:`${l} uses Link for quicker and easier checkout.`,description:`${l} will be able to view your Link account details, identity information, and saved payments.`,cta:"Continue"}:{title:"Create a Link account",subtitle:"With Link, you can securely save your information for faster checkout.",description:null,cta:"Continue"};return o.jsx(C,{showClose:!0,onClose:t,showBack:!!n,onBack:n??void 0,icon:o.jsx(re,{size:64}),iconVariant:"logo",title:a.title,subtitle:a.subtitle,primaryCta:{label:a.cta,onClick:()=>r?.()},helpText:a.description??void 0,watermark:!0,children:e==="create"&&i&&o.jsx(Gt,{children:i})})},sr=({onClose:e,tokens:t,onSelectToken:r,onAddNew:n,isLoading:i})=>{let[s,l]=g.useState(t[0]?.id??null);return o.jsx(C,{showClose:!0,onClose:e,icon:o.jsx(te,{height:24}),iconVariant:"logo",title:"Select payment method",subtitle:"Choose from your saved cards. Debit cards typically have higher success rates than credit cards.",primaryCta:{label:"Continue",onClick:()=>{let a=t.find((u=>u.id===s));a&&r(a)},loading:i,disabled:!s},watermark:!0,children:o.jsx(lr,{children:o.jsxs(cr,{children:[t.map((a=>o.jsxs(dr,{$selected:s===a.id,onClick:()=>l(a.id),disabled:i,children:[o.jsx(ur,{children:o.jsx(z,{size:16})}),o.jsxs(pr,{children:[o.jsx(mr,{children:ar(a.card?.brand,a.card?.funding)}),o.jsxs(hr,{children:[o.jsx(yr,{children:"••••"})," ",a.card?.last4??""]})]})]},a.id))),o.jsxs(fr,{onClick:n,disabled:i,children:[o.jsx(ut,{size:14}),o.jsx("span",{children:"Add new card"})]})]})})})};let ar=(e,t)=>{if(!e)return"Card";let r=e.charAt(0).toUpperCase()+e.slice(1);return t?`${r} ${t.charAt(0).toUpperCase()}${t.slice(1)}`:r},lr=h.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  width: 100%;
`,cr=h.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
`,dr=h.button`
  && {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.75rem;
    background: ${e=>e.$selected?"var(--privy-color-background-2, #f8f9ff)":"transparent"};
    border: ${e=>e.$selected?"1.5px solid var(--privy-color-accent)":"1px solid var(--privy-color-foreground-4)"};
    border-radius: var(--privy-border-radius-md, 0.5rem);
    cursor: pointer;
    transition: border-color 0.15s ease;
    box-shadow: ${e=>e.$selected?"0px 2px 6px rgba(50, 50, 93, 0.06), 0px 1px 1.5px rgba(0, 0, 0, 0.06)":"none"};
    outline: none;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`,ur=h.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1rem;
  flex-shrink: 0;
  color: var(--privy-color-foreground-3);
`,pr=h.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  flex: 1;
  min-width: 0;
`,mr=h.span`
  font-size: 0.875rem;
  font-weight: 400;
  line-height: 1.125rem;
  color: var(--privy-color-foreground);
  letter-spacing: -0.15px;
`,hr=h.span`
  font-size: 0.75rem;
  font-weight: 400;
  line-height: 1rem;
  color: var(--privy-color-foreground-3);
`,yr=h.span`
  font-weight: 500;
`,fr=h.button`
  && {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    padding: 1rem;
    background: none;
    border: none;
    font-size: 0.875rem;
    font-weight: 500;
    line-height: 1.25rem;
    color: var(--privy-color-accent);
    cursor: pointer;
  }

  &:focus,
  &:focus-visible {
    outline: none;
  }

  &:hover:not(:disabled) {
    opacity: 0.8;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`,vr=[];const gr=({step:e,element:t,onClose:r,isLoading:n})=>{let i=fe(),s=i?.name??"This app",l=L((v=>v?.email??null)),a=L((v=>v?.amount??"")),u=L((v=>v?.opts??null)),c=L((v=>v?.stripeConfirmCheckoutDetails??null)),m=L((v=>v?.destinationCurrencyIconUrl??null)),d=L((v=>v?.destinationNetworkIconUrl??null)),w=L((v=>v?.stripeSession?.context.savedPaymentTokens))??vr,f=()=>{ee(),p({state:{status:"select-amount"},isLoading:!1})};switch(e){case"choose-email":return o.jsx(Zt,{onClose:r,onEmailChosen:Dt,onEmailBack:f,userEmail:l});case"connect-link":return o.jsx(me,{mode:"connect",onClose:r,onLinkAccountConfirmed:()=>{J("connect")},onLinkAccountBack:f,userEmail:l});case"create-link-account":return o.jsx(me,{mode:"create",onClose:r,onLinkAccountConfirmed:()=>{J("create")},onLinkAccountBack:f,userEmail:l});case"collect-contact":return o.jsx(or,{onClose:r,onPhoneSubmitted:Bt,onPhoneBack:f});case"collect-name":return o.jsx(rr,{onClose:r,onNameSubmitted:qt,isSandbox:u?.environment!=="production"});case"collect-dob":return o.jsx(tr,{onClose:r,onDobSubmitted:Ut});case"collect-ssn":return o.jsx(nr,{onClose:r,onSsnSubmitted:Rt,appName:s});case"collect-address":return o.jsx(er,{onClose:r,onAddressSubmitted:zt,onBack:f});case"authenticating":return o.jsx(le,{element:t});case"kyc":return o.jsx(C,{showClose:!0,onClose:r,iconVariant:"loading",title:"Verifying identity",subtitle:"This may take a moment...",watermark:!0});case"select-payment":return o.jsx(sr,{onClose:r,tokens:w,onSelectToken:Ft,onAddNew:()=>{H({skipTokenCheck:!0})},isLoading:n});case"payment":return o.jsx(C,{showClose:!0,onClose:r,showBack:!0,onBack:f,headerTitle:"Add payment method",watermark:!0,children:o.jsx(le,{element:t})});case"confirm-checkout":return o.jsx(ir,{onClose:r,amount:c?.sourceAmount??a,appName:s,currencySymbol:c?.currencySymbol??"$",paymentMethodLabel:c?.paymentMethodLabel??null,fee:c?.fee??"Included",destinationAmount:c?.destinationAmount??a,destinationToken:c?.destinationToken??u?.destination.asset?.toUpperCase()??"",destinationNetwork:c?.destinationNetwork??"",tokenIconUrl:m,networkIconUrl:d,opts:u,onConfirmCheckout:$t,quoteExpiresAt:c?.quoteExpiresAt??null,onRefreshQuote:Vt});case"checkout":return o.jsx(C,{showClose:!0,onClose:r,iconVariant:"loading",watermark:!0});case"collect-country":case"collect-nationality":case"collect-birth-location":case"collect-identifiers":case"eu-attestation":case"verify-documents":return o.jsx(C,{showClose:!0,onClose:r,iconVariant:"loading",title:"Verifying identity",watermark:!0});default:return null}},xr=({onClose:e})=>o.jsx(C,{showClose:!0,onClose:e,iconVariant:"loading",title:"Processing transaction",subtitle:"Your purchase is in progress. You can leave this screen — we’ll notify you when it’s complete.",primaryCta:{label:"Done",onClick:e},watermark:!0}),wr=({onClose:e,onRetry:t})=>o.jsx(C,{showClose:!0,onClose:e,icon:Ve,iconVariant:"error",title:"Something went wrong",subtitle:"We couldn't complete your transaction. Please try again.",primaryCta:{label:"Try again",onClick:t},secondaryCta:{label:"Close",onClick:e},watermark:!0}),kr=({onClose:e})=>o.jsx(C,{showClose:!0,onClose:e,icon:Ke,iconVariant:"success",title:"Transaction confirmed",subtitle:"Your purchase is processing. Funds should arrive in your wallet within a few minutes.",primaryCta:{label:"Done",onClick:e},watermark:!0});let Cr={CREDIT_DEBIT_CARD:"card",APPLE_PAY:"Apple Pay",GOOGLE_PAY:"Google Pay",BANK:"bank deposit",BANK_TRANSFER:"bank deposit",SEPA:"bank deposit",PIX:"PIX",STRIPE_LINK:"Link"},br=e=>Cr[e]??e.replace(/_/g," ").toLowerCase().replace(/^\w/,(t=>t.toUpperCase())),_r={CREDIT_DEBIT_CARD:o.jsx(z,{size:14}),APPLE_PAY:o.jsx(se,{size:14}),GOOGLE_PAY:o.jsx(se,{size:14}),BANK:o.jsx(X,{size:14}),BANK_TRANSFER:o.jsx(X,{size:14}),SEPA:o.jsx(X,{size:14}),PIX:o.jsx(Ye,{size:14}),STRIPE_LINK:o.jsx(re,{size:14})},jr=e=>_r[e]??o.jsx(z,{size:14});const Er=({opts:e,onClose:t,onEditSourceAsset:r,onEditPaymentMethod:n,onContinue:i,onAmountChange:s,amount:l,selectedQuote:a,quotesWarning:u,quotesErrors:c,quotesCount:m,isLoading:d})=>o.jsxs(C,{showClose:!0,onClose:t,headerTitle:`Buy ${e.destination.asset.toLocaleUpperCase()}`,primaryCta:{label:"Continue",onClick:i,loading:d,disabled:!a},helpText:u?o.jsxs(Sr,{children:[o.jsx(Be,{size:16,strokeWidth:2}),o.jsx(he,{children:o.jsxs(o.Fragment,u==="amount_too_low"?{children:[o.jsx(ye,{children:"Amount too low"}),o.jsx(G,{children:"Please choose a higher amount to continue."})]}:{children:[o.jsx(ye,{children:"Unable to get quotes"}),o.jsx(G,{children:c?.[0]?.error??"Something went wrong. Please try again."})]})})]}):a&&m>1?o.jsxs(Pr,{onClick:n,children:[jr(a.payment_method_category??a.payment_method),o.jsxs("span",{children:["Pay with"," ",br(a.payment_method_category??a.payment_method)]}),o.jsx(it,{size:14})]}):null,watermark:!0,children:[a?.warning&&o.jsxs(Ar,{children:[o.jsx(Fe,{size:16,strokeWidth:2}),o.jsx(he,{children:o.jsx(G,{children:a.warning})})]}),o.jsx($e,{currency:e.source.selectedAsset,value:l,onChange:s,inputMode:"decimal",autoFocus:!0}),o.jsx(De,{selectedAsset:e.source.selectedAsset,onEditSourceAsset:r})]});let Sr=h.div`
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.75rem;
  border-radius: 0.5rem;
  background-color: var(--privy-color-warn-bg, #fffbbb);
  border: 1px solid var(--privy-color-border-warning, #facd63);
  overflow: clip;
  width: 100%;

  svg {
    flex-shrink: 0;
    color: var(--privy-color-icon-warning, #facd63);
  }
`,Ar=h.div`
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.75rem;
  border-radius: 0.5rem;
  background-color: var(--privy-color-info-bg, #f0f4ff);
  border: 1px solid var(--privy-color-border-info, #bfcfff);
  overflow: clip;
  width: 100%;
  margin-bottom: 0.75rem;

  svg {
    flex-shrink: 0;
    color: var(--privy-color-icon-info, #6b8aed);
  }
`,he=h.div`
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  flex: 1;
  min-width: 0;
  font-size: 0.75rem;
  line-height: 1.125rem;
  color: var(--privy-color-foreground);
  font-feature-settings:
    'calt' 0,
    'kern' 0;
  text-align: left;
`,ye=h.span`
  font-weight: 600;
`,G=h.span`
  font-weight: 400;
`,Pr=h.button`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  background: none;
  border: none;
  cursor: pointer;

  && {
    padding: 0;
    color: var(--privy-color-accent);
    font-size: 0.875rem;
    font-style: normal;
    font-weight: 500;
    line-height: 1.375rem;
  }
`,Lr={CREDIT_DEBIT_CARD:"Credit / debit card",APPLE_PAY:"Apple Pay",GOOGLE_PAY:"Google Pay",BANK:"Bank transfer",BANK_TRANSFER:"Bank transfer",SEPA:"SEPA",PIX:"PIX",STRIPE_LINK:"Link"},Ir=e=>Lr[e]??e.replace(/_/g," ").toLowerCase().replace(/^\w/,(t=>t.toUpperCase())),Tr={CREDIT_DEBIT_CARD:o.jsx(z,{size:20}),APPLE_PAY:o.jsx(Re,{width:20,height:20}),GOOGLE_PAY:o.jsx(qe,{width:20,height:20}),BANK:o.jsx(Y,{size:20}),BANK_TRANSFER:o.jsx(Y,{size:20}),SEPA:o.jsx(Y,{size:20}),PIX:o.jsx(Y,{size:20}),STRIPE_LINK:o.jsx(re,{size:20})},Mr=e=>Tr[e]??o.jsx(z,{size:20});const Nr=({onClose:e,onSelectPaymentMethod:t,quotes:r,isLoading:n})=>o.jsx(C,{showClose:!0,onClose:e,title:"Select payment method",subtitle:"Choose how you'd like to pay",watermark:!0,children:o.jsx($r,{children:r.map(((i,s)=>{let l=i.payment_method_category??i.payment_method;return o.jsx(Dr,{onClick:()=>t(i),disabled:n,children:o.jsxs(zr,{children:[o.jsx(Ur,{children:Mr(l)}),o.jsx(qr,{children:o.jsx(Rr,{children:Ir(l)})})]})},`${i.provider}-${i.payment_method}-${s}`)}))})});let $r=h.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
`,Dr=h.button`
  border-color: var(--privy-color-border-default);
  border-width: 1px;
  border-radius: var(--privy-border-radius-md);
  border-style: solid;
  display: flex;

  && {
    padding: 1rem 1rem;
  }
`,zr=h.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  width: 100%;
`,Ur=h.div`
  color: var(--privy-color-foreground-3);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`,qr=h.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.125rem;
  flex: 1;
`,Rr=h.span`
  color: var(--privy-color-foreground);
  font-size: 0.875rem;
  font-weight: 400;
  line-height: 1.25rem;
`;const Fr=({onClose:e,onContinue:t,onAmountChange:r,onSelectSource:n,onEditSourceAsset:i,onEditPaymentMethod:s,onSelectPaymentMethod:l,onRetry:a,opts:u,state:c,amount:m,selectedQuote:d,quotesWarning:w,quotesErrors:f,quotesCount:v,isLoading:_,stripeElement:x})=>c.status==="select-amount"?o.jsx(Er,{onClose:e,onContinue:t,onAmountChange:r,onEditSourceAsset:i,onEditPaymentMethod:s,opts:u,amount:m,selectedQuote:d,quotesWarning:w,quotesErrors:f,quotesCount:v,isLoading:_}):c.status==="select-source-asset"?o.jsx(Ne,{onSelectSource:n,opts:u,isLoading:_}):c.status==="select-payment-method"?o.jsx(Nr,{onClose:e,onSelectPaymentMethod:l,quotes:c.quotes,isLoading:_}):c.status==="stripe-flow"?o.jsx(gr,{step:c.step,element:x,onClose:e,isLoading:_}):c.status==="provider-confirming"?o.jsx(xr,{onClose:e}):c.status==="provider-error"?o.jsx(wr,{onClose:e,onRetry:a}):c.status==="provider-success"?o.jsx(kr,{onClose:e}):null,co={component:()=>{let{onUserCloseViaDialogOrKeybindRef:e}=Se(),t=L();if(!t)return null;let{opts:r,state:n,isLoading:i,amount:s,quotesWarning:l,quotesErrors:a,localQuotes:u,localSelectedQuote:c,initialQuotes:m,initialSelectedQuote:d,stripeElement:w}=t;return e.current=ae,o.jsx(Fr,{onClose:ae,opts:r,state:n,isLoading:i,amount:s,selectedQuote:c??d,quotesWarning:l,quotesErrors:a,quotesCount:(u??m)?.length??0,onAmountChange:yt,onContinue:jt,onSelectSource:It,onEditSourceAsset:At,onEditPaymentMethod:St,onSelectPaymentMethod:Lt,onRetry:Pt,stripeElement:w})}};export{co as FiatOnrampScreen,co as default};
