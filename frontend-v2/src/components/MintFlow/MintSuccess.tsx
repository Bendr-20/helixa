import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AuraPreview } from '../AuraPreview';
import { MintData } from './MintFlow';

interface MintSuccessProps {
  tokenId: string;
  agentData: MintData;
}

export function MintSuccess({ tokenId, agentData }: MintSuccessProps) {
  const [copySuccess, setCopySuccess] = useState<string>('');
  
  const profileUrl = `${window.location.origin}/agent/${tokenId}`;
  const shareText = `Meet ${agentData.name}! 🤖\n\nJust minted my agent on Helixa V2 ✨\n\n${profileUrl}`;
  
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
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&hashtags=HelixaV2,AI,Web3`;
    window.open(tweetUrl, '_blank');
  };
  
  const shareOnTelegram = () => {
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(profileUrl)}&text=${encodeURIComponent(`Meet ${agentData.name}! Just minted my agent on Helixa V2 ✨`)}`;
    window.open(telegramUrl, '_blank');
  };
  
  const shareOnDiscord = () => {
    // Discord doesn't have a direct share URL, so copy to clipboard
    copyToClipboard(shareText, 'discord');
  };
  
  return (
    <div className="max-w-4xl mx-auto text-center">
      {/* Success Animation */}
      <div className="mb-8">
        <div className="w-20 h-20 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-3xl font-heading font-bold text-gradient mb-2">
          🎉 Agent Minted Successfully!
        </h2>
        <p className="text-muted text-lg">
          Welcome <span className="text-accent-purple font-semibold">{agentData.name}</span> to the Helixa ecosystem
        </p>
      </div>
      
      {/* Agent Card */}
      <div className="card max-w-2xl mx-auto mb-8 relative overflow-hidden">
        {/* Background glow effect */}
        <div className="absolute inset-0 bg-gradient-primary opacity-10 blur-3xl"></div>
        
        <div className="relative grid md:grid-cols-2 gap-6 items-center">
          {/* Aura */}
          <div className="flex justify-center">
            <AuraPreview 
              agentData={{
                name: agentData.name,
                agentAddress: agentData.agentAddress,
                framework: agentData.framework,
                points: 0,
                traitCount: 12, // Estimate based on filled fields
                mutationCount: 0,
                soulbound: agentData.soulbound,
                temperament: agentData.temperament,
                communicationStyle: agentData.communicationStyle,
                riskTolerance: agentData.riskTolerance,
                autonomyLevel: agentData.autonomyLevel,
                alignment: agentData.alignment,
                specialization: agentData.specialization,
              }}
              size={200}
            />
          </div>
          
          {/* Details */}
          <div className="text-left space-y-3">
            <div>
              <h3 className="text-xl font-semibold">{agentData.name}</h3>
              <p className="text-muted">Token ID: #{tokenId}</p>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Framework:</span>
                <span className="badge">{agentData.framework}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Type:</span>
                <span className={`badge ${agentData.soulbound ? 'bg-purple-900/30 text-purple-300' : 'bg-green-900/30 text-green-300'}`}>
                  {agentData.soulbound ? '🔒 Soulbound' : '🔄 Transferable'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Specialization:</span>
                <span className="font-medium capitalize">{agentData.specialization}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Cred Score:</span>
                <span className="font-bold text-accent-purple">0</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Share Section */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">Share Your Agent</h3>
        
        {/* Share URL */}
        <div className="glass-card p-4 mb-4">
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
              {copySuccess === 'url' ? '✓ Copied!' : 'Copy'}
            </button>
          </div>
        </div>
        
        {/* Social Share Buttons */}
        <div className="flex justify-center gap-3 flex-wrap">
          <button
            onClick={shareOnTwitter}
            className="btn btn-secondary flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            Twitter
          </button>
          
          <button
            onClick={shareOnTelegram}
            className="btn btn-secondary flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
            </svg>
            Telegram
          </button>
          
          <button
            onClick={shareOnDiscord}
            className="btn btn-secondary flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
            </svg>
            {copySuccess === 'discord' ? '✓ Copied!' : 'Discord'}
          </button>
        </div>
      </div>
      
      {/* Next Steps */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="glass-card p-6 text-center">
          <div className="w-12 h-12 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-xl">📊</span>
          </div>
          <h4 className="font-semibold mb-2">View Profile</h4>
          <p className="text-sm text-muted mb-4">
            Explore your agent's full profile, stats, and visual aura.
          </p>
          <Link to={`/agent/${tokenId}`} className="btn btn-secondary btn-sm">
            View Profile
          </Link>
        </div>
        
        <div className="glass-card p-6 text-center">
          <div className="w-12 h-12 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-xl">🎯</span>
          </div>
          <h4 className="font-semibold mb-2">Start Earning</h4>
          <p className="text-sm text-muted mb-4">
            Participate in the ecosystem to earn Cred Score and points.
          </p>
          <a href="#" className="btn btn-secondary btn-sm">
            Learn More
          </a>
        </div>
        
        <div className="glass-card p-6 text-center">
          <div className="w-12 h-12 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-xl">🏆</span>
          </div>
          <h4 className="font-semibold mb-2">Explore Agents</h4>
          <p className="text-sm text-muted mb-4">
            Discover other agents and see where yours ranks.
          </p>
          <Link to="/leaderboard" className="btn btn-secondary btn-sm">
            Leaderboard
          </Link>
        </div>
      </div>
      
      {/* Action Buttons */}
      <div className="flex justify-center gap-4 flex-wrap">
        <Link to={`/agent/${tokenId}`} className="btn btn-primary">
          <span>👁️</span>
          View Agent Profile
        </Link>
        
        <Link to="/mint" className="btn btn-secondary">
          <span>➕</span>
          Mint Another
        </Link>
        
        <Link to="/agents" className="btn btn-ghost">
          <span>🌐</span>
          Explore Directory
        </Link>
      </div>
      
      {/* Celebration particles effect - simple CSS animation */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}