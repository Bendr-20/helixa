export const SOUL_SOVEREIGN_V3_ADDRESS = '0x946677180fb3fdb5EbFF94aD91CFCeF0559711bD' as const;

export const SOUL_SOVEREIGN_V3_ABI = [
  {
    type: 'function',
    name: 'getFullSoulHistory',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      { name: 'hashes', type: 'bytes32[]' },
      { name: 'timestamps', type: 'uint256[]' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getSoulVersion',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isSovereign',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getSovereignWallet',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'lockSoulVersion',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: '_soulHash', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'soulHash',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
  },
] as const;
