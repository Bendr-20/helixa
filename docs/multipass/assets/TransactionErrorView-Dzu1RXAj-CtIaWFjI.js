import{d2 as g,d0 as Le,c$ as e,c_ as te,e8 as oe,gy as Ne,dq as c,gz as Se}from"./index-BQcruxpq.js";import{T as J,g as Re,m as K,u as le,V as Be}from"./ModalHeader-YbJk-YIQ-CkWkhqeO.js";import{t as V,s,e as n,n as i,a as ze}from"./Value-tcJV9e0L-NpNm3C_L.js";import{e as z}from"./ErrorMessage-D8VaAP5m-SYErZ-_2.js";import{r as T}from"./LabelXs-oqZNqbm_-pndNabGd.js";import{r as ae}from"./Subtitle-CV-2yKE4-BchphNnb.js";import{e as de}from"./Title-BnzYV3Is-BZeSezB2.js";import{d}from"./Address-Wk5-LLxD-BFgJfTjF.js";import{j as Ve}from"./WalletInfoCard-CHPsZtT1-973gCRi-.js";import{n as ce}from"./LoadingSkeleton-U6-3yFwI-BEhMNpgp.js";import{d as He}from"./shared-FM0rljBt-BvJImLnA.js";import{o as Pe,F as We}from"./Checkbox-BhNoOKjX-Dyns4t6u.js";import{t as Ue}from"./ErrorBanner-CQERa7bL-B-DnYLkm.js";import{t as qe}from"./WarningBanner-D5LqDt95-DDgrpQRB.js";import{F as Qe}from"./ExclamationCircleIcon-DzK5F7-N.js";import{F as xe}from"./ChevronDownIcon-CK6Pl0eZ.js";import{i as G}from"./formatters-DX4Ff6ot.js";function Je({title:l,titleId:a,...o},x){return g.createElement("svg",Object.assign({xmlns:"http://www.w3.org/2000/svg",fill:"none",viewBox:"0 0 24 24",strokeWidth:1.5,stroke:"currentColor","aria-hidden":"true","data-slot":"icon",ref:x,"aria-labelledby":a},o),l?g.createElement("title",{id:a},l):null,g.createElement("path",{strokeLinecap:"round",strokeLinejoin:"round",d:"M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"}))}const Ke=g.forwardRef(Je);function Ze({title:l,titleId:a,...o},x){return g.createElement("svg",Object.assign({xmlns:"http://www.w3.org/2000/svg",fill:"none",viewBox:"0 0 24 24",strokeWidth:1.5,stroke:"currentColor","aria-hidden":"true","data-slot":"icon",ref:x,"aria-labelledby":a},o),l?g.createElement("title",{id:a},l):null,g.createElement("path",{strokeLinecap:"round",strokeLinejoin:"round",d:"m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z"}))}const he=g.forwardRef(Ze);function _e({title:l,titleId:a,...o},x){return g.createElement("svg",Object.assign({xmlns:"http://www.w3.org/2000/svg",fill:"none",viewBox:"0 0 24 24",strokeWidth:1.5,stroke:"currentColor","aria-hidden":"true","data-slot":"icon",ref:x,"aria-labelledby":a},o),l?g.createElement("title",{id:a},l):null,g.createElement("path",{strokeLinecap:"round",strokeLinejoin:"round",d:"M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5A3.375 3.375 0 0 0 6.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0 0 15 2.25h-1.5a2.251 2.251 0 0 0-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 0 0-9-9Z"}))}const Ye=g.forwardRef(_e),je=c(n)`
  cursor: pointer;
  display: inline-flex;
  gap: 8px;
  align-items: center;
  color: var(--privy-color-accent);
  svg {
    fill: var(--privy-color-accent);
  }
`;var X=({iconUrl:l,value:a,symbol:o,usdValue:x,nftName:b,nftCount:u,decimals:t,$isLoading:m})=>{if(m)return e.jsx($,{$isLoading:m});let f=a&&x&&t?(function(I,M,E){let A=parseFloat(I),j=parseFloat(E);if(A===0||j===0||Number.isNaN(A)||Number.isNaN(j))return I;let v=Math.ceil(-Math.log10(.01/(j/A))),k=Math.pow(10,v=Math.max(v=Math.min(v,M),1)),C=+(Math.floor(A*k)/k).toFixed(v).replace(/\.?0+$/,"");return Intl.NumberFormat(void 0,{maximumFractionDigits:M}).format(C)})(a,t,x):a;return e.jsxs("div",{children:[e.jsxs($,{$isLoading:m,children:[l&&e.jsx(Xe,{src:l,alt:"Token icon"}),u&&u>1?u+"x":void 0," ",b,f," ",o]}),x&&e.jsxs(Ge,{$isLoading:m,children:["$",x]})]})};let $=c.span`
  color: var(--privy-color-foreground);
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.375rem;
  word-break: break-all;
  text-align: right;
  display: flex;
  justify-content: flex-end;

  ${ce}
`;const Ge=c.span`
  color: var(--privy-color-foreground-2);
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  word-break: break-all;
  text-align: right;
  display: flex;
  justify-content: flex-end;

  ${ce}
`;let Xe=c.img`
  height: 14px;
  width: 14px;
  margin-right: 4px;
  object-fit: contain;
`;const $e=l=>{let{chain:a,transactionDetails:o,isTokenContractInfoLoading:x,symbol:b}=l,{action:u,functionName:t}=o;return e.jsx(He,{children:e.jsxs(V,{children:[u!=="transaction"&&e.jsxs(s,{children:[e.jsx(n,{children:"Action"}),e.jsx(i,{children:t})]}),t==="mint"&&"args"in o&&o.args.filter((m=>m)).map(((m,f)=>e.jsxs(s,{children:[e.jsx(n,{children:`Param ${f}`}),e.jsx(i,{children:typeof m=="string"&&Se(m)?e.jsx(d,{address:m,url:a?.blockExplorers?.default?.url,showCopyIcon:!1}):m?.toString()})]},f))),t==="setApprovalForAll"&&o.operator&&e.jsxs(s,{children:[e.jsx(n,{children:"Operator"}),e.jsx(i,{children:e.jsx(d,{address:o.operator,url:a?.blockExplorers?.default?.url,showCopyIcon:!1})})]}),t==="setApprovalForAll"&&o.approved!==void 0&&e.jsxs(s,{children:[e.jsx(n,{children:"Set approval to"}),e.jsx(i,{children:o.approved?"true":"false"})]}),t==="transfer"||t==="transferWithMemo"||t==="transferFrom"||t==="safeTransferFrom"||t==="approve"?e.jsxs(e.Fragment,{children:["formattedAmount"in o&&o.formattedAmount&&e.jsxs(s,{children:[e.jsx(n,{children:"Amount"}),e.jsxs(i,{$isLoading:x,children:[o.formattedAmount," ",b]})]}),"tokenId"in o&&o.tokenId&&e.jsxs(s,{children:[e.jsx(n,{children:"Token ID"}),e.jsx(i,{children:o.tokenId.toString()})]})]}):null,t==="safeBatchTransferFrom"&&e.jsxs(e.Fragment,{children:["amounts"in o&&o.amounts&&e.jsxs(s,{children:[e.jsx(n,{children:"Amounts"}),e.jsx(i,{children:o.amounts.join(", ")})]}),"tokenIds"in o&&o.tokenIds&&e.jsxs(s,{children:[e.jsx(n,{children:"Token IDs"}),e.jsx(i,{children:o.tokenIds.join(", ")})]})]}),t==="approve"&&o.spender&&e.jsxs(s,{children:[e.jsx(n,{children:"Spender"}),e.jsx(i,{children:e.jsx(d,{address:o.spender,url:a?.blockExplorers?.default?.url,showCopyIcon:!1})})]}),(t==="transferFrom"||t==="safeTransferFrom"||t==="safeBatchTransferFrom")&&o.transferFrom&&e.jsxs(s,{children:[e.jsx(n,{children:"Transferring from"}),e.jsx(i,{children:e.jsx(d,{address:o.transferFrom,url:a?.blockExplorers?.default?.url,showCopyIcon:!1})})]}),(t==="transferFrom"||t==="safeTransferFrom"||t==="safeBatchTransferFrom")&&o.transferTo&&e.jsxs(s,{children:[e.jsx(n,{children:"Transferring to"}),e.jsx(i,{children:e.jsx(d,{address:o.transferTo,url:a?.blockExplorers?.default?.url,showCopyIcon:!1})})]})]})})},er=({variant:l,setPreventMaliciousTransaction:a,colorScheme:o="light",preventMaliciousTransaction:x})=>l==="warn"?e.jsx(ee,{children:e.jsxs(qe,{theme:o,children:[e.jsx("span",{style:{fontWeight:"500"},children:"Warning: Suspicious transaction"}),e.jsx("br",{}),"This has been flagged as a potentially deceptive request. Approving could put your assets or funds at risk."]})}):l==="error"?e.jsx(e.Fragment,{children:e.jsxs(ee,{children:[e.jsx(Ue,{theme:o,children:e.jsxs("div",{children:[e.jsx("strong",{children:"This is a malicious transaction"}),e.jsx("br",{}),"This transaction transfers tokens to a known malicious address. Proceeding may result in the loss of valuable assets."]})}),e.jsxs(rr,{children:[e.jsx(Pe,{color:"var(--privy-color-error)",checked:!x,readOnly:!0,onClick:()=>a(!x)}),e.jsx("span",{children:"I understand and want to proceed anyways."})]})]})}):null;let ee=c.div`
  margin-top: 1.5rem;
`,rr=c.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
`;const sr=({transactionIndex:l,maxIndex:a})=>typeof l!="number"||a===0?"":` (${l+1} / ${a+1})`,Dr=({img:l,submitError:a,prepareError:o,onClose:x,action:b,title:u,subtitle:t,to:m,tokenAddress:f,network:I,missingFunds:M,fee:E,from:A,cta:j,disabled:v,chain:k,isSubmitting:C,isPreparing:p,isTokenPriceLoading:O,isTokenContractInfoLoading:N,isSponsored:S,symbol:H,balance:R,onClick:D,transactionDetails:F,transactionIndex:B,maxIndex:P,onBack:r,chainName:y,validation:W,hasScanDetails:Z,setIsScanDetailsOpen:ke,preventMaliciousTransaction:ye,setPreventMaliciousTransaction:ve,tokensSent:_,tokensReceived:U,isScanning:we,isCancellable:be,functionName:Te})=>{let{showTransactionDetails:q,setShowTransactionDetails:Ie,hasMoreDetails:Ae,isErc20Ish:Ce}=(h=>{let[L,Ee]=g.useState(!1),Q=!0,Y=!1;return(!h||h.isErc20Ish||h.action==="transaction")&&(Q=!1),Q&&(Y=Object.entries(h||{}).some((([Oe,De])=>De&&!["action","isErc20Ish","isNFTIsh"].includes(Oe)))),{showTransactionDetails:L,setShowTransactionDetails:Ee,hasMoreDetails:Q&&Y,isErc20Ish:h?.isErc20Ish}})(F),Fe=te(),Me=Ce&&N||p||O||we;return e.jsxs(e.Fragment,{children:[e.jsx(J,{onClose:x,backFn:r}),l&&e.jsx(pe,{children:l}),e.jsxs(de,{style:{marginTop:l?"1.5rem":0},children:[u,e.jsx(sr,{maxIndex:P,transactionIndex:B})]}),e.jsx(ae,{children:t}),e.jsxs(V,{style:{marginTop:"2rem"},children:[(!!_[0]||Me)&&e.jsxs(s,{children:[U.length>0?e.jsx(n,{children:"Send"}):e.jsx(n,{children:b==="approve"?"Approval amount":"Amount"}),e.jsx("div",{className:"flex flex-col",children:_.map(((h,L)=>e.jsx(X,{iconUrl:h.iconUrl,value:Te==="setApprovalForAll"?"All":h.value,usdValue:h.usdValue,symbol:h.symbol,nftName:h.nftName,nftCount:h.nftCount,decimals:h.decimals},L)))})]}),U.length>0&&e.jsxs(s,{children:[e.jsx(n,{children:"Receive"}),e.jsx("div",{className:"flex flex-col",children:U.map(((h,L)=>e.jsx(X,{iconUrl:h.iconUrl,value:h.value,usdValue:h.usdValue,symbol:h.symbol,nftName:h.nftName,nftCount:h.nftCount,decimals:h.decimals},L)))})]}),F&&"spender"in F&&F?.spender?e.jsxs(s,{children:[e.jsx(n,{children:"Spender"}),e.jsx(i,{children:e.jsx(d,{address:F.spender,url:k?.blockExplorers?.default?.url})})]}):null,m&&e.jsxs(s,{children:[e.jsx(n,{children:"To"}),e.jsx(i,{children:e.jsx(d,{address:m,url:k?.blockExplorers?.default?.url,showCopyIcon:!0})})]}),f&&e.jsxs(s,{children:[e.jsx(n,{children:"Token address"}),e.jsx(i,{children:e.jsx(d,{address:f,url:k?.blockExplorers?.default?.url})})]}),e.jsxs(s,{children:[e.jsx(n,{children:"Network"}),e.jsx(i,{children:I})]}),e.jsxs(s,{children:[e.jsx(n,{children:"Estimated fee"}),e.jsx(i,{$isLoading:p||O||S===void 0,children:S?e.jsxs(ge,{children:[e.jsxs(fe,{children:["Sponsored by ",Fe.name]}),e.jsx(he,{height:16,width:16})]}):E})]}),Ae&&!Z&&e.jsxs(e.Fragment,{children:[e.jsx(s,{className:"cursor-pointer",onClick:()=>Ie(!q),children:e.jsxs(ze,{className:"flex items-center gap-x-1",children:["Details"," ",e.jsx(xe,{style:{width:"0.75rem",marginLeft:"0.25rem",transform:q?"rotate(180deg)":void 0}})]})}),q&&F&&e.jsx($e,{action:b,chain:k,transactionDetails:F,isTokenContractInfoLoading:N,symbol:H})]}),Z&&e.jsx(s,{children:e.jsxs(je,{onClick:()=>ke(!0),children:[e.jsx("span",{className:"text-color-primary",children:"Details"}),e.jsx(Ke,{height:"14px",width:"14px",strokeWidth:"2"})]})})]}),e.jsx(oe,{}),a?e.jsx(z,{style:{marginTop:"2rem"},children:a.message}):o&&B===0?e.jsx(z,{style:{marginTop:"2rem"},children:o.shortMessage??ue}):null,e.jsx(er,{variant:W,preventMaliciousTransaction:ye,setPreventMaliciousTransaction:ve}),e.jsx(me,{$useSmallMargins:!(!o&&!a&&W!=="warn"&&W!=="error"),address:A,balance:R,errMsg:p||o||a||!M?void 0:`Add funds on ${k?.name??y} to complete transaction.`}),e.jsx(K,{style:{marginTop:"1rem"},loading:C,disabled:v||p,onClick:D,children:j}),be&&e.jsx(Be,{style:{marginTop:"1rem"},onClick:x,isSubmitting:!1,children:"Not now"}),e.jsx(le,{})]})},Lr=({img:l,title:a,subtitle:o,cta:x,instructions:b,network:u,blockExplorerUrl:t,isMissingFunds:m,submitError:f,parseError:I,total:M,swap:E,transactingWalletAddress:A,fee:j,balance:v,disabled:k,isSubmitting:C,isPreparing:p,isTokenPriceLoading:O,onClick:N,onClose:S,onBack:H,isSponsored:R})=>{let D=p||O,[F,B]=g.useState(!1),P=te();return e.jsxs(e.Fragment,{children:[e.jsx(J,{onClose:S,backFn:H}),l&&e.jsx(pe,{children:l}),e.jsx(de,{style:{marginTop:l?"1.5rem":0},children:a}),e.jsx(ae,{children:o}),e.jsxs(V,{style:{marginTop:"2rem",marginBottom:".5rem"},children:[(M||D)&&e.jsxs(s,{children:[e.jsx(n,{children:"Amount"}),e.jsx(i,{$isLoading:D,children:M})]}),E&&e.jsxs(s,{children:[e.jsx(n,{children:"Swap"}),e.jsx(i,{children:E})]}),u&&e.jsxs(s,{children:[e.jsx(n,{children:"Network"}),e.jsx(i,{children:u})]}),(j||D||R!==void 0)&&e.jsxs(s,{children:[e.jsx(n,{children:"Estimated fee"}),e.jsx(i,{$isLoading:D,children:R&&!D?e.jsxs(ge,{children:[e.jsxs(fe,{children:["Sponsored by ",P.name]}),e.jsx(he,{height:16,width:16})]}):j})]})]}),e.jsx(s,{children:e.jsxs(je,{onClick:()=>B((r=>!r)),children:[e.jsx("span",{children:"Advanced"}),e.jsx(xe,{height:"16px",width:"16px",strokeWidth:"2",style:{transition:"all 300ms",transform:F?"rotate(180deg)":void 0}})]})}),F&&e.jsx(e.Fragment,{children:b.map(((r,y)=>r.type==="sol-transfer"?e.jsxs(w,{children:[e.jsx(s,{children:e.jsxs(T,{children:["Transfer ",r.withSeed?"with seed":""]})}),e.jsxs(s,{children:[e.jsx(n,{children:"Amount"}),e.jsxs(i,{children:[G({amount:r.value,decimals:r.token.decimals})," ",r.token.symbol]})]}),!!r.toAccount&&e.jsxs(s,{children:[e.jsx(n,{children:"Destination"}),e.jsx(i,{children:e.jsx(d,{address:r.toAccount,url:t})})]})]},y):r.type==="spl-transfer"?e.jsxs(w,{children:[e.jsx(s,{children:e.jsxs(T,{children:["Transfer ",r.token.symbol]})}),e.jsxs(s,{children:[e.jsx(n,{children:"Amount"}),e.jsx(i,{children:r.value.toString()})]}),!!r.fromAta&&e.jsxs(s,{children:[e.jsx(n,{children:"Source"}),e.jsx(i,{children:e.jsx(d,{address:r.fromAta,url:t})})]}),!!r.toAta&&e.jsxs(s,{children:[e.jsx(n,{children:"Destination"}),e.jsx(i,{children:e.jsx(d,{address:r.toAta,url:t})})]}),!!r.token.address&&e.jsxs(s,{children:[e.jsx(n,{children:"Token"}),e.jsx(i,{children:e.jsx(d,{address:r.token.address,url:t})})]})]},y):r.type==="ata-creation"?e.jsxs(w,{children:[e.jsx(s,{children:e.jsx(T,{children:"Create token account"})}),e.jsxs(s,{children:[e.jsx(n,{children:"Program ID"}),e.jsx(i,{children:e.jsx(d,{address:r.program,url:t})})]}),!!r.owner&&e.jsxs(s,{children:[e.jsx(n,{children:"Owner"}),e.jsx(i,{children:e.jsx(d,{address:r.owner,url:t})})]})]},y):r.type==="create-account"?e.jsxs(w,{children:[e.jsx(s,{children:e.jsxs(T,{children:["Create account ",r.withSeed?"with seed":""]})}),!!r.account&&e.jsxs(s,{children:[e.jsx(n,{children:"Account"}),e.jsx(i,{children:e.jsx(d,{address:r.account,url:t})})]}),e.jsxs(s,{children:[e.jsx(n,{children:"Amount"}),e.jsxs(i,{children:[G({amount:r.value,decimals:9})," SOL"]})]})]},y):r.type==="spl-init-account"?e.jsxs(w,{children:[e.jsx(s,{children:e.jsx(T,{children:"Initialize token account"})}),!!r.account&&e.jsxs(s,{children:[e.jsx(n,{children:"Account"}),e.jsx(i,{children:e.jsx(d,{address:r.account,url:t})})]}),!!r.mint&&e.jsxs(s,{children:[e.jsx(n,{children:"Mint"}),e.jsx(i,{children:e.jsx(d,{address:r.mint,url:t})})]}),!!r.owner&&e.jsxs(s,{children:[e.jsx(n,{children:"Owner"}),e.jsx(i,{children:e.jsx(d,{address:r.owner,url:t})})]})]},y):r.type==="spl-close-account"?e.jsxs(w,{children:[e.jsx(s,{children:e.jsx(T,{children:"Close token account"})}),!!r.source&&e.jsxs(s,{children:[e.jsx(n,{children:"Source"}),e.jsx(i,{children:e.jsx(d,{address:r.source,url:t})})]}),!!r.destination&&e.jsxs(s,{children:[e.jsx(n,{children:"Destination"}),e.jsx(i,{children:e.jsx(d,{address:r.destination,url:t})})]}),!!r.owner&&e.jsxs(s,{children:[e.jsx(n,{children:"Owner"}),e.jsx(i,{children:e.jsx(d,{address:r.owner,url:t})})]})]},y):r.type==="spl-sync-native"?e.jsxs(w,{children:[e.jsx(s,{children:e.jsx(T,{children:"Sync native"})}),e.jsxs(s,{children:[e.jsx(n,{children:"Program ID"}),e.jsx(i,{children:e.jsx(d,{address:r.program,url:t})})]})]},y):r.type==="raydium-swap-base-input"?e.jsxs(w,{children:[e.jsx(s,{children:e.jsxs(T,{children:["Raydium swap"," ",r.tokenIn&&r.tokenOut?`${r.tokenIn.symbol} → ${r.tokenOut.symbol}`:""]})}),e.jsxs(s,{children:[e.jsx(n,{children:"Amount in"}),e.jsx(i,{children:r.amountIn.toString()})]}),e.jsxs(s,{children:[e.jsx(n,{children:"Minimum amount out"}),e.jsx(i,{children:r.minimumAmountOut.toString()})]}),r.mintIn&&e.jsxs(s,{children:[e.jsx(n,{children:"Token in"}),e.jsx(i,{children:e.jsx(d,{address:r.mintIn,url:t})})]}),r.mintOut&&e.jsxs(s,{children:[e.jsx(n,{children:"Token out"}),e.jsx(i,{children:e.jsx(d,{address:r.mintOut,url:t})})]})]},y):r.type==="raydium-swap-base-output"?e.jsxs(w,{children:[e.jsx(s,{children:e.jsxs(T,{children:["Raydium swap"," ",r.tokenIn&&r.tokenOut?`${r.tokenIn.symbol} → ${r.tokenOut.symbol}`:""]})}),e.jsxs(s,{children:[e.jsx(n,{children:"Max amount in"}),e.jsx(i,{children:r.maxAmountIn.toString()})]}),e.jsxs(s,{children:[e.jsx(n,{children:"Amount out"}),e.jsx(i,{children:r.amountOut.toString()})]}),r.mintIn&&e.jsxs(s,{children:[e.jsx(n,{children:"Token in"}),e.jsx(i,{children:e.jsx(d,{address:r.mintIn,url:t})})]}),r.mintOut&&e.jsxs(s,{children:[e.jsx(n,{children:"Token out"}),e.jsx(i,{children:e.jsx(d,{address:r.mintOut,url:t})})]})]},y):r.type==="jupiter-swap-shared-accounts-route"?e.jsxs(w,{children:[e.jsx(s,{children:e.jsxs(T,{children:["Jupiter swap"," ",r.tokenIn&&r.tokenOut?`${r.tokenIn.symbol} → ${r.tokenOut.symbol}`:""]})}),e.jsxs(s,{children:[e.jsx(n,{children:"In amount"}),e.jsx(i,{children:r.inAmount.toString()})]}),e.jsxs(s,{children:[e.jsx(n,{children:"Quoted out amount"}),e.jsx(i,{children:r.quotedOutAmount.toString()})]}),r.mintIn&&e.jsxs(s,{children:[e.jsx(n,{children:"Token in"}),e.jsx(i,{children:e.jsx(d,{address:r.mintIn,url:t})})]}),r.mintOut&&e.jsxs(s,{children:[e.jsx(n,{children:"Token out"}),e.jsx(i,{children:e.jsx(d,{address:r.mintOut,url:t})})]})]},y):r.type==="jupiter-swap-exact-out-route"?e.jsxs(w,{children:[e.jsx(s,{children:e.jsxs(T,{children:["Jupiter swap"," ",r.tokenIn&&r.tokenOut?`${r.tokenIn.symbol} → ${r.tokenOut.symbol}`:""]})}),e.jsxs(s,{children:[e.jsx(n,{children:"Quoted in amount"}),e.jsx(i,{children:r.quotedInAmount.toString()})]}),e.jsxs(s,{children:[e.jsx(n,{children:"Amount out"}),e.jsx(i,{children:r.outAmount.toString()})]}),r.mintIn&&e.jsxs(s,{children:[e.jsx(n,{children:"Token in"}),e.jsx(i,{children:e.jsx(d,{address:r.mintIn,url:t})})]}),r.mintOut&&e.jsxs(s,{children:[e.jsx(n,{children:"Token out"}),e.jsx(i,{children:e.jsx(d,{address:r.mintOut,url:t})})]})]},y):e.jsxs(w,{children:[e.jsxs(s,{children:[e.jsx(n,{children:"Program ID"}),e.jsx(i,{children:e.jsx(d,{address:r.program,url:t})})]}),e.jsxs(s,{children:[e.jsx(n,{children:"Data"}),e.jsx(i,{children:r.discriminator})]})]},y)))}),e.jsx(oe,{}),f?e.jsx(z,{style:{marginTop:"2rem"},children:f.message}):I?e.jsx(z,{style:{marginTop:"2rem"},children:ue}):null,e.jsx(me,{$useSmallMargins:!(!I&&!f),title:"",address:A,balance:v,errMsg:p||I||f||!m?void 0:"Add funds on Solana to complete transaction."}),e.jsx(K,{style:{marginTop:"1rem"},loading:C,disabled:k||p,onClick:N,children:x}),e.jsx(le,{})]})};let me=c(Ve)`
  ${l=>l.$useSmallMargins?"margin-top: 0.5rem;":"margin-top: 2rem;"}
