// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title HelixaEvaluator
 * @notice ERC-8183 Evaluator that gates job completion on Helixa Cred Scores.
 *         Designed to be set as the `evaluator` address on an ERC-8183 job contract.
 *
 * Features:
 *   1. Auto-complete: If provider's cred score >= threshold, auto-completes the job.
 *   2. Dynamic thresholds: Per-job cred requirements based on job value.
 *   3. Cred-gated bidding: Only agents above a minimum cred can be assigned as provider.
 *   4. Reputation feedback: Tracks job completions/rejections per agent for cred score input.
 *   5. Delegated: Owner can manually complete/reject with cred score recorded as attestation.
 */

interface ICredOracle {
    function getCredScore(uint256 tokenId) external view returns (uint8);
}

interface IHelixaV2 {
    function ownerOf(uint256 tokenId) external view returns (address);
    function totalAgents() external view returns (uint256);
}

interface IERC8183Job {
    function complete(uint256 jobId, bytes32 reason) external;
    function reject(uint256 jobId, bytes32 reason) external;
}

contract HelixaEvaluator {

    // ─── Storage ────────────────────────────────────────────────────

    address public owner;
    ICredOracle public credOracle;
    IHelixaV2 public helixa;

    /// @notice Default minimum cred score (0-100) required to auto-complete
    uint256 public autoCompleteThreshold;

    /// @notice Default minimum cred score to be eligible as a provider
    uint256 public providerMinCred;

    /// @notice Maps wallet address → Helixa token ID (for cred lookups)
    mapping(address => uint256) public walletToAgent;

    /// @notice Trusted ERC-8183 job contracts
    mapping(address => bool) public trustedJobContracts;

    // ─── Dynamic Thresholds ─────────────────────────────────────────

    struct TierThreshold {
        uint256 maxBudget;      // jobs up to this budget (in token units)
        uint256 minCred;        // require this cred score
    }

    /// @notice Ordered tiers: [0] = lowest budget tier, ascending
    TierThreshold[] public tiers;

    /// @notice Per-job threshold override (jobContract => jobId => minCred). 0 = use default/tiers.
    mapping(address => mapping(uint256 => uint256)) public jobThresholdOverride;

    // ─── Reputation Feedback ────────────────────────────────────────

    struct AgentRecord {
        uint256 completions;
        uint256 rejections;
        uint256 totalEarned;     // cumulative budget of completed jobs
        uint256 lastJobTimestamp;
    }

    /// @notice Job performance record per agent token ID
    mapping(uint256 => AgentRecord) public agentRecords;

    // ─── Events ─────────────────────────────────────────────────────

    event AutoCompleted(address indexed jobContract, uint256 indexed jobId, address provider, uint256 credScore);
    event AutoRejected(address indexed jobContract, uint256 indexed jobId, address provider, uint256 credScore, string reason);
    event ManualComplete(address indexed jobContract, uint256 indexed jobId, bytes32 reason);
    event ManualReject(address indexed jobContract, uint256 indexed jobId, bytes32 reason);
    event AgentLinked(address indexed wallet, uint256 indexed tokenId);
    event ThresholdsUpdated(uint256 autoComplete, uint256 providerMin);
    event JobContractUpdated(address indexed jobContract, bool trusted);
    event TiersUpdated(uint256 count);
    event JobThresholdSet(address indexed jobContract, uint256 indexed jobId, uint256 minCred);
    event ReputationUpdated(uint256 indexed tokenId, uint256 completions, uint256 rejections, uint256 totalEarned);

    // ─── Errors ─────────────────────────────────────────────────────

    error NotOwner();
    error NotTrustedContract();
    error NoAgentLinked();
    error CredBelowMinimum(uint256 score, uint256 required);
    error NotTokenOwner();
    error InvalidTiers();

    // ─── Constructor ────────────────────────────────────────────────

    constructor(
        address _credOracle,
        address _helixa,
        uint256 _autoCompleteThreshold,
        uint256 _providerMinCred
    ) {
        owner = msg.sender;
        credOracle = ICredOracle(_credOracle);
        helixa = IHelixaV2(_helixa);
        autoCompleteThreshold = _autoCompleteThreshold;
        providerMinCred = _providerMinCred;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // ─── Agent Linking ──────────────────────────────────────────────

    /// @notice Link your wallet to your Helixa agent (must own the token)
    function linkAgent(uint256 tokenId) external {
        if (helixa.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        walletToAgent[msg.sender] = tokenId;
        emit AgentLinked(msg.sender, tokenId);
    }

    /// @notice Get cred score for a wallet (returns 0 if no agent linked)
    function getCredForWallet(address wallet) public view returns (uint256) {
        uint256 tokenId = walletToAgent[wallet];
        if (tokenId == 0) return 0;
        return credOracle.getCredScore(tokenId);
    }

    // ─── Provider Eligibility ───────────────────────────────────────

    /// @notice Check if a wallet is eligible to be a provider (default threshold)
    function isEligibleProvider(address provider) external view returns (bool) {
        if (providerMinCred == 0) return true;
        return getCredForWallet(provider) >= providerMinCred;
    }

    /// @notice Check if a wallet is eligible for a specific job budget
    function isEligibleForBudget(address provider, uint256 budget) external view returns (bool) {
        uint256 required = getThresholdForBudget(budget);
        return getCredForWallet(provider) >= required;
    }

    // ─── Dynamic Threshold Resolution ───────────────────────────────

    /// @notice Get the cred threshold for a given budget amount
    function getThresholdForBudget(uint256 budget) public view returns (uint256) {
        // Check tiers (ascending by maxBudget)
        for (uint256 i = 0; i < tiers.length; i++) {
            if (budget <= tiers[i].maxBudget) {
                return tiers[i].minCred;
            }
        }
        // Above all tiers → use default
        return autoCompleteThreshold;
    }

    /// @notice Resolve the effective threshold for a specific job
    function getEffectiveThreshold(
        address jobContract,
        uint256 jobId,
        uint256 budget
    ) public view returns (uint256) {
        // Per-job override takes priority
        uint256 override_ = jobThresholdOverride[jobContract][jobId];
        if (override_ > 0) return override_;
        // Then tier-based
        return getThresholdForBudget(budget);
    }

    // ─── Evaluator Functions ────────────────────────────────────────

    /// @notice Auto-evaluate a submitted job based on provider's cred score
    /// @param budget The job's budget (for dynamic threshold). Pass 0 to use default.
    function evaluate(
        address jobContract,
        uint256 jobId,
        address provider,
        uint256 budget
    ) external {
        if (!trustedJobContracts[jobContract]) revert NotTrustedContract();

        uint256 tokenId = walletToAgent[provider];
        if (tokenId == 0) {
            IERC8183Job(jobContract).reject(jobId, keccak256("NO_AGENT_LINKED"));
            emit AutoRejected(jobContract, jobId, provider, 0, "no_agent_linked");
            return;
        }

        uint256 score = credOracle.getCredScore(tokenId);
        uint256 required = getEffectiveThreshold(jobContract, jobId, budget);

        if (score >= required) {
            bytes32 reason = bytes32(uint256(score));
            IERC8183Job(jobContract).complete(jobId, reason);

            // Record completion
            AgentRecord storage rec = agentRecords[tokenId];
            rec.completions++;
            rec.totalEarned += budget;
            rec.lastJobTimestamp = block.timestamp;
            emit ReputationUpdated(tokenId, rec.completions, rec.rejections, rec.totalEarned);

            emit AutoCompleted(jobContract, jobId, provider, score);
        } else {
            bytes32 reason = keccak256(abi.encodePacked("CRED_BELOW_THRESHOLD:", score));
            IERC8183Job(jobContract).reject(jobId, reason);

            // Record rejection
            AgentRecord storage rec = agentRecords[tokenId];
            rec.rejections++;
            rec.lastJobTimestamp = block.timestamp;
            emit ReputationUpdated(tokenId, rec.completions, rec.rejections, rec.totalEarned);

            emit AutoRejected(jobContract, jobId, provider, score, "cred_below_threshold");
        }
    }

    /// @notice Legacy evaluate without budget (uses default threshold)
    function evaluate(
        address jobContract,
        uint256 jobId,
        address provider
    ) external {
        if (!trustedJobContracts[jobContract]) revert NotTrustedContract();

        uint256 tokenId = walletToAgent[provider];
        if (tokenId == 0) {
            IERC8183Job(jobContract).reject(jobId, keccak256("NO_AGENT_LINKED"));
            emit AutoRejected(jobContract, jobId, provider, 0, "no_agent_linked");
            return;
        }

        uint256 score = credOracle.getCredScore(tokenId);

        if (score >= autoCompleteThreshold) {
            bytes32 reason = bytes32(uint256(score));
            IERC8183Job(jobContract).complete(jobId, reason);

            AgentRecord storage rec = agentRecords[tokenId];
            rec.completions++;
            rec.lastJobTimestamp = block.timestamp;
            emit ReputationUpdated(tokenId, rec.completions, rec.rejections, rec.totalEarned);

            emit AutoCompleted(jobContract, jobId, provider, score);
        } else {
            bytes32 reason = keccak256(abi.encodePacked("CRED_BELOW_THRESHOLD:", score));
            IERC8183Job(jobContract).reject(jobId, reason);

            AgentRecord storage rec = agentRecords[tokenId];
            rec.rejections++;
            rec.lastJobTimestamp = block.timestamp;
            emit ReputationUpdated(tokenId, rec.completions, rec.rejections, rec.totalEarned);

            emit AutoRejected(jobContract, jobId, provider, score, "cred_below_threshold");
        }
    }

    /// @notice Owner manually completes a job
    function manualComplete(
        address jobContract,
        uint256 jobId,
        address provider,
        uint256 budget,
        bytes32 reason
    ) external onlyOwner {
        if (!trustedJobContracts[jobContract]) revert NotTrustedContract();
        IERC8183Job(jobContract).complete(jobId, reason);

        uint256 tokenId = walletToAgent[provider];
        if (tokenId != 0) {
            AgentRecord storage rec = agentRecords[tokenId];
            rec.completions++;
            rec.totalEarned += budget;
            rec.lastJobTimestamp = block.timestamp;
            emit ReputationUpdated(tokenId, rec.completions, rec.rejections, rec.totalEarned);
        }

        emit ManualComplete(jobContract, jobId, reason);
    }

    /// @notice Owner manually rejects a job
    function manualReject(
        address jobContract,
        uint256 jobId,
        address provider,
        bytes32 reason
    ) external onlyOwner {
        if (!trustedJobContracts[jobContract]) revert NotTrustedContract();
        IERC8183Job(jobContract).reject(jobId, reason);

        uint256 tokenId = walletToAgent[provider];
        if (tokenId != 0) {
            AgentRecord storage rec = agentRecords[tokenId];
            rec.rejections++;
            rec.lastJobTimestamp = block.timestamp;
            emit ReputationUpdated(tokenId, rec.completions, rec.rejections, rec.totalEarned);
        }

        emit ManualReject(jobContract, jobId, reason);
    }

    // ─── Reputation Views ───────────────────────────────────────────

    /// @notice Get an agent's job performance record
    function getAgentRecord(uint256 tokenId) external view returns (
        uint256 completions,
        uint256 rejections,
        uint256 totalEarned,
        uint256 lastJobTimestamp,
        uint256 successRate  // basis points (10000 = 100%)
    ) {
        AgentRecord memory rec = agentRecords[tokenId];
        completions = rec.completions;
        rejections = rec.rejections;
        totalEarned = rec.totalEarned;
        lastJobTimestamp = rec.lastJobTimestamp;

        uint256 total = rec.completions + rec.rejections;
        successRate = total > 0 ? (rec.completions * 10000) / total : 0;
    }

    /// @notice Get an agent's job performance by wallet
    function getWalletRecord(address wallet) external view returns (
        uint256 completions,
        uint256 rejections,
        uint256 totalEarned,
        uint256 successRate
    ) {
        uint256 tokenId = walletToAgent[wallet];
        if (tokenId == 0) return (0, 0, 0, 0);
        AgentRecord memory rec = agentRecords[tokenId];
        completions = rec.completions;
        rejections = rec.rejections;
        totalEarned = rec.totalEarned;
        uint256 total = rec.completions + rec.rejections;
        successRate = total > 0 ? (rec.completions * 10000) / total : 0;
    }

    // ─── Admin ──────────────────────────────────────────────────────

    function setThresholds(uint256 _autoComplete, uint256 _providerMin) external onlyOwner {
        autoCompleteThreshold = _autoComplete;
        providerMinCred = _providerMin;
        emit ThresholdsUpdated(_autoComplete, _providerMin);
    }

    /// @notice Set value-based tiers. Must be ascending by maxBudget.
    function setTiers(TierThreshold[] calldata _tiers) external onlyOwner {
        delete tiers;
        for (uint256 i = 0; i < _tiers.length; i++) {
            if (i > 0 && _tiers[i].maxBudget <= _tiers[i-1].maxBudget) revert InvalidTiers();
            tiers.push(_tiers[i]);
        }
        emit TiersUpdated(_tiers.length);
    }

    /// @notice Override threshold for a specific job
    function setJobThreshold(address jobContract, uint256 jobId, uint256 minCred) external onlyOwner {
        jobThresholdOverride[jobContract][jobId] = minCred;
        emit JobThresholdSet(jobContract, jobId, minCred);
    }

    function setTrustedJobContract(address jobContract, bool trusted) external onlyOwner {
        trustedJobContracts[jobContract] = trusted;
        emit JobContractUpdated(jobContract, trusted);
    }

    function setCredOracle(address _credOracle) external onlyOwner {
        credOracle = ICredOracle(_credOracle);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }

    function getTiersCount() external view returns (uint256) {
        return tiers.length;
    }
}
