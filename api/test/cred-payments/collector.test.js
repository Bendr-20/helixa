'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {BASE_USDC,TRANSFER_TOPIC,RPC_PROVIDERS,defaultRpc,collectPaymentObservation}=require('../../cred-payments/collector');
const {HASH_A,HASH_B,HASH_C,TX,OTHER,roster,rosterProof,checkpoint,topicAddress}=require('./helpers');
function blockHash(number){if(number===100n)return HASH_A;if(number===199n)return HASH_B;if(number===380n)return HASH_C;return '0x'+number.toString(16).padStart(64,'0');}
function timestamp(number){return '0x'+(BigInt(Date.parse('2026-10-13T03:01:00.000Z')/1000)+(number-100n)*2n).toString(16);}
function log(account){return {address:BASE_USDC,topics:[TRANSFER_TOPIC,topicAddress(OTHER),topicAddress(account)],data:'0x'+(123n).toString(16).padStart(64,'0'),blockNumber:'0x64',transactionHash:TX,transactionIndex:'0x1',blockHash:HASH_A,logIndex:'0x2',removed:false};}
function receipt(account,overrides={}){return {transactionHash:TX,transactionIndex:'0x1',blockHash:HASH_A,blockNumber:'0x64',from:OTHER,to:BASE_USDC,cumulativeGasUsed:'0x5208',gasUsed:'0x5208',effectiveGasPrice:'0x3b9aca00',contractAddress:null,logs:[log(account)],logsBloom:'0x'+'00'.repeat(256),status:'0x1',type:'0x2',...overrides};}
function mock(options={}){
  const calls=[],account=roster().loopers[0].account;
  const rpc=async(provider,method,params)=>{
    calls.push({provider,method,params});
    if(method==='eth_chainId')return options.wrongChain&&provider===RPC_PROVIDERS[1]?'0x1':'0x2105';
    if(method==='eth_blockNumber')return options.head||'0x190';
    if(method==='eth_getBlockByNumber'){
      const isAnchor=params[0]==='safe'||params[0]==='finalized',number=isAnchor?(options.laggedFinality&&provider===RPC_PROVIDERS[1]?370n:380n):BigInt(params[0]);
      const base={number:'0x'+number.toString(16),hash:blockHash(number),timestamp:timestamp(number)};
      if(options.hashMismatch&&provider===RPC_PROVIDERS[1]&&number===199n)base.hash='0x'+'ee'.repeat(32);
      if(options.anchorMismatch&&provider===RPC_PROVIDERS[1]&&number===380n)base.hash='0x'+'ee'.repeat(32);
      if(options.future)base.timestamp='0xffffffff';return base;
    }
    if(method==='eth_getLogs'){
      const incoming=params[0].topics.length===3;if(options.providerLogMismatch&&provider===RPC_PROVIDERS[1]&&incoming)return [];
      return options.withLog&&incoming?[log(account)]:[];
    }
    if(method==='eth_getTransactionReceipt'){
      if(options.receiptMismatch&&provider===RPC_PROVIDERS[1])return receipt(account,{gasUsed:'0x5209'});
      if(options.failedReceipt)return receipt(account,{status:'0x0'});return receipt(account);
    }
    throw new Error('unexpected method '+method);
  };
  return {rpc,calls};
}
function collect(rpc,overrides={}){return collectPaymentObservation({rosterProof:rosterProof(),checkpoint:checkpoint(),fromBlock:'100',toBlock:'199',rpc,now:Date.parse('2026-10-13T04:00:00.000Z'),...overrides});}
test('collector makes exact 688-account OR-topic scans through only five RPC methods',async()=>{
  const {rpc,calls}=mock();const result=await collect(rpc);assert.equal(result.logs.length,0);assert.deepEqual(result.providerUrls,RPC_PROVIDERS);assert.equal(result.prospectiveCoverageOnly,true);
  const methods=new Set(calls.map(call=>call.method));assert.deepEqual([...methods].sort(),['eth_blockNumber','eth_chainId','eth_getBlockByNumber','eth_getLogs']);
  for(const call of calls.filter(item=>item.method==='eth_getLogs')){assert.equal(call.params[0].address,BASE_USDC);const orTopic=call.params[0].topics.at(-1);assert.equal(orTopic.length,688);assert.equal(new Set(orTopic).size,688);}
});
test('collector verifies dual-provider logs and successful equivalent receipts',async()=>{
  const {rpc,calls}=mock({withLog:true});const result=await collect(rpc);assert.equal(result.logs.length,1);assert.equal(result.receipts.length,1);
  assert.equal(result.x402Confirmed,false);assert.equal(calls.filter(call=>call.method==='eth_getTransactionReceipt').length,2);
});
test('collector derives an agreed common finalized anchor when provider tags lag differently',async()=>{
  const {rpc}=mock({laggedFinality:true});const result=await collect(rpc);assert.equal(result.anchorBlock.number,'370');assert.equal(result.anchorBlock.hash,blockHash(370n));
});
test('collector fails closed on chain, finality anchor, block metadata, and normalized log disagreement',async()=>{
  for(const [option,pattern] of [['wrongChain',/chainId/],['anchorMismatch',/anchor disagreement/],['hashMismatch',/block metadata disagreement/],['providerLogMismatch',/log disagreement/]]){
    const {rpc}=mock({[option]:true,withLog:true});await assert.rejects(()=>collect(rpc),pattern);
  }
});
test('collector rejects future block clocks and receipt mismatch or failure',async()=>{
  for(const [options,pattern] of [[{future:true},/future/],[{withLog:true,receiptMismatch:true},/receipt disagreement/],[{withLog:true,failedReceipt:true},/successful/]]){
    const {rpc}=mock(options);await assert.rejects(()=>collect(rpc),pattern);
  }
});
test('collector rejects invalid or overlarge explicit ranges',async()=>{
  const {rpc}=mock();await assert.rejects(()=>collect(rpc,{fromBlock:'200',toBlock:'100'}),/range/);
  await assert.rejects(()=>collect(rpc,{fromBlock:'100',toBlock:'10100'}),/maximum/);
});
test('default transport is POST-only, bounded, retried, and method/provider pinned',async()=>{
  let attempts=0,request;const fetchImpl=async(url,options)=>{attempts+=1;request={url,options};if(attempts===1)return new Response('{}',{status:500});return new Response(JSON.stringify({jsonrpc:'2.0',id:1,result:'0xc7'}),{status:200,headers:{'content-type':'application/json'}});};
  assert.equal(await defaultRpc(RPC_PROVIDERS[0],'eth_blockNumber',[],{fetchImpl}),'0xc7');assert.equal(attempts,2);assert.equal(request.options.method,'POST');assert.equal(request.options.redirect,'error');assert.equal(request.options.credentials,'omit');
  await assert.rejects(()=>defaultRpc('https://example.com','eth_blockNumber',[],{fetchImpl}),/pinned/);await assert.rejects(()=>defaultRpc(RPC_PROVIDERS[0],'eth_call',[],{fetchImpl}),/allowlisted/);
  const huge=async()=>new Response('{}',{status:200,headers:{'content-length':String(4*1024*1024+1)}});await assert.rejects(()=>defaultRpc(RPC_PROVIDERS[0],'eth_blockNumber',[],{fetchImpl:huge}),/body bound/);
});
test('one shared limiter caps all provider work at four and chunks scans to 100 blocks',async()=>{
  const base=mock({head:'0x1f4'});let active=0,peak=0;const rpc=async(...args)=>{active+=1;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,2));try{return await base.rpc(...args);}finally{active-=1;}};
  const result=await collect(rpc,{toBlock:'300'});assert.equal(peak,4);assert.equal(result.intervals.length,3);
  const scans=base.calls.filter(call=>call.method==='eth_getLogs');assert.equal(scans.length,12);for(const scan of scans){const filter=scan.params[0],size=BigInt(filter.toBlock)-BigInt(filter.fromBlock)+1n;assert.equal(size<=100n,true);}
});
