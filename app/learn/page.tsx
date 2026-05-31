"use client";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { useState } from "react";

interface LearningModule {
  id: string;
  title: string;
  description: string;
  duration: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  topics: string[];
  content: string;
  resources: { title: string; url: string }[];
  questLink?: string;
}

const modules: LearningModule[] = [
  {
    id: "intro-vesting",
    title: "Introduction to Token Vesting",
    description: "Understand the basics of token vesting schedules and their real-world applications",
    duration: "10 min read",
    level: "Beginner",
    topics: ["Vesting Basics", "Use Cases", "Stellar Network"],
    content: `
# Introduction to Token Vesting

Token vesting is a mechanism to release digital assets over a period of time. Instead of transferring the full amount immediately, tokens are locked and gradually released to beneficiaries according to a predetermined schedule.

## Why Vesting?

Vesting schedules are commonly used in:
- **Employee Compensation**: Companies vest tokens to employees over 4 years with a 1-year cliff
- **Investor Allocations**: Projects release investor tokens gradually to ensure long-term commitment
- **Partnership Agreements**: Partners receive tokens based on milestone completion
- **DAO Governance**: Community members earn tokens proportional to their contribution timeline

## Key Concepts

### Cliff
A cliff is a period where no tokens are released. After the cliff passes, tokens become available. This ensures the recipient stays committed for at least that period.

### Linear Vesting
After the cliff (if any), tokens unlock gradually over time at a consistent rate.

### Revocability
Some vesting schedules can be revoked by the grantor, returning unvested tokens to the original issuer.

## Stellar & Soroban

VestFlow brings trustless vesting to the Stellar network using Soroban smart contracts. This means:
- **No middleman**: Tokens are controlled by code, not an intermediary
- **Programmable**: Schedules are customizable for any use case
- **Instant Settlement**: Claims settle in seconds on Stellar
- **Low Cost**: Stellar's efficient network keeps fees minimal
    `,
    resources: [
      { title: "Stellar Documentation", url: "https://developers.stellar.org" },
      { title: "Soroban Overview", url: "https://soroban.stellar.org" },
      { title: "Token Vesting Explained", url: "https://en.wikipedia.org/wiki/Equity_vesting" },
    ],
  },
  {
    id: "soroban-smart-contracts",
    title: "Building Smart Contracts on Soroban",
    description: "Learn how to write Soroban smart contracts using Rust for token management",
    duration: "30 min read",
    level: "Intermediate",
    topics: ["Soroban", "Rust", "Smart Contracts", "Token Management"],
    content: `
# Building Smart Contracts on Soroban

Soroban is Stellar's smart contract platform, enabling developers to write programmable logic on the Stellar network.

## Soroban Basics

### What is Soroban?
Soroban allows developers to write smart contracts in Rust that execute on the Stellar network. It's designed for:
- **Security**: Contracts are sandboxed and formally verified
- **Performance**: Optimized for DeFi and token operations
- **Developer Experience**: Familiar Rust tooling and ecosystem

### Key Features

#### Contract State
Soroban contracts store persistent data on the network. The VestFlow contract uses this to track:
- Schedule information (start time, duration, amounts)
- Claimed tokens for each beneficiary
- Revocation status

#### Contract Invocation
Users interact with contracts by submitting transactions to the Stellar network. Each transaction:
1. Calls a contract function with specific arguments
2. Is verified by validators
3. Updates contract state if successful

#### Events
Contracts emit events to signal important state changes:
- "ScheduleCreated" when a new vesting schedule is created
- "TokensClaimed" when a beneficiary claims vested tokens
- "ScheduleRevoked" when a grantor revokes a schedule

## VestFlow Contract Architecture

### Core Functions

\`\`\`rust
pub fn create_schedule(
    env: Env,
    grantor: Address,
    beneficiary: Address,
    token: Address,
    total_amount: i128,
    start_time: u64,
    duration: u64,
    cliff_duration: u64,
    kind: VestingKind,
    revocable: bool,
) -> u64
\`\`\`

Creates a new vesting schedule with the specified parameters.

\`\`\`rust
pub fn claim(env: Env, schedule_id: u64)
\`\`\`

Allows the beneficiary to claim vested tokens.

\`\`\`rust
pub fn revoke(env: Env, schedule_id: u64)
\`\`\`

Allows the grantor to revoke a revocable schedule.

### Vesting Calculation

The contract calculates vested amount based on:
- Current block time
- Schedule start time
- Schedule duration
- Cliff duration
- Vesting kind (Linear, Cliff, or LinearWithCliff)

### Authorization

Soroban uses capabilities for authorization:
- \`create_schedule\` requires grantor's signature
- \`claim\` requires beneficiary's signature
- \`revoke\` requires grantor's signature

This ensures only authorized parties can perform actions.

## Security Considerations

1. **Approval Model**: Grantors must approve tokens to the contract before creating a schedule
2. **Reentrancy Protection**: Soroban's design prevents reentrancy attacks
3. **Input Validation**: All parameters are validated before storage
4. **Immutable Schedules**: Schedule parameters cannot be changed after creation
    `,
    resources: [
      { title: "Soroban Documentation", url: "https://soroban.stellar.org/docs" },
      { title: "Rust Book", url: "https://doc.rust-lang.org/book/" },
      { title: "VestFlow Smart Contract", url: "https://github.com/vestflow-labs/vestflow/tree/main/contracts" },
    ],
  },
  {
    id: "frontend-integration",
    title: "Integrating Vesting into Your Frontend",
    description: "Connect your dApp to VestFlow using the Stellar SDK and Freighter wallet",
    duration: "20 min read",
    level: "Intermediate",
    topics: ["Frontend", "Stellar SDK", "React", "Web3 Integration"],
    content: `
# Integrating VestFlow into Your Frontend

This guide shows how to integrate VestFlow vesting into your web application using the Stellar SDK and Freighter wallet.

## Setup

### Installation

\`\`\`bash
npm install @stellar/stellar-sdk @stellar/freighter-api
\`\`\`

### Environment Variables

Set up your environment variables:

\`\`\`env
NEXT_PUBLIC_CONTRACT_ID=CCZ6AE75C27DMB3SOIHK7WZSBUG3NQPVLHSVEBQ2FSAEVGRJ5TXAZWCX
NEXT_PUBLIC_NETWORK=testnet
NEXT_PUBLIC_NATIVE_TOKEN=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
\`\`\`

## Connecting the Wallet

First, connect to the user's Freighter wallet:

\`\`\`typescript
import { requestAccess, getAddress } from "@stellar/freighter-api";

async function connectWallet() {
  await requestAccess();
  const { address } = await getAddress();
  return address;
}
\`\`\`

## Fetching Schedule Data

Read-only operations don't require a signature:

\`\`\`typescript
import { Contract, Networks, TransactionBuilder, BASE_FEE, rpc } from "@stellar/stellar-sdk";

const server = new rpc.Server("https://soroban-testnet.stellar.org");
const contract = new Contract(CONTRACT_ID);

async function getSchedule(id: number) {
  const account = await server.getAccount(FALLBACK_ACCOUNT);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(contract.call("get_schedule", nativeToScVal(id, { type: "u64" })))
    .setTimeout(30)
    .build();

  const result = await server.simulateTransaction(tx);
  return scValToNative(result.result.retval);
}
\`\`\`

## Creating a Vesting Schedule

To create a schedule, you need to:
1. Approve tokens to the contract
2. Sign and submit the transaction

\`\`\`typescript
import { signTransaction } from "@stellar/freighter-api";

async function createVestingSchedule(
  beneficiary: string,
  amount: bigint,
  duration: number
) {
  const userAccount = await server.getAccount(userAddress);
  
  // Approve tokens first
  const approveTx = new TransactionBuilder(userAccount, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      new StellarSDK.Operation.invokeHostFunction({
        hostFunction: contract.call("approve", /* ... */),
      })
    )
    .setTimeout(30)
    .build();

  const signedApproveTx = await signTransaction(approveTx);
  await server.submitTransaction(signedApproveTx);

  // Now create the schedule
  const scheduleTx = new TransactionBuilder(userAccount, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      contract.call(
        "create_schedule",
        nativeToScVal(userAddress),
        nativeToScVal(beneficiary),
        nativeToScVal(tokenAddress),
        nativeToScVal(amount, { type: "i128" }),
        nativeToScVal(Date.now() / 1000, { type: "u64" }),
        nativeToScVal(duration, { type: "u64" }),
        nativeToScVal(0, { type: "u64" }), // cliff
        nativeToScVal({ kind: "Linear" }),
        nativeToScVal(true) // revocable
      )
    )
    .setTimeout(30)
    .build();

  const signedTx = await signTransaction(scheduleTx);
  const result = await server.submitTransaction(signedTx);
  return result;
}
\`\`\`

## Best Practices

1. **Always simulate before submitting**: Test transactions with \`simulateTransaction\` first
2. **Handle errors gracefully**: Network operations can fail; provide user feedback
3. **Cache schedule data**: Use React Query or SWR to cache and revalidate schedule data
4. **Validate inputs**: Check addresses, amounts, and timeframes before submission
5. **Use event polling**: Listen for "ScheduleCreated" and "TokensClaimed" events for real-time updates
    `,
    resources: [
      { title: "Stellar SDK Docs", url: "https://developers.stellar.org/docs/build/smart-contracts" },
      { title: "Freighter API Docs", url: "https://developers.stellar.org/docs/tools/freighter-api" },
      { title: "VestFlow GitHub", url: "https://github.com/vestflow-labs/vestflow" },
    ],
  },
  {
    id: "vestflow-deep-dive",
    title: "VestFlow Architecture Deep Dive",
    description: "Explore the complete architecture of VestFlow and how all components work together",
    duration: "45 min read",
    level: "Advanced",
    topics: ["Architecture", "Event Indexing", "Advanced Smart Contracts"],
    content: `
# VestFlow Architecture Deep Dive

VestFlow is built on a modern, scalable architecture that combines on-chain smart contracts with off-chain indexing.

## System Architecture

### Components

1. **Smart Contract** (Soroban/Rust)
   - Manages vesting schedules
   - Handles token transfers and claims
   - Emits events for all state changes

2. **Frontend** (Next.js/React)
   - User interface for creating and managing schedules
   - Wallet integration via Freighter
   - Dashboard and analytics

3. **Event Indexer** (Node.js/SQLite)
   - Polls Soroban RPC for contract events
   - Indexes events in SQLite database
   - Provides query API for historical data

4. **Public API** (Next.js API Routes)
   - Serves schedule data for public viewing
   - Provides analytics and metrics
   - Powers the embeddable widget

### Data Flow

\`\`\`
User → Freighter Wallet → Stellar Network
                              ↓
                        Soroban Contract
                              ↓
                        Emit Events
                              ↓
                        Event Indexer
                              ↓
                        SQLite Database
                              ↓
                        Public API
                              ↓
                        Frontend/Widget
\`\`\`

## Event Indexing

The indexer continuously polls the Soroban RPC for new contract events:

### Event Types

1. **ScheduleCreated**
   - Triggered when a new vesting schedule is created
   - Contains: schedule_id, grantor, beneficiary, total_amount

2. **TokensClaimed**
   - Triggered when beneficiary claims vested tokens
   - Contains: schedule_id, beneficiary, amount

3. **ScheduleRevoked**
   - Triggered when grantor revokes a schedule
   - Contains: schedule_id, grantor, unvested_amount

### Checkpoint System

The indexer maintains a checkpoint table:
- Tracks the highest processed ledger
- Ensures no events are missed
- Allows resuming from where it left off

### Idempotency

Events are processed idempotently:
- Stellar assigns unique event IDs: \`<ledger>-<txIndex>-<eventIndex>\`
- Database uses event ID as primary key
- Duplicate events are silently ignored

## Advanced Features

### Bulk Claimable Queries

For performance, the contract provides \`claimable_bulk\`:

\`\`\`rust
pub fn claimable_bulk(env: Env, schedule_ids: Vec<u64>) -> Vec<i128>
\`\`\`

This allows fetching claimable amounts for multiple schedules in a single RPC call.

### Vesting Calculations

The contract handles three vesting types:

1. **Linear**: Tokens unlock at constant rate from start_time to end_time
2. **Cliff**: All tokens unlock at once after cliff_duration
3. **LinearWithCliff**: Tokens unlock at constant rate after cliff

The vesting amount at any time t is calculated as:

\`\`\`
if t < cliff_time:
  vested = 0
else if t >= duration:
  vested = total_amount
else:
  vested = (t - cliff_time) / (duration - cliff_time) * total_amount
\`\`\`

### Revocation Semantics

When a schedule is revoked:
- Vested amount remains claimable by beneficiary
- Unvested amount returns to grantor
- Schedule state becomes immutable

## Analytics Pipeline

VestFlow computes protocol-level analytics:

1. **Real-time Stats**
   - Total value locked (sum of unvested amounts)
   - Total claimed (sum of claimed amounts)
   - Active schedules (not fully vested)
   - Unique beneficiaries

2. **Daily Snapshots**
   - Recorded once per day
   - Used for trend analysis
   - Enables historical reporting

## Security Architecture

### Contract Authorization

All state-changing operations require authorization:
- Signatures are verified by Soroban runtime
- Authorization is enforced at operation level
- No role-based access control needed (authorization is on-chain)

### Approval Model

Token transfers use the Stellar Asset Contract approval model:
- Grantor approves amount to contract
- Contract then transfers from grantor to contract
- Beneficiary claims from contract

### Reentrancy Safety

Soroban's design prevents reentrancy:
- Single-threaded execution model
- No callbacks or delegatecalls
- State mutations are atomic

## Scaling Considerations

### Current Limitations

- Soroban has account creation limits
- Event polling has latency (polling interval determines freshness)
- SQLite suitable for moderate data volumes

### Future Improvements

- Event streaming for real-time updates
- Caching layer for frequently accessed schedules
- Horizontal scaling of indexer
- Multi-database support for larger deployments
    `,
    resources: [
      { title: "VestFlow GitHub", url: "https://github.com/vestflow-labs/vestflow" },
      { title: "Soroban Event Model", url: "https://soroban.stellar.org/docs/learn/storing-data" },
      { title: "Stellar RPC Specification", url: "https://soroban-rpc.stellar.org/" },
    ],
    questLink: "https://stellar.quest/challenges/vestflow-dev",
  },
];

