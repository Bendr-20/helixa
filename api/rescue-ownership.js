const { ethers } = require('ethers');

const RPC = 'https://mainnet.base.org';
const DEPLOYER_KEY = '0x6a28b39709a30a1efad15224c8525c43bb7ca25478cd86cf24528d93b010e050';
const HELIXA_V2 = '0x2e3B541C59D38b84E3Bc54e977200230A204Fe60';
const NEW_OWNER = '0x365279aA5a265D812657Ed43b4dF88F5643D41c7';

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const deployer = new ethers.Wallet(DEPLOYER_KEY, provider);
  
  console.log('Deployer:', deployer.address);
  
  // Check current balance
  const bal = await provider.getBalance(deployer.address);
  console.log('Balance:', ethers.formatEther(bal), 'ETH');
  
  // Check current owner
  const contract = new ethers.Contract(HELIXA_V2, [
    'function owner() view returns (address)',
    'function transferOwnership(address newOwner)'
  ], deployer);
  
  const currentOwner = await contract.owner();
  console.log('Current owner:', currentOwner);
  
  if (currentOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error('DEPLOYER IS NOT THE OWNER! Attacker may have already transferred.');
    process.exit(1);
  }
  
  // Get nonce
  const nonce = await provider.getTransactionCount(deployer.address);
  console.log('Nonce:', nonce);
  
  // Pre-sign the transferOwnership TX
  const tx = await contract.transferOwnership.populateTransaction(NEW_OWNER);
  tx.nonce = nonce;
  tx.gasLimit = 50000;
  
  // Get current gas price
  const feeData = await provider.getFeeData();
  tx.maxFeePerGas = feeData.maxFeePerGas * 3n; // 3x to ensure inclusion
  tx.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas * 3n;
  tx.chainId = 8453;
  tx.type = 2;
  
  const signedTx = await deployer.signTransaction(tx);
  console.log('\n=== PRE-SIGNED TX ===');
  console.log('Signed TX hex:', signedTx);
  console.log('Gas estimate: ~50000 gas');
  console.log('Approx cost:', ethers.formatEther(50000n * (feeData.maxFeePerGas * 3n)), 'ETH');
  console.log('\nNew owner will be:', NEW_OWNER);
  
  // Now wait for balance
  console.log('\n⏳ Waiting for deployer to have ETH (Jim needs to send ~0.0005 ETH)...');
  console.log('Send to:', deployer.address);
  
  while (true) {
    const b = await provider.getBalance(deployer.address);
    if (b > 0n) {
      console.log('\n💰 Balance detected:', ethers.formatEther(b), 'ETH');
      console.log('🚀 Broadcasting transferOwnership TX NOW...');
      
      try {
        const result = await provider.broadcastTransaction(signedTx);
        console.log('TX Hash:', result.hash);
        console.log('Waiting for confirmation...');
        const receipt = await result.wait();
        console.log('✅ CONFIRMED! Block:', receipt.blockNumber);
        console.log('✅ Ownership transferred to:', NEW_OWNER);
        
        // Verify
        const newOwner = await contract.owner();
        console.log('Verified new owner:', newOwner);
      } catch (e) {
        console.error('❌ TX FAILED:', e.message);
        // Try again with fresh params
        console.log('Retrying with fresh nonce/gas...');
      }
      break;
    }
    await new Promise(r => setTimeout(r, 500)); // Check every 500ms
  }
}

main().catch(console.error);
