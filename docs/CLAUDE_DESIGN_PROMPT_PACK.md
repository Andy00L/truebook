# TrueBook Claude Design prompt pack

How to use this. Generate the hero screen first (screen 1) and lock it. For every
later screen, paste the system prompt again plus that screen's prompt, and attach
the accepted hero export so the tool matches the style. Change one variable per
regeneration. Generate three to five variants per screen and keep the note of
which won. Attach the palette card (`docs/assets/palette-card.html`, screenshotted
at 2x) to every prompt. Token values are the source of truth in
`docs/UI_DESIGN_SYSTEM.md`; if this pack and the sheet ever differ, the sheet wins.

---

## 1. System prompt (paste with every screen)

You are designing screens for TrueBook, a provably-fair sports book on Solana.
Every price it serves is a public TxLINE consensus price plus a displayed margin,
and every price and outcome is auditable on chain. The audience is data-literate
hackathon judges, so the interface must read as a precise, credible workstation,
not a flashy casino.

Register: precision tools with a live scoreboard edge. Dark theme only. Dense,
scannable, calm.

Use these tokens exactly. Never introduce a color, radius, or shadow outside them.

Palette (hex):
- Field #0B0E11, Surface #12161B, Surface elevated #171C22, Border #1E242B.
- Ink #E8ECF1, Muted ink #8A94A3, Faint ink #566072.
- Accent green #00E676 (the one interactive color: links, primary button, live,
  odds shortening, proven), accent soft rgba(0,230,118,0.12), accent deep #00A050,
  ink on accent #04120A.
- Reserved amber #F5A623 (locked or awaiting-proof only, once per screen).
- Destructive red #FF5252 (odds lengthening, losses, a proven violation, errors).

Type:
- UI face Geist Sans, weight ceiling 600, sentence case.
- Numbers, odds, amounts, timestamps, and hashes in Geist Mono with
  font-variant-numeric: tabular-nums. Numbers never change width.
- Eyebrow labels: 11px, uppercase, letter-spacing 0.08em, muted or faint ink.
- Size steps: 11, 12, 13, 14, 16, 20, 28, 40.

Shape and space: radii 8 (chips, inputs), 12 (cards, buttons), 16 (dialogs, the
bet slip). Spacing on a 4px rhythm. Card padding 16 to 20. Content width 1200 to
1440 with generous side padding and a real grid.

Material: one opaque graphite card. Fill Surface, 1px Border, a thin top highlight
inset 0 1px 0 rgba(255,255,255,0.03), shadow 0 1px 2px rgba(0,0,0,0.40) plus
0 8px 24px rgba(0,0,0,0.32). No glass. Elevation is carried by the surface shift
and border, not heavy shadows. Focus is a 2px accent ring at accent-soft plus an
accent-green border, on every interactive element.

Motion: enter cubic-bezier(0.16,1,0.3,1) at 200ms, exit cubic-bezier(0.4,0,1,1) at
160ms, on-screen cubic-bezier(0.4,0,0.2,1). Stagger 40ms. Press scale 0.98. On an
odds change, the cell background pulses accent-soft when the price shortens or a
red soft when it lengthens for 300ms, then fades; digits never jump. Honor
prefers-reduced-motion (collapse to opacity-only).

Signature, use it: the proof receipt. A settled or audited item renders as a
printed bet slip on Surface elevated, with a perforated top edge (a dashed
hairline in Border), the market and outcome in sans, the numbers in mono, then a
proof block of truncated 32-byte hashes (day root, merkle path, verify tx) each
with a copy affordance and an explorer link, closed by a stamp reading VERIFIED ON
SOLANA in accent green (or REFUNDED or PROVEN OVERCHARGE in red for a violation).

Hard rules, never break:
- One accent (green). Red and amber are rare punctuation, once per screen, never
  a generic status color.
- The field is #0B0E11, never a flat black and never white. Cards are Surface,
  never flat white.
- Design every state: default, hover, focus-visible, active, disabled, loading
  (skeleton mirroring the final layout), empty (a motif, one sentence, one action,
  never a bare "No data"), and error (distinct from empty, with a retry).
- Realistic data only, at realistic lengths (long team names, 12-digit amounts,
  full 32-byte hashes truncated in the middle). No lorem ipsum, no "John Doe / $10".
- No second flat shadow, no glass, no gradient wash beyond accent-soft, no title
  case, no weight over 600, no numbers that reflow, no framework default greys.

Accessibility floor: body text contrast 4.5:1, large text 3:1 (already true for
Ink and Muted on Field); focus visible on every control; touch targets 44px;
labels on every input; a full keyboard path.

Output: Next.js App Router with Tailwind CSS and shadcn/ui. One route file per
screen under app/, presentational components under components/ by domain, named in
PascalCase. Wire the tokens as CSS variables and Tailwind theme values; components
read tokens, never literals. Return the code plus a short note of the layout
decisions.

---

## 2. Screen prompts (generate in this order)

### Screen 1, hero: match page (`/match/[fixtureId]`)

Purpose: one match, its live score, its markets, and the price transparency of
every quote, where a bettor places a bet and sees the house markup in the open.

Layout, top to bottom: a score header (two team names, the live score, a mono
match clock like 67:12 with a small LIVE pill in accent green; when not live, a
kickoff time and a status pill in muted); a market board of cards, one per market;
a bet slip that opens as a right-side drawer when an odds cell is clicked.

Each market card holds: the market name (Home win, Over 2.5 goals, Second-half
corners over 4.5); an odds row of outcome cells (for Home win: France 2.06, Draw
3.40, Argentina 3.75, each cell a mono value with the outcome label above it, the
live or best cell bordered in accent green); and under the odds, the price
transparency bar: a thin segmented track showing consensus, margin, and served
price, labeled in mono as "consensus 2.10, margin 2.0%, your price 2.06". A small
info affordance opens a popover expanding the same three numbers with one line:
"served price is auditable on chain".

Bet slip drawer: the selected market and outcome, an amount input in USDC (mono,
tabular), the quoted odds, the potential payout computed live, and a primary
"Place bet" button in accent green. Show the quote freshness as a small mono
countdown (a quote is valid 120 seconds).

States: loading (skeleton of the header and three market cards), a market locked
(the card dimmed, odds replaced by an amber LOCKED pill, no bet slip), a market
awaiting proof after the match (amber AWAITING PROOF), an error loading odds (a
retry). Responsive: on narrow screens the bet slip becomes a bottom sheet, the
odds cells stay one row and scroll horizontally rather than reflow.

Do not invent: no chat, no promotions, no account balance widgets, no sports other
than soccer.

### Screen 2: lobby (`/`)

Purpose: the remaining World Cup fixtures and a house honesty banner, the front
door.

Layout: a top house honesty banner (a slim Surface strip in mono: vault balance,
open exposure, margin 2.0%, tickets audited, violations found, and the line "every
price is auditable"); then a grid of fixture cards. Each fixture card: the two
teams, a live pill or a kickoff time, one featured market with its odds and the
price transparency bar in miniature, and a quiet "view markets" affordance to the
match page.

Sample fixtures: France vs Argentina (live 67:12), Spain vs Austria (kickoff in
2h 10m), Portugal vs Croatia (kickoff tomorrow 15:00), Brazil vs Norway (final,
kickoff Jul 19). States: loading (skeleton grid), empty ("no fixtures in the
window", one line, a link to replay), error (retry). Responsive: three columns to
one.

Do not invent: no leaderboard, no news feed, no odds for made-up sports.

### Screen 3: tickets (`/tickets`)

Purpose: the bettor's own tickets, each carrying its proof receipt.

Layout: a filter row (all, live, won, lost, refundable) then a list of tickets.
Each ticket row expands to the proof receipt (the signature element). A live
ticket shows stake, side, quoted odds, potential payout, and a small AUDIT THIS
PRICE affordance. A settled ticket shows the receipt with the VERIFIED ON SOLANA
stamp; a violation ticket shows the receipt with a red PROVEN OVERCHARGE stamp and
a REFUNDED line.

Sample tickets: Home win, France, stake 100.00 USDC, odds 2.06, payout 206.00,
WON, day root 4d2c70...101033, verify tx 3NmXRo...KNeLiFh. A second: Over 2.5
goals, NO, stake 50.00 USDC, LOST then PROVEN OVERCHARGE, REFUNDED 50.00. States:
loading (skeleton rows), empty ("no tickets yet", a link to the lobby), error.
Responsive: the receipt stacks its columns on narrow screens; hashes stay one line
and truncate.

Do not invent: no PnL charts, no social sharing beyond a copy-link on the receipt.

### Screen 4: public verify (`/verify/[market]`)

Purpose: a shareable page that proves one market's resolution to anyone, no wallet
needed.

Layout: the match and market at the top, the verified outcome (a large mono YES or
NO with the resolved statistic, for example "France 2, Argentina 0, home win
holds: true"), then the full proof receipt at large size (day root, the merkle
path nodes each in mono with copy and explorer links, the verify tx), and a footer
line "resolved by a TxLINE merkle proof, not a trusted oracle". States: loading, a
not-yet-verified market (amber AWAITING PROOF with the kickoff and expected
resolution window), error. Responsive: single column, generous.

Do not invent: no comments, no login.

### Screen 5: replay (`/replay`)

Purpose: replay a finished match so evaluators see the whole cycle when no match is
live.

Layout: a match picker, a timeline scrubber, and a synced view of the score, the
quotes moving, and the settlement firing at the end. A play and pause control, a
speed control (1x, 4x, 16x). The odds cells pulse on each change per the motion
token. States: loading, empty (no replayable match), error. Responsive: the
timeline moves under the score on narrow screens.

Do not invent: no video, no commentary audio.

### Screen 6: judge mode (a panel reachable from the lobby)

Purpose: let a judge fund a test wallet and try the app in one click.

Layout: a small Surface elevated panel with a "request test USDC" button (the
TxLINE devnet faucet), a "request devnet SOL" link, the connected wallet and its
balances in mono, and one line explaining these are devnet test funds. States:
default, requesting (button disabled with progress), success (a toast), error.

Do not invent: no real-money anything, no KYC.

---

## 3. Attachments (attach to every prompt)

- The palette card (`docs/assets/palette-card.html` screenshotted at 2x): pins the
  exact colors, the material, and the proof receipt and price transparency look.
- The accepted hero export (screens 2 to 6 only): pins the established style so
  every screen reads as one product.
- The TrueBook icon (`docs/assets/icon.svg`): pins the mark for any header.

## 4. Iteration guide

- Generate screen 1 first, three to five variants, pick one, and lock it. That
  export becomes an attachment for every later screen.
- One variable per regeneration: "same screen, tighter density" or "same screen,
  larger score header", never three changes at once.
- If a screen drifts off the tokens (wrong greys, a second accent, glass), do not
  hand-repaint node by node: re-paste the system prompt with the palette card and
  regenerate. One re-prompt beats fifty edits.
- Keep the winning variant's code per screen and note which won, so integration
  (the next session task) knows what to wire.
