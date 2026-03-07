const API_BASE = 'https://api.helixa.xyz/api/v2';

async function fetchAgent(id) {
  const res = await fetch(`${API_BASE}/agent/${id}`);
  if (!res.ok) return null;
  return res.json();
}

async function fetchAgentByName(name) {
  const res = await fetch(`${API_BASE}/agents?search=${encodeURIComponent(name)}&limit=1`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.agents?.[0] || null;
}

async function fetchLeaderboard() {
  const res = await fetch(`${API_BASE}/agents?limit=10&sort=credScore&order=desc`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.agents || [];
}

async function fetchAgentByWallet(address) {
  const res = await fetch(`${API_BASE}/agents?search=${encodeURIComponent(address)}&limit=1`);
  if (!res.ok) return null;
  const data = await res.json();
  // Find by owner address
  const agent = data.agents?.find(a => 
    a.owner?.toLowerCase() === address.toLowerCase() ||
    a.agentAddress?.toLowerCase() === address.toLowerCase()
  );
  return agent || data.agents?.[0] || null;
}

async function fetchAllAgents() {
  const res = await fetch(`${API_BASE}/agents?limit=2000&sort=credScore&order=desc`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.agents || [];
}

module.exports = { fetchAgent, fetchAgentByName, fetchLeaderboard, fetchAgentByWallet, fetchAllAgents };
