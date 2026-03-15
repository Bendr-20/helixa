// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IHelixaV2 {
    struct Agent {
        address agentAddress;
        string name;
        string framework;
        bool verified;
        bool soulbound;
        uint8 origin;
        uint256 mintedAt;
        uint256 generation;
        uint256 currentVersion;
        uint256 mutationCount;
    }
    function getAgent(uint256 tokenId) external view returns (Agent memory);
    function ownerOf(uint256 tokenId) external view returns (address);
}

/**
 * @title SoulSovereign V3 — Chain of Identity
 * @notice Versioned soul locking: each lock creates a new immutable version,
 *         building an on-chain identity history chain.
 */
contract SoulSovereignV3 {
    IHelixaV2 public immutable helixa;

    /// @notice Current version counter per token (0 = never locked)
    mapping(uint256 => uint256) public soulVersion;

    /// @notice Soul hash at each version (1-indexed)
    mapping(uint256 => mapping(uint256 => bytes32)) public soulHashes;

    /// @notice Timestamp at each version (1-indexed)
    mapping(uint256 => mapping(uint256 => uint256)) public soulTimestamps;

    /// @notice Sovereign wallet per token (set on first lock)
    mapping(uint256 => address) public sovereignWallet;

    event SoulVersionLocked(
        uint256 indexed tokenId,
        uint256 indexed version,
        bytes32 soulHash,
        uint256 timestamp
    );

    // Keep legacy event for indexers watching the old signature
    event SoulLocked(uint256 indexed tokenId, address indexed sovereignWallet, bytes32 soulHash);

    constructor(address _helixa) {
        helixa = IHelixaV2(_helixa);
    }

    // ─── Core: Versioned Lock ───────────────────────────────────

    /**
     * @notice Lock a new soul version. Increments the version counter.
     * @param tokenId The Helixa token ID
     * @param _soulHash keccak256 of the soul data snapshot
     */
    function lockSoulVersion(uint256 tokenId, bytes32 _soulHash) public {
        IHelixaV2.Agent memory agent = helixa.getAgent(tokenId);
        require(
            msg.sender == agent.agentAddress || msg.sender == helixa.ownerOf(tokenId),
            "Not authorized"
        );

        uint256 newVersion = soulVersion[tokenId] + 1;
        soulVersion[tokenId] = newVersion;
        soulHashes[tokenId][newVersion] = _soulHash;
        soulTimestamps[tokenId][newVersion] = block.timestamp;

        // Set sovereign wallet on first lock
        if (newVersion == 1) {
            sovereignWallet[tokenId] = msg.sender;
            emit SoulLocked(tokenId, msg.sender, _soulHash);
        }

        emit SoulVersionLocked(tokenId, newVersion, _soulHash, block.timestamp);
    }

    // ─── Backward Compatibility ─────────────────────────────────

    /**
     * @notice Legacy one-shot lock. Now just delegates to lockSoulVersion.
     * @dev Preserves the v2 interface: reverts if already locked (version > 0).
     */
    function lockSoul(uint256 tokenId, bytes32 _soulHash) external {
        require(soulVersion[tokenId] == 0, "Already sovereign");
        lockSoulVersion(tokenId, _soulHash);
    }

    /// @notice Legacy: returns latest hash (matches v2 public mapping getter signature)
    function soulHash(uint256 tokenId) external view returns (bytes32) {
        uint256 v = soulVersion[tokenId];
        if (v == 0) return bytes32(0);
        return soulHashes[tokenId][v];
    }

    /// @notice Legacy: true if at least one version locked
    function isSovereign(uint256 tokenId) external view returns (bool) {
        return soulVersion[tokenId] > 0;
    }

    /// @notice Alias for isSovereign (backward compat)
    function soulLocked(uint256 tokenId) external view returns (bool) {
        return soulVersion[tokenId] > 0;
    }

    // ─── View Functions ─────────────────────────────────────────

    function getSovereignWallet(uint256 tokenId) external view returns (address) {
        return sovereignWallet[tokenId];
    }

    function getSoulVersion(uint256 tokenId) external view returns (uint256) {
        return soulVersion[tokenId];
    }

    function getSoulHash(uint256 tokenId, uint256 version) external view returns (bytes32) {
        return soulHashes[tokenId][version];
    }

    function getSoulTimestamp(uint256 tokenId, uint256 version) external view returns (uint256) {
        return soulTimestamps[tokenId][version];
    }

    /**
     * @notice Walk the full version chain for a token.
     * @return hashes Array of soul hashes (index 0 = version 1)
     * @return timestamps Array of lock timestamps
     */
    function getFullSoulHistory(uint256 tokenId)
        external
        view
        returns (bytes32[] memory hashes, uint256[] memory timestamps)
    {
        uint256 total = soulVersion[tokenId];
        hashes = new bytes32[](total);
        timestamps = new uint256[](total);
        for (uint256 i = 1; i <= total; i++) {
            hashes[i - 1] = soulHashes[tokenId][i];
            timestamps[i - 1] = soulTimestamps[tokenId][i];
        }
    }
}
