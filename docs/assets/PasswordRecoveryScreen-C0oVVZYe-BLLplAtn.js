import{j as e}from"./vendor-wallet-CXCc6TWG.js";import{F as R}from"./ShieldCheckIcon-BOiyyH72.js";import{r as a}from"./vendor-react-BKE_dtLH.js";import{c as T,I as _,a as E,bF as F,cr as W,bz as U,d as u,s as N}from"./index-6IM4sOHP.js";import{m as O}from"./ModalHeader-D8-mhjp4-BTUKfeT9.js";import{l as V}from"./Layouts-BlFm53ED-D-nqePA0.js";import{g as z,h as H,u as M,b as B,k as D}from"./shared-CwuyxHmv-Awq0XtTc.js";import{w as s}from"./Screen-Bp-TN9gb-Db6g-Dc5.js";import"./index-Dq_xe9dz-BC7pzcg5.js";const se={component:()=>{let[o,h]=a.useState(!0),{authenticated:p,user:b}=T(),{walletProxy:m,closePrivyModal:y,createAnalyticsEvent:v,client:g}=_(),{navigate:j,data:k,onUserCloseViaDialogOrKeybindRef:A}=E(),[n,C]=a.useState(void 0),[x,l]=a.useState(""),[d,f]=a.useState(!1),{entropyId:c,entropyIdVerifier:$,onCompleteNavigateTo:w,onSuccess:I,onFailure:S}=k.recoverWallet,i=(r="User exited before their wallet could be recovered")=>{y({shouldCallAuthOnSuccess:!1}),S(typeof r=="string"?new U(r):r)};return A.current=i,a.useEffect((()=>{if(!p)return i("User must be authenticated and have a Privy wallet before it can be recovered")}),[p]),e.jsxs(s,{children:[e.jsx(s.Header,{icon:R,title:"Enter your password",subtitle:"Please provision your account on this new device. To continue, enter your recovery password.",showClose:!0,onClose:i}),e.jsx(s.Body,{children:e.jsx(K,{children:e.jsxs("div",{children:[e.jsxs(z,{children:[e.jsx(H,{type:o?"password":"text",onChange:r=>(t=>{t&&C(t)})(r.target.value),disabled:d,style:{paddingRight:"2.3rem"}}),e.jsx(M,{style:{right:"0.75rem"},children:o?e.jsx(B,{onClick:()=>h(!1)}):e.jsx(D,{onClick:()=>h(!0)})})]}),!!x&&e.jsx(L,{children:x})]})})}),e.jsxs(s.Footer,{children:[e.jsx(s.HelpText,{children:e.jsxs(V,{children:[e.jsx("h4",{children:"Why is this necessary?"}),e.jsx("p",{children:"You previously set a password for this wallet. This helps ensure only you can access it"})]})}),e.jsx(s.Actions,{children:e.jsx(Y,{loading:d||!m,disabled:!n,onClick:async()=>{f(!0);let r=await g.getAccessToken(),t=F(b,c);if(!r||!t||n===null)return i("User must be authenticated and have a Privy wallet before it can be recovered");try{v({eventName:"embedded_wallet_recovery_started",payload:{walletAddress:t.address}}),await m?.recover({accessToken:r,entropyId:c,entropyIdVerifier:$,recoveryPassword:n}),l(""),w?j(w):y({shouldCallAuthOnSuccess:!1}),I?.(t),v({eventName:"embedded_wallet_recovery_completed",payload:{walletAddress:t.address}})}catch(P){W(P)?l("Invalid recovery password, please try again."):l("An error has occurred, please try again.")}finally{f(!1)}},$hideAnimations:!c&&d,children:"Recover your account"})}),e.jsx(s.Watermark,{})]})]})}};let K=u.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`,L=u.div`
  line-height: 20px;
  height: 20px;
  font-size: 13px;
  color: var(--privy-color-error);
  text-align: left;
  margin-top: 0.5rem;
`,Y=u(O)`
  ${({$hideAnimations:o})=>o&&N`
      && {
        // Remove animations because the recoverWallet task on the iframe partially
        // blocks the renderer, so the animation stutters and doesn't look good
        transition: none;
      }
    `}
`;export{se as PasswordRecoveryScreen,se as default};
