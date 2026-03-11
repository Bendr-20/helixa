// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {AgenticCommerce} from "../src/v2/AgenticCommerce.sol";
import {HelixaEvaluator} from "../src/v2/HelixaEvaluator.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// ─── Mock Token ─────────────────────────────────────────────────────

contract MockUSDC is ERC20 {
    constructor() ERC20("USDC", "USDC") {
        _mint(msg.sender, 1_000_000e6);
    }
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amt) external { _mint(to, amt); }
}

contract MockCredOracle {
    mapping(uint256 => uint256) public scores;
    function setScore(uint256 tokenId, uint256 score) external { scores[tokenId] = score; }
    function getScore(uint256 tokenId) external view returns (uint256) { return scores[tokenId]; }
}

contract MockHelixa {
    mapping(uint256 => address) public owners;
    function setOwner(uint256 tokenId, address owner) external { owners[tokenId] = owner; }
    function ownerOf(uint256 tokenId) external view returns (address) { return owners[tokenId]; }
    function totalAgents() external pure returns (uint256) { return 100; }
}

// ─── Integration Tests ──────────────────────────────────────────────

contract AgenticCommerceTest is Test {
    AgenticCommerce commerce;
    HelixaEvaluator evaluator;
    MockUSDC usdc;
    MockCredOracle oracle;
    MockHelixa helixa;

    address deployer = address(this);
    address client = address(0xC11E47);
    address provider = address(0xBEEF);
    address treasury = address(0x7EA5);

    function setUp() public {
        usdc = new MockUSDC();
        oracle = new MockCredOracle();
        helixa = new MockHelixa();

        evaluator = new HelixaEvaluator(address(oracle), address(helixa), 70, 30);

        commerce = new AgenticCommerce(address(usdc), treasury, 250); // 2.5% fee

        evaluator.setTrustedJobContract(address(commerce), true);

        // Fund client
        usdc.mint(client, 10_000e6);

        // Set up provider as agent #1 with cred 85
        helixa.setOwner(1, provider);
        oracle.setScore(1, 85);
        vm.prank(provider);
        evaluator.linkAgent(1);
    }

    // ─── Basic Flow ─────────────────────────────────────────────────

    function test_fullFlow_happyPath() public {
        // Client creates job with evaluator = HelixaEvaluator
        vm.prank(client);
        uint256 jobId = commerce.createJob(
            provider,
            address(evaluator),
            block.timestamp + 7 days,
            "Write a research report on ERC-8183"
        );

        // Client sets budget
        vm.prank(client);
        commerce.setBudget(jobId, 100e6); // 100 USDC

        // Client funds
        vm.prank(client);
        usdc.approve(address(commerce), 100e6);
        vm.prank(client);
        commerce.fund(jobId, 100e6);

        // Provider submits work
        vm.prank(provider);
        commerce.submit(jobId, keccak256("ipfs://QmReport"));

        // Anyone triggers auto-evaluation via HelixaEvaluator
        evaluator.evaluate(address(commerce), jobId, provider);

        // Verify completion
        AgenticCommerce.Job memory job = commerce.getJob(jobId);
        assertEq(uint8(job.status), uint8(AgenticCommerce.Status.Completed));

        // Provider got paid (100 - 2.5% = 97.5 USDC)
        assertEq(usdc.balanceOf(provider), 97_500000);
        // Treasury got fee
        assertEq(usdc.balanceOf(treasury), 2_500000);
    }

    function test_fullFlow_lowCredRejected() public {
        // Set up a low-cred provider
        address badProvider = address(0xBAD);
        helixa.setOwner(2, badProvider);
        oracle.setScore(2, 25); // below threshold
        vm.prank(badProvider);
        evaluator.linkAgent(2);

        vm.prank(client);
        uint256 jobId = commerce.createJob(
            badProvider,
            address(evaluator),
            block.timestamp + 7 days,
            "Sketchy job"
        );

        vm.prank(client);
        commerce.setBudget(jobId, 50e6);

        vm.prank(client);
        usdc.approve(address(commerce), 50e6);
        vm.prank(client);
        commerce.fund(jobId, 50e6);

        vm.prank(badProvider);
        commerce.submit(jobId, keccak256("bad_work"));

        // Auto-evaluation rejects due to low cred
        evaluator.evaluate(address(commerce), jobId, badProvider);

        AgenticCommerce.Job memory job = commerce.getJob(jobId);
        assertEq(uint8(job.status), uint8(AgenticCommerce.Status.Rejected));

        // Client refunded
        assertEq(usdc.balanceOf(client), 10_000e6);
    }

    function test_clientRejectOpen() public {
        vm.prank(client);
        uint256 jobId = commerce.createJob(
            provider,
            address(evaluator),
            block.timestamp + 1 days,
            "Changed my mind"
        );

        vm.prank(client);
        commerce.reject(jobId, bytes32(0));

        AgenticCommerce.Job memory job = commerce.getJob(jobId);
        assertEq(uint8(job.status), uint8(AgenticCommerce.Status.Rejected));
    }

    function test_expiry() public {
        vm.prank(client);
        uint256 jobId = commerce.createJob(
            provider,
            address(evaluator),
            block.timestamp + 1 days,
            "Time-limited job"
        );

        vm.prank(client);
        commerce.setBudget(jobId, 100e6);
        vm.prank(client);
        usdc.approve(address(commerce), 100e6);
        vm.prank(client);
        commerce.fund(jobId, 100e6);

        // Fast forward past expiry
        vm.warp(block.timestamp + 2 days);

        commerce.claimRefund(jobId);

        AgenticCommerce.Job memory job = commerce.getJob(jobId);
        assertEq(uint8(job.status), uint8(AgenticCommerce.Status.Expired));
        assertEq(usdc.balanceOf(client), 10_000e6); // full refund
    }

    function test_setProviderLater() public {
        vm.prank(client);
        uint256 jobId = commerce.createJob(
            address(0), // no provider yet
            address(evaluator),
            block.timestamp + 7 days,
            "Open job"
        );

        vm.prank(client);
        commerce.setProvider(jobId, provider);

        AgenticCommerce.Job memory job = commerce.getJob(jobId);
        assertEq(job.provider, provider);
    }

    function test_fund_reverts_noProvider() public {
        vm.prank(client);
        uint256 jobId = commerce.createJob(
            address(0),
            address(evaluator),
            block.timestamp + 7 days,
            "No provider yet"
        );

        vm.prank(client);
        commerce.setBudget(jobId, 100e6);

        vm.prank(client);
        usdc.approve(address(commerce), 100e6);
        vm.prank(client);
        vm.expectRevert(AgenticCommerce.ProviderNotSet.selector);
        commerce.fund(jobId, 100e6);
    }

    function test_fund_reverts_budgetMismatch() public {
        vm.prank(client);
        uint256 jobId = commerce.createJob(
            provider,
            address(evaluator),
            block.timestamp + 7 days,
            "Job"
        );

        vm.prank(client);
        commerce.setBudget(jobId, 100e6);

        vm.prank(client);
        usdc.approve(address(commerce), 200e6);
        vm.prank(client);
        vm.expectRevert(abi.encodeWithSelector(AgenticCommerce.BudgetMismatch.selector, 100e6, 200e6));
        commerce.fund(jobId, 200e6);
    }

    function test_submit_reverts_notProvider() public {
        vm.prank(client);
        uint256 jobId = commerce.createJob(provider, address(evaluator), block.timestamp + 7 days, "Job");
        vm.prank(client);
        commerce.setBudget(jobId, 100e6);
        vm.prank(client);
        usdc.approve(address(commerce), 100e6);
        vm.prank(client);
        commerce.fund(jobId, 100e6);

        vm.prank(client); // wrong caller
        vm.expectRevert(AgenticCommerce.NotProvider.selector);
        commerce.submit(jobId, keccak256("work"));
    }

    function test_complete_reverts_notEvaluator() public {
        vm.prank(client);
        uint256 jobId = commerce.createJob(provider, address(evaluator), block.timestamp + 7 days, "Job");
        vm.prank(client);
        commerce.setBudget(jobId, 100e6);
        vm.prank(client);
        usdc.approve(address(commerce), 100e6);
        vm.prank(client);
        commerce.fund(jobId, 100e6);
        vm.prank(provider);
        commerce.submit(jobId, keccak256("work"));

        vm.prank(client); // wrong caller
        vm.expectRevert(AgenticCommerce.NotEvaluator.selector);
        commerce.complete(jobId, bytes32(0));
    }

    function test_providerBudgetNegotiation() public {
        vm.prank(client);
        uint256 jobId = commerce.createJob(provider, address(evaluator), block.timestamp + 7 days, "Negotiate");

        // Provider proposes budget
        vm.prank(provider);
        commerce.setBudget(jobId, 200e6);

        // Client can override
        vm.prank(client);
        commerce.setBudget(jobId, 150e6);

        AgenticCommerce.Job memory job = commerce.getJob(jobId);
        assertEq(job.budget, 150e6);
    }

    function test_eligibilityCheck() public {
        // High cred provider is eligible
        assertTrue(evaluator.isEligibleProvider(provider));

        // Unlinked wallet is not
        assertFalse(evaluator.isEligibleProvider(client));
    }
}
