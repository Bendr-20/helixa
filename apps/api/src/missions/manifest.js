import {
  encodeAbiParameters,
  getAddress,
  getCreate2Address,
  hashTypedData,
  isAddress,
  keccak256,
} from 'viem';

export const MISSION_MANIFEST_DOMAIN = Object.freeze({ name: 'Helixa Mission Escrow', version: '1' });

export const MISSION_MANIFEST_TYPES = Object.freeze({
  Allocation: Object.freeze([
    { name: 'token', type: 'address' }, { name: 'recipient', type: 'address' }, { name: 'amount', type: 'uint256' },
  ]),
  MemberTerms: Object.freeze([
    { name: 'chainId', type: 'uint256' }, { name: 'collection', type: 'address' }, { name: 'tokenId', type: 'uint256' },
    { name: 'canonicalAccount', type: 'address' }, { name: 'controller', type: 'address' }, { name: 'custodyEpoch', type: 'uint64' },
    { name: 'settlementAddress', type: 'address' }, { name: 'roleHash', type: 'bytes32' }, { name: 'isLead', type: 'bool' },
  ]),
  MilestoneTerms: Object.freeze([
    { name: 'milestoneId', type: 'bytes32' }, { name: 'acceptanceHash', type: 'bytes32' }, { name: 'payoutCommitment', type: 'bytes32' },
    { name: 'deliveryDeadline', type: 'uint64' }, { name: 'reviewDeadline', type: 'uint64' }, { name: 'disputeDeadline', type: 'uint64' },
    { name: 'payouts', type: 'Allocation[]' }, { name: 'deliveryTimeoutAllocations', type: 'Allocation[]' },
    { name: 'disputeTimeoutAllocations', type: 'Allocation[]' },
  ]),
  SignerNonce: Object.freeze([{ name: 'signer', type: 'address' }, { name: 'nonce', type: 'uint256' }]),
  LaunchManifest: Object.freeze([
    { name: 'missionId', type: 'bytes32' }, { name: 'termsHash', type: 'bytes32' }, { name: 'versionId', type: 'bytes32' },
    { name: 'vaultCreationCodeHash', type: 'bytes32' }, { name: 'idAgentsReleaseHash', type: 'bytes32' },
    { name: 'xmtpRoomPolicyHash', type: 'bytes32' }, { name: 'factory', type: 'address' }, { name: 'predictedVault', type: 'address' },
    { name: 'owner', type: 'address' }, { name: 'refundAddress', type: 'address' }, { name: 'leadApprovalAddress', type: 'address' },
    { name: 'arbitrator', type: 'address' }, { name: 'fundingDeadline', type: 'uint64' }, { name: 'launchDeadline', type: 'uint64' },
    { name: 'expiry', type: 'uint64' }, { name: 'members', type: 'MemberTerms[]' }, { name: 'milestones', type: 'MilestoneTerms[]' },
    { name: 'signerNonces', type: 'SignerNonce[]' },
  ]),
});

const TOP = MISSION_MANIFEST_TYPES.LaunchManifest.map(({ name }) => name).concat('chainId');
const MEMBER = MISSION_MANIFEST_TYPES.MemberTerms.map(({ name }) => name);
const MILESTONE = MISSION_MANIFEST_TYPES.MilestoneTerms.map(({ name }) => name);
const ALLOCATION = MISSION_MANIFEST_TYPES.Allocation.map(({ name }) => name);
const SIGNER_NONCE = MISSION_MANIFEST_TYPES.SignerNonce.map(({ name }) => name);
const HASH = /^0x[0-9a-fA-F]{64}$/u;
const DECIMAL = /^(0|[1-9][0-9]*)$/u;

export function canonicalizeLaunchManifest(input) {
  object(input, 'manifest'); exact(input, TOP, 'manifest');
  const manifest = {
    missionId: hash(input.missionId, 'missionId'), termsHash: hash(input.termsHash, 'termsHash'), versionId: hash(input.versionId, 'versionId'),
    vaultCreationCodeHash: hash(input.vaultCreationCodeHash, 'vaultCreationCodeHash'),
    idAgentsReleaseHash: hash(input.idAgentsReleaseHash, 'idAgentsReleaseHash'),
    xmtpRoomPolicyHash: hash(input.xmtpRoomPolicyHash, 'xmtpRoomPolicyHash'),
    factory: address(input.factory, 'factory'), predictedVault: address(input.predictedVault, 'predictedVault'), owner: address(input.owner, 'owner'),
    refundAddress: address(input.refundAddress, 'refundAddress'), leadApprovalAddress: address(input.leadApprovalAddress, 'leadApprovalAddress'),
    arbitrator: address(input.arbitrator, 'arbitrator'), fundingDeadline: decimal(input.fundingDeadline, 'fundingDeadline', 64),
    launchDeadline: decimal(input.launchDeadline, 'launchDeadline', 64), expiry: decimal(input.expiry, 'expiry', 64),
    members: array(input.members, 'members').map((entry, index) => member(entry, index)),
    milestones: array(input.milestones, 'milestones').map((entry, index) => milestone(entry, index)),
    signerNonces: array(input.signerNonces, 'signerNonces').map((entry, index) => signerNonce(entry, index)),
  };
  const chainId = decimal(input.chainId, 'chainId', 256);
  for (let index = 1; index < manifest.signerNonces.length; index += 1) {
    if (BigInt(manifest.signerNonces[index - 1].signer) >= BigInt(manifest.signerNonces[index].signer)) {
      throw new TypeError('signerNonces must contain unique signers in ascending address order.');
    }
  }
  return Object.freeze({ chainId, ...manifest });
}

