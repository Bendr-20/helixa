const DEFAULT_REGISTRY = '0x2e3B541C59D38b84E3Bc54e977200230A204Fe60';

function tierOf(score) {
  const s = Number(score || 0);
  if (s >= 91) return 'PREFERRED';
  if (s >= 76) return 'PRIME';
  if (s >= 51) return 'QUALIFIED';
  if (s >= 26) return 'MARGINAL';
  return 'JUNK';
}

function normalizeHelixaTerminalAgent(agent, options = {}) {
  const tokenId = Number(agent.tokenId ?? agent.token_id);
  if (!Number.isInteger(tokenId) || tokenId < 0) throw new Error('tokenId is required');
  const helixaTokenId = `helixa-${tokenId}`;
  const score = Number(agent.credScore ?? agent.cred_score ?? 0);
  const address = String(agent.agentAddress || agent.address || agent.owner || '').toLowerCase() || null;
  const owner = String(agent.owner || agent.ownerAddress || agent.agentAddress || agent.address || '').toLowerCase() || address;
  const framework = agent.framework || options.framework || 'custom';
  const mintOrigin = agent.mintOrigin || options.mintOrigin || null;
  const soulbound = agent.soulbound === true || agent.soulbound === 1;
  const name = agent.name || `Agent #${tokenId}`;
  const mintedAt = agent.mintedAt || agent.created_at || new Date().toISOString();

  return {
    address,
    agent_id: helixaTokenId,
    token_id: helixaTokenId,
    name,
    cred_score: score,
    cred_tier: tierOf(score),
    verified: agent.verified ? 1 : 0,
    image_url: `https://api.helixa.xyz/api/v2/aura/${tokenId}.png`,
    description: `${name} — ${framework} agent on Helixa (ERC-8004).`,
    metadata: JSON.stringify({ framework, mintOrigin, soulbound }),
    registry: options.registry || DEFAULT_REGISTRY,
    owner_address: owner,
    created_at: mintedAt,
    registered_at: mintedAt,
  };
}

function syncHelixaAgentToTerminal(db, agent, options = {}) {
  const row = normalizeHelixaTerminalAgent(agent, options);
  db.prepare(`INSERT INTO agents
      (address, agent_id, token_id, chain_id, name, platform, x402_supported,
       cred_score, cred_tier, verified, image_url, description, metadata, registry,
       owner_address, created_at, registered_at)
      VALUES (@address, @agent_id, @token_id, 8453, @name, 'helixa', 1,
       @cred_score, @cred_tier, @verified, @image_url, @description, @metadata, @registry,
       @owner_address, @created_at, @registered_at)
      ON CONFLICT(chain_id, token_id) DO UPDATE SET
        address = excluded.address,
        agent_id = excluded.agent_id,
        name = excluded.name,
        platform = 'helixa',
        x402_supported = 1,
        cred_score = excluded.cred_score,
        cred_tier = excluded.cred_tier,
        verified = excluded.verified,
        image_url = excluded.image_url,
        description = excluded.description,
        metadata = excluded.metadata,
        registry = excluded.registry,
        owner_address = excluded.owner_address,
        created_at = COALESCE(agents.created_at, excluded.created_at),
        registered_at = COALESCE(agents.registered_at, excluded.registered_at)`).run(row);
  return row;
}

module.exports = {
  DEFAULT_REGISTRY,
  normalizeHelixaTerminalAgent,
  syncHelixaAgentToTerminal,
  tierOf,
};
