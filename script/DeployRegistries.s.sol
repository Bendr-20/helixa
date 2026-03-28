// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../contracts/ReputationRegistry.sol";
import "../contracts/ValidationRegistry.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @notice Deploy ReputationRegistry and ValidationRegistry behind UUPS proxies.
 *
 * Usage:
 *   forge script script/DeployRegistries.s.sol:DeployRegistries \
 *     --rpc-url $BASE_RPC --broadcast --verify \
 *     -vvvv
 *
 * Environment variables:
 *   DEPLOYER_PRIVATE_KEY  - deployer/admin private key
 *   IDENTITY_REGISTRY     - (optional) V2 identity contract address
 */
contract DeployRegistries is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address admin = vm.addr(deployerKey);
        address identityRegistry = vm.envOr("IDENTITY_REGISTRY", address(0));

        vm.startBroadcast(deployerKey);

        // ── Reputation Registry ──────────────────────────────────────────
        ReputationRegistry repImpl = new ReputationRegistry();
        ERC1967Proxy repProxy = new ERC1967Proxy(
            address(repImpl),
            abi.encodeCall(ReputationRegistry.initialize, (admin))
        );
        ReputationRegistry reputation = ReputationRegistry(address(repProxy));

        if (identityRegistry != address(0)) {
            reputation.setIdentityRegistry(identityRegistry);
        }

        // ── Validation Registry ──────────────────────────────────────────
        ValidationRegistry valImpl = new ValidationRegistry();
        ERC1967Proxy valProxy = new ERC1967Proxy(
            address(valImpl),
            abi.encodeCall(ValidationRegistry.initialize, (admin))
        );
        ValidationRegistry validation = ValidationRegistry(address(valProxy));

        if (identityRegistry != address(0)) {
            validation.setIdentityRegistry(identityRegistry);
        }

        vm.stopBroadcast();

        console.log("=== Deployment Complete ===");
        console.log("Reputation Impl:    ", address(repImpl));
        console.log("Reputation Proxy:   ", address(repProxy));
        console.log("Validation Impl:    ", address(valImpl));
        console.log("Validation Proxy:   ", address(valProxy));
        console.log("Admin:              ", admin);
        console.log("Identity Registry:  ", identityRegistry);
    }
}
