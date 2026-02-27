import{aO as j,j as n}from"./vendor-wallet-iWeBopzN.js";import{q as $,c as s}from"./index-DmauRCQV.js";import{m as g,l as a,o as d,c as p}from"./ethers-D1WT71Ay-R_iQhzKc.js";import{C as k}from"./getFormattedUsdFromLamports-B6EqSEho-C-HCdwKa.js";import{t as y}from"./transaction-CnfuREWo-nROljJQP.js";const P=({weiQuantities:e,tokenPrice:r,tokenSymbol:o})=>{let t=a(e),i=r?d(t,r):void 0,l=p(t,o);return n.jsx(c,{children:i||l})},q=({weiQuantities:e,tokenPrice:r,tokenSymbol:o})=>{let t=a(e),i=r?d(t,r):void 0,l=p(t,o);return n.jsx(c,{children:i?n.jsxs(n.Fragment,{children:[n.jsx(S,{children:"USD"}),i==="<$0.01"?n.jsxs(m,{children:[n.jsx(h,{children:"<"}),"$0.01"]}):i]}):l})},D=({quantities:e,tokenPrice:r,tokenSymbol:o="SOL",tokenDecimals:t=9})=>{let i=e.reduce(((f,u)=>f+u),0n),l=r&&o==="SOL"&&t===9?k(i,r):void 0,x=o==="SOL"&&t===9?y(i):`${j(i,t)} ${o}`;return n.jsx(c,{children:l?n.jsx(n.Fragment,{children:l==="<$0.01"?n.jsxs(m,{children:[n.jsx(h,{children:"<"}),"$0.01"]}):l}):x})};let c=s.span`
  font-size: 14px;
  line-height: 140%;
  display: flex;
  gap: 4px;
  align-items: center;
`,S=s.span`
  font-size: 12px;
  line-height: 12px;
  color: var(--privy-color-foreground-3);
`,h=s.span`
  font-size: 10px;
`,m=s.span`
  display: flex;
  align-items: center;
`;function v(e,r){return`https://explorer.solana.com/account/${e}?chain=${r}`}const F=e=>n.jsx(w,{href:e.chainType==="ethereum"?g(e.chainId,e.walletAddress):v(e.walletAddress,e.chainId),target:"_blank",children:$(e.walletAddress)});let w=s.a`
  &:hover {
    text-decoration: underline;
  }
`;export{D as f,q as h,P as p,F as v};
