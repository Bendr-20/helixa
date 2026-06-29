import{eH as ue,eI as pe,aS as E,aU as m,aP as me,aR as t,bg as Y,bf as d,eJ as fe,b0 as he}from"./index-BIIr9Zi4.js";import{n as C}from"./ScreenLayout-Ce16-u0i-DHLa5wS9.js";import{n as Q}from"./styles-DVyDvTdj-DpAMfmC6.js";import{m as ge}from"./ModalHeader-YbJk-YIQ-C-N0i6VD.js";import{C as ye}from"./QrCode-BxAVhbx2-BKG6K9Jp.js";import{u as be,a as ve,s as xe,b as Ce,c as we,d as Ee,e as _e,f as ke,g as Te,F as je,h as Se,o as Ne,i as Ue,j as Ae}from"./floating-ui.react-BgpiDbNn.js";import{m as De}from"./CopyableText-ChtfBWx4-Ctw1vTiV.js";import{T as O}from"./triangle-alert-DSFdA_ZU.js";import{c as $}from"./createLucideIcon-BWu0ydMA.js";import{r as G,C as Ie}from"./chevron-down-C9e8JkFh.js";import{C as F}from"./check-D5uJ-pvI.js";import{H as Re}from"./hourglass-C6oTDxwh.js";import{I as Oe}from"./info-DEpZzmZg.js";import"./Screen-CdOj1bUg-4yeSP8XK.js";import"./index-Dq_xe9dz-DEotILZS.js";import"./dijkstra-COg3n3zL.js";import"./copy-CSQsgy2k.js";const K={path:"/api/v1/onramp/deposit_addresses/quote",method:"POST"},P={path:"/api/v1/onramp/deposit_addresses/orders/:order_id",method:"GET"},$e={path:"/api/v1/onramp/deposit_addresses/:deposit_address_id/next_order",method:"GET"},J={path:"/api/v1/onramp/deposit_addresses/deposit_config",method:"GET"};function M(e){return e.startsWith("eip155:")?"ethereum":e.startsWith("solana:")?"solana":e.startsWith("bip122:")?"bitcoin-segwit":e.startsWith("tron:")?"tron":void 0}async function Z(e){let{user:r}=await e.privy.user.get();if(!r)return{ok:!1,error:"NOT_AUTHENTICATED"};let n=(function(i,l){let a=M(i);if(!a)return;let u=l.linked_accounts.find((s=>s.type==="wallet"&&s.chain_type===a&&"address"in s&&s.address));return u&&"address"in u?u.address:void 0})(e.caip2,r);if(n)return{ok:!0,address:n};let o=M(e.caip2);if(!o)return{ok:!1,error:"UNSUPPORTED_CHAIN"};try{let i=await e.privy.fetchPrivyRoute(ue,{body:{chain_type:o}});return await e.onWalletCreated?.(),{ok:!0,address:i.address}}catch{return{ok:!1,error:"REFUND_WALLET_CREATION_FAILED"}}}async function Fe(e){let{user:r}=await e.privy.user.get();if(!r)throw Error("NOT_AUTHENTICATED");let n=e.refundAddress;if(!n){let o=await Z({privy:e.privy,caip2:e.sourceChain,onWalletCreated:e.onWalletCreated});if(!o.ok)throw Error(o.error);n=o.address}return await e.privy.fetchPrivyRoute(K,{body:{source_chain:e.sourceChain,source_currency:e.sourceCurrency,destination_chain:e.destinationChain,destination_currency:e.destinationCurrency,destination_address:e.destinationAddress,refund_address:n,...e.slippageBps!=null?{slippage_bps:e.slippageBps}:{}}})}function ee(e,r){return Math.ceil(r/e)}function re(e){return e.status==="success"?e.result?{status:"success",order:e.result}:{status:"timeout"}:e.status==="aborted"?{status:"aborted",error:e.error}:{status:"timeout",error:e.error}}async function Pe(e){return await e.privy.fetchPrivyRoute(P,{params:{order_id:e.orderId}})}async function Le(e){let r=e.pollIntervalMs??2e3,n=e.timeoutMs??18e5,o=e.signal??new AbortController().signal;return re(await G({operation:async()=>{let i=await e.privy.fetchPrivyRoute($e,{params:{deposit_address_id:e.depositAddressId},query:{after:e.quoteCreatedAt}});if(i.order)return await e.privy.fetchPrivyRoute(P,{params:{order_id:i.order.id}})},until:i=>i!==void 0,delay:r,interval:r,attempts:ee(r,n),signal:o}))}async function Me(e){let r=e.pollIntervalMs??2e3,n=e.timeoutMs??18e5,o=e.signal??new AbortController().signal;return re(await G({operation:()=>e.privy.fetchPrivyRoute(P,{params:{order_id:e.orderId}}),until:i=>i.status!=="executing",delay:r,interval:r,attempts:ee(r,n),signal:o}))}async function ze(e){let r=await e.fetchPrivyRoute(J,{});return{currencies:r.currencies,chains:r.chains}}var L=Object.freeze({__proto__:null,generateDepositAddress:Fe,getConfig:ze,getDeposit:Pe,resolveRefundAddress:Z,waitForCompletion:Me,waitForDeposit:Le});const _=pe((()=>null)),T=e=>{_.getState()!==null&&_.setState(e)};async function We(e){let r=await e.fetchPrivyRoute(J,{});T({config:{status:"ready",data:{currencies:r.currencies,chains:r.chains}}})}function g(){let e=_(),{closePrivyModal:r,privy:n}=E(),o=e?.params??null,i=e?.config??{status:"loading"},l=m.useCallback((s=>{T({modalState:s})}),[]),a=m.useCallback((async()=>{if(o){T({config:{status:"loading"}});try{await We(n)}catch(s){throw T({config:{status:"error",error:s instanceof Error?s:Error("Failed to load deposit config")}}),s}}}),[o,n]),u=m.useCallback((()=>{if(!e)return;let{modalState:s}=e;s.step==="complete"?e.onComplete():s.step==="failed"?e.onError(Error("DEPOSIT_FAILED")):s.step==="error"?e.onError(Error(s.code)):s.step==="refunded"?e.onError(Error("DEPOSIT_REFUNDED")):e.onError(Error("USER_EXITED")),r({shouldCallAuthOnSuccess:!1})}),[e,r]);return{modalState:e?.modalState??{step:"intro"},setModalState:l,config:i,retryConfig:a,params:o,close:u}}function w(e){let{modalState:r,config:n,params:o,...i}=g();if((function(l,a){if(l.step!==a)throw Error("UNEXPECTED_STATE")})(r,e),!o||n.status!=="ready")throw Error("UNEXPECTED_STATE");return{state:r,configData:n.data,params:o,...i}}const Ve=[["path",{d:"m18 15-6-6-6 6",key:"153udz"}]],Be=$("chevron-up",Ve);const qe=[["rect",{width:"5",height:"5",x:"3",y:"3",rx:"1",key:"1tu5fj"}],["rect",{width:"5",height:"5",x:"16",y:"3",rx:"1",key:"1v8r4q"}],["rect",{width:"5",height:"5",x:"3",y:"16",rx:"1",key:"1x03jg"}],["path",{d:"M21 16h-3a2 2 0 0 0-2 2v3",key:"177gqh"}],["path",{d:"M21 21v.01",key:"ents32"}],["path",{d:"M12 7v3a2 2 0 0 1-2 2H7",key:"8crl2c"}],["path",{d:"M3 12h.01",key:"nlz23k"}],["path",{d:"M12 3h.01",key:"n36tog"}],["path",{d:"M12 16v.01",key:"133mhm"}],["path",{d:"M16 12h1",key:"1slzba"}],["path",{d:"M21 12v.01",key:"1lwtk9"}],["path",{d:"M12 21v-1",key:"1880an"}]],te=$("qr-code",qe);const He=[["path",{d:"M9 14 4 9l5-5",key:"102s5s"}],["path",{d:"M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11",key:"f3b9sd"}]],Xe=$("undo-2",He);class Ye extends m.Component{static getDerivedStateFromError(){return{hasError:!0}}componentDidCatch(r,n){this.props.onError(r)}componentDidUpdate(r){r.resetKey!==this.props.resetKey&&this.state.hasError&&this.setState({hasError:!1})}render(){return this.state.hasError?null:this.props.children}constructor(...r){super(...r),this.state={hasError:!1}}}function Qe(e,r,n){let o=Number(e);return!Number.isFinite(o)||o===0?`1 ${r} ≈ ${e} ${n}`:o>=.01?`1 ${r} ≈ ${z(o)} ${n}`:`${z(1/o)} ${r} ≈ 1 ${n}`}function z(e){return e>=1e3?new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(Math.round(e)):e>=100?new Intl.NumberFormat("en-US",{maximumFractionDigits:1}).format(e):e>=1?new Intl.NumberFormat("en-US",{maximumFractionDigits:2}).format(e):new Intl.NumberFormat("en-US",{maximumFractionDigits:4}).format(e)}function W(e,r){let n=Number(e);if(!Number.isFinite(n)||n===0)return e;let o=r!=null?n/10**r:n;return o>=1e3?new Intl.NumberFormat("en-US",{maximumFractionDigits:2}).format(o):o>=1?new Intl.NumberFormat("en-US",{maximumFractionDigits:4}).format(o):o>=1e-4?new Intl.NumberFormat("en-US",{maximumFractionDigits:6}).format(o):new Intl.NumberFormat("en-US",{maximumSignificantDigits:4}).format(o)}function R({address:e,caip2:r,config:n}){for(let o of n.currencies){let i=o.chains.find((l=>l.caip2===r&&l.address.toLowerCase()===e.toLowerCase()));if(i)return{symbol:o.symbol.toUpperCase(),decimals:i.decimals}}return{symbol:e,decimals:void 0}}function V(e,r){return r[e]?.displayName??e}function B(e,r){if(!e.chains[r.destinationChain])return`Unsupported destination chain: "${r.destinationChain}". Check that the chain is in CAIP-2 format (e.g. "eip155:8453") and is supported for deposit addresses.`;let n=r.destinationCurrency.toLowerCase();return e.currencies.some((o=>o.chains.some((i=>i.caip2===r.destinationChain&&i.address.toLowerCase()===n))))?null:`Unsupported destination currency "${r.destinationCurrency}" on chain "${r.destinationChain}". Check that this token address is supported on the specified chain.`}let Ge=new Set(["ROUTE_UNAVAILABLE","UNEXPECTED_STATE","TIMEOUT_WAITING_FOR_NEXT_ORDER","TIMEOUT_ORDER_COMPLETION","DEPOSIT_FAILED","DEPOSIT_REFUNDED","USER_EXITED","AMOUNT_TOO_LOW","INSUFFICIENT_LIQUIDITY","UNSUPPORTED_CHAIN","UNSUPPORTED_CURRENCY","UNSUPPORTED_ROUTE","NO_SWAP_ROUTES_FOUND","NO_INTERNAL_SWAP_ROUTES_FOUND","NO_QUOTES","SANCTIONED_WALLET_ADDRESS","REFUND_WALLET_CREATION_FAILED","DEPOSIT_ADDRESSES_NOT_ENABLED","NOT_AUTHENTICATED"]);function Ke(e){return Ge.has(e)}function q(e){return Ke(e)?e:"UNKNOWN_ERROR"}function oe(){let{params:e,setModalState:r}=g(),{privy:n}=E(),o=(function(){let{privy:a,refreshSessionAndUser:u}=E();return m.useCallback(((s,c)=>c?Promise.resolve({ok:!0,address:c}):L.resolveRefundAddress({privy:a,caip2:s,onWalletCreated:u})),[a,u])})(),[i,l]=m.useState(!1);return{fetchQuote:m.useCallback((async(a,u,s)=>{if(e){l(!0);try{let c=await o(a.caip2,e.refundAddress);if(!c.ok)return void r({step:"error",code:q(c.error)});let p=await n.fetchPrivyRoute(K,{body:{source_chain:a.caip2,source_currency:a.currencyAddress,destination_chain:e.destinationChain,destination_currency:e.destinationCurrency,destination_address:e.destinationAddress,refund_address:c.address,...e.slippageBps!=null?{slippage_bps:e.slippageBps}:{}}});r({step:"address",selectedCurrency:u,selectedChain:a,availableChains:s,quote:p})}catch(c){let p=c instanceof Error?c:Error(String(c)),f="status"in p&&typeof p.status=="number"?p.status:void 0;r({step:"error",code:p instanceof fe&&p.code==="feature_not_enabled"?"DEPOSIT_ADDRESSES_NOT_ENABLED":f&&f>=500?"UNKNOWN_ERROR":q(p.message),message:p.message})}finally{l(!1)}}}),[e,n,o,r]),isFetching:i}}function ne(e,r){switch(e.status){case"completed":return r({step:"complete",order:e});case"refunded":return r({step:"refunded",order:e});case"failed":return r({step:"failed",order:e});case"executing":return r({step:"processing",order:e});default:return}}const j=d(C)`
  #privy-content-footer-container {
    margin-top: 0;
  }
`,Je=d.p`
  font-size: 0.875rem;
  font-weight: 400;
  line-height: 1.375rem;
  color: var(--privy-color-foreground-3);
  margin: 0.25rem 0 0;
`,se=d.img`
  width: 2rem;
  height: 2rem;
  border-radius: var(--privy-border-radius-full);
  object-fit: cover;
  flex-shrink: 0;
`,ie=d.img`
  width: 2rem;
  height: 2rem;
  border-radius: 4px;
  object-fit: cover;
  flex-shrink: 0;
`,ae=d.span`
  font-weight: 500;
`,Ze=d.span`
  font-size: 0.875rem;
  color: var(--privy-color-foreground-3);
  margin-left: auto;
`;d.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  min-height: 2.25rem;
  border-radius: 6.25rem;
  border: none;
  background-color: var(--privy-color-background-2);

  input {
    flex: 1;
    border: none;
    outline: none;
    box-shadow: none;
    font-size: 0.875rem;
    line-height: 1.25rem;
    background: transparent;
    color: var(--privy-color-foreground);

    &:focus {
      outline: none;
      box-shadow: none;
    }

    &::placeholder {
      color: var(--privy-color-foreground-3);
    }
  }
