export const SWARM_LAUNCH_SCHEMA = 'multipass.swarm-launch.v1';
export const SWARM_LAUNCH_CHAIN_ID = 8453;
export const SWARM_LAUNCH_LOOPERS_COLLECTION = '0x1649CD37f4748807b4882FC48765bA0B2aFfa94a';
export const SWARM_LAUNCH_LIMITS = Object.freeze({ minimumMembers: 3, maximumMembers: 5, minimumAverageCred: 65, totalContributionBps: 10_000 });
export const SWARM_LAUNCH_OPTIONS = Object.freeze({
  supplies: Object.freeze(['100000000', '1000000000', '10000000000']),
  curves: Object.freeze(['bonding_curve_to_dex', 'fixed_price_to_curve']),
  templates: Object.freeze(['web_app', 'agent_service', 'protocol', 'other']),
  revenueModels: Object.freeze(['subscription', 'usage', 'protocol_fees', 'marketplace', 'other']),
  shipTargets: Object.freeze(['14_days', '30_days', '60_days', '90_days']),
});
const CRED_TIERS = new Set(['JUNK', 'MARGINAL', 'QUALIFIED', 'PRIME', 'PREFERRED']);
const SUPPLIES = new Set(SWARM_LAUNCH_OPTIONS.supplies);
const CURVES = new Set(SWARM_LAUNCH_OPTIONS.curves);
const TEMPLATES = new Set(SWARM_LAUNCH_OPTIONS.templates);
const REVENUE_MODELS = new Set(SWARM_LAUNCH_OPTIONS.revenueModels);
const SHIP_TARGETS = new Set(SWARM_LAUNCH_OPTIONS.shipTargets);

export function evaluateSwarmLaunchGate(input = {}) {
  const members = Array.isArray(input.members) ? input.members : [];
  const blockers = [];
  if (members.length < SWARM_LAUNCH_LIMITS.minimumMembers) blockers.push('Select at least three Loopers.');
  if (members.length > SWARM_LAUNCH_LIMITS.maximumMembers) blockers.push('A launch swarm may contain at most five Loopers.');
  const keys = members.map((member) => String(member?.tokenId ?? '').trim()).filter(Boolean);
  if (new Set(keys).size !== keys.length) blockers.push('The swarm contains a duplicate Looper identity.');
  const scores = [];
  let invalidCred = false;
  let staleCred = false;
  let invalidContribution = false;
  let totalContributionBps = 0;
  for (const member of members) {
    const cred = member?.cred;
    if (!cred || cred.status !== 'available' || !Number.isInteger(cred.score) || cred.score < 0 || cred.score > 100 || !CRED_TIERS.has(cred.tier)) invalidCred = true;
    else if (cred.freshness?.stale !== false) staleCred = true;
    else scores.push(cred.score);
    if (!Number.isInteger(member?.contributionBps) || member.contributionBps < 1 || member.contributionBps > SWARM_LAUNCH_LIMITS.totalContributionBps) invalidContribution = true;
    else totalContributionBps += member.contributionBps;
  }
  if (invalidCred) blockers.push('Every member requires an authoritative CRED score.');
  if (staleCred) blockers.push('Every member requires a fresh CRED observation.');
  const averageCred = scores.length === members.length && scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null;
  if (averageCred !== null && averageCred < SWARM_LAUNCH_LIMITS.minimumAverageCred) blockers.push('Swarm average CRED must be at least 65.');
  if (invalidContribution || totalContributionBps !== SWARM_LAUNCH_LIMITS.totalContributionBps) blockers.push('Contribution weights must be positive integers totaling exactly 10,000 bps.');
  return Object.freeze({ eligible: blockers.length === 0, averageCred, totalContributionBps, blockers: Object.freeze(blockers) });
}

export function normalizeSwarmLaunchDraft(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Swarm launch draft is invalid.');
  const members = normalizeMembers(input.members);
  const gate = evaluateSwarmLaunchGate({ members });
  if (!gate.eligible) throw new TypeError(gate.blockers[0]);
  return Object.freeze({ members, app: normalizeApp(input.app), token: normalizeToken(input.token), gate });
}

export function normalizeSwarmLaunchForm(formData, verifiedMembers = []) {
  if (!formData || typeof formData.get !== 'function') throw new TypeError('Launch form is invalid.');
  const get = (key) => String(formData.get(key) ?? '').trim();
  return normalizeSwarmLaunchDraft({
    members: verifiedMembers.map((member) => ({ ...member, role: get('member_' + member.tokenId + '_role'), contributionBps: Number(get('member_' + member.tokenId + '_bps')) })),
    app: { name: get('app_name'), pitch: get('app_pitch'), template: get('app_template'), revenueModel: get('revenue_model'), shipTarget: get('ship_target') },
    token: { name: get('token_name'), ticker: get('token_ticker').toUpperCase(), supply: get('token_supply'), curve: get('token_curve') },
  });
}

