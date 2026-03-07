const { ethers } = require('ethers');
const fs = require('fs');
require('dotenv').config();

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function callWithRetry(fn, retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === retries - 1) throw e;
      const wait = 2000 * (i + 1);
      console.log(`  retry ${i+1} in ${wait}ms: ${e.message?.slice(0,80)}`);
      await sleep(wait);
    }
  }
}

async function main() {
  const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  const wallet = new ethers.Wallet(process.env.DEPLOYER_KEY, provider);
  console.log('Deployer:', wallet.address);

  const transfers = JSON.parse(fs.readFileSync('data/8004-transfers.json', 'utf8'));
  const v2Abi = JSON.parse(fs.readFileSync('out/HelixaV2.sol/HelixaV2.json', 'utf8')).abi;
  
  const v2 = new ethers.Contract('0x2e3B541C59D38b84E3Bc54e977200230A204Fe60', v2Abi, provider);
  const registry = new ethers.Contract('0x8004A169FB4a3325136EB29fA0ceB6D2e539a432', [
    'function ownerOf(uint256) view returns (address)',
    'function setAgentURI(uint256, string) external'
  ], wallet);

  // Check ownership of first token
  const owner0 = await callWithRetry(() => registry.ownerOf(transfers[0].regId));
  console.log(`Owner of regId ${transfers[0].regId}: ${owner0}`);
  console.log(`Deployer: ${wallet.address}`);
  const deployerOwns = owner0.toLowerCase() === wallet.address.toLowerCase();
  console.log(`Deployer owns tokens: ${deployerOwns}`);

  let nonce = await callWithRetry(() => provider.getTransactionCount(wallet.address));
  console.log(`Starting nonce: ${nonce}`);

  const results = [];
  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  for (let i = 0; i < transfers.length; i++) {
    const t = transfers[i];
    console.log(`\n[${i+1}/${transfers.length}] ${t.name} (regId=${t.regId}, v2Id=${t.v2Id})`);

    try {
      // Check ownership
      const tokenOwner = await callWithRetry(() => registry.ownerOf(t.regId));
      if (tokenOwner.toLowerCase() !== wallet.address.toLowerCase()) {
        console.log(`  SKIP: owned by ${tokenOwner}, not deployer`);
        results.push({ ...t, status: 'skipped', reason: `owned by ${tokenOwner}` });
        skipCount++;
        continue;
      }

      // Get agent data
      const [agent, narrative] = await Promise.all([
        callWithRetry(() => v2.getAgent(t.v2Id)),
        callWithRetry(() => v2.getNarrative(t.v2Id))
      ]);

      const name = agent.name || t.name;
      const framework = agent.framework || 'unknown';
      const mission = narrative.mission || '';
      
      const description = mission 
        ? `${name} — ${mission}`
        : `${name} — AI agent (${framework})`;

      const uriJson = {
        type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
        name: name,
        description: description,
        image: `https://api.helixa.xyz/api/v2/aura/${t.v2Id}.png`,
        services: [{ name: "web", endpoint: `https://helixa.xyz/agent/${t.v2Id}` }],
        x402Support: true,
        active: true,
        registrations: [{
          agentId: t.v2Id,
          agentRegistry: "eip155:8453:0x2e3B541C59D38b84E3Bc54e977200230A204Fe60"
        }]
      };

      const b64 = Buffer.from(JSON.stringify(uriJson)).toString('base64');
      const uri = `data:application/json;base64,${b64}`;

      console.log(`  desc: ${description.slice(0, 80)}`);
      
      const tx = await callWithRetry(() => registry.setAgentURI(t.regId, uri, {
        nonce: nonce,
        gasLimit: 200000n
      }));
      
      console.log(`  tx: ${tx.hash}`);
      nonce++;
      
      results.push({ ...t, status: 'success', tx: tx.hash, description });
      successCount++;
      
      // Small delay between txs
      await sleep(500);
      
    } catch (e) {
      console.log(`  FAIL: ${e.message?.slice(0, 120)}`);
      results.push({ ...t, status: 'failed', error: e.message?.slice(0, 200) });
      failCount++;
    }
  }

  console.log(`\n=== DONE ===`);
  console.log(`Success: ${successCount}, Skipped: ${skipCount}, Failed: ${failCount}`);
  
  fs.writeFileSync('data/8004-uri-updates.json', JSON.stringify(results, null, 2));
  console.log('Results saved to data/8004-uri-updates.json');
}

main().catch(e => { console.error(e); process.exit(1); });
