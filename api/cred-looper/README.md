# Looper CRED shadow corpus

This directory implements a bounded two-stage workflow. It never opens a database, calls a production Helixa API, updates an oracle, or writes anywhere except the explicitly requested output file.

## 1. Collect a Base proof snapshot

Use explicit local JSON files:

- **Roster** (1-688 rows):

  `{ "rosterType":"looper-base-roster-v1", "chainId":"8453", "collection":"0x...", "loopers":[{ "tokenId":"1", "account":"0x...", "owner":"0x..." }] }`
- **Providers**: `{ "providerSetType":"base-rpc-provider-set-v1", "providers":[{ "providerId":"base_a", "url":"https://..." }, { "providerId":"base_b", "url":"https://..." }] }`. Exactly two distinct HTTPS hosts from the collector's Base RPC allowlist are required. Keep provider files outside the repository when URL paths contain credentials; provider URLs are never copied into a snapshot.
- **Assets**: `{ "liquidCredContract":"0x...", "stakingVaultContract":"0x...", "stakingTokenContract":"0x..." }`. The liquid token must expose `balanceOf(address)`; the Pantheon vault must expose `stakes(address,address)`, whose first tuple field is the staked amount.

`npm run cred:looper:collect -- --roster /local/roster.json --providers /local/providers.json --assets /local/assets.json --output /local/snapshot.json`

The collector asks both providers for Base chain ID and height, pins the lower common height, and requires the same block hash and timestamp. It then uses bounded JSON-RPC batches with retries and throttling, requiring byte-identical `code`, `owner()`, `token()`, ETH, liquid CRED, and Pantheon stake responses. The decoded token and owner binding must match every roster row. It is capped at 688 Loopers, bounds each RPC response to 1 MiB, uses 15-second request timeouts, refuses overwrite/symlink output, and writes mode 0600.

## 2. Build and compile offline

Supply the local roster, the collected snapshot, and an Ed25519 PKCS8 PEM/DER private key file with mode 0600:

`npm run cred:looper:build -- --roster /local/roster.json --snapshot /local/snapshot.json --private-key /local/ed25519.pem --output /local/corpus.json`

The build step performs no network I/O. It validates the snapshot's roster commitment and complete one-to-one proof/balance coverage, constructs the exact registry and signed submissions, and invokes the existing CRED evidence compiler. The private key is read only from the supplied local path; only its raw public key enters the registry, and key bytes are never emitted.

Each subject always receives identity and onchain positive proof. Financial positive evidence is emitted only when ETH, liquid CRED, or staked CRED is nonzero. A zero balance emits no financial record and never emits negative evidence. All three schemas use one `helixa_looper_base` provider/control group and one subject/block correlation key, so category coverage cannot create source diversity. The report includes category counts, rating distribution, and gate/reason-code counts. The CLI rejects any corpus that unexpectedly becomes rated; expected subjects remain `UNRATED` until independent canonical gates pass.

## Tests

- `npm run test:cred-looper`
- `npm run test:cred-shadow`
- `npm run test:cred-evidence`
