/**
 * ERC-8128 Authentication Middleware for Anons DAO Governance API
 *
 * Verifies signed HTTP requests using ERC-8128 (RFC 9421 + Ethereum signatures),
 * checks Anon NFT ownership on Base, and enforces per-wallet rate limits.
 */

import type { Request, Response, NextFunction, RequestHandler } from "express";
import {
  verifyRequest,
  type NonceStore,
  type VerifyPolicy,
} from "@slicekit/erc8128";
import {
  createPublicClient,
  http,
  type Address,
  type PublicClient,
} from "viem";
import { base } from "viem/chains";
import { verifyMessage as viemVerifyMessage } from "viem";
import cors from "cors";

// ─── Constants ───────────────────────────────────────────────────────────────

export const ANONS_TOKEN_ADDRESS =
  "0x813d1d56457bd4697abedb835435691b187eedc4" as const;

const ERC721_BALANCE_OF_ABI = [
  {
    inputs: [{ name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AuthConfig {
  /** Base RPC URL (default: https://mainnet.base.org) */
  rpcUrl?: string;
  /** Anons NFT contract address (default: mainnet) */
  tokenAddress?: Address;
  /** Max requests per wallet per window (default: 60) */
  rateLimit?: number;
  /** Rate limit window in ms (default: 60_000 = 1 minute) */
  rateLimitWindow?: number;
  /** ERC-8128 verify policy overrides */
  verifyPolicy?: VerifyPolicy;
  /** CORS origins (default: "*") */
  corsOrigins?: string | string[];
  /** Optional external nonce store (default: in-memory) */
  nonceStore?: NonceStore;
  /** Optional viem public client (for testing / shared instance) */
  publicClient?: PublicClient;
  /** Cache TTL for NFT ownership checks in ms (default: 30_000) */
  ownershipCacheTtl?: number;
}

export interface AuthenticatedRequest extends Request {
  /** Verified wallet address from ERC-8128 signature */
  wallet: Address;
  /** Chain ID from the signature */
  chainId: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// ─── In-memory Nonce Store ───────────────────────────────────────────────────

function createMemoryNonceStore(): NonceStore {
  const consumed = new Map<string, number>(); // key → expiry timestamp

  // Lazy cleanup every 60s
  let lastCleanup = Date.now();
  function maybeCleanup() {
    const now = Date.now();
    if (now - lastCleanup < 60_000) return;
    lastCleanup = now;
    for (const [k, exp] of consumed) {
      if (exp < now) consumed.delete(k);
    }
  }

  return {
    async consume(key: string, ttlSeconds: number): Promise<boolean> {
      maybeCleanup();
      if (consumed.has(key)) return false;
      consumed.set(key, Date.now() + ttlSeconds * 1000);
      return true;
    },
  };
}

// ─── Ownership Cache ─────────────────────────────────────────────────────────

interface CacheEntry {
  owns: boolean;
  expiresAt: number;
}

// ─── Middleware Factory ──────────────────────────────────────────────────────

export function createAnonsAuth(config: AuthConfig = {}) {
  const {
    rpcUrl = "https://mainnet.base.org",
    tokenAddress = ANONS_TOKEN_ADDRESS,
    rateLimit = 60,
    rateLimitWindow = 60_000,
    corsOrigins = "*",
    ownershipCacheTtl = 30_000,
  } = config;

  const nonceStore = config.nonceStore ?? createMemoryNonceStore();

  const client =
    config.publicClient ??
    createPublicClient({ chain: base, transport: http(rpcUrl) });

  const defaultPolicy: VerifyPolicy = {
    label: "eth",
    replayable: false,
    maxValiditySec: 120,
    maxNonceWindowSec: 120,
    clockSkewSec: 10,
    ...config.verifyPolicy,
  };

  // Rate limit state
  const rateLimits = new Map<string, RateLimitEntry>();

  // Ownership cache
  const ownershipCache = new Map<string, CacheEntry>();

  // ─── verifyMessage adapter for @slicekit/erc8128 ─────────────────────────
  // The library expects: (message: Uint8Array, signature: Hex, address: Address, chainId: number) => Promise<boolean>
  const verifyMessageFn = async (
    message: Uint8Array,
    signature: `0x${string}`,
    address: Address
  ): Promise<boolean> => {
    try {
      return await viemVerifyMessage({
        address,
        message: { raw: message },
        signature,
      });
    } catch {
      return false;
    }
  };

  // ─── NFT Ownership Check ────────────────────────────────────────────────
  async function ownsAnon(address: Address): Promise<boolean> {
    const key = address.toLowerCase();
    const now = Date.now();
    const cached = ownershipCache.get(key);
    if (cached && cached.expiresAt > now) return cached.owns;

    try {
      const balance = await client.readContract({
        address: tokenAddress,
        abi: ERC721_BALANCE_OF_ABI,
        functionName: "balanceOf",
        args: [address],
      });
      const owns = balance > 0n;
      ownershipCache.set(key, { owns, expiresAt: now + ownershipCacheTtl });
      return owns;
    } catch (err) {
      // If RPC fails, don't cache — deny access but allow retry
      console.error("[anons-auth] NFT ownership check failed:", err);
      return false;
    }
  }

  // ─── Rate Limiting ──────────────────────────────────────────────────────
  function checkRateLimit(address: string): {
    allowed: boolean;
    remaining: number;
    resetAt: number;
  } {
    const key = address.toLowerCase();
    const now = Date.now();
    let entry = rateLimits.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + rateLimitWindow };
      rateLimits.set(key, entry);
    }

    entry.count++;
    const allowed = entry.count <= rateLimit;
    return {
      allowed,
      remaining: Math.max(0, rateLimit - entry.count),
      resetAt: entry.resetAt,
    };
  }

  // ─── Convert Express Request → Fetch API Request ────────────────────────
  function toFetchRequest(req: Request): globalThis.Request {
    const protocol = req.protocol || "https";
    const host = req.get("host") || "localhost";
    const url = `${protocol}://${host}${req.originalUrl}`;

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === "string") {
        headers.set(key, value);
      } else if (Array.isArray(value)) {
        for (const v of value) headers.append(key, v);
      }
    }

    const hasBody = req.method !== "GET" && req.method !== "HEAD" && req.body;
    const body = hasBody
      ? typeof req.body === "string"
        ? req.body
        : JSON.stringify(req.body)
      : undefined;

    return new globalThis.Request(url, {
      method: req.method,
      headers,
      body,
    });
  }

  // ─── CORS Middleware ────────────────────────────────────────────────────
  const corsMiddleware = cors({
    origin: corsOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Signature",
      "Signature-Input",
      "Content-Digest",
      "Authorization",
    ],
    exposedHeaders: [
      "X-RateLimit-Limit",
      "X-RateLimit-Remaining",
      "X-RateLimit-Reset",
      "Accept-Signature",
    ],
    credentials: true,
  });

  // ─── Auth Middleware ────────────────────────────────────────────────────
  const authMiddleware: RequestHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    // 1. Check for signature headers
    const signatureInput = req.headers["signature-input"];
    if (!signatureInput) {
      res.status(401).json({
        error: "missing_signature",
        message:
          "Request must include ERC-8128 signature headers (Signature-Input, Signature). See https://erc8128.slice.so",
      });
      return;
    }

    // 2. Convert to Fetch Request and verify ERC-8128 signature
    let fetchReq: globalThis.Request;
    try {
      fetchReq = toFetchRequest(req);
    } catch (err) {
      res.status(400).json({
        error: "invalid_request",
        message: "Could not parse request for signature verification",
      });
      return;
    }

    const result = await verifyRequest(
      fetchReq,
      verifyMessageFn,
      nonceStore,
      defaultPolicy,
      (name, value) => res.setHeader(name, value)
    );

    if (!result.ok) {
      res.status(401).json({
        error: "signature_invalid",
        message: `ERC-8128 signature verification failed: ${result.reason}`,
        detail: result.detail,
      });
      return;
    }

    const address = result.address as Address;
    const chainId = result.chainId;

    // 3. Rate limit check
    const rl = checkRateLimit(address);
    res.setHeader("X-RateLimit-Limit", rateLimit.toString());
    res.setHeader("X-RateLimit-Remaining", rl.remaining.toString());
    res.setHeader(
      "X-RateLimit-Reset",
      Math.ceil(rl.resetAt / 1000).toString()
    );

    if (!rl.allowed) {
      res.status(429).json({
        error: "rate_limited",
        message: `Rate limit exceeded for ${address}. Try again after ${new Date(rl.resetAt).toISOString()}`,
      });
      return;
    }

    // 4. Check Anon NFT ownership
    const owns = await ownsAnon(address);
    if (!owns) {
      res.status(403).json({
        error: "not_holder",
        message: `Address ${address} does not hold an Anon NFT. Acquire one at anons.lol to access governance endpoints.`,
        contract: tokenAddress,
      });
      return;
    }

    // 5. Attach wallet info and continue
    (req as AuthenticatedRequest).wallet = address;
    (req as AuthenticatedRequest).chainId = chainId;

    next();
  };

  return { cors: corsMiddleware, auth: authMiddleware, ownsAnon, checkRateLimit };
}

export default createAnonsAuth;
