// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AgentDNA
 * @notice Identity NFTs for AI agents. One mint per agent address.
 * @dev ERC-721 with metadata URI, verified badge, and soulbound option.
 */
contract AgentDNA is ERC721, ERC721URIStorage, Ownable, ReentrancyGuard {
    uint256 private _nextTokenId;
    uint256 public mintPrice;
    
    // Agent metadata
    struct Agent {
        address agentAddress;    // The agent's operating address
        string name;             // Agent name
        string framework;        // langchain, crewai, eliza, etc.
        uint256 mintedAt;        // Block timestamp
        bool verified;           // Admin-granted verified badge
        bool soulbound;          // Non-transferable if true
    }
    
    mapping(uint256 => Agent) public agents;
    mapping(address => uint256) public agentAddressToToken;
    mapping(address => bool) public hasAgent;
    
    uint256 public totalAgents;
    
    event AgentMinted(uint256 indexed tokenId, address indexed agentAddress, string name, string framework);
    event AgentVerified(uint256 indexed tokenId);
    event AgentUnverified(uint256 indexed tokenId);
    event MintPriceUpdated(uint256 newPrice);
    
    constructor(uint256 _mintPrice) ERC721("AgentDNA", "ADNA") Ownable(msg.sender) {
        mintPrice = _mintPrice;
    }
    
    /**
     * @notice Mint an AgentDNA NFT for an AI agent
     * @param agentAddress The agent's operating wallet address
     * @param name Agent name
     * @param framework Agent framework (langchain, crewai, eliza, custom)
     * @param tokenURI_ IPFS/Arweave URI pointing to full metadata JSON
     * @param soulbound If true, this NFT cannot be transferred
     */
    function mint(
        address agentAddress,
        string calldata name,
        string calldata framework,
        string calldata tokenURI_,
        bool soulbound
    ) external payable nonReentrant returns (uint256) {
        require(msg.value >= mintPrice, "Insufficient payment");
        require(!hasAgent[agentAddress], "Agent already registered");
        require(agentAddress != address(0), "Invalid agent address");
        require(bytes(name).length > 0, "Name required");
        
        uint256 tokenId = _nextTokenId++;
        
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, tokenURI_);
        
        agents[tokenId] = Agent({
            agentAddress: agentAddress,
            name: name,
            framework: framework,
            mintedAt: block.timestamp,
            verified: false,
            soulbound: soulbound
        });
        
        agentAddressToToken[agentAddress] = tokenId;
        hasAgent[agentAddress] = true;
        totalAgents++;
        
        emit AgentMinted(tokenId, agentAddress, name, framework);
        
        // Refund excess payment
        if (msg.value > mintPrice) {
            payable(msg.sender).transfer(msg.value - mintPrice);
        }
        
        return tokenId;
    }
    
    /**
     * @notice Free mint for alpha testers (owner only)
     */
    function mintFree(
        address to,
        address agentAddress,
        string calldata name,
        string calldata framework,
        string calldata tokenURI_,
        bool soulbound
    ) external onlyOwner returns (uint256) {
        require(!hasAgent[agentAddress], "Agent already registered");
        require(agentAddress != address(0), "Invalid agent address");
        
        uint256 tokenId = _nextTokenId++;
        
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenURI_);
        
        agents[tokenId] = Agent({
            agentAddress: agentAddress,
            name: name,
            framework: framework,
            mintedAt: block.timestamp,
            verified: false,
            soulbound: soulbound
        });
        
        agentAddressToToken[agentAddress] = tokenId;
        hasAgent[agentAddress] = true;
        totalAgents++;
        
        emit AgentMinted(tokenId, agentAddress, name, framework);
        
        return tokenId;
    }
    
    // --- Admin Functions ---
    
    function verify(uint256 tokenId) external onlyOwner {
        require(_ownerOf(tokenId) != address(0), "Agent does not exist");
        agents[tokenId].verified = true;
        emit AgentVerified(tokenId);
    }
    
    function unverify(uint256 tokenId) external onlyOwner {
        agents[tokenId].verified = false;
        emit AgentUnverified(tokenId);
    }
    
    function setMintPrice(uint256 _mintPrice) external onlyOwner {
        mintPrice = _mintPrice;
        emit MintPriceUpdated(_mintPrice);
    }
    
    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
    
    // --- View Functions ---
    
    function getAgent(uint256 tokenId) external view returns (Agent memory) {
        require(_ownerOf(tokenId) != address(0), "Agent does not exist");
        return agents[tokenId];
    }
    
    function getAgentByAddress(address agentAddress) external view returns (uint256 tokenId, Agent memory agent) {
        require(hasAgent[agentAddress], "Agent not registered");
        tokenId = agentAddressToToken[agentAddress];
        agent = agents[tokenId];
    }
    
    function isVerified(uint256 tokenId) external view returns (bool) {
        return agents[tokenId].verified;
    }
    
    // --- Transfer Restriction (Soulbound) ---
    
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        // Allow minting (from == address(0)) but block transfers if soulbound
        if (from != address(0) && agents[tokenId].soulbound) {
            revert("AgentDNA: soulbound token");
        }
        return super._update(to, tokenId, auth);
    }
    
    // --- Required Overrides ---
    
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
