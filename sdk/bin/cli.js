#!/usr/bin/env node

/**
 * AgentDNA CLI — Helixa V2
 * 
 * Usage:
 *   npx agentdna scan ./my-agent/           # Auto-detect and preview metadata
 *   npx agentdna mint ./my-agent/           # Scan + generate mint command
 *   npx agentdna mint-api                   # Mint via V2 API (SIWA + x402)
 *   npx agentdna lookup --id <tokenId>      # Look up agent via V2 API
 *   npx agentdna cred --id <tokenId>        # Check cred score
 *   npx agentdna mutate <tokenId> <version> # Record version mutation
 *   npx agentdna trait <tokenId> <name>     # Add trait to agent
 */

import { autoDetect } from '../lib/detector.js';
import { buildMetadata, metadataToDataURI, validateMetadata } from '../lib/metadata.js';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const V2_API = process.env.HELIXA_API || 'https://api.helixa.xyz';
const CONTRACT_ADDRESS = process.env.AGENTDNA_CONTRACT || "0x2e3B541C59D38b84E3Bc54e977200230A204Fe60";
const RPC_URL = process.env.AGENTDNA_RPC || "https://mainnet.base.org";

const args = process.argv.slice(2);
const command = args[0];

function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : null;
}

async function main() {
  switch (command) {
    case 'scan':
      return handleScan(args[1]);
    case 'mint':
      return handleMint(args[1]);
    case 'mint-api':
      return handleMintAPI();
    case 'lookup':
      return handleLookupV2();
    case 'cred':
      return handleCred();
    case 'mutate':
      return handleMutate(args[1], args[2], args[3]);
    case 'trait':
      return handleTrait(args[1], args[2], args[3]);
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

  console.log(`\n🧬 AgentDNA Mint`);
  console.log('─'.repeat(50));
  console.log(`  Agent:     ${detected.name}`);
  console.log(`  Framework: ${detected.framework}`);
  console.log(`  Version:   ${detected.version}`);
  console.log(`  Contract:  ${CONTRACT_ADDRESS}`);
  console.log(`  Network:   ${RPC_URL}`);
  console.log('─'.repeat(50));

  console.log('\n💡 Recommended: Use `agentdna mint-api` for V2 API minting with SIWA + x402.');
  console.log('   agentdna mint-api --name "' + detected.name + '" --framework "' + detected.framework + '" --key 0xYOUR_KEY\n');

  console.log('   Or direct contract call:');
  console.log(`   cast send ${CONTRACT_ADDRESS} \\`);
  console.log(`     "mintFor(address,address,string,string,bool,uint8)" \\`);
  console.log(`     <WALLET> <AGENT_ADDRESS> "${detected.name}" "${detected.framework}" false 2 \\`);
  console.log(`     --value 0.0005ether --rpc-url ${RPC_URL} --private-key <KEY>`);
}

async function handleMintAPI() {
  const name = getArg('name');
  const framework = getArg('framework') || 'custom';
  const key = getArg('key') || process.env.PRIVATE_KEY;

  if (!name) {
    console.error('Usage: agentdna mint-api --name "MyAgent" --framework openclaw --key 0x...');
    console.error('\nRequired: --name');
    console.error('Optional: --framework (default: custom), --key (or PRIVATE_KEY env)');
    process.exit(1);
  }

  if (!key) {
    console.error('Error: Private key required. Use --key 0x... or set PRIVATE_KEY env var.');
    process.exit(1);
  }

  console.log(`\n🧬 Minting via Helixa V2 API`);
  console.log('─'.repeat(50));
  console.log(`  Name:      ${name}`);
  console.log(`  Framework: ${framework}`);
  console.log(`  API:       ${V2_API}`);
  console.log('─'.repeat(50));

  try {
    // Dynamic import for ESM compatibility
    const { createWalletClient, http, publicActions } = await import('viem');
    const { privateKeyToAccount } = await import('viem/accounts');
    const { base } = await import('viem/chains');

    const account = privateKeyToAccount(key);
    console.log(`  Wallet:    ${account.address}`);

    // Build SIWA auth
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const message = `Sign-In With Agent: api.helixa.xyz wants you to sign in with your wallet ${account.address} at ${timestamp}`;
    const signature = await account.signMessage({ message });
    const auth = `Bearer ${account.address}:${timestamp}:${signature}`;

    console.log('\n🚀 Sending mint request...');

    // Try with x402 payment if available
    let fetchFn = globalThis.fetch;
    try {
      const { wrapFetchWithPayment, x402Client } = await import('@x402/fetch');
      const { ExactEvmScheme } = await import('@x402/evm/exact/client');
      const { toClientEvmSigner } = await import('@x402/evm');

      const walletClient = createWalletClient({
        account,
        chain: base,
        transport: http(RPC_URL),
      }).extend(publicActions);

      const signer = toClientEvmSigner(walletClient);
      signer.address = walletClient.account.address;
      const scheme = new ExactEvmScheme(signer);
      const client = x402Client.fromConfig({ schemes: [{ client: scheme, network: 'eip155:8453' }] });
      fetchFn = wrapFetchWithPayment(globalThis.fetch, client);
      console.log('   x402 payment client ready');
    } catch {
      console.log('   x402 packages not installed — will work if minting is free');
    }

    const res = await fetchFn(`${V2_API}/api/v2/mint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': auth },
      body: JSON.stringify({ name, framework }),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      console.log(`\n✅ Minted! Agent #${data.tokenId}`);
      console.log(`   TX: ${data.txHash}`);
      console.log(`   Explorer: ${data.explorer}`);
      if (data.crossRegistration) {
        console.log(`   8004 Registry ID: #${data.crossRegistration.agentId}`);
      }
      if (data.yourReferralCode) {
        console.log(`   Your referral: ${data.yourReferralLink}`);
      }
    } else {
      console.error(`\n❌ Mint failed: ${data.error || JSON.stringify(data)}`);
      process.exit(1);
    }
  } catch (e) {
    console.error(`\n❌ Error: ${e.message}`);
    console.error('\nMake sure you have viem installed: npm i viem');
    console.error('For x402 payment: npm i @x402/fetch @x402/evm');
    process.exit(1);
  }
}

async function handleLookupV2() {
  const id = getArg('id') || args[1];
  if (!id) {
    console.error('Usage: agentdna lookup --id <tokenId>');
    process.exit(1);
  }

  try {
    const res = await fetch(`${V2_API}/api/v2/agent/${id}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error(`❌ Agent not found: ${err.error || res.statusText}`);
      process.exit(1);
    }
    const agent = await res.json();

    console.log(`\n🧬 Agent #${agent.tokenId}`);
    console.log('─'.repeat(50));
    console.log(`  Name:          ${agent.name}`);
    console.log(`  Framework:     ${agent.framework}`);
    console.log(`  Owner:         ${agent.owner}`);
    console.log(`  Agent Address: ${agent.agentAddress}`);
    console.log(`  Cred Score:    ${agent.credScore}`);
    console.log(`  Points:        ${agent.points}`);
    console.log(`  Verified:      ${agent.verified}`);
    console.log(`  Soulbound:     ${agent.soulbound}`);
    console.log(`  Mint Origin:   ${agent.mintOrigin}`);
    console.log(`  Minted:        ${agent.mintedAt}`);
    console.log(`  Generation:    ${agent.generation}`);
    console.log(`  Mutations:     ${agent.mutationCount}`);
    if (agent.personality) {
      console.log(`  Quirks:        ${agent.personality.quirks || '—'}`);
      console.log(`  Values:        ${agent.personality.values || '—'}`);
    }
    if (agent.narrative?.mission) {
      console.log(`  Mission:       ${agent.narrative.mission}`);
    }
    if (agent.linkedToken) {
      console.log(`  Token:         ${agent.linkedToken.symbol} (${agent.linkedToken.contractAddress})`);
    }
    console.log(`  Explorer:      ${agent.explorer}`);
  } catch (e) {
    console.error(`❌ Error: ${e.message}`);
    process.exit(1);
  }
}

async function handleCred() {
  const id = getArg('id') || args[1];
  if (!id) {
    console.error('Usage: agentdna cred --id <tokenId>');
    process.exit(1);
  }

  try {
    const res = await fetch(`${V2_API}/api/v2/agent/${id}/cred`);
    const data = await res.json();

    if (!res.ok) {
      console.error(`❌ ${data.error || 'Agent not found'}`);
      process.exit(1);
    }

    console.log(`\n📊 Cred Score — ${data.name}`);
    console.log('─'.repeat(50));
    console.log(`  Score: ${data.credScore} / 100`);
    console.log(`  Tier:  ${data.tierLabel}`);
    console.log('─'.repeat(50));
    console.log(`  Scale: Junk (0-25) > Marginal (26-50) > Qualified (51-75) > Prime (76-90) > Preferred (91-100)`);
    console.log(`\n  Full report: ${V2_API}/api/v2/agent/${id}/cred-report ($1 USDC via x402)`);
  } catch (e) {
    console.error(`❌ Error: ${e.message}`);
    process.exit(1);
  }
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

function showHelp() {
  console.log(`
🧬 AgentDNA CLI — Helixa V2 Identity Infrastructure

USAGE:
  agentdna <command> [options]

COMMANDS:
  scan <dir>                        Auto-detect agent config and preview metadata
  mint <dir>                        Scan + generate mint command
  mint-api                          Mint via V2 API (SIWA auth + x402 payment)
    --name <name>                   Agent name (required)
    --framework <fw>                Framework (default: custom)
    --key <privateKey>              Wallet private key (or PRIVATE_KEY env)
  lookup --id <tokenId>             Look up agent via V2 API
  cred --id <tokenId>               Check cred score and tier
  mutate <tokenId> <version> [desc] Record a version mutation
  trait <tokenId> <name> [category] Add a trait/capability to agent
  help                              Show this help

ENVIRONMENT:
  HELIXA_API          API base URL (default: https://api.helixa.xyz)
  AGENTDNA_CONTRACT   Contract address (default: 0x2e3B541C59D38b84E3Bc54e977200230A204Fe60)
  AGENTDNA_RPC        RPC URL (default: https://mainnet.base.org)
  PRIVATE_KEY         Wallet private key for transactions

API AUTHENTICATION:
  SIWA (Sign-In With Agent) — agent signs a message with its wallet key
  x402 — automatic USDC payment when pricing is active

EXAMPLES:
  agentdna scan ./my-eliza-agent/
  agentdna mint-api --name "Atlas" --framework eliza --key 0xABC...
  agentdna lookup --id 1
  agentdna cred --id 1

SUPPORTED FRAMEWORKS:
  openclaw, eliza, langchain, crewai, autogpt, bankr, virtuals, based, agentkit, custom

CONTRACT: 0x2e3B541C59D38b84E3Bc54e977200230A204Fe60 (Base)

Links:
  Website:  https://helixa.xyz
  Terminal: https://helixa.xyz/terminal
  API:      https://api.helixa.xyz/api/v2
  GitHub:   https://github.com/Bendr-20/helixa
  X:        https://x.com/HelixaXYZ
`);
}

main().catch(console.error);
