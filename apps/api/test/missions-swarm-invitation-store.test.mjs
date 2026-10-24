import assert from 'node:assert/strict';
import test from 'node:test';
import { createSwarmInvitationStore } from '../src/missions/swarm-invitation-store.js';

const wallets=['0x1111111111111111111111111111111111111111','0x2222222222222222222222222222222222222222','0x3333333333333333333333333333333333333333'];
const identity=(tokenId, owner, block=100)=>({chainId:8453,collection:'0x1649cd37f4748807b4882fc48765ba0b2affa94a',tokenId,owner,account:'0x'+String(tokenId).padStart(40,'0'),erc8004AgentId:String(90000+Number(tokenId)),finalizedBlock:{number:block,hash:'0x'+String(block).padStart(64,'0')}});

test('store durably creates an idempotent bounded draft with auditable per-token invitations',()=>{
 const store=createSwarmInvitationStore({filename:':memory:'});
 const input={draftId:'draft_'+ 'a'.repeat(64),idempotencyKey:'create-12345678',requestHash:'b'.repeat(64),lead:identity('2431',wallets[0]),invitees:[identity('1',wallets[1]),identity('3802',wallets[2])],createdAt:'2026-10-24T04:00:00.000Z',createInviteId:(tokenId)=>'invite_'+tokenId.padStart(64,'0')};
 const first=store.createDraft(input); const replay=store.createDraft(input);
 assert.equal(replay.draftId,first.draftId); assert.equal(first.status,'open'); assert.equal(first.nonBinding,true);
 assert.deepEqual(first.invites.map(x=>[x.tokenId,x.status]),[['1','pending'],['3802','pending']]);
 assert.equal(first.openSlots,2); assert.equal(first.invites[0].owner,wallets[1]); assert.equal(first.invites[0].anchor.blockNumber,100);
 assert.throws(()=>store.createDraft({...input,draftId:'draft_'+ 'c'.repeat(64),requestHash:'d'.repeat(64)}),/idempotency/i);
 store.close();
});

test('store transactionally adds, accepts, declines, and revokes without deleting accepted members',()=>{
 const store=createSwarmInvitationStore({filename:':memory:'});
 const base={draftId:'draft_'+ 'a'.repeat(64),idempotencyKey:'create-12345678',requestHash:'b'.repeat(64),lead:identity('2431',wallets[0]),invitees:[identity('1',wallets[1])],createdAt:'2026-10-24T04:00:00.000Z',createInviteId:(id)=>'invite_'+id.padStart(64,'0')};
 let draft=store.createDraft(base); const first=draft.invites[0];
 assert.equal(store.respond({inviteId:first.inviteId,owner:wallets[1],decision:'accepted',at:'2026-10-24T04:01:00.000Z'}).status,'accepted');
 assert.throws(()=>store.revoke({draftId:draft.draftId,inviteId:first.inviteId,owner:wallets[0],at:'2026-10-24T04:02:00.000Z'}),/pending/i);
 const added=store.addInvite({draftId:draft.draftId,inviteId:'invite_'+ 'c'.repeat(64),identity:identity('3802',wallets[2]),owner:wallets[0],at:'2026-10-24T04:03:00.000Z'});
 assert.equal(store.revoke({draftId:draft.draftId,inviteId:added.inviteId,owner:wallets[0],at:'2026-10-24T04:04:00.000Z'}).status,'revoked');
 assert.equal(store.readDraft(draft.draftId).invites.find(x=>x.tokenId==='1').status,'accepted');
 store.close();
});

test('closing is atomic and idempotent, revokes pending invites, preserves accepted history, and releases the active-draft slot',()=>{const store=createSwarmInvitationStore({filename:':memory:',maxActiveDraftsPerOwner:1});const input={draftId:'draft_'+ 'a'.repeat(64),idempotencyKey:'close-12345678',requestHash:'b'.repeat(64),lead:identity('2431',wallets[0]),invitees:[identity('1',wallets[1]),identity('3802',wallets[2])],createdAt:'2026-10-24T04:00:00.000Z',createInviteId:(id)=>'invite_'+id.padStart(64,'0')};const draft=store.createDraft(input);store.respond({inviteId:draft.invites[0].inviteId,owner:wallets[1],decision:'accepted',at:'2026-10-24T04:30:00.000Z'});const closed=store.closeDraft({draftId:draft.draftId,owner:wallets[0],at:'2026-10-24T05:00:00.000Z'});assert.equal(closed.status,'closed');assert.deepEqual(closed.invites.map(x=>[x.tokenId,x.status]),[['1','accepted'],['3802','revoked']]);assert.deepEqual(store.closeDraft({draftId:draft.draftId,owner:wallets[0],at:'2026-10-24T05:01:00.000Z'}),closed);assert.throws(()=>store.addInvite({draftId:draft.draftId,inviteId:'invite_'+ 'c'.repeat(64),identity:identity('3802',wallets[2]),owner:wallets[0],at:'2026-10-24T05:01:00.000Z'}),/closed/i);assert.doesNotThrow(()=>store.createDraft({...input,draftId:'draft_'+ 'd'.repeat(64),idempotencyKey:'close-22345678',requestHash:'e'.repeat(64),createdAt:'2026-10-24T05:02:00.000Z',createInviteId:(id)=>'invite_'+('9'+id).padStart(64,'0')}));store.close();});

