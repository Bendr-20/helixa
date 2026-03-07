// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CredWars — Agent vs Agent Weekly Competition
 * @notice Weekly tournaments where agents stake $CRED to enter.
 *         Winner = highest Cred Score GAIN during the epoch.
 *         Top 3 split: 60/25/15%. Treasury takes 5% rake.
 *         Min 5 entrants or tournament cancelled (refund).
 */
contract CredWars is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    enum TournamentState { OPEN, RESOLVED, CANCELLED }

    struct Tournament {
        uint256 entryFee;
        uint256 startTime;
        uint256 endTime;
        uint256 prizePool;
        uint256 entrantCount;
        TournamentState state;
    }

    struct Entrant {
        uint256 agentId;
        address staker;
        bool claimed;
    }

    uint256 public constant EPOCH_DURATION = 7 days;
    uint256 public constant MIN_ENTRANTS = 5;
    uint256 public constant RAKE_BPS = 500; // 5%
    uint256 public constant FIRST_BPS = 6000; // 60%
    uint256 public constant SECOND_BPS = 2500; // 25%
    uint256 public constant THIRD_BPS = 1500; // 15%

    IERC20 public immutable credToken;
    address public immutable treasury;

    uint256 public currentTournamentId;
    bool public paused;

    // tournamentId => Tournament
    mapping(uint256 => Tournament) public tournaments;
    // tournamentId => index => Entrant
    mapping(uint256 => mapping(uint256 => Entrant)) public entrants;
    // tournamentId => agentId => entrant index + 1 (0 = not entered)
    mapping(uint256 => mapping(uint256 => uint256)) public agentEntryIndex;
    // tournamentId => placement (0,1,2) => agentId
    mapping(uint256 => uint256[3]) public winners;
    // tournamentId => agentId => whether refund claimed
    mapping(uint256 => mapping(uint256 => bool)) public refundClaimed;

    event TournamentCreated(uint256 indexed tournamentId, uint256 entryFee, uint256 startTime, uint256 endTime);
    event AgentEntered(uint256 indexed tournamentId, uint256 indexed agentId, address staker);
    event TournamentResolved(uint256 indexed tournamentId, uint256[3] winners, uint256[3] prizes);
    event TournamentCancelled(uint256 indexed tournamentId);
    event PrizeClaimed(uint256 indexed tournamentId, uint256 indexed agentId, address to, uint256 amount);
    event RefundClaimed(uint256 indexed tournamentId, uint256 indexed agentId, address to, uint256 amount);
    event Paused(bool state);

    error ContractPaused();
    error TournamentNotOpen();
    error TournamentNotEnded();
    error TournamentStillOpen();
    error AgentAlreadyEntered();
    error NotEnoughEntrants();
    error InvalidWinners();
    error AlreadyClaimed();
    error NotEntrant();
    error NotCancelled();
    error NotResolved();
    error ZeroEntryFee();

    constructor(address _credToken, address _treasury) Ownable(msg.sender) {
        credToken = IERC20(_credToken);
        treasury = _treasury;
    }

    // ─── Tournament Management ──────────────────────────────────

    function createTournament(uint256 entryFee) external onlyOwner {
        if (entryFee == 0) revert ZeroEntryFee();

        uint256 id = currentTournamentId++;
        uint256 start = block.timestamp;
        uint256 end = start + EPOCH_DURATION;

        tournaments[id] = Tournament({
            entryFee: entryFee,
            startTime: start,
            endTime: end,
            prizePool: 0,
            entrantCount: 0,
            state: TournamentState.OPEN
        });

        emit TournamentCreated(id, entryFee, start, end);
    }

    function enter(uint256 tournamentId, uint256 agentId) external nonReentrant {
        if (paused) revert ContractPaused();
        Tournament storage t = tournaments[tournamentId];
        if (t.state != TournamentState.OPEN) revert TournamentNotOpen();
        if (block.timestamp >= t.endTime) revert TournamentNotOpen();
        if (agentEntryIndex[tournamentId][agentId] != 0) revert AgentAlreadyEntered();

        credToken.safeTransferFrom(msg.sender, address(this), t.entryFee);

        uint256 idx = t.entrantCount;
        t.entrantCount = idx + 1;
        t.prizePool += t.entryFee;
        entrants[tournamentId][idx] = Entrant(agentId, msg.sender, false);
        agentEntryIndex[tournamentId][agentId] = idx + 1;

        emit AgentEntered(tournamentId, agentId, msg.sender);
    }

    /// @notice Owner/oracle resolves with top 3 agent IDs (by score gain). Must be after endTime.
    function resolve(uint256 tournamentId, uint256[3] calldata _winners) external onlyOwner {
        Tournament storage t = tournaments[tournamentId];
        if (t.state != TournamentState.OPEN) revert TournamentNotOpen();
        if (block.timestamp < t.endTime) revert TournamentNotEnded();

        if (t.entrantCount < MIN_ENTRANTS) {
            t.state = TournamentState.CANCELLED;
            emit TournamentCancelled(tournamentId);
            return;
        }

        // Validate winners are entrants
        for (uint256 i = 0; i < 3; i++) {
            if (agentEntryIndex[tournamentId][_winners[i]] == 0) revert InvalidWinners();
        }

        // Take rake
        uint256 rake = (t.prizePool * RAKE_BPS) / 10000;
        uint256 distributable = t.prizePool - rake;

        if (rake > 0) credToken.safeTransfer(treasury, rake);

        t.state = TournamentState.RESOLVED;
        winners[tournamentId] = _winners;

        uint256[3] memory prizes;
        prizes[0] = (distributable * FIRST_BPS) / 10000;
        prizes[1] = (distributable * SECOND_BPS) / 10000;
        prizes[2] = distributable - prizes[0] - prizes[1]; // remainder to 3rd to avoid dust

        // Store prizes in prizePool field repurposed — just send directly
        for (uint256 i = 0; i < 3; i++) {
            uint256 entIdx = agentEntryIndex[tournamentId][_winners[i]] - 1;
            Entrant storage e = entrants[tournamentId][entIdx];
            e.claimed = true;
            if (prizes[i] > 0) credToken.safeTransfer(e.staker, prizes[i]);
            emit PrizeClaimed(tournamentId, _winners[i], e.staker, prizes[i]);
        }

        emit TournamentResolved(tournamentId, _winners, prizes);
    }

    /// @notice Cancelled tournaments: entrants claim refund
    function claimRefund(uint256 tournamentId, uint256 agentId) external nonReentrant {
        Tournament storage t = tournaments[tournamentId];
        if (t.state != TournamentState.CANCELLED) revert NotCancelled();

        uint256 idx = agentEntryIndex[tournamentId][agentId];
        if (idx == 0) revert NotEntrant();
        idx -= 1;

        Entrant storage e = entrants[tournamentId][idx];
        if (e.staker != msg.sender) revert NotEntrant();
        if (refundClaimed[tournamentId][agentId]) revert AlreadyClaimed();

        refundClaimed[tournamentId][agentId] = true;
        credToken.safeTransfer(msg.sender, t.entryFee);

        emit RefundClaimed(tournamentId, agentId, msg.sender, t.entryFee);
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }

    // ─── Views ──────────────────────────────────────────────────

    function getTournament(uint256 id) external view returns (Tournament memory) {
        return tournaments[id];
    }

    function getEntrant(uint256 tournamentId, uint256 index) external view returns (Entrant memory) {
        return entrants[tournamentId][index];
    }

    function isAgentEntered(uint256 tournamentId, uint256 agentId) external view returns (bool) {
        return agentEntryIndex[tournamentId][agentId] != 0;
    }

    function getWinners(uint256 tournamentId) external view returns (uint256[3] memory) {
        return winners[tournamentId];
    }
}
