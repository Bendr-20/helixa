// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IAgentDNA {
    struct Agent {
        address agentAddress;
        string name;
        string framework;
        uint256 mintedAt;
        bool verified;
        bool soulbound;
        uint256 generation;
        uint256 parentDNA;
        string currentVersion;
        uint256 mutationCount;
    }

    struct Trait {
        string name;
        string category;
        uint256 addedAt;
    }

    struct Personality {
        string temperament;
        string communicationStyle;
        uint8 riskTolerance;
        uint8 autonomyLevel;
        string alignment;
        string specialization;
    }

    function ownerOf(uint256 tokenId) external view returns (address);
    function getAgent(uint256 tokenId) external view returns (Agent memory);
    function getTraits(uint256 tokenId) external view returns (Trait[] memory);
    function getPersonality(uint256 tokenId) external view returns (Personality memory);
    function totalAgents() external view returns (uint256);
}

interface ICrossRegistry {
    function isRegistered(address) external view returns (bool);
}

/**
 * @title AgentTrustScore
 * @notice Computes a 0-100 trust score for AgentDNA agents based on onchain data.
 */
contract AgentTrustScore is Ownable {
    IAgentDNA public immutable agentDNA;
    address public registry;

    constructor(address _agentDNA, address _registry) Ownable(msg.sender) {
        agentDNA = IAgentDNA(_agentDNA);
        registry = _registry;
    }

    function setRegistry(address _registry) external onlyOwner {
        registry = _registry;
    }

    function getTrustScore(uint256 tokenId) external view returns (uint256) {
        (uint256 a, uint256 b, uint256 c, uint256 d, uint256 e, uint256 f, uint256 g) = _computeBreakdown(tokenId);
        return a + b + c + d + e + f + g;
    }

    function getScoreBreakdown(uint256 tokenId) external view returns (
        uint256 activity,
        uint256 traitDepth,
        uint256 verification,
        uint256 soulbound_,
        uint256 age,
        uint256 ownerStability,
        uint256 crossRegistry
    ) {
        return _computeBreakdown(tokenId);
    }

    function _computeBreakdown(uint256 tokenId) internal view returns (
        uint256 activity,
        uint256 traitDepth,
        uint256 verification,
        uint256 soulbound_,
        uint256 age,
        uint256 ownerStability,
        uint256 crossRegistry
    ) {
        IAgentDNA.Agent memory agent = agentDNA.getAgent(tokenId);
        IAgentDNA.Trait[] memory traits = agentDNA.getTraits(tokenId);
        IAgentDNA.Personality memory personality = agentDNA.getPersonality(tokenId);
        address owner = agentDNA.ownerOf(tokenId);

        // 1. Activity (25 pts)
        if (agent.mutationCount >= 3) activity = 10;
        else if (agent.mutationCount >= 1) activity = 5;

        uint256 traitCount = traits.length;
        if (traitCount >= 5) activity += 10;
        else if (traitCount >= 3) activity += 7;
        else if (traitCount >= 1) activity += 4;

        // hasPersonality: check if any field is non-empty
        if (_hasPersonality(personality)) activity += 5;

        // 2. Trait Depth (20 pts)
        // Personality "key count" — count non-empty fields (6 possible)
        uint256 personalityKeys = _countPersonalityFields(personality);
        if (personalityKeys >= 5) traitDepth = 12;
        else if (personalityKeys >= 3) traitDepth = 8;
        else if (personalityKeys >= 1) traitDepth = 4;

        // Unique categories
        uint256 uniqueCats = _countUniqueCategories(traits);
        if (uniqueCats >= 3) traitDepth += 8;
        else if (uniqueCats >= 2) traitDepth += 5;
        else if (uniqueCats >= 1) traitDepth += 3;

        // 3. Verification (15 pts)
        if (agent.verified) verification = 15;

        // 4. Soulbound (10 pts)
        if (agent.soulbound) soulbound_ = 10;

        // 5. Age (10 pts)
        if (block.timestamp > agent.mintedAt) {
            uint256 elapsed = block.timestamp - agent.mintedAt;
            age = elapsed * 10 / 30 days;
            if (age > 10) age = 10;
        }

        // 6. Owner Stability (10 pts)
        if (agent.soulbound || (agent.agentAddress != address(0) && owner == agent.agentAddress)) {
            ownerStability = 10;
        } else {
            ownerStability = 5;
        }

        // 7. Cross-Registry (10 pts)
        if (registry != address(0) && agent.agentAddress != address(0)) {
            try ICrossRegistry(registry).isRegistered(agent.agentAddress) returns (bool registered) {
                if (registered) crossRegistry = 10;
            } catch {}
        } else if (registry == address(0)) {
            // Redistribute 10 pts proportionally across other components
            uint256 rawTotal = activity + traitDepth + verification + soulbound_ + age + ownerStability;
            if (rawTotal > 0) {
                // Scale to 100
                activity = activity * 100 / (100 - 10) * 10 / 10; // simpler: multiply all by 100/90
                // Actually let's just scale properly
                uint256 maxRaw = 90; // max possible without cross-registry
                activity = activity * 100 / maxRaw;
                traitDepth = traitDepth * 100 / maxRaw;
                verification = verification * 100 / maxRaw;
                soulbound_ = soulbound_ * 100 / maxRaw;
                age = age * 100 / maxRaw;
                ownerStability = ownerStability * 100 / maxRaw;

                // Clamp total to 100
                uint256 total = activity + traitDepth + verification + soulbound_ + age + ownerStability;
                if (total > 100) {
                    // Reduce proportionally - just cap age
                    ownerStability = 100 - activity - traitDepth - verification - soulbound_ - age;
                }
            }
        }
    }

    function _hasPersonality(IAgentDNA.Personality memory p) internal pure returns (bool) {
        return bytes(p.temperament).length > 0 ||
               bytes(p.communicationStyle).length > 0 ||
               bytes(p.alignment).length > 0 ||
               bytes(p.specialization).length > 0 ||
               p.riskTolerance > 0 ||
               p.autonomyLevel > 0;
    }

    function _countPersonalityFields(IAgentDNA.Personality memory p) internal pure returns (uint256 count) {
        if (bytes(p.temperament).length > 0) count++;
        if (bytes(p.communicationStyle).length > 0) count++;
        if (p.riskTolerance > 0) count++;
        if (p.autonomyLevel > 0) count++;
        if (bytes(p.alignment).length > 0) count++;
        if (bytes(p.specialization).length > 0) count++;
    }

    function _countUniqueCategories(IAgentDNA.Trait[] memory traits) internal pure returns (uint256) {
        if (traits.length == 0) return 0;
        // Simple O(n^2) dedup - traits are typically few
        string[] memory seen = new string[](traits.length);
        uint256 count = 0;
        for (uint256 i = 0; i < traits.length; i++) {
            bool found = false;
            for (uint256 j = 0; j < count; j++) {
                if (keccak256(bytes(seen[j])) == keccak256(bytes(traits[i].category))) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                seen[count] = traits[i].category;
                count++;
            }
        }
        return count;
    }
}
