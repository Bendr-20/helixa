import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { ethers } from 'ethers';
import { API_URL } from '../lib/constants';

type HumanJoinStep = 'intro' | 'profile' | 'work' | 'links' | 'review';
type AuthMethod = 'email' | 'wallet' | 'social';
type RelationshipType = 'owner' | 'operator' | 'creator' | 'contributor';

type HumanJoinDraft = {
  authMethod: AuthMethod;
  displayName: string;
  bio: string;
  timezone: string;
  region: string;
  languages: string[];
  profileImage: string;
  skills: string[];
  serviceCategories: string[];
  paymentPreferences: string[];
  openToWork: boolean;
  communicationChannels: string[];
  x: string;
  github: string;
  farcaster: string;
  ens: string;
  basename: string;
  website: string;
  linkedAgent: string;
  relationship: RelationshipType;
};

const DRAFT_STORAGE_KEY = 'helixa-human-join-draft';

const defaultDraft: HumanJoinDraft = {
  authMethod: 'email',
  displayName: '',
  bio: '',
  timezone: 'UTC',
  region: '',
  languages: ['en'],
  profileImage: '',
  skills: [],
  serviceCategories: [],
  paymentPreferences: ['usdc'],
  openToWork: true,
  communicationChannels: ['email'],
  x: '',
  github: '',
  farcaster: '',
  ens: '',
  basename: '',
  website: '',
  linkedAgent: '',
  relationship: 'operator',
};

const stepPaths: Record<HumanJoinStep, string> = {
  intro: '/join/human',
  profile: '/join/human/profile',
  work: '/join/human/work',
  links: '/join/human/links',
  review: '/join/human/review',
};

const pathSteps: Record<string, HumanJoinStep> = {
  '/join/human': 'intro',
  '/join/human/profile': 'profile',
  '/join/human/work': 'work',
  '/join/human/links': 'links',
  '/join/human/review': 'review',
};

const serviceCategoryOptions = [
  'mvp-build',
  'operator-support',
  'ai-consulting',
  'automation',
  'design',
  'growth',
  'research',
  'other',
];

const paymentOptions = ['usd', 'usdc', 'cred', 'open'];
const communicationOptions = ['email', 'telegram', 'web'];
const relationshipOptions: RelationshipType[] = ['owner', 'operator', 'creator', 'contributor'];

const pageCardStyle = {
  background: 'linear-gradient(180deg, rgba(18,18,30,0.96), rgba(10,10,20,0.96))',
  border: '1px solid rgba(180, 144, 255, 0.18)',
  borderRadius: '20px',
  padding: '2rem',
  boxShadow: '0 20px 60px rgba(0,0,0,0.28)',
};

const fieldLabelStyle = {
  display: 'block',
  fontSize: '0.9rem',
  color: '#d7d2e8',
  marginBottom: '0.5rem',
  fontWeight: 600,
};

const inputStyle = {
  width: '100%',
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '10px',
  color: '#fff',
  padding: '0.85rem 1rem',
  fontSize: '0.95rem',
  outline: 'none',
};

const textareaStyle = {
  ...inputStyle,
  minHeight: '140px',
  resize: 'vertical' as const,
  lineHeight: 1.5,
};

function readStoredDraft(): HumanJoinDraft {
  if (typeof window === 'undefined') return defaultDraft;

  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return defaultDraft;
    return { ...defaultDraft, ...JSON.parse(raw) };
  } catch {
    return defaultDraft;
  }
}

function toCommaSeparated(values: string[]) {
  return values.join(', ');
}

function fromCommaSeparated(value: string) {
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function humanize(value: string) {
  return value
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function compactObject(input: Record<string, string | undefined>) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => Boolean(value && value.trim())));
}

function parseLinkedAgentTokenId(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const match = trimmed.match(/(?:^|:)(\d+)$/);
  return match ? Number(match[1]) : null;
}

async function buildSiwaToken(wallet: { address: string; getEthereumProvider: () => Promise<any> }) {
  const address = wallet.address;
  const timestamp = Date.now().toString();
  const message = `Sign-In With Agent: api.helixa.xyz wants you to sign in with your wallet ${address} at ${timestamp}`;
  const provider = await wallet.getEthereumProvider();
  const signer = await new ethers.BrowserProvider(provider).getSigner();
  const signature = await signer.signMessage(message);
  return `${address}:${timestamp}:${signature}`;
}

