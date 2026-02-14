import React from 'react';
import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { http } from 'viem';
import { CHAIN, BASE_RPC_URL } from '../lib/constants';

const config = getDefaultConfig({
  appName: 'Helixa V2',
  projectId: import.meta.env.VITE_PROJECT_ID || '0534788f365bab3b9eacef1b403e5c52',
  chains: [CHAIN],
  transports: {
    [CHAIN.id]: http(BASE_RPC_URL),
  },
  ssr: false,
});

const queryClient = new QueryClient();

interface WalletProviderProps {
  children: React.ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider coolMode theme={darkTheme({
          accentColor: '#b490ff',
          accentColorForeground: '#0a0a14',
          borderRadius: 'medium',
          fontStack: 'system',
          overlayBlur: 'small',
        })}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}