`,w=c(V)`
  margin-top: 0.5rem;
  border: 1px solid var(--privy-color-foreground-4);
  border-radius: var(--privy-border-radius-sm);
  padding: 0.5rem;
`,ue="There was an error preparing your transaction. Your transaction request will likely fail.",pe=c.div`
  display: flex;
  width: 100%;
  justify-content: center;
  max-height: 40px;

  > img {
    object-fit: contain;
    border-radius: var(--privy-border-radius-sm);
  }
`,ge=c.span`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
`,fe=c.span`
  font-size: 14px;
  font-weight: 500;
  color: var(--privy-color-foreground);
`,re=l=>l?.code===Ne.COMPLIANCE_BLOCKED,nr=()=>e.jsxs(lr,{children:[e.jsx(dr,{}),e.jsx(ar,{})]});const Nr=({transactionError:l,chainId:a,onClose:o,onRetry:x,chainType:b,transactionHash:u})=>{let{chains:t}=Le(),[m,f]=g.useState(!1),{errorCode:I,errorMessage:M}=((j,v)=>{if(v==="ethereum")return re(j)?{errorCode:"Transaction blocked",errorMessage:j.message}:{errorCode:j.details??j.message,errorMessage:j.shortMessage};let k=j.txSignature,C=j?.transactionMessage||"Something went wrong.";if(Array.isArray(j.logs)){let p=j.logs.find((O=>/insufficient (lamports|funds)/gi.test(O)));p&&(C=p)}return{transactionHash:k,errorMessage:C}})(l,b),E=re(l),A=(({chains:j,chainId:v,chainType:k,transactionHash:C})=>k==="ethereum"?j.find((p=>p.id===v))?.blockExplorers?.default.url??"https://etherscan.io":(function(p,O){return`https://explorer.solana.com/tx/${p}?chain=${O}`})(C||"",v))({chains:t,chainId:a,chainType:b,transactionHash:u});return e.jsxs(e.Fragment,{children:[e.jsx(J,{onClose:o}),e.jsxs(ir,{children:[e.jsx(nr,{}),e.jsx(tr,{children:I}),e.jsx(or,{children:E?"This transaction cannot be completed.":"Please try again."}),e.jsxs(ne,{children:[e.jsx(se,{children:"Error message"}),e.jsx(ie,{$clickable:!1,children:M})]}),u&&e.jsxs(ne,{children:[e.jsx(se,{children:"Transaction hash"}),e.jsxs(xr,{children:["Copy this hash to view details about the transaction on a"," ",e.jsx("u",{children:e.jsx("a",{href:A,children:"block explorer"})}),"."]}),e.jsxs(ie,{$clickable:!0,onClick:async()=>{await navigator.clipboard.writeText(u),f(!0)},children:[u,e.jsx(mr,{clicked:m})]})]}),!E&&e.jsx(cr,{onClick:()=>x({resetNonce:!!u}),children:"Retry transaction"})]}),e.jsx(Re,{})]})};let ir=c.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`,tr=c.span`
  color: var(--privy-color-foreground);
  text-align: center;
  font-size: 1.125rem;
  font-weight: 500;
  line-height: 1.25rem; /* 111.111% */
  text-align: center;
  margin: 10px;
