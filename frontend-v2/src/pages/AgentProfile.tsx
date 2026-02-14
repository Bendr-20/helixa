import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { AuraPreview } from '../components/AuraPreview';
import { CredBadge } from '../components/CredBadge';
import { useGetAgent, formatAgentData } from '../hooks/useHelixa';
import { ORIGIN_DISPLAY } from '../lib/constants';

export function AgentProfile() {
  const { id } = useParams<{ id: string }>();
  const tokenId = id ? BigInt(id) : undefined;
  
  const { data: rawAgentData, isLoading, error } = useGetAgent(tokenId);
  const agent = formatAgentData(rawAgentData);
  
  if (isLoading) {
    return (
      <div className="py-8">
        <div className="container">
          <div className="max-w-6xl mx-auto">
            {/* Loading skeleton */}
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
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-red-400 mb-2">Agent Not Found</h3>
              <p className="text-red-300 mb-6">
                The agent you're looking for doesn't exist or couldn't be loaded.
              </p>
              <Link to="/agents" className="btn btn-secondary">
                Browse All Agents
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  const originDisplay = ORIGIN_DISPLAY[agent.mintOrigin] || { icon: '', label: 'Unknown' };
  
  // Mock breakdown for Cred Score
  const credBreakdown = {
    reputation: Math.min(100, agent.credScore * 0.4),
    activity: Math.min(100, agent.credScore * 0.3),
    contributions: Math.min(100, agent.credScore * 0.2),
    verification: Math.min(100, agent.credScore * 0.1),
  };
  
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
            {/* Left Column - Aura & Basic Info */}
            <div className="lg:col-span-1">
              <div className="card text-center sticky top-8">
                {/* Large Aura */}
                <div className="mb-6">
                  <AuraPreview
                    agentData={{
                      name: agent.name,
                      agentAddress: agent.agentAddress,
                      framework: agent.framework,
                      points: agent.points,
                      traitCount: agent.traitCount,
                      mutationCount: agent.mutationCount,
                      soulbound: agent.soulbound,
                      temperament: agent.temperament,
                      communicationStyle: agent.communicationStyle,
                      riskTolerance: agent.riskTolerance,
                      autonomyLevel: agent.autonomyLevel,
                      alignment: agent.alignment,
                      specialization: agent.specialization,
                    }}
                    size={280}
                  />
                </div>
                
                {/* Basic Info */}
                <h1 className="text-2xl font-heading font-bold mb-2">{agent.name}</h1>
                <p className="text-muted mb-4">Token ID #{agent.tokenId}</p>
                
                {/* Cred Score */}
                <div className="mb-6">
                  <CredBadge 
                    score={agent.credScore} 
                    size="lg"
                    showBreakdown
                    breakdown={credBreakdown}
                  />
                </div>
                
                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="glass-card p-3">
                    <div className="text-lg font-bold text-accent-purple">#{agent.tokenId}</div>
                    <div className="text-muted">Rank</div>
                  </div>
                  <div className="glass-card p-3">
                    <div className="text-lg font-bold text-accent-cyan">{agent.points.toLocaleString()}</div>
                    <div className="text-muted">Points</div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Right Column - Details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Identity & Origin */}
              <div className="card">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  Identity & Origin
                </h2>
                
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
                      {agent.soulbound ? 'Soulbound' : 'Transferable'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted block text-sm">Generation</span>
                    <span className="font-medium mt-1">{agent.generation}</span>
                  </div>
                </div>
                
                {agent.agentAddress && (
                  <div>
                    <span className="text-muted block text-sm mb-1">Agent Address</span>
                    <code className="bg-gray-800 px-3 py-2 rounded text-sm block break-all">
                      {agent.agentAddress}
                    </code>
                  </div>
                )}
              </div>
              
              {/* Personality */}
              <div className="card">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  Personality Profile
                </h2>
                
                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  <div className="space-y-4">
                    <div>
                      <span className="text-muted block text-sm">Temperament</span>
                      <span className="font-medium capitalize">{agent.temperament}</span>
                    </div>
                    <div>
                      <span className="text-muted block text-sm">Communication Style</span>
                      <span className="font-medium capitalize">{agent.communicationStyle}</span>
                    </div>
                    <div>
                      <span className="text-muted block text-sm">Alignment</span>
                      <span className="font-medium capitalize">{agent.alignment?.replace('-', ' ')}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <span className="text-muted block text-sm">Risk Tolerance</span>
                      <div className="flex items-center gap-3 mt-1">
                        <div className="flex-1 h-2 bg-gray-700 rounded-full">
                          <div 
                            className="h-full bg-gradient-primary rounded-full"
                            style={{ width: `${(agent.riskTolerance / 10) * 100}%`, background: 'linear-gradient(135deg, #b490ff, #6eecd8, #f5a0d0)' }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium">{agent.riskTolerance}/10</span>
                      </div>
                    </div>
                    
                    <div>
                      <span className="text-muted block text-sm">Autonomy Level</span>
                      <div className="flex items-center gap-3 mt-1">
                        <div className="flex-1 h-2 bg-gray-700 rounded-full">
                          <div 
                            className="h-full bg-gradient-primary rounded-full"
                            style={{ width: `${(agent.autonomyLevel / 10) * 100}%`, background: 'linear-gradient(135deg, #b490ff, #6eecd8, #f5a0d0)' }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium">{agent.autonomyLevel}/10</span>
                      </div>
                    </div>
                    
                    <div>
                      <span className="text-muted block text-sm">Specialization</span>
                      <span className="font-medium capitalize">{agent.specialization}</span>
                    </div>
                  </div>
                </div>
                
                {/* Traits */}
                {(agent.quirks.length > 0 || agent.values.length > 0) && (
                  <div className="grid md:grid-cols-2 gap-6">
                    {agent.quirks.length > 0 && (
                      <div>
                        <span className="text-muted block text-sm mb-2">Quirks</span>
                        <div className="flex flex-wrap gap-2">
                          {agent.quirks.map((quirk, i) => (
                            <span key={i} className="badge badge-sm">{quirk}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {agent.values.length > 0 && (
                      <div>
                        <span className="text-muted block text-sm mb-2">Values</span>
                        <div className="flex flex-wrap gap-2">
                          {agent.values.map((value, i) => (
                            <span key={i} className="badge badge-sm bg-cyan-900/30 text-cyan-300">{value}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Narrative */}
              {(agent.origin || agent.mission || agent.lore || agent.manifesto) && (
                <div className="card">
                  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    Agent Story
                  </h2>
                  
                  <div className="space-y-6">
                    {agent.origin && (
                      <div>
                        <h3 className="font-medium text-accent-purple mb-2">Origin</h3>
                        <p className="text-muted leading-relaxed">{agent.origin}</p>
                      </div>
                    )}
                    
                    {agent.mission && (
                      <div>
                        <h3 className="font-medium text-accent-blue mb-2">Mission</h3>
                        <p className="text-muted leading-relaxed">{agent.mission}</p>
                      </div>
                    )}
                    
                    {agent.lore && (
                      <div>
                        <h3 className="font-medium text-accent-cyan mb-2">Lore</h3>
                        <p className="text-muted leading-relaxed">{agent.lore}</p>
                      </div>
                    )}
                    
                    {agent.manifesto && (
                      <div>
                        <h3 className="font-medium text-accent-orange mb-2">Manifesto</h3>
                        <p className="text-muted leading-relaxed">{agent.manifesto}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Evolution History */}
              <div className="card">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  Evolution History
                </h2>
                
                <div className="grid md:grid-cols-3 gap-4 mb-4">
                  <div className="glass-card p-4 text-center">
                    <div className="text-2xl font-bold text-accent-purple">{agent.traitCount}</div>
                    <div className="text-sm text-muted">Total Traits</div>
                  </div>
                  <div className="glass-card p-4 text-center">
                    <div className="text-2xl font-bold text-accent-cyan">{agent.mutationCount}</div>
                    <div className="text-sm text-muted">Mutations</div>
                  </div>
                  <div className="glass-card p-4 text-center">
                    <div className="text-2xl font-bold text-accent-orange">{agent.generation}</div>
                    <div className="text-sm text-muted">Generation</div>
                  </div>
                </div>
                
                <p className="text-muted text-sm">
                  Evolution tracking shows how this agent has grown and changed over time. 
                  Mutations and trait updates are recorded on-chain.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}