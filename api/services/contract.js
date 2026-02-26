/**
 * Contract Setup & Blockchain Connections
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// ─── Environment ────────────────────────────────────────────────
const envPath = path.join(__dirname, '..', '..', '.env');
if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
        const [key, ...val] = line.split('=');
        if (key && val.length) process.env[key.trim()] = val.join('=').trim();
    });
}

const RPC_URL = process.env.RPC_URL || 'https://mainnet.base.org';
const READ_RPC_URL = process.env.READ_RPC_URL || 'https://mainnet.base.org';
let DEPLOYER_KEY = process.env.DEPLOYER_KEY;
let DEPLOYER_ADDRESS = process.env.DEPLOYER_ADDRESS || '0x97cf081780D71F2189889ce86941cF1837997873';
const V2_CONTRACT_ADDRESS = process.env.V2_CONTRACT || '0x2e3B541C59D38b84E3Bc54e977200230A204Fe60';
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const ERC8004_REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';
const TREASURY_ADDRESS = '0x01b686e547F4feA03BfC9711B7B5306375735d2a';

const COINBASE_INDEXER = '0x2c7eE1E5f416dfF40054c27A62f7B357C4E8619C';
const COINBASE_VERIFIED_ACCOUNT_SCHEMA = '0xf8b05c79f090979bf4a80270aba232dff11a10d9ca55c4f88de95317970f0de9';
const EAS_CONTRACT = '0x4200000000000000000000000000000000000021';

const COINBASE_INDEXER_ABI = [
    'function getAttestationUid(address recipient, bytes32 schemaUid) external view returns (bytes32)',
];
const EAS_ABI = [
    'function getAttestation(bytes32 uid) external view returns (tuple(bytes32 uid, bytes32 schema, uint64 time, uint64 expirationTime, uint64 revocationTime, bytes32 refUID, address attester, address recipient, bool revocable, bytes data))',
];
const ERC8004_REGISTRY_ABI = [
    'function register(string agentURI) external returns (uint256 agentId)',
    'function register(string agentURI, tuple(string metadataKey, bytes metadataValue)[] metadata) external returns (uint256 agentId)',
    'function setAgentURI(uint256 agentId, string newURI) external',
    'function getMetadata(uint256 agentId, string metadataKey) external view returns (bytes)',
    'function setMetadata(uint256 agentId, string metadataKey, bytes metadataValue) external',
];
const USDC_ABI = [
    'function balanceOf(address) view returns (uint256)',
    'function transfer(address,uint256) returns (bool)',
    'event Transfer(address indexed from, address indexed to, uint256 value)',
];

if (!DEPLOYER_KEY) {
    console.warn('⚠️  DEPLOYER_KEY not set — running in READ-ONLY mode (no contract writes)');
}

// ─── Load V2 ABI ────────────────────────────────────────────────
const V2_ABI_PATH = path.join(__dirname, '..', '..', 'out', 'HelixaV2.sol', 'HelixaV2.json');
let V2_ABI;
try {
    const artifact = JSON.parse(fs.readFileSync(V2_ABI_PATH, 'utf8'));
    V2_ABI = artifact.abi;
    console.log(`✅ Loaded V2 ABI (${V2_ABI.filter(x => x.type === 'function').length} functions)`);
} catch (e) {
    console.error(`Failed to load V2 ABI from ${V2_ABI_PATH}: ${e.message}`);
    process.exit(1);
}

// ─── Providers & Wallet ─────────────────────────────────────────
const CHAIN_ID = RPC_URL.includes('sepolia') ? 84532 : 8453;
const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID, { staticNetwork: true });
const readProvider = new ethers.JsonRpcProvider(READ_RPC_URL, CHAIN_ID, { staticNetwork: true, batchMaxCount: 1 });
const wallet = DEPLOYER_KEY ? new ethers.Wallet(DEPLOYER_KEY, provider) : null;
const rawContract = wallet ? new ethers.Contract(V2_CONTRACT_ADDRESS, V2_ABI, wallet) : null;
const readContract = new ethers.Contract(V2_CONTRACT_ADDRESS, V2_ABI, readProvider);
const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);

// ─── ERC-8021 Builder Code Attribution ──────────────────────────
const BUILDER_CODE = process.env.BUILDER_CODE || 'bc_doy52p24';
let ERC8021_SUFFIX = null;
try {
    const { Attribution } = require('ox/erc8021');
    ERC8021_SUFFIX = Attribution.toDataSuffix({ codes: [BUILDER_CODE] });
    console.log(`[ERC-8021] Builder code "${BUILDER_CODE}" → suffix: ${ERC8021_SUFFIX}`);
} catch (e) {
    console.warn('[ERC-8021] ox not available, attribution disabled');
}

const contract = rawContract ? new Proxy(rawContract, {
    get(target, prop) {
        const val = target[prop];
        if (typeof val === 'function' && !['connect', 'attach', 'interface', 'runner', 'target', 'filters', 'queryFilter', 'on', 'once', 'removeListener', 'getAddress', 'getDeployedCode', 'waitForDeployment'].includes(prop)) {
            return async function (...args) {
                const fragment = target.interface.getFunction(prop);
                if (fragment && !fragment.constant && ERC8021_SUFFIX) {
                    const tx = await target[prop].populateTransaction(...args);
                    tx.data = tx.data + ERC8021_SUFFIX.slice(2);
                    return wallet.sendTransaction(tx);
                }
                return val.apply(target, args);
            };
        }
        return val;
    }
}) : null;

const isContractDeployed = () => V2_CONTRACT_ADDRESS !== '0x0000000000000000000000000000000000000000';

// ─── AWS Secrets Manager Init ───────────────────────────────────
// Call initDeployerKey() before server.listen() to load key from AWS
async function initDeployerKey() {
    if (DEPLOYER_KEY) {
        console.log(`✅ Deployer key loaded from env: ${DEPLOYER_ADDRESS}`);
        return;
    }
    try {
        const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
        const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-2' });
        const resp = await client.send(new GetSecretValueCommand({ SecretId: 'helixa/deployer-key' }));
        const secret = JSON.parse(resp.SecretString);
        DEPLOYER_KEY = secret.DEPLOYER_PRIVATE_KEY;
        
        // Rebuild wallet + contracts with the key
        const w = new ethers.Wallet(DEPLOYER_KEY, provider);
        DEPLOYER_ADDRESS = w.address;
        module.exports.wallet = w;
        module.exports.DEPLOYER_KEY = DEPLOYER_KEY;
        module.exports.DEPLOYER_ADDRESS = DEPLOYER_ADDRESS;
        
        const raw = new ethers.Contract(V2_CONTRACT_ADDRESS, V2_ABI, w);
        module.exports.rawContract = raw;
        
        // Rebuild proxied contract with builder code attribution
        module.exports.contract = ERC8021_SUFFIX ? new Proxy(raw, {
            get(target, prop) {
                const val = target[prop];
                if (typeof val === 'function' && !['connect', 'attach', 'interface', 'runner', 'target', 'filters', 'queryFilter', 'on', 'once', 'removeListener', 'getAddress', 'getDeployedCode', 'waitForDeployment'].includes(prop)) {
                    return async function (...args) {
                        const fragment = target.interface.getFunction(prop);
                        if (fragment && !fragment.constant && ERC8021_SUFFIX) {
                            const tx = await target[prop].populateTransaction(...args);
                            tx.data = tx.data + ERC8021_SUFFIX.slice(2);
                            return w.sendTransaction(tx);
                        }
                        return val.apply(target, args);
                    };
                }
                return val;
            }
        }) : raw;

        console.log(`✅ Deployer key loaded from AWS Secrets Manager: ${DEPLOYER_ADDRESS}`);
    } catch (e) {
        console.warn(`⚠️  AWS Secrets Manager failed (${e.message}) — running in READ-ONLY mode`);
    }
}

module.exports = {
    ethers, provider, readProvider, wallet,
    contract, rawContract, readContract, usdcContract,
    V2_ABI, V2_CONTRACT_ADDRESS, DEPLOYER_KEY, DEPLOYER_ADDRESS,
    USDC_ADDRESS, ERC8004_REGISTRY, ERC8004_REGISTRY_ABI,
    COINBASE_INDEXER, COINBASE_INDEXER_ABI, COINBASE_VERIFIED_ACCOUNT_SCHEMA,
    EAS_CONTRACT, EAS_ABI, TREASURY_ADDRESS, CHAIN_ID, RPC_URL,
    isContractDeployed, initDeployerKey,
};
