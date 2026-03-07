/**
 * Get Bendr an AgentMail inbox via x402 payment
 * Uses deployer wallet USDC on Base
 */
import { privateKeyToAccount } from "viem/accounts";
import { x402Client } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { AgentMailClient } from "agentmail";
import { readFileSync } from "fs";

// Load deployer key from AWS Secrets Manager cache or env
let PRIVATE_KEY;
try {
  // Try loading from the cached secret
  const { execSync } = await import("child_process");
  const secret = execSync(
    `aws secretsmanager get-secret-value --secret-id helixa/deployer-key --query SecretString --output text --region us-east-2`,
    { encoding: "utf8" }
  ).trim();
  const parsed = JSON.parse(secret);
  PRIVATE_KEY = parsed.DEPLOYER_PRIVATE_KEY;
} catch (e) {
  console.error("Failed to load deployer key:", e.message);
  process.exit(1);
}

console.log("Deployer key loaded");

// Setup x402 client
const signer = privateKeyToAccount(PRIVATE_KEY);
console.log("Signer address:", signer.address);

const x402 = new x402Client();
x402.register("eip155:*", new ExactEvmScheme(signer));

// Setup AgentMail client with x402
const client = new AgentMailClient({ x402 });

// Create inbox
const username = "bendr";
console.log(`Creating inbox: ${username}@agentmail.to`);

try {
  const inboxRes = await client.inboxes.create({
    username: username,
  });
  console.log("Created inbox:", JSON.stringify(inboxRes, null, 2));
} catch (e) {
  if (e.message?.includes("already") || e.status === 409) {
    console.log(`Username '${username}' taken, trying 'bendr-helixa'...`);
    const inboxRes = await client.inboxes.create({
      username: "bendr-helixa",
    });
    console.log("Created inbox:", JSON.stringify(inboxRes, null, 2));
  } else {
    console.error("Error:", e.message || e);
    console.error("Full error:", JSON.stringify(e, null, 2));
    // Try to see what the 402 response looks like
    if (e.response) {
      const text = await e.response.text?.() || "no body";
      console.error("Response:", text);
    }
    throw e;
  }
}
