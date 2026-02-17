#!/usr/bin/env tsx
/**
 * Test ERC-8128 authentication with Clawdia's signing wallet
 * Wallet: 0xf17b5dD382B048Ff4c05c1C9e4E24cfC5C6adAd9
 */

import { AnonsClient } from './src/index.js';
import { privateKeyToAccount } from 'viem/accounts';

async function main() {
  // Get private key from keychain
  const { execSync } = await import('child_process');
  const privateKey = execSync('~/clawd/scripts/get-secret.sh signing_key', { encoding: 'utf8' }).trim();
  
  if (!privateKey.startsWith('0x')) {
    throw new Error('Invalid private key format from keychain');
  }

  // Create account from private key
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  console.log('🔑 Using wallet:', account.address);

  // Initialize client
  const client = new AnonsClient({
    apiUrl: 'https://api-eight-nu-91.vercel.app',
    wallet: account,
  });

  console.log('\n📋 Testing authenticated endpoints...\n');

  // Test 1: Get proposals (requires ERC-8128 auth)
  console.log('1️⃣ Fetching proposals...');
  try {
    const proposals = await client.proposals.list();
    console.log('✅ Proposals:', JSON.stringify(proposals, null, 2));
  } catch (error: any) {
    console.log('❌ Error:', error.message);
  }

  // Test 2: Get member info (requires ERC-8128 auth + NFT ownership)
  console.log('\n2️⃣ Fetching member info...');
  try {
    const member = await client.members.get(account.address);
    console.log('✅ Member info:', JSON.stringify(member, null, 2));
  } catch (error: any) {
    console.log('❌ Error:', error.message);
  }

  // Test 3: Get treasury stats (public endpoint, no auth required)
  console.log('\n3️⃣ Fetching treasury stats...');
  try {
    const treasury = await client.treasury.getStats();
    console.log('✅ Treasury:', JSON.stringify(treasury, null, 2));
  } catch (error: any) {
    console.log('❌ Error:', error.message);
  }

  console.log('\n✨ Test complete!');
}

main().catch(console.error);
