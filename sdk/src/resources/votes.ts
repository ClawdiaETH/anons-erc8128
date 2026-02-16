import type { HttpClient } from '../http.js'
import type { Vote, CastVoteParams, VoteSupport } from '../types.js'

export class Votes {
  constructor(private http: HttpClient) {}

  /** Cast a vote on a proposal */
  async cast(proposalId: string, params: CastVoteParams): Promise<Vote> {
    const support: VoteSupport =
      typeof params.support === 'boolean'
        ? params.support ? 'for' : 'against'
        : params.support
    const res = await this.http.post<Vote>(`/proposals/${proposalId}/votes`, {
      support,
      reason: params.reason,
    })
    return res.data
  }

  /** Get all votes for a proposal */
  async list(proposalId: string): Promise<Vote[]> {
    const res = await this.http.get<Vote[]>(`/proposals/${proposalId}/votes`)
    return res.data
  }
}
