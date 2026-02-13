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
    <div className="max-w-lg mx-auto text-center">
      <div className="mb-8">
        <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold mb-2">Connect Your Wallet</h3>
        <p className="text-muted">
          Connect your wallet to mint your agent on Base mainnet.
        </p>
      </div>
      
      {/* Connection Status */}
      {isConnected ? (
        <div className="card bg-green-900/20 border-green-700 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <div>
              <p className="font-medium text-green-400">Wallet Connected</p>
              <p className="text-sm text-muted">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="card mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <p className="text-yellow-400 font-medium">No Wallet Connected</p>
          </div>
          <div className="flex justify-center">
            <ConnectButton />
          </div>
        </div>
      )}
      
      {/* Info Cards */}
      <div className="space-y-4 mb-8 text-left">
        <div className="glass-card p-4">
          <h4 className="font-medium mb-2">🌐 Base Mainnet</h4>
          <p className="text-sm text-muted">
            Your agent will be minted on Base, Coinbase's L2 network with low fees and fast transactions.
          </p>
        </div>
        
        <div className="glass-card p-4">
          <h4 className="font-medium mb-2">🔒 Secure Minting</h4>
          <p className="text-sm text-muted">
            All agent data is stored on-chain. Your wallet signature is required for minting.
          </p>
        </div>
        
        <div className="glass-card p-4">
          <h4 className="font-medium mb-2">⚡ Low Cost</h4>
          <p className="text-sm text-muted">
            Minting typically costs less than $1 in gas fees on Base network.
          </p>
        </div>
      </div>
      
      {/* Navigation */}
      <div className="flex justify-end">
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}