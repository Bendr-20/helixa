#!/usr/bin/env node
/**
 * Register a Basename (*.base.eth) on Base mainnet
 * Usage: PRIVATE_KEY=0x... node register-basename.js <name>
 * Example: PRIVATE_KEY=0x... node register-basename.js helixa
 */

const { ethers } = require('ethers');

// Base Mainnet contracts
const REGISTRAR_CONTROLLER = '0x4cCb0BB02FCABA27e82a56646E81d8c5bC4119a5';
const L2_RESOLVER = '0xC6d566A56A1aFf6508b41f6c90ff131615583BCD';
const RPC_URL = process.env.BASE_RPC_URL || 'https://base.meowrpc.com';

// Duration: 1 year in seconds
const ONE_YEAR = 31557600;

// Pricing (from base.org/names)
// 3 chars: 0.1 ETH, 4 chars: 0.01 ETH, 5-9 chars: 0.001 ETH, 10+: 0.0001 ETH
function getPrice(name) {
  if (name.length === 3) return ethers.parseEther('0.1');
  if (name.length === 4) return ethers.parseEther('0.01');
  if (name.length <= 9) return ethers.parseEther('0.001');
  return ethers.parseEther('0.0001');
}

// Registrar ABI
const REGISTRAR_ABI = [
  'function register((string name, address owner, uint256 duration, address resolver, bytes[] data, bool reverseRecord) request) payable',
  'function available(string name) view returns (bool)',
  'function rentPrice(string name, uint256 duration) view returns (uint256)'
];

// L2 Resolver ABI for encoding data
const L2_RESOLVER_IFACE = new ethers.Interface([
  'function setAddr(bytes32 node, address a)',
  'function setName(bytes32 node, string name)'
]);

async function main() {
  const name = process.argv[2];
  if (!name) {
    console.error('Usage: PRIVATE_KEY=0x... node register-basename.js <name>');
    console.error('Example: PRIVATE_KEY=0x... node register-basename.js helixa');
    process.exit(1);
  }

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('PRIVATE_KEY environment variable required');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(privateKey, provider);
  const registrar = new ethers.Contract(REGISTRAR_CONTROLLER, REGISTRAR_ABI, wallet);

  const fullName = `${name}.base.eth`;
  console.log(`\n🏷️  Registering Basename: ${fullName}\n`);
  console.log('Owner:', wallet.address);

  // Check availability
  try {
    const available = await registrar.available(name);
    if (!available) {
      console.error(`❌ "${fullName}" is already taken!`);
      process.exit(1);
    }
    console.log('✅ Name is available!\n');
  } catch (e) {
    console.log('⚠️  Could not check availability, proceeding anyway...\n');
  }

  // Get price
  let price;
  try {
    price = await registrar.rentPrice(name, ONE_YEAR);
    console.log('Price (from contract):', ethers.formatEther(price), 'ETH/year');
  } catch (e) {
    price = getPrice(name);
    console.log('Price (estimated):', ethers.formatEther(price), 'ETH/year');
  }

  // Add 10% buffer for safety
  const value = price + (price / 10n);
  console.log('Sending (with buffer):', ethers.formatEther(value), 'ETH');

  // Check balance
  const balance = await provider.getBalance(wallet.address);
  console.log('Wallet balance:', ethers.formatEther(balance), 'ETH');

  if (balance < value + ethers.parseEther('0.0005')) {
    console.error('❌ Insufficient balance');
    process.exit(1);
  }

  // Build resolver data
  // namehash for the full name
  const node = ethers.namehash(fullName);
  const addressData = L2_RESOLVER_IFACE.encodeFunctionData('setAddr', [node, wallet.address]);
  const nameData = L2_RESOLVER_IFACE.encodeFunctionData('setName', [node, fullName]);

  // Build register request tuple
  const request = {
    name: name,
    owner: wallet.address,
    duration: ONE_YEAR,
    resolver: L2_RESOLVER,
    data: [addressData, nameData],
    reverseRecord: true
  };

  console.log('\n📤 Submitting registration...');

  try {
    const tx = await registrar.register(request, {
      value: value,
      gasLimit: 500000
    });

    console.log('TX:', tx.hash);
    console.log('Waiting for confirmation...');

    const receipt = await tx.wait();
    console.log('✅ Registered!');
    console.log('Block:', receipt.blockNumber);

    const gasCost = receipt.gasUsed * receipt.gasPrice;
    console.log('Gas cost:', ethers.formatEther(gasCost), 'ETH');
    console.log(`\n🎉 ${fullName} is now yours!`);
    console.log(`View: https://www.base.org/name/${name}`);

  } catch (error) {
    console.error('❌ Registration failed:', error.message);
    if (error.data) console.error('Data:', error.data);
    process.exit(1);
  }
}

main().catch(console.error);
