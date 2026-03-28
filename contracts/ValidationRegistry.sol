// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title ValidationRegistry
 * @notice Stores on-chain validation attestations for agent addresses.
 *         Part of the ERC-8004 tri-registry model (Identity / Reputation / Validation).
 *         Validators attest to agent properties (identity, capability, security, compliance, etc.).
 * @dev UUPS upgradeable. Authorized validators submit/revoke attestations; anyone can query.
 */
contract ValidationRegistry is Initializable, UUPSUpgradeable, AccessControl {

    // ── Roles ────────────────────────────────────────────────────────────
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");
    bytes32 public constant ADMIN_ROLE     = DEFAULT_ADMIN_ROLE;

    // ── Types ────────────────────────────────────────────────────────────
    struct Validation {
        uint256 id;
        address validator;
        string  validationType;   // "identity", "capability", "security", "compliance", or custom
        bytes   evidence;
        uint256 timestamp;
        bool    revoked;
    }

    // ── Storage ──────────────────────────────────────────────────────────
    /// @notice Auto-incrementing validation ID
    uint256 public nextValidationId;

    /// @notice All validations for a given agent
    mapping(address => Validation[]) internal _validations;

    /// @notice Lookup: validationId → agent address (for revocation)
    mapping(uint256 => address) internal _validationAgent;

    /// @notice Lookup: validationId → index in agent's array
    mapping(uint256 => uint256) internal _validationIndex;

    /// @notice Quick check: agent + type hash → active count
    mapping(address => mapping(bytes32 => uint256)) internal _activeCount;

    /// @notice Optional pointer to an identity registry (V2 / V3 / any)
    address public identityRegistry;

    // ── Events ───────────────────────────────────────────────────────────
    event ValidationSubmitted(
        uint256 indexed validationId,
        address indexed agent,
        address indexed validator,
        string  validationType,
        uint256 timestamp
    );
    event ValidationRevoked(
        uint256 indexed validationId,
        address indexed agent,
        address indexed validator,
        uint256 timestamp
    );
    event IdentityRegistryUpdated(address indexed registry);

    // ── Errors ───────────────────────────────────────────────────────────
    error ZeroAddress();
    error EmptyValidationType();
    error ValidationNotFound(uint256 id);
    error NotOriginalValidator(uint256 id);
    error AlreadyRevoked(uint256 id);

    // ── Initializer ──────────────────────────────────────────────────────
    function initialize(address admin) external initializer {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(VALIDATOR_ROLE, admin);
        nextValidationId = 1;
    }

    // ── Validator writes ─────────────────────────────────────────────────
    /**
     * @notice Submit a validation attestation for an agent.
     * @param agent          The agent address being validated.
     * @param validationType Free-form type string (e.g. "identity", "security").
     * @param evidence       Arbitrary bytes evidence (hash, signature, IPFS CID, etc.).
     * @return validationId  The ID of the new validation.
     */
    function submitValidation(
        address agent,
        string calldata validationType,
        bytes calldata evidence
    ) external onlyRole(VALIDATOR_ROLE) returns (uint256 validationId) {
        if (agent == address(0)) revert ZeroAddress();
        if (bytes(validationType).length == 0) revert EmptyValidationType();

        validationId = nextValidationId++;

        Validation memory v = Validation({
            id: validationId,
            validator: msg.sender,
            validationType: validationType,
            evidence: evidence,
            timestamp: block.timestamp,
            revoked: false
        });

        uint256 idx = _validations[agent].length;
        _validations[agent].push(v);
        _validationAgent[validationId] = agent;
        _validationIndex[validationId] = idx;

        bytes32 typeHash = keccak256(bytes(validationType));
        _activeCount[agent][typeHash]++;

        emit ValidationSubmitted(validationId, agent, msg.sender, validationType, block.timestamp);
    }

    /**
     * @notice Revoke a validation. Only the original validator can revoke their own attestation.
     * @param agent        The agent address.
     * @param validationId The validation to revoke.
     */
    function revokeValidation(address agent, uint256 validationId) external onlyRole(VALIDATOR_ROLE) {
        address storedAgent = _validationAgent[validationId];
        if (storedAgent == address(0) || storedAgent != agent) revert ValidationNotFound(validationId);

        uint256 idx = _validationIndex[validationId];
        Validation storage v = _validations[agent][idx];

        if (v.revoked) revert AlreadyRevoked(validationId);
        if (v.validator != msg.sender) revert NotOriginalValidator(validationId);

        v.revoked = true;

        bytes32 typeHash = keccak256(bytes(v.validationType));
        _activeCount[agent][typeHash]--;

        emit ValidationRevoked(validationId, agent, msg.sender, block.timestamp);
    }

    // ── Public reads ─────────────────────────────────────────────────────
    function getValidations(address agent) external view returns (Validation[] memory) {
        return _validations[agent];
    }

    function getValidation(uint256 validationId) external view returns (Validation memory) {
        address agent = _validationAgent[validationId];
        if (agent == address(0)) revert ValidationNotFound(validationId);
        return _validations[agent][_validationIndex[validationId]];
    }

    function isValidated(address agent, string calldata validationType) external view returns (bool) {
        bytes32 typeHash = keccak256(bytes(validationType));
        return _activeCount[agent][typeHash] > 0;
    }

    function getValidationCount(address agent) external view returns (uint256) {
        return _validations[agent].length;
    }

    // ── Admin ────────────────────────────────────────────────────────────
    function setIdentityRegistry(address registry) external onlyRole(DEFAULT_ADMIN_ROLE) {
        identityRegistry = registry;
        emit IdentityRegistryUpdated(registry);
    }

    // ── Internal ─────────────────────────────────────────────────────────
    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
