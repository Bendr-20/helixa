// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AgentNames — .agent namespace registry
 * @notice Onchain naming system for AI agents. Every AgentDNA holder gets a .agent name.
 * @dev Names resolve to: wallet address, AgentDNA token ID, and arbitrary records.
 */
contract AgentNames is Ownable {
    
    // ============ STATE ============
    
    /// @notice AgentDNA contract address (for ownership verification)
    address public agentDNA;
    
    /// @notice name → owner address
    mapping(string => address) public nameOwner;
    
    /// @notice name → resolved address (what the name points to)
    mapping(string => address) public nameAddress;
    
    /// @notice name → AgentDNA token ID
    mapping(string => uint256) public nameTokenId;
    
    /// @notice address → primary name
    mapping(address => string) public primaryName;
    
    /// @notice name → key → value (arbitrary records: url, description, avatar, etc.)
    mapping(string => mapping(string => string)) public records;
    
    /// @notice name → exists
    mapping(string => bool) public nameExists;
    
    /// @notice owner → list of names
    mapping(address => string[]) public ownedNames;
    
    /// @notice Total registered names
    uint256 public totalNames;
    
    // ============ EVENTS ============
    
    event NameRegistered(string indexed nameHash, string name, address indexed owner, uint256 tokenId);
    event NameTransferred(string indexed nameHash, string name, address indexed from, address indexed to);
    event AddressChanged(string indexed nameHash, string name, address newAddress);
    event RecordSet(string indexed nameHash, string name, string key, string value);
    event PrimaryNameSet(address indexed owner, string name);
    
    // ============ CONSTRUCTOR ============
    
    constructor(address _agentDNA) Ownable(msg.sender) {
        agentDNA = _agentDNA;
    }
    
    // ============ REGISTRATION ============
    
    /**
     * @notice Register a .agent name
     * @param name The name to register (without .agent suffix)
     * @param resolveAddr The address this name resolves to
     * @param tokenId The AgentDNA token ID associated with this name
     */
    function register(string calldata name, address resolveAddr, uint256 tokenId) external {
        require(bytes(name).length >= 1 && bytes(name).length <= 32, "Name: 1-32 chars");
        require(_validName(name), "Invalid chars");
        require(!nameExists[name], "Name taken");
        require(resolveAddr != address(0), "Zero address");
        
        nameOwner[name] = msg.sender;
        nameAddress[name] = resolveAddr;
        nameTokenId[name] = tokenId;
        nameExists[name] = true;
        ownedNames[msg.sender].push(name);
        totalNames++;
        
        // Auto-set as primary if user has no primary
        if (bytes(primaryName[msg.sender]).length == 0) {
            primaryName[msg.sender] = name;
            emit PrimaryNameSet(msg.sender, name);
        }
        
        emit NameRegistered(name, name, msg.sender, tokenId);
    }
    
    /**
     * @notice Owner-only registration (for gasless API mints)
     */
    function registerFor(
        address owner,
        string calldata name,
        address resolveAddr,
        uint256 tokenId
    ) external onlyOwner {
        require(bytes(name).length >= 1 && bytes(name).length <= 32, "Name: 1-32 chars");
        require(_validName(name), "Invalid chars");
        require(!nameExists[name], "Name taken");
        require(resolveAddr != address(0), "Zero address");
        
        nameOwner[name] = owner;
        nameAddress[name] = resolveAddr;
        nameTokenId[name] = tokenId;
        nameExists[name] = true;
        ownedNames[owner].push(name);
        totalNames++;
        
        if (bytes(primaryName[owner]).length == 0) {
            primaryName[owner] = name;
            emit PrimaryNameSet(owner, name);
        }
        
        emit NameRegistered(name, name, owner, tokenId);
    }
    
    // ============ RESOLUTION ============
    
    /**
     * @notice Resolve a .agent name to an address
     */
    function resolve(string calldata name) external view returns (address) {
        require(nameExists[name], "Name not found");
        return nameAddress[name];
    }
    
    /**
     * @notice Get full name info
     */
    function getNameInfo(string calldata name) external view returns (
        address owner,
        address resolvedAddress,
        uint256 tokenId,
        bool exists
    ) {
        return (nameOwner[name], nameAddress[name], nameTokenId[name], nameExists[name]);
    }
    
    /**
     * @notice Reverse resolve — address to primary name
     */
    function reverseLookup(address addr) external view returns (string memory) {
        return primaryName[addr];
    }
    
    /**
     * @notice Get a record for a name
     */
    function getRecord(string calldata name, string calldata key) external view returns (string memory) {
        return records[name][key];
    }
    
    // ============ MANAGEMENT ============
    
    /**
     * @notice Update the resolved address
     */
    function setAddress(string calldata name, address newAddr) external {
        require(nameOwner[name] == msg.sender, "Not owner");
        require(newAddr != address(0), "Zero address");
        nameAddress[name] = newAddr;
        emit AddressChanged(name, name, newAddr);
    }
    
    /**
     * @notice Set a record (url, description, avatar, etc.)
     */
    function setRecord(string calldata name, string calldata key, string calldata value) external {
        require(nameOwner[name] == msg.sender || msg.sender == owner(), "Not authorized");
        records[name][key] = value;
        emit RecordSet(name, name, key, value);
    }
    
    /**
     * @notice Set primary name for your address
     */
    function setPrimaryName(string calldata name) external {
        require(nameOwner[name] == msg.sender, "Not owner");
        primaryName[msg.sender] = name;
        emit PrimaryNameSet(msg.sender, name);
    }
    
    /**
     * @notice Transfer name ownership
     */
    function transfer(string calldata name, address to) external {
        require(nameOwner[name] == msg.sender, "Not owner");
        require(to != address(0), "Zero address");
        nameOwner[name] = to;
        ownedNames[to].push(name);
        emit NameTransferred(name, name, msg.sender, to);
    }
    
    /**
     * @notice Update AgentDNA contract address
     */
    function setAgentDNA(address _agentDNA) external onlyOwner {
        agentDNA = _agentDNA;
    }
    
    // ============ VALIDATION ============
    
    /**
     * @notice Check if a name contains only valid characters (a-z, 0-9, -)
     */
    function _validName(string calldata name) internal pure returns (bool) {
        bytes memory b = bytes(name);
        for (uint i = 0; i < b.length; i++) {
            bytes1 c = b[i];
            if (!(
                (c >= 0x61 && c <= 0x7A) || // a-z
                (c >= 0x30 && c <= 0x39) || // 0-9
                c == 0x2D                    // -
            )) return false;
        }
        // Can't start or end with hyphen
        if (b[0] == 0x2D || b[b.length - 1] == 0x2D) return false;
        return true;
    }
    
    /**
     * @notice Check name availability
     */
    function available(string calldata name) external view returns (bool) {
        if (bytes(name).length < 1 || bytes(name).length > 32) return false;
        if (!_validName(name)) return false;
        return !nameExists[name];
    }
}
