// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/DNAToken.sol";

contract DNATokenTest is Test {
    DNAToken public dna;

    address owner = address(this);
    address community = address(0xC0);
    address team = address(0xE1);
    address liquidity = address(0xA2);
    address treasury = address(0xB3);
    address advisors = address(0xD4);
    address user1 = address(0x1);
    address user2 = address(0x2);

    function setUp() public {
        dna = new DNAToken(community, team, liquidity, treasury, advisors);
        // Give users some tokens for testing
        vm.prank(community);
        dna.transfer(user1, 10_000 ether);
        vm.prank(community);
        dna.transfer(user2, 5_000 ether);
    }

    // ==================== Distribution ====================

    function test_total_supply() public view {
        assertEq(dna.totalSupply(), 1_000_000_000 ether);
    }

    function test_distribution() public view {
        // Community gets 40% minus what we gave to users
        assertEq(dna.balanceOf(community), 400_000_000 ether - 15_000 ether);
        assertEq(dna.balanceOf(team), 200_000_000 ether);
        assertEq(dna.balanceOf(liquidity), 150_000_000 ether);
        assertEq(dna.balanceOf(treasury), 150_000_000 ether);
        assertEq(dna.balanceOf(advisors), 100_000_000 ether);
    }

    function test_name_symbol() public view {
        assertEq(dna.name(), "AgentDNA Token");
        assertEq(dna.symbol(), "DNA");
    }

    // ==================== Burn For Mint ====================

    function test_burnForMint() public {
        uint256 burnAmount = 100 ether;
        uint256 balBefore = dna.balanceOf(user1);

        vm.prank(user1);
        dna.burnForMint(burnAmount);

        assertEq(dna.balanceOf(user1), balBefore - burnAmount);
        assertEq(dna.totalBurnedFromMints(), burnAmount);
        assertEq(dna.totalSupply(), 1_000_000_000 ether - burnAmount);
    }

    function test_burnForMint_multiple() public {
        vm.prank(user1);
        dna.burnForMint(50 ether);
        vm.prank(user2);
        dna.burnForMint(25 ether);

        assertEq(dna.totalBurnedFromMints(), 75 ether);
    }

    // ==================== Staking ====================

    function test_stake() public {
        vm.prank(user1);
        dna.stake(1000 ether);

        assertEq(dna.stakedBalance(user1), 1000 ether);
        assertEq(dna.totalStaked(), 1000 ether);
        assertEq(dna.balanceOf(user1), 9000 ether);
    }

    function test_unstake_after_lock() public {
        vm.prank(user1);
        dna.stake(1000 ether);

        // Advance 7 days
        vm.warp(block.timestamp + 7 days);

        vm.prank(user1);
        dna.unstake(500 ether);

        assertEq(dna.stakedBalance(user1), 500 ether);
        assertEq(dna.balanceOf(user1), 9500 ether);
    }

    function test_unstake_reverts_before_lock() public {
        vm.prank(user1);
        dna.stake(1000 ether);

        vm.prank(user1);
        vm.expectRevert("Locked for 7 days");
        dna.unstake(500 ether);
    }

    function test_hasMinimumStake() public {
        vm.prank(user1);
        dna.stake(1000 ether);

        assertTrue(dna.hasMinimumStake(user1, 500 ether));
        assertTrue(dna.hasMinimumStake(user1, 1000 ether));
        assertFalse(dna.hasMinimumStake(user1, 1001 ether));
        assertFalse(dna.hasMinimumStake(user2, 1 ether));
    }

    // ==================== Voting Power ====================

    function test_votingPower() public {
        vm.prank(user1);
        dna.stake(2000 ether);

        assertEq(dna.votingPower(user1), 2000 ether);
        assertEq(dna.votingPower(user2), 0);
    }

    // ==================== Reputation Rewards ====================

    function test_distributeReward() public {
        uint256 balBefore = dna.balanceOf(user1);
        dna.distributeReward(user1, 100 ether);
        assertEq(dna.balanceOf(user1), balBefore + 100 ether);
    }

    // ==================== Circulating Supply ====================

    function test_circulatingSupply() public {
        // Initially: total - community - team = circulating
        // Users hold 15k from community pool
        uint256 expected = dna.totalSupply() - dna.totalStaked() - dna.balanceOf(community) - dna.balanceOf(team);
        assertEq(dna.circulatingSupply(), expected);

        // Stake reduces circulating
        vm.prank(user1);
        dna.stake(5000 ether);

        uint256 expected2 = dna.totalSupply() - dna.totalStaked() - dna.balanceOf(community) - dna.balanceOf(team);
        assertEq(dna.circulatingSupply(), expected2);
    }

    // ==================== Deflationary Metrics ====================

    function test_deflationaryMetrics() public {
        vm.prank(user1);
        dna.burnForMint(100 ether);

        vm.prank(user2);
        dna.stake(500 ether);

        (uint256 burned, uint256 staked, , uint256 mintBurns, ) = dna.deflationaryMetrics();
        assertEq(burned, 100 ether);
        assertEq(staked, 500 ether);
        assertEq(mintBurns, 100 ether);
    }

    // ==================== Buyback Burn ====================

    function test_buybackBurn() public {
        // Owner needs tokens first
        vm.prank(community);
        dna.transfer(owner, 1000 ether);

        dna.buybackBurn(500 ether);
        assertEq(dna.totalBurnedFromBuybacks(), 500 ether);
        assertEq(dna.totalSupply(), 1_000_000_000 ether - 500 ether);
    }

    receive() external payable {}
}
