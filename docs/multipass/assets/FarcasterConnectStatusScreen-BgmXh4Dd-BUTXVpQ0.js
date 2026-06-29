import{bn as N,aP as U,aQ as M,aS as D,aU as n,aW as d,bw as W,bj as A,aR as r,bl as F,bg as z,bf as s}from"./index-CVv1UEH9.js";import{n as B}from"./OpenLink-DZHy38vr-DApR7Mav.js";import{C as P}from"./QrCode-BxAVhbx2-C4lgQJ2B.js";import{$ as q}from"./ModalHeader-YbJk-YIQ-mbcKmHEk.js";import{r as V}from"./LabelXs-oqZNqbm_-7zWYVW9Q.js";import{a as Q}from"./shouldProceedtoEmbeddedWalletCreationFlow-CBt9hKD6-CHbNgUpB.js";import{n as H}from"./ScreenLayout-Ce16-u0i-Caa_yKD8.js";import{l as $}from"./farcaster-DPlSjvF5-87guPDdt.js";import{C as J}from"./check-DKuwLW6k.js";import{C as K}from"./copy-ByGexnjt.js";import"./dijkstra-COg3n3zL.js";import"./Screen-CdOj1bUg-DfiZcmHy.js";import"./index-Dq_xe9dz-D3-ymV7v.js";import"./createLucideIcon-D7ov84-C.js";let X=s.div`
  width: 100%;
`,Y=s.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem;
  height: 56px;
  background: ${e=>e.$disabled?"var(--privy-color-background-2)":"var(--privy-color-background)"};
  border: 1px solid var(--privy-color-foreground-4);
  border-radius: var(--privy-border-radius-md);

  &:hover {
    border-color: ${e=>e.$disabled?"var(--privy-color-foreground-4)":"var(--privy-color-foreground-3)"};
  }
`,G=s.div`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
`,O=s.span`
  display: block;
  font-size: 16px;
  line-height: 24px;
  color: ${e=>e.$disabled?"var(--privy-color-foreground-2)":"var(--privy-color-foreground)"};
  overflow: hidden;
  text-overflow: ellipsis;
  /* Use single-line truncation without nowrap to respect container width */
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  word-break: break-all;

  @media (min-width: 441px) {
    font-size: 14px;
    line-height: 20px;
  }
`,Z=s(O)`
  color: var(--privy-color-foreground-3);
  font-style: italic;
`,ee=s(V)`
  margin-bottom: 0.5rem;
`,re=s(q)`
  && {
    gap: 0.375rem;
    font-size: 14px;
    flex-shrink: 0;
  }
