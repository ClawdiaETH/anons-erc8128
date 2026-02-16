// ── Express Middleware for SIWA + Anons Auth ────────────────────────────────
import type { Request, Response, NextFunction } from "express";
import { verifySession, isMember, isHolder, type Session } from "./session.js";

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      session?: Session;
    }
  }
}

/** Extract and verify session from Authorization header */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization header" });
  }

  const token = auth.slice(7);
  const session = verifySession(token);
  if (!session) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }

  req.session = session;
  next();
}

/** Require authenticated agent to be an Anon holder or delegatee */
export function requireMember(req: Request, res: Response, next: NextFunction) {
  if (!req.session) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  if (!isMember(req.session)) {
    return res.status(403).json({ error: "Anon membership required" });
  }
  next();
}

/** Require authenticated agent to directly hold an Anon NFT */
export function requireHolder(req: Request, res: Response, next: NextFunction) {
  if (!req.session) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  if (!isHolder(req.session)) {
    return res.status(403).json({ error: "Anon NFT ownership required" });
  }
  next();
}
