import type { Request, Response, NextFunction } from 'express';
import type { Address } from 'viem';
import { chainService } from '../services/chain.js';
import type { ERC8128AuthContext } from '../types/index.js';

/**
 * ERC-8128 Authentication Middleware (Placeholder)
 * 
 * This middleware will be replaced by the full ERC-8128 auth implementation
 * being built by another subagent. For now, it:
 * 
 * 1. Reads the agent address from the X-Agent-Address header
 * 2. Verifies they own at least one Anon NFT
 * 3. Checks ERC-8004 agent registration
 * 
 * The real ERC-8128 middleware will:
 * - Verify cryptographic signatures per ERC-8128 spec
 * - Validate agent capability tokens
 * - Check delegation chains
 * - Enforce rate limits per agent
 */

declare global {
  namespace Express {
    interface Request {
      auth?: ERC8128AuthContext;
    }
  }
}

/**
 * Require Anon NFT ownership for write operations.
 * Uses X-Agent-Address header as placeholder until ERC-8128 auth is ready.
 */
export function requireAnon() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const agentAddress = req.headers['x-agent-address'] as string;

    if (!agentAddress || !/^0x[a-fA-F0-9]{40}$/.test(agentAddress)) {
      res.status(401).json({
        ok: false,
        error: 'Missing or invalid X-Agent-Address header. ERC-8128 auth coming soon.',
      });
      return;
    }

    try {
      const address = agentAddress as Address;
      const [balance, isAgent] = await Promise.all([
        chainService.getAnonsBalance(address),
        chainService.isRegisteredAgent(address),
      ]);

      if (balance === 0n) {
        res.status(403).json({
          ok: false,
          error: 'Must own at least one Anon NFT to perform this action.',
        });
        return;
      }

      req.auth = {
        agentAddress: address,
        isVerifiedAgent: isAgent,
        anonsBalance: Number(balance),
      };

      next();
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: 'Failed to verify agent ownership.',
      });
    }
  };
}

/**
 * Optional auth - attaches auth context if header present, doesn't block.
 */
export function optionalAuth() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const agentAddress = req.headers['x-agent-address'] as string;

    if (agentAddress && /^0x[a-fA-F0-9]{40}$/.test(agentAddress)) {
      try {
        const address = agentAddress as Address;
        const [balance, isAgent] = await Promise.all([
          chainService.getAnonsBalance(address),
          chainService.isRegisteredAgent(address),
        ]);
        req.auth = {
          agentAddress: address,
          isVerifiedAgent: isAgent,
          anonsBalance: Number(balance),
        };
      } catch {
        // Silent fail for optional auth
      }
    }

    next();
  };
}
