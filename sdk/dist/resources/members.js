export class Members {
    http;
    constructor(http) {
        this.http = http;
    }
    /** Get a member's profile */
    async getProfile(address) {
        const res = await this.http.get(`/members/${address}`);
        return res.data;
    }
}
//# sourceMappingURL=members.js.map