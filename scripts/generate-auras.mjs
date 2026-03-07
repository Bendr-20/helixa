#!/usr/bin/env node
/**
 * Generate Aura SVGs + OpenSea metadata for all minted agents.
 * Outputs to docs/auras/ and docs/metadata/
 */

import { ethers } from 'ethers';
import { generateAura } from '../sdk/lib/aura.js';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCS = join(__dirname, '..', 'docs');
const AURAS_DIR = join(DOCS, 'auras');
const META_DIR = join(DOCS, 'metadata');

const CONTRACT = '0x2e3B541C59D38b84E3Bc54e977200230A204Fe60';
const RPC = 'https://mainnet.base.org';
const BASE_URL = 'https://helixa.xyz';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  mkdirSync(AURAS_DIR, { recursive: true });
  mkdirSync(META_DIR, { recursive: true });

  const provider = new ethers.JsonRpcProvider(RPC);
  const iface = new ethers.Interface([
    'function totalAgents() view returns (uint256)',
    'function getAgent(uint256 tokenId) view returns (tuple(address agentAddress, string name, string framework, uint256 mintedAt, bool verified, bool soulbound, uint256 generation, uint256 parentDNA, string currentVersion, uint256 mutationCount))',
    'function getTraits(uint256 tokenId) view returns (string[] traitTypes, string[] traitValues)',
    'function getPoints(uint256 tokenId) view returns (uint256)',
    'function tokenURI(uint256 tokenId) view returns (string)',
  ]);

  // Get total
  const totalResult = await provider.call({ to: CONTRACT, data: iface.encodeFunctionData('totalAgents') });
  const total = Number(iface.decodeFunctionResult('totalAgents', totalResult)[0]);
  console.log(`Total agents: ${total}`);

  for (let i = 0; i < total; i++) {
    try {
      await sleep(1000);
      
      // getAgent
      const agentResult = await provider.call({ to: CONTRACT, data: iface.encodeFunctionData('getAgent', [i]) });
      const decoded = iface.decodeFunctionResult('getAgent', agentResult)[0];
      
      const agentName = decoded[1] || decoded.name || `Agent #${i}`;
      const framework = (decoded[2] || decoded.framework || 'custom').toLowerCase();
      const verified = decoded[4] ?? decoded.verified ?? false;
      const soulbound = decoded[5] ?? decoded.soulbound ?? false;
      const generation = Number(decoded[6] ?? decoded.generation ?? 0);
      const mutationCount = Number(decoded[9] ?? decoded.mutationCount ?? 0);

      // getPoints
      let points = 0;
      try {
        await sleep(500);
        const pointsResult = await provider.call({ to: CONTRACT, data: iface.encodeFunctionData('getPoints', [i]) });
        points = Number(iface.decodeFunctionResult('getPoints', pointsResult)[0]);
      } catch (e) { /* no points */ }

      // getTraits
      let traits = {};
      try {
        await sleep(500);
        const traitsResult = await provider.call({ to: CONTRACT, data: iface.encodeFunctionData('getTraits', [i]) });
        const [traitTypes, traitValues] = iface.decodeFunctionResult('getTraits', traitsResult);
        for (let j = 0; j < traitTypes.length; j++) {
          traits[traitTypes[j]] = traitValues[j];
        }
      } catch (e) { /* no traits */ }

      // Get existing tokenURI for description
      let existingDesc = '';
      try {
        await sleep(500);
        const uriResult = await provider.call({ to: CONTRACT, data: iface.encodeFunctionData('tokenURI', [i]) });
        const uri = iface.decodeFunctionResult('tokenURI', uriResult)[0];
        if (uri.startsWith('data:application/json;base64,')) {
          const json = JSON.parse(Buffer.from(uri.split(',')[1], 'base64').toString());
          existingDesc = json.description || '';
        }
      } catch (e) { /* no uri */ }

      const agentData = {
        name: agentName,
        framework,
        traits,
        points,
        mutationCount,
        verified,
        soulbound,
        generation,
        tokenId: i,
      };

      // Generate SVG
      const svg = generateAura(agentData, 500);
      writeFileSync(join(AURAS_DIR, `${i}.svg`), svg);

      // Generate OpenSea metadata
      const description = existingDesc || `${agentName} — an AI agent with onchain identity on Helixa AgentDNA (ERC-8004). Framework: ${framework}.`;
      const metadata = {
        name: agentName,
        description,
        image: `${BASE_URL}/auras/${i}.svg`,
        external_url: `${BASE_URL}/directory.html`,
        attributes: [
          { trait_type: 'Framework', value: framework },
          { trait_type: 'Generation', display_type: 'number', value: generation },
          { trait_type: 'Soulbound', value: soulbound ? 'Yes' : 'No' },
          { trait_type: 'Verified', value: verified ? 'Yes' : 'No' },
          { trait_type: 'Points', display_type: 'number', value: points },
          { trait_type: 'Mutations', display_type: 'number', value: mutationCount },
          ...Object.entries(traits).map(([k, v]) => ({ trait_type: k, value: v })),
        ],
      };

      writeFileSync(join(META_DIR, `${i}.json`), JSON.stringify(metadata, null, 2));
      console.log(`  ✅ #${i} ${agentName} (${framework}) — ${Object.keys(traits).length} traits, ${points} pts`);
    } catch (e) {
      console.log(`  ❌ #${i} — ${e.message.slice(0, 100)}`);
    }
  }

  console.log(`\nDone! Generated ${total} auras + metadata.`);
  console.log(`  SVGs:     docs/auras/`);
  console.log(`  Metadata: docs/metadata/`);
  console.log(`\nOpenSea URL: https://opensea.io/collection/helixa-agentdna`);
}

main().catch(console.error);
