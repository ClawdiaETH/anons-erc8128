import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import proposalsRouter from './routes/proposals.js';
import votesRouter from './routes/votes.js';
import treasuryRouter from './routes/treasury.js';
import membersRouter from './routes/members.js';
import auctionRouter from './routes/auction.js';

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

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
app.use('/proposals', proposalsRouter);
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
