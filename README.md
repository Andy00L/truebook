<p align="center"><img src="docs/assets/icon.svg" width="96" alt="TrueBook icon"></p>

<h1 align="center">TrueBook</h1>

<p align="center">
A provably-fair sports book on Solana devnet. Every price it serves is a public
TxLINE consensus price plus a shown margin, auditable on chain after the bet.
Outcomes settle from cryptographic score proofs by cross-program call into the
TxLINE oracle, not a trusted server. A proven overcharge refunds the bettor,
even on a losing ticket.
</p>

<p align="center">Built for the TxODDS World Cup hackathon (Superteam Earn), Prediction Markets and Settlement track.</p>

<p align="center">
<a href="https://truebook-app.vercel.app"><img src="https://img.shields.io/badge/app-live%20on%20devnet-00E676" alt="app live on devnet"></a>
<img src="https://img.shields.io/badge/network-Solana%20devnet-1E242B" alt="network Solana devnet">
<img src="https://img.shields.io/badge/settlement-TxLINE%20score%20proofs-1E242B" alt="settlement TxLINE score proofs">
<img src="https://img.shields.io/badge/price%20audit-validate__odds%20CPI-00E676" alt="price audit validate_odds CPI">
<img src="https://img.shields.io/badge/tests-7%20passing-00E676" alt="tests 7 passing">
<img src="https://img.shields.io/badge/license-MIT-555555" alt="license MIT">
</p>

<p align="center"><b>Live devnet app: <a href="https://truebook-app.vercel.app">truebook-app.vercel.app</a></b></p>

<!--
  HERO AND STATE SCREENSHOTS (add before final submission, per readme-craft).
  They cannot be captured from the current headless session, so they are left
  out rather than faked. To add them:
  Run the app in chain mode (NEXT_PUBLIC_DATA_SOURCE=chain), connect a wallet,
  and capture at 1280 to 1600 px wide, default dark theme, no browser chrome,
  PNG under 500 KB each, into docs/screenshots/:
    01-lobby.png     home: honesty banner with real vault and open markets
    02-match.png     /match: the price-transparency popover (consensus vs served)
    03-tickets.png   /tickets: a settled receipt next to a PROVEN OVERCHARGE stamp
    04-verify.png    /verify: the on-chain verified outcome
  Then embed 01 as the hero here, and put 02 to 04 in a two-column table.
-->

## 🎯 The problem

Every sportsbook, centralized or on chain, sets its own prices, and no bettor can
check them. You are told the odds are fair; you cannot prove they were. The usual
on-chain fix resolves the winner through a trusted oracle or an optimistic dispute
game, which decides the outcome but says nothing about the price you were quoted
when you placed the bet.

TxLINE closes both gaps. It anchors a global odds consensus on Solana (a new
merkle root roughly every five minutes) and anchors match statistics the same way.
TrueBook uses both halves: the score anchor settles each market from a proof
instead of a trusted call, and the odds anchor makes every price the house served
auditable after the fact. The house is held honest by code, not by trust.

## 🧭 What it does

- **Priced from consensus.** `post_quote` sources each market's price from the
  `TXLineStablePriceDemargined` feed, adds a fixed shown margin, and records the
  source odds `MessageId` and timestamp on the market.
- **Bets snapshot their provenance.** `place_bet` moves the stake into the house
  vault and copies the served odds and their source record into the `Ticket`, so
  the exact quote a bettor took is on chain. Bettors sign it from a browser wallet.
- **Trustless settlement.** `verify_market` cross-program calls the TxLINE
  `validate_stat` instruction, reads the boolean outcome from return data, and
  writes it to a `VerifiedOutcome` account. The submitted proof is bound to the
  market's committed predicate, so a keeper cannot resolve a different question.
- **Provable price audit.** `audit_ticket` cross-program calls `validate_odds` to
  authenticate the odds record a ticket references, then compares the served
  implied probability against consensus plus the stated margin. A proven overcharge
  sets the ticket refundable, even a losing one, and even if the house already
  settled it to Lost first.
- **Permissionless cranks.** `lock_market`, `settle_ticket`, `void_market`, and
  `refund_ticket` can be called by anyone; the outcome and the math are on chain,
  not in an operator's discretion.

## 🏗 How it works

