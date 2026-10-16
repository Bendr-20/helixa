import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../apps/web/package.json', import.meta.url));
const { chromium } = require('playwright-core');
import { renderMissionWorkspace } from '../../apps/web/src/missions/mission-workspace.js';
import { renderMissionSettlement } from '../../apps/web/src/missions/mission-settlement.js';

const root = path.resolve(new URL('../../', import.meta.url).pathname);
const output = path.join(root, 'review-artifacts/looper-missions/local-proof');
await mkdir(output, { recursive: true });
const css = await readFile(path.join(root, 'apps/web/src/styles.css'), 'utf8');
const A=(v)=>'0x'+v.repeat(40).slice(0,40), H=(v)=>v.repeat(64).slice(0,64);
const workspace={missionId:'mission-proof',chat:{items:[{title:'Private XMTP room',status:'current'}],source:{label:'xmtp',status:'current'}},tasks:{items:[{taskId:'task-1',title:'Build launch proof',status:'doing'}],source:{label:'id_agents',status:'current'}},agents:{items:[{title:'Builder',status:'healthy'}],source:{label:'id_agents',status:'current'}},artifacts:{items:[{artifactHash:H('a'),status:'review'}],source:{label:'id_agents',status:'current'}},milestones:{items:[{title:'MVP proof',status:'submitted'}],source:{label:'helixa_ledger',status:'current'}},funding:{items:[{title:'USDC funded',status:'finalized'}],source:{label:'onchain',status:'current'}},blockers:{items:[],source:{label:'helixa_ledger',status:'current'}}};
const settlement={milestoneId:'mvp-proof',artifactCommitment:H('a'),payoutCommitment:H('b'),approvals:{owner:true,lead:true},allocations:[{token:A('1'),recipient:A('2'),amountRaw:'1000000',symbol:'USDC'}],finality:'unsubmitted',disputeStatus:'none',source:{label:'onchain',status:'current'},simulation:{ok:true,status:'passed'},immutableTermsConfirmed:true,requiredByToken:{[A('1')]:'1000000'}};
const html='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body>'+renderMissionWorkspace({title:'Launch proof mission',workspace})+renderMissionSettlement(settlement)+'</body></html>';
if (/manager_location|credential|conversation_id|private_key/iu.test(html)) throw new Error('UI fixture leaked internal topology.');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/snap/bin/chromium',args:['--no-sandbox']});
const results=[];
try{for(const width of [1200,390,320]){const page=await browser.newPage({viewport:{width,height:900}});await page.setContent(html,{waitUntil:'load'});const proof=await page.evaluate(()=>{const button=document.querySelector('button');button?.focus();return{documentOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,bodyOverflow:document.body.scrollWidth-document.body.clientWidth,focusTag:document.activeElement?.tagName,buttonCount:document.querySelectorAll('button').length};});if(proof.documentOverflow>0||proof.bodyOverflow>0)throw new Error('Horizontal overflow at '+width);if(proof.focusTag!=='BUTTON')throw new Error('Focus proof failed at '+width);const file='swarm-command-'+width+'.png';await page.screenshot({path:path.join(output,file),fullPage:true});results.push({width,file,...proof});await page.close();}}finally{await browser.close();}
await writeFile(path.join(output,'ui-proof.json'),JSON.stringify({generatedAt:new Date().toISOString(),results},null,2)+'\n');
console.log(JSON.stringify(results));
