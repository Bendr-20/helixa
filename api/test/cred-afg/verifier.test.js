'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const fixture=require('./fixtures/signed-statement.json');
const {verifyAfgSignedStatement,PINNED_AFG_KEY_ID,PINNED_AFG_PUBLIC_KEY_HEX}=require('../../cred-afg/verifier');
const ACCOUNT='0x0329c5d3920e301740f78d6e17b8d1a11cca9b2c';
function copy(){return structuredClone(fixture);} function verify(value=copy(),options={}){return verifyAfgSignedStatement(value.record,value.roots,{expectedAccount:ACCOUNT,nowEpochSeconds:1791855900,...options});}
test('verifies the live AFG canonical hash, uint256 leaf, sorted proof, pinned root signature and Base account binding',()=>{const result=verify();assert.equal(result.verified,true);assert.equal(result.statementHash,fixture.record.latest.hash);assert.equal(result.leaf,fixture.record.latest.leaf);assert.equal(result.root,fixture.record.latest.root);assert.equal(result.keyId,PINNED_AFG_KEY_ID);assert.equal(PINNED_AFG_PUBLIC_KEY_HEX,fixture.roots.key.public_key_hex);assert.equal(result.scoreEligible,false);assert.equal(result.signatureScope,'afg-statement-root-v1');});
test('rejects statement tampering before treating it as verified',()=>{const value=copy();value.record.latest.statement.outSum='1';assert.throws(()=>verify(value),/canonical statement/i);});
test('rejects a statement bound to the wrong wallet',()=>assert.throws(()=>verify(copy(),{expectedAccount:'0x1111111111111111111111111111111111111111'}),/account binding/i));
test('rejects stale data even when the remote stale flag is false',()=>assert.throws(()=>verify(copy(),{nowEpochSeconds:1791838800+32401}),/stale/i));
test('rejects any key other than the currently pinned AFG key',()=>{const value=copy();value.roots.key.key_id='afg-stmt-ed25519-wrong';assert.throws(()=>verify(value),/pinned AFG key/i);});
test('rejects a statement root that does not match its roots window',()=>{const value=copy();value.roots.windows[0].root='0x'+'00'.repeat(32);assert.throws(()=>verify(value),/root window/i);});
test('rejects nonempty flags, false chain status, and non-Base statements',()=>{let value=copy();value.record.latest.statement.flags=['open'];value.record.latest.canonical=JSON.stringify(value.record.latest.statement);assert.throws(()=>verify(value),/flags/i);value=copy();value.record.chain_ok=false;assert.throws(()=>verify(value),/chain_ok/i);value=copy();value.record.latest.statement.chainId='1';assert.throws(()=>verify(value),/Base chain/i);});
