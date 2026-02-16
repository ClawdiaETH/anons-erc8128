/** Base error for all Anons SDK errors */
export class AnonsError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status?: number,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = 'AnonsError'
  }
}

/** API returned an error response */
export class ApiError extends AnonsError {
  constructor(message: string, code: string, status: number, details?: unknown) {
    super(message, code, status, details)
    this.name = 'ApiError'
  }
}

/** Rate limited — SDK handles retries automatically */
export class RateLimitError extends AnonsError {
  constructor(
    public readonly retryAfter: number
  ) {
    super(`Rate limited. Retry after ${retryAfter}s`, 'RATE_LIMITED', 429)
    this.name = 'RateLimitError'
  }
}

/** ERC-8128 signing failed */
export class SigningError extends AnonsError {
  constructor(message: string, details?: unknown) {
    super(message, 'SIGNING_FAILED', undefined, details)
    this.name = 'SigningError'
  }
}
