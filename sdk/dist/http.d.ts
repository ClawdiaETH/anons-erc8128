import type { AnonsClientConfig, ApiResponse } from './types.js';
/** Configured HTTP client that auto-signs all requests with ERC-8128 */
export declare class HttpClient {
    private signerClient;
    private baseUrl;
    private maxRetries;
    constructor(config: AnonsClientConfig);
    request<T>(method: string, path: string, body?: unknown): Promise<ApiResponse<T>>;
    get<T>(path: string): Promise<ApiResponse<T>>;
    post<T>(path: string, body?: unknown): Promise<ApiResponse<T>>;
    put<T>(path: string, body?: unknown): Promise<ApiResponse<T>>;
    delete<T>(path: string): Promise<ApiResponse<T>>;
}
//# sourceMappingURL=http.d.ts.map