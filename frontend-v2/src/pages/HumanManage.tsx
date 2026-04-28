import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { BrowserProvider } from 'ethers';
import { API_URL } from '../lib/constants';
import { useAgentsByOwner } from '../hooks/useAgents';
import { HumanAuthButtons } from '../components/HumanAuthButtons';

type RelationshipType = 'owner' | 'operator' | 'creator' | 'contributor';
type HumanManageStep = 'profile' | 'work' | 'links' | 'review';

type HumanPrincipal = {
  id?: string;
  name: string;
  description?: string | null;
  image?: string | null;
  walletAddress: string;
  tokenId: number | null;
  skills?: string[];
  domains?: string[];
  linkedAccounts?: Record<string, string>;
  linkedAgents?: string[];
  externalIds?: Record<string, string>;
  services?: Record<string, any>;
  contact?: Record<string, any>;
  notificationPreferences?: Record<string, any>;
  metadata?: Record<string, any>;
  humanCred?: { score?: number };
};

type HumanDraft = {
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
  telegram: string;
  ens: string;
  basename: string;
  website: string;
  gitlawb: string;
  talentProtocol: string;
  ethos: string;
  eas: string;
  linkedAgent: string;
  relationship: RelationshipType;
};

const defaultDraft: HumanDraft = {
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
  telegram: '',
  ens: '',
  basename: '',
  website: '',
  gitlawb: '',
  talentProtocol: '',
  ethos: '',
  eas: '',
  linkedAgent: '',
  relationship: 'operator',
};

const stepOrder: HumanManageStep[] = ['profile', 'work', 'links', 'review'];
const serviceCategoryOptions = ['mvp-build', 'operator-support', 'ai-consulting', 'automation', 'design', 'growth', 'research', 'other'];
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
  boxSizing: 'border-box' as const,
};

const textareaStyle = {
  ...inputStyle,
  minHeight: '140px',
  resize: 'vertical' as const,
  lineHeight: 1.5,
};

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

function buildEnsAvatarUrl(name?: string) {
  const normalized = (name || '').trim().toLowerCase();
  if (!normalized || !normalized.endsWith('.eth')) return '';
  return `https://metadata.ens.domains/mainnet/avatar/${encodeURIComponent(normalized)}`;
}

async function optimizeProfileImage(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not read that image.'));
      img.src = objectUrl;
    });

    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not process that image.');

    const sourceSize = Math.min(image.width, image.height);
    const sourceX = (image.width - sourceSize) / 2;
    const sourceY = (image.height - sourceSize) / 2;
    ctx.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);

    let quality = 0.9;
    let dataUrl = canvas.toDataURL('image/webp', quality);
    while (dataUrl.length > 180_000 && quality > 0.55) {
      quality -= 0.08;
      dataUrl = canvas.toDataURL('image/webp', quality);
    }

    if (dataUrl.length > 180_000) {
      quality = 0.82;
      dataUrl = canvas.toDataURL('image/jpeg', quality);
      while (dataUrl.length > 180_000 && quality > 0.5) {
        quality -= 0.08;
        dataUrl = canvas.toDataURL('image/jpeg', quality);
      }
    }

    if (dataUrl.length > 190_000) throw new Error('That image is still too large after compression. Try a smaller photo.');
    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function buildWalletBearer(wallet: any) {
  const walletAddress = wallet.address;
  const timestamp = Date.now().toString();
  const walletMessage = `Sign-In With Ethereum: api.helixa.xyz wants you to sign in with your wallet ${walletAddress} at ${timestamp}`;
  const provider = await wallet.getEthereumProvider();
  const signature = await new BrowserProvider(provider).getSigner().then(signer => signer.signMessage(walletMessage));
  return `${walletAddress}:${timestamp}:${signature}`;
}

function isWalletRejection(error: any) {
  const code = error?.code;
  const message = [error?.message, error?.shortMessage, error?.reason, error?.info?.error?.message]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return code === 4001
    || code === 'ACTION_REJECTED'
    || message.includes('user rejected')
    || message.includes('rejected the request')
    || message.includes('action_rejected');
}

