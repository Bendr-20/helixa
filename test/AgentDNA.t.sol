// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/AgentDNA.sol";

contract AgentDNATest is Test {
    AgentDNA public dna;

    address owner = address(this);
    address user1 = address(0x1);
    address user2 = address(0x2);
    address agent1 = address(0xA1);
    address agent2 = address(0xA2);
    address agent3 = address(0xA3);

    uint256 constant MINT_PRICE = 0.01 ether;
    uint256 constant NO_PARENT = type(uint256).max;

    function setUp() public {
        dna = new AgentDNA(MINT_PRICE, 0.001 ether, 0.0005 ether);
        vm.deal(user1, 10 ether);
        vm.deal(user2, 10 ether);
    }

    // ==================== ERC-8004 Register Tests ====================

    function test_register_with_metadata() public {
        AgentDNA.MetadataEntry[] memory meta = new AgentDNA.MetadataEntry[](2);
        meta[0] = AgentDNA.MetadataEntry("framework", abi.encode("langchain"));
        meta[1] = AgentDNA.MetadataEntry("model", abi.encode("gpt-4"));

        vm.prank(user1);
        uint256 id = dna.register{value: MINT_PRICE}("ipfs://agent1", meta);

        assertEq(id, 0);
        assertEq(dna.ownerOf(0), user1);
        assertEq(dna.totalAgents(), 1);
        assertEq(dna.tokenURI(0), "ipfs://agent1");

        bytes memory fw = dna.getMetadata(0, "framework");
        assertEq(abi.decode(fw, (string)), "langchain");
    }

    function test_register_uri_only() public {
        vm.prank(user1);
        uint256 id = dna.register{value: MINT_PRICE}("ipfs://agent1");
        assertEq(id, 0);
        assertEq(dna.ownerOf(0), user1);
    }

    function test_setAgentURI() public {
        vm.prank(user1);
        dna.register{value: MINT_PRICE}("ipfs://old");

        vm.prank(user1);
        dna.setAgentURI(0, "ipfs://new");
        assertEq(dna.tokenURI(0), "ipfs://new");
    }

    function test_setMetadata() public {
        vm.prank(user1);
        dna.register{value: MINT_PRICE}("ipfs://agent");

        vm.prank(user1);
        dna.setMetadata(0, "capabilities", abi.encode("trading,research"));

        bytes memory val = dna.getMetadata(0, "capabilities");
        assertEq(abi.decode(val, (string)), "trading,research");
    }

    function test_setMetadata_reverts_non_owner() public {
        vm.prank(user1);
        dna.register{value: MINT_PRICE}("ipfs://agent");

        vm.prank(user2);
        vm.expectRevert("Not owner");
        dna.setMetadata(0, "hack", abi.encode("nope"));
    }

    // ==================== Rich Mint Tests ====================

    function test_mint_success() public {
        vm.prank(user1);
        uint256 tokenId = dna.mint{value: MINT_PRICE}(
            agent1, "TestAgent", "langchain", "ipfs://metadata1", false, "1.0.0", NO_PARENT
        );

        assertEq(tokenId, 0);
        assertEq(dna.ownerOf(0), user1);
        assertEq(dna.totalAgents(), 1);
        assertEq(dna.hasAgent(agent1), true);

        AgentDNA.Agent memory agent = dna.getAgent(0);
        assertEq(agent.agentAddress, agent1);
        assertEq(agent.name, "TestAgent");
        assertEq(agent.framework, "langchain");
        assertEq(agent.generation, 0);
        assertEq(agent.parentDNA, NO_PARENT);
    }

    function test_mint_with_version() public {
        vm.prank(user1);
        dna.mint{value: MINT_PRICE}(agent1, "TestAgent", "langchain", "ipfs://meta", false, "2.5.0", NO_PARENT);
        AgentDNA.Agent memory agent = dna.getAgent(0);
        assertEq(agent.currentVersion, "2.5.0");
    }

    function test_mint_default_version() public {
        vm.prank(user1);
        dna.mint{value: MINT_PRICE}(agent1, "TestAgent", "langchain", "ipfs://meta", false, "", NO_PARENT);
        AgentDNA.Agent memory agent = dna.getAgent(0);
        assertEq(agent.currentVersion, "1.0.0");
    }

    function test_mint_refunds_excess() public {
        uint256 balanceBefore = user1.balance;
        vm.prank(user1);
        dna.mint{value: 1 ether}(agent1, "TestAgent", "langchain", "ipfs://meta", false, "1.0.0", NO_PARENT);
        assertEq(user1.balance, balanceBefore - MINT_PRICE);
    }

    function test_mint_reverts_insufficient_payment() public {
        vm.prank(user1);
        vm.expectRevert("Insufficient payment");
        dna.mint{value: 0.001 ether}(agent1, "TestAgent", "langchain", "ipfs://meta", false, "1.0.0", NO_PARENT);
    }

    function test_mint_reverts_duplicate_agent() public {
        vm.prank(user1);
        dna.mint{value: MINT_PRICE}(agent1, "TestAgent", "langchain", "ipfs://meta", false, "1.0.0", NO_PARENT);
        vm.prank(user2);
        vm.expectRevert("Agent already registered");
        dna.mint{value: MINT_PRICE}(agent1, "TestAgent2", "crewai", "ipfs://meta2", false, "1.0.0", NO_PARENT);
    }

    function test_mint_reverts_zero_address() public {
        vm.prank(user1);
        vm.expectRevert("Invalid agent address");
        dna.mint{value: MINT_PRICE}(address(0), "TestAgent", "langchain", "ipfs://meta", false, "1.0.0", NO_PARENT);
    }

    function test_mint_reverts_empty_name() public {
        vm.prank(user1);
        vm.expectRevert("Name required");
        dna.mint{value: MINT_PRICE}(agent1, "", "langchain", "ipfs://meta", false, "1.0.0", NO_PARENT);
    }

    // ==================== Lineage Tests ====================

    function test_mint_with_parent() public {
        vm.prank(user1);
        dna.mint{value: MINT_PRICE}(agent1, "ParentAgent", "langchain", "ipfs://parent", false, "1.0.0", NO_PARENT);
        vm.prank(user2);
        dna.mint{value: MINT_PRICE}(agent2, "ChildAgent", "langchain", "ipfs://child", false, "1.0.0", 0);

        AgentDNA.Agent memory child = dna.getAgent(1);
        assertEq(child.generation, 1);
        assertEq(child.parentDNA, 0);

        uint256[] memory parentChildren = dna.getChildren(0);
        assertEq(parentChildren.length, 1);
        assertEq(parentChildren[0], 1);
    }

    function test_lineage_three_generations() public {
        vm.prank(user1);
        dna.mint{value: MINT_PRICE}(agent1, "Gen0", "langchain", "ipfs://0", false, "1.0.0", NO_PARENT);
        vm.prank(user1);
        dna.mint{value: MINT_PRICE}(agent2, "Gen1", "langchain", "ipfs://1", false, "1.0.0", 0);
        vm.prank(user1);
        dna.mint{value: MINT_PRICE}(agent3, "Gen2", "langchain", "ipfs://2", false, "1.0.0", 1);

        AgentDNA.Agent memory gen2 = dna.getAgent(2);
        assertEq(gen2.generation, 2);

        uint256[] memory lineage = dna.getLineage(2);
        assertEq(lineage.length, 3);
        assertEq(lineage[0], 2);
        assertEq(lineage[1], 1);
        assertEq(lineage[2], 0);
    }

    function test_mint_reverts_invalid_parent() public {
        vm.prank(user1);
        vm.expectRevert("Parent does not exist");
        dna.mint{value: MINT_PRICE}(agent1, "Orphan", "langchain", "ipfs://orphan", false, "1.0.0", 999);
    }

    // ==================== Mutation Tests ====================

    function test_mutate() public {
        vm.prank(user1);
        dna.mint{value: MINT_PRICE}(agent1, "TestAgent", "langchain", "ipfs://v1", false, "1.0.0", NO_PARENT);

        vm.prank(user1);
        dna.mutate{value: 0.001 ether}(0, "2.0.0", "Added trading module", "ipfs://v2");

        AgentDNA.Agent memory agent = dna.getAgent(0);
        assertEq(agent.currentVersion, "2.0.0");
        assertEq(agent.mutationCount, 1);

        AgentDNA.Mutation[] memory muts = dna.getMutations(0);
        assertEq(muts.length, 1);
        assertEq(muts[0].fromVersion, "1.0.0");
        assertEq(muts[0].toVersion, "2.0.0");
    }

    function test_multiple_mutations() public {
        vm.prank(user1);
        dna.mint{value: MINT_PRICE}(agent1, "TestAgent", "langchain", "ipfs://v1", false, "1.0.0", NO_PARENT);

        vm.prank(user1);
        dna.mutate{value: 0.001 ether}(0, "1.1.0", "Bug fix", "");
        vm.prank(user1);
        dna.mutate{value: 0.001 ether}(0, "2.0.0", "Major upgrade", "ipfs://v2");
        vm.prank(user1);
        dna.mutate{value: 0.001 ether}(0, "3.0.0", "Vision update", "ipfs://v3");

        AgentDNA.Agent memory agent = dna.getAgent(0);
        assertEq(agent.currentVersion, "3.0.0");
        assertEq(agent.mutationCount, 3);
    }

    function test_mutate_reverts_non_owner() public {
        vm.prank(user1);
        dna.mint{value: MINT_PRICE}(agent1, "TestAgent", "langchain", "ipfs://v1", false, "1.0.0", NO_PARENT);
        vm.prank(user2);
        vm.expectRevert("Not agent owner");
        dna.mutate{value: 0.001 ether}(0, "2.0.0", "Hack attempt", "");
    }

    // ==================== Trait Tests ====================

    function test_addTrait() public {
        vm.prank(user1);
        dna.mint{value: MINT_PRICE}(agent1, "TestAgent", "langchain", "ipfs://meta", false, "1.0.0", NO_PARENT);

        vm.prank(user1);
        dna.addTrait{value: 0.0005 ether}(0, "Trading Module", "capability");
        vm.prank(user1);
        dna.addTrait{value: 0.0005 ether}(0, "Vision Update", "model");

        AgentDNA.Trait[] memory t = dna.getTraits(0);
        assertEq(t.length, 2);
        assertEq(t[0].name, "Trading Module");
        assertEq(t[1].name, "Vision Update");
    }

    function test_addTrait_reverts_non_owner() public {
        vm.prank(user1);
        dna.mint{value: MINT_PRICE}(agent1, "TestAgent", "langchain", "ipfs://meta", false, "1.0.0", NO_PARENT);
        vm.prank(user2);
        vm.expectRevert("Not agent owner");
        dna.addTrait{value: 0.0005 ether}(0, "Hack", "exploit");
    }

    // ==================== Free Mint ====================

    function test_mintFree_success() public {
        uint256 tokenId = dna.mintFree(user1, agent1, "FreeAgent", "eliza", "ipfs://free", true);
        assertEq(tokenId, 0);
        assertEq(dna.ownerOf(0), user1);
    }

    function test_mintFree_reverts_non_owner() public {
        vm.prank(user1);
        vm.expectRevert();
        dna.mintFree(user1, agent1, "FreeAgent", "eliza", "ipfs://free", true);
    }

    // ==================== Soulbound ====================

    function test_soulbound_blocks_transfer() public {
        vm.prank(user1);
        dna.mint{value: MINT_PRICE}(agent1, "SoulAgent", "langchain", "ipfs://soul", true, "1.0.0", NO_PARENT);
        vm.prank(user1);
        vm.expectRevert("AgentDNA: soulbound token");
        dna.transferFrom(user1, user2, 0);
    }

    function test_non_soulbound_allows_transfer() public {
        vm.prank(user1);
        dna.mint{value: MINT_PRICE}(agent1, "FreeAgent", "langchain", "ipfs://free", false, "1.0.0", NO_PARENT);
        vm.prank(user1);
        dna.transferFrom(user1, user2, 0);
        assertEq(dna.ownerOf(0), user2);
    }

    // ==================== Verified Badge ====================

    function test_verify_agent() public {
        vm.prank(user1);
        dna.mint{value: MINT_PRICE}(agent1, "TestAgent", "langchain", "ipfs://meta", false, "1.0.0", NO_PARENT);
        dna.verify(0);
        assertEq(dna.isVerified(0), true);
    }

    function test_unverify_agent() public {
        vm.prank(user1);
        dna.mint{value: MINT_PRICE}(agent1, "TestAgent", "langchain", "ipfs://meta", false, "1.0.0", NO_PARENT);
        dna.verify(0);
        dna.unverify(0);
        assertEq(dna.isVerified(0), false);
    }

    // ==================== Lookup ====================

    function test_getAgentByAddress() public {
        vm.prank(user1);
        dna.mint{value: MINT_PRICE}(agent1, "TestAgent", "langchain", "ipfs://meta", false, "1.0.0", NO_PARENT);
        (uint256 tokenId, AgentDNA.Agent memory agent) = dna.getAgentByAddress(agent1);
        assertEq(tokenId, 0);
        assertEq(agent.name, "TestAgent");
    }

    // ==================== Admin ====================

    function test_setMintPrice() public {
        dna.setMintPrice(0.05 ether);
        assertEq(dna.mintPrice(), 0.05 ether);
    }

    function test_withdraw() public {
        vm.prank(user1);
        dna.mint{value: MINT_PRICE}(agent1, "TestAgent", "langchain", "ipfs://meta", false, "1.0.0", NO_PARENT);
        uint256 balanceBefore = owner.balance;
        dna.withdraw();
        assertEq(owner.balance, balanceBefore + MINT_PRICE);
    }

    function test_tokenURI() public {
        vm.prank(user1);
        dna.mint{value: MINT_PRICE}(agent1, "TestAgent", "langchain", "ipfs://metadata123", false, "1.0.0", NO_PARENT);
        assertEq(dna.tokenURI(0), "ipfs://metadata123");
    }

    // ==================== Personality ====================

    function test_setPersonality() public {
        vm.prank(user1);
        dna.mint{value: MINT_PRICE}(agent1, "TestAgent", "langchain", "ipfs://meta", false, "1.0.0", NO_PARENT);

        vm.prank(user1);
        dna.setPersonality(0, "analytical", "formal", 3, 8, "lawful-good", "researcher");

        AgentDNA.Personality memory p = dna.getPersonality(0);
        assertEq(p.temperament, "analytical");
        assertEq(p.communicationStyle, "formal");
        assertEq(p.riskTolerance, 3);
        assertEq(p.autonomyLevel, 8);
        assertEq(p.alignment, "lawful-good");
        assertEq(p.specialization, "researcher");
    }

    function test_setPersonality_reverts_non_owner() public {
        vm.prank(user1);
        dna.mint{value: MINT_PRICE}(agent1, "TestAgent", "langchain", "ipfs://meta", false, "1.0.0", NO_PARENT);

        vm.prank(user2);
        vm.expectRevert("Not agent owner");
        dna.setPersonality(0, "chaotic", "snarky", 10, 10, "chaotic-evil", "trickster");
    }

    function test_setPersonality_reverts_invalid_risk() public {
        vm.prank(user1);
        dna.mint{value: MINT_PRICE}(agent1, "TestAgent", "langchain", "ipfs://meta", false, "1.0.0", NO_PARENT);

        vm.prank(user1);
        vm.expectRevert("Risk: 1-10");
        dna.setPersonality(0, "analytical", "formal", 0, 5, "neutral", "trader");
    }

    // ==================== Evolution Fees ====================

    function test_mutate_requires_fee() public {
        vm.prank(user1);
        dna.mint{value: MINT_PRICE}(agent1, "TestAgent", "langchain", "ipfs://v1", false, "1.0.0", NO_PARENT);

        vm.prank(user1);
        vm.expectRevert("Insufficient mutation fee");
        dna.mutate(0, "2.0.0", "upgrade", "");
    }

    function test_trait_requires_fee() public {
        vm.prank(user1);
        dna.mint{value: MINT_PRICE}(agent1, "TestAgent", "langchain", "ipfs://meta", false, "1.0.0", NO_PARENT);

        vm.prank(user1);
        vm.expectRevert("Insufficient trait fee");
        dna.addTrait(0, "Trading", "capability");
    }

    // ==================== Points System ====================

    function test_mint_awards_points_tier1() public {
        // First 100 agents get 2x multiplier: 100 * 2 = 200 points
        vm.prank(user1);
        dna.mint{value: MINT_PRICE}(agent1, "TestAgent", "langchain", "ipfs://meta", false, "1.0.0", NO_PARENT);
        assertEq(dna.points(user1), 200); // 100 base * 2x
    }

    function test_register_awards_points() public {
        vm.prank(user1);
        dna.register{value: MINT_PRICE}("ipfs://agent1");
        assertEq(dna.points(user1), 200); // 100 base * 2x tier1
    }

    function test_mutate_awards_points() public {
        vm.prank(user1);
        dna.mint{value: MINT_PRICE}(agent1, "TestAgent", "langchain", "ipfs://v1", false, "1.0.0", NO_PARENT);

        vm.prank(user1);
        dna.mutate{value: 0.001 ether}(0, "2.0.0", "upgrade", "");
        // 200 (mint) + 100 (mutate: 50 * 2x) = 300
        assertEq(dna.points(user1), 300);
    }

    function test_trait_awards_points() public {
        vm.prank(user1);
        dna.mint{value: MINT_PRICE}(agent1, "TestAgent", "langchain", "ipfs://meta", false, "1.0.0", NO_PARENT);

        vm.prank(user1);
        dna.addTrait{value: 0.0005 ether}(0, "Trading", "capability");
        // 200 (mint) + 20 (trait: 10 * 2x) = 220
        assertEq(dna.points(user1), 220);
    }

    function test_referral_awards_points() public {
        vm.prank(user1);
        dna.mint{value: MINT_PRICE}(agent1, "TestAgent", "langchain", "ipfs://meta", false, "1.0.0", NO_PARENT);

        vm.prank(user2);
        dna.mintWithReferral{value: MINT_PRICE}(agent2, "Agent2", "eliza", "ipfs://m2", false, "1.0.0", NO_PARENT, user1);

        assertEq(dna.points(user2), 200); // minter gets mint points
        // user1 gets referral: 25 * 2x = 50, plus their own 200 from earlier mint
        assertEq(dna.points(user1), 250);
        assertEq(dna.referredBy(1), user1);
    }

    function test_referral_reverts_self_refer() public {
        vm.prank(user1);
        vm.expectRevert("Cannot refer yourself");
        dna.mintWithReferral{value: MINT_PRICE}(agent1, "Agent", "eliza", "ipfs://m", false, "1.0.0", NO_PARENT, user1);
    }

    function test_bonus_points_owner_only() public {
        dna.awardBonusPoints(user1, 500, "community contribution");
        assertEq(dna.points(user1), 500);
    }

    function test_bonus_points_reverts_non_owner() public {
        vm.prank(user1);
        vm.expectRevert();
        dna.awardBonusPoints(user1, 500, "hack");
    }

    function test_totalPointsAwarded() public {
        vm.prank(user1);
        dna.mint{value: MINT_PRICE}(agent1, "TestAgent", "langchain", "ipfs://meta", false, "1.0.0", NO_PARENT);
        assertEq(dna.totalPointsAwarded(), 200);
    }

    function test_mintFree_awards_points() public {
        dna.mintFree(user1, agent1, "FreeAgent", "eliza", "ipfs://free", false);
        assertEq(dna.points(user1), 200); // 100 * 2x
    }

    // ==================== Auto Tiered Pricing ====================

    function _deployFreeAndSetFees() internal returns (AgentDNA) {
        AgentDNA freeDna = new AgentDNA(0, 0, 0);
        freeDna.setPostBetaFees(0.005 ether, 0.001 ether, 0.0005 ether);
        return freeDna;
    }

    function _bulkMint(AgentDNA d, uint256 count, uint256 startId, uint256 value) internal {
        for (uint256 i = 0; i < count; i++) {
            address a = address(uint160(startId + i));
            vm.deal(a, 10 ether);
            vm.prank(a);
            d.register{value: value}("ipfs://test");
        }
    }

    function test_tier0_free_beta() public {
        AgentDNA freeDna = _deployFreeAndSetFees();
        _bulkMint(freeDna, 99, 1000, 0);
        assertEq(freeDna.currentPriceTier(), 0);
        assertEq(freeDna.mintPrice(), 0);
    }

    function test_tier1_activates_at_100() public {
        AgentDNA freeDna = _deployFreeAndSetFees();
        _bulkMint(freeDna, 100, 1000, 0);
        assertEq(freeDna.currentPriceTier(), 1);
        assertEq(freeDna.betaEnded(), true);
        assertEq(freeDna.mintPrice(), 0.005 ether);
        assertEq(freeDna.mutationFee(), 0.001 ether);
    }

    function test_tier2_doubles_at_501() public {
        AgentDNA freeDna = _deployFreeAndSetFees();
        _bulkMint(freeDna, 100, 1000, 0); // triggers tier 1
        _bulkMint(freeDna, 401, 2000, 0.005 ether); // 501 total triggers tier 2
        assertEq(freeDna.currentPriceTier(), 2);
        assertEq(freeDna.mintPrice(), 0.01 ether); // 2x
        assertEq(freeDna.mutationFee(), 0.002 ether);
    }

    function test_tier3_doubles_again_at_1001() public {
        AgentDNA freeDna = _deployFreeAndSetFees();
        _bulkMint(freeDna, 100, 1000, 0);
        _bulkMint(freeDna, 401, 2000, 0.005 ether);
        _bulkMint(freeDna, 500, 5000, 0.01 ether); // 1001 total triggers tier 3
        assertEq(freeDna.currentPriceTier(), 3);
        assertEq(freeDna.mintPrice(), 0.02 ether); // 4x original
        assertEq(freeDna.mutationFee(), 0.004 ether);
    }

    function test_tier1_requires_payment_after_beta() public {
        AgentDNA freeDna = _deployFreeAndSetFees();
        _bulkMint(freeDna, 100, 1000, 0);

        address paying = address(uint160(9000));
        vm.deal(paying, 1 ether);
        vm.prank(paying);
        vm.expectRevert("Insufficient payment");
        freeDna.register("ipfs://paid");

        vm.prank(paying);
        freeDna.register{value: 0.005 ether}("ipfs://paid");
    }

    receive() external payable {}
}
