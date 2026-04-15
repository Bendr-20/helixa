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

function renderLinkedAccount(key: string, value: string) {
  const normalized = value.replace(/^@/, '');

  if (key === 'x') {
    return (
      <a href={`https://x.com/${normalized}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost text-sm">
        <XLogo className="w-4 h-4" /> @{normalized}
      </a>
    );
  }

  if (key === 'github') {
    return (
      <a href={`https://github.com/${normalized}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost text-sm">
        <GitHubLogo className="w-4 h-4" /> {normalized}
      </a>
    );
  }

  if (key === 'farcaster') {
    return (
      <a href={`https://warpcast.com/${normalized}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost text-sm">
        <FarcasterLogo className="w-4 h-4" /> {normalized}
      </a>
    );
  }

  if (key === 'ens' || key === 'basename') {
    return <span className="badge">{value}</span>;
  }

  return <span className="badge">{humanize(key)}: {value}</span>;
}

export function HumanProfile() {
  const { id } = useParams<{ id: string }>();
  const { data: human, isLoading, error } = useHuman(id);

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

  return (
    <div className="py-8">
      <div className="container">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6 flex flex-wrap gap-3">
            <Link to="/" className="btn btn-ghost">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
              Back Home
            </Link>
            <Link to="/join/human" className="btn btn-secondary">Create Human Profile</Link>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <div className="card text-center sticky top-8">
                <div className="mb-6 flex justify-center">
                  {human.image ? (
                    <img
                      src={human.image}
                      alt={human.name}
                      className="w-32 h-32 rounded-full object-cover border"
                      style={{ borderColor: 'rgba(180, 144, 255, 0.35)' }}
                    />
                  ) : (
                    <div
                      className="w-32 h-32 rounded-full flex items-center justify-center text-3xl font-bold"
                      style={{
                        background: 'linear-gradient(135deg, rgba(180,144,255,0.22), rgba(110,236,216,0.22))',
                        border: '1px solid rgba(180, 144, 255, 0.35)',
                      }}
                    >
                      {initials}
                    </div>
                  )}
                </div>

                <h1 className="text-2xl font-heading font-bold mb-1">{human.name}</h1>
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

                <div className="glass-card p-4 text-left mb-4">
                  <div className="text-muted text-xs mb-2 uppercase tracking-wider">Profile</div>
                  <div className="text-sm mb-2"><span className="text-muted">Timezone:</span> {human.metadata?.timezone || 'Not set'}</div>
                  <div className="text-sm mb-2"><span className="text-muted">Region:</span> {human.metadata?.region || 'Not set'}</div>
                  <div className="text-sm"><span className="text-muted">Open to work:</span> {human.metadata?.openToWork === false ? 'No' : 'Yes'}</div>
                </div>

                <div className="glass-card p-4 text-left">
                  <div className="text-muted text-xs mb-2 uppercase tracking-wider">Identity</div>
                  <div className="text-sm mb-2"><span className="text-muted">Wallet:</span> <code>{human.walletAddress.slice(0, 6)}...{human.walletAddress.slice(-4)}</code></div>
                  <div className="text-sm mb-2"><span className="text-muted">Created:</span> {formatDate(human.createdAt)}</div>
                  <div className="text-sm"><span className="text-muted">Updated:</span> {formatDate(human.updatedAt)}</div>
                </div>

                <a
                  href={`${EXPLORER_URL}/address/${human.walletAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost text-xs mt-4 w-full"
                >
                  View Wallet on BaseScan
                </a>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="card">
                <h2 className="text-xl font-semibold mb-4">About</h2>
                <p className="text-muted leading-7 whitespace-pre-wrap">{human.description || 'No bio added yet.'}</p>
              </div>

              <div className="card">
                <h2 className="text-xl font-semibold mb-4">Work Profile</h2>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <div className="text-muted text-sm mb-2">Skills</div>
                    <div className="flex flex-wrap gap-2">
                      {(human.skills || []).length > 0 ? human.skills.map(skill => (
                        <span key={skill} className="badge">{skill}</span>
                      )) : <span className="text-muted text-sm">No skills added yet.</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted text-sm mb-2">Service Categories</div>
                    <div className="flex flex-wrap gap-2">
                      {serviceCategories.length > 0 ? serviceCategories.map((item: string) => (
                        <span key={item} className="badge">{humanize(item)}</span>
                      )) : <span className="text-muted text-sm">No categories added yet.</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted text-sm mb-2">Languages</div>
                    <div className="flex flex-wrap gap-2">
                      {(human.metadata?.languages || []).length > 0 ? human.metadata.languages.map((item: string) => (
                        <span key={item} className="badge">{item}</span>
                      )) : <span className="text-muted text-sm">No languages added yet.</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted text-sm mb-2">Accepted Payments</div>
                    <div className="flex flex-wrap gap-2">
                      {acceptedPayments.length > 0 ? acceptedPayments.map((item: string) => (
                        <span key={item} className="badge">{humanize(item)}</span>
                      )) : <span className="text-muted text-sm">No payment preferences added yet.</span>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="card">
                <h2 className="text-xl font-semibold mb-4">Links & Presence</h2>
                <div className="flex flex-wrap gap-3 mb-4">
                  {linkedAccounts.length > 0 ? linkedAccounts.map(([key, value]) => (
                    <div key={key}>{renderLinkedAccount(key, value)}</div>
                  )) : <span className="text-muted text-sm">No linked accounts added yet.</span>}
                </div>
                {human.services?.web?.url && (
                  <a href={human.services.web.url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary text-sm">
                    Visit Website
                  </a>
                )}
              </div>

              <div className="card">
                <h2 className="text-xl font-semibold mb-4">Contact & Availability</h2>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <div className="text-muted text-sm mb-2">Preferred Channels</div>
                    <div className="flex flex-wrap gap-2">
                      {preferredChannels.length > 0 ? preferredChannels.map((item: string) => (
                        <span key={item} className="badge">{humanize(item)}</span>
                      )) : <span className="text-muted text-sm">No preferred channels set.</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted text-sm mb-2">Public Services</div>
                    <div className="space-y-2 text-sm">
                      {human.services?.email?.address && <div>Email: {human.services.email.address}</div>}
                      {human.services?.telegram?.handle && <div>Telegram: @{String(human.services.telegram.handle).replace(/^@/, '')}</div>}
                      {human.services?.web?.url && <div>Web: {human.services.web.url}</div>}
                      {!human.services?.email?.address && !human.services?.telegram?.handle && !human.services?.web?.url && (
                        <div className="text-muted">No public services listed.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="card">
                <h2 className="text-xl font-semibold mb-4">Connected Agents</h2>
                <div className="flex flex-wrap gap-3">
                  {linkedAgents.length > 0 ? linkedAgents.map(agentId => (
                    <Link key={agentId} to={`/agent/${agentId}`} className="btn btn-ghost text-sm">
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
