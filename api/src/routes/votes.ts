import { Router, type Request, type Response } from 'express';
import { requireAuth, requireMember } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { CastVoteSchema } from '../types/index.js';
import { chainService } from '../services/chain.js';
import { config } from '../config.js';

const router = Router();

/**
 * POST /votes/:proposalId - Cast vote
 * Requires: Anon NFT ownership
 */
router.post('/:proposalId', requireAuth, requireMember, validateBody(CastVoteSchema), async (req: Request, res: Response) => {
  try {
    const proposalId = BigInt(req.params.proposalId as string);
    const { support, reason } = req.body;
    const voter = (req as any).session.address;

    if (config.contracts.governor === '0x0000000000000000000000000000000000000000') {
      res.status(503).json({
        ok: false,
        error: 'Governor contract not yet deployed.',
      });
      return;
    }

    // Check proposal is active
    const state = await chainService.getProposalState(proposalId);
    if (state !== 1) { // Active = 1
      res.status(400).json({
        ok: false,
        error: `Proposal is not active (current state: ${state}). Only active proposals can be voted on.`,
      });
      return;
    }

    // Check if already voted
    const existingVote = await chainService.getVoteReceipt(proposalId, voter);
    if (existingVote) {
      res.status(409).json({
        ok: false,
        error: 'Already voted on this proposal.',
        data: existingVote,
      });
      return;
    }

    // Prepare vote calldata for the agent to submit
    // support: 0 = against, 1 = for, 2 = abstain
    const supportValue = support ? 1 : 0;

    res.json({
      ok: true,
      data: {
        message: 'Vote prepared. Submit onchain using the calldata below.',
        voter,
        proposalId: proposalId.toString(),
        support: supportValue,
        reason: reason || '',
        governor: config.contracts.governor,
        calldata: {
          functionName: reason ? 'castVoteWithReason' : 'castVote',
          args: reason
            ? [proposalId.toString(), supportValue, reason]
            : [proposalId.toString(), supportValue],
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /votes/:proposalId/:voter - Get vote receipt
 */
router.get('/:proposalId/:voter', async (req: Request, res: Response) => {
  try {
    const proposalId = BigInt(req.params.proposalId as string);
    const voter = req.params.voter as `0x${string}`;

    if (config.contracts.governor === '0x0000000000000000000000000000000000000000') {
      res.status(503).json({ ok: false, error: 'Governor contract not yet deployed.' });
      return;
    }

    const receipt = await chainService.getVoteReceipt(proposalId, voter);
    if (!receipt) {
      res.status(404).json({ ok: false, error: 'No vote found for this address on this proposal.' });
      return;
    }

    res.json({ ok: true, data: receipt });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
