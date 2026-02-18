import { type Address } from 'viem';

// Helper to safely trim environment variables (removes trailing newlines)
const env = (key: string, fallback: string): string => (process.env[key] || fallback).trim();

export const config = {
  port: Number(process.env.PORT || 3128),
  rpcUrl: env('BASE_RPC_URL', 'https://mainnet.base.org'),
  contracts: {
    token: env('ANONS_TOKEN', '0x1ad890FCE6cB865737A3411E7d04f1F5668b0686') as Address,
    tokenV2: env('ANONS_TOKEN_V2', '0x813d1d56457bd4697abedb835435691b187eedc4') as Address,
    auctionHouse: env('AUCTION_HOUSE', '0x51f5a9252A43F89D8eE9D5616263f46a0E02270F') as Address,
    governor: env('GOVERNOR', '0xc44e1FaF399F64a9Af523076b8dA917427b5bD0B') as Address,
    timelock: env('TIMELOCK', '0x167b2f7Ce609Bf0117A148e6460A4Ca943f6dF32') as Address,
    erc8004Registry: env('ERC8004_REGISTRY', '0x00256C0D814c455425A0699D5eEE2A7DB7A5519c') as Address,
  },
} as const;
