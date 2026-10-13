'use strict';

const {
  BASE_CHAIN_ID, MAX_LOOPERS, ALLOWED_PROVIDER_HOSTS, BLOCK_HASH_PATTERN,
  plain, domainHash, deepFreeze, normalizeLooperRoster, buildRosterHash,
  normalizeProviderConfig, normalizeAssets, normalizeSnapshot, buildSnapshotHash,
} = require('./formats');

const MAX_RPC_RESPONSE_BYTES = 1024 * 1024;
const RPC_TIMEOUT_MS = 15000;
const RPC_BATCH_LOOPERS = 8;
const RPC_BATCH_CONCURRENCY = 1;
const RPC_BATCH_PAUSE_MS = 750;
const OWNER_SELECTOR = '0x8da5cb5b';
const TOKEN_SELECTOR = '0xfc0c546a';
const BALANCE_OF_SELECTOR = '0x70a08231';
const STAKES_SELECTOR = '0xa4e47b66';

function canonicalRpcHex(value,label,bytes=null){if(typeof value!=='string'||!/^0x(?:[0-9a-f]{2})*$/u.test(value))throw new TypeError(label+' must be lowercase even-length RPC hex');if(bytes!==null&&value.length!==2+bytes*2)throw new TypeError(label+' must encode exactly '+bytes+' bytes');return value;}
function quantity(value,label){if(typeof value!=='string'||!/^0x(?:0|[1-9a-f][0-9a-f]*)$/u.test(value))throw new TypeError(label+' must be a canonical RPC quantity');return BigInt(value);}
function decodeAddressWord(value,label){canonicalRpcHex(value,label,32);if(!/^0x0{24}[0-9a-f]{40}$/u.test(value))throw new TypeError(label+' is not an ABI address word');return '0x'+value.slice(-40);}
function decodeToken(value){canonicalRpcHex(value,'token()',96);return {chainId:BigInt('0x'+value.slice(2,66)).toString(),collection:decodeAddressWord('0x'+value.slice(66,130),'token() collection'),tokenId:BigInt('0x'+value.slice(130,194)).toString()};}
function decodeUintWord(value,label){canonicalRpcHex(value,label,32);return BigInt(value).toString();}
function decodeStakeAmount(value){canonicalRpcHex(value,'staking vault stakes()',288);return BigInt('0x'+value.slice(2,66)).toString();}
function balanceCall(contract,account){return {to:contract,data:BALANCE_OF_SELECTOR+account.slice(2).padStart(64,'0')};}
function stakesCall(vault,account,token){return {to:vault,data:STAKES_SELECTOR+account.slice(2).padStart(64,'0')+token.slice(2).padStart(64,'0')};}
function codeHash(code){return domainHash('LOOPER-BASE-ACCOUNT-CODE-v1'+String.fromCharCode(0),canonicalRpcHex(code,'account code'));}
function blockTag(number){return '0x'+number.toString(16);}

