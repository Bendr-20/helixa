#!/usr/bin/env node
/**
 * Venice-Powered Private Agent Evaluator
 * 
 * Uses Venice.AI's private inference (no data retention) to analyze
 * agent behavioral data and produce trust assessments for HelixaEvaluator.
 * 
 * "Private cognition, public consequence"
 */

import 'dotenv/config';
import { createPublicClient, http, parseAbi } from 'viem';
import { base } from 'viem/chains';

// --- Config ---
const VENICE_API_KEY = process.env.VENICE_API_KEY;
const VENICE_BASE_URL = 'https://api.venice.ai/api/v1';
const VENICE_MODEL = 'llama-3.3-70b';

const HELIXA_V2 = '0x2e3B541C59D38b84E3Bc54e977200230A204Fe60';
const HELIXA_EVALUATOR = '0x2e706ffD21DE4882E02e160200689B9D596dAa55';

const HELIXA_ABI = parseAbi([
  'function credScore(address) view returns (uint256)',
  'function agentProfile(address) view returns (string name, uint256 credScore, uint256 jobsCompleted, uint256 jobsFailed, uint256 lastActive)',
]);

const EVALUATOR_ABI = parseAbi([
  'function evaluateAgent(address agent) view returns (uint256 score, string reason)',
]);

const client = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org'),
});

