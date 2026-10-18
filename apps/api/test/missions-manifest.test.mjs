import assert from 'node:assert/strict';
import test from 'node:test';
import { getAddress, keccak256, stringToHex } from 'viem';

import {
  MISSION_MANIFEST_DOMAIN,
  MISSION_MANIFEST_TYPES,
  canonicalizeLaunchManifest,
  hashLaunchManifest,
  missionCreate2Salt,
  predictMissionVaultAddress,
} from '../src/missions/manifest.js';

const A=(n)=>getAddress('0x'+n.toString(16).padStart(40,'0'));
const H=(s)=>keccak256(stringToHex(s));

function fixture(overrides={}) {
  const factory=A(100), versionId=H('v1'), missionId=H('mission'), termsHash=H('terms');
  const base={
    chainId:'8453', factory, missionId, termsHash, versionId,
    vaultCreationCodeHash:H('creation'), predictedVault:A(101), owner:A(1), refundAddress:A(2),
    leadApprovalAddress:A(3), arbitrator:A(6), fundingDeadline:'2050000000', launchDeadline:'2100000000', expiry:'2000000000', idAgentsReleaseHash:H('id-agents'), xmtpRoomPolicyHash:H('xmtp'),
    members:[{chainId:'8453',collection:A(10),tokenId:'42',canonicalAccount:A(11),controller:A(4),custodyEpoch:'7',settlementAddress:A(5),roleHash:H('lead'),isLead:true}],
    milestones:[{milestoneId:H('m1'),acceptanceHash:H('accept'),payoutCommitment:H('payout'),deliveryDeadline:'1900000000',reviewDeadline:'1950000000',disputeDeadline:'1990000000',payouts:[{token:A(20),recipient:A(5),amount:'1000000'}],deliveryTimeoutAllocations:[{token:A(20),recipient:A(2),amount:'1000000'}],disputeTimeoutAllocations:[{token:A(20),recipient:A(5),amount:'500000'},{token:A(20),recipient:A(2),amount:'500000'}]}],
    signerNonces:[{signer:A(1),nonce:'0'},{signer:A(3),nonce:'9'},{signer:A(4),nonce:'2'},{signer:A(5),nonce:'4'}],
  };
  return {...base,...overrides};
}

test('exports the closed EIP-712 domain and nested manifest schema',()=>{
  assert.deepEqual(MISSION_MANIFEST_DOMAIN,{name:'Helixa Mission Escrow',version:'1'});
  assert.deepEqual(MISSION_MANIFEST_TYPES.LaunchManifest.map(x=>x.name),['missionId','termsHash','versionId','vaultCreationCodeHash','idAgentsReleaseHash','xmtpRoomPolicyHash','factory','predictedVault','owner','refundAddress','leadApprovalAddress','arbitrator','fundingDeadline','launchDeadline','expiry','members','milestones','signerNonces']);
});

test('canonical codec accepts decimal strings and rejects numbers, unknown fields, and malformed values',()=>{
  const canonical=canonicalizeLaunchManifest(fixture());
  assert.equal(canonical.chainId,8453n);
  assert.equal(canonical.members[0].tokenId,42n);
  assert.equal(canonical.milestones[0].payouts[0].amount,1000000n);
  assert.equal(canonical.signerNonces[1].nonce,9n);
  assert.throws(()=>canonicalizeLaunchManifest(fixture({chainId:8453})),/decimal string/);
  assert.throws(()=>canonicalizeLaunchManifest({...fixture(),secret:'nope'}),/unexpected field/);
  assert.throws(()=>canonicalizeLaunchManifest(fixture({expiry:'01'})),/canonical decimal/);
  assert.throws(()=>canonicalizeLaunchManifest(fixture({members:[{...fixture().members[0],tokenId:'-1'}]})),/decimal string/);
  const accessor=fixture(); Object.defineProperty(accessor,'owner',{enumerable:true,get(){throw new Error('getter invoked');}});
  assert.throws(()=>canonicalizeLaunchManifest(accessor),/enumerable data property/);
  const hidden=fixture(); Object.defineProperty(hidden,'hidden',{value:'secret',enumerable:false});
  assert.throws(()=>canonicalizeLaunchManifest(hidden),/unexpected field/);
  const symbol=fixture(); symbol[Symbol('secret')]='secret';
  assert.throws(()=>canonicalizeLaunchManifest(symbol),/unexpected field/);
  const sparse=fixture(); sparse.members=new Array(1);
  assert.throws(()=>canonicalizeLaunchManifest(sparse),/must not be sparse/);
  const unsorted=fixture(); unsorted.signerNonces=[...unsorted.signerNonces].reverse();
  assert.throws(()=>canonicalizeLaunchManifest(unsorted),/ascending address order/);
});

test('digest is deterministic and replay-isolated across chain, factory, version, vault, and terms',()=>{
  const manifest=fixture();
  const digest=hashLaunchManifest(manifest);
  assert.match(digest,/^0x[0-9a-f]{64}$/);
  assert.equal(hashLaunchManifest(structuredClone(manifest)),digest);
  for(const changed of [
    fixture({chainId:'84532'}), fixture({factory:A(99)}), fixture({versionId:H('v2')}),
    fixture({predictedVault:A(88)}), fixture({termsHash:H('other')}),
  ]) assert.notEqual(hashLaunchManifest(changed),digest);
});

test('CREATE2 salt and predicted address bind mission, version, terms, factory, and init code',()=>{
  const m=fixture();
  const salt=missionCreate2Salt(m);
  assert.match(salt,/^0x[0-9a-f]{64}$/);
  const initCodeHash=H('init-code');
  const predicted=predictMissionVaultAddress({...m,initCodeHash});
  assert.notEqual(predicted,predictMissionVaultAddress({...m,factory:A(77),initCodeHash}));
  assert.notEqual(predicted,predictMissionVaultAddress({...m,versionId:H('v2'),initCodeHash}));
  assert.notEqual(predicted,predictMissionVaultAddress({...m,termsHash:H('other'),initCodeHash}));
});
