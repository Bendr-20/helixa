import { useQuery } from '@tanstack/react-query';

const AGENTS_JSON_URL = 'https://helixa.xyz/data/agents.json';

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
  personality: any;
  credScore: number;
}

function normalizeAgent(raw: any): AgentData {
  return {
    id: raw.id,
    tokenId: raw.id,
    name: raw.name || `Agent #${raw.id}`,
    framework: raw.framework || 'unknown',
    mintedAt: raw.mintedAt || 0,
    verified: raw.verified || false,
    soulbound: raw.soulbound || false,
    generation: raw.generation || 0,
    mutationCount: raw.mutationCount || 0,
    owner: raw.owner || '',
    points: raw.points || 0,
    traits: raw.traits || [],
    personality: raw.personality || null,
    credScore: raw.credScore || (raw.verified ? 50 : raw.name ? 10 : 5),
  };
}

function useAgentsJson() {
  return useQuery({
    queryKey: ['agents-json'],
    queryFn: async () => {
      const res = await fetch(AGENTS_JSON_URL);
      if (!res.ok) throw new Error('Failed to fetch agents');
      const data = await res.json();
      return {
        total: data.totalAgents || data.total || 0,
        agents: (data.agents || []).map(normalizeAgent),
      };
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

export function useAllAgents() {
  const { data, ...query } = useAgentsJson();
  return { ...query, data: data?.agents };
}

export function useTopAgents(limit = 6) {
  const { data, ...query } = useAgentsJson();
  return {
    ...query,
    data: data?.agents
      ?.filter((a) => a.name && a.name.length > 0)
      .sort((a, b) => b.credScore - a.credScore)
      .slice(0, limit),
  };
}

export function useAgentStats() {
  const { data, ...query } = useAgentsJson();
  return {
    ...query,
    data: data
      ? {
          totalAgents: data.total,
          totalCredScore: data.agents.reduce((s, a) => s + a.credScore, 0),
          frameworks: new Set(data.agents.map((a) => a.framework).filter(Boolean)).size,
          soulboundCount: data.agents.filter((a) => a.soulbound).length,
        }
      : undefined,
  };
}

export function useAgentsByOwner(owner: string | undefined) {
  const { data, ...query } = useAgentsJson();
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
}) {
  const { data, ...query } = useAgentsJson();
  return {
    ...query,
    data: data?.agents.filter((agent) => {
      if (filters.search && !agent.name.toLowerCase().includes(filters.search.toLowerCase())) return false;
      if (filters.framework && agent.framework !== filters.framework) return false;
      if (filters.soulbound !== undefined && agent.soulbound !== filters.soulbound) return false;
      if (filters.verified !== undefined && agent.verified !== filters.verified) return false;
      return true;
    }),
  };
}
