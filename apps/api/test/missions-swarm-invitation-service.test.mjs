import assert from 'node:assert/strict';
import test from 'node:test';
import { createSwarmInvitationStore } from '../src/missions/swarm-invitation-store.js';
import { SwarmInvitationError, createSwarmInvitationService } from '../src/missions/swarm-invitations.js';
const lead='0x1111111111111111111111111111111111111111', a='0x2222222222222222222222222222222222222222', b='0x3333333333333333333333333333333333333333';
const owners=new Map([['2431',lead],['1',a],['3802',b],['420','0x4444444444444444444444444444444444444444']]);
const identity=(tokenId)=>({chainId:8453,collection:'0x1649cd37f4748807b4882fc48765ba0b2affa94a',tokenId,owner:owners.get(tokenId),account:'0x'+tokenId.padStart(40,'0'),erc8004AgentId:String(80000+Number(tokenId)),finalizedBlock:{number:123,hash:'0x'+'a'.repeat(64)}});
const setup=()=>{const store=createSwarmInvitationStore({filename:':memory:'}); let n=0; return {store,service:createSwarmInvitationService({store,authority:{verify:async({tokenId})=>identity(tokenId)},createId:(kind)=>kind+'_'+String(++n).padStart(64,'0'),now:()=>new Date('2026-10-24T04:00:00.000Z')})};};

test('lead owner creates a non-binding draft only after every distinct authority is verified',async()=>{
 const {store,service}=setup(); const draft=await service.createDraft({actorAddress:lead,leadTokenId:'2431',inviteeTokenIds:['1','3802','420'],idempotencyKey:'create-12345678'});
 assert.equal(draft.nonBinding,true); assert.equal(draft.lead.tokenId,'2431'); assert.equal(draft.openSlots,1); assert.equal(draft.invites.every(x=>x.status==='pending'),true);
 assert.equal(JSON.stringify(draft).includes('role'),false); assert.equal(JSON.stringify(draft).includes('economics'),false); store.close();
});

test('duplicate tokens, owners, self-invites, and custody changes fail closed',async()=>{
 const {store,service}=setup();
 await assert.rejects(()=>service.createDraft({actorAddress:lead,leadTokenId:'2431',inviteeTokenIds:['1','1'],idempotencyKey:'create-12345678'}),SwarmInvitationError);
 owners.set('3802',a); await assert.rejects(()=>service.createDraft({actorAddress:lead,leadTokenId:'2431',inviteeTokenIds:['1','3802'],idempotencyKey:'create-22345678'}),/distinct/i); owners.set('3802',b);
 const draft=await service.createDraft({actorAddress:lead,leadTokenId:'2431',inviteeTokenIds:['1'],idempotencyKey:'create-32345678'}); const invite=draft.invites[0];
 owners.set('1',b); await assert.rejects(()=>service.respond({actorAddress:a,inviteId:invite.inviteId,decision:'accepted'}),(e)=>e.code==='swarm_invitation_stale'); owners.set('1',a); store.close();
});

test('lead can add and revoke pending invitations; invitee can read and respond only to their own opaque invite',async()=>{
 const {store,service}=setup(); const draft=await service.createDraft({actorAddress:lead,leadTokenId:'2431',inviteeTokenIds:['1'],idempotencyKey:'create-12345678'});
 await assert.rejects(()=>service.readDraft({actorAddress:a,draftId:draft.draftId}),/lead owner/i);
 const own=await service.readInvite({actorAddress:a,inviteId:draft.invites[0].inviteId}); assert.equal(own.owner,undefined); assert.equal(own.lead.owner,undefined);
 const accepted=await service.respond({actorAddress:a,inviteId:own.inviteId,decision:'accepted'}); assert.equal(accepted.status,'accepted'); assert.equal(accepted.lead.tokenId,'2431');
 const added=await service.addInvite({actorAddress:lead,draftId:draft.draftId,tokenId:'3802'}); assert.equal(added.status,'pending'); const replay=await service.addInvite({actorAddress:lead,draftId:draft.draftId,tokenId:'3802'}); assert.equal(replay.inviteId,added.inviteId);
 assert.equal((await service.revoke({actorAddress:lead,draftId:draft.draftId,inviteId:added.inviteId})).status,'revoked'); store.close();
});

test('lead can close a draft after fresh authority verification and closed history remains owner-readable',async()=>{const {store,service}=setup();const draft=await service.createDraft({actorAddress:lead,leadTokenId:'2431',inviteeTokenIds:['1'],idempotencyKey:'close-12345678'});await assert.rejects(()=>service.closeDraft({actorAddress:a,draftId:draft.draftId}),/lead owner/i);const closed=await service.closeDraft({actorAddress:lead,draftId:draft.draftId});assert.equal(closed.status,'closed');assert.equal(closed.invites[0].status,'revoked');assert.equal((await service.readDraft({actorAddress:lead,draftId:draft.draftId})).status,'closed');const invite=await service.readInvite({actorAddress:a,inviteId:draft.invites[0].inviteId});assert.equal(invite.draftStatus,'closed');await assert.rejects(()=>service.respond({actorAddress:a,inviteId:draft.invites[0].inviteId,decision:'accepted'}),(error)=>error.code==='swarm_invitation_conflict'&&error.status===409);store.close();});

import { createSwarmInvitationAuthorityVerifier } from '../src/missions/swarm-invitations.js';
test('authority verifier only accepts the reviewed dual-provider set',()=>{assert.throws(()=>createSwarmInvitationAuthorityVerifier({providers:[{id:'evil',approved:true},{id:'fake',approved:true}],accountIntegrityReader:{read:async()=>({})}}),/reviewed/i);});
