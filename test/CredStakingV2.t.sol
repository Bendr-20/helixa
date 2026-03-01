// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/CredStakingV2.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// ─── Mock Contracts ──────────────────────────────────────────────────

contract MockCredOracle {
    mapping(uint256 => uint8) public scores;

    function setScore(uint256 tokenId, uint8 score) external {
        scores[tokenId] = score;
    }

    function getCredScore(uint256 tokenId) external view returns (uint8) {
        return scores[tokenId];
    }
}

contract MockCRED is ERC20 {
    constructor() ERC20("CRED", "CRED") {
        _mint(msg.sender, 1_000_000e18);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

// ─── Tests ───────────────────────────────────────────────────────────

contract CredStakingV2Test is Test {
    CredStakingV2 public staking;
    MockCredOracle public oracle;
    MockCRED public token;

    address owner = address(this);
    address treasury = address(0xBEEF);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    uint256 agent1 = 1;
    uint256 agent2 = 2;
    uint256 agent3 = 3;

    function setUp() public {
        oracle = new MockCredOracle();
        token = new MockCRED();
        staking = new CredStakingV2(address(token), treasury, address(oracle));

        // Fund users
        token.transfer(alice, 100_000e18);
        token.transfer(bob, 100_000e18);

        // Approve
        vm.prank(alice);
        token.approve(address(staking), type(uint256).max);
        vm.prank(bob);
        token.approve(address(staking), type(uint256).max);
        token.approve(address(staking), type(uint256).max); // owner
    }

    // ─── Tier classification ─────────────────────────────────────────

    function test_getTier() public view {
        assertEq(uint(staking.getTier(0)), uint(CredStakingV2.Tier.JUNK));
        assertEq(uint(staking.getTier(25)), uint(CredStakingV2.Tier.JUNK));
        assertEq(uint(staking.getTier(26)), uint(CredStakingV2.Tier.MARGINAL));
        assertEq(uint(staking.getTier(50)), uint(CredStakingV2.Tier.MARGINAL));
        assertEq(uint(staking.getTier(51)), uint(CredStakingV2.Tier.QUALIFIED));
        assertEq(uint(staking.getTier(75)), uint(CredStakingV2.Tier.QUALIFIED));
        assertEq(uint(staking.getTier(76)), uint(CredStakingV2.Tier.PRIME));
        assertEq(uint(staking.getTier(90)), uint(CredStakingV2.Tier.PRIME));
        assertEq(uint(staking.getTier(91)), uint(CredStakingV2.Tier.PREFERRED));
        assertEq(uint(staking.getTier(100)), uint(CredStakingV2.Tier.PREFERRED));
    }

    // ─── Cred-gated staking ─────────────────────────────────────────

    function test_junkCannotStake() public {
        oracle.setScore(agent1, 20);
        vm.prank(alice);
        vm.expectRevert("cred too low");
        staking.stake(agent1, 10e18);
    }

    function test_marginalMaxStake() public {
        oracle.setScore(agent1, 30);
        vm.prank(alice);
        staking.stake(agent1, 100e18);
        // Should revert if exceeding
        vm.prank(alice);
        vm.expectRevert("exceeds tier limit");
        staking.stake(agent1, 1e18);
    }

    function test_qualifiedMaxStake() public {
        oracle.setScore(agent1, 60);
        vm.prank(alice);
        staking.stake(agent1, 500e18);
        vm.prank(alice);
        vm.expectRevert("exceeds tier limit");
        staking.stake(agent1, 1e18);
    }

    function test_primeMaxStake() public {
        oracle.setScore(agent1, 80);
        vm.prank(alice);
        staking.stake(agent1, 2000e18);
        vm.prank(alice);
        vm.expectRevert("exceeds tier limit");
        staking.stake(agent1, 1e18);
    }

    function test_preferredUnlimited() public {
        oracle.setScore(agent1, 95);
        vm.prank(alice);
        staking.stake(agent1, 50_000e18);
        (,uint256 amt,,) = staking.stakes(agent1);
        assertEq(amt, 50_000e18);
    }

    // ─── Effective stake ─────────────────────────────────────────────

    function test_effectiveStake() public {
        oracle.setScore(agent1, 80);
        vm.prank(alice);
        staking.stake(agent1, 1000e18);
        // effective = 1000 * 80 / 50 = 1600
        assertEq(staking.effectiveStake(agent1), 1600e18);
    }

    // ─── Unstake without penalty (after lock) ────────────────────────

    function test_unstakeAfterLock() public {
        oracle.setScore(agent1, 60);
        vm.prank(alice);
        staking.stake(agent1, 200e18);

        vm.warp(block.timestamp + 7 days + 1);
        uint256 balBefore = token.balanceOf(alice);
        vm.prank(alice);
        staking.unstake(agent1, 200e18);
        assertEq(token.balanceOf(alice) - balBefore, 200e18);
        assertEq(token.balanceOf(treasury), 0);
    }

    // ─── Early unstake penalty ───────────────────────────────────────

    function test_earlyUnstakePenalty() public {
        oracle.setScore(agent1, 60);
        vm.prank(alice);
        staking.stake(agent1, 100e18);

        vm.warp(block.timestamp + 1 days); // still in lock
        uint256 balBefore = token.balanceOf(alice);
        vm.prank(alice);
        staking.unstake(agent1, 100e18);
        // 10% penalty = 10e18 to treasury, 90e18 to alice
        assertEq(token.balanceOf(alice) - balBefore, 90e18);
        assertEq(token.balanceOf(treasury), 10e18);
    }

    // ─── Cred decay flag ─────────────────────────────────────────────

    function test_credDecayFlag() public {
        oracle.setScore(agent1, 60);
        vm.prank(alice);
        staking.stake(agent1, 100e18);

        // Unstake before 30 days
        vm.warp(block.timestamp + 8 days);
        vm.prank(alice);
        staking.unstake(agent1, 100e18);
        assertTrue(staking.hasCredPenalty(agent1));

        // After penalty period
        vm.warp(block.timestamp + 30 days + 1);
        assertFalse(staking.hasCredPenalty(agent1));
    }

    function test_noCredDecayAfter30Days() public {
        oracle.setScore(agent1, 60);
        vm.prank(alice);
        staking.stake(agent1, 100e18);

        vm.warp(block.timestamp + 31 days);
        vm.prank(alice);
        staking.unstake(agent1, 100e18);
        assertFalse(staking.hasCredPenalty(agent1));
    }

    // ─── Vouching ────────────────────────────────────────────────────

    function test_vouch() public {
        oracle.setScore(agent1, 80);
        oracle.setScore(agent2, 60);

        vm.prank(alice);
        staking.vouch(agent1, agent2, 50e18);

        CredStakingV2.Vouch[] memory vouches = staking.getVouches(agent1);
        assertEq(vouches.length, 1);
        assertEq(vouches[0].voucher, alice);
        assertEq(vouches[0].amount, 50e18);
        assertEq(vouches[0].voucherCredAtVouch, 60);
    }

    function test_cannotSelfVouch() public {
        oracle.setScore(agent1, 80);
        vm.prank(alice);
        vm.expectRevert("cannot self-vouch");
        staking.vouch(agent1, agent1, 10e18);
    }

    function test_junkCannotVouch() public {
        oracle.setScore(agent1, 80);
        oracle.setScore(agent2, 10); // junk
        vm.prank(alice);
        vm.expectRevert("voucher cred too low");
        staking.vouch(agent1, agent2, 10e18);
    }

    function test_removeVouch() public {
        oracle.setScore(agent1, 80);
        oracle.setScore(agent2, 60);

        vm.prank(alice);
        staking.vouch(agent1, agent2, 50e18);

        uint256 balBefore = token.balanceOf(alice);
        vm.prank(alice);
        staking.removeVouch(agent1);
        assertEq(token.balanceOf(alice) - balBefore, 50e18);
        assertEq(staking.getVouchCount(agent1), 0);
    }

    function test_doubleVouchReverts() public {
        oracle.setScore(agent1, 80);
        oracle.setScore(agent2, 60);

        vm.prank(alice);
        staking.vouch(agent1, agent2, 50e18);
        vm.prank(alice);
        vm.expectRevert("already vouching");
        staking.vouch(agent1, agent2, 10e18);
    }

    // ─── Slashing ────────────────────────────────────────────────────

    function test_slash() public {
        oracle.setScore(agent1, 80);
        oracle.setScore(agent2, 60);

        // Stake on agent1
        vm.prank(alice);
        staking.stake(agent1, 500e18);

        // Bob vouches for agent1
        vm.prank(bob);
        staking.vouch(agent1, agent2, 100e18);

        uint256 treasuryBefore = token.balanceOf(treasury);
        staking.slash(agent1);

        // All 600e18 should go to treasury
        assertEq(token.balanceOf(treasury) - treasuryBefore, 600e18);
        (,uint256 amt,,) = staking.stakes(agent1);
        assertEq(amt, 0);
        assertEq(staking.getVouchCount(agent1), 0);
        assertTrue(staking.hasCredPenalty(agent1));
    }

    // ─── Revenue sharing ─────────────────────────────────────────────

    function test_revenueSharing() public {
        oracle.setScore(agent1, 50); // marginal, effective = amount * 50/50 = amount
        oracle.setScore(agent2, 100); // preferred, effective = amount * 100/50 = 2x

        vm.prank(alice);
        staking.stake(agent1, 100e18); // effective = 100e18

        vm.prank(bob);
        staking.stake(agent2, 100e18); // effective = 200e18

        // Total effective = 300e18
        // Deposit 300e18 rewards
        token.approve(address(staking), type(uint256).max);
        staking.depositRewards(300e18);

        // agent1 should get 100/300 * 300 = 100
        // agent2 should get 200/300 * 300 = 200
        uint256 r1 = staking.pendingRewards(agent1);
        uint256 r2 = staking.pendingRewards(agent2);
        assertEq(r1, 100e18);
        assertEq(r2, 200e18);

        // Claim
        uint256 aliceBefore = token.balanceOf(alice);
        vm.prank(alice);
        staking.claimRewards(agent1);
        assertEq(token.balanceOf(alice) - aliceBefore, 100e18);
    }

    function test_noRewardsIfNoStake() public {
        vm.expectRevert("no stakers");
        staking.depositRewards(100e18);
    }

    // ─── Admin ───────────────────────────────────────────────────────

    function test_updateThresholds() public {
        staking.updateThresholds(200e18, 1000e18, 5000e18);
        assertEq(staking.stakeThresholds(1), 200e18);
        assertEq(staking.stakeThresholds(2), 1000e18);
        assertEq(staking.stakeThresholds(3), 5000e18);
    }

    function test_updateBoosts() public {
        staking.updateBoosts(10, 20, 30, 40);
        assertEq(staking.maxBoosts(1), 10);
        assertEq(staking.maxBoosts(2), 20);
        assertEq(staking.maxBoosts(3), 30);
        assertEq(staking.maxBoosts(4), 40);
    }

    function test_pause() public {
        staking.setPaused(true);
        oracle.setScore(agent1, 60);
        vm.prank(alice);
        vm.expectRevert("paused");
        staking.stake(agent1, 10e18);
    }

    function test_onlyOwnerSlash() public {
        vm.prank(alice);
        vm.expectRevert();
        staking.slash(agent1);
    }

    function test_onlyOwnerDeposit() public {
        vm.prank(alice);
        vm.expectRevert();
        staking.depositRewards(100e18);
    }

    // ─── Not staker checks ──────────────────────────────────────────

    function test_cannotUnstakeOther() public {
        oracle.setScore(agent1, 60);
        vm.prank(alice);
        staking.stake(agent1, 100e18);

        vm.prank(bob);
        vm.expectRevert("not staker");
        staking.unstake(agent1, 50e18);
    }

    function test_cannotClaimOther() public {
        oracle.setScore(agent1, 60);
        vm.prank(alice);
        staking.stake(agent1, 100e18);

        token.approve(address(staking), type(uint256).max);
        staking.depositRewards(100e18);

        vm.prank(bob);
        vm.expectRevert("not staker");
        staking.claimRewards(agent1);
    }
}
