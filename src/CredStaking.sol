// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CredStaking — Stake $CRED to Boost Agent Reputation
 * @notice Users stake $CRED tokens against a Helixa agent tokenId to increase
 *         that agent's Cred boost score. Acts as a vouching mechanism.
 * @dev Boost uses a logarithmic curve: boost = 15 * ln(1 + totalStaked/SCALE) / ln(1 + CAP/SCALE)
 *      This prevents whale domination while rewarding meaningful stakes.
 */
contract CredStaking is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ─── Constants ──────────────────────────────────────────────

    /// @notice Minimum lock period before unstaking
    uint256 public constant LOCK_PERIOD = 7 days;

    /// @notice Maximum cred boost points
    uint256 public constant MAX_BOOST = 15;

    /// @notice Scale factor for the log curve (1000 CRED = ~7.5 boost, approachable)
    /// @dev With 18 decimals: 1000e18
    uint256 public constant LOG_SCALE = 1000e18;

    /// @notice Cap where boost approaches MAX_BOOST (~100,000 CRED)
    uint256 public constant LOG_CAP = 100_000e18;

    // ─── State ──────────────────────────────────────────────────

    IERC20 public immutable credToken;

    struct StakeInfo {
        uint256 amount;
        uint256 stakedAt; // latest stake timestamp (resets lock on additional stakes)
    }

    /// @notice user => tokenId => StakeInfo
    mapping(address => mapping(uint256 => StakeInfo)) public stakes;

    /// @notice tokenId => total staked
    mapping(uint256 => uint256) public totalStaked;

    /// @notice Emergency pause
    bool public paused;

    // ─── Events ─────────────────────────────────────────────────

    event Staked(address indexed user, uint256 indexed tokenId, uint256 amount);
    event Unstaked(address indexed user, uint256 indexed tokenId, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 indexed tokenId, uint256 amount);
    event Paused(bool state);

    // ─── Errors ─────────────────────────────────────────────────

    error ZeroAmount();
    error LockNotExpired();
    error InsufficientStake();
    error ContractPaused();

    // ─── Constructor ────────────────────────────────────────────

    constructor(address _credToken) Ownable(msg.sender) {
        credToken = IERC20(_credToken);
    }

    // ─── Core Functions ─────────────────────────────────────────

    /// @notice Stake CRED tokens on a specific agent
    /// @param tokenId The Helixa agent token ID to stake on
    /// @param amount Amount of CRED to stake
    function stake(uint256 tokenId, uint256 amount) external nonReentrant {
        if (paused) revert ContractPaused();
        if (amount == 0) revert ZeroAmount();

        credToken.safeTransferFrom(msg.sender, address(this), amount);

        StakeInfo storage s = stakes[msg.sender][tokenId];
        s.amount += amount;
        s.stakedAt = block.timestamp; // resets lock on each stake
        totalStaked[tokenId] += amount;

        emit Staked(msg.sender, tokenId, amount);
    }

    /// @notice Unstake CRED tokens from a specific agent (after lock period)
    /// @param tokenId The Helixa agent token ID to unstake from
    /// @param amount Amount of CRED to unstake
    function unstake(uint256 tokenId, uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        StakeInfo storage s = stakes[msg.sender][tokenId];
        if (s.amount < amount) revert InsufficientStake();
        if (block.timestamp < s.stakedAt + LOCK_PERIOD) revert LockNotExpired();

        s.amount -= amount;
        totalStaked[tokenId] -= amount;

        credToken.safeTransfer(msg.sender, amount);

        emit Unstaked(msg.sender, tokenId, amount);
    }

    // ─── View Functions ─────────────────────────────────────────

    /// @notice Get a user's stake on a specific agent
    function getStake(address user, uint256 tokenId) external view returns (uint256 amount, uint256 stakedAt) {
        StakeInfo storage s = stakes[user][tokenId];
        return (s.amount, s.stakedAt);
    }

    /// @notice Get total staked on an agent
    function getTotalStaked(uint256 tokenId) external view returns (uint256) {
        return totalStaked[tokenId];
    }

    /// @notice Calculate cred boost for an agent based on total staked
    /// @dev Uses approximated log curve: boost = MAX_BOOST * log2(1 + total/SCALE) / log2(1 + CAP/SCALE)
    ///      Implemented with a piecewise linear approximation of log2.
    function getCredBoost(uint256 tokenId) external view returns (uint256) {
        uint256 total = totalStaked[tokenId];
        if (total == 0) return 0;
        if (total >= LOG_CAP) return MAX_BOOST;

        // log2(1 + total/SCALE) / log2(1 + CAP/SCALE)
        // We compute log2 of (SCALE + total) and (SCALE + CAP) relative to SCALE
        // Using integer log2 approximation scaled by 1e18

        uint256 numerator = _log2Scaled(LOG_SCALE + total) - _log2Scaled(LOG_SCALE);
        uint256 denominator = _log2Scaled(LOG_SCALE + LOG_CAP) - _log2Scaled(LOG_SCALE);

        return (MAX_BOOST * numerator) / denominator;
    }

    // ─── Admin Functions ────────────────────────────────────────

    /// @notice Emergency withdraw all stakes for a user+agent (owner only, bypasses lock)
    function emergencyWithdraw(address user, uint256 tokenId) external onlyOwner {
        StakeInfo storage s = stakes[user][tokenId];
        uint256 amount = s.amount;
        if (amount == 0) revert ZeroAmount();

        s.amount = 0;
        totalStaked[tokenId] -= amount;

        credToken.safeTransfer(user, amount);

        emit EmergencyWithdraw(user, tokenId, amount);
    }

    /// @notice Pause/unpause staking
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }

    // ─── Internal ───────────────────────────────────────────────

    /// @dev Integer log2 approximation scaled by 1e18.
    ///      Uses bit-shifting to find the integer part, then linear interpolation for fractional.
    function _log2Scaled(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;

        // Find highest bit position (integer part of log2)
        uint256 n = 0;
        uint256 temp = x;
        if (temp >= 1 << 128) { temp >>= 128; n += 128; }
        if (temp >= 1 << 64)  { temp >>= 64;  n += 64; }
        if (temp >= 1 << 32)  { temp >>= 32;  n += 32; }
        if (temp >= 1 << 16)  { temp >>= 16;  n += 16; }
        if (temp >= 1 << 8)   { temp >>= 8;   n += 8; }
        if (temp >= 1 << 4)   { temp >>= 4;   n += 4; }
        if (temp >= 1 << 2)   { temp >>= 2;   n += 2; }
        if (temp >= 1 << 1)   { n += 1; }

        // Linear interpolation for fractional part
        // fraction = (x - 2^n) / 2^n, scaled to 1e18
        uint256 powerOfTwo = 1 << n;
        uint256 fraction = ((x - powerOfTwo) * 1e18) / powerOfTwo;

        return n * 1e18 + fraction;
    }
}
