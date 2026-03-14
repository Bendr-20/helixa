// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/v2/HelixaEvaluator.sol";

contract DeployStatusNetwork2 is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_KEY");
        vm.startBroadcast(pk);

        // Use already-deployed mocks from previous run
        address oracle = 0x85BbAC72D26751bb0dc76eeDd8972a77386c9267;
        address helixa = 0x53958d4430718c167816B1145EEBF70afF818404;

        HelixaEvaluator evaluator = new HelixaEvaluator(
            oracle,
            helixa,
            50,
            10
        );

        console.log("Evaluator:", address(evaluator));

        vm.stopBroadcast();
    }
}
