// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/AgentNames.sol";

contract AgentNamesTest is Test {
    AgentNames names;
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    function setUp() public {
        names = new AgentNames(address(0x1234));
    }

    function test_register() public {
        vm.prank(alice);
        names.register("myagent");
        
        assertEq(names.resolve("myagent"), alice);
        assertEq(names.owner("myagent"), alice);
        assertTrue(!names.available("myagent"));
        assertEq(names.totalNames(), 1);
    }

    function test_primaryNameAutoSet() public {
        vm.prank(alice);
        names.register("myagent");
        assertEq(names.reverseName(alice), "myagent");
    }

    function test_registerFor() public {
        names.registerFor("sponsored", alice);
        assertEq(names.owner("sponsored"), alice);
        assertEq(names.resolve("sponsored"), alice);
    }

    function test_duplicateReverts() public {
        vm.prank(alice);
        names.register("taken");
        
        vm.prank(bob);
        vm.expectRevert(AgentNames.NameTaken.selector);
        names.register("taken");
    }

    function test_invalidName_spaces() public {
        vm.prank(alice);
        vm.expectRevert(AgentNames.InvalidName.selector);
        names.register("my agent");
    }

    function test_invalidName_uppercase() public {
        vm.prank(alice);
        vm.expectRevert(AgentNames.InvalidName.selector);
        names.register("MyAgent");
    }

    function test_invalidName_startHyphen() public {
        vm.prank(alice);
        vm.expectRevert(AgentNames.InvalidName.selector);
        names.register("-start");
    }

    function test_invalidName_tooShort() public {
        vm.prank(alice);
        vm.expectRevert(AgentNames.InvalidName.selector);
        names.register("ab");
    }

    function test_validNames() public {
        assertTrue(names.available("bendr"));
        assertTrue(names.available("my-agent"));
        assertTrue(names.available("agent42"));
    }

    function test_setResolve() public {
        vm.prank(alice);
        names.register("myagent");
        
        vm.prank(alice);
        names.setResolve("myagent", bob);
        assertEq(names.resolve("myagent"), bob);
    }

    function test_linkAgent() public {
        vm.prank(alice);
        names.register("myagent");
        
        vm.prank(alice);
        names.linkAgent("myagent", 42);
        assertEq(names.agentId("myagent"), 42);
    }

    function test_transfer() public {
        vm.prank(alice);
        names.register("myagent");
        
        vm.prank(alice);
        names.transfer("myagent", bob);
        assertEq(names.owner("myagent"), bob);
        assertEq(names.resolve("myagent"), bob);
    }

    function test_setPrimary() public {
        vm.prank(alice);
        names.register("first");
        vm.prank(alice);
        names.register("second");
        
        // Primary should be "first" (auto-set)
        assertEq(names.reverseName(alice), "first");
        
        vm.prank(alice);
        names.setPrimary("second");
        assertEq(names.reverseName(alice), "second");
    }

    function test_notOwnerReverts() public {
        vm.prank(alice);
        names.register("myagent");
        
        vm.prank(bob);
        vm.expectRevert(AgentNames.NotNameOwner.selector);
        names.setResolve("myagent", bob);
    }

    function test_available() public {
        assertTrue(names.available("newname"));
        
        vm.prank(alice);
        names.register("newname");
        assertFalse(names.available("newname"));
    }

    function test_transferClearsPrimary() public {
        vm.prank(alice);
        names.register("myagent");
        assertEq(names.reverseName(alice), "myagent");
        
        vm.prank(alice);
        names.transfer("myagent", bob);
        assertEq(names.reverseName(alice), "");
        assertEq(names.reverseName(bob), "myagent");
    }
}
