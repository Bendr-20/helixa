'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { generateKeyPairSync } = require('node:crypto');
const { buildRosterHash } = require('../../cred-looper/collector');
const { parseArgs: parseBuildArgs } = require('../../scripts/build-looper-cred-corpus');
const { parseArgs: parseCollectArgs } = require('../../scripts/collect-looper-base-proofs');
const API_ROOT = path.resolve(__dirname, '../..');
const BUILD = path.join(API_ROOT, 'scripts/build-looper-cred-corpus.js');
const COLLECTION='0x1111111111111111111111111111111111111111',ACCOUNT='0x2222222222222222222222222222222222222222',OWNER='0x3333333333333333333333333333333333333333';
function roster(){return {rosterType:'looper-base-roster-v1',chainId:'8453',collection:COLLECTION,loopers:[{tokenId:'7',account:ACCOUNT,owner:OWNER}]};}
function snapshot(){return {snapshotType:'looper-base-proof-snapshot-v1',chainId:'8453',blockNumber:'99',blockHash:'0x'+'ab'.repeat(32),observedAt:'2026-10-12T20:00:00.000Z',providers:[{providerId:'base_a'},{providerId:'base_b'}],assets:{liquidCredContract:'0x4444444444444444444444444444444444444444',stakingVaultContract:'0x5555555555555555555555555555555555555555',stakingTokenContract:'0x4444444444444444444444444444444444444444'},rosterHash:buildRosterHash(roster()),accountProofs:[{tokenId:'7',account:ACCOUNT,owner:OWNER,tokenBinding:{chainId:'8453',collection:COLLECTION,tokenId:'7'},codeHash:'sha256:'+'cd'.repeat(32)}],balances:[{tokenId:'7',address:ACCOUNT,ethWei:'0',liquidCred:'1',stakedCred:'0'}]};}
function temp(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'looper-corpus-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
function files(t){const dir=temp(t),rosterPath=path.join(dir,'roster.json'),snapshotPath=path.join(dir,'snapshot.json'),keyPath=path.join(dir,'ed25519.pem'),output=path.join(dir,'corpus.json');fs.writeFileSync(rosterPath,JSON.stringify(roster()));fs.writeFileSync(snapshotPath,JSON.stringify(snapshot()));const {privateKey}=generateKeyPairSync('ed25519');fs.writeFileSync(keyPath,privateKey.export({format:'pem',type:'pkcs8'}),{mode:0o600});return {dir,rosterPath,snapshotPath,keyPath,output};}
test('parses only exact collector and offline builder flags',()=>{
  assert.deepEqual(parseCollectArgs(['--roster','r','--providers','p','--assets','a','--output','o']),{roster:'r',providers:'p',assets:'a',output:'o'});
  assert.deepEqual(parseBuildArgs(['--roster','r','--snapshot','s','--private-key','k','--output','o']),{roster:'r',snapshot:'s',privateKey:'k',output:'o'});
  assert.throws(()=>parseBuildArgs(['--roster','r','--snapshot','s','--private-key','k','--output','o','--wat']),/unknown flag/);
  assert.throws(()=>parseCollectArgs(['--roster','r','--providers','p','--output','o']),/--assets is required/);
});
test('offline CLI writes a deterministic mode-600 compiled corpus without private key material',t=>{
  const f=files(t);let run=spawnSync(process.execPath,[BUILD,'--roster',f.rosterPath,'--snapshot',f.snapshotPath,'--private-key',f.keyPath,'--output',f.output],{cwd:API_ROOT,encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);const receipt=JSON.parse(run.stdout),body=fs.readFileSync(f.output,'utf8'),parsed=JSON.parse(body);
  assert.equal(fs.statSync(f.output).mode&0o777,0o600);assert.equal(parsed.corpusType,'looper-cred-shadow-corpus-v1');assert.equal(parsed.compiled.compilerType,'cred-evidence-compiler-output-v1');assert.equal(receipt.unratedSubjectCount,1);assert.equal(body.includes('PRIVATE KEY'),false);
  const second=path.join(f.dir,'corpus-2.json');run=spawnSync(process.execPath,[BUILD,'--roster',f.rosterPath,'--snapshot',f.snapshotPath,'--private-key',f.keyPath,'--output',second],{cwd:API_ROOT,encoding:'utf8'});assert.equal(run.status,0,run.stderr);assert.equal(fs.readFileSync(second,'utf8'),body);
});
test('offline CLI refuses overwrite, symlink traversal, loose private-key permissions, and malformed snapshots',t=>{
  const f=files(t);fs.writeFileSync(f.output,'keep');let run=spawnSync(process.execPath,[BUILD,'--roster',f.rosterPath,'--snapshot',f.snapshotPath,'--private-key',f.keyPath,'--output',f.output],{cwd:API_ROOT,encoding:'utf8'});assert.notEqual(run.status,0);assert.match(run.stderr,/already exists/);assert.equal(fs.readFileSync(f.output,'utf8'),'keep');
  fs.chmodSync(f.keyPath,0o644);run=spawnSync(process.execPath,[BUILD,'--roster',f.rosterPath,'--snapshot',f.snapshotPath,'--private-key',f.keyPath,'--output',path.join(f.dir,'loose.json')],{cwd:API_ROOT,encoding:'utf8'});assert.notEqual(run.status,0);assert.match(run.stderr,/permissions/);
  fs.chmodSync(f.keyPath,0o600);fs.writeFileSync(f.snapshotPath,'{}');run=spawnSync(process.execPath,[BUILD,'--roster',f.rosterPath,'--snapshot',f.snapshotPath,'--private-key',f.keyPath,'--output',path.join(f.dir,'bad.json')],{cwd:API_ROOT,encoding:'utf8'});assert.notEqual(run.status,0);assert.match(run.stderr,/missing field/);
  const real=path.join(f.dir,'real');fs.mkdirSync(real);const link=path.join(f.dir,'link');fs.symlinkSync(real,link,'dir');run=spawnSync(process.execPath,[BUILD,'--roster',f.rosterPath,'--snapshot',f.snapshotPath,'--private-key',f.keyPath,'--output',path.join(link,'unsafe.json')],{cwd:API_ROOT,encoding:'utf8'});assert.notEqual(run.status,0);assert.match(run.stderr,/symlinks/);
});
