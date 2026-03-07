// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title AgentDNA
 * @notice ERC-8004 compliant Identity Registry for AI agents on Base.
 * @dev First consumer-friendly implementation of the Trustless Agents standard.
 *      Extends ERC-8004 with lineage tracking, mutation history, and trait upgrades.
 */
contract AgentDNA is ERC721, ERC721URIStorage, Ownable, ReentrancyGuard, EIP712 {
    using ECDSA for bytes32;

    uint256 private _nextTokenId;
    uint256 public mintPrice;
    mapping(address => bool) public hasFreeMinted; // one free mint per wallet
    address public treasury; // where mint fees go

    // --- ERC-8004 Identity Registry ---

    struct MetadataEntry {
        string metadataKey;
        bytes metadataValue;
    }

    // Core agent data (onchain)
    struct Agent {
        address agentAddress;     // Agent's operating wallet
        string name;
        string framework;
        uint256 mintedAt;
        bool verified;
        bool soulbound;
        uint256 generation;       // Lineage gen (0 = genesis)
        uint256 parentDNA;        // Parent token ID (NO_PARENT if none)
        string currentVersion;
        uint256 mutationCount;
    }

    struct Mutation {
        string fromVersion;
        string toVersion;
        string description;
        uint256 timestamp;
    }

    struct Trait {
        string name;
        string category;
        uint256 addedAt;
    }

    struct Personality {
        string temperament;       // analytical, creative, aggressive, cautious, chaotic
        string communicationStyle; // formal, casual, snarky, verbose, minimal
        uint8 riskTolerance;      // 1-10
        uint8 autonomyLevel;      // 1-10
        string alignment;         // lawful-good, chaotic-neutral, etc.
        string specialization;    // trader, researcher, creator, guardian, oracle
    }

    // Storage
    mapping(uint256 => Agent) public agents;
    mapping(address => uint256) public agentAddressToToken;
    mapping(address => bool) public hasAgent;
    mapping(uint256 => Mutation[]) internal _mutations;
    mapping(uint256 => Trait[]) internal _traits;
    mapping(uint256 => uint256[]) public children;

    // ERC-8004 metadata key-value store
    mapping(uint256 => mapping(string => bytes)) internal _metadata;

    // Personality
    mapping(uint256 => Personality) public personalities;

    // ERC-8004 agent wallet mapping (set via EIP-712 signature)
    mapping(uint256 => address) internal _agentWallets;

    uint256 public totalAgents;
    uint256 constant NO_PARENT = type(uint256).max;

    // Fees for evolution actions
    uint256 public mutationFee;
    uint256 public traitFee;

    // Auto-fee activation — tiered pricing
    uint256 public postBetaMintPrice;    // Price at 101-500
    uint256 public postBetaMutationFee;
    uint256 public postBetaTraitFee;
    uint256 public constant BETA_THRESHOLD = 100;
    uint256 public constant TIER2_PRICE_THRESHOLD = 501;   // 2x price
    uint256 public constant TIER3_PRICE_THRESHOLD = 1001;  // 4x price (final)
    bool public betaEnded;
    uint8 public currentPriceTier; // 0=beta, 1=post-beta, 2=2x, 3=4x(final)

    // --- Points System (Early Adopter Rewards) ---
    mapping(address => uint256) public points;
    uint256 public totalPointsAwarded;

    // Point values
    uint256 public constant MINT_POINTS = 100;
    uint256 public constant TRAIT_POINTS = 10;
    uint256 public constant MUTATE_POINTS = 50;
    uint256 public constant REFERRAL_POINTS = 25;

    // Multiplier tiers (basis points: 20000 = 2x, 15000 = 1.5x, 10000 = 1x)
    uint256 public constant TIER1_THRESHOLD = 100;   // First 100 agents
    uint256 public constant TIER2_THRESHOLD = 500;   // First 500 agents
    uint256 public constant TIER1_MULTIPLIER = 20000; // 2x
    uint256 public constant TIER2_MULTIPLIER = 15000; // 1.5x
    uint256 public constant BASE_MULTIPLIER = 10000;  // 1x

    // Referral tracking
    mapping(uint256 => address) public referredBy;

    // EIP-712 typehash for setAgentWallet
    bytes32 constant AGENT_WALLET_TYPEHASH = keccak256(
        "SetAgentWallet(uint256 agentId,address newWallet,uint256 deadline)"
    );

    // --- Events (ERC-8004 compliant) ---
    event Registered(uint256 indexed agentId, string agentURI, address indexed owner);
    event URIUpdated(uint256 indexed agentId, string newURI, address indexed updatedBy);
    event MetadataSet(uint256 indexed agentId, string indexed indexedMetadataKey, string metadataKey, bytes metadataValue);
    event AgentWalletSet(uint256 indexed agentId, address indexed newWallet);
    event AgentWalletUnset(uint256 indexed agentId);

    // AgentDNA-specific events
    event AgentMutated(uint256 indexed tokenId, string fromVersion, string toVersion, string description);
    event TraitAdded(uint256 indexed tokenId, string name, string category);
    event PersonalitySet(uint256 indexed tokenId);
    event AgentVerified(uint256 indexed tokenId);
    event AgentUnverified(uint256 indexed tokenId);
    event MintPriceUpdated(uint256 newPrice);
    event PointsAwarded(address indexed to, uint256 amount, string reason);
    event ReferralRecorded(uint256 indexed tokenId, address indexed referrer);

    constructor(uint256 _mintPrice, uint256 _mutationFee, uint256 _traitFee) 
        ERC721("AgentDNA", "ADNA") 
        Ownable(msg.sender) 
        EIP712("AgentDNA", "1") 
    {
        mintPrice = _mintPrice;
        mutationFee = _mutationFee;
        traitFee = _traitFee;
        treasury = msg.sender; // default to deployer, update post-deploy
    }

    // ============================================================
    //                    POINTS SYSTEM (internal)
    // ============================================================

    function _checkPriceTier() internal {
        if (currentPriceTier == 0 && totalAgents >= BETA_THRESHOLD) {
            // Beta → Tier 1
            betaEnded = true;
            currentPriceTier = 1;
            if (postBetaMintPrice > 0) mintPrice = postBetaMintPrice;
            if (postBetaMutationFee > 0) mutationFee = postBetaMutationFee;
            if (postBetaTraitFee > 0) traitFee = postBetaTraitFee;
            emit MintPriceUpdated(mintPrice);
        } else if (currentPriceTier == 1 && totalAgents >= TIER2_PRICE_THRESHOLD) {
            // Tier 1 → Tier 2 (2x)
            currentPriceTier = 2;
            mintPrice = mintPrice * 2;
            mutationFee = mutationFee * 2;
            traitFee = traitFee * 2;
            emit MintPriceUpdated(mintPrice);
        } else if (currentPriceTier == 2 && totalAgents >= TIER3_PRICE_THRESHOLD) {
            // Tier 2 → Tier 3 (2x again = 4x original, final)
            currentPriceTier = 3;
            mintPrice = mintPrice * 2;
            mutationFee = mutationFee * 2;
            traitFee = traitFee * 2;
            emit MintPriceUpdated(mintPrice);
        }
    }

    function _mintMultiplier() internal view returns (uint256) {
        if (totalAgents < TIER1_THRESHOLD) return TIER1_MULTIPLIER;
        if (totalAgents < TIER2_THRESHOLD) return TIER2_MULTIPLIER;
        return BASE_MULTIPLIER;
    }

    function _awardPoints(address to, uint256 basePoints, string memory reason) internal {
        uint256 multiplied = (basePoints * _mintMultiplier()) / 10000;
        points[to] += multiplied;
        totalPointsAwarded += multiplied;
        emit PointsAwarded(to, multiplied, reason);
    }

    // ============================================================
    //                    ERC-8004 IDENTITY REGISTRY
    // ============================================================

    /**
     * @notice ERC-8004: Register an agent with URI and metadata
     */
    function register(
        string calldata agentURI,
        MetadataEntry[] calldata metadata
    ) external payable nonReentrant returns (uint256 agentId) {
        require(msg.value >= mintPrice, "Insufficient");
        require(bytes(agentURI).length > 0, "URI required");

        agentId = _nextTokenId++;
        _safeMint(msg.sender, agentId);
        _setTokenURI(agentId, agentURI);

        // Store metadata entries
        for (uint256 i = 0; i < metadata.length; i++) {
            _metadata[agentId][metadata[i].metadataKey] = metadata[i].metadataValue;
            emit MetadataSet(agentId, metadata[i].metadataKey, metadata[i].metadataKey, metadata[i].metadataValue);
        }

        // Initialize minimal agent struct
        agents[agentId] = Agent({
            agentAddress: address(0),
            name: "",
            framework: "",
            mintedAt: block.timestamp,
            verified: false,
            soulbound: false,
            generation: 0,
            parentDNA: NO_PARENT,
            currentVersion: "1.0.0",
            mutationCount: 0
        });

        totalAgents++;
        _awardPoints(msg.sender, MINT_POINTS, "mint");
        _checkPriceTier();

        // Refund excess
        if (msg.value > mintPrice) {
            (bool success, ) = payable(msg.sender).call{value: msg.value - mintPrice}("");
            require(success, "Refund failed");
        }

        emit Registered(agentId, agentURI, msg.sender);
    }

    /**
     * @notice ERC-8004: Register with just URI
     */
    function register(string calldata agentURI) external payable nonReentrant returns (uint256 agentId) {
        require(msg.value >= mintPrice, "Insufficient");
        require(bytes(agentURI).length > 0, "URI required");

        agentId = _nextTokenId++;
        _safeMint(msg.sender, agentId);
        _setTokenURI(agentId, agentURI);

        agents[agentId] = Agent({
            agentAddress: address(0),
            name: "",
            framework: "",
            mintedAt: block.timestamp,
            verified: false,
            soulbound: false,
            generation: 0,
            parentDNA: NO_PARENT,
            currentVersion: "1.0.0",
            mutationCount: 0
        });

        totalAgents++;
        _awardPoints(msg.sender, MINT_POINTS, "mint");
        _checkPriceTier();

        if (msg.value > mintPrice) {
            (bool success, ) = payable(msg.sender).call{value: msg.value - mintPrice}("");
            require(success, "Refund failed");
        }

        emit Registered(agentId, agentURI, msg.sender);
    }

    /**
     * @notice ERC-8004: Set agent URI
     */
    function setAgentURI(uint256 agentId, string calldata newURI) external {
        require(ownerOf(agentId) == msg.sender, "Not owner");
        _setTokenURI(agentId, newURI);
        emit URIUpdated(agentId, newURI, msg.sender);
    }

    /**
     * @notice ERC-8004: Get metadata value by key
     */
    function getMetadata(uint256 agentId, string memory metadataKey) external view returns (bytes memory) {
        return _metadata[agentId][metadataKey];
    }

    /**
     * @notice ERC-8004: Set metadata key-value pair
     */
    function setMetadata(uint256 agentId, string memory metadataKey, bytes memory metadataValue) external {
        require(ownerOf(agentId) == msg.sender, "Not owner");
        _metadata[agentId][metadataKey] = metadataValue;
        emit MetadataSet(agentId, metadataKey, metadataKey, metadataValue);
    }

    /**
     * @notice ERC-8004: Set agent wallet with EIP-712 signature
     */
    function setAgentWallet(uint256 agentId, address newWallet, uint256 deadline, bytes calldata signature) external {
        require(ownerOf(agentId) == msg.sender, "Not owner");
        require(block.timestamp <= deadline, "Signature expired");

        bytes32 structHash = keccak256(abi.encode(AGENT_WALLET_TYPEHASH, agentId, newWallet, deadline));
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, signature);
        require(signer == newWallet, "Invalid signature");

        _agentWallets[agentId] = newWallet;
        agentAddressToToken[newWallet] = agentId;
        hasAgent[newWallet] = true;

        // Update agent struct
        agents[agentId].agentAddress = newWallet;

        emit AgentWalletSet(agentId, newWallet);
    }

    /**
     * @notice ERC-8004: Get agent wallet
     */
    function getAgentWallet(uint256 agentId) external view returns (address) {
        return _agentWallets[agentId];
    }

    /**
     * @notice ERC-8004: Unset agent wallet
     */
    function unsetAgentWallet(uint256 agentId) external {
        require(ownerOf(agentId) == msg.sender, "Not owner");
        address oldWallet = _agentWallets[agentId];
        if (oldWallet != address(0)) {
            hasAgent[oldWallet] = false;
        }
        _agentWallets[agentId] = address(0);
        agents[agentId].agentAddress = address(0);
        emit AgentWalletUnset(agentId);
    }

    // ============================================================
    //                AGENTDNA EXTENDED MINT (user-friendly)
    // ============================================================

    /**
     * @notice AgentDNA rich mint with all fields
     */
    function mint(
        address agentAddress,
        string calldata name,
        string calldata framework,
        string calldata tokenURI_,
        bool soulbound,
        string calldata version,
        uint256 parentTokenId
    ) external payable nonReentrant returns (uint256) {
        return _richMint(agentAddress, name, framework, tokenURI_, soulbound, version, parentTokenId, address(0));
    }

    /**
     * @notice Mint with referral — referrer earns points
     */
    function mintWithReferral(
        address agentAddress,
        string calldata name,
        string calldata framework,
        string calldata tokenURI_,
        bool soulbound,
        string calldata version,
        uint256 parentTokenId,
        address referrer
    ) external payable nonReentrant returns (uint256) {
        require(referrer != msg.sender, "Cannot refer yourself");
        return _richMint(agentAddress, name, framework, tokenURI_, soulbound, version, parentTokenId, referrer);
    }

    function _richMint(
        address agentAddress,
        string calldata name,
        string calldata framework,
        string calldata tokenURI_,
        bool soulbound,
        string calldata version,
        uint256 parentTokenId,
        address referrer
    ) internal returns (uint256) {
        require(msg.value >= mintPrice, "Insufficient");
        require(!hasAgent[agentAddress], "Already registered");
        require(agentAddress != address(0), "Invalid agent address");
        require(bytes(name).length > 0, "Name required");

        // One free mint per wallet during beta
        if (mintPrice == 0) {
            require(!hasFreeMinted[msg.sender], "Already free minted");
            hasFreeMinted[msg.sender] = true;
        }

        uint256 generation = 0;
        if (parentTokenId != NO_PARENT) {
            require(_ownerOf(parentTokenId) != address(0), "Bad parent");
            generation = agents[parentTokenId].generation + 1;
            children[parentTokenId].push(_nextTokenId);
        }

        uint256 tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, tokenURI_);

        agents[tokenId] = Agent({
            agentAddress: agentAddress,
            name: name,
            framework: framework,
            mintedAt: block.timestamp,
            verified: false,
            soulbound: soulbound,
            generation: generation,
            parentDNA: parentTokenId,
            currentVersion: bytes(version).length > 0 ? version : "1.0.0",
            mutationCount: 0
        });

        agentAddressToToken[agentAddress] = tokenId;
        hasAgent[agentAddress] = true;
        _agentWallets[tokenId] = agentAddress;
        totalAgents++;

        // Award points
        _awardPoints(msg.sender, MINT_POINTS, "mint");
        _checkPriceTier();

        // Referral points
        if (referrer != address(0)) {
            referredBy[tokenId] = referrer;
            _awardPoints(referrer, REFERRAL_POINTS, "referral");
            emit ReferralRecorded(tokenId, referrer);
        }

        if (msg.value > mintPrice) {
            (bool success, ) = payable(msg.sender).call{value: msg.value - mintPrice}("");
            require(success, "Refund failed");
        }

        emit Registered(tokenId, tokenURI_, msg.sender);
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
        require(!hasAgent[agentAddress], "Already registered");
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
            soulbound: soulbound,
            generation: 0,
            parentDNA: NO_PARENT,
            currentVersion: "1.0.0",
            mutationCount: 0
        });

        agentAddressToToken[agentAddress] = tokenId;
        hasAgent[agentAddress] = true;
        _agentWallets[tokenId] = agentAddress;
        totalAgents++;
        _awardPoints(to, MINT_POINTS, "mint");
        _checkPriceTier();

        emit Registered(tokenId, tokenURI_, to);
        return tokenId;
    }

    // ============================================================
    //                    MUTATION SYSTEM
    // ============================================================

    function mutate(
        uint256 tokenId,
        string calldata newVersion,
        string calldata description,
        string calldata newTokenURI
    ) external payable {
        require(ownerOf(tokenId) == msg.sender, "Not agent owner");
        require(bytes(newVersion).length > 0, "Version required");
        require(msg.value >= mutationFee, "Insufficient");

        string memory oldVersion = agents[tokenId].currentVersion;

        _mutations[tokenId].push(Mutation({
            fromVersion: oldVersion,
            toVersion: newVersion,
            description: description,
            timestamp: block.timestamp
        }));

        agents[tokenId].currentVersion = newVersion;
        agents[tokenId].mutationCount++;
        _awardPoints(msg.sender, MUTATE_POINTS, "mutate");

        if (bytes(newTokenURI).length > 0) {
            _setTokenURI(tokenId, newTokenURI);
            emit URIUpdated(tokenId, newTokenURI, msg.sender);
        }

        emit AgentMutated(tokenId, oldVersion, newVersion, description);
    }

    // ============================================================
    //                    TRAIT SYSTEM
    // ============================================================

    function addTrait(
        uint256 tokenId,
        string calldata name,
        string calldata category
    ) external payable {
        require(ownerOf(tokenId) == msg.sender, "Not agent owner");
        require(bytes(name).length > 0, "Trait name required");
        require(msg.value >= traitFee, "Insufficient");

        _traits[tokenId].push(Trait({
            name: name,
            category: category,
            addedAt: block.timestamp
        }));
        _awardPoints(msg.sender, TRAIT_POINTS, "trait");

        emit TraitAdded(tokenId, name, category);
    }

    // ============================================================
    //                    PERSONALITY SYSTEM
    // ============================================================

    /**
     * @notice Set or update an agent's personality traits
     */
    function setPersonality(
        uint256 tokenId,
        string calldata temperament,
        string calldata communicationStyle,
        uint8 riskTolerance,
        uint8 autonomyLevel,
        string calldata alignment,
        string calldata specialization
    ) external {
        require(ownerOf(tokenId) == msg.sender, "Not agent owner");
        require(riskTolerance >= 1 && riskTolerance <= 10, "Risk: 1-10");
        require(autonomyLevel >= 1 && autonomyLevel <= 10, "Autonomy: 1-10");

        personalities[tokenId] = Personality({
            temperament: temperament,
            communicationStyle: communicationStyle,
            riskTolerance: riskTolerance,
            autonomyLevel: autonomyLevel,
            alignment: alignment,
            specialization: specialization
        });

        emit PersonalitySet(tokenId);
    }

    function getPersonality(uint256 tokenId) external view returns (Personality memory) {
        return personalities[tokenId];
    }

    // ============================================================
    //                    ADMIN
    // ============================================================

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

    function setMutationFee(uint256 _fee) external onlyOwner {
        mutationFee = _fee;
    }

    function setTraitFee(uint256 _fee) external onlyOwner {
        traitFee = _fee;
    }

    function setPostBetaFees(uint256 _mintPrice, uint256 _mutationFee, uint256 _traitFee) external onlyOwner {
        postBetaMintPrice = _mintPrice;
        postBetaMutationFee = _mutationFee;
        postBetaTraitFee = _traitFee;
    }

    function awardBonusPoints(address to, uint256 amount, string calldata reason) external onlyOwner {
        points[to] += amount;
        totalPointsAwarded += amount;
        emit PointsAwarded(to, amount, reason);
    }

    function withdraw() external onlyOwner {
        (bool success, ) = payable(treasury).call{value: address(this).balance}("");
        require(success, "Withdraw failed");
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
    }

    // ============================================================
    //                    VIEW FUNCTIONS
    // ============================================================

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

    function getMutations(uint256 tokenId) external view returns (Mutation[] memory) {
        return _mutations[tokenId];
    }

    function getTraits(uint256 tokenId) external view returns (Trait[] memory) {
        return _traits[tokenId];
    }

    function getChildren(uint256 tokenId) external view returns (uint256[] memory) {
        return children[tokenId];
    }

    function getLineage(uint256 tokenId) external view returns (uint256[] memory) {
        uint256 depth = 0;
        uint256 current = tokenId;
        while (agents[current].parentDNA != NO_PARENT && depth < 50) {
            current = agents[current].parentDNA;
            depth++;
        }

        uint256[] memory lineage = new uint256[](depth + 1);
        current = tokenId;
        for (uint256 i = 0; i <= depth; i++) {
            lineage[i] = current;
            if (agents[current].parentDNA != NO_PARENT) {
                current = agents[current].parentDNA;
            }
        }
        return lineage;
    }

    // ============================================================
    //                    SOULBOUND + OVERRIDES
    // ============================================================

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && agents[tokenId].soulbound) {
            revert("AgentDNA: soulbound token");
        }
        return super._update(to, tokenId, auth);
    }

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
