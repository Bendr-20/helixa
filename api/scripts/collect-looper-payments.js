#!/usr/bin/env node
'use strict';
const {collectPaymentObservation,defaultRpc}=require('../cred-payments/collector');
const {readJson,safeOutput,writeCanonicalJsonExclusive}=require('../cred-payments/files');
function usage(){return 'Usage: collect-looper-payments.js --roster-proof <proof.json> --checkpoint <checkpoint.json> --from-block <decimal> --to-block <decimal> --output <collection.json>';}
function parseArgs(argv){
  const allowed=new Set(['--roster-proof','--checkpoint','--from-block','--to-block','--output']),options={};
  for(let i=0;i<argv.length;i++){
    const flag=argv[i];if(!allowed.has(flag))throw new TypeError('unknown flag '+flag);
    const key=flag.slice(2).replace(/-([a-z])/gu,(_,c)=>c.toUpperCase());if(Object.hasOwn(options,key))throw new TypeError('duplicate flag '+flag);
    if(i+1>=argv.length||argv[i+1].startsWith('--'))throw new TypeError(flag+' requires a value');options[key]=argv[++i];
  }
  for(const key of ['rosterProof','checkpoint','fromBlock','toBlock','output'])if(!options[key])throw new TypeError('--'+key.replace(/[A-Z]/gu,c=>'-'+c.toLowerCase())+' is required');
  for(const key of ['fromBlock','toBlock'])if(!/^(0|[1-9]\d*)$/u.test(options[key]))throw new TypeError('--'+key.replace(/[A-Z]/gu,c=>'-'+c.toLowerCase())+' must be a canonical decimal string');
  return options;
}
async function main(argv,{rpc=defaultRpc,now=Date.now()}={}){
  const options=parseArgs(argv),outputPath=safeOutput(options.output);
  const rosterProof=readJson(options.rosterProof,'roster proof'),checkpoint=readJson(options.checkpoint,'checkpoint');
  const collection=await collectPaymentObservation({rosterProof,checkpoint,fromBlock:options.fromBlock,toBlock:options.toBlock,rpc,now});
  const bytes=writeCanonicalJsonExclusive(outputPath,collection);
  return {outputPath,bytes,prospectiveCoverageOnly:true,x402Confirmed:false,scoreEligibleExternalCount:0,ownerAttributedCount:0,credNativeSignature:false,checkpointHash:collection.checkpointHash,fromBlock:collection.intervals[0].fromBlock,toBlock:collection.intervals.at(-1).toBlock,transferCount:collection.logs.length};
}
if(require.main===module)main(process.argv.slice(2)).then(value=>process.stdout.write(JSON.stringify(value)+'\n')).catch(error=>{process.stderr.write(error.message+'\n'+usage()+'\n');process.exitCode=1;});
module.exports=Object.freeze({parseArgs,main});