function StepPill({ active, complete, label, onClick }: { active: boolean, complete: boolean, label: string, onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '0.55rem 0.9rem',
        borderRadius: '999px',
        border: active ? '1px solid rgba(110, 236, 216, 0.4)' : '1px solid rgba(255,255,255,0.1)',
        background: active ? 'rgba(110, 236, 216, 0.12)' : complete ? 'rgba(180, 144, 255, 0.12)' : 'rgba(255,255,255,0.03)',
        color: active ? '#6eecd8' : complete ? '#b490ff' : '#8c87a3',
        fontSize: '0.82rem',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function ToggleChip({ active, label, onClick }: { active: boolean, label: string, onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '0.65rem 0.9rem',
        borderRadius: '999px',
        border: active ? '1px solid rgba(110, 236, 216, 0.4)' : '1px solid rgba(255,255,255,0.1)',
        background: active ? 'rgba(110, 236, 216, 0.12)' : 'rgba(255,255,255,0.03)',
        color: active ? '#6eecd8' : '#d7d2e8',
        cursor: 'pointer',
        fontSize: '0.88rem',
      }}
    >
      {humanize(label)}
    </button>
  );
}

function SummaryRow({ label, value }: { label: string, value: string }) {
  return (
    <div style={{ padding: '0.85rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ fontSize: '0.78rem', color: '#7f7894', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>
        {label}
      </div>
      <div style={{ color: '#f3f0ff', lineHeight: 1.5 }}>{value || 'Not added yet'}</div>
    </div>
  );
}

export function HumanJoin() {
  const location = useLocation();
  const navigate = useNavigate();
  const { ready, authenticated, login, user, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets[0];
  const [draft, setDraft] = useState<HumanJoinDraft>(readStoredDraft);
  const [saveMessage, setSaveMessage] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentStep = pathSteps[location.pathname] || 'intro';
  const stepOrder: HumanJoinStep[] = ['intro', 'profile', 'work', 'links', 'review'];
  const currentIndex = stepOrder.indexOf(currentStep);

  useEffect(() => {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  }, [draft]);

  const walletAddress = wallet?.address || user?.wallet?.address || '';
  const publicProfilePath = walletAddress ? `/h/${walletAddress}` : '/h/{profile-id}';

  const updateDraft = (patch: Partial<HumanJoinDraft>) => {
    setDraft(prev => ({ ...prev, ...patch }));
    if (saveMessage) setSaveMessage('');
    if (submitError) setSubmitError('');
    if (submitSuccess) setSubmitSuccess('');
  };

  const toggleArrayValue = (field: 'serviceCategories' | 'paymentPreferences' | 'communicationChannels', value: string) => {
    setDraft(prev => {
      const current = prev[field];
      const next = current.includes(value)
        ? current.filter(item => item !== value)
        : [...current, value];
      return { ...prev, [field]: next };
    });
    if (saveMessage) setSaveMessage('');
    if (submitError) setSubmitError('');
    if (submitSuccess) setSubmitSuccess('');
  };

  const goToStep = (step: HumanJoinStep) => navigate(stepPaths[step]);
  const nextStep = () => {
    if (currentIndex < stepOrder.length - 1) goToStep(stepOrder[currentIndex + 1]);
  };
  const previousStep = () => {
    if (currentIndex > 0) goToStep(stepOrder[currentIndex - 1]);
  };

  const saveDraftLocally = () => {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    setSaveMessage('Draft saved locally on this device.');
    if (submitError) setSubmitError('');
    if (submitSuccess) setSubmitSuccess('');
  };

  const publishProfile = async () => {
    setSubmitError('');
    setSubmitSuccess('');

    if (!draft.displayName.trim()) {
      setSubmitError('Display name is required.');
      return;
    }

    if (!ready) {
      setSubmitError('Auth is still loading. Try again in a second.');
      return;
    }

    if (!authenticated) {
      await login();
      setSubmitError('Sign-in opened. Once it completes, click publish again.');
      return;
    }

    const linkedAgentTokenId = parseLinkedAgentTokenId(draft.linkedAgent);
    // If linking an agent, we need wallet proof (SIWA). If no linked agent, we can use Privy access token.
    if (linkedAgentTokenId !== null && !wallet) {
      setSubmitError('Linking an agent requires wallet authentication. Please connect a wallet or remove the linked agent.');
      return;
    }

    setIsSubmitting(true);
    try {
      let authToken = '';
      if (linkedAgentTokenId !== null && wallet) {
        // Wallet proof required for linking
        authToken = await buildSiwaToken(wallet);
      } else {
        // No linked agent → use Privy access token (email/social)
        const token = await getAccessToken();
        if (!token) {
          throw new Error('Could not obtain Privy access token. Try signing in again.');
        }
        authToken = token;
      }
      const linkedAccounts = compactObject({
        x: draft.x.replace(/^@/, '').trim(),
        github: draft.github.trim(),
        farcaster: draft.farcaster.trim(),
        ens: draft.ens.trim(),
        basename: draft.basename.trim(),
      });
      const externalIds = compactObject({
        x: draft.x.replace(/^@/, '').trim(),
        github: draft.github.trim(),
        farcaster: draft.farcaster.trim(),
        ens: draft.ens.trim(),
        basename: draft.basename.trim(),
      });
      const authEmail = user?.email?.address?.trim() || '';
      const requestedChannels = draft.communicationChannels.filter(channel => ['email', 'telegram', 'web'].includes(channel));
      const availableChannels = requestedChannels.filter(channel => {
        if (channel === 'email') return Boolean(authEmail);
        if (channel === 'web') return Boolean(draft.website.trim());
        return false;
      });

      const payload = {
        name: draft.displayName.trim(),
        description: draft.bio.trim(),
        image: draft.profileImage.trim() || undefined,
        skills: draft.skills,
        domains: [],
        linkedAccounts,
        linkedAgents: linkedAgentTokenId !== null ? [String(linkedAgentTokenId)] : [],
        externalIds,
        services: {
          ...(draft.website.trim() ? { web: { url: draft.website.trim() } } : {}),
          ...(draft.ens.trim() ? { ens: { name: draft.ens.trim() } } : {}),
        },
        contact: {
          email: authEmail,
        },
        notificationPreferences: {
          channels: availableChannels,
          preferredChannel: availableChannels[0] || null,
          proposalAlerts: true,
          taskAlerts: true,
        },
        metadata: {
          timezone: draft.timezone.trim(),
          region: draft.region.trim(),
          languages: draft.languages,
          openToWork: draft.openToWork,
          acceptedPayments: draft.paymentPreferences,
          serviceCategories: draft.serviceCategories,
          preferredCommunicationChannels: requestedChannels,
          linkedAccounts,
          linkedAgents: linkedAgentTokenId !== null ? [String(linkedAgentTokenId)] : [],
        },
      };

      const registerRes = await fetch(`${API_URL}/api/v2/principals/human/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(payload),
      });

      const registerData = await registerRes.json().catch(() => ({}));
      if (!registerRes.ok) throw new Error(registerData?.error || 'Human register failed');

      let principal = registerData.principal;

      if (linkedAgentTokenId !== null && principal?.id) {
        const linkRes = await fetch(`${API_URL}/api/v2/human/${encodeURIComponent(String(principal.id))}/link-agent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ agentTokenId: linkedAgentTokenId }),
        });

        if (linkRes.ok) {
          const linkData = await linkRes.json().catch(() => ({}));
          if (linkData?.principal) principal = linkData.principal;
        }
      }

      const profileId = principal?.tokenId ?? principal?.walletAddress ?? principal?.id;
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      setSubmitSuccess(registerData?.message || 'Human profile published.');
      navigate(`/h/${profileId}`);
    } catch (error: any) {
      setSubmitError(error?.message || 'Failed to publish human profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const profileReady = draft.displayName.trim().length > 0 && draft.timezone.trim().length > 0;
  const publicLinks = [
    draft.website && `Website: ${draft.website}`,
    draft.x && `X: ${draft.x}`,
    draft.github && `GitHub: ${draft.github}`,
    draft.farcaster && `Farcaster: ${draft.farcaster}`,
    draft.ens && `ENS: ${draft.ens}`,
    draft.basename && `Basename: ${draft.basename}`,
  ].filter(Boolean).join(' · ');

  return (
    <div className="mint-page">
      <div className="mint-container" style={{ maxWidth: '920px' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <Link to="/" style={{ color: '#7f7894', textDecoration: 'none', fontSize: '0.88rem' }}>
            ← Back home
          </Link>
        </div>

        <div style={pageCardStyle}>
          <div style={{ marginBottom: '2rem' }}>
            <div className="section-label">Human Principal Onboarding</div>
            <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', lineHeight: 1.05, marginBottom: '0.75rem' }}>
              Join Helixa as a <span className="text-gradient">Human</span>
            </h1>
            <p style={{ color: '#9a94af', fontSize: '1rem', maxWidth: '700px', lineHeight: 1.6, marginBottom: '1rem' }}>
              Build your human profile around identity, discoverability, and real work context. This is where people show who they are, what they do, and how they plug into Helixa.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {stepOrder.map((step, index) => (
                <StepPill
                  key={step}
                  label={`${index + 1}. ${humanize(step)}`}
                  active={currentStep === step}
                  complete={index < currentIndex}
                  onClick={() => goToStep(step)}
                />
              ))}
            </div>
          </div>

          {currentStep === 'intro' && (
            <div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1rem',
                marginBottom: '1.5rem',
              }}>
                {[
                  { key: 'email', title: 'Start with Email', body: 'Best for consultants, operators, and service providers who want a clean profile setup.' },
                  { key: 'wallet', title: 'Start with Wallet', body: 'Good if you already have an onchain identity and want to link it later.' },
                  { key: 'social', title: 'Start with Social', body: 'Useful when your public reputation already lives on X, GitHub, or Farcaster.' },
                ].map(option => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => {
                      updateDraft({ authMethod: option.key as AuthMethod });
                      goToStep('profile');
                    }}
                    style={{
                      textAlign: 'left',
                      padding: '1.35rem',
                      borderRadius: '16px',
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: draft.authMethod === option.key ? 'rgba(110,236,216,0.08)' : 'rgba(255,255,255,0.03)',
                      color: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>{option.title}</div>
                    <div style={{ color: '#9a94af', lineHeight: 1.5, fontSize: '0.92rem' }}>{option.body}</div>
                  </button>
                ))}
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '0.9rem',
                marginBottom: '2rem',
              }}>
                {[
                  ['No gas required', 'Start offchain, publish later'],
                  ['Human-first profile', 'Bio, timezone, skills, service categories'],
                  ['Optional agent link', 'Connect the people behind the work'],
                ].map(([title, body]) => (
                  <div key={title} style={{
                    padding: '1rem 1.1rem',
                    borderRadius: '14px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <div style={{ color: '#f3f0ff', fontWeight: 600, marginBottom: '0.35rem' }}>{title}</div>
                    <div style={{ color: '#8d87a1', fontSize: '0.88rem', lineHeight: 1.5 }}>{body}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
                <button type="button" className="btn-hero primary" onClick={() => goToStep('profile')}>
                  Start Human Profile
                </button>
                <Link to="/mint#agent-mint" className="btn-hero secondary" style={{ borderColor: '#b490ff', color: '#b490ff' }}>
                  I&apos;m an Agent Instead
                </Link>
              </div>
            </div>
          )}

          {currentStep === 'profile' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={fieldLabelStyle}>Display Name</label>
                  <input
                    value={draft.displayName}
                    onChange={e => updateDraft({ displayName: e.target.value })}
                    placeholder="Quigley"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={fieldLabelStyle}>Timezone</label>
                  <input
                    value={draft.timezone}
                    onChange={e => updateDraft({ timezone: e.target.value })}
                    placeholder="America/Chicago"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={fieldLabelStyle}>Region</label>
                  <input
                    value={draft.region}
                    onChange={e => updateDraft({ region: e.target.value })}
                    placeholder="North America"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={fieldLabelStyle}>Languages</label>
                  <input
                    value={toCommaSeparated(draft.languages)}
                    onChange={e => updateDraft({ languages: fromCommaSeparated(e.target.value) })}
                    placeholder="en, fr"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={fieldLabelStyle}>Short Bio</label>
                <textarea
                  value={draft.bio}
                  onChange={e => updateDraft({ bio: e.target.value })}
                  placeholder="What do you do, what kind of work are you great at, and what should people know about how you operate?"
                  style={textareaStyle}
                />
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <label style={fieldLabelStyle}>Profile Image URL (optional)</label>
                <input
                  value={draft.profileImage}
                  onChange={e => updateDraft({ profileImage: e.target.value })}
                  placeholder="https://..."
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button type="button" className="btn-hero secondary" onClick={previousStep}>Back</button>
                <button type="button" className="btn-hero primary" onClick={nextStep} disabled={!profileReady} style={{ opacity: profileReady ? 1 : 0.55 }}>
                  Continue to Work
                </button>
              </div>
            </div>
          )}

          {currentStep === 'work' && (
            <div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={fieldLabelStyle}>Skills</label>
                <input
                  value={toCommaSeparated(draft.skills)}
                  onChange={e => updateDraft({ skills: fromCommaSeparated(e.target.value) })}
                  placeholder="product strategy, protocol design, AI consulting"
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={fieldLabelStyle}>Service Categories</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                  {serviceCategoryOptions.map(option => (
                    <ToggleChip
                      key={option}
                      label={option}
                      active={draft.serviceCategories.includes(option)}
                      onClick={() => toggleArrayValue('serviceCategories', option)}
                    />
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={fieldLabelStyle}>Accepted Payments</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                  {paymentOptions.map(option => (
                    <ToggleChip
                      key={option}
                      label={option}
                      active={draft.paymentPreferences.includes(option)}
                      onClick={() => toggleArrayValue('paymentPreferences', option)}
                    />
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={fieldLabelStyle}>Preferred Communication Channels</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                  {communicationOptions.map(option => (
                    <ToggleChip
                      key={option}
                      label={option}
                      active={draft.communicationChannels.includes(option)}
                      onClick={() => toggleArrayValue('communicationChannels', option)}
                    />
                  ))}
                </div>
              </div>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.65rem', color: '#d7d2e8', marginBottom: '2rem' }}>
                <input
                  type="checkbox"
                  checked={draft.openToWork}
                  onChange={e => updateDraft({ openToWork: e.target.checked })}
                />
                Open to work right now
              </label>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button type="button" className="btn-hero secondary" onClick={previousStep}>Back</button>
                <button type="button" className="btn-hero primary" onClick={nextStep}>Continue to Links</button>
              </div>
            </div>
          )}

          {currentStep === 'links' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={fieldLabelStyle}>X</label>
                  <input value={draft.x} onChange={e => updateDraft({ x: e.target.value })} placeholder="QuigleyNFT" style={inputStyle} />
                </div>
                <div>
                  <label style={fieldLabelStyle}>GitHub</label>
                  <input value={draft.github} onChange={e => updateDraft({ github: e.target.value })} placeholder="quigley" style={inputStyle} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={fieldLabelStyle}>Farcaster</label>
                  <input value={draft.farcaster} onChange={e => updateDraft({ farcaster: e.target.value })} placeholder="quigley" style={inputStyle} />
                </div>
                <div>
                  <label style={fieldLabelStyle}>Website</label>
                  <input value={draft.website} onChange={e => updateDraft({ website: e.target.value })} placeholder="https://..." style={inputStyle} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={fieldLabelStyle}>ENS</label>
                  <input value={draft.ens} onChange={e => updateDraft({ ens: e.target.value })} placeholder="name.eth" style={inputStyle} />
                </div>
                <div>
                  <label style={fieldLabelStyle}>Basename</label>
                  <input value={draft.basename} onChange={e => updateDraft({ basename: e.target.value })} placeholder="name.base.eth" style={inputStyle} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                <div>
                  <label style={fieldLabelStyle}>Linked Agent (optional)</label>
                  <input value={draft.linkedAgent} onChange={e => updateDraft({ linkedAgent: e.target.value })} placeholder="8453:1" style={inputStyle} />
                </div>
                <div>
                  <label style={fieldLabelStyle}>Relationship</label>
                  <select
                    value={draft.relationship}
                    onChange={e => updateDraft({ relationship: e.target.value as RelationshipType })}
                    style={inputStyle}
                  >
                    {relationshipOptions.map(option => (
                      <option key={option} value={option}>{humanize(option)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button type="button" className="btn-hero secondary" onClick={previousStep}>Back</button>
                <button type="button" className="btn-hero primary" onClick={nextStep}>Review Profile</button>
              </div>
            </div>
          )}

          {currentStep === 'review' && (
            <div>
              <div style={{
                marginBottom: '1.5rem',
                padding: '1rem 1.1rem',
                borderRadius: '14px',
                background: 'rgba(110,236,216,0.08)',
                border: '1px solid rgba(110,236,216,0.14)',
                color: '#c5fff3',
              }}>
                Public profile route: <strong>{publicProfilePath}</strong>
              </div>

              <SummaryRow label="Display Name" value={draft.displayName} />
              <SummaryRow label="Bio" value={draft.bio} />
              <SummaryRow label="Timezone" value={draft.timezone} />
              <SummaryRow label="Region" value={draft.region} />
              <SummaryRow label="Languages" value={toCommaSeparated(draft.languages)} />
              <SummaryRow label="Skills" value={toCommaSeparated(draft.skills)} />
              <SummaryRow label="Service Categories" value={draft.serviceCategories.map(humanize).join(', ')} />
              <SummaryRow label="Accepted Payments" value={draft.paymentPreferences.map(humanize).join(', ')} />
              <SummaryRow label="Communication Channels" value={draft.communicationChannels.map(humanize).join(', ')} />
              <SummaryRow label="Public Links" value={publicLinks} />
              <SummaryRow label="Linked Agent" value={draft.linkedAgent ? `${draft.linkedAgent} (${humanize(draft.relationship)})` : ''} />
              <SummaryRow label="Open To Work" value={draft.openToWork ? 'Yes' : 'Not right now'} />

              <div style={{
                marginBottom: '1rem',
                padding: '1rem 1.1rem',
                borderRadius: '14px',
                background: authenticated ? 'rgba(180,144,255,0.08)' : 'rgba(255,255,255,0.03)',
                border: authenticated ? '1px solid rgba(180,144,255,0.16)' : '1px solid rgba(255,255,255,0.08)',
              }}>
                <div style={{ color: '#f3f0ff', fontWeight: 600, marginBottom: '0.35rem' }}>
                  {authenticated ? 'Signed in and ready to publish' : 'Sign in required to publish'}
                </div>
                <div style={{ color: '#9a94af', lineHeight: 1.5, fontSize: '0.92rem' }}>
                  {authenticated
                    ? (user?.email?.address || walletAddress || 'Your connected identity will be used to create this profile.')
                    : 'Privy can sign in with email, social, or wallet, then uses the connected wallet to sign the SIWA message Helixa expects.'}
                </div>
              </div>

              {submitError && (
                <div style={{ marginTop: '1rem', color: '#fca5a5', fontSize: '0.92rem', lineHeight: 1.5 }}>
                  {submitError}
                </div>
              )}

              {submitSuccess && (
                <div style={{ marginTop: '1rem', color: '#86efac', fontSize: '0.92rem', lineHeight: 1.5 }}>
                  {submitSuccess}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1.5rem' }}>
                <button type="button" className="btn-hero secondary" onClick={previousStep}>Back</button>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button type="button" className="btn-hero secondary" onClick={saveDraftLocally}>Save Draft</button>
                  <button type="button" className="btn-hero primary" onClick={publishProfile} disabled={isSubmitting || !profileReady} style={{ opacity: isSubmitting || !profileReady ? 0.6 : 1 }}>
                    {isSubmitting ? 'Publishing...' : authenticated ? 'Publish Human Profile' : 'Sign In to Publish'}
                  </button>
                </div>
              </div>

              <div style={{ marginTop: '1rem', color: '#8d87a1', fontSize: '0.9rem', lineHeight: 1.5 }}>
                {saveMessage || 'Drafts stay on this device until you publish, so you can come back and finish later.'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
