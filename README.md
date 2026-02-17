# Anons DAO ERC-8128 Governance API Middleware

Authentication middleware for [Anons DAO](https://anons.lol) governance endpoints using [ERC-8128](https://erc8128.slice.so) signed HTTP requests.

**Only Anon NFT holders on Base can access governance endpoints.** No API keys, no JWTs — just sign requests with an Ethereum wallet that holds an Anon.

## How It Works

1. **ERC-8128 Verification** — Validates cryptographic signature on the HTTP request (method, path, query, body integrity)
2. **NFT Gate** — Checks `balanceOf` on the Anons token contract (`0x1ad890FCE6cB865737A3411E7d04f1F5668b0686`) on Base
3. **Rate Limiting** — Per-wallet sliding window (default: 60 req/min)
4. **CORS** — Configured for browser and agent clients

## Install

```bash
npm install @slicekit/erc8128 viem express cors
```

## Usage

### Server Setup

```typescript
import express from 'express'
import { createAnonsAuth } from './middleware/auth.js'

const app = express()
app.use(express.json())

const { cors, auth } = createAnonsAuth({
  rpcUrl: 'https://mainnet.base.org',
  rateLimit: 60,           // requests per window
  rateLimitWindow: 60_000, // 1 minute
  corsOrigins: '*',
})

// Apply CORS to all routes
app.use(cors)

// Protected governance endpoints
app.get('/governance/proposals', auth, (req, res) => {
  const { wallet, chainId } = req as any
  res.json({ wallet, proposals: [] })
})

app.post('/governance/vote', auth, (req, res) => {
  const { wallet } = req as any
  const { proposalId, support } = req.body
  res.json({ wallet, proposalId, support, status: 'submitted' })
})

// Public endpoints (no auth)
app.get('/health', (req, res) => res.json({ ok: true }))

app.listen(3000, () => console.log('Anons governance API on :3000'))
```

### Client: Signing Requests

```typescript
import { createSignerClient } from '@slicekit/erc8128'
import type { EthHttpSigner } from '@slicekit/erc8128'
import { privateKeyToAccount } from 'viem/accounts'

const account = privateKeyToAccount('0x...')

const signer: EthHttpSigner = {
  chainId: 8453, // Base
  address: account.address,
  signMessage: async (message) =>
    account.signMessage({ message: { raw: message } }),
}

const client = createSignerClient(signer)

// GET proposals
const proposals = await client.fetch('http://localhost:3000/governance/proposals')
console.log(await proposals.json())

// POST vote
const vote = await client.fetch('http://localhost:3000/governance/vote', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ proposalId: 42, support: true }),
})
console.log(await vote.json())
```

### AI Agent Client

```typescript
// Any agent with access to an Ethereum wallet can authenticate
import { createSignerClient } from '@slicekit/erc8128'

// Agent creates signer from its managed wallet
const agentSigner = {
  chainId: 8453,
  address: agentWalletAddress,
  signMessage: async (msg: Uint8Array) => agentWallet.signMessage({ message: { raw: msg } }),
}

const api = createSignerClient(agentSigner)

// Agent can now call governance endpoints
const res = await api.fetch('https://api.anons.lol/governance/proposals')
```

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `rpcUrl` | `https://mainnet.base.org` | Base RPC endpoint |
| `tokenAddress` | `0x1ad890FCE6cB865737A3411E7d04f1F5668b0686` | Anons NFT contract (v2) |
| `rateLimit` | `60` | Max requests per wallet per window |
| `rateLimitWindow` | `60000` | Window in milliseconds |
| `corsOrigins` | `"*"` | CORS allowed origins |
| `ownershipCacheTtl` | `30000` | Cache NFT checks for 30s |
| `verifyPolicy` | strict defaults | ERC-8128 verification policy |
| `nonceStore` | in-memory Map | Redis recommended for production |
| `publicClient` | auto-created | Shared viem client |

## Production Notes

### Redis Nonce Store

The in-memory nonce store works for single-instance deployments. For production, use Redis:

```typescript
import type { NonceStore } from '@slicekit/erc8128'
import { Redis } from 'ioredis'

const redis = new Redis()

const nonceStore: NonceStore = {
  async consume(key: string, ttlSeconds: number) {
    const result = await redis.set(`nonce:${key}`, '1', 'EX', ttlSeconds, 'NX')
    return result === 'OK'
  },
}

const { cors, auth } = createAnonsAuth({ nonceStore })
```

### Response Headers

The middleware sets these headers on every authenticated response:

- `X-RateLimit-Limit` — Max requests per window
- `X-RateLimit-Remaining` — Remaining requests
- `X-RateLimit-Reset` — Unix timestamp when window resets
- `Accept-Signature` — Required signature components (set by ERC-8128)

### Error Responses

| Status | Error | When |
|--------|-------|------|
| 401 | `missing_signature` | No `Signature-Input` header |
| 401 | `signature_invalid` | Signature verification failed |
| 403 | `not_holder` | Wallet doesn't hold an Anon NFT |
| 429 | `rate_limited` | Too many requests from wallet |

## Testing

```bash
npm test
```

## References

- [ERC-8128 Specification](https://erc8128.slice.so)
- [Anons DAO](https://anons.lol)
- [Anons Token on Base](https://basescan.org/token/0x1ad890FCE6cB865737A3411E7d04f1F5668b0686)
