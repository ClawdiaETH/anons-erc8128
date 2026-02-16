// ── Agent-Side SIWA Client for Anons DAO ────────────────────────────────────
//
// Usage example for an agent authenticating with the Anons governance API.
//
import { signSIWAMessage } from "@buildersgarden/siwa";
import { signAuthenticatedRequest } from "@buildersgarden/siwa/erc8128";
import { createLocalAccountSigner } from "@buildersgarden/siwa/signer";
import { privateKeyToAccount } from "viem/accounts";
import {
  API_DOMAIN,
  API_URI,
  AGENT_REGISTRY_CAIP,
  CHAIN_ID,
} from "./config.js";

export interface AnonsAgentConfig {
  /** Agent private key (hex) */
  privateKey: `0x${string}`;
  /** ERC-8004 agent ID */
  agentId: number;
  /** API base URL */
  apiUrl?: string;
}

export class AnonsAgentClient {
  private signer;
  private account;
  private agentId: number;
  private apiUrl: string;
  private sessionToken: string | null = null;
  private receipt: string | null = null;

  constructor(config: AnonsAgentConfig) {
    this.account = privateKeyToAccount(config.privateKey);
    this.signer = createLocalAccountSigner(this.account);
    this.agentId = config.agentId;
    this.apiUrl = config.apiUrl ?? `https://${API_DOMAIN}`;
  }

  /** Full SIWA authentication flow: nonce → sign → verify → session */
  async authenticate(): Promise<{
    token: string;
    isHolder: boolean;
    isDelegated: boolean;
  }> {
    // Step 1: Request nonce
    const nonceRes = await fetch(`${this.apiUrl}/siwa/nonce`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: this.account.address,
        agentId: this.agentId,
        agentRegistry: AGENT_REGISTRY_CAIP,
      }),
    });

    if (!nonceRes.ok) {
      throw new Error(`Nonce request failed: ${await nonceRes.text()}`);
    }

    const { nonce, issuedAt, expirationTime } = await nonceRes.json();

    // Step 2: Sign SIWA message
    const { message, signature } = await signSIWAMessage(
      {
        domain: API_DOMAIN,
        uri: API_URI,
        agentId: this.agentId,
        agentRegistry: AGENT_REGISTRY_CAIP,
        chainId: CHAIN_ID,
        nonce,
        issuedAt,
        expirationTime,
      },
      this.signer
    );

    // Step 3: Verify with server
    const verifyRes = await fetch(`${this.apiUrl}/siwa/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, signature }),
    });

    if (!verifyRes.ok) {
      throw new Error(`Verification failed: ${await verifyRes.text()}`);
    }

    const data = await verifyRes.json();
    this.sessionToken = data.token;
    this.receipt = data.receipt;

    return {
      token: data.token,
      isHolder: data.isHolder,
      isDelegated: data.isDelegated,
    };
  }

  /** Make an authenticated API request using JWT session */
  async request(path: string, options: RequestInit = {}): Promise<Response> {
    if (!this.sessionToken) {
      await this.authenticate();
    }

    return fetch(`${this.apiUrl}${path}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${this.sessionToken}`,
        "Content-Type": "application/json",
      },
    });
  }

  /** Make an ERC-8128 signed request (for high-security endpoints) */
  async signedRequest(
    path: string,
    options: RequestInit = {}
  ): Promise<Response> {
    if (!this.receipt) {
      await this.authenticate();
    }

    const req = new Request(`${this.apiUrl}${path}`, {
      ...options,
      headers: {
        ...options.headers,
        "Content-Type": "application/json",
      },
    });

    const signedReq = await signAuthenticatedRequest(
      req,
      this.receipt!,
      this.signer,
      CHAIN_ID
    );

    return fetch(signedReq);
  }

  /** Get member profile */
  async getProfile() {
    const res = await this.request("/member/profile");
    return res.json();
  }

  /** Create proposal (holder-only) */
  async createProposal(title: string, description: string) {
    const res = await this.request("/member/proposals", {
      method: "POST",
      body: JSON.stringify({ title, description }),
    });
    return res.json();
  }

  get address() {
    return this.account.address;
  }

  get isAuthenticated() {
    return !!this.sessionToken;
  }
}
