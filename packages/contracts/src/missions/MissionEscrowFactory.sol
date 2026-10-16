// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {MissionTypes} from "./MissionTypes.sol";

interface IVersionRegistry {
    struct ActiveVersion { bytes32 creationCodeHash; bytes32 runtimeCodeHash; uint32 factoryCompatibility; }
    function requireActiveVersion(bytes32 versionId, address token) external view returns (ActiveVersion memory);
}

interface IERC1271 {
    function isValidSignature(bytes32 digest, bytes calldata signature) external view returns (bytes4);
}

contract MissionEscrowFactory {
    uint32 public constant FACTORY_COMPATIBILITY = 1;
    bytes4 private constant ERC1271_MAGIC = 0x1626ba7e;
    uint256 private constant HALF_N = 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0;
    bytes32 public constant ALLOCATION_TYPEHASH = keccak256("Allocation(address token,address recipient,uint256 amount)");
    bytes32 public constant MEMBER_TYPEHASH = keccak256("MemberTerms(uint256 chainId,address collection,uint256 tokenId,address canonicalAccount,address controller,uint64 custodyEpoch,address settlementAddress,bytes32 roleHash,bool isLead)");
    bytes32 public constant MILESTONE_TYPEHASH = keccak256("MilestoneTerms(bytes32 milestoneId,bytes32 acceptanceHash,bytes32 payoutCommitment,uint64 deliveryDeadline,uint64 reviewDeadline,uint64 disputeDeadline,Allocation[] payouts,Allocation[] deliveryTimeoutAllocations,Allocation[] disputeTimeoutAllocations)Allocation(address token,address recipient,uint256 amount)");
    bytes32 public constant SIGNER_NONCE_TYPEHASH = keccak256("SignerNonce(address signer,uint256 nonce)");
    bytes32 public constant LAUNCH_MANIFEST_TYPEHASH = keccak256("LaunchManifest(bytes32 missionId,bytes32 termsHash,bytes32 versionId,bytes32 vaultCreationCodeHash,bytes32 idAgentsReleaseHash,bytes32 xmtpRoomPolicyHash,address factory,address predictedVault,address owner,address refundAddress,address leadApprovalAddress,address arbitrator,uint64 fundingDeadline,uint64 launchDeadline,uint64 expiry,MemberTerms[] members,MilestoneTerms[] milestones,SignerNonce[] signerNonces)Allocation(address token,address recipient,uint256 amount)MemberTerms(uint256 chainId,address collection,uint256 tokenId,address canonicalAccount,address controller,uint64 custodyEpoch,address settlementAddress,bytes32 roleHash,bool isLead)MilestoneTerms(bytes32 milestoneId,bytes32 acceptanceHash,bytes32 payoutCommitment,uint64 deliveryDeadline,uint64 reviewDeadline,uint64 disputeDeadline,Allocation[] payouts,Allocation[] deliveryTimeoutAllocations,Allocation[] disputeTimeoutAllocations)SignerNonce(address signer,uint256 nonce)");
    bytes32 private constant DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant NAME_HASH = keccak256("Helixa Mission Escrow");
    bytes32 private constant VERSION_HASH = keccak256("1");

    IVersionRegistry public immutable registry;
    mapping(address => uint256) public nonces;
    mapping(bytes32 => bool) public consumedManifests;
    uint256 private entered;

    struct Approval { address signer; bytes signature; }

    error InvalidRegistry();
    error ReentrantCall();
    error InvalidManifest();
    error InvalidBounds();
    error InvalidAllocation();
    error InvalidSignerSet();
    error InvalidNonce(address signer, uint256 expected, uint256 supplied);
    error InvalidSignature(address signer);
    error ManifestConsumed(bytes32 digest);
    error ManifestExpired(uint64 expiry);
    error InvalidVaultCode();
    error VaultDeploymentFailed();

    event MissionVaultCreated(bytes32 indexed missionId, bytes32 indexed versionId, address indexed vault,
        bytes32 manifestHash, bytes32 termsHash, bytes32 creationCodeHash, bytes32 runtimeCodeHash,
        address owner, address refundAddress, address leadApprovalAddress,
        bytes32 idAgentsReleaseHash, bytes32 xmtpRoomPolicyHash);
    event MissionVaultDeadlines(address indexed vault, address indexed arbitrator,
        uint64 fundingDeadline, uint64 launchDeadline, uint64 signatureExpiry);

    constructor(address registry_) {
        if (registry_ == address(0)) revert InvalidRegistry();
        registry = IVersionRegistry(registry_);
    }

    modifier nonReentrant() {
        if (entered != 0) revert ReentrantCall();
        entered = 1; _; entered = 0;
    }

    function domainSeparator() public view returns (bytes32) {
        return keccak256(abi.encode(DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, block.chainid, address(this)));
    }

    function hashLaunchManifest(MissionTypes.LaunchManifest calldata manifest) public view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator(), _hashManifest(manifest)));
    }

    function create2Salt(MissionTypes.LaunchManifest calldata manifest) public pure returns (bytes32) {
        return keccak256(abi.encode(manifest.missionId, manifest.versionId, manifest.termsHash));
    }

    function vaultConstructorArgs(MissionTypes.LaunchManifest calldata manifest) public pure returns (bytes memory) {
        return abi.encode(manifest.missionId, manifest.versionId, manifest.owner, manifest.refundAddress,
            manifest.leadApprovalAddress, manifest.arbitrator, manifest.fundingDeadline, manifest.launchDeadline,
            manifest.members, manifest.milestones);
    }

    function predictVault(MissionTypes.LaunchManifest calldata manifest, bytes calldata creationCode)
        public view returns (address)
    {
        bytes32 initHash = keccak256(abi.encodePacked(creationCode, vaultConstructorArgs(manifest)));
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), create2Salt(manifest), initHash)))));
    }

    function deployVault(MissionTypes.LaunchManifest calldata manifest, Approval[] calldata approvals,
        bytes calldata creationCode) external nonReentrant returns (address vault)
    {
        _validateHeader(manifest, creationCode);
        (address[] memory required, address[] memory tokens) = _validateTerms(manifest);
        IVersionRegistry.ActiveVersion memory active = _validateVersion(manifest, tokens);
        bytes32 digest = hashLaunchManifest(manifest);
        if (consumedManifests[digest]) revert ManifestConsumed(digest);
        _validateSignerSet(manifest.signerNonces, approvals, required);
        consumedManifests[digest] = true;
        for (uint256 i; i < approvals.length; ++i) {
            MissionTypes.SignerNonce calldata item = manifest.signerNonces[i];
            uint256 expected = nonces[item.signer];
            if (item.nonce != expected) revert InvalidNonce(item.signer, expected, item.nonce);
            nonces[item.signer] = expected + 1;
        }
        for (uint256 i; i < approvals.length; ++i) {
            if (!_validSignature(approvals[i].signer, digest, approvals[i].signature)) revert InvalidSignature(approvals[i].signer);
        }
        bytes memory initCode = bytes.concat(creationCode, vaultConstructorArgs(manifest));
        bytes32 salt = create2Salt(manifest);
        assembly ("memory-safe") { vault := create2(0, add(initCode, 32), mload(initCode), salt) }
        if (vault == address(0)) revert VaultDeploymentFailed();
        bytes32 runtimeHash;
        assembly ("memory-safe") { runtimeHash := extcodehash(vault) }
        if (runtimeHash != active.runtimeCodeHash) revert InvalidVaultCode();
        _emitCreated(manifest, vault, digest, runtimeHash);
    }

    function _emitCreated(MissionTypes.LaunchManifest calldata manifest, address vault, bytes32 digest, bytes32 runtimeHash)
        private
    {
        emit MissionVaultCreated(manifest.missionId, manifest.versionId, vault, digest, manifest.termsHash,
            manifest.vaultCreationCodeHash, runtimeHash, manifest.owner, manifest.refundAddress,
            manifest.leadApprovalAddress, manifest.idAgentsReleaseHash, manifest.xmtpRoomPolicyHash);
        emit MissionVaultDeadlines(vault, manifest.arbitrator, manifest.fundingDeadline,
            manifest.launchDeadline, manifest.expiry);
    }

    function _validateHeader(MissionTypes.LaunchManifest calldata manifest, bytes calldata creationCode) private view
    {
        if (manifest.factory != address(this) || manifest.owner == address(0) || manifest.refundAddress == address(0)
            || manifest.leadApprovalAddress == address(0) || manifest.arbitrator == address(0)
            || manifest.owner == manifest.leadApprovalAddress || manifest.owner == manifest.arbitrator
            || manifest.leadApprovalAddress == manifest.arbitrator || manifest.missionId == bytes32(0) || manifest.termsHash == bytes32(0) || manifest.versionId == bytes32(0)
            || manifest.vaultCreationCodeHash == bytes32(0) || manifest.predictedVault == address(0)) revert InvalidManifest();
        if (block.timestamp > manifest.expiry) revert ManifestExpired(manifest.expiry);
        if (manifest.expiry > manifest.fundingDeadline || manifest.fundingDeadline <= block.timestamp
            || manifest.fundingDeadline >= manifest.launchDeadline) revert InvalidManifest();
        if (keccak256(creationCode) != manifest.vaultCreationCodeHash
            || keccak256(vaultConstructorArgs(manifest)) != manifest.termsHash
            || predictVault(manifest, creationCode) != manifest.predictedVault) revert InvalidVaultCode();
    }

    function _validateVersion(MissionTypes.LaunchManifest calldata manifest, address[] memory tokens)
        private view returns (IVersionRegistry.ActiveVersion memory active)
    {
        if (tokens.length == 0) revert InvalidAllocation();
        for (uint256 i; i < tokens.length; ++i) {
            IVersionRegistry.ActiveVersion memory current = registry.requireActiveVersion(manifest.versionId, tokens[i]);
            if (i == 0) active = current;
            else if (current.creationCodeHash != active.creationCodeHash || current.runtimeCodeHash != active.runtimeCodeHash
                || current.factoryCompatibility != active.factoryCompatibility) revert InvalidVaultCode();
        }
        if (active.factoryCompatibility != FACTORY_COMPATIBILITY
            || active.creationCodeHash != manifest.vaultCreationCodeHash) revert InvalidVaultCode();
    }

    function _validateTerms(MissionTypes.LaunchManifest calldata manifest)
        private view returns (address[] memory signers, address[] memory tokens)
    {
        uint256 memberCount = manifest.members.length;
        uint256 milestoneCount = manifest.milestones.length;
        if (memberCount == 0 || memberCount > MissionTypes.MAX_RECIPIENTS
            || milestoneCount == 0 || milestoneCount > MissionTypes.MAX_MILESTONES) revert InvalidBounds();
        address[] memory signerBuffer = new address[](2 + memberCount * 2 + milestoneCount * 48);
        address[] memory tokenBuffer = new address[](MissionTypes.MAX_ASSETS);
        uint256 signerCount = 2;
        uint256 tokenCount;
        signerBuffer[0] = manifest.owner;
        signerBuffer[1] = manifest.leadApprovalAddress;
        uint256 leadCount;
        for (uint256 i; i < memberCount; ++i) {
            MissionTypes.MemberTerms calldata member = manifest.members[i];
            if (member.chainId != block.chainid || member.collection == address(0) || member.canonicalAccount == address(0)
                || member.controller == address(0) || member.settlementAddress == address(0) || member.roleHash == bytes32(0)
                || manifest.owner == member.canonicalAccount || manifest.leadApprovalAddress == member.canonicalAccount) {
                revert InvalidManifest();
            }
            for (uint256 j; j < memberCount; ++j) {
                if (manifest.members[j].canonicalAccount == member.settlementAddress) revert InvalidManifest();
            }
            for (uint256 j; j < i; ++j) {
                MissionTypes.MemberTerms calldata prior = manifest.members[j];
                if (prior.canonicalAccount == member.canonicalAccount
                    || (prior.chainId == member.chainId && prior.collection == member.collection && prior.tokenId == member.tokenId)) {
                    revert InvalidManifest();
                }
            }
            if (member.isLead) ++leadCount;
            signerBuffer[signerCount++] = member.controller;
            signerBuffer[signerCount++] = member.settlementAddress;
        }
        if (leadCount != 1) revert InvalidManifest();
        for (uint256 i; i < milestoneCount; ++i) {
            MissionTypes.MilestoneTerms calldata milestone = manifest.milestones[i];
            if (milestone.milestoneId == bytes32(0) || milestone.acceptanceHash == bytes32(0)
                || milestone.payoutCommitment == bytes32(0) || milestone.deliveryDeadline <= manifest.launchDeadline
                || milestone.deliveryDeadline >= milestone.reviewDeadline || milestone.reviewDeadline >= milestone.disputeDeadline) {
                revert InvalidManifest();
            }
            _validateDestinations(manifest, milestone.payouts);
            _validateDestinations(manifest, milestone.deliveryTimeoutAllocations);
            _validateDestinations(manifest, milestone.disputeTimeoutAllocations);
            (signerCount, tokenCount) = _addAllocations(milestone.payouts, signerBuffer, signerCount, tokenBuffer, tokenCount);
            (signerCount, tokenCount) = _addAllocations(milestone.deliveryTimeoutAllocations, signerBuffer, signerCount, tokenBuffer, tokenCount);
            (signerCount, tokenCount) = _addAllocations(milestone.disputeTimeoutAllocations, signerBuffer, signerCount, tokenBuffer, tokenCount);
            for (uint256 t; t < tokenCount; ++t) {
                uint256 amount = _sum(milestone.payouts, tokenBuffer[t]);
                if (amount == 0 || amount != _sum(milestone.deliveryTimeoutAllocations, tokenBuffer[t])
                    || amount != _sum(milestone.disputeTimeoutAllocations, tokenBuffer[t])) revert InvalidAllocation();
            }
        }
        signers = _sortUnique(signerBuffer, signerCount);
        tokens = new address[](tokenCount);
        for (uint256 i; i < tokenCount; ++i) tokens[i] = tokenBuffer[i];
    }

    function _validateDestinations(MissionTypes.LaunchManifest calldata manifest, MissionTypes.Allocation[] calldata allocations)
        private pure
    {
        for (uint256 i; i < allocations.length; ++i) {
            address recipient = allocations[i].recipient;
            bool allowed = recipient == manifest.refundAddress;
            for (uint256 j; j < manifest.members.length && !allowed; ++j) {
                allowed = recipient == manifest.members[j].settlementAddress;
            }
            if (!allowed) revert InvalidAllocation();
        }
    }

    function _addAllocations(MissionTypes.Allocation[] calldata allocations, address[] memory signerBuffer,
        uint256 signerCount, address[] memory tokenBuffer, uint256 tokenCount)
        private pure returns (uint256, uint256)
    {
        if (allocations.length == 0 || allocations.length > 16) revert InvalidBounds();
        uint8[2] memory perToken;
        for (uint256 i; i < allocations.length; ++i) {
            MissionTypes.Allocation calldata allocation = allocations[i];
            if (allocation.recipient == address(0) || allocation.amount == 0) revert InvalidAllocation();
            uint256 tokenIndex = type(uint256).max;
            for (uint256 t; t < tokenCount; ++t) if (tokenBuffer[t] == allocation.token) tokenIndex = t;
            if (tokenIndex == type(uint256).max) {
                if (tokenCount == MissionTypes.MAX_ASSETS) revert InvalidBounds();
                tokenIndex = tokenCount;
                tokenBuffer[tokenCount++] = allocation.token;
            }
            if (++perToken[tokenIndex] > MissionTypes.MAX_PAYOUTS_PER_ASSET_PER_MILESTONE) revert InvalidBounds();
            signerBuffer[signerCount++] = allocation.recipient;
        }
        return (signerCount, tokenCount);
    }

    function _sum(MissionTypes.Allocation[] calldata allocations, address token) private pure returns (uint256 total) {
        for (uint256 i; i < allocations.length; ++i) if (allocations[i].token == token) total += allocations[i].amount;
    }

    function _sortUnique(address[] memory values, uint256 count) private pure returns (address[] memory unique) {
        for (uint256 i = 1; i < count; ++i) {
            address value = values[i]; uint256 j = i;
            while (j > 0 && uint160(values[j - 1]) > uint160(value)) { values[j] = values[j - 1]; --j; }
            values[j] = value;
        }
        uint256 uniqueCount;
        for (uint256 i; i < count; ++i) if (i == 0 || values[i] != values[i - 1]) values[uniqueCount++] = values[i];
        unique = new address[](uniqueCount);
        for (uint256 i; i < uniqueCount; ++i) unique[i] = values[i];
    }

    function _validateSignerSet(MissionTypes.SignerNonce[] calldata items, Approval[] calldata approvals,
        address[] memory required) private pure
    {
        if (items.length != required.length || approvals.length != required.length) revert InvalidSignerSet();
        for (uint256 i; i < required.length; ++i) {
            if (items[i].signer != required[i] || approvals[i].signer != required[i]) revert InvalidSignerSet();
        }
    }

    function _validSignature(address signer, bytes32 digest, bytes calldata signature) private view returns (bool) {
        if (signer.code.length != 0) {
            (bool ok, bytes memory result) = signer.staticcall(abi.encodeCall(IERC1271.isValidSignature, (digest, signature)));
            return ok && result.length >= 32 && bytes4(result) == ERC1271_MAGIC;
        }
        if (signature.length != 65) return false;
        bytes32 r; bytes32 s; uint8 v;
        assembly ("memory-safe") {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        if (uint256(s) > HALF_N || (v != 27 && v != 28)) return false;
        return ecrecover(digest, v, r, s) == signer;
    }

    function _hashManifest(MissionTypes.LaunchManifest calldata manifest) private pure returns (bytes32) {
        bytes32[19] memory words;
        words[0] = LAUNCH_MANIFEST_TYPEHASH;
        words[1] = manifest.missionId;
        words[2] = manifest.termsHash;
        words[3] = manifest.versionId;
        words[4] = manifest.vaultCreationCodeHash;
        words[5] = manifest.idAgentsReleaseHash;
        words[6] = manifest.xmtpRoomPolicyHash;
        words[7] = bytes32(uint256(uint160(manifest.factory)));
        words[8] = bytes32(uint256(uint160(manifest.predictedVault)));
        words[9] = bytes32(uint256(uint160(manifest.owner)));
        words[10] = bytes32(uint256(uint160(manifest.refundAddress)));
        words[11] = bytes32(uint256(uint160(manifest.leadApprovalAddress)));
        words[12] = bytes32(uint256(uint160(manifest.arbitrator)));
        words[13] = bytes32(uint256(manifest.fundingDeadline));
        words[14] = bytes32(uint256(manifest.launchDeadline));
        words[15] = bytes32(uint256(manifest.expiry));
        words[16] = _hashMembers(manifest.members);
        words[17] = _hashMilestones(manifest.milestones);
        words[18] = _hashSignerNonces(manifest.signerNonces);
        return keccak256(abi.encodePacked(words));
    }

    function _hashMembers(MissionTypes.MemberTerms[] calldata values) private pure returns (bytes32) {
        bytes32[] memory hashes = new bytes32[](values.length);
        for (uint256 i; i < values.length; ++i) {
            MissionTypes.MemberTerms calldata v = values[i];
            hashes[i] = keccak256(abi.encode(MEMBER_TYPEHASH, v.chainId, v.collection, v.tokenId,
                v.canonicalAccount, v.controller, v.custodyEpoch, v.settlementAddress, v.roleHash, v.isLead));
        }
        return keccak256(abi.encodePacked(hashes));
    }

    function _hashMilestones(MissionTypes.MilestoneTerms[] calldata values) private pure returns (bytes32) {
        bytes32[] memory hashes = new bytes32[](values.length);
        for (uint256 i; i < values.length; ++i) {
            MissionTypes.MilestoneTerms calldata v = values[i];
            hashes[i] = keccak256(abi.encode(MILESTONE_TYPEHASH, v.milestoneId, v.acceptanceHash,
                v.payoutCommitment, v.deliveryDeadline, v.reviewDeadline, v.disputeDeadline,
                _hashAllocations(v.payouts), _hashAllocations(v.deliveryTimeoutAllocations),
                _hashAllocations(v.disputeTimeoutAllocations)));
        }
        return keccak256(abi.encodePacked(hashes));
    }

    function _hashAllocations(MissionTypes.Allocation[] calldata values) private pure returns (bytes32) {
        bytes32[] memory hashes = new bytes32[](values.length);
        for (uint256 i; i < values.length; ++i) {
            hashes[i] = keccak256(abi.encode(ALLOCATION_TYPEHASH, values[i].token, values[i].recipient, values[i].amount));
        }
        return keccak256(abi.encodePacked(hashes));
    }

    function _hashSignerNonces(MissionTypes.SignerNonce[] calldata values) private pure returns (bytes32) {
        bytes32[] memory hashes = new bytes32[](values.length);
        for (uint256 i; i < values.length; ++i) {
            hashes[i] = keccak256(abi.encode(SIGNER_NONCE_TYPEHASH, values[i].signer, values[i].nonce));
        }
        return keccak256(abi.encodePacked(hashes));
    }
}
