'use strict';

function buildGenericAuraAgent(tokenId) {
  const id = Number(tokenId);
  return {
    tokenId: id,
    name: `Helixa Agent #${id}`,
    agentAddress: '0x0000',
    framework: 'custom',
    traits: [],
    mutationCount: 0,
    soulbound: false,
    points: 0,
    generation: 0,
    personality: null,
    narrative: null,
    credScore: 0,
  };
}

async function resolveAuraSourceWithFallback(tokenId, loader, options = {}) {
  const timeoutMs = Number(options.timeoutMs || 2500);
  const fallback = buildGenericAuraAgent(tokenId);

  try {
    return await Promise.race([
      Promise.resolve().then(() => loader(tokenId)),
      new Promise(resolve => setTimeout(() => resolve(fallback), timeoutMs)),
    ]);
  } catch (_) {
    return fallback;
  }
}

module.exports = {
  buildGenericAuraAgent,
  resolveAuraSourceWithFallback,
};
