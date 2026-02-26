import{j as e}from"./vendor-wallet-iWeBopzN.js";import{r as p}from"./vendor-react-NLnOsXgy.js";import{c as n}from"./index-CPsDcot4.js";import{C as x}from"./check-B9ysh8c4.js";import{C as u}from"./copy-BmDK-JXv.js";let a=n.button`
  display: flex;
  align-items: center;
  justify-content: end;
  gap: 0.5rem;

  svg {
    width: 0.875rem;
    height: 0.875rem;
  }
`,m=n.span`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.875rem;
  color: var(--privy-color-foreground-2);
`,d=n(x)`
  color: var(--privy-color-icon-success);
  flex-shrink: 0;
`,h=n(u)`
  color: var(--privy-color-icon-muted);
  flex-shrink: 0;
`;function C({children:r,iconOnly:l,value:t,hideCopyIcon:i,...c}){let[s,o]=p.useState(!1);return e.jsxs(a,{...c,onClick:()=>{navigator.clipboard.writeText(t||(typeof r=="string"?r:"")).catch(console.error),o(!0),setTimeout((()=>o(!1)),1500)},children:[r," ",s?e.jsxs(m,{children:[e.jsx(d,{})," ",!l&&"Copied"]}):!i&&e.jsx(h,{})]})}const k=({value:r,includeChildren:l,children:t,...i})=>{let[c,s]=p.useState(!1),o=()=>{navigator.clipboard.writeText(r).catch(console.error),s(!0),setTimeout((()=>s(!1)),1500)};return e.jsxs(e.Fragment,{children:[l?e.jsx(a,{...i,onClick:o,children:t}):e.jsx(e.Fragment,{children:t}),e.jsx(a,{...i,onClick:o,children:c?e.jsx(m,{children:e.jsx(d,{})}):e.jsx(h,{})})]})};export{C as m,k as p};
