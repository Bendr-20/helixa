#!/usr/bin/env node
/**
 * Deploy HelixaMintGate to Base mainnet.
 * Uses solc for compilation and ethers.js for deployment.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

const V2_CONTRACT = '0x2e3B541C59D38b84E3Bc54e977200230A204Fe60';
const RPC_URL = 'https://mainnet.base.org';

async function main() {
    // Load deployer key
    let deployerKey = process.env.DEPLOYER_KEY;
    if (!deployerKey) {
        try {
            const { SecretsManagerClient, GetSecretValueCommand } = require(path.join(__dirname, '..', 'api', 'node_modules', '@aws-sdk', 'client-secrets-manager'));
            const client = new SecretsManagerClient({ region: 'us-east-2' });
            const resp = await client.send(new GetSecretValueCommand({ SecretId: 'helixa/deployer-key' }));
            deployerKey = JSON.parse(resp.SecretString).DEPLOYER_PRIVATE_KEY;
        } catch (e) {
            console.error('Failed to load key from AWS:', e.message);
            process.exit(1);
        }
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL, 8453, { staticNetwork: true });
    const wallet = new ethers.Wallet(deployerKey, provider);
    console.log(`Deployer: ${wallet.address}`);

    const balance = await provider.getBalance(wallet.address);
    console.log(`Balance: ${ethers.formatEther(balance)} ETH`);

    // Compile with solc
    console.log('Compiling HelixaMintGate.sol...');

    // We need OZ imports - let's use a flattened version instead
    const solcInput = JSON.stringify({
        language: 'Solidity',
        sources: {
            'HelixaMintGate.sol': {
                content: fs.readFileSync(path.join(__dirname, 'HelixaMintGate.sol'), 'utf8')
            }
        },
        settings: {
            viaIR: true,
            optimizer: { enabled: true, runs: 200 },
            outputSelection: {
                '*': { '*': ['abi', 'evm.bytecode.object'] }
            }
        }
    });

    // Check if we have OZ installed somewhere
    const ozPaths = [
        path.join(__dirname, '..', 'node_modules', '@openzeppelin'),
        path.join(__dirname, 'node_modules', '@openzeppelin'),
        '/home/ubuntu/node_modules/@openzeppelin',
    ];

    let ozPath = null;
    for (const p of ozPaths) {
        if (fs.existsSync(p)) { ozPath = p; break; }
    }

    if (!ozPath) {
        console.log('Installing @openzeppelin/contracts...');
        execSync('npm install @openzeppelin/contracts@^5.0.0', {
            cwd: __dirname,
            stdio: 'inherit'
        });
        ozPath = path.join(__dirname, 'node_modules', '@openzeppelin');
    }

    // Use solcjs with import remapping
    const solcRaw = execSync(
        `npx solc --standard-json --base-path ${__dirname} --include-path ${path.join(ozPath, '..')}`,
        { input: solcInput, maxBuffer: 10 * 1024 * 1024 }
    ).toString();

    // Strip any non-JSON prefix (e.g. SMT warnings)
    const jsonStart = solcRaw.indexOf('{');
    const output = JSON.parse(solcRaw.slice(jsonStart));

    if (output.errors) {
        const errors = output.errors.filter(e => e.severity === 'error');
        if (errors.length > 0) {
            console.error('Compilation errors:', errors.map(e => e.message).join('\n'));
            process.exit(1);
        }
    }

    const compiled = output.contracts['HelixaMintGate.sol']['HelixaMintGate'];
    const abi = compiled.abi;
    const bytecode = '0x' + compiled.evm.bytecode.object;

    console.log(`Compiled. Bytecode: ${bytecode.length / 2} bytes`);

    // Deploy
    console.log(`Deploying HelixaMintGate...`);
    console.log(`  helixa: ${V2_CONTRACT}`);
    console.log(`  signer: ${wallet.address}`);

    const factory = new ethers.ContractFactory(abi, bytecode, wallet);
    const contract = await factory.deploy(V2_CONTRACT, wallet.address);

    console.log(`TX: ${contract.deploymentTransaction().hash}`);
    await contract.waitForDeployment();

    const address = await contract.getAddress();
    console.log(`\nHelixaMintGate deployed: ${address}`);
    console.log(`\nSet MINTGATE_ADDRESS=${address} in your environment.`);

    // Save deployment info
    const deployInfo = {
        contract: 'HelixaMintGate',
        address,
        deployer: wallet.address,
        signer: wallet.address,
        helixaV2: V2_CONTRACT,
        chainId: 8453,
        network: 'base-mainnet',
        deployTx: contract.deploymentTransaction().hash,
        deployedAt: new Date().toISOString(),
        abi,
    };

    fs.writeFileSync(
        path.join(__dirname, 'deployments', 'HelixaMintGate.json'),
        JSON.stringify(deployInfo, null, 2)
    );
    console.log('Deployment info saved to contracts/deployments/HelixaMintGate.json');
}

main().catch(err => {
    console.error('Deploy failed:', err);
    process.exit(1);
});
