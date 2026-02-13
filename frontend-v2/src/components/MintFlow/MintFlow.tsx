import React, { useState } from 'react';
import { useAccount } from 'wagmi';
import { Step1Connect } from './Step1Connect';
import { Step2Identity } from './Step2Identity';
import { Step3Personality } from './Step3Personality';
import { Step4Narrative } from './Step4Narrative';
import { Step5Review } from './Step5Review';
import { MintSuccess } from './MintSuccess';

export interface MintData {
  // Identity
  name: string;
  framework: string;
  agentAddress: string;
  soulbound: boolean;
  
  // Personality
  temperament: string;
  communicationStyle: string;
  riskTolerance: number;
  autonomyLevel: number;
  alignment: string;
  specialization: string;
  quirks: string[];
  values: string[];
  
  // Narrative (optional)
  origin?: string;
  mission?: string;
  lore?: string;
  manifesto?: string;
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
  
  const { isConnected } = useAccount();
  
  const updateMintData = (updates: Partial<MintData>) => {
    setMintData(prev => ({ ...prev, ...updates }));
  };
  
  const nextStep = () => {
    setCurrentStep(prev => Math.min(prev + 1, 6));
  };
  
  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };
  
  const goToStep = (step: number) => {
    setCurrentStep(step);
  };
  
  const handleMintSuccess = (tokenId: string) => {
    setMintedTokenId(tokenId);
    setCurrentStep(6);
    onComplete?.(tokenId);
  };
  
  // Progress indicator
  const progress = ((currentStep - 1) / 5) * 100;
  
  // Step titles
  const stepTitles = [
    'Connect Wallet',
    'Agent Identity',
    'Personality',
    'Origin Story',
    'Review & Mint',
    'Success!'
  ];
  
  if (currentStep === 6 && mintedTokenId) {
    return <MintSuccess tokenId={mintedTokenId} agentData={mintData} />;
  }
  
  return (
    <div className="mint-flow">
      {/* Progress Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-heading font-semibold">
            {stepTitles[currentStep - 1]}
          </h2>
          <span className="text-sm text-muted">
            Step {currentStep} of 5
          </span>
        </div>
        
        {/* Progress Bar */}
        <div className="progress mb-6">
          <div 
            className="progress-bar"
            style={{ width: `${progress}%` }}
          />
        </div>
        
        {/* Step Navigation */}
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: 5 }, (_, i) => i + 1).map((step) => (
            <button
              key={step}
              onClick={() => goToStep(step)}
              disabled={step > currentStep && !isConnected}
              className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                step === currentStep
                  ? 'bg-gradient-primary text-white'
                  : step < currentStep
                  ? 'bg-accent-purple/30 text-accent-purple'
                  : 'bg-gray-700 text-gray-400 cursor-not-allowed'
              }`}
            >
              {step}
            </button>
          ))}
        </div>
      </div>
      
      {/* Step Content */}
      <div className="mint-step-content">
        {currentStep === 1 && (
          <Step1Connect 
            onNext={nextStep} 
            canProceed={isConnected}
          />
        )}
        
        {currentStep === 2 && (
          <Step2Identity
            data={mintData}
            updateData={updateMintData}
            onNext={nextStep}
            onPrev={prevStep}
          />
        )}
        
        {currentStep === 3 && (
          <Step3Personality
            data={mintData}
            updateData={updateMintData}
            onNext={nextStep}
            onPrev={prevStep}
          />
        )}
        
        {currentStep === 4 && (
          <Step4Narrative
            data={mintData}
            updateData={updateMintData}
            onNext={nextStep}
            onPrev={prevStep}
          />
        )}
        
        {currentStep === 5 && (
          <Step5Review
            data={mintData}
            updateData={updateMintData}
            onPrev={prevStep}
            onMintSuccess={handleMintSuccess}
          />
        )}
      </div>
    </div>
  );
}