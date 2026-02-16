import type { HttpClient } from '../http.js'
import type { Webhook, WebhookConfig } from '../types.js'

export class Webhooks {
  constructor(private http: HttpClient) {}

  /** Register a webhook for proposal/vote events */
  async create(config: WebhookConfig): Promise<Webhook> {
    const res = await this.http.post<Webhook>('/webhooks', config)
    return res.data
  }

  /** List registered webhooks */
  async list(): Promise<Webhook[]> {
    const res = await this.http.get<Webhook[]>('/webhooks')
    return res.data
  }

  /** Delete a webhook */
  async delete(webhookId: string): Promise<void> {
    await this.http.delete(`/webhooks/${webhookId}`)
  }
}
