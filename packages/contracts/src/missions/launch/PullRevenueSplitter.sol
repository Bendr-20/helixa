// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Immutable pull-payment splitter for native value and an allowlist of ERC-20 assets.
/// @dev Payees claim only their own share; there is no owner, push loop, or share mutation.
contract PullRevenueSplitter {
    uint16 public constant TOTAL_BPS = 10_000;
    uint8 public constant MAX_PAYEES = 32;
    uint8 public constant MAX_ASSETS = 8;

    struct Share {
        address payee;
        uint16 bps;
    }

    bytes32 public immutable readinessHash;
    Share[] private shares;
    address[] private assets;
    mapping(address => uint16) public shareBps;
    mapping(address => bool) public supportedAsset;
    mapping(address => uint256) public totalReleased;
    mapping(address => mapping(address => uint256)) public released;
    uint256 private entered;

    error InvalidShares();
    error InvalidAssets();
    error UnsupportedAsset();
    error NotPayee();
    error NothingToRelease();
    error InvalidDeposit();
    error TokenCallFailed();
    error BalanceDeltaMismatch();
    error NativeTransferFailed();
    error ReentrantCall();

    event PaymentReceived(address indexed asset, address indexed sender, uint256 amount);
    event PaymentReleased(address indexed asset, address indexed payee, uint256 amount, uint256 totalForPayee);

    constructor(bytes32 readinessHash_, Share[] memory shares_, address[] memory assets_) {
        if (readinessHash_ == bytes32(0)) revert InvalidShares();
        uint256 shareCount = shares_.length;
        if (shareCount < 2 || shareCount > MAX_PAYEES) revert InvalidShares();

        uint256 sum;
        for (uint256 index; index < shareCount; ++index) {
            Share memory item = shares_[index];
            if (item.payee == address(0) || item.payee == address(this) || item.bps == 0 || shareBps[item.payee] != 0) {
                revert InvalidShares();
            }
            sum += item.bps;
            shares.push(item);
            shareBps[item.payee] = item.bps;
        }
        if (sum != TOTAL_BPS) revert InvalidShares();

        uint256 assetCount_ = assets_.length;
        if (assetCount_ == 0 || assetCount_ > MAX_ASSETS) revert InvalidAssets();
        for (uint256 index; index < assetCount_; ++index) {
            address asset = assets_[index];
            if (supportedAsset[asset] || (asset != address(0) && asset.code.length == 0)) revert InvalidAssets();
            supportedAsset[asset] = true;
            assets.push(asset);
        }
        readinessHash = readinessHash_;
    }

    modifier nonReentrant() {
        if (entered != 0) revert ReentrantCall();
        entered = 1;
        _;
        entered = 0;
    }

    receive() external payable {
        if (!supportedAsset[address(0)]) revert UnsupportedAsset();
        if (msg.value == 0) revert InvalidDeposit();
        emit PaymentReceived(address(0), msg.sender, msg.value);
    }

    function payeeCount() external view returns (uint256) {
        return shares.length;
    }

    function assetCount() external view returns (uint256) {
        return assets.length;
    }

    function payeeAt(uint256 index) external view returns (address payee, uint16 bps) {
        Share storage item = shares[index];
        return (item.payee, item.bps);
    }

    function assetAt(uint256 index) external view returns (address) {
        return assets[index];
    }

    function deposit(address asset, uint256 amount) external payable nonReentrant {
        if (!supportedAsset[asset]) revert UnsupportedAsset();
        if (amount == 0) revert InvalidDeposit();
        if (asset == address(0)) {
            if (msg.value != amount) revert InvalidDeposit();
        } else {
            if (msg.value != 0) revert InvalidDeposit();
            uint256 beforeBalance = _balanceOf(asset, address(this));
            _safeTransferFrom(asset, msg.sender, address(this), amount);
            if (_balanceOf(asset, address(this)) - beforeBalance != amount) revert BalanceDeltaMismatch();
        }
        emit PaymentReceived(asset, msg.sender, amount);
    }

    function totalReceived(address asset) public view returns (uint256) {
        if (!supportedAsset[asset]) revert UnsupportedAsset();
        return _assetBalance(asset) + totalReleased[asset];
    }

    function releasable(address asset, address payee) public view returns (uint256) {
        uint16 bps = shareBps[payee];
        if (bps == 0) return 0;
        uint256 received = totalReceived(asset);
        uint256 entitlement = _shareOf(received, bps);
        return entitlement - released[asset][payee];
    }

    function release(address asset) external nonReentrant returns (uint256 amount) {
        if (!supportedAsset[asset]) revert UnsupportedAsset();
        if (shareBps[msg.sender] == 0) revert NotPayee();
        amount = releasable(asset, msg.sender);
        if (amount == 0) revert NothingToRelease();

        released[asset][msg.sender] += amount;
        totalReleased[asset] += amount;
        if (asset == address(0)) {
            (bool success,) = msg.sender.call{value: amount}("");
            if (!success) revert NativeTransferFailed();
        } else {
            uint256 splitterBefore = _balanceOf(asset, address(this));
            uint256 payeeBefore = _balanceOf(asset, msg.sender);
            _safeTransfer(asset, msg.sender, amount);
            if (
                splitterBefore - _balanceOf(asset, address(this)) != amount
                    || _balanceOf(asset, msg.sender) - payeeBefore != amount
            ) revert BalanceDeltaMismatch();
        }

        emit PaymentReleased(asset, msg.sender, amount, released[asset][msg.sender]);
    }

    function _assetBalance(address asset) private view returns (uint256) {
        return asset == address(0) ? address(this).balance : _balanceOf(asset, address(this));
    }

    function _shareOf(uint256 amount, uint16 bps) private pure returns (uint256) {
        uint256 quotient = amount / TOTAL_BPS;
        uint256 remainder = amount % TOTAL_BPS;
        return quotient * bps + (remainder * bps) / TOTAL_BPS;
    }

    function _balanceOf(address asset, address account) private view returns (uint256 balance) {
        (bool success, bytes memory result) = asset.staticcall(abi.encodeWithSignature("balanceOf(address)", account));
        if (!success || result.length != 32) revert TokenCallFailed();
        balance = abi.decode(result, (uint256));
    }

    function _safeTransferFrom(address asset, address from, address to, uint256 amount) private {
        (bool success, bytes memory result) =
            asset.call(abi.encodeWithSignature("transferFrom(address,address,uint256)", from, to, amount));
        if (!success || (result.length != 0 && (result.length != 32 || !abi.decode(result, (bool))))) {
            revert TokenCallFailed();
        }
    }

    function _safeTransfer(address asset, address to, uint256 amount) private {
        (bool success, bytes memory result) =
            asset.call(abi.encodeWithSignature("transfer(address,uint256)", to, amount));
        if (!success || (result.length != 0 && (result.length != 32 || !abi.decode(result, (bool))))) {
            revert TokenCallFailed();
        }
    }
}
