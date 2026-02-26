import { useState, useEffect, useCallback } from 'react';

const CA = '0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3';
const POOL_ID = '0x55a4f7a23c4c2616cf848e639a08bd4283d13e66f5fcf34f828b5ca7e4e96324';

interface Stats {
  price: string;
  mcap: string;
  volume: string;
  totalVolume: string;
  liquidity: string;
  holders: string;
  txns24h: string;
  transfers: string;
}

const EMPTY: Stats = {
  price: '—', mcap: '—', volume: '—', totalVolume: '—',
  liquidity: '—', holders: '—', txns24h: '—', transfers: '—',
};

export function Token() {
  const [stats, setStats] = useState<Stats>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [copyText, setCopyText] = useState('Copy');

  const loadStats = useCallback(async () => {
    const next = { ...EMPTY };

    const results = await Promise.allSettled([
      // GeckoTerminal token data
      fetch('https://api.geckoterminal.com/api/v2/networks/base/tokens/' + CA.toLowerCase())
        .then(r => r.json()).then(d => {
          const t = d.data?.attributes;
          if (t) {
            const price = parseFloat(t.price_usd);
            next.price = price < 0.01 ? '$' + price.toFixed(8) : '$' + price.toFixed(4);
            if (t.fdv_usd) next.mcap = '$' + Number(t.fdv_usd).toLocaleString(undefined, { maximumFractionDigits: 0 });
            if (t.volume_usd?.h24) next.volume = '$' + Number(t.volume_usd.h24).toLocaleString(undefined, { maximumFractionDigits: 0 });
          }
        }),
      // Pool data for liquidity
      fetch('https://api.geckoterminal.com/api/v2/networks/base/tokens/' + CA.toLowerCase() + '/pools?page=1')
        .then(r => r.json()).then(d => {
          const pool = d.data?.[0]?.attributes;
          if (pool?.reserve_in_usd) next.liquidity = '$' + Number(pool.reserve_in_usd).toLocaleString(undefined, { maximumFractionDigits: 0 });
        }),
      // Total volume from OHLCV
      fetch(`https://api.geckoterminal.com/api/v2/networks/base/pools/${POOL_ID}/ohlcv/day?limit=100`)
        .then(r => r.json()).then(d => {
          const candles = d.data?.attributes?.ohlcv_list || [];
          const totalVol = candles.reduce((s: number, c: number[]) => s + Number(c[5]), 0);
          if (totalVol > 0) next.totalVolume = '$' + totalVol.toLocaleString(undefined, { maximumFractionDigits: 0 });
        }),
      // 24h txns from DexScreener
      fetch('https://api.dexscreener.com/latest/dex/tokens/' + CA)
        .then(r => r.json()).then(d => {
          const p = d.pairs?.[0];
          if (p?.txns?.h24) {
            const total = (p.txns.h24.buys || 0) + (p.txns.h24.sells || 0);
            next.txns24h = total.toLocaleString();
          }
        }),
      // Transfers from Blockscout
      fetch('https://base.blockscout.com/api/v2/tokens/' + CA + '/counters')
        .then(r => r.json()).then(d => {
          if (d.transfers_count) next.transfers = Number(d.transfers_count).toLocaleString();
        }),
      // Holders from our API
      fetch('https://api.helixa.xyz/api/v2/token/stats')
        .then(r => r.json()).then(d => {
          if (d.holders > 0) next.holders = d.holders.toLocaleString();
        }),
    ]);

    setStats(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadStats();
    const iv = setInterval(loadStats, 30000);
    return () => clearInterval(iv);
  }, [loadStats]);

  const copyCA = () => {
    navigator.clipboard.writeText(CA);
    setCopyText('Copied!');
    setTimeout(() => setCopyText('Copy'), 2000);
  };

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      <div style={{
        maxWidth: 920, margin: '0 auto', padding: '40px 24px 60px',
        fontFamily: 'Inter, -apple-system, sans-serif',
      }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h1 style={{
            fontFamily: 'Orbitron, sans-serif', fontSize: '3rem', fontWeight: 800,
            background: 'linear-gradient(135deg, #6eecd8, #b490ff)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            margin: 0,
          }}>$CRED</h1>
          <p style={{ color: '#8a8aad', fontSize: '1.1rem', marginTop: 8 }}>
            Street cred for AI agents. Earned, not bought.
          </p>
        </div>

        {/* Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          marginBottom: 32,
        }}>
          {([
            { label: 'PRICE', value: stats.price, accent: true, green: false },
            { label: 'MARKET CAP', value: stats.mcap, accent: false, green: false },
            { label: '24H VOLUME', value: stats.volume, accent: false, green: false },
            { label: 'LIQUIDITY', value: stats.liquidity, accent: false, green: false },
            { label: 'TOTAL VOLUME', value: stats.totalVolume, accent: false, green: false },
            { label: 'HOLDERS', value: stats.holders, accent: false, green: true },
            { label: '24H TXNS', value: stats.txns24h, accent: false, green: false },
            { label: 'TOTAL TRANSFERS', value: stats.transfers, accent: false, green: false },
          ]).map((s) => (
            <div key={s.label} style={{
              background: 'rgba(15,15,30,0.95)',
              border: '1px solid rgba(110,236,216,0.12)',
              borderRadius: 12,
              padding: '16px 12px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 10, color: '#6a6a8e', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                {s.label}
              </div>
              <div style={{
                fontSize: loading && s.value === '—' ? 16 : 18,
                fontWeight: 700,
                color: s.accent ? '#6eecd8' : s.green ? '#4ade80' : '#e0e0f0',
                fontFamily: 'Inter, sans-serif',
              }}>
                {loading && s.value === '—' ? (
                  <span style={{ display: 'inline-block', width: 40, height: 18, background: 'rgba(110,236,216,0.08)', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} />
                ) : s.value}
              </div>
            </div>
          ))}
        </div>

        {/* Contract Address */}
        <div
          onClick={copyCA}
          style={{
            background: 'rgba(15,15,30,0.95)',
            border: '1px solid rgba(110,236,216,0.12)',
            borderRadius: 12,
            padding: '16px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 32,
            cursor: 'pointer',
            transition: 'border-color 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(110,236,216,0.4)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(110,236,216,0.12)')}
        >
          <div>
            <div style={{ fontSize: 10, color: '#6a6a8e', letterSpacing: '0.1em', textTransform: 'uppercase' }}>CONTRACT ADDRESS (BASE)</div>
            <div style={{ fontSize: 13, fontFamily: 'monospace', color: '#6eecd8', marginTop: 4, wordBreak: 'break-all' }}>{CA}</div>
          </div>
          <button style={{
            fontSize: 13, color: '#b490ff', padding: '6px 14px',
            border: '1px solid rgba(180,144,255,0.3)', borderRadius: 6,
            background: 'transparent', cursor: 'pointer',
          }}>{copyText}</button>
        </div>

        {/* Buy Section */}
        <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.3rem', color: '#6eecd8', marginBottom: 16 }}>Buy $CRED</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 40 }}>
          <div style={{
            background: 'rgba(15,15,30,0.95)', border: '1px solid rgba(110,236,216,0.12)',
            borderRadius: 12, padding: '24px 20px', textAlign: 'center',
          }}>
            <h3 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.1rem', margin: '0 0 8px', color: '#e0e0f0' }}>Swap $CRED</h3>
            <p style={{ color: '#6a6a8e', fontSize: 14, margin: '0 0 16px' }}>Swap ETH → $CRED directly on Base via Uniswap.</p>
            <iframe
              src={`https://app.uniswap.org/swap?exactField=output&outputCurrency=${CA}&chain=base&theme=dark`}
              style={{
                width: '100%', height: 360, border: 'none', borderRadius: 12,
                margin: '0 0 12px',
              }}
              title="Uniswap Swap Widget"
              allow="clipboard-write"
            />
            <a
              href={`https://app.uniswap.org/swap?outputCurrency=${CA}&chain=base`}
              target="_blank" rel="noopener noreferrer"
              style={{
                display: 'inline-block', padding: '10px 28px', borderRadius: 10,
                fontFamily: 'Orbitron, sans-serif', fontSize: 13, fontWeight: 600,
                textDecoration: 'none',
                background: 'linear-gradient(135deg, #6eecd8, #b490ff)',
                color: '#0a0a14',
              }}
            >Open Full Uniswap ↗</a>
          </div>
          <div style={{
            background: 'rgba(15,15,30,0.95)', border: '1px solid rgba(110,236,216,0.12)',
            borderRadius: 12, padding: '24px 20px', textAlign: 'center',
          }}>
            <h3 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.1rem', margin: '0 0 8px', color: '#e0e0f0' }}>Doppler</h3>
            <p style={{ color: '#6a6a8e', fontSize: 14, margin: '0 0 16px' }}>View the pool, chart, and trade on Doppler.</p>
            <a
              href={`https://app.doppler.lol/tokens/base/${CA}`}
              target="_blank" rel="noopener noreferrer"
              style={{
                display: 'inline-block', padding: '10px 28px', borderRadius: 10,
                fontFamily: 'Orbitron, sans-serif', fontSize: 13, fontWeight: 600,
                textDecoration: 'none',
                border: '1px solid #b490ff', color: '#b490ff',
                background: 'transparent',
              }}
            >View on Doppler</a>
          </div>
        </div>

        {/* Token Details */}
        <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.3rem', color: '#6eecd8', marginBottom: 16 }}>Token Details</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 40 }}>
          {([
            ['Name', 'Helixa Cred'],
            ['Ticker', '$CRED'],
            ['Chain', 'Base (Ethereum L2)'],
            ['Total Supply', '100,000,000,000'],
            ['DEX', 'Uniswap V4 (Doppler)'],
            ['Swap Fee', '1.2% per trade'],
          ] as const).map(([label, value]) => (
            <div key={label} style={{
              background: 'rgba(15,15,30,0.95)', border: '1px solid rgba(110,236,216,0.12)',
              borderRadius: 10, padding: '14px 16px',
            }}>
              <div style={{ fontSize: 10, color: '#6a6a8e', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#e0e0f0', marginTop: 4 }}>{value}</div>
            </div>
          ))}
          <div style={{ background: 'rgba(15,15,30,0.95)', border: '1px solid rgba(110,236,216,0.12)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, color: '#6a6a8e', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Basescan</div>
            <div style={{ fontSize: 14, marginTop: 4 }}>
              <a href={`https://basescan.org/token/${CA.toLowerCase()}`} target="_blank" rel="noopener noreferrer"
                style={{ color: '#6eecd8', textDecoration: 'none' }}>View on Basescan →</a>
            </div>
          </div>
          <div style={{ background: 'rgba(15,15,30,0.95)', border: '1px solid rgba(110,236,216,0.12)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, color: '#6a6a8e', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Chart</div>
            <div style={{ fontSize: 14, marginTop: 4 }}>
              <a href={`https://www.geckoterminal.com/base/pools/${POOL_ID}`} target="_blank" rel="noopener noreferrer"
                style={{ color: '#6eecd8', textDecoration: 'none' }}>GeckoTerminal →</a>
            </div>
          </div>
        </div>

        {/* Fee Structure */}
        <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.3rem', color: '#6eecd8', marginBottom: 16 }}>Fee Structure</h2>
        <p style={{ color: '#6a6a8e', fontSize: 14, marginBottom: 12 }}>
          Every trade generates a 1.2% swap fee, split automatically:
        </p>
        <div style={{
          background: 'rgba(15,15,30,0.95)', border: '1px solid rgba(110,236,216,0.12)',
          borderRadius: 12, overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 10, color: '#6a6a8e', letterSpacing: '0.1em', textTransform: 'uppercase', borderBottom: '1px solid rgba(110,236,216,0.08)' }}>Recipient</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 10, color: '#6a6a8e', letterSpacing: '0.1em', textTransform: 'uppercase', borderBottom: '1px solid rgba(110,236,216,0.08)' }}>Share</th>
              </tr>
            </thead>
            <tbody>
              {([
                ['Creator (Helixa)', '57%', true],
                ['Bankr Protocol', '36.1%', false],
                ['Ecosystem', '1.9%', false],
                ['Doppler', '5%', false],
              ] as const).map(([name, share, highlight]) => (
                <tr key={name}>
                  <td style={{ padding: '10px 16px', fontSize: 14, borderBottom: '1px solid rgba(110,236,216,0.05)', color: '#e0e0f0' }}>{name}</td>
                  <td style={{ padding: '10px 16px', fontSize: 14, borderBottom: '1px solid rgba(110,236,216,0.05)', textAlign: 'right', color: highlight ? '#6eecd8' : '#e0e0f0', fontWeight: highlight ? 600 : 400 }}>{share}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pulse animation for loading skeleton */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
        @media (max-width: 700px) {
          div[style*="grid-template-columns: repeat(4"] {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          div[style*="grid-template-columns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
