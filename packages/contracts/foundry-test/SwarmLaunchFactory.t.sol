// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {SwarmLaunchFactory} from "../src/missions/launch/SwarmLaunchFactory.sol";
import {SwarmContributionRegistry} from "../src/missions/launch/SwarmContributionRegistry.sol";
import {NonTransferableVestingStream} from "../src/missions/launch/NonTransferableVestingStream.sol";
import {PullRevenueSplitter} from "../src/missions/launch/PullRevenueSplitter.sol";

interface FactoryVm {
    function addr(uint256 privateKey) external returns (address);
    function expectRevert(bytes4 selector) external;
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
    function warp(uint256 timestamp) external;
}

contract FactoryToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
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

contract SwarmLaunchFactoryTest {
    FactoryVm private constant VM = FactoryVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 private constant READINESS_HASH = keccak256("readiness");

    FactoryToken private token;
    FactoryPayee private agent;
    FactoryPayee private treasury;
    FactoryPayee private rewards;

    function setUp() external {
        token = new FactoryToken();
        agent = new FactoryPayee();
        treasury = new FactoryPayee();
        rewards = new FactoryPayee();
    }

    function testDeploysPredictedFullyFundedExecutionAtomically() external {
        SwarmLaunchFactory factory = new SwarmLaunchFactory();
        (SwarmLaunchFactory.LaunchPlan memory plan, uint256[] memory keys) = _plan();
        bytes32 deploymentId = factory.computeDeploymentId(plan);
        bytes[] memory signatures = _sign(factory.authorizationDigest(deploymentId, plan.authorizationDeadline), keys);
        (address predictedRegistry, address predictedSplitter, address[] memory predictedStreams) =
            factory.predict(plan);

        token.mint(address(this), 4_500);
        token.approve(address(factory), 4_500);
        (address registry, address splitter, address[] memory streams) = factory.deploy(plan, signatures);

        require(registry == predictedRegistry && splitter == predictedSplitter, "core CREATE2 prediction mismatch");
        require(streams.length == 3, "wrong stream count");
        for (uint256 index; index < streams.length; ++index) {
            require(streams[index] == predictedStreams[index], "stream CREATE2 prediction mismatch");
            require(NonTransferableVestingStream(streams[index]).funded(), "stream not funded atomically");
            require(token.balanceOf(streams[index]) == plan.vestingAmounts[index], "stream funding mismatch");
        }
        require(token.balanceOf(address(factory)) == 0, "factory retained launch tokens");
        require(SwarmContributionRegistry(registry).readinessHash() == plan.readinessHash, "registry binding mismatch");
        require(
            PullRevenueSplitter(payable(splitter)).readinessHash() == plan.readinessHash, "splitter binding mismatch"
        );
        require(
            factory.registryOf(deploymentId) == registry && factory.splitterOf(deploymentId) == splitter,
            "deployment not recorded"
        );

        VM.expectRevert(SwarmLaunchFactory.AlreadyDeployed.selector);
        factory.deploy(plan, signatures);
    }

    function testRejectsMissingOrInvalidExecutionConsent() external {
        SwarmLaunchFactory factory = new SwarmLaunchFactory();
        (SwarmLaunchFactory.LaunchPlan memory plan, uint256[] memory keys) = _plan();
        bytes32 digest = factory.authorizationDigest(factory.computeDeploymentId(plan), plan.authorizationDeadline);
        bytes[] memory signatures = new bytes[](1);
        signatures[0] = _signature(keys[0], digest);
        VM.expectRevert(SwarmLaunchFactory.InvalidAuthorization.selector);
        factory.deploy(plan, signatures);

        signatures = _sign(digest, keys);
        signatures[1] = _signature(0xBAD, digest);
        VM.expectRevert(SwarmLaunchFactory.InvalidAuthorization.selector);
        factory.deploy(plan, signatures);
    }

    function testAcceptsContractWalletExecutionConsent() external {
        SwarmLaunchFactory factory = new SwarmLaunchFactory();
        Factory1271Signer contractSigner = new Factory1271Signer();
        (SwarmLaunchFactory.LaunchPlan memory plan,) = _plan();
        plan.requiredSigners = new address[](1);
        plan.requiredSigners[0] = address(contractSigner);
        bytes32 deploymentId = factory.computeDeploymentId(plan);
        bytes memory signature = hex"010203";
        contractSigner.allow(factory.authorizationDigest(deploymentId, plan.authorizationDeadline), signature);
        bytes[] memory signatures = new bytes[](1);
        signatures[0] = signature;

        token.mint(address(this), 4_500);
        token.approve(address(factory), 4_500);
        (address registry,,) = factory.deploy(plan, signatures);
        require(registry != address(0), "contract-wallet authorization failed");
    }

    function testRejectsExpiredAuthorization() external {
        SwarmLaunchFactory factory = new SwarmLaunchFactory();
        (SwarmLaunchFactory.LaunchPlan memory plan, uint256[] memory keys) = _plan();
        bytes32 digest = factory.authorizationDigest(factory.computeDeploymentId(plan), plan.authorizationDeadline);
        bytes[] memory signatures = _sign(digest, keys);
        VM.warp(plan.authorizationDeadline);
        VM.expectRevert(SwarmLaunchFactory.AuthorizationExpired.selector);
        factory.deploy(plan, signatures);
    }

    function _plan() private returns (SwarmLaunchFactory.LaunchPlan memory plan, uint256[] memory keys) {
        keys = new uint256[](2);
        keys[0] = 0xA11CE;
        keys[1] = 0xB0B;
        address first = VM.addr(keys[0]);
        address second = VM.addr(keys[1]);
        if (first > second) {
            (first, second) = (second, first);
            (keys[0], keys[1]) = (keys[1], keys[0]);
        }

        SwarmContributionRegistry.Contribution[] memory contributions = new SwarmContributionRegistry.Contribution[](3);
        contributions[0] = SwarmContributionRegistry.Contribution(keccak256("agent-1"), address(agent), 4_000);
        contributions[1] = SwarmContributionRegistry.Contribution(keccak256("agent-2"), address(treasury), 3_500);
        contributions[2] = SwarmContributionRegistry.Contribution(keccak256("agent-3"), address(rewards), 2_500);

        uint256[] memory vestingAmounts = new uint256[](3);
        vestingAmounts[0] = 1_800;
        vestingAmounts[1] = 1_575;
        vestingAmounts[2] = 1_125;

        PullRevenueSplitter.Share[] memory revenueShares = new PullRevenueSplitter.Share[](3);
        revenueShares[0] = PullRevenueSplitter.Share(address(agent), 8_000);
        revenueShares[1] = PullRevenueSplitter.Share(address(treasury), 1_000);
        revenueShares[2] = PullRevenueSplitter.Share(address(rewards), 1_000);

        address[] memory assets = new address[](2);
        assets[0] = address(0);
        assets[1] = address(token);
        address[] memory signers = new address[](2);
        signers[0] = first;
        signers[1] = second;

        plan = SwarmLaunchFactory.LaunchPlan({
            readinessHash: READINESS_HASH,
            token: address(token),
            start: uint64(block.timestamp + 1 days),
            cliff: 180 days,
            duration: 540 days,
            authorizationDeadline: uint64(block.timestamp + 1 hours),
            deploymentSalt: keccak256("launch-1"),
            contributions: contributions,
            vestingAmounts: vestingAmounts,
            revenueShares: revenueShares,
            revenueAssets: assets,
            requiredSigners: signers
        });
    }

    function _sign(bytes32 digest, uint256[] memory keys) private returns (bytes[] memory signatures) {
        signatures = new bytes[](keys.length);
        for (uint256 index; index < keys.length; ++index) {
            signatures[index] = _signature(keys[index], digest);
        }
    }

    function _signature(uint256 key, bytes32 digest) private returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = VM.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }
}
