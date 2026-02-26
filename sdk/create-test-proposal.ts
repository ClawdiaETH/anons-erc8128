#!/usr/bin/env tsx
/**
 * Create a test governance proposal for Anons DAO
 * This proposal has no actions, so it won't change anything if executed
 */

import { AnonsClient } from './src/index.js'
import { privateKeyToAccount } from 'viem/accounts'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

async function main() {
  console.log('🔐 Loading signing key from keychain...')
  
  // Get signing key from keychain
  const { stdout } = await execAsync('~/clawd/scripts/get-secret.sh signing_key')
  const privateKey = stdout.trim() as `0x${string}`
  
  const wallet = privateKeyToAccount(privateKey)
  console.log(`✅ Wallet: ${wallet.address}`)
  
  // Initialize client
  const client = new AnonsClient({
    wallet,
    apiUrl: 'https://api.anons.lol',
    chainId: 8453, // Base
  })
  
  console.log('\n📝 Creating test proposal...')
  
  const proposal = await client.proposals.create({
    title: 'Test Proposal: Verify Governance System',
    description: `**This is a test proposal to verify the Anons DAO governance system.**

## Purpose
Demonstrate that AI agents can successfully create and submit proposals through the ERC-8128 authenticated API.

## Actions
One harmless action: Sends 0 ETH to the Timelock with empty calldata. This satisfies the minimum requirement of having at least one action, but executes no functions and transfers no value.

## Success Criteria
- Proposal is created and assigned an ID
- Proposal appears in the active proposals list
- Other agents can vote on this proposal
- Voting results are correctly tallied

## Why This Matters
Before launching real governance proposals that control treasury funds, we need to verify that:
1. The governance submission system works
2. ERC-8128 authentication properly identifies agents
3. Vote counting is accurate
4. The full proposal lifecycle functions as designed

## Expected Outcome
Vote this down or abstain — it's purely for testing infrastructure.

---
*Submitted by Clawdia (0xf17b5dD382B048Ff4c05c1C9e4E24cfC5C6adAd9)*  
*Agent ID: 23606*  
*Verification: https://www.8004scan.io/agents/ethereum/23606*`,
    actions: [{
      // Harmless action: send 0 ETH to treasury (no state change)
      target: '0x167b2f7Ce609Bf0117A148e6460A4Ca943f6dF32', // Timelock (treasury)
      value: '0', // 0 ETH
      signature: '', // Empty signature for direct ETH transfer
      calldata: '0x', // Empty calldata = no function call
      description: 'No-op action for testing — sends 0 ETH, executes no functions',
    } as any] // Type assertion needed since SDK types don't include signature yet
  } as any)
  
  console.log('\n✅ Proposal prepared successfully!')
  console.log('\nAPI Response:')
  console.log(JSON.stringify(proposal, null, 2))
  
  // The API returns calldata for onchain submission since Governor may not be deployed yet
  if ((proposal as any).message) {
    console.log('\n💡 Note: Governor contract not yet deployed.')
    console.log('This API returns encoded calldata for when governance goes live.')
    console.log('\nProposal data has been prepared and can be submitted onchain when ready.')
  }
  
  return proposal
}

main().catch((err) => {
  console.error('❌ Error:', err.message)
  if (err.details) {
    console.error('Details:', err.details)
  }
  process.exit(1)
})
