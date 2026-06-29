import{aU as a,bn as _,aS as E,aP as T,aR as e,cd as I,ce as U,bJ as F,bf as u,bS as W}from"./index-CVv1UEH9.js";import{F as N}from"./ShieldCheckIcon-BnZkFP9I.js";import{m as O}from"./ModalHeader-YbJk-YIQ-mbcKmHEk.js";import{l as V}from"./Layouts-BlFm53ED-CTjgcsMN.js";import{g as H,h as z,u as M,b as B,k as D}from"./shared-Mx6bnMlK-CG3EkGib.js";import{w as t}from"./Screen-CdOj1bUg-DfiZcmHy.js";import"./index-Dq_xe9dz-D3-ymV7v.js";const re={component:()=>{let[o,h]=a.useState(!0),{authenticated:p,user:g}=_(),{walletProxy:y,closePrivyModal:m,createAnalyticsEvent:v,client:w}=E(),{navigate:j,data:k,onUserCloseViaDialogOrKeybindRef:A}=T(),[n,C]=a.useState(void 0),[x,l]=a.useState(""),[d,f]=a.useState(!1),{entropyId:c,entropyIdVerifier:S,onCompleteNavigateTo:b,onSuccess:$,onFailure:P}=k.recoverWallet,i=(r="User exited before their wallet could be recovered")=>{m({shouldCallAuthOnSuccess:!1}),P(typeof r=="string"?new F(r):r)};return A.current=i,a.useEffect((()=>{if(!p)return i("User must be authenticated and have a Privy wallet before it can be recovered")}),[p]),e.jsxs(t,{children:[e.jsx(t.Header,{icon:N,title:"Enter your password",subtitle:"Please provision your account on this new device. To continue, enter your recovery password.",showClose:!0,onClose:i}),e.jsx(t.Body,{children:e.jsx(J,{children:e.jsxs("div",{children:[e.jsxs(H,{children:[e.jsx(z,{type:o?"password":"text",onChange:r=>(s=>{s&&C(s)})(r.target.value),disabled:d,style:{paddingRight:"2.3rem"}}),e.jsx(M,{style:{right:"0.75rem"},children:o?e.jsx(B,{onClick:()=>h(!1)}):e.jsx(D,{onClick:()=>h(!0)})})]}),!!x&&e.jsx(K,{children:x})]})})}),e.jsxs(t.Footer,{children:[e.jsx(t.HelpText,{children:e.jsxs(V,{children:[e.jsx("h4",{children:"Why is this necessary?"}),e.jsx("p",{children:"You previously set a password for this wallet. This helps ensure only you can access it"})]})}),e.jsx(t.Actions,{children:e.jsx(L,{loading:d||!y,disabled:!n,onClick:async()=>{f(!0);let r=await w.getAccessToken(),s=I(g,c);if(!r||!s||n===null)return i("User must be authenticated and have a Privy wallet before it can be recovered");try{v({eventName:"embedded_wallet_recovery_started",payload:{walletAddress:s.address}}),await y?.recover({accessToken:r,entropyId:c,entropyIdVerifier:S,recoveryPassword:n}),l(""),b?j(b):m({shouldCallAuthOnSuccess:!1}),$?.(s),v({eventName:"embedded_wallet_recovery_completed",payload:{walletAddress:s.address}})}catch(R){U(R)?l("Invalid recovery password, please try again."):l("An error has occurred, please try again.")}finally{f(!1)}},$hideAnimations:!c&&d,children:"Recover your account"})}),e.jsx(t.Watermark,{})]})]})}};let J=u.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`,K=u.div`
  line-height: 20px;
  height: 20px;
  font-size: 13px;
  color: var(--privy-color-error);
  text-align: left;
  margin-top: 0.5rem;
`,L=u(O)`
  ${({$hideAnimations:o})=>o&&W`
      && {
        // Remove animations because the recoverWallet task on the iframe partially
        // blocks the renderer, so the animation stutters and doesn't look good
        transition: none;
      }
    `}
`;export{re as PasswordRecoveryScreen,re as default};
