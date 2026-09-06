import{c$ as l,e0 as s,e1 as n,dq as c}from"./index-CXAb4p9O.js";import{n as t}from"./LoadingSkeleton-U6-3yFwI-Bf7qLjKb.js";const p=({children:o,color:i,isLoading:r,isPulsing:e,...a})=>l.jsx(g,{$color:i,$isLoading:r,$isPulsing:e,...a,children:o});let g=c.span`
  padding: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1rem; /* 150% */
  border-radius: var(--privy-border-radius-xs);
  display: flex;
  align-items: center;
  ${o=>{let i,r;o.$color==="green"&&(i="var(--privy-color-success-dark)",r="var(--privy-color-success-light)"),o.$color==="red"&&(i="var(--privy-color-error)",r="var(--privy-color-error-light)"),o.$color==="gray"&&(i="var(--privy-color-foreground-2)",r="var(--privy-color-background-2)");let e=s`
      from, to {
        background-color: ${r};
      }

      50% {
        background-color: rgba(${r}, 0.8);
      }
    `;return n`
      color: ${i};
      background-color: ${r};
      ${o.$isPulsing&&n`
        animation: ${e} 3s linear infinite;
      `};
    `}}

  ${t}
`;export{p as n};
