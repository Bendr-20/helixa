// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Immutable fixed-supply ERC-20 created for one unanimously authorized Swarm Launch.
/// @dev The full supply is minted only in construction. There is no owner, admin, mint, pause, fee, tax, or upgrade path.
contract FixedSupplySwarmToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public immutable totalSupply;
    bytes32 public immutable readinessHash;
    bytes32 public immutable deploymentId;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    error InvalidTokenTerms();
    error InvalidRecipient();
    error InsufficientBalance();
    error InsufficientAllowance();

    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 totalSupply_,
        address initialRecipient_,
        bytes32 readinessHash_,
        bytes32 deploymentId_
    ) {
        uint256 nameLength = bytes(name_).length;
        uint256 symbolLength = bytes(symbol_).length;
        if (
            nameLength == 0 || nameLength > 64 || symbolLength < 2 || symbolLength > 10 || totalSupply_ == 0
                || readinessHash_ == bytes32(0) || deploymentId_ == bytes32(0)
        ) revert InvalidTokenTerms();
        if (initialRecipient_ == address(0)) revert InvalidRecipient();

        name = name_;
        symbol = symbol_;
        totalSupply = totalSupply_;
        readinessHash = readinessHash_;
        deploymentId = deploymentId_;
        balanceOf[initialRecipient_] = totalSupply_;
        emit Transfer(address(0), initialRecipient_, totalSupply_);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        if (spender == address(0)) revert InvalidRecipient();
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            if (allowed < amount) revert InsufficientAllowance();
            unchecked {
                allowance[from][msg.sender] = allowed - amount;
            }
            emit Approval(from, msg.sender, allowance[from][msg.sender]);
        }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) private {
        if (to == address(0)) revert InvalidRecipient();
        uint256 balance = balanceOf[from];
        if (balance < amount) revert InsufficientBalance();
        unchecked {
            balanceOf[from] = balance - amount;
            balanceOf[to] += amount;
        }
        emit Transfer(from, to, amount);
    }
}
