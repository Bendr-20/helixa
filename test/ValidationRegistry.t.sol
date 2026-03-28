// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Test.sol";
import "../contracts/ValidationRegistry.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract ValidationRegistryTest is Test {
    ValidationRegistry public impl;
    ValidationRegistry public registry;

    address admin      = address(0xA);
    address validator1 = address(0xB);
    address validator2 = address(0xC);
    address agent1     = address(0x1);
    address agent2     = address(0x2);
    address nobody     = address(0xD);

    bytes32 VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");

    function setUp() public {
        impl = new ValidationRegistry();
        bytes memory data = abi.encodeCall(ValidationRegistry.initialize, (admin));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), data);
        registry = ValidationRegistry(address(proxy));

        vm.startPrank(admin);
        registry.grantRole(VALIDATOR_ROLE, validator1);
        vm.stopPrank();
    }

    // ── Initialization ───────────────────────────────────────────────────
    function test_initialize() public view {
        assertTrue(registry.hasRole(registry.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(registry.hasRole(VALIDATOR_ROLE, admin));
        assertEq(registry.nextValidationId(), 1);
    }

    function test_cannotReinitialize() public {
        vm.expectRevert();
        registry.initialize(admin);
    }

    // ── Submit validation ────────────────────────────────────────────────
    function test_submitValidation() public {
        vm.prank(validator1);
        uint256 id = registry.submitValidation(agent1, "identity", hex"deadbeef");

        assertEq(id, 1);
        assertEq(registry.nextValidationId(), 2);

        ValidationRegistry.Validation memory v = registry.getValidation(1);
        assertEq(v.id, 1);
        assertEq(v.validator, validator1);
        assertEq(v.validationType, "identity");
        assertEq(v.evidence, hex"deadbeef");
        assertFalse(v.revoked);
    }

    function test_submitValidation_emitsEvent() public {
        vm.prank(validator1);
        vm.expectEmit(true, true, true, true);
        emit ValidationRegistry.ValidationSubmitted(1, agent1, validator1, "security", block.timestamp);
        registry.submitValidation(agent1, "security", "");
    }

    function test_submitValidation_revertsIfNotValidator() public {
        vm.prank(nobody);
        vm.expectRevert();
        registry.submitValidation(agent1, "identity", "");
    }

    function test_submitValidation_revertsIfZeroAddress() public {
        vm.prank(validator1);
        vm.expectRevert(ValidationRegistry.ZeroAddress.selector);
        registry.submitValidation(address(0), "identity", "");
    }

    function test_submitValidation_revertsIfEmptyType() public {
        vm.prank(validator1);
        vm.expectRevert(ValidationRegistry.EmptyValidationType.selector);
        registry.submitValidation(agent1, "", "");
    }

    // ── isValidated ──────────────────────────────────────────────────────
    function test_isValidated() public {
        assertFalse(registry.isValidated(agent1, "identity"));

        vm.prank(validator1);
        registry.submitValidation(agent1, "identity", "");

        assertTrue(registry.isValidated(agent1, "identity"));
        assertFalse(registry.isValidated(agent1, "security"));
    }

    // ── Revocation ───────────────────────────────────────────────────────
    function test_revokeValidation() public {
        vm.prank(validator1);
        uint256 id = registry.submitValidation(agent1, "identity", "");

        assertTrue(registry.isValidated(agent1, "identity"));

        vm.prank(validator1);
        registry.revokeValidation(agent1, id);

        assertFalse(registry.isValidated(agent1, "identity"));

        ValidationRegistry.Validation memory v = registry.getValidation(id);
        assertTrue(v.revoked);
    }

    function test_revokeValidation_emitsEvent() public {
        vm.prank(validator1);
        uint256 id = registry.submitValidation(agent1, "identity", "");

        vm.prank(validator1);
        vm.expectEmit(true, true, true, true);
        emit ValidationRegistry.ValidationRevoked(id, agent1, validator1, block.timestamp);
        registry.revokeValidation(agent1, id);
    }

    function test_revokeValidation_revertsIfNotOriginalValidator() public {
        vm.prank(validator1);
        uint256 id = registry.submitValidation(agent1, "identity", "");

        vm.prank(admin);
        registry.grantRole(VALIDATOR_ROLE, validator2);

        vm.prank(validator2);
        vm.expectRevert(abi.encodeWithSelector(ValidationRegistry.NotOriginalValidator.selector, id));
        registry.revokeValidation(agent1, id);
    }

    function test_revokeValidation_revertsIfAlreadyRevoked() public {
        vm.prank(validator1);
        uint256 id = registry.submitValidation(agent1, "identity", "");

        vm.prank(validator1);
        registry.revokeValidation(agent1, id);

        vm.prank(validator1);
        vm.expectRevert(abi.encodeWithSelector(ValidationRegistry.AlreadyRevoked.selector, id));
        registry.revokeValidation(agent1, id);
    }

    function test_revokeValidation_revertsIfWrongAgent() public {
        vm.prank(validator1);
        uint256 id = registry.submitValidation(agent1, "identity", "");

        vm.prank(validator1);
        vm.expectRevert(abi.encodeWithSelector(ValidationRegistry.ValidationNotFound.selector, id));
        registry.revokeValidation(agent2, id);
    }

    function test_revokeValidation_revertsIfNotFound() public {
        vm.prank(validator1);
        vm.expectRevert(abi.encodeWithSelector(ValidationRegistry.ValidationNotFound.selector, 999));
        registry.revokeValidation(agent1, 999);
    }

    // ── getValidations ───────────────────────────────────────────────────
    function test_getValidations() public {
        vm.startPrank(validator1);
        registry.submitValidation(agent1, "identity", "");
        registry.submitValidation(agent1, "security", hex"cafe");
        registry.submitValidation(agent1, "compliance", "");
        vm.stopPrank();

        ValidationRegistry.Validation[] memory vals = registry.getValidations(agent1);
        assertEq(vals.length, 3);
        assertEq(vals[0].validationType, "identity");
        assertEq(vals[1].validationType, "security");
        assertEq(vals[2].validationType, "compliance");
    }

    function test_getValidationCount() public {
        assertEq(registry.getValidationCount(agent1), 0);

        vm.prank(validator1);
        registry.submitValidation(agent1, "identity", "");
        assertEq(registry.getValidationCount(agent1), 1);
    }

    // ── Multiple validations of same type ────────────────────────────────
    function test_multipleValidationsSameType() public {
        vm.prank(admin);
        registry.grantRole(VALIDATOR_ROLE, validator2);

        vm.prank(validator1);
        uint256 id1 = registry.submitValidation(agent1, "identity", "");

        vm.prank(validator2);
        registry.submitValidation(agent1, "identity", "");

        assertTrue(registry.isValidated(agent1, "identity"));

        // Revoke one — still validated because second exists
        vm.prank(validator1);
        registry.revokeValidation(agent1, id1);
        assertTrue(registry.isValidated(agent1, "identity"));
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

    // ── Custom validation types ──────────────────────────────────────────
    function test_customValidationType() public {
        vm.prank(validator1);
        registry.submitValidation(agent1, "custom-audit-v2", hex"1234");
        assertTrue(registry.isValidated(agent1, "custom-audit-v2"));
    }
}
