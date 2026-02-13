import { useQuery } from '@tanstack/react-query';
import { useReadContract } from 'wagmi';
import { useTotalSupply, useGetAgent, formatAgentData } from './useHelixa';
import { CONTRACT_ADDRESS } from '../lib/constants';
import HelixaV2ABI from '../abi/HelixaV2.json';

export function useAllAgents() {
  const { data: totalSupply } = useTotalSupply();
  
  return useQuery({
    queryKey: ['allAgents', totalSupply],
    queryFn: async () => {
      if (!totalSupply) return [];
      
      const total = Number(totalSupply);
      const agents = [];
      
      // Fetch all agents by token ID (1-indexed)
      for (let i = 1; i <= total; i++) {
        try {
          // Note: This is a simplified approach. In a real app, you'd want to
          // batch these requests or use events/subgraph for better performance
          const response = await fetch(`/api/agent/${i}`);
          if (response.ok) {
            const agentData = await response.json();
            agents.push(formatAgentData(agentData));
          }
        } catch (error) {
          console.warn(`Failed to fetch agent ${i}:`, error);
        }
      }
      
      return agents;
    },
    enabled: !!totalSupply,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });
}

export function useAgentsByOwner(owner: string | undefined) {
  const { data: balance } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: HelixaV2ABI.abi,
    functionName: 'balanceOf',
    args: owner ? [owner] : undefined,
    query: {
      enabled: !!owner,
    },
  });
  
  return useQuery({
    queryKey: ['agentsByOwner', owner, balance],
    queryFn: async () => {
      if (!owner || !balance) return [];
      
      const userBalance = Number(balance);
      const agents = [];
      
      for (let i = 0; i < userBalance; i++) {
        try {
          // Fetch token ID by index, then fetch agent data
          const tokenResponse = await fetch(`/api/owner/${owner}/token/${i}`);
          if (tokenResponse.ok) {
            const { tokenId } = await tokenResponse.json();
            const agentResponse = await fetch(`/api/agent/${tokenId}`);
            if (agentResponse.ok) {
              const agentData = await agentResponse.json();
              agents.push(formatAgentData(agentData));
            }
          }
        } catch (error) {
          console.warn(`Failed to fetch agent ${i} for owner ${owner}:`, error);
        }
      }
      
      return agents;
    },
    enabled: !!owner && !!balance,
    staleTime: 30000,
  });
}

export function useTopAgents(limit = 6) {
  const { data: allAgents, ...query } = useAllAgents();
  
  return {
    ...query,
    data: allAgents 
      ? allAgents
          .sort((a, b) => b.credScore - a.credScore)
          .slice(0, limit)
      : undefined,
  };
}

export function useAgentStats() {
  const { data: totalSupply } = useTotalSupply();
  const { data: allAgents } = useAllAgents();
  
  return useQuery({
    queryKey: ['agentStats', totalSupply, allAgents?.length],
    queryFn: () => {
      if (!allAgents) return null;
      
      const totalCredScore = allAgents.reduce((sum, agent) => sum + agent.credScore, 0);
      const averageCredScore = allAgents.length > 0 ? totalCredScore / allAgents.length : 0;
      
      return {
        totalAgents: allAgents.length,
        totalCredScore,
        averageCredScore: Math.round(averageCredScore),
        frameworks: [...new Set(allAgents.map(a => a.framework))].length,
        soulboundCount: allAgents.filter(a => a.soulbound).length,
      };
    },
    enabled: !!allAgents,
  });
}

// Search and filter utilities
export function useFilteredAgents(filters: {
  search?: string;
  framework?: string;
  soulbound?: boolean;
  verified?: boolean;
}) {
  const { data: allAgents, ...query } = useAllAgents();
  
  return {
    ...query,
    data: allAgents?.filter(agent => {
      if (filters.search && !agent.name.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }
      if (filters.framework && agent.framework !== filters.framework) {
        return false;
      }
      if (filters.soulbound !== undefined && agent.soulbound !== filters.soulbound) {
        return false;
      }
      // Add more filter logic as needed
      return true;
    }),
  };
}