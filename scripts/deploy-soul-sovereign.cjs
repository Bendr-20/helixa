const solc = require('../api/node_modules/solc');
const fs = require('fs');
const path = require('path');
const { ethers } = require('../api/node_modules/ethers');

const HELIXA_V2 = '0x2e3B541C59D38b84E3Bc54e977200230A204Fe60';
const RPC_URL = process.env.RPC_URL || 'https://mainnet.base.org';
const CHAIN_ID = 8453;

async function main() {
    // Load deployer key same way as the API
    let DEPLOYER_KEY = process.env.DEPLOYER_KEY;
    if (!DEPLOYER_KEY) {
        const { SecretsManagerClient, GetSecretValueCommand } = require('../api/node_modules/@aws-sdk/client-secrets-manager');
        const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-2' });
        const resp = await client.send(new GetSecretValueCommand({ SecretId: 'helixa/deployer-key' }));
        const secret = JSON.parse(resp.SecretString);
        DEPLOYER_KEY = secret.DEPLOYER_PRIVATE_KEY;
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID, { staticNetwork: true });
    const wallet = new ethers.Wallet(DEPLOYER_KEY, provider);
    console.log('Deployer:', wallet.address);
    const bal = await provider.getBalance(wallet.address);
    console.log('Balance:', ethers.formatEther(bal), 'ETH');

    // Compile
    const source = fs.readFileSync(path.join(__dirname, '../contracts/SoulSovereign.sol'), 'utf8');
    const input = {
        language: 'Solidity',
        sources: { 'SoulSovereign.sol': { content: source } },
        settings: { optimizer: { enabled: true, runs: 200 }, outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } }
    };
    const output = JSON.parse(solc.compile(JSON.stringify(input)));
    if (output.errors) {
        const errs = output.errors.filter(e => e.severity === 'error');
        if (errs.length) { console.error(errs); process.exit(1); }
    }
    const compiled = output.contracts['SoulSovereign.sol']['SoulSovereign'];
    const abi = compiled.abi;
    const bytecode = '0x' + compiled.evm.bytecode.object;
    console.log('Compiled. Bytecode size:', bytecode.length / 2, 'bytes');

    // Deploy
    const factory = new ethers.ContractFactory(abi, bytecode, wallet);
    console.log('Deploying...');
    const contract = await factory.deploy(HELIXA_V2);
    console.log('Tx:', contract.deploymentTransaction().hash);
    await contract.waitForDeployment();
    const addr = await contract.getAddress();
    console.log('✅ SoulSovereign deployed at:', addr);

    // Save ABI
    fs.writeFileSync(path.join(__dirname, '../api/SoulSovereign.json'), JSON.stringify({ address: addr, abi }, null, 2));
    console.log('ABI saved to api/SoulSovereign.json');
}

main().catch(e => { console.error(e); process.exit(1); });
