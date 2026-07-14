# TrueBook technical overview

Two pages for a reader deciding whether the mechanism is real. Everything
here is enforced by the deployed devnet program
`59txn6d3rHFtvhocB5ZvhhJsTurGNq1d1gcbDy7o43fh` and exercised by the
9-passing integration suite (`program/tests/truebook.ts`).

## Trust model: proven, operated, accepted

**Proven on chain (trustless):**

- Outcomes. `verify_market` cross-program calls TxLINE `validate_stat` and
  writes the returned boolean to a write-once `VerifiedOutcome` PDA. The
  proof is bound field by field to the market's committed predicate (stat
  keys, periods, operator, comparison, threshold), and the daily-root
  account is re-derived from the proof timestamp, so neither a wrong
  question nor a wrong root can settle a market.
- Prices, after the fact. Every quote is posted with the provenance of the
  TxLINE StablePrice record it came from (`MessageId` + record timestamp),
  and `place_bet` snapshots that provenance into the ticket. `audit_ticket`
  authenticates the exact referenced record via `validate_odds` and rejects
  any record whose shape (SuperOddsType, line, period) is not the one the
  market's predicate maps to (`oddsmap.rs`), so the house cannot price one
  question and be audited against a cheaper record.
- Cash-outs. `cash_out_ticket` prices the buy-back on chain from the
  current quote and records its provenance in a `CashOutReceipt`;
  `audit_cash_out` proves a lowball the same way an opening price is
  proven, and `claim_cash_out_repair` pays the shortfall and the bounty.

**Operated (the keeper, replaceable by anyone watching the feed):**

- Quoting cadence, market creation from the fixture list, locking at
  kickoff, running settlement cranks. All cranks except `post_quote` and
  `create_market` are permissionless; a dead keeper delays settlement but
  cannot change any outcome or dodge an audit.

**Accepted simplifications (also in the README honesty section):**

- The house authority can void an Open or Locked market before its outcome
  is anchored (needed for unresolvable fixtures; refunds every stake).
  `verify_market` being permissionless is the counterweight: anyone can
  anchor the outcome first.
- The NO-side consensus is derived as the complement of the YES implied
  probability; solvency is conservative (the vault covers every live
  payout in full, no netting).

## Instruction map (15)

| Instruction | Access | One line |
| --- | --- | --- |
| initialize_house | authority | singleton house PDA + USDT vault PDA |
| deposit_liquidity / withdraw_liquidity | authority | withdraw never below open exposure |
| create_market | authority | predicate must map to a consensus record, else refused |
| post_quote | authority | odds > 1.0 both sides, records source MessageId + ts |
| place_bet | anyone | quote fresh (120 s), caps + solvency checked, provenance snapshotted |
| lock_market | anyone | after kickoff |
| verify_market | anyone | CPI validate_stat, predicate-bound, write-once outcome |
| settle_ticket | anyone | pays winners from the vault, releases exposure once |
| audit_ticket | anyone | CPI validate_odds, overcharge flips Live or Lost to Refundable, 5% bounty |
| refund_ticket | anyone | voided market or audit-flagged ticket, stake back in full |
| void_market | authority anytime; anyone after 48 h | unresolvable fixtures |
| cash_out_ticket | bettor | on-chain price from the live quote, receipt keeps provenance |
| audit_cash_out | anyone | proves a lowballed cash-out against consensus |
| claim_cash_out_repair | anyone | pays the recorded shortfall + bounty, once |

## The audit math

Odds are decimal odds in basis points (2.06 = 20600). For served or
consensus odds `o`, the implied probability in bps is
`implied = 10_000 * 10_000 / o` (u128 intermediates, checked everywhere;
`overflow-checks = true` in release).

A served price is honest iff:

```
served_implied <= consensus_implied * (10_000 + margin_bps) / 10_000 + 25
```

where `margin_bps` is the house's stated margin (200 on devnet) and 25 bps
is the audit tolerance (`AUDIT_TOLERANCE_BPS`). A higher served implied
probability means a worse price than promised; the verdict is deterministic
per record, and only the first proven violation pays the auditor
`stake * 500 / 10_000` (5%), capped by free liquidity
(`vault - open_exposure`) so reserved payouts are never spent on bounties.

Cash-out value: `payout * (10_000 - opposite_implied) / 10_000`, priced
from the opposite side's served odds (which already carry the margin, so
the house edge lands without a second haircut). The audit's honest floor
recomputes that value at `consensus_opposite * (1 + margin)`; anything paid
below it is a recorded shortfall.

## The exposure invariant

`house.open_exposure` is the sum of potential payouts of live tickets:

- raised by `place_bet` (which requires `vault + stake >= new exposure`),
- lowered exactly once per ticket, by whichever of `settle_ticket`,
  `refund_ticket`, or `cash_out_ticket` resolves it first, guarded by the
  ticket's `exposure_released` flag (a settled-then-audited-then-refunded
  ticket does not release twice; suite-proven),
- respected by `withdraw_liquidity` (never below open exposure).

## Budget facts

| Fact | Value | Source |
| --- | --- | --- |
| Quote validity window | 120 s | constants.rs QUOTE_VALIDITY_SECONDS |
| Audit tolerance | 25 bps | constants.rs AUDIT_TOLERANCE_BPS |
| Audit-to-earn bounty | 500 bps of stake | constants.rs AUDIT_BOUNTY_BPS |
| Void grace window | 48 h after kickoff | constants.rs VOID_GRACE_SECONDS |
| validate_odds CPI cost | about 180k CU observed; flows set a 1.4M CU limit | keeper/src/jobs.ts, app audit flow |
| Odds encoding | decimal odds x 10_000 on chain, x 1_000 in the feed | constants.rs, shared config |
| Max stored MessageId | 64 bytes | constants.rs MAX_ODDS_MESSAGE_ID_LEN |

Security posture: see [SECURITY_AUDIT_2026-07-14.md](SECURITY_AUDIT_2026-07-14.md)
(phases 0 to 9; 0 critical or high findings, 2 medium found and fixed).
Portable receipts: any settled ticket exports a JSON receipt that
`keeper verify-receipt` re-proves against devnet with no credentials
(two committed under [receipts/](receipts/)).
