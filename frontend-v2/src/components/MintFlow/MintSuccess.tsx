import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShareCard } from '../ShareCard';
import { MintData } from './MintFlow';
import { API_URL } from '../../lib/constants';

interface MintSuccessProps {
  tokenId: string;
  agentData: MintData;
  referralCode?: string;
}

export function MintSuccess({ tokenId, agentData, referralCode: initialRefCode }: MintSuccessProps) {
  const [copySuccess, setCopySuccess] = useState<string>('');
  const [referralCode, setReferralCode] = useState(initialRefCode || '');
  const [referralLink, setReferralLink] = useState('');

  useEffect(() => {
    // Fetch referral code if not provided
    if (!referralCode) {
      fetch(`${API_URL}/api/v2/agent/${tokenId}/referral`)
        .then(r => r.json())
        .then(data => {
          if (data.code) {
            setReferralCode(data.code);
            setReferralLink(data.link);
          }
        })
        .catch(() => {});
    } else {
      setReferralLink(`https://helixa.xyz/mint?ref=${referralCode}`);
    }
  }, [tokenId, referralCode]);
  
  const profileUrl = `${window.location.origin}/agent/${tokenId}`;
  const mintUrl = referralLink || `${window.location.origin}/mint`;
  
  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(type);
      setTimeout(() => setCopySuccess(''), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };
  
  const shareOnTwitter = () => {
    const tweetText = `Just minted my onchain identity on @HelixaXYZ\n\nMeet ${agentData.name} -- ERC-8004 agent with soul traits, Cred Score, and a trading card\n\nMint yours: ${mintUrl}`;
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(tweetUrl, '_blank');
  };

  const shareOnFarcaster = () => {
    const castText = `Just minted my onchain identity on Helixa\n\nMeet ${agentData.name} -- ERC-8004 agent with soul traits, Cred Score, and a trading card\n\nMint yours: ${mintUrl}`;
    const warpcastUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(castText)}`;
    window.open(warpcastUrl, '_blank');
  };
  
  const shareOnTelegram = () => {
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(mintUrl)}&text=${encodeURIComponent(`Meet ${agentData.name} — just minted my onchain identity on Helixa `)}`;
    window.open(telegramUrl, '_blank');
  };
  
  const shareOnDiscord = () => {
    const text = `Meet ${agentData.name} — just minted my onchain identity on Helixa \n\nMint yours: ${mintUrl}`;
    copyToClipboard(text, 'discord');
  };

  // Count traits for rarity
  const traitCount = [
    agentData.temperament,
    agentData.communicationStyle,
    agentData.alignment,
    agentData.specialization,
    agentData.origin,
    agentData.mission,
    agentData.lore,
    agentData.manifesto,
    agentData.riskTolerance != null,
    agentData.autonomyLevel != null,
    agentData.soulbound,
    agentData.framework,
    agentData.name,
  ].filter(Boolean).length;
  
  return (
    <div className="max-w-4xl mx-auto text-center">
      {/* Success header */}
      <div className="mb-8">
        <div className="w-20 h-20 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-3xl font-heading font-bold text-gradient mb-2">
          Agent Minted Successfully
        </h2>
        <p className="text-muted text-lg">
          Welcome <span className="text-accent-purple font-semibold">{agentData.name}</span> to the Helixa ecosystem
        </p>
      </div>

      {/* Trading Card */}
      <div className="mb-8 flex justify-center">
        <ShareCard
          agentData={{
            name: agentData.name,
            agentAddress: agentData.agentAddress,
            framework: agentData.framework,
            points: 0,
            traitCount,
            mutationCount: 0,
            soulbound: agentData.soulbound,
            temperament: agentData.temperament,
            communicationStyle: agentData.communicationStyle,
            riskTolerance: agentData.riskTolerance,
            autonomyLevel: agentData.autonomyLevel,
            alignment: agentData.alignment,
            specialization: agentData.specialization,
          }}
          tokenId={tokenId}
          credScore={0}
        />
      </div>
      
      {/* Referral & Share Section */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-2">Share & Earn Points</h3>
        <p className="text-muted text-sm mb-4">
          Every mint through your link earns you <strong style={{ color: '#6eecd8' }}>+50 points</strong>
        </p>
        
        {/* Referral Link */}
        {referralLink && (
          <div className="glass-card p-4 mb-4" style={{ borderColor: 'rgba(110, 236, 216, 0.3)' }}>
            <div style={{ fontSize: '0.8rem', color: '#6eecd8', marginBottom: '0.4rem', fontWeight: 600 }}>
              Your Referral Link
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={referralLink}
                readOnly
                className="input flex-1 text-sm font-mono"
              />
              <button
                onClick={() => copyToClipboard(referralLink, 'referral')}
                className="btn btn-secondary btn-sm"
              >
                {copySuccess === 'referral' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        {/* Profile URL */}
        <div className="glass-card p-4 mb-4">
          <div style={{ fontSize: '0.8rem', color: '#b490ff', marginBottom: '0.4rem', fontWeight: 600 }}>
            Agent Profile
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={profileUrl}
              readOnly
              className="input flex-1 text-sm font-mono"
            />
            <button
              onClick={() => copyToClipboard(profileUrl, 'url')}
              className="btn btn-secondary btn-sm"
            >
              {copySuccess === 'url' ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
        
        {/* Social Share Buttons */}
        <div className="flex justify-center gap-3 flex-wrap">
          <button onClick={shareOnTwitter} className="btn btn-secondary flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            Share on X
          </button>

          <button onClick={shareOnFarcaster} className="btn btn-secondary flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M5.24 3h13.52v1.2H5.24V3zm-1.2 2.4h15.92L21.16 9H18v9.6c0 .66.54 1.2 1.2 1.2h.6V21h-.6c-1.32 0-2.4-1.08-2.4-2.4V9h-9.6v9.6c0 1.32-1.08 2.4-2.4 2.4h-.6v-1.2h.6c.66 0 1.2-.54 1.2-1.2V9H2.84l1.2-3.6z"/>
            </svg>
            Share on Farcaster
          </button>
          
          <button onClick={shareOnTelegram} className="btn btn-secondary flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
            </svg>
            Telegram
          </button>
          
          <button onClick={shareOnDiscord} className="btn btn-secondary flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
            </svg>
            {copySuccess === 'discord' ? 'Copied!' : 'Discord'}
          </button>
        </div>
      </div>
      
      {/* Next Steps */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="glass-card p-6 text-center">
          <div className="w-12 h-12 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>
          </div>
          <h4 className="font-semibold mb-2">View Profile</h4>
          <p className="text-sm text-muted mb-4">Explore your agent's full profile, stats, and visual aura.</p>
          <Link to={`/agent/${tokenId}`} className="btn btn-secondary btn-sm">View Profile</Link>
        </div>
        
        <div className="glass-card p-6 text-center">
          <div className="w-12 h-12 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </div>
          <h4 className="font-semibold mb-2">Start Earning</h4>
          <p className="text-sm text-muted mb-4">Participate in the ecosystem to earn Cred Score and points.</p>
          <a href="#" className="btn btn-secondary btn-sm">Learn More</a>
        </div>
        
        <div className="glass-card p-6 text-center">
          <div className="w-12 h-12 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>
          </div>
          <h4 className="font-semibold mb-2">Explore Agents</h4>
          <p className="text-sm text-muted mb-4">Discover other agents and see where yours ranks.</p>
          <Link to="/leaderboard" className="btn btn-secondary btn-sm">Leaderboard</Link>
        </div>
      </div>
      
      {/* Action Buttons */}
      <div className="flex justify-center gap-4 flex-wrap">
        <Link to={`/agent/${tokenId}`} className="btn btn-primary">View Agent Profile</Link>
        <Link to="/mint" className="btn btn-secondary">Mint Another</Link>
        <Link to="/agents" className="btn btn-ghost">Explore Directory</Link>
      </div>
    </div>
  );
}
