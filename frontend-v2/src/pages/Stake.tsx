import { useState, useEffect, useCallback } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { ethers } from 'ethers';

// ─── Constants ────────────────────────────────────────────────────
const STAKING_ADDRESS = '0xd40ECD47201D8ea25181dc05a638e34469399613';
const CRED_TOKEN = '0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3';
const HELIXA_V2 = '0x2e3B541C59D38b84E3Bc54e977200230A204Fe60';
const API_URL = import.meta.env.VITE_API_URL || 'https://api.helixa.xyz';
const BASE_RPC = 'https://base.drpc.org';

// Must match contract: JUNK ≤25, MARGINAL ≤50, QUALIFIED ≤75, PRIME ≤90, PREFERRED 91+
const TIER_NAMES = ['Junk', 'Marginal', 'Qualified', 'Prime', 'Preferred'] as const;
const TIER_COLORS = ['#ef4444', '#f59e0b', '#eab308', '#22c55e', '#6eecd8'] as const;
const TIER_MIN_CRED = [0, 26, 51, 76, 91];
const TIER_MAX_STAKE = ['0', '1,000', '10,000', '100,000', '∞'];

// Minimal ABIs
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
];

const STAKING_ABI = [
  'function stake(uint256 agentId, uint256 amount)',
  'function unstake(uint256 agentId, uint256 amount)',
  'function claimRewards(uint256 agentId)',
  'function vouch(uint256 agentId, uint256 voucherAgentId, uint256 amount)',
  'function stakes(uint256) view returns (address staker, uint256 amount, uint256 stakedAt, uint8 credAtStake)',
  'function effectiveStake(uint256) view returns (uint256)',
  'function pendingRewards(uint256) view returns (uint256)',
  'function totalStaked() view returns (uint256)',
  'function totalEffectiveStake() view returns (uint256)',
  'function getVouchCount(uint256) view returns (uint256)',
  'function LOCK_PERIOD() view returns (uint256)',
  'function EARLY_UNSTAKE_PENALTY_BPS() view returns (uint256)',
  'function stakeThresholds(uint256) view returns (uint256)',
];

const HELIXA_ABI = [
  'function getCredScore(uint256) view returns (uint8)',
];

const readProvider = new ethers.JsonRpcProvider(BASE_RPC);
const stakingRead = new ethers.Contract(STAKING_ADDRESS, STAKING_ABI, readProvider);
const tokenRead = new ethers.Contract(CRED_TOKEN, ERC20_ABI, readProvider);
const helixaRead = new ethers.Contract(HELIXA_V2, HELIXA_ABI, readProvider);

// ─── Types ────────────────────────────────────────────────────────
interface AgentStakeInfo {
  tokenId: number;
  name: string;
  credScore: number;
  staked: bigint;
  stakedAt: number;
  effectiveStake: bigint;
  pendingRewards: bigint;
  vouchCount: number;
}

interface GlobalStats {
  totalStaked: bigint;
  totalEffective: bigint;
  lockPeriod: number;
  penaltyBps: number;
}

// ─── Helpers ──────────────────────────────────────────────────────
function fmt(val: bigint, dp = 2): string {
  const s = ethers.formatEther(val);
  const n = parseFloat(s);
  if (n === 0) return '0';
  if (n < 0.01) return '<0.01';
  return n.toLocaleString(undefined, { maximumFractionDigits: dp });
}

function tierIdx(cred: number): number {
  if (cred >= 91) return 4;
  if (cred >= 76) return 3;
  if (cred >= 51) return 2;
  if (cred >= 26) return 1;
  return 0;
}

function tierName(cred: number): string { return TIER_NAMES[tierIdx(cred)]; }
function tierColor(cred: number): string { return TIER_COLORS[tierIdx(cred)]; }

