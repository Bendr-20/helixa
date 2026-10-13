'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {
  CANONICAL_LOOPER_COLLECTION,buildRosterHash,buildRosterProofCommitment,domainHash,
  normalizeRosterProof,normalizeCheckpoint,buildCheckpointHash,buildContinuityAnchorHash,
  buildObservationArtifact,MAX_PREDECESSOR_ARTIFACT_BYTES,
}=require('../../cred-payments');
const {collectPaymentObservation,RPC_PROVIDERS,BASE_USDC,TRANSFER_TOPIC}=require('../../cred-payments/collector');
const CANONICAL_ROSTER_PROOF=require('./fixtures/canonical-roster-proof-v1.json');

const H=n=>'0x'+n.repeat(64), HASH_A=H('a'),HASH_B=H('b'),HASH_C=H('c'),TX=H('d');
const OWNER=CANONICAL_ROSTER_PROOF.entries[0].owner,OTHER='0x'+'22'.repeat(20);
const topicAddress=value=>'0x'+'0'.repeat(24)+value.slice(2);
function proof(){const value=structuredClone(CANONICAL_ROSTER_PROOF);value.blockProvenance={blockNumber:'90',blockHash:HASH_C,blockTimestamp:'2026-10-13T03:00:00.000Z',finality:'finalized'};delete value.rosterProofCommitment;value.rosterProofCommitment=buildRosterProofCommitment(value);return value;}
function rows(){return proof().entries.map(({tokenId,account,owner})=>({tokenId,account,owner}));}
function checkpoint(overrides={}){const rp=proof();return {checkpointType:'looper-payment-checkpoint-v1',chainId:'8453',canonicalRosterHash:rp.rosterHash,rosterProofCommitment:rp.rosterProofCommitment,inceptionBlockNumber:'100',inceptionBlockHash:HASH_A,inceptionBlockTimestamp:'2026-10-13T03:01:00.000Z',providerUrls:[...RPC_PROVIDERS],finalityPolicy:{blockTag:'finalized',minimumConfirmations:'20'},previousArtifactHash:null,previousToBlock:null,...overrides};}
function continuityAnchor(previous,overrides={}){
  const cp=previous.checkpoint,material={
    continuityAnchorType:'looper-payment-continuity-anchor-v1',chainId:'8453',collection:CANONICAL_LOOPER_COLLECTION,
    canonicalRosterHash:previous.rosterHash,rosterProofCommitment:previous.rosterProofCommitment,rosterProofProvenance:previous.rosterProofProvenance,
    inceptionCheckpoint:{checkpointType:cp.checkpointType,chainId:cp.chainId,canonicalRosterHash:cp.canonicalRosterHash,rosterProofCommitment:cp.rosterProofCommitment,inceptionBlockNumber:cp.inceptionBlockNumber,inceptionBlockHash:cp.inceptionBlockHash,inceptionBlockTimestamp:cp.inceptionBlockTimestamp,providerUrls:cp.providerUrls,finalityPolicy:cp.finalityPolicy},
    predecessorArtifactHash:previous.artifactHash,predecessorCheckpointHash:previous.checkpointHash,predecessorToBlock:previous.coverage.toBlock,nextExpectedStartBlock:(BigInt(previous.coverage.toBlock)+1n).toString(),...overrides,
  };
  return {...material,continuityAnchorHash:buildContinuityAnchorHash(material)};
}
function log(account=rows()[0].account,overrides={}){return {address:BASE_USDC,topics:[TRANSFER_TOPIC,topicAddress(OTHER),topicAddress(account)],data:'0x'+(123n).toString(16).padStart(64,'0'),blockNumber:'0x64',transactionHash:TX,transactionIndex:'0x1',blockHash:HASH_A,logIndex:'0x2',removed:false,...overrides};}
function receipt(account=rows()[0].account,overrides={}){return {transactionHash:TX,transactionIndex:'0x1',blockHash:HASH_A,blockNumber:'0x64',from:OTHER,to:BASE_USDC,cumulativeGasUsed:'0x5208',gasUsed:'0x5208',effectiveGasPrice:'0x3b9aca00',contractAddress:null,logs:[log(account)],logsBloom:'0x'+'00'.repeat(256),status:'0x1',type:'0x2',...overrides};}
function mock(options={}){let boundaryReads=0;const account=rows()[0].account;return async(provider,method,params)=>{
  if(method==='eth_chainId')return options.wrongChain&&provider===RPC_PROVIDERS[1]?'0x1':'0x2105';
  if(method==='eth_blockNumber')return '0xfa';
  if(method==='eth_getBlockByNumber'){
    const tag=params[0],number=tag==='finalized'?200n:BigInt(tag);let hash=number===100n?HASH_A:number===199n?HASH_B:HASH_C;
    if(number===100n){boundaryReads+=1;if(options.reorg&&boundaryReads>2)hash=HASH_C;}
    if(options.metadataDisagreement&&provider===RPC_PROVIDERS[1]&&number===150n)hash=HASH_B;
    return {number:'0x'+number.toString(16),hash,timestamp:number===100n?'0x6acd9eec':number===199n?'0x6acd9fa0':'0x6acd9f46'};
  }
  if(method==='eth_getLogs')return options.withLog&&params[0].topics.length===3?[log(account,{blockNumber:options.middleLog?'0x96':'0x64',blockHash:options.middleLog?HASH_C:HASH_A})]:[];
  if(method==='eth_getTransactionReceipt')return receipt(account,options.middleLog?{blockNumber:'0x96',blockHash:HASH_C,logs:[log(account,{blockNumber:'0x96',blockHash:HASH_C})]}:{});
  throw new Error('unexpected '+method);
};}

