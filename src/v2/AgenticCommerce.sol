// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title AgenticCommerce
 * @notice Reference implementation of ERC-8183 Agentic Commerce Protocol.
 *         Job escrow with evaluator attestation for agent commerce.
 *
 * States: Open → Funded → Submitted → Terminal (Completed | Rejected | Expired)
 */
contract AgenticCommerce {
    using SafeERC20 for IERC20;

    // ─── Types ──────────────────────────────────────────────────────

    enum Status { Open, Funded, Submitted, Completed, Rejected, Expired }

    struct Job {
        address client;
        address provider;
        address evaluator;
        uint256 budget;
        uint256 expiredAt;
        Status status;
        string description;
        bytes32 deliverable;
        bytes32 completionReason;
    }

    // ─── Storage ────────────────────────────────────────────────────

    IERC20 public immutable paymentToken;
    address public treasury;
    uint256 public platformFeeBps; // basis points (100 = 1%)
    uint256 public nextJobId;

    mapping(uint256 => Job) public jobs;

    // ─── Events ─────────────────────────────────────────────────────

    event JobCreated(uint256 indexed jobId, address indexed client, address provider, address evaluator, uint256 expiredAt, string description);
    event ProviderSet(uint256 indexed jobId, address indexed provider);
    event BudgetSet(uint256 indexed jobId, uint256 amount);
    event JobFunded(uint256 indexed jobId, uint256 amount);
    event JobSubmitted(uint256 indexed jobId, bytes32 deliverable);
    event JobCompleted(uint256 indexed jobId, bytes32 reason, uint256 paidToProvider, uint256 fee);
    event JobRejected(uint256 indexed jobId, bytes32 reason, address rejectedBy);
    event JobExpired(uint256 indexed jobId);

    // ─── Errors ─────────────────────────────────────────────────────

    error InvalidState(Status current, Status expected);
    error NotClient();
    error NotProvider();
    error NotEvaluator();
    error NotClientOrProvider();
    error ZeroAddress();
    error ProviderAlreadySet();
    error ProviderNotSet();
    error BudgetNotSet();
    error BudgetMismatch(uint256 expected, uint256 actual);
    error NotExpired();
    error ExpiredAtNotFuture();

    // ─── Constructor ────────────────────────────────────────────────

    constructor(address _paymentToken, address _treasury, uint256 _platformFeeBps) {
        paymentToken = IERC20(_paymentToken);
        treasury = _treasury;
        platformFeeBps = _platformFeeBps;
    }

    // ─── Core Functions ─────────────────────────────────────────────

    /// @notice Create a job. Provider may be address(0) to set later.
    function createJob(
        address provider,
        address evaluator,
        uint256 expiredAt,
        string calldata description
    ) external returns (uint256 jobId) {
        if (evaluator == address(0)) revert ZeroAddress();
        if (expiredAt <= block.timestamp) revert ExpiredAtNotFuture();

        jobId = nextJobId++;
        jobs[jobId] = Job({
            client: msg.sender,
            provider: provider,
            evaluator: evaluator,
            budget: 0,
            expiredAt: expiredAt,
            status: Status.Open,
            description: description,
            deliverable: bytes32(0),
            completionReason: bytes32(0)
        });

        emit JobCreated(jobId, msg.sender, provider, evaluator, expiredAt, description);
    }

    /// @notice Set provider (client only, Open state, provider not yet set)
    function setProvider(uint256 jobId, address provider) external {
        Job storage job = jobs[jobId];
        if (job.status != Status.Open) revert InvalidState(job.status, Status.Open);
        if (msg.sender != job.client) revert NotClient();
        if (job.provider != address(0)) revert ProviderAlreadySet();
        if (provider == address(0)) revert ZeroAddress();

        job.provider = provider;
        emit ProviderSet(jobId, provider);
    }

    /// @notice Set or update budget (client or provider, Open state)
    function setBudget(uint256 jobId, uint256 amount) external {
        Job storage job = jobs[jobId];
        if (job.status != Status.Open) revert InvalidState(job.status, Status.Open);
        if (msg.sender != job.client && msg.sender != job.provider) revert NotClientOrProvider();

        job.budget = amount;
        emit BudgetSet(jobId, amount);
    }

    /// @notice Fund the job escrow (client only, Open → Funded)
    function fund(uint256 jobId, uint256 expectedBudget) external {
        Job storage job = jobs[jobId];
        if (job.status != Status.Open) revert InvalidState(job.status, Status.Open);
        if (msg.sender != job.client) revert NotClient();
        if (job.provider == address(0)) revert ProviderNotSet();
        if (job.budget == 0) revert BudgetNotSet();
        if (job.budget != expectedBudget) revert BudgetMismatch(job.budget, expectedBudget);

        job.status = Status.Funded;
        paymentToken.safeTransferFrom(msg.sender, address(this), job.budget);

        emit JobFunded(jobId, job.budget);
    }

    /// @notice Submit work (provider only, Funded → Submitted)
    function submit(uint256 jobId, bytes32 deliverable) external {
        Job storage job = jobs[jobId];
        if (job.status != Status.Funded) revert InvalidState(job.status, Status.Funded);
        if (msg.sender != job.provider) revert NotProvider();

        job.status = Status.Submitted;
        job.deliverable = deliverable;

        emit JobSubmitted(jobId, deliverable);
    }

    /// @notice Complete job (evaluator only, Submitted → Completed)
    function complete(uint256 jobId, bytes32 reason) external {
        Job storage job = jobs[jobId];
        if (job.status != Status.Submitted) revert InvalidState(job.status, Status.Submitted);
        if (msg.sender != job.evaluator) revert NotEvaluator();

        job.status = Status.Completed;
        job.completionReason = reason;

        // Calculate fee
        uint256 fee = (job.budget * platformFeeBps) / 10000;
        uint256 payout = job.budget - fee;

        // Pay provider
        paymentToken.safeTransfer(job.provider, payout);
        if (fee > 0) {
            paymentToken.safeTransfer(treasury, fee);
        }

        emit JobCompleted(jobId, reason, payout, fee);
    }

    /// @notice Reject job
    ///   - Client can reject when Open
    ///   - Evaluator can reject when Funded or Submitted
    function reject(uint256 jobId, bytes32 reason) external {
        Job storage job = jobs[jobId];

        if (job.status == Status.Open) {
            if (msg.sender != job.client) revert NotClient();
        } else if (job.status == Status.Funded || job.status == Status.Submitted) {
            if (msg.sender != job.evaluator) revert NotEvaluator();
            // Refund client
            paymentToken.safeTransfer(job.client, job.budget);
        } else {
            revert InvalidState(job.status, Status.Open);
        }

        job.status = Status.Rejected;
        emit JobRejected(jobId, reason, msg.sender);
    }

    /// @notice Claim refund after expiry (anyone can call)
    function claimRefund(uint256 jobId) external {
        Job storage job = jobs[jobId];
        if (job.status != Status.Funded && job.status != Status.Submitted) {
            revert InvalidState(job.status, Status.Funded);
        }
        if (block.timestamp < job.expiredAt) revert NotExpired();

        job.status = Status.Expired;
        paymentToken.safeTransfer(job.client, job.budget);

        emit JobExpired(jobId);
    }

    // ─── Views ──────────────────────────────────────────────────────

    function getJob(uint256 jobId) external view returns (Job memory) {
        return jobs[jobId];
    }
}
