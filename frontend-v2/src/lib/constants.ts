import { base, baseSepolia } from 'wagmi/chains';

// Chain - use Base Sepolia for testnet, Base for production
const isTestnet = import.meta.env.VITE_CHAIN === 'base-sepolia';
export const CHAIN = isTestnet ? baseSepolia : base;

// Contract address
export const CONTRACT_ADDRESS = (import.meta.env.VITE_CONTRACT_ADDRESS || '0x2e3B541C59D38b84E3Bc54e977200230A204Fe60') as `0x${string}`;

// API URL for V2 endpoints
export const API_URL = import.meta.env.VITE_API_URL || 'https://api.helixa.xyz';

// RPC configuration
export const BASE_RPC_URL = isTestnet ? 'https://sepolia.base.org' : 'https://base.drpc.org';

// Explorer
export const EXPLORER_URL = isTestnet ? 'https://sepolia.basescan.org' : 'https://basescan.org';

// Agent frameworks
export const AGENT_FRAMEWORKS = [
  'openclaw',
  'eliza',
  'langchain',
  'crewai',
  'autogpt',
  'bankr',
  'virtuals',
  'based',
  'agentkit',
  'custom',
] as const;

// Mint origins
export const MINT_ORIGINS = {
  HUMAN: 0,
  AGENT_SIWA: 1,
  API: 2,
  OWNER: 3,
} as const;

export const ORIGIN_DISPLAY: Record<string | number, { icon: string; label: string }> = {
  0: { icon: '', label: 'Human' },
  1: { icon: '', label: 'Agent (SIWA)' },
  2: { icon: '', label: 'API' },
  3: { icon: '', label: 'Owner' },
  HUMAN: { icon: '', label: 'Human' },
  AGENT_SIWA: { icon: '', label: 'Agent (SIWA)' },
  API: { icon: '', label: 'API' },
  OWNER: { icon: '', label: 'Owner' },
};

// Design system colors
export const COLORS = {
  bg: '#08060e',
  surface: '#151220',
  text: '#eae6f2',
  accent: {
    purple: '#b388ff',
    blue: '#7c4dff',
    cyan: '#80d8ff',
    pink: '#f5a0d0',
  },
} as const;
