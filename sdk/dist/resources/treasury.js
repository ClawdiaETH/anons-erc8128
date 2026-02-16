export class Treasury {
    http;
    constructor(http) {
        this.http = http;
    }
    /** Get treasury balance (ETH + tokens) */
    async getBalance() {
        const res = await this.http.get('/treasury/balance');
        return res.data;
    }
}
//# sourceMappingURL=treasury.js.map