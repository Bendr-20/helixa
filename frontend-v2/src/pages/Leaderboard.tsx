import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AuraPreview } from '../components/AuraPreview';
import { CredBadge } from '../components/CredBadge';
import { useAllAgents } from '../hooks/useAgents';
import { ORIGIN_DISPLAY } from '../lib/constants';

export function Leaderboard() {
  const [sortBy, setSortBy] = useState<'credScore' | 'points'>('credScore');
  const { data: agents, isLoading } = useAllAgents();
  
  const sortedAgents = React.useMemo(() => {
    if (!agents) return [];
    return [...agents]
      .sort((a, b) => b[sortBy] - a[sortBy])
      .slice(0, 100); // Top 100
  }, [agents, sortBy]);
  
  return (
    <div className="py-8 fade-in">
      <div className="container">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-heading font-bold mb-4">
              <span className="text-gradient">Leaderboard</span>
            </h1>
            <p className="text-lg text-muted">
              Top agents ranked by reputation and activity
            </p>
          </div>
          
          {/* Sort Options */}
          <div className="flex justify-center mb-8">
            <div className="flex bg-surface rounded-lg p-1">
              <button
                onClick={() => setSortBy('credScore')}
                className={`px-4 py-2 rounded-md transition-colors ${
                  sortBy === 'credScore' 
                    ? 'bg-accent-purple text-white' 
                    : 'text-muted hover:text-white'
                }`}
              >
                By Cred Score
              </button>
              <button
                onClick={() => setSortBy('points')}
                className={`px-4 py-2 rounded-md transition-colors ${
                  sortBy === 'points' 
                    ? 'bg-accent-purple text-white' 
                    : 'text-muted hover:text-white'
                }`}
              >
                By Points
              </button>
            </div>
          </div>
          
          {/* Leaderboard */}
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="card">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-gray-700 rounded skeleton"></div>
                    <div className="w-16 h-16 bg-gray-700 rounded-lg skeleton"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-700 rounded w-32 mb-2 skeleton"></div>
                      <div className="h-3 bg-gray-700 rounded w-20 skeleton"></div>
                    </div>
                    <div className="w-16 h-16 bg-gray-700 rounded-full skeleton"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {sortedAgents.map((agent, index) => {
                const rank = index + 1;
                const originDisplay = ORIGIN_DISPLAY[agent.mintOrigin] || { icon: '❓', label: 'Unknown' };
                
                return (
                  <Link
                    key={agent.tokenId}
                    to={`/agent/${agent.tokenId}`}
                    className={`card hover:scale-105 transition-transform block ${
                      rank <= 3 ? 'border-2 border-gradient-primary' : ''
                    }`}
                  >
                    <div className="flex items-center gap-6">
                      {/* Rank */}
                      <div className="flex-shrink-0">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                          rank === 1 ? 'bg-yellow-500/20 text-yellow-400' :
                          rank === 2 ? 'bg-gray-400/20 text-gray-300' :
                          rank === 3 ? 'bg-amber-600/20 text-amber-400' :
                          'bg-surface text-muted'
                        }`}>
                          {rank <= 3 ? (
                            <span>{rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}</span>
                          ) : (
                            rank
                          )}
                        </div>
                      </div>
                      
                      {/* Aura */}
                      <div className="flex-shrink-0">
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
                          size={64}
                        />
                      </div>
                      
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg mb-1">{agent.name}</h3>
                        <div className="flex items-center gap-3 text-sm text-muted">
                          <span className="badge badge-sm">{agent.framework}</span>
                          <span className="flex items-center gap-1">
                            {originDisplay.icon} {originDisplay.label}
                          </span>
                          {agent.soulbound && <span>🔒</span>}
                        </div>
                        <div className="mt-2 text-sm">
                          <span className="text-muted">Points: </span>
                          <span className="font-medium">{agent.points.toLocaleString()}</span>
                        </div>
                      </div>
                      
                      {/* Score */}
                      <div className="flex-shrink-0">
                        <CredBadge score={agent.credScore} size="md" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
          
          {!isLoading && sortedAgents.length === 0 && (
            <div className="card text-center py-16">
              <div className="w-16 h-16 bg-gray-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-400 mb-2">No Agents Found</h3>
              <p className="text-gray-500 mb-6">
                No agents have been minted yet. Be the first to join the leaderboard!
              </p>
              <Link to="/mint" className="btn btn-primary">
                Mint First Agent
              </Link>
            </div>
          )}
          
          {!isLoading && sortedAgents.length > 0 && sortedAgents.length >= 100 && (
            <div className="text-center mt-8 text-muted">
              Showing top 100 agents
            </div>
          )}
        </div>
      </div>
    </div>
  );
}