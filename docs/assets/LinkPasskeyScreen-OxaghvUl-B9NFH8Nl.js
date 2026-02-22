import{j as e}from"./vendor-wallet-iWeBopzN.js";import{r as h}from"./vendor-react-NLnOsXgy.js";import{c as a,b as C,I as E,i as v,E as k,aW as b,aV as I}from"./index-DksErA8h.js";import{a as P,c as x}from"./TodoList-CgrU7uwu-B0sNPIGi.js";import{n as L}from"./ScreenLayout-DTmQLGPf-CZniXBSu.js";import{C as N}from"./circle-check-big-YWHND4yl.js";import{F as w}from"./fingerprint-pattern-ONAhdVhn.js";import{c as S}from"./createLucideIcon-4wkIQryq.js";import"./check-B9ysh8c4.js";import"./ModalHeader-D8-mhjp4-CWM4G6o2.js";import"./Screen-Bp-TN9gb-C63cfCza.js";import"./index-Dq_xe9dz-C8S7sutH.js";const W=[["path",{d:"M10 11v6",key:"nco0om"}],["path",{d:"M14 11v6",key:"outv1u"}],["path",{d:"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6",key:"miytrc"}],["path",{d:"M3 6h18",key:"d0wm0j"}],["path",{d:"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",key:"e791ji"}]],A=S("trash-2",W),$=({passkeys:o,isLoading:l,errorReason:u,success:y,expanded:n,onLinkPasskey:d,onUnlinkPasskey:s,onExpand:t,onBack:r,onClose:i})=>e.jsx(L,y?{title:"Passkeys updated",icon:N,iconVariant:"success",primaryCta:{label:"Done",onClick:i},onClose:i,watermark:!0}:n?{icon:w,title:"Your passkeys",onBack:r,onClose:i,watermark:!0,children:e.jsx(j,{passkeys:o,expanded:n,onUnlink:s,onExpand:t})}:{icon:w,title:"Set up passkey verification",subtitle:"Verify with passkey",primaryCta:{label:"Add new passkey",onClick:d,loading:l},onClose:i,watermark:!0,helpText:u||void 0,children:o.length===0?e.jsx(M,{}):e.jsx(B,{children:e.jsx(j,{passkeys:o,expanded:n,onUnlink:s,onExpand:t})})});let B=a.div`
  margin-bottom: 12px;
`,j=({passkeys:o,expanded:l,onUnlink:u,onExpand:y})=>{let[n,d]=h.useState([]),s=l?o.length:2;return e.jsxs("div",{children:[e.jsx(T,{children:"Your passkeys"}),e.jsxs(_,{children:[o.slice(0,s).map((t=>{return e.jsxs(D,{children:[e.jsxs("div",{children:[e.jsx(z,{children:(r=t,r.authenticatorName?r.createdWithBrowser?`${r.authenticatorName} on ${r.createdWithBrowser}`:r.authenticatorName:r.createdWithBrowser?r.createdWithOs?`${r.createdWithBrowser} on ${r.createdWithOs}`:`${r.createdWithBrowser}`:"Unknown device")}),e.jsxs(O,{children:["Last used:"," ",(t.latestVerifiedAt??t.firstVerifiedAt)?.toLocaleString()??"N/A"]})]}),e.jsx(R,{disabled:n.includes(t.credentialId),onClick:()=>(async i=>{d((p=>p.concat([i]))),await u(i),d((p=>p.filter((m=>m!==i))))})(t.credentialId),children:n.includes(t.credentialId)?e.jsx(I,{}):e.jsx(A,{size:16})})]},t.credentialId);var r})),o.length>2&&!l&&e.jsx(V,{onClick:y,children:"View all"})]})]})},M=()=>e.jsxs(P,{style:{color:"var(--privy-color-foreground)"},children:[e.jsx(x,{children:"Verify with Touch ID, Face ID, PIN, or hardware key"}),e.jsx(x,{children:"Takes seconds to set up and use"}),e.jsx(x,{children:"Use your passkey to verify transactions and login to your account"})]});const ne={component:()=>{let{user:o,unlinkPasskey:l}=C(),{linkWithPasskey:u,closePrivyModal:y}=E(),n=o?.linkedAccounts.filter((c=>c.type==="passkey")),[d,s]=h.useState(!1),[t,r]=h.useState(""),[i,p]=h.useState(!1),[m,f]=h.useState(!1);return h.useEffect((()=>{n.length===0&&f(!1)}),[n.length]),e.jsx($,{passkeys:n,isLoading:d,errorReason:t,success:i,expanded:m,onLinkPasskey:()=>{s(!0),u().then((()=>p(!0))).catch((c=>{if(c instanceof v){if(c.privyErrorCode===k.CANNOT_LINK_MORE_OF_TYPE)return void r("Cannot link more passkeys to account.");if(c.privyErrorCode===k.PASSKEY_NOT_ALLOWED)return void r("Passkey request timed out or rejected by user.")}r("Unknown error occurred.")})).finally((()=>{s(!1)}))},onUnlinkPasskey:async c=>(s(!0),await l(c).then((()=>p(!0))).catch((g=>{g instanceof v&&g.privyErrorCode===k.MISSING_MFA_CREDENTIALS?r("Cannot unlink a passkey enrolled in MFA"):r("Unknown error occurred.")})).finally((()=>{s(!1)}))),onExpand:()=>f(!0),onBack:()=>f(!1),onClose:()=>y()})}},ie=a.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 180px;
  height: 90px;
  border-radius: 50%;
  svg + svg {
    margin-left: 12px;
  }
  > svg {
    z-index: 2;
    color: var(--privy-color-accent) !important;
    stroke: var(--privy-color-accent) !important;
    fill: var(--privy-color-accent) !important;
  }
`;let U=b`
  && {
    width: 100%;
    font-size: 0.875rem;
    line-height: 1rem;

    /* Tablet and Up */
    @media (min-width: 440px) {
      font-size: 14px;
    }

    display: flex;
    gap: 12px;
    justify-content: center;

    padding: 6px 8px;
    background-color: var(--privy-color-background);
    transition: background-color 200ms ease;
    color: var(--privy-color-accent) !important;

    :focus {
      outline: none;
      box-shadow: none;
    }
  }
`;const V=a.button`
  ${U}
`;let _=a.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.8rem;
  padding: 0.5rem 0rem 0rem;
  flex-grow: 1;
  width: 100%;
`,T=a.div`
  line-height: 20px;
  height: 20px;
  font-size: 1em;
  font-weight: 450;
  display: flex;
  justify-content: flex-beginning;
  width: 100%;
`,z=a.div`
  font-size: 1em;
  line-height: 1.3em;
  font-weight: 500;
  color: var(--privy-color-foreground-2);
  padding: 0.2em 0;
`,O=a.div`
  font-size: 0.875rem;
  line-height: 1rem;
  color: #64668b;
  padding: 0.2em 0;
`,D=a.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1em;
  gap: 10px;
  font-size: 0.875rem;
  line-height: 1rem;
  text-align: left;
  border-radius: 8px;
  border: 1px solid #e2e3f0 !important;
  width: 100%;
  height: 5em;
`,F=b`
  :focus,
  :hover,
  :active {
    outline: none;
  }
  display: flex;
  width: 2em;
  height: 2em;
  justify-content: center;
  align-items: center;
  svg {
    color: var(--privy-color-error);
  }
  svg:hover {
    color: var(--privy-color-foreground-3);
  }
`,R=a.button`
  ${F}
`;export{ie as DoubleIconWrapper,V as LinkButton,ne as LinkPasskeyScreen,$ as LinkPasskeyView,ne as default};
