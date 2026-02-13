import React from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { AgentCard, AgentCardSkeleton } from '../components/AgentCard';
import { useAgentsByOwner } from '../hooks/useAgents';

export function Manage() {
  const { address, isConnected } = useAccount();
  const { data: userAgents, isLoading } = useAgentsByOwner(address);
  
  if (!isConnected) {
    return (
      <div className="py-8">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center">
            <div className="card py-16">
              <div className="w-16 h-16 bg-accent-purple/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-accent-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              
              <h2 className="text-2xl font-heading font-semibold mb-4">
                Connect to Manage Your Agents
              </h2>
              <p className="text-muted mb-8">
                Connect your wallet to view and manage the agents you own.
              </p>
              
              <ConnectButton />
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="py-8 fade-in">
      <div className="container">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-heading font-bold mb-2">
                Manage Your <span className="text-gradient">Agents</span>
              </h1>
              <p className="text-muted">
                View and update the agents you own
              </p>
            </div>
            
            <Link to="/mint" className="btn btn-primary">
              <span>➕</span>
              Mint New Agent
            </Link>
          </div>
          
          {/* Connected Wallet Info */}
          <div className="card mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold mb-1">Connected Wallet</h3>
                <code className="text-sm text-muted">{address}</code>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-accent-purple">
                  {isLoading ? '...' : userAgents?.length || 0}
                </div>
                <div className="text-sm text-muted">Agents Owned</div>
              </div>
            </div>
          </div>
          
          {/* User's Agents */}
          {isLoading ? (
            <div>
              <h2 className="text-xl font-semibold mb-6">Your Agents</h2>
              <div className="agents-grid">
                {Array.from({ length: 6 }).map((_, i) => (
                  <AgentCardSkeleton key={i} />
                ))}
              </div>
            </div>
          ) : userAgents && userAgents.length > 0 ? (
            <div>
              <h2 className="text-xl font-semibold mb-6">
                Your Agents ({userAgents.length})
              </h2>
              <div className="agents-grid">
                {userAgents.map((agent) => (
                  <div key={agent.tokenId} className="relative">
                    <AgentCard agent={agent} />
                    {/* Management overlay */}
                    <div className="absolute top-2 right-2">
                      <div className="flex gap-1">
                        <Link 
                          to={`/agent/${agent.tokenId}`}
                          className="w-8 h-8 bg-gray-800/80 rounded-full flex items-center justify-center text-xs hover:bg-gray-700/80 transition-colors"
                          title="View Profile"
                        >
                          👁️
                        </Link>
                        <button
                          className="w-8 h-8 bg-gray-800/80 rounded-full flex items-center justify-center text-xs hover:bg-gray-700/80 transition-colors"
                          title="Edit Agent"
                        >
                          ✏️
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="card text-center py-16">
              <div className="w-16 h-16 bg-gray-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-400 mb-2">No Agents Found</h3>
              <p className="text-gray-500 mb-6">
                You don't own any agents yet. Mint your first agent to get started!
              </p>
              <Link to="/mint" className="btn btn-primary">
                <span>🚀</span>
                Mint Your First Agent
              </Link>
            </div>
          )}
          
          {/* Management Guide */}
          <div className="mt-16">
            <h2 className="text-xl font-semibold mb-6">Management Guide</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="glass-card p-6">
                <div className="w-12 h-12 bg-accent-purple/20 rounded-full flex items-center justify-center mb-4">
                  <span className="text-2xl">✏️</span>
                </div>
                <h3 className="font-semibold mb-2">Update Traits</h3>
                <p className="text-sm text-muted">
                  Modify your agent's personality traits, values, and behavioral parameters as they evolve.
                </p>
              </div>
              
              <div className="glass-card p-6">
                <div className="w-12 h-12 bg-accent-cyan/20 rounded-full flex items-center justify-center mb-4">
                  <span className="text-2xl">📖</span>
                </div>
                <h3 className="font-semibold mb-2">Edit Story</h3>
                <p className="text-sm text-muted">
                  Update your agent's origin, mission, lore, and manifesto to reflect growth and new achievements.
                </p>
              </div>
              
              <div className="glass-card p-6">
                <div className="w-12 h-12 bg-accent-orange/20 rounded-full flex items-center justify-center mb-4">
                  <span className="text-2xl">📊</span>
                </div>
                <h3 className="font-semibold mb-2">Track Evolution</h3>
                <p className="text-sm text-muted">
                  Monitor your agent's reputation growth, trait mutations, and activity history over time.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}