import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Wallet, Trophy, CheckCircle, XCircle, Lock, RefreshCw, Bot, ScrollText, ShieldCheck } from 'lucide-react';
import { XLogo, GitHubLogo, FarcasterLogo } from '../components/Icons';
import { API_URL, EXPLORER_URL } from '../lib/constants';

interface ReportData {
  tokenId: number;
  name: string;
  walletAddress: string;
  owner: string;
  balances: {
    eth: string;
    usdc: string;
    linkedToken: {
      contractAddress: string;
      chain: string;
      symbol: string;
      name: string;
      formatted: string;
      decimals: number;
    } | null;
  };
  recentTransactions: {
    hash: string;
    from: string;
    to: string;
    value: string;
    timestamp: string;
    method: string;
    isError: boolean;
  }[];
  credScore: {
    total: number;
    tier: string;
    verified: boolean;
    hasPersonality: boolean;
    hasNarrative: boolean;
    traitCount: number;
    points: number;
    soulbound: boolean;
  };
  verifications: {
    siwa: boolean;
    x: { verified: boolean; handle?: string };
    github: { verified: boolean; username?: string };
    farcaster: { verified: boolean; username?: string };
  };
  points: number;
  rank: number | null;
  totalAgents: number;
  ethosScore: number | null;
  explorer: string;
}

