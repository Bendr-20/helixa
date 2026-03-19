import{j as t}from"./vendor-wallet-Ce1ahb_s.js";import{Q as m}from"./browser-BpmhFnCl.js";import{R as d}from"./vendor-react-QucNsdf5.js";import{r as p,d as u,aJ as f,aK as C}from"./index-UxvseK1o.js";const $=()=>t.jsx("svg",{width:"200",height:"200",viewBox:"-77 -77 200 200",fill:"none",xmlns:"http://www.w3.org/2000/svg",style:{height:"28px",width:"28px"},children:t.jsx("rect",{width:"50",height:"50",fill:"black",rx:10,ry:10})});let c=(e,r,o,l,s)=>{for(let i=r;i<r+l;i++)for(let a=o;a<o+s;a++){let g=e?.[a];g&&g[i]&&(g[i]=0)}return e},z=(e,r)=>{let o=m.create(e,{errorCorrectionLevel:r}).modules,l=f(Array.from(o.data),o.size);return l=c(l,0,0,7,7),l=c(l,l.length-7,0,7,7),c(l,0,l.length-7,7,7)},j=({x:e,y:r,cellSize:o,bgColor:l,fgColor:s})=>t.jsx(t.Fragment,{children:[0,1,2].map((i=>t.jsx("circle",{r:o*(7-2*i)/2,cx:e+7*o/2,cy:r+7*o/2,fill:i%2!=0?l:s},`finder-${e}-${r}-${i}`)))}),b=({cellSize:e,matrixSize:r,bgColor:o,fgColor:l})=>t.jsx(t.Fragment,{children:[[0,0],[(r-7)*e,0],[0,(r-7)*e]].map((([s,i])=>t.jsx(j,{x:s,y:i,cellSize:e,bgColor:o,fgColor:l},`finder-${s}-${i}`)))}),S=({matrix:e,cellSize:r,color:o})=>t.jsx(t.Fragment,{children:e.map(((l,s)=>l.map(((i,a)=>i?t.jsx("rect",{height:r-.4,width:r-.4,x:s*r+.1*r,y:a*r+.1*r,rx:.5*r,ry:.5*r,fill:o},`cell-${s}-${a}`):t.jsx(d.Fragment,{},`circle-${s}-${a}`)))))}),w=({cellSize:e,matrixSize:r,element:o,sizePercentage:l,bgColor:s})=>{if(!o)return t.jsx(t.Fragment,{});let i=r*(l||.14),a=Math.floor(r/2-i/2),g=Math.floor(r/2+i/2);(g-a)%2!=r%2&&(g+=1);let n=(g-a)*e,x=n-.2*n,h=a*e;return t.jsxs(t.Fragment,{children:[t.jsx("rect",{x:a*e,y:a*e,width:n,height:n,fill:s}),t.jsx(o,{x:h+.1*n,y:h+.1*n,height:x,width:x})]})},y=e=>{let r=e.outputSize,o=z(e.url,e.errorCorrectionLevel),l=r/o.length,s=C(2*l,{min:.025*r,max:.036*r});return t.jsxs("svg",{height:e.outputSize,width:e.outputSize,viewBox:`0 0 ${e.outputSize} ${e.outputSize}`,style:{height:"100%",width:"100%",padding:`${s}px`},children:[t.jsx(S,{matrix:o,cellSize:l,color:e.fgColor}),t.jsx(b,{cellSize:l,matrixSize:o.length,fgColor:e.fgColor,bgColor:e.bgColor}),t.jsx(w,{cellSize:l,element:e.logo?.element,bgColor:e.bgColor,matrixSize:o.length})]})},v=u.div.attrs({className:"ph-no-capture"})`
  display: flex;
  justify-content: center;
  align-items: center;
  height: ${e=>`${e.$size}px`};
  width: ${e=>`${e.$size}px`};
  margin: auto;
  background-color: ${e=>e.$bgColor};

  && {
    border-width: 2px;
    border-color: ${e=>e.$borderColor};
    border-radius: var(--privy-border-radius-md);
  }
`;const Q=e=>{let{appearance:r}=p(),o=e.bgColor||"#FFFFFF",l=e.fgColor||"#000000",s=e.size||160,i=r.palette.colorScheme==="dark"?o:l;return t.jsx(v,{$size:s,$bgColor:o,$fgColor:l,$borderColor:i,children:t.jsx(y,{url:e.url,logo:{element:e.squareLogoElement??$},outputSize:s,bgColor:o,fgColor:l,errorCorrectionLevel:e.errorCorrectionLevel||"Q"})})};export{Q as C};
