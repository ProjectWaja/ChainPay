# ChainPay Protocol

**Automated cross-chain payroll powered by Chainlink CCIP and Automation**

> Hackathon submission for Chainlink Block Magic Feb 2026

---

## Problem

Enterprise payroll is a multi-trillion-dollar industry still running on SWIFT wires, 3-5 day ACH settlements, and expensive FX intermediaries. Companies with global workforces pay massive fees to route salaries across borders — and employees wait days to get paid.

## Solution

ChainPay is an onchain payroll engine that uses **Chainlink Automation** to trigger scheduled payroll runs and **Chainlink CCIP** to disburse salaries cross-chain. Employees on any supported chain get paid automatically from a single payroll contract — no bridges, no manual transfers, no delays.

### How It Works

1. **Admin registers employees** with salary, pay frequency, and destination chain
2. **Chainlink Automation** calls `checkUpkeep()` on schedule to identify who's due
3. **`performUpkeep()`** executes the payroll run:
   - Same-chain employees receive direct stablecoin transfers
   - Cross-chain employees are paid via **CCIP data-only messages** to pre-funded receiver contracts on destination chains
4. **PayrollReceiver** on the destination chain decodes the CCIP message and auto-distributes payment tokens to the employee

```
Source Chain                                    Destination Chain
┌──────────────────────┐    CCIP Message     ┌──────────────────────┐
│   PayStreamEngine    │ ──────────────────> │   PayrollReceiver    │
│   (Automation)       │   data-only msg     │   (auto-distribute)  │
│                      │   "pay Alice $5k"   │                      │
│   CrossChain         │                     │   USDC ──> Alice     │
│   Disbursement       │                     │   (pre-funded)       │
└──────────────────────┘                     └──────────────────────┘
```

### Why Data-Only Messages?

We use CCIP **data-only messages** (not token transfers) because:
- Avoids CCIP token pool whitelisting requirements
- Mirrors real enterprise payroll: companies pre-fund accounts on each chain
- Simpler and more gas-efficient for high-frequency payroll runs
- Receiver contracts hold stablecoin reserves and disburse on instruction

## Chainlink Services Used

| Service | Integration | Description |
|---------|-------------|-------------|
| **Automation** | `checkUpkeep` / `performUpkeep` | Triggers payroll runs on schedule (bi-weekly, monthly, custom) |
| **CCIP** | `CCIPReceiver`, `IRouterClient`, `Client.EVM2AnyMessage` | Cross-chain payroll disbursement via data-only messages |

Both integrations use real Chainlink interfaces and libraries — not mocks. Tests use `CCIPLocalSimulator` from `@chainlink/local` for end-to-end verification.

## Smart Contracts

| Contract | LOC | Description |
|----------|-----|-------------|
| [`PayStreamEngine.sol`](src/PayStreamEngine.sol) | 200 | Core payroll engine with employee management, Automation hooks, and cross-chain routing |
| [`CrossChainDisbursement.sol`](src/CrossChainDisbursement.sol) | 105 | CCIP sender — builds and sends data-only messages to destination-chain receivers |
| [`PayrollReceiver.sol`](src/PayrollReceiver.sol) | 105 | CCIP receiver — validates source chain/sender, auto-distributes tokens, maintains audit trail |
| [`ICrosschainDisbursement.sol`](src/ICrosschainDisbursement.sol) | 65 | Shared interface, struct, and events for cross-chain payroll messaging |

### Key Design Decisions

- **AccessControl** with role separation: `PAYROLL_ADMIN_ROLE` (employee management), `AUTOMATION_ROLE` (payroll execution), `ENGINE_ROLE` (cross-chain sends), `DEFAULT_ADMIN_ROLE` (configuration)
- **Data-only CCIP** with `GenericExtraArgsV2` for gas limit control and out-of-order execution
- **Audit trail** on destination chain — every disbursement recorded with messageId, timestamps, and amounts
- **Emergency withdraw** on receiver for operational safety
- **Native gas fees** (`feeToken: address(0)`) with excess ETH refund

## Test Suite

**34 tests passing** across 3 test suites:

```
test/PayStreamEngine.t.sol       — 13 tests (core + cross-chain integration)
test/CrossChainDisbursement.t.sol — 9 tests  (sender unit tests)
test/PayrollReceiver.t.sol        — 12 tests (receiver unit + E2E tests)
```

Tests include full end-to-end flows where the engine triggers a payroll run, sends a CCIP message, and the receiver auto-distributes tokens to the employee — all verified in a single transaction via `CCIPLocalSimulator`.

## Quick Start

```bash
# Clone with submodules
git clone --recurse-submodules https://github.com/ProjectWaja/ChainPay.git
cd ChainPay

# Install npm dependencies (Chainlink packages)
bun install

# Build
forge build

# Run all tests
forge test -vvv
```

### Requirements

- [Foundry](https://book.getfoundry.sh/getting-started/installation) (forge, cast, anvil)
- [Bun](https://bun.sh/) (for npm package management)

## Tech Stack

- **Solidity 0.8.24** — Foundry toolchain
- **OpenZeppelin v5.5.0** — AccessControl, SafeERC20, Ownable
- **Chainlink CCIP** — CCIPReceiver, IRouterClient, Client library
- **Chainlink Automation** — checkUpkeep/performUpkeep interface
- **@chainlink/local** — CCIPLocalSimulator for testing

## Project Structure

```
src/
  PayStreamEngine.sol          # Core payroll engine + Automation
  CrossChainDisbursement.sol   # CCIP sender module
  PayrollReceiver.sol          # CCIP receiver + auto-distribution
  ICrosschainDisbursement.sol  # Shared types and interface
test/
  PayStreamEngine.t.sol        # Engine tests + cross-chain E2E
  CrossChainDisbursement.t.sol # Sender unit tests
  PayrollReceiver.t.sol        # Receiver unit + integration tests
lib/
  forge-std/                   # v1.14.0 (git submodule)
  openzeppelin-contracts/      # v5.5.0 (git submodule)
```

## Future Work

- **Data Feeds** — FX conversion for international payroll (USD/EUR, USD/GBP)
- **CRE Workflows** — Offchain compliance checks before disbursement
- **Confidential Compute** — Privacy-preserving salary calculations
- **Dashboard** — Next.js admin UI for employee management and payroll monitoring
- **Multi-token support** — Pay employees in their preferred stablecoin

## License

MIT