`;const le=d.button`
  && {
    position: relative;
    width: 100%;
    display: flex;
    gap: 0.75rem;
    align-items: center;
    padding: 0.625rem 0.75rem;
    min-height: 3.5rem;
    border: 1px solid
      ${e=>e.$selected?"var(--privy-color-icon-interactive)":"var(--privy-color-foreground-4)"};
    border-radius: var(--privy-border-radius-md);
    background-color: ${e=>e.$selected?"var(--privy-color-info-bg)":"transparent"};
    color: var(--privy-color-foreground);
    font-size: 0.875rem;
    line-height: 1.5rem;
    cursor: pointer;
    outline: none;
    box-shadow: none;
    transition:
      background-color 200ms ease,
      border-color 200ms ease;

    &:hover {
      background-color: var(--privy-color-background-2);
    }

    &:disabled {
      opacity: ${e=>e.$selected?1:.5};
      cursor: not-allowed;
    }

    &:focus,
    &:focus-visible {
      outline: none;
      box-shadow: none;
    }
  }
`,H=d.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 3rem 0;
`,er=d.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 0.5rem 0;
`,S=d.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`,N=d.div`
  width: 1.5rem;
  height: 1.5rem;
  border-radius: var(--privy-border-radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background-color: ${e=>e.$status==="done"?"var(--privy-color-success-light, #DCFCE7)":"var(--privy-color-background-2)"};
`,X=d.div`
  width: 2px;
  height: 1rem;
  background-color: var(--privy-color-background-2);
  margin-left: 0.6875rem;
`,U=d.span`
  font-size: 0.875rem;
  color: var(--privy-color-foreground);
`;d.div`
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: var(--privy-border-radius-md);
  background-color: var(--privy-color-background-2);
  font-size: 0.8125rem;
  line-height: 1.25rem;
  color: var(--privy-color-foreground-3);
`;const A=d.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8125rem;
  line-height: 1.25rem;
