import type { HttpClient } from '../http.js';
import type { TreasuryBalance } from '../types.js';
export declare class Treasury {
    private http;
    constructor(http: HttpClient);
    /** Get treasury balance (ETH + tokens) */
    getBalance(): Promise<TreasuryBalance>;
}
//# sourceMappingURL=treasury.d.ts.map