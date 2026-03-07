// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CredPredict — Prediction Markets for Agent Performance
 * @notice Parimutuel prediction markets where humans bet $CRED on agents.
 *         Multiple markets run simultaneously. Owner/oracle resolves.
 *         Treasury takes 5% rake. Predictions lock before measurement starts.
 */
contract CredPredict is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    enum MarketState { OPEN, LOCKED, RESOLVED, CANCELLED }

    struct Market {
        string question;
        uint256 lockTime;       // predictions lock here
        uint256 resolveDeadline; // must resolve by this time
        uint256 totalPool;
        uint256 optionCount;
        uint256 winningOption;  // set on resolution
        MarketState state;
    }

    uint256 public constant RAKE_BPS = 500; // 5%

    IERC20 public immutable credToken;
    address public immutable treasury;

    uint256 public nextMarketId;
    bool public paused;

    // marketId => Market
    mapping(uint256 => Market) public markets;
    // marketId => optionIndex => agentId
    mapping(uint256 => mapping(uint256 => uint256)) public optionAgentIds;
    // marketId => optionIndex => total staked
    mapping(uint256 => mapping(uint256 => uint256)) public optionTotals;
    // marketId => user => optionIndex => amount staked
    mapping(uint256 => mapping(address => mapping(uint256 => uint256))) public userStakes;
    // marketId => user => claimed
    mapping(uint256 => mapping(address => bool)) public claimed;

    event MarketCreated(uint256 indexed marketId, string question, uint256[] agentIds, uint256 lockTime, uint256 resolveDeadline);
    event PredictionPlaced(uint256 indexed marketId, address indexed user, uint256 option, uint256 amount);
    event MarketLocked(uint256 indexed marketId);
    event MarketResolved(uint256 indexed marketId, uint256 winningOption, uint256 rake);
    event MarketCancelled(uint256 indexed marketId);
    event WinningsClaimed(uint256 indexed marketId, address indexed user, uint256 amount);
    event RefundClaimed(uint256 indexed marketId, address indexed user, uint256 amount);
    event Paused(bool state);

    error ContractPaused();
    error MarketNotOpen();
    error MarketNotLocked();
    error MarketNotResolved();
    error MarketNotCancelled();
    error PredictionsLocked();
    error InvalidOption();
    error ZeroAmount();
    error AlreadyClaimed();
    error NothingToClaim();
    error InvalidTimes();
    error TooFewOptions();
    error InvalidWinningOption();
    error NotResolvable();

    constructor(address _credToken, address _treasury) Ownable(msg.sender) {
        credToken = IERC20(_credToken);
        treasury = _treasury;
    }

    // ─── Market Management ──────────────────────────────────────

    function createMarket(
        string calldata question,
        uint256[] calldata agentIds,
        uint256 lockTime,
        uint256 resolveDeadline
    ) external onlyOwner returns (uint256 marketId) {
        if (agentIds.length < 2) revert TooFewOptions();
        if (lockTime <= block.timestamp || resolveDeadline <= lockTime) revert InvalidTimes();

        marketId = nextMarketId++;
        markets[marketId] = Market({
            question: question,
            lockTime: lockTime,
            resolveDeadline: resolveDeadline,
            totalPool: 0,
            optionCount: agentIds.length,
            winningOption: 0,
            state: MarketState.OPEN
        });

        for (uint256 i = 0; i < agentIds.length; i++) {
            optionAgentIds[marketId][i] = agentIds[i];
        }

        emit MarketCreated(marketId, question, agentIds, lockTime, resolveDeadline);
    }

    function predict(uint256 marketId, uint256 option, uint256 amount) external nonReentrant {
        if (paused) revert ContractPaused();
        if (amount == 0) revert ZeroAmount();

        Market storage m = markets[marketId];
        if (m.state != MarketState.OPEN) revert MarketNotOpen();
        if (block.timestamp >= m.lockTime) revert PredictionsLocked();
        if (option >= m.optionCount) revert InvalidOption();

        credToken.safeTransferFrom(msg.sender, address(this), amount);

        m.totalPool += amount;
        optionTotals[marketId][option] += amount;
        userStakes[marketId][msg.sender][option] += amount;

        emit PredictionPlaced(marketId, msg.sender, option, amount);
    }

    /// @notice Owner resolves market with winning option index
    function resolve(uint256 marketId, uint256 winningOption) external onlyOwner {
        Market storage m = markets[marketId];
        if (m.state == MarketState.RESOLVED || m.state == MarketState.CANCELLED) revert NotResolvable();
        if (block.timestamp < m.lockTime) revert MarketNotLocked();
        if (winningOption >= m.optionCount) revert InvalidWinningOption();

        uint256 winnerPool = optionTotals[marketId][winningOption];

        // If no one bet on the winner, cancel instead
        if (winnerPool == 0) {
            m.state = MarketState.CANCELLED;
            emit MarketCancelled(marketId);
            return;
        }

        uint256 rake = (m.totalPool * RAKE_BPS) / 10000;
        if (rake > 0) credToken.safeTransfer(treasury, rake);

        m.winningOption = winningOption;
        m.state = MarketState.RESOLVED;

        emit MarketResolved(marketId, winningOption, rake);
    }

    function cancel(uint256 marketId) external onlyOwner {
        Market storage m = markets[marketId];
        if (m.state == MarketState.RESOLVED || m.state == MarketState.CANCELLED) revert NotResolvable();
        m.state = MarketState.CANCELLED;
        emit MarketCancelled(marketId);
    }

    /// @notice Winners claim proportional share of (pool - rake)
    function claimWinnings(uint256 marketId) external nonReentrant {
        Market storage m = markets[marketId];
        if (m.state != MarketState.RESOLVED) revert MarketNotResolved();
        if (claimed[marketId][msg.sender]) revert AlreadyClaimed();

        uint256 userBet = userStakes[marketId][msg.sender][m.winningOption];
        if (userBet == 0) revert NothingToClaim();

        claimed[marketId][msg.sender] = true;

        uint256 rake = (m.totalPool * RAKE_BPS) / 10000;
        uint256 distributable = m.totalPool - rake;
        uint256 winnerPool = optionTotals[marketId][m.winningOption];
        uint256 payout = (distributable * userBet) / winnerPool;

        credToken.safeTransfer(msg.sender, payout);
        emit WinningsClaimed(marketId, msg.sender, payout);
    }

    /// @notice Cancelled markets: users claim full refund across all options
    function claimRefund(uint256 marketId) external nonReentrant {
        Market storage m = markets[marketId];
        if (m.state != MarketState.CANCELLED) revert MarketNotCancelled();
        if (claimed[marketId][msg.sender]) revert AlreadyClaimed();

        uint256 total;
        for (uint256 i = 0; i < m.optionCount; i++) {
            total += userStakes[marketId][msg.sender][i];
        }
        if (total == 0) revert NothingToClaim();

        claimed[marketId][msg.sender] = true;
        credToken.safeTransfer(msg.sender, total);
        emit RefundClaimed(marketId, msg.sender, total);
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }

    // ─── Views ──────────────────────────────────────────────────

    function getMarket(uint256 id) external view returns (Market memory) {
        return markets[id];
    }

    function getOptionTotal(uint256 marketId, uint256 option) external view returns (uint256) {
        return optionTotals[marketId][option];
    }

    function getUserStake(uint256 marketId, address user, uint256 option) external view returns (uint256) {
        return userStakes[marketId][user][option];
    }

    function getUserTotalStake(uint256 marketId, address user) external view returns (uint256 total) {
        uint256 count = markets[marketId].optionCount;
        for (uint256 i = 0; i < count; i++) {
            total += userStakes[marketId][user][i];
        }
    }

    function getOptionAgentId(uint256 marketId, uint256 option) external view returns (uint256) {
        return optionAgentIds[marketId][option];
    }

    /// @notice Preview payout for a user if market resolved with given winning option
    function previewPayout(uint256 marketId, address user, uint256 winOption) external view returns (uint256) {
        Market storage m = markets[marketId];
        uint256 userBet = userStakes[marketId][user][winOption];
        if (userBet == 0) return 0;
        uint256 winnerPool = optionTotals[marketId][winOption];
        if (winnerPool == 0) return 0;
        uint256 rake = (m.totalPool * RAKE_BPS) / 10000;
        return ((m.totalPool - rake) * userBet) / winnerPool;
    }
}