`,D=d.span`
  color: var(--privy-color-foreground);
  font-weight: 400;
`,I=d.span`
  color: var(--privy-color-foreground);
  font-weight: 500;
  text-align: right;
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`,de=d(Y)`
  && {
    margin-left: auto;
    height: 1.5rem;
    width: 1.5rem;
    border-width: 2px;
    flex-shrink: 0;
  }
`,rr=({sourceAmount:e,sourceSymbol:r,sourceChainName:n,sourceDecimals:o,destinationAmount:i,destSymbol:l,destChainName:a,destDecimals:u,onClose:s})=>t.jsx(j,{icon:F,iconVariant:"success",title:"Transfer complete",subtitle:i?`Received ${W(e,o)} ${r} on ${n} and converted it to ${W(i,u)} ${l} on ${a}. Funds are available to use.`:`Your ${r} has been received and is now available in your wallet.`,showClose:!0,onClose:s,primaryCta:{label:"Done",onClick:s},watermark:!1});function tr(){let{state:e,configData:r,close:n}=w("complete"),{order:o}=e,{sourceSymbol:i,sourceChainName:l,sourceDecimals:a,destSymbol:u,destChainName:s,destDecimals:c}=m.useMemo((()=>{let p=R({address:o.source_currency,caip2:o.source_chain,config:r}),f=R({address:o.destination_currency,caip2:o.destination_chain,config:r});return{sourceSymbol:p.symbol,sourceChainName:V(o.source_chain,r.chains),sourceDecimals:p.decimals,destSymbol:f.symbol,destChainName:V(o.destination_chain,r.chains),destDecimals:f.decimals}}),[o,r]);return t.jsx(rr,{sourceAmount:o.source_amount,sourceSymbol:i,sourceChainName:l,sourceDecimals:a,destinationAmount:o.destination_amount,destSymbol:u,destChainName:s,destDecimals:c,onClose:n})}function or(){let{modalState:e,setModalState:r,config:n,retryConfig:o,close:i}=g();if(e.step!=="error")throw Error("UNEXPECTED_STATE");let{code:l}=e,{title:a,subtitle:u,detail:s,iconVariant:c}=(y=>{switch(y){case"AMOUNT_TOO_LOW":return{title:"Amount too low",subtitle:"The deposit amount is below the minimum for this route.",detail:"Try a larger amount or a different token.",iconVariant:"warning"};case"INSUFFICIENT_LIQUIDITY":return{title:"Insufficient liquidity",subtitle:"There isn't enough liquidity for this route right now.",detail:"Try a smaller amount or a different network.",iconVariant:"warning"};case"UNSUPPORTED_CHAIN":return{title:"Unsupported chain",subtitle:"Deposits from this chain type aren't supported yet. Try a different network.",iconVariant:"warning"};case"UNSUPPORTED_CURRENCY":case"UNSUPPORTED_ROUTE":case"ROUTE_UNAVAILABLE":case"NO_SWAP_ROUTES_FOUND":case"NO_INTERNAL_SWAP_ROUTES_FOUND":case"NO_QUOTES":return{title:"Route not available",subtitle:"This deposit route isn't supported right now. Try a different token or network.",iconVariant:"warning"};case"SANCTIONED_WALLET_ADDRESS":return{title:"Address restricted",subtitle:"This address cannot be used for deposits due to compliance restrictions.",iconVariant:"warning"};case"REFUND_WALLET_CREATION_FAILED":return{title:"Unable to set up refund address",subtitle:"We couldn't create a wallet to receive refunds on this chain. Please try again or select a different network.",iconVariant:"warning"};case"DEPOSIT_ADDRESSES_NOT_ENABLED":return{title:"Not enabled",subtitle:"Deposit addresses are not enabled for this app.",iconVariant:"warning"};case"NOT_AUTHENTICATED":return{title:"Not signed in",subtitle:"Please sign in to continue with your deposit.",iconVariant:"warning"};case"TIMEOUT_WAITING_FOR_NEXT_ORDER":case"TIMEOUT_ORDER_COMPLETION":return{title:"Taking longer than expected",subtitle:"Your funds are safe. The deposit is still being processed — check back later.",iconVariant:"subtle"};default:return{title:"Something went wrong",subtitle:"We couldn't complete your request. Please try again.",iconVariant:"subtle"}}})(l),[p,f]=m.useState(!1);return t.jsx(j,{icon:O,iconVariant:c,title:a,subtitle:s?`${u} ${s}`:u,showClose:!0,onClose:i,primaryCta:{label:"Try again",onClick:async()=>{if(n.status!=="ready"){f(!0);try{await o(),r({step:"token"})}catch{f(!1)}}else r({step:"token"})},loading:p},watermark:!0})}function nr(){let{state:e,close:r}=w("failed"),{order:n}=e;return t.jsx(C,{icon:O,iconVariant:"error",title:"Transfer failed",subtitle:"Something went wrong processing your transfer.",showClose:!0,onClose:r,primaryCta:{label:"Done",onClick:r},secondaryCta:{label:"Learn about manual recovery",onClick:()=>window.open("https://docs.privy.io","_blank","noopener,noreferrer")},watermark:!0,children:t.jsxs(sr,{href:n.tracking_url,target:"_blank",rel:"noopener noreferrer",children:["Reference: ",n.provider_request_id]})})}let sr=d.a`
  text-align: center;
  font-size: 0.75rem;
  opacity: 0.7;
  text-decoration: underline;
  cursor: pointer;
  color: var(--privy-color-foreground-3);
