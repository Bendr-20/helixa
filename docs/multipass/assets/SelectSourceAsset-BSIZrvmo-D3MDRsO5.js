import{aR as e,b_ as p,aU as d,bf as o}from"./index-CVv1UEH9.js";import{n as w}from"./ScreenLayout-Ce16-u0i-Caa_yKD8.js";import{C as j}from"./chevron-down-2p6K2Fdo.js";const H=({currency:i="usd",value:a,onChange:n,inputMode:s="decimal",autoFocus:c})=>{let[u,y]=d.useState("0"),h=d.useRef(null),f=a??u,g=p[i]?.symbol??"$",x=d.useCallback((t=>{let r=t.target.value,l=(r=r.replace(/[^\d.]/g,"")).split(".");l.length>2&&(r=l[0]+"."+l.slice(1).join("")),l.length===2&&l[1].length>2&&(r=`${l[0]}.${l[1].slice(0,2)}`),r.length>1&&r[0]==="0"&&r[1]!=="."&&(r=r.slice(1)),(r===""||r===".")&&(r="0"),n?n(r):y(r)}),[n]),b=d.useCallback((t=>{!(["Delete","Backspace","Tab","Escape","Enter",".","ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End"].includes(t.key)||(t.ctrlKey||t.metaKey)&&["a","c","v","x"].includes(t.key.toLowerCase()))&&(t.key>="0"&&t.key<="9"||t.preventDefault())}),[]),m=d.useMemo((()=>(f.includes("."),f)),[f]);return e.jsxs(k,{onClick:()=>h.current?.focus(),children:[e.jsx(v,{children:g}),m,e.jsx("input",{ref:h,type:"text",inputMode:s,value:m,onChange:x,onKeyDown:b,autoFocus:c,placeholder:"0",style:{width:1,height:"1rem",opacity:0,alignSelf:"center",fontSize:"1rem"}}),e.jsx(v,{style:{opacity:0},children:g})]})},T=({selectedAsset:i,onEditSourceAsset:a})=>{let{icon:n}=p[i];return e.jsxs(C,{onClick:a,children:[e.jsx(A,{children:n}),e.jsx(S,{children:i.toLocaleUpperCase()}),e.jsx(z,{children:e.jsx(j,{})})]})};let k=o.span`
  background-color: var(--privy-color-background);
  width: 100%;
  text-align: center;
  border: none;
  font-kerning: none;
  font-feature-settings: 'calt' off;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  cursor: pointer;

  &:focus {
    outline: none !important;
    border: none !important;
    box-shadow: none !important;
  }

  && {
    color: var(--privy-color-foreground);
    font-size: 3.75rem;
    font-style: normal;
    font-weight: 600;
    line-height: 5.375rem;
  }
`,v=o.span`
  color: var(--privy-color-foreground);
  font-kerning: none;
  font-feature-settings: 'calt' off;
  font-size: 1rem;
  font-style: normal;
  font-weight: 600;
  line-height: 1.5rem;
  margin-top: 0.75rem;
`,C=o.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: auto;
  gap: 0.5rem;
  border: 1px solid var(--privy-color-border-default);
  border-radius: var(--privy-border-radius-full);

  && {
    margin: auto;
    padding: 0.5rem 1rem;
  }
`,A=o.div`
  svg {
    width: 1rem;
    height: 1rem;
    border-radius: var(--privy-border-radius-full);
    overflow: hidden;
    border: solid 0.1px var(--privy-color-border-default);
  }
`,S=o.span`
  color: var(--privy-color-foreground);
  font-kerning: none;
  font-feature-settings: 'calt' off;
  font-size: 0.875rem;
  font-style: normal;
  font-weight: 500;
  line-height: 1.375rem;
`,z=o.div`
  color: var(--privy-color-foreground);

  svg {
    width: 1.25rem;
    height: 1.25rem;
  }
`;const _=({opts:i,isLoading:a,onSelectSource:n})=>e.jsx(w,{showClose:!1,showBack:!0,onBack:()=>n(i.source.selectedAsset),title:"Select currency",children:e.jsx(E,{children:i.source.assets.map((s=>{let{icon:c,name:u}=p[s];return e.jsx(D,{onClick:()=>n(s),disabled:a,children:e.jsxs(L,{children:[e.jsx(R,{children:c}),e.jsxs(U,{children:[e.jsx(B,{children:u}),e.jsx(K,{children:s.toLocaleUpperCase()})]})]})},s)}))})});let E=o.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
  max-height: 20.875rem;
  overflow-y: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
`,D=o.button`
  border-color: var(--privy-color-border-default);
  border-width: 1px;
  border-radius: var(--privy-border-radius-mdlg);
  border-style: solid;
  display: flex;

  && {
    padding: 0.75rem 1rem;
  }
`,L=o.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  width: 100%;
`,R=o.div`
  svg {
    width: 2.25rem;
    height: 2.25rem;
    border-radius: var(--privy-border-radius-full);
    overflow: hidden;
    border: solid 0.1px var(--privy-color-border-default);
  }
`,U=o.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.125rem;
`,B=o.span`
  color: var(--privy-color-foreground);
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.25rem;
`,K=o.span`
  color: var(--privy-color-foreground-3);
  font-size: 0.75rem;
  font-weight: 400;
  line-height: 1.125rem;
`;export{H as c,T as p,_ as y};
