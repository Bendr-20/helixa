import React from 'react';

interface CredBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showBreakdown?: boolean;
  breakdown?: {
    reputation: number;
    activity: number;
    contributions: number;
    verification: number;
  };
  className?: string;
}

export function CredBadge({ 
  score, 
  size = 'md', 
  showBreakdown = false, 
  breakdown,
  className = '' 
}: CredBadgeProps) {
  const sizes = {
    sm: { outer: 48, inner: 36, stroke: 3, text: '12px' },
    md: { outer: 80, inner: 60, stroke: 4, text: '16px' },
    lg: { outer: 120, inner: 90, stroke: 6, text: '24px' }
  };
  
  const config = sizes[size];
  const radius = config.inner / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  
  // Color gradient based on score
  const getScoreColor = (score: number) => {
    if (score >= 80) return '#4ade80'; // Green
    if (score >= 60) return '#fbbf24'; // Yellow
    if (score >= 40) return '#fb923c'; // Orange
    return '#ef4444'; // Red
  };

  const scoreColor = getScoreColor(score);
  
  return (
    <div className={`cred-badge ${className}`}>
      <div className="relative">
        <svg width={config.outer} height={config.outer} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={config.outer / 2}
            cy={config.outer / 2}
            r={radius}
            stroke="rgba(255, 255, 255, 0.1)"
            strokeWidth={config.stroke}
            fill="transparent"
          />
          
          {/* Progress circle */}
          <circle
            cx={config.outer / 2}
            cy={config.outer / 2}
            r={radius}
            stroke={scoreColor}
            strokeWidth={config.stroke}
            fill="transparent"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
            style={{
              filter: `drop-shadow(0 0 6px ${scoreColor}40)`
            }}
          />
        </svg>
        
        {/* Score text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span 
            className="font-bold text-center leading-none"
            style={{ 
              fontSize: config.text,
              color: scoreColor 
            }}
          >
            {score}
          </span>
          {size !== 'sm' && (
            <span className="text-xs text-muted mt-1">CRED</span>
          )}
        </div>
      </div>
      
      {/* Breakdown bars */}
      {showBreakdown && breakdown && size !== 'sm' && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-purple-400"></div>
            <span className="text-xs text-muted">Reputation</span>
            <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-purple-400 transition-all duration-500"
                style={{ width: `${breakdown.reputation}%` }}
              ></div>
            </div>
            <span className="text-xs font-medium">{breakdown.reputation}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-400"></div>
            <span className="text-xs text-muted">Activity</span>
            <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-400 transition-all duration-500"
                style={{ width: `${breakdown.activity}%` }}
              ></div>
            </div>
            <span className="text-xs font-medium">{breakdown.activity}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
            <span className="text-xs text-muted">Contributions</span>
            <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-cyan-400 transition-all duration-500"
                style={{ width: `${breakdown.contributions}%` }}
              ></div>
            </div>
            <span className="text-xs font-medium">{breakdown.contributions}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-orange-400"></div>
            <span className="text-xs text-muted">Verification</span>
            <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-orange-400 transition-all duration-500"
                style={{ width: `${breakdown.verification}%` }}
              ></div>
            </div>
            <span className="text-xs font-medium">{breakdown.verification}</span>
          </div>
        </div>
      )}
    </div>
  );
}