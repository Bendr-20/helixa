# Looper CRED Shadow Corpus Plan

Goal: produce a deterministic, offline CRED shadow corpus for all 688 activated Loopers without changing production scores or overstating evidence independence.

## Evidence lanes

1. **Identity:** dual-provider Base proof that each token-bound account returns the canonical Looper token binding and an owner.
2. **Onchain:** the same pinned account proof establishes a deployed, callable account; it is separately categorized but shares the Helixa control group and correlation key so it cannot manufacture diversity.
3. **Financial:** dual-provider wallet snapshot records ETH, liquid CRED, and staked CRED. Emit low-materiality positive evidence only when at least one balance is nonzero; zero balance is absence of evidence, not negative evidence.

## Safety and honesty

- Two Base RPC providers must agree byte-for-byte at one pinned block.
- All Helixa-collected lanes use one control group; categories improve coverage but not source diversity.
- Inputs and outputs are local files; no database, signer service, production API mutation, oracle update, privilege, reward, or clock start.
- Private Ed25519 key stays outside the repository; only its public key enters the registry.
- Corpus subjects remain UNRATED unless the canonical gates independently pass.

## Build steps

1. Add and test a bounded dual-provider account proof collector for a supplied roster and wallet accounts.
2. Add and test a pure Looper registry/submission builder using exact schemas, append-only IDs, canonical timestamps, and signed submissions.
3. Add an offline CLI that compiles the generated inputs through the existing evidence pipeline.
4. Run against the live 688-token roster and a fresh dual-provider wallet snapshot.
5. Compile twice; require byte-identical outputs, verify hashes, inspect rating/gate distributions, and preserve a report.
6. Run all CRED suites, syntax checks, diff checks, and isolation checks before commit/push.
