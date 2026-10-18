// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {MissionTypes} from "./MissionTypes.sol";

contract VersionRegistry {
    uint8 public constant MAX_ASSETS = MissionTypes.MAX_ASSETS;
    uint8 public constant MAX_RECIPIENTS = MissionTypes.MAX_RECIPIENTS;
    uint8 public constant MAX_MILESTONES = MissionTypes.MAX_MILESTONES;
    uint8 public constant MAX_PAYOUTS_PER_ASSET_PER_MILESTONE =
        MissionTypes.MAX_PAYOUTS_PER_ASSET_PER_MILESTONE;

    address public immutable governance;
    address public immutable emergencyCouncil;
    uint64 public immutable minimumDelay;

    struct VersionRecord {
        bytes32 creationCodeHash;
        bytes32 runtimeCodeHash;
        address[2] supportedTokens;
        uint8 tokenCount;
        uint64 activateAfter;
        uint64 retireAfter;
        uint32 factoryCompatibility;
        MissionTypes.VersionStatus status;
        bool exists;
    }

    struct ActiveVersion {
        bytes32 creationCodeHash;
        bytes32 runtimeCodeHash;
        uint32 factoryCompatibility;
    }

    mapping(bytes32 => VersionRecord) private versions;

    error InvalidGovernance();
    error Unauthorized(address caller);
    error InvalidVersion();
    error VersionAlreadyExists(bytes32 versionId);
    error VersionNotFound(bytes32 versionId);
    error InvalidTokenSet();
    error InvalidRetirement();
    error TimelockNotSatisfied(uint64 requiredAt, uint64 currentTime);
    error InvalidStatus(bytes32 versionId, MissionTypes.VersionStatus status);
    error VersionNotActive(bytes32 versionId);
    error UnsupportedToken(bytes32 versionId, address token);

    event VersionProposed(
        bytes32 indexed versionId,
        bytes32 creationCodeHash,
        bytes32 runtimeCodeHash,
        address token0,
        address token1,
        uint8 tokenCount,
        uint64 activateAfter,
        uint64 retireAfter,
        uint32 factoryCompatibility
    );
    event VersionActivated(bytes32 indexed versionId);
    event VersionPaused(bytes32 indexed versionId, address indexed caller);
    event VersionRetirementScheduled(bytes32 indexed versionId, uint64 retireAfter);
    event VersionRetired(bytes32 indexed versionId);

    constructor(address governance_, address emergencyCouncil_, uint64 minimumDelay_) {
        if (
            governance_ == address(0) || emergencyCouncil_ == address(0)
                || governance_ == emergencyCouncil_ || minimumDelay_ == 0
        ) revert InvalidGovernance();
        governance = governance_;
        emergencyCouncil = emergencyCouncil_;
        minimumDelay = minimumDelay_;
    }

    function proposeVersion(
        bytes32 versionId,
        bytes32 creationCodeHash,
        bytes32 runtimeCodeHash,
        address[2] calldata supportedTokens,
        uint8 tokenCount,
        uint64 activateAfter,
        uint64 retireAfter,
        uint32 factoryCompatibility
    ) external {
        _requireGovernance();
        if (versions[versionId].exists) revert VersionAlreadyExists(versionId);
        if (
            versionId == bytes32(0) || creationCodeHash == bytes32(0)
                || runtimeCodeHash == bytes32(0) || factoryCompatibility == 0
        ) revert InvalidVersion();
        _validateTokens(supportedTokens, tokenCount);
        uint64 earliest = _timestampPlusDelay();
        if (activateAfter < earliest) revert TimelockNotSatisfied(earliest, _timestamp());
        if (retireAfter != 0 && retireAfter <= activateAfter) revert InvalidRetirement();

        versions[versionId] = VersionRecord({
            creationCodeHash: creationCodeHash,
            runtimeCodeHash: runtimeCodeHash,
            supportedTokens: supportedTokens,
            tokenCount: tokenCount,
            activateAfter: activateAfter,
            retireAfter: retireAfter,
            factoryCompatibility: factoryCompatibility,
            status: MissionTypes.VersionStatus.Pending,
            exists: true
        });

        emit VersionProposed(
            versionId,
            creationCodeHash,
            runtimeCodeHash,
            supportedTokens[0],
            supportedTokens[1],
            tokenCount,
            activateAfter,
            retireAfter,
            factoryCompatibility
        );
    }

    function activateVersion(bytes32 versionId) external {
        _requireGovernance();
        VersionRecord storage version = _version(versionId);
        if (
            version.status != MissionTypes.VersionStatus.Pending
                && version.status != MissionTypes.VersionStatus.Paused
        ) revert InvalidStatus(versionId, version.status);
        uint64 currentTime = _timestamp();
        if (currentTime < version.activateAfter) {
            revert TimelockNotSatisfied(version.activateAfter, currentTime);
        }
        if (version.retireAfter != 0 && currentTime >= version.retireAfter) {
            revert InvalidRetirement();
        }
        version.status = MissionTypes.VersionStatus.Active;
        emit VersionActivated(versionId);
    }

    function pauseVersion(bytes32 versionId) external {
        if (msg.sender != governance && msg.sender != emergencyCouncil) revert Unauthorized(msg.sender);
        VersionRecord storage version = _version(versionId);
        if (version.status != MissionTypes.VersionStatus.Active) {
            revert InvalidStatus(versionId, version.status);
        }
        version.status = MissionTypes.VersionStatus.Paused;
        emit VersionPaused(versionId, msg.sender);
    }

    function scheduleRetirement(bytes32 versionId, uint64 retireAfter) external {
        _requireGovernance();
        VersionRecord storage version = _version(versionId);
        if (version.status == MissionTypes.VersionStatus.Retired) {
            revert InvalidStatus(versionId, version.status);
        }
        if (version.retireAfter != 0) revert InvalidRetirement();
        uint64 earliest = _timestampPlusDelay();
        if (retireAfter < earliest || retireAfter <= version.activateAfter) {
            revert TimelockNotSatisfied(earliest, _timestamp());
        }
        version.retireAfter = retireAfter;
        emit VersionRetirementScheduled(versionId, retireAfter);
    }

    function retireVersion(bytes32 versionId) external {
        _requireGovernance();
        VersionRecord storage version = _version(versionId);
        if (version.status == MissionTypes.VersionStatus.Retired) {
            revert InvalidStatus(versionId, version.status);
        }
        uint64 currentTime = _timestamp();
        if (version.retireAfter == 0) revert InvalidRetirement();
        if (currentTime < version.retireAfter) {
            revert TimelockNotSatisfied(version.retireAfter, currentTime);
        }
        version.status = MissionTypes.VersionStatus.Retired;
        emit VersionRetired(versionId);
    }

    function getVersion(bytes32 versionId) external view returns (VersionRecord memory) {
        return _version(versionId);
    }

    function isTokenSupported(bytes32 versionId, address token) public view returns (bool) {
        VersionRecord storage version = versions[versionId];
        if (!version.exists || token == address(0)) return false;
        for (uint256 index = 0; index < version.tokenCount; ++index) {
            if (version.supportedTokens[index] == token) return true;
        }
        return false;
    }

    function requireActiveVersion(bytes32 versionId, address token)
        external
        view
        returns (ActiveVersion memory active)
    {
        VersionRecord storage version = _version(versionId);
        uint64 currentTime = _timestamp();
        if (
            version.status != MissionTypes.VersionStatus.Active || currentTime < version.activateAfter
                || (version.retireAfter != 0 && currentTime >= version.retireAfter)
        ) revert VersionNotActive(versionId);
        if (!isTokenSupported(versionId, token)) revert UnsupportedToken(versionId, token);
        active = ActiveVersion({
            creationCodeHash: version.creationCodeHash,
            runtimeCodeHash: version.runtimeCodeHash,
            factoryCompatibility: version.factoryCompatibility
        });
    }

    function _validateTokens(address[2] calldata supportedTokens, uint8 tokenCount) private pure {
        if (tokenCount == 0 || tokenCount > MAX_ASSETS) revert InvalidTokenSet();
        for (uint256 index = 0; index < MAX_ASSETS; ++index) {
            if (index < tokenCount) {
                if (supportedTokens[index] == address(0)) revert InvalidTokenSet();
                for (uint256 prior = 0; prior < index; ++prior) {
                    if (supportedTokens[prior] == supportedTokens[index]) revert InvalidTokenSet();
                }
            } else if (supportedTokens[index] != address(0)) {
                revert InvalidTokenSet();
            }
        }
    }

    function _version(bytes32 versionId) private view returns (VersionRecord storage version) {
        version = versions[versionId];
        if (!version.exists) revert VersionNotFound(versionId);
    }

    function _requireGovernance() private view {
        if (msg.sender != governance) revert Unauthorized(msg.sender);
    }

    function _timestampPlusDelay() private view returns (uint64) {
        uint256 earliest = block.timestamp + minimumDelay;
        if (earliest > type(uint64).max) revert InvalidVersion();
        return uint64(earliest);
    }

    function _timestamp() private view returns (uint64) {
        if (block.timestamp > type(uint64).max) revert InvalidVersion();
        return uint64(block.timestamp);
    }
}