test('canonical roster proof requires the canonical collection, all token bindings, and its commitment',()=>{assert.equal(normalizeRosterProof(structuredClone(CANONICAL_ROSTER_PROOF)).entries.length,688);const good=proof();assert.equal(normalizeRosterProof(good).entries.length,688);const fabricated={...good,entries:good.entries.map((x,i)=>i?x:{...x,account:'0x'+'ff'.repeat(20)})};assert.throws(()=>normalizeRosterProof(fabricated),/roster hash|commitment/);const wrongCollection={...good,collection:'0x'+'44'.repeat(20)};assert.throws(()=>normalizeRosterProof(wrongCollection),/canonical Looper collection/);const wrongBinding={...good,entries:good.entries.map((x,i)=>i?x:{...x,tokenBinding:{...x.tokenBinding,tokenId:'2'}})};assert.throws(()=>normalizeRosterProof(wrongBinding),/token binding/);});

test('canonical roster pin rejects a substituted TBA even when every commitment is recomputed',()=>{
  const forged=proof();
  forged.entries[0]={...forged.entries[0],account:'0x'+'ff'.repeat(20)};
  forged.rosterHash=buildRosterHash({
    rosterType:'looper-base-roster-v1',chainId:'8453',collection:CANONICAL_LOOPER_COLLECTION,
    loopers:forged.entries.map(({tokenId,account,owner})=>({tokenId,account,owner})),
  });
  const material={...forged};delete material.rosterProofCommitment;
  forged.rosterProofCommitment=domainHash('LOOPER-PAYMENT-ROSTER-PROOF-v1\0',material);
  assert.throws(()=>normalizeRosterProof(forged),/trusted canonical Looper roster/);
});

test('checkpoint locks inception, providers, roster proof, and Base finality policy',()=>{const value=normalizeCheckpoint(checkpoint());assert.match(buildCheckpointHash(value),/^sha256:/);assert.throws(()=>normalizeCheckpoint(checkpoint({chainId:'1'})),/chainId/);assert.throws(()=>normalizeCheckpoint(checkpoint({providerUrls:[RPC_PROVIDERS[1],RPC_PROVIDERS[0]]})),/providers/);assert.throws(()=>normalizeCheckpoint(checkpoint({finalityPolicy:{blockTag:'latest',minimumConfirmations:'20'}})),/finality/);assert.throws(()=>normalizeCheckpoint(checkpoint({finalityPolicy:{blockTag:'safe',minimumConfirmations:'5'}})),/minimum/);assert.throws(()=>normalizeCheckpoint(checkpoint({previousArtifactHash:null,previousToBlock:'99'})),/both null/);});

