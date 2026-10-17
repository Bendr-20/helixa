// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {MissionEscrowV1} from "../src/missions/MissionEscrowV1.sol";
import {MissionTypes} from "../src/missions/MissionTypes.sol";

contract InvariantToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    address public immutable minter = msg.sender;
    function mint(address to, uint256 amount) external { require(msg.sender == minter); balanceOf[to] += amount; }
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
    function submitArtifact(MissionEscrowV1 vault, bytes32 milestoneId, bytes32 artifactHash) external { vault.submitArtifact(milestoneId, artifactHash); }
    function approveMilestone(MissionEscrowV1 vault, bytes32 milestoneId, bytes32 artifactHash, bytes32 payoutCommitment) external { vault.approveMilestone(milestoneId, artifactHash, payoutCommitment); }
    function releaseMilestone(MissionEscrowV1 vault, bytes32 milestoneId) external { vault.releaseMilestone(milestoneId); }
}

contract InvariantHandler {
    MissionEscrowV1 public immutable vault;
    InvariantActor public immutable owner;
    InvariantActor public immutable lead;
    bytes32 public constant MILESTONE_ID = keccak256("m1");
    bytes32 public constant PAYOUT_COMMITMENT = keccak256("payout");

    constructor(MissionEscrowV1 vault_, InvariantActor owner_, InvariantActor lead_) { vault = vault_; owner = owner_; lead = lead_; }

    function release(bytes32 artifactHash) external {
        if (artifactHash == bytes32(0)) artifactHash = keccak256("artifact");
        lead.submitArtifact(vault, MILESTONE_ID, artifactHash);
        owner.approveMilestone(vault, MILESTONE_ID, artifactHash, PAYOUT_COMMITMENT);
        lead.approveMilestone(vault, MILESTONE_ID, artifactHash, PAYOUT_COMMITMENT);
        owner.releaseMilestone(vault, MILESTONE_ID);
    }
}

contract MissionEscrowInvariant {
    MissionEscrowV1 public vault;
    InvariantToken public token;
    InvariantActor public owner;
    InvariantActor public lead;
    InvariantHandler public handler;
    bytes32 public constant MILESTONE_ID = keccak256("m1");
    bytes32 public constant PAYOUT_COMMITMENT = keccak256("payout");
    address public constant PAYOUT_RECIPIENT = address(0x1004);
    address public constant REFUND_RECIPIENT = address(0x2001);

    constructor() {
        token = new InvariantToken();
        owner = new InvariantActor();
        lead = new InvariantActor();
        MissionTypes.MemberTerms[] memory members = new MissionTypes.MemberTerms[](1);
        members[0] = MissionTypes.MemberTerms(block.chainid, address(0x1001), 1, address(0x1002), address(0x1003), 1, address(0x1004), keccak256("lead"), true);
        MissionTypes.Allocation[] memory payout = new MissionTypes.Allocation[](1);
        payout[0] = MissionTypes.Allocation(address(token), PAYOUT_RECIPIENT, 100);
        MissionTypes.Allocation[] memory timeout = new MissionTypes.Allocation[](1);
        timeout[0] = MissionTypes.Allocation(address(token), REFUND_RECIPIENT, 100);
        MissionTypes.MilestoneTerms[] memory milestones = new MissionTypes.MilestoneTerms[](1);
        milestones[0] = MissionTypes.MilestoneTerms(MILESTONE_ID, keccak256("accept"), PAYOUT_COMMITMENT, uint64(block.timestamp + 300), uint64(block.timestamp + 400), uint64(block.timestamp + 500), payout, timeout, timeout);
        vault = new MissionEscrowV1(keccak256("mission"), keccak256("v1"), address(owner), address(0x2001), address(lead), address(0x3001), uint64(block.timestamp + 100), uint64(block.timestamp + 200), members, milestones);
        token.mint(address(owner), 100);
        owner.approveToken(token, address(vault), 100);
        owner.fund(vault, address(token), 100);
        owner.approveLaunch(vault);
        lead.approveLaunch(vault);
        handler = new InvariantHandler(vault, owner, lead);
    }

    function invariant_conservation() external view {
        assert(vault.totalReleased(address(token)) + vault.totalRefunded(address(token)) + vault.remainingLiability(address(token)) == vault.totalFunded(address(token)));
        assert(token.balanceOf(address(vault)) >= vault.remainingLiability(address(token)));
    }

    function invariant_only_predeclared_destinations_receive_supported_assets() external view {
        assert(token.balanceOf(address(vault)) + token.balanceOf(PAYOUT_RECIPIENT) + token.balanceOf(REFUND_RECIPIENT) == 100);
    }

    function invariant_terminal_milestone_settles_at_most_once() external view {
        MissionEscrowV1.MilestoneRecord memory record = vault.milestone(MILESTONE_ID);
        uint256 settled = vault.totalReleased(address(token)) + vault.totalRefunded(address(token));
        assert(settled <= 100);
        if (record.status == MissionEscrowV1.MilestoneState.Released || record.status == MissionEscrowV1.MilestoneState.Resolved || record.status == MissionEscrowV1.MilestoneState.TimeoutSettled) {
            assert(settled == 100);
            assert(vault.remainingLiability(address(token)) == 0);
        }
    }
}
