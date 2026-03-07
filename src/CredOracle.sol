// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title CredOracle
/// @notice Onchain Cred Score storage. API computes, owner writes, anyone reads.
contract CredOracle {
    address public owner;
    
    struct CredData {
        uint8 score;       // 0-100
        uint40 updatedAt;  // timestamp of last update
    }
    
    // tokenId => CredData
    mapping(uint256 => CredData) public cred;
    
    // Batch update event
    event CredUpdated(uint256 indexed tokenId, uint8 score, uint40 updatedAt);
    event OwnerTransferred(address indexed prev, address indexed next);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    /// @notice Get Cred Score for a token
    function getCredScore(uint256 tokenId) external view returns (uint8) {
        return cred[tokenId].score;
    }
    
    /// @notice Get full Cred data (score + last update time)
    function getCredData(uint256 tokenId) external view returns (uint8 score, uint40 updatedAt) {
        CredData memory d = cred[tokenId];
        return (d.score, d.updatedAt);
    }
    
    /// @notice Batch update scores (gas efficient)
    function batchUpdate(uint256[] calldata tokenIds, uint8[] calldata scores) external onlyOwner {
        require(tokenIds.length == scores.length, "length mismatch");
        uint40 ts = uint40(block.timestamp);
        for (uint256 i = 0; i < tokenIds.length; i++) {
            require(scores[i] <= 100, "score > 100");
            cred[tokenIds[i]] = CredData(scores[i], ts);
            emit CredUpdated(tokenIds[i], scores[i], ts);
        }
    }
    
    /// @notice Update single score
    function update(uint256 tokenId, uint8 score) external onlyOwner {
        require(score <= 100, "score > 100");
        uint40 ts = uint40(block.timestamp);
        cred[tokenId] = CredData(score, ts);
        emit CredUpdated(tokenId, score, ts);
    }
    
    /// @notice Transfer ownership
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero addr");
        emit OwnerTransferred(owner, newOwner);
        owner = newOwner;
    }
}
