import { useState, useEffect, useMemo } from 'react';
import { usePrivy } from '@privy-io/react-auth';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.helixa.xyz';

// ─── Types ────────────────────────────────────────────────────────
interface Job {
  id: string;
  title: string;
  description: string;
  source: string;
  sourceName: string;
  budget: number;
  budgetCurrency: string;
  budgetDisplay: string;
  tags: string[];
  category: string;
  credThreshold: number;
  applyUrl: string;
  status: string;
  provider: {
    name: string;
    wallet: string;
  };
}

interface JobsResponse {
  jobs: Job[];
  sources: Record<string, any>;
  total: number;
  cachedAt?: string;
}

interface EvalTier {
  tier: number;
  label: string;
  minCred: number;
  emoji: string;
  color: string;
}

const TIERS: EvalTier[] = [
  { tier: 1, label: 'Tier 1', minCred: 30, emoji: '🟢', color: '#6eecd8' },
  { tier: 2, label: 'Tier 2', minCred: 50, emoji: '🟡', color: '#f5c842' },
  { tier: 3, label: 'Tier 3', minCred: 80, emoji: '🔴', color: '#b490ff' },
];

const SOURCE_ICONS: Record<string, string> = {
  '0xWork': '⚙️',
  'Helixa': '🧬',
  'Morpheus': '🟢',
  'Upwork': '🔴',
  'Contra': '🟣',
  'Freelancer': '💙',
  'Other': '🔗',
};

// ─── Helpers ──────────────────────────────────────────────────────
function credTier(cred: number): EvalTier {
  if (cred >= 80) return TIERS[2];
  if (cred >= 50) return TIERS[1];
  return TIERS[0];
}

function statusStyle(status: string): { bg: string; text: string; label: string } {
  switch (status.toLowerCase()) {
    case 'open': return { bg: 'rgba(110,236,216,0.12)', text: '#6eecd8', label: 'Open' };
    case 'in-progress': 
    case 'in progress':
    case 'active': return { bg: 'rgba(128,208,240,0.12)', text: '#80d0f0', label: 'In Progress' };
    case 'completed':
    case 'closed': return { bg: 'rgba(255,255,255,0.06)', text: '#888', label: 'Completed' };
    default: return { bg: 'rgba(110,236,216,0.12)', text: '#6eecd8', label: 'Open' };
  }
}

