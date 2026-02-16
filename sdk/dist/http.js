import { createSignerClient } from '@slicekit/erc8128';
import { ApiError, RateLimitError, SigningError } from './errors.js';
/** Configured HTTP client that auto-signs all requests with ERC-8128 */
export class HttpClient {
    signerClient;
    baseUrl;
    maxRetries;
    constructor(config) {
        const { wallet, apiUrl = 'https://api.anons.lol', chainId = 8453, ttlSeconds = 60, maxRetries = 3 } = config;
        this.baseUrl = apiUrl.replace(/\/$/, '');
        this.maxRetries = maxRetries;
        const signer = {
            chainId,
            address: wallet.address,
            signMessage: async (message) => {
                try {
                    return await wallet.signMessage({ message: { raw: message } });
                }
                catch (err) {
                    throw new SigningError('Failed to sign request', err);
                }
            },
        };
        this.signerClient = createSignerClient(signer, { ttlSeconds });
    }
    async request(method, path, body) {
        const url = `${this.baseUrl}${path}`;
        const init = {
            method,
            headers: { 'Content-Type': 'application/json' },
            ...(body !== undefined && { body: JSON.stringify(body) }),
        };
        let lastError;
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                const response = await this.signerClient.fetch(url, init);
                if (response.status === 429) {
                    const retryAfter = parseInt(response.headers.get('retry-after') || '1', 10);
                    if (attempt < this.maxRetries) {
                        const delay = retryAfter * 1000 * Math.pow(2, attempt);
                        await sleep(delay);
                        continue;
                    }
                    throw new RateLimitError(retryAfter);
                }
                if (!response.ok) {
                    const errorBody = await response.json().catch(() => ({}));
                    throw new ApiError(errorBody.message || `Request failed: ${response.status}`, errorBody.code || 'API_ERROR', response.status, errorBody.details);
                }
                // 204 No Content
                if (response.status === 204) {
                    return { data: undefined };
                }
                return await response.json();
            }
            catch (err) {
                if (err instanceof ApiError || err instanceof RateLimitError)
                    throw err;
                lastError = err;
                if (attempt < this.maxRetries) {
                    await sleep(1000 * Math.pow(2, attempt));
                    continue;
                }
            }
        }
        throw lastError || new Error('Request failed after retries');
    }
    get(path) { return this.request('GET', path); }
    post(path, body) { return this.request('POST', path, body); }
    put(path, body) { return this.request('PUT', path, body); }
    delete(path) { return this.request('DELETE', path); }
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
//# sourceMappingURL=http.js.map