#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const { ethers } = require(path.join(__dirname, '..', 'api', 'node_modules', 'ethers'));

const artifactPath = path.join(__dirname, '..', 'out', 'CredStakingV2.sol', 'CredStakingV2.json');
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

const CRED_TOKEN = '0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3';
const TREASURY = '0x01b686e547F4feA03BfC9711B7B5306375735d2a';
const CRED_ORACLE = '0xD77354Aebea97C65e7d4a605f91737616FFA752f';

async function main() {
    let DEPLOYER_KEY = process.env.DEPLOYER_KEY;
    if (!DEPLOYER_KEY) {
        const { SecretsManagerClient, GetSecretValueCommand } = require(path.join(__dirname, '..', 'api', 'node_modules', '@aws-sdk', 'client-secrets-manager'));
        const client = new SecretsManagerClient({ region: 'us-east-2' });
        const resp = await client.send(new GetSecretValueCommand({ SecretId: 'helixa/deployer-key' }));
        DEPLOYER_KEY = JSON.parse(resp.SecretString).DEPLOYER_PRIVATE_KEY;
    }

    const provider = new ethers.JsonRpcProvider('https://mainnet.base.org', 8453, { staticNetwork: true });
    const wallet = new ethers.Wallet(DEPLOYER_KEY, provider);
    console.log(`Deployer: ${wallet.address}`);
    
    const balance = await provider.getBalance(wallet.address);
    console.log(`Balance: ${ethers.formatEther(balance)} ETH`);

    // Deploy with constructor args: credToken, treasury, credOracle
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode.object, wallet);
    console.log('Deploying CredStakingV2...');
    
    const contract = await factory.deploy(CRED_TOKEN, TREASURY, CRED_ORACLE);
    console.log(`TX: ${contract.deploymentTransaction().hash}`);
    await contract.waitForDeployment();
    
    const addr = await contract.getAddress();
    console.log(`\n✅ CredStakingV2 deployed to: ${addr}`);
    
    // Verify
    const owner = await contract.owner();
    const oracle = await contract.credOracle();
    console.log(`Owner: ${owner}`);
    console.log(`Oracle: ${oracle}`);
    console.log(`Token: ${await contract.credToken()}`);
    console.log(`Treasury: ${await contract.treasury()}`);
    
    console.log(`\nCRED_STAKING_V2=${addr}`);
}

main().catch(e => { console.error(e); process.exit(1); });
