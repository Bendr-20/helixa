#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const cp=require('node:child_process');
const {spoolContention}=require('../cred-payments/operations-lock');

function stateArg(argv){
 const hits=[];
 for(let i=0;i<argv.length;i++)if(argv[i]==='--state-dir')hits.push(argv[i+1]);
 if(hits.length!==1||!path.isAbsolute(hits[0]))throw new Error('exactly one absolute --state-dir is required');
 return hits[0];
}
function prepareLock(state,bootstrap){
 if(path.normalize(state)!==state)throw new Error('state directory must be normalized');
 if(bootstrap){for(const dir of [state,path.join(state,'locks')])try{fs.mkdirSync(dir,{mode:0o700});}catch(error){if(error.code!=='EEXIST')throw error;}}
 for(const dir of [state,path.join(state,'locks')]){const st=fs.lstatSync(dir);if(st.isSymbolicLink()||!st.isDirectory()||fs.realpathSync(dir)!==dir)throw new Error('lock path traverses symlink');}
 const lock=path.join(state,'locks','mutation.lock'),fd=fs.openSync(lock,fs.constants.O_RDWR|fs.constants.O_CREAT|fs.constants.O_NOFOLLOW,0o600),st=fs.fstatSync(fd);if(!st.isFile()||st.uid!==process.getuid())throw new Error('invalid mutation lock');fs.fchmodSync(fd,0o600);return {lock,fd,stat:st};
}
function capability(state,mode,lock){
 const nonce=crypto.randomBytes(32).toString('hex');
 const name=path.join(state,'locks','.cap-'+process.pid+'-'+crypto.randomBytes(16).toString('hex'));
 const fd=fs.openSync(name,fs.constants.O_RDWR|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,0o600);
 try{
  const bytes=Buffer.from('HELIXA-PAYMENT-CAPABILITY-v2\0'+nonce+'\0'+state+'\0'+mode+'\0'+lock.stat.dev+'\0'+lock.stat.ino,'utf8');
  let off=0;while(off<bytes.length)off+=fs.writeSync(fd,bytes,off,bytes.length-off,off);
  fs.fsyncSync(fd);fs.unlinkSync(name);
  return {fd,nonce};
 }catch(error){try{fs.closeSync(fd);}catch{}try{fs.unlinkSync(name);}catch{}throw error;}
}
function main(){
 const argv=process.argv.slice(2),mode=argv.shift();
 if(!['bootstrap','validate','follow-up','recover','shadow','cron-install','cron-remove','review','archive'].includes(mode))throw new Error('unknown operation mode');
 const state=stateArg(argv);
 if(['cron-install','cron-remove','review'].includes(mode)&&state!=='/home/ubuntu/.local/state/helixa/cred-payments')throw new Error('global cron mutation requires production state directory');
 const lock=prepareLock(state,mode==='bootstrap');
 const script=mode==='shadow'?path.join(__dirname,'run-looper-payment-shadow.js'):mode.startsWith('cron-')?path.join(__dirname,'manage-looper-payment-cron.js'):['review','archive'].includes(mode)?path.join(__dirname,'manage-looper-payment-retention.js'):path.join(__dirname,'operate-looper-payments.js');
 const internalMode=mode==='cron-install'?'install':mode==='cron-remove'?'remove':mode;
 const cap=capability(state,internalMode,lock);
 const env={...process.env,HELIXA_PAYMENT_CAPABILITY_FD:'3',HELIXA_PAYMENT_LOCK_FD:'4',HELIXA_PAYMENT_CAPABILITY_NONCE:cap.nonce};
 const acquired=cp.spawnSync('/usr/bin/flock',['-n','-E','75','4'],{stdio:['ignore','inherit','inherit','ignore',lock.fd]});
 if(acquired.status===75){fs.closeSync(cap.fd);fs.closeSync(lock.fd);
  try{
   const requestId=crypto.randomBytes(16).toString('hex');
   const result=spoolContention(state,{executionMode:mode==='shadow'?'scheduled':mode==='follow-up'?'manual':mode==='recover'?'recovery':'bootstrap',observedAt:new Date().toISOString(),requestId,pid:process.pid});
   if(result.stderr)process.stderr.write(result.stderr);process.exit(result.exitCode);
  }catch{process.stderr.write('{"code":"CONTENTION_SPOOL_FULL","severity":"critical"}\n');process.exit(74);}
 }
 if(acquired.status!==0){fs.closeSync(cap.fd);fs.closeSync(lock.fd);throw new Error('flock acquisition failed');}
 let child;try{child=cp.spawnSync(process.execPath,[script,internalMode,...argv],{stdio:['inherit','inherit','inherit',cap.fd,lock.fd],env});}finally{fs.closeSync(cap.fd);fs.closeSync(lock.fd);}
 process.exit(child.status??1);
}
try{main();}catch(e){process.stderr.write(JSON.stringify({code:e.code||'OPERATION_LAUNCH_FAILED',message:e.message})+'\n');process.exit(1);}
