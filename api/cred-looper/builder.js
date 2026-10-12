'use strict';

const { createHash, createPrivateKey, createPublicKey, sign, KeyObject } = require('node:crypto');
const { canonicalStringify } = require('../cred-shadow/artifact');
const { buildRegistryBundle, computeEmpPolicyHash, computeOntologyHash } = require('../cred-evidence/registry');
const { SIGNATURE_DOMAIN, buildNativePayloadHash, buildSubmissionSigningBytes } = require('../cred-evidence/submission');
const { compileEvidenceBatch } = require('../cred-evidence/compiler');
const { normalizeLooperRoster, buildRosterHash, normalizeSnapshot, buildSnapshotHash } = require('./formats');

const PROVIDER_ID = 'helixa_looper_base';
const CONTROL_GROUP_ID = 'helixa_looper_base';
const KEY_ID = 'helixa_looper_ed25519_v1';
const REGISTRY_VERSION = 'looper-cred-shadow-v1';
const CORPUS_TYPE = 'looper-cred-shadow-corpus-v1';
const NODE_DOMAIN = 'CRED-EMP-NODE-v1' + String.fromCharCode(0);
const CORPUS_HASH_DOMAIN = 'LOOPER-CRED-SHADOW-CORPUS-v1' + String.fromCharCode(0);
const SUBMISSIONS_HASH_DOMAIN = 'LOOPER-CRED-SUBMISSIONS-v1' + String.fromCharCode(0);
const EDGE_PROOF_DOMAIN = 'LOOPER-BASE-IDENTITY-EDGE-v1' + String.fromCharCode(0);

function compareUtf8(a,b){return Buffer.compare(Buffer.from(a,'utf8'),Buffer.from(b,'utf8'));}
function domainHash(domain,value){return 'sha256:'+createHash('sha256').update(domain,'utf8').update(typeof value==='string'?value:canonicalStringify(value),'utf8').digest('hex');}
function deepFreeze(value){if(value===null||typeof value!=='object'||Object.isFrozen(value))return value;for(const child of Object.values(value))deepFreeze(child);return Object.freeze(value);}
function privateKey(input){
  let key=input;
  if (!(key instanceof KeyObject)) {
    if (!Buffer.isBuffer(key) && typeof key!=='string') throw new TypeError('private key must be local key bytes or a KeyObject');
    try { key=createPrivateKey(key); } catch (first) { try { key=createPrivateKey({key,format:'der',type:'pkcs8'}); } catch { throw new TypeError('private key must be an Ed25519 PEM or PKCS8 key'); } }
  }
  if (key.type!=='private'||key.asymmetricKeyType!=='ed25519') throw new TypeError('private key must be Ed25519');
  return key;
}
function publicKeyRaw(keyInput){
  const der=createPublicKey(privateKey(keyInput)).export({format:'der',type:'spki'});
  const prefix=Buffer.from('302a300506032b6570032100','hex');
  if(der.length!==44||!der.subarray(0,12).equals(prefix))throw new TypeError('Ed25519 public key encoding is invalid');
  return der.subarray(12).toString('base64url');
}
function shortHash(domain,value,length=32){return createHash('sha256').update(domain,'utf8').update(canonicalStringify(value),'utf8').digest('hex').slice(0,length);}
function looperCoordinate(roster,looper){return {namespace:'looper',network:'eip155:8453',value:roster.collection+'/'+looper.tokenId};}
function evmCoordinate(value){return {namespace:'evm',network:'eip155:8453',value};}
function proofHash(snapshot,kind,looper){return domainHash(EDGE_PROOF_DOMAIN,{blockHash:snapshot.blockHash,blockNumber:snapshot.blockNumber,kind,tokenId:looper.tokenId,account:looper.account,owner:looper.owner});}

