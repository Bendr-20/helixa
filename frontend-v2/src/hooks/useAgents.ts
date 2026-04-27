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
  services?: Record<string, any>;
  metadata?: Record<string, any>;
  skills?: string[];
  domains?: string[];
}

export interface HumanData {
  id: string;
  walletAddress: string | null;
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

export interface OrganizationData {
  id: string | number;
  tokenId: number | null;
  walletAddress: string | null;
  entityType: 'organization';
  principalType: 'organization';
  organizationType: string | null;
  displayName: string;
  slug: string | null;
  description: string | null;
  image: string | null;
  bannerImage: string | null;
  active: boolean;
  roles: string[];
  operatorModel: string | null;
  capacityStatus: string | null;
  verificationStatus: string | null;
  serviceCategories: string[];
  skills: string[];
  domains: string[];
  timezone: string | null;
  region: string | null;
  acceptedPayments: string[];
  preferredCommunicationChannels: string[];
  links: Record<string, any>;
  services?: Record<string, any>;
  badges?: string[];
  affiliations?: string[];
  highlights?: string[];
  memberIdentityIds?: string[];
  members?: Array<Record<string, any>>;
  relationships?: Record<string, string[]>;
  relationshipSummary?: {
    humanCount: number;
    agentCount: number;
    teamCount: number;
    businessCount: number;
  };
  contact?: Record<string, any>;
  metadata?: Record<string, any>;
  registration?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export interface DirectoryPrincipal {
  entityType: 'agent' | 'human' | 'organization';
  id: string;
  name: string;
  description?: string | null;
  credScore: number;
  verified: boolean;
  publicPath: string;
  sortKey: number;
  framework?: string;
  soulbound?: boolean;
  points?: number;
  traitCount?: number;
  humanOrganization?: string | null;
  skills?: string[];
  serviceCategories?: string[];
  walletAddress?: string | null;
  tokenId?: number | null;
  badgeLabel?: string | null;
  raw: AgentData | HumanData | OrganizationData;
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
    services: raw.services || {},
    metadata: raw.metadata || {},
    skills: raw.skills || [],
    domains: raw.domains || [],
  };
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 2500) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (!contentType.includes('application/json')) throw new Error('Non-JSON response');
    return await res.json();
  } finally {
    window.clearTimeout(timer);
  }
}

