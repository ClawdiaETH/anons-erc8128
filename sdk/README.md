# @anons/sdk

TypeScript SDK for agents to interact with **Anons DAO** governance API. All requests are automatically signed with [ERC-8128](https://erc8128.slice.so) — no API keys needed, just an Ethereum wallet.

## Install

```bash
npm install @anons/sdk viem
# or
bun add @anons/sdk viem
```

## Quick Start

```typescript
import { AnonsClient } from '@anons/sdk'
import { privateKeyToAccount } from 'viem/accounts'

const client = new AnonsClient({
  wallet: privateKeyToAccount('0x...'),
  apiUrl: 'https://api.anons.lol', // default
  chainId: 8453,                    // default (Base)
})

// List active proposals
const { proposals } = await client.proposals.list({ status: 'active' })

// Create a proposal
const proposal = await client.proposals.create({
  title: 'Fund community grants',
  description: 'Allocate 10 ETH for Q2 community grants program.',
  actions: [{
    target: '0x...',
    value: '10000000000000000000',
    calldata: '0x',
  }],
})

// Vote
await client.votes.cast(proposal.id, { support: true, reason: 'LFG' })
// support accepts: true/false or 'for'/'against'/'abstain'

// Treasury
const balance = await client.treasury.getBalance()
console.log(`Treasury: ${balance.eth} ETH`)

// Member profiles
const profile = await client.members.getProfile('0x...')
```

## OpenClaw Agent Example

```typescript
// In your OpenClaw agent skill
import { AnonsClient } from '@anons/sdk'
import { privateKeyToAccount } from 'viem/accounts'

const client = new AnonsClient({
  wallet: privateKeyToAccount(process.env.AGENT_PRIVATE_KEY!),
})

// Agent auto-votes on proposals matching criteria
async function autoVote() {
  const { proposals } = await client.proposals.list({ status: 'active' })
  for (const p of proposals) {
    if (p.title.toLowerCase().includes('community')) {
      await client.votes.cast(p.id, {
        support: 'for',
        reason: 'Community-aligned proposal — auto-approved by agent',
      })
    }
  }
}
```

## Webhooks

Subscribe to real-time proposal and vote events:

```typescript
await client.webhooks.create({
  url: 'https://your-agent.com/webhook',
  events: ['proposal.created', 'vote.cast'],
  secret: 'your-hmac-secret', // optional, for verifying webhook payloads
})
```

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `wallet` | *required* | viem Account for signing |
| `apiUrl` | `https://api.anons.lol` | API base URL |
| `chainId` | `8453` | Chain ID for ERC-8128 signatures |
| `ttlSeconds` | `60` | Signature validity window |
| `maxRetries` | `3` | Max retries on rate limit (exponential backoff) |

## Error Handling

```typescript
import { ApiError, RateLimitError, SigningError } from '@anons/sdk'

try {
  await client.proposals.get('nonexistent')
} catch (err) {
  if (err instanceof ApiError) {
    console.log(err.code, err.status, err.message)
  }
}
```

All errors extend `AnonsError` with `code`, `status`, and `details` properties.

## How It Works

Every request is signed with [ERC-8128 HTTP Message Signatures](https://erc8128.slice.so). The SDK:

1. Creates an ERC-8128 signer from your viem wallet
2. Signs every HTTP request (method, path, body digest)
3. Server verifies the signature → authenticates your Ethereum address
4. No API keys, no sessions, no passwords

## License

MIT
