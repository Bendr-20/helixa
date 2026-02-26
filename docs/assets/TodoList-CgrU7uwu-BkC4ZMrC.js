import{j as t}from"./vendor-wallet-iWeBopzN.js";import{R as n}from"./vendor-react-NLnOsXgy.js";import{c as o}from"./index-B_Guat1Z.js";import{c as a}from"./createLucideIcon-4wkIQryq.js";import{C as c}from"./check-B9ysh8c4.js";const l=[["path",{d:"M18 6 6 18",key:"1bl5f8"}],["path",{d:"m6 6 12 12",key:"d8bk6v"}]],p=a("x",l),g=o.div`
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 10px; /* 10px gap between items */
  padding-left: 8px; /* 8px indentation container */
`;o.div`
  &&& {
    margin-left: 6px; /* Center the line under the checkbox (12px/2) */
    border-left: 2px solid var(--privy-color-foreground-4);
    height: 10px; /* 10px H padding between paragraphs */
    margin-top: 0;
    margin-bottom: 0;
  }
`;const y=({children:i,variant:r="default",icon:e})=>{let s=()=>{switch(r){case"success":return"var(--privy-color-icon-success)";case"error":return"var(--privy-color-icon-error)";default:return"var(--privy-color-icon-muted)"}};return t.jsxs(u,{children:[t.jsx(d,{$variant:r,"data-variant":r,children:(()=>{if(e)return n.isValidElement(e)?n.cloneElement(e,{stroke:s(),strokeWidth:2}):e;switch(r){case"success":default:return t.jsx(c,{size:12,stroke:s(),strokeWidth:3});case"error":return t.jsx(p,{size:12,stroke:s(),strokeWidth:3})}})()}),i]})};let d=o.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: ${({$variant:i})=>{switch(i){case"success":return"var(--privy-color-success-bg, #EAFCEF)";case"error":return"var(--privy-color-error-bg, #FEE2E2)";default:return"var(--privy-color-background-2)"}}};
  flex-shrink: 0;
`,u=o.div`
  display: flex;
  justify-content: flex-start;
  align-items: flex-start; /* Align all elements to the top */
  text-align: left;
  gap: 8px;

  && {
    a {
      color: var(--privy-color-accent);
    }
  }
`;export{g as a,y as c};
