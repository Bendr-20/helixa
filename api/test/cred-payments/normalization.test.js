'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {
  BASE_USDC,TRANSFER_TOPIC,normalizeRoster,normalizeIntervals,normalizeLogSet,
  normalizeReceipt,verifyReceiptBindings,buildObservationArtifact,canonicalStringify,
}=require('../../cred-payments');
const {HASH_A,HASH_B,ACCOUNT,OTHER,OWNER,topicAddress,roster,rosterProof,checkpoint,rawLog,rawReceipt,collection}=require('./helpers');

test('normalizes the exact canonical 688-account roster without owner inheritance and deeply freezes it',()=>{
  const value=normalizeRoster(roster());assert.equal(value.loopers.length,688);assert.equal(value.accounts.length,688);
  assert.equal(Object.hasOwn(value,'owners'),false);assert.equal(Object.isFrozen(value.loopers[0]),true);
  assert.throws(()=>{value.loopers[0].account=OTHER;},/read only|Cannot assign/);
});
test('rejects non-exact rosters, unknown fields, duplicates, and mixed-case addresses',()=>{
  const short=roster();short.loopers.pop();assert.throws(()=>normalizeRoster(short),/exactly 688/);
  const unknown=roster();unknown.extra=true;assert.throws(()=>normalizeRoster(unknown),/unknown field/);
  const duplicate=roster();duplicate.loopers[1].account=duplicate.loopers[0].account;assert.throws(()=>normalizeRoster(duplicate),/duplicate account/);
  const mixed=roster();mixed.collection=mixed.collection.toUpperCase();assert.throws(()=>normalizeRoster(mixed),/lowercase/);
});
test('normalizes contiguous closed intervals and rejects missing, mixed, gapped, or overlapping ranges',()=>{
  const good=[
    {fromBlock:'10',toBlock:'19',fromBlockHash:HASH_A,toBlockHash:HASH_B,fromBlockTime:'2026-10-13T03:00:00.000Z',toBlockTime:'2026-10-13T03:01:00.000Z'},
    {fromBlock:'20',toBlock:'29',fromBlockHash:HASH_B,toBlockHash:HASH_A,fromBlockTime:'2026-10-13T03:01:00.000Z',toBlockTime:'2026-10-13T03:02:00.000Z'},
  ];
  assert.equal(normalizeIntervals(good).length,2);const missing={...good[0]};delete missing.toBlockHash;
  assert.throws(()=>normalizeIntervals([missing]),/missing field/);assert.throws(()=>normalizeIntervals([good[0],{...good[1],fromBlock:'21'}]),/gap/);
  assert.throws(()=>normalizeIntervals([good[0],{...good[1],fromBlock:'19'}]),/overlap/);assert.throws(()=>normalizeIntervals([{...good[0],fromBlock:10}]),/string/);
  assert.throws(()=>normalizeIntervals([{...good[0],fromBlock:'1',toBlock:'101'}]),/bounded chunk/);
});
test('normalizes canonical USDC logs with uint256-safe decimal strings',()=>{
  const [log]=normalizeLogSet([rawLog()]);assert.equal(log.value,(2n**255n).toString());assert.equal(log.blockNumber,'100');
  assert.equal(log.from,OTHER);assert.equal(log.to,ACCOUNT);assert.equal(Object.isFrozen(log),true);
});
test('rejects removed, duplicate, malformed, wrong-contract, wrong-topic, and noncanonical logs',()=>{
  for(const [value,pattern] of [
    [rawLog({removed:true}),/removed/],[rawLog({address:OTHER}),/USDC/],
    [rawLog({topics:['0x'+'00'.repeat(32),topicAddress(OTHER),topicAddress(ACCOUNT)]}),/Transfer topic/],
    [rawLog({topics:[TRANSFER_TOPIC,topicAddress(OTHER)]}),/three topics/],[rawLog({data:'0x01'}),/32 bytes/],
    [rawLog({blockNumber:'0x064'}),/canonical/],[rawLog({transactionHash:'0xCC'}),/hash/],
  ])assert.throws(()=>normalizeLogSet([value]),pattern);
  assert.throws(()=>normalizeLogSet([rawLog(),rawLog()]),/duplicate/);assert.throws(()=>normalizeLogSet([rawLog({unexpected:true})]),/unknown field/);
  assert.throws(()=>normalizeLogSet([rawLog({blockNumber:'0x'+'1'.repeat(65)})]),/bounded/);
});
test('normalizes receipts and rejects failures, malformed status, and duplicate receipt logs',()=>{
  const receipt=normalizeReceipt(rawReceipt());assert.equal(receipt.status,'1');assert.equal(Object.isFrozen(receipt.logs[0]),true);
  assert.throws(()=>normalizeReceipt(rawReceipt({status:'0x0'})),/successful/);assert.throws(()=>normalizeReceipt(rawReceipt({status:'0x01'})),/canonical/);
  assert.throws(()=>normalizeReceipt(rawReceipt({logs:[rawLog(),rawLog()]})),/duplicate/);
  assert.throws(()=>normalizeReceipt(rawReceipt({logs:[rawLog({blockHash:HASH_B})]})),/binding mismatch/);
});
test('receipt binding requires an exact canonical 32-byte USDC Transfer ABI word',()=>{
  const logs=normalizeLogSet([rawLog()]);assert.doesNotThrow(()=>verifyReceiptBindings(logs,[normalizeReceipt(rawReceipt())]));
  for(const data of ['0x01','0x'+'01'.repeat(31),'0x'+'01'.repeat(33)])assert.throws(()=>verifyReceiptBindings(logs,[normalizeReceipt(rawReceipt({logs:[rawLog({data})]}))]),/exactly 32 bytes/);
  for(const data of ['0x0','0xzz','0x'+'AA'.repeat(32)])assert.throws(()=>verifyReceiptBindings(logs,[normalizeReceipt(rawReceipt({logs:[rawLog({data})]}))]),/data is malformed|exactly 32 bytes/);
});
test('receipt binding rejects mismatched or missing transfer fields',()=>{
  const logs=normalizeLogSet([rawLog()]);
  assert.throws(()=>verifyReceiptBindings(logs,[normalizeReceipt(rawReceipt({blockHash:HASH_B}))]),/block/);
  assert.throws(()=>verifyReceiptBindings(logs,[]),/missing receipt/);assert.throws(()=>verifyReceiptBindings(logs,[normalizeReceipt(rawReceipt({logs:[]}))]),/does not bind/);
});
test('canonical hardened artifact is input-order deterministic and explicitly observation-only',()=>{
  const first=normalizeLogSet([rawLog(),rawLog({transactionHash:'0x'+'ee'.repeat(32),logIndex:'0x1'})]);
  const left=buildObservationArtifact(rosterProof(),checkpoint(),collection(first),{now:Date.parse('2026-10-13T04:00:00.000Z')});
  const right=buildObservationArtifact(rosterProof(),checkpoint(),collection([...first].reverse()),{now:Date.parse('2026-10-13T04:00:00.000Z')});
  assert.equal(canonicalStringify(left),canonicalStringify(right));assert.equal(left.prospectiveCoverageOnly,true);assert.equal(left.x402Confirmed,false);
  assert.equal(left.scoreEligibleExternalCount,0);assert.equal(left.ownerAttributedCount,0);assert.equal(left.credNativeSignature,false);
  assert.equal(left.transfers.every(item=>item.x402Confirmed===false&&item.label==='verified-base-usdc-transfer'),true);assert.equal(Object.isFrozen(left.transfers[0]),true);
});
test('artifact rejects owner contamination and noncanonical or future collection clocks',()=>{
  const ownerLog=normalizeLogSet([rawLog({topics:[TRANSFER_TOPIC,topicAddress(OWNER),topicAddress(ACCOUNT)]})]);
  assert.throws(()=>buildObservationArtifact(rosterProof(),checkpoint(),collection(ownerLog),{now:Date.parse('2026-10-13T04:00:00.000Z')}),/owner contamination/);
  assert.throws(()=>buildObservationArtifact(rosterProof(),checkpoint(),collection([],{collectedAt:'2026-10-13T03:20:00Z'}),{now:Date.parse('2026-10-13T04:00:00.000Z')}),/canonical/);
  assert.throws(()=>buildObservationArtifact(rosterProof(),checkpoint(),collection([],{collectedAt:'2099-01-01T00:00:00.000Z'}),{now:Date.parse('2026-10-13T03:20:00.000Z')}),/future/);
});
