export const MISSION_SOURCE_LABELS = Object.freeze({ onchain: 'Onchain', helixa_ledger: 'Helixa ledger', id_agents: 'ID Agents', xmtp: 'XMTP' });
export const MISSION_UI_STATES = Object.freeze(['draft', 'recruiting', 'team_selected', 'funding', 'funded', 'launching', 'active', 'review', 'settled', 'cancelled', 'refunded']);
const SOURCE_SET = new Set(Object.keys(MISSION_SOURCE_LABELS));
const STATE_SET = new Set(MISSION_UI_STATES);
const INTERNAL_KEY = /(^|_)(manager|credential|secret|private_key|session_token|conversation_id|internal_id)($|_)/iu;

export function missionCardView(mission = {}) {
  assertPublicSafe(mission);
  if (!STATE_SET.has(mission.state)) throw new TypeError('Mission state is invalid.');
  return Object.freeze({
    missionId: identifier(mission.missionId, 'missionId'),
    title: bounded(mission.title ?? mission.publicDocument?.title ?? mission.publicSummary, 'title', 1, 160),
    summary: bounded(mission.publicSummary, 'publicSummary', 1, 4096),
    state: mission.state,
    funding: normalizeFunding(mission.funding ?? mission.publicDocument?.funding ?? []),
    roles: normalizeStrings(mission.roles ?? mission.publicDocument?.required_roles ?? [], 16, 128, 'roles'),
    applicationClosesAt: nullableTimestamp(mission.applicationClosesAt ?? mission.publicDocument?.application_deadline),
    launchDeadline: nullableTimestamp(mission.launchDeadline ?? mission.publicDocument?.launch_deadline),
    source: sourceView(mission.source ?? { label: 'helixa_ledger', status: 'current' }),
  });
}

export function missionWorkspaceView(workspace = {}) {
  assertPublicSafe(workspace);
  return Object.freeze({
    missionId: identifier(workspace.missionId, 'missionId'),
    chat: normalizeSection(workspace.chat, 'xmtp'),
    tasks: normalizeSection(workspace.tasks, 'id_agents'),
    agents: normalizeSection(workspace.agents, 'id_agents'),
    artifacts: normalizeSection(workspace.artifacts, 'id_agents'),
    milestones: normalizeSection(workspace.milestones, 'helixa_ledger'),
    funding: normalizeSection(workspace.funding, 'onchain'),
    blockers: normalizeSection(workspace.blockers, 'helixa_ledger'),
  });
}

export function settlementView(value = {}) {
  assertPublicSafe(value);
  const allocations = normalizeAllocations(value.allocations ?? []);
  return Object.freeze({
    milestoneId: identifier(value.milestoneId, 'milestoneId'),
    artifactCommitment: hash(value.artifactCommitment, 'artifactCommitment'),
    payoutCommitment: hash(value.payoutCommitment, 'payoutCommitment'),
    approvals: Object.freeze({ owner: Boolean(value.approvals?.owner), lead: Boolean(value.approvals?.lead) }),
    allocations,
    transactionSimulation: value.transactionSimulation ?? null,
    finality: closed(value.finality, ['unsubmitted', 'pending', 'confirmed', 'finalized', 'reorged'], 'finality'),
    disputeStatus: closed(value.disputeStatus, ['none', 'open', 'resolved', 'timed_out', 'refunded'], 'disputeStatus'),
    receipt: value.receipt ?? null,
    source: sourceView(value.source ?? { label: 'onchain', status: 'current' }),
  });
}

export function validateMissionAllocationTotals({ allocations, requiredByToken } = {}) {
  const normalized = normalizeAllocations(allocations);
  if (!requiredByToken || typeof requiredByToken !== 'object' || Array.isArray(requiredByToken)) throw new TypeError('requiredByToken is invalid.');
  const totals = new Map();
  for (const allocation of normalized) totals.set(allocation.token, (totals.get(allocation.token) ?? 0n) + BigInt(allocation.amountRaw));
  for (const [token, required] of Object.entries(requiredByToken)) {
    const amount = decimal(required, 'required amount');
    if ((totals.get(token.toLowerCase()) ?? 0n) !== BigInt(amount)) throw new TypeError('Mission allocation totals do not match immutable requirements.');
  }
  if (totals.size !== Object.keys(requiredByToken).length) throw new TypeError('Mission allocation contains an unsupported token.');
  return normalized;
}

