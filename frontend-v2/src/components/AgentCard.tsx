import React from 'react';
import { Link } from 'react-router-dom';
import { AuraPreview } from './AuraPreview';
import { CredBadge } from './CredBadge';
import { ORIGIN_DISPLAY } from '../lib/constants';

interface Agent {
  tokenId: string;
  name: string;
  agentAddress?: string;
  framework: string;
  credScore: number;
  soulbound: boolean;
  mintOrigin: string | number;
  points: number;
  traitCount: number;
  mutationCount: number;
  temperament?: string;
  communicationStyle?: string;
  riskTolerance?: number;
  autonomyLevel?: number;
  alignment?: string;
  specialization?: string;
  verified?: boolean;
  traits?: any[];
  personality?: {
    quirks?: string;
    communicationStyle?: string;
    values?: string;
    humor?: string;
    riskTolerance?: number;
    autonomyLevel?: number;
  };
}

interface AgentCardProps {
  agent: Agent;
  className?: string;
}

export function AgentCard({ agent, className = '' }: AgentCardProps) {
  const originDisplay = ORIGIN_DISPLAY[agent.mintOrigin] || { icon: '', label: 'Unknown' };
  
  return (
    <Link
      to={`/agent/${agent.tokenId}`}
      className={`agent-card card block hover:scale-105 transition-transform ${className}`}
    >
      {/* Aura Preview */}
      <div className="flex justify-center mb-4">
        <AuraPreview 
          agentData={{
            name: agent.name,
            agentAddress: agent.agentAddress,
            framework: agent.framework,
            points: agent.points,
            traitCount: agent.traitCount || agent.traits?.length || 0,
            mutationCount: agent.mutationCount,
            soulbound: agent.soulbound,
            temperament: agent.temperament,
            communicationStyle: agent.personality?.communicationStyle || agent.communicationStyle,
            riskTolerance: agent.personality?.riskTolerance || agent.riskTolerance,
            autonomyLevel: agent.personality?.autonomyLevel || agent.autonomyLevel,
            alignment: agent.alignment,
            specialization: agent.specialization,
            quirks: agent.personality?.quirks,
            humor: agent.personality?.humor,
            values: agent.personality?.values,
            credScore: agent.credScore,
          }}
          size={120}
        />
      </div>
      
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg truncate mb-1">{agent.name}</h3>
          <div className="flex items-center gap-2">
            <span className="badge badge-sm">{agent.framework}</span>
            {agent.soulbound && (
              <span className="badge badge-sm" style={{ background: 'rgba(179, 136, 255, 0.3)' }}>
                Soulbound
              </span>
            )}
          </div>
        </div>
        
        <CredBadge score={agent.credScore} size="sm" />
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 text-sm" style={{ marginTop: '0.75rem' }}>
        <div className="flex items-center gap-2">
          <span className="text-muted">Points:</span>
          <span className="font-medium">{agent.points.toLocaleString()}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-muted">Traits:</span>
          <span className="font-medium">{agent.traitCount || agent.traits?.length || 0}</span>
        </div>
        
        {agent.verified && (
          <div className="flex items-center gap-1">
            <span style={{ color: '#6eecd8' }}>Verified</span>
          </div>
        )}
      </div>
      
      {/* Agent Address (if available) */}
      {agent.agentAddress && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted">Address:</span>
            <code className="bg-gray-800 px-2 py-1 rounded text-xs">
              {agent.agentAddress.slice(0, 6)}...{agent.agentAddress.slice(-4)}
            </code>
          </div>
        </div>
      )}
    </Link>
  );
}

// Skeleton version for loading states
export function AgentCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`agent-card card ${className}`}>
      {/* Aura skeleton */}
      <div className="flex justify-center mb-4">
        <div className="w-[120px] h-[120px] bg-gray-700 rounded-lg skeleton"></div>
      </div>
      
      {/* Header skeleton */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="h-5 bg-gray-700 rounded w-3/4 mb-2 skeleton"></div>
          <div className="flex gap-2">
            <div className="h-4 bg-gray-700 rounded w-16 skeleton"></div>
            <div className="h-4 bg-gray-700 rounded w-20 skeleton"></div>
          </div>
        </div>
        <div className="w-12 h-12 bg-gray-700 rounded-full skeleton"></div>
      </div>
      
      {/* Stats skeleton */}
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-2">
            <div className="h-3 bg-gray-700 rounded w-12 skeleton"></div>
            <div className="h-3 bg-gray-700 rounded w-8 skeleton"></div>
          </div>
        ))}
      </div>
    </div>
  );
}