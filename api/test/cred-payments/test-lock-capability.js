'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const cp=require('node:child_process');
const {consumeLauncherCapability}=require('../../cred-payments/operations-lock');
function acquireTestCapability(stateDir,mode='test'){
 fs.mkdirSync(stateDir,{recursive:true,mode:0o700});fs.mkdirSync(path.join(stateDir,'locks'),{recursive:true,mode:0o700});
 const lockPath=path.join(stateDir,'locks','mutation.lock'),lockFd=fs.openSync(lockPath,fs.constants.O_RDWR|fs.constants.O_CREAT|fs.constants.O_NOFOLLOW,0o600),lockStat=fs.fstatSync(lockFd);
 const stdio=['ignore','ignore','ignore'];while(stdio.length<=lockFd)stdio.push('ignore');stdio[lockFd]=lockFd;const acquired=cp.spawnSync('/usr/bin/flock',['-n',String(lockFd)],{stdio});if(acquired.status!==0){try{fs.closeSync(lockFd);}catch{}throw new Error('test lock acquisition failed');}
 const nonce=crypto.randomBytes(32).toString('hex'),name=path.join(stateDir,'locks','.cap-'+crypto.randomBytes(8).toString('hex')),capFd=fs.openSync(name,fs.constants.O_RDWR|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,0o600),bytes=Buffer.from('HELIXA-PAYMENT-CAPABILITY-v2\0'+nonce+'\0'+stateDir+'\0'+mode+'\0'+lockStat.dev+'\0'+lockStat.ino);
 fs.writeSync(capFd,bytes,0,bytes.length,0);fs.fsyncSync(capFd);fs.unlinkSync(name);process.env.HELIXA_PAYMENT_CAPABILITY_FD=String(capFd);process.env.HELIXA_PAYMENT_LOCK_FD=String(lockFd);process.env.HELIXA_PAYMENT_CAPABILITY_NONCE=nonce;
 try{const token=consumeLauncherCapability(stateDir,mode);let released=false;return {token,lockFd,unlockWithoutClose(){const stdio=['ignore','ignore','ignore'];while(stdio.length<=lockFd)stdio.push('ignore');stdio[lockFd]=lockFd;const out=cp.spawnSync('/usr/bin/flock',['-u',String(lockFd)],{stdio});if(out.status!==0)throw new Error('test unlock failed');},release(){if(released)return;released=true;try{fs.closeSync(lockFd);}catch{}try{fs.closeSync(capFd);}catch{}}};}catch(error){try{fs.closeSync(lockFd);}catch{}try{fs.closeSync(capFd);}catch{}throw error;}
}
module.exports={acquireTestCapability};
