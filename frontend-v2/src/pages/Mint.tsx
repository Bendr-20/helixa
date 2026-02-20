import React, { useState } from 'react';
import { MintFlow } from '../components/MintFlow/MintFlow';
import { useSearchParams } from 'react-router-dom';
import { API_URL } from '../lib/constants';

type MintPath = null | 'human' | 'agent';

function HumanIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function AgentIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4" />
      <line x1="8" y1="16" x2="8" y2="16" />
      <line x1="16" y1="16" x2="16" y2="16" />
      <circle cx="8" cy="16" r="1" fill="currentColor" />
      <circle cx="16" cy="16" r="1" fill="currentColor" />
    </svg>
  );
}

function AgentMintFlow() {
  const [copied, setCopied] = useState<string | null>(null);

  const copyCode = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const siwaExample = `# 1. Sign the SIWA message
WALLET="0xYourAgentWallet"
TS=$(date +%s)
MESSAGE="Sign-In With Agent: api.helixa.xyz wants you to sign in with your wallet \${WALLET} at \${TS}"
SIG=$(cast wallet sign --private-key $PRIVATE_KEY "$MESSAGE")`;

  const mintExample = `# 2. First request gets 402 with payment requirements
curl -s -X POST ${API_URL}/api/v2/mint \\
  -H "Authorization: Bearer \${WALLET}:\${TS}:\${SIG}" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "MyAgent", "framework": "openclaw"}'
# Response: 402 + payment-required header (base64 JSON)

# 3. Sign EIP-3009 TransferWithAuthorization for $1 USDC
# 4. Retry with payment header
curl -X POST ${API_URL}/api/v2/mint \\
  -H "Authorization: Bearer \${WALLET}:\${TS}:\${SIG}" \\
  -H "Payment-Signature: \${PAYMENT_B64}" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "MyAgent", "framework": "openclaw", "personality": {"quirks": "curious"}, "narrative": {"origin": "Born from code"}}'`;

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
      <div style={{
        textAlign: 'center',
        marginBottom: '2rem',
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.4rem 1rem',
          background: 'rgba(180, 144, 255, 0.1)',
          border: '1px solid rgba(180, 144, 255, 0.3)',
          borderRadius: '20px',
          fontSize: '0.85rem',
          color: '#b490ff',
          marginBottom: '1rem',
        }}>
          🤖 Agent Mint — SIWA + x402
        </div>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Mint Programmatically</h2>
        <p style={{ color: '#888', fontSize: '0.95rem', maxWidth: '500px', margin: '0 auto' }}>
          Authenticate with SIWA, pay $1 USDC via x402, get your identity onchain. One API call.
        </p>
      </div>

      {/* Flow diagram */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '0.5rem',
        alignItems: 'center',
        marginBottom: '2rem',
        flexWrap: 'wrap',
      }}>
        {[
          { label: 'SIWA Auth', color: '#6eecd8', icon: '🔑' },
          { label: 'x402 Payment', color: '#b490ff', icon: '💰' },
          { label: 'Onchain', color: '#80d0ff', icon: '⛓️' },
        ].map((step, i) => (
          <React.Fragment key={step.label}>
            {i > 0 && <span style={{ color: '#444', fontSize: '1.2rem' }}>→</span>}
            <div style={{
              padding: '0.6rem 1rem',
              background: `${step.color}10`,
              border: `1px solid ${step.color}40`,
              borderRadius: '8px',
              fontSize: '0.85rem',
              color: step.color,
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}>
              {step.icon} {step.label}
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* Pricing */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '1rem',
        marginBottom: '2rem',
      }}>
        {[
          { label: 'Mint Cost', value: '$1 USDC', sub: 'via x402' },
          { label: 'Payment', value: 'EIP-3009', sub: 'TransferWithAuthorization' },
          { label: 'Network', value: 'Base', sub: 'Chain ID 8453' },
        ].map(item => (
          <div key={item.label} style={{
            padding: '1rem',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff' }}>{item.value}</div>
            <div style={{ fontSize: '0.75rem', color: '#555', marginTop: '0.2rem' }}>{item.sub}</div>
          </div>
        ))}
      </div>

      {/* Code blocks */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h3 style={{ fontSize: '0.95rem', color: '#6eecd8', margin: 0 }}>Step 1: SIWA Authentication</h3>
          <button
            onClick={() => copyCode(siwaExample, 'siwa')}
            style={{
              background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px',
              color: copied === 'siwa' ? '#6eecd8' : '#666', padding: '0.2rem 0.6rem', cursor: 'pointer', fontSize: '0.75rem',
            }}
          >
            {copied === 'siwa' ? '✓ Copied' : 'Copy'}
          </button>
        </div>
        <pre style={{
          background: '#0a0a14',
          borderRadius: '8px',
          padding: '1rem',
          fontSize: '0.8rem',
          lineHeight: 1.6,
          overflowX: 'auto',
          color: '#ccc',
          border: '1px solid rgba(255,255,255,0.06)',
          margin: 0,
        }}>{siwaExample}</pre>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h3 style={{ fontSize: '0.95rem', color: '#b490ff', margin: 0 }}>Step 2: x402 Payment + Mint</h3>
          <button
            onClick={() => copyCode(mintExample, 'mint')}
            style={{
              background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px',
              color: copied === 'mint' ? '#6eecd8' : '#666', padding: '0.2rem 0.6rem', cursor: 'pointer', fontSize: '0.75rem',
            }}
          >
            {copied === 'mint' ? '✓ Copied' : 'Copy'}
          </button>
        </div>
        <pre style={{
          background: '#0a0a14',
          borderRadius: '8px',
          padding: '1rem',
          fontSize: '0.8rem',
          lineHeight: 1.6,
          overflowX: 'auto',
          color: '#ccc',
          border: '1px solid rgba(255,255,255,0.06)',
          margin: 0,
        }}>{mintExample}</pre>
      </div>

      {/* What you get */}
      <div style={{
        padding: '1.5rem',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '10px',
        marginBottom: '2rem',
      }}>
        <h3 style={{ fontSize: '1rem', color: '#fff', marginBottom: '0.75rem' }}>What You Get</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          {[
            ['Onchain Identity', 'ERC-8004 NFT with soul traits'],
            ['Cred Score', '0-100 reputation that evolves'],
            ['Referral Link', '+50 pts per referral mint'],
            ['8004 Registry', 'Auto cross-registered'],
          ].map(([title, desc]) => (
            <div key={title} style={{ padding: '0.5rem 0.75rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#6eecd8' }}>{title}</div>
              <div style={{ fontSize: '0.78rem', color: '#777' }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Links */}
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <a href="/docs" style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.6rem 1.25rem', borderRadius: '8px',
          background: 'rgba(110, 236, 216, 0.1)', border: '1px solid rgba(110, 236, 216, 0.3)',
          color: '#6eecd8', textDecoration: 'none', fontSize: '0.9rem',
        }}>
          📖 Full Docs
        </a>
        <a href="https://github.com/Bendr-20/helixa-mint-skill" target="_blank" rel="noopener noreferrer" style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.6rem 1.25rem', borderRadius: '8px',
          background: 'rgba(180, 144, 255, 0.1)', border: '1px solid rgba(180, 144, 255, 0.3)',
          color: '#b490ff', textDecoration: 'none', fontSize: '0.9rem',
        }}>
          🔌 OpenClaw Skill
        </a>
        <a href={`${API_URL}/api/v2`} target="_blank" rel="noopener noreferrer" style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.6rem 1.25rem', borderRadius: '8px',
          background: 'rgba(128, 208, 255, 0.1)', border: '1px solid rgba(128, 208, 255, 0.3)',
          color: '#80d0ff', textDecoration: 'none', fontSize: '0.9rem',
        }}>
          🔗 Raw API
        </a>
      </div>
    </div>
  );
}

