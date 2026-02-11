# PayStream Protocol

**Privacy-preserving onchain payroll powered by Chainlink**

> Inspired by Canton Network's first private payroll transaction — PayStream brings enterprise-grade payroll onchain with instant settlement, cross-chain disbursement, and automated compliance.

## Vision

The multi-trillion-dollar payroll industry is ripe for blockchain integration. PayStream Protocol demonstrates how Chainlink's decentralized oracle network can power real-world payroll workflows without exposing sensitive employee data or compromising regulatory constraints.

## Chainlink Services Used

| Service | Use Case | Status |
|---------|----------|--------|
| **Automation** | Scheduled payroll runs (bi-weekly, monthly) | Implemented |
| **CCIP** | Cross-chain salary disbursement to employees on any chain | Planned |
| **Data Feeds** | FX conversion for international payroll (USD/EUR, USD/GBP) | Planned |
| **CRE** | Orchestrate payroll workflows with offchain compliance checks | Planned |
| **Confidential Compute** | Privacy-preserving salary calculations | Planned |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  PayStream Protocol                  │
├─────────────────────────────────────────────────────┤
│  PayStreamEngine       — Core payroll + Automation  │
│  CrossChainDisbursement — CCIP multi-chain payments │
│  FXPayrollConverter    — Data Feeds for FX rates    │
│  ComplianceOracle      — CRE offchain compliance    │
│  ConfidentialPayroll   — CC privacy layer           │
├─────────────────────────────────────────────────────┤
│  Chainlink Automation  │  CCIP  │  Data Feeds  │ CRE│
└─────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# Install dependencies
bun install
forge install

# Build
forge build

# Test
forge test -vvv
```

## Tech Stack

- **Solidity 0.8.24** via Foundry
- **OpenZeppelin v5.x** (AccessControl, SafeERC20)
- **Chainlink** (Automation, CCIP, Data Feeds, CRE)
- **Bun** for TypeScript tooling
- **Next.js 15** for dashboard (planned)

## Status

- [x] Core PayStreamEngine with employee management
- [x] Chainlink Automation integration (checkUpkeep/performUpkeep)
- [x] 9 passing tests
- [ ] CCIP cross-chain disbursement
- [ ] Data Feeds FX conversion
- [ ] CRE compliance workflow
- [ ] Confidential Compute privacy layer
- [ ] Dashboard UI

## License

MIT
