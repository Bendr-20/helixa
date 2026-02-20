import React from 'react';
import { CDPReactProvider } from '@coinbase/cdp-react';
import { createCDPEmbeddedWalletConnector } from '@coinbase/cdp-wagmi';
import { WagmiProvider, createConfig } from 'wagmi';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { http } from 'viem';
import { coinbaseWallet, injected } from 'wagmi/connectors';
import { CHAIN, BASE_RPC_URL } from '../lib/constants';
import type { Config } from '@coinbase/cdp-core';

const CDP_PROJECT_ID = import.meta.env.VITE_CDP_PROJECT_ID || '3935377c-11d5-418b-bfa9-1308476c0f5a';

const cdpConfig: Config = {
  projectId: CDP_PROJECT_ID,
  ethereum: {
    createOnLogin: 'eoa',
  },
};

const cdpConnector = createCDPEmbeddedWalletConnector({
  cdpConfig,
  providerConfig: {
    chains: [CHAIN] as const,
    transports: {
      [CHAIN.id]: http(BASE_RPC_URL),
    } as any,
  },
});

const config = createConfig({
  connectors: [
    cdpConnector,
    coinbaseWallet({ appName: 'Helixa' }),
    injected(),
  ],
  chains: [CHAIN],
  transports: {
    [CHAIN.id]: http(BASE_RPC_URL),
  } as any,
});

const queryClient = new QueryClient();

interface WalletProviderProps {
  children: React.ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  return (
    <CDPReactProvider config={cdpConfig}>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </WagmiProvider>
    </CDPReactProvider>
  );
}
