const { ethers } = require('ethers');

const CRED_ADDRESS = '0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3';
const STAKING_ADDRESS = '0xd40ECD47201D8ea25181dc05a638e34469399613';
const BASE_RPC = 'https://mainnet.base.org';
const DEXSCREENER_URL = `https://api.dexscreener.com/latest/dex/tokens/${CRED_ADDRESS}`;
const UNISWAP_BUY_LINK = `https://app.uniswap.org/swap?outputCurrency=${CRED_ADDRESS}&chain=base`;

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

const STAKING_ABI = [
  'function stakedBalance(address) view returns (uint256)',
];

const provider = new ethers.JsonRpcProvider(BASE_RPC);
const credContract = new ethers.Contract(CRED_ADDRESS, ERC20_ABI, provider);
const stakingContract = new ethers.Contract(STAKING_ADDRESS, STAKING_ABI, provider);

// Caches
const balanceCache = new Map(); // address -> { balance, staked, ts }
const BALANCE_TTL = 5 * 60 * 1000;
let priceCache = { data: null, ts: 0 };
const PRICE_TTL = 2 * 60 * 1000;

async function getCredBalance(address) {
  const cached = balanceCache.get(address.toLowerCase());
  if (cached && Date.now() - cached.ts < BALANCE_TTL) return cached;

  try {
    const [rawBalance, decimals] = await Promise.all([
      credContract.balanceOf(address),
      credContract.decimals(),
    ]);
    const balance = parseFloat(ethers.formatUnits(rawBalance, decimals));

    let staked = 0;
    try {
      const rawStaked = await stakingContract.stakedBalance(address);
      staked = parseFloat(ethers.formatUnits(rawStaked, decimals));
    } catch (e) { /* staking contract might not have this method */ }

    const result = { balance, staked, ts: Date.now() };
    balanceCache.set(address.toLowerCase(), result);
    return result;
  } catch (err) {
    console.error('getCredBalance error:', err.message);
    return { balance: 0, staked: 0, ts: Date.now() };
  }
}

async function getCredPrice() {
  if (priceCache.data && Date.now() - priceCache.ts < PRICE_TTL) return priceCache.data;

  try {
    const res = await fetch(DEXSCREENER_URL);
    const json = await res.json();
    const pair = json.pairs?.[0];
    if (!pair) return null;

    const data = {
      price: parseFloat(pair.priceUsd || 0),
      change24h: parseFloat(pair.priceChange?.h24 || 0),
      marketCap: pair.marketCap || pair.fdv || 0,
      liquidity: pair.liquidity?.usd || 0,
      volume24h: pair.volume?.h24 || 0,
    };
    priceCache = { data, ts: Date.now() };
    return data;
  } catch (err) {
    console.error('getCredPrice error:', err.message);
    return priceCache.data || null;
  }
}

async function checkCredHolding(walletAddress, minAmount) {
  const { balance } = await getCredBalance(walletAddress);
  return balance >= minAmount;
}

function formatUsd(n) {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function formatCredBalance(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${Math.floor(n).toLocaleString()}`;
  return n.toFixed(2);
}

module.exports = {
  CRED_ADDRESS,
  STAKING_ADDRESS,
  UNISWAP_BUY_LINK,
  getCredBalance,
  getCredPrice,
  checkCredHolding,
  formatUsd,
  formatCredBalance,
};