export function sourceView(source = {}) {
  const label = closed(source.label, [...SOURCE_SET], 'source label');
  const status = closed(source.status, ['current', 'stale', 'degraded', 'unavailable'], 'source status');
  return Object.freeze({ label, displayLabel: MISSION_SOURCE_LABELS[label], status });
}

function normalizeSection(section, fallbackSource) {
  const value = section ?? { items: [], source: { label: fallbackSource, status: 'unavailable' } };
  const items = Array.isArray(value) ? value : value.items;
  if (!Array.isArray(items) || items.length > 1000) throw new TypeError('Workspace section is invalid.');
  return Object.freeze({ items: Object.freeze(structuredClone(items)), source: sourceView(value.source ?? { label: fallbackSource, status: 'current' }) });
}
function normalizeFunding(values) {
  if (!Array.isArray(values) || values.length > 2) throw new TypeError('Mission funding is invalid.');
  return Object.freeze(values.map((item) => Object.freeze({ token: address(item.token), symbol: bounded(item.symbol, 'symbol', 1, 16), requiredRaw: decimal(item.requiredRaw, 'requiredRaw'), fundedRaw: decimal(item.fundedRaw, 'fundedRaw'), finalized: Boolean(item.finalized) })));
}
function normalizeAllocations(values) {
  if (!Array.isArray(values) || values.length === 0 || values.length > 16) throw new TypeError('Mission allocations are invalid.');
  return Object.freeze(values.map((item) => Object.freeze({ token: address(item.token), recipient: address(item.recipient), amountRaw: decimal(item.amountRaw, 'amountRaw'), symbol: bounded(item.symbol, 'symbol', 1, 16) })));
}
function assertPublicSafe(value, depth = 0) { if (depth > 16) throw new TypeError('Mission projection is too deep.'); if (Array.isArray(value)) { for (const item of value) assertPublicSafe(item, depth + 1); return; } if (!value || typeof value !== 'object') return; if (Object.getPrototypeOf(value) !== Object.prototype) throw new TypeError('Mission projection is invalid.'); for (const [key, nested] of Object.entries(value)) { if (INTERNAL_KEY.test(key)) throw new TypeError('Mission projection contains internal fields.'); assertPublicSafe(nested, depth + 1); } }
function normalizeStrings(values, maxItems, maxLength, label) { if (!Array.isArray(values) || values.length > maxItems) throw new TypeError(label + ' is invalid.'); const result = values.map((value) => bounded(value, label, 1, maxLength)); if (new Set(result).size !== result.length) throw new TypeError(label + ' contains duplicates.'); return Object.freeze(result); }
function address(value) { if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{40}$/u.test(value)) throw new TypeError('Address is invalid.'); return value.toLowerCase(); }
function hash(value, label) { if (typeof value !== 'string' || !/^[0-9a-f]{64}$/u.test(value)) throw new TypeError(label + ' is invalid.'); return value; }
function decimal(value, label) { if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/u.test(value)) throw new TypeError(label + ' must be a canonical decimal string.'); return value; }
function identifier(value, label) { if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(value)) throw new TypeError(label + ' is invalid.'); return value; }
function bounded(value, label, min, max) { if (typeof value !== 'string' || value.length < min || value.length > max) throw new TypeError(label + ' is invalid.'); return value; }
function closed(value, allowed, label) { if (typeof value !== 'string' || !allowed.includes(value)) throw new TypeError(label + ' is invalid.'); return value; }
function nullableTimestamp(value) { if (value === null || value === undefined) return null; if (!Number.isSafeInteger(value) || value < 0) throw new TypeError('Timestamp is invalid.'); return value; }
