// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/AgentDNA.sol";

contract DeployAgentDNA is Script {
    function run() external {
        uint256 mintPrice = 0; // Free mint during beta
        uint256 mutationFee = 0;
        uint256 traitFee = 0;
        
        vm.startBroadcast();
        
        AgentDNA dna = new AgentDNA(mintPrice, mutationFee, traitFee);
        
        // Set treasury to team wallet
        dna.setTreasury(0x01b686e547F4feA03BfC9711B7B5306375735d2a);
        
        console.log("AgentDNA deployed to:", address(dna));
        console.log("Mint price:", mintPrice);
        console.log("Owner:", dna.owner());
        console.log("Treasury:", dna.treasury());
        
        vm.stopBroadcast();
    }
}
