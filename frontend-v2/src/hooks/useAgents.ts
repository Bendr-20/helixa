import { useQuery } from '@tanstack/react-query';
import { API_URL, CONTRACT_ADDRESS } from '../lib/constants';
import { useReadContract } from 'wagmi';
import HelixaV2ABI from '../abi/HelixaV2.json';

const abi = HelixaV2ABI.abi;

interface AgentData {
  id: number;
  tokenId: number;
  name: string;
  framework: string;
  mintedAt: number;
  verified: boolean;
  soulbound: boolean;
  generation: number;
  mutationCount: number;
  owner: string;
  points: number;
  traits: string[];
  traitCount: number;
  personality: any;
  narrative: any;
  credScore: number;
  mintOrigin: string;
  agentAddress: string;
  agentName: string | null;
  ethosScore: number | null;
  linkedToken: any;
}

function normalizeAgent(raw: any): AgentData {
  return {
    id: raw.tokenId ?? raw.id,
    tokenId: raw.tokenId ?? raw.id,
    name: raw.name || `Agent #${raw.tokenId ?? raw.id}`,
    framework: raw.framework || 'unknown',
    mintedAt: raw.mintedAt ? new Date(raw.mintedAt).getTime() / 1000 : 0,
    verified: raw.verified || false,
    soulbound: raw.soulbound || false,
    generation: raw.generation || 0,
    mutationCount: raw.mutationCount || 0,
    owner: raw.owner || '',
    points: raw.points || 0,
    traits: raw.traits || [],
    traitCount: raw.traitCount || raw.traits?.length || 0,
    personality: raw.personality || null,
    narrative: raw.narrative || null,
    credScore: raw.credScore || 0,
    mintOrigin: raw.mintOrigin || 'UNKNOWN',
    agentAddress: raw.agentAddress || '',
    agentName: raw.agentName || null,
    ethosScore: raw.ethosScore || null,
    linkedToken: raw.linkedToken || null,
  };
}

// Fetch all agents from V2 API
function useAgentsFromAPI() {
  return useQuery({
    queryKey: ['v2-agents'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/v2/agents`);
      if (!res.ok) throw new Error('Failed to fetch agents');
      const data = await res.json();
      return {
        total: data.total || data.agents?.length || 0,
        agents: (data.agents || []).map(normalizeAgent),
      };
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

// Fetch stats from V2 API
function useStatsFromAPI() {
  return useQuery({
    queryKey: ['v2-stats'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/v2/stats`);
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

// Fetch single agent from V2 API
export function useAgent(tokenId: number | string | undefined) {
  return useQuery({
    queryKey: ['v2-agent', tokenId],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/v2/agent/${tokenId}`);
      if (!res.ok) throw new Error('Agent not found');
      return normalizeAgent(await res.json());
    },
    enabled: tokenId !== undefined,
    staleTime: 15_000,
  });
}

export function useAllAgents() {
  const { data, ...query } = useAgentsFromAPI();
  return { ...query, data: data?.agents };
}

export function useTopAgents(limit = 6) {
  const { data, ...query } = useAgentsFromAPI();
  return {
    ...query,
    data: data?.agents
      ?.filter((a) => a.name && a.name.length > 0)
      .sort((a, b) => b.credScore - a.credScore)
      .slice(0, limit),
  };
}

export function useAgentStats() {
  const { data: apiStats, ...query } = useStatsFromAPI();
  const { data: agents } = useAgentsFromAPI();

  return {
    ...query,
    data: apiStats
      ? {
          totalAgents: apiStats.totalAgents || 0,
          totalCredScore: agents?.agents?.reduce((s: number, a: AgentData) => s + a.credScore, 0) || 0,
          frameworks: agents?.agents ? new Set(agents.agents.map((a: AgentData) => a.framework).filter(Boolean)).size : 0,
          soulboundCount: agents?.agents?.filter((a: AgentData) => a.soulbound).length || 0,
          mintPrice: apiStats.mintPrice || '0',
          gasBalance: apiStats.gasBalance || '0',
        }
      : undefined,
  };
}

export function useAgentsByOwner(owner: string | undefined) {
  const { data, ...query } = useAgentsFromAPI();
  return {
    ...query,
    data: owner
      ? data?.agents.filter(
          (a) => a.owner.toLowerCase() === owner.toLowerCase()
        )
      : undefined,
  };
}

export function useFilteredAgents(filters: {
  search?: string;
  framework?: string;
  soulbound?: boolean;
  verified?: boolean;
  mintOrigin?: string;
}) {
  const { data, ...query } = useAgentsFromAPI();
  return {
    ...query,
    data: data?.agents.filter((agent) => {
      if (filters.search && !agent.name.toLowerCase().includes(filters.search.toLowerCase())) return false;
      if (filters.framework && agent.framework !== filters.framework) return false;
      if (filters.soulbound !== undefined && agent.soulbound !== filters.soulbound) return false;
      if (filters.verified !== undefined && agent.verified !== filters.verified) return false;
      if (filters.mintOrigin && agent.mintOrigin !== filters.mintOrigin) return false;
      return true;
    }),
  };
}
