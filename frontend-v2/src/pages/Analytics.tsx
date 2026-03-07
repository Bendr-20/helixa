import { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const API = 'https://api.helixa.xyz/api/v2/protocol-analytics';
const COLORS = ['#6eecd8', '#b490ff', '#80d0ff', '#f5a0d0', '#ffcc66'];

interface AnalyticsData {
  totalMinted: number;
  uniqueMinters: number;
  stakingTVL: string;
  avgCredScore: number;
  mintsOverTime: { day: string; count: number }[];
  credDistribution: { tier: string; count: number }[];
  frameworks: { framework: string; count: number }[];
  soulbound: number;
  transferable: number;
  revenue: string;
  revenueETH: number;
  cachedAt: string;
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{
      background: 'rgba(110,236,216,0.04)',
      border: '1px solid rgba(110,236,216,0.12)',
      borderRadius: 12,
      padding: '24px 20px',
      flex: '1 1 200px',
      minWidth: 180,
    }}>
      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#80d0ff', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
      <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 28, fontWeight: 700, color: '#6eecd8' }}>{value}</div>
      {sub && <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

const tooltipStyle = {
  backgroundColor: '#12122a',
  border: '1px solid rgba(110,236,216,0.2)',
  borderRadius: 8,
  fontFamily: 'Inter, sans-serif',
  fontSize: 12,
};

export function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(API)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div className="spinner" style={{ width: 40, height: 40 }} />
    </div>
  );

  if (error || !data) return (
    <div className="container" style={{ padding: '80px 20px', textAlign: 'center' }}>
      <h1 style={{ fontFamily: 'Orbitron', color: '#f5a0d0' }}>Analytics Unavailable</h1>
      <p style={{ color: 'rgba(255,255,255,0.5)' }}>{error || 'Failed to load data'}</p>
    </div>
  );

  const soulboundPie = [
    { name: 'Soulbound', value: data.soulbound },
    { name: 'Transferable', value: data.transferable },
  ];

  // Format mints chart - show last 90 days max
  const mintsData = data.mintsOverTime.slice(-90).map(d => ({
    ...d,
    day: d.day.slice(5), // MM-DD
  }));

  return (
    <div style={{ padding: '60px 20px 100px', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 32, fontWeight: 700, color: '#6eecd8', marginBottom: 8 }}>
        Protocol Analytics
      </h1>
      <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 40 }}>
        Internal dashboard -- Helixa V2 on Base
      </p>

      {/* Row 1: Stat Cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
        <StatCard label="Total Minted" value={data.totalMinted.toLocaleString()} />
        <StatCard label="Unique Minters" value={data.uniqueMinters.toLocaleString()} />
        <StatCard label="Staking TVL" value={`${Number(data.stakingTVL).toLocaleString()} CRED`} />
        <StatCard label="Avg Cred Score" value={data.avgCredScore} sub={`/ 100`} />
      </div>

      {/* Row 2: Mints Over Time + Cred Distribution */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24, marginBottom: 32 }}>
        <div style={{ background: 'rgba(110,236,216,0.03)', border: '1px solid rgba(110,236,216,0.08)', borderRadius: 12, padding: 24 }}>
          <h3 style={{ fontFamily: 'Orbitron', fontSize: 16, color: '#b490ff', marginBottom: 20 }}>Mints Over Time</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={mintsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="day" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="count" stroke="#6eecd8" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: 'rgba(110,236,216,0.03)', border: '1px solid rgba(110,236,216,0.08)', borderRadius: 12, padding: 24 }}>
          <h3 style={{ fontFamily: 'Orbitron', fontSize: 16, color: '#b490ff', marginBottom: 20 }}>Cred Score Distribution</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.credDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="tier" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} angle={-15} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {data.credDistribution.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 3: Framework Pie + Soulbound */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24, marginBottom: 32 }}>
        <div style={{ background: 'rgba(110,236,216,0.03)', border: '1px solid rgba(110,236,216,0.08)', borderRadius: 12, padding: 24 }}>
          <h3 style={{ fontFamily: 'Orbitron', fontSize: 16, color: '#b490ff', marginBottom: 20 }}>Frameworks</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={data.frameworks.slice(0, 10)} dataKey="count" nameKey="framework" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {data.frameworks.slice(0, 10).map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: 'rgba(110,236,216,0.03)', border: '1px solid rgba(110,236,216,0.08)', borderRadius: 12, padding: 24 }}>
          <h3 style={{ fontFamily: 'Orbitron', fontSize: 16, color: '#b490ff', marginBottom: 20 }}>Soulbound vs Transferable</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={soulboundPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}>
                <Cell fill="#6eecd8" />
                <Cell fill="#b490ff" />
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontFamily: 'Inter', fontSize: 12, color: 'rgba(255,255,255,0.6)' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 4: Revenue + Meta */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <StatCard label="Est. Mint Revenue" value={data.revenue} sub={`${data.totalMinted} mints x 0.0005 ETH`} />
        <StatCard label="Soulbound Agents" value={data.soulbound.toLocaleString()} />
        <StatCard label="Frameworks" value={data.frameworks.length} />
      </div>

      <p style={{ fontFamily: 'Inter', fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 40, textAlign: 'center' }}>
        Cached at {new Date(data.cachedAt).toLocaleString()} -- refreshes every 5 minutes
      </p>
    </div>
  );
}