test('collector rejects misrouted providers and mutable or insufficiently confirmed ranges',async()=>{await assert.rejects(()=>collectPaymentObservation({rosterProof:proof(),checkpoint:checkpoint(),fromBlock:'100',toBlock:'199',rpc:mock({wrongChain:true}),now:Date.parse('2026-10-13T04:00:00.000Z')}),/chainId/);await assert.rejects(()=>collectPaymentObservation({rosterProof:proof(),checkpoint:checkpoint(),fromBlock:'100',toBlock:'241',rpc:mock(),now:Date.parse('2026-10-13T04:00:00.000Z')}),/finalized|confirmations/);});

test('collector re-reads exact boundaries after evidence collection and rejects reorgs',async()=>{await assert.rejects(()=>collectPaymentObservation({rosterProof:proof(),checkpoint:checkpoint(),fromBlock:'100',toBlock:'199',rpc:mock({reorg:true}),now:Date.parse('2026-10-13T04:00:00.000Z')}),/reorg|hash changed/);});

test('collector compares provider metadata for every discovered evidence block',async()=>{await assert.rejects(()=>collectPaymentObservation({rosterProof:proof(),checkpoint:checkpoint(),fromBlock:'100',toBlock:'199',rpc:mock({withLog:true,middleLog:true,metadataDisagreement:true}),now:Date.parse('2026-10-13T04:00:00.000Z')}),/block metadata disagreement/);});

test('first artifact starts exactly at inception and binds checkpoint and roster proof',async()=>{const rp=proof(),cp=checkpoint(),collection=await collectPaymentObservation({rosterProof:rp,checkpoint:cp,fromBlock:'100',toBlock:'199',rpc:mock(),now:Date.parse('2026-10-13T04:00:00.000Z')});const artifact=buildObservationArtifact(rp,cp,collection);assert.equal(artifact.coverage.fromBlock,'100');assert.equal(artifact.checkpointHash,buildCheckpointHash(cp));assert.equal(artifact.rosterProofCommitment,rp.rosterProofCommitment);assert.equal(artifact.predecessor.artifactHash,null);assert.equal(artifact.x402Confirmed,false);assert.equal(artifact.scoreEligibleExternalCount,0);});

