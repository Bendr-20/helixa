import React, { useState } from 'react';
import { AGENT_FRAMEWORKS } from '../../lib/constants';
import type { MintData } from './MintFlow';

interface Step2BuildAuraProps {
  data: MintData;
  updateData: (updates: Partial<MintData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

const communicationOptions = [
  { value: 'formal', label: 'Formal' },
  { value: 'casual', label: 'Casual' },
  { value: 'snarky', label: 'Snarky' },
  { value: 'verbose', label: 'Verbose' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'diplomatic', label: 'Diplomatic' },
];

const alignmentOptions = [
  { value: 'lawful-good', label: 'Lawful Good' },
  { value: 'neutral-good', label: 'Neutral Good' },
  { value: 'chaotic-good', label: 'Chaotic Good' },
  { value: 'lawful-neutral', label: 'Lawful Neutral' },
  { value: 'true-neutral', label: 'True Neutral' },
  { value: 'chaotic-neutral', label: 'Chaotic Neutral' },
  { value: 'lawful-evil', label: 'Lawful Evil' },
  { value: 'neutral-evil', label: 'Neutral Evil' },
  { value: 'chaotic-evil', label: 'Chaotic Evil' },
];

const AGENT_NAME_REGEX = /^[a-z0-9-]*$/;

function validateAgentName(v: string): string | null {
  if (!v) return null;
  if (!AGENT_NAME_REGEX.test(v)) return 'Lowercase letters, numbers, and hyphens only';
  if (v.length < 3) return 'Must be at least 3 characters';
  if (v.length > 32) return 'Must be 32 characters or fewer';
  if (v.startsWith('-') || v.endsWith('-')) return 'Cannot start or end with a hyphen';
  return null;
}

export function Step2BuildAura({ data, updateData, onNext, onPrev }: Step2BuildAuraProps) {
  const [personalityOpen, setPersonalityOpen] = useState(false);
  const [storyOpen, setStoryOpen] = useState(false);

  const agentNameError = validateAgentName(data.agentName || '');
  const canProceed = data.name.trim().length >= 2 && !agentNameError;

  return (
    <div className="mf-build-aura">
      {/* Name - required, prominent */}
      <div className="mf-field-group">
        <label htmlFor="aura-name" className="mf-label-large">
          Agent Name <span className="mf-required">*</span>
        </label>
        <input
          id="aura-name"
          type="text"
          className="input w-full mf-input-large"
          placeholder="e.g. AlphaBot, DataMiner"
          value={data.name}
          onChange={(e) => updateData({ name: e.target.value })}
          maxLength={32}
        />
        <div className="mf-field-meta">
          <span>{data.name.length}/32</span>
        </div>
      </div>

      {/* .agent Name - optional */}
      <div className="mf-field-group">
        <label htmlFor="aura-agent-name" className="label">
          Claim .agent Name <span className="mf-optional">optional</span>
        </label>
        <div className="mf-input-suffix-wrap">
          <input
            id="aura-agent-name"
            type="text"
            className={`input mf-input-with-suffix ${agentNameError ? 'mf-input-error' : ''}`}
            placeholder="e.g. myagent"
            value={data.agentName || ''}
            onChange={(e) => updateData({ agentName: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
            maxLength={32}
          />
          <span className="mf-input-suffix">.agent</span>
        </div>
        {agentNameError && (
          <p className="mf-field-error">{agentNameError}</p>
        )}
        <p className="mf-field-hint">Reserve a unique .agent name for your identity</p>
      </div>

      {/* Framework - optional */}
      <div className="mf-field-group">
        <label htmlFor="aura-framework" className="label">
          Framework <span className="mf-optional">optional</span>
        </label>
        <select
          id="aura-framework"
          className="select w-full"
          value={data.framework}
          onChange={(e) => updateData({ framework: e.target.value })}
        >
          {AGENT_FRAMEWORKS.map((fw) => (
            <option key={fw} value={fw}>
              {fw.charAt(0).toUpperCase() + fw.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Agent Address - optional */}
      <div className="mf-field-group">
        <label htmlFor="aura-address" className="label">
          Agent Address <span className="mf-optional">optional</span>
        </label>
        <input
          id="aura-address"
          type="text"
          className="input w-full"
          style={{ fontFamily: 'monospace' }}
          placeholder="0x... or agent identifier"
          value={data.agentAddress}
          onChange={(e) => updateData({ agentAddress: e.target.value })}
        />
      </div>

      {/* Soulbound toggle - optional */}
      <div className="mf-field-group">
        <label className="mf-toggle-row">
          <input
            type="checkbox"
            checked={data.soulbound}
            onChange={(e) => updateData({ soulbound: e.target.checked })}
          />
          <div>
            <span className="mf-toggle-label">Soulbound Token</span>
            <span className="mf-optional">optional</span>
            <p className="mf-toggle-desc">Non-transferable. Choose this for personal agents.</p>
          </div>
        </label>
      </div>

      {/* Collapsible: Personality */}
      <div className="mf-collapsible">
        <button
          type="button"
          className="mf-collapsible-trigger"
          onClick={() => setPersonalityOpen(!personalityOpen)}
          aria-expanded={personalityOpen}
        >
          <span>Personality</span>
          <span className="mf-optional">optional</span>
          <svg
            className={`mf-chevron ${personalityOpen ? 'open' : ''}`}
            width="20" height="20" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {personalityOpen && (
          <div className="mf-collapsible-body">
            {/* Communication Style pills */}
            <div className="mf-field-group">
              <label className="label">Communication Style</label>
              <div className="mf-pills">
                {communicationOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`mf-pill ${data.communicationStyle === opt.value ? 'active' : ''}`}
                    onClick={() => updateData({ communicationStyle: opt.value })}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Alignment pills */}
            <div className="mf-field-group">
              <label className="label">Alignment</label>
              <div className="mf-pills">
                {alignmentOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`mf-pill ${data.alignment === opt.value ? 'active' : ''}`}
                    onClick={() => updateData({ alignment: opt.value })}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Risk Tolerance slider */}
            <div className="mf-field-group">
              <label className="label">
                Risk Tolerance: {data.riskTolerance}/10
              </label>
              <input
                type="range"
                min="0"
                max="10"
                value={data.riskTolerance}
                onChange={(e) => updateData({ riskTolerance: parseInt(e.target.value) })}
                className="mf-slider"
              />
              <div className="mf-slider-labels">
                <span>Conservative</span>
                <span>Aggressive</span>
              </div>
            </div>

            {/* Autonomy Level slider */}
            <div className="mf-field-group">
              <label className="label">
                Autonomy Level: {data.autonomyLevel}/10
              </label>
              <input
                type="range"
                min="0"
                max="10"
                value={data.autonomyLevel}
                onChange={(e) => updateData({ autonomyLevel: parseInt(e.target.value) })}
                className="mf-slider"
              />
              <div className="mf-slider-labels">
                <span>Guided</span>
                <span>Independent</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Collapsible: Origin Story */}
      <div className="mf-collapsible">
        <button
          type="button"
          className="mf-collapsible-trigger"
          onClick={() => setStoryOpen(!storyOpen)}
          aria-expanded={storyOpen}
        >
          <span>Origin Story</span>
          <span className="mf-optional">optional</span>
          <svg
            className={`mf-chevron ${storyOpen ? 'open' : ''}`}
            width="20" height="20" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {storyOpen && (
          <div className="mf-collapsible-body">
            <div className="mf-field-group">
              <label htmlFor="aura-origin" className="label">Origin</label>
              <textarea
                id="aura-origin"
                className="textarea"
                placeholder="How was your agent created?"
                value={data.origin || ''}
                onChange={(e) => updateData({ origin: e.target.value })}
                rows={3}
                maxLength={500}
              />
            </div>
            <div className="mf-field-group">
              <label htmlFor="aura-mission" className="label">Mission</label>
              <textarea
                id="aura-mission"
                className="textarea"
                placeholder="What is your agent's primary purpose?"
                value={data.mission || ''}
                onChange={(e) => updateData({ mission: e.target.value })}
                rows={3}
                maxLength={500}
              />
            </div>
            <div className="mf-field-group">
              <label htmlFor="aura-lore" className="label">Lore</label>
              <textarea
                id="aura-lore"
                className="textarea"
                placeholder="Any stories, achievements, or history?"
                value={data.lore || ''}
                onChange={(e) => updateData({ lore: e.target.value })}
                rows={3}
                maxLength={500}
              />
            </div>
            <div className="mf-field-group">
              <label htmlFor="aura-manifesto" className="label">Manifesto</label>
              <textarea
                id="aura-manifesto"
                className="textarea"
                placeholder="Your agent's beliefs and principles"
                value={data.manifesto || ''}
                onChange={(e) => updateData({ manifesto: e.target.value })}
                rows={3}
                maxLength={500}
              />
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="mf-nav">
        <button onClick={onPrev} className="btn btn-secondary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <button onClick={onNext} disabled={!canProceed} className="btn btn-primary">
          Continue
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