function normalizeHuman(raw: any): HumanData {
  return {
    id: String(raw.id ?? raw.tokenId ?? raw.walletAddress ?? ''),
    walletAddress: raw.walletAddress || null,
    tokenId: raw.tokenId ?? null,
    entityType: 'human',
    name: raw.name || 'Unknown Human',
    description: raw.description || null,
    image: raw.image || null,
    organization: raw.organization || null,
    skills: raw.skills || [],
    domains: raw.domains || [],
    linkedAccounts: raw.linkedAccounts || {},
    linkedAgents: raw.linkedAgents || [],
    externalIds: raw.externalIds || {},
    services: raw.services || {},
    contact: raw.contact || {},
    notificationPreferences: raw.notificationPreferences,
    metadata: raw.metadata || {},
    humanCred: raw.humanCred,
    registration: raw.registration,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function normalizeOrganization(raw: any): OrganizationData {
  return {
    id: raw.id,
    tokenId: raw.tokenId ?? null,
    walletAddress: raw.walletAddress || null,
    entityType: 'organization',
    principalType: 'organization',
    organizationType: raw.organizationType || null,
    displayName: raw.displayName || raw.name || 'Unknown Organization',
    slug: raw.slug || null,
    description: raw.description || null,
    image: raw.image || null,
    bannerImage: raw.bannerImage || null,
    active: raw.active !== false,
    roles: raw.roles || [],
    operatorModel: raw.operatorModel || null,
    capacityStatus: raw.capacityStatus || null,
    verificationStatus: raw.verificationStatus || null,
    serviceCategories: raw.serviceCategories || [],
    skills: raw.skills || [],
    domains: raw.domains || [],
    timezone: raw.timezone || null,
    region: raw.region || null,
    acceptedPayments: raw.acceptedPayments || [],
    preferredCommunicationChannels: raw.preferredCommunicationChannels || [],
    links: raw.links || {},
    services: raw.services || {},
    badges: raw.badges || [],
    affiliations: raw.affiliations || [],
    highlights: raw.highlights || [],
    memberIdentityIds: raw.memberIdentityIds || [],
    members: raw.members || [],
    relationships: raw.relationships || {},
    relationshipSummary: raw.relationshipSummary,
    contact: raw.contact || {},
    metadata: raw.metadata || {},
    registration: raw.registration,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
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
        const res = await fetch(`${API_URL}/api/v2/agents?limit=${limit}&page=${page}`, { cache: 'no-store' });
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

// Fetch humans from V2 API
function useHumansFromAPI() {
  return useQuery({
    queryKey: ['v2-humans'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/v2/humans`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch humans');
      const data = await res.json();
      return {
        total: data.total || 0,
        humans: (data.humans || []).map(normalizeHuman),
      };
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

// Fetch organizations from V2 API
function useOrganizationsFromAPI() {
  return useQuery({
    queryKey: ['v2-organizations'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/v2/organizations`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch organizations');
      const data = await res.json();
      return {
        total: data.total || 0,
        organizations: (data.organizations || []).map(normalizeOrganization),
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
      const res = await fetch(`${API_URL}/api/v2/stats`, { cache: 'no-store' });
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

      const detailCandidates = Array.from(new Set([
        browserOrigin ? `${browserOrigin}/api/v2/agent/${encodedId}` : '',
        `${API_URL}/api/v2/agent/${encodedId}`,
      ].filter(Boolean)));

      for (const url of detailCandidates) {
        try {
          return normalizeAgent(await fetchJsonWithTimeout(url, 2500));
        } catch {}
      }

      const listCandidates = Array.from(new Set([
        browserOrigin ? `${browserOrigin}/api/v2/agents?limit=1000&page=1` : '',
        browserOrigin ? `${browserOrigin}/api/v2/agents?limit=1000&page=2` : '',
        `${API_URL}/api/v2/agents?limit=1000&page=1`,
        `${API_URL}/api/v2/agents?limit=1000&page=2`,
      ].filter(Boolean)));

      const listMatch = await fetchAgentFromListCandidates(tokenId!, listCandidates);
      if (listMatch) return listMatch;

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

export function useOrganization(id: number | string | undefined) {
  return useQuery({
    queryKey: ['v2-organization', id],
    queryFn: async () => {
      const encodedId = encodeURIComponent(String(id));
      const browserOrigin = typeof window !== 'undefined' ? window.location.origin : '';
      const candidates = Array.from(new Set([
        `${API_URL}/api/v2/org/${encodedId}`,
        browserOrigin ? `${browserOrigin}/api/v2/org/${encodedId}` : '',
      ].filter(Boolean)));

      let sawNotFound = false;
      let sawTransientFailure = false;

      for (const url of candidates) {
        try {
          const res = await fetch(url);
          if (res.ok) return await res.json() as OrganizationData;
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
        throw makeHumanQueryError('Organization principal not found', 404);
      }

      throw makeHumanQueryError('Failed to load organization profile');
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
          totalHumans: apiStats.totalHumans || 0,
          totalOrganizations: apiStats.totalOrganizations || 0,
          totalPrincipals: (apiStats.totalAgents || 0) + (apiStats.totalHumans || 0) + (apiStats.totalOrganizations || 0),
          totalCredScore: agents?.agents?.reduce((s: number, a: AgentData) => s + a.credScore, 0) || 0,
          frameworks: agents?.agents ? new Set(agents.agents.map((a: AgentData) => a.framework).filter(Boolean)).size : 0,
          soulboundCount: agents?.agents?.filter((a: AgentData) => a.soulbound).length || 0,
          mintPrice: apiStats.mintPrice || '0',
          gasBalance: apiStats.gasBalance || '0',
        }
      : undefined,
  };
}

export function useHelixaDirectory() {
  const agentsQuery = useAgentsFromAPI();
  const humansQuery = useHumansFromAPI();
  const organizationsQuery = useOrganizationsFromAPI();

  const data = (() => {
    const agents = (agentsQuery.data?.agents || [])
      .filter((agent) => agent.name && agent.name.length > 0)
      .map<DirectoryPrincipal>((agent) => ({
        entityType: 'agent',
        id: String(agent.tokenId),
        name: agent.name,
        description: agent.narrative?.backstory || agent.narrative?.origin || agent.metadata?.description || null,
        credScore: agent.credScore || 0,
        verified: agent.verified || false,
        publicPath: `/agent/${agent.tokenId}`,
        sortKey: agent.tokenId || 0,
        framework: agent.framework,
        soulbound: agent.soulbound,
        points: agent.points,
        traitCount: agent.traitCount || agent.traits?.length || 0,
        tokenId: agent.tokenId,
        badgeLabel: agent.framework,
        raw: agent,
      }));

    const humans = (humansQuery.data?.humans || [])
      .filter((human) => human.name && human.id)
      .map<DirectoryPrincipal>((human) => ({
        entityType: 'human',
        id: human.id,
        name: human.name,
        description: human.description || null,
        credScore: human.humanCred?.score || 0,
        verified: Boolean(human.walletAddress),
        publicPath: `/h/${encodeURIComponent(human.id)}`,
        sortKey: human.tokenId || 0,
        humanOrganization: human.organization,
        skills: human.skills || [],
        serviceCategories: human.metadata?.serviceCategories || [],
        walletAddress: human.walletAddress,
        tokenId: human.tokenId,
        badgeLabel: human.organization || 'Human',
        raw: human,
      }));

    const organizations = (organizationsQuery.data?.organizations || [])
      .filter((organization) => organization.displayName && organization.id != null)
      .map<DirectoryPrincipal>((organization) => ({
        entityType: 'organization',
        id: String(organization.id),
        name: organization.displayName,
        description: organization.description || null,
        credScore: 0,
        verified: Boolean(organization.walletAddress),
        publicPath: `/o/${encodeURIComponent(String(organization.slug || organization.tokenId || organization.id))}`,
        sortKey: organization.tokenId || 0,
        skills: organization.skills || [],
        serviceCategories: organization.serviceCategories || [],
        walletAddress: organization.walletAddress,
        tokenId: organization.tokenId,
        badgeLabel: organization.organizationType || 'Organization',
        raw: organization,
      }));

    return [...agents, ...humans, ...organizations];
  })();

  return {
    data,
    isLoading: agentsQuery.isLoading || humansQuery.isLoading || organizationsQuery.isLoading,
    isFetching: agentsQuery.isFetching || humansQuery.isFetching || organizationsQuery.isFetching,
    error: agentsQuery.error || humansQuery.error || organizationsQuery.error,
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