`;const te=({value:e,title:u,placeholder:l,className:t,showCopyButton:c=!0,truncate:o,maxLength:p=40,disabled:m=!1})=>{let[h,x]=n.useState(!1),w=o&&e?((a,S,f)=>{if((a=a.startsWith("https://")?a.slice(8):a).length<=f)return a;if(S==="middle"){let b=Math.ceil(f/2)-2,E=Math.floor(f/2)-1;return`${a.slice(0,b)}...${a.slice(-E)}`}return`${a.slice(0,f-3)}...`})(e,o,p):e;return n.useEffect((()=>{if(h){let a=setTimeout((()=>x(!1)),3e3);return()=>clearTimeout(a)}}),[h]),r.jsxs(X,{className:t,children:[u&&r.jsx(ee,{children:u}),r.jsxs(Y,{$disabled:m,children:[r.jsx(G,{children:e?r.jsx(O,{$disabled:m,title:e,children:w}):r.jsx(Z,{$disabled:m,children:l||"No value"})}),c&&e&&r.jsx(re,{onClick:function(a){a.stopPropagation(),navigator.clipboard.writeText(e).then((()=>x(!0))).catch(console.error)},size:"sm",children:r.jsxs(r.Fragment,h?{children:["Copied",r.jsx(J,{size:14})]}:{children:["Copy",r.jsx(K,{size:14})]})})]})]})},ae=({connectUri:e,loading:u,success:l,errorMessage:t,onBack:c,onClose:o,onOpenFarcaster:p})=>r.jsx(H,F.isMobile||u?F.isIOS?{title:t?t.message:"Sign in with Farcaster",subtitle:t?t.detail:"To sign in with Farcaster, please open the Farcaster app.",icon:$,iconVariant:"loading",iconLoadingStatus:{success:l,fail:!!t},primaryCta:e&&p?{label:"Open Farcaster app",onClick:p}:void 0,onBack:c,onClose:o,watermark:!0}:{title:t?t.message:"Signing in with Farcaster",subtitle:t?t.detail:"This should only take a moment",icon:$,iconVariant:"loading",iconLoadingStatus:{success:l,fail:!!t},onBack:c,onClose:o,watermark:!0,children:e&&F.isMobile&&r.jsx(ie,{children:r.jsx(B,{text:"Take me to Farcaster",url:e,color:"#8a63d2"})})}:{title:"Sign in with Farcaster",subtitle:"Scan with your phone's camera to continue.",onBack:c,onClose:o,watermark:!0,children:r.jsxs(oe,{children:[r.jsx(se,{children:e?r.jsx(P,{url:e,size:275,squareLogoElement:$}):r.jsx(ce,{children:r.jsx(z,{})})}),r.jsxs(ne,{children:[r.jsx(le,{children:"Or copy this link and paste it into a phone browser to open the Farcaster app."}),e&&r.jsx(te,{value:e,truncate:"end",maxLength:30,showCopyButton:!0,disabled:!0})]})]})}),Ce={component:()=>{let{authenticated:e,logout:u,ready:l,user:t}=N(),{lastScreen:c,navigate:o,navigateBack:p,setModalData:m}=U(),h=M(),{getAuthFlow:x,loginWithFarcaster:w,closePrivyModal:a,createAnalyticsEvent:S}=D(),[f,b]=n.useState(void 0),[E,R]=n.useState(!1),[y,I]=n.useState(!1),C=n.useRef([]),_=x(),T=_?.meta.connectUri;return n.useEffect((()=>{let g=Date.now(),k=setInterval((async()=>{let j=await _.pollForReady.execute(),L=Date.now()-g;if(j){clearInterval(k),R(!0);try{await w(),I(!0)}catch(i){let v={retryable:!1,message:"Authentication failed"};if(i?.privyErrorCode===d.ALLOWLIST_REJECTED)return void o("AllowlistRejectionScreen");if(i?.privyErrorCode===d.USER_LIMIT_REACHED)return console.error(new W(i).toString()),void o("UserLimitReachedScreen");if(i?.privyErrorCode===d.USER_DOES_NOT_EXIST)return void o("AccountNotFoundScreen");if(i?.privyErrorCode===d.LINKED_TO_ANOTHER_USER)v.detail=i.message??"This account has already been linked to another user.";else{if(i?.privyErrorCode===d.ACCOUNT_TRANSFER_REQUIRED&&i.data?.data?.nonce)return m({accountTransfer:{nonce:i.data?.data?.nonce,account:i.data?.data?.subject,displayName:i.data?.data?.account?.displayName,linkMethod:"farcaster",embeddedWalletAddress:i.data?.data?.otherUser?.embeddedWalletAddress,farcasterEmbeddedAddress:i.data?.data?.otherUser?.farcasterEmbeddedAddress}}),void o("LinkConflictScreen");i?.privyErrorCode===d.INVALID_CREDENTIALS?(v.retryable=!0,v.detail="Something went wrong. Try again."):i?.privyErrorCode===d.TOO_MANY_REQUESTS&&(v.detail="Too many requests. Please wait before trying again.")}b(v)}}else L>12e4&&(clearInterval(k),b({retryable:!0,message:"Authentication failed",detail:"The request timed out. Try again."}))}),2e3);return()=>{clearInterval(k),C.current.forEach((j=>clearTimeout(j)))}}),[]),n.useEffect((()=>{if(l&&e&&y&&t){if(h?.legal.requireUsersAcceptTerms&&!t.hasAcceptedTerms){let g=setTimeout((()=>{o("AffirmativeConsentScreen")}),A);return()=>clearTimeout(g)}y&&(Q(t,h.embeddedWallets)?C.current.push(setTimeout((()=>{m({createWallet:{onSuccess:()=>{},onFailure:g=>{console.error(g),S({eventName:"embedded_wallet_creation_failure_logout",payload:{error:g,screen:"FarcasterConnectStatusScreen"}}),u()},callAuthOnSuccessOnClose:!0}}),o("EmbeddedWalletOnAccountCreateScreen")}),A)):C.current.push(setTimeout((()=>a({shouldCallAuthOnSuccess:!0,isSuccess:!0})),A)))}}),[y,l,e,t]),r.jsx(ae,{connectUri:T,loading:E,success:y,errorMessage:f,onBack:c?p:void 0,onClose:a,onOpenFarcaster:()=>{T&&(window.location.href=T)}})}};let ie=s.div`
  margin-top: 24px;
`,oe=s.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
`,se=s.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 275px;
`,ne=s.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
`,le=s.div`
  font-size: 0.875rem;
  text-align: center;
  color: var(--privy-color-foreground-2);
`,ce=s.div`
  position: relative;
  width: 82px;
  height: 82px;
`;export{Ce as FarcasterConnectStatusScreen,ae as FarcasterConnectStatusView,Ce as default};
