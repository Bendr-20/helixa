// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {MissionTypes} from "./MissionTypes.sol";

contract MissionEscrowV1 {
    enum VaultState { Funding, Active, Refunded, Settled }
    enum MilestoneState { Pending, Submitted, Disputed, Released, Resolved, TimeoutSettled }

    struct MilestoneRecord {
        bytes32 milestoneId;
        bytes32 acceptanceHash;
        bytes32 payoutCommitment;
        bytes32 artifactHash;
        bytes32 resolutionHash;
        uint64 deliveryDeadline;
        uint64 reviewDeadline;
        uint64 disputeDeadline;
        MilestoneState status;
        bool ownerApproved;
        bool leadApproved;
        bool ownerResolutionApproved;
        bool leadResolutionApproved;
    }

    bytes32 public missionId;
    bytes32 public versionId;
    bytes32 public termsHash;
    address public factory;
    address public owner;
    address public refundAddress;
    address public leadApprovalAddress;
    address public arbitrator;
    uint64 public fundingDeadline;
    uint64 public launchDeadline;

    VaultState public state;
    bool public ownerApproved;
    bool public leadApproved;
    address[] public assets;
    mapping(address => uint256) public requiredAmount;
    mapping(address => uint256) public totalFunded;
    mapping(address => uint256) public remainingLiability;
    mapping(address => uint256) public totalRefunded;
    mapping(address => uint256) public totalReleased;
    MilestoneRecord[] private milestoneRecords;
    mapping(bytes32 => uint256) private milestoneIndexPlusOne;
    mapping(uint256 => MissionTypes.Allocation[]) private milestonePayouts;
    mapping(uint256 => MissionTypes.Allocation[]) private deliveryTimeouts;
    mapping(uint256 => MissionTypes.Allocation[]) private disputeTimeouts;
    uint256 private entered;

    error InvalidTerms();
    error InvalidState();
    error InvalidCaller();
    error InvalidAmount();
    error FundingClosed();
    error LaunchClosed();
    error FundingComplete();
    error FundingIncomplete();
    error AlreadyApproved();
    error ReentrantCall();
    error TokenCallFailed();
    error BalanceDeltaMismatch();
    error NoExcess();
    error InvalidMilestone();
    error InvalidArtifact();
    error InvalidResolution();
    error DeadlineNotReached();
    error DeadlinePassed();

    event Funded(address indexed token, uint256 amount, uint256 total, uint256 required);
    event LaunchApproved(address indexed approver);
    event Activated();
    event Refunded(address indexed token, address indexed recipient, uint256 amount);
    event ExcessRecovered(address indexed token, address indexed recipient, uint256 amount);
    event ArtifactSubmitted(bytes32 indexed milestoneId, bytes32 indexed artifactHash);
    event MilestoneApproved(bytes32 indexed milestoneId, address indexed approver, bytes32 artifactHash, bytes32 payoutCommitment);
    event MilestoneDisputed(bytes32 indexed milestoneId, address indexed actor, bytes32 reasonHash);
    event ResolutionApproved(bytes32 indexed milestoneId, address indexed approver, bytes32 resolutionHash);
    event MilestoneSettled(bytes32 indexed milestoneId, MilestoneState status, bytes32 reasonHash);
    event MissionSettled();

    constructor(
        bytes32 missionId_,
        bytes32 versionId_,
        address owner_,
        address refundAddress_,
        address leadApprovalAddress_,
        address arbitrator_,
        uint64 fundingDeadline_,
        uint64 launchDeadline_,
        MissionTypes.MemberTerms[] memory members_,
        MissionTypes.MilestoneTerms[] memory milestones_
    ) {
        if (missionId_ == bytes32(0) || versionId_ == bytes32(0) || owner_ == address(0)
            || refundAddress_ == address(0) || leadApprovalAddress_ == address(0) || arbitrator_ == address(0)
            || owner_ == leadApprovalAddress_ || owner_ == arbitrator_ || leadApprovalAddress_ == arbitrator_
            || fundingDeadline_ <= block.timestamp || fundingDeadline_ >= launchDeadline_
            || members_.length == 0 || members_.length > MissionTypes.MAX_RECIPIENTS
            || milestones_.length == 0 || milestones_.length > MissionTypes.MAX_MILESTONES) revert InvalidTerms();

        missionId = missionId_;
        versionId = versionId_;
        factory = msg.sender;
        owner = owner_;
        refundAddress = refundAddress_;
        leadApprovalAddress = leadApprovalAddress_;
        arbitrator = arbitrator_;
        fundingDeadline = fundingDeadline_;
        launchDeadline = launchDeadline_;
        termsHash = keccak256(abi.encode(missionId_, versionId_, owner_, refundAddress_, leadApprovalAddress_,
            arbitrator_, fundingDeadline_, launchDeadline_, members_, milestones_));

        _validateMembers(members_);
        for (uint256 i; i < milestones_.length; ++i) _addMilestone(milestones_[i], members_);
        if (assets.length == 0 || assets.length > MissionTypes.MAX_ASSETS) revert InvalidTerms();
    }

    modifier nonReentrant() {
        if (entered != 0) revert ReentrantCall();
        entered = 1;
        _;
        entered = 0;
    }

    function assetCount() external view returns (uint256) { return assets.length; }
    function milestoneCount() external view returns (uint256) { return milestoneRecords.length; }
    function milestone(bytes32 milestoneId_) external view returns (MilestoneRecord memory) {
        return milestoneRecords[_milestoneIndex(milestoneId_)];
    }

    function fullyFunded() public view returns (bool) {
        for (uint256 i; i < assets.length; ++i) {
            address token = assets[i];
            if (totalFunded[token] != requiredAmount[token]) return false;
        }
        return true;
    }

    function fund(address token, uint256 amount) external payable nonReentrant {
        if (state != VaultState.Funding) revert InvalidState();
        if (msg.sender != owner) revert InvalidCaller();
        if (block.timestamp >= fundingDeadline) revert FundingClosed();
        uint256 required = requiredAmount[token];
        if (required == 0 || amount == 0 || totalFunded[token] + amount > required) revert InvalidAmount();

        totalFunded[token] += amount;
        remainingLiability[token] += amount;
        if (token == address(0)) {
            if (msg.value != amount) revert BalanceDeltaMismatch();
        } else {
            if (msg.value != 0) revert BalanceDeltaMismatch();
            uint256 beforeBalance = _balanceOf(token);
            _safeTransferFrom(token, msg.sender, address(this), amount);
            if (_balanceOf(token) - beforeBalance != amount) revert BalanceDeltaMismatch();
        }
        emit Funded(token, amount, totalFunded[token], required);
    }

    function approveLaunch() external nonReentrant {
        if (state != VaultState.Funding) revert InvalidState();
        if (block.timestamp >= launchDeadline) revert LaunchClosed();
        if (!fullyFunded()) revert FundingIncomplete();
        if (msg.sender == owner) {
            if (ownerApproved) revert AlreadyApproved();
            ownerApproved = true;
        } else if (msg.sender == leadApprovalAddress) {
            if (leadApproved) revert AlreadyApproved();
            leadApproved = true;
        } else {
            revert InvalidCaller();
        }
        emit LaunchApproved(msg.sender);
        if (ownerApproved && leadApproved) {
            state = VaultState.Active;
            emit Activated();
        }
    }

    function refundIncompleteFunding() external nonReentrant {
        if (state != VaultState.Funding) revert InvalidState();
        if (block.timestamp < fundingDeadline) revert FundingClosed();
        if (fullyFunded()) revert FundingComplete();
        _refundAll();
    }

    function refundUnlaunched() external nonReentrant {
        if (state != VaultState.Funding) revert InvalidState();
        if (block.timestamp < launchDeadline) revert LaunchClosed();
        _refundAll();
    }

    function submitArtifact(bytes32 milestoneId_, bytes32 artifactHash) external nonReentrant {
        if (state != VaultState.Active) revert InvalidState();
        if (msg.sender != leadApprovalAddress) revert InvalidCaller();
        uint256 index = _milestoneIndex(milestoneId_);
        MilestoneRecord storage record = milestoneRecords[index];
        if (record.status != MilestoneState.Pending) revert InvalidMilestone();
        if (block.timestamp >= record.deliveryDeadline) revert DeadlinePassed();
        if (artifactHash == bytes32(0)) revert InvalidArtifact();
        record.artifactHash = artifactHash;
        record.status = MilestoneState.Submitted;
        emit ArtifactSubmitted(milestoneId_, artifactHash);
    }

    function approveMilestone(bytes32 milestoneId_, bytes32 artifactHash, bytes32 payoutCommitment)
        external nonReentrant
    {
        if (state != VaultState.Active) revert InvalidState();
        uint256 index = _milestoneIndex(milestoneId_);
        MilestoneRecord storage record = milestoneRecords[index];
        if (record.status != MilestoneState.Submitted) revert InvalidMilestone();
        if (block.timestamp >= record.reviewDeadline) revert DeadlinePassed();
        if (artifactHash != record.artifactHash || payoutCommitment != record.payoutCommitment) revert InvalidArtifact();
        if (msg.sender == owner) {
            if (record.ownerApproved) revert AlreadyApproved();
            record.ownerApproved = true;
        } else if (msg.sender == leadApprovalAddress) {
            if (record.leadApproved) revert AlreadyApproved();
            record.leadApproved = true;
        } else revert InvalidCaller();
        emit MilestoneApproved(milestoneId_, msg.sender, artifactHash, payoutCommitment);
    }

    function releaseMilestone(bytes32 milestoneId_) external nonReentrant {
        if (state != VaultState.Active) revert InvalidState();
        uint256 index = _milestoneIndex(milestoneId_);
        MilestoneRecord storage record = milestoneRecords[index];
        if (record.status != MilestoneState.Submitted || !record.ownerApproved || !record.leadApproved) revert InvalidMilestone();
        record.status = MilestoneState.Released;
        _settleStored(milestonePayouts[index]);
        emit MilestoneSettled(milestoneId_, MilestoneState.Released, bytes32(0));
        _completeIfAllTerminal();
    }

    function disputeMilestone(bytes32 milestoneId_, bytes32 reasonHash) external nonReentrant {
        if (state != VaultState.Active) revert InvalidState();
        if (msg.sender != owner && msg.sender != leadApprovalAddress) revert InvalidCaller();
        uint256 index = _milestoneIndex(milestoneId_);
        MilestoneRecord storage record = milestoneRecords[index];
        if ((record.status != MilestoneState.Pending && record.status != MilestoneState.Submitted)
            || block.timestamp >= record.disputeDeadline || reasonHash == bytes32(0)) revert InvalidMilestone();
        record.status = MilestoneState.Disputed;
        emit MilestoneDisputed(milestoneId_, msg.sender, reasonHash);
    }

    function enterDisputeAfterReview(bytes32 milestoneId_, bytes32 reasonHash) external nonReentrant {
        if (state != VaultState.Active) revert InvalidState();
        uint256 index = _milestoneIndex(milestoneId_);
        MilestoneRecord storage record = milestoneRecords[index];
        if (record.status != MilestoneState.Submitted || block.timestamp < record.reviewDeadline
            || block.timestamp >= record.disputeDeadline || reasonHash == bytes32(0)) revert InvalidMilestone();
        record.status = MilestoneState.Disputed;
        emit MilestoneDisputed(milestoneId_, msg.sender, reasonHash);
    }

    function settleDeliveryTimeout(bytes32 milestoneId_) external nonReentrant {
        if (state != VaultState.Active) revert InvalidState();
        uint256 index = _milestoneIndex(milestoneId_);
        MilestoneRecord storage record = milestoneRecords[index];
        if (record.status != MilestoneState.Pending || block.timestamp < record.deliveryDeadline) revert DeadlineNotReached();
        record.status = MilestoneState.TimeoutSettled;
        _settleStored(deliveryTimeouts[index]);
        emit MilestoneSettled(milestoneId_, MilestoneState.TimeoutSettled, bytes32(0));
        _completeIfAllTerminal();
    }

    function approveDisputeResolution(bytes32 milestoneId_, MissionTypes.Allocation[] calldata resolution, bytes32 reasonHash)
        external nonReentrant
    {
        if (state != VaultState.Active) revert InvalidState();
        if (msg.sender != owner && msg.sender != leadApprovalAddress) revert InvalidCaller();
        uint256 index = _milestoneIndex(milestoneId_);
        MilestoneRecord storage record = milestoneRecords[index];
        if (record.status != MilestoneState.Disputed || block.timestamp >= record.disputeDeadline || reasonHash == bytes32(0)) {
            revert InvalidMilestone();
        }
        _validateResolution(index, resolution);
        bytes32 resolutionHash = keccak256(abi.encode(reasonHash, resolution));
        if (record.resolutionHash == bytes32(0)) record.resolutionHash = resolutionHash;
        else if (record.resolutionHash != resolutionHash) revert InvalidResolution();
        if (msg.sender == owner) {
            if (record.ownerResolutionApproved) revert AlreadyApproved();
            record.ownerResolutionApproved = true;
        } else {
            if (record.leadResolutionApproved) revert AlreadyApproved();
            record.leadResolutionApproved = true;
        }
        emit ResolutionApproved(milestoneId_, msg.sender, resolutionHash);
        if (record.ownerResolutionApproved && record.leadResolutionApproved) {
            record.status = MilestoneState.Resolved;
            _settleCalldata(resolution);
            emit MilestoneSettled(milestoneId_, MilestoneState.Resolved, reasonHash);
            _completeIfAllTerminal();
        }
    }

    function arbitrate(bytes32 milestoneId_, MissionTypes.Allocation[] calldata resolution, bytes32 reasonHash)
        external nonReentrant
    {
        if (state != VaultState.Active) revert InvalidState();
        if (msg.sender != arbitrator) revert InvalidCaller();
        uint256 index = _milestoneIndex(milestoneId_);
        MilestoneRecord storage record = milestoneRecords[index];
        if (record.status != MilestoneState.Disputed || block.timestamp >= record.disputeDeadline || reasonHash == bytes32(0)) {
            revert InvalidMilestone();
        }
        _validateResolution(index, resolution);
        record.resolutionHash = keccak256(abi.encode(reasonHash, resolution));
        record.status = MilestoneState.Resolved;
        _settleCalldata(resolution);
        emit MilestoneSettled(milestoneId_, MilestoneState.Resolved, reasonHash);
        _completeIfAllTerminal();
    }

    function settleDisputeTimeout(bytes32 milestoneId_) external nonReentrant {
        if (state != VaultState.Active) revert InvalidState();
        uint256 index = _milestoneIndex(milestoneId_);
        MilestoneRecord storage record = milestoneRecords[index];
        if (record.status != MilestoneState.Disputed || block.timestamp < record.disputeDeadline) revert DeadlineNotReached();
        record.status = MilestoneState.TimeoutSettled;
        _settleStored(disputeTimeouts[index]);
        emit MilestoneSettled(milestoneId_, MilestoneState.TimeoutSettled, bytes32(0));
        _completeIfAllTerminal();
    }

    function recoverExcess(address token) external nonReentrant returns (uint256 amount) {
        uint256 balance = _assetBalance(token);
        uint256 liability = remainingLiability[token];
        if (balance <= liability) revert NoExcess();
        amount = balance - liability;
        _transferAsset(token, refundAddress, amount);
        emit ExcessRecovered(token, refundAddress, amount);
    }

    function _refundAll() private {
        state = VaultState.Refunded;
        uint256[] memory amounts = new uint256[](assets.length);
        for (uint256 i; i < assets.length; ++i) {
            address token = assets[i];
            uint256 amount = remainingLiability[token];
            amounts[i] = amount;
            remainingLiability[token] = 0;
            totalRefunded[token] += amount;
        }
        for (uint256 i; i < assets.length; ++i) {
            if (amounts[i] != 0) {
                _transferAsset(assets[i], refundAddress, amounts[i]);
                emit Refunded(assets[i], refundAddress, amounts[i]);
            }
        }
    }

    function _validateMembers(MissionTypes.MemberTerms[] memory members) private view {
        uint256 leadCount;
        for (uint256 i; i < members.length; ++i) {
            MissionTypes.MemberTerms memory member = members[i];
            if (member.chainId != block.chainid || member.collection == address(0) || member.canonicalAccount == address(0)
                || member.controller == address(0) || member.settlementAddress == address(0) || member.roleHash == bytes32(0)
                || member.canonicalAccount == owner || member.canonicalAccount == leadApprovalAddress) revert InvalidTerms();
            if (member.isLead) ++leadCount;
            for (uint256 j; j < members.length; ++j) {
                if (member.settlementAddress == members[j].canonicalAccount) revert InvalidTerms();
            }
            for (uint256 j; j < i; ++j) {
                if (member.canonicalAccount == members[j].canonicalAccount
                    || (member.chainId == members[j].chainId && member.collection == members[j].collection
                        && member.tokenId == members[j].tokenId)) revert InvalidTerms();
            }
        }
        if (leadCount != 1) revert InvalidTerms();
    }

    function _addMilestone(MissionTypes.MilestoneTerms memory milestone, MissionTypes.MemberTerms[] memory members) private {
        if (milestoneIndexPlusOne[milestone.milestoneId] != 0
            || milestone.milestoneId == bytes32(0) || milestone.acceptanceHash == bytes32(0)
            || milestone.payoutCommitment == bytes32(0) || milestone.deliveryDeadline <= launchDeadline
            || milestone.deliveryDeadline >= milestone.reviewDeadline || milestone.reviewDeadline >= milestone.disputeDeadline
            || milestone.payouts.length == 0 || milestone.payouts.length > 16
            || milestone.deliveryTimeoutAllocations.length == 0 || milestone.deliveryTimeoutAllocations.length > 16
            || milestone.disputeTimeoutAllocations.length == 0 || milestone.disputeTimeoutAllocations.length > 16) revert InvalidTerms();

        address[2] memory milestoneTokens;
        uint256 tokenCount;
        uint8[2] memory payoutCount;
        for (uint256 i; i < milestone.payouts.length; ++i) {
            MissionTypes.Allocation memory allocation = milestone.payouts[i];
            if (allocation.recipient == address(0) || allocation.amount == 0 || !_allowedRecipient(allocation.recipient, members)) revert InvalidTerms();
            uint256 index = _tokenIndex(milestoneTokens, tokenCount, allocation.token);
            if (index == type(uint256).max) {
                if (tokenCount == MissionTypes.MAX_ASSETS) revert InvalidTerms();
                index = tokenCount;
                milestoneTokens[tokenCount++] = allocation.token;
            }
            if (++payoutCount[index] > MissionTypes.MAX_PAYOUTS_PER_ASSET_PER_MILESTONE) revert InvalidTerms();
            _addRequired(allocation.token, allocation.amount);
        }
        _validateTimeouts(milestone.deliveryTimeoutAllocations, milestone.payouts, milestoneTokens, tokenCount, members);
        _validateTimeouts(milestone.disputeTimeoutAllocations, milestone.payouts, milestoneTokens, tokenCount, members);
        uint256 index = milestoneRecords.length;
        milestoneIndexPlusOne[milestone.milestoneId] = index + 1;
        milestoneRecords.push(MilestoneRecord({
            milestoneId: milestone.milestoneId, acceptanceHash: milestone.acceptanceHash,
            payoutCommitment: milestone.payoutCommitment, artifactHash: bytes32(0), resolutionHash: bytes32(0),
            deliveryDeadline: milestone.deliveryDeadline, reviewDeadline: milestone.reviewDeadline,
            disputeDeadline: milestone.disputeDeadline, status: MilestoneState.Pending, ownerApproved: false,
            leadApproved: false, ownerResolutionApproved: false, leadResolutionApproved: false
        }));
        for (uint256 i; i < milestone.payouts.length; ++i) milestonePayouts[index].push(milestone.payouts[i]);
        for (uint256 i; i < milestone.deliveryTimeoutAllocations.length; ++i) deliveryTimeouts[index].push(milestone.deliveryTimeoutAllocations[i]);
        for (uint256 i; i < milestone.disputeTimeoutAllocations.length; ++i) disputeTimeouts[index].push(milestone.disputeTimeoutAllocations[i]);
    }

    function _validateTimeouts(MissionTypes.Allocation[] memory values, MissionTypes.Allocation[] memory payouts,
        address[2] memory tokens, uint256 tokenCount, MissionTypes.MemberTerms[] memory members) private view
    {
        uint8[2] memory counts;
        for (uint256 i; i < values.length; ++i) {
            MissionTypes.Allocation memory allocation = values[i];
            if (allocation.recipient == address(0) || allocation.amount == 0 || !_allowedRecipient(allocation.recipient, members)) revert InvalidTerms();
            uint256 index = _tokenIndex(tokens, tokenCount, allocation.token);
            if (index == type(uint256).max || ++counts[index] > MissionTypes.MAX_PAYOUTS_PER_ASSET_PER_MILESTONE) revert InvalidTerms();
        }
        for (uint256 i; i < tokenCount; ++i) {
            if (_sum(payouts, tokens[i]) != _sum(values, tokens[i])) revert InvalidTerms();
        }
    }

    function _allowedRecipient(address recipient, MissionTypes.MemberTerms[] memory members) private view returns (bool) {
        if (recipient == refundAddress) return true;
        for (uint256 i; i < members.length; ++i) if (recipient == members[i].settlementAddress) return true;
        return false;
    }

    function _addRequired(address token, uint256 amount) private {
        if (requiredAmount[token] == 0) {
            if (assets.length == MissionTypes.MAX_ASSETS) revert InvalidTerms();
            assets.push(token);
        }
        requiredAmount[token] += amount;
    }

    function _tokenIndex(address[2] memory values, uint256 length, address token) private pure returns (uint256) {
        for (uint256 i; i < length; ++i) if (values[i] == token) return i;
        return type(uint256).max;
    }

    function _sum(MissionTypes.Allocation[] memory values, address token) private pure returns (uint256 total) {
        for (uint256 i; i < values.length; ++i) if (values[i].token == token) total += values[i].amount;
    }

    function _completeIfAllTerminal() private {
        for (uint256 i; i < milestoneRecords.length; ++i) {
            MilestoneState status = milestoneRecords[i].status;
            if (status != MilestoneState.Released && status != MilestoneState.Resolved
                && status != MilestoneState.TimeoutSettled) return;
        }
        state = VaultState.Settled;
        emit MissionSettled();
    }

    function _milestoneIndex(bytes32 milestoneId_) private view returns (uint256 index) {
        uint256 plusOne = milestoneIndexPlusOne[milestoneId_];
        if (plusOne == 0) revert InvalidMilestone();
        index = plusOne - 1;
    }

    function _validateResolution(uint256 index, MissionTypes.Allocation[] calldata resolution) private view {
        if (resolution.length == 0 || resolution.length > 16) revert InvalidResolution();
        address[2] memory tokens;
        uint256 tokenCount;
        MissionTypes.Allocation[] storage payouts = milestonePayouts[index];
        for (uint256 i; i < payouts.length; ++i) {
            address token = payouts[i].token;
            if (_tokenIndex(tokens, tokenCount, token) == type(uint256).max) tokens[tokenCount++] = token;
        }
        uint8[2] memory counts;
        for (uint256 i; i < resolution.length; ++i) {
            MissionTypes.Allocation calldata allocation = resolution[i];
            uint256 tokenIndex = _tokenIndex(tokens, tokenCount, allocation.token);
            if (allocation.amount == 0 || tokenIndex == type(uint256).max || !_allowedResolutionRecipient(index, allocation.recipient)
                || ++counts[tokenIndex] > MissionTypes.MAX_PAYOUTS_PER_ASSET_PER_MILESTONE) revert InvalidResolution();
        }
        for (uint256 i; i < tokenCount; ++i) {
            if (_sumStorage(payouts, tokens[i]) != _sumCalldata(resolution, tokens[i])) revert InvalidResolution();
        }
    }

    function _allowedResolutionRecipient(uint256 index, address recipient) private view returns (bool) {
        if (recipient == refundAddress) return true;
        MissionTypes.Allocation[] storage payouts = milestonePayouts[index];
        for (uint256 i; i < payouts.length; ++i) if (recipient == payouts[i].recipient) return true;
        return false;
    }

    function _settleStored(MissionTypes.Allocation[] storage values) private {
        for (uint256 i; i < values.length; ++i) _recordSettlement(values[i].token, values[i].recipient, values[i].amount);
        for (uint256 i; i < values.length; ++i) _transferAsset(values[i].token, values[i].recipient, values[i].amount);
    }

    function _settleCalldata(MissionTypes.Allocation[] calldata values) private {
        for (uint256 i; i < values.length; ++i) _recordSettlement(values[i].token, values[i].recipient, values[i].amount);
        for (uint256 i; i < values.length; ++i) _transferAsset(values[i].token, values[i].recipient, values[i].amount);
    }

    function _recordSettlement(address token, address recipient, uint256 amount) private {
        if (remainingLiability[token] < amount) revert InvalidResolution();
        remainingLiability[token] -= amount;
        if (recipient == refundAddress) totalRefunded[token] += amount;
        else totalReleased[token] += amount;
    }

    function _sumStorage(MissionTypes.Allocation[] storage values, address token) private view returns (uint256 total) {
        for (uint256 i; i < values.length; ++i) if (values[i].token == token) total += values[i].amount;
    }

    function _sumCalldata(MissionTypes.Allocation[] calldata values, address token) private pure returns (uint256 total) {
        for (uint256 i; i < values.length; ++i) if (values[i].token == token) total += values[i].amount;
    }

    function _assetBalance(address token) private view returns (uint256) {
        return token == address(0) ? address(this).balance : _balanceOf(token);
    }

    function _balanceOf(address token) private view returns (uint256 balance) {
        (bool ok, bytes memory result) = token.staticcall(abi.encodeWithSignature("balanceOf(address)", address(this)));
        if (!ok || result.length < 32) revert TokenCallFailed();
        balance = abi.decode(result, (uint256));
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) private {
        (bool ok, bytes memory result) = token.call(abi.encodeWithSignature("transferFrom(address,address,uint256)", from, to, amount));
        if (!ok || (result.length != 0 && (result.length < 32 || !abi.decode(result, (bool))))) revert TokenCallFailed();
    }

    function _transferAsset(address token, address recipient, uint256 amount) private {
        if (token == address(0)) {
            (bool ok,) = payable(recipient).call{value: amount}("");
            if (!ok) revert TokenCallFailed();
        } else {
            (bool ok, bytes memory result) = token.call(abi.encodeWithSignature("transfer(address,uint256)", recipient, amount));
            if (!ok || (result.length != 0 && (result.length < 32 || !abi.decode(result, (bool))))) revert TokenCallFailed();
        }
    }
}
