import express from "express";
import cors from "cors";
import { paymentMiddleware } from "@x402/express";
import { contract } from "./contract.js";
import { generateAura, getAuraRarity } from "../sdk/lib/aura.js";

const app = express();
app.use(cors());

// --- Config ---
const PORT = process.env.PORT || 3402;
const FACILITATOR_URL = process.env.FACILITATOR_URL || "https://x402.org/facilitator";
const PAYWALL_ADDRESS = process.env.PAYWALL_ADDRESS; // your wallet to receive USDC

// USDC on Base Sepolia
const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const PRICE = "$0.001"; // per query

// --- x402 paywall on premium endpoints ---
if (PAYWALL_ADDRESS) {
  const paymentConfig = {
    "GET /agent/:id": {
      price: PRICE,
      network: "base-sepolia",
      config: {
        description: "Full agent data (name, framework, personality, traits, mutations, points, verified, aura SVG)",
      },
    },
    "GET /verify/:id": {
      price: PRICE,
      network: "base-sepolia",
      config: {
        description: "Agent verification status and reputation score",
      },
    },
    "GET /reputation/:address": {
      price: PRICE,
      network: "base-sepolia",
      config: {
        description: "Address reputation: points, rarity tier, trait count, mutation count",
      },
    },
  };

  app.use(paymentMiddleware(paymentConfig, {
    facilitatorUrl: FACILITATOR_URL,
    payTo: PAYWALL_ADDRESS,
    asset: USDC_BASE_SEPOLIA,
  }));
}

// --- Helpers ---
function agentToJSON(agent) {
  return {
    agentAddress: agent.agentAddress,
    name: agent.name,
    framework: agent.framework,
    mintedAt: Number(agent.mintedAt),
    verified: agent.verified,
    soulbound: agent.soulbound,
    generation: Number(agent.generation),
    parentDNA: agent.parentDNA === BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff") ? null : Number(agent.parentDNA),
    currentVersion: agent.currentVersion,
    mutationCount: Number(agent.mutationCount),
  };
}

function personalityToJSON(p) {
  return {
    temperament: p.temperament,
    communicationStyle: p.communicationStyle,
    riskTolerance: Number(p.riskTolerance),
    autonomyLevel: Number(p.autonomyLevel),
    alignment: p.alignment,
    specialization: p.specialization,
  };
}

