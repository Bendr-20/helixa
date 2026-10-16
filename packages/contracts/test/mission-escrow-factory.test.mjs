import assert from 'node:assert/strict';
import test from 'node:test';

import { ethers } from 'ethers';
import ganache from 'ganache';
import solc from 'solc';

import { canonicalizeLaunchManifest, hashLaunchManifest, MISSION_MANIFEST_TYPES } from '../../../apps/api/src/missions/manifest.js';
import { compileMissionContracts } from '../scripts/compile-mission-escrow.js';

const VERSION=ethers.id('mission-escrow-v1');
const DELAY=1;
let compiled;
let fixtures;

function compileFixtures(){
  if(fixtures) return fixtures;
  const source=`// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
contract FactoryTestVault { uint256 public constant MARKER = 1; }
contract Callback1271 {
    bytes4 private constant MAGIC = 0x1626ba7e;
    address public immutable owner;
    address public immutable target;
    bytes public callback;
    constructor(address owner_, address target_, bytes memory callback_) { owner=owner_; target=target_; callback=callback_; }
    function isValidSignature(bytes32 digest, bytes calldata signature) external returns (bytes4) {
        target.call(callback);
        if (signature.length != 65) return bytes4(0xffffffff);
        bytes32 r; bytes32 s; uint8 v;
        assembly { r := calldataload(signature.offset) s := calldataload(add(signature.offset,32)) v := byte(0,calldataload(add(signature.offset,64))) }
        return ecrecover(digest,v,r,s)==owner ? MAGIC : bytes4(0xffffffff);
    }
}`;
  const input={language:'Solidity',sources:{'Fixtures.sol':{content:source}},settings:{optimizer:{enabled:true,runs:200},evmVersion:'paris',metadata:{bytecodeHash:'none',appendCBOR:false},outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object']}}}};
  const output=JSON.parse(solc.compile(JSON.stringify(input)));
  const errors=output.errors?.filter(x=>x.severity==='error')??[];
  assert.deepEqual(errors,[]);
  const artifact=(name)=>{const c=output.contracts['Fixtures.sol'][name];return {abi:c.abi,bytecode:'0x'+c.evm.bytecode.object,deployedBytecode:'0x'+c.evm.deployedBytecode.object};};
  fixtures={vault:artifact('FactoryTestVault'),callback:artifact('Callback1271')};
  return fixtures;
}

async function setup(){
  compiled??=await compileMissionContracts();
  const g=ganache.provider({chain:{chainId:8453,hardfork:'shanghai'},logging:{quiet:true},wallet:{totalAccounts:12,defaultBalance:1000}});
  const provider=new ethers.BrowserProvider(g);
  const wallets=Object.values(g.getInitialAccounts()).map(x=>new ethers.Wallet(x.secretKey,provider));
  const deployer=new ethers.NonceManager(wallets[0]);
  const deploy=async(artifact,args=[],wallet=deployer)=>{const c=await new ethers.ContractFactory(artifact.abi,artifact.bytecode,wallet).deploy(...args);await c.waitForDeployment();return c;};
  const registry=await deploy(compiled.contracts.VersionRegistry,[wallets[0].address,wallets[1].address,DELAY]);
  const factory=await deploy(compiled.contracts.MissionEscrowFactory,[await registry.getAddress()]);
  const f=compileFixtures();
  const token=wallets[10].address;
  const now=Number((await provider.getBlock('latest')).timestamp);
  await (await registry.proposeVersion(VERSION,ethers.keccak256(f.vault.bytecode),ethers.keccak256(f.vault.deployedBytecode),[token,ethers.ZeroAddress],1,now+100,0,1,{gasLimit:1_000_000})).wait();
  await provider.send('evm_increaseTime',[101]); await provider.send('evm_mine',[]);
  await (await registry.activateVersion(VERSION,{gasLimit:1_000_000})).wait();
  return {g,provider,wallets,deployer,registry,factory,token,...f};
}

function manifestInput(ctx,{mission='mission-1',settlement=ctx.wallets[5].address,controller=ctx.wallets[4].address,nonce=0}={}){
  const addresses=[ctx.wallets[2].address,ctx.wallets[3].address,controller,settlement]
    .filter((x,i,a)=>a.findIndex(y=>y.toLowerCase()===x.toLowerCase())===i)
    .sort((a,b)=>BigInt(a)<BigInt(b)?-1:BigInt(a)>BigInt(b)?1:0);
  return {
    chainId:'8453',factory:ctx.factory.target,missionId:ethers.id(mission),termsHash:ethers.keccak256('0x'),versionId:VERSION,
    vaultCreationCodeHash:ethers.keccak256(ctx.vault.bytecode),predictedVault:ethers.ZeroAddress,
    owner:ctx.wallets[2].address,refundAddress:ctx.wallets[2].address,leadApprovalAddress:ctx.wallets[3].address,arbitrator:ctx.wallets[7].address,
    fundingDeadline:'1800000000',launchDeadline:'1850000000',expiry:'1799999999',idAgentsReleaseHash:ethers.id('id-agents-release'),xmtpRoomPolicyHash:ethers.id('xmtp-policy'),
    members:[{chainId:'8453',collection:ctx.wallets[9].address,tokenId:'42',canonicalAccount:ctx.wallets[8].address,controller,custodyEpoch:'7',settlementAddress:settlement,roleHash:ethers.id('lead'),isLead:true}],
    milestones:[{milestoneId:ethers.id('m1'),acceptanceHash:ethers.id('accept'),payoutCommitment:ethers.id('payout'),deliveryDeadline:'1900000000',reviewDeadline:'1950000000',disputeDeadline:'1990000000',payouts:[{token:ctx.token,recipient:settlement,amount:'1000000'}],deliveryTimeoutAllocations:[{token:ctx.token,recipient:settlement,amount:'1000000'}],disputeTimeoutAllocations:[{token:ctx.token,recipient:settlement,amount:'1000000'}]}],
    signerNonces:addresses.map(signer=>({signer,nonce:String(nonce)})),
  };
}

async function finalizedManifest(ctx,options){
  const input=manifestInput(ctx,options);
  const provisional=canonicalizeLaunchManifest(input);
  input.predictedVault=await ctx.factory.predictVault(provisional,ctx.vault.bytecode,'0x');
  return {input,manifest:canonicalizeLaunchManifest(input)};
}

function signApprovals(ctx,manifest,contractOwners=new Map()){
  const digest=hashLaunchManifest(toInput(manifest));
  return manifest.signerNonces.map(({signer})=>{
    const owner=contractOwners.get(signer.toLowerCase());
    const wallet=owner??ctx.wallets.find(w=>w.address.toLowerCase()===signer.toLowerCase());
    assert.ok(wallet,'missing signing wallet '+signer);
    return {signer,signature:wallet.signingKey.sign(digest).serialized};
  });
}

function toInput(manifest){
  const decimal=(x)=>x.toString();
  return {...manifest,chainId:decimal(manifest.chainId),fundingDeadline:decimal(manifest.fundingDeadline),launchDeadline:decimal(manifest.launchDeadline),expiry:decimal(manifest.expiry),members:manifest.members.map(m=>({...m,chainId:decimal(m.chainId),tokenId:decimal(m.tokenId),custodyEpoch:decimal(m.custodyEpoch)})),milestones:manifest.milestones.map(m=>({...m,deliveryDeadline:decimal(m.deliveryDeadline),reviewDeadline:decimal(m.reviewDeadline),disputeDeadline:decimal(m.disputeDeadline),payouts:m.payouts.map(a=>({...a,amount:decimal(a.amount)})),deliveryTimeoutAllocations:m.deliveryTimeoutAllocations.map(a=>({...a,amount:decimal(a.amount)})),disputeTimeoutAllocations:m.disputeTimeoutAllocations.map(a=>({...a,amount:decimal(a.amount)}))})),signerNonces:manifest.signerNonces.map(n=>({...n,nonce:decimal(n.nonce)}))};
}

test('factory ABI exposes deterministic consent only and no upgrade or fund-moving surface',async()=>{
  compiled??=await compileMissionContracts();
  const artifact=compiled.contracts.MissionEscrowFactory;
  assert.ok((artifact.deployedBytecode.length-2)/2 < 24_576,'factory must fit the EIP-170 runtime limit');
  const names=artifact.abi.filter(x=>x.type==='function').map(x=>x.name);
  for(const required of ['hashLaunchManifest','predictVault','create2Salt','deployVault','nonces','consumedManifests']) assert.ok(names.includes(required));
  for(const forbidden of ['upgradeTo','delegatecall','withdraw','sweep','transfer','execute']) assert.ok(!names.some(x=>x.toLowerCase().includes(forbidden.toLowerCase())));
});

test('Node and Solidity produce the same nested EIP-712 digest and CREATE2 address',async()=>{
  const ctx=await setup();
  const {input,manifest}=await finalizedManifest(ctx);
  assert.equal(await ctx.factory.hashLaunchManifest(manifest),hashLaunchManifest(input));
  assert.equal(await ctx.factory.predictVault(manifest,ctx.vault.bytecode,'0x'),manifest.predictedVault);
});

test('deploys exact runtime with collapsed distinct approvals and rejects replay',async()=>{
  const ctx=await setup();
  const {manifest}=await finalizedManifest(ctx,{controller:ctx.wallets[4].address,settlement:ctx.wallets[4].address});
  const approvals=signApprovals(ctx,manifest);
  const tx=await ctx.factory.deployVault(manifest,approvals,ctx.vault.bytecode,'0x',{gasLimit:8_000_000});
  await tx.wait();
  assert.equal(await ctx.provider.getCode(manifest.predictedVault),ctx.vault.deployedBytecode);
  for(const {signer} of manifest.signerNonces) assert.equal(await ctx.factory.nonces(signer),1n);
  assert.equal(await ctx.factory.consumedManifests(await ctx.factory.hashLaunchManifest(manifest)),true);
  await assert.rejects((await ctx.factory.deployVault(manifest,approvals,ctx.vault.bytecode,'0x',{gasLimit:8_000_000})).wait());
});

test('bad signature rolls back every nonce and manifest-consumption write',async()=>{
  const ctx=await setup();
  const {manifest}=await finalizedManifest(ctx);
  const approvals=signApprovals(ctx,manifest);
  approvals[1]={...approvals[1],signature:ctx.wallets[11].signingKey.sign(hashLaunchManifest(toInput(manifest))).serialized};
  await assert.rejects((await ctx.factory.deployVault(manifest,approvals,ctx.vault.bytecode,'0x',{gasLimit:8_000_000})).wait());
  for(const {signer} of manifest.signerNonces) assert.equal(await ctx.factory.nonces(signer),0n);
  assert.equal(await ctx.factory.consumedManifests(await ctx.factory.hashLaunchManifest(manifest)),false);
  assert.equal(await ctx.provider.getCode(manifest.predictedVault),'0x');
});

test('rejects stale nonces, expiry, incomplete signer sets, and manifest bounds before deployment',async()=>{
  const ctx=await setup();
  const stale=await finalizedManifest(ctx,{mission:'stale-nonce',nonce:1});
  const staleApprovals=signApprovals(ctx,stale.manifest);
  await assert.rejects((await ctx.factory.deployVault(stale.manifest,staleApprovals,ctx.vault.bytecode,'0x',{gasLimit:8_000_000})).wait());
  for(const {signer} of stale.manifest.signerNonces) assert.equal(await ctx.factory.nonces(signer),0n);

  const incomplete=await finalizedManifest(ctx,{mission:'incomplete'});
  const incompleteApprovals=signApprovals(ctx,incomplete.manifest).slice(1);
  await assert.rejects((await ctx.factory.deployVault(incomplete.manifest,incompleteApprovals,ctx.vault.bytecode,'0x',{gasLimit:8_000_000})).wait());

  const expiredBase=await finalizedManifest(ctx,{mission:'expired'});
  const expiredInput={...expiredBase.input,expiry:'1'};
  const expired=canonicalizeLaunchManifest(expiredInput);
  await assert.rejects((await ctx.factory.deployVault(expired,signApprovals(ctx,expired),ctx.vault.bytecode,'0x',{gasLimit:8_000_000})).wait());

  const bounded=await finalizedManifest(ctx,{mission:'bounded'});
  const members=Array.from({length:9},(_,index)=>({...bounded.input.members[0],tokenId:String(index+1),canonicalAccount:ethers.getAddress('0x'+(1000+index).toString(16).padStart(40,'0'))}));
  const oversized=canonicalizeLaunchManifest({...bounded.input,members});
  await assert.rejects((await ctx.factory.deployVault(oversized,[],ctx.vault.bytecode,'0x',{gasLimit:8_000_000})).wait());
  assert.equal(await ctx.provider.getCode(bounded.manifest.predictedVault),'0x');
});

test('accepts ERC-1271 while a callback cannot reenter or consume state',async()=>{
  const ctx=await setup();
  const callbackData=ctx.factory.interface.encodeFunctionData('deployVault',[await finalizedManifest(ctx,{mission:'dummy'}).then(x=>x.manifest),[],ctx.vault.bytecode,'0x']);
  const wallet1271=await new ethers.ContractFactory(ctx.callback.abi,ctx.callback.bytecode,ctx.deployer).deploy(ctx.wallets[6].address,ctx.factory.target,callbackData);
  await wallet1271.waitForDeployment();
  const {manifest}=await finalizedManifest(ctx,{mission:'erc1271',settlement:wallet1271.target});
  const owners=new Map([[wallet1271.target.toLowerCase(),ctx.wallets[6]]]);
  const approvals=signApprovals(ctx,manifest,owners);
  await (await ctx.factory.deployVault(manifest,approvals,ctx.vault.bytecode,'0x',{gasLimit:8_000_000})).wait();
  assert.equal(await ctx.factory.nonces(wallet1271.target),1n);
  assert.equal(await ctx.provider.getCode(manifest.predictedVault),ctx.vault.deployedBytecode);
});
