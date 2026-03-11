// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/v2/HelixaEvaluator.sol";

contract DeployEvaluatorMainnet is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_KEY");
        vm.startBroadcast(pk);

        // Real mainnet contracts
        address credOracle = 0xD77354Aebea97C65e7d4a605f91737616FFA752f;
        address helixaV2   = 0x2e3B541C59D38b84E3Bc54e977200230A204Fe60;

        // Deploy evaluator: autoComplete=50, providerMin=10
        HelixaEvaluator evaluator = new HelixaEvaluator(
            credOracle,
            helixaV2,
            50,  // autoCompleteThreshold
            10   // providerMinCred
        );

        // Set up tiers: ≤100 needs cred 30, ≤1000 needs cred 50, ≤10000 needs cred 80
        HelixaEvaluator.TierThreshold[] memory t = new HelixaEvaluator.TierThreshold[](3);
        t[0] = HelixaEvaluator.TierThreshold(100, 30);
        t[1] = HelixaEvaluator.TierThreshold(1000, 50);
        t[2] = HelixaEvaluator.TierThreshold(10000, 80);
        evaluator.setTiers(t);

        vm.stopBroadcast();

        console.log("=== Deployed to Base Mainnet ===");
        console.log("CredOracle:  ", credOracle);
        console.log("HelixaV2:    ", helixaV2);
        console.log("Evaluator:   ", address(evaluator));
    }
}
