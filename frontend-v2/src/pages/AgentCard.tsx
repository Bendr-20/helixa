import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Lock, Unlock, Share2, Handshake, Globe, Mail, ExternalLink } from 'lucide-react';
import { XLogo, GitHubLogo } from '../components/Icons';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.helixa.xyz';

interface CardData {
  tokenId: number;
  name: string;
  framework: string;
  credScore: number;
  soulLocked: boolean;
  soulVersion: number;
  handshakeCount: number;
  socials: Record<string, string>;
  capabilities: string[];
  registeredAt: string;
  cardUrl: string;
}

function getTierInfo(score: number) {
  if (score >= 91) return { label: 'Legendary', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' };
  if (score >= 76) return { label: 'Prime', color: '#a855f7', bg: 'rgba(168,85,247,0.15)' };
  if (score >= 51) return { label: 'Qualified', color: '#06b6d4', bg: 'rgba(6,182,212,0.15)' };
  if (score >= 26) return { label: 'Marginal', color: '#6b7280', bg: 'rgba(107,114,128,0.15)' };
  return { label: 'Unrated', color: '#374151', bg: 'rgba(55,65,81,0.15)' };
}

export default function AgentCard() {
  const { id } = useParams<{ id: string }>();
  const [card, setCard] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/v2/agent/${id}/card`)
      .then(r => { if (!r.ok) throw new Error('Agent not found'); return r.json(); })
      .then(setCard)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500" />
    </div>
  );

  if (error || !card) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-400 text-xl mb-4">{error || 'Agent not found'}</p>
        <Link to="/agents" className="text-purple-400 hover:text-purple-300">← Browse agents</Link>
      </div>
    </div>
  );

  const tier = getTierInfo(card.credScore);
  const cardUrl = `${window.location.origin}/card/${card.tokenId}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(cardUrl)}&bgcolor=0a0812&color=a855f7`;

  const handleShare = () => {
    navigator.clipboard.writeText(cardUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="min-h-screen py-8 px-4 flex items-center justify-center">
      <div className="w-full max-w-2xl">
        {/* Card — opalescent gradient border */}
        <div className="relative rounded-3xl p-[3px] shadow-2xl shadow-purple-500/30"
          style={{
            background: 'linear-gradient(135deg, #a855f7 0%, #22d3ee 20%, #e9a8ff 40%, #67e8f9 60%, #c084fc 80%, #a855f7 100%)',
          }}>
          <div className="rounded-[22px] bg-[#0a0812] overflow-hidden">
          <div className="p-8 md:p-10">
            {/* Header */}
            <div className="flex items-start justify-between mb-8">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{card.name}</h1>
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {card.framework}
                  </span>
                  <span className="text-gray-500 text-sm">#{card.tokenId}</span>
                </div>
              </div>
              <img src={qrUrl} alt="QR" className="w-20 h-20 md:w-24 md:h-24 rounded-lg opacity-80" />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="rounded-2xl p-4 text-center" style={{ background: tier.bg, border: `1px solid ${tier.color}33` }}>
                <div className="text-xs uppercase tracking-wider mb-1" style={{ color: tier.color }}>Cred Score</div>
                <div className="text-3xl font-bold" style={{ color: tier.color }}>{card.credScore}</div>
                <div className="text-xs mt-1" style={{ color: tier.color }}>{tier.label}</div>
              </div>
              <div className="rounded-2xl p-4 text-center bg-cyan-500/10 border border-cyan-500/20">
                <div className="text-xs uppercase tracking-wider text-cyan-400 mb-1">Handshakes</div>
                <div className="text-3xl font-bold text-cyan-300">{card.handshakeCount}</div>
                <div className="text-xs text-cyan-400 mt-1">connections</div>
              </div>
              <div className="rounded-2xl p-4 text-center bg-white/5 border border-white/10">
                <div className="text-xs uppercase tracking-wider text-gray-400 mb-1">Soul</div>
                <div className="text-2xl mt-1">
                  {card.soulLocked ? <Lock className="w-8 h-8 text-green-400 mx-auto" /> : <Unlock className="w-8 h-8 text-gray-500 mx-auto" />}
                </div>
                <div className="text-xs text-gray-400 mt-1">{card.soulLocked ? `v${card.soulVersion}` : 'unlocked'}</div>
              </div>
            </div>

            {/* Capabilities */}
            {card.capabilities.length > 0 && (
              <div className="mb-6">
                <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">Capabilities</div>
                <div className="flex flex-wrap gap-2">
                  {card.capabilities.map((c, i) => (
                    <span key={i} className="px-2 py-1 rounded-lg text-xs bg-white/5 text-gray-300 border border-white/10">{c}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Socials */}
            {Object.keys(card.socials).length > 0 && (
              <div className="flex items-center gap-4 mb-8">
                {card.socials.x && (
                  <a href={`https://x.com/${card.socials.x.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                    className="text-gray-400 hover:text-white transition-colors">
                    <XLogo className="w-5 h-5" />
                  </a>
                )}
                {card.socials.github && (
                  <a href={`https://github.com/${card.socials.github}`} target="_blank" rel="noopener noreferrer"
                    className="text-gray-400 hover:text-white transition-colors">
                    <GitHubLogo className="w-5 h-5" />
                  </a>
                )}
                {card.socials.website && (
                  <a href={card.socials.website} target="_blank" rel="noopener noreferrer"
                    className="text-gray-400 hover:text-white transition-colors">
                    <Globe className="w-5 h-5" />
                  </a>
                )}
                {card.socials.telegram && (
                  <a href={`https://t.me/${card.socials.telegram.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                    className="text-gray-400 hover:text-white transition-colors text-lg">
                    ✈️
                  </a>
                )}
                {card.socials.email && (
                  <a href={`mailto:${card.socials.email}`} className="text-gray-400 hover:text-white transition-colors">
                    <Mail className="w-5 h-5" />
                  </a>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Link to="/soul-handshake" className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-medium transition-all">
                <Handshake className="w-5 h-5" /> Handshake with this Agent
              </Link>
              <button onClick={handleShare} className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium transition-all border border-white/10">
                <Share2 className="w-5 h-5" /> {copied ? 'Copied!' : 'Share Card'}
              </button>
            </div>

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
              <Link to={`/agent/${card.tokenId}`} className="text-sm text-gray-500 hover:text-purple-400 flex items-center gap-1">
                <ExternalLink className="w-3 h-3" /> Full Profile
              </Link>
              <span className="text-xs text-gray-600">helixa.xyz</span>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
