import { type Address } from 'viem';

export const config = {
  port: Number(process.env.PORT || 3128),
  rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
  contracts: {
    token: (process.env.ANONS_TOKEN || '0x1ad890FCE6cB865737A3411E7d04f1F5668b0686') as Address,
    tokenV2: (process.env.ANONS_TOKEN_V2 || '0x813d1d56457bd4697abedb835435691b187eedc4') as Address,
    auctionHouse: (process.env.AUCTION_HOUSE || '0x51f5a9252A43F89D8eE9D5616263f46a0E02270F') as Address,
    governor: (process.env.GOVERNOR || '0x0000000000000000000000000000000000000000') as Address,
    timelock: (process.env.TIMELOCK || '0x7ccC1928c82aD5Fb86F072d104a46a8377886AA6') as Address,
    erc8004Registry: (process.env.ERC8004_REGISTRY || '0x8004a169fb4a3325136eb29fa0ceb6d2e539a432') as Address,
  },
} as const;
