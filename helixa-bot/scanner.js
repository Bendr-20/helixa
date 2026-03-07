const { ethers } = require('ethers');

const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');

// ERC-20 ABI (minimal)
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function name() view returns (string)',
];

// Well-known Base tokens (top by TVL/usage)
const KNOWN_TOKENS = [
  { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC' },
  { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH' },
  { address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', symbol: 'DAI' },
  { address: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22', symbol: 'cbETH' },
  { address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA', symbol: 'USDbC' },
  { address: '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b', symbol: 'VIRTUAL' },
  { address: '0x532f27101965dd16442E59d40670FaF5eBB142E4', symbol: 'BRETT' },
  { address: '0xB1a03EdA10342529bBF8EB700a06C60441fEf25d', symbol: 'MIGGLES' },
];

async function scanWallet(address) {
  const result = {
    address,
    ethBalance: '0',
    tokens: [],
    txCount: 0,
    ensName: null,
  };

  try {
    // ETH balance
    const bal = await provider.getBalance(address);
    result.ethBalance = ethers.formatEther(bal);

    // Transaction count
    result.txCount = await provider.getTransactionCount(address);

    // Check known tokens
    const tokenChecks = KNOWN_TOKENS.map(async (tk) => {
      try {
        const contract = new ethers.Contract(tk.address, ERC20_ABI, provider);
        const [balance, decimals] = await Promise.all([
          contract.balanceOf(address),
          contract.decimals(),
        ]);
        if (balance > 0n) {
          return {
            symbol: tk.symbol,
            balance: ethers.formatUnits(balance, decimals),
          };
        }
      } catch (e) { /* skip */ }
      return null;
    });

    const tokenResults = await Promise.all(tokenChecks);
    result.tokens = tokenResults.filter(Boolean).slice(0, 5);

    // ENS (try mainnet provider for reverse lookup)
    try {
      const mainnetProvider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
      result.ensName = await mainnetProvider.lookupAddress(address);
    } catch (e) { /* no ENS */ }

  } catch (err) {
    console.error('Scan error:', err.message);
    throw err;
  }

  return result;
}

function formatScanResult(scan, helixaAgent) {
  const lines = [];
  lines.push(`🔍 *Wallet Scan*`);
  lines.push(`\`${scan.address}\``);
  if (scan.ensName) lines.push(`📛 ENS: *${scan.ensName}*`);
  lines.push('');
  lines.push(`💰 *ETH Balance:* ${parseFloat(scan.ethBalance).toFixed(4)} ETH`);
  lines.push(`📊 *Transactions:* ${scan.txCount}`);

  if (scan.tokens.length) {
    lines.push('');
    lines.push('🪙 *Token Holdings:*');
    for (const t of scan.tokens) {
      const bal = parseFloat(t.balance);
      const display = bal > 1000 ? Math.floor(bal).toLocaleString() : bal.toFixed(4);
      lines.push(`  • ${t.symbol}: ${display}`);
    }
  }

  // Trust summary
  lines.push('');
  lines.push('📋 *Trust Summary:*');
  const activity = scan.txCount > 500 ? '🟢 High' : scan.txCount > 50 ? '🟡 Moderate' : '🔴 Low';
  const diversity = scan.tokens.length >= 3 ? '🟢 Diverse' : scan.tokens.length >= 1 ? '🟡 Some' : '🔴 None';
  lines.push(`  Activity: ${activity} (${scan.txCount} txs)`);
  lines.push(`  Holdings: ${diversity} (${scan.tokens.length} tokens)`);

  if (helixaAgent) {
    lines.push('');
    lines.push(`🤖 *Helixa Agent:* ${helixaAgent.name} (#${helixaAgent.tokenId}) — Cred ${helixaAgent.credScore}`);
  } else {
    lines.push('');
    lines.push('🤖 No Helixa agent linked to this wallet');
  }

  return lines.join('\n');
}

module.exports = { scanWallet, formatScanResult };
