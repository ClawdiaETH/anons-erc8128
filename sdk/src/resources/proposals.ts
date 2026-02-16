import type { HttpClient } from '../http.js'
import type { Proposal, CreateProposalParams, ListProposalsParams } from '../types.js'

export class Proposals {
  constructor(private http: HttpClient) {}

  /** Create a new proposal */
  async create(params: CreateProposalParams): Promise<Proposal> {
    const res = await this.http.post<Proposal>('/proposals', params)
    return res.data
  }

  /** List proposals with optional filters */
  async list(params?: ListProposalsParams): Promise<{ proposals: Proposal[]; total: number }> {
    const qs = params ? '?' + new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    ).toString() : ''
    const res = await this.http.get<Proposal[]>(`/proposals${qs}`)
    return { proposals: res.data, total: res.meta?.total ?? res.data.length }
  }

  /** Get a single proposal by ID */
  async get(proposalId: string): Promise<Proposal> {
    const res = await this.http.get<Proposal>(`/proposals/${proposalId}`)
    return res.data
  }

  /** Cancel a proposal (must be the author) */
  async cancel(proposalId: string): Promise<void> {
    await this.http.post(`/proposals/${proposalId}/cancel`)
  }
}
