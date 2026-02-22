import{j as t}from"./vendor-wallet-iWeBopzN.js";import{r as c}from"./vendor-react-NLnOsXgy.js";import{a as F,r as T,I,ao as y,ar as h,aC as O,c as o}from"./index-Dak8_StK.js";import{h as q}from"./CopyToClipboard-DSTf_eKU-C9UQxARF.js";import{n as B}from"./OpenLink-DZHy38vr-P6w1_oJl.js";import{C as E}from"./QrCode-C1tgJtOy-Dq6X4fc8.js";import{n as M}from"./ScreenLayout-DTmQLGPf-Cb1Hg3a7.js";import{l as x}from"./farcaster-DPlSjvF5-C2vQzryy.js";import"./browser-CxT9TM-V.js";import"./ModalHeader-D8-mhjp4-Br7JeqSt.js";import"./Screen-Bp-TN9gb-DDAbdNMJ.js";import"./index-Dq_xe9dz-b73d4uTB.js";let S="#8a63d2";const _=({appName:u,loading:m,success:p,errorMessage:e,connectUri:a,onBack:r,onClose:l,onOpenFarcaster:s})=>t.jsx(M,h.isMobile||m?h.isIOS?{title:e?e.message:"Add a signer to Farcaster",subtitle:e?e.detail:`This will allow ${u} to add casts, likes, follows, and more on your behalf.`,icon:x,iconVariant:"loading",iconLoadingStatus:{success:p,fail:!!e},primaryCta:a&&s?{label:"Open Farcaster app",onClick:s}:void 0,onBack:r,onClose:l,watermark:!0}:{title:e?e.message:"Requesting signer from Farcaster",subtitle:e?e.detail:"This should only take a moment",icon:x,iconVariant:"loading",iconLoadingStatus:{success:p,fail:!!e},onBack:r,onClose:l,watermark:!0,children:a&&h.isMobile&&t.jsx(A,{children:t.jsx(B,{text:"Take me to Farcaster",url:a,color:S})})}:{title:"Add a signer to Farcaster",subtitle:`This will allow ${u} to add casts, likes, follows, and more on your behalf.`,onBack:r,onClose:l,watermark:!0,children:t.jsxs(R,{children:[t.jsx(L,{children:a?t.jsx(E,{url:a,size:275,squareLogoElement:x}):t.jsx(V,{children:t.jsx(O,{})})}),t.jsxs(N,{children:[t.jsx(P,{children:"Or copy this link and paste it into a phone browser to open the Farcaster app."}),a&&t.jsx(q,{text:a,itemName:"link",color:S})]})]})});let A=o.div`
  margin-top: 24px;
`,R=o.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
`,L=o.div`
  padding: 24px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 275px;
`,N=o.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
`,P=o.div`
  font-size: 0.875rem;
  text-align: center;
  color: var(--privy-color-foreground-2);
`,V=o.div`
  position: relative;
  width: 82px;
  height: 82px;
`;const $={component:()=>{let{lastScreen:u,navigateBack:m,data:p}=F(),e=T(),{requestFarcasterSignerStatus:a,closePrivyModal:r}=I(),[l,s]=c.useState(void 0),[k,v]=c.useState(!1),[j,w]=c.useState(!1),g=c.useRef([]),n=p?.farcasterSigner;c.useEffect((()=>{let b=Date.now(),i=setInterval((async()=>{if(!n?.public_key)return clearInterval(i),void s({retryable:!0,message:"Connect failed",detail:"Something went wrong. Please try again."});n.status==="approved"&&(clearInterval(i),v(!1),w(!0),g.current.push(setTimeout((()=>r({shouldCallAuthOnSuccess:!1,isSuccess:!0})),y)));let d=await a(n?.public_key),C=Date.now()-b;d.status==="approved"?(clearInterval(i),v(!1),w(!0),g.current.push(setTimeout((()=>r({shouldCallAuthOnSuccess:!1,isSuccess:!0})),y))):C>3e5?(clearInterval(i),s({retryable:!0,message:"Connect failed",detail:"The request timed out. Try again."})):d.status==="revoked"&&(clearInterval(i),s({retryable:!0,message:"Request rejected",detail:"The request was rejected. Please try again."}))}),2e3);return()=>{clearInterval(i),g.current.forEach((d=>clearTimeout(d)))}}),[]);let f=n?.status==="pending_approval"?n.signer_approval_url:void 0;return t.jsx(_,{appName:e.name,loading:k,success:j,errorMessage:l,connectUri:f,onBack:u?m:void 0,onClose:r,onOpenFarcaster:()=>{f&&(window.location.href=f)}})}};export{$ as FarcasterSignerStatusScreen,_ as FarcasterSignerStatusView,$ as default};
