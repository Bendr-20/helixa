// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../SoulSovereignV3.sol";

contract DeploySoulSovereignV3 is Script {
    function run() external {
        // HelixaV2 on Base mainnet
        address helixa = 0x2e3B541C59D38b84E3Bc54e977200230A204Fe60;

        vm.startBroadcast();
        SoulSovereignV3 soul = new SoulSovereignV3(helixa);
        vm.stopBroadcast();

        console.log("SoulSovereignV3 deployed at:", address(soul));
    }
}
