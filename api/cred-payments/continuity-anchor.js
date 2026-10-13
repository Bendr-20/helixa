'use strict';
const {deepFreeze,canonicalStringify,domainHash}=require('./canonical');
const {BASE_CHAIN_ID,CANONICAL_LOOPER_COLLECTION,SHA256,exact,address,hash,decimal,canonicalTime}=require('./normalize');
const {normalizeCheckpoint,buildCheckpointHash,expectedFromBlock}=require('./checkpoint');

const CONTINUITY_ANCHOR_TYPE='looper-payment-continuity-anchor-v1';
const CONTINUITY_ANCHOR_FIELDS=Object.freeze([
  'continuityAnchorType','chainId','collection','canonicalRosterHash','rosterProofCommitment',
  'rosterProofProvenance','inceptionCheckpoint','predecessorArtifactHash',
  'predecessorCheckpointHash','predecessorToBlock','nextExpectedStartBlock','continuityAnchorHash',
]);
const CONTINUITY_ANCHOR_MATERIAL_FIELDS=Object.freeze(CONTINUITY_ANCHOR_FIELDS.slice(0,-1));
const INCEPTION_CHECKPOINT_FIELDS=Object.freeze([
  'checkpointType','chainId','canonicalRosterHash','rosterProofCommitment',
  'inceptionBlockNumber','inceptionBlockHash','inceptionBlockTimestamp','providerUrls','finalityPolicy',
]);

function normalizeRosterProofProvenance(input){
  exact(input,['blockNumber','blockHash','blockTimestamp','finality'],'continuity anchor roster proof provenance');
  const result={
    blockNumber:decimal(input.blockNumber,'continuity anchor proof blockNumber'),
    blockHash:hash(input.blockHash,'continuity anchor proof blockHash'),
    blockTimestamp:canonicalTime(input.blockTimestamp,'continuity anchor proof blockTimestamp'),
    finality:input.finality,
  };
  if(result.finality!=='safe'&&result.finality!=='finalized')throw new TypeError('continuity anchor roster proof finality is invalid');
  return result;
}

function normalizeInceptionCheckpoint(input){
  exact(input,INCEPTION_CHECKPOINT_FIELDS,'continuity anchor inception checkpoint');
  const checkpoint=normalizeCheckpoint({...input,previousArtifactHash:null,previousToBlock:null});
  return {
    checkpointType:checkpoint.checkpointType,
    chainId:checkpoint.chainId,
    canonicalRosterHash:checkpoint.canonicalRosterHash,
    rosterProofCommitment:checkpoint.rosterProofCommitment,
    inceptionBlockNumber:checkpoint.inceptionBlockNumber,
    inceptionBlockHash:checkpoint.inceptionBlockHash,
    inceptionBlockTimestamp:checkpoint.inceptionBlockTimestamp,
    providerUrls:[...checkpoint.providerUrls],
    finalityPolicy:{...checkpoint.finalityPolicy},
  };
}

function continuityAnchorMaterial(input){
  exact(input,Object.hasOwn(input,'continuityAnchorHash')?CONTINUITY_ANCHOR_FIELDS:CONTINUITY_ANCHOR_MATERIAL_FIELDS,'continuity anchor');
  if(input.continuityAnchorType!==CONTINUITY_ANCHOR_TYPE||input.chainId!==BASE_CHAIN_ID)throw new TypeError('continuity anchor type or chainId is invalid');
  const collection=address(input.collection,'continuity anchor collection');
  if(collection!==CANONICAL_LOOPER_COLLECTION)throw new Error('continuity anchor collection is not the canonical Looper collection');
  if(typeof input.canonicalRosterHash!=='string'||!SHA256.test(input.canonicalRosterHash)||typeof input.rosterProofCommitment!=='string'||!SHA256.test(input.rosterProofCommitment))throw new TypeError('continuity anchor roster commitments are invalid');
  const rosterProofProvenance=normalizeRosterProofProvenance(input.rosterProofProvenance);
  const inceptionCheckpoint=normalizeInceptionCheckpoint(input.inceptionCheckpoint);
  if(inceptionCheckpoint.chainId!==input.chainId||inceptionCheckpoint.canonicalRosterHash!==input.canonicalRosterHash||inceptionCheckpoint.rosterProofCommitment!==input.rosterProofCommitment)throw new Error('continuity anchor inception checkpoint does not bind its chain and roster');
  if(typeof input.predecessorArtifactHash!=='string'||!SHA256.test(input.predecessorArtifactHash)||typeof input.predecessorCheckpointHash!=='string'||!SHA256.test(input.predecessorCheckpointHash))throw new TypeError('continuity anchor predecessor hashes are invalid');
  const predecessorToBlock=decimal(input.predecessorToBlock,'continuity anchor predecessorToBlock');
  const nextExpectedStartBlock=decimal(input.nextExpectedStartBlock,'continuity anchor nextExpectedStartBlock');
  if(BigInt(nextExpectedStartBlock)!==BigInt(predecessorToBlock)+1n)throw new Error('continuity anchor next expected start block is not contiguous');
  return {continuityAnchorType:CONTINUITY_ANCHOR_TYPE,chainId:BASE_CHAIN_ID,collection,canonicalRosterHash:input.canonicalRosterHash,rosterProofCommitment:input.rosterProofCommitment,rosterProofProvenance,inceptionCheckpoint,predecessorArtifactHash:input.predecessorArtifactHash,predecessorCheckpointHash:input.predecessorCheckpointHash,predecessorToBlock,nextExpectedStartBlock};
}

