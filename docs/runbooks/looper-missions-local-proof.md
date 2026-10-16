# Swarm Command local proof

1. Use the pinned Node/Foundry toolchains and a clean checkout of the implementation commit.
2. Run `node scripts/missions/run-local-proof.mjs` from the repository root.
3. Require every local command in `review-artifacts/looper-missions/local-proof/manifest.json` to be `passed`.
4. Inspect the 1200/390/320 screenshots and `ui-proof.json`; require zero horizontal overflow, keyboard focus proof, and no internal topology.
5. Treat `real-xmtp-dev-group` and `base-testnet-deployment` as external approval boundaries, not waived gates.

No mainnet deployment or real funding is part of this proof.
