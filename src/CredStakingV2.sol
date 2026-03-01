// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface ICredOracle {
    function getCredScore(uint256 tokenId) external view returns (uint8);
}

/**
 * @title CredStakingV2 — Cred-Gated Staking with Vouching & Revenue Sharing
 * @notice Stake $CRED on agent profiles, gated by CredOracle score tiers.
 *         Supports delegation/vouching, cred-weighted effective stake,
 *         time-locked unstaking with penalties, and pro-rata revenue sharing.
 */
contract CredStakingV2 is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ─── Enums ────────────────────────────────────────────────────────
    enum Tier { JUNK, MARGINAL, QUALIFIED, PRIME, PREFERRED }

    // ─── Constants ────────────────────────────────────────────────────
    uint256 public constant LOCK_PERIOD = 7 days;
    uint256 public constant EARLY_UNSTAKE_PENALTY_BPS = 1000; // 10%
    uint256 public constant CRED_DECAY_PERIOD = 30 days;

    // ─── Immutables ──────────────────────────────────────────────────
    IERC20 public immutable credToken;
    address public immutable treasury;
    ICredOracle public immutable credOracle;

    // ─── Tier thresholds (USDC-equivalent values, 18 decimals) ───────
    // Marginal: max stakeThresholds[1], Qualified: [2], Prime: [3], Preferred: unlimited
    uint256[5] public stakeThresholds; // index by Tier enum

    // ─── Tier max boosts ─────────────────────────────────────────────
    uint8[5] public maxBoosts; // index by Tier enum

    // ─── Stake data ──────────────────────────────────────────────────
    struct StakeInfo {
        address staker;
        uint256 amount;
        uint256 stakedAt;
        uint8 credAtStake; // cred score when staked
    }

    mapping(uint256 => StakeInfo) public stakes; // agentId => stake
    uint256 public totalStaked;

    // ─── Vouch data ──────────────────────────────────────────────────
    struct Vouch {
        address voucher;
        uint256 amount;
        uint256 vouchedAt;
        uint8 voucherCredAtVouch;
        uint256 voucherAgentId; // the agent id of the voucher
    }

    // agentId => list of vouches
    mapping(uint256 => Vouch[]) internal _vouches;
    // track voucher's active vouch index: keccak(voucherAddr, agentId) => index+1 (0=none)
    mapping(bytes32 => uint256) internal _vouchIndex;

    // ─── Cred decay flags ────────────────────────────────────────────
    // agentId => timestamp when penalty expires
    mapping(uint256 => uint256) public credPenaltyUntil;

    // ─── Revenue sharing ─────────────────────────────────────────────
    // Global reward accumulator per "effective stake unit" (scaled 1e18)
    uint256 public rewardPerEffectiveStake; // accumulated rewards per unit
    uint256 public totalEffectiveStake;

    // Per-agent tracking
    mapping(uint256 => uint256) public agentRewardDebt;
    mapping(uint256 => uint256) public agentPendingRewards;

    // ─── Pause ───────────────────────────────────────────────────────
    bool public paused;

    // ─── Events ──────────────────────────────────────────────────────
    event Staked(uint256 indexed agentId, address indexed staker, uint256 amount, uint8 credScore);
    event Unstaked(uint256 indexed agentId, address indexed staker, uint256 amount, uint256 penalty);
    event Vouched(uint256 indexed agentId, address indexed voucher, uint256 amount, uint256 voucherAgentId);
    event VouchRemoved(uint256 indexed agentId, address indexed voucher, uint256 amount);
    event Slashed(uint256 indexed agentId, uint256 stakeSlashed, uint256 vouchesSlashed);
    event RewardsDeposited(uint256 amount);
    event RewardsClaimed(uint256 indexed agentId, address indexed claimer, uint256 amount);
    event ThresholdsUpdated(uint256 marginal, uint256 qualified, uint256 prime);
    event BoostsUpdated(uint8 marginal, uint8 qualified, uint8 prime, uint8 preferred);
    event Paused(bool state);

    // ─── Modifiers ───────────────────────────────────────────────────
    modifier whenNotPaused() {
        require(!paused, "paused");
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────
    constructor(
        address _credToken,
        address _treasury,
        address _credOracle
    ) Ownable(msg.sender) {
        credToken = IERC20(_credToken);
        treasury = _treasury;
        credOracle = ICredOracle(_credOracle);

        // Default thresholds (18 decimals)
        stakeThresholds[uint256(Tier.JUNK)] = 0; // can't stake
        stakeThresholds[uint256(Tier.MARGINAL)] = 100e18;
        stakeThresholds[uint256(Tier.QUALIFIED)] = 500e18;
        stakeThresholds[uint256(Tier.PRIME)] = 2000e18;
        stakeThresholds[uint256(Tier.PREFERRED)] = type(uint256).max;

        maxBoosts[uint256(Tier.JUNK)] = 0;
        maxBoosts[uint256(Tier.MARGINAL)] = 5;
        maxBoosts[uint256(Tier.QUALIFIED)] = 15;
        maxBoosts[uint256(Tier.PRIME)] = 25;
        maxBoosts[uint256(Tier.PREFERRED)] = 30;
    }

    // ─── Views ───────────────────────────────────────────────────────

    function getTier(uint8 credScore) public pure returns (Tier) {
        if (credScore <= 25) return Tier.JUNK;
        if (credScore <= 50) return Tier.MARGINAL;
        if (credScore <= 75) return Tier.QUALIFIED;
        if (credScore <= 90) return Tier.PRIME;
        return Tier.PREFERRED;
    }

    function getMaxStake(uint8 credScore) public view returns (uint256) {
        Tier t = getTier(credScore);
        return stakeThresholds[uint256(t)];
    }

    function getMaxBoost(uint8 credScore) public view returns (uint8) {
        return maxBoosts[uint256(getTier(credScore))];
    }

    /// @notice effectiveStake = amount * credScore / 50
    function effectiveStake(uint256 agentId) public view returns (uint256) {
        StakeInfo memory s = stakes[agentId];
        if (s.amount == 0) return 0;
        // Use current cred score for effective stake
        uint8 cred = credOracle.getCredScore(agentId);
        return (s.amount * uint256(cred)) / 50;
    }

    function getVouches(uint256 agentId) external view returns (Vouch[] memory) {
        return _vouches[agentId];
    }

    function getVouchCount(uint256 agentId) external view returns (uint256) {
        return _vouches[agentId].length;
    }

    function hasCredPenalty(uint256 agentId) external view returns (bool) {
        return block.timestamp < credPenaltyUntil[agentId];
    }

    function pendingRewards(uint256 agentId) public view returns (uint256) {
        uint256 eff = effectiveStake(agentId);
        uint256 accumulated = (eff * rewardPerEffectiveStake) / 1e18;
        uint256 debt = agentRewardDebt[agentId];
        return agentPendingRewards[agentId] + (accumulated > debt ? accumulated - debt : 0);
    }

    // ─── Staking ─────────────────────────────────────────────────────

    /// @notice Stake $CRED on an agent. One stake per agent.
    function stake(uint256 agentId, uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "zero amount");
        uint8 cred = credOracle.getCredScore(agentId);
        Tier tier = getTier(cred);
        require(tier != Tier.JUNK, "cred too low");

        StakeInfo storage s = stakes[agentId];
        uint256 newTotal = s.amount + amount;
        require(newTotal <= stakeThresholds[uint256(tier)], "exceeds tier limit");

        // Update rewards before changing stake
        _updateRewards(agentId);

        // If first stake, record staker
        if (s.amount == 0) {
            s.staker = msg.sender;
            s.stakedAt = block.timestamp;
            s.credAtStake = cred;
        } else {
            require(s.staker == msg.sender, "not staker");
        }

        s.amount = newTotal;
        totalStaked += amount;

        // Update effective stake tracking
        _refreshEffectiveStake(agentId);

        credToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(agentId, msg.sender, amount, cred);
    }

    /// @notice Unstake. If before LOCK_PERIOD, 10% penalty to treasury.
    function unstake(uint256 agentId, uint256 amount) external nonReentrant {
        StakeInfo storage s = stakes[agentId];
        require(s.staker == msg.sender, "not staker");
        require(amount > 0 && amount <= s.amount, "bad amount");

        _updateRewards(agentId);

        uint256 penalty = 0;
        if (block.timestamp < s.stakedAt + LOCK_PERIOD) {
            penalty = (amount * EARLY_UNSTAKE_PENALTY_BPS) / 10000;
        }

        // Cred decay: if staked < 30 days, set penalty flag
        if (block.timestamp < s.stakedAt + CRED_DECAY_PERIOD) {
            credPenaltyUntil[agentId] = block.timestamp + CRED_DECAY_PERIOD;
        }

        s.amount -= amount;
        totalStaked -= amount;

        if (s.amount == 0) {
            s.staker = address(0);
            s.stakedAt = 0;
            s.credAtStake = 0;
        }

        _refreshEffectiveStake(agentId);

        uint256 payout = amount - penalty;
        if (penalty > 0) {
            credToken.safeTransfer(treasury, penalty);
        }
        credToken.safeTransfer(msg.sender, payout);
        emit Unstaked(agentId, msg.sender, amount, penalty);
    }

    // ─── Vouching ────────────────────────────────────────────────────

    /// @notice Vouch for another agent by staking $CRED on them.
    function vouch(uint256 agentId, uint256 voucherAgentId, uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "zero amount");
        require(agentId != voucherAgentId, "cannot self-vouch");

        uint8 voucherCred = credOracle.getCredScore(voucherAgentId);
        require(getTier(voucherCred) != Tier.JUNK, "voucher cred too low");

        bytes32 key = keccak256(abi.encodePacked(msg.sender, agentId));
        require(_vouchIndex[key] == 0, "already vouching");

        credToken.safeTransferFrom(msg.sender, address(this), amount);

        _vouches[agentId].push(Vouch({
            voucher: msg.sender,
            amount: amount,
            vouchedAt: block.timestamp,
            voucherCredAtVouch: voucherCred,
            voucherAgentId: voucherAgentId
        }));
        _vouchIndex[key] = _vouches[agentId].length; // 1-indexed

        totalStaked += amount;
        emit Vouched(agentId, msg.sender, amount, voucherAgentId);
    }

    /// @notice Remove your vouch on an agent.
    function removeVouch(uint256 agentId) external nonReentrant {
        bytes32 key = keccak256(abi.encodePacked(msg.sender, agentId));
        uint256 idx1 = _vouchIndex[key];
        require(idx1 != 0, "no vouch");

        uint256 idx = idx1 - 1;
        Vouch memory v = _vouches[agentId][idx];
        require(v.voucher == msg.sender, "not voucher");

        uint256 amount = v.amount;
        uint256 lastIdx = _vouches[agentId].length - 1;

        if (idx != lastIdx) {
            _vouches[agentId][idx] = _vouches[agentId][lastIdx];
            bytes32 movedKey = keccak256(abi.encodePacked(_vouches[agentId][idx].voucher, agentId));
            _vouchIndex[movedKey] = idx1;
        }
        _vouches[agentId].pop();
        delete _vouchIndex[key];

        totalStaked -= amount;
        credToken.safeTransfer(msg.sender, amount);
        emit VouchRemoved(agentId, msg.sender, amount);
    }

    // ─── Slashing (owner only) ───────────────────────────────────────

    /// @notice Slash an agent's stake and all vouches. Sends to treasury.
    function slash(uint256 agentId) external onlyOwner {
        _updateRewards(agentId);

        uint256 slashedStake = 0;
        uint256 slashedVouches = 0;

        // Slash main stake
        StakeInfo storage s = stakes[agentId];
        if (s.amount > 0) {
            slashedStake = s.amount;
            totalStaked -= s.amount;
            s.amount = 0;
            s.staker = address(0);
            s.stakedAt = 0;
            s.credAtStake = 0;
        }

        // Slash all vouches
        Vouch[] storage vouches = _vouches[agentId];
        for (uint256 i = 0; i < vouches.length; i++) {
            slashedVouches += vouches[i].amount;
            totalStaked -= vouches[i].amount;
            bytes32 key = keccak256(abi.encodePacked(vouches[i].voucher, agentId));
            delete _vouchIndex[key];
        }
        delete _vouches[agentId];

        _refreshEffectiveStake(agentId);

        uint256 totalSlashed = slashedStake + slashedVouches;
        if (totalSlashed > 0) {
            credToken.safeTransfer(treasury, totalSlashed);
        }

        // Set cred penalty
        credPenaltyUntil[agentId] = block.timestamp + CRED_DECAY_PERIOD;

        emit Slashed(agentId, slashedStake, slashedVouches);
    }

    // ─── Revenue Sharing ─────────────────────────────────────────────

    /// @notice Owner deposits reward tokens for distribution.
    function depositRewards(uint256 amount) external onlyOwner {
        require(amount > 0, "zero");
        require(totalEffectiveStake > 0, "no stakers");

        credToken.safeTransferFrom(msg.sender, address(this), amount);
        rewardPerEffectiveStake += (amount * 1e18) / totalEffectiveStake;
        emit RewardsDeposited(amount);
    }

    /// @notice Claim pending rewards for an agent.
    function claimRewards(uint256 agentId) external nonReentrant {
        StakeInfo memory s = stakes[agentId];
        require(s.staker == msg.sender, "not staker");

        _updateRewards(agentId);

        uint256 reward = agentPendingRewards[agentId];
        require(reward > 0, "no rewards");

        agentPendingRewards[agentId] = 0;
        credToken.safeTransfer(msg.sender, reward);
        emit RewardsClaimed(agentId, msg.sender, reward);
    }

    // ─── Admin ───────────────────────────────────────────────────────

    function updateThresholds(uint256 marginal, uint256 qualified, uint256 prime) external onlyOwner {
        stakeThresholds[uint256(Tier.MARGINAL)] = marginal;
        stakeThresholds[uint256(Tier.QUALIFIED)] = qualified;
        stakeThresholds[uint256(Tier.PRIME)] = prime;
        emit ThresholdsUpdated(marginal, qualified, prime);
    }

    function updateBoosts(uint8 marginal, uint8 qualified, uint8 prime, uint8 preferred) external onlyOwner {
        maxBoosts[uint256(Tier.MARGINAL)] = marginal;
        maxBoosts[uint256(Tier.QUALIFIED)] = qualified;
        maxBoosts[uint256(Tier.PRIME)] = prime;
        maxBoosts[uint256(Tier.PREFERRED)] = preferred;
        emit BoostsUpdated(marginal, qualified, prime, preferred);
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }

    // ─── Internal ────────────────────────────────────────────────────

    function _updateRewards(uint256 agentId) internal {
        uint256 eff = effectiveStake(agentId);
        if (eff > 0) {
            uint256 accumulated = (eff * rewardPerEffectiveStake) / 1e18;
            uint256 debt = agentRewardDebt[agentId];
            if (accumulated > debt) {
                agentPendingRewards[agentId] += accumulated - debt;
            }
        }
        // Debt will be reset after effective stake refresh
        agentRewardDebt[agentId] = (effectiveStake(agentId) * rewardPerEffectiveStake) / 1e18;
    }

    function _refreshEffectiveStake(uint256 agentId) internal {
        // Recalculate total effective stake
        uint256 oldEff = _lastEffectiveStake[agentId];
        uint256 newEff = effectiveStake(agentId);
        if (newEff > oldEff) {
            totalEffectiveStake += (newEff - oldEff);
        } else {
            totalEffectiveStake -= (oldEff - newEff);
        }
        _lastEffectiveStake[agentId] = newEff;
        // Reset debt to current
        agentRewardDebt[agentId] = (newEff * rewardPerEffectiveStake) / 1e18;
    }

    // Cache last known effective stake for delta tracking
    mapping(uint256 => uint256) internal _lastEffectiveStake;
}
