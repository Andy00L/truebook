# TrueBook

A provably-fair sports betting book on Solana. Every price TrueBook serves is a
public consensus price from the TxLINE StablePrice feed plus a fixed, displayed
margin, and every price is auditable on-chain after the fact. If the book ever
serves a price that deviates from the proven consensus beyond its stated margin,
the bettor can prove it on-chain and reclaim the stake, even on a losing ticket.
The house is held honest by code, not by trust.

Built for the TxODDS World Cup hackathon (Superteam Earn), "Prediction Markets
and Settlement" track. Runs on Solana devnet.

## The problem

Every sportsbook, centralized or on-chain, sets its own prices and no bettor can
audit them. TxLINE anchors a global odds consensus on Solana (a new merkle root
every 5 minutes) and anchors match statistics the same way. TrueBook uses both
halves: the odds anchor makes each served price auditable, and the score anchor
settles each market with a cryptographic proof instead of a trusted oracle.

## How it works

1. Bet. The book quotes every remaining World Cup market at the TxLINE
   StablePrice consensus plus a fixed margin, shown in full ("consensus 2.10,
   margin 2 percent, your price 2.06"). Each ticket records the source odds
   record id and timestamp on-chain.
2. Verify. After a match, a permissionless keeper submits the score proof. One
   transaction per market runs a CPI into the TxLINE `validate_stat` instruction,
   reads the boolean outcome, and writes it to a `VerifiedOutcome` account.
   Payouts become light claims. Each ticket shows a resolution receipt: the
   day root, the merkle path, and the verification transaction.
3. Audit. "Audit this price" runs a CPI into `validate_odds` to prove the
   consensus odds record referenced by the ticket is authentic, then checks the
   served price against consensus plus the stated margin. A proven violation
   makes the ticket refundable on-chain.

## Architecture

```
truebook/
  program/            Anchor program: house vault, markets, tickets, settlement, price audit
  app/                Next.js (App Router) front end
  keeper/             TypeScript bot: create markets, post quotes, lock, verify, settle
  packages/shared/    TxLINE client (auth, SSE, proofs), shared types, IDLs
  docs/               build plan, research, spike findings
```

Markets are binary YES/NO predicates in the native language of `validate_stat`
(`stat_a [op stat_b] comparison threshold`). A 1X2 market is a group of three
binary markets. Two proven stats with a Subtract operator give margin markets
(win, handicap, over/under) on top of simple outcomes.

## TxLINE integration (validated on devnet)

- Program: `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`
- Score settlement: CPI into `validate_stat`, account `daily_scores_roots`
- Price audit: CPI into `validate_odds`, account `daily_batch_roots`
- Pricing source: the `TXLineStablePriceDemargined` feed (fair consensus
  probability; decimal odds scaled by 1000)

The end-to-end validation flow is proven against real devnet proofs. See
[docs/research/2026-07-02-spike-findings.md](docs/research/2026-07-02-spike-findings.md)
for exact payload shapes and integration notes.

## Status

Devnet build in progress for the July 19, 2026 deadline. Technical validation
of the settlement and audit primitives is complete; program, keeper, and front
end are under construction. Plan:
[docs/BUILD_PLAN.md](docs/BUILD_PLAN.md).

## Local development

Requires bun, the Solana CLI, and Anchor. Scaffold and run commands land here as
each workspace is built.
