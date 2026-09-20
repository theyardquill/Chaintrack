# ChainTrack

Blockchain-backed shipping tracking: every checkpoint scan is written to a ledger keyed to a package
QR, payments sit in smart-contract escrow until the recipient confirms delivery, and cross-border
settlement uses crypto.

## Structure

| Path | What |
| --- | --- |
| `web/` | Next.js dApp (Track, Ship, Checkpoint, Admin) with shadcn/ui |
| `contracts/` | Hardhat contracts, deploy script and tests |

## Quick start

```bash
pnpm install            # workspace install (web + contracts)
pnpm dev                # start the dApp at http://localhost:3000
pnpm contracts:test     # run on-chain tests
pnpm contracts:compile  # compile + emit ABI into web/src/contracts/artifacts
pnpm contracts:deploy   # deploy to a local chain and write deployments.json
```

The dApp runs in **demo mode** by default — a localStorage-backed store seeded with sample
packages, checkpoints and escrow, so the full flow (book → checkpoint → confirm → release) is
exercisable without a wallet or chain. Connect a MetaMask-style wallet to switch to the live
`ChainTrack` contract.

## Domain model

- **USER** — Sender / Receiver / Logistics Agent, role-gated on-chain.
- **PACKAGE** — QR-coded shipment with confidential contents.
- **TRANSACTION** — escrow: funds held by the contract, released to the sender on recipient
  confirmation, refundable until pickup.
- **CHECKPOINT** — tamper-evident scan events (time, location, agent, status).

## Security model

- Role-based access on every state-changing call.
- Recipient MFA delivery code required to confirm receipt.
- Agent checkpoints can only advance, never regress, a package.

## Roadmap

- [x] Contracts (`ChainTrack.sol`) with escrow lifecycle + tests
- [x] dApp scaffold with shadcn/ui, demo-mode UI for all roles
- [ ] Live wallet/contract wiring across pages
- [ ] AI module (route optimization, fraud detection, demand prediction)
- [ ] BTC bridge + stablecoin settlement
- [ ] Expo mobile app (QR scanning at checkpoints)# Chaintrack
