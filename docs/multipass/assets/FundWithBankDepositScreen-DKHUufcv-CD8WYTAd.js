import{bn as B,aP as P,aU as m,cU as F,aR as t,cV as z,bl as D,bf as v}from"./index-CVv1UEH9.js";import{p as V}from"./CopyableText-ChtfBWx4-BavNFqmb.js";import{n as C}from"./ScreenLayout-Ce16-u0i-Caa_yKD8.js";import{i as R}from"./InfoBanner-DkQEPd77-C0M89tu3.js";import{y as M,c as Y,p as q}from"./SelectSourceAsset-BSIZrvmo-D3MDRsO5.js";import{r as A}from"./chevron-down-2p6K2Fdo.js";import{c as H}from"./createLucideIcon-D7ov84-C.js";import{H as K}from"./hourglass-a2S06ORC.js";import{C as N}from"./check-DKuwLW6k.js";import{C as S}from"./circle-x-Bg0NY217.js";import"./copy-ByGexnjt.js";import"./ModalHeader-YbJk-YIQ-mbcKmHEk.js";import"./Screen-CdOj1bUg-DfiZcmHy.js";import"./index-Dq_xe9dz-D3-ymV7v.js";const O=[["path",{d:"m16 11 2 2 4-4",key:"9rsbq5"}],["path",{d:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",key:"1yyitq"}],["circle",{cx:"9",cy:"7",r:"4",key:"nufk8"}]],X=H("user-check",O),G=e=>{try{return e.location.origin}catch{return}},J=({data:e,onClose:i})=>t.jsx(C,{showClose:!0,onClose:i,title:"Initiate bank transfer",subtitle:"Use the details below to complete a bank transfer from your bank.",primaryCta:{label:"Done",onClick:i},watermark:!1,footerText:"Exchange rates and fees are set when you authorize and determine the amount you receive. You'll see the applicable rates and fees for your transaction separately",children:t.jsx(Q,{children:(z[e.deposit_instructions.asset]||[]).map((([u,f],y)=>{let d=e.deposit_instructions[u];if(!d||Array.isArray(d))return null;let r=u==="asset"?d.toUpperCase():d,h=r.length>100?`${r.slice(0,9)}...${r.slice(-9)}`:r;return t.jsxs(Z,{children:[t.jsx(ee,{children:f}),t.jsx(V,{value:r,includeChildren:D.isMobile,children:t.jsx(te,{children:h})})]},y)}))})});let Q=v.ol`
  border-color: var(--privy-color-border-default);
  border-width: 1px;
  border-radius: var(--privy-border-radius-mdlg);
  border-style: solid;
  display: flex;
  flex-direction: column;

  && {
    padding: 0 1rem;
  }
`,Z=v.li`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 0;

  &:not(:first-of-type) {
    border-top: 1px solid var(--privy-color-border-default);
  }

  & > {
    :nth-child(1) {
      flex-basis: 30%;
    }

    :nth-child(2) {
      flex-basis: 60%;
    }
  }
`,ee=v.span`
  color: var(--privy-color-foreground);
  font-kerning: none;
  font-variant-numeric: lining-nums proportional-nums;
  font-feature-settings: 'calt' off;

  /* text-xs/font-regular */
  font-size: 0.75rem;
  font-style: normal;
  font-weight: 400;
  line-height: 1.125rem; /* 150% */

  text-align: left;
  flex-shrink: 0;
`,te=v.span`
  color: var(--privy-color-foreground);
  font-kerning: none;
  font-feature-settings: 'calt' off;

  /* text-sm/font-medium */
  font-size: 0.875rem;
  font-style: normal;
  font-weight: 500;
  line-height: 1.375rem; /* 157.143% */

  text-align: right;
  word-break: break-all;
`;const se=({onClose:e})=>t.jsx(C,{showClose:!0,onClose:e,icon:S,iconVariant:"error",title:"Something went wrong",subtitle:"We couldn't complete account setup. This isn't caused by anything you did.",primaryCta:{label:"Close",onClick:e},watermark:!0}),re=({onClose:e,reason:i})=>{let u=i?i.charAt(0).toLowerCase()+i.slice(1):void 0;return t.jsx(C,{showClose:!0,onClose:e,icon:S,iconVariant:"error",title:"Identity verification failed",subtitle:u?`We can't complete identity verification because ${u}. Please try again or contact support for assistance.`:"We couldn't verify your identity. Please try again or contact support for assistance.",primaryCta:{label:"Close",onClick:e},watermark:!0})},oe=({onClose:e,email:i})=>t.jsx(C,{showClose:!0,onClose:e,icon:K,title:"Identity verification in progress",subtitle:"We're waiting for Persona to approve your identity verification. This usually takes a few minutes, but may take up to 24 hours.",primaryCta:{label:"Done",onClick:e},watermark:!0,children:t.jsxs(R,{theme:"light",children:["You'll receive an email at ",i," once approved with instructions for completing your deposit."]})}),ae=({onClose:e,onAcceptTerms:i,isLoading:u})=>t.jsx(C,{showClose:!0,onClose:e,icon:X,title:"Verify your identity to continue",subtitle:"Finish verification with Persona — it takes just a few minutes and requires a government ID.",helpText:t.jsxs(t.Fragment,{children:[`This app uses Bridge to securely connect accounts and move funds. By clicking "Accept," you agree to Bridge's`," ",t.jsx("a",{href:"https://www.bridge.xyz/legal",target:"_blank",rel:"noopener noreferrer",children:"Terms of Service"})," ","and"," ",t.jsx("a",{href:"https://www.bridge.xyz/legal/row-privacy-policy/bridge-building-limited",target:"_blank",rel:"noopener noreferrer",children:"Privacy Policy"}),"."]}),primaryCta:{label:"Accept and continue",onClick:i,loading:u},watermark:!0}),ie=({onClose:e})=>t.jsx(C,{showClose:!0,onClose:e,icon:N,iconVariant:"success",title:"Identity verified successfully",subtitle:"We've successfully verified your identity. Now initiate a bank transfer to view instructions.",primaryCta:{label:"Initiate bank transfer",onClick:()=>{},loading:!0},watermark:!0}),ne=({opts:e,onClose:i,onEditSourceAsset:u,onSelectAmount:f,isLoading:y})=>t.jsxs(C,{showClose:!0,onClose:i,headerTitle:`Buy ${e.destination.asset.toLocaleUpperCase()}`,primaryCta:{label:"Continue",onClick:f,loading:y},watermark:!0,children:[t.jsx(Y,{currency:e.source.selectedAsset,inputMode:"decimal",autoFocus:!0}),t.jsx(q,{selectedAsset:e.source.selectedAsset,onEditSourceAsset:u})]}),le=({onClose:e,onAcceptTerms:i,onSelectAmount:u,onSelectSource:f,onEditSourceAsset:y,opts:d,state:r,email:h,isLoading:n})=>r.status==="select-amount"?t.jsx(ne,{onClose:e,onSelectAmount:u,onEditSourceAsset:y,opts:d,isLoading:n}):r.status==="select-source-asset"?t.jsx(M,{onSelectSource:f,opts:d,isLoading:n}):r.status==="kyc-prompt"?t.jsx(ae,{onClose:e,onAcceptTerms:i,opts:d,isLoading:n}):r.status==="kyc-incomplete"?t.jsx(oe,{onClose:e,email:h}):r.status==="kyc-success"?t.jsx(ie,{onClose:e}):r.status==="kyc-error"?t.jsx(re,{onClose:e,reason:r.reason}):r.status==="account-details"?t.jsx(J,{onClose:e,data:r.data}):r.status==="create-customer-error"||r.status==="get-customer-error"?t.jsx(se,{onClose:e}):null,we={component:()=>{let{user:e}=B(),i=P().data;if(!i?.FundWithBankDepositScreen)throw Error("Missing data");let{onSuccess:u,onFailure:f,opts:y,createOrUpdateCustomer:d,getCustomer:r,getOrCreateVirtualAccount:h}=i.FundWithBankDepositScreen,[n,j]=m.useState(y),[b,s]=m.useState({status:"select-amount"}),[x,c]=m.useState(null),[U,a]=m.useState(!1),k=m.useRef(null),E=m.useCallback((async()=>{let o;a(!0),c(null);try{o=await r({kycRedirectUrl:window.location.origin})}catch(l){if(!l||typeof l!="object"||!("status"in l)||l.status!==404)return s({status:"get-customer-error"}),c(l),void a(!1)}if(!o)try{o=await d({hasAcceptedTerms:!1,kycRedirectUrl:window.location.origin})}catch(l){return s({status:"create-customer-error"}),c(l),void a(!1)}if(!o)return s({status:"create-customer-error"}),c(Error("Unable to create customer")),void a(!1);if(o.status==="not_started"&&o.kyc_url)return s({status:"kyc-prompt",kycUrl:o.kyc_url}),void a(!1);if(o.status==="not_started")return s({status:"get-customer-error"}),c(Error("Unexpected user state")),void a(!1);if(o.status==="rejected")return s({status:"kyc-error",reason:o.rejection_reasons?.[0]?.reason}),c(Error("User KYC rejected.")),void a(!1);if(o.status==="incomplete")return s({status:"kyc-incomplete"}),void a(!1);if(o.status!=="active")return s({status:"get-customer-error"}),c(Error("Unexpected user state")),void a(!1);o.status;try{let l=await h({destination:n.destination,provider:n.provider,source:{asset:n.source.selectedAsset}});s({status:"account-details",data:l})}catch(l){return s({status:"create-customer-error"}),c(l),void a(!1)}}),[n]),_=m.useCallback((async()=>{if(c(null),a(!0),b.status!=="kyc-prompt")return c(Error("Unexpected state")),void a(!1);let o=F({location:b.kycUrl});if(await d({hasAcceptedTerms:!0}),!o)return c(Error("Unable to begin kyc flow.")),a(!1),void s({status:"create-customer-error"});k.current=new AbortController;let l=await(async(p,L)=>{let w=await A({operation:async()=>({done:G(p)===window.location.origin,closed:p.closed}),until:({done:I,closed:W})=>I||W,delay:0,interval:500,attempts:360,signal:L});return w.status==="aborted"?(p.close(),{status:"aborted"}):w.status==="max_attempts"?{status:"timeout"}:w.result.done?(p.close(),{status:"redirected"}):{status:"closed"}})(o,k.current.signal);if(l.status==="aborted")return;if(l.status==="closed")return void a(!1);l.status;let g=await A({operation:()=>r({}),until:p=>p.status==="active"||p.status==="rejected",delay:0,interval:2e3,attempts:60,signal:k.current.signal});if(g.status!=="aborted"){if(g.status==="max_attempts")return s({status:"kyc-incomplete"}),void a(!1);if(g.status,g.result.status==="rejected")return s({status:"kyc-error",reason:g.result.rejection_reasons?.[0]?.reason}),c(Error("User KYC rejected.")),void a(!1);if(g.result.status!=="active")return s({status:"kyc-incomplete"}),void a(!1);o.closed||o.close(),g.result.status;try{s({status:"kyc-success"});let p=await h({destination:n.destination,provider:n.provider,source:{asset:n.source.selectedAsset}});s({status:"account-details",data:p})}catch(p){s({status:"create-customer-error"}),c(p)}finally{a(!1)}}}),[s,c,a,d,h,b,n,k]),T=m.useCallback((o=>{s({status:"select-amount"}),j({...n,source:{...n.source,selectedAsset:o}})}),[s,j]),$=m.useCallback((()=>{s({status:"select-source-asset"})}),[s]);return t.jsx(le,{onClose:m.useCallback((async()=>{k.current?.abort(),x?f(x):await u()}),[x,k]),opts:n,state:b,isLoading:U,email:e.email.address,onAcceptTerms:_,onSelectAmount:E,onSelectSource:T,onEditSourceAsset:$})}};export{we as FundWithBankDepositScreen,we as default};