`,or=c.span`
  margin-top: 4px;
  margin-bottom: 10px;
  color: var(--privy-color-foreground-3);
  text-align: center;

  font-size: 0.875rem;
  font-style: normal;
  font-weight: 400;
  line-height: 20px; /* 142.857% */
  letter-spacing: -0.008px;
`,lr=c.div`
  position: relative;
  width: 60px;
  height: 60px;
  margin: 10px;
  display: flex;
  justify-content: center;
  align-items: center;
`,ar=c(Qe)`
  position: absolute;
  width: 35px;
  height: 35px;
  color: var(--privy-color-error);
`,dr=c.div`
  position: absolute;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background-color: var(--privy-color-error);
  opacity: 0.1;
`,cr=c(K)`
  && {
    margin-top: 24px;
  }
  transition:
    color 350ms ease,
    background-color 350ms ease;
`,se=c.span`
  width: 100%;
  text-align: left;
  font-size: 0.825rem;
  color: var(--privy-color-foreground);
  padding: 4px;
`,ne=c.div`
  width: 100%;
  margin: 5px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
`,xr=c.text`
  position: relative;
  width: 100%;
  padding: 5px;
  font-size: 0.8rem;
  color: var(--privy-color-foreground-3);
  text-align: left;
  word-wrap: break-word;
`,ie=c.span`
  position: relative;
  width: 100%;
  background-color: var(--privy-color-background-2);
  padding: 8px 12px;
  border-radius: 10px;
  margin-top: 5px;
  font-size: 14px;
  color: var(--privy-color-foreground-3);
  text-align: left;
  word-wrap: break-word;
  ${l=>l.$clickable&&`cursor: pointer;
  transition: background-color 0.3s;
  padding-right: 45px;

  &:hover {
    background-color: var(--privy-color-foreground-4);
  }`}
`,hr=c(Ye)`
  position: absolute;
  top: 13px;
  right: 13px;
  width: 24px;
  height: 24px;
`,jr=c(We)`
  position: absolute;
  top: 13px;
  right: 13px;
  width: 24px;
  height: 24px;
`,mr=({clicked:l})=>e.jsx(l?jr:hr,{});export{Lr as G,Dr as Q,Nr as o};
