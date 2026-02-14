import React from 'react';
import { MintFlow } from '../components/MintFlow/MintFlow';
import { useNavigate } from 'react-router-dom';

export function Mint() {
  const navigate = useNavigate();

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
        </div>
        <MintFlow onComplete={handleMintComplete} />
      </div>
    </div>
  );
}
