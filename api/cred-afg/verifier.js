'use strict';

const { createPublicKey, verify } = require('node:crypto');
const { concat, keccak256, toBeHex, toUtf8Bytes, zeroPadValue } = require('ethers');
const { canonicalStringify } = require('../cred-shadow/artifact');

const BASE_CHAIN_ID = '8453';
const PINNED_AFG_KEY_ID = 'afg-stmt-ed25519-8cda0c3066b3a73c';
const PINNED_AFG_PUBLIC_KEY_HEX = 'c715aa7433d2197091cae36fa2fe12d796de8f5029204f7ac4906363262efc49';
const ROOT_MESSAGE_PREFIX = 'afg-statement-root:v1:';
const DEFAULT_MAX_AGE_SECONDS = 9 * 60 * 60;
const HASH_PATTERN = /^0x[0-9a-f]{64}$/u;
const ADDRESS_PATTERN = /^0x[0-9a-f]{40}$/u;
const UINT_PATTERN = /^(0|[1-9][0-9]*)$/u;
const STATEMENT_FIELDS = Object.freeze(['agentId','chainId','definitionId','flags','inCount','inSum','leftControl','outCount','outSum','prevHash','publisher','routeSum','ruleId','scrapeTime','spendSum','uncheckedSum','wallet','windowEnd','windowStart']);
const AMOUNT_FIELDS = Object.freeze(['inCount','inSum','leftControl','outCount','outSum','routeSum','scrapeTime','spendSum','uncheckedSum','windowEnd','windowStart']);

function plain(value,label){if(value===null||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype)throw new TypeError(label+' must be a plain object');return value;}
function exact(value,fields,label){plain(value,label);const expected=new Set(fields),keys=Reflect.ownKeys(value);for(const key of keys)if(typeof key!=='string'||!expected.has(key))throw new TypeError(label+' has unknown field '+String(key));for(const field of fields)if(!Object.hasOwn(value,field))throw new TypeError(label+' is missing field '+field);return value;}
function hash(value,label){if(typeof value!=='string'||!HASH_PATTERN.test(value))throw new TypeError(label+' must be a lowercase bytes32 hash');return value;}
function uint(value,label){if(typeof value!=='string'||!UINT_PATTERN.test(value)||BigInt(value)>=(1n<<256n))throw new TypeError(label+' must be a canonical uint256 decimal string');return value;}
function iso(value,label){if(typeof value!=='string'||new Date(Date.parse(value)).toISOString()!==value)throw new TypeError(label+' must be canonical ISO time');return value;}
function epochFromIso(value,label){return Math.floor(Date.parse(iso(value,label))/1000);}
function safeEpoch(value,label){if(!Number.isSafeInteger(value)||value<0)throw new TypeError(label+' must be a nonnegative safe epoch second');return value;}
function strictBase64(value,label){if(typeof value!=='string'||value.length===0)throw new TypeError(label+' must be base64');const bytes=Buffer.from(value,'base64');if(bytes.toString('base64')!==value)throw new TypeError(label+' must be canonical base64');return bytes;}
function freeze(value){if(value===null||typeof value!=='object'||Object.isFrozen(value))return value;for(const item of Object.values(value))freeze(item);return Object.freeze(value);}
function sortedPairHash(left,right){const a=Buffer.from(hash(left,'Merkle hash').slice(2),'hex'),b=Buffer.from(hash(right,'Merkle hash').slice(2),'hex');return keccak256(Buffer.compare(a,b)<=0?Buffer.concat([a,b]):Buffer.concat([b,a]));}
function rawPublicKey(keyHex){if(keyHex!==PINNED_AFG_PUBLIC_KEY_HEX)throw new Error('roots metadata does not use the pinned AFG key');return createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),Buffer.from(keyHex,'hex')]),format:'der',type:'spki'});}
function normalizeStatement(statement){
  exact(statement,STATEMENT_FIELDS,'statement');
  uint(statement.agentId,'statement.agentId');
  if(statement.chainId!==BASE_CHAIN_ID)throw new Error('statement is not bound to Base chain 8453');
  if(statement.definitionId!=='agent.statement.v1'||statement.publisher!=='agenticfinancegraph.com'||statement.ruleId!=='afg.pay.partition.v1')throw new Error('statement provenance is invalid');
  if(!ADDRESS_PATTERN.test(statement.wallet))throw new TypeError('statement.wallet must be a lowercase EVM address');
  hash(statement.prevHash,'statement.prevHash');
  if(!Array.isArray(statement.flags)||statement.flags.some(flag=>typeof flag!=='string'))throw new TypeError('statement.flags must be an array of strings');
  for(const field of AMOUNT_FIELDS)uint(statement[field],'statement.'+field);
  if(BigInt(statement.windowEnd)-BigInt(statement.windowStart)!==10800n)throw new Error('statement root window must cover exactly three hours');
  if(BigInt(statement.scrapeTime)<BigInt(statement.windowEnd))throw new Error('statement scrapeTime precedes its closed window');
  return statement;
}
function rootMessage(statement,latest){return ROOT_MESSAGE_PREFIX+statement.windowStart+':'+statement.windowEnd+':'+latest.root+':'+latest.prev_root+':'+String(latest.leaves);}

