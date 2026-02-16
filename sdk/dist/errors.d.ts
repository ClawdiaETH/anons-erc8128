/** Base error for all Anons SDK errors */
export declare class AnonsError extends Error {
    readonly code: string;
    readonly status?: number | undefined;
    readonly details?: unknown | undefined;
    constructor(message: string, code: string, status?: number | undefined, details?: unknown | undefined);
}
/** API returned an error response */
export declare class ApiError extends AnonsError {
    constructor(message: string, code: string, status: number, details?: unknown);
}
/** Rate limited — SDK handles retries automatically */
export declare class RateLimitError extends AnonsError {
    readonly retryAfter: number;
    constructor(retryAfter: number);
}
/** ERC-8128 signing failed */
export declare class SigningError extends AnonsError {
    constructor(message: string, details?: unknown);
}
//# sourceMappingURL=errors.d.ts.map