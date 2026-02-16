import { Router, type Request, type Response } from 'express';
import { chainService } from '../services/chain.js';

const router = Router();

/**
 * GET /treasury - Treasury stats
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const stats = await chainService.getTreasuryStats();
    res.json({ ok: true, data: stats });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
