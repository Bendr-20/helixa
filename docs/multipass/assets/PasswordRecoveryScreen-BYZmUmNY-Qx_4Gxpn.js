import{d2 as a,dy as _,d0 as E,cZ as T,c$ as e,eo as I,ep as U,dU as F,dq as u,e1 as W}from"./index-BQcruxpq.js";import{F as N}from"./ShieldCheckIcon-BrGcANql.js";import{m as O}from"./ModalHeader-YbJk-YIQ-CkWkhqeO.js";import{l as V}from"./Layouts-BlFm53ED-rikO-i85.js";import{g as H,h as z,u as M,b as q,k as B}from"./shared-Mx6bnMlK-jZABgJ_P.js";import{w as t}from"./Screen-CdOj1bUg-CzDhKImC.js";import"./index-Dq_xe9dz-C3fE_2-2.js";const re={component:()=>{let[o,h]=a.useState(!0),{authenticated:p,user:w}=_(),{walletProxy:y,closePrivyModal:m,createAnalyticsEvent:v,client:b}=E(),{navigate:j,data:k,onUserCloseViaDialogOrKeybindRef:$}=T(),[l,A]=a.useState(void 0),[x,n]=a.useState(""),[d,f]=a.useState(!1),{entropyId:c,entropyIdVerifier:C,onCompleteNavigateTo:g,onSuccess:S,onFailure:P}=k.recoverWallet,i=(r="User exited before their wallet could be recovered")=>{m({shouldCallAuthOnSuccess:!1}),P(typeof r=="string"?new F(r):r)};return $.current=i,a.useEffect((()=>{if(!p)return i("User must be authenticated and have a Privy wallet before it can be recovered")}),[p]),e.jsxs(t,{children:[e.jsx(t.Header,{icon:N,title:"Enter your password",subtitle:"Please provision your account on this new device. To continue, enter your recovery password.",showClose:!0,onClose:i}),e.jsx(t.Body,{children:e.jsx(D,{children:e.jsxs("div",{children:[e.jsxs(H,{children:[e.jsx(z,{type:o?"password":"text",onChange:r=>(s=>{s&&A(s)})(r.target.value),disabled:d,style:{paddingRight:"2.3rem"}}),e.jsx(M,{style:{right:"0.75rem"},children:o?e.jsx(q,{onClick:()=>h(!1)}):e.jsx(B,{onClick:()=>h(!0)})})]}),!!x&&e.jsx(K,{children:x})]})})}),e.jsxs(t.Footer,{children:[e.jsx(t.HelpText,{children:e.jsxs(V,{children:[e.jsx("h4",{children:"Why is this necessary?"}),e.jsx("p",{children:"You previously set a password for this wallet. This helps ensure only you can access it"})]})}),e.jsx(t.Actions,{children:e.jsx(L,{loading:d||!y,disabled:!l,onClick:async()=>{f(!0);let r=await b.getAccessToken(),s=I(w,c);if(!r||!s||l===null)return i("User must be authenticated and have a Privy wallet before it can be recovered");try{v({eventName:"embedded_wallet_recovery_started",payload:{walletAddress:s.address}}),await y?.recover({accessToken:r,entropyId:c,entropyIdVerifier:C,recoveryPassword:l}),n(""),g?j(g):m({shouldCallAuthOnSuccess:!1}),S?.(s),v({eventName:"embedded_wallet_recovery_completed",payload:{walletAddress:s.address}})}catch(R){U(R)?n("Invalid recovery password, please try again."):n("An error has occurred, please try again.")}finally{f(!1)}},$hideAnimations:!c&&d,children:"Recover your account"})}),e.jsx(t.Watermark,{})]})]})}};let D=u.div`
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
