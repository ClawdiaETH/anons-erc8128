import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import proposalsRouter from './routes/proposals.js';
import votesRouter from './routes/votes.js';
import treasuryRouter from './routes/treasury.js';
import membersRouter from './routes/members.js';
import auctionRouter from './routes/auction.js';
import authRouter from './routes/auth.js';
import proposalsSimpleRouter from './routes/proposals-simple.js';

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Root endpoint - API documentation
app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'Anons DAO Governance API',
    version: '0.1.0',
    chain: 'Base Mainnet',
    description: 'ERC-8128 governance API for Anons DAO',
    contracts: {
      token: config.contracts.token,
      governor: config.contracts.governor,
      timelock: config.contracts.timelock,
      auctionHouse: config.contracts.auctionHouse,
    },
    endpoints: {
      health: 'GET /health - Health check',
      proposals: {
        list: 'GET /proposals - List all proposals',
        get: 'GET /proposals/:id - Get proposal by ID',
        state: 'GET /proposals/:id/state - Get proposal state',
      },
      votes: {
        proposal: 'GET /votes/:proposalId - Get votes for a proposal',
        member: 'GET /votes/member/:address - Get votes by member',
      },
      treasury: {
        balance: 'GET /treasury - Get treasury balance',
        transactions: 'GET /treasury/transactions - Get treasury transactions',
      },
      members: {
        list: 'GET /members - List all members',
        get: 'GET /members/:address - Get member details',
        votingPower: 'GET /members/:address/voting-power - Get member voting power',
      },
      auction: {
        current: 'GET /auction/current - Get current auction',
        history: 'GET /auction/history - Get auction history',
      },
    },
    links: {
      github: 'https://github.com/ClawdiaETH/anons-erc8128',
      docs: 'https://github.com/ClawdiaETH/anons-erc8128/blob/main/api/README.md',
      sdk: 'https://github.com/ClawdiaETH/anons-erc8128/tree/main/sdk',
    },
  });
});

// Health check
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'anons-governance-api',
    version: '0.1.0',
    chain: 'base',
    contracts: {
      token: config.contracts.token,
      governor: config.contracts.governor,
      governorDeployed: config.contracts.governor !== '0x0000000000000000000000000000000000000000',
      timelock: config.contracts.timelock,
      auctionHouse: config.contracts.auctionHouse,
    },
  });
});

// Routes
app.use('/auth', authRouter);
app.use('/proposals', proposalsSimpleRouter); // Simple JWT auth
app.use('/proposals-erc8128', proposalsRouter); // Full ERC-8128 (advanced)
app.use('/votes', votesRouter);
app.use('/treasury', treasuryRouter);
app.use('/members', membersRouter);
app.use('/auction', auctionRouter);

// 404
app.use((_req, res) => {
  res.status(404).json({ ok: false, error: 'Not found' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ ok: false, error: 'Internal server error' });
});

app.listen(config.port, () => {
  console.log(`🤖 Anons DAO Governance API running on port ${config.port}`);
  console.log(`   Chain: Base Mainnet`);
  console.log(`   Token: ${config.contracts.token}`);
  console.log(`   Governor: ${config.contracts.governor === '0x0000000000000000000000000000000000000000' ? 'NOT DEPLOYED' : config.contracts.governor}`);
  console.log(`   Timelock: ${config.contracts.timelock}`);
});

export default app;
