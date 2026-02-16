import type { HttpClient } from '../http.js';
import type { Vote, CastVoteParams } from '../types.js';
export declare class Votes {
    private http;
    constructor(http: HttpClient);
    /** Cast a vote on a proposal */
    cast(proposalId: string, params: CastVoteParams): Promise<Vote>;
    /** Get all votes for a proposal */
    list(proposalId: string): Promise<Vote[]>;
}
//# sourceMappingURL=votes.d.ts.map