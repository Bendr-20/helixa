// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {FixedSupplySwarmToken} from "../src/missions/launch/FixedSupplySwarmToken.sol";
import {SwarmLaunchFactory} from "../src/missions/launch/SwarmLaunchFactory.sol";
import {SwarmContributionRegistry} from "../src/missions/launch/SwarmContributionRegistry.sol";
import {NonTransferableVestingStream} from "../src/missions/launch/NonTransferableVestingStream.sol";
import {PullRevenueSplitter} from "../src/missions/launch/PullRevenueSplitter.sol";

interface FactoryVm {
    function addr(uint256 privateKey) external returns (address);
    function chainId(uint256 newChainId) external;
    function expectRevert(bytes4 selector) external;
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
    function warp(uint256 timestamp) external;
}

contract FactoryPayee {
    receive() external payable {}
}

contract Factory1271Signer {
    bytes32 private allowedDigest;
    bytes32 private allowedSignatureHash;

    function allow(bytes32 digest, bytes calldata signature) external {
        allowedDigest = digest;
        allowedSignatureHash = keccak256(signature);
    }

    function isValidSignature(bytes32 digest, bytes calldata signature) external view returns (bytes4) {
        return digest == allowedDigest && keccak256(signature) == allowedSignatureHash ? bytes4(0x1626ba7e) : bytes4(0);
    }
}

contract ReentrantFactory1271Signer {
    address private target;
    bytes private payload;

    function configure(address target_, bytes calldata payload_) external {
        target = target_;
        payload = payload_;
    }

    function isValidSignature(bytes32, bytes calldata) external returns (bytes4) {
        (bool reentered,) = target.call(payload);
        return reentered ? bytes4(0) : bytes4(0x1626ba7e);
    }
}

