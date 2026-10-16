// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

library MissionTypes {
    uint8 internal constant MAX_ASSETS = 2;
    uint8 internal constant MAX_RECIPIENTS = 8;
    uint8 internal constant MAX_MILESTONES = 12;
    uint8 internal constant MAX_PAYOUTS_PER_ASSET_PER_MILESTONE = 8;

    enum VersionStatus {
        Pending,
        Active,
        Paused,
        Retired
    }

    struct Allocation {
        address token;
        address recipient;
        uint256 amount;
    }

    struct MilestoneTerms {
        bytes32 milestoneId;
        bytes32 acceptanceHash;
        bytes32 payoutCommitment;
        uint64 deliveryDeadline;
        uint64 reviewDeadline;
        uint64 disputeDeadline;
        Allocation[] payouts;
        Allocation[] deliveryTimeoutAllocations;
        Allocation[] disputeTimeoutAllocations;
    }

    struct MemberTerms {
        uint256 chainId;
        address collection;
        uint256 tokenId;
        address canonicalAccount;
        address controller;
        uint64 custodyEpoch;
        address settlementAddress;
        bytes32 roleHash;
        bool isLead;
    }

    struct LaunchManifest {
        bytes32 missionId;
        bytes32 termsHash;
        bytes32 versionId;
        bytes32 vaultCreationCodeHash;
        bytes32 idAgentsReleaseHash;
        bytes32 xmtpRoomPolicyHash;
        address factory;
        address predictedVault;
        address owner;
        address refundAddress;
        address leadApprovalAddress;
        uint256 ownerNonce;
        uint64 expiry;
        MemberTerms[] members;
        MilestoneTerms[] milestones;
    }
}
