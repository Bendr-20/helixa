'use strict';
const {deepFreeze,domainHash}=require('./canonical');
const {BASE_CHAIN_ID,SHA256,exact,hash,decimal,canonicalTime}=require('./normalize');
const PINNED_PROVIDER_URLS=Object.freeze(['https://base-rpc.publicnode.com','https://base.drpc.org']);
const MIN_BASE_CONFIRMATIONS=20n;
function normalizeCheckpoint(input){
  exact(input,['checkpointType','chainId','canonicalRosterHash','rosterProofCommitment','inceptionBlockNumber','inceptionBlockHash','inceptionBlockTimestamp','providerUrls','finalityPolicy','previousArtifactHash','previousToBlock'],'checkpoint');
  if(input.checkpointType!=='looper-payment-checkpoint-v1'||input.chainId!==BASE_CHAIN_ID)throw new TypeError('checkpoint type or chainId is invalid');
  if(typeof input.canonicalRosterHash!=='string'||!SHA256.test(input.canonicalRosterHash)||typeof input.rosterProofCommitment!=='string'||!SHA256.test(input.rosterProofCommitment))throw new TypeError('checkpoint roster commitments are invalid');
  if(!Array.isArray(input.providerUrls)||input.providerUrls.length!==2||input.providerUrls.some((x,i)=>x!==PINNED_PROVIDER_URLS[i]))throw new Error('checkpoint providers are not exactly pinned');
  exact(input.finalityPolicy,['blockTag','minimumConfirmations'],'checkpoint finality policy');
  if(input.finalityPolicy.blockTag!=='safe'&&input.finalityPolicy.blockTag!=='finalized')throw new Error('checkpoint finality policy must use safe or finalized');
  const minimumConfirmations=decimal(input.finalityPolicy.minimumConfirmations,'minimum confirmations');if(BigInt(minimumConfirmations)<MIN_BASE_CONFIRMATIONS)throw new RangeError('minimum confirmations is below the Base minimum of 20');
  const bothNull=input.previousArtifactHash===null&&input.previousToBlock===null,bothSet=typeof input.previousArtifactHash==='string'&&SHA256.test(input.previousArtifactHash)&&typeof input.previousToBlock==='string';if(!bothNull&&!bothSet)throw new TypeError('previous artifact hash and end block must be both null or both set');
  const previousToBlock=bothNull?null:decimal(input.previousToBlock,'previousToBlock');
  return deepFreeze({checkpointType:input.checkpointType,chainId:BASE_CHAIN_ID,canonicalRosterHash:input.canonicalRosterHash,rosterProofCommitment:input.rosterProofCommitment,inceptionBlockNumber:decimal(input.inceptionBlockNumber,'inceptionBlockNumber'),inceptionBlockHash:hash(input.inceptionBlockHash,'inceptionBlockHash'),inceptionBlockTimestamp:canonicalTime(input.inceptionBlockTimestamp,'inceptionBlockTimestamp'),providerUrls:[...PINNED_PROVIDER_URLS],finalityPolicy:{blockTag:input.finalityPolicy.blockTag,minimumConfirmations},previousArtifactHash:bothNull?null:input.previousArtifactHash,previousToBlock});
}
function buildCheckpointHash(input){return domainHash('LOOPER-PAYMENT-CHECKPOINT-v1\0',normalizeCheckpoint(input));}
function expectedFromBlock(checkpoint){return checkpoint.previousToBlock===null?checkpoint.inceptionBlockNumber:(BigInt(checkpoint.previousToBlock)+1n).toString();}
module.exports=Object.freeze({PINNED_PROVIDER_URLS,MIN_BASE_CONFIRMATIONS,normalizeCheckpoint,buildCheckpointHash,expectedFromBlock});
