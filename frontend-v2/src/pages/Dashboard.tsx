import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { usePrivy } from '@privy-io/react-auth';
import { AgentCard } from '../components/AgentCard';
import { useTopAgents } from '../hooks/useAgents';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.helixa.xyz';

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-50px' as const },
  transition: { duration: 0.5, ease: 'easeOut' as const },
};

interface ProtocolStats {
  totalAgents: number;
  totalStakedCred: number;
  totalCredScore: number;
  activeJobs: number;
  credScoresIssued: number;
}

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

interface UserAgent {
  id: string;
  name: string;
  credScore: number;
  jobsCompleted: number;
  totalEarnings: string;
  framework: string;
}

const SOURCE_ICONS: Record<string, string> = {
  '0xWork': '⚙️',
  'Helixa': '🧬',
  'Morpheus': '🟢',
  'Upwork': '🔴',
  'Contra': '🟣',
  'Other': '🔗',
};

export function Dashboard() {
  const { authenticated, user } = usePrivy();
  const [protocolStats, setProtocolStats] = useState<ProtocolStats | null>(null);
  const [userAgent, setUserAgent] = useState<UserAgent | null>(null);
  const [topJobs, setTopJobs] = useState<Job[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [jobsLoading, setJobsLoading] = useState(true);
  const { data: topAgents, isLoading: agentsLoading } = useTopAgents(10);

  // Fetch protocol stats
  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/v2/stats`).then(r => r.ok ? r.json() : null),
      fetch(`${API_URL}/api/v2/jobs`).then(r => r.ok ? r.json() : null)
    ])
      .then(([statsData, jobsData]) => {
        if (statsData) {
          setProtocolStats({
            totalAgents: statsData.totalAgents || 0,
            totalStakedCred: statsData.totalStakedCred || 0,
            totalCredScore: statsData.totalCredScore || 0,
            activeJobs: jobsData?.jobs?.filter((j: Job) => j.status === 'open')?.length || 0,
            credScoresIssued: statsData.credScoresIssued || statsData.totalAgents || 0,
          });
        }
        setStatsLoading(false);
      })
      .catch(() => setStatsLoading(false));
  }, []);

  // Fetch top jobs for user
  useEffect(() => {
    fetch(`${API_URL}/api/v2/jobs`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.jobs) {
          // Filter for open jobs and take top 5
          const openJobs = data.jobs
            .filter((job: Job) => job.status === 'open')
            .slice(0, 5);
          setTopJobs(openJobs);
        }
        setJobsLoading(false);
      })
      .catch(() => setJobsLoading(false));
  }, []);

  // Mock user agent data if authenticated
  useEffect(() => {
    if (authenticated && user) {
      // In a real app, fetch user's agent data here
      setUserAgent({
        id: '1',
        name: 'My Agent',
        credScore: 65,
        jobsCompleted: 3,
        totalEarnings: '$450 USDC',
        framework: 'eliza'
      });
    } else {
      setUserAgent(null);
    }
  }, [authenticated, user]);

  const filteredJobs = useMemo(() => {
    if (!userAgent) return topJobs;
    
    // Filter jobs based on user's cred tier
    return topJobs.filter(job => job.credThreshold <= userAgent.credScore);
  }, [topJobs, userAgent]);

  return (
    <div className="py-8">
      <div className="container" style={{ maxWidth: 1200 }}>
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="dir-header" style={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: 8 }}>
            Protocol Dashboard
          </h1>
          <p style={{ color: '#b490ff', fontSize: '1.1rem' }}>
            Your gateway to the Helixa ecosystem
          </p>
        </div>

        {/* Protocol Stats Row */}
        <motion.div
          className="stats-bar"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          style={{ marginBottom: 32 }}
        >
          {[
            { val: statsLoading ? '—' : protocolStats?.totalAgents?.toLocaleString() || '0', label: 'Total Agents', cls: 'purple' },
            { val: statsLoading ? '—' : protocolStats?.totalStakedCred?.toLocaleString() || '0', label: 'Total Staked CRED', cls: 'mint' },
            { val: statsLoading ? '—' : protocolStats?.activeJobs?.toLocaleString() || '0', label: 'Active Jobs', cls: 'blue' },
            { val: statsLoading ? '—' : protocolStats?.credScoresIssued?.toLocaleString() || '0', label: 'Cred Scores Issued', cls: 'gold' },
          ].map((s, i) => (
            <motion.div
              key={i}
              className="stat"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <div className={`num ${s.cls}`}>{s.val}</div>
              <div className="lbl">{s.label}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Main Content Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: authenticated ? '1fr 1fr' : '1fr', gap: 24, marginBottom: 32 }}>
          
          {/* My Agent Card - only show if authenticated */}
          {authenticated && userAgent && (
            <motion.div {...fadeUp} className="card" style={{ padding: 24 }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 600, color: '#fff', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1.2rem' }}>🤖</span> My Agent
              </h2>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                <div style={{
                  width: 60,
                  height: 60,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #6eecd8, #b490ff)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: '#0a0a14'
                }}>
                  {userAgent.name.charAt(0)}
                </div>
                <div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff' }}>{userAgent.name}</div>
                  <div style={{ fontSize: '0.9rem', color: '#888' }}>{userAgent.framework} • Cred Score: {userAgent.credScore}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#6eecd8' }}>{userAgent.jobsCompleted}</div>
                  <div style={{ fontSize: '0.8rem', color: '#888' }}>Jobs Completed</div>
                </div>
                <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#b490ff' }}>{userAgent.totalEarnings}</div>
                  <div style={{ fontSize: '0.8rem', color: '#888' }}>Total Earned</div>
                </div>
              </div>

              <Link 
                to="/manage"
                style={{
                  display: 'block',
                  textAlign: 'center',
                  padding: '10px',
                  background: 'rgba(110,236,216,0.1)',
                  border: '1px solid rgba(110,236,216,0.3)',
                  borderRadius: 8,
                  color: '#6eecd8',
                  textDecoration: 'none',
                  fontWeight: 600,
                  fontSize: '0.9rem'
                }}
              >
                Manage Agent →
              </Link>
            </motion.div>
          )}

          {/* Top Jobs For You */}
          <motion.div {...fadeUp} className="card" style={{ padding: 24 }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 600, color: '#fff', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.2rem' }}>💼</span> 
              {authenticated ? 'Top Jobs For You' : 'Latest Jobs'}
            </h2>
            
            {jobsLoading ? (
              <div style={{ color: '#888', textAlign: 'center', padding: 20 }}>Loading jobs...</div>
            ) : filteredJobs.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {filteredJobs.slice(0, 4).map((job) => (
                  <div key={job.id} style={{
                    padding: 14,
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.06)',
                    transition: 'border-color 0.2s'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#fff', margin: 0, lineHeight: 1.3, flex: 1 }}>
                        {job.title}
                      </h3>
                      <span style={{ fontSize: '0.8rem', color: '#888', marginLeft: 8 }}>
                        {SOURCE_ICONS[job.source] || '🔗'} {job.source}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#6eecd8' }}>
                        {job.budgetDisplay || `${job.budget} ${job.budgetCurrency}`}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: '#b490ff' }}>
                        {job.credThreshold}+ cred
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: '#888', textAlign: 'center', padding: 20 }}>No jobs available</div>
            )}
            
            <Link 
              to="/jobs"
              style={{
                display: 'block',
                textAlign: 'center',
                padding: '10px',
                background: 'rgba(180,144,255,0.1)',
                border: '1px solid rgba(180,144,255,0.3)',
                borderRadius: 8,
                color: '#b490ff',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '0.9rem',
                marginTop: 16
              }}
            >
              Browse All Jobs →
            </Link>
          </motion.div>
        </div>

        {/* Leaderboard Preview */}
        <motion.div {...fadeUp} className="card" style={{ padding: 24, marginBottom: 24 }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 600, color: '#fff', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '1.2rem' }}>🏆</span> Top Agents
          </h2>
          
          {agentsLoading ? (
            <div style={{ color: '#888', textAlign: 'center', padding: 20 }}>Loading agents...</div>
          ) : topAgents && topAgents.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {topAgents.slice(0, 8).map((agent) => (
                <AgentCard key={agent.tokenId} agent={agent} compact />
              ))}
            </div>
          ) : (
            <div style={{ color: '#888', textAlign: 'center', padding: 20 }}>No agents found</div>
          )}
          
          <Link 
            to="/agents"
            style={{
              display: 'block',
              textAlign: 'center',
              padding: '10px',
              background: 'rgba(110,236,216,0.1)',
              border: '1px solid rgba(110,236,216,0.3)',
              borderRadius: 8,
              color: '#6eecd8',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.9rem',
              marginTop: 16
            }}
          >
            View Full Directory →
          </Link>
        </motion.div>

        {/* Quick Actions */}
        <motion.div {...fadeUp} style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 600, color: '#fff', marginBottom: 16, textAlign: 'center' }}>
            Quick Actions
          </h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {[
              { href: '/mint', label: 'Register Agent', icon: '🚀', desc: 'Create your agent identity', color: '#6eecd8' },
              { href: '/jobs', label: 'Browse Jobs', icon: '💼', desc: 'Find work opportunities', color: '#b490ff' },
              { href: '/stake', label: 'Stake CRED', icon: '💎', desc: 'Earn rewards & build rep', color: '#80d0f0' },
              { href: '/agents', label: 'View Directory', icon: '🗂️', desc: 'Explore all agents', color: '#f5c842' },
            ].map((action, i) => (
              <motion.div
                key={action.href}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                whileHover={{ scale: 1.02, y: -2 }}
              >
                <Link 
                  to={action.href}
                  style={{
                    display: 'block',
                    padding: 20,
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${action.color}20`,
                    borderRadius: 12,
                    textDecoration: 'none',
                    textAlign: 'center',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ fontSize: '2rem', marginBottom: 8 }}>{action.icon}</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: action.color, marginBottom: 4 }}>
                    {action.label}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#888' }}>
                    {action.desc}
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}