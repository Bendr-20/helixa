import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ethers } from 'ethers';
import ganache from 'ganache';
import solc from 'solc';
import { compileMissionContracts } from '../scripts/compile-mission-escrow.js';

let builds;
async function artifacts(){
  if(builds)return builds;
  const mission=await compileMissionContracts();
  const source=await readFile(new URL('./fixtures/MissionEscrowTokens.sol',import.meta.url),'utf8');
  const input={language:'Solidity',sources:{'T.sol':{content:source}},settings:{optimizer:{enabled:true,runs:200},evmVersion:'paris',metadata:{bytecodeHash:'none',appendCBOR:false},outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}};
  const output=JSON.parse(solc.compile(JSON.stringify(input))); const errors=output.errors?.filter(x=>x.severity==='error')??[];assert.deepEqual(errors,[]);
  const artifact=(name)=>{const c=output.contracts['T.sol'][name];return {abi:c.abi,bytecode:'0x'+c.evm.bytecode.object}};builds={vault:mission.contracts.MissionEscrowV1,token:artifact('MissionTestToken'),callback:artifact('MissionCallbackToken')};return builds;
}
async function fixture(count=1,kind='token'){
  const b=await artifacts();const node=ganache.provider({chain:{chainId:8453,hardfork:'shanghai'},logging:{quiet:true},wallet:{totalAccounts:12,defaultBalance:1000}});const provider=new ethers.BrowserProvider(node);
  const wallets=Object.values(node.getInitialAccounts()).map(x=>new ethers.Wallet(x.secretKey,provider));const actors=wallets.map(x=>new ethers.NonceManager(x));const deployer=actors[0];
  const deploy=async(a,args=[])=>{const c=await new ethers.ContractFactory(a.abi,a.bytecode,deployer).deploy(...args);await c.waitForDeployment();return c};
  const token=kind==='callback'?await deploy(b.callback):await deploy(b.token,['Token','TOK']);const now=Number((await provider.getBlock('latest')).timestamp);const funding=now+100,launch=now+200,delivery=now+300,review=now+400,dispute=now+500;
  const member={chainId:8453,collection:wallets[8].address,tokenId:1,canonicalAccount:wallets[9].address,controller:wallets[5].address,custodyEpoch:1,settlementAddress:wallets[6].address,roleHash:ethers.id('lead'),isLead:true};
  const milestones=Array.from({length:count},(_,i)=>({milestoneId:ethers.id('m'+(i+1)),acceptanceHash:ethers.id('accept'+i),payoutCommitment:ethers.id('payout'+i),deliveryDeadline:delivery,reviewDeadline:review,disputeDeadline:dispute,payouts:[{token:token.target,recipient:wallets[6].address,amount:100}],deliveryTimeoutAllocations:[{token:token.target,recipient:wallets[2].address,amount:100}],disputeTimeoutAllocations:[{token:token.target,recipient:wallets[2].address,amount:100}]}));
  const args=[ethers.id('mission'),ethers.id('version'),wallets[1].address,wallets[2].address,wallets[3].address,wallets[4].address,funding,launch,[member],milestones];
  const vault=await deploy(b.vault,args);await(await token.mint(wallets[1].address,100n*BigInt(count))).wait();await(await token.connect(actors[1]).approve(vault.target,100n*BigInt(count))).wait();await(await vault.connect(actors[1]).fund(token.target,100n*BigInt(count),{gasLimit:1_000_000})).wait();await(await vault.connect(actors[1]).approveLaunch()).wait();await(await vault.connect(actors[3]).approveLaunch()).wait();
  return {node,provider,wallets,actors,token,vault,milestones,delivery,review,dispute};
}
async function revert(tx){await assert.rejects((await tx).wait())}
async function move(ctx,timestamp){const now=Number((await ctx.provider.getBlock('latest')).timestamp);await ctx.provider.send('evm_increaseTime',[Math.max(0,timestamp-now)]);await ctx.provider.send('evm_mine',[])}

test('binds both approvals to the exact artifact and payout before one direct release',async()=>{
  const c=await fixture();const id=c.milestones[0].milestoneId,artifact=ethers.id('artifact');
  await revert(c.vault.connect(c.actors[1]).approveMilestone(id,artifact,c.milestones[0].payoutCommitment,{gasLimit:500_000}));
  await(await c.vault.connect(c.actors[3]).submitArtifact(id,artifact)).wait();
  await revert(c.vault.connect(c.actors[1]).approveMilestone(id,ethers.id('wrong'),c.milestones[0].payoutCommitment,{gasLimit:500_000}));
  await(await c.vault.connect(c.actors[3]).approveMilestone(id,artifact,c.milestones[0].payoutCommitment)).wait();
  await revert(c.vault.connect(c.actors[10]).releaseMilestone(id,{gasLimit:500_000}));
  await(await c.vault.connect(c.actors[1]).approveMilestone(id,artifact,c.milestones[0].payoutCommitment)).wait();
  await(await c.vault.connect(c.actors[10]).releaseMilestone(id,{gasLimit:700_000})).wait();
  assert.equal((await c.vault.milestone(id)).status,3n);assert.equal(await c.token.balanceOf(c.wallets[6].address),100n);assert.equal(await c.vault.totalReleased(c.token.target),100n);assert.equal(await c.vault.remainingLiability(c.token.target),0n);assert.equal(await c.vault.state(),3n);
  await revert(c.vault.releaseMilestone(id,{gasLimit:500_000}));
});

test('freezes disputed milestones and bounds joint/arbitrator resolutions by destination and amount',async()=>{
  const c=await fixture(2);const reason=ethers.id('reason');
  for(const m of c.milestones) await(await c.vault.connect(c.actors[1]).disputeMilestone(m.milestoneId,reason)).wait();
  await revert(c.vault.releaseMilestone(c.milestones[0].milestoneId,{gasLimit:500_000}));
  const joint=[{token:c.token.target,recipient:c.wallets[6].address,amount:60},{token:c.token.target,recipient:c.wallets[2].address,amount:40}];
  await(await c.vault.connect(c.actors[3]).approveDisputeResolution(c.milestones[0].milestoneId,joint,reason)).wait();
  await(await c.vault.connect(c.actors[1]).approveDisputeResolution(c.milestones[0].milestoneId,joint,reason,{gasLimit:800_000})).wait();
  assert.equal((await c.vault.milestone(c.milestones[0].milestoneId)).status,4n);
  await revert(c.vault.connect(c.actors[4]).arbitrate(c.milestones[1].milestoneId,[{token:c.token.target,recipient:c.wallets[7].address,amount:100}],reason,{gasLimit:700_000}));
  await revert(c.vault.connect(c.actors[4]).arbitrate(c.milestones[1].milestoneId,[{token:c.token.target,recipient:c.wallets[6].address,amount:99}],reason,{gasLimit:700_000}));
  await(await c.vault.connect(c.actors[4]).arbitrate(c.milestones[1].milestoneId,[{token:c.token.target,recipient:c.wallets[2].address,amount:100}],reason,{gasLimit:800_000})).wait();
  assert.equal((await c.vault.milestone(c.milestones[1].milestoneId)).status,4n);assert.equal(await c.token.balanceOf(c.wallets[6].address),60n);assert.equal(await c.token.balanceOf(c.wallets[2].address),140n);assert.equal(await c.vault.totalReleased(c.token.target),60n);assert.equal(await c.vault.totalRefunded(c.token.target),140n);assert.equal(await c.vault.state(),3n);
});

test('settles effects-first when a malicious payout token callbacks into release',async()=>{
  const c=await fixture(1,'callback');const id=c.milestones[0].milestoneId,artifact=ethers.id('artifact');
  await(await c.vault.connect(c.actors[3]).submitArtifact(id,artifact)).wait();await(await c.vault.connect(c.actors[1]).approveMilestone(id,artifact,c.milestones[0].payoutCommitment)).wait();await(await c.vault.connect(c.actors[3]).approveMilestone(id,artifact,c.milestones[0].payoutCommitment)).wait();
  await(await c.token.setCallback(c.vault.target,c.vault.interface.encodeFunctionData('releaseMilestone',[id]))).wait();
  await(await c.vault.releaseMilestone(id,{gasLimit:900_000})).wait();
  assert.equal(await c.token.callbackAttempted(),true);assert.equal(await c.token.callbackSucceeded(),false);assert.equal((await c.vault.milestone(id)).status,3n);assert.equal(await c.vault.totalReleased(c.token.target),100n);assert.equal(await c.vault.remainingLiability(c.token.target),0n);
});

test('executes fixed delivery/review/dispute timeouts independently and only once',async()=>{
  const c=await fixture(2);const artifact=ethers.id('artifact');await(await c.vault.connect(c.actors[3]).submitArtifact(c.milestones[1].milestoneId,artifact)).wait();
  await move(c,c.delivery+1);await(await c.vault.connect(c.actors[10]).settleDeliveryTimeout(c.milestones[0].milestoneId,{gasLimit:700_000})).wait();
  assert.equal((await c.vault.milestone(c.milestones[0].milestoneId)).status,5n);assert.equal((await c.vault.milestone(c.milestones[1].milestoneId)).status,1n);
  await c.provider.send('evm_increaseTime',[101]);await c.provider.send('evm_mine',[]);await(await c.vault.connect(c.actors[10]).enterDisputeAfterReview(c.milestones[1].milestoneId,ethers.id('late'))).wait();
  await c.provider.send('evm_increaseTime',[101]);await c.provider.send('evm_mine',[]);await(await c.vault.connect(c.actors[11]).settleDisputeTimeout(c.milestones[1].milestoneId,{gasLimit:700_000})).wait();
  assert.equal((await c.vault.milestone(c.milestones[1].milestoneId)).status,5n);assert.equal(await c.vault.totalRefunded(c.token.target),200n);assert.equal(await c.vault.remainingLiability(c.token.target),0n);assert.equal(await c.token.balanceOf(c.wallets[2].address),200n);assert.equal(await c.vault.state(),3n);
  await revert(c.vault.settleDisputeTimeout(c.milestones[1].milestoneId,{gasLimit:500_000}));
});
