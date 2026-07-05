import type { MatchView, ProofRefs } from "@/lib/data/types";

/**
 * Demo catalog: the remaining World Cup window as validated in the design
 * session. This is the source the screens render until the TrueBook program
 * is deployed to devnet and the chain provider takes over the same shapes.
 */

/** Realistic 32-byte-hash-shaped strings for demo proof receipts. */
export const DEMO_PROOF: ProofRefs = {
  dayRoot:
    "4d2c70b8f31a9e5d6c2b7a4f8e9d0c1b2a3f4e5d6c7b8a90e1d2c3b4a5f6e7d8101033",
  merklePath:
    "0669ea7c4d2b8f1a3e5c9d7b2f4a6e8c1d3b5f7a9e0c2d4b6f8a1e3c5d7e9b1ab9537d",
  verifyTx:
    "3NmXRo7d2VqkQfLpZjW8yTGaBcHsDe4MxUvKnPr6EJ9tYiA5wSg1hFb2mCzXkNeLiFh",
};

export const DEMO_BET_TX =
  "5KJp9qWvTn3RzYxM8cDbGh2LfAeUu7oSiN4kVrPmQw6EyXtZaB1gHdJcCsFvRkLmNoPq";

export const DEMO_QUOTE_ID =
  "9f3c1d5e7a9b2c4d6e8f0a1b3c5d7e9f2a4b6c8d0e1f3a5b7c9d2e4f6a8b0c77aa02";

const FRANCE_ARGENTINA: MatchView = {
  fixtureId: "18172400",
  competitionLine: "FIFA World Cup · Final · Lusail Iconic Stadium",
  homeTeam: "France",
  awayTeam: "Argentina",
  homeScore: 2,
  awayScore: 1,
  clockSeconds: 4032,
  phase: "live",
  periodNote: "Second half",
  markets: [
    {
      marketKey: "1x2",
      name: "Home win",
      groupLabel: "1x2",
      marginLabel: "2.0%",
      phase: "open",
      outcomes: [
        {
          outcomeKey: "home",
          label: "France",
          servedOdds: 2.06,
          consensusOdds: 2.1,
          isBest: true,
        },
        {
          outcomeKey: "draw",
          label: "Draw",
          servedOdds: 3.4,
          consensusOdds: 3.47,
          isBest: false,
        },
        {
          outcomeKey: "away",
          label: "Argentina",
          servedOdds: 3.75,
          consensusOdds: 3.83,
          isBest: false,
        },
      ],
    },
    {
      marketKey: "totals",
      name: "Over 2.5 goals",
      groupLabel: "totals",
      marginLabel: "1.8%",
      phase: "open",
      outcomes: [
        {
          outcomeKey: "over25",
          label: "Over 2.5",
          servedOdds: 1.62,
          consensusOdds: 1.65,
          isBest: true,
        },
        {
          outcomeKey: "under25",
          label: "Under 2.5",
          servedOdds: 2.28,
          consensusOdds: 2.32,
          isBest: false,
        },
      ],
    },
    {
      marketKey: "corners",
      name: "Second-half corners over 4.5",
      groupLabel: "corners",
      marginLabel: "1.6%",
      phase: "open",
      outcomes: [
        {
          outcomeKey: "cornersOver",
          label: "Over 4.5",
          servedOdds: 1.85,
          consensusOdds: 1.88,
          isBest: true,
        },
        {
          outcomeKey: "cornersUnder",
          label: "Under 4.5",
          servedOdds: 1.91,
          consensusOdds: 1.94,
          isBest: false,
        },
      ],
    },
    {
      marketKey: "nextGoal",
      name: "Next team to score",
      groupLabel: "goals",
      marginLabel: "2.0%",
      phase: "locked",
      phaseNote: "Suspended while VAR reviews the second goal.",
      outcomes: [],
    },
  ],
  settledMarkets: [
    {
      name: "Home win",
      groupLabel: "1x2",
      resultLine: "France · won",
      servedOddsLabel: "2.06",
      breakdown: {
        consensusLabel: "2.10",
        marginLabel: "2.0%",
        servedLabel: "2.06",
      },
      proof: DEMO_PROOF,
    },
    {
      name: "Over 2.5 goals",
      groupLabel: "totals",
      resultLine: "Over 2.5 · won · 3 goals",
      servedOddsLabel: "1.62",
      proof: DEMO_PROOF,
    },
    {
      name: "Second-half corners over 4.5",
      groupLabel: "corners",
      resultLine: "",
      servedOddsLabel: "",
      awaitingNote: "Settlement proof publishes with the day root at 00:00 UTC.",
    },
  ],
};

