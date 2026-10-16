// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {MissionEscrowV1} from "../src/missions/MissionEscrowV1.sol";
import {MissionTypes} from "../src/missions/MissionTypes.sol";

contract InvariantToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
    function transfer(address to, uint256 amount) external returns (bool) { balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true; }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true;
    }
}

contract InvariantActor {
    function approveToken(InvariantToken token, address spender, uint256 amount) external { token.approve(spender, amount); }
    function fund(MissionEscrowV1 vault, address token, uint256 amount) external { vault.fund(token, amount); }
    function approveLaunch(MissionEscrowV1 vault) external { vault.approveLaunch(); }
}

contract MissionEscrowInvariant {
    MissionEscrowV1 public vault;
    InvariantToken public token;

    constructor() {
        token = new InvariantToken();
        InvariantActor owner = new InvariantActor();
        InvariantActor lead = new InvariantActor();
        MissionTypes.MemberTerms[] memory members = new MissionTypes.MemberTerms[](1);
        members[0] = MissionTypes.MemberTerms(block.chainid, address(0x1001), 1, address(0x1002), address(0x1003), 1, address(0x1004), keccak256("lead"), true);
        MissionTypes.Allocation[] memory payout = new MissionTypes.Allocation[](1);
        payout[0] = MissionTypes.Allocation(address(token), address(0x1004), 100);
        MissionTypes.Allocation[] memory timeout = new MissionTypes.Allocation[](1);
        timeout[0] = MissionTypes.Allocation(address(token), address(0x2001), 100);
        MissionTypes.MilestoneTerms[] memory milestones = new MissionTypes.MilestoneTerms[](1);
        milestones[0] = MissionTypes.MilestoneTerms(keccak256("m1"), keccak256("accept"), keccak256("payout"), uint64(block.timestamp + 300), uint64(block.timestamp + 400), uint64(block.timestamp + 500), payout, timeout, timeout);
        vault = new MissionEscrowV1(keccak256("mission"), keccak256("v1"), address(owner), address(0x2001), address(lead), address(0x3001), uint64(block.timestamp + 100), uint64(block.timestamp + 200), members, milestones);
        token.mint(address(owner), 100);
        owner.approveToken(token, address(vault), 100);
        owner.fund(vault, address(token), 100);
        owner.approveLaunch(vault);
        lead.approveLaunch(vault);
    }

    function invariant_conservation() external view {
        assert(vault.totalReleased(address(token)) + vault.totalRefunded(address(token)) + vault.remainingLiability(address(token)) == vault.totalFunded(address(token)));
        assert(token.balanceOf(address(vault)) >= vault.remainingLiability(address(token)));
    }
}
