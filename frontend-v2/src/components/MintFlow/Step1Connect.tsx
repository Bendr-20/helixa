import React from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';

interface Step1ConnectProps {
  onNext: () => void;
  canProceed: boolean;
}

export function Step1Connect({ onNext, canProceed }: Step1ConnectProps) {
  const { address, isConnected } = useAccount();

  return (
    <div className="mf-connect">
      {/* Header */}
      <div className="mf-connect-header">
        <div className="mf-connect-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h3>Connect Your Wallet</h3>
        <p>Connect your wallet to mint your aura on Base mainnet.</p>
      </div>

      {/* Status */}
      {isConnected ? (
        <div className="mf-connect-status connected">
          <div className="mf-status-dot green"></div>
          <div>
            <div className="mf-status-label connected">Wallet Connected</div>
            <div className="mf-status-address">{address?.slice(0, 6)}...{address?.slice(-4)}</div>
          </div>
        </div>
      ) : (
        <div className="mf-connect-status disconnected">
          <div className="mf-status-row">
            <div className="mf-status-dot yellow"></div>
            <div className="mf-status-label disconnected">No Wallet Connected</div>
          </div>
          <div className="mf-connect-btn">
            <ConnectButton />
          </div>
        </div>
      )}

      {/* Info Cards */}
      <div className="mf-info-cards">
        <div className="mf-info-card">
          <h4>Base Mainnet</h4>
          <p>Your aura will be minted on Base, Coinbase's L2 network with low fees and fast transactions.</p>
        </div>
        <div className="mf-info-card">
          <h4>Secure Minting</h4>
          <p>All agent data is stored onchain. Your wallet signature is required for minting.</p>
        </div>
        <div className="mf-info-card">
          <h4>Low Cost</h4>
          <p>Minting typically costs less than $1 in gas fees on Base network.</p>
        </div>
      </div>

      {/* Nav */}
      <div className="mf-nav">
        <div></div>
        <button onClick={onNext} disabled={!canProceed} className="btn btn-primary">
          Continue
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
