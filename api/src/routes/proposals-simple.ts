import { Router, type Request, type Response } from 'express';
import { requireAuth, requireHolder } from './auth.js';
import { validateBody } from '../middleware/validate.js';
import { z } from 'zod';
import { encodeFunctionData } from 'viem';

const router = Router();

const CreateProposalSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  actions: z.array(z.object({
    target: z.string().startsWith('0x'),
    value: z.string().default('0'),
    calldata: z.string().startsWith('0x').default('0x'),
  })).min(1),
});

/**
 * POST /proposals/create - Create proposal with simple JWT auth
 * Returns calldata for onchain submission
 */
router.post('/create', requireAuth, requireHolder, validateBody(CreateProposalSchema), async (req: Request, res: Response) => {
  try {
    const { title, description, actions } = req.body;
    const { address, agentId } = (req as any).session;

    // Format proposal
    const fullDescription = `${title}\n\n${description}`;
    
    const targets = actions.map((a: any) => a.target);
    const values = actions.map((a: any) => a.value || '0');
    const calldatas = actions.map((a: any) => a.calldata || '0x');

    res.json({
      success: true,
      calldata: calldatas,
      targets,
      values,
      description: fullDescription,
      proposer: address,
      agentId,
      instructions: 'Submit this proposal onchain by calling Governor.propose() with the provided parameters',
    });
  } catch (err: any) {
    console.error('Create proposal error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
