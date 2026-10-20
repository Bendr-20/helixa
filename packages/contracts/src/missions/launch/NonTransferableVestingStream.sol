// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice One fully funded, immutable ERC-20 vesting stream for a fixed beneficiary.
/// @dev There is no ownership token, beneficiary setter, revocation, or administrative withdrawal.
contract NonTransferableVestingStream {
    address public immutable token;
    address public immutable beneficiary;
    uint256 public immutable totalAllocation;
    uint64 public immutable start;
    uint64 public immutable cliff;
    uint64 public immutable duration;
    bytes32 public immutable readinessHash;

    bool public funded;
    uint256 public released;
    uint256 private entered;

    error InvalidTerms();
    error InvalidFunding();
    error AlreadyFunded();
    error NothingToRelease();
    error TokenCallFailed();
    error BalanceDeltaMismatch();
    error ReentrantCall();

    event Funded(address indexed funder, uint256 amount);
    event Released(address indexed beneficiary, uint256 amount, uint256 totalReleased);

    constructor(
        address token_,
        address beneficiary_,
        uint256 totalAllocation_,
        uint64 start_,
        uint64 cliff_,
        uint64 duration_,
        bytes32 readinessHash_
    ) {
        if (
            token_ == address(0) || token_.code.length == 0 || beneficiary_ == address(0) || totalAllocation_ == 0
                || start_ <= block.timestamp || duration_ == 0 || cliff_ > duration_
                || uint256(start_) + duration_ > type(uint64).max || readinessHash_ == bytes32(0)
        ) revert InvalidTerms();

        token = token_;
        beneficiary = beneficiary_;
        totalAllocation = totalAllocation_;
        start = start_;
        cliff = cliff_;
        duration = duration_;
        readinessHash = readinessHash_;
    }

    modifier nonReentrant() {
        if (entered != 0) revert ReentrantCall();
        entered = 1;
        _;
        entered = 0;
    }

    function fund(uint256 amount) external nonReentrant {
        if (funded) revert AlreadyFunded();
        if (block.timestamp >= start || amount != totalAllocation) revert InvalidFunding();

        funded = true;
        uint256 beforeBalance = _balanceOf(address(this));
        _safeTransferFrom(msg.sender, address(this), amount);
        if (_balanceOf(address(this)) - beforeBalance != amount) revert BalanceDeltaMismatch();

        emit Funded(msg.sender, amount);
    }

    function vestedAmount(uint256 timestamp) public view returns (uint256) {
        uint256 cliffTime = uint256(start) + cliff;
        if (timestamp < cliffTime) return 0;
        uint256 elapsed = timestamp - start;
        if (elapsed >= duration) return totalAllocation;
        return _mulDivBps(totalAllocation, elapsed, duration);
    }

    function releasable() public view returns (uint256) {
        if (!funded) return 0;
        return vestedAmount(block.timestamp) - released;
    }

    function outstanding() external view returns (uint256) {
        return totalAllocation - released;
    }

    function release() external nonReentrant returns (uint256 amount) {
        amount = releasable();
        if (amount == 0) revert NothingToRelease();

        released += amount;
        uint256 streamBefore = _balanceOf(address(this));
        uint256 beneficiaryBefore = _balanceOf(beneficiary);
        _safeTransfer(beneficiary, amount);
        if (streamBefore - _balanceOf(address(this)) != amount || _balanceOf(beneficiary) - beneficiaryBefore != amount)
        {
            revert BalanceDeltaMismatch();
        }

        emit Released(beneficiary, amount, released);
    }

    function _mulDivBps(uint256 amount, uint256 elapsed, uint256 totalDuration) private pure returns (uint256) {
        uint256 quotient = amount / totalDuration;
        uint256 remainder = amount % totalDuration;
        return quotient * elapsed + (remainder * elapsed) / totalDuration;
    }

    function _balanceOf(address account) private view returns (uint256 balance) {
        (bool success, bytes memory result) = token.staticcall(abi.encodeWithSignature("balanceOf(address)", account));
        if (!success || result.length != 32) revert TokenCallFailed();
        balance = abi.decode(result, (uint256));
    }

    function _safeTransferFrom(address from, address to, uint256 amount) private {
        (bool success, bytes memory result) =
            token.call(abi.encodeWithSignature("transferFrom(address,address,uint256)", from, to, amount));
        if (!success || (result.length != 0 && (result.length != 32 || !abi.decode(result, (bool))))) {
            revert TokenCallFailed();
        }
    }

    function _safeTransfer(address to, uint256 amount) private {
        (bool success, bytes memory result) =
            token.call(abi.encodeWithSignature("transfer(address,uint256)", to, amount));
        if (!success || (result.length != 0 && (result.length != 32 || !abi.decode(result, (bool))))) {
            revert TokenCallFailed();
        }
    }
}
