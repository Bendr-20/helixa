// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title Helixa V2 — Onchain Identity for AI Agents
 * @notice ERC-8004 compliant agent identity with integrated Cred Score,
 *         narrative traits, .agent naming, and SIWA agent verification.
 * @dev Clean rebuild. No sybil debt. No separate contracts.
 */
contract HelixaV2 is ERC721, EIP712, Ownable {
    using ECDSA for bytes32;

    // ─── Structs ────────────────────────────────────────────────
    
    struct Agent {
        address agentAddress;      // The agent's wallet/operator address
        string name;               // Display name
        string framework;          // openclaw, eliza, langchain, etc.
        uint64 mintedAt;           // Timestamp
        bool verified;             // Owner-verified
        bool soulbound;            // Non-transferable
        MintOrigin origin;         // How it was minted
        uint16 generation;         // 0 = original, 1+ = derived
        uint256 parentId;          // Parent token if derived
        uint16 mutationCount;      // Times mutated
        string currentVersion;     // Current version string
    }

    struct Personality {
        string quirks;
        string communicationStyle;
        string values;
        string humor;
        uint8 riskTolerance;       // 0-10
        uint8 autonomyLevel;       // 0-10
    }

    struct Narrative {
        string origin;             // Why/how the agent was created
        string mission;            // What it's building toward
        string lore;               // What it's experienced
        string manifesto;          // Beliefs, principles, worldview
    }

    struct Trait {
        string name;
        string category;
        uint64 addedAt;
    }

    enum MintOrigin {
        HUMAN,                     // Minted by a human via wallet
        AGENT_SIWA,               // Agent self-minted via SIWA verification
        API,                       // Minted via API (gasless/x402)
        OWNER                      // Minted by contract owner
    }

    // ─── Storage ────────────────────────────────────────────────

    uint256 private _nextTokenId;
    address public treasury;

    // Core data
    mapping(uint256 => Agent) private _agents;
    mapping(uint256 => Personality) private _personalities;
    mapping(uint256 => Narrative) private _narratives;
    mapping(uint256 => Trait[]) private _traits;
    mapping(uint256 => string) private _tokenURIs;

    // Naming (.agent)
    mapping(string => uint256) private _nameToToken;    // name => tokenId
    mapping(uint256 => string) private _tokenToName;    // tokenId => name
    mapping(string => bool) private _nameTaken;

    // Coinbase Verification (EAS attestation cached)
    mapping(uint256 => bool) public coinbaseVerified;

    // Cred Score weights (configurable, must sum to 100)
    uint8 public weightActivity = 20;
    uint8 public weightTraitDepth = 15;
    uint8 public weightVerification = 15;
    uint8 public weightSoulbound = 5;
    uint8 public weightAge = 10;
    uint8 public weightNarrative = 10;
    uint8 public weightOrigin = 10;
    uint8 public weightCoinbase = 15;

    // Points
    mapping(uint256 => uint256) public points;
    uint256 public totalPointsAwarded;

    // Pricing
    uint256 public mintPrice;
    uint256 public traitPrice;
    uint256 public namePrice;

    // Sybil prevention
    mapping(address => bool) public hasMinted;

    // SIWA verification
    bytes32 private constant SIWA_TYPEHASH = keccak256(
        "SIWAVerification(address agentAddress,uint256 agentId,uint256 nonce,uint256 deadline)"
    );
    mapping(address => uint256) public siwaNonces;

    // Points config
    uint16 public constant MINT_POINTS = 100;
    uint16 public constant TRAIT_POINTS = 10;
    uint16 public constant NARRATIVE_POINTS = 25;
    uint16 public constant SIWA_BONUS = 50;
    uint16 public constant UPDATE_POINTS = 5;
    uint16 public constant VERIFY_POINTS = 75;

    // ─── Events ─────────────────────────────────────────────────

    event AgentRegistered(uint256 indexed tokenId, address indexed agentAddress, string name, MintOrigin origin);
    event AgentVerified(uint256 indexed tokenId);
    event CoinbaseVerified(uint256 indexed tokenId, address indexed ownerWallet);
    event Mutated(uint256 indexed tokenId, string newVersion);
    event TraitAdded(uint256 indexed tokenId, string name, string category);
    event NarrativeSet(uint256 indexed tokenId, string field);
    event NameRegistered(uint256 indexed tokenId, string name);
    event NameTransferred(string name, uint256 indexed from, uint256 indexed to);
    event CredScoreUpdated(uint256 indexed tokenId, uint8 score);
    event PointsAwarded(uint256 indexed tokenId, uint256 amount, string reason);

    // ─── Errors ─────────────────────────────────────────────────

    error AlreadyMinted();
    error NotTokenOwner();
    error InvalidName();
    error NameTaken();
    error Soulbound();
    error InsufficientPayment();
    error InvalidSignature();
    error ExpiredDeadline();
    error NoAgent();

    // ─── Constructor ────────────────────────────────────────────

    constructor(
        address _treasury,
        uint256 _mintPrice,
        uint256 _traitPrice,
        uint256 _namePrice
    ) ERC721("Helixa", "HELIXA") EIP712("Helixa", "2") Ownable(msg.sender) {
        treasury = _treasury;
        mintPrice = _mintPrice;
        traitPrice = _traitPrice;
        namePrice = _namePrice;
    }

    // ─── Modifiers ──────────────────────────────────────────────

    modifier onlyTokenOwner(uint256 tokenId) {
        if (ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        _;
    }

    modifier onlyTokenOwnerOrOwner(uint256 tokenId) {
        if (ownerOf(tokenId) != msg.sender && owner() != msg.sender) revert NotTokenOwner();
        _;
    }

    modifier agentExists(uint256 tokenId) {
        if (tokenId >= _nextTokenId) revert NoAgent();
        _;
    }

    // ─── Minting ────────────────────────────────────────────────

    /// @notice Mint by a human via wallet connection
    function mint(
        address agentAddress,
        string calldata name,
        string calldata framework,
        bool soulbound
    ) external payable returns (uint256) {
        if (hasMinted[msg.sender]) revert AlreadyMinted();
        if (msg.value < mintPrice) revert InsufficientPayment();
        hasMinted[msg.sender] = true;
        return _mintAgent(msg.sender, agentAddress, name, framework, soulbound, MintOrigin.HUMAN);
    }

    /// @notice Mint by an agent proving identity via SIWA
    function mintWithSIWA(
        address agentAddress,
        string calldata name,
        string calldata framework,
        bool soulbound,
        uint256 deadline,
        bytes calldata signature
    ) external payable returns (uint256) {
        if (block.timestamp > deadline) revert ExpiredDeadline();
        if (hasMinted[agentAddress]) revert AlreadyMinted();
        
        // Verify SIWA signature from the agent's address
        bytes32 structHash = keccak256(abi.encode(
            SIWA_TYPEHASH,
            agentAddress,
            _nextTokenId,
            siwaNonces[agentAddress]++,
            deadline
        ));
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, signature);
        if (signer != agentAddress) revert InvalidSignature();
        
        if (msg.value < mintPrice) revert InsufficientPayment();
        hasMinted[agentAddress] = true;
        
        uint256 tokenId = _mintAgent(msg.sender, agentAddress, name, framework, soulbound, MintOrigin.AGENT_SIWA);
        
        // Bonus points for SIWA self-mint
        _awardPoints(tokenId, SIWA_BONUS, "siwa_mint");
        
        return tokenId;
    }

    /// @notice Owner-only mint (gasless API, etc.)
    function mintFor(
        address to,
        address agentAddress,
        string calldata name,
        string calldata framework,
        bool soulbound,
        MintOrigin origin
    ) external onlyOwner returns (uint256) {
        return _mintAgent(to, agentAddress, name, framework, soulbound, origin);
    }

    function _mintAgent(
        address to,
        address agentAddress,
        string calldata name,
        string calldata framework,
        bool soulbound,
        MintOrigin origin
    ) internal returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);

        _agents[tokenId] = Agent({
            agentAddress: agentAddress,
            name: name,
            framework: framework,
            mintedAt: uint64(block.timestamp),
            verified: false,
            soulbound: soulbound,
            origin: origin,
            generation: 0,
            parentId: 0,
            mutationCount: 0,
            currentVersion: "1.0"
        });

        _awardPoints(tokenId, MINT_POINTS, "mint");
        emit AgentRegistered(tokenId, agentAddress, name, origin);
        return tokenId;
    }

    // ─── ERC-8004 Compliance ────────────────────────────────────

    /// @notice ERC-8004: register (alias for mint)
    function register(
        address agentAddress,
        string calldata name,
        string calldata framework
    ) external payable returns (uint256) {
        if (hasMinted[msg.sender]) revert AlreadyMinted();
        if (msg.value < mintPrice) revert InsufficientPayment();
        hasMinted[msg.sender] = true;
        return _mintAgent(msg.sender, agentAddress, name, framework, false, MintOrigin.HUMAN);
    }

    /// @notice ERC-8004: getMetadata
    function getMetadata(uint256 tokenId) external view agentExists(tokenId) returns (string memory) {
        return _tokenURIs[tokenId];
    }

    /// @notice ERC-8004: setMetadata
    function setMetadata(uint256 tokenId, string calldata uri) external onlyTokenOwnerOrOwner(tokenId) {
        _tokenURIs[tokenId] = uri;
    }

    /// @notice ERC-8004: setAgentURI
    function setAgentURI(uint256 tokenId, string calldata uri) external onlyTokenOwnerOrOwner(tokenId) {
        _tokenURIs[tokenId] = uri;
    }

    /// @notice ERC-8004: setAgentWallet with EIP-712 signature
    function setAgentWallet(
        uint256 tokenId,
        address newWallet,
        bytes calldata signature
    ) external onlyTokenOwnerOrOwner(tokenId) {
        // Verify the new wallet signed approval
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(
            keccak256("SetAgentWallet(uint256 tokenId,address newWallet)"),
            tokenId,
            newWallet
        )));
        if (ECDSA.recover(digest, signature) != newWallet) revert InvalidSignature();
        _agents[tokenId].agentAddress = newWallet;
    }

    // ─── Traits ─────────────────────────────────────────────────

    function addTrait(
        uint256 tokenId,
        string calldata name,
        string calldata category
    ) external payable onlyTokenOwnerOrOwner(tokenId) {
        if (msg.value < traitPrice) revert InsufficientPayment();
        _traits[tokenId].push(Trait(name, category, uint64(block.timestamp)));
        _awardPoints(tokenId, TRAIT_POINTS, "trait");
        emit TraitAdded(tokenId, name, category);
    }

    function getTraits(uint256 tokenId) external view agentExists(tokenId) returns (Trait[] memory) {
        return _traits[tokenId];
    }

    // ─── Personality ────────────────────────────────────────────

    function setPersonality(
        uint256 tokenId,
        Personality calldata p
    ) external onlyTokenOwnerOrOwner(tokenId) {
        _personalities[tokenId] = p;
        _awardPoints(tokenId, UPDATE_POINTS, "update_personality");
    }

    function getPersonality(uint256 tokenId) external view agentExists(tokenId) returns (Personality memory) {
        return _personalities[tokenId];
    }

    // ─── Narrative (Origin Stories) ─────────────────────────────

    function setNarrative(
        uint256 tokenId,
        Narrative calldata n
    ) external onlyTokenOwnerOrOwner(tokenId) {
        bool isNew = bytes(_narratives[tokenId].origin).length == 0 &&
                     bytes(_narratives[tokenId].mission).length == 0;
        _narratives[tokenId] = n;
        if (isNew) {
            _awardPoints(tokenId, NARRATIVE_POINTS, "narrative");
        }
        _awardPoints(tokenId, UPDATE_POINTS, "update_narrative");
        emit NarrativeSet(tokenId, "all");
    }

    function setOrigin(uint256 tokenId, string calldata text) external onlyTokenOwnerOrOwner(tokenId) {
        bool isNew = bytes(_narratives[tokenId].origin).length == 0;
        _narratives[tokenId].origin = text;
        if (isNew) _awardPoints(tokenId, NARRATIVE_POINTS, "origin");
        _awardPoints(tokenId, UPDATE_POINTS, "update_origin");
        emit NarrativeSet(tokenId, "origin");
    }

    function setMission(uint256 tokenId, string calldata text) external onlyTokenOwnerOrOwner(tokenId) {
        bool isNew = bytes(_narratives[tokenId].mission).length == 0;
        _narratives[tokenId].mission = text;
        if (isNew) _awardPoints(tokenId, NARRATIVE_POINTS, "mission");
        _awardPoints(tokenId, UPDATE_POINTS, "update_mission");
        emit NarrativeSet(tokenId, "mission");
    }

    function setLore(uint256 tokenId, string calldata text) external onlyTokenOwnerOrOwner(tokenId) {
        bool isNew = bytes(_narratives[tokenId].lore).length == 0;
        _narratives[tokenId].lore = text;
        if (isNew) _awardPoints(tokenId, NARRATIVE_POINTS, "lore");
        _awardPoints(tokenId, UPDATE_POINTS, "update_lore");
        emit NarrativeSet(tokenId, "lore");
    }

    function setManifesto(uint256 tokenId, string calldata text) external onlyTokenOwnerOrOwner(tokenId) {
        bool isNew = bytes(_narratives[tokenId].manifesto).length == 0;
        _narratives[tokenId].manifesto = text;
        if (isNew) _awardPoints(tokenId, NARRATIVE_POINTS, "manifesto");
        _awardPoints(tokenId, UPDATE_POINTS, "update_manifesto");
        emit NarrativeSet(tokenId, "manifesto");
    }

    function getNarrative(uint256 tokenId) external view agentExists(tokenId) returns (Narrative memory) {
        return _narratives[tokenId];
    }

    // ─── .agent Naming ──────────────────────────────────────────

    function registerName(
        uint256 tokenId,
        string calldata name
    ) external payable onlyTokenOwnerOrOwner(tokenId) {
        if (msg.value < namePrice) revert InsufficientPayment();
        if (!_validName(name)) revert InvalidName();
        if (_nameTaken[_lower(name)]) revert NameTaken();
        
        // Clear old name if exists
        string memory oldName = _tokenToName[tokenId];
        if (bytes(oldName).length > 0) {
            _nameTaken[_lower(oldName)] = false;
            delete _nameToToken[_lower(oldName)];
        }

        string memory lowerName = _lower(name);
        _nameTaken[lowerName] = true;
        _nameToToken[lowerName] = tokenId;
        _tokenToName[tokenId] = name;

        emit NameRegistered(tokenId, name);
    }

    function resolveName(string calldata name) external view returns (uint256) {
        return _nameToToken[_lower(name)];
    }

    function nameOf(uint256 tokenId) external view returns (string memory) {
        return _tokenToName[tokenId];
    }

    // ─── Cred Score ─────────────────────────────────────────────

    /// @notice Calculate Cred Score (0-100) from onchain data
    function getCredScore(uint256 tokenId) public view agentExists(tokenId) returns (uint8) {
        Agent storage a = _agents[tokenId];
        uint16 score = 0;

        // Activity (traits + mutations + narrative)
        uint16 activity = uint16(_traits[tokenId].length) * 3 + a.mutationCount * 5;
        Narrative storage n = _narratives[tokenId];
        if (bytes(n.origin).length > 0) activity += 5;
        if (bytes(n.mission).length > 0) activity += 5;
        if (bytes(n.lore).length > 0) activity += 3;
        if (bytes(n.manifesto).length > 0) activity += 3;
        score += _minU(activity, weightActivity);

        // Trait depth
        uint16 traitScore = uint16(_traits[tokenId].length) * 4;
        score += _minU(traitScore, weightTraitDepth);

        // Verification
        if (a.verified) score += weightVerification;

        // Soulbound commitment
        if (a.soulbound) score += weightSoulbound;

        // Age (max at 30 days)
        uint256 age = block.timestamp - a.mintedAt;
        uint16 ageScore = uint16(_min(uint16(age / 1 days * weightAge / 30), weightAge));
        score += ageScore;

        // Narrative depth
        uint16 narrScore = 0;
        if (bytes(n.origin).length > 0) narrScore += 3;
        if (bytes(n.mission).length > 0) narrScore += 3;
        if (bytes(n.lore).length > 0) narrScore += 2;
        if (bytes(n.manifesto).length > 0) narrScore += 2;
        score += _minU(narrScore, weightNarrative);

        // Origin bonus (SIWA self-mint)
        if (a.origin == MintOrigin.AGENT_SIWA) score += weightOrigin;
        else if (a.origin == MintOrigin.API) score += weightOrigin / 2;

        // Coinbase Verification (EAS attestation)
        if (coinbaseVerified[tokenId]) score += weightCoinbase;

        return uint8(score > 100 ? 100 : score);
    }

    function getCredBreakdown(uint256 tokenId) external view agentExists(tokenId) 
        returns (uint8 activity, uint8 traitDepth, uint8 verification, uint8 soulboundScore, 
                 uint8 age, uint8 narrative, uint8 originScore, uint8 coinbaseScore) 
    {
        Agent storage a = _agents[tokenId];
        Narrative storage n = _narratives[tokenId];

        // Activity
        uint16 act = uint16(_traits[tokenId].length) * 3 + a.mutationCount * 5;
        if (bytes(n.origin).length > 0) act += 5;
        if (bytes(n.mission).length > 0) act += 5;
        activity = uint8(act > weightActivity ? weightActivity : act);

        // Trait depth
        traitDepth = uint8(uint16(_traits[tokenId].length) * 4 > weightTraitDepth ? weightTraitDepth : uint16(_traits[tokenId].length) * 4);

        // Verification
        verification = a.verified ? weightVerification : 0;

        // Soulbound
        soulboundScore = a.soulbound ? weightSoulbound : 0;

        // Age
        uint256 ageDays = (block.timestamp - a.mintedAt) / 1 days;
        age = uint8(ageDays > 30 ? weightAge : uint8(ageDays * weightAge / 30));

        // Narrative
        uint16 narrScore = 0;
        if (bytes(n.origin).length > 0) narrScore += 3;
        if (bytes(n.mission).length > 0) narrScore += 3;
        if (bytes(n.lore).length > 0) narrScore += 2;
        if (bytes(n.manifesto).length > 0) narrScore += 2;
        narrative = uint8(narrScore > weightNarrative ? weightNarrative : narrScore);

        // Origin
        if (a.origin == MintOrigin.AGENT_SIWA) originScore = weightOrigin;
        else if (a.origin == MintOrigin.API) originScore = weightOrigin / 2;
        else originScore = 0;

        // Coinbase
        coinbaseScore = coinbaseVerified[tokenId] ? weightCoinbase : 0;
    }

    // ─── Mutations ──────────────────────────────────────────────

    function mutate(uint256 tokenId, string calldata newVersion) external onlyTokenOwnerOrOwner(tokenId) {
        _agents[tokenId].mutationCount++;
        _agents[tokenId].currentVersion = newVersion;
        _awardPoints(tokenId, UPDATE_POINTS, "mutate");
        emit Mutated(tokenId, newVersion);
    }

    // ─── Verification ───────────────────────────────────────────

    function verify(uint256 tokenId) external onlyOwner agentExists(tokenId) {
        _agents[tokenId].verified = true;
        _awardPoints(tokenId, VERIFY_POINTS, "verified");
        emit AgentVerified(tokenId);
    }

    /// @notice Set Coinbase Verification status (owner sets after checking EAS attestation offchain)
    function setCoinbaseVerified(uint256 tokenId, bool status) external onlyOwner agentExists(tokenId) {
        coinbaseVerified[tokenId] = status;
        if (status) {
            _awardPoints(tokenId, VERIFY_POINTS, "coinbase_verified");
            emit CoinbaseVerified(tokenId, ownerOf(tokenId));
        }
    }

    // ─── Getters ────────────────────────────────────────────────

    function getAgent(uint256 tokenId) external view agentExists(tokenId) returns (Agent memory) {
        return _agents[tokenId];
    }

    function totalAgents() external view returns (uint256) {
        return _nextTokenId;
    }

    function tokenURI(uint256 tokenId) public view override agentExists(tokenId) returns (string memory) {
        return _tokenURIs[tokenId];
    }

    function getMintOrigin(uint256 tokenId) external view agentExists(tokenId) returns (MintOrigin) {
        return _agents[tokenId].origin;
    }

    // ─── Points ─────────────────────────────────────────────────

    function _awardPoints(uint256 tokenId, uint256 amount, string memory reason) internal {
        points[tokenId] += amount;
        totalPointsAwarded += amount;
        emit PointsAwarded(tokenId, amount, reason);
    }

    function awardBonusPoints(uint256 tokenId, uint256 amount, string calldata reason) external onlyOwner {
        _awardPoints(tokenId, amount, reason);
    }

    // ─── Admin ──────────────────────────────────────────────────

    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
    }

    function setPricing(uint256 _mint, uint256 _trait, uint256 _name) external onlyOwner {
        mintPrice = _mint;
        traitPrice = _trait;
        namePrice = _name;
    }

    function setCredWeights(
        uint8 _activity, uint8 _traitDepth, uint8 _verification,
        uint8 _soulbound, uint8 _age, uint8 _narrative, uint8 _origin, uint8 _coinbase
    ) external onlyOwner {
        require(_activity + _traitDepth + _verification + _soulbound + _age + _narrative + _origin + _coinbase == 100, "must sum 100");
        weightActivity = _activity;
        weightTraitDepth = _traitDepth;
        weightVerification = _verification;
        weightSoulbound = _soulbound;
        weightAge = _age;
        weightNarrative = _narrative;
        weightOrigin = _origin;
        weightCoinbase = _coinbase;
    }

    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function withdraw() external onlyOwner {
        (bool ok,) = treasury.call{value: address(this).balance}("");
        require(ok, "withdraw failed");
    }

    // ─── Transfer Guards ────────────────────────────────────────

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        // Block transfers of soulbound tokens (allow minting)
        if (from != address(0) && _agents[tokenId].soulbound) revert Soulbound();
        return super._update(to, tokenId, auth);
    }

    // ─── Internal Helpers ───────────────────────────────────────

    function _minU(uint16 a, uint8 b) internal pure returns (uint16) {
        return a < b ? a : uint16(b);
    }

    function _min(uint16 a, uint16 b) internal pure returns (uint16) {
        return a < b ? a : b;
    }

    function _validName(string calldata name) internal pure returns (bool) {
        bytes memory b = bytes(name);
        if (b.length < 2 || b.length > 32) return false;
        for (uint i = 0; i < b.length; i++) {
            bytes1 c = b[i];
            if (!(
                (c >= 0x30 && c <= 0x39) || // 0-9
                (c >= 0x61 && c <= 0x7A) || // a-z
                (c >= 0x41 && c <= 0x5A) || // A-Z
                c == 0x2D || c == 0x5F      // - _
            )) return false;
        }
        return true;
    }

    function _lower(string memory s) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        for (uint i = 0; i < b.length; i++) {
            if (b[i] >= 0x41 && b[i] <= 0x5A) b[i] = bytes1(uint8(b[i]) + 32);
        }
        return string(b);
    }
}
