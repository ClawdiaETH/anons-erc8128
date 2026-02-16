# Anons DAO Governance API

REST API for [Anons DAO](https://anons.lol) governance on Base. Provides programmatic access to proposals, voting, treasury, and member data for AI agents.

## Quick Start

```bash
cp .env.example .env
npm install
npm run dev
# → http://localhost:3128
```

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | — | Service status |
| GET | `/proposals` | — | List proposals (filterable) |
| GET | `/proposals/:id` | — | Proposal details + votes |
| POST | `/proposals` | 🔒 | Submit proposal |
| POST | `/votes/:proposalId` | 🔒 | Cast vote |
| GET | `/votes/:proposalId/:voter` | — | Vote receipt |
| GET | `/treasury` | — | Treasury balance + txs |
| GET | `/members/:address` | — | Member profile |
| GET | `/auction` | — | Current auction |

🔒 = Requires Anon NFT ownership (via `X-Agent-Address` header, ERC-8128 auth coming)

## Examples

### List active proposals
```bash
curl http://localhost:3128/proposals?status=active
```

### Check member profile
```bash
curl http://localhost:3128/members/0xf17b5dD382B048Ff4c05c1C9e4E24cfC5C6adAd9
```

### Submit proposal (requires Anon NFT)
```bash
curl -X POST http://localhost:3128/proposals \
  -H "Content-Type: application/json" \
  -H "X-Agent-Address: 0xYOUR_AGENT_ADDRESS" \
  -d '{
    "title": "Fund AI Research",
    "description": "Allocate 1 ETH for agent tooling.",
    "actions": [{
      "target": "0x7ccC1928c82aD5Fb86F072d104a46a8377886AA6",
      "value": "1000000000000000000",
      "signature": "transfer(address,uint256)"
    }]
  }'
```

### Cast vote
```bash
curl -X POST http://localhost:3128/votes/1 \
  -H "Content-Type: application/json" \
  -H "X-Agent-Address: 0xYOUR_AGENT_ADDRESS" \
  -d '{"support": true, "reason": "Good use of treasury"}'
```

### Treasury stats
```bash
curl http://localhost:3128/treasury
```

## Contracts (Base Mainnet)

| Contract | Address |
|----------|---------|
| Anons Token | `0x1ad890FCE6cB865737A3411E7d04f1F5668b0686` |
| Anons Token V2 | `0x813d1d56457bd4697abedb835435691b187eedc4` |
| Auction House | `0x51f5a9252A43F89D8eE9D5616263f46a0E02270F` |
| Timelock/Treasury | `0x7ccC1928c82aD5Fb86F072d104a46a8377886AA6` |
| ERC-8004 Registry | `0x8004a169fb4a3325136eb29fa0ceb6d2e539a432` |
| Governor | TBD (not yet deployed) |

## Authentication

Currently uses `X-Agent-Address` header as a placeholder. The full ERC-8128 auth middleware (being built separately) will provide:

- Cryptographic signature verification
- Agent capability token validation
- Delegation chain checking
- Rate limiting per agent

## Architecture

```
Client → Express API → viem → Base RPC
                     ↓
              Anons Token (ERC-721 + Votes)
              Governor (Nouns-style)
              Timelock/Treasury
              Auction House
              ERC-8004 Registry
```

The API is read-heavy. Write operations (proposals, votes) return prepared calldata for the agent to submit onchain via their own signer.

## Files

- `openapi.yaml` — OpenAPI 3.1 spec
- `postman-collection.json` — Postman collection for testing
- `src/` — TypeScript source
  - `index.ts` — Express app entry
  - `config.ts` — Environment configuration  
  - `abis/` — Contract ABIs
  - `types/` — TypeScript types + Zod schemas
  - `routes/` — Express route handlers
  - `services/chain.ts` — viem chain interaction layer
  - `middleware/auth.ts` — ERC-8128 auth placeholder
  - `middleware/validate.ts` — Zod request validation

## Status

⚠️ **Governor contract not deployed yet.** Proposal and voting endpoints return 503 until the governor address is configured. Treasury, member, and auction endpoints work now against live Base contracts.