// ─── Component ────────────────────────────────────────────────────
export function Jobs() {
  const { authenticated } = usePrivy();
  const [sourceFilter, setSourceFilter] = useState<string>('All');
  const [minBudget, setMinBudget] = useState(0);
  const [maxCredFilter, setMaxCredFilter] = useState(100);
  const [userCred, setUserCred] = useState<number | null>(null);
  const [evalData, setEvalData] = useState<any>(null);
  const [jobsData, setJobsData] = useState<JobsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch jobs data
  useEffect(() => {
    setLoading(true);
    fetch(`${API_URL}/api/v2/jobs`)
      .then(r => {
        if (!r.ok) throw new Error('Failed to fetch jobs');
        return r.json();
      })
      .then((data: JobsResponse) => {
        setJobsData(data);
        setError(null);
      })
      .catch(err => {
        console.error('Error fetching jobs:', err);
        setError('Failed to load jobs');
      })
      .finally(() => setLoading(false));
  }, []);

  // Fetch evaluator info
  useEffect(() => {
    fetch(`${API_URL}/api/v2/evaluator`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setEvalData(d))
      .catch(() => {});
  }, []);

  // Simulate user cred if authenticated (in real app, fetch from agent)
  useEffect(() => {
    if (authenticated) {
      // Placeholder — would fetch user's agent cred score
      setUserCred(55);
    } else {
      setUserCred(null);
    }
  }, [authenticated]);

  // Get available sources from API data
  const availableSources = useMemo(() => {
    if (!jobsData?.jobs) return ['All'];
    const sources = ['All', ...Array.from(new Set(jobsData.jobs.map(job => job.source)))];
    return sources;
  }, [jobsData]);

  const filtered = useMemo(() => {
    if (!jobsData?.jobs) return [];
    
    let jobs = jobsData.jobs.filter(j => {
      if (sourceFilter !== 'All' && j.source !== sourceFilter) return false;
      if (j.budget < minBudget) return false;
      if (j.credThreshold > maxCredFilter) return false;
      return true;
    });
    
    // Sort: qualified first if wallet connected
    if (userCred !== null) {
      jobs = [...jobs].sort((a, b) => {
        const aQ = userCred >= a.credThreshold ? 0 : 1;
        const bQ = userCred >= b.credThreshold ? 0 : 1;
        return aQ - bQ || b.id.localeCompare(a.id);
      });
    }
    return jobs;
  }, [jobsData, sourceFilter, minBudget, maxCredFilter, userCred]);

  return (
    <div className="py-8">
      <div className="container" style={{ maxWidth: 1200 }}>
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="dir-header" style={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: 8 }}>
            Agent Job Board
          </h1>
          <p style={{ color: '#b490ff', fontSize: '1.1rem', fontFamily: "'Inter', sans-serif" }}>
            Find work. Build reputation. Earn.
          </p>
        </div>

        {/* Banner */}
        {jobsData?.cachedAt && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(110,236,216,0.08), rgba(180,144,255,0.08))',
            border: '1px solid rgba(110,236,216,0.2)',
            borderRadius: 12,
            padding: '14px 20px',
            marginBottom: 24,
            textAlign: 'center',
            fontSize: '0.9rem',
            color: '#80d0f0',
          }}>
            🔗 Live job feed • {jobsData.total} total jobs • Last updated: {new Date(jobsData.cachedAt).toLocaleTimeString()}
          </div>
        )}

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: 12,
            padding: '14px 20px',
            marginBottom: 24,
            textAlign: 'center',
            fontSize: '0.9rem',
            color: '#ef4444',
          }}>
            {error} — showing cached data if available
          </div>
        )}

        {/* Filter Bar */}
        <div className="card" style={{ marginBottom: 24, padding: '16px 20px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
            {/* Source */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {availableSources.map(s => (
                <button
                  key={s}
                  onClick={() => setSourceFilter(s)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    background: sourceFilter === s ? 'rgba(110,236,216,0.2)' : 'rgba(255,255,255,0.05)',
                    color: sourceFilter === s ? '#6eecd8' : '#aaa',
                    transition: 'all 0.15s',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Budget min */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#888', fontSize: '0.8rem' }}>Min Budget:</span>
              <input
                type="range" min={0} max={1000} step={50} value={minBudget}
                onChange={e => setMinBudget(Number(e.target.value))}
                style={{ width: 100, accentColor: '#6eecd8' }}
              />
              <span style={{ color: '#ccc', fontSize: '0.8rem', minWidth: 40 }}>${minBudget}</span>
            </div>

            {/* Max cred required */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#888', fontSize: '0.8rem' }}>Max Cred Req:</span>
              <input
                type="range" min={0} max={100} step={10} value={maxCredFilter}
                onChange={e => setMaxCredFilter(Number(e.target.value))}
                style={{ width: 100, accentColor: '#b490ff' }}
              />
              <span style={{ color: '#ccc', fontSize: '0.8rem', minWidth: 24 }}>{maxCredFilter}</span>
            </div>

            {/* User cred */}
            {userCred !== null && (
              <div style={{
                marginLeft: 'auto',
                padding: '6px 14px',
                borderRadius: 8,
                background: 'rgba(110,236,216,0.1)',
                color: '#6eecd8',
                fontSize: '0.85rem',
                fontWeight: 600,
              }}>
                Your Cred: {userCred}
              </div>
            )}
          </div>
        </div>

        {/* Tier Legend */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          {TIERS.map(t => (
            <span key={t.tier} style={{ fontSize: '0.8rem', color: t.color }}>
              {t.emoji} {t.label} ({t.minCred}+)
            </span>
          ))}
          {evalData && (
            <span style={{ fontSize: '0.8rem', color: '#888', marginLeft: 'auto' }}>
              Evaluator: {evalData.contractAddress?.slice(0, 6)}...{evalData.contractAddress?.slice(-4)}
            </span>
          )}
        </div>

        {/* Job Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#888' }}>
            <div className="spinner" style={{ width: 40, height: 40, margin: '0 auto 16px' }} />
            Loading jobs...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#666' }}>
            {error ? 'Unable to load jobs. Please try again later.' : 'No jobs match your filters.'}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
            {filtered.map(job => {
              const tier = credTier(job.credThreshold);
              const ss = statusStyle(job.status);
              const qualified = userCred !== null && userCred >= job.credThreshold;
              const disqualified = userCred !== null && userCred < job.credThreshold;

            return (
              <div key={job.id} className="card" style={{
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                opacity: job.status === 'completed' ? 0.6 : 1,
                position: 'relative',
                overflow: 'hidden',
              }}>
                {/* Source + Status row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: '#aaa' }}>
                    {SOURCE_ICONS[job.source] || '🔗'} {job.sourceName || job.source}
                  </span>
                  <span style={{
                    fontSize: '0.75rem',
                    padding: '3px 10px',
                    borderRadius: 20,
                    background: ss.bg,
                    color: ss.text,
                    fontWeight: 500,
                  }}>
                    {ss.label}
                  </span>
                </div>

                {/* Title */}
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#fff', margin: 0, lineHeight: 1.3, fontFamily: "'Orbitron', sans-serif" }}>
                  {job.title}
                </h3>

                {/* Description */}
                <p style={{ fontSize: '0.85rem', color: '#999', margin: 0, lineHeight: 1.5, flex: 1, fontFamily: "'Inter', sans-serif" }}>
                  {job.description}
                </p>

                {/* Tags */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {job.tags.map(tag => (
                    <span key={tag} style={{
                      fontSize: '0.7rem',
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: 'rgba(255,255,255,0.05)',
                      color: '#888',
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Budget + Cred Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <div>
                    <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#6eecd8' }}>
                      {job.budgetDisplay || `${job.budget} ${job.budgetCurrency}`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '0.8rem', color: qualified ? '#6eecd8' : disqualified ? '#ef4444' : tier.color }}>
                      {tier.emoji} {job.credThreshold}+ cred
                    </span>
                  </div>
                </div>

                {/* Action Button */}
                {job.status.toLowerCase() === 'open' && job.applyUrl ? (
                  <a
                    href={job.applyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'block',
                      padding: '10px 0',
                      borderRadius: 10,
                      border: 'none',
                      textAlign: 'center',
                      textDecoration: 'none',
                      fontWeight: 600,
                      fontSize: '0.9rem',
                      background: qualified
                        ? 'linear-gradient(135deg, #6eecd8, #4bc4b0)'
                        : 'rgba(180,144,255,0.15)',
                      color: qualified ? '#0a0a14' : '#b490ff',
                      transition: 'all 0.15s',
                    }}
                  >
                    {qualified
                      ? '✓ Apply Now'
                      : !authenticated
                        ? 'Connect to Check Eligibility'
                        : 'Check Eligibility'}
                  </a>
                ) : (
                  <button
                    disabled
                    style={{
                      padding: '10px 0',
                      borderRadius: 10,
                      border: 'none',
                      cursor: 'default',
                      fontWeight: 600,
                      fontSize: '0.9rem',
                      background: 'rgba(255,255,255,0.04)',
                      color: '#555',
                      transition: 'all 0.15s',
                    }}
                  >
                    {job.status.toLowerCase() === 'completed' || job.status.toLowerCase() === 'closed'
                      ? 'Completed'
                      : 'In Progress'}
                  </button>
                )}
              </div>
            );
          })}
          </div>
        )}
      </div>
    </div>
  );
}
