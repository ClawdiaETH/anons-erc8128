import type { LocalAccount, Address } from 'viem';
/** Client configuration */
export interface AnonsClientConfig {
    /** viem LocalAccount (from privateKeyToAccount, mnemonicToAccount, etc.) */
    wallet: LocalAccount;
    /** Base URL of the Anons DAO API (default: https://api.anons.lol) */
    apiUrl?: string;
    /** Chain ID for ERC-8128 signing (default: 8453 = Base) */
    chainId?: number;
    /** Signature TTL in seconds (default: 60) */
    ttlSeconds?: number;
    /** Max retry attempts for rate-limited requests (default: 3) */
    maxRetries?: number;
}
export type ProposalStatus = 'draft' | 'active' | 'passed' | 'rejected' | 'executed' | 'cancelled';
export interface ProposalAction {
    /** Target contract address */
    target: Address;
    /** ETH value to send (in wei) */
    value?: string;
    /** Encoded calldata */
    calldata: string;
    /** Human-readable description of what this action does */
    description?: string;
}
export interface Proposal {
    id: string;
    title: string;
    description: string;
    author: Address;
    status: ProposalStatus;
    actions: ProposalAction[];
    votesFor: string;
    votesAgainst: string;
    votesAbstain: string;
    quorum: string;
    startTime: string;
    endTime: string;
    createdAt: string;
    updatedAt: string;
}
export interface CreateProposalParams {
    title: string;
    description: string;
    actions?: ProposalAction[];
}
export interface ListProposalsParams {
    status?: ProposalStatus;
    author?: Address;
    limit?: number;
    offset?: number;
}
export type VoteSupport = 'for' | 'against' | 'abstain';
export interface CastVoteParams {
    support: VoteSupport | boolean;
    reason?: string;
}
export interface Vote {
    voter: Address;
    proposalId: string;
    support: VoteSupport;
    weight: string;
    reason?: string;
    castAt: string;
}
export interface TreasuryBalance {
    address: Address;
    eth: string;
    tokens: TokenBalance[];
}
export interface TokenBalance {
    address: Address;
    symbol: string;
    name: string;
    decimals: number;
    balance: string;
}
export interface MemberProfile {
    address: Address;
    votingPower: string;
    delegatedTo?: Address;
    delegatedFrom: Address[];
    proposalsCreated: number;
    votesCast: number;
    joinedAt: string;
}
export type WebhookEvent = 'proposal.created' | 'proposal.active' | 'proposal.passed' | 'proposal.rejected' | 'proposal.executed' | 'vote.cast';
export interface WebhookConfig {
    url: string;
    events: WebhookEvent[];
    secret?: string;
}
export interface Webhook {
    id: string;
    url: string;
    events: WebhookEvent[];
    active: boolean;
    createdAt: string;
}
export interface ApiResponse<T> {
    data: T;
    meta?: {
        total?: number;
        limit?: number;
        offset?: number;
    };
}
export interface ApiError {
    code: string;
    message: string;
    details?: unknown;
}
//# sourceMappingURL=types.d.ts.map