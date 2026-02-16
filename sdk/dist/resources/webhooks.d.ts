import type { HttpClient } from '../http.js';
import type { Webhook, WebhookConfig } from '../types.js';
export declare class Webhooks {
    private http;
    constructor(http: HttpClient);
    /** Register a webhook for proposal/vote events */
    create(config: WebhookConfig): Promise<Webhook>;
    /** List registered webhooks */
    list(): Promise<Webhook[]>;
    /** Delete a webhook */
    delete(webhookId: string): Promise<void>;
}
//# sourceMappingURL=webhooks.d.ts.map