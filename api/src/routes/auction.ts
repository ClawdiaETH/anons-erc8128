import { Router, type Request, type Response } from 'express';
import { chainService } from '../services/chain.js';

const router = Router();

/**
 * GET /auction - Current auction status
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const auction = await chainService.getCurrentAuction();
    if (!auction) {
      res.status(404).json({ ok: false, error: 'No active auction found.' });
      return;
    }
    res.json({ ok: true, data: auction });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
