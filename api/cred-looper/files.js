'use strict';
const fs=require('node:fs');const path=require('node:path');
const MAX_JSON_BYTES=16*1024*1024,MAX_KEY_BYTES=16*1024;
function localFile(value,label,maxBytes=MAX_JSON_BYTES){const absolute=path.resolve(value),stat=fs.lstatSync(absolute);if(!stat.isFile())throw new TypeError(label+' must be a regular local file');if(fs.realpathSync(absolute)!==absolute)throw new Error(label+' may not traverse symlinks');if(stat.size===0||stat.size>maxBytes)throw new RangeError(label+' file size is invalid');return {absolute,stat};}
function readJson(value,label){const {absolute}=localFile(value,label);let parsed;try{parsed=JSON.parse(fs.readFileSync(absolute,'utf8'));}catch(error){throw new SyntaxError('invalid '+label+' JSON: '+error.message);}return parsed;}
function readPrivateKey(value){const {absolute,stat}=localFile(value,'private key',MAX_KEY_BYTES);if((stat.mode&0o077)!==0)throw new Error('private key permissions must deny group and other access');return fs.readFileSync(absolute);}
function safeOutput(value){if(path.extname(value).toLowerCase()!=='.json')throw new TypeError('output must use .json');const absolute=path.resolve(value),parent=path.dirname(absolute),realParent=fs.realpathSync(parent),target=path.join(realParent,path.basename(absolute));if(target!==absolute)throw new Error('output path may not traverse symlinks');if(fs.existsSync(target))throw new Error('output already exists');return target;}
function writeJsonExclusive(target,value){const output=JSON.stringify(value,null,2)+'\n',fd=fs.openSync(target,'wx',0o600);try{fs.writeFileSync(fd,output,'utf8');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}fs.chmodSync(target,0o600);}
module.exports=Object.freeze({MAX_JSON_BYTES,MAX_KEY_BYTES,localFile,readJson,readPrivateKey,safeOutput,writeJsonExclusive});