export function hashLaunchManifest(input) {
  const canonical = canonicalizeLaunchManifest(input);
  const { chainId, ...message } = canonical;
  return hashTypedData({
    domain: { ...MISSION_MANIFEST_DOMAIN, chainId, verifyingContract: message.factory },
    types: MISSION_MANIFEST_TYPES,
    primaryType: 'LaunchManifest',
    message,
  });
}

export function missionCreate2Salt(input) {
  object(input, 'manifest');
  return keccak256(encodeAbiParameters(
    [{ type: 'bytes32' }, { type: 'bytes32' }, { type: 'bytes32' }],
    [hash(input.missionId, 'missionId'), hash(input.versionId, 'versionId'), hash(input.termsHash, 'termsHash')],
  ));
}

export function predictMissionVaultAddress(input) {
  object(input, 'manifest');
  return getCreate2Address({
    from: address(input.factory, 'factory'),
    salt: missionCreate2Salt(input),
    bytecodeHash: hash(input.initCodeHash, 'initCodeHash'),
  });
}

function member(value, index) {
  const path = 'members[' + index + ']'; object(value, path); exact(value, MEMBER, path);
  return Object.freeze({ chainId: decimal(value.chainId, path + '.chainId', 256), collection: address(value.collection, path + '.collection'),
    tokenId: decimal(value.tokenId, path + '.tokenId', 256), canonicalAccount: address(value.canonicalAccount, path + '.canonicalAccount'),
    controller: address(value.controller, path + '.controller'), custodyEpoch: decimal(value.custodyEpoch, path + '.custodyEpoch', 64),
    settlementAddress: address(value.settlementAddress, path + '.settlementAddress'), roleHash: hash(value.roleHash, path + '.roleHash'),
    isLead: boolean(value.isLead, path + '.isLead') });
}
function milestone(value, index) {
  const path='milestones['+index+']'; object(value,path); exact(value,MILESTONE,path);
  return Object.freeze({ milestoneId:hash(value.milestoneId,path+'.milestoneId'),acceptanceHash:hash(value.acceptanceHash,path+'.acceptanceHash'),
    payoutCommitment:hash(value.payoutCommitment,path+'.payoutCommitment'),deliveryDeadline:decimal(value.deliveryDeadline,path+'.deliveryDeadline',64),
    reviewDeadline:decimal(value.reviewDeadline,path+'.reviewDeadline',64),disputeDeadline:decimal(value.disputeDeadline,path+'.disputeDeadline',64),
    payouts:allocations(value.payouts,path+'.payouts'),deliveryTimeoutAllocations:allocations(value.deliveryTimeoutAllocations,path+'.deliveryTimeoutAllocations'),
    disputeTimeoutAllocations:allocations(value.disputeTimeoutAllocations,path+'.disputeTimeoutAllocations') });
}
function allocations(value,path){return Object.freeze(array(value,path).map((entry,index)=>{const p=path+'['+index+']';object(entry,p);exact(entry,ALLOCATION,p);return Object.freeze({token:address(entry.token,p+'.token'),recipient:address(entry.recipient,p+'.recipient'),amount:decimal(entry.amount,p+'.amount',256)});}));}
function signerNonce(value,index){const path='signerNonces['+index+']';object(value,path);exact(value,SIGNER_NONCE,path);return Object.freeze({signer:address(value.signer,path+'.signer'),nonce:decimal(value.nonce,path+'.nonce',256)});}
function decimal(value,path,bits){if(typeof value!=='string'||!DECIMAL.test(value)) throw new TypeError(path+' must be a canonical decimal string.');const parsed=BigInt(value);if(parsed>=(1n<<BigInt(bits))) throw new RangeError(path+' exceeds uint'+bits+'.');return parsed;}
function address(value,path){if(typeof value!=='string'||!isAddress(value,{strict:true})) throw new TypeError(path+' must be an address.');return getAddress(value);}
function hash(value,path){if(typeof value!=='string'||!HASH.test(value)) throw new TypeError(path+' must be bytes32.');return value.toLowerCase();}
function boolean(value,path){if(typeof value!=='boolean') throw new TypeError(path+' must be boolean.');return value;}
function array(value,path){
  if(!Array.isArray(value)) throw new TypeError(path+' must be an array.');
  for(let index=0;index<value.length;index+=1){
    if(!Object.hasOwn(value,index)) throw new TypeError(path+' must not be sparse.');
    const descriptor=Object.getOwnPropertyDescriptor(value,String(index));
    if(!descriptor?.enumerable||!Object.hasOwn(descriptor,'value')) throw new TypeError(path+' must contain only enumerable data elements.');
  }
  for(const key of Reflect.ownKeys(value)){
    if(key==='length'||(typeof key==='string'&&/^(0|[1-9][0-9]*)$/u.test(key)&&Number(key)<value.length)) continue;
    throw new TypeError(path+' has unexpected array property.');
  }
  return value;
}
function object(value,path){if(value===null||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype) throw new TypeError(path+' must be a plain object.');}
function exact(value,allowed,path){
  for(const key of Reflect.ownKeys(value)){
    if(typeof key!=='string'||!allowed.includes(key)) throw new TypeError(path+' has unexpected field '+String(key)+'.');
    const descriptor=Object.getOwnPropertyDescriptor(value,key);
    if(!descriptor?.enumerable||!Object.hasOwn(descriptor,'value')) throw new TypeError(path+'.'+key+' must be an enumerable data property.');
  }
  for(const key of allowed) if(!Object.hasOwn(value,key)) throw new TypeError(path+' is missing '+key+'.');
}
