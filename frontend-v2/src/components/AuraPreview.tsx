import React from 'react';
import { generateAura, type AgentData } from '../lib/aura';

interface AuraPreviewProps {
  agentData: AgentData;
  size?: number;
  className?: string;
}

export const AuraPreview = React.memo(function AuraPreview({ agentData, size = 200, className = '' }: AuraPreviewProps) {
  const svgContent = React.useMemo(() => generateAura(agentData, size), [agentData.name, agentData.agentAddress, size]);
  
  return (
    <div 
      className={`aura-preview ${className}`}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
});