`;function ir(){let{close:e,setModalState:r,config:n,params:o}=g(),[i,l]=m.useState(!1);return m.useEffect((()=>{if(i&&o){if(n.status==="ready"){let a=B(n.data,o);r(a?{step:"error",code:"ROUTE_UNAVAILABLE",message:a}:{step:"token"})}n.status==="error"&&r({step:"error",code:"ROUTE_UNAVAILABLE"})}}),[i,n,o,r]),t.jsx(j,{icon:te,iconVariant:"subtle",title:"Add funds",subtitle:"Top up your account by sending crypto from any wallet. Conversion and routing handled by Relay.",showClose:!0,onClose:e,primaryCta:{label:"Continue",onClick:()=>{if(n.status==="ready"&&o){let a=B(n.data,o);r(a?{step:"error",code:"ROUTE_UNAVAILABLE",message:a}:{step:"token"})}else n.status==="error"?r({step:"error",code:"ROUTE_UNAVAILABLE"}):l(!0)},loading:i&&n.status==="loading",loadingText:null},watermark:!0})}function ar(){let{state:e,setModalState:r,close:n}=w("network"),[o,i]=m.useState(-1),{availableChains:l}=e,{confirm:a,isFetching:u}=(function(){let s=_(),{params:c}=g(),{fetchQuote:p,isFetching:f}=oe();return{confirm:m.useCallback((async y=>{if(!y||!c)return;let h=s?.modalState;h&&h.step==="network"&&await p(y,h.selectedCurrency,h.availableChains)}),[c,s,p]),isFetching:f}})();return t.jsx(C,{title:"Select network",eyebrow:t.jsxs("span",{style:{display:"flex",alignItems:"center",gap:"0.375rem"},children:[t.jsx("img",{src:e.selectedCurrency.logoURI,alt:"",style:{width:"1rem",height:"1rem",borderRadius:"50%"}}),"Send ",e.selectedCurrency.symbol]}),showBack:!0,onBack:()=>r({step:"token"}),showClose:!0,onClose:n,watermark:!0,children:t.jsx(Q,{style:{marginTop:"1rem",height:"22rem"},$colorScheme:"light",children:l.map(((s,c)=>t.jsxs(le,{$selected:o===c,disabled:u,onClick:()=>{i(c),a(s)},children:[t.jsx(ie,{src:s.iconUrl,alt:s.displayName}),t.jsx(ae,{children:s.displayName}),u&&c===o&&t.jsx(de,{})]},s.caip2)))})})}const lr=({trackingUrl:e,onClose:r})=>t.jsx(C,{icon:Re,iconVariant:"subtle",title:"Transfer in progress",subtitle:"Your deposit was received and the transfer is now processing.",showClose:!0,onClose:r,secondaryCta:{label:"View on block explorer ↗",onClick:()=>window.open(e,"_blank","noopener,noreferrer")},watermark:!1,children:t.jsxs(er,{children:[t.jsxs(S,{children:[t.jsx(N,{$status:"done",children:t.jsx(F,{size:14,color:"var(--privy-color-icon-success)",strokeWidth:2})}),t.jsx(U,{children:"Deposit received"})]}),t.jsx(X,{}),t.jsxs(S,{children:[t.jsx(N,{$status:"active",children:t.jsx(dr,{})}),t.jsx(U,{children:"Bridging"})]}),t.jsx(X,{}),t.jsxs(S,{children:[t.jsx(N,{$status:"pending"}),t.jsx(U,{children:"Funds arrived"})]})]})});let dr=d.span`
  width: 0.75rem;
  height: 0.75rem;
  border: 2px solid var(--privy-color-foreground-3);
  border-bottom-color: transparent;
  border-radius: 50%;
  display: inline-block;
  animation: spin 1s linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;function cr(){let{state:e,close:r}=w("processing");return(function({orderId:n,enabled:o}){let{privy:i}=E(),{setModalState:l}=g();m.useEffect((()=>{let a=new AbortController;return L.waitForCompletion({privy:i,orderId:n,signal:a.signal}).then((u=>{a.signal.aborted||(u.status==="success"?ne(u.order,l):u.status==="timeout"&&l({step:"error",code:"TIMEOUT_ORDER_COMPLETION"}))})),()=>{a.abort()}}),[o,n,i,l])})({orderId:e.order.id,enabled:!0}),t.jsx(lr,{trackingUrl:e.order.tracking_url,onClose:r})}function ur(){let{state:e,close:r}=w("refunded"),{order:n}=e;return t.jsx(j,{icon:Xe,iconVariant:"subtle",title:"Transfer refunded",subtitle:"Your transfer was received, but the swap couldn't be completed. A refund has been started automatically.",showClose:!0,onClose:r,primaryCta:{label:"Done",onClick:r},secondaryCta:{label:"View transaction details",onClick:()=>window.open(n.tracking_url,"_blank","noopener,noreferrer")},watermark:!0})}function pr(){let{close:e,setModalState:r,config:n}=g(),{confirm:o,currencies:i,isFetching:l}=(function(){let{config:s,setModalState:c}=g(),{fetchQuote:p,isFetching:f}=oe(),y=s.status==="ready"?s.data.currencies:[];return{confirm:m.useCallback((async h=>{if(s.status!=="ready"||!h)return;let b=(function(v,ce){return v.chains.map((x=>{let k=ce.chains[x.caip2];return k?{caip2:x.caip2,displayName:k.displayName,iconUrl:k.iconUrl,vmType:k.vmType,currencyAddress:x.address,currencyDecimals:x.decimals}:null})).filter((x=>x!==null))})(h,s.data);if(b.length!==1)c({step:"network",selectedCurrency:h,availableChains:b});else{let v=b[0];await p(v,h,b)}}),[s,p,c]),currencies:y,isFetching:f}})(),[a,u]=m.useState(-1);return t.jsx(C,{title:"Select token",showBack:!0,onBack:()=>r({step:"intro"}),showClose:!0,onClose:e,watermark:!0,children:n.status==="error"?t.jsx(H,{children:t.jsx(Je,{children:"Failed to load tokens"})}):n.status==="loading"?t.jsx(H,{children:t.jsx(Y,{})}):t.jsx(Q,{style:{marginTop:"1rem",height:"22rem"},$colorScheme:"light",children:i.map(((s,c)=>t.jsxs(le,{$selected:a===c,disabled:l,onClick:()=>{u(c),o(s)},children:[t.jsx(se,{src:s.logoURI,alt:s.symbol}),t.jsx(ae,{children:s.name}),l&&c===a?t.jsx(de,{}):t.jsx(Ze,{children:s.symbol})]},s.symbol)))})})}function mr({address:e,onClick:r}){let[n,o]=m.useState(!1);return t.jsx(t.Fragment,{children:n?t.jsx(fr,{onClick:()=>o(!1),style:{marginTop:"1.5rem"},children:t.jsx(ye,{url:e,size:312,hideLogo:!0})}):t.jsxs(hr,{title:"Click to copy address",onClick:r,style:{marginTop:"1.5rem"},children:[t.jsxs(gr,{children:[t.jsx(yr,{children:"Deposit address"}),t.jsx(br,{children:e})]}),t.jsx(vr,{children:t.jsx(xr,{type:"button",onClick:i=>{i.stopPropagation(),o(!0)},children:t.jsx(te,{size:16,color:"var(--privy-color-icon-muted)"})})})]})})}let fr=d.div`
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  overflow: hidden;
`,hr=d.div`
  display: flex;
  border-radius: var(--privy-border-radius-md);
  background: var(--privy-color-background-clicked, #f1f2f9);
  padding: 1rem;
  cursor: pointer;
  gap: 0.5rem;
`,gr=d.div`
  flex: 1;
  min-width: 0;
  text-align: left;
`,yr=d.div`
  font-size: 0.75rem;
  color: var(--privy-color-icon-muted);
  line-height: 1rem;
  margin-bottom: 0.25rem;
`,br=d.div`
  word-break: break-all;
  font-size: 0.875rem;
  font-family: ui-monospace, monospace;
  font-weight: 500;
  line-height: 1.375rem;
  color: var(--privy-color-foreground);
`,vr=d.div`
  width: 1.5rem;
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  padding-top: 0.25rem;
`,xr=d.button`
  && {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    border: none;
    background: transparent;
    cursor: pointer;
    outline: none;
    box-shadow: none;
    border-radius: var(--privy-border-radius-xs);

    &:hover {
      background: var(--privy-color-background);
    }

    &:focus,
    &:focus-visible {
      outline: none;
      box-shadow: none;
    }
  }
`;function Cr({quote:e,selectedCurrency:r,selectedChain:n,destinationSymbol:o}){let[i,l]=m.useState(!1),a=r.symbol.toUpperCase(),u=n.displayName,s=m.useRef(null);return t.jsxs(wr,{children:[t.jsxs(Er,{onClick:m.useCallback((()=>{let c=document.getElementById("privy-modal-content");c&&(s.current&&clearTimeout(s.current),c.style.transition="none",s.current=setTimeout((()=>{c.style.transition="",s.current=null}),160)),l((p=>!p))}),[]),children:[t.jsxs(_r,{children:[r.logoURI&&t.jsx(se,{src:r.logoURI,alt:a,style:{width:"2rem",height:"2rem"}}),n.iconUrl&&t.jsx(kr,{src:n.iconUrl,alt:u})]}),t.jsxs(Tr,{children:[t.jsx(jr,{children:"You send"}),t.jsxs(Sr,{children:[a," on ",u]})]}),t.jsx(Nr,{children:t.jsx(i?Be:Ie,{size:16})})]}),t.jsx(Ir,{$expanded:i,children:t.jsx(Rr,{children:t.jsxs(Ur,{children:[e.indicative_rate&&t.jsxs(A,{children:[t.jsx(D,{children:"Conversion rate"}),t.jsxs(I,{style:{display:"flex",alignItems:"center",gap:"0.25rem"},children:[Qe(e.indicative_rate,a,o.toUpperCase()),t.jsx(Or,{content:"Estimated rate based on current market conditions. Final execution price may vary depending on transfer size and routing."})]})]}),t.jsxs(A,{children:[t.jsx(D,{children:"Max slippage"}),t.jsxs(I,{children:[(e.slippage_bps/100).toFixed(1),"%"]})]}),t.jsxs(A,{children:[t.jsx(D,{children:"Refund address"}),t.jsx(I,{children:t.jsx(De,{value:e.refund_address,iconOnly:!0,iconSize:11,children:he(e.refund_address,4,4)})})]})]})})}),t.jsxs(Ar,{children:[t.jsx(O,{size:16,color:"var(--privy-color-icon-muted)",style:{flexShrink:0}}),t.jsxs(Dr,{children:["Only send ",t.jsx("strong",{children:a})," on ",t.jsx("strong",{children:u}),". Other assets may be lost."]})]})]})}let wr=d.div`
  border-radius: var(--privy-border-radius-md);
  border: 1px solid var(--privy-color-foreground-4);
  overflow: hidden;
`,Er=d.button`
  && {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--privy-color-foreground);
    outline: none;
    box-shadow: none;

    &:focus,
    &:focus-visible {
      outline: none;
      box-shadow: none;
    }
  }
`,_r=d.span`
  position: relative;
  width: 2rem;
  height: 2rem;
  flex-shrink: 0;
`,kr=d(ie)`
  && {
    position: absolute;
    top: -0.125rem;
    right: -0.25rem;
    width: 0.75rem;
    height: 0.75rem;
    box-sizing: content-box;
    border: 1.5px solid #fff;
    background-color: #fff;
  }
`,Tr=d.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
`,jr=d.span`
  font-size: 0.75rem;
  color: var(--privy-color-foreground-3);
  line-height: 1rem;
