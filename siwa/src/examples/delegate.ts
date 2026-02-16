#!/usr/bin/env tsx
// ── Example: Set up delegation from holder to agent ─────────────────────────
//
// This shows how an Anon holder delegates voting power to an agent.
// The holder runs this script with their own wallet.
//
// Run: HOLDER_KEY=0x... AGENT_ADDRESS=0x... tsx src/examples/delegate.ts
//
import { createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

const DELEGATION_CONTRACT = "0x0000000000000000000000000000000000000000"; // TODO: actual contract

const DELEGATE_ABI = parseAbi([
  "function delegate(address delegatee) external",
]);

async function main() {
  const holderKey = process.env.HOLDER_KEY as `0x${string}`;
  const agentAddress = process.env.AGENT_ADDRESS as `0x${string}`;

  if (!holderKey || !agentAddress) {
    console.error("Usage: HOLDER_KEY=0x... AGENT_ADDRESS=0x... tsx delegate.ts");
    process.exit(1);
  }

  const account = privateKeyToAccount(holderKey);
  const wallet = createWalletClient({
    account,
    chain: base,
    transport: http("https://mainnet.base.org"),
  });

  console.log(`👤 Holder: ${account.address}`);
  console.log(`🤖 Delegating to agent: ${agentAddress}`);

  const hash = await wallet.writeContract({
    address: DELEGATION_CONTRACT,
    abi: DELEGATE_ABI,
    functionName: "delegate",
    args: [agentAddress],
  });

  console.log(`✅ Delegation tx: ${hash}`);
  console.log(`   Agent can now vote on behalf of holder`);
  console.log(`\nNext steps:`);
  console.log(`  1. Agent authenticates via SIWA (see authenticate.ts)`);
  console.log(`  2. Server detects delegation during /siwa/verify`);
  console.log(`  3. Agent gets isDelegated=true in session`);
}

main().catch(console.error);
