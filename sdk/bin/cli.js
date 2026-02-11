#!/usr/bin/env node

/**
 * AgentDNA CLI
 * Usage:
 *   npx agentdna scan ./my-agent/          # Auto-detect and preview metadata
 *   npx agentdna mint ./my-agent/          # Scan + mint on Base
 *   npx agentdna mutate <tokenId> <version> # Record version mutation
 *   npx agentdna trait <tokenId> <name>     # Add trait to agent
 *   npx agentdna lookup <address|tokenId>   # Look up agent
 */

import { autoDetect } from '../lib/detector.js';
import { buildMetadata, metadataToDataURI, validateMetadata } from '../lib/metadata.js';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const CONTRACT_ADDRESS = process.env.AGENTDNA_CONTRACT || "0x665971e7bf8ec90c3066162c5b396604b3cd7711";
const RPC_URL = process.env.AGENTDNA_RPC || "https://sepolia.base.org";

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  switch (command) {
    case 'scan':
      return handleScan(args[1]);
    case 'mint':
      return handleMint(args[1]);
    case 'mutate':
      return handleMutate(args[1], args[2], args[3]);
    case 'trait':
      return handleTrait(args[1], args[2], args[3]);
    case 'lookup':
      return handleLookup(args[1]);
    case 'help':
    case '--help':
    case '-h':
      return showHelp();
    default:
      console.log('Unknown command. Run `agentdna help` for usage.');
      process.exit(1);
  }
}

function handleScan(dir) {
  if (!dir) {
    console.error('Usage: agentdna scan <agent-directory>');
    process.exit(1);
  }

  const agentDir = resolve(dir);
  if (!existsSync(agentDir)) {
    console.error(`Directory not found: ${agentDir}`);
    process.exit(1);
  }

  console.log(`\n🧬 Scanning ${agentDir}...\n`);
  
  const detected = autoDetect(agentDir);
  const metadata = buildMetadata(detected);
  const validation = validateMetadata(metadata);

  console.log('📋 Auto-detected Agent Data:');
  console.log('─'.repeat(50));
  console.log(`  Name:         ${detected.name}`);
  console.log(`  Framework:    ${detected.framework}`);
  console.log(`  Model:        ${detected.model || '(not detected)'}`);
  console.log(`  Version:      ${detected.version}`);
  console.log(`  Capabilities: ${detected.capabilities.length > 0 ? detected.capabilities.join(', ') : '(none detected)'}`);
  console.log(`  Source Repo:  ${detected.sourceRepo || '(not detected)'}`);
  console.log('─'.repeat(50));

  if (!validation.valid) {
    console.log('\n⚠️  Validation warnings:');
    validation.errors.forEach(e => console.log(`  - ${e}`));
  }

  console.log('\n📦 ERC-8004 Metadata:');
  console.log(JSON.stringify(metadata, null, 2));

  console.log('\n✅ Ready to mint! Run: agentdna mint ' + dir);
}

async function handleMint(dir) {
  if (!dir) {
    console.error('Usage: agentdna mint <agent-directory>');
    process.exit(1);
  }

  const agentDir = resolve(dir);
  const detected = autoDetect(agentDir);
  const metadata = buildMetadata(detected);
  const dataURI = metadataToDataURI(metadata);

  console.log(`\n🧬 AgentDNA Mint`);
  console.log('─'.repeat(50));
  console.log(`  Agent:     ${detected.name}`);
  console.log(`  Framework: ${detected.framework}`);
  console.log(`  Version:   ${detected.version}`);
  console.log(`  Contract:  ${CONTRACT_ADDRESS}`);
  console.log(`  Network:   ${RPC_URL}`);
  console.log('─'.repeat(50));

  if (CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000") {
    console.log('\n❌ Contract not deployed yet. Set AGENTDNA_CONTRACT env variable.');
    console.log('   Example: AGENTDNA_CONTRACT=0x... agentdna mint ./my-agent/');
    process.exit(1);
  }

  // In production, this would use ethers.js to call the contract
  console.log('\n🚀 Minting...');
  console.log('   (Contract interaction requires ethers.js — install with npm i ethers)');
  console.log('\n   Manual mint command (using cast):');
  console.log(`   cast send ${CONTRACT_ADDRESS} \\`);
  console.log(`     "mint(address,string,string,string,bool,string,uint256)" \\`);
  console.log(`     <AGENT_WALLET> "${detected.name}" "${detected.framework}" \\`);
  console.log(`     "${dataURI.substring(0, 50)}..." false "${detected.version}" \\`);
  console.log(`     ${BigInt(2n**256n - 1n).toString()} \\`);
  console.log(`     --value 0.01ether --rpc-url ${RPC_URL} --private-key <KEY>`);
}

