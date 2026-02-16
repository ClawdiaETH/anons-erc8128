#!/usr/bin/env tsx
// ── Example: Agent authenticates with Anons DAO via SIWA ────────────────────
//
// Run: PRIVATE_KEY=0x... AGENT_ID=23606 tsx src/examples/authenticate.ts
//
import { AnonsAgentClient } from "../agent-client.js";

async function main() {
  const client = new AnonsAgentClient({
    privateKey: process.env.PRIVATE_KEY as `0x${string}`,
    agentId: parseInt(process.env.AGENT_ID ?? "23606"),
    apiUrl: process.env.API_URL ?? "http://localhost:3100",
  });

  console.log(`🤖 Agent address: ${client.address}`);
  console.log(`🔐 Authenticating via SIWA...`);

  const result = await client.authenticate();

  console.log(`✅ Authenticated!`);
  console.log(`   Holder: ${result.isHolder}`);
  console.log(`   Delegated: ${result.isDelegated}`);

  // Test member endpoint
  const profile = await client.getProfile();
  console.log(`\n📋 Profile:`, profile);
}

main().catch(console.error);
