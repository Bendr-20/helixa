/**
 * Cold x402 mint test — simulating a random agent discovering Helixa
 * No insider knowledge, just the API endpoint and a funded wallet
 */
import { privateKeyToAccount } from "viem/accounts";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { createWalletClient, http } from "viem";
import { base } from "viem/chains";
import { execSync } from "child_process";

// Random agent's wallet (using deployer for testing)
const secret = JSON.parse(execSync(
  `aws secretsmanager get-secret-value --secret-id helixa/deployer-key --query SecretString --output text --region us-east-2`,
  { encoding: "utf8" }
).trim());
const signer = privateKeyToAccount(secret.DEPLOYER_PRIVATE_KEY);

// Setup x402 — this is all a random agent would need
const client = new x402Client();
client.register("eip155:*", new ExactEvmScheme(signer));
const x402Fetch = wrapFetchWithPayment(fetch, client);

// SIWA helper — sign "Sign-In With Agent" message
async function createSIWAAuth() {
  const walletClient = createWalletClient({ account: signer, chain: base, transport: http() });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = `Sign-In With Agent: api.helixa.xyz wants you to sign in with your wallet ${signer.address} at ${timestamp}`;
  const signature = await walletClient.signMessage({ message });
  return `Bearer ${signer.address}:${timestamp}:${signature}`;
}

const API = "https://api.helixa.xyz";

// Test names — real-sounding agent names, not "test"
const agents = [
  { name: "Phantom Relay", framework: "langchain", soulbound: false },
  { name: "Nox", framework: "openclaw", soulbound: true },
  { name: "Verdana Prime", framework: "eliza", soulbound: false },
];

async function testMint(agent) {
  console.log(`\n=== Minting "${agent.name}" ===`);
  console.log(`Wallet: ${signer.address}`);
  console.log(`Framework: ${agent.framework}, Soulbound: ${agent.soulbound}`);
  
  const url = `${API}/api/v2/mint`;
  const body = {
    name: agent.name,
    framework: agent.framework,
    soulbound: agent.soulbound,
  };

  console.log(`POST ${url}`);
  console.log(`Body: ${JSON.stringify(body)}`);
  
  try {
    const auth = await createSIWAAuth();
    const start = Date.now();
    const res = await x402Fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": auth },
      body: JSON.stringify(body),
    });
    const elapsed = Date.now() - start;
    
    console.log(`Status: ${res.status} (${elapsed}ms)`);
    const data = await res.text();
    
    try {
      const json = JSON.parse(data);
      console.log(`Response: ${JSON.stringify(json, null, 2)}`);
    } catch {
      console.log(`Response (raw): ${data.substring(0, 500)}`);
    }
    
    return res.status;
  } catch (e) {
    console.error(`Error: ${e.message}`);
    if (e.cause) console.error(`Cause: ${JSON.stringify(e.cause, null, 2)}`);
    return null;
  }
}

// Run tests sequentially
console.log("=== x402 Cold Mint Test ===");
console.log(`Signer: ${signer.address}`);

// Test 1: Standard mint
const status1 = await testMint(agents[0]);

if (status1 === 200 || status1 === 201) {
  console.log("\n✅ Test 1 PASSED — standard x402 mint works");
  // Do test 2
  const status2 = await testMint(agents[1]);
  if (status2 === 200 || status2 === 201) {
    console.log("\n✅ Test 2 PASSED — soulbound mint works");
  } else {
    console.log(`\n❌ Test 2 FAILED — status ${status2}`);
  }
} else {
  console.log(`\n❌ Test 1 FAILED — status ${status1}`);
  console.log("Not running more tests until this is fixed");
}
