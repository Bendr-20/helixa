import { useState, useEffect, useCallback } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { ethers } from 'ethers';

// ─── Constants ────────────────────────────────────────────────────
const STAKING_ADDRESS = '0xd40ECD47201D8ea25181dc05a638e34469399613';
const CRED_TOKEN = '0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3';
const API_URL = import.meta.env.VITE_API_URL || 'https://api.helixa.xyz';
const BASE_RPC = 'https://base.drpc.org';

const TIER_NAMES = ['Junk', 'Marginal', 'Qualified', 'Prime', 'Preferred'] as const;
const TIER_COLORS = ['#ef4444', '#f59e0b', '#eab308', '#22c55e', '#6eecd8'] as const;
const TIER_MIN_CRED = [0, 26, 51, 76, 91];
const TIER_MAX_STAKE_USD = ['$0', '$5', '$50', '$500', '∞'];

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
];

const readProvider = new ethers.JsonRpcProvider(BASE_RPC);
const tokenRead = new ethers.Contract(CRED_TOKEN, ERC20_ABI, readProvider);

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
function tierName(cred: number) { return TIER_NAMES[tierIdx(cred)]; }
function tierColor(cred: number) { return TIER_COLORS[tierIdx(cred)]; }

interface Agent { tokenId: number; name: string; credScore: number; framework: string; }
interface StakeInfo { staked: bigint; stakedAt: number; effectiveStake: bigint; pendingRewards: bigint; vouchCount: number; }

