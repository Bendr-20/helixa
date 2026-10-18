export * from './missions.js';

export type SubjectType = 'agent' | 'human' | 'swarm' | 'collection' | 'project' | 'organization';
export type MultipassStatus = 'draft' | 'link_ready' | 'active' | 'transfer_pending' | 'suspended' | 'archived';
export type OwnerState = 'unclaimed' | 'claimed' | 'verified' | 'transferred';
export type FragmentType =
  | 'wallet'
  | 'social'
  | 'domain'
  | 'project'
  | 'collection'
  | 'endpoint'
  | 'attestation'
  | 'receipt'
  | 'standard_ref'
  | 'risk_summary'
  | 'tool_manifest'
  | 'work_record'
  | 'custody_record'
  | 'verification_result';
export type FragmentStatus = 'pending' | 'verified' | 'stale' | 'revoked' | 'disputed' | 'historical';
export type AssuranceLevel =
  | 'unverified'
  | 'self_attested'
  | 'platform_verified'
  | 'cryptographic'
  | 'issuer_attested'
  | 'onchain_verified';
export type VisibilityLevel = 'public' | 'gated' | 'private' | 'hidden';
export type TransferPolicy = 'reverify_on_transfer' | 'pause_on_transfer' | 'historical_on_transfer' | 'never_transfer';
export type StandardStatus =
  | 'active'
  | 'adapter_ready'
  | 'pending'
  | 'stale'
  | 'disputed'
  | 'revoked'
  | 'unsupported'
  | 'imported_unverified';
export type ReceiptStatus = 'pending' | 'settled' | 'failed' | 'refunded' | 'disputed';

export interface JsonSchemaDocument {
  $schema: string;
  $id: string;
  title: string;
  type: string;
  [key: string]: unknown;
}

export interface SchemaRegistryEntry {
  name:
    | 'multipass-profile'
    | 'identity-fragment'
    | 'agent-card'
    | 'standards-profile'
    | 'x402-manifest'
    | 'x401-manifest'
    | 'receipt-fragment';
  id: string;
  title: string;
  schema: JsonSchemaDocument;
}

export const subjectTypes: SubjectType[];
export const multipassStatuses: MultipassStatus[];
export const ownerStates: OwnerState[];
export const fragmentTypes: FragmentType[];
export const fragmentStatuses: FragmentStatus[];
export const assuranceLevels: AssuranceLevel[];
export const visibilityLevels: VisibilityLevel[];
export const transferPolicies: TransferPolicy[];
export const standardStatuses: StandardStatus[];
export const receiptStatuses: ReceiptStatus[];
export const schemaRegistry: SchemaRegistryEntry[];

export const agentCardSchema: JsonSchemaDocument;
export const identityFragmentSchema: JsonSchemaDocument;
export const multipassProfileSchema: JsonSchemaDocument;
export const receiptFragmentSchema: JsonSchemaDocument;
export const standardsProfileSchema: JsonSchemaDocument;
export const x402ManifestSchema: JsonSchemaDocument;
export const x401ManifestSchema: JsonSchemaDocument;
