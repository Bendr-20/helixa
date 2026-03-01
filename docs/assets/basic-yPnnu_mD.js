import{i as $,C as P,A as g,O as S,a as m,b as w,c as Re,d as l,E as T,R as f,e as _,f as Qe,g as re,h as ie,H as wt,r as j,j as Y,T as Ue,S as ve,M as nt,k as ot,l as rt,m as st,w as ye,n as te,o as bt,p as gt,q as Xe,s as at,W as Me}from"./core-j84dZt_g.js";import{n as c,r as d,c as y,o as x,U as K,i as yt,t as $t,e as vt}from"./index-g890eMhj.js";import{Q as xt}from"./browser-CxT9TM-V.js";import"./vendor-wallet-iWeBopzN.js";import"./vendor-react-NLnOsXgy.js";import"./index-Oq0V5QVk.js";var be=function(e,t,i,o){var r=arguments.length,n=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,i):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(n=(r<3?s(n):r>3?s(t,i,n):s(t,i))||n);return r>3&&n&&Object.defineProperty(t,i,n),n};let se=class extends ${constructor(){super(),this.unsubscribe=[],this.tabIdx=void 0,this.connectors=P.state.connectors,this.count=g.state.count,this.filteredCount=g.state.filteredWallets.length,this.isFetchingRecommendedWallets=g.state.isFetchingRecommendedWallets,this.unsubscribe.push(P.subscribeKey("connectors",t=>this.connectors=t),g.subscribeKey("count",t=>this.count=t),g.subscribeKey("filteredWallets",t=>this.filteredCount=t.length),g.subscribeKey("isFetchingRecommendedWallets",t=>this.isFetchingRecommendedWallets=t))}disconnectedCallback(){this.unsubscribe.forEach(t=>t())}render(){const t=this.connectors.find(b=>b.id==="walletConnect"),{allWallets:i}=S.state;if(!t||i==="HIDE"||i==="ONLY_MOBILE"&&!m.isMobile())return null;const o=g.state.featured.length,r=this.count+o,n=r<10?r:Math.floor(r/10)*10,s=this.filteredCount>0?this.filteredCount:n;let a=`${s}`;this.filteredCount>0?a=`${this.filteredCount}`:s<r&&(a=`${s}+`);const h=w.hasAnyConnection(Re.CONNECTOR_ID.WALLET_CONNECT);return l`
      <wui-list-wallet
        name="Search Wallet"
        walletIcon="search"
        showAllWallets
        @click=${this.onAllWallets.bind(this)}
        tagLabel=${a}
        tagVariant="info"
        data-testid="all-wallets"
        tabIdx=${x(this.tabIdx)}
        .loading=${this.isFetchingRecommendedWallets}
        ?disabled=${h}
        size="sm"
      ></wui-list-wallet>
    `}onAllWallets(){T.sendEvent({type:"track",event:"CLICK_ALL_WALLETS"}),f.push("AllWallets",{redirectView:f.state.data?.redirectView})}};be([c()],se.prototype,"tabIdx",void 0);be([d()],se.prototype,"connectors",void 0);be([d()],se.prototype,"count",void 0);be([d()],se.prototype,"filteredCount",void 0);be([d()],se.prototype,"isFetchingRecommendedWallets",void 0);se=be([y("w3m-all-wallets-widget")],se);const Ct=_`
  :host {
    margin-top: ${({spacing:e})=>e[1]};
  }
  wui-separator {
    margin: ${({spacing:e})=>e[3]} calc(${({spacing:e})=>e[3]} * -1)
      ${({spacing:e})=>e[2]} calc(${({spacing:e})=>e[3]} * -1);
    width: calc(100% + ${({spacing:e})=>e[3]} * 2);
  }
`;var Z=function(e,t,i,o){var r=arguments.length,n=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,i):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(n=(r<3?s(n):r>3?s(t,i,n):s(t,i))||n);return r>3&&n&&Object.defineProperty(t,i,n),n};let N=class extends ${constructor(){super(),this.unsubscribe=[],this.connectors=P.state.connectors,this.recommended=g.state.recommended,this.featured=g.state.featured,this.explorerWallets=g.state.explorerWallets,this.connections=w.state.connections,this.connectorImages=Qe.state.connectorImages,this.loadingTelegram=!1,this.unsubscribe.push(P.subscribeKey("connectors",t=>this.connectors=t),w.subscribeKey("connections",t=>this.connections=t),Qe.subscribeKey("connectorImages",t=>this.connectorImages=t),g.subscribeKey("recommended",t=>this.recommended=t),g.subscribeKey("featured",t=>this.featured=t),g.subscribeKey("explorerFilteredWallets",t=>{this.explorerWallets=t?.length?t:g.state.explorerWallets}),g.subscribeKey("explorerWallets",t=>{this.explorerWallets?.length||(this.explorerWallets=t)})),m.isTelegram()&&m.isIos()&&(this.loadingTelegram=!w.state.wcUri,this.unsubscribe.push(w.subscribeKey("wcUri",t=>this.loadingTelegram=!t)))}disconnectedCallback(){this.unsubscribe.forEach(t=>t())}render(){return l`
      <wui-flex flexDirection="column" gap="2"> ${this.connectorListTemplate()} </wui-flex>
    `}mapConnectorsToExplorerWallets(t,i){return t.map(o=>{if(o.type==="MULTI_CHAIN"&&o.connectors){const n=o.connectors.map(b=>b.id),s=o.connectors.map(b=>b.name),a=o.connectors.map(b=>b.info?.rdns),h=i?.find(b=>n.includes(b.id)||s.includes(b.name)||b.rdns&&(a.includes(b.rdns)||n.includes(b.rdns)));return o.explorerWallet=h??o.explorerWallet,o}const r=i?.find(n=>n.id===o.id||n.rdns===o.info?.rdns||n.name===o.name);return o.explorerWallet=r??o.explorerWallet,o})}processConnectorsByType(t,i=!0){const o=re.sortConnectorsByExplorerWallet([...t]);return i?o.filter(re.showConnector):o}connectorListTemplate(){const t=this.mapConnectorsToExplorerWallets(this.connectors,this.explorerWallets??[]),i=re.getConnectorsByType(t,this.recommended,this.featured),o=this.processConnectorsByType(i.announced.filter(p=>p.id!=="walletConnect")),r=this.processConnectorsByType(i.injected),n=this.processConnectorsByType(i.multiChain.filter(p=>p.name!=="WalletConnect"),!1),s=i.custom,a=i.recent,h=this.processConnectorsByType(i.external.filter(p=>p.id!==Re.CONNECTOR_ID.COINBASE_SDK)),b=i.recommended,I=i.featured,J=re.getConnectorTypeOrder({custom:s,recent:a,announced:o,injected:r,multiChain:n,recommended:b,featured:I,external:h}),ee=this.connectors.find(p=>p.id==="walletConnect"),fe=m.isMobile(),R=[];for(const p of J)switch(p){case"walletConnect":{!fe&&ee&&R.push({kind:"connector",subtype:"walletConnect",connector:ee});break}case"recent":{re.getFilteredRecentWallets().forEach(C=>R.push({kind:"wallet",subtype:"recent",wallet:C}));break}case"injected":{n.forEach(u=>R.push({kind:"connector",subtype:"multiChain",connector:u})),o.forEach(u=>R.push({kind:"connector",subtype:"announced",connector:u})),r.forEach(u=>R.push({kind:"connector",subtype:"injected",connector:u}));break}case"featured":{I.forEach(u=>R.push({kind:"wallet",subtype:"featured",wallet:u}));break}case"custom":{re.getFilteredCustomWallets(s??[]).forEach(C=>R.push({kind:"wallet",subtype:"custom",wallet:C}));break}case"external":{h.forEach(u=>R.push({kind:"connector",subtype:"external",connector:u}));break}case"recommended":{re.getCappedRecommendedWallets(b).forEach(C=>R.push({kind:"wallet",subtype:"recommended",wallet:C}));break}default:console.warn(`Unknown connector type: ${p}`)}return R.map((p,u)=>p.kind==="connector"?this.renderConnector(p,u):this.renderWallet(p,u))}renderConnector(t,i){const o=t.connector,r=ie.getConnectorImage(o)||this.connectorImages[o?.imageId??""],s=(this.connections.get(o.chain)??[]).some(J=>wt.isLowerCaseMatch(J.connectorId,o.id));let a,h;t.subtype==="multiChain"?(a="multichain",h="info"):t.subtype==="walletConnect"?(a="qr code",h="accent"):t.subtype==="injected"||t.subtype==="announced"?(a=s?"connected":"installed",h=s?"info":"success"):(a=void 0,h=void 0);const b=w.hasAnyConnection(Re.CONNECTOR_ID.WALLET_CONNECT),I=t.subtype==="walletConnect"||t.subtype==="external"?b:!1;return l`
      <w3m-list-wallet
        displayIndex=${i}
        imageSrc=${x(r)}
        .installed=${!0}
        name=${o.name??"Unknown"}
        .tagVariant=${h}
        tagLabel=${x(a)}
        data-testid=${`wallet-selector-${o.id.toLowerCase()}`}
        size="sm"
        @click=${()=>this.onClickConnector(t)}
        tabIdx=${x(this.tabIdx)}
        ?disabled=${I}
        rdnsId=${x(o.explorerWallet?.rdns||void 0)}
        walletRank=${x(o.explorerWallet?.order)}
      >
      </w3m-list-wallet>
    `}onClickConnector(t){const i=f.state.data?.redirectView;if(t.subtype==="walletConnect"){P.setActiveConnector(t.connector),m.isMobile()?f.push("AllWallets"):f.push("ConnectingWalletConnect",{redirectView:i});return}if(t.subtype==="multiChain"){P.setActiveConnector(t.connector),f.push("ConnectingMultiChain",{redirectView:i});return}if(t.subtype==="injected"){P.setActiveConnector(t.connector),f.push("ConnectingExternal",{connector:t.connector,redirectView:i,wallet:t.connector.explorerWallet});return}if(t.subtype==="announced"){if(t.connector.id==="walletConnect"){m.isMobile()?f.push("AllWallets"):f.push("ConnectingWalletConnect",{redirectView:i});return}f.push("ConnectingExternal",{connector:t.connector,redirectView:i,wallet:t.connector.explorerWallet});return}f.push("ConnectingExternal",{connector:t.connector,redirectView:i})}renderWallet(t,i){const o=t.wallet,r=ie.getWalletImage(o),s=w.hasAnyConnection(Re.CONNECTOR_ID.WALLET_CONNECT),a=this.loadingTelegram,h=t.subtype==="recent"?"recent":void 0,b=t.subtype==="recent"?"info":void 0;return l`
      <w3m-list-wallet
        displayIndex=${i}
        imageSrc=${x(r)}
        name=${o.name??"Unknown"}
        @click=${()=>this.onClickWallet(t)}
        size="sm"
        data-testid=${`wallet-selector-${o.id}`}
        tabIdx=${x(this.tabIdx)}
        ?loading=${a}
        ?disabled=${s}
        rdnsId=${x(o.rdns||void 0)}
        walletRank=${x(o.order)}
        tagLabel=${x(h)}
        .tagVariant=${b}
      >
      </w3m-list-wallet>
    `}onClickWallet(t){const i=f.state.data?.redirectView;if(t.subtype==="featured"){P.selectWalletConnector(t.wallet);return}if(t.subtype==="recent"){if(this.loadingTelegram)return;P.selectWalletConnector(t.wallet);return}if(t.subtype==="custom"){if(this.loadingTelegram)return;f.push("ConnectingWalletConnect",{wallet:t.wallet,redirectView:i});return}if(this.loadingTelegram)return;const o=P.getConnector({id:t.wallet.id,rdns:t.wallet.rdns});o?f.push("ConnectingExternal",{connector:o,redirectView:i}):f.push("ConnectingWalletConnect",{wallet:t.wallet,redirectView:i})}};N.styles=Ct;Z([c({type:Number})],N.prototype,"tabIdx",void 0);Z([d()],N.prototype,"connectors",void 0);Z([d()],N.prototype,"recommended",void 0);Z([d()],N.prototype,"featured",void 0);Z([d()],N.prototype,"explorerWallets",void 0);Z([d()],N.prototype,"connections",void 0);Z([d()],N.prototype,"connectorImages",void 0);Z([d()],N.prototype,"loadingTelegram",void 0);N=Z([y("w3m-connector-list")],N);const _t=_`
  :host {
    flex: 1;
    height: 100%;
  }

  button {
    width: 100%;
    height: 100%;
    display: inline-flex;
    align-items: center;
    padding: ${({spacing:e})=>e[1]} ${({spacing:e})=>e[2]};
    column-gap: ${({spacing:e})=>e[1]};
    color: ${({tokens:e})=>e.theme.textSecondary};
    border-radius: ${({borderRadius:e})=>e[20]};
    background-color: transparent;
    transition: background-color ${({durations:e})=>e.lg}
      ${({easings:e})=>e["ease-out-power-2"]};
    will-change: background-color;
  }

  /* -- Hover & Active states ----------------------------------------------------------- */
  button[data-active='true'] {
    color: ${({tokens:e})=>e.theme.textPrimary};
    background-color: ${({tokens:e})=>e.theme.foregroundTertiary};
  }

  button:hover:enabled:not([data-active='true']),
  button:active:enabled:not([data-active='true']) {
    wui-text,
    wui-icon {
      color: ${({tokens:e})=>e.theme.textPrimary};
    }
  }
`;var xe=function(e,t,i,o){var r=arguments.length,n=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,i):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(n=(r<3?s(n):r>3?s(t,i,n):s(t,i))||n);return r>3&&n&&Object.defineProperty(t,i,n),n};const Wt={lg:"lg-regular",md:"md-regular",sm:"sm-regular"},Rt={lg:"md",md:"sm",sm:"sm"};let ae=class extends ${constructor(){super(...arguments),this.icon="mobile",this.size="md",this.label="",this.active=!1}render(){return l`
      <button data-active=${this.active}>
        ${this.icon?l`<wui-icon size=${Rt[this.size]} name=${this.icon}></wui-icon>`:""}
        <wui-text variant=${Wt[this.size]}> ${this.label} </wui-text>
      </button>
    `}};ae.styles=[j,Y,_t];xe([c()],ae.prototype,"icon",void 0);xe([c()],ae.prototype,"size",void 0);xe([c()],ae.prototype,"label",void 0);xe([c({type:Boolean})],ae.prototype,"active",void 0);ae=xe([y("wui-tab-item")],ae);const kt=_`
  :host {
    display: inline-flex;
    align-items: center;
    background-color: ${({tokens:e})=>e.theme.foregroundSecondary};
    border-radius: ${({borderRadius:e})=>e[32]};
    padding: ${({spacing:e})=>e["01"]};
    box-sizing: border-box;
  }

  :host([data-size='sm']) {
    height: 26px;
  }

  :host([data-size='md']) {
    height: 36px;
  }
`;var Ce=function(e,t,i,o){var r=arguments.length,n=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,i):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(n=(r<3?s(n):r>3?s(t,i,n):s(t,i))||n);return r>3&&n&&Object.defineProperty(t,i,n),n};let le=class extends ${constructor(){super(...arguments),this.tabs=[],this.onTabChange=()=>null,this.size="md",this.activeTab=0}render(){return this.dataset.size=this.size,this.tabs.map((t,i)=>{const o=i===this.activeTab;return l`
        <wui-tab-item
          @click=${()=>this.onTabClick(i)}
          icon=${t.icon}
          size=${this.size}
          label=${t.label}
          ?active=${o}
          data-active=${o}
          data-testid="tab-${t.label?.toLowerCase()}"
        ></wui-tab-item>
      `})}onTabClick(t){this.activeTab=t,this.onTabChange(t)}};le.styles=[j,Y,kt];Ce([c({type:Array})],le.prototype,"tabs",void 0);Ce([c()],le.prototype,"onTabChange",void 0);Ce([c()],le.prototype,"size",void 0);Ce([d()],le.prototype,"activeTab",void 0);le=Ce([y("wui-tabs")],le);var Ve=function(e,t,i,o){var r=arguments.length,n=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,i):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(n=(r<3?s(n):r>3?s(t,i,n):s(t,i))||n);return r>3&&n&&Object.defineProperty(t,i,n),n};let ke=class extends ${constructor(){super(...arguments),this.platformTabs=[],this.unsubscribe=[],this.platforms=[],this.onSelectPlatfrom=void 0}disconnectCallback(){this.unsubscribe.forEach(t=>t())}render(){const t=this.generateTabs();return l`
      <wui-flex justifyContent="center" .padding=${["0","0","4","0"]}>
        <wui-tabs .tabs=${t} .onTabChange=${this.onTabChange.bind(this)}></wui-tabs>
      </wui-flex>
    `}generateTabs(){const t=this.platforms.map(i=>i==="browser"?{label:"Browser",icon:"extension",platform:"browser"}:i==="mobile"?{label:"Mobile",icon:"mobile",platform:"mobile"}:i==="qrcode"?{label:"Mobile",icon:"mobile",platform:"qrcode"}:i==="web"?{label:"Webapp",icon:"browser",platform:"web"}:i==="desktop"?{label:"Desktop",icon:"desktop",platform:"desktop"}:{label:"Browser",icon:"extension",platform:"unsupported"});return this.platformTabs=t.map(({platform:i})=>i),t}onTabChange(t){const i=this.platformTabs[t];i&&this.onSelectPlatfrom?.(i)}};Ve([c({type:Array})],ke.prototype,"platforms",void 0);Ve([c()],ke.prototype,"onSelectPlatfrom",void 0);ke=Ve([y("w3m-connecting-header")],ke);const Et=_`
  :host {
    width: var(--local-width);
  }

  button {
    width: var(--local-width);
    white-space: nowrap;
    column-gap: ${({spacing:e})=>e[2]};
    transition:
      scale ${({durations:e})=>e.lg} ${({easings:e})=>e["ease-out-power-1"]},
      background-color ${({durations:e})=>e.lg}
        ${({easings:e})=>e["ease-out-power-2"]},
      border-radius ${({durations:e})=>e.lg}
        ${({easings:e})=>e["ease-out-power-1"]};
    will-change: scale, background-color, border-radius;
    cursor: pointer;
  }

  /* -- Sizes --------------------------------------------------- */
  button[data-size='sm'] {
    border-radius: ${({borderRadius:e})=>e[2]};
    padding: 0 ${({spacing:e})=>e[2]};
    height: 28px;
  }

  button[data-size='md'] {
    border-radius: ${({borderRadius:e})=>e[3]};
    padding: 0 ${({spacing:e})=>e[4]};
    height: 38px;
  }

  button[data-size='lg'] {
    border-radius: ${({borderRadius:e})=>e[4]};
    padding: 0 ${({spacing:e})=>e[5]};
    height: 48px;
  }

  /* -- Variants --------------------------------------------------------- */
  button[data-variant='accent-primary'] {
    background-color: ${({tokens:e})=>e.core.backgroundAccentPrimary};
    color: ${({tokens:e})=>e.theme.textInvert};
  }

  button[data-variant='accent-secondary'] {
    background-color: ${({tokens:e})=>e.core.foregroundAccent010};
    color: ${({tokens:e})=>e.core.textAccentPrimary};
  }

  button[data-variant='neutral-primary'] {
    background-color: ${({tokens:e})=>e.theme.backgroundInvert};
    color: ${({tokens:e})=>e.theme.textInvert};
  }

  button[data-variant='neutral-secondary'] {
    background-color: transparent;
    border: 1px solid ${({tokens:e})=>e.theme.borderSecondary};
    color: ${({tokens:e})=>e.theme.textPrimary};
  }

  button[data-variant='neutral-tertiary'] {
    background-color: ${({tokens:e})=>e.theme.foregroundPrimary};
    color: ${({tokens:e})=>e.theme.textPrimary};
  }

  button[data-variant='error-primary'] {
    background-color: ${({tokens:e})=>e.core.textError};
    color: ${({tokens:e})=>e.theme.textInvert};
  }

  button[data-variant='error-secondary'] {
    background-color: ${({tokens:e})=>e.core.backgroundError};
    color: ${({tokens:e})=>e.core.textError};
  }

  button[data-variant='shade'] {
    background: var(--wui-color-gray-glass-002);
    color: var(--wui-color-fg-200);
    border: none;
    box-shadow: inset 0 0 0 1px var(--wui-color-gray-glass-005);
  }

  /* -- Focus states --------------------------------------------------- */
  button[data-size='sm']:focus-visible:enabled {
    border-radius: 28px;
  }

  button[data-size='md']:focus-visible:enabled {
    border-radius: 38px;
  }

  button[data-size='lg']:focus-visible:enabled {
    border-radius: 48px;
  }
  button[data-variant='shade']:focus-visible:enabled {
    background: var(--wui-color-gray-glass-005);
    box-shadow:
      inset 0 0 0 1px var(--wui-color-gray-glass-010),
      0 0 0 4px var(--wui-color-gray-glass-002);
  }

  /* -- Hover & Active states ----------------------------------------------------------- */
  @media (hover: hover) {
    button[data-size='sm']:hover:enabled {
      border-radius: 28px;
    }

    button[data-size='md']:hover:enabled {
      border-radius: 38px;
    }

    button[data-size='lg']:hover:enabled {
      border-radius: 48px;
    }

    button[data-variant='shade']:hover:enabled {
      background: var(--wui-color-gray-glass-002);
    }

    button[data-variant='shade']:active:enabled {
      background: var(--wui-color-gray-glass-005);
    }
  }

  button[data-size='sm']:active:enabled {
    border-radius: 28px;
  }

  button[data-size='md']:active:enabled {
    border-radius: 38px;
  }

  button[data-size='lg']:active:enabled {
    border-radius: 48px;
  }

  /* -- Disabled states --------------------------------------------------- */
  button:disabled {
    opacity: 0.3;
  }
`;var he=function(e,t,i,o){var r=arguments.length,n=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,i):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(n=(r<3?s(n):r>3?s(t,i,n):s(t,i))||n);return r>3&&n&&Object.defineProperty(t,i,n),n};const St={lg:"lg-regular-mono",md:"md-regular-mono",sm:"sm-regular-mono"},Tt={lg:"md",md:"md",sm:"sm"};let Q=class extends ${constructor(){super(...arguments),this.size="lg",this.disabled=!1,this.fullWidth=!1,this.loading=!1,this.variant="accent-primary"}render(){this.style.cssText=`
    --local-width: ${this.fullWidth?"100%":"auto"};
     `;const t=this.textVariant??St[this.size];return l`
      <button data-variant=${this.variant} data-size=${this.size} ?disabled=${this.disabled}>
        ${this.loadingTemplate()}
        <slot name="iconLeft"></slot>
        <wui-text variant=${t} color="inherit">
          <slot></slot>
        </wui-text>
        <slot name="iconRight"></slot>
      </button>
    `}loadingTemplate(){if(this.loading){const t=Tt[this.size],i=this.variant==="neutral-primary"||this.variant==="accent-primary"?"invert":"primary";return l`<wui-loading-spinner color=${i} size=${t}></wui-loading-spinner>`}return null}};Q.styles=[j,Y,Et];he([c()],Q.prototype,"size",void 0);he([c({type:Boolean})],Q.prototype,"disabled",void 0);he([c({type:Boolean})],Q.prototype,"fullWidth",void 0);he([c({type:Boolean})],Q.prototype,"loading",void 0);he([c()],Q.prototype,"variant",void 0);he([c()],Q.prototype,"textVariant",void 0);Q=he([y("wui-button")],Q);const It=_`
  :host {
    display: block;
    width: 100px;
    height: 100px;
  }

  svg {
    width: 100px;
    height: 100px;
  }

  rect {
    fill: none;
    stroke: ${e=>e.colors.accent100};
    stroke-width: 3px;
    stroke-linecap: round;
    animation: dash 1s linear infinite;
  }

  @keyframes dash {
    to {
      stroke-dashoffset: 0px;
    }
  }
`;var lt=function(e,t,i,o){var r=arguments.length,n=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,i):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(n=(r<3?s(n):r>3?s(t,i,n):s(t,i))||n);return r>3&&n&&Object.defineProperty(t,i,n),n};let Ee=class extends ${constructor(){super(...arguments),this.radius=36}render(){return this.svgLoaderTemplate()}svgLoaderTemplate(){const t=this.radius>50?50:this.radius,o=36-t,r=116+o,n=245+o,s=360+o*1.75;return l`
      <svg viewBox="0 0 110 110" width="110" height="110">
        <rect
          x="2"
          y="2"
          width="106"
          height="106"
          rx=${t}
          stroke-dasharray="${r} ${n}"
          stroke-dashoffset=${s}
        />
      </svg>
    `}};Ee.styles=[j,It];lt([c({type:Number})],Ee.prototype,"radius",void 0);Ee=lt([y("wui-loading-thumbnail")],Ee);const Ot=_`
  wui-flex {
    width: 100%;
    height: 52px;
    box-sizing: border-box;
    background-color: ${({tokens:e})=>e.theme.foregroundPrimary};
    border-radius: ${({borderRadius:e})=>e[5]};
    padding-left: ${({spacing:e})=>e[3]};
    padding-right: ${({spacing:e})=>e[3]};
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${({spacing:e})=>e[6]};
  }

  wui-text {
    color: ${({tokens:e})=>e.theme.textSecondary};
  }

  wui-icon {
    width: 12px;
    height: 12px;
  }
`;var ze=function(e,t,i,o){var r=arguments.length,n=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,i):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(n=(r<3?s(n):r>3?s(t,i,n):s(t,i))||n);return r>3&&n&&Object.defineProperty(t,i,n),n};let me=class extends ${constructor(){super(...arguments),this.disabled=!1,this.label="",this.buttonLabel=""}render(){return l`
      <wui-flex justifyContent="space-between" alignItems="center">
        <wui-text variant="lg-regular" color="inherit">${this.label}</wui-text>
        <wui-button variant="accent-secondary" size="sm">
          ${this.buttonLabel}
          <wui-icon name="chevronRight" color="inherit" size="inherit" slot="iconRight"></wui-icon>
        </wui-button>
      </wui-flex>
    `}};me.styles=[j,Y,Ot];ze([c({type:Boolean})],me.prototype,"disabled",void 0);ze([c()],me.prototype,"label",void 0);ze([c()],me.prototype,"buttonLabel",void 0);me=ze([y("wui-cta-button")],me);const Lt=_`
  :host {
    display: block;
    padding: 0 ${({spacing:e})=>e[5]} ${({spacing:e})=>e[5]};
  }
`;var ct=function(e,t,i,o){var r=arguments.length,n=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,i):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(n=(r<3?s(n):r>3?s(t,i,n):s(t,i))||n);return r>3&&n&&Object.defineProperty(t,i,n),n};let Se=class extends ${constructor(){super(...arguments),this.wallet=void 0}render(){if(!this.wallet)return this.style.display="none",null;const{name:t,app_store:i,play_store:o,chrome_store:r,homepage:n}=this.wallet,s=m.isMobile(),a=m.isIos(),h=m.isAndroid(),b=[i,o,n,r].filter(Boolean).length>1,I=K.getTruncateString({string:t,charsStart:12,charsEnd:0,truncate:"end"});return b&&!s?l`
        <wui-cta-button
          label=${`Don't have ${I}?`}
          buttonLabel="Get"
          @click=${()=>f.push("Downloads",{wallet:this.wallet})}
        ></wui-cta-button>
      `:!b&&n?l`
        <wui-cta-button
          label=${`Don't have ${I}?`}
          buttonLabel="Get"
          @click=${this.onHomePage.bind(this)}
        ></wui-cta-button>
      `:i&&a?l`
        <wui-cta-button
          label=${`Don't have ${I}?`}
          buttonLabel="Get"
          @click=${this.onAppStore.bind(this)}
        ></wui-cta-button>
      `:o&&h?l`
        <wui-cta-button
          label=${`Don't have ${I}?`}
          buttonLabel="Get"
          @click=${this.onPlayStore.bind(this)}
        ></wui-cta-button>
      `:(this.style.display="none",null)}onAppStore(){this.wallet?.app_store&&m.openHref(this.wallet.app_store,"_blank")}onPlayStore(){this.wallet?.play_store&&m.openHref(this.wallet.play_store,"_blank")}onHomePage(){this.wallet?.homepage&&m.openHref(this.wallet.homepage,"_blank")}};Se.styles=[Lt];ct([c({type:Object})],Se.prototype,"wallet",void 0);Se=ct([y("w3m-mobile-download-links")],Se);const Pt=_`
  @keyframes shake {
    0% {
      transform: translateX(0);
    }
    25% {
      transform: translateX(3px);
    }
    50% {
      transform: translateX(-3px);
    }
    75% {
      transform: translateX(3px);
    }
    100% {
      transform: translateX(0);
    }
  }

  wui-flex:first-child:not(:only-child) {
    position: relative;
  }

  wui-wallet-image {
    width: 56px;
    height: 56px;
  }

  wui-loading-thumbnail {
    position: absolute;
  }

  wui-icon-box {
    position: absolute;
    right: calc(${({spacing:e})=>e[1]} * -1);
    bottom: calc(${({spacing:e})=>e[1]} * -1);
    opacity: 0;
    transform: scale(0.5);
    transition-property: opacity, transform;
    transition-duration: ${({durations:e})=>e.lg};
    transition-timing-function: ${({easings:e})=>e["ease-out-power-2"]};
    will-change: opacity, transform;
  }

  wui-text[align='center'] {
    width: 100%;
    padding: 0px ${({spacing:e})=>e[4]};
  }

  [data-error='true'] wui-icon-box {
    opacity: 1;
    transform: scale(1);
  }

  [data-error='true'] > wui-flex:first-child {
    animation: shake 250ms ${({easings:e})=>e["ease-out-power-2"]} both;
  }

  [data-retry='false'] wui-link {
    display: none;
  }

  [data-retry='true'] wui-link {
    display: block;
    opacity: 1;
  }

  w3m-mobile-download-links {
    padding: 0px;
    width: 100%;
  }
`;var U=function(e,t,i,o){var r=arguments.length,n=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,i):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(n=(r<3?s(n):r>3?s(t,i,n):s(t,i))||n);return r>3&&n&&Object.defineProperty(t,i,n),n};class k extends ${constructor(){super(),this.wallet=f.state.data?.wallet,this.connector=f.state.data?.connector,this.timeout=void 0,this.secondaryBtnIcon="refresh",this.onConnect=void 0,this.onRender=void 0,this.onAutoConnect=void 0,this.isWalletConnect=!0,this.unsubscribe=[],this.imageSrc=ie.getConnectorImage(this.connector)??ie.getWalletImage(this.wallet),this.name=this.wallet?.name??this.connector?.name??"Wallet",this.isRetrying=!1,this.uri=w.state.wcUri,this.error=w.state.wcError,this.ready=!1,this.showRetry=!1,this.label=void 0,this.secondaryBtnLabel="Try again",this.secondaryLabel="Accept connection request in the wallet",this.isLoading=!1,this.isMobile=!1,this.onRetry=void 0,this.unsubscribe.push(w.subscribeKey("wcUri",t=>{this.uri=t,this.isRetrying&&this.onRetry&&(this.isRetrying=!1,this.onConnect?.())}),w.subscribeKey("wcError",t=>this.error=t)),(m.isTelegram()||m.isSafari())&&m.isIos()&&w.state.wcUri&&this.onConnect?.()}firstUpdated(){this.onAutoConnect?.(),this.showRetry=!this.onAutoConnect}disconnectedCallback(){this.unsubscribe.forEach(t=>t()),w.setWcError(!1),clearTimeout(this.timeout)}render(){this.onRender?.(),this.onShowRetry();const t=this.error?"Connection can be declined if a previous request is still active":this.secondaryLabel;let i="";return this.label?i=this.label:(i=`Continue in ${this.name}`,this.error&&(i="Connection declined")),l`
      <wui-flex
        data-error=${x(this.error)}
        data-retry=${this.showRetry}
        flexDirection="column"
        alignItems="center"
        .padding=${["10","5","5","5"]}
        gap="6"
      >
        <wui-flex gap="2" justifyContent="center" alignItems="center">
          <wui-wallet-image size="lg" imageSrc=${x(this.imageSrc)}></wui-wallet-image>

          ${this.error?null:this.loaderTemplate()}

          <wui-icon-box
            color="error"
            icon="close"
            size="sm"
            border
            borderColor="wui-color-bg-125"
          ></wui-icon-box>
        </wui-flex>

        <wui-flex flexDirection="column" alignItems="center" gap="6"> <wui-flex
          flexDirection="column"
          alignItems="center"
          gap="2"
          .padding=${["2","0","0","0"]}
        >
          <wui-text align="center" variant="lg-medium" color=${this.error?"error":"primary"}>
            ${i}
          </wui-text>
          <wui-text align="center" variant="lg-regular" color="secondary">${t}</wui-text>
        </wui-flex>

        ${this.secondaryBtnLabel?l`
                <wui-button
                  variant="neutral-secondary"
                  size="md"
                  ?disabled=${this.isRetrying||this.isLoading}
                  @click=${this.onTryAgain.bind(this)}
                  data-testid="w3m-connecting-widget-secondary-button"
                >
                  <wui-icon
                    color="inherit"
                    slot="iconLeft"
                    name=${this.secondaryBtnIcon}
                  ></wui-icon>
                  ${this.secondaryBtnLabel}
                </wui-button>
              `:null}
      </wui-flex>

      ${this.isWalletConnect?l`
              <wui-flex .padding=${["0","5","5","5"]} justifyContent="center">
                <wui-link
                  @click=${this.onCopyUri}
                  variant="secondary"
                  icon="copy"
                  data-testid="wui-link-copy"
                >
                  Copy link
                </wui-link>
              </wui-flex>
            `:null}

      <w3m-mobile-download-links .wallet=${this.wallet}></w3m-mobile-download-links></wui-flex>
      </wui-flex>
    `}onShowRetry(){this.error&&!this.showRetry&&(this.showRetry=!0,this.shadowRoot?.querySelector("wui-button")?.animate([{opacity:0},{opacity:1}],{fill:"forwards",easing:"ease"}))}onTryAgain(){w.setWcError(!1),this.onRetry?(this.isRetrying=!0,this.onRetry?.()):this.onConnect?.()}loaderTemplate(){const t=Ue.state.themeVariables["--w3m-border-radius-master"],i=t?parseInt(t.replace("px",""),10):4;return l`<wui-loading-thumbnail radius=${i*9}></wui-loading-thumbnail>`}onCopyUri(){try{this.uri&&(m.copyToClopboard(this.uri),ve.showSuccess("Link copied"))}catch{ve.showError("Failed to copy")}}}k.styles=Pt;U([d()],k.prototype,"isRetrying",void 0);U([d()],k.prototype,"uri",void 0);U([d()],k.prototype,"error",void 0);U([d()],k.prototype,"ready",void 0);U([d()],k.prototype,"showRetry",void 0);U([d()],k.prototype,"label",void 0);U([d()],k.prototype,"secondaryBtnLabel",void 0);U([d()],k.prototype,"secondaryLabel",void 0);U([d()],k.prototype,"isLoading",void 0);U([c({type:Boolean})],k.prototype,"isMobile",void 0);U([c()],k.prototype,"onRetry",void 0);var jt=function(e,t,i,o){var r=arguments.length,n=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,i):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(n=(r<3?s(n):r>3?s(t,i,n):s(t,i))||n);return r>3&&n&&Object.defineProperty(t,i,n),n};let Ye=class extends k{constructor(){if(super(),!this.wallet)throw new Error("w3m-connecting-wc-browser: No wallet provided");this.onConnect=this.onConnectProxy.bind(this),this.onAutoConnect=this.onConnectProxy.bind(this),T.sendEvent({type:"track",event:"SELECT_WALLET",properties:{name:this.wallet.name,platform:"browser",displayIndex:this.wallet?.display_index,walletRank:this.wallet.order,view:f.state.view}})}async onConnectProxy(){try{this.error=!1;const{connectors:t}=P.state,i=t.find(o=>o.type==="ANNOUNCED"&&o.info?.rdns===this.wallet?.rdns||o.type==="INJECTED"||o.name===this.wallet?.name);if(i)await w.connectExternal(i,i.chain);else throw new Error("w3m-connecting-wc-browser: No connector found");nt.close(),T.sendEvent({type:"track",event:"CONNECT_SUCCESS",properties:{method:"browser",name:this.wallet?.name||"Unknown",view:f.state.view,walletRank:this.wallet?.order}})}catch(t){t instanceof ot&&t.originalName===rt.PROVIDER_RPC_ERROR_NAME.USER_REJECTED_REQUEST?T.sendEvent({type:"track",event:"USER_REJECTED",properties:{message:t.message}}):T.sendEvent({type:"track",event:"CONNECT_ERROR",properties:{message:t?.message??"Unknown"}}),this.error=!0}}};Ye=jt([y("w3m-connecting-wc-browser")],Ye);var At=function(e,t,i,o){var r=arguments.length,n=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,i):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(n=(r<3?s(n):r>3?s(t,i,n):s(t,i))||n);return r>3&&n&&Object.defineProperty(t,i,n),n};let Ze=class extends k{constructor(){if(super(),!this.wallet)throw new Error("w3m-connecting-wc-desktop: No wallet provided");this.onConnect=this.onConnectProxy.bind(this),this.onRender=this.onRenderProxy.bind(this),T.sendEvent({type:"track",event:"SELECT_WALLET",properties:{name:this.wallet.name,platform:"desktop",displayIndex:this.wallet?.display_index,walletRank:this.wallet.order,view:f.state.view}})}onRenderProxy(){!this.ready&&this.uri&&(this.ready=!0,this.onConnect?.())}onConnectProxy(){if(this.wallet?.desktop_link&&this.uri)try{this.error=!1;const{desktop_link:t,name:i}=this.wallet,{redirect:o,href:r}=m.formatNativeUrl(t,this.uri);w.setWcLinking({name:i,href:r}),w.setRecentWallet(this.wallet),m.openHref(o,"_blank")}catch{this.error=!0}}};Ze=At([y("w3m-connecting-wc-desktop")],Ze);var ge=function(e,t,i,o){var r=arguments.length,n=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,i):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(n=(r<3?s(n):r>3?s(t,i,n):s(t,i))||n);return r>3&&n&&Object.defineProperty(t,i,n),n};let ce=class extends k{constructor(){if(super(),this.btnLabelTimeout=void 0,this.redirectDeeplink=void 0,this.redirectUniversalLink=void 0,this.target=void 0,this.preferUniversalLinks=S.state.experimental_preferUniversalLinks,this.isLoading=!0,this.onConnect=()=>{if(this.wallet?.mobile_link&&this.uri)try{this.error=!1;const{mobile_link:t,link_mode:i,name:o}=this.wallet,{redirect:r,redirectUniversalLink:n,href:s}=m.formatNativeUrl(t,this.uri,i);this.redirectDeeplink=r,this.redirectUniversalLink=n,this.target=m.isIframe()?"_top":"_self",w.setWcLinking({name:o,href:s}),w.setRecentWallet(this.wallet),this.preferUniversalLinks&&this.redirectUniversalLink?m.openHref(this.redirectUniversalLink,this.target):m.openHref(this.redirectDeeplink,this.target)}catch(t){T.sendEvent({type:"track",event:"CONNECT_PROXY_ERROR",properties:{message:t instanceof Error?t.message:"Error parsing the deeplink",uri:this.uri,mobile_link:this.wallet.mobile_link,name:this.wallet.name}}),this.error=!0}},!this.wallet)throw new Error("w3m-connecting-wc-mobile: No wallet provided");this.secondaryBtnLabel="Open",this.secondaryLabel=st.CONNECT_LABELS.MOBILE,this.secondaryBtnIcon="externalLink",this.onHandleURI(),this.unsubscribe.push(w.subscribeKey("wcUri",()=>{this.onHandleURI()})),T.sendEvent({type:"track",event:"SELECT_WALLET",properties:{name:this.wallet.name,platform:"mobile",displayIndex:this.wallet?.display_index,walletRank:this.wallet.order,view:f.state.view}})}disconnectedCallback(){super.disconnectedCallback(),clearTimeout(this.btnLabelTimeout)}onHandleURI(){this.isLoading=!this.uri,!this.ready&&this.uri&&(this.ready=!0,this.onConnect?.())}onTryAgain(){w.setWcError(!1),this.onConnect?.()}};ge([d()],ce.prototype,"redirectDeeplink",void 0);ge([d()],ce.prototype,"redirectUniversalLink",void 0);ge([d()],ce.prototype,"target",void 0);ge([d()],ce.prototype,"preferUniversalLinks",void 0);ge([d()],ce.prototype,"isLoading",void 0);ce=ge([y("w3m-connecting-wc-mobile")],ce);const zt=.1,Je=2.5,G=7;function De(e,t,i){return e===t?!1:(e-t<0?t-e:e-t)<=i+zt}function Bt(e,t){const i=Array.prototype.slice.call(xt.create(e,{errorCorrectionLevel:t}).modules.data,0),o=Math.sqrt(i.length);return i.reduce((r,n,s)=>(s%o===0?r.push([n]):r[r.length-1].push(n))&&r,[])}const Dt={generate({uri:e,size:t,logoSize:i,padding:o=8,dotColor:r="var(--apkt-colors-black)"}){const s=[],a=Bt(e,"Q"),h=(t-2*o)/a.length,b=[{x:0,y:0},{x:1,y:0},{x:0,y:1}];b.forEach(({x:p,y:u})=>{const C=(a.length-G)*h*p+o,v=(a.length-G)*h*u+o,E=.45;for(let W=0;W<b.length;W+=1){const M=h*(G-W*2);s.push(ye`
            <rect
              fill=${W===2?"var(--apkt-colors-black)":"var(--apkt-colors-white)"}
              width=${W===0?M-10:M}
              rx= ${W===0?(M-10)*E:M*E}
              ry= ${W===0?(M-10)*E:M*E}
              stroke=${r}
              stroke-width=${W===0?10:0}
              height=${W===0?M-10:M}
              x= ${W===0?v+h*W+10/2:v+h*W}
              y= ${W===0?C+h*W+10/2:C+h*W}
            />
          `)}});const I=Math.floor((i+25)/h),J=a.length/2-I/2,ee=a.length/2+I/2-1,fe=[];a.forEach((p,u)=>{p.forEach((C,v)=>{if(a[u][v]&&!(u<G&&v<G||u>a.length-(G+1)&&v<G||u<G&&v>a.length-(G+1))&&!(u>J&&u<ee&&v>J&&v<ee)){const E=u*h+h/2+o,W=v*h+h/2+o;fe.push([E,W])}})});const R={};return fe.forEach(([p,u])=>{R[p]?R[p]?.push(u):R[p]=[u]}),Object.entries(R).map(([p,u])=>{const C=u.filter(v=>u.every(E=>!De(v,E,h)));return[Number(p),C]}).forEach(([p,u])=>{u.forEach(C=>{s.push(ye`<circle cx=${p} cy=${C} fill=${r} r=${h/Je} />`)})}),Object.entries(R).filter(([p,u])=>u.length>1).map(([p,u])=>{const C=u.filter(v=>u.some(E=>De(v,E,h)));return[Number(p),C]}).map(([p,u])=>{u.sort((v,E)=>v<E?-1:1);const C=[];for(const v of u){const E=C.find(W=>W.some(M=>De(v,M,h)));E?E.push(v):C.push([v])}return[p,C.map(v=>[v[0],v[v.length-1]])]}).forEach(([p,u])=>{u.forEach(([C,v])=>{s.push(ye`
              <line
                x1=${p}
                x2=${p}
                y1=${C}
                y2=${v}
                stroke=${r}
                stroke-width=${h/(Je/2)}
                stroke-linecap="round"
              />
            `)})}),s}},Nt=_`
  :host {
    position: relative;
    user-select: none;
    display: block;
    overflow: hidden;
    aspect-ratio: 1 / 1;
    width: 100%;
    height: 100%;
    background-color: ${({colors:e})=>e.white};
    border: 1px solid ${({tokens:e})=>e.theme.borderPrimary};
  }

  :host {
    border-radius: ${({borderRadius:e})=>e[4]};
    display: flex;
    align-items: center;
    justify-content: center;
  }

  :host([data-clear='true']) > wui-icon {
    display: none;
  }

  svg:first-child,
  wui-image,
  wui-icon {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translateY(-50%) translateX(-50%);
    background-color: ${({tokens:e})=>e.theme.backgroundPrimary};
    box-shadow: inset 0 0 0 4px ${({tokens:e})=>e.theme.backgroundPrimary};
    border-radius: ${({borderRadius:e})=>e[6]};
  }

  wui-image {
    width: 25%;
    height: 25%;
    border-radius: ${({borderRadius:e})=>e[2]};
  }

  wui-icon {
    width: 100%;
    height: 100%;
    color: #3396ff !important;
    transform: translateY(-50%) translateX(-50%) scale(0.25);
  }

  wui-icon > svg {
    width: inherit;
    height: inherit;
  }
`;var ne=function(e,t,i,o){var r=arguments.length,n=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,i):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(n=(r<3?s(n):r>3?s(t,i,n):s(t,i))||n);return r>3&&n&&Object.defineProperty(t,i,n),n};let q=class extends ${constructor(){super(...arguments),this.uri="",this.size=0,this.theme="dark",this.imageSrc=void 0,this.alt=void 0,this.arenaClear=void 0,this.farcaster=void 0}render(){return this.dataset.theme=this.theme,this.dataset.clear=String(this.arenaClear),this.style.cssText=`--local-size: ${this.size}px`,l`<wui-flex
      alignItems="center"
      justifyContent="center"
      class="wui-qr-code"
      direction="column"
      gap="4"
      width="100%"
      style="height: 100%"
    >
      ${this.templateVisual()} ${this.templateSvg()}
    </wui-flex>`}templateSvg(){return ye`
      <svg height=${this.size} width=${this.size}>
        ${Dt.generate({uri:this.uri,size:this.size,logoSize:this.arenaClear?0:this.size/4})}
      </svg>
    `}templateVisual(){return this.imageSrc?l`<wui-image src=${this.imageSrc} alt=${this.alt??"logo"}></wui-image>`:this.farcaster?l`<wui-icon
        class="farcaster"
        size="inherit"
        color="inherit"
        name="farcaster"
      ></wui-icon>`:l`<wui-icon size="inherit" color="inherit" name="walletConnect"></wui-icon>`}};q.styles=[j,Nt];ne([c()],q.prototype,"uri",void 0);ne([c({type:Number})],q.prototype,"size",void 0);ne([c()],q.prototype,"theme",void 0);ne([c()],q.prototype,"imageSrc",void 0);ne([c()],q.prototype,"alt",void 0);ne([c({type:Boolean})],q.prototype,"arenaClear",void 0);ne([c({type:Boolean})],q.prototype,"farcaster",void 0);q=ne([y("wui-qr-code")],q);const Ut=_`
  :host {
    display: block;
    background: linear-gradient(
      90deg,
      ${({tokens:e})=>e.theme.foregroundSecondary} 0%,
      ${({tokens:e})=>e.theme.foregroundTertiary} 50%,
      ${({tokens:e})=>e.theme.foregroundSecondary} 100%
    );
    background-size: 200% 100%;
    animation: shimmer 1s ease-in-out infinite;
    border-radius: ${({borderRadius:e})=>e[2]};
  }

  :host([data-rounded='true']) {
    border-radius: ${({borderRadius:e})=>e[16]};
  }

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }
`;var _e=function(e,t,i,o){var r=arguments.length,n=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,i):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(n=(r<3?s(n):r>3?s(t,i,n):s(t,i))||n);return r>3&&n&&Object.defineProperty(t,i,n),n};let de=class extends ${constructor(){super(...arguments),this.width="",this.height="",this.variant="default",this.rounded=!1}render(){return this.style.cssText=`
      width: ${this.width};
      height: ${this.height};
    `,this.dataset.rounded=this.rounded?"true":"false",l`<slot></slot>`}};de.styles=[Ut];_e([c()],de.prototype,"width",void 0);_e([c()],de.prototype,"height",void 0);_e([c()],de.prototype,"variant",void 0);_e([c({type:Boolean})],de.prototype,"rounded",void 0);de=_e([y("wui-shimmer")],de);const Mt=_`
  wui-shimmer {
    width: 100%;
    aspect-ratio: 1 / 1;
    border-radius: ${({borderRadius:e})=>e[4]};
  }

  wui-qr-code {
    opacity: 0;
    animation-duration: ${({durations:e})=>e.xl};
    animation-timing-function: ${({easings:e})=>e["ease-out-power-2"]};
    animation-name: fade-in;
    animation-fill-mode: forwards;
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
`;var dt=function(e,t,i,o){var r=arguments.length,n=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,i):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(n=(r<3?s(n):r>3?s(t,i,n):s(t,i))||n);return r>3&&n&&Object.defineProperty(t,i,n),n};let Te=class extends k{constructor(){super(),this.basic=!1,this.forceUpdate=()=>{this.requestUpdate()},window.addEventListener("resize",this.forceUpdate)}firstUpdated(){this.basic||T.sendEvent({type:"track",event:"SELECT_WALLET",properties:{name:this.wallet?.name??"WalletConnect",platform:"qrcode",displayIndex:this.wallet?.display_index,walletRank:this.wallet?.order,view:f.state.view}})}disconnectedCallback(){super.disconnectedCallback(),this.unsubscribe?.forEach(t=>t()),window.removeEventListener("resize",this.forceUpdate)}render(){return this.onRenderProxy(),l`
      <wui-flex
        flexDirection="column"
        alignItems="center"
        .padding=${["0","5","5","5"]}
        gap="5"
      >
        <wui-shimmer width="100%"> ${this.qrCodeTemplate()} </wui-shimmer>
        <wui-text variant="lg-medium" color="primary"> Scan this QR Code with your phone </wui-text>
        ${this.copyTemplate()}
      </wui-flex>
      <w3m-mobile-download-links .wallet=${this.wallet}></w3m-mobile-download-links>
    `}onRenderProxy(){!this.ready&&this.uri&&(this.timeout=setTimeout(()=>{this.ready=!0},200))}qrCodeTemplate(){if(!this.uri||!this.ready)return null;const t=this.getBoundingClientRect().width-40,i=this.wallet?this.wallet.name:void 0;w.setWcLinking(void 0),w.setRecentWallet(this.wallet);let o=this.uri;if(this.wallet?.mobile_link){const{redirect:r}=m.formatNativeUrl(this.wallet?.mobile_link,this.uri,null);o=r}return l` <wui-qr-code
      size=${t}
      theme=${Ue.state.themeMode}
      uri=${o}
      imageSrc=${x(ie.getWalletImage(this.wallet))}
      color=${x(Ue.state.themeVariables["--w3m-qr-color"])}
      alt=${x(i)}
      data-testid="wui-qr-code"
    ></wui-qr-code>`}copyTemplate(){const t=!this.uri||!this.ready;return l`<wui-button
      .disabled=${t}
      @click=${this.onCopyUri}
      variant="neutral-secondary"
      size="sm"
      data-testid="copy-wc2-uri"
    >
      Copy link
      <wui-icon size="sm" color="inherit" name="copy" slot="iconRight"></wui-icon>
    </wui-button>`}};Te.styles=Mt;dt([c({type:Boolean})],Te.prototype,"basic",void 0);Te=dt([y("w3m-connecting-wc-qrcode")],Te);var qt=function(e,t,i,o){var r=arguments.length,n=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,i):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(n=(r<3?s(n):r>3?s(t,i,n):s(t,i))||n);return r>3&&n&&Object.defineProperty(t,i,n),n};let et=class extends ${constructor(){if(super(),this.wallet=f.state.data?.wallet,!this.wallet)throw new Error("w3m-connecting-wc-unsupported: No wallet provided");T.sendEvent({type:"track",event:"SELECT_WALLET",properties:{name:this.wallet.name,platform:"browser",displayIndex:this.wallet?.display_index,walletRank:this.wallet?.order,view:f.state.view}})}render(){return l`
      <wui-flex
        flexDirection="column"
        alignItems="center"
        .padding=${["10","5","5","5"]}
        gap="5"
      >
        <wui-wallet-image
          size="lg"
          imageSrc=${x(ie.getWalletImage(this.wallet))}
        ></wui-wallet-image>

        <wui-text variant="md-regular" color="primary">Not Detected</wui-text>
      </wui-flex>

      <w3m-mobile-download-links .wallet=${this.wallet}></w3m-mobile-download-links>
    `}};et=qt([y("w3m-connecting-wc-unsupported")],et);var ut=function(e,t,i,o){var r=arguments.length,n=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,i):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(n=(r<3?s(n):r>3?s(t,i,n):s(t,i))||n);return r>3&&n&&Object.defineProperty(t,i,n),n};let qe=class extends k{constructor(){if(super(),this.isLoading=!0,!this.wallet)throw new Error("w3m-connecting-wc-web: No wallet provided");this.onConnect=this.onConnectProxy.bind(this),this.secondaryBtnLabel="Open",this.secondaryLabel=st.CONNECT_LABELS.MOBILE,this.secondaryBtnIcon="externalLink",this.updateLoadingState(),this.unsubscribe.push(w.subscribeKey("wcUri",()=>{this.updateLoadingState()})),T.sendEvent({type:"track",event:"SELECT_WALLET",properties:{name:this.wallet.name,platform:"web",displayIndex:this.wallet?.display_index,walletRank:this.wallet?.order,view:f.state.view}})}updateLoadingState(){this.isLoading=!this.uri}onConnectProxy(){if(this.wallet?.webapp_link&&this.uri)try{this.error=!1;const{webapp_link:t,name:i}=this.wallet,{redirect:o,href:r}=m.formatUniversalUrl(t,this.uri);w.setWcLinking({name:i,href:r}),w.setRecentWallet(this.wallet),m.openHref(o,"_blank")}catch{this.error=!0}}};ut([d()],qe.prototype,"isLoading",void 0);qe=ut([y("w3m-connecting-wc-web")],qe);const Vt=_`
  :host([data-mobile-fullscreen='true']) {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  :host([data-mobile-fullscreen='true']) wui-ux-by-reown {
    margin-top: auto;
  }
`;var pe=function(e,t,i,o){var r=arguments.length,n=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,i):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(n=(r<3?s(n):r>3?s(t,i,n):s(t,i))||n);return r>3&&n&&Object.defineProperty(t,i,n),n};let X=class extends ${constructor(){super(),this.wallet=f.state.data?.wallet,this.unsubscribe=[],this.platform=void 0,this.platforms=[],this.isSiwxEnabled=!!S.state.siwx,this.remoteFeatures=S.state.remoteFeatures,this.displayBranding=!0,this.basic=!1,this.determinePlatforms(),this.initializeConnection(),this.unsubscribe.push(S.subscribeKey("remoteFeatures",t=>this.remoteFeatures=t))}disconnectedCallback(){this.unsubscribe.forEach(t=>t())}render(){return S.state.enableMobileFullScreen&&this.setAttribute("data-mobile-fullscreen","true"),l`
      ${this.headerTemplate()}
      <div class="platform-container">${this.platformTemplate()}</div>
      ${this.reownBrandingTemplate()}
    `}reownBrandingTemplate(){return!this.remoteFeatures?.reownBranding||!this.displayBranding?null:l`<wui-ux-by-reown></wui-ux-by-reown>`}async initializeConnection(t=!1){if(!(this.platform==="browser"||S.state.manualWCControl&&!t))try{const{wcPairingExpiry:i,status:o}=w.state,{redirectView:r}=f.state.data??{};if(t||S.state.enableEmbedded||m.isPairingExpired(i)||o==="connecting"){const n=w.getConnections(te.state.activeChain),s=this.remoteFeatures?.multiWallet,a=n.length>0;await w.connectWalletConnect({cache:"never"}),this.isSiwxEnabled||(a&&s?(f.replace("ProfileWallets"),ve.showSuccess("New Wallet Added")):r?f.replace(r):nt.close())}}catch(i){if(i instanceof Error&&i.message.includes("An error occurred when attempting to switch chain")&&!S.state.enableNetworkSwitch&&te.state.activeChain){te.setActiveCaipNetwork(bt.getUnsupportedNetwork(`${te.state.activeChain}:${te.state.activeCaipNetwork?.id}`)),te.showUnsupportedChainUI();return}i instanceof ot&&i.originalName===rt.PROVIDER_RPC_ERROR_NAME.USER_REJECTED_REQUEST?T.sendEvent({type:"track",event:"USER_REJECTED",properties:{message:i.message}}):T.sendEvent({type:"track",event:"CONNECT_ERROR",properties:{message:i?.message??"Unknown"}}),w.setWcError(!0),ve.showError(i.message??"Connection error"),w.resetWcConnection(),f.goBack()}}determinePlatforms(){if(!this.wallet){this.platforms.push("qrcode"),this.platform="qrcode";return}if(this.platform)return;const{mobile_link:t,desktop_link:i,webapp_link:o,injected:r,rdns:n}=this.wallet,s=r?.map(({injected_id:R})=>R).filter(Boolean),a=[...n?[n]:s??[]],h=S.state.isUniversalProvider?!1:a.length,b=t,I=o,J=w.checkInstalled(a),ee=h&&J,fe=i&&!m.isMobile();ee&&!te.state.noAdapters&&this.platforms.push("browser"),b&&this.platforms.push(m.isMobile()?"mobile":"qrcode"),I&&this.platforms.push("web"),fe&&this.platforms.push("desktop"),!ee&&h&&!te.state.noAdapters&&this.platforms.push("unsupported"),this.platform=this.platforms[0]}platformTemplate(){switch(this.platform){case"browser":return l`<w3m-connecting-wc-browser></w3m-connecting-wc-browser>`;case"web":return l`<w3m-connecting-wc-web></w3m-connecting-wc-web>`;case"desktop":return l`
          <w3m-connecting-wc-desktop .onRetry=${()=>this.initializeConnection(!0)}>
          </w3m-connecting-wc-desktop>
        `;case"mobile":return l`
          <w3m-connecting-wc-mobile isMobile .onRetry=${()=>this.initializeConnection(!0)}>
          </w3m-connecting-wc-mobile>
        `;case"qrcode":return l`<w3m-connecting-wc-qrcode ?basic=${this.basic}></w3m-connecting-wc-qrcode>`;default:return l`<w3m-connecting-wc-unsupported></w3m-connecting-wc-unsupported>`}}headerTemplate(){return this.platforms.length>1?l`
      <w3m-connecting-header
        .platforms=${this.platforms}
        .onSelectPlatfrom=${this.onSelectPlatform.bind(this)}
      >
      </w3m-connecting-header>
    `:null}async onSelectPlatform(t){const i=this.shadowRoot?.querySelector("div");i&&(await i.animate([{opacity:1},{opacity:0}],{duration:200,fill:"forwards",easing:"ease"}).finished,this.platform=t,i.animate([{opacity:0},{opacity:1}],{duration:200,fill:"forwards",easing:"ease"}))}};X.styles=Vt;pe([d()],X.prototype,"platform",void 0);pe([d()],X.prototype,"platforms",void 0);pe([d()],X.prototype,"isSiwxEnabled",void 0);pe([d()],X.prototype,"remoteFeatures",void 0);pe([c({type:Boolean})],X.prototype,"displayBranding",void 0);pe([c({type:Boolean})],X.prototype,"basic",void 0);X=pe([y("w3m-connecting-wc-view")],X);var Fe=function(e,t,i,o){var r=arguments.length,n=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,i):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(n=(r<3?s(n):r>3?s(t,i,n):s(t,i))||n);return r>3&&n&&Object.defineProperty(t,i,n),n};let Ie=class extends ${constructor(){super(),this.unsubscribe=[],this.isMobile=m.isMobile(),this.remoteFeatures=S.state.remoteFeatures,this.unsubscribe.push(S.subscribeKey("remoteFeatures",t=>this.remoteFeatures=t))}disconnectedCallback(){this.unsubscribe.forEach(t=>t())}render(){if(this.isMobile){const{featured:t,recommended:i}=g.state,{customWallets:o}=S.state,r=gt.getRecentWallets(),n=t.length||i.length||o?.length||r.length;return l`<wui-flex flexDirection="column" gap="2" .margin=${["1","3","3","3"]}>
        ${n?l`<w3m-connector-list></w3m-connector-list>`:null}
        <w3m-all-wallets-widget></w3m-all-wallets-widget>
      </wui-flex>`}return l`<wui-flex flexDirection="column" .padding=${["0","0","4","0"]}>
        <w3m-connecting-wc-view ?basic=${!0} .displayBranding=${!1}></w3m-connecting-wc-view>
        <wui-flex flexDirection="column" .padding=${["0","3","0","3"]}>
          <w3m-all-wallets-widget></w3m-all-wallets-widget>
        </wui-flex>
      </wui-flex>
      ${this.reownBrandingTemplate()} `}reownBrandingTemplate(){return this.remoteFeatures?.reownBranding?l` <wui-flex flexDirection="column" .padding=${["1","0","1","0"]}>
      <wui-ux-by-reown></wui-ux-by-reown>
    </wui-flex>`:null}};Fe([d()],Ie.prototype,"isMobile",void 0);Fe([d()],Ie.prototype,"remoteFeatures",void 0);Ie=Fe([y("w3m-connecting-wc-basic-view")],Ie);const Ft=e=>e.strings===void 0;const $e=(e,t)=>{const i=e._$AN;if(i===void 0)return!1;for(const o of i)o._$AO?.(t,!1),$e(o,t);return!0},Oe=e=>{let t,i;do{if((t=e._$AM)===void 0)break;i=t._$AN,i.delete(e),e=t}while(i?.size===0)},ht=e=>{for(let t;t=e._$AM;e=t){let i=t._$AN;if(i===void 0)t._$AN=i=new Set;else if(i.has(e))break;i.add(e),Kt(t)}};function Ht(e){this._$AN!==void 0?(Oe(this),this._$AM=e,ht(this)):this._$AM=e}function Gt(e,t=!1,i=0){const o=this._$AH,r=this._$AN;if(r!==void 0&&r.size!==0)if(t)if(Array.isArray(o))for(let n=i;n<o.length;n++)$e(o[n],!1),Oe(o[n]);else o!=null&&($e(o,!1),Oe(o));else $e(this,e)}const Kt=e=>{e.type==$t.CHILD&&(e._$AP??=Gt,e._$AQ??=Ht)};class Qt extends yt{constructor(){super(...arguments),this._$AN=void 0}_$AT(t,i,o){super._$AT(t,i,o),ht(this),this.isConnected=t._$AU}_$AO(t,i=!0){t!==this.isConnected&&(this.isConnected=t,t?this.reconnected?.():this.disconnected?.()),i&&($e(this,t),Oe(this))}setValue(t){if(Ft(this._$Ct))this._$Ct._$AI(t,this);else{const i=[...this._$Ct._$AH];i[this._$Ci]=t,this._$Ct._$AI(i,this,0)}}disconnected(){}reconnected(){}}const He=()=>new Xt;class Xt{}const Ne=new WeakMap,Ge=vt(class extends Qt{render(e){return Xe}update(e,[t]){const i=t!==this.G;return i&&this.G!==void 0&&this.rt(void 0),(i||this.lt!==this.ct)&&(this.G=t,this.ht=e.options?.host,this.rt(this.ct=e.element)),Xe}rt(e){if(this.isConnected||(e=void 0),typeof this.G=="function"){const t=this.ht??globalThis;let i=Ne.get(t);i===void 0&&(i=new WeakMap,Ne.set(t,i)),i.get(this.G)!==void 0&&this.G.call(this.ht,void 0),i.set(this.G,e),e!==void 0&&this.G.call(this.ht,e)}else this.G.value=e}get lt(){return typeof this.G=="function"?Ne.get(this.ht??globalThis)?.get(this.G):this.G?.value}disconnected(){this.lt===this.ct&&this.rt(void 0)}reconnected(){this.rt(this.ct)}}),Yt=_`
  :host {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  label {
    position: relative;
    display: inline-block;
    user-select: none;
    transition:
      background-color ${({durations:e})=>e.lg}
        ${({easings:e})=>e["ease-out-power-2"]},
      color ${({durations:e})=>e.lg} ${({easings:e})=>e["ease-out-power-2"]},
      border ${({durations:e})=>e.lg} ${({easings:e})=>e["ease-out-power-2"]},
      box-shadow ${({durations:e})=>e.lg}
        ${({easings:e})=>e["ease-out-power-2"]},
      width ${({durations:e})=>e.lg} ${({easings:e})=>e["ease-out-power-2"]},
      height ${({durations:e})=>e.lg} ${({easings:e})=>e["ease-out-power-2"]},
      transform ${({durations:e})=>e.lg}
        ${({easings:e})=>e["ease-out-power-2"]},
      opacity ${({durations:e})=>e.lg} ${({easings:e})=>e["ease-out-power-2"]};
    will-change: background-color, color, border, box-shadow, width, height, transform, opacity;
  }

  input {
    width: 0;
    height: 0;
    opacity: 0;
  }

  span {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: ${({colors:e})=>e.neutrals300};
    border-radius: ${({borderRadius:e})=>e.round};
    border: 1px solid transparent;
    will-change: border;
    transition:
      background-color ${({durations:e})=>e.lg}
        ${({easings:e})=>e["ease-out-power-2"]},
      color ${({durations:e})=>e.lg} ${({easings:e})=>e["ease-out-power-2"]},
      border ${({durations:e})=>e.lg} ${({easings:e})=>e["ease-out-power-2"]},
      box-shadow ${({durations:e})=>e.lg}
        ${({easings:e})=>e["ease-out-power-2"]},
      width ${({durations:e})=>e.lg} ${({easings:e})=>e["ease-out-power-2"]},
      height ${({durations:e})=>e.lg} ${({easings:e})=>e["ease-out-power-2"]},
      transform ${({durations:e})=>e.lg}
        ${({easings:e})=>e["ease-out-power-2"]},
      opacity ${({durations:e})=>e.lg} ${({easings:e})=>e["ease-out-power-2"]};
    will-change: background-color, color, border, box-shadow, width, height, transform, opacity;
  }

  span:before {
    content: '';
    position: absolute;
    background-color: ${({colors:e})=>e.white};
    border-radius: 50%;
  }

  /* -- Sizes --------------------------------------------------------- */
  label[data-size='lg'] {
    width: 48px;
    height: 32px;
  }

  label[data-size='md'] {
    width: 40px;
    height: 28px;
  }

  label[data-size='sm'] {
    width: 32px;
    height: 22px;
  }

  label[data-size='lg'] > span:before {
    height: 24px;
    width: 24px;
    left: 4px;
    top: 3px;
  }

  label[data-size='md'] > span:before {
    height: 20px;
    width: 20px;
    left: 4px;
    top: 3px;
  }

  label[data-size='sm'] > span:before {
    height: 16px;
    width: 16px;
    left: 3px;
    top: 2px;
  }

  /* -- Focus states --------------------------------------------------- */
  input:focus-visible:not(:checked) + span,
  input:focus:not(:checked) + span {
    border: 1px solid ${({tokens:e})=>e.core.iconAccentPrimary};
    background-color: ${({tokens:e})=>e.theme.textTertiary};
    box-shadow: 0px 0px 0px 4px rgba(9, 136, 240, 0.2);
  }

  input:focus-visible:checked + span,
  input:focus:checked + span {
    border: 1px solid ${({tokens:e})=>e.core.iconAccentPrimary};
    box-shadow: 0px 0px 0px 4px rgba(9, 136, 240, 0.2);
  }

  /* -- Checked states --------------------------------------------------- */
  input:checked + span {
    background-color: ${({tokens:e})=>e.core.iconAccentPrimary};
  }

  label[data-size='lg'] > input:checked + span:before {
    transform: translateX(calc(100% - 9px));
  }

  label[data-size='md'] > input:checked + span:before {
    transform: translateX(calc(100% - 9px));
  }

  label[data-size='sm'] > input:checked + span:before {
    transform: translateX(calc(100% - 7px));
  }

  /* -- Hover states ------------------------------------------------------- */
  label:hover > input:not(:checked):not(:disabled) + span {
    background-color: ${({colors:e})=>e.neutrals400};
  }

  label:hover > input:checked:not(:disabled) + span {
    background-color: ${({colors:e})=>e.accent080};
  }

  /* -- Disabled state --------------------------------------------------- */
  label:has(input:disabled) {
    pointer-events: none;
    user-select: none;
  }

  input:not(:checked):disabled + span {
    background-color: ${({colors:e})=>e.neutrals700};
  }

  input:checked:disabled + span {
    background-color: ${({colors:e})=>e.neutrals700};
  }

  input:not(:checked):disabled + span::before {
    background-color: ${({colors:e})=>e.neutrals400};
  }

  input:checked:disabled + span::before {
    background-color: ${({tokens:e})=>e.theme.textTertiary};
  }
`;var Be=function(e,t,i,o){var r=arguments.length,n=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,i):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(n=(r<3?s(n):r>3?s(t,i,n):s(t,i))||n);return r>3&&n&&Object.defineProperty(t,i,n),n};let we=class extends ${constructor(){super(...arguments),this.inputElementRef=He(),this.checked=!1,this.disabled=!1,this.size="md"}render(){return l`
      <label data-size=${this.size}>
        <input
          ${Ge(this.inputElementRef)}
          type="checkbox"
          ?checked=${this.checked}
          ?disabled=${this.disabled}
          @change=${this.dispatchChangeEvent.bind(this)}
        />
        <span></span>
      </label>
    `}dispatchChangeEvent(){this.dispatchEvent(new CustomEvent("switchChange",{detail:this.inputElementRef.value?.checked,bubbles:!0,composed:!0}))}};we.styles=[j,Y,Yt];Be([c({type:Boolean})],we.prototype,"checked",void 0);Be([c({type:Boolean})],we.prototype,"disabled",void 0);Be([c()],we.prototype,"size",void 0);we=Be([y("wui-toggle")],we);const Zt=_`
  :host {
    height: auto;
  }

  :host > wui-flex {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    column-gap: ${({spacing:e})=>e[2]};
    padding: ${({spacing:e})=>e[2]} ${({spacing:e})=>e[3]};
    background-color: ${({tokens:e})=>e.theme.foregroundPrimary};
    border-radius: ${({borderRadius:e})=>e[4]};
    box-shadow: inset 0 0 0 1px ${({tokens:e})=>e.theme.foregroundPrimary};
    transition: background-color ${({durations:e})=>e.lg}
      ${({easings:e})=>e["ease-out-power-2"]};
    will-change: background-color;
    cursor: pointer;
  }

  wui-switch {
    pointer-events: none;
  }
`;var pt=function(e,t,i,o){var r=arguments.length,n=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,i):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(n=(r<3?s(n):r>3?s(t,i,n):s(t,i))||n);return r>3&&n&&Object.defineProperty(t,i,n),n};let Le=class extends ${constructor(){super(...arguments),this.checked=!1}render(){return l`
      <wui-flex>
        <wui-icon size="xl" name="walletConnectBrown"></wui-icon>
        <wui-toggle
          ?checked=${this.checked}
          size="sm"
          @switchChange=${this.handleToggleChange.bind(this)}
        ></wui-toggle>
      </wui-flex>
    `}handleToggleChange(t){t.stopPropagation(),this.checked=t.detail,this.dispatchSwitchEvent()}dispatchSwitchEvent(){this.dispatchEvent(new CustomEvent("certifiedSwitchChange",{detail:this.checked,bubbles:!0,composed:!0}))}};Le.styles=[j,Y,Zt];pt([c({type:Boolean})],Le.prototype,"checked",void 0);Le=pt([y("wui-certified-switch")],Le);const Jt=_`
  :host {
    position: relative;
    width: 100%;
    display: inline-flex;
    flex-direction: column;
    gap: ${({spacing:e})=>e[3]};
    color: ${({tokens:e})=>e.theme.textPrimary};
    caret-color: ${({tokens:e})=>e.core.textAccentPrimary};
  }

  .wui-input-text-container {
    position: relative;
    display: flex;
  }

  input {
    width: 100%;
    border-radius: ${({borderRadius:e})=>e[4]};
    color: inherit;
    background: transparent;
    border: 1px solid ${({tokens:e})=>e.theme.borderPrimary};
    caret-color: ${({tokens:e})=>e.core.textAccentPrimary};
    padding: ${({spacing:e})=>e[3]} ${({spacing:e})=>e[3]}
      ${({spacing:e})=>e[3]} ${({spacing:e})=>e[10]};
    font-size: ${({textSize:e})=>e.large};
    line-height: ${({typography:e})=>e["lg-regular"].lineHeight};
    letter-spacing: ${({typography:e})=>e["lg-regular"].letterSpacing};
    font-weight: ${({fontWeight:e})=>e.regular};
    font-family: ${({fontFamily:e})=>e.regular};
  }

  input[data-size='lg'] {
    padding: ${({spacing:e})=>e[4]} ${({spacing:e})=>e[3]}
      ${({spacing:e})=>e[4]} ${({spacing:e})=>e[10]};
  }

  @media (hover: hover) and (pointer: fine) {
    input:hover:enabled {
      border: 1px solid ${({tokens:e})=>e.theme.borderSecondary};
    }
  }

  input:disabled {
    cursor: unset;
    border: 1px solid ${({tokens:e})=>e.theme.borderPrimary};
  }

  input::placeholder {
    color: ${({tokens:e})=>e.theme.textSecondary};
  }

  input:focus:enabled {
    border: 1px solid ${({tokens:e})=>e.theme.borderSecondary};
    background-color: ${({tokens:e})=>e.theme.foregroundPrimary};
    -webkit-box-shadow: 0px 0px 0px 4px ${({tokens:e})=>e.core.foregroundAccent040};
    -moz-box-shadow: 0px 0px 0px 4px ${({tokens:e})=>e.core.foregroundAccent040};
    box-shadow: 0px 0px 0px 4px ${({tokens:e})=>e.core.foregroundAccent040};
  }

  div.wui-input-text-container:has(input:disabled) {
    opacity: 0.5;
  }

  wui-icon.wui-input-text-left-icon {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
    left: ${({spacing:e})=>e[4]};
    color: ${({tokens:e})=>e.theme.iconDefault};
  }

  button.wui-input-text-submit-button {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    right: ${({spacing:e})=>e[3]};
    width: 24px;
    height: 24px;
    border: none;
    background: transparent;
    border-radius: ${({borderRadius:e})=>e[2]};
    color: ${({tokens:e})=>e.core.textAccentPrimary};
  }

  button.wui-input-text-submit-button:disabled {
    opacity: 1;
  }

  button.wui-input-text-submit-button.loading wui-icon {
    animation: spin 1s linear infinite;
  }

  button.wui-input-text-submit-button:hover {
    background: ${({tokens:e})=>e.core.foregroundAccent010};
  }

  input:has(+ .wui-input-text-submit-button) {
    padding-right: ${({spacing:e})=>e[12]};
  }

  input[type='number'] {
    -moz-appearance: textfield;
  }

  input[type='search']::-webkit-search-decoration,
  input[type='search']::-webkit-search-cancel-button,
  input[type='search']::-webkit-search-results-button,
  input[type='search']::-webkit-search-results-decoration {
    -webkit-appearance: none;
  }

  /* -- Keyframes --------------------------------------------------- */
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;var B=function(e,t,i,o){var r=arguments.length,n=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,i):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(n=(r<3?s(n):r>3?s(t,i,n):s(t,i))||n);return r>3&&n&&Object.defineProperty(t,i,n),n};let O=class extends ${constructor(){super(...arguments),this.inputElementRef=He(),this.disabled=!1,this.loading=!1,this.placeholder="",this.type="text",this.value="",this.size="md"}render(){return l` <div class="wui-input-text-container">
        ${this.templateLeftIcon()}
        <input
          data-size=${this.size}
          ${Ge(this.inputElementRef)}
          data-testid="wui-input-text"
          type=${this.type}
          enterkeyhint=${x(this.enterKeyHint)}
          ?disabled=${this.disabled}
          placeholder=${this.placeholder}
          @input=${this.dispatchInputChangeEvent.bind(this)}
          @keydown=${this.onKeyDown}
          .value=${this.value||""}
        />
        ${this.templateSubmitButton()}
        <slot class="wui-input-text-slot"></slot>
      </div>
      ${this.templateError()} ${this.templateWarning()}`}templateLeftIcon(){return this.icon?l`<wui-icon
        class="wui-input-text-left-icon"
        size="md"
        data-size=${this.size}
        color="inherit"
        name=${this.icon}
      ></wui-icon>`:null}templateSubmitButton(){return this.onSubmit?l`<button
        class="wui-input-text-submit-button ${this.loading?"loading":""}"
        @click=${this.onSubmit?.bind(this)}
        ?disabled=${this.disabled||this.loading}
      >
        ${this.loading?l`<wui-icon name="spinner" size="md"></wui-icon>`:l`<wui-icon name="chevronRight" size="md"></wui-icon>`}
      </button>`:null}templateError(){return this.errorText?l`<wui-text variant="sm-regular" color="error">${this.errorText}</wui-text>`:null}templateWarning(){return this.warningText?l`<wui-text variant="sm-regular" color="warning">${this.warningText}</wui-text>`:null}dispatchInputChangeEvent(){this.dispatchEvent(new CustomEvent("inputChange",{detail:this.inputElementRef.value?.value,bubbles:!0,composed:!0}))}};O.styles=[j,Y,Jt];B([c()],O.prototype,"icon",void 0);B([c({type:Boolean})],O.prototype,"disabled",void 0);B([c({type:Boolean})],O.prototype,"loading",void 0);B([c()],O.prototype,"placeholder",void 0);B([c()],O.prototype,"type",void 0);B([c()],O.prototype,"value",void 0);B([c()],O.prototype,"errorText",void 0);B([c()],O.prototype,"warningText",void 0);B([c()],O.prototype,"onSubmit",void 0);B([c()],O.prototype,"size",void 0);B([c({attribute:!1})],O.prototype,"onKeyDown",void 0);O=B([y("wui-input-text")],O);const ei=_`
  :host {
    position: relative;
    display: inline-block;
    width: 100%;
  }

  wui-icon {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    right: ${({spacing:e})=>e[3]};
    color: ${({tokens:e})=>e.theme.iconDefault};
    cursor: pointer;
    padding: ${({spacing:e})=>e[2]};
    background-color: transparent;
    border-radius: ${({borderRadius:e})=>e[4]};
    transition: background-color ${({durations:e})=>e.lg}
      ${({easings:e})=>e["ease-out-power-2"]};
  }

  @media (hover: hover) {
    wui-icon:hover {
      background-color: ${({tokens:e})=>e.theme.foregroundSecondary};
    }
  }
`;var ft=function(e,t,i,o){var r=arguments.length,n=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,i):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(n=(r<3?s(n):r>3?s(t,i,n):s(t,i))||n);return r>3&&n&&Object.defineProperty(t,i,n),n};let Pe=class extends ${constructor(){super(...arguments),this.inputComponentRef=He(),this.inputValue=""}render(){return l`
      <wui-input-text
        ${Ge(this.inputComponentRef)}
        placeholder="Search wallet"
        icon="search"
        type="search"
        enterKeyHint="search"
        size="sm"
        @inputChange=${this.onInputChange}
      >
        ${this.inputValue?l`<wui-icon
              @click=${this.clearValue}
              color="inherit"
              size="sm"
              name="close"
            ></wui-icon>`:null}
      </wui-input-text>
    `}onInputChange(t){this.inputValue=t.detail||""}clearValue(){const i=this.inputComponentRef.value?.inputElementRef.value;i&&(i.value="",this.inputValue="",i.focus(),i.dispatchEvent(new Event("input")))}};Pe.styles=[j,ei];ft([c()],Pe.prototype,"inputValue",void 0);Pe=ft([y("wui-search-bar")],Pe);const ti=ye`<svg  viewBox="0 0 48 54" fill="none">
  <path
    d="M43.4605 10.7248L28.0485 1.61089C25.5438 0.129705 22.4562 0.129705 19.9515 1.61088L4.53951 10.7248C2.03626 12.2051 0.5 14.9365 0.5 17.886V36.1139C0.5 39.0635 2.03626 41.7949 4.53951 43.2752L19.9515 52.3891C22.4562 53.8703 25.5438 53.8703 28.0485 52.3891L43.4605 43.2752C45.9637 41.7949 47.5 39.0635 47.5 36.114V17.8861C47.5 14.9365 45.9637 12.2051 43.4605 10.7248Z"
  />
</svg>`,ii=_`
  :host {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 104px;
    width: 104px;
    row-gap: ${({spacing:e})=>e[2]};
    background-color: ${({tokens:e})=>e.theme.foregroundPrimary};
    border-radius: ${({borderRadius:e})=>e[5]};
    position: relative;
  }

  wui-shimmer[data-type='network'] {
    border: none;
    -webkit-clip-path: var(--apkt-path-network);
    clip-path: var(--apkt-path-network);
  }

  svg {
    position: absolute;
    width: 48px;
    height: 54px;
    z-index: 1;
  }

  svg > path {
    stroke: ${({tokens:e})=>e.theme.foregroundSecondary};
    stroke-width: 1px;
  }

  @media (max-width: 350px) {
    :host {
      width: 100%;
    }
  }
`;var mt=function(e,t,i,o){var r=arguments.length,n=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,i):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(n=(r<3?s(n):r>3?s(t,i,n):s(t,i))||n);return r>3&&n&&Object.defineProperty(t,i,n),n};let je=class extends ${constructor(){super(...arguments),this.type="wallet"}render(){return l`
      ${this.shimmerTemplate()}
      <wui-shimmer width="80px" height="20px"></wui-shimmer>
    `}shimmerTemplate(){return this.type==="network"?l` <wui-shimmer data-type=${this.type} width="48px" height="54px"></wui-shimmer>
        ${ti}`:l`<wui-shimmer width="56px" height="56px"></wui-shimmer>`}};je.styles=[j,Y,ii];mt([c()],je.prototype,"type",void 0);je=mt([y("wui-card-select-loader")],je);const ni=at`
  :host {
    display: grid;
    width: inherit;
    height: inherit;
  }
`;var D=function(e,t,i,o){var r=arguments.length,n=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,i):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(n=(r<3?s(n):r>3?s(t,i,n):s(t,i))||n);return r>3&&n&&Object.defineProperty(t,i,n),n};let L=class extends ${render(){return this.style.cssText=`
      grid-template-rows: ${this.gridTemplateRows};
      grid-template-columns: ${this.gridTemplateColumns};
      justify-items: ${this.justifyItems};
      align-items: ${this.alignItems};
      justify-content: ${this.justifyContent};
      align-content: ${this.alignContent};
      column-gap: ${this.columnGap&&`var(--apkt-spacing-${this.columnGap})`};
      row-gap: ${this.rowGap&&`var(--apkt-spacing-${this.rowGap})`};
      gap: ${this.gap&&`var(--apkt-spacing-${this.gap})`};
      padding-top: ${this.padding&&K.getSpacingStyles(this.padding,0)};
      padding-right: ${this.padding&&K.getSpacingStyles(this.padding,1)};
      padding-bottom: ${this.padding&&K.getSpacingStyles(this.padding,2)};
      padding-left: ${this.padding&&K.getSpacingStyles(this.padding,3)};
      margin-top: ${this.margin&&K.getSpacingStyles(this.margin,0)};
      margin-right: ${this.margin&&K.getSpacingStyles(this.margin,1)};
      margin-bottom: ${this.margin&&K.getSpacingStyles(this.margin,2)};
      margin-left: ${this.margin&&K.getSpacingStyles(this.margin,3)};
    `,l`<slot></slot>`}};L.styles=[j,ni];D([c()],L.prototype,"gridTemplateRows",void 0);D([c()],L.prototype,"gridTemplateColumns",void 0);D([c()],L.prototype,"justifyItems",void 0);D([c()],L.prototype,"alignItems",void 0);D([c()],L.prototype,"justifyContent",void 0);D([c()],L.prototype,"alignContent",void 0);D([c()],L.prototype,"columnGap",void 0);D([c()],L.prototype,"rowGap",void 0);D([c()],L.prototype,"gap",void 0);D([c()],L.prototype,"padding",void 0);D([c()],L.prototype,"margin",void 0);L=D([y("wui-grid")],L);const oi=_`
  button {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    width: 104px;
    row-gap: ${({spacing:e})=>e[2]};
    padding: ${({spacing:e})=>e[3]} ${({spacing:e})=>e[0]};
    background-color: ${({tokens:e})=>e.theme.foregroundPrimary};
    border-radius: clamp(0px, ${({borderRadius:e})=>e[4]}, 20px);
    transition:
      color ${({durations:e})=>e.lg} ${({easings:e})=>e["ease-out-power-1"]},
      background-color ${({durations:e})=>e.lg}
        ${({easings:e})=>e["ease-out-power-1"]},
      border-radius ${({durations:e})=>e.lg}
        ${({easings:e})=>e["ease-out-power-1"]};
    will-change: background-color, color, border-radius;
    outline: none;
    border: none;
  }

  button > wui-flex > wui-text {
    color: ${({tokens:e})=>e.theme.textPrimary};
    max-width: 86px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    justify-content: center;
  }

  button > wui-flex > wui-text.certified {
    max-width: 66px;
  }

  @media (hover: hover) and (pointer: fine) {
    button:hover:enabled {
      background-color: ${({tokens:e})=>e.theme.foregroundSecondary};
    }
  }

  button:disabled > wui-flex > wui-text {
    color: ${({tokens:e})=>e.core.glass010};
  }

  [data-selected='true'] {
    background-color: ${({colors:e})=>e.accent020};
  }

  @media (hover: hover) and (pointer: fine) {
    [data-selected='true']:hover:enabled {
      background-color: ${({colors:e})=>e.accent010};
    }
  }

  [data-selected='true']:active:enabled {
    background-color: ${({colors:e})=>e.accent010};
  }

  @media (max-width: 350px) {
    button {
      width: 100%;
    }
  }
`;var F=function(e,t,i,o){var r=arguments.length,n=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,i):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(n=(r<3?s(n):r>3?s(t,i,n):s(t,i))||n);return r>3&&n&&Object.defineProperty(t,i,n),n};let A=class extends ${constructor(){super(),this.observer=new IntersectionObserver(()=>{}),this.visible=!1,this.imageSrc=void 0,this.imageLoading=!1,this.isImpressed=!1,this.explorerId="",this.walletQuery="",this.certified=!1,this.displayIndex=0,this.wallet=void 0,this.observer=new IntersectionObserver(t=>{t.forEach(i=>{i.isIntersecting?(this.visible=!0,this.fetchImageSrc(),this.sendImpressionEvent()):this.visible=!1})},{threshold:.01})}firstUpdated(){this.observer.observe(this)}disconnectedCallback(){this.observer.disconnect()}render(){const t=this.wallet?.badge_type==="certified";return l`
      <button>
        ${this.imageTemplate()}
        <wui-flex flexDirection="row" alignItems="center" justifyContent="center" gap="1">
          <wui-text
            variant="md-regular"
            color="inherit"
            class=${x(t?"certified":void 0)}
            >${this.wallet?.name}</wui-text
          >
          ${t?l`<wui-icon size="sm" name="walletConnectBrown"></wui-icon>`:null}
        </wui-flex>
      </button>
    `}imageTemplate(){return!this.visible&&!this.imageSrc||this.imageLoading?this.shimmerTemplate():l`
      <wui-wallet-image
        size="lg"
        imageSrc=${x(this.imageSrc)}
        name=${x(this.wallet?.name)}
        .installed=${this.wallet?.installed??!1}
        badgeSize="sm"
      >
      </wui-wallet-image>
    `}shimmerTemplate(){return l`<wui-shimmer width="56px" height="56px"></wui-shimmer>`}async fetchImageSrc(){this.wallet&&(this.imageSrc=ie.getWalletImage(this.wallet),!this.imageSrc&&(this.imageLoading=!0,this.imageSrc=await ie.fetchWalletImage(this.wallet.image_id),this.imageLoading=!1))}sendImpressionEvent(){!this.wallet||this.isImpressed||(this.isImpressed=!0,T.sendWalletImpressionEvent({name:this.wallet.name,walletRank:this.wallet.order,explorerId:this.explorerId,view:f.state.view,query:this.walletQuery,certified:this.certified,displayIndex:this.displayIndex}))}};A.styles=oi;F([d()],A.prototype,"visible",void 0);F([d()],A.prototype,"imageSrc",void 0);F([d()],A.prototype,"imageLoading",void 0);F([d()],A.prototype,"isImpressed",void 0);F([c()],A.prototype,"explorerId",void 0);F([c()],A.prototype,"walletQuery",void 0);F([c()],A.prototype,"certified",void 0);F([c()],A.prototype,"displayIndex",void 0);F([c({type:Object})],A.prototype,"wallet",void 0);A=F([y("w3m-all-wallets-list-item")],A);const ri=_`
  wui-grid {
    max-height: clamp(360px, 400px, 80vh);
    overflow: scroll;
    scrollbar-width: none;
    grid-auto-rows: min-content;
    grid-template-columns: repeat(auto-fill, 104px);
  }

  :host([data-mobile-fullscreen='true']) wui-grid {
    max-height: none;
  }

  @media (max-width: 350px) {
    wui-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  wui-grid[data-scroll='false'] {
    overflow: hidden;
  }

  wui-grid::-webkit-scrollbar {
    display: none;
  }

  w3m-all-wallets-list-item {
    opacity: 0;
    animation-duration: ${({durations:e})=>e.xl};
    animation-timing-function: ${({easings:e})=>e["ease-inout-power-2"]};
    animation-name: fade-in;
    animation-fill-mode: forwards;
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  wui-loading-spinner {
    padding-top: ${({spacing:e})=>e[4]};
    padding-bottom: ${({spacing:e})=>e[4]};
    justify-content: center;
    grid-column: 1 / span 4;
  }
`;var oe=function(e,t,i,o){var r=arguments.length,n=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,i):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(n=(r<3?s(n):r>3?s(t,i,n):s(t,i))||n);return r>3&&n&&Object.defineProperty(t,i,n),n};const tt="local-paginator";let V=class extends ${constructor(){super(),this.unsubscribe=[],this.paginationObserver=void 0,this.loading=!g.state.wallets.length,this.wallets=g.state.wallets,this.recommended=g.state.recommended,this.featured=g.state.featured,this.filteredWallets=g.state.filteredWallets,this.mobileFullScreen=S.state.enableMobileFullScreen,this.unsubscribe.push(g.subscribeKey("wallets",t=>this.wallets=t),g.subscribeKey("recommended",t=>this.recommended=t),g.subscribeKey("featured",t=>this.featured=t),g.subscribeKey("filteredWallets",t=>this.filteredWallets=t))}firstUpdated(){this.initialFetch(),this.createPaginationObserver()}disconnectedCallback(){this.unsubscribe.forEach(t=>t()),this.paginationObserver?.disconnect()}render(){return this.mobileFullScreen&&this.setAttribute("data-mobile-fullscreen","true"),l`
      <wui-grid
        data-scroll=${!this.loading}
        .padding=${["0","3","3","3"]}
        gap="2"
        justifyContent="space-between"
      >
        ${this.loading?this.shimmerTemplate(16):this.walletsTemplate()}
        ${this.paginationLoaderTemplate()}
      </wui-grid>
    `}async initialFetch(){this.loading=!0;const t=this.shadowRoot?.querySelector("wui-grid");t&&(await g.fetchWalletsByPage({page:1}),await t.animate([{opacity:1},{opacity:0}],{duration:200,fill:"forwards",easing:"ease"}).finished,this.loading=!1,t.animate([{opacity:0},{opacity:1}],{duration:200,fill:"forwards",easing:"ease"}))}shimmerTemplate(t,i){return[...Array(t)].map(()=>l`
        <wui-card-select-loader type="wallet" id=${x(i)}></wui-card-select-loader>
      `)}getWallets(){const t=[...this.featured,...this.recommended];this.filteredWallets?.length>0?t.push(...this.filteredWallets):t.push(...this.wallets);const i=m.uniqueBy(t,"id"),o=Me.markWalletsAsInstalled(i);return Me.markWalletsWithDisplayIndex(o)}walletsTemplate(){return this.getWallets().map((i,o)=>l`
        <w3m-all-wallets-list-item
          data-testid="wallet-search-item-${i.id}"
          @click=${()=>this.onConnectWallet(i)}
          .wallet=${i}
          explorerId=${i.id}
          certified=${this.badge==="certified"}
          displayIndex=${o}
        ></w3m-all-wallets-list-item>
      `)}paginationLoaderTemplate(){const{wallets:t,recommended:i,featured:o,count:r,mobileFilteredOutWalletsLength:n}=g.state,s=window.innerWidth<352?3:4,a=t.length+i.length;let b=Math.ceil(a/s)*s-a+s;return b-=t.length?o.length%s:0,r===0&&o.length>0?null:r===0||[...o,...t,...i].length<r-(n??0)?this.shimmerTemplate(b,tt):null}createPaginationObserver(){const t=this.shadowRoot?.querySelector(`#${tt}`);t&&(this.paginationObserver=new IntersectionObserver(([i])=>{if(i?.isIntersecting&&!this.loading){const{page:o,count:r,wallets:n}=g.state;n.length<r&&g.fetchWalletsByPage({page:o+1})}}),this.paginationObserver.observe(t))}onConnectWallet(t){P.selectWalletConnector(t)}};V.styles=ri;oe([d()],V.prototype,"loading",void 0);oe([d()],V.prototype,"wallets",void 0);oe([d()],V.prototype,"recommended",void 0);oe([d()],V.prototype,"featured",void 0);oe([d()],V.prototype,"filteredWallets",void 0);oe([d()],V.prototype,"badge",void 0);oe([d()],V.prototype,"mobileFullScreen",void 0);V=oe([y("w3m-all-wallets-list")],V);const si=at`
  wui-grid,
  wui-loading-spinner,
  wui-flex {
    height: 360px;
  }

  wui-grid {
    overflow: scroll;
    scrollbar-width: none;
    grid-auto-rows: min-content;
    grid-template-columns: repeat(auto-fill, 104px);
  }

  :host([data-mobile-fullscreen='true']) wui-grid {
    max-height: none;
    height: auto;
  }

  wui-grid[data-scroll='false'] {
    overflow: hidden;
  }

  wui-grid::-webkit-scrollbar {
    display: none;
  }

  wui-loading-spinner {
    justify-content: center;
    align-items: center;
  }

  @media (max-width: 350px) {
    wui-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
`;var We=function(e,t,i,o){var r=arguments.length,n=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,i):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(n=(r<3?s(n):r>3?s(t,i,n):s(t,i))||n);return r>3&&n&&Object.defineProperty(t,i,n),n};let ue=class extends ${constructor(){super(...arguments),this.prevQuery="",this.prevBadge=void 0,this.loading=!0,this.mobileFullScreen=S.state.enableMobileFullScreen,this.query=""}render(){return this.mobileFullScreen&&this.setAttribute("data-mobile-fullscreen","true"),this.onSearch(),this.loading?l`<wui-loading-spinner color="accent-primary"></wui-loading-spinner>`:this.walletsTemplate()}async onSearch(){(this.query.trim()!==this.prevQuery.trim()||this.badge!==this.prevBadge)&&(this.prevQuery=this.query,this.prevBadge=this.badge,this.loading=!0,await g.searchWallet({search:this.query,badge:this.badge}),this.loading=!1)}walletsTemplate(){const{search:t}=g.state,i=Me.markWalletsAsInstalled(t);return t.length?l`
      <wui-grid
        data-testid="wallet-list"
        .padding=${["0","3","3","3"]}
        rowGap="4"
        columngap="2"
        justifyContent="space-between"
      >
        ${i.map((o,r)=>l`
            <w3m-all-wallets-list-item
              @click=${()=>this.onConnectWallet(o)}
              .wallet=${o}
              data-testid="wallet-search-item-${o.id}"
              explorerId=${o.id}
              certified=${this.badge==="certified"}
              walletQuery=${this.query}
              displayIndex=${r}
            ></w3m-all-wallets-list-item>
          `)}
      </wui-grid>
    `:l`
        <wui-flex
          data-testid="no-wallet-found"
          justifyContent="center"
          alignItems="center"
          gap="3"
          flexDirection="column"
        >
          <wui-icon-box size="lg" color="default" icon="wallet"></wui-icon-box>
          <wui-text data-testid="no-wallet-found-text" color="secondary" variant="md-medium">
            No Wallet found
          </wui-text>
        </wui-flex>
      `}onConnectWallet(t){P.selectWalletConnector(t)}};ue.styles=si;We([d()],ue.prototype,"loading",void 0);We([d()],ue.prototype,"mobileFullScreen",void 0);We([c()],ue.prototype,"query",void 0);We([c()],ue.prototype,"badge",void 0);ue=We([y("w3m-all-wallets-search")],ue);var Ke=function(e,t,i,o){var r=arguments.length,n=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,i):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(n=(r<3?s(n):r>3?s(t,i,n):s(t,i))||n);return r>3&&n&&Object.defineProperty(t,i,n),n};let Ae=class extends ${constructor(){super(...arguments),this.search="",this.badge=void 0,this.onDebouncedSearch=m.debounce(t=>{this.search=t})}render(){const t=this.search.length>=2;return l`
      <wui-flex .padding=${["1","3","3","3"]} gap="2" alignItems="center">
        <wui-search-bar @inputChange=${this.onInputChange.bind(this)}></wui-search-bar>
        <wui-certified-switch
          ?checked=${this.badge==="certified"}
          @certifiedSwitchChange=${this.onCertifiedSwitchChange.bind(this)}
          data-testid="wui-certified-switch"
        ></wui-certified-switch>
        ${this.qrButtonTemplate()}
      </wui-flex>
      ${t||this.badge?l`<w3m-all-wallets-search
            query=${this.search}
            .badge=${this.badge}
          ></w3m-all-wallets-search>`:l`<w3m-all-wallets-list .badge=${this.badge}></w3m-all-wallets-list>`}
    `}onInputChange(t){this.onDebouncedSearch(t.detail)}onCertifiedSwitchChange(t){t.detail?(this.badge="certified",ve.showSvg("Only WalletConnect certified",{icon:"walletConnectBrown",iconColor:"accent-100"})):this.badge=void 0}qrButtonTemplate(){return m.isMobile()?l`
        <wui-icon-box
          size="xl"
          iconSize="xl"
          color="accent-primary"
          icon="qrCode"
          border
          borderColor="wui-accent-glass-010"
          @click=${this.onWalletConnectQr.bind(this)}
        ></wui-icon-box>
      `:null}onWalletConnectQr(){f.push("ConnectingWalletConnect")}};Ke([d()],Ae.prototype,"search",void 0);Ke([d()],Ae.prototype,"badge",void 0);Ae=Ke([y("w3m-all-wallets-view")],Ae);const ai=_`
  :host {
    width: 100%;
  }

  button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: ${({spacing:e})=>e[3]};
    width: 100%;
    background-color: ${({tokens:e})=>e.theme.backgroundPrimary};
    border-radius: ${({borderRadius:e})=>e[4]};
    transition:
      background-color ${({durations:e})=>e.lg}
        ${({easings:e})=>e["ease-out-power-2"]},
      scale ${({durations:e})=>e.lg} ${({easings:e})=>e["ease-out-power-2"]};
    will-change: background-color, scale;
  }

  wui-text {
    text-transform: capitalize;
  }

  wui-image {
    color: ${({tokens:e})=>e.theme.textPrimary};
  }

  @media (hover: hover) {
    button:hover:enabled {
      background-color: ${({tokens:e})=>e.theme.foregroundPrimary};
    }
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;var H=function(e,t,i,o){var r=arguments.length,n=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,i):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(n=(r<3?s(n):r>3?s(t,i,n):s(t,i))||n);return r>3&&n&&Object.defineProperty(t,i,n),n};let z=class extends ${constructor(){super(...arguments),this.imageSrc="google",this.loading=!1,this.disabled=!1,this.rightIcon=!0,this.rounded=!1,this.fullSize=!1}render(){return this.dataset.rounded=this.rounded?"true":"false",l`
      <button
        ?disabled=${this.loading?!0:!!this.disabled}
        data-loading=${this.loading}
        tabindex=${x(this.tabIdx)}
      >
        <wui-flex gap="2" alignItems="center">
          ${this.templateLeftIcon()}
          <wui-flex gap="1">
            <slot></slot>
          </wui-flex>
        </wui-flex>
        ${this.templateRightIcon()}
      </button>
    `}templateLeftIcon(){return this.icon?l`<wui-image
        icon=${this.icon}
        iconColor=${x(this.iconColor)}
        ?boxed=${!0}
        ?rounded=${this.rounded}
      ></wui-image>`:l`<wui-image
      ?boxed=${!0}
      ?rounded=${this.rounded}
      ?fullSize=${this.fullSize}
      src=${this.imageSrc}
    ></wui-image>`}templateRightIcon(){return this.rightIcon?this.loading?l`<wui-loading-spinner size="md" color="accent-primary"></wui-loading-spinner>`:l`<wui-icon name="chevronRight" size="lg" color="default"></wui-icon>`:null}};z.styles=[j,Y,ai];H([c()],z.prototype,"imageSrc",void 0);H([c()],z.prototype,"icon",void 0);H([c()],z.prototype,"iconColor",void 0);H([c({type:Boolean})],z.prototype,"loading",void 0);H([c()],z.prototype,"tabIdx",void 0);H([c({type:Boolean})],z.prototype,"disabled",void 0);H([c({type:Boolean})],z.prototype,"rightIcon",void 0);H([c({type:Boolean})],z.prototype,"rounded",void 0);H([c({type:Boolean})],z.prototype,"fullSize",void 0);z=H([y("wui-list-item")],z);var li=function(e,t,i,o){var r=arguments.length,n=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,i):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(n=(r<3?s(n):r>3?s(t,i,n):s(t,i))||n);return r>3&&n&&Object.defineProperty(t,i,n),n};let it=class extends ${constructor(){super(...arguments),this.wallet=f.state.data?.wallet}render(){if(!this.wallet)throw new Error("w3m-downloads-view");return l`
      <wui-flex gap="2" flexDirection="column" .padding=${["3","3","4","3"]}>
        ${this.chromeTemplate()} ${this.iosTemplate()} ${this.androidTemplate()}
        ${this.homepageTemplate()}
      </wui-flex>
    `}chromeTemplate(){return this.wallet?.chrome_store?l`<wui-list-item
      variant="icon"
      icon="chromeStore"
      iconVariant="square"
      @click=${this.onChromeStore.bind(this)}
      chevron
    >
      <wui-text variant="md-medium" color="primary">Chrome Extension</wui-text>
    </wui-list-item>`:null}iosTemplate(){return this.wallet?.app_store?l`<wui-list-item
      variant="icon"
      icon="appStore"
      iconVariant="square"
      @click=${this.onAppStore.bind(this)}
      chevron
    >
      <wui-text variant="md-medium" color="primary">iOS App</wui-text>
    </wui-list-item>`:null}androidTemplate(){return this.wallet?.play_store?l`<wui-list-item
      variant="icon"
      icon="playStore"
      iconVariant="square"
      @click=${this.onPlayStore.bind(this)}
      chevron
    >
      <wui-text variant="md-medium" color="primary">Android App</wui-text>
    </wui-list-item>`:null}homepageTemplate(){return this.wallet?.homepage?l`
      <wui-list-item
        variant="icon"
        icon="browser"
        iconVariant="square-blue"
        @click=${this.onHomePage.bind(this)}
        chevron
      >
        <wui-text variant="md-medium" color="primary">Website</wui-text>
      </wui-list-item>
    `:null}openStore(t){t.href&&this.wallet&&(T.sendEvent({type:"track",event:"GET_WALLET",properties:{name:this.wallet.name,walletRank:this.wallet.order,explorerId:this.wallet.id,type:t.type}}),m.openHref(t.href,"_blank"))}onChromeStore(){this.wallet?.chrome_store&&this.openStore({href:this.wallet.chrome_store,type:"chrome_store"})}onAppStore(){this.wallet?.app_store&&this.openStore({href:this.wallet.app_store,type:"app_store"})}onPlayStore(){this.wallet?.play_store&&this.openStore({href:this.wallet.play_store,type:"play_store"})}onHomePage(){this.wallet?.homepage&&this.openStore({href:this.wallet.homepage,type:"homepage"})}};it=li([y("w3m-downloads-view")],it);export{Ae as W3mAllWalletsView,Ie as W3mConnectingWcBasicView,it as W3mDownloadsView};