function useReport(id: string | undefined) {
  return useQuery<ReportData>({
    queryKey: ['agent-report', id],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/v2/agent/${id}/report`);
      if (!res.ok) throw new Error('Failed to fetch report');
      return res.json();
    },
    enabled: !!id,
    staleTime: 30_000,
  });
}

function StatCard({ label, value, color = '#b490ff', sub }: { label: string; value: string | number; color?: string; sub?: string }) {
  return (
    <div className="glass-card p-4 text-center">
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
      <div className="text-sm text-muted">{label}</div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
    </div>
  );
}

export function Report() {
  const { id } = useParams<{ id: string }>();
  const { data: report, isLoading, error } = useReport(id);

  if (isLoading) {
    return (
      <div className="py-8">
        <div className="container max-w-4xl mx-auto">
          <div className="card"><div className="h-6 bg-gray-700 rounded w-48 mb-4 skeleton"></div></div>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="py-8">
        <div className="container max-w-4xl mx-auto text-center">
          <div className="card bg-red-900/20 border-red-700 py-12">
            <h3 className="text-lg font-semibold text-red-400 mb-2">Report Not Available</h3>
            <p className="text-red-300 mb-6">Could not load onchain report for this agent.</p>
            <Link to="/agents" className="btn btn-secondary">Browse Agents</Link>
          </div>
        </div>
      </div>
    );
  }

  const tierColors: Record<string, string> = { AAA: '#ffd700', Prime: '#b490ff', 'Investment Grade': '#6eecd8', Speculative: '#80d0ff', Junk: '#888' };

  return (
    <div className="py-8">
      <div className="container max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link to={`/agent/${report.tokenId}`} className="btn btn-ghost mb-2">
              ← Back to Profile
            </Link>
            <h1 className="text-3xl font-heading font-bold"><BarChart3 className="w-7 h-7 inline-block align-middle mr-2" /> {report.name} — Onchain Report</h1>
            <p className="text-muted mt-1">Token #{report.tokenId}</p>
          </div>
        </div>

        {/* Wallet & Balances */}
        <div className="card mb-6">
          <h2 className="text-xl font-semibold mb-4"><Wallet className="w-5 h-5 inline-block align-middle mr-2" /> Wallet & Balances</h2>
          <div className="mb-4">
            <span className="text-muted text-sm block mb-1">Agent Wallet</span>
            <div className="bg-gray-800 px-3 py-2 rounded text-sm flex items-center justify-between">
              <code>{report.walletAddress}</code>
              <a href={`${EXPLORER_URL}/address/${report.walletAddress}`} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline" style={{ color: '#80d0ff' }}>
                View →
              </a>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard label="ETH" value={parseFloat(report.balances.eth).toFixed(6)} color="#627eea" />
            <StatCard label="USDC" value={`$${parseFloat(report.balances.usdc).toFixed(2)}`} color="#2775ca" />
            {report.balances.linkedToken && (
              <StatCard
                label={report.balances.linkedToken.symbol}
                value={parseFloat(report.balances.linkedToken.formatted).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                color="#6eecd8"
                sub={report.balances.linkedToken.name}
              />
            )}
          </div>
        </div>

        {/* Cred Score & Ranking */}
        <div className="card mb-6">
          <h2 className="text-xl font-semibold mb-4"><Trophy className="w-5 h-5 inline-block align-middle mr-2" /> Cred Score & Ranking</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <StatCard label="Cred Score" value={report.credScore.total} color={tierColors[report.credScore.tier] || '#80d0ff'} />
            <StatCard label="Tier" value={report.credScore.tier} color={tierColors[report.credScore.tier] || '#80d0ff'} />
            <StatCard label="Points" value={report.points.toLocaleString()} color="#b490ff" />
            <StatCard label="Rank" value={report.rank ? `#${report.rank}` : '—'} color="#f5a0d0" sub={report.totalAgents ? `of ${report.totalAgents}` : ''} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="glass-card p-3 flex items-center gap-2">
              {report.credScore.verified ? <CheckCircle className="w-5 h-5" style={{ color: '#10B981' }} /> : <XCircle className="w-5 h-5" style={{ color: '#EF4444' }} />}
              <span>Verified</span>
            </div>
            <div className="glass-card p-3 flex items-center gap-2">
              {report.credScore.hasPersonality ? <CheckCircle className="w-5 h-5" style={{ color: '#10B981' }} /> : <XCircle className="w-5 h-5" style={{ color: '#EF4444' }} />}
              <span>Personality</span>
            </div>
            <div className="glass-card p-3 flex items-center gap-2">
              {report.credScore.hasNarrative ? <CheckCircle className="w-5 h-5" style={{ color: '#10B981' }} /> : <XCircle className="w-5 h-5" style={{ color: '#EF4444' }} />}
              <span>Narrative</span>
            </div>
            <div className="glass-card p-3 flex items-center gap-2">
              {report.credScore.soulbound ? <Lock className="w-5 h-5" style={{ color: '#b490ff' }} /> : <RefreshCw className="w-5 h-5" style={{ color: '#6eecd8' }} />}
              <span>{report.credScore.soulbound ? 'Soulbound' : 'Transferable'}</span>
            </div>
          </div>
          {report.ethosScore && (
            <div className="glass-card p-3 mt-4 flex items-center justify-between">
              <div>
                <span className="text-lg font-bold" style={{ color: '#6eecd8' }}>{report.ethosScore.toLocaleString()}</span>
                <span className="text-muted text-sm ml-2">Ethos Score</span>
              </div>
              <a href={`https://ethos.network/profile/${report.owner}`} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline" style={{ color: '#80d0ff' }}>View →</a>
            </div>
          )}
        </div>

        {/* Verification Status */}
        <div className="card mb-6">
          <h2 className="text-xl font-semibold mb-4"><ShieldCheck className="w-5 h-5 inline-block align-middle mr-2" /> Verification Status</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { key: 'siwa', icon: <Bot className="w-5 h-5 inline-block align-middle" style={{ color: '#6eecd8' }} />, label: 'SIWA', verified: report.verifications.siwa },
              { key: 'x', icon: <XLogo className="w-5 h-5 inline-block align-middle" style={{ color: '#1DA1F2' }} />, label: 'Twitter', verified: report.verifications.x.verified, detail: report.verifications.x.handle ? `@${report.verifications.x.handle}` : undefined },
              { key: 'github', icon: <GitHubLogo className="w-5 h-5 inline-block align-middle" style={{ color: '#8b5cf6' }} />, label: 'GitHub', verified: report.verifications.github.verified, detail: report.verifications.github.username },
              { key: 'farcaster', icon: <FarcasterLogo className="w-5 h-5 inline-block align-middle" style={{ color: '#855DCD' }} />, label: 'Farcaster', verified: report.verifications.farcaster.verified, detail: report.verifications.farcaster.username },
            ].map(v => (
              <div key={v.key} className="glass-card p-3 text-center" style={{ borderColor: v.verified ? '#6eecd840' : '#ffffff10' }}>
                <div className="text-lg mb-1 flex items-center justify-center gap-1">{v.icon} {v.label}</div>
                <div className={`text-sm font-medium ${v.verified ? 'text-green-400' : 'text-gray-500'}`}>
                  {v.verified ? '✓ Verified' : 'Not Verified'}
                </div>
                {v.detail && <div className="text-xs text-muted mt-1">{v.detail}</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="card mb-6">
          <h2 className="text-xl font-semibold mb-4"><ScrollText className="w-5 h-5 inline-block align-middle mr-2" /> Recent Transactions</h2>
          {report.recentTransactions.length === 0 ? (
            <p className="text-muted text-sm">No recent transactions found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted text-left border-b border-gray-700">
                    <th className="pb-2 pr-4">Tx Hash</th>
                    <th className="pb-2 pr-4">Method</th>
                    <th className="pb-2 pr-4">Value (ETH)</th>
                    <th className="pb-2 pr-4">Time</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {report.recentTransactions.map((tx, i) => (
                    <tr key={i} className="border-b border-gray-800">
                      <td className="py-2 pr-4">
                        <a href={`${EXPLORER_URL}/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: '#80d0ff' }}>
                          {tx.hash.slice(0, 10)}...
                        </a>
                      </td>
                      <td className="py-2 pr-4 text-muted">{tx.method}</td>
                      <td className="py-2 pr-4">{parseFloat(tx.value).toFixed(4)}</td>
                      <td className="py-2 pr-4 text-muted">{new Date(tx.timestamp).toLocaleDateString()}</td>
                      <td className="py-2">
                        <span className={tx.isError ? 'text-red-400' : 'text-green-400'}>
                          {tx.isError ? '✗ Failed' : '✓'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-3">
            <a href={report.explorer} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline" style={{ color: '#80d0ff' }}>
              View all on BaseScan →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
