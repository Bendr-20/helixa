// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/CredStaking.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockCRED is ERC20 {
    constructor() ERC20("CRED", "CRED") {
        _mint(msg.sender, 1_000_000e18);
    }
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract CredStakingTest is Test {
    CredStaking public staking;
    MockCRED public cred;
    address public treasury = address(0xBEEF);
    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);
    uint256 public agentId = 42;

    function setUp() public {
        cred = new MockCRED();
        staking = new CredStaking(address(cred), treasury);
        cred.transfer(alice, 10_000e18);
        cred.transfer(bob, 10_000e18);
        vm.prank(alice);
        cred.approve(address(staking), type(uint256).max);
        vm.prank(bob);
        cred.approve(address(staking), type(uint256).max);
    }

    // ─── Staking ────────────────────────────────────────────────

    function test_stake_basic() public {
        vm.prank(alice);
        staking.stake(agentId, 100e18);

        (uint256 amt, uint256 at, address s) = staking.getStake(agentId);
        assertEq(amt, 100e18);
        assertEq(s, alice);
        assertGt(at, 0);
        assertEq(staking.totalStaked(), 100e18);
    }

    function test_stake_updates_tier() public {
        vm.startPrank(alice);
        staking.stake(agentId, 99e18);
        assertEq(uint(staking.getTier(agentId)), uint(CredStaking.Tier.NONE));

        staking.stake(agentId, 1e18);
        assertEq(uint(staking.getTier(agentId)), uint(CredStaking.Tier.QUALIFIED));

        staking.stake(agentId, 400e18);
        assertEq(uint(staking.getTier(agentId)), uint(CredStaking.Tier.PRIME));

        staking.stake(agentId, 1500e18);
        assertEq(uint(staking.getTier(agentId)), uint(CredStaking.Tier.PREFERRED));
        vm.stopPrank();
    }

    function test_stake_zero_reverts() public {
        vm.prank(alice);
        vm.expectRevert(CredStaking.ZeroAmount.selector);
        staking.stake(agentId, 0);
    }

    function test_stake_paused_reverts() public {
        staking.setPaused(true);
        vm.prank(alice);
        vm.expectRevert(CredStaking.ContractPaused.selector);
        staking.stake(agentId, 100e18);
    }

    function test_stake_different_user_same_agent_reverts() public {
        vm.prank(alice);
        staking.stake(agentId, 100e18);
        vm.prank(bob);
        vm.expectRevert(CredStaking.AgentAlreadyStakedByOther.selector);
        staking.stake(agentId, 100e18);
    }

    // ─── Unstaking ──────────────────────────────────────────────

    function test_unstake_after_lock() public {
        vm.prank(alice);
        staking.stake(agentId, 500e18);

        vm.warp(block.timestamp + 7 days);
        uint256 balBefore = cred.balanceOf(alice);
        vm.prank(alice);
        staking.unstake(agentId, 500e18);

        assertEq(cred.balanceOf(alice), balBefore + 500e18);
        assertEq(cred.balanceOf(treasury), 0); // no penalty
        assertEq(staking.totalStaked(), 0);
    }

    function test_unstake_early_penalty() public {
        vm.prank(alice);
        staking.stake(agentId, 1000e18);

        vm.warp(block.timestamp + 3 days); // before lock
        uint256 balBefore = cred.balanceOf(alice);
        vm.prank(alice);
        staking.unstake(agentId, 1000e18);

        uint256 penalty = 100e18; // 10%
        assertEq(cred.balanceOf(alice), balBefore + 1000e18 - penalty);
        assertEq(cred.balanceOf(treasury), penalty);
    }

    function test_unstake_partial() public {
        vm.prank(alice);
        staking.stake(agentId, 2000e18);
        vm.warp(block.timestamp + 7 days);

        vm.prank(alice);
        staking.unstake(agentId, 500e18);

        (uint256 amt,,) = staking.getStake(agentId);
        assertEq(amt, 1500e18);
        assertEq(staking.totalStaked(), 1500e18);
    }

    function test_unstake_not_staker_reverts() public {
        vm.prank(alice);
        staking.stake(agentId, 100e18);
        vm.prank(bob);
        vm.expectRevert(CredStaking.NotStaker.selector);
        staking.unstake(agentId, 100e18);
    }

    function test_unstake_insufficient_reverts() public {
        vm.prank(alice);
        staking.stake(agentId, 100e18);
        vm.warp(block.timestamp + 7 days);
        vm.prank(alice);
        vm.expectRevert(CredStaking.InsufficientStake.selector);
        staking.unstake(agentId, 200e18);
    }

    // ─── Slash ──────────────────────────────────────────────────

    function test_slash() public {
        vm.prank(alice);
        staking.stake(agentId, 2000e18);

        staking.slash(agentId);

        assertEq(cred.balanceOf(treasury), 2000e18);
        assertEq(staking.totalStaked(), 0);
        (uint256 amt,,address s) = staking.getStake(agentId);
        assertEq(amt, 0);
        assertEq(s, address(0));
        assertEq(uint(staking.getTier(agentId)), uint(CredStaking.Tier.NONE));
    }

    function test_slash_nothing_reverts() public {
        vm.expectRevert(CredStaking.NothingToSlash.selector);
        staking.slash(agentId);
    }

    function test_slash_only_owner() public {
        vm.prank(alice);
        staking.stake(agentId, 100e18);
        vm.prank(alice);
        vm.expectRevert();
        staking.slash(agentId);
    }

    // ─── Views ──────────────────────────────────────────────────

    function test_boost_values() public {
        vm.startPrank(alice);
        staking.stake(agentId, 50e18);
        assertEq(staking.getBoost(agentId), 0);

        staking.stake(agentId, 50e18);
        assertEq(staking.getBoost(agentId), 10);

        staking.stake(agentId, 400e18);
        assertEq(staking.getBoost(agentId), 20);

        staking.stake(agentId, 1500e18);
        assertEq(staking.getBoost(agentId), 30);
        vm.stopPrank();
    }

    function test_tier_thresholds_exact() public {
        vm.startPrank(alice);
        staking.stake(1, 100e18);
        assertEq(uint(staking.getTier(1)), uint(CredStaking.Tier.QUALIFIED));

        staking.stake(2, 500e18);
        assertEq(uint(staking.getTier(2)), uint(CredStaking.Tier.PRIME));

        staking.stake(3, 2000e18);
        assertEq(uint(staking.getTier(3)), uint(CredStaking.Tier.PREFERRED));
        vm.stopPrank();
    }

    // ─── Events ─────────────────────────────────────────────────

    function test_stake_emits_events() public {
        vm.expectEmit(true, true, false, true);
        emit CredStaking.TierChanged(agentId, CredStaking.Tier.NONE, CredStaking.Tier.QUALIFIED);
        vm.expectEmit(true, true, false, true);
        emit CredStaking.Staked(alice, agentId, 100e18, CredStaking.Tier.QUALIFIED);
        vm.prank(alice);
        staking.stake(agentId, 100e18);
    }

    function test_unstake_emits_events() public {
        vm.prank(alice);
        staking.stake(agentId, 500e18);
        vm.warp(block.timestamp + 7 days);

        vm.expectEmit(true, true, false, true);
        emit CredStaking.TierChanged(agentId, CredStaking.Tier.PRIME, CredStaking.Tier.NONE);
        vm.expectEmit(true, true, false, true);
        emit CredStaking.Unstaked(alice, agentId, 500e18, 0);
        vm.prank(alice);
        staking.unstake(agentId, 500e18);
    }

    // ─── Edge cases ─────────────────────────────────────────────

    function test_restake_after_full_unstake() public {
        vm.startPrank(alice);
        staking.stake(agentId, 100e18);
        vm.warp(block.timestamp + 7 days);
        staking.unstake(agentId, 100e18);

        // Can stake again
        staking.stake(agentId, 200e18);
        (uint256 amt,,) = staking.getStake(agentId);
        assertEq(amt, 200e18);
        vm.stopPrank();
    }

    function test_bob_can_stake_after_alice_unstakes() public {
        vm.prank(alice);
        staking.stake(agentId, 100e18);
        vm.warp(block.timestamp + 7 days);
        vm.prank(alice);
        staking.unstake(agentId, 100e18);

        vm.prank(bob);
        staking.stake(agentId, 200e18);
        (,,address s) = staking.getStake(agentId);
        assertEq(s, bob);
    }

    function test_multiple_agents() public {
        vm.startPrank(alice);
        staking.stake(1, 100e18);
        staking.stake(2, 500e18);
        vm.stopPrank();

        assertEq(staking.totalStaked(), 600e18);
        assertEq(uint(staking.getTier(1)), uint(CredStaking.Tier.QUALIFIED));
        assertEq(uint(staking.getTier(2)), uint(CredStaking.Tier.PRIME));
    }
}
