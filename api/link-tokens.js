const Database = require("better-sqlite3");
const db = new Database(__dirname + "/../../terminal/data/terminal.db");

// Token addresses from GeckoTerminal AI category on Base
const tokenData = {
  VVV: { addr: "0xacfe6019ed1a7dc6f7b508c02d1b04ec88cc21bf", name: "Venice Token" },
  MONTRA: { addr: "0x5bdc2d52adf52e7c510e17a79310a45d80d14b07", name: "MontraFinance" },
  ROBO: { addr: "0x407a5fb66cb1b3d50004f7091c08a27b42ba6d6f", name: "Fabric Protocol" },
  SAIRI: { addr: "0xde61878b0b21ce395266c44d4d548d1c72a3eb07", name: "SAIRI" },
  MOLT: { addr: "0xb695559b26bb2c9703ef1935c37aeae9526bab07", name: "Moltbook" },
  BENCHMARK: { addr: "0x2c4435dd01fd349d2796c45d29b063345dc94ba3", name: "The Benchmark" },
  OTX: { addr: "0xf7e2a6226ffe0693dd85406ac3a8917cbea5dc40", name: "Otonix" },
  DRB: { addr: "0x3ec2156d4c0a9cbdab4a016633b7bcf6a8d68ea2", name: "DebtReliefBot" },
  CLAWNCH: { addr: "0xa1f72459dfa10bad200ac160ecd78c6b77a747be", name: "CLAWNCH" },
  CLAWD: { addr: "0x9f86db9fc6f7c9408e8fda3ff8ce4e78ac7a6b07", name: "clawd" },
};

// First: link tokens to existing agents missing them
const findAgent = db.prepare(`SELECT id, name FROM agents WHERE (UPPER(name) LIKE UPPER(?) OR UPPER(name) LIKE UPPER(?)) AND (token_address IS NULL OR token_address = '') LIMIT 1`);
const updateToken = db.prepare(`UPDATE agents SET token_address = ?, token_symbol = ?, token_name = ? WHERE id = ?`);

let linked = 0;
for (const [sym, data] of Object.entries(tokenData)) {
  const agent = findAgent.get(`%${sym}%`, `%${data.name}%`);
  if (agent) {
    updateToken.run(data.addr, sym, data.name, agent.id);
    console.log(`LINKED: ${sym} -> ${agent.name} (id:${agent.id})`);
    linked++;
  } else {
    console.log(`NO MATCH: ${sym} (may already have token or not in DB)`);
  }
}

// Second: add completely missing agents
const missingAgents = [
  { name: "ODAI", sym: "ODAI", addr: "0x0000000000000000000000000000000000000000", desc: "AI agent on Base" },
  { name: "REPPO", sym: "REPPO", addr: "0xff8104251e7761163fac3211ef5583fb3f8583d6", desc: "Virtuals Protocol agent" },
  { name: "SAIRI", sym: "SAIRI", addr: "0xde61878b0b21ce395266c44d4d548d1c72a3eb07", desc: "AI agent on Base" },
  { name: "BENCHMARK", sym: "BENCHMARK", addr: "0x2c4435dd01fd349d2796c45d29b063345dc94ba3", desc: "The Benchmark - AI agent on Base" },
  { name: "Otonix", sym: "OTX", addr: "0xf7e2a6226ffe0693dd85406ac3a8917cbea5dc40", desc: "AI agent on Base" },
  { name: "MontraFinance", sym: "MONTRA", addr: "0x5bdc2d52adf52e7c510e17a79310a45d80d14b07", desc: "AI agent on Base" },
  { name: "ELSA", sym: "ELSA", addr: "0x0000000000000000000000000000000000000000", desc: "AI agent on Base" },
  { name: "KTA", sym: "KTA", addr: "0x0000000000000000000000000000000000000000", desc: "AI agent on Base" },
  { name: "TGATE", sym: "TGATE", addr: "0x0000000000000000000000000000000000000000", desc: "AI agent on Base" },
  { name: "HYDX", sym: "HYDX", addr: "0x0000000000000000000000000000000000000000", desc: "AI agent on Base" },
  { name: "Arbase", sym: "Arbase", addr: "0x0000000000000000000000000000000000000000", desc: "AI agent on Base" },
  { name: "CHARLES", sym: "CHARLES", addr: "0x0000000000000000000000000000000000000000", desc: "Virtuals Protocol agent" },
  { name: "TAKEOVER", sym: "TAKEOVER", addr: "0x0000000000000000000000000000000000000000", desc: "AI agent on Base" },
  { name: "PERKOS", sym: "PERKOS", addr: "0x0000000000000000000000000000000000000000", desc: "AI agent on Base" },
  { name: "MLTL", sym: "MLTL", addr: "0x0000000000000000000000000000000000000000", desc: "AI agent on Base" },
];

// Check which are truly missing
const checkExists = db.prepare(`SELECT id FROM agents WHERE UPPER(name) LIKE UPPER(?) OR token_symbol = ? LIMIT 1`);
const insertAgent = db.prepare(`INSERT INTO agents (name, description, token_address, token_symbol, token_name, chain_id, registry, cred_score, cred_tier, created_at) VALUES (?, ?, ?, ?, ?, 8453, 'community', 10, 'Junk', datetime('now'))`);

let added = 0;
for (const a of missingAgents) {
  const exists = checkExists.get(`%${a.sym}%`, a.sym);
  if (!exists) {
    try {
      insertAgent.run(a.name, a.desc, a.addr === "0x0000000000000000000000000000000000000000" ? null : a.addr, a.sym, a.name);
      console.log(`ADDED: ${a.name} ($${a.sym})`);
      added++;
    } catch (e) {
      console.log(`FAILED: ${a.name} - ${e.message}`);
    }
  } else {
    console.log(`SKIP (exists): ${a.name}`);
  }
}

console.log(`\nDone: ${linked} linked, ${added} added`);
