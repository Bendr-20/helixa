import{j as e}from"./vendor-wallet-CC_hGl00.js";import{r as p}from"./vendor-react-NLnOsXgy.js";import{q as m,c as s}from"./index-443jfUVp.js";import{$ as d}from"./ModalHeader-D8-mhjp4-B0BhkEeh.js";import{C as x}from"./check-B9ysh8c4.js";import{C as f}from"./copy-BmDK-JXv.js";const w=({address:r,showCopyIcon:i,url:n,className:a})=>{let[o,l]=p.useState(!1);function c(t){t.stopPropagation(),navigator.clipboard.writeText(r).then((()=>l(!0))).catch(console.error)}return p.useEffect((()=>{if(o){let t=setTimeout((()=>l(!1)),3e3);return()=>clearTimeout(t)}}),[o]),e.jsxs(h,n?{children:[e.jsx(j,{title:r,className:a,href:`${n}/address/${r}`,target:"_blank",children:m(r)}),i&&e.jsx(d,{onClick:c,size:"sm",style:{gap:"0.375rem"},children:e.jsxs(e.Fragment,o?{children:["Copied",e.jsx(x,{size:16})]}:{children:["Copy",e.jsx(f,{size:16})]})})]}:{children:[e.jsx(g,{title:r,className:a,children:m(r)}),i&&e.jsx(d,{onClick:c,size:"sm",style:{gap:"0.375rem",fontSize:"14px"},children:e.jsxs(e.Fragment,o?{children:["Copied",e.jsx(x,{size:14})]}:{children:["Copy",e.jsx(f,{size:14})]})})]})};let h=s.span`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
`,g=s.span`
  font-size: 14px;
  font-weight: 500;
  color: var(--privy-color-foreground);
`,j=s.a`
  font-size: 14px;
  color: var(--privy-color-foreground);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;export{w as d};