```mermaid
flowchart TD
    subgraph offchain["Off chain"]
        bettor["Bettor (browser wallet)"]
        keeper["Keeper bot"]
    end
    subgraph truebook["TrueBook program (Solana devnet)"]
        market["Market plus quote"]
        ticket["Ticket (stake in vault)"]
        outcome["VerifiedOutcome"]
    end
    subgraph txline["TxLINE oracle (Solana)"]
        vstat["validate_stat"]
        vodds["validate_odds"]
    end
    keeper -->|"post_quote: StablePrice plus margin"| market
    bettor -->|"place_bet: USDT stake"| ticket
    keeper -->|"verify_market: CPI"| vstat
    vstat -->|"outcome bool"| outcome
    outcome -->|"settle_ticket: payout"| bettor
    bettor -->|"audit_ticket: CPI"| vodds
    vodds -->|"authentic and within margin?"| ticket
```

The diagram shows the happy path. The program also handles the rest: a served
quote expires after 120 seconds, so a bet cannot be placed against a stale price.
Every bet checks the vault covers its potential payout and a per-market exposure
cap before it is accepted. A market whose outcome cannot be proven within 48 hours
of kickoff can be voided by anyone, and its tickets refunded in full. A ticket the
price audit flags as an overcharge becomes refundable regardless of the result,
and if the house front-runs the audit by settling the losing ticket first, the
audit still flips it to refundable and the stake is returned exactly once.

### 🔬 Markets are TxLINE predicates

A market is a binary YES or NO question expressed in the native language of
`validate_stat`: `stat_a [op stat_b] comparison threshold`, over a period. The
program stores that predicate and binds every settlement proof to it.

| Market | Predicate | Period |
| --- | --- | --- |
| Home win | goals(P1) minus goals(P2) greater than 0 | Total |
| Draw | goals(P1) minus goals(P2) equal to 0 | Total |
| Over 2.5 goals | goals(P1) plus goals(P2) greater than 2 | Total |
| Second-half corners over 4.5 | corners(P1) plus corners(P2) greater than 4 | 2nd half |

`stat` keys and periods come straight from the TxLINE score encoding (key 1 is
Participant1 goals, key 2 is Participant2 goals, period 0 is Total). A 1X2 board is
three of these binary markets. The devnet keeper currently lists home-win markets;
the other predicates are supported by the program and exercised in the tests.

## 🔗 Live on devnet

The program is deployed and the app is running against it. Everything below is
public on-chain state on Solana devnet.

