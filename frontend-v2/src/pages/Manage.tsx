import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { WalletButton } from '../components/WalletButton';
import { AgentCard, AgentCardSkeleton } from '../components/AgentCard';
import { useAgentsByOwner } from '../hooks/useAgents';

const API = import.meta.env.VITE_API_URL || 'https://api.helixa.xyz/api/v2';

// ─── Styles ──────────────────────────────────────────────────────
const s = {
  page: { padding: '2rem 0', minHeight: 'calc(100vh - 128px)' } as React.CSSProperties,
  container: { maxWidth: '1200px', margin: '0 auto', padding: '0 1.5rem' } as React.CSSProperties,
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: '1rem', marginBottom: '2rem' } as React.CSSProperties,
  title: { fontSize: '1.875rem', fontFamily: "'Orbitron', sans-serif", fontWeight: 700, margin: 0, color: '#e0e0e0' } as React.CSSProperties,
  subtitle: { color: '#888', margin: '0.25rem 0 0 0', fontSize: '0.95rem' } as React.CSSProperties,
  gradient: { background: 'linear-gradient(90deg, #6eecd8, #b490ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } as React.CSSProperties,
  mintBtn: { display: 'inline-flex', alignItems: 'center', padding: '0.75rem 1.5rem', borderRadius: '999px', background: 'linear-gradient(135deg, #b490ff, #6eecd8)', color: '#0a0a14', fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none', border: 'none', cursor: 'pointer' } as React.CSSProperties,
  card: { background: 'rgba(10,10,20,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '1.25rem 1.5rem', marginBottom: '1.5rem' } as React.CSSProperties,
  accountRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } as React.CSSProperties,
  accountLabel: { fontWeight: 600, fontSize: '1rem', color: '#e0e0e0', marginBottom: '0.25rem' } as React.CSSProperties,
  accountAddr: { fontSize: '0.85rem', color: '#888', fontFamily: 'monospace', wordBreak: 'break-all' as const } as React.CSSProperties,
  countNum: { fontSize: '1.75rem', fontWeight: 700, color: '#b490ff', textAlign: 'right' as const } as React.CSSProperties,
  countLabel: { fontSize: '0.8rem', color: '#888', textAlign: 'right' as const } as React.CSSProperties,
  sectionTitle: { fontSize: '1.25rem', fontWeight: 600, color: '#e0e0e0', marginBottom: '1.25rem' } as React.CSSProperties,
  emptyState: { background: 'rgba(10,10,20,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '4rem 2rem', textAlign: 'center' as const } as React.CSSProperties,
  emptyIcon: { width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' } as React.CSSProperties,
  emptyTitle: { fontSize: '1.1rem', fontWeight: 600, color: '#999', marginBottom: '0.5rem' } as React.CSSProperties,
  emptyText: { color: '#666', marginBottom: '1.5rem', fontSize: '0.9rem' } as React.CSSProperties,
  agentsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' } as React.CSSProperties,
  agentWrapper: { position: 'relative' as const } as React.CSSProperties,
  agentOverlay: { position: 'absolute' as const, top: '8px', right: '8px', display: 'flex', gap: '4px' } as React.CSSProperties,
  overlayBtn: { width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(10,10,20,0.8)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', textDecoration: 'none', cursor: 'pointer' } as React.CSSProperties,
  guideGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginTop: '3rem' } as React.CSSProperties,
  guideCard: { background: 'rgba(10,10,20,0.9)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '1.5rem' } as React.CSSProperties,
  guideTitle: { fontWeight: 600, color: '#e0e0e0', marginBottom: '0.5rem', fontSize: '1rem' } as React.CSSProperties,
  guideText: { fontSize: '0.85rem', color: '#888', lineHeight: 1.5 } as React.CSSProperties,
  connectCard: { background: 'rgba(10,10,20,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '3rem 2rem', textAlign: 'center' as const, maxWidth: '500px', margin: '0 auto' } as React.CSSProperties,
  lockIcon: { width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(180,144,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' } as React.CSSProperties,
  // Edit panel styles
  editCard: { background: 'rgba(10,10,20,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '1.5rem', marginBottom: '1rem' } as React.CSSProperties,
  editHeading: { fontFamily: "'Orbitron', sans-serif", fontWeight: 600, fontSize: '1rem', color: '#6eecd8', marginBottom: '1rem', marginTop: 0 } as React.CSSProperties,
  label: { display: 'block', fontSize: '0.8rem', color: '#888', marginBottom: '6px', fontWeight: 500 } as React.CSSProperties,
  input: { width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#e0e0e0', fontFamily: "'Inter', sans-serif", fontSize: '0.9rem', marginBottom: '14px', outline: 'none', boxSizing: 'border-box' as const } as React.CSSProperties,
  textarea: { width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#e0e0e0', fontFamily: "'Inter', sans-serif", fontSize: '0.9rem', marginBottom: '14px', outline: 'none', resize: 'vertical' as const, minHeight: '80px', boxSizing: 'border-box' as const } as React.CSSProperties,
  select: { width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#e0e0e0', fontFamily: "'Inter', sans-serif", fontSize: '0.9rem', marginBottom: '14px', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' as const } as React.CSSProperties,
  help: { fontSize: '0.75rem', color: '#666', marginTop: '-8px', marginBottom: '14px' } as React.CSSProperties,
  row: { display: 'flex', gap: '12px' } as React.CSSProperties,
  lookupRow: { display: 'flex', gap: '8px', marginBottom: '16px' } as React.CSSProperties,
  lookupBtn: { padding: '10px 20px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#e0e0e0', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap' as const } as React.CSSProperties,
  agentHeader: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' } as React.CSSProperties,
  agentImg: { width: '64px', height: '64px', borderRadius: '50%', border: '2px solid #b490ff', objectFit: 'cover' as const } as React.CSSProperties,
  agentName: { fontFamily: "'Orbitron', sans-serif", fontSize: '1.1rem', fontWeight: 600, color: '#e0e0e0' } as React.CSSProperties,
  agentIdText: { color: '#888', fontSize: '0.8rem' } as React.CSSProperties,
  traitTag: { display: 'inline-block', padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', margin: '2px 4px 2px 0', background: 'rgba(180,144,255,0.12)', border: '1px solid rgba(180,144,255,0.25)', color: '#b490ff' } as React.CSSProperties,
  verifiedTag: { display: 'inline-block', padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', margin: '2px 4px 2px 0', background: 'rgba(110,236,216,0.12)', border: '1px solid rgba(110,236,216,0.25)', color: '#6eecd8' } as React.CSSProperties,
  saveBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '12px 32px', borderRadius: '8px', background: 'linear-gradient(135deg, #6eecd8, #b490ff)', color: '#0a0a14', fontFamily: "'Orbitron', sans-serif", fontWeight: 700, fontSize: '0.85rem', border: 'none', cursor: 'pointer', transition: 'opacity 0.2s' } as React.CSSProperties,
  backBtn: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#888', cursor: 'pointer', fontSize: '0.85rem', marginBottom: '16px', textDecoration: 'none' } as React.CSSProperties,
  statusMsg: (type: 'success' | 'error' | 'info') => ({
    padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem',
    ...(type === 'success' && { background: 'rgba(110,236,216,0.1)', border: '1px solid rgba(110,236,216,0.3)', color: '#6eecd8' }),
    ...(type === 'error' && { background: 'rgba(255,100,100,0.1)', border: '1px solid rgba(255,100,100,0.3)', color: '#ff8888' }),
    ...(type === 'info' && { background: 'rgba(128,208,255,0.1)', border: '1px solid rgba(128,208,255,0.3)', color: '#80d0ff' }),
  }) as React.CSSProperties,
  namingCard: { background: 'rgba(10,10,20,0.9)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem' } as React.CSSProperties,
  namingInputRow: { display: 'flex', gap: '0', marginBottom: '12px' } as React.CSSProperties,
  namingInput: { flex: 1, padding: '0.65rem 0.85rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderTopLeftRadius: '8px', borderBottomLeftRadius: '8px', borderRight: 'none', color: '#e0e0e0', fontSize: '0.9rem', outline: 'none' } as React.CSSProperties,
  namingSuffix: { display: 'flex', alignItems: 'center', padding: '0 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderLeft: 'none', borderRadius: '0 8px 8px 0', color: '#b490ff', fontFamily: "'Orbitron', sans-serif", fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap' as const } as React.CSSProperties,
  disabledBtn: { display: 'inline-flex', padding: '0.6rem 1.25rem', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', color: '#666', fontWeight: 600, fontSize: '0.85rem', border: '1px solid rgba(255,255,255,0.06)', cursor: 'not-allowed', opacity: 0.6 } as React.CSSProperties,
};

// ─── Types ───────────────────────────────────────────────────────
interface AgentMeta {
  name?: string;
  image?: string;
  attributes?: { trait_type: string; value: string }[];
}

interface EditForm {
  name: string;
  framework: string;
  version: string;
  personality: string;
  values: string;
  origin: string;
  mission: string;
  lore: string;
  twitter: string;
  website: string;
  github: string;
}

const emptyForm: EditForm = { name: '', framework: '', version: '', personality: '', values: '', origin: '', mission: '', lore: '', twitter: '', website: '', github: '' };

const frameworks = ['', 'openclaw', 'eliza', 'langchain', 'autogpt', 'crewai', 'agentkit', 'based', 'custom', 'other'];

function getAttr(meta: AgentMeta, key: string): string {
  return (meta.attributes?.find(a => a.trait_type.toLowerCase() === key.toLowerCase())?.value) || '';
}

// ─── Launch Token Panel ──────────────────────────────────────────
function LaunchTokenPanel({ tokenId, meta }: { tokenId: number; meta: AgentMeta | null }) {
  const [tokenName, setTokenName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [website, setWebsite] = useState('');
  const [launchStatus, setLaunchStatus] = useState<string | null>(null);
  const [launchType, setLaunchType] = useState<'success' | 'error' | 'info'>('info');
  const [launching, setLaunching] = useState(false);
  const [tokenAddress, setTokenAddress] = useState<string | null>(null);
  const [hasLinkedToken, setHasLinkedToken] = useState(false);

  useEffect(() => {
    if (meta) {
      setTokenName(meta.name || '');
      setImageUrl(meta.image || `https://api.helixa.xyz/api/v2/aura/${tokenId}.png`);
      setWebsite(`https://helixa.xyz/agent/${tokenId}`);
      // Check if agent already has a linked token
      const linked = meta.attributes?.find(a => a.trait_type === 'linked-token');
      if (linked && linked.value) {
        setHasLinkedToken(true);
        setTokenAddress(linked.value);
      }
    }
  }, [meta, tokenId]);

  async function launchToken() {
    if (!window.ethereum) {
      setLaunchStatus('No wallet found. Install MetaMask or similar.');
      setLaunchType('error');
      return;
    }

    setLaunching(true);
    setLaunchStatus('Requesting wallet connection...');
    setLaunchType('info');

    try {
      const accounts: string[] = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
      const account = accounts[0];
      const timestamp = Date.now();
      const message = `Launch token for agent #${tokenId} at ${timestamp}`;

      setLaunchStatus('Sign the message in your wallet...');
      const signature: string = await (window as any).ethereum.request({ method: 'personal_sign', params: [message, account] });

      setLaunchStatus('Submitting to Bankr...');
      const resp = await fetch(`${API}/agent/${tokenId}/launch-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature,
          message,
          name: tokenName || undefined,
          image: imageUrl || undefined,
          website: website || undefined,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        setLaunchStatus(`Launch failed: ${err.error || resp.statusText}`);
        setLaunchType('error');
        setLaunching(false);
        return;
      }

      const data = await resp.json();
      const jobId = data.jobId;

      if (!jobId) {
        setLaunchStatus('Launch submitted but no job ID returned.');
        setLaunchType('error');
        setLaunching(false);
        return;
      }

      setLaunchStatus('Token deploying...');

      // Poll for status
      const pollInterval = setInterval(async () => {
        try {
          const statusResp = await fetch(`${API}/agent/${tokenId}/launch-status/${jobId}`);
          const statusData = await statusResp.json();

          const addr = statusData.tokenAddress || statusData.token_address || statusData.contractAddress || statusData.contract_address;
          const jobStatus = statusData.status;

          if (jobStatus === 'completed' || jobStatus === 'success') {
            clearInterval(pollInterval);
            if (addr) {
              setTokenAddress(addr);
              setLaunchStatus(`Token launched! Address: ${addr}`);
            } else {
              setLaunchStatus('Token launched successfully!');
            }
            setLaunchType('success');
            setLaunching(false);
          } else if (jobStatus === 'failed' || jobStatus === 'error') {
            clearInterval(pollInterval);
            setLaunchStatus(`Token launch failed: ${statusData.error || statusData.message || 'Unknown error'}`);
            setLaunchType('error');
            setLaunching(false);
          }
          // Otherwise keep polling
        } catch {
          // Network error, keep polling
        }
      }, 3000);

      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        if (launching) {
          setLaunchStatus('Launch timed out. Check back later or try again.');
          setLaunchType('error');
          setLaunching(false);
        }
      }, 5 * 60 * 1000);

    } catch (e: any) {
      if (e.code === 4001) {
        setLaunchStatus('Signature rejected.');
      } else {
        setLaunchStatus(`Error: ${e.message}`);
      }
      setLaunchType('error');
      setLaunching(false);
    }
  }

  // Don't show if agent already has a linked token
  if (hasLinkedToken && tokenAddress) {
    return (
      <div style={s.editCard}>
        <h2 style={s.editHeading}>🚀 Token Linked</h2>
        <p style={{ color: '#6eecd8', fontSize: '0.9rem', marginBottom: '8px' }}>This agent has a linked token:</p>
        <a
          href={`https://basescan.org/token/${tokenAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#b490ff', fontSize: '0.85rem', fontFamily: 'monospace', wordBreak: 'break-all' }}
        >
          {tokenAddress}
        </a>
      </div>
    );
  }

  return (
    <div style={s.editCard}>
      <h2 style={s.editHeading}>🚀 Launch Token with Bankr</h2>
      <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '14px' }}>
        Deploy a token for this agent using Bankr.
      </p>

      {launchStatus && (
        <div style={s.statusMsg(launchType)}>{launchStatus}</div>
      )}

      {tokenAddress && launchType === 'success' && (
        <div style={{ marginBottom: '14px' }}>
          <a
            href={`https://basescan.org/token/${tokenAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#b490ff', fontSize: '0.85rem', fontFamily: 'monospace', wordBreak: 'break-all' }}
          >
            View on BaseScan: {tokenAddress}
          </a>
        </div>
      )}

      <label style={s.label}>Token Name</label>
      <input style={s.input} value={tokenName} onChange={e => setTokenName(e.target.value)} placeholder="e.g. My Agent Token" />

      <label style={s.label}>Image URL (defaults to your Aura NFT)</label>
      <input style={s.input} value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." />

      <label style={s.label}>Website (defaults to your agent profile)</label>
      <input style={s.input} value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://..." />

      <div style={{ textAlign: 'center', marginTop: '8px' }}>
        <button
          style={{ ...s.saveBtn, ...(launching ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
          onClick={launchToken}
          disabled={launching}
        >
          {launching ? 'Launching...' : 'Launch with Bankr'}
        </button>
      </div>
    </div>
  );
}

// ─── Edit Panel ──────────────────────────────────────────────────
function EditPanel({ tokenId, onBack }: { tokenId: number; onBack: () => void }) {
  const [meta, setMeta] = useState<AgentMeta | null>(null);
  const [form, setForm] = useState<EditForm>(emptyForm);
  const [status, setStatus] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/metadata/${tokenId}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error('Not found')))
      .then((data: AgentMeta) => {
        setMeta(data);
        setForm({
          name: data.name || '',
          framework: getAttr(data, 'framework'),
          version: getAttr(data, 'version'),
          personality: getAttr(data, 'personality') || getAttr(data, 'quirks'),
          values: getAttr(data, 'values') || getAttr(data, 'communication style'),
          origin: getAttr(data, 'origin'),
          mission: getAttr(data, 'mission'),
          lore: getAttr(data, 'lore'),
          twitter: getAttr(data, 'social-twitter') || getAttr(data, 'twitter'),
          website: getAttr(data, 'social-website') || getAttr(data, 'website'),
          github: getAttr(data, 'social-github') || getAttr(data, 'github'),
        });
        setLoading(false);
      })
      .catch(e => { setStatus({ msg: e.message, type: 'error' }); setLoading(false); });
  }, [tokenId]);

  const set = (key: keyof EditForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm(f => ({ ...f, [key]: e.target.value }));

  async function save() {
    if (!window.ethereum) { setStatus({ msg: 'No wallet found. Install MetaMask or similar.', type: 'error' }); return; }
    setSaving(true);
    setStatus({ msg: 'Requesting wallet connection...', type: 'info' });

    try {
      const accounts: string[] = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
      const account = accounts[0];
      const timestamp = Date.now();
      const message = `Helixa: Update agent #${tokenId} at ${timestamp}`;

      setStatus({ msg: 'Sign the message in your wallet...', type: 'info' });
      const signature: string = await (window as any).ethereum.request({ method: 'personal_sign', params: [message, account] });

      setStatus({ msg: 'Submitting update...', type: 'info' });

      const body: any = { signature, message };
      if (form.personality || form.values) body.personality = { quirks: form.personality, values: form.values };
      if (form.origin || form.mission || form.lore) body.narrative = { origin: form.origin || undefined, mission: form.mission || undefined, lore: form.lore || undefined };
      if (form.twitter || form.website || form.github) body.social = { twitter: form.twitter || undefined, website: form.website || undefined, github: form.github || undefined };

      const resp = await fetch(`${API}/agent/${tokenId}/human-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (resp.ok) {
        setStatus({ msg: 'Agent updated successfully!', type: 'success' });
      } else {
        const err = await resp.json().catch(() => ({}));
        setStatus({ msg: `Update failed: ${err.error || resp.statusText}`, type: 'error' });
      }
    } catch (e: any) {
      if (e.code === 4001) setStatus({ msg: 'Signature rejected.', type: 'error' });
      else setStatus({ msg: `Error: ${e.message}`, type: 'error' });
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        <button onClick={onBack} style={s.backBtn}>← Back to agents</button>
        <div style={s.editCard}><div style={{ color: '#888' }}>Loading agent #{tokenId}...</div></div>
      </div>
    );
  }

  const framework = meta ? getAttr(meta, 'framework') : '';
  const mintOrigin = meta ? getAttr(meta, 'mintOrigin') : '';
  const verifiedAttrs = meta?.attributes?.filter(a => a.trait_type.endsWith('-verified')) || [];

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      <button onClick={onBack} style={s.backBtn}>← Back to agents</button>

      {status && <div style={s.statusMsg(status.type)}>{status.msg}</div>}

      {/* Agent header */}
      {meta && (
        <div style={s.editCard}>
          <div style={s.agentHeader}>
            <img src={meta.image || `${API}/aura/${tokenId}.png`} alt="" style={s.agentImg} />
            <div>
              <div style={s.agentName}>{meta.name || `Agent #${tokenId}`}</div>
              <div style={s.agentIdText}>Token #{tokenId}</div>
              <div style={{ marginTop: '6px' }}>
                {framework && <span style={s.traitTag}>{framework}</span>}
                {mintOrigin && <span style={s.traitTag}>{mintOrigin}</span>}
                {verifiedAttrs.map(a => <span key={a.trait_type} style={s.verifiedTag}>✓ {a.trait_type}</span>)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Identity */}
      <div style={s.editCard}>
        <h2 style={s.editHeading}>Identity</h2>
        <label style={s.label}>Name</label>
        <input style={s.input} value={form.name} onChange={set('name')} placeholder="Agent name" />
        <div style={s.row}>
          <div style={{ flex: 1 }}>
            <label style={s.label}>Framework</label>
            <select style={s.select} value={form.framework} onChange={set('framework')}>
              {frameworks.map(f => <option key={f} value={f}>{f || 'Select...'}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={s.label}>Version</label>
            <input style={s.input} value={form.version} onChange={set('version')} placeholder="e.g. 1.0.0" />
          </div>
        </div>
      </div>

      {/* Personality */}
      <div style={s.editCard}>
        <h2 style={s.editHeading}>Personality</h2>
        <label style={s.label}>Personality Traits (comma-separated)</label>
        <input style={s.input} value={form.personality} onChange={set('personality')} placeholder="e.g. curious, analytical, witty" />
        <p style={s.help}>Up to 5 traits that define your agent's character</p>
        <label style={s.label}>Values (comma-separated)</label>
        <input style={s.input} value={form.values} onChange={set('values')} placeholder="e.g. transparency, accuracy, helpfulness" />
      </div>

      {/* Narrative */}
      <div style={s.editCard}>
        <h2 style={s.editHeading}>Narrative</h2>
        <label style={s.label}>Origin Story</label>
        <textarea style={s.textarea} value={form.origin} onChange={set('origin')} placeholder="How was this agent created? What inspired it?" />
        <label style={s.label}>Mission</label>
        <textarea style={s.textarea} value={form.mission} onChange={set('mission')} placeholder="What is this agent's purpose?" />
        <label style={s.label}>Lore</label>
        <textarea style={s.textarea} value={form.lore} onChange={set('lore')} placeholder="Backstory, achievements, or notable events" />
      </div>

      {/* Social Links */}
      <div style={s.editCard}>
        <h2 style={s.editHeading}>Social Links</h2>
        <label style={s.label}>X / Twitter Handle</label>
        <input style={s.input} value={form.twitter} onChange={set('twitter')} placeholder="@handle" />
        <label style={s.label}>Website</label>
        <input style={s.input} value={form.website} onChange={set('website')} placeholder="https://..." />
        <label style={s.label}>GitHub</label>
        <input style={s.input} value={form.github} onChange={set('github')} placeholder="username or repo URL" />
      </div>

      {/* Launch Token with Bankr */}
      <LaunchTokenPanel tokenId={tokenId} meta={meta} />

      <div style={{ textAlign: 'center', padding: '8px 0 32px' }}>
        <button style={{ ...s.saveBtn, ...(saving ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }} onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

// ─── Lookup Panel (find any agent by ID/name) ────────────────────
function LookupPanel({ onSelect }: { onSelect: (id: number) => void }) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function lookup() {
    const val = input.trim();
    if (!val) return;
    setLoading(true);
    setError('');

    try {
      const id = parseInt(val);
      if (!isNaN(id) && id >= 0) {
        try {
          const resp = await fetch(`${API}/metadata/${id}`);
          if (resp.ok) { onSelect(id); return; }
        } catch(_) { /* fall through to search */ }
      }
      // Search by name
      const resp = await fetch(`${API}/agents?search=${encodeURIComponent(val)}&limit=5`);
      const data = await resp.json();
      const agents = Array.isArray(data.agents) ? data.agents : Array.isArray(data) ? data : [];
      const match = agents.find((a: any) => a.name?.toLowerCase() === val.toLowerCase()) || agents[0];
      if (match) { onSelect(match.tokenId); }
      else { setError(`Agent not found: "${val}"`); }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.editCard}>
      <h2 style={s.editHeading}>Find Any Agent</h2>
      <label style={s.label}>Token ID or Agent Name</label>
      <div style={s.lookupRow}>
        <input
          style={{ ...s.input, flex: 1, marginBottom: 0 }}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="e.g. 1 or Bendr 2.0"
          onKeyDown={e => e.key === 'Enter' && lookup()}
        />
        <button style={s.lookupBtn} onClick={lookup} disabled={loading}>
          {loading ? '...' : 'Load'}
        </button>
      </div>
      {error && <div style={{ color: '#ff8888', fontSize: '0.85rem', marginTop: '8px' }}>{error}</div>}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────
export function Manage() {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const address = wallets[0]?.address as `0x${string}` | undefined;
  const isConnected = authenticated && !!address;
  const { data: userAgents, isLoading } = useAgentsByOwner(address);
  const [editingTokenId, setEditingTokenId] = useState<number | null>(null);
  const [searchParams] = useSearchParams();
  const [agentNameInput, setAgentNameInput] = useState('');
  const [ensNameInput, setEnsNameInput] = useState('');

  // Auto-load from URL params (?id=1 or ?token=1)
  const urlTokenId = searchParams.get('id') || searchParams.get('token');
  useEffect(() => {
    if (urlTokenId) setEditingTokenId(parseInt(urlTokenId));
  }, [urlTokenId]);

  // If a specific token is requested via URL, show it without requiring wallet connection
  if (editingTokenId !== null && urlTokenId) {
    return (
      <div style={s.page}>
        <div style={s.container}>
          <EditPanel tokenId={editingTokenId} onBack={() => { setEditingTokenId(null); window.history.pushState({}, '', '/manage'); }} />
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div style={{ ...s.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={s.connectCard}>
          <div style={s.lockIcon}>
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

  // Editing a specific agent
  if (editingTokenId !== null) {
    return (
      <div style={s.page}>
        <div style={s.container}>
          <EditPanel tokenId={editingTokenId} onBack={() => setEditingTokenId(null)} />
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={s.container}>
        {/* Header */}
        <div style={s.header}>
          <div>
            <h1 style={s.title}>Manage Your <span style={s.gradient}>Agents</span></h1>
            <p style={s.subtitle}>View and update the agents you own</p>
          </div>
          <Link to="/mint" style={s.mintBtn}>Mint New Aura</Link>
        </div>

        {/* Account Card */}
        <div style={s.card}>
          <div style={s.accountRow}>
            <div>
              <div style={s.accountLabel}>Your Account</div>
              <div style={s.accountAddr}>{address}</div>
            </div>
            <div>
              <div style={s.countNum}>{isLoading ? '...' : userAgents?.length || 0}</div>
              <div style={s.countLabel}>Agents Owned</div>
            </div>
          </div>
        </div>

        {/* Lookup any agent */}
        <LookupPanel onSelect={(id) => setEditingTokenId(id)} />

        {/* Agent Naming (only if agents exist) */}
        {!isLoading && userAgents && userAgents.length > 0 && (
          <div style={s.namingCard}>
            <h3 style={{ fontFamily: "'Orbitron', sans-serif", fontWeight: 600, fontSize: '1.05rem', color: '#e0e0e0', marginBottom: '0.75rem' }}>
              Agent Name
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.75rem' }}>No .agent name claimed</p>
            <div style={s.namingInputRow}>
              <input
                type="text"
                style={s.namingInput}
                placeholder="e.g. myagent"
                value={agentNameInput}
                onChange={(e) => setAgentNameInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                maxLength={32}
              />
              <span style={s.namingSuffix}>.agent</span>
            </div>
            <button style={{ ...s.disabledBtn, marginBottom: '1.5rem' }} disabled>Claim Name — Coming Soon</button>

            <h3 style={{ fontFamily: "'Orbitron', sans-serif", fontWeight: 600, fontSize: '1.05rem', color: '#e0e0e0', marginBottom: '0.75rem', marginTop: '0.5rem' }}>
              ENS Name
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.75rem' }}>Link an ENS name to your agent identity</p>
            <input
              type="text"
              style={{ ...s.input, marginBottom: '12px' }}
              placeholder="e.g. myagent.eth"
              value={ensNameInput}
              onChange={(e) => setEnsNameInput(e.target.value)}
            />
            <button style={s.disabledBtn} disabled>Link ENS — Coming Soon</button>
          </div>
        )}

        {/* User's Agents */}
        {isLoading ? (
          <div>
            <h2 style={s.sectionTitle}>Your Agents</h2>
            <div style={s.agentsGrid}>
              {Array.from({ length: 3 }).map((_, i) => <AgentCardSkeleton key={i} />)}
            </div>
          </div>
        ) : userAgents && userAgents.length > 0 ? (
          <div>
            <h2 style={s.sectionTitle}>Your Agents ({userAgents.length})</h2>
            <div style={s.agentsGrid}>
              {userAgents.map((agent) => (
                <div key={agent.tokenId} style={s.agentWrapper}>
                  <AgentCard agent={agent} />
                  <div style={s.agentOverlay}>
                    <Link to={`/agent/${agent.tokenId}`} style={s.overlayBtn} title="View Profile">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    </Link>
                    <button onClick={() => setEditingTokenId(agent.tokenId)} style={s.overlayBtn} title="Edit Agent">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={s.emptyState}>
            <div style={s.emptyIcon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 style={s.emptyTitle}>No Agents Found</h3>
            <p style={s.emptyText}>You don't own any agents yet. Mint your first agent to get started!</p>
            <Link to="/mint" style={s.mintBtn}>Mint Your First Agent</Link>
          </div>
        )}

        {/* Management Guide */}
        <div style={s.guideGrid}>
          <div style={s.guideCard}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(180,144,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b490ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </div>
            <h3 style={s.guideTitle}>Update Traits</h3>
            <p style={s.guideText}>Modify your agent's personality traits, values, and behavioral parameters as they evolve.</p>
          </div>
          <div style={s.guideCard}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(110,236,216,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6eecd8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            </div>
            <h3 style={s.guideTitle}>Edit Story</h3>
            <p style={s.guideText}>Update your agent's origin, mission, lore, and manifesto to reflect growth and new achievements.</p>
          </div>
          <div style={s.guideCard}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(245,160,208,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f5a0d0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
            </div>
            <h3 style={s.guideTitle}>Track Evolution</h3>
            <p style={s.guideText}>Monitor your agent's reputation growth, trait mutations, and activity history over time.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Bankr launch integration v1.0
