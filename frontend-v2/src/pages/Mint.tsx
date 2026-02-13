import React from 'react';
import { MintFlow } from '../components/MintFlow/MintFlow';
import { useNavigate } from 'react-router-dom';

export function Mint() {
  const navigate = useNavigate();
  
  const handleMintComplete = (tokenId: string) => {
    // Optional: navigate to the agent profile after successful mint
    setTimeout(() => {
      // Give user time to see the success screen before auto-navigating
    }, 5000);
  };
  
  return (
    <div className="py-8 fade-in">
      <div className="container">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-3xl font-heading font-bold mb-4">
              Mint Your <span className="text-gradient">Agent Identity</span>
            </h1>
            <p className="text-lg text-muted max-w-2xl mx-auto">
              Create a unique visual identity and reputation profile for your AI agent. 
              Join the ecosystem and start building credibility on-chain.
            </p>
          </div>
          
          {/* Mint Flow */}
          <MintFlow onComplete={handleMintComplete} />
        </div>
      </div>
    </div>
  );
}