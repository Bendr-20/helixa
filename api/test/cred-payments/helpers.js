'use strict';
const {
  BASE_USDC, TRANSFER_TOPIC, CANONICAL_LOOPER_COLLECTION,
  buildRosterHash, buildRosterProofCommitment, buildCheckpointHash, buildContinuityAnchorHash,
  normalizeReceipt,
}=require('../../cred-payments');
const {RPC_PROVIDERS}=require('../../cred-payments/collector');
const CANONICAL_ROSTER_PROOF=require('./fixtures/canonical-roster-proof-v1.json');

const HASH_A='0x'+'aa'.repeat(32);
const HASH_B='0x'+'bb'.repeat(32);
const HASH_C='0x'+'cc'.repeat(32);
const TX='0x'+'dd'.repeat(32);
const ACCOUNT=CANONICAL_ROSTER_PROOF.entries[0].account;
const OTHER='0x'+'22'.repeat(20);
const OWNER=CANONICAL_ROSTER_PROOF.entries[0].owner;
const INCEPTION_TIME='2026-10-13T03:01:00.000Z';
const END_TIME='2026-10-13T03:04:18.000Z';
const topicAddress=value=>'0x'+'0'.repeat(24)+value.slice(2);

function rosterProof(){const proof=structuredClone(CANONICAL_ROSTER_PROOF);proof.blockProvenance={blockNumber:'90',blockHash:HASH_C,blockTimestamp:'2026-10-13T03:00:00.000Z',finality:'finalized'};delete proof.rosterProofCommitment;proof.rosterProofCommitment=buildRosterProofCommitment(proof);return proof;}
function roster(){const proof=rosterProof();return {
  rosterType:'looper-base-roster-v1',
  chainId:'8453',
  collection:CANONICAL_LOOPER_COLLECTION,
  loopers:proof.entries.map(({tokenId,account,owner})=>({tokenId,account,owner})),
};}
function checkpoint(overrides={}){
  const proof=rosterProof();
  return {
    checkpointType:'looper-payment-checkpoint-v1',chainId:'8453',
    canonicalRosterHash:proof.rosterHash,rosterProofCommitment:proof.rosterProofCommitment,
    inceptionBlockNumber:'100',inceptionBlockHash:HASH_A,inceptionBlockTimestamp:INCEPTION_TIME,
    providerUrls:[...RPC_PROVIDERS],finalityPolicy:{blockTag:'finalized',minimumConfirmations:'20'},
    previousArtifactHash:null,previousToBlock:null,...overrides,
  };
}
function continuityAnchor(previous,overrides={}){
  const cp=previous.checkpoint,material={
    continuityAnchorType:'looper-payment-continuity-anchor-v1',chainId:'8453',collection:CANONICAL_LOOPER_COLLECTION,
    canonicalRosterHash:previous.rosterHash,rosterProofCommitment:previous.rosterProofCommitment,rosterProofProvenance:previous.rosterProofProvenance,
    inceptionCheckpoint:{checkpointType:cp.checkpointType,chainId:cp.chainId,canonicalRosterHash:cp.canonicalRosterHash,rosterProofCommitment:cp.rosterProofCommitment,inceptionBlockNumber:cp.inceptionBlockNumber,inceptionBlockHash:cp.inceptionBlockHash,inceptionBlockTimestamp:cp.inceptionBlockTimestamp,providerUrls:cp.providerUrls,finalityPolicy:cp.finalityPolicy},
    predecessorArtifactHash:previous.artifactHash,predecessorCheckpointHash:previous.checkpointHash,predecessorToBlock:previous.coverage.toBlock,nextExpectedStartBlock:(BigInt(previous.coverage.toBlock)+1n).toString(),...overrides,
  };
  return {...material,continuityAnchorHash:buildContinuityAnchorHash(material)};
}
function rawLog(overrides={}){return {
  address:BASE_USDC,topics:[TRANSFER_TOPIC,topicAddress(OTHER),topicAddress(ACCOUNT)],
  data:'0x'+(2n**255n).toString(16).padStart(64,'0'),blockNumber:'0x64',transactionHash:TX,
  transactionIndex:'0x1',blockHash:HASH_A,logIndex:'0x2',removed:false,...overrides,
};}
function rawReceipt(overrides={}){return {
  transactionHash:TX,transactionIndex:'0x1',blockHash:HASH_A,blockNumber:'0x64',from:OTHER,to:BASE_USDC,
  cumulativeGasUsed:'0x5208',gasUsed:'0x5208',effectiveGasPrice:'0x3b9aca00',contractAddress:null,
  logs:[rawLog()],logsBloom:'0x'+'00'.repeat(256),status:'0x1',type:'0x2',...overrides,
};}
function receiptFor(log){return normalizeReceipt(rawReceipt({
  transactionHash:log.transactionHash,transactionIndex:'0x'+BigInt(log.transactionIndex).toString(16),
  blockHash:log.blockHash,blockNumber:'0x'+BigInt(log.blockNumber).toString(16),
  logs:[rawLog({transactionHash:log.transactionHash,transactionIndex:'0x'+BigInt(log.transactionIndex).toString(16),
    blockHash:log.blockHash,blockNumber:'0x'+BigInt(log.blockNumber).toString(16),
    logIndex:'0x'+BigInt(log.logIndex).toString(16),topics:[TRANSFER_TOPIC,topicAddress(log.from),topicAddress(log.to)],
    data:'0x'+BigInt(log.value).toString(16).padStart(64,'0')})],
}));}
function collection(logs=[],overrides={}){
  const proof=rosterProof(),cp=checkpoint();
  return {
    collectionType:'looper-payment-collection-v2',chainId:'8453',prospectiveCoverageOnly:true,x402Confirmed:false,
    scoreEligibleExternalCount:0,ownerAttributedCount:0,credNativeSignature:false,usdcContract:BASE_USDC,
    transferTopic:TRANSFER_TOPIC,rosterHash:proof.rosterHash,rosterProofCommitment:proof.rosterProofCommitment,
    checkpointHash:buildCheckpointHash(cp),providerUrls:[...RPC_PROVIDERS],
    finalityPolicy:{blockTag:'finalized',minimumConfirmations:'20'},
    anchorBlock:{number:'200',hash:HASH_C,time:'2026-10-13T03:05:00.000Z'},collectedAt:END_TIME,
    intervals:[{fromBlock:'100',toBlock:'199',fromBlockHash:HASH_A,toBlockHash:HASH_B,fromBlockTime:INCEPTION_TIME,toBlockTime:END_TIME}],
    blockMetadata:[{number:'100',hash:HASH_A,time:INCEPTION_TIME},{number:'199',hash:HASH_B,time:END_TIME}],
    logs,receipts:logs.map(receiptFor),...overrides,
  };
}
module.exports=Object.freeze({HASH_A,HASH_B,HASH_C,TX,ACCOUNT,OTHER,OWNER,INCEPTION_TIME,END_TIME,topicAddress,roster,rosterProof,checkpoint,continuityAnchor,rawLog,rawReceipt,receiptFor,collection});
