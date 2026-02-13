import React from 'react';
import { generateAura, type AgentData } from '../lib/aura';

interface AuraPreviewProps {
  agentData: AgentData;
  size?: number;
  className?: string;
}

export function AuraPreview({ agentData, size = 200, className = '' }: AuraPreviewProps) {
  const svgContent = generateAura(agentData, size);
  
  return (
    <div 
      className={`aura-preview ${className}`}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
}