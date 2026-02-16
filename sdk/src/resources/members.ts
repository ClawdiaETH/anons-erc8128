import type { Address } from 'viem'
import type { HttpClient } from '../http.js'
import type { MemberProfile } from '../types.js'

export class Members {
  constructor(private http: HttpClient) {}

  /** Get a member's profile */
  async getProfile(address: Address): Promise<MemberProfile> {
    const res = await this.http.get<MemberProfile>(`/members/${address}`)
    return res.data
  }
}