test('follow-up artifacts require an exact predecessor hash and previous end plus contiguous start',async()=>{const rp=proof(),firstCheckpoint=checkpoint(),firstCollection=await collectPaymentObservation({rosterProof:rp,checkpoint:firstCheckpoint,fromBlock:'100',toBlock:'199',rpc:mock(),now:Date.parse('2026-10-13T04:00:00.000Z')}),first=buildObservationArtifact(rp,firstCheckpoint,firstCollection);const followCheckpoint=checkpoint({previousArtifactHash:first.artifactHash,previousToBlock:'199'}),fromHash=H('e'),toHash=H('f'),anchorHash=H('1'),followCollection={...firstCollection,checkpointHash:buildCheckpointHash(followCheckpoint),anchorBlock:{number:'400',hash:anchorHash,time:'2026-10-13T03:12:00.000Z'},collectedAt:'2026-10-13T03:08:18.000Z',intervals:[{fromBlock:'200',toBlock:'299',fromBlockHash:fromHash,toBlockHash:toHash,fromBlockTime:'2026-10-13T03:05:00.000Z',toBlockTime:'2026-10-13T03:08:18.000Z'}],blockMetadata:[{number:'200',hash:fromHash,time:'2026-10-13T03:05:00.000Z'},{number:'299',hash:toHash,time:'2026-10-13T03:08:18.000Z'}],logs:[],receipts:[]};const follow=buildObservationArtifact(rp,followCheckpoint,followCollection,{previousArtifact:first,continuityAnchor:continuityAnchor(first),now:Date.parse('2026-10-13T04:00:00.000Z')});assert.equal(follow.predecessor.artifactHash,first.artifactHash);assert.equal(follow.coverage.fromBlock,'200');assert.throws(()=>buildObservationArtifact(rp,followCheckpoint,followCollection,{previousArtifact:{...first,artifactHash:'sha256:'+'9'.repeat(64)},continuityAnchor:continuityAnchor(first),now:Date.parse('2026-10-13T04:00:00.000Z')}),/domain hash mismatch/);const gapCheckpoint=checkpoint({previousArtifactHash:first.artifactHash,previousToBlock:'198'});assert.throws(()=>buildObservationArtifact(rp,gapCheckpoint,{...followCollection,checkpointHash:buildCheckpointHash(gapCheckpoint)},{previousArtifact:first,continuityAnchor:continuityAnchor(first),now:Date.parse('2026-10-13T04:00:00.000Z')}),/contiguous/);const overlapCheckpoint=checkpoint({previousArtifactHash:first.artifactHash,previousToBlock:'200'});assert.throws(()=>buildObservationArtifact(rp,overlapCheckpoint,{...followCollection,checkpointHash:buildCheckpointHash(overlapCheckpoint)},{previousArtifact:first,continuityAnchor:continuityAnchor(first),now:Date.parse('2026-10-13T04:00:00.000Z')}),/contiguous/);});


test('follow-up rejects a hash-consistent but deliberately incomplete predecessor',async()=>{
  const rp=proof(),firstCheckpoint=checkpoint();
  const firstCollection=await collectPaymentObservation({rosterProof:rp,checkpoint:firstCheckpoint,fromBlock:'100',toBlock:'199',rpc:mock(),now:Date.parse('2026-10-13T04:00:00.000Z')});
  const incomplete={artifactType:'looper-payment-observation-artifact-v2',chainId:'8453',rosterHash:rp.rosterHash,rosterProofCommitment:rp.rosterProofCommitment,checkpoint:{inceptionBlockNumber:'100',inceptionBlockHash:HASH_A,inceptionBlockTimestamp:'2026-10-13T03:01:00.000Z'},coverage:{toBlock:'199'}};
  incomplete.artifactHash=domainHash('LOOPER-PAYMENT-ARTIFACT-v2\0',incomplete);
  const nextCheckpoint=checkpoint({previousArtifactHash:incomplete.artifactHash,previousToBlock:'199'});
  const nextCollection={...firstCollection,checkpointHash:buildCheckpointHash(nextCheckpoint),anchorBlock:{number:'400',hash:H('1'),time:'2026-10-13T03:12:00.000Z'},collectedAt:'2026-10-13T03:08:18.000Z',intervals:[{fromBlock:'200',toBlock:'299',fromBlockHash:H('e'),toBlockHash:H('f'),fromBlockTime:'2026-10-13T03:05:00.000Z',toBlockTime:'2026-10-13T03:08:18.000Z'}],blockMetadata:[{number:'200',hash:H('e'),time:'2026-10-13T03:05:00.000Z'},{number:'299',hash:H('f'),time:'2026-10-13T03:08:18.000Z'}],logs:[],receipts:[]};
  assert.throws(()=>buildObservationArtifact(rp,nextCheckpoint,nextCollection,{previousArtifact:incomplete,continuityAnchor:{},now:Date.parse('2026-10-13T04:00:00.000Z')}),/missing field|complete predecessor/);
});

