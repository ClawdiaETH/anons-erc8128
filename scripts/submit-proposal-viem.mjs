#!/usr/bin/env node
import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { exec } from 'child_process';
import { promisify } from 'util';
import { homedir } from 'os';

const execAsync = promisify(exec);

async function main() {
  console.log('🔐 Loading signing key...');
  const { stdout } = await execAsync(`${homedir()}/clawd/scripts/get-secret.sh signing_key`);
  const privateKey = stdout.trim();
  
  const account = privateKeyToAccount(privateKey);
  console.log(`✅ Account: ${account.address}`);
  
  const publicClient = createPublicClient({
    chain: base,
    transport: http('https://mainnet.base.org'),
  });
  
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http('https://mainnet.base.org'),
  });
  
  const governorAddress = '0xc44e1FaF399F64a9Af523076b8dA917427b5bD0B';
  const timelockAddress = '0x167b2f7Ce609Bf0117A148e6460A4Ca943f6dF32';
  
  const governorAbi = parseAbi([
    'function propose(address[] targets, uint256[] values, bytes[] calldatas, string description) returns (uint256)',
    'function proposalThreshold() view returns (uint256)',
    'function getVotes(address account, uint256 timepoint) view returns (uint256)',
    'function clock() view returns (uint48)',
  ]);
  
  // Check prerequisites
  console.log('\n📊 Checking prerequisites...');
  const threshold = await publicClient.readContract({
    address: governorAddress,
    abi: governorAbi,
    functionName: 'proposalThreshold',
  });
  console.log(`Proposal threshold: ${threshold}`);
  
  const currentBlock = await publicClient.readContract({
    address: governorAddress,
    abi: governorAbi,
    functionName: 'clock',
  });
  console.log(`Current block: ${currentBlock}`);
  
  const checkBlock = BigInt(currentBlock) - 1n;
  const votes = await publicClient.readContract({
    address: governorAddress,
    abi: governorAbi,
    functionName: 'getVotes',
    args: [account.address, checkBlock],
  });
  console.log(`My votes at block ${checkBlock}: ${votes}`);
  
  if (votes < threshold) {
    console.error(`❌ Insufficient votes: need ${threshold}, have ${votes}`);
    process.exit(1);
  }
  
  // Prepare proposal
  console.log('\n📝 Preparing proposal...');
  const proposal = {
    targets: [timelockAddress],
    values: [0n],
    calldatas: ['0x'],
    description: 'Test Proposal: Verify Governance System. One harmless no-op action (0 ETH to timelock). Submitted by Clawdia (Agent ID 23606).',
  };
  
  console.log('Proposal:');
  console.log(`  Targets: ${proposal.targets}`);
  console.log(`  Values: ${proposal.values}`);
  console.log(`  Calldatas: ${proposal.calldatas}`);
  console.log(`  Description: ${proposal.description.slice(0, 100)}...`);
  
  // Submit proposal
  console.log('\n📤 Submitting proposal...');
  try {
    // Try to estimate gas first to get better error
    try {
      const gas = await publicClient.estimateContractGas({
        account,
        address: governorAddress,
        abi: governorAbi,
        functionName: 'propose',
        args: [
          proposal.targets,
          proposal.values,
          proposal.calldatas,
          proposal.description,
        ],
      });
      console.log(`Estimated gas: ${gas}`);
    } catch (err) {
      console.error('Gas estimation failed:');
      console.error(err.shortMessage || err.message);
      if (err.cause?.data) {
        console.error('Error data:', err.cause.data);
      }
      throw err;
    }
    
    const hash = await walletClient.writeContract({
      address: governorAddress,
      abi: governorAbi,
      functionName: 'propose',
      args: [
        proposal.targets,
        proposal.values,
        proposal.calldatas,
        proposal.description,
      ],
      gas: 500000n,
    });
    
    console.log(`\n✅ Transaction submitted: ${hash}`);
    console.log('⏳ Waiting for confirmation...');
    
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`\n✅ Transaction confirmed in block ${receipt.blockNumber}`);
    console.log(`Gas used: ${receipt.gasUsed}`);
    console.log(`\n🔗 View on BaseScan: https://basescan.org/tx/${hash}`);
    
  } catch (error) {
    console.error('\n❌ Transaction failed:');
    console.error(error.message);
    if (error.cause) {
      console.error('\nCause:');
      console.error(error.cause);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
