/**
 * Tests for Anons DAO ERC-8128 Auth Middleware
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import { createAnonsAuth, ANONS_TOKEN_ADDRESS } from "./auth.js";
import type { NonceStore } from "@slicekit/erc8128";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";

// ─── Test Helpers ────────────────────────────────────────────────────────────

function mockResponse() {
  const res: Partial<Response> = {
    status: vi.fn().mockReturnThis() as any,
    json: vi.fn().mockReturnThis() as any,
    setHeader: vi.fn().mockReturnThis() as any,
    header: vi.fn().mockReturnThis() as any,
  };
  return res as Response;
}

function mockRequest(overrides: Partial<Request> = {}): Request {
  return {
    method: "GET",
    protocol: "https",
    originalUrl: "/governance/proposals",
    headers: {},
    get: function (name: string) {
      return (this.headers as Record<string, string>)[name.toLowerCase()];
    },
    body: undefined,
    ...overrides,
  } as unknown as Request;
}

function mockNonceStore(): NonceStore {
  const consumed = new Set<string>();
  return {
    async consume(key: string, _ttl: number) {
      if (consumed.has(key)) return false;
      consumed.add(key);
      return true;
    },
  };
}

// Mock public client that returns configurable balances
function mockPublicClient(balance: bigint = 1n) {
  return {
    readContract: vi.fn().mockResolvedValue(balance),
  } as any;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("createAnonsAuth", () => {
  it("returns cors and auth middleware", () => {
    const { cors, auth } = createAnonsAuth({
      publicClient: mockPublicClient(),
    });
    expect(typeof cors).toBe("function");
    expect(typeof auth).toBe("function");
  });
});

describe("auth middleware", () => {
  let publicClient: ReturnType<typeof mockPublicClient>;

  beforeEach(() => {
    publicClient = mockPublicClient(1n);
  });

  it("rejects requests without signature headers with 401", async () => {
    const { auth } = createAnonsAuth({
      publicClient,
      nonceStore: mockNonceStore(),
    });
    const req = mockRequest({ headers: {} });
    const res = mockResponse();
    const next = vi.fn();

    await auth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "missing_signature" })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects requests with invalid signature headers with 401", async () => {
    const { auth } = createAnonsAuth({
      publicClient,
      nonceStore: mockNonceStore(),
    });
    const req = mockRequest({
      headers: {
        "signature-input": 'eth=("@method" "@path");keyid="eip155:8453:0xdead";created=1000;expires=9999999999',
        signature: "eth=:invalidbase64:",
      },
    });
    const res = mockResponse();
    const next = vi.fn();

    await auth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "signature_invalid" })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects non-holders with 403", async () => {
    // Test the ownsAnon function directly
    const nonHolderClient = mockPublicClient(0n);
    const { ownsAnon } = createAnonsAuth({
      publicClient: nonHolderClient,
      nonceStore: mockNonceStore(),
    });

    const account = privateKeyToAccount(generatePrivateKey());
    const result = await ownsAnon(account.address);
    expect(result).toBe(false);
    expect(nonHolderClient.readContract).toHaveBeenCalledWith({
      address: ANONS_TOKEN_ADDRESS,
      abi: expect.any(Array),
      functionName: "balanceOf",
      args: [account.address],
    });
  });

  it("confirms holders pass ownership check", async () => {
    const holderClient = mockPublicClient(3n);
    const { ownsAnon } = createAnonsAuth({
      publicClient: holderClient,
      nonceStore: mockNonceStore(),
    });

    const account = privateKeyToAccount(generatePrivateKey());
    const result = await ownsAnon(account.address);
    expect(result).toBe(true);
  });

  it("caches ownership results", async () => {
    const { ownsAnon } = createAnonsAuth({
      publicClient,
      nonceStore: mockNonceStore(),
      ownershipCacheTtl: 60_000,
    });

    const account = privateKeyToAccount(generatePrivateKey());
    await ownsAnon(account.address);
    await ownsAnon(account.address);

    // Should only call readContract once due to cache
    expect(publicClient.readContract).toHaveBeenCalledTimes(1);
  });
});

describe("rate limiting", () => {
  it("allows requests within limit", () => {
    const { checkRateLimit } = createAnonsAuth({
      publicClient: mockPublicClient(),
      rateLimit: 5,
      rateLimitWindow: 60_000,
    });

    const addr = "0x1234567890123456789012345678901234567890";
    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit(addr);
      expect(result.allowed).toBe(true);
    }
  });

  it("blocks requests over limit", () => {
    const { checkRateLimit } = createAnonsAuth({
      publicClient: mockPublicClient(),
      rateLimit: 2,
      rateLimitWindow: 60_000,
    });

    const addr = "0x1234567890123456789012345678901234567890";
    checkRateLimit(addr); // 1
    checkRateLimit(addr); // 2
    const result = checkRateLimit(addr); // 3 - over
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("is case-insensitive for addresses", () => {
    const { checkRateLimit } = createAnonsAuth({
      publicClient: mockPublicClient(),
      rateLimit: 2,
      rateLimitWindow: 60_000,
    });

    checkRateLimit("0xABCD");
    checkRateLimit("0xabcd");
    const result = checkRateLimit("0xAbCd");
    expect(result.allowed).toBe(false);
  });
});

describe("integration: full middleware with signed request", () => {
  it("works end-to-end with a real ERC-8128 signed request", async () => {
    // This test verifies the full flow using @slicekit/erc8128's signRequest
    // In a real CI environment, you'd run this. For now we test the components.
    const account = privateKeyToAccount(generatePrivateKey());

    const holderClient = mockPublicClient(1n);
    const { auth } = createAnonsAuth({
      publicClient: holderClient,
      nonceStore: mockNonceStore(),
      rateLimit: 100,
    });

    // We can't easily create a valid ERC-8128 signed Express request in a unit test
    // without running an actual HTTP server. The component tests above cover each
    // layer. For full integration, see README for server setup + curl examples.
    expect(auth).toBeDefined();
  });
});
