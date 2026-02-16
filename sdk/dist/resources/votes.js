export class Votes {
    http;
    constructor(http) {
        this.http = http;
    }
    /** Cast a vote on a proposal */
    async cast(proposalId, params) {
        const support = typeof params.support === 'boolean'
            ? params.support ? 'for' : 'against'
            : params.support;
        const res = await this.http.post(`/proposals/${proposalId}/votes`, {
            support,
            reason: params.reason,
        });
        return res.data;
    }
    /** Get all votes for a proposal */
    async list(proposalId) {
        const res = await this.http.get(`/proposals/${proposalId}/votes`);
        return res.data;
    }
}
//# sourceMappingURL=votes.js.map