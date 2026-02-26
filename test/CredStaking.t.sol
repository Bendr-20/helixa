// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/CredStaking.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Mock ERC20 for testing
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

    address public owner = address(this);
    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);

    uint256 public constant TOKEN_ID_0 = 0;
    uint256 public constant TOKEN_ID_1 = 1;
    uint256 public constant TOKEN_ID_99 = 99;

    function setUp() public {
        cred = new MockCRED();
        staking = new CredStaking(address(cred));

        // Fund users
        cred.transfer(alice, 200_000e18);
        cred.transfer(bob, 200_000e18);

        // Approve staking contract
        vm.prank(alice);
        cred.approve(address(staking), type(uint256).max);
        vm.prank(bob);
        cred.approve(address(staking), type(uint256).max);
    }

    // ─── Staking ────────────────────────────────────────────────

    function test_stake_basic() public {
        vm.prank(alice);
        staking.stake(TOKEN_ID_0, 100e18);

        (uint256 amount, uint256 stakedAt) = staking.getStake(alice, TOKEN_ID_0);
        assertEq(amount, 100e18);
        assertEq(stakedAt, block.timestamp);
        assertEq(staking.getTotalStaked(TOKEN_ID_0), 100e18);
    }

    function test_stake_emits_event() public {
        vm.expectEmit(true, true, false, true);
        emit CredStaking.Staked(alice, TOKEN_ID_0, 500e18);

        vm.prank(alice);
        staking.stake(TOKEN_ID_0, 500e18);
    }

    function test_stake_multiple_users() public {
        vm.prank(alice);
        staking.stake(TOKEN_ID_0, 100e18);

        vm.prank(bob);
        staking.stake(TOKEN_ID_0, 200e18);

        assertEq(staking.getTotalStaked(TOKEN_ID_0), 300e18);

        (uint256 aliceAmt,) = staking.getStake(alice, TOKEN_ID_0);
        (uint256 bobAmt,) = staking.getStake(bob, TOKEN_ID_0);
        assertEq(aliceAmt, 100e18);
        assertEq(bobAmt, 200e18);
    }

    function test_stake_multiple_agents() public {
        vm.startPrank(alice);
        staking.stake(TOKEN_ID_0, 100e18);
        staking.stake(TOKEN_ID_1, 200e18);
        vm.stopPrank();

        assertEq(staking.getTotalStaked(TOKEN_ID_0), 100e18);
        assertEq(staking.getTotalStaked(TOKEN_ID_1), 200e18);
    }

    function test_stake_additional_resets_lock() public {
        vm.startPrank(alice);
        staking.stake(TOKEN_ID_0, 100e18);

        uint256 t1 = block.timestamp;
        vm.warp(t1 + 3 days);

        staking.stake(TOKEN_ID_0, 50e18);
        vm.stopPrank();

        (uint256 amount, uint256 stakedAt) = staking.getStake(alice, TOKEN_ID_0);
        assertEq(amount, 150e18);
        assertEq(stakedAt, t1 + 3 days); // lock reset
    }

    function test_stake_reverts_zero() public {
        vm.prank(alice);
        vm.expectRevert(CredStaking.ZeroAmount.selector);
        staking.stake(TOKEN_ID_0, 0);
    }

    function test_stake_reverts_paused() public {
        staking.setPaused(true);

        vm.prank(alice);
        vm.expectRevert(CredStaking.ContractPaused.selector);
        staking.stake(TOKEN_ID_0, 100e18);
    }

    // ─── Unstaking ──────────────────────────────────────────────

    function test_unstake_after_lock() public {
        vm.prank(alice);
        staking.stake(TOKEN_ID_0, 100e18);

        vm.warp(block.timestamp + 7 days);

        uint256 balBefore = cred.balanceOf(alice);
        vm.prank(alice);
        staking.unstake(TOKEN_ID_0, 100e18);

        assertEq(cred.balanceOf(alice) - balBefore, 100e18);
        (uint256 amount,) = staking.getStake(alice, TOKEN_ID_0);
        assertEq(amount, 0);
        assertEq(staking.getTotalStaked(TOKEN_ID_0), 0);
    }

    function test_unstake_partial() public {
        vm.prank(alice);
        staking.stake(TOKEN_ID_0, 100e18);

        vm.warp(block.timestamp + 7 days);

        vm.prank(alice);
        staking.unstake(TOKEN_ID_0, 40e18);

        (uint256 amount,) = staking.getStake(alice, TOKEN_ID_0);
        assertEq(amount, 60e18);
        assertEq(staking.getTotalStaked(TOKEN_ID_0), 60e18);
    }

    function test_unstake_emits_event() public {
        vm.prank(alice);
        staking.stake(TOKEN_ID_0, 100e18);

        vm.warp(block.timestamp + 7 days);

        vm.expectEmit(true, true, false, true);
        emit CredStaking.Unstaked(alice, TOKEN_ID_0, 100e18);

        vm.prank(alice);
        staking.unstake(TOKEN_ID_0, 100e18);
    }

    function test_unstake_reverts_before_lock() public {
        vm.prank(alice);
        staking.stake(TOKEN_ID_0, 100e18);

        vm.warp(block.timestamp + 6 days);

        vm.prank(alice);
        vm.expectRevert(CredStaking.LockNotExpired.selector);
        staking.unstake(TOKEN_ID_0, 100e18);
    }

    function test_unstake_reverts_insufficient() public {
        vm.prank(alice);
        staking.stake(TOKEN_ID_0, 100e18);

        vm.warp(block.timestamp + 7 days);

        vm.prank(alice);
        vm.expectRevert(CredStaking.InsufficientStake.selector);
        staking.unstake(TOKEN_ID_0, 200e18);
    }

    function test_unstake_reverts_zero() public {
        vm.prank(alice);
        vm.expectRevert(CredStaking.ZeroAmount.selector);
        staking.unstake(TOKEN_ID_0, 0);
    }

    // ─── Lock period edge: restaking resets lock ────────────────

    function test_restake_resets_lock_blocks_unstake() public {
        vm.startPrank(alice);
        staking.stake(TOKEN_ID_0, 100e18);

        // Warp to 6 days, stake more → lock resets
        vm.warp(block.timestamp + 6 days);
        staking.stake(TOKEN_ID_0, 50e18);

        // 1 day later (7 from first, 1 from second) → still locked
        vm.warp(block.timestamp + 1 days);
        vm.expectRevert(CredStaking.LockNotExpired.selector);
        staking.unstake(TOKEN_ID_0, 50e18);

        // 6 more days (7 total from restake) → unlocked
        vm.warp(block.timestamp + 6 days + 1);
        staking.unstake(TOKEN_ID_0, 150e18);
        vm.stopPrank();

        (uint256 amount,) = staking.getStake(alice, TOKEN_ID_0);
        assertEq(amount, 0);
    }

    // ─── Cred Boost ─────────────────────────────────────────────

    function test_boost_zero_when_no_stake() public view {
        assertEq(staking.getCredBoost(TOKEN_ID_0), 0);
    }

    function test_boost_increases_with_stake() public {
        vm.prank(alice);
        staking.stake(TOKEN_ID_0, 100e18);
        uint256 boost1 = staking.getCredBoost(TOKEN_ID_0);

        vm.prank(bob);
        staking.stake(TOKEN_ID_0, 900e18);
        uint256 boost2 = staking.getCredBoost(TOKEN_ID_0);

        assertTrue(boost2 > boost1, "More stake should give more boost");
    }

    function test_boost_max_at_cap() public {
        // Stake exactly at cap
        vm.prank(alice);
        staking.stake(TOKEN_ID_0, 100_000e18);

        assertEq(staking.getCredBoost(TOKEN_ID_0), 15);
    }

    function test_boost_max_above_cap() public {
        vm.prank(alice);
        staking.stake(TOKEN_ID_0, 200_000e18);

        assertEq(staking.getCredBoost(TOKEN_ID_0), 15);
    }

    function test_boost_logarithmic_curve() public {
        // Small stake: should give modest boost
        vm.prank(alice);
        staking.stake(TOKEN_ID_0, 1000e18);
        uint256 boostSmall = staking.getCredBoost(TOKEN_ID_0);

        // 10x more stake should NOT give 10x more boost (logarithmic)
        vm.prank(bob);
        staking.stake(TOKEN_ID_1, 10_000e18);
        uint256 boostMedium = staking.getCredBoost(TOKEN_ID_1);

        assertTrue(boostSmall > 0, "Small stake should have boost");
        assertTrue(boostMedium > boostSmall, "More stake = more boost");
        assertTrue(boostMedium < boostSmall * 10, "Should be sublinear (log curve)");
    }

    function test_boost_reasonable_values() public {
        // 1000 CRED → expect some boost (log curve, exact value depends on implementation)
        vm.prank(alice);
        staking.stake(TOKEN_ID_0, 1000e18);
        uint256 b = staking.getCredBoost(TOKEN_ID_0);
        assertTrue(b >= 1 && b <= 12, "1000 CRED boost should be moderate");

        // 10000 CRED → higher boost
        vm.prank(alice);
        staking.stake(TOKEN_ID_1, 10_000e18);
        uint256 b2 = staking.getCredBoost(TOKEN_ID_1);
        assertTrue(b2 > b && b2 <= 15, "10000 CRED boost should be higher");
    }

    // ─── Emergency Withdraw ─────────────────────────────────────

    function test_emergency_withdraw() public {
        vm.prank(alice);
        staking.stake(TOKEN_ID_0, 100e18);

        uint256 balBefore = cred.balanceOf(alice);

        // Owner can emergency withdraw (no lock check)
        staking.emergencyWithdraw(alice, TOKEN_ID_0);

        assertEq(cred.balanceOf(alice) - balBefore, 100e18);
        (uint256 amount,) = staking.getStake(alice, TOKEN_ID_0);
        assertEq(amount, 0);
        assertEq(staking.getTotalStaked(TOKEN_ID_0), 0);
    }

    function test_emergency_withdraw_reverts_nonOwner() public {
        vm.prank(alice);
        staking.stake(TOKEN_ID_0, 100e18);

        vm.prank(alice);
        vm.expectRevert();
        staking.emergencyWithdraw(alice, TOKEN_ID_0);
    }

    function test_emergency_withdraw_reverts_zero() public {
        vm.expectRevert(CredStaking.ZeroAmount.selector);
        staking.emergencyWithdraw(alice, TOKEN_ID_0);
    }

    // ─── Pause ──────────────────────────────────────────────────

    function test_pause_unpause() public {
        staking.setPaused(true);
        assertTrue(staking.paused());

        staking.setPaused(false);
        assertFalse(staking.paused());
    }

    function test_pause_only_owner() public {
        vm.prank(alice);
        vm.expectRevert();
        staking.setPaused(true);
    }

    function test_unstake_works_when_paused() public {
        vm.prank(alice);
        staking.stake(TOKEN_ID_0, 100e18);

        staking.setPaused(true);
        vm.warp(block.timestamp + 7 days);

        // Unstake should still work when paused (don't trap funds)
        vm.prank(alice);
        staking.unstake(TOKEN_ID_0, 100e18);
    }

    // ─── Token transfer safety ──────────────────────────────────

    function test_tokens_held_by_contract() public {
        vm.prank(alice);
        staking.stake(TOKEN_ID_0, 100e18);

        assertEq(cred.balanceOf(address(staking)), 100e18);
    }
}
