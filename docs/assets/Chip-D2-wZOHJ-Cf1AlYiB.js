import{j as s}from"./vendor-wallet-CC_hGl00.js";import{be as l,aW as a,c}from"./index-443jfUVp.js";import{n as t}from"./LoadingSkeleton-U6-3yFwI-BdVOy9FC.js";const u=({children:o,color:i,isLoading:r,isPulsing:e,...n})=>s.jsx(g,{$color:i,$isLoading:r,$isPulsing:e,...n,children:o});let g=c.span`
  padding: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1rem; /* 150% */
  border-radius: var(--privy-border-radius-xs);
  display: flex;
  align-items: center;
  ${o=>{let i,r;o.$color==="green"&&(i="var(--privy-color-success-dark)",r="var(--privy-color-success-light)"),o.$color==="red"&&(i="var(--privy-color-error)",r="var(--privy-color-error-light)"),o.$color==="gray"&&(i="var(--privy-color-foreground-2)",r="var(--privy-color-background-2)");let e=l`
      from, to {
        background-color: ${r};
      }

      50% {
        background-color: rgba(${r}, 0.8);
      }
    `;return a`
      color: ${i};
      background-color: ${r};
      ${o.$isPulsing&&a`
        animation: ${e} 3s linear infinite;
      `};
    `}}

  ${t}
`;export{u as n};
