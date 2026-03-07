#!/usr/bin/env node
/**
 * Deploy CredOracle contract to Base mainnet
 */
const path = require('path');
const fs = require('fs');
require('module').globalPaths.unshift(path.join(__dirname, '..', 'api', 'node_modules'));
const { ethers } = require('ethers');

// Load env
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
        const [key, ...val] = line.split('=');
        if (key && val.length) process.env[key.trim()] = val.join('=').trim();
    });
}

// Load artifact
const artifactPath = path.join(__dirname, '..', 'out', 'CredOracle.sol', 'CredOracle.json');
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

// Builder code attribution
let suffix = '';
try {
    const { Attribution } = require('ox/erc8021');
    suffix = Attribution.toDataSuffix({ codes: ['bc_doy52p24'] }).slice(2);
    console.log('ERC-8021 builder code attached');
} catch (e) {
    console.warn('ox not available, no builder attribution');
}

async function main() {
    let DEPLOYER_KEY = process.env.DEPLOYER_KEY;
    
    if (!DEPLOYER_KEY) {
        console.log('Loading key from AWS Secrets Manager...');
        const { SecretsManagerClient, GetSecretValueCommand } = require(path.join(__dirname, '..', 'api', 'node_modules', '@aws-sdk', 'client-secrets-manager'));
        const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-2' });
        const resp = await client.send(new GetSecretValueCommand({ SecretId: 'helixa/deployer-key' }));
        const secret = JSON.parse(resp.SecretString);
        DEPLOYER_KEY = secret.DEPLOYER_PRIVATE_KEY;
    }

    const provider = new ethers.JsonRpcProvider('https://mainnet.base.org', 8453, { staticNetwork: true });
    const wallet = new ethers.Wallet(DEPLOYER_KEY, provider);
    
    console.log(`Deployer: ${wallet.address}`);
    const balance = await provider.getBalance(wallet.address);
    console.log(`Balance: ${ethers.formatEther(balance)} ETH`);
    
    if (balance === 0n) {
        console.error('No ETH balance! Fund the wallet first.');
        process.exit(1);
    }

    // Deploy
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode.object, wallet);
    console.log('Deploying CredOracle...');
    
    let deployTx = await factory.getDeployTransaction();
    if (suffix) {
        deployTx.data = deployTx.data + suffix;
    }
    
    const tx = await wallet.sendTransaction(deployTx);
    console.log(`TX: ${tx.hash}`);
    console.log('Waiting for confirmation...');
    
    const receipt = await tx.wait();
    console.log(`\n✅ CredOracle deployed to: ${receipt.contractAddress}`);
    console.log(`Block: ${receipt.blockNumber}`);
    console.log(`Gas used: ${receipt.gasUsed.toString()}`);
    
    // Verify it works
    const oracle = new ethers.Contract(receipt.contractAddress, artifact.abi, provider);
    const owner = await oracle.owner();
    console.log(`Owner: ${owner}`);
    
    // Owner is deployer (Jim's wallet 0x339559...)
    
    console.log('\n--- Save this ---');
    console.log(`CRED_ORACLE_ADDRESS=${receipt.contractAddress}`);
}

main().catch(e => { console.error(e); process.exit(1); });
