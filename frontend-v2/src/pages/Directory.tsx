import React, { useState } from 'react';
import { AgentCard, AgentCardSkeleton } from '../components/AgentCard';
import { useFilteredAgents } from '../hooks/useAgents';
import { AGENT_FRAMEWORKS } from '../lib/constants';

export function Directory() {
  const [search, setSearch] = useState('');
  const [framework, setFramework] = useState('');
  const [soulbound, setSoulbound] = useState<boolean | undefined>(undefined);
  const [sortBy, setSortBy] = useState<'credScore' | 'points' | 'name' | 'recent'>('credScore');
  
  const { data: agents, isLoading, error } = useFilteredAgents({
    search: search.trim() || undefined,
    framework: framework || undefined,
    soulbound,
  });
  
  // Sort agents based on selected criteria
  const sortedAgents = React.useMemo(() => {
    if (!agents) return [];
    
    return [...agents].sort((a, b) => {
      switch (sortBy) {
        case 'credScore':
          return b.credScore - a.credScore;
        case 'points':
          return b.points - a.points;
        case 'name':
          return a.name.localeCompare(b.name);
        case 'recent':
          return parseInt(b.tokenId) - parseInt(a.tokenId); // Assuming higher ID = more recent
        default:
          return 0;
      }
    });
  }, [agents, sortBy]);
  
  const clearFilters = () => {
    setSearch('');
    setFramework('');
    setSoulbound(undefined);
  };
  
  return (
    <div className="py-8 fade-in">
      <div className="container">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-heading font-bold mb-4">
            Agent <span className="text-gradient">Directory</span>
          </h1>
          <p className="text-lg text-muted">
            Discover and explore AI agents across the ecosystem
          </p>
        </div>
        
        {/* Search and Filters */}
        <div className="card mb-8">
          <div className="grid md:grid-cols-4 lg:grid-cols-6 gap-4 items-end">
            {/* Search */}
            <div className="md:col-span-2 lg:col-span-2">
              <label htmlFor="search" className="label">Search</label>
              <input
                id="search"
                type="text"
                placeholder="Search agents by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input w-full"
              />
            </div>
            
            {/* Framework Filter */}
            <div>
              <label htmlFor="framework" className="label">Framework</label>
              <select
                id="framework"
                value={framework}
                onChange={(e) => setFramework(e.target.value)}
                className="select w-full"
              >
                <option value="">All Frameworks</option>
                {AGENT_FRAMEWORKS.map((fw) => (
                  <option key={fw} value={fw}>
                    {fw.charAt(0).toUpperCase() + fw.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Soulbound Filter */}
            <div>
              <label htmlFor="soulbound" className="label">Type</label>
              <select
                id="soulbound"
                value={soulbound === undefined ? '' : soulbound.toString()}
                onChange={(e) => {
                  const value = e.target.value;
                  setSoulbound(value === '' ? undefined : value === 'true');
                }}
                className="select w-full"
              >
                <option value="">All Types</option>
                <option value="true">Soulbound</option>
                <option value="false">Transferable</option>
              </select>
            </div>
            
            {/* Sort */}
            <div>
              <label htmlFor="sort" className="label">Sort by</label>
              <select
                id="sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="select w-full"
              >
                <option value="credScore">Cred Score</option>
                <option value="points">Points</option>
                <option value="name">Name</option>
                <option value="recent">Recently Added</option>
              </select>
            </div>
            
            {/* Clear Filters */}
            <div>
              <button
                onClick={clearFilters}
                className="btn btn-ghost w-full"
                disabled={!search && !framework && soulbound === undefined}
              >
                Clear Filters
              </button>
            </div>
          </div>
          
          {/* Active Filters */}
          {(search || framework || soulbound !== undefined) && (
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-700">
              <span className="text-sm text-muted">Active filters:</span>
              {search && (
                <span className="badge flex items-center gap-2">
                  Search: "{search}"
                  <button
                    onClick={() => setSearch('')}
                    className="text-red-400 hover:text-red-300"
                  >
                    ×
                  </button>
                </span>
              )}
              {framework && (
                <span className="badge flex items-center gap-2">
                  Framework: {framework}
                  <button
                    onClick={() => setFramework('')}
                    className="text-red-400 hover:text-red-300"
                  >
                    ×
                  </button>
                </span>
              )}
              {soulbound !== undefined && (
                <span className="badge flex items-center gap-2">
                  Type: {soulbound ? 'Soulbound' : 'Transferable'}
                  <button
                    onClick={() => setSoulbound(undefined)}
                    className="text-red-400 hover:text-red-300"
                  >
                    ×
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
        
        {/* Results Count */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-muted">
            {isLoading ? (
              'Loading agents...'
            ) : error ? (
              'Error loading agents'
            ) : (
              `${sortedAgents.length} agent${sortedAgents.length !== 1 ? 's' : ''} found`
            )}
          </p>
          
          {!isLoading && sortedAgents.length > 0 && (
            <p className="text-sm text-muted">
              Sorted by {sortBy === 'credScore' ? 'Cred Score' : sortBy === 'points' ? 'Points' : sortBy === 'name' ? 'Name' : 'Recently Added'}
            </p>
          )}
        </div>
        
        {/* Error State */}
        {error && (
          <div className="card bg-red-900/20 border-red-700 text-center py-12">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-red-400 mb-2">Failed to Load Agents</h3>
            <p className="text-red-300 mb-4">There was an error loading the agent directory.</p>
            <button
              onClick={() => window.location.reload()}
              className="btn btn-secondary"
            >
              Try Again
            </button>
          </div>
        )}
        
        {/* Empty State */}
        {!isLoading && !error && sortedAgents.length === 0 && (
          <div className="card text-center py-16">
            <div className="w-16 h-16 bg-gray-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-400 mb-2">No Agents Found</h3>
            <p className="text-gray-500 mb-6">
              {search || framework || soulbound !== undefined
                ? 'Try adjusting your search filters to find more agents.'
                : 'No agents have been minted yet. Be the first!'}
            </p>
            {(search || framework || soulbound !== undefined) ? (
              <button onClick={clearFilters} className="btn btn-secondary">
                Clear Filters
              </button>
            ) : (
              <a href="/mint" className="btn btn-primary">
                Mint First Agent
              </a>
            )}
          </div>
        )}
        
        {/* Agent Grid */}
        {isLoading ? (
          <div className="agents-grid">
            {Array.from({ length: 12 }).map((_, i) => (
              <AgentCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="agents-grid">
            {sortedAgents.map((agent) => (
              <AgentCard key={agent.tokenId} agent={agent} />
            ))}
          </div>
        )}
        
        {/* Load More (if pagination needed) */}
        {!isLoading && sortedAgents.length >= 50 && (
          <div className="text-center mt-12">
            <button className="btn btn-secondary">
              Load More Agents
            </button>
            <p className="text-sm text-muted mt-2">
              Showing first 50 results
            </p>
          </div>
        )}
      </div>
    </div>
  );
}