// --- Venice Private Inference ---
async function queryVenice(systemPrompt, userPrompt) {
  const res = await fetch(`${VENICE_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VENICE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: VENICE_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Venice API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

// --- Onchain Data Fetching ---
async function fetchAgentData(agentAddress) {
  try {
    const profile = await client.readContract({
      address: HELIXA_V2,
      abi: HELIXA_ABI,
      functionName: 'agentProfile',
      args: [agentAddress],
    });
    return {
      address: agentAddress,
      name: profile[0],
      credScore: Number(profile[1]),
      jobsCompleted: Number(profile[2]),
      jobsFailed: Number(profile[3]),
      lastActive: Number(profile[4]),
    };
  } catch {
    // Fallback: try just credScore
    try {
      const score = await client.readContract({
        address: HELIXA_V2,
        abi: HELIXA_ABI,
        functionName: 'credScore',
        args: [agentAddress],
      });
      return { address: agentAddress, credScore: Number(score), source: 'credScore-only' };
    } catch {
      return null;
    }
  }
}

async function fetchWalletActivity(address) {
  // Fetch recent tx count and ETH balance as behavioral signals
  const [txCount, balance] = await Promise.all([
    client.getTransactionCount({ address }),
    client.getBalance({ address }),
  ]);
  return {
    transactionCount: txCount,
    ethBalance: Number(balance) / 1e18,
  };
}

// --- Core Evaluation ---
async function evaluateAgent(agentAddress) {
  console.log(`\n🔍 Evaluating agent: ${agentAddress}`);
  console.log('─'.repeat(60));

  // 1. Gather onchain data
  console.log('📡 Fetching onchain data...');
  const [agentData, walletActivity] = await Promise.all([
    fetchAgentData(agentAddress),
    fetchWalletActivity(agentAddress),
  ]);

  const onchainSummary = {
    ...(agentData || { address: agentAddress, credScore: 'unknown' }),
    wallet: walletActivity,
  };

  console.log('  Cred Score:', agentData?.credScore ?? 'N/A');
  console.log('  Tx Count:', walletActivity.transactionCount);
  console.log('  ETH Balance:', walletActivity.ethBalance.toFixed(4));

  // 2. Send to Venice for PRIVATE analysis
  console.log('\n🔐 Querying Venice.AI (private inference, no data retention)...');

  const systemPrompt = `You are a trust evaluation engine for autonomous AI agents operating onchain.
You analyze agent behavioral data and produce structured trust assessments.
Your analysis is PRIVATE — it will not be stored by the inference provider.
The trust score you produce will be published onchain via HelixaEvaluator (ERC-8183).

Output a JSON object with:
- trustScore: 0-100 integer
- riskLevel: "low" | "medium" | "high" | "critical"  
- factors: array of {factor, weight, assessment} objects
- recommendation: "approve" | "flag" | "reject"
- reasoning: brief explanation (1-2 sentences)

Be analytical and precise. Base assessment on the data provided.`;

  const userPrompt = `Evaluate this agent's trustworthiness for autonomous job execution on Base L2:

Agent Address: ${agentAddress}
Onchain Profile: ${JSON.stringify(onchainSummary, null, 2)}

Context:
- HelixaEvaluator contract: ${HELIXA_EVALUATOR}
- HelixaV2 identity contract: ${HELIXA_V2}
- Protocol: ERC-8183 (agent job evaluation), ERC-8004 (onchain identity)
- Network: Base (Ethereum L2)

Analyze the agent's behavioral patterns and provide a trust assessment.`;

  const raw = await queryVenice(systemPrompt, userPrompt);

  // 3. Parse Venice response
  let assessment;
  try {
    // Extract JSON from response (Venice may wrap in markdown)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    assessment = JSON.parse(jsonMatch[0]);
  } catch {
    assessment = { raw, parseError: true };
  }

  // 4. Output results
  console.log('\n📊 Trust Assessment:');
  console.log('─'.repeat(60));
  if (assessment.parseError) {
    console.log(assessment.raw);
  } else {
    console.log(`  Trust Score: ${assessment.trustScore}/100`);
    console.log(`  Risk Level:  ${assessment.riskLevel}`);
    console.log(`  Decision:    ${assessment.recommendation}`);
    console.log(`  Reasoning:   ${assessment.reasoning}`);
    if (assessment.factors) {
      console.log('\n  Factors:');
      for (const f of assessment.factors) {
        console.log(`    • ${f.factor} (weight: ${f.weight}) → ${f.assessment}`);
      }
    }
  }

  return { onchain: onchainSummary, assessment };
}

// --- Sample Evaluation (with mock data for demo) ---
async function runSampleEvaluation() {
  console.log('═'.repeat(60));
  console.log('🏛️  Venice-Powered Private Agent Evaluator');
  console.log('   "Private cognition, public consequence"');
  console.log('═'.repeat(60));

  // Use a sample agent address (or from CLI arg)
  const agentAddress = process.argv[2] || '0x1234567890abcdef1234567890abcdef12345678';

  // If no real onchain data, demonstrate with mock + real Venice call
  if (!process.argv[2]) {
    console.log('\n⚡ Demo mode — using sample data with REAL Venice inference\n');

    const mockSystemPrompt = `You are a trust evaluation engine for autonomous AI agents operating onchain.
You analyze agent behavioral data and produce structured trust assessments.
Your analysis is PRIVATE — it will not be stored by the inference provider.
The trust score you produce will be published onchain via HelixaEvaluator (ERC-8183).

Output a JSON object with:
- trustScore: 0-100 integer
- riskLevel: "low" | "medium" | "high" | "critical"
- factors: array of {factor, weight, assessment} objects
- recommendation: "approve" | "flag" | "reject"
- reasoning: brief explanation (1-2 sentences)`;

    const mockData = {
      address: '0xA1B2C3D4E5F6789012345678ABCDEF0123456789',
      name: 'TradeBot-Alpha',
      credScore: 72,
      jobsCompleted: 15,
      jobsFailed: 2,
      lastActive: Math.floor(Date.now() / 1000) - 3600,
      wallet: { transactionCount: 89, ethBalance: 0.45 },
      recentBehavior: {
        avgJobCompletionTime: '4.2 hours',
        failureRate: '11.8%',
        largestTxValue: '2.1 ETH',
        uniqueInteractions: 23,
        flaggedPatterns: ['sudden increase in tx frequency', 'new high-value transfers'],
      },
    };

    console.log('📡 Sample Agent Data:');
    console.log(JSON.stringify(mockData, null, 2));
    console.log('\n🔐 Querying Venice.AI (private inference, no data retention)...');

    const raw = await queryVenice(mockSystemPrompt,
      `Evaluate this agent for autonomous job execution on Base L2:\n${JSON.stringify(mockData, null, 2)}`);

    let assessment;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      assessment = JSON.parse(jsonMatch[0]);
    } catch {
      assessment = { raw, parseError: true };
    }

    console.log('\n📊 Trust Assessment:');
    console.log('─'.repeat(60));
    if (assessment.parseError) {
      console.log(assessment.raw);
    } else {
      console.log(`  Trust Score: ${assessment.trustScore}/100`);
      console.log(`  Risk Level:  ${assessment.riskLevel}`);
      console.log(`  Decision:    ${assessment.recommendation}`);
      console.log(`  Reasoning:   ${assessment.reasoning}`);
      if (assessment.factors) {
        console.log('\n  Factors:');
        for (const f of assessment.factors) {
          console.log(`    • ${f.factor} (weight: ${f.weight}) → ${f.assessment}`);
        }
      }
    }

    return { mock: mockData, assessment };
  }

  return evaluateAgent(agentAddress);
}

runSampleEvaluation().catch(console.error);
