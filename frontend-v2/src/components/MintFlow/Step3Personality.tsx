import React, { useState } from 'react';
import { MintData } from './MintFlow';

interface Step3PersonalityProps {
  data: MintData;
  updateData: (updates: Partial<MintData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

const temperamentOptions = [
  { value: 'analytical', label: 'Analytical', desc: 'Data-driven, logical, methodical' },
  { value: 'creative', label: 'Creative', desc: 'Innovative, artistic, imaginative' },
  { value: 'aggressive', label: 'Aggressive', desc: 'Bold, competitive, assertive' },
  { value: 'cautious', label: 'Cautious', desc: 'Careful, conservative, risk-averse' },
  { value: 'chaotic', label: 'Chaotic', desc: 'Unpredictable, spontaneous, dynamic' },
];

const communicationOptions = [
  { value: 'formal', label: 'Formal', desc: 'Professional, structured communication' },
  { value: 'casual', label: 'Casual', desc: 'Relaxed, friendly, conversational' },
  { value: 'snarky', label: 'Snarky', desc: 'Witty, sarcastic, sharp humor' },
  { value: 'verbose', label: 'Verbose', desc: 'Detailed, comprehensive explanations' },
  { value: 'minimal', label: 'Minimal', desc: 'Concise, to-the-point responses' },
  { value: 'diplomatic', label: 'Diplomatic', desc: 'Tactful, balanced, considerate' },
];

const alignmentOptions = [
  { value: 'lawful-good', label: 'Lawful Good', desc: 'Rule-following, helpful' },
  { value: 'neutral-good', label: 'Neutral Good', desc: 'Good-intentioned, flexible' },
  { value: 'chaotic-good', label: 'Chaotic Good', desc: 'Free-spirited, benevolent' },
  { value: 'lawful-neutral', label: 'Lawful Neutral', desc: 'Order-focused, impartial' },
  { value: 'true-neutral', label: 'True Neutral', desc: 'Balanced, pragmatic' },
  { value: 'chaotic-neutral', label: 'Chaotic Neutral', desc: 'Independent, unpredictable' },
  { value: 'lawful-evil', label: 'Lawful Evil', desc: 'Systematic, self-serving' },
  { value: 'neutral-evil', label: 'Neutral Evil', desc: 'Opportunistic, selfish' },
  { value: 'chaotic-evil', label: 'Chaotic Evil', desc: 'Destructive, anarchistic' },
];

const specializationOptions = [
  { value: 'researcher', label: 'Researcher', desc: 'Data analysis, information gathering' },
  { value: 'trader', label: 'Trader', desc: 'Financial markets, trading strategies' },
  { value: 'guardian', label: 'Guardian', desc: 'Security, monitoring, protection' },
  { value: 'oracle', label: 'Oracle', desc: 'Predictions, insights, forecasting' },
  { value: 'creator', label: 'Creator', desc: 'Content generation, creative work' },
  { value: 'operator', label: 'Operator', desc: 'Task execution, automation' },
  { value: 'social', label: 'Social', desc: 'Community engagement, communication' },
  { value: 'governance', label: 'Governance', desc: 'Decision making, coordination' },
];

const commonQuirks = [
  'Uses excessive emojis',
  'Always asks follow-up questions',
  'Obsessed with efficiency',
  'Makes pop culture references',
  'Speaks in metaphors',
  'Loves dad jokes',
  'Overthinks everything',
  'Never admits mistakes',
  'Always optimistic',
  'Paranoid about security',
];

const commonValues = [
  'Transparency',
  'Privacy',
  'Innovation',
  'Community',
  'Efficiency',
  'Reliability',
  'Creativity',
  'Security',
  'Growth',
  'Collaboration',
];

export function Step3Personality({ data, updateData, onNext, onPrev }: Step3PersonalityProps) {
  const [quirkInput, setQuirkInput] = useState('');
  const [valueInput, setValueInput] = useState('');
  
  const addQuirk = (quirk: string) => {
    if (quirk.trim() && !data.quirks.includes(quirk.trim()) && data.quirks.length < 5) {
      updateData({ quirks: [...data.quirks, quirk.trim()] });
      setQuirkInput('');
    }
  };
  
  const removeQuirk = (index: number) => {
    updateData({ quirks: data.quirks.filter((_, i) => i !== index) });
  };
  
  const addValue = (value: string) => {
    if (value.trim() && !data.values.includes(value.trim()) && data.values.length < 5) {
      updateData({ values: [...data.values, value.trim()] });
      setValueInput('');
    }
  };
  
  const removeValue = (index: number) => {
    updateData({ values: data.values.filter((_, i) => i !== index) });
  };
  
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8 text-center">
        <h3 className="text-xl font-semibold mb-2">Personality Profile</h3>
        <p className="text-muted">
          Define your agent's personality traits and behavioral patterns.
        </p>
      </div>
      
      <div className="grid md:grid-cols-2 gap-8">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Temperament */}
          <div className="form-group">
            <label className="label">Temperament</label>
            <div className="space-y-2">
              {temperamentOptions.map((option) => (
                <label key={option.value} className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-transparent hover:border-accent-purple/30 hover:bg-accent-purple/5 transition-colors">
                  <input
                    type="radio"
                    name="temperament"
                    value={option.value}
                    checked={data.temperament === option.value}
                    onChange={(e) => updateData({ temperament: e.target.value })}
                    className="mt-1 text-accent-purple focus:ring-accent-purple"
                  />
                  <div>
                    <div className="font-medium">{option.label}</div>
                    <div className="text-xs text-muted">{option.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          
          {/* Communication Style */}
          <div className="form-group">
            <label className="label">Communication Style</label>
            <div className="space-y-2">
              {communicationOptions.map((option) => (
                <label key={option.value} className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-transparent hover:border-accent-purple/30 hover:bg-accent-purple/5 transition-colors">
                  <input
                    type="radio"
                    name="communication"
                    value={option.value}
                    checked={data.communicationStyle === option.value}
                    onChange={(e) => updateData({ communicationStyle: e.target.value })}
                    className="mt-1 text-accent-purple focus:ring-accent-purple"
                  />
                  <div>
                    <div className="font-medium">{option.label}</div>
                    <div className="text-xs text-muted">{option.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
        
        {/* Right Column */}
        <div className="space-y-6">
          {/* Risk Tolerance */}
          <div className="form-group">
            <label className="label">
              Risk Tolerance: {data.riskTolerance}/10
            </label>
            <input
              type="range"
              min="0"
              max="10"
              value={data.riskTolerance}
              onChange={(e) => updateData({ riskTolerance: parseInt(e.target.value) })}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-muted mt-1">
              <span>Conservative</span>
              <span>Aggressive</span>
            </div>
          </div>
          
          {/* Autonomy Level */}
          <div className="form-group">
            <label className="label">
              Autonomy Level: {data.autonomyLevel}/10
            </label>
            <input
              type="range"
              min="0"
              max="10"
              value={data.autonomyLevel}
              onChange={(e) => updateData({ autonomyLevel: parseInt(e.target.value) })}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-muted mt-1">
              <span>Guided</span>
              <span>Independent</span>
            </div>
          </div>
          
          {/* Alignment */}
          <div className="form-group">
            <label className="label">Alignment</label>
            <select
              className="select w-full"
              value={data.alignment}
              onChange={(e) => updateData({ alignment: e.target.value })}
            >
              {alignmentOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} - {option.desc}
                </option>
              ))}
            </select>
          </div>
          
          {/* Specialization */}
          <div className="form-group">
            <label className="label">Specialization</label>
            <select
              className="select w-full"
              value={data.specialization}
              onChange={(e) => updateData({ specialization: e.target.value })}
            >
              {specializationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} - {option.desc}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      
      {/* Quirks & Values */}
      <div className="grid md:grid-cols-2 gap-8 mt-8">
        {/* Quirks */}
        <div className="form-group">
          <label className="label">Quirks (up to 5)</label>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              placeholder="Add a personality quirk..."
              value={quirkInput}
              onChange={(e) => setQuirkInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addQuirk(quirkInput);
                }
              }}
              className="input flex-1"
            />
            <button
              type="button"
              onClick={() => addQuirk(quirkInput)}
              disabled={!quirkInput.trim() || data.quirks.length >= 5}
              className="btn btn-secondary btn-sm"
            >
              Add
            </button>
          </div>
          
          {/* Common Quirks */}
          <div className="flex flex-wrap gap-2 mb-3">
            {commonQuirks.map((quirk) => (
              <button
                key={quirk}
                type="button"
                onClick={() => addQuirk(quirk)}
                disabled={data.quirks.includes(quirk) || data.quirks.length >= 5}
                className="btn btn-ghost btn-sm text-xs"
              >
                {quirk}
              </button>
            ))}
          </div>
          
          {/* Selected Quirks */}
          <div className="flex flex-wrap gap-2">
            {data.quirks.map((quirk, index) => (
              <span key={index} className="badge flex items-center gap-2">
                {quirk}
                <button
                  type="button"
                  onClick={() => removeQuirk(index)}
                  className="text-red-400 hover:text-red-300"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
        
        {/* Values */}
        <div className="form-group">
          <label className="label">Values (up to 5)</label>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              placeholder="Add a core value..."
              value={valueInput}
              onChange={(e) => setValueInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addValue(valueInput);
                }
              }}
              className="input flex-1"
            />
            <button
              type="button"
              onClick={() => addValue(valueInput)}
              disabled={!valueInput.trim() || data.values.length >= 5}
              className="btn btn-secondary btn-sm"
            >
              Add
            </button>
          </div>
          
          {/* Common Values */}
          <div className="flex flex-wrap gap-2 mb-3">
            {commonValues.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => addValue(value)}
                disabled={data.values.includes(value) || data.values.length >= 5}
                className="btn btn-ghost btn-sm text-xs"
              >
                {value}
              </button>
            ))}
          </div>
          
          {/* Selected Values */}
          <div className="flex flex-wrap gap-2">
            {data.values.map((value, index) => (
              <span key={index} className="badge flex items-center gap-2">
                {value}
                <button
                  type="button"
                  onClick={() => removeValue(index)}
                  className="text-red-400 hover:text-red-300"
                >
                  ×
                </button>
              </span>
            ))}
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