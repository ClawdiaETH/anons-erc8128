/**
 * auth.ts — SIWA-compatible authentication for Anons DAO Governance API
 *
 * Native implementation: no @buildersgarden/siwa dependency.
 * Uses viem for signature verification + ERC-8004 registry onchain check.
 *
 * Endpoints:
 *   POST /auth/nonce    — Issue a signed-message template + nonce
 *   POST /auth/verify   — Verify signature, check ERC-8004 + Anon NFT, issue JWT
 *   GET  /auth/session  — Validate existing JWT session
 *   POST /auth/legacy   — Plain Ethereum signature (backward compat)
 *
 * Agent flow:
 *   1. POST /auth/nonce  → { nonce, message }   (message is the string to sign)
 *   2. sign(message) with agent wallet           (standard eth_sign / personal_sign)
 *   3. POST /auth/verify { message, signature }  → { token, isHolder, ... }
 *   4. Use token as Bearer in subsequent requests
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  createPublicClient, http, verifyMessage, parseAbi,
  type Address,
} from 'viem';
import { base } from 'viem/chains';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config.js';

const router = Router();

// ── Config ───────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';
const SESSION_TTL_SECONDS = 24 * 60 * 60; // 24h
const API_DOMAIN = process.env.API_DOMAIN ?? 'api.anons.lol';

// ── ABIs ──────────────────────────────────────────────────────────────────────

const ERC721_ABI = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
]);

const ERC8004_ABI = parseAbi([
  'function isAgent(address account) view returns (bool)',
  'function getAgentId(address account) view returns (uint256)',
]);

const VOTES_ABI = parseAbi([
  'function getVotes(address account) view returns (uint256)',
]);

// ── Viem client ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getClient(): any {
  return (_client ??= createPublicClient({ chain: base, transport: http(config.rpcUrl) }));
}

// ── Nonce store ───────────────────────────────────────────────────────────────

interface NonceEntry { address: string; agentId?: string; issuedAt: number; }
const nonceStore = new Map<string, NonceEntry>();
setInterval(() => {
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  for (const [k, v] of nonceStore) if (v.issuedAt < fiveMinAgo) nonceStore.delete(k);
}, 5 * 60 * 1000);

// ── Ownership cache ───────────────────────────────────────────────────────────

interface OwnershipEntry { isHolder: boolean; anonBalance: number; isDelegated: boolean; votingPower: string; exp: number; }
const ownershipCache = new Map<string, OwnershipEntry>();

async function getOwnership(address: Address) {
  const key = address.toLowerCase();
  const cached = ownershipCache.get(key);
  if (cached && cached.exp > Date.now()) {
    const { exp: _, ...rest } = cached;
    return rest;
  }
  const client = getClient();
  let isHolder = false, anonBalance = 0, isDelegated = false, votingPower = '0';

  try {
    const bal = await client.readContract({ address: config.contracts.token, abi: ERC721_ABI, functionName: 'balanceOf', args: [address] });
    anonBalance = Number(bal); isHolder = anonBalance > 0;
  } catch { /* non-critical */ }

  try {
    const votes = await client.readContract({ address: config.contracts.token, abi: VOTES_ABI, functionName: 'getVotes', args: [address] });
    votingPower = votes.toString(); isDelegated = votes > 0n && !isHolder;
  } catch { /* non-critical */ }

  const result = { isHolder, anonBalance, isDelegated, votingPower };
  ownershipCache.set(key, { ...result, exp: Date.now() + 30_000 });
  return result;
}

// ── ERC-8004 check ────────────────────────────────────────────────────────────

async function checkErc8004(address: Address): Promise<{ isRegistered: boolean; agentId: number }> {
  try {
    const client = getClient();
    const [isAgent, agentId] = await Promise.all([
      client.readContract({ address: config.contracts.erc8004Registry, abi: ERC8004_ABI, functionName: 'isAgent', args: [address] }),
      client.readContract({ address: config.contracts.erc8004Registry, abi: ERC8004_ABI, functionName: 'getAgentId', args: [address] }),
    ]);
    return { isRegistered: isAgent as boolean, agentId: Number(agentId) };
  } catch {
    // Registry may not have expected ABI — don't hard-fail auth
    return { isRegistered: false, agentId: 0 };
  }
}

// ── Message builder ───────────────────────────────────────────────────────────

function buildSignInMessage(address: string, nonce: string, agentId?: string): string {
  const now = new Date();
  const exp = new Date(now.getTime() + 5 * 60 * 1000); // 5min expiry
  return [
    `${API_DOMAIN} wants you to sign in as an ERC-8004 agent.`,
    '',
    `Address: ${address}`,
    ...(agentId ? [`Agent ID: ${agentId}`] : []),
    `Chain ID: 8453`,
    `Nonce: ${nonce}`,
    `Issued At: ${now.toISOString()}`,
    `Expiration Time: ${exp.toISOString()}`,
  ].join('\n');
}

function parseSignInMessage(message: string): { address?: string; agentId?: string; nonce?: string; issuedAt?: string; expirationTime?: string } {
  const lines = message.split('\n');
  const get = (prefix: string) => lines.find(l => l.startsWith(prefix + ': '))?.slice(prefix.length + 2)?.trim();
  return {
    address: get('Address'),
    agentId: get('Agent ID'),
    nonce: get('Nonce'),
    issuedAt: get('Issued At'),
    expirationTime: get('Expiration Time'),
  };
}

// ── JWT helpers ───────────────────────────────────────────────────────────────

