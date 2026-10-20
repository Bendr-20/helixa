// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {SwarmContributionRegistry} from "../src/missions/launch/SwarmContributionRegistry.sol";
import {NonTransferableVestingStream} from "../src/missions/launch/NonTransferableVestingStream.sol";
import {PullRevenueSplitter} from "../src/missions/launch/PullRevenueSplitter.sol";

interface Vm {
    function deal(address account, uint256 balance) external;
    function expectRevert(bytes4 selector) external;
    function prank(address sender) external;
    function warp(uint256 timestamp) external;
}

contract LaunchToken {
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

contract PullActor {
    function release(PullRevenueSplitter splitter, address token) external {
        splitter.release(token);
    }

    receive() external payable {}
}

contract SwarmLaunchExecutionTest {
    Vm private constant VM = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 private constant READINESS_HASH = keccak256("readiness");

    LaunchToken private token;
    PullActor private agent;
    PullActor private treasury;
    PullActor private rewards;

    function setUp() external {
        token = new LaunchToken();
        agent = new PullActor();
        treasury = new PullActor();
        rewards = new PullActor();
    }

    function testContributionRegistryLocksCanonicalWeights() external {
        SwarmContributionRegistry.Contribution[] memory terms = new SwarmContributionRegistry.Contribution[](3);
        terms[0] = SwarmContributionRegistry.Contribution(keccak256("agent-1"), address(agent), 5_000);
        terms[1] = SwarmContributionRegistry.Contribution(keccak256("agent-2"), address(treasury), 3_000);
        terms[2] = SwarmContributionRegistry.Contribution(keccak256("agent-3"), address(rewards), 2_000);

        SwarmContributionRegistry registry = new SwarmContributionRegistry(READINESS_HASH, terms);

        require(registry.readinessHash() == READINESS_HASH, "readiness hash changed");
        require(registry.contributionCount() == 3, "wrong contribution count");
        require(registry.totalBps() == 10_000, "weights do not total 10000");
        (bytes32 agentKey, address beneficiary, uint16 bps) = registry.contributionAt(1);
        require(
            agentKey == keccak256("agent-2") && beneficiary == address(treasury) && bps == 3_000, "wrong stored terms"
        );
        require(registry.contributionBps(keccak256("agent-3")) == 2_000, "wrong indexed weight");

        (bool mutationSucceeded,) =
            address(registry).call(abi.encodeWithSignature("setContribution(bytes32,uint16)", keccak256("agent-1"), 1));
        require(!mutationSucceeded, "registry exposes mutation");
    }

    function testContributionRegistryRejectsInvalidOrDuplicateTerms() external {
        SwarmContributionRegistry.Contribution[] memory invalid = new SwarmContributionRegistry.Contribution[](2);
        invalid[0] = SwarmContributionRegistry.Contribution(keccak256("same"), address(agent), 6_000);
        invalid[1] = SwarmContributionRegistry.Contribution(keccak256("same"), address(treasury), 4_000);
        VM.expectRevert(SwarmContributionRegistry.InvalidContributions.selector);
        new SwarmContributionRegistry(READINESS_HASH, invalid);

        invalid[1] = SwarmContributionRegistry.Contribution(keccak256("other"), address(treasury), 3_999);
        VM.expectRevert(SwarmContributionRegistry.InvalidContributions.selector);
        new SwarmContributionRegistry(READINESS_HASH, invalid);
    }

    function testContributionRegistryAllowsAgentsToShareOneBeneficiary() external {
        SwarmContributionRegistry.Contribution[] memory terms = new SwarmContributionRegistry.Contribution[](2);
        terms[0] = SwarmContributionRegistry.Contribution(keccak256("agent-1"), address(agent), 6_000);
        terms[1] = SwarmContributionRegistry.Contribution(keccak256("agent-2"), address(agent), 4_000);
        SwarmContributionRegistry registry = new SwarmContributionRegistry(READINESS_HASH, terms);
        require(registry.contributionBps(keccak256("agent-1")) == 6_000, "first shared-owner weight wrong");
        require(registry.contributionBps(keccak256("agent-2")) == 4_000, "second shared-owner weight wrong");
    }

    function testVestingStreamCannotRedirectAndReleasesOnlyVestedTokens() external {
        uint64 start = uint64(block.timestamp + 100);
        NonTransferableVestingStream stream = new NonTransferableVestingStream(
            address(token), address(agent), 1_000 ether, start, 200, 1_000, READINESS_HASH
        );
        token.mint(address(this), 1_000 ether);
        token.approve(address(stream), 1_000 ether);
        stream.fund(1_000 ether);
        require(stream.funded(), "stream not funded");

        VM.warp(start + 199);
        require(stream.releasable() == 0, "released before cliff");
        VM.expectRevert(NonTransferableVestingStream.NothingToRelease.selector);
        stream.release();

        VM.warp(start + 500);
        require(stream.releasable() == 500 ether, "wrong linear vesting");
        stream.release();
        require(token.balanceOf(address(agent)) == 500 ether, "beneficiary not paid");

        (bool redirected,) =
            address(stream).call(abi.encodeWithSignature("transferBeneficiary(address)", address(treasury)));
        require(!redirected, "beneficiary is transferable");
        require(stream.beneficiary() == address(agent), "beneficiary changed");

        VM.warp(start + 1_000);
        stream.release();
        require(token.balanceOf(address(agent)) == 1_000 ether, "final vesting wrong");
        require(stream.released() == 1_000 ether && stream.outstanding() == 0, "liability not closed");
    }

    function testVestingStreamRejectsPartialOrRepeatedFunding() external {
        uint64 start = uint64(block.timestamp + 100);
        NonTransferableVestingStream stream =
            new NonTransferableVestingStream(address(token), address(agent), 100, start, 0, 100, READINESS_HASH);
        token.mint(address(this), 200);
        token.approve(address(stream), 200);
        VM.expectRevert(NonTransferableVestingStream.InvalidFunding.selector);
        stream.fund(99);
        stream.fund(100);
        VM.expectRevert(NonTransferableVestingStream.AlreadyFunded.selector);
        stream.fund(100);
    }

    function testPullSplitterAccruesAndPullsMultipleAssets() external {
        PullRevenueSplitter.Share[] memory shares = new PullRevenueSplitter.Share[](3);
        shares[0] = PullRevenueSplitter.Share(address(agent), 8_000);
        shares[1] = PullRevenueSplitter.Share(address(treasury), 1_000);
        shares[2] = PullRevenueSplitter.Share(address(rewards), 1_000);
        address[] memory assets = new address[](2);
        assets[0] = address(0);
        assets[1] = address(token);
        PullRevenueSplitter splitter = new PullRevenueSplitter(READINESS_HASH, shares, assets);

        token.mint(address(this), 1_000);
        token.approve(address(splitter), 1_000);
        splitter.deposit(address(token), 1_000);
        require(splitter.releasable(address(token), address(agent)) == 800, "agent token accrual wrong");
        require(splitter.releasable(address(token), address(treasury)) == 100, "treasury token accrual wrong");

        agent.release(splitter, address(token));
        treasury.release(splitter, address(token));
        rewards.release(splitter, address(token));
        require(token.balanceOf(address(agent)) == 800, "agent token pull wrong");
        require(token.balanceOf(address(treasury)) == 100, "treasury token pull wrong");
        require(token.balanceOf(address(rewards)) == 100, "rewards token pull wrong");
        require(splitter.totalReleased(address(token)) == 1_000, "token conservation failed");

        VM.deal(address(this), 1 ether);
        (bool sent,) = address(splitter).call{value: 1 ether}("");
        require(sent, "native deposit failed");
        agent.release(splitter, address(0));
        treasury.release(splitter, address(0));
        rewards.release(splitter, address(0));
        require(address(agent).balance == 0.8 ether, "agent native pull wrong");
        require(address(treasury).balance == 0.1 ether, "treasury native pull wrong");
        require(address(rewards).balance == 0.1 ether, "rewards native pull wrong");
        require(splitter.totalReleased(address(0)) == 1 ether, "native conservation failed");
    }

    function testPullSplitterRejectsPushesAndUnsupportedAssets() external {
        PullRevenueSplitter.Share[] memory shares = new PullRevenueSplitter.Share[](2);
        shares[0] = PullRevenueSplitter.Share(address(agent), 8_000);
        shares[1] = PullRevenueSplitter.Share(address(treasury), 2_000);
        address[] memory assets = new address[](1);
        assets[0] = address(token);
        PullRevenueSplitter splitter = new PullRevenueSplitter(READINESS_HASH, shares, assets);

        VM.expectRevert(PullRevenueSplitter.UnsupportedAsset.selector);
        splitter.deposit(address(0), 1);
        VM.expectRevert(PullRevenueSplitter.NotPayee.selector);
        splitter.release(address(token));

        (bool pushed,) = address(splitter).call(abi.encodeWithSignature("distribute(address)", address(token)));
        require(!pushed, "splitter exposes push distribution");
    }

    function testVestingMustBeFullyFundedBeforeStart() external {
        uint64 start = uint64(block.timestamp + 10);
        NonTransferableVestingStream stream =
            new NonTransferableVestingStream(address(token), address(agent), 100, start, 0, 100, READINESS_HASH);
        token.mint(address(this), 100);
        token.approve(address(stream), 100);
        VM.warp(start);
        VM.expectRevert(NonTransferableVestingStream.InvalidFunding.selector);
        stream.fund(100);
    }

    function testPullSplitterAccountsForRecurringAndDirectRevenue() external {
        PullRevenueSplitter.Share[] memory shares = new PullRevenueSplitter.Share[](2);
        shares[0] = PullRevenueSplitter.Share(address(agent), 6_000);
        shares[1] = PullRevenueSplitter.Share(address(treasury), 4_000);
        address[] memory assets = new address[](1);
        assets[0] = address(token);
        PullRevenueSplitter splitter = new PullRevenueSplitter(READINESS_HASH, shares, assets);

        token.mint(address(this), 2_000);
        token.approve(address(splitter), 1_667);
        splitter.deposit(address(token), 1_000);
        agent.release(splitter, address(token));
        treasury.release(splitter, address(token));

        require(token.transfer(address(splitter), 333), "direct revenue transfer failed");
        splitter.deposit(address(token), 667);
        require(splitter.totalReceived(address(token)) == 2_000, "recurring revenue not accounted");
        require(splitter.releasable(address(token), address(agent)) == 600, "second agent accrual wrong");
        require(splitter.releasable(address(token), address(treasury)) == 400, "second treasury accrual wrong");
        agent.release(splitter, address(token));
        treasury.release(splitter, address(token));
        require(token.balanceOf(address(agent)) == 1_200, "agent recurring pull wrong");
        require(token.balanceOf(address(treasury)) == 800, "treasury recurring pull wrong");
        require(token.balanceOf(address(splitter)) == 0, "splitter retained settled revenue");
    }
}
