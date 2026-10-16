import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const proofRoot=path.join(root,'review-artifacts/looper-missions/local-proof');
await mkdir(proofRoot,{recursive:true});
const apiMissionTests=(await readdir(path.join(root,'apps/api/test'))).filter((name)=>/^missions-.*\.test\.mjs$/u.test(name)).sort().map((name)=>'apps/api/test/'+name);
const webMissionTests=(await readdir(path.join(root,'apps/web/test'))).filter((name)=>/^missions-.*\.test\.mjs$/u.test(name)).sort().map((name)=>'apps/web/test/'+name);
const contractMissionTests=(await readdir(path.join(root,'packages/contracts/test'))).filter((name)=>/^mission-.*\.test\.mjs$/u.test(name)).sort().map((name)=>'packages/contracts/test/'+name);
const commands=[
 ['mission-api',['node','--test',...apiMissionTests,'apps/api/test/server.test.mjs','apps/api/test/xmtp-agent.test.mjs','apps/api/test/xmtp-worker.test.mjs']],
 ['mission-web',['node','--test',...webMissionTests,'apps/web/test/multipass-console.test.mjs','apps/web/test/console-integration-regression.test.mjs','apps/web/test/mobile-layout.test.mjs']],
 ['mission-contracts',['node','--test',...contractMissionTests]],
 ['mission-compile',['pnpm','--filter','@helixa/loopers-contracts','compile:missions']],
 ['forge-invariants',[path.join(process.env.HOME||'/home/ubuntu','.foundry/bin/forge'),'test','--root','packages/contracts','-vv']],
 ['web-build',['pnpm','--filter','@helixa/multipass-web','build']],
 ['ui-proof',['node','scripts/missions/capture-ui-proof.mjs']],
 ['diff-check',['git','diff','--check']],
];
const results=[];
for(const [name,args] of commands){const [command,...rest]=args;const run=spawnSync(command,rest,{cwd:root,encoding:'utf8',env:{...process.env,CHROMIUM_PATH:process.env.CHROMIUM_PATH||'/snap/bin/chromium'},maxBuffer:16*1024*1024});const combined=(run.stdout||'')+(run.stderr||'');results.push({name,status:run.status===0?'passed':'failed',exitCode:run.status,outputSha256:sha256(combined),outputTail:combined.slice(-4000)});if(run.status!==0)break;}
const scan=await scanMissionSources();
results.push({name:'secret-scan',status:scan.matches.length===0?'passed':'failed',exitCode:scan.matches.length===0?0:1,outputSha256:sha256(JSON.stringify(scan)),outputTail:JSON.stringify(scan)});
const release=JSON.parse(await readFile(path.join(root,'apps/api/src/missions/id-agents-release.json'),'utf8'));
const external=[];
const idAgentsSource=process.env.ID_AGENTS_SOURCE||'/tmp/id-agents-pin';
try{const packageHash=sha256(await readFile(path.join(idAgentsSource,'package.json')));external.push({name:'pinned-id-agents-source',status:packageHash===release.hashes['package.json']?'passed':'failed',commit:release.commit,packageHash});}catch{external.push({name:'pinned-id-agents-source',status:'blocked',reason:'Pinned source checkout unavailable.'});}
external.push({name:'real-xmtp-dev-group',status:'blocked',reason:'Requires explicit authorization to create an external XMTP group with a bridge identity.'});
external.push({name:'base-testnet-deployment',status:'blocked',reason:'Separate review and explicit approval required before deployment or funding.'});
const artifacts=await inventory(proofRoot);
const git=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).stdout.trim();
const manifest={schemaVersion:1,product:'Swarm Command',generatedAt:new Date().toISOString(),commit:git,status:results.every((item)=>item.status==='passed')?'local_gates_passed_external_actions_blocked':'failed',commands:results,externalBoundaries:external,artifacts,coverage:{lifecycle:['create','publish','select','fund','launch','tasks','artifacts','approve','release','dispute','refund'],failurePaths:['partial_funding','ambiguous_vault','runtime_timeout','room_ambiguity','custody_transfer','reorg','arbitrator_timeout','restart_recovery']}};
await writeFile(path.join(proofRoot,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({status:manifest.status,commit:git,commands:results.map(({name,status})=>({name,status})),external}));
if(results.some((item)=>item.status!=='passed'))process.exitCode=1;

function sha256(value){return createHash('sha256').update(value).digest('hex');}
async function scanMissionSources(){const roots=['apps/api/src/missions','apps/web/src/missions','scripts/missions','docs/runbooks'];const matches=[];for(const relative of roots){await walk(path.join(root,relative));}return{matches};async function walk(directory){for(const entry of await readdir(directory,{withFileTypes:true})){const filename=path.join(directory,entry.name);if(entry.isDirectory()){await walk(filename);continue;}if(!entry.isFile())continue;const text=await readFile(filename,'utf8');if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:^|[^A-Za-z0-9])(?:sk-[A-Za-z0-9_-]{24,}|bk_[A-Za-z0-9_-]{24,})/mu.test(text))matches.push(path.relative(root,filename));}}}
async function inventory(directory){const files=[];for(const name of (await readdir(directory)).sort()){if(name==='manifest.json')continue;const filename=path.join(directory,name);const info=await stat(filename);if(info.isFile())files.push({path:path.relative(root,filename),bytes:info.size,sha256:sha256(await readFile(filename))});}return files;}
