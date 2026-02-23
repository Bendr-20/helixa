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

export function Token() {
  const [stats, setStats] = useState<Stats>({
    price: '—', mcap: '—', volume: '—', totalVolume: '—',
    liquidity: '—', holders: '—', txns24h: '—', transfers: '—',
  });
  const [copyText, setCopyText] = useState('Copy');

  const loadStats = useCallback(async () => {
    const next = { ...stats };

    // GeckoTerminal token data
    try {
      const r = await fetch('https://api.geckoterminal.com/api/v2/networks/base/tokens/0xab3f23c2abcb4e12cc8b593c218a7ba64ed17ba3');
      const d = await r.json();
      const t = d.data?.attributes;
      if (t) {
        const price = parseFloat(t.price_usd);
        next.price = price < 0.01 ? '$' + price.toFixed(8) : '$' + price.toFixed(4);
        if (t.fdv_usd) next.mcap = '$' + Number(t.fdv_usd).toLocaleString(undefined, { maximumFractionDigits: 0 });
        if (t.volume_usd?.h24) next.volume = '$' + Number(t.volume_usd.h24).toLocaleString(undefined, { maximumFractionDigits: 0 });
      }
    } catch (e) { console.error('Stats fetch failed:', e); }

    // Pool data for liquidity
    try {
      const r = await fetch('https://api.geckoterminal.com/api/v2/networks/base/tokens/0xab3f23c2abcb4e12cc8b593c218a7ba64ed17ba3/pools?page=1');
      const d = await r.json();
      const pool = d.data?.[0]?.attributes;
      if (pool?.reserve_in_usd) next.liquidity = '$' + Number(pool.reserve_in_usd).toLocaleString(undefined, { maximumFractionDigits: 0 });
    } catch {}

    // Total volume from OHLCV
    try {
      const r = await fetch(`https://api.geckoterminal.com/api/v2/networks/base/pools/${POOL_ID}/ohlcv/day?limit=100`);
      const d = await r.json();
      const candles = d.data?.attributes?.ohlcv_list || [];
      const totalVol = candles.reduce((s: number, c: number[]) => s + Number(c[5]), 0);
      if (totalVol > 0) next.totalVolume = '$' + totalVol.toLocaleString(undefined, { maximumFractionDigits: 0 });
    } catch {}

    // 24h txns from DexScreener
    try {
      const r = await fetch('https://api.dexscreener.com/latest/dex/tokens/0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3');
      const d = await r.json();
      const p = d.pairs?.[0];
      if (p?.txns?.h24) {
        const total = (p.txns.h24.buys || 0) + (p.txns.h24.sells || 0);
        next.txns24h = total.toLocaleString();
      }
    } catch {}

    // Transfers from Blockscout
    try {
      const cr = await fetch('https://base.blockscout.com/api/v2/tokens/0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3/counters');
      const cd = await cr.json();
      if (cd.transfers_count) next.transfers = Number(cd.transfers_count).toLocaleString();
    } catch {}

    // Holders from our API
    try {
      const hr = await fetch('https://api.helixa.xyz/api/v2/token/stats');
      const hd = await hr.json();
      if (hd.holders > 0) next.holders = hd.holders.toLocaleString();
    } catch {}

    setStats(next);
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

  const statItems: { label: string; key: keyof Stats; cls?: string }[] = [
    { label: 'Price', key: 'price', cls: 'text-[var(--mint)]' },
    { label: 'Market Cap', key: 'mcap' },
    { label: '24H Volume', key: 'volume' },
    { label: 'Total Volume', key: 'totalVolume' },
    { label: 'Liquidity', key: 'liquidity' },
    { label: 'Holders', key: 'holders', cls: 'text-green-400' },
    { label: '24H Txns', key: 'txns24h' },
    { label: 'Total Transfers', key: 'transfers' },
  ];

  return (
    <div className="max-w-[900px] mx-auto px-5 py-8">
      {/* Hero */}
      <div className="text-center mb-10">
        <h1 className="font-heading text-[2.4rem] font-bold bg-gradient-to-br from-[var(--mint)] to-[var(--purple)] bg-clip-text text-transparent">
          $CRED
        </h1>
        <p className="text-muted text-lg mt-2">Street cred for AI agents. Earned, not bought.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 max-[700px]:grid-cols-2 gap-3 mb-8">
        {statItems.map(s => (
          <div key={s.key} className="bg-[rgba(15,15,30,0.9)] border border-[rgba(255,255,255,0.08)] rounded-xl p-4 text-center">
            <div className="text-[0.7rem] text-[var(--muted)] uppercase tracking-wider">{s.label}</div>
            <div className={`text-xl font-bold mt-1 ${s.cls || ''}`}>{stats[s.key]}</div>
          </div>
        ))}
      </div>

      {/* Contract Address */}
      <div
        onClick={copyCA}
        className="bg-[rgba(15,15,30,0.9)] border border-[rgba(255,255,255,0.08)] rounded-xl px-5 py-4 flex items-center justify-between mb-8 cursor-pointer hover:border-[var(--mint)] transition-colors"
      >
        <div>
          <div className="text-[0.7rem] text-[var(--muted)] uppercase tracking-wider">Contract Address (Base)</div>
          <div className="text-sm font-semibold font-mono text-[var(--mint)] mt-0.5 break-all">{CA}</div>
        </div>
        <button className="text-sm text-[var(--purple)] px-3 py-1.5 border border-[rgba(255,255,255,0.08)] rounded-md bg-transparent hover:border-[var(--purple)]">
          {copyText}
        </button>
      </div>

      {/* Buy Section */}
      <div className="mb-8">
        <h2 className="font-heading text-xl text-[var(--mint)] mb-4">Buy $CRED</h2>
        <div className="grid grid-cols-2 max-[600px]:grid-cols-1 gap-4">
          <div className="bg-[rgba(15,15,30,0.9)] border border-[rgba(255,255,255,0.08)] rounded-xl p-5 text-center">
            <h3 className="text-[0.95rem] mb-2">Uniswap</h3>
            <p className="text-sm text-[var(--muted)] mb-4">Swap ETH → $CRED directly on Base via Uniswap.</p>
            <a
              href="https://app.uniswap.org/swap?outputCurrency=0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3&chain=base"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-7 py-3 rounded-[10px] font-heading text-sm font-semibold no-underline bg-gradient-to-br from-[var(--mint)] to-[var(--purple)] text-[#0a0a14] hover:opacity-85"
            >
              Swap on Uniswap
            </a>
          </div>
          <div className="bg-[rgba(15,15,30,0.9)] border border-[rgba(255,255,255,0.08)] rounded-xl p-5 text-center">
            <h3 className="text-[0.95rem] mb-2">Doppler</h3>
            <p className="text-sm text-[var(--muted)] mb-4">View the pool, chart, and trade on Doppler.</p>
            <a
              href="https://app.doppler.lol/tokens/base/0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-7 py-3 rounded-[10px] font-heading text-sm font-semibold no-underline border border-[var(--purple)] text-[var(--purple)] hover:opacity-85"
            >
              View on Doppler
            </a>
          </div>
        </div>
      </div>

      {/* Token Details */}
      <div className="mb-8">
        <h2 className="font-heading text-xl text-[var(--mint)] mb-4">Token Details</h2>
        <div className="grid grid-cols-2 max-[600px]:grid-cols-1 gap-3">
          {[
            ['Name', 'Helixa Cred'],
            ['Ticker', '$CRED'],
            ['Chain', 'Base (Ethereum L2)'],
            ['Total Supply', '100,000,000,000'],
            ['DEX', 'Uniswap V4 (Doppler)'],
            ['Swap Fee', '1.2% per trade'],
          ].map(([label, value]) => (
            <div key={label} className="bg-[rgba(15,15,30,0.9)] border border-[rgba(255,255,255,0.08)] rounded-lg p-3.5">
              <div className="text-[0.7rem] text-[var(--muted)] uppercase tracking-wider">{label}</div>
              <div className="text-sm font-medium mt-1">{value}</div>
            </div>
          ))}
          <div className="bg-[rgba(15,15,30,0.9)] border border-[rgba(255,255,255,0.08)] rounded-lg p-3.5">
            <div className="text-[0.7rem] text-[var(--muted)] uppercase tracking-wider">Basescan</div>
            <div className="text-sm font-medium mt-1">
              <a href="https://basescan.org/token/0xab3f23c2abcb4e12cc8b593c218a7ba64ed17ba3" target="_blank" rel="noopener noreferrer" className="text-[var(--mint)] no-underline hover:underline">View on Basescan →</a>
            </div>
          </div>
          <div className="bg-[rgba(15,15,30,0.9)] border border-[rgba(255,255,255,0.08)] rounded-lg p-3.5">
            <div className="text-[0.7rem] text-[var(--muted)] uppercase tracking-wider">Chart</div>
            <div className="text-sm font-medium mt-1">
              <a href="https://www.geckoterminal.com/base/pools/0xab3f23c2abcb4e12cc8b593c218a7ba64ed17ba3" target="_blank" rel="noopener noreferrer" className="text-[var(--mint)] no-underline hover:underline">GeckoTerminal →</a>
            </div>
          </div>
        </div>
      </div>

      {/* Fee Structure */}
      <div>
        <h2 className="font-heading text-xl text-[var(--mint)] mb-4">Fee Structure</h2>
        <p className="text-sm text-[var(--muted)] mb-2">Every trade generates a 1.2% swap fee, split automatically:</p>
        <table className="w-full border-collapse mt-3">
          <thead>
            <tr>
              <th className="py-2.5 px-3.5 text-left border-b border-[rgba(255,255,255,0.08)] text-[0.7rem] text-[var(--muted)] uppercase tracking-wider">Recipient</th>
              <th className="py-2.5 px-3.5 text-left border-b border-[rgba(255,255,255,0.08)] text-[0.7rem] text-[var(--muted)] uppercase tracking-wider">Share</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Creator (Helixa)', '57%', true],
              ['Bankr Protocol', '36.1%', false],
              ['Ecosystem', '1.9%', false],
              ['Doppler', '5%', false],
            ].map(([name, share, mint]) => (
              <tr key={name as string}>
                <td className="py-2.5 px-3.5 text-sm border-b border-[rgba(255,255,255,0.08)]">{name as string}</td>
                <td className={`py-2.5 px-3.5 text-sm border-b border-[rgba(255,255,255,0.08)] ${mint ? 'text-[var(--mint)]' : ''}`}>{share as string}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
