// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/v2/HelixaEvaluator.sol";

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

contract DeployStatusNetwork is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_KEY");
        vm.startBroadcast(pk);

        MockCredOracle oracle = new MockCredOracle();
        MockHelixaV2 helixa = new MockHelixaV2();

        HelixaEvaluator evaluator = new HelixaEvaluator(
            address(oracle),
            address(helixa),
            50,
            10
        );

        vm.stopBroadcast();

        console.log("MockCredOracle:", address(oracle));
        console.log("MockHelixaV2:  ", address(helixa));
        console.log("Evaluator:     ", address(evaluator));
    }
}
