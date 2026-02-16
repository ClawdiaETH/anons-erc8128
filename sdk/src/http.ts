import { createSignerClient, type EthHttpSigner } from '@slicekit/erc8128'
import type { Account } from 'viem'
import type { AnonsClientConfig, ApiResponse } from './types.js'
import { ApiError, RateLimitError, SigningError } from './errors.js'

/** Configured HTTP client that auto-signs all requests with ERC-8128 */
export class HttpClient {
  private signerClient: ReturnType<typeof createSignerClient>
  private baseUrl: string
  private maxRetries: number

  constructor(config: AnonsClientConfig) {
    const { wallet, apiUrl = 'https://api.anons.lol', chainId = 8453, ttlSeconds = 60, maxRetries = 3 } = config
    this.baseUrl = apiUrl.replace(/\/$/, '')
    this.maxRetries = maxRetries

    const signer: EthHttpSigner = {
      chainId,
      address: wallet.address,
      signMessage: async (message: Uint8Array) => {
        try {
          return await wallet.signMessage({ message: { raw: message } })
        } catch (err) {
          throw new SigningError('Failed to sign request', err)
        }
      },
    }

    this.signerClient = createSignerClient(signer, { ttlSeconds })
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${path}`
    const init: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    }

    let lastError: Error | undefined
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.signerClient.fetch(url, init)

        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('retry-after') || '1', 10)
          if (attempt < this.maxRetries) {
            const delay = retryAfter * 1000 * Math.pow(2, attempt)
            await sleep(delay)
            continue
          }
          throw new RateLimitError(retryAfter)
        }

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({})) as Record<string, unknown>
          throw new ApiError(
            (errorBody.message as string) || `Request failed: ${response.status}`,
            (errorBody.code as string) || 'API_ERROR',
            response.status,
            errorBody.details
          )
        }

        // 204 No Content
        if (response.status === 204) {
          return { data: undefined as T }
        }

        return await response.json() as ApiResponse<T>
      } catch (err) {
        if (err instanceof ApiError || err instanceof RateLimitError) throw err
        lastError = err as Error
        if (attempt < this.maxRetries) {
          await sleep(1000 * Math.pow(2, attempt))
          continue
        }
      }
    }

    throw lastError || new Error('Request failed after retries')
  }

  get<T>(path: string) { return this.request<T>('GET', path) }
  post<T>(path: string, body?: unknown) { return this.request<T>('POST', path, body) }
  put<T>(path: string, body?: unknown) { return this.request<T>('PUT', path, body) }
  delete<T>(path: string) { return this.request<T>('DELETE', path) }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