export default function LearnPage() {
  const [selectedModule, setSelectedModule] = useState<LearningModule>(modules[0]);
  const [showDetails, setShowDetails] = useState(false);

  const getLevelColor = (level: string) => {
    switch (level) {
      case "Beginner":
        return "bg-green-500/10 text-green-400 border-green-500/20";
      case "Intermediate":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "Advanced":
        return "bg-orange-500/10 text-orange-400 border-orange-500/20";
      default:
        return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
    }
  };

  return (
    <>
      <Navbar />
      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link href="/app" className="text-zinc-400 hover:text-zinc-300 transition-colors text-sm mb-4 inline-block">
            ← Back to dashboard
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Learn VestFlow</h1>
              <p className="text-zinc-400">
                Master token vesting and Soroban smart contracts through VestFlow
              </p>
            </div>
            <div className="text-4xl">📚</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Module List */}
          <div className="lg:col-span-1">
            <div className="card p-4 sticky top-6">
              <h2 className="font-semibold mb-4 text-sm">Learning Path</h2>
              <div className="space-y-2">
                {modules.map((module) => (
                  <button
                    key={module.id}
                    onClick={() => {
                      setSelectedModule(module);
                      setShowDetails(true);
                    }}
                    className={`w-full text-left px-3 py-2 rounded transition-colors text-sm ${
                      selectedModule.id === module.id
                        ? "bg-violet-600 text-white"
                        : "text-zinc-300 hover:bg-zinc-800"
                    }`}
                  >
                    <div className="font-semibold">{module.title}</div>
                    <div className="text-xs text-zinc-400 mt-1">{module.duration}</div>
                  </button>
                ))}
              </div>

              <div className="mt-6 p-4 bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-500/20 rounded">
                <h3 className="text-sm font-semibold mb-2">Stellar Quest</h3>
                <p className="text-xs text-zinc-400 mb-3">
                  Complete quests to earn achievements
                </p>
                <a
                  href="https://stellar.quest"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-violet-400 hover:text-violet-300 transition-colors text-xs"
                >
                  Visit Stellar Quest →
                </a>
              </div>
            </div>
          </div>

          {/* Module Content */}
          <div className="lg:col-span-3">
            <div className="card p-8">
              {/* Module Header */}
              <div className="mb-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-3xl font-bold mb-2">{selectedModule.title}</h2>
                    <p className="text-zinc-400">{selectedModule.description}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className={`px-3 py-1 rounded border text-xs font-semibold ${getLevelColor(selectedModule.level)}`}>
                    {selectedModule.level}
                  </span>
                  <span className="px-3 py-1 rounded border border-zinc-700 text-zinc-400 text-xs">
                    ⏱️ {selectedModule.duration}
                  </span>
                </div>

                {selectedModule.topics.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedModule.topics.map((topic) => (
                      <span
                        key={topic}
                        className="px-3 py-1 rounded bg-zinc-800/50 text-zinc-300 text-xs"
                      >
                        #{topic}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-zinc-800 pt-8 mb-8">
                {/* Content */}
                <div className="prose prose-invert max-w-none">
                  <div className="space-y-4 text-zinc-300">
                    {selectedModule.content.split("\n").map((line, i) => {
                      if (line.startsWith("# ")) {
                        return (
                          <h1 key={i} className="text-2xl font-bold text-white mt-6 mb-4">
                            {line.slice(2)}
                          </h1>
                        );
                      }
                      if (line.startsWith("## ")) {
                        return (
                          <h2 key={i} className="text-xl font-bold text-white mt-4 mb-3">
                            {line.slice(3)}
                          </h2>
                        );
                      }
                      if (line.startsWith("### ")) {
                        return (
                          <h3 key={i} className="text-lg font-semibold text-white mt-3 mb-2">
                            {line.slice(4)}
                          </h3>
                        );
                      }
                      if (line.startsWith("- ")) {
                        return (
                          <li key={i} className="ml-4">
                            {line.slice(2)}
                          </li>
                        );
                      }
                      if (line.startsWith("`")) {
                        return (
                          <code
                            key={i}
                            className="bg-zinc-900 px-2 py-1 rounded text-zinc-200 text-sm"
                          >
                            {line}
                          </code>
                        );
                      }
                      if (line.trim()) {
                        return (
                          <p key={i} className="leading-relaxed">
                            {line}
                          </p>
                        );
                      }
                      return <div key={i} className="h-2" />;
                    })}
                  </div>
                </div>
              </div>

              {/* Resources */}
              <div className="border-t border-zinc-800 pt-6">
                <h3 className="text-lg font-semibold mb-4">Resources</h3>
                <div className="space-y-2">
                  {selectedModule.resources.map((resource, i) => (
                    <a
                      key={i}
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-violet-400 hover:text-violet-300 transition-colors"
                    >
                      <span>→</span>
                      {resource.title}
                    </a>
                  ))}
                </div>
              </div>

              {/* Stellar Quest CTA */}
              {selectedModule.questLink && (
                <div className="mt-8 p-6 bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20 rounded">
                  <h3 className="font-semibold mb-2">Ready for a challenge?</h3>
                  <p className="text-sm text-zinc-400 mb-4">
                    Complete the Stellar Quest challenge to earn an achievement
                  </p>
                  <a
                    href={selectedModule.questLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 rounded font-semibold transition-colors"
                  >
                    Start Quest
                    <span>→</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
