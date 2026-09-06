import{dy as A,d0 as N,cZ as k,d2 as o,f9 as M,dE as E,ez as b,eA as w,c$ as t,du as $,dq as p,dI as z,fa as I,fb as O}from"./index-BQcruxpq.js";import{h as q}from"./CopyToClipboard-DSTf_eKU-CeyIvZlY.js";import{a as P}from"./Layouts-BlFm53ED-rikO-i85.js";import{a as F,i as V}from"./JsonTree-aPaJmPx7-DcOhtdtL.js";import{n as H}from"./ScreenLayout-Ce16-u0i-DY5KblYd.js";import{c as J}from"./createLucideIcon-SD32i53A.js";import"./ModalHeader-YbJk-YIQ-CkWkhqeO.js";import"./Screen-CdOj1bUg-CzDhKImC.js";import"./index-Dq_xe9dz-C3fE_2-2.js";const K=[["path",{d:"M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7",key:"1m0v6g"}],["path",{d:"M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z",key:"ohrbg2"}]],Q=J("square-pen",K),W=p.img`
  && {
    height: ${e=>e.size==="sm"?"65px":"140px"};
    width: ${e=>e.size==="sm"?"65px":"140px"};
    border-radius: 16px;
    margin-bottom: 12px;
  }
`;let Z=e=>{if(!z(e))return e;try{let a=I(e);return a.includes("�")?e:a}catch{return e}},B=e=>{try{let a=O.decode(e),s=new TextDecoder().decode(a);return s.includes("�")?e:s}catch{return e}},G=e=>{let{types:a,primaryType:s,...l}=e.typedData;return t.jsxs(t.Fragment,{children:[t.jsx(te,{data:l}),t.jsx(q,{text:(i=e.typedData,JSON.stringify(i,null,2)),itemName:"full payload to clipboard"})," "]});var i};const X=({method:e,messageData:a,copy:s,iconUrl:l,isLoading:i,success:g,walletProxyIsLoading:m,errorMessage:x,isCancellable:d,onSign:c,onCancel:y,onClose:u})=>t.jsx(H,{title:s.title,subtitle:s.description,showClose:!0,onClose:u,icon:Q,iconVariant:"subtle",helpText:x?t.jsx(ee,{children:x}):void 0,primaryCta:{label:s.buttonText,onClick:c,disabled:i||g||m,loading:i},secondaryCta:d?{label:"Not now",onClick:y,disabled:i||g||m}:void 0,watermark:!0,children:t.jsxs(P,{children:[l?t.jsx(W,{style:{alignSelf:"center"},size:"sm",src:l,alt:"app image"}):null,t.jsxs(Y,{children:[e==="personal_sign"&&t.jsx(T,{children:Z(a)}),e==="eth_signTypedData_v4"&&t.jsx(G,{typedData:a}),e==="solana_signMessage"&&t.jsx(T,{children:B(a)})]})]})}),ue={component:()=>{let{authenticated:e}=A(),{initializeWalletProxy:a,closePrivyModal:s}=N(),{navigate:l,data:i,onUserCloseViaDialogOrKeybindRef:g}=k(),[m,x]=o.useState(!0),[d,c]=o.useState(""),[y,u]=o.useState(),[f,C]=o.useState(null),[_,S]=o.useState(!1);o.useEffect((()=>{e||l("LandingScreen")}),[e]),o.useEffect((()=>{a(M).then((n=>{x(!1),n||(c("An error has occurred, please try again."),u(new E(new b(d,w.E32603_DEFAULT_INTERNAL_ERROR.eipCode))))}))}),[]);let{method:R,data:j,confirmAndSign:v,onSuccess:D,onFailure:L,uiOptions:r}=i.signMessage,U={title:r?.title||"Sign message",description:r?.description||"Signing this message will not cost you any fees.",buttonText:r?.buttonText||"Sign and continue"},h=n=>{n?D(n):L(y||new E(new b("The user rejected the request.",w.E4001_USER_REJECTED_REQUEST.eipCode))),s({shouldCallAuthOnSuccess:!1}),setTimeout((()=>{C(null),c(""),u(void 0)}),200)};return g.current=()=>{h(f)},t.jsx(X,{method:R,messageData:j,copy:U,iconUrl:r?.iconUrl&&typeof r.iconUrl=="string"?r.iconUrl:void 0,isLoading:_,success:f!==null,walletProxyIsLoading:m,errorMessage:d,isCancellable:r?.isCancellable,onSign:async()=>{S(!0),c("");try{let n=await v();C(n),S(!1),setTimeout((()=>{h(n)}),$)}catch(n){console.error(n),c("An error has occurred, please try again."),u(new E(new b(d,w.E32603_DEFAULT_INTERNAL_ERROR.eipCode))),S(!1)}},onCancel:()=>h(null),onClose:()=>h(f)})}};let Y=p.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
`,ee=p.p`
  && {
    margin: 0;
    width: 100%;
    text-align: center;
    color: var(--privy-color-error-dark);
    font-size: 14px;
    line-height: 22px;
  }
`,te=p(F)`
  margin-top: 0;
`,T=p(V)`
  margin-top: 0;
`;export{ue as SignRequestScreen,X as SignRequestView,ue as default};
