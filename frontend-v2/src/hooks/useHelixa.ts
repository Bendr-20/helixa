import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';
import { CONTRACT_ADDRESS } from '../lib/constants';
import HelixaV2ABI from '../abi/HelixaV2.json';

const abi = HelixaV2ABI.abi;

// ─── Read Hooks ─────────────────────────────────────────────

export function useTotalAgents() {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi,
    functionName: 'totalAgents',
  });
}

export function useMintPrice() {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi,
    functionName: 'mintPrice',
  });
}

export function useTraitPrice() {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi,
    functionName: 'traitPrice',
  });
}

export function useNamePrice() {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi,
    functionName: 'namePrice',
  });
}

export function useGetAgent(tokenId: bigint | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi,
    functionName: 'getAgent',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function useGetPersonality(tokenId: bigint | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi,
    functionName: 'getPersonality',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function useGetNarrative(tokenId: bigint | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi,
    functionName: 'getNarrative',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function useGetTraits(tokenId: bigint | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi,
    functionName: 'getTraits',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function useGetCredScore(tokenId: bigint | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi,
    functionName: 'getCredScore',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function useGetCredBreakdown(tokenId: bigint | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi,
    functionName: 'getCredBreakdown',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function useGetMintOrigin(tokenId: bigint | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi,
    functionName: 'getMintOrigin',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function usePoints(tokenId: bigint | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi,
    functionName: 'points',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function useOwnerOf(tokenId: bigint | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi,
    functionName: 'ownerOf',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function useBalanceOf(owner: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi,
    functionName: 'balanceOf',
    args: owner ? [owner] : undefined,
    query: { enabled: !!owner },
  });
}

export function useNameOf(tokenId: bigint | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi,
    functionName: 'nameOf',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function useResolveName(name: string | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi,
    functionName: 'resolveName',
    args: name ? [name] : undefined,
    query: { enabled: !!name },
  });
}

export function useHasMinted(address: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi,
    functionName: 'hasMinted',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

// ─── Write Hooks ────────────────────────────────────────────

export function useMint() {
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const mint = (params: {
    agentAddress: `0x${string}`;
    name: string;
    framework: string;
    soulbound: boolean;
    value: bigint;
  }) => {
    // @ts-ignore - wagmi infers chain/account from connected wallet
    writeContract({
      address: CONTRACT_ADDRESS,
      abi,
      functionName: 'mint',
      args: [params.agentAddress, params.name, params.framework, params.soulbound],
      value: params.value,
    });
  };

  return { mint, hash, error, isPending, isConfirming, isConfirmed };
}

export function useAddTrait() {
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const addTrait = (tokenId: bigint, name: string, category: string, value: bigint) => {
    // @ts-ignore - wagmi infers chain/account from connected wallet
    writeContract({
      address: CONTRACT_ADDRESS,
      abi,
      functionName: 'addTrait',
      args: [tokenId, name, category],
      value,
    });
  };

  return { addTrait, hash, error, isPending, isConfirming, isConfirmed };
}

export function useSetPersonality() {
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const setPersonality = (tokenId: bigint, personality: {
    quirks: string;
    communicationStyle: string;
    values: string;
    humor: string;
    riskTolerance: number;
    autonomyLevel: number;
  }) => {
    // @ts-ignore - wagmi infers chain/account from connected wallet
    writeContract({
      address: CONTRACT_ADDRESS,
      abi,
      functionName: 'setPersonality',
      args: [tokenId, personality],
    });
  };

  return { setPersonality, hash, error, isPending, isConfirming, isConfirmed };
}

export function useSetNarrative() {
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const setNarrative = (tokenId: bigint, narrative: {
    origin: string;
    mission: string;
    lore: string;
    manifesto: string;
  }) => {
    // @ts-ignore - wagmi infers chain/account from connected wallet
    writeContract({
      address: CONTRACT_ADDRESS,
      abi,
      functionName: 'setNarrative',
      args: [tokenId, narrative],
    });
  };

  return { setNarrative, hash, error, isPending, isConfirming, isConfirmed };
}

export function useSetOrigin() {
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const setOrigin = (tokenId: bigint, text: string) => {
    // @ts-ignore - wagmi infers chain/account from connected wallet
    writeContract({
      address: CONTRACT_ADDRESS,
      abi,
      functionName: 'setOrigin',
      args: [tokenId, text],
    });
  };

  return { setOrigin, hash, error, isPending, isConfirming, isConfirmed };
}

export function useRegisterName() {
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const registerName = (tokenId: bigint, name: string, value: bigint) => {
    // @ts-ignore - wagmi infers chain/account from connected wallet
    writeContract({
      address: CONTRACT_ADDRESS,
      abi,
      functionName: 'registerName',
      args: [tokenId, name],
      value,
    });
  };

  return { registerName, hash, error, isPending, isConfirming, isConfirmed };
}

export function useMutate() {
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const mutate = (tokenId: bigint, newVersion: string) => {
    // @ts-ignore - wagmi infers chain/account from connected wallet
    writeContract({
      address: CONTRACT_ADDRESS,
      abi,
      functionName: 'mutate',
      args: [tokenId, newVersion],
    });
  };

  return { mutate, hash, error, isPending, isConfirming, isConfirmed };
}

// Helper to format raw agent tuple from contract
export function formatAgentData(rawData: any): any {
  if (!rawData) return null;
  return {
    agentAddress: rawData[0] || rawData.agentAddress,
    name: rawData[1] || rawData.name || '',
    framework: rawData[2] || rawData.framework || '',
    mintedAt: Number(rawData[3] || rawData.mintedAt || 0),
    verified: rawData[4] ?? rawData.verified ?? false,
    soulbound: rawData[5] ?? rawData.soulbound ?? false,
    origin: Number(rawData[6] ?? rawData.origin ?? 0),
    generation: Number(rawData[7] || rawData.generation || 0),
    parentId: Number(rawData[8] || rawData.parentId || 0),
    mutationCount: Number(rawData[9] || rawData.mutationCount || 0),
    currentVersion: rawData[10] || rawData.currentVersion || '1.0',
  };
}
