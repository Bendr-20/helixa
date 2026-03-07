// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AgentNames
 * @notice Simple .agent naming registry for Helixa AgentDNA
 * @dev Maps human-readable names to agent addresses/IDs. Not a full ENS —
 *      just a lightweight onchain directory. name.agent resolves to an address.
 */
contract AgentNames is Ownable {
    // name hash => owner address
    mapping(bytes32 => address) public nameOwner;
    // name hash => resolved address (can differ from owner)
    mapping(bytes32 => address) public nameResolves;
    // name hash => agent token ID (0 = unlinked)
    mapping(bytes32 => uint256) public nameAgentId;
    // name hash => plaintext name
    mapping(bytes32 => string) public nameString;
    // address => primary name hash
    mapping(address => bytes32) public primaryName;
    // reverse: address => plaintext name
    mapping(address => string) public reverseName;

    // Total registered
    uint256 public totalNames;

    // Optional: link to AgentDNA contract
    address public agentDNA;

    event NameRegistered(string indexed nameIndexed, string name, address indexed owner);
    event NameTransferred(string indexed nameIndexed, string name, address indexed from, address indexed to);
    event NameResolved(string indexed nameIndexed, string name, address indexed resolvedTo);
    event PrimaryNameSet(address indexed owner, string name);

    error NameTaken();
    error NotNameOwner();
    error InvalidName();

    constructor(address _agentDNA) Ownable(msg.sender) {
        agentDNA = _agentDNA;
    }

    /**
     * @notice Register a .agent name
     * @param name The name (without .agent suffix). Lowercase, alphanumeric + hyphens, 3-32 chars.
     */
    function register(string calldata name) external {
        _validateName(name);
        bytes32 node = keccak256(bytes(name));

        if (nameOwner[node] != address(0)) revert NameTaken();

        nameOwner[node] = msg.sender;
        nameResolves[node] = msg.sender;
        nameString[node] = name;
        totalNames++;

        // Auto-set as primary if user has no primary
        if (primaryName[msg.sender] == bytes32(0)) {
            primaryName[msg.sender] = node;
            reverseName[msg.sender] = name;
            emit PrimaryNameSet(msg.sender, name);
        }

        emit NameRegistered(name, name, msg.sender);
    }

    /**
     * @notice Register a name for someone else (owner only, for gasless flow)
     */
    function registerFor(string calldata name, address owner) external onlyOwner {
        _validateName(name);
        bytes32 node = keccak256(bytes(name));

        if (nameOwner[node] != address(0)) revert NameTaken();

        nameOwner[node] = owner;
        nameResolves[node] = owner;
        nameString[node] = name;
        totalNames++;

        if (primaryName[owner] == bytes32(0)) {
            primaryName[owner] = node;
            reverseName[owner] = name;
            emit PrimaryNameSet(owner, name);
        }

        emit NameRegistered(name, name, owner);
    }

    /**
     * @notice Link a name to an AgentDNA token ID
     */
    function linkAgent(string calldata name, uint256 agentId) external {
        bytes32 node = keccak256(bytes(name));
        if (nameOwner[node] != msg.sender) revert NotNameOwner();
        nameAgentId[node] = agentId;
    }

    /**
     * @notice Set the address this name resolves to
     */
    function setResolve(string calldata name, address target) external {
        bytes32 node = keccak256(bytes(name));
        if (nameOwner[node] != msg.sender) revert NotNameOwner();
        nameResolves[node] = target;
        emit NameResolved(name, name, target);
    }

    /**
     * @notice Set your primary .agent name
     */
    function setPrimary(string calldata name) external {
        bytes32 node = keccak256(bytes(name));
        if (nameOwner[node] != msg.sender) revert NotNameOwner();
        primaryName[msg.sender] = node;
        reverseName[msg.sender] = name;
        emit PrimaryNameSet(msg.sender, name);
    }

    /**
     * @notice Transfer name ownership
     */
    function transfer(string calldata name, address to) external {
        bytes32 node = keccak256(bytes(name));
        if (nameOwner[node] != msg.sender) revert NotNameOwner();
        
        address from = msg.sender;
        nameOwner[node] = to;
        nameResolves[node] = to;

        // Clear primary if transferring primary name
        if (primaryName[from] == node) {
            primaryName[from] = bytes32(0);
            reverseName[from] = "";
        }

        // Set as primary for receiver if they have none
        if (primaryName[to] == bytes32(0)) {
            primaryName[to] = node;
            reverseName[to] = name;
        }

        emit NameTransferred(name, name, from, to);
    }

    // --- Views ---

    function resolve(string calldata name) external view returns (address) {
        return nameResolves[keccak256(bytes(name))];
    }

    function owner(string calldata name) external view returns (address) {
        return nameOwner[keccak256(bytes(name))];
    }

    function agentId(string calldata name) external view returns (uint256) {
        return nameAgentId[keccak256(bytes(name))];
    }

    function available(string calldata name) external view returns (bool) {
        return nameOwner[keccak256(bytes(name))] == address(0);
    }

    // --- Admin ---

    function setAgentDNA(address _agentDNA) external onlyOwner {
        agentDNA = _agentDNA;
    }

    // --- Internal ---

    function _validateName(string calldata name) internal pure {
        bytes memory b = bytes(name);
        if (b.length < 3 || b.length > 32) revert InvalidName();
        
        for (uint i = 0; i < b.length; i++) {
            bytes1 c = b[i];
            // a-z, 0-9, hyphen
            bool valid = (c >= 0x61 && c <= 0x7a) || // a-z
                         (c >= 0x30 && c <= 0x39) || // 0-9
                         c == 0x2d;                   // -
            if (!valid) revert InvalidName();
        }
        // Can't start or end with hyphen
        if (b[0] == 0x2d || b[b.length - 1] == 0x2d) revert InvalidName();
    }
}
