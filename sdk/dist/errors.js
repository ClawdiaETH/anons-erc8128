/** Base error for all Anons SDK errors */
export class AnonsError extends Error {
    code;
    status;
    details;
    constructor(message, code, status, details) {
        super(message);
        this.code = code;
        this.status = status;
        this.details = details;
        this.name = 'AnonsError';
    }
}
/** API returned an error response */
export class ApiError extends AnonsError {
    constructor(message, code, status, details) {
        super(message, code, status, details);
        this.name = 'ApiError';
    }
}
/** Rate limited — SDK handles retries automatically */
export class RateLimitError extends AnonsError {
    retryAfter;
    constructor(retryAfter) {
        super(`Rate limited. Retry after ${retryAfter}s`, 'RATE_LIMITED', 429);
        this.retryAfter = retryAfter;
        this.name = 'RateLimitError';
    }
}
/** ERC-8128 signing failed */
export class SigningError extends AnonsError {
    constructor(message, details) {
        super(message, 'SIGNING_FAILED', undefined, details);
        this.name = 'SigningError';
    }
}
//# sourceMappingURL=errors.js.map