// --- FREE: /stats ---
app.get("/stats", async (_req, res) => {
  try {
    const [totalAgents, totalPoints, beta] = await Promise.all([
      contract.totalAgents(),
      contract.totalPointsAwarded(),
      contract.betaEnded(),
    ]);
    res.json({
      totalAgents: Number(totalAgents),
      totalPointsAwarded: Number(totalPoints),
      betaActive: !beta,
      note: "All endpoints are FREE during beta. x402 paywall activates post-beta.",
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- FREE: /search?name=X ---
app.get("/search", async (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: "name query param required" });
  try {
    const total = Number(await contract.totalAgents());
    const results = [];
    // Linear scan — fine for small registries, no DB needed
    for (let i = 0; i < total && results.length < 10; i++) {
      try {
        const agent = await contract.getAgent(i);
        if (agent.name.toLowerCase().includes(name.toLowerCase())) {
          results.push({ id: i, ...agentToJSON(agent) });
        }
      } catch { /* token may not exist */ }
    }
    res.json({ query: name, results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- FREE: /aura/:id ---
app.get("/aura/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [agent, personality, traits] = await Promise.all([
      contract.getAgent(id),
      contract.getPersonality(id),
      contract.getTraits(id),
    ]);
    const owner = await contract.ownerOf(id);
    const pts = Number(await contract.points(owner));

    const auraData = {
      agentAddress: agent.agentAddress,
      name: agent.name,
      framework: agent.framework.toLowerCase(),
      traitCount: traits.length,
      mutationCount: Number(agent.mutationCount),
      soulbound: agent.soulbound,
      points: pts,
      generation: Number(agent.generation),
      temperament: personality.temperament,
      communicationStyle: personality.communicationStyle,
      riskTolerance: Number(personality.riskTolerance),
      autonomyLevel: Number(personality.autonomyLevel),
      alignment: personality.alignment,
      specialization: personality.specialization,
    };

    const svg = generateAura(auraData, 400);
    res.setHeader("Content-Type", "image/svg+xml");
    res.send(svg);
  } catch (e) {
    res.status(404).json({ error: `Agent #${req.params.id} not found: ${e.message}` });
  }
});

// --- PAID: /agent/:id ---
app.get("/agent/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [agent, personality, traits, mutations] = await Promise.all([
      contract.getAgent(id),
      contract.getPersonality(id),
      contract.getTraits(id),
      contract.getMutations(id),
    ]);
    const owner = await contract.ownerOf(id);
    const pts = Number(await contract.points(owner));

    const auraData = {
      agentAddress: agent.agentAddress,
      name: agent.name,
      framework: agent.framework.toLowerCase(),
      traitCount: traits.length,
      mutationCount: Number(agent.mutationCount),
      soulbound: agent.soulbound,
      points: pts,
      generation: Number(agent.generation),
      temperament: personality.temperament,
      communicationStyle: personality.communicationStyle,
      riskTolerance: Number(personality.riskTolerance),
      autonomyLevel: Number(personality.autonomyLevel),
      alignment: personality.alignment,
      specialization: personality.specialization,
    };

    const rarity = getAuraRarity(pts, Number(agent.mutationCount));
    const svg = generateAura(auraData, 400);

    res.json({
      id,
      ...agentToJSON(agent),
      personality: personalityToJSON(personality),
      traits: traits.map(t => ({ name: t.name, category: t.category, addedAt: Number(t.addedAt) })),
      mutations: mutations.map(m => ({
        fromVersion: m.fromVersion, toVersion: m.toVersion,
        description: m.description, timestamp: Number(m.timestamp),
      })),
      points: pts,
      rarity,
      owner,
      auraSVG: svg,
    });
  } catch (e) {
    res.status(404).json({ error: `Agent #${req.params.id} not found: ${e.message}` });
  }
});

// --- PAID: /verify/:id ---
app.get("/verify/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [verified, agent] = await Promise.all([
      contract.isVerified(id),
      contract.getAgent(id),
    ]);
    const owner = await contract.ownerOf(id);
    const pts = Number(await contract.points(owner));
    const traits = await contract.getTraits(id);
    const rarity = getAuraRarity(pts, Number(agent.mutationCount));

    res.json({
      id,
      name: agent.name,
      verified,
      reputationScore: pts,
      rarity,
      traitCount: traits.length,
      mutationCount: Number(agent.mutationCount),
      generation: Number(agent.generation),
    });
  } catch (e) {
    res.status(404).json({ error: `Agent #${req.params.id} not found: ${e.message}` });
  }
});

// --- PAID: /reputation/:address ---
app.get("/reputation/:address", async (req, res) => {
  try {
    const addr = req.params.address;
    const has = await contract.hasAgent(addr);
    const pts = Number(await contract.points(addr));

    let traitCount = 0, mutationCount = 0;
    if (has) {
      const tokenId = Number(await contract.agentAddressToToken(addr));
      const [agent, traits] = await Promise.all([
        contract.getAgent(tokenId),
        contract.getTraits(tokenId),
      ]);
      traitCount = traits.length;
      mutationCount = Number(agent.mutationCount);
    }

    const rarity = getAuraRarity(pts, mutationCount);

    res.json({
      address: addr,
      hasAgent: has,
      points: pts,
      rarity,
      traitCount,
      mutationCount,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`🧬 AgentDNA API running on :${PORT}`);
  console.log(`   x402 paywall: ${PAYWALL_ADDRESS ? "ACTIVE" : "DISABLED (set PAYWALL_ADDRESS to enable)"}`);
});
