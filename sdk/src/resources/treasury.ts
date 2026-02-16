import type { HttpClient } from '../http.js'
import type { TreasuryBalance } from '../types.js'

export class Treasury {
  constructor(private http: HttpClient) {}

  /** Get treasury balance (ETH + tokens) */
  async getBalance(): Promise<TreasuryBalance> {
    const res = await this.http.get<TreasuryBalance>('/treasury/balance')
    return res.data
  }
}
