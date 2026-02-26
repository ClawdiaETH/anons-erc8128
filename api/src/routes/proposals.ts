import { Router, type Request, type Response } from 'express';
import createAnonsAuth, { type AuthenticatedRequest } from '../middleware/erc8128.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { CreateProposalSchema, ListProposalsSchema } from '../types/index.js';
import { chainService } from '../services/chain.js';
import { config } from '../config.js';

const router = Router();
const { auth } = createAnonsAuth();

/**
 * POST /proposals - Submit governance proposal
 * Requires: Anon NFT ownership
 */
router.post('/', auth, validateBody(CreateProposalSchema), async (req: Request, res: Response) => {
  try {
    const { title, description, actions } = req.body;
    const proposer = (req as AuthenticatedRequest).wallet;

    // Governor not yet deployed
    if (config.contracts.governor === '0x0000000000000000000000000000000000000000') {
      res.status(503).json({
        ok: false,
        error: 'Governor contract not yet deployed. Proposals will be available once governance goes live.',
        hint: 'Set GOVERNOR env var when the contract is deployed.',
      });
      return;
    }

    // In production, this would submit an onchain tx via the agent's signer.
    // For now, we return the formatted proposal data for the agent to submit.
    const fullDescription = `# ${title}\n\n${description}`;

    res.status(200).json({
      ok: true,
      data: {
        message: 'Proposal prepared. Submit onchain using the encoded calldata below.',
        proposer,
        governor: config.contracts.governor,
        calldata: {
          targets: actions.map((a: any) => a.target),
          values: actions.map((a: any) => a.value || '0'),
          signatures: actions.map((a: any) => a.signature),
          calldatas: actions.map((a: any) => a.calldata || '0x'),
          description: fullDescription,
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /proposals - List all proposals
 * Query: ?status=active|executed|defeated&page=1&limit=20
 */
router.get('/', validateQuery(ListProposalsSchema), async (req: Request, res: Response) => {
  try {
    const { status, page, limit } = req.query as any;

    if (config.contracts.governor === '0x0000000000000000000000000000000000000000') {
      res.json({
        ok: true,
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        meta: { governorDeployed: false, message: 'Governor contract not yet deployed.' },
      });
      return;
    }

    const { proposals, total } = await chainService.listProposals(status, page, limit);

    res.json({
      ok: true,
      data: proposals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /proposals/:id - Get proposal details
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const proposalId = BigInt(req.params.id as string);

    if (config.contracts.governor === '0x0000000000000000000000000000000000000000') {
      res.status(503).json({ ok: false, error: 'Governor contract not yet deployed.' });
      return;
    }

    const proposal = await chainService.getProposal(proposalId);

    // If requester is authenticated, include their vote
    let myVote = null;
    if ((req as any).session) {
      myVote = await chainService.getVoteReceipt(proposalId, (req as any).session?.address);
    }

    res.json({
      ok: true,
      data: { ...proposal, myVote },
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
