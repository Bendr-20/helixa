import{aU as p,aR as e,bf as l}from"./index-CVv1UEH9.js";import{C as f}from"./check-DKuwLW6k.js";import{C as m}from"./copy-ByGexnjt.js";let a=l.button`
  display: flex;
  align-items: center;
  justify-content: end;
  gap: 0.5rem;

  && {
    color: var(--privy-color-foreground);
    font-weight: 500;
  }

  svg {
    width: 0.875rem;
    height: 0.875rem;
  }
`,h=l.span`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.875rem;
  color: var(--privy-color-foreground-2);
`,u=l(f)`
  color: var(--privy-color-icon-success);
  flex-shrink: 0;
`,x=l(m)`
  color: var(--privy-color-icon-muted);
  flex-shrink: 0;
`;function y({children:r,iconOnly:c,value:o,hideCopyIcon:i,iconSize:t=14,...s}){let[n,d]=p.useState(!1);return e.jsxs(a,{...s,onClick:()=>{navigator.clipboard.writeText(o||(typeof r=="string"?r:"")).catch(console.error),d(!0),setTimeout((()=>d(!1)),1500)},children:[r," ",n?e.jsxs(h,{children:[e.jsx(u,{size:t})," ",!c&&"Copied"]}):!i&&e.jsx(x,{size:t})]})}const C=({value:r,includeChildren:c,children:o,...i})=>{let[t,s]=p.useState(!1),n=()=>{navigator.clipboard.writeText(r).catch(console.error),s(!0),setTimeout((()=>s(!1)),1500)};return e.jsxs(e.Fragment,{children:[c?e.jsx(a,{...i,onClick:n,children:o}):e.jsx(e.Fragment,{children:o}),e.jsx(a,{...i,onClick:n,children:t?e.jsx(h,{children:e.jsx(u,{})}):e.jsx(x,{})})]})};export{y as m,C as p};