`,Sr=d.span`
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.25rem;
`,Nr=d.span`
  margin-left: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: var(--privy-border-radius-full);
  background-color: var(--privy-color-background-clicked, #f1f2f9);
  color: var(--privy-color-foreground-3);
`,Ur=d.div`
  display: flex;
  flex-direction: column;
  padding: 0 1rem 0.75rem;

  & > * {
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--privy-color-foreground-4);
  }

  & > *:last-child {
    border-bottom: none;
  }
`,Ar=d.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0.75rem 0.75rem;
  padding: 0.625rem 0.75rem;
  border-radius: var(--privy-border-radius-sm);
  background: #f8f9fc;
`,Dr=d.span`
  font-size: 0.8125rem;
  line-height: 1.25rem;
  color: var(--privy-color-icon-muted);
  text-align: left;
`,Ir=d.div`
  display: grid;
  grid-template-rows: ${({$expanded:e})=>e?"1fr":"0fr"};
  transition: grid-template-rows 150ms ease-out;
`,Rr=d.div`
  overflow: hidden;
`;function Or({content:e}){let[r,n]=m.useState(!1),{refs:o,floatingStyles:i,context:l}=be({open:r,onOpenChange:n,placement:"top",whileElementsMounted:Se,middleware:[Ne(6),Ue(),Ae({padding:8})]}),a=ve(l,{move:!1,handleClose:xe()}),u=Ce(l),{getReferenceProps:s,getFloatingProps:c}=we([a,u,Ee(l),_e(l),ke(l,{role:"tooltip"})]),{isMounted:p,styles:f}=Te(l,{duration:150});return t.jsxs(t.Fragment,{children:[t.jsx("button",{ref:o.setReference,type:"button","aria-label":"More information about conversion rate",style:{display:"inline-flex",alignItems:"center",justifyContent:"center",padding:0,border:"none",background:"none",color:"var(--privy-color-icon-muted)",cursor:"pointer"},...s(),children:t.jsx(Oe,{size:14})}),p&&t.jsx(je,{root:document.getElementById("privy-modal-content")??void 0,children:t.jsx($r,{ref:o.setFloating,style:{...i,...f},...c(),children:e})})]})}let $r=d.div`
  max-width: 13rem;
  padding: 0.5rem 0.625rem;
  border-radius: var(--privy-border-radius-sm, 0.375rem);
  background: var(--privy-color-foreground);
  color: var(--privy-color-background);
  font-size: 0.6875rem;
  line-height: 1rem;
  font-weight: 400;
  text-align: left;
  z-index: 10;
`;const Fr=({quote:e,selectedCurrency:r,selectedChain:n,destinationSymbol:o,onBack:i,onClose:l})=>{let[a,u]=m.useState(!1),s=r?.symbol?.toUpperCase()??"funds",c=n?.displayName??"",p=async()=>{a||(await navigator.clipboard.writeText(e.deposit_address),u(!0),setTimeout((()=>u(!1)),2e3))};return t.jsxs(C,{title:`Send ${s}${c?` on ${c}`:""}`,subtitle:"Send funds to the address below. Conversion and routing handled by Relay.",showBack:!0,onBack:i,showClose:!0,onClose:l,watermark:!1,children:[t.jsx(Cr,{quote:e,selectedCurrency:r,selectedChain:n,destinationSymbol:o}),t.jsx(mr,{address:e.deposit_address,onClick:p}),t.jsx(ge,{style:{marginTop:"1rem",marginBottom:"0.5rem",...a?{backgroundColor:"var(--privy-color-icon-success)",borderColor:"var(--privy-color-icon-success)"}:{}},onClick:p,children:a?t.jsxs(t.Fragment,{children:["Copied ",t.jsx(F,{size:16,style:{marginLeft:"0.25rem"}})]}):"Copy address"}),t.jsx(Pr,{children:"Routing and bridging are handled by Relay. Privy does not control execution timing, liquidity, or transaction outcomes."})]})};let Pr=d.p`
  && {
    margin: 0.5rem 0 0;
    font-size: 0.6875rem;
    line-height: 1.125rem;
    color: var(--privy-color-icon-muted);
    text-align: center;
  }
`;function Lr(){let{state:e,configData:r,setModalState:n,close:o,params:i}=w("address"),{quote:l,selectedCurrency:a,selectedChain:u,availableChains:s}=e;return(function({depositAddressId:c,enabled:p,quoteCreatedAt:f}){let{privy:y}=E(),{setModalState:h}=g();m.useEffect((()=>{if(!c)return;let b=new AbortController;return L.waitForDeposit({privy:y,depositAddressId:c,quoteCreatedAt:f,signal:b.signal}).then((v=>{b.signal.aborted||(v.status==="success"?ne(v.order,h):v.status==="timeout"&&h({step:"error",code:"TIMEOUT_WAITING_FOR_NEXT_ORDER"}))})),()=>{b.abort()}}),[p,c,y,f,h])})({depositAddressId:l.id,enabled:!0,quoteCreatedAt:l.created_at}),t.jsx(Fr,{quote:l,selectedCurrency:a,selectedChain:u,destinationSymbol:m.useMemo((()=>R({address:i.destinationCurrency,caip2:i.destinationChain,config:r}).symbol),[i,r]),onBack:()=>n({step:"network",selectedCurrency:a,availableChains:s}),onClose:o})}function Mr(){let{modalState:e,setModalState:r}=g();return t.jsx(Ye,{onError:n=>r({step:"error",code:"UNEXPECTED_STATE",message:n.message}),resetKey:e.step,children:t.jsx(zr,{})})}function zr(){let{modalState:e}=g();switch(e.step){case"intro":return t.jsx(ir,{});case"token":return t.jsx(pr,{});case"network":return t.jsx(ar,{});case"address":return t.jsx(Lr,{});case"processing":return t.jsx(cr,{});case"complete":return t.jsx(tr,{});case"refunded":return t.jsx(ur,{});case"failed":return t.jsx(nr,{});case"error":return t.jsx(or,{});default:return null}}var st={component:()=>{let{onUserCloseViaDialogOrKeybindRef:e}=me(),r=_(),{close:n,config:o}=g();return m.useEffect((()=>{e.current=n}),[e,n]),m.useEffect((()=>{if(o.status==="ready"){for(let i of o.data.currencies)new Image().src=i.logoURI;for(let i of Object.values(o.data.chains))new Image().src=i.iconUrl}}),[o]),r?t.jsx(Mr,{}):null}};export{st as default};
