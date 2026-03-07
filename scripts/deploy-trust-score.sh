#!/usr/bin/env bash
set -euo pipefail

# Deploy AgentTrustScore to Base mainnet
# Required env vars: PRIVATE_KEY, RPC_URL, BASESCAN_API_KEY

AGENT_DNA="0x2e3B541C59D38b84E3Bc54e977200230A204Fe60"
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