test('follow-up rejects tampered nested lineage after recomputation and accepts valid continuity',async()=>{
  const rp=proof(),firstCheckpoint=checkpoint();
  const firstCollection=await collectPaymentObservation({rosterProof:rp,checkpoint:firstCheckpoint,fromBlock:'100',toBlock:'199',rpc:mock(),now:Date.parse('2026-10-13T04:00:00.000Z')});
  const first=buildObservationArtifact(rp,firstCheckpoint,firstCollection);
  const secondCheckpoint=checkpoint({previousArtifactHash:first.artifactHash,previousToBlock:'199'});
  const secondCollection={...firstCollection,checkpointHash:buildCheckpointHash(secondCheckpoint),anchorBlock:{number:'400',hash:H('1'),time:'2026-10-13T03:12:00.000Z'},collectedAt:'2026-10-13T03:08:18.000Z',intervals:[{fromBlock:'200',toBlock:'299',fromBlockHash:H('e'),toBlockHash:H('f'),fromBlockTime:'2026-10-13T03:05:00.000Z',toBlockTime:'2026-10-13T03:08:18.000Z'}],blockMetadata:[{number:'200',hash:H('e'),time:'2026-10-13T03:05:00.000Z'},{number:'299',hash:H('f'),time:'2026-10-13T03:08:18.000Z'}],logs:[],receipts:[]};
  const second=buildObservationArtifact(rp,secondCheckpoint,secondCollection,{previousArtifact:first,continuityAnchor:continuityAnchor(first),now:Date.parse('2026-10-13T04:00:00.000Z')});
  const thirdCollectionBase={...firstCollection,anchorBlock:{number:'500',hash:H('2'),time:'2026-10-13T03:16:00.000Z'},collectedAt:'2026-10-13T03:11:38.000Z',intervals:[{fromBlock:'300',toBlock:'399',fromBlockHash:H('3'),toBlockHash:H('4'),fromBlockTime:'2026-10-13T03:08:20.000Z',toBlockTime:'2026-10-13T03:11:38.000Z'}],blockMetadata:[{number:'300',hash:H('3'),time:'2026-10-13T03:08:20.000Z'},{number:'399',hash:H('4'),time:'2026-10-13T03:11:38.000Z'}],logs:[],receipts:[]};
  const trustedAnchor=continuityAnchor(second),thirdCheckpoint=checkpoint({previousArtifactHash:second.artifactHash,previousToBlock:'299'}),thirdCollection={...thirdCollectionBase,checkpointHash:buildCheckpointHash(thirdCheckpoint)};
  assert.throws(()=>buildObservationArtifact(rp,thirdCheckpoint,thirdCollection,{previousArtifact:second,now:Date.parse('2026-10-13T04:00:00.000Z')}),/trusted continuity anchor is required/);
  assert.throws(()=>buildObservationArtifact(rp,thirdCheckpoint,thirdCollection,{previousArtifact:second,continuityAnchor:{},now:Date.parse('2026-10-13T04:00:00.000Z')}),/missing field/);
  assert.throws(()=>buildObservationArtifact(rp,thirdCheckpoint,thirdCollection,{previousArtifact:second,continuityAnchor:{...trustedAnchor,extra:true},now:Date.parse('2026-10-13T04:00:00.000Z')}),/unknown field/);
  assert.throws(()=>buildObservationArtifact(rp,thirdCheckpoint,thirdCollection,{previousArtifact:second,continuityAnchor:{...trustedAnchor,continuityAnchorHash:'sha256:'+'0'.repeat(64)},now:Date.parse('2026-10-13T04:00:00.000Z')}),/commitment mismatch/);
  const oneSided=structuredClone(second);oneSided.predecessor.artifactHash='sha256:'+'9'.repeat(64);delete oneSided.artifactHash;oneSided.artifactHash=domainHash('LOOPER-PAYMENT-ARTIFACT-v2\0',oneSided);
  const oneSidedCheckpoint=checkpoint({previousArtifactHash:oneSided.artifactHash,previousToBlock:'299'});
  assert.throws(()=>buildObservationArtifact(rp,oneSidedCheckpoint,{...thirdCollectionBase,checkpointHash:buildCheckpointHash(oneSidedCheckpoint)},{previousArtifact:oneSided,continuityAnchor:trustedAnchor,now:Date.parse('2026-10-13T04:00:00.000Z')}),/predecessor.*checkpoint|lineage/);
  const substitute=structuredClone(second),fakeAncestor='sha256:'+'8'.repeat(64);substitute.checkpoint.previousArtifactHash=fakeAncestor;substitute.predecessor.artifactHash=fakeAncestor;substitute.checkpointHash=buildCheckpointHash(substitute.checkpoint);delete substitute.artifactHash;substitute.artifactHash=domainHash('LOOPER-PAYMENT-ARTIFACT-v2\0',substitute);
  const substituteCheckpoint=checkpoint({previousArtifactHash:substitute.artifactHash,previousToBlock:'299'}),substituteCollection={...thirdCollectionBase,checkpointHash:buildCheckpointHash(substituteCheckpoint)};
  assert.throws(()=>buildObservationArtifact(rp,substituteCheckpoint,substituteCollection,{previousArtifact:substitute,continuityAnchor:trustedAnchor,now:Date.parse('2026-10-13T04:00:00.000Z')}),/trusted continuity anchor|does not match/);
  for(const [field,value] of [['predecessorArtifactHash','sha256:'+'7'.repeat(64)],['predecessorCheckpointHash','sha256:'+'6'.repeat(64)],['nextExpectedStartBlock','301']]){const changed={...trustedAnchor,[field]:value};delete changed.continuityAnchorHash;assert.throws(()=>buildObservationArtifact(rp,thirdCheckpoint,thirdCollection,{previousArtifact:second,continuityAnchor:{...changed,continuityAnchorHash:buildContinuityAnchorHash(changed)},now:Date.parse('2026-10-13T04:00:00.000Z')}),/trusted continuity anchor|not contiguous|does not match/);}
  const third=buildObservationArtifact(rp,thirdCheckpoint,thirdCollection,{previousArtifact:second,continuityAnchor:trustedAnchor,now:Date.parse('2026-10-13T04:00:00.000Z')});
  assert.equal(third.coverage.fromBlock,'300');
});