// ─── Component ────────────────────────────────────────────────────
export function Stake() {
  const { login, authenticated, ready } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets?.[0];
  const address = wallet?.address;

  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [stakeInfo, setStakeInfo] = useState<StakeInfo | null>(null);
  const [stakeLoading, setStakeLoading] = useState(false);

  const [credBalance, setCredBalance] = useState<bigint>(0n);
  const [allowance, setAllowance] = useState<bigint>(0n);
  const [globalTotalStaked, setGlobalTotalStaked] = useState<bigint>(0n);
  const [globalTotalEffective, setGlobalTotalEffective] = useState<bigint>(0n);
  const [lockDays, setLockDays] = useState(7);
  const [penaltyPct, setPenaltyPct] = useState(10);

  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [vouchAgentId, setVouchAgentId] = useState('');
  const [vouchAmount, setVouchAmount] = useState('');
  const [txPending, setTxPending] = useState('');
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'stake' | 'unstake' | 'vouch' | 'rewards'>('stake');

  // ─── Load agents (sorted by cred, no junk) ─────────────────────
  const loadAgents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v2/agents?sort=credScore&order=desc&limit=200`);
      const data = await res.json();
      const list = (data.agents || [])
        .filter((a: any) => (a.credScore || 0) >= 26) // exclude junk
        .map((a: any) => ({
          tokenId: a.tokenId,
          name: a.name,
          credScore: a.credScore || 0,
          framework: a.framework || '',
        }));
      setAgents(list);
    } catch {}
    setLoading(false);
  }, []);

  // ─── Load global stats (via API) ─────────────────────────────────
  const loadGlobal = useCallback(async () => {
    try {
      // Use agent 0 (or 1) just to get global stats
      const res = await fetch(`${API_URL}/api/v2/stake/1`);
      const d = await res.json();
      if (d.global) {
        setGlobalTotalStaked(ethers.parseEther(d.global.totalStaked || '0'));
        setGlobalTotalEffective(ethers.parseEther(d.global.totalEffective || '0'));
        setLockDays(d.global.lockPeriodDays || 7);
        setPenaltyPct(d.global.earlyPenaltyPct || 10);
      }
    } catch {}
  }, []);

  // ─── Load balance ───────────────────────────────────────────────
  const loadBalance = useCallback(async () => {
    if (!address) return;
    try {
      const [bal, allow] = await Promise.all([
        tokenRead.balanceOf(address),
        tokenRead.allowance(address, STAKING_ADDRESS),
      ]);
      setCredBalance(bal);
      setAllowance(allow);
    } catch {}
  }, [address]);

  // ─── Load stake info for selected agent (via API) ────────────────
  const loadStakeInfo = useCallback(async (tokenId: number) => {
    setStakeLoading(true);
    setStakeInfo(null);
    try {
      const res = await fetch(`${API_URL}/api/v2/stake/${tokenId}`);
      const d = await res.json();
      setStakeInfo({
        staked: BigInt(d.stakedRaw || '0'),
        stakedAt: d.stakedAt || 0,
        effectiveStake: BigInt(d.effectiveStakeRaw || '0'),
        pendingRewards: BigInt(d.pendingRewardsRaw || '0'),
        vouchCount: d.vouchCount || 0,
      });
      // Also update global stats from same response
      if (d.global) {
        setGlobalTotalStaked(ethers.parseEther(d.global.totalStaked || '0'));
        setGlobalTotalEffective(ethers.parseEther(d.global.totalEffective || '0'));
        setLockDays(d.global.lockPeriodDays || 7);
        setPenaltyPct(d.global.earlyPenaltyPct || 10);
      }
    } catch (e) {
      console.error('Failed to load stake info:', e);
      setStakeInfo({ staked: 0n, stakedAt: 0, effectiveStake: 0n, pendingRewards: 0n, vouchCount: 0 });
    }
    setStakeLoading(false);
  }, []);

  useEffect(() => { loadAgents(); loadGlobal(); }, [loadAgents, loadGlobal]);
  useEffect(() => { if (ready && address) loadBalance(); }, [ready, address, loadBalance]);
  useEffect(() => { if (selectedAgent) loadStakeInfo(selectedAgent.tokenId); }, [selectedAgent, loadStakeInfo]);

  // ─── Filtered agents ────────────────────────────────────────────
  const filtered = search
    ? agents.filter(a => a.name.toLowerCase().includes(search.toLowerCase()) || String(a.tokenId).includes(search))
    : agents;

  // ─── Signer ─────────────────────────────────────────────────────
  async function getSigner() {
    if (!wallet) throw new Error('No wallet');
    const eip1193 = await wallet.getEthereumProvider();
    return new ethers.BrowserProvider(eip1193).getSigner();
  }

  async function sendTx(fn: string, args: any[]) {
    setError(''); setTxHash(''); setTxPending(fn);
    try {
      const signer = await getSigner();
      const contract = new ethers.Contract(STAKING_ADDRESS, STAKING_ABI, signer);
      const tx = await contract[fn](...args);
      setTxHash(tx.hash);
      await tx.wait();
      if (selectedAgent) loadStakeInfo(selectedAgent.tokenId);
      loadBalance(); loadGlobal();
      setStakeAmount(''); setUnstakeAmount(''); setVouchAmount(''); setVouchAgentId('');
    } catch (e: any) {
      setError(e.reason || e.shortMessage || e.message || 'Transaction failed');
    }
    setTxPending('');
  }

  async function handleApprove() {
    setError(''); setTxPending('approve');
    try {
      const signer = await getSigner();
      const token = new ethers.Contract(CRED_TOKEN, ERC20_ABI, signer);
      const tx = await token.approve(STAKING_ADDRESS, ethers.MaxUint256);
      setTxHash(tx.hash);
      await tx.wait();
      setAllowance(ethers.MaxUint256);
    } catch (e: any) {
      setError(e.reason || e.shortMessage || e.message || 'Approval failed');
      setTxPending(''); throw e;
    }
    setTxPending('');
  }

  async function handleStake() {
    if (!selectedAgent || !stakeAmount) return;
    const amt = ethers.parseEther(stakeAmount);
    if (allowance < amt) await handleApprove();
    await sendTx('stake', [selectedAgent.tokenId, amt]);
  }

  async function handleUnstake() {
    if (!selectedAgent || !unstakeAmount) return;
    await sendTx('unstake', [selectedAgent.tokenId, ethers.parseEther(unstakeAmount)]);
  }

  async function handleClaim() {
    if (!selectedAgent) return;
    await sendTx('claimRewards', [selectedAgent.tokenId]);
  }

  async function handleVouch() {
    if (!selectedAgent || !vouchAgentId || !vouchAmount) return;
    const amt = ethers.parseEther(vouchAmount);
    if (allowance < amt) await handleApprove();
    await sendTx('vouch', [parseInt(vouchAgentId), selectedAgent.tokenId, amt]);
  }

  // ─── Render ─────────────────────────────────────────────────────
  return (
    <div className="py-12">
      <div className="container max-w-5xl">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-heading font-bold mb-3">
            <span className="text-gradient">Cred Markets</span>
          </h1>
          <p className="text-muted text-lg max-w-2xl mx-auto">
            Back the agents you believe in. Stake $CRED, earn rewards, build reputation.
          </p>
        </div>

        {/* Global Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Staked" value={`${fmt(globalTotalStaked)} $CRED`} />
          <StatCard label="Effective Stake" value={`${fmt(globalTotalEffective)} $CRED`} />
          <StatCard label="Lock Period" value={`${lockDays} days`} />
          <StatCard label="Early Exit Fee" value={`${penaltyPct}%`} />
        </div>

        {/* Tier Explainer */}
        <div className="card p-5 mb-6">
          <h3 className="text-sm font-heading font-semibold mb-3 uppercase tracking-wider">Cred Tiers & Max Stake</h3>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2" style={{ scrollSnapType: 'x mandatory' }}>
            {TIER_NAMES.map((name, i) => (
              <div key={name} className="text-center p-3 rounded-lg flex-shrink-0" style={{ background: `${TIER_COLORS[i]}15`, border: `1px solid ${TIER_COLORS[i]}30`, minWidth: '5.5rem', scrollSnapAlign: 'start' }}>
                <div className="text-xs text-muted mb-1">{TIER_MIN_CRED[i]}+ Cred</div>
                <div className="font-bold text-sm" style={{ color: TIER_COLORS[i] }}>{name}</div>
                <div className="text-xs text-muted mt-1">Max {TIER_MAX_STAKE_USD[i]}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Wallet bar */}
        {authenticated && address && (
          <div className="card p-4 mb-6 flex items-center justify-between">
            <div className="text-sm text-muted">
              <span className="font-mono">{address.slice(0, 6)}...{address.slice(-4)}</span>
            </div>
            <div className="text-sm font-mono font-semibold">{fmt(credBalance)} $CRED</div>
          </div>
        )}

        <div className="grid md:grid-cols-5 gap-6">
          {/* Left: Agent List */}
          <div className="md:col-span-2">
            <div className="card p-4">
              <input
                type="text" placeholder="Search agents..."
                value={search} onChange={e => setSearch(e.target.value)}
                className="input w-full mb-3 text-sm"
              />
              {loading ? (
                <div className="flex justify-center py-8"><div className="spinner" style={{ width: 24, height: 24 }} /></div>
              ) : (
                <div className="space-y-1 max-h-[28rem] overflow-y-auto pr-1">
                  {filtered.map(a => (
                    <button
                      key={a.tokenId}
                      onClick={() => { setSelectedAgent(a); setError(''); setTxHash(''); }}
                      className={`w-full text-left px-3 py-2.5 rounded-lg transition-all ${
                        selectedAgent?.tokenId === a.tokenId
                          ? 'bg-mint/10 border border-mint/30'
                          : 'hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="font-semibold text-sm truncate">{a.name}</div>
                          <div className="text-xs text-muted">#{a.tokenId} · {a.framework}</div>
                        </div>
                        <div className="flex-shrink-0 ml-2">
                          <span className="text-xs font-mono font-semibold px-1.5 py-0.5 rounded" style={{
                            color: tierColor(a.credScore),
                            background: `${tierColor(a.credScore)}15`,
                          }}>
                            {a.credScore}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                  {filtered.length === 0 && (
                    <div className="text-center text-muted py-6 text-sm">No agents found</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: Stake Panel */}
          <div className="md:col-span-3">
            {!selectedAgent ? (
              <div className="card p-12 text-center">
                <div className="text-4xl mb-3">👈</div>
                <p className="text-muted">Select an agent to stake on</p>
              </div>
            ) : (
              <>
                {/* Agent Header */}
                <div className="card p-5 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h2 className="text-xl font-heading font-bold">{selectedAgent.name}</h2>
                      <span className="text-sm px-2 py-0.5 rounded-full font-semibold" style={{
                        color: tierColor(selectedAgent.credScore),
                        background: `${tierColor(selectedAgent.credScore)}20`,
                      }}>
                        {tierName(selectedAgent.credScore)} · {selectedAgent.credScore} Cred
                      </span>
                    </div>
                    <div className="text-right">
                      {stakeLoading ? (
                        <div className="spinner" style={{ width: 20, height: 20 }} />
                      ) : stakeInfo ? (
                        <>
                          <div className="text-2xl font-heading font-bold">{fmt(stakeInfo.effectiveStake)}</div>
                          <div className="text-xs text-muted">Effective Stake</div>
                        </>
                      ) : null}
                    </div>
                  </div>
                  {stakeInfo && (
                    <div className="grid grid-cols-3 gap-3">
                      <MiniStat label="Staked" value={`${fmt(stakeInfo.staked)} $CRED`} />
                      <MiniStat label="Rewards" value={`${fmt(stakeInfo.pendingRewards)} $CRED`} />
                      <MiniStat label="Vouches" value={String(stakeInfo.vouchCount)} />
                    </div>
                  )}
                </div>

                {/* Actions */}
                {!authenticated ? (
                  <div className="card p-8 text-center">
                    <p className="text-muted mb-4">Connect wallet to stake</p>
                    <button onClick={login} className="btn btn-primary">Connect Wallet</button>
                  </div>
                ) : (
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
                          <label className="block text-sm text-muted mb-2">Amount to stake on {selectedAgent.name}</label>
                          <div className="flex gap-2 mb-3">
                            <input type="number" placeholder="0.00" value={stakeAmount}
                              onChange={e => setStakeAmount(e.target.value)} className="input flex-1" />
                            <button onClick={() => setStakeAmount(ethers.formatEther(credBalance))}
                              className="btn btn-secondary text-xs px-3">MAX</button>
                          </div>
                          <p className="text-xs text-muted mb-4">
                            {lockDays}-day lock. {penaltyPct}% early exit fee. Max stake: {TIER_MAX_STAKE_USD[tierIdx(selectedAgent.credScore)]} $CRED.
                          </p>
                          <button onClick={handleStake}
                            disabled={!!txPending || !stakeAmount || parseFloat(stakeAmount) <= 0}
                            className="btn btn-primary w-full">
                            {txPending === 'approve' ? 'Approving...' : txPending === 'stake' ? 'Staking...' : `Stake on ${selectedAgent.name}`}
                          </button>
                        </div>
                      )}

                      {tab === 'unstake' && (
                        <div>
                          <label className="block text-sm text-muted mb-2">Amount to unstake</label>
                          <div className="flex gap-2 mb-3">
                            <input type="number" placeholder="0.00" value={unstakeAmount}
                              onChange={e => setUnstakeAmount(e.target.value)} className="input flex-1" />
                            {stakeInfo && stakeInfo.staked > 0n && (
                              <button onClick={() => setUnstakeAmount(ethers.formatEther(stakeInfo.staked))}
                                className="btn btn-secondary text-xs px-3">MAX</button>
                            )}
                          </div>
                          {stakeInfo && stakeInfo.stakedAt > 0 && (
                            <EarlyUnstakeWarning stakedAt={stakeInfo.stakedAt} lockDays={lockDays} penaltyPct={penaltyPct} />
                          )}
                          <button onClick={handleUnstake}
                            disabled={!!txPending || !unstakeAmount || !stakeInfo || stakeInfo.staked === 0n}
                            className="btn btn-primary w-full">
                            {txPending === 'unstake' ? 'Unstaking...' : 'Unstake'}
                          </button>
                        </div>
                      )}

                      {tab === 'vouch' && (
                        <div>
                          <p className="text-sm text-muted mb-4">
                            Vouch for {selectedAgent.name} using one of your agents. Your cred at time of vouch is recorded.
                          </p>
                          <label className="block text-sm text-muted mb-2">Your Agent ID (voucher)</label>
                          <input type="number" placeholder="Your agent token ID" value={vouchAgentId}
                            onChange={e => setVouchAgentId(e.target.value)} className="input w-full mb-3" />
                          <label className="block text-sm text-muted mb-2">Amount</label>
                          <input type="number" placeholder="0.00" value={vouchAmount}
                            onChange={e => setVouchAmount(e.target.value)} className="input w-full mb-4" />
                          <button onClick={handleVouch}
                            disabled={!!txPending || !vouchAgentId || !vouchAmount}
                            className="btn btn-primary w-full">
                            {txPending === 'vouch' ? 'Vouching...' : `Vouch for ${selectedAgent.name}`}
                          </button>
                        </div>
                      )}

                      {tab === 'rewards' && (
                        <div className="text-center py-4">
                          <div className="text-3xl font-heading font-bold mb-2">
                            {stakeInfo ? fmt(stakeInfo.pendingRewards) : '0'} <span className="text-lg text-muted">$CRED</span>
                          </div>
                          <p className="text-sm text-muted mb-4">Pending rewards from protocol revenue</p>
                          <button onClick={handleClaim}
                            disabled={!!txPending || !stakeInfo || stakeInfo.pendingRewards === 0n}
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
                          ✅ <a href={`https://basescan.org/tx/${txHash}`} target="_blank" rel="noopener" className="text-mint underline">
                            View on Basescan
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

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
      ⚠️ {daysLeft} day{daysLeft !== 1 ? 's' : ''} left in lock. Early unstake costs {penaltyPct}%.
    </div>
  );
}
