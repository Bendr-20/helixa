// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {FixedSupplySwarmToken} from "./FixedSupplySwarmToken.sol";
import {SwarmContributionRegistry} from "./SwarmContributionRegistry.sol";
import {NonTransferableVestingStream} from "./NonTransferableVestingStream.sol";
import {PullRevenueSplitter} from "./PullRevenueSplitter.sol";

interface IERC1271 {
    function isValidSignature(bytes32 digest, bytes calldata signature) external view returns (bytes4 magicValue);
}

/// @notice Deterministically creates and exactly allocates one immutable Base Swarm token launch.
/// @dev Every required authority signs the exact deployment ID. There is no owner, upgrade, recovery, or provider hook.
contract SwarmLaunchFactory {
    uint256 public constant BASE_CHAIN_ID = 8453;
    uint16 public constant TOTAL_BPS = 10_000;
    uint8 public constant MIN_MEMBERS = 3;
    uint8 public constant MAX_MEMBERS = 5;

    bytes32 public constant AUTHORIZATION_TYPEHASH =
        keccak256("SwarmLaunchExecution(bytes32 deploymentId,uint64 authorizationDeadline)");
    bytes32 private constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant NAME_HASH = keccak256("Helixa Swarm Launch");
    bytes32 private constant VERSION_HASH = keccak256("1");
    bytes32 private constant TOKEN_TAG = keccak256("FIXED_SUPPLY_TOKEN");
    bytes32 private constant REGISTRY_TAG = keccak256("CONTRIBUTION_REGISTRY");
    bytes32 private constant SPLITTER_TAG = keccak256("REVENUE_SPLITTER");
    bytes32 private constant STREAM_TAG = keccak256("VESTING_STREAM");
    bytes32 private constant SECP256K1_HALF_ORDER = 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0;
    bytes4 private constant ERC1271_MAGIC_VALUE = 0x1626ba7e;

    struct TokenTerms {
        string name;
        string symbol;
        uint8 decimals;
        uint256 totalSupply;
    }

    struct AllocationTerms {
        uint16 agentVestingBps;
        uint16 credRewardsBps;
        uint16 swarmTreasuryBps;
        uint16 publicDistributionBps;
        uint256 agentVestingAmount;
        uint256 credRewardsAmount;
        uint256 swarmTreasuryAmount;
        uint256 publicDistributionAmount;
        address credRewardsRecipient;
        address swarmTreasuryRecipient;
        address publicDistributionRecipient;
    }

    struct LaunchPlan {
        bytes32 readinessHash;
        uint64 start;
        uint64 cliff;
        uint64 duration;
        uint64 authorizationDeadline;
        bytes32 deploymentSalt;
        TokenTerms token;
        AllocationTerms allocations;
        SwarmContributionRegistry.Contribution[] contributions;
        uint256[] vestingAmounts;
        PullRevenueSplitter.Share[] revenueShares;
        address[] revenueAssets;
        address[] requiredSigners;
    }

    bytes32 public immutable DOMAIN_SEPARATOR;
    mapping(bytes32 => address) public tokenOf;
    mapping(bytes32 => address) public registryOf;
    mapping(bytes32 => address) public splitterOf;
    mapping(bytes32 => address[]) private deploymentStreams;
    uint256 private entered;

    error WrongChain();
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
        uint256 totalSupply
    );

    constructor() {
        if (block.chainid != BASE_CHAIN_ID) revert WrongChain();
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
                plan.start,
                plan.cliff,
                plan.duration,
                plan.authorizationDeadline,
                plan.deploymentSalt,
                keccak256(abi.encode(plan.token)),
                keccak256(abi.encode(plan.allocations)),
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
        returns (address token, address registry, address splitter, address[] memory streams)
    {
        _validatePlan(plan, false);
        bytes32 deploymentId = computeDeploymentId(plan);
        token = _predictToken(plan, deploymentId);
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
        streams = _predictStreams(plan, deploymentId, token);
    }

    function deploy(LaunchPlan calldata plan, bytes[] calldata signatures)
        external
        nonReentrant
        returns (address token, address registry, address splitter, address[] memory streams)
    {
        _validatePlan(plan, true);
        if (block.timestamp >= plan.authorizationDeadline) revert AuthorizationExpired();

        bytes32 deploymentId = computeDeploymentId(plan);
        if (tokenOf[deploymentId] != address(0)) revert AlreadyDeployed();
        _verifyAuthorizations(plan, authorizationDigest(deploymentId, plan.authorizationDeadline), signatures);
        tokenOf[deploymentId] = address(1);

        token = address(
            new FixedSupplySwarmToken{salt: _componentSalt(deploymentId, TOKEN_TAG, 0)}(
                plan.token.name,
                plan.token.symbol,
                plan.token.totalSupply,
                address(this),
                plan.readinessHash,
                deploymentId
            )
        );
        registry = address(
            new SwarmContributionRegistry{salt: _componentSalt(deploymentId, REGISTRY_TAG, 0)}(
                plan.readinessHash, plan.contributions
            )
        );

        uint256 count = plan.contributions.length;
        streams = new address[](count);
        for (uint256 index; index < count; ++index) {
            streams[index] = _deployAndFundStream(plan, deploymentId, token, index);
        }

        splitter = address(
            new PullRevenueSplitter{salt: _componentSalt(deploymentId, SPLITTER_TAG, 0)}(
                plan.readinessHash, plan.revenueShares, plan.revenueAssets
            )
        );
        _transferExact(token, plan.allocations.credRewardsRecipient, plan.allocations.credRewardsAmount);
        _transferExact(token, plan.allocations.swarmTreasuryRecipient, plan.allocations.swarmTreasuryAmount);
        _transferExact(token, plan.allocations.publicDistributionRecipient, plan.allocations.publicDistributionAmount);
        if (_balanceOf(token, address(this)) != 0) revert BalanceDeltaMismatch();

        tokenOf[deploymentId] = token;
        registryOf[deploymentId] = registry;
        splitterOf[deploymentId] = splitter;
        deploymentStreams[deploymentId] = streams;
        emit SwarmLaunchDeployed(
            deploymentId, plan.readinessHash, token, registry, splitter, streams, plan.token.totalSupply
        );
    }

    function streamCount(bytes32 deploymentId) external view returns (uint256) {
        return deploymentStreams[deploymentId].length;
    }

    function streamAt(bytes32 deploymentId, uint256 index) external view returns (address) {
        return deploymentStreams[deploymentId][index];
    }

    function _predictToken(LaunchPlan calldata plan, bytes32 deploymentId) private view returns (address) {
        return _create2Address(
            _componentSalt(deploymentId, TOKEN_TAG, 0),
            keccak256(
                abi.encodePacked(
                    type(FixedSupplySwarmToken).creationCode,
                    abi.encode(
                        plan.token.name,
                        plan.token.symbol,
                        plan.token.totalSupply,
                        address(this),
                        plan.readinessHash,
                        deploymentId
                    )
                )
            )
        );
    }

    function _predictStreams(LaunchPlan calldata plan, bytes32 deploymentId, address token)
        private
        view
        returns (address[] memory streams)
    {
        uint256 count = plan.contributions.length;
        streams = new address[](count);
        for (uint256 index; index < count; ++index) {
            streams[index] = _create2Address(
                _componentSalt(deploymentId, STREAM_TAG, index),
                keccak256(
                    abi.encodePacked(
                        type(NonTransferableVestingStream).creationCode,
                        abi.encode(
                            token,
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

    function _deployAndFundStream(LaunchPlan calldata plan, bytes32 deploymentId, address token, uint256 index)
        private
        returns (address streamAddress)
    {
        uint256 amount = plan.vestingAmounts[index];
        NonTransferableVestingStream stream = new NonTransferableVestingStream{
            salt: _componentSalt(deploymentId, STREAM_TAG, index)
        }(
            token,
            plan.contributions[index].beneficiary,
            amount,
            plan.start,
            plan.cliff,
            plan.duration,
            plan.readinessHash
        );
        streamAddress = address(stream);
        _safeApprove(token, streamAddress, amount);
        stream.fund(amount);
    }

    function _validatePlan(LaunchPlan calldata plan, bool enforceTime) private view {
        uint256 memberCount = plan.contributions.length;
        if (
            block.chainid != BASE_CHAIN_ID || plan.readinessHash == bytes32(0) || plan.deploymentSalt == bytes32(0)
                || memberCount < MIN_MEMBERS || memberCount > MAX_MEMBERS || plan.vestingAmounts.length != memberCount
                || plan.duration == 0 || plan.cliff > plan.duration
                || uint256(plan.start) + plan.duration > type(uint64).max || plan.authorizationDeadline >= plan.start
        ) revert InvalidPlan();
        if (enforceTime && plan.start <= block.timestamp) revert InvalidPlan();
        _validateTokenAndAllocation(plan.token, plan.allocations);
        _validateContributionsAndVesting(plan.contributions, plan.vestingAmounts, plan.allocations.agentVestingAmount);
        _validateRevenue(plan.revenueShares, plan.revenueAssets);
        _validateSigners(plan.requiredSigners, memberCount);
    }

    function _validateTokenAndAllocation(TokenTerms calldata token, AllocationTerms calldata allocation) private pure {
        uint256 nameLength = bytes(token.name).length;
        uint256 symbolLength = bytes(token.symbol).length;
        if (
            nameLength == 0 || nameLength > 64 || symbolLength < 2 || symbolLength > 10 || token.decimals != 18
                || token.totalSupply == 0
        ) revert InvalidPlan();
        if (
            allocation.agentVestingBps == 0 || allocation.credRewardsBps == 0 || allocation.swarmTreasuryBps == 0
                || allocation.publicDistributionBps == 0
                || uint256(allocation.agentVestingBps) + allocation.credRewardsBps + allocation.swarmTreasuryBps
                        + allocation.publicDistributionBps != TOTAL_BPS
        ) revert InvalidPlan();
        address cred = allocation.credRewardsRecipient;
        address treasury = allocation.swarmTreasuryRecipient;
        address distribution = allocation.publicDistributionRecipient;
        if (
            cred == address(0) || treasury == address(0) || distribution == address(0) || cred == treasury
                || cred == distribution || treasury == distribution
        ) revert InvalidPlan();

        uint256 allocated;
        uint256 expected = _shareOf(token.totalSupply, allocation.agentVestingBps);
        if (allocation.agentVestingAmount != expected || expected == 0) revert InvalidPlan();
        allocated += expected;
        expected = _shareOf(token.totalSupply, allocation.credRewardsBps);
        if (allocation.credRewardsAmount != expected || expected == 0) revert InvalidPlan();
        allocated += expected;
        expected = _shareOf(token.totalSupply, allocation.swarmTreasuryBps);
        if (allocation.swarmTreasuryAmount != expected || expected == 0) revert InvalidPlan();
        allocated += expected;
        expected = token.totalSupply - allocated;
        if (allocation.publicDistributionAmount != expected || expected == 0) revert InvalidPlan();
    }

    function _validateContributionsAndVesting(
        SwarmContributionRegistry.Contribution[] calldata contributions,
        uint256[] calldata vestingAmounts,
        uint256 totalVesting
    ) private pure {
        uint256 count = contributions.length;
        uint256 bpsSum;
        uint256 allocated;
        for (uint256 index; index < count; ++index) {
            SwarmContributionRegistry.Contribution calldata contribution = contributions[index];
            if (contribution.agentKey == bytes32(0) || contribution.beneficiary == address(0) || contribution.bps == 0)
            {
                revert InvalidPlan();
            }
            for (uint256 prior; prior < index; ++prior) {
                if (contributions[prior].agentKey == contribution.agentKey) revert InvalidPlan();
            }
            bpsSum += contribution.bps;
            uint256 expected = index + 1 == count ? totalVesting - allocated : _shareOf(totalVesting, contribution.bps);
            if (vestingAmounts[index] != expected || expected == 0) revert InvalidPlan();
            allocated += expected;
        }
        if (bpsSum != TOTAL_BPS || allocated != totalVesting) revert InvalidPlan();
    }

    function _validateRevenue(PullRevenueSplitter.Share[] calldata shares, address[] calldata assets) private view {
        uint256 shareCount = shares.length;
        uint256 assetCount = assets.length;
        if (shareCount < 2 || shareCount > 32 || assetCount == 0 || assetCount > 8) revert InvalidPlan();
        uint256 bpsSum;
        for (uint256 index; index < shareCount; ++index) {
            if (shares[index].payee == address(0) || shares[index].bps == 0) revert InvalidPlan();
            for (uint256 prior; prior < index; ++prior) {
                if (shares[prior].payee == shares[index].payee) revert InvalidPlan();
            }
            bpsSum += shares[index].bps;
        }
        if (bpsSum != TOTAL_BPS) revert InvalidPlan();
        for (uint256 index; index < assetCount; ++index) {
            address asset = assets[index];
            if (asset != address(0) && asset.code.length == 0) revert InvalidPlan();
            for (uint256 prior; prior < index; ++prior) {
                if (assets[prior] == asset) revert InvalidPlan();
            }
        }
    }

    function _validateSigners(address[] calldata signers, uint256 memberCount) private pure {
        uint256 signerCount = signers.length;
        if (signerCount == 0 || signerCount > memberCount) revert InvalidPlan();
        address previous;
        for (uint256 index; index < signerCount; ++index) {
            address signer = signers[index];
            if (signer == address(0) || signer <= previous) revert InvalidPlan();
            previous = signer;
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

    function _transferExact(address token, address recipient, uint256 amount) private {
        uint256 factoryBefore = _balanceOf(token, address(this));
        uint256 recipientBefore = _balanceOf(token, recipient);
        _safeTransfer(token, recipient, amount);
        if (
            factoryBefore - _balanceOf(token, address(this)) != amount
                || _balanceOf(token, recipient) - recipientBefore != amount
        ) revert BalanceDeltaMismatch();
    }

    function _shareOf(uint256 amount, uint16 bps) private pure returns (uint256) {
        uint256 quotient = amount / TOTAL_BPS;
        uint256 remainder = amount % TOTAL_BPS;
        return quotient * bps + (remainder * bps) / TOTAL_BPS;
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

    function _safeTransfer(address asset, address to, uint256 amount) private {
        (bool success, bytes memory result) =
            asset.call(abi.encodeWithSignature("transfer(address,uint256)", to, amount));
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
