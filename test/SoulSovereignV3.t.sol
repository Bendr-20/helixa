// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/v2/HelixaV2.sol";
import "../src/SoulSovereignV3.sol";

contract SoulSovereignV3Test is Test {
    HelixaV2 public helixa;
    SoulSovereignV3 public soul;

    address public owner = address(this);
    address public treasury = address(0xBEEF);
    address public user1 = address(0x1);
    address public user2 = address(0x2);
    address public agent1 = address(0xA1);
    address public agent2 = address(0xA2);
    address public rando = address(0xBAD);

    uint256 public tokenId;
    uint256 public tokenId2;

    function setUp() public {
        helixa = new HelixaV2(treasury, 0.005 ether, 0.001 ether, 0.002 ether);
        soul = new SoulSovereignV3(address(helixa));

        // Mint two agents (different users — hasMinted check)
        vm.deal(user1, 10 ether);
        vm.deal(user2, 10 ether);
        vm.prank(user1);
        tokenId = helixa.mint{value: 0.005 ether}(agent1, "Agent1", "openclaw", false);
        vm.prank(user2);
        tokenId2 = helixa.mint{value: 0.005 ether}(agent2, "Agent2", "openclaw", false);
    }

    // ─── First Lock (lockSoulVersion) ───────────────────────────

    function test_lockSoulVersion_firstLock() public {
        bytes32 hash1 = keccak256("soul-v1");

        vm.prank(agent1);
        soul.lockSoulVersion(tokenId, hash1);

        assertEq(soul.soulVersion(tokenId), 1);
        assertEq(soul.soulHashes(tokenId, 1), hash1);
        assertGt(soul.soulTimestamps(tokenId, 1), 0);
        assertEq(soul.sovereignWallet(tokenId), agent1);
        assertTrue(soul.isSovereign(tokenId));
        assertTrue(soul.soulLocked(tokenId));
    }

    function test_lockSoulVersion_emitsEvent() public {
        bytes32 hash1 = keccak256("soul-v1");

        vm.prank(agent1);
        vm.expectEmit(true, true, false, true);
        emit SoulSovereignV3.SoulVersionLocked(tokenId, 1, hash1, block.timestamp);
        soul.lockSoulVersion(tokenId, hash1);
    }

    function test_lockSoulVersion_firstLockEmitsLegacyEvent() public {
        bytes32 hash1 = keccak256("soul-v1");

        vm.prank(agent1);
        vm.expectEmit(true, true, false, true);
        emit SoulSovereignV3.SoulLocked(tokenId, agent1, hash1);
        soul.lockSoulVersion(tokenId, hash1);
    }

    // ─── Multiple Locks ─────────────────────────────────────────

    function test_multipleVersions() public {
        bytes32 hash1 = keccak256("soul-v1");
        bytes32 hash2 = keccak256("soul-v2");
        bytes32 hash3 = keccak256("soul-v3");

        vm.startPrank(agent1);
        soul.lockSoulVersion(tokenId, hash1);
        vm.warp(block.timestamp + 100);
        soul.lockSoulVersion(tokenId, hash2);
        vm.warp(block.timestamp + 200);
        soul.lockSoulVersion(tokenId, hash3);
        vm.stopPrank();

        assertEq(soul.soulVersion(tokenId), 3);
        assertEq(soul.soulHashes(tokenId, 1), hash1);
        assertEq(soul.soulHashes(tokenId, 2), hash2);
        assertEq(soul.soulHashes(tokenId, 3), hash3);
    }

    // ─── History Retrieval ──────────────────────────────────────

    function test_getFullSoulHistory() public {
        bytes32 hash1 = keccak256("v1");
        bytes32 hash2 = keccak256("v2");

        vm.startPrank(agent1);
        soul.lockSoulVersion(tokenId, hash1);
        vm.warp(block.timestamp + 50);
        soul.lockSoulVersion(tokenId, hash2);
        vm.stopPrank();

        (bytes32[] memory hashes, uint256[] memory timestamps) = soul.getFullSoulHistory(tokenId);
        assertEq(hashes.length, 2);
        assertEq(hashes[0], hash1);
        assertEq(hashes[1], hash2);
        assertEq(timestamps.length, 2);
        assertLt(timestamps[0], timestamps[1]);
    }

    function test_getFullSoulHistory_empty() public {
        (bytes32[] memory hashes, uint256[] memory timestamps) = soul.getFullSoulHistory(tokenId);
        assertEq(hashes.length, 0);
        assertEq(timestamps.length, 0);
    }

    // ─── View Helpers ───────────────────────────────────────────

    function test_getSoulHash_specificVersion() public {
        bytes32 hash1 = keccak256("a");
        bytes32 hash2 = keccak256("b");

        vm.startPrank(agent1);
        soul.lockSoulVersion(tokenId, hash1);
        soul.lockSoulVersion(tokenId, hash2);
        vm.stopPrank();

        assertEq(soul.getSoulHash(tokenId, 1), hash1);
        assertEq(soul.getSoulHash(tokenId, 2), hash2);
        assertEq(soul.getSoulTimestamp(tokenId, 1), block.timestamp);
    }

    function test_soulHash_returnsLatest() public {
        bytes32 hash1 = keccak256("a");
        bytes32 hash2 = keccak256("b");

        vm.startPrank(agent1);
        soul.lockSoulVersion(tokenId, hash1);
        soul.lockSoulVersion(tokenId, hash2);
        vm.stopPrank();

        // Legacy soulHash() returns latest
        assertEq(soul.soulHash(tokenId), hash2);
    }

    function test_soulHash_returnsZeroWhenNotLocked() public {
        assertEq(soul.soulHash(tokenId), bytes32(0));
    }

    // ─── Auth Checks ────────────────────────────────────────────

    function test_revert_unauthorizedLock() public {
        vm.prank(rando);
        vm.expectRevert("Not authorized");
        soul.lockSoulVersion(tokenId, keccak256("bad"));
    }

    function test_ownerCanLock() public {
        // Token owner (user1) should also be able to lock
        vm.prank(user1);
        soul.lockSoulVersion(tokenId, keccak256("owner-lock"));
        assertEq(soul.soulVersion(tokenId), 1);
    }

    // ─── Backward Compat: lockSoul ──────────────────────────────

    function test_lockSoul_legacyWorks() public {
        bytes32 hash1 = keccak256("legacy");

        vm.prank(agent1);
        soul.lockSoul(tokenId, hash1);

        assertEq(soul.soulVersion(tokenId), 1);
        assertEq(soul.soulHash(tokenId), hash1);
        assertTrue(soul.isSovereign(tokenId));
    }

    function test_lockSoul_revertsIfAlreadyLocked() public {
        vm.startPrank(agent1);
        soul.lockSoul(tokenId, keccak256("first"));

        vm.expectRevert("Already sovereign");
        soul.lockSoul(tokenId, keccak256("second"));
        vm.stopPrank();
    }

    function test_lockSoulVersion_afterLockSoul_works() public {
        // lockSoul for first version, then lockSoulVersion for subsequent
        vm.startPrank(agent1);
        soul.lockSoul(tokenId, keccak256("v1"));
        soul.lockSoulVersion(tokenId, keccak256("v2"));
        vm.stopPrank();

        assertEq(soul.soulVersion(tokenId), 2);
        assertEq(soul.soulHash(tokenId), keccak256("v2"));
    }

    // ─── Cross-token isolation ──────────────────────────────────

    function test_tokensAreIsolated() public {
        vm.prank(agent1);
        soul.lockSoulVersion(tokenId, keccak256("token0"));

        vm.prank(agent2);
        soul.lockSoulVersion(tokenId2, keccak256("token1"));

        assertEq(soul.soulVersion(tokenId), 1);
        assertEq(soul.soulVersion(tokenId2), 1);
        assertEq(soul.soulHash(tokenId), keccak256("token0"));
        assertEq(soul.soulHash(tokenId2), keccak256("token1"));
    }

    function test_notLockedByDefault() public {
        assertFalse(soul.isSovereign(tokenId));
        assertFalse(soul.soulLocked(tokenId));
        assertEq(soul.getSoulVersion(tokenId), 0);
        assertEq(soul.sovereignWallet(tokenId), address(0));
    }
}