| Artifact | Address or URL | Explorer |
| --- | --- | --- |
| App | https://truebook-app.vercel.app | [open](https://truebook-app.vercel.app) |
| TrueBook program | `59txn6d3rHFtvhocB5ZvhhJsTurGNq1d1gcbDy7o43fh` | [view](https://explorer.solana.com/address/59txn6d3rHFtvhocB5ZvhhJsTurGNq1d1gcbDy7o43fh?cluster=devnet) |
| Test USDT mint | `ELWTKspHKCnCfCiCiqYw1EDH77k8VCP74dK9qytG2Ujh` | [view](https://explorer.solana.com/address/ELWTKspHKCnCfCiCiqYw1EDH77k8VCP74dK9qytG2Ujh?cluster=devnet) |
| TxLINE oracle (settlement source) | `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J` | [view](https://explorer.solana.com/address/6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J?cluster=devnet) |

Try it in two minutes, no setup:

1. Open [truebook-app.vercel.app](https://truebook-app.vercel.app) and click
   **Judge mode**. Connect a Solana wallet (Phantom, Solflare, Backpack), then
   request devnet SOL and test USDT. Both go to your own wallet on devnet.
2. Open a match and place a bet. The price-transparency popover shows the TxLINE
   consensus price, the served price, and the margin between them, side by side.
   Sign the bet in your wallet.
3. Open **Tickets**, click **Audit this price** on a ticket. The app cross-program
   calls `validate_odds`; an overcharge is stamped PROVEN OVERCHARGE on chain and
   the ticket becomes refundable.

Evidence:

- **The house is quoted from consensus, live.** The keeper reads every market's
  price from the live `TXLineStablePriceDemargined` feed and posts it on chain;
  the app reads the house vault and open markets straight from the program.
- **It can catch itself lying.** One market is kept deliberately overpriced. Bet
  the bad price, lose, and audit it: `validate_odds` proves the served price
  exceeded consensus plus the margin, and the losing ticket is refunded on chain.
  We made our own book lie, and the chain caught it.
- **The program can say no.** `verify_market` rejects a proof whose stats,
  operator, comparison, or threshold do not match the market's committed predicate
  (`PredicateMismatch`), so a keeper cannot settle a different question than
  bettors were quoted. This is asserted in the test suite.

## 🧪 Reproduce it

Prerequisites: [Bun](https://bun.sh) 1.3 or newer, Rust via
[rustup](https://rustup.rs), the Solana CLI (Agave 4.0.2 or newer), and
[Anchor](https://www.anchor-lang.com) 0.31.1. The `program/Cargo.lock` pins seven
crates so the default Solana platform-tools (Rust 1.79) can build the program; do
not `cargo update` them (see [docs/TOOLCHAIN_NOTES.md](docs/TOOLCHAIN_NOTES.md)).

```bash
git clone https://github.com/Andy00L/truebook
cd truebook
bun install
cd program
anchor test
```

Success looks like the suite printing `7 passing`. `anchor test` starts a local
validator that clones the live TxLINE oracle program, its program data, and two
daily merkle roots from devnet, deploys TrueBook, then runs the full flow:
initialize the house, fund the vault, create a home-win market, quote it, place a
YES bet, lock, `verify_market` by CPI, settle the winner, audit the served price,
and refund a losing ticket that was settled before its audit. It writes nothing to
devnet.

Evidence the system can say no, not only yes:

- `verify_market` rejects a proof whose stats, operator, comparison, or threshold
  do not match the market's committed predicate (`PredicateMismatch`).
- `audit_ticket` sets a ticket refundable when the served implied probability
  exceeds consensus plus the stated margin, proven against the anchored odds root,
  and does so even after the house settles that ticket to Lost.

To run the surface yourself: `cd app && bun run dev` starts the frontend, and
`cd keeper && bun run src/index.ts list` prints the live house and every market
from devnet. The keeper commands are `setup`, `fund`, `list`, `tick`, `settle`,
and `rig`.

## ⚠️ What is real and what is simplified

- **The program is deployed and test-proven.** Twelve instructions, `anchor test`
  green (seven cases) against the real TxLINE oracle cloned from devnet, and the
  program is live at `59txn6d3rHFtvhocB5ZvhhJsTurGNq1d1gcbDy7o43fh` on devnet.
- **The frontend is built and deployed.** Lobby, match with the price-transparency
  popover, tickets with proof receipts, a public verify page, and a replay view,
  live at the URL above. Screenshots are not embedded in this README yet; the live
  app is the proof, and the capture list is noted in the source for a later pass.
- **The keeper is run live on devnet.** It authenticates to TxLINE, creates
  markets, quotes them from the live odds feed, and locks them at kickoff. It is a
  manual crank run around match windows, not an always-on service. Settlement runs
  by CPI as proven in the suite; each market settles from a score proof as its
  match finishes.
- **Betting uses a test SPL mint.** On devnet the book uses the TxLINE test USDT
  mint (`ELWTK...G2Ujh`, six decimals); the integration test uses a local mint it
  controls. No real funds, no KYC.
- **One market type is live so far.** The keeper currently creates home-win
  markets. The program supports the other predicates in the table above, and the
  tests exercise them; wiring them into the live catalog is catalog-and-UI work
  with no program change.
- **The NO-side consensus is the demargined complement.** For a binary market the
  NO implied probability is derived as one minus the YES implied probability. A
  multi-way board would carry an explicit price index per outcome.
- **Vault solvency is conservative.** The vault must cover the full potential
  payout of every live ticket at once, with no netting of opposite sides. It is a
  safe over-collateralization, and simpler to audit than a netted book.

## 📚 Prior art and related work

- **Polymarket**: a central-limit order book resolved by the UMA optimistic
  oracle, whose resolutions have been publicly disputed. TrueBook resolves from a
  cryptographic score proof and additionally audits the served price, not only the
  outcome. [polymarket.com](https://polymarket.com)
- **Azuro and Overtime (Thales)**: pooled-liquidity and AMM sportsbooks. They
  price and settle, but do not expose a per-ticket price audit against an anchored
  consensus. [azuro.org](https://azuro.org), [overtimemarkets.xyz](https://overtimemarkets.xyz)
- **BetDEX and the Monaco Protocol**: an on-chain betting exchange on Solana, a
  peer-to-peer order book rather than a house that proves its own prices.
  [monacoprotocol.xyz](https://www.monacoprotocol.xyz)

## 📦 Repository layout

```
program/          Anchor program: house, markets, tickets, CPI settlement and price audit
app/              Next.js (App Router) frontend, live on devnet
keeper/           TypeScript bot: auth, create markets, quote, lock, verify, settle
packages/shared/  TxLINE client (auth, SSE, proofs), shared types, program IDLs
docs/             build plan, research, spike findings, toolchain notes
```

## 📜 License

MIT. See [LICENSE](LICENSE).
