export class Proposals {
    http;
    constructor(http) {
        this.http = http;
    }
    /** Create a new proposal */
    async create(params) {
        const res = await this.http.post('/proposals', params);
        return res.data;
    }
    /** List proposals with optional filters */
    async list(params) {
        const qs = params ? '?' + new URLSearchParams(Object.entries(params)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)])).toString() : '';
        const res = await this.http.get(`/proposals${qs}`);
        return { proposals: res.data, total: res.meta?.total ?? res.data.length };
    }
    /** Get a single proposal by ID */
    async get(proposalId) {
        const res = await this.http.get(`/proposals/${proposalId}`);
        return res.data;
    }
    /** Cancel a proposal (must be the author) */
    async cancel(proposalId) {
        await this.http.post(`/proposals/${proposalId}/cancel`);
    }
}
//# sourceMappingURL=proposals.js.map