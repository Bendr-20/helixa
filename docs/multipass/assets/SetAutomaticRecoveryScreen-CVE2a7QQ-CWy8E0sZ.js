import{bn as U,aS as C,aP as E,aU as y,aR as e,bZ as p,cd as w,bj as F,bf as P}from"./index-CVv1UEH9.js";import{F as I}from"./ExclamationTriangleIcon-CayDHUb6.js";import{F as W}from"./LockClosedIcon-DOCL_ZjY.js";import{T as x,k as v,u as j}from"./ModalHeader-YbJk-YIQ-mbcKmHEk.js";import{r as A}from"./Subtitle-CV-2yKE4-CRm3I9Id.js";import{e as b}from"./Title-BnzYV3Is-B_WQTX48.js";const M=P.div`
  && {
    border-width: 4px;
  }

  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1rem;
  aspect-ratio: 1;
  border-style: solid;
  border-color: ${t=>t.$color??"var(--privy-color-accent)"};
  border-radius: 50%;
`,Z={component:()=>{let{user:t}=U(),{client:S,walletProxy:u,refreshSessionAndUser:k,closePrivyModal:s}=C(),r=E(),{entropyId:f,entropyIdVerifier:$}=r.data?.recoverWallet??{},[a,m]=y.useState(!1),[l,T]=y.useState(null),[i,h]=y.useState(null);function n(){if(!a){if(i)return r.data?.setWalletPassword?.onFailure(i),void s();if(!l)return r.data?.setWalletPassword?.onFailure(Error("User exited set recovery flow")),void s()}}r.onUserCloseViaDialogOrKeybindRef.current=n;let R=!(!a&&!l);return e.jsxs(e.Fragment,i?{children:[e.jsx(x,{onClose:n},"header"),e.jsx(M,{$color:"var(--privy-color-error)",style:{alignSelf:"center"},children:e.jsx(I,{height:38,width:38,stroke:"var(--privy-color-error)"})}),e.jsx(b,{style:{marginTop:"0.5rem"},children:"Something went wrong"}),e.jsx(p,{style:{minHeight:"2rem"}}),e.jsx(v,{onClick:()=>h(null),children:"Try again"}),e.jsx(j,{})]}:{children:[e.jsx(x,{onClose:n},"header"),e.jsx(W,{style:{width:"3rem",height:"3rem",alignSelf:"center"}}),e.jsx(b,{style:{marginTop:"0.5rem"},children:"Automatically secure your account"}),e.jsx(A,{style:{marginTop:"1rem"},children:"When you log into a new device, you’ll only need to authenticate to access your account. Never get logged out if you forget your password."}),e.jsx(p,{style:{minHeight:"2rem"}}),e.jsx(v,{loading:a,disabled:R,onClick:()=>(async function(){m(!0);try{let o=await S.getAccessToken(),c=w(t,f);if(!o||!u||!c)return;if(!(await u.setRecovery({accessToken:o,entropyId:f,entropyIdVerifier:$,existingRecoveryMethod:c.recoveryMethod,recoveryMethod:"privy"})).entropyId)throw Error("Unable to set recovery on wallet");let d=await k();if(!d)throw Error("Unable to set recovery on wallet");let g=w(d,c.address);if(!g)throw Error("Unabled to set recovery on wallet");T(!!d),setTimeout((()=>{r.data?.setWalletPassword?.onSuccess(g),s()}),F)}catch(o){h(o)}finally{m(!1)}})(),children:l?"Success":"Confirm"}),e.jsx(j,{})]})}};export{Z as SetAutomaticRecoveryScreen,Z as default};
