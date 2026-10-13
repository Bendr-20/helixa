#!/usr/bin/env node
'use strict';
const {buildObservationArtifact}=require('../cred-payments/artifact');
const {readJson,safeOutput,writeCanonicalJsonExclusive}=require('../cred-payments/files');
function usage(){return 'Usage: build-looper-payment-observer.js --roster-proof <proof.json> --checkpoint <checkpoint.json> --collection <collection.json> [--previous-artifact <artifact.json> --continuity-anchor <trusted-anchor.json>] --output <artifact.json>';}
function parseArgs(argv){
  const allowed=new Set(['--roster-proof','--checkpoint','--collection','--previous-artifact','--continuity-anchor','--output']),options={};
  for(let i=0;i<argv.length;i++){
    const flag=argv[i];if(!allowed.has(flag))throw new TypeError('unknown flag '+flag);
    const key=flag.slice(2).replace(/-([a-z])/gu,(_,c)=>c.toUpperCase());if(Object.hasOwn(options,key))throw new TypeError('duplicate flag '+flag);
    if(i+1>=argv.length||argv[i+1].startsWith('--'))throw new TypeError(flag+' requires a value');options[key]=argv[++i];
  }
  for(const key of ['rosterProof','checkpoint','collection','output'])if(!options[key])throw new TypeError('--'+key.replace(/[A-Z]/gu,c=>'-'+c.toLowerCase())+' is required');
  return options;
}
function main(argv,{now=Date.now()}={}){
  const options=parseArgs(argv),outputPath=safeOutput(options.output);
  const rosterProof=readJson(options.rosterProof,'roster proof'),checkpoint=readJson(options.checkpoint,'checkpoint'),collection=readJson(options.collection,'collection');
  const previousArtifact=options.previousArtifact?readJson(options.previousArtifact,'previous artifact'):null;
  const continuityAnchor=options.continuityAnchor?readJson(options.continuityAnchor,'trusted continuity anchor'):null;
  const artifact=buildObservationArtifact(rosterProof,checkpoint,collection,{previousArtifact,continuityAnchor,now});
  const bytes=writeCanonicalJsonExclusive(outputPath,artifact);
  return {outputPath,bytes,artifactHash:artifact.artifactHash,checkpointHash:artifact.checkpointHash,continuityAnchorHash:continuityAnchor?.continuityAnchorHash??null,prospectiveCoverageOnly:true,x402Confirmed:false,scoreEligibleExternalCount:0,ownerAttributedCount:0,credNativeSignature:false,fromBlock:artifact.coverage.fromBlock,toBlock:artifact.coverage.toBlock,transferCount:artifact.transferCount};
}
if(require.main===module){try{process.stdout.write(JSON.stringify(main(process.argv.slice(2)))+'\n');}catch(error){process.stderr.write(error.message+'\n'+usage()+'\n');process.exitCode=1;}}
module.exports=Object.freeze({parseArgs,main});
