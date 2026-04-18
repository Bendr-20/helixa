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
  socials?: Record<string, string>;
}

export interface HumanData {
  id: string;
  walletAddress: string;
  tokenId: number | null;
  entityType: 'human';
  name: string;
  description: string | null;
  image: string | null;
  organization: string | null;
  skills: string[];
  domains: string[];
  linkedAccounts: Record<string, string>;
  linkedAgents: string[];
  externalIds: Record<string, string>;
  services: Record<string, any>;
  contact: {
    hasEmail?: boolean;
    hasTelegram?: boolean;
    channels?: string[];
  } | Record<string, any>;
  notificationPreferences?: {
    channels?: string[];
    preferredChannel?: string | null;
    proposalAlerts?: boolean;
    taskAlerts?: boolean;
  };
  metadata?: Record<string, any>;
  humanCred?: {
    score: number;
    tier?: string | { tier?: string; label?: string };
    walletAddress: string;
    tokenId: number | null;
    sources?: Record<string, any>;
    breakdown?: Record<string, any>;
  };
  registration?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

interface HumanQueryError extends Error {
  status?: number;
}

function makeHumanQueryError(message: string, status?: number) {
  const error = new Error(message) as HumanQueryError;
  if (status != null) error.status = status;
  return error;
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
    socials: raw.socials || {},
  };
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 2500) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (!contentType.includes('application/json')) throw new Error('Non-JSON response');
    return await res.json();
  } finally {
    window.clearTimeout(timer);
  }
}

async function fetchAgentFromListCandidates(tokenId: number | string, candidates: string[]) {
  const results = await Promise.allSettled(
    candidates.map(url => fetchJsonWithTimeout(url, 2000))
  );

  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    const match = (result.value?.agents || []).find((agent: any) => String(agent.tokenId ?? agent.id) === String(tokenId));
    if (match) return normalizeAgent(match);
  }

  return null;
}

// Fetch ALL agents from V2 API (paginates automatically, no agent left behind)
function useAgentsFromAPI() {
  return useQuery({
    queryKey: ['v2-agents'],
    queryFn: async () => {
      const allAgents: any[] = [];
      let page = 1;
      const limit = 1000;
      while (true) {
        const res = await fetch(`${API_URL}/api/v2/agents?limit=${limit}&page=${page}`);
        if (!res.ok) throw new Error('Failed to fetch agents');
        const data = await res.json();
        const agents = data.agents || [];
        allAgents.push(...agents);
        if (agents.length < limit || page >= (data.pages || 1)) break;
        page++;
      }
      return {
        total: allAgents.length,
        agents: allAgents.map(normalizeAgent),
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
      const encodedId = encodeURIComponent(String(tokenId));
      const browserOrigin = typeof window !== 'undefined' ? window.location.origin : '';

      const listCandidates = Array.from(new Set([
        browserOrigin ? `${browserOrigin}/api/v2/agents?limit=1000&page=1` : '',
        browserOrigin ? `${browserOrigin}/api/v2/agents?limit=1000&page=2` : '',
        `${API_URL}/api/v2/agents?limit=1000&page=1`,
        `${API_URL}/api/v2/agents?limit=1000&page=2`,
      ].filter(Boolean)));

      const listMatch = await fetchAgentFromListCandidates(tokenId!, listCandidates);
      if (listMatch) return listMatch;

      const detailCandidates = Array.from(new Set([
        browserOrigin ? `${browserOrigin}/api/v2/agent/${encodedId}` : '',
        `${API_URL}/api/v2/agent/${encodedId}`,
      ].filter(Boolean)));

      for (const url of detailCandidates) {
        try {
          return normalizeAgent(await fetchJsonWithTimeout(url, 2000));
        } catch {}
      }

      throw new Error('Agent not found');
    },
    enabled: tokenId !== undefined,
    staleTime: 15_000,
    retry: false,
  });
}

export function useHuman(id: number | string | undefined) {
  return useQuery({
    queryKey: ['v2-human', id],
    queryFn: async () => {
      const encodedId = encodeURIComponent(String(id));
      const browserOrigin = typeof window !== 'undefined' ? window.location.origin : '';
      const candidates = Array.from(new Set([
        `${API_URL}/api/v2/human/${encodedId}`,
        browserOrigin ? `${browserOrigin}/api/v2/human/${encodedId}` : '',
      ].filter(Boolean)));

      let sawNotFound = false;
      let sawTransientFailure = false;

      for (const url of candidates) {
        try {
          const res = await fetch(url);
          if (res.ok) return await res.json() as HumanData;
          if (res.status === 404) {
            sawNotFound = true;
            continue;
          }
          sawTransientFailure = true;
        } catch (error: any) {
          if (error?.name === 'AbortError') {
            sawTransientFailure = true;
            continue;
          }
          sawTransientFailure = true;
        }
      }

      if (sawNotFound && !sawTransientFailure) {
        throw makeHumanQueryError('Human principal not found', 404);
      }

      throw makeHumanQueryError('Failed to load human profile');
    },
    enabled: id !== undefined && id !== null && String(id).trim().length > 0,
    staleTime: 15_000,
    retry: (failureCount, error: HumanQueryError) => error?.status !== 404 && failureCount < 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 4000),
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

export function useAgentsByOwner(owner: string | undefined, allWallets?: string[]) {
  const { data, ...query } = useAgentsFromAPI();
  const addresses = new Set(
    [owner, ...(allWallets || [])].filter(Boolean).map(a => a!.toLowerCase())
  );
  return {
    ...query,
    data: addresses.size > 0
      ? data?.agents.filter(
          (a) => addresses.has(a.owner.toLowerCase()) || addresses.has(a.agentAddress?.toLowerCase())
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