function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
async function postRpc(provider,payload){
  let lastError;
  for(let attempt=0;attempt<3;attempt+=1){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),RPC_TIMEOUT_MS);
    try{
      const response=await fetch(provider.url,{method:'POST',redirect:'error',credentials:'omit',headers:{'content-type':'application/json',accept:'application/json'},signal:controller.signal,body:JSON.stringify(payload)});
      if(!response.ok||response.redirected)throw new Error(provider.providerId+' RPC HTTP '+response.status);
      const declared=Number(response.headers.get('content-length'));
      if(Number.isFinite(declared)&&declared>MAX_RPC_RESPONSE_BYTES)throw new RangeError(provider.providerId+' RPC response exceeds 1 MiB');
      const text=await response.text();
      if(Buffer.byteLength(text)>MAX_RPC_RESPONSE_BYTES)throw new RangeError(provider.providerId+' RPC response exceeds 1 MiB');
      try{return JSON.parse(text);}catch{throw new SyntaxError(provider.providerId+' returned invalid RPC JSON');}
    }catch(error){lastError=error;if(error instanceof RangeError||error instanceof SyntaxError)throw error;if(attempt<2)await sleep(200*(attempt+1));}
    finally{clearTimeout(timer);}
  }
  throw lastError;
}
function rpcResult(provider,body,id){
  const detail=body?.error?.message;
  if(!body||body.jsonrpc!=='2.0'||body.id!==id||Object.hasOwn(body,'error')||!Object.hasOwn(body,'result'))throw new Error(provider.providerId+' returned an invalid RPC envelope'+(detail?': '+String(detail).slice(0,160):''));
  return body.result;
}
async function defaultRpc(provider,method,params){
  let lastError;for(let attempt=0;attempt<3;attempt+=1){try{return rpcResult(provider,await postRpc(provider,{jsonrpc:'2.0',id:1,method,params}),1);}catch(error){lastError=error;if(attempt<2)await sleep(200*(attempt+1));}}throw lastError;
}
defaultRpc.batch=async function defaultRpcBatch(provider,calls){
  if(!Array.isArray(calls)||calls.length===0||calls.length>RPC_BATCH_LOOPERS*6)throw new RangeError('RPC batch size is invalid');
  const payload=calls.map((call,index)=>({jsonrpc:'2.0',id:index+1,method:call.method,params:call.params}));
  let lastError;
  for(let attempt=0;attempt<3;attempt+=1){try{
    const body=await postRpc(provider,payload);
    if(!Array.isArray(body)||body.length!==payload.length)throw new Error(provider.providerId+' returned an invalid RPC batch');
    const byId=new Map();
    for(const item of body){if(!Number.isSafeInteger(item?.id)||byId.has(item.id))throw new Error(provider.providerId+' returned an invalid RPC batch');byId.set(item.id,item);}
    return payload.map(item=>rpcResult(provider,byId.get(item.id),item.id));
  }catch(error){lastError=error;if(attempt<2)await sleep(200*(attempt+1));}}
  throw lastError;
};

function callSpecs(looper,assets,tag){return [
  {label:'code',method:'eth_getCode',params:[looper.account,tag]},
  {label:'owner',method:'eth_call',params:[{to:looper.account,data:OWNER_SELECTOR},tag]},
  {label:'token',method:'eth_call',params:[{to:looper.account,data:TOKEN_SELECTOR},tag]},
  {label:'eth',method:'eth_getBalance',params:[looper.account,tag]},
  {label:'liquid',method:'eth_call',params:[balanceCall(assets.liquidCredContract,looper.account),tag]},
  {label:'staked',method:'eth_call',params:[stakesCall(assets.stakingVaultContract,looper.account,assets.stakingTokenContract),tag]},
];}
function decodeLooperResult(roster,looper,values){
  const agreed=Object.fromEntries(values),code=canonicalRpcHex(agreed.code,'account code');
  if(code==='0x')throw new Error('Looper account has no deployed code');
  const owner=decodeAddressWord(agreed.owner,'owner()'),tokenBinding=decodeToken(agreed.token);
  if(owner!==looper.owner)throw new Error('owner() does not match roster owner');
  if(tokenBinding.chainId!==BASE_CHAIN_ID||tokenBinding.collection!==roster.collection||tokenBinding.tokenId!==looper.tokenId)throw new Error('token binding does not match roster');
  return {
    proof:{tokenId:looper.tokenId,account:looper.account,owner,tokenBinding,codeHash:codeHash(code)},
    balance:{tokenId:looper.tokenId,address:looper.account,ethWei:quantity(agreed.eth,'ETH balance').toString(),liquidCred:decodeUintWord(agreed.liquid,'liquid CRED balance'),stakedCred:decodeStakeAmount(agreed.staked)},
  };
}
async function mapLimited(values,limit,operation){const out=new Array(values.length);let cursor=0;const workers=Array.from({length:Math.min(limit,values.length)},async()=>{while(true){const index=cursor++;if(index>=values.length)return;out[index]=await operation(values[index],index);}});await Promise.all(workers);return out;}
async function collectBatched(roster,providers,assets,tag,rpc){
  const chunks=[];for(let offset=0;offset<roster.loopers.length;offset+=RPC_BATCH_LOOPERS)chunks.push(roster.loopers.slice(offset,offset+RPC_BATCH_LOOPERS));
  const decoded=await mapLimited(chunks,RPC_BATCH_CONCURRENCY,async chunk=>{
    const specs=chunk.flatMap(looper=>callSpecs(looper,assets,tag));
    const providerValues=await Promise.all(providers.map(provider=>rpc.batch(provider,specs)));
    const values=chunk.map((looper,index)=>{
      const start=index*6,left=providerValues[0].slice(start,start+6),right=providerValues[1].slice(start,start+6);
      for(let item=0;item<6;item+=1)if(left[item]!==right[item])throw new Error('provider disagreement for token '+looper.tokenId+' '+specs[start+item].label);
      return decodeLooperResult(roster,looper,specs.slice(start,start+6).map((spec,item)=>[spec.label,left[item]]));
    });
    await sleep(RPC_BATCH_PAUSE_MS);
    return values;
  });
  return decoded.flat();
}
async function collectIndividually(roster,providers,assets,tag,rpc){
  const results=new Array(roster.loopers.length);let nextIndex=0;
  async function worker(){while(nextIndex<roster.loopers.length){const index=nextIndex++,looper=roster.loopers[index],specs=callSpecs(looper,assets,tag),entries=await Promise.all(specs.map(async spec=>{const values=await Promise.all(providers.map(provider=>rpc(provider,spec.method,spec.params)));if(values[0]!==values[1])throw new Error('provider disagreement for token '+looper.tokenId+' '+spec.label);return [spec.label,values[0]];}));results[index]=decodeLooperResult(roster,looper,entries);}}
  await Promise.all(Array.from({length:Math.min(4,roster.loopers.length)},worker));return results;
}

