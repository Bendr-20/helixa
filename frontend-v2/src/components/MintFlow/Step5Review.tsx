import React from 'react';
import { MintData } from './MintFlow';
import { AuraPreview } from '../AuraPreview';
import { useMintAgent } from '../../hooks/useHelixa';
import { ORIGIN_DISPLAY } from '../../lib/constants';

interface Step5ReviewProps {
  data: MintData;
  updateData: (updates: Partial<MintData>) => void;
  onPrev: () => void;
  onMintSuccess: (tokenId: string) => void;
}

export function Step5Review({ data, updateData, onPrev, onMintSuccess }: Step5ReviewProps) {
  const { mintAgent, isPending, isConfirming, isConfirmed, hash, error } = useMintAgent();
  
  const handleMint = () => {
    mintAgent({
      name: data.name,
      agentAddress: data.agentAddress,
      framework: data.framework,
      soulbound: data.soulbound,
      temperament: data.temperament,
      communicationStyle: data.communicationStyle,
      riskTolerance: data.riskTolerance,
      autonomyLevel: data.autonomyLevel,
      alignment: data.alignment,
      specialization: data.specialization,
      quirks: data.quirks,
      values: data.values,
      origin: data.origin,
      mission: data.mission,
      lore: data.lore,
      manifesto: data.manifesto,
    });
  };
  
  // Listen for successful mint to get token ID
  React.useEffect(() => {
    if (isConfirmed && hash) {
      // In a real app, you'd extract the token ID from the transaction receipt
      // For now, we'll simulate with a random ID
      const mockTokenId = Math.random().toString(36).substring(2, 15);
      onMintSuccess(mockTokenId);
    }
  }, [isConfirmed, hash, onMintSuccess]);
  
  const totalFields = [
    data.name,
    data.framework,
    data.agentAddress,
    data.temperament,
    data.communicationStyle,
    data.alignment,
    data.specialization,
    ...data.quirks,
    ...data.values,
    data.origin,
    data.mission,
    data.lore,
    data.manifesto,
  ].filter(Boolean).length;
  
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
                  agentAddress: data.agentAddress,
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
            <p className="text-sm text-muted mt-4">
              Your unique visual identity based on personality traits
            </p>
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="glass-card p-4 text-center">
              <div className="text-2xl font-bold text-accent-purple">{totalFields}</div>
              <div className="text-sm text-muted">Total Traits</div>
            </div>
            <div className="glass-card p-4 text-center">
              <div className="text-2xl font-bold text-accent-cyan">0</div>
              <div className="text-sm text-muted">Starting Score</div>
            </div>
          </div>
        </div>
        
        {/* Right: Details */}
        <div className="space-y-6">
          {/* Identity */}
          <div className="card">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <span>🆔</span>
              Identity
            </h4>
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
                <span className="text-muted">Address:</span>
                <code className="text-xs bg-gray-800 px-2 py-1 rounded">
                  {data.agentAddress.slice(0, 8)}...{data.agentAddress.slice(-4)}
                </code>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Type:</span>
                <span className={`badge badge-sm ${data.soulbound ? 'bg-purple-900/30 text-purple-300' : 'bg-green-900/30 text-green-300'}`}>
                  {data.soulbound ? '🔒 Soulbound' : '🔄 Transferable'}
                </span>
              </div>
            </div>
          </div>
          
          {/* Personality */}
          <div className="card">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <span>🧠</span>
              Personality
            </h4>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted block">Temperament:</span>
                  <span className="font-medium capitalize">{data.temperament}</span>
                </div>
                <div>
                  <span className="text-muted block">Communication:</span>
                  <span className="font-medium capitalize">{data.communicationStyle}</span>
                </div>
                <div>
                  <span className="text-muted block">Risk Tolerance:</span>
                  <span className="font-medium">{data.riskTolerance}/10</span>
                </div>
                <div>
                  <span className="text-muted block">Autonomy:</span>
                  <span className="font-medium">{data.autonomyLevel}/10</span>
                </div>
                <div>
                  <span className="text-muted block">Alignment:</span>
                  <span className="font-medium capitalize">{data.alignment.replace('-', ' ')}</span>
                </div>
                <div>
                  <span className="text-muted block">Specialization:</span>
                  <span className="font-medium capitalize">{data.specialization}</span>
                </div>
              </div>
              
              {data.quirks.length > 0 && (
                <div>
                  <span className="text-muted text-sm">Quirks:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {data.quirks.map((quirk, i) => (
                      <span key={i} className="badge badge-sm">{quirk}</span>
                    ))}
                  </div>
                </div>
              )}
              
              {data.values.length > 0 && (
                <div>
                  <span className="text-muted text-sm">Values:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {data.values.map((value, i) => (
                      <span key={i} className="badge badge-sm bg-cyan-900/30 text-cyan-300">{value}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Narrative */}
          {(data.origin || data.mission || data.lore || data.manifesto) && (
            <div className="card">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <span>📖</span>
                Story
              </h4>
              <div className="space-y-3 text-sm">
                {data.origin && (
                  <div>
                    <span className="text-muted font-medium">Origin:</span>
                    <p className="mt-1 text-xs leading-relaxed">{data.origin}</p>
                  </div>
                )}
                {data.mission && (
                  <div>
                    <span className="text-muted font-medium">Mission:</span>
                    <p className="mt-1 text-xs leading-relaxed">{data.mission}</p>
                  </div>
                )}
                {data.lore && (
                  <div>
                    <span className="text-muted font-medium">Lore:</span>
                    <p className="mt-1 text-xs leading-relaxed">{data.lore}</p>
                  </div>
                )}
                {data.manifesto && (
                  <div>
                    <span className="text-muted font-medium">Manifesto:</span>
                    <p className="mt-1 text-xs leading-relaxed">{data.manifesto}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Transaction Status */}
      {(isPending || isConfirming || error) && (
        <div className="mt-8">
          {error && (
            <div className="card bg-red-900/20 border-red-700">
              <h4 className="font-semibold text-red-400 mb-2">Mint Failed</h4>
              <p className="text-sm text-red-300">
                {error.message || 'Transaction failed. Please try again.'}
              </p>
            </div>
          )}
          
          {isPending && (
            <div className="card bg-yellow-900/20 border-yellow-700">
              <div className="flex items-center gap-3">
                <div className="spinner"></div>
                <div>
                  <h4 className="font-semibold text-yellow-400">Waiting for Signature</h4>
                  <p className="text-sm text-yellow-300">
                    Please confirm the transaction in your wallet.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {isConfirming && (
            <div className="card bg-blue-900/20 border-blue-700">
              <div className="flex items-center gap-3">
                <div className="spinner"></div>
                <div>
                  <h4 className="font-semibold text-blue-400">Minting Agent...</h4>
                  <p className="text-sm text-blue-300">
                    Transaction submitted. Waiting for confirmation.
                  </p>
                  {hash && (
                    <a
                      href={`https://basescan.org/tx/${hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-accent-cyan hover:underline mt-1 block"
                    >
                      View on BaseScan →
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <button
          onClick={onPrev}
          disabled={isPending || isConfirming}
          className="btn btn-secondary"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        
        <button
          onClick={handleMint}
          disabled={isPending || isConfirming}
          className="btn btn-primary btn-lg glow"
        >
          {isPending || isConfirming ? (
            <>
              <div className="spinner w-4 h-4"></div>
              {isPending ? 'Sign Transaction' : 'Minting...'}
            </>
          ) : (
            <>
              🚀 Mint Agent
            </>
          )}
        </button>
      </div>
    </div>
  );
}