// ── SIWA Auth Server for Anons DAO ──────────────────────────────────────────
//
// Endpoints:
//   POST /siwa/nonce    — Get a nonce (pre-checks ERC-8004 registration)
//   POST /siwa/verify   — Verify SIWA signature, check Anon ownership, issue session
//   GET  /siwa/session  — Validate existing session token
//
// Protected example endpoints:
//   GET  /member/profile    — Requires Anon holder OR delegatee
//   POST /member/proposals  — Requires direct Anon holder
//
import express from "express";
import cors from "cors";
import { createSIWANonce, verifySIWA } from "@buildersgarden/siwa";
import { createReceipt } from "@buildersgarden/siwa/receipt";
import { createPublicClient, http, type Address } from "viem";
import { base } from "viem/chains";

import {
  API_DOMAIN,
  RECEIPT_SECRET,
  RPC_URL,
  CHAIN_ID,
  AGENT_REGISTRY_CAIP,
} from "./config.js";
import { verifyAnonOwnership, verifyDelegation } from "./onchain.js";
import { createSession, verifySession, type SessionPayload } from "./session.js";
import { requireAuth, requireMember, requireHolder } from "./middleware.js";

const app = express();
app.use(cors({
  origin: "*",
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-SIWA-Receipt",
    "Signature",
    "Signature-Input",
    "Content-Digest",
  ],
}));
app.use(express.json());

// ── Viem client ─────────────────────────────────────────────────────────────
const client = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
});

// ── Nonce store (in-memory; use Redis in production) ────────────────────────
const nonceStore = new Map<string, number>();

// Clean expired nonces every 5 minutes
setInterval(() => {
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  for (const [nonce, timestamp] of nonceStore) {
    if (timestamp < fiveMinAgo) nonceStore.delete(nonce);
  }
}, 5 * 60 * 1000);

// ── POST /siwa/nonce ────────────────────────────────────────────────────────
app.post("/siwa/nonce", async (req, res) => {
  try {
    const { address, agentId, agentRegistry } = req.body;

    if (!address || agentId === undefined) {
      return res.status(400).json({ error: "address and agentId required" });
    }

    const result = await createSIWANonce(
      {
        address,
        agentId,
        agentRegistry: agentRegistry ?? AGENT_REGISTRY_CAIP,
      },
      client as any
    );

    nonceStore.set(result.nonce, Date.now());

    res.json({
      nonce: result.nonce,
      issuedAt: result.issuedAt,
      expirationTime: result.expirationTime,
    });
  } catch (err: any) {
    console.error("Nonce error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /siwa/verify ───────────────────────────────────────────────────────
app.post("/siwa/verify", async (req, res) => {
  try {
    const { message, signature } = req.body;

    if (!message || !signature) {
      return res.status(400).json({ error: "message and signature required" });
    }

    // 1. Verify SIWA signature + ERC-8004 registration
    const result = await verifySIWA(
      message,
      signature,
      API_DOMAIN,
      (nonce: string) => {
        if (!nonceStore.has(nonce)) return false;
        nonceStore.delete(nonce); // consume nonce (one-time use)
        return true;
      },
      client as any
    );

    if (!result.valid) {
      return res.status(401).json({ error: result.error });
    }

    // 2. Check Anon NFT ownership
    const ownership = await verifyAnonOwnership(result.address as Address);

    // 3. Check delegation (agent may have delegated voting power)
    // TODO: Set actual delegation contract address
    const delegation = await verifyDelegation(
      result.address as Address,
      "0x0000000000000000000000000000000000000000" as Address // placeholder
    );

    // 4. Create SIWA receipt for ERC-8128 subsequent calls
    const { receipt } = createReceipt(
      {
        address: result.address,
        agentId: result.agentId,
        agentRegistry: result.agentRegistry,
        chainId: result.chainId,
        signerType: result.signerType,
      },
      { secret: RECEIPT_SECRET }
    );

    // 5. Create JWT session with all auth context
    const sessionPayload: SessionPayload = {
      address: result.address as Address,
      agentId: result.agentId,
      isHolder: ownership.isHolder,
      anonBalance: Number(ownership.balance),
      isDelegated: delegation.isDelegated,
      votingPower: delegation.votingPower.toString(),
      receipt,
    };

    const token = createSession(sessionPayload);

    res.json({
      token,
      agentId: result.agentId,
      address: result.address,
      isHolder: ownership.isHolder,
      isDelegated: delegation.isDelegated,
      receipt,
    });
  } catch (err: any) {
    console.error("Verify error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /siwa/session ───────────────────────────────────────────────────────
app.get("/siwa/session", requireAuth, (req, res) => {
  res.json({
    valid: true,
    ...req.session,
  });
});

// ── Protected: Member endpoints ─────────────────────────────────────────────
app.get("/member/profile", requireAuth, requireMember, (req, res) => {
  res.json({
    address: req.session!.address,
    agentId: req.session!.agentId,
    isHolder: req.session!.isHolder,
    anonBalance: req.session!.anonBalance,
    isDelegated: req.session!.isDelegated,
    votingPower: req.session!.votingPower,
  });
});

app.post("/member/proposals", requireAuth, requireHolder, (req, res) => {
  // Only direct Anon holders can create proposals
  res.json({
    message: "Proposal creation endpoint (holder-only)",
    author: req.session!.address,
  });
});

app.get("/member/forum", requireAuth, requireMember, (_req, res) => {
  res.json({ message: "Member forum access granted" });
});

// ── Start ───────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? "3100");
app.listen(PORT, () => {
  console.log(`🔐 Anons SIWA server running on http://localhost:${PORT}`);
  console.log(`   POST /siwa/nonce   — Get nonce`);
  console.log(`   POST /siwa/verify  — Verify & get session`);
  console.log(`   GET  /siwa/session — Validate session`);
});

export default app;
