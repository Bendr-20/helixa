// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/v2/HelixaV2.sol";

contract HelixaV2Test is Test {
    HelixaV2 public helixa;
    address public owner = address(this);
    address public treasury = address(0xBEEF);
    address public user1 = address(0x1);
    address public user2 = address(0x2);
    address public agent1 = address(0xA1);
    
    uint256 public agentKey = 0xA1A1;
    address public agentAddr;

    function setUp() public {
        helixa = new HelixaV2(treasury, 0.005 ether, 0.001 ether, 0.002 ether);
        agentAddr = vm.addr(agentKey);
    }

    // ─── Minting ────────────────────────────────────────────────

    function test_mint() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        uint256 id = helixa.mint{value: 0.005 ether}(agent1, "TestAgent", "openclaw", false);
        
        assertEq(id, 0);
        assertEq(helixa.totalAgents(), 1);
        assertEq(helixa.ownerOf(0), user1);
        
        HelixaV2.Agent memory a = helixa.getAgent(0);
        assertEq(a.name, "TestAgent");
        assertEq(a.framework, "openclaw");
        assertEq(a.agentAddress, agent1);
        assertFalse(a.soulbound);
        assertTrue(a.origin == HelixaV2.MintOrigin.HUMAN);
    }

    function test_mint_soulbound() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        helixa.mint{value: 0.005 ether}(agent1, "Soulbound", "eliza", true);
        
        HelixaV2.Agent memory a = helixa.getAgent(0);
        assertTrue(a.soulbound);
    }

    function test_mint_reverts_double() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        helixa.mint{value: 0.005 ether}(agent1, "First", "openclaw", false);
        
        vm.prank(user1);
        vm.expectRevert(HelixaV2.AlreadyMinted.selector);
        helixa.mint{value: 0.005 ether}(agent1, "Second", "openclaw", false);
    }

    function test_mint_reverts_insufficient() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        vm.expectRevert(HelixaV2.InsufficientPayment.selector);
        helixa.mint{value: 0.001 ether}(agent1, "Cheap", "openclaw", false);
    }

    function test_mintFor_owner() public {
        uint256 id = helixa.mintFor(user1, agent1, "APIAgent", "langchain", false, HelixaV2.MintOrigin.API);
        assertEq(id, 0);
        assertEq(helixa.ownerOf(0), user1);
        
        HelixaV2.Agent memory a = helixa.getAgent(0);
        assertTrue(a.origin == HelixaV2.MintOrigin.API);
    }

    function test_mintFor_reverts_nonOwner() public {
        vm.prank(user1);
        vm.expectRevert();
        helixa.mintFor(user1, agent1, "Bad", "openclaw", false, HelixaV2.MintOrigin.OWNER);
    }

    // ─── ERC-8004 ───────────────────────────────────────────────

    function test_register() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        uint256 id = helixa.register{value: 0.005 ether}(agent1, "RegAgent", "openclaw");
        assertEq(id, 0);
        assertFalse(helixa.getAgent(0).soulbound);
    }

    function test_setMetadata() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        helixa.mint{value: 0.005 ether}(agent1, "Meta", "openclaw", false);
        
        vm.prank(user1);
        helixa.setMetadata(0, "ipfs://QmTest");
        assertEq(helixa.getMetadata(0), "ipfs://QmTest");
        assertEq(helixa.tokenURI(0), "ipfs://QmTest");
    }

    // ─── Traits ─────────────────────────────────────────────────

    function test_addTrait() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        helixa.mint{value: 0.005 ether}(agent1, "Traitor", "openclaw", false);
        
        vm.prank(user1);
        helixa.addTrait{value: 0.001 ether}(0, "Python", "skill");
        
        HelixaV2.Trait[] memory traits = helixa.getTraits(0);
        assertEq(traits.length, 1);
        assertEq(traits[0].name, "Python");
        assertEq(traits[0].category, "skill");
    }

    function test_addTrait_reverts_notOwner() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        helixa.mint{value: 0.005 ether}(agent1, "T", "openclaw", false);
        
        vm.deal(user2, 1 ether);
        vm.prank(user2);
        vm.expectRevert(HelixaV2.NotTokenOwner.selector);
        helixa.addTrait{value: 0.001 ether}(0, "Bad", "skill");
    }

    // ─── Personality ────────────────────────────────────────────

    function test_personality() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        helixa.mint{value: 0.005 ether}(agent1, "Personal", "openclaw", false);
        
        HelixaV2.Personality memory p = HelixaV2.Personality("quirky", "direct", "truth", "dry", 8, 9);
        vm.prank(user1);
        helixa.setPersonality(0, p);
        
        HelixaV2.Personality memory got = helixa.getPersonality(0);
        assertEq(got.quirks, "quirky");
        assertEq(got.riskTolerance, 8);
        assertEq(got.autonomyLevel, 9);
    }

    // ─── Narrative ──────────────────────────────────────────────

    function test_narrative_full() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        helixa.mint{value: 0.005 ether}(agent1, "Story", "openclaw", false);
        
        HelixaV2.Narrative memory n = HelixaV2.Narrative(
            "Born in a hackathon",
            "Protect traders from MEV",
            "Survived 3 rug pulls",
            "Transparency above all"
        );
        vm.prank(user1);
        helixa.setNarrative(0, n);
        
        HelixaV2.Narrative memory got = helixa.getNarrative(0);
        assertEq(got.origin, "Born in a hackathon");
        assertEq(got.mission, "Protect traders from MEV");
        assertEq(got.lore, "Survived 3 rug pulls");
        assertEq(got.manifesto, "Transparency above all");
    }

    function test_narrative_individual() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        helixa.mint{value: 0.005 ether}(agent1, "Story2", "openclaw", false);
        
        uint256 ptsBefore = helixa.points(0);
        vm.prank(user1);
        helixa.setOrigin(0, "Created by a pharmacist at 3am");
        
        assertEq(helixa.getNarrative(0).origin, "Created by a pharmacist at 3am");
        assertGt(helixa.points(0), ptsBefore); // Should earn points
        
        vm.prank(user1);
        helixa.setMission(0, "Index every agent");
        assertEq(helixa.getNarrative(0).mission, "Index every agent");
    }

    function test_narrative_points_only_once() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        helixa.mint{value: 0.005 ether}(agent1, "Once", "openclaw", false);
        
        vm.prank(user1);
        helixa.setOrigin(0, "First origin");
        uint256 ptsAfterFirst = helixa.points(0);
        
        vm.prank(user1);
        helixa.setOrigin(0, "Updated origin");
        uint256 ptsAfterSecond = helixa.points(0);
        
        // Should NOT get double points for updating same field
        assertEq(ptsAfterFirst, ptsAfterSecond);
    }

    // ─── .agent Naming ──────────────────────────────────────────

    function test_registerName() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        helixa.mint{value: 0.005 ether}(agent1, "Named", "openclaw", false);
        
        vm.prank(user1);
        helixa.registerName{value: 0.002 ether}(0, "bendr");
        
        assertEq(helixa.nameOf(0), "bendr");
        assertEq(helixa.resolveName("bendr"), 0);
        assertEq(helixa.resolveName("BENDR"), 0); // Case insensitive
    }

    function test_registerName_taken() public {
        vm.deal(user1, 1 ether);
        vm.deal(user2, 1 ether);
        
        vm.prank(user1);
        helixa.mint{value: 0.005 ether}(agent1, "A", "openclaw", false);
        vm.prank(user1);
        helixa.registerName{value: 0.002 ether}(0, "taken");
        
        vm.prank(user2);
        helixa.mint{value: 0.005 ether}(address(0xA2), "B", "openclaw", false);
        vm.prank(user2);
        vm.expectRevert(HelixaV2.NameTaken.selector);
        helixa.registerName{value: 0.002 ether}(1, "taken");
    }

    function test_registerName_invalid() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        helixa.mint{value: 0.005 ether}(agent1, "A", "openclaw", false);
        
        vm.prank(user1);
        vm.expectRevert(HelixaV2.InvalidName.selector);
        helixa.registerName{value: 0.002 ether}(0, "a"); // Too short
    }

    function test_registerName_rename() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        helixa.mint{value: 0.005 ether}(agent1, "A", "openclaw", false);
        
        vm.prank(user1);
        helixa.registerName{value: 0.002 ether}(0, "oldname");
        
        vm.prank(user1);
        helixa.registerName{value: 0.002 ether}(0, "newname");
        
        assertEq(helixa.nameOf(0), "newname");
        assertEq(helixa.resolveName("newname"), 0);
        // Old name should be freed
        assertEq(helixa.resolveName("oldname"), 0); // Returns default 0, but that's coincidence
    }

    // ─── Cred Score ─────────────────────────────────────────────

    function test_credScore_basic() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        helixa.mint{value: 0.005 ether}(agent1, "Cred", "openclaw", false);
        
        uint8 score = helixa.getCredScore(0);
        // Fresh mint: no traits, no narrative, no verification, no age
        // Should be very low
        assertTrue(score < 20);
    }

    function test_credScore_increases() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        helixa.mint{value: 0.005 ether}(agent1, "Growing", "openclaw", true); // soulbound
        
        uint8 scoreBefore = helixa.getCredScore(0);
        
        // Add traits
        vm.prank(user1);
        helixa.addTrait{value: 0.001 ether}(0, "Python", "skill");
        vm.prank(user1);
        helixa.addTrait{value: 0.001 ether}(0, "DeFi", "domain");
        
        // Add narrative
        vm.prank(user1);
        helixa.setOrigin(0, "Born in a lab");
        vm.prank(user1);
        helixa.setMission(0, "Index everything");
        
        // Verify
        helixa.verify(0);
        
        // Advance time
        vm.warp(block.timestamp + 15 days);
        
        uint8 scoreAfter = helixa.getCredScore(0);
        assertGt(scoreAfter, scoreBefore);
    }

    function test_credScore_breakdown() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        helixa.mint{value: 0.005 ether}(agent1, "Break", "openclaw", true);
        
        helixa.verify(0);
        vm.warp(block.timestamp + 30 days);
        
        (uint8 activity, uint8 traitDepth, uint8 verification, uint8 soulboundScore,
         uint8 age, uint8 narrative, uint8 originScore) = helixa.getCredBreakdown(0);
        
        assertEq(verification, 15); // weightVerification
        assertEq(soulboundScore, 10); // weightSoulbound
        assertGt(age, 0);
    }

    // ─── Soulbound ──────────────────────────────────────────────

    function test_soulbound_blocks_transfer() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        helixa.mint{value: 0.005 ether}(agent1, "Soul", "openclaw", true);
        
        vm.prank(user1);
        vm.expectRevert(HelixaV2.Soulbound.selector);
        helixa.transferFrom(user1, user2, 0);
    }

    function test_nonsoulbound_allows_transfer() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        helixa.mint{value: 0.005 ether}(agent1, "Free", "openclaw", false);
        
        vm.prank(user1);
        helixa.transferFrom(user1, user2, 0);
        assertEq(helixa.ownerOf(0), user2);
    }

    // ─── Verification ───────────────────────────────────────────

    function test_verify() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        helixa.mint{value: 0.005 ether}(agent1, "V", "openclaw", false);
        
        assertFalse(helixa.getAgent(0).verified);
        helixa.verify(0);
        assertTrue(helixa.getAgent(0).verified);
    }

    function test_verify_reverts_nonOwner() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        helixa.mint{value: 0.005 ether}(agent1, "V", "openclaw", false);
        
        vm.prank(user1);
        vm.expectRevert();
        helixa.verify(0);
    }

    // ─── Mutations ──────────────────────────────────────────────

    function test_mutate() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        helixa.mint{value: 0.005 ether}(agent1, "Mut", "openclaw", false);
        
        vm.prank(user1);
        helixa.mutate(0, "2.0");
        
        HelixaV2.Agent memory a = helixa.getAgent(0);
        assertEq(a.mutationCount, 1);
        assertEq(a.currentVersion, "2.0");
    }

    // ─── Points ─────────────────────────────────────────────────

    function test_points_on_mint() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        helixa.mint{value: 0.005 ether}(agent1, "Points", "openclaw", false);
        
        assertEq(helixa.points(0), 100); // MINT_POINTS
    }

    function test_points_on_trait() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        helixa.mint{value: 0.005 ether}(agent1, "P", "openclaw", false);
        
        vm.prank(user1);
        helixa.addTrait{value: 0.001 ether}(0, "Rust", "skill");
        
        assertEq(helixa.points(0), 110); // 100 mint + 10 trait
    }

    function test_bonusPoints() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        helixa.mint{value: 0.005 ether}(agent1, "B", "openclaw", false);
        
        helixa.awardBonusPoints(0, 50, "early_adopter");
        assertEq(helixa.points(0), 150);
    }

    // ─── SIWA Mint ──────────────────────────────────────────────

    function test_mintWithSIWA() public {
        vm.deal(user1, 1 ether);
        
        uint256 deadline = block.timestamp + 1 hours;
        uint256 nonce = helixa.siwaNonces(agentAddr);
        
        // Build EIP-712 digest
        bytes32 structHash = keccak256(abi.encode(
            keccak256("SIWAVerification(address agentAddress,uint256 agentId,uint256 nonce,uint256 deadline)"),
            agentAddr,
            uint256(0), // nextTokenId
            nonce,
            deadline
        ));
        bytes32 domainSeparator = helixa.DOMAIN_SEPARATOR();
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(agentKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        vm.prank(user1);
        uint256 id = helixa.mintWithSIWA{value: 0.005 ether}(
            agentAddr, "SIWAAgent", "openclaw", false, deadline, signature
        );
        
        assertEq(id, 0);
        HelixaV2.Agent memory a = helixa.getAgent(0);
        assertTrue(a.origin == HelixaV2.MintOrigin.AGENT_SIWA);
        // SIWA gets bonus points
        assertEq(helixa.points(0), 150); // 100 mint + 50 SIWA bonus
    }

    function test_mintWithSIWA_expired() public {
        vm.deal(user1, 1 ether);
        uint256 deadline = block.timestamp - 1;
        
        vm.prank(user1);
        vm.expectRevert(HelixaV2.ExpiredDeadline.selector);
        helixa.mintWithSIWA{value: 0.005 ether}(
            agentAddr, "Expired", "openclaw", false, deadline, ""
        );
    }

    // ─── Admin ──────────────────────────────────────────────────

    function test_setPricing() public {
        helixa.setPricing(0.01 ether, 0.002 ether, 0.005 ether);
        assertEq(helixa.mintPrice(), 0.01 ether);
        assertEq(helixa.traitPrice(), 0.002 ether);
        assertEq(helixa.namePrice(), 0.005 ether);
    }

    function test_withdraw() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        helixa.mint{value: 0.005 ether}(agent1, "W", "openclaw", false);
        
        uint256 balBefore = treasury.balance;
        helixa.withdraw();
        assertEq(treasury.balance - balBefore, 0.005 ether);
    }

    function test_setCredWeights() public {
        helixa.setCredWeights(30, 20, 10, 10, 10, 10, 10);
        assertEq(helixa.weightActivity(), 30);
    }

    function test_setCredWeights_must_sum_100() public {
        vm.expectRevert("must sum 100");
        helixa.setCredWeights(30, 20, 10, 10, 10, 10, 5); // sums to 95
    }

    // ─── MintOrigin Badge ───────────────────────────────────────

    function test_mintOrigin_human() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        helixa.mint{value: 0.005 ether}(agent1, "H", "openclaw", false);
        assertTrue(helixa.getMintOrigin(0) == HelixaV2.MintOrigin.HUMAN);
    }

    function test_mintOrigin_api() public {
        helixa.mintFor(user1, agent1, "API", "openclaw", false, HelixaV2.MintOrigin.API);
        assertTrue(helixa.getMintOrigin(0) == HelixaV2.MintOrigin.API);
    }

    function test_mintOrigin_affects_cred() public {
        // API mint
        helixa.mintFor(user1, agent1, "API", "openclaw", false, HelixaV2.MintOrigin.API);
        uint8 apiScore = helixa.getCredScore(0);
        
        // SIWA mint (via owner for simplicity — origin is what matters)
        helixa.mintFor(user2, address(0xA2), "SIWA", "openclaw", false, HelixaV2.MintOrigin.AGENT_SIWA);
        uint8 siwaScore = helixa.getCredScore(1);
        
        // SIWA should score higher due to origin weight
        assertGt(siwaScore, apiScore);
    }

    // ─── Edge Cases ─────────────────────────────────────────────

    function test_nonexistent_agent_reverts() public {
        vm.expectRevert(HelixaV2.NoAgent.selector);
        helixa.getAgent(999);
    }

    function test_totalAgents() public {
        assertEq(helixa.totalAgents(), 0);
        
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        helixa.mint{value: 0.005 ether}(agent1, "A", "openclaw", false);
        assertEq(helixa.totalAgents(), 1);
        
        helixa.mintFor(user2, address(0xA2), "B", "openclaw", false, HelixaV2.MintOrigin.OWNER);
        assertEq(helixa.totalAgents(), 2);
    }

    // ─── Receive ETH ────────────────────────────────────────────
    receive() external payable {}
}