function buildPolicies(){
  const specs=[['emp_looper_financial','financial',365,730],['emp_looper_identity','identity',365,730],['emp_looper_onchain','onchain',365,730]];
  const policies=specs.map(([empId,evidenceFamily,positiveHalfLifeDays,negativeHalfLifeDays],registryLeafIndex)=>({
    empId,empVersion:'1.0.0',policyHash:null,registryLeafIndex,registryProof:[],evidenceFamily,positiveHalfLifeDays,negativeHalfLifeDays,
    correlationWindowSeconds:7776000,clusterCapMicroEu:'2000000',providerBucket:{capacityMicroEu:'4000000',refillSeconds:7776000},schemaBucket:{capacityMicroEu:'6000000',refillSeconds:7776000},p4Bucket:{capacityMicroEu:'1000000',refillSeconds:7776000},
  }));
  for(const policy of policies)policy.policyHash=computeEmpPolicyHash(policy);
  const leaves=policies.map(policy=>Buffer.from(policy.policyHash.slice(7),'hex')); leaves.push(Buffer.from(leaves[2]));
  const node=(left,right)=>createHash('sha256').update(NODE_DOMAIN,'utf8').update(Buffer.concat([left,right])).digest();
  const p01=node(leaves[0],leaves[1]),p23=node(leaves[2],leaves[3]),root=node(p01,p23);
  policies[0].registryProof=[{side:'right',hash:'sha256:'+leaves[1].toString('hex')},{side:'right',hash:'sha256:'+p23.toString('hex')}];
  policies[1].registryProof=[{side:'left',hash:'sha256:'+leaves[0].toString('hex')},{side:'right',hash:'sha256:'+p23.toString('hex')}];
  policies[2].registryProof=[{side:'right',hash:'sha256:'+leaves[3].toString('hex')},{side:'left',hash:'sha256:'+p01.toString('hex')}];
  return {policies,root:'sha256:'+root.toString('hex')};
}
function buildOntology(){
  const ontology={ontologyId:'cred-evidence-ontology',ontologyVersion:'cred-ontology-1.0.0',ontologyHash:null,categories:['financial','identity','onchain','operational'],evidenceFamilies:['comparative','financial','identity','onchain','operational','severe-critical'],domains:['coding','payments','research','security','trading'],coordinateNamespaces:['did','endpoint','erc8004','evm','looper','platform','solana','ubid'],relationshipTypes:['controlled-by','identifies','operated-by']};
  ontology.ontologyHash=computeOntologyHash(ontology);return ontology;
}
function buildSchemas(){
  const common={schemaVersion:'1.0.0',adapterId:'looper-base-proof',adapterVersion:'1.0.0',allowedDirections:['positive'],allowedProofClasses:['P1'],materialityMapping:[{nativeValue:'low',materiality:'micro'}],privacyClass:'public-or-committed',correctionPolicy:'append-only-reference',finalityPolicy:'final-only',empVersion:'1.0.0',subjectCoordinateNamespaces:['evm','looper']};
  return [
    {...common,schemaId:'looper_financial',schemaFamilyId:'looper_base_financial',eventType:'looper-wallet-balance',evidenceFamily:'financial',category:'financial',empId:'emp_looper_financial',allowedDomains:['payments']},
    {...common,schemaId:'looper_identity',schemaFamilyId:'looper_base_identity',eventType:'looper-account-binding',evidenceFamily:'identity',category:'identity',empId:'emp_looper_identity',allowedDomains:['security']},
    {...common,schemaId:'looper_onchain',schemaFamilyId:'looper_base_onchain',eventType:'looper-account-callable',evidenceFamily:'onchain',category:'onchain',empId:'emp_looper_onchain',allowedDomains:['security']},
  ];
}
function validatedInputs(rosterInput,snapshotInput){
  const roster=normalizeLooperRoster(rosterInput),snapshot=normalizeSnapshot(snapshotInput);
  if(snapshot.rosterHash!==buildRosterHash(roster))throw new Error('snapshot roster hash does not match roster');
  if(snapshot.chainId!==roster.chainId)throw new Error('snapshot chain does not match roster');
  if(snapshot.accountProofs.length!==roster.loopers.length)throw new Error('snapshot must contain one complete account proof per Looper');
  if(snapshot.balances.length!==roster.loopers.length)throw new Error('snapshot must contain one complete balance per Looper');
  const proofs=new Map(),balances=new Map();
  for(const proof of snapshot.accountProofs){if(proofs.has(proof.tokenId))throw new Error('snapshot contains duplicate account proof');proofs.set(proof.tokenId,proof);}
  for(const balance of snapshot.balances){if(balances.has(balance.tokenId))throw new Error('snapshot contains duplicate balance');balances.set(balance.tokenId,balance);}
  for(const looper of roster.loopers){
    const proof=proofs.get(looper.tokenId),balance=balances.get(looper.tokenId); if(!proof)throw new Error('snapshot lacks complete account proof for token '+looper.tokenId);if(!balance)throw new Error('snapshot lacks complete balance for token '+looper.tokenId);
    if(proof.account!==looper.account||proof.owner!==looper.owner||proof.tokenBinding.chainId!==roster.chainId||proof.tokenBinding.collection!==roster.collection||proof.tokenBinding.tokenId!==looper.tokenId)throw new Error('snapshot account proof does not match roster');
    if(balance.address!==looper.account)throw new Error('snapshot balance address does not match roster');
  }
  return {roster,snapshot,proofs,balances};
}

