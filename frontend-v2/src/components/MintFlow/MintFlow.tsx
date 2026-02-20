import React, { useState } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { Step1Connect } from './Step1Connect';
import { Step2BuildAura } from './Step2BuildAura';
import { Step5Review } from './Step5Review';
import { MintSuccess } from './MintSuccess';

export interface MintData {
  name: string;
  framework: string;
  agentAddress: string;
  soulbound: boolean;
  temperament: string;
  communicationStyle: string;
  riskTolerance: number;
  autonomyLevel: number;
  alignment: string;
  specialization: string;
  quirks: string[];
  values: string[];
  origin?: string;
  mission?: string;
  lore?: string;
  manifesto?: string;
  agentName?: string;
}

const initialMintData: MintData = {
  name: '',
  framework: 'custom',
  agentAddress: '',
  soulbound: false,
  temperament: 'analytical',
  communicationStyle: 'formal',
  riskTolerance: 5,
  autonomyLevel: 5,
  alignment: 'true-neutral',
  specialization: 'researcher',
  quirks: [],
  values: [],
  origin: '',
  mission: '',
  lore: '',
  manifesto: '',
};

interface MintFlowProps {
  onComplete?: (tokenId: string) => void;
}

export function MintFlow({ onComplete }: MintFlowProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [mintData, setMintData] = useState<MintData>(initialMintData);
  const [mintedTokenId, setMintedTokenId] = useState<string | null>(null);
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const isConnected = authenticated && wallets.length > 0;

  const updateMintData = (updates: Partial<MintData>) => {
    setMintData(prev => ({ ...prev, ...updates }));
  };
  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, 4));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));
  const goToStep = (step: number) => setCurrentStep(step);

  const handleMintSuccess = (tokenId: string) => {
    setMintedTokenId(tokenId);
    setCurrentStep(4);
    onComplete?.(tokenId);
  };

  const progress = ((currentStep - 1) / 3) * 100;
  const stepTitles = ['Connect Wallet', 'Build Your Aura', 'Review & Mint', 'Success!'];

  if (currentStep === 4 && mintedTokenId) {
    return <MintSuccess tokenId={mintedTokenId} agentData={mintData} />;
  }

  return (
    <div className="mf-flow">
      {/* Progress Header */}
      <div className="mf-progress-header">
        <div className="mf-progress-top">
          <h2>{stepTitles[currentStep - 1]}</h2>
          <span className="mf-step-counter">Step {currentStep} of 3</span>
        </div>

        <div className="mf-progress-bar">
          <div className="mf-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        <div className="mf-step-dots">
          {Array.from({ length: 3 }, (_, i) => i + 1).map((step) => (
            <button
              key={step}
              onClick={() => step <= currentStep && goToStep(step)}
              className={`mf-step-dot ${
                step === currentStep ? 'active' : step < currentStep ? 'completed' : 'disabled'
              }`}
            >
              {step}
            </button>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="mf-step-content">
        {currentStep === 1 && <Step1Connect onNext={nextStep} canProceed={isConnected} />}
        {currentStep === 2 && <Step2BuildAura data={mintData} updateData={updateMintData} onNext={nextStep} onPrev={prevStep} />}
        {currentStep === 3 && <Step5Review data={mintData} updateData={updateMintData} onPrev={prevStep} onMintSuccess={handleMintSuccess} />}
      </div>
    </div>
  );
}