// ─── Component ────────────────────────────────────────────────────
export function Stake() {
  const { login, authenticated, ready } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets?.[0];
  const address = wallet?.address;

  const [loading, setLoading] = useState(true);
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [agents, setAgents] = useState<AgentStakeInfo[]>([]);
  const [credBalance, setCredBalance] = useState<bigint>(0n);
  const [allowance, setAllowance] = useState<bigint>(0n);
  const [selectedAgent, setSelectedAgent] = useState<number | null>(null);
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [vouchAgentId, setVouchAgentId] = useState('');
  const [vouchAmount, setVouchAmount] = useState('');
  const [txPending, setTxPending] = useState('');
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'stake' | 'unstake' | 'vouch' | 'rewards'>('stake');

  // ─── Load global stats ──────────────────────────────────────────
  const loadGlobal = useCallback(async () => {
    try {
      const [totalStaked, totalEffective, lockPeriod, penaltyBps] = await Promise.all([
        stakingRead.totalStaked(),
        stakingRead.totalEffectiveStake(),
        stakingRead.LOCK_PERIOD(),
        stakingRead.EARLY_UNSTAKE_PENALTY_BPS(),
      ]);
      setGlobalStats({
        totalStaked, totalEffective,
        lockPeriod: Number(lockPeriod),
        penaltyBps: Number(penaltyBps),
      });
    } catch (e) {
      console.error('Failed to load global stats:', e);
    }
  }, []);

  // ─── Load user's agents ─────────────────────────────────────────
  const loadUserAgents = useCallback(async () => {
    if (!address) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v2/agents?owner=${address}`);
      const data = await res.json();
      const agentList = data.agents || [];

      const [bal, allow] = await Promise.all([
        tokenRead.balanceOf(address),
        tokenRead.allowance(address, STAKING_ADDRESS),
      ]);
      setCredBalance(bal);
      setAllowance(allow);

      const infos: AgentStakeInfo[] = await Promise.all(
        agentList.map(async (a: any) => {
          const tokenId = a.tokenId || a.id;
          try {
            const [stakeData, eff, pending, vc, cred] = await Promise.all([
              stakingRead.stakes(tokenId),
              stakingRead.effectiveStake(tokenId),
              stakingRead.pendingRewards(tokenId),
              stakingRead.getVouchCount(tokenId),
              helixaRead.getCredScore(tokenId).catch(() => 0),
            ]);
            return {
              tokenId: Number(tokenId),
              name: a.name || `Agent #${tokenId}`,
              credScore: Number(cred),
              staked: stakeData.amount || 0n,
              stakedAt: Number(stakeData.stakedAt || 0),
              effectiveStake: eff,
              pendingRewards: pending,
              vouchCount: Number(vc),
            };
          } catch {
            return {
              tokenId: Number(tokenId), name: a.name || `Agent #${tokenId}`,
              credScore: a.credScore || 0, staked: 0n, stakedAt: 0,
              effectiveStake: 0n, pendingRewards: 0n, vouchCount: 0,
            };
          }
        })
      );

      setAgents(infos);
      if (infos.length > 0 && selectedAgent === null) setSelectedAgent(infos[0].tokenId);
    } catch (e) {
      console.error('Failed to load agents:', e);
    }
    setLoading(false);
  }, [address, selectedAgent]);

  useEffect(() => { loadGlobal(); }, [loadGlobal]);
  useEffect(() => { if (ready) loadUserAgents(); }, [ready, address, loadUserAgents]);

  const selected = agents.find(a => a.tokenId === selectedAgent);

  // ─── Get signer from Privy wallet ──────────────────────────────
  async function getSigner() {
    if (!wallet) throw new Error('No wallet');
    const eip1193 = await wallet.getEthereumProvider();
    const provider = new ethers.BrowserProvider(eip1193);
    return provider.getSigner();
  }

  // ─── Transaction helpers ────────────────────────────────────────
  async function sendTx(fn: string, args: any[]) {
    setError('');
    setTxHash('');
    setTxPending(fn);
    try {
      const signer = await getSigner();
      const contract = new ethers.Contract(STAKING_ADDRESS, STAKING_ABI, signer);
      const tx = await contract[fn](...args);
      setTxHash(tx.hash);
      await tx.wait();
      await Promise.all([loadGlobal(), loadUserAgents()]);
      setStakeAmount(''); setUnstakeAmount(''); setVouchAmount(''); setVouchAgentId('');
    } catch (e: any) {
      setError(e.reason || e.shortMessage || e.message || 'Transaction failed');
    }
    setTxPending('');
  }

  async function handleApprove() {
    setError('');
    setTxPending('approve');
    try {
      const signer = await getSigner();
      const token = new ethers.Contract(CRED_TOKEN, ERC20_ABI, signer);
      const tx = await token.approve(STAKING_ADDRESS, ethers.MaxUint256);
      setTxHash(tx.hash);
      await tx.wait();
      setAllowance(ethers.MaxUint256);
    } catch (e: any) {
      setError(e.reason || e.shortMessage || e.message || 'Approval failed');
      setTxPending('');
      throw e;
    }
    setTxPending('');
  }

  async function handleStake() {
    if (!selectedAgent || !stakeAmount) return;
    const amt = ethers.parseEther(stakeAmount);
    if (allowance < amt) await handleApprove();
    await sendTx('stake', [selectedAgent, amt]);
  }

  async function handleUnstake() {
    if (!selectedAgent || !unstakeAmount) return;
    await sendTx('unstake', [selectedAgent, ethers.parseEther(unstakeAmount)]);
  }

  async function handleClaim() {
    if (!selectedAgent) return;
    await sendTx('claimRewards', [selectedAgent]);
  }

  async function handleVouch() {
    if (!selectedAgent || !vouchAgentId || !vouchAmount) return;
    const amt = ethers.parseEther(vouchAmount);
    if (allowance < amt) await handleApprove();
    await sendTx('vouch', [parseInt(vouchAgentId), selectedAgent, amt]);
  }

  // ─── Render ─────────────────────────────────────────────────────
  const lockDays = globalStats ? Math.round(globalStats.lockPeriod / 86400) : 7;
  const penaltyPct = globalStats ? (globalStats.penaltyBps / 100) : 10;

  return (
    <div className="py-12">
      <div className="container max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-heading font-bold mb-3">
            <span className="text-gradient">Stake $CRED</span>
          </h1>
          <p className="text-muted text-lg max-w-2xl mx-auto">
            Stake on agents you believe in. Higher cred = bigger boost. Earn rewards from protocol revenue.
          </p>
        </div>

        {/* Global Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Staked" value={globalStats ? `${fmt(globalStats.totalStaked)} $CRED` : '—'} />
          <StatCard label="Effective Stake" value={globalStats ? `${fmt(globalStats.totalEffective)} $CRED` : '—'} />
          <StatCard label="Lock Period" value={`${lockDays} days`} />
          <StatCard label="Early Exit Fee" value={`${penaltyPct}%`} />
        </div>

        {/* Tier Explainer */}
        <div className="card p-6 mb-8">
          <h3 className="text-lg font-heading font-semibold mb-4">Cred Tiers & Boost Multipliers</h3>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2" style={{ scrollSnapType: 'x mandatory' }}>
            {TIER_NAMES.map((name, i) => (
              <div key={name} className="text-center p-3 rounded-lg flex-shrink-0" style={{ background: `${TIER_COLORS[i]}15`, border: `1px solid ${TIER_COLORS[i]}30`, minWidth: '5.5rem', scrollSnapAlign: 'start' }}>
                <div className="text-xs text-muted mb-1">{TIER_MIN_CRED[i]}+ Cred</div>
                <div className="font-bold text-sm" style={{ color: TIER_COLORS[i] }}>{name}</div>
                <div className="text-xs text-muted mt-1">Max {TIER_MAX_STAKE[i]}</div>
              </div>
            ))}
          </div>
        </div>

        {!authenticated ? (
          <div className="card p-12 text-center">
            <div className="text-5xl mb-4">🔒</div>
            <h2 className="text-xl font-heading font-semibold mb-3">Connect to Stake</h2>
            <p className="text-muted mb-6">Connect your wallet to stake $CRED on your agents.</p>
            <button onClick={login} className="btn btn-primary text-lg px-8 py-3">Connect Wallet</button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="spinner" style={{ width: 40, height: 40 }} />
          </div>
        ) : agents.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="text-5xl mb-4">🤖</div>
            <h2 className="text-xl font-heading font-semibold mb-3">No Agents Found</h2>
            <p className="text-muted mb-6">You need a Helixa agent to stake. Mint one first!</p>
            <a href="/mint" className="btn btn-primary">Mint Agent</a>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {/* Left: Agent Selector */}
            <div className="md:col-span-1">
              <div className="card p-4">
                <h3 className="text-sm font-semibold text-muted mb-3 uppercase tracking-wider">Your Agents</h3>
                <div className="space-y-2">
                  {agents.map(a => (
                    <button
                      key={a.tokenId}
                      onClick={() => setSelectedAgent(a.tokenId)}
                      className={`w-full text-left p-3 rounded-lg transition-all ${
                        selectedAgent === a.tokenId
                          ? 'bg-mint/10 border border-mint/30'
                          : 'hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-sm">{a.name}</div>
                          <div className="text-xs text-muted">#{a.tokenId}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-mono" style={{ color: tierColor(a.credScore) }}>{a.credScore} Cred</div>
                          {a.staked > 0n && <div className="text-xs text-muted">{fmt(a.staked)} staked</div>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">$CRED Balance</span>
                    <span className="font-mono">{fmt(credBalance)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="md:col-span-2">
              {selected && (
                <>
                  {/* Agent Info Card */}
                  <div className="card p-5 mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h2 className="text-xl font-heading font-bold">{selected.name}</h2>
                        <span className="text-sm px-2 py-0.5 rounded-full font-semibold" style={{
                          color: tierColor(selected.credScore),
                          background: `${tierColor(selected.credScore)}20`,
                        }}>
                          {tierName(selected.credScore)} · {selected.credScore} Cred
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-heading font-bold">{fmt(selected.effectiveStake)}</div>
                        <div className="text-xs text-muted">Effective Stake</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <MiniStat label="Staked" value={`${fmt(selected.staked)} $CRED`} />
                      <MiniStat label="Pending Rewards" value={`${fmt(selected.pendingRewards)} $CRED`} />
                      <MiniStat label="Vouches" value={String(selected.vouchCount)} />
                    </div>
                  </div>

                  {/* Action Tabs */}
                  <div className="card">
                    <div className="flex border-b border-white/10">
                      {(['stake', 'unstake', 'vouch', 'rewards'] as const).map(t => (
                        <button
                          key={t}
                          onClick={() => { setTab(t); setError(''); setTxHash(''); }}
                          className={`flex-1 py-3 text-sm font-semibold uppercase tracking-wider transition-all ${
                            tab === t ? 'text-mint border-b-2 border-mint' : 'text-muted hover:text-white'
                          }`}
                        >
                          {t === 'rewards' ? 'Claim' : t}
                        </button>
                      ))}
                    </div>

                    <div className="p-5">
                      {tab === 'stake' && (
                        <div>
                          <label className="block text-sm text-muted mb-2">Amount to stake</label>
                          <div className="flex gap-2 mb-3">
                            <input type="number" placeholder="0.00" value={stakeAmount}
                              onChange={e => setStakeAmount(e.target.value)} className="input flex-1" />
                            <button onClick={() => setStakeAmount(ethers.formatEther(credBalance))}
                              className="btn btn-secondary text-xs px-3">MAX</button>
                          </div>
                          <p className="text-xs text-muted mb-4">
                            {lockDays}-day lock period. {penaltyPct}% penalty for early unstake.
                            {selected.credScore >= 60 && ' Your high cred gives you a boost multiplier! 🚀'}
                          </p>
                          <button onClick={handleStake}
                            disabled={!!txPending || !stakeAmount || parseFloat(stakeAmount) <= 0}
                            className="btn btn-primary w-full">
                            {txPending === 'approve' ? 'Approving...' : txPending === 'stake' ? 'Staking...' : 'Stake $CRED'}
                          </button>
                        </div>
                      )}

                      {tab === 'unstake' && (
                        <div>
                          <label className="block text-sm text-muted mb-2">Amount to unstake</label>
                          <div className="flex gap-2 mb-3">
                            <input type="number" placeholder="0.00" value={unstakeAmount}
                              onChange={e => setUnstakeAmount(e.target.value)} className="input flex-1" />
                            <button onClick={() => setUnstakeAmount(ethers.formatEther(selected.staked))}
                              className="btn btn-secondary text-xs px-3">MAX</button>
                          </div>
                          {selected.stakedAt > 0 && (
                            <EarlyUnstakeWarning stakedAt={selected.stakedAt} lockDays={lockDays} penaltyPct={penaltyPct} />
                          )}
                          <button onClick={handleUnstake}
                            disabled={!!txPending || !unstakeAmount || parseFloat(unstakeAmount) <= 0 || selected.staked === 0n}
                            className="btn btn-primary w-full">
                            {txPending === 'unstake' ? 'Unstaking...' : 'Unstake'}
                          </button>
                        </div>
                      )}

                      {tab === 'vouch' && (
                        <div>
                          <p className="text-sm text-muted mb-4">
                            Vouch for another agent by staking $CRED on them. Your cred score at time of vouch is recorded.
                          </p>
                          <label className="block text-sm text-muted mb-2">Agent ID to vouch for</label>
                          <input type="number" placeholder="e.g. 42" value={vouchAgentId}
                            onChange={e => setVouchAgentId(e.target.value)} className="input w-full mb-3" />
                          <label className="block text-sm text-muted mb-2">Amount</label>
                          <input type="number" placeholder="0.00" value={vouchAmount}
                            onChange={e => setVouchAmount(e.target.value)} className="input w-full mb-4" />
                          <button onClick={handleVouch}
                            disabled={!!txPending || !vouchAgentId || !vouchAmount}
                            className="btn btn-primary w-full">
                            {txPending === 'vouch' ? 'Vouching...' : 'Vouch'}
                          </button>
                        </div>
                      )}

                      {tab === 'rewards' && (
                        <div className="text-center py-4">
                          <div className="text-3xl font-heading font-bold mb-2">
                            {fmt(selected.pendingRewards)} <span className="text-lg text-muted">$CRED</span>
                          </div>
                          <p className="text-sm text-muted mb-4">Pending rewards from protocol revenue</p>
                          <button onClick={handleClaim}
                            disabled={!!txPending || selected.pendingRewards === 0n}
                            className="btn btn-primary">
                            {txPending === 'claimRewards' ? 'Claiming...' : 'Claim Rewards'}
                          </button>
                        </div>
                      )}

                      {error && (
                        <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
                      )}
                      {txHash && !error && (
                        <div className="mt-4 p-3 rounded-lg bg-mint/10 border border-mint/30 text-sm">
                          ✅ TX: <a href={`https://basescan.org/tx/${txHash}`} target="_blank" rel="noopener" className="text-mint underline">
                            {txHash.slice(0, 10)}...{txHash.slice(-8)}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────
function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4 text-center">
      <div className="text-xs text-muted uppercase tracking-wider mb-1">{label}</div>
      <div className="font-heading font-bold text-lg">{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/5 rounded-lg p-2 text-center">
      <div className="text-xs text-muted">{label}</div>
      <div className="font-mono text-sm font-semibold">{value}</div>
    </div>
  );
}

function EarlyUnstakeWarning({ stakedAt, lockDays, penaltyPct }: { stakedAt: number; lockDays: number; penaltyPct: number }) {
  const now = Math.floor(Date.now() / 1000);
  const unlockAt = stakedAt + lockDays * 86400;
  if (now >= unlockAt) return <p className="text-xs text-green-400 mb-4">✅ Lock period complete — no penalty.</p>;
  const daysLeft = Math.ceil((unlockAt - now) / 86400);
  return (
    <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm mb-4">
      ⚠️ {daysLeft} day{daysLeft !== 1 ? 's' : ''} left in lock period. Early unstake incurs {penaltyPct}% penalty.
    </div>
  );
}
