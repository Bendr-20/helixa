# Bankr: canonical Looper wallet resolution

Status: draft integration and incident report. Not sent.

## Incident

On Base transaction `0xcd968e38a50009b9bc2152e89a65fd0f511f89f820cfef635435784085f4065f`, Bankr sent 5 USDC and 0.000402234103904579 ETH each to addresses derived from the Loopers collection's current `tokenBoundAccount(tokenId)` configuration:

- Looper #1247: sent to `0x92BD0870FC1dD47b164E23F63A0762F3aee14c2a`
- Looper #3363: sent to `0xE490cC2dfAb0B6Cc0EF27372A0ddea8d37018C70`

Those addresses were undeployed. The existing activated wallets are:

- Looper #1247: `0xDe0D2c5AB01CDC7E3925Bf6fC30211549C3eeADb`
- Looper #3363: `0x6bc5E6B97493649a5653E8BA17f58603c049261a`

The activated wallets already contain the holders' operational state, including Pantheon positions. They must not be replaced or migrated for this integration.

## Public resolver

Use:

`GET https://api.helixa.xyz/api/loopers/{token_id}/wallet`

A successful response returns:

- `status: "activated"`
- `block_number` and `block_hash`: shared finalized Base evidence anchor
- `canonical_wallet.address`: verified deployed released account
- `canonical_wallet.binding_verified: true`
- `transfer_policy.recipient`: exact transfer destination
- `transfer_policy.require_exact_recipient: true`
- `transfer_policy.token_id_lookup_safe`: whether the collection-advertised address matches the verified activated address
- `contract_reference`: the collection-advertised address and mismatch status

The resolver returns a destination only after at least two distinct Base providers agree at one finalized block on:

1. the current Looper NFT owner;
2. the collection-advertised account;
3. exact deployed released-account proxy runtime;
4. the account's Base chain, collection, and token-ID binding; and
5. the account owner matching the current NFT owner.

Unactivated accounts, provider disagreement, unavailable or timed-out evidence, wrong-chain evidence, finalized-block mismatch, wrong runtime, wrong binding, or owner mismatch return an error without a transfer destination. Inputs are restricted to Loopers #1–7777; concurrent reads are coalesced and the public route is globally rate-limited.

## Required Bankr behavior

1. When a user names a Looper token ID, call the resolver before preparing a transfer.
2. Use `transfer_policy.recipient` exactly; do not independently derive an ERC-6551 address.
3. Abort if the resolver is non-200, `status` is not `activated`, `binding_verified` is not true, or `require_exact_recipient` is not true.
4. If `token_id_lookup_safe` is false, show a warning that the collection-derived address differs and never substitute it.
5. Show the exact recipient in the final transaction preview and require confirmation against that literal address.
6. Do not deploy an account, migrate a wallet, alter Pantheon positions, or move existing wallet assets.

## Requested incident remedy

Please reimburse or resend the misplaced 10 USDC plus the intended ETH to the two verified activated wallets above. Do not attempt recovery by deploying the unintended addresses unless the holders separately request and authorize it.
