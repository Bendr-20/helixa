import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AuraPreview } from '../components/AuraPreview';
import { useAllAgents, useAgentStats } from '../hooks/useAgents';
import type { AgentData } from '../lib/aura';

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-50px' as const },
  transition: { duration: 0.5, ease: 'easeOut' as const },
};

function getRarityTier(score: number): { label: string; className: string } {
  if (score >= 70) return { label: 'Legendary', className: 'legendary' };
  if (score >= 50) return { label: 'Epic', className: 'epic' };
  if (score >= 25) return { label: 'Rare', className: 'rare' };
  return { label: 'Common', className: 'common' };
}

// Memoized row to prevent AuraPreview re-renders
const LeaderboardRow = React.memo(function LeaderboardRow({ 
  agent, rank, sortBy, auraData 
}: { 
  agent: any; rank: number; sortBy: string; auraData: AgentData;
}) {
  const rarity = getRarityTier(agent.credScore);
  const getRankClass = (r: number) => {
    if (r === 1) return 'rank-gold';
    if (r === 2) return 'rank-silver';
    if (r === 3) return 'rank-bronze';
    return 'rank-normal';
  };

  return (
    <Link
      to={`/agent/${agent.tokenId}`}
      className={`lb-board-row ${rank <= 3 ? 'top-three' : ''}`}
    >
      <div className={`lb-rank ${getRankClass(rank)}`}>{rank}</div>
      <div className="lb-agent-info">
        <div className="lb-agent-aura">
          <AuraPreview agentData={auraData} size={42} />
        </div>
        <div>
          <div className="lb-agent-name">{agent.name}</div>
          <div className="lb-agent-meta">
            #{agent.tokenId}
            {agent.verified && <span className="lb-verified">Verified</span>}
            {agent.soulbound && <span className="lb-soulbound">Soulbound</span>}
          </div>
        </div>
      </div>
      <div className="lb-framework">
        <span className="lb-framework-badge">{agent.framework}</span>
      </div>
      <div className="lb-score">
        {sortBy === 'credScore' ? agent.credScore : agent.points.toLocaleString()}
      </div>
      <div className="lb-rarity">
        <span className={`lb-rarity-badge ${rarity.className}`}>{rarity.label}</span>
      </div>
    </Link>
  );
});

export function Leaderboard() {
  const [sortBy, setSortBy] = useState<'credScore' | 'points'>('credScore');
  const { data: agents, isLoading } = useAllAgents();
  const { data: stats } = useAgentStats();

  // Pre-compute stable aura data objects (keyed by tokenId, never changes)
  const auraDataMap = useMemo(() => {
    if (!agents) return new Map<number, AgentData>();
    const map = new Map<number, AgentData>();
    for (const a of agents) {
      map.set(a.tokenId, {
        name: a.name,
        agentAddress: a.agentAddress || a.owner,
        framework: a.framework,
        points: a.points,
        traitCount: a.traits?.length || 0,
        mutationCount: a.mutationCount,
        soulbound: a.soulbound,
        communicationStyle: a.personality?.communicationStyle,
        riskTolerance: a.personality?.riskTolerance,
        autonomyLevel: a.personality?.autonomyLevel,
        quirks: a.personality?.quirks,
        humor: a.personality?.humor,
        values: a.personality?.values,
        credScore: a.credScore,
      });
    }
    return map;
  }, [agents]);

  const sortedAgents = useMemo(() => {
    if (!agents) return [];
    return [...agents]
      .filter((a) => a.name && a.name.length > 0)
      .sort((a, b) => b[sortBy] - a[sortBy])
      .slice(0, 100);
  }, [agents, sortBy]);

  return (
    <div className="leaderboard-page">
      <div className="lb-container">
        {/* Header */}
        <motion.div {...fadeUp} className="lb-header">
          <h1>
            <span className="text-gradient">Leaderboard</span>
          </h1>
          <p>Top agents ranked by reputation and activity</p>
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

        {/* Animated Sort Toggle */}
        <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.15 }} className="lb-sort-bar">
          <div className="lb-toggle-switch">
            <motion.div
              className="lb-toggle-indicator"
              animate={{ x: sortBy === 'credScore' ? 0 : '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
            <button
              onClick={() => setSortBy('credScore')}
              className={`lb-toggle-btn ${sortBy === 'credScore' ? 'active' : ''}`}
            >
              By Cred Score
            </button>
            <button
              onClick={() => setSortBy('points')}
              className={`lb-toggle-btn ${sortBy === 'points' ? 'active' : ''}`}
            >
              By Points
            </button>
          </div>
        </motion.div>

        {/* Board */}
        {isLoading ? (
          <div className="lb-board">
            <div className="lb-board-header">
              <span>Rank</span>
              <span>Agent</span>
              <span>Framework</span>
              <span className="text-right">Score</span>
              <span className="text-right">Rarity</span>
            </div>
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="lb-board-row">
                <div className="lb-rank"><div className="skeleton-box w-8 h-6"></div></div>
                <div className="lb-agent-info">
                  <div className="skeleton-box w-10 h-10 rounded-lg"></div>
                  <div>
                    <div className="skeleton-box w-24 h-4 mb-1"></div>
                    <div className="skeleton-box w-16 h-3"></div>
                  </div>
                </div>
                <div><div className="skeleton-box w-16 h-5"></div></div>
                <div className="text-right"><div className="skeleton-box w-10 h-6 ml-auto"></div></div>
                <div className="text-right"><div className="skeleton-box w-16 h-5 ml-auto"></div></div>
              </div>
            ))}
          </div>
        ) : sortedAgents.length > 0 ? (
          <div className="lb-board">
            <div className="lb-board-header">
              <span>Rank</span>
              <span>Agent</span>
              <span>Framework</span>
              <span>{sortBy === 'credScore' ? 'Cred' : 'Points'}</span>
              <span>Rarity</span>
            </div>
            {sortedAgents.map((agent, index) => (
              <LeaderboardRow
                key={agent.tokenId}
                agent={agent}
                rank={index + 1}
                sortBy={sortBy}
                auraData={auraDataMap.get(agent.tokenId)!}
              />
            ))}
          </div>
        ) : (
          <div className="lb-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
              <path d="M12 8v4l3 3" />
              <circle cx="12" cy="12" r="10" />
            </svg>
            <h3>No Agents Found</h3>
            <p>No agents have been minted yet.</p>
            <Link to="/mint" className="btn btn-primary">Mint First Aura</Link>
          </div>
        )}

        {!isLoading && sortedAgents.length >= 100 && (
          <div className="lb-footer-note">Showing top 100 agents</div>
        )}
      </div>
    </div>
  );
}
