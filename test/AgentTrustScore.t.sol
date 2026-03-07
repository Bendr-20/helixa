// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/AgentDNA.sol";
import "../src/AgentTrustScore.sol";

contract MockRegistry is ICrossRegistry {
    mapping(address => bool) public registered;
    function setRegistered(address a, bool v) external { registered[a] = v; }
    function isRegistered(address a) external view returns (bool) { return registered[a]; }
}

contract AgentTrustScoreTest is Test {
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    AgentDNA dna;
    AgentTrustScore trust;
    MockRegistry mockReg;

    address owner = address(this);
    address agent1Addr = address(0xA1);
    address agent2Addr = address(0xA2);

    function setUp() public {
        dna = new AgentDNA(0, 0, 0); // free mint, free fees
        mockReg = new MockRegistry();
        trust = new AgentTrustScore(address(dna), address(0)); // no registry initially
    }

    function _mintBasic(address agentAddr) internal returns (uint256) {
        return dna.mint(agentAddr, "TestAgent", "TestFW", "ipfs://test", false, "1.0.0", type(uint256).max);
    }

    function _mintFull(address agentAddr, bool soulbound) internal returns (uint256) {
        uint256 id = dna.mint(agentAddr, "FullAgent", "LangChain", "ipfs://full", soulbound, "1.0.0", type(uint256).max);
        
        // Add traits (5 across 3 categories)
        dna.addTrait(id, "speed", "physical");
        dna.addTrait(id, "accuracy", "physical");
        dna.addTrait(id, "logic", "cognitive");
        dna.addTrait(id, "creativity", "cognitive");
        dna.addTrait(id, "empathy", "social");

        // Mutations (3)
        dna.mutate(id, "1.1.0", "upgrade1", "");
        dna.mutate(id, "1.2.0", "upgrade2", "");
        dna.mutate(id, "2.0.0", "major", "");

        // Personality (all 6 fields)
        dna.setPersonality(id, "analytical", "formal", 7, 8, "lawful-good", "researcher");

        // Verify
        dna.verify(id);

        return id;
    }

    function testEmptyAgentLowScore() public {
        uint256 id = _mintBasic(agent1Addr);
        uint256 score = trust.getTrustScore(id);
        // Empty agent: no traits, no personality, not verified, not soulbound, just minted
        // Activity: 0, TraitDepth: 0, Verification: 0, Soulbound: 0, Age: 0
        // OwnerStability: 5 (not self-sovereign since owner != agentAddress)
        // With registry=0, redistribute: 5 * 100/90 = 5
        assertLe(score, 10, "Empty agent should score low");
    }

    function testFullyLoadedAgent() public {
        uint256 id = _mintFull(agent1Addr, true);
        vm.warp(block.timestamp + 30 days);
        uint256 score = trust.getTrustScore(id);
        // With registry=0, max raw = 90, scaled to ~100
        assertGe(score, 90, "Fully loaded agent should score high");
    }

    function testActivityComponent() public {
        uint256 id = _mintBasic(agent1Addr);
        
        // Add 1 mutation → 5pts
        dna.mutate(id, "1.1.0", "up", "");
        (uint256 activity,,,,,,) = trust.getScoreBreakdown(id);
        // With scaling (registry=0): 5 * 100/90 = 5
        assertGe(activity, 5);

        // Add traits
        dna.addTrait(id, "t1", "c1");
        dna.addTrait(id, "t2", "c1");
        dna.addTrait(id, "t3", "c2");
        (activity,,,,,,) = trust.getScoreBreakdown(id);
        // mutation(5) + traits3(7) = 12, scaled
        assertGe(activity, 12);
    }

    function testVerificationComponent() public {
        uint256 id = _mintBasic(agent1Addr);
        (,,uint256 v,,,,) = trust.getScoreBreakdown(id);
        assertEq(v, 0);

        dna.verify(id);
        (,,v,,,,) = trust.getScoreBreakdown(id);
        assertGt(v, 0);
    }

    function testSoulboundComponent() public {
        uint256 id = dna.mint(agent1Addr, "SB", "fw", "ipfs://sb", true, "1.0.0", type(uint256).max);
        (,,,uint256 sb,,,) = trust.getScoreBreakdown(id);
        assertGt(sb, 0);
    }

    function testAgeScaling() public {
        uint256 id = _mintBasic(agent1Addr);
        (,,,,uint256 age,,) = trust.getScoreBreakdown(id);
        assertEq(age, 0, "Age should be 0 at mint");

        vm.warp(block.timestamp + 15 days);
        (,,,,age,,) = trust.getScoreBreakdown(id);
        assertGt(age, 0, "Age should increase");

        vm.warp(block.timestamp + 30 days);
        (,,,,age,,) = trust.getScoreBreakdown(id);
        // With scaling: 10 * 100/90 = 11
        assertGe(age, 10, "Age should be maxed after 30 days");
    }

    function testBreakdownMatchesTotal() public {
        uint256 id = _mintFull(agent1Addr, true);
        vm.warp(block.timestamp + 15 days);

        uint256 total = trust.getTrustScore(id);
        (uint256 a, uint256 b, uint256 c, uint256 d, uint256 e, uint256 f, uint256 g) = trust.getScoreBreakdown(id);
        assertEq(total, a + b + c + d + e + f + g, "Breakdown should match total");
    }

    function testNoRegistryRedistributes() public {
        // crossRegistry should be 0 when registry is address(0)
        uint256 id = _mintBasic(agent1Addr);
        (,,,,,,uint256 cr) = trust.getScoreBreakdown(id);
        assertEq(cr, 0, "Cross-registry should be 0 with no registry");
    }

    function testWithRegistry() public {
        trust.setRegistry(address(mockReg));
        uint256 id = _mintBasic(agent1Addr);

        (,,,,,,uint256 cr) = trust.getScoreBreakdown(id);
        assertEq(cr, 0, "Not registered yet");

        mockReg.setRegistered(agent1Addr, true);
        (,,,,,,cr) = trust.getScoreBreakdown(id);
        assertEq(cr, 10, "Should get 10 pts when registered");
    }

    function testSetRegistryAccessControl() public {
        address notOwner = address(0xBEEF);
        vm.prank(notOwner);
        vm.expectRevert();
        trust.setRegistry(address(mockReg));
    }

    function testOwnerStabilitySelfSovereign() public {
        // When owner == agentAddress, should get max stability
        // We need to prank as agentAddress to make owner == agentAddress
        // Actually the mint sets msg.sender as owner, agentAddress is a different address
        // So for self-sovereign: mint from agentAddress itself
        vm.deal(agent1Addr, 1 ether);
        vm.prank(agent1Addr);
        uint256 id = dna.mint(agent1Addr, "Self", "fw", "ipfs://s", false, "1.0.0", type(uint256).max);
        
        trust.setRegistry(address(mockReg)); // set registry so no redistribution
        (,,,,,uint256 os,) = trust.getScoreBreakdown(id);
        assertEq(os, 10, "Self-sovereign should get 10");
    }

    function testScoreCappedAt100() public {
        uint256 id = _mintFull(agent1Addr, true);
        vm.warp(block.timestamp + 60 days);
        uint256 score = trust.getTrustScore(id);
        assertLe(score, 100, "Score should not exceed 100");
    }
}
