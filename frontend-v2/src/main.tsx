import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

// Fix BigInt JSON serialization (wagmi/viem uses BigInt for chain IDs etc.)
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);