// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title ReputationRegistry
 * @notice Stores on-chain reputation scores for any agent address.
 *         Part of the ERC-8004 tri-registry model (Identity / Reputation / Validation).
 *         Keyed by address (not token ID) so non-NFT agents can be scored.
 * @dev UUPS upgradeable. Oracles submit scores; anyone can query.
 */
contract ReputationRegistry is Initializable, UUPSUpgradeable, AccessControl {

    // ── Roles ────────────────────────────────────────────────────────────
    bytes32 public constant ORACLE_ROLE    = keccak256("ORACLE_ROLE");
    bytes32 public constant ADMIN_ROLE     = DEFAULT_ADMIN_ROLE;

    // ── Types ────────────────────────────────────────────────────────────
    enum Tier { Junk, Marginal, Qualified, Prime, Preferred }

    struct ReputationEntry {
        uint256 score;       // 0-100
        uint256 timestamp;
        address oracle;
        string  metadata;
    }

    // ── Storage ──────────────────────────────────────────────────────────
    /// @notice Latest reputation for each agent
    mapping(address => ReputationEntry) public latestReputation;

    /// @notice Full history of reputation entries per agent
    mapping(address => ReputationEntry[]) internal _history;

    /// @notice Optional pointer to an identity registry (V2 / V3 / any)
    address public identityRegistry;

    // ── Events ───────────────────────────────────────────────────────────
    event ReputationUpdated(
        address indexed agent,
        uint256 score,
        address indexed oracle,
        uint256 timestamp
    );
    event IdentityRegistryUpdated(address indexed registry);

    // ── Errors ───────────────────────────────────────────────────────────
    error ScoreOutOfRange(uint256 score);
    error ZeroAddress();

    // ── Initializer ──────────────────────────────────────────────────────
    function initialize(address admin) external initializer {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORACLE_ROLE, admin);
    }

    // ── Oracle writes ────────────────────────────────────────────────────
    /**
     * @notice Submit or update a reputation score for an agent.
     * @param agent   The agent address being scored.
     * @param score   0-100 inclusive.
     * @param metadata Arbitrary string context (e.g. JSON with breakdown).
     */
    function submitReputation(
        address agent,
        uint256 score,
        string calldata metadata
    ) external onlyRole(ORACLE_ROLE) {
        if (agent == address(0)) revert ZeroAddress();
        if (score > 100) revert ScoreOutOfRange(score);

        ReputationEntry memory entry = ReputationEntry({
            score: score,
            timestamp: block.timestamp,
            oracle: msg.sender,
            metadata: metadata
        });

        latestReputation[agent] = entry;
        _history[agent].push(entry);

        emit ReputationUpdated(agent, score, msg.sender, block.timestamp);
    }

    // ── Public reads ─────────────────────────────────────────────────────
    function getReputation(address agent)
        external
        view
        returns (uint256 score, uint256 timestamp, string memory metadata)
    {
        ReputationEntry storage e = latestReputation[agent];
        return (e.score, e.timestamp, e.metadata);
    }

    function getReputationHistory(address agent)
        external
        view
        returns (ReputationEntry[] memory)
    {
        return _history[agent];
    }

    function getTier(address agent) external view returns (Tier) {
        return _scoreToTier(latestReputation[agent].score);
    }

    function getReputationCount(address agent) external view returns (uint256) {
        return _history[agent].length;
    }

    // ── Admin ────────────────────────────────────────────────────────────
    function setIdentityRegistry(address registry) external onlyRole(DEFAULT_ADMIN_ROLE) {
        identityRegistry = registry;
        emit IdentityRegistryUpdated(registry);
    }

    // ── Internal ─────────────────────────────────────────────────────────
    function _scoreToTier(uint256 score) internal pure returns (Tier) {
        if (score < 20) return Tier.Junk;
        if (score < 40) return Tier.Marginal;
        if (score < 60) return Tier.Qualified;
        if (score < 80) return Tier.Prime;
        return Tier.Preferred;
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
