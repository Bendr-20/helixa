// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/CredPredict.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockCRED3 is ERC20 {
    constructor() ERC20("CRED", "CRED") {
        _mint(msg.sender, 10_000_000e18);
    }
}

contract CredPredictTest is Test {
    CredPredict public predict;
    MockCRED3 public cred;
    address public treasury = address(0xBEEF);
    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);
    address public carol = address(0xCA201);

    function setUp() public {
        cred = new MockCRED3();
        predict = new CredPredict(address(cred), treasury);

        cred.transfer(alice, 100_000e18);
        cred.transfer(bob, 100_000e18);
        cred.transfer(carol, 100_000e18);

        vm.prank(alice);
        cred.approve(address(predict), type(uint256).max);
        vm.prank(bob);
        cred.approve(address(predict), type(uint256).max);
        vm.prank(carol);
        cred.approve(address(predict), type(uint256).max);
    }

    function _createMarket() internal returns (uint256) {
        uint256[] memory agents = new uint256[](3);
        agents[0] = 10; agents[1] = 20; agents[2] = 30;
        return predict.createMarket(
            "Which agent gains most score?",
            agents,
            block.timestamp + 1 days,
            block.timestamp + 8 days
        );
    }

    function test_CreateMarket() public {
        uint256 id = _createMarket();
        CredPredict.Market memory m = predict.getMarket(id);
        assertEq(m.optionCount, 3);
        assertEq(uint(m.state), uint(CredPredict.MarketState.OPEN));
    }

    function test_PlacePrediction() public {
        _createMarket();
        vm.prank(alice);
        predict.predict(0, 0, 1000e18);
        assertEq(predict.getOptionTotal(0, 0), 1000e18);
        assertEq(predict.getUserStake(0, alice, 0), 1000e18);
    }

    function test_PredictionLocksAtLockTime() public {
        _createMarket();
        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        vm.expectRevert(CredPredict.PredictionsLocked.selector);
        predict.predict(0, 0, 100e18);
    }

    function test_ResolveAndClaim() public {
        _createMarket();

        // Alice bets 1000 on option 0, Bob bets 500 on option 0, Carol bets 500 on option 1
        vm.prank(alice);
        predict.predict(0, 0, 1000e18);
        vm.prank(bob);
        predict.predict(0, 0, 500e18);
        vm.prank(carol);
        predict.predict(0, 1, 500e18);

        // Total pool = 2000. Option 0 total = 1500. Option 1 total = 500.
        vm.warp(block.timestamp + 1 days); // past lock
        predict.resolve(0, 0); // option 0 wins

        // Rake = 100. Distributable = 1900. Alice share = 1900 * 1000/1500 = 1266.666...
        uint256 aliceBefore = cred.balanceOf(alice);
        vm.prank(alice);
        predict.claimWinnings(0);
        uint256 alicePayout = cred.balanceOf(alice) - aliceBefore;
        // 1900 * 1000 / 1500 = 1266666666666666666666 (1266.67e18 approx)
        assertApproxEqAbs(alicePayout, 1266666666666666666666, 1);

        uint256 bobBefore = cred.balanceOf(bob);
        vm.prank(bob);
        predict.claimWinnings(0);
        uint256 bobPayout = cred.balanceOf(bob) - bobBefore;
        assertApproxEqAbs(bobPayout, 633333333333333333333, 1);

        assertEq(cred.balanceOf(treasury), 100e18);
    }

    function test_LoserCannotClaim() public {
        _createMarket();
        vm.prank(alice);
        predict.predict(0, 0, 1000e18);
        vm.prank(carol);
        predict.predict(0, 1, 500e18);

        vm.warp(block.timestamp + 1 days);
        predict.resolve(0, 0);

        vm.prank(carol);
        vm.expectRevert(CredPredict.NothingToClaim.selector);
        predict.claimWinnings(0);
    }

    function test_CancelAndRefund() public {
        _createMarket();
        vm.prank(alice);
        predict.predict(0, 0, 1000e18);
        vm.prank(bob);
        predict.predict(0, 1, 500e18);

        predict.cancel(0);

        vm.prank(alice);
        predict.claimRefund(0);
        assertEq(cred.balanceOf(alice), 100_000e18);

        vm.prank(bob);
        predict.claimRefund(0);
        assertEq(cred.balanceOf(bob), 100_000e18);
    }

    function test_CancelIfNoWinnerBets() public {
        _createMarket();
        vm.prank(alice);
        predict.predict(0, 0, 1000e18);

        vm.warp(block.timestamp + 1 days);
        predict.resolve(0, 1); // option 1 has 0 bets → auto-cancel

        CredPredict.Market memory m = predict.getMarket(0);
        assertEq(uint(m.state), uint(CredPredict.MarketState.CANCELLED));
    }

    function test_PreviewPayout() public {
        _createMarket();
        vm.prank(alice);
        predict.predict(0, 0, 1000e18);
        vm.prank(bob);
        predict.predict(0, 1, 1000e18);

        uint256 preview = predict.previewPayout(0, alice, 0);
        // Pool 2000, rake 100, distributable 1900, alice has 100% of option 0
        assertEq(preview, 1900e18);
    }

    function test_PauseBlocks() public {
        _createMarket();
        predict.setPaused(true);
        vm.prank(alice);
        vm.expectRevert(CredPredict.ContractPaused.selector);
        predict.predict(0, 0, 100e18);
    }

    function test_TooFewOptions() public {
        uint256[] memory agents = new uint256[](1);
        agents[0] = 10;
        vm.expectRevert(CredPredict.TooFewOptions.selector);
        predict.createMarket("test", agents, block.timestamp + 1 days, block.timestamp + 8 days);
    }

    function test_DoubleClaim() public {
        _createMarket();
        vm.prank(alice);
        predict.predict(0, 0, 1000e18);

        vm.warp(block.timestamp + 1 days);
        predict.resolve(0, 0);

        vm.prank(alice);
        predict.claimWinnings(0);
        vm.prank(alice);
        vm.expectRevert(CredPredict.AlreadyClaimed.selector);
        predict.claimWinnings(0);
    }
}
