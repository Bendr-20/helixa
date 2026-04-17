import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CredBadge } from '../components/CredBadge';
import { XLogo, GitHubLogo, FarcasterLogo } from '../components/Icons';
import { useHuman } from '../hooks/useAgents';
import { EXPLORER_URL } from '../lib/constants';

function humanize(value: string) {
  return value
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDate(value?: string) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function buildEnsAvatarUrl(name?: string) {
  const normalized = (name || '').trim().toLowerCase();
  if (!normalized || !normalized.endsWith('.eth')) return '';
  return `https://metadata.ens.domains/mainnet/avatar/${encodeURIComponent(normalized)}`;
}

function normalizeHandle(value: string) {
  return value.replace(/^@/, '').trim();
}

function buildTelegramUrl(handle?: string) {
  const normalized = normalizeHandle(handle || '');
  return normalized ? `https://t.me/${normalized}` : '';
}

function renderLinkedAccount(key: string, value: string) {
  const normalized = normalizeHandle(value);
  const actionStyle = { maxWidth: '100%', justifyContent: 'flex-start' as const, ...wrapAnywhereStyle };

  if (key === 'x') {
    return (
      <a href={`https://x.com/${normalized}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost text-sm" style={actionStyle}>
        <XLogo className="w-4 h-4" /> @{normalized}
      </a>
    );
  }

  if (key === 'github') {
    return (
      <a href={`https://github.com/${normalized}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost text-sm" style={actionStyle}>
        <GitHubLogo className="w-4 h-4" /> {normalized}
      </a>
    );
  }

  if (key === 'farcaster') {
    return (
      <a href={`https://warpcast.com/${normalized}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost text-sm" style={actionStyle}>
        <FarcasterLogo className="w-4 h-4" /> {normalized}
      </a>
    );
  }

  if (key === 'telegram') {
    return (
      <a href={buildTelegramUrl(normalized)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost text-sm" style={actionStyle}>
        Telegram: @{normalized}
      </a>
    );
  }

  if (key === 'ens' || key === 'basename') {
    return <span className="badge" style={wrapAnywhereStyle}>{value}</span>;
  }

  return <span className="badge" style={wrapAnywhereStyle}>{humanize(key)}: {value}</span>;
}

function buildExternalLink(label: string, url?: string) {
  if (!url) return null;
  return { label, url };
}

const wrapAnywhereStyle = {
  overflowWrap: 'anywhere' as const,
  wordBreak: 'break-word' as const,
};

const sectionTitleStyle = {
  fontSize: 'clamp(1.65rem, 6vw, 2.6rem)',
  lineHeight: 1,
  letterSpacing: '-0.03em',
};

export function HumanProfile() {
  const { id } = useParams<{ id: string }>();
  const { data: human, isLoading, error } = useHuman(id);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [human?.image, human?.linkedAccounts?.ens, human?.externalIds?.ens, human?.services?.ens?.name]);

  if (isLoading) {
    return (
      <div className="py-8">
        <div className="container">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-3 gap-8">
            <div className="card text-center">
              <div className="w-32 h-32 rounded-full bg-gray-700/70 mx-auto mb-4 skeleton"></div>
              <div className="h-6 bg-gray-700 rounded w-40 mx-auto mb-2 skeleton"></div>
              <div className="h-4 bg-gray-700 rounded w-24 mx-auto skeleton"></div>
            </div>
            <div className="lg:col-span-2 space-y-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="card">
                  <div className="h-6 bg-gray-700 rounded w-48 mb-4 skeleton"></div>
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-700 rounded w-full skeleton"></div>
                    <div className="h-4 bg-gray-700 rounded w-3/4 skeleton"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !human) {
    return (
      <div className="py-8">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center">
            <div className="card bg-red-900/20 border-red-700 py-12">
              <h3 className="text-lg font-semibold text-red-400 mb-2">Human Profile Not Found</h3>
              <p className="text-red-300 mb-6">That human principal does not exist or could not be loaded.</p>
              <Link to="/join/human" className="btn btn-secondary">Create Human Profile</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const tierLabel = typeof human.humanCred?.tier === 'string'
    ? human.humanCred.tier
    : human.humanCred?.tier?.tier || human.humanCred?.tier?.label || 'Unscored';
  const linkedAccounts = Object.entries(human.linkedAccounts || {}).filter(([, value]) => Boolean(value));
  const preferredChannels = human.metadata?.preferredCommunicationChannels || human.contact?.channels || [];
  const acceptedPayments = human.metadata?.acceptedPayments || [];
  const serviceCategories = human.metadata?.serviceCategories || [];
  const linkedAgents = (human.linkedAgents || []).map(value => {
    const match = String(value).match(/(\d+)$/);
    return match ? match[1] : String(value);
  });
  const initials = (human.name || 'H')
    .split(' ')
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const ensAvatar = buildEnsAvatarUrl(
    human.linkedAccounts?.ens || human.externalIds?.ens || human.services?.ens?.name
  );
  const resolvedAvatar = avatarLoadFailed ? '' : (human.image || ensAvatar);
  const externalProofLinks = [
    buildExternalLink('Talent Protocol', human.services?.talentProtocol?.url || human.externalIds?.talentProtocol),
    buildExternalLink('Ethos', human.services?.ethos?.url || human.externalIds?.ethos),
    buildExternalLink('EAS', human.services?.eas?.url || human.externalIds?.eas),
  ].filter(Boolean) as Array<{ label: string; url: string }>;
  const manageHref = human.tokenId != null ? `/manage/human?tokenId=${human.tokenId}` : '/manage/human';
  const telegramHandle = human.services?.telegram?.handle ? normalizeHandle(String(human.services.telegram.handle)) : '';

  return (
    <div className="py-8">
      <div className="container">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6 grid gap-3 sm:flex sm:flex-wrap">
            <Link to="/" className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
              Back Home
            </Link>
            <Link to={manageHref} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
              Manage Profile
            </Link>
          </div>

          <div className="grid lg:grid-cols-3 gap-6 lg:gap-8 items-start">
            <div className="lg:col-span-1 min-w-0">
              <div className="card text-center lg:sticky lg:top-24 overflow-hidden">
                <div className="mb-6 flex justify-center">
                  {resolvedAvatar ? (
                    <img
                      src={resolvedAvatar}
                      alt={human.name}
                      className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover border"
                      style={{ borderColor: 'rgba(180, 144, 255, 0.35)' }}
                      onError={() => setAvatarLoadFailed(true)}
                    />
                  ) : (
                    <div
                      className="w-24 h-24 md:w-32 md:h-32 rounded-full flex items-center justify-center text-2xl md:text-3xl font-bold"
                      style={{
                        background: 'linear-gradient(135deg, rgba(180,144,255,0.22), rgba(110,236,216,0.22))',
                        border: '1px solid rgba(180, 144, 255, 0.35)',
                      }}
                    >
                      {initials}
                    </div>
                  )}
                </div>

                <h1 className="font-heading font-bold mb-1" style={{ fontSize: 'clamp(2rem, 9vw, 3.5rem)', lineHeight: 0.95, ...wrapAnywhereStyle }}>
                  {human.name}
                </h1>
                {human.organization && <p className="text-accent-cyan mb-1">{human.organization}</p>}
                <p className="text-muted mb-4">{human.tokenId != null ? `Human #${human.tokenId}` : 'Offchain human principal'}</p>

                <div className="mb-6 flex justify-center">
                  <CredBadge score={human.humanCred?.score || 0} size="lg" />
                </div>

                <div className="glass-card p-4 text-left mb-4">
                  <div className="text-muted text-xs mb-2 uppercase tracking-wider">Human Cred</div>
                  <div className="text-lg font-semibold mb-1">{tierLabel}</div>
                  <div className="text-sm text-muted">Score {human.humanCred?.score || 0}/100</div>
                </div>

                <div className="glass-card p-4 text-left mb-4 overflow-hidden">
                  <div className="text-muted text-xs mb-2 uppercase tracking-wider">Profile</div>
                  <div className="text-sm mb-2"><span className="text-muted">Timezone:</span> {human.metadata?.timezone || 'Not set'}</div>
                  <div className="text-sm mb-2"><span className="text-muted">Region:</span> {human.metadata?.region || 'Not set'}</div>
                  <div className="text-sm"><span className="text-muted">Open to work:</span> {human.metadata?.openToWork === false ? 'No' : 'Yes'}</div>
                </div>

                <div className="glass-card p-4 text-left overflow-hidden">
                  <div className="text-muted text-xs mb-2 uppercase tracking-wider">Identity</div>
                  <div className="text-sm mb-2" style={wrapAnywhereStyle}><span className="text-muted">Wallet:</span> <code>{human.walletAddress.slice(0, 6)}...{human.walletAddress.slice(-4)}</code></div>
                  <div className="text-sm mb-2"><span className="text-muted">Created:</span> {formatDate(human.createdAt)}</div>
                  <div className="text-sm"><span className="text-muted">Updated:</span> {formatDate(human.updatedAt)}</div>
                </div>

                <a
                  href={`${EXPLORER_URL}/address/${human.walletAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost text-xs mt-4 w-full"
                  style={{ minHeight: '44px', textAlign: 'center' }}
                >
                  View Wallet on BaseScan
                </a>
              </div>
            </div>

            <div className="lg:col-span-2 min-w-0 space-y-5 md:space-y-6">
              <div className="card overflow-hidden">
                <h2 className="font-heading font-semibold mb-4" style={sectionTitleStyle}>About</h2>
                <p className="text-muted leading-7 whitespace-pre-wrap" style={wrapAnywhereStyle}>{human.description || 'No bio added yet.'}</p>
              </div>

              <div className="card overflow-hidden">
                <h2 className="font-heading font-semibold mb-4" style={sectionTitleStyle}>Work Profile</h2>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <div className="text-muted text-sm mb-2">Skills</div>
                    <div className="flex flex-wrap gap-2 min-w-0">
                      {(human.skills || []).length > 0 ? human.skills.map(skill => (
                        <span key={skill} className="badge">{skill}</span>
                      )) : <span className="text-muted text-sm">No skills added yet.</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted text-sm mb-2">Service Categories</div>
                    <div className="flex flex-wrap gap-2 min-w-0">
                      {serviceCategories.length > 0 ? serviceCategories.map((item: string) => (
                        <span key={item} className="badge">{humanize(item)}</span>
                      )) : <span className="text-muted text-sm">No categories added yet.</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted text-sm mb-2">Languages</div>
                    <div className="flex flex-wrap gap-2 min-w-0">
                      {(human.metadata?.languages || []).length > 0 ? human.metadata.languages.map((item: string) => (
                        <span key={item} className="badge">{item}</span>
                      )) : <span className="text-muted text-sm">No languages added yet.</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted text-sm mb-2">Accepted Payments</div>
                    <div className="flex flex-wrap gap-2 min-w-0">
                      {acceptedPayments.length > 0 ? acceptedPayments.map((item: string) => (
                        <span key={item} className="badge">{humanize(item)}</span>
                      )) : <span className="text-muted text-sm">No payment preferences added yet.</span>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="card overflow-hidden">
                <h2 className="font-heading font-semibold mb-4" style={sectionTitleStyle}>Links & Presence</h2>
                <div className="flex flex-wrap gap-3 mb-4 min-w-0">
                  {linkedAccounts.length > 0 ? linkedAccounts.map(([key, value]) => (
                    <div key={key} style={{ maxWidth: '100%' }}>{renderLinkedAccount(key, value)}</div>
                  )) : <span className="text-muted text-sm">No linked accounts added yet.</span>}
                </div>
                <div className="grid gap-3 sm:flex sm:flex-wrap min-w-0">
                  {human.services?.web?.url && (
                    <a href={human.services.web.url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary text-sm" style={{ width: '100%', justifyContent: 'center' }}>
                      Visit Website
                    </a>
                  )}
                  {externalProofLinks.map(link => (
                    <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost text-sm" style={{ width: '100%', justifyContent: 'center' }}>
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>

              <div className="card overflow-hidden">
                <h2 className="font-heading font-semibold mb-4" style={sectionTitleStyle}>Contact & Availability</h2>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <div className="text-muted text-sm mb-2">Preferred Channels</div>
                    <div className="flex flex-wrap gap-2 min-w-0">
                      {preferredChannels.length > 0 ? preferredChannels.map((item: string) => (
                        <span key={item} className="badge">{humanize(item)}</span>
                      )) : <span className="text-muted text-sm">No preferred channels set.</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted text-sm mb-2">Public Services</div>
                    <div className="space-y-2 text-sm" style={wrapAnywhereStyle}>
                      {human.services?.email?.address && <div style={wrapAnywhereStyle}>Email: {human.services.email.address}</div>}
                      {telegramHandle && (
                        <div style={wrapAnywhereStyle}>
                          Telegram:{' '}
                          <a href={buildTelegramUrl(telegramHandle)} target="_blank" rel="noopener noreferrer" className="text-accent-cyan" style={wrapAnywhereStyle}>
                            @{telegramHandle}
                          </a>
                        </div>
                      )}
                      {human.services?.web?.url && (
                        <div style={wrapAnywhereStyle}>
                          Web:{' '}
                          <a href={human.services.web.url} target="_blank" rel="noopener noreferrer" className="text-accent-cyan" style={wrapAnywhereStyle}>
                            {human.services.web.url}
                          </a>
                        </div>
                      )}
                      {!human.services?.email?.address && !human.services?.telegram?.handle && !human.services?.web?.url && (
                        <div className="text-muted">No public services listed.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="card overflow-hidden">
                <h2 className="font-heading font-semibold mb-4" style={sectionTitleStyle}>Connected Agents</h2>
                <div className="grid gap-3 sm:flex sm:flex-wrap min-w-0">
                  {linkedAgents.length > 0 ? linkedAgents.map(agentId => (
                    <Link key={agentId} to={`/agent/${agentId}`} className="btn btn-ghost text-sm" style={{ width: '100%', justifyContent: 'center' }}>
                      Agent #{agentId}
                    </Link>
                  )) : <span className="text-muted text-sm">No linked agents yet.</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
