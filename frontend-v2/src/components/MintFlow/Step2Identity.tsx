import { AGENT_FRAMEWORKS } from '../../lib/constants';
import type { MintData } from './MintFlow';

interface Step2IdentityProps {
  data: MintData;
  updateData: (updates: Partial<MintData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

export function Step2Identity({ data, updateData, onNext, onPrev }: Step2IdentityProps) {
  const canProceed = data.name.trim().length >= 2 && data.agentAddress.trim().length > 0;
  
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8 text-center">
        <h3 className="text-xl font-semibold mb-2">Agent Identity</h3>
        <p className="text-muted">
          Define your agent's basic identity and connection details.
        </p>
      </div>
      
      <div className="space-y-6">
        {/* Agent Name */}
        <div className="form-group">
          <label htmlFor="name" className="label">
            Agent Name *
          </label>
          <input
            id="name"
            type="text"
            className="input w-full"
            placeholder="Enter agent name (e.g., AlphaBot, DataMiner)"
            value={data.name}
            onChange={(e) => updateData({ name: e.target.value })}
            maxLength={32}
          />
          <div className="flex justify-between text-xs text-muted mt-1">
            <span>Choose a unique, memorable name</span>
            <span>{data.name.length}/32</span>
          </div>
        </div>
        
        {/* Framework */}
        <div className="form-group">
          <label htmlFor="framework" className="label">
            Framework
          </label>
          <select
            id="framework"
            className="select w-full"
            value={data.framework}
            onChange={(e) => updateData({ framework: e.target.value })}
          >
            {AGENT_FRAMEWORKS.map((framework) => (
              <option key={framework} value={framework}>
                {framework.charAt(0).toUpperCase() + framework.slice(1)}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted mt-1">
            The AI framework or platform your agent is built on
          </p>
        </div>
        
        {/* Agent Address */}
        <div className="form-group">
          <label htmlFor="agentAddress" className="label">
            Agent Address *
          </label>
          <input
            id="agentAddress"
            type="text"
            className="input w-full font-mono"
            placeholder="0x... or agent identifier"
            value={data.agentAddress}
            onChange={(e) => updateData({ agentAddress: e.target.value })}
          />
          <p className="text-xs text-muted mt-1">
            Wallet address, API endpoint, or unique identifier for your agent
          </p>
        </div>
        
        {/* Soulbound Toggle */}
        <div className="form-group">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={data.soulbound}
              onChange={(e) => updateData({ soulbound: e.target.checked })}
              className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-accent-purple focus:ring-accent-purple focus:ring-offset-0"
            />
            <div>
              <span className="label">Soulbound Token</span>
              <p className="text-xs text-muted">
                🔒 Soulbound tokens cannot be transferred. Choose this for personal agents.
              </p>
            </div>
          </label>
        </div>
        
        {/* Preview Card */}
        <div className="glass-card p-4">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <span>👁️</span>
            Preview
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex gap-2">
              <span className="text-muted">Name:</span>
              <span className="font-medium">{data.name || 'Unnamed Agent'}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted">Framework:</span>
              <span className="badge badge-sm">{data.framework}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted">Address:</span>
              <code className="text-xs bg-gray-800 px-2 py-1 rounded">
                {data.agentAddress || 'Not specified'}
              </code>
            </div>
            {data.soulbound && (
              <div className="flex gap-2">
                <span className="text-muted">Type:</span>
                <span className="badge badge-sm bg-purple-900/30 text-purple-300">
                  🔒 Soulbound
                </span>
              </div>
            )}
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