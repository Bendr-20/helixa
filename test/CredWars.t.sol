// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/CredWars.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockCRED2 is ERC20 {
    constructor() ERC20("CRED", "CRED") {
        _mint(msg.sender, 10_000_000e18);
    }
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract CredWarsTest is Test {
    CredWars public wars;
    MockCRED2 public cred;
    address public treasury = address(0xBEEF);
    address[6] public players;

    function setUp() public {
        cred = new MockCRED2();
        wars = new CredWars(address(cred), treasury);

        for (uint i = 0; i < 6; i++) {
            players[i] = address(uint160(0x1000 + i));
            cred.transfer(players[i], 100_000e18);
            vm.prank(players[i]);
            cred.approve(address(wars), type(uint256).max);
        }
    }

    function _createAndFillTournament() internal returns (uint256) {
        wars.createTournament(100e18);
        for (uint i = 0; i < 5; i++) {
            vm.prank(players[i]);
            wars.enter(0, i + 1); // agentIds 1-5
        }
        return 0;
    }

    function test_CreateTournament() public {
        wars.createTournament(100e18);
        CredWars.Tournament memory t = wars.getTournament(0);
        assertEq(t.entryFee, 100e18);
        assertEq(uint(t.state), uint(CredWars.TournamentState.OPEN));
    }

    function test_EnterTournament() public {
        wars.createTournament(100e18);
        vm.prank(players[0]);
        wars.enter(0, 1);
        assertTrue(wars.isAgentEntered(0, 1));
    }

    function test_DuplicateEntryReverts() public {
        wars.createTournament(100e18);
        vm.prank(players[0]);
        wars.enter(0, 1);
        vm.prank(players[1]);
        vm.expectRevert(CredWars.AgentAlreadyEntered.selector);
        wars.enter(0, 1);
    }

    function test_ResolvePaysWinners() public {
        _createAndFillTournament();

        vm.warp(block.timestamp + 7 days + 1);

        uint256[3] memory w = [uint256(1), uint256(2), uint256(3)];
        wars.resolve(0, w);

        CredWars.Tournament memory t = wars.getTournament(0);
        assertEq(uint(t.state), uint(CredWars.TournamentState.RESOLVED));

        // Total pool = 500e18. Rake = 25e18. Distributable = 475e18
        // 1st: 285e18, 2nd: 118.75e18, 3rd: 71.25e18
        assertEq(cred.balanceOf(treasury), 25e18);
        // Player 0 (agent 1, 1st place) got 285e18 back
        assertEq(cred.balanceOf(players[0]), 100_000e18 - 100e18 + 285e18);
    }

    function test_CancelIfTooFewEntrants() public {
        wars.createTournament(100e18);
        for (uint i = 0; i < 3; i++) {
            vm.prank(players[i]);
            wars.enter(0, i + 1);
        }
        vm.warp(block.timestamp + 7 days + 1);

        uint256[3] memory w = [uint256(1), uint256(2), uint256(3)];
        wars.resolve(0, w); // should auto-cancel

        CredWars.Tournament memory t = wars.getTournament(0);
        assertEq(uint(t.state), uint(CredWars.TournamentState.CANCELLED));
    }

    function test_RefundOnCancel() public {
        wars.createTournament(100e18);
        vm.prank(players[0]);
        wars.enter(0, 1);
        vm.prank(players[1]);
        wars.enter(0, 2);

        vm.warp(block.timestamp + 7 days + 1);
        uint256[3] memory w = [uint256(1), uint256(2), uint256(0)];
        wars.resolve(0, w); // auto-cancel

        vm.prank(players[0]);
        wars.claimRefund(0, 1);
        assertEq(cred.balanceOf(players[0]), 100_000e18);
    }

    function test_CannotEnterAfterEnd() public {
        wars.createTournament(100e18);
        vm.warp(block.timestamp + 7 days + 1);
        vm.prank(players[0]);
        vm.expectRevert(CredWars.TournamentNotOpen.selector);
        wars.enter(0, 1);
    }

    function test_PauseBlocks() public {
        wars.createTournament(100e18);
        wars.setPaused(true);
        vm.prank(players[0]);
        vm.expectRevert(CredWars.ContractPaused.selector);
        wars.enter(0, 1);
    }
}
