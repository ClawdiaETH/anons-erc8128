// Anons ERC-721 Token (Nouns fork)
export const AnonsTokenABI = [
  { type: 'function', name: 'name', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' },
  { type: 'function', name: 'totalSupply', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'balanceOf', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'ownerOf', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'tokenOfOwnerByIndex', inputs: [{ name: 'owner', type: 'address' }, { name: 'index', type: 'uint256' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'delegates', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'getVotes', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'getPastVotes', inputs: [{ name: 'account', type: 'address' }, { name: 'timepoint', type: 'uint256' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'getPastTotalSupply', inputs: [{ name: 'timepoint', type: 'uint256' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'tokenURI', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'string' }], stateMutability: 'view' },
  // Events
  { type: 'event', name: 'Transfer', inputs: [{ name: 'from', type: 'address', indexed: true }, { name: 'to', type: 'address', indexed: true }, { name: 'tokenId', type: 'uint256', indexed: true }] },
  { type: 'event', name: 'DelegateChanged', inputs: [{ name: 'delegator', type: 'address', indexed: true }, { name: 'fromDelegate', type: 'address', indexed: true }, { name: 'toDelegate', type: 'address', indexed: true }] },
] as const;

// OpenZeppelin Governor (AnonsDAO)
export const GovernorABI = [
  { type: 'function', name: 'proposalThreshold', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'votingDelay', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'votingPeriod', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'quorum', inputs: [{ name: 'timepoint', type: 'uint256' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'state', inputs: [{ name: 'proposalId', type: 'uint256' }], outputs: [{ type: 'uint8' }], stateMutability: 'view' },
  { type: 'function', name: 'proposalVotes', inputs: [{ name: 'proposalId', type: 'uint256' }], outputs: [
    { name: 'againstVotes', type: 'uint256' },
    { name: 'forVotes', type: 'uint256' },
    { name: 'abstainVotes', type: 'uint256' },
  ], stateMutability: 'view' },
  { type: 'function', name: 'proposalSnapshot', inputs: [{ name: 'proposalId', type: 'uint256' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'proposalDeadline', inputs: [{ name: 'proposalId', type: 'uint256' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'proposalProposer', inputs: [{ name: 'proposalId', type: 'uint256' }], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'proposalEta', inputs: [{ name: 'proposalId', type: 'uint256' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'hasVoted', inputs: [{ name: 'proposalId', type: 'uint256' }, { name: 'account', type: 'address' }], outputs: [{ type: 'bool' }], stateMutability: 'view' },
  // Events
  { type: 'event', name: 'ProposalCreated', inputs: [
    { name: 'proposalId', type: 'uint256', indexed: false },
    { name: 'proposer', type: 'address', indexed: false },
    { name: 'targets', type: 'address[]', indexed: false },
    { name: 'values', type: 'uint256[]', indexed: false },
    { name: 'signatures', type: 'string[]', indexed: false },
    { name: 'calldatas', type: 'bytes[]', indexed: false },
    { name: 'voteStart', type: 'uint256', indexed: false },
    { name: 'voteEnd', type: 'uint256', indexed: false },
    { name: 'description', type: 'string', indexed: false },
  ]},
  { type: 'event', name: 'VoteCast', inputs: [
    { name: 'voter', type: 'address', indexed: true },
    { name: 'proposalId', type: 'uint256', indexed: false },
    { name: 'support', type: 'uint8', indexed: false },
    { name: 'weight', type: 'uint256', indexed: false },
    { name: 'reason', type: 'string', indexed: false },
  ]},
  { type: 'event', name: 'VoteCastWithAgent', inputs: [
    { name: 'voter', type: 'address', indexed: true },
    { name: 'proposalId', type: 'uint256', indexed: true },
    { name: 'support', type: 'uint8', indexed: false },
    { name: 'weight', type: 'uint256', indexed: false },
  ]},
] as const;

// Nouns-style Auction House
export const AuctionHouseABI = [
  { type: 'function', name: 'auction', inputs: [], outputs: [
    { name: 'nounId', type: 'uint256' },
    { name: 'amount', type: 'uint256' },
    { name: 'startTime', type: 'uint256' },
    { name: 'endTime', type: 'uint256' },
    { name: 'bidder', type: 'address' },
    { name: 'settled', type: 'bool' },
  ], stateMutability: 'view' },
  { type: 'event', name: 'AuctionCreated', inputs: [
    { name: 'nounId', type: 'uint256', indexed: true },
    { name: 'startTime', type: 'uint256', indexed: false },
    { name: 'endTime', type: 'uint256', indexed: false },
  ]},
  { type: 'event', name: 'AuctionBid', inputs: [
    { name: 'nounId', type: 'uint256', indexed: true },
    { name: 'sender', type: 'address', indexed: false },
    { name: 'value', type: 'uint256', indexed: false },
    { name: 'extended', type: 'bool', indexed: false },
  ]},
  { type: 'event', name: 'AuctionSettled', inputs: [
    { name: 'nounId', type: 'uint256', indexed: true },
    { name: 'winner', type: 'address', indexed: false },
    { name: 'amount', type: 'uint256', indexed: false },
  ]},
] as const;

// NounsDAOExecutor (Timelock)
export const TimelockABI = [
  { type: 'function', name: 'delay', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'queuedTransactions', inputs: [{ name: 'hash', type: 'bytes32' }], outputs: [{ type: 'bool' }], stateMutability: 'view' },
] as const;

// ERC-8004 Agent Registry
export const ERC8004RegistryABI = [
  { type: 'function', name: 'agentOf', inputs: [{ name: 'agentId', type: 'uint256' }], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'isRegistered', inputs: [{ name: 'agent', type: 'address' }], outputs: [{ type: 'bool' }], stateMutability: 'view' },
  { type: 'function', name: 'ownerOf', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'address' }], stateMutability: 'view' },
] as const;
