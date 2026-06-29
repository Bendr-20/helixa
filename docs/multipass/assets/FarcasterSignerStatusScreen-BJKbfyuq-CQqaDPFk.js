import{aP as F,aQ as T,aS as I,aU as c,bj as y,aR as a,bl as x,bg as O,bf as o}from"./index-BIIr9Zi4.js";import{h as q}from"./CopyToClipboard-DSTf_eKU-CWAXKMEC.js";import{n as B}from"./OpenLink-DZHy38vr-B7wcFal1.js";import{C as E}from"./QrCode-BxAVhbx2-BKG6K9Jp.js";import{n as M}from"./ScreenLayout-Ce16-u0i-DHLa5wS9.js";import{l as h}from"./farcaster-DPlSjvF5-CUyJ_6m-.js";import"./dijkstra-COg3n3zL.js";import"./ModalHeader-YbJk-YIQ-C-N0i6VD.js";import"./Screen-CdOj1bUg-4yeSP8XK.js";import"./index-Dq_xe9dz-DEotILZS.js";let S="#8a63d2";const P=({appName:u,loading:m,success:p,errorMessage:e,connectUri:t,onBack:r,onClose:l,onOpenFarcaster:s})=>a.jsx(M,x.isMobile||m?x.isIOS?{title:e?e.message:"Add a signer to Farcaster",subtitle:e?e.detail:`This will allow ${u} to add casts, likes, follows, and more on your behalf.`,icon:h,iconVariant:"loading",iconLoadingStatus:{success:p,fail:!!e},primaryCta:t&&s?{label:"Open Farcaster app",onClick:s}:void 0,onBack:r,onClose:l,watermark:!0}:{title:e?e.message:"Requesting signer from Farcaster",subtitle:e?e.detail:"This should only take a moment",icon:h,iconVariant:"loading",iconLoadingStatus:{success:p,fail:!!e},onBack:r,onClose:l,watermark:!0,children:t&&x.isMobile&&a.jsx(R,{children:a.jsx(B,{text:"Take me to Farcaster",url:t,color:S})})}:{title:"Add a signer to Farcaster",subtitle:`This will allow ${u} to add casts, likes, follows, and more on your behalf.`,onBack:r,onClose:l,watermark:!0,children:a.jsxs(_,{children:[a.jsx(A,{children:t?a.jsx(E,{url:t,size:275,squareLogoElement:h}):a.jsx(U,{children:a.jsx(O,{})})}),a.jsxs(L,{children:[a.jsx(N,{children:"Or copy this link and paste it into a phone browser to open the Farcaster app."}),t&&a.jsx(q,{text:t,itemName:"link",color:S})]})]})});let R=o.div`
  margin-top: 24px;
`,_=o.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
`,A=o.div`
  padding: 24px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 275px;
`,L=o.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
`,N=o.div`
  font-size: 0.875rem;
  text-align: center;
  color: var(--privy-color-foreground-2);
`,U=o.div`
  position: relative;
  width: 82px;
  height: 82px;
`;const Y={component:()=>{let{lastScreen:u,navigateBack:m,data:p}=F(),e=T(),{requestFarcasterSignerStatus:t,closePrivyModal:r}=I(),[l,s]=c.useState(void 0),[k,v]=c.useState(!1),[b,w]=c.useState(!1),g=c.useRef([]),n=p?.farcasterSigner;c.useEffect((()=>{let j=Date.now(),i=setInterval((async()=>{if(!n?.public_key)return clearInterval(i),void s({retryable:!0,message:"Connect failed",detail:"Something went wrong. Please try again."});n.status==="approved"&&(clearInterval(i),v(!1),w(!0),g.current.push(setTimeout((()=>r({shouldCallAuthOnSuccess:!1,isSuccess:!0})),y)));let d=await t(n?.public_key),C=Date.now()-j;d.status==="approved"?(clearInterval(i),v(!1),w(!0),g.current.push(setTimeout((()=>r({shouldCallAuthOnSuccess:!1,isSuccess:!0})),y))):C>3e5?(clearInterval(i),s({retryable:!0,message:"Connect failed",detail:"The request timed out. Try again."})):d.status==="revoked"&&(clearInterval(i),s({retryable:!0,message:"Request rejected",detail:"The request was rejected. Please try again."}))}),2e3);return()=>{clearInterval(i),g.current.forEach((d=>clearTimeout(d)))}}),[]);let f=n?.status==="pending_approval"?n.signer_approval_url:void 0;return a.jsx(P,{appName:e.name,loading:k,success:b,errorMessage:l,connectUri:f,onBack:u?m:void 0,onClose:r,onOpenFarcaster:()=>{f&&(window.location.href=f)}})}};export{Y as FarcasterSignerStatusScreen,P as FarcasterSignerStatusView,Y as default};