export function buildSwarmLaunchManifest(input = {}) {
  const draft = input?.gate?.eligible === true ? input : normalizeSwarmLaunchDraft(input);
  return deepFreeze({
    schema: SWARM_LAUNCH_SCHEMA,
    chainId: SWARM_LAUNCH_CHAIN_ID,
    identity: { type: 'looper_erc721', chainId: SWARM_LAUNCH_CHAIN_ID, registry: SWARM_LAUNCH_LOOPERS_COLLECTION },
    execution: { mode: 'PREPARATION_ONLY', deploymentAuthorized: false, requiresSeparateApproval: true },
    gate: { minimumMembers: SWARM_LAUNCH_LIMITS.minimumMembers, maximumMembers: SWARM_LAUNCH_LIMITS.maximumMembers, minimumAverageCred: SWARM_LAUNCH_LIMITS.minimumAverageCred, observedAverageCred: draft.gate.averageCred, methodologyVersions: [...new Set(draft.members.map((member) => member.cred.methodologyVersion))].sort() },
    app: { ...draft.app }, token: { ...draft.token },
    settlement: {
      provider: 'mosh',
      scope: 'AGENT_BUNDLE_LIQUIDITY',
      topology: 'OPERATOR_VAULT_SEPARATED',
      creatorFees: {
        bundleClaimsBps: 8000,
        moshPlatformBps: 2000,
        looperContributionMapping: 'UNSPECIFIED',
        teamShareBps: null,
      },
      integrationStatus: 'PENDING_VERIFIED_ADAPTER',
    },
    members: draft.members.map((member) => ({ identity: { type: 'looper_erc721', chainId: SWARM_LAUNCH_CHAIN_ID, registry: SWARM_LAUNCH_LOOPERS_COLLECTION, tokenId: member.tokenId, erc8004Id: member.erc8004Id }, name: member.name, role: member.role, contributionBps: member.contributionBps, cred: { ...member.cred }, vault: { status: 'UNPREPARED', kind: 'UNSPECIFIED', address: null } })),
  });
}

export function canonicalSwarmLaunchJson(value) {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') { if (!Number.isSafeInteger(value)) throw new TypeError('Manifest numbers must be safe integers.'); return String(value); }
  if (Array.isArray(value)) return '[' + value.map(canonicalSwarmLaunchJson).join(',') + ']';
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) throw new TypeError('Manifest contains unsupported data.');
  return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + canonicalSwarmLaunchJson(value[key])).join(',') + '}';
}

function normalizeMembers(values) {
  if (!Array.isArray(values)) throw new TypeError('Swarm members are invalid.');
  const members = values.map((member) => deepFreeze({ tokenId: canonicalUint(member?.tokenId, 'Looper token ID'), name: bounded(member?.name, 1, 128, 'member name'), role: bounded(member?.role, 1, 96, 'member role'), contributionBps: integer(member?.contributionBps, 1, SWARM_LAUNCH_LIMITS.totalContributionBps, 'contribution'), cred: normalizeCred(member?.cred), erc8004Id: normalizeErc8004Id(member?.erc8004Id) }));
  if (new Set(members.map((member) => member.tokenId)).size !== members.length) throw new TypeError('Swarm contains a duplicate Looper identity.');
  return Object.freeze(members);
}
function normalizeCred(cred) {
  if (!cred || cred.status !== 'available') throw new TypeError('Authoritative CRED is required.');
  const score = integer(cred.score, 0, 100, 'CRED score');
  if (!CRED_TIERS.has(cred.tier)) throw new TypeError('CRED tier is invalid.');
  if (cred.freshness?.stale !== false) throw new TypeError('Fresh CRED is required.');
  return deepFreeze({ status: 'available', score, tier: cred.tier, coverage: { score: integer(cred.coverage?.score, 0, 100, 'CRED coverage'), label: bounded(cred.coverage?.label, 1, 32, 'CRED coverage label') }, freshness: { stale: false }, methodologyVersion: bounded(cred.methodologyVersion, 1, 96, 'CRED methodology'), computedAt: timestamp(cred.computedAt, 'CRED computedAt') });
}
function normalizeApp(app = {}) { return deepFreeze({ name: bounded(app.name, 1, 64, 'app name'), pitch: bounded(app.pitch, 1, 1024, 'app pitch'), template: closed(app.template, TEMPLATES, 'app template'), revenueModel: closed(app.revenueModel, REVENUE_MODELS, 'revenue model'), shipTarget: closed(app.shipTarget, SHIP_TARGETS, 'ship target') }); }
function normalizeToken(token = {}) { const ticker = bounded(token.ticker, 2, 10, 'token ticker'); if (!/^[A-Z][A-Z0-9]{1,9}$/u.test(ticker)) throw new TypeError('Token ticker is invalid.'); return deepFreeze({ name: bounded(token.name, 1, 32, 'token name'), ticker, supply: closed(String(token.supply ?? ''), SUPPLIES, 'token supply'), supplyUnit: 'WHOLE_TOKENS', decimals: null, curve: closed(token.curve, CURVES, 'launch curve') }); }
function normalizeErc8004Id(value) { if (value === null || value === undefined || value === '') return null; const text = String(value); if (!/^\d+:\d+$/u.test(text)) throw new TypeError('ERC-8004 identity is invalid.'); return text; }
function canonicalUint(value, name) { const text = String(value ?? ''); if (!/^(0|[1-9][0-9]*)$/u.test(text)) throw new TypeError(name + ' is invalid.'); return text; }
function integer(value, min, max, name) { if (!Number.isSafeInteger(value) || value < min || value > max) throw new TypeError(name + ' is invalid.'); return value; }
function bounded(value, min, max, name) { if (typeof value !== 'string' || value.length < min || value.length > max) throw new TypeError(name + ' is invalid.'); return value; }
function closed(value, allowed, name) { if (typeof value !== 'string' || !allowed.has(value)) throw new TypeError(name + ' is invalid.'); return value; }
function timestamp(value, name) { if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new TypeError(name + ' is invalid.'); return value; }
function deepFreeze(value) { if (Array.isArray(value)) { value.forEach(deepFreeze); return Object.freeze(value); } if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); return Object.freeze(value); } return value; }