async function collectBaseProofSnapshot(rosterInput,providerInput,assetInput,rpc=defaultRpc){
  if(typeof rpc!=='function')throw new TypeError('rpc must be a function');
  const roster=normalizeLooperRoster(rosterInput),config=normalizeProviderConfig(providerInput),assets=normalizeAssets(assetInput),providers=config.providers;
  const chainIds=await Promise.all(providers.map(provider=>rpc(provider,'eth_chainId',[])));
  if(chainIds.some(value=>quantity(value,'eth_chainId')!==BigInt(BASE_CHAIN_ID)))throw new Error('both providers must report Base chainId 8453');
  const heights=await Promise.all(providers.map(provider=>rpc(provider,'eth_blockNumber',[]))).then(values=>values.map(value=>quantity(value,'eth_blockNumber'))),pinned=heights[0]<heights[1]?heights[0]:heights[1],tag=blockTag(pinned);
  const blocks=await Promise.all(providers.map(provider=>rpc(provider,'eth_getBlockByNumber',[tag,false])));
  for(const block of blocks){plain(block,'block');if(quantity(block.number,'block.number')!==pinned)throw new Error('provider returned the wrong pinned block');if(!BLOCK_HASH_PATTERN.test(block.hash))throw new TypeError('block.hash is invalid');quantity(block.timestamp,'block.timestamp');}
  if(blocks[0].hash!==blocks[1].hash)throw new Error('provider block hash disagreement at pinned block');
  if(blocks[0].timestamp!==blocks[1].timestamp)throw new Error('provider block timestamp disagreement at pinned block');
  const observedAt=new Date(Number(quantity(blocks[0].timestamp,'block.timestamp'))*1000).toISOString();
  const results=typeof rpc.batch==='function'?await collectBatched(roster,providers,assets,tag,rpc):await collectIndividually(roster,providers,assets,tag,rpc);
  return deepFreeze({snapshotType:'looper-base-proof-snapshot-v1',chainId:BASE_CHAIN_ID,blockNumber:pinned.toString(),blockHash:blocks[0].hash,observedAt,providers:providers.map(({providerId})=>({providerId})),assets,rosterHash:buildRosterHash(roster),accountProofs:results.map(value=>value.proof),balances:results.map(value=>value.balance)});
}

module.exports=Object.freeze({BASE_CHAIN_ID,MAX_LOOPERS,MAX_RPC_RESPONSE_BYTES,RPC_TIMEOUT_MS,RPC_BATCH_LOOPERS,RPC_BATCH_CONCURRENCY,RPC_BATCH_PAUSE_MS,ALLOWED_PROVIDER_HOSTS,normalizeLooperRoster,buildRosterHash,normalizeProviderConfig,normalizeAssets,normalizeSnapshot,buildSnapshotHash,collectBaseProofSnapshot,defaultRpc});
