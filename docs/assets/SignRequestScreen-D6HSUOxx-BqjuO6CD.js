import{j as t,i as L,aK as I}from"./vendor-wallet-iWeBopzN.js";import{b as N,I as M,a as k,cC as O,aN as E,cA as b,cB as C,ao as $,c as u,cD as z}from"./index-DOPD16Fz.js";import{r as o}from"./vendor-react-NLnOsXgy.js";import{h as q}from"./CopyToClipboard-DSTf_eKU-C3HQ2eAU.js";import{a as P}from"./Layouts-BlFm53ED-SRVhpBUn.js";import{a as F,i as V}from"./JsonTree-aPaJmPx7-DUzwlpbN.js";import{n as B}from"./ScreenLayout-DTmQLGPf-DHhzTInP.js";import{c as H}from"./createLucideIcon-4wkIQryq.js";import"./ModalHeader-D8-mhjp4-idcyyJVk.js";import"./Screen-Bp-TN9gb-CKhJalZZ.js";import"./index-Dq_xe9dz-Bi_UR9Ar.js";const J=[["path",{d:"M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7",key:"1m0v6g"}],["path",{d:"M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z",key:"ohrbg2"}]],K=H("square-pen",J),W=u.img`
  && {
    height: ${e=>e.size==="sm"?"65px":"140px"};
    width: ${e=>e.size==="sm"?"65px":"140px"};
    border-radius: 16px;
    margin-bottom: 12px;
  }
`;let Q=e=>{if(!L(e))return e;try{let a=I(e);return a.includes("�")?e:a}catch{return e}},G=e=>{try{let a=z.decode(e),s=new TextDecoder().decode(a);return s.includes("�")?e:s}catch{return e}},X=e=>{let{types:a,primaryType:s,...l}=e.typedData;return t.jsxs(t.Fragment,{children:[t.jsx(te,{data:l}),t.jsx(q,{text:(n=e.typedData,JSON.stringify(n,null,2)),itemName:"full payload to clipboard"})," "]});var n};const Y=({method:e,messageData:a,copy:s,iconUrl:l,isLoading:n,success:g,walletProxyIsLoading:m,errorMessage:x,isCancellable:d,onSign:c,onCancel:y,onClose:p})=>t.jsx(B,{title:s.title,subtitle:s.description,showClose:!0,onClose:p,icon:K,iconVariant:"subtle",helpText:x?t.jsx(ee,{children:x}):void 0,primaryCta:{label:s.buttonText,onClick:c,disabled:n||g||m,loading:n},secondaryCta:d?{label:"Not now",onClick:y,disabled:n||g||m}:void 0,watermark:!0,children:t.jsxs(P,{children:[l?t.jsx(W,{style:{alignSelf:"center"},size:"sm",src:l,alt:"app image"}):null,t.jsxs(Z,{children:[e==="personal_sign"&&t.jsx(w,{children:Q(a)}),e==="eth_signTypedData_v4"&&t.jsx(X,{typedData:a}),e==="solana_signMessage"&&t.jsx(w,{children:G(a)})]})]})}),ge={component:()=>{let{authenticated:e}=N(),{initializeWalletProxy:a,closePrivyModal:s}=M(),{navigate:l,data:n,onUserCloseViaDialogOrKeybindRef:g}=k(),[m,x]=o.useState(!0),[d,c]=o.useState(""),[y,p]=o.useState(),[f,T]=o.useState(null),[R,S]=o.useState(!1);o.useEffect((()=>{e||l("LandingScreen")}),[e]),o.useEffect((()=>{a(O).then((i=>{x(!1),i||(c("An error has occurred, please try again."),p(new E(new b(d,C.E32603_DEFAULT_INTERNAL_ERROR.eipCode))))}))}),[]);let{method:_,data:v,confirmAndSign:j,onSuccess:D,onFailure:U,uiOptions:r}=n.signMessage,A={title:r?.title||"Sign message",description:r?.description||"Signing this message will not cost you any fees.",buttonText:r?.buttonText||"Sign and continue"},h=i=>{i?D(i):U(y||new E(new b("The user rejected the request.",C.E4001_USER_REJECTED_REQUEST.eipCode))),s({shouldCallAuthOnSuccess:!1}),setTimeout((()=>{T(null),c(""),p(void 0)}),200)};return g.current=()=>{h(f)},t.jsx(Y,{method:_,messageData:v,copy:A,iconUrl:r?.iconUrl&&typeof r.iconUrl=="string"?r.iconUrl:void 0,isLoading:R,success:f!==null,walletProxyIsLoading:m,errorMessage:d,isCancellable:r?.isCancellable,onSign:async()=>{S(!0),c("");try{let i=await j();T(i),S(!1),setTimeout((()=>{h(i)}),$)}catch(i){console.error(i),c("An error has occurred, please try again."),p(new E(new b(d,C.E32603_DEFAULT_INTERNAL_ERROR.eipCode))),S(!1)}},onCancel:()=>h(null),onClose:()=>h(f)})}};let Z=u.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
`,ee=u.p`
  && {
    margin: 0;
    width: 100%;
    text-align: center;
    color: var(--privy-color-error-dark);
    font-size: 14px;
    line-height: 22px;
  }
`,te=u(F)`
  margin-top: 0;
`,w=u(V)`
  margin-top: 0;
`;export{ge as SignRequestScreen,Y as SignRequestView,ge as default};
