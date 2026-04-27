import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AgentCard, AgentCardSkeleton } from '../components/AgentCard';
import { CredBadge } from '../components/CredBadge';
import { DirectoryPrincipal, useAgentStats, useHelixaDirectory } from '../hooks/useAgents';

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-50px' as const },
  transition: { duration: 0.5, ease: 'easeOut' as const },
};

type EntityFilter = 'all' | 'agent' | 'human' | 'organization';
type SortFilter = 'credScore' | 'name' | 'recent';

function PrincipalCard({ principal }: { principal: DirectoryPrincipal }) {
  if (principal.entityType === 'agent') {
    return <AgentCard agent={principal.raw as any} />;
  }

  const chips = [
    principal.entityType === 'human' ? 'Human' : 'Organization',
    principal.badgeLabel,
    principal.verified ? 'Verified' : null,
  ].filter(Boolean);

  const secondaryItems = [
    ...(principal.skills || []).slice(0, 2),
    ...(principal.serviceCategories || []).slice(0, 2),
  ].filter(Boolean);

  return (
    <Link
      to={principal.publicPath}
      className="agent-card"
      style={{
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
        background: 'rgba(10,10,20,0.9)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '14px',
        padding: '1.25rem',
        transition: 'border-color 0.3s, transform 0.3s, box-shadow 0.3s',
        minHeight: '100%',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '0.9rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
            {chips.map((chip) => (
              <span key={chip} className="badge badge-sm">{chip}</span>
            ))}
          </div>
          <h3 style={{ fontWeight: 600, fontSize: '1.05rem', margin: '0 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {principal.name}
          </h3>
          {principal.humanOrganization && (
            <div style={{ color: '#9aa0b5', fontSize: '0.85rem' }}>{principal.humanOrganization}</div>
          )}
        </div>
        {principal.entityType === 'human' ? (
          <CredBadge score={principal.credScore || 0} size="sm" />
        ) : (
          <span className="badge badge-sm" style={{ background: 'rgba(180,144,255,0.2)', color: '#d7c7ff' }}>Org</span>
        )}
      </div>

      <p style={{ color: '#a8aec7', fontSize: '0.92rem', lineHeight: 1.55, minHeight: '4.3em', marginBottom: '0.9rem' }}>
        {principal.description || (principal.entityType === 'human' ? 'Human principal profile' : 'Organization profile')}
      </p>

      {secondaryItems.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
          {secondaryItems.map((item) => (
            <span key={item} className="badge badge-sm" style={{ background: 'rgba(110,236,216,0.12)', color: '#9cf4e6' }}>{item}</span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', paddingTop: '0.85rem', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '0.8rem', color: '#8e94ab' }}>
        <span>{principal.verified ? 'Wallet linked' : 'Offchain profile'}</span>
        <span>Open profile →</span>
      </div>
    </Link>
  );
}

export function Directory() {
  const [search, setSearch] = useState('');
  const [entityType, setEntityType] = useState<EntityFilter>('all');
  const [sortBy, setSortBy] = useState<SortFilter>('credScore');
  const { data: stats } = useAgentStats();
  const { data: principals, isLoading, error } = useHelixaDirectory();

  const filteredPrincipals = useMemo(() => {
    const query = search.trim().toLowerCase();

    return [...(principals || [])]
      .filter((principal) => {
        if (entityType !== 'all' && principal.entityType !== entityType) return false;
        if (!query) return true;

        const haystack = [
          principal.name,
          principal.description,
          principal.framework,
          principal.humanOrganization,
          principal.badgeLabel,
          ...(principal.skills || []),
          ...(principal.serviceCategories || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return haystack.includes(query);
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'name':
            return a.name.localeCompare(b.name);
          case 'recent':
            return (b.sortKey || 0) - (a.sortKey || 0);
          case 'credScore':
          default:
            return (b.credScore || 0) - (a.credScore || 0);
        }
      });
  }, [principals, entityType, search, sortBy]);

  const clearFilters = () => {
    setSearch('');
    setEntityType('all');
    setSortBy('credScore');
  };

  const hasFilters = Boolean(search.trim()) || entityType !== 'all' || sortBy !== 'credScore';

  return (
    <div className="dir-page">
      <div className="dir-container">
        <motion.div {...fadeUp} className="dir-header">
          <h1>
            Helixa <span className="text-gradient">Directory</span>
          </h1>
          <p>Browse agents, humans, and organizations across the Helixa network</p>
        </motion.div>

        <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.1 }} className="lb-stats-row">
          <div className="lb-mini-stat">
            <div className="val purple">{stats?.totalPrincipals ?? '—'}</div>
            <div className="lbl">Total Profiles</div>
          </div>
          <div className="lb-mini-stat">
            <div className="val gold">{stats?.totalAgents ?? '—'}</div>
            <div className="lbl">Agents</div>
          </div>
          <div className="lb-mini-stat">
            <div className="val blue">{stats?.totalHumans ?? '—'}</div>
            <div className="lbl">Humans</div>
          </div>
          <div className="lb-mini-stat">
            <div className="val green">{stats?.totalOrganizations ?? '—'}</div>
            <div className="lbl">Organizations</div>
          </div>
        </motion.div>

        <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.15 }} className="dir-filters">
          <div className="dir-filters-grid">
            <div className="dir-filter-group dir-filter-search">
              <label>Search</label>
              <input
                type="text"
                placeholder="Search names, skills, orgs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="dir-filter-group">
              <label>Profile Type</label>
              <select value={entityType} onChange={(e) => setEntityType(e.target.value as EntityFilter)}>
                <option value="all">All</option>
                <option value="agent">Agents</option>
                <option value="human">Humans</option>
                <option value="organization">Organizations</option>
              </select>
            </div>
            <div className="dir-filter-group">
              <label>Sort</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortFilter)}>
                <option value="credScore">Cred Score</option>
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
              {search.trim() && (
                <span className="dir-filter-tag">
                  "{search.trim()}" <button onClick={() => setSearch('')}>×</button>
                </span>
              )}
              {entityType !== 'all' && (
                <span className="dir-filter-tag">
                  {entityType} <button onClick={() => setEntityType('all')}>×</button>
                </span>
              )}
              {sortBy !== 'credScore' && (
                <span className="dir-filter-tag">
                  {sortBy} <button onClick={() => setSortBy('credScore')}>×</button>
                </span>
              )}
            </div>
          )}
        </motion.div>

        <div className="dir-results-bar">
          <span>
            {isLoading ? 'Loading...' : error ? 'Error loading directory' : `${filteredPrincipals.length} profiles`}
          </span>
        </div>

        {error && (
          <div className="lb-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h3>Failed to Load</h3>
            <p>There was an error loading the Helixa Directory.</p>
            <button onClick={() => window.location.reload()} className="btn btn-primary">Try Again</button>
          </div>
        )}

        {!isLoading && !error && filteredPrincipals.length === 0 && (
          <div className="lb-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <h3>No Profiles Found</h3>
            <p>{hasFilters ? 'Try adjusting your search or filters.' : 'No profiles registered yet.'}</p>
            {hasFilters ? (
              <button onClick={clearFilters} className="btn btn-primary">Clear Filters</button>
            ) : (
              <a href="/mint" className="btn btn-primary">Register First Profile</a>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="dir-grid">
            {Array.from({ length: 12 }).map((_, i) => (
              <AgentCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="dir-grid">
            {filteredPrincipals.map((principal, i) => (
              <motion.div
                key={`${principal.entityType}-${principal.id}`}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: Math.min(i * 0.05, 0.4) }}
              >
                <PrincipalCard principal={principal} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
