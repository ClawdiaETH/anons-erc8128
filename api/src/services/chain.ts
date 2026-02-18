import { createPublicClient, http, formatEther, type Address, type Log } from 'viem';
import { base } from 'viem/chains';
import { config } from '../config.js';
import { AnonsTokenABI, GovernorABI, AuctionHouseABI, TimelockABI, ERC8004RegistryABI } from '../abis/index.js';
import { ProposalState, ProposalStateLabel, type ProposalSummary, type ProposalDetail, type TreasuryStats, type MemberProfile, type VoteReceipt } from '../types/index.js';

const client = createPublicClient({
  chain: base,
  transport: http(config.rpcUrl),
});

export const chainService = {
  // ─── Token Queries ───────────────────────────────────────────

  async getAnonsBalance(address: Address): Promise<bigint> {
    return client.readContract({
      address: config.contracts.token,
      abi: AnonsTokenABI,
      functionName: 'balanceOf',
      args: [address],
    });
  },

  async getOwnedTokenIds(address: Address): Promise<string[]> {
    const balance = await this.getAnonsBalance(address);
    const ids: string[] = [];
    for (let i = 0n; i < balance; i++) {
      const tokenId = await client.readContract({
        address: config.contracts.token,
        abi: AnonsTokenABI,
        functionName: 'tokenOfOwnerByIndex',
        args: [address, i],
      });
      ids.push(tokenId.toString());
    }
    return ids;
  },

  async getVotingPower(address: Address): Promise<bigint> {
    return client.readContract({
      address: config.contracts.token,
      abi: AnonsTokenABI,
      functionName: 'getVotes',
      args: [address],
    });
  },

  async getDelegate(address: Address): Promise<Address> {
    return client.readContract({
      address: config.contracts.token,
      abi: AnonsTokenABI,
      functionName: 'delegates',
      args: [address],
    });
  },

  async getTotalSupply(): Promise<bigint> {
    return client.readContract({
      address: config.contracts.token,
      abi: AnonsTokenABI,
      functionName: 'totalSupply',
    });
  },

  // ─── ERC-8004 Registry ──────────────────────────────────────

  async isRegisteredAgent(address: Address): Promise<boolean> {
    try {
      return await client.readContract({
        address: config.contracts.erc8004Registry,
        abi: ERC8004RegistryABI,
        functionName: 'isRegistered',
        args: [address],
      });
    } catch {
      return false;
    }
  },

  // ─── Governor Queries ───────────────────────────────────────

  async getProposalCount(): Promise<bigint> {
    if (config.contracts.governor === '0x0000000000000000000000000000000000000000') {
      return 0n;
    }
    // OpenZeppelin Governor doesn't have proposalCount(), count events instead
    // Governor deployed at block 41930174 on Base (2026-02-09)
    const logs = await client.getLogs({
      address: config.contracts.governor,
      event: GovernorABI.find(e => e.type === 'event' && e.name === 'ProposalCreated') as any,
      fromBlock: 41930174n,
      toBlock: 'latest',
    });
    return BigInt(logs.length);
  },

  async getProposalState(proposalId: bigint): Promise<ProposalState> {
    return client.readContract({
      address: config.contracts.governor,
      abi: GovernorABI,
      functionName: 'state',
      args: [proposalId],
    }) as Promise<ProposalState>;
  },

  async getProposal(proposalId: bigint): Promise<ProposalDetail> {
    // Fetch ProposalCreated event for description and actions
    const logs = await client.getLogs({
      address: config.contracts.governor,
      event: GovernorABI.find(e => e.type === 'event' && e.name === 'ProposalCreated') as any,
      fromBlock: 41930174n,
      toBlock: 'latest',
    });

    const creationLog = logs.find((log: any) => {
      const id = (log as any).args?.proposalId || (log as any).args?.id;
      return id?.toString() === proposalId.toString();
    });
    
    if (!creationLog) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    const args = (creationLog as any).args;
    const description = args?.description || '';
    const targets = args?.targets || [];
    const values = args?.values || [];
    const signatures = args?.signatures || [];
    const calldatas = args?.calldatas || [];
    const proposer = args?.proposer || '0x0000000000000000000000000000000000000000';
    const startBlock = args?.voteStart || args?.startBlock || 0n;
    const endBlock = args?.voteEnd || args?.endBlock || 0n;

    // Parse title from description (first line)
    const title = description.split('\n')[0]?.replace(/^#\s*/, '') || `Proposal ${proposalId}`;

    const actions = targets.map((target: Address, i: number) => ({
      target,
      value: values[i]?.toString() || '0',
      signature: signatures[i] || '',
      calldata: calldatas[i] || '0x',
    }));

    // Get current state and vote counts
    const [state, proposalVotes] = await Promise.all([
      this.getProposalState(proposalId),
      client.readContract({
        address: config.contracts.governor,
        abi: GovernorABI,
        functionName: 'proposalVotes',
        args: [proposalId],
      }).catch(() => [0n, 0n, 0n]),
    ]);

    const [againstVotes, forVotes, abstainVotes] = proposalVotes as [bigint, bigint, bigint];

    return {
      id: proposalId.toString(),
      proposer,
      title,
      description,
      status: ProposalStateLabel[state] || 'unknown',
      eta: '0', // TODO: fetch proposalEta
      startBlock: startBlock.toString(),
      endBlock: endBlock.toString(),
      forVotes: forVotes.toString(),
      againstVotes: againstVotes.toString(),
      abstainVotes: abstainVotes.toString(),
      canceled: state === ProposalState.Canceled,
      executed: state === ProposalState.Executed,
      actions,
      quorum: '0', // TODO: fetch from governor
      totalVotes: (forVotes + againstVotes + abstainVotes).toString(),
    };
  },

  async listProposals(status: string, page: number, limit: number): Promise<{ proposals: ProposalSummary[]; total: number }> {
    if (config.contracts.governor === '0x0000000000000000000000000000000000000000') {
      return { proposals: [], total: 0 };
    }

    // Fetch all ProposalCreated events
    const logs = await client.getLogs({
      address: config.contracts.governor,
      event: GovernorABI.find(e => e.type === 'event' && e.name === 'ProposalCreated') as any,
      fromBlock: 41930174n,
      toBlock: 'latest',
    });

    if (logs.length === 0) return { proposals: [], total: 0 };

    const all: ProposalSummary[] = [];
    
    for (const log of logs) {
      try {
        const proposalId = (log as any).args?.proposalId || (log as any).args?.id;
        if (!proposalId) continue;
        
        const proposal = await this.getProposal(proposalId);
        if (status === 'all' || proposal.status === status) {
          all.push({
            id: proposal.id,
            proposer: proposal.proposer,
            title: proposal.title,
            status: proposal.status,
            forVotes: proposal.forVotes,
            againstVotes: proposal.againstVotes,
            abstainVotes: proposal.abstainVotes,
            startBlock: proposal.startBlock,
            endBlock: proposal.endBlock,
          });
        }
      } catch {
        // Skip invalid proposals
      }
    }

    const start = (page - 1) * limit;
    return {
      proposals: all.slice(start, start + limit),
      total: all.length,
    };
  },

  async getVoteReceipt(proposalId: bigint, voter: Address): Promise<VoteReceipt | null> {
    try {
      const hasVoted = await client.readContract({
        address: config.contracts.governor,
        abi: GovernorABI,
        functionName: 'hasVoted',
        args: [proposalId, voter],
      });
      if (!hasVoted) return null;
      
      // Note: OpenZeppelin Governor doesn't expose individual vote weights/support
      // Would need to parse VoteCast events to get this data
      return {
        proposalId: proposalId.toString(),
        voter,
        support: 0, // Unknown without parsing events
        votes: '0', // Unknown without parsing events
      };
    } catch {
      return null;
    }
  },

  // ─── Treasury ────────────────────────────────────────────────

  async getTreasuryStats(): Promise<TreasuryStats> {
    // Check Governor's WETH balance (WETH = 0x4200000000000000000000000000000000000006 on Base)
    const WETH_ADDRESS = '0x4200000000000000000000000000000000000006' as Address;
    const balance = await client.readContract({
      address: WETH_ADDRESS,
      abi: [{
        inputs: [{ name: 'owner', type: 'address' }],
        name: 'balanceOf',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      }],
      functionName: 'balanceOf',
      args: [config.contracts.governor],
    });

    // Get recent auction settlements as proxy for treasury transactions
    let recentTxs: TreasuryStats['recentTransactions'] = [];
    try {
      const logs = await client.getLogs({
        address: config.contracts.auctionHouse,
        event: AuctionHouseABI.find(e => e.type === 'event' && e.name === 'AuctionSettled') as any,
        fromBlock: BigInt(Math.max(0, Number(await client.getBlockNumber()) - 100000)),
        toBlock: 'latest',
      });

      recentTxs = logs.slice(-10).map((log: any) => ({
        hash: log.transactionHash,
        from: log.args?.winner || '0x0000000000000000000000000000000000000000',
        to: config.contracts.timelock,
        value: formatEther(log.args?.amount || 0n),
        timestamp: 0,
        type: 'incoming' as const,
      }));
    } catch {
      // Auction logs may not be available
    }

    return {
      address: config.contracts.governor,
      ethBalance: balance.toString(),
      ethBalanceFormatted: formatEther(balance),
      recentTransactions: recentTxs,
    };
  },

  // ─── Members ─────────────────────────────────────────────────

  async getMemberProfile(address: Address): Promise<MemberProfile> {
    const [anonsOwned, votingPower, delegatedTo, isAgent] = await Promise.all([
      this.getOwnedTokenIds(address),
      this.getVotingPower(address),
      this.getDelegate(address),
      this.isRegisteredAgent(address),
    ]);

    // Get voting history from VoteCast events
    let votingHistory: MemberProfile['votingHistory'] = [];
    let proposalsCreated: string[] = [];

    if (config.contracts.governor !== '0x0000000000000000000000000000000000000000') {
      try {
        const voteLogs = await client.getLogs({
          address: config.contracts.governor,
          event: GovernorABI.find(e => e.type === 'event' && e.name === 'VoteCast') as any,
          args: { voter: address },
          fromBlock: 41930174n,
          toBlock: 'latest',
        });

        votingHistory = voteLogs.map((log: any) => ({
          proposalId: log.args?.proposalId?.toString() || '0',
          support: log.args?.support || 0,
          votes: log.args?.votes?.toString() || '0',
        }));
      } catch { /* no governor */ }

      try {
        const proposalLogs = await client.getLogs({
          address: config.contracts.governor,
          event: GovernorABI.find(e => e.type === 'event' && e.name === 'ProposalCreated') as any,
          fromBlock: 41930174n,
          toBlock: 'latest',
        });

        proposalsCreated = proposalLogs
          .filter((log: any) => log.args?.proposer?.toLowerCase() === address.toLowerCase())
          .map((log: any) => log.args?.id?.toString() || '0');
      } catch { /* no governor */ }
    }

    return {
      address,
      anonsOwned,
      votingPower: votingPower.toString(),
      delegatedTo,
      isERC8004Agent: isAgent,
      proposalsCreated,
      votingHistory,
    };
  },

  // ─── Auction ─────────────────────────────────────────────────

  async getCurrentAuction() {
    try {
      const auction = await client.readContract({
        address: config.contracts.auctionHouse,
        abi: AuctionHouseABI,
        functionName: 'auction',
      });
      const [nounId, amount, startTime, endTime, bidder, settled] = auction as any;
      return {
        tokenId: nounId.toString(),
        amount: formatEther(amount),
        startTime: Number(startTime),
        endTime: Number(endTime),
        bidder,
        settled,
      };
    } catch {
      return null;
    }
  },
};
