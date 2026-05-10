export type ManageIdentityRecord = {
  id?: string | number;
  tokenId?: number | null;
  name?: string | null;
  description?: string | null;
  framework?: string | null;
  mintOrigin?: string | null;
  owner?: string | null;
  agentAddress?: string | null;
  walletAddress?: string | null;
  entityType?: string | null;
  credScore?: number | null;
  humanCred?: { score?: number | null } | null;
};

export type HumanSummary = {
  key: string;
  id: string;
  name: string;
  description: string;
  tokenId: number | null;
  walletAddress: string | null;
  credScore: number;
  statusLabel: string;
  managePath: string;
  publicPath: string;
};

export type ManageIdentityState = {
  identityTitle: string;
  humanSummaries: HumanSummary[];
  ownedAgents: ManageIdentityRecord[];
  isLoading: boolean;
  hasHumanProfile: boolean;
  hasAgents: boolean;
  hasOnlyHumanProfile: boolean;
  showAgentTools: boolean;
  emptyAgentTitle: string;
  emptyAgentText: string;
};

export function isHumanIdentityRecord(record: ManageIdentityRecord | null | undefined) {
  if (!record) return false;
  return record.entityType === 'human' || record.framework === 'human' || record.mintOrigin === 'HUMAN';
}

function identityKey(record: ManageIdentityRecord) {
  if (record.tokenId != null) return `token:${record.tokenId}`;
  const wallet = record.walletAddress || record.owner || record.agentAddress;
  if (wallet) return `wallet:${wallet.toLowerCase()}`;
  if (record.id != null) return `id:${record.id}`;
  return `name:${record.name || 'human'}`;
}

function publicProfilePath(record: ManageIdentityRecord) {
  const id = record.tokenId ?? record.walletAddress ?? record.owner ?? record.agentAddress ?? record.id;
  return id != null && String(id).trim() ? `/h/${encodeURIComponent(String(id))}` : '/manage/human';
}

function toHumanSummary(record: ManageIdentityRecord): HumanSummary {
  const tokenId = record.tokenId ?? null;
  const walletAddress = record.walletAddress || record.owner || record.agentAddress || null;
  const id = String(record.id ?? tokenId ?? walletAddress ?? identityKey(record));
  const hasOnchainToken = tokenId != null;

  return {
    key: identityKey(record),
    id,
    name: record.name || 'Human',
    description: record.description || '',
    tokenId,
    walletAddress,
    credScore: Number(record.humanCred?.score ?? record.credScore ?? 0),
    statusLabel: hasOnchainToken ? 'Onchain human' : 'Offchain profile',
    managePath: hasOnchainToken ? `/manage/human?tokenId=${tokenId}` : '/manage/human',
    publicPath: publicProfilePath(record),
  };
}

export function buildManageIdentityState(input: {
  records?: ManageIdentityRecord[] | null;
  fetchedHuman?: ManageIdentityRecord | null;
  isAgentLoading?: boolean;
  isHumanLoading?: boolean;
}): ManageIdentityState {
  const records = input.records || [];
  const humanRecords = records.filter(isHumanIdentityRecord);
  const ownedAgents = records.filter(record => !isHumanIdentityRecord(record));

  const humanSummaries: HumanSummary[] = [];
  const seen = new Set<string>();

  const addHuman = (record: ManageIdentityRecord | null | undefined) => {
    if (!record) return;
    const summary = toHumanSummary(record);
    if (seen.has(summary.key)) return;
    seen.add(summary.key);
    humanSummaries.push(summary);
  };

  addHuman(input.fetchedHuman || null);
  humanRecords.forEach(addHuman);

  const hasHumanProfile = humanSummaries.length > 0;
  const hasAgents = ownedAgents.length > 0;
  const hasOnlyHumanProfile = hasHumanProfile && !hasAgents;

  return {
    identityTitle: 'Manage Your Helixa Identity',
    humanSummaries,
    ownedAgents,
    isLoading: Boolean(input.isAgentLoading || input.isHumanLoading),
    hasHumanProfile,
    hasAgents,
    hasOnlyHumanProfile,
    showAgentTools: hasAgents,
    emptyAgentTitle: hasOnlyHumanProfile ? 'No agents linked yet' : 'No agents found',
    emptyAgentText: hasOnlyHumanProfile
      ? 'Your human profile is live. Register or link an agent when you are ready to manage an onchain agent identity.'
      : 'You do not own any agents yet. Register your first agent when you are ready.',
  };
}
