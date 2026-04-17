import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { BrowserProvider } from 'ethers';
import { API_URL } from '../lib/constants';
import { useAgentsByOwner } from '../hooks/useAgents';

type HumanPrincipal = {
  id?: string;
  name: string;
  description?: string | null;
  walletAddress: string;
  tokenId: number | null;
  metadata?: Record<string, any>;
  linkedAccounts?: Record<string, string>;
  services?: Record<string, any>;
  humanCred?: { score?: number };
};

type HumanForm = {
  displayName: string;
  bio: string;
  timezone: string;
  region: string;
  languages: string;
  x: string;
  telegram: string;
  website: string;
};

const card: CSSProperties = {
  background: 'linear-gradient(180deg, rgba(18,18,30,0.96), rgba(10,10,20,0.96))',
  border: '1px solid rgba(180, 144, 255, 0.16)',
  borderRadius: '18px',
  padding: 'clamp(1rem, 3vw, 1.5rem)',
  boxShadow: '0 18px 50px rgba(0,0,0,0.22)',
};

const input: CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '10px',
  color: '#fff',
  padding: '0.85rem 1rem',
  fontSize: '0.95rem',
  outline: 'none',
  boxSizing: 'border-box',
};

const textarea: CSSProperties = {
  ...input,
  minHeight: '120px',
  resize: 'vertical',
  lineHeight: 1.5,
};

const label: CSSProperties = {
  display: 'block',
  fontSize: '0.88rem',
  color: '#d7d2e8',
  marginBottom: '0.45rem',
  fontWeight: 600,
};

const buttonPrimary: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0.85rem 1.2rem',
  borderRadius: '999px',
  background: 'linear-gradient(135deg, #6eecd8, #b490ff)',
  color: '#0a0a14',
  fontWeight: 700,
  fontSize: '0.9rem',
  border: 'none',
  cursor: 'pointer',
  textDecoration: 'none',
};

const buttonSecondary: CSSProperties = {
  ...buttonPrimary,
  background: 'rgba(255,255,255,0.06)',
  color: '#e0e0e0',
  border: '1px solid rgba(255,255,255,0.08)',
};

const emptyForm: HumanForm = {
  displayName: '',
  bio: '',
  timezone: 'UTC',
  region: '',
  languages: 'en',
  x: '',
  telegram: '',
  website: '',
};

function normalizeHumanPrincipal(principal: any): HumanPrincipal {
  return {
    id: principal.id,
    name: principal.name || 'Human',
    description: principal.description || '',
    walletAddress: principal.walletAddress || '',
    tokenId: principal.tokenId ?? null,
    metadata: principal.metadata || {},
    linkedAccounts: principal.linkedAccounts || {},
    services: principal.services || {},
    humanCred: principal.humanCred || {},
  };
}

function normalizeHumanFallback(agent: any): HumanPrincipal {
  return {
    id: String(agent.tokenId || agent.id || ''),
    name: agent.name || 'Human',
    description: agent.narrative?.mission || agent.narrative?.origin || '',
    walletAddress: agent.owner || agent.agentAddress || '',
    tokenId: agent.tokenId ?? null,
    metadata: agent.metadata || {},
    linkedAccounts: agent.metadata?.linkedAccounts || {},
    services: agent.services || {},
    humanCred: { score: agent.credScore || 0 },
  };
}

function formFromHuman(human: HumanPrincipal): HumanForm {
  return {
    displayName: human.name || '',
    bio: human.description || '',
    timezone: String(human.metadata?.timezone || 'UTC'),
    region: String(human.metadata?.region || ''),
    languages: Array.isArray(human.metadata?.languages) ? human.metadata.languages.join(', ') : 'en',
    x: String(human.linkedAccounts?.x || ''),
    telegram: String(human.services?.telegram?.handle || human.linkedAccounts?.telegram || ''),
    website: String(human.services?.web?.url || ''),
  };
}

async function buildWalletBearer(wallet: any) {
  const walletAddress = wallet.address;
  const timestamp = Date.now().toString();
  const walletMessage = `Sign-In With Ethereum: api.helixa.xyz wants you to sign in with your wallet ${walletAddress} at ${timestamp}`;
  const provider = await wallet.getEthereumProvider();
  const signature = await new BrowserProvider(provider).getSigner().then(signer => signer.signMessage(walletMessage));
  return `${walletAddress}:${timestamp}:${signature}`;
}

async function getHumanAuthHeader({
  wallet,
  authenticated,
  getAccessToken,
}: {
  wallet: any;
  authenticated: boolean;
  getAccessToken: () => Promise<string | null>;
}) {
  if (wallet) {
    const bearer = await buildWalletBearer(wallet);
    return `Bearer ${bearer}`;
  }

  if (authenticated) {
    const token = await getAccessToken();
    if (token) return `Bearer ${token}`;
  }

  throw new Error('Sign in with a wallet, or finish Privy sign-in first.');
}

