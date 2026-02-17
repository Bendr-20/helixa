import React, { useState } from 'react';
import { MintData } from './MintFlow';
import { AuraPreview } from '../AuraPreview';
import { useMint, useMintPrice, useHasMinted, useSetPersonality, useSetNarrative } from '../../hooks/useHelixa';
import { EXPLORER_URL, CONTRACT_ADDRESS } from '../../lib/constants';
import { useAccount } from 'wagmi';
import { parseAbiItem, decodeEventLog } from 'viem';
import { usePublicClient } from 'wagmi';
import HelixaV2ABI from '../../abi/HelixaV2.json';

interface Step5ReviewProps {
  data: MintData;
  updateData: (updates: Partial<MintData>) => void;
  onPrev: () => void;
  onMintSuccess: (tokenId: string) => void;
}

export function Step5Review({ data, updateData, onPrev, onMintSuccess }: Step5ReviewProps) {
  const { mint, isPending, isConfirming, isConfirmed, hash, error } = useMint();
  const { setPersonality, isPending: isPendingPersonality, isConfirming: isConfirmingPersonality } = useSetPersonality();
  const { setNarrative, isPending: isPendingNarrative, isConfirming: isConfirmingNarrative } = useSetNarrative();
  const { data: mintPrice } = useMintPrice();
  const { address } = useAccount();
  const { data: hasMinted } = useHasMinted(address);
  const publicClient = usePublicClient();
  const [mintStage, setMintStage] = useState<'idle' | 'minting' | 'personality' | 'narrative' | 'done'>('idle');
  const [mintError, setMintError] = useState<string | null>(null);

  const handleMint = async () => {
    if (!address) return;
    setMintError(null);
    setMintStage('minting');

    try {
      // Human mint: direct contract interaction, pay ETH
      mint({
        agentAddress: (data.agentAddress || address) as `0x${string}`,
        name: data.name,
        framework: data.framework,
        soulbound: data.soulbound,
        value: (mintPrice as bigint) ?? BigInt(0),
      });
    } catch (e: any) {
      setMintError(e.message || 'Mint failed');
      setMintStage('idle');
    }
  };

  // After mint confirms, set personality + narrative, then extract tokenId
  React.useEffect(() => {
    if (!isConfirmed || !hash || mintStage === 'done') return;

    const postMint = async () => {
      // Extract tokenId from the mint tx receipt
      let tokenId: any = null as any;
      try {
        const receipt = await publicClient?.getTransactionReceipt({ hash });
        if (receipt) {
          for (const log of receipt.logs) {
            try {
              if (log.address.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase()) continue;
              const decoded = decodeEventLog({
                abi: HelixaV2ABI.abi,
                data: log.data,
                topics: ((log as any).topics),
              });
              if (decoded.eventName === 'AgentRegistered') {
                tokenId = (decoded.args as any).tokenId;
                break;
              }
            } catch {}
          }
          // Fallback: ERC721 Transfer event (topic 0 = Transfer, topic 3 = tokenId)
          if (tokenId === null) {
            for (const log of receipt.logs) {
              if (((log as any).topics)[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {
                tokenId = BigInt(((log as any).topics)[3]);
                break;
              }
            }
          }
        }
      } catch {}

      if (tokenId === null) {
        // Worst case, still proceed
        onMintSuccess('?');
        return;
      }

      // Set personality if any fields provided
      const hasPersonality = data.quirks.length > 0 || data.communicationStyle || data.riskTolerance !== 5 || data.autonomyLevel !== 5;
      if (hasPersonality) {
        setMintStage('personality');
        try {
          setPersonality(tokenId, {
            quirks: data.quirks.join(', '),
            communicationStyle: data.communicationStyle,
            values: (data as any).personalityValues || '',
            humor: '',
            riskTolerance: data.riskTolerance,
            autonomyLevel: data.autonomyLevel,
          });
        } catch {}
      }

      // Set narrative if any fields provided
      const hasNarrative = data.origin || data.mission || data.lore || data.manifesto;
      if (hasNarrative) {
        setMintStage('narrative');
        try {
          setNarrative(tokenId, {
            origin: data.origin || '',
            mission: data.mission || '',
            lore: data.lore || '',
            manifesto: data.manifesto || '',
          });
        } catch {}
      }

      setMintStage('done');
      onMintSuccess(tokenId.toString());
    };

    postMint();
  }, [isConfirmed, hash]);

  const totalFields = [
    data.name, data.framework, data.agentAddress,
    data.temperament, data.communicationStyle,
    data.alignment, data.specialization,
    ...data.quirks, ...(data as any).values || [],
    data.origin, data.mission, data.lore, data.manifesto,
  ].filter(Boolean).length;

  const isBusy = isPending || isConfirming || isPendingPersonality || isConfirmingPersonality || isPendingNarrative || isConfirmingNarrative;
  const alreadyMinted = hasMinted === true;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 text-center">
        <h3 className="text-xl font-semibold mb-2">Review & Mint</h3>
        <p className="text-muted">
          Review your agent's profile before minting to the blockchain.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left: Aura Preview */}
        <div className="space-y-6">
          <div className="text-center">
            <h4 className="font-semibold mb-4">Aura Preview</h4>
            <div className="flex justify-center">
              <AuraPreview
                agentData={{
                  name: data.name,
                  agentAddress: (data.agentAddress || address || '0x0') as `0x${string}`,
                  framework: data.framework,
                  points: 0,
                  traitCount: totalFields,
                  mutationCount: 0,
                  soulbound: data.soulbound,
                  temperament: data.temperament,
                  communicationStyle: data.communicationStyle,
                  riskTolerance: data.riskTolerance,
                  autonomyLevel: data.autonomyLevel,
                  alignment: data.alignment,
                  specialization: data.specialization,
                }}
                size={300}
                className="border-2 border-accent-purple/30 rounded-lg p-4 bg-surface/50"
              />
            </div>
          </div>

          {/* Cost */}
          <div className="glass-card p-4 text-center">
            <div className="text-2xl font-bold text-accent-cyan">
              {mintPrice ? `${Number(mintPrice) / 1e18} ETH` : 'Free'}
            </div>
            <div className="text-sm text-muted">Mint Cost</div>
          </div>
        </div>

        {/* Right: Details */}
        <div className="space-y-6">
          <div className="card">
            <h4 className="font-semibold mb-3">Identity</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Name:</span>
                <span className="font-medium">{data.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Framework:</span>
                <span className="badge badge-sm">{data.framework}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Type:</span>
                <span className={`badge badge-sm ${data.soulbound ? 'bg-purple-900/30 text-purple-300' : 'bg-green-900/30 text-green-300'}`}>
                  {data.soulbound ? '🔒 Soulbound' : '🔄 Transferable'}
                </span>
              </div>
            </div>
          </div>

          {/* Personality summary */}
          <div className="card">
            <h4 className="font-semibold mb-3">Personality</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted">Temperament:</span> <span className="capitalize">{data.temperament}</span></div>
              <div><span className="text-muted">Style:</span> <span className="capitalize">{data.communicationStyle}</span></div>
              <div><span className="text-muted">Risk:</span> {data.riskTolerance}/10</div>
              <div><span className="text-muted">Autonomy:</span> {data.autonomyLevel}/10</div>
            </div>
          </div>

          {/* Narrative */}
          {(data.origin || data.mission || data.lore) && (
            <div className="card">
              <h4 className="font-semibold mb-3">Story</h4>
              <div className="space-y-2 text-sm">
                {data.origin && <div><span className="text-muted">Origin:</span> <span className="text-xs">{data.origin}</span></div>}
                {data.mission && <div><span className="text-muted">Mission:</span> <span className="text-xs">{data.mission}</span></div>}
                {data.lore && <div><span className="text-muted">Lore:</span> <span className="text-xs">{data.lore}</span></div>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status Messages */}
      {(mintError || isBusy || alreadyMinted) && (
        <div className="mt-8">
          {alreadyMinted && !isBusy && (
            <div className="card bg-yellow-900/20 border-yellow-700">
              <p className="text-sm text-yellow-300">⚠️ This wallet already has an agent minted. One per address.</p>
            </div>
          )}
          {(mintError || error) && (
            <div className="card bg-red-900/20 border-red-700">
              <h4 className="font-semibold text-red-400 mb-1">Mint Failed</h4>
              <p className="text-sm text-red-300">{mintError || error?.message || 'Transaction failed.'}</p>
            </div>
          )}
          {isPending && (
            <div className="card bg-yellow-900/20 border-yellow-700">
              <div className="flex items-center gap-3">
                <div className="spinner"></div>
                <div>
                  <h4 className="font-semibold text-yellow-400">Confirm in Wallet</h4>
                  <p className="text-sm text-yellow-300">Sign the mint transaction.</p>
                </div>
              </div>
            </div>
          )}
          {isConfirming && (
            <div className="card bg-blue-900/20 border-blue-700">
              <div className="flex items-center gap-3">
                <div className="spinner"></div>
                <div>
                  <h4 className="font-semibold text-blue-400">Minting...</h4>
                  {hash && (
                    <a href={`${EXPLORER_URL}/tx/${hash}`} target="_blank" rel="noopener noreferrer" className="text-xs text-accent-cyan hover:underline">
                      View on BaseScan →
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
          {mintStage === 'personality' && (
            <div className="card bg-purple-900/20 border-purple-700">
              <div className="flex items-center gap-3">
                <div className="spinner"></div>
                <div><h4 className="font-semibold text-purple-400">Setting personality onchain...</h4></div>
              </div>
            </div>
          )}
          {mintStage === 'narrative' && (
            <div className="card bg-cyan-900/20 border-cyan-700">
              <div className="flex items-center gap-3">
                <div className="spinner"></div>
                <div><h4 className="font-semibold text-cyan-400">Writing narrative onchain...</h4></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <button onClick={onPrev} disabled={isBusy} className="btn btn-secondary">← Back</button>
        <button
          onClick={handleMint}
          disabled={isBusy || alreadyMinted || !data.name}
          className="btn btn-primary btn-lg glow"
        >
          {isBusy ? (
            <><div className="spinner w-4 h-4"></div> {isPending ? 'Sign...' : 'Minting...'}</>
          ) : (
            <>🧬 Mint Agent — {mintPrice ? `${Number(mintPrice) / 1e18} ETH` : 'Free'}</>
          )}
        </button>
      </div>
    </div>
  );
}
