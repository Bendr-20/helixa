import{j as e}from"./vendor-wallet-iWeBopzN.js";import{F as E}from"./ExclamationTriangleIcon-C_T-rHXN.js";import{F as C}from"./LockClosedIcon-B9wwPnAl.js";import{r as y}from"./vendor-react-NLnOsXgy.js";import{b as F,I as R,a as U,bk as g,bE as w,ao as W,c as P}from"./index-CUaTRlAQ.js";import{T as x,k as v,u as j}from"./ModalHeader-D8-mhjp4-C8s-5hpK.js";import{r as A}from"./Subtitle-CV-2yKE4-DA9uyzoo.js";import{e as b}from"./Title-BnzYV3Is-B-mLK9eC.js";const M=P.div`
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
`,B={component:()=>{let{user:t}=F(),{client:S,walletProxy:m,refreshSessionAndUser:$,closePrivyModal:s}=R(),r=U(),{entropyId:u,entropyIdVerifier:I}=r.data?.recoverWallet,[a,f]=y.useState(!1),[i,T]=y.useState(null),[l,h]=y.useState(null);function n(){if(!a){if(l)return r.data?.setWalletPassword?.onFailure(l),void s();if(!i)return r.data?.setWalletPassword?.onFailure(Error("User exited set recovery flow")),void s()}}r.onUserCloseViaDialogOrKeybindRef.current=n;let k=!(!a&&!i);return e.jsxs(e.Fragment,l?{children:[e.jsx(x,{onClose:n},"header"),e.jsx(M,{$color:"var(--privy-color-error)",style:{alignSelf:"center"},children:e.jsx(E,{height:38,width:38,stroke:"var(--privy-color-error)"})}),e.jsx(b,{style:{marginTop:"0.5rem"},children:"Something went wrong"}),e.jsx(g,{style:{minHeight:"2rem"}}),e.jsx(v,{onClick:()=>h(null),children:"Try again"}),e.jsx(j,{})]}:{children:[e.jsx(x,{onClose:n},"header"),e.jsx(C,{style:{width:"3rem",height:"3rem",alignSelf:"center"}}),e.jsx(b,{style:{marginTop:"0.5rem"},children:"Automatically secure your account"}),e.jsx(A,{style:{marginTop:"1rem"},children:"When you log into a new device, you’ll only need to authenticate to access your account. Never get logged out if you forget your password."}),e.jsx(g,{style:{minHeight:"2rem"}}),e.jsx(v,{loading:a,disabled:k,onClick:()=>(async function(){f(!0);try{let o=await S.getAccessToken(),c=w(t,u);if(!o||!m||!c)return;if(!(await m.setRecovery({accessToken:o,entropyId:u,entropyIdVerifier:I,existingRecoveryMethod:c.recoveryMethod,recoveryMethod:"privy"})).entropyId)throw Error("Unable to set recovery on wallet");let d=await $();if(!d)throw Error("Unable to set recovery on wallet");let p=w(d,c.address);if(!p)throw Error("Unabled to set recovery on wallet");T(!!d),setTimeout((()=>{r.data?.setWalletPassword?.onSuccess(p),s()}),W)}catch(o){h(o)}finally{f(!1)}})(),children:i?"Success":"Confirm"}),e.jsx(j,{})]})}};export{B as SetAutomaticRecoveryScreen,B as default};
