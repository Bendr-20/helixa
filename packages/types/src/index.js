import { createRequire } from 'node:module';

export * from './missions.js';
export * from './swarm-launch.js';

const require = createRequire(import.meta.url);

export const agentCardSchema = require('../schemas/agent-card.schema.json');
export const identityFragmentSchema = require('../schemas/identity-fragment.schema.json');
export const multipassProfileSchema = require('../schemas/multipass-profile.schema.json');
export const receiptFragmentSchema = require('../schemas/receipt-fragment.schema.json');
export const standardsProfileSchema = require('../schemas/standards-profile.schema.json');
export const x402ManifestSchema = require('../schemas/x402-manifest.schema.json');
export const x401ManifestSchema = require('../schemas/x401-manifest.schema.json');

export const subjectTypes = ['agent', 'human', 'swarm', 'collection', 'project', 'organization'];

export const multipassStatuses = [
  'draft',
  'link_ready',
  'active',
  'transfer_pending',
  'suspended',
  'archived',
];

export const ownerStates = ['unclaimed', 'claimed', 'verified', 'transferred'];

export const fragmentTypes = [
  'wallet',
  'social',
  'domain',
  'project',
  'collection',
  'endpoint',
  'attestation',
  'receipt',
  'standard_ref',
  'risk_summary',
  'tool_manifest',
  'work_record',
  'custody_record',
  'verification_result',
];

export const fragmentStatuses = ['pending', 'verified', 'stale', 'revoked', 'disputed', 'historical'];

export const assuranceLevels = [
  'unverified',
  'self_attested',
  'platform_verified',
  'cryptographic',
  'issuer_attested',
  'onchain_verified',
];

export const visibilityLevels = ['public', 'gated', 'private', 'hidden'];

export const transferPolicies = [
  'reverify_on_transfer',
  'pause_on_transfer',
  'historical_on_transfer',
  'never_transfer',
];

export const standardStatuses = [
  'active',
  'adapter_ready',
  'pending',
  'stale',
  'disputed',
  'revoked',
  'unsupported',
  'imported_unverified',
];

export const receiptStatuses = ['pending', 'settled', 'failed', 'refunded', 'disputed'];

export const schemaRegistry = [
  {
    name: 'multipass-profile',
    id: multipassProfileSchema.$id,
    title: multipassProfileSchema.title,
    schema: multipassProfileSchema,
  },
  {
    name: 'identity-fragment',
    id: identityFragmentSchema.$id,
    title: identityFragmentSchema.title,
    schema: identityFragmentSchema,
  },
  {
    name: 'agent-card',
    id: agentCardSchema.$id,
    title: agentCardSchema.title,
    schema: agentCardSchema,
  },
  {
    name: 'standards-profile',
    id: standardsProfileSchema.$id,
    title: standardsProfileSchema.title,
    schema: standardsProfileSchema,
  },
  {
    name: 'x402-manifest',
    id: x402ManifestSchema.$id,
    title: x402ManifestSchema.title,
    schema: x402ManifestSchema,
  },
  {
    name: 'x401-manifest',
    id: x401ManifestSchema.$id,
    title: x401ManifestSchema.title,
    schema: x401ManifestSchema,
  },
  {
    name: 'receipt-fragment',
    id: receiptFragmentSchema.$id,
    title: receiptFragmentSchema.title,
    schema: receiptFragmentSchema,
  },
];
