/**
 * auth.ts — SIWA + JWT authentication for Anons DAO Governance API
 *
 * Endpoints:
 *   POST /auth/nonce    — Request SIWA nonce (validates ERC-8004 registration)
 *   POST /auth/verify   — Verify SIWA signature, check Anon ownership, issue JWT
 *   GET  /auth/session  — Validate existing JWT session
 *   POST /auth/legacy   — Simple Ethereum signature (backward compat, no ERC-8004 check)
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { createPublicClient, http, verifyMessage, type Address, parseAbi } from 'viem';
import { base } from 'viem/chains';
import jwt from 'jsonwebtoken';
import { createSIWANonce, verifySIWA } from '@buildersgarden/siwa';
import { config } from '../config.js';

const router = Router();

// ── Viem client (shared, lazy) ───────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: any = null;
function getClient(): any {
  return (_client ??= createPublicClient({
    chain: base,
    transport: http(config.rpcUrl),
  }));
}

// ── ABIs ─────────────────────────────────────────────────────────────────────

const ERC721_ABI = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
]);

// Anons DAO token uses OZ ERC20Votes — delegates() + getVotes() on same contract
const VOTES_ABI = parseAbi([
  'function delegates(address account) view returns (address)',
  'function getVotes(address account) view returns (uint256)',
]);

// ── Constants ────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';
const SESSION_TTL_SECONDS = 24 * 60 * 60; // 24h
const API_DOMAIN = process.env.API_DOMAIN ?? 'api.anons.lol';
const AGENT_REGISTRY_CAIP = `eip155:8453:${config.contracts.erc8004Registry}`;

// ── Nonce store (in-memory; replace with Redis in production) ────────────────

const nonceStore = new Map<string, number>();
setInterval(() => {
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  for (const [nonce, ts] of nonceStore) {
    if (ts < fiveMinAgo) nonceStore.delete(nonce);
  }
}, 5 * 60 * 1000);

// ── Ownership cache ───────────────────────────────────────────────────────────

interface OwnershipCache { isHolder: boolean; anonBalance: number; isDelegated: boolean; votingPower: string; exp: number; }
const ownershipCache = new Map<string, OwnershipCache>();

async function getOwnership(address: Address): Promise<Omit<OwnershipCache, 'exp'>> {
  const key = address.toLowerCase();
  const cached = ownershipCache.get(key);
  if (cached && cached.exp > Date.now()) {
    const { exp: _, ...rest } = cached;
    return rest;
  }

  const client = getClient();
  let isHolder = false;
  let anonBalance = 0;
  let isDelegated = false;
  let votingPower = '0';

  try {
    const balance = await client.readContract({
      address: config.contracts.token,
      abi: ERC721_ABI,
      functionName: 'balanceOf',
      args: [address],
    });
    anonBalance = Number(balance);
    isHolder = anonBalance > 0;
  } catch (e) {
    console.warn('[auth] Anon balance check failed:', e);
  }

  try {
    // Check delegated voting power via the governance token (ERC20Votes on token contract)
    const votes = await client.readContract({
      address: config.contracts.token,
      abi: VOTES_ABI,
      functionName: 'getVotes',
      args: [address],
    });
    isDelegated = votes > 0n && !isHolder; // delegated = has voting power but doesn't hold directly
    votingPower = votes.toString();
  } catch {
    // Non-critical — delegation check failure doesn't block auth
  }

  const result = { isHolder, anonBalance, isDelegated, votingPower };
  ownershipCache.set(key, { ...result, exp: Date.now() + 30_000 }); // 30s cache
  return result;
}

// ── Session payload ───────────────────────────────────────────────────────────

export interface SessionPayload {
  address: Address;
  agentId: number;
  isHolder: boolean;
  anonBalance: number;
  isDelegated: boolean;
  votingPower: string;
}

function issueJwt(payload: SessionPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: SESSION_TTL_SECONDS,
    issuer: 'anons-dao',
    subject: payload.address,
  });
}

function decodeJwt(token: string): (SessionPayload & { iat: number; exp: number }) | null {
  try {
    return jwt.verify(token, JWT_SECRET, { issuer: 'anons-dao' }) as any;
  } catch {
    return null;
  }
}

// ── POST /auth/nonce ──────────────────────────────────────────────────────────

router.post('/nonce', async (req: Request, res: Response) => {
  try {
    const { address, agentId, agentRegistry } = req.body;
    if (!address || agentId === undefined) {
      res.status(400).json({ ok: false, error: 'address and agentId required' });
      return;
    }

    const result = await createSIWANonce(
      {
        address,
        agentId: Number(agentId),
        agentRegistry: agentRegistry ?? AGENT_REGISTRY_CAIP,
      },
      getClient() as any
    ) as any; // @buildersgarden/siwa viem version may differ

    // Handle captcha or unexpected status
    if (result.status === 'captcha_required') {
      res.status(400).json({ ok: false, error: 'Captcha required', challenge: result.challenge });
      return;
    }
    if (!result.nonce) {
      res.status(500).json({ ok: false, error: 'Failed to generate nonce', detail: result });
      return;
    }

    nonceStore.set(result.nonce, Date.now());

    res.json({
      ok: true,
      nonce: result.nonce,
      issuedAt: result.issuedAt,
      expirationTime: result.expirationTime,
      domain: API_DOMAIN,
      agentRegistry: agentRegistry ?? AGENT_REGISTRY_CAIP,
    });
  } catch (err: any) {
    console.error('[auth/nonce]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /auth/verify ─────────────────────────────────────────────────────────

router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { message, signature } = req.body;
    if (!message || !signature) {
      res.status(400).json({ ok: false, error: 'message and signature required' });
      return;
    }

    // 1. Verify SIWA signature + ERC-8004 registration
    const result = await verifySIWA(
      message,
      signature,
      API_DOMAIN,
      (nonce: string) => {
        if (!nonceStore.has(nonce)) return false;
        nonceStore.delete(nonce); // one-time use
        return true;
      },
      getClient() as any
    ) as any; // @buildersgarden/siwa viem version may differ

    if (!result.valid) {
      res.status(401).json({ ok: false, error: result.error ?? 'SIWA verification failed' });
      return;
    }

    // 2. Anon NFT ownership + delegation
    const ownership = await getOwnership(result.address as Address);

    // 3. Issue JWT
    const payload: SessionPayload = {
      address: result.address as Address,
      agentId: result.agentId,
      ...ownership,
    };
    const token = issueJwt(payload);

    res.json({
      ok: true,
      token,
      expiresIn: SESSION_TTL_SECONDS,
      agentId: result.agentId,
      address: result.address,
      isHolder: ownership.isHolder,
      isDelegated: ownership.isDelegated,
      votingPower: ownership.votingPower,
    });
  } catch (err: any) {
    console.error('[auth/verify]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /auth/session ─────────────────────────────────────────────────────────

router.get('/session', requireAuth, (req: Request, res: Response) => {
  res.json({ ok: true, ...(req as any).session });
});

// ── POST /auth/legacy ─────────────────────────────────────────────────────────
// Backward compat — plain Ethereum signature, no ERC-8004 check.
// Kept for dev tooling. Agents should use /auth/nonce + /auth/verify.

router.post('/legacy', async (req: Request, res: Response) => {
  try {
    const { agentId, signature, message } = req.body;
    const addrMatch = message?.match(/Address: (0x[a-fA-F0-9]{40})/);
    if (!addrMatch) {
      res.status(400).json({ ok: false, error: 'Message must include "Address: 0x..." line' });
      return;
    }
    const address = addrMatch[1] as Address;
    const isValid = await verifyMessage({ address, message, signature });
    if (!isValid) {
      res.status(401).json({ ok: false, error: 'Invalid signature' });
      return;
    }
    const token = jwt.sign({ address, agentId, type: 'legacy' }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ ok: true, token, agentId, address, expiresIn: 86400 });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Middleware exports ─────────────────────────────────────────────────────────

/** Require valid JWT session (any verified agent) */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ ok: false, error: 'Missing Authorization: Bearer <token>' });
    return;
  }
  const session = decodeJwt(header.slice(7));
  if (!session) {
    res.status(401).json({ ok: false, error: 'Invalid or expired token' });
    return;
  }
  (req as any).session = session;
  next();
}

/** Require Anon holder OR delegatee (member access) */
export function requireMember(req: Request, res: Response, next: NextFunction): void {
  const session = (req as any).session as SessionPayload | undefined;
  if (!session?.isHolder && !session?.isDelegated) {
    res.status(403).json({ ok: false, error: 'Anon holder or delegatee required' });
    return;
  }
  next();
}

/** Require direct Anon holder (holder-only endpoints) */
export function requireHolder(req: Request, res: Response, next: NextFunction): void {
  const session = (req as any).session as SessionPayload | undefined;
  if (!session?.isHolder) {
    res.status(403).json({ ok: false, error: 'Direct Anon holder required' });
    return;
  }
  next();
}

export default router;