export function HumanManage() {
  const { ready, authenticated, login, user, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets[0] || null;
  const address = wallet?.address || user?.wallet?.address || '';
  const allWalletAddresses = wallets.map(w => w.address).filter(Boolean);
  const { data: ownedPrincipals, isLoading: ownedPrincipalsLoading } = useAgentsByOwner(address as `0x${string}` | undefined, allWalletAddresses);
  const humanMint = useMemo(
    () => ownedPrincipals?.find(agent => agent.framework === 'human' || agent.mintOrigin === 'HUMAN') || null,
    [ownedPrincipals],
  );

  const [loading, setLoading] = useState(true);
  const [human, setHuman] = useState<HumanPrincipal | null>(null);
  const [form, setForm] = useState<HumanForm>(emptyForm);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(null);
  const [repairMode, setRepairMode] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!ready && !wallet) return;
      if (ownedPrincipalsLoading) return;

      setLoading(true);
      setStatus(null);

      try {
        if (humanMint?.tokenId) {
          const publicRes = await fetch(`${API_URL}/api/v2/human/${humanMint.tokenId}`);
          if (publicRes.ok) {
            const principal = normalizeHumanPrincipal(await publicRes.json());
            if (!mounted) return;
            setHuman(principal);
            setForm(formFromHuman(principal));
            setRepairMode(false);
            setLoading(false);
            return;
          }

          const fallbackRes = await fetch(`${API_URL}/api/v2/agent/${humanMint.tokenId}`);
          if (fallbackRes.ok) {
            const fallback = normalizeHumanFallback(await fallbackRes.json());
            if (!mounted) return;
            setHuman(fallback);
            setForm(formFromHuman(fallback));
            setRepairMode(true);
            setStatus({ type: 'info', msg: 'Your human token exists, but the human profile record is missing. Save once to repair it.' });
            setLoading(false);
            return;
          }
        }

        if (!wallet && !authenticated) {
          if (!mounted) return;
          setHuman(null);
          setForm(emptyForm);
          setLoading(false);
          return;
        }

        const authHeader = await getHumanAuthHeader({ wallet, authenticated, getAccessToken });
        const meRes = await fetch(`${API_URL}/api/v2/principals/human/me`, {
          headers: { Authorization: authHeader },
        });

        if (meRes.ok) {
          const principal = normalizeHumanPrincipal(await meRes.json());
          if (!mounted) return;
          setHuman(principal);
          setForm(formFromHuman(principal));
          setRepairMode(false);
          setLoading(false);
          return;
        }

        if (!mounted) return;
        setHuman(null);
        setForm(emptyForm);
      } catch (error: any) {
        if (!mounted) return;
        setStatus({ type: 'error', msg: error?.message || 'Failed to load your human profile.' });
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [ready, authenticated, getAccessToken, humanMint?.tokenId, ownedPrincipalsLoading, wallet]);

  async function saveProfile() {
    if (!wallet && !authenticated) {
      await login();
      return;
    }

    setSaving(true);
    setStatus({ type: 'info', msg: repairMode ? 'Repairing your human profile...' : 'Saving your human profile...' });

    try {
      const authHeader = await getHumanAuthHeader({ wallet, authenticated, getAccessToken });
      const linkedAccounts = {
        ...(form.x.trim() ? { x: form.x.trim().replace(/^@/, '') } : {}),
        ...(form.telegram.trim() ? { telegram: form.telegram.trim().replace(/^@/, '') } : {}),
      };

      const payload: any = {
        name: form.displayName.trim() || human?.name || 'Human',
        description: form.bio.trim(),
        framework: 'human',
        tokenId: human?.tokenId ?? undefined,
        linkedAccounts,
        services: {
          ...(form.website.trim() ? { web: { url: form.website.trim() } } : {}),
          ...(form.telegram.trim() ? { telegram: { handle: form.telegram.trim().replace(/^@/, '') } } : {}),
        },
        metadata: {
          timezone: form.timezone.trim() || 'UTC',
          region: form.region.trim(),
          languages: form.languages.split(',').map(v => v.trim()).filter(Boolean),
          openToWork: true,
          preferredCommunicationChannels: [
            ...(form.website.trim() ? ['web'] : []),
            ...(form.telegram.trim() ? ['telegram'] : []),
            ...(user?.email?.address ? ['email'] : []),
          ],
        },
        ...(user?.email?.address ? { contact: { email: user.email.address } } : {}),
      };

      const res = await fetch(`${API_URL}/api/v2/principals/human/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to save human profile.');

      const principal = normalizeHumanPrincipal(data?.principal || payload);
      setHuman(principal);
      setForm(formFromHuman(principal));
      setRepairMode(false);
      setStatus({ type: 'success', msg: data?.message || 'Human profile saved.' });
    } catch (error: any) {
      setStatus({ type: 'error', msg: error?.message || 'Failed to save human profile.' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mint-page">
        <div className="mint-container" style={{ maxWidth: '960px' }}>
          <div style={card}>Loading your human profile...</div>
        </div>
      </div>
    );
  }

  if (!wallet && !authenticated) {
    return (
      <div className="mint-page">
        <div className="mint-container" style={{ maxWidth: '760px' }}>
          <div style={card}>
            <h1 style={{ marginTop: 0, fontSize: '2rem' }}>Manage Human Profile</h1>
            <p style={{ color: '#a39bb9', lineHeight: 1.6, marginBottom: '1.5rem' }}>Sign in first. Then I can load or repair your human profile cleanly.</p>
            <button type="button" style={buttonPrimary} onClick={() => login()}>Sign In</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mint-page">
      <div className="mint-container" style={{ maxWidth: '960px' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <Link to="/manage" style={buttonSecondary}>Back to Manage</Link>
          {human?.tokenId != null && <Link to={`/agent/${human.tokenId}`} style={buttonSecondary}>Open Public Token View</Link>}
        </div>

        {status && (
          <div style={{
            ...card,
            marginBottom: '1rem',
            borderColor: status.type === 'error' ? 'rgba(255,120,120,0.3)' : status.type === 'success' ? 'rgba(110,236,216,0.3)' : 'rgba(128,208,255,0.3)',
            color: status.type === 'error' ? '#ffb0b0' : status.type === 'success' ? '#baf7ea' : '#b8dfff',
          }}>{status.msg}</div>
        )}

        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', marginBottom: '1rem' }}>
          <div style={card}>
            <div style={{ color: '#7f7894', marginBottom: '0.5rem' }}>Human principal</div>
            <h1 style={{ marginTop: 0, marginBottom: '0.5rem', fontSize: '2rem' }}>{human?.name || 'Human'}</h1>
            <div style={{ color: '#d7d2e8', fontSize: '0.95rem', marginBottom: '0.25rem' }}>Wallet: <code>{human?.walletAddress || address}</code></div>
            <div style={{ color: '#a39bb9', fontSize: '0.95rem' }}>Token: {human?.tokenId != null ? `#${human.tokenId}` : 'Offchain only'}</div>
            {repairMode && <div style={{ marginTop: '0.9rem', color: '#f6c77d', fontSize: '0.9rem' }}>Right now this is a minted human token with missing profile data. That mismatch is the ugly part you were looking at.</div>}
          </div>

          <div style={card}>
            <div style={{ color: '#7f7894', marginBottom: '0.5rem' }}>Quick status</div>
            <div style={{ fontSize: '1rem', color: '#f3f0ff', marginBottom: '0.5rem' }}>Human cred: {human?.humanCred?.score ?? 0}</div>
            <div style={{ color: '#a39bb9', lineHeight: 1.6 }}>This page is the dedicated human edit flow. It keeps your human out of the generic agent card pile.</div>
          </div>
        </div>

        <div style={card}>
          <h2 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.25rem' }}>Edit Human Profile</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={label}>Display name</label>
              <input style={input} value={form.displayName} onChange={(e) => setForm(f => ({ ...f, displayName: e.target.value }))} />
            </div>
            <div>
              <label style={label}>Timezone</label>
              <input style={input} value={form.timezone} onChange={(e) => setForm(f => ({ ...f, timezone: e.target.value }))} />
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={label}>Bio</label>
            <textarea style={textarea} value={form.bio} onChange={(e) => setForm(f => ({ ...f, bio: e.target.value }))} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={label}>Region</label>
              <input style={input} value={form.region} onChange={(e) => setForm(f => ({ ...f, region: e.target.value }))} />
            </div>
            <div>
              <label style={label}>Languages</label>
              <input style={input} value={form.languages} onChange={(e) => setForm(f => ({ ...f, languages: e.target.value }))} placeholder="en, es" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={label}>X</label>
              <input style={input} value={form.x} onChange={(e) => setForm(f => ({ ...f, x: e.target.value }))} placeholder="QuigleyNFT" />
            </div>
            <div>
              <label style={label}>Telegram</label>
              <input style={input} value={form.telegram} onChange={(e) => setForm(f => ({ ...f, telegram: e.target.value }))} placeholder="QuigleyNFT" />
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={label}>Website</label>
            <input style={input} value={form.website} onChange={(e) => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://..." />
          </div>

          <button type="button" style={{ ...buttonPrimary, opacity: saving ? 0.6 : 1 }} onClick={saveProfile} disabled={saving}>
            {saving ? 'Saving...' : repairMode ? 'Repair Human Profile' : 'Save Human Profile'}
          </button>
        </div>
      </div>
    </div>
  );
}
