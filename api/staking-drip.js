#!/usr/bin/env node
/**
 * Staking Reward Drip — deposits 1/7th of weekly reward pool daily
 * Called by cron at 5pm CST (11pm UTC)
 */
const path = require('path');
const { ethers } = require('ethers');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const STAKING = '0x0adb95311B9B6007cA045bD05d0FEecfa2d8C4b0';
const CRED = '0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3';
const DAILY_AMOUNT = ethers.parseUnits('14285714', 18); // ~14.3M = 100M / 7

async function main() {
    const client = new SecretsManagerClient({ region: 'us-east-2' });
    const resp = await client.send(new GetSecretValueCommand({ SecretId: 'helixa/deployer-key' }));
    const key = JSON.parse(resp.SecretString).DEPLOYER_PRIVATE_KEY;
    const provider = new ethers.JsonRpcProvider('https://mainnet.base.org', 8453, { staticNetwork: true });
    const wallet = new ethers.Wallet(key, provider);

    const token = new ethers.Contract(CRED, [
        'function balanceOf(address) view returns (uint256)',
        'function allowance(address,address) view returns (uint256)',
        'function approve(address,uint256) returns (bool)',
    ], wallet);

    const staking = new ethers.Contract(STAKING, [
        'function depositRewards(uint256)',
        'function totalEffectiveStake() view returns (uint256)',
    ], wallet);

    // Check if anyone is staked
    const totalEff = await staking.totalEffectiveStake();
    if (totalEff === 0n) {
        console.log('[DRIP] No stakers — skipping deposit');
        return;
    }

    // Check deployer balance
    const balance = await token.balanceOf(wallet.address);
    if (balance < DAILY_AMOUNT) {
        console.log(`[DRIP] Insufficient balance: ${ethers.formatUnits(balance, 18)} (need ${ethers.formatUnits(DAILY_AMOUNT, 18)})`);
        return;
    }

    // Check allowance
    const allowance = await token.allowance(wallet.address, STAKING);
    if (allowance < DAILY_AMOUNT) {
        console.log('[DRIP] Approving...');
        const appTx = await token.approve(STAKING, ethers.parseUnits('1000000000', 18)); // approve 1B
        await appTx.wait();
    }

    // Deposit
    console.log(`[DRIP] Depositing ${ethers.formatUnits(DAILY_AMOUNT, 18)} CRED rewards...`);
    const tx = await staking.depositRewards(DAILY_AMOUNT);
    console.log(`[DRIP] TX: ${tx.hash}`);
    await tx.wait();
    
    const remaining = await token.balanceOf(wallet.address);
    console.log(`[DRIP] Done. Remaining deployer balance: ${ethers.formatUnits(remaining, 18)} CRED`);
}

main().catch(err => {
    console.error('[DRIP] Error:', err.message);
    process.exit(1);
});