export interface SessionPayload {
  address: Address;
  agentId: number;
  isHolder: boolean;
  anonBalance: number;
  isDelegated: boolean;
  votingPower: string;
  isRegisteredAgent: boolean;
}

function issueJwt(payload: SessionPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: SESSION_TTL_SECONDS, issuer: 'anons-dao', subject: payload.address });
}

function decodeJwt(token: string): (SessionPayload & { iat: number; exp: number }) | null {
  try { return jwt.verify(token, JWT_SECRET, { issuer: 'anons-dao' }) as any; }
  catch { return null; }
}

// ── POST /auth/nonce ──────────────────────────────────────────────────────────

router.post('/nonce', async (req: Request, res: Response) => {
  const { address, agentId } = req.body;
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    res.status(400).json({ ok: false, error: 'Valid Ethereum address required' });
    return;
  }

  const nonce = crypto.randomBytes(16).toString('hex');
  nonceStore.set(nonce, { address: address.toLowerCase(), agentId: agentId?.toString(), issuedAt: Date.now() });
  const message = buildSignInMessage(address, nonce, agentId?.toString());

  res.json({ ok: true, nonce, message, domain: API_DOMAIN, expiresIn: 300 });
});

// ── POST /auth/verify ─────────────────────────────────────────────────────────

router.post('/verify', async (req: Request, res: Response) => {
  const { message, signature } = req.body;
  if (!message || !signature) {
    res.status(400).json({ ok: false, error: 'message and signature required' });
    return;
  }

  // Parse message
  const parsed = parseSignInMessage(message);
  if (!parsed.address || !parsed.nonce) {
    res.status(400).json({ ok: false, error: 'Invalid message format — missing Address or Nonce' });
    return;
  }

  // Check nonce
  const nonceEntry = nonceStore.get(parsed.nonce);
  if (!nonceEntry || nonceEntry.address !== parsed.address.toLowerCase()) {
    res.status(401).json({ ok: false, error: 'Invalid or expired nonce' });
    return;
  }
  nonceStore.delete(parsed.nonce); // consume

  // Check expiry
  if (parsed.expirationTime && new Date(parsed.expirationTime) < new Date()) {
    res.status(401).json({ ok: false, error: 'Message expired' });
    return;
  }

  // Verify Ethereum signature
  let sigValid = false;
  try {
    sigValid = await verifyMessage({ address: parsed.address as Address, message, signature: signature as `0x${string}` });
  } catch (e: any) {
    res.status(401).json({ ok: false, error: `Signature verification failed: ${e.message}` });
    return;
  }
  if (!sigValid) {
    res.status(401).json({ ok: false, error: 'Signature invalid' });
    return;
  }

  // ERC-8004 check (non-blocking — agents without registration still get base access)
  const erc8004 = await checkErc8004(parsed.address as Address);

  // Anon NFT ownership
  const ownership = await getOwnership(parsed.address as Address);

  const agentId = erc8004.agentId || parseInt(parsed.agentId ?? '0') || 0;

  const payload: SessionPayload = {
    address: parsed.address as Address,
    agentId,
    isRegisteredAgent: erc8004.isRegistered,
    ...ownership,
  };

  const token = issueJwt(payload);

  res.json({
    ok: true, token, expiresIn: SESSION_TTL_SECONDS,
    agentId, address: parsed.address,
    isHolder: ownership.isHolder,
    isDelegated: ownership.isDelegated,
    isRegisteredAgent: erc8004.isRegistered,
    votingPower: ownership.votingPower,
  });
});

// ── GET /auth/session ─────────────────────────────────────────────────────────

router.get('/session', requireAuth, (req: Request, res: Response) => {
  res.json({ ok: true, ...(req as any).session });
});

// ── POST /auth/legacy ─────────────────────────────────────────────────────────

router.post('/legacy', async (req: Request, res: Response) => {
  try {
    const { agentId, signature, message } = req.body;
    const addrMatch = message?.match(/Address: (0x[a-fA-F0-9]{40})/);
    if (!addrMatch) { res.status(400).json({ ok: false, error: 'Message must include "Address: 0x..." line' }); return; }
    const address = addrMatch[1] as Address;
    const isValid = await verifyMessage({ address, message, signature });
    if (!isValid) { res.status(401).json({ ok: false, error: 'Invalid signature' }); return; }
    const token = jwt.sign({ address, agentId, type: 'legacy' }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ ok: true, token, agentId, address, expiresIn: 86400 });
  } catch (err: any) { res.status(500).json({ ok: false, error: err.message }); }
});

// ── Middleware ────────────────────────────────────────────────────────────────

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) { res.status(401).json({ ok: false, error: 'Missing Authorization: Bearer <token>' }); return; }
  const session = decodeJwt(header.slice(7));
  if (!session) { res.status(401).json({ ok: false, error: 'Invalid or expired token' }); return; }
  (req as any).session = session;
  next();
}

export function requireMember(req: Request, res: Response, next: NextFunction): void {
  const s = (req as any).session as SessionPayload | undefined;
  if (!s?.isHolder && !s?.isDelegated) { res.status(403).json({ ok: false, error: 'Anon holder or delegatee required' }); return; }
  next();
}

export function requireHolder(req: Request, res: Response, next: NextFunction): void {
  const s = (req as any).session as SessionPayload | undefined;
  if (!s?.isHolder) { res.status(403).json({ ok: false, error: 'Direct Anon holder required' }); return; }
  next();
}

export default router;
