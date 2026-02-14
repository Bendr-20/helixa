#!/usr/bin/env bash
set -euo pipefail

# Deploy AgentTrustScore to Base mainnet
# Required env vars: PRIVATE_KEY, RPC_URL, BASESCAN_API_KEY

AGENT_DNA="0x665971e7bf8ec90c3066162c5b396604b3cd7711"
REGISTRY="0x0000000000000000000000000000000000000000"  # No cross-registry initially

echo "Deploying AgentTrustScore..."
DEPLOYED=$(forge create src/AgentTrustScore.sol:AgentTrustScore \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --constructor-args "$AGENT_DNA" "$REGISTRY" \
  --via-ir \
  --optimizer-runs 10 \
  --json | jq -r '.deployedTo')

echo "Deployed to: $DEPLOYED"

echo "Verifying on Basescan..."
forge verify-contract "$DEPLOYED" src/AgentTrustScore.sol:AgentTrustScore \
  --chain base \
  --constructor-args $(cast abi-encode "constructor(address,address)" "$AGENT_DNA" "$REGISTRY") \
  --etherscan-api-key "$BASESCAN_API_KEY" \
  --watch

echo "Done! Contract: $DEPLOYED"
