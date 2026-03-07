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

    function setUp() public {
        cred = new MockCRED();
        staking = new CredStaking(address(cred), treasury);
        cred.transfer(alice, 100_000e18);
        cred.transfer(bob, 100_000e18);
        vm.prank(alice);
        cred.approve(address(staking), type(uint256).max);
        vm.prank(bob);
        cred.approve(address(staking), type(uint256).max);
    }

    function test_StakeQualifiedTier() public {
        vm.prank(alice);
        staking.stake(1, 100e18);
        assertEq(uint(staking.getTier(1)), uint(CredStaking.Tier.QUALIFIED));
        assertEq(staking.getBoost(1), 10);
        assertTrue(staking.isStaked(1));
    }

    function test_StakePrimeTier() public {
        vm.prank(alice);
        staking.stake(1, 500e18);
        assertEq(uint(staking.getTier(1)), uint(CredStaking.Tier.PRIME));
        assertEq(staking.getBoost(1), 20);
    }

    function test_StakePreferredTier() public {
        vm.prank(alice);
        staking.stake(1, 2000e18);
        assertEq(uint(staking.getTier(1)), uint(CredStaking.Tier.PREFERRED));
        assertEq(staking.getBoost(1), 30);
    }

    function test_EarlyUnstakePenalty() public {
        vm.prank(alice);
        staking.stake(1, 1000e18);

        uint256 balBefore = cred.balanceOf(alice);
        vm.prank(alice);
        staking.unstake(1, 1000e18);

        // 10% penalty
        assertEq(cred.balanceOf(alice) - balBefore, 900e18);
        assertEq(cred.balanceOf(treasury), 100e18);
    }

    function test_UnstakeAfterLock() public {
        vm.prank(alice);
        staking.stake(1, 1000e18);

        vm.warp(block.timestamp + 7 days + 1);
        uint256 balBefore = cred.balanceOf(alice);
        vm.prank(alice);
        staking.unstake(1, 1000e18);

        assertEq(cred.balanceOf(alice) - balBefore, 1000e18);
        assertEq(cred.balanceOf(treasury), 0);
        assertFalse(staking.isStaked(1));
    }

    function test_OneStakerPerAgent() public {
        vm.prank(alice);
        staking.stake(1, 100e18);

        vm.prank(bob);
        vm.expectRevert(CredStaking.AgentAlreadyStakedByOther.selector);
        staking.stake(1, 100e18);
    }

    function test_Slash() public {
        vm.prank(alice);
        staking.stake(1, 1000e18);

        staking.slash(1);
        assertEq(cred.balanceOf(treasury), 1000e18);
        assertEq(uint(staking.getTier(1)), uint(CredStaking.Tier.NONE));
    }

    function test_PauseBlocks() public {
        staking.setPaused(true);
        vm.prank(alice);
        vm.expectRevert(CredStaking.ContractPaused.selector);
        staking.stake(1, 100e18);
    }

    function test_SetThresholds() public {
        staking.setThresholds(50e18, 250e18, 1000e18);
        vm.prank(alice);
        staking.stake(1, 50e18);
        assertEq(uint(staking.getTier(1)), uint(CredStaking.Tier.QUALIFIED));
    }

    function test_InvalidThresholds() public {
        vm.expectRevert(CredStaking.InvalidThresholds.selector);
        staking.setThresholds(500e18, 100e18, 1000e18);
    }

    function test_StakedAgentsTracking() public {
        vm.prank(alice);
        staking.stake(1, 100e18);
        vm.prank(alice);
        staking.stake(2, 100e18);
        assertEq(staking.getStakedAgentCount(), 2);

        uint256[] memory agents = staking.getStakedAgents(0, 10);
        assertEq(agents.length, 2);
    }

    function test_AdditionalStakeResets() public {
        vm.prank(alice);
        staking.stake(1, 100e18);
        vm.prank(alice);
        staking.stake(1, 400e18);
        (uint256 amt,,) = staking.getStake(1);
        assertEq(amt, 500e18);
        assertEq(uint(staking.getTier(1)), uint(CredStaking.Tier.PRIME));
    }
}
