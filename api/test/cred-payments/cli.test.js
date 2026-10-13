'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {parseArgs:parseCollect}=require('../../scripts/collect-looper-payments');
const {parseArgs:parseBuild,main:buildMain}=require('../../scripts/build-looper-payment-observer');
const {buildObservationArtifact,buildCheckpointHash}=require('../../cred-payments');
const {rosterProof,checkpoint,continuityAnchor,collection}=require('./helpers');
function setup(t){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cred-payments-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const rp=path.join(dir,'roster-proof.json'),ck=path.join(dir,'checkpoint.json'),cp=path.join(dir,'collection.json');
  fs.writeFileSync(rp,JSON.stringify(rosterProof()));fs.writeFileSync(ck,JSON.stringify(checkpoint()));fs.writeFileSync(cp,JSON.stringify(collection()));
  return {dir,rp,ck,cp};
}
test('CLI parsers accept only exact hardened flags and canonical block strings',()=>{
  assert.deepEqual(parseCollect(['--roster-proof','r','--checkpoint','k','--from-block','100','--to-block','199','--output','o']),{rosterProof:'r',checkpoint:'k',fromBlock:'100',toBlock:'199',output:'o'});
  assert.deepEqual(parseBuild(['--roster-proof','r','--checkpoint','k','--collection','c','--previous-artifact','p','--continuity-anchor','a','--output','o']),{rosterProof:'r',checkpoint:'k',collection:'c',previousArtifact:'p',continuityAnchor:'a',output:'o'});
  assert.throws(()=>parseCollect(['--roster-proof','r','--checkpoint','k','--from-block','0100','--to-block','199','--output','o']),/canonical/);
  assert.throws(()=>parseBuild(['--roster-proof','r','--checkpoint','k','--collection','c','--output','o','--wat']),/unknown flag/);
  assert.throws(()=>parseBuild(['--roster-proof','r','--roster-proof','x','--checkpoint','k','--collection','c','--output','o']),/duplicate/);
});
test('offline builder writes deterministic canonical mode-0600 output',t=>{
  const f=setup(t),a=path.join(f.dir,'a.json'),b=path.join(f.dir,'b.json');
  const args=output=>['--roster-proof',f.rp,'--checkpoint',f.ck,'--collection',f.cp,'--output',output];
  const ra=buildMain(args(a),{now:Date.parse('2026-10-13T04:00:00.000Z')}),rb=buildMain(args(b),{now:Date.parse('2026-10-13T04:00:00.000Z')});
  assert.equal(fs.readFileSync(a,'utf8'),fs.readFileSync(b,'utf8'));assert.equal(fs.statSync(a).mode&0o777,0o600);
  const artifact=JSON.parse(fs.readFileSync(a));assert.equal(artifact.prospectiveCoverageOnly,true);assert.equal(artifact.x402Confirmed,false);
  assert.equal(artifact.scoreEligibleExternalCount,0);assert.equal(artifact.ownerAttributedCount,0);assert.equal(artifact.credNativeSignature,false);
  assert.equal(artifact.rosterProofCommitment,rosterProof().rosterProofCommitment);assert.equal(ra.artifactHash,rb.artifactHash);
});
test('offline CLI requires and accepts an independently supplied trusted anchor for follow-ups',t=>{
  const f=setup(t),rp=rosterProof(),firstCheckpoint=checkpoint(),first=buildObservationArtifact(rp,firstCheckpoint,collection(),{now:Date.parse('2026-10-13T04:00:00.000Z')});
  const followCheckpoint=checkpoint({previousArtifactHash:first.artifactHash,previousToBlock:'199'}),fromHash='0x'+'ee'.repeat(32),toHash='0x'+'ff'.repeat(32);
  const followCollection=collection([],{checkpointHash:buildCheckpointHash(followCheckpoint),anchorBlock:{number:'400',hash:'0x'+'11'.repeat(32),time:'2026-10-13T03:12:00.000Z'},collectedAt:'2026-10-13T03:08:18.000Z',intervals:[{fromBlock:'200',toBlock:'299',fromBlockHash:fromHash,toBlockHash:toHash,fromBlockTime:'2026-10-13T03:05:00.000Z',toBlockTime:'2026-10-13T03:08:18.000Z'}],blockMetadata:[{number:'200',hash:fromHash,time:'2026-10-13T03:05:00.000Z'},{number:'299',hash:toHash,time:'2026-10-13T03:08:18.000Z'}],logs:[],receipts:[]});
  fs.writeFileSync(f.ck,JSON.stringify(followCheckpoint));fs.writeFileSync(f.cp,JSON.stringify(followCollection));
  const previous=path.join(f.dir,'previous.json'),anchor=path.join(f.dir,'anchor.json'),missingOutput=path.join(f.dir,'missing.json'),output=path.join(f.dir,'follow.json');fs.writeFileSync(previous,JSON.stringify(first));fs.writeFileSync(anchor,JSON.stringify(continuityAnchor(first)));
  const base=['--roster-proof',f.rp,'--checkpoint',f.ck,'--collection',f.cp,'--previous-artifact',previous];
  assert.throws(()=>buildMain([...base,'--output',missingOutput],{now:Date.parse('2026-10-13T04:00:00.000Z')}),/trusted continuity anchor is required/);assert.equal(fs.existsSync(missingOutput),false);
  const result=buildMain([...base,'--continuity-anchor',anchor,'--output',output],{now:Date.parse('2026-10-13T04:00:00.000Z')});assert.equal(result.continuityAnchorHash,continuityAnchor(first).continuityAnchorHash);assert.equal(JSON.parse(fs.readFileSync(output)).coverage.fromBlock,'200');
});
test('output handling refuses overwrite, symlink parents, non-json, and unsafe input symlinks',t=>{
  const f=setup(t),args=output=>['--roster-proof',f.rp,'--checkpoint',f.ck,'--collection',f.cp,'--output',output],output=path.join(f.dir,'out.json');
  fs.writeFileSync(output,'keep');assert.throws(()=>buildMain(args(output)),/already exists/);assert.equal(fs.readFileSync(output,'utf8'),'keep');
  assert.throws(()=>buildMain(args(path.join(f.dir,'out.txt'))),/.json/);
  const real=path.join(f.dir,'real');fs.mkdirSync(real);const link=path.join(f.dir,'link');fs.symlinkSync(real,link,'dir');
  assert.throws(()=>buildMain(args(path.join(link,'out.json'))),/symlink/);
  const linkedProof=path.join(f.dir,'linked.json');fs.symlinkSync(f.rp,linkedProof);
  assert.throws(()=>buildMain(['--roster-proof',linkedProof,'--checkpoint',f.ck,'--collection',f.cp,'--output',path.join(f.dir,'new.json')]),/symlink/);
});
