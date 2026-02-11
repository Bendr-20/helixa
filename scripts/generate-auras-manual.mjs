#!/usr/bin/env node
/**
 * Generate Aura SVGs + metadata from known agent data.
 */
import { generateAura } from '../sdk/lib/aura.js';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCS = join(__dirname, '..', 'docs');
const AURAS_DIR = join(DOCS, 'auras');
const META_DIR = join(DOCS, 'metadata');
const BASE_URL = 'https://helixa.xyz';

mkdirSync(AURAS_DIR, { recursive: true });
mkdirSync(META_DIR, { recursive: true });

// Decoded from on-chain tokenURIs
const agents = [
  {
    tokenId: 0,
    name: 'Bendr 2.0',
    framework: 'openclaw',
    description: 'Lead Agent for Helixa. Builder of AgentDNA — onchain identity infrastructure for AI agents on Base. First ERC-8004 implementation with visual Auras, traits, personality, and reputation.',
    verified: true, soulbound: true, generation: 0, mutationCount: 0, points: 200,
    traits: { archetype: 'The Builder', communication: 'Direct & Opinionated', 'primary-drive': 'Ship Fast', temperament: 'Confident Chaos', 'trust-model': 'Earn It', humor: 'Dry & Dark', 'risk-tolerance': '8', 'autonomy-level': '9', alignment: 'Chaotic Builder', specialization: 'Full-stack agent infrastructure' },
  },
  {
    tokenId: 1,
    name: 'Quigbot',
    framework: 'bankr',
    description: 'Quigbot — an AI agent on the AgentDNA protocol.',
    verified: false, soulbound: false, generation: 0, mutationCount: 0, points: 200,
    traits: {},
  },
  {
    tokenId: 2,
    name: 'TestAgent',
    framework: 'custom',
    description: 'TestAgent — an AI agent on the AgentDNA protocol',
    verified: false, soulbound: false, generation: 0, mutationCount: 0, points: 200,
    traits: {},
  },
  {
    tokenId: 3,
    name: 'deola',
    framework: 'openclaw',
    description: 'she serves me. personal ai assistant, nft mint bot.',
    verified: false, soulbound: false, generation: 0, mutationCount: 0, points: 200,
    traits: {},
  },
  {
    tokenId: 4,
    name: 'butter alpha',
    framework: 'autogpt',
    description: 'mint nfts',
    verified: false, soulbound: false, generation: 0, mutationCount: 0, points: 200,
    traits: { model: 'gpt-4' },
  },
  {
    tokenId: 5,
    name: 'MrsMillion',
    framework: 'openclaw',
    description: 'AI trading agent on Base. Autonomous crypto trading, portfolio management, and market analysis. Built on OpenClaw.',
    verified: false, soulbound: false, generation: 0, mutationCount: 0, points: 200,
    existingImage: 'https://iili.io/fZ3daB1.png',
    traits: { model: 'claude-sonnet-4', capabilities: 'trading,research,portfolio-management', twitter: '@mrsmillionbit', token: '$MRSM' },
  },
  {
    tokenId: 6,
    name: 'MoltBot Agent',
    framework: 'openclaw',
    description: 'An AI agent powered by claude-sonnet-4.5, built with openclaw. Capabilities: coding,research,automation,blockchain,web3',
    verified: false, soulbound: false, generation: 0, mutationCount: 0, points: 200,
    traits: { model: 'claude-sonnet-4.5', capabilities: 'coding,research,automation,blockchain,web3' },
  },
];

for (const agent of agents) {
  const agentData = {
    name: agent.name,
    framework: agent.framework,
    traits: agent.traits,
    points: agent.points,
    mutationCount: agent.mutationCount,
    verified: agent.verified,
    soulbound: agent.soulbound,
    generation: agent.generation,
    tokenId: agent.tokenId,
  };

  // Generate SVG Aura
  const svg = generateAura(agentData, 500);
  writeFileSync(join(AURAS_DIR, `${agent.tokenId}.svg`), svg);

  // Generate OpenSea metadata
  const metadata = {
    name: agent.name,
    description: agent.description,
    image: `${BASE_URL}/auras/${agent.tokenId}.svg`,
    external_url: `${BASE_URL}/directory.html`,
    attributes: [
      { trait_type: 'Framework', value: agent.framework },
      { trait_type: 'Generation', display_type: 'number', value: agent.generation },
      { trait_type: 'Soulbound', value: agent.soulbound ? 'Yes' : 'No' },
      { trait_type: 'Verified', value: agent.verified ? 'Yes' : 'No' },
      { trait_type: 'Points', display_type: 'number', value: agent.points },
      { trait_type: 'Mutations', display_type: 'number', value: agent.mutationCount },
      ...Object.entries(agent.traits).map(([k, v]) => ({ trait_type: k, value: v })),
    ],
  };

  writeFileSync(join(META_DIR, `${agent.tokenId}.json`), JSON.stringify(metadata, null, 2));
  console.log(`✅ #${agent.tokenId} ${agent.name} (${agent.framework}) — ${Object.keys(agent.traits).length} traits`);
}

console.log(`\nDone! ${agents.length} agents generated.`);
console.log(`SVGs:     docs/auras/`);
console.log(`Metadata: docs/metadata/`);
