#!/usr/bin/env node
'use strict';
const {collectAfgAddressScans}=require('../cred-afg/collector');const {readJson,safeOutput,writeJsonExclusive}=require('../cred-looper/files');
function usage(){return 'Usage: collect-looper-afg.js --roster <roster.json> --output <collection.json>';}
function parseArgs(argv){const options={};for(let i=0;i<argv.length;i+=1){const arg=argv[i];if(!['--roster','--output'].includes(arg))throw new TypeError('unknown flag '+arg);if(i+1>=argv.length||argv[i+1].startsWith('--'))throw new TypeError(arg+' requires a value');options[arg.slice(2)]=argv[++i];}for(const key of ['roster','output'])if(!options[key])throw new TypeError('--'+key+' is required');return options;}
async function main(argv,{collect=collectAfgAddressScans}={}){const options=parseArgs(argv),outputPath=safeOutput(options.output),roster=readJson(options.roster,'roster'),collection=await collect(roster);writeJsonExclusive(outputPath,collection);return {outputPath,rosterHash:collection.rosterHash,lookupSourceAsOf:collection.lookupSourceAsOf,rootsAsOf:collection.rootsAsOf,accountRows:collection.accountScan.rowCount,ownerRows:collection.ownerScan.rowCount,directMatchCount:collection.accountScan.directMatchCount,ownerContextMatchCount:collection.ownerScan.contextMatchOwnerCount};}
if(require.main===module)main(process.argv.slice(2)).then(value=>process.stdout.write(JSON.stringify(value)+String.fromCharCode(10))).catch(error=>{process.stderr.write(error.message+String.fromCharCode(10)+usage()+String.fromCharCode(10));process.exitCode=1;});
module.exports=Object.freeze({parseArgs,main});
