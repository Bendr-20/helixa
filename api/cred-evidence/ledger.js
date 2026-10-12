'use strict';

const { createHash } = require('node:crypto');
const { canonicalStringify } = require('../cred-shadow/artifact');

const LEDGER_TYPE = 'cred-evidence-ledger-v1';
const LEDGER_VERSION = '1.0.0';
const ENTRY_HASH_DOMAIN = 'CRED-EVIDENCE-LEDGER-ENTRY-v1\0';
const LEDGER_HASH_DOMAIN = 'CRED-EVIDENCE-LEDGER-v1\0';

function deepFreeze(value) { if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value; for (const child of Object.values(value)) deepFreeze(child); return Object.freeze(value); }
function compareUtf8(a,b){return Buffer.compare(Buffer.from(a,'utf8'),Buffer.from(b,'utf8'));}
function domainHash(domain,bytes){return 'sha256:'+createHash('sha256').update(domain,'utf8').update(bytes,'utf8').digest('hex');}
function entryHash(body){return domainHash(ENTRY_HASH_DOMAIN,canonicalStringify(body));}
function operationFor(submission){
  const refs=[['CORRECTION',submission.correctionOf],['REVOCATION',submission.revocationOf],['REMEDIATION',submission.remediationOf],['DISPUTE',submission.disputeOf]].filter(([,value])=>value!==null);
  if(refs.length>1)throw new Error('submission has multiple lifecycle references');
  if(refs.length===0)return {operation:'INGEST',targetSubmissionId:null,disputeDisposition:null};
  let [operation,targetSubmissionId]=refs[0];
  let disputeDisposition=null;
  if(operation==='DISPUTE'){
    const outcome=submission.nativePayload?.outcome;
    if(outcome==='accepted'){operation='DISPUTE_RESOLVE';disputeDisposition='upheld';}
    else if(outcome==='rejected'){operation='DISPUTE_RESOLVE';disputeDisposition='dismissed';}
    else operation='DISPUTE_OPEN';
  }
  return {operation,targetSubmissionId,disputeDisposition};
}
function orderResults(results){
  if(!Array.isArray(results)||results.length===0)throw new TypeError('normalized results must be a nonempty array');
  const pending=[...results].sort((a,b)=>compareUtf8(a.verified.submission.receivedAt+'\0'+a.verified.submission.submissionId,b.verified.submission.receivedAt+'\0'+b.verified.submission.submissionId));
  const allIds=new Set(pending.map(item=>item.verified.submission.submissionId));
  if(allIds.size!==pending.length)throw new Error('duplicate submissionId in ledger input');
  const emitted=new Set(),ordered=[];
  while(pending.length){
    const index=pending.findIndex(item=>{const target=operationFor(item.verified.submission).targetSubmissionId;return target===null||emitted.has(target);});
    if(index<0){const missing=operationFor(pending[0].verified.submission).targetSubmissionId;if(!allIds.has(missing))throw new Error('lifecycle reference targets unknown submission '+missing);throw new Error('cyclic lifecycle references');}
    const [item]=pending.splice(index,1);ordered.push(item);emitted.add(item.verified.submission.submissionId);
  }
  return ordered;
}
function buildEvidenceLedger(registryBundle,normalizedResults){
  const registryHash=registryBundle.registryHash;
  if(typeof registryHash!=='string')throw new TypeError('registry bundle hash is required');
  const ordered=orderResults(normalizedResults),entries=[],bySubmission=new Map();
  let previousEntryHash=null;
  for(let index=0;index<ordered.length;index+=1){
    const result=ordered[index],submission=result.verified.submission,op=operationFor(submission);
    if(result.verified.registryHash!==registryHash)throw new Error('normalized result registry hash does not match ledger registry');
    if(result.record!==null&&(result.record.transformationHash!==result.transformationHash||result.record.scoreEligible!==result.scoreEligible||result.record.status!==result.lifecycleState))throw new Error('normalized result is internally inconsistent');
    if(result.record===null&&(result.transformationHash!==null||result.scoreEligible))throw new Error('recordless normalized result is internally inconsistent');
    const target=op.targetSubmissionId===null?null:bySubmission.get(op.targetSubmissionId);
    if(op.targetSubmissionId!==null&&!target)throw new Error('lifecycle reference must target an earlier ledger submission');
    if(target&&!target.evidenceId)throw new Error('lifecycle reference target has no normalized evidence record');
    const body={
      sequence:index,
      previousEntryHash,
      submissionId:submission.submissionId,
      submissionHash:result.verified.submissionHash,
      registryHash:result.verified.registryHash,
      receivedAt:submission.receivedAt,
      payloadVisibility:submission.payloadVisibility,
      nativePayloadHash:submission.nativePayloadHash,
      operation:op.operation,
      targetSubmissionId:op.targetSubmissionId,
      targetEvidenceId:target?.evidenceId||null,
      disputeDisposition:op.disputeDisposition,
      evidenceId:result.record?.evidenceId||null,
      lifecycleState:op.operation==='INGEST'||op.operation==='CORRECTION'?result.lifecycleState:op.operation==='REVOCATION'?'REVOKED':op.operation==='REMEDIATION'?'REMEDIATED':op.operation==='DISPUTE_OPEN'?'DISPUTED_PENDING':'DISPUTED_RESOLVED',
      scoreEligible:(op.operation==='INGEST'||op.operation==='CORRECTION')&&result.scoreEligible,
      adapterManifestHash:result.adapterManifestHash,
      transformationHash:result.transformationHash,
      reasonCodes:result.reasonCodes,
      record:result.record,
    };
    const hash=entryHash(body),entry=deepFreeze({...body,entryHash:hash});
    entries.push(entry);bySubmission.set(submission.submissionId,entry);previousEntryHash=hash;
  }
  const material={ledgerType:LEDGER_TYPE,ledgerVersion:LEDGER_VERSION,generatedAt:registryBundle.registry.generatedAt,registryHash,entries,headHash:previousEntryHash};
  const ledgerHash=domainHash(LEDGER_HASH_DOMAIN,canonicalStringify(material));
  const ledger=deepFreeze({...material,ledgerHash});
  materializeLedger(ledger);
  return ledger;
}
function verifyEvidenceLedger(ledger){
  if(!ledger||ledger.ledgerType!==LEDGER_TYPE||ledger.ledgerVersion!==LEDGER_VERSION||!Array.isArray(ledger.entries))throw new TypeError('ledger envelope is invalid');
  let previous=null;
  for(let index=0;index<ledger.entries.length;index+=1){const entry=ledger.entries[index];if(entry.sequence!==index||entry.previousEntryHash!==previous)throw new Error('ledger hash chain is broken');const {entryHash:claimed,...body}=entry;const actual=entryHash(body);if(actual!==claimed)throw new Error('ledger entry hash mismatch');previous=claimed;}
  if(ledger.headHash!==previous)throw new Error('ledger head hash mismatch');
  const {ledgerHash:claimed,...material}=ledger;const actual=domainHash(LEDGER_HASH_DOMAIN,canonicalStringify(material));if(actual!==claimed)throw new Error('ledger hash mismatch');
  return true;
}
function materializeLedger(ledger){
  verifyEvidenceLedger(ledger);
  const states=new Map(),submissionToEvidence=new Map(),openDisputes=new Set(),remediatedEvidenceIds=new Set();
  function target(entry){const state=states.get(entry.targetEvidenceId);if(!state)throw new Error('lifecycle transition targets unknown evidence');return state;}
  for(const entry of ledger.entries){
    if(entry.operation==='INGEST'){
      if(entry.record){states.set(entry.record.evidenceId,{record:entry.record,status:entry.record.status,scoreEligible:entry.record.scoreEligible,sourceSubmissionId:entry.submissionId});submissionToEvidence.set(entry.submissionId,entry.record.evidenceId);}
      continue;
    }
    const prior=target(entry);
    if(entry.operation==='CORRECTION'){
      if(new Set(['CORRECTED','REVOKED','REMEDIATED']).has(prior.status))throw new Error('invalid correction transition from '+prior.status);
      prior.status='CORRECTED';prior.scoreEligible=false;
      if(!entry.record)throw new Error('correction requires a normalized replacement record');
      states.set(entry.record.evidenceId,{record:entry.record,status:entry.record.status,scoreEligible:entry.record.scoreEligible,sourceSubmissionId:entry.submissionId});submissionToEvidence.set(entry.submissionId,entry.record.evidenceId);
    }else if(entry.operation==='REVOCATION'){
      if(new Set(['CORRECTED','REVOKED','REMEDIATED']).has(prior.status))throw new Error('invalid revocation transition from '+prior.status);prior.status='REVOKED';prior.scoreEligible=false;
    }else if(entry.operation==='REMEDIATION'){
      if(prior.record.direction!=='negative')throw new Error('only negative evidence can be remediated');if(new Set(['CORRECTED','REVOKED']).has(prior.status))throw new Error('invalid remediation transition from '+prior.status);remediatedEvidenceIds.add(entry.targetEvidenceId);
    }else if(entry.operation==='DISPUTE_OPEN'){
      if(openDisputes.has(entry.targetEvidenceId))throw new Error('evidence already has an open dispute');if(new Set(['CORRECTED','REVOKED','REMEDIATED']).has(prior.status))throw new Error('terminal evidence cannot be disputed');openDisputes.add(entry.targetEvidenceId);
    }else if(entry.operation==='DISPUTE_RESOLVE'){
      if(!openDisputes.has(entry.targetEvidenceId))throw new Error('dispute resolution has no open dispute');openDisputes.delete(entry.targetEvidenceId);if(entry.disputeDisposition==='upheld'){prior.status='REVOKED';prior.scoreEligible=false;}
    }else throw new Error('unknown ledger operation');
  }
  const records=[...states.values()].map(state=>deepFreeze({...state.record,status:state.status,scoreEligible:state.scoreEligible})).sort((a,b)=>compareUtf8(a.evidenceId,b.evidenceId));
  return deepFreeze({records,openDisputes:[...openDisputes].sort(compareUtf8),remediatedEvidenceIds:[...remediatedEvidenceIds].sort(compareUtf8)});
}
module.exports=Object.freeze({LEDGER_TYPE,LEDGER_VERSION,ENTRY_HASH_DOMAIN,LEDGER_HASH_DOMAIN,buildEvidenceLedger,verifyEvidenceLedger,materializeLedger});
