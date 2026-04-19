// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Minimal mock of HelixaV2 for testing MintGate
contract MockHelixaV2 {
    uint256 public nextTokenId;
    mapping(uint256 => address) public ownerOf;

    function mint(address to) external payable returns (uint256) {
        uint256 tokenId = nextTokenId++;
        ownerOf[tokenId] = to;
        return tokenId;
    }
}
