import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { API_URL } from '../lib/constants';

// ─── Types ────────────────────────────────────────────────────
interface Handshake {
  id: string;
  fromTokenId: number;
  toTokenId: number;
  fields: string[];
  status: 'pending' | 'accepted' | 'expired';
  reciprocated?: boolean;
  createdAt: string;
  expiresAt?: string;
}

const SOUL_FIELDS = [
  { key: 'values', label: 'Core Values', desc: 'Ethical principles & priorities' },
  { key: 'communication_style', label: 'Communication Style', desc: 'Tone, verbosity, formality' },
  { key: 'collaboration_preferences', label: 'Collaboration Preferences', desc: 'How the agent works with others' },
  { key: 'personality_traits', label: 'Personality Traits', desc: 'Openness, warmth, humor' },
  { key: 'expertise_domains', label: 'Expertise Domains', desc: 'Areas of knowledge & skill' },
  { key: 'decision_framework', label: 'Decision Framework', desc: 'How the agent makes choices' },
];

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    pending: { bg: 'rgba(251, 191, 36, 0.15)', text: '#fbbf24' },
    accepted: { bg: 'rgba(110, 236, 216, 0.15)', text: 'var(--teal)' },
    expired: { bg: 'rgba(239, 68, 68, 0.1)', text: '#ef4444' },
  };
  const c = colors[status] || colors.pending;
  return (
    <span style={{
      fontSize: '0.65rem',
      padding: '2px 8px',
      borderRadius: 20,
      background: c.bg,
      color: c.text,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
    }}>
      {status}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────
export function SoulHandshake() {
  const { isConnected } = useAccount();

  // Initiate form state
  const [agentId, setAgentId] = useState('');
  const [targetTokenId, setTargetTokenId] = useState('');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [initiating, setInitiating] = useState(false);
  const [initiateResult, setInitiateResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Inbox state
  const [inbox, setInbox] = useState<Handshake[]>([]);
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  // History state
  const [history, setHistory] = useState<Handshake[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyTab, setHistoryTab] = useState<'all' | 'sent' | 'received'>('all');

  // Public lookup
  const [lookupId, setLookupId] = useState('');
  const [lookupResult, setLookupResult] = useState<any>(null);
  const [lookingUp, setLookingUp] = useState(false);

  const toggleField = (key: string) => {
    setSelectedFields(prev =>
      prev.includes(key) ? prev.filter(f => f !== key) : [...prev, key]
    );
  };

  // ─── API Calls ──────
  const fetchInbox = useCallback(async () => {
    if (!agentId) return;
    setLoadingInbox(true);
    try {
      const res = await fetch(`${API_URL}/api/v2/agent/${agentId}/soul/inbox`);
      if (res.ok) {
        const data = await res.json();
        setInbox(Array.isArray(data) ? data : data.handshakes || []);
      }
    } catch (err) {
      console.error('Inbox fetch error:', err);
    } finally {
      setLoadingInbox(false);
    }
  }, [agentId]);

  const fetchHistory = useCallback(async () => {
    if (!agentId) return;
    setLoadingHistory(true);
    try {
      const res = await fetch(`${API_URL}/api/v2/agent/${agentId}/soul/handshakes`);
      if (res.ok) {
        const data = await res.json();
        setHistory(Array.isArray(data) ? data : data.handshakes || []);
      }
    } catch (err) {
      console.error('History fetch error:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [agentId]);

  const handleInitiate = useCallback(async () => {
    if (!agentId || !targetTokenId || selectedFields.length === 0) return;
    setInitiating(true);
    setInitiateResult(null);
    try {
      const res = await fetch(`${API_URL}/api/v2/agent/${agentId}/soul/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toTokenId: parseInt(targetTokenId, 10), fields: selectedFields }),
      });
      if (res.ok) {
        setInitiateResult({ ok: true, msg: 'Handshake initiated successfully!' });
        setTargetTokenId('');
        setSelectedFields([]);
        fetchHistory();
      } else {
        const err = await res.json().catch(() => ({}));
        setInitiateResult({ ok: false, msg: err.error || `Failed (${res.status})` });
      }
    } catch (err: any) {
      setInitiateResult({ ok: false, msg: err.message || 'Network error' });
    } finally {
      setInitiating(false);
    }
  }, [agentId, targetTokenId, selectedFields, fetchHistory]);

  const handleAccept = useCallback(async (handshakeId: string, reciprocate: boolean) => {
    if (!agentId) return;
    setAcceptingId(handshakeId);
    try {
      const res = await fetch(`${API_URL}/api/v2/agent/${agentId}/soul/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handshakeId, reciprocate }),
      });
      if (res.ok) {
        fetchInbox();
        fetchHistory();
      }
    } catch (err) {
      console.error('Accept error:', err);
    } finally {
      setAcceptingId(null);
    }
  }, [agentId, fetchInbox, fetchHistory]);

  const handleLookup = useCallback(async () => {
    if (!lookupId) return;
    setLookingUp(true);
    setLookupResult(null);
    try {
      const res = await fetch(`${API_URL}/api/v2/agent/${lookupId}/soul/handshakes`);
      if (res.ok) {
        const data = await res.json();
        const hs = Array.isArray(data) ? data : data.handshakes || [];
        setLookupResult({
          total: hs.length,
          accepted: hs.filter((h: any) => h.status === 'accepted').length,
          pending: hs.filter((h: any) => h.status === 'pending').length,
        });
      } else {
        setLookupResult({ error: true });
      }
    } catch {
      setLookupResult({ error: true });
    } finally {
      setLookingUp(false);
    }
  }, [lookupId]);

  // Auto-refresh inbox
  useEffect(() => {
    if (!agentId) return;
    fetchInbox();
    fetchHistory();
    const interval = setInterval(() => { fetchInbox(); fetchHistory(); }, 30000);
    return () => clearInterval(interval);
  }, [agentId, fetchInbox, fetchHistory]);

  // Filter history by tab
  const filteredHistory = history.filter(h => {
    if (historyTab === 'sent') return h.fromTokenId === parseInt(agentId, 10);
    if (historyTab === 'received') return h.toTokenId === parseInt(agentId, 10);
    return true;
  });

  const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: '0.65rem 1rem',
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: '0.9rem',
    outline: 'none',
  };

  return (
    <div className="py-20" style={{ minHeight: '80vh' }}>
      <div className="container" style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* ─── Hero ─────────────────────────────────── */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{
            fontFamily: "'Orbitron', sans-serif",
            fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
            fontWeight: 800,
            marginBottom: '0.75rem',
            lineHeight: 1.1,
          }}>
            <span className="text-gradient">Soul Handshake</span>
          </h1>
          <p style={{
            fontFamily: "'Orbitron', sans-serif",
            fontSize: '0.85rem',
            color: 'var(--teal)',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            marginBottom: '1rem',
            fontWeight: 600,
          }}>
            Agent-to-Agent Soul Exchange
          </p>
          <p style={{
            color: 'var(--text2)',
            maxWidth: 560,
            margin: '0 auto',
            lineHeight: 1.6,
            fontSize: '0.95rem',
          }}>
            Share personality data with trusted agents. Build your network through
            selective soul fragment exchange. Every handshake strengthens the web of trust.
          </p>
        </div>

        {/* ─── Agent ID Input ──────────────────────── */}
        <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h2 style={{
            fontFamily: "'Orbitron', sans-serif",
            fontSize: '1rem',
            fontWeight: 700,
            marginBottom: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            Your Agent
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text2)', marginBottom: '1rem' }}>
            Enter your agent's token ID to view inbox, history, and initiate handshakes.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <input
              type="number"
              min="0"
              placeholder="Your Agent Token ID"
              value={agentId}
              onChange={e => setAgentId(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        {/* ─── Initiate Handshake ──────────────────── */}
        <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h2 style={{
            fontFamily: "'Orbitron', sans-serif",
            fontSize: '1rem',
            fontWeight: 700,
            marginBottom: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            Initiate Handshake
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text2)', marginBottom: '1rem' }}>
            Select which soul fragments to share with another agent.
          </p>

          {!isConnected ? (
            <div style={{
              textAlign: 'center',
              padding: '2rem',
              color: 'var(--text2)',
              border: '1px dashed var(--border)',
              borderRadius: 12,
            }}>
              Connect your wallet to initiate handshakes
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                <input
                  type="number"
                  min="0"
                  placeholder="Target Agent Token ID"
                  value={targetTokenId}
                  onChange={e => setTargetTokenId(e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* Field checkboxes */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '0.5rem',
                marginBottom: '1rem',
              }}>
                {SOUL_FIELDS.map(f => (
                  <label
                    key={f.key}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.5rem',
                      padding: '0.6rem 0.8rem',
                      borderRadius: 10,
                      border: `1px solid ${selectedFields.includes(f.key) ? 'var(--teal)' : 'var(--border)'}`,
                      background: selectedFields.includes(f.key) ? 'rgba(110, 236, 216, 0.08)' : 'var(--surface)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedFields.includes(f.key)}
                      onChange={() => toggleField(f.key)}
                      style={{ marginTop: 2, accentColor: 'var(--teal)' }}
                    />
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>{f.label}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text2)' }}>{f.desc}</div>
                    </div>
                  </label>
                ))}
              </div>

              <button
                className="btn btn-primary btn-lg"
                style={{ width: '100%' }}
                onClick={handleInitiate}
                disabled={!agentId || !targetTokenId || selectedFields.length === 0 || initiating}
              >
                {initiating ? 'Initiating…' : 'Initiate Handshake'}
              </button>

              {initiateResult && (
                <div style={{
                  marginTop: '0.75rem',
                  padding: '0.75rem',
                  borderRadius: 10,
                  background: initiateResult.ok ? 'rgba(110, 236, 216, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${initiateResult.ok ? 'rgba(110, 236, 216, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  color: initiateResult.ok ? 'var(--teal)' : '#ef4444',
                  fontSize: '0.8rem',
                  textAlign: 'center',
                }}>
                  {initiateResult.ok ? '✓ ' : '✗ '}{initiateResult.msg}
                </div>
              )}
            </>
          )}
        </div>

        {/* ─── Inbox ───────────────────────────────── */}
        {agentId && (
          <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h2 style={{
              fontFamily: "'Orbitron', sans-serif",
              fontSize: '1rem',
              fontWeight: 700,
              marginBottom: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              Inbox
              {loadingInbox && <span className="spinner" style={{ width: 16, height: 16 }} />}
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text2)', marginBottom: '1rem' }}>
              Pending handshake requests from other agents. Auto-refreshes every 30s.
            </p>

            {inbox.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text2)' }}>
                No pending handshakes. Your inbox is clear.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {inbox.map(h => (
                  <div key={h.id} className="card" style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <span style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '0.85rem', fontWeight: 700, color: 'var(--teal)' }}>
                          Agent #{h.fromTokenId}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text2)', marginLeft: '0.5rem' }}>
                          {timeAgo(h.createdAt)}
                        </span>
                      </div>
                      <StatusBadge status={h.status} />
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text2)', marginBottom: '0.75rem' }}>
                      Offering: {h.fields?.map(f => SOUL_FIELDS.find(sf => sf.key === f)?.label || f).join(', ')}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="btn btn-primary"
                        style={{ fontSize: '0.8rem' }}
                        onClick={() => handleAccept(h.id, true)}
                        disabled={acceptingId === h.id}
                      >
                        {acceptingId === h.id ? '…' : '✓ Accept & Reciprocate'}
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: '0.8rem' }}
                        onClick={() => handleAccept(h.id, false)}
                        disabled={acceptingId === h.id}
                      >
                        Accept Only
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Handshake History ───────────────────── */}
        {agentId && (
          <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h2 style={{
              fontFamily: "'Orbitron', sans-serif",
              fontSize: '1rem',
              fontWeight: 700,
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              Handshake History
              {loadingHistory && <span className="spinner" style={{ width: 16, height: 16 }} />}
            </h2>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              {(['all', 'sent', 'received'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setHistoryTab(tab)}
                  style={{
                    padding: '0.4rem 1rem',
                    borderRadius: 20,
                    border: `1px solid ${historyTab === tab ? 'var(--teal)' : 'var(--border)'}`,
                    background: historyTab === tab ? 'rgba(110, 236, 216, 0.15)' : 'transparent',
                    color: historyTab === tab ? 'var(--teal)' : 'var(--text2)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {filteredHistory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text2)' }}>
                No handshakes found.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {filteredHistory.map(h => {
                  const isSent = h.fromTokenId === parseInt(agentId, 10);
                  return (
                    <div key={h.id} className="card" style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.8rem' }}>{isSent ? '>' : '<'}</span>
                          <span style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '0.8rem', fontWeight: 600 }}>
                            {isSent ? `→ Agent #${h.toTokenId}` : `← Agent #${h.fromTokenId}`}
                          </span>
                          <StatusBadge status={h.status} />
                          {h.reciprocated && (
                            <span style={{
                              fontSize: '0.6rem',
                              padding: '2px 6px',
                              borderRadius: 20,
                              background: 'rgba(179, 136, 255, 0.15)',
                              color: 'var(--accent-purple, #b388ff)',
                              fontWeight: 600,
                            }}>
                              Mutual
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text2)' }}>
                          {timeAgo(h.createdAt)}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text2)', marginTop: '0.3rem' }}>
                        Fields: {h.fields?.map(f => SOUL_FIELDS.find(sf => sf.key === f)?.label || f).join(', ')}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── Public Lookup ───────────────────────── */}
        <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h2 style={{
            fontFamily: "'Orbitron', sans-serif",
            fontSize: '1rem',
            fontWeight: 700,
            marginBottom: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            Public Handshake Lookup
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text2)', marginBottom: '1rem' }}>
            Check any agent's handshake stats — no wallet needed.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
            <input
              type="number"
              min="0"
              placeholder="Agent Token ID"
              value={lookupId}
              onChange={e => setLookupId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLookup()}
              style={inputStyle}
            />
            <button className="btn btn-primary" onClick={handleLookup} disabled={!lookupId || lookingUp}>
              {lookingUp ? '…' : 'Lookup'}
            </button>
          </div>

          {lookupResult && !lookupResult.error && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '1rem',
            }}>
              <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>
                  Total
                </div>
                <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '1.5rem', fontWeight: 700, color: 'var(--teal)' }}>
                  {lookupResult.total}
                </div>
              </div>
              <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>
                  Accepted
                </div>
                <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '1.5rem', fontWeight: 700, color: 'var(--teal)' }}>
                  {lookupResult.accepted}
                </div>
              </div>
              <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>
                  Pending
                </div>
                <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '1.5rem', fontWeight: 700, color: '#fbbf24' }}>
                  {lookupResult.pending}
                </div>
              </div>
            </div>
          )}

          {lookupResult?.error && (
            <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text2)', fontSize: '0.85rem' }}>
              No handshake data found for this agent.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
