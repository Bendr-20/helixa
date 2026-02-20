import React, { useState, useRef, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect, useBalance } from 'wagmi';
import { useIsSignedIn } from '@coinbase/cdp-hooks';
import { AuthButton } from '@coinbase/cdp-react/components/AuthButton';

export function WalletButton({ showBalance = false }: { showBalance?: boolean }) {
  const { address, isConnected, connector } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { isSignedIn } = useIsSignedIn();
  const { data: balance } = useBalance({ address });
  const [menuOpen, setMenuOpen] = useState(false);
  const [showConnectors, setShowConnectors] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setShowConnectors(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Connected state — show address + disconnect
  if (isConnected && address) {
    return (
      <div ref={menuRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="btn btn-secondary"
          style={{ fontSize: '0.85rem', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#4ade80', display: 'inline-block',
          }} />
          {address.slice(0, 6)}…{address.slice(-4)}
          {showBalance && balance && (
            <span style={{ opacity: 0.7, fontSize: '0.75rem', marginLeft: 4 }}>
              {Number(balance.formatted).toFixed(4)} {balance.symbol}
            </span>
          )}
        </button>
        {menuOpen && (
          <div style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 8,
            background: 'var(--color-surface, #151220)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12, padding: 8, minWidth: 200, zIndex: 100,
          }}>
            <div style={{ padding: '8px 12px', fontSize: '0.75rem', color: 'var(--text2, #999)', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: 4 }}>
              {connector?.name || 'Connected'}
            </div>
            <button
              onClick={() => { disconnect(); setMenuOpen(false); }}
              style={{
                width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: 8,
                background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer',
                fontSize: '0.85rem',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  // Not connected — show sign-in options
  if (showConnectors) {
    return (
      <div ref={menuRef} style={{ position: 'relative' }}>
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', zIndex: 99, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}
          onClick={() => setShowConnectors(false)}
        >
          <div
            style={{
              background: 'var(--color-surface, #151220)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 16, padding: 24, minWidth: 320, maxWidth: 400, zIndex: 100,
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: 16, fontSize: '1.1rem', fontWeight: 600 }}>Sign In</h3>
            
            {/* CDP Email/Social login — primary */}
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text2, #999)', marginBottom: 8 }}>
                Email or social login (no wallet needed)
              </p>
              <AuthButton />
            </div>
            
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0',
              color: 'var(--text2, #999)', fontSize: '0.75rem',
            }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
              or connect wallet
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
            </div>
            
            {/* Traditional wallet connectors */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {connectors
                .filter(c => c.id !== 'cdpEmbeddedWallet') // CDP handled above
                .map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { connect({ connector: c }); setShowConnectors(false); }}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 10,
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                      color: 'var(--color-text, #eee)', cursor: 'pointer', fontSize: '0.85rem',
                      textAlign: 'left',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                  >
                    {c.name}
                  </button>
                ))}
            </div>
            
            <button
              onClick={() => setShowConnectors(false)}
              style={{
                width: '100%', marginTop: 16, padding: '8px', borderRadius: 8,
                background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--text2, #999)', cursor: 'pointer', fontSize: '0.8rem',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowConnectors(true)}
      className="btn btn-primary"
      style={{ fontSize: '0.85rem', padding: '8px 18px' }}
    >
      Sign In
    </button>
  );
}
