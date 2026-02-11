// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/AgentNames.sol";

contract AgentNamesTest is Test {
    AgentNames names;
    address owner = address(this);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    function setUp() public {
        names = new AgentNames(address(0x1234));
    }

    function test_register() public {
        vm.prank(alice);
        names.register("myagent", alice, 0);
        
        assertEq(names.resolve("myagent"), alice);
        assertEq(names.nameOwner("myagent"), alice);
        assertEq(names.nameTokenId("myagent"), 0);
        assertTrue(names.nameExists("myagent"));
        assertEq(names.totalNames(), 1);
    }

    function test_primaryName() public {
        vm.prank(alice);
        names.register("myagent", alice, 0);
        assertEq(names.primaryName(alice), "myagent");
    }

    function test_reverseLookup() public {
        vm.prank(alice);
        names.register("myagent", alice, 0);
        assertEq(names.reverseLookup(alice), "myagent");
    }

    function test_registerFor() public {
        names.registerFor(alice, "sponsored", alice, 1);
        assertEq(names.nameOwner("sponsored"), alice);
        assertEq(names.resolve("sponsored"), alice);
    }

    function test_duplicateName() public {
        vm.prank(alice);
        names.register("taken", alice, 0);
        
        vm.prank(bob);
        vm.expectRevert("Name taken");
        names.register("taken", bob, 1);
    }

    function test_invalidChars() public {
        vm.prank(alice);
        vm.expectRevert("Invalid chars");
        names.register("My Agent", alice, 0); // spaces not allowed
    }

    function test_hyphenRules() public {
        vm.prank(alice);
        vm.expectRevert("Invalid chars");
        names.register("-start", alice, 0);
    }

    function test_validNames() public view {
        assertTrue(names.available("bendr"));
        assertTrue(names.available("my-agent"));
        assertTrue(names.available("agent42"));
        assertFalse(names.available("")); // too short
        assertFalse(names.available("a]b")); // invalid char
    }

    function test_setAddress() public {
        vm.prank(alice);
        names.register("myagent", alice, 0);
        
        vm.prank(alice);
        names.setAddress("myagent", bob);
        assertEq(names.resolve("myagent"), bob);
    }

    function test_setRecord() public {
        vm.prank(alice);
        names.register("myagent", alice, 0);
        
        vm.prank(alice);
        names.setRecord("myagent", "url", "https://helixa.xyz");
        assertEq(names.getRecord("myagent", "url"), "https://helixa.xyz");
    }

    function test_transfer() public {
        vm.prank(alice);
        names.register("myagent", alice, 0);
        
        vm.prank(alice);
        names.transfer("myagent", bob);
        assertEq(names.nameOwner("myagent"), bob);
    }

    function test_available() public {
        assertTrue(names.available("newname"));
        
        vm.prank(alice);
        names.register("newname", alice, 0);
        assertFalse(names.available("newname"));
    }

    function test_getNameInfo() public {
        vm.prank(alice);
        names.register("myagent", alice, 0);
        
        (address o, address r, uint256 tid, bool exists) = names.getNameInfo("myagent");
        assertEq(o, alice);
        assertEq(r, alice);
        assertEq(tid, 0);
        assertTrue(exists);
    }

    function test_onlyOwnerCanSetRecord() public {
        vm.prank(alice);
        names.register("myagent", alice, 0);
        
        vm.prank(bob);
        vm.expectRevert("Not authorized");
        names.setRecord("myagent", "url", "hacked");
    }

    function test_ownerCanSetAnyRecord() public {
        vm.prank(alice);
        names.register("myagent", alice, 0);
        
        // Contract owner (this) can set records for any name
        names.setRecord("myagent", "verified", "true");
        assertEq(names.getRecord("myagent", "verified"), "true");
    }
}
