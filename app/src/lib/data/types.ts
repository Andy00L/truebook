/**
 * View types every TrueBook screen renders. The demo provider fills them
 * today; the devnet chain provider fills the same shapes once the program
 * is deployed, so screens never change when the source does.
 */

export type FixturePhase = "upcoming" | "live" | "finished";

export type MarketPhase = "open" | "locked" | "awaitingProof" | "settled";

export type OutcomeQuote = {
  /** Stable key inside the fixture, e.g. "home", "draw", "over25". */
  outcomeKey: string;
  /** Label above the price: "France", "Draw", "Over 2.5". */
  label: string;
  /** Served decimal odds (consensus plus displayed margin). */
  servedOdds: number;
  /** TxLINE consensus decimal odds the served price derives from. */
  consensusOdds: number;
  /** The live or best cell carries the accent border at rest. */
  isBest: boolean;
};

export type MarketView = {
  /** Stable key inside the fixture, e.g. "1x2", "totals", "corners". */
  marketKey: string;
  /** On-chain market account address; present when the source is devnet. */
  marketAddress?: string;
  name: string;
  /** Eyebrow group label on the card: "1x2", "totals", "corners", "goals". */
  groupLabel: string;
  /** Displayed margin, e.g. "2.0%". */
  marginLabel: string;
  phase: MarketPhase;
  /** One line shown for locked or awaiting-proof markets. */
  phaseNote?: string;
  outcomes: OutcomeQuote[];
};

export type SettledMarketView = {
  name: string;
  groupLabel: string;
  /** "France · won" or "Over 2.5 · won · 3 goals". */
  resultLine: string;
  /** Two-decimal served odds string on the settled card. */
  servedOddsLabel: string;
  /** Full breakdown appears on the primary settlement receipt only. */
  breakdown?: {
    consensusLabel: string;
    marginLabel: string;
    servedLabel: string;
  };
  proof?: ProofRefs;
  awaitingNote?: string;
};

export type MatchView = {
  fixtureId: string;
  /** Eyebrow line: competition, round, venue. */
  competitionLine: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  clockSeconds: number;
  phase: FixturePhase;
  /** "Second half", "Full time", or a kickoff line for upcoming games. */
  periodNote: string;
  /** Kickoff value for upcoming fixtures: "in 2h 10m", "Jul 19 · 20:00". */
  kickoffLabel?: string;
  markets: MarketView[];
  /** Rendered instead of markets once the fixture is finished. */
  settledMarkets: SettledMarketView[];
};

export type ProofRefs = {
  dayRoot: string;
  merklePath: string;
  verifyTx: string;
};

/** Solana explorer link for a devnet transaction signature. */
export function explorerTxUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

/** Shown wherever an open market has no posted quote yet (lobby and match). */
export const AWAITING_QUOTE_NOTE = "The next keeper tick posts a fresh price.";

/**
 * The token label the UI shows per data source. The live devnet book is
 * denominated in the TxLINE test USDT mint (ELWTK...G2Ujh); the demo fixtures
 * are denominated in USDC. Single source of truth so no screen hardcodes it.
 */
export function currencyLabelForSource(dataSource: "demo" | "chain"): string {
  return dataSource === "chain" ? "USDT" : "USDC";
}
