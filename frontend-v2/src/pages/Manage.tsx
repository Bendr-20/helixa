import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { WalletButton } from '../components/WalletButton';
import { AgentCard, AgentCardSkeleton } from '../components/AgentCard';
import { useAgentsByOwner } from '../hooks/useAgents';

const styles = {
  page: {
    padding: '2rem 0',
    minHeight: 'calc(100vh - 128px)',
  } as React.CSSProperties,
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 1.5rem',
  } as React.CSSProperties,
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap' as const,
    gap: '1rem',
    marginBottom: '2rem',
  } as React.CSSProperties,
  title: {
    fontSize: '1.875rem',
    fontFamily: "'Orbitron', sans-serif",
    fontWeight: 700,
    margin: 0,
    color: '#e0e0e0',
  } as React.CSSProperties,
  subtitle: {
    color: '#888',
    margin: '0.25rem 0 0 0',
    fontSize: '0.95rem',
  } as React.CSSProperties,
  gradient: {
    background: 'linear-gradient(90deg, #6eecd8, #b490ff)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  } as React.CSSProperties,
  mintBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.75rem 1.5rem',
    borderRadius: '999px',
    background: 'linear-gradient(135deg, #b490ff, #6eecd8)',
    color: '#0a0a14',
    fontWeight: 700,
    fontSize: '0.9rem',
    textDecoration: 'none',
    border: 'none',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  } as React.CSSProperties,
  card: {
    background: 'rgba(10,10,20,0.95)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
    padding: '1.25rem 1.5rem',
    marginBottom: '1.5rem',
  } as React.CSSProperties,
  accountRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as React.CSSProperties,
  accountLabel: {
    fontWeight: 600,
    fontSize: '1rem',
    color: '#e0e0e0',
    marginBottom: '0.25rem',
  } as React.CSSProperties,
  accountAddr: {
    fontSize: '0.85rem',
    color: '#888',
    fontFamily: 'monospace',
    wordBreak: 'break-all' as const,
  } as React.CSSProperties,
  countNum: {
    fontSize: '1.75rem',
    fontWeight: 700,
    color: '#b490ff',
    textAlign: 'right' as const,
  } as React.CSSProperties,
  countLabel: {
    fontSize: '0.8rem',
    color: '#888',
    textAlign: 'right' as const,
  } as React.CSSProperties,
  emptyState: {
    background: 'rgba(10,10,20,0.95)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
    padding: '4rem 2rem',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  emptyIcon: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.05)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 1rem',
  } as React.CSSProperties,
  emptyTitle: {
    fontSize: '1.1rem',
    fontWeight: 600,
    color: '#999',
    marginBottom: '0.5rem',
  } as React.CSSProperties,
  emptyText: {
    color: '#666',
    marginBottom: '1.5rem',
    fontSize: '0.9rem',
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: '#e0e0e0',
    marginBottom: '1.25rem',
  } as React.CSSProperties,
  guideGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '1.25rem',
    marginTop: '3rem',
  } as React.CSSProperties,
  guideCard: {
    background: 'rgba(10,10,20,0.9)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
    padding: '1.5rem',
  } as React.CSSProperties,
  guideIcon: (color: string) => ({
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    background: `${color}20`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1rem',
  }) as React.CSSProperties,
  guideTitle: {
    fontWeight: 600,
    color: '#e0e0e0',
    marginBottom: '0.5rem',
    fontSize: '1rem',
  } as React.CSSProperties,
  guideText: {
    fontSize: '0.85rem',
    color: '#888',
    lineHeight: 1.5,
  } as React.CSSProperties,
  namingCard: {
    background: 'rgba(10,10,20,0.9)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
    padding: '1.5rem',
    marginBottom: '1.5rem',
  } as React.CSSProperties,
  inputRow: {
    display: 'flex',
    gap: '0',
    marginBottom: '12px',
  } as React.CSSProperties,
  input: {
    flex: 1,
    padding: '0.65rem 0.85rem',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderTopLeftRadius: '8px',
    borderBottomLeftRadius: '8px',
    borderRight: 'none',
    color: '#e0e0e0',
    fontSize: '0.9rem',
    outline: 'none',
  } as React.CSSProperties,
  inputSuffix: {
    display: 'flex',
    alignItems: 'center',
    padding: '0 14px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderLeft: 'none',
    borderRadius: '0 8px 8px 0',
    color: '#b490ff',
    fontFamily: "'Orbitron', sans-serif",
    fontSize: '0.85rem',
    fontWeight: 600,
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  disabledBtn: {
    display: 'inline-flex',
    padding: '0.6rem 1.25rem',
    borderRadius: '8px',
    background: 'rgba(255,255,255,0.06)',
    color: '#666',
    fontWeight: 600,
    fontSize: '0.85rem',
    border: '1px solid rgba(255,255,255,0.06)',
    cursor: 'not-allowed',
    opacity: 0.6,
  } as React.CSSProperties,
  ensInput: {
    width: '100%',
    padding: '0.65rem 0.85rem',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#e0e0e0',
    fontSize: '0.9rem',
    outline: 'none',
    marginBottom: '12px',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  connectCard: {
    background: 'rgba(10,10,20,0.95)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    padding: '3rem 2rem',
    textAlign: 'center' as const,
    maxWidth: '500px',
    margin: '0 auto',
  } as React.CSSProperties,
  lockIcon: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: 'rgba(180,144,255,0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 1.5rem',
  } as React.CSSProperties,
  agentsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '1.25rem',
  } as React.CSSProperties,
  agentWrapper: {
    position: 'relative' as const,
  } as React.CSSProperties,
  agentOverlay: {
    position: 'absolute' as const,
    top: '8px',
    right: '8px',
    display: 'flex',
    gap: '4px',
  } as React.CSSProperties,
  overlayBtn: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: 'rgba(10,10,20,0.8)',
    border: '1px solid rgba(255,255,255,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ccc',
    textDecoration: 'none',
    transition: 'background 0.2s',
  } as React.CSSProperties,
};

