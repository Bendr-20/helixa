import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { AuraPreview } from './AuraPreview';
import { CredBadge } from './CredBadge';
import { XLogo, GitHubLogo, FarcasterLogo } from './Icons';
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

const auraData = (agent: Agent) => ({
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
});

export function AgentCard({ agent, className = '' }: AgentCardProps) {
  const verifiedTraits = agent.traits?.filter((t: any) => t.category === 'verification') || [];

  return (
    <Link
      to={`/agent/${agent.tokenId}`}
      className={`agent-card ${className}`}
      style={{
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
        background: 'rgba(10,10,20,0.9)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '14px',
        padding: '1.25rem',
        transition: 'border-color 0.3s, transform 0.3s, box-shadow 0.3s',
      }}
    >
      {/* Desktop: vertical layout */}
      <div className="agent-card-desktop">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
          <AuraPreview agentData={auraData(agent)} size={120} />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontWeight: 600, fontSize: '1.05rem', margin: '0 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agent.name}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span className="badge badge-sm">{agent.framework}</span>
              {agent.soulbound && <span className="badge badge-sm" style={{ background: 'rgba(179,136,255,0.3)' }}>Soulbound</span>}
            </div>
          </div>
          <CredBadge score={agent.credScore} size="sm" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '0.85rem', marginTop: '0.5rem' }}>
          <div><span style={{ color: '#888' }}>Points: </span><span style={{ fontWeight: 500 }}>{agent.points.toLocaleString()}</span></div>
          <div><span style={{ color: '#888' }}>Traits: </span><span style={{ fontWeight: 500 }}>{agent.traitCount || agent.traits?.length || 0}</span></div>
        </div>
        {verifiedTraits.length > 0 && (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '8px' }}>
            {verifiedTraits.map((t: any, i: number) => {
              const p = t.name.replace('-verified', '');
              const icons: Record<string, React.ReactNode> = {
                x: <XLogo className="w-3.5 h-3.5 inline-block align-middle" />,
                github: <GitHubLogo className="w-3.5 h-3.5 inline-block align-middle" />,
                farcaster: <FarcasterLogo className="w-3.5 h-3.5 inline-block align-middle" />,
              };
              return (
                <span key={i} className="badge badge-sm" style={{ background: 'rgba(110,236,216,0.15)', color: '#6eecd8', border: '1px solid rgba(110,236,216,0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  {icons[p] || <CheckCircle className="w-3.5 h-3.5 inline-block align-middle" />} {p}
                </span>
              );
            })}
          </div>
        )}
        {agent.agentAddress && (
          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#888' }}>Address:</span>
            <code style={{ background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem' }}>
              {agent.agentAddress.slice(0, 6)}...{agent.agentAddress.slice(-4)}
            </code>
          </div>
        )}
      </div>

      {/* Mobile: horizontal layout */}
      <div className="agent-card-mobile">
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
          <div style={{ flexShrink: 0 }}>
            <AuraPreview agentData={auraData(agent)} size={72} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
              <h3 style={{ fontWeight: 600, fontSize: '1rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agent.name}</h3>
              <CredBadge score={agent.credScore} size="sm" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
              <span className="badge badge-sm">{agent.framework}</span>
              {agent.soulbound && <span className="badge badge-sm" style={{ background: 'rgba(179,136,255,0.3)' }}>Soulbound</span>}
            </div>
            <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem', color: '#aaa' }}>
              <span>Pts: <strong style={{ color: '#e0e0e0' }}>{agent.points.toLocaleString()}</strong></span>
              <span>Traits: <strong style={{ color: '#e0e0e0' }}>{agent.traitCount || agent.traits?.length || 0}</strong></span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function AgentCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`agent-card ${className}`} style={{
      background: 'rgba(10,10,20,0.9)',
      border: '1px solid rgba(255,255,255,0.04)',
      borderRadius: '14px',
      padding: '1.25rem',
    }}>
      {/* Desktop skeleton */}
      <div className="agent-card-desktop">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
          <div className="skeleton" style={{ width: 120, height: 120, borderRadius: 8, background: 'rgba(255,255,255,0.04)' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ height: 20, width: '70%', borderRadius: 6, background: 'rgba(255,255,255,0.04)', marginBottom: 8 }} />
            <div style={{ display: 'flex', gap: 6 }}>
              <div className="skeleton" style={{ height: 16, width: 60, borderRadius: 6, background: 'rgba(255,255,255,0.04)' }} />
              <div className="skeleton" style={{ height: 16, width: 70, borderRadius: 6, background: 'rgba(255,255,255,0.04)' }} />
            </div>
          </div>
          <div className="skeleton" style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        </div>
      </div>
      {/* Mobile skeleton */}
      <div className="agent-card-mobile">
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <div className="skeleton" style={{ width: 72, height: 72, borderRadius: 8, background: 'rgba(255,255,255,0.04)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ height: 18, width: '60%', borderRadius: 6, background: 'rgba(255,255,255,0.04)', marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 14, width: '40%', borderRadius: 6, background: 'rgba(255,255,255,0.04)' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
