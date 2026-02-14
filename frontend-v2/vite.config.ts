import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-wallet': [
            '@rainbow-me/rainbowkit',
            'wagmi',
            'viem',
            '@tanstack/react-query',
          ],
        },
      },
    },
  },
})