export function Manage() {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const address = wallets[0]?.address as `0x${string}` | undefined;
  const isConnected = authenticated && !!address;
  const { data: userAgents, isLoading } = useAgentsByOwner(address);
  const [agentNameInput, setAgentNameInput] = useState('');
  const [ensNameInput, setEnsNameInput] = useState('');

  if (!isConnected) {
    return (
      <div style={{ ...styles.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={styles.connectCard}>
          <div style={styles.lockIcon}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#b490ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 style={{ fontSize: '1.5rem', fontFamily: "'Orbitron', sans-serif", fontWeight: 600, color: '#e0e0e0', marginBottom: '0.75rem' }}>
            Connect to Manage
          </h2>
          <p style={{ color: '#888', marginBottom: '2rem', fontSize: '0.9rem' }}>
            Sign in to view and manage the agents you own.
          </p>
          <WalletButton />
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>
              Manage Your <span style={styles.gradient}>Agents</span>
            </h1>
            <p style={styles.subtitle}>View and update the agents you own</p>
          </div>
          <Link to="/mint" style={styles.mintBtn}>Mint New Aura</Link>
        </div>

        {/* Account Card */}
        <div style={styles.card}>
          <div style={styles.accountRow}>
            <div>
              <div style={styles.accountLabel}>Your Account</div>
              <div style={styles.accountAddr}>{address}</div>
            </div>
            <div>
              <div style={styles.countNum}>{isLoading ? '...' : userAgents?.length || 0}</div>
              <div style={styles.countLabel}>Agents Owned</div>
            </div>
          </div>
        </div>

        {/* Agent Naming (only if agents exist) */}
        {!isLoading && userAgents && userAgents.length > 0 && (
          <div style={styles.namingCard}>
            <h3 style={{ fontFamily: "'Orbitron', sans-serif", fontWeight: 600, fontSize: '1.05rem', color: '#e0e0e0', marginBottom: '0.75rem' }}>
              Agent Name
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.75rem' }}>No .agent name claimed</p>
            <div style={styles.inputRow}>
              <input
                type="text"
                style={styles.input}
                placeholder="e.g. myagent"
                value={agentNameInput}
                onChange={(e) => setAgentNameInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                maxLength={32}
              />
              <span style={styles.inputSuffix}>.agent</span>
            </div>
            <button style={{ ...styles.disabledBtn, marginBottom: '1.5rem' }} disabled>
              Claim Name — Coming Soon
            </button>

            <h3 style={{ fontFamily: "'Orbitron', sans-serif", fontWeight: 600, fontSize: '1.05rem', color: '#e0e0e0', marginBottom: '0.75rem', marginTop: '0.5rem' }}>
              ENS Name
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.75rem' }}>Link an ENS name to your agent identity</p>
            <input
              type="text"
              style={styles.ensInput}
              placeholder="e.g. myagent.eth"
              value={ensNameInput}
              onChange={(e) => setEnsNameInput(e.target.value)}
            />
            <button style={styles.disabledBtn} disabled>
              Link ENS — Coming Soon
            </button>
          </div>
        )}

        {/* User's Agents */}
        {isLoading ? (
          <div>
            <h2 style={styles.sectionTitle}>Your Agents</h2>
            <div style={styles.agentsGrid}>
              {Array.from({ length: 6 }).map((_, i) => (
                <AgentCardSkeleton key={i} />
              ))}
            </div>
          </div>
        ) : userAgents && userAgents.length > 0 ? (
          <div>
            <h2 style={styles.sectionTitle}>Your Agents ({userAgents.length})</h2>
            <div style={styles.agentsGrid}>
              {userAgents.map((agent) => (
                <div key={agent.tokenId} style={styles.agentWrapper}>
                  <AgentCard agent={agent} />
                  <div style={styles.agentOverlay}>
                    <Link to={`/agent/${agent.tokenId}`} style={styles.overlayBtn} title="View Profile">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    </Link>
                    <Link to={`/agent/${agent.tokenId}`} style={styles.overlayBtn} title="Edit Agent">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 style={styles.emptyTitle}>No Agents Found</h3>
            <p style={styles.emptyText}>You don't own any agents yet. Mint your first agent to get started!</p>
            <Link to="/mint" style={styles.mintBtn}>Mint Your First Agent</Link>
          </div>
        )}

        {/* Management Guide */}
        <div style={styles.guideGrid}>
          <div style={styles.guideCard}>
            <div style={styles.guideIcon('#b490ff')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b490ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </div>
            <h3 style={styles.guideTitle}>Update Traits</h3>
            <p style={styles.guideText}>Modify your agent's personality traits, values, and behavioral parameters as they evolve.</p>
          </div>
          <div style={styles.guideCard}>
            <div style={styles.guideIcon('#6eecd8')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6eecd8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            </div>
            <h3 style={styles.guideTitle}>Edit Story</h3>
            <p style={styles.guideText}>Update your agent's origin, mission, lore, and manifesto to reflect growth and new achievements.</p>
          </div>
          <div style={styles.guideCard}>
            <div style={styles.guideIcon('#f5a0d0')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f5a0d0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
            </div>
            <h3 style={styles.guideTitle}>Track Evolution</h3>
            <p style={styles.guideText}>Monitor your agent's reputation growth, trait mutations, and activity history over time.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
