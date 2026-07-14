/**
 * Devnet fixture names for the markets the keeper created on 2026-07-05.
 * The chain stores only fixture ids; TxLINE names need an authenticated API
 * session the browser must not hold. sourceRef: keeper tick log of
 * 2026-07-05 (creation order matches market ids 0 to 9). A keeper
 * export-catalog command can regenerate this file when the board changes.
 */

export type FixtureNameEntry = {
  homeTeam: string;
  awayTeam: string;
  competitionLine: string;
};

const FIXTURE_NAMES: Record<string, FixtureNameEntry> = {
  "18143850": {
    homeTeam: "Vietnam",
    awayTeam: "Myanmar",
    competitionLine: "TxLINE devnet · international friendly",
  },
  "18182808": {
    homeTeam: "Australia",
    awayTeam: "Brazil",
    competitionLine: "TxLINE devnet · international friendly",
  },
  "18182864": {
    homeTeam: "Australia",
    awayTeam: "Brazil",
    competitionLine: "TxLINE devnet · international friendly",
  },
  "18187298": {
    homeTeam: "Brazil",
    awayTeam: "Norway",
    competitionLine: "TxLINE devnet · international friendly",
  },
  "18192996": {
    homeTeam: "Mexico",
    awayTeam: "England",
    competitionLine: "TxLINE devnet · international friendly",
  },
  "18193785": {
    homeTeam: "USA",
    awayTeam: "Belgium",
    competitionLine: "TxLINE devnet · international friendly",
  },
  "18198205": {
    homeTeam: "Portugal",
    awayTeam: "Spain",
    competitionLine: "TxLINE devnet · international friendly",
  },
  "18202701": {
    homeTeam: "Argentina",
    awayTeam: "Egypt",
    competitionLine: "TxLINE devnet · international friendly",
  },
  "18202783": {
    homeTeam: "Switzerland",
    awayTeam: "Colombia",
    competitionLine: "TxLINE devnet · international friendly",
  },
  "18209181": {
    homeTeam: "France",
    awayTeam: "Morocco",
    competitionLine: "TxLINE devnet · international friendly",
  },
  // Markets 10 to 12, created by the tick of 2026-07-09 (same log-order rule).
  "18213979": {
    homeTeam: "Norway",
    awayTeam: "England",
    competitionLine: "TxLINE devnet · international friendly",
  },
  "18218149": {
    homeTeam: "Spain",
    awayTeam: "Belgium",
    competitionLine: "TxLINE devnet · international friendly",
  },
  "18222446": {
    homeTeam: "Argentina",
    awayTeam: "Switzerland",
    competitionLine: "TxLINE devnet · international friendly",
  },
  // Fixtures added by the tick of 2026-07-14 (TxLINE snapshot).
  "18242838": {
    homeTeam: "New Zealand",
    awayTeam: "India",
    competitionLine: "TxLINE devnet · international friendly",
  },
  "18242839": {
    homeTeam: "New Zealand",
    awayTeam: "India",
    competitionLine: "TxLINE devnet · international friendly",
  },
  // Markets 13 and 14, created by the tick of 2026-07-12 (TxLINE snapshot).
  "18237038": {
    homeTeam: "France",
    awayTeam: "Spain",
    competitionLine: "TxLINE devnet · international friendly",
  },
  "18241006": {
    homeTeam: "England",
    awayTeam: "Argentina",
    competitionLine: "TxLINE devnet · international friendly",
  },
};

export function getFixtureNames(fixtureId: string): FixtureNameEntry {
  return (
    FIXTURE_NAMES[fixtureId] ?? {
      homeTeam: `Fixture ${fixtureId}`,
      awayTeam: "",
      competitionLine: "TxLINE devnet fixture",
    }
  );
}
