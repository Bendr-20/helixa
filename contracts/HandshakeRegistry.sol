// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title HandshakeRegistry — Onchain Soul Handshake Receipts
 * @notice Lightweight registry that records agent-to-agent soul handshakes.
 *         Emits events for indexers, tracks connection counts per agent.
 */
contract HandshakeRegistry {
    address public immutable helixa;
    address public owner;

    /// @notice Total handshakes recorded
    uint256 public totalHandshakes;

    /// @notice Handshake count per agent
    mapping(uint256 => uint256) public handshakeCount;

    /// @notice Whether two agents have handshaked (unordered pair)
    mapping(bytes32 => bool) public connected;

    event HandshakeCompleted(
        uint256 indexed fromTokenId,
        uint256 indexed toTokenId,
        uint256 timestamp
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _helixa) {
        helixa = _helixa;
        owner = msg.sender;
    }

    /**
     * @notice Record a completed handshake between two agents.
     * @dev Only callable by owner (API backend). Could be opened to agents later.
     */
    function recordHandshake(uint256 fromTokenId, uint256 toTokenId) external onlyOwner {
        require(fromTokenId != toTokenId, "Cannot handshake self");

        bytes32 pairKey = _pairKey(fromTokenId, toTokenId);
        require(!connected[pairKey], "Already connected");

        connected[pairKey] = true;
        handshakeCount[fromTokenId]++;
        handshakeCount[toTokenId]++;
        totalHandshakes++;

        emit HandshakeCompleted(fromTokenId, toTokenId, block.timestamp);
    }

    /// @notice Check if two agents are connected
    function isConnected(uint256 a, uint256 b) external view returns (bool) {
        return connected[_pairKey(a, b)];
    }

    /// @notice Transfer ownership
    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }

    function _pairKey(uint256 a, uint256 b) internal pure returns (bytes32) {
        (uint256 lo, uint256 hi) = a < b ? (a, b) : (b, a);
        return keccak256(abi.encodePacked(lo, hi));
    }
}
