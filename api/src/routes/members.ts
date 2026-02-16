import { Router, type Request, type Response } from 'express';
import type { Address } from 'viem';
import { chainService } from '../services/chain.js';

const router = Router();

/**
 * GET /members/:address - Member profile
 */
router.get('/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address as Address;

    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      res.status(400).json({ ok: false, error: 'Invalid address format.' });
      return;
    }

    const profile = await chainService.getMemberProfile(address);
    res.json({ ok: true, data: profile });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