test('decline is durable and idempotent',()=>{const store=createSwarmInvitationStore({filename:':memory:'});const draft=store.createDraft({draftId:'draft_'+ 'a'.repeat(64),idempotencyKey:'decline-12345678',requestHash:'b'.repeat(64),lead:identity('2431',wallets[0]),invitees:[identity('1',wallets[1])],createdAt:'2026-10-24T04:00:00.000Z',createInviteId:(id)=>'invite_'+id.padStart(64,'0')});const value={inviteId:draft.invites[0].inviteId,owner:wallets[1],decision:'declined',at:'2026-10-24T04:01:00.000Z'};assert.equal(store.respond(value).status,'declined');assert.equal(store.respond(value).status,'declined');store.close();});

test('owner inbox restores the latest active lead draft and bounded privacy-safe invitee summaries',()=>{
 const store=createSwarmInvitationStore({filename:':memory:'});
 const draft=store.createDraft({draftId:'draft_'+ 'a'.repeat(64),idempotencyKey:'inbox-12345678',requestHash:'b'.repeat(64),lead:identity('2431',wallets[0]),invitees:[identity('1',wallets[1]),identity('3802',wallets[2])],createdAt:'2026-10-24T04:00:00.000Z',createInviteId:(id)=>'invite_'+id.padStart(64,'0')});
 const leadInbox=store.readInbox(wallets[0]);
 assert.equal(leadInbox.leadDraft.draftId,draft.draftId);
 assert.deepEqual(leadInbox.leadDraft.invites.map(({tokenId,status})=>[tokenId,status]),[['1','pending'],['3802','pending']]);
 assert.deepEqual(leadInbox.invitations,[]);
 const inviteeInbox=store.readInbox(wallets[1]);
 assert.deepEqual(inviteeInbox.invitations,[{inviteId:draft.invites[0].inviteId,draftId:draft.draftId,tokenId:'1',status:'pending',nonBinding:true,createdAt:'2026-10-24T04:00:00.000Z',respondedAt:null,lead:{tokenId:'2431'},draftStatus:'open'}]);
 assert.equal(JSON.stringify(inviteeInbox).includes(wallets[0]),false);
 assert.equal(JSON.stringify(inviteeInbox).includes('account'),false);
 assert.deepEqual(store.readInbox('0x9999999999999999999999999999999999999999'),{leadDraft:null,invitations:[]});
 store.closeDraft({draftId:draft.draftId,owner:wallets[0],at:'2026-10-24T05:00:00.000Z'});
 assert.equal(store.readInbox(wallets[0]).leadDraft,null);
 store.close();
});

test('lead inbox keeps every active invitation and at most sixteen terminal records',()=>{
 const store=createSwarmInvitationStore({filename:':memory:'});
 const owner=(value)=>'0x'+value.toString(16).padStart(40,'0');
 const draft=store.createDraft({draftId:'draft_'+ 'f'.repeat(64),idempotencyKey:'bounded-12345678',requestHash:'e'.repeat(64),lead:identity('2431',wallets[0]),invitees:[identity('1',owner(1001)),identity('2',owner(1002))],createdAt:'2026-10-24T04:00:00.000Z',createInviteId:(id)=>'invite_'+Number(id).toString(16).padStart(64,'0')});
 store.respond({inviteId:draft.invites[0].inviteId,owner:owner(1001),decision:'accepted',at:'2026-10-24T04:00:01.000Z'});
 store.revoke({draftId:draft.draftId,inviteId:draft.invites[1].inviteId,owner:wallets[0],at:'2026-10-24T04:00:02.000Z'});
 for(let tokenId=3;tokenId<=102;tokenId+=1){const inviteId='invite_'+tokenId.toString(16).padStart(64,'0');store.addInvite({draftId:draft.draftId,inviteId,identity:identity(String(tokenId),owner(1000+tokenId)),owner:wallets[0],at:new Date(Date.UTC(2026,9,24,4,0,tokenId)).toISOString()});store.revoke({draftId:draft.draftId,inviteId,owner:wallets[0],at:new Date(Date.UTC(2026,9,24,4,2,tokenId)).toISOString()});}
 const inbox=store.readInbox(wallets[0]);
 assert.equal(inbox.leadDraft.invites.length,17);
 assert.equal(inbox.leadDraft.invites.filter((entry)=>entry.status==='accepted').length,1);
 assert.equal(inbox.leadDraft.invites.some((entry)=>entry.tokenId==='1'),true);
 assert.equal(inbox.leadDraft.openSlots,3);
 store.close();
});
