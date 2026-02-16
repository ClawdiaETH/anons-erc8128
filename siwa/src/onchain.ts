// ── Onchain Verification (Anon NFT ownership + delegation) ──────────────────
import {
  createPublicClient,
  http,
  type Address,
  type PublicClient,
  parseAbi,
} from "viem";
import { base } from "viem/chains";
import { ANONS_NFT_ADDRESS, RPC_URL } from "./config.js";

// Minimal ABIs for onchain checks
const ERC721_ABI = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
]);

const DELEGATION_ABI = parseAbi([
  // Simple delegation mapping: delegate => delegator
  // Adapt to actual Anons DAO delegation contract
  "function delegates(address account) view returns (address)",
  "function getVotes(address account) view returns (uint256)",
]);

let _client: PublicClient | null = null;

export function getClient(): PublicClient {
  if (!_client) {
    _client = createPublicClient({
      chain: base,
      transport: http(RPC_URL),
    });
  }
  return _client;
}

/** Check if address owns at least one Anon NFT */
export async function verifyAnonOwnership(
  address: Address,
  client?: PublicClient
): Promise<{ isHolder: boolean; balance: bigint }> {
  const c = client ?? getClient();
  try {
    const balance = await c.readContract({
      address: ANONS_NFT_ADDRESS,
      abi: ERC721_ABI,
      functionName: "balanceOf",
      args: [address],
    });
    return { isHolder: balance > 0n, balance };
  } catch {
    // Contract may not be deployed yet in dev
    console.warn("Failed to check Anon ownership — using fallback");
    return { isHolder: false, balance: 0n };
  }
}

/** Check if an agent has been delegated voting power */
export async function verifyDelegation(
  agentAddress: Address,
  delegationContract: Address
): Promise<{ isDelegated: boolean; votingPower: bigint }> {
  const client = getClient();
  try {
    const votes = await client.readContract({
      address: delegationContract,
      abi: DELEGATION_ABI,
      functionName: "getVotes",
      args: [agentAddress],
    });
    return { isDelegated: votes > 0n, votingPower: votes };
  } catch {
    console.warn("Failed to check delegation — using fallback");
    return { isDelegated: false, votingPower: 0n };
  }
}

/** Check who a holder has delegated to */
export async function getDelegatee(
  holderAddress: Address,
  delegationContract: Address
): Promise<Address | null> {
  const client = getClient();
  try {
    const delegatee = await client.readContract({
      address: delegationContract,
      abi: DELEGATION_ABI,
      functionName: "delegates",
      args: [holderAddress],
    });
    return delegatee as Address;
  } catch {
    return null;
  }
}
