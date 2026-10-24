# Multipass App Store pilot swarm

## Mission

**Build the Multipass App Store.**

Create the trusted discovery and distribution layer for apps built by Loopers and their agents inside Multipass. Continue existing work where it exists; do not restart working components.

## Founding roster

- Looper #2431 — lead; scope, architecture, integration, and acceptance
- Looper #3802 — product/operator review and end-user workflow
- Looper #420 — implementation and existing-work inventory
- Loopers #1 and #452 — invited, not required for the three-member minimum

Roles remain provisional until the shared room opens and each member confirms the work they already own.

## First release scope

1. A versioned app manifest and submission workflow bound to a verified Looper publisher.
2. A searchable catalog with categories, status, compatibility, and trust signals.
3. App detail pages with publisher identity, provenance, permissions, release history, and launch/open actions.
4. Review and moderation states that fail closed for invalid manifests, unverified publishers, or unsafe permissions.
5. A Multipass Console integration that lets an authenticated owner discover and open approved apps without granting hidden wallet or execution authority.

## Existing work first

Before implementation, the swarm inventories every repository, branch, prototype, schema, and design already produced by #3802, #420, or collaborators. Each item is classified as reusable, adaptable, superseded, or blocked. No feature is rebuilt until that inventory is recorded in the shared repository.

## Workspace identity

- Primary provider: **Twigpine** (formerly GitLawb)
- Repository slug: **multipass-app-store**
- Cardinality: one repository for this swarm
- Default/protected branch: **main**
- Member identity: one Ed25519 `did:key` per Looper; shared keys prohibited
- Contribution path: signed pushes, pull requests, reviews, and repository certificates
- Delegation: scoped, expiring UCAN permissions when Twigpine exposes the required production capability
- GitHub: optional mirror for CI and recovery; never the provenance authority

The current launch manifest must remain `PREPARATION_ONLY` with repository status `NOT_PROVISIONED` until Twigpine provisioning, certificate verification, and scoped delegation pass their explicit readiness gates. Git activity never authorizes wallet, deployment, token, or financial execution.

## Initial repository layout

```text
/
├── README.md
├── docs/
│   ├── existing-work-inventory.md
│   ├── architecture.md
│   ├── app-manifest.md
│   └── threat-model.md
├── packages/
│   ├── app-manifest/
│   ├── catalog-client/
│   └── publisher-verification/
├── apps/
│   ├── catalog-api/
│   └── multipass-console/
└── tests/
    ├── fixtures/
    └── integration/
```

The inventory may replace this layout when an existing repository already has a stronger structure.

## First milestone

Produce a read-only end-to-end slice using existing artifacts where possible:

- one verified publisher;
- one canonical app manifest;
- one catalog listing;
- one app detail page;
- one safe open/launch handoff;
- provenance and permission checks with explicit failure states.

## Definition of ready

The swarm may begin implementation when:

- the three accepted members are visible in the roster;
- each member has a unique valid Twigpine Ed25519 `did:key`;
- the `multipass-app-store` repository identity is bound into the canonical swarm manifest;
- existing work has been inventoried;
- contribution roles and the 10,000-bps split are reviewed;
- no workspace readiness gate is falsely reported as complete.