contract SwarmLaunchFactoryTest {
    FactoryVm private constant VM = FactoryVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 private constant READINESS_HASH = keccak256("readiness");

    FactoryPayee private agentOne;
    FactoryPayee private agentTwo;
    FactoryPayee private agentThree;
    FactoryPayee private rewards;
    FactoryPayee private treasury;
    FactoryPayee private distribution;

    function setUp() external {
        VM.chainId(8453);
        agentOne = new FactoryPayee();
        agentTwo = new FactoryPayee();
        agentThree = new FactoryPayee();
        rewards = new FactoryPayee();
        treasury = new FactoryPayee();
        distribution = new FactoryPayee();
    }

    function testDeploysPredictedTokenAndExactlyAllocatesFullSupply() external {
        SwarmLaunchFactory factory = new SwarmLaunchFactory();
        (SwarmLaunchFactory.LaunchPlan memory plan, uint256[] memory keys) = _eoaPlan();
        bytes32 deploymentId = factory.computeDeploymentId(plan);
        bytes[] memory signatures = _sign(factory.authorizationDigest(deploymentId, plan.authorizationDeadline), keys);
        (address predictedToken, address predictedRegistry, address predictedSplitter, address[] memory predictedStreams) =
            factory.predict(plan);

        (address token, address registry, address splitter, address[] memory streams) = factory.deploy(plan, signatures);
        require(token == predictedToken && registry == predictedRegistry && splitter == predictedSplitter, "CREATE2 mismatch");
        require(streams.length == 3, "wrong stream count");
        FixedSupplySwarmToken launched = FixedSupplySwarmToken(token);
        require(launched.totalSupply() == 10_003 && launched.decimals() == 18, "token terms mismatch");
        require(launched.readinessHash() == READINESS_HASH && launched.deploymentId() == deploymentId, "root mismatch");
        for (uint256 index; index < streams.length; ++index) {
            require(streams[index] == predictedStreams[index], "stream prediction mismatch");
            require(NonTransferableVestingStream(streams[index]).funded(), "stream not atomically funded");
            require(launched.balanceOf(streams[index]) == plan.vestingAmounts[index], "stream balance mismatch");
        }
        require(launched.balanceOf(address(rewards)) == 1_500, "rewards mismatch");
        require(launched.balanceOf(address(treasury)) == 1_500, "treasury mismatch");
        require(launched.balanceOf(address(distribution)) == 2_502, "distribution mismatch");
        require(launched.balanceOf(address(factory)) == 0, "factory retained tokens");
        require(factory.tokenOf(deploymentId) == token, "token not recorded");
        require(SwarmContributionRegistry(registry).readinessHash() == READINESS_HASH, "registry root mismatch");
        require(PullRevenueSplitter(payable(splitter)).readinessHash() == READINESS_HASH, "splitter root mismatch");

        VM.expectRevert(SwarmLaunchFactory.AlreadyDeployed.selector);
        factory.deploy(plan, signatures);
    }

    function testRequiresUnanimousExactAuthorizationAndExpiry() external {
        SwarmLaunchFactory factory = new SwarmLaunchFactory();
        (SwarmLaunchFactory.LaunchPlan memory plan, uint256[] memory keys) = _eoaPlan();
        bytes32 digest = factory.authorizationDigest(factory.computeDeploymentId(plan), plan.authorizationDeadline);
        bytes[] memory signatures = new bytes[](2);
        signatures[0] = _signature(keys[0], digest);
        signatures[1] = _signature(keys[1], digest);
        VM.expectRevert(SwarmLaunchFactory.InvalidAuthorization.selector);
        factory.deploy(plan, signatures);

        signatures = _sign(digest, keys);
        signatures[1] = _signature(0xBAD, digest);
        VM.expectRevert(SwarmLaunchFactory.InvalidAuthorization.selector);
        factory.deploy(plan, signatures);

        signatures = _sign(digest, keys);
        VM.warp(plan.authorizationDeadline);
        VM.expectRevert(SwarmLaunchFactory.AuthorizationExpired.selector);
        factory.deploy(plan, signatures);
    }

    function testOneAuthorityCanAuthorizeThreeOwnedMemberContributions() external {
        SwarmLaunchFactory factory = new SwarmLaunchFactory();
        uint256 key = 0xA11CE;
        address[] memory signers = new address[](1);
        signers[0] = VM.addr(key);
        SwarmLaunchFactory.LaunchPlan memory plan = _basePlan(signers);
        bytes32 digest = factory.authorizationDigest(factory.computeDeploymentId(plan), plan.authorizationDeadline);
        bytes[] memory signatures = new bytes[](1);
        signatures[0] = _signature(key, digest);
        (address token,,,) = factory.deploy(plan, signatures);
        require(token != address(0) && plan.contributions.length == 3, "shared authority launch failed");
    }

    function testRejectsHighSEoaSignature() external {
        SwarmLaunchFactory factory = new SwarmLaunchFactory();
        (SwarmLaunchFactory.LaunchPlan memory plan, uint256[] memory keys) = _eoaPlan();
        bytes32 digest = factory.authorizationDigest(factory.computeDeploymentId(plan), plan.authorizationDeadline);
        bytes[] memory signatures = _sign(digest, keys);
        (uint8 v, bytes32 r, bytes32 s) = VM.sign(keys[0], digest);
        uint256 curveOrder = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;
        signatures[0] = abi.encodePacked(r, bytes32(curveOrder - uint256(s)), v == 27 ? uint8(28) : uint8(27));
        VM.expectRevert(SwarmLaunchFactory.InvalidAuthorization.selector);
        factory.deploy(plan, signatures);
    }

    function testMaliciousERC1271CannotReenterDeployment() external {
        SwarmLaunchFactory factory = new SwarmLaunchFactory();
        ReentrantFactory1271Signer[] memory wallets = new ReentrantFactory1271Signer[](3);
        address[] memory signers = new address[](3);
        for (uint256 index; index < 3; ++index) { wallets[index] = new ReentrantFactory1271Signer(); signers[index] = address(wallets[index]); }
        for (uint256 left; left < signers.length; ++left) {
            for (uint256 right = left + 1; right < signers.length; ++right) {
                if (signers[left] > signers[right]) {
                    (signers[left], signers[right]) = (signers[right], signers[left]);
                    (wallets[left], wallets[right]) = (wallets[right], wallets[left]);
                }
            }
        }
        SwarmLaunchFactory.LaunchPlan memory plan = _basePlan(signers);
        bytes[] memory empty = new bytes[](0);
        bytes memory reentry = abi.encodeCall(SwarmLaunchFactory.deploy, (plan, empty));
        bytes[] memory signatures = new bytes[](3);
        for (uint256 index; index < 3; ++index) { wallets[index].configure(address(factory), reentry); signatures[index] = hex"01"; }
        (address token,,,) = factory.deploy(plan, signatures);
        require(token != address(0), "outer ERC1271 deployment failed");
    }

    function testAcceptsThreeUnanimousERC1271Wallets() external {
        SwarmLaunchFactory factory = new SwarmLaunchFactory();
        Factory1271Signer[] memory wallets = new Factory1271Signer[](3);
        wallets[0] = new Factory1271Signer();
        wallets[1] = new Factory1271Signer();
        wallets[2] = new Factory1271Signer();
        address[] memory signers = new address[](3);
        signers[0] = address(wallets[0]);
        signers[1] = address(wallets[1]);
        signers[2] = address(wallets[2]);
        for (uint256 left; left < signers.length; ++left) {
            for (uint256 right = left + 1; right < signers.length; ++right) {
                if (signers[left] > signers[right]) {
                    (signers[left], signers[right]) = (signers[right], signers[left]);
                    (wallets[left], wallets[right]) = (wallets[right], wallets[left]);
                }
            }
        }
        SwarmLaunchFactory.LaunchPlan memory plan = _basePlan(signers);
        bytes32 digest = factory.authorizationDigest(factory.computeDeploymentId(plan), plan.authorizationDeadline);
        bytes[] memory signatures = new bytes[](3);
        for (uint256 index; index < 3; ++index) {
            signatures[index] = abi.encodePacked(bytes1(uint8(index + 1)));
            wallets[index].allow(digest, signatures[index]);
        }
        (address token,,,) = factory.deploy(plan, signatures);
        require(token != address(0), "ERC1271 authorization failed");
    }

    function testRejectsNonBaseConstruction() external {
        VM.chainId(1);
        VM.expectRevert(SwarmLaunchFactory.WrongChain.selector);
        new SwarmLaunchFactory();
    }

    function _eoaPlan() private returns (SwarmLaunchFactory.LaunchPlan memory plan, uint256[] memory keys) {
        keys = new uint256[](3);
        keys[0] = 0xA11CE;
        keys[1] = 0xB0B;
        keys[2] = 0xCA11;
        address[] memory signers = new address[](3);
        for (uint256 index; index < 3; ++index) signers[index] = VM.addr(keys[index]);
        for (uint256 left; left < signers.length; ++left) {
            for (uint256 right = left + 1; right < signers.length; ++right) {
                if (signers[left] > signers[right]) {
                    (signers[left], signers[right]) = (signers[right], signers[left]);
                    (keys[left], keys[right]) = (keys[right], keys[left]);
                }
            }
        }
        plan = _basePlan(signers);
    }

    function _basePlan(address[] memory signers) private view returns (SwarmLaunchFactory.LaunchPlan memory plan) {
        SwarmContributionRegistry.Contribution[] memory contributions = new SwarmContributionRegistry.Contribution[](3);
        contributions[0] = SwarmContributionRegistry.Contribution(keccak256("agent-1"), address(agentOne), 3_333);
        contributions[1] = SwarmContributionRegistry.Contribution(keccak256("agent-2"), address(agentTwo), 3_333);
        contributions[2] = SwarmContributionRegistry.Contribution(keccak256("agent-3"), address(agentThree), 3_334);
        uint256[] memory vestingAmounts = new uint256[](3);
        vestingAmounts[0] = 1_500;
        vestingAmounts[1] = 1_500;
        vestingAmounts[2] = 1_501;
        PullRevenueSplitter.Share[] memory revenueShares = new PullRevenueSplitter.Share[](3);
        revenueShares[0] = PullRevenueSplitter.Share(address(agentOne), 5_000);
        revenueShares[1] = PullRevenueSplitter.Share(address(agentTwo), 3_000);
        revenueShares[2] = PullRevenueSplitter.Share(address(agentThree), 2_000);
        address[] memory assets = new address[](1);
        assets[0] = address(0);
        plan = SwarmLaunchFactory.LaunchPlan({
            readinessHash: READINESS_HASH,
            start: uint64(block.timestamp + 1 days),
            cliff: 180 days,
            duration: 540 days,
            authorizationDeadline: uint64(block.timestamp + 1 hours),
            deploymentSalt: keccak256("launch-1"),
            token: SwarmLaunchFactory.TokenTerms("Swarm Signal", "SIG", 18, 10_003),
            allocations: SwarmLaunchFactory.AllocationTerms({
                agentVestingBps: 4_500,
                credRewardsBps: 1_500,
                swarmTreasuryBps: 1_500,
                publicDistributionBps: 2_500,
                agentVestingAmount: 4_501,
                credRewardsAmount: 1_500,
                swarmTreasuryAmount: 1_500,
                publicDistributionAmount: 2_502,
                credRewardsRecipient: address(rewards),
                swarmTreasuryRecipient: address(treasury),
                publicDistributionRecipient: address(distribution)
            }),
            contributions: contributions,
            vestingAmounts: vestingAmounts,
            revenueShares: revenueShares,
            revenueAssets: assets,
            requiredSigners: signers
        });
    }

    function _sign(bytes32 digest, uint256[] memory keys) private returns (bytes[] memory signatures) {
        signatures = new bytes[](keys.length);
        for (uint256 index; index < keys.length; ++index) signatures[index] = _signature(keys[index], digest);
    }

    function _signature(uint256 key, bytes32 digest) private returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = VM.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }
}
