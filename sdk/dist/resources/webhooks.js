export class Webhooks {
    http;
    constructor(http) {
        this.http = http;
    }
    /** Register a webhook for proposal/vote events */
    async create(config) {
        const res = await this.http.post('/webhooks', config);
        return res.data;
    }
    /** List registered webhooks */
    async list() {
        const res = await this.http.get('/webhooks');
        return res.data;
    }
    /** Delete a webhook */
    async delete(webhookId) {
        await this.http.delete(`/webhooks/${webhookId}`);
    }
}
//# sourceMappingURL=webhooks.js.map