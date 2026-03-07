// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CredStaking — Agent Profile Staking for Helixa V2
 * @notice Stake $CRED on agent profiles for tier boosts (+10/+20/+30),
 *         gated visibility, and "Staked & Verified" badge.
 *         7-day lock with 10% early unstake penalty to treasury.
 *         One staker per agent. Thresholds adjustable by owner.
 */
contract CredStaking is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    enum Tier { NONE, QUALIFIED, PRIME, PREFERRED }

    uint256 public constant LOCK_PERIOD = 7 days;
    uint256 public constant EARLY_UNSTAKE_PENALTY_BPS = 1000; // 10%

    IERC20 public immutable credToken;
    address public immutable treasury;

    // Adjustable thresholds
    uint256 public qualifiedThreshold = 100e18;
    uint256 public primeThreshold = 500e18;
    uint256 public preferredThreshold = 2000e18;

    // Adjustable boosts
    uint8 public qualifiedBoost = 10;
    uint8 public primeBoost = 20;
    uint8 public preferredBoost = 30;

    struct StakeInfo {
        uint256 amount;
        uint256 stakedAt;
    }

    mapping(uint256 => StakeInfo) public stakeInfo;
    mapping(uint256 => address) public staker;
    uint256 public totalStakedAmount;
    bool public paused;

    // Track all staked agent IDs for enumeration
    uint256[] private _stakedAgents;
    mapping(uint256 => uint256) private _stakedAgentIndex; // agentId => index+1 (0 = not in array)

    event Staked(address indexed user, uint256 indexed agentId, uint256 amount, Tier newTier);
    event Unstaked(address indexed user, uint256 indexed agentId, uint256 amount, uint256 penalty);
    event Slashed(uint256 indexed agentId, uint256 amount, address indexed slashedStaker);
    event TierChanged(uint256 indexed agentId, Tier oldTier, Tier newTier);
    event ThresholdsUpdated(uint256 qualified, uint256 prime, uint256 preferred);
    event BoostsUpdated(uint8 qualified, uint8 prime, uint8 preferred);
    event Paused(bool state);

    error ZeroAmount();
    error ContractPaused();
    error InsufficientStake();
    error NotStaker();
    error AgentAlreadyStakedByOther();
    error NothingToSlash();
    error InvalidThresholds();

    constructor(address _credToken, address _treasury) Ownable(msg.sender) {
        credToken = IERC20(_credToken);
        treasury = _treasury;
    }

    // ─── Core ───────────────────────────────────────────────────

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

        // Track in staked agents array
        if (_stakedAgentIndex[agentId] == 0) {
            _stakedAgents.push(agentId);
            _stakedAgentIndex[agentId] = _stakedAgents.length;
        }

        Tier newTier = _getTier(s.amount);
        if (newTier != oldTier) emit TierChanged(agentId, oldTier, newTier);
        emit Staked(msg.sender, agentId, amount, newTier);
    }

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
            _removeStakedAgent(agentId);
        }

        Tier newTier = _getTier(s.amount);
        if (newTier != oldTier) emit TierChanged(agentId, oldTier, newTier);

        if (penalty > 0) credToken.safeTransfer(treasury, penalty);
        credToken.safeTransfer(msg.sender, amount - penalty);

        emit Unstaked(msg.sender, agentId, amount, penalty);
    }

    // ─── Admin ──────────────────────────────────────────────────

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
        _removeStakedAgent(agentId);

        credToken.safeTransfer(treasury, amount);

        if (oldTier != Tier.NONE) emit TierChanged(agentId, oldTier, Tier.NONE);
        emit Slashed(agentId, amount, slashedAddr);
    }

    function setThresholds(uint256 _qualified, uint256 _prime, uint256 _preferred) external onlyOwner {
        if (_qualified >= _prime || _prime >= _preferred) revert InvalidThresholds();
        qualifiedThreshold = _qualified;
        primeThreshold = _prime;
        preferredThreshold = _preferred;
        emit ThresholdsUpdated(_qualified, _prime, _preferred);
    }

    function setBoosts(uint8 _qualified, uint8 _prime, uint8 _preferred) external onlyOwner {
        qualifiedBoost = _qualified;
        primeBoost = _prime;
        preferredBoost = _preferred;
        emit BoostsUpdated(_qualified, _prime, _preferred);
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
        if (t == Tier.PREFERRED) return preferredBoost;
        if (t == Tier.PRIME) return primeBoost;
        if (t == Tier.QUALIFIED) return qualifiedBoost;
        return 0;
    }

    function isStaked(uint256 agentId) external view returns (bool) {
        return stakeInfo[agentId].amount > 0;
    }

    function totalStaked() external view returns (uint256) {
        return totalStakedAmount;
    }

    function getStakedAgentCount() external view returns (uint256) {
        return _stakedAgents.length;
    }

    function getStakedAgents(uint256 offset, uint256 limit) external view returns (uint256[] memory) {
        uint256 len = _stakedAgents.length;
        if (offset >= len) return new uint256[](0);
        uint256 end = offset + limit;
        if (end > len) end = len;
        uint256[] memory result = new uint256[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = _stakedAgents[i];
        }
        return result;
    }

    // ─── Internal ───────────────────────────────────────────────

    function _getTier(uint256 amount) internal view returns (Tier) {
        if (amount >= preferredThreshold) return Tier.PREFERRED;
        if (amount >= primeThreshold) return Tier.PRIME;
        if (amount >= qualifiedThreshold) return Tier.QUALIFIED;
        return Tier.NONE;
    }

    function _removeStakedAgent(uint256 agentId) internal {
        uint256 idx = _stakedAgentIndex[agentId];
        if (idx == 0) return;
        uint256 lastIdx = _stakedAgents.length;
        if (idx != lastIdx) {
            uint256 lastAgent = _stakedAgents[lastIdx - 1];
            _stakedAgents[idx - 1] = lastAgent;
            _stakedAgentIndex[lastAgent] = idx;
        }
        _stakedAgents.pop();
        _stakedAgentIndex[agentId] = 0;
    }
}
