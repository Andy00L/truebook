# TrueBook UI design system (the token sheet)

The single source of truth for the frontend. Every screen reads from this; no
literal colors, spacing, radii, or shadows in components. Register: precision
tools (dense, scannable, credible for data-literate judges), with a live
scoreboard edge. Theme: dark only. Stack: Next.js App Router, Tailwind, shadcn.

House style, one line: a broadcast scoreboard that shows its work. Calm graphite
field, green only where something is live or proven, every number monospaced and
auditable.

Hero moment: the match page, where live score, the market board, and the price
transparency of each quote sit together. Every other screen is quieter so it lands.

## Palette (seven roles plus variants)

Dark is built from true cool greys, not black, with elevation by surface shift
(Linear and Vercel convention). Contrast checked against the field.

| Role | Hex | Use |
| --- | --- | --- |
| Field | `#0B0E11` | the base everything sits on |
| Surface | `#12161B` | cards, panels, table rows |
| Surface elevated | `#171C22` | popovers, dialogs, the bet slip |
| Border | `#1E242B` | 1px hairlines, table lines, dividers |
| Ink | `#E8ECF1` | primary text, live numbers (about 15:1 on field) |
| Muted ink | `#8A94A3` | secondary text, labels (about 7:1) |
| Faint ink | `#566072` | eyebrows, disabled, empty states (large or non-body only) |
| Accent green | `#00E676` | the one interactive color: links, primary action, live, odds up, proven |
| Accent soft | `rgba(0,230,118,0.12)` | accent fills, focus ring, hover wash |
| Accent deep | `#00A050` | pressed accent, accent text on light chips |
| Reserved amber | `#F5A623` | locked or pending only, once per screen |
| Destructive red | `#FF5252` | odds down, losses, a proven violation, errors |

Rules: green is the only saturated color at rest. Red is reserved punctuation for
a falling price, a loss, or a violation, never a generic status. Amber marks a
locked or awaiting-proof market, once per screen. The field is never a flat black
and never a flat white.

## Type

- UI face: Geist Sans (already wired by create-next-app). Weight ceiling 600.
- Precise face: Geist Mono, `font-variant-numeric: tabular-nums` on every odds,
  score, amount, timestamp, and hash. Numbers never reflow width.
- Size steps (dense): 11, 12, 13, 14, 16, 20, 28, 40 px.
- Eyebrow: 11px, uppercase, tracking +0.08em, muted or faint ink.
- Sentence case for titles and buttons; uppercase only for eyebrows and pills.

## Space and shape

- Radii: 8 (chips, inputs), 12 (cards, buttons), 16 (dialogs, the slip). Base 12.
- Spacing: 4px base rhythm (4, 8, 12, 16, 24, 32).
- Card padding: 16 to 20px. Table cell padding: 8 by 12.
- Content width: 1200 to 1440px, generous side padding; a real grid.

## Material and depth

One material: the graphite card. Opaque (no glass on a dense dark workspace).

```css
--surface-fill: #12161B;
--surface-border: 1px solid #1E242B;
--surface-top-highlight: inset 0 1px 0 rgba(255,255,255,0.03); /* thin top edge */
--shadow-card: 0 1px 2px rgba(0,0,0,0.40), 0 8px 24px rgba(0,0,0,0.32);
--shadow-elevated: 0 2px 4px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.40);
```

On dark, elevation is carried by the surface shift and the border plus the top
highlight; shadows stay subtle. Focus is one treatment everywhere: a 2px accent
ring at `--accent-soft` plus a border in accent green, visible on field and
surface.

## Motion tokens

- Durations: 70 (micro states), 120 (small moves), 200 (standard), 320 (large or
  hero). Nothing decorative over about 500.
- Easings: enter `cubic-bezier(0.16, 1, 0.3, 1)`, exit `cubic-bezier(0.4, 0, 1, 1)`,
  on-screen `cubic-bezier(0.4, 0, 0.2, 1)`.
- Stagger constant: 40ms for sequenced groups (market rows, ticket lists).
- Press scale: 0.98. Hover lift on cards: translateY(-2px) at 120ms.
- Odds tick: on a price change, the cell background pulses accent-soft (up) or a
  red soft (down) for 300ms then fades; the digits never jump width (tabular).
- `prefers-reduced-motion`: all of the above collapse to instant or opacity-only,
  identical final layout.

## Signature element (what TrueBook owns)

Primary: the proof receipt. A settled or audited ticket renders as a printed bet
slip: a perforated top edge (a dashed hairline in border color), the market and
outcome in sans, the numbers in mono, then a proof block of truncated 32-byte
hashes (day root, merkle path) each with a copy affordance and an explorer link,
closed by a stamp reading VERIFIED ON SOLANA in accent green (or REFUNDED,
PROVEN OVERCHARGE in red for an audit violation). Placement: once per ticket on
the tickets page, and full-size on the public `/verify/[market]` page. Built only
from the token sheet: surface-elevated fill, border hairline, mono, the green or
red stamp.

Secondary: the price transparency bar. On every market quote, a thin segmented
bar shows consensus price, the displayed margin, and the served price, labeled in
mono, so the house markup is visible at a glance. Placement: under each market
odds, and expanded in the price popover.

## Screens (hero first)

1. `/match/[fixtureId]` (hero): live score header, the market board, price
   transparency, the bet slip drawer.
2. `/` lobby: remaining fixtures, featured markets, the house honesty banner.
3. `/tickets`: the bettor's tickets, each with its proof receipt.
4. `/verify/[market]`: the public, shareable verifiable resolution page.
5. `/replay`: replay a finished match with quotes and settlement.
6. Judge mode: a faucet button and airdrop link, reachable from the lobby.

## Reference and anti-patterns (from the research sweep)

- Reference dark systems: Linear (very dark cool grey base, type tuned for dark),
  Vercel (`#171717` ink, Geist, no brand blue, the ink is the brand). Sources:
  [shadcn.io Vercel design](https://www.shadcn.io/design/vercel),
  [dark dashboard patterns 2026](https://www.aydesign.ai/blog/dark-mode-dashboard-design-patterns-2026).
- Sportsbook convention (adopt): green for shortening odds, red for lengthening;
  odds cells must not reflow or jump; subtle animation on change; ample spacing;
  live updates without a manual refresh. Source:
  [betrush sportsbook UI](https://www.betrush.com/online-sportsbook-ui-design-1037.html).
- Never: framework default greys with a default blue; flat white cards; a single
  flat shadow; glass on a dense dark screen; a second accent used generically;
  title case; weights over 600; numbers that reflow; empty states left as bare
  "No data".
