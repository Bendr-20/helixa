import { Link, useParams } from 'react-router-dom';
import { useOrganization } from '../hooks/useAgents';

function formatDate(value?: string) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function linkForMember(member: Record<string, any>) {
  if (member?.entityType === 'human') {
    if (member?.sourceHumanTokenId != null) return `/h/${member.sourceHumanTokenId}`;
    if (member?.sourceHumanWallet) return `/h/${member.sourceHumanWallet}`;
  }
  if (member?.entityType === 'agent' && member?.sourceAgentTokenId != null) {
    return `/agent/${member.sourceAgentTokenId}`;
  }
  if (member?.entityType === 'organization' && member?.slug) {
    return `/o/${member.slug}`;
  }
  return '';
}

function renderServiceLink(key: string, value: any) {
  const url = value?.url || value?.href || '';
  if (!url) return null;
  const label = value?.handle ? `${key}: ${value.handle}` : key;
  return (
    <a key={key} href={url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost text-sm" style={{ justifyContent: 'flex-start' }}>
      {label}
    </a>
  );
}

export function OrganizationProfile() {
  const { id } = useParams<{ id: string }>();
  const { data: organization, isLoading, error } = useOrganization(id);

  if (isLoading) {
    return (
      <div className="py-8">
        <div className="container max-w-6xl mx-auto grid lg:grid-cols-3 gap-8">
          <div className="card text-center">
            <div className="w-32 h-32 rounded-3xl bg-gray-700/70 mx-auto mb-4 skeleton"></div>
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
    );
  }

  if (error || !organization) {
    return (
      <div className="py-8">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center">
            <div className="card bg-red-900/20 border-red-700 py-12">
              <h3 className="text-lg font-semibold text-red-400 mb-2">Organization Not Found</h3>
              <p className="text-red-300 mb-6">That organization profile does not exist or could not be loaded.</p>
              <Link to="/" className="btn btn-secondary">Go Home</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const serviceLinks = Object.entries(organization.links || {}).map(([key, value]) => renderServiceLink(key, value)).filter(Boolean);
  const members = organization.members || [];

  return (
    <div className="py-8">
      <div className="container">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <Link to="/" className="btn btn-ghost">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </Link>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <div className="card sticky top-8 text-center">
                <div className="w-28 h-28 rounded-3xl bg-accent-cyan/10 border border-white/10 mx-auto mb-4 flex items-center justify-center text-4xl font-heading">
                  {organization.displayName.slice(0, 2).toUpperCase()}
                </div>
                <h1 className="text-3xl font-heading font-bold mb-1">{organization.displayName}</h1>
                {organization.slug && <p className="text-accent-cyan mb-1">/{organization.slug}</p>}
                <p className="text-muted mb-4">{organization.organizationType || 'organization'}</p>

                <div className="flex flex-wrap gap-2 justify-center mb-4">
                  {(organization.roles || []).map(role => <span key={role} className="badge">{role}</span>)}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="glass-card p-3">
                    <div className="text-lg font-bold text-accent-purple">{organization.relationshipSummary?.teamCount || 0}</div>
                    <div className="text-muted">Members</div>
                  </div>
                  <div className="glass-card p-3">
                    <div className="text-lg font-bold text-accent-cyan">{organization.serviceCategories?.length || 0}</div>
                    <div className="text-muted">Services</div>
                  </div>
                </div>

                <div className="glass-card p-3 mt-4 text-left">
                  <div className="text-muted text-xs mb-1">Status</div>
                  <div>{organization.capacityStatus || 'available'}</div>
                  <div className="text-muted text-xs mt-3 mb-1">Verification</div>
                  <div>{organization.verificationStatus || 'self-asserted'}</div>
                  {organization.walletAddress && (
                    <>
                      <div className="text-muted text-xs mt-3 mb-1">Wallet</div>
                      <code className="text-xs" style={{ overflowWrap: 'anywhere' }}>{organization.walletAddress}</code>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="card">
                <h2 className="text-2xl font-heading font-semibold mb-4">About</h2>
                <p className="text-muted leading-relaxed">{organization.description || 'No description yet.'}</p>
                {organization.metadata?.publicOffer && (
                  <div className="glass-card p-4 mt-4">
                    <div className="text-muted text-xs mb-1">Public offer</div>
                    <div>{organization.metadata.publicOffer}</div>
                  </div>
                )}
              </div>

              <div className="card">
                <h2 className="text-2xl font-heading font-semibold mb-4">Links and services</h2>
                <div className="flex flex-wrap gap-3">
                  {serviceLinks.length ? serviceLinks : <span className="text-muted">No public links yet.</span>}
                </div>
                {(organization.acceptedPayments || []).length > 0 && (
                  <div className="mt-4">
                    <div className="text-muted text-xs mb-2">Accepted payments</div>
                    <div className="flex flex-wrap gap-2">
                      {organization.acceptedPayments.map(method => <span key={method} className="badge">{method}</span>)}
                    </div>
                  </div>
                )}
              </div>

              <div className="card">
                <h2 className="text-2xl font-heading font-semibold mb-4">Members</h2>
                <div className="space-y-3">
                  {members.length ? members.map((member, index) => {
                    const href = linkForMember(member);
                    const body = (
                      <>
                        <div className="font-medium">{member.displayName || member.id || `Member ${index + 1}`}</div>
                        <div className="text-sm text-muted">{member.role || member.entityType || 'member'}</div>
                      </>
                    );
                    return href ? (
                      <Link key={`${member.id || index}`} to={href} className="glass-card p-4 flex items-center justify-between hover:border-accent-cyan/40 transition-colors">
                        {body}
                        <span className="text-accent-cyan text-sm">Open</span>
                      </Link>
                    ) : (
                      <div key={`${member.id || index}`} className="glass-card p-4">
                        {body}
                      </div>
                    );
                  }) : <div className="text-muted">No linked members yet.</div>}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="card">
                  <h3 className="text-xl font-heading font-semibold mb-3">Capabilities</h3>
                  <div className="flex flex-wrap gap-2">
                    {[...(organization.skills || []), ...(organization.serviceCategories || [])].map(value => (
                      <span key={value} className="badge">{value}</span>
                    ))}
                  </div>
                </div>

                <div className="card">
                  <h3 className="text-xl font-heading font-semibold mb-3">Metadata</h3>
                  <div className="space-y-2 text-sm">
                    {organization.metadata?.protocol && <div><span className="text-muted">Protocol:</span> {organization.metadata.protocol}</div>}
                    {organization.metadata?.token && <div><span className="text-muted">Token:</span> {organization.metadata.token}</div>}
                    {(organization.metadata?.products || []).length > 0 && <div><span className="text-muted">Products:</span> {(organization.metadata.products || []).join(', ')}</div>}
                    <div><span className="text-muted">Created:</span> {formatDate(organization.createdAt)}</div>
                    <div><span className="text-muted">Updated:</span> {formatDate(organization.updatedAt)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
