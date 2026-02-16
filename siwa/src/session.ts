// ── Session Management (JWT-based sessions on top of SIWA receipts) ─────────
import jwt from "jsonwebtoken";
import { type Address } from "viem";
import { JWT_SECRET, SESSION_TTL_SECONDS } from "./config.js";

export interface SessionPayload {
  /** Agent wallet address */
  address: Address;
  /** ERC-8004 agent ID */
  agentId: number;
  /** Whether agent is a direct Anon holder */
  isHolder: boolean;
  /** Number of Anons held (0 if delegatee only) */
  anonBalance: number;
  /** Whether agent has delegated voting power */
  isDelegated: boolean;
  /** Voting power (from delegation) */
  votingPower: string;
  /** SIWA receipt (for ERC-8128 calls) */
  receipt: string;
}

export interface Session extends SessionPayload {
  iat: number;
  exp: number;
}

/** Create a JWT session token after SIWA verification */
export function createSession(payload: SessionPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: SESSION_TTL_SECONDS,
    issuer: "anons-dao",
    subject: payload.address,
  });
}

/** Verify and decode a session token */
export function verifySession(token: string): Session | null {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: "anons-dao",
    }) as Session;
  } catch {
    return null;
  }
}

/** Check if session has member (holder or delegatee) access */
export function isMember(session: Session): boolean {
  return session.isHolder || session.isDelegated;
}

/** Check if session has holder-only access */
export function isHolder(session: Session): boolean {
  return session.isHolder;
}
