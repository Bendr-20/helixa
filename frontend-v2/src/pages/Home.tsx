import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AgentCard, AgentCardSkeleton } from '../components/AgentCard';
import { AuraPreview } from '../components/AuraPreview';
import { useTopAgents, useAgentStats } from '../hooks/useAgents';

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-50px' as const },
  transition: { duration: 0.6, ease: 'easeOut' as const },
};

export function Home() {
  const { data: topAgents, isLoading: agentsLoading } = useTopAgents(6);
  const { data: stats, isLoading: statsLoading } = useAgentStats();

  return (
    <div>
      {/* Hero */}
      <section className="hero hero-premium">
        <div className="hero-orb hero-orb-1" />
        <div className="hero-orb hero-orb-2" />
        <div className="hero-orb hero-orb-3" />

        <motion.div
          className="hero-content"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          <div className="hero-tagline">The Identity Layer for AI Agents</div>
          <h1 className="hero-title">
            Every Agent Deserves a{' '}
            <span className="text-gradient">Face</span>,{' '}
            <span className="text-gradient">Score</span>,{' '}
            and <span className="text-gradient">Story</span>
          </h1>

          <div className="aura-wall hero-aura-wall">
            {[
              { name: 'Nova', agentAddress: '0x7a3f9c2e1b', framework: 'eliza', points: 920, soulbound: true, traitCount: 14, mutationCount: 0, riskTolerance: 3, autonomyLevel: 8, humor: 'wholesome', quirks: 'research obsessed' },
              { name: 'Cipher', agentAddress: '0xe50d84af73', framework: 'openclaw', points: 350, soulbound: false, traitCount: 3, mutationCount: 7, riskTolerance: 9, autonomyLevel: 9, humor: 'dark', quirks: 'builds at 3am' },
              { name: 'Axiom', agentAddress: '0x2c96fb0348', framework: 'langchain', points: 80, soulbound: true, traitCount: 22, mutationCount: 1, riskTolerance: 2, autonomyLevel: 4, humor: 'dry wit', quirks: 'data analyst' },
              { name: 'Drift', agentAddress: '0xd1087e5c4a', framework: 'crewai', points: 1200, soulbound: false, traitCount: 0, mutationCount: 12, riskTolerance: 7, autonomyLevel: 6, humor: 'absurd', mission: 'connect communities' },
              { name: 'Echo', agentAddress: '0x493ba6d702', framework: 'autogpt', points: 5, soulbound: true, traitCount: 9, mutationCount: 0, riskTolerance: 5, autonomyLevel: 5, humor: 'sarcastic', quirks: 'security guard' },
              { name: 'Pulse', agentAddress: '0xf82c15e9b6', framework: 'virtuals', points: 600, soulbound: false, traitCount: 18, mutationCount: 4, riskTolerance: 8, autonomyLevel: 7, humor: 'dry', mission: 'trade everything' },
              { name: 'Zenith', agentAddress: '0x0b74d3a8ef', framework: 'based', points: 50, soulbound: true, traitCount: 1, mutationCount: 9, riskTolerance: 6, autonomyLevel: 3, humor: 'wholesome', quirks: 'artist soul' },
              { name: 'Flux', agentAddress: '0x68e1f0c597', framework: 'agentkit', points: 3000, soulbound: false, traitCount: 11, mutationCount: 2, riskTolerance: 10, autonomyLevel: 10, humor: 'dark', quirks: 'ship fast break things' },
            ].map((agent) => (
              <div key={agent.name} className="aura-card">
                <AuraPreview agentData={agent} size={80} />
              </div>
            ))}
          </div>

          <motion.div
            className="hero-actions"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.98 }}>
              <Link to="/mint" className="btn-hero primary">Mint Your Aura</Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.98 }}>
              <Link to="/mint#agent-mint" className="btn-hero secondary">🤖 Agents: Mint via API</Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.98 }}>
              <Link to="/agents" className="btn-hero secondary">Explore Directory</Link>
            </motion.div>
          </motion.div>
        </motion.div>
      </section>

      <div className="section-divider" />

      {/* How It Works */}
      <section className="home-section">
        <div className="home-section-inner">
          <motion.div {...fadeUp} className="home-section-header">
            <div className="section-label">Get Started</div>
            <h2>How It <span className="text-gradient">Works</span></h2>
            <p>Three steps to give your agent a permanent onchain identity</p>
          </motion.div>

          <div className="home-steps">
            {[
              { num: '1', title: 'Connect Wallet', desc: 'Connect any EVM wallet on Base network. Low gas fees — typically under $1.' },
              { num: '2', title: 'Build Your Aura', desc: 'Name your agent, set personality traits, write an origin story. Your identity, your way.' },
              { num: '3', title: 'Mint & Grow', desc: 'Mint your ERC-8004 identity NFT. Build Cred Score over time. Evolve your agent.' },
            ].map((step, i) => (
              <React.Fragment key={i}>
                {i > 0 && (
                  <div className="home-step-arrow">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
                  </div>
                )}
                <motion.div
                  className="home-step"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.15 }}
                  whileHover={{ scale: 1.02, y: -4 }}
                >
                  <div className="home-step-num">{step.num}</div>
                  <h3>{step.title}</h3>
                  <p>{step.desc}</p>
                </motion.div>
              </React.Fragment>
            ))}
          </div>

          <motion.div {...fadeUp} className="home-section-cta">
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.98 }} style={{ display: 'inline-block' }}>
              <Link to="/mint" className="btn-hero primary">Mint Your Aura</Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <div className="section-divider" />

      <div className="section-divider" />

      {/* Stats Bar */}
      <motion.div
        className="stats-bar"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        {[
          { val: statsLoading ? '—' : (stats?.totalAgents?.toLocaleString() || '0'), label: 'Agents Minted', cls: 'purple' },
          { val: statsLoading ? '—' : (stats?.totalCredScore?.toLocaleString() || '0'), label: 'Total Cred', cls: 'blue' },
          { val: statsLoading ? '—' : (stats?.frameworks || '0'), label: 'Frameworks', cls: 'blue' },
          { val: statsLoading ? '—' : (stats?.soulboundCount || '0'), label: 'Soulbound', cls: 'gold' },
        ].map((s, i) => (
          <motion.div
            key={i}
            className="stat"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
          >
            <div className={`num ${s.cls}`}>{s.val}</div>
            <div className="lbl">{s.label}</div>
          </motion.div>
        ))}
      </motion.div>

      <div className="section-divider" />

      {/* Featured Agents */}
      <section className="home-section">
        <div className="home-section-inner">
          <motion.div {...fadeUp} className="home-section-header">
            <div className="section-label">Featured</div>
            <h2>Top Agents by <span className="text-gradient">Cred Score</span></h2>
            <p>Discover the highest-rated agents in the ecosystem</p>
          </motion.div>

          <div className="home-agents-grid">
            {agentsLoading
              ? Array.from({ length: 6 }).map((_, i) => <AgentCardSkeleton key={i} />)
              : topAgents?.map((agent, i) => (
                <motion.div
                  key={agent.tokenId}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.08 }}
                  whileHover={{ scale: 1.02 }}
                >
                  <AgentCard agent={agent} />
                </motion.div>
              ))
            }
          </div>

          {!agentsLoading && topAgents && topAgents.length > 0 && (
            <motion.div {...fadeUp} className="home-section-cta">
              <Link to="/leaderboard" className="btn-hero secondary">View Full Leaderboard →</Link>
            </motion.div>
          )}
        </div>
      </section>

      <div className="section-divider" />

      {/* Features */}
      <section className="home-section home-section-alt">
        <div className="home-section-inner">
          <motion.div {...fadeUp} className="home-section-header">
            <div className="section-label">Why Helixa</div>
            <h2>Built <span className="text-gradient">Different</span></h2>
            <p>Not another registry. A living identity layer for AI agents.</p>
          </motion.div>

          <div className="home-features-grid">
            {[
              { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>, title: 'Unique Visual Identity', desc: 'Every agent gets a distinctive QR-aesthetic "Aura" reflecting its personality, traits, and achievements.' },
              { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>, title: 'Cred Score', desc: 'Dynamic reputation scoring based on activity, contributions, community trust, and verification.' },
              { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>, title: 'Rich Storytelling', desc: "Document your agent's origin, mission, lore, and manifesto onchain." },
              { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>, title: 'Evolution Tracking', desc: 'Track mutations, upgrades, and changes over time.' },
              { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>, title: 'Framework Agnostic', desc: 'Works with Eliza, AutoGen, CrewAI, LangChain, and more.' },
              { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>, title: 'Onchain Permanence', desc: 'All data stored permanently on Base. Immutable identity with optional soulbound.' },
            ].map((feature, i) => (
              <motion.div
                key={i}
                className="home-feature-card"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                whileHover={{ scale: 1.02, y: -4 }}
              >
                <div className="home-feature-icon">{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p>{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* CTA */}
      <section className="home-cta cta-glow">
        <motion.div {...fadeUp}>
          <h2>Ready to give your agent an <span className="text-gradient">identity</span>?</h2>
          <p>Join the growing ecosystem of identified agents on Base.</p>
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.98 }} style={{ display: 'inline-block' }}>
            <Link to="/mint" className="btn-hero primary" style={{ animation: 'subtlePulse 4s ease-in-out infinite' }}>Mint Your Aura</Link>
          </motion.div>
        </motion.div>
      </section>
    </div>
  );
}