function getWalletStatusMessage(error: any, context: 'load' | 'save' | 'link' = 'save') {
  if (isWalletRejection(error)) {
    if (context === 'load') return 'Wallet signature cancelled. Sign when you are ready to load your human profile.';
    if (context === 'link') return 'Wallet signature cancelled. Your agent link was not changed.';
    return 'Wallet signature cancelled. Nothing was changed.';
  }

  return error?.message || 'Something went wrong with wallet authentication.';
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

function normalizeHumanPrincipal(principal: any): HumanPrincipal {
  return {
    id: principal.id,
    name: principal.name || 'Human',
    description: principal.description || '',
    image: principal.image || '',
    walletAddress: principal.walletAddress || '',
    tokenId: principal.tokenId ?? null,
    skills: Array.isArray(principal.skills) ? principal.skills : [],
    domains: Array.isArray(principal.domains) ? principal.domains : [],
    linkedAccounts: principal.linkedAccounts || {},
    linkedAgents: Array.isArray(principal.linkedAgents) ? principal.linkedAgents : [],
    externalIds: principal.externalIds || {},
    services: principal.services || {},
    contact: principal.contact || {},
    notificationPreferences: principal.notificationPreferences || {},
    metadata: principal.metadata || {},
    humanCred: principal.humanCred || {},
  };
}

function normalizeHumanFallback(agent: any): HumanPrincipal {
  return {
    id: String(agent.tokenId || agent.id || ''),
    name: agent.name || 'Human',
    description: agent.narrative?.mission || agent.narrative?.origin || '',
    image: agent.image || '',
    walletAddress: agent.owner || agent.agentAddress || '',
    tokenId: agent.tokenId ?? null,
    skills: [],
    domains: [],
    linkedAccounts: agent.metadata?.linkedAccounts || {},
    linkedAgents: agent.metadata?.linkedAgents || [],
    externalIds: agent.metadata?.externalIds || {},
    services: agent.services || {},
    contact: {},
    notificationPreferences: {},
    metadata: agent.metadata || {},
    humanCred: { score: agent.credScore || 0 },
  };
}

function draftFromHuman(human: HumanPrincipal): HumanDraft {
  const metadata = human.metadata || {};
  const linkedAccounts = human.linkedAccounts || metadata.linkedAccounts || {};
  const externalIds = human.externalIds || metadata.externalIds || {};
  const linkedAgents = human.linkedAgents || metadata.linkedAgents || [];
  const preferredChannels = Array.isArray(metadata.preferredCommunicationChannels)
    ? metadata.preferredCommunicationChannels
    : Array.isArray(human.notificationPreferences?.channels)
      ? human.notificationPreferences?.channels
      : [];

  return {
    displayName: human.name || '',
    bio: human.description || '',
    timezone: String(metadata.timezone || 'UTC'),
    region: String(metadata.region || ''),
    languages: Array.isArray(metadata.languages) ? metadata.languages : ['en'],
    profileImage: String(human.image || ''),
    skills: Array.isArray(human.skills) ? human.skills : [],
    serviceCategories: Array.isArray(metadata.serviceCategories) ? metadata.serviceCategories : [],
    paymentPreferences: Array.isArray(metadata.acceptedPayments) ? metadata.acceptedPayments : ['usdc'],
    openToWork: metadata.openToWork !== false,
    communicationChannels: preferredChannels.length ? preferredChannels : ['email'],
    x: String(linkedAccounts.x || externalIds.x || ''),
    github: String(linkedAccounts.github || externalIds.github || ''),
    farcaster: String(linkedAccounts.farcaster || externalIds.farcaster || ''),
    telegram: String(human.services?.telegram?.handle || linkedAccounts.telegram || externalIds.telegram || human.contact?.telegram || ''),
    ens: String(linkedAccounts.ens || externalIds.ens || human.services?.ens?.name || ''),
    basename: String(linkedAccounts.basename || externalIds.basename || ''),
    website: String(human.services?.web?.url || ''),
    gitlawb: String(externalIds.gitlawb || human.services?.gitlawb?.url || linkedAccounts.gitlawb || ''),
    talentProtocol: String(externalIds.talentProtocol || human.services?.talentProtocol?.url || ''),
    ethos: String(externalIds.ethos || human.services?.ethos?.url || ''),
    eas: String(externalIds.eas || human.services?.eas?.url || ''),
    linkedAgent: String(linkedAgents[0] || ''),
    relationship: (metadata.relationship || 'operator') as RelationshipType,
  };
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

export function HumanManage() {
  const [searchParams] = useSearchParams();
  const { ready, authenticated, user, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets[0] || null;
  const address = wallet?.address || user?.wallet?.address || '';
  const allWalletAddresses = wallets.map(w => w.address).filter(Boolean);
  const { data: ownedPrincipals, isLoading: ownedPrincipalsLoading } = useAgentsByOwner(address as `0x${string}` | undefined, allWalletAddresses);
  const humanMint = useMemo(
    () => ownedPrincipals?.find(agent => agent.framework === 'human' || agent.mintOrigin === 'HUMAN') || null,
    [ownedPrincipals],
  );
  const tokenIdFromQuery = useMemo(() => {
    const raw = searchParams.get('tokenId') || searchParams.get('id') || '';
    return /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : null;
  }, [searchParams]);
  const walletFromQuery = useMemo(() => {
    const raw = (searchParams.get('wallet') || '').trim();
    return /^0x[a-fA-F0-9]{40}$/.test(raw) ? raw : '';
  }, [searchParams]);
  const publicLookupId = humanMint?.tokenId ?? tokenIdFromQuery ?? (walletFromQuery || null);

  const [currentStep, setCurrentStep] = useState<HumanManageStep>('profile');
  const [loading, setLoading] = useState(true);
  const [human, setHuman] = useState<HumanPrincipal | null>(null);
  const [draft, setDraft] = useState<HumanDraft>(defaultDraft);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(null);
  const [repairMode, setRepairMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!ready && !wallet) return;
      if (ownedPrincipalsLoading) return;

      setLoading(true);
      setStatus(null);

      try {
        if (publicLookupId) {
          const publicRes = await fetch(`${API_URL}/api/v2/human/${encodeURIComponent(String(publicLookupId))}`);
          if (publicRes.ok) {
            const principal = normalizeHumanPrincipal(await publicRes.json());
            if (!mounted) return;
            setHuman(principal);
            setDraft(draftFromHuman(principal));
            setRepairMode(false);
            setLoading(false);
            return;
          }

          const fallbackRes = typeof publicLookupId === 'number'
            ? await fetch(`${API_URL}/api/v2/agent/${publicLookupId}`)
            : null;
          if (fallbackRes?.ok) {
            const fallback = normalizeHumanFallback(await fallbackRes.json());
            if (!mounted) return;
            setHuman(fallback);
            setDraft(draftFromHuman(fallback));
            setRepairMode(true);
            setStatus({ type: 'info', msg: 'Your human token exists, but the richer profile record is missing. Saving here will repair it.' });
            setLoading(false);
            return;
          }
        }

        if (!wallet && !authenticated) {
          if (!mounted) return;
          setHuman(null);
          setDraft(defaultDraft);
          setLoading(false);
          return;
        }

        const accessToken = authenticated ? await getAccessToken().catch(() => null) : null;
        const authHeader = accessToken
          ? `Bearer ${accessToken}`
          : await getHumanAuthHeader({ wallet, authenticated, getAccessToken });
        const meRes = await fetch(`${API_URL}/api/v2/principals/human/me`, {
          headers: { Authorization: authHeader },
        });

        if (meRes.ok) {
          const principal = normalizeHumanPrincipal(await meRes.json());
          if (!mounted) return;
          setHuman(principal);
          setDraft(draftFromHuman(principal));
          setRepairMode(false);
          setLoading(false);
          return;
        }

        if (!mounted) return;
        setHuman(null);
        setDraft(defaultDraft);
      } catch (error: any) {
        if (!mounted) return;
        const rejected = isWalletRejection(error);
        setStatus({
          type: rejected ? 'info' : 'error',
          msg: rejected ? getWalletStatusMessage(error, 'load') : (error?.message || 'Failed to load your human profile.'),
        });
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [ready, authenticated, getAccessToken, humanMint?.tokenId, ownedPrincipalsLoading, publicLookupId, wallet]);

  const currentIndex = stepOrder.indexOf(currentStep);
  const walletAddress = wallet?.address || user?.wallet?.address || human?.walletAddress || '';
  const publicProfilePath = human?.tokenId != null ? `/h/${human.tokenId}` : walletAddress ? `/h/${walletAddress}` : '/h/{profile-id}';
  const ensAvatarUrl = buildEnsAvatarUrl(draft.ens);
  const profilePreview = draft.profileImage.trim() || ensAvatarUrl;
  const profileReady = draft.displayName.trim().length > 0 && draft.timezone.trim().length > 0;
  const publicLinks = [
    draft.website && `Website: ${draft.website}`,
    draft.x && `X: ${draft.x}`,
    draft.github && `GitHub: ${draft.github}`,
    draft.farcaster && `Farcaster: ${draft.farcaster}`,
    draft.ens && `ENS: ${draft.ens}`,
    draft.basename && `Basename: ${draft.basename}`,
    draft.telegram && `Telegram: ${draft.telegram}`,
    draft.gitlawb && `GitLawb: ${draft.gitlawb}`,
    draft.talentProtocol && `Talent Protocol: ${draft.talentProtocol}`,
    draft.ethos && `Ethos: ${draft.ethos}`,
    draft.eas && `EAS: ${draft.eas}`,
  ].filter(Boolean).join(' · ');

  const updateDraft = (patch: Partial<HumanDraft>) => {
    setDraft(prev => ({ ...prev, ...patch }));
    if (status?.type !== 'info') setStatus(null);
  };

  const toggleArrayValue = (field: 'serviceCategories' | 'paymentPreferences' | 'communicationChannels', value: string) => {
    setDraft(prev => {
      const current = prev[field];
      const next = current.includes(value)
        ? current.filter(item => item !== value)
        : [...current, value];
      return { ...prev, [field]: next };
    });
    if (status?.type !== 'info') setStatus(null);
  };

  const nextStep = () => {
    if (currentIndex < stepOrder.length - 1) setCurrentStep(stepOrder[currentIndex + 1]);
  };

  const previousStep = () => {
    if (currentIndex > 0) setCurrentStep(stepOrder[currentIndex - 1]);
  };

  const importEnsAvatar = () => {
    if (!ensAvatarUrl) {
      setStatus({ type: 'error', msg: 'Add a valid ENS name first if you want to import an ENS avatar.' });
      return;
    }
    updateDraft({ profileImage: ensAvatarUrl });
    setStatus({ type: 'info', msg: `Using ENS avatar from ${draft.ens.trim()}.` });
  };

  const handleProfileImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const optimized = await optimizeProfileImage(file);
      updateDraft({ profileImage: optimized });
      setStatus({ type: 'info', msg: `${file.name} is ready as your profile photo.` });
    } catch (error: any) {
      setStatus({ type: 'error', msg: error?.message || 'Could not prepare that profile image.' });
    }
  };

  async function saveProfile() {
    if (!wallet && !authenticated) {
      setStatus({ type: 'error', msg: 'Choose a sign-in method first, then save once the redirect returns.' });
      return;
    }

    const linkedAgentTokenId = parseLinkedAgentTokenId(draft.linkedAgent);
    if (linkedAgentTokenId !== null && !wallet) {
      setStatus({ type: 'error', msg: 'Linking an agent requires wallet authentication. Please connect a wallet or remove the linked agent.' });
      return;
    }

    setIsSubmitting(true);
    setStatus({ type: 'info', msg: repairMode ? 'Repairing your human profile...' : 'Saving your human profile...' });

    try {
      const authHeader = await getHumanAuthHeader({ wallet, authenticated, getAccessToken });
      const authEmail = user?.email?.address?.trim() || '';
      const linkedAccounts = compactObject({
        x: draft.x.replace(/^@/, '').trim(),
        github: draft.github.trim(),
        farcaster: draft.farcaster.trim(),
        telegram: draft.telegram.replace(/^@/, '').trim(),
        gitlawb: draft.gitlawb.trim(),
        ens: draft.ens.trim(),
        basename: draft.basename.trim(),
      });
      const externalIds = compactObject({
        x: draft.x.replace(/^@/, '').trim(),
        github: draft.github.trim(),
        farcaster: draft.farcaster.trim(),
        telegram: draft.telegram.replace(/^@/, '').trim(),
        ens: draft.ens.trim(),
        basename: draft.basename.trim(),
        gitlawb: draft.gitlawb.trim(),
        talentProtocol: draft.talentProtocol.trim(),
        ethos: draft.ethos.trim(),
        eas: draft.eas.trim(),
      });
      const requestedChannels = draft.communicationChannels.filter(channel => ['email', 'telegram', 'web'].includes(channel));
      const availableChannels = requestedChannels.filter(channel => {
        if (channel === 'email') return Boolean(authEmail);
        if (channel === 'telegram') return Boolean(draft.telegram.trim());
        if (channel === 'web') return Boolean(draft.website.trim());
        return false;
      });

      const payload: any = {
        tokenId: human?.tokenId ?? undefined,
        mintOnchain: Boolean(wallet) && !human?.tokenId,
        name: draft.displayName.trim() || human?.name || 'Human',
        description: draft.bio.trim(),
        image: draft.profileImage.trim() || undefined,
        skills: draft.skills,
        domains: human?.domains || [],
        linkedAccounts,
        linkedAgents: linkedAgentTokenId !== null ? [String(linkedAgentTokenId)] : [],
        externalIds,
        services: {
          ...(draft.website.trim() ? { web: { url: draft.website.trim() } } : {}),
          ...(draft.telegram.trim() ? { telegram: { handle: draft.telegram.trim().replace(/^@/, '') } } : {}),
          ...(draft.gitlawb.trim() ? { gitlawb: { url: draft.gitlawb.trim() } } : {}),
          ...(draft.ens.trim() ? { ens: { name: draft.ens.trim() } } : {}),
          ...(draft.talentProtocol.trim() ? { talentProtocol: { url: draft.talentProtocol.trim() } } : {}),
          ...(draft.ethos.trim() ? { ethos: { url: draft.ethos.trim() } } : {}),
          ...(draft.eas.trim() ? { eas: { url: draft.eas.trim() } } : {}),
        },
        contact: {
          ...(authEmail ? { email: authEmail } : {}),
          ...(draft.telegram.trim() ? { telegram: draft.telegram.trim().replace(/^@/, '') } : {}),
        },
        notificationPreferences: {
          channels: availableChannels,
          preferredChannel: availableChannels[0] || null,
          proposalAlerts: true,
          taskAlerts: true,
        },
        metadata: {
          timezone: draft.timezone.trim() || 'UTC',
          region: draft.region.trim(),
          languages: draft.languages,
          openToWork: draft.openToWork,
          acceptedPayments: draft.paymentPreferences,
          serviceCategories: draft.serviceCategories,
          preferredCommunicationChannels: requestedChannels,
          linkedAccounts,
          linkedAgents: linkedAgentTokenId !== null ? [String(linkedAgentTokenId)] : [],
          relationship: draft.relationship,
        },
      };

      const registerRes = await fetch(`${API_URL}/api/v2/principals/human/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify(payload),
      });

      const registerData = await registerRes.json().catch(() => ({}));
      if (!registerRes.ok) throw new Error(registerData?.error || 'Human save failed');

      let principal = registerData?.principal || payload;

      if (linkedAgentTokenId !== null && principal?.id && wallet) {
        const walletAuthHeader = `Bearer ${await buildWalletBearer(wallet)}`;
        const linkRes = await fetch(`${API_URL}/api/v2/human/${encodeURIComponent(String(principal.id))}/link-agent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: walletAuthHeader,
          },
          body: JSON.stringify({ agentTokenId: linkedAgentTokenId, relationship: draft.relationship }),
        });

        if (linkRes.ok) {
          const linkData = await linkRes.json().catch(() => ({}));
          if (linkData?.principal) principal = linkData.principal;
        }
      }

      const normalized = normalizeHumanPrincipal(principal);
      setHuman(normalized);
      setDraft(draftFromHuman(normalized));
      setRepairMode(false);
      setStatus({ type: 'success', msg: registerData?.message || 'Human profile saved.' });
      setCurrentStep('review');
    } catch (error: any) {
      setStatus({
        type: isWalletRejection(error) ? 'info' : 'error',
        msg: isWalletRejection(error) ? getWalletStatusMessage(error, linkedAgentTokenId !== null ? 'link' : 'save') : (error?.message || 'Failed to save human profile.'),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="mint-page">
        <div className="mint-container" style={{ maxWidth: '920px' }}>
          <div style={pageCardStyle}>Loading your human profile...</div>
        </div>
      </div>
    );
  }

  if (!wallet && !authenticated && !humanMint?.tokenId) {
    return (
      <div className="mint-page">
        <div className="mint-container" style={{ maxWidth: '760px' }}>
          <div style={pageCardStyle}>
            <h1 style={{ marginTop: 0, fontSize: '2rem' }}>Manage Human Profile</h1>
            <HumanAuthButtons intro="Sign in first, then I can load or repair your full human profile cleanly. Email and wallet work here now. I removed X from this flow because Privy is rejecting Twitter auth for this app." />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mint-page">
      <div className="mint-container" style={{ maxWidth: '920px' }}>
        <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link to="/manage" style={{ color: '#7f7894', textDecoration: 'none', fontSize: '0.88rem' }}>
            ← Back to manage
          </Link>
          {(human?.tokenId != null || human?.id || human?.walletAddress) && (
            <Link to={publicProfilePath} style={{ color: '#7f7894', textDecoration: 'none', fontSize: '0.88rem' }}>
              Open public profile
            </Link>
          )}
        </div>

        <div style={pageCardStyle}>
          <div style={{ marginBottom: '2rem' }}>
            <div className="section-label">Human Profile Management</div>
            <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', lineHeight: 1.05, marginBottom: '0.75rem' }}>
              Manage your <span className="text-gradient">Human</span> profile
            </h1>
            <p style={{ color: '#9a94af', fontSize: '1rem', maxWidth: '700px', lineHeight: 1.6, marginBottom: '1rem' }}>
              This is the richer human profile flow, not the stripped-down repair page. Bio, skills, service lanes, links, identity surfaces, all of it.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {stepOrder.map((step, index) => (
                <StepPill
                  key={step}
                  label={`${index + 1}. ${humanize(step)}`}
                  active={currentStep === step}
                  complete={index < currentIndex}
                  onClick={() => setCurrentStep(step)}
                />
              ))}
            </div>
          </div>

          {status && (
            <div style={{
              marginBottom: '1rem',
              padding: '1rem 1.1rem',
              borderRadius: '14px',
              background: status.type === 'error' ? 'rgba(255,100,100,0.1)' : status.type === 'success' ? 'rgba(110,236,216,0.1)' : 'rgba(128,208,255,0.1)',
              border: status.type === 'error' ? '1px solid rgba(255,100,100,0.28)' : status.type === 'success' ? '1px solid rgba(110,236,216,0.2)' : '1px solid rgba(128,208,255,0.24)',
              color: status.type === 'error' ? '#ffb0b0' : status.type === 'success' ? '#baf7ea' : '#b8dfff',
            }}>
              {status.msg}
            </div>
          )}

          {repairMode && (
            <div style={{
              marginBottom: '1rem',
              padding: '1rem 1.1rem',
              borderRadius: '14px',
              background: 'rgba(246,199,125,0.08)',
              border: '1px solid rgba(246,199,125,0.18)',
              color: '#f6c77d',
            }}>
              I rebuilt the manage flow, but your current profile record still came from the thin fallback. Saving from here will restore the richer human profile shape.
            </div>
          )}

          {currentStep === 'profile' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={fieldLabelStyle}>Display Name</label>
                  <input value={draft.displayName} onChange={e => updateDraft({ displayName: e.target.value })} placeholder="Quigley" style={inputStyle} />
                </div>
                <div>
                  <label style={fieldLabelStyle}>Timezone</label>
                  <input value={draft.timezone} onChange={e => updateDraft({ timezone: e.target.value })} placeholder="America/Chicago" style={inputStyle} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={fieldLabelStyle}>Region</label>
                  <input value={draft.region} onChange={e => updateDraft({ region: e.target.value })} placeholder="North America" style={inputStyle} />
                </div>
                <div>
                  <label style={fieldLabelStyle}>Languages</label>
                  <input value={toCommaSeparated(draft.languages)} onChange={e => updateDraft({ languages: fromCommaSeparated(e.target.value) })} placeholder="en, fr" style={inputStyle} />
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={fieldLabelStyle}>Short Bio</label>
                <textarea value={draft.bio} onChange={e => updateDraft({ bio: e.target.value })} placeholder="What do you do, what kind of work are you great at, and what should people know about how you operate?" style={textareaStyle} />
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <label style={fieldLabelStyle}>Profile Photo (optional)</label>
                <div style={{ display: 'grid', gridTemplateColumns: '140px minmax(0, 1fr)', gap: '1rem', alignItems: 'start' }}>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    {profilePreview ? (
                      <img src={profilePreview} alt="Profile preview" style={{ width: '120px', height: '120px', borderRadius: '999px', objectFit: 'cover', border: '1px solid rgba(180, 144, 255, 0.35)' }} />
                    ) : (
                      <div style={{ width: '120px', height: '120px', borderRadius: '999px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 700, color: '#f3f0ff', background: 'linear-gradient(135deg, rgba(180,144,255,0.22), rgba(110,236,216,0.22))', border: '1px solid rgba(180, 144, 255, 0.35)' }}>
                        {(draft.displayName || 'H').split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={{ color: '#9a94af', fontSize: '0.92rem', lineHeight: 1.5, marginBottom: '0.85rem' }}>
                      Use a face, logo, or personal brand image. If left blank, we&apos;ll use your ENS avatar when available, or fall back to a simple initials tile.
                    </div>
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleProfileImageUpload} style={{ ...inputStyle, padding: '0.75rem' }} />
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.75rem', marginBottom: '0.75rem' }}>
                      <button type="button" className="btn-hero secondary" onClick={() => updateDraft({ profileImage: '' })}>Clear Photo</button>
                    </div>
                    <input value={draft.profileImage} onChange={e => updateDraft({ profileImage: e.target.value })} placeholder="https://..." style={inputStyle} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
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
                <input value={toCommaSeparated(draft.skills)} onChange={e => updateDraft({ skills: fromCommaSeparated(e.target.value) })} placeholder="product strategy, protocol design, AI consulting" style={inputStyle} />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={fieldLabelStyle}>Service Categories</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                  {serviceCategoryOptions.map(option => (
                    <ToggleChip key={option} label={option} active={draft.serviceCategories.includes(option)} onClick={() => toggleArrayValue('serviceCategories', option)} />
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={fieldLabelStyle}>Accepted Payments</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                  {paymentOptions.map(option => (
                    <ToggleChip key={option} label={option} active={draft.paymentPreferences.includes(option)} onClick={() => toggleArrayValue('paymentPreferences', option)} />
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={fieldLabelStyle}>Preferred Communication Channels</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                  {communicationOptions.map(option => (
                    <ToggleChip key={option} label={option} active={draft.communicationChannels.includes(option)} onClick={() => toggleArrayValue('communicationChannels', option)} />
                  ))}
                </div>
              </div>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.65rem', color: '#d7d2e8', marginBottom: '2rem' }}>
                <input type="checkbox" checked={draft.openToWork} onChange={e => updateDraft({ openToWork: e.target.checked })} />
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
                  <label style={fieldLabelStyle}>Telegram</label>
                  <input value={draft.telegram} onChange={e => updateDraft({ telegram: e.target.value })} placeholder="QuigleyNFT" style={inputStyle} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={fieldLabelStyle}>GitLawb</label>
                  <input value={draft.gitlawb} onChange={e => updateDraft({ gitlawb: e.target.value })} placeholder="https://gitlawb.com/..." style={inputStyle} />
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={fieldLabelStyle}>Talent Protocol (optional)</label>
                  <input value={draft.talentProtocol} onChange={e => updateDraft({ talentProtocol: e.target.value })} placeholder="https://talent.app/..." style={inputStyle} />
                </div>
                <div>
                  <label style={fieldLabelStyle}>Ethos (optional)</label>
                  <input value={draft.ethos} onChange={e => updateDraft({ ethos: e.target.value })} placeholder="https://ethos.network/..." style={inputStyle} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={fieldLabelStyle}>EAS (optional)</label>
                  <input value={draft.eas} onChange={e => updateDraft({ eas: e.target.value })} placeholder="https://easscan.org/..." style={inputStyle} />
                </div>
                <div></div>
              </div>

              <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <button type="button" className="btn-hero secondary" onClick={importEnsAvatar} disabled={!draft.ens.trim()} style={{ opacity: draft.ens.trim() ? 1 : 0.55 }}>
                  Use ENS Avatar
                </button>
                <div style={{ color: '#8d87a1', fontSize: '0.9rem' }}>
                  If your ENS has an avatar, we&apos;ll use it as your human profile photo.
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                <div>
                  <label style={fieldLabelStyle}>Linked Agent (optional)</label>
                  <input value={draft.linkedAgent} onChange={e => updateDraft({ linkedAgent: e.target.value })} placeholder="8453:1" style={inputStyle} />
                </div>
                <div>
                  <label style={fieldLabelStyle}>Relationship</label>
                  <select value={draft.relationship} onChange={e => updateDraft({ relationship: e.target.value as RelationshipType })} style={inputStyle}>
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
              <div style={{ marginBottom: '1.5rem', padding: '1rem 1.1rem', borderRadius: '14px', background: 'rgba(110,236,216,0.08)', border: '1px solid rgba(110,236,216,0.14)', color: '#c5fff3' }}>
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
              <SummaryRow label="Profile Photo" value={draft.profileImage ? (draft.profileImage.startsWith('data:image/') ? 'Uploaded photo ready' : draft.profileImage) : (ensAvatarUrl ? `ENS avatar from ${draft.ens}` : 'Initials fallback')} />
              <SummaryRow label="Linked Agent" value={draft.linkedAgent ? `${draft.linkedAgent} (${humanize(draft.relationship)})` : ''} />
              <SummaryRow label="Open To Work" value={draft.openToWork ? 'Yes' : 'Not right now'} />

              <div style={{ marginBottom: '1rem', padding: '1rem 1.1rem', borderRadius: '14px', background: wallet || authenticated ? 'rgba(180,144,255,0.08)' : 'rgba(255,255,255,0.03)', border: wallet || authenticated ? '1px solid rgba(180,144,255,0.16)' : '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ color: '#f3f0ff', fontWeight: 600, marginBottom: '0.35rem' }}>
                  {wallet || authenticated ? 'Signed in and ready to save' : 'Sign in required to save'}
                </div>
                <div style={{ color: '#9a94af', lineHeight: 1.5, fontSize: '0.92rem' }}>
                  {wallet || authenticated
                    ? (user?.email?.address || walletAddress || 'Your connected identity will be used to save this profile.')
                    : 'Privy can sign in with email, social, or wallet. Human wallet auth uses SIWE, not agent auth.'}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1.5rem' }}>
                <button type="button" className="btn-hero secondary" onClick={previousStep}>Back</button>
                <button type="button" className="btn-hero primary" onClick={saveProfile} disabled={isSubmitting || !profileReady} style={{ opacity: isSubmitting || !profileReady ? 0.6 : 1 }}>
                  {isSubmitting ? 'Saving...' : repairMode ? 'Repair and Save Human Profile' : 'Save Human Profile'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
