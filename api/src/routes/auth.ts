import { Router, type Request, type Response } from 'express';
import { verifyMessage } from 'viem';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { validateBody } from '../middleware/validate.js';
import { z } from 'zod';

const router = Router();

const AuthRequestSchema = z.object({
  agentId: z.string(),
  signature: z.string().startsWith('0x'),
  message: z.string(),
});

/**
 * POST /auth - Simple JSON authentication for agents
 * Returns JWT token for use in Authorization header
 */
router.post('/', validateBody(AuthRequestSchema), async (req: Request, res: Response) => {
  try {
    const { agentId, signature, message } = req.body;

    // Extract address from message (format: "Sign in to Anons DAO\nAgent ID: 123\nTimestamp: 1234567890\nAddress: 0x...")
    const addressMatch = message.match(/Address: (0x[a-fA-F0-9]{40})/);
    if (!addressMatch) {
      res.status(400).json({
        success: false,
        error: 'Message must include "Address: 0x..." line',
      });
      return;
    }

    const address = addressMatch[1] as `0x${string}`;

    // Verify signature
    const isValid = await verifyMessage({
      address,
      message,
      signature: signature as `0x${string}`,
    });

    if (!isValid) {
      res.status(401).json({
        success: false,
        error: 'Invalid signature',
      });
      return;
    }

    // Generate JWT token (expires in 24 hours)
    const token = jwt.sign(
      {
        address,
        agentId,
        type: 'agent',
      },
      process.env.JWT_SECRET || 'dev-secret-change-in-production',
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      agentId,
      address,
      expiresIn: 86400, // 24 hours in seconds
    });
  } catch (err: any) {
    console.error('Auth error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * JWT verification middleware
 */
export function requireAuth(req: Request, res: Response, next: any) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'Missing or invalid Authorization header. Use: Authorization: Bearer <token>',
    });
    return;
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'dev-secret-change-in-production'
    ) as { address: string; agentId: string; type: string };

    (req as any).auth = decoded;
    next();
  } catch (err) {
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
    });
  }
}

export default router;
