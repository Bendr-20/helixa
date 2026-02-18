import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { AuraPreview } from '../components/AuraPreview';
import { CredBadge } from '../components/CredBadge';
import { useAgent } from '../hooks/useAgents';
import { ORIGIN_DISPLAY, EXPLORER_URL, CONTRACT_ADDRESS } from '../lib/constants';

export function AgentProfile() {
  const { id } = useParams<{ id: string }>();
  const { data: agent, isLoading, error } = useAgent(id);

  if (isLoading) {
    return (
      <div className="py-8">
        <div className="container">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1">
                <div className="card text-center">
                  <div className="w-64 h-64 bg-gray-700 rounded-lg mx-auto mb-4 skeleton"></div>
                  <div className="h-6 bg-gray-700 rounded w-32 mx-auto mb-2 skeleton"></div>
                  <div className="h-4 bg-gray-700 rounded w-24 mx-auto skeleton"></div>
                </div>
              </div>
              <div className="lg:col-span-2">
                <div className="space-y-6">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="card">
                      <div className="h-6 bg-gray-700 rounded w-48 mb-4 skeleton"></div>
                      <div className="space-y-2">
                        <div className="h-4 bg-gray-700 rounded w-full skeleton"></div>
                        <div className="h-4 bg-gray-700 rounded w-3/4 skeleton"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="py-8">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center">
            <div className="card bg-red-900/20 border-red-700 py-12">
              <h3 className="text-lg font-semibold text-red-400 mb-2">Agent Not Found</h3>
              <p className="text-red-300 mb-6">
                The agent you're looking for doesn't exist or couldn't be loaded.
              </p>
              <Link to="/agents" className="btn btn-secondary">Browse All Agents</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const originKey = agent.mintOrigin === 'HUMAN' ? 0 : agent.mintOrigin === 'AGENT_SIWA' ? 1 : agent.mintOrigin === 'API' ? 2 : agent.mintOrigin === 'OWNER' ? 3 : 0;
  const originDisplay = ORIGIN_DISPLAY[originKey] || { icon: '❓', label: 'Unknown' };

  return (
    <div className="py-8">
      <div className="container">
        <div className="max-w-6xl mx-auto">
          {/* Back Button */}
          <div className="mb-6">
            <Link to="/agents" className="btn btn-ghost">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
              Back to Directory
            </Link>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left Column */}
            <div className="lg:col-span-1">
              <div className="card text-center sticky top-8">
                <div className="mb-6">
                  <AuraPreview
                    agentData={{
                      name: agent.name,
                      agentAddress: agent.agentAddress as `0x${string}`,
                      framework: agent.framework,
                      points: agent.points,
                      traitCount: agent.traits?.length || 0,
                      mutationCount: agent.mutationCount,
                      soulbound: agent.soulbound,
                      communicationStyle: agent.personality?.communicationStyle,
                      riskTolerance: agent.personality?.riskTolerance,
                      autonomyLevel: agent.personality?.autonomyLevel,
                      quirks: agent.personality?.quirks,
                      humor: agent.personality?.humor,
                      values: agent.personality?.values,
                      origin: agent.narrative?.origin,
                      mission: agent.narrative?.mission,
                      credScore: agent.credScore,
                    }}
                    size={280}
                  />
                </div>

                <h1 className="text-2xl font-heading font-bold mb-1">{agent.name}</h1>
                {agent.agentName && (
                  <p className="text-accent-cyan mb-1">{agent.agentName}.agent</p>
                )}
                <p className="text-muted mb-4">Token #{agent.tokenId}</p>

                <div className="mb-6">
                  <CredBadge score={agent.credScore} size="lg" />
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="glass-card p-3">
                    <div className="text-lg font-bold text-accent-purple">{agent.points.toLocaleString()}</div>
                    <div className="text-muted">Points</div>
                  </div>
                  <div className="glass-card p-3">
                    <div className="text-lg font-bold text-accent-cyan">{agent.traits?.length || 0}</div>
                    <div className="text-muted">Traits</div>
                  </div>
                </div>

                <a
                  href={`${EXPLORER_URL}/token/${CONTRACT_ADDRESS}?a=${agent.tokenId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost text-xs mt-4 w-full"
                >
                  View on BaseScan →
                </a>
              </div>
            </div>

            {/* Right Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Identity */}
              <div className="card">
                <h2 className="text-xl font-semibold mb-4">Identity & Origin</h2>
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <span className="text-muted block text-sm">Framework</span>
                    <span className="badge mt-1">{agent.framework}</span>
                  </div>
                  <div>
                    <span className="text-muted block text-sm">Mint Origin</span>
                    <span className="flex items-center gap-1 mt-1">
                      <span>{originDisplay.icon}</span>
                      <span className="font-medium">{originDisplay.label}</span>
                    </span>
                  </div>
                  <div>
                    <span className="text-muted block text-sm">Type</span>
                    <span className={`badge mt-1 ${agent.soulbound ? 'bg-purple-900/30 text-purple-300' : 'bg-green-900/30 text-green-300'}`}>
                      {agent.soulbound ? '🔒 Soulbound' : '🔄 Transferable'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted block text-sm">Verified</span>
                    <span className="font-medium mt-1">{agent.verified ? '✅ Yes' : '❌ No'}</span>
                  </div>
                </div>

                {agent.agentAddress && (
                  <div>
                    <span className="text-muted block text-sm mb-1">Agent Address</span>
                    <div 
                      className="bg-gray-800 px-3 py-2 rounded text-sm flex items-center justify-between cursor-pointer hover:bg-gray-700 transition-colors"
                      onClick={() => {
                        navigator.clipboard.writeText(agent.agentAddress);
                        const el = document.getElementById('copy-toast');
                        if (el) { el.style.opacity = '1'; setTimeout(() => { el.style.opacity = '0'; }, 1500); }
                      }}
                      title="Click to copy"
                    >
                      <code>
                        {agent.agentAddress.slice(0, 6)}...{agent.agentAddress.slice(-4)}
                      </code>
                      <span id="copy-toast" className="text-xs transition-opacity duration-300" style={{ opacity: 0, color: '#6eecd8' }}>Copied!</span>
                      <a 
                        href={`https://basescan.org/address/${agent.agentAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs hover:underline"
                        style={{ color: '#80d0ff' }}
                      >
                        View
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Personality */}
              {agent.personality && (
                <div className="card">
                  <h2 className="text-xl font-semibold mb-4">Personality</h2>
                  <div className="space-y-4">
                    {agent.personality.quirks && (
                      <div>
                        <span className="text-muted text-sm">Quirks</span>
                        <p className="font-medium">{agent.personality.quirks}</p>
                      </div>
                    )}
                    {agent.personality.communicationStyle && (
                      <div>
                        <span className="text-muted text-sm">Communication Style</span>
                        <p className="font-medium">{agent.personality.communicationStyle}</p>
                      </div>
                    )}
                    {agent.personality.humor && (
                      <div>
                        <span className="text-muted text-sm">Humor</span>
                        <p className="font-medium">{agent.personality.humor}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-muted block text-sm">Risk Tolerance</span>
                        <div className="flex items-center gap-3 mt-1">
                          <div className="flex-1 h-2 bg-gray-700 rounded-full">
                            <div className="h-full rounded-full" style={{
                              width: `${(agent.personality.riskTolerance / 10) * 100}%`,
                              background: 'linear-gradient(135deg, #b490ff, #6eecd8)'
                            }} />
                          </div>
                          <span className="text-sm font-medium">{agent.personality.riskTolerance}/10</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-muted block text-sm">Autonomy Level</span>
                        <div className="flex items-center gap-3 mt-1">
                          <div className="flex-1 h-2 bg-gray-700 rounded-full">
                            <div className="h-full rounded-full" style={{
                              width: `${(agent.personality.autonomyLevel / 10) * 100}%`,
                              background: 'linear-gradient(135deg, #b490ff, #f5a0d0)'
                            }} />
                          </div>
                          <span className="text-sm font-medium">{agent.personality.autonomyLevel}/10</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Narrative */}
              {agent.narrative && (agent.narrative.origin || agent.narrative.mission || agent.narrative.lore || agent.narrative.manifesto) && (
                <div className="card">
                  <h2 className="text-xl font-semibold mb-4">Story</h2>
                  <div className="space-y-5">
                    {agent.narrative.origin && (
                      <div>
                        <h3 className="font-medium text-accent-purple mb-1">Origin</h3>
                        <p className="text-muted leading-relaxed">{agent.narrative.origin}</p>
                      </div>
                    )}
                    {agent.narrative.mission && (
                      <div>
                        <h3 className="font-medium text-accent-cyan mb-1">Mission</h3>
                        <p className="text-muted leading-relaxed">{agent.narrative.mission}</p>
                      </div>
                    )}
                    {agent.narrative.lore && (
                      <div>
                        <h3 className="font-medium text-accent-pink mb-1">Lore</h3>
                        <p className="text-muted leading-relaxed">{agent.narrative.lore}</p>
                      </div>
                    )}
                    {agent.narrative.manifesto && (
                      <div>
                        <h3 className="font-medium text-yellow-400 mb-1">Manifesto</h3>
                        <p className="text-muted leading-relaxed">{agent.narrative.manifesto}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Social Verifications */}
              {agent.traits && agent.traits.some((t: any) => t.category === 'verification') && (
                <div className="card">
                  <h2 className="text-xl font-semibold mb-4">Verified Accounts</h2>
                  <div className="flex flex-wrap gap-3">
                    {agent.traits.filter((t: any) => t.category === 'verification').map((t: any, i: number) => {
                      const platform = t.name.replace('-verified', '');
                      const icons: Record<string, { icon: string; color: string; label: string }> = {
                        x: { icon: '𝕏', color: '#1DA1F2', label: 'X / Twitter' },
                        github: { icon: '🐙', color: '#8b5cf6', label: 'GitHub' },
                        farcaster: { icon: '🟣', color: '#855DCD', label: 'Farcaster' },
                      };
                      const info = icons[platform] || { icon: '✓', color: '#6eecd8', label: platform };
                      return (
                        <div key={i} className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{ background: `${info.color}15`, border: `1px solid ${info.color}40` }}>
                          <span className="text-lg">{info.icon}</span>
                          <span className="font-medium" style={{ color: info.color }}>{info.label}</span>
                          <span className="text-green-400 text-sm">✓ Verified</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Traits */}
              {agent.traits && agent.traits.length > 0 && (
                <div className="card">
                  <h2 className="text-xl font-semibold mb-4">Traits</h2>
                  <div className="flex flex-wrap gap-2">
                    {agent.traits.filter((t: any) => t.category !== 'verification').map((trait: any, i: number) => (
                      <span key={i} className="badge">
                        {typeof trait === 'string' ? trait : `${trait.name} (${trait.category})`}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Evolution */}
              <div className="card">
                <h2 className="text-xl font-semibold mb-4">Evolution</h2>
                <div className="grid grid-cols-3 gap-4">
                  <div className="glass-card p-4 text-center">
                    <div className="text-2xl font-bold text-accent-purple">{agent.generation}</div>
                    <div className="text-sm text-muted">Generation</div>
                  </div>
                  <div className="glass-card p-4 text-center">
                    <div className="text-2xl font-bold text-accent-cyan">{agent.mutationCount}</div>
                    <div className="text-sm text-muted">Mutations</div>
                  </div>
                  <div className="glass-card p-4 text-center">
                    <div className="text-lg font-bold text-accent-pink">
                      {agent.mintedAt ? new Date(agent.mintedAt * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                    </div>
                    <div className="text-sm text-muted">Minted</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
