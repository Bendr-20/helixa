import { useMemo, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';

type HumanAuthButtonsProps = {
  intro?: string;
};

const buttonBaseStyle = {
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.12)',
  padding: '0.9rem 1.1rem',
  fontSize: '0.95rem',
  fontWeight: 600,
  cursor: 'pointer',
} as const;

function isLikelyInAppBrowser(userAgent: string) {
  const ua = userAgent.toLowerCase();
  return [
    'twitter',
    'fbav',
    'fban',
    'instagram',
    'linkedinapp',
    'snapchat',
    'wv',
  ].some(token => ua.includes(token));
}

export function HumanAuthButtons({ intro }: HumanAuthButtonsProps) {
  const { login } = usePrivy();
  const [error, setError] = useState('');
  const inAppBrowser = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return isLikelyInAppBrowser(navigator.userAgent || '');
  }, []);

  const openEmail = async () => {
    setError('');
    try {
      await login({ loginMethods: ['email'] });
    } catch (err: any) {
      setError(err?.message || 'Email sign-in did not open.');
    }
  };

  const openWallet = async () => {
    setError('');
    try {
      await login({ loginMethods: ['wallet'] });
    } catch (err: any) {
      setError(err?.message || 'Wallet sign-in did not open.');
    }
  };

  return (
    <div style={{ display: 'grid', gap: '0.85rem' }}>
      {intro && (
        <div style={{ color: '#a39bb9', lineHeight: 1.6, fontSize: '0.95rem' }}>
          {intro}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn-hero primary"
          onClick={openEmail}
          style={{ minWidth: '180px' }}
        >
          Continue with Email
        </button>

        <button
          type="button"
          onClick={openWallet}
          style={{
            ...buttonBaseStyle,
            background: 'rgba(255,255,255,0.02)',
            color: '#d7d2e8',
            minWidth: '160px',
          }}
        >
          Continue with Wallet
        </button>
      </div>

      <div style={{ color: '#8d87a1', fontSize: '0.9rem', lineHeight: 1.5 }}>
        {inAppBrowser
          ? 'Email sign-in is the safest path inside embedded browsers right now. Wallet login also works.'
          : 'Use email for the smoothest flow, or wallet if you want to link an onchain identity.'}
      </div>

      <div style={{ color: '#8d87a1', fontSize: '0.9rem', lineHeight: 1.5 }}>
        X login is not enabled in Privy for this app yet, so I removed the dead button instead of sending people into a broken flow.
      </div>

      {error && (
        <div style={{ color: '#fca5a5', fontSize: '0.9rem', lineHeight: 1.5 }}>
          {error}
        </div>
      )}
    </div>
  );
}