function handleMutate(tokenId, version, description) {
  if (!tokenId || !version) {
    console.error('Usage: agentdna mutate <tokenId> <newVersion> [description]');
    process.exit(1);
  }

  console.log(`\n🔄 Mutation`);
  console.log(`  Token ID:    ${tokenId}`);
  console.log(`  New Version: ${version}`);
  console.log(`  Description: ${description || '(none)'}`);
  console.log(`\n  cast send ${CONTRACT_ADDRESS} \\`);
  console.log(`    "mutate(uint256,string,string,string)" \\`);
  console.log(`    ${tokenId} "${version}" "${description || ''}" "" \\`);
  console.log(`    --rpc-url ${RPC_URL} --private-key <KEY>`);
}

function handleTrait(tokenId, name, category) {
  if (!tokenId || !name) {
    console.error('Usage: agentdna trait <tokenId> <name> [category]');
    process.exit(1);
  }

  console.log(`\n🧬 Add Trait`);
  console.log(`  Token ID: ${tokenId}`);
  console.log(`  Trait:    ${name}`);
  console.log(`  Category: ${category || 'capability'}`);
  console.log(`\n  cast send ${CONTRACT_ADDRESS} \\`);
  console.log(`    "addTrait(uint256,string,string)" \\`);
  console.log(`    ${tokenId} "${name}" "${category || 'capability'}" \\`);
  console.log(`    --rpc-url ${RPC_URL} --private-key <KEY>`);
}

function handleLookup(query) {
  if (!query) {
    console.error('Usage: agentdna lookup <address|tokenId>');
    process.exit(1);
  }

  const isAddress = query.startsWith('0x') && query.length === 42;
  
  console.log(`\n🔍 Looking up: ${query}`);
  if (isAddress) {
    console.log(`\n  cast call ${CONTRACT_ADDRESS} \\`);
    console.log(`    "getAgentByAddress(address)(uint256,(address,string,string,uint256,bool,bool,uint256,uint256,string,uint256))" \\`);
    console.log(`    ${query} --rpc-url ${RPC_URL}`);
  } else {
    console.log(`\n  cast call ${CONTRACT_ADDRESS} \\`);
    console.log(`    "getAgent(uint256)((address,string,string,uint256,bool,bool,uint256,uint256,string,uint256))" \\`);
    console.log(`    ${query} --rpc-url ${RPC_URL}`);
  }
}

function showHelp() {
  console.log(`
🧬 AgentDNA CLI — Identity infrastructure for AI agents

USAGE:
  agentdna <command> [options]

COMMANDS:
  scan <dir>                        Auto-detect agent config and preview metadata
  mint <dir>                        Scan + mint AgentDNA NFT on Base
  mutate <tokenId> <version> [desc] Record a version mutation
  trait <tokenId> <name> [category] Add a trait/capability to agent
  lookup <address|tokenId>          Look up an agent's DNA
  help                              Show this help

ENVIRONMENT:
  AGENTDNA_CONTRACT   Contract address (required for onchain operations)
  AGENTDNA_RPC        RPC URL (default: https://sepolia.base.org)
  PRIVATE_KEY         Wallet private key for transactions

EXAMPLES:
  agentdna scan ./my-eliza-agent/
  agentdna mint ./my-langchain-bot/
  agentdna mutate 0 "2.0.0" "Added trading module"
  agentdna trait 0 "Vision Update" "model"
  agentdna lookup 0xA1B2C3...

SUPPORTED FRAMEWORKS:
  • ElizaOS (character.json)
  • OpenClaw (SOUL.md + TOOLS.md)
  • LangChain (config.json + package.json)
  • CrewAI (crewai.yaml)
  • Custom (manual metadata)

Learn more: https://agentdna.xyz
`);
}

main().catch(console.error);
