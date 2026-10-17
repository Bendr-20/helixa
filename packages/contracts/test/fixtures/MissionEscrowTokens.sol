// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

contract MissionTestToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(string memory name_, string memory symbol_) { name = name_; symbol = symbol_; }

    function mint(address recipient, uint256 amount) external { balanceOf[recipient] += amount; }
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
    function transfer(address recipient, uint256 amount) external virtual returns (bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
    }
    function transferFrom(address sender, address recipient, uint256 amount) external virtual returns (bool) {
        uint256 allowed = allowance[sender][msg.sender];
        require(allowed >= amount, "allowance");
        allowance[sender][msg.sender] = allowed - amount;
        _transfer(sender, recipient, amount);
        return true;
    }
    function _transfer(address sender, address recipient, uint256 amount) internal virtual {
        require(balanceOf[sender] >= amount, "balance");
        balanceOf[sender] -= amount;
        balanceOf[recipient] += amount;
    }
}

contract MissionFeeToken is MissionTestToken {
    constructor() MissionTestToken("Fee Token", "FEE") {}
    function _transfer(address sender, address recipient, uint256 amount) internal override {
        uint256 fee = amount / 100;
        require(balanceOf[sender] >= amount, "balance");
        balanceOf[sender] -= amount;
        balanceOf[recipient] += amount - fee;
    }
}

contract MissionCallbackToken is MissionTestToken {
    address public callbackTarget;
    bytes public callbackData;
    bool public callbackAttempted;
    bool public callbackSucceeded;

    constructor() MissionTestToken("Callback Token", "CALL") {}
    function setCallback(address target, bytes calldata data) external {
        callbackTarget = target;
        callbackData = data;
    }
    function transfer(address recipient, uint256 amount) external override returns (bool) {
        _callback();
        _transfer(msg.sender, recipient, amount);
        return true;
    }
    function transferFrom(address sender, address recipient, uint256 amount) external override returns (bool) {
        uint256 allowed = allowance[sender][msg.sender];
        require(allowed >= amount, "allowance");
        allowance[sender][msg.sender] = allowed - amount;
        _callback();
        _transfer(sender, recipient, amount);
        return true;
    }
    function _callback() private {
        callbackAttempted = true;
        (callbackSucceeded,) = callbackTarget.call(callbackData);
    }
}

contract MissionForceEther {
    constructor() payable {}
    function force(address payable recipient) external { selfdestruct(recipient); }
}
