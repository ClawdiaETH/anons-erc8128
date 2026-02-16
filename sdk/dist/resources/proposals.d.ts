import type { HttpClient } from '../http.js';
import type { Proposal, CreateProposalParams, ListProposalsParams } from '../types.js';
export declare class Proposals {
    private http;
    constructor(http: HttpClient);
    /** Create a new proposal */
    create(params: CreateProposalParams): Promise<Proposal>;
    /** List proposals with optional filters */
    list(params?: ListProposalsParams): Promise<{
        proposals: Proposal[];
        total: number;
    }>;
    /** Get a single proposal by ID */
    get(proposalId: string): Promise<Proposal>;
    /** Cancel a proposal (must be the author) */
    cancel(proposalId: string): Promise<void>;
}
//# sourceMappingURL=proposals.d.ts.map