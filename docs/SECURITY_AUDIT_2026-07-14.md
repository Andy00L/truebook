# Security audit and bug-fix report

PROJECT: TrueBook (program + keeper + shared + app)
LANGUAGES: Rust (Anchor 0.31.1), TypeScript (Next.js 16 app, Bun keeper)
DATE: 2026-07-14
NETWORK: Solana devnet only
PROCEDURE: REFERENCE_SECURITY_AUDIT.md phases 0 to 9

## Phase 1: reconnaissance and read coverage

- Program: every file read in full (lib, state, constants, errors, events,
  math, oddsmap, txline_cpi, all 14 instruction handlers, the 752-line
  integration suite, Cargo/Anchor manifests).
- Keeper and shared package: every file read in full.
- App: every route, chain library, wallet flow, money-flow screen, and hook
  read in full. Pure-presentational leaf components (icons, skeletons, demo
  fixture data, globals.css) were pattern-scanned for dangerous sinks
  (dangerouslySetInnerHTML, innerHTML, eval, storage, env access) and
  secrets instead of line-by-line reads; zero hits.
- External integrations: TxLINE REST API (authenticated, server-side only),
  TxLINE oracle program (CPI), Solana devnet RPC, Vercel hosting.

## Phase 2: architecture and trust boundaries

- Funds: SPL USDT vault owned by the house PDA. Money moves only in
  place_bet, settle_ticket, refund_ticket, cash_out_ticket, audit_ticket
  (bounty), claim_cash_out_repair, manage_liquidity.
- Trust boundaries: browser wallet inputs -> program account constraints;
  browser -> /api/audit-args and /api/receipt (server holds the TxLINE
  token); keeper env (token, keypair) -> devnet; TxLINE proofs -> validated
  on-chain by CPI, never trusted from the client.
- Adversaries considered: a dishonest house (the product's core threat), a
  malicious bettor/auditor crafting inputs, request floods on the public
  API routes, and secret leakage through logs or the repo.

## Phase 3 to 5: findings and fixes

| #  | Finding | Severity | Location | Status |
|----|---------|----------|----------|--------|
| 1  | Keeper logged the RPC endpoint including its api-key query param into ops logs | MEDIUM | keeper/src/index.ts | FIXED: query string stripped from the log line. Rotate the Helius key after the event since past local logs carried it. |
| 2  | Public API routes had no rate limiting; one receipt assembly fans out to about a dozen RPC and TxLINE calls (cost/DoS amplification) | MEDIUM | app/src/app/api/* | FIXED: per-IP fixed-window limiter (audit-args 30/min, receipt 10/min), per-instance by design, documented in app/src/lib/server/rateLimit.ts. |
| 3  | Integration suite cold-start flake: first run after a toolchain switch failed 4 tests through one cascading early RPC failure; two consecutive reruns pass 9/9 | LOW | program/tests | Documented: tests are serial and state-dependent; rerun once on a cold-start failure. No code change. |
| 4  | README says "tests 7 passing" twice; the suite is 9 passing since the July 12 cash-out tests | LOW | README.md:20,182 | OPEN: fix in the README pass (readme-craft gate) before submission. |
| 5  | bun audit: 13 advisories (5 high) | LOW (triaged) | dev dependency chain | ACCEPTED: all sit in dev tooling (mocha, ts-mocha, eslint, postcss build chain) except bigint-buffer (transitive of @solana/spl-token, no patched release exists; the overflow needs attacker-controlled buffers, ours are fixed-size chain account data). Run `bun update` after the submission freeze. |
| 6  | House authority can void an Open or Locked market at any time, converting unsettled winning tickets into stake refunds (a payout-dodge lever) | LOW (design) | void_market.rs | ACCEPTED centralization tradeoff for unresolvable fixtures; verify_market is permissionless so anyone can anchor the outcome first. Name it in the README honesty section. |
| 7  | settle/refund reuse TicketMarketMismatch for the bettor-token-account owner check (error-distinctness rule) | LOW | settle_ticket.rs, refund_ticket.rs | DEFERRED: message-only issue, behavior correct; program is frozen (plan rule 4). Post-event cleanup. |
| 8  | place_bet ticket PDA seed uses the literal b"ticket" instead of TICKET_SEED | INFO | place_bet.rs | DEFERRED: identical bytes, no behavioral impact; frozen. |
| 9  | errors.rs OutcomeAlreadyVerified variant unused | INFO | errors.rs | DEFERRED and KEEP AS-IS even later: removing a variant renumbers every following Anchor error code. |

Total: 9. CRITICAL: 0. HIGH: 0. MEDIUM: 2 (both fixed). LOW: 5. INFO: 2.

## What was checked and found sound

- Money paths: place_bet conservative solvency (vault covers every live
  payout), per-market and per-ticket caps, checked arithmetic everywhere
  (u128 intermediates, overflow-checks = true in release), stake transfer
  after every guard.
- State machine: settle/refund/cash-out release exposure exactly once (the
  exposure_released invariant, test-proven); audit flips Live or Lost to
  Refundable so a front-run settle cannot dodge a refund; Won tickets keep
  winnings; re-audit pays no second bounty; claim_cash_out_repair is
  idempotent (made_whole).
- Oracle binding: audits must present the exact record the ticket or
  receipt committed (MessageId + ts), of the exact record shape the
  market's predicate maps to (oddsmap), against the PDA re-derived from the
  proof timestamp; verify_market binds every predicate field. A keeper
  cannot price one question and settle or audit another.
- Bounty economics: paid once per violation, only from free liquidity, so
  reserved payouts are never spent on bounties.
- App trust boundary: the TxLINE token lives in server env only (never
  NEXT_PUBLIC, never returned, never logged); both routes validate input
  shape and return distinct, actionable errors; no XSS sinks anywhere in
  the app; external links carry rel="noreferrer"; wallet flows preflight
  balances and surface program errors as mapped messages.
- Keeper: token read from env, never printed; keypair stays on disk; all
  failure paths log with [FunctionName] prefixes and no secrets.
- Repo hygiene: no secrets tracked; .scratch/ and .env* ignored; git
  history pickaxe plus regex scans found no token or key material ever
  committed; the committed proof receipts carry only public chain data.

## Phase 7: verification after fixes

- Rust unit tests: 15 passing.
- Integration suite (anchor 0.31.1, localnet cloning the live TxLINE
  oracle): 9 passing, twice consecutively.
- App: tsc --noEmit clean, eslint clean; rate limiter exercised (11th
  request per client blocked within the window, other clients unaffected).
- Keeper: tsc --noEmit clean; live tick, rig, and serve cycles green after
  the log-redaction fix.
- Receipts: docs/receipts/sting.json and honest-winner.json re-verify PASS
  with no credentials and no keypair in the environment.

## Bugs not fixed (with justification)

Findings 4 (README counts; belongs to the gated README pass), 5 (dev-chain
advisories; post-freeze update), 6 (design tradeoff, to document), 7 to 9
(program frozen; message- or style-level only).
