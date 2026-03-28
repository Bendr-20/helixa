// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Test.sol";
import "../contracts/ReputationRegistry.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract ReputationRegistryTest is Test {
    ReputationRegistry public impl;
    ReputationRegistry public registry;

    address admin   = address(0xA);
    address oracle1 = address(0xB);
    address oracle2 = address(0xC);
    address agent1  = address(0x1);
    address agent2  = address(0x2);
    address nobody  = address(0xD);

    bytes32 ORACLE_ROLE = keccak256("ORACLE_ROLE");

    function setUp() public {
        impl = new ReputationRegistry();
        bytes memory data = abi.encodeCall(ReputationRegistry.initialize, (admin));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), data);
        registry = ReputationRegistry(address(proxy));

        vm.startPrank(admin);
        registry.grantRole(ORACLE_ROLE, oracle1);
        vm.stopPrank();
    }

    // ── Initialization ───────────────────────────────────────────────────
    function test_initialize() public view {
        assertTrue(registry.hasRole(registry.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(registry.hasRole(ORACLE_ROLE, admin));
    }

    function test_cannotReinitialize() public {
        vm.expectRevert();
        registry.initialize(admin);
    }

    // ── Submit reputation ────────────────────────────────────────────────
    function test_submitReputation() public {
        vm.prank(oracle1);
        registry.submitReputation(agent1, 75, "good agent");

        (uint256 score, uint256 ts, string memory meta) = registry.getReputation(agent1);
        assertEq(score, 75);
        assertGt(ts, 0);
        assertEq(meta, "good agent");
    }

    function test_submitReputation_emitsEvent() public {
        vm.prank(oracle1);
        vm.expectEmit(true, true, false, true);
        emit ReputationRegistry.ReputationUpdated(agent1, 50, oracle1, block.timestamp);
        registry.submitReputation(agent1, 50, "");
    }

    function test_submitReputation_revertsIfNotOracle() public {
        vm.prank(nobody);
        vm.expectRevert();
        registry.submitReputation(agent1, 50, "");
    }

    function test_submitReputation_revertsIfScoreOver100() public {
        vm.prank(oracle1);
        vm.expectRevert(abi.encodeWithSelector(ReputationRegistry.ScoreOutOfRange.selector, 101));
        registry.submitReputation(agent1, 101, "");
    }

    function test_submitReputation_revertsIfZeroAddress() public {
        vm.prank(oracle1);
        vm.expectRevert(ReputationRegistry.ZeroAddress.selector);
        registry.submitReputation(address(0), 50, "");
    }

    // ── History ──────────────────────────────────────────────────────────
    function test_history() public {
        vm.startPrank(oracle1);
        registry.submitReputation(agent1, 30, "first");
        registry.submitReputation(agent1, 60, "second");
        registry.submitReputation(agent1, 90, "third");
        vm.stopPrank();

        ReputationRegistry.ReputationEntry[] memory h = registry.getReputationHistory(agent1);
        assertEq(h.length, 3);
        assertEq(h[0].score, 30);
        assertEq(h[2].score, 90);

        // latest should be the last one
        (uint256 score,,) = registry.getReputation(agent1);
        assertEq(score, 90);
    }

    function test_reputationCount() public {
        assertEq(registry.getReputationCount(agent1), 0);
        vm.prank(oracle1);
        registry.submitReputation(agent1, 50, "");
        assertEq(registry.getReputationCount(agent1), 1);
    }

    // ── Tiers ────────────────────────────────────────────────────────────
    function test_tiers() public {
        vm.startPrank(oracle1);

        registry.submitReputation(agent1, 0, "");
        assertEq(uint(registry.getTier(agent1)), uint(ReputationRegistry.Tier.Junk));

        registry.submitReputation(agent1, 19, "");
        assertEq(uint(registry.getTier(agent1)), uint(ReputationRegistry.Tier.Junk));

        registry.submitReputation(agent1, 20, "");
        assertEq(uint(registry.getTier(agent1)), uint(ReputationRegistry.Tier.Marginal));

        registry.submitReputation(agent1, 40, "");
        assertEq(uint(registry.getTier(agent1)), uint(ReputationRegistry.Tier.Qualified));

        registry.submitReputation(agent1, 60, "");
        assertEq(uint(registry.getTier(agent1)), uint(ReputationRegistry.Tier.Prime));

        registry.submitReputation(agent1, 80, "");
        assertEq(uint(registry.getTier(agent1)), uint(ReputationRegistry.Tier.Preferred));

        registry.submitReputation(agent1, 100, "");
        assertEq(uint(registry.getTier(agent1)), uint(ReputationRegistry.Tier.Preferred));

        vm.stopPrank();
    }

    // ── Identity registry pointer ────────────────────────────────────────
    function test_setIdentityRegistry() public {
        address v2 = address(0xDEAD);
        vm.prank(admin);
        registry.setIdentityRegistry(v2);
        assertEq(registry.identityRegistry(), v2);
    }

    function test_setIdentityRegistry_revertsIfNotAdmin() public {
        vm.prank(nobody);
        vm.expectRevert();
        registry.setIdentityRegistry(address(0xBEEF));
    }

    // ── Multiple oracles ─────────────────────────────────────────────────
    function test_multipleOracles() public {
        vm.prank(admin);
        registry.grantRole(ORACLE_ROLE, oracle2);

        vm.prank(oracle1);
        registry.submitReputation(agent1, 50, "oracle1");

        vm.prank(oracle2);
        registry.submitReputation(agent1, 70, "oracle2");

        (uint256 score,,string memory meta) = registry.getReputation(agent1);
        assertEq(score, 70);
        assertEq(meta, "oracle2");

        ReputationRegistry.ReputationEntry[] memory h = registry.getReputationHistory(agent1);
        assertEq(h.length, 2);
        assertEq(h[0].oracle, oracle1);
        assertEq(h[1].oracle, oracle2);
    }

    // ── Edge: score = 0 ──────────────────────────────────────────────────
    function test_scoreZero() public {
        vm.prank(oracle1);
        registry.submitReputation(agent1, 0, "zero");
        (uint256 score,,) = registry.getReputation(agent1);
        assertEq(score, 0);
    }

    // ── Unscored agent returns defaults ──────────────────────────────────
    function test_unscoredAgentDefaults() public view {
        (uint256 score, uint256 ts, string memory meta) = registry.getReputation(agent2);
        assertEq(score, 0);
        assertEq(ts, 0);
        assertEq(bytes(meta).length, 0);
    }
}
