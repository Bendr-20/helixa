// Batch fix missing tokenURIs for all Helixa V2 agents
require('dotenv').config({ path: '.env' });
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const DEPLOYER_KEY = process.env.DEPLOYER_KEY;
const V2_ADDRESS = '0x2e3B541C59D38b84E3Bc54e977200230A204Fe60';
const READ_RPC = 'https://base.drpc.org';
const WRITE_RPC = 'https://mainnet.base.org';

async function main() {
  const abi = JSON.parse(fs.readFileSync(path.join(__dirname, 'out/HelixaV2.sol/HelixaV2.json'))).abi;
  const readProvider = new ethers.JsonRpcProvider(READ_RPC);
  const writeProvider = new ethers.JsonRpcProvider(WRITE_RPC);
  const wallet = new ethers.Wallet(DEPLOYER_KEY, writeProvider);
  const readContract = new ethers.Contract(V2_ADDRESS, abi, readProvider);
  const writeContract = new ethers.Contract(V2_ADDRESS, abi, wallet);

  const total = Number(await readContract.totalAgents());
  console.log(`Total agents: ${total}`);

  // Find missing tokenURIs
  const missing = [];
  for (let i = 0; i < total; i++) {
    const uri = await readContract.tokenURI(i).catch(() => '');
    if (!uri) missing.push(i);
  }
  console.log(`Missing tokenURI: ${missing.length} agents`);
  if (missing.length === 0) { console.log('Nothing to fix!'); return; }

  // Get current nonce and manage manually
  let nonce = await writeProvider.getTransactionCount(wallet.address, 'pending');
  console.log(`Starting nonce: ${nonce}`);
  
  let success = 0, failed = 0;
  for (const tokenId of missing) {
    const metadataUrl = `https://api.helixa.xyz/api/v2/metadata/${tokenId}`;
    try {
      const tx = await writeContract.setMetadata(tokenId, metadataUrl, { nonce });
      await tx.wait();
      nonce++;
      success++;
      if (success % 10 === 0) console.log(`  ✓ ${success}/${missing.length} done (latest: #${tokenId})`);
    } catch (e) {
      console.error(`  ✗ #${tokenId}: ${e.message.slice(0, 80)}`);
      failed++;
      // Re-fetch nonce on failure
      nonce = await writeProvider.getTransactionCount(wallet.address, 'pending');
    }
  }
  console.log(`\nDone: ${success} fixed, ${failed} failed`);
}

main().catch(console.error);
