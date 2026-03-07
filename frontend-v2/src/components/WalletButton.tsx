import React from 'react';
import { usePrivy } from '@privy-io/react-auth';

export function WalletButton({ showBalance = false }: { showBalance?: boolean }) {
  const { ready, authenticated, login, logout, user } = usePrivy();

  if (!ready) return null;

  if (authenticated && user) {
    const wallet = user.wallet;
    const addr = wallet?.address;
    const display = addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : (user.email?.address || 'Connected');

    return (
      <button
        onClick={logout}
        className="btn btn-secondary"
        style={{ fontSize: '0.85rem', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
      >
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: '#4ade80', display: 'inline-block',
        }} />
        {display}
      </button>
    );
  }

  return (
    <button
      onClick={login}
      className="btn btn-primary"
      style={{ fontSize: '0.85rem', padding: '8px 18px' }}
    >
      Sign In
    </button>
  );
}