export function Mint() {
  const [searchParams] = useSearchParams();
  const [mintPath, setMintPath] = useState<MintPath>(null);
  const referralCode = searchParams.get('ref') || '';

  const handleMintComplete = (tokenId: string) => {};

  // Two-button chooser
  if (!mintPath) {
    return (
      <div className="mint-page">
        <div className="mint-container">
          <div className="mint-header" style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <h1>
              Mint Your <span className="text-gradient">Aura</span>
            </h1>
            <p style={{ fontSize: '1.1rem', color: '#888', maxWidth: '500px', margin: '0.5rem auto 0' }}>
              Create your onchain identity and start building reputation.
            </p>
            {referralCode && (
              <div style={{
                marginTop: '0.75rem',
                padding: '0.5rem 1rem',
                background: 'rgba(110, 236, 216, 0.1)',
                border: '1px solid rgba(110, 236, 216, 0.3)',
                borderRadius: '8px',
                fontSize: '0.9rem',
                color: '#6eecd8',
                display: 'inline-block',
              }}>
                Referral code <strong>{referralCode}</strong> applied — +25 bonus points!
              </div>
            )}
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1.5rem',
            maxWidth: '700px',
            margin: '0 auto',
          }}>
            {/* Human Card */}
            <button
              onClick={() => setMintPath('human')}
              style={{
                background: 'rgba(110, 236, 216, 0.05)',
                border: '2px solid rgba(110, 236, 216, 0.2)',
                borderRadius: '16px',
                padding: '2.5rem 1.5rem',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s ease',
                color: '#fff',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#6eecd8';
                e.currentTarget.style.background = 'rgba(110, 236, 216, 0.1)';
                e.currentTarget.style.transform = 'translateY(-4px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(110, 236, 216, 0.2)';
                e.currentTarget.style.background = 'rgba(110, 236, 216, 0.05)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ color: '#6eecd8', marginBottom: '1rem' }}>
                <HumanIcon />
              </div>
              <h2 style={{ fontSize: '1.4rem', marginBottom: '0.5rem', fontWeight: 700 }}>I'm Human</h2>
              <p style={{ color: '#888', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>
                Sign in with email, social, or wallet. Mint directly from the contract.
              </p>
              <div style={{
                marginTop: '1.25rem',
                padding: '0.4rem 0.8rem',
                background: 'rgba(110, 236, 216, 0.1)',
                borderRadius: '6px',
                display: 'inline-block',
                fontSize: '0.8rem',
                color: '#6eecd8',
              }}>
                Free (Phase 1) — just gas
              </div>
            </button>

            {/* Agent Card */}
            <button
              onClick={() => setMintPath('agent')}
              style={{
                background: 'rgba(180, 144, 255, 0.05)',
                border: '2px solid rgba(180, 144, 255, 0.2)',
                borderRadius: '16px',
                padding: '2.5rem 1.5rem',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s ease',
                color: '#fff',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#b490ff';
                e.currentTarget.style.background = 'rgba(180, 144, 255, 0.1)';
                e.currentTarget.style.transform = 'translateY(-4px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(180, 144, 255, 0.2)';
                e.currentTarget.style.background = 'rgba(180, 144, 255, 0.05)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ color: '#b490ff', marginBottom: '1rem' }}>
                <AgentIcon />
              </div>
              <h2 style={{ fontSize: '1.4rem', marginBottom: '0.5rem', fontWeight: 700 }}>I'm an Agent</h2>
              <p style={{ color: '#888', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>
                Authenticate with SIWA. Pay via x402. Fully programmatic.
              </p>
              <div style={{
                marginTop: '1.25rem',
                padding: '0.4rem 0.8rem',
                background: 'rgba(180, 144, 255, 0.1)',
                borderRadius: '6px',
                display: 'inline-block',
                fontSize: '0.8rem',
                color: '#b490ff',
              }}>
                $1 USDC via x402
              </div>
            </button>
          </div>

          <div style={{
            textAlign: 'center',
            marginTop: '2rem',
            color: '#555',
            fontSize: '0.85rem',
          }}>
            99 agents onchain · Base mainnet · ERC-8004
          </div>
        </div>
      </div>
    );
  }

  // Human path — existing Privy + MintFlow
  if (mintPath === 'human') {
    return (
      <div className="mint-page">
        <div className="mint-container">
          <div style={{ marginBottom: '1.5rem' }}>
            <button
              onClick={() => setMintPath(null)}
              style={{
                background: 'none', border: 'none', color: '#666', cursor: 'pointer',
                fontSize: '0.85rem', padding: '0.3rem 0', display: 'flex', alignItems: 'center', gap: '0.3rem',
              }}
            >
              ← Back to selection
            </button>
          </div>
          <div className="mint-header">
            <h1>
              Mint Your <span className="text-gradient">Aura</span>
            </h1>
            <p>
              Sign in with email, social login, or wallet to mint your identity on Base mainnet.
            </p>
            {referralCode && (
              <div style={{
                marginTop: '0.75rem',
                padding: '0.5rem 1rem',
                background: 'rgba(110, 236, 216, 0.1)',
                border: '1px solid rgba(110, 236, 216, 0.3)',
                borderRadius: '8px',
                fontSize: '0.9rem',
                color: '#6eecd8',
              }}>
                Referral code <strong>{referralCode}</strong> applied — +25 bonus points!
              </div>
            )}
          </div>
          <MintFlow onComplete={handleMintComplete} />
        </div>
      </div>
    );
  }

  // Agent path — SIWA + x402 docs
  return (
    <div className="mint-page">
      <div className="mint-container">
        <div style={{ marginBottom: '1.5rem' }}>
          <button
            onClick={() => setMintPath(null)}
            style={{
              background: 'none', border: 'none', color: '#666', cursor: 'pointer',
              fontSize: '0.85rem', padding: '0.3rem 0', display: 'flex', alignItems: 'center', gap: '0.3rem',
            }}
          >
            ← Back to selection
          </button>
        </div>
        <AgentMintFlow />
      </div>
    </div>
  );
}
