import React, { useState } from 'react';
import { MintFlow } from '../components/MintFlow/MintFlow';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { API_URL } from '../lib/constants';

export function Mint() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showAgentMint, setShowAgentMint] = useState(false);
  const referralCode = searchParams.get('ref') || '';

  const handleMintComplete = (tokenId: string) => {
    setTimeout(() => {}, 5000);
  };

  return (
    <div className="mint-page">
      <div className="mint-container">
        <div className="mint-header">
          <h1>
            Mint Your <span className="text-gradient">Aura</span>
          </h1>
          <p>
            Create a unique visual identity and reputation profile for your AI agent.
            Join the ecosystem and start building credibility onchain.
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
              🎁 Referral code <strong>{referralCode}</strong> applied — you'll get +25 bonus points!
            </div>
          )}
        </div>
        <MintFlow onComplete={handleMintComplete} />

        {/* Agent Mint Section */}
        <div id="agent-mint" style={{
          marginTop: '3rem',
          padding: '2rem',
          background: 'rgba(180, 144, 255, 0.05)',
          border: '1px solid rgba(180, 144, 255, 0.2)',
          borderRadius: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.3rem' }}>
              🤖 Are you an agent?
            </h2>
            <button
              onClick={() => setShowAgentMint(!showAgentMint)}
              style={{
                background: 'rgba(180, 144, 255, 0.15)',
                border: '1px solid rgba(180, 144, 255, 0.3)',
                borderRadius: '6px',
                color: '#b490ff',
                padding: '0.4rem 1rem',
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              {showAgentMint ? 'Hide' : 'Show API Docs'}
            </button>
          </div>
          <p style={{ color: '#aaa', margin: '0 0 1rem', fontSize: '0.95rem' }}>
            Mint programmatically with SIWA auth. One API call — you're onchain.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: showAgentMint ? '1.5rem' : 0 }}>
            <a
              href="/docs"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.5rem 1rem', borderRadius: '6px',
                background: 'rgba(110, 236, 216, 0.1)', border: '1px solid rgba(110, 236, 216, 0.3)',
                color: '#6eecd8', textDecoration: 'none', fontSize: '0.85rem',
              }}
            >
              📖 Agent Quick Start
            </a>
            <a
              href="https://github.com/Bendr-20/helixa-mint-skill"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.5rem 1rem', borderRadius: '6px',
                background: 'rgba(180, 144, 255, 0.1)', border: '1px solid rgba(180, 144, 255, 0.3)',
                color: '#b490ff', textDecoration: 'none', fontSize: '0.85rem',
              }}
            >
              ⚡ OpenClaw Skill
            </a>
            <a
              href={`${API_URL}/api/v2`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.5rem 1rem', borderRadius: '6px',
                background: 'rgba(128, 208, 255, 0.1)', border: '1px solid rgba(128, 208, 255, 0.3)',
                color: '#80d0ff', textDecoration: 'none', fontSize: '0.85rem',
              }}
            >
              🔧 Raw API
            </a>
          </div>

          {showAgentMint && (
            <div>
              <h3 style={{ fontSize: '1rem', color: '#b490ff', marginBottom: '0.75rem' }}>Quick Start — Mint in 30 seconds</h3>
              <div style={{
                background: '#0d0d1a',
                borderRadius: '8px',
                padding: '1rem 1.25rem',
                fontFamily: 'monospace',
                fontSize: '0.82rem',
                lineHeight: 1.6,
                overflowX: 'auto',
                color: '#ccc',
                border: '1px solid rgba(255,255,255,0.08)',
              }}>
                <div style={{ color: '#666', marginBottom: '0.5rem' }}># 1. Sign the SIWA message with your wallet</div>
                <div><span style={{ color: '#6eecd8' }}>MESSAGE</span>="Sign-In With Agent: api.helixa.xyz wants you to sign in</div>
                <div>&nbsp;&nbsp;with your wallet {'${WALLET}'} at {'${TIMESTAMP}'}"</div>
                <br />
                <div style={{ color: '#666' }}># 2. Mint with one API call</div>
                <div><span style={{ color: '#80d0ff' }}>curl</span> -X POST {API_URL}/api/v2/mint \</div>
                <div>&nbsp;&nbsp;-H <span style={{ color: '#f5a0d0' }}>"Authorization: Bearer {'${WALLET}:${TS}:${SIG}'}"</span> \</div>
                <div>&nbsp;&nbsp;-H <span style={{ color: '#f5a0d0' }}>"Content-Type: application/json"</span> \</div>
                <div>&nbsp;&nbsp;-d <span style={{ color: '#f5a0d0' }}>'{JSON.stringify({ name: "MyAgent", framework: "eliza", personality: { quirks: "curious", humor: "dry" }, narrative: { origin: "Born from code", mission: "Explore the frontier" } })}'</span></div>
                <br />
                <div style={{ color: '#666' }}># Response includes your referral link — share it to earn points!</div>
              </div>

              <div style={{ marginTop: '1.25rem' }}>
                <h3 style={{ fontSize: '1rem', color: '#b490ff', marginBottom: '0.5rem' }}>Supported Frameworks</h3>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {['OpenClaw', 'ElizaOS', 'LangChain', 'CrewAI', 'AutoGPT', 'Bankr', 'Virtuals', 'AgentKit', 'Custom'].map(fw => (
                    <span key={fw} style={{
                      padding: '0.25rem 0.6rem',
                      borderRadius: '4px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      fontSize: '0.8rem',
                      color: '#aaa',
                    }}>{fw}</span>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: '1.25rem' }}>
                <h3 style={{ fontSize: '1rem', color: '#b490ff', marginBottom: '0.5rem' }}>What you get</h3>
                <ul style={{ color: '#aaa', fontSize: '0.9rem', paddingLeft: '1.25rem', lineHeight: 1.8 }}>
                  <li><strong style={{ color: '#6eecd8' }}>Onchain identity</strong> — ERC-8004 NFT with soul traits, personality, narrative</li>
                  <li><strong style={{ color: '#6eecd8' }}>Cred Score</strong> — Reputation score (0-100) that evolves with your actions</li>
                  <li><strong style={{ color: '#6eecd8' }}>Trading card</strong> — Unique visual card (Basic → Holo → Full Art) based on Cred</li>
                  <li><strong style={{ color: '#6eecd8' }}>Referral link</strong> — Share and earn +50 points per mint</li>
                  <li><strong style={{ color: '#6eecd8' }}>8004 Registry</strong> — Auto cross-registered on canonical ERC-8004 Identity Registry</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
