import React, { useRef, useCallback } from 'react';
import { toPng } from 'html-to-image';
import { generateAura, AgentData } from '../lib/aura';

interface ShareCardProps {
  agentData: AgentData;
  tokenId: string;
  credScore?: number;
}

function getRarity(traitCount: number): 'common' | 'rare' | 'epic' | 'legendary' {
  if (traitCount >= 13) return 'legendary';
  if (traitCount >= 9) return 'epic';
  if (traitCount >= 5) return 'rare';
  return 'common';
}

export async function downloadShareCard(element: HTMLElement | null) {
  if (!element) return;
  try {
    const dataUrl = await toPng(element, {
      cacheBust: true,
      pixelRatio: 2,
      width: 400,
      height: 560,
    });
    const link = document.createElement('a');
    link.download = 'helixa-agent-card.png';
    link.href = dataUrl;
    link.click();
  } catch (err) {
    console.error('Failed to generate card image:', err);
  }
}

function StatBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="sc-stat-row">
      <span className="sc-stat-label">{label}</span>
      <div className="sc-stat-track">
        <div className="sc-stat-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="sc-stat-value">{value}</span>
    </div>
  );
}

export function ShareCard({ agentData, tokenId, credScore = 0 }: ShareCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const traitCount = agentData.traitCount ?? 0;
  const rarity = getRarity(traitCount);

  const auraSvg = generateAura(agentData, 160);

  const pills = [
    agentData.temperament && { label: agentData.temperament, color: '#b490ff' },
    agentData.alignment && { label: agentData.alignment, color: '#6eecd8' },
    agentData.communicationStyle && { label: agentData.communicationStyle, color: '#80d0ff' },
    agentData.specialization && { label: agentData.specialization, color: '#f5a0d0' },
  ].filter(Boolean) as { label: string; color: string }[];

  const handleDownload = useCallback(() => {
    downloadShareCard(cardRef.current);
  }, []);

  return (
    <div className="sc-wrapper">
      <div ref={cardRef} className={`share-card sc-rarity-${rarity}`}>
        {/* Inner border glow */}
        <div className="sc-border-glow" />

        <div className="sc-inner">
          {/* Header */}
          <div className="sc-header">
            <h2 className="sc-name">{agentData.name || 'Unnamed Agent'}</h2>
            <span className="sc-token-badge">#{tokenId}</span>
          </div>

          {/* Artwork */}
          <div className="sc-artwork">
            <div
              className="sc-aura"
              dangerouslySetInnerHTML={{ __html: auraSvg }}
            />
          </div>

          {/* Type bar */}
          <div className="sc-type-bar">
            <span className="sc-framework-pill">{agentData.framework || 'Unknown'}</span>
            <div className="sc-badges">
              {agentData.soulbound && <span className="sc-badge sc-badge-soulbound">SOULBOUND</span>}
              <span className="sc-badge sc-badge-verified">VERIFIED</span>
            </div>
          </div>

          {/* Stats */}
          <div className="sc-stats">
            <StatBar label="RISK" value={agentData.riskTolerance ?? 50} max={100} color="#f5a0d0" />
            <StatBar label="AUTO" value={agentData.autonomyLevel ?? 50} max={100} color="#80d0ff" />
            <StatBar label="CRED" value={credScore} max={1000} color="#6eecd8" />
          </div>

          {/* Personality tags */}
          {pills.length > 0 && (
            <div className="sc-tags">
              {pills.map((p) => (
                <span key={p.label} className="sc-tag" style={{ borderColor: p.color, color: p.color }}>
                  {p.label}
                </span>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="sc-footer">
            <span className="sc-brand">helixa.xyz</span>
            <span className="sc-erc-badge">ERC-8004</span>
          </div>
        </div>
      </div>

      <button onClick={handleDownload} className="sc-download-btn">
        Download Card
      </button>
    </div>
  );
}
