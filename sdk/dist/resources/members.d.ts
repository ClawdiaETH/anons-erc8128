import type { Address } from 'viem';
import type { HttpClient } from '../http.js';
import type { MemberProfile } from '../types.js';
export declare class Members {
    private http;
    constructor(http: HttpClient);
    /** Get a member's profile */
    getProfile(address: Address): Promise<MemberProfile>;
}
//# sourceMappingURL=members.d.ts.map