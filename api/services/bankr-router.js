/**
 * Bankr LLM Router - Smart model routing to save credits
 * 
 * Three modes:
 *   auto    - balanced (cheap for simple, quality for complex)
 *   eco     - cheapest model that can handle the task
 *   premium - best available model
 * 
 * Sits between our code and the Bankr LLM Gateway.
 * Drop-in replacement for direct fetch calls to llm.bankr.bot.
 */

const BANKR_LLM_URL = 'https://llm.bankr.bot';

// Model tiers sorted by cost (cheapest first)
const MODEL_TIERS = {
  cheap:   ['gpt-5-nano', 'gemini-3.1-flash-lite', 'gpt-5-mini', 'gemini-3-flash', 'qwen3.5-flash'],
  mid:     ['claude-haiku-4.5', 'gemini-2.5-flash', 'gpt-5.2', 'deepseek-v3.2', 'grok-4.1-fast'],
  premium: ['claude-sonnet-4.6', 'gemini-3-pro', 'gemini-3.1-pro', 'gpt-5.4', 'claude-opus-4.6'],
};

// Complexity heuristics
function classifyComplexity(messages, requestedModel) {
  const lastMsg = messages?.[messages.length - 1]?.content || '';
  const text = typeof lastMsg === 'string' ? lastMsg : JSON.stringify(lastMsg);
  const totalLen = messages?.reduce((acc, m) => {
    const c = m.content || '';
    return acc + (typeof c === 'string' ? c.length : JSON.stringify(c).length);
  }, 0) || 0;

  // If caller explicitly requested a premium model, respect it
  if (requestedModel && MODEL_TIERS.premium.includes(requestedModel)) {
    return 'premium';
  }

  // Long context or system prompts = complex
  if (totalLen > 4000) return 'complex';
  if (messages?.length > 6) return 'complex';

  // Keywords that suggest complex reasoning
  const complexPatterns = /\b(analyze|evaluate|assess|compare|synthesize|architect|design|debug|refactor|security|audit|trust evaluation|cred score|soul)\b/i;
  if (complexPatterns.test(text)) return 'complex';

  // Very short, simple queries
  if (totalLen < 500 && messages?.length <= 2) return 'simple';

  return 'moderate';
}

function pickModel(complexity, mode = 'auto') {
  if (mode === 'premium') return 'claude-sonnet-4.6';
  if (mode === 'eco') {
    // Always cheapest regardless of complexity
    return complexity === 'complex' ? 'claude-haiku-4.5' : 'gpt-5-nano';
  }

  // Auto mode
  switch (complexity) {
    case 'simple':   return 'gpt-5-nano';
    case 'moderate': return 'claude-haiku-4.5';
    case 'complex':  return 'claude-sonnet-4.6';
    default:         return 'claude-haiku-4.5';
  }
}

// Usage stats
const stats = {
  totalRequests: 0,
  byModel: {},
  byComplexity: { simple: 0, moderate: 0, complex: 0, premium: 0 },
  estimatedSavings: 0, // rough estimate vs always using sonnet
};

/**
 * Route a chat completion through the Bankr LLM Gateway with smart model selection.
 * 
 * @param {Object} opts
 * @param {Array} opts.messages - Chat messages
 * @param {string} [opts.model] - Requested model (may be overridden in auto/eco mode)
 * @param {string} [opts.mode='auto'] - Routing mode: auto|eco|premium
 * @param {number} [opts.maxTokens=1024] - Max tokens
 * @param {string} [opts.apiKey] - Bankr API key (falls back to env/config)
 * @param {boolean} [opts.dryRun=false] - Return routing decision without calling API
 * @param {Object} [opts.extra] - Additional params to pass through
 * @returns {Promise<Object>} API response or dry-run info
 */
async function route(opts) {
  const {
    messages,
    model: requestedModel,
    mode = 'auto',
    maxTokens = 1024,
    apiKey,
    dryRun = false,
    extra = {},
  } = opts;

  const key = apiKey || process.env.BANKR_LLM_KEY || process.env.BANKR_API_KEY;
  if (!key && !dryRun) throw new Error('No Bankr API key available');

  const complexity = classifyComplexity(messages, requestedModel);
  const selectedModel = pickModel(complexity, mode);

  // Track stats
  stats.totalRequests++;
  stats.byModel[selectedModel] = (stats.byModel[selectedModel] || 0) + 1;
  stats.byComplexity[complexity] = (stats.byComplexity[complexity] || 0) + 1;

  const decision = {
    requestedModel,
    selectedModel,
    complexity,
    mode,
    messageCount: messages?.length || 0,
  };

  if (dryRun) return { dryRun: true, ...decision };

  // Determine API format based on model
  const isAnthropic = selectedModel.startsWith('claude-');

  let response;
  if (isAnthropic) {
    response = await fetch(`${BANKR_LLM_URL}/v1/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: selectedModel,
        max_tokens: maxTokens,
        messages,
        ...extra,
      }),
    });
  } else {
    response = await fetch(`${BANKR_LLM_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: selectedModel,
        max_tokens: maxTokens,
        messages,
        ...extra,
      }),
    });
  }

  if (!response.ok) {
    const err = await response.text().catch(() => 'Unknown error');
    throw new Error(`Bankr LLM ${response.status}: ${err}`);
  }

  const result = await response.json();
  result._routing = decision;
  return result;
}

/**
 * Get routing stats
 */
function getStats() {
  return { ...stats };
}

/**
 * Reset stats
 */
function resetStats() {
  stats.totalRequests = 0;
  stats.byModel = {};
  stats.byComplexity = { simple: 0, moderate: 0, complex: 0, premium: 0 };
  stats.estimatedSavings = 0;
}

module.exports = { route, getStats, resetStats, classifyComplexity, pickModel, MODEL_TIERS };
