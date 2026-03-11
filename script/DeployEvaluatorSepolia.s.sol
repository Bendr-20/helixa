// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/v2/HelixaEvaluator.sol";

/// @notice Mock CredOracle for testnet — owner can set arbitrary scores
contract MockCredOracle is ICredOracle {
    mapping(uint256 => uint8) public scores;
    address public owner;

    constructor() { owner = msg.sender; }

    function setScore(uint256 tokenId, uint8 score) external {
        require(msg.sender == owner, "not owner");
        scores[tokenId] = score;
    }

    function getCredScore(uint256 tokenId) external view returns (uint8) {
        return scores[tokenId];
    }
}

/// @notice Mock HelixaV2 for testnet — owner can assign token ownership
contract MockHelixaV2 is IHelixaV2 {
    mapping(uint256 => address) public owners;
    uint256 public total;
    address public admin;

    constructor() { admin = msg.sender; }

    function assignOwner(uint256 tokenId, address wallet) external {
        require(msg.sender == admin, "not admin");
        owners[tokenId] = wallet;
        if (tokenId >= total) total = tokenId + 1;
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        return owners[tokenId];
    }

    function totalAgents() external view returns (uint256) {
        return total;
    }
}

/// @notice Minimal mock ERC-8183 Job contract for testing evaluate()
contract MockJob is IERC8183Job {
    struct JobResult {
        bool completed;
        bool rejected;
        bytes32 reason;
    }
    mapping(uint256 => JobResult) public results;

    function complete(uint256 jobId, bytes32 reason) external {
        results[jobId] = JobResult(true, false, reason);
    }

    function reject(uint256 jobId, bytes32 reason) external {
        results[jobId] = JobResult(false, true, reason);
    }
}

contract DeployEvaluatorSepolia is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_KEY");
        vm.startBroadcast(pk);

        // Deploy mocks
        MockCredOracle oracle = new MockCredOracle();
        MockHelixaV2 helixa = new MockHelixaV2();
        MockJob job = new MockJob();

        // Deploy evaluator: autoComplete=50, providerMin=10
        HelixaEvaluator evaluator = new HelixaEvaluator(
            address(oracle),
            address(helixa),
            50,  // autoCompleteThreshold
            10   // providerMinCred
        );

        // Trust the mock job contract
        evaluator.setTrustedJobContract(address(job), true);

        // Set up tiers: ≤100 needs cred 30, ≤1000 needs cred 50, ≤10000 needs cred 80
        HelixaEvaluator.TierThreshold[] memory t = new HelixaEvaluator.TierThreshold[](3);
        t[0] = HelixaEvaluator.TierThreshold(100, 30);
        t[1] = HelixaEvaluator.TierThreshold(1000, 50);
        t[2] = HelixaEvaluator.TierThreshold(10000, 80);
        evaluator.setTiers(t);

        vm.stopBroadcast();

        console.log("=== Deployed to Base Sepolia ===");
        console.log("MockCredOracle:", address(oracle));
        console.log("MockHelixaV2:  ", address(helixa));
        console.log("MockJob:       ", address(job));
        console.log("Evaluator:     ", address(evaluator));
    }
}
