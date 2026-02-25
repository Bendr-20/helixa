#!/usr/bin/env node
/**
 * Batch cross-register all Helixa V2 agents on the canonical ERC-8004 registry.
 * Uses Helixa API for agent data, AWS SM for deployer key.
 */
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const ethers = require('ethers');
const https = require('https');

const V2_ADDRESS = '0x2e3B541C59D38b84E3Bc54e977200230A204Fe60';
const ERC8004_REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';
const REG_ABI = ['function register(string agentURI) external returns (uint256 agentId)'];
const API_BASE = 'https://api.helixa.xyz';

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function build8004File(agent) {
  return {
    type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
    name: agent.name || `Helixa Agent #${agent.tokenId}`,
    description: `${agent.name || 'Agent #' + agent.tokenId} - AI agent on Base (${agent.framework || 'unknown'}).`,
    image: `https://api.helixa.xyz/api/v2/agent/${agent.tokenId}/card.png`,
    services: [{ name: 'web', endpoint: `https://helixa.xyz/agent/${agent.tokenId}` }],
    x402Support: true,
    active: true,
    registrations: [{ agentId: agent.tokenId, agentRegistry: `eip155:8453:${V2_ADDRESS}` }],
  };
}

function toDataURI(obj) {
  return 'data:application/json;base64,' + Buffer.from(JSON.stringify(obj)).toString('base64');
}

async function main() {
  const sm = new SecretsManagerClient({ region: 'us-east-2' });
  const secret = await sm.send(new GetSecretValueCommand({ SecretId: 'helixa/deployer-key' }));
  const key = JSON.parse(secret.SecretString).DEPLOYER_PRIVATE_KEY;

  const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  const wallet = new ethers.Wallet(key, provider);
  const registry = new ethers.Contract(ERC8004_REGISTRY, REG_ABI, wallet);
  console.log('Deployer:', wallet.address);

  // Fetch all agents from API (paginated, unfiltered)
  let allAgents = [];
  let page = 1;
  while (true) {
    const resp = await fetchJSON(`${API_BASE}/api/v2/agents?limit=100&page=${page}&all=true`);
    if (!resp.agents || resp.agents.length === 0) break;
    allAgents.push(...resp.agents);
    console.log(`Fetched page ${page}: ${resp.agents.length} agents (total so far: ${allAgents.length})`);
    if (page >= resp.pages) break;
    page++;
  }
  console.log(`Total agents from API: ${allAgents.length}`);

  // Sort by tokenId
  allAgents.sort((a, b) => a.tokenId - b.tokenId);

  // Only register agents with names (skip empty sybil mints)
  const namedAgents = allAgents.filter(a => a.name && a.name.trim());
  console.log(`Named agents to register: ${namedAgents.length}`);

  const skipFirst = parseInt(process.argv[2] || '0');
  let nonce = await provider.getTransactionCount(wallet.address);
  console.log(`Starting nonce: ${nonce}, skipping first ${skipFirst} agents`);

  const toRegister = namedAgents.slice(skipFirst);
  let registered = 0, errors = 0;
  for (const agent of toRegister) {
    try {
      const regFile = build8004File(agent);
      const dataURI = toDataURI(regFile);
      const tx = await registry['register(string)'](dataURI, { nonce });
      nonce++;
      await tx.wait();
      registered++;
      if (registered % 10 === 0 || registered <= 3) {
        console.log(`[${registered}/${toRegister.length}] ✓ #${agent.tokenId} ${agent.name} — tx: ${tx.hash.slice(0,16)}...`);
      }
    } catch (e) {
      errors++;
      console.error(`[#${agent.tokenId}] ✗ ${e.message.slice(0, 120)}`);
      if (e.message.includes('insufficient funds')) {
        console.error('OUT OF GAS — stopping');
        break;
      }
      // Re-sync nonce on error
      nonce = await provider.getTransactionCount(wallet.address, 'pending');
    }
  }

  console.log(`\nDone. Registered: ${registered}, Errors: ${errors}, Skipped: ${allAgents.length - namedAgents.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
