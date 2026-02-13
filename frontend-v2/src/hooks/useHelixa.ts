import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { CONTRACT_ADDRESS } from '../lib/constants';
import HelixaV2ABI from '../abi/HelixaV2.json';

// Contract read hooks
export function useGetAgent(tokenId: bigint | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi: HelixaV2ABI.abi,
    functionName: 'getAgent',
    args: tokenId ? [tokenId] : undefined,
    query: {
      enabled: !!tokenId,
    },
  });
}

export function useGetAgentByAddress(agentAddress: string | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi: HelixaV2ABI.abi,
    functionName: 'getAgentByAddress',
    args: agentAddress ? [agentAddress] : undefined,
    query: {
      enabled: !!agentAddress,
    },
  });
}

export function useTotalSupply() {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi: HelixaV2ABI.abi,
    functionName: 'totalSupply',
  });
}

export function useTokenOfOwnerByIndex(owner: string | undefined, index: bigint) {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi: HelixaV2ABI.abi,
    functionName: 'tokenOfOwnerByIndex',
    args: owner ? [owner, index] : undefined,
    query: {
      enabled: !!owner,
    },
  });
}

export function useBalanceOf(owner: string | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi: HelixaV2ABI.abi,
    functionName: 'balanceOf',
    args: owner ? [owner] : undefined,
    query: {
      enabled: !!owner,
    },
  });
}

export function useOwnerOf(tokenId: bigint | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi: HelixaV2ABI.abi,
    functionName: 'ownerOf',
    args: tokenId ? [tokenId] : undefined,
    query: {
      enabled: !!tokenId,
    },
  });
}

// Contract write hooks
export function useMintAgent() {
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  const mintAgent = (params: {
    name: string;
    agentAddress: string;
    framework: string;
    soulbound: boolean;
    temperament: string;
    communicationStyle: string;
    riskTolerance: number;
    autonomyLevel: number;
    alignment: string;
    specialization: string;
    quirks: string[];
    values: string[];
    origin?: string;
    mission?: string;
    lore?: string;
    manifesto?: string;
  }) => {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: HelixaV2ABI.abi,
      functionName: 'mint',
      args: [
        params.name,
        params.agentAddress,
        params.framework,
        params.soulbound,
        params.temperament,
        params.communicationStyle,
        params.riskTolerance,
        params.autonomyLevel,
        params.alignment,
        params.specialization,
        params.quirks,
        params.values,
        params.origin || '',
        params.mission || '',
        params.lore || '',
        params.manifesto || '',
      ],
    } as any);
  };

  return {
    mintAgent,
    hash,
    error,
    isPending,
    isConfirming,
    isConfirmed,
  };
}

export function useUpdateAgent() {
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  const updateAgent = (tokenId: bigint, params: {
    name?: string;
    temperament?: string;
    communicationStyle?: string;
    riskTolerance?: number;
    autonomyLevel?: number;
    alignment?: string;
    specialization?: string;
    quirks?: string[];
    values?: string[];
    origin?: string;
    mission?: string;
    lore?: string;
    manifesto?: string;
  }) => {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: HelixaV2ABI.abi,
      functionName: 'updateAgent',
      args: [tokenId, params],
    } as any);
  };

  return {
    updateAgent,
    hash,
    error,
    isPending,
    isConfirming,
    isConfirmed,
  };
}

// Helper to format agent data
export function formatAgentData(rawData: any) {
  if (!rawData) return null;
  
  return {
    tokenId: rawData[0],
    name: rawData[1],
    agentAddress: rawData[2],
    framework: rawData[3],
    owner: rawData[4],
    soulbound: rawData[5],
    mintOrigin: rawData[6],
    generation: rawData[7],
    points: Number(rawData[8]),
    credScore: Number(rawData[9]),
    traitCount: Number(rawData[10]),
    mutationCount: Number(rawData[11]),
    temperament: rawData[12],
    communicationStyle: rawData[13],
    riskTolerance: Number(rawData[14]),
    autonomyLevel: Number(rawData[15]),
    alignment: rawData[16],
    specialization: rawData[17],
    quirks: rawData[18],
    values: rawData[19],
    origin: rawData[20],
    mission: rawData[21],
    lore: rawData[22],
    manifesto: rawData[23],
  };
}