const SPAIN_AUSTRIA: MatchView = {
  fixtureId: "18172401",
  competitionLine: "FIFA World Cup · Semi-final · Estadio Azteca",
  homeTeam: "Spain",
  awayTeam: "Austria",
  homeScore: 0,
  awayScore: 0,
  clockSeconds: 0,
  phase: "upcoming",
  periodNote: "Kickoff in 2h 10m",
  kickoffLabel: "in 2h 10m",
  markets: [
    {
      marketKey: "1x2",
      name: "Home win",
      groupLabel: "1x2",
      marginLabel: "1.8%",
      phase: "open",
      outcomes: [
        {
          outcomeKey: "home",
          label: "Spain",
          servedOdds: 1.72,
          consensusOdds: 1.75,
          isBest: true,
        },
        {
          outcomeKey: "draw",
          label: "Draw",
          servedOdds: 3.9,
          consensusOdds: 3.97,
          isBest: false,
        },
        {
          outcomeKey: "away",
          label: "Austria",
          servedOdds: 5.25,
          consensusOdds: 5.35,
          isBest: false,
        },
      ],
    },
    {
      marketKey: "totals",
      name: "Over 2.5 goals",
      groupLabel: "totals",
      marginLabel: "1.8%",
      phase: "open",
      outcomes: [
        {
          outcomeKey: "over25",
          label: "Over 2.5",
          servedOdds: 1.95,
          consensusOdds: 1.99,
          isBest: true,
        },
        {
          outcomeKey: "under25",
          label: "Under 2.5",
          servedOdds: 1.87,
          consensusOdds: 1.9,
          isBest: false,
        },
      ],
    },
  ],
  settledMarkets: [],
};

const PORTUGAL_CROATIA: MatchView = {
  fixtureId: "18172402",
  competitionLine: "FIFA World Cup · Semi-final · MetLife Stadium",
  homeTeam: "Portugal",
  awayTeam: "Croatia",
  homeScore: 0,
  awayScore: 0,
  clockSeconds: 0,
  phase: "upcoming",
  periodNote: "Kickoff tomorrow 15:00",
  kickoffLabel: "tomorrow 15:00",
  markets: [
    {
      marketKey: "1x2",
      name: "Home win",
      groupLabel: "1x2",
      marginLabel: "1.9%",
      phase: "open",
      outcomes: [
        {
          outcomeKey: "home",
          label: "Portugal",
          servedOdds: 2.3,
          consensusOdds: 2.34,
          isBest: true,
        },
        {
          outcomeKey: "draw",
          label: "Draw",
          servedOdds: 3.2,
          consensusOdds: 3.26,
          isBest: false,
        },
        {
          outcomeKey: "away",
          label: "Croatia",
          servedOdds: 3.3,
          consensusOdds: 3.36,
          isBest: false,
        },
      ],
    },
  ],
  settledMarkets: [],
};

const BRAZIL_NORWAY: MatchView = {
  fixtureId: "18172403",
  competitionLine: "FIFA World Cup · Final · Lusail Iconic Stadium",
  homeTeam: "Brazil",
  awayTeam: "Norway",
  homeScore: 0,
  awayScore: 0,
  clockSeconds: 0,
  phase: "upcoming",
  periodNote: "Kickoff Jul 19 · 20:00",
  kickoffLabel: "Jul 19 · 20:00",
  markets: [
    {
      marketKey: "1x2",
      name: "Home win",
      groupLabel: "1x2",
      marginLabel: "2.0%",
      phase: "open",
      outcomes: [
        {
          outcomeKey: "home",
          label: "Brazil",
          servedOdds: 1.55,
          consensusOdds: 1.58,
          isBest: true,
        },
        {
          outcomeKey: "draw",
          label: "Draw",
          servedOdds: 4.1,
          consensusOdds: 4.18,
          isBest: false,
        },
        {
          outcomeKey: "away",
          label: "Norway",
          servedOdds: 6.1,
          consensusOdds: 6.22,
          isBest: false,
        },
      ],
    },
  ],
  settledMarkets: [],
};

const DEMO_FIXTURES: ReadonlyArray<MatchView> = [
  FRANCE_ARGENTINA,
  SPAIN_AUSTRIA,
  PORTUGAL_CROATIA,
  BRAZIL_NORWAY,
];

export function listDemoFixtures(): ReadonlyArray<MatchView> {
  return DEMO_FIXTURES;
}

export function getDemoFixture(fixtureId: string): MatchView | null {
  return (
    DEMO_FIXTURES.find((fixture) => fixture.fixtureId === fixtureId) ?? null
  );
}
