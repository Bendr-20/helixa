import { useState, useEffect, useCallback } from 'react';
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { keccak256, toHex, encodePacked } from 'viem';
import { base } from 'wagmi/chains';
import { SOUL_SOVEREIGN_V3_ADDRESS, SOUL_SOVEREIGN_V3_ABI } from '../abi/SoulSovereignV3';
import { API_URL, EXPLORER_URL } from '../lib/constants';

// ─── Helpers ──────────────────────────────────────────────────
function truncateHash(hash: string, chars = 8): string {
  if (!hash || hash.length < chars * 2 + 2) return hash;
  return `${hash.slice(0, chars + 2)}…${hash.slice(-chars)}`;
}

function formatDate(timestamp: number): string {
  if (!timestamp) return '—';
  const d = new Date(timestamp * 1000);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function timeAgo(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = now - timestamp;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── Soul History Timeline Component ──────────────────────────
function SoulTimeline({ hashes, timestamps }: { hashes: string[]; timestamps: number[] }) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  if (!hashes.length) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text2)' }}>
        No soul versions locked yet. This agent's soul is unwritten.
      </div>
    );
  }

  return (
    <div className="soul-timeline">
      {hashes.map((hash, i) => {
        const version = i + 1;
        const ts = timestamps[i];
        const isLatest = i === hashes.length - 1;
        const isExpanded = expandedIdx === i;

        return (
          <div
            key={i}
            className={`timeline-entry ${isLatest ? 'timeline-latest' : ''}`}
            style={{
              display: 'flex',
              gap: '1rem',
              position: 'relative',
              paddingBottom: i < hashes.length - 1 ? '1.5rem' : '0',
            }}
          >
            {/* Timeline line + dot */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 32 }}>
              <div style={{
                width: isLatest ? 14 : 10,
                height: isLatest ? 14 : 10,
                borderRadius: '50%',
                background: isLatest ? 'var(--teal-gradient)' : 'var(--surface2)',
                border: `2px solid ${isLatest ? 'var(--teal)' : 'var(--text2)'}`,
                boxShadow: isLatest ? '0 0 12px rgba(110, 236, 216, 0.4)' : 'none',
                flexShrink: 0,
                marginTop: 4,
              }} />
              {i < hashes.length - 1 && (
                <div style={{
                  width: 2,
                  flex: 1,
                  background: 'linear-gradient(to bottom, var(--text2) 0%, transparent 100%)',
                  opacity: 0.3,
                  marginTop: 4,
                }} />
              )}
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: isLatest ? 'var(--teal)' : 'var(--text)',
                }}>
                  v{version}
                </span>
                {isLatest && (
                  <span style={{
                    fontSize: '0.65rem',
                    padding: '2px 8px',
                    borderRadius: 20,
                    background: 'rgba(110, 236, 216, 0.15)',
                    color: 'var(--teal)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}>
                    Latest
                  </span>
                )}
                <span style={{ fontSize: '0.75rem', color: 'var(--text2)', marginLeft: 'auto' }}>
                  {timeAgo(ts)}
                </span>
              </div>

              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  color: 'var(--accent-purple, var(--accent))',
                  cursor: 'pointer',
                  marginTop: 4,
                  wordBreak: 'break-all',
                }}
                onClick={() => setExpandedIdx(isExpanded ? null : i)}
                title="Click to expand"
              >
                {isExpanded ? hash : truncateHash(hash, 10)}
              </div>

              <div style={{ fontSize: '0.7rem', color: 'var(--text2)', marginTop: 2 }}>
                {formatDate(ts)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────
export function SoulKeeper() {
  const { address, isConnected } = useAccount();
  const [tokenId, setTokenId] = useState('');
  const [lookupId, setLookupId] = useState<bigint | null>(null);
  const [lockingTokenId, setLockingTokenId] = useState('');
  const [soulData, setSoulData] = useState<any>(null);
  const [soulHash, setSoulHash] = useState<`0x${string}` | null>(null);
  const [fetchingSoul, setFetchingSoul] = useState(false);
  const [lockSuccess, setLockSuccess] = useState(false);

  // ─── Contract Reads ──────
  const { data: versionData } = useReadContract({
    address: SOUL_SOVEREIGN_V3_ADDRESS,
    abi: SOUL_SOVEREIGN_V3_ABI,
    functionName: 'getSoulVersion',
    args: lookupId !== null ? [lookupId] : undefined,
    chainId: base.id,
    query: { enabled: lookupId !== null },
  });

  const { data: isSovereignData } = useReadContract({
    address: SOUL_SOVEREIGN_V3_ADDRESS,
    abi: SOUL_SOVEREIGN_V3_ABI,
    functionName: 'isSovereign',
    args: lookupId !== null ? [lookupId] : undefined,
    chainId: base.id,
    query: { enabled: lookupId !== null },
  });

  const { data: walletData } = useReadContract({
    address: SOUL_SOVEREIGN_V3_ADDRESS,
    abi: SOUL_SOVEREIGN_V3_ABI,
    functionName: 'getSovereignWallet',
    args: lookupId !== null ? [lookupId] : undefined,
    chainId: base.id,
    query: { enabled: lookupId !== null },
  });

  const { data: historyData, refetch: refetchHistory } = useReadContract({
    address: SOUL_SOVEREIGN_V3_ADDRESS,
    abi: SOUL_SOVEREIGN_V3_ABI,
    functionName: 'getFullSoulHistory',
    args: lookupId !== null ? [lookupId] : undefined,
    chainId: base.id,
    query: { enabled: lookupId !== null },
  });

  // ─── Lock Soul Write ──────
  const { writeContract, data: txHash, error: writeError, isPending: isWriting } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isConfirmed) {
      setLockSuccess(true);
      if (lookupId !== null) {
        refetchHistory();
      }
      setTimeout(() => setLockSuccess(false), 5000);
    }
  }, [isConfirmed]);

  // ─── Handlers ──────
  const handleLookup = useCallback(() => {
    const parsed = parseInt(tokenId, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      setLookupId(BigInt(parsed));
    }
  }, [tokenId]);

  const handleFetchAndLock = useCallback(async () => {
    const id = parseInt(lockingTokenId, 10);
    if (isNaN(id)) return;

    setFetchingSoul(true);
    try {
      const res = await fetch(`${API_URL}/api/v2/agent/${id}/soul`);
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const data = await res.json();
      setSoulData(data);

      // Compute keccak256 of the soul JSON
      const jsonStr = JSON.stringify(data);
      const hash = keccak256(toHex(jsonStr));
      setSoulHash(hash);
    } catch (err) {
      console.error('Failed to fetch soul data:', err);
      setSoulData(null);
      setSoulHash(null);
    } finally {
      setFetchingSoul(false);
    }
  }, [lockingTokenId]);

  const handleLock = useCallback(() => {
    if (!soulHash || !lockingTokenId) return;
    const id = BigInt(parseInt(lockingTokenId, 10));
    // @ts-ignore - wagmi infers chain/account from connected wallet
    writeContract({
      address: SOUL_SOVEREIGN_V3_ADDRESS,
      abi: SOUL_SOVEREIGN_V3_ABI,
      functionName: 'lockSoulVersion',
      args: [id, soulHash],
    });
  }, [soulHash, lockingTokenId, writeContract]);

  // Parse history
  const hashes: string[] = historyData ? (historyData as any)[0]?.map((h: string) => h) ?? [] : [];
  const timestamps: number[] = historyData ? (historyData as any)[1]?.map((t: bigint) => Number(t)) ?? [] : [];
  const version = versionData !== undefined ? Number(versionData) : null;
  const isSovereign = isSovereignData ?? null;
  const sovereignWallet = walletData as string | undefined;
  const zeroAddr = '0x0000000000000000000000000000000000000000';

  return (
    <div className="py-20" style={{ minHeight: '80vh' }}>
      <div className="container" style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* ─── Hero ─────────────────────────────────── */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{
            fontFamily: "'Orbitron', sans-serif",
            fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
            fontWeight: 800,
            marginBottom: '0.75rem',
            lineHeight: 1.1,
          }}>
            <span className="text-gradient">Soul Keeper</span>
          </h1>
          <p style={{
            fontFamily: "'Orbitron', sans-serif",
            fontSize: '0.85rem',
            color: 'var(--teal)',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            marginBottom: '1rem',
            fontWeight: 600,
          }}>
            Chain of Identity
          </p>
          <p style={{
            color: 'var(--text2)',
            maxWidth: 560,
            margin: '0 auto',
            lineHeight: 1.6,
            fontSize: '0.95rem',
          }}>
            Git commits for your soul. Each lock creates an immutable version onchain.
            Your agent evolves, and the chain proves it.
          </p>
        </div>

        {/* ─── Agent Lookup ────────────────────────── */}
        <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h2 style={{
            fontFamily: "'Orbitron', sans-serif",
            fontSize: '1rem',
            fontWeight: 700,
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            🔍 Agent Lookup
          </h2>

          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <input
              type="number"
              min="0"
              placeholder="Enter Token ID"
              value={tokenId}
              onChange={e => setTokenId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLookup()}
              style={{
                flex: 1,
                padding: '0.65rem 1rem',
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            />
            <button className="btn btn-primary" onClick={handleLookup} disabled={!tokenId}>
              Lookup
            </button>
          </div>

          {lookupId !== null && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '1rem',
            }}>
              <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>
                  Soul Version
                </div>
                <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '1.5rem', fontWeight: 700, color: 'var(--teal)' }}>
                  {version !== null ? (version === 0 ? '—' : `v${version}`) : '…'}
                </div>
              </div>

              <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>
                  Sovereign
                </div>
                <div style={{
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: '1.2rem',
                  fontWeight: 700,
                  color: isSovereign ? 'var(--teal)' : 'var(--text2)',
                }}>
                  {isSovereign === null ? '…' : isSovereign ? '✓ Locked' : '✗ Unlocked'}
                </div>
              </div>

              <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>
                  Sovereign Wallet
                </div>
                <div style={{
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  color: sovereignWallet && sovereignWallet !== zeroAddr ? 'var(--accent)' : 'var(--text2)',
                  wordBreak: 'break-all',
                }}>
                  {sovereignWallet ? (sovereignWallet === zeroAddr ? 'Not set' : truncateHash(sovereignWallet, 6)) : '…'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── Soul History Timeline ───────────────── */}
        {lookupId !== null && (
          <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h2 style={{
              fontFamily: "'Orbitron', sans-serif",
              fontSize: '1rem',
              fontWeight: 700,
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              ⛓️ Soul Archaeology
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text2)', marginBottom: '1rem' }}>
              The immutable version chain — every lock is a commit to identity.
            </p>
            <SoulTimeline hashes={hashes} timestamps={timestamps} />
          </div>
        )}

        {/* ─── Lock Soul Action ────────────────────── */}
        <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h2 style={{
            fontFamily: "'Orbitron', sans-serif",
            fontSize: '1rem',
            fontWeight: 700,
            marginBottom: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            🔒 Lock Soul Version
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text2)', marginBottom: '1rem' }}>
            Snapshot your agent's current soul and commit it onchain. You must be the token owner or approved.
          </p>

          {!isConnected ? (
            <div style={{
              textAlign: 'center',
              padding: '2rem',
              color: 'var(--text2)',
              border: '1px dashed var(--border)',
              borderRadius: 12,
            }}>
              Connect your wallet to lock a soul version
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                <input
                  type="number"
                  min="0"
                  placeholder="Token ID to lock"
                  value={lockingTokenId}
                  onChange={e => setLockingTokenId(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '0.65rem 1rem',
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                />
                <button
                  className="btn btn-secondary"
                  onClick={handleFetchAndLock}
                  disabled={!lockingTokenId || fetchingSoul}
                >
                  {fetchingSoul ? 'Fetching…' : '1. Fetch Soul'}
                </button>
              </div>

              {soulHash && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{
                    padding: '0.75rem 1rem',
                    borderRadius: 12,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                  }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text2)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '1px' }}>
                      Computed Soul Hash
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--teal)', wordBreak: 'break-all' }}>
                      {soulHash}
                    </div>
                  </div>
                </div>
              )}

              <button
                className="btn btn-primary btn-lg"
                style={{ width: '100%' }}
                onClick={handleLock}
                disabled={!soulHash || isWriting || isConfirming}
              >
                {isWriting ? 'Confirm in wallet…' :
                  isConfirming ? 'Confirming…' :
                  '2. Lock Soul Version Onchain'}
              </button>

              {writeError && (
                <div style={{
                  marginTop: '0.75rem',
                  padding: '0.75rem',
                  borderRadius: 10,
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                  fontSize: '0.8rem',
                }}>
                  {(writeError as any)?.shortMessage || writeError.message}
                </div>
              )}

              {lockSuccess && (
                <div style={{
                  marginTop: '0.75rem',
                  padding: '0.75rem',
                  borderRadius: 10,
                  background: 'rgba(110, 236, 216, 0.1)',
                  border: '1px solid rgba(110, 236, 216, 0.3)',
                  color: 'var(--teal)',
                  fontSize: '0.8rem',
                  textAlign: 'center',
                }}>
                  ✓ Soul version locked successfully!
                  {txHash && (
                    <a
                      href={`${EXPLORER_URL}/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ marginLeft: 8, color: 'var(--accent)', textDecoration: 'underline' }}
                    >
                      View tx ↗
                    </a>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* ─── Contract Info ────────────────────────── */}
        <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text2)', marginTop: '2rem' }}>
          <span>SoulSovereign V3: </span>
          <a
            href={`${EXPLORER_URL}/address/${SOUL_SOVEREIGN_V3_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--accent)', fontFamily: 'monospace' }}
          >
            {truncateHash(SOUL_SOVEREIGN_V3_ADDRESS, 6)}
          </a>
          <span> on Base</span>
        </div>
      </div>
    </div>
  );
}
