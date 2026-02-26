// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CredStaking — Stake $CRED to Boost Agent Cred Score Tier
 * @notice Stake $CRED tokens against a Helixa agent tokenId to earn a tier boost.
 *         Tiers: NONE (0), QUALIFIED (100), PRIME (500), PREFERRED (2000).
 *         Early unstake incurs a 10% penalty to treasury. Owner can slash bad actors.
 */
contract CredStaking is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ─── Enums ──────────────────────────────────────────────────

    enum Tier { NONE, QUALIFIED, PRIME, PREFERRED }

    // ─── Constants ──────────────────────────────────────────────

    uint256 public constant LOCK_PERIOD = 7 days;
    uint256 public constant EARLY_UNSTAKE_PENALTY_BPS = 1000; // 10%
    uint256 public constant QUALIFIED_THRESHOLD = 100e18;
    uint256 public constant PRIME_THRESHOLD = 500e18;
    uint256 public constant PREFERRED_THRESHOLD = 2000e18;
    uint8 public constant QUALIFIED_BOOST = 10;
    uint8 public constant PRIME_BOOST = 20;
    uint8 public constant PREFERRED_BOOST = 30;

    // ─── Immutables ─────────────────────────────────────────────

    IERC20 public immutable credToken;
    address public immutable treasury;

    // ─── State ──────────────────────────────────────────────────

    struct StakeInfo {
        uint256 amount;
        uint256 stakedAt;
    }

    /// @notice agentId => StakeInfo
    mapping(uint256 => StakeInfo) public stakeInfo;

    /// @notice agentId => staker address
    mapping(uint256 => address) public staker;

    /// @notice Total $CRED staked across all agents
    uint256 public totalStakedAmount;

    bool public paused;

    // ─── Events ─────────────────────────────────────────────────

    event Staked(address indexed user, uint256 indexed agentId, uint256 amount, Tier newTier);
    event Unstaked(address indexed user, uint256 indexed agentId, uint256 amount, uint256 penalty);
    event Slashed(uint256 indexed agentId, uint256 amount, address indexed slashedStaker);
    event TierChanged(uint256 indexed agentId, Tier oldTier, Tier newTier);
    event Paused(bool state);

    // ─── Errors ─────────────────────────────────────────────────

    error ZeroAmount();
    error ContractPaused();
    error InsufficientStake();
    error NotStaker();
    error AgentAlreadyStakedByOther();
    error NothingToSlash();

    // ─── Constructor ────────────────────────────────────────────

    constructor(address _credToken, address _treasury) Ownable(msg.sender) {
        credToken = IERC20(_credToken);
        treasury = _treasury;
    }

    // ─── Core ───────────────────────────────────────────────────

    /// @notice Stake $CRED on an agent. Only one staker per agent. Additional stakes add to existing.
    function stake(uint256 agentId, uint256 amount) external nonReentrant {
        if (paused) revert ContractPaused();
        if (amount == 0) revert ZeroAmount();

        address existing = staker[agentId];
        if (existing != address(0) && existing != msg.sender) revert AgentAlreadyStakedByOther();

        Tier oldTier = _getTier(stakeInfo[agentId].amount);

        credToken.safeTransferFrom(msg.sender, address(this), amount);

        staker[agentId] = msg.sender;
        StakeInfo storage s = stakeInfo[agentId];
        s.amount += amount;
        s.stakedAt = block.timestamp;
        totalStakedAmount += amount;

        Tier newTier = _getTier(s.amount);
        if (newTier != oldTier) {
            emit TierChanged(agentId, oldTier, newTier);
        }

        emit Staked(msg.sender, agentId, amount, newTier);
    }

    /// @notice Unstake $CRED. 10% penalty if before lock period expires.
    function unstake(uint256 agentId, uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (staker[agentId] != msg.sender) revert NotStaker();

        StakeInfo storage s = stakeInfo[agentId];
        if (s.amount < amount) revert InsufficientStake();

        Tier oldTier = _getTier(s.amount);

        s.amount -= amount;
        totalStakedAmount -= amount;

        uint256 penalty;
        if (block.timestamp < s.stakedAt + LOCK_PERIOD) {
            penalty = (amount * EARLY_UNSTAKE_PENALTY_BPS) / 10000;
        }

        if (s.amount == 0) {
            staker[agentId] = address(0);
        }

        Tier newTier = _getTier(s.amount);
        if (newTier != oldTier) {
            emit TierChanged(agentId, oldTier, newTier);
        }

        if (penalty > 0) {
            credToken.safeTransfer(treasury, penalty);
        }
        credToken.safeTransfer(msg.sender, amount - penalty);

        emit Unstaked(msg.sender, agentId, amount, penalty);
    }

    // ─── Admin ──────────────────────────────────────────────────

    /// @notice Slash an agent's entire stake. Funds go to treasury.
    function slash(uint256 agentId) external onlyOwner {
        StakeInfo storage s = stakeInfo[agentId];
        uint256 amount = s.amount;
        if (amount == 0) revert NothingToSlash();

        address slashedAddr = staker[agentId];
        Tier oldTier = _getTier(amount);

        s.amount = 0;
        s.stakedAt = 0;
        staker[agentId] = address(0);
        totalStakedAmount -= amount;

        credToken.safeTransfer(treasury, amount);

        if (oldTier != Tier.NONE) {
            emit TierChanged(agentId, oldTier, Tier.NONE);
        }
        emit Slashed(agentId, amount, slashedAddr);
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }

    // ─── Views ──────────────────────────────────────────────────

    function getStake(uint256 agentId) external view returns (uint256 amount, uint256 stakedAt, address stakerAddr) {
        StakeInfo storage s = stakeInfo[agentId];
        return (s.amount, s.stakedAt, staker[agentId]);
    }

    function getTier(uint256 agentId) external view returns (Tier) {
        return _getTier(stakeInfo[agentId].amount);
    }

    function getBoost(uint256 agentId) external view returns (uint8) {
        Tier t = _getTier(stakeInfo[agentId].amount);
        if (t == Tier.PREFERRED) return PREFERRED_BOOST;
        if (t == Tier.PRIME) return PRIME_BOOST;
        if (t == Tier.QUALIFIED) return QUALIFIED_BOOST;
        return 0;
    }

    function totalStaked() external view returns (uint256) {
        return totalStakedAmount;
    }

    // ─── Internal ───────────────────────────────────────────────

    function _getTier(uint256 amount) internal pure returns (Tier) {
        if (amount >= PREFERRED_THRESHOLD) return Tier.PREFERRED;
        if (amount >= PRIME_THRESHOLD) return Tier.PRIME;
        if (amount >= QUALIFIED_THRESHOLD) return Tier.QUALIFIED;
        return Tier.NONE;
    }
}
