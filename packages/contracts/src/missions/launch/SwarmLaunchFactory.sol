// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {SwarmContributionRegistry} from "./SwarmContributionRegistry.sol";
import {NonTransferableVestingStream} from "./NonTransferableVestingStream.sol";
import {PullRevenueSplitter} from "./PullRevenueSplitter.sol";

interface IERC1271 {
    function isValidSignature(bytes32 digest, bytes calldata signature) external view returns (bytes4 magicValue);
}

/// @notice Deterministically deploys one immutable, fully funded Swarm Launch execution bundle.
/// @dev Every required authority signs the exact deployment ID. There is no owner, upgrade, or recovery path.
contract SwarmLaunchFactory {
    uint8 public constant MIN_MEMBERS = 3;
    uint8 public constant MAX_MEMBERS = 5;
    uint8 public constant MAX_SIGNERS = 5;

    bytes32 public constant AUTHORIZATION_TYPEHASH =
        keccak256("SwarmLaunchExecution(bytes32 deploymentId,uint64 authorizationDeadline)");
    bytes32 private constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant NAME_HASH = keccak256("Helixa Swarm Launch");
    bytes32 private constant VERSION_HASH = keccak256("1");
    bytes32 private constant REGISTRY_TAG = keccak256("CONTRIBUTION_REGISTRY");
    bytes32 private constant SPLITTER_TAG = keccak256("REVENUE_SPLITTER");
    bytes32 private constant STREAM_TAG = keccak256("VESTING_STREAM");
    bytes32 private constant SECP256K1_HALF_ORDER = 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0;
    bytes4 private constant ERC1271_MAGIC_VALUE = 0x1626ba7e;

    struct LaunchPlan {
        bytes32 readinessHash;
        address token;
        uint64 start;
        uint64 cliff;
        uint64 duration;
        uint64 authorizationDeadline;
        bytes32 deploymentSalt;
        SwarmContributionRegistry.Contribution[] contributions;
        uint256[] vestingAmounts;
        PullRevenueSplitter.Share[] revenueShares;
        address[] revenueAssets;
        address[] requiredSigners;
    }

    bytes32 public immutable DOMAIN_SEPARATOR;
    mapping(bytes32 => address) public registryOf;
    mapping(bytes32 => address) public splitterOf;
    mapping(bytes32 => address[]) private deploymentStreams;
    uint256 private entered;

    error InvalidPlan();
    error InvalidAuthorization();
    error AuthorizationExpired();
    error AlreadyDeployed();
    error TokenCallFailed();
    error BalanceDeltaMismatch();
    error ReentrantCall();

    event SwarmLaunchDeployed(
        bytes32 indexed deploymentId,
        bytes32 indexed readinessHash,
        address indexed token,
        address registry,
        address splitter,
        address[] streams,
        uint256 totalVesting
    );

    constructor() {
        DOMAIN_SEPARATOR = keccak256(abi.encode(DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, block.chainid, address(this)));
    }

    modifier nonReentrant() {
        if (entered != 0) revert ReentrantCall();
        entered = 1;
        _;
        entered = 0;
    }

    function computeDeploymentId(LaunchPlan calldata plan) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                plan.readinessHash,
                plan.token,
                plan.start,
                plan.cliff,
                plan.duration,
                plan.authorizationDeadline,
                plan.deploymentSalt,
                keccak256(abi.encode(plan.contributions)),
                keccak256(abi.encode(plan.vestingAmounts)),
                keccak256(abi.encode(plan.revenueShares)),
                keccak256(abi.encode(plan.revenueAssets)),
                keccak256(abi.encode(plan.requiredSigners))
            )
        );
    }

    function authorizationDigest(bytes32 deploymentId, uint64 authorizationDeadline) public view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(AUTHORIZATION_TYPEHASH, deploymentId, authorizationDeadline));
        return keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
    }

    function predict(LaunchPlan calldata plan)
        external
        view
        returns (address registry, address splitter, address[] memory streams)
    {
        _validatePlan(plan, false);
        bytes32 deploymentId = computeDeploymentId(plan);
        registry = _create2Address(
            _componentSalt(deploymentId, REGISTRY_TAG, 0),
            keccak256(
                abi.encodePacked(
                    type(SwarmContributionRegistry).creationCode, abi.encode(plan.readinessHash, plan.contributions)
                )
            )
        );
        splitter = _create2Address(
            _componentSalt(deploymentId, SPLITTER_TAG, 0),
            keccak256(
                abi.encodePacked(
                    type(PullRevenueSplitter).creationCode,
                    abi.encode(plan.readinessHash, plan.revenueShares, plan.revenueAssets)
                )
            )
        );
        uint256 count = plan.contributions.length;
        streams = new address[](count);
        for (uint256 index; index < count; ++index) {
            streams[index] = _create2Address(
                _componentSalt(deploymentId, STREAM_TAG, index),
                keccak256(
                    abi.encodePacked(
                        type(NonTransferableVestingStream).creationCode,
                        abi.encode(
                            plan.token,
                            plan.contributions[index].beneficiary,
                            plan.vestingAmounts[index],
                            plan.start,
                            plan.cliff,
                            plan.duration,
                            plan.readinessHash
                        )
                    )
                )
            );
        }
    }

    function deploy(LaunchPlan calldata plan, bytes[] calldata signatures)
        external
        nonReentrant
        returns (address registry, address splitter, address[] memory streams)
    {
        uint256 totalVesting = _validatePlan(plan, true);
        if (block.timestamp >= plan.authorizationDeadline) revert AuthorizationExpired();

        bytes32 deploymentId = computeDeploymentId(plan);
        if (registryOf[deploymentId] != address(0)) revert AlreadyDeployed();
        _verifyAuthorizations(plan, authorizationDigest(deploymentId, plan.authorizationDeadline), signatures);

        registryOf[deploymentId] = address(1);
        uint256 factoryBalance = _balanceOf(plan.token, address(this));
        _safeTransferFrom(plan.token, msg.sender, address(this), totalVesting);
        if (_balanceOf(plan.token, address(this)) - factoryBalance != totalVesting) revert BalanceDeltaMismatch();

        SwarmContributionRegistry deployedRegistry = new SwarmContributionRegistry{
            salt: _componentSalt(deploymentId, REGISTRY_TAG, 0)
        }(
            plan.readinessHash, plan.contributions
        );
        registry = address(deployedRegistry);

        uint256 count = plan.contributions.length;
        streams = new address[](count);
        for (uint256 index; index < count; ++index) {
            streams[index] = _deployAndFundStream(plan, deploymentId, index);
        }

        PullRevenueSplitter deployedSplitter = new PullRevenueSplitter{
            salt: _componentSalt(deploymentId, SPLITTER_TAG, 0)
        }(
            plan.readinessHash, plan.revenueShares, plan.revenueAssets
        );
        splitter = address(deployedSplitter);

        if (_balanceOf(plan.token, address(this)) != factoryBalance) revert BalanceDeltaMismatch();
        registryOf[deploymentId] = registry;
        splitterOf[deploymentId] = splitter;
        deploymentStreams[deploymentId] = streams;
        emit SwarmLaunchDeployed(
            deploymentId, plan.readinessHash, plan.token, registry, splitter, streams, totalVesting
        );
    }

    function streamCount(bytes32 deploymentId) external view returns (uint256) {
        return deploymentStreams[deploymentId].length;
    }

    function streamAt(bytes32 deploymentId, uint256 index) external view returns (address) {
        return deploymentStreams[deploymentId][index];
    }

    function _deployAndFundStream(LaunchPlan calldata plan, bytes32 deploymentId, uint256 index)
        private
        returns (address streamAddress)
    {
        uint256 amount = plan.vestingAmounts[index];
        NonTransferableVestingStream stream = new NonTransferableVestingStream{
            salt: _componentSalt(deploymentId, STREAM_TAG, index)
        }(
            plan.token,
            plan.contributions[index].beneficiary,
            amount,
            plan.start,
            plan.cliff,
            plan.duration,
            plan.readinessHash
        );
        streamAddress = address(stream);
        _safeApprove(plan.token, streamAddress, amount);
        stream.fund(amount);
    }

    function _validatePlan(LaunchPlan calldata plan, bool enforceTime) private view returns (uint256 totalVesting) {
        uint256 memberCount = plan.contributions.length;
        if (
            plan.readinessHash == bytes32(0) || plan.deploymentSalt == bytes32(0) || plan.token.code.length == 0
                || memberCount < MIN_MEMBERS || memberCount > MAX_MEMBERS || plan.vestingAmounts.length != memberCount
                || plan.duration == 0 || plan.cliff > plan.duration
                || uint256(plan.start) + plan.duration > type(uint64).max || plan.authorizationDeadline >= plan.start
        ) revert InvalidPlan();
        if (enforceTime && plan.start <= block.timestamp) revert InvalidPlan();

        uint256 signerCount = plan.requiredSigners.length;
        if (signerCount == 0 || signerCount > MAX_SIGNERS) revert InvalidPlan();
        address previous;
        for (uint256 index; index < signerCount; ++index) {
            address signer = plan.requiredSigners[index];
            if (signer == address(0) || signer <= previous) revert InvalidPlan();
            previous = signer;
        }

        for (uint256 index; index < memberCount; ++index) {
            uint256 amount = plan.vestingAmounts[index];
            if (amount == 0) revert InvalidPlan();
            totalVesting += amount;
        }
        uint256 allocated;
        for (uint256 index; index < memberCount; ++index) {
            uint256 expected = index + 1 == memberCount
                ? totalVesting - allocated
                : (totalVesting * plan.contributions[index].bps) / 10_000;
            if (plan.vestingAmounts[index] != expected) revert InvalidPlan();
            allocated += expected;
        }
    }

    function _verifyAuthorizations(LaunchPlan calldata plan, bytes32 digest, bytes[] calldata signatures) private view {
        uint256 count = plan.requiredSigners.length;
        if (signatures.length != count) revert InvalidAuthorization();
        for (uint256 index; index < count; ++index) {
            if (!_isValidSignature(plan.requiredSigners[index], digest, signatures[index])) {
                revert InvalidAuthorization();
            }
        }
    }

    function _isValidSignature(address signer, bytes32 digest, bytes calldata signature) private view returns (bool) {
        if (signer.code.length != 0) {
            (bool success, bytes memory result) =
                signer.staticcall(abi.encodeCall(IERC1271.isValidSignature, (digest, signature)));
            return success && result.length >= 32 && abi.decode(result, (bytes4)) == ERC1271_MAGIC_VALUE;
        }
        if (signature.length != 65) return false;
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        if (uint256(s) > uint256(SECP256K1_HALF_ORDER) || (v != 27 && v != 28)) return false;
        return ecrecover(digest, v, r, s) == signer;
    }

    function _componentSalt(bytes32 deploymentId, bytes32 tag, uint256 index) private pure returns (bytes32) {
        return keccak256(abi.encode(deploymentId, tag, index));
    }

    function _create2Address(bytes32 salt, bytes32 initCodeHash) private view returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, initCodeHash)))));
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

    function _safeApprove(address asset, address spender, uint256 amount) private {
        (bool success, bytes memory result) =
            asset.call(abi.encodeWithSignature("approve(address,uint256)", spender, amount));
        if (!success || (result.length != 0 && (result.length != 32 || !abi.decode(result, (bool))))) {
            revert TokenCallFailed();
        }
    }
}
