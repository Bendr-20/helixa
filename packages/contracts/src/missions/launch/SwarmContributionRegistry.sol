// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Immutable record of the contribution weights unanimously committed by a swarm.
/// @dev This contract deliberately has no owner, administrator, or mutation path.
contract SwarmContributionRegistry {
    uint16 public constant totalBps = 10_000;
    uint8 public constant MAX_CONTRIBUTIONS = 32;

    struct Contribution {
        bytes32 agentKey;
        address beneficiary;
        uint16 bps;
    }

    bytes32 public immutable readinessHash;
    Contribution[] private contributions;
    mapping(bytes32 => uint16) public contributionBps;
    mapping(bytes32 => address) public beneficiaryOf;

    error InvalidContributions();
    error ContributionNotFound(bytes32 agentKey);

    event ContributionsLocked(bytes32 indexed readinessHash, uint256 count);

    constructor(bytes32 readinessHash_, Contribution[] memory contributions_) {
        uint256 count = contributions_.length;
        if (readinessHash_ == bytes32(0) || count == 0 || count > MAX_CONTRIBUTIONS) {
            revert InvalidContributions();
        }

        uint256 sum;
        readinessHash = readinessHash_;
        for (uint256 index; index < count; ++index) {
            Contribution memory contribution = contributions_[index];
            if (
                contribution.agentKey == bytes32(0) || contribution.beneficiary == address(0) || contribution.bps == 0
                    || contributionBps[contribution.agentKey] != 0
            ) revert InvalidContributions();

            sum += contribution.bps;
            contributions.push(contribution);
            contributionBps[contribution.agentKey] = contribution.bps;
            beneficiaryOf[contribution.agentKey] = contribution.beneficiary;
        }
        if (sum != totalBps) revert InvalidContributions();

        emit ContributionsLocked(readinessHash_, count);
    }

    function contributionCount() external view returns (uint256) {
        return contributions.length;
    }

    function contributionAt(uint256 index) external view returns (bytes32 agentKey, address beneficiary, uint16 bps) {
        Contribution storage contribution = contributions[index];
        return (contribution.agentKey, contribution.beneficiary, contribution.bps);
    }

    function requireContribution(bytes32 agentKey) external view returns (Contribution memory contribution) {
        uint16 bps = contributionBps[agentKey];
        if (bps == 0) revert ContributionNotFound(agentKey);
        return Contribution({agentKey: agentKey, beneficiary: beneficiaryOf[agentKey], bps: bps});
    }
}
