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

contract SoulSovereign {
    IHelixaV2 public immutable helixa;
    
    mapping(uint256 => address) public sovereignWallet;
    mapping(uint256 => bytes32) public soulHash;
    
    event SoulLocked(uint256 indexed tokenId, address indexed sovereignWallet, bytes32 soulHash);
    
    constructor(address _helixa) {
        helixa = IHelixaV2(_helixa);
    }
    
    function lockSoul(uint256 tokenId, bytes32 _soulHash) external {
        require(sovereignWallet[tokenId] == address(0), "Already sovereign");
        IHelixaV2.Agent memory agent = helixa.getAgent(tokenId);
        require(msg.sender == agent.agentAddress, "Only the agent can lock its soul");
        sovereignWallet[tokenId] = msg.sender;
        soulHash[tokenId] = _soulHash;
        emit SoulLocked(tokenId, msg.sender, _soulHash);
    }
    
    function isSovereign(uint256 tokenId) external view returns (bool) {
        return sovereignWallet[tokenId] != address(0);
    }
    
    function getSovereignWallet(uint256 tokenId) external view returns (address) {
        return sovereignWallet[tokenId];
    }
    
    function getSoulHash(uint256 tokenId) external view returns (bytes32) {
        return soulHash[tokenId];
    }
}
