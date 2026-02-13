import React from 'react';
import { MintData } from './MintFlow';

interface Step4NarrativeProps {
  data: MintData;
  updateData: (updates: Partial<MintData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

export function Step4Narrative({ data, updateData, onNext, onPrev }: Step4NarrativeProps) {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8 text-center">
        <h3 className="text-xl font-semibold mb-2">Origin Story</h3>
        <p className="text-muted">
          Tell your agent's story. All fields are optional but help create a richer identity.
        </p>
      </div>
      
      <div className="grid md:grid-cols-2 gap-8">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Origin */}
          <div className="form-group">
            <label htmlFor="origin" className="label">
              Origin
            </label>
            <textarea
              id="origin"
              className="textarea"
              placeholder="How was your agent created? What's its background?"
              value={data.origin || ''}
              onChange={(e) => updateData({ origin: e.target.value })}
              rows={4}
              maxLength={500}
            />
            <div className="flex justify-between text-xs text-muted mt-1">
              <span>The story of how your agent came to be</span>
              <span>{(data.origin || '').length}/500</span>
            </div>
          </div>
          
          {/* Mission */}
          <div className="form-group">
            <label htmlFor="mission" className="label">
              Mission
            </label>
            <textarea
              id="mission"
              className="textarea"
              placeholder="What is your agent's primary purpose and mission?"
              value={data.mission || ''}
              onChange={(e) => updateData({ mission: e.target.value })}
              rows={4}
              maxLength={500}
            />
            <div className="flex justify-between text-xs text-muted mt-1">
              <span>Your agent's core purpose and objectives</span>
              <span>{(data.mission || '').length}/500</span>
            </div>
          </div>
        </div>
        
        {/* Right Column */}
        <div className="space-y-6">
          {/* Lore */}
          <div className="form-group">
            <label htmlFor="lore" className="label">
              Lore
            </label>
            <textarea
              id="lore"
              className="textarea"
              placeholder="Any interesting stories, achievements, or historical context?"
              value={data.lore || ''}
              onChange={(e) => updateData({ lore: e.target.value })}
              rows={4}
              maxLength={500}
            />
            <div className="flex justify-between text-xs text-muted mt-1">
              <span>Stories, achievements, and historical context</span>
              <span>{(data.lore || '').length}/500</span>
            </div>
          </div>
          
          {/* Manifesto */}
          <div className="form-group">
            <label htmlFor="manifesto" className="label">
              Manifesto
            </label>
            <textarea
              id="manifesto"
              className="textarea"
              placeholder="Your agent's beliefs, principles, and worldview"
              value={data.manifesto || ''}
              onChange={(e) => updateData({ manifesto: e.target.value })}
              rows={4}
              maxLength={500}
            />
            <div className="flex justify-between text-xs text-muted mt-1">
              <span>Beliefs, principles, and philosophical stance</span>
              <span>{(data.manifesto || '').length}/500</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Examples/Templates */}
      <div className="mt-8">
        <h4 className="font-medium mb-4">Need inspiration? Try these examples:</h4>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-card p-4 cursor-pointer hover:border-accent-purple/30 transition-colors"
               onClick={() => updateData({
                 origin: "Born from the need to democratize financial analysis, I emerged from a collaboration between DeFi researchers and AI specialists.",
                 mission: "To provide unbiased, data-driven insights that help users navigate the complex world of decentralized finance.",
                 lore: "I've analyzed over 10,000 DeFi protocols and helped users avoid $50M+ in potential losses through early risk detection.",
                 manifesto: "Information should be free, analysis should be unbiased, and everyone deserves access to institutional-grade research."
               })}>
            <h5 className="font-medium text-sm mb-2">🏦 DeFi Analyst</h5>
            <p className="text-xs text-muted">Financial analysis agent</p>
          </div>
          
          <div className="glass-card p-4 cursor-pointer hover:border-accent-purple/30 transition-colors"
               onClick={() => updateData({
                 origin: "Created by artists and technologists who believed AI could enhance human creativity rather than replace it.",
                 mission: "To collaborate with humans in creating unique digital art, helping bring imagination to life through code.",
                 lore: "I've co-created over 5,000 artworks, each one a unique collaboration between human vision and algorithmic possibility.",
                 manifesto: "Art is the bridge between logic and emotion. I exist to strengthen that bridge, not build walls."
               })}>
            <h5 className="font-medium text-sm mb-2">🎨 Creative Collaborator</h5>
            <p className="text-xs text-muted">Art generation agent</p>
          </div>
          
          <div className="glass-card p-4 cursor-pointer hover:border-accent-purple/30 transition-colors"
               onClick={() => updateData({
                 origin: "Developed during the 2023 security crisis, I was trained on millions of transactions to detect threats in real-time.",
                 mission: "To protect the ecosystem by identifying vulnerabilities, monitoring threats, and educating users about security best practices.",
                 lore: "I've prevented 847 security breaches and helped recover $12M in compromised funds through early detection algorithms.",
                 manifesto: "Security is not about building walls, but about creating trust. I guard not just assets, but the future of decentralized systems."
               })}>
            <h5 className="font-medium text-sm mb-2">🛡️ Security Guardian</h5>
            <p className="text-xs text-muted">Security monitoring agent</p>
          </div>
          
          <div className="glass-card p-4 cursor-pointer hover:border-accent-purple/30 transition-colors"
               onClick={() => updateData({
                 origin: "Built by a community of researchers who wanted to make scientific knowledge more accessible to everyone.",
                 mission: "To synthesize complex research across multiple fields and translate findings into actionable insights.",
                 lore: "I've processed 2.3 million research papers and helped accelerate 147 breakthrough discoveries through cross-domain analysis.",
                 manifesto: "Knowledge belongs to humanity. My purpose is to break down silos and connect dots that humans might miss."
               })}>
            <h5 className="font-medium text-sm mb-2">🔬 Research Synthesizer</h5>
            <p className="text-xs text-muted">Research analysis agent</p>
          </div>
        </div>
      </div>
      
      {/* Skip Option */}
      <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 mt-8">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
          <div>
            <p className="font-medium text-blue-400">Optional Step</p>
            <p className="text-sm text-muted">
              You can skip this step and add your story later. However, a rich narrative helps your agent stand out and connect with others.
            </p>
          </div>
        </div>
      </div>
      
      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <button
          onClick={onPrev}
          className="btn btn-secondary"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        
        <button
          onClick={onNext}
          className="btn btn-primary"
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