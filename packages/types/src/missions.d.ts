export type MissionState = 'draft' | 'recruiting' | 'team_selected' | 'funding' | 'funded' | 'launching' | 'active' | 'review' | 'settled' | 'cancelled' | 'refunded';
export type LaunchState = 'not_started' | 'reserved' | 'provisioning' | 'runtime_ready' | 'room_ready' | 'tasks_ready' | 'committed' | 'failed_retryable' | 'expired_refundable';
export type VaultState = 'awaiting_funding' | 'funded' | 'active' | 'settled' | 'refunded';
export type MilestoneState = 'pending' | 'submitted' | 'releasable' | 'released' | 'disputed' | 'resolved' | 'timeout_settled' | 'refunded';
export type MissionTaskState = 'todo' | 'doing' | 'blocked' | 'review' | 'done' | 'cancelled';
export type MissionSourceLabel = 'onchain' | 'helixa_ledger' | 'id_agents' | 'xmtp';
export type MissionLimitName = 'assets' | 'recipients' | 'milestones' | 'payoutsPerAssetPerMilestone';

export const missionStates: readonly MissionState[];
export const launchStates: readonly LaunchState[];
export const vaultStates: readonly VaultState[];
export const milestoneStates: readonly MilestoneState[];
export const taskStates: readonly MissionTaskState[];
export const missionSourceLabels: readonly MissionSourceLabel[];
export const missionLimits: Readonly<Record<MissionLimitName, number>>;

export function canTransitionMission(from: MissionState, to: MissionState): boolean;
export function canTransitionLaunch(from: LaunchState, to: LaunchState): boolean;
export function canTransitionMilestone(from: MilestoneState, to: MilestoneState): boolean;
export function assertMissionBound(name: MissionLimitName, count: number): number;
