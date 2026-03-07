import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { AgentCard, AgentCardSkeleton } from '../components/AgentCard';
import { useFilteredAgents, useAgentStats } from '../hooks/useAgents';
import { AGENT_FRAMEWORKS } from '../lib/constants';

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-50px' as const },
  transition: { duration: 0.5, ease: 'easeOut' as const },
};

export function Directory() {
  const [search, setSearch] = useState('');
  const [framework, setFramework] = useState('');
  const [soulbound, setSoulbound] = useState<boolean | undefined>(undefined);
  const [sortBy, setSortBy] = useState<'credScore' | 'points' | 'name' | 'recent'>('credScore');
  const { data: stats } = useAgentStats();

  const { data: agents, isLoading, error } = useFilteredAgents({
    search: search.trim() || undefined,
    framework: framework || undefined,
    soulbound,
  });

  const sortedAgents = React.useMemo(() => {
    if (!agents) return [];
    return [...agents]
      .filter((a) => a.name && a.name.length > 0)
      .sort((a, b) => {
        switch (sortBy) {
          case 'credScore': return b.credScore - a.credScore;
          case 'points': return b.points - a.points;
          case 'name': return a.name.localeCompare(b.name);
          case 'recent': return b.tokenId - a.tokenId;
          default: return 0;
        }
      });
  }, [agents, sortBy]);

  const clearFilters = () => {
    setSearch('');
    setFramework('');
    setSoulbound(undefined);
  };

  const hasFilters = search || framework || soulbound !== undefined;

  return (
    <div className="dir-page">
      <div className="dir-container">
        {/* Header */}
        <motion.div {...fadeUp} className="dir-header">
          <h1>
            Agent <span className="text-gradient">Directory</span>
          </h1>
          <p>Discover and explore AI agents across the ecosystem</p>
        </motion.div>

        {/* Stats Row */}
        <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.1 }} className="lb-stats-row">
          <div className="lb-mini-stat">
            <div className="val purple">{stats?.totalAgents ?? '—'}</div>
            <div className="lbl">Total Agents</div>
          </div>
          <div className="lb-mini-stat">
            <div className="val gold">{stats?.totalCredScore?.toLocaleString() ?? '—'}</div>
            <div className="lbl">Total Cred</div>
          </div>
          <div className="lb-mini-stat">
            <div className="val blue">{stats?.frameworks ?? '—'}</div>
            <div className="lbl">Frameworks</div>
          </div>
          <div className="lb-mini-stat">
            <div className="val green">{stats?.soulboundCount ?? '—'}</div>
            <div className="lbl">Soulbound</div>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.15 }} className="dir-filters">
          <div className="dir-filters-grid">
            <div className="dir-filter-group dir-filter-search">
              <label>Search</label>
              <input
                type="text"
                placeholder="Search by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="dir-filter-group">
              <label>Framework</label>
              <select value={framework} onChange={(e) => setFramework(e.target.value)}>
                <option value="">All</option>
                {AGENT_FRAMEWORKS.map((fw) => (
                  <option key={fw} value={fw}>{fw}</option>
                ))}
              </select>
            </div>
            <div className="dir-filter-group">
              <label>Type</label>
              <select
                value={soulbound === undefined ? '' : soulbound.toString()}
                onChange={(e) => setSoulbound(e.target.value === '' ? undefined : e.target.value === 'true')}
              >
                <option value="">All</option>
                <option value="true">Soulbound</option>
                <option value="false">Transferable</option>
              </select>
            </div>
            <div className="dir-filter-group">
              <label>Sort</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
                <option value="credScore">Cred Score</option>
                <option value="points">Points</option>
                <option value="name">Name</option>
                <option value="recent">Recent</option>
              </select>
            </div>
            {hasFilters && (
              <div className="dir-filter-group dir-filter-clear">
                <label>&nbsp;</label>
                <button onClick={clearFilters}>Clear</button>
              </div>
            )}
          </div>

          {hasFilters && (
            <div className="dir-active-filters">
              <span className="dir-filter-label">Active:</span>
              {search && (
                <span className="dir-filter-tag">
                  "{search}" <button onClick={() => setSearch('')}>×</button>
                </span>
              )}
              {framework && (
                <span className="dir-filter-tag">
                  {framework} <button onClick={() => setFramework('')}>×</button>
                </span>
              )}
              {soulbound !== undefined && (
                <span className="dir-filter-tag">
                  {soulbound ? 'Soulbound' : 'Transferable'} <button onClick={() => setSoulbound(undefined)}>×</button>
                </span>
              )}
            </div>
          )}
        </motion.div>

        {/* Results count */}
        <div className="dir-results-bar">
          <span>
            {isLoading ? 'Loading...' : error ? 'Error loading agents' : `${sortedAgents.length} agents`}
          </span>
        </div>

        {/* Error */}
        {error && (
          <div className="lb-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h3>Failed to Load</h3>
            <p>There was an error loading the agent directory.</p>
            <button onClick={() => window.location.reload()} className="btn btn-primary">Try Again</button>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !error && sortedAgents.length === 0 && (
          <div className="lb-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <h3>No Agents Found</h3>
            <p>{hasFilters ? 'Try adjusting your filters.' : 'No agents minted yet.'}</p>
            {hasFilters ? (
              <button onClick={clearFilters} className="btn btn-primary">Clear Filters</button>
            ) : (
              <a href="/mint" className="btn btn-primary">Mint First Aura</a>
            )}
          </div>
        )}

        {/* Grid */}
        {isLoading ? (
          <div className="dir-grid">
            {Array.from({ length: 12 }).map((_, i) => (
              <AgentCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="dir-grid">
            {sortedAgents.map((agent, i) => (
              <motion.div
                key={agent.tokenId}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: Math.min(i * 0.05, 0.4) }}
              >
                <AgentCard agent={agent} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
