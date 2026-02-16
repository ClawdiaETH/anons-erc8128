import type { AnonsClientConfig } from './types.js';
import { Proposals } from './resources/proposals.js';
import { Votes } from './resources/votes.js';
import { Treasury } from './resources/treasury.js';
import { Members } from './resources/members.js';
import { Webhooks } from './resources/webhooks.js';
/**
 * Anons DAO governance client.
 *
 * All requests are automatically signed with ERC-8128 using the provided wallet.
 *
 * @example
 * ```ts
 * import { AnonsClient } from '@anons/sdk'
 * import { privateKeyToAccount } from 'viem/accounts'
 *
 * const client = new AnonsClient({
 *   wallet: privateKeyToAccount('0x...'),
 * })
 *
 * const proposals = await client.proposals.list({ status: 'active' })
 * ```
 */
export declare class AnonsClient {
    readonly proposals: Proposals;
    readonly votes: Votes;
    readonly treasury: Treasury;
    readonly members: Members;
    readonly webhooks: Webhooks;
    constructor(config: AnonsClientConfig);
}
//# sourceMappingURL=client.d.ts.map