test('follow-up fully revalidates predecessor safety, commitments, ranges, transfers, and receipts',async()=>{
  const rp=proof(),firstCheckpoint=checkpoint();
  const firstCollection=await collectPaymentObservation({rosterProof:rp,checkpoint:firstCheckpoint,fromBlock:'100',toBlock:'199',rpc:mock({withLog:true}),now:Date.parse('2026-10-13T04:00:00.000Z')});
  const first=buildObservationArtifact(rp,firstCheckpoint,firstCollection);
  const followBase={...firstCollection,anchorBlock:{number:'400',hash:H('1'),time:'2026-10-13T03:12:00.000Z'},collectedAt:'2026-10-13T03:08:18.000Z',intervals:[{fromBlock:'200',toBlock:'299',fromBlockHash:H('e'),toBlockHash:H('f'),fromBlockTime:'2026-10-13T03:05:00.000Z',toBlockTime:'2026-10-13T03:08:18.000Z'}],blockMetadata:[{number:'200',hash:H('e'),time:'2026-10-13T03:05:00.000Z'},{number:'299',hash:H('f'),time:'2026-10-13T03:08:18.000Z'}],logs:[],receipts:[]};
  const buildAfter=artifact=>{const nextCheckpoint=checkpoint({previousArtifactHash:artifact.artifactHash,previousToBlock:'199'}),nextCollection={...followBase,checkpointHash:buildCheckpointHash(nextCheckpoint)};return buildObservationArtifact(rp,nextCheckpoint,nextCollection,{previousArtifact:artifact,continuityAnchor:continuityAnchor(first),now:Date.parse('2026-10-13T04:00:00.000Z')});};
  assert.equal(buildAfter(first).coverage.fromBlock,'200');
  const rejects=[
    [artifact=>{artifact.extra=true;},/unknown field/],
    [artifact=>{artifact.x402Confirmed=true;},/safety fields/],
    [artifact=>{artifact.asset.contract='0x'+'44'.repeat(20);},/asset constants/],
    [artifact=>{artifact.rosterHash='sha256:'+'1'.repeat(64);},/pinned canonical Looper roster/],
    [artifact=>{artifact.rosterProofProvenance.blockTimestamp='2026-10-13T03:00:01.000Z';},/roster proof provenance/],
    [artifact=>{artifact.checkpointHash='sha256:'+'2'.repeat(64);},/checkpoint hash/],
    [artifact=>{artifact.providerProvenanceHash='sha256:'+'3'.repeat(64);},/provider provenance hash/],
    [artifact=>{artifact.collectionHash='not-a-hash';},/collection hash/],
    [artifact=>{artifact.generatedAt='2026-10-13T03:04:19.000Z';},/range end time/],
    [artifact=>{artifact.coverage.fromBlock='101';},/coverage start/],
    [artifact=>{artifact.receiptCount=0;},/receipt count/],
    [artifact=>{artifact.transfers[0].x402Confirmed=true;},/transfer safety fields/],
    [artifact=>{artifact.transfers[0].direction='outgoing';},/direction binding/],
  ];
  for(const [mutate,pattern] of rejects){const artifact=structuredClone(first);mutate(artifact);delete artifact.artifactHash;artifact.artifactHash=domainHash('LOOPER-PAYMENT-ARTIFACT-v2\0',artifact);assert.throws(()=>buildAfter(artifact),pattern);}
});

test('predecessor validation rejects cyclic and over-deep object graphs before hashing',async()=>{
  const rp=proof(),cp=checkpoint(),collection=await collectPaymentObservation({rosterProof:rp,checkpoint:cp,fromBlock:'100',toBlock:'199',rpc:mock(),now:Date.parse('2026-10-13T04:00:00.000Z')}),first=buildObservationArtifact(rp,cp,collection);
  const followCheckpoint=checkpoint({previousArtifactHash:first.artifactHash,previousToBlock:'199'}),followCollection={...collection,checkpointHash:buildCheckpointHash(followCheckpoint),anchorBlock:{number:'400',hash:H('1'),time:'2026-10-13T03:12:00.000Z'},collectedAt:'2026-10-13T03:08:18.000Z',intervals:[{fromBlock:'200',toBlock:'299',fromBlockHash:H('e'),toBlockHash:H('f'),fromBlockTime:'2026-10-13T03:05:00.000Z',toBlockTime:'2026-10-13T03:08:18.000Z'}],blockMetadata:[{number:'200',hash:H('e'),time:'2026-10-13T03:05:00.000Z'},{number:'299',hash:H('f'),time:'2026-10-13T03:08:18.000Z'}],logs:[],receipts:[]};
  const cycle=structuredClone(first);cycle.asset.loop=cycle;assert.throws(()=>buildObservationArtifact(rp,followCheckpoint,followCollection,{previousArtifact:cycle,continuityAnchor:continuityAnchor(first),now:Date.parse('2026-10-13T04:00:00.000Z')}),/cycle/);
  const deep=structuredClone(first);let cursor=deep.asset;for(let index=0;index<34;index+=1){cursor.extra={};cursor=cursor.extra;}assert.throws(()=>buildObservationArtifact(rp,followCheckpoint,followCollection,{previousArtifact:deep,continuityAnchor:continuityAnchor(first),now:Date.parse('2026-10-13T04:00:00.000Z')}),/depth bound/);
  const oversized=structuredClone(first);oversized.asset.padding='x'.repeat(MAX_PREDECESSOR_ARTIFACT_BYTES+1);assert.throws(()=>buildObservationArtifact(rp,followCheckpoint,followCollection,{previousArtifact:oversized,continuityAnchor:continuityAnchor(first),now:Date.parse('2026-10-13T04:00:00.000Z')}),/size bound/);
});
