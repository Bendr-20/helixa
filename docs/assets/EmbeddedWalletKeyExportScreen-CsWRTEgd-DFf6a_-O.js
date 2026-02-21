import{j as r}from"./vendor-wallet-iWeBopzN.js";import{r as s}from"./vendor-react-NLnOsXgy.js";import{b as B,I as S,r as W,a as L,c,bv as U}from"./index-D_hPPyTf.js";import{t as $}from"./WarningBanner-c8L53pJ2-Cv6UYYtc.js";import{j as R}from"./WalletInfoCard-DFt8ndGE-Cv8NdqfT.js";import{n as z}from"./ScreenLayout-DTmQLGPf-fBPQbWFJ.js";import"./ExclamationTriangleIcon-C_T-rHXN.js";import"./ModalHeader-D8-mhjp4-Zqe7Qtl-.js";import"./ErrorMessage-D8VaAP5m-5IDjRLA0.js";import"./LabelXs-oqZNqbm_-Bnkm3kSH.js";import"./Address-BjZb-TIL-DEO0OLdh.js";import"./check-B9ysh8c4.js";import"./createLucideIcon-4wkIQryq.js";import"./copy-BmDK-JXv.js";import"./shared-FM0rljBt-BuSBPUz4.js";import"./Screen-Bp-TN9gb-LQjmo-yV.js";import"./index-Dq_xe9dz-BJ17r6Vw.js";const K=({address:e,accessToken:t,appConfigTheme:n,onClose:l,isLoading:d=!1,exportButtonProps:i,onBack:a})=>r.jsx(z,{title:"Export wallet",subtitle:r.jsxs(r.Fragment,{children:["Copy either your private key or seed phrase to export your wallet."," ",r.jsx("a",{href:"https://privy-io.notion.site/Transferring-your-account-9dab9e16c6034a7ab1ff7fa479b02828",target:"blank",rel:"noopener noreferrer",children:"Learn more"})]}),onClose:l,onBack:a,showBack:!!a,watermark:!0,children:r.jsxs(O,{children:[r.jsx($,{theme:n,children:"Never share your private key or seed phrase with anyone."}),r.jsx(R,{title:"Your wallet",address:e,showCopyButton:!0}),r.jsx("div",{style:{width:"100%"},children:d?r.jsx(D,{}):t&&i&&r.jsx(q,{accessToken:t,dimensions:{height:"44px"},...i})})]})});let O=c.div`
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  text-align: left;
`,D=()=>r.jsx(F,{children:r.jsx(N,{children:"Loading..."})}),F=c.div`
  display: flex;
  gap: 12px;
  height: 44px;
`,N=c.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: 16px;
  font-weight: 500;
  border-radius: var(--privy-border-radius-md);
  background-color: var(--privy-color-background-2);
  color: var(--privy-color-foreground-3);
`;function q(e){let[t,n]=s.useState(e.dimensions.width),[l,d]=s.useState(void 0),i=s.useRef(null);s.useEffect((()=>{if(i.current&&t===void 0){let{width:p}=i.current.getBoundingClientRect();n(p)}let o=getComputedStyle(document.documentElement);d({background:o.getPropertyValue("--privy-color-background"),background2:o.getPropertyValue("--privy-color-background-2"),foreground3:o.getPropertyValue("--privy-color-foreground-3"),foregroundAccent:o.getPropertyValue("--privy-color-foreground-accent"),accent:o.getPropertyValue("--privy-color-accent"),accentDark:o.getPropertyValue("--privy-color-accent-dark"),success:o.getPropertyValue("--privy-color-success"),colorScheme:o.getPropertyValue("color-scheme")})}),[]);let a=e.chainType==="ethereum"&&!e.imported&&!e.isUnifiedWallet;return r.jsx("div",{ref:i,children:t&&r.jsxs(M,{children:[r.jsx("iframe",{style:{position:"absolute",zIndex:1},width:t,height:e.dimensions.height,allow:"clipboard-write self *",src:U({origin:e.origin,path:`/apps/${e.appId}/embedded-wallets/export`,query:e.isUnifiedWallet?{v:"1-unified",wallet_id:e.walletId,client_id:e.appClientId,width:`${t}px`,caid:e.clientAnalyticsId,phrase_export:a,...l}:{v:"1",entropy_id:e.entropyId,entropy_id_verifier:e.entropyIdVerifier,hd_wallet_index:e.hdWalletIndex,chain_type:e.chainType,client_id:e.appClientId,width:`${t}px`,caid:e.clientAnalyticsId,phrase_export:a,...l},hash:{token:e.accessToken}})}),r.jsx(g,{children:"Loading..."}),a&&r.jsx(g,{children:"Loading..."})]})})}const ce={component:()=>{let[e,t]=s.useState(null),{authenticated:n,user:l}=B(),{closePrivyModal:d,createAnalyticsEvent:i,clientAnalyticsId:a,client:o}=S(),p=W(),{data:m,onUserCloseViaDialogOrKeybindRef:x}=L(),{onFailure:v,onSuccess:w,origin:b,appId:k,appClientId:I,entropyId:j,entropyIdVerifier:C,walletId:_,hdWalletIndex:V,chainType:E,address:y,isUnifiedWallet:T,imported:P,showBackButton:A}=m.keyExport,f=h=>{d({shouldCallAuthOnSuccess:!1}),v(typeof h=="string"?Error(h):h)},u=()=>{d({shouldCallAuthOnSuccess:!1}),w(),i({eventName:"embedded_wallet_key_export_completed",payload:{walletAddress:y}})};return s.useEffect((()=>{if(!n)return f("User must be authenticated before exporting their wallet");o.getAccessToken().then(t).catch(f)}),[n,l]),x.current=u,r.jsx(K,{address:y,accessToken:e,appConfigTheme:p.appearance.palette.colorScheme,onClose:u,isLoading:!e,onBack:A?u:void 0,exportButtonProps:e?{origin:b,appId:k,appClientId:I,clientAnalyticsId:a,entropyId:j,entropyIdVerifier:C,walletId:_,hdWalletIndex:V,isUnifiedWallet:T,imported:P,chainType:E}:void 0})}};let M=c.div`
  overflow: visible;
  position: relative;
  overflow: none;
  height: 44px;
  display: flex;
  gap: 12px;
`,g=c.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: 16px;
  font-weight: 500;
  border-radius: var(--privy-border-radius-md);
  background-color: var(--privy-color-background-2);
  color: var(--privy-color-foreground-3);
`;export{ce as EmbeddedWalletKeyExportScreen,K as EmbeddedWalletKeyExportView,ce as default};
