// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {CredOracle} from "../src/CredOracle.sol";

contract CredOracleTest is Test {
    CredOracle oracle;
    address owner = address(this);
    address alice = address(0xA11CE);

    function setUp() public {
        oracle = new CredOracle();
    }

    function testSingleUpdate() public {
        oracle.update(1, 70);
        assertEq(oracle.getCredScore(1), 70);
        (uint8 score, uint40 ts) = oracle.getCredData(1);
        assertEq(score, 70);
        assertGt(ts, 0);
    }

    function testBatchUpdate() public {
        uint256[] memory ids = new uint256[](3);
        uint8[] memory scores = new uint8[](3);
        ids[0] = 1; ids[1] = 81; ids[2] = 42;
        scores[0] = 70; scores[1] = 65; scores[2] = 55;

        oracle.batchUpdate(ids, scores);
        assertEq(oracle.getCredScore(1), 70);
        assertEq(oracle.getCredScore(81), 65);
        assertEq(oracle.getCredScore(42), 55);
    }

    function testScoreOverwrite() public {
        oracle.update(1, 50);
        oracle.update(1, 80);
        assertEq(oracle.getCredScore(1), 80);
    }

    function testRevertScoreOver100() public {
        vm.expectRevert("score > 100");
        oracle.update(1, 101);
    }

    function testRevertNotOwner() public {
        vm.prank(alice);
        vm.expectRevert("not owner");
        oracle.update(1, 50);
    }

    function testRevertBatchNotOwner() public {
        uint256[] memory ids = new uint256[](1);
        uint8[] memory scores = new uint8[](1);
        ids[0] = 1; scores[0] = 50;

        vm.prank(alice);
        vm.expectRevert("not owner");
        oracle.batchUpdate(ids, scores);
    }

    function testRevertBatchLengthMismatch() public {
        uint256[] memory ids = new uint256[](2);
        uint8[] memory scores = new uint8[](1);
        ids[0] = 1; ids[1] = 2; scores[0] = 50;

        vm.expectRevert("length mismatch");
        oracle.batchUpdate(ids, scores);
    }

    function testTransferOwnership() public {
        oracle.transferOwnership(alice);
        assertEq(oracle.owner(), alice);

        vm.prank(alice);
        oracle.update(1, 90);
        assertEq(oracle.getCredScore(1), 90);
    }

    function testDefaultScoreZero() public view {
        assertEq(oracle.getCredScore(999), 0);
    }
}
