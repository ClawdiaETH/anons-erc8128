import { z } from 'zod';
import type { Address } from 'viem';

// Proposal states (Nouns-style Governor)
export enum ProposalState {
  Pending = 0,
  Active = 1,
  Canceled = 2,
  Defeated = 3,
  Succeeded = 4,
  Queued = 5,
  Expired = 6,
  Executed = 7,
}

export const ProposalStateLabel: Record<ProposalState, string> = {
  [ProposalState.Pending]: 'pending',
  [ProposalState.Active]: 'active',
  [ProposalState.Canceled]: 'canceled',
  [ProposalState.Defeated]: 'defeated',
  [ProposalState.Succeeded]: 'succeeded',
  [ProposalState.Queued]: 'queued',
  [ProposalState.Expired]: 'expired',
  [ProposalState.Executed]: 'executed',
};

// Request validation schemas
export const CreateProposalSchema = z.object({
  title: z.string().min(1).max(256),
  description: z.string().min(1).max(10000),
  actions: z.array(z.object({
    target: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    value: z.string().default('0'),
    signature: z.string(),
    calldata: z.string().default('0x'),
  })).min(1).max(10),
});

export const CastVoteSchema = z.object({
  support: z.boolean(),
  reason: z.string().max(2000).optional(),
});

export const ListProposalsSchema = z.object({
  status: z.enum(['active', 'executed', 'defeated', 'pending', 'canceled', 'queued', 'all']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Response types
export interface ProposalSummary {
  id: string;
  proposer: Address;
  title: string;
  status: string;
  forVotes: string;
  againstVotes: string;
  abstainVotes: string;
  startBlock: string;
  endBlock: string;
  createdAt?: string;
}

export interface ProposalDetail extends ProposalSummary {
  description: string;
  eta: string;
  canceled: boolean;
  executed: boolean;
  actions: {
    target: Address;
    value: string;
    signature: string;
    calldata: string;
  }[];
  quorum: string;
  totalVotes: string;
}

export interface VoteReceipt {
  proposalId: string;
  voter: Address;
  support: number;
  votes: string;
  reason?: string;
  txHash?: string;
}

export interface TreasuryStats {
  address: Address;
  ethBalance: string;
  ethBalanceFormatted: string;
  recentTransactions: {
    hash: string;
    from: Address;
    to: Address;
    value: string;
    timestamp: number;
    type: 'incoming' | 'outgoing';
  }[];
}

export interface MemberProfile {
  address: Address;
  anonsOwned: string[];
  votingPower: string;
  delegatedTo: Address;
  isERC8004Agent: boolean;
  proposalsCreated: string[];
  votingHistory: {
    proposalId: string;
    support: number;
    votes: string;
  }[];
}

// ERC-8128 Auth types (placeholder for auth middleware integration)
export interface ERC8128AuthContext {
  agentAddress: Address;
  agentId?: number;
  isVerifiedAgent: boolean;
  anonsBalance: number;
}

// API response wrapper
export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