function buildContinuityAnchorHash(input){return domainHash('LOOPER-PAYMENT-CONTINUITY-ANCHOR-v1\0',continuityAnchorMaterial(input));}
function normalizeContinuityAnchor(input){
  const material=continuityAnchorMaterial(input);
  if(typeof input.continuityAnchorHash!=='string'||!SHA256.test(input.continuityAnchorHash)||input.continuityAnchorHash!==domainHash('LOOPER-PAYMENT-CONTINUITY-ANCHOR-v1\0',material))throw new Error('continuity anchor commitment mismatch');
  return deepFreeze({...material,continuityAnchorHash:input.continuityAnchorHash});
}
function checkpointInceptionMaterial(checkpoint){
  return normalizeInceptionCheckpoint({
    checkpointType:checkpoint.checkpointType,chainId:checkpoint.chainId,
    canonicalRosterHash:checkpoint.canonicalRosterHash,rosterProofCommitment:checkpoint.rosterProofCommitment,
    inceptionBlockNumber:checkpoint.inceptionBlockNumber,inceptionBlockHash:checkpoint.inceptionBlockHash,
    inceptionBlockTimestamp:checkpoint.inceptionBlockTimestamp,providerUrls:checkpoint.providerUrls,
    finalityPolicy:checkpoint.finalityPolicy,
  });
}
function validateContinuityAnchor(anchorInput,checkpointInput,proof,previous){
  const anchor=normalizeContinuityAnchor(anchorInput),checkpoint=normalizeCheckpoint(checkpointInput);
  if(anchor.chainId!==checkpoint.chainId||anchor.chainId!==proof.chainId||anchor.collection!==proof.collection)throw new Error('trusted continuity anchor chain or collection mismatch');
  if(anchor.canonicalRosterHash!==proof.rosterHash||anchor.rosterProofCommitment!==proof.rosterProofCommitment||canonicalStringify(anchor.rosterProofProvenance)!==canonicalStringify(proof.blockProvenance))throw new Error('trusted continuity anchor roster proof mismatch');
  if(canonicalStringify(anchor.inceptionCheckpoint)!==canonicalStringify(checkpointInceptionMaterial(checkpoint)))throw new Error('trusted continuity anchor inception checkpoint mismatch');
  if(anchor.predecessorArtifactHash!==checkpoint.previousArtifactHash||anchor.predecessorToBlock!==checkpoint.previousToBlock||anchor.nextExpectedStartBlock!==expectedFromBlock(checkpoint))throw new Error('trusted continuity anchor predecessor or next-start mismatch');
  if(previous.artifactHash!==anchor.predecessorArtifactHash||previous.checkpointHash!==anchor.predecessorCheckpointHash||buildCheckpointHash(previous.checkpoint)!==anchor.predecessorCheckpointHash||previous.coverage.toBlock!==anchor.predecessorToBlock)throw new Error('supplied predecessor does not match the trusted continuity anchor');
  return anchor;
}

module.exports=Object.freeze({CONTINUITY_ANCHOR_TYPE,CONTINUITY_ANCHOR_FIELDS,INCEPTION_CHECKPOINT_FIELDS,buildContinuityAnchorHash,normalizeContinuityAnchor,validateContinuityAnchor});
