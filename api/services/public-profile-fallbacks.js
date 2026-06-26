const LINKED_TOKEN_TRAIT_KEYS = new Set([
  'linked-token',
  'linked-token-chain',
  'linked-token-symbol',
  'linked-token-name',
]);

function hasValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'bigint') return true;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

function valueOrNull(value) {
  if (!hasValue(value)) return null;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') return value.trim();
  return value;
}

function pickFilled(...values) {
  for (const value of values) {
    if (hasValue(value)) return valueOrNull(value);
  }
  return null;
}

function normalizePersonality(input) {
  if (!input) return null;
  const source = Array.isArray(input)
    ? {
        quirks: input[0],
        communicationStyle: input[1],
        values: input[2],
        humor: input[3],
        riskTolerance: input[4],
        autonomyLevel: input[5],
      }
    : input;

  const normalized = {};
  for (const key of ['quirks', 'communicationStyle', 'values', 'humor']) {
    const value = valueOrNull(source[key]);
    if (value !== null) normalized[key] = value;
  }
  for (const key of ['riskTolerance', 'autonomyLevel']) {
    const value = valueOrNull(source[key]);
    if (value === null) continue;
    const number = Number(value);
    if (Number.isFinite(number)) normalized[key] = number;
  }

  return Object.keys(normalized).length ? normalized : null;
}

function normalizeNarrative(input) {
  if (!input) return null;
  const normalized = {};
  for (const key of ['origin', 'mission', 'lore', 'manifesto']) {
    const value = valueOrNull(input[key]);
    if (value !== null) normalized[key] = value;
  }
  return Object.keys(normalized).length ? normalized : null;
}

function normalizeTrait(input) {
  if (!input) return null;
  const trait = typeof input === 'string'
    ? { name: input, category: null, addedAt: null }
    : {
        name: input.name,
        category: input.category,
        addedAt: input.addedAt,
      };

  const name = valueOrNull(trait.name);
  if (!name || LINKED_TOKEN_TRAIT_KEYS.has(name)) return null;

  return {
    name,
    category: valueOrNull(trait.category),
    addedAt: valueOrNull(trait.addedAt),
  };
}

function mergeTrait(existing, fallback) {
  return {
    name: existing.name,
    category: pickFilled(existing.category, fallback.category),
    addedAt: pickFilled(existing.addedAt, fallback.addedAt),
  };
}

function mergeTraitLists(primary = [], fallback = []) {
  const merged = [];
  const byName = new Map();

  for (const raw of [...(Array.isArray(primary) ? primary : []), ...(Array.isArray(fallback) ? fallback : [])]) {
    const trait = normalizeTrait(raw);
    if (!trait) continue;

    const existingIndex = byName.get(trait.name);
    if (existingIndex === undefined) {
      byName.set(trait.name, merged.length);
      merged.push(trait);
      continue;
    }

    merged[existingIndex] = mergeTrait(merged[existingIndex], trait);
  }

  return merged;
}

function mergeObjectsWithFallback(primary, fallback, keys) {
  const normalizedPrimary = primary || {};
  const normalizedFallback = fallback || {};
  const merged = {};

  for (const key of keys) {
    const value = pickFilled(normalizedPrimary[key], normalizedFallback[key]);
    if (value !== null) merged[key] = value;
  }

  return Object.keys(merged).length ? merged : null;
}

function mergePublicAgentProfile(agent, profile = {}) {
  if (!agent || typeof agent !== 'object') return agent;
  const merged = { ...agent };

  const personality = mergeObjectsWithFallback(
    normalizePersonality(agent.personality),
    normalizePersonality(profile.personality),
    ['quirks', 'communicationStyle', 'values', 'humor', 'riskTolerance', 'autonomyLevel'],
  );
  if (personality) merged.personality = personality;
  else if ('personality' in merged) merged.personality = null;

  const narrative = mergeObjectsWithFallback(
    normalizeNarrative(agent.narrative),
    normalizeNarrative(profile.narrative),
    ['origin', 'mission', 'lore', 'manifesto'],
  );
  if (narrative) merged.narrative = narrative;
  else if ('narrative' in merged) merged.narrative = null;

  const traits = mergeTraitLists(agent.traits, profile.traits);
  merged.traits = traits;
  merged.traitCount = traits.length;

  return merged;
}

module.exports = {
  LINKED_TOKEN_TRAIT_KEYS,
  normalizePersonality,
  normalizeNarrative,
  normalizeTrait,
  mergeTraitLists,
  mergePublicAgentProfile,
};
