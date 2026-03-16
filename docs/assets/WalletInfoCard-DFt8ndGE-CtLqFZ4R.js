import{j as e}from"./vendor-wallet-Ce1ahb_s.js";import{r as m}from"./vendor-react-QucNsdf5.js";import{d as r}from"./index-BnvnNUhS.js";import{$ as p}from"./ModalHeader-D8-mhjp4-l3vze4Yw.js";import{e as f}from"./ErrorMessage-D8VaAP5m-DfYoOKx4.js";import{r as x}from"./LabelXs-oqZNqbm_-iBVPmK-u.js";import{d as h}from"./Address-BjZb-TIL-vkqfF4UJ.js";import{d as j}from"./shared-FM0rljBt-BqKoddsk.js";import{C as g}from"./check-BQm76XEQ.js";import{C as u}from"./copy-DwL8TWCQ.js";let v=r(j)`
  && {
    padding: 0.75rem;
    height: 56px;
  }
`,y=r.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
`,C=r.div`
  display: flex;
  flex-direction: column;
  gap: 0;
`,z=r.div`
  font-size: 12px;
  line-height: 1rem;
  color: var(--privy-color-foreground-3);
`,b=r(x)`
  text-align: left;
  margin-bottom: 0.5rem;
`,w=r(f)`
  margin-top: 0.25rem;
`,E=r(p)`
  && {
    gap: 0.375rem;
    font-size: 14px;
  }
`;const S=({errMsg:o,balance:s,address:a,className:c,title:n,showCopyButton:d=!1})=>{let[t,l]=m.useState(!1);return m.useEffect((()=>{if(t){let i=setTimeout((()=>l(!1)),3e3);return()=>clearTimeout(i)}}),[t]),e.jsxs("div",{children:[n&&e.jsx(b,{children:n}),e.jsx(v,{className:c,$state:o?"error":void 0,children:e.jsxs(y,{children:[e.jsxs(C,{children:[e.jsx(h,{address:a,showCopyIcon:!1}),s!==void 0&&e.jsx(z,{children:s})]}),d&&e.jsx(E,{onClick:function(i){i.stopPropagation(),navigator.clipboard.writeText(a).then((()=>l(!0))).catch(console.error)},size:"sm",children:e.jsxs(e.Fragment,t?{children:["Copied",e.jsx(g,{size:14})]}:{children:["Copy",e.jsx(u,{size:14})]})})]})}),o&&e.jsx(w,{children:o})]})};export{S as j};