function verifyAfgSignedStatement(recordInput,rootsInput,options={}){
  const record=plain(recordInput,'statement response'),roots=plain(rootsInput,'roots response'),expectedAccount=options.expectedAccount;
  if(typeof expectedAccount!=='string'||!ADDRESS_PATTERN.test(expectedAccount))throw new TypeError('expectedAccount must be a lowercase EVM address');
  const now=safeEpoch(options.nowEpochSeconds===undefined?Math.floor(Date.now()/1000):options.nowEpochSeconds,'nowEpochSeconds');
  const maxAge=safeEpoch(options.maxAgeSeconds===undefined?DEFAULT_MAX_AGE_SECONDS:options.maxAgeSeconds,'maxAgeSeconds');
  if(record.chain_ok!==true)throw new Error('AFG chain_ok must be true');
  if(record.stale!==false)throw new Error('AFG statement is stale');
  const latest=plain(record.latest,'record.latest'),statement=normalizeStatement(plain(latest.statement,'record.latest.statement'));
  if(statement.wallet!==expectedAccount)throw new Error('AFG exact account binding failed');
  if(record.agent_id!==statement.agentId||record.token_id!==statement.agentId)throw new Error('AFG agent id binding failed');
  if(latest.prev_hash!==statement.prevHash)throw new Error('statement prevHash linkage is inconsistent');
  if(statement.flags.length!==0)throw new Error('AFG statement flags are not empty');
  const canonical=canonicalStringify(statement);
  if(latest.canonical!==canonical)throw new Error('AFG canonical statement bytes do not match the statement');
  const statementHash=keccak256(toUtf8Bytes(canonical));
  if(statementHash!==hash(latest.hash,'statement hash'))throw new Error('AFG canonical statement hash mismatch');
  const leaf=keccak256(concat([zeroPadValue(toBeHex(BigInt(statement.agentId)),32),statementHash]));
  if(leaf!==hash(latest.leaf,'statement leaf'))throw new Error('AFG uint256 agent leaf mismatch');
  if(!Array.isArray(latest.proof)||latest.proof.length>64)throw new RangeError('AFG Merkle proof is invalid');
  let folded=leaf;for(const sibling of latest.proof)folded=sortedPairHash(folded,sibling);
  if(folded!==hash(latest.root,'statement root'))throw new Error('AFG sorted-pair Merkle proof mismatch');
  if(!Number.isSafeInteger(latest.leaves)||latest.leaves<1||!Number.isSafeInteger(latest.leaf_index)||latest.leaf_index<0||latest.leaf_index>=latest.leaves)throw new RangeError('AFG leaf metadata is invalid');
  if(latest.key_id!==PINNED_AFG_KEY_ID||roots.key?.key_id!==PINNED_AFG_KEY_ID||roots.key?.alg!=='Ed25519')throw new Error('statement does not use the pinned AFG key');
  const start=Number(BigInt(statement.windowStart)),end=Number(BigInt(statement.windowEnd));
  if(epochFromIso(latest.window_start,'latest.window_start')!==start||epochFromIso(latest.window_end,'latest.window_end')!==end)throw new Error('AFG root window timestamps are inconsistent');
  if(now<end||now-end>maxAge)throw new Error('AFG statement is stale for the configured freshness window');
  if(!Array.isArray(roots.windows)||roots.windows.length===0)throw new Error('AFG roots response has no windows');
  const rootWindow=roots.windows.find(window=>window.window_start===latest.window_start&&window.window_end===latest.window_end);
  if(!rootWindow||rootWindow.root!==latest.root||rootWindow.prev_root!==latest.prev_root||rootWindow.leaves!==latest.leaves||rootWindow.signature!==latest.root_signature||rootWindow.key_id!==latest.key_id||rootWindow.published_at!==latest.published_at)throw new Error('AFG root window does not match the signed statement');
  const signature=strictBase64(latest.root_signature,'root signature');if(signature.length!==64)throw new TypeError('root signature must be 64 bytes');
  if(!verify(null,Buffer.from(rootMessage(statement,latest),'utf8'),rawPublicKey(roots.key.public_key_hex),signature))throw new Error('AFG root signature verification failed');
  return freeze({observationType:'afg-verified-statement-observation-v1',verified:true,source:'agenticfinancegraph.com',chainId:BASE_CHAIN_ID,agentId:statement.agentId,account:statement.wallet,windowStart:statement.windowStart,windowEnd:statement.windowEnd,statementHash,leaf,root:latest.root,prevRoot:latest.prev_root,proof:[...latest.proof],leafIndex:latest.leaf_index,leaves:latest.leaves,keyId:latest.key_id,rootSignature:latest.root_signature,signatureScope:'afg-statement-root-v1',scoreEligible:false,credNativeSignature:false,reasonCodes:['AFG_NOT_CRED_NATIVE','EXTERNAL_OBSERVATION_ONLY']});
}

module.exports=Object.freeze({BASE_CHAIN_ID,PINNED_AFG_KEY_ID,PINNED_AFG_PUBLIC_KEY_HEX,ROOT_MESSAGE_PREFIX,DEFAULT_MAX_AGE_SECONDS,verifyAfgSignedStatement});
