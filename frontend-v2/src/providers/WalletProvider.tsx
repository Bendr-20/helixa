import React from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider, createConfig } from 'wagmi';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { http } from 'viem';
import { base } from 'viem/chains';

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID || 'cmlv6ibdm00350el2jsm8m8s6';
const BASE_RPC_URL = 'https://base.drpc.org';

// Wagmi config for contract reads — no connectors, Privy handles wallet connection
const wagmiConfig = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(BASE_RPC_URL),
  },
});

const queryClient = new QueryClient();

interface WalletProviderProps {
  children: React.ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        appearance: {
          theme: 'dark',
          accentColor: '#6eecd8',
          logo: 'https://helixa.xyz/helixa-logo.jpg',
        },
        loginMethods: ['email', 'wallet', 'google', 'twitter', 'discord', 'apple'],
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
        },
        defaultChain: base,
        supportedChains: [base],
      }}
    >
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </WagmiProvider>
    </PrivyProvider>
  );
}
