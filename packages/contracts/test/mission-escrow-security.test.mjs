import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { compileMissionContracts } from '../scripts/compile-mission-escrow.js';

test('V1 exposes only bounded lifecycle actions and fits deployability limits',async()=>{
  const build=await compileMissionContracts();const artifact=build.contracts.MissionEscrowV1;const names=artifact.abi.filter(x=>x.type==='function').map(x=>x.name);
  for(const name of ['upgradeTo','upgradeToAndCall','delegatecall','execute','withdraw','sweep','selfdestruct','setOwner','setRecipient','setAllocation'])assert.ok(!names.some(x=>x.toLowerCase().includes(name.toLowerCase())),name);
  assert.ok((artifact.deployedBytecode.length-2)/2<24_576);assert.ok((artifact.bytecode.length-2)/2<49_152);
});

test('all fund-moving entry points are non-reentrant and have fixed/bounded destinations',async()=>{
  const source=await readFile(new URL('../src/missions/MissionEscrowV1.sol',import.meta.url),'utf8');
  for(const fn of ['fund','refundIncompleteFunding','refundUnlaunched','releaseMilestone','settleDeliveryTimeout','approveDisputeResolution','arbitrate','settleDisputeTimeout','recoverExcess']){
    assert.match(source,new RegExp('function\\s+'+fn+'[^\\{]+nonReentrant','u'),fn);
  }
  assert.doesNotMatch(source,/delegatecall|selfdestruct|tx\.origin/u);
  assert.match(source,/recipient == refundAddress/u);
  assert.match(source,/remainingLiability\[token\] -= amount/u);
});
