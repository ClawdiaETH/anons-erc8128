// ── Anons DAO SIWA Configuration ────────────────────────────────────────────
import { type Address } from "viem";
import { base } from "viem/chains";

/** Anons NFT contract on Base */
export const ANONS_NFT_ADDRESS: Address =
  "0x000000000000000000000000000000000000DEAD"; // TODO: Replace with actual Anons NFT contract

/** ERC-8004 Agent Registry on Base */
export const AGENT_REGISTRY_ADDRESS: Address =
  "0x00256C0D814c455425A0699D5eEE2A7DB7A5519c";

/** CAIP-2 formatted registry for SIWA */
export const AGENT_REGISTRY_CAIP = `eip155:${base.id}:${AGENT_REGISTRY_ADDRESS}`;

/** Chain config */
export const CHAIN_ID = base.id; // 8453

/** API domain (for SIWA message) */
export const API_DOMAIN = process.env.API_DOMAIN ?? "api.anons.lol";

/** API URI (for SIWA message) */
export const API_URI = process.env.API_URI ?? `https://${API_DOMAIN}/siwa`;

/** HMAC secret for SIWA receipts */
export const RECEIPT_SECRET = process.env.RECEIPT_SECRET ?? "dev-secret-change-me";

/** JWT secret for session tokens */
export const JWT_SECRET = process.env.JWT_SECRET ?? "dev-jwt-secret-change-me";

/** Session duration (24 hours) */
export const SESSION_TTL_SECONDS = 86400;

/** RPC URL */
export const RPC_URL = process.env.RPC_URL ?? "https://mainnet.base.org";
