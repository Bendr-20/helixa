// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Isolated Base Sepolia settlement token. It is not a production asset.
contract MissionTestToken {
    string public name;
    string public symbol;
    uint8 public immutable decimals;
    address public immutable issuer;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    error Unauthorized();
    error InvalidAddress();
    error InsufficientBalance();
    error InsufficientAllowance();

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory name_, string memory symbol_, uint8 decimals_, address issuer_) {
        if (issuer_ == address(0)) revert InvalidAddress();
        name = name_;
        symbol = symbol_;
        decimals = decimals_;
        issuer = issuer_;
    }

    function mint(address recipient, uint256 amount) external {
        if (msg.sender != issuer) revert Unauthorized();
        if (recipient == address(0)) revert InvalidAddress();
        totalSupply += amount;
        balanceOf[recipient] += amount;
        emit Transfer(address(0), recipient, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        if (spender == address(0)) revert InvalidAddress();
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address recipient, uint256 amount) external returns (bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool) {
        uint256 permitted = allowance[sender][msg.sender];
        if (permitted < amount) revert InsufficientAllowance();
        if (permitted != type(uint256).max) {
            allowance[sender][msg.sender] = permitted - amount;
            emit Approval(sender, msg.sender, permitted - amount);
        }
        _transfer(sender, recipient, amount);
        return true;
    }

    function _transfer(address sender, address recipient, uint256 amount) private {
        if (recipient == address(0)) revert InvalidAddress();
        uint256 balance = balanceOf[sender];
        if (balance < amount) revert InsufficientBalance();
        balanceOf[sender] = balance - amount;
        balanceOf[recipient] += amount;
        emit Transfer(sender, recipient, amount);
    }
}