function buildLooperRegistry(rosterInput,snapshotInput,keyInput){
  const {roster,snapshot}=validatedInputs(rosterInput,snapshotInput),generatedAt=snapshot.observedAt,schemas=buildSchemas(),{policies,root}=buildPolicies(),ontology=buildOntology();
  const subjects=[],identityEdges=[],actorEpochs=[];
  for(const looper of roster.loopers){
    const subjectId='looper_'+looper.tokenId,epochId='looper_epoch_'+looper.tokenId,token=looperCoordinate(roster,looper),account=evmCoordinate(looper.account);
    subjects.push({subjectId,state:'active',currentActorEpochId:epochId,coordinates:[token,account]});
    identityEdges.push(
      {edgeId:'looper_token_'+looper.tokenId,issuerId:'helixa_looper_issuer',subjectId,coordinate:token,relationshipType:'identifies',validFrom:generatedAt,validUntil:null,verifiedAt:generatedAt,revokedAt:null,proofHash:proofHash(snapshot,'token-binding',looper)},
      {edgeId:'looper_account_'+looper.tokenId,issuerId:'helixa_looper_issuer',subjectId,coordinate:account,relationshipType:'controlled-by',validFrom:generatedAt,validUntil:null,verifiedAt:generatedAt,revokedAt:null,proofHash:proofHash(snapshot,'account-code',looper)}
    );
    actorEpochs.push({actorEpochId:epochId,subjectId,startsAt:generatedAt,endsAt:null,controllerCoordinates:[account],transitionHash:null,encumbrance:'clear',assumptionOf:null});
  }
  const registry={registryType:'cred-evidence-registry-v1',canonicalSerializationVersion:'cred-cjson-v1',registryVersion:REGISTRY_VERSION,generatedAt,previousRegistryHash:null,
    versions:{providerRegistry:'looper-providers-v1',schemaRegistry:'looper-schemas-v1',identityGraph:'looper-identity-v1',empRegistry:'looper-emps-v1',ontology:ontology.ontologyVersion},roots:{empRegistryRoot:root,ontologyHash:ontology.ontologyHash},
    providers:[{providerId:PROVIDER_ID,controlGroupId:CONTROL_GROUP_ID,state:'active',stateEpochs:[{state:'active',validFrom:generatedAt,validUntil:null}],keyEpochs:[{keyId:KEY_ID,suite:'Ed25519',publicKey:publicKeyRaw(keyInput),validFrom:generatedAt,validUntil:null,revokedAt:null}],schemaAuthorizations:schemas.map(schema=>({schemaId:schema.schemaId,schemaVersion:schema.schemaVersion,validFrom:generatedAt,validUntil:null})),evidenceFamilies:['financial','identity','onchain'],categories:['financial','identity','onchain'],domains:['payments','security'],ratePolicy:{windowSeconds:'3600',maxEvents:'4096'},volumePolicy:{windowSeconds:'86400',maxEvents:'10000'},influencePolicyRef:'influence-standard-v1'}],
    schemas,identityIssuers:[{issuerId:'helixa_looper_issuer',state:'active',validFrom:generatedAt,validUntil:null,authorizedCoordinateNamespaces:['evm','looper'],authorizedRelationshipTypes:['controlled-by','identifies']}],subjects,identityEdges,actorEpochs,empPolicies:policies,ontology};
  return buildRegistryBundle(registry).registry;
}
function payloadFor(category,roster,snapshot,looper,proof,balance){
  const proofType={identity:'account-binding',onchain:'account-callable',financial:'wallet-balance'}[category],domain=category==='financial'?'payments':'security';
  const correlationKey='looper_base_'+shortHash('correlation',{tokenId:looper.tokenId,blockHash:snapshot.blockHash});
  return {proofType,chainId:roster.chainId,blockNumber:snapshot.blockNumber,blockHash:snapshot.blockHash,account:looper.account,owner:looper.owner,collection:roster.collection,tokenId:looper.tokenId,codeHash:proof.codeHash,ethWei:balance.ethWei,liquidCred:balance.liquidCred,stakedCred:balance.stakedCred,direction:'positive',materialityNative:'low',proofClass:'P1',domain,finality:'final',incidentKey:'looper_'+category+'_'+shortHash('incident',{tokenId:looper.tokenId,blockHash:snapshot.blockHash,category}),correlationKey,proofVerified:true};
}
function signedSubmission(bundle,category,roster,snapshot,looper,proof,balance,key){
  const payload=payloadFor(category,roster,snapshot,looper,proof,balance),idMaterial={category,tokenId:looper.tokenId,blockHash:snapshot.blockHash};
  const submission={submissionType:'cred-native-submission-v1',registryVersion:bundle.registry.registryVersion,submissionId:'looper_'+category+'_'+shortHash('submission',idMaterial),lane:'approved',providerId:PROVIDER_ID,submitterId:PROVIDER_ID,providerEventId:'looper_event_'+shortHash('event',idMaterial),schemaId:'looper_'+category,schemaVersion:'1.0.0',occurredAt:snapshot.observedAt,observedAt:snapshot.observedAt,receivedAt:snapshot.observedAt,subjectCoordinates:[looperCoordinate(roster,looper),evmCoordinate(looper.account)],claimedActorEpochId:'looper_epoch_'+looper.tokenId,payloadVisibility:'public',nativePayload:payload,nativePayloadHash:buildNativePayloadHash(payload),proofRefs:[],signatureSuite:'Ed25519',keyId:KEY_ID,signature:null,correctionOf:null,revocationOf:null,remediationOf:null,disputeOf:null};
  const message=Buffer.concat([Buffer.from(SIGNATURE_DOMAIN,'utf8'),Buffer.from(buildSubmissionSigningBytes(submission),'utf8')]);submission.signature=sign(null,message,key).toString('base64url');return submission;
}
function buildLooperSubmissions(registryInput,rosterInput,snapshotInput,keyInput){
  const bundle=buildRegistryBundle(registryInput&&registryInput.registry?registryInput.registry:registryInput),{roster,snapshot,proofs,balances}=validatedInputs(rosterInput,snapshotInput),key=privateKey(keyInput);
  if(bundle.registry.registryVersion!==REGISTRY_VERSION)throw new Error('registry is not a Looper shadow registry');
  if(bundle.registry.providers[0].keyEpochs[0].publicKey!==publicKeyRaw(key))throw new Error('private key does not match registry public key');
  const submissions=[];
  for(const looper of roster.loopers){const proof=proofs.get(looper.tokenId),balance=balances.get(looper.tokenId);submissions.push(signedSubmission(bundle,'identity',roster,snapshot,looper,proof,balance,key),signedSubmission(bundle,'onchain',roster,snapshot,looper,proof,balance,key));if(BigInt(balance.ethWei)>0n||BigInt(balance.liquidCred)>0n||BigInt(balance.stakedCred)>0n)submissions.push(signedSubmission(bundle,'financial',roster,snapshot,looper,proof,balance,key));}
  submissions.sort((a,b)=>compareUtf8(a.submissionId,b.submissionId));return deepFreeze(submissions);
}
function buildLooperCorpus(rosterInput,snapshotInput,keyInput){
  const {roster,snapshot}=validatedInputs(rosterInput,snapshotInput),registry=buildLooperRegistry(roster,snapshot,keyInput),registryBundle=buildRegistryBundle(registry),submissions=buildLooperSubmissions(registryBundle,roster,snapshot,keyInput),compiled=compileEvidenceBatch(registryBundle,submissions,{computedAt:snapshot.observedAt});
  const ratings={},reasonCodeCounts={};for(const item of compiled.replay.snapshots){const rating=item.candidate.ratingStatus;ratings[rating]=(ratings[rating]||0)+1;for(const reason of item.reasonCodes)reasonCodeCounts[reason]=(reasonCodeCounts[reason]||0)+1;}
  const categories={financial:0,identity:0,onchain:0};for(const row of submissions)categories[row.schemaId.slice('looper_'.length)]+=1;
  const report={subjectCount:roster.loopers.length,submissionCount:submissions.length,categoryCounts:categories,ratingDistribution:ratings,reasonCodeCounts,unratedSubjectCount:ratings.UNRATED||0};
  if(report.unratedSubjectCount!==report.subjectCount)throw new Error('shadow corpus unexpectedly produced a rated subject');
  const material={corpusType:CORPUS_TYPE,rosterHash:buildRosterHash(roster),snapshotHash:buildSnapshotHash(snapshot),registryBundle,submissionsHash:domainHash(SUBMISSIONS_HASH_DOMAIN,submissions),submissions,compiled,report};
  const canonicalBytes=canonicalStringify(material),corpusHash=domainHash(CORPUS_HASH_DOMAIN,canonicalBytes);return deepFreeze({...material,canonicalBytes,corpusHash});
}

module.exports=Object.freeze({PROVIDER_ID,CONTROL_GROUP_ID,KEY_ID,REGISTRY_VERSION,CORPUS_TYPE,publicKeyRaw,buildLooperRegistry,buildLooperSubmissions,buildLooperCorpus});
