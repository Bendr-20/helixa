import React from 'react';
import { Link } from 'react-router-dom';
import { AgentCard, AgentCardSkeleton } from '../components/AgentCard';
import { useTopAgents, useAgentStats } from '../hooks/useAgents';

export function Home() {
  const { data: topAgents, isLoading: agentsLoading } = useTopAgents(6);
  const { data: stats, isLoading: statsLoading } = useAgentStats();
  
  return (
    <div className="fade-in">
      {/* Hero Section */}
      <section className="py-20 text-center">
        <div className="container">
          <h1 className="text-4xl md:text-6xl font-heading font-bold mb-6">
            Every Agent Deserves a{' '}
            <span className="text-gradient">Face</span>,{' '}
            <span className="text-gradient">Score</span>,{' '}
            and{' '}
            <span className="text-gradient">Story</span>
          </h1>
          
          <p className="text-xl text-muted max-w-3xl mx-auto mb-8">
            Mint unique visual identities for your AI agents. Build reputation, 
            track evolution, and showcase achievements in the first comprehensive 
            agent identity platform.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/mint" className="btn btn-primary btn-lg glow">
              <span>🚀</span>
              Mint Your Agent
            </Link>
            
            <Link to="/agents" className="btn btn-secondary btn-lg">
              <span>🌐</span>
              Explore Directory
            </Link>
          </div>
        </div>
      </section>
      
      {/* Stats Section */}
      <section className="py-16 bg-surface/30">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-gradient mb-2">
                {statsLoading ? (
                  <div className="skeleton h-10 w-16 mx-auto"></div>
                ) : (
                  stats?.totalAgents?.toLocaleString() || '0'
                )}
              </div>
              <p className="text-muted">Total Agents</p>
            </div>
            
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-gradient mb-2">
                {statsLoading ? (
                  <div className="skeleton h-10 w-20 mx-auto"></div>
                ) : (
                  stats?.totalCredScore?.toLocaleString() || '0'
                )}
              </div>
              <p className="text-muted">Total Cred Score</p>
            </div>
            
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-gradient mb-2">
                {statsLoading ? (
                  <div className="skeleton h-10 w-16 mx-auto"></div>
                ) : (
                  stats?.frameworks || '0'
                )}
              </div>
              <p className="text-muted">Frameworks</p>
            </div>
            
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-gradient mb-2">
                {statsLoading ? (
                  <div className="skeleton h-10 w-16 mx-auto"></div>
                ) : (
                  stats?.soulboundCount || '0'
                )}
              </div>
              <p className="text-muted">Soulbound</p>
            </div>
          </div>
        </div>
      </section>
      
      {/* Featured Agents */}
      <section className="py-20">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-heading font-semibold mb-4">
              Top Agents by <span className="text-gradient">Cred Score</span>
            </h2>
            <p className="text-lg text-muted">
              Discover the highest-rated agents in the ecosystem
            </p>
          </div>
          
          <div className="agents-grid">
            {agentsLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <AgentCardSkeleton key={i} />
                ))
              : topAgents?.map((agent) => (
                  <AgentCard key={agent.tokenId} agent={agent} />
                ))
            }
          </div>
          
          {!agentsLoading && topAgents && topAgents.length > 0 && (
            <div className="text-center mt-12">
              <Link to="/leaderboard" className="btn btn-secondary btn-lg">
                View Full Leaderboard
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          )}
        </div>
      </section>
      
      {/* Features Section */}
      <section className="py-20 bg-surface/30">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-heading font-semibold mb-4">
              Why <span className="text-gradient">Helixa V2</span>?
            </h2>
            <p className="text-lg text-muted max-w-2xl mx-auto">
              The first comprehensive identity and reputation system built specifically for AI agents
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Visual Identity */}
            <div className="glass-card p-8 text-center hover:scale-105 transition-transform">
              <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl">🎨</span>
              </div>
              <h3 className="text-xl font-semibold mb-4">Unique Visual Identity</h3>
              <p className="text-muted">
                Every agent gets a distinctive QR-aesthetic "Aura" that reflects its personality, 
                traits, and achievements in a beautiful visual form.
              </p>
            </div>
            
            {/* Reputation System */}
            <div className="glass-card p-8 text-center hover:scale-105 transition-transform">
              <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl">⭐</span>
              </div>
              <h3 className="text-xl font-semibold mb-4">Cred Score System</h3>
              <p className="text-muted">
                Dynamic reputation scoring based on activity, contributions, community trust, 
                and verification status. Build credibility over time.
              </p>
            </div>
            
            {/* Rich Narratives */}
            <div className="glass-card p-8 text-center hover:scale-105 transition-transform">
              <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl">📖</span>
              </div>
              <h3 className="text-xl font-semibold mb-4">Rich Storytelling</h3>
              <p className="text-muted">
                Document your agent's origin, mission, lore, and manifesto. 
                Create compelling narratives that showcase personality and purpose.
              </p>
            </div>
            
            {/* Evolution Tracking */}
            <div className="glass-card p-8 text-center hover:scale-105 transition-transform">
              <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl">📈</span>
              </div>
              <h3 className="text-xl font-semibold mb-4">Evolution Tracking</h3>
              <p className="text-muted">
                Track mutations, upgrades, and changes over time. Watch your agent 
                evolve and improve with detailed history and analytics.
              </p>
            </div>
            
            {/* Framework Agnostic */}
            <div className="glass-card p-8 text-center hover:scale-105 transition-transform">
              <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl">🔧</span>
              </div>
              <h3 className="text-xl font-semibold mb-4">Framework Agnostic</h3>
              <p className="text-muted">
                Works with any AI framework - Eliza, AutoGen, CrewAI, LangChain, 
                custom solutions, and more. Universal compatibility.
              </p>
            </div>
            
            {/* On-Chain Permanence */}
            <div className="glass-card p-8 text-center hover:scale-105 transition-transform">
              <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl">⛓️</span>
              </div>
              <h3 className="text-xl font-semibold mb-4">On-Chain Permanence</h3>
              <p className="text-muted">
                All agent data stored permanently on Base blockchain. 
                Immutable identity with optional soulbound tokens for personal agents.
              </p>
            </div>
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="py-20">
        <div className="container">
          <div className="card max-w-4xl mx-auto text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-primary opacity-10 blur-3xl"></div>
            <div className="relative py-12">
              <h2 className="text-3xl font-heading font-semibold mb-4">
                Ready to Give Your Agent an Identity?
              </h2>
              <p className="text-lg text-muted mb-8 max-w-2xl mx-auto">
                Join the growing ecosystem of identified agents. Mint your unique visual identity, 
                build reputation, and showcase your agent's capabilities to the world.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/mint" className="btn btn-primary btn-lg glow">
                  <span>🚀</span>
                  Start Minting
                </Link>
                
                <Link to="/agents" className="btn btn-ghost btn-lg">
                  <span>🔍</span>
                  Browse Agents
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}