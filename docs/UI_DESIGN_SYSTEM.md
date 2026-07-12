# TrueBook UI design system (the token sheet)

The single source of truth for the frontend. Every screen reads from this; no
literal colors, spacing, radii, or shadows in components. Register: a noir
wealth terminal, Wealthsimple's dark account screens crossed with Convex's
data precision: calm, warm-black, borderless, precise. Theme: dark only.
Stack: Next.js App Router, Tailwind v4 @theme tokens.

House style, one line: a private-bank terminal for provable odds. Warm black
surfaces, big thin numbers that roll digit by digit, one green for everything
interactive, and every verdict spoken by a bordered pill, never a stamp.

Hero moment: the match page, where the served price, its distance from
consensus, and the odds tick (the odometer roll) sit together. Every other
screen is quieter.

Version note: v3 (noir), approved July 11, 2026, replaces the ticket-paper
sheet (v2, July 10) and the graphite broadcast-dark sheet (v1). The component
values below are extracted from the reference DOM (Wealthsimple dark), not
approximated. The approved palette card is `ui-design/palette.html`.

## Palette

| Role | Value | Use |
| --- | --- | --- |
| Field | `#0D0D0D` | the page, a warm black; never pure `#000`, never a grey theme |
| Card | `#161615` | the first surface; borderless, shadowless |
| Raised | `#1F1F1E` | the second surface: inner panels, chips, the segmented track |
| Lift | `#2C2C2A` | the segmented indicator, one step above raised |
| Hairline | `rgba(252,252,252,0.07)` | row separators only; cards have no border |
| Ink | `#FCFCFC` | primary text AND the primary button fill (about 17:1 on card) |
| Muted | `#7E7B76` | secondary text, section labels (labels only; long copy in ink) |
| Faint | `#585652` | captions, disabled; decorative only, never body copy |
| Accent green | `#37BC65` | THE only interactive color: links, live, focus, rising deltas, verified |
| Accent soft | `rgba(55,188,101,0.12)` | tinted fills, hover wash |
| Data blue | `#5B88D9` | RESERVED: the consensus line in charts and info notes; never interactive |
| Amber | `#D6A243` | RESERVED: locked / awaiting proof / low-SOL, once per screen |
| Danger red | `#E5484D` | a proven violation, a loss, a falling price, errors |
| Chart fill | `#409652` at 32% | the gradient top stop, fading to transparent, dots only |

Rules: green is the only saturated interactive color. The primary button is a
cream pill (ink `#FCFCFC` fill, field text): the brightest object on screen is
the primary action, and it is neutral, not a second accent. Blue and amber are
punctuation, once per screen. Red is reserved, never a generic status.

## Type

- One family: TikTok Sans (Google Fonts), weights 300 to 600, ceiling 600.
- Big numbers at weight 300 (large, thin, quiet): vault, odds, scores,
  balances, outcomes.
- UI at 400 to 500; sentence case everywhere; uppercase only inside status
  pills (11px, tracking 0.08em).
- Data face: Geist Mono, `font-variant-numeric: tabular-nums`, for every hash,
  address, tx signature, odds source string, and the transparency equation.
- ALL numbers tabular so digits never reflow.
- Size steps: 11, 12, 13, 15, 17, 22, 32, 44 px.
- Section labels: 13px, weight 400, muted, sentence case (no uppercase
  eyebrows in this system).

## Space and shape

- Radii: 16 (cards), 12 (inner panels, inputs), 9999 (everything interactive:
  buttons, chips, badges, the segmented control, the wallet chip). Icon
  buttons are 32px circles on raised.
- Spacing: 4px base rhythm (4, 8, 12, 16, 24, 32). Card padding 20 to 24px.
- Content width 1060 to 1200px, generous side padding.
- Radii nest downward: an inner radius is always smaller than its parent.

## Material and depth (a surface value, never a shadow)

```css
--field: #0D0D0D;  --card: #161615;  --raised: #1F1F1E;  --lift: #2C2C2A;
.card { background: var(--card); border-radius: 16px; }  /* no border, no shadow */
.row:hover { background: var(--raised); }                /* or brightness(1.3) */
```

Elevation is field < card < raised < lift. No drop shadows, no borders on
cards, no glass, no grain, no texture. Interactive surfaces respond by
brightening (120ms); the cream button hovers `brightness(0.9)`. Nothing lifts
or translates on hover. One sanctioned exception: a popover or sheet over a
scrim may carry a single soft drop (`0 16px 40px rgba(0,0,0,0.45)`).
Hairlines separate rows only, never outline surfaces. Focus is one treatment
everywhere: a 2px accent outline, offset 2px.

## Component recipes (extracted from the reference DOM)

- **Odometer number (the signature motion).** Every changing figure animates
  per digit: a hidden static digit reserves the width (`visibility: hidden;
  display: inline-block`), the live digit sits absolute over it (`top: 0;
  left: 0; right: 0; text-align: center; will-change: transform, opacity,
  filter`) and rolls in with `translateY(0.55em to 0)` + opacity 0 to 1 +
  `blur(6px to 0)`, 450ms on the enter curve, 30ms stagger between changing
  digits. Separators and currency stay static; the animated replica is
  `aria-hidden`, the true value stays accessible.
- **Dot-matrix chart.** Line `#37BC65` stroke-width 1.5, drawn twice (an echo
  at opacity 0.2 under the crisp stroke). Fill: linearGradient `#409652` at
  0.32 to transparent, masked by an SVG pattern of 0.5px-radius white dots on
  a 2x2px grid; never a solid wash. Consensus line `#5B88D9`, 1px, dashed
  2 3. Step-curve geometry (control points at horizontal midpoints). No
  gridlines, no axis boxes; 11px muted time labels.
- **Segmented control.** Pill track on raised, 3px inner padding; a sliding
  lift indicator animating `translateX` + measured width, 250ms on-screen
  curve (the one sanctioned width transition); selected label ink 500, others
  muted 400; `role=tablist/tab`.
- **Buttons.** Primary: cream pill, `#FCFCFC` fill, field text at 500, h44,
  padding 0 22, hover `brightness(0.9)`, press scale 0.97. Secondary: raised
  pill, ink label 13px 500, 16px icon + 8px gap, h40, hover
  `brightness(1.3)`. Tertiary: green text link.
- **Icons.** One set, 16x16 viewBox, filled paths with rounded terminals
  (0.9px-radius rounded ends, no thin stroked outlines), `currentColor`;
  standalone icons on 32px raised circles, never bare on the field.
- **Accordion.** Header: 13px muted label left, aggregate value + 16px
  chevron right; chevron rotates 180deg at 250ms; body expands
  `grid-template-rows: 0fr to 1fr` at 250ms (never height). Rows: 15px ink
  title over 13px muted subtitle, value right-aligned tabular, the row
  surface brightens on hover; rows separate by spacing, not lines.
- **Proof pills (the entire verdict language; no seals, stamps, coins, or
  skeuomorphism anywhere).** 11px uppercase pill, tracking 0.08em, weight
  500, 1px border, 10 to 12% tinted fill. VERIFIED ON SOLANA green; PROVEN
  OVERCHARGE and REFUNDED danger; LOCKED and AWAITING PROOF amber; LIVE green
  with a 6px core dot and two staggered ping halos (the second about 1s
  late).
- **Delta line.** 16px arrow icon + signed change + percent, 13px 500, green
  rising or danger falling, then a muted period label.
- **Wallet chip.** Raised pill, 8px green connection dot, truncated address
  in mono 12px.
- **Transparency equation (the secondary signature).** Under every quote, in
  mono 12px muted: `consensus 2.19 · margin 2.0% · you 2.15`, the consensus
  figure allowed in data blue.

## Motion tokens

- Durations: 120 (micro: hover, color), 160 (exit), 200 (enter), 250
  (on-screen), 450 (odometer per digit), 600 (chart draw-on). Nothing
  decorative over about 600.
- Easings: enter `cubic-bezier(0.16,1,0.3,1)`, exit `cubic-bezier(0.4,0,1,1)`,
  on-screen `cubic-bezier(0.4,0,0.2,1)`. Linear only on a continuous spinner.
- Stagger constant: 40ms (rows, lists); 30ms between changing odometer digits.
- Press scale 0.97. Hover: surface brightening only, 120ms.
- Odds tick: the changed digits roll (odometer) and a small delta chip appears
  beside the price for 1.2s; digits never change width.
- Count-ups ease the value on tabular figures; one number animating at a time.
- Overshoot budget: ZERO. Nothing bounces; the register is calm.
- `prefers-reduced-motion`: all collapse to opacity-only, identical final
  layout.

## Signature element (what TrueBook owns)

Primary: the audited price in motion. Every changing figure rolls per digit
under a blur (the odometer), and every resolved state speaks only through a
bordered proof pill. Placement: the odds tick on the match board, the vault
count-in on the lobby, the balance roll in judge mode, the verdict pill last
in every choreography.

Secondary: the transparency equation under every quote, and the dot-matrix
chart wherever a price history renders (lobby sparkline, replay chart).

## Screens (hero first)

1. `/match/[fixtureId]` (hero): score header, the market board, price
   transparency, the bet slip drawer resolving into a verified receipt.
2. `/` lobby: the honesty header (vault odometer + sparkline), fixture cards,
   judge mode entry.
3. `/tickets`: accordion ticket rows opening into on-chain receipts.
4. `/verify/[market]`: the public, shareable statement card.
5. `/replay`: the dot-matrix price chart scrubbed over a settled match.
6. Judge mode: the funding panel over the lobby.

## Anti-patterns (never)

Seals, stamps, coins, wax, paper texture, perforations, or any skeuomorphic
object; borders or drop shadows on cards; pure `#000` or a grey theme; a
second interactive color; blue or amber used generically; title case; weights
over 600; numbers that reflow; empty states left as a bare "No data";
animating width/height/top/left (exceptions: the segmented indicator, the
accordion grid-rows); a default or linear easing on a move; a bare crossfade;
scale-from-0; hover lifts; a stagger of 100ms or more; glass; grain;
gradients as decoration (the chart fill is the only gradient).
