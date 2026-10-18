const freeze = (values) => Object.freeze([...values]);

export const missionStates = freeze([
  'draft',
  'recruiting',
  'team_selected',
  'funding',
  'funded',
  'launching',
  'active',
  'review',
  'settled',
  'cancelled',
  'refunded',
]);

export const launchStates = freeze([
  'not_started',
  'reserved',
  'provisioning',
  'runtime_ready',
  'room_ready',
  'tasks_ready',
  'committed',
  'failed_retryable',
  'expired_refundable',
]);

export const vaultStates = freeze([
  'awaiting_funding',
  'funded',
  'active',
  'settled',
  'refunded',
]);

export const milestoneStates = freeze([
  'pending',
  'submitted',
  'releasable',
  'released',
  'disputed',
  'resolved',
  'timeout_settled',
  'refunded',
]);

export const taskStates = freeze([
  'todo',
  'doing',
  'blocked',
  'review',
  'done',
  'cancelled',
]);

export const missionSourceLabels = freeze([
  'onchain',
  'helixa_ledger',
  'id_agents',
  'xmtp',
]);

export const missionLimits = Object.freeze({
  assets: 2,
  recipients: 8,
  milestones: 12,
  payoutsPerAssetPerMilestone: 8,
});

const missionTransitions = transitionMap({
  draft: ['recruiting', 'cancelled'],
  recruiting: ['team_selected', 'cancelled'],
  team_selected: ['funding', 'cancelled'],
  funding: ['funded', 'refunded'],
  funded: ['launching', 'refunded'],
  launching: ['active', 'refunded'],
  active: ['review', 'settled'],
  review: ['active', 'settled'],
  settled: [],
  cancelled: [],
  refunded: [],
});

const launchTransitions = transitionMap({
  not_started: ['reserved', 'expired_refundable'],
  reserved: ['provisioning', 'failed_retryable', 'expired_refundable'],
  provisioning: ['runtime_ready', 'failed_retryable', 'expired_refundable'],
  runtime_ready: ['room_ready', 'failed_retryable', 'expired_refundable'],
  room_ready: ['tasks_ready', 'failed_retryable', 'expired_refundable'],
  tasks_ready: ['committed', 'failed_retryable', 'expired_refundable'],
  committed: [],
  failed_retryable: ['provisioning', 'expired_refundable'],
  expired_refundable: [],
});

const milestoneTransitions = transitionMap({
  pending: ['submitted', 'disputed', 'timeout_settled', 'refunded'],
  submitted: ['releasable', 'disputed', 'refunded'],
  releasable: ['released', 'disputed', 'refunded'],
  released: [],
  disputed: ['resolved', 'timeout_settled', 'refunded'],
  resolved: [],
  timeout_settled: [],
  refunded: [],
});

export function canTransitionMission(from, to) {
  return canTransition('mission', missionStates, missionTransitions, from, to);
}

export function canTransitionLaunch(from, to) {
  return canTransition('launch', launchStates, launchTransitions, from, to);
}

export function canTransitionMilestone(from, to) {
  return canTransition('milestone', milestoneStates, milestoneTransitions, from, to);
}

export function assertMissionBound(name, count) {
  if (!Object.hasOwn(missionLimits, name)) throw new TypeError(`Unknown mission bound: ${String(name)}.`);
  if (!Number.isInteger(count)) throw new TypeError(`Mission ${name} count must be an integer.`);
  if (count < 1 || count > missionLimits[name]) {
    throw new RangeError(`Mission ${name} count must be between 1 and ${missionLimits[name]}.`);
  }
  return count;
}

function transitionMap(entries) {
  return Object.freeze(Object.fromEntries(
    Object.entries(entries).map(([state, next]) => [state, new Set(next)]),
  ));
}

function canTransition(kind, states, transitions, from, to) {
  if (!states.includes(from)) throw new TypeError(`Unknown ${kind} state: ${String(from)}.`);
  if (!states.includes(to)) throw new TypeError(`Unknown ${kind} state: ${String(to)}.`);
  return transitions[from].has(to);
}
