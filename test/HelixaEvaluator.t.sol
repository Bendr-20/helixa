// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {HelixaEvaluator} from "../src/v2/HelixaEvaluator.sol";

// ─── Mocks ──────────────────────────────────────────────────────────

contract MockCredOracle {
    mapping(uint256 => uint256) public scores;
    function setScore(uint256 tokenId, uint256 score) external { scores[tokenId] = score; }
    function getScore(uint256 tokenId) external view returns (uint256) { return scores[tokenId]; }
}

contract MockHelixa {
    mapping(uint256 => address) public owners;
    function setOwner(uint256 tokenId, address owner) external { owners[tokenId] = owner; }
    function ownerOf(uint256 tokenId) external view returns (address) { return owners[tokenId]; }
    function totalAgents() external pure returns (uint256) { return 100; }
}

contract MockJobContract {
    struct JobResult { bool completed; bool rejected; bytes32 reason; }
    mapping(uint256 => JobResult) public results;
    function complete(uint256 jobId, bytes32 reason) external { results[jobId] = JobResult(true, false, reason); }
    function reject(uint256 jobId, bytes32 reason) external { results[jobId] = JobResult(false, true, reason); }
}

// ─── Tests ──────────────────────────────────────────────────────────

contract HelixaEvaluatorTest is Test {
    HelixaEvaluator evaluator;
    MockCredOracle oracle;
    MockHelixa helixa;
    MockJobContract jobContract;

    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    function setUp() public {
        oracle = new MockCredOracle();
        helixa = new MockHelixa();
        jobContract = new MockJobContract();

        evaluator = new HelixaEvaluator(address(oracle), address(helixa), 70, 30);
        evaluator.setTrustedJobContract(address(jobContract), true);

        helixa.setOwner(1, alice);
        oracle.setScore(1, 85);
        helixa.setOwner(2, bob);
        oracle.setScore(2, 25);
    }

    // ─── Basic ──────────────────────────────────────────────────────

    function test_linkAgent() public {
        vm.prank(alice);
        evaluator.linkAgent(1);
        assertEq(evaluator.walletToAgent(alice), 1);
    }

    function test_linkAgent_reverts_notOwner() public {
        vm.prank(bob);
        vm.expectRevert(HelixaEvaluator.NotTokenOwner.selector);
        evaluator.linkAgent(1);
    }

    function test_getCredForWallet() public {
        vm.prank(alice);
        evaluator.linkAgent(1);
        assertEq(evaluator.getCredForWallet(alice), 85);
    }

    function test_getCredForWallet_noAgent() public view {
        assertEq(evaluator.getCredForWallet(alice), 0);
    }

    function test_isEligibleProvider_above() public {
        vm.prank(alice);
        evaluator.linkAgent(1);
        assertTrue(evaluator.isEligibleProvider(alice));
    }

    function test_isEligibleProvider_below() public {
        vm.prank(bob);
        evaluator.linkAgent(2);
        assertFalse(evaluator.isEligibleProvider(bob));
    }

    function test_isEligibleProvider_noMinimum() public {
        evaluator.setThresholds(70, 0);
        assertTrue(evaluator.isEligibleProvider(bob));
    }

    // ─── Legacy Evaluate (no budget) ────────────────────────────────

    function test_evaluate_autoComplete() public {
        vm.prank(alice);
        evaluator.linkAgent(1);
        evaluator.evaluate(address(jobContract), 42, alice);

        (bool completed, bool rejected, bytes32 reason) = jobContract.results(42);
        assertTrue(completed);
        assertFalse(rejected);
        assertEq(uint256(reason), 85);
    }

    function test_evaluate_autoReject_lowCred() public {
        vm.prank(bob);
        evaluator.linkAgent(2);
        evaluator.evaluate(address(jobContract), 42, bob);

        (bool completed, bool rejected,) = jobContract.results(42);
        assertFalse(completed);
        assertTrue(rejected);
    }

    function test_evaluate_autoReject_noAgent() public {
        evaluator.evaluate(address(jobContract), 42, alice);

        (bool completed, bool rejected, bytes32 reason) = jobContract.results(42);
        assertFalse(completed);
        assertTrue(rejected);
        assertEq(reason, keccak256("NO_AGENT_LINKED"));
    }

    function test_evaluate_reverts_untrustedContract() public {
        vm.expectRevert(HelixaEvaluator.NotTrustedContract.selector);
        evaluator.evaluate(address(0xDEAD), 1, alice);
    }

    // ─── Dynamic Thresholds ─────────────────────────────────────────

    function test_tieredThresholds() public {
        HelixaEvaluator.TierThreshold[] memory t = new HelixaEvaluator.TierThreshold[](3);
        t[0] = HelixaEvaluator.TierThreshold(100e6, 30);      // ≤$100: cred 30
        t[1] = HelixaEvaluator.TierThreshold(1000e6, 50);     // ≤$1000: cred 50
        t[2] = HelixaEvaluator.TierThreshold(10000e6, 80);    // ≤$10K: cred 80
        evaluator.setTiers(t);

        assertEq(evaluator.getThresholdForBudget(50e6), 30);
        assertEq(evaluator.getThresholdForBudget(500e6), 50);
        assertEq(evaluator.getThresholdForBudget(5000e6), 80);
        assertEq(evaluator.getThresholdForBudget(50000e6), 70); // above all tiers → default
    }

    function test_evaluateWithBudget_lowTier() public {
        // Bob has cred 25 — normally rejected at default 70
        // But with tiers, a $10 job only needs cred 20
        HelixaEvaluator.TierThreshold[] memory t = new HelixaEvaluator.TierThreshold[](2);
        t[0] = HelixaEvaluator.TierThreshold(100e6, 20);  // ≤$100: cred 20
        t[1] = HelixaEvaluator.TierThreshold(1000e6, 60); // ≤$1000: cred 60
        evaluator.setTiers(t);

        vm.prank(bob);
        evaluator.linkAgent(2);

        // $10 job — bob's cred 25 >= 20 threshold → should complete
        evaluator.evaluate(address(jobContract), 10, bob, 10e6);

        (bool completed,,) = jobContract.results(10);
        assertTrue(completed);
    }

    function test_evaluateWithBudget_highTier() public {
        HelixaEvaluator.TierThreshold[] memory t = new HelixaEvaluator.TierThreshold[](2);
        t[0] = HelixaEvaluator.TierThreshold(100e6, 20);
        t[1] = HelixaEvaluator.TierThreshold(1000e6, 90);
        evaluator.setTiers(t);

        vm.prank(alice);
        evaluator.linkAgent(1); // cred 85

        // $500 job — alice's cred 85 < 90 threshold → rejected
        evaluator.evaluate(address(jobContract), 11, alice, 500e6);

        (bool completed, bool rejected,) = jobContract.results(11);
        assertFalse(completed);
        assertTrue(rejected);
    }

    function test_jobThresholdOverride() public {
        // Override job #99 to require cred 95
        evaluator.setJobThreshold(address(jobContract), 99, 95);

        vm.prank(alice);
        evaluator.linkAgent(1); // cred 85

        evaluator.evaluate(address(jobContract), 99, alice, 10e6);

        (bool completed, bool rejected,) = jobContract.results(99);
        assertFalse(completed);
        assertTrue(rejected); // 85 < 95
    }

    function test_setTiers_reverts_nonAscending() public {
        HelixaEvaluator.TierThreshold[] memory t = new HelixaEvaluator.TierThreshold[](2);
        t[0] = HelixaEvaluator.TierThreshold(1000e6, 50);
        t[1] = HelixaEvaluator.TierThreshold(100e6, 30); // not ascending
        vm.expectRevert(HelixaEvaluator.InvalidTiers.selector);
        evaluator.setTiers(t);
    }

    function test_isEligibleForBudget() public {
        HelixaEvaluator.TierThreshold[] memory t = new HelixaEvaluator.TierThreshold[](1);
        t[0] = HelixaEvaluator.TierThreshold(100e6, 20);
        evaluator.setTiers(t);

        vm.prank(bob);
        evaluator.linkAgent(2); // cred 25

        assertTrue(evaluator.isEligibleForBudget(bob, 50e6));    // 25 >= 20
        assertFalse(evaluator.isEligibleForBudget(bob, 500e6));  // 25 < 70 (default)
    }

    // ─── Reputation Feedback ────────────────────────────────────────

    function test_reputationTracked_onComplete() public {
        vm.prank(alice);
        evaluator.linkAgent(1);

        evaluator.evaluate(address(jobContract), 1, alice);

        (uint256 completions, uint256 rejections, uint256 totalEarned,, uint256 successRate)
            = evaluator.getAgentRecord(1);
        assertEq(completions, 1);
        assertEq(rejections, 0);
        assertEq(successRate, 10000); // 100%
    }

    function test_reputationTracked_onReject() public {
        vm.prank(bob);
        evaluator.linkAgent(2);

        evaluator.evaluate(address(jobContract), 1, bob);

        (uint256 completions, uint256 rejections,,, uint256 successRate)
            = evaluator.getAgentRecord(2);
        assertEq(completions, 0);
        assertEq(rejections, 1);
        assertEq(successRate, 0);
    }

    function test_reputationTracked_withBudget() public {
        vm.prank(alice);
        evaluator.linkAgent(1);

        evaluator.evaluate(address(jobContract), 1, alice, 500e6);

        (uint256 completions,, uint256 totalEarned,,) = evaluator.getAgentRecord(1);
        assertEq(completions, 1);
        assertEq(totalEarned, 500e6);
    }

    function test_reputationAccumulates() public {
        vm.prank(alice);
        evaluator.linkAgent(1);

        // Complete 3 jobs
        evaluator.evaluate(address(jobContract), 1, alice, 100e6);
        evaluator.evaluate(address(jobContract), 2, alice, 200e6);
        evaluator.evaluate(address(jobContract), 3, alice, 300e6);

        (uint256 completions, uint256 rejections, uint256 totalEarned,, uint256 successRate)
            = evaluator.getAgentRecord(1);
        assertEq(completions, 3);
        assertEq(rejections, 0);
        assertEq(totalEarned, 600e6);
        assertEq(successRate, 10000);
    }

    function test_reputationMixed() public {
        // Set threshold to 50 so alice (85) passes and bob (25) fails
        vm.prank(alice);
        evaluator.linkAgent(1);
        vm.prank(bob);
        evaluator.linkAgent(2);

        evaluator.evaluate(address(jobContract), 1, alice);  // complete
        evaluator.evaluate(address(jobContract), 2, bob);    // reject

        // Alice: 1 completion
        (uint256 aC, uint256 aR,,, uint256 aRate) = evaluator.getAgentRecord(1);
        assertEq(aC, 1);
        assertEq(aR, 0);
        assertEq(aRate, 10000);

        // Bob: 1 rejection
        (uint256 bC, uint256 bR,,, uint256 bRate) = evaluator.getAgentRecord(2);
        assertEq(bC, 0);
        assertEq(bR, 1);
        assertEq(bRate, 0);
    }

    function test_getWalletRecord() public {
        vm.prank(alice);
        evaluator.linkAgent(1);
        evaluator.evaluate(address(jobContract), 1, alice, 100e6);

        (uint256 c, uint256 r, uint256 e, uint256 rate) = evaluator.getWalletRecord(alice);
        assertEq(c, 1);
        assertEq(r, 0);
        assertEq(e, 100e6);
        assertEq(rate, 10000);
    }

    function test_getWalletRecord_noAgent() public view {
        (uint256 c, uint256 r, uint256 e, uint256 rate) = evaluator.getWalletRecord(alice);
        assertEq(c, 0);
        assertEq(r, 0);
        assertEq(e, 0);
        assertEq(rate, 0);
    }

    // ─── Manual with Reputation ─────────────────────────────────────

    function test_manualComplete_tracksReputation() public {
        vm.prank(alice);
        evaluator.linkAgent(1);

        evaluator.manualComplete(address(jobContract), 50, alice, 1000e6, bytes32("good"));

        (uint256 c,, uint256 e,,) = evaluator.getAgentRecord(1);
        assertEq(c, 1);
        assertEq(e, 1000e6);
    }

    function test_manualReject_tracksReputation() public {
        vm.prank(bob);
        evaluator.linkAgent(2);

        evaluator.manualReject(address(jobContract), 50, bob, bytes32("bad"));

        (, uint256 r,,,) = evaluator.getAgentRecord(2);
        assertEq(r, 1);
    }

    // ─── Admin ──────────────────────────────────────────────────────

    function test_setThresholds() public {
        evaluator.setThresholds(90, 50);
        assertEq(evaluator.autoCompleteThreshold(), 90);
        assertEq(evaluator.providerMinCred(), 50);
    }

    function test_setThresholds_reverts_notOwner() public {
        vm.prank(alice);
        vm.expectRevert(HelixaEvaluator.NotOwner.selector);
        evaluator.setThresholds(90, 50);
    }

    function test_transferOwnership() public {
        evaluator.transferOwnership(alice);
        assertEq(evaluator.owner(), alice);
    }

    function test_manualComplete_reverts_notOwner() public {
        vm.prank(alice);
        vm.expectRevert(HelixaEvaluator.NotOwner.selector);
        evaluator.manualComplete(address(jobContract), 99, alice, 0, bytes32(0));
    }
}
