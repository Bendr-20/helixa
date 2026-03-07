/**
 * Rescue ownership transfer via back-to-back TX submission.
 * 
 * Usage: FUNDER_KEY=0x... node rescue-bundle.js
 * 
 * Jim: run this with your new wallet's private key.
 * It signs both TXs locally and sends them back-to-back in <10ms.
 * On Base (2s blocks), they should land in the same block.
 */
const { ethers } = require('ethers');

const RPC = 'https://mainnet.base.org';
const DEPLOYER_KEY = '0x6a28b39709a30a1efad15224c8525c43bb7ca25478cd86cf24528d93b010e050';
const HELIXA_V2 = '0x2e3B541C59D38b84E3Bc54e977200230A204Fe60';
const NEW_OWNER = '0x365279aA5a265D812657Ed43b4dF88F5643D41c7';
const DEPLOYER_ADDR = '0x97cf081780D71F2189889ce86941cF1837997873';

const FUNDER_KEY = process.env.FUNDER_KEY;
if (!FUNDER_KEY) {
  console.error('Usage: FUNDER_KEY=0x... node rescue-bundle.js');
  process.exit(1);
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const funder = new ethers.Wallet(FUNDER_KEY, provider);
  const deployer = new ethers.Wallet(DEPLOYER_KEY, provider);
  
  console.log('Funder:', funder.address);
  console.log('Deployer:', deployer.address);
  console.log('New owner:', NEW_OWNER);
  
  // Verify current owner
  const contract = new ethers.Contract(HELIXA_V2, ['function owner() view returns (address)'], provider);
  const currentOwner = await contract.owner();
  console.log('Current contract owner:', currentOwner);
  if (currentOwner.toLowerCase() !== DEPLOYER_ADDR.toLowerCase()) {
    console.error('ERROR: Deployer is NOT the owner anymore!');
    process.exit(1);
  }
  
  // Get nonces
  const funderNonce = await provider.getTransactionCount(funder.address);
  const deployerNonce = await provider.getTransactionCount(DEPLOYER_ADDR);
  console.log('Funder nonce:', funderNonce);
  console.log('Deployer nonce:', deployerNonce);
  
  // Get gas prices — use high priority to ensure fast inclusion
  const feeData = await provider.getFeeData();
  const maxFee = feeData.maxFeePerGas * 5n; // 5x for priority
  const maxPriority = feeData.maxPriorityFeePerGas * 5n;
  
  // TX1: Fund deployer with just enough gas (0.0001 ETH should cover transferOwnership)
  const fundAmount = ethers.parseEther('0.0002');
  const tx1 = {
    to: DEPLOYER_ADDR,
    value: fundAmount,
    nonce: funderNonce,
    gasLimit: 21000,
    maxFeePerGas: maxFee,
    maxPriorityFeePerGas: maxPriority,
    chainId: 8453,
    type: 2,
  };
  
  // TX2: transferOwnership
  const iface = new ethers.Interface(['function transferOwnership(address newOwner)']);
  const tx2 = {
    to: HELIXA_V2,
    data: iface.encodeFunctionData('transferOwnership', [NEW_OWNER]),
    value: 0,
    nonce: deployerNonce,
    gasLimit: 60000,
    maxFeePerGas: maxFee,
    maxPriorityFeePerGas: maxPriority,
    chainId: 8453,
    type: 2,
  };
  
  // Pre-sign both
  console.log('\nPre-signing transactions...');
  const signedTx1 = await funder.signTransaction(tx1);
  const signedTx2 = await deployer.signTransaction(tx2);
  console.log('Both TXs signed.');
  
  // Send BOTH back-to-back with zero delay
  console.log('\n🚀 FIRING BOTH TXS NOW...');
  const [r1, r2] = await Promise.all([
    provider.broadcastTransaction(signedTx1),
    provider.broadcastTransaction(signedTx2),
  ]);
  
  console.log('TX1 (fund) hash:', r1.hash);
  console.log('TX2 (transfer) hash:', r2.hash);
  
  console.log('\nWaiting for confirmations...');
  try {
    const receipt1 = await r1.wait(1);
    console.log('TX1 confirmed block:', receipt1.blockNumber, 'status:', receipt1.status);
  } catch (e) {
    console.error('TX1 failed:', e.message?.slice(0, 200));
  }
  
  try {
    const receipt2 = await r2.wait(1);
    console.log('TX2 confirmed block:', receipt2.blockNumber, 'status:', receipt2.status);
  } catch (e) {
    console.error('TX2 failed:', e.message?.slice(0, 200));
  }
  
  // Verify
  const newOwner = await contract.owner();
  console.log('\n=== RESULT ===');
  console.log('Contract owner is now:', newOwner);
  if (newOwner.toLowerCase() === NEW_OWNER.toLowerCase()) {
    console.log('✅ SUCCESS! Ownership transferred!');
  } else {
    console.log('❌ FAILED — owner did not change. Bot may have swept gas first.');
  }
}

main().catch(e => console.error('Fatal